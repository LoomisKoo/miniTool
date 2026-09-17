'use strict';
/**
 * 彩码 · 花束模式
 * - 花：程序化 3D 花瓣几何（无 GLB / 无整朵贴图贴纸）
 * - 花束：可拖转 + 轻摆动
 * - 二维码：实心方格为主（可扫），过渡时花缩小淡出
 */
(function (global) {
  if (!global.THREE) {
    global.ColorQRBloom = null;
    return;
  }

  var THREE = global.THREE;
  var MAX_MODULES = 900;
  var MAX_FLOWERS = 22;
  var MAX_LEAVES = 18;

  var PALETTES = {
    original: { petal: [0xc45c6a, 0xd47886, 0xb04858], module: 0x8a3040, leaf: 0x4f7a45, finder: 0x152a66, bg: 0xf7f5f2 },
    blush: { petal: [0xe8a0b0, 0xf0bcc8, 0xd8889a], module: 0xb05068, leaf: 0x6a8f5c, finder: 0x2a4578, bg: 0xfaf6f7 },
    marigold: { petal: [0xe08a3c, 0xefaa55, 0xc86e28], module: 0xa05018, leaf: 0x5c7e3e, finder: 0x243e70, bg: 0xfaf6f0 },
    sunbeam: { petal: [0xe6c35c, 0xf0d878, 0xd4a83c], module: 0x8a7018, leaf: 0x6b8f3f, finder: 0x2a4578, bg: 0xfaf8f0 },
    poppy: { petal: [0xd63b3b, 0xe85a5a, 0xb82828], module: 0x8a1414, leaf: 0x3f6b38, finder: 0x152a58, bg: 0xf8f4f2 },
    azure: { petal: [0x5b8fd9, 0x7aa8e6, 0x3f74c4], module: 0x2a5aa0, leaf: 0x4a7a58, finder: 0x152a66, bg: 0xf4f7fb },
    dusk: { petal: [0x7a5ea8, 0x9578c0, 0x5e4588], module: 0x3e2a68, leaf: 0x4a6b50, finder: 0x1e2e58, bg: 0xf6f4f8 }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function hexColor(n) { return new THREE.Color(n); }

  /** 弯曲花瓣：根部宽、尖端收，略外拱 */
  function makePetalGeo(len, width, curl) {
    var geo = new THREE.PlaneGeometry(width, len, 5, 8);
    var pos = geo.attributes.position;
    var i, x, y, t, taper;
    for (i = 0; i < pos.count; i++) {
      x = pos.getX(i);
      y = pos.getY(i);
      t = (y + len * 0.5) / len;
      taper = 1 - t * 0.55;
      pos.setX(i, x * taper);
      pos.setZ(i, Math.sin(t * Math.PI * 0.9) * curl + (x * x) * 0.35);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /** 狭长叶片 */
  function makeLeafGeo(len, width) {
    var geo = new THREE.PlaneGeometry(width, len, 3, 6);
    var pos = geo.attributes.position;
    var i, x, y, t;
    for (i = 0; i < pos.count; i++) {
      x = pos.getX(i);
      y = pos.getY(i);
      t = (y + len * 0.5) / len;
      pos.setX(i, x * (1 - t * 0.7) * (0.55 + 0.45 * Math.sin(t * Math.PI)));
      pos.setZ(i, Math.sin(t * Math.PI) * 0.08);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function makeWrapTexture() {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    var ctx = cv.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#f3ebe0');
    g.addColorStop(0.45, '#e8dcc8');
    g.addColorStop(1, '#d9c8ae');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(160,130,90,0.12)';
    ctx.lineWidth = 1;
    var i;
    for (i = 0; i < 28; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 8 + i * 9);
      ctx.lineTo(256, 4 + i * 9);
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function fibSphere(i, n, r) {
    var golden = Math.PI * (3 - Math.sqrt(5));
    var y = 1 - (i / Math.max(1, n - 1)) * 2;
    var rad = Math.sqrt(Math.max(0, 1 - y * y));
    var theta = golden * i;
    return new THREE.Vector3(Math.cos(theta) * rad * r, y * r * 0.68, Math.sin(theta) * rad * r);
  }

  /**
   * 按花种组装一朵 3D 花（共享 geometry / material）
   * 局部 +Y 为花轴朝上
   */
  function buildFlowerMesh(kind, geos, mats, seed) {
    var g = new THREE.Group();
    var layers, n, li, i, petal, ang, open, elev, rad, scale, matIdx;
    var rnd = function (k) {
      var x = Math.sin((seed + k) * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };

    if (kind === 'lily') {
      for (i = 0; i < 6; i++) {
        petal = new THREE.Mesh(geos.petalLong, mats.petal[i % mats.petal.length]);
        ang = (i / 6) * Math.PI * 2;
        open = 0.95;
        petal.position.set(Math.cos(ang) * 0.04, 0.02, Math.sin(ang) * 0.04);
        petal.rotation.set(open, ang, 0.12);
        petal.scale.set(0.85, 1.15, 0.85);
        g.add(petal);
      }
      g.add(new THREE.Mesh(geos.core, mats.core));
      g.children[g.children.length - 1].position.y = 0.08;
      g.children[g.children.length - 1].scale.setScalar(0.55);
    } else if (kind === 'tulip') {
      for (i = 0; i < 6; i++) {
        petal = new THREE.Mesh(geos.petalCup, mats.petal[i % mats.petal.length]);
        ang = (i / 6) * Math.PI * 2;
        petal.position.set(Math.cos(ang) * 0.03, 0.05, Math.sin(ang) * 0.03);
        petal.rotation.set(0.35, ang, 0);
        petal.scale.set(0.9, 1.05, 0.9);
        g.add(petal);
      }
      var cupCore = new THREE.Mesh(geos.core, mats.core);
      cupCore.position.y = 0.12;
      cupCore.scale.setScalar(0.4);
      g.add(cupCore);
    } else if (kind === 'rose') {
      for (layers = 0; layers < 4; layers++) {
        n = 7;
        open = 0.55 + layers * 0.28;
        rad = 0.02 + layers * 0.035;
        scale = 0.55 + layers * 0.16;
        for (i = 0; i < n; i++) {
          matIdx = (layers + i) % mats.petal.length;
          petal = new THREE.Mesh(geos.petalRose, mats.petal[matIdx]);
          ang = (i / n) * Math.PI * 2 + layers * 0.22 + rnd(layers * 10 + i) * 0.08;
          elev = 0.55 - layers * 0.08;
          petal.position.set(Math.cos(ang) * rad, layers * 0.018, Math.sin(ang) * rad);
          petal.rotation.set(open * elev + 0.15, ang, (rnd(i + 3) - 0.5) * 0.2);
          petal.scale.set(scale * 0.92, scale, scale * 0.92);
          g.add(petal);
        }
      }
      var roseCore = new THREE.Mesh(geos.core, mats.core);
      roseCore.position.y = 0.06;
      roseCore.scale.setScalar(0.45);
      g.add(roseCore);
    } else {
      // peony
      for (layers = 0; layers < 3; layers++) {
        n = 9;
        open = 0.85 + layers * 0.22;
        rad = 0.04 + layers * 0.05;
        scale = 0.7 + layers * 0.18;
        for (i = 0; i < n; i++) {
          matIdx = (layers + i) % mats.petal.length;
          petal = new THREE.Mesh(geos.petalPeony, mats.petal[matIdx]);
          ang = (i / n) * Math.PI * 2 + layers * 0.15;
          petal.position.set(Math.cos(ang) * rad, layers * 0.02, Math.sin(ang) * rad);
          petal.rotation.set(open * 0.7, ang, (rnd(i) - 0.5) * 0.25);
          petal.scale.set(scale, scale * 0.95, scale);
          g.add(petal);
        }
      }
      var peonyCore = new THREE.Mesh(geos.core, mats.core);
      peonyCore.position.y = 0.05;
      peonyCore.scale.setScalar(0.7);
      g.add(peonyCore);
    }

    // 短茎
    var stem = new THREE.Mesh(geos.stem, mats.stem);
    stem.position.y = -0.22;
    g.add(stem);
    return g;
  }

  function BloomEngine() {
    this.host = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.stageRoot = null;
    this.raf = 0;
    this.running = false;
    this.flowerType = 'peony';
    this.paletteId = 'original';
    this.mode = 'bouquet';
    this.anim = { active: false, t0: 0, dur: 520, from: 0, to: 1 };
    this.progress = 0;
    this.qr = null;
    this.n = 0;
    this.modules = [];
    this.moduleMesh = null;
    this.flowerRoot = null;
    this.flowers = [];
    this.leafRoot = null;
    this.leaves = [];
    this.qrBoard = null;
    this.vase = null;
    this.shadow = null;
    this.geos = null;
    this.mats = null;
    this.dummy = new THREE.Object3D();
    this._lookTarget = new THREE.Vector3();
    this.orbitY = 0;
    this.drag = { down: false, moved: false, x: 0, y: 0, pid: null };
    this._time = 0;
    this._visHandler = null;
    this._onLost = null;
    this._onRestored = null;
    this._hintEl = null;
    this._qrKey = '';
    this.cell = 0.12;
    this.span = 3.2;
  }

  BloomEngine.prototype.mount = function (host, hintEl) {
    if (this.renderer) this.destroy();
    this.host = host;
    this._hintEl = hintEl || null;

    var w = host.clientWidth || 280;
    var h = host.clientHeight || 280;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'
      });
    } catch (e) { return false; }
    if (!renderer.getContext()) return false;

    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace || 'srgb';
    else renderer.outputEncoding = THREE.sRGBEncoding || 3001;
    host.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.stageRoot = new THREE.Group();
    this.scene.add(this.stageRoot);
    this.camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    this.camera.position.set(0, 1.4, 10.4);
    this.camera.lookAt(0, -0.05, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    var key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(3, 7, 4);
    this.scene.add(key);
    var fill = new THREE.DirectionalLight(0xfff0e8, 0.28);
    fill.position.set(-3, 2, -2);
    this.scene.add(fill);

    this._initSharedAssets();
    this._buildVase();
    this._buildShadow();
    this._buildQrBoard();
    this._buildModuleMesh();
    this.flowerRoot = new THREE.Group();
    this.leafRoot = new THREE.Group();
    this.stageRoot.add(this.flowerRoot);
    this.stageRoot.add(this.leafRoot);
    this.setPalette(this.paletteId);
    this.setFlower(this.flowerType);
    this._bindPointer(renderer.domElement);

    var self = this;
    this._visHandler = function () {
      if (document.hidden) self.stop();
      else if (self.qr) self.start();
    };
    document.addEventListener('visibilitychange', this._visHandler);
    this._onLost = function (e) { e.preventDefault(); self.stop(); };
    this._onRestored = function () { if (self.qr) self.start(); };
    renderer.domElement.addEventListener('webglcontextlost', this._onLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', this._onRestored, false);

    this.start();
    this._updateHint();
    return true;
  };

  BloomEngine.prototype._initSharedAssets = function () {
    this.geos = {
      petalRose: makePetalGeo(0.55, 0.32, 0.12),
      petalPeony: makePetalGeo(0.58, 0.4, 0.1),
      petalLong: makePetalGeo(0.72, 0.26, 0.08),
      petalCup: makePetalGeo(0.62, 0.34, 0.06),
      leaf: makeLeafGeo(0.7, 0.28),
      core: new THREE.SphereGeometry(0.08, 10, 8),
      stem: new THREE.CylinderGeometry(0.018, 0.028, 0.4, 6)
    };
    this.mats = {
      petal: [
        new THREE.MeshStandardMaterial({ color: 0xc45c6a, roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide }),
        new THREE.MeshStandardMaterial({ color: 0xd47886, roughness: 0.58, metalness: 0.02, side: THREE.DoubleSide }),
        new THREE.MeshStandardMaterial({ color: 0xb04858, roughness: 0.52, metalness: 0.02, side: THREE.DoubleSide })
      ],
      core: new THREE.MeshStandardMaterial({ color: 0xf0d878, roughness: 0.45, metalness: 0.05 }),
      stem: new THREE.MeshStandardMaterial({ color: 0x4a6b38, roughness: 0.85, metalness: 0 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x4f7a45, roughness: 0.75, metalness: 0, side: THREE.DoubleSide })
    };
  };

  BloomEngine.prototype._bindPointer = function (el) {
    var self = this;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      self.drag.down = true;
      self.drag.moved = false;
      self.drag.x = e.clientX;
      self.drag.y = e.clientY;
      self.drag.pid = e.pointerId;
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    });
    el.addEventListener('pointermove', function (e) {
      if (!self.drag.down) return;
      var dx = e.clientX - self.drag.x;
      var dy = e.clientY - self.drag.y;
      if (!self.drag.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) self.drag.moved = true;
      if (self.drag.moved && self.mode === 'bouquet' && self.progress < 0.25) {
        self.orbitY += dx * 0.012;
        if (self.stageRoot) self.stageRoot.rotation.y = self.orbitY;
        self.drag.x = e.clientX;
        self.drag.y = e.clientY;
      }
    });
    el.addEventListener('pointerup', function () {
      if (!self.drag.down) return;
      var wasDrag = self.drag.moved;
      self.drag.down = false;
      self.drag.moved = false;
      if (el.releasePointerCapture && self.drag.pid != null) {
        try { el.releasePointerCapture(self.drag.pid); } catch (err) { /* ignore */ }
      }
      self.drag.pid = null;
      if (!wasDrag) self.toggle();
    });
    el.addEventListener('pointercancel', function () {
      self.drag.down = false;
      self.drag.moved = false;
      self.drag.pid = null;
    });
  };

  BloomEngine.prototype._buildVase = function () {
    var wrapTex = makeWrapTexture();
    var wrapMat = new THREE.MeshStandardMaterial({
      map: wrapTex, roughness: 0.92, metalness: 0, side: THREE.DoubleSide
    });
    var wrap = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 0.28, 1.55, 28, 1, true),
      wrapMat
    );
    wrap.position.y = -0.95;

    var liner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.98, 0.26, 1.5, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xfaf6f0, roughness: 0.95, metalness: 0, side: THREE.BackSide })
    );
    liner.position.y = -0.95;

    var ribbon = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.045, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0xc45c6a, roughness: 0.55, metalness: 0.05 })
    );
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.y = -1.35;
    ribbon.scale.set(1, 1, 0.55);

    var stems = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 0.55, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a7a3e, roughness: 0.85, metalness: 0 })
    );
    stems.position.y = -1.72;

    var g = new THREE.Group();
    g.add(liner, wrap, ribbon, stems);
    this.vase = g;
    this.stageRoot.add(g);
  };

  BloomEngine.prototype._buildShadow = function () {
    var m = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = -1.74;
    this.shadow = m;
    this.stageRoot.add(m);
  };

  BloomEngine.prototype._buildQrBoard = function () {
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xf7f5f2, transparent: true, opacity: 0, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.01;
    m.visible = false;
    this.qrBoard = m;
    this.scene.add(m);
  };

  BloomEngine.prototype._buildModuleMesh = function () {
    var box = new THREE.BoxGeometry(1, 0.07, 1);
    var boxMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.02 });
    this.moduleMesh = new THREE.InstancedMesh(box, boxMat, MAX_MODULES);
    this.moduleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.moduleMesh.count = 0;
    this.stageRoot.add(this.moduleMesh);
  };

  BloomEngine.prototype._clearGroup = function (root, list) {
    if (!root) return;
    while (root.children.length) root.remove(root.children[0]);
    if (list) list.length = 0;
  };

  BloomEngine.prototype._rebuildFlowers = function () {
    this._clearGroup(this.flowerRoot, this.flowers);
    this._clearGroup(this.leafRoot, this.leaves);
    if (!this.geos || !this.mats) return;

    var n = this.flowerBouqCount || 0;
    var i, flower, leaf, seed;
    for (i = 0; i < n; i++) {
      seed = (i * 2654435761) >>> 0;
      flower = buildFlowerMesh(this.flowerType, this.geos, this.mats, seed);
      flower.visible = false;
      this.flowerRoot.add(flower);
      this.flowers.push(flower);
    }

    var leafN = this.leafCount || 0;
    for (i = 0; i < leafN; i++) {
      leaf = new THREE.Mesh(this.geos.leaf, this.mats.leaf);
      leaf.visible = false;
      this.leafRoot.add(leaf);
      this.leaves.push(leaf);
    }
  };

  BloomEngine.prototype.setFlower = function (type) {
    if (type === 'lotus') type = 'tulip';
    this.flowerType = type || 'peony';
    if (this.qr) {
      this._layoutBouquet();
      this._layoutQR();
    } else {
      this.flowerBouqCount = 14;
      this.leafCount = 8;
    }
    this._rebuildFlowers();
    this._paintColors();
    this._applyPose(this.progress, this._time);
  };

  BloomEngine.prototype.setPalette = function (id) {
    this.paletteId = PALETTES[id] ? id : 'original';
    this._paintColors();
    this._applyPose(this.progress, this._time);
  };

  BloomEngine.prototype._paintColors = function () {
    var pal = PALETTES[this.paletteId];
    var i, c;
    if (this.mats) {
      for (i = 0; i < this.mats.petal.length; i++) {
        this.mats.petal[i].color.setHex(pal.petal[i % pal.petal.length]);
      }
      this.mats.leaf.color.setHex(pal.leaf);
      this.mats.core.color.setHex(0xf0e0a0);
      if (this.vase) {
        this.vase.traverse(function (obj) {
          if (obj.isMesh && obj.geometry && obj.geometry.type === 'TorusGeometry' && obj.material && obj.material.color) {
            obj.material.color.setHex(pal.petal[0]);
          }
        });
      }
    }
    if (this.qrBoard) this.qrBoard.material.color.setHex(pal.bg);
    if (this.moduleMesh && this.moduleMesh.setColorAt) {
      for (i = 0; i < MAX_MODULES; i++) {
        var mod = this.modules[i];
        c = hexColor(mod && mod.finder ? pal.finder : pal.module);
        this.moduleMesh.setColorAt(i, c);
      }
      if (this.moduleMesh.instanceColor) this.moduleMesh.instanceColor.needsUpdate = true;
    }
  };

  BloomEngine.prototype.setQR = function (qr) {
    this.qr = qr || null;
    if (!qr) {
      this._qrKey = '';
      if (this.moduleMesh) this.moduleMesh.count = 0;
      this._clearGroup(this.flowerRoot, this.flowers);
      this._clearGroup(this.leafRoot, this.leaves);
      if (this.qrBoard) this.qrBoard.visible = false;
      this._updateHint();
      return;
    }
    this.n = qr.getModuleCount();
    var key = this.n + ':' + this._hashQR(qr);
    if (key === this._qrKey && this.modules.length) {
      this._updateHint();
      this.start();
      return;
    }
    this._qrKey = key;
    this._collectModules();
    this._layoutBouquet();
    this._layoutQR();
    this._rebuildFlowers();
    this._paintColors();
    this._applyPose(this.progress, this._time);
    this._updateHint();
    this.start();
  };

  BloomEngine.prototype._hashQR = function (qr) {
    var n = qr.getModuleCount();
    var h = 0, r, c, step = Math.max(1, Math.floor(n / 16));
    for (r = 0; r < n; r += step) {
      for (c = 0; c < n; c += step) {
        if (qr.isDark(r, c)) h = (h * 33 + r * n + c) | 0;
      }
    }
    return String(h);
  };

  BloomEngine.prototype._isFinder = function (r, c) {
    var n = this.n;
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= n - 7) return true;
    if (r >= n - 7 && c < 7) return true;
    return false;
  };

  BloomEngine.prototype._collectModules = function () {
    var qr = this.qr, n = this.n, list = [], r, c;
    for (r = 0; r < n; r++) {
      for (c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        list.push({ r: r, c: c, finder: this._isFinder(r, c) });
      }
    }
    this.modules = list;
  };

  BloomEngine.prototype._layoutBouquet = function () {
    var modN = Math.min(MAX_MODULES, this.modules.length);
    var flowerN = Math.min(MAX_FLOWERS, Math.max(12, Math.floor(modN * 0.04)));
    this.modCount = modN;
    this.flowerBouqCount = flowerN;
    this.bouqMod = [];
    this.bouqFlower = [];
    this.bouqFlowerScale = [];
    this.bouqFlowerRot = [];
    this.flowerPhase = [];

    var i, p, seed, dir;
    for (i = 0; i < modN; i++) {
      p = fibSphere(i, modN, 0.25);
      p.y += 0.5;
      this.bouqMod.push(p);
    }
    for (i = 0; i < flowerN; i++) {
      p = fibSphere(i, flowerN, 1.15);
      p.y += 0.72;
      this.bouqFlower.push(p);
      this.bouqFlowerScale.push(0.85 + (i % 5) * 0.07);
      seed = (i * 2654435761) >>> 0;
      // 花轴朝外上：根据位置算俯仰偏航
      dir = p.clone().normalize();
      this.bouqFlowerRot.push(new THREE.Euler(
        Math.atan2(dir.z, Math.sqrt(dir.x * dir.x + dir.y * dir.y)) * 0.35 + 0.55,
        Math.atan2(dir.x, dir.z),
        ((seed % 40) / 100 - 0.2) * 0.35
      ));
      this.flowerPhase.push((seed % 1000) / 1000 * Math.PI * 2);
    }

    this.leafCount = Math.min(MAX_LEAVES, Math.floor(flowerN * 0.55));
    this.leafBouq = [];
    this.leafQR = [];
    this.leafPhase = [];
    var isTall = this.flowerType === 'lily' || this.flowerType === 'tulip';
    for (i = 0; i < this.leafCount; i++) {
      seed = (i * 1597334677) >>> 0;
      if (isTall) {
        p = fibSphere(i + 5, this.leafCount, 0.65);
        p.y = 0.1 + (i % 5) * 0.1;
        this.leafBouq.push({
          p: p,
          s: 0.7 + (i % 4) * 0.08,
          rot: new THREE.Euler(0.4, ((seed % 360) * Math.PI) / 180, 0.1)
        });
      } else {
        p = fibSphere(i + 5, this.leafCount, 0.9);
        p.y += 0.2;
        this.leafBouq.push({
          p: p,
          s: 0.55 + (i % 4) * 0.06,
          rot: new THREE.Euler(0.85, ((seed % 360) * Math.PI) / 180, 0.2)
        });
      }
      this.leafQR.push({ p: new THREE.Vector3(0, -3, 0), s: 0.001, rot: new THREE.Euler(0, 0, 0) });
      this.leafPhase.push((seed % 800) / 800 * Math.PI * 2);
    }
  };

  BloomEngine.prototype._layoutQR = function () {
    var n = this.n;
    var margin = 4;
    var total = n + margin * 2;
    this.span = 4.2;
    this.cell = this.span / total;
    var origin = -this.span / 2 + this.cell * (margin + 0.5);
    var y = 0.08;

    this.qrMod = [];
    this.qrFlower = [];
    this.qrFlowerScale = [];
    this.qrFlowerRot = [];

    var i, m, x, z;
    for (i = 0; i < this.modCount; i++) {
      m = this.modules[i];
      x = origin + m.c * this.cell;
      z = origin + m.r * this.cell;
      this.qrMod.push(new THREE.Vector3(x, y, z));
    }

    // QR 态花缩小藏起（主结构是方格，避免贴图装饰感）
    var hide = new THREE.Vector3(0, -2.5, 0);
    for (i = 0; i < this.flowerBouqCount; i++) {
      this.qrFlower.push(hide.clone());
      this.qrFlowerScale.push(0.001);
      this.qrFlowerRot.push(new THREE.Euler(0, 0, 0));
    }

    if (this.qrBoard) {
      this.qrBoard.scale.set(this.span * 1.02, this.span * 1.02, 1);
      this.qrBoard.position.set(0, 0.01, 0);
    }
  };

  BloomEngine.prototype._orientFlower = function (obj, pos, baseRot, sway) {
    // 花轴 +Y 指向外上（bouquet 中心偏上）
    this._lookTarget.set(pos.x * 0.15, pos.y + 1.2, pos.z * 0.15);
    obj.position.copy(pos);
    obj.up.set(0, 1, 0);
    obj.lookAt(this._lookTarget);
    // lookAt 让 +Z 朝目标，补旋转使 +Y 朝目标
    obj.rotateX(-Math.PI / 2);
    obj.rotateY(baseRot.z + sway);
  };

  BloomEngine.prototype._applyPose = function (t, time) {
    if (!this.moduleMesh || !this.bouqMod) return;
    var e = easeInOut(clamp(t, 0, 1));
    var i, bp, qp, s, ph;
    var cell = this.cell || 0.12;
    var sq = cell * 0.9;
    time = time || 0;

    this.moduleMesh.count = this.modCount || 0;
    for (i = 0; i < this.modCount; i++) {
      bp = this.bouqMod[i];
      qp = this.qrMod[i] || bp;
      this.dummy.position.set(
        lerp(bp.x, qp.x, e),
        lerp(bp.y, qp.y, e) + Math.sin(e * Math.PI) * 0.3,
        lerp(bp.z, qp.z, e)
      );
      s = lerp(0.01, sq, e);
      this.dummy.scale.set(s, lerp(0.01, 1, e), s);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.moduleMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.moduleMesh.instanceMatrix.needsUpdate = true;

    var fCount = Math.min(this.flowers.length, this.flowerBouqCount || 0);
    var hide = new THREE.Vector3(0, -2.8, 0);
    for (i = 0; i < fCount; i++) {
      bp = this.bouqFlower[i];
      qp = this.qrFlower[i] || hide;
      var bs = this.bouqFlowerScale[i];
      var qs = this.qrFlowerScale[i] != null ? this.qrFlowerScale[i] : 0.001;
      var rot = this.bouqFlowerRot[i];
      ph = this.flowerPhase[i] || 0;
      var sway = (1 - e) * Math.sin(time * 1.6 + ph) * 0.1;
      var bob = (1 - e) * Math.sin(time * 2.1 + ph) * 0.03;
      var flower = this.flowers[i];
      flower.visible = e < 0.92;
      flower.position.set(
        lerp(bp.x, qp.x, e),
        lerp(bp.y, qp.y, e) + Math.sin(e * Math.PI) * 0.35 + bob,
        lerp(bp.z, qp.z, e)
      );
      s = lerp(bs, qs, e);
      flower.scale.setScalar(s);
      if (e < 0.6) {
        this._orientFlower(flower, flower.position, rot, sway);
        flower.scale.setScalar(s);
      } else {
        flower.rotation.set(rot.x, rot.y, rot.z);
      }
    }
    for (i = fCount; i < this.flowers.length; i++) this.flowers[i].visible = false;

    var lCount = Math.min(this.leaves.length, this.leafCount || 0);
    for (i = 0; i < lCount; i++) {
      var lb = this.leafBouq[i];
      var lq = this.leafQR[i];
      ph = this.leafPhase[i] || 0;
      var lsway = (1 - e) * Math.sin(time * 1.8 + ph) * 0.12;
      var leaf = this.leaves[i];
      leaf.visible = e < 0.85;
      leaf.position.set(
        lerp(lb.p.x, lq.p.x, e),
        lerp(lb.p.y, lq.p.y, e),
        lerp(lb.p.z, lq.p.z, e)
      );
      s = lerp(lb.s, lq.s, e);
      leaf.scale.set(s, s, s);
      leaf.rotation.set(lb.rot.x, lb.rot.y + lsway, lb.rot.z);
    }
    for (i = lCount; i < this.leaves.length; i++) this.leaves[i].visible = false;

    if (this.vase) {
      this.vase.visible = e < 0.85;
      this.vase.scale.setScalar(lerp(1, 0.2, e));
      this.vase.position.y = lerp(0, -1.4, e);
    }
    if (this.shadow) {
      this.shadow.visible = e < 0.75;
      this.shadow.material.opacity = lerp(0.1, 0, e);
    }
    if (this.qrBoard) {
      this.qrBoard.visible = e > 0.3;
      this.qrBoard.material.opacity = clamp((e - 0.3) / 0.4, 0, 1);
    }

    if (this.camera) {
      this.camera.position.set(0, lerp(1.4, 8.2, e), lerp(10.4, 0.02, e));
      this.camera.lookAt(0, lerp(-0.05, 0.08, e), 0);
      this.camera.fov = lerp(30, 26, e);
      this.camera.updateProjectionMatrix();
    }
    if (this.stageRoot) this.stageRoot.rotation.y = lerp(this.orbitY, 0, e);
  };

  BloomEngine.prototype.toggle = function () {
    if (!this.qr) return;
    var toQR = this.mode === 'bouquet';
    this.mode = toQR ? 'qr' : 'bouquet';
    this.anim.active = true;
    this.anim.t0 = performance.now();
    this.anim.from = this.progress;
    this.anim.to = toQR ? 1 : 0;
    this._updateHint();
    this.start();
  };

  BloomEngine.prototype._updateHint = function () {
    if (!this._hintEl) return;
    if (!this.qr) { this._hintEl.hidden = true; return; }
    this._hintEl.hidden = false;
    this._hintEl.textContent = this.mode === 'bouquet'
      ? '拖动旋转 · 轻点绽放二维码'
      : '轻点收回花束';
  };

  BloomEngine.prototype.resize = function () {
    if (!this.renderer || !this.host) return;
    var w = this.host.clientWidth || 280;
    var h = this.host.clientHeight || 280;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (w * dpr * h * dpr > 2000000) dpr = Math.sqrt(2000000 / (w * h));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  BloomEngine.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    var self = this;
    var tick = function (now) {
      if (!self.running) return;
      self.raf = requestAnimationFrame(tick);
      self._time = now * 0.001;
      if (self.anim.active) {
        var u = (now - self.anim.t0) / self.anim.dur;
        if (u >= 1) {
          self.anim.active = false;
          self.progress = self.anim.to;
        } else {
          self.progress = lerp(self.anim.from, self.anim.to, u);
        }
      }
      if (self.qr && (self.mode === 'bouquet' || self.anim.active || self.progress > 0)) {
        self._applyPose(self.progress, self._time);
      }
      if (self.stageRoot && self.mode === 'bouquet' && self.progress < 0.2) {
        self.stageRoot.rotation.y = self.orbitY;
      }
      self.renderer.render(self.scene, self.camera);
    };
    this.raf = requestAnimationFrame(tick);
  };

  BloomEngine.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  BloomEngine.prototype.captureDataURL = function (size) {
    if (!this.renderer) return null;
    var side = size || 1024;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(side, side, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this._applyPose(this.progress, this._time);
    this.renderer.render(this.scene, this.camera);
    var url = this.renderer.domElement.toDataURL('image/png');
    this.resize();
    return url;
  };

  BloomEngine.prototype.destroy = function () {
    this.stop();
    if (this._visHandler) document.removeEventListener('visibilitychange', this._visHandler);
    if (this.renderer) {
      var el = this.renderer.domElement;
      if (this._onLost) el.removeEventListener('webglcontextlost', this._onLost);
      if (this._onRestored) el.removeEventListener('webglcontextrestored', this._onRestored);
      if (el.parentNode) el.parentNode.removeChild(el);
      this.renderer.dispose();
    }
    this.renderer = null;
    this.scene = null;
    this.host = null;
    this.flowers = [];
    this.leaves = [];
  };

  global.ColorQRBloom = {
    create: function () { return new BloomEngine(); },
    palettes: PALETTES
  };
})(typeof window !== 'undefined' ? window : this);
