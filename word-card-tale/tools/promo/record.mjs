#!/usr/bin/env node
/**
 * 词卡物语 · 宣传片自动录制
 *
 *   node build.mjs                 # 先产出 dist/promo
 *   node record.mjs                # 录全部镜头
 *   node record.mjs draw battle    # 只录指定镜头
 *   HEADED=1 node record.mjs       # 用可见窗口（GPU 更好，会闪窗）
 *
 * 产物：out/raw/*.webm（无声素材）+ out/clips/*.mp4（已混入音效）
 * 每个镜头结尾都多留了 2~3 秒空镜，方便剪辑。
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const site = path.join(root, 'dist/promo');
const outRaw = path.join(here, 'out/raw');
const outClips = path.join(here, 'out/clips');
const HEADED = !!process.env.HEADED;
const W = 540, H = 960, SCALE = 2;

if (!fs.existsSync(path.join(site, 'app.js'))) {
  console.error('缺少 dist/promo，先运行：node tools/promo/build.mjs');
  process.exit(1);
}
fs.mkdirSync(outRaw, { recursive: true });
fs.mkdirSync(outClips, { recursive: true });

/* ── 静态服务 ─────────────────────────────── */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(site, rel);
  if (!file.startsWith(site) || !fs.existsSync(file)) { res.writeHead(404).end('nope'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/index.html?demo`;

/* ── 页面注入：触摸指示器 + 音轨抓取 ───────── */
const INIT = `
(() => {
  const flags = window.__PROMO_FLAGS || {};
  for (const k in flags) window[k] = flags[k];

  // 触摸指示器：录屏里能看出点了哪里
  const css = '.promo-tap{position:fixed;z-index:2147483647;width:68px;height:68px;margin:-34px 0 0 -34px;border-radius:50%;pointer-events:none;'
    + 'background:radial-gradient(circle,rgba(255,255,255,.55) 0,rgba(255,255,255,.28) 42%,rgba(255,255,255,0) 70%);'
    + 'box-shadow:0 0 0 2px rgba(255,255,255,.35) inset;animation:promoTap .42s ease-out forwards}'
    + '@keyframes promoTap{0%{transform:scale(.45);opacity:1}100%{transform:scale(1.5);opacity:0}}';
  const inject = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
  if (document.head) inject(); else document.addEventListener('DOMContentLoaded', inject);
  window.addEventListener('pointerdown', (e) => {
    const d = document.createElement('div');
    d.className = 'promo-tap';
    d.style.left = e.clientX + 'px';
    d.style.top = e.clientY + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 460);
  }, true);

  // 音效抓取：把最终汇入 destination 的节点同时接到 MediaStreamDestination
  const Orig = window.AudioContext || window.webkitAudioContext;
  let shared = null, rec = null;
  const chunks = [];
  function arm(ctx) {
    try {
      const dest = ctx.createMediaStreamDestination();
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (target, ...rest) {
        const r = connect.call(this, target, ...rest);
        if (target === ctx.destination) { try { connect.call(this, dest); } catch (e) {} }
        return r;
      };
      rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start(500);
      window.__AUDIO_T0 = Date.now();
    } catch (e) { rec = null; }
  }
  function Ctor(...args) { if (!shared) { shared = new Orig(...args); arm(shared); } return shared; }
  window.AudioContext = Ctor;
  window.webkitAudioContext = Ctor;
  document.addEventListener('DOMContentLoaded', () => { try { new Ctor(); shared && shared.resume(); } catch (e) {} });

  window.__stopAudio = () => new Promise((res) => {
    if (!rec || rec.state === 'inactive') return res('');
    rec.onstop = async () => {
      const buf = await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer();
      const b = new Uint8Array(buf);
      let s = '';
      for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
      res(btoa(s));
    };
    rec.stop();
  });
})();
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 段内工具 ─────────────────────────────── */
const sel = {
  theme: (id) => `.draw-theme[data-theme="${id}"]`,
  pile: '.pile-card',
  capKey: (i) => `.cap-key[data-ki="${i}"]`,
  tab: (id) => `.tab[data-tab="${id}"]`,
  bookCard: '#grid .book-card',
  mapNode: '#expMap .sm-node',
};

/** CDP 逐帧抓取（Playwright 自带录像在本机会输出白屏，改用 screencast） */
async function cast(page, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (e) => {
    const i = frames.length;
    const file = path.join(dir, `${String(i).padStart(5, '0')}.jpg`);
    try { fs.writeFileSync(file, Buffer.from(e.data, 'base64')); } catch (err) { return; }
    frames.push({ t: Date.now(), file });
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg', quality: 90, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1,
  });
  return { frames, stop: () => cdp.send('Page.stopScreencast').catch(() => {}) };
}

