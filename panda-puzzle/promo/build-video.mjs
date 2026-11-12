#!/usr/bin/env node
/**
 * 熊猫拼图 · 小红书推广片（1080×1440 / 3:4 / 30fps / 19s）
 *
 *   node promo/build-video.mjs            # 出整片 → promo/out/panda-puzzle-xhs.mp4
 *   node promo/build-video.mjs --preview  # 只抽 12 帧看排版
 *
 * 不录屏。rAF / performance.now / CSS transition 全部交给虚拟时钟
 * （promo/clock.js），按 1/30s 推进再逐帧截图，所以没有鼠标、没有掉帧。
 *
 * 两个必须踩到的坑：
 * 1) headless 没有 GPU，WebGL 要开 swiftshader，否则场景根本起不来。
 * 2) CSS transition 走的是真实时间。截一帧要一两秒，420ms 的拼块飞行早跑完了，
 *    逐帧里只能看到「啪」地落位。所以用 CDP 把动画时间轴 playbackRate 按成 0，
 *    再由 clock.js 按虚拟时间一帧帧推。
 *
 * 整片相机固定在 90° 正俯视（App 生成拼图后的默认视角），不做倾斜。
 * 字幕不写在全片顶部：每段都贴在对应按钮旁边，用一条线连过去。
 *
 * app.js 里没有录制专用代码：这里复制一份到临时目录，只在副本末尾追加
 * window.__panda 钩子（拼块、打散、相机），dist 里的产物不会带上。
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { FPS, DURATION, CUES, BEATS } from './timeline.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TMP = '/tmp/panda-rec';
const FRAMES = '/tmp/panda-frames';
const OUT = path.join(__dirname, 'out');
const PORT = 8791;
const PREVIEW = process.argv.includes('--preview');
const FFMPEG = '/Applications/Downie 4.app/Contents/Resources/ffmpeg';

/** 片头这块先从 24 块开始，打开设置改成 48 块，让「行列自己定」有可见结果 */
const START_COLS = 4;
const START_ROWS = 6;
const COLS = 6;
const ROWS = 8;

/** 4 次加减：列 +2、行 +2 → 6×8 = 48 块 */
const STEP_ACTIONS = ['#colsPlus', '#colsPlus', '#rowsPlus', '#rowsPlus'];

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

/* ---------- 1. 临时站点（src 的副本 + 录制页） ---------- */

fs.rmSync(TMP, { recursive: true, force: true });
for (const dir of ['src', 'vendor', 'assets']) fs.mkdirSync(path.join(TMP, dir), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'src'))) {
  if (f.endsWith('.js') || f.endsWith('.css')) {
    fs.copyFileSync(path.join(ROOT, 'src', f), path.join(TMP, 'src', f));
  }
}
fs.copyFileSync(path.join(ROOT, 'vendor/three.min.js'), path.join(TMP, 'vendor/three.min.js'));
// 演示照片：干净的竖幅人像（3:4，正好对上 6×8）。不用 assets/poster.png ——
// 那张是产品自己的推广海报，自带标题和按钮文案，当拼图内容会像「广告里贴广告」。
fs.copyFileSync(path.join(__dirname, 'assets/demo-photo.jpg'), path.join(TMP, 'assets/demo-photo.jpg'));
fs.copyFileSync(path.join(__dirname, 'clock.js'), path.join(TMP, 'clock.js'));

