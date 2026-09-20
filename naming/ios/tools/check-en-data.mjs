/* 校验（并统计进度）数据英文覆盖表 engine-en.json 与 engine.json 的对应关系。
 *
 * 覆盖表的 key 是短标识：字、姓名、题号、标签……这个脚本保证 key 一定能在
 * engine.json 里找到对应条目（防手滑写错字），并打印每个分类的覆盖率。
 * 缺条目时会回退中文原文，所以中间态是可用的，不必一次做完。
 *
 * 用法：node naming/ios/tools/check-en-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../DeerNames/DeerNames/Resources/Data');

const engine = JSON.parse(fs.readFileSync(path.join(dataDir, 'engine.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(dataDir, 'engine-en.json'), 'utf8'));

/* 每个分类：允许的 key 集合，以及要覆盖的总条目数。 */
const atoms = new Set();
for (const c of engine.celebs) {
  for (const group of (c.era || '').split('·')) {
    for (const piece of group.split('/')) {
      const s = piece.trim();
      if (s) atoms.add(s);
    }
  }
}
const enCelebsNames = new Set();
for (const list of Object.values(engine.enCelebs)) {
  for (const r of list) enCelebsNames.add(r[0]);
}

const sections = {
  quiz: { keys: new Set(engine.questions.map((q) => q.id)), total: engine.questions.length, name: '题库' },
  celebTags: { keys: atoms, total: atoms.size, name: '名人标签' },
  chars: { keys: new Set(engine.chars.map((c) => c.c)), total: new Set(engine.chars.map((c) => c.c)).size, name: '汉字字义' },
  surnames: { keys: new Set(engine.surnames.map((s) => s.c)), total: new Set(engine.surnames.map((s) => s.c)).size, name: '姓氏释义' },
  given: { keys: new Set(engine.given.map((g) => g.n)), total: new Set(engine.given.map((g) => g.n)).size, name: '精选名释义' },
  namesEn: { keys: new Set(engine.namesEn.map((n) => n.n)), total: new Set(engine.namesEn.map((n) => n.n)).size, name: '英文名释义' },
  celebs: { keys: new Set(engine.celebs.map((c) => c.name)), total: new Set(engine.celebs.map((c) => c.name)).size, name: '名人简介' },
  enCelebs: { keys: enCelebsNames, total: enCelebsNames.size, name: '英文名名人' },
};

let bad = 0;
let done = 0;
let all = 0;
for (const [section, meta] of Object.entries(sections)) {
  const table = en[section] || {};
  const keys = Object.keys(table);
  const unknown = keys.filter((k) => !meta.keys.has(k));
  const n = keys.length;
  done += n;
  all += meta.total;
  const pct = ((n / meta.total) * 100).toFixed(1);
  console.log(`${meta.name.padEnd(6, '　')} ${String(n).padStart(5)} / ${String(meta.total).padStart(5)}  ${pct.padStart(5)}%`);
  if (unknown.length) {
    bad += unknown.length;
    console.log(`  ✗ engine.json 里没有这些 key：${unknown.slice(0, 10).join('、')}${unknown.length > 10 ? ' …' : ''}`);
  }
  if (section === 'quiz') {
    for (const q of engine.questions) {
      const item = table[q.id];
      if (!item) continue;
      if (!item.text) { bad++; console.log(`  ✗ ${q.id} 缺 text`); }
      if (!Array.isArray(item.options) || item.options.length !== q.options.length) {
        bad++;
        console.log(`  ✗ ${q.id} 选项数应为 ${q.options.length}`);
      }
    }
  }
}
console.log(`\n合计 ${done} / ${all}（${((done / all) * 100).toFixed(1)}%）`);
if (bad) {
  console.log(`发现 ${bad} 处问题`);
  process.exit(1);
}
