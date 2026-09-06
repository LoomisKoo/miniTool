(() => {
  const STORAGE_KEY = 'paper-lantern-best';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('scoreNum');
  const sparkEl = document.getElementById('sparkNum');
  const startOv = document.getElementById('startOv');
  const endOv = document.getElementById('endOv');
  const expOv = document.getElementById('expOv');
  const startBtn = document.getElementById('startBtn');
  const againBtn = document.getElementById('againBtn');
  const muteBtn = document.getElementById('muteBtn');
  const saveCardBtn = document.getElementById('saveCardBtn');
  const saveBtn = document.getElementById('saveBtn');
  const expClose = document.getElementById('expClose');
  const expImg = document.getElementById('expImg');
  const bestNum = document.getElementById('bestNum');
  const endScore = document.getElementById('endScore');
  const endBest = document.getElementById('endBest');
  const endSpark = document.getElementById('endSpark');

  let W = 0, H = 0, dpr = 1;
  let muted = false;
  let audioCtx = null;

  // 固定星点，避免每帧随机闪烁
  const starField = [];
  for (let i = 0; i < 56; i++) {
    starField.push({
      x: Math.random(),
      y: Math.random() * 0.62,
      r: 0.5 + Math.random() * 1.6,
      a: 0.25 + Math.random() * 0.55,
      tw: Math.random() * Math.PI * 2,
    });
  }

  const state = {
    mode: 'ready', // ready | play | dead
    score: 0,
    sparks: 0,
    sparkCombo: 0,
    best: 0,
    bird: null,
    pipes: [],
    groundX: 0,
    t: 0,
    lastTs: 0,
    flapFlash: 0,
    armed: false,
  };

  try {
    state.best = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
  } catch (_) {}
  bestNum.textContent = String(state.best);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function unit() {
    return Math.min(W, H) / 390;
  }

  function makeBird() {
    const u = unit();
    return {
      x: W * 0.28,
      y: H * 0.42,
      vy: 0,
      r: 12 * u,
      swing: 0,
      glow: 1,
    };
  }

  function gapSize() {
    const u = unit();
    const base = 128 * u;
    const shrink = Math.min(state.score * 1.4 * u, 28 * u);
    return Math.max(base - shrink, 102 * u);
  }

  function pipeW() {
    return 54 * unit();
  }

  function makeSparks(pipe) {
    const u = unit();
    const count = 1 + ((Math.random() * 2) | 0);
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        ox: pipeW() * (0.25 + Math.random() * 0.5),
        oy: pipe.gap * (0.28 + Math.random() * 0.44),
        r: (3.2 + Math.random() * 2.2) * u,
        phase: Math.random() * Math.PI * 2,
        got: false,
      });
    }
    return list;
  }

  function spawnPipe(x, opts) {
    const u = unit();
    const ground = groundH();
    const gap = (opts && opts.gap) || gapSize();
    const topMin = 80 * u;
    const topMax = H - ground - gap - 80 * u;
    const range = Math.max(20, topMax - topMin);
    let top;
    if (opts && opts.centerY != null) {
      top = opts.centerY - gap * 0.5;
    } else {
      top = topMin + Math.random() * range;
    }
    if (opts && opts.prevCenter != null) {
      const maxDelta = 72 * u;
      const center = top + gap * 0.5;
      const lo = opts.prevCenter - maxDelta;
      const hi = opts.prevCenter + maxDelta;
      const clamped = Math.max(lo, Math.min(hi, center));
      top = clamped - gap * 0.5;
    }
    top = Math.max(topMin, Math.min(topMax, top));
    const pipe = { x, top, gap, scored: false, sparks: null };
    pipe.sparks = makeSparks(pipe);
    return pipe;
  }

  function groundH() {
    return Math.max(96 * unit(), H * 0.16);
  }

  function resetGame() {
    state.score = 0;
    state.sparks = 0;
    state.sparkCombo = 0;
    scoreEl.textContent = '0';
    sparkEl.textContent = '0';
    state.bird = makeBird();
    state.pipes = [];
    state.groundX = 0;
    state.t = 0;
    state.flapFlash = 0;
    const u = unit();
    const spacing = 220 * u;
    let x = W + 180 * u;
    state.pipes.push(spawnPipe(x, { centerY: H * 0.42, gap: 136 * u }));
    x += spacing;
    for (let i = 0; i < 3; i++) {
      const prev = state.pipes[state.pipes.length - 1];
      state.pipes.push(spawnPipe(x, { prevCenter: prev.top + prev.gap * 0.5 }));
      x += spacing;
    }
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function beep(freq, dur, type, vol) {
    if (muted || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur);
  }

  function flap() {
    if (state.mode !== 'play') return;
    state.armed = true;
    const u = unit();
    state.bird.vy = -340 * u;
    state.flapFlash = 1;
    beep(520, 0.09, 'triangle', 0.06);
  }

  function startPlay() {
    ensureAudio();
    resetGame();
    state.mode = 'play';
    state.armed = false;
    startOv.classList.remove('show');
    endOv.classList.remove('show');
    expOv.classList.remove('show');
    state.lastTs = performance.now();
  }

  function die() {
    if (state.mode !== 'play') return;
    state.mode = 'dead';
    state.sparkCombo = 0;
    beep(180, 0.22, 'sawtooth', 0.09);
    setTimeout(() => beep(120, 0.28, 'sawtooth', 0.07), 90);
    if (state.score > state.best) {
      state.best = state.score;
      try { localStorage.setItem(STORAGE_KEY, String(state.best)); } catch (_) {}
    }
    endScore.textContent = String(state.score);
    endBest.innerHTML = '<span class="dot"></span>最高 ' + state.best;
    endSpark.innerHTML = '<span class="dot spark"></span>灯火 ' + state.sparks;
    bestNum.textContent = String(state.best);
    endOv.classList.add('show');
  }

  function hitTest() {
    const b = state.bird;
    const g = groundH();
    const hr = b.r * 0.85;
    if (b.y + b.r * 0.9 >= H - g) return true;
    if (b.y - b.r * 0.9 <= 0) return true;
    const pw = pipeW();
    for (const p of state.pipes) {
      if (b.x + hr > p.x && b.x - hr < p.x + pw) {
        if (b.y - hr < p.top || b.y + hr > p.top + p.gap) return true;
      }
    }
    return false;
  }

  function collectSparks() {
    const b = state.bird;
    for (const p of state.pipes) {
      if (!p.sparks) continue;
      for (const s of p.sparks) {
        if (s.got) continue;
        const sx = p.x + s.ox;
        const sy = p.top + s.oy;
        const dx = b.x - sx;
        const dy = b.y - sy;
        const rr = b.r + s.r + 6 * unit();
        if (dx * dx + dy * dy < rr * rr) {
          s.got = true;
          state.sparks += 1;
          state.sparkCombo += 1;
          const add = state.sparkCombo; // 连击：1,2,3…
          state.score += add;
          scoreEl.textContent = String(state.score);
          sparkEl.textContent = String(state.sparks);
          beep(720 + Math.min(state.sparkCombo, 8) * 60, 0.07, 'sine', 0.055);
        }
      }
    }
  }

  function update(dt) {
    const u = unit();
    const scrolling = state.mode === 'play' && state.armed;
    const speed = scrolling ? (148 + Math.min(state.score * 3.5, 70)) * u : 0;
    state.t += dt;
    state.flapFlash = Math.max(0, state.flapFlash - dt * 3.2);

    if (scrolling) {
      // 连续累加，绘制时再按 tile 取模，避免 % 与 tile 不一致造成卡顿
      state.groundX -= speed * dt;
    }

    if (state.mode !== 'play') {
      if (state.mode === 'ready' && state.bird) {
        state.bird.y = H * 0.42 + Math.sin(state.t * 2.2) * 6 * u;
        state.bird.swing = Math.sin(state.t * 1.6) * 0.08;
        state.bird.glow = 0.9 + Math.sin(state.t * 2.4) * 0.1;
      }
      return;
    }

    const b = state.bird;
    if (!state.armed) {
      b.y = H * 0.42 + Math.sin(state.t * 2.2) * 6 * u;
      b.swing = Math.sin(state.t * 1.6) * 0.08;
      b.glow = 0.9 + Math.sin(state.t * 2.4) * 0.1;
      return;
    }

    b.vy += 1520 * u * dt;
    b.vy = Math.min(b.vy, 720 * u);
    b.y += b.vy * dt;
    // 灯笼：轻摆，保持大致竖直（不像鸟俯冲）
    const targetSwing = Math.max(-0.22, Math.min(0.22, b.vy / (900 * u)));
    b.swing += (targetSwing - b.swing) * Math.min(1, dt * 6);
    b.glow = 1 + state.flapFlash * 0.55;

    const spacing = 220 * u;
    for (const p of state.pipes) {
      p.x -= speed * dt;
      if (!p.scored && p.x + pipeW() < b.x) {
        p.scored = true;
        state.score += 1;
        scoreEl.textContent = String(state.score);
        beep(760, 0.07, 'triangle', 0.055);
      }
    }
    state.pipes = state.pipes.filter(p => {
      if (p.x > -pipeW() - 20) return true;
      if (p.sparks && p.sparks.some(s => !s.got)) state.sparkCombo = 0;
      return false;
    });
    while (state.pipes.length < 4) {
      const last = state.pipes[state.pipes.length - 1];
      const nx = (last ? last.x : W) + spacing;
      const prevCenter = last ? last.top + last.gap * 0.5 : H * 0.42;
      state.pipes.push(spawnPipe(nx, { prevCenter: prevCenter }));
    }

    collectSparks();
    if (hitTest()) die();
  }

  function drawSky() {
    const u = unit();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#14102a');
    g.addColorStop(0.4, '#1e1638');
    g.addColorStop(0.72, '#2a1c3e');
    g.addColorStop(1, '#3a2440');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const s of starField) {
      const tw = 0.55 + 0.45 * Math.sin(state.t * 1.6 + s.tw);
      ctx.fillStyle = 'rgba(255,245,220,' + (s.a * tw) + ')';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r * u, 0, Math.PI * 2);
      ctx.fill();
    }

    // 满月：偏左上，避开右侧灯柱遮挡
    const mx = W * 0.22, my = H * 0.12, mr = 26 * u;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 2.6);
    mg.addColorStop(0, 'rgba(255,240,200,0.4)');
    mg.addColorStop(0.5, 'rgba(255,220,160,0.12)');
    mg.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff4d4';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    // 轻微明暗，仍保持完整圆盘
    const shade = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.3, mr * 0.15, mx, my, mr);
    shade.addColorStop(0, 'rgba(255,255,245,0.55)');
    shade.addColorStop(0.55, 'rgba(255,230,180,0)');
    shade.addColorStop(1, 'rgba(180,140,80,0.18)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,180,120,0.18)';
    ctx.beginPath();
    ctx.arc(mx + mr * 0.28, my + mr * 0.18, mr * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx - mr * 0.2, my + mr * 0.4, mr * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // distant hills
    const gy = H - groundH();
    ctx.fillStyle = 'rgba(18, 12, 32, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.quadraticCurveTo(W * 0.18, gy - 54 * u, W * 0.38, gy - 14 * u);
    ctx.quadraticCurveTo(W * 0.58, gy - 72 * u, W * 0.82, gy - 20 * u);
    ctx.quadraticCurveTo(W * 0.94, gy - 10 * u, W, gy - 28 * u);
    ctx.lineTo(W, gy);
    ctx.closePath();
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawLanternOrnament(cx, cy, scale, hueShift) {
    const u = unit();
    const s = scale * u;
    ctx.save();
    ctx.translate(cx, cy);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 18 * s);
    glow.addColorStop(0, 'rgba(255,200,100,' + (0.45 + hueShift * 0.1) + ')');
    glow.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 18 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5a3828';
    ctx.beginPath();
    ctx.ellipse(0, -10 * s, 6 * s, 2.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(-8 * s, 0, 8 * s, 0);
    body.addColorStop(0, '#e07830');
    body.addColorStop(0.5, '#ffc56a');
    body.addColorStop(1, '#d06028');
    ctx.fillStyle = body;
    roundRect(-7 * s, -9 * s, 14 * s, 16 * s, 5 * s);
    ctx.fill();

    ctx.strokeStyle = 'rgba(90,50,20,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -9 * s);
    ctx.lineTo(0, 7 * s);
    ctx.stroke();

    ctx.strokeStyle = '#d4a060';
    ctx.beginPath();
    ctx.moveTo(0, 7 * s);
    ctx.lineTo(0, 12 * s);
    ctx.stroke();
    ctx.fillStyle = '#ff9a4a';
    ctx.beginPath();
    ctx.arc(0, 13 * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPipe(p) {
    const pw = pipeW();
    const u = unit();
    const lip = 11 * u;
    const lipH = 22 * u;

    function pillar(y, h, flip) {
      if (h <= 0) return;
      const grad = ctx.createLinearGradient(p.x, 0, p.x + pw, 0);
      grad.addColorStop(0, '#3a2048');
      grad.addColorStop(0.35, '#6a3a58');
      grad.addColorStop(0.55, '#8a4a40');
      grad.addColorStop(1, '#2a1838');
      ctx.fillStyle = grad;
      roundRect(p.x, y, pw, h, 8 * u);
      ctx.fill();

      // warm edge glow
      ctx.fillStyle = 'rgba(255,170,80,0.18)';
      ctx.fillRect(p.x + 5 * u, y + 3 * u, 5 * u, Math.max(0, h - 6 * u));

      const ly = flip ? y : y + h - lipH;
      const lg = ctx.createLinearGradient(p.x - lip, 0, p.x + pw + lip, 0);
      lg.addColorStop(0, '#5a2838');
      lg.addColorStop(0.4, '#c06038');
      lg.addColorStop(1, '#3a1830');
      ctx.fillStyle = lg;
      roundRect(p.x - lip, ly, pw + lip * 2, lipH, 10 * u);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,120,0.35)';
      ctx.lineWidth = 1.5;
      roundRect(p.x - lip, ly, pw + lip * 2, lipH, 10 * u);
      ctx.stroke();

      // hanging lantern ornaments along the pillar
      const step = 36 * u;
      const start = flip ? y + lipH + 10 * u : y + 14 * u;
      const end = flip ? y + h - 8 * u : y + h - lipH - 8 * u;
      for (let yy = start; yy < end; yy += step) {
        drawLanternOrnament(p.x + pw * 0.5, yy, 0.85, Math.sin(yy * 0.05));
      }
    }

    pillar(0, p.top, false);
    pillar(p.top + p.gap, H - groundH() - (p.top + p.gap), true);

    // sparks in the gap
    if (p.sparks) {
      for (const s of p.sparks) {
        if (s.got) continue;
        const sx = p.x + s.ox;
        const sy = p.top + s.oy + Math.sin(state.t * 3 + s.phase) * 4 * u;
        const pulse = 0.7 + 0.3 * Math.sin(state.t * 5 + s.phase);
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 3.2);
        glow.addColorStop(0, 'rgba(255,230,160,' + (0.7 * pulse) + ')');
        glow.addColorStop(0.45, 'rgba(255,160,60,0.35)');
        glow.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.arc(sx, sy, s.r * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGround() {
    const g = groundH();
    const u = unit();
    const y = H - g;
    const water = ctx.createLinearGradient(0, y, 0, H);
    water.addColorStop(0, '#2a1840');
    water.addColorStop(0.35, '#1a1030');
    water.addColorStop(1, '#0e0a1c');
    ctx.fillStyle = water;
    ctx.fillRect(0, y, W, g);

    ctx.fillStyle = 'rgba(255,180,90,0.12)';
    ctx.fillRect(0, y, W, 6 * u);

    const tile = 56 * u;
    // 用连续 groundX 取正余数，避免卡顿跳变
    let ox = state.groundX % tile;
    if (ox > 0) ox -= tile;
    const live = state.mode === 'play' && state.armed;
    for (let x = ox - tile; x < W + tile; x += tile) {
      const wave = live
        ? Math.sin(state.t * 2 + x * 0.02) * 3 * u
        : Math.sin(x * 0.02) * 1.2 * u;
      ctx.fillStyle = 'rgba(255,200,120,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + tile * 0.5, y + 14 * u + wave, 18 * u, 3 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,170,80,0.22)';
      ctx.beginPath();
      ctx.arc(x + 12 * u, y + 28 * u + wave * 0.5, 2.2 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBird(b) {
    const r = b.r;
    const glowMul = b.glow || 1;
    const swing = b.swing || 0;
    // 点一下：灯火略亮、灯身微微上提感（竖直缩放），不做鸟式扑翅
    const pulse = state.flapFlash;
    const sy = 1 - pulse * 0.06;
    const sx = 1 + pulse * 0.04;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(swing);
    ctx.scale(sx, sy);

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.4 * glowMul);
    glow.addColorStop(0, 'rgba(255,200,100,' + (0.5 * glowMul) + ')');
    glow.addColorStop(0.45, 'rgba(255,140,50,0.2)');
    glow.addColorStop(1, 'rgba(255,100,30,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.4 * glowMul, 0, Math.PI * 2);
    ctx.fill();

    // 挂绳向上，暗示被提起
    ctx.strokeStyle = '#8a6a48';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.7);
    ctx.lineTo(0, -r * 1.15);
    ctx.stroke();

    ctx.fillStyle = '#5a3828';
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.05, r * 0.72, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(-r, 0, r, 0);
    body.addColorStop(0, '#d06028');
    body.addColorStop(0.45, '#ffc56a');
    body.addColorStop(1, '#c04820');
    ctx.fillStyle = body;
    roundRect(-r * 0.85, -r, r * 1.7, r * 2.05, r * 0.55);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,236,180,' + (0.45 + pulse * 0.25) + ')';
    roundRect(-r * 0.45, -r * 0.7, r * 0.9, r * 1.4, r * 0.35);
    ctx.fill();

    ctx.strokeStyle = 'rgba(90,50,20,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.95);
    ctx.lineTo(0, r * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.15);
    ctx.lineTo(r * 0.7, -r * 0.15);
    ctx.stroke();

    // 流苏随摆幅滞后一点
    const tassX = -swing * r * 1.2;
    ctx.strokeStyle = '#d4a060';
    ctx.beginPath();
    ctx.moveTo(0, r * 1.0);
    ctx.quadraticCurveTo(tassX * 0.5, r * 1.35, tassX, r * 1.6);
    ctx.stroke();
    ctx.fillStyle = '#ff9a4a';
    ctx.beginPath();
    ctx.arc(tassX, r * 1.7, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawIdleHint() {
    if (state.mode === 'play' && state.armed) return;
    if (state.mode !== 'ready' && !(state.mode === 'play' && !state.armed)) return;
    if (state.mode === 'ready') return;
    const u = unit();
    const bx = state.bird.x + 70 * u;
    const by = state.bird.y - 36 * u;
    const pulse = 0.92 + Math.sin(state.t * 4) * 0.08;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(255,248,235,0.92)';
    roundRect(-52 * u, -18 * u, 104 * u, 36 * u, 16 * u);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8 * u, 16 * u);
    ctx.lineTo(0, 26 * u);
    ctx.lineTo(8 * u, 16 * u);
    ctx.fill();
    ctx.fillStyle = '#3a2a44';
    ctx.font = '700 ' + (13 * u) + 'px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('点一下升起', 0, 0);
    ctx.restore();
  }

  function render() {
    drawSky();
    for (const p of state.pipes) drawPipe(p);
    drawGround();
    if (state.bird) drawBird(state.bird);
    drawIdleHint();
  }

  function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    let dt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;
    dt = Math.min(dt, 0.05);
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function roundRectPath(e, x, y, w, h, r) {
    e.beginPath();
    e.moveTo(x + r, y);
    e.arcTo(x + w, y, x + w, y + h, r);
    e.arcTo(x + w, y + h, x, y + h, r);
    e.arcTo(x, y + h, x, y, r);
    e.arcTo(x, y, x + w, y, r);
    e.closePath();
  }

  function buildExport() {
    const cw = 1080, ch = 1440;
    const ec = document.createElement('canvas');
    ec.width = cw;
    ec.height = ch;
    const e = ec.getContext('2d');
    const bg = e.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#14102a');
    bg.addColorStop(0.55, '#1e1638');
    bg.addColorStop(1, '#2a1838');
    e.fillStyle = bg;
    e.fillRect(0, 0, cw, ch);

    for (let i = 0; i < 70; i++) {
      e.fillStyle = 'rgba(255,245,220,' + (0.15 + Math.random() * 0.45) + ')';
      e.beginPath();
      e.arc(Math.random() * cw, Math.random() * ch * 0.65, Math.random() * 2.4 + 0.5, 0, Math.PI * 2);
      e.fill();
    }

    // decorative lantern
    const lx = cw / 2, ly = 280;
    const lg = e.createRadialGradient(lx, ly, 0, lx, ly, 160);
    lg.addColorStop(0, 'rgba(255,200,100,0.45)');
    lg.addColorStop(1, 'rgba(255,140,40,0)');
    e.fillStyle = lg;
    e.beginPath();
    e.arc(lx, ly, 160, 0, Math.PI * 2);
    e.fill();
    e.fillStyle = '#5a3828';
    e.beginPath();
    e.ellipse(lx, ly - 70, 48, 16, 0, 0, Math.PI * 2);
    e.fill();
    const body = e.createLinearGradient(lx - 60, 0, lx + 60, 0);
    body.addColorStop(0, '#d06028');
    body.addColorStop(0.5, '#ffc56a');
    body.addColorStop(1, '#c04820');
    e.fillStyle = body;
    roundRectPath(e, lx - 55, ly - 60, 110, 130, 36);
    e.fill();
    e.fillStyle = 'rgba(255,236,180,0.5)';
    roundRectPath(e, lx - 28, ly - 40, 56, 90, 22);
    e.fill();
    e.strokeStyle = '#d4a060';
    e.lineWidth = 3;
    e.beginPath();
    e.moveTo(lx, ly + 70);
    e.lineTo(lx, ly + 110);
    e.stroke();
    e.fillStyle = '#ff9a4a';
    e.beginPath();
    e.arc(lx, ly + 120, 10, 0, Math.PI * 2);
    e.fill();

    e.textAlign = 'center';
    e.fillStyle = '#ffe9a8';
    e.font = '700 64px PingFang SC,sans-serif';
    e.fillText('纸灯夜航', cw / 2, 480);
    e.fillStyle = 'rgba(255,236,210,0.5)';
    e.font = '400 28px PingFang SC,sans-serif';
    e.fillText('本局灯火贺卡', cw / 2, 540);

    const lines = [
      ['穿过门洞', String(state.score)],
      ['收集灯火', String(state.sparks)],
      ['历史最高', String(state.best)],
    ];
    lines.forEach(function (row, i) {
      const y = 640 + i * 90;
      e.fillStyle = 'rgba(255,255,255,0.06)';
      roundRectPath(e, 140, y - 42, cw - 280, 72, 18);
      e.fill();
      e.textAlign = 'left';
      e.fillStyle = 'rgba(255,236,210,0.5)';
      e.font = '400 30px PingFang SC,sans-serif';
      e.fillText(row[0], 180, y);
      e.textAlign = 'right';
      e.fillStyle = '#ffe9a8';
      e.font = '700 36px PingFang SC,sans-serif';
      e.fillText(row[1], cw - 180, y);
    });

    e.textAlign = 'center';
    e.fillStyle = 'rgba(255,236,210,0.35)';
    e.font = '400 26px PingFang SC,sans-serif';
    const d = new Date();
    e.fillText(d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() + ' · 纸灯夜航', cw / 2, ch - 90);
    return ec;
  }

  function openExport() {
    expImg.src = buildExport().toDataURL('image/png');
    expOv.classList.add('show');
  }

  function onTap(e) {
    if (e.target.closest && e.target.closest('#muteBtn, .btn, .overlay')) return;
    if (state.mode === 'ready') {
      startPlay();
      flap();
      return;
    }
    if (state.mode === 'play') flap();
  }

  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startPlay();
  });
  againBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startPlay();
  });
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    muted = !muted;
    muteBtn.classList.toggle('muted', muted);
    ensureAudio();
  });
  saveCardBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openExport();
  });
  expClose.addEventListener('click', (e) => {
    e.stopPropagation();
    expOv.classList.remove('show');
  });
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ec = buildExport();
    const a = document.createElement('a');
    a.href = ec.toDataURL('image/png');
    a.download = '纸灯夜航-灯火贺卡.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  window.addEventListener('pointerdown', onTap);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state.mode === 'ready' || state.mode === 'dead') {
        startPlay();
        flap();
      } else flap();
    }
  });

  window.addEventListener('resize', () => {
    resize();
    if (state.mode === 'ready') {
      state.bird = makeBird();
    }
  });

  resize();
  state.bird = makeBird();
  {
    const spacing = 210 * unit();
    let x = W * 0.72;
    for (let i = 0; i < 3; i++) {
      state.pipes.push(spawnPipe(x));
      x += spacing;
    }
  }
  requestAnimationFrame(loop);
})();