/** 副本末尾追加的录制钩子 */
const HOOK = `

/* ===== 录制专用钩子（只在 promo 的临时副本里存在，不进产物） ===== */
window.__panda = {
  get placed() {
    return puzzle ? puzzle.pieces.filter(function (p) { return p.placed; }).length : 0;
  },
  info: function () {
    return puzzle ? { cols: puzzle.cols, rows: puzzle.rows, pieces: puzzle.pieces.length, placed: this.placed } : null;
  },
  load: function (url, cols, rows) {
    return loadImage(url).then(function (img) {
      sourceImage = img;
      cropView = { cx: 0.5, cy: 0.5, zoom: 1 };
      els.cols.value = cols;
      els.rows.value = rows;
      return generatePuzzle();
    });
  },
  /** 直接放到正确槽位：省掉用射线点 3D 场景，画面和手动放完全一致 */
  place: function (id) {
    var slot = state.slotMeshes[id];
    if (!slot) return false;
    selectPiece(id);
    placeOnSlot(slot);
    return true;
  },
  scatterAll: function () { scatterAll(); },
  scatterTray: function () { shuffleUnplaced(); },
  solve: function () { solveAll(); },
  /** 成品图（和点保存导出的是同一张） */
  poster: function () { return getPoster(); },
  /** 与 fitCamera 同一套取景，但倾角可任意插值；90 就是 App 的默认正俯视 */
  orbit: function (tiltDeg, zoom, panX, panZ) {
    var camera = state.camera;
    var renderer = state.renderer;
    if (!camera || !renderer) return;
    var el = renderer.domElement;
    var aspect = el.clientWidth ? el.clientWidth / el.clientHeight : 1;
    camera.aspect = aspect;
    var tan = Math.tan((camera.fov * Math.PI) / 360) || 0.3;
    var vs = viewSize();
    var margin = 1.03;
    var pad = 0.15;
    var distV = (vs.h * margin * 0.5 + pad) / tan;
    var distH = (vs.w * margin * 0.5 + pad) / (tan * aspect);
    var dist = Math.max(distV, distH) / zoom;
    var tilt = (tiltDeg * Math.PI) / 180;
    camera.position.set(
      panX || 0,
      dist * Math.sin(tilt) + (tiltDeg >= 89 ? 0 : 0.4),
      (panZ || 0) + dist * Math.cos(tilt)
    );
    camera.up.set(0, 0, -1);
    camera.lookAt(panX || 0, 0, panZ || 0);
    camera.near = Math.max(0.2, dist * 0.02);
    camera.far = dist * 6;
    camera.updateProjectionMatrix();
  },
};
`;
fs.writeFileSync(path.join(TMP, 'src/app.js'), fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8') + HOOK);

/* 页面结构沿用 index.html 的 body，只换外壳与样式作用域 */
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) throw new Error('index.html 缺少 <body>');
const appBody = bodyMatch[1].replace(/<script[\s\S]*?<\/script>\s*/gi, '').trim();

