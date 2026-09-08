#!/usr/bin/env node
/**
 * 将 Natural Earth 陆地 topojson(land-110m) 栅格化为 0.25° 点阵位图。
 * 产物: ../land.js
 *
 * 按 Polygon 独立扫描线再并集：环内经度逐步展开，避免日界线小岛
 * 的 ±180 交点与非洲/美洲交点在「全球偶奇」里错配，造成大陆缝和北极假环。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '.land-110m.json');
const OUT = path.join(__dirname, '..', 'land.js');
const CELL = 0.25;
const COLS = Math.round(360 / CELL);
const ROWS = Math.round(180 / CELL);

const topo = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const { scale, translate } = topo.transform;

const decodeArc = arc => {
  const pts = [];
  let x = 0, y = 0;
  for (const [dx, dy] of arc) {
    x += dx; y += dy;
    pts.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
  }
  return pts;
};

const arcsToRing = refs => {
  let pts = [];
  for (const r of refs) {
    const arc = r >= 0 ? decodeArc(topo.arcs[r]) : decodeArc(topo.arcs[-1 - r]).reverse();
    pts = pts.length ? pts.slice(0, -1).concat(arc) : arc;
  }
  return pts;
};

const polygons = [];
for (const g of topo.objects.land.geometries) {
  if (g.type === 'Polygon') polygons.push(g.arcs.map(arcsToRing));
  else if (g.type === 'MultiPolygon') {
    for (const poly of g.arcs) polygons.push(poly.map(arcsToRing));
  }
}

const unwrapLon = (lon0, lon1) => {
  let d = lon1 - lon0;
  if (d > 180) lon1 -= 360;
  else if (d < -180) lon1 += 360;
  return lon1;
};

/** 逐步展开环，并正确闭合到起点 */
const unwrapRing = ring => {
  if (ring.length < 3) return [];
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    out.push([unwrapLon(out[i - 1][0], ring[i][0]), ring[i][1]]);
  }
  // 闭合边：从末点回到起点（展开后）
  const closeLon = unwrapLon(out[out.length - 1][0], ring[0][0]);
  out.push([closeLon, ring[0][1]]);
  return out;
};

const nearAntimeridian = lon => {
  const x = ((lon + 180) % 360 + 360) % 360 - 180; // [-180,180)
  return Math.abs(Math.abs(x) - 180) < 0.05 || Math.abs(x) > 179.95;
};

const rowBits = Array.from({ length: ROWS }, () => new Uint8Array(COLS).fill(0));

const fillLonRange = (row, lon0, lon1) => {
  let a = Math.floor((lon0 + 180) / CELL);
  let b = Math.floor((lon1 + 180) / CELL);
  if (b < a) { const t = a; a = b; b = t; }
  if (b - a >= COLS - 1) return; // 拒绝接近整圈的错误段
  for (let c = a; c <= b; c++) row[((c % COLS) + COLS) % COLS] = 1;
};

for (const rings of polygons) {
  const unwrapped = rings.map(unwrapRing).filter(r => r.length >= 4);
  for (let r = 0; r < ROWS; r++) {
    const lat = 90 - (r + 0.5) * CELL;
    const crossings = [];
    for (const ring of unwrapped) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        const lo = y1 < y2 ? y1 : y2, hi = y1 < y2 ? y2 : y1;
        if (lat < lo || lat >= hi) continue;
        // 日界线裁切竖边（经度几乎不变且贴在 ±180）
        if (Math.abs(x2 - x1) < 0.05 && nearAntimeridian(x1)) continue;
        crossings.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a - b);
    const tmp = new Uint8Array(COLS);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      fillLonRange(tmp, crossings[k], crossings[k + 1]);
    }
    const dest = rowBits[r];
    for (let c = 0; c < COLS; c++) if (tmp[c]) dest[c] = 1;
  }
}

const bytes = Buffer.alloc(ROWS * Math.ceil(COLS / 8));
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    if (!rowBits[r][c]) continue;
    bytes[r * Math.ceil(COLS / 8) + (c >> 3)] |= 0x80 >> (c & 7);
  }
}
const b64 = bytes.toString('base64');
fs.writeFileSync(OUT, `window.LAND_DATA="${b64}";\n`);

const landCells = rowBits.reduce((a, row) => a + row.reduce((s, v) => s + v, 0), 0);
console.log(`polys ${polygons.length}, land ${landCells} (${((landCells / (COLS * ROWS)) * 100).toFixed(1)}%) -> ${path.relative(__dirname, OUT)}`);
