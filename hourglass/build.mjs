#!/usr/bin/env node
/**
 * 打包烧香计时 — 各平台独立单文件 html + zip
 * 用法:
 *   node build.mjs              # 打包全部平台
 *   node build.mjs douyin       # 仅抖音
 *   node build.mjs kuaishou xiaohongshu
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

function readExtraCss(platformId) {
  const p = path.join(__dirname, 'platforms', platformId, 'extra.css');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function assertOffline(html) {
  if (/(?:src|href)=["']https?:\/\//i.test(html)) throw new Error('产物含外链资源');
  if (/<iframe/i.test(html)) throw new Error('产物含 iframe');
  if (/fetch\s*\(|XMLHttpRequest|axios|WebSocket/i.test(html)) {
    console.warn('  ⚠ 检测到网络 API 关键字，请确认未实际发起请求');
  }
}

function buildOne(platformId) {
  const cfgPath = path.join(__dirname, 'platforms', platformId, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error(`跳过未知平台: ${platformId}`);
    return;
  }
  const cfg = { ...baseConfig, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) };
  const extraCss = readExtraCss(platformId);
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

  const bytes = fs.statSync(htmlPath).size;
  const zipPath = path.join(__dirname, 'dist', `${platformId}-hourglass.zip`);
  execSync(`zip -q -j "${zipPath}" "${htmlPath}"`, { stdio: 'pipe' });
  const zipBytes = fs.statSync(zipPath).size;

  const fmt = n => `${(n / 1024).toFixed(1)} KB`;
  const ok = bytes <= MAX_BYTES && zipBytes <= MAX_BYTES;
  console.log(
    `${ok ? '✓' : '✗'} ${cfg.name || platformId}: index.html ${fmt(bytes)}, zip ${fmt(zipBytes)} → dist/${platformId}/`
  );
  if (!ok) console.error(`  超过 8MB 限制，请精简资源`);
}

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
for (const id of targets) buildOne(id);
