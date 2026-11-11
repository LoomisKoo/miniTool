/* 抽卡特效：Canvas 粒子 + 光环 */
(function (global) {
  'use strict';

  var cv = null, ctx = null, parts = [], raf = 0, running = false;

  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.className = 'fx-canvas';
    cv.style.display = 'none';
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = window.innerWidth * dpr;
    cv.height = window.innerHeight * dpr;
    cv.style.width = window.innerWidth + 'px';
    cv.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  var GOLD = ['#fff3cf', '#f2dca0', '#d9b45c', '#c9a227', '#a8851c'];
  var COOL = ['#e8f2ff', '#b9d4ef', '#8fb3d4', '#6d90b3', '#4a6b8c'];
  var ROSE = ['#ffe3ea', '#f2b8c6', '#d98fa3', '#b96d84', '#8e4a60'];

  function paletteFor(tier) {
    if (tier >= 5) return ROSE;
    if (tier >= 4) return GOLD;
    if (tier >= 3) return COOL;
    return GOLD;
  }

  /** 从屏幕中心炸开 */
  function burst(tier, opts) {
    ensure();
    opts = opts || {};
    var cx = opts.x != null ? opts.x : window.innerWidth / 2;
    var cy = opts.y != null ? opts.y : window.innerHeight * 0.42;
    var pal = paletteFor(tier || 1);
    var n = opts.count || (tier >= 4 ? 90 : tier >= 3 ? 64 : 44);
    // 传入 w/h 时从卡边往外发射，卡面中间不落粒子
    var hw = opts.w ? opts.w / 2 : 0, hh = opts.h ? opts.h / 2 : 0;
    var r0 = hw ? Math.hypot(hw, hh) * 0.92 : 8;

    // 光环
    parts.push({
      k: 'ring', x: cx, y: cy, r: r0, v: (hw ? 4 : 9) + tier * (hw ? 1.2 : 2.4),
      life: 1, decay: 0.022, c: pal[1], lw: 2 + tier * 0.45,
    });
    if (tier >= 4) {
      parts.push({
        k: 'ring', x: cx, y: cy, r: hw ? r0 * 0.96 : 4, v: hw ? 3 : 5.5, delay: 9,
        life: 1, decay: 0.016, c: pal[0], lw: 1.2,
      });
    }

    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 2.2 + Math.random() * (tier >= 4 ? 11 : 7);
      var sq = Math.random() < 0.45;
      var x0 = cx, y0 = cy;
      if (hw) {
        var ca = Math.cos(a), sa = Math.sin(a);
        var t = Math.min(hw / Math.abs(ca || 1e-6), hh / Math.abs(sa || 1e-6));
        x0 = cx + ca * t;
        y0 = cy + sa * t;
        sp *= 0.6;
      }
      parts.push({
        k: hw && Math.random() < 0.3 ? 'star' : sq ? 'sq' : 'dot',
        x: x0, y: y0,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (hw ? 0.6 : 1.6),
        g: 0.055 + Math.random() * 0.06,
        size: 1.6 + Math.random() * (tier >= 4 ? 6 : 3.6),
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.28,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        c: pal[(Math.random() * pal.length) | 0],
        trail: Math.random() < 0.35,
      });
    }
    start();
  }

  /** 细碎流光（卡面入场用）*/
  function sprinkle(n, tier) {
    ensure();
    var pal = paletteFor(tier || 1);
    for (var i = 0; i < n; i++) {
      var x = Math.random() * window.innerWidth;
      var y = window.innerHeight * (0.16 + Math.random() * 0.5);
      parts.push({
        k: 'dot', x: x, y: y,
        vx: (Math.random() - 0.5) * 0.7,
        vy: -0.35 - Math.random() * 0.7,
        g: 0.004,
        size: 1 + Math.random() * 2.2,
        rot: 0, vr: 0,
        life: 1, decay: 0.007 + Math.random() * 0.01,
        c: pal[(Math.random() * pal.length) | 0],
        trail: false,
      });
    }
    start();
  }

  function step() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var alive = false;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.delay > 0) { p.delay--; alive = true; continue; }
      if (p.k === 'ring') {
        p.r += p.v;
        p.v *= 0.955;
        p.life -= p.decay;
        if (p.life <= 0) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.strokeStyle = p.c;
        ctx.globalAlpha = Math.max(0, p.life) * 0.7;
        ctx.lineWidth = p.lw * p.life;
        ctx.stroke();
        ctx.globalAlpha = 1;
        alive = true;
        continue;
      }
      p.vy += p.g;
      p.vx *= 0.988;
      p.vy *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.decay;
      if (p.life <= 0) continue;
      alive = true;
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.trail) {
        ctx.strokeStyle = p.c;
        ctx.lineWidth = p.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.6, p.y - p.vy * 2.6);
        ctx.stroke();
      }
      if (p.k === 'sq') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
        ctx.restore();
      } else if (p.k === 'star') {
        var R = p.size * 1.5, q = R * 0.22;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * 0.3);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.moveTo(0, -R);
        ctx.quadraticCurveTo(q, -q, R, 0);
        ctx.quadraticCurveTo(q, q, 0, R);
        ctx.quadraticCurveTo(-q, q, -R, 0);
        ctx.quadraticCurveTo(-q, -q, 0, -R);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.55, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    parts = parts.filter(function (p) { return p.life > 0 || p.delay > 0; });
    if (alive && parts.length) {
      raf = requestAnimationFrame(step);
    } else {
      running = false;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (cv) cv.style.display = 'none';   // 空闲时不占一层全屏合成
    }
  }

  function start() {
    if (running) return;
    running = true;
    if (cv) cv.style.display = 'block';
    raf = requestAnimationFrame(step);
  }

  global.FX = { burst: burst, sprinkle: sprinkle };
})(window);
