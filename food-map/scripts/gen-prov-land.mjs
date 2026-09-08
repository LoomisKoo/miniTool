#!/usr/bin/env node
/**
 * 将 DataV 中国省级边界栅格化为 0.25° 省 ID 位图（与 land.js 同网格）。
 * 源: scripts/.china-prov.json
 * 产物: ../prov-land.js  -> window.PROV_LAND_DATA
 *
 *   curl -sL https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json \
 *     -o scripts/.china-prov.json
 *   node scripts/gen-prov-land.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '.china-prov.json');
const OUT = path.join(__dirname, '..', 'prov-land.js');
const CELL = 0.25;
const COLS = Math.round(360 / CELL);
const ROWS = Math.round(180 / CELL);

const PROV_ORDER = [
  '北京', '天津', '河北', '山西', '内蒙古',
  '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南',
  '广东', '广西', '海南',
  '重庆', '四川', '贵州', '云南', '西藏',
  '陕西', '甘肃', '青海', '宁夏', '新疆',
  '香港', '澳门', '台湾'
];
const idOf = new Map(PROV_ORDER.map((n, i) => [n, i + 1]));

function shortName(name) {
  if (!name) return '';
  return name
    .replace(/维吾尔自治区$/, '')
    .replace(/壮族自治区$/, '')
    .replace(/回族自治区$/, '')
    .replace(/特别行政区$/, '')
    .replace(/自治区$/, '')
    .replace(/省$/, '')
    .replace(/市$/, '');
}

const unwrapLon = (lon0, lon1) => {
  let d = lon1 - lon0;
  if (d > 180) lon1 -= 360;
  else if (d < -180) lon1 += 360;
  return lon1;
};

const unwrapRing = ring => {
  if (ring.length < 3) return [];
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    out.push([unwrapLon(out[i - 1][0], ring[i][0]), ring[i][1]]);
  }
  const closeLon = unwrapLon(out[out.length - 1][0], ring[0][0]);
  out.push([closeLon, ring[0][1]]);
  return out;
};

const geo = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const grid = new Uint8Array(COLS * ROWS);

const fillLonRange = (rowTmp, lon0, lon1, id) => {
  let a = Math.floor((lon0 + 180) / CELL);
  let b = Math.floor((lon1 + 180) / CELL);
  if (b < a) { const t = a; a = b; b = t; }
  if (b - a >= COLS - 1) return;
  for (let c = a; c <= b; c++) {
    const cc = ((c % COLS) + COLS) % COLS;
    rowTmp[cc] = id;
  }
};

let painted = 0;
for (const f of geo.features || []) {
  const name = shortName(f.properties && f.properties.name);
  const id = idOf.get(name);
  if (!id || !f.geometry) {
    console.warn('skip', f.properties && f.properties.name, '->', name);
    continue;
  }
  const polys = f.geometry.type === 'Polygon'
    ? [f.geometry.coordinates]
    : f.geometry.type === 'MultiPolygon'
      ? f.geometry.coordinates
      : [];

  for (const poly of polys) {
    const rings = poly.map(ring => unwrapRing(ring)).filter(r => r.length >= 4);
    for (let r = 0; r < ROWS; r++) {
      const lat = 90 - (r + 0.5) * CELL;
      const crossings = [];
      for (const ring of rings) {
        for (let i = 0; i < ring.length - 1; i++) {
          const [x1, y1] = ring[i];
          const [x2, y2] = ring[i + 1];
          const lo = y1 < y2 ? y1 : y2, hi = y1 < y2 ? y2 : y1;
          if (lat < lo || lat >= hi) continue;
          crossings.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      if (crossings.length < 2) continue;
      crossings.sort((a, b) => a - b);
      const tmp = new Uint8Array(COLS);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        fillLonRange(tmp, crossings[k], crossings[k + 1], id);
      }
      const base = r * COLS;
      for (let c = 0; c < COLS; c++) {
        if (!tmp[c]) continue;
        if (!grid[base + c]) painted++;
        grid[base + c] = id;
      }
    }
  }
  console.log(name, 'id', id);
}

const b64 = Buffer.from(grid).toString('base64');
fs.writeFileSync(OUT, `window.PROV_LAND_DATA="${b64}";\n`);
console.log(`painted ${painted} cells -> ${path.relative(__dirname, OUT)} (${(b64.length / 1024).toFixed(1)}KB b64)`);
