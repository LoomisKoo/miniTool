/* 微风铃语 - 音频引擎
 * 铃管 / 风声 = Web Audio 实时合成
 * 背景乐：默认 assets/bgm.mp3；小红书/快手打包注入 BGM_DATA（base64 AAC）循环
 * 静音开关同时关闭：BGM、风声、敲击（经 master 与显式风增益）
 */
(function () {
  const WC = window.WC = window.WC || {};

  // 17 档音色 = 三层风铃塔：
  //   0..4   第1节(上) 短细金属管 高频清脆
  //   5..10  第2节(中) 中长管
  //   11..16 第3节(下) 最长主管 低沉
  const FREQ = [
    1046.5, 1174.66, 1318.51, 1396.91, 1567.98,      // 第1节 高音
    523.25, 587.33, 659.26, 698.46, 783.99, 880.0,   // 第2节 中音
    261.63, 293.66, 329.63, 349.23, 392.0, 440.0     // 第3节 低音
  ];

  // 铝管特征泛音比例与衰减（第 2/3 泛音 = 2.76/5.40 倍基频）
  const PARTIALS = [
    { r: 1,      a: 1.0,  d: 2.7 },
    { r: 2.756,  a: 0.6,  d: 1.45 },
    { r: 5.404,  a: 0.34, d: 0.8 },
    { r: 8.933,  a: 0.19, d: 0.42 },
    { r: 13.35,  a: 0.09, d: 0.22 }
  ];

  // BGM：默认读 mp3；小红书/快手打包时注入 BGM_DATA（纯 base64，无 data: 前缀）
  const BGM_URL = 'assets/bgm.mp3';
  const BGM_DATA = '';
  const BGM_VOL = 0.58;

  let ctx = null, started = false, muted = false;
  let master = null, comp = null, verbSend = null, verb = null;
  let windSrc = null, windFilt = null, windGain = null;
  let windWant = 0;
  let bgmEl = null, bgmNode = null, bgmGain = null;
  let bgmBuf = null, bgmSrc = null, bgmDecoding = false;

  function ensure() {
    if (ctx) return true;
    if (!window.AudioContext && !window.webkitAudioContext) return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ctx = new AC(); } catch (e) { return false; }

    master = ctx.createGain(); master.gain.value = muted ? 0 : 1;

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22;
    comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.22;
    master.connect(comp); comp.connect(ctx.destination);

    // 共享混响（房间感的平滑尾音，风铃的灵魂）
    const irLen = Math.floor(ctx.sampleRate * 1.9);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        const t = i / irLen;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.3) * (ch ? 0.92 : 1);
      }
    }
    verb = ctx.createConvolver(); verb.buffer = ir;
    verbSend = ctx.createGain(); verbSend.gain.value = 0.72;
    verbSend.connect(verb); verb.connect(master);

    // 风声：带通噪声，随风强弱起伏
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource(); windSrc.buffer = nb; windSrc.loop = true;
    windFilt = ctx.createBiquadFilter();
    windFilt.type = 'bandpass'; windFilt.Q.value = 0.85; windFilt.frequency.value = 420;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(windFilt); windFilt.connect(windGain); windGain.connect(master);
    windSrc.start();

    bgmGain = ctx.createGain();
    bgmGain.gain.value = BGM_VOL;
    bgmGain.connect(master);
    setupBgm();
    return true;
  }

  function b64ToAb(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function stopBufBgm() {
    if (!bgmSrc) return;
    try { bgmSrc.onended = null; bgmSrc.stop(); } catch (e) {}
    try { bgmSrc.disconnect(); } catch (e) {}
    bgmSrc = null;
  }

  function playBufBgm() {
    if (!ctx || !bgmBuf || !bgmGain || muted || !started) return;
    stopBufBgm();
    bgmSrc = ctx.createBufferSource();
    bgmSrc.buffer = bgmBuf;
    bgmSrc.loop = true;
    bgmSrc.connect(bgmGain);
    try { bgmSrc.start(0); } catch (e) { bgmSrc = null; }
  }

  function setupBgm() {
    if (!ctx || bgmEl || bgmBuf || bgmDecoding) return;

    // 小红书：内嵌 base64 → decodeAudioData（zip 内无独立音频文件）
    if (BGM_DATA) {
      bgmDecoding = true;
      let ab;
      try { ab = b64ToAb(BGM_DATA); } catch (e) { bgmDecoding = false; return; }
      const done = function (buf) {
        if (bgmBuf || !buf) { bgmDecoding = false; return; }
        bgmDecoding = false;
        bgmBuf = buf;
        if (started && !muted) playBufBgm();
      };
      const fail = function () { bgmDecoding = false; };
      // 拷贝一份，避免部分 WebView detach 原 ArrayBuffer
      const copy = ab.slice(0);
      ctx.decodeAudioData(copy, done, fail);
      return;
    }

    if (!BGM_URL) return;
    bgmEl = new Audio(BGM_URL);
    bgmEl.loop = true;
    bgmEl.preload = 'auto';
    try {
      bgmNode = ctx.createMediaElementSource(bgmEl);
      bgmNode.connect(bgmGain);
    } catch (e) {
      // 个别环境不支持 MediaElementSource，退回元素直出
      bgmEl.volume = BGM_VOL;
    }
  }

  function startBgm() {
    if (BGM_DATA) {
      if (!bgmBuf) setupBgm();
      else playBufBgm();
      return;
    }
    if (!bgmEl) setupBgm();
    if (!bgmEl) return;
    const p = bgmEl.play();
    if (p && p.catch) p.catch(function () {});
  }

  function applyWindGain() {
    if (!ctx || !windGain) return;
    const t = ctx.currentTime;
    const level = muted ? 0 : Math.max(0, Math.min(1, windWant)) * 0.07;
    windGain.gain.setTargetAtTime(level, t, 0.35);
  }

  function resume() {
    if (!ctx) ensure();
    if (ctx && ctx.state !== 'running') { ctx.resume().catch(function () {}); }
    if (!started) started = true;
    startBgm();
  }

  function setMuted(v) {
    muted = !!v;
    if (ctx && master) {
      master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
    }
    // MediaElement 未接入图时，直接控元素音量
    if (bgmEl && !bgmNode) bgmEl.volume = muted ? 0 : BGM_VOL;
    if (bgmEl && muted) {
      try { bgmEl.pause(); } catch (e) {}
    } else if (bgmEl && !muted && started) {
      startBgm();
    }
    // 内嵌 BGM：停/启 BufferSource
    if (bgmBuf) {
      if (muted) stopBufBgm();
      else if (started) playBufBgm();
    }
    applyWindGain();
    try { localStorage.setItem('wc_sound_muted', muted ? '1' : '0'); } catch (e) {}
    return muted;
  }
  function toggleMute() { return setMuted(!muted); }
  function isMuted() { return muted; }
  function tryLoadMute() {
    try { muted = localStorage.getItem('wc_sound_muted') === '1'; } catch (e) {}
  }

  // 风强度 0..1（静音时强制为 0）
  function setWind(st) {
    if (!ctx || !windGain) return;
    windWant = Math.max(0, Math.min(1, st));
    applyWindGain();
    if (!muted) {
      windFilt.frequency.setTargetAtTime(380 + windWant * 900, ctx.currentTime, 0.4);
    }
  }

  // 敲一只铃管：power 0..1
  function strike(idx, power, o) {
    if (!ctx || muted) return;
    strikeFreq(FREQ[idx % FREQ.length], power, o);
  }

  // 按具体频率敲击（串铃每颗铃有自己的音高）
  function strikeFreq(f0, power, o) {
    if (!ctx || muted) return;
    o = o || {};
    power = Math.max(0.02, Math.min(1, power || 0.5));
    const t0 = ctx.currentTime + (o.at || 0);
    const detune = (Math.random() - 0.5) * 6; // 每颗铃音分微差
    const bright = 0.5 + 0.3 * power;
    const vol = (o.vol != null ? o.vol : 1) * (0.08 + 0.36 * power);

    // 敲击瞬态（短促的“嗒”，赋予金属击打质感）
    const click = ctx.createBufferSource();
    const cbs = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.018), ctx.sampleRate);
    const cd = cbs.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cd.length, 2.4);
    click.buffer = cbs;
    const cg = ctx.createGain();
    cg.gain.value = 0.05 * power;
    click.connect(cg);
    const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 2400;
    cg.connect(chp); chp.connect(master); chp.connect(verbSend);
    click.start(t0); click.stop(t0 + 0.06);

    for (let p = 0; p < PARTIALS.length; p++) {
      const pr = PARTIALS[p];
      const amp = pr.a * (p === 0 ? 1 : bright);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f0 * pr.r;
      osc.detune.value = detune + (Math.random() - 0.5) * 5;
      // 大力的那一下轻微先上漂再回落，模拟敲击瞬间的“上弯”
      if (p === 0 && power > 0.72) {
        osc.frequency.setValueAtTime(f0 * pr.r * 1.004, t0);
        osc.frequency.exponentialRampToValueAtTime(f0 * pr.r, t0 + 0.03);
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(amp * vol, t0 + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0006, t0 + pr.d * (0.9 + 0.25 * power));
      osc.connect(g);
      g.connect(master);
      g.connect(verbSend);
      osc.start(t0);
      osc.stop(t0 + pr.d * 2.2);
    }
  }

  // 极轻的一下（拖拽过程中的金属擦过感）
  function brush(idx, power) { strike(idx, 0.1 + (power || 0.1) * 0.25, { vol: 0.5 }); }

  // 按序列连续轻敲（许愿 / 提示音）
  function roll(idxList, gap, power) {
    idxList.forEach(function (n, i) {
      strike(n % FREQ.length, power || 0.42, { at: (i || 0) * (gap || 0.16) });
    });
  }

  WC.audio = {
    FREQ: FREQ,
    ensure: ensure,
    resume: resume,
    setMuted: setMuted,
    toggleMute: toggleMute,
    isMuted: isMuted,
    tryLoadMute: tryLoadMute,
    setWind: setWind,
    strike: strike,
    strikeFreq: strikeFreq,
    brush: brush,
    roll: roll
  };
  tryLoadMute();
})();
