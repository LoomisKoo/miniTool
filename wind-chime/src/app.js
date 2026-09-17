/* 微风铃语 v9 - 窗帘式软绳风铃
 * 横杆下一排竖串；Verlet 软绳链（定长约束 + 重力），可弯曲但不散架
 * 拨动给节点初速度，波沿绳向下传，邻串靠近轻碰
 */
(function () {
  const WC = window.WC;

  // ===== 结构：窗帘横杆 + 一排竖串 =====
  const N_STRAND = 12;
  const PER = 10;                // 节数 +2
  const ANCHOR_Y = 1.9;
  const ROD_Y = ANCHOR_Y - 0.08;
  let ROD_HALF = 1.0;            // resize 时按可见屏宽设定（左右留白）
  const ROD_PAD = 0.12;          // 左右各留约 12%（小红书 WebView 可视区常窄于 innerWidth）
  const ROD_TIP = 0.04;          // 两端圆头伸出，算进半宽预算
  const TUBE_GAP = 0.01;
  // 节略短，总长仍够摆、底部易相碰
  const tubeLen = k => 0.068 + k * 0.0065;
  const tubeR = () => 0.0115;    // 略加粗
  const rimX = j => (N_STRAND <= 1 ? 0 : -ROD_HALF + j * (2 * ROD_HALF) / (N_STRAND - 1));
  const rimZ = j => ((j & 1) ? 0.012 : -0.01);

  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0];
  function bellF(j, k) {
    return PENTA[(j + (PER - 1 - k)) % 5];
  }
  const STRAND_COLOR = [
    0xe8f0f6, 0xf6e6c8, 0xdceee8, 0xf6d8e0, 0xdde2f6, 0xf0e2c4,
    0xe6ecf6, 0xf8e8cc, 0xe0eee6, 0xf6dce4, 0xe0e6f6, 0xf0e4d0
  ];

  const G = 9.8;

  const $ = id => document.getElementById(id);
  const stageHost = $('stage3d');
  const themeBtn = $('themeBtn'), themeLab = $('themeLab');
  const wishBtn = $('wishBtn'), muteBtn = $('muteBtn');
  const startOv = $('startOv'), startBtn = $('startBtn');
  const wishOv = $('wishOv'), wishDate = $('wishDate');
  const wishInput = $('wishInput'), wishChips = $('wishChips'), wishGoBtn = $('wishGoBtn'), wishCard = $('wishCard');
  // hintBar 已移除，兼容空引用
  const hintBar = $('hintBar');
  if (hintBar) hintBar.style.display = 'none';

  let renderer, scene, camera, pmrem, envTex = null, projPlane;
  let rodMesh, tipL, tipR;
  const bellMesh = [];
  const ropeMesh = [];
  const tubePose = [];
  for (let j = 0; j < N_STRAND; j++) {
    tubePose.push([]);
    ropeMesh.push([]);
    bellMesh.push([]);
    for (let k = 0; k < PER; k++) tubePose[j].push({ x: 0, y: 0, z: 0 });
  }

  // 物理：每串一条 Verlet 软绳（PER+1 个节点，定长约束）
  const rodP = { p: new THREE.Vector2(), v: new THREE.Vector2(), w2: G / 0.8 };
  const ropePts = [];   // [j][i] {x,y,z,px,py,pz}
  const restLen = [];   // 节 i→i+1 静止长度
  for (let k = 0; k < PER; k++) restLen.push((k === 0 ? 0.028 : TUBE_GAP) + tubeLen(k));
  const strandCool = [];
  // 每串独立风感：相位 / 增益 / 滞后 / 回落阻尼 —— 风停后回落略有参差
  const strandWind = [];
  for (let j = 0; j < N_STRAND; j++) {
    strandCool.push(0);
    strandWind.push({
      ph: j * 0.61 + (j % 5) * 0.17,
      gain: 0.72 + (j % 7) * 0.055 + (j & 1) * 0.06,
      lag: 0.7 + (j % 4) * 0.12 + ((j * 3) % 5) * 0.04,
      damp: 0.968 + (j % 6) * 0.0035,
      lx: 0, lz: 0
    });
    const pts = [];
    let y = ROD_Y - 0.012;
    const x0 = rimX(j), z0 = rimZ(j);
    pts.push({ x: x0, y: y, z: z0, px: x0, py: y, pz: z0 });
    for (let k = 0; k < PER; k++) {
      y -= restLen[k];
      pts.push({ x: x0, y: y, z: z0, px: x0, py: y, pz: z0 });
    }
    ropePts.push(pts);
  }

  let windT = 0, gust = 0, gustDir = 0, windAmp = 0, windPh = 0, nextBreezeT = 5;
  const windV = new THREE.Vector2();
  const pointers = new Map();

  const WISHES = [
    '愿今日微风吹散所有心事', '愿你抬头时有光，低头时有梦',
    '把烦恼系在风上，等它自己走远', '愿每一次心动，都有回响',
    '慢慢来，比较快', '风会记得你温柔的样子',
    '愿你所求皆如愿，所行化坦途', '日子清澈，万物可爱',
    '愿天黑有灯，下雨有伞，心中有铃', '此刻安静，已经很好',
    '把自己还给自己，把别人还给别人', '所有的等待，都值得被听见',
    '愿这声响穿过山海，落在在意的人心上', '不要着急，最好的总在最不经意时出现',
    '今日宜：深呼吸，听风铃', '愿你一生被爱，一生可爱'
  ];
  let themeMode = 0;

  const _v = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _dir = new THREE.Vector3();

  function toPx(x, y, z) {
    _v.set(x, y, z).project(camera);
    return [(_v.x * 0.5 + 0.5) * innerWidth, (-_v.y * 0.5 + 0.5) * innerHeight, _v.z];
  }
  function fire(j, k, power, silent, wx, wy) {
    WC.audio.strikeFreq(bellF(j, k), power);
    if (!WC.audio.isMuted()) {
      try { navigator.vibrate && navigator.vibrate(4 + Math.round(power * 9)); } catch (e) {}
    }
    if (!silent && wx != null) WC.fx.hit(wx, wy);
  }

  function envCanvas() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgb(9,11,38)');
    g.addColorStop(0.5, 'rgb(26,30,78)');
    g.addColorStop(1, 'rgb(48,44,96)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return cv;
  }
  function applyEnv() {
    if (envTex) envTex.dispose();
    const tex = new THREE.CanvasTexture(envCanvas());
    tex.mapping = THREE.EquirectangularReflectionMapping;
    envTex = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    scene.environment = envTex;
  }
  function wood(color, metal, rough) {
    return new THREE.MeshStandardMaterial({ color: color, metalness: metal, roughness: rough });
  }
  function tubeGeo(k) {
    const len = tubeLen(k), r = tubeR();
    // 实心圆柱比空心双层更省面数；openEnded 去掉盖子略减三角面
    return new THREE.CylinderGeometry(r * 0.95, r, len, 10, 1, true);
  }

  // 圆柱周向淡高光（浅色，不压暗管色）
  let _tubeMap = null;
  function tubeMap() {
    if (_tubeMap) return _tubeMap;
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 16;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, '#e8e8e8');
    g.addColorStop(0.38, '#f4f4f4');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(0.62, '#f4f4f4');
    g.addColorStop(1, '#e4e4e4');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 16);
    _tubeMap = new THREE.CanvasTexture(cv);
    if (THREE.SRGBColorSpace) _tubeMap.colorSpace = THREE.SRGBColorSpace;
    _tubeMap.needsUpdate = true;
    return _tubeMap;
  }

  function addAll() {
    // 窗帘横杆（长度由 layoutRod 按可见屏宽设定；无上方吊绳）
    const rodLen = ROD_HALF * 2;
    rodMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, rodLen, 12),
      wood(0x8a6b48, 0.3, 0.5)
    );
    rodMesh.rotation.z = Math.PI / 2;
    rodMesh.position.set(0, ROD_Y, 0);
    scene.add(rodMesh);

    tipL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), wood(0xc9ae86, 0.4, 0.45));
    tipR = tipL.clone();
    tipL.position.set(-ROD_HALF - 0.02, ROD_Y, 0);
    tipR.position.set(ROD_HALF + 0.02, ROD_Y, 0);
    scene.add(tipL); scene.add(tipR);

    for (let j = 0; j < N_STRAND; j++) {
      for (let k = 0; k < PER; k++) {
        const rope = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0024, 0.0024, 1, 5),
          wood(0xcbb89a, 0.25, 0.55)
        );
        scene.add(rope);
        ropeMesh[j].push(rope);

        const b = new THREE.Mesh(tubeGeo(k), new THREE.MeshStandardMaterial({
          color: STRAND_COLOR[j % STRAND_COLOR.length],
          map: tubeMap(),
          metalness: 0.08,
          roughness: 0.68,
          envMapIntensity: 0.12
        }));
        scene.add(b);
        bellMesh[j].push(b);
      }
    }
  }

  function viewSize() {
    const vv = window.visualViewport;
    // 小红书等 WebView 可视区常窄于 layout viewport
    return {
      w: Math.max(1, (vv && vv.width) || innerWidth),
      h: Math.max(1, (vv && vv.height) || innerHeight)
    };
  }

  function worldHalfWidth() {
    const vFov = (camera.fov * Math.PI) / 180;
    const { w, h } = viewSize();
    return Math.tan(vFov / 2) * CAM_Z * (w / h);
  }

  function layoutRod() {
    if (!camera || !rodMesh) return;
    // 半宽扣掉左右留白 + 两端圆头，避免小红书预览两侧穿出
    ROD_HALF = Math.max(0.45, worldHalfWidth() * (1 - ROD_PAD * 2) - ROD_TIP);
    const rodLen = ROD_HALF * 2;
    rodMesh.geometry.dispose();
    rodMesh.geometry = new THREE.CylinderGeometry(0.016, 0.016, rodLen, 12);
    tipL.position.x = -ROD_HALF - 0.02;
    tipR.position.x = ROD_HALF + 0.02;
    settleStrands();
  }

  // 按当前杆宽垂直静置，避免 resize/刷新时猛拽
  function settleStrands() {
    for (let j = 0; j < N_STRAND; j++) {
      pinHang(j);
      const pts = ropePts[j];
      const x0 = pts[0].x, z0 = pts[0].z;
      let y = pts[0].y;
      for (let k = 0; k < PER; k++) {
        y -= restLen[k];
        const p = pts[k + 1];
        p.x = x0; p.y = y; p.z = z0;
        p.px = x0; p.py = y; p.pz = z0;
      }
      const sw = strandWind[j];
      sw.lx = 0; sw.lz = 0;
    }
    rodP.p.set(0, 0);
    rodP.v.set(0, 0);
  }

  // 从绳节点摆放管/短绳：圆柱管跟随节方向，长度固定
  function placeStrand(j) {
    const pts = ropePts[j];
    for (let k = 0; k < PER; k++) {
      const a = pts[k], b = pts[k + 1];
      const rope = (k === 0) ? 0.028 : TUBE_GAP;
      const L = tubeLen(k);
      _dir.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const dlen = _dir.length() || 1;
      _dir.multiplyScalar(1 / dlen);

      const tx = a.x + _dir.x * rope;
      const ty = a.y + _dir.y * rope;
      const tz = a.z + _dir.z * rope;
      const cx = a.x + _dir.x * (rope + L * 0.5);
      const cy = a.y + _dir.y * (rope + L * 0.5);
      const cz = a.z + _dir.z * (rope + L * 0.5);

      const rm = ropeMesh[j][k];
      rm.position.set((a.x + tx) * 0.5, (a.y + ty) * 0.5, (a.z + tz) * 0.5);
      rm.scale.y = rope;
      rm.quaternion.setFromUnitVectors(_up, _dir);

      const mesh = bellMesh[j][k];
      mesh.position.set(cx, cy, cz);
      mesh.quaternion.setFromUnitVectors(_up, _dir);

      tubePose[j][k].x = cx;
      tubePose[j][k].y = cy;
      tubePose[j][k].z = cz;
    }
  }

  function gustPush(power, dir) {
    gust = Math.max(gust, power);
    if (dir != null) gustDir = dir;
  }
  function stepWind(dt) {
    windT += dt;
    if (gust > 0) {
      windAmp += (1 - windAmp) * Math.min(1, dt * 0.55);
      gust -= dt * 0.16;
      if (gust < 0) gust = 0;
      windPh += dt * 0.35;
      gustDir += Math.sin(windPh * 0.4) * dt * 0.3;
    } else {
      windAmp += (0 - windAmp) * Math.min(1, dt * 0.35);
      if (windAmp < 0.02) windAmp = 0;
      nextBreezeT -= dt;
      if (nextBreezeT <= 0) {
        gustPush(0.28 + Math.random() * 0.32, Math.random() * Math.PI * 2);
        nextBreezeT = 8 + Math.random() * 12;
      }
    }
    const calm = windAmp < 0.04;
    const peak = calm ? 0 : (0.015 + 0.4 * windAmp);
    const dx = Math.cos(gustDir), dz = Math.sin(gustDir);
    const flutter = calm ? 0 : Math.sin(windT * 0.85 + windPh) * 0.08 * windAmp;
    windV.set(dx * peak + flutter * (-dz), dz * peak + flutter * dx);
  }

  function pinHang(j) {
    const p0 = ropePts[j][0];
    const hx = rodP.p.x + rimX(j);
    const hy = ROD_Y - 0.012;
    const hz = rodP.p.y + rimZ(j);
    p0.x = hx; p0.y = hy; p0.z = hz;
    p0.px = hx; p0.py = hy; p0.pz = hz;
  }

  function satisfyConstraints(j) {
    // 角度软约束弱化：主要靠摆锤投影保长，避免多关节像弹簧折叠
    const pts = ropePts[j];
    for (let k = 0; k < PER; k++) {
      const a = pts[k], b = pts[k + 1];
      let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const rest = restLen[k];
      const corr = (dist - rest) / dist;
      if (k === 0) {
        b.x -= dx * corr;
        b.y -= dy * corr;
        b.z -= dz * corr;
      } else {
        const half = corr * 0.5;
        a.x += dx * half; a.y += dy * half; a.z += dz * half;
        b.x -= dx * half; b.y -= dy * half; b.z -= dz * half;
      }
    }
    pinHang(j);
  }

  // 摆锤式硬投影：每节定长，Y 由水平偏摆决定，杜绝上下弹簧压缩/拉长
  function projectStrandLengths(j) {
    pinHang(j);
    const pts = ropePts[j];
    for (let k = 0; k < PER; k++) {
      const a = pts[k], b = pts[k + 1];
      const rest = restLen[k];
      let dx = b.x - a.x, dz = b.z - a.z;
      let hdist = Math.sqrt(dx * dx + dz * dz);
      const maxH = rest * 0.992;
      if (hdist > maxH) {
        const s = maxH / (hdist || 1e-6);
        dx *= s; dz *= s;
        hdist = maxH;
      }
      const dy = -Math.sqrt(Math.max(1e-12, rest * rest - hdist * hdist));
      const nx = a.x + dx;
      const ny = a.y + dy;
      const nz = a.z + dz;
      const vx = b.x - b.px, vy = b.y - b.py, vz = b.z - b.pz;
      b.x = nx; b.y = ny; b.z = nz;
      b.px = nx - vx; b.py = ny - vy; b.pz = nz - vz;
    }
  }

  // Verlet 软绳：重力 + 每串独立风感 + 定长约束（不定死）
  let physWarm = 0;
  function stepPhys(dt) {
    physWarm = Math.min(1, physWarm + dt * 0.55);
    const windFade = physWarm * physWarm;
    const calm = windAmp < 0.05 && pointers.size === 0;

    // 横杆几乎固定，避免撩动后整排左右晃
    rodP.v.x += (-12 * rodP.p.x - 8 * rodP.v.x + windV.x * 0.03 * windFade) * dt;
    rodP.v.y += (-12 * rodP.p.y - 8 * rodP.v.y + windV.y * 0.03 * windFade) * dt;
    rodP.p.x += rodP.v.x * dt;
    rodP.p.y += rodP.v.y * dt;
    const rr = rodP.p.lengthSq();
    if (rr > 0.006 * 0.006) {
      rodP.p.multiplyScalar(0.006 / Math.sqrt(rr));
      rodP.v.multiplyScalar(0.35);
    }

    const sub = 2;
    const h = Math.min(dt, 0.033) / sub;
    for (let j = 0; j < N_STRAND; j++) {
      if (strandCool[j] > 0) strandCool[j] = Math.max(0, strandCool[j] - dt);
    }
    for (let s = 0; s < sub; s++) {
      for (let j = 0; j < N_STRAND; j++) {
        pinHang(j);
        const pts = ropePts[j];
        const sw = strandWind[j];
        const ripple = 0.88 + 0.12 * Math.sin(windT * 1.15 + sw.ph);
        const targetX = windV.x * sw.gain * ripple * windFade;
        const targetZ = windV.y * sw.gain * ripple * windFade;
        const follow = Math.min(1, (h * 5.5) / sw.lag);
        sw.lx += (targetX - sw.lx) * follow;
        sw.lz += (targetZ - sw.lz) * follow;
        // 回落略增阻尼，单串自然停；去掉整排回中拉力（那会造成整体左右摆）
        const damp = calm ? 0.975 : (windAmp > 0.12 ? 0.986 : 0.988);
        for (let i = 1; i <= PER; i++) {
          const p = pts[i];
          let vx = (p.x - p.px) * damp;
          let vy = (p.y - p.py) * damp * 0.92;
          let vz = (p.z - p.pz) * damp;
          p.px = p.x; p.py = p.y; p.pz = p.z;
          const depth = i / PER;
          const wF = (0.01 + depth * 0.024) * h;
          const wob = windAmp > 0.12
            ? 0.0014 * Math.sin(windT * 1.05 + sw.ph + i * 0.35) * windAmp * windFade
            : 0;
          p.x += vx + (sw.lx * wF + wob * h);
          p.y += vy - G * h * h;
          p.z += vz + sw.lz * wF;
        }
        for (let it = 0; it < 2; it++) satisfyConstraints(j);
        projectStrandLengths(j);
      }
    }
  }

  // 拨动：主要带动本串，邻串只极轻带一点
  function pluckStrand(j, k, dirX, dirZ, strength) {
    const amp = Math.min(0.024, 0.01 + (strength || 0.5) * 0.012);
    const dd = Math.hypot(dirX, dirZ) || 1;
    const ix = (dirX / dd) * amp;
    const iz = (dirZ / dd) * amp;
    const softKick = (pts, i, w) => {
      if (i < 1 || i > PER || w < 0.02) return;
      pts[i].px -= ix * w;
      pts[i].pz -= iz * w;
    };
    const strand = ropePts[j];
    softKick(strand, k + 1, 0.9);
    softKick(strand, k, 0.48);
    for (let d = 1; d <= PER - k; d++) {
      softKick(strand, k + 1 + d, 0.55 * Math.pow(0.72, d));
    }
    for (const off of [-1, 1]) {
      const nj = j + off;
      if (nj < 0 || nj >= N_STRAND) continue;
      softKick(ropePts[nj], Math.min(PER, k + 1), 0.08);
    }
  }

  /** 离开某串再碰到才再拨；停在同一串上不连响 */
  function strikeStrandEnter(j, k, dirX, dirZ, strength, s) {
    if (s.lastJ === j) return false;
    s.lastJ = j;
    pluckStrand(j, k, dirX, dirZ, strength);
    const pose = tubePose[j][Math.min(PER - 1, k)];
    const sc = toPx(pose.x, pose.y, pose.z);
    fire(j, Math.min(PER - 1, k), 0.12 + Math.min(0.1, (strength || 0.5) * 0.08), false, sc[0], sc[1]);
    return true;
  }

  function detectCollisions(dt) {
    // 中下段邻串轻碰：风停回落相位差时叮一声，推力要软
    for (let j = 0; j < N_STRAND - 1; j++) {
      let hitOnce = false;
      const k0 = Math.max(2, Math.floor(PER * 0.4));
      for (let k = k0; k <= PER; k++) {
        const a = ropePts[j][k], b = ropePts[j + 1][k];
        const dx = a.x - b.x, dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        const spacing = Math.abs(rimX(j) - rimX(j + 1));
        const hitR = spacing * 0.52 + tubeR() * 2.2;
        if (d >= hitR || d < 1e-5) continue;
        const rel = Math.hypot((a.x - a.px) - (b.x - b.px), (a.z - a.pz) - (b.z - b.pz));
        const nx = dx / d, nz = dz / d;
        const push = (hitR - d) * 0.32;
        if (k > 0) {
          a.x += nx * push; a.z += nz * push;
          b.x -= nx * push; b.z -= nz * push;
          // 轻微交换切向速度，碰后回落更自然
          const avx = a.x - a.px, avz = a.z - a.pz;
          const bvx = b.x - b.px, bvz = b.z - b.pz;
          const exchange = 0.18;
          a.px = a.x - (avx * (1 - exchange) + bvx * exchange);
          a.pz = a.z - (avz * (1 - exchange) + bvz * exchange);
          b.px = b.x - (bvx * (1 - exchange) + avx * exchange);
          b.pz = b.z - (bvz * (1 - exchange) + avz * exchange);
        }
        if (!hitOnce && rel > 0.0028 && (strandCool[j] < 0.1 || strandCool[j + 1] < 0.1)) {
          const pose = tubePose[j][Math.min(PER - 1, k - 1)];
          const sc = toPx(pose.x, pose.y, pose.z);
          fire(j, Math.min(PER - 1, Math.max(0, k - 1)), 0.07 + Math.min(0.22, rel * 6), false, sc[0], sc[1]);
          strandCool[j] = Math.max(strandCool[j], 0.22);
          strandCool[j + 1] = Math.max(strandCool[j + 1], 0.22);
          hitOnce = true;
        }
      }
    }
  }

  function openWish() {
    const now = new Date();
    const wd = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    wishDate.textContent = (now.getMonth() + 1) + '月' + now.getDate() + '日 · 星期' + wd;
    if (wishInput) wishInput.value = '';
    if (wishChips) {
      wishChips.innerHTML = '';
      const picks = WISHES.slice().sort(() => Math.random() - 0.5).slice(0, 6);
      picks.forEach(q => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'wish-chip';
        b.textContent = q.length > 12 ? q.slice(0, 11) + '…' : q;
        b.title = q;
        b.addEventListener('click', e => {
          e.stopPropagation();
          wishChips.querySelectorAll('.wish-chip').forEach(el => el.classList.remove('on'));
          b.classList.add('on');
          if (wishInput) wishInput.value = q;
        });
        wishChips.appendChild(b);
      });
    }
    wishOv.classList.remove('hidden');
    setTimeout(() => { try { wishInput && wishInput.focus(); } catch (e) {} }, 80);
  }

  function runWish() {
    let text = (wishInput && wishInput.value || '').trim();
    if (!text) {
      const on = wishChips && wishChips.querySelector('.wish-chip.on');
      text = on ? on.title : WISHES[(Math.random() * WISHES.length) | 0];
    }
    wishOv.classList.add('hidden');
    WC.audio.resume();
    if (WC.fx.rainWish) WC.fx.rainWish(text);
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const j = Math.min(N_STRAND - 1, ((i / 7) * (N_STRAND - 1)) | 0);
        const k = PER - 1;
        pluckStrand(j, k, 1, 0);
        const pose = tubePose[j][k];
        const sc = toPx(pose.x, pose.y, pose.z);
        fire(j, k, 0.18, false, sc[0], sc[1]);
      }, i * 140);
    }
    gustPush(0.1, Math.random() * Math.PI * 2);
  }

  const _ray = new THREE.Raycaster();
  function worldAt(clientX, clientY) {
    const nx = (clientX / innerWidth) * 2 - 1, ny = -(clientY / innerHeight) * 2 + 1;
    _ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    return _ray.ray.intersectPlane(projPlane, new THREE.Vector3()) || null;
  }
  function pickBell(wp) {
    // 按绳段最近点拾取（含 Y），否则竖串 XZ 几乎重合会总命中第 0 节
    let best = null, bestD = 1e9;
    for (let j = 0; j < N_STRAND; j++) {
      const pts = ropePts[j];
      for (let k = 0; k < PER; k++) {
        const a = pts[k], b = pts[k + 1];
        const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
        const ab2 = abx * abx + aby * aby + abz * abz || 1e-8;
        let t = ((wp.x - a.x) * abx + (wp.y - a.y) * aby + (wp.z - a.z) * abz) / ab2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const cx = a.x + abx * t, cy = a.y + aby * t, cz = a.z + abz * t;
        const dx = wp.x - cx, dy = wp.y - cy, dz = (wp.z - cz) * 0.45;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const hitR = 0.042 + tubeR() * 4.5;
        if (d < hitR && d < bestD) { bestD = d; best = [j, k]; }
      }
    }
    return best;
  }
  function isUI(el) { return el && el.closest && el.closest('.hud, .overlay, button, .btn'); }
  function started() { return startOv.classList.contains('hidden'); }

  function samplePluckAlong(s, x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 12));
    const strength = Math.min(1.2, 0.45 + dist / 80);
    const dirX = (x1 - x0) * 0.002 || 0.08;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      const wp = worldAt(cx, cy);
      if (!wp) {
        s.lastJ = -1;
        continue;
      }
      const p = pickBell(wp);
      if (!p) {
        s.lastJ = -1;
        continue;
      }
      strikeStrandEnter(p[0], p[1], dirX, 0, strength, s);
    }
  }

  function onDown(e) {
    if (!started() || isUI(e.target)) return;
    const sid = e.pointerId != null ? e.pointerId : 0;
    const wp = worldAt(e.clientX, e.clientY);
    const s = { px: e.clientX, py: e.clientY, lastJ: -1 };
    pointers.set(sid, s);
    WC.audio.resume();
    if (wp) {
      const p = pickBell(wp);
      if (p) strikeStrandEnter(p[0], p[1], 0.08, 0, 0.55, s);
    }
  }

  function onMove(e) {
    if (!started() || isUI(e.target)) return;
    const sid = e.pointerId != null ? e.pointerId : 0;
    const s = pointers.get(sid);
    if (!s) return;
    const x0 = s.px, y0 = s.py;
    const x1 = e.clientX, y1 = e.clientY;
    if (Math.hypot(x1 - x0, y1 - y0) < 2) return;
    s.px = x1; s.py = y1;
    samplePluckAlong(s, x0, y0, x1, y1);
  }

  function onUp(e) {
    const sid = e.pointerId != null ? e.pointerId : 0;
    pointers.delete(sid);
  }

  let clock;
  let CAM_PY = 1.05, CAM_Z = 2.55, CAM_TY = 1.05;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    stepWind(dt);
    stepPhys(dt);

    const rx = rodP.p.x, rz = rodP.p.y;
    rodMesh.position.set(rx, ROD_Y, rz);
    rodMesh.rotation.x = rz * 0.25;
    rodMesh.rotation.y = -rx * 0.15;
    tipL.position.set(-ROD_HALF - 0.02 + rx, ROD_Y, rz);
    tipR.position.set(ROD_HALF + 0.02 + rx, ROD_Y, rz);

    for (let j = 0; j < N_STRAND; j++) placeStrand(j);
    detectCollisions(dt);

    WC.audio.setWind(Math.min(1, windAmp * 0.35));
    camera.lookAt(0, CAM_TY, 0);

    const ap = toPx(0, ROD_Y, 0);
    WC.fx.feedAnchor(ap[0], ap[1]);
    WC.fx.feedWind(windV.x, windV.y, windAmp);

    renderer.render(scene, camera);
    WC.fx.update(dt);
  }

  function applyMuteUI() { muteBtn.classList.toggle('muted', WC.audio.isMuted()); }
  function switchMode() {
    themeMode = (themeMode + 1) % 2;
    WC.fx.setMode(themeMode, lbl => { themeLab.textContent = lbl; });
  }
  function bindUI() {
    let starting = false;
    function doStart(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (starting || startOv.classList.contains('hidden')) return;
      starting = true;
      try { WC.audio.ensure(); WC.audio.resume(); } catch (err) {}
      startOv.classList.add('hidden');
      applyMuteUI();
      // 开场轻拨，力度克制
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          const j = Math.min(N_STRAND - 1, ((i / 5) * (N_STRAND - 1)) | 0);
          pluckStrand(j, Math.min(PER - 1, 2 + (i % 3)), 0.4, 0);
          const pose = tubePose[j][Math.min(PER - 1, 2)];
          const sc = toPx(pose.x, pose.y, pose.z);
          fire(j, Math.min(PER - 1, 2), 0.18, false, sc[0], sc[1]);
        }, i * 160);
      }
      gustPush(0.08, 0.4);
      setTimeout(() => { starting = false; }, 400);
    }
    startBtn.addEventListener('pointerup', doStart);
    startBtn.addEventListener('click', doStart);
    muteBtn.addEventListener('click', () => { WC.audio.toggleMute(); applyMuteUI(); });
    themeBtn.addEventListener('click', switchMode);
    wishBtn.addEventListener('click', openWish);
    if (wishGoBtn) wishGoBtn.addEventListener('click', e => { e.stopPropagation(); runWish(); });
    if (wishCard) wishCard.addEventListener('click', e => e.stopPropagation());
    wishOv.addEventListener('click', () => wishOv.classList.add('hidden'));
    if (wishInput) {
      wishInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runWish(); }
      });
    }
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    window.addEventListener('resize', () => {
      const { w, h } = viewSize();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      layoutRod();
    });
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', () => {
        const { w, h } = viewSize();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        layoutRod();
      });
    }
  }

  function init() {
    // 始终开抗锯齿；DPR 仍封顶 2，避免过热但不再压到发糊锯齿
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power'
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    stageHost.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    const vs0 = viewSize();
    camera = new THREE.PerspectiveCamera(50, vs0.w / vs0.h, 0.1, 80);
    camera.position.set(0, CAM_PY, CAM_Z);
    camera.lookAt(0, CAM_TY, 0);

    scene.add(new THREE.HemisphereLight(0xd8e4ff, 0x3a3858, 1.15));
    const dl = new THREE.DirectionalLight(0xfff6e8, 0.75);
    dl.position.set(1.5, 3, 4);
    scene.add(dl);

    pmrem = new THREE.PMREMGenerator(renderer);
    projPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    addAll();
    layoutRod();
    applyEnv();
    bindUI();

    WC.fx.init();
    WC.fx.setMode(0, lbl => { themeLab.textContent = lbl; });

    clock = new THREE.Clock();
    // 启动时静置，微风稍后自然来，避免刷新猛晃
    gust = 0;
    windAmp = 0;
    nextBreezeT = 2.5 + Math.random() * 2;
    animate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
