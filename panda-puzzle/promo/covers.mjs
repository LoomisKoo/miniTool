#!/usr/bin/env node
/**
 * 熊猫拼图 · 三张 3:4 封面（1080×1440），用于小红书封面 PK。
 *
 *   node promo/covers.mjs
 *
 * 输出 promo/out/cover-1-detail.jpg / cover-2-broken.jpg / cover-3-reveal.jpg
 *
 * 三张分别测不同的钩子，不要只换颜色：
 *   1 细节流：拼好的整幅照片占满画面  → 「一张照片，切成 48 块」
 *   2 反差流：空盘 + 满托盘碎块        → 「我把照片切碎了」
 *   3 解压流：揭晓 + 撒花              → 「拼不动？一键揭晓」
 *
 * 底图是现场渲染的干净画面（没有推广片里的胶囊字幕）。拼图那张直接裁
 * 3D 舞台区域再放大，所以是满版，不带你手机里的托盘和按钮。
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TMP = '/tmp/panda-cover';
const OUT = path.join(__dirname, 'out');
const PORT = 8792;
const FFMPEG = '/Applications/Downie 4.app/Contents/Resources/ffmpeg';

const COLS = 6;
const ROWS = 8;

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const m of ['playwright', 'playwright-core']) {
    try { return require(m); } catch (_) {}
  }
  const base = path.join(process.env.HOME || '', '.npm/_npx');
  if (!fs.existsSync(base)) throw new Error('没找到 playwright');
  for (const d of fs.readdirSync(base)) {
    const p = path.join(base, d, 'node_modules/playwright');
    if (fs.existsSync(p)) { try { return require(p); } catch (_) {} }
  }
  throw new Error('没找到 playwright');
}
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  if (!fs.existsSync(cache)) return undefined;
  const dirs = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) for (const rel of [
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  ]) {
    const p = path.join(cache, d, rel);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/* ---------- 1. 临时站点 ---------- */

fs.rmSync(TMP, { recursive: true, force: true });
for (const dir of ['src', 'vendor', 'assets']) fs.mkdirSync(path.join(TMP, dir), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'src'))) {
  if (f.endsWith('.js') || f.endsWith('.css')) {
    fs.copyFileSync(path.join(ROOT, 'src', f), path.join(TMP, 'src', f));
  }
}
fs.copyFileSync(path.join(ROOT, 'vendor/three.min.js'), path.join(TMP, 'vendor/three.min.js'));
fs.copyFileSync(path.join(__dirname, 'assets/demo-photo.jpg'), path.join(TMP, 'assets/demo-photo.jpg'));
fs.copyFileSync(path.join(__dirname, 'clock.js'), path.join(TMP, 'clock.js'));

const HOOK = `

/* ===== 封面渲染钩子（只在临时副本里） ===== */
window.__panda = {
  load: function (url, cols, rows) {
    return loadImage(url).then(function (img) {
      sourceImage = img;
      cropView = { cx: 0.5, cy: 0.5, zoom: 1 };
      els.cols.value = cols;
      els.rows.value = rows;
      return generatePuzzle();
    });
  },
  solve: function () { solveAll(); },
  scatterAll: function () { scatterAll(); },
};
`;
fs.writeFileSync(path.join(TMP, 'src/app.js'), fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8') + HOOK);

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) throw new Error('index.html 缺少 <body>');
const appBody = bodyMatch[1].replace(/<script[\s\S]*?<\/script>\s*/gi, '').trim();

const SCALE = (1440 / 844).toFixed(6);
const PHONE_W = (390 * (1440 / 844)).toFixed(2);

