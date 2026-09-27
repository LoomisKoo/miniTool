/**
 * 完成庆祝：全屏彩纸 + 亮片。
 * 彩纸按真实纸片处理：空气阻力让它很快减速、飘落时左右摆动，
 * 绕自身轴翻转（纵向压缩 + 正反面明暗不同），看起来才像纸而不是色块。
 */

const PALETTE = [
  ['#ffc94d', '#d9a12a'],
  ['#ff9a4a', '#d9722a'],
  ['#4fd1a5', '#2fa983'],
  ['#ff7eb0', '#d95a8c'],
  ['#a99bff', '#7f70dd'],
  ['#7cc8ff', '#4f9fd9'],
  ['#ffffff', '#d8d4ee'],
];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function makePaper(x, y, angle, speed, scale) {
  const [front, back] = pick(PALETTE);
  const ribbon = Math.random() < 0.22;
  return {
    kind: ribbon ? 'ribbon' : 'paper',
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    w: (ribbon ? rand(3, 4.5) : rand(7, 11)) * scale,
    h: (ribbon ? rand(14, 22) : rand(4.5, 7)) * scale,
    rot: rand(0, Math.PI * 2),
    vr: rand(-7, 7),
    flip: rand(0, Math.PI * 2),
    vflip: rand(6, 14),
    sway: rand(0, Math.PI * 2),
    vsway: rand(2, 4.5),
    swayAmp: rand(18, 42) * scale,
    kq: rand(0.0042, 0.0068) / scale,
    front,
    back,
    life: rand(3.2, 4.6),
    age: 0,
  };
}

function makeGlitter(x, y, angle, speed, scale) {
  return {
    kind: 'glitter',
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: rand(1.2, 2.4) * scale,
    tw: rand(0, Math.PI * 2),
    vtw: rand(10, 18),
    kq: rand(0.005, 0.008) / scale,
    color: pick(['#fff6d6', '#ffe08a', '#ffffff']),
    life: rand(2.2, 3.4),
    age: 0,
  };
}

export function celebrate() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-layer';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  const scale = Math.max(0.8, Math.min(1.3, Math.min(W, H) / 400));
  const gravity = 330 * scale;
  const parts = [];

  // 两侧礼炮：从底角斜向上喷，速度有快有慢，形成一团扇面
  const cannon = (fromLeft, count, delay) => {
    setTimeout(() => {
      const x = fromLeft ? -10 : W + 10;
      const y = H * 0.82;
      const base = fromLeft ? -Math.PI / 3 : (-Math.PI * 2) / 3;
      for (let i = 0; i < count; i++) {
        const a = base + rand(-0.32, 0.32);
        const v = rand(1900, 3300) * scale;
        parts.push(makePaper(x, y, a, v, scale));
      }
      for (let i = 0; i < count * 0.35; i++) {
        parts.push(makeGlitter(x, y, base + rand(-0.3, 0.3), rand(1800, 3000) * scale, scale));
      }
    }, delay);
  };
  cannon(true, 90, 0);
  cannon(false, 90, 90);
  cannon(true, 45, 520);
  cannon(false, 45, 600);

  // 顶部一阵彩纸雨，让画面中间也有东西飘下来
  setTimeout(() => {
    for (let i = 0; i < 70; i++) {
      const p = makePaper(rand(0, W), rand(-60, -10), Math.PI / 2, rand(60, 220) * scale, scale);
      p.life += 0.8;
      parts.push(p);
    }
  }, 260);

  let last = performance.now();
  let raf = 0;
  const tick = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    let alive = 0;
    for (const p of parts) {
      p.age += dt;
      if (p.age > p.life || p.y > H + 40) continue;
      alive++;
      // 平方阻力（真实纸片）：出膛极快、零点几秒就冲到高处，随后被迅速刹住，
      // 以很低的终端速度飘落。终端速度 ≈ sqrt(g / kq)
      const speed = Math.hypot(p.vx, p.vy);
      const k = Math.exp(-(0.5 + p.kq * speed) * dt);
      p.vx *= k;
      p.vy = p.vy * k + gravity * dt * (p.kind === 'glitter' ? 1.3 : 1);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const fade = Math.min(1, (p.life - p.age) / 0.6);

      if (p.kind === 'glitter') {
        p.tw += p.vtw * dt;
        const a = (0.55 + 0.45 * Math.sin(p.tw)) * fade;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // 闪一下时加一个十字星芒
        if (a > 0.85) {
          ctx.globalAlpha = (a - 0.85) * 4;
          ctx.fillRect(p.x - p.r * 3, p.y - 0.5, p.r * 6, 1);
          ctx.fillRect(p.x - 0.5, p.y - p.r * 3, 1, p.r * 6);
        }
        continue;
      }

      p.rot += p.vr * dt;
      p.flip += p.vflip * dt;
      p.sway += p.vsway * dt;
      // 下落阶段才摆动：上升时还是被气流推着走
      const falling = p.vy > 0 ? Math.min(1, p.vy / (120 * scale)) : 0;
      const sx = Math.sin(p.sway) * p.swayAmp * falling;
      const c = Math.cos(p.flip);
      ctx.globalAlpha = fade;
      ctx.fillStyle = c >= 0 ? p.front : p.back;
      ctx.save();
      ctx.translate(p.x + sx, p.y);
      ctx.rotate(p.rot + Math.sin(p.sway) * 0.4 * falling);
      ctx.scale(1, Math.max(0.08, Math.abs(c)));
      if (p.kind === 'ribbon') {
        // 卷曲的细彩带：一段 S 形
        ctx.beginPath();
        const hw = p.w / 2;
        const hh = p.h / 2;
        ctx.moveTo(-hw, -hh);
        ctx.bezierCurveTo(hw * 3, -hh / 3, -hw * 3, hh / 3, -hw, hh);
        ctx.lineTo(hw, hh);
        ctx.bezierCurveTo(-hw * 1, hh / 3, hw * 5, -hh / 3, hw, -hh);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        // 纸面反光：正面翻到接近正对时亮一下
        if (c > 0.9) {
          ctx.globalAlpha = fade * (c - 0.9) * 5;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.45);
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    const started = now - t0 > 700;
    if (started && alive === 0) {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.remove();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  const t0 = performance.now();
  raf = requestAnimationFrame(tick);
}
