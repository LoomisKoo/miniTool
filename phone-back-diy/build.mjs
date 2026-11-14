#!/usr/bin/env node
/**
 * 打包手机背面 DIY — 小红书小工具离线 zip
 * 用法: node build.mjs
 * 产物: dist/xiaohongshu-phone-back-diy.zip（index.html 在包根）
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'dist');
const STAGE = path.join(OUT_DIR, '_build');
const ZIP = path.join(OUT_DIR, 'xiaohongshu-phone-back-diy.zip');
const LIMIT = 10 * 1024 * 1024;

const ENTRIES = ['index.html', 'favicon.svg', 'assets', 'fonts'];

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyEntry(name) {
  const src = path.join(__dirname, name);
  if (!fs.existsSync(src)) throw new Error(`缺少构建入口: ${name}`);
  fs.cpSync(src, path.join(STAGE, name), { recursive: true });
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function assertArtifact() {
  const html = fs.readFileSync(path.join(STAGE, 'index.html'), 'utf8');
  if (/(?:src|href)=["']https?:\/\//i.test(html)) throw new Error('index.html 含外链资源');
  if (/<iframe/i.test(html)) throw new Error('index.html 含 iframe');
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('index.html 含内联 script');
  if (/\son\w+\s*=/i.test(html)) throw new Error('index.html 含 HTML 内联事件');
  if (/type=["']module["']/i.test(html)) throw new Error('index.html 使用了 module 脚本');

  const files = walk(STAGE);
  const bad = files.filter((f) =>
    ['.map', '.md', '.mjs'].includes(path.extname(f).toLowerCase())
  );
  if (bad.length) throw new Error(`产物含不允许的文件: ${bad.map((f) => path.relative(STAGE, f)).join(', ')}`);

  for (const f of files) {
    if (f.includes('node_modules') || path.basename(f) === '.DS_Store') {
      throw new Error(`产物含禁止内容: ${path.relative(STAGE, f)}`);
    }
  }
  return files.length;
}

rmrf(STAGE);
rmrf(ZIP);
fs.mkdirSync(STAGE, { recursive: true });
for (const entry of ENTRIES) copyEntry(entry);

const count = assertArtifact();
execSync(`cd "${STAGE}" && zip -qr "${ZIP}" . -x '*.DS_Store'`, { stdio: 'pipe' });
const size = fs.statSync(ZIP).size;

console.log(
  `✓ 小红书: ${count} 个文件, zip ${(size / 1024 / 1024).toFixed(2)} MiB → ${path.relative(__dirname, ZIP)}`
);
if (size > LIMIT) throw new Error('zip 超过 10 MiB 上传上限');

rmrf(STAGE);
