#!/usr/bin/env node
/**
 * 打包「卡造」— 小红书小工具（离线 zip）
 *
 *   node build.mjs [xiaohongshu]
 *
 * 与同仓库 ticket-stub 同一套产物形态：
 *   1. 抽 index.html 的 <body>
 *   2. src/templates.js + src/app.js 合成单个经典脚本
 *   3. src/style.css + platforms/<平台>/extra.css
 *   4. vendor 与 assets 内联进包，经小红书审计后压 zip
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const MAX_ZIP = 10 * 1024 * 1024;
const SLUG = 'card-studio';
const VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
const AUDIT = path.join(root, '../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs');
const JS_PARTS = ['src/templates.js', 'src/app.js'];
const VENDOR_FILES = ['lucide.min.js', 'qrcode.js', 'html-to-image.js', 'fonts.css', 'fonts-embed.js'];

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;

function extractBody() {
  const m = read('index.html').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!m) throw new Error('index.html 缺少 <body>');
  return m[1].replace(/<script[\s\S]*?<\/script>\s*/gi, '').trim();
}

function assertArtifact(html, css, js) {
  const all = html + css + js;
  if (/(?:src|href)=["']https?:\/\//i.test(all)) throw new Error('产物含外链资源');
  if (/url\(\s*["']?https?:/i.test(css)) throw new Error('CSS 含外链资源');
  if (/cdn\.jsdelivr|unpkg\.com|cdnjs\.|fonts\.googleapis|fonts\.gstatic/i.test(all)) {
    throw new Error('产物含 CDN 域名');
  }
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('含内联 script');
  if (/type=["']module["']/i.test(html)) throw new Error('含 module 脚本');
  if (/\son\w+\s*=/i.test(html)) throw new Error('含 HTML 内联事件');
  if (/<iframe|<object|<base\s|<meta[^>]+http-equiv=["']?Content-Security/i.test(html)) {
    throw new Error('含 iframe / object / base / 自建 CSP');
  }
  if (/\beval\(|new Function\(|window\.open\(|navigator\.clipboard/.test(js)) {
    throw new Error('业务 JS 含被禁能力');
  }
  if (/\?\.(?!\d)|\?\?|\|\|=|&&=/.test(js)) {
    throw new Error('业务 JS 残留 ES2020 语法（?. / ?? / ||= / &&=）');
  }
}

function buildOne(platformId) {
  const cfgPath = path.join(root, 'platforms', platformId, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error(`跳过未知平台: ${platformId}`);
    return;
  }
  const cfg = JSON.parse(read(`platforms/${platformId}/config.json`));
  const outDir = path.join(root, 'dist', platformId);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'vendor', 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });

  const js = JS_PARTS.map((f) => read(f).trim()).join('\n\n');
  let css = read('src/style.css') + '\n\n' + read('src/cards.css');
  const extra = path.join(root, 'platforms', platformId, 'extra.css');
  if (fs.existsSync(extra)) css += `\n\n/* platform:${platformId} */\n${fs.readFileSync(extra, 'utf8')}`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${VIEWPORT}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#f7f0dd">
<title>${cfg.title}</title>
<!-- platform:${cfg.id} desc:${cfg.desc || ''} -->
<link rel="icon" href="./assets/icon.svg">
<link rel="stylesheet" href="./vendor/fonts.css">
<link rel="stylesheet" href="./style.css">
</head>
<body>
${extractBody()}
<script src="./vendor/lucide.min.js"></script>
<script src="./vendor/qrcode.js"></script>
<script src="./vendor/html-to-image.js"></script>
<script src="./vendor/fonts-embed.js"></script>
<script src="./app.js"></script>
</body>
</html>
`;
  assertArtifact(html, css, js);

  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'style.css'), css);
  fs.writeFileSync(path.join(outDir, 'app.js'), js);

  for (const f of VENDOR_FILES) {
    fs.copyFileSync(path.join(root, 'vendor', f), path.join(outDir, 'vendor', f));
  }
  for (const f of fs.readdirSync(path.join(root, 'vendor', 'fonts'))) {
    fs.copyFileSync(
      path.join(root, 'vendor', 'fonts', f),
      path.join(outDir, 'vendor', 'fonts', f)
    );
  }
  fs.copyFileSync(path.join(root, 'assets', 'icon.svg'), path.join(outDir, 'assets', 'icon.svg'));

  if (fs.existsSync(AUDIT)) execSync(`node "${AUDIT}" "${outDir}"`, { stdio: 'inherit' });

  const zipPath = path.join(root, 'dist', `${platformId}-${SLUG}.zip`);
  fs.rmSync(zipPath, { force: true });
  execSync(`zip -q -r "${zipPath}" . -x '*.DS_Store'`, { cwd: outDir, stdio: 'pipe' });
  const zipBytes = fs.statSync(zipPath).size;
  if (zipBytes > MAX_ZIP) throw new Error(`zip 超过 10MB 上限（${fmt(zipBytes)}）`);

  const major = ['index.html', 'style.css', 'app.js'].map(
    (f) => `${f} ${fmt(fs.statSync(path.join(outDir, f)).size)}`
  );
  console.log(`✓ ${cfg.title} (${platformId}): ${major.join(', ')}`);
  console.log(`  zip ${fmt(zipBytes)} → ${path.relative(root, zipPath)}`);
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['xiaohongshu'];
for (const t of targets) buildOne(t);
console.log('完成');
