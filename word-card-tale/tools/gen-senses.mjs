/* 生成 src/senses.js —— 词典式多义项中文释义
   数据来源：有道词典 jsonapi（逐词抓取后离线内嵌，运行时不再联网）
   用法：node tools/gen-senses.mjs [--force]
   缓存：tools/.cache/senses-raw.json（断点续传） */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, 'tools', '.cache');
const cacheFile = path.join(cacheDir, 'senses-raw.json');
const outFile = path.join(root, 'src', 'senses.js');

/* ── 词表 ─────────────────────────────────────── */
function loadWords() {
  const ctx = { window: {} };
  for (const f of ['words.js', 'words-bulk.js']) {
    const code = fs.readFileSync(path.join(root, 'src', f), 'utf8');
    new Function('window', code)(ctx.window);
  }
  return (ctx.window.WORDS || []).map((w) => w.w);
}

/* ── 抓取 ─────────────────────────────────────── */
const POS_RE = /^(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux|vt\.\s*&\s*vi|vi\.\s*&\s*vt)\.\s*/i;

function splitSenses(str) {
  const out = [];
  let buf = '';
  let depth = 0;
  for (const ch of String(str || '')) {
    if (ch === '（' || ch === '(' || ch === '<') depth++;
    else if (ch === '）' || ch === ')' || ch === '>') depth = Math.max(0, depth - 1);
    if ((ch === '；' || ch === ';') && depth === 0) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((s) => s && s !== '...' && !/^\.+$/.test(s));
}

async function youdao(word) {
  const res = await fetch('https://dict.youdao.com/jsonapi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36',
    },
    body: new URLSearchParams({ q: word }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('http ' + res.status);
  const j = await res.json();
  const lines = [];
  const w = j && j.ec && j.ec.word && j.ec.word[0];
  if (w && Array.isArray(w.trs)) {
    for (const t of w.trs) {
      for (const tr of t.tr || []) {
        const i = tr && tr.l && tr.l.i;
        if (Array.isArray(i)) lines.push(...i);
        else if (typeof i === 'string') lines.push(i);
      }
    }
  }
  const senses = [];
  for (const line of lines) senses.push(...splitSenses(line));
  return senses.map((s) => s.trim()).filter(Boolean);
}

async function iciba(word) {
  const res = await fetch(
    'https://dict-mobile.iciba.com/interface/index.php?c=word&m=getsuggest&nums=1&is_need_mean=1&word=' +
      encodeURIComponent(word),
    { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) }
  );
  if (!res.ok) throw new Error('http ' + res.status);
  const j = await res.json();
  const msg = (j && j.message && j.message[0]) || null;
  const senses = [];
  for (const m of (msg && msg.means) || []) {
    for (const x of m.means || []) senses.push((m.part ? m.part : '') + String(x).trim());
  }
  return senses;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOne(word) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const s = await youdao(word);
      if (s.length) return s;
      break;
    } catch (e) {
      await sleep(400 * (attempt + 1));
    }
  }
  try {
    const s = await iciba(word);
    if (s.length) return s;
  } catch (e) {}
  return [];
}

/* ── 主流程 ───────────────────────────────────── */
const force = process.argv.includes('--force');
const words = loadWords();
fs.mkdirSync(cacheDir, { recursive: true });
let cache = {};
if (fs.existsSync(cacheFile) && !force) {
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch (e) {
    cache = {};
  }
}

const todo = words.filter((w) => !cache[w] || !cache[w].length);
console.log(`共 ${words.length} 词，待抓取 ${todo.length} 词`);

let done = 0;
const CONCURRENCY = 4;
let idx = 0;

async function worker() {
  while (idx < todo.length) {
    const word = todo[idx++];
    const senses = await fetchOne(word);
    cache[word] = senses;
    done++;
    if (done % 25 === 0 || done === todo.length) {
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
      console.log(`  ${done}/${todo.length}  ${word}  ${senses.slice(0, 2).join(' / ')}`);
    }
    await sleep(120);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
fs.writeFileSync(cacheFile, JSON.stringify(cache));

/* ── 输出 ─────────────────────────────────────── */
const missing = [];
function cleanSenses(arr) {
  return (arr || [])
    .map((s) => String(s).trim())
    .filter((s) => s && !/^【名】/.test(s) && !/（人名）|姓氏|人名，译名/.test(s));
}
const parts = [];
parts.push('/* 词典式多义项中文释义 · 由 tools/gen-senses.mjs 生成，勿手改 */');
parts.push('/* 每词一个释义数组：可带词性前缀 n./v./adj. 与领域标签 （植物）<美> */');
parts.push('(function () {');
parts.push('  var S = {');
const entries = [];
for (const w of words) {
  const s = cleanSenses(cache[w]);
  if (!s.length) {
    missing.push(w);
    continue;
  }
  const body = s.map((x) => JSON.stringify(x)).join(', ');
  entries.push(`    ${JSON.stringify(w)}: [${body}],`);
}
parts.push(entries.join('\n'));
parts.push('  };');
parts.push('  window.SENSES = S;');
parts.push('})();');
fs.writeFileSync(outFile, parts.join('\n') + '\n');
console.log(`写出 ${outFile}，${entries.length} 词有释义，${missing.length} 词缺失`);
if (missing.length) console.log('缺失：' + missing.slice(0, 60).join(' '));
