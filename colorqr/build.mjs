#!/usr/bin/env node
/**
 * 打包彩码 — 各平台产物 + zip
 * 用法:
 *   node build.mjs              # 打包全部平台
 *   node build.mjs douyin       # 仅抖音
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['douyin', 'kuaishou', 'xiaohongshu'];
const MAX_BYTES = 8 * 1024 * 1024;
const VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const baseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/config.base.json'), 'utf8'));
const style = fs.readFileSync(path.join(__dirname, 'src/style.css'), 'utf8');
const body = fs.readFileSync(path.join(__dirname, 'src/body.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8');
const vendor = fs.readFileSync(path.join(__dirname, 'src/vendor/qrcode.js'), 'utf8');
const three = fs.readFileSync(path.join(__dirname, 'src/vendor/three.min.js'), 'utf8');
const bloom = fs.readFileSync(path.join(__dirname, 'src/bloom.js'), 'utf8');

function readExtraCss(platformId) {
  const p = path.join(__dirname, 'platforms', platformId, 'extra.css');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function assertOffline(text) {
  if (/(?:src|href)=["']https?:\/\//i.test(text)) throw new Error('产物含外链资源');
  if (/<iframe/i.test(text)) throw new Error('产物含 iframe');
  if (/fetch\s*\(|XMLHttpRequest|axios|WebSocket/i.test(text)) {
    console.warn('  ⚠ 检测到网络 API 关键字，请确认未实际发起请求');
  }
}

function assertXhs(html) {
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('小红书产物含内联 script');
  if (/\son\w+\s*=/i.test(html)) throw new Error('小红书产物含 HTML 内联事件');
}

function zipOutDir(zipPath, outDir) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`zip -q -r "${zipPath}" . -x '*.DS_Store'`, { cwd: outDir, stdio: 'pipe' });
}

function reportBuild(cfg, platformId, sizes, zipBytes) {
  const fmt = n => `${(n / 1024).toFixed(1)} KB`;
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const ok = total <= MAX_BYTES && zipBytes <= MAX_BYTES;
  const detail = Object.entries(sizes).map(([k, v]) => `${k} ${fmt(v)}`).join(', ');
  console.log(`${ok ? '✓' : '✗'} ${cfg.name || platformId}: ${detail}, zip ${fmt(zipBytes)} → dist/${platformId}/`);
  if (!ok) console.error(`  超过 8MB 限制，请精简资源`);
}

/** 小红书：多文件 */
function buildOneXhs(cfg, extraCss, platformId) {
  const platformJson = JSON.stringify(cfg, null, 0);
  const html = `<!DOCTYPE html>
<html lang="zh-CN" class="portrait-only">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${VIEWPORT}">
<title>${cfg.title}</title>
<!-- platform:${cfg.id} -->
<link rel="stylesheet" href="style.css">
</head>
<body>
${body}
<script src="three.min.js"></script>
<script src="bloom.js"></script>
<script src="qrcode.js"></script>
<script src="app.js"></script>
</body>
</html>`;
  const css = `${style}\n${extraCss}`;
  const js = `'use strict';
window.PLATFORM=${platformJson};
(function(){
${app}
})();`;

  assertOffline(html + css + js);
  assertXhs(html);

  const outDir = path.join(__dirname, 'dist', platformId);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'style.css'), css);
  fs.writeFileSync(path.join(outDir, 'app.js'), js);
  fs.writeFileSync(path.join(outDir, 'qrcode.js'), vendor);
  fs.writeFileSync(path.join(outDir, 'three.min.js'), three);
  fs.writeFileSync(path.join(outDir, 'bloom.js'), bloom);

  const sizes = {
    'index.html': fs.statSync(path.join(outDir, 'index.html')).size,
    'style.css': fs.statSync(path.join(outDir, 'style.css')).size,
    'app.js': fs.statSync(path.join(outDir, 'app.js')).size,
    'qrcode.js': fs.statSync(path.join(outDir, 'qrcode.js')).size,
    'three.min.js': fs.statSync(path.join(outDir, 'three.min.js')).size,
    'bloom.js': fs.statSync(path.join(outDir, 'bloom.js')).size,
  };
  const zipPath = path.join(__dirname, 'dist', `${platformId}-colorqr.zip`);
  zipOutDir(zipPath, outDir);
  reportBuild(cfg, platformId, sizes, fs.statSync(zipPath).size);
}

/** 抖音 / 快手：单 html */
function buildOne(platformId) {
  const cfgPath = path.join(__dirname, 'platforms', platformId, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error(`跳过未知平台: ${platformId}`);
    return;
  }
  const cfg = { ...baseConfig, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) };
  const extraCss = readExtraCss(platformId);
  if (platformId === 'xiaohongshu') return buildOneXhs(cfg, extraCss, platformId);
  const platformJson = JSON.stringify(cfg, null, 0);
  const htmlClass = cfg.portraitOnly ? ' class="portrait-only"' : '';
  const html = `<!DOCTYPE html>
<html lang="zh-CN"${htmlClass}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${VIEWPORT}">
<title>${cfg.title}</title>
<!-- platform:${cfg.id} -->
<style>
${style}
${extraCss}
</style>
</head>
<body>
${body}
<script>
window.PLATFORM=${platformJson};
</script>
<script>
${three}
</script>
<script>
${bloom}
</script>
<script>
${vendor}
</script>
<script>
(function(){
${app}
})();
</script>
</body>
</html>`;
  assertOffline(html);

  const outDir = path.join(__dirname, 'dist', platformId);
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, 'index.html');
  fs.writeFileSync(htmlPath, html);

  const zipPath = path.join(__dirname, 'dist', `${platformId}-colorqr.zip`);
  zipOutDir(zipPath, outDir);
  reportBuild(cfg, platformId, {
    'index.html': fs.statSync(htmlPath).size,
  }, fs.statSync(zipPath).size);
}

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
for (const id of targets) buildOne(id);
