#!/usr/bin/env node
/**
 * 打包飞飞鸟 — 小红书 / 快手（离线 zip，禁 CDN）
 * 用法:
 *   node build.mjs
 *   node build.mjs xiaohongshu kuaishou
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['xiaohongshu', 'kuaishou'];
const MAX_BYTES = 8 * 1024 * 1024;
const VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const style = fs.readFileSync(path.join(__dirname, 'src/style.css'), 'utf8');
const body = fs.readFileSync(path.join(__dirname, 'src/body.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8');
const iconSrc = path.join(__dirname, 'assets/icon.jpg');
const birdSrc = path.join(__dirname, 'assets/bird.png');

function assertOffline(text) {
  if (/(?:src|href)=["']https?:\/\//i.test(text)) throw new Error('产物含外链资源');
  if (/<iframe/i.test(text)) throw new Error('产物含 iframe');
  if (/cdn\.jsdelivr|unpkg\.com|cdnjs\./i.test(text)) throw new Error('产物含 CDN');
}

function assertXhs(html) {
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('小红书产物含内联 script');
  if (/\son\w+\s*=/i.test(html)) throw new Error('小红书产物含 HTML 内联事件');
}

function report(cfg, platformId, outDir, zipPath) {
  const fmt = n => `${(n / 1024).toFixed(1)} KB`;
  const files = ['index.html', 'style.css', 'app.js', 'assets/icon.jpg', 'assets/bird.png'];
  const sizes = {};
  let total = 0;
  for (const f of files) {
    const n = fs.statSync(path.join(outDir, f)).size;
    sizes[f] = n;
    total += n;
  }
  const zipBytes = fs.statSync(zipPath).size;
  const ok = total <= MAX_BYTES && zipBytes <= MAX_BYTES;
  const detail = Object.entries(sizes).map(([k, v]) => `${k} ${fmt(v)}`).join(', ');
  console.log(`${ok ? '✓' : '✗'} ${cfg.title} (${platformId}): ${detail}`);
  console.log(`  zip ${fmt(zipBytes)} → ${path.relative(__dirname, zipPath)}`);
  if (!ok) throw new Error('超过 8MB 限制');
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

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${VIEWPORT}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#6bb8de">
<title>${cfg.title}</title>
<!-- platform:${cfg.id} desc:${cfg.desc || ''} -->
<link rel="icon" href="assets/icon.jpg">
<link rel="apple-touch-icon" href="assets/icon.jpg">
<link rel="stylesheet" href="style.css">
</head>
<body>
${body}
<script src="app.js"></script>
</body>
</html>
`;

  assertOffline(html + style + app);
  if (platformId === 'xiaohongshu') assertXhs(html);

  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'style.css'), style);
  fs.writeFileSync(path.join(outDir, 'app.js'), app);
  fs.copyFileSync(iconSrc, path.join(outDir, 'assets/icon.jpg'));
  fs.copyFileSync(birdSrc, path.join(outDir, 'assets/bird.png'));

  const zipPath = path.join(__dirname, 'dist', `${platformId}-flappy-bird.zip`);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`zip -q -r "${zipPath}" index.html style.css app.js assets -x '*.DS_Store'`, {
    cwd: outDir,
    stdio: 'pipe'
  });
  report(cfg, platformId, outDir, zipPath);
}

for (const t of targets) buildOne(t);
console.log('完成');
