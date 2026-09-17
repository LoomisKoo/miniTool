#!/usr/bin/env node
/**
 * 打包积木搭建 — 小红书 / 快手（离线 zip，禁 CDN）
 *
 * 用法:
 *   node build.mjs            # 生成 index.html（本地预览用）+ 打包全部平台
 *   node build.mjs dev        # 只生成 index.html
 *   node build.mjs xiaohongshu kuaishou
 *
 * 单一数据源：页面结构只写在 src/body.html，index.html 是生成物，不要手改。
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
const THEME = '#000000';

const argv = process.argv.slice(2);
const devOnly = argv[0] === 'dev';
const targets = argv.length && !devOnly ? argv : ALL;

const body = read('src/body.html');
const style = read('src/style.css');
const app = read('src/app.js');
const title = JSON.parse(read('platforms/xiaohongshu/config.json')).title;

// 图标可选：没有就跳过 favicon，不塞假资源
const iconPath = path.join(__dirname, 'assets/icon.jpg');
const hasIcon = fs.existsSync(iconPath);

// 快手没有小红书式容器顶栏，顶部不留安全区
const PLATFORM_CSS = {
  kuaishou: `
:root{
  --safe-t:0px!important;
}
`
};

function read(p) {
  return fs.readFileSync(path.join(__dirname, p), 'utf8');
}

function assertOffline(text) {
  if (/(?:src|href)=["']https?:\/\//i.test(text)) throw new Error('产物含外链资源');
  if (/<iframe/i.test(text)) throw new Error('产物含 iframe');
  if (/cdn\.jsdelivr|unpkg\.com|cdnjs\./i.test(text)) throw new Error('产物含 CDN');
}

// 小红书产物：禁内联 script、禁 HTML 内联事件
function assertXhs(html) {
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('小红书产物含内联 script');
  if (/\son\w+\s*=/i.test(html)) throw new Error('小红书产物含 HTML 内联事件');
}

function iconLinks() {
  return hasIcon
    ? `<link rel="icon" href="assets/icon.jpg">
<link rel="apple-touch-icon" href="assets/icon.jpg">`
    : '';
}

/** 本地预览页：引用 src/ 原文件，不打包 */
function writeDevHtml() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${VIEWPORT}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="${THEME}">
<title>${title}</title>
${iconLinks()}
<link rel="stylesheet" href="src/style.css">
</head>
<body>
${body}
<script src="vendor/three.min.js"></script>
<script src="src/app.js"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(__dirname, 'index.html'), html);
}

function report(cfg, platformId, outDir, zipPath) {
  const fmt = n => `${(n / 1024).toFixed(1)} KB`;
  const files = ['index.html', 'style.css', 'app.js', 'three.min.js'];
  const sizes = {};
  let total = 0;
  for (const f of files) {
    const n = fs.statSync(path.join(outDir, f)).size;
    sizes[f] = n;
    total += n;
  }
  if (hasIcon) {
    const n = fs.statSync(path.join(outDir, 'assets/icon.jpg')).size;
    sizes['assets/icon.jpg'] = n;
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
  fs.mkdirSync(outDir, { recursive: true });
  if (hasIcon) fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${VIEWPORT}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="${THEME}">
<title>${cfg.title}</title>
<!-- platform:${cfg.id} desc:${cfg.desc || ''} -->
${iconLinks()}
<link rel="stylesheet" href="style.css">
</head>
<body>
${body}
<script src="three.min.js"></script>
<script src="app.js"></script>
</body>
</html>
`;

  const platformCss = PLATFORM_CSS[platformId] || '';
  assertOffline(html + style + app);
  if (platformId === 'xiaohongshu') assertXhs(html);

  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'style.css'), style + platformCss);
  fs.writeFileSync(path.join(outDir, 'app.js'), app);
  fs.copyFileSync(path.join(__dirname, 'vendor/three.min.js'), path.join(outDir, 'three.min.js'));
  if (hasIcon) fs.copyFileSync(iconPath, path.join(outDir, 'assets/icon.jpg'));

  const zipPath = path.join(__dirname, 'dist', `${platformId}-jimu-build.zip`);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const extras = hasIcon ? ' assets' : '';
  execSync(
    `zip -q -r "${zipPath}" index.html style.css app.js three.min.js${extras} -x '*.DS_Store'`,
    { cwd: outDir, stdio: 'pipe' }
  );
  report(cfg, platformId, outDir, zipPath);
}

writeDevHtml();
console.log('✓ index.html 已生成（本地预览：npx serve . 或 python3 -m http.server）');
if (!hasIcon) console.log('· 未发现 assets/icon.jpg，产物不含图标');

if (!devOnly) {
  for (const t of targets) buildOne(t);
  console.log('完成');
}
