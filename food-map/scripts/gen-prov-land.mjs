#!/usr/bin/env node
/**
 * 将 DataV 中国省级边界栅格化为 0.125° 省 ID 稀疏位图（与 land.js 网格独立）。
 * 源: scripts/.china-prov.json
 * 产物: ../prov-land.js  -> window.PROV_LAND_* + window.DASH_LINE
 *
 *   curl -sL https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json \
 *     -o scripts/.china-prov.json
 *   node scripts/gen-prov-land.mjs
 *
 * 说明：
 * - 只覆盖中国范围（TOP/LEFT/BOTTOM/RIGHT），比全球网格小 20 倍
 * - 稀疏编码：varint(索引增量) + id 字节，1.5% 的非零格不再占满整块内存
 * - 小岛质心兜底：面积小于一格的岛礁（西沙/东沙/钓鱼岛等）扫描线必然漏采，
 *   命中不到任何格心时在质心补一格，保证「出现」（湖泊空洞有向面积为负，不补）
 * - 九段线（DataV 的 JD 要素）不进栅格：它是细长多边形，栅格化必糊；
 *   改为提取中线折线由前端按点采样绘制
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '.china-prov.json');
const OUT = path.join(__dirname, '..', 'prov-land.js');

const CELL = 0.125;
const TOP = 56, LEFT = 71, BOTTOM = 3, RIGHT = 136;
const COLS = Math.round((RIGHT - LEFT) / CELL);
const ROWS = Math.round((TOP - BOTTOM) / CELL);

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

/** 只涂「格心落在 [lon0,lon1] 内」的格子（与格心采样口径一致，不留半格外溢） */
const fillSpan = (rowTmp, lon0, lon1, id) => {
  let a = Math.ceil((lon0 - LEFT) / CELL - 0.5);
  let b = Math.floor((lon1 - LEFT) / CELL - 0.5);
  if (b < a) { const t = a; a = b; b = t; }
  if (b - a >= COLS - 1) return;              // 拒绝接近全宽的异常段
  if (a < 0) a = 0;
  if (b > COLS - 1) b = COLS - 1;
  for (let c = a; c <= b; c++) rowTmp[c] = id;
};

const rowOf = lat => Math.floor((TOP - lat) / CELL);
const centerLat = r => TOP - (r + 0.5) * CELL;
const centerLon = c => LEFT + (c + 0.5) * CELL;

/** 环的有向面积（正=外环，负=空洞） */
function signedArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return a / 2;
}
/** 面积加权质心；退化时退回顶点均值 */
function centroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    let sx = 0, sy = 0;
    for (const p of ring) { sx += p[0]; sy += p[1]; }
    return [sx / ring.length, sy / ring.length];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

let painted = 0, fallback = 0, outOfBox = 0;
const fallbackNames = new Map();

for (const f of geo.features) {
  if (f.properties && f.properties.adchar === 'JD') continue;   // 九段线走 DASH_LINE
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
    if (!rings.length) continue;
    const outer = poly[0];
    const solid = signedArea(outer) > 0;                        // 负 = 湖泊空洞，跳过
    if (!solid) continue;

    let hit = false;
    const latMin = Math.min(...outer.map(p => p[1]));
    const latMax = Math.max(...outer.map(p => p[1]));
    const rA = Math.max(0, rowOf(latMax)), rB = Math.min(ROWS - 1, rowOf(latMin));

    for (let r = rA; r <= rB; r++) {
      const lat = centerLat(r);
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
        fillSpan(tmp, crossings[k], crossings[k + 1], id);
      }
      const base = r * COLS;
      for (let c = 0; c < COLS; c++) {
        if (!tmp[c]) continue;
        hit = true;
        if (!grid[base + c]) painted++;
        grid[base + c] = id;
      }
    }

    // 质心兜底：小于一格的岛礁（西沙/东沙/钓鱼岛/金门…）扫描线一个格心都命不中
    if (!hit) {
      const [clon, clat] = centroid(rings[0]);
      const r = rowOf(clat), c = Math.floor((clon - LEFT) / CELL);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        const i = r * COLS + c;
        if (!grid[i] || grid[i] === id) {
          if (!grid[i]) painted++;
          grid[i] = id;
          fallback++;
          fallbackNames.set(name, (fallbackNames.get(name) || 0) + 1);
        }
      } else outOfBox++;
    }
  }
  console.log(name, 'id', id);
}

