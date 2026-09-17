// 祈愿灯 - 烟花粒子系统（分层粒子 / 球形·柳形·环形 / 二次爆响 / 放飞齐放）
(function () {
  const KD = window.KD || (window.KD = {});
  let scene, bursts = [], tex, timer = 1.0, t_now = 0;

  function init(sceneRef) { scene = sceneRef; tex = KD.util.sparkTex(); }

  function buildLayer(o) {
    const N = o.N, s = o.scale || 1;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const vel = [], life = [], maxLife = [], ph = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = o.x; pos[i * 3 + 1] = o.y; pos[i * 3 + 2] = o.z;
      let dx, dy, dz;
      if (o.type === 'ring') {
        const th = Math.random() * Math.PI * 2;
        dx = Math.cos(th); dy = Math.sin(th); dz = (Math.random() * 2 - 1) * 0.12;
      } else {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        dx = r * Math.cos(th); dy = u * 0.85; dz = r * Math.sin(th);
        const n = Math.hypot(dx, dy, dz) || 1; dx /= n; dy /= n; dz /= n;
      }
      const sp = (o.speed[0] + Math.random() * (o.speed[1] - o.speed[0])) * s;
      vel.push(new THREE.Vector3(dx * sp, dy * sp + 2.5 * s, dz * sp));
      let lf = o.life[0] + Math.random() * (o.life[1] - o.life[0]);
      if (o.type === 'willow') lf *= 1.2;
      life.push(lf); maxLife.push(lf); ph.push(Math.random() * 6.28);
      const c = Math.random() < 0.5 ? o.base : o.hi;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: o.size * s, map: tex, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return { pts, vel, life, maxLife, ph, geo, mat, N, grav: o.grav, color: o.base };
  }

  // opts: {type:'sphere'|'willow'|'ring', scale, crackle}
  function burst(x, y, z, color, opts) {
    opts = opts || {};
    const type = opts.type || 'sphere';
    const scale = opts.scale || 1;
    const grav = type === 'willow' ? 5.4 : (type === 'ring' ? 3.6 : 4.1);
    const base = new THREE.Color(color);
    const hi = base.clone().offsetHSL(0, 0.02, 0.2);

    const layers = [];
    layers.push(buildLayer({
      N: type === 'ring' ? 200 : 300, size: 1.15, speed: [3, 15], life: [1.8, 3.0],
      grav: grav, type: type, x: x, y: y, z: z, base: base, hi: hi, scale: scale
    }));
    layers.push(buildLayer({
      N: 95, size: 2.2, speed: [2, 7], life: [2.2, 3.5],
      grav: grav * 0.55, type: type, x: x, y: y, z: z, base: hi, hi: base, scale: scale
    }));

    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: 0xfff0c8, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1
    }));
    core.position.set(x, y, z); core.scale.set(3.5 * scale, 3.5 * scale, 1);
    scene.add(core);

    bursts.push({ layers, core, coreLife: 0.3, coreScale: 3.5 * scale });
    // 烟花噼啪声（远近差异）
    const cam = KD.fireworks.camera;
    const dist = cam ? Math.hypot(x - cam.position.x, y - cam.position.y, z - cam.position.z) : 60;
    KD.audio.pop(dist);

    // 二次爆响（噼啪）
    if (opts.crackle !== false) {
      setTimeout(() => {
        burst(
          x + KD.util.rand(-3, 3), y + KD.util.rand(-3, 3), z + KD.util.rand(-3, 3),
          0xfff0c8, { type: 'sphere', scale: 0.5, crackle: false }
        );
      }, 520 + Math.random() * 420);
    }
  }

  function update(dt) {
    for (let b = bursts.length - 1; b >= 0; b--) {
      const o = bursts[b];
      let alive = 0;
      for (const L of o.layers) {
        const pos = L.geo.attributes.position.array, col = L.geo.attributes.color.array;
        for (let i = 0; i < L.N; i++) {
          if (L.life[i] <= 0) continue;
          L.life[i] -= dt;
          const v = L.vel[i];
          v.y -= L.grav * dt;
          v.multiplyScalar(0.987);
          pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt;
          const k = Math.max(0, L.life[i] / L.maxLife[i]);
          const tw = 0.72 + 0.28 * Math.sin(t_now * 20 + L.ph[i]);
          col[i * 3] = L.color.r * k * tw;
          col[i * 3 + 1] = L.color.g * k * tw;
          col[i * 3 + 2] = L.color.b * k * tw;
          if (L.life[i] > 0) alive++;
        }
        L.geo.attributes.position.needsUpdate = true;
        L.geo.attributes.color.needsUpdate = true;
      }
      o.coreLife -= dt;
      if (o.core.parent) {
        o.core.material.opacity = Math.max(0, o.coreLife / 0.3);
        o.core.scale.setScalar(o.coreScale + (0.3 - o.coreLife) * 16);
        if (o.coreLife <= 0) { scene.remove(o.core); o.core.material.dispose(); }
      }
      if (alive === 0) {
        for (const L of o.layers) { scene.remove(L.pts); L.geo.dispose(); L.mat.dispose(); }
        bursts.splice(b, 1);
      }
    }
  }

  // 放飞庆祝：远近天空大量烟花
  function celebrate() {
    const types = ['sphere', 'willow', 'ring'];
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        if (!scene) return;
        burst(
          KD.util.rand(-45, 45),
          KD.util.rand(20, 54),
          -KD.util.rand(12, 85),
          KD.lanterns.FW_COLORS[(Math.random() * KD.lanterns.FW_COLORS.length) | 0],
          { type: types[(Math.random() * types.length) | 0] }
        );
      }, i * 380 + Math.random() * 220);
    }
    // 高空烟花：绕着正在飞的灯炸开，保证落在镜头里（屏幕上方不再空）
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        if (!scene) return;
        const hero = KD.lanterns.heroLantern();
        let bx, by, bz;
        if (hero) {
          bx = hero.position.x + KD.util.rand(-26, 26);
          by = hero.position.y + KD.util.rand(-4, 22);
          bz = hero.position.z + KD.util.rand(-38, 6);
        } else {
          bx = KD.util.rand(-50, 50); by = KD.util.rand(58, 92); bz = -KD.util.rand(20, 90);
        }
        burst(
          bx, by, bz,
          KD.lanterns.FW_COLORS[(Math.random() * KD.lanterns.FW_COLORS.length) | 0],
          { type: types[(Math.random() * types.length) | 0] }
        );
      }, 900 + i * 480 + Math.random() * 300);
    }
  }

  function tick(dt) {
    t_now += dt;
    timer -= dt;
    if (timer <= 0) {
      timer = 1.8 + Math.random() * 2.2;
      const high = Math.random() < 0.35;
      burst(
        (Math.random() * 2 - 1) * 34,
        high ? 56 + Math.random() * 32 : 24 + Math.random() * 20,
        -25 - Math.random() * 55,
        KD.lanterns.FW_COLORS[(Math.random() * KD.lanterns.FW_COLORS.length) | 0],
        { type: Math.random() < 0.25 ? 'willow' : 'sphere' }
      );
    }
    update(dt);
  }

  KD.fireworks = { init, burst, update, tick, celebrate };
})();
