/**
 * 宣传片音轨 —— 全部现场合成，不引任何现成音频。
 *
 * 只有音效，没有背景音乐：落位、旋转、打散、揭晓、撒花、保存快门、按钮点击。
 * 为什么不用产品里的 WebAudio：headless 录不到声音，而且这里要按分镜精确
 * 对齐（落位音跟着拼块走）。所以用同一套声音设计在 Node 里重算一遍，直接混成 wav。
 *
 *   node promo/audio.mjs   # 生成 promo/out/audio.wav
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DURATION, CUES } from './timeline.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;

/* ---------- 工具 ---------- */

/** 固定种子的伪随机：每次生成的声音一致，便于反复出片 */
let seed = 20261018;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

const N = Math.ceil(SR * DURATION);
const mixL = new Float32Array(N);
const mixR = new Float32Array(N);

function addSample(i, v, pan) {
  if (i < 0 || i >= N) return;
  const p = pan == null ? 0.5 : pan;
  mixL[i] += v * Math.sqrt(1 - p);
  mixR[i] += v * Math.sqrt(p);
}

/** RBJ 带通 / 高通 / 低通 */
function makeFilter(type, freq, q) {
  const w0 = (2 * Math.PI * freq) / SR;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  let b0, b1, b2;
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
  } else if (type === 'highpass') {
    b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
  } else {
    b0 = alpha; b1 = 0; b2 = -alpha;
  }
  const a0 = 1 + alpha; const a1 = -2 * cos; const a2 = 1 - alpha;
  return {
    b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0,
    x1: 0, x2: 0, y1: 0, y2: 0,
    run(x) {
      const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1; this.x1 = x;
      this.y2 = this.y1; this.y1 = y;
      return y;
    },
  };
}

function noiseBurst(at, dur, peak, freq, q, type, pan) {
  const start = Math.round(at * SR);
  const len = Math.round(dur * SR);
  const f = makeFilter(type || 'bandpass', freq, q || 1);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = t < 0.004 ? t / 0.004 : Math.exp(-(t - 0.004) * (6.9 / dur));
    addSample(start + i, f.run(rnd() * 2 - 1) * env * peak, pan);
  }
}

/** 低频「木头厚度」：频率从 f0 滑到 f0*0.62 */
function thump(at, dur, peak, f0, pan) {
  const start = Math.round(at * SR);
  const len = Math.round(dur * SR);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const freq = f0 * (1 - 0.38 * Math.min(1, t / dur));
    phase += (2 * Math.PI * freq) / SR;
    const env = t < 0.006 ? t / 0.006 : Math.exp(-(t - 0.006) * (6.9 / dur));
    addSample(start + i, Math.sin(phase) * env * peak, pan);
  }
}

function note(at, freq, dur, peak, pan, type) {
  const start = Math.round(at * SR);
  const len = Math.round(dur * SR);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * freq) / SR;
    let s = Math.sin(phase);
    if (type === 'triangle') s = (2 / Math.PI) * Math.asin(Math.sin(phase));
    const env = t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) * (6.9 / dur));
    addSample(start + i, s * env * peak, pan);
  }
}

/* ---------- 声音 ---------- */

/** 拼块落位：噪声瞬态 + 低频体，音高随进度上移 */
function placeSound(at, ratio, pan) {
  const k = 1 + ratio * 0.55;
  noiseBurst(at, 0.055, 0.80, 2300 * k, 1.1, 'bandpass', pan);
  thump(at, 0.075, 0.42, 210 * k, pan);
}

/** 一大把拼块落回托盘：疏密不均的碎响 */
function scatterSound(at, count, spread, panBase) {
  for (let i = 0; i < count; i++) {
    const t = at + spread * Math.pow(i / count, 0.72) + rnd() * 0.012;
    noiseBurst(t, 0.05, 0.34, 1500 + rnd() * 1800, 1.5, 'bandpass', 0.25 + rnd() * 0.5);
  }
  thump(at + 0.01, 0.18, 0.22, 120, panBase == null ? 0.5 : panBase);
}

/** 揭晓：噪声扫频往上，再接两个亮音 */
function revealSound(at) {
  const start = Math.round(at * SR);
  const len = Math.round(0.62 * SR);
  let lp1 = 0, lp2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const x = rnd() * 2 - 1;
    const cut = 700 + 4500 * Math.min(1, t / 0.5);
    const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp1 += a * (x - lp1);
    lp2 += a * (lp1 - lp2);
    const env = t < 0.12 ? t / 0.12 : Math.exp(-(t - 0.12) * (6.9 / 0.5));
    addSample(start + i, lp2 * env * 0.22, 0.5);
  }
  note(at + 0.46, 784, 0.28, 0.18, 0.42, 'triangle');
  note(at + 0.52, 1046, 0.34, 0.14, 0.58, 'triangle');
}

