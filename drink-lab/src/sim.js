// 杯内配料的物理（杯子局部坐标，1 单位 ≈ 4.5cm）。
// 每个物体按自身密度受重力和浮力（按浸没体积），液体里有粘滞阻力，
// 半浮在液面的物体额外加临界阻尼——真实冰块落水后很快就稳住，不会一直上下弹。
const THREE = window.THREE;
const STEP = 1 / 120;
const G = 218; // 9.8 m/s² 换算到 4.5cm 单位
const CD = 1.9;

// 球冠浸没体积比例：d 为球心在液面下的深度
function subFrac(d, r) {
  const h = Math.min(Math.max(d + r, 0), 2 * r);
  return h * h * (3 * r - h) / (4 * r * r * r);
}

const _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _up = new THREE.Vector3(), _ly = new THREE.Vector3(), _tu = new THREE.Vector3(), _eu = new THREE.Euler();

export class Sim {
  constructor() {
    this.ps = [];
    this.acc = 0;
    this.splash = 0;
    this.cup = null;
  }

  setCup(spec) { this.cup = spec; this.ps.length = 0; }

  add(def, x, y, z, mul = 1) {
    const j = def.jitter || 0.06;
    const s = (def.scale || [1, 1, 1]).map((v) => v * mul);
    const p = {
      def, x, y, z, vx: 0, vy: -1, vz: 0,
      q: new THREE.Quaternion().random(),
      w: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4),
      s: new THREE.Vector3(s[0] * (1 + (Math.random() - 0.5) * j), s[1] * (1 + (Math.random() - 0.5) * j), s[2] * (1 + (Math.random() - 0.5) * j)),
      mul,
      m: 1, sub: 0, wet: false, seed: Math.random() * 100,
      // 同一种东西每颗密度也不完全一样（含气量、吸水程度），所以不会整齐地全沉/全浮
      rho: def.rho * (1 + (Math.random() * 2 - 1) * (def.rhoJ ?? 0.025)),
      color: def.multiColor ? def.multiColor[Math.floor(Math.random() * def.multiColor.length)] : null,
    };
    // 浮着时也不会都一样平：每片有自己的倾角（形状不对称、一边沾了别的东西）
    const ta = Math.random() * 6.28;
    p.tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(ta), 0, Math.sin(ta)), 0.08 + Math.random() * 0.4);
    if (def.flat) p.q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 2, Math.random() * 6.28, (Math.random() - 0.5) * 2));
    this.ps.push(p);
    return p;
  }

  count(id) { let n = 0; for (const p of this.ps) if (p.def.id === id) n++; return n; }
  clear() { this.ps.length = 0; }

  // env: { has, P, N, rho, visc, g(局部重力单位向量), inert(杯子局部加速度), stir, churn(液体搅动强度) }
  update(dt, env, onMelt) {
    this.acc += dt;
    this.t = (this.t || 0) + dt;
    let n = 0;
    while (this.acc >= STEP && n++ < 6) { this.step(STEP, env); this.acc -= STEP; }
    if (n >= 6) this.acc = 0;

    _up.copy(env.g).negate();
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i], d = p.def;
      // 转动：液体里阻尼大，扁平物体浮着时慢慢躺平
      const sp = p.w.length();
      if (sp > 1e-4) { _q.setFromAxisAngle(_a.copy(p.w).divideScalar(sp), sp * dt); p.q.premultiply(_q); }
      // 冰淇淋这类东西只绕竖轴转，永远立着，不会倒栽葱
      if (d.upright) {
        _eu.setFromQuaternion(p.q, 'YXZ');
        p.q.setFromEuler(_eu.set(0, _eu.y, 0, 'YXZ'));
        p.w.set(0, p.w.y, 0);
      }
      p.w.multiplyScalar(Math.exp(-(p.sub > 0 ? 4 * Math.sqrt(env.visc) : 0.3) * dt));
      if (env.stir > 0 && p.sub > 0 && d.spinny !== false) p.w.addScaledVector(_a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), env.stir * 8 * dt * 10);
      // 水流里的物体会被湍流带着翻转
      if (env.churn > 0.02 && p.sub > 0 && d.spinny !== false) p.w.addScaledVector(_a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), env.churn * 40 * dt / Math.sqrt(env.visc));
      // 撒在奶盖/冰淇淋上的扁片要顺着曲面倾斜，不是水平飘着
      if (d.surface && env.surfN) {
        _ly.set(0, 1, 0).applyQuaternion(p.q);
        env.surfN(p.x, p.z, _tu);
        if (_ly.dot(_tu) < 0) _ly.negate();
        _q.setFromUnitVectors(_ly, _tu).multiply(p.q);
        p.q.slerp(_q, 1 - Math.exp(-5 * dt));
      } else if (d.flat && p.sub > 0.08 && p.sub < 0.97) {
        // 只有真正漂在液面上（部分露出）的扁片才会慢慢躺平；沉下去的保持随机姿态
        _ly.set(0, 1, 0).applyQuaternion(p.q);
        _tu.copy(_up).applyQuaternion(p.tilt);
        if (_ly.dot(_tu) < 0) _ly.negate();
        _q.setFromUnitVectors(_ly, _tu).multiply(p.q);
        p.q.slerp(_q, 1 - Math.exp(-1.2 * dt));
      }
      // 融化
      // 冰块是配方的一部分，不会因为时间自动消失；冰淇淋等顶部材料仍可变化。
      if (d.cat !== 'ice' && d.melt && p.sub > 0 && env.has) {
        const dm = Math.min(p.m, dt / d.melt * (0.4 + p.sub) * (1 + env.stir * 3));
        p.m -= dm;
        onMelt(d, d.vol * dm);
        if (p.m < 0.06) { this.ps.splice(i, 1); continue; }
      }
    }
  }

  // 杯内液体的大致流速：绕轴涡旋 + 翻滚环流（中间上涌、贴壁下沉）+ 湍流，强度随 churn 衰减
  flow(p, env) {
    const F = this._f || (this._f = new THREE.Vector3());
    const k = env.churn || 0;
    if (k < 0.002 || p.sub <= 0) return F.set(0, 0, 0);
    const cup = this.cup, sv = Math.sqrt(env.visc);
    const H = Math.max(env.P.y - cup.yb, 0.2);
    const R = Math.max(cup.radiusAt(Math.min(Math.max(p.y, cup.yb), cup.yt)), 0.1);
    const d = Math.hypot(p.x, p.z), rr = Math.min(d / R, 1), yn = Math.min(Math.max((p.y - cup.yb) / H, 0), 1);
    const w = 2.4 * k / sv;
    const V = 2.4 * k * Math.min(H, 3) / 3 / sv;
    const vr = V * (2 * yn - 1) * rr * (1 - rr) * 2.5;
    F.set(-p.z * w, V * (1 - 2 * rr * rr), p.x * w);
    if (d > 1e-3) { F.x += p.x / d * vr; F.z += p.z / d * vr; }
    const t = this.t || 0, s = p.seed, T = 1.3 * k / sv;
    F.x += Math.sin(t * 2.3 + s) * T;
    F.y += Math.sin(t * 1.9 + s * 1.7) * T;
    F.z += Math.sin(t * 2.7 + s * 2.3) * T;
    return F;
  }

  step(h, env) {
    const { ps, cup } = this;
    if (!cup) return;
    const { P, N, g, inert } = env;
    for (const p of ps) {
      const d = p.def, k = Math.cbrt(p.m), r = d.r * k * (p.mul || 1);
      p.rr = r;
      const depth = env.has ? -((p.x - P.x) * N.x + (p.y - P.y) * N.y + (p.z - P.z) * N.z) : -9;
      p.sub = env.has ? subFrac(depth, r) : 0;
      if (p.sub > 0 && !p.wet) {
        p.wet = true;
        this.splash = Math.min(1, this.splash + Math.min(0.6, d.vol * k * k * k * 12 + 0.05));
        p.w.multiplyScalar(0.3);
        if (env.onPlop && !d.surface) env.onPlop(d, Math.min(2, Math.hypot(p.vx, p.vy, p.vz) / 10));
      }
      if (p.sub === 0) p.wet = false;

      const buoy = env.rho / p.rho * p.sub;
      const net = 1 - buoy;
      // 重力 + 浮力；杯子加速时液体一起加速，所以惯性项也乘同一个系数
      const ax = (g.x * G - inert.x) * net;
      const ay = (g.y * G - inert.y) * net;
      const az = (g.z * G - inert.z) * net;
      let c = 0.08;
      if (p.sub > 0) {
        c += p.sub * CD * Math.sqrt(env.visc) / r * (env.rho / p.rho);
        if (p.sub < 0.999) c += 1.8 * Math.sqrt(G * env.rho / p.rho / (1.5 * r));
      }
      p.vx += ax * h; p.vy += ay * h; p.vz += az * h;
      // 阻力把物体速度拉向液体流速（而不是拉向 0）：液体被摇动/倒入搅起来时，
      // 和液体密度相近的东西会被带着满杯跑，停下后再按密度差慢慢沉浮
      const f = this.flow(p, env);
      const damp = Math.exp(-c * h);
      const fx = f.x * p.sub, fy = f.y * p.sub, fz = f.z * p.sub;
      p.vx = fx + (p.vx - fx) * damp; p.vy = fy + (p.vy - fy) * damp; p.vz = fz + (p.vz - fz) * damp;
      p.ox = p.x; p.oy = p.y; p.oz = p.z;
      p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
    }

    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const min = (a.rr + b.rr) * 0.95;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < min * min && d2 > 1e-10) {
            const dd = Math.sqrt(d2);
            const ma = a.def.vol * a.def.rho, mb = b.def.vol * b.def.rho;
            const wa = mb / (ma + mb), wb = 1 - wa;
            const k = (min - dd) / dd;
            a.x -= dx * k * wa; a.y -= dy * k * wa; a.z -= dz * k * wa;
            b.x += dx * k * wb; b.y += dy * k * wb; b.z += dz * k * wb;
          }
        }
      }
      for (const p of ps) {
        const yb = cup.yb + p.rr * 0.9;
        if (p.y < yb) p.y = yb;
        if (p.y > cup.yt + 2.5) p.y = cup.yt + 2.5;
        const lim = Math.max(0.02, cup.radiusAt(Math.min(Math.max(p.y, cup.yb), cup.yt)) - p.rr * 0.9);
        const dr = Math.hypot(p.x, p.z);
        if (dr > lim) { const k = lim / dr; p.x *= k; p.z *= k; }
        // 撒料：按自己所在位置的表面高度落（奶盖、冰淇淋是拱起来的），
        // 不是贴在一个平面上；没液体时就停在杯口附近
        if (p.def.surface && env.top != null) {
          const y = (env.topAt ? env.topAt(p.x, p.z) : env.top) + p.rr * 0.3;
          if (p.y < y) { p.y = y; if (p.vy < 0) p.vy = 0; }
        }
        // 冰淇淋：只坐在液体上方，不会被别的配料挤进液体里
        if (p.def.surfaceTop) {
          // 'base'：几何原点就在底座，直接坐在液面上
          const y = (env.has ? env.level : cup.yb) + (p.def.surfaceTop === 'base' ? -0.02 : p.rr * 0.5);
          if (p.y < y) { p.y = y; if (p.vy < 0) p.vy = 0; }
        }
      }
    }

    for (const p of ps) {
      p.vx = (p.x - p.ox) / h; p.vy = (p.y - p.oy) / h; p.vz = (p.z - p.oz) / h;
    }
  }
}
