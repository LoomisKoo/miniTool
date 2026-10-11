#!/usr/bin/env node
/**
 * 把《高性价比人生指南》的 Markdown 正文编译成单文件工具。
 *
 * 用法：
 *   node tools/build.mjs                  # 自动找/克隆原文，生成 index.html
 *   node tools/build.mjs --src /path/to/HowToLiveBetter
 *
 * 原文许可 CC BY 4.0，会以署名方式内联进产物。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SCENARIOS, SEC_DEFAULT, LENS } from './scenarios.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO = 'https://github.com/eternity4719/HowToLiveBetter.git';

/* ---------- 1. 找原文 ---------- */
function resolveSrc() {
  const i = process.argv.indexOf('--src');
  if (i > -1 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  const candidates = [
    process.env.HTLB_SRC,
    path.resolve(ROOT, '../.cache/HowToLiveBetter'),
    '/tmp/htlb',
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(path.join(c, 'book'))) return c;
  const dest = path.resolve(ROOT, '../.cache/HowToLiveBetter');
  console.log(`未找到原文，克隆到 ${dest} …`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync('git', ['clone', '--depth', '1', REPO, dest], { stdio: 'inherit' });
  return dest;
}
const SRC = resolveSrc();
console.log('原文目录：' + SRC);

/* ---------- 2. 解析 ---------- */
const COST_W = { money: { '0': 0, '少': 1, '多': 2 }, time: { '少': 0, '中': 1, '多': 2 }, will: { '否': 0, '些': 1, '是': 2 } };

function clean(s) {
  return String(s || '')
    .replace(/<([^>\s]+)>/g, '$1')          // <https://…> -> https://…
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // [文本](链接) -> 文本
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([*_`])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBook(dir) {
  const files = fs.readdirSync(path.join(dir, 'book')).filter(f => f.endsWith('.md')).sort();
  const sections = [];
  let warns = 0, stray = [];

  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir, 'book', f), 'utf8').split(/\r?\n/);
    let sec = null, entry = null;
    const flush = () => { if (entry && sec) sec.entries.push(entry); entry = null; };
    let inIntro = true;

    for (const raw of lines) {
      const line = raw.trimEnd();
      let m;
      if ((m = /^#{1,2} (\d+)\. (.+)$/.exec(line))) {
        flush();
        sec = { n: +m[1], title: clean(m[2]), intro: [], entries: [] };
        sections.push(sec); inIntro = true; continue;
      }
      if (/^#{1,2} /.test(line)) { flush(); sec = null; continue; }
      if (!sec) continue;
      if ((m = /^### (\d+)\. (.+)$/.exec(line))) {
        flush(); inIntro = false;
        entry = { sec: sec.n, n: +m[1], title: clean(m[2]), cost: '', human: '', gain: '', src: '', note: '', grade: '' };
        continue;
      }
      if ((m = /^<!--\s*成本标签:\s*(.*?)\s*-->/.exec(line)) && entry) {
        for (const kv of m[1].split(/\s+/)) {
          const [k, v] = kv.split('=');
          if (k === '钱') entry.money = v;
          if (k === '时间') entry.time = v;
          if (k === '毅力') entry.will = v;
          if (k === '收益') entry.level = v;
          if (k === '口径') entry.lens = v;
        }
        continue;
      }
      if (entry) {
        if ((m = /^- 成本：(.*)$/.exec(line))) entry.cost = cleanupField(m[1]);
        else if ((m = /^- 说人话：(.*)$/.exec(line))) entry.human = cleanupField(m[1]);
        else if ((m = /^- 收益：(.*)$/.exec(line))) entry.gain = cleanupField(m[1]);
        else if ((m = /^- 证据等级：\s*([ABC])/.exec(line))) entry.grade = m[1];
        else if ((m = /^- 来源：(.*)$/.exec(line))) entry.src = cleanupField(m[1]);
        else if ((m = /^- 备注：(.*)$/.exec(line))) entry.note = cleanupField(m[1]);
        else if (line.trim()) stray.push(`${f}:${entry.n}: ${line.slice(0, 60)}`);
        continue;
      }
      if (inIntro && line.trim() && !/^\[.*\]\(.*\)$/.test(line.trim())) sec.intro.push(clean(line));
    }
    flush();
  }
  function cleanupField(s) { return clean(s); }
  return { sections, warns, stray };
}

/* ---------- 3. README：章节简介 + 术语表 ---------- */
function parseReadme(dir) {
  const md = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  const desc = {}, lines = md.split(/\r?\n/);
  for (const line of lines) {
    const m = /^(\d+)\. \[.+?\]\(book\/.+?\)：(.*)$/.exec(line.trim());
    if (m) desc[+m[1]] = clean(m[2]);
  }
  const gloss = [];
  const gm = /^## 读懂数字[^\n]*\n([\s\S]*?)(?=^## )/m.exec(md);
  if (gm) {
    for (const line of gm[1].split(/\r?\n/)) {
      const c = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/.exec(line);
      if (!c || c[1] === '术语' || /^-+$/.test(c[1])) continue;
      for (const t of c[1].split('、')) {
        const term = t.trim();
        if (term) gloss.push({ t: term, m: clean(c[2]) });
      }
    }
  }
  return { desc, gloss };
}

/* ---------- 4. 整理 ---------- */
const { sections, stray } = parseBook(SRC);
const { desc, gloss } = parseReadme(SRC);

const items = [], byId = {};
for (const s of sections) {
  for (const e of s.entries) {
    const cs = (COST_W.money[e.money] ?? 0) + (COST_W.time[e.time] ?? 0) + (COST_W.will[e.will] ?? 0);
    const ratio = e.level === '大' ? (cs === 0 ? '极高' : (cs <= 2 ? '高' : '一般'))
      : e.level === '中' ? (cs === 0 ? '高' : '一般') : '一般';
    const it = {
      id: `s${e.sec}-${e.n}`,
      sec: e.sec, n: e.n, title: e.title,
      cost: e.cost, human: e.human, gain: e.gain, src: e.src, note: e.note,
      grade: e.grade, money: e.money, time: e.time, will: e.will,
      level: e.level, lens: LENS[e.lens] || e.lens, cs, ratio,
      dispute: /^争议/.test(e.note), todo: /待核实|TODO/.test(e.src + e.gain + e.note + e.cost),
      sc: []
    };
    // 交叉引用：见第 X 节第 Y 条 / 见本节第 Y 条
    const refs = [];
    const texts = [it.human, it.note, it.gain, it.cost].join('\n');
    for (const m of texts.matchAll(/见第\s*(\d+)\s*节第\s*(\d+)\s*条/g)) refs.push({ sec: +m[1], n: +m[2] });
    for (const m of texts.matchAll(/见本节第\s*(\d+)\s*条/g)) refs.push({ sec: it.sec, n: +m[1] });
    it.refs = [...new Map(refs.map(r => [r.sec + '-' + r.n, r])).values()].slice(0, 6);
    items.push(it); byId[it.id] = it;
  }
}

// 场景归类
for (const sc of SCENARIOS) {
  sc.raw = sc.keys.map(k => new RegExp(k));
  sc.res = sc.raw;
  sc.items = [];
}
for (const it of items) {
  const hay = it.title;
  const set = new Set();
  const def = SEC_DEFAULT[it.sec];
  if (def) set.add(def);
  it.why = {};
  for (const sc of SCENARIOS) {
    const hits = sc.raw.filter(r => r.test(hay)).map(r => String(r).replace(/^\^|\$$/g, ''));
    if (hits.length) { set.add(sc.id); it.why[sc.id] = hits; }
  }
  it.sc = [...set];
}
for (const sc of SCENARIOS) {
  sc.items = items.filter(i => i.sc.includes(sc.id)).map(i => i.id);
  delete sc.keys; delete sc.res; delete sc.raw;
}

// 补交叉引用标题
for (const it of items) {
  it.refs = it.refs.map(r => ({ ...r, title: byId[`s${r.sec}-${r.n}`]?.title || null })).filter(r => r.title);
}

const secs = sections.map(s => ({
  n: s.n, title: s.title, desc: desc[s.n] || '', count: s.entries.length,
  intro: (s.intro || []).filter(t => t.length > 12).slice(0, 3)
}));

/* ---------- 5. 报告 ---------- */
console.log(`\n解析完成：${secs.length} 节 / ${items.length} 条`);
if (stray.length) {
  console.log(`⚠ 有 ${stray.length} 行未能归入字段（前 5 行）：`);
  stray.slice(0, 5).forEach(s => console.log('   ' + s));
}
const bad = items.filter(i => !i.grade || !i.human || !i.gain);
if (bad.length) console.log(`⚠ ${bad.length} 条缺字段：` + bad.slice(0, 5).map(i => i.id).join(', '));
const ratioCount = {};
items.forEach(i => ratioCount[i.ratio] = (ratioCount[i.ratio] || 0) + 1);
const gradeCount = {};
items.forEach(i => gradeCount[i.grade] = (gradeCount[i.grade] || 0) + 1);
console.log('证据等级：' + JSON.stringify(gradeCount));
console.log('性价比：' + JSON.stringify(ratioCount));
console.log('\n场景覆盖：');
for (const sc of [...SCENARIOS].sort((a, b) => b.items.length - a.items.length))
  console.log(`  ${sc.ico} ${sc.nm.padEnd(10, '　')} ${String(sc.items.length).padStart(4)} 条`);
const orphans = items.filter(i => i.sc.length === 0);
console.log(orphans.length ? `⚠ 无场景条目 ${orphans.length} 条` : '✓ 每条都落进了至少一个场景');

/* ---------- 6. 生成 ---------- */
const payload = { secs, items, gloss, scn: SCENARIOS, meta: { version: '2026-09', generated: new Date().toISOString().slice(0, 10) } };
const dataJs = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

fs.mkdirSync(path.join(ROOT, 'tools'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/data.json'), JSON.stringify(payload, null, 1));

const tpl = fs.readFileSync(path.join(ROOT, 'tools/template.html'), 'utf8');
const out = tpl.replace('/*__DATA__*/null', dataJs);
fs.writeFileSync(path.join(ROOT, 'index.html'), out);
console.log(`\n✓ 生成 index.html（${(out.length / 1024).toFixed(0)} KB，单文件、可离线打开）`);
