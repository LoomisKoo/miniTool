/* 纯 WebAudio 合成：气流声 / 爆裂 / 过关音，无外部资源 */
(function (global) {
  'use strict';

  function BreathAudio() {
    this.ctx = null;
    this.muted = false;
    this.noise = null;
    this.flowGain = null;
    this.ready = false;
  }

  BreathAudio.prototype.ensure = function () {
    if (this.ready) return true;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch (e) {
      return false;
    }
    var ctx = this.ctx;
    var len = Math.floor(ctx.sampleRate * 2);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    this.noiseBuf = buf;

    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 260;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.Q.value = 0.7;
    var g = ctx.createGain();
    g.gain.value = 0;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    try {
      src.start(0);
    } catch (e2) {
      return false;
    }
    this.flowSrc = src;
    this.flowGain = g;
    this.ready = true;
    return true;
  };

  BreathAudio.prototype.resume = function () {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(function () {});
    }
  };

  BreathAudio.prototype.setMuted = function (m) {
    this.muted = !!m;
    if (this.flowGain) {
      this.flowGain.gain.value = 0;
    }
  };

  BreathAudio.prototype.setFlow = function (v) {
    if (!this.ready || this.muted) return;
    var t = this.ctx.currentTime;
    var target = Math.min(0.22, v * v * 0.26);
    this.flowGain.gain.setTargetAtTime(target, t, 0.05);
  };

  BreathAudio.prototype.blip = function (freq, dur, type, gain) {
    if (!this.ready || this.muted) return;
    var ctx = this.ctx;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = 0;
    o.connect(g);
    g.connect(ctx.destination);
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain != null ? gain : 0.14, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  BreathAudio.prototype.pop = function () {
    if (!this.ready || this.muted) return;
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    var g = ctx.createGain();
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    src.start(t, 0, 0.2);
    var o = ctx.createOscillator();
    var og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(720, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.16);
    og.gain.setValueAtTime(0.22, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(og);
    og.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.2);
  };

  BreathAudio.prototype.fanfare = function () {
    var self = this;
    var notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach(function (f, i) {
      setTimeout(function () {
        self.blip(f, 0.5, 'sine', 0.12);
      }, i * 90);
    });
  };

  BreathAudio.prototype.countdown = function () {
    this.blip(660, 0.14, 'sine', 0.1);
  };

  global.BreathAudio = BreathAudio;
})(typeof window !== 'undefined' ? window : globalThis);