// ---- 九段线：提取每条细长多边形的中线（沿主轴两侧路径等长重采样后取中点） ----
const dashGeo = (geo.features.find(f => f.properties && f.properties.adchar === 'JD') || {}).geometry;
const dashLines = [];
if (dashGeo) {
  for (const poly of dashGeo.coordinates) {
    const ring = poly[0].slice(0, -1);
    if (ring.length < 4) continue;
    let mx = 0, my = 0;
    for (const p of ring) { mx += p[0]; my += p[1]; }
    mx /= ring.length; my /= ring.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of ring) {
      const dx = p[0] - mx, dy = p[1] - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ux = Math.cos(th), uy = Math.sin(th);
    let iA = 0, iB = 0, uA = Infinity, uB = -Infinity;
    ring.forEach((p, i) => {
      const u = (p[0] - mx) * ux + (p[1] - my) * uy;
      if (u < uA) { uA = u; iA = i; }
      if (u > uB) { uB = u; iB = i; }
    });
    const walk = (from, to) => {
      const out = [];
      for (let i = from; ; i = (i + 1) % ring.length) {
        out.push(ring[i]);
        if (i === to) break;
      }
      return out;
    };
    const resample = (pts, n) => {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      }
      const total = cum[cum.length - 1] || 1;
      const out = [];
      let seg = 0;
      for (let k = 0; k < n; k++) {
        const target = total * k / (n - 1);
        while (seg < pts.length - 2 && cum[seg + 1] < target) seg++;
        const t = (target - cum[seg]) / Math.max(cum[seg + 1] - cum[seg], 1e-12);
        out.push([
          pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * t,
          pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * t
        ]);
      }
      return out;
    };
    const K = 16;
    const p1 = resample(walk(iA, iB), K);          // 去程（A→B 一侧）
    const p2 = resample(walk(iB, iA), K).reverse(); // 回程反向（A→B 另一侧）
    const line = [];
    for (let k = 0; k < K; k++) {
      line.push(+((p1[k][0] + p2[k][0]) / 2).toFixed(4), +((p1[k][1] + p2[k][1]) / 2).toFixed(4));
    }
    dashLines.push(line);
  }
}

// ---- 稀疏编码：varint(索引增量) + id ----
const idxList = [];
for (let i = 0; i < grid.length; i++) if (grid[i]) idxList.push(i);
const buf = [];
let prev = 0;
for (const i of idxList) {
  let d = i - prev;
  prev = i;
  while (d >= 128) { buf.push((d & 0x7f) | 0x80); d >>>= 7; }
  buf.push(d);
  buf.push(grid[i]);
}
const b64 = Buffer.from(buf).toString('base64');

const header = `/* DataV 省级边界栅格（${CELL}°，覆盖 ${LEFT}~${RIGHT}E / ${BOTTOM}~${TOP}N）
 * PROV_LAND_DATA: 稀疏码流 = 重复[ varint(索引增量), id字节 ]，索引按行主序
 * DASH_LINE: 九段线中线折线，每条为扁平 [lon,lat,lon,lat,...] */
window.PROV_LAND_CELL=${CELL};
window.PROV_LAND_LEFT=${LEFT};
window.PROV_LAND_TOP=${TOP};
window.PROV_LAND_COLS=${COLS};
window.PROV_LAND_ROWS=${ROWS};
window.PROV_LAND_DATA="${b64}";
window.DASH_LINE=${JSON.stringify(dashLines)};
`;
fs.writeFileSync(OUT, header);

console.log(`\n网格 ${COLS}×${ROWS}（${(COLS * ROWS / 1000).toFixed(0)}k 格），非零 ${idxList.length}（${(idxList.length / (COLS * ROWS) * 100).toFixed(1)}%）`);
console.log(`质心兜底 ${fallback} 格：`, [...fallbackNames.entries()].map(([k, v]) => `${k}×${v}`).join('，') || '（无）');
if (outOfBox) console.log(`⚠ 超出栅格范围被丢弃 ${outOfBox} 个`);
console.log(`九段线 ${dashLines.length} 段`);
console.log(`写入 ${path.relative(__dirname, OUT)}：${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
