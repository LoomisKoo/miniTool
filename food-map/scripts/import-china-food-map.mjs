#!/usr/bin/env node
/**
 * 美食图鉴：从 againster1992-debug/china-food-map 的 src/data 抽取美食，
 * 一菜一点写入 data.js（仅中国，不含海外纯外国菜；含 foreign/ 下挂中国省的条目）。
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
    const arr = (k) => {
      const mm = block.match(new RegExp(`${k}:\\s*\\[([^\\]]*?)\\]`, 's'));
      if (!mm) return [];
      return [...mm[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
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
    if (!SEC[province]) continue;
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
      taste: str('taste'),
      cuisine: str('cuisine'),
      ingredients: arr('ingredients'),
      cookingMethod: arr('cookingMethod'),
      tags: arr('tags'),
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
  if (d.length > 280) {
    const cut = d.slice(0, 278);
    const i = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('，'), cut.lastIndexOf('；'));
    d = i > 80 ? cut.slice(0, i + 1) : cut + '…';
  }
  return d;
}

function loadAllFoods() {
  const files = fs.readdirSync(SRC)
    .filter((f) => f.startsWith('foods') && f.endsWith('.ts') && f !== 'foods.ts')
    .map((f) => path.join(SRC, f));
  // foreign/ 下挂中国省的条目（如澳门土生葡菜、边境异域菜）
  const foreignDir = path.join(SRC, 'foreign');
  if (fs.existsSync(foreignDir)) {
    for (const f of fs.readdirSync(foreignDir)) {
      if (f.startsWith('foods') && f.endsWith('.ts')) files.push(path.join(foreignDir, f));
    }
  }
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
  return [lat + (u - 0.5) * 0.36, lng + (v - 0.5) * 0.36];
}

function fmtArr(a) {
  return '[' + a.map((x) => `'${esc(x)}'`).join(',') + ']';
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('找不到数据目录:', SRC);
    process.exit(1);
  }
  const foods = loadAllFoods();
  console.log('抽取条目:', foods.length);

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
    const food = { n: f.name, d: adaptDesc(f) };
    if (f.category) food.cat = f.category;
    if (f.taste) food.taste = f.taste;
    if (f.cuisine) food.cui = f.cuisine;
    if (f.ingredients.length) food.ing = f.ingredients;
    if (f.cookingMethod.length) food.cook = f.cookingMethod;
    if (f.tags.length) food.tags = f.tags;
    places.push({
      sec: SEC[f.province],
      prov: f.province,
      n: title,
      city,
      lat,
      lon,
      foods: [food],
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
  const byProv = {};
  places.forEach((p) => { byProv[p.prov] = (byProv[p.prov] || 0) + 1; });
  console.log('澳门', byProv['澳门'], '香港', byProv['香港'], '台湾', byProv['台湾']);

  const header = `/* 美食图鉴 · 数据层 v8
 * 地点 { sec, prov, n, lat, lon, city?, foods:[{n,d,cat?,taste?,cui?,ing?,cook?,tags?}] }
 * 一菜一点，数据源自 https://againster1992-debug.github.io/china-food-map/
 */
window.DATA = [
`;
  function fmtFood(f) {
    let s = `{ n: '${esc(f.n)}', d: '${esc(f.d)}'`;
    if (f.cat) s += `, cat: '${esc(f.cat)}'`;
    if (f.taste) s += `, taste: '${esc(f.taste)}'`;
    if (f.cui) s += `, cui: '${esc(f.cui)}'`;
    if (f.ing && f.ing.length) s += `, ing: ${fmtArr(f.ing)}`;
    if (f.cook && f.cook.length) s += `, cook: ${fmtArr(f.cook)}`;
    if (f.tags && f.tags.length) s += `, tags: ${fmtArr(f.tags)}`;
    return s + ' }';
  }
  function fmtPlace(p) {
    const city = p.city ? `, city: '${esc(p.city)}'` : '';
    const prov = p.prov ? `, prov: '${esc(p.prov)}'` : '';
    const foods = p.foods.map((f) => `    ${fmtFood(f)}`).join(',\n');
    return `  { sec: '${esc(p.sec)}', n: '${esc(p.n)}'${prov}${city}, lat: ${Number(p.lat.toFixed(3))}, lon: ${Number(p.lon.toFixed(3))}, foods: [\n${foods} ] }`;
  }

  fs.writeFileSync(path.join(ROOT, 'data.js'), header + places.map(fmtPlace).join(',\n') + '\n];\n');
  console.log('写入 data.js: 地点', places.length, '菜品', foodCount);
}

main();
