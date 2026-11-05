/* 全局音效：全部用 WebAudio 实时合成，不加载任何音频文件（0 体积、无延迟）
   总线：所有声音 → 总增益 → 柔化低通 → 压限器 → 输出；另有一条轻混响发送，用于闪光 / 庆祝 / 大招尾音 */
(function (global) {
  'use strict';

  var ac = null, on = true, noiseBuf = null, lastAt = 0;
  var bus = null, wet = null, bedG = null;

  try { on = localStorage.getItem('wg_sfx') !== '0'; } catch (e) {}

  function actx() {
    if (!ac) {
      var C = global.AudioContext || global.webkitAudioContext;
      if (!C) return null;
      try { ac = new C(); } catch (e) { return null; }
      buildBus(ac);
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    return ac;
  }

  function buildBus(a) {
    var comp = a.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.22;
    var lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 9500; lp.Q.value = 0.5;
    bus = a.createGain(); bus.gain.value = 0.9;
    bus.connect(lp); lp.connect(comp); comp.connect(a.destination);
    try {
      var cv = a.createConvolver();
      cv.buffer = impulse(a, 1.5, 2.6);
      wet = a.createGain(); wet.gain.value = 0.28;
      wet.connect(cv); cv.connect(lp);
    } catch (e) { wet = null; }
  }

  function impulse(a, sec, decay) {
    var len = (a.sampleRate * sec) | 0, b = a.createBuffer(2, len, a.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function noiseBufGet(a) {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function sendWet(a, g, amt) {
    if (!wet || !amt) return null;
    var s = a.createGain(); s.gain.value = amt;
    g.connect(s); s.connect(wet);
    return s;
  }

  // 带起音的包络：避免瞬间满音量造成"咔哒"声（之前刺耳的主要来源）
  function env(g, t, vol, dur, atk) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  // 单音：f0 起频，f1 止频（可空）；o = { wet 混响量, lp 低通, dest 输出, atk 起音 }
  function tone(f0, f1, dur, type, vol, delay, o) {
    var a = actx(); if (!a) return;
    o = o || {};
    var t = a.currentTime + (delay || 0);
    var osc = a.createOscillator(), g = a.createGain(), node = osc, f = null, s;
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(f0, t);
    if (f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    // 方波 / 锯齿波默认过一道低通，去掉刺耳的高次谐波
    if (type === 'square' || type === 'sawtooth' || o.lp) {
      f = a.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.value = o.lp || Math.min(6000, f0 * 4);
      osc.connect(f); node = f;
    }
    node.connect(g);
    env(g, t, vol, dur, o.atk || Math.min(0.006, dur * 0.3));
    g.connect(o.dest || bus);
    s = sendWet(a, g, o.wet);
    osc.onended = function () { try { osc.disconnect(); g.disconnect(); if (f) f.disconnect(); if (s) s.disconnect(); } catch (e) {} };
    osc.start(t); osc.stop(t + dur + 0.03);
  }

  // 噪声：滤波从 fc0 扫到 fc1；o = { type 滤波类型, q, wet, dest }
  function noise(dur, vol, fc0, delay, fc1, o) {
    var a = actx(); if (!a) return;
    o = o || {};
    var t = a.currentTime + (delay || 0), ft = o.type || 'lowpass';
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), s;
    src.buffer = noiseBufGet(a);
    f.type = ft; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(fc0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, fc1 || (ft === 'lowpass' ? 60 : fc0)), t + dur);
    src.connect(f); f.connect(g);
    env(g, t, vol, dur, o.atk || Math.min(0.004, dur * 0.3));
    g.connect(o.dest || bus);
    s = sendWet(a, g, o.wet);
    src.onended = function () { try { src.disconnect(); f.disconnect(); g.disconnect(); if (s) s.disconnect(); } catch (e) {} };
    src.start(t, Math.random() * Math.max(0, 1.9 - dur)); src.stop(t + dur + 0.03);
  }

  // 一段音阶：串成小旋律
  function seq(fs, step, type, vol, dur, o) {
    for (var i = 0; i < fs.length; i++) tone(fs[i], 0, dur || 0.08, type || 'triangle', vol, i * step, o);
  }

  // 随机微调音高，连续命中时不会变成同一个"鼓点"
  function rv() { return 0.93 + Math.random() * 0.14; }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  // 瞬态"啪"：十几毫秒的高通噪声，决定打击的脆度
  function snap(vol, fc, delay) { noise(0.016, vol, fc, delay || 0, fc, { type: 'highpass', atk: 0.001 }); }

  // 钟铃：非谐泛音 + 微失谐拍频，余韵长，比单个正弦有质感得多
  function bell(f, dur, vol, delay, wetAmt) {
    var o = { wet: wetAmt == null ? 0.65 : wetAmt };
    tone(f, 0, dur, 'sine', vol, delay, o);
    tone(f * 1.004, 0, dur * 0.9, 'sine', vol * 0.5, delay, o);
    tone(f * 2.76, 0, dur * 0.45, 'sine', vol * 0.3, delay, o);
    tone(f * 5.4, 0, dur * 0.2, 'sine', vol * 0.12, delay, o);
  }
  // 弦乐铺底：左右失谐的锯齿波过低通，慢起慢收，整体送混响
  function pad(fs, dur, vol, delay, lp) {
    var a = actx(); if (!a) return;
    var t = a.currentTime + (delay || 0), g = a.createGain(), s;
    g.connect(bus); s = sendWet(a, g, 0.7);
    fs.forEach(function (f) {
      sus({ type: 'sawtooth', f: f, det: -8, fc: lp || 1600, vol: vol, atk: 0.08, rel: dur }, t, dur, g);
      sus({ type: 'sawtooth', f: f, det: 8, fc: lp || 1600, vol: vol * 0.8, atk: 0.12, rel: dur }, t, dur, g);
    });
    setTimeout(function () { try { g.disconnect(); if (s) s.disconnect(); } catch (e) {} }, ((delay || 0) + dur + 0.4) * 1000);
  }
  // 反向镲式渐强：噪声慢慢涨上来、在终点戛然而止，用来蓄力
  function swell(dur, vol, delay, f0, f1) {
    noise(dur, vol, f0 || 600, delay, f1 || 8000, { type: 'bandpass', q: 0.8, atk: dur * 0.9 });
  }
  // 星尘：一把随机高音小闪光撒在 span 秒内
  function sparkle(n, start, span, vol) {
    for (var i = 0; i < n; i++) tone(2600 + Math.random() * 2800, 0, 0.16, 'sine', vol, start + Math.random() * span, { wet: 0.9 });
  }
  // 低频冲击：下潜的 sub + 一层中频气浪
  function thump(vol, delay, f0) {
    tone(f0 || 130, 38, 0.6, 'sine', vol, delay || 0);
    noise(0.12, vol * 0.45, 1800, delay || 0, 260);
  }
  // 铜管和弦重音：锯齿波低通，短促有力
  function stab(fs, vol, delay, dur) {
    fs.forEach(function (f) {
      tone(f, 0, dur || 0.32, 'sawtooth', vol, delay, { lp: 2600, atk: 0.012, wet: 0.45 });
      tone(f * 1.006, 0, dur || 0.32, 'sawtooth', vol * 0.7, delay, { lp: 2600, atk: 0.012, wet: 0.45 });
    });
  }

  // 抽卡池主题切换：每个主题一种音色
  var THEME_SND = {
    all: function () {        // 万象：金色钟铃
      [784, 1175, 1568].forEach(function (f, i) { bell(f, 0.9, 0.032, 0.05 + i * 0.06); });
      tone(196, 0, 0.6, 'sine', 0.05, 0.04);
    },
    wild: function () {       // 自然：木琴五声音阶 + 两声鸟鸣
      [587, 659, 784, 988].forEach(function (f, i) {
        tone(f, 0, 0.22, 'sine', 0.05, 0.04 + i * 0.05, { wet: 0.35 });
        tone(f * 4, 0, 0.03, 'sine', 0.012, 0.04 + i * 0.05);
      });
      tone(2600, 3500, 0.06, 'sine', 0.014, 0.3, { wet: 0.5 });
      tone(2900, 3800, 0.05, 'sine', 0.012, 0.37, { wet: 0.5 });
    },
    life: function () {       // 烟火：温暖的拇指琴拨弦
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone(f, 0, 0.4, 'triangle', 0.045, 0.04 + i * 0.055, { lp: 2200, wet: 0.4 });
      });
      tone(131, 0, 0.5, 'sine', 0.05, 0.04);
    },
    mind: function () {       // 心智：晶体感的快速电子琶音
      [1046, 1318, 1568, 2093, 2637].forEach(function (f, i) {
        tone(f, 0, 0.08, 'square', 0.02, 0.03 + i * 0.035, { lp: 4200, wet: 0.45 });
      });
      tone(3136, 0, 0.18, 'sine', 0.016, 0.22, { wet: 0.7 });
    },
    mood: function () {       // 光影：梦幻失谐长铃 + 反向光晕
      swell(0.3, 0.03, 0, 2000, 9000);
      [659, 831, 988].forEach(function (f, i) { bell(f, 1.3, 0.026, 0.12 + i * 0.07, 0.85); });
    },
  };

  /* —— 持续音层（大招期间一直响）——
     spec: { src:'osc'|'noise', type, f, f1, det, vol, ft, fc, fc1, q, trem 颤音频率, depth, wob 滤波摆动频率, wobAmt, atk, rel } */
  function sus(spec, t0, dur, dest) {
    var a = ac, src, node, f = null, g, tg = null, lfo = null, lfo2 = null, nodes = [];
    if (spec.src === 'noise') {
      src = a.createBufferSource(); src.buffer = noiseBufGet(a); src.loop = true;
    } else {
      src = a.createOscillator(); src.type = spec.type || 'sine';
      src.frequency.setValueAtTime(spec.f, t0);
      if (spec.f1) src.frequency.exponentialRampToValueAtTime(spec.f1, t0 + dur);
      if (spec.det) src.detune.value = spec.det;
    }
    node = src; nodes.push(src);
    if (spec.fc) {
      f = a.createBiquadFilter(); f.type = spec.ft || 'lowpass'; f.Q.value = spec.q || 0.7;
      f.frequency.setValueAtTime(spec.fc, t0);
      if (spec.fc1) f.frequency.exponentialRampToValueAtTime(spec.fc1, t0 + dur);
      node.connect(f); node = f; nodes.push(f);
      if (spec.wob) {
        lfo2 = a.createOscillator(); lfo2.frequency.value = spec.wob;
        var wg = a.createGain(); wg.gain.value = spec.wobAmt || spec.fc * 0.5;
        lfo2.connect(wg); wg.connect(f.frequency); nodes.push(lfo2, wg);
      }
    }
    g = a.createGain(); node.connect(g); nodes.push(g);
    var atk = spec.atk || 0.15, rel = Math.min(spec.rel || 0.45, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(spec.vol, t0 + atk);
    g.gain.setValueAtTime(spec.vol, t0 + Math.max(atk, dur - rel));
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    if (spec.trem) {
      var d = spec.depth || 0.5;
      tg = a.createGain(); tg.gain.value = 1 - d / 2;
      lfo = a.createOscillator(); lfo.frequency.value = spec.trem;
      var ld = a.createGain(); ld.gain.value = d / 2;
      lfo.connect(ld); ld.connect(tg.gain);
      g.connect(tg); tg.connect(dest); nodes.push(tg, lfo, ld);
    } else g.connect(dest);
    src.onended = function () { nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} }); };
    src.start(t0); src.stop(t0 + dur + 0.05);
    if (lfo) { lfo.start(t0); lfo.stop(t0 + dur + 0.05); }
    if (lfo2) { lfo2.start(t0); lfo2.stop(t0 + dur + 0.05); }
  }

  function bedOpen() {
    stopBed(0.08);
    bedG = ac.createGain(); bedG.gain.value = 1; bedG.connect(bus);
    return bedG;
  }
  function stopBed(fade) {
    if (!bedG || !ac) return;
    var g = bedG, t = ac.currentTime, fd = fade || 0.3;
    bedG = null;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + fd);
    } catch (e) {}
    setTimeout(function () { try { g.disconnect(); } catch (e) {} }, (fd + 0.1) * 1000);
  }

  // 每种大招的持续音层：d 为大招时长（秒）
  var BEDS = {
    blast: function (t, d, o) {     // 流星雨：低频火海轰鸣 + 噼啪火星 + 不断划过的流星哨音
      sus({ src: 'noise', fc: 260, wob: 0.8, wobAmt: 120, vol: 0.13 }, t, d, o);
      sus({ src: 'noise', ft: 'bandpass', fc: 1800, q: 0.9, vol: 0.035, trem: 13, depth: 0.85 }, t, d, o);
      for (var x = 0.1; x < d - 0.2; x += 0.17) tone(1500 + Math.random() * 700, 260, 0.36, 'sine', 0.016, x, { dest: o });
    },
    pierce: function (t, d, o) {    // 巨型光柱：能量嗡鸣 + 滤波扫动 + 高频辉光
      sus({ type: 'sawtooth', f: 110, fc: 700, wob: 2.6, wobAmt: 380, vol: 0.07 }, t, d, o);
      sus({ type: 'sine', f: 220, vol: 0.05 }, t, d, o);
      sus({ type: 'sine', f: 1760, vol: 0.016, trem: 9, depth: 0.8 }, t, d, o);
      sus({ src: 'noise', ft: 'highpass', fc: 5200, vol: 0.022 }, t, d, o);
    },
    swift: function (t, d, o) {     // 蜂群：多组失谐振翅嗡鸣 + 金色闪光
      [188, 195, 202, 211].forEach(function (f, i) {
        sus({ type: 'sawtooth', f: f, f1: f * 1.18, ft: 'bandpass', fc: 950, q: 2, vol: 0.032, trem: 26 + i * 3, depth: 0.65 }, t, d, o);
      });
      sus({ type: 'sine', f: 96, vol: 0.045 }, t, d, o);
      for (var x = 0.08; x < d - 0.15; x += 0.11) tone(2000 + Math.random() * 1600, 0, 0.09, 'sine', 0.012, x, { dest: o, wet: 0.6 });
    },
    thunder: function (t, d, o) {   // 雷暴：雨幕 + 低频滚雷
      sus({ src: 'noise', ft: 'highpass', fc: 3200, vol: 0.035 }, t, d, o);
      sus({ src: 'noise', fc: 170, wob: 0.6, wobAmt: 80, vol: 0.15 }, t, d, o);
      for (var x = 0.3; x < d - 0.3; x += 0.55) noise(0.7, 0.08, 500, x, 110, { dest: o });
    },
    frost: function (t, d, o) {     // 冻结：冰晶长音 + 寒风 + 零星冰铃
      [1318, 1568, 1976].forEach(function (f, i) { sus({ type: 'sine', f: f, vol: 0.012, trem: 0.7 + i * 0.2, depth: 0.6, atk: 0.4 }, t, d, o); });
      sus({ src: 'noise', ft: 'highpass', fc: 6200, wob: 0.3, wobAmt: 2000, vol: 0.014, atk: 0.4 }, t, d, o);
      for (var x = 0.25; x < d - 0.3; x += 0.28) tone(2637 * pick([1, 1.25, 1.5]), 0, 0.35, 'sine', 0.012, x, { dest: o, wet: 0.8 });
    },
    shield: function (t, d, o) {    // 扩散字环：明亮和弦随环扩张逐渐打开
      [523, 659, 784].forEach(function (f) { sus({ type: 'triangle', f: f, fc: 600, fc1: 3200, vol: 0.022 }, t, d, o); });
      sus({ type: 'sine', f: 131, vol: 0.04 }, t, d, o);
    },
    tide: function (t, d, o) {      // 海啸：浪涌的潮声 + 深海低频
      sus({ src: 'noise', fc: 900, wob: 0.7, wobAmt: 620, vol: 0.15, q: 0.6 }, t, d, o);
      sus({ type: 'sine', f: 55, vol: 0.06 }, t, d, o);
    },
    blade: function (t, d, o) {     // 千刃风暴：旋转呼啸 + 金属嗡鸣 + 刀光划过
      sus({ type: 'sawtooth', f: 82, ft: 'bandpass', fc: 720, q: 3, wob: 10, wobAmt: 420, vol: 0.055 }, t, d, o);
      sus({ type: 'sine', f: 2200, vol: 0.01, trem: 10, depth: 0.9 }, t, d, o);
      for (var x = 0.1; x < d - 0.2; x += 0.3) noise(0.14, 0.05, 6000, x, 1800, { dest: o, type: 'bandpass', q: 1.4 });
    },
  };

  // 大招开场冲击：统一的低频冲击 + 一道上扬能量 + 混响尾巴
  function ultImpact(col) {
    tone(140, 38, 0.75, 'sine', 0.24);
    noise(0.6, 0.16, 2600, 0, 160, { wet: 0.3 });
    tone(col, col * 2, 0.35, 'triangle', 0.04, 0, { wet: 0.5 });
  }
  function ult(kind, flavor, col) {
    return function (dur) {
      ultImpact(col);
      flavor();
      var a = actx(); if (!a) return;
      var d = Math.max(0.6, dur || 1.5);
      BEDS[kind](a.currentTime + 0.08, d, bedOpen());
    };
  }

  var lib = {
    /* —— 命中（只在打中时响，按弹种分材质）—— */
    /* 打击感 = 极短的高频瞬态（"啪"）+ 中高频材质，不用任何低频正弦扫频（那就是"低音鼓"的来源） */
    hit: function () { var r = rv(); snap(0.07, 3000); noise(0.03, 0.04, 2200 * r, 0, 0, { type: 'bandpass', q: 1.4 }); },
    hit_blast: function () {   // 霰弹：干脆的"噗啪"碎响
      var r = rv(); snap(0.08, 2600);
      noise(0.04, 0.05, 1700 * r, 0.004, 900, { type: 'bandpass', q: 1.2 });
    },
    hit_frost: function () {   // 冰锥：冰晶碎裂的清脆"叮"
      var r = rv(); snap(0.05, 6000);
      tone(2637 * r, 0, 0.07, 'sine', 0.024, 0, { wet: 0.4 }); tone(3951 * r, 0, 0.05, 'sine', 0.012, 0.006);
    },
    hit_swift: function () {   // 追踪弹：小型爆点"砰"（中高频）
      var r = rv(); snap(0.07, 3200);
      tone(1300 * r, 700 * r, 0.045, 'triangle', 0.03);
      noise(0.05, 0.035, 2400 * r, 0.005, 1200, { type: 'bandpass', q: 1 });
    },
    hit_thunder: function () { // 雷电：三连电火花噼啪
      var r = rv();
      for (var i = 0; i < 3; i++) noise(0.018, 0.06 - i * 0.012, (3600 + i * 900) * r, i * 0.014, 0, { type: 'bandpass', q: 2 });
    },
    hit_pierce: function () {  // 激光：灼烧的"嘶"
      var r = rv(); noise(0.05, 0.035, 6500 * r, 0, 4000, { type: 'highpass' }); tone(2200 * r, 1800, 0.035, 'sine', 0.01);
    },
    hit_tide: function () {    // 潮汐：水花"啪嚓"
      var r = rv(); snap(0.05, 2400);
      noise(0.07, 0.05, 1200 * r, 0, 3200, { type: 'bandpass', q: 1.4 });
    },
    hit_blade: function () {   // 飞刃：金属"锵"
      var r = rv(); snap(0.07, 4500);
      tone(1760 * r, 0, 0.12, 'triangle', 0.018, 0.004, { wet: 0.4 }); tone(2637 * r, 0, 0.09, 'sine', 0.012, 0.006);
    },
    hit_shield: function () { var r = rv(); snap(0.05, 3800); tone(1318 * r, 0, 0.05, 'sine', 0.022); },
    crit: function () {
      var r = rv(); snap(0.11, 3500);
      noise(0.05, 0.06, 2800 * r, 0.004, 1400, { type: 'bandpass', q: 1.2 });
      tone(1568 * r, 0, 0.1, 'triangle', 0.032, 0.01, { wet: 0.4 });
      tone(2349 * r, 0, 0.08, 'sine', 0.02, 0.025);
    },
    // 小怪击破：碎裂爆响（中频为主），只有精英 / 首领才用低频 bigboom
    boom: function () {
      var r = rv(); snap(0.1, 2800);
      noise(0.14, 0.09, 2400 * r, 0.004, 500, { type: 'bandpass', q: 0.9 });
      tone(760 * r, 260, 0.08, 'triangle', 0.03, 0.004);
    },
    bigboom: function () { tone(100, 30, 0.8, 'sine', 0.26); noise(0.9, 0.2, 2400, 0, 80, { wet: 0.3 }); tone(55, 30, 1, 'sine', 0.12, 0.05); },

    /* —— 对局内 —— */
    power: function () { seq([523, 659, 784, 1046], 0.05, 'triangle', 0.045, 0.1, { wet: 0.3 }); },
    item: function () { tone(660, 990, 0.08, 'triangle', 0.05, 0, { wet: 0.2 }); },
    letter: function () { tone(988, 1480, 0.09, 'triangle', 0.06, 0, { wet: 0.3 }); tone(1976, 0, 0.12, 'sine', 0.015, 0.05, { wet: 0.5 }); },
    word: function () { seq([659, 784, 988, 1318, 1568], 0.06, 'triangle', 0.06, 0.12, { wet: 0.4 }); },
    hurt: function () { tone(380, 110, 0.3, 'triangle', 0.1); noise(0.2, 0.1, 900); },
    shield: function () { tone(1200, 600, 0.16, 'sine', 0.07, 0, { wet: 0.3 }); },
    eshoot: function () { tone(360, 240, 0.05, 'triangle', 0.01); },
    bomb: function () { tone(140, 38, 0.75, 'sine', 0.22); noise(0.6, 0.16, 2600, 0, 160, { wet: 0.3 }); },
    warn: function () { for (var i = 0; i < 3; i++) tone(740, 540, 0.22, 'square', 0.06, i * 0.32); },
    laser: function () { tone(400, 1600, 0.28, 'sine', 0.04, 0, { wet: 0.4 }); noise(0.35, 0.06, 5000, 0, 1500, { type: 'bandpass' }); },
    surge: function () { noise(0.9, 0.16, 300, 0, 2200, { q: 0.6 }); tone(70, 40, 0.8, 'sine', 0.14); },
    clear: function () { seq([523, 659, 784, 1046, 1318], 0.09, 'triangle', 0.05, 0.16, { wet: 0.5 }); },
    zap: function () { var r = rv(); noise(0.08, 0.07, 4200 * r, 0, 1500, { type: 'bandpass', q: 1.2 }); tone(1200 * r, 300, 0.07, 'sawtooth', 0.025); },
    freeze: function () { tone(2400, 600, 0.6, 'sine', 0.07, 0, { wet: 0.5 }); },
    awaken: function () { seq([392, 523, 659, 784, 1046, 1318], 0.05, 'triangle', 0.05, 0.18, { wet: 0.5 }); tone(98, 60, 0.8, 'sine', 0.12); },

    /* —— 大招：开场冲击 + 整个大招期间的持续音层 —— */
    ult_blast: ult('blast', function () { noise(0.5, 0.12, 900, 0.05, 200); }, 330),
    ult_pierce: ult('pierce', function () { tone(200, 1800, 0.5, 'sine', 0.05, 0, { wet: 0.5 }); }, 440),
    ult_swift: ult('swift', function () { seq([1568, 1976, 2349, 3136], 0.07, 'triangle', 0.03, 0.22, { wet: 0.6 }); }, 523),
    ult_thunder: ult('thunder', function () { noise(0.3, 0.2, 5200, 0, 900, { type: 'bandpass', q: 0.8 }); }, 294),
    ult_frost: ult('frost', function () { tone(2600, 600, 1.2, 'sine', 0.06, 0, { wet: 0.7 }); }, 659),
    ult_shield: ult('shield', function () { seq([523, 659, 784, 1046, 1318], 0.05, 'triangle', 0.04, 0.3, { wet: 0.5 }); }, 523),
    ult_tide: ult('tide', function () { noise(1.0, 0.16, 300, 0, 2400, { q: 0.6 }); }, 220),
    ult_blade: ult('blade', function () { for (var i = 0; i < 6; i++) tone(2200 - i * 90, 0, 0.2, 'sine', 0.02, i * 0.05, { wet: 0.4 }); }, 392),
    ult_end: function () { stopBed(0.35); tone(1046, 523, 0.4, 'triangle', 0.035, 0, { wet: 0.5 }); tone(90, 45, 0.45, 'sine', 0.08); },

    /* —— 战场节奏 —— */
    wave: function () { noise(0.32, 0.04, 900, 0, 2400); tone(190, 120, 0.26, 'sine', 0.025); },
    boss: function () {
      tone(110, 55, 1.15, 'sawtooth', 0.1);
      tone(62, 40, 1.35, 'sine', 0.16, 0.05);
      noise(1.0, 0.12, 900, 0.05, 200, { wet: 0.3 });
    },

    /* —— 通用交互 —— */
    tap: function () { tone(1180, 900, 0.028, 'triangle', 0.02); },
    tab: function () { tone(880, 1180, 0.07, 'triangle', 0.035); },
    deny: function () { tone(220, 160, 0.1, 'triangle', 0.05); tone(180, 120, 0.13, 'triangle', 0.045, 0.1); },
    page: function () { noise(0.16, 0.05, 2600, 0, 900); tone(520, 880, 0.1, 'sine', 0.022); },
    sheet: function () { noise(0.24, 0.06, 320, 0, 2600); tone(320, 520, 0.16, 'sine', 0.02); },
    sheetClose: function () { noise(0.22, 0.055, 2400, 0, 260); tone(520, 320, 0.14, 'sine', 0.02); },
    shutter: function () { noise(0.06, 0.12, 6000, 0, 1200); tone(1600, 900, 0.05, 'triangle', 0.03, 0.05); },

    /* —— 翻卡 —— */
    shuffle: function () {
      // 抽卡开始：短促的卡片摩擦 + 上行音阶，避免廉价的噪声扫频感
      [330, 392, 494, 587, 698].forEach(function (f, i) {
        tone(f, f * 1.08, 0.055, 'triangle', 0.024, i * 0.045, { wet: 0.28 });
      });
      noise(0.12, 0.022, 5200, 0, 1800, { type: 'bandpass', q: 1.3, wet: 0.25 });
    },
    deal: function (i) {
      var d = (i || 0) * 0.08;
      noise(0.055, 0.028, 3600, d, 900, { type: 'bandpass', q: 1.1, wet: 0.32 });
      tone(740 + (i || 0) * 55, 1040 + (i || 0) * 70, 0.1, 'sine', 0.026, d, { wet: 0.42 });
      tone(1480 + (i || 0) * 110, 0, 0.07, 'triangle', 0.014, d + 0.035, { wet: 0.65 });
    },
    // 实体翻牌：拨起牌角"嗒" → 牌面扇过空气 → 翻到正面"啪" → 落定轻响；ms 为翻面动画时长
    flip: function (ms) {
      var d = Math.max(0.3, (ms || 640) / 1000), h = d * 0.48;
      snap(0.05, 3800);
      tone(430, 260, 0.05, 'triangle', 0.03);
      noise(h + 0.04, 0.05, 900, 0.01, 4200, { type: 'bandpass', q: 0.9, atk: h * 0.8 });
      for (var i = 0; i < 3; i++) noise(0.022, 0.018, 2800 + i * 700, h * (0.3 + i * 0.22), 0, { type: 'bandpass', q: 2 });
      snap(0.1, 2600, h);
      noise(0.08, 0.06, 1700, h, 480, { type: 'bandpass', q: 0.8 });
      tone(240, 105, 0.08, 'triangle', 0.05, h);
      noise(0.05, 0.03, 2400, d - 0.02, 900, { type: 'bandpass', q: 1 });
      tone(1568, 0, 0.22, 'sine', 0.012, d - 0.02, { wet: 0.7 });
    },
    // 开奖悬念每跳一档：心跳"咚-咚" + 一声逐档升高的钟铃 + 短促吸气；越往后越重；a = { i 第几跳, lv 当前光色档, last 最后一跳 }
    tease: function (a) {
      var i = (a && a.i) || 0, lv = (a && a.lv) || 1;
      var v = 0.12 + i * 0.04;
      tone(78, 42, 0.22, 'sine', v);
      tone(72, 40, 0.26, 'sine', v * 0.75, 0.16);
      noise(0.06, 0.03 + i * 0.01, 900, 0, 200);
      bell([392, 440, 523, 587, 698, 784][lv - 1] * (1 + i * 0.06), 0.55 + i * 0.1, 0.02 + i * 0.006, 0.02, 0.75);
      swell(0.38, 0.012 + i * 0.008, 0.08, 1200, 6000 + i * 1200);
      if (a && a.last && lv >= 4) sparkle(4 + lv, 0.1, 0.35, 0.009);
    },
    // 高档位翻面蓄力：反向镲 + 上滑能量音，正好在翻开那一刻收住；a = { tier, dur(ms) }
    charge: function (a) {
      var t = (a && a.tier) || 3, d = Math.max(0.4, ((a && a.dur) || 640) / 1000);
      swell(d, 0.03 + (t - 3) * 0.012, 0, 500, 7500);
      tone(220, 440 + t * 60, d, 'sine', 0.018 + (t - 3) * 0.006, 0, { wet: 0.5, atk: d * 0.8 });
      if (t >= 5) tone(42, 70, d, 'sine', 0.09, 0, { atk: d * 0.85 });
    },
    // 稀有度揭示：冲击 + 钟铃琶音为骨架，档位越高叠的层越多：
    // 3 起弦乐铺底 + 星尘，4 起高八度瀑布 + 闪光噪声，5 起铜管重音 + 大锣，6 再叠魔法上滑与转调和弦
    reveal: function (lv) {
      lv = Math.max(1, Math.min(6, lv || 1));
      var R = [523, 587, 659, 698, 784, 880][lv - 1];
      snap(0.06 + lv * 0.012, 3200);
      thump(0.07 + lv * 0.028, 0, 100 + lv * 8);
      noise(0.45 + lv * 0.12, 0.016 + lv * 0.006, 9000, 0.02, 3200, { type: 'highpass', wet: 0.85 });
      var arp = [1, 1.26, 1.5, 2].slice(0, Math.min(4, 1 + lv));
      arp.forEach(function (m, i) { bell(R * m, 0.7 + lv * 0.12, 0.034, 0.03 + i * 0.07); });
      if (lv >= 3) {
        pad([R / 2, R * 0.63, R * 0.75], 0.9 + lv * 0.25, 0.012 + lv * 0.002, 0.04, 1200 + lv * 300);
        sparkle(4 + lv * 3, 0.25, 0.5 + lv * 0.12, 0.011);
      }
      if (lv >= 4) {
        [2, 2.52, 3, 4, 5.04].forEach(function (m, i) { bell(R * m, 0.5, 0.016, 0.3 + i * 0.055, 0.85); });
        swell(0.25, 0.02, 0.05, 3000, 10000);
      }
      if (lv >= 5) {
        stab([R / 2, R * 0.63, R * 0.75], 0.032, 0.02, 0.38);
        stab([R * 0.5625, R * 0.75, R * 0.84], 0.028, 0.24, 0.22);
        stab([R / 2, R * 0.63, R * 0.75, R], 0.034, 0.42, 0.9);
        bell(R / 4, 2.2, 0.07, 0, 0.6);
        tone(55, 32, 1.4, 'sine', 0.12, 0.02);
        for (var i = 0; i < 12; i++) bell(4186 - i * 180, 0.3, 0.008, 0.55 + i * 0.045, 0.9);
      }
      if (lv >= 6) {
        tone(700, 3600, 0.7, 'sine', 0.02, 0.1, { wet: 0.9, atk: 0.5 });
        pad([R * 0.667, R * 0.84, R], 1.6, 0.012, 0.6, 2600);
        seq([1568, 1976, 2349, 3136, 3951, 4699], 0.07, 'sine', 0.024, 0.3, { wet: 0.95 });
      }
    },
    // 抽卡池主题切换：一道上扬气流把牌面掀起 + 该主题的专属音色
    theme: function (id) {
      noise(0.32, 0.04, 700, 0, 3800, { type: 'bandpass', q: 0.9, atk: 0.2, wet: 0.4 });
      (THEME_SND[id] || THEME_SND.all)();
    },
    // 换牌背时单张牌被弹翻：清脆的卡纸"嗒"，逐张音高略升
    flick: function (k) {
      var n = k || 0;
      snap(0.055, 3600);
      noise(0.06, 0.035, 2800, 0, 1100, { type: 'bandpass', q: 1.1 });
      tone(880 * (1 + n * 0.12), 0, 0.12, 'sine', 0.013, 0.01, { wet: 0.6 });
    },

    /* —— 拼写 / 收服 —— */
    correct: function (i) {
      var n = Math.max(0, Math.min(12, i || 0));
      tone(660 * Math.pow(1.0595, n), 0, 0.06, 'triangle', 0.055);
      tone(1320 * Math.pow(1.0595, n), 0, 0.045, 'sine', 0.022, 0.01);
    },
    wrong: function () { tone(300, 150, 0.13, 'triangle', 0.055); noise(0.1, 0.07, 700); },
    // 完美收服：落章冲击 → 铜管 I–V–I 号角 → 钟铃瀑布 → 弦乐长铺底 + 满天星尘；t 为卡牌档位，越高越隆重
    perfect: function (t) {
      t = t || 1;
      snap(0.1, 3000);
      thump(0.16 + Math.min(t, 6) * 0.015, 0, 120);
      stab([523, 659, 784], 0.03, 0.02, 0.2);
      stab([587, 784, 988], 0.028, 0.16, 0.18);
      stab([523, 659, 784, 1046], 0.034, 0.3, 1.0);
      [1046, 1318, 1568, 2093, 2637].forEach(function (f, i) { bell(f, 0.8, 0.026, 0.3 + i * 0.06); });
      pad([131, 196, 262, 330], 2.0, 0.014, 0.3, 2200);
      swell(0.3, 0.02, 0, 2000, 9000);
      noise(1.2, 0.022, 9000, 0.3, 4000, { type: 'highpass', wet: 0.9 });
      sparkle(18 + t * 3, 0.45, 1.1, 0.011);
      if (t >= 5) { bell(131, 2.4, 0.06, 0.3, 0.6); tone(49, 30, 1.4, 'sine', 0.1, 0.3); }
    },
    good: function (t) {
      snap(0.08, 3000);
      thump(0.12, 0, 120);
      [784, 988, 1175, 1568].forEach(function (f, i) { bell(f, 0.7, 0.03, 0.02 + i * 0.065); });
      pad([196, 247, 294], 1.2, 0.012, 0.2, 1800);
      sparkle(8 + (t || 1) * 2, 0.3, 0.7, 0.01);
    },
    plain: function () {
      snap(0.06, 3000);
      thump(0.08, 0, 110);
      bell(784, 0.6, 0.032, 0.02);
      bell(1175, 0.7, 0.026, 0.1);
      sparkle(6, 0.2, 0.5, 0.009);
    },
    // 失败：卡身挣扎的不和谐低音 + 灼烧噼啪 → 一道上扬风声飞走 → 小调钟声收尾
    fail: function () {
      tone(220, 0, 0.42, 'sawtooth', 0.04, 0, { lp: 900 });
      tone(233, 0, 0.42, 'sawtooth', 0.035, 0, { lp: 900 });
      tone(110, 70, 0.4, 'sine', 0.1);
      for (var i = 0; i < 10; i++) noise(0.016, 0.03, 2400 + Math.random() * 2600, Math.random() * 0.45, 0, { type: 'bandpass', q: 2.2 });
      noise(0.55, 0.06, 500, 0.12, 3600, { type: 'bandpass', q: 0.9, atk: 0.3, wet: 0.4 });
      bell(392, 0.9, 0.028, 0.45, 0.75);
      bell(311, 1.1, 0.026, 0.62, 0.8);
    },
    abandon: function () {
      noise(0.45, 0.05, 600, 0, 3200, { type: 'bandpass', q: 0.9, atk: 0.25, wet: 0.4 });
      bell(330, 0.8, 0.024, 0.3, 0.75);
    },

    /* —— 局外成长 —— */
    claim: function () { seq([1046, 1318], 0.06, 'triangle', 0.055, 0.1, { wet: 0.3 }); },
    achieve: function () { seq([659, 880, 1046, 1318], 0.085, 'triangle', 0.05, 0.14, { wet: 0.4 }); },
    achieveGacha: function () {
      seq([784, 988, 1318, 1760], 0.075, 'sine', 0.055, 0.13, { wet: 0.55 });
      tone(110, 52, 0.7, 'sine', 0.1, 0.03, { wet: 0.35 });
      noise(0.42, 0.045, 5200, 0.12, 1800, { wet: 0.7 });
    },
    achieveStudy: function () {
      seq([523, 659, 784, 1046], 0.1, 'triangle', 0.045, 0.16, { wet: 0.45 });
      tone(1568, 0, 0.42, 'sine', 0.025, 0.38, { wet: 0.7 });
    },
    achieveBattle: function () {
      tone(120, 48, 0.35, 'sine', 0.13, 0.02);
      seq([392, 523, 784, 1046], 0.09, 'sawtooth', 0.04, 0.14, { lp: 3200, wet: 0.4 });
      noise(0.24, 0.07, 1800, 0.2, 420, { wet: 0.35 });
    },
    // 成就弹窗：重击 + 极速上行琶音 + 金币闪响，lv 1~4 越高越隆重
    jackpot: function (lv) {
      lv = Math.max(1, Math.min(4, lv || 1));
      tone(150, 38, 0.45, 'sine', 0.26, 0);
      noise(0.16, 0.14, 3200, 0, 260);
      seq([1046, 1318, 1568, 2093], 0.042, 'square', 0.028, 0.09, { lp: 5200, wet: 0.35 });
      tone(523, 0, 0.55, 'triangle', 0.05, 0.17, { wet: 0.4 });
      tone(784, 0, 0.55, 'triangle', 0.04, 0.17, { wet: 0.4 });
      tone(1046, 0, 0.6, 'sine', 0.04, 0.17, { wet: 0.5 });
      for (var i = 0; i < 3 + lv * 2; i++) tone(i % 2 ? 3136 : 2637, 0, 0.07, 'sine', 0.03, 0.24 + i * 0.055, { wet: 0.6 });
      if (lv >= 3) { noise(0.6, 0.05, 7000, 0.2, 2600, { wet: 0.7 }); tone(110, 55, 0.8, 'sawtooth', 0.06, 0.04, { lp: 900 }); }
      if (lv >= 4) seq([1568, 2093, 2637, 3136, 4186], 0.06, 'sine', 0.03, 0.2, { wet: 0.7 });
    },
    unlock: function () { tone(220, 880, 0.2, 'sawtooth', 0.04); seq([880, 1174], 0.08, 'triangle', 0.05, 0.12, { wet: 0.3 }); },
    upgrade: function (lv) {
      var base = [523, 587, 659, 698, 784, 880][Math.max(0, Math.min(5, (lv || 1) - 1))];
      seq([base, base * 1.25, base * 1.5, base * 2], 0.055, 'triangle', 0.055, 0.1, { wet: 0.3 });
    },
    start: function () { tone(311, 466, 0.22, 'sawtooth', 0.05); tone(622, 932, 0.26, 'triangle', 0.05, 0.1); noise(0.3, 0.06, 1800, 0.05, 400); },

    /* —— 结算 —— */
    // 成长点计数：p 为进度 0~1，音高随进度抬升，像金币一枚枚入袋
    scoreTick: function (p) { tone(1200 + (p || 0) * 1000, 0, 0.03, 'sine', 0.014); },
    inkDone: function () { tone(1568, 0, 0.18, 'triangle', 0.04, 0, { wet: 0.5 }); tone(2349, 0, 0.25, 'sine', 0.025, 0.06, { wet: 0.6 }); },
    // 通关庆祝：评级落章 → 号角琶音 → 大三和弦铺底 → 星星逐颗叮 → 满屏闪光
    win: function (stars) {
      tone(90, 45, 0.25, 'sine', 0.16, 0.12); noise(0.12, 0.1, 1200, 0.12, 200);
      seq([523, 659, 784, 1046], 0.09, 'triangle', 0.05, 0.2, { wet: 0.5 });
      [523, 659, 784, 1046].forEach(function (f) { tone(f, 0, 1.3, 'triangle', 0.02, 0.36, { wet: 0.5, atk: 0.04 }); });
      tone(131, 0, 1.2, 'sine', 0.08, 0.36);
      noise(0.3, 0.06, 4000, 0.36, 0, { type: 'bandpass', q: 0.7 });
      var n = Math.max(0, Math.min(3, stars == null ? 3 : stars));
      [1046, 1318, 1568].slice(0, n).forEach(function (f, i) {
        var d = 0.35 + i * 0.15 + 0.1;
        tone(f, 0, 0.3, 'triangle', 0.05, d, { wet: 0.6 });
        tone(f * 2, 0, 0.35, 'sine', 0.02, d + 0.01, { wet: 0.7 });
      });
      for (var i = 0; i < 14; i++) tone(2000 + Math.random() * 2600, 0, 0.12, 'sine', 0.009, 0.6 + i * 0.06, { wet: 0.8 });
    },
    lose: function () {
      tone(80, 45, 0.3, 'sine', 0.12, 0.1);
      seq([440, 370, 294, 220], 0.16, 'sine', 0.05, 0.3, { wet: 0.5 });
    },
  };

  /* —— 对局 BGM：实时合成的循环音序（16 分音符步进，提前 0.15 秒排程）——
     stage：A 小调 Am-F-C-G，轻快琶音；boss：D 小调 Dm-Bb-Gm-A，更快、更密、加贝斯切分 */
  var MUSIC = {
    stage: { bpm: 124, vol: 0.32, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], arp: [0, 1, 2, 1, 0, 2, 1, 2], hat: 0.5, busy: 0 },
    boss: { bpm: 142, vol: 0.36, chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]], arp: [0, 2, 1, 2, 0, 2, 1, 0], hat: 1, busy: 1 },
  };
  var mus = { mode: null, step: 0, next: 0, timer: 0, g: null, duckT: 0 };
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function musicBus(a) {
    if (!mus.g) { mus.g = a.createGain(); mus.g.gain.value = 0; mus.g.connect(bus); }
    return mus.g;
  }
  function musicStep(a, cfg, s, t) {
    var dest = mus.g, d = t - a.currentTime, o = { dest: dest };
    var beat = s % 16, bar = ((s / 16) | 0) % 4, ch = cfg.chords[bar], sp = 60 / cfg.bpm / 4;
    // 柔和底鼓（低音量、短）+ 反拍军鼓 + 16 分镲
    if (beat % 4 === 0) tone(110, 48, 0.16, 'sine', 0.1, d, o);
    if (beat === 4 || beat === 12) noise(0.12, 0.05, 1900, d, 900, { dest: dest, type: 'bandpass', q: 0.8 });
    if (cfg.hat >= 1 || beat % 2 === 0) noise(0.03, beat % 4 === 2 ? 0.03 : 0.016, 7500, d, 7500, { dest: dest, type: 'highpass' });
    // 贝斯：八分音符根音，boss 段加切分
    if (beat % 2 === 0 || (cfg.busy && (beat === 7 || beat === 15))) {
      tone(mtof(ch[0] - 24), 0, sp * 1.7, 'sawtooth', 0.06, d, { dest: dest, lp: 420 });
    }
    // 琶音：三和弦按图案上下跳，每两小节升一个八度做起伏
    var ni = cfg.arp[beat % cfg.arp.length], oct = (bar % 2 && beat >= 8) ? 12 : 0;
    tone(mtof(ch[ni] + 12 + oct), 0, sp * 1.4, 'triangle', 0.028, d, { dest: dest, wet: 0.35 });
    // 每小节一次铺底和弦
    if (beat === 0) ch.forEach(function (n) { tone(mtof(n), 0, sp * 15, 'triangle', 0.012, d, { dest: dest, lp: 1400, atk: 0.12, wet: 0.3 }); });
  }
  function musicTick() {
    var a = ac;
    if (!a || !mus.mode || !on || a.state !== 'running' || (global.document && document.hidden)) {
      if (a) mus.next = Math.max(mus.next, a.currentTime + 0.05);
      return;
    }
    var cfg = MUSIC[mus.mode], sp = 60 / cfg.bpm / 4;
    if (mus.next < a.currentTime) mus.next = a.currentTime + 0.05;
    while (mus.next < a.currentTime + 0.15) {
      try { musicStep(a, cfg, mus.step, mus.next); } catch (e) {}
      mus.step++;
      mus.next += sp;
    }
  }
  function musicVol(v, fade) {
    if (!ac || !mus.g) return;
    var t = ac.currentTime;
    mus.g.gain.cancelScheduledValues(t);
    mus.g.gain.setValueAtTime(mus.g.gain.value, t);
    mus.g.gain.linearRampToValueAtTime(v, t + (fade || 0.4));
  }
  function musicSet(mode) {
    var a = actx(); if (!a) return;
    musicBus(a);
    if (!mode) {
      musicVol(0, 0.6);
      var m0 = mus.mode;
      mus.mode = null;
      clearTimeout(mus.stopTm);
      mus.stopTm = setTimeout(function () { if (!mus.mode && mus.timer) { clearInterval(mus.timer); mus.timer = 0; } }, 700);
      return m0;
    }
    if (mus.mode === mode) return;
    var fresh = !mus.mode;
    mus.mode = mode;
    // 切到 boss 时从下一小节起拍，保持节奏连贯
    if (fresh) { mus.step = 0; mus.next = a.currentTime + 0.1; } else mus.step = Math.ceil(mus.step / 16) * 16;
    musicVol(on ? MUSIC[mode].vol : 0, fresh ? 1.2 : 0.3);
    if (!mus.timer) mus.timer = setInterval(musicTick, 25);
  }

  // 首次触摸 / 点击就把音频上下文准备好（iOS 只允许在手势里创建）
  try {
    var kick = function () {
      if (on) actx();
      global.removeEventListener('pointerdown', kick);
      global.removeEventListener('touchstart', kick);
    };
    global.addEventListener('pointerdown', kick);
    global.addEventListener('touchstart', kick);
  } catch (e) {}

  global.Sfx = {
    play: function (n, arg) {
      if (!on || !lib[n]) return;
      lastAt = (global.performance ? performance.now() : Date.now());
      try { lib[n](arg); } catch (e) {}
    },
    // 停掉大招持续音层（大招被打断 / 退出对局时）
    stopBed: function () { try { stopBed(0.2); } catch (e) {} },
    // 对局 BGM：'stage' / 'boss' / null（淡出停止）
    music: function (mode) { try { musicSet(mode); } catch (e) {} },
    // 大招期间把 BGM 压低，sec 秒后恢复
    duck: function (sec) {
      if (!mus.mode || !on) return;
      try {
        musicVol(MUSIC[mus.mode].vol * 0.35, 0.15);
        clearTimeout(mus.duckTm);
        mus.duckTm = setTimeout(function () { if (mus.mode && on) musicVol(MUSIC[mus.mode].vol, 0.8); }, (sec || 1.5) * 1000);
      } catch (e) {}
    },
    // 刚刚响过（用于避免按钮点按声叠加在专门音效上）
    recent: function (ms) {
      var now = (global.performance ? performance.now() : Date.now());
      return now - lastAt < (ms || 80);
    },
    unlock: function () { if (on) actx(); },
    isOn: function () { return on; },
    toggle: function () {
      on = !on;
      try { localStorage.setItem('wg_sfx', on ? '1' : '0'); } catch (e) {}
      if (on) actx(); else stopBed(0.1);
      if (mus.mode) musicVol(on ? MUSIC[mus.mode].vol : 0, 0.3);
      return on;
    },
  };
})(window);
