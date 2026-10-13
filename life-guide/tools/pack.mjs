#!/usr/bin/env node
/**
 * 打小红书小工具 zip：容器 CSP 禁内联脚本，把 index.html 里的 <script> 拆成 app.js。
 * 用法：node tools/pack.mjs   → dist/xiaohongshu/ + dist/xiaohongshu-life-guide.zip
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PLATFORM = 'xiaohongshu';
const SLUG = 'life-guide';
const MAX_BYTES = 10 * 1024 * 1024;

execFileSync('node', [path.join(__dirname, 'build.mjs')], { stdio: 'inherit' });

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) throw new Error(`应只有 1 段内联脚本，实际 ${scripts.length}`);
const js = scripts[0][1].trim() + '\n';
// 小工具图标由平台后台配置，base64 favicon 只会让 index.html 平白多出 1MB+
// 容器顶栏：运行时检测 window.xhs 不可靠，按其他工具的做法打包时直接写死
const page = html
  .replace('<html lang="zh-CN">', '<html lang="zh-CN" class="env-xhs">')
  .replace(scripts[0][0], '<script src="./app.js"></script>')
  .replace(/<link rel="(?:icon|apple-touch-icon)"[^>]*>\n?/g, '');

if (!page.includes('class="env-xhs"')) throw new Error('没加上 env-xhs，顶栏不会让开');
if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(page)) throw new Error('仍有内联 <script>');
if (/\son[a-z]+=|javascript:|type="module"/i.test(page)) throw new Error('含行内事件 / javascript: / module');
if (/(?:src|href)=["']https?:\/\//i.test(page)) throw new Error('含外链资源');
if (/<iframe|<base\s/i.test(page)) throw new Error('含 iframe / base');
if (/\beval\(|new Function\(/.test(js)) throw new Error('JS 含 eval / new Function');

const outDir = path.join(ROOT, 'dist', PLATFORM);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), page);
fs.writeFileSync(path.join(outDir, 'app.js'), js);

const zipPath = path.join(ROOT, 'dist', `${PLATFORM}-${SLUG}.zip`);
fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-q', '-r', zipPath, '.', '-x', '*.DS_Store'], { cwd: outDir });

const kb = n => (n / 1024).toFixed(0) + ' KB';
const sizes = ['index.html', 'app.js'].map(f => `${f} ${kb(fs.statSync(path.join(outDir, f)).size)}`);
const zipBytes = fs.statSync(zipPath).size;
console.log(`\n${zipBytes <= MAX_BYTES ? '✓' : '✗'} ${sizes.join('，')}，zip ${kb(zipBytes)} → dist/${PLATFORM}-${SLUG}.zip`);
if (fs.statSync(path.join(outDir, 'app.js')).size > 2 * 1024 * 1024) {
  console.log('  ⚠ app.js 超过 2MiB（677 条正文内联），规范要求人工确认；zip 远低于 10MB 上限');
}
