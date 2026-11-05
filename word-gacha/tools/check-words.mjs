#!/usr/bin/env node
/**
 * 词库校验：node tools/check-words.mjs
 * 检查重复、字段完整性、字母长度、分类是否已注册、武器分布与元音比例。
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ['words.js', 'words-bulk.js']) {
  const p = path.join(root, 'src', f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
}

const W = sandbox.window.WORDS;
const TAGS = sandbox.window.TAGS;
const MAX_LEN = 10;

let bad = 0;
const fail = (msg) => { bad++; console.log('✗ ' + msg); };
let warn = 0;
const seen = new Map();

for (const w of W) {
  if (seen.has(w.w)) fail(`重复单词 ${w.w}（${seen.get(w.w)} 与当前条目）`);
  seen.set(w.w, w.tag);
  for (const k of ['w', 'ph', 'pos', 'cn', 'tier', 'tag', 'ex', 'exCn']) {
    if (w[k] == null || w[k] === '') fail(`${w.w} 缺字段 ${k}`);
  }
  if (!TAGS[w.tag]) fail(`${w.w} 的分类 ${w.tag} 没有在 window.TAGS 注册`);
  if (!/^\//.test(w.ph)) fail(`${w.w} 音标格式不对: ${w.ph}`);
  if (!/^[a-z]+$/.test(w.w)) fail(`${w.w} 含非小写字母`);
  if (w.w.length < 3) fail(`${w.w} 字母数 ${w.w.length} 太短`);
  if (w.w.length > MAX_LEN) warn++;
  if (w.tier < 1 || w.tier > 5) fail(`${w.w} 稀有度 ${w.tier} 不合法`);
}

const letterKind = (ch) => {
  const c = ch.toUpperCase();
  if ('AEIOU'.includes(c)) return 'shield';
  if ('RPGB'.includes(c)) return 'blast';
  if ('SCF'.includes(c)) return 'frost';
  if ('TD'.includes(c)) return 'pierce';
  if ('LMZQ'.includes(c)) return 'thunder';
  if ('JYV'.includes(c)) return 'tide';
  if ('KXW'.includes(c)) return 'blade';
  return 'swift';
};
const dom = (w) => {
  const cnt = {}; let max = 0;
  for (const ch of w) {
    const k = letterKind(ch);
    cnt[k] = (cnt[k] || 0) + (k === 'shield' ? 0.5 : 1);
    if (cnt[k] > max) max = cnt[k];
  }
  for (const ch of w) if (cnt[letterKind(ch)] === max) return letterKind(ch);
  return 'blast';
};

const pool = W.filter((w) => w.w.length <= MAX_LEN);
const weapon = {}, tags = {}, tiers = {}, lens = {};
let vowelHeavy = 0;
for (const w of pool) {
  weapon[dom(w.w)] = (weapon[dom(w.w)] || 0) + 1;
  tags[w.tag] = (tags[w.tag] || 0) + 1;
  tiers[w.tier] = (tiers[w.tier] || 0) + 1;
  lens[w.w.length] = (lens[w.w.length] || 0) + 1;
  if ((w.w.toUpperCase().match(/[AEIOU]/g) || []).length / w.w.length > 0.55) vowelHeavy++;
}

const bytes = Buffer.byteLength(JSON.stringify(W));
console.log(`总词 ${W.length} · 可抽 ${pool.length} · 数据 ${(bytes / 1024).toFixed(0)}KB · 平均 ${(bytes / W.length).toFixed(0)}B/词`);
console.log('分类', tags);
console.log('稀有度', tiers);
console.log('长度', lens);
console.log('主武器', weapon);
console.log(`元音占比 >55%: ${vowelHeavy} 词（${(vowelHeavy / pool.length * 100).toFixed(1)}%）`);
if (warn) console.log(`⚠ 超过 ${MAX_LEN} 字母、不会进卡池: ${warn} 词（历史遗留，待清理）`);
console.log(bad ? `\n共 ${bad} 处问题` : '\n✓ 全部通过');
process.exit(bad ? 1 : 0);
