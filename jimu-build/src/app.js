/**
 * 积木搭建 — 真 3D 拼搭小工具（离线单页，无 CDN）
 *
 * 省资源三原则：
 *   1) 零件只有 7 种「通用规格」，不预生成任何模型 / 贴图
 *   2) 砖体、凸点各一个 InstancedMesh，底板凸点一个，几何全部程序化
 *   3) 逻辑是体素网格（occ 字典），3D 只是表现层；不上物理引擎
 *
 * 关键几何（1 = 一个凸点间距）：
 *   砖体顶面 = (层+1) * BRICK_H，凸点从砖体顶面往上长。
 *   叠放时凸点被上层砖体包在里面（和真实积木一样看不见），
 *   只有最上层的砖才露出凸点 —— 这就是「正反面」的区分。
 */
(function () {
  'use strict';

  /* ==================== 尺寸 ==================== */
  var BRICK_H = 1.2;            // 一层标准砖高
  var SEAM = 0.014;             // 砖体上下留缝，避免共面 z-fighting，同时读作砖缝
  var BODY_H = BRICK_H - SEAM;  // 砖体高：顶面正好落在层顶
  var STUD_R = 0.30;
  var STUD_H = 0.16;
  var STUD_EMBED = 0.012;       // 凸点根部埋进砖体一点，避免出现缝隙
  var STUD_Y = SEAM + BODY_H - STUD_EMBED + STUD_H / 2;   // 凸点中心（相对层底）
  var BOARD_TOP = -0.007;
  var BASE_STUD_Y = BOARD_TOP - STUD_EMBED + STUD_H / 2;

  var MAX_SIDE = 300;           // 场地单边上限
  var STEP = 30;                // 每次加宽多少
  var MAX_BRICKS = 2000;
  var MAX_STUDS = 24000;        // 2000 块 × 最多 12 个凸点（2x6）
  /* 底板凸点性能闸门：格子数超过这个值就不再画底板凸点。
     25000 ≈ 158×158，此时每格还有 ~3.5px、凸点看得见；
     再大就只是看不见的碎点，却要吃几十万三角面，不划算。 */
  var BASE_STUD_CELL_MAX = 25000;
  var CAM_MIN = 8;
  var CAM_MAX = 1400;

  /* 通用零件表：只有长宽两个数字，没有任何单独资源 */
  var BRICKS = [
    { id: '1x1', w: 1, d: 1 },
    { id: '1x2', w: 2, d: 1 },
    { id: '1x3', w: 3, d: 1 },
    { id: '1x4', w: 4, d: 1 },
    { id: '2x2', w: 2, d: 2 },
    { id: '2x4', w: 4, d: 2 },
    { id: '2x6', w: 6, d: 2 }
  ];

  var COLORS = [
    0xc91a09, 0xf2cd37, 0x0055bf, 0x237841,
    0xfe8a18, 0xf2f3f2, 0x05131d, 0x9ba19d,
    0x0a3463, 0xfc97ac, 0x81007b, 0x582a12
  ];

  /* ==================== 临时对象 ==================== */
  var UP = new THREE.Vector3(0, 1, 0);
  var _q = new THREE.Quaternion();
  var _v = new THREE.Vector3();
  var _m = new THREE.Matrix4();
  var _s = new THREE.Vector3();
  var _col = new THREE.Color();
  var _ndc = new THREE.Vector2();

  /* ==================== 场地范围（逻辑格，可为负） ==================== */
  var board = { x0: 0, z0: 0, x1: 50, z1: 50 };

  function boardW() { return board.x1 - board.x0; }
  function boardD() { return board.z1 - board.z0; }
  function boardCX() { return (board.x0 + board.x1) / 2; }
  function boardCZ() { return (board.z0 + board.z1) / 2; }

  /* ==================== 场景 ==================== */
  var host = document.getElementById('stage');
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);   /* 舞台 = 纯黑 void，产品（积木）自己发光 */

  var camera = new THREE.PerspectiveCamera(45, 1, 0.5, 500);
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3040, 1.12));

  var keyLight = new THREE.DirectionalLight(0xffffff, 1.75);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.0015;
  var shadowCam = keyLight.shadow.camera;
  shadowCam.near = 2;
  shadowCam.far = 200;
  scene.add(keyLight, keyLight.target);

  var fillLight = new THREE.DirectionalLight(0x9fc0ff, 0.35);
  scene.add(fillLight);

  /* 底板：一个 Box，按场地范围重建 */
  var boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x272729, roughness: 0.9, metalness: 0.0 })
  );
  boardMesh.receiveShadow = true;
  scene.add(boardMesh);

  /* ==================== InstancedMesh ==================== */
  function makeInstanced(geo, mat, cap, useColor) {
    var im = new THREE.InstancedMesh(geo, mat, cap);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (useColor) {
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    }
    im.count = 0;
    im.frustumCulled = false;
    scene.add(im);
    return im;
  }

  var bodyIM = makeInstanced(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.0 }),
    MAX_BRICKS, true
  );
  bodyIM.castShadow = true;
  bodyIM.receiveShadow = true;

  /* 砖上的凸点（每实例颜色 = 砖色） */
  var studIM = makeInstanced(
    new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 12),
    new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.0 }),
    MAX_STUDS, true
  );

  /* 底板凸点：数量可能上万，用 6 边形省顶点，容量按需分配 */
  var baseStudGeo = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 6);
  var baseStudMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 0.9, metalness: 0.0 });
  var baseStudIM = null;
  var baseStudCap = 0;

  /* ==================== 体素数据 ==================== */
  var bricks = [];
  var occ = Object.create(null);
  var studFree = [];
  var studCursor = 0;
  var undoStack = [];
  var redoStack = [];
  var anim = [];
  var dirty = true;

  function key(x, y, z) { return x + ',' + y + ',' + z; }

  /* 旋转后在世界里的实际长宽 */
  function foot(type, rot) {
    return (rot % 2) ? { w: type.d, d: type.w } : { w: type.w, d: type.d };
  }

  /* ==================== 底板 ==================== */
  function layBaseStuds() {
    var cells = boardW() * boardD();
    /* 场地太大就不画底板凸点：几万个实例在手机上会拖帧，且彼时凸点只有 1~2 像素 */
    if (cells > BASE_STUD_CELL_MAX) {
      if (baseStudIM) { scene.remove(baseStudIM); baseStudIM.dispose(); baseStudIM = null; baseStudCap = 0; }
      return;
    }
    if (!baseStudIM || baseStudCap < cells) {
      if (baseStudIM) { scene.remove(baseStudIM); baseStudIM.dispose(); }
      baseStudCap = Math.max(cells, 256);
      baseStudIM = new THREE.InstancedMesh(baseStudGeo, baseStudMat, baseStudCap);
      baseStudIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      baseStudIM.frustumCulled = false;
      baseStudIM.count = 0;
      scene.add(baseStudIM);
    }
    var n = 0;
    for (var x = board.x0; x < board.x1; x++) {
      for (var z = board.z0; z < board.z1; z++) {
        _m.makeTranslation(x + 0.5, BASE_STUD_Y, z + 0.5);
        baseStudIM.setMatrixAt(n, _m);
        n++;
      }
    }
    baseStudIM.count = n;
    baseStudIM.instanceMatrix.needsUpdate = true;
  }

  function rebuildBoard(refit) {
    var w = boardW(), d = boardD();
    boardMesh.geometry.dispose();
    boardMesh.geometry = new THREE.BoxGeometry(w, 0.8, d);
    boardMesh.position.set(boardCX(), BOARD_TOP - 0.4, boardCZ());
    boardMesh.updateMatrixWorld(true);
    layBaseStuds();
    frameBoard(refit);
    dirty = true;
  }

  /* ==================== 实例矩阵写入 ==================== */
  function writeBody(b, yOff) {
    var f = foot(b.type, b.rot);
    _q.setFromAxisAngle(UP, b.rot * Math.PI / 2);
    _v.set(b.x + f.w / 2, b.y * BRICK_H + SEAM + BODY_H / 2 + yOff, b.z + f.d / 2);
    _s.set(b.type.w, BODY_H, b.type.d);
    _m.compose(_v, _q, _s);
    bodyIM.setMatrixAt(b.slot, _m);
  }

  function writeStuds(b, yOff) {
    var t = b.type, f = foot(t, b.rot);
    _q.setFromAxisAngle(UP, b.rot * Math.PI / 2);
    var cx = b.x + f.w / 2;
    var cz = b.z + f.d / 2;
    var cy = b.y * BRICK_H + STUD_Y + yOff;
    var n = 0;
    for (var i = 0; i < t.w; i++) {
      for (var j = 0; j < t.d; j++) {
        if (n >= b.studs.length) return;
        _v.set(i + 0.5 - t.w / 2, 0, j + 0.5 - t.d / 2).applyQuaternion(_q);
        _m.makeTranslation(cx + _v.x, cy, cz + _v.z);
        studIM.setMatrixAt(b.studs[n], _m);
        n++;
      }
    }
  }

  function layout(b, yOff) {
    writeBody(b, yOff || 0);
    writeStuds(b, yOff || 0);
    bodyIM.instanceMatrix.needsUpdate = true;
    studIM.instanceMatrix.needsUpdate = true;
    dirty = true;
  }

  function paint(b) {
    bodyIM.setColorAt(b.slot, b.col);
    for (var i = 0; i < b.studs.length; i++) studIM.setColorAt(b.studs[i], b.col);
    bodyIM.instanceColor.needsUpdate = true;
    studIM.instanceColor.needsUpdate = true;
    dirty = true;
  }

  /* ==================== 占用表 ==================== */
  function markOcc(b) {
    var f = foot(b.type, b.rot);
    for (var i = 0; i < f.w; i++) {
      for (var j = 0; j < f.d; j++) occ[key(b.x + i, b.y, b.z + j)] = b;
    }
  }

  function clearOcc(b) {
    var f = foot(b.type, b.rot);
    for (var i = 0; i < f.w; i++) {
      for (var j = 0; j < f.d; j++) {
        var k = key(b.x + i, b.y, b.z + j);
        if (occ[k] === b) delete occ[k];
      }
    }
  }

  /* ==================== 放置校验 ==================== */
  function canPlace(type, x, z, y, rot, exclude) {
    var f = foot(type, rot);
    if (x < board.x0 || z < board.z0 || x + f.w > board.x1 || z + f.d > board.z1) return false;
    for (var i = 0; i < f.w; i++) {
      for (var j = 0; j < f.d; j++) {
        var o = occ[key(x + i, y, z + j)];
        if (o && o !== exclude) return false;
      }
    }
    if (y > 0) {                        // 至少一格有支撑即可（允许悬挑）
      var ok = false;
      for (var a = 0; a < f.w && !ok; a++) {
        for (var b2 = 0; b2 < f.d; b2++) {
          var s = occ[key(x + a, y - 1, z + b2)];
          if (s && s !== exclude) { ok = true; break; }
        }
      }
      if (!ok) return false;
    }
    return true;
  }

  /* 谁踩在这块砖上 */
  function ridersOf(b) {
    var f = foot(b.type, b.rot);
    var out = [];
    for (var i = 0; i < f.w; i++) {
      for (var j = 0; j < f.d; j++) {
        var r = occ[key(b.x + i, b.y + 1, b.z + j)];
        if (r && r !== b && out.indexOf(r) < 0) out.push(r);
      }
    }
    return out;
  }

  /* ==================== 增 / 删 ==================== */
  function addBrick(type, x, z, y, rot, colorHex, record) {
    if (!canPlace(type, x, z, y, rot)) return null;
    if (bricks.length >= MAX_BRICKS) { toast('砖数已达上限'); return null; }

    var b = { type: type, x: x, z: z, y: y, rot: rot, studs: [] };
    _col.setHex(colorHex);
    b.col = _col.clone();

    /* 槽位 = bricks 下标，count 就等于砖数（射线检测才准） */
    b.slot = bricks.length;
    bricks.push(b);
    bodyIM.count = bricks.length;
    bodyIM.boundingSphere = null;   // 实例集合变了，缓存球必须作废

    var need = type.w * type.d;
    for (var i = 0; i < need; i++) {
      if (!studFree.length && studCursor >= MAX_STUDS) break;
      b.studs.push(studFree.length ? studFree.pop() : studCursor++);
    }
    studIM.count = Math.min(studCursor, MAX_STUDS);

    markOcc(b);
    layout(b, 0);
    paint(b);
    anim.push({ b: b, t0: performance.now(), dur: 220 });
    if (record !== false) {
      undoStack.push({ op: 'add', snap: snapOf(b) });
      redoStack.length = 0;
      syncHistBtns();
    }
    return b;
  }

  function snapOf(b) {
    return { type: b.type, x: b.x, z: b.z, y: b.y, rot: b.rot, color: b.col.getHex() };
  }

  function removeBrick(b, record, force) {
    if (!b) return false;
    if (!force && ridersOf(b).length) { toast('上方还压着积木，先拆上面的'); return false; }
    var snap = snapOf(b);
    clearOcc(b);

    /* 回收凸点槽 */
    _m.makeScale(0, 0, 0);
    for (var i = 0; i < b.studs.length; i++) {
      studIM.setMatrixAt(b.studs[i], _m);
      studFree.push(b.studs[i]);
    }
    studIM.instanceMatrix.needsUpdate = true;
    b.studs.length = 0;

    /* 末尾换位：把最后一颗搬到空槽，保持实例连续 */
    var idx = bricks.indexOf(b);
    if (idx >= 0) {
      var last = bricks.pop();
      if (last !== b) {
        bricks[idx] = last;
        last.slot = idx;
        layout(last, 0);
        paint(last);
      }
    }
    bodyIM.count = bricks.length;
    bodyIM.boundingSphere = null;

    for (var k = anim.length - 1; k >= 0; k--) if (anim[k].b === b) anim.splice(k, 1);
    if (state.selected === b) deselect();
    if (record !== false) {
      undoStack.push({ op: 'del', snap: snap });
      redoStack.length = 0;
      syncHistBtns();
    }
    dirty = true;
    return true;
  }

  /* 清空：自上而下拆；默认记一条 clear 历史，可撤销 */
  function clearAll(record) {
    deselect();
    var snaps = bricks.map(snapOf);
    var list = bricks.slice().sort(function (a, b) { return b.y - a.y; });
    for (var i = 0; i < list.length; i++) removeBrick(list[i], false, true);
    if (record !== false && snaps.length) {
      undoStack.push({ op: 'clear', snaps: snaps });
      redoStack.length = 0;
    }
    syncHistBtns();
    refreshGhost(lastX, lastY);
  }

  function findBrick(snap) {
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (b.type === snap.type && b.x === snap.x && b.z === snap.z && b.y === snap.y && b.rot === snap.rot) {
        return b;
      }
    }
    return null;
  }

  function undo() {
    var op = undoStack.pop();
    if (!op) return;
    if (op.op === 'add') {
      var b = findBrick(op.snap);
      if (b) removeBrick(b, false, true);
    } else if (op.op === 'del') {
      addBrick(op.snap.type, op.snap.x, op.snap.z, op.snap.y, op.snap.rot, op.snap.color, false);
    } else if (op.op === 'clear') {
      op.snaps.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (s) {
        addBrick(s.type, s.x, s.z, s.y, s.rot, s.color, false);
      });
    }
    redoStack.push(op);
    syncHistBtns();
  }

  function redo() {
    var op = redoStack.pop();
    if (!op) return;
    if (op.op === 'add') {
      addBrick(op.snap.type, op.snap.x, op.snap.z, op.snap.y, op.snap.rot, op.snap.color, false);
    } else if (op.op === 'del') {
      var b = findBrick(op.snap);
      if (b) removeBrick(b, false, true);
    } else if (op.op === 'clear') {
      clearAll(false);
    }
    undoStack.push(op);
    syncHistBtns();
  }

  function syncHistBtns() {
    var u = el('undoBtn'), r = el('redoBtn');
    if (u) u.disabled = !undoStack.length;
    if (r) r.disabled = !redoStack.length;
  }

  /* ==================== 选中高亮 ==================== */
  var selBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({
      color: 0x2997ff, transparent: true, opacity: 0.95, depthTest: false
    })
  );
  selBox.renderOrder = 30;
  selBox.visible = false;
  scene.add(selBox);

  function updateSelBox() {
    var b = state.selected;
    if (!b) { selBox.visible = false; dirty = true; return; }
    var f = foot(b.type, b.rot);
    _q.setFromAxisAngle(UP, b.rot * Math.PI / 2);
    selBox.position.set(b.x + f.w / 2, b.y * BRICK_H + SEAM + BODY_H / 2, b.z + f.d / 2);
    selBox.quaternion.copy(_q);
    selBox.scale.set(b.type.w + 0.06, BODY_H + 0.06, b.type.d + 0.06);
    selBox.visible = true;
    dirty = true;
  }

  function select(b) {
    if (state.selected === b) { deselect(); return; }
    state.selected = b;
    updateSelBox();
    syncSelBar();
  }

  function deselect() {
    if (!state.selected) return;
    state.selected = null;
    updateSelBox();
    syncSelBar();
  }

  /* ==================== 旋转（要算空间够不够） ==================== */
  function findRotateTarget(b, rot) {
    var of = foot(b.type, b.rot);
    var nf = foot(b.type, rot);
    var cx = b.x + of.w / 2;
    var cz = b.z + of.d / 2;
    var bx = Math.round(cx - nf.w / 2);
    var bz = Math.round(cz - nf.d / 2);
    var best = null;
    for (var dx = -3; dx <= 3; dx++) {
      for (var dz = -3; dz <= 3; dz++) {
        var x = bx + dx, z = bz + dz;
        if (!canPlace(b.type, x, z, b.y, rot, b)) continue;
        var cost = dx * dx + dz * dz;
        if (!best || cost < best.cost) best = { x: x, z: z, cost: cost };
      }
    }
    return best;
  }

  function rotateSelected() {
    var b = state.selected;
    if (!b) return false;
    if (ridersOf(b).length) { toast('上方有积木，先移开再旋转'); return false; }
    var rot = (b.rot + 1) % 2;
    var t = findRotateTarget(b, rot);
    if (!t) { toast('周边空间不够，转不过来'); return false; }
    clearOcc(b);
    b.x = t.x; b.z = t.z; b.rot = rot;
    markOcc(b);
    layout(b, 0);
    updateSelBox();
    toast('已旋转');
    return true;
  }

  /* 换向只改「下一块」的摆放朝向（矩形砖只有横/竖两种）；已选中的砖用选中条里的「旋转」 */
  function rotatePlacement() {
    state.rot = (state.rot + 1) % 2;
    menuSpin += 90;
    syncBrickIcons();
    var cx = lastX || (window.innerWidth * 0.5);
    var cy = lastY || (window.innerHeight * 0.4);
    refreshGhost(cx, cy);
    var btn = el('rotBtn');
    btn.classList.add('flash');
    clearTimeout(rotatePlacement._t);
    rotatePlacement._t = setTimeout(function () { btn.classList.remove('flash'); }, 280);
    return true;
  }

  /* 菜单用 CSS 旋转（累加角度，保证每次都是顺时针 90° 动画） */
  var menuSpin = 0;
  function syncBrickIcons() {
    var row = el('brickRow');
    if (!row) return;
    Array.prototype.forEach.call(row.querySelectorAll('.brick-3d'), function (mini) {
      mini.style.transform = 'rotate(' + menuSpin + 'deg)';
    });
  }

  /* ==================== 幽灵预览 ==================== */
  var ghostMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false
  });
  var ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ghostMat);
  var ghostLineMat = new THREE.LineBasicMaterial({ color: 0x2997ff, transparent: true, opacity: 0.95 });
  var ghostEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), ghostLineMat
  );
  ghost.renderOrder = 5;
  ghostEdge.renderOrder = 6;
  hideGhost();
  scene.add(ghost, ghostEdge);

  function hideGhost() {
    ghost.visible = ghostEdge.visible = false;
    dirty = true;
  }

  function drawGhost(type, x, z, y, rot, valid) {
    var f = foot(type, rot);
    _q.setFromAxisAngle(UP, rot * Math.PI / 2);
    _v.set(x + f.w / 2, y * BRICK_H + SEAM + BODY_H / 2, z + f.d / 2);
    _s.set(type.w, BODY_H, type.d);
    ghost.position.copy(_v);
    ghost.quaternion.copy(_q);
    ghost.scale.copy(_s);
    ghostEdge.position.copy(_v);
    ghostEdge.quaternion.copy(_q);
    ghostEdge.scale.copy(_s);
    ghostMat.color.setHex(valid ? state.color : 0xff453a);
    ghostMat.opacity = valid ? 0.28 : 0.16;
    ghostLineMat.color.setHex(valid ? 0x2997ff : 0xff453a);
    ghost.visible = ghostEdge.visible = true;
    dirty = true;
  }

  /* ==================== 相机 ==================== */
  var cam = { yaw: 0.72, pitch: 0.78, dist: 40 };
  var look = new THREE.Vector3(0, 0.5, 0);

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function applyCamera() {
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(
      look.x + cam.dist * cp * Math.sin(cam.yaw),
      look.y + cam.dist * sp,
      look.z + cam.dist * cp * Math.cos(cam.yaw)
    );
    camera.lookAt(look);

    /* 场地可能有 300 格，近/远平面必须跟着距离走：
       否则远平面切掉场地，或者近平面把凑近看的砖裁掉 */
    camera.near = Math.max(0.5, cam.dist * 0.01);
    camera.far = cam.dist * 2.5 + Math.max(boardW(), boardD()) * 2 + 300;
    camera.updateProjectionMatrix();
    dirty = true;
  }

  /* 按场地大小自动取景（竖屏时横向是瓶颈） */
  function fitCamera() {
    var span = Math.max(boardW(), boardD()) * 1.45 + 2;
    var half = camera.fov * Math.PI / 360;
    var dv = (span / 2) / Math.tan(half);
    var dh = (span / 2) / (Math.tan(half) * camera.aspect);
    cam.dist = clamp(Math.max(dv, dh), CAM_MIN, CAM_MAX);
  }

  function frameBoard(refit) {
    var cx = boardCX(), cz = boardCZ();
    look.set(cx, 0.5, cz);
    keyLight.position.set(cx - 20, 36, cz + 18);
    keyLight.target.position.set(cx, 0, cz);
    keyLight.target.updateMatrixWorld();
    fillLight.position.set(cx + 18, 12, cz - 20);
    fillLight.target.position.set(cx, 0, cz);
    fillLight.target.updateMatrixWorld();

    /* 阴影：场地很大时要么糊要么贵，直接关掉（改 castShadow 会触发着色器重建） */
    var big = Math.max(boardW(), boardD());
    keyLight.castShadow = big <= 150;
    var span = Math.min(big * 0.8 + 8, 100);
    shadowCam.left = -span;
    shadowCam.right = span;
    shadowCam.top = span;
    shadowCam.bottom = -span;
    shadowCam.near = 2;
    shadowCam.far = 200 + span * 3;
    shadowCam.updateProjectionMatrix();

    if (refit) fitCamera();
    applyCamera();
  }

  /* ==================== 状态 ====================
   * edit=false → 放置模式（轻点落砖）
   * edit=true  → 编辑模式（轻点已放积木选中）
   * 任意模式下：滑动屏幕 = 转视角（与轻点区分）
   */
  var state = {
    brick: BRICKS[4],       // 默认 2x2
    color: COLORS[2],
    rot: 0,
    edit: false,
    selected: null
  };

  function isPlacing() { return !state.edit; }
  function isEditing() { return !!state.edit; }

  /* ==================== 射线拾取 ==================== */
  var raycaster = new THREE.Raycaster();
  var pickList = [bodyIM, boardMesh];

  function rayFromEvent(clientX, clientY) {
    var r = renderer.domElement.getBoundingClientRect();
    _ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    _ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(_ndc, camera);
  }

  /**
   * 用几何高度判顶面，不依赖 face.normal（InstancedMesh 的法线空间容易踩坑）：
   *   砖体顶面 = (层+1) * BRICK_H
   */
  function pickAt(clientX, clientY) {
    rayFromEvent(clientX, clientY);
    var hits = raycaster.intersectObjects(pickList, false);
    if (!hits.length) return { kind: 'none' };
    var h = hits[0];

    if (h.object === boardMesh) {
      return (Math.abs(h.point.y - BOARD_TOP) < 0.04)
        ? { kind: 'boardTop', wx: h.point.x, wz: h.point.z }
        : { kind: 'boardSide' };
    }

    var src = bricks[h.instanceId];
    if (!src) return { kind: 'none' };
    if (h.point.y > (src.y + 1) * BRICK_H - 0.05) {
      return { kind: 'brickTop', brick: src, wx: h.point.x, wz: h.point.z };
    }
    return { kind: 'brickSide', brick: src };
  }

  function resolvePlacement(pick) {
    var f = foot(state.brick, state.rot);
    if (pick.kind === 'boardTop') {
      return { x: Math.round(pick.wx - f.w / 2), z: Math.round(pick.wz - f.d / 2), y: 0 };
    }
    if (pick.kind === 'brickTop') {
      return {
        x: Math.round(pick.wx - f.w / 2),
        z: Math.round(pick.wz - f.d / 2),
        y: pick.brick.y + 1
      };
    }
    return null;
  }

  function refreshGhost(clientX, clientY) {
    if (!isPlacing()) { hideGhost(); return; }
    var t = resolvePlacement(pickAt(clientX, clientY));
    if (!t) { hideGhost(); return; }
    drawGhost(state.brick, t.x, t.z, t.y, state.rot,
      canPlace(state.brick, t.x, t.z, t.y, state.rot));
  }

  /* ==================== 触摸 / 鼠标 ====================
   *   轻点（位移小）→ 放置或编辑选中
   *   滑动（位移大）→ 转视角（任意模式）
   *   双指 pinch / 滚轮 → 缩放
   *   右键 / Alt 拖 → 转视角（桌面）
   */
  var pointers = new Map();
  var drag = null;
  var orbiting = false;        // 本次手势是否已进入滑动转视角
  var pinchDist0 = 0;
  var pinchStart = 0;
  var TAP_MOVE = 12;
  var TAP_MS = 450;

  function dist2(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function isOrbitButton(e) {
    return e.button === 2 || e.button === 1 || e.altKey || e.metaKey || e.ctrlKey;
  }

  function onDown(e) {
    try {
      if (renderer.domElement.setPointerCapture) {
        renderer.domElement.setPointerCapture(e.pointerId);
      }
    } catch (_) {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    /* 桌面右键 / Alt：直接轨道 */
    if (e.pointerType === 'mouse' && isOrbitButton(e)) {
      drag = {
        x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY,
        t: performance.now(), moved: TAP_MOVE + 1, forceOrbit: true
      };
      orbiting = true;
      hideGhost();
      return;
    }

    if (pointers.size === 1) {
      drag = {
        x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY,
        t: performance.now(), moved: 0, forceOrbit: false
      };
      orbiting = false;
      if (isPlacing()) refreshGhost(e.clientX, e.clientY);
    } else if (pointers.size === 2) {
      var p = Array.from(pointers.values());
      pinchDist0 = dist2(p[0], p[1]);
      pinchStart = cam.dist;
      drag = {
        x: (p[0].x + p[1].x) * 0.5,
        y: (p[0].y + p[1].y) * 0.5,
        moved: TAP_MOVE + 1, forceOrbit: true
      };
      orbiting = true;
      hideGhost();
    }
  }

  function onMove(e) {
    lastX = e.clientX;
    lastY = e.clientY;
    if (!pointers.has(e.pointerId)) return;
    var prev = pointers.get(e.pointerId);
    var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    /* 双指：pinch + 平均位移转视角 */
    if (pointers.size >= 2 && drag) {
      var p = Array.from(pointers.values());
      var midX = (p[0].x + p[1].x) * 0.5;
      var midY = (p[0].y + p[1].y) * 0.5;
      var d = dist2(p[0], p[1]);
      if (pinchDist0 > 0) {
        cam.dist = clamp(pinchStart * (pinchDist0 / Math.max(d, 1)), CAM_MIN, CAM_MAX);
      }
      cam.yaw -= (midX - drag.x) * 0.006;
      cam.pitch = clamp(cam.pitch + (midY - drag.y) * 0.005, 0.14, 1.45);
      drag.x = midX;
      drag.y = midY;
      applyCamera();
      return;
    }

    if (!drag) return;
    drag.moved += Math.abs(dx) + Math.abs(dy);

    /* 位移超过阈值 → 本手势改成转视角，不再落砖 */
    if (drag.moved > TAP_MOVE || drag.forceOrbit) {
      if (!orbiting) {
        orbiting = true;
        hideGhost();
      }
      cam.yaw -= dx * 0.006;
      cam.pitch = clamp(cam.pitch + dy * 0.005, 0.14, 1.45);
      applyCamera();
      return;
    }

    /* 尚未判定为滑动：放置模式下更新幽灵 */
    if (isPlacing()) refreshGhost(e.clientX, e.clientY);
  }

  function onUp(e) {
    var wasDrag = drag;
    var wasOrbit = orbiting;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist0 = 0;
    if (pointers.size === 0) {
      drag = null;
      orbiting = false;
    } else if (pointers.size === 1) {
      drag = null;
      orbiting = false;
    }

    if (!wasDrag || wasOrbit) return;
    if (wasDrag.moved <= TAP_MOVE && performance.now() - wasDrag.t < TAP_MS) {
      onTap(wasDrag.sx, wasDrag.sy);
    }
  }

  function onTap(cx, cy) {
    var pick = pickAt(cx, cy);

    /* 编辑模式：点积木选中，点空白取消 */
    if (isEditing()) {
      if (pick.kind === 'brickTop' || pick.kind === 'brickSide') select(pick.brick);
      else deselect();
      return;
    }

    /* 放置模式：点顶面/底板落砖 */
    if (pick.kind === 'boardSide' || pick.kind === 'none') return;
    if (pick.kind === 'brickSide') {
      /* 侧面不好落点，忽略（避免误触） */
      return;
    }
    var t = resolvePlacement(pick);
    if (!t) return;
    var b = addBrick(state.brick, t.x, t.z, t.y, state.rot, state.color);
    if (b) refreshGhost(cx, cy);
    else toast('这里放不下');
  }

  function onWheel(e) {
    e.preventDefault();
    cam.dist = clamp(cam.dist * (1 + e.deltaY * 0.0012), CAM_MIN, CAM_MAX);
    applyCamera();
  }

  var cvs = renderer.domElement;
  cvs.style.touchAction = 'none';
  cvs.addEventListener('pointerdown', onDown);
  cvs.addEventListener('pointermove', onMove);
  cvs.addEventListener('pointerup', onUp);
  cvs.addEventListener('pointercancel', onUp);
  cvs.addEventListener('wheel', onWheel, { passive: false });
  cvs.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  var lastX = 0, lastY = 0;

  /* ==================== 场地扩宽 ==================== */
  function expand(side) {
    var n = { x0: board.x0, x1: board.x1, z0: board.z0, z1: board.z1 };
    /* 每次加 STEP，但要卡住上限，并且能刚好顶到 MAX_SIDE */
    if (side === 'x-') n.x0 = Math.max(n.x0 - STEP, n.x1 - MAX_SIDE);
    else if (side === 'x+') n.x1 = Math.min(n.x1 + STEP, n.x0 + MAX_SIDE);
    else if (side === 'z-') n.z0 = Math.max(n.z0 - STEP, n.z1 - MAX_SIDE);
    else n.z1 = Math.min(n.z1 + STEP, n.z0 + MAX_SIDE);

    if (n.x0 === board.x0 && n.x1 === board.x1 && n.z0 === board.z0 && n.z1 === board.z1) {
      toast('场地上限 ' + MAX_SIDE + ' × ' + MAX_SIDE);
      return;
    }
    board = n;
    rebuildBoard(true);
    syncFieldPanel();
    toast('场地 ' + boardW() + ' × ' + boardD() + '（＋' + STEP + '/边）');
  }

  /* ==================== 尺寸 ==================== */
  /* 底栏高度随内容（零件批次不同）浮动，实测后写进 --dock-h，让选中条精确避让 */
  function syncDockMetrics() {
    var inner = document.querySelector('.dock-inner');
    if (!inner) return;
    var h = Math.ceil(inner.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--dock-h', h + 'px');
  }

  function resize() {
    var w = host.clientWidth || window.innerWidth;
    var h = host.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    fitCamera();
    applyCamera();
    syncFieldPanel();
    syncDockMetrics();
    dirty = true;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

  /* ==================== 渲染循环（按需渲染） ==================== */
  function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }

  function frame() {
    requestAnimationFrame(frame);
    if (anim.length) {
      var now = performance.now();
      for (var i = anim.length - 1; i >= 0; i--) {
        var a = anim[i];
        var p = (now - a.t0) / a.dur;
        if (p >= 1) { layout(a.b, 0); anim.splice(i, 1); }
        else layout(a.b, (1 - easeOutCubic(p)) * 1.1);
      }
    }
    if (dirty || anim.length) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }

  /* ==================== 作品卡 ==================== */
  function roundRect(g, x, y, w, h, r) {
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function buildCard() {
    var gv = ghost.visible, ge = ghostEdge.visible, sv = selBox.visible;
    ghost.visible = ghostEdge.visible = selBox.visible = false;
    renderer.render(scene, camera);
    var src = renderer.domElement;
    ghost.visible = gv;
    ghostEdge.visible = ge;
    selBox.visible = sv;
    dirty = true;

    var W = 1080, H = 1440;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');

    /* 无装饰渐变：作品卡就是一块纯黑 tile，让作品自己说话 */
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, H);
    if ('letterSpacing' in g) g.letterSpacing = '-1px';
    g.fillStyle = '#ffffff';
    g.font = '600 58px -apple-system, "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif';
    g.fillText('我的积木搭建', 72, 126);
    if ('letterSpacing' in g) g.letterSpacing = '-0.4px';
    g.fillStyle = '#cccccc';
    g.font = '400 32px -apple-system, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif';
    g.fillText(boardW() + ' × ' + boardD() + ' 场地 · ' + bricks.length + ' 块砖', 72, 182);

    var maxW = W - 144, maxH = H - 360;
    var r = Math.min(maxW / src.width, maxH / src.height);
    var dw = src.width * r, dh = src.height * r;
    g.save();
    g.beginPath();
    roundRect(g, 72, 230, W - 144, maxH, 18);
    g.clip();
    g.drawImage(src, 72 + (W - 144 - dw) / 2, 230 + (maxH - dh) / 2, dw, dh);
    g.restore();

    g.fillStyle = '#7a7a7a';
    g.font = '400 28px -apple-system, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif';
    g.fillText('积木搭建 · 迷你工具', 72, H - 84);
    return cv;
  }

  function saveImage(dataUrl) {
    var bridge = window.xhs && window.xhs.miniTool;
    var tip = el('shotHint');
    if (bridge && typeof bridge.saveImageToPhotosAlbum === 'function') {
      if (tip) tip.textContent = '保存中…';
      var save = function (filePath) {
        return bridge.saveImageToPhotosAlbum({ filePath: filePath });
      };
      var p = typeof bridge.writeTempFile === 'function'
        ? bridge.writeTempFile({ data: dataUrl }).then(function (res) { return save(res.filePath); })
        : save(dataUrl);
      p.then(function () { if (tip) tip.textContent = '已保存到相册'; })
        .catch(function () { if (tip) tip.textContent = '保存失败，请检查相册权限'; });
      return;
    }
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'jimu-build.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (tip) tip.textContent = '已下载图片';
  }

  /* ==================== UI ==================== */
  function el(id) { return document.getElementById(id); }

  var toastTimer = 0;
  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  function syncSelBar() {
    var b = state.selected;
    var bar = el('selBar');
    if (!b) { bar.hidden = true; return; }
    bar.hidden = false;
    el('selLabel').textContent = b.type.id.replace('x', ' × ') + ' · 第 ' + (b.y + 1) + ' 层';
  }

  function syncFieldPanel() {
    var n = boardW() + ' × ' + boardD();
    var a = el('fieldSize');
    if (a) a.textContent = n;
  }

  function syncStatus() {
    var pill = el('statusPill');
    if (!pill) return;
    if (state.edit) pill.textContent = '编辑模式 · 轻点积木选中 · 滑动转视角';
    else pill.textContent = '放置 ' + state.brick.id + ' · 轻点落砖 · 滑动转视角';
  }

  function setEdit(on) {
    state.edit = !!on;
    el('editBtn').classList.toggle('active', state.edit);
    if (state.edit) {
      hideGhost();
      toast('编辑模式');
    } else {
      deselect();
      toast('放置模式');
      refreshGhost(lastX || window.innerWidth * 0.5, lastY || window.innerHeight * 0.4);
    }
    syncStatus();
  }

  function pickBrick(t) {
    state.brick = t;
    if (state.edit) setEdit(false);
    Array.prototype.forEach.call(el('brickRow').children, function (c) {
      c.classList.toggle('active', c.dataset.brick === t.id);
    });
    syncStatus();
    syncBrickIcons();
    refreshGhost(lastX || window.innerWidth * 0.5, lastY || window.innerHeight * 0.4);
  }

  (function buildDock() {
    var row = el('brickRow');
    BRICKS.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'brick-btn' + (state.brick === t ? ' active' : '');
      btn.dataset.brick = t.id;
      var preview = document.createElement('span');
      preview.className = 'brick-3d';
      var long = Math.max(t.w, t.d);
      /* 预览尺寸 = 凸点数 × 间距：点小一些、边距紧一些，底栏才不占屏幕 */
      var stud = long >= 6 ? 4 : (long >= 4 ? 5 : (long >= 3 ? 6 : 7));
      var gap = 1, pad = 6;
      var bw = t.w * stud + Math.max(0, t.w - 1) * gap + pad;
      var slot = long * stud + Math.max(0, long - 1) * gap + pad + 4;
      preview.style.gridTemplateColumns = 'repeat(' + t.w + ', 1fr)';
      preview.style.width = bw + 'px';
      btn.style.setProperty('--slot', slot + 'px');
      for (var i = 0; i < t.w * t.d; i++) preview.appendChild(document.createElement('i'));
      btn.appendChild(preview);
      btn.addEventListener('click', function () { pickBrick(t); });
      row.appendChild(btn);
    });

    var crow = el('colorRow');
    COLORS.forEach(function (hex) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-btn' + (hex === state.color ? ' active' : '');
      btn.dataset.color = String(hex);
      var sw = document.createElement('i');
      sw.className = 'sw';
      sw.style.background = '#' + hex.toString(16).padStart(6, '0');
      btn.appendChild(sw);
      btn.addEventListener('click', function () {
        state.color = hex;
        Array.prototype.forEach.call(crow.children, function (c) {
          c.classList.toggle('active', c.dataset.color === String(hex));
        });
        if (isPlacing()) refreshGhost(lastX, lastY);
      });
      crow.appendChild(btn);
    });
  })();

  el('editBtn').addEventListener('click', function () {
    setEdit(!state.edit);
  });

  el('rotBtn').addEventListener('click', rotatePlacement);
  el('selRotate').addEventListener('click', rotateSelected);
  el('selDelete').addEventListener('click', function () { removeBrick(state.selected); });
  el('selDeselect').addEventListener('click', deselect);

  syncBrickIcons();
  syncStatus();
  syncHistBtns();

  /* 清空 → 模态确认 */
  el('clearBtn').addEventListener('click', function () {
    if (!bricks.length) { toast('没有积木'); return; }
    el('clearOv').classList.add('show');
  });
  el('clearCancel').addEventListener('click', function () {
    el('clearOv').classList.remove('show');
  });
  el('clearConfirm').addEventListener('click', function () {
    el('clearOv').classList.remove('show');
    clearAll(true);
    toast('已清空');
  });

  el('undoBtn').addEventListener('click', undo);
  el('redoBtn').addEventListener('click', redo);

  /* 场地 → 模态 */
  el('fieldBtn').addEventListener('click', function () {
    syncFieldPanel();
    el('fieldOv').classList.add('show');
    el('fieldBtn').classList.add('active');
  });
  el('fieldClose').addEventListener('click', function () {
    el('fieldOv').classList.remove('show');
    el('fieldBtn').classList.remove('active');
  });
  /* 点 sheet 外的遮罩 = 关闭（sheet 的常规手势） */
  el('fieldOv').addEventListener('click', function (e) {
    if (e.target === el('fieldOv')) el('fieldClose').click();
  });
  el('expNegX').addEventListener('click', function () { expand('x-'); });
  el('expPosX').addEventListener('click', function () { expand('x+'); });
  el('expNegZ').addEventListener('click', function () { expand('z-'); });
  el('expPosZ').addEventListener('click', function () { expand('z+'); });

  el('shotBtn').addEventListener('click', function () {
    el('shotImg').src = buildCard().toDataURL('image/png');
    el('shotHint').textContent = '';
    el('shotOv').classList.add('show');
  });
  el('shotSave').addEventListener('click', function () { saveImage(el('shotImg').src); });
  el('shotClose').addEventListener('click', function () { el('shotOv').classList.remove('show'); });

  el('startBtn').addEventListener('click', function () {
    el('startOv').classList.remove('show');
    resize();
  });

  /* ==================== 启动 ==================== */
  rebuildBoard(true);
  resize();
  syncDockMetrics();
  syncSelBar();
  requestAnimationFrame(frame);

  /* 调试入口 */
  window.__jimu = {
    state: state,
    bricks: bricks,
    add: addBrick,
    remove: removeBrick,
    select: select,
    rotate: rotateSelected,
    rotatePlacement: rotatePlacement,
    expand: expand,
    clear: clearAll,
    undo: undo,
    redo: redo,
    setEdit: setEdit,
    card: buildCard,
    camera: camera,
    renderer: renderer,
    pickAt: pickAt,
    cam: cam,
    look: look,
    scene: scene,
    board: function () { return { x0: board.x0, x1: board.x1, z0: board.z0, z1: board.z1 }; },
    canPlace: canPlace,
    foot: foot,
    TOP: function (y) { return (y + 1) * BRICK_H; },
    K: { BRICK_H: BRICK_H, SEAM: SEAM, BODY_H: BODY_H, STUD_Y: STUD_Y, STUD_H: STUD_H, BOARD_TOP: BOARD_TOP, BASE_STUD_Y: BASE_STUD_Y }
  };
})();
