#!/usr/bin/env node
/**
 * 打包「词卡物语」— 小红书 / 抖音 / 快手（离线 zip，禁 CDN / 禁内联 script）
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
const TOOL = 'word-card-tale';
const MAX_BYTES = 10 * 1024 * 1024; // 小红书上限
const VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const style = fs.readFileSync(path.join(__dirname, 'src/style.css'), 'utf8');
const body = fs.readFileSync(path.join(__dirname, 'src/body.html'), 'utf8');
const glyphs = fs.readFileSync(path.join(__dirname, 'src/glyphs.js'), 'utf8');
const words = fs.readFileSync(path.join(__dirname, 'src/words.js'), 'utf8');
const wordsBulk = fs.readFileSync(path.join(__dirname, 'src/words-bulk.js'), 'utf8');
const gloss = fs.readFileSync(path.join(__dirname, 'src/gloss.js'), 'utf8');
const glossBulk = fs.readFileSync(path.join(__dirname, 'src/gloss-bulk.js'), 'utf8');
const senses = fs.readFileSync(path.join(__dirname, 'src/senses.js'), 'utf8');
const frames = fs.readFileSync(path.join(__dirname, 'src/frames.js'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, 'src/card.js'), 'utf8');
const fx = fs.readFileSync(path.join(__dirname, 'src/fx.js'), 'utf8');
const tts = fs.readFileSync(path.join(__dirname, 'src/tts.js'), 'utf8');
const sfx = fs.readFileSync(path.join(__dirname, 'src/sfx.js'), 'utf8');
const stages = fs.readFileSync(path.join(__dirname, 'src/stages.js'), 'utf8');
const battle = fs.readFileSync(path.join(__dirname, 'src/battle.js'), 'utf8');
const capture = fs.readFileSync(path.join(__dirname, 'src/capture.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8');

// 所有 JS 合并成单文件 app.js
const bundle = [glyphs, words, wordsBulk, gloss, glossBulk, senses, frames, card, fx, tts, sfx, stages, battle, capture, app].join('\n\n');

// 小红书容器顶部自带约 44px 导航栏，且会覆盖页面顶部的交互区域。
// 其他平台保持原来的布局；小红书产物在这里追加平台专属适配，避免污染通用源码预览。
const XHS_CHROME_CSS = `
/* ── 小红书容器顶部导航栏适配 ── */
:root {
  --safe-t: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  --safe-b: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
  --nav-h: 44px;
  --xhs-nav: calc(var(--safe-t) + var(--nav-h));
  --xhs-content-top: calc(8px + var(--xhs-nav));
}
/* 页面根背景继续铺到小红书导航栏下方；只给页面内容预留顶部操作空间。 */
html,
body,
#app {
  min-height: 100%;
}
.screen {
  padding-top: var(--xhs-content-top);
}
.sheet:not(#mineSheet) .sheet-head,
#mineSheet.achievement-page .sheet-head {
  padding-top: var(--xhs-content-top);
}
.quiz {
  padding-top: 0;
}
.quiz-top.sheet-head {
  padding-top: var(--xhs-content-top);
}
/* 收服/默写是独立的全屏页面，背景铺满顶部，HUD 和退出按钮避开导航栏。 */
.capw {
  padding-top: var(--xhs-content-top);
}
.cap-quit {
  top: var(--xhs-content-top);
}
/* 地图容器有 10px 顶部内边距给地区卡发光留位，扣掉后首行与其他页面对齐 */
#screenExpedition {
  padding-top: calc(var(--xhs-content-top) - 10px);
}
/* 战斗页的画布背景保持全屏，只把返回、暂停等操作按钮下移。 */
.sx-top {
  padding-top: var(--xhs-content-top);
}
`;

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

  const outputStyle = platformId === 'xiaohongshu' ? style + XHS_CHROME_CSS : style;
  const ver = crypto.createHash('md5').update(outputStyle + bundle).digest('hex').slice(0, 8);
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

  assertOffline(html + outputStyle + bundle);
  if (platformId === 'xiaohongshu') assertXhs(html, bundle);

  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'style.css'), outputStyle);
  fs.writeFileSync(path.join(outDir, 'app.js'), bundle);

  const assetsDir = path.join(__dirname, 'assets');
  const outAssets = path.join(outDir, 'assets');
  fs.mkdirSync(outAssets, { recursive: true });
  const iconSrc = path.join(assetsDir, 'icon.jpg');
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(outAssets, 'icon.jpg'));
    // 图标引用需在 html 里声明，这里补一行
    const h2 = fs
      .readFileSync(path.join(outDir, 'index.html'), 'utf8')
      .replace('<link rel="stylesheet"', '<link rel="icon" href="assets/icon.jpg">\n<link rel="stylesheet"');
    fs.writeFileSync(path.join(outDir, 'index.html'), h2);
  }
  for (const name of ['btn-stage-bg.png', 'btn-endless-bg.png']) {
    const from = path.join(assetsDir, name);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(outAssets, name));
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