async function open(browser, flags, tag) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(`window.__PROMO_FLAGS = ${JSON.stringify(flags || {})};`);
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  [page] ${e.message}`));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#drawThemes .draw-theme'));
  await sleep(700);
  const c = await cast(page, path.join(outRaw, tag));
  const audioT0 = await page.evaluate(() => window.__AUDIO_T0 || 0);   // 与 node 同一时钟
  return { ctx, page, tag, cast: c, castT0: Date.now(), audioT0 };
}

async function finish(sess, ms) {
  const { ctx, page, tag, cast: c, castT0, audioT0 } = sess;
  await sleep(ms);
  const endT = Date.now();                 // 真实收尾时刻，尾部静止画面也按它补齐时长
  let audio = '';
  try { audio = await page.evaluate(() => window.__stopAudio()); } catch (e) { console.error('  录音失败', e.message); }
  await c.stop();
  await sleep(250);
  await ctx.close();

  if (!audio) console.log(`  注意：${tag} 没有录到音效`);

  if (!c.frames.length) { console.error(`✗ ${tag} 没有抓到帧`); return; }

  // 每帧按「到下一帧的间隔」给时长；首帧从抓帧开始那一刻算起，
  // 这样画面静止时（screencast 不发帧）也不会把时间轴压短
  const list = path.join(outRaw, `${tag}.txt`);
  const lines = [];
  for (let i = 0; i < c.frames.length; i++) {
    const from = i === 0 ? castT0 : c.frames[i].t;
    const next = i + 1 < c.frames.length ? c.frames[i + 1].t : endT;
    const d = Math.max(0.008, (next - from) / 1000);
    lines.push(`file '${c.frames[i].file}'`, `duration ${d.toFixed(4)}`);
  }
  lines.push(`file '${c.frames[c.frames.length - 1].file}'`);
  fs.writeFileSync(list, lines.join('\n'));

  let rawA = '';
  if (audio) {
    rawA = path.join(outRaw, `${tag}.audio.webm`);
    fs.writeFileSync(rawA, Buffer.from(audio, 'base64'));
  }
  const mp4 = path.join(outClips, `${tag}.mp4`);
  const dur = (endT - castT0) / 1000 + 0.04;
  const tmpV = path.join(outRaw, `${tag}.silent.mp4`);

  // 先单独编码画面（单输入最稳），再单独混入音轨
  const vArgs = ['-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', 'scale=1080:1920:flags=lanczos,unsharp=5:5:0.8:5:5:0,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-t', dur.toFixed(3), tmpV];
  let r = spawnSync('ffmpeg', vArgs, { stdio: 'pipe' });
  if (r.status !== 0) { console.error('ffmpeg 编码失败', String(r.stderr).slice(-500)); return; }

  if (rawA) {
    // 录音比抓帧早开始，裁掉头部差值，保证点击音画对齐
    const lead = Math.max(0, (castT0 - (audioT0 || castT0)) / 1000);
    const aArgs = ['-y', '-i', tmpV];
    if (lead > 0.02) aArgs.push('-ss', lead.toFixed(3));
    aArgs.push('-i', rawA, '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4);
    r = spawnSync('ffmpeg', aArgs, { stdio: 'pipe' });
    if (r.status !== 0) { console.error('ffmpeg 混音失败', String(r.stderr).slice(-400)); return; }
  } else {
    fs.renameSync(tmpV, mp4);
  }
  const sec = ((endT - castT0) / 1000).toFixed(1);
  console.log(`✓ ${tag}  ${sec}s  ${c.frames.length} 帧  →  ${path.relative(here, mp4)}`);
}

/** 按 __PROMO_WORD 把打乱的字母依次点完（可跨多轮） */
async function spell(page, { keyGap = 200 } = {}) {
  for (let round = 0; round < 3; round++) {
    const word = await page.evaluate(() => window.__PROMO_WORD || '');
    if (!word) return;
    const used = new Set();
    for (let i = 0; i < word.length; i++) {
      const idx = await page.evaluate(({ ch, taken }) => {
        for (const k of document.querySelectorAll('.cap-key')) {
          const ki = +k.dataset.ki;
          if (taken.includes(ki)) continue;
          if (k.textContent.trim().toLowerCase() === ch) return ki;
        }
        return -1;
      }, { ch: word[i], taken: [...used] });
      if (idx < 0) break;
      used.add(idx);
      await page.click(sel.capKey(idx)).catch(() => {});
      await sleep(keyGap);
    }
    await sleep(1000);
    const still = await page.$('.capw');
    if (!still) return;
    const nextWord = await page.evaluate(() => window.__PROMO_WORD || '');
    if (nextWord !== word) continue;
    // 词没变说明第一段还没结束（极少见），直接返回交给外层兜底
    return;
  }
}

/* ── 各个镜头 ─────────────────────────────── */
const shots = {
  async '01-pool'(browser) {
    const s = await open(browser, { __PROMO_TIER: 5 }, '01-pool');
    const p = s.page;
    for (const id of ['wild', 'life', 'mind', 'mood', 'all']) {
      await p.click(sel.theme(id)).catch(() => {});
      await sleep(1500);
    }
    await finish(s, 2500);           // 尾留：方便对齐下一镜
  },

  async '02-draw'(browser) {
    const s = await open(browser, { __PROMO_TIER: 5 }, '02-draw');
    const p = s.page;
    await p.click('#btnDraw');
    await p.waitForSelector(sel.pile);
    await sleep(1600);
    await p.click(`${sel.pile} >> nth=0`);
    await p.waitForSelector('.capw', { timeout: 8000 }).catch(() => {});
    await sleep(1500);               // 翻牌 + 卡面入场
    await spell(p);
    await sleep(3200);               // 收录动画
    await finish(s, 3200);
  },

  async '03-flip'(browser) {
    const s = await open(browser, { __PROMO_TIER: 5 }, '03-flip');
    const p = s.page;
    for (let group = 0; group < 2; group++) {
      await p.click('#btnDraw');
      await p.waitForSelector(sel.pile);
      await sleep(1300);
      for (let i = 0; i < 3; i++) {
        await p.click(`${sel.pile} >> nth=${i}`).catch(() => {});
        await sleep(1600);           // 只留翻牌特效
        await p.click('#capQuit').catch(() => {});
        await sleep(420);
        await p.click('#ccYes', { force: true, timeout: 1200 }).catch(() => {});
        await sleep(650);
      }
    }
    await finish(s, 2200);
  },

  async '04-detail'(browser) {
    const s = await open(browser, {}, '04-detail');
    const p = s.page;
    await p.click(sel.tab('mine'));
    await p.waitForSelector(sel.bookCard, { timeout: 8000 });
    await sleep(1400);
    await p.click(`${sel.bookCard} >> nth=0`);
    await sleep(1600);
    await p.evaluate(() => {
      const b = document.querySelector('#detail .sheet-body');
      if (b) b.scrollBy({ top: 220, behavior: 'smooth' });
    });
    await sleep(1600);
    await p.evaluate(() => {
      const b = document.querySelector('#detail .sheet-body');
      if (b) b.scrollBy({ top: 320, behavior: 'smooth' });
    });
    await finish(s, 3000);
  },

  async '05-map'(browser) {
    const s = await open(browser, {}, '05-map');
    const p = s.page;
    await p.click(sel.tab('expedition'));
    await p.waitForSelector(sel.mapNode, { timeout: 8000 }).catch(() => {});
    await sleep(1800);
    await p.click(`${sel.mapNode} >> nth=4`).catch(() => {});
    await sleep(1800);
    await p.click(`${sel.mapNode} >> nth=2`).catch(() => {});
    await finish(s, 2500);
  },

  async '06-battle-thunder'(browser) { await battleShot(browser, 'thunder', '06-battle-thunder'); },
  async '07-battle-pierce'(browser) { await battleShot(browser, 'pierce', '07-battle-pierce'); },
  async '08-battle-blade'(browser) { await battleShot(browser, 'blade', '08-battle-blade'); },

  async '09-result'(browser) {
    const s = await open(browser, { __PROMO_BOSS_AT: 18, __PROMO_BOSS_HP: 0.25, __PROMO_DIFF: 14 }, '09-result');
    await startBattle(s.page, 'thunder');
    await s.page.waitForFunction(
      () => document.querySelector('#battle-result') && document.querySelector('#battle-result').classList.contains('on'),
      null,
      { timeout: 150000 }
    );
    await sleep(1200);
    await finish(s, 5200);           // 结算数值滚动
  },

  async '10-codex'(browser) {
    const s = await open(browser, {}, '10-codex');
    const p = s.page;
    await p.click(sel.tab('mine'));
    await p.waitForSelector(sel.bookCard, { timeout: 8000 });
    await sleep(1600);
    // 分步滚动，保证每一小段都有画面变化（screencast 只在画面变化时出帧）
    for (let i = 0; i < 16; i++) {
      await p.evaluate(() => {
        const el = document.getElementById('screenMine');
        if (el) el.scrollBy({ top: 80, behavior: 'smooth' });
      });
      await sleep(240);
    }
    await sleep(700);
    await p.evaluate(() => {
      const el = document.getElementById('screenMine');
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await finish(s, 2400);
  },
};

/** 直接调 Battle.start，绕过远征选卡界面，保证指定武器 + 地标首领 */
async function startBattle(page, kind) {
  await page.evaluate((k) => {
    const full = (w) => String(w.w).split('').map(() => 6);
    const list = (window.WORDS || []).filter((w) => {
      const wk = window.Card.weaponKinds(w, full(w));
      return (w.tier || 1) >= 4 && wk.main === k;
    });
    const pick = list[0] || window.WORDS[0];
    const card = Object.assign({}, pick, { lvl: 6, cardLv: 6, hid: true });
    window.Battle.start([card], {
      stage: 4,
      region: { id: 'cusco', nm: '云巅城', place: '库斯科', need: 324 },
      codexHas: () => false,
      getOwned: () => ({}),
      viewOf: (w) => w,
      levelsOf: (w) => String(w.w).split('').map(() => 6),
      starsOf: () => 3,
      inkMul: () => 1,
      onWordSpelled: () => 0,
    });
  }, kind);
  await page.waitForSelector('#battle-stage, #battleCanvas', { timeout: 5000 }).catch(() => {});
}

async function battleShot(browser, kind, tag) {
  const s = await open(browser, { __PROMO_BOSS_AT: 22, __PROMO_BOSS_HP: 3.0, __PROMO_DIFF: 17, __PROMO_BOMBS: 3 }, tag);
  const p = s.page;
  await startBattle(p, kind);
  // 等首领真正登场，再留几秒弹幕，然后放大招
  await p.waitForFunction(() => window.__BSTATE && window.__BSTATE.boss, { timeout: 60000 }).catch(() => {});
  await sleep(4200);
  await p.evaluate(() => document.getElementById('battleBomb').click());
  await sleep(3800);
  await p.evaluate(() => document.getElementById('battleBomb').click());
  await sleep(3400);
  await finish(s, 2000);
}

/* ── 主流程 ───────────────────────────────── */
const want = process.argv.slice(2);
const browser = await chromium.launch({
  channel: HEADED ? undefined : 'chromium',
  headless: !HEADED,
  args: ['--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb', '--hide-scrollbars', '--disable-gpu'],
});

for (const [name, fn] of Object.entries(shots)) {
  if (want.length && !want.some((w) => name.includes(w))) continue;
  const t0 = Date.now();
  console.log(`▶ ${name}`);
  try { await fn(browser); }
  catch (e) { console.error(`✗ ${name}: ${e.message}`); }
  console.log(`  用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

await browser.close();
server.close();
console.log('完成 → tools/promo/out/clips');