/* 手机画面按 390×844 排版，整体放大到 1080×1440 的画幅里。
 * 注意 .sheet / .confirm / .toast 都是 position:fixed，只有给同一个
 * transform 祖先做包含块，它们才会跟 .phone 用同一套坐标（否则面板
 * 会按 1080 宽的视口居中，比手机还宽）。所以这里把 body 整块放进 .rec-app。 */
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
    /* 片子里没有小红书顶栏，把 App 预留的 44px 收掉，画面能多占一截 */
    --xhs-nav: 12px;
  }
  .rec-app .phone {
    width: 390px; height: 844px; max-width: none; max-height: none; margin: 0;
  }
  /* 录制时不要应用内 toast：字幕已经在讲同一件事，两个一起会打架 */
  .toast { display: none !important; }
  /* 托盘是横向滚动容器，边缘会露出被切一半的拼块。片子里给两端加个淡出，
     看起来是「还有更多」，而不是「缺了一块」 */
  .rec-app .tray {
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%);
    mask-image: linear-gradient(90deg, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%);
  }

  /* ---- 标注 ---- */
  .rec-callout {
    position: absolute; left: 0; top: 0; z-index: 70;
    padding: 15px 22px; border-radius: 18px;
    background: rgba(9, 10, 22, 0.93);
    box-shadow: 0 18px 46px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.13);
    font-family: 'PingFang SC', 'Hiragino Sans GB', 'Yuanti SC', system-ui, sans-serif;
    font-size: 31px; font-weight: 800; line-height: 1.3; letter-spacing: .01em;
    color: #fff; white-space: pre-line; text-align: left;
    opacity: 0; visibility: hidden;
    transition: opacity 220ms ease-out, transform 260ms cubic-bezier(.34,1.4,.64,1);
    transform: translateY(12px) scale(.95);
  }
  .rec-callout.on { opacity: 1; visibility: visible; transform: none; }
  .rec-leader {
    position: absolute; left: 0; top: 0; z-index: 69;
    height: 2px; width: 0; border-radius: 2px;
    background: linear-gradient(90deg, rgba(255,181,71,.15), rgba(255,181,71,.95));
    transform-origin: 0 50%; opacity: 0;
    transition: opacity 180ms ease-out;
  }
  .rec-leader.on { opacity: 1; }
  .rec-dot {
    position: absolute; z-index: 70; width: 26px; height: 26px; border-radius: 50%;
    box-shadow: 0 0 0 3px rgba(255,181,71,.9), 0 0 0 12px rgba(255,181,71,.20), 0 0 26px rgba(255,181,71,.55);
    opacity: 0; transition: opacity 180ms ease-out;
  }
  .rec-dot.on { opacity: 1; }

  /* ---- 点击涟漪 ---- */
  .rec-tap {
    position: absolute; z-index: 60; width: 56px; height: 56px; border-radius: 50%;
    border: 3px solid rgba(255, 214, 142, .95);
    background: radial-gradient(circle, rgba(255,214,142,.45), rgba(255,214,142,0) 70%);
    pointer-events: none; animation: rec-tap 560ms cubic-bezier(.22,1,.36,1) forwards;
  }
  @keyframes rec-tap {
    0% { transform: scale(.35); opacity: .95; }
    65% { opacity: .4; }
    100% { transform: scale(1.9); opacity: 0; }
  }

  /* ---- 成品图 ---- */
  .rec-poster {
    position: absolute; inset: 0; z-index: 100;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 40px;
    /* 必须不透明：半透明时背后的拼图会透出一条浅色横带，看起来像重影 */
    background: radial-gradient(64% 48% at 50% 44%, #0c0f20 0%, #05060e 100%);
    opacity: 0; visibility: hidden;
    transition: opacity 300ms ease-out, visibility 0s linear 300ms;
  }
  .rec-poster.on { opacity: 1; visibility: visible; transition-delay: 0s; }
  .rec-poster img {
    max-width: 900px; max-height: 1130px; border-radius: 16px;
    box-shadow: 0 34px 90px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.10);
    transform: translateY(24px) scale(.975);
    transition: transform 420ms cubic-bezier(.22,1,.36,1);
  }
  .rec-poster.on img { transform: none; }
  .rec-poster-cap {
    font-family: 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif;
    font-size: 33px; font-weight: 700; letter-spacing: .03em;
    color: rgba(228, 224, 255, .82);
    opacity: 0; transform: translateY(10px);
    transition: opacity 300ms ease-out, transform 300ms ease-out;
  }
  .rec-poster-cap.on { opacity: 1; transform: none; }
`;

fs.writeFileSync(path.join(TMP, 'record.html'), `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>熊猫拼图 · 推广片录制页</title>
<link rel="stylesheet" href="/src/style.css" />
<style>${STAGE_CSS}</style>
</head>
<body>
<div class="rec" id="rec">
  <div class="rec-phone"><div class="rec-app">${appBody}</div></div>
  <div class="rec-leader" id="leader"></div>
  <div class="rec-dot" id="dot"></div>
  <div class="rec-callout" id="callout"></div>
  <div class="rec-poster" id="poster">
    <img id="posterImg" alt="" />
    <div class="rec-poster-cap" id="posterCap">拼完或直接揭晓，都能存成这张图</div>
  </div>
</div>
<script src="/vendor/three.min.js"></script>
<script src="/clock.js"></script>
<script>
/* 录制页自己的小工具：测量真实控件位置、点按钮、撒点击涟漪、贴标注。
 * 位置全部现场量 getBoundingClientRect，不写死坐标，改布局也不会错位。 */
