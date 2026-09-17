#!/usr/bin/env node
/**
 * 打包 美食图鉴 — 各平台扁平多文件 + zip
 * 用法:
 *   node build.mjs
 *   node build.mjs kuaishou xiaohongshu
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['douyin', 'kuaishou', 'xiaohongshu'];
const MAX_BYTES = 8 * 1024 * 1024;
const SLUG = 'meishitujian';
const FILES = ['index.html', 'style.css', 'app.js', 'data.js', 'land.js', 'prov-land.js'];
const ICON = 'assets/icon.jpg';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

function assertOffline(dir) {
  let text = '';
  for (const f of FILES) {
    if (!/\.(html|js|css)$/i.test(f)) continue;
    text += fs.readFileSync(path.join(dir, f), 'utf8');
  }
  if (/(?:src|href)=["']https?:\/\//i.test(text)) throw new Error('产物含外链资源');
  if (/<iframe/i.test(text)) throw new Error('产物含 iframe');
  if (/cdn\.jsdelivr|unpkg\.com|cdnjs\./i.test(text)) throw new Error('产物含 CDN');
  if (/fetch\s*\(|XMLHttpRequest|axios|WebSocket/i.test(text)) {
    console.warn('  ⚠ 检测到网络 API 关键字，请确认未实际发起请求');
  }
}

// 各平台安全区差异：源码默认按小红书容器
// 小红书：一级页页内标题与容器顶栏文字相同，允许重叠，不再为容器顶栏下移
// 快手：无容器顶栏、无刘海安全区占位，不展示页内「美食图鉴」标题
const PLATFORM_CSS = {
  xiaohongshu: ':root { --nav-h: 0px; }',
  kuaishou: ':root { --safe-t: 0px; --nav-h: 0px; }\n.nav { display: none; }'
};

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
  fs.mkdirSync(outDir, { recursive: true });

  for (const f of FILES) {
    fs.copyFileSync(path.join(__dirname, f), path.join(outDir, f));
  }
  const iconSrc = path.join(__dirname, ICON);
  if (!fs.existsSync(iconSrc)) throw new Error(`缺少 ${ICON}`);
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
  fs.copyFileSync(iconSrc, path.join(outDir, ICON));

  // 按平台覆盖安全区变量
  const extraCss = PLATFORM_CSS[platformId];
  if (extraCss) {
    const stylePath = path.join(outDir, 'style.css');
    fs.writeFileSync(stylePath, fs.readFileSync(stylePath, 'utf8') + `\n\n/* platform:${platformId} */\n${extraCss}\n`);
  }

  assertOffline(outDir);
  if (platformId === 'xiaohongshu') {
    assertXhs(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8'));
  }

  const zipPath = path.join(__dirname, 'dist', `${platformId}-${SLUG}.zip`);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  // 保留 assets/ 目录结构（勿用 zip -j）
  execSync(`zip -q -r "${zipPath}" ${[...FILES, ICON].map(f => `"${f}"`).join(' ')}`, {
    cwd: outDir,
    stdio: 'pipe'
  });
  const zipBytes = fs.statSync(zipPath).size;
  const allFiles = [...FILES, ICON];
  const sizes = Object.fromEntries(
    allFiles.map(f => [f, fs.statSync(path.join(outDir, f)).size])
  );
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const ok = total <= MAX_BYTES && zipBytes <= MAX_BYTES;
  const detail = Object.entries(sizes)
    .map(([k, v]) => `${k} ${(v / 1024).toFixed(1)} KB`)
    .join(', ');
  console.log(
    `${ok ? '✓' : '✗'} ${cfg.name || platformId}: ${detail}, zip ${(zipBytes / 1024).toFixed(1)} KB → dist/${platformId}/`
  );
  if (!ok) console.error('  超过 8MB 限制，请精简资源');
}

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
for (const id of targets) buildOne(id);
