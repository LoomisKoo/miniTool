#!/usr/bin/env node
/**
 * 打包「抽词成册」— 小红书 / 抖音 / 快手（离线 zip，禁 CDN / 禁内联 script）
 * 用法:
 *   node build.mjs                  # 三个平台全打
 *   node build.mjs xiaohongshu      # 只打小红书
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['xiaohongshu', 'douyin', 'kuaishou'];
const TOOL = 'word-gacha';
const MAX_BYTES = 10 * 1024 * 1024; // 小红书上限
const VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const style = fs.readFileSync(path.join(__dirname, 'src/style.css'), 'utf8');
const body = fs.readFileSync(path.join(__dirname, 'src/body.html'), 'utf8');
const glyphs = fs.readFileSync(path.join(__dirname, 'src/glyphs.js'), 'utf8');
const words = fs.readFileSync(path.join(__dirname, 'src/words.js'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, 'src/card.js'), 'utf8');
const fx = fs.readFileSync(path.join(__dirname, 'src/fx.js'), 'utf8');
const battle = fs.readFileSync(path.join(__dirname, 'src/battle.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8');

// 所有 JS 合并成单文件 app.js
const bundle = [glyphs, words, card, fx, battle, app].join('\n\n');

function assertOffline(text) {
  if (/(?:src|href)=["']https?:\/\//i.test(text)) throw new Error('产物含外链资源');
  if (/<iframe/i.test(text)) throw new Error('产物含 iframe');
  if (/cdn\.jsdelivr|unpkg\.com|cdnjs\.|fonts\.googleapis/i.test(text)) throw new Error('产物含 CDN');
  if (/\bimport\s*\(|type=["']module["']/i.test(text)) throw new Error('产物含模块语法');
}

function assertXhs(html, js) {
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('小红书产物含内联 script');
  if (/\son\w+\s*=/i.test(html)) throw new Error('小红书产物含 HTML 内联事件');
  if (/\beval\s*\(/.test(js)) throw new Error('小红书禁用 eval');
  if (/new\s+Worker\s*\(/.test(js)) throw new Error('小红书禁用 Worker');
  if (/WebAssembly/.test(js)) throw new Error('小红书禁用 WASM');
}

function buildOne(platformId) {
  const cfgPath = path.join(__dirname, 'platforms', platformId, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error(`跳过未知平台: ${platformId}`);
    return;
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const outDir = path.join(__dirname, 'dist', platformId);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });

  const ver = crypto.createHash('md5').update(style + bundle).digest('hex').slice(0, 8);
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${VIEWPORT}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#1b1611">
<title>${cfg.title}</title>
<!-- platform:${cfg.id} desc:${cfg.desc || ''} -->
<link rel="stylesheet" href="style.css?v=${ver}">
</head>
<body>
${body}
<script src="app.js?v=${ver}"></script>
</body>
</html>
`;

  assertOffline(html + style + bundle);
  if (platformId === 'xiaohongshu') assertXhs(html, bundle);

  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'style.css'), style);
  fs.writeFileSync(path.join(outDir, 'app.js'), bundle);

  const iconSrc = path.join(__dirname, 'assets/icon.jpg');
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(outDir, 'assets/icon.jpg'));
    // 图标引用需在 html 里声明，这里补一行
    const h2 = fs
      .readFileSync(path.join(outDir, 'index.html'), 'utf8')
      .replace('<link rel="stylesheet"', '<link rel="icon" href="assets/icon.jpg">\n<link rel="stylesheet"');
    fs.writeFileSync(path.join(outDir, 'index.html'), h2);
  }

  const zipPath = path.join(__dirname, 'dist', `${platformId}-${TOOL}.zip`);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`zip -q -r "${zipPath}" index.html style.css app.js assets -x '*.DS_Store'`, {
    cwd: outDir,
    stdio: 'pipe',
  });

  // 体积报告
  const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;
  let total = 0;
  const parts = [];
  for (const f of ['index.html', 'style.css', 'app.js']) {
    const p = path.join(outDir, f);
    if (!fs.existsSync(p)) continue;
    const n = fs.statSync(p).size;
    total += n;
    parts.push(`${f} ${fmt(n)}`);
  }
  const zipBytes = fs.statSync(zipPath).size;
  const ok = total <= MAX_BYTES && zipBytes <= MAX_BYTES;
  console.log(`${ok ? '✓' : '✗'} ${cfg.title} (${platformId}): ${parts.join(', ')}`);
  console.log(`  zip ${fmt(zipBytes)} → ${path.relative(__dirname, zipPath)}`);
  if (!ok) throw new Error('超过 10MB 限制');
}

for (const t of targets) buildOne(t);
console.log('完成');
