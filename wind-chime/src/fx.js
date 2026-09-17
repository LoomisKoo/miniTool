/* 微风铃语 - 夜色庭院背景 + 柔和碰撞光点
 * 全幅夜空（月光 / 萤火），无窗框 / 无廊檐（挂点只靠 3D 横杆）
 * 底：薄雾远影；高路灯：灯柱 + 暖光锥，星/月/许愿字从光里洒落
 * #fxCv：碰撞后几点微光小星/月牙散落
 */
(function () {
  const WC = window.WC = window.WC || {};
  const MODES = ['moon', 'firefly'];
  const META = { moon: '月光', firefly: '萤火' };

  let mode = 0;
  let skyCv, fxCv, sky, fx, W, H, dpr = 1;
  let t = 0;
  let stars = [], fireflies = [], falls = [], lampDust = [];
  let lamp = null;
  let windX = 0, windY = 0, windAmt = 0;
  let spawnAcc = 0;
  let wishQueue = [];
  let wishSpawnAcc = 0;
  let wishRaining = false;
  let wishIdx = 0;
  let anchorY = -1;
  let groundY = 0;

  function topEdge() {
    return (anchorY > 0 ? anchorY : Math.max(28, H * 0.07));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    for (const cv of [skyCv, fxCv]) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    sky.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = Math.round(H * 0.9);
    build();
  }

  function build() {
    const te = topEdge();
    const ySpan = Math.max(40, groundY - te - 20);
    stars = [];
    const n = Math.round((W * ySpan) / 11000) + 48;
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: te + 10 + Math.random() * ySpan,
        r: 0.4 + Math.random() * 1.2,
        ph: Math.random() * 6.3,
        sp: 0.12 + Math.random() * 0.5,
        tint: Math.random(),
        amp: 0.05 + Math.random() * 0.14
      });
    }
    fireflies = [];
    const nFl = 16 + ((W / 180) | 0);
    for (let i = 0; i < nFl; i++) {
      const x = 20 + Math.random() * (W - 40);
      const y = te + 30 + Math.random() * Math.max(40, groundY - te - 60);
      fireflies.push({
        x, y,
        tx: x + (Math.random() - 0.5) * 80,
        ty: y + (Math.random() - 0.5) * 50,
        vx: 0, vy: 0,
        ph: Math.random() * 6.2832,
        breath: 0.45 + Math.random() * 0.55,
        flashT: 2 + Math.random() * 6,
        flash: 0,
        r: 0.7 + Math.random() * 0.55,
        tint: Math.random()
      });
    }
    // 高路灯：灯头低于月亮，长灯柱落到地面
    const ch = Math.max(40, groundY - te);
    lamp = {
      x: W * 0.76,
      y: te + ch * 0.36,
      poleBot: groundY - 4,
      glowR: Math.min(W, ch) * 0.92
    };
    lampDust = [];
    spawnAcc = 0;
  }

  function setMode(i, labelCb) {
    i = ((i % MODES.length) + MODES.length) % MODES.length;
    mode = i;
    if (labelCb) labelCb(META[MODES[i]]);
  }

  function grad(y0, y1, c0, c1) {
    const g = sky.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    return g;
  }

  /** 庭院薄雾 + 远影 */
  function drawCourtyardMist() {
    const mistTop = groundY - H * 0.22;

    // 远山 / 树影软剪影
    sky.fillStyle = 'rgba(6, 10, 22, 0.45)';
    sky.beginPath();
    sky.moveTo(0, groundY + 20);
    sky.lineTo(0, groundY - 8);
    sky.quadraticCurveTo(W * 0.12, groundY - 38, W * 0.22, groundY - 14);
    sky.quadraticCurveTo(W * 0.35, groundY - 48, W * 0.48, groundY - 18);
    sky.quadraticCurveTo(W * 0.62, groundY - 42, W * 0.78, groundY - 12);
    sky.quadraticCurveTo(W * 0.9, groundY - 28, W, groundY - 6);
    sky.lineTo(W, groundY + 20);
    sky.closePath();
    sky.fill();

    const mist = sky.createLinearGradient(0, mistTop, 0, H);
    mist.addColorStop(0, 'rgba(18, 24, 48, 0)');
    mist.addColorStop(0.35, 'rgba(22, 28, 52, 0.22)');
    mist.addColorStop(0.7, 'rgba(12, 14, 28, 0.55)');
    mist.addColorStop(1, 'rgba(6, 8, 16, 0.88)');
    sky.fillStyle = mist;
    sky.fillRect(0, mistTop, W, H - mistTop);

    // 地面一线极淡反射，像湿石或青砖
    sky.fillStyle = 'rgba(180, 200, 255, 0.04)';
    sky.fillRect(0, groundY - 1, W, 2);
  }

  /** 高路灯：灯柱 + 光锥 */
  function drawLamp() {
    if (!lamp) return;
    const lx = lamp.x, ly = lamp.y, bot = lamp.poleBot, gr = lamp.glowR;
    const pulse = 0.94 + 0.06 * Math.sin(t * 0.7);
    const dim = mode === 0 ? 0.88 : 1;

    sky.globalCompositeOperation = 'lighter';
    const cone = sky.createRadialGradient(lx, ly, 2, lx, ly + gr * 0.18, gr * 0.92);
    cone.addColorStop(0, 'rgba(255,236,190,' + (0.42 * pulse * dim) + ')');
    cone.addColorStop(0.22, 'rgba(255,220,150,' + (0.22 * pulse * dim) + ')');
    cone.addColorStop(0.55, 'rgba(255,200,120,' + (0.08 * pulse * dim) + ')');
    cone.addColorStop(1, 'rgba(255,180,100,0)');
    sky.fillStyle = cone;
    sky.beginPath();
    sky.moveTo(lx - 8, ly);
    sky.lineTo(lx + 8, ly);
    sky.lineTo(lx + gr * 0.88, bot);
    sky.lineTo(lx - gr * 0.88, bot);
    sky.closePath();
    sky.fill();

    const core = sky.createRadialGradient(lx, ly, 0, lx, ly, 52);
    core.addColorStop(0, 'rgba(255,250,230,' + (0.95 * pulse * dim) + ')');
    core.addColorStop(0.3, 'rgba(255,228,170,' + (0.5 * pulse * dim) + ')');
    core.addColorStop(1, 'rgba(255,200,120,0)');
    sky.fillStyle = core;
    sky.beginPath(); sky.arc(lx, ly, 52, 0, 6.2832); sky.fill();
    sky.globalCompositeOperation = 'source-over';

    const poleG = sky.createLinearGradient(lx - 4, ly, lx + 4, bot);
    poleG.addColorStop(0, '#3a2e22');
    poleG.addColorStop(0.5, '#1a140e');
    poleG.addColorStop(1, '#0c0906');
    sky.strokeStyle = poleG;
    sky.lineWidth = 2.6;
    sky.beginPath(); sky.moveTo(lx, ly + 10); sky.lineTo(lx, bot); sky.stroke();

    sky.fillStyle = 'rgba(40,30,18,0.8)';
    sky.beginPath();
    sky.moveTo(lx - 12, ly - 3);
    sky.lineTo(lx + 12, ly - 3);
    sky.lineTo(lx + 10, ly + 14);
    sky.lineTo(lx - 10, ly + 14);
    sky.closePath();
    sky.fill();

    sky.fillStyle = 'rgba(255,240,200,' + (0.72 * pulse * dim) + ')';
    sky.beginPath();
    sky.moveTo(lx - 9, ly);
    sky.lineTo(lx + 9, ly);
    sky.lineTo(lx + 7, ly + 12);
    sky.lineTo(lx - 7, ly + 12);
    sky.closePath();
    sky.fill();

    const ground = sky.createRadialGradient(lx, bot - 2, 0, lx, bot - 2, gr * 0.65);
    ground.addColorStop(0, 'rgba(255,220,150,' + (0.18 * dim) + ')');
    ground.addColorStop(1, 'rgba(255,200,120,0)');
    sky.fillStyle = ground;
    sky.beginPath(); sky.ellipse(lx, bot - 1, gr * 0.65, 12, 0, 0, 6.2832); sky.fill();
  }

  function spawnWishChar(ch) {
    if (!lamp || !ch) return;
    const gr = lamp.glowR;
    const ang = (Math.random() - 0.5) * 1.1;
    const dist = 8 + Math.random() * gr * 0.55;
    lampDust.push({
      kind: 'char',
      ch: ch,
      x: lamp.x + Math.sin(ang) * dist * 0.65,
      y: lamp.y + 18 + Math.random() * dist * 0.85,
      vx: (Math.random() - 0.5) * 6,
      vy: 4 + Math.random() * 10,
      r: 8 + Math.random() * 12,
      rot: (Math.random() - 0.5) * 0.8,
      vrot: (Math.random() - 0.5) * 1.6,
      vrot2: 0,
      tilt: 0,
      ph: Math.random() * 6.3,
      life: 18 + Math.random() * 16,
      t: 0,
      settled: false,
      stackH: 0,
      col: Math.random() < 0.35
        ? [255, 236, 190]
        : (Math.random() < 0.5 ? [255, 248, 220] : [230, 236, 255])
    });
  }

  function rainWish(text) {
    const raw = String(text || '').replace(/\s+/g, '');
    const chars = [];
    for (const c of raw) {
      if (c && c !== '「' && c !== '」' && c !== '·') chars.push(c);
    }
    if (!chars.length) return;
    wishQueue = chars;
    wishIdx = 0;
    wishSpawnAcc = 0;
    wishRaining = true;
    for (let i = lampDust.length - 1; i >= 0; i--) {
      if (lampDust[i].kind !== 'char') lampDust.splice(i, 1);
    }
  }

  function drawCharGlyph(ctx, x, y, ch, col, a, rot, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    const fs = size || 14;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, fs * 1.5);
    g.addColorStop(0, col + (a * 0.35) + ')');
    g.addColorStop(0.55, col + (a * 0.1) + ')');
    g.addColorStop(1, col + '0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, fs * 1.5, 0, 6.2832); ctx.fill();
    ctx.font = '600 ' + fs + 'px "Songti SC","STSong","Noto Serif SC",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col + a + ')';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  function spawnLampDust(n) {
    if (!lamp || wishRaining) return;
    const gr = lamp.glowR;
    for (let i = 0; i < n; i++) {
      const ang = (Math.random() - 0.5) * 1.1;
      const dist = 8 + Math.random() * gr * 0.55;
      const kind = Math.random() < 0.38 ? 'moon' : 'star';
      lampDust.push({
        kind,
        x: lamp.x + Math.sin(ang) * dist * 0.65,
        y: lamp.y + 18 + Math.random() * dist * 0.85,
        vx: (Math.random() - 0.5) * 6,
        vy: 4 + Math.random() * 10,
        r: kind === 'moon' ? (4.8 + Math.random() * 4.2) : (3.4 + Math.random() * 3.8),
        rot: Math.random() * 6.3,
        vrot: (Math.random() - 0.5) * 2.8,
        vrot2: (Math.random() - 0.5) * 1.6,
        tilt: (Math.random() - 0.5) * 0.8,
        ph: Math.random() * 6.3,
        life: 18 + Math.random() * 16,
        t: 0,
        settled: false,
        stackH: 0,
        col: Math.random() < 0.4
          ? [255, 252, 245]
          : (Math.random() < 0.5 ? [255, 255, 255] : [248, 250, 255])
      });
    }
  }

  // 弱光晕：不画径向渐变，形状本体用近白高不透明
  function drawStarGlyph(ctx, x, y, r, col, a, rot, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a0 = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const a1 = a0 + Math.PI / 5;
      const x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r;
      const x1 = Math.cos(a1) * r * 0.4, y1 = Math.sin(a1) * r * 0.4;
      if (i === 0) ctx.moveTo(x0, y0); else ctx.lineTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.closePath();
    ctx.fillStyle = col + (Math.min(1, a * 0.92)) + ')';
    ctx.fill();
    ctx.restore();
  }

  function drawMoonGlyph(ctx, x, y, r, col, a, rot, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot || 0) - 0.45);
    const R = r;
    const rIn = r * 0.68;
    const ox = r * 0.42;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0.7, Math.PI * 2 - 0.7, false);
    ctx.arc(ox, -r * 0.05, rIn, Math.PI * 2 - 0.95, 0.95, true);
    ctx.closePath();
    ctx.fillStyle = col + (Math.min(1, a * 0.9)) + ')';
    ctx.fill();
    ctx.restore();
  }

  function groundStackHeight(x, rr) {
    return Math.min(28, (rr || 8) * (0.2 + Math.random() * 0.9));
  }

  function stepLampDust(dt) {
    if (!lamp) return;
    if (wishRaining && wishQueue.length) {
      wishSpawnAcc += dt * 3.2;
      while (wishSpawnAcc >= 1) {
        wishSpawnAcc -= 1;
        spawnWishChar(wishQueue[wishIdx % wishQueue.length]);
        wishIdx++;
        spawnWishChar(wishQueue[wishIdx % wishQueue.length]);
        wishIdx++;
      }
    } else if (!wishRaining) {
      spawnAcc += dt * 3.2;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        spawnLampDust(2);
      }
    }
    const dustCap = 96;
    if (lampDust.length > dustCap) {
      let over = lampDust.length - dustCap;
      for (let i = 0; i < lampDust.length && over > 0; i++) {
        if (!lampDust[i].settled) {
          lampDust.splice(i, 1);
          i--;
          over--;
        }
      }
      if (lampDust.length > dustCap) lampDust.splice(0, lampDust.length - dustCap);
    }

    const wx = windX * 28;
    const wy = windY * 8;
    const te = topEdge();
    const ground = groundY - 4;

    for (let i = lampDust.length - 1; i >= 0; i--) {
      const p = lampDust[i];
      p.t += dt;
      const lifeK = 1 - p.t / p.life;
      if (lifeK <= 0 || p.y < te - 20) {
        lampDust.splice(i, 1);
        continue;
      }

      if (p.settled) {
        p.vx += wx * 0.35 * dt;
        p.vx *= Math.pow(0.15, dt);
        p.x += p.vx * dt;
        p.vrot *= Math.pow(0.4, dt);
        p.rot += p.vrot * dt * 0.35;
        p.tilt += (p.vrot2 || 0) * dt * 0.2;
        if (Math.abs(wx) > 8 && Math.random() < dt * 0.15) {
          p.settled = false;
          p.vy = -12 - Math.random() * 18;
          p.vx += wx * 0.4;
          p.life = p.t + 10 + Math.random() * 8;
        } else {
          p.y = ground - p.stackH;
        }
        p._a = Math.min(1, lifeK * 1.6) * 0.88;
        continue;
      }

      const sway = Math.sin(t * 0.55 + p.ph) * 4;
      p.vx += (wx - p.vx * 0.12 + sway * 0.5) * dt;
      p.vy += (3.2 + wy * 0.25 - p.vy * 0.06) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      p.tilt = (p.tilt || 0) + (p.vrot2 || 0) * dt;

      if (p.y >= ground) {
        p.settled = true;
        p.stackH = groundStackHeight(p.x, p.r);
        p.y = ground - p.stackH;
        p.vy = 0;
        p.vx *= 0.35;
        p.vrot *= 0.45;
        p.life = Math.max(p.life, p.t + 14 + Math.random() * 12);
      }

      p._a = Math.min(1, lifeK * 1.5) * 0.86;
    }
  }

  function drawLampDust() {
    if (!lampDust.length) return;
    // source-over 比 lighter 便宜，配合弱透明度即可
    for (const p of lampDust) {
      const a = p._a || 0;
      if (a < 0.03) continue;
      const col = 'rgba(' + p.col[0] + ',' + p.col[1] + ',' + p.col[2] + ',';
      if (p.kind === 'char') {
        drawCharGlyph(sky, p.x, p.y, p.ch, col, a, p.rot * 0.2, p.r * (p.settled ? 0.92 : 1));
        continue;
      }
      const rr = p.r * (p.settled ? 0.85 : (0.7 + 0.3 * a));
      if (p.kind === 'moon') drawMoonGlyph(sky, p.x, p.y, rr, col, a, p.rot, p.tilt);
      else drawStarGlyph(sky, p.x, p.y, rr, col, a, p.rot, p.tilt);
    }
  }

  let hitCool = 0;
  function hit(x, y) {
    if (hitCool > 0) return;
    hitCool = 0.045;
    if (falls.length > 36) return;
    const n = 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832;
      const sp = 12 + Math.random() * 28;
      falls.push({
        kind: Math.random() < 0.2 ? 'moon' : 'star',
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 14,
        r: 3.0 + Math.random() * 3.2, rot: Math.random() * 6.3, vrot: (Math.random() - 0.5) * 2,
        g: 18, life: 0.7 + Math.random() * 0.55, t: 0,
        col: Math.random() < 0.45 ? [255, 255, 255] : (Math.random() < 0.5 ? [255, 252, 245] : [248, 250, 255])
      });
    }
  }

  function drawFxLayer(dt) {
    if (hitCool > 0) hitCool = Math.max(0, hitCool - dt);
    fx.clearRect(0, 0, W, H);
    if (!falls.length) return;
    for (let i = falls.length - 1; i >= 0; i--) {
      const p = falls[i];
      p.t += dt;
      const lifeK = 1 - p.t / p.life;
      if (lifeK <= 0) { falls.splice(i, 1); continue; }
      p.vy += p.g * dt * 0.55;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.985; p.rot += p.vrot * dt;
      if (p.y > groundY - 4) { p.y = groundY - 4; p.life = p.t + 0.2; }
      const alpha = Math.min(1, lifeK * 1.5) * 0.9;
      const col = 'rgba(' + p.col[0] + ',' + p.col[1] + ',' + p.col[2] + ',';
      if (p.kind === 'moon') drawMoonGlyph(fx, p.x, p.y, p.r, col, alpha, p.rot);
      else drawStarGlyph(fx, p.x, p.y, p.r * (0.7 + 0.3 * lifeK), col, alpha, p.rot);
    }
  }

  function feedAnchor(x, y) { anchorY = y; }
  function feedWind(wx, wy, amp) {
    windX = wx || 0;
    windY = wy || 0;
    windAmt = amp != null ? amp : Math.min(1, Math.hypot(windX, windY) * 2);
  }

  function drawWindFx() {
    if (windAmt < 0.06) return;
    const te = topEdge();
    const a = Math.min(0.22, windAmt * 0.28);
    const dir = Math.atan2(windY || 0.01, windX || 0.2);
    sky.save();
    sky.globalCompositeOperation = 'lighter';
    sky.strokeStyle = 'rgba(210,225,255,' + a + ')';
    sky.lineWidth = 1.2;
    const n = 8 + ((windAmt * 10) | 0);
    for (let i = 0; i < n; i++) {
      const y0 = te + 20 + ((i * 97 + t * 40) % Math.max(40, groundY - te - 40));
      const x0 = ((i * 137 + t * (60 + windAmt * 80) * Math.cos(dir)) % (W + 80)) - 40;
      const len = 28 + windAmt * 50 + (i % 3) * 10;
      sky.globalAlpha = a * (0.45 + 0.55 * Math.sin(t * 2.2 + i));
      sky.beginPath();
      sky.moveTo(x0, y0);
      sky.quadraticCurveTo(
        x0 + Math.cos(dir) * len * 0.5,
        y0 + Math.sin(dir) * len * 0.15 + Math.sin(t * 3 + i) * 4,
        x0 + Math.cos(dir) * len,
        y0 + Math.sin(dir) * len * 0.25
      );
      sky.stroke();
    }
    sky.fillStyle = 'rgba(255,248,230,' + (a * 0.9) + ')';
    for (let i = 0; i < 12; i++) {
      const x = ((i * 89 + t * (40 + windAmt * 70) * Math.cos(dir)) % (W + 20));
      const y = te + 30 + ((i * 53 + t * 18) % (groundY - te - 50));
      sky.globalAlpha = a * (0.3 + 0.7 * ((Math.sin(t * 4 + i) + 1) * 0.5));
      sky.beginPath();
      sky.arc(x, y, 1 + (i % 2), 0, 6.2832);
      sky.fill();
    }
    sky.restore();
  }

  function init() {
    skyCv = document.getElementById('skyCv');
    fxCv = document.getElementById('fxCv');
    sky = skyCv.getContext('2d');
    fx = fxCv.getContext('2d');
    window.addEventListener('resize', resize);
    resize();
  }

  let skyAcc = 0;

  function update(dt) {
    t += dt;
    skyAcc += dt;
    // 夜空约 30fps，降低全屏 2D 发热；碰撞光点仍每帧
    if (skyAcc >= 0.033) {
      const sdt = Math.min(0.05, skyAcc);
      skyAcc = 0;
      paintSky(sdt);
    }
    drawFxLayer(dt);
  }

  function paintSky(dt) {
    const te = topEdge();
    const ch = Math.max(10, groundY - te);

    const ng = grad(0, H,
      mode === 0 ? '#07091a' : '#0a1428',
      mode === 0 ? '#10143a' : '#0c1a30'
    );
    sky.fillStyle = ng;
    sky.fillRect(0, 0, W, H);

    if (mode === 0) {
      const mr = Math.min(W, H) * 0.1;
      const mx = W * 0.16;
      const my = Math.min(groundY - mr * 1.2, te + mr * 1.55);
      sky.globalCompositeOperation = 'lighter';
      const wash = sky.createRadialGradient(mx, my, mr * 0.3, mx, my, Math.max(W, H) * 0.75);
      wash.addColorStop(0, 'rgba(255,244,220,0.14)');
      wash.addColorStop(0.35, 'rgba(220,230,255,0.05)');
      wash.addColorStop(1, 'rgba(200,210,255,0)');
      sky.fillStyle = wash;
      sky.fillRect(0, 0, W, H);
      const halo = sky.createRadialGradient(mx, my, 0, mx, my, mr * 3.2);
      halo.addColorStop(0, 'rgba(255,248,230,0.55)');
      halo.addColorStop(0.35, 'rgba(255,240,210,0.16)');
      halo.addColorStop(1, 'rgba(255,240,210,0)');
      sky.fillStyle = halo;
      sky.beginPath(); sky.arc(mx, my, mr * 3.2, 0, 6.2832); sky.fill();
      sky.globalCompositeOperation = 'source-over';
      sky.fillStyle = 'rgba(255,248,230,0.92)';
      sky.beginPath(); sky.arc(mx, my, mr, 0, 6.2832); sky.fill();
    }

    const starMax = mode === 0 ? 0.28 : 0.5;
    for (const s of stars) {
      if (mode === 0 && s.y > te + ch * 0.88) continue;
      const br = starMax * (0.9 + s.amp * Math.sin(t * s.sp + s.ph));
      if (br <= 0.03) continue;
      sky.fillStyle = s.tint < 0.1 ? 'rgba(205,225,255,' + br + ')' : (s.tint < 0.18 ? 'rgba(255,243,214,' + br + ')' : 'rgba(255,255,255,' + br + ')');
      sky.beginPath(); sky.arc(s.x, s.y, s.r * 0.85, 0, 6.2832); sky.fill();
    }

    const flAmt = mode === 1 ? 1 : 0;
    if (flAmt > 0.02) {
      sky.globalCompositeOperation = 'lighter';
      const yLo = te + 12, yHi = groundY - 12;
      for (const f of fireflies) {
        const dx = f.tx - f.x, dy = f.ty - f.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 18 || Math.random() < dt * 0.12) {
          f.tx = 24 + Math.random() * (W - 48);
          f.ty = yLo + 20 + Math.random() * Math.max(30, yHi - yLo - 40);
        }
        const maxSp = 18 + f.breath * 10;
        f.vx += (dx / dist) * 14 * dt + Math.sin(t * 0.7 + f.ph) * 2.2 * dt;
        f.vy += (dy / dist) * 11 * dt + Math.cos(t * 0.55 + f.ph * 1.3) * 1.8 * dt;
        f.vx += windX * 6 * dt;
        f.vy += windY * 3 * dt;
        f.vx *= Math.pow(0.55, dt);
        f.vy *= Math.pow(0.55, dt);
        const sp = Math.hypot(f.vx, f.vy);
        if (sp > maxSp) { f.vx *= maxSp / sp; f.vy *= maxSp / sp; }
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x < 8) { f.x = 8; f.vx = Math.abs(f.vx) * 0.4; }
        if (f.x > W - 8) { f.x = W - 8; f.vx = -Math.abs(f.vx) * 0.4; }
        if (f.y < yLo) { f.y = yLo; f.vy = Math.abs(f.vy) * 0.4; }
        if (f.y > yHi) { f.y = yHi; f.vy = -Math.abs(f.vy) * 0.4; }

        f.flashT -= dt;
        if (f.flashT <= 0) {
          f.flash = 1;
          f.flashT = 3.5 + Math.random() * 7;
        }
        if (f.flash > 0) f.flash = Math.max(0, f.flash - dt * 1.35);
        const breath = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(t * f.breath + f.ph));
        const a = Math.min(1, breath * 0.75 + f.flash * 0.45) * flAmt;
        if (a < 0.04) continue;

        const warm = f.tint < 0.35;
        const c0 = warm ? '170,245,130' : '150,245,160';
        const R = f.r * 3.2;
        const halo = sky.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
        halo.addColorStop(0, 'rgba(255,255,220,' + (a * 0.7) + ')');
        halo.addColorStop(0.4, 'rgba(' + c0 + ',' + (a * 0.22) + ')');
        halo.addColorStop(1, 'rgba(' + c0 + ',0)');
        sky.fillStyle = halo;
        sky.beginPath(); sky.arc(f.x, f.y, R, 0, 6.2832); sky.fill();
      }
      sky.globalCompositeOperation = 'source-over';
    }

    drawCourtyardMist();
    drawLamp();
    stepLampDust(dt);
    drawLampDust();
    drawWindFx();
  }

  WC.fx = { init, update, feedAnchor, feedWind, setMode, hit, rainWish, W: () => W, H: () => H };
})();
