#!/usr/bin/env node
/**
 * 构建观影座舱小红书离线包
 * 用法：node build.mjs xiaohongshu
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const platform = process.argv[2] || 'xiaohongshu';
const cfgPath = path.join(root, 'platforms', platform, 'config.json');
if (!fs.existsSync(cfgPath)) throw new Error('未知平台：' + platform);
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const out = path.join(root, 'dist', platform);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<title>观影座舱</title>', '<title>' + cfg.title + '</title>')
  .replace('../wind-chime/vendor/three.min.js', './three.min.js');
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(root, 'style.css'), path.join(out, 'style.css'));
fs.copyFileSync(path.join(root, 'app.js'), path.join(out, 'app.js'));
fs.copyFileSync(path.join(root, '../wind-chime/vendor/three.min.js'), path.join(out, 'three.min.js'));

const zip = path.join(root, 'dist', platform + '-cinema-seat.zip');
if (fs.existsSync(zip)) fs.unlinkSync(zip);
execSync('zip -q -r "' + zip + '" index.html style.css app.js three.min.js -x "*.DS_Store"', { cwd: out });
console.log('完成：' + path.relative(root, zip));