const STAGE_CSS = `
  html, body { margin: 0; width: 1080px; height: 1440px; overflow: hidden; background: #080915; }
  body { -webkit-font-smoothing: antialiased; }
  .rec {
    position: relative; width: 1080px; height: 1440px;
    background:
      radial-gradient(70% 46% at 50% 14%, rgba(122,108,255,.20) 0%, transparent 70%),
      radial-gradient(48% 34% at 90% 100%, rgba(255,150,80,.12) 0%, transparent 72%),
      linear-gradient(180deg, #12142c 0%, #07080f 100%);
  }
  .rec-phone {
    position: absolute; top: 0; left: ${(1080 - Number(PHONE_W)) / 2}px;
    width: ${PHONE_W}px; height: 1440px; overflow: hidden;
  }
  .rec-app {
    width: 390px; height: 844px;
    transform: scale(${SCALE}); transform-origin: top left;
    --xhs-nav: 12px;
  }
  .rec-app .phone { width: 390px; height: 844px; max-width: none; max-height: none; margin: 0; }
  /* 封面不要 toast：会挡住画面中间 */
  .toast { display: none !important; }
`;

fs.writeFileSync(path.join(TMP, 'record.html'), `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>封面底图</title>
<link rel="stylesheet" href="/src/style.css" />
<style>${STAGE_CSS}</style>
</head>
<body>
<div class="rec"><div class="rec-phone"><div class="rec-app">${appBody}</div></div></div>
<script src="/vendor/three.min.js"></script>
<script src="/clock.js"></script>
<script type="module" src="/src/app.js"></script>
</body>
</html>`);

/* ---------- 2. 静态服务 ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.join(TMP, url === '/' ? 'record.html' : url);
  if (!file.startsWith(TMP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

/* ---------- 3. 渲染底图 ---------- */

const { chromium } = loadPlaywright();
const exe = findChrome();
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1440 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text().slice(0, 200)); });

await page.goto(`http://127.0.0.1:${PORT}/record.html`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__panda, null, { timeout: 20000 });
await page.evaluate(() => document.fonts.ready);

// dpr=3：细节图要裁 3D 舞台再放大到 1080 宽，舞台只有 370 CSS px，
// 3 倍才够（applyPixelRatio 的上限正好是 3）
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1080, height: 1440, deviceScaleFactor: 3, mobile: false,
});
await cdp.send('Animation.enable');
await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });

async function pump(fnBody, timeoutMs = 180000) {
  const ok = await page.evaluate(async ({ src, timeoutMs }) => {
    let done = false; let err = null;
    new Function('return (' + src + ')')()().then(() => { done = true; }).catch((e) => { err = String(e); done = true; });
    const t0 = window.__real.now();
    while (!done && window.__real.now() - t0 < timeoutMs) {
      window.__clock.step(1000 / 30);
      await new Promise((r) => window.__real.setTimeout(r, 1));
    }
    if (err) throw new Error(err);
    return done;
  }, { src: fnBody, timeoutMs });
  if (!ok) throw new Error('等待超时：' + fnBody.slice(0, 60));
}
async function step(seconds) {
  await page.evaluate((s) => {
    const n = Math.round((s * 1000) / (1000 / 30));
    for (let i = 0; i < n; i++) window.__clock.step(1000 / 30);
  }, seconds);
}
async function settle(seconds = 3.4) {
  await step(seconds);
  await page.evaluate(() => { const c = document.querySelector('.confetti-layer'); if (c) c.remove(); });
}
/** 等两次真实 rAF 再截：彩纸是独立 2D canvas 图层，只等一帧有时还没提交 */
async function paint() {
  await page.evaluate(() => new Promise((r) => {
    window.__real.raf(() => window.__real.raf(() => window.__real.setTimeout(r, 16)));
  }));
}
async function shot(file, clip) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'jpeg', quality: 95, captureBeyondViewport: !!clip,
    ...(clip ? { clip } : {}),
  });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

fs.mkdirSync(OUT, { recursive: true });

console.log(`准备底图：载入照片 + 切 ${COLS}×${ROWS} …`);
await pump(`() => window.__panda.load("/assets/demo-photo.jpg", ${COLS}, ${ROWS})`);

/** 1 细节：揭晓成完整画面，等撒花走完再拍 */
await page.evaluate(() => window.__panda.solve());
await settle(3.4);
await step(0.2);
await paint();
const stage = await page.evaluate(() => {
  const r = document.querySelector('.stage').getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
});
await shot(path.join(TMP, 'raw-detail.jpg'), { ...stage, scale: 1 });
console.log('  ✓ 拼好');

