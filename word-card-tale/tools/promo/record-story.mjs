#!/usr/bin/env node
/**
 * 词卡物语 · 报名说明视频（故事版 v2）
 *
 *   抽卡翻 EX（短词单轮拼写）→ 漫游页 2s
 *   → 飞刃 / 激光(+大招) / 追踪（隐藏款满火力觉醒 + 刷怪）
 *   → 雷电(+大招) 斩杀 Boss → 结算 → 升级字母 → 怪物图鉴
 *
 *   node tools/promo/build.mjs && node tools/promo/record-story.mjs
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
const outRaw = path.join(here, 'out/story/raw');
const outClips = path.join(here, 'out/story/clips');
const outFinal = path.join(here, 'out/final');
const HEADED = !!process.env.HEADED;
const W = 540, H = 960, SCALE = 2;

if (!fs.existsSync(path.join(site, 'app.js'))) {
  console.error('缺少 dist/promo，先运行：node tools/promo/build.mjs');
  process.exit(1);
}
fs.mkdirSync(outRaw, { recursive: true });
fs.mkdirSync(outClips, { recursive: true });
fs.mkdirSync(outFinal, { recursive: true });

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

const INIT = `
(() => {
  const flags = window.__PROMO_FLAGS || {};
  for (const k in flags) window[k] = flags[k];

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

  const Orig = window.AudioContext || window.webkitAudioContext;
  let shared = null, dest = null, rec = null, chunks = [];
  function hook(ctx) {
    if (dest) return;
    dest = ctx.createMediaStreamDestination();
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (target, ...rest) {
      const r = connect.call(this, target, ...rest);
      if (target === ctx.destination) { try { connect.call(this, dest); } catch (e) {} }
      return r;
    };
  }
  function startRec() {
    if (!dest) return;
    try {
      if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) {} }
      chunks = [];
      rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start(100);
      window.__AUDIO_T0 = Date.now();
    } catch (e) { rec = null; }
  }
  function Ctor(...args) {
    if (!shared) { shared = new Orig(...args); hook(shared); startRec(); }
    return shared;
  }
  window.AudioContext = Ctor;
  window.webkitAudioContext = Ctor;
  document.addEventListener('DOMContentLoaded', () => { try { new Ctor(); shared && shared.resume(); } catch (e) {} });

  // 与画面同一时刻重启录音，丢掉开场前的静音，避免音画错位
  window.__restartAudio = () => new Promise((res) => {
    const go = () => { startRec(); res(window.__AUDIO_T0 || Date.now()); };
    if (rec && rec.state !== 'inactive') {
      const prev = rec;
      prev.onstop = go;
      try { prev.stop(); } catch (e) { go(); }
    } else go();
  });
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
const sel = {
  pile: '.pile-card',
  capKey: (i) => `.cap-key[data-ki="${i}"]`,
  tab: (id) => `.tab[data-tab="${id}"]`,
  bookCard: '#grid .book-card',
  mapNode: '#expMap .sm-node',
};

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
    format: 'jpeg', quality: 88, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1,
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
  await ctx.addInitScript(`window.__PROMO_FLAGS = ${JSON.stringify(Object.assign({ __PROMO_FREE: true }, flags || {}))};`);
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  [page] ${e.message}`));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#btnDraw'));
  await sleep(500);
  // 解锁 AudioContext
  await page.evaluate(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const c = new Ctx();
      return c.resume();
    } catch (e) {}
  });
  await sleep(120);
  const audioT0 = await page.evaluate(() => window.__restartAudio ? window.__restartAudio() : Date.now());
  const c = await cast(page, path.join(outRaw, tag));
  const castT0 = Date.now();
  return { ctx, page, tag, cast: c, castT0, audioT0: await audioT0 };
}

async function finish(sess, ms) {
  const { ctx, page, tag, cast: c, castT0, audioT0 } = sess;
  await sleep(ms);
  const endT = Date.now();
  let audio = '';
  try { audio = await page.evaluate(() => window.__stopAudio()); } catch (e) { console.error('  录音失败', e.message); }
  await c.stop();
  await sleep(180);
  await ctx.close();
  if (!c.frames.length) { console.error(`✗ ${tag} 没有抓到帧`); return null; }

  const list = path.join(outRaw, `${tag}.txt`);
  const lines = [];
  for (let i = 0; i < c.frames.length; i++) {
    const from = i === 0 ? castT0 : c.frames[i].t;
    const next = i + 1 < c.frames.length ? c.frames[i + 1].t : endT;
    lines.push(`file '${c.frames[i].file}'`, `duration ${Math.max(0.008, (next - from) / 1000).toFixed(4)}`);
  }
  lines.push(`file '${c.frames[c.frames.length - 1].file}'`);
  fs.writeFileSync(list, lines.join('\n'));

  const dur = (endT - castT0) / 1000 + 0.04;
  const tmpV = path.join(outRaw, `${tag}.silent.mp4`);
  const mp4 = path.join(outClips, `${tag}.mp4`);
  let r = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', 'scale=1080:1920:flags=lanczos,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-t', dur.toFixed(3), tmpV], { stdio: 'pipe' });
  if (r.status !== 0) { console.error('ffmpeg 编码失败', String(r.stderr).slice(-500)); return null; }

  if (audio) {
    const rawA = path.join(outRaw, `${tag}.audio.webm`);
    fs.writeFileSync(rawA, Buffer.from(audio, 'base64'));
    // 录音在画面前启动的差值；再用 -itsoffset 微调（音效链路约 40ms 延迟）
    const lead = Math.max(0, (castT0 - (audioT0 || castT0)) / 1000);
    const aArgs = ['-y', '-i', tmpV];
    if (lead > 0.01) aArgs.push('-ss', lead.toFixed(3));
    aArgs.push('-itsoffset', '-0.05', '-i', rawA,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
      '-t', dur.toFixed(3), '-movflags', '+faststart', mp4);
    r = spawnSync('ffmpeg', aArgs, { stdio: 'pipe' });
    if (r.status !== 0) {
      console.error('混音失败，保留无声', String(r.stderr).slice(-280));
      fs.renameSync(tmpV, mp4);
    }
  } else {
    fs.renameSync(tmpV, mp4);
  }
  console.log(`✓ ${tag}  ${dur.toFixed(1)}s  ${c.frames.length} 帧`);
  return mp4;
}

async function spellOnce(page) {
  await page.waitForFunction(() => !!(window.__PROMO_WORD), { timeout: 5000 }).catch(() => {});
  // beginRound 会去掉 teasing；此时拼写面板才真正可点
  await page.waitForFunction(() => {
    const root = document.querySelector('.capw');
    const keys = document.querySelectorAll('.cap-key');
    return root && !root.classList.contains('teasing') && keys.length > 0;
  }, { timeout: 12000 }).catch(() => {});
  await sleep(400);
  const info = await page.evaluate(() => ({ w: window.__PROMO_WORD || '', r: window.__PROMO_ROUNDS || 0 }));
  if (!info.w) return;
  console.log(`  拼写「${info.w}」 ${info.w.length} 字母 · ${info.r || 1} 轮`);
  const used = new Set();
  for (let i = 0; i < info.w.length; i++) {
    const idx = await page.evaluate(({ ch, taken }) => {
      for (const k of document.querySelectorAll('.cap-key')) {
        const ki = +k.dataset.ki;
        if (taken.includes(ki)) continue;
        if (k.classList.contains('used')) continue;
        if (k.textContent.trim().toLowerCase() === ch) return ki;
      }
      return -1;
    }, { ch: info.w[i], taken: [...used] });
    if (idx < 0) {
      console.log(`  字母 ${info.w[i]} 未找到，中断`);
      break;
    }
    used.add(idx);
    await page.click(sel.capKey(idx)).catch(() => {});
    await sleep(260);
  }
  // 等收服结算动画
  await page.waitForSelector('.cap-toast.on, .cap-toast.show, .capw.closing', { timeout: 6000 }).catch(() => {});
  await sleep(1800);
}

async function startBattle(page, kind) {
  const picked = await page.evaluate((k) => {
    const full = (w) => String(w.w).split('').map(() => 6);
    // 飞刃等武器在 UR 池可能没有，降到 SSR/SR；画面仍强制 EX 隐藏款
    let list = (window.WORDS || []).filter((w) => {
      const wk = window.Card.weaponKinds(w, full(w));
      return (w.tier || 1) >= 4 && wk.main === k && w.w.length <= 10;
    });
    list.sort((a, b) => (b.tier || 1) - (a.tier || 1) || a.w.length - b.w.length);
    const pick = list[0];
    if (!pick) return null;
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
    return { w: pick.w, kind: window.Card.weaponKinds(pick, full(pick)).main };
  }, kind);
  console.log(`  出战 ${kind} →`, picked);
  await page.waitForFunction(() => window.__BSTATE && window.__BSTATE.card, { timeout: 5000 });
  await page.evaluate(() => {
    const s = window.__BSTATE;
    if (!s) return;
    if (s.card && s.card.fx) s.power = s.card.fx.maxP || 5;
    s.awaken = s.awakenMax = 14;
    s.bombs = Math.max(s.bombs || 0, 2);
    // 跳过开场空窗，直接进入密集刷怪时段
    s.t = Math.max(s.t || 0, 8);
    s.level = Math.max(s.level || 1, 3);
  });
  await sleep(250);
}

const BATTLE_FLAGS = {
  __PROMO_DIFF: 17,
  __PROMO_BOSS_AT: 99,
  __PROMO_BOMBS: 3,
  __PROMO_MAX_POWER: true,
  __PROMO_AWAKEN: 14,
  __PROMO_SWARM: true,
};

const shots = {
  async '01-capture'(browser) {
    const s = await open(browser, {
      __PROMO_TIER: 5, __PROMO_HID: true, __PROMO_SHORT_HID: true, __PROMO_ONE_ROUND: true,
      __PROMO_FORCE_WORD: 'hiraeth', // 7 字母 UR，单轮可拼完
    }, '01-capture');
    const p = s.page;
    await sleep(800); // 主界面
    await p.click('#btnDraw');
    await p.waitForSelector(sel.pile, { timeout: 8000 });
    await sleep(1200); // 三张牌落位
    await p.click(`${sel.pile} >> nth=0`);
    await p.waitForSelector('.capw.open, .capw', { timeout: 10000 });
    await sleep(600);
    // 点卡跳过悬念，直接翻面（完整翻牌 + 拼写都会留下）
    await p.click('.cap-card').catch(() => {});
    await p.waitForFunction(() => {
      const el = document.querySelector('.capw');
      return el && !el.classList.contains('teasing') && !el.classList.contains('tease-cap');
    }, { timeout: 6000 }).catch(() => {});
    await sleep(800); // 翻面动画 + 卡面入场
    await spellOnce(p);
    await finish(s, 1200);
  },

  async '02-map'(browser) {
    const s = await open(browser, {}, '02-map');
    const p = s.page;
    await p.click(sel.tab('expedition'));
    await p.waitForSelector(sel.mapNode, { timeout: 8000 }).catch(() => {});
    await sleep(900);
    await p.click(`${sel.mapNode} >> nth=4`).catch(() => {});
    await finish(s, 1600); // 合计约 2.5s 漫游页
  },

  async '03-blade'(browser) {
    const s = await open(browser, BATTLE_FLAGS, '03-blade');
    await startBattle(s.page, 'blade');
    await finish(s, 2600);
  },

  async '04-pierce'(browser) {
    const s = await open(browser, BATTLE_FLAGS, '04-pierce');
    await startBattle(s.page, 'pierce');
    await finish(s, 2800); // 激光普攻，不大招
  },

  async '05-swift'(browser) {
    const s = await open(browser, BATTLE_FLAGS, '05-swift');
    await startBattle(s.page, 'swift');
    await finish(s, 2600);
  },

  async '06-thunder-boss'(browser) {
    const s = await open(browser, {
      ...BATTLE_FLAGS,
      __PROMO_BOSS_AT: 3,
      __PROMO_BOSS_HP: 0.04,
    }, '06-thunder-boss');
    const p = s.page;
    await startBattle(p, 'thunder');
    await sleep(1000);
    await p.evaluate(() => { const b = document.getElementById('battleBomb'); if (b) b.click(); });
    await p.waitForFunction(() => window.__BSTATE && window.__BSTATE.boss, { timeout: 12000 }).catch(() => {});
    await sleep(500);
    await p.evaluate(() => {
      const b = document.getElementById('battleBomb');
      if (b) b.click();
      const st = window.__BSTATE;
      if (st && st.boss) st.boss.hp = Math.min(st.boss.hp, st.boss.maxHp * 0.02);
    });
    await p.waitForFunction(
      () => document.querySelector('#battle-result') && document.querySelector('#battle-result').classList.contains('on'),
      null, { timeout: 15000 },
    ).catch(() => {});
    // 若仍未结算，强制结束
    await p.evaluate(() => {
      const st = window.__BSTATE;
      if (st && st.boss) st.boss.hp = 0;
    });
    await sleep(600);
    await finish(s, 3200);
  },

  async '07-upgrade'(browser) {
    const s = await open(browser, {}, '07-upgrade');
    const p = s.page;
    await p.click(sel.tab('mine'));
    await p.waitForSelector(sel.bookCard, { timeout: 8000 });
    await sleep(800);
    await p.evaluate(() => {
      const cards = [...document.querySelectorAll('#grid .book-card')];
      const hid = cards.find((c) => /EX|隐藏/.test(c.textContent || '')) || cards[0];
      if (hid) hid.click();
    });
    // 只展示卡面详情，不滑动
    await finish(s, 2800);
  },

  async '08-monsters'(browser) {
    const s = await open(browser, {}, '08-monsters');
    const p = s.page;
    await p.click(sel.tab('mine'));
    await sleep(600);
    await p.evaluate(() => {
      const m = [...document.querySelectorAll('button.btab')].find((b) => b.textContent.includes('怪物'));
      if (m) m.click();
    });
    await sleep(900);
    for (let i = 0; i < 6; i++) {
      await p.evaluate(() => {
        const el = document.getElementById('screenMine') || document.getElementById('mcodex');
        if (el) el.scrollBy({ top: 110, behavior: 'smooth' });
      });
      await sleep(240);
    }
    await sleep(400);
    await p.evaluate(() => {
      const cell = document.querySelector('.mc-cell.got') || document.querySelector('.mc-cell');
      if (cell) cell.click();
    });
    await p.waitForSelector('.monster-detail.open, #mineSheet.open', { timeout: 3000 }).catch(() => {});
    await finish(s, 2200);
  },
};

function assemble(order) {
  const norm = [];
  for (const name of order) {
    const f = path.join(outClips, `${name}.mp4`);
    if (!fs.existsSync(f)) continue;
    const out = path.join(outClips, `${name}.norm.mp4`);
    const hasA = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
    const args = hasA
      ? ['-y', '-i', f, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '1', out]
      : ['-y', '-i', f, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-ar', '44100', '-ac', '1', out];
    spawnSync('ffmpeg', args, { stdio: 'pipe' });
    if (fs.existsSync(out)) norm.push(out);
  }
  const list = path.join(outClips, 'story-list.txt');
  fs.writeFileSync(list, norm.map((f) => `file '${f}'`).join('\n'));
  const finalPath = path.join(outFinal, '词卡物语-玩法说明.mp4');
  let r = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', finalPath], { stdio: 'pipe' });
  if (r.status !== 0) { console.error('拼接失败', String(r.stderr).slice(-500)); return null; }
  if (fs.statSync(finalPath).size > 18 * 1024 * 1024) {
    const slim = finalPath + '.slim.mp4';
    spawnSync('ffmpeg', ['-y', '-i', finalPath, '-c:v', 'libx264', '-preset', 'medium', '-crf', '26',
      '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', slim], { stdio: 'pipe' });
    if (fs.existsSync(slim)) fs.renameSync(slim, finalPath);
  }
  console.log('成片 →', finalPath);
  console.log(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=noprint_wrappers=1', finalPath], { encoding: 'utf8' }).stdout);
  try { fs.copyFileSync(finalPath, path.join(site, '词卡物语-玩法说明.mp4')); } catch (e) {}
  return finalPath;
}

const want = process.argv.slice(2);
const browser = await chromium.launch({
  channel: HEADED ? undefined : 'chromium',
  headless: !HEADED,
  args: ['--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb', '--hide-scrollbars', '--disable-gpu'],
});

for (const [name, fn] of Object.entries(shots)) {
  if (want.length && !want.some((w) => name.includes(w) || w === 'assemble')) continue;
  if (want.includes('assemble') && !want.some((w) => name.includes(w))) continue;
  const t0 = Date.now();
  console.log(`▶ ${name}`);
  try { await fn(browser); }
  catch (e) { console.error(`✗ ${name}:`, e.message); }
  console.log(`  用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close();
server.close();

const order = ['01-capture', '02-map', '03-blade', '04-pierce', '05-swift', '06-thunder-boss', '07-upgrade', '08-monsters'];
if (!want.length || want.includes('assemble') || want.some((w) => order.some((n) => n.includes(w)))) {
  console.log('▶ assemble');
  assemble(order);
}
console.log('完成');