/** 撒花三音 */
function winSound(at) {
  note(at, 660, 0.16, 0.20, 0.45, 'triangle');
  note(at + 0.09, 880, 0.16, 0.20, 0.5, 'triangle');
  note(at + 0.18, 1174, 0.32, 0.17, 0.55, 'triangle');
  noiseBurst(at + 0.17, 0.10, 0.16, 4200, 1.0, 'highpass', 0.5);
}

/** 界面点击：极短的高频「哒」 */
function click(at, gain, freq) {
  noiseBurst(at, 0.018, gain, 3400, 1.1, 'highpass', 0.5);
  note(at, freq || 1600, 0.04, gain * 0.18, 0.5, 'triangle');
}

/** 旋转拼块：一下干一点的「嗒」 */
function tick(at, gain) {
  noiseBurst(at, 0.022, gain, 2400, 2.4, 'bandpass', 0.55);
  note(at, 880, 0.05, gain * 0.28, 0.55, 'triangle');
}

/** 提示开启：两个上行的亮音（是音效，不是旋律） */
function chime(at) {
  note(at, 880, 0.15, 0.15, 0.48, 'triangle');
  note(at + 0.085, 1320, 0.2, 0.12, 0.55, 'triangle');
  noiseBurst(at, 0.03, 0.06, 5200, 1.0, 'highpass', 0.5);
}

/** 保存快门：两下很轻的咔哒 */
function shutter(at) {
  noiseBurst(at, 0.028, 0.24, 2400, 1.2, 'highpass', 0.5);
  noiseBurst(at + 0.06, 0.05, 0.16, 1400, 1.6, 'bandpass', 0.5);
}

/** 成品图推上来：一段很轻的上行气流 */
function swell(at) {
  const start = Math.round(at * SR);
  const len = Math.round(0.55 * SR);
  let lp1 = 0, lp2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const k = Math.min(1, t / 0.42);
    const cut = 500 + 3800 * k;
    const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
    lp1 += a * (rnd() * 2 - 1 - lp1);
    lp2 += a * (lp1 - lp2);
    const env = Math.sin(Math.PI * Math.min(1, t / 0.5)) * (1 - k * 0.2);
    addSample(start + i, lp2 * env * 0.10, 0.5);
  }
}

/* ---------- 排一遍 ---------- */

// 打开设置面板 + 四次行列加减
click(CUES.sheet, 0.18, 1450);
thump(CUES.sheet + 0.01, 0.12, 0.10, 150);
CUES.steppers.forEach((at, i) => click(at, 0.15, 1500 + i * 90));
// 开始拼图
click(CUES.apply, 0.20, 1300);
// 整幅收回托盘
scatterSound(CUES.scatter, 26, 0.62, 0.5);
// 选块 / 旋转 / 落位
click(CUES.select1, 0.13, 1700);
tick(CUES.rotate, 0.24);
placeSound(CUES.land, 0.45, 0.44);
// 选第二块 + 提示
click(CUES.select2, 0.13, 1700);
chime(CUES.hint);
// 关掉提示（再点一下）
click(CUES.hintOff, 0.12, 1500);
// 打散
click(CUES.shuffleTray, 0.15, 1500);
scatterSound(CUES.shuffleTray + 0.02, 10, 0.26, 0.55);
// 揭晓 + 撒花
click(CUES.reveal, 0.16, 1400);
revealSound(CUES.reveal);
winSound(CUES.win);
// 保存 + 成品图
shutter(CUES.save);
swell(CUES.poster);

/* ---------- 归一化 + 限幅 ---------- */

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
const gain = peak > 0 ? 1 / peak : 1;
for (let i = 0; i < N; i++) {
  mixL[i] = Math.tanh(mixL[i] * gain * 1.15);
  mixR[i] = Math.tanh(mixR[i] * gain * 1.15);
}
// 软限幅会吃掉峰值，再来一遍归一化，把最高点顶到 -1dBFS
let peak2 = 0;
for (let i = 0; i < N; i++) peak2 = Math.max(peak2, Math.abs(mixL[i]), Math.abs(mixR[i]));
const gain2 = peak2 > 0 ? 0.89 / peak2 : 1;
for (let i = 0; i < N; i++) {
  mixL[i] *= gain2;
  mixR[i] *= gain2;
}

/* ---------- 写 wav ---------- */

function wav(l, r) {
  const n = l.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);          // PCM
  buf.writeUInt16LE(2, 22);          // 立体声
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767))), o);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767))), o + 2);
    o += 4;
  }
  return buf;
}

const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'audio.wav');
fs.writeFileSync(file, wav(mixL, mixR));
console.log(`✓ audio.wav  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  ${DURATION}s`);
