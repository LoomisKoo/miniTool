// 祈愿灯 - 孔明灯（程序化生成 + 灯内真火 + 竖排祝福纸条悬挂 + 上升动画 + 镜头前放飞）
(function () {
  const KD = window.KD || (window.KD = {});
  const PALETTE = [0xffb86b, 0xff9a5a, 0xffd27a, 0xff8a4a, 0xffc28a, 0xffe0a0];
  const FW_COLORS = [0xffd27a, 0xff7a5a, 0xff5a8a, 0xffe9a0, 0xffa24a, 0xffb060];
  // 灯海中其他孔明灯挂的祝词（字数不同 → 纸条有长有短）
  const SEA_WISHES = [
    '平安', '喜乐', '安康', '如意', '顺遂', '长安', '无忧', '团圆',
    '岁岁平安', '心想事成', '家人安康', '山河无恙', '灯火可亲', '愿人长久',
    '千里婵娟', '岁岁皆安', '万事胜意', '风调雨顺',
    '愿此生尽兴', '平安喜乐常伴'
  ];
  const HERO_SCALE = 3;
  const STRING_LEN = 1.5;
  const HERO_UNIT = 0.46;   // hero 每字世界尺寸
  const NORMAL_UNIT = 0.3;  // 普通灯每字世界尺寸

  let scene, list = [], glowTex, heroRef = null;

  function init(sceneRef) { scene = sceneRef; glowTex = KD.util.glowTex(); }

  function makeBody(color) {
    const pts = [
      new THREE.Vector2(0.35, 0.0),
      new THREE.Vector2(0.72, 0.32),
      new THREE.Vector2(0.96, 0.92),
      new THREE.Vector2(1.0, 1.45),
      new THREE.Vector2(0.9, 1.95),
      new THREE.Vector2(0.55, 2.25),
      new THREE.Vector2(0.0, 2.4)
    ];
    const geo = new THREE.LatheGeometry(pts, 28);
    const tex = KD.util.lanternTex(color);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, emissive: color, emissiveMap: tex, emissiveIntensity: 0.8,
      roughness: 0.85, metalness: 0.0, transparent: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    const body = new THREE.Group(); body.add(mesh);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.05, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0x3a1e10 })
    );
    rim.rotation.x = Math.PI / 2; rim.position.y = 2.4; body.add(rim);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5, roughness: 0.7 })
    );
    cap.position.y = 2.4; body.add(cap);
    return body;
  }

  // 灯内真实的火：外焰/中焰/焰心三层叠加
  function makeFire(glowTex) {
    const grp = new THREE.Group();
    const outer = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff7a2a, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85
    }));
    outer.scale.set(0.85, 1.25, 1); grp.add(outer);
    const mid = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffb84a, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9
    }));
    mid.scale.set(0.5, 0.8, 1); mid.position.y = -0.12; grp.add(mid);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xfff2c0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95
    }));
    core.scale.set(0.26, 0.42, 1); core.position.y = -0.2; grp.add(core);
    return grp;
  }

  // 绳子 + 竖排祝福语纸条（无背景框，只有字）
  function makeHang(text, isHero, opts) {
    opts = opts || {};
    const r = KD.util.wishTextTex(text, { fontSize: 46, maxRows: 8 });
    const unit = opts.unit != null ? opts.unit : (isHero ? HERO_UNIT : NORMAL_UNIT);
    const ph = r.rows * unit * 1.14 + 0.10;
    const pw = r.cols * unit + 0.10;
    const sLen = opts.stringLen != null ? opts.stringLen : STRING_LEN;

    const hang = new THREE.Group();
    hang.position.set(0, 0.2, 0);
    const sg = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -sLen, 0)
    ]);
    const stringLine = new THREE.Line(sg, new THREE.LineBasicMaterial({
      color: 0x9a7a52, transparent: true, opacity: 0.85
    }));
    hang.add(stringLine);

    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, ph),
      new THREE.MeshBasicMaterial({
        map: r.texture, side: THREE.DoubleSide,
        transparent: true, opacity: 1, depthWrite: false
      })
    );
    paper.position.set(0, -sLen - ph / 2, 0);
    hang.add(paper);

    if (isHero) { paper.material.opacity = 0; stringLine.material.opacity = 0; }
    return { hang, paper, stringLine, unit: unit, paperH: ph, paperW: pw };
  }

  // opts: {text,color,x,y,z,vy,hero,stringLen,unit}
  function spawn(opts) {
    opts = opts || {};
    const color = opts.color != null ? opts.color : PALETTE[(Math.random() * PALETTE.length) | 0];
    const g = new THREE.Group();
    g.add(makeBody(color));

    const glowMat = new THREE.SpriteMaterial({
      map: glowTex, color: color, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(2.4, 2.4, 1); glow.position.y = 1.1; g.add(glow);

    const flame = makeFire(glowTex);
    flame.position.y = 0.55; g.add(flame);

    let hang = null, paper = null, stringLine = null, unit = NORMAL_UNIT;
    if (opts.text) {
      const h = makeHang(opts.text, !!opts.hero, opts);
      hang = h.hang; paper = h.paper; stringLine = h.stringLine; unit = h.unit;
      g.add(hang);
    }

    const x = opts.x != null ? opts.x : (Math.random() * 2 - 1) * 42;
    const z = opts.z != null ? opts.z : (-50 - Math.random() * 45);
    const y = opts.y != null ? opts.y : (Math.random() * 58);
    g.position.set(x, y, z);

    const isHero = !!opts.hero;
    if (isHero) g.scale.set(HERO_SCALE, HERO_SCALE, HERO_SCALE);

    g.userData = {
      vy: opts.vy != null ? opts.vy : (1.1 + Math.random() * 1.3),
      vz: opts.vz != null ? opts.vz : (isHero ? -2.4 : 0),
      sway: 0.5 + Math.random() * 1.4,
      phase: Math.random() * 6.28,
      freq: 0.35 + Math.random() * 0.45,
      drift: (Math.random() * 2 - 1) * 0.3,
      baseX: x, color: color, flame: flame,
      hang: hang, paper: paper, string: stringLine, unit: unit,
      isUser: isHero, isHero: isHero
    };
    scene.add(g); list.push(g);
    if (isHero) heroRef = g;
    return g;
  }

  function convertToSea(g, u) {
    u.isHero = false;
    g.scale.set(1, 1, 1);
    if (u.paper) {
      u.paper.scale.setScalar(NORMAL_UNIT / u.unit);
      u.paper.material.opacity = 1;
    }
    if (u.string) u.string.material.opacity = 0.85;
    const x = KD.util.rand(-42, 42), z = -50 - KD.util.rand(0, 45);
    g.position.set(x, 42, z);
    u.vy = 1.0 + KD.util.rand(0, 1.2); u.baseX = x; u.drift = KD.util.rand(-0.3, 0.3);
    u.isUser = true;
    heroRef = null;
    KD.fireworks.burst(x, g.position.y + 8, z, 0xffd27a);
  }

  function update(dt, t) {
    for (const g of list) {
      const u = g.userData;
      // 火焰跳动
      const fl = 1 + Math.sin(t * 9 + u.phase) * 0.13 + Math.sin(t * 23.3 + u.phase * 2) * 0.06;
      u.flame.scale.set(fl, fl * (0.9 + 0.28 * Math.sin(t * 7 + u.phase)), 1);
      const ch = u.flame.children;
      if (ch[0]) ch[0].material.opacity = 0.7 + 0.22 * Math.sin(t * 13 + u.phase);
      if (ch[2]) ch[2].material.opacity = 0.8 + 0.2 * Math.sin(t * 19 + u.phase * 3);
      // 纸条随风轻摆
      if (u.hang) {
        u.hang.rotation.z = Math.sin(t * 1.2 + u.phase) * 0.18;
        u.hang.rotation.x = Math.sin(t * 0.9 + u.phase * 1.7) * 0.12;
      }

      if (u.isHero) {
        // 斜着飘向前上方：上升 + 向前远离镜头
        g.position.y += u.vy * dt;
        g.position.z += u.vz * dt;
        g.position.x = u.baseX + Math.sin(t * u.freq + u.phase) * 0.5;
        g.rotation.y += dt * 0.12;
        g.rotation.x = -0.14;
        g.rotation.z = Math.sin(t * 0.8 + u.phase) * 0.05;
        if (u.paper) {
          const op = Math.min(1, Math.max(0, (g.position.y - 8) / 12));
          u.paper.material.opacity = op;
          u.string.material.opacity = op * 0.85;
        }
        if (g.position.y > 58) convertToSea(g, u);
        continue;
      }
      g.position.y += u.vy * dt;
      g.position.x = u.baseX + Math.sin(t * u.freq + u.phase) * u.sway + u.drift * t;
      g.rotation.y += dt * 0.18;
      g.rotation.z = Math.sin(t * u.freq * 0.7 + u.phase) * 0.06;
      const ceil = u.isUser ? 82 : 64;
      if (g.position.y > ceil) {
        if (u.isUser) { u.vy *= 0.6; u.drift *= 0.6; if (g.position.y > 130) { g.position.y = -8; u.vy = 1.0; u.drift = KD.util.rand(-0.3, 0.3); u.baseX = KD.util.rand(-30, 30); } }
        else { g.position.y = -8; u.baseX = KD.util.rand(-42, 42); g.position.z = -50 - Math.random() * 45; }
      }
    }
  }

  KD.lanterns = {
    init, spawn, update, list: () => list,
    heroLantern: () => heroRef, PALETTE, FW_COLORS, SEA_WISHES
  };
})();