(function () {
  var co = document.getElementById('callout');
  var leader = document.getElementById('leader');
  var dot = document.getElementById('dot');
  var poster = document.getElementById('poster');
  var posterImg = document.getElementById('posterImg');
  var posterCap = document.getElementById('posterCap');
  var rec = document.getElementById('rec');

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function rectOf(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    return el.getBoundingClientRect();
  }
  function pieceBtn(id) {
    var list = document.querySelectorAll('.piece-thumb');
    for (var i = 0; i < list.length; i++) {
      if (list[i]._piece && list[i]._piece.id === id) return list[i];
    }
    return null;
  }
  function ripple(x, y) {
    var d = document.createElement('div');
    d.className = 'rec-tap';
    d.style.left = (x - 28) + 'px';
    d.style.top = (y - 28) + 'px';
    rec.appendChild(d);
    setTimeout(function () { d.remove(); }, 800);
  }
  function hideLeader() {
    leader.classList.remove('on');
    dot.classList.remove('on');
  }

  window.__recUI = {
    callout: function (cfg) {
      co.textContent = cfg.text;
      co.classList.remove('on');
      if (cfg.anchor || cfg.piece != null) {
        var el = cfg.piece != null ? pieceBtn(cfg.piece) : rectOf(cfg.anchor);
        if (!el) { hideLeader(); return false; }
        var r = el.getBoundingClientRect ? el.getBoundingClientRect() : el;
        var tx = r.left + r.width / 2;
        var ty = r.top + r.height / 2;
        var w = co.offsetWidth;
        var h = co.offsetHeight;
        var left = clamp(tx - w / 2, 20, 1080 - w - 20);
        var top = r.top - h - 58;
        if (top < 22) top = r.top + r.height + 58;
        co.style.left = left + 'px';
        co.style.top = top + 'px';
        var x0 = clamp(tx, left + 20, left + w - 20);
        var y0 = top + h;
        var y1 = r.top - 16;
        var dx = tx - x0;
        var dy = y1 - y0;
        var len = Math.sqrt(dx * dx + dy * dy);
        leader.style.width = len + 'px';
        leader.style.transform = 'translate(' + x0 + 'px,' + y0 + 'px) rotate(' + Math.atan2(dy, dx) + 'rad)';
        dot.style.left = (tx - 13) + 'px';
        dot.style.top = (ty - 13) + 'px';
        leader.classList.add('on');
        dot.classList.add('on');
      } else {
        co.style.left = ((1080 - co.offsetWidth) / 2) + 'px';
        co.style.top = (cfg.y || 760) + 'px';
        hideLeader();
      }
      // 强制一次样式计算，保证从 0 开始播入场
      void co.offsetWidth;
      co.classList.add('on');
      return true;
    },
    hide: function () {
      co.classList.remove('on');
      hideLeader();
    },
    /** 点真按钮：先撒涟漪再 click，走的是用户同一条路径 */
    tap: function (sel) {
      var el = document.querySelector(sel);
      if (!el) return false;
      var r = el.getBoundingClientRect();
      ripple(r.left + r.width / 2, r.top + r.height / 2);
      el.click();
      return true;
    },
    /** 只撒涟漪不点击（保存会触发下载，片子里只要反馈） */
    tapOnly: function (sel) {
      var el = document.querySelector(sel);
      if (!el) return false;
      var r = el.getBoundingClientRect();
      ripple(r.left + r.width / 2, r.top + r.height / 2);
      return true;
    },
    tapPiece: function (id) {
      var btn = pieceBtn(id);
      if (!btn) return false;
      var r = btn.getBoundingClientRect();
      ripple(r.left + r.width / 2, r.top + r.height / 2);
      btn.click();
      return true;
    },
    /** 点托盘里最靠前的一块（一定在可视区里），返回它的 id */
    tapFirstPiece: function () {
      var list = document.querySelectorAll('.piece-thumb');
      if (!list.length) return null;
      var btn = list[0];
      var r = btn.getBoundingClientRect();
      ripple(r.left + r.width / 2, r.top + r.height / 2);
      btn.click();
      return btn._piece ? btn._piece.id : null;
    },
    poster: function (src) {
      return new Promise(function (resolve) {
        posterImg.onload = function () { poster.classList.add('on'); resolve(true); };
        posterImg.onerror = function () { resolve(false); };
        posterImg.src = src;
        if (posterImg.complete && posterImg.naturalWidth) {
          poster.classList.add('on');
          resolve(true);
        }
      });
    },
    outro: function () { posterCap.classList.add('on'); },
  };
})();
</script>
<script type="module" src="/src/app.js"></script>
</body>
</html>`);

/* ---------- 2. 静态服务 ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
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

/* ---------- 3. 起浏览器 ---------- */

const { chromium } = loadPlaywright();
const exe = findChrome();
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  // headless 默认没有 GPU，WebGL 会直接创建失败。swiftshader 是软件光栅，
  // 慢一点但跨机器结果一致，正合逐帧渲染的需求。
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox',
  ],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1440 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text().slice(0, 200)); });

await page.goto(`http://127.0.0.1:${PORT}/record.html`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__panda && !!window.__recUI, null, { timeout: 20000 });
await page.evaluate(() => document.fonts.ready);

