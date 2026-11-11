#!/usr/bin/env node
/**
 * 词卡物语 · 怪物图鉴展示图导出（1080×1440）
 * 封面 + 17 内页 = 18（小红书上限）
 *
 *   node tools/promo/monster-posters.mjs
 *   node tools/promo/monster-posters.mjs 1 4 18
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const site = path.join(root, 'src');
const out = path.join(root, 'assets/promo/monster');
const PAGES = {
  1: 'cover',
  2: 'breakfast',
  3: 'street',
  4: 'cute',
  5: 'vehicles',
  6: 'landmarks',
  7: 'dessert',
  8: 'noodles',
  9: 'drinks',
  10: 'landmarks2',
  11: 'transit',
  12: 'animals',
  13: 'festival',
  14: 'fruit',
  15: 'europe',
  16: 'market',
  17: 'harbor',
  18: 'wonders',
};
const only = process.argv.slice(2).map(Number).filter((n) => PAGES[n]);
const list = only.length ? only : Object.keys(PAGES).map(Number);

fs.mkdirSync(out, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.jpg': 'image/jpeg', '.png': 'image/png',
};
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
  await page.goto(`http://127.0.0.1:${port}/monster-promo.html?n=${n}`);
  await page.waitForTimeout(400);
  const name = String(n).padStart(2, '0') + '-' + PAGES[n] + '.jpg';
  const file = path.join(out, name);
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
  console.log('✓', path.relative(root, file));
}
await browser.close();
server.close();
