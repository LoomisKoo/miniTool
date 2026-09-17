// 祈愿灯 - 配乐（国风治愈：优先载入 assets/music.mp3，缺失则用 WebAudio 合成五声音阶环境音）
(function () {
  const KD = window.KD || (window.KD = {});
  let ctx, master, playing = false, muted = false, useSynth = true, fileEl = null, synthTimer = null;

  // 宫调五声音阶（C D E G A）跨两个八度，温润治愈
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      master.connect(lp); lp.connect(ctx.destination);
    }
  }

  function fade(to, sec) {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(muted ? 0 : to, now + sec);
  }

  function pluck(freq, when, dur) {
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = freq; o2.frequency.value = freq * 2.001;
    const og = ctx.createGain(); og.gain.value = 0.5;
    o2.connect(og); og.connect(g); o.connect(g);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.5, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g.connect(master);
    o.start(when); o2.start(when);
    o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
  }

  function synthLoop() {
    if (!playing || !useSynth) return;
    if (!muted) {
      const f = SCALE[(Math.random() * SCALE.length) | 0];
      pluck(f, ctx.currentTime + 0.02, 1.6 + Math.random() * 1.4);
      // 偶尔叠一个低八度铺底
      if (Math.random() < 0.4) pluck(f / 2, ctx.currentTime + 0.05, 2.4);
    }
    synthTimer = setTimeout(synthLoop, 900 + Math.random() * 1400);
  }

  function start() {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    if (!fileEl) {
      fileEl = new Audio('assets/music.mp3');
      fileEl.loop = true; fileEl.volume = 0.45;
      fileEl.play().then(() => { useSynth = false; playing = true; fade(0.5, 1.5); }).catch(() => {
        useSynth = true; playing = true; fade(0.35, 1.5); synthLoop();
      });
    } else if (useSynth) {
      playing = true; fade(0.35, 1.5); synthLoop();
    } else {
      fileEl.play().catch(() => {}); fade(0.5, 1.5);
    }
    playing = true;
  }

  function toggleMute() {
    muted = !muted;
    if (fileEl) fileEl.muted = muted;
    fade(muted ? 0 : (useSynth ? 0.35 : 0.5), 0.4);
    return muted;
  }

  // 人群喝彩声：带通噪声涌起 + 起伏调制 + 几声口哨欢呼
  function cheer() {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const dur = 2.5, now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.5, now + 0.25);
    g.gain.setValueAtTime(0.5, now + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    const lg = ctx.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(master);
    src.start(now); src.stop(now + dur);
    lfo.start(now); lfo.stop(now + dur);
    for (let i = 0; i < 3; i++) {
      const t0 = now + 0.1 + Math.random() * 0.7;
      const o = ctx.createOscillator(); o.type = 'sine';
      const og = ctx.createGain();
      o.frequency.setValueAtTime(600 + Math.random() * 300, t0);
      o.frequency.exponentialRampToValueAtTime(1100 + Math.random() * 500, t0 + 0.35);
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.11, t0 + 0.06);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(og); og.connect(master);
      o.start(t0); o.stop(t0 + 0.55);
    }
  }

  // 烟花噼啪声：根据距离营造远近差异
  // dist: 烟花到相机的世界距离。近（dist 小）→ 响亮清脆；远 → 沉闷微弱且有传播延迟。
  function pop(dist) {
    if (muted || !ctx) return;
    // 归一化 0=近,1=远
    const d = Math.max(0, Math.min(1, (dist - 28) / (130 - 28)));
    const amp = 0.55 * Math.pow(1 - d, 1.35) + 0.025;
    const cutoff = 4200 * (1 - d) + 520;
    const delay = d * 0.48; // 远处声传播延迟

    setTimeout(() => {
      if (muted || !ctx) return;
      const t0 = ctx.currentTime;

      // 主爆音：带通噪声短包
      const bl = Math.floor(ctx.sampleRate * 0.46);
      const buf = ctx.createBuffer(1, bl, ctx.sampleRate);
      const dd = buf.getChannelData(0);
      for (let i = 0; i < bl; i++) dd[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = cutoff; bp.Q.value = 0.95;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(amp, t0 + 0.012);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.46);
      src.connect(bp); bp.connect(ng); ng.connect(master);
      src.start(t0); src.stop(t0 + 0.5);

      // 低频 thump（远处更低沉）
      const o = ctx.createOscillator(); o.type = 'sine';
      const of = 95 + Math.random() * 35 - d * 35;
      o.frequency.setValueAtTime(of, t0);
      o.frequency.exponentialRampToValueAtTime(of * 0.42, t0 + 0.18);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(amp * 0.9, t0 + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
      o.connect(og); og.connect(master);
      o.start(t0); o.stop(t0 + 0.36);

      // 噼啪尾音（3 个小爆点）
      for (let k = 0; k < 3; k++) {
        const t1 = t0 + 0.05 + Math.random() * 0.18;
        const sl = Math.floor(ctx.sampleRate * 0.09);
        const sb = ctx.createBuffer(1, sl, ctx.sampleRate);
        const sd = sb.getChannelData(0);
        for (let i = 0; i < sl; i++) sd[i] = Math.random() * 2 - 1;
        const ss = ctx.createBufferSource(); ss.buffer = sb;
        const sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = cutoff * 1.4; sbp.Q.value = 1.2;
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.0001, t1);
        sg.gain.exponentialRampToValueAtTime(amp * 0.38, t1 + 0.006);
        sg.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.08);
        ss.connect(sbp); sbp.connect(sg); sg.connect(master);
        ss.start(t1); ss.stop(t1 + 0.09);
      }
    }, delay * 1000);
  }

  KD.audio = { start, toggleMute, cheer, pop, isMuted: () => muted };
})();
