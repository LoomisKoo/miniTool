(() => {
  const STORAGE_KEY = 'flappy-bird-best';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('scoreNum');
  const startOv = document.getElementById('startOv');
  const endOv = document.getElementById('endOv');
  const startBtn = document.getElementById('startBtn');
  const againBtn = document.getElementById('againBtn');
  const muteBtn = document.getElementById('muteBtn');
  const bestNum = document.getElementById('bestNum');
  const endScore = document.getElementById('endScore');
  const endBest = document.getElementById('endBest');

  let W = 0, H = 0, dpr = 1;
  let muted = false;
  let audioCtx = null;
  const birdImg = new Image();
  birdImg.src = 'assets/bird.png';
  let birdReady = false;
  birdImg.onload = () => { birdReady = true; };

  const state = {
    mode: 'ready', // ready | play | dead
    score: 0,
    best: 0,
    bird: null,
    pipes: [],
    groundX: 0,
    clouds: [],
    t: 0,
    lastTs: 0,
    flapFlash: 0,
    armed: false, // play 后等第一次点击再开重力
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
      r: 12 * u, // 碰撞半径 ≈ 可见身体半径
      rot: 0,
    };
  }

  function makeClouds() {
    const list = [];
    for (let i = 0; i < 5; i++) {
      list.push({
        x: Math.random() * W,
        y: H * (0.08 + Math.random() * 0.35),
        s: 0.6 + Math.random() * 0.8,
        v: 8 + Math.random() * 18,
      });
    }
    return list;
  }

  function gapSize() {
    const u = unit();
    const base = 118 * u;
    const shrink = Math.min(state.score * 1.2 * u, 28 * u);
    return Math.max(base - shrink, 92 * u);
  }

  function pipeW() {
    return 58 * unit();
  }

  function spawnPipe(x) {
    const u = unit();
    const ground = groundH();
    const gap = gapSize();
    const topMin = 70 * u;
    const topMax = H - ground - gap - 70 * u;
    const top = topMin + Math.random() * Math.max(20, topMax - topMin);
    return { x, top, gap, scored: false };
  }

  function groundH() {
    return Math.max(96 * unit(), H * 0.16);
  }

  function resetGame() {
    state.score = 0;
    scoreEl.textContent = '0';
    state.bird = makeBird();
    state.pipes = [];
    state.groundX = 0;
    state.clouds = makeClouds();
    state.t = 0;
    state.flapFlash = 0;
    const spacing = 210 * unit();
    let x = W + 40;
    for (let i = 0; i < 4; i++) {
      state.pipes.push(spawnPipe(x));
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
    state.bird.vy = -7.2 * u;
    state.flapFlash = 1;
    beep(620, 0.08, 'square', 0.07);
  }

  function startPlay() {
    ensureAudio();
    resetGame();
    state.mode = 'play';
    state.armed = false;
    startOv.classList.remove('show');
    endOv.classList.remove('show');
    state.lastTs = performance.now();
  }

  function die() {
    if (state.mode !== 'play') return;
    state.mode = 'dead';
    beep(180, 0.22, 'sawtooth', 0.09);
    setTimeout(() => beep(120, 0.28, 'sawtooth', 0.07), 90);
    if (state.score > state.best) {
      state.best = state.score;
      try { localStorage.setItem(STORAGE_KEY, String(state.best)); } catch (_) {}
    }
    endScore.textContent = String(state.score);
    endBest.innerHTML = '<span class="dot"></span>最高 ' + state.best;
    bestNum.textContent = String(state.best);
    endOv.classList.add('show');
  }

  function hitTest() {
    const b = state.bird;
    const g = groundH();
    const hr = b.r; // 与绘制身体对齐
    if (b.y + hr >= H - g) return true;
    if (b.y - hr <= 0) return true;
    const pw = pipeW();
    for (const p of state.pipes) {
      if (b.x + hr > p.x && b.x - hr < p.x + pw) {
        if (b.y - hr < p.top || b.y + hr > p.top + p.gap) return true;
      }
    }
    return false;
  }

  function update(dt) {
    const u = unit();
    const speed = (148 + Math.min(state.score * 3.5, 70)) * u;
    state.t += dt;
    state.groundX = (state.groundX - speed * dt) % (48 * u);
    state.flapFlash = Math.max(0, state.flapFlash - dt * 4);

    for (const c of state.clouds) {
      c.x -= c.v * u * dt * 0.35;
      if (c.x < -120 * u) {
        c.x = W + 40;
        c.y = H * (0.08 + Math.random() * 0.35);
      }
    }

    if (state.mode !== 'play') {
      if (state.mode === 'ready' && state.bird) {
        state.bird.y = H * 0.42 + Math.sin(state.t * 3) * 8 * u;
        state.bird.rot = Math.sin(state.t * 3) * 0.12;
      }
      return;
    }

    const b = state.bird;
    if (!state.armed) {
      b.y = H * 0.42 + Math.sin(state.t * 3) * 8 * u;
      b.rot = Math.sin(state.t * 3) * 0.12;
      return;
    }

    b.vy += 22 * u * dt;
    b.vy = Math.min(b.vy, 14 * u);
    b.y += b.vy;
    b.rot = Math.max(-0.55, Math.min(1.1, b.vy / (10 * u)));

    const spacing = 210 * u;
    for (const p of state.pipes) {
      p.x -= speed * dt;
      if (!p.scored && p.x + pipeW() < b.x) {
        p.scored = true;
        state.score += 1;
        scoreEl.textContent = String(state.score);
        beep(880, 0.07, 'triangle', 0.06);
      }
    }
    state.pipes = state.pipes.filter(p => p.x > -pipeW() - 20);
    while (state.pipes.length < 4) {
      const last = state.pipes[state.pipes.length - 1];
      const nx = (last ? last.x : W) + spacing;
      state.pipes.push(spawnPipe(nx));
    }

    if (hitTest()) die();
  }

  function drawSky() {
    const u = unit();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5eb0e0');
    g.addColorStop(0.45, '#a8d8f0');
    g.addColorStop(0.72, '#e8f0c8');
    g.addColorStop(1, '#f2e8a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sun
    const sx = W * 0.78, sy = H * 0.16, sr = 42 * u;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 1.8);
    sg.addColorStop(0, 'rgba(255,230,140,0.55)');
    sg.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe28a';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(sx - sr * 0.2, sy - sr * 0.2, sr * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // distant hills
    const gy = H - groundH();
    ctx.fillStyle = 'rgba(120, 180, 130, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.quadraticCurveTo(W * 0.2, gy - 50 * u, W * 0.4, gy - 10 * u);
    ctx.quadraticCurveTo(W * 0.6, gy - 70 * u, W * 0.85, gy - 18 * u);
    ctx.quadraticCurveTo(W * 0.95, gy - 8 * u, W, gy - 22 * u);
    ctx.lineTo(W, gy);
    ctx.closePath();
    ctx.fill();
  }

  function drawCloud(c) {
    const u = unit();
    const s = c.s * u;
    const x = c.x, y = c.y;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(x + 24 * s, y + 10 * s, 36 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(x, y, 16 * s, 0, Math.PI * 2);
    ctx.arc(x + 20 * s, y - 10 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 46 * s, y - 2 * s, 15 * s, 0, Math.PI * 2);
    ctx.arc(x + 24 * s, y + 6 * s, 14 * s, 0, Math.PI * 2);
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

  function drawPipe(p) {
    const pw = pipeW();
    const u = unit();
    const lip = 11 * u;
    const lipH = 24 * u;

    function body(y, h, flip) {
      if (h <= 0) return;
      const grad = ctx.createLinearGradient(p.x, 0, p.x + pw, 0);
      grad.addColorStop(0, '#3f8f2e');
      grad.addColorStop(0.28, '#6fd24e');
      grad.addColorStop(0.55, '#58b83c');
      grad.addColorStop(1, '#2f6f22');
      ctx.fillStyle = grad;
      roundRect(p.x, y, pw, h, 6 * u);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(p.x + 7 * u, y + 2 * u, 7 * u, Math.max(0, h - 4 * u));
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(p.x + pw - 10 * u, y + 2 * u, 6 * u, Math.max(0, h - 4 * u));

      const ly = flip ? y : y + h - lipH;
      const lg = ctx.createLinearGradient(p.x - lip, 0, p.x + pw + lip, 0);
      lg.addColorStop(0, '#3f8f2e');
      lg.addColorStop(0.35, '#7ee055');
      lg.addColorStop(1, '#2f6f22');
      ctx.fillStyle = lg;
      roundRect(p.x - lip, ly, pw + lip * 2, lipH, 8 * u);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,70,20,0.35)';
      ctx.lineWidth = 2;
      roundRect(p.x - lip, ly, pw + lip * 2, lipH, 8 * u);
      ctx.stroke();
    }

    body(0, p.top, false);
    body(p.top + p.gap, H - groundH() - (p.top + p.gap), true);
  }

  function drawGround() {
    const g = groundH();
    const u = unit();
    const y = H - g;
    const dirt = ctx.createLinearGradient(0, y, 0, H);
    dirt.addColorStop(0, '#e8d89a');
    dirt.addColorStop(0.35, '#d4c078');
    dirt.addColorStop(1, '#b8a058');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, y, W, g);

    ctx.fillStyle = '#7ed24e';
    ctx.fillRect(0, y, W, 20 * u);
    ctx.fillStyle = '#5cb83a';
    const tile = 44 * u;
    for (let x = state.groundX - tile; x < W + tile; x += tile) {
      ctx.beginPath();
      ctx.moveTo(x, y + 20 * u);
      ctx.quadraticCurveTo(x + tile * 0.5, y + 2 * u, x + tile, y + 20 * u);
      ctx.fill();
    }
    ctx.fillStyle = '#f0e08a';
    ctx.fillRect(0, y + 18 * u, W, 5 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, y + 18 * u, W, 2 * u);

    // soil dots
    ctx.fillStyle = 'rgba(140,110,50,0.25)';
    for (let i = 0; i < 18; i++) {
      const dx = ((i * 97 + state.groundX * 0.3) % W + W) % W;
      const dy = y + 32 * u + (i % 5) * 10 * u;
      ctx.beginPath();
      ctx.arc(dx, dy, 2 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBird(b) {
    const r = b.r;
    const flap = state.flapFlash > 0.25 || (!state.armed && Math.sin(state.t * 8) > 0.3);
    const frame = flap ? 1 : 0;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);

    // 精灵四周有透明边，约 2.55*r 时身体半径贴近碰撞半径 r
    const size = r * 2.55;
    if (birdReady) {
      ctx.drawImage(birdImg, frame * 256, 0, 256, 256, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawIdleHint() {
    if (state.mode === 'play' && state.armed) return;
    if (state.mode !== 'ready' && !(state.mode === 'play' && !state.armed)) return;
    if (state.mode === 'ready') return; // start overlay covers it
    const u = unit();
    const bx = state.bird.x + 70 * u;
    const by = state.bird.y - 36 * u;
    const pulse = 0.92 + Math.sin(state.t * 4) * 0.08;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(255,250,240,0.92)';
    roundRect(-52 * u, -18 * u, 104 * u, 36 * u, 16 * u);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8 * u, 16 * u);
    ctx.lineTo(0, 26 * u);
    ctx.lineTo(8 * u, 16 * u);
    ctx.fill();
    ctx.fillStyle = '#3a4a54';
    ctx.font = `700 ${13 * u}px "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('点一下起飞', 0, 0);
    ctx.restore();
  }

  function render() {
    drawSky();
    for (const c of state.clouds) drawCloud(c);
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

  window.addEventListener('pointerdown', onTap);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state.mode === 'ready' || state.mode === 'dead') {
        if (state.mode === 'dead') startPlay();
        else startPlay();
        flap();
      } else flap();
    }
  });

  window.addEventListener('resize', () => {
    resize();
    if (state.mode === 'ready') {
      state.bird = makeBird();
      state.clouds = makeClouds();
    }
  });

  resize();
  state.bird = makeBird();
  state.clouds = makeClouds();
  // preview pipes on start screen
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
