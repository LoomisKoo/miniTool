#!/usr/bin/env node
/**
 * 打包兔格拼豆 — 各平台扁平多文件 + zip
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
const SLUG = 'bead-pattern';
const FILES = ['index.html', 'style.css', 'app.js', 'palettes.js', 'icon.png'];

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

// 快手：无容器顶栏，不展示页内「兔格拼豆」标题
const PLATFORM_CSS = {
  kuaishou: ':root { --safe-top: 0px; }\n.header { display: none !important; height: 0 !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; overflow: hidden !important; }'
};

function assertOffline(dir) {
  let text = '';
  for (const f of FILES) {
    if (!/\.(html|js|css)$/i.test(f)) continue;
    text += fs.readFileSync(path.join(dir, f), 'utf8');
  }
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

function zipFiles(zipPath, files) {
  const list = files.map(f => `"${f}"`).join(' ');
  execSync(`zip -q -j "${zipPath}" ${list}`, { stdio: 'pipe' });
}

function buildOne(platformId) {
  const cfgPath = path.join(__dirname, 'platforms', platformId, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error(`跳过未知平台: ${platformId}`);
    return;
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const outDir = path.join(__dirname, 'dist', platformId);
  fs.mkdirSync(outDir, { recursive: true });

  const copied = [];
  for (const f of FILES) {
    const src = path.join(__dirname, f);
    const dest = path.join(outDir, f);
    if (f === 'index.html') {
      const html = fs
        .readFileSync(src, 'utf8')
        .replace(/\?v=[^"']+/g, '');
      fs.writeFileSync(dest, html);
    } else {
      fs.copyFileSync(src, dest);
    }
    copied.push(dest);
  }

  const extraCss = PLATFORM_CSS[platformId];
  if (extraCss) {
    const stylePath = path.join(outDir, 'style.css');
    fs.writeFileSync(
      stylePath,
      fs.readFileSync(stylePath, 'utf8') + `\n\n/* platform:${platformId} */\n${extraCss}\n`
    );
  }

  assertOffline(outDir);
  if (platformId === 'xiaohongshu') {
    assertXhs(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8'));
  }

  const zipPath = path.join(__dirname, 'dist', `${platformId}-${SLUG}.zip`);
  zipFiles(zipPath, copied);
  const zipBytes = fs.statSync(zipPath).size;
  const sizes = Object.fromEntries(
    FILES.map(f => [f, fs.statSync(path.join(outDir, f)).size])
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
