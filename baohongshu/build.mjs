#!/usr/bin/env node
/**
 * 打包爆红书 — 小红书 / 快手（离线 zip）
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
const SLUG = 'baohongshu';
const VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const srcHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const styles = [...srcHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
const scriptMatch = srcHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);
const bodyMatch = srcHtml.match(/<body([^>]*)>([\s\S]*?)<script>/i);
if (!styles.length || !scriptMatch || !bodyMatch) throw new Error('无法从 index.html 拆出 style/body/script');
const style = styles.join('\n');
const app = scriptMatch[1];
const bodyAttrs = bodyMatch[1] || '';
const body = bodyMatch[2];
if (!/\.onboard\b/.test(style)) throw new Error('样式未包含 .onboard，请检查是否漏了第二段 <style>');

function noteCovers() {
  const dir = path.join(__dirname, 'covers');
  return fs.readdirSync(dir).filter(f => /^cover-.*\.webp$/i.test(f));
}

function assertOffline(text) {
  if (/(?:src|href)=["']https?:\/\//i.test(text)) throw new Error('产物含外链资源');
  if (/<iframe/i.test(text)) throw new Error('产物含 iframe');
  if (/cdn\.jsdelivr|unpkg\.com|cdnjs\./i.test(text)) throw new Error('产物含 CDN');
}

function assertXhs(html) {
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('小红书产物含内联 script');
  if (/\son\w+\s*=/i.test(html)) throw new Error('小红书产物含 HTML 内联事件');
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
  fs.mkdirSync(path.join(outDir, 'covers'), { recursive: true });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="${VIEWPORT}">
<meta name="theme-color" content="#fff">
<title>${cfg.title}</title>
<link rel="stylesheet" href="./style.css">
</head>
<body${bodyAttrs}>
${body}
<script src="./app.js"></script>
</body>
</html>
`;

  // 快手：无顶部安全区 + 无容器导航；一级页不展示页内标题，消息/我的另加顶留白
  const platformCss =
    platformId === 'kuaishou'
      ? `
:root{--safe-t:0px!important;--nav-h:0px!important;--xhs-top:0!important;--xhs-nav:0!important}
body.tab-home .top,body.tab-explore .top{display:none!important;height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}
body.tab-home .tabs{top:0!important}
body.tab-messages #page>.inbox-head{display:none!important;height:0!important;min-height:0!important;padding:0!important;margin:0!important;border:0!important;overflow:hidden!important}
body.tab-messages #page{padding-top:15px!important}
body.tab-messages .inbox-cats{padding-top:12px!important}
body.tab-me #page .profile-hero{padding-top:36px!important}
body.tab-me .theme-toggle{top:28px!important}
`
      : '';

  assertOffline(html + style + platformCss + app);
  if (platformId === 'xiaohongshu') assertXhs(html);

  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'style.css'), style + platformCss);
  fs.writeFileSync(path.join(outDir, 'app.js'), app);
  for (const f of noteCovers()) {
    fs.copyFileSync(path.join(__dirname, 'covers', f), path.join(outDir, 'covers', f));
  }

  const zipPath = path.join(__dirname, 'dist', `${platformId}-${SLUG}.zip`);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`zip -q -r "${zipPath}" index.html style.css app.js covers -x '*.DS_Store'`, {
    cwd: outDir,
    stdio: 'pipe'
  });

  const zipBytes = fs.statSync(zipPath).size;
  const fmt = n => `${(n / 1024).toFixed(1)} KB`;
  const ok = zipBytes <= MAX_BYTES;
  console.log(`${ok ? '✓' : '✗'} ${cfg.title} (${platformId}) zip ${fmt(zipBytes)} → dist/${platformId}-${SLUG}.zip`);
  if (!ok) throw new Error('超过 8MB 限制');
}

for (const t of targets) buildOne(t);
console.log('完成');
