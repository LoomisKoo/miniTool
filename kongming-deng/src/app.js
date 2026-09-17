// 祈愿灯 - 主程序（场景/相机/渲染循环/UI 接线）
(function () {
  const KD = window.KD || (window.KD = {});
  let renderer, scene, camera, clock;
  let embers = null, bokeh = [], starMats = [];

  function init() {
    const host = document.getElementById('scene');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = KD.util.skyTex();
    scene.fog = new THREE.Fog(0x2a1733, 90, 280);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 700);
    camera.position.set(0, 10, 30);
    camera.lookAt(0, 24, -30);

    scene.add(new THREE.HemisphereLight(0x6a7bd0, 0x1a0f2a, 0.75));
    scene.add(new THREE.AmbientLight(0x4a3a6a, 0.5));
    const dir = new THREE.DirectionalLight(0xffd9a0, 0.5);
    dir.position.set(0, -1, 1); scene.add(dir);

    addHaze();
    addSilhouettes();
    addStars();
    addEmbers();
    addGroundGlow();
    addBokeh();

    KD.lanterns.init(scene);
    KD.fireworks.init(scene);
    KD.fireworks.camera = camera;
    // 灯海里的灯也都挂上竖排纸条，长短不一
    const sea = KD.lanterns.SEA_WISHES;
    for (let i = 0; i < 60; i++) {
      KD.lanterns.spawn({
        text: sea[(Math.random() * sea.length) | 0],
        stringLen: KD.util.rand(0.9, 2.2)
      });
    }

    KD.wish.init();

    window.addEventListener('resize', onResize);
    clock = new THREE.Clock();
    animate();
  }

  // 梦幻：地平线暖紫雾 / 高空冷紫雾 / 地面薄雾
  function addHaze() {
    const mk = (w, h, top, mid, bottom, y, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: KD.util.hazeTex(top, mid, bottom), transparent: true,
          depthWrite: false, blending: THREE.AdditiveBlending
        }));
      m.position.set(0, y, z); scene.add(m);
    };
    mk(460, 150, 'rgba(120,60,140,0)', 'rgba(158,84,124,0.11)', 'rgba(120,60,140,0)', 20, -100);
    mk(560, 210, 'rgba(92,72,182,0)', 'rgba(92,72,182,0.07)', 'rgba(92,72,182,0)', 96, -125);
    mk(380, 56, 'rgba(255,170,110,0)', 'rgba(255,170,110,0.15)', 'rgba(255,170,110,0)', 6, -32);
  }

  function addSilhouettes() {
    // 远景：城墙 + 中式殿宇 + 宝塔
    const far = new THREE.Mesh(new THREE.PlaneGeometry(360, 160),
      new THREE.MeshBasicMaterial({ map: KD.util.farTex(), transparent: true, depthWrite: false }));
    far.position.set(0, 55, -110); scene.add(far);

    // 近景人群（脚落在画面下缘，确保能看见人）
    const nearTex = KD.util.nearTex();
    const near = new THREE.Mesh(new THREE.PlaneGeometry(220, 9),
      new THREE.MeshBasicMaterial({ map: nearTex, transparent: true, depthWrite: false }));
    near.position.set(0, 2.5, -18); scene.add(near);

    // 中景人群（更远、偏蓝，做纵深）
    const mid = new THREE.Mesh(new THREE.PlaneGeometry(300, 11),
      new THREE.MeshBasicMaterial({ map: nearTex, transparent: true, depthWrite: false, color: 0x53406e }));
    mid.position.set(0, 3.5, -46); scene.add(mid);
  }

  function addStars() {
    const tex = KD.util.glowTex();
    for (let k = 0; k < 2; k++) {
      const N = 780, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const r = 130 + Math.random() * 170;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.random() * Math.PI * 0.5;
        pos[i * 3] = Math.cos(th) * Math.sin(ph) * r;
        pos[i * 3 + 1] = 18 + Math.cos(ph) * r * 0.9;
        pos[i * 3 + 2] = -Math.abs(Math.sin(th) * Math.sin(ph) * r) - 20;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      // sizeAttenuation:false → 不随距离缩小，抬头时星星依然清晰可见
      const mat = new THREE.PointsMaterial({
        size: k ? 3.2 : 2.4, sizeAttenuation: false,
        color: k ? 0xfff4d8 : 0xdfe6ff,
        map: tex, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      scene.add(new THREE.Points(geo, mat));
      starMats.push(mat);
    }
  }

  function addEmbers() {
    const N = 240, pos = new Float32Array(N * 3), vel = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 60;
      pos[i * 3 + 1] = Math.random() * 30;
      pos[i * 3 + 2] = -20 - Math.random() * 50;
      vel.push(0.6 + Math.random() * 1.2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.6, map: KD.util.glowTex(), color: 0xffb060,
      transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    embers = { pts, vel, geo, N };
  }

  function updateEmbers(dt) {
    const pos = embers.geo.attributes.position.array;
    for (let i = 0; i < embers.N; i++) {
      pos[i * 3 + 1] += embers.vel[i] * dt;
      pos[i * 3] += Math.sin((pos[i * 3 + 1] + i) * 0.5) * 0.01;
      if (pos[i * 3 + 1] > 40) { pos[i * 3 + 1] = 0; pos[i * 3] = (Math.random() * 2 - 1) * 60; }
    }
    embers.geo.attributes.position.needsUpdate = true;
  }

  // 梦幻：飘浮光斑（bokeh）
  function addBokeh() {
    const tex = KD.util.glowTex();
    const cols = [0xffcf8a, 0xff9a7a, 0xc7b0ff, 0x9ad9ff, 0xffe3a8];
    for (let i = 0; i < 48; i++) {
      const m = new THREE.SpriteMaterial({
        map: tex, color: cols[(Math.random() * cols.length) | 0],
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        opacity: 0.10 + Math.random() * 0.22
      });
      const s = new THREE.Sprite(m);
      const sz = 2 + Math.random() * 6;
      s.scale.set(sz, sz, 1);
      s.position.set(KD.util.rand(-70, 70), KD.util.rand(-6, 64), KD.util.rand(-95, 8));
      scene.add(s);
      bokeh.push({ s: s, vy: 0.25 + Math.random() * 0.7, ph: Math.random() * 6.28, amp: 0.4 + Math.random() * 1.2, base: s.position.x });
    }
  }

  function updateBokeh(dt, t) {
    for (const b of bokeh) {
      b.s.position.y += b.vy * dt;
      b.s.position.x = b.base + Math.sin(t * 0.3 + b.ph) * b.amp * 2;
      if (b.s.position.y > 68) { b.s.position.y = -8; b.base = KD.util.rand(-70, 70); }
    }
  }

  function addGroundGlow() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,176,96,0.42)');
    g.addColorStop(0.5, 'rgba(180,90,60,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(270, 270),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.2, -14); scene.add(m);
  }

  let t = 0;
  const BASE = new THREE.Vector3(0, 10, 30);
  const DEFAULT_LOOK = new THREE.Vector3(0, 24, -30);
  const lookTarget = new THREE.Vector3(0, 24, -30);
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    KD.lanterns.update(dt, t);
    KD.fireworks.tick(dt);
    updateEmbers(dt);
    updateBokeh(dt, t);
    // 星星闪烁
    if (starMats[0]) starMats[0].opacity = 0.62 + 0.33 * Math.sin(t * 1.7);
    if (starMats[1]) starMats[1].opacity = 0.55 + 0.4 * Math.sin(t * 2.3 + 1.7);

    const hero = KD.lanterns.heroLantern();
    if (hero) {
      // 镜头位置完全固定不动，视线锁定这盏灯，保证它不掉出视野
      camera.position.set(BASE.x, BASE.y, BASE.z);
      lookTarget.lerp(hero.position, 0.25);
    } else {
      camera.position.x = Math.sin(t * 0.08) * 1.8;
      camera.position.y += (10 + Math.sin(t * 0.05) * 0.7 - camera.position.y) * 0.05;
      lookTarget.lerp(DEFAULT_LOOK, 0.04);
    }
    camera.lookAt(lookTarget);
    // 灯飞入灯海后，祝福语模块再回来
    if (KD.uiHidden && !hero) {
      KD.uiHidden = false;
      document.getElementById('ui').classList.remove('hidden');
    }
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  KD.app = { get renderer() { return renderer; }, scene, camera, init };

  window.addEventListener('load', init);

  document.getElementById('startBtn').onclick = () => {
    document.getElementById('startOv').classList.remove('show');
    document.getElementById('ui').classList.remove('hidden');
    KD.audio.start();
  };
  document.getElementById('muteBtn').onclick = () => {
    const m = KD.audio.toggleMute();
    document.getElementById('muteBtn').classList.toggle('muted', m);
  };
  document.getElementById('cardClose').onclick = () => KD.exportCard.hide();
})();
