/* global window */
(function (global) {
  'use strict';

  function BreathEngine() {
    var self = this;
    self.stream = null;
    self.ac = null;
    self.analyser = null;
    self.buf = null;
    self.baseline = 0.015;
    self.smooth = 0;
    self.peak = 0;
    self.sustainSec = 0;
    self._sustainAbove = false;
    self._sustainStart = 0;
    self._varSum = 0;
    self._varN = 0;
    self._lastSmooth = 0;
    self.sim = 0;
    self.active = false;
    self.threshold = 0.12;
  }

  BreathEngine.prototype._rms = function () {
    if (!this.analyser || !this.buf) return 0;
    this.analyser.getFloatTimeDomainData(this.buf);
    var s = 0;
    for (var i = 0; i < this.buf.length; i++) {
      var v = this.buf[i];
      s += v * v;
    }
    return Math.sqrt(s / this.buf.length);
  };

  BreathEngine.prototype.start = function () {
    var self = this;
    var nav = navigator.mediaDevices;
    if (!nav || !nav.getUserMedia) {
      return Promise.reject(new Error('no-mic'));
    }
    return nav.getUserMedia({ audio: true, video: false }).then(function (stream) {
      self.stream = stream;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('no-audio');
      self.ac = new AC();
      var src = self.ac.createMediaStreamSource(stream);
      self.analyser = self.ac.createAnalyser();
      self.analyser.fftSize = 2048;
      self.analyser.smoothingTimeConstant = 0.55;
      src.connect(self.analyser);
      self.buf = new Float32Array(self.analyser.fftSize);
      self.active = true;
      return self.ac.resume();
    });
  };

  BreathEngine.prototype.stop = function () {
    this.active = false;
    if (this.stream) {
      this.stream.getTracks().forEach(function (t) {
        t.stop();
      });
      this.stream = null;
    }
    if (this.ac) {
      this.ac.close().catch(function () {});
      this.ac = null;
    }
    this.analyser = null;
    this.buf = null;
  };

  BreathEngine.prototype.resetSession = function () {
    this.peak = 0;
    this.sustainSec = 0;
    this._sustainAbove = false;
    this._sustainStart = 0;
    this._varSum = 0;
    this._varN = 0;
    this.smooth = 0;
    this._lastSmooth = 0;
    this.sim = 0;
  };

  BreathEngine.prototype.calibrate = function (ms) {
    var engine = this;
    var start = performance.now();
    var acc = 0;
    var n = 0;
    return new Promise(function (resolve) {
      function step() {
        if (!engine.active) {
          resolve();
          return;
        }
        var r = engine._rms();
        acc += r;
        n++;
        if (performance.now() - start >= ms) {
          engine.baseline = n ? acc / n : 0.015;
          engine.baseline = Math.min(0.08, Math.max(0.008, engine.baseline));
          resolve();
          return;
        }
        requestAnimationFrame(step);
      }
      step();
    });
  };

  BreathEngine.prototype.setSimulating = function (on, strength) {
    this.sim = on ? (strength != null ? strength : 0.75) : 0;
  };

  BreathEngine.prototype.tick = function (dt) {
    var raw = 0;
    if (this.active && this.analyser) {
      raw = this._rms();
    }
    var norm = Math.max(0, raw - this.baseline);
    var gain = norm / 0.13;
    if (gain > 1) gain = 1;
    if (this.sim > 0) {
      gain = Math.max(gain, this.sim);
    }
    var target = gain;
    /* 起气快、收气稍慢，像真的气流 */
    var k = target > this.smooth ? 0.5 : 0.14;
    this.smooth += (target - this.smooth) * k;
    if (this.smooth < 0.02) this.smooth *= 0.86;

    if (this.smooth > this.peak) this.peak = this.smooth;

    var above = this.smooth >= this.threshold;
    if (above) {
      if (!this._sustainAbove) {
        this._sustainAbove = true;
        this._sustainStart = performance.now();
      }
      this.sustainSec = (performance.now() - this._sustainStart) / 1000;
    } else {
      this._sustainAbove = false;
    }

    var d = this.smooth - this._lastSmooth;
    this._varSum += d * d;
    this._varN++;
    this._lastSmooth = this.smooth;

    var stability = 1;
    if (this._varN > 8) {
      var variance = this._varSum / this._varN;
      stability = 1 - Math.min(1, variance * 120);
      if (stability < 0) stability = 0;
    }

    return {
      flow: this.smooth,
      peak: this.peak,
      sustain: this.sustainSec,
      stability: stability,
      raw: raw
    };
  };

  BreathEngine.prototype.scoreLung = function (stability) {
    var p = this.peak;
    var s = Math.min(this.sustainSec, 12) / 12;
    var st = stability != null ? stability : 0.5;
    var v = 0.42 * p + 0.38 * s + 0.2 * st;
    var grade = '微风';
    if (v >= 0.78) grade = '飓风';
    else if (v >= 0.58) grade = '大风';
    else if (v >= 0.36) grade = '清风';
    return { value: v, grade: grade, peak: p, sustain: this.sustainSec, stability: st };
  };

  global.BreathEngine = BreathEngine;
})(typeof window !== 'undefined' ? window : globalThis);
