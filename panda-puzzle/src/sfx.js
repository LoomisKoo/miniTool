/**
 * 音效 · 全部用 WebAudio 现场合成
 *
 * 为什么不用音频文件：产物要求纯离线、单文件、无外链，加一个 wav 进去
 * 既涨体积又多一个资源路径要维护。纸板拼图的几个声音（落位、旋转、
 * 打散）都是极短的瞬态，合成出来够用，而且能按进度调音高。
 *
 * 浏览器策略：AudioContext 必须在用户手势之后创建/恢复，所以对外只暴露
 * unlock()，在第一次 pointerdown 时调一次；之后复用同一个 context。
 */

var ctx = null;
var master = null;
var noiseBuf = null;
var enabled = true;

function ensure() {
  if (ctx) return ctx;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch (e) {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  // 预生成一段白噪声：所有「咔哒 / 哗啦」都从这一份里截，不再逐次创建 buffer
  var len = Math.floor(ctx.sampleRate * 0.7);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = noiseBuf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** 拿到用户手势才能出声，由 app.js 在首次 pointerdown 时调用 */
export function unlock() {
  var c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
}

export function setEnabled(v) {
  enabled = !!v;
}

export function isEnabled() {
  return enabled;
}

/* ---------- 基础音块 ---------- */

/**
 * 一段经过滤波的噪声，带包络。
 * freq 滤波中心，q 带宽，dur 持续，peak 峰值增益，type 滤波类型
 */
function burst(freq, q, dur, peak, type, delay) {
  var c = ensure();
  if (!c || !enabled) return;
  var t0 = c.currentTime + (delay || 0);

  var src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.playbackRate.value = 1;

  var filter = c.createBiquadFilter();
  filter.type = type || 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;

  var g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** 一条正弦「木头厚度」的低频体，给噪声瞬态垫底 */
function thump(freq, dur, peak, delay) {
  var c = ensure();
  if (!c || !enabled) return;
  var t0 = c.currentTime + (delay || 0);

  var osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.62), t0 + dur);

  var g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 一个音高明确的短音，用于完成时的提示 */
function note(freq, dur, peak, delay, type) {
  var c = ensure();
  if (!c || !enabled) return;
  var t0 = c.currentTime + (delay || 0);

  var osc = c.createOscillator();
  osc.type = type || 'triangle';
  osc.frequency.value = freq;

  var g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* ---------- 事件 ---------- */

/**
 * 拼块落位。
 * ratio 是「已经拼好的比例」（0~1），音高跟着往上走，
 * 拼到最后几块时声音更亮一点，收尾有向前的推力。
 */
export function place(ratio) {
  var k = 1 + Math.min(1, Math.max(0, ratio || 0)) * 0.55;
  burst(2300 * k, 1.1, 0.055, 0.30, 'bandpass', 0);
  thump(210 * k, 0.075, 0.16, 0);
}

/** 旋转拼块：比落位轻、比落位高，像纸片转过去的一下 */
export function rotate() {
  burst(3600, 1.4, 0.035, 0.13, 'highpass', 0);
  note(520, 0.05, 0.055, 0.01, 'sine');
}

/** 打散：五六下疏密不均的小碎响，像一把拼块落回桌面 */
export function scatter() {
  var offs = [0, 0.035, 0.062, 0.098, 0.125, 0.168];
  for (var i = 0; i < offs.length; i++) {
    burst(1700 + Math.random() * 1400, 1.6, 0.045, 0.10, 'bandpass', offs[i]);
  }
  thump(120, 0.16, 0.10, 0.01);
}

/** 揭晓 / 一键拼好：一片噪声扫过去，再落一个亮音 */
export function reveal() {
  var c = ensure();
  if (!c || !enabled) return;
  var t0 = c.currentTime;

  var src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  var filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, t0);
  filter.frequency.exponentialRampToValueAtTime(5200, t0 + 0.5);
  var g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.62);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + 0.66);

  note(784, 0.28, 0.09, 0.46, 'triangle');
  note(1046, 0.34, 0.07, 0.52, 'triangle');
}

/** 拼完：三个音往上走，短促，不铺满 */
export function win() {
  note(660, 0.16, 0.10, 0, 'triangle');
  note(880, 0.16, 0.10, 0.09, 'triangle');
  note(1174, 0.30, 0.09, 0.18, 'triangle');
  burst(4200, 1.0, 0.10, 0.10, 'highpass', 0.17);
}
