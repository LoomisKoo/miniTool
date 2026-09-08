#!/usr/bin/env node
/**
 * 从 againster1992-debug/china-food-map 的 src/data 抽取美食，
 * 一菜一点写入 data.js（仅中国，不含海外）。
 *
 * 用法:
 *   node scripts/import-china-food-map.mjs [/path/to/china-food-map/src/data]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC =
  process.argv[2] ||
  '/tmp/china-food-map/repo/src/data';

const SEC = {
  北京: '华北', 天津: '华北', 河北: '华北', 山西: '华北', 内蒙古: '华北',
  辽宁: '东北', 吉林: '东北', 黑龙江: '东北',
  上海: '华东', 江苏: '华东', 浙江: '华东', 安徽: '华东', 福建: '华东',
  江西: '华东', 山东: '华东',
  河南: '华中', 湖北: '华中', 湖南: '华中',
  广东: '华南', 广西: '华南', 海南: '华南',
  重庆: '西南', 四川: '西南', 贵州: '西南', 云南: '西南', 西藏: '西南',
  陕西: '西北', 甘肃: '西北', 青海: '西北', 宁夏: '西北', 新疆: '西北',
  香港: '港澳台', 澳门: '港澳台', 台湾: '港澳台',
};

const PROVINCE_CENTER = {
  北京: [39.9, 116.4], 天津: [39.1, 117.2], 河北: [38.0, 114.5], 山西: [37.9, 112.5],
  内蒙古: [40.8, 111.7], 辽宁: [41.8, 123.4], 吉林: [43.9, 125.3], 黑龙江: [45.8, 126.5],
  上海: [31.2, 121.5], 江苏: [32.1, 118.8], 浙江: [30.3, 120.2], 安徽: [31.8, 117.2],
  福建: [26.1, 119.3], 江西: [28.7, 115.9], 山东: [36.7, 117.0], 河南: [34.7, 113.6],
  湖北: [30.6, 114.3], 湖南: [28.2, 112.9], 广东: [23.1, 113.3], 广西: [22.8, 108.3],
  海南: [20.0, 110.3], 重庆: [29.6, 106.5], 四川: [30.6, 104.1], 贵州: [26.6, 106.7],
  云南: [25.0, 102.7], 西藏: [29.7, 91.1], 陕西: [34.3, 108.9], 甘肃: [36.1, 103.8],
  青海: [36.6, 101.8], 宁夏: [38.5, 106.2], 新疆: [43.8, 87.6],
  香港: [22.3, 114.2], 澳门: [22.2, 113.5], 台湾: [25.0, 121.6],
};

const SKIP_CAT = new Set(['物产', '调料', '饮食文化']);
const FAME_SCORE = { 名菜: 40, 热门: 28, 地方名吃: 18, 普通: 5 };

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function extractFoods(src) {
  const text = stripComments(src);
  const out = [];
  const re = /\{\s*id:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    let depth = 0, end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    if (end < 0) continue;
    const block = text.slice(start, end);
    const str = (k) => {
      const mm = block.match(new RegExp(`${k}:\\s*["'\`]([\\s\\S]*?)["'\`]\\s*,`));
      if (!mm) {
        const mm2 = block.match(new RegExp(`${k}:\\s*["'\`]([\\s\\S]*?)["'\`]\\s*`));
        return mm2 ? mm2[1].replace(/\\n/g, '').replace(/\s+/g, ' ').trim() : '';
      }
      return mm[1].replace(/\\n/g, '').replace(/\s+/g, ' ').trim();
    };
    const num = (k) => {
      const mm = block.match(new RegExp(`${k}:\\s*(-?\\d+(?:\\.\\d+)?)`));
      return mm ? Number(mm[1]) : NaN;
    };
    const name = str('name');
    const province = str('province');
    const description = str('description');
    const lat = num('lat');
    const lng = num('lng');
    if (!name || !province || !description || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (province === '外国' || province === '全国') continue;
    const category = str('category');
    if (SKIP_CAT.has(category)) continue;
    const type = str('type');
    if (type === 'tradition') continue;
    if (/年夜饭|全席|习俗|文化节|非遗名录$/.test(name)) continue;
    out.push({
      id: m[1],
      name,
      province,
      city: str('city') || '',
      origin: str('origin'),
      description,
      category,
      type,
      fame: str('fame') || '普通',
      popularity: Number.isFinite(num('popularity')) ? num('popularity') : 3,
      lat,
      lng,
    });
  }
  return out;
}

function score(f) {
  let s = (FAME_SCORE[f.fame] || 5) + (f.popularity || 0) * 4;
  if (['主菜', '小吃', '面食', '主食', '火锅', '凉菜'].includes(f.category)) s += 8;
  if (f.category === '饮品' || f.category === '腌腊') s -= 6;
  if (f.type === 'traditional' || f.type === 'popular') s += 4;
  return s;
}

function adaptDesc(f) {
  let d = f.description.replace(/[“”]/g, '「').replace(/[‘’]/g, '「');
  d = d.replace(/\s+/g, ' ').trim();
  if (f.origin && !d.includes(f.origin.slice(0, 6))) {
    const head = f.origin.length > 48 ? f.origin.slice(0, 46) + '…' : f.origin;
    d = head + '。' + d;
  }
  // 保留源站原文，仅做轻量截断避免单条过大
  if (d.length > 280) {
    const cut = d.slice(0, 278);
    const i = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('，'), cut.lastIndexOf('；'));
    d = i > 80 ? cut.slice(0, i + 1) : cut + '…';
  }
  return d;
}

function pickTop(list, n) {
  const seen = new Set();
  const ranked = [...list].sort((a, b) => score(b) - score(a));
  const out = [];
  for (const f of ranked) {
    const key = f.name.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length >= n) break;
  }
  return out;
}

function loadAllFoods() {
  const files = fs.readdirSync(SRC)
    .filter((f) => f.startsWith('foods') && f.endsWith('.ts') && f !== 'foods.ts')
    .map((f) => path.join(SRC, f));
  const all = [];
  const idSeen = new Set();
  for (const file of files) {
    for (const f of extractFoods(fs.readFileSync(file, 'utf8'))) {
      if (idSeen.has(f.id)) continue;
      idSeen.add(f.id);
      all.push(f);
    }
  }
  return all;
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function jitter(id, lat, lng) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const u = ((h >>> 0) % 1000) / 1000;
  const v = (((h >>> 10) >>> 0) % 1000) / 1000;
  // 同城多菜错开约 ±0.18°，放大后能分开，远看仍成簇
  return [lat + (u - 0.5) * 0.36, lng + (v - 0.5) * 0.36];
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('找不到数据目录:', SRC);
    process.exit(1);
  }
  const foods = loadAllFoods();
  console.log('抽取条目:', foods.length);

  // 一菜一点（与 china-food-map 一致），同城坐标微抖动避免完全重叠
  const places = [];
  const nameSeen = new Map();
  for (const f of foods) {
    if (!SEC[f.province]) continue;
    let city = (f.city || '').trim();
    if (!city || city === '未知') city = f.province;
    if (['北京', '天津', '上海', '重庆', '香港', '澳门'].includes(f.province)) city = f.province;
    const title = f.name;
    if (nameSeen.has(title)) nameSeen.set(title, nameSeen.get(title) + 1);
    else nameSeen.set(title, 1);
    const [lat, lon] = jitter(f.id, f.lat, f.lng);
    places.push({
      sec: SEC[f.province],
      prov: f.province,
      n: title,
      city,
      lat,
      lon,
      foods: [{ n: f.name, d: adaptDesc(f) }],
      _score: score(f),
    });
  }

  const secOrder = ['华北', '东北', '华东', '华中', '华南', '西南', '西北', '港澳台'];
  const provOrder = Object.keys(SEC);
  places.sort((a, b) => {
    const da = secOrder.indexOf(a.sec) - secOrder.indexOf(b.sec);
    if (da !== 0) return da;
    const dp = provOrder.indexOf(a.prov) - provOrder.indexOf(b.prov);
    if (dp !== 0) return dp;
    if (a.city !== b.city) return a.city.localeCompare(b.city, 'zh');
    return (b._score || 0) - (a._score || 0) || a.n.localeCompare(b.n, 'zh');
  });
  places.forEach((p) => { delete p._score; });

  const foodCount = places.reduce((s, p) => s + p.foods.length, 0);

  const header = `/* 寻味 · 数据层 v7
 * 地点 { sec, prov, n, lat, lon, city?, foods:[{n,d}] }
 * 一菜一点，数据源自 https://againster1992-debug.github.io/china-food-map/
 */
window.DATA = [
`;
  function fmtPlace(p) {
    const city = p.city ? `, city: '${esc(p.city)}'` : '';
    const prov = p.prov ? `, prov: '${esc(p.prov)}'` : '';
    const foods = p.foods
      .map((f) => `    { n: '${esc(f.n)}', d: '${esc(f.d)}' }`)
      .join(',\n');
    return `  { sec: '${esc(p.sec)}', n: '${esc(p.n)}'${prov}${city}, lat: ${Number(p.lat.toFixed(3))}, lon: ${Number(p.lon.toFixed(3))}, foods: [\n${foods} ] }`;
  }

  fs.writeFileSync(path.join(ROOT, 'data.js'), header + places.map(fmtPlace).join(',\n') + '\n];\n');
  console.log('写入 data.js: 地点', places.length, '菜品', foodCount);
}

main();
