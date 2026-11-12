// 声音全部用 WebAudio 现合成：倒液体是按粘稠度变化的过滤噪声，
// 加料是“入水声”（大小、密度不同音高不同），冰块是清脆的碰撞声。
const A = {
  ctx: null, out: null, noise: null, pour: null, shake: null, ready: false,
};

export function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  const ctx = A.ctx = new C();
  A.out = ctx.createGain();
  A.out.gain.value = 0.5;
  A.out.connect(ctx.destination);
  const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  A.noise = n;
  A.ready = true;
}

const t = () => A.ctx.currentTime;
function noiseSrc() {
  const s = A.ctx.createBufferSource();
  s.buffer = A.noise; s.loop = true;
  return s;
}

// ---------- 倒液体 ----------
export function pourStart(kind, visc = 1) {
  if (!A.ready) return;
  pourStop();
  const ctx = A.ctx;
  const src = noiseSrc();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = kind === 'syrup' ? 2.4 : 1.1;
  const base = { tea: 1250, milk: 620, syrup: 280, foam: 520 }[kind] || 1000;
  bp.frequency.value = base / Math.sqrt(Math.max(1, visc * 0.6));
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = kind === 'milk' ? 2400 : 5200;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(kind === 'syrup' ? 0.07 : 0.12, t() + 0.08);
  // 咕嘟咕嘟：滤波器频率轻微抖动
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 6 + Math.random() * 4;
  lg.gain.value = base * 0.18;
  lfo.connect(lg).connect(bp.frequency);
  src.connect(bp).connect(lp).connect(g).connect(A.out);
  src.start(); lfo.start();
  A.pour = { src, g, lfo };
}
export function pourStop() {
  if (!A.pour) return;
  const { src, g, lfo } = A.pour;
  A.pour = null;
  const now = t();
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(0, now + 0.12);
  setTimeout(() => { try { src.stop(); lfo.stop(); } catch (e) { /* 已停 */ } }, 200);
}

// ---------- 加料入水 ----------
export function plop({ rho = 1, r = 0.1, vol = 0.01, speed = 1, kind = '' } = {}) {
  if (!A.ready) return;
  const ctx = A.ctx, now = t();
  const size = Math.min(1, (vol * 40) ** 0.33 * (0.5 + r));
  const amp = Math.min(0.6, 0.06 + size * 0.3) * Math.min(1.4, 0.4 + speed * 0.5);
  const f0 = (kind === 'ice' ? 1500 : 620) / (0.6 + size * 1.2);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0 * 2.2, now);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.45, now + 0.16);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(amp, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 + size * 0.2);
  osc.connect(g).connect(A.out);
  osc.start(now); osc.stop(now + 0.5);
  // 水花的“沙”一下
  const n = noiseSrc(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 1200; bp.Q.value = 0.8;
  ng.gain.setValueAtTime(amp * 0.7, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  n.connect(bp).connect(ng).connect(A.out);
  n.start(now); n.stop(now + 0.2);
  if (kind === 'ice') {
    // 冰块碰杯壁：几个不谐和的高频泛音
    for (const f of [2400, 3700, 5200]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f * (0.94 + Math.random() * 0.12);
      og.gain.setValueAtTime(amp * 0.18, now + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.09 + Math.random() * 0.06);
      o.connect(og).connect(A.out);
      o.start(now); o.stop(now + 0.2);
    }
  }
}

// ---------- 撒粉 ----------
// 一次撒一把：细碎的沙沙声（只响一次，不会每颗粉都响）
export function sprinkle() {
  if (!A.ready) return;
  const ctx = A.ctx, now = t();
  const src = noiseSrc(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(3200, now);
  bp.frequency.exponentialRampToValueAtTime(1500, now + 0.35);
  bp.Q.value = 0.7;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.05, now + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  src.connect(bp).connect(g).connect(A.out);
  src.start(now); src.stop(now + 0.45);
}

// ---------- 摇杯 ----------
export function shakeStart(dur) {
  if (!A.ready) return;
  shakeStop();
  const ctx = A.ctx;
  const src = noiseSrc(), bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9;
  hp.type = 'highpass'; hp.frequency.value = 600;
  g.gain.value = 0;
  src.connect(bp).connect(hp).connect(g).connect(A.out);
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.type = 'square'; lfo.frequency.value = 7.5;
  lg.gain.value = 0.05;
  lfo.connect(lg).connect(g.gain);
  const now = t();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.1, now + 0.08);
  g.gain.setValueAtTime(0.1, now + Math.max(0.12, dur - 0.25));
  g.gain.linearRampToValueAtTime(0, now + dur);
  src.start(); lfo.start();
  A.shake = { src, lfo };
  setTimeout(shakeStop, dur * 1000 + 60);
}
export function shakeStop() {
  if (!A.shake) return;
  const { src, lfo } = A.shake;
  A.shake = null;
  try { src.stop(); lfo.stop(); } catch (e) { /* 已停 */ }
}

// ---------- 重置 / 倒掉 ----------
export function drain() {
  if (!A.ready) return;
  const ctx = A.ctx, now = t();
  const src = noiseSrc(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, now);
  lp.frequency.exponentialRampToValueAtTime(240, now + 0.65);
  g.gain.setValueAtTime(0.14, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  src.connect(lp).connect(g).connect(A.out);
  src.start(now); src.stop(now + 0.75);
}

// 界面轻点
export function tick() {
  if (!A.ready) return;
  const ctx = A.ctx, now = t();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = 1050;
  g.gain.setValueAtTime(0.05, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  o.connect(g).connect(A.out);
  o.start(now); o.stop(now + 0.06);
}
