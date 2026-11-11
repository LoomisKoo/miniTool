#!/usr/bin/env node
/**
 * 词卡物语 · 3:4 宣传图导出
 *
 *   node tools/promo/posters.mjs        # 全部导出
 *   node tools/promo/posters.mjs 4 5    # 只导出指定页
 *
 * 产物：assets/promo/0N-*.jpg（1080×1440），01 为封面海报 assets/poster.jpg
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const site = path.join(root, 'src');
const out = path.join(root, 'assets/promo');
const PAGES = { 2: 'draw', 3: 'rarity', 4: 'weapons', 5: 'learn', 6: 'cities', 7: 'codex' };
const only = process.argv.slice(2).map(Number).filter((n) => PAGES[n]);
const list = only.length ? only : Object.keys(PAGES).map(Number);

fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(root, 'assets/poster.jpg'), path.join(out, '01-cover.jpg'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = path.join(site, rel);
  if (!file.startsWith(site) || !fs.existsSync(file)) { res.writeHead(404).end('nope'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('页面错误:', e.message));
for (const n of list) {
  await page.goto(`http://127.0.0.1:${port}/promo.html?n=${n}`);
  // 卡面特效 / 弹幕需要跑一会儿再截
  await page.waitForTimeout(n === 4 ? 2300 : (n === 2 || n === 3 || n === 5 || n === 7 ? 1600 : 900));
  const file = path.join(out, `0${n}-${PAGES[n]}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
  console.log('✓', path.relative(root, file));
}
await browser.close();
server.close();