/* 直接用 CDP 截图：page.screenshot 会等一帧稳定的合成结果，
 * 而 rAF 已经被接管，它等不到，于是超时。CDP 是一次同步取帧。 */
const cdp = await page.context().newCDPSession(page);
// 1.5 倍渲染、最后缩回 1080：应用里的字和 3D 边缘才不糊。
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1080, height: 1440, deviceScaleFactor: 1.5, mobile: false,
});
// 把动画时间轴按死在 0，交给 clock.js 按虚拟时间推（见文件头注释）
await cdp.send('Animation.enable');
await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });

async function shoot(file) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'jpeg', quality: 96, captureBeyondViewport: false,
  });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

/* ---------- 4. 准备素材 ---------- */

console.log(`准备素材：载入照片 + 切 ${START_COLS}×${START_ROWS} …`);

/** 应用里有些 await 要等 rAF（材质烘焙分批让帧）。虚拟时钟不主动推进就永远等不到，
 *  所以等异步操作时要一边 step 一边让真实时间过去。 */
async function pump(fnBody, timeoutMs = 180000) {
  const ok = await page.evaluate(async ({ src, timeoutMs }) => {
    let done = false;
    let err = null;
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

/** 等一个状态成立，同时把虚拟时钟推着走（生成拼图要用） */
async function waitFor(condSrc, timeoutMs = 240000) {
  const ok = await page.evaluate(async ({ src, timeoutMs }) => {
    const cond = new Function('return (' + src + ')')();
    const t0 = window.__real.now();
    while (!cond() && window.__real.now() - t0 < timeoutMs) {
      window.__clock.step(1000 / 30);
      await new Promise((r) => window.__real.setTimeout(r, 2));
    }
    return !!cond();
  }, { src: condSrc, timeoutMs });
  if (!ok) throw new Error('等待超时：' + condSrc.slice(0, 70));
}

/** 让所有动画走完，再清掉彩纸（补完整画面时用，避免片头先放礼花） */
async function settle(seconds = 3.4) {
  await page.evaluate((s) => {
    const n = Math.round((s * 1000) / (1000 / 30));
    for (let i = 0; i < n; i++) window.__clock.step(1000 / 30);
  }, seconds);
  await page.evaluate(() => {
    const c = document.querySelector('.confetti-layer');
    if (c) c.remove();
  });
}

await pump(`() => window.__panda.load("/assets/demo-photo.jpg", ${START_COLS}, ${START_ROWS})`);
// 片头要一张「已经拼好」的完整照片
await page.evaluate(() => window.__panda.solve());
await settle(3.4);

/* ---------- 5. 逐帧渲染 ---------- */

const round = Math.round(FPS * DURATION);
const total = round;
const previewFrames = new Set(
  [0.7, 2.1, 3.7, 4.4, 5.2, 6.2, 8.8, 10.7, 12.4, 14.7, 16.1, 17.8].map(t => Math.round(t * FPS))
);

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const fired = new Set();
let posterData = '';
let rotId = null;

/** 相机：全程 90° 正俯视，只有极轻的推近，不倾斜 */
function easeOut(k) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3); }
function zoomAt(t) {
  // 片头缓缓推近，别让前 2.5s 像一张静止图；1.06 是拼图不裁边的上限
  if (t < 2.5) return 1 + 0.06 * easeOut(t / 2.5);
  // 面板打开时保持推近（背景被压暗），等换完图硬切再回 1
  if (t < CUES.apply) return 1.06;
  if (t < 13.4) return 1;
  if (t < 15.4) return 1 + 0.02 * ((t - 13.4) / 2);
  return 1.02 + 0.028 * Math.min(1, (t - 15.4) / 1.1);
}

console.log(`渲染 ${total} 帧（${DURATION}s @ ${FPS}fps）…`);
for (let f = 0; f < total; f++) {
  const t = f / FPS;

  /* ---- 分镜动作 ---- */
  if (t >= CUES.sheet && !fired.has('sheet')) {
    fired.add('sheet');
    await page.evaluate(() => window.__recUI.tap('#settingsBtn'));
  }
  // 面板打开后依次加行列：4×6 → 6×8
  for (let i = 0; i < CUES.steppers.length; i++) {
    if (t >= CUES.steppers[i] && !fired.has('step' + i)) {
      fired.add('step' + i);
      await page.evaluate((sel) => window.__recUI.tap(sel), STEP_ACTIONS[i]);
    }
  }
  if (t >= CUES.apply && !fired.has('apply')) {
    fired.add('apply');
    await page.evaluate(() => window.__recUI.tap('#applyGridBtn'));
    // 必须等到 renderTray 建出 48 个缩略图：puzzle 一赋值 cols/rows 就变了，
    // 但 rebuildScene 还在烘材质，这时候 solve 会撞上半成品（画面是一块空白板）
    await waitFor(`() => document.querySelectorAll('.piece-thumb').length === ${COLS * ROWS}`);
    // 生成完直接补成完整画面；下一帧从这里整幅收回托盘
    await page.evaluate(() => window.__panda.solve());
    await settle(3.4);
  }
  if (t >= CUES.scatter && !fired.has('scatter')) {
    fired.add('scatter');
    await page.evaluate(() => window.__panda.scatterAll());
  }
  if (t >= CUES.select1 && !fired.has('select1')) {
    fired.add('select1');
    rotId = await page.evaluate(() => window.__recUI.tapFirstPiece());
  }
  if (t >= CUES.rotate && !fired.has('rotate')) {
    fired.add('rotate');
    await page.evaluate(() => window.__recUI.tap('#rotateBtn'));
  }
  if (t >= CUES.place && !fired.has('place')) {
    fired.add('place');
    if (rotId != null) await page.evaluate((id) => window.__panda.place(id), rotId);
  }
  if (t >= CUES.select2 && !fired.has('select2')) {
    fired.add('select2');
    await page.evaluate(() => window.__recUI.tapFirstPiece());
  }
  if (t >= CUES.hint && !fired.has('hint')) {
    fired.add('hint');
    await page.evaluate(() => window.__recUI.tap('#hintBtn'));
  }
  if (t >= CUES.hintOff && !fired.has('hintOff')) {
    fired.add('hintOff');
    await page.evaluate(() => window.__recUI.tap('#hintBtn'));
  }
  if (t >= CUES.shuffleTray && !fired.has('tray')) {
    fired.add('tray');
    await page.evaluate(() => window.__recUI.tap('#scatterBtn'));
  }
  if (t >= CUES.reveal && !fired.has('reveal')) {
    fired.add('reveal');
    await page.evaluate(() => window.__recUI.tap('#solveBtn'));
  }
  if (t >= CUES.save && !fired.has('save')) {
    fired.add('save');
    await page.evaluate(() => window.__recUI.tapOnly('#saveBtn'));
    posterData = await page.evaluate(() => window.__panda.poster());
  }
  if (t >= CUES.poster && !fired.has('poster')) {
    fired.add('poster');
    if (posterData) await page.evaluate((src) => window.__recUI.poster(src), posterData);
    else console.error('成品图为空，跳过结尾');
  }
  if (t >= CUES.outro && !fired.has('outro')) {
    fired.add('outro');
    await page.evaluate(() => window.__recUI.outro());
  }

  /* ---- 字幕标注 ---- */
  for (let i = 0; i < BEATS.length; i++) {
    const b = BEATS[i];
    if (t >= b.at && !fired.has('b' + i)) {
      fired.add('b' + i);
      await page.evaluate((cfg) => window.__recUI.callout(cfg), b);
    }
    if (t >= b.end && !fired.has('e' + i)) {
      fired.add('e' + i);
      await page.evaluate(() => window.__recUI.hide());
    }
  }

  /* ---- 相机 → 推进一帧 → 等合成 → 截图 ---- */
  await page.evaluate((z) => window.__panda.orbit(90, z, 0, 0), zoomAt(t));
  await page.evaluate(() => window.__clock.step(1000 / 30));
  /* rAF 被接管后浏览器的合成器不会自己出帧。两次真实 rAF 再等一小段：
   * 彩纸是独立的 2D canvas 图层，只等一帧时它有时还没提交，截图里会整层消失。 */
  await page.evaluate(() => new Promise((r) => {
    window.__real.raf(() => window.__real.raf(() => window.__real.setTimeout(r, 14)));
  }));

  if (PREVIEW) {
    if (!previewFrames.has(f)) continue;
    const p = path.join(OUT, `preview-${String(f).padStart(4, '0')}.jpg`);
    await shoot(p);
    console.log('  ✓', path.basename(p), `t=${t.toFixed(2)}s`);
  } else {
    await shoot(path.join(FRAMES, `f${String(f).padStart(4, '0')}.jpg`));
    if (f % 30 === 0) process.stdout.write(`\r  ${f}/${total}`);
  }
}
process.stdout.write('\n');

await browser.close();
server.close();

if (PREVIEW) {
  console.log('预览帧已输出到 promo/out/');
  process.exit(0);
}

/* ---------- 6. 音轨 + 编码 ---------- */

console.log('合成音轨 …');
spawnSync(process.execPath, [path.join(__dirname, 'audio.mjs')], { stdio: 'inherit' });

const mp4 = path.join(OUT, 'panda-puzzle-xhs.mp4');
console.log('编码 mp4 …');
// 这台机器上的 ffmpeg（Downie 自带）没有 libx264，用 VideoToolbox 硬件编码；
// JPEG 输入是全色域，必须显式 format=yuv420p，否则出来是 yuvj420p。
const r = spawnSync(FFMPEG, [
  '-y',
  '-framerate', String(FPS),
  '-i', path.join(FRAMES, 'f%04d.jpg'),
  '-i', path.join(OUT, 'audio.wav'),
  '-vf', 'scale=1080:1440:flags=lanczos,format=yuv420p',
  '-color_range', 'tv',
  '-c:v', 'h264_videotoolbox', '-b:v', '12M', '-maxrate', '16M', '-bufsize', '24M',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart',
  mp4,
], { stdio: 'inherit' });

if (r.status !== 0) {
  console.error('ffmpeg 失败');
  process.exit(1);
}
console.log(`\n✓ ${path.relative(process.cwd(), mp4)}  ${(fs.statSync(mp4).size / 1024 / 1024).toFixed(1)} MB`);
fs.rmSync(FRAMES, { recursive: true, force: true });
