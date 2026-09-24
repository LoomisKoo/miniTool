#!/usr/bin/env node
/**
 * 构建影厅模拟器小红书离线包
 * 用法：node build.mjs xiaohongshu
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM_CSS = {
  kuaishou: [
    ':root { --safe-t: 0px; --nav-h: 0px; }',
    '.home-top-bar { position: relative; height: auto; padding: 18px 16px 6px; }',
    '.nav-title { font-family: var(--font-display); color: var(--accent); font-size: clamp(26px, 7.2vw, 32px); letter-spacing: 0.28em; text-indent: 0.28em; }',
    '.home-scroll > .ticket { margin-top: 72px; }',
    '.nav-sub { font-size: 12px; color: var(--ink); }',
    '.theatre-view .top-nav { top: 0; padding: 10px 12px 0; }',
  ].join('\n')
};

function buildOne(platform) {
const cfgPath = path.join(root, 'platforms', platform, 'config.json');
if (!fs.existsSync(cfgPath)) throw new Error('未知平台：' + platform);
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const out = path.join(root, 'dist', platform);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<title>影厅模拟器</title>', '<title>' + cfg.title + '</title>')
  .replace('../wind-chime/vendor/three.min.js', './three.min.js');
fs.writeFileSync(path.join(out, 'index.html'), html);
let style = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const extraCss = PLATFORM_CSS[platform];
if (extraCss) style += '\n\n/* platform:' + platform + ' */\n' + extraCss + '\n';
fs.writeFileSync(path.join(out, 'style.css'), style);
fs.copyFileSync(path.join(root, 'app.js'), path.join(out, 'app.js'));
fs.copyFileSync(path.join(root, '../wind-chime/vendor/three.min.js'), path.join(out, 'three.min.js'));
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
fs.copyFileSync(path.join(root, 'assets', 'sample-screen.jpg'), path.join(out, 'assets', 'sample-screen.jpg'));
fs.copyFileSync(path.join(root, 'assets', 'icon.jpg'), path.join(out, 'assets', 'icon.jpg'));

const zip = path.join(root, 'dist', platform + '-cinema-seat.zip');
if (fs.existsSync(zip)) fs.unlinkSync(zip);
execSync('zip -q -r "' + zip + '" index.html style.css app.js three.min.js assets -x "*.DS_Store"', { cwd: out });
console.log('完成：' + path.relative(root, zip));
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['xiaohongshu'];
targets.forEach(buildOne);
