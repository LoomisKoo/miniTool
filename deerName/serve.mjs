#!/usr/bin/env node
/**
 * 本地预览仙鹿起名（开发用，零依赖）
 *   node serve.mjs           # http://127.0.0.1:9880/body.html
 *   node serve.mjs 9000      # 换个端口
 *
 * 为什么不用 python -m http.server：它不发 Cache-Control，
 * 浏览器会用启发式缓存把 src/*.js、src/*.css 攒着不重新拉，
 * 改完代码刷新看不到变化（还以为没生效）。这里一律 no-store，
 * 并对 HTML 里的 css/js 链接自动追加文件 mtime 作 cache-bust。
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'src');
const PORT = Number(process.argv[2] || 9880);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg'
};

function bustHtml(html) {
  return html.replace(/(href|src)="([^"?#]+\.(?:css|js))"/g, (m, attr, rel) => {
    try {
      const abs = path.join(ROOT, rel);
      const t = Math.floor(fs.statSync(abs).mtimeMs);
      return `${attr}="${rel}?v=${t}"`;
    } catch (_) {
      return m;
    }
  });
}

http.createServer((req, res) => {
  const raw = (req.url || '/').split('?')[0];
  const url = decodeURIComponent(raw);
  /* 目录和根路径都落到 body.html（src/ 里没有 index.html，只有源码骨架） */
  let rel = url === '/' || url.endsWith('/') ? url + 'body.html' : url;
  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    const ext = path.extname(file);
    const headers = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    };
    if (ext === '.html') {
      res.writeHead(200, headers);
      res.end(bustHtml(buf.toString('utf8')));
      return;
    }
    res.writeHead(200, headers);
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`仙鹿起名预览 · http://127.0.0.1:${PORT}/body.html`);
});