/** 2 反差：整幅收回托盘的飞散瞬间，比静止的空盘有冲击 */
await page.evaluate(() => window.__panda.scatterAll());
await step(0.18);
await paint();
await shot(path.join(TMP, 'raw-broken.jpg'));
console.log('  ✓ 打散瞬间');

/** 3 解压：再揭晓一次，抓撒花铺开的一拍 */
await page.evaluate(() => window.__panda.solve());
await step(1.15);
await paint();
await shot(path.join(TMP, 'raw-reveal.jpg'));
console.log('  ✓ 揭晓 + 撒花');

await browser.close();

/* ---------- 4. 底图标准化成 1080×1440 ---------- */

function ff(args) {
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg 失败');
}

// 细节图是裁出来的 3D 舞台，比例约 0.727，缩放后居中裁到 3:4
ff(['-i', path.join(TMP, 'raw-detail.jpg'),
  '-vf', 'scale=1080:-1:flags=lanczos,crop=1080:1440',
  '-q:v', '2', path.join(TMP, 'base-detail.jpg')]);
for (const [src, dst] of [['raw-broken.jpg', 'base-broken.jpg'], ['raw-reveal.jpg', 'base-reveal.jpg']]) {
  ff(['-i', path.join(TMP, src),
    '-vf', 'scale=1080:1440:flags=lanczos',
    '-q:v', '2', path.join(TMP, dst)]);
}

/* ---------- 5. 排版 ---------- */

const DESIGN_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #15161f; }
  body { display: flex; gap: 40px; padding: 40px; }
  .cover {
    position: relative; width: 1080px; height: 1440px; flex: none; overflow: hidden;
    font-family: 'PingFang SC', 'Hiragino Sans GB', 'Yuanti SC', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .cover > img.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cover .brand {
    position: absolute; left: 66px; bottom: 62px;
    font-size: 32px; font-weight: 800; letter-spacing: .04em;
  }
  .cover h1 { margin: 0; font-weight: 900; letter-spacing: -.02em; }
  .cover h1 em { font-style: normal; }
  .cover p { margin: 0; }

  /* ---------- 1 细节流：满版拼图 + 底部压暗 ---------- */
  #A .shade {
    position: absolute; inset: 0;
    background:
      linear-gradient(180deg, rgba(6,7,16,.55) 0%, rgba(6,7,16,0) 26%, rgba(6,7,16,0) 46%, rgba(6,7,16,.92) 82%, #05060e 100%);
  }
  #A .top {
    position: absolute; left: 66px; top: 70px;
    display: inline-flex; align-items: center; gap: 14px;
    padding: 14px 26px; border-radius: 999px;
    background: rgba(255, 181, 71, .16);
    box-shadow: inset 0 0 0 2px rgba(255, 181, 71, .55);
    color: #ffc76e; font-size: 32px; font-weight: 800; letter-spacing: .02em;
  }
  #A h1 {
    position: absolute; left: 66px; bottom: 196px;
    font-size: 112px; line-height: 1.06; color: #fff;
    text-shadow: 0 10px 40px rgba(0,0,0,.55);
  }
  #A h1 em { color: #ffb547; }
  #A p {
    position: absolute; left: 70px; bottom: 132px;
    font-size: 36px; font-weight: 700; color: rgba(236, 232, 255, .78); letter-spacing: .02em;
  }
  #A .brand { color: rgba(255,255,255,.5); }

  /* ---------- 2 反差流：碎块飞散的一瞬 ---------- */
  #B .shade {
    position: absolute; inset: 0;
    background:
      radial-gradient(66% 30% at 50% 24%, rgba(6,7,16,.88) 0%, rgba(6,7,16,.34) 72%, rgba(6,7,16,0) 100%),
      linear-gradient(180deg, rgba(6,7,16,.9) 0%, rgba(6,7,16,.34) 26%, rgba(6,7,16,.1) 46%, rgba(6,7,16,.42) 74%, rgba(6,7,16,.94) 100%);
  }
  #B h1 {
    position: absolute; left: 0; right: 0; top: 176px; text-align: center;
    font-size: 136px; line-height: 1.06; color: #fff;
    text-shadow: 0 14px 50px rgba(0,0,0,.85);
  }
  #B h1 em { color: #ffb547; }
  #B p {
    position: absolute; left: 0; right: 0; top: 490px; text-align: center;
    font-size: 40px; font-weight: 800; color: rgba(255,255,255,.9); letter-spacing: .06em;
    text-shadow: 0 6px 24px rgba(0,0,0,.8);
  }
  #B .brand { color: rgba(255,255,255,.62); }

  /* ---------- 3 解压流：撒花 + 居中大字 ---------- */
  #C .shade {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(6,7,16,.62) 0%, rgba(6,7,16,.18) 32%, rgba(6,7,16,.72) 78%, rgba(6,7,16,.96) 100%);
  }
  #C .tag {
    position: absolute; left: 0; right: 0; top: 118px; text-align: center;
    font-size: 34px; font-weight: 800; letter-spacing: .22em; color: rgba(255,255,255,.62);
  }
  #C h1 {
    position: absolute; left: 0; right: 0; top: 176px; text-align: center;
    font-size: 128px; line-height: 1.1; color: #fff;
    text-shadow: 0 14px 54px rgba(0,0,0,.7);
  }
  #C h1 em { color: #ffb547; }
  #C .sub {
    position: absolute; left: 0; right: 0; bottom: 208px; text-align: center;
    font-size: 38px; font-weight: 800; color: rgba(255,255,255,.9); letter-spacing: .02em;
  }
  #C .pills {
    position: absolute; left: 0; right: 0; bottom: 124px;
    display: flex; justify-content: center; gap: 16px;
  }
  #C .pills span {
    padding: 12px 24px; border-radius: 999px;
    background: rgba(255,255,255,.10);
    box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.22);
    font-size: 27px; font-weight: 800; color: rgba(255,255,255,.86);
  }
  #C .brand { color: rgba(255,255,255,.5); }
