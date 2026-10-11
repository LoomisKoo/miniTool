#!/usr/bin/env node
/**
 * 下载并固化第三方依赖到 vendor/（离线包不允许任何外链）
 *
 *   node scripts/vendor-assets.mjs
 *
 * 产物：
 *   vendor/lucide.min.js        lucide 图标（UMD，挂 window.lucide）
 *   vendor/html-to-image.js     html-to-image（UMD，挂 window.htmlToImage）
 *   vendor/fonts.css            仅 latin 子集的 @font-face，src 指向 ./fonts/*.woff2
 *   vendor/fonts/*.woff2        字体文件（包内文件，供页面渲染）
 *   vendor/fonts-embed.js       同一批字体的 data: 版本（导出光栅化时内联，避免运行时取字体）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = path.join(root, 'vendor');
const fontDir = path.join(vendorDir, 'fonts');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// 与 index.html 里原来那条 Google Fonts 链接一致
const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?' +
  'family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400' +
  '&family=Instrument+Serif:ital@0;1' +
  '&family=JetBrains+Mono:wght@400;500' +
  '&family=Lora:wght@600;700' +
  '&family=Pinyon+Script' +
  '&display=swap';

const LIBS = [
  ['https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js', 'lucide.min.js'],
  ['https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js', 'html-to-image.js'],
];

const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === 'buffer' ? Buffer.from(await res.arrayBuffer()) : res.text();
}

fs.rmSync(fontDir, { recursive: true, force: true });
fs.mkdirSync(fontDir, { recursive: true });

/* ---------- JS 库 ---------- */
for (const [url, name] of LIBS) {
  const buf = await get(url, 'buffer');
  fs.writeFileSync(path.join(vendorDir, name), buf);
  console.log(`✓ vendor/${name}  ${fmt(buf.length)}`);
}

/* ---------- 字体：只取 latin 子集 ---------- */
const css = await get(FONT_CSS_URL);
const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)].map((m) => ({
  subset: m[1],
  body: m[2],
}));
const latin = blocks.filter((b) => b.subset === 'latin');
if (!latin.length) throw new Error('没有解析到 latin 子集，Google Fonts 结构可能变了');

const seen = new Map();
const out = [];
/** 同一份可变字体文件被多个 weight 引用：导出用的内联 CSS 按文件合并，避免重复 base64 */
const groups = new Map();

for (const { body } of latin) {
  const url = (body.match(/url\((https:[^)]+)\)/) || [])[1];
  if (!url) continue;
  const file = path.basename(new URL(url).pathname);
  if (!seen.has(url)) {
    const buf = await get(url, 'buffer');
    fs.writeFileSync(path.join(fontDir, file), buf);
    seen.set(url, file);
    console.log(`✓ vendor/fonts/${file}  ${fmt(buf.length)}`);
  }
  out.push(body.replace(url, `./fonts/${file}`));

  const family = (body.match(/font-family:\s*'([^']+)'/) || [])[1];
  const style = (body.match(/font-style:\s*([\w]+)/) || [])[1] || 'normal';
  const weight = Number((body.match(/font-weight:\s*(\d+)/) || [])[1] || 400);
  const range = (body.match(/unicode-range:\s*([^;]+);/) || [])[1];
  const key = `${family}|${style}|${file}`;
  const g = groups.get(key) || { family, style, file, weights: [], range, url: `./fonts/${file}` };
  g.weights.push(weight);
  groups.set(key, g);
}

const embed = [...groups.values()].map((g) => {
  const lo = Math.min(...g.weights);
  const hi = Math.max(...g.weights);
  const b64 = fs.readFileSync(path.join(fontDir, g.file)).toString('base64');
  return [
    '@font-face {',
    `  font-family: '${g.family}';`,
    `  font-style: ${g.style};`,
    `  font-weight: ${lo === hi ? lo : `${lo} ${hi}`};`,
    '  font-display: swap;',
    `  src: url(data:font/woff2;base64,${b64}) format('woff2');`,
    `  unicode-range: ${g.range};`,
    '}',
  ].join('\n');
});

const header = '/* 自动生成，勿手改 —— node scripts/vendor-assets.mjs */\n';
fs.writeFileSync(path.join(vendorDir, 'fonts.css'), header + out.join('\n') + '\n');
console.log(`✓ vendor/fonts.css  ${fmt(Buffer.byteLength(header + out.join('\n')))}`);

const embedJs =
  '/* 自动生成，勿手改 —— 导出光栅化时内联字体，避免运行时取字体文件 */\n' +
  `window.__FONT_EMBED_CSS = ${JSON.stringify(embed.join('\n'))};\n`;
fs.writeFileSync(path.join(vendorDir, 'fonts-embed.js'), embedJs);
console.log(`✓ vendor/fonts-embed.js  ${fmt(Buffer.byteLength(embedJs))}`);
console.log('完成');
