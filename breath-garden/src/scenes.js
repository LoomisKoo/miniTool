/* global THREE */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function skyCanvas() {
    var cv = document.createElement('canvas');
    cv.width = 32;
    cv.height = 256;
    var c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#4f8fd0');
    g.addColorStop(0.42, '#bcdcf5');
    g.addColorStop(0.58, '#e8f2f8');
    g.addColorStop(0.72, '#b9d2a8');
    g.addColorStop(1, '#6f8f5e');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 256);
    return cv;
  }

  function envCanvas() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#9fc9f0');
    g.addColorStop(0.5, '#eef6ff');
    g.addColorStop(1, '#9ab98a');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    return cv;
  }

  /* hx/hy：物体在自身坐标下的半宽 / 半高；cy：竖向中心。用于自适应取景 */
  var FOCUS = {
    pinwheel: { hx: 0.8, hy: 0.9, cy: 0.87 },
    balloon: { hx: 0.52, hy: 0.66, cy: 0.68 },
    bubble: { hx: 0.52, hy: 0.8, cy: 0.9 },
    dandelion: { hx: 0.32, hy: 0.8, cy: 0.78 },
    lung: { hx: 0.44, hy: 0.44, cy: 1.05 }
  };
  var CAM_DIST = 3.0;

  function SceneRunner(host) {
    this.host = host;
    this.ready = false;
    this.id = 'pinwheel';
    this.state = {};
    this.particles = [];
    this.onComplete = null;
    this.time = 0;
  }

  SceneRunner.prototype.viewSize = function () {
    var vv = window.visualViewport;
    return { w: (vv && vv.width) || window.innerWidth, h: (vv && vv.height) || window.innerHeight };
  };

  SceneRunner.prototype.ensureInit = function () {
    if (this.ready) return;
    this.ready = true;
    var vs = this.viewSize();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(vs.w, vs.h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, vs.w / vs.h, 0.1, 60);

    this.scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x6b7a58, 2.1));
    var sun = new THREE.DirectionalLight(0xfff3e0, 2.7);
    sun.position.set(2.6, 5.2, 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 20;
    sun.shadow.camera.left = -3.5;
    sun.shadow.camera.right = 3.5;
    sun.shadow.camera.top = 3.5;
    sun.shadow.camera.bottom = -3.5;
    sun.shadow.bias = -0.0012;
    this.scene.add(sun);
    this.sun = sun;

    var fill = new THREE.DirectionalLight(0xcfe2ff, 0.9);
    fill.position.set(-2.4, 1.4, 1.8);
    this.scene.add(fill);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    var tex = new THREE.CanvasTexture(envCanvas());
    tex.mapping = THREE.EquirectangularReflectionMapping;
    this.envTex = this.pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    this.scene.environment = this.envTex;

    var skyTex = new THREE.CanvasTexture(skyCanvas());
    skyTex.colorSpace = THREE.SRGBColorSpace;
    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(28, 32, 20),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
    );
    this.scene.add(sky);
    this.sky = sky;

    var groundTex = new THREE.CanvasTexture(this.makeGroundCanvas());
    groundTex.colorSpace = THREE.SRGBColorSpace;
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(6, 6);
    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshStandardMaterial({ map: groundTex, color: 0x9dbb86, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.01;
    this.scene.add(ground);
    this.ground = ground;

    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);

    this.motes = this.makeMotes();
    this.scene.add(this.motes);

    this.applyFraming(0);
  };

  SceneRunner.prototype.makeGroundCanvas = function () {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var c = cv.getContext('2d');
    c.fillStyle = '#8fae76';
    c.fillRect(0, 0, 128, 128);
    for (var i = 0; i < 2600; i++) {
      var x = Math.random() * 128;
      var y = Math.random() * 128;
      var l = 0.5 + Math.random();
      c.fillStyle = 'rgba(' + (90 + Math.random() * 60).toFixed(0) + ',' + (130 + Math.random() * 50).toFixed(0) + ',80,' + (0.12 * l).toFixed(2) + ')';
      c.fillRect(x, y, 1, 2);
    }
    return cv;
  };

  SceneRunner.prototype.makeMotes = function () {
    var n = 140;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = rand(-3, 3);
      pos[i * 3 + 1] = rand(0, 3);
      pos[i * 3 + 2] = rand(-2.5, 2.5);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.028,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    var p = new THREE.Points(geo, mat);
    p.userData.base = pos.slice(0);
    return p;
  };

  SceneRunner.prototype.clearContent = function () {
    while (this.content.children.length) {
      var ch = this.content.children[0];
      this.content.remove(ch);
      this.disposeTree(ch);
    }
    while (this.fxGroup.children.length) {
      var fx = this.fxGroup.children[0];
      this.fxGroup.remove(fx);
      this.disposeTree(fx);
    }
    this.particles = [];
  };

  SceneRunner.prototype.disposeTree = function (o) {
    o.traverse(function (n) {
      if (n.geometry) n.geometry.dispose();
      if (n.material) {
        if (Array.isArray(n.material)) n.material.forEach(function (m) { m.dispose(); });
        else n.material.dispose();
      }
    });
  };

  SceneRunner.prototype.setScene = function (id) {
    this.ensureInit();
    this.id = id;
    this.time = 0;
    this.state = { done: false, progress: 0 };
    this.clearContent();
    if (id === 'pinwheel') this.buildPinwheel();
    else if (id === 'balloon') this.buildBalloon();
    else if (id === 'bubble') this.buildBubble();
    else if (id === 'dandelion') this.buildDandelion();
    else if (id === 'lung') this.buildLung();
    this.applyFraming(0);
  };

  SceneRunner.prototype.buildPinwheel = function () {
    var g = new THREE.Group();
    g.position.set(0, 1.0, 0);
    var colors = [0xff6b9d, 0x4fb8f0, 0xffd257, 0x74dfae];
    var wheel = new THREE.Group();
    for (var i = 0; i < 4; i++) {
      var pivot = new THREE.Group();
      pivot.rotation.z = (i * Math.PI) / 2;
      var blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.36, 0.012),
        new THREE.MeshPhysicalMaterial({
          color: colors[i],
          metalness: 0.05,
          roughness: 0.42,
          clearcoat: 0.7,
          clearcoatRoughness: 0.2,
          side: THREE.DoubleSide
        })
      );
      blade.position.set(0.37, 0.18, 0);
      blade.castShadow = true;
      pivot.add(blade);
      wheel.add(pivot);
    }
    g.add(wheel);
    var hub = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 24, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xf2f6ff, metalness: 0.6, roughness: 0.15, clearcoat: 1 })
    );
    hub.castShadow = true;
    g.add(hub);
    var stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.022, 1.0, 14),
      new THREE.MeshStandardMaterial({ color: 0xb98d5f, roughness: 0.68, metalness: 0.04 })
    );
    stick.position.y = -0.5;
    stick.castShadow = true;
    g.add(stick);
    this.content.add(g);
    this.state.wheel = wheel;
    this.state.root = g;
    this.state.vel = 0;
    this.state.angle = 0;
    this.state.spinSec = 0;
  };

  SceneRunner.prototype.buildBalloon = function () {
    var g = new THREE.Group();
    g.position.set(0, 0.85, 0);
    var hue = rand(0, 1);
    var col = new THREE.Color().setHSL(hue, 0.7, 0.58);
    var ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 48, 48),
      new THREE.MeshPhysicalMaterial({
        color: col,
        metalness: 0.02,
        roughness: 0.16,
        clearcoat: 0.9,
        clearcoatRoughness: 0.06,
        sheen: 0.5,
        sheenColor: new THREE.Color(0xffffff)
      })
    );
    ball.castShadow = true;
    g.add(ball);
    var knot = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.055, 12),
      new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.8), roughness: 0.5 })
    );
    knot.position.y = -0.22;
    knot.rotation.x = Math.PI;
    g.add(knot);
    var string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.0035, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.85 })
    );
    string.position.y = -0.5;
    g.add(string);
    this.content.add(g);
    this.state.balloon = g;
    this.state.mesh = ball;
    this.state.baseCol = col;
    this.state.scale = 1;
    this.state.popped = false;
    this.state.inflate = 0;
  };

  SceneRunner.prototype.buildBubble = function () {
    var wand = new THREE.Group();
    wand.position.set(0, 0.62, 0.22);
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.011, 12, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xd8b98e, metalness: 0.55, roughness: 0.3, clearcoat: 0.6 })
    );
    ring.rotation.x = Math.PI / 2;
    wand.add(ring);
    var handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.018, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.72 })
    );
    handle.position.y = -0.17;
    wand.add(handle);
    this.content.add(wand);
    this.state.wand = wand;
    this.state.bubbles = [];
    this.state.maxR = 0;
    this.state.spawnX = 0;
  };

  SceneRunner.prototype.makeBubbleMesh = function () {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 32, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.03,
        transmission: 0.94,
        thickness: 0.12,
        ior: 1.35,
        transparent: true,
        opacity: 0.9,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        iridescence: 1,
        iridescenceIOR: 1.3
      })
    );
    return m;
  };

  SceneRunner.prototype.buildDandelion = function () {
    var g = new THREE.Group();
    g.position.set(0, 0.42, 0);
    var stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.015, 0.95, 10),
      new THREE.MeshStandardMaterial({ color: 0x3f7c3f, roughness: 0.8 })
    );
    stem.position.y = 0.48;
    stem.castShadow = true;
    g.add(stem);
    var headY = 1.0;
    var core = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xc8d8b8, roughness: 0.9 })
    );
    core.position.y = headY;
    g.add(core);
    var pts = [];
    var n = 110;
    for (var i = 0; i < n; i++) {
      var u = Math.random();
      var v = Math.random();
      var theta = Math.acos(2 * u - 1) * 0.62;
      var phi = v * TAU;
      var r = 0.115 + Math.random() * 0.02;
      pts.push(0, headY, 0);
      pts.push(
        Math.sin(theta) * Math.cos(phi) * r,
        headY + Math.cos(theta) * r,
        Math.sin(theta) * Math.sin(phi) * r
      );
    }
    var fluffGeo = new THREE.BufferGeometry();
    fluffGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    var fluff = new THREE.LineSegments(
      fluffGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    g.add(fluff);
    var tips = [];
    for (var k = 0; k < pts.length; k += 6) {
      tips.push(pts[k + 3], pts[k + 4], pts[k + 5]);
    }
    var tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute('position', new THREE.Float32BufferAttribute(tips, 3));
    var tipPoints = new THREE.Points(
      tipGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.016, transparent: true, opacity: 0.9, sizeAttenuation: true })
    );
    g.add(tipPoints);
    this.content.add(g);
    this.state.plant = g;
    this.state.fluff = fluff;
    this.state.headY = 1.0;
    this.state.seeds = [];
    this.state.emitted = 0;
    this.state.dist = 0;
  };

  SceneRunner.prototype.buildLung = function () {
    var g = new THREE.Group();
    var tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.4, 0.075, 48, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0xd6ecff,
        metalness: 0.1,
        roughness: 0.12,
        transmission: 0.6,
        thickness: 0.25,
        transparent: true,
        opacity: 0.8,
        clearcoat: 1
      })
    );
    tube.position.set(0, 1.05, 0);
    tube.material.side = THREE.DoubleSide;
    g.add(tube);
    var inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xffb8d0, roughness: 0.5, transparent: true, opacity: 0.35 })
    );
    inner.position.set(0, 1.05, 0);
    g.add(inner);
    this.content.add(g);
    this.state.root = g;
    this.state.tube = tube;
    this.state.inner = inner;
    this.state.phase = 'ready';
    this.state.blowT = 0;
  };

  SceneRunner.prototype.spawnPop3D = function (x, y, z) {
    var kinds = ['star', 'confetti', 'flower', 'heart'];
    for (var i = 0; i < 60; i++) {
      var kind = kinds[Math.floor(Math.random() * kinds.length)];
      var geo;
      var mat;
      if (kind === 'confetti') {
        geo = new THREE.BoxGeometry(0.035, 0.1, 0.015);
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(Math.random(), 0.85, 0.62),
          roughness: 0.4,
          metalness: 0.1
        });
      } else if (kind === 'star') {
        geo = new THREE.OctahedronGeometry(0.055, 0);
        mat = new THREE.MeshStandardMaterial({ color: 0xffe08a, metalness: 0.6, roughness: 0.18 });
      } else if (kind === 'flower') {
        geo = new THREE.SphereGeometry(0.045, 8, 8);
        mat = new THREE.MeshStandardMaterial({ color: 0xff8ab8, roughness: 0.5 });
      } else {
        geo = new THREE.IcosahedronGeometry(0.042, 0);
        mat = new THREE.MeshStandardMaterial({ color: 0xff4d7d, roughness: 0.3 });
      }
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      var ang = rand(0, TAU);
      var sp = rand(0.09, 0.4);
      this.particles.push({
        mesh: mesh,
        vx: Math.cos(ang) * sp,
        vy: rand(0.35, 0.95),
        vz: Math.sin(ang) * sp,
        life: rand(1, 2.2),
        t: 0,
        vr: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-3, 3))
      });
      this.fxGroup.add(mesh);
    }
  };

  SceneRunner.prototype.update = function (dt, breath) {
    var flow = breath.flow;
    var sec = Math.min(0.05, dt / 1000);
    var id = this.id;
    this.time += sec;

    if (id === 'pinwheel' && this.state.wheel) {
      var target = flow * 11 + 0.4;
      this.state.vel += (target - this.state.vel) * (flow > 0.35 ? 0.09 : 0.05);
      this.state.vel *= 0.995;
      this.state.angle += this.state.vel * sec;
      this.state.wheel.rotation.z = this.state.angle;
      this.state.root.rotation.z = Math.sin(this.time * 1.1) * 0.012;
      if (flow > 0.45 && this.state.vel > 5) this.state.spinSec += sec;
      this.state.progress = Math.min(1, this.state.spinSec / 4);
      if (this.state.spinSec > 4 && !this.state.done) {
        this.state.done = true;
        this.state.progress = 1;
        if (this.onComplete) this.onComplete();
      }
    } else if (id === 'balloon' && this.state.balloon && !this.state.popped) {
      var grow = 1 + flow * 0.0075;
      this.state.scale *= grow;
      if (flow > 0.06) this.state.inflate += flow * sec;
      this.state.mesh.scale.setScalar(this.state.scale);
      this.state.balloon.position.y = 0.85 + (this.state.scale - 1) * 0.16 + Math.sin(this.time * 1.7) * 0.008;
      this.state.balloon.rotation.z = Math.sin(this.time * 1.3) * 0.03;
      this.state.progress = Math.min(1, (this.state.scale - 1) / 1.35);
      if (this.state.scale > 2.35 || this.state.inflate > 6) {
        this.state.popped = true;
        this.state.progress = 1;
        var p = this.state.balloon.position;
        this.spawnPop3D(p.x, p.y, p.z);
        this.content.remove(this.state.balloon);
        this.disposeTree(this.state.balloon);
        this.state.balloon = null;
        if (this.onComplete) this.onComplete();
      }
    } else if (id === 'bubble') {
      var wand = this.state.wand;
      if (wand) {
        wand.position.y = 0.62 + Math.sin(this.time * 1.4) * 0.02;
        wand.rotation.z = Math.sin(this.time * 0.9) * 0.05;
      }
      if (flow > 0.14 && Math.random() < flow * 0.14) {
        var b = this.makeBubbleMesh();
        b.position.set(rand(-0.06, 0.06), 0.7, rand(0.08, 0.28));
        this.content.add(b);
        this.state.bubbles.push({ mesh: b, r: 0.06, vy: 0.3 + flow * 0.9, ph: rand(0, TAU) });
      }
      var arr = this.state.bubbles;
      var next = [];
      for (var i = 0; i < arr.length; i++) {
        var bub = arr[i];
        bub.r += flow * 0.0042 * (dt / 16);
        bub.mesh.scale.setScalar(bub.r / 0.06);
        bub.mesh.position.y += bub.vy * sec;
        bub.mesh.position.x += Math.sin(this.time * 2 + bub.ph) * 0.0016;
        if (bub.r > this.state.maxR) this.state.maxR = bub.r;
        if (bub.r < 0.42 && bub.mesh.position.y < 1.7) next.push(bub);
        else {
          this.content.remove(bub.mesh);
          this.disposeTree(bub.mesh);
        }
      }
      this.state.bubbles = next;
      this.state.progress = Math.min(1, this.state.maxR / 0.34);
      if ((this.state.maxR > 0.34 || next.length > 9) && !this.state.done) {
        this.state.done = true;
        this.state.progress = 1;
        if (this.onComplete) this.onComplete();
      }
    } else if (id === 'dandelion') {
      var plant = this.state.plant;
      if (plant) {
        plant.rotation.z = Math.sin(this.time * 1.2) * 0.02 + flow * 0.06;
      }
      if (flow > 0.12) {
        var emit = Math.max(1, Math.floor(flow * 3));
        for (var e = 0; e < emit; e++) {
          if (this.state.emitted > 110) break;
          this.state.emitted++;
          var seed = new THREE.Mesh(
            new THREE.SphereGeometry(0.009, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })
          );
          seed.position.set(0, 0.42 + this.state.headY, 0);
          this.content.add(seed);
          var a2 = rand(-0.8, 0.8) - Math.PI / 2;
          var sp2 = flow * rand(0.2, 0.5);
          this.state.seeds.push({
            mesh: seed,
            vx: Math.cos(a2) * sp2,
            vy: 0.12 + flow * 0.22,
            vz: Math.sin(a2) * sp2,
            life: rand(1.6, 3),
            t: 0,
            ph: rand(0, TAU)
          });
        }
      }
      var seeds = this.state.seeds;
      var keep = [];
      var maxD = this.state.dist;
      for (var s = 0; s < seeds.length; s++) {
        var sd = seeds[s];
        sd.t += sec;
        sd.vy -= 0.06 * sec;
        sd.mesh.position.x += sd.vx * sec * 4.5 + Math.sin(this.time * 3 + sd.ph) * 0.0018;
        sd.mesh.position.y += sd.vy * sec * 4.5;
        sd.mesh.position.z += sd.vz * sec * 4.5;
        var d = Math.sqrt(sd.mesh.position.x * sd.mesh.position.x + sd.mesh.position.z * sd.mesh.position.z);
        if (d > maxD) maxD = d;
        if (sd.t < sd.life) keep.push(sd);
        else {
          this.content.remove(sd.mesh);
          this.disposeTree(sd.mesh);
        }
      }
      this.state.seeds = keep;
      this.state.dist = maxD;
      this.state.progress = Math.min(1, maxD / 1.3);
      if (maxD > 1.3 && !this.state.done) {
        this.state.done = true;
        this.state.progress = 1;
        if (this.onComplete) this.onComplete();
      }
    } else if (id === 'lung') {
      var root = this.state.root;
      if (root) root.rotation.y = Math.sin(this.time * 0.6) * 0.08;
      if (this.state.phase === 'blow') {
        this.state.blowT += sec;
        var sc = 1 + breath.peak * 0.09;
        if (this.state.tube) this.state.tube.scale.set(sc, 1, sc);
        if (this.state.inner) {
          this.state.inner.scale.setScalar(1 + breath.peak * 0.28);
          this.state.inner.material.opacity = 0.24 + breath.peak * 0.3;
        }
        if (this.state.blowT > 14) {
          this.state.phase = 'done';
          if (this.onComplete) this.onComplete();
        }
      }
    }

    for (var p = 0; p < this.particles.length; p++) {
      var pt = this.particles[p];
      pt.t += sec;
      if (pt.t >= pt.life) {
        this.fxGroup.remove(pt.mesh);
        this.disposeTree(pt.mesh);
        continue;
      }
      pt.vy -= 0.9 * sec;
      pt.mesh.position.x += pt.vx * sec * 3;
      pt.mesh.position.y += pt.vy * sec * 3;
      pt.mesh.position.z += pt.vz * sec * 3;
      pt.mesh.rotation.x += pt.vr.x * sec;
      pt.mesh.rotation.y += pt.vr.y * sec;
      pt.mesh.rotation.z += pt.vr.z * sec;
      var f = 1 - pt.t / pt.life;
      pt.mesh.scale.setScalar(Math.max(0.05, f));
    }
    for (var q = this.particles.length - 1; q >= 0; q--) {
      if (this.particles[q].t >= this.particles[q].life) this.particles.splice(q, 1);
    }

    this.animateAmbient(flow, sec);
    this.applyFraming(flow);
  };

  SceneRunner.prototype.animateAmbient = function (flow, sec) {
    if (!this.motes) return;
    this.motes.position.y = (this.time * 0.045) % 3;
    this.motes.material.opacity = 0.35 + Math.sin(this.time * 0.8) * 0.08 + flow * 0.25;
  };

  SceneRunner.prototype.applyFraming = function (flow) {
    var focus = FOCUS[this.id] || FOCUS.pinwheel;
    var vs = this.viewSize();
    var aspect = vs.w / vs.h;
    var vfov = (this.camera.fov * Math.PI) / 180;
    var halfH = Math.tan(vfov / 2) * CAM_DIST;
    var halfW = halfH * aspect;
    var s = Math.min(1.45, (halfH * 0.95) / focus.hy, (halfW * 0.98) / focus.hx);
    if (this.content) this.content.scale.setScalar(s);
    if (this.fxGroup) this.fxGroup.scale.setScalar(s);
    this.contentScale = s;
    var cy = focus.cy * s;
    var f = flow || 0;
    var z = CAM_DIST * (1 - f * 0.06);
    this.camera.position.set(Math.sin(this.time * 0.26) * 0.05, cy + 0.22, z);
    this.camera.lookAt(0, cy - 0.04 - f * 0.03, 0);
  };

  SceneRunner.prototype.getProgress = function () {
    return this.state.progress || 0;
  };

  SceneRunner.prototype.resize = function () {
    this.ensureInit();
    var vs = this.viewSize();
    this.camera.aspect = vs.w / vs.h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(vs.w, vs.h);
    this.applyFraming(0);
  };

  SceneRunner.prototype.render = function () {
    this.ensureInit();
    this.renderer.render(this.scene, this.camera);
  };

  SceneRunner.prototype.dispose = function () {
    if (!this.ready) return;
    this.clearContent();
    if (this.envTex) this.envTex.dispose();
    if (this.pmrem) this.pmrem.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.ready = false;
  };

  global.SceneRunner = SceneRunner;
})(typeof window !== 'undefined' ? window : globalThis);
