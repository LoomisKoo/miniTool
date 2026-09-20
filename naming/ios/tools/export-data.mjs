/* 把 H5 的 engine/data 里的「纯数据」导出成 iOS 用的 JSON。
 *
 * 引擎逻辑由 Swift 重写，但数据（1235 字、姓氏、精选名、英文名、名人、
 * 题目、轴、黑名单……）不手抄，直接在本脚本里按 body.html 的加载顺序跑一遍
 * 原始 JS，再序列化出来，保证与 H5 逐字节一致。
 *
 * 用法：node naming/ios/tools/export-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../../src');
const outDir = path.resolve(here, '../DeerNames/DeerNames/Resources/Data');

/* body.html 里的加载顺序（只取纯数据 + engine 的加载期去重副作用）。 */
const LOAD_ORDER = [
  'data/axes.js',
  'data/domains.js',
  'bazi.js',
  'data/blacklist.js',
  'data/pack.js',
  'data/chars.js',
  'data/chars-extra.js',
  'data/chars-com.js',
  'data/chars-given.js',
  'data/chars-more.js',
  'data/chars-more2.js',
  'data/chars-more3.js',
  'data/chars-given2.js',
  'data/phon-chars.js',
  'data/surnames.js',
  'data/surnames-compound.js',
  'data/surname-traits.js',
  'data/given.js',
  'data/given-more.js',
  'data/names.en.js',
  'data/names-en-extra.js',
  'data/names-en-more.js',
  'data/names-en-more2.js',
  'data/names-en-more3.js',
  'data/names-en-celebs.js',
  'data/names-en-common.js',
  'data/names-en-curated.js',
  'data/names-en-chinese-surnames.js',
  'data/celebrities-en.js',
  'data/celebrities-bilingual.js',
  'data/celebrities-bilingual-more.js',
  'data/celebrities-bilingual-more2.js',
  'data/celebrities.js',
  'data/celebrities-more.js',
  'data/celebrities-more2.js',
  'engine.js',
];

const ctx = vm.createContext({ window: {}, console });
for (const rel of LOAD_ORDER) {
  const code = fs.readFileSync(path.join(srcDir, rel), 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: rel });
  } catch (e) {
    console.error('加载失败', rel, e);
    process.exit(1);
  }
}
const NM = ctx.window.NM;

/* body.html 里的去重（保留首次出现）。 */
NM.NAMES_EN = NM.dedupeNamesEn(NM.NAMES_EN);

/* 统一 schema：可选字段补默认值，避免 JSON 省略键导致 Swift 解码失败。 */
const normChar = (c, phon) => ({
  c: c.c, py: c.py, tone: c.tone, dom: c.dom, m: c.m || '',
  freq: c.freq, g: c.g || 'u', adj: c.adj || null, phon: phon,
});
const normSur = (s) => ({
  c: s.c, py: s.py, tone: s.tone, m: s.m || '', en: s.en || '',
  pop: s.pop == null ? 3 : s.pop,
  pys: s.pys || null, tones: s.tones || null, ro: s.ro || '',
  // 粤语（港式）写法：数据里查得到才有，查不到留空（App 就不显示这一档）
  yue: (NM.SURNAME_YUE || {})[s.c] || '',
});
const normEn = (r) => ({
  n: r.n, zh: r.zh || '', ph: r.ph || '', org: r.org || '', era: r.era || 'mid',
  g: r.g || 'u', snd: r.snd || '', nick: r.nick || [], tr: r.tr, st: r.st, m: r.m || '',
});

const payload = {
  version: 1,
  axes: NM.AXES,
  traitKeys: NM.TRAIT_KEYS,
  styleKeys: NM.STYLE_KEYS,
  questions: NM.QUESTIONS,
  domains: NM.DOMAINS,
  domainKeys: Object.keys(NM.DOMAINS),
  domainCompat: NM.DOMAIN_COMPAT,
  domainWx: NM.DOMAIN_WX,
  baziHours: NM.BAZI_HOURS,
  baziWx: NM.BAZI_WX,
  chars: NM.CHARS.map((c) => normChar(c, false)),
  phonChars: NM.PHON_CHARS.map((c) => normChar(c, true)),
  surnames: [...NM.SURNAMES.map(normSur), ...(NM.COMPOUND_SURNAMES || []).map(normSur)],
  given: NM.GIVEN.map((g) => ({ n: g.n, g: g.g || 'u', tag: g.tag || 'common', m: g.m || '' })),
  namesEn: NM.NAMES_EN.map(normEn),
  celebs: NM.CELEBS,
  initialTrait: NM.INITIAL_TRAIT,
  finalTrait: NM.FINAL_TRAIT,
  toneTrait: NM.TONE_TRAIT,
  surnameOverride: NM.SURNAME_OVERRIDE,
  latinSurnames: NM.LATIN_SURNAMES || {},
  enCelebs: NM.EN_CELEBS || {},
  enCelebSearch: NM.EN_CELEB_SEARCH || {},
  enGivenZh: NM.EN_GIVEN_ZH || {},
  badChars: NM.BAD_CHARS,
  badGiven: NM.BAD_GIVEN,
  badFull: NM.BAD_FULL,
};

fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'engine.json');
fs.writeFileSync(outFile, JSON.stringify(payload));

const size = (o) => Array.isArray(o) ? o.length : Object.keys(o).length;
console.log('已导出', outFile);
console.log('chars', size(payload.chars),
  'phonChars', size(payload.phonChars),
  'surnames', size(payload.surnames),
  'given', size(payload.given),
  'namesEn', size(payload.namesEn),
  'celebs', size(payload.celebs),
  'enCelebs', size(payload.enCelebs),
  'enGivenZh', size(payload.enGivenZh));
