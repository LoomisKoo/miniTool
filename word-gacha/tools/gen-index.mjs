#!/usr/bin/env node
/**
 * 由 src/body.html 生成 src/index.html（开发预览用）。
 * build.mjs 打包时同样读 body.html，所以两边不会再各自漂移。
 * 用法: node tools/gen-index.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');

const body = fs.readFileSync(path.join(src, 'body.html'), 'utf8');
const style = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
const ver = Date.now().toString(36).slice(-5);

const SCRIPTS = [
  'glyphs', 'words', 'words-bulk', 'card', 'fx', 'sfx',
  'stages', 'battle', 'capture', 'app',
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>词卡物语</title>
<link rel="stylesheet" href="style.css?v=${ver}">
</head>
<body>
${body}
${SCRIPTS.map((n) => `<script src="${n}.js?v=${ver}"></script>`).join('\n')}
</body>
</html>
`;

fs.writeFileSync(path.join(src, 'index.html'), html);
console.log(`✓ src/index.html 已由 body.html 生成（${(html.length / 1024).toFixed(1)}KB，style ${(style.length / 1024).toFixed(0)}KB）`);
