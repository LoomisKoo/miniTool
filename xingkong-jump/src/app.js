(function () {
  "use strict";
  if (!window.THREE) {
    document.body.innerHTML = '<p style="color:#fff;padding:40px;text-align:center">引擎加载失败，请重新打开</p>';
    return;
  }
  const THREE = window.THREE;

  // —— 参数对齐 weapp-jump（略缩小整体体量） ——
  const BLOCK_H = 4.2;
  const BLOCK_R = 3.2;
  const TOP = BLOCK_H;            // 方块顶面 y（几何中心在 H/2，顶在 H）
  const GRAVITY = 720;
  const VZ_INC = 48, VZ_MAX = 56;
  const VY0 = 120, VY_INC = 12, VY_MAX = 150;
  const SHRINK = 0.005, MIN_SCALE = 0.55;
  // 星心：可视星星固定大小；判定按「脚缘碰到星星」
  const STAR_OUTER = 0.62;
  const STAR_INNER = 0.26;
  // 小人脚底半径 ≈ 0.52 * human.scale(1.38)；再留一点斜视容错
  const BOTTLE_LAND_R = 0.72;
  const PERFECT_R = STAR_OUTER + BOTTLE_LAND_R + 0.12; // ≈ 1.46
  const DIST_MIN = 2, DIST_MAX = 11;
  const TINY_SCALE_MIN = 0.42, TINY_SCALE_MAX = 0.55; // 略小跳台（不再极端）
  const CLOSE_GAP_MIN = 0.5, CLOSE_GAP_MAX = 1.4;     // 很近跳台
  const TINY_GAP_MAX = 5.5; // 小台时间距上限，禁止又小又远
  const COLORS = [0x8eb4c8, 0xb8a0c8, 0x9bc4b0, 0xd4a89a, 0xc9b896, 0x8aa8c4, 0xc4a0b0];
  const METEOR_COLOR = 0xc9a0ff;

  const CONSTELLATIONS = [
    { name: '北斗', nodes: [[0.1,0.55],[0.28,0.42],[0.46,0.48],[0.62,0.38],[0.72,0.22],[0.88,0.18],[0.78,0.55]], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[3,6]] },
    { name: '猎户', nodes: [[0.2,0.2],[0.35,0.35],[0.5,0.42],[0.65,0.35],[0.8,0.2],[0.5,0.7],[0.35,0.78],[0.65,0.78]], edges: [[0,1],[1,2],[2,3],[3,4],[1,5],[3,5],[5,6],[5,7]] },
    { name: '天鹅', nodes: [[0.5,0.12],[0.5,0.38],[0.5,0.62],[0.5,0.88],[0.22,0.45],[0.78,0.45]], edges: [[0,1],[1,2],[2,3],[4,1],[1,5]] },
    { name: '仙后', nodes: [[0.15,0.35],[0.32,0.55],[0.5,0.3],[0.68,0.58],[0.85,0.32]], edges: [[0,1],[1,2],[2,3],[3,4]] }
  ];

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const hexCss = n => '#' + n.toString(16).padStart(6, '0');

  // —— UI / 局内状态 ——
  let uiState = 'start'; // start | playing | ended
  let score = 0, combo = 0, bestCombo = 0, collected = 0, doubleMul = 1;
  let constellation = CONSTELLATIONS[0], constellationLit = 0;

  const $ = id => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('show', on);

  // —— 跨局存档（Storage JS API 优先，客户端 ≥9.46.0；低版本降级 localStorage） ——
  const STORE_KEY = 'xingkong_jump_save';
  const STORAGE_MIN_CLIENT = 9460; // 9.46.0
  const persist = {
    bestScore: 0,
    bestComboAll: 0,
    totalStars: 0,
    litConstellations: [],
    muted: false
  };

  function isXhsEnv() {
    return !!(window.xhs && window.xhs.miniTool);
  }

  function readBuildVersion(launchOptions) {
    const env = launchOptions && launchOptions.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }

  function getClientVersion(buildVersion) {
    return Math.floor(buildVersion / 1000);
  }

  function isClientVersionAtLeast(buildVersion, minClientVersion) {
    return getClientVersion(buildVersion) >= minClientVersion;
  }

  async function getBuildVersion() {
    const xhs = window.xhs;
    const sync = readBuildVersion(xhs && xhs.launchOptions);
    if (sync) return sync;
    const miniTool = xhs && xhs.miniTool;
    if (!miniTool || typeof miniTool.getLaunchOptions !== 'function') return 0;
    try {
      return readBuildVersion(await miniTool.getLaunchOptions());
    } catch (_) {
      return 0;
    }
  }

  async function canUseNativeStorage() {
    const bv = await getBuildVersion();
    const miniTool = window.xhs && window.xhs.miniTool;
    return (
      isClientVersionAtLeast(bv, STORAGE_MIN_CLIENT) &&
      !!miniTool &&
      typeof miniTool.setStorage === 'function' &&
      typeof miniTool.getStorage === 'function'
    );
  }

  async function saveData(key, data) {
    if (await canUseNativeStorage()) {
      try {
        await window.xhs.miniTool.setStorage({ key: key, data: data });
        return true;
      } catch (_) {
        return false;
      }
    }
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (_) {
      return false;
    }
  }

  async function loadData(key) {
    if (await canUseNativeStorage()) {
      try {
        const res = await window.xhs.miniTool.getStorage({ key: key });
        return res && res.data !== undefined ? res.data : null;
      } catch (_) {
        return null;
      }
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function showStorageTip(text) {
    const el = $('storageTip');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('show', !!text);
  }

  function paintStartRecords() {
    const el = $('startRecords');
    if (!el) return;
    const parts = [];
    if (persist.bestScore > 0) parts.push('最高分 <b>' + persist.bestScore + '</b>');
    if (persist.bestComboAll >= 2) parts.push('最高连击 <b>×' + persist.bestComboAll + '</b>');
    if (persist.totalStars > 0) parts.push('累计 <b>★ ' + persist.totalStars + '</b>');
    const litN = persist.litConstellations.length;
    if (litN > 0) parts.push('已点亮 <b>' + litN + '/' + CONSTELLATIONS.length + '</b> 星座');
    if (!parts.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = parts.join(' · ');
  }

  function normalizePersist(data) {
    if (!data || typeof data !== 'object') return;
    persist.bestScore = Math.max(0, Number(data.bestScore) || 0);
    persist.bestComboAll = Math.max(0, Number(data.bestComboAll) || 0);
    persist.totalStars = Math.max(0, Number(data.totalStars) || 0);
    persist.muted = !!data.muted;
    const names = CONSTELLATIONS.map(function (c) { return c.name; });
    const lit = Array.isArray(data.litConstellations) ? data.litConstellations : [];
    persist.litConstellations = lit.filter(function (n) {
      return typeof n === 'string' && names.indexOf(n) >= 0;
    });
  }

  async function commitProgress() {
    let dirty = false;
    if (score > persist.bestScore) {
      persist.bestScore = score;
      dirty = true;
    }
    if (bestCombo > persist.bestComboAll) {
      persist.bestComboAll = bestCombo;
      dirty = true;
    }
    if (collected > 0) {
      persist.totalStars += collected;
      dirty = true;
    }
    if (constellationLit >= constellation.nodes.length) {
      if (persist.litConstellations.indexOf(constellation.name) < 0) {
        persist.litConstellations.push(constellation.name);
        dirty = true;
      }
    }
    if (!dirty) return;
    paintStartRecords();
    const ok = await saveData(STORE_KEY, persist);
    if (!ok && isXhsEnv()) showStorageTip('进度未能保存，可稍后再试');
  }

  async function initPersist() {
    const data = await loadData(STORE_KEY);
    normalizePersist(data);
    SFX.setMuted(persist.muted);
    const muteBtn = $('muteBtn');
    if (muteBtn) {
      muteBtn.classList.toggle('is-muted', persist.muted);
      muteBtn.title = persist.muted ? '取消静音' : '静音';
    }
    paintStartRecords();

    if (!isXhsEnv()) return;
    if (!(await canUseNativeStorage())) {
      showStorageTip('当前小红书版本较低，进度可能无法保存');
    }
  }

  function drawConstellation(cv, lit, big) {
    if (!cv || !constellation) return;
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    const nodes = constellation.nodes;
    const pts = nodes.map(n => [n[0] * w, n[1] * h]);
    ctx.lineWidth = big ? 3 : 2;
    constellation.edges.forEach(([a, b]) => {
      const on = lit > Math.max(a, b);
      ctx.strokeStyle = on ? 'rgba(246,193,119,.85)' : 'rgba(255,255,255,.15)';
      ctx.beginPath();
      ctx.moveTo(pts[a][0], pts[a][1]);
      ctx.lineTo(pts[b][0], pts[b][1]);
      ctx.stroke();
    });
    pts.forEach((p, i) => {
      const on = i < lit;
      ctx.beginPath();
      ctx.arc(p[0], p[1], big ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#ffe08a' : 'rgba(255,255,255,.22)';
      ctx.fill();
      if (on) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], big ? 12 : 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(246,193,119,.2)';
        ctx.fill();
      }
    });
  }

  function updateConstelHUD() {
    $('constelName').textContent = constellation.name + ' ' + constellationLit + '/' + constellation.nodes.length;
    drawConstellation($('constelCv'), constellationLit, false);
  }

  function updateHUD() {
    $('scoreNum').textContent = score;
    $('starNum').textContent = '★ ' + collected;
    const cb = $('combo');
    if (combo >= 2) { $('comboNum').textContent = '×' + combo; cb.classList.add('show'); }
    else cb.classList.remove('show');
    updateConstelHUD();
  }

  // —— 音效（Web Audio 程序化合成，无需音频文件） ——
  const SFX = (function () {
    let ctx = null, muted = false, charge = null;

    function ac() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function envGain(c, vol, a, hold, rel) {
      const g = c.createGain();
      const t0 = c.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + a);
      g.gain.exponentialRampToValueAtTime(vol * 0.7, t0 + a + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + hold + rel);
      g.connect(c.destination);
      return { g: g, t0: t0, end: a + hold + rel };
    }

    function tone(freq, dur, type, vol, toFreq) {
      if (muted) return;
      const c = ac(); if (!c) return;
      const o = c.createOscillator();
      const eg = envGain(c, vol || 0.1, 0.012, Math.max(0.02, dur * 0.35), dur * 0.55);
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, eg.t0);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(Math.max(30, toFreq), eg.t0 + dur);
      o.connect(eg.g);
      o.start(eg.t0);
      o.stop(eg.t0 + eg.end + 0.03);
    }

    function noise(dur, vol, hp) {
      if (muted) return;
      const c = ac(); if (!c) return;
      const n = Math.max(1, (c.sampleRate * dur) | 0);
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp || 600;
      const eg = envGain(c, vol || 0.06, 0.005, 0.02, dur * 0.8);
      src.connect(f); f.connect(eg.g);
      src.start(eg.t0);
      src.stop(eg.t0 + eg.end + 0.02);
    }

    return {
      unlock: function () { ac(); },
      setMuted: function (m) { muted = !!m; if (m) this.chargeStop(); },
      isMuted: function () { return muted; },
      ui: function () { tone(660, 0.07, 'sine', 0.05); },
      chargeStart: function () {
        if (muted || charge) return;
        ac();
        let step = 0;
        function tick() {
          if (!charge || muted) return;
          // 轻柔短音，随蓄力略升高，不拖长嗡鸣
          const f = 460 + Math.min(step, 16) * 16;
          tone(f, 0.04, 'sine', 0.022);
          step++;
        }
        tick();
        charge = { id: setInterval(tick, 145) };
      },
      chargeStop: function () {
        if (!charge) return;
        if (charge.id) clearInterval(charge.id);
        charge = null;
      },
      jump: function () {
        tone(240, 0.16, 'triangle', 0.09, 520);
        noise(0.12, 0.045, 800);
      },
      land: function () {
        tone(210, 0.1, 'sine', 0.08, 140);
        noise(0.06, 0.03, 300);
      },
      perfect: function () {
        tone(523, 0.12, 'sine', 0.09);
        setTimeout(function () { tone(659, 0.12, 'sine', 0.08); }, 55);
        setTimeout(function () { tone(784, 0.18, 'triangle', 0.07); }, 110);
        noise(0.1, 0.035, 1200);
      },
      fall: function () {
        tone(260, 0.32, 'sawtooth', 0.06, 55);
        noise(0.22, 0.05, 200);
      }
    };
  })();

  // —— Three 场景 ——
  const mount = $('game');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x070914, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070914, 70, 160);

  let W = innerWidth, H = innerHeight;
  let frustum = 40;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  function resizeCam() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H);
    const aspect = W / H;
    frustum = H > W ? 46 : 40;
    camera.left = -frustum * aspect / 2;
    camera.right = frustum * aspect / 2;
    camera.top = frustum / 2;
    camera.bottom = -frustum / 2;
    camera.updateProjectionMatrix();
  }
  camera.position.set(-32, 42, 32);
  camera.lookAt(0, 0, 0);
  resizeCam();
  addEventListener('resize', resizeCam);

  const hemi = new THREE.HemisphereLight(0xdde4ff, 0x1a1528, 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0x5a6080, 0.45);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xfff2dc, 0.9);
  dir.position.set(-18, 50, 22);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 140;
  dir.shadow.camera.left = -50;
  dir.shadow.camera.right = 50;
  dir.shadow.camera.top = 50;
  dir.shadow.camera.bottom = -50;
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0x9aafff, 0.28);
  fill.position.set(30, 20, -20);
  scene.add(fill);

  // 星空（软光点，跟着相机走）
  const skyStars = (() => {
    const softTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.25, 'rgba(230,235,255,.85)');
      grd.addColorStop(0.55, 'rgba(180,190,255,.25)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.needsUpdate = true;
      return t;
    })();
    const root = new THREE.Group();
    function layer(n, spreadY, size, opacity, color) {
      const geo = new THREE.BufferGeometry();
      const pos = [];
      for (let i = 0; i < n; i++) {
        pos.push((Math.random() - 0.5) * 220, Math.random() * spreadY + 8, (Math.random() - 0.5) * 220);
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        map: softTex, color, size, transparent: true, opacity,
        sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      root.add(pts);
    }
    layer(420, 110, 1.8, 0.9, 0xe8ecff);
    layer(180, 90, 3.2, 0.45, 0xc8d0ff);
    layer(40, 70, 5.5, 0.28, 0xfff0d0);
    scene.add(root);
    return root;
  })();

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0x0a0c16 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  function shadeHex(hex, amt) {
    const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    const f = t => Math.max(0, Math.min(255, Math.round(amt > 0 ? t + (255 - t) * amt : t * (1 + amt))));
    return (f(r) << 16) | (f(g) << 8) | f(b);
  }

  // 经典五角星（干净、对齐顶面）
  function starShape(outer, inner) {
    const shape = new THREE.Shape();
    const spikes = 5;
    for (let i = 0; i < spikes * 2; i++) {
      const rr = i % 2 === 0 ? outer : inner;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }

  function createStarMesh() {
    const geo = new THREE.ExtrudeGeometry(starShape(STAR_OUTER, STAR_INNER), {
      depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025,
      bevelSegments: 1, curveSegments: 2
    });
    // 先放平到 XZ，再按包围盒居中，避免 rotate + center 顺序导致偏心
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    geo.translate(
      -(bb.min.x + bb.max.x) * 0.5,
      -(bb.min.y + bb.max.y) * 0.5,
      -(bb.min.z + bb.max.z) * 0.5
    );
    geo.computeBoundingBox();
    geo.translate(0, -geo.boundingBox.min.y, 0); // 底面贴 y=0

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffe566, emissive: 0xffb020, emissiveIntensity: 0.7,
      metalness: 0.35, roughness: 0.28
    });
    const star = new THREE.Mesh(geo, mat);
    star.castShadow = false;
    star.position.set(0, 0, 0);

    const g = new THREE.Group();
    g.add(star);
    g.userData.baseY = BLOCK_H + 0.08;
    g.userData.starMat = mat;
    g.position.set(0, g.userData.baseY, 0);
    return g;
  }

  function roundedRectShape(w, d, radius) {
    const shape = new THREE.Shape();
    const hw = w / 2, hd = d / 2, r = Math.min(radius, hw * 0.9, hd * 0.9);
    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    return shape;
  }

  function makeBlockTex(hex, kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const css = hexCss(hex);
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 128, 128);
    ctx.globalAlpha = 0.14;
    if (kind === 0) {
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, i * 13, 128, 5);
      }
    } else if (kind === 1) {
      ctx.fillStyle = '#fff';
      for (let y = 8; y < 128; y += 16)
        for (let x = 8; x < 128; x += 16) {
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
    } else {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      for (let i = -128; i < 256; i += 18) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 128, 128);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 0.22;
    const grd = ctx.createRadialGradient(64, 64, 10, 64, 64, 70);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // —— 方块：圆角柱 / 圆角方台 + 轻纹理 ——
  function makeBlock(sizeScale, color, withStar) {
    const r = BLOCK_R * sizeScale;
    const isCyl = Math.random() < 0.45;
    const group = new THREE.Group();
    const kind = (Math.random() * 3) | 0;
    const sideTex = makeBlockTex(color, kind);
    const topTex = makeBlockTex(shadeHex(color, 0.22), kind);
    const sideMat = new THREE.MeshStandardMaterial({
      map: sideTex, color: 0xffffff, roughness: 0.58, metalness: 0.04
    });
    const topMat = new THREE.MeshStandardMaterial({
      map: topTex, color: 0xffffff, emissive: color, emissiveIntensity: 0.05,
      roughness: 0.42, metalness: 0.06
    });
    let mesh, top;
    if (isCyl) {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.96, r, BLOCK_H, 48),
        sideMat
      );
      top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 48), topMat);
    } else {
      const shape = roundedRectShape(r * 2, r * 2, r * 0.28);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: BLOCK_H, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14,
        bevelSegments: 3, curveSegments: 8
      });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, -BLOCK_H / 2, 0);
      mesh = new THREE.Mesh(geo, sideMat);
      mesh.position.y = BLOCK_H / 2;
      const topShape = roundedRectShape(r * 1.88, r * 1.88, r * 0.26);
      const topGeo = new THREE.ShapeGeometry(topShape, 12);
      top = new THREE.Mesh(topGeo, topMat);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    if (isCyl) mesh.position.y = BLOCK_H / 2;
    group.add(mesh);
    top.rotation.x = -Math.PI / 2;
    top.position.y = BLOCK_H + 0.02;
    group.add(top);

    const star = createStarMesh();
    star.visible = !!withStar;
    group.add(star);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(r * 1.12, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    group.add(shadow);

    return {
      obj: group, mesh, top, star, shadow, r, baseR: r, color, shape: isCyl ? 'cyl' : 'box',
      hasStar: !!withStar, collected: !withStar, bob: Math.random() * 6.28,
      meteor: false, meteorMode: null, homeX: 0, homeZ: 0, driftPhase: 0, age: 0
    };
  }

  // —— 小人：棋子造型 ——
  function makeBottle() {
    const root = new THREE.Group();
    const human = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xfff4e8, roughness: 0.55, metalness: 0.05 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe04545, roughness: 0.48, metalness: 0.08 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xffd0a8, roughness: 0.45, metalness: 0.05 });

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.18, 20), bodyMat);
    foot.position.y = 0.09;
    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), bodyMat);
    hip.position.y = 0.42; hip.scale.set(1, 0.7, 1);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 0.85, 20), bodyMat);
    torso.position.y = 0.95;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 8, 20), accent);
    scarf.position.y = 1.38; scarf.rotation.x = Math.PI / 2;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.18, 12), skin);
    neck.position.y = 1.48;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), skin);
    head.position.y = 1.88;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x3a3344 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.12, 1.92, 0.36);
    eyeR.position.set(0.12, 1.92, 0.36);
    const blushL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf0a8b0, transparent: true, opacity: 0.45 }));
    const blushR = blushL.clone();
    blushL.position.set(-0.22, 1.82, 0.3);
    blushR.position.set(0.22, 1.82, 0.3);

    const body = new THREE.Group();
    body.add(foot); body.add(hip); body.add(torso); body.add(scarf);
    human.add(body); human.add(neck); human.add(head);
    human.add(eyeL); human.add(eyeR); human.add(blushL); human.add(blushR);
    human.scale.setScalar(1.38);
    root.add(human);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    root.add(shadow);

    return {
      obj: root, human, body, head, shadow, eyeL, eyeR,
      status: 'stop', velocity: { vy: 0, vz: 0 }, flyingTime: 0,
      axis: new THREE.Vector3(1, 0, 0), scale: 1, destination: [0, 0],
      faceY: 0, flipAngle: 0, flipTotal: Math.PI * 2, flightT: 0.4,
      trailAcc: 0
    };
  }

  function setBottleSquash(bottle, s) {
    bottle.scale = s;
    bottle.body.scale.set(1 + (1 - s) * 0.5, s, 1 + (1 - s) * 0.5);
    const hy = 1.88 * s + (1 - s) * 0.35;
    bottle.head.position.y = hy;
    bottle.eyeL.position.y = bottle.eyeR.position.y = hy + 0.04;
    bottle.shadow.scale.setScalar(1 + (1 - s) * 0.4);
  }

  // —— 游戏状态 ——
  const bottle = makeBottle();
  scene.add(bottle.obj);

  let blocks = [];
  let cur = null, next = null;
  let straight = true;
  let rMin = 0.85, rMax = 1.0, dMin = DIST_MIN, dMax = DIST_MAX;
  let pressAt = 0;
  let camTarget = new THREE.Vector3();
  let camPos = new THREE.Vector3();
  let floatScores = []; // {mesh, life}
  let fx = []; // 收集特效 particles / rings

  function clearBlocks() {
    for (const b of blocks) scene.remove(b.obj);
    blocks = [];
  }

  function placeNext(from, goingStraight) {
    // 默认跟当前难度区间；开局前几跳不搞花样
    let scale = rand(rMin, rMax);
    let gap = rand(dMin, dMax);
    let isTiny = false;
    if (score >= 3) {
      // 偶尔略小的跳台（更稀、更大一点）
      if (Math.random() < 0.04) {
        scale = rand(TINY_SCALE_MIN, TINY_SCALE_MAX);
        isTiny = true;
      }
      // 偶尔很近的跳台
      if (Math.random() < 0.18) gap = rand(CLOSE_GAP_MIN, CLOSE_GAP_MAX);
    }
    // 小台禁止又远：间距压到中近程
    if (isTiny && gap > TINY_GAP_MAX) gap = rand(CLOSE_GAP_MIN, TINY_GAP_MAX);
    const isMeteor = Math.random() < 0.18;
    const color = isMeteor ? METEOR_COLOR : pick(COLORS);
    const b = makeBlock(scale, color, true);
    const step = from.r + gap + b.r;
    const p = from.obj.position;
    if (goingStraight) b.obj.position.set(p.x + step, 0, p.z);
    else b.obj.position.set(p.x, 0, p.z - step);
    b.homeX = b.obj.position.x;
    b.homeZ = b.obj.position.z;
    if (isMeteor) {
      b.meteor = true;
      b.meteorMode = Math.random() < 0.5 ? 'drift' : 'shrink';
      b.driftPhase = Math.random() * 6.28;
      // 流星台顶面更亮一点
      if (b.top.material) {
        b.top.material.emissive = new THREE.Color(METEOR_COLOR);
        b.top.material.emissiveIntensity = 0.22;
      }
    }
    b.mesh.position.y = BLOCK_H / 2 + 16;
    b.star.visible = false;
    scene.add(b.obj);
    blocks.push(b);
    const start = performance.now();
    const fromY = BLOCK_H / 2 + 16;
    const toY = BLOCK_H / 2;
    (function pop() {
      const t = Math.min(1, (performance.now() - start) / 380);
      const e = 1 - Math.pow(1 - t, 3);
      const y = fromY + (toY - fromY) * e;
      b.mesh.position.y = y;
      b.top.position.y = y + BLOCK_H / 2 + 0.01;
      if (t < 1) requestAnimationFrame(pop);
      else {
        b.mesh.position.y = toY;
        b.top.position.y = BLOCK_H + 0.01;
        if (b.hasStar && !b.collected) {
          b.star.visible = true;
          b.star.position.set(0, b.star.userData.baseY || (BLOCK_H + 0.08), 0);
        }
      }
    })();
    return b;
  }

  function resetGame() {
    clearBlocks();
    floatScores.forEach(f => scene.remove(f.mesh));
    floatScores = [];
    fx.forEach(f => scene.remove(f.mesh));
    fx = [];
    straight = true;
    rMin = 0.85; rMax = 1.0; dMin = DIST_MIN; dMax = DIST_MAX;
    score = 0; combo = 0; bestCombo = 0; collected = 0; doubleMul = 1;
    constellation = pick(CONSTELLATIONS);
    constellationLit = 0;
    updateHUD();

    // 开局第一块：无星星
    cur = makeBlock(1, 0x7eb8a8, false);
    cur.hasStar = false;
    cur.collected = true;
    cur.star.visible = false;
    cur.obj.position.set(0, 0, 0);
    cur.homeX = 0; cur.homeZ = 0;
    scene.add(cur.obj);
    blocks.push(cur);

    next = placeNext(cur, true);
    straight = false;

    bottle.obj.position.set(0, TOP + 0.05, 0);
    bottle.obj.rotation.set(0, 0, 0);
    bottle.human.rotation.set(0, 0, 0);
    setBottleSquash(bottle, 1);
    bottle.status = 'stop';
    bottle.velocity = { vy: 0, vz: 0 };
    bottle.flyingTime = 0;
    bottle.flipAngle = 0;
    bottle.flipTotal = Math.PI * 2;
    bottle.flightT = 0.4;
    bottle.fallV = 0;

    camTarget.set(next.obj.position.x / 2, 0, next.obj.position.z / 2);
    camPos.copy(camTarget);
    camera.position.set(camPos.x - 32, 42, camPos.z + 32);
    camera.lookAt(camPos.x, 0, camPos.z);
    ground.position.set(camPos.x, 0, camPos.z);
    faceJumpDir();
  }

  function fillEndSummary() {
    const rows = [
      ['得分', String(score)],
      ['收集星星', '★ ' + collected],
      ['最高连击', bestCombo >= 2 ? '×' + bestCombo : '—'],
      ['星座 · ' + constellation.name, constellationLit + '/' + constellation.nodes.length + (constellationLit >= constellation.nodes.length ? ' 已点亮' : '')]
    ];
    $('endSummary').innerHTML = rows.map(function (r, i) {
      const ok = i === 3 && constellationLit >= constellation.nodes.length;
      return '<div class="row' + (ok ? ' ok' : '') + '"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join('');
    drawConstellation($('endConstel'), constellationLit, true);
  }

  function startGame() {
    SFX.unlock();
    SFX.ui();
    resetGame();
    uiState = 'playing';
    show('startOv', false);
    show('endOv', false);
    show('expOv', false);
  }

  function endGame() {
    uiState = 'ended';
    bottle.status = 'stop';
    fillEndSummary();
    show('endOv', true);
    commitProgress();
  }

  // —— 输入：document 捕获阶段，避免松手丢失 ——
  let holding = false;

  function blockedTarget(t) {
    if (!t || !t.closest) return false;
    return !!t.closest('.overlay.show, .btn, .icon-btn');
  }

  function beginCharge() {
    if (uiState !== 'playing' || bottle.status !== 'stop') return false;
    holding = true;
    pressAt = performance.now();
    bottle.status = 'prepare';
    faceJumpDir();
    SFX.unlock();
    SFX.chargeStart();
    return true;
  }

  function releaseJump() {
    if (!holding && bottle.status !== 'prepare') return;
    holding = false;
    if (bottle.status !== 'prepare') return;
    try {
      SFX.chargeStop();
      const t = Math.min(Math.max((performance.now() - pressAt) / 1000, 0.08), 2.5);
      faceJumpDir();
      bottle.velocity.vz = Math.min(t * VZ_INC, VZ_MAX);
      bottle.velocity.vy = Math.min(VY0 + t * VY_INC, VY_MAX);
      bottle.flyingTime = 0;
      bottle.trailAcc = 0;
      // 预计滞空时间（同高度落地 ≈ 2*vy/g），翻转整数圈刚好站稳
      const flightT = Math.max(0.28, 2 * bottle.velocity.vy / GRAVITY);
      const flips = Math.max(1, Math.round(flightT / 0.42));
      bottle.flightT = flightT;
      bottle.flipTotal = Math.PI * 2 * flips;
      bottle.flipAngle = 0;
      bottle.human.rotation.order = 'YXZ';
      bottle.human.rotation.set(0, bottle.faceY, 0);
      setBottleSquash(bottle, 1);
      bottle.obj.position.y = TOP + 0.05;
      bottle.status = 'jump';
      SFX.jump();
    } catch (err) {
      console.error('releaseJump', err);
      SFX.chargeStop();
      bottle.status = 'stop';
      holding = false;
      setBottleSquash(bottle, 1);
      bottle.obj.position.y = TOP + 0.05;
    }
  }

  function onPressStart(e) {
    if (blockedTarget(e.target)) return;
    if (!beginCharge()) return;
    if (e.cancelable) e.preventDefault();
  }
  function onPressEnd(e) {
    if (!(bottle.status === 'prepare' || holding)) return;
    if (e && e.cancelable) e.preventDefault();
    releaseJump();
  }

  const endEvts = ['pointerup', 'pointercancel', 'mouseup', 'touchend', 'touchcancel'];
  const startEvts = ['pointerdown', 'mousedown', 'touchstart'];
  startEvts.forEach(function (name) {
    document.addEventListener(name, onPressStart, { capture: true, passive: false });
  });
  endEvts.forEach(function (name) {
    document.addEventListener(name, onPressEnd, { capture: true, passive: false });
  });
  // 鼠标松手后若丢失 up，移动时 buttons===0 也可起跳
  document.addEventListener('pointermove', function (e) {
    if ((bottle.status === 'prepare' || holding) && e.pointerType === 'mouse' && e.buttons === 0) {
      releaseJump();
    }
  }, true);
  window.addEventListener('blur', function () {
    if (bottle.status === 'prepare' || holding) releaseJump();
  });

  renderer.domElement.style.touchAction = 'none';
  mount.style.touchAction = 'none';
  document.body.style.touchAction = 'none';

  window.__dbg = function () {
    return {
      ui: uiState,
      st: bottle.status,
      holding: holding,
      y: bottle.obj.position.y,
      hasAxis: !!bottle.axis,
      keys: Object.keys(bottle)
    };
  };

  // —— 碰撞：落点是否在方块顶面 ——
  function perfectRadius(block) {
    // 脚缘碰到固定大小的星星即算；小台面时不超过台面
    return Math.min(PERFECT_R, block.r * 0.98);
  }

  function hitResult(px, pz, block) {
    const dx = px - block.obj.position.x;
    const dz = pz - block.obj.position.z;
    const dist = Math.hypot(dx, dz);
    let inside;
    if (block.shape === 'cyl') inside = dist <= block.r;
    else inside = Math.abs(dx) <= block.r && Math.abs(dz) <= block.r;
    if (!inside) return 0;
    if (dist <= perfectRadius(block)) return 2; // perfect / 踩星
    return 1; // ok
  }

  function spawnFloat(x, y, z, text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const c = canvas.getContext('2d');
    c.font = 'bold 36px PingFang SC, sans-serif';
    c.fillStyle = color;
    c.textAlign = 'center';
    c.fillText(text, 64, 44);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(4, 2, 1);
    sp.position.set(x, y + 4, z);
    scene.add(sp);
    floatScores.push({ mesh: sp, life: 1 });
  }

  // 收集：碎星散开（轻量）
  function spawnCollectFX(block) {
    const ox = block.obj.position.x;
    const oy = TOP + 1.1;
    const oz = block.obj.position.z;
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.1 + Math.random() * 0.08, 0),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe08a : 0xfff6d6 })
      );
      const a = Math.random() * Math.PI * 2;
      const sp = 2.5 + Math.random() * 4;
      p.position.set(ox, oy, oz);
      scene.add(p);
      fx.push({
        mesh: p, life: 0.7, kind: 'spark',
        vx: Math.cos(a) * sp, vy: 3 + Math.random() * 4, vz: Math.sin(a) * sp
      });
    }
  }

  // 跳跃拖尾：细碎彩星（繁星感）
  const trailTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  })();
  const TRAIL_COLORS = [0xffffff, 0xffe8a8, 0xa8c8ff, 0xffb8d8, 0xc8b0ff, 0xb8ffe8, 0xffd0a0, 0xd0e8ff];

  function spawnJumpTrail(x, y, z) {
    const n = 3 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: trailTex, color: pick(TRAIL_COLORS),
        transparent: true, opacity: 0.9, depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const sp = new THREE.Sprite(mat);
      const s = 0.32 + Math.random() * 0.28;
      sp.scale.set(s, s, 1);
      sp.position.set(
        x + (Math.random() - 0.5) * 0.55,
        y + 0.35 + Math.random() * 0.9,
        z + (Math.random() - 0.5) * 0.55
      );
      scene.add(sp);
      fx.push({
        mesh: sp, life: 0.65 + Math.random() * 0.3, kind: 'trail',
        vx: (Math.random() - 0.5) * 0.9,
        vy: 0.25 + Math.random() * 0.7,
        vz: (Math.random() - 0.5) * 0.9,
        shrink: s
      });
    }
  }

  function faceJumpDir() {
    if (!next) return;
    const dx = next.obj.position.x - bottle.obj.position.x;
    const dz = next.obj.position.z - bottle.obj.position.z;
    const len = Math.hypot(dx, dz) || 1;
    bottle.axis.set(dx / len, 0, dz / len);
    // 模型脸朝 +Z，Y 旋转对准跳跃方向
    bottle.faceY = Math.atan2(dx, dz);
    if (bottle.status === 'stop' || bottle.status === 'prepare') {
      bottle.human.rotation.order = 'YXZ';
      bottle.human.rotation.set(0, bottle.faceY, 0);
    }
  }

  function succeed(perfect) {
    // 微信跳一跳：落地 +1；踩中心连击 2/4/6/8…（本局用星心）
    const gotStar = perfect && next.hasStar && !next.collected;
    if (gotStar) {
      combo++;
      if (combo > bestCombo) bestCombo = combo;
      collected++;
      if (doubleMul === 1) doubleMul = 2;
      else doubleMul = Math.min(32, doubleMul + 2);
      const gain = doubleMul;
      score += gain;
      next.collected = true;
      next.hasStar = false;
      next.star.visible = false;
      if (constellationLit < constellation.nodes.length) constellationLit++;
      spawnCollectFX(next);
      spawnFloat(next.obj.position.x, TOP + 1, next.obj.position.z, '+' + gain, '#f6c177');
      SFX.perfect();
    } else {
      combo = 0; doubleMul = 1; score += 1;
      spawnFloat(next.obj.position.x, TOP + 1, next.obj.position.z, '+1', '#ffffff');
      SFX.land();
    }

    // 流星台落地后停止漂移/缩小
    next.meteor = false;

    rMin = Math.max(0.55, rMin - 0.003);
    rMax = Math.max(0.72, rMax - 0.003);
    dMax = Math.min(14, dMax + 0.03);
    updateHUD();

    const prev = cur;
    cur = next;
    if (cur.collected && cur.star) cur.star.visible = false;
    next = placeNext(cur, straight);
    straight = !straight;

    setTimeout(() => {
      scene.remove(prev.obj);
      blocks = blocks.filter(b => b !== prev);
    }, 2500);

    camTarget.set(
      (cur.obj.position.x + next.obj.position.x) / 2,
      0,
      (cur.obj.position.z + next.obj.position.z) / 2
    );
  }

  function resolveLand() {
    const x = bottle.obj.position.x;
    const z = bottle.obj.position.z;
    bottle.obj.position.y = TOP + 0.05;
    bottle.human.rotation.order = 'YXZ';
    bottle.human.rotation.set(0, bottle.faceY, 0);

    const hitNext = hitResult(x, z, next);
    if (hitNext > 0) {
      bottle.status = 'stop';
      succeed(hitNext === 2);
      faceJumpDir();
      return;
    }
    const hitCur = hitResult(x, z, cur);
    if (hitCur > 0) {
      bottle.status = 'stop';
      combo = 0; doubleMul = 1; updateHUD();
      faceJumpDir();
      return;
    }
    // 掉落
    bottle.status = 'fall';
    bottle.fallV = 6;
    SFX.fall();
  }

  // —— 主循环 ——
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (uiState === 'playing') {
      // 蓄力：只压扁小人，方块不动
      if (bottle.status === 'prepare') {
        if (!holding || performance.now() - pressAt > 2500) releaseJump();
        else {
          const s = Math.max(MIN_SCALE, bottle.scale - SHRINK * 60 * dt);
          setBottleSquash(bottle, s);
          bottle.obj.position.y = TOP + 0.05;
          faceJumpDir();
        }
      }

      if (bottle.status === 'jump') {
        const e = dt;
        const dy = bottle.velocity.vy * e - GRAVITY / 2 * e * e - GRAVITY * bottle.flyingTime * e;
        bottle.flyingTime += e;
        bottle.obj.position.y += dy;
        bottle.obj.translateOnAxis(bottle.axis, bottle.velocity.vz * e);
        // 跳跃星光拖尾
        bottle.trailAcc = (bottle.trailAcc || 0) + bottle.velocity.vz * e;
        if (bottle.trailAcc > 0.32) {
          bottle.trailAcc = 0;
          const pos = bottle.obj.position;
          spawnJumpTrail(pos.x, pos.y, pos.z);
        }
        // 按预计滞空时间转整数圈，落地刚好站立；脸始终朝跳跃方向
        const p = Math.min(1, bottle.flyingTime / bottle.flightT);
        bottle.flipAngle = bottle.flipTotal * p;
        bottle.human.rotation.order = 'YXZ';
        bottle.human.rotation.y = bottle.faceY;
        bottle.human.rotation.x = -bottle.flipAngle;
        bottle.human.rotation.z = 0;
        if (bottle.obj.position.y <= TOP + 0.05 && bottle.flyingTime > 0.28) {
          resolveLand();
        }
      }

      if (bottle.status === 'fall') {
        bottle.fallV = (bottle.fallV || 0) + 60 * dt;
        bottle.obj.position.y -= bottle.fallV * dt;
        bottle.human.rotation.order = 'YXZ';
        bottle.human.rotation.z += dt * 2.2;
        bottle.human.rotation.x += dt * 1.2;
        if (bottle.obj.position.y <= 0.25) {
          bottle.obj.position.y = 0.25;
          bottle.status = 'fallen';
          bottle.human.rotation.z = Math.PI / 2;
          bottle.human.rotation.x = 0.2;
          setTimeout(function () {
            if (uiState === 'playing') endGame();
          }, 850);
        }
      }

      camPos.lerp(camTarget, Math.min(1, dt * 2.8));
      camera.position.set(camPos.x - 32, 42, camPos.z + 32);
      camera.lookAt(camPos.x, 0, camPos.z);
      ground.position.set(camPos.x, 0, camPos.z);
      dir.position.set(camPos.x - 20, 40, camPos.z + 10);
      skyStars.position.set(camPos.x, 0, camPos.z);

      // 流星台：漂移 / 缩小（仅未落地的 next）
      if (next && next.meteor) {
        next.age = (next.age || 0) + dt;
        if (next.meteorMode === 'drift') {
          next.obj.position.x = next.homeX + Math.sin(now / 900 + next.driftPhase) * 1.35;
          next.obj.position.z = next.homeZ + Math.cos(now / 1100 + next.driftPhase) * 1.0;
        } else {
          const s = Math.max(0.42, 1 - next.age * 0.055);
          next.mesh.scale.set(s, 1, s);
          next.top.scale.set(s, s, 1);
          next.shadow.scale.setScalar(s);
          // 星星大小固定，不随台面缩小
          next.r = next.baseR * s;
        }
      }
    }

    // 飘分
    for (let i = floatScores.length - 1; i >= 0; i--) {
      const f = floatScores[i];
      f.life -= dt * 0.9;
      f.mesh.position.y += dt * 4;
      f.mesh.material.opacity = Math.max(0, f.life);
      if (f.life <= 0) { scene.remove(f.mesh); floatScores.splice(i, 1); }
    }

    // 碎星 / 拖尾特效
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      if (f.kind === 'trail') {
        f.life -= dt * 1.5;
        f.mesh.position.x += f.vx * dt;
        f.mesh.position.y += f.vy * dt;
        f.mesh.position.z += f.vz * dt;
        const op = Math.max(0, f.life);
        if (f.mesh.material) f.mesh.material.opacity = Math.min(1, op * 1.15);
        const sc = (f.shrink || 0.35) * (0.55 + op * 0.45);
        f.mesh.scale.set(sc, sc, 1);
      } else {
        f.life -= dt * 2.2;
        f.vy -= 22 * dt;
        f.mesh.position.x += f.vx * dt;
        f.mesh.position.y += f.vy * dt;
        f.mesh.position.z += f.vz * dt;
        f.mesh.rotation.x += dt * 8;
        f.mesh.rotation.y += dt * 6;
        if (f.mesh.material) f.mesh.material.opacity = Math.max(0, f.life);
      }
      if (f.life <= 0) { scene.remove(f.mesh); fx.splice(i, 1); }
    }

    // 星星：上下微动 + 自发光呼吸
    for (const b of blocks) {
      if (b.star && b.star.visible && !b.collected) {
        const base = b.star.userData.baseY || (BLOCK_H + 0.08);
        b.star.position.set(0, base + Math.sin(now / 650 + b.bob) * 0.1, 0);
        if (b.star.userData.starMat) {
          b.star.userData.starMat.emissiveIntensity = 0.55 + Math.sin(now / 480 + b.bob) * 0.2;
        }
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // —— 摘要卡导出 ——
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
    const ec = document.createElement('canvas'); ec.width = cw; ec.height = ch;
    const e = ec.getContext('2d');
    const bg = e.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#151528'); bg.addColorStop(0.55, '#0c0e1a'); bg.addColorStop(1, '#070914');
    e.fillStyle = bg; e.fillRect(0, 0, cw, ch);
    // 星点
    for (let i = 0; i < 80; i++) {
      e.fillStyle = 'rgba(255,255,255,' + (0.15 + Math.random() * 0.45) + ')';
      e.beginPath();
      e.arc(Math.random() * cw, Math.random() * ch * 0.7, Math.random() * 2.2 + 0.4, 0, Math.PI * 2);
      e.fill();
    }
    e.textAlign = 'center';
    e.fillStyle = '#f6c177'; e.font = '600 56px PingFang SC,sans-serif';
    e.fillText('星空跳一跳', cw / 2, 160);
    e.fillStyle = 'rgba(244,241,234,.55)'; e.font = '400 28px PingFang SC,sans-serif';
    e.fillText('本局摘要卡', cw / 2, 220);

    const lines = [
      ['得分', String(score)],
      ['星星', String(collected)],
      ['最高连击', bestCombo >= 2 ? '×' + bestCombo : '—'],
      ['星座', constellation.name + '  ' + constellationLit + '/' + constellation.nodes.length]
    ];
    lines.forEach(function (row, i) {
      const y = 320 + i * 70;
      e.textAlign = 'left';
      e.fillStyle = 'rgba(244,241,234,.45)'; e.font = '400 28px PingFang SC,sans-serif';
      e.fillText(row[0], 160, y);
      e.textAlign = 'right';
      e.fillStyle = '#f4f1ea'; e.font = '600 32px PingFang SC,sans-serif';
      e.fillText(row[1], cw - 160, y);
    });

    // 星座图
    const boxY = 720, boxH = 360;
    e.fillStyle = 'rgba(255,255,255,.04)';
    roundRectPath(e, 120, boxY, cw - 240, boxH, 28);
    e.fill();
    const tmp = document.createElement('canvas');
    tmp.width = 600; tmp.height = 280;
    drawConstellation(tmp, constellationLit, true);
    e.drawImage(tmp, (cw - 600) / 2, boxY + 40);

    e.textAlign = 'center';
    e.fillStyle = 'rgba(244,241,234,.35)'; e.font = '400 26px PingFang SC,sans-serif';
    const d = new Date();
    e.fillText(d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() + ' · 星空跳一跳', cw / 2, ch - 90);
    return ec;
  }

  function openExport() {
    const tip = $('expHint');
    if (tip) tip.textContent = '';
    $('expImg').src = buildExport().toDataURL('image/png');
    show('expOv', true);
  }

  function hasPostNote() {
    return !!(window.xhs && window.xhs.miniTool && typeof window.xhs.miniTool.postNote === 'function');
  }

  function isPreviewHost() {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '' || location.protocol === 'file:';
  }

  function syncPostNoteBtns() {
    const showBtn = hasPostNote() || isPreviewHost();
    ['postNoteBtn', 'postNoteExpBtn'].forEach(function (id) {
      const el = $(id);
      if (el) el.hidden = !showBtn;
    });
  }

  function buildNoteCopy() {
    const litOk = constellationLit >= constellation.nodes.length;
    const content = [
      '得分 ' + score,
      '收集星星 ★ ' + collected,
      bestCombo >= 2 ? '最高连击 ×' + bestCombo : null,
      '星座 · ' + constellation.name + ' ' + constellationLit + '/' + constellation.nodes.length + (litOk ? ' 已点亮' : ''),
      '',
      '按住蓄力 · 松手起跳 · 踩星连击 #星空跳一跳'
    ].filter(function (x) { return x !== null; }).join('\n');
    return {
      title: '星空跳一跳本局摘要'.slice(0, 20),
      content: content.slice(0, 1000)
    };
  }

  let postingNote = false;
  function postSummaryNote() {
    const tip = $('expHint');
    if (!hasPostNote()) {
      if (tip && $('expOv').classList.contains('show')) {
        tip.textContent = '请在小红书 App 内发布笔记';
      }
      return;
    }
    if (postingNote) return;
    postingNote = true;
    SFX.ui();
    const dataUrl = buildExport().toDataURL('image/png');
    const copy = buildNoteCopy();
    const bridge = window.xhs.miniTool;
    const btns = ['postNoteBtn', 'postNoteExpBtn', 'saveBtn', 'saveCardBtn'].map($).filter(Boolean);
    btns.forEach(function (b) { b.style.pointerEvents = 'none'; b.style.opacity = '0.6'; });
    if (tip && $('expOv').classList.contains('show')) tip.textContent = '正在打开发布页…';

    function finish(ok, msg) {
      postingNote = false;
      btns.forEach(function (b) { b.style.pointerEvents = ''; b.style.opacity = ''; });
      if (tip && $('expOv').classList.contains('show')) {
        tip.textContent = ok ? (msg || '已打开发布页') : (msg || '发布失败，请重试');
      }
    }

    function doPost(url) {
      return bridge.postNote({
        title: copy.title,
        content: copy.content,
        pageType: 'photo_publish',
        mediaInfo: { image_resources: [{ url: url }] }
      });
    }

    const prep = typeof bridge.writeTempFile === 'function'
      ? bridge.writeTempFile({ data: dataUrl }).then(function (res) {
          return doPost(res.filePath);
        })
      : doPost(dataUrl);

    prep.then(function () {
      finish(true, '已打开发布页');
    }).catch(function () {
      finish(false, '发布失败，请重试');
    });
  }

  $('startBtn').onclick = startGame;
  $('againBtn').onclick = startGame;
  $('saveCardBtn').onclick = function () { SFX.ui(); openExport(); };
  $('expClose').onclick = () => show('expOv', false);
  $('saveBtn').onclick = function () {
    SFX.ui();
    const dataUrl = buildExport().toDataURL('image/png');
    const tip = $('expHint');
    const bridge = window.xhs && window.xhs.miniTool;
    if (bridge && typeof bridge.saveImageToPhotosAlbum === 'function') {
      if (tip) tip.textContent = '保存中…';
      const save = function (filePath) {
        return bridge.saveImageToPhotosAlbum({ filePath: filePath });
      };
      const p = typeof bridge.writeTempFile === 'function'
        ? bridge.writeTempFile({ data: dataUrl }).then(function (res) {
            return save(res.filePath);
          })
        : save(dataUrl);
      p.then(function () {
        if (tip) tip.textContent = '已保存到相册';
      }).catch(function () {
        if (tip) tip.textContent = '保存失败，请检查相册权限后重试';
      });
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = '星空跳一跳-摘要卡.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (tip) tip.textContent = '';
  };
  function onPostNoteClick() { postSummaryNote(); }
  if ($('postNoteBtn')) $('postNoteBtn').onclick = onPostNoteClick;
  if ($('postNoteExpBtn')) $('postNoteExpBtn').onclick = onPostNoteClick;
  $('muteBtn').onclick = function () {
    SFX.setMuted(!SFX.isMuted());
    $('muteBtn').classList.toggle('is-muted', SFX.isMuted());
    $('muteBtn').title = SFX.isMuted() ? '取消静音' : '静音';
    persist.muted = SFX.isMuted();
    saveData(STORE_KEY, persist).then(function (ok) {
      if (!ok && isXhsEnv()) showStorageTip('进度未能保存，可稍后再试');
    });
  };

  // 开场预览场景
  resetGame();
  initPersist();
  syncPostNoteBtns();
  // 桥可能注入较晚：前几秒轮询
  (function pollBridge() {
    let n = 0;
    const t = setInterval(function () {
      syncPostNoteBtns();
      n++;
      if (hasPostNote() || n >= 20) clearInterval(t);
    }, 250);
  })();

  // 调试：window.__jumpTest(holdMs)
  window.__jumpTest = function (holdMs) {
    if (uiState !== 'playing') startGame();
    const t = Math.min((holdMs || 700) / 1000, 2.5);
    const dx = next.obj.position.x - bottle.obj.position.x;
    const dz = next.obj.position.z - bottle.obj.position.z;
    const len = Math.hypot(dx, dz) || 1;
    bottle.axis.set(dx / len, 0, dz / len);
    bottle.faceY = Math.atan2(dx / len, dz / len);
    bottle.velocity.vz = Math.min(t * VZ_INC, VZ_MAX);
    bottle.velocity.vy = Math.min(VY0 + t * VY_INC, VY_MAX);
    bottle.flyingTime = 0;
    bottle.flightT = Math.max(0.28, 2 * bottle.velocity.vy / GRAVITY);
    bottle.flipTotal = Math.PI * 2 * Math.max(1, Math.round(bottle.flightT / 0.42));
    bottle.flipAngle = 0;
    bottle.human.rotation.order = 'YXZ';
    bottle.human.rotation.set(0, bottle.faceY, 0);
    setBottleSquash(bottle, 1);
    bottle.status = 'jump';
    return { vz: bottle.velocity.vz, dist: Math.hypot(dx, dz) };
  };
})();
