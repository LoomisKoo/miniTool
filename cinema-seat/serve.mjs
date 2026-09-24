#!/usr/bin/env node
/**
 * 本地预览影厅模拟器（开发用，零依赖）
 *   node serve.mjs           # http://127.0.0.1:9881/cinema-seat/
 *   node serve.mjs 9000      # 换个端口
 *
 * 服务根是仓库根目录 miniTool/，因为 index.html 里 three.min.js 走
 * ../wind-chime/vendor/，根设在 cinema-seat/ 会读不到。
 * 一律 no-store：python -m http.server 不发 Cache-Control，浏览器会用
 * 启发式缓存攒着 app.js / style.css，改完刷新看不出变化。
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || 9881);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4'
};

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);

  /* 根路径 / 少斜杠的目录都归到工具页，避免出现 404 空页 */
  const isDir = (p) => { try { return fs.statSync(path.join(ROOT, p)).isDirectory(); } catch { return false; } };
  if (url === '/' || (isDir(url) && !url.endsWith('/'))) {
    res.writeHead(302, { Location: '/cinema-seat/' }).end();
    return;
  }

  let rel = url.endsWith('/') ? url + 'index.html' : url;
  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate'
    });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`影厅模拟器预览 · http://127.0.0.1:${PORT}/cinema-seat/`);
});