`;

const designHtml = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8" /><style>${DESIGN_CSS}</style></head>
<body>
  <div class="cover" id="A">
    <img class="bg" src="/base-detail.jpg" alt="" />
    <div class="shade"></div>
    <div class="top">3D 纸板拼图</div>
    <h1>一张照片<br><em>切成 48 块</em></h1>
    <p>每一块都能单独转 90°</p>
    <div class="brand">熊猫拼图</div>
  </div>

  <div class="cover" id="B">
    <img class="bg" src="/base-broken.jpg" alt="" />
    <div class="shade"></div>
    <h1>我把照片<br><em>切碎了</em></h1>
    <p>48 块，一块块拼回来</p>
    <div class="brand">熊猫拼图</div>
  </div>

  <div class="cover" id="C">
    <img class="bg" src="/base-reveal.jpg" alt="" />
    <div class="shade"></div>
    <div class="tag">拼图 · 解压</div>
    <h1>拼不动？<br><em>一键揭晓</em></h1>
    <div class="sub">不用注册，不用联网</div>
    <div class="pills"><span>提示落位</span><span>打散重来</span><span>存成成品图</span></div>
    <div class="brand">熊猫拼图</div>
  </div>
</body></html>`;
fs.writeFileSync(path.join(TMP, 'design.html'), designHtml);

const dpage = await (async () => {
  const b = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: 1080 * 3 + 80 * 2, height: 1520 }, deviceScaleFactor: 2 });
  await p.goto(`http://127.0.0.1:${PORT}/design.html`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0));
  return { b, p };
})();

const names = [['A', 'cover-1-detail'], ['B', 'cover-2-broken'], ['C', 'cover-3-reveal']];
for (const [id, file] of names) {
  const el = dpage.p.locator('#' + id);
  await el.screenshot({ path: path.join(OUT, file + '.jpg'), type: 'jpeg', quality: 95 });
  console.log('  ✓', file + '.jpg');
}
await dpage.b.close();
server.close();

console.log('\n完成：');
for (const [, file] of names) {
  const p = path.join(OUT, file + '.jpg');
  console.log(`  ${path.relative(process.cwd(), p)}  ${(fs.statSync(p).size / 1024).toFixed(0)} KB`);
}
fs.rmSync('/tmp/panda-cover', { recursive: true, force: true });
