import { cutPuzzle, loadImage, MAX_DIM, MAX_TOTAL, SOFT_TOTAL, buildJigsawShape, suggestGrid, getPieceThumb, getPieceThumbHi, getPieceFrame, hitTestPiece, rotatedShapeKey, cropRect, thumbBodyMetrics, tracePieceAt, buildTabMap, tabsFor } from './puzzle.js?v=20260928-1';
import { celebrate } from './confetti.js?v=20260927-53';
const THREE = window.THREE;
if (!THREE) throw new Error('Three.js 未加载');

/** 已放置拼块统一高度：整幅必须在同一平面，缝宽才会均匀 */
const PLACED_Y = 0.02;

/**
 * 托盘拼块按钮边长（CSS 像素）。单一来源是 style.css :root 的 --thumb，
 * 这里启动时读一次，避免 CSS 与 JS 两处尺寸手改走偏。
 */
function readCssPx(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const THUMB_PX = readCssPx('--thumb', 58);
/** 缩略图相对按钮内容区的外溢量，见 style.css --thumb-bleed */
const THUMB_BLEED = readCssPx('--thumb-bleed', 0);
/** 按钮边框 1px + 内边距 1px：内容区相对按钮左上角的偏移 */
const THUMB_INSET = 2;

/** 轮廓离散份数：几何与缝线共用同一条折线，份数越高弧线越顺 */
function knobSamples(size) {
  const n = size?.total || 0;
  if (n > 400) return 6;
  if (n > 150) return 10;
  if (n > 60) return 16;
  return 32;
}

/**
 * 放大时提高渲染分辨率。几何边缘在低分辨率下必然有 1px 台阶，
 * 视图放大后台阶会被一起放大，看起来就是锯齿；用超采样把它压掉。
 */
function applyPixelRatio() {
  const { renderer } = state;
  if (!renderer) return;
  const dpr = window.devicePixelRatio || 1;
  const boost = Math.min(3, Math.max(1, state.zoom));
  const cap = (puzzle?._size?.total || 0) > 400 ? 2 : 3;
  // 量化到 0.25 档，避免缩放时频繁重建 drawing buffer
  const ratio = Math.round(Math.min(dpr * boost, cap) * 4) / 4;
  if (Math.abs(ratio - (state.pixelRatio || 0)) < 0.01) return;
  state.pixelRatio = ratio;
  renderer.setPixelRatio(ratio); // 内部会按当前 size 重建 drawing buffer
}

const els = {
  file: document.getElementById('fileInput'),
  cols: document.getElementById('colsInput'),
  rows: document.getElementById('rowsInput'),
  colsLabel: document.getElementById('colsLabel'),
  rowsLabel: document.getElementById('rowsLabel'),
  colsMinus: document.getElementById('colsMinus'),
  colsPlus: document.getElementById('colsPlus'),
  rowsMinus: document.getElementById('rowsMinus'),
  rowsPlus: document.getElementById('rowsPlus'),
  applyGrid: document.getElementById('applyGridBtn'),
  gridSummary: document.getElementById('gridSummary'),
  cropFrame: document.getElementById('cropFrame'),
  cropImg: document.getElementById('cropImg'),
  cropGrid: document.getElementById('cropGrid'),
  scatter: document.getElementById('scatterBtn'),
  solve: document.getElementById('solveBtn'),
  rotate: document.getElementById('rotateBtn'),
  hintBtn: document.getElementById('hintBtn'),
  hint: document.getElementById('statusHint'),
  tray: document.getElementById('tray'),
  trayCount: document.getElementById('trayCount'),
  trayMode: document.getElementById('trayModeBtn'),
  viewport: document.getElementById('viewport'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsSheet: document.getElementById('settingsSheet'),
  settingsClose: document.getElementById('settingsClose'),
  settingsScrim: document.getElementById('settingsScrim'),
  restart: document.getElementById('restartBtn'),
  restartConfirm: document.getElementById('restartConfirm'),
  restartDesc: document.getElementById('restartDesc'),
  restartOk: document.getElementById('restartOk'),
  restartCancel: document.getElementById('restartCancel'),
  restartCancelScrim: document.getElementById('restartCancelScrim'),
  saveBtn: document.getElementById('saveBtn'),
  shareBtn: document.getElementById('shareBtn'),
};

let sourceImage = null;
let puzzle = null;
let selectedId = null;
let rotating = false;

const state = {
  renderer: null,
  scene: null,
  camera: null,
  root: null,
  board: null,
  pileGroup: null,
  pieceMeshes: new Map(),
  slotMeshes: [],
  outline: null,
  completedImage: null,
  boardBase: null,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  lights: null,
  keyLight: null,
  pan: { x: 0, z: 0 },
  zoom: 1,
  pixelRatio: 0, // 当前实际渲染倍率（放大时超采样）
  viewDist: 0, // 最近一次取景的相机距离（用于拖动换算）
  topView: false, // 相机俯角：false = 34° 斜视看厚度，true = 正上方 90°
  trayMode: 'list', // 底部待选显示：list = 横排列表，stack = 叠成一沓
  trayOrder: [], // 待选拼块的显示顺序（打散后重排）
  traySeed: 0, // 叠放布局的随机种子（打散时重掷，位置/倾角/大小整套换）
  trayEnterFrom: null, // 从底盘收回托盘的块：起飞点用它在 3D 里的屏幕投影
  hintGroup: null, // 底盘上的空槽提示（L1 候选 / L2 正解）
  hintOn: false, // 提示开关：开着时选中哪块就标出它原本的槽位
  startAt: 0, // 本局开始时间（生成 / 重来时重置），用于成品图上的用时
  doneKind: null, // 完成方式：'win' 亲手拼完 / 'reveal' 一键揭晓；未完成为 null
};

/** 取景范围：拼图本体（待选拼块已在底部托盘，不再进 3D 场景） */
function viewSize() {
  const size = puzzle?._size;
  if (!size) return { w: 12, h: 12 };
  return { w: size.w, h: size.h };
}

/**
 * 主光与阴影相机跟随场景：光源沿固定方向摆在场景中心上方，
 * 正交范围刚好框住场景，纹素密度才够（否则大拼图的层叠投影会糊掉）。
 */
function fitShadowCamera(size) {
  const key = state.keyLight;
  if (!key || !size) return;
  const vs = viewSize();
  const centerX = scenePan(size).x;
  // 左上方来光：圆边浮雕左上亮、右下暗，投影落在右下，与托盘缩略图同一光向
  const dir = new THREE.Vector3(-5, 8, -4).normalize();
  const reach = Math.max(vs.w, vs.h) * 0.75 + size.cell * 2;
  key.position.set(centerX + dir.x * reach * 1.6, dir.y * reach * 1.6 + 2, dir.z * reach * 1.6);
  key.target.position.set(centerX, 0, 0);
  key.target.updateMatrixWorld();
  const r = Math.max(vs.w, vs.h) * 0.62 + size.cell * 1.5;
  const cam = key.shadow.camera;
  cam.left = -r;
  cam.right = r;
  cam.top = r;
  cam.bottom = -r;
  cam.near = 0.5;
  cam.far = reach * 6;
  cam.updateProjectionMatrix();
}

/** 场景中心即底盘中心 */
function scenePan() {
  return { x: 0, z: 0 };
}

/** 透视相机：34° 斜视看厚度，90° 正上方俯瞰；横竖都框住拼图本体 */
function fitCamera() {
  applyPixelRatio();
  const { camera, pan, zoom, renderer } = state;
  const el = renderer?.domElement;
  const aspect = el && el.clientWidth ? el.clientWidth / el.clientHeight : 1;
  camera.aspect = aspect;
  const vFov = (camera.fov * Math.PI) / 180;
  const tan = Math.tan(vFov / 2) || 0.3;
  const vs = viewSize();
  // 留白只够放下底板倒角和投影：再大拼版就离底部拼块栏太远
  const margin = 1.03;
  const pad = 0.15;
  // 横竖两个方向都要框住，取较大的距离
  const distV = (vs.h * margin * 0.5 + pad) / tan;
  const distH = (vs.w * margin * 0.5 + pad) / (tan * aspect);
  const dist = Math.max(distV, distH) / zoom;
  state.viewDist = dist;
  const tilt = (state.topView ? 90 : 34) * (Math.PI / 180);
  camera.position.set(
    pan.x,
    dist * Math.sin(tilt) + (state.topView ? 0 : 0.4),
    pan.z + dist * Math.cos(tilt)
  );
  camera.up.set(0, 0, -1);
  camera.lookAt(pan.x, 0, pan.z);
  camera.near = Math.max(0.2, dist * 0.02);
  camera.far = dist * 6;
  camera.updateProjectionMatrix();
}

let hintTimer = 0;
function setHint(text) {
  if (!els.hint) return;
  els.hint.textContent = text;
  els.hint.classList.toggle('is-show', !!text);
  clearTimeout(hintTimer);
  if (text) hintTimer = setTimeout(() => els.hint.classList.remove('is-show'), 2400);
}


/** 透视相机下每像素对应的世界距离（用于拖动/缩放换算） */
function dragScale() {
  const el = els.viewport;
  if (!el || !el.clientHeight || !state.viewDist) return 0.02;
  const tan = Math.tan(((state.camera?.fov || 38) * Math.PI) / 180 / 2) || 0.3;
  const visibleH = 2 * state.viewDist * tan;
  return visibleH / el.clientHeight;
}

function clampInputs() {
  let cols = Math.round(Number(els.cols.value) || 2);
  let rows = Math.round(Number(els.rows.value) || 2);
  cols = Math.min(MAX_DIM, Math.max(2, cols));
  rows = Math.min(MAX_DIM, Math.max(2, rows));
  if (cols * rows > MAX_TOTAL) {
    const s = Math.sqrt(MAX_TOTAL / (cols * rows));
    cols = Math.max(2, Math.floor(cols * s));
    rows = Math.max(2, Math.floor(rows * s));
    while (cols * rows > MAX_TOTAL) {
      if (cols >= rows) cols--;
      else rows--;
    }
  }
  els.cols.value = cols;
  els.rows.value = rows;
  return { cols, rows };
}

function initScene() {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  state.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.shadowMap.enabled = true;
  // VSM 支持 radius/blurSamples 真正把阴影边缘糊开；
  // PCFSoft 的半径参数是无效的，阴影边缘会一直很"硬"
  renderer.shadowMap.type = THREE.VSMShadowMap;
  if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
  // 关掉 ACES 胶片曲线：它会把接近白色的浅粉压成灰紫（实测 #fff4f7 的棋盘格
  // 被压到 rgb(200,183,186)，和糖果色界面完全脱节）。直出颜色才是"贴纸感"的可爱。
  renderer.toneMapping = THREE.NoToneMapping;
  // 画布透明：3D 背景直接透出 CSS 的暖白渐变，和 UI 配色完全一致
  // （若用不透明背景色，ACES 色调映射会把暖白压成偏冷的中灰，与界面割裂）
  renderer.setClearColor(0x000000, 0);
  els.viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  const root = new THREE.Group();
  scene.add(root);

  // 关掉色调映射后光强要重配：目标是"白色纸面 ≈ 0.95 白"，
  // 这样浅粉台面就按原色直出，而不是被压成灰紫
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe6e4f5, 1.35);
  scene.add(hemi);
  // 环境光托底：没有它的时候，拼块之间的窄缝和背光侧壁会直接掉到纯黑，
  // 看起来像用黑笔描出来的硬边。有这一层"永远亮着"的补光，缝里是柔和的梅紫。
  const ambient = new THREE.AmbientLight(0xf2f0ff, 0.48);
  scene.add(ambient);
  // 低角度主光：擦过拼块侧壁，产生明显明暗与浮雕感
  const key = new THREE.DirectionalLight(0xfff7f2, 1.32);
  key.position.set(-5, 8, -4);
  key.castShadow = true;
  // VSM 会把阴影图再模糊两遍，分辨率不必给太高（模糊本身会补掉锯齿）；
  // 3072² 在手机上光是阴影 pass 就够呛，2048² 视觉上看不出差别
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  // 只有 VSM 认这两个参数：radius 是模糊半径，blurSamples 是采样数
  key.shadow.radius = 14;
  key.shadow.blurSamples = 12;
  scene.add(key);
  scene.add(key.target); // 目标点要进场景图，矩阵才会更新
  state.keyLight = key;
  // 补光偏冷会把浅色纸面拉蓝，这里换成中性偏暖的弱光
  const fill = new THREE.DirectionalLight(0xe9ecff, 0.4);
  fill.position.set(-7, 5, -5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd9ab, 0.52);
  rim.position.set(-2, 4, 9);
  scene.add(rim);

  const board = new THREE.Group();
  const pileGroup = new THREE.Group();
  root.add(board);
  root.add(pileGroup);

  state.renderer = renderer;
  state.scene = scene;
  state.camera = camera;
  state.root = root;
  state.board = board;
  state.pileGroup = pileGroup;
  state.lights = { key, hemi, fill, ambient };

  bindViewControls(renderer.domElement);
  bindPick(renderer.domElement);
  resize();
  window.addEventListener('resize', resize);
  animate();
}

function resize() {
  const { renderer, camera } = state;
  const w = els.viewport.clientWidth;
  const h = els.viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  fitCamera();
  // 叠放位置是按托盘可视尺寸算的，尺寸变了要重排（否则会跑出可视范围）
  scheduleTrayRelayout();
}

/** 尺寸变化后重排托盘（叠放模式），略微延迟以合并连续 resize */
let trayRelayoutTimer = 0;
function scheduleTrayRelayout() {
  if (state.trayMode !== 'stack' || !puzzle) return;
  clearTimeout(trayRelayoutTimer);
  trayRelayoutTimer = setTimeout(() => renderTray(), 120);
}

/** 极简补间：位置 + 偏航，带缓动与可选抛物弧线（打散动画用） */
const tweens = [];

function clearTweens() {
  tweens.length = 0;
}

function tweenMesh(mesh, to, { dur = 520, delay = 0, hop = 0, toYaw = null } = {}) {
  const now = performance.now();
  const from = mesh.position.clone();
  tweens.push({
    mesh,
    from,
    to: to.clone(),
    fromYaw: mesh.rotation.y,
    toYaw: toYaw == null ? mesh.rotation.y : toYaw,
    t0: now + delay,
    dur,
    hop,
  });
}

function updateTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (now < tw.t0) continue;
    let t = (now - tw.t0) / tw.dur;
    if (t > 1) t = 1;
    // easeInOutCubic
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const m = tw.mesh;
    m.position.set(
      tw.from.x + (tw.to.x - tw.from.x) * e,
      tw.from.y + (tw.to.y - tw.from.y) * e,
      tw.from.z + (tw.to.z - tw.from.z) * e
    );
    if (tw.hop) m.position.y += Math.sin(Math.PI * t) * tw.hop;
    m.rotation.y = tw.fromYaw + (tw.toYaw - tw.fromYaw) * e;
    if (t === 1) {
      m.position.copy(tw.to);
      if (tw.toYaw != null) m.rotation.y = tw.toYaw;
      tweens.splice(i, 1);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  updateTweens(performance.now());
  state.renderer.render(state.scene, state.camera);
}

function bindViewControls(el) {
  const pointers = new Map();
  let mode = null; // pan | pinch
  let last = null;
  let pinchDist = 0;

  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  el.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      mode = 'pinch';
      const [a, b] = [...pointers.values()];
      pinchDist = dist(a, b);
      last = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    } else if (pointers.size === 1 && (e.button === 0 || e.pointerType === 'touch')) {
      // 单击留给选块；拖动超过阈值再平移
      mode = 'maybe-pan';
      last = { x: e.clientX, y: e.clientY };
    }
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ }
  });

  el.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);
    if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = dist(a, b);
      if (pinchDist > 0) {
        state.zoom = Math.min(3.2, Math.max(0.45, state.zoom * (d / pinchDist)));
        pinchDist = d;
      }
      const mx = (a.clientX + b.clientX) / 2;
      const my = (a.clientY + b.clientY) / 2;
      if (last) {
        const scale = dragScale();
        state.pan.x -= (mx - last.x) * scale;
        state.pan.z -= (my - last.y) * scale;
      }
      last = { x: mx, y: my };
      fitCamera();
      return;
    }
    if ((mode === 'maybe-pan' || mode === 'pan') && last) {
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (mode === 'maybe-pan' && Math.hypot(dx, dy) > 10) mode = 'pan';
      if (mode === 'pan') {
        const scale = dragScale();
        state.pan.x -= dx * scale;
        state.pan.z -= dy * scale;
        last = { x: e.clientX, y: e.clientY };
        fitCamera();
      }
    }
  });

  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2 && mode === 'pinch') mode = null;
    if (pointers.size === 0) mode = null;
    last = null;
    try { el.releasePointerCapture(e.pointerId); } catch (_) { /* */ }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.zoom = Math.min(3.2, Math.max(0.45, state.zoom * Math.exp(-e.deltaY * 0.0012)));
    fitCamera();
  }, { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

function clearSceneContent() {
  clearOutline();
  clearTweens();
  state.matPlate = null;
  state.hintGroup = null; // 跟随 board 一起被清掉（hint level 由各流程各自重置）
  if (state.completedImage) {
    disposeMesh(state.completedImage);
    state.completedImage = null;
  }
  for (const mesh of state.pieceMeshes.values()) disposeMesh(mesh);
  state.pieceMeshes.clear();
  for (const m of state.slotMeshes) disposeMesh(m);
  state.slotMeshes = [];
  while (state.board.children.length) {
    const ch = state.board.children.pop();
    disposeMesh(ch);
  }
  while (state.pileGroup.children.length) {
    const ch = state.pileGroup.children.pop();
    disposeMesh(ch);
  }
}

function disposeMesh(obj) {
  if (!obj) return;
  obj.traverse?.((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) {
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        if (m.normalMap) m.normalMap.dispose();
        m.dispose();
      }
    }
  });
  if (obj.parent) obj.parent.remove(obj);
}

function boardSize(puzzleData) {
  const base = Math.min(9.2, 2.2 + Math.sqrt(puzzleData.cols * puzzleData.rows) * 0.3);
  const cell = base / Math.max(puzzleData.cols, puzzleData.rows);
  const w = puzzleData.cols * cell;
  const h = puzzleData.rows * cell;
  const tab = cell * puzzleData.tabRatio;
  // 真实纸板：成品厚度 ≈ 边长的 10%，模切是硬边（刃口不圆），只留一丝刀缝
  const thick = Math.max(0.03, Math.min(0.12, cell * 0.1));
  // 模切刀缝：宽度严格等于 kerf，与轮廓角度无关，缝宽处处一致
  const kerf = Math.max(cell * 0.005, 0.0016);
  // 不做倒角：ExtrudeGeometry 的倒角沿顶点角平分线偏移，弧度越尖偏移越大，
  // 会让轮廓在弧线上忽进忽出，在 1px 宽的刀缝里看起来就是锯齿。
  const fitCell = cell - kerf; // 拼块轮廓边长 = 孔径 - 刀缝
  return {
    w,
    h,
    cell,
    cellW: cell,
    cellH: cell,
    tab,
    depth: thick,
    kerf,
    fitCell,
    holeCell: cell - kerf,
    top: thick, // rotateX(-π/2) 后网格原点在底面，印刷顶面在 y = depth
  };
}

function slotWorldPos(r, c, size) {
  const x = -size.w / 2 + (c + 0.5) * size.cell;
  const z = -size.h / 2 + (r + 0.5) * size.cell;
  return new THREE.Vector3(x, 0, z);
}

/** 顶面 UV：限制在当前拼块主体范围内，避免凸起采样到邻块 */
function mapLidUVs(geometry, texHalf, cellHalf) {
  const uv = geometry.attributes.uv;
  const pos = geometry.attributes.position;
  const span = texHalf * 2;
  for (let i = 0; i < uv.count; i++) {
    const x = Math.max(-cellHalf, Math.min(cellHalf, pos.getX(i)));
    const y = Math.max(-cellHalf, Math.min(cellHalf, pos.getY(i)));
    const u = (x + texHalf) / span;
    // shape y↑ 对应 canvas y↓
    const v = 1 - (texHalf - y) / span;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

/**
 * 3D 拼块顶面 UV 直接用源图坐标（不夹取）。
 * 拼块的凸起会取到源图对应位置的真实颜色，符合真实拼图被切开的效果，
 * 拼合后整幅图像严格连续。
 */
function mapGlobalLidUVs(geometry, piece, cell, cols, rows) {
  const uv = geometry.attributes.uv;
  const pos = geometry.attributes.position;
  const half = cell / 2;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = (piece.c + (x + half) / cell) / cols;
    const v = 1 - (piece.r + (half - y) / cell) / rows;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

/**
 * 按面法线把挤出体分成三层，让底面也变成纸板而不是印刷图：
 * 组 0 顶面印刷层 / 组 1 侧壁纸板 / 组 2 背面纸板。
 * ExtrudeGeometry 是无索引几何，所以按三角形重排各属性，再按组写 materialIndex。
 */
function splitPieceFaces(geometry) {
  const pos = geometry.attributes.position;
  const triCount = Math.floor(pos.count / 3);
  const top = [];
  const side = [];
  const bottom = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const i = t * 3;
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1).sub(a);
    c.fromBufferAttribute(pos, i + 2).sub(a);
    n.crossVectors(b, c).normalize();
    // 阈值放宽到 0.5：顶面 45° 圆边也归入印刷层，贴图不断开
    if (n.y > 0.5) top.push(t);
    else if (n.y < -0.5) bottom.push(t);
    else side.push(t);
  }
  const order = top.concat(side, bottom);
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name];
    const item = attr.itemSize;
    const src = attr.array;
    const out = new Float32Array(src.length);
    let k = 0;
    for (const t of order) {
      const from = t * 3 * item;
      for (let j = 0; j < 3 * item; j++) out[k++] = src[from + j];
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(out, item, attr.normalized));
  }
  geometry.clearGroups();
  const tri = (n) => n * 3;
  if (top.length) geometry.addGroup(0, tri(top.length), 0);
  if (side.length) geometry.addGroup(tri(top.length), tri(side.length), 1);
  if (bottom.length) geometry.addGroup(tri(top.length + side.length), tri(bottom.length), 2);
}

function addShapeOutline(parent, shape, y, color, opacity = 0.7, opts = {}) {
  const seg = opts.segments ?? 36;
  const pts = shape.getPoints(seg);
  if (!pts.length) return null;
  const pos = [];
  for (let i = 0; i < pts.length; i++) {
    pos.push(pts[i].x, y, -pts[i].y);
  }
  pos.push(pts[0].x, y, -pts[0].y);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: color ?? 0xc8b89a,
    transparent: opacity < 1,
    opacity,
    depthTest: opts.depthTest !== false,
    depthWrite: false,
  });
  if (opts.polygonOffset) {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = opts.polygonOffsetFactor ?? -4;
    mat.polygonOffsetUnits = opts.polygonOffsetUnits ?? -4;
  }
  const line = new THREE.Line(geo, mat);
  line.renderOrder = opts.renderOrder ?? 6;
  line.frustumCulled = false;
  parent.add(line);
  return line;
}

/** 拼块顶面缝边（随块旋转，拼好后显示） */
function attachPieceSeam(mesh, shape, size) {
  const y = (size.top ?? size.depth) + 0.0015;
  const g = new THREE.Group();
  // 柔和梅紫细线：浅色纸面上不能像刀刻一样黑，
  // 半透明的一条暖灰缝才像"贴纸压边"，和糖果色不打架
  // 不做深度测试：缝线只比顶面高 0.0015，远处深度精度不够，直边上的线会被相邻块
  // 的顶面/侧壁"吃掉"，只剩一条白缝；曲线段却还能露出来，看起来就一处白一处紫
  addShapeOutline(g, shape, y, 0x5b5470, 0.5, {
    depthTest: false,
    renderOrder: 5,
    segments: 48,
  });
  g.visible = false;
  mesh.add(g);
  mesh.userData.seamLine = g;
}

function setPieceSeamVisible(mesh, show) {
  if (mesh?.userData.seamLine) mesh.userData.seamLine.visible = show;
}

function syncBoardSeams(forceAll = false) {
  if (!state.seamRoot || !puzzle) return;
  for (const g of state.seamRoot.children) {
    if (forceAll) {
      g.visible = true;
      continue;
    }
    const id = g.userData.pieceId;
    const piece = puzzle.pieces[id];
    g.visible = !!(piece && !piece.placed);
  }
}

/** 程序化纸面纹理：细密布纹 + 颗粒，作为 bump 让印刷面有纸感 */
let paperBump = null;
function getPaperBump() {
  if (paperBump) return paperBump;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0, i = 0; y < size; y++) {
    for (let x = 0; x < size; x++, i += 4) {
      // 纤维布纹（细密交叉）+ 纸浆颗粒
      const linen = Math.sin(x * 1.7) * 3 + Math.sin(y * 1.7) * 3;
      const grain = (Math.random() - 0.5) * 24;
      const n = 172 + linen + grain;
      img.data[i] = n;
      img.data[i + 1] = n;
      img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  paperBump = new THREE.CanvasTexture(c);
  paperBump.wrapS = THREE.RepeatWrapping;
  paperBump.wrapT = THREE.RepeatWrapping;
  paperBump.repeat.set(6, 6);
  paperBump.needsUpdate = true;
  return paperBump;
}

/**
 * 素面台面纹理：一层暖白，加一点点自上而下的渐变，
 * 避免整块纯色在浅底上糊成一片。
 * UV 按 0..1 铺满整个板面（BoxGeometry 的顶面 / PlaneGeometry 都是 0..1），
 * 所以用 ClampToEdge，不做重复平铺 —— 大面积重复图案会显得很吵。
 */
function makeMatTexture() {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, n);
  g.addColorStop(0, '#fbf8f2');
  g.addColorStop(0.55, '#f5f0e7');
  g.addColorStop(1, '#ece5d8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, state.renderer?.capabilities?.getMaxAnisotropy?.() || 1);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 拼图底板：圆角、带一圈细倒角的厚板，顶面暖米色渐变，侧面稍深的原木色。
 * 直角 Box 的硬边在深色背景上很生硬，圆角 + 倒角高光才像一块精致的板子。
 * 几何的顶面位于 y=0，向下延伸 0.1。
 */
function makeMatPanel(w, h) {
  const r = Math.min(w, h) * 0.035;
  const x0 = -w / 2;
  const y0 = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x0 + r, y0);
  shape.lineTo(x0 + w - r, y0);
  shape.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  shape.lineTo(x0 + w, y0 + h - r);
  shape.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  shape.lineTo(x0 + r, y0 + h);
  shape.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  shape.lineTo(x0, y0 + r);
  shape.quadraticCurveTo(x0, y0, x0 + r, y0);
  const bevel = Math.min(0.02, r * 0.5);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1 - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  // 形状在 XY 平面、沿 +Z 挤出；转成顶面朝上，并让顶面（含倒角）落在 y=0
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -(0.1 - bevel), 0);
  const map = makeMatTexture();
  // 顶面 UV 就是形状坐标，换算回 0..1 才能铺满渐变
  map.repeat.set(1 / w, 1 / h);
  map.offset.set(0.5, 0.5);
  const top = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
  const side = new THREE.MeshStandardMaterial({ color: 0xcdbfa9, roughness: 0.8, metalness: 0 });
  // ExtrudeGeometry 分组：0 顶/底面，1 侧壁与倒角
  const m = new THREE.Mesh(geo, [top, side]);
  m.receiveShadow = true;
  m.castShadow = true;
  return { mesh: m, top, side };
}

/**
 * 拼块顶面的圆边浮雕：沿每块真实轮廓烘一张全局法线图，外加边缘压暗的印刷图。
 * 几何倒角会让刀缝忽宽忽窄，所以圆边只做在贴图里；贴图与顶面共用全局 UV，
 * 打散、旋转、放入槽位后高光都跟着块走。
 */
function bakePieceRelief(pz) {
  if (pz._relief) return pz._relief;
  const src = pz.sourceCanvas;
  const k = Math.min(1, 2048 / Math.max(src.width, src.height));
  const W = Math.round(src.width * k);
  const H = Math.round(src.height * k);
  const s = pz.pieces[0].cellPx * k;
  const B = Math.max(3, s * 0.09); // 圆边宽度（像素）

  const outline = new Path2D();
  for (const p of pz.pieces) tracePieceAt(outline, p.r, p.c, s, p.tabs);

  // 高度场：轮廓处 0，向内按四分之一圆弧升到 1。
  // darken 取最小值，N 条由宽到窄的描边叠出等距分层，相邻块共用的边描两遍也不影响
  const hc = document.createElement('canvas');
  hc.width = W;
  hc.height = H;
  const hctx = hc.getContext('2d', { willReadFrequently: true });
  hctx.fillStyle = '#fff';
  hctx.fillRect(0, 0, W, H);
  hctx.globalCompositeOperation = 'darken';
  hctx.lineJoin = 'round';
  const N = 14;
  for (let i = N; i >= 1; i--) {
    const x = (i - 0.5) / N;
    const g = Math.round(255 * Math.sqrt(1 - (1 - x) * (1 - x)));
    hctx.strokeStyle = `rgb(${g},${g},${g})`;
    hctx.lineWidth = (2 * B * i) / N;
    hctx.stroke(outline);
  }
  const hd = hctx.getImageData(0, 0, W, H).data;

  const nc = document.createElement('canvas');
  nc.width = W;
  nc.height = H;
  const nctx = nc.getContext('2d');
  const nimg = nctx.createImageData(W, H);
  const sc = document.createElement('canvas');
  sc.width = W;
  sc.height = H;
  const sctx = sc.getContext('2d');
  const simg = sctx.createImageData(W, H);
  const nd = nimg.data;
  const sd = simg.data;
  const S = B * 0.25;
  const h = (x, y) => hd[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i += 4) {
      // 贴图 flipY：画布向下 = 切线空间 -Y
      let nx = -(h(x + 1, y) - h(x - 1, y)) * S + (Math.random() - 0.5) * 0.05;
      let ny = (h(x, y + 1) - h(x, y - 1)) * S + (Math.random() - 0.5) * 0.05;
      const len = Math.hypot(nx, ny, 1);
      nd[i] = ((nx / len) * 0.5 + 0.5) * 255;
      nd[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      nd[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      nd[i + 3] = 255;
      const ao = 255 * (0.8 + 0.2 * hd[i] / 255);
      sd[i] = ao;
      sd[i + 1] = ao;
      sd[i + 2] = ao;
      sd[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  sctx.putImageData(simg, 0, 0);

  const color = document.createElement('canvas');
  color.width = src.width;
  color.height = src.height;
  const cctx = color.getContext('2d', { alpha: false });
  cctx.drawImage(src, 0, 0);
  cctx.globalCompositeOperation = 'multiply';
  cctx.drawImage(sc, 0, 0, src.width, src.height);

  pz._relief = { color, normal: nc };
  return pz._relief;
}

/**
 * 所有拼块共用一张源图纹理和同一组材质：每块各建一张整图纹理的话，
 * 块从托盘同时变可见（如「拼好」）时要在一帧里上传 N 张大图，会明显卡顿。
 */
let pieceMatCache = null;
function getPieceMaterials(many) {
  if (pieceMatCache && pieceMatCache.puzzle === puzzle && pieceMatCache.many === many) {
    return pieceMatCache.mats;
  }
  const relief = bakePieceRelief(puzzle);
  const anisotropy = Math.min(8, state.renderer.capabilities.getMaxAnisotropy());
  const tex = new THREE.CanvasTexture(relief.color);
  if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = true;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  const normalTex = new THREE.CanvasTexture(relief.normal);
  normalTex.flipY = true;
  normalTex.anisotropy = anisotropy;
  normalTex.needsUpdate = true;

  const bump = getPaperBump();
  // 印刷面：哑光纸 + 极薄涂层；法线图给出圆边浮雕（纸纹也烘在里面，bumpMap 会被它覆盖）
  const topMat = many
    ? new THREE.MeshStandardMaterial({
        map: tex,
        normalMap: normalTex,
        roughness: 0.46,
        metalness: 0,
      })
    : new THREE.MeshPhysicalMaterial({
        map: tex,
        normalMap: normalTex,
        roughness: 0.46,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.5,
        clearcoatNormalMap: normalTex,
        sheen: 0.35,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(0xfffaf2),
      });
  // 纸板芯：模切断面与背面，奶油纸板、无光泽
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xefe6d8,
    bumpMap: bump,
    bumpScale: 0.005,
    roughness: 0.92,
    metalness: 0,
  });
  // splitPieceFaces 分组：0 顶面印刷 / 1 侧壁纸板 / 2 背面纸板
  const mats = [topMat, coreMat, coreMat];
  pieceMatCache = { puzzle, many, mats, tex, normalTex };
  return mats;
}

/** 生成后提前把共享纹理传到 GPU、把拼块着色器编译好，避免第一次全部显示时卡一下 */
function warmPieceMaterials() {
  const r = state.renderer;
  if (!r || !pieceMatCache) return;
  try {
    r.initTexture?.(pieceMatCache.tex);
    r.initTexture?.(pieceMatCache.normalTex);
    const hidden = [];
    state.pieceMeshes.forEach((m) => {
      if (!m.visible) { m.visible = true; hidden.push(m); }
    });
    r.compile(state.scene, state.camera);
    hidden.forEach((m) => { m.visible = false; });
  } catch (_) { /* 预热失败不影响功能 */ }
}

function createPieceMesh(piece, size) {
  const many = (size.total || 0) > 120;
  const { shape } = buildJigsawShape(size.fitCell || size.cell, piece.tabs, knobSamples(size));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: size.depth,
    bevelEnabled: false, // 硬边模切：轮廓 = 孔径 - 刀缝，缝宽与角度无关
    curveSegments: many ? 14 : 24,
  });
  mapGlobalLidUVs(geometry, piece, size.cell, puzzle.cols, puzzle.rows);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  splitPieceFaces(geometry);

  const mesh = new THREE.Mesh(geometry, getPieceMaterials(many));
  // 投影让拼块看起来是立体的；块数太多时关掉，避免阴影 pass 拖慢
  mesh.castShadow = (size.total || 0) <= 250;
  mesh.receiveShadow = (size.total || 0) <= 250;
  mesh.userData.pieceId = piece.id;
  mesh.userData.kind = 'piece';
  mesh.renderOrder = 2;
  attachPieceSeam(mesh, shape, size);
  return mesh;
}

function createSlotMesh(pieceLike, size) {
  const { shape } = buildJigsawShape((size.holeCell || size.cell) * 0.995, pieceLike.tabs, knobSamples(size));
  const geo = new THREE.ShapeGeometry(shape, 20);
  geo.rotateX(-Math.PI / 2);
  // 空槽：半透明浅灰，棋盘格能透出来，只在格上叠一点点凹陷感；
  // 每个槽位仍保留为可点选的射线目标
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9d93b0,
    roughness: 0.98,
    metalness: 0,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;

  mesh.userData.kind = 'slot';
  mesh.userData.r = pieceLike.r;
  mesh.userData.c = pieceLike.c;
  mesh.userData.shapeKey = pieceLike.shapeKey;
  mesh.userData.occupiedBy = null;
  // 记下原始材质参数，提示高亮可以随时还原
  mesh.userData.base = { color: mat.color.getHex(), opacity: mat.opacity };
  mesh.renderOrder = 0;
  const p = slotWorldPos(pieceLike.r, pieceLike.c, size);
  // 贴着底板顶面（= 拼块底面）铺一层暗色孔位
  mesh.position.set(p.x, PLACED_Y + 0.0005, p.z);
  return mesh;
}

/** 模具压切导致的极轻微角度/高度偏差：幅度压到极小，避免拼缝看起来忽宽忽窄 */
function dieCutJitter(piece) {
  const a = ((piece.id * 37) % 11) / 10 - 0.5; // -0.5..0.5
  const b = ((piece.id * 53) % 7) / 6 - 0.5;
  const c = ((piece.id * 71) % 9) / 8 - 0.5;
  return { rotY: a * 0.0015, tilt: c * 0.001, y: b * 0.0006 };
}

function applyPieceYaw(mesh, piece) {
  const pileYaw = mesh.userData.pile?.rotY || 0;
  const turn = (piece.rot || 0) * (-Math.PI / 2); // 俯视顺时针
  // 放好的块把刀缝撑满：否则相邻块之间留着一条露出白色台面的缝，放大看就是白线。
  // 贴图是全局 UV，撑开 0.5% 看不出图像错位，接缝只剩那条紫色细线
  const size = puzzle?._size;
  const k = piece.placed && size?.fitCell ? size.cell / size.fitCell : 1;
  mesh.scale.set(k, 1, k);
  if (piece.placed) {
    const j = dieCutJitter(piece);
    // 极轻微侧倾，模拟压切后纸板的微翘曲
    mesh.rotation.set(j.tilt, turn + j.rotY, j.tilt * 0.7);
  } else {
    mesh.rotation.set(0, pileYaw + turn, 0);
  }
}

async function rebuildScene(puzzleData) {
  clearSceneContent();
  const size = boardSize(puzzleData);
  size.total = puzzleData.pieces.length;
  puzzleData._size = size;
  puzzleData._slots = [];

  // 底板顶面与拼块底面齐平，拼块像嵌在托盘里
  const baseTop = PLACED_Y;
  // 素面底板：不上图案，让拼块本身成为唯一的视觉重点
  const board = makeMatPanel(size.w + 0.14, size.h + 0.14);
  const base = board.mesh;
  base.position.y = baseTop;
  state.board.add(base);
  state.boardBase = base;

  // 拼好预览时盖在拼块下方的同一块台面：缝里看到的就是它
  const matPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(size.w, size.h),
    new THREE.MeshStandardMaterial({ map: makeMatTexture(), roughness: 0.96, metalness: 0 })
  );
  matPlate.rotation.x = -Math.PI / 2;
  matPlate.position.y = baseTop - 0.004;
  matPlate.visible = false;
  state.board.add(matPlate);
  state.matPlate = matPlate;

  for (const p of puzzleData.pieces) {
    const slot = createSlotMesh(p, size);
    state.board.add(slot);
    state.slotMeshes.push(slot);
    puzzleData._slots.push(slot);
  }

  // 空槽引导线（有块放上后隐藏，由拼块自带缝边显示）
  // 轮廓按整格 cell 画：放好的块会被撑到 cell（见 applyPieceYaw），两者才严丝合缝
  const seamRoot = new THREE.Group();
  seamRoot.name = 'seams';
  for (const p of puzzleData.pieces) {
    const { shape } = buildJigsawShape(size.cell, p.tabs, knobSamples(size));
    // 内侧一圈略小的轮廓，用来画凹槽的受光边（否则会和主线完全重合看不到）
    const { shape: shapeInner } = buildJigsawShape(size.cell * 0.94, p.tabs, knobSamples(size));
    const g = new THREE.Group();
    g.userData.pieceId = p.id;
    const sp = slotWorldPos(p.r, p.c, size);
    g.position.set(sp.x, PLACED_Y + 0.001, sp.z);
    // 拼块分界线：浅梅紫细线勾出每块轮廓，压在粉色棋盘格上清楚但不刺眼。
    // 必须不透明：相邻空槽在公共边上各画一次，半透明会叠深；
    // 一侧已放块时只剩一条，颜色就明显变浅发白，和全空拼盘不一致
    // 开深度测试：线贴着底板，放好的块有厚度，会把压在它身上的那段线挡住
    addShapeOutline(g, shape, 0.006, 0xb3aac2, 1, {
      renderOrder: 20,
      segments: 48,
    });
    // 内侧一条白色亮线，模拟凹槽的受光边
    addShapeOutline(g, shapeInner, 0.004, 0xffffff, 0.35, {
      renderOrder: 19,
      segments: 48,
    });
    seamRoot.add(g);
  }
  state.board.add(seamRoot);
  state.seamRoot = seamRoot;

  // 待选拼块不再进 3D 场景：全部由底部托盘承载，这里只保留网格供放置时使用
  const batch = size.total > 100 ? 60 : 40;
  for (let i = 0; i < puzzleData.pieces.length; i++) {
    const piece = puzzleData.pieces[i];
    piece.placed = false;
    piece.slotIndex = -1;
    piece.rot = 0;
    const mesh = createPieceMesh(piece, size);
    mesh.visible = false;
    mesh.position.set(0, -10, 0);
    state.pileGroup.add(mesh);
    state.pieceMeshes.set(piece.id, mesh);
    if (i % batch === batch - 1) await new Promise((r) => requestAnimationFrame(r));
  }
  state.trayOrder = puzzleData.pieces.map((p) => p.id);
  // 首次生成也先掷一次种子，叠放开局就是一坨乱的
  state.traySeed = Math.floor(Math.random() * 100000);

  fitShadowCamera(size);
  warmPieceMaterials();

  // 初始：正上方 90° 俯瞰整块底盘
  state.topView = true;
  state.pan = scenePan();
  state.zoom = 1;
  fitCamera();
}

function clearOutline() {
  if (state.outline) {
    disposeMesh(state.outline);
    state.outline = null;
  }
}

/** 列表布局：三行铺开（先填满上排再往下），横向滚动 */
function layoutList(track, count) {
  const rows = 3;
  const cols = Math.max(1, Math.ceil(count / rows));
  track.style.gridTemplateRows = `repeat(${rows}, ${THUMB_PX}px)`;
  track.style.gridTemplateColumns = `repeat(${cols}, ${THUMB_PX}px)`;
}

/** 稳定伪随机（0..1），让叠放看起来是随手一撒；seed 变了整套位置就重掷一次 */
function hash01(i, salt, seed = 0) {
  const x = Math.sin((i + 1) * 12.9898 + (salt + seed) * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 叠放布局：在托盘当前可视范围内随手堆一坨，不做横向滚动。
 * 位置按"槽位号"算，而不是按当前列表下标 —— 放下一块后其余块的槽位不变，
 * 所以托盘不会整体重排。每块的位置、倾角、大小、层级都由 seed 打散，
 * 打散时重掷 seed，就是新的一坨。
 */
function layoutStack(track, slotCount) {
  const seed = state.traySeed;
  const W = Math.max(120, els.tray.clientWidth);
  const H = Math.max(THUMB_PX, els.tray.clientHeight);
  // 就把堆摆在这个宽度里，托盘不出现滚动
  track.style.width = `${W}px`;
  track.style.minWidth = `${W}px`;
  // 缩略图比按钮外溢 THUMB_BLEED，再加倾斜/放大后凸出的蘑菇扣和选中描边，
  // 边距要把这些都让出来，贴边的块才不会被托盘裁掉一截
  const pad = 6 + THUMB_BLEED;
  const spanX = Math.max(0, W - THUMB_PX - pad * 2);
  const spanY = Math.max(0, H - THUMB_PX - pad * 2);

  const n = Math.max(1, slotCount);
  // 打乱一份槽位号当层级：每块 z 唯一，且与排列顺序无关
  const zs = Array.from({ length: n }, (_, i) => i);
  for (let i = zs.length - 1; i > 0; i--) {
    const j = Math.floor(hash01(i, 11, seed) * (i + 1));
    [zs[i], zs[j]] = [zs[j], zs[i]];
  }
  const zOf = new Array(n);
  zs.forEach((slot, rank) => { zOf[slot] = rank; });

  const pos = Array.from({ length: n }, (_, s) => ({
    left: pad + hash01(s, 1, seed) * spanX,
    top: pad + hash01(s, 2, seed) * spanY,
    rot: (hash01(s, 3, seed) - 0.5) * 40,
    scale: 0.82 + hash01(s, 5, seed) * 0.26,
    z: zOf[s],
  }));
  // 返回副本：调用方会改写 rot（沿用摆正过的倾角），不能污染这份缓存
  return (slot) => ({ ...(pos[slot] || pos[0]) });
}

/**
 * 待选拼块的槽位号：取它在 trayOrder 里的位置，与"还剩几块"无关。
 * 放在这里而不是用列表下标，是为了放下一块时其余块不跟着挪窝。
 */
function traySlotMap() {
  const unplaced = puzzle.pieces.filter((p) => !p.placed).map((p) => p.id);
  const known = new Set(state.trayOrder);
  // 新拿起、还没进过排序的块追加到末尾，之后就一直待在各自槽位
  for (const id of unplaced) {
    if (!known.has(id)) {
      state.trayOrder.push(id);
      known.add(id);
    }
  }
  const isUnplaced = new Set(unplaced);
  const map = new Map();
  state.trayOrder.forEach((id, i) => {
    if (isUnplaced.has(id)) map.set(id, i);
  });
  return map;
}

/** 拼块在托盘里滑动到新位置的时长 */
const TRAY_MOVE_MS = 460;

/**
 * FLIP 的第一半：记下每块当前在屏幕上的中心与角度/缩放。
 * 必须在重建 DOM 之前调用（重建后旧节点就没了）。
 */
function captureTraySpots() {
  const map = new Map();
  const track = els.tray.querySelector('.tray-track');
  if (!track) return map;
  for (const btn of track.children) {
    if (!btn._piece) continue;
    const r = btn.getBoundingClientRect();
    map.set(btn._piece.id, {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      rot: btn._at ? btn._at.rot : 0,
      scale: btn._at ? btn._at.scale : 1,
    });
  }
  return map;
}

/** 把底盘上的拼块位置投影成屏幕坐标（收回托盘时的起飞点） */
function projectPieceToScreen(mesh) {
  const { renderer, camera } = state;
  if (!renderer || !camera || !mesh) return null;
  // 藏起来的块（暂时挪到 y=-10）投影出来是无效坐标，不能当起飞点
  if (!mesh.visible) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.position.z).project(camera);
  return {
    x: rect.left + (ndc.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-ndc.y * 0.5 + 0.5) * rect.height,
  };
}

/** 可见区域（整个 app 外框）：动画起点必须落在这里面，才不会"从屏幕外飞进来" */
function visibleRect() {
  const el = document.querySelector('.app') || els.tray;
  return el.getBoundingClientRect();
}

function clampIntoRect(x, y, r, pad = 10) {
  return {
    x: Math.min(Math.max(x, r.left + pad), r.right - pad),
    y: Math.min(Math.max(y, r.top + pad), r.bottom - pad),
  };
}

/** 记下这些块在屏幕上的当前位置，供托盘收块时当起飞点 */
function captureBoardSpots(pieces) {
  const map = new Map();
  for (const piece of pieces) {
    const mesh = state.pieceMeshes.get(piece.id);
    const p = projectPieceToScreen(mesh);
    if (!p) continue;
    if (piece.placed && mesh.parent === state.board && puzzle?._size) {
      const at = slotScreenSpot(mesh.position, puzzle._size);
      map.set(piece.id, { ...at, rot: piece.rot || 0 });
    } else {
      map.set(piece.id, p);
    }
  }
  return map;
}

/** 槽位在屏幕上的中心与拼块主体边长（按当前相机） */
function slotScreenSpot(pos, size) {
  const cell = size.fitCell || size.cell;
  const c = boardToScreen(pos.x, PLACED_Y, pos.z);
  const ex = boardToScreen(pos.x + cell / 2, PLACED_Y, pos.z);
  const ez = boardToScreen(pos.x, PLACED_Y, pos.z + cell / 2);
  return { x: c.x, y: c.y, cellPx: Math.hypot(ex.x - c.x, ex.y - c.y) + Math.hypot(ez.x - c.x, ez.y - c.y) };
}

/** 托盘缩略图（图片中心 cx/cy、角度 a、缩放 s）对应的主体中心 */
function thumbBodyCenter(cx, cy, a, s, m) {
  const rad = (a * Math.PI) / 180;
  return {
    x: cx + (m.offX * Math.cos(rad) - m.offY * Math.sin(rad)) * s,
    y: cy + (m.offX * Math.sin(rad) + m.offY * Math.cos(rad)) * s,
  };
}

/**
 * 飞行替身：克隆缩略图，以主体中心为原点，从 from 飞到 to（屏幕坐标 x/y、角度 a、缩放 s）。
 * 固定定位挂在 body 上，不会被托盘的 overflow 裁掉。
 */
function flyGhost(img, m, from, to, { piece, delay = 0, onLand, fadeOut = true, w = img.offsetWidth, h = img.offsetHeight } = {}) {
  // 按飞行中最大的那一端排版，再缩小到起点：will-change 的图层按初始尺寸栅格化，
  // 若按托盘小尺寸排版再 scale 放大，全程都是放大的小图，糊且有锯齿
  const big = Math.max(1, from.s, to.s);
  const ox = (w / 2 + m.offX) * big;
  const oy = (h / 2 + m.offY) * big;
  let a1 = to.a;
  a1 = from.a + ((((a1 - from.a) % 360) + 540) % 360) - 180; // 走最短的那一圈
  const ghost = piece ? getPieceThumbHi(piece, THUMB_PX, Math.min(4, Math.ceil(big))) : img.cloneNode();
  ghost.className = 'place-ghost';
  Object.assign(ghost.style, {
    width: `${w * big}px`,
    height: `${h * big}px`,
    left: `${from.x - ox}px`,
    top: `${from.y - oy}px`,
    opacity: '',
    transition: 'none',
    transformOrigin: `${ox}px ${oy}px`,
    transform: `translate(0px, 0px) rotate(${from.a}deg) scale(${from.s / big})`,
  });
  document.body.appendChild(ghost);
  void ghost.offsetWidth;
  ghost.style.transition = `transform ${PLACE_FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`;
  ghost.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) rotate(${a1}deg) scale(${to.s / big})`;
  setTimeout(() => {
    onLand?.();
    if (!fadeOut) { ghost.remove(); return; }
    ghost.style.transition = 'opacity 90ms linear';
    ghost.style.opacity = '0';
    setTimeout(() => ghost.remove(), 110);
  }, PLACE_FLY_MS + delay);
}

/**
 * FLIP 的第二半：把每块先瞬移回旧位置，再过渡到新位置，
 * 这样打散/换布局时能看出拼块滑过去，而不是直接闪到新位置。
 */
function animateTrayMove(prev) {
  // 托盘原本是空的（例如拼好后再打散）也要让收回来的块飞进来
  if (!prev.size && !state.trayEnterFrom?.size) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
  const track = els.tray.querySelector('.tray-track');
  if (!track) return;

  const jobs = [];
  const entering = [];
  for (const btn of track.children) {
    const piece = btn._piece;
    if (!piece) continue;
    const to = {
      rot: btn._at ? btn._at.rot : 0,
      scale: btn._at ? btn._at.scale : 1,
    };
    const from = prev.get(piece.id);
    if (!from) {
      // 从底盘收回来的块：托盘里原本没有它，没有"旧位置"可用。
      // 起飞点优先用它在底盘上的屏幕投影，看着是从刚才那一格下来的；
      // 取不到就在托盘内部随机起。
      // 起点必须压进托盘自身范围：托盘是 overflow 裁剪的，从底盘那么远起飞的块
      // 前半程完全被裁掉，等露面时已经快到终点，看起来就是"没有动画"直接出现。
      const proj = state.trayEnterFrom?.get(piece.id);
      // 从底盘拼好位置收回来的块：用替身从它在底盘上的真实位置、大小、角度飞回托盘
      if (proj?.cellPx) {
        btn.style.opacity = '0';
        entering.push({ btn, to, from: proj, ghost: true });
        continue;
      }
      const trayRect = els.tray.getBoundingClientRect();
      const at = proj
        ? clampIntoRect(proj.x, proj.y, trayRect, 12)
        : {
            x: trayRect.left + 12 + hash01(piece.id, 21, state.traySeed) * Math.max(0, trayRect.width - 24),
            y: trayRect.top + 12 + hash01(piece.id, 22, state.traySeed) * Math.max(0, trayRect.height - 24),
          };
      const rect0 = btn.getBoundingClientRect();
      entering.push({
        btn,
        to,
        dx: at.x - (rect0.left + rect0.width / 2),
        dy: at.y - (rect0.top + rect0.height / 2),
        rot0: to.rot + (hash01(piece.id, 23, state.traySeed) - 0.5) * 90,
        scale0: to.scale * 0.7,
      });
      continue;
    }
    // 旧位置也不能在屏幕外（列表模式横滚时右侧的块就在视野外）
    const appRect = visibleRect();
    const fromAt = clampIntoRect(from.cx, from.cy, appRect);
    const rect = btn.getBoundingClientRect();
    const dx = fromAt.x - (rect.left + rect.width / 2);
    const dy = fromAt.y - (rect.top + rect.height / 2);
    const moved =
      Math.abs(dx) > 1 ||
      Math.abs(dy) > 1 ||
      Math.abs(from.rot - to.rot) > 0.5 ||
      Math.abs(from.scale - to.scale) > 0.01;
    if (!moved) continue;
    // transform 函数列表保持一致（translate/rotate/scale），CSS 才能逐项插值
    btn.style.transition = 'none';
    btn.style.transform =
      `translate(${dx}px, ${dy}px) rotate(${from.rot}deg) scale(${from.scale})`;
    jobs.push({ btn, to });
  }

  for (const e of entering) {
    if (e.ghost) continue;
    e.btn.style.transition = 'none';
    e.btn.style.opacity = '0';
    e.btn.style.transform =
      `translate(${e.dx}px, ${e.dy}px) rotate(${e.rot0}deg) scale(${e.scale0})`;
  }
  // 起飞点只在这一次收块时有用，用完即弃（否则下次换布局会用到过期的坐标）
  state.trayEnterFrom = null;

  if (!jobs.length && !entering.length) return;

  // 重建后的 <img> 是异步解码的：块数一多，解码比过渡本身还慢，
  // 图片出来时过渡早已走完，那几块看上去就是直接闪到终点。
  // 所以先等图片解码（最多等 400ms），再开始过渡；等待期间各块停在旧位置。
  const token = ++trayMoveToken;
  const imgs = [...track.querySelectorAll('img')];
  const decoded = Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
  Promise.race([decoded, new Promise((r) => setTimeout(r, 400))]).then(() => {
    if (token !== trayMoveToken) return;
    runTrayMove(track, jobs, entering);
  });
}

let trayMoveToken = 0;

/** 替身从底盘位置飞回托盘里这块的落位，落地后露出真正的托盘块 */
function flyBackToTray(e, delay) {
  const { btn, from, to } = e;
  const img = btn.querySelector('img:not(.thumb-ring)');
  const piece = btn._piece;
  if (!img || !piece) {
    btn.style.opacity = '';
    return;
  }
  const r = img.getBoundingClientRect();
  const m = thumbBodyMetrics(piece, THUMB_PX);
  const a1 = to.rot + (piece.rot || 0) * 90;
  const b1 = thumbBodyCenter(r.left + r.width / 2, r.top + r.height / 2, a1, to.scale, m);
  // 落位在托盘可视范围外（整齐模式横向滚出去的块）：飞到托盘边缘就淡出，不越过托盘
  const tr = els.tray.getBoundingClientRect();
  const pad = (THUMB_PX * to.scale) / 2;
  const inside = b1.x >= tr.left + pad * 0.5 && b1.x <= tr.right - pad * 0.5;
  const end = inside ? b1 : clampIntoRect(b1.x, b1.y, tr, pad);
  flyGhost(
    img,
    m,
    { x: from.x, y: from.y, a: (from.rot || 0) * 90, s: from.cellPx / Math.max(1, m.body) },
    { x: end.x, y: end.y, a: a1, s: to.scale },
    {
      piece,
      delay,
      fadeOut: !inside,
      onLand: () => {
        if (btn.isConnected) btn.style.opacity = '';
      },
    }
  );
}

function runTrayMove(track, jobs, entering) {
  // 强制重排，让"回到旧位置"这一帧先落地，否则浏览器可能只看到最终值而不做过渡
  void track.offsetWidth;

  // 叠放时几十块同时滑动，绝大多数被压在上层块底下，看起来像只有顶上几块在动。
  // 按最终层级从下往上错开起步（最多错开 260ms），像重新一张张撒上去，每块的落位都看得见。
  const all = [...jobs.map((j) => j.btn), ...entering.map((e) => e.btn)];
  const order = all
    .map((btn, i) => ({ btn, z: btn._at ? btn._at.z : i }))
    .sort((a, b) => a.z - b.z);
  const stagger = all.length > 1 ? Math.min(260, all.length * 8) : 0;
  const delayOf = new Map(
    order.map((o, rank) => [o.btn, order.length > 1 ? Math.round((rank / (order.length - 1)) * stagger) : 0])
  );
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

  requestAnimationFrame(() => {
    for (const { btn, to } of jobs) {
      const d = delayOf.get(btn) || 0;
      btn.style.transition = `transform ${TRAY_MOVE_MS}ms ${ease} ${d}ms`;
      btn.style.transform = `translate(0px, 0px) rotate(${to.rot}deg) scale(${to.scale})`;
    }
    for (const e of entering) {
      const d = delayOf.get(e.btn) || 0;
      if (e.ghost) {
        flyBackToTray(e, d);
        continue;
      }
      e.btn.style.transition =
        `transform ${TRAY_MOVE_MS}ms ${ease} ${d}ms, opacity ${TRAY_MOVE_MS * 0.6}ms var(--ease-out) ${d}ms`;
      e.btn.style.transform = `translate(0px, 0px) rotate(${e.to.rot}deg) scale(${e.to.scale})`;
      e.btn.style.opacity = '1';
    }
  });
  // 动画结束后收掉内联过渡，回到布局本身的静止 transform
  setTimeout(() => {
    for (const { btn } of jobs) {
      btn.style.transition = '';
      btn.style.transform = btn._at
        ? `rotate(${btn._at.rot}deg) scale(${btn._at.scale})`
        : '';
    }
    for (const e of entering) {
      if (e.ghost) continue;
      e.btn.style.transition = '';
      e.btn.style.opacity = '';
      e.btn.style.transform = e.btn._at
        ? `rotate(${e.btn._at.rot}deg) scale(${e.btn._at.scale})`
        : '';
    }
  }, TRAY_MOVE_MS + stagger + 60);
}

function renderTray() {
  // 重建前记住滚动位置：innerHTML 清空会把 scrollLeft 归零，
  // 叠放时就会表现为"点一下列表自己滚了"
  const keepScroll = els.tray.scrollLeft;
  // 同时记下每块原位，重建后据此做滑动动画
  const prevSpots = captureTraySpots();
  els.tray.innerHTML = '';
  syncRotateButton();
  if (!puzzle) {
    els.trayCount.textContent = '0';
    const empty = document.createElement('div');
    empty.className = 'tray-empty';
    empty.textContent = '生成后拼块会出现在这里';
    els.tray.appendChild(empty);
    return;
  }
  const list = trayList();
  els.trayCount.textContent = String(puzzle.pieces.filter((p) => !p.placed).length);
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'tray-empty is-done';
    empty.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>全部放好了';
    els.tray.appendChild(empty);
    return;
  }

  const stack = state.trayMode === 'stack';
  els.tray.classList.toggle('stack', stack);
  const track = document.createElement('div');
  track.className = 'tray-track';
  els.tray.appendChild(track);
  let place = null;
  // 叠放按固定槽位摆放，所以放下一块后其余块不会挪窝
  let slots = null;
  if (stack) {
    slots = traySlotMap();
    place = layoutStack(track, state.trayOrder.length);
  } else {
    layoutList(track, list.length);
  }

  list.forEach((piece, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const on = selectedId === piece.id;
    btn.className = 'piece-thumb' + (on ? ' selected' : '');
    const img = document.createElement('img');
    img.src = getPieceThumb(piece, THUMB_PX);
    img.alt = '拼块';
    img.style.transform = `rotate(${(piece.rot || 0) * 90}deg)`;
    btn.appendChild(img);
    if (on) {
      // 选中边框：沿拼块轮廓的一圈细线（与拼块留 2px 空隙、线厚 2px），不是圆角矩形
      const ring = document.createElement('img');
      ring.className = 'thumb-ring';
      ring.src = getPieceFrame(piece, THUMB_PX);
      ring.alt = '';
      ring.style.transform = `rotate(${(piece.rot || 0) * 90}deg)`;
      btn.appendChild(ring);
    }
    if (place) {
      const at = place(slots?.get(piece.id) ?? i);
      // 转过的块已经摆正过，沿用记下的倾角，别再随机歪回去
      if (piece.trayTilt != null) at.rot = piece.trayTilt;
      btn.style.left = `${at.left}px`;
      btn.style.top = `${at.top}px`;
      btn.style.transform = `rotate(${at.rot}deg) scale(${at.scale})`;
      btn.style.zIndex = on ? '999' : String(at.z);
      // 命中判定需要未变换的位置与角度
      btn._at = at;
    }
    btn._piece = piece;
    // 点按不应该让按钮抢焦点：浏览器会把获得焦点的块滚动进视野，列表就自己动了
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => selectPiece(piece.id));
    track.appendChild(btn);
  });
  els.tray.scrollLeft = keepScroll;
  // 位置定下来后再测新坐标，从旧位置滑过去
  animateTrayMove(prevSpots);
}

/**
 * 只更新选中态，不重建整列。
 * 重建 innerHTML 会让滚动位置被重置（叠放时表现为"点一下就滚了"），
 * 所以选中只改类名、边框层和层级。
 */
function updateTraySelection(id) {
  const track = els.tray.querySelector('.tray-track');
  if (!track) return;
  for (const btn of track.children) {
    const piece = btn._piece;
    if (!piece) continue;
    const on = piece.id === id;
    btn.classList.toggle('selected', on);
    const old = btn.querySelector('.thumb-ring');
    if (old) old.remove();
    if (on) {
      // 选中边框：沿拼块真实轮廓（含蘑菇扣）的一条 2px 细线
      const ring = document.createElement('img');
      ring.className = 'thumb-ring';
      ring.src = getPieceFrame(piece, THUMB_PX);
      ring.alt = '';
      ring.style.transform = `rotate(${(piece.rot || 0) * 90}deg)`;
      btn.appendChild(ring);
    }
    if (btn._at) btn.style.zIndex = on ? '999' : String(btn._at.z);
  }
}

/**
 * 叠放模式下每块的矩形盒互相压住，浏览器按矩形判定会点到旁边那块。
 * 这里按拼块真实轮廓判定，取压在最上面的一块；点在透明处则不选。
 */
function pickStackPiece(e) {
  const track = els.tray.querySelector('.tray-track');
  if (!track) return null;
  const tr = track.getBoundingClientRect();
  const px = e.clientX - tr.left;
  const py = e.clientY - tr.top;
  let best = null;
  let bestZ = -Infinity;
  for (const btn of track.children) {
    const at = btn._at;
    const piece = btn._piece;
    if (!at || !piece) continue;
    const w = btn.offsetWidth || THUMB_PX;
    const h = btn.offsetHeight || THUMB_PX;
    const cx = at.left + w / 2;
    const cy = at.top + h / 2;
    const vx = px - cx;
    const vy = py - cy;
    const a = (-at.rot * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // 逆变换：先反向旋转再除以缩放，得到未变换时相对按钮左上角的坐标
    const ux = cx + (vx * cos - vy * sin) / at.scale;
    const uy = cy + (vx * sin + vy * cos) / at.scale;
    // 命中判定吃的是"缩略图图片自身坐标系"的点：先把原点从按钮左上角
    // 挪到内容区（去掉边框/内边距），再退掉图片向左上外溢的那一段
    const off = THUMB_INSET - THUMB_BLEED;
    if (!hitTestPiece(piece, ux - at.left - off, uy - at.top - off, THUMB_PX)) continue;
    if (at.z > bestZ) {
      bestZ = at.z;
      best = piece.id;
    }
  }
  return best;
}

/**
 * 托盘实际渲染的拼块：按 trayOrder 排列，只保留未放置的，最多 80 个。
 * 与 renderTray 保持一致，否则滚动定位会算错下标。
 */
function trayList() {
  if (!puzzle) return [];
  const unplaced = puzzle.pieces.filter((p) => !p.placed);
  const byId = new Map(unplaced.map((p) => [p.id, p]));
  const seen = new Set();
  const ordered = [];
  for (const id of state.trayOrder) {
    const p = byId.get(id);
    if (p && !seen.has(id)) {
      ordered.push(p);
      seen.add(id);
    }
  }
  // 新拿起、还没进过排序的块补在末尾
  for (const p of unplaced) {
    if (!seen.has(p.id)) ordered.push(p);
  }
  return ordered.length > 80 ? ordered.slice(0, 80) : ordered;
}

/** 重排待选顺序（打散时用），让托盘看起来是随机一把 */
function shuffleTray() {
  if (!puzzle) return;
  // 顺序和叠放的几何都重掷一套，打散后不是同一堆换个顺序
  state.traySeed = Math.floor(Math.random() * 100000);
  const ids = puzzle.pieces.filter((p) => !p.placed).map((p) => p.id);
  // 摆正过的倾角也一并丢掉，打散后重新歪成一堆
  for (const p of puzzle.pieces) p.trayTilt = null;
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.trayOrder = ids;
}

/** 切换底部待选显示形式：list ↔ stack */
function setTrayMode(mode) {
  state.trayMode = mode === 'stack' ? 'stack' : 'list';
  const stack = state.trayMode === 'stack';
  if (els.trayMode) {
    els.trayMode.classList.toggle('is-stack', stack);
    els.trayMode.setAttribute('aria-pressed', stack ? 'true' : 'false');
    els.trayMode.title = stack ? '当前：散落，点击切换为排列' : '当前：排列，点击切换为散落';
  }
  renderTray();
}

/**
 * 空槽提示（开关）：打开后，选中哪块就直接标出它原本的槽位，并转到正确朝向。
 * 只把槽位本身填成实色，不再额外描线：槽位填充与缝线用的是同一条轮廓，
 * 额外放大描一圈会和缝线、内侧亮线错开，看起来像套了好几层边框。
 */
function clearSlotHints() {
  if (state.hintGroup) {
    disposeMesh(state.hintGroup);
    state.hintGroup = null;
  }
  for (const slot of state.slotMeshes || []) {
    const base = slot.userData.base;
    if (!base) continue;
    slot.material.color.setHex(base.color);
    slot.material.opacity = base.opacity;
  }
  for (const g of state.seamRoot?.children || []) {
    if (g.children[1]) g.children[1].visible = true;
  }
}

/** 旋转只对「已选中、还在托盘里」的拼块有效，其余情况置灰 */
function syncRotateButton() {
  if (!els.rotate) return;
  const piece = puzzle && selectedId != null ? puzzle.pieces[selectedId] : null;
  els.rotate.disabled = !piece || piece.placed;
}

function syncHintButton() {
  els.hintBtn.classList.toggle('is-on', !!state.hintOn);
  els.hintBtn.setAttribute('aria-pressed', state.hintOn ? 'true' : 'false');
}

/** 该块原本的槽位（唯一正解），顺带返回需要转到的朝向 */
function hintHome(piece) {
  const slot = state.slotMeshes[piece.id];
  if (!slot) return null;
  for (let k = 0; k < 4; k++) {
    if (rotatedShapeKey(piece.tabs, k) === slot.userData.shapeKey) return { slot, rot: k };
  }
  return { slot, rot: piece.rot || 0 };
}

function showHint() {
  clearSlotHints();
  if (!puzzle || selectedId == null) return;
  const piece = puzzle.pieces[selectedId];
  if (!piece || piece.placed) return;
  const home = hintHome(piece);
  if (!home) return;
  if ((piece.rot || 0) !== home.rot) setPieceRotation(piece, home.rot);
  // 近乎不透明：半透明时底下棋盘格的方格线会透上来，像多套了一个方框
  home.slot.material.color.setHex(0xffb547);
  home.slot.material.opacity = 0.88;
  // 内侧那条受光亮线在实色块上会变成第二道边框，提示期间先藏起来
  const seam = state.seamRoot?.children.find((g) => g.userData.pieceId === piece.id);
  if (seam?.children[1]) seam.children[1].visible = false;
}

/** 直接设定朝向（不走动画），并同步托盘缩略图（不重建列表，避免滚动位置被重置） */
function setPieceRotation(piece, rot) {
  piece.rot = ((rot % 4) + 4) % 4;
  const mesh = state.pieceMeshes.get(piece.id);
  if (mesh) applyPieceYaw(mesh, piece);
  const imgs = els.tray.querySelectorAll('.piece-thumb.selected img');
  for (const el of imgs) el.style.transform = `rotate(${piece.rot * 90}deg)`;
}

/** 提示按钮是开关：开着时每选一块都直接标出它的位置 */
function toggleHint() {
  if (!puzzle) return;
  state.hintOn = !state.hintOn;
  syncHintButton();
  if (!state.hintOn) {
    clearSlotHints();
    setHint('已关闭提示');
  } else {
    showHint();
    setHint('已开启提示');
  }
}

/**
 * 整齐模式下，选中的块若有一截露在托盘可视区外（被裁切），把它平滑滚进来。
 * 只滚差的那一段，不整列跳动；已经完整可见就不动。
 */
function revealSelectedThumb() {
  if (state.trayMode === 'stack') return;
  const btn = els.tray.querySelector('.piece-thumb.selected');
  if (!btn) return;
  const tray = els.tray.getBoundingClientRect();
  const r = btn.getBoundingClientRect();
  const margin = THUMB_BLEED + 4;
  let dx = 0;
  if (r.left - margin < tray.left) dx = r.left - margin - tray.left;
  else if (r.right + margin > tray.right) dx = r.right + margin - tray.right;
  if (Math.abs(dx) < 1) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  els.tray.scrollBy({ left: dx, behavior: reduce ? 'auto' : 'smooth' });
}

function selectPiece(id) {
  const piece = puzzle.pieces[id];
  if (!piece || piece.placed) return;
  selectedId = id;
  syncRotateButton();
  clearSlotHints();
  // 只更新选中态，不重建列表：重建会把滚动位置重置（叠放时看起来就是"点一下就滚了"）
  updateTraySelection(id);
  revealSelectedThumb();
  clearOutline();
  if (state.hintOn) showHint();
}

/** 拼盘左右轻晃一下（衰减正弦），表示"放不进去" */
let boardShake = null;
function shakeBoard() {
  const board = state.board;
  if (!board) return;
  if (boardShake) cancelAnimationFrame(boardShake.raf);
  const baseX = boardShake ? boardShake.baseX : board.position.x;
  const amp = (puzzle?._size?.cell || 1) * 0.12;
  const dur = 360;
  const t0 = performance.now();
  boardShake = { baseX, raf: 0 };
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    board.position.x = baseX + Math.sin(t * Math.PI * 6) * amp * (1 - t);
    if (t < 1) {
      boardShake.raf = requestAnimationFrame(tick);
    } else {
      board.position.x = baseX;
      boardShake = null;
    }
  };
  boardShake.raf = requestAnimationFrame(tick);
}

/** 形状吻合的朝向：优先当前朝向，其次转得最少的那个；都不吻合返回 null */
function matchRotation(piece, slot) {
  const cur = piece.rot || 0;
  for (const d of [0, 1, 3, 2]) {
    const k = (cur + d) % 4;
    if (rotatedShapeKey(piece.tabs, k) === slot.userData.shapeKey) return k;
  }
  return null;
}

/** 底盘局部坐标 → 屏幕坐标 */
function boardToScreen(x, y, z) {
  // fitCamera 只改了 position/lookAt，矩阵要到下一次渲染才更新；
  // 不手动刷新的话，刚换视角（如拼好）时算出的落点和大小还是旧相机的
  state.camera.updateMatrixWorld();
  state.board.updateMatrixWorld();
  const rect = state.renderer.domElement.getBoundingClientRect();
  const v = state.board.localToWorld(new THREE.Vector3(x, y, z)).project(state.camera);
  return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
}

const PLACE_FLY_MS = 420;
const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** 记下托盘里某块缩略图此刻在屏幕上的位置/倾角（托盘重建前先拍下来） */
function snapTrayThumb(piece) {
  const btn = [...els.tray.querySelectorAll('.piece-thumb')].find((b) => b._piece?.id === piece.id);
  const img = btn?.querySelector('img:not(.thumb-ring)');
  if (!img) return null;
  const r = img.getBoundingClientRect();
  if (!r.width) return null;
  return {
    img,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
    w: img.offsetWidth,
    h: img.offsetHeight,
    tilt: btn._at ? btn._at.rot : 0,
    scale0: btn._at ? btn._at.scale : 1,
    fromRot: piece.rot || 0,
  };
}

/**
 * 放置动画：缩略图从托盘飞到槽位，途中转到正确朝向、缩放到槽位的屏幕大小，
 * 落地后换成 3D 拼块。
 */
function flyFromSnap(snap, piece, pos, size, onLand, delay = 0) {
  const m = thumbBodyMetrics(piece, THUMB_PX);
  const a0 = snap.tilt + snap.fromRot * 90;
  const b0 = thumbBodyCenter(snap.cx, snap.cy, a0, snap.scale0, m);
  const end = slotScreenSpot(pos, size);
  flyGhost(
    snap.img,
    m,
    { x: b0.x, y: b0.y, a: a0, s: snap.scale0 },
    { x: end.x, y: end.y, a: (piece.rot || 0) * 90, s: end.cellPx / Math.max(1, m.body) },
    // 拼好时托盘已经重建，原 <img> 脱离文档后 offsetWidth 为 0，必须用拍照时记下的尺寸
    { piece, delay, onLand, w: snap.w, h: snap.h }
  );
}

/** 单块放置：返回 false 表示没有可飞的缩略图（调用方直接显示 3D 块） */
function flyThumbToSlot(piece, fromRot, pos, size, onLand) {
  if (reduceMotion()) return false;
  const snap = snapTrayThumb(piece);
  if (!snap) return false;
  snap.fromRot = fromRot;
  flyFromSnap(snap, piece, pos, size, onLand);
  return true;
}

function placeOnSlot(slot) {
  if (selectedId == null || !puzzle) return;
  const piece = puzzle.pieces[selectedId];
  if (piece.placed) return;
  if (slot.userData.occupiedBy != null) {
    setHint('这里已经有拼块了');
    return;
  }
  // 只有任何朝向都对不上才拒绝并抖动；朝向不对就在飞过去的途中转正
  const rot = matchRotation(piece, slot);
  if (rot == null) {
    setHint('形状不吻合');
    shakeBoard();
    return;
  }

  const mesh = state.pieceMeshes.get(selectedId);
  const size = puzzle._size;
  const pos = slotWorldPos(slot.userData.r, slot.userData.c, size);
  const fromRot = piece.rot || 0;
  piece.rot = rot;
  mesh.position.set(pos.x, PLACED_Y, pos.z);
  // 飞行途中槽位保持可见，落地瞬间再换成 3D 块
  const flying = flyThumbToSlot(piece, fromRot, pos, size, () => {
    if (!piece.placed || slot.userData.occupiedBy !== piece.id) return;
    mesh.visible = true;
    slot.visible = false;
  });
  mesh.visible = !flying;
  piece.placed = true;
  applyPieceYaw(mesh, piece);
  if (mesh.parent !== state.board) {
    state.pileGroup.remove(mesh);
    state.board.add(mesh);
  }
  piece.placed = true;
  piece.slotIndex = slot.userData.r * puzzle.cols + slot.userData.c;
  slot.userData.occupiedBy = piece.id;
  if (!flying) slot.visible = false;
  setPieceSeamVisible(mesh, true);
  syncBoardSeams();
  selectedId = null;
  clearOutline();
  clearSlotHints();
  renderTray();
  const left = puzzle.pieces.filter((p) => !p.placed).length;
  if (!left) {
    // 每块都在自己的原位且朝向归正，才算真正拼对；等最后一块落地再庆祝
    const perfect = puzzle.pieces.every((p) => p.slotIndex === p.id && ((p.rot || 0) % 4) === 0);
    if (perfect) {
      const wait = flying ? PLACE_FLY_MS + 60 : 0;
      setTimeout(() => {
        setHint('太棒了，拼图完成！');
        celebrate();
      }, wait);
      setDone('win');
    } else {
      setHint('都放上了，但有几块位置不对');
    }
  }
}

function pickFromPileOrSlot(e) {
  if (!puzzle || e.button !== 0) return;
  if (!pickStart) return;
  if (Math.hypot(e.clientX - pickStart.x, e.clientY - pickStart.y) > 10) return;

  const rect = state.renderer.domElement.getBoundingClientRect();
  state.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, state.camera);

  const pieceHits = state.raycaster.intersectObjects(
    [...state.pieceMeshes.values()].filter((m) => m.visible),
    false
  );
  if (pieceHits.length) {
    const id = pieceHits[0].object.userData.pieceId;
    const piece = puzzle.pieces[id];
    if (piece.placed) {
      // 拿起
      // 起飞点要在改状态、挪走之前取：placed 为 true 才会按槽位记下大小和朝向，
      // 挪到 (0,-10,0) 之后投影也没意义了
      state.trayEnterFrom = captureBoardSpots([piece]);
      exitRevealMode();
      resetDone();
      const slot = state.slotMeshes.find((s) => s.userData.occupiedBy === id);
      if (slot) {
        slot.userData.occupiedBy = null;
        slot.visible = true;
      }
      piece.placed = false;
      piece.slotIndex = -1;
      piece.rot = piece.rot || 0;
      const mesh = pieceHits[0].object;
      mesh.visible = false;
      mesh.position.set(0, -10, 0);
      state.board.remove(mesh);
      state.pileGroup.add(mesh);
      applyPieceYaw(mesh, piece);
      setPieceSeamVisible(mesh, false);
      syncBoardSeams();
      // 从底盘拿起后这块重新回到待选列表，需要重建
      renderTray();
      selectPiece(id);
      return;
    }
    selectPiece(id);
    return;
  }

  if (selectedId == null) return;
  const slotHits = state.raycaster.intersectObjects(state.slotMeshes.filter((s) => s.visible), false);
  if (slotHits.length) {
    placeOnSlot(slotHits[0].object);
  }
}

/** 揭晓后再拿起拼块：换回底板和空槽分割线，和打散后的拼盘保持同一风格 */
function exitRevealMode() {
  if (state.boardBase) state.boardBase.visible = true;
  if (state.matPlate) state.matPlate.visible = false;
  if (state.seamRoot) state.seamRoot.visible = true;
}

let pickStart = null;
function bindPick(el) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button === 0) pickStart = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('pointerup', pickFromPileOrSlot);
}

function scatterAll() {
  if (!puzzle) return;
  if (state.boardBase) state.boardBase.visible = true;
  if (state.matPlate) state.matPlate.visible = false;
  if (state.completedImage) state.completedImage.visible = false;
  if (state.seamRoot) state.seamRoot.visible = true;
  clearTweens();
  resetDone();
  state.startAt = performance.now();

  // 先记下每块在底盘上的屏幕位置，收进托盘时就从那儿飞下来
  state.trayEnterFrom = captureBoardSpots(puzzle.pieces);
  state.slotMeshes.forEach((s) => {
    s.userData.occupiedBy = null;
    s.visible = true;
  });
  for (const piece of puzzle.pieces) {
    piece.placed = false;
    piece.slotIndex = -1;
    piece.rot = 0;
    const mesh = state.pieceMeshes.get(piece.id);
    if (!mesh) continue;
    mesh.visible = false;
    mesh.position.set(0, -10, 0);
    mesh.rotation.set(0, 0, 0);
    setPieceSeamVisible(mesh, false);
    if (mesh.parent !== state.pileGroup) {
      state.board.remove(mesh);
      state.pileGroup.add(mesh);
    }
  }
  syncBoardSeams();
  selectedId = null;
  clearOutline();
  clearSlotHints();
  // 重排底部托盘，看起来像重新撒了一把
  shuffleTray();
  renderTray();
  // 打散后回到初始视角：正上方俯瞰整块底盘
  state.topView = true;
  state.pan = scenePan();
  state.zoom = 1;
  fitCamera();
  setHint('已重来，全部拼块已收回');
}

/** 只打乱托盘里还没拼的块，已放上拼版的不动 */
function shuffleUnplaced() {
  if (!puzzle) return;
  if (puzzle.pieces.every((p) => p.placed)) {
    setHint('没有待拼的拼块');
    return;
  }
  selectedId = null;
  clearOutline();
  clearSlotHints();
  shuffleTray();
  renderTray();
}

function openRestartConfirm() {
  if (!puzzle) return;
  const placed = puzzle.pieces.filter((p) => p.placed).length;
  els.restartDesc.textContent = placed
    ? `已拼好的 ${placed} 块会全部取消并收回，用时重新计算。`
    : '所有拼块会重新洗牌，用时重新计算。';
  els.restartConfirm.setAttribute('aria-hidden', 'false');
}

function closeRestartConfirm() {
  els.restartConfirm.setAttribute('aria-hidden', 'true');
}

function solveAll() {
  if (!puzzle) return;
  const size = puzzle._size;
  // 托盘里还没放的块：重建托盘前先拍下位置，拼好后逐块飞到各自槽位
  const snaps = new Map();
  if (!reduceMotion()) {
    for (const piece of puzzle.pieces) {
      if (piece.placed) continue;
      const snap = snapTrayThumb(piece);
      if (snap) snaps.set(piece.id, snap);
    }
  }
  // 完成态：用真实 3D 拼块拼合（有厚度、倒角凹陷、压切偏差），
  // 顶面 UV 直接取自源图，因此拼好后图像严格连续。
  // 隐藏底座，避免底部露出一条多余边。
  if (state.boardBase) state.boardBase.visible = false;
  if (state.matPlate) state.matPlate.visible = true;
  if (state.completedImage) state.completedImage.visible = false;
  for (const slot of state.slotMeshes) {
    slot.userData.occupiedBy = null;
    slot.visible = false;
  }
  if (state.seamRoot) state.seamRoot.visible = false;
  puzzle.pieces.forEach((piece) => {
    const mesh = state.pieceMeshes.get(piece.id);
    if (!mesh) return;
    const slot = state.slotMeshes[piece.id];
    const pos = slotWorldPos(piece.r, piece.c, size);
    if (mesh.parent !== state.board) {
      state.pileGroup.remove(mesh);
      state.board.add(mesh);
    }
    piece.rot = 0;
    piece.placed = true;
    piece.slotIndex = piece.id;
    mesh.visible = true;
    mesh.position.set(pos.x, PLACED_Y, pos.z);
    applyPieceYaw(mesh, piece);
    // 预览也用缝线：发丝级的暗线，均匀比大间隙更像真实拼图
    setPieceSeamVisible(mesh, true);
    if (slot) slot.userData.occupiedBy = piece.id;
  });
  selectedId = null;
  clearOutline();
  clearSlotHints();
  renderTray();
  // 预览：正上方俯瞰，像看一张完整的拼图成品图
  state.topView = true;
  state.pan = { x: 0, z: 0 };
  state.zoom = 1;
  fitCamera();
  // 相机就位后再算落点；按顺序错开起飞，像一块块摆上去
  const stagger = snaps.size > 1 ? Math.min(520, snaps.size * 14) : 0;
  let i = 0;
  snaps.forEach((snap, id) => {
    const piece = puzzle.pieces[id];
    const mesh = state.pieceMeshes.get(id);
    if (!mesh) return;
    mesh.visible = false;
    const delay = snaps.size > 1 ? Math.round((i++ / (snaps.size - 1)) * stagger) : 0;
    const pos = slotWorldPos(piece.r, piece.c, size);
    flyFromSnap(snap, piece, pos, size, () => {
      if (piece.placed && mesh.parent === state.board) mesh.visible = true;
    }, delay);
  });
  setHint('已揭晓完整画面');
  // 等最后一块飞到位再撒花
  const wait = snaps.size ? PLACE_FLY_MS + stagger + 60 : 0;
  setTimeout(celebrate, wait);
  setDone(state.doneKind === 'win' ? 'win' : 'reveal');
}

/* ==================== 完成后：成品图 / 保存 / 分享 ==================== */
const APP_NAME = '熊猫拼图';
const APP_NAME_EN = 'Panda Puzzle';
let doneMs = 0;

/** 记下完成方式；亲手拼完时把用时定格，之后再保存/分享都用这一刻的用时 */
function setDone(kind) {
  if (kind === 'win' && state.doneKind !== 'win') doneMs = performance.now() - state.startAt;
  state.doneKind = kind;
}

function resetDone() {
  state.doneKind = null;
}

function formatDuration(ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m} 分 ${String(s % 60).padStart(2, '0')} 秒` : `${s} 秒`;
}

function doneStatsText() {
  const n = puzzle.pieces.length;
  const base = `${puzzle.cols}×${puzzle.rows} · ${n} 块`;
  if (state.doneKind === 'win') return `${base} · 用时 ${formatDuration(doneMs)}`;
  if (state.doneKind === 'reveal') return base;
  return `${base} · 已拼 ${puzzle.pieces.filter((p) => p.placed).length}/${n}`;
}

/**
 * 用一台独立的俯视相机拍整幅拼图，不改玩家当前的视角和渲染倍率。
 * 渲染后在同一任务内读回画布，不需要 preserveDrawingBuffer；拍完立刻用原相机重绘一帧。
 */
function captureBoard() {
  const { renderer, scene, camera } = state;
  const size = puzzle?._size;
  if (!renderer || !size) return null;
  const el = renderer.domElement;
  const pad = size.cell * 0.45;
  const hw = size.w / 2 + pad;
  const hh = size.h / 2 + pad;
  const shot = camera.clone();
  const tan = Math.tan((shot.fov * Math.PI) / 360) || 0.3;
  shot.aspect = el.width / el.height;
  const dist = Math.max(hh / tan, hw / (tan * shot.aspect));
  shot.position.set(0, dist, 0);
  shot.up.set(0, 0, -1);
  shot.lookAt(0, 0, 0);
  shot.near = Math.max(0.1, dist * 0.02);
  shot.far = dist * 4;
  shot.updateProjectionMatrix();
  renderer.render(scene, shot);

  const v = new THREE.Vector3();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, z] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
    v.set(x, PLACED_Y, z).project(shot);
    const px = ((v.x + 1) / 2) * el.width;
    const py = ((1 - v.y) / 2) * el.height;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px);
    y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(el.width, Math.ceil(x1));
  y1 = Math.min(el.height, Math.ceil(y1));
  const out = document.createElement('canvas');
  out.width = Math.max(1, x1 - x0);
  out.height = Math.max(1, y1 - y0);
  out.getContext('2d').drawImage(el, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  renderer.render(scene, camera);
  return out;
}

/** 成品图：拼图居中，底部一行小字署名；导出 JPEG（postNote 走 base64，体积要小） */
function composePoster(board) {
  const W = 1080;
  const pad = 56;
  const footH = 96;
  const k = Math.min((W - pad * 2) / board.width, 1400 / board.height);
  const bw = Math.round(board.width * k);
  const bh = Math.round(board.height * k);
  const H = pad + bh + footH;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1b1f3d');
  bg.addColorStop(1, '#14172e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(board, (W - bw) / 2, pad, bw, bh);

  const font = '"PingFang SC", "Yuanti SC", system-ui, sans-serif';
  const y = pad + bh + footH / 2 + 10;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb547';
  ctx.font = `800 30px ${font}`;
  ctx.fillText(`${APP_NAME} · ${APP_NAME_EN}`, pad, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(226, 222, 255, 0.55)';
  ctx.font = `700 26px ${font}`;
  ctx.fillText(doneStatsText(), W - pad, y);
  return c.toDataURL('image/jpeg', 0.92);
}

/** 随时可保存/分享：每次按当前拼版现拍，没拼完也能导出进度 */
function getPoster() {
  if (!puzzle) return '';
  const board = captureBoard();
  return board ? composePoster(board) : '';
}

function xhsBridge() {
  return window.xhs && window.xhs.miniTool;
}

let doneBusy = false;
async function withBusy(fn) {
  if (doneBusy) return;
  doneBusy = true;
  try {
    await fn();
  } finally {
    doneBusy = false;
  }
}

async function saveDoneImage() {
  const url = getPoster();
  if (!url) return;
  const bridge = xhsBridge();
  if (bridge && typeof bridge.saveImageToPhotosAlbum === 'function') {
    try {
      const filePath = typeof bridge.writeTempFile === 'function'
        ? (await bridge.writeTempFile({ data: url })).filePath
        : url;
      await bridge.saveImageToPhotosAlbum({ filePath });
      setHint('已保存到相册');
    } catch {
      setHint('保存失败，请检查相册权限');
    }
    return;
  }
  setHint('请在小红书内打开后保存');
}

async function shareDoneImage() {
  const url = getPoster();
  if (!url) return;
  const n = puzzle.pieces.length;
  const bridge = xhsBridge();
  if (bridge && typeof bridge.postNote === 'function') {
    const kind = state.doneKind;
    const placed = puzzle.pieces.filter((p) => p.placed).length;
    const how = kind === 'win'
      ? `用时 ${formatDuration(doneMs)} 拼完`
      : kind === 'reveal' ? '拼出了完整画面' : `已经拼了 ${placed}/${n} 块`;
    try {
      await bridge.postNote({
        title: kind ? `我拼好了一幅 ${n} 块拼图` : `我在拼一幅 ${n} 块拼图`,
        content: `用「${APP_NAME}」把照片切成 ${n} 块 3D 纸板拼图，${how}！`,
        pageType: 'photo_publish',
        mediaInfo: { image_resources: [{ url }] },
      });
    } catch {
      setHint('打开发布页失败，可先保存到相册');
    }
    return;
  }
  setHint('请在小红书内打开后分享');
}

function rotateSelected() {
  if (rotating) return;
  if (selectedId == null || !puzzle) {
    setHint('先选一块再旋转');
    return;
  }
  const piece = puzzle.pieces[selectedId];
  if (piece.placed) {
    setHint('先把拼块拿回再旋转');
    return;
  }

  const fromRot = piece.rot || 0;
  const toRot = fromRot + 1; // 连续 +90°，动画走完整一拍
  piece.rot = toRot % 4;
  // 叠放模式：随机倾角让拼块看起来是歪的，转过之后把总角度收成 90° 的整数倍，
  // 这样玩家能看清它的真实朝向（倾角只在 ±20° 内，收完就是摆正）
  const btn = els.tray.querySelector('.piece-thumb.selected');
  const at = btn?._at;
  let fromTilt = at ? at.rot : 0;
  let toTilt = fromTilt;
  if (at) {
    const total = fromTilt + toRot * 90;
    toTilt = Math.round(total / 90) * 90 - toRot * 90;
  }

  const thumbImgs = els.tray.querySelectorAll('.piece-thumb.selected img');
  if (thumbImgs.length) {
    for (const el of thumbImgs) {
      el.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = `rotate(${toRot * 90}deg)`;
    }
  }
  // 倾角同步摆正（与缩略图同一拍）
  if (at && Math.abs(toTilt - fromTilt) > 0.01) {
    piece.trayTilt = toTilt;
    at.rot = toTilt;
    const scale = at.scale;
    btn.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
    btn.style.transform = `rotate(${toTilt}deg) scale(${scale})`;
  }

  const mesh = state.pieceMeshes.get(selectedId);
  const fromY = mesh.rotation.y;
  const toY = toRot * (-Math.PI / 2);
  rotating = true;
  const t0 = performance.now();
  const dur = 320;
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const e = 1 - (1 - t) ** 3;
    mesh.rotation.y = fromY + (toY - fromY) * e;
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      rotating = false;
      applyPieceYaw(mesh, piece);
      for (const el of thumbImgs) {
        el.style.transition = 'none';
        el.style.transform = `rotate(${piece.rot * 90}deg)`;
        void el.offsetWidth;
        el.style.transition = '';
      }
      if (at && Math.abs(toTilt - fromTilt) > 0.01) {
        btn.style.transition = 'none';
        btn.style.transform = `rotate(${toTilt}deg) scale(${at.scale})`;
        void btn.offsetWidth;
        btn.style.transition = '';
      }
    }
  };
  requestAnimationFrame(tick);
}

function syncStepperUI() {
  const { cols, rows } = clampInputs();
  els.colsLabel.textContent = String(cols);
  els.rowsLabel.textContent = String(rows);
  els.gridSummary.textContent = `${cols * rows} 块`;
}

function bumpDim(which, delta) {
  const el = which === 'cols' ? els.cols : els.rows;
  el.value = String(Number(el.value) + delta);
  syncStepperUI();
  if (cropDraft) layoutCropFrame(true);
}

/* ---------- 切分预览：拖动 / 捏合 / 滚轮 / 双击缩放，决定裁切取景 ---------- */

/** 已生效的取景（随当前拼图）；sheet 里编辑的是草稿，点"按此切分"才提交 */
let cropView = { cx: 0.5, cy: 0.5, zoom: 1 };
let cropDraft = null; // { image, cx, cy, zoom }
const CROP_MAX_ZOOM = 5;
const CROP_DOUBLE_ZOOM = 2.5;

function cropImageSize(img) {
  return { iw: img.naturalWidth || img.width, ih: img.naturalHeight || img.height };
}

/** 裁切窗口在预览框里的留白：窗口外露出一圈压暗的原图，看得出还能往哪边挪 */
const CROP_INSET = 14;

/**
 * 预览框尺寸固定（撑满 sheet 宽、固定高度），不随行列变。
 * 行列只决定框内"裁切窗口"的比例：按 列:行 等比放进框里，放不下就缩小，居中。
 */
function cropWindowFor(W, H) {
  const { cols, rows } = clampInputs();
  const a = cols / rows;
  const aw = Math.max(40, W - CROP_INSET * 2);
  const ah = Math.max(40, H - CROP_INSET * 2);
  let cw = aw;
  let ch = cw / a;
  if (ch > ah) {
    ch = ah;
    cw = ch * a;
  }
  return { ox: (W - cw) / 2, oy: (H - ch) / 2, cw, ch };
}

function layoutCropFrame(animate = false) {
  const d = cropDraft;
  if (!d) return;
  d.W = els.cropFrame.clientWidth;
  d.H = els.cropFrame.clientHeight;
  const to = cropWindowFor(d.W, d.H);
  const from = d.win;
  d.win = to;
  renderCrop(animate);
  if (animate && from) tweenCropOverlay(from, to);
  else drawCropGrid(to);
}

/** 行列变化时窗口比例平滑过渡；遮罩和网格逐帧跟着图片的 CSS 过渡走 */
function tweenCropOverlay(from, to) {
  const t0 = performance.now();
  const dur = 260;
  // 与 CSS --ease-out: cubic-bezier(0.22, 1, 0.36, 1) 近似
  const ease = (t) => 1 - Math.pow(1 - t, 3.2);
  cancelAnimationFrame(tweenCropOverlay.raf);
  const step = (now) => {
    if (!cropDraft) return;
    const t = Math.min(1, (now - t0) / dur);
    const e = ease(t);
    const lerp = (k) => from[k] + (to[k] - from[k]) * e;
    drawCropGrid({ ox: lerp('ox'), oy: lerp('oy'), cw: lerp('cw'), ch: lerp('ch') });
    if (t < 1) tweenCropOverlay.raf = requestAnimationFrame(step);
  };
  tweenCropOverlay.raf = requestAnimationFrame(step);
}

/** 把草稿取景夹回合法范围（倍数上下限、裁切框不出图） */
function clampCropDraft() {
  const d = cropDraft;
  const { cols, rows } = clampInputs();
  const { iw, ih } = cropImageSize(d.image);
  d.zoom = Math.min(CROP_MAX_ZOOM, Math.max(1, d.zoom));
  const r = cropRect(iw, ih, cols, rows, d);
  d.cx = (r.x + r.w / 2) / iw;
  d.cy = (r.y + r.h / 2) / ih;
  return r;
}

function renderCrop(animate = false) {
  const d = cropDraft;
  if (!d || !d.win) return;
  const r = clampCropDraft();
  const { ox, oy, cw } = d.win;
  const k = cw / r.w; // 预览像素 / 原图像素
  const img = els.cropImg;
  img.classList.toggle('is-animating', animate);
  img.style.transform = `translate(${ox - r.x * k}px, ${oy - r.y * k}px) scale(${k})`;
  if (animate) {
    clearTimeout(renderCrop.timer);
    renderCrop.timer = setTimeout(() => img.classList.remove('is-animating'), 280);
  }
}

/** 预览用的整板拼块轮廓（单位格边长 1），与 cutPuzzle 同一张凹凸表 */
let cropOutlineCache = null;
function cropOutlinePath(cols, rows) {
  const c = cropOutlineCache;
  if (c && c.cols === cols && c.rows === rows) return c.path;
  const map = buildTabMap(cols, rows);
  const path = new Path2D();
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) tracePieceAt(path, r, col, 1, tabsFor(r, col, cols, rows, map));
  }
  cropOutlineCache = { cols, rows, path };
  return path;
}

/** 遮罩 + 网格：窗口外压暗，窗口内画出每块拼块的分界 */
function drawCropGrid(win) {
  const d = cropDraft;
  if (!d || !win) return;
  const { cols, rows } = clampInputs();
  const { W, H } = d;
  const c = els.cropGrid;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
  }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const { ox, oy, cw, ch } = win;

  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(ox, oy, cw, ch);
  ctx.fillStyle = 'rgba(12, 14, 30, 0.62)';
  ctx.fill('evenodd');

  // 与拼盘同一套凹凸与造型：单位格路径缓存，按窗口缩放绘制
  const outline = cropOutlinePath(cols, rows);
  const s = cw / cols;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, cw, ch);
  ctx.clip();
  // 圆边浮雕：路径画到画布外，只让投影落回来，缝的右下侧（块的左上内沿）提亮、左上侧压暗
  const far = 10000;
  const glow = (color, dir) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 2.5 * dpr;
    ctx.shadowOffsetX = (far + 1.2 * dir) * dpr;
    ctx.shadowOffsetY = 1.2 * dir * dpr;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, (ox - far) * dpr, oy * dpr);
    ctx.lineWidth = 1.6 / s;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.stroke(outline);
    ctx.restore();
  };
  // 与拼盘一致：边缘压暗 + 左上高光右下暗影 + 半透明梅紫拼缝
  glow('rgba(0, 0, 0, 0.22)', 0);
  glow('rgba(255, 255, 255, 0.35)', 1);
  glow('rgba(30, 18, 5, 0.3)', -1);
  ctx.lineJoin = 'round';
  ctx.setTransform(dpr * s, 0, 0, dpr * s, ox * dpr, oy * dpr);
  ctx.lineWidth = 1 / s;
  ctx.strokeStyle = 'rgba(91, 84, 112, 0.6)';
  ctx.stroke(outline);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 181, 71, 0.95)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ox, oy, cw, ch);
}

/** 以预览框内一点 (px, py) 为锚缩放：锚点下的图像位置保持不动 */
function zoomCropAt(nextZoom, px, py, animate = false) {
  const d = cropDraft;
  if (!d.win) return;
  const { cols, rows } = clampInputs();
  const { iw, ih } = cropImageSize(d.image);
  const { ox, oy, cw } = d.win;
  const wx = px - ox;
  const wy = py - oy;
  const r0 = cropRect(iw, ih, cols, rows, d);
  const k0 = cw / r0.w;
  const ix = r0.x + wx / k0;
  const iy = r0.y + wy / k0;
  d.zoom = Math.min(CROP_MAX_ZOOM, Math.max(1, nextZoom));
  const base = cropRect(iw, ih, cols, rows, { cx: 0.5, cy: 0.5, zoom: d.zoom });
  const k1 = cw / base.w;
  d.cx = (ix - wx / k1 + base.w / 2) / iw;
  d.cy = (iy - wy / k1 + base.h / 2) / ih;
  renderCrop(animate);
}

function panCrop(dx, dy) {
  const d = cropDraft;
  if (!d.win) return;
  const { cols, rows } = clampInputs();
  const { iw, ih } = cropImageSize(d.image);
  const r = cropRect(iw, ih, cols, rows, d);
  const k = d.win.cw / r.w;
  d.cx -= dx / k / iw;
  d.cy -= dy / k / ih;
  renderCrop(false);
}

(function bindCropGestures() {
  const frame = els.cropFrame;
  const pts = new Map();
  let pinch = null;
  let tap = null; // 判定"点一下"：按下到抬起移动很小
  let lastTap = null; // 双击：两次点按间隔短且位置接近

  const local = (e) => {
    const r = frame.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  frame.addEventListener('pointerdown', (e) => {
    if (!cropDraft) return;
    frame.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, local(e));
    frame.classList.add('is-dragging');
    if (pts.size === 1) {
      tap = { ...local(e), t: performance.now(), moved: false };
    } else if (pts.size === 2) {
      tap = null;
      const [a, b] = [...pts.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: cropDraft.zoom };
    }
  });

  frame.addEventListener('pointermove', (e) => {
    if (!cropDraft || !pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    const p = local(e);
    pts.set(e.pointerId, p);
    if (pts.size >= 2 && pinch) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // 双指中点的平移也跟着走，捏合时画面不会只缩不移
      panCrop((p.x - prev.x) / 2, (p.y - prev.y) / 2);
      zoomCropAt(pinch.zoom * (dist / Math.max(1, pinch.dist)), mid.x, mid.y);
      return;
    }
    if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 6) tap.moved = true;
    panCrop(p.x - prev.x, p.y - prev.y);
  });

  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0) frame.classList.remove('is-dragging');
    if (!cropDraft || !tap || tap.moved || e.type === 'pointercancel') return;
    const now = performance.now();
    const p = { x: tap.x, y: tap.y };
    tap = null;
    if (lastTap && now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 28) {
      lastTap = null;
      // 双击：没放大就放大到 2.5 倍（以点击处为中心），已放大就缩回铺满
      if (cropDraft.zoom < CROP_DOUBLE_ZOOM * 0.8) zoomCropAt(CROP_DOUBLE_ZOOM, p.x, p.y, true);
      else zoomCropAt(1, p.x, p.y, true);
    } else {
      lastTap = { ...p, t: now };
    }
  };
  frame.addEventListener('pointerup', end);
  frame.addEventListener('pointercancel', end);

  frame.addEventListener('wheel', (e) => {
    if (!cropDraft) return;
    e.preventDefault();
    const p = local(e);
    zoomCropAt(cropDraft.zoom * Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });
})();

/** 打开切分预览：image 是要切的图，view 是初始取景 */
function openCropSheet(image, view, applyLabel = '开始拼图') {
  cropDraft = {
    image,
    cx: view.cx,
    cy: view.cy,
    zoom: view.zoom,
    W: 0,
    H: 0,
    win: null,
    // 没点确认就关掉时，行列改动要撤回，和当前拼图保持一致
    cols0: els.cols.value,
    rows0: els.rows.value,
    committed: false,
  };
  els.cropImg.src = image.src;
  const { iw, ih } = cropImageSize(image);
  els.cropImg.style.width = `${iw}px`;
  els.cropImg.style.height = `${ih}px`;
  els.applyGrid.textContent = applyLabel;
  syncStepperUI();
  els.settingsSheet.setAttribute('aria-hidden', 'false');
  // 框尺寸由 CSS 决定，等这一帧布局落地后再量
  requestAnimationFrame(() => layoutCropFrame(false));
}

async function applyCropSheet() {
  if (!cropDraft) return;
  cropDraft.committed = true;
  sourceImage = cropDraft.image;
  cropView = { cx: cropDraft.cx, cy: cropDraft.cy, zoom: cropDraft.zoom };
  await generatePuzzle();
}

async function generatePuzzle() {
  if (!sourceImage) {
    setHint('先选一张照片');
    return;
  }
  const { cols, rows } = clampInputs();
  const total = cols * rows;
  setHint(total > SOFT_TOTAL ? `生成中 ${total} 块…` : `生成中…`);
  try {
    puzzle = await cutPuzzle(sourceImage, cols, rows, cropView);
    await rebuildScene(puzzle);
    resetDone();
    state.startAt = performance.now();
    selectedId = null;
    clearSlotHints();
    renderTray();
    els.solve.disabled = false;
    els.scatter.disabled = false;
    els.restart.disabled = false;
    els.saveBtn.disabled = false;
    els.shareBtn.disabled = false;
    if (els.hintBtn) els.hintBtn.disabled = false;
    setHint(`${cols * rows} 块拼图，开始吧`);
    closeSettings();
  } catch (err) {
    setHint(err.message || '生成失败');
  }
}

els.file.addEventListener('change', async () => {
  const file = els.file.files?.[0];
  if (!file) return;
  try {
    const img = await loadImage(file);
    // 沿用当前行列，先弹出切分预览让玩家定取景，确认后才真正切分
    openCropSheet(img, { cx: 0.5, cy: 0.5, zoom: 1 }, '开始拼图');
  } catch (err) {
    setHint(err.message || '加载失败');
  } finally {
    // 清空后同一张图可以再次选择
    els.file.value = '';
  }
});

els.scatter.addEventListener('click', shuffleUnplaced);
els.restart.addEventListener('click', openRestartConfirm);
els.restartCancel.addEventListener('click', closeRestartConfirm);
els.restartCancelScrim.addEventListener('click', closeRestartConfirm);
els.restartOk.addEventListener('click', () => {
  closeRestartConfirm();
  scatterAll();
});
els.solve.addEventListener('click', solveAll);
els.rotate?.addEventListener('click', rotateSelected);
els.hintBtn?.addEventListener('click', toggleHint);
els.colsMinus.addEventListener('click', () => bumpDim('cols', -1));
els.colsPlus.addEventListener('click', () => bumpDim('cols', 1));
els.rowsMinus.addEventListener('click', () => bumpDim('rows', -1));
els.rowsPlus.addEventListener('click', () => bumpDim('rows', 1));
els.applyGrid.addEventListener('click', applyCropSheet);
els.trayMode.addEventListener('click', () => {
  setTrayMode(state.trayMode === 'stack' ? 'list' : 'stack');
});
// 叠放模式下由轮廓命中判定决定选哪一块（捕获阶段拦下，避免按钮自身的矩形判定先跑）
els.tray.addEventListener('click', (e) => {
  if (state.trayMode !== 'stack') return;
  const id = pickStackPiece(e);
  e.stopPropagation();
  if (id != null) selectPiece(id);
}, true);

function openSettings() {
  if (!sourceImage) {
    els.file.click();
    return;
  }
  openCropSheet(sourceImage, cropView);
}
function closeSettings() {
  els.settingsSheet.setAttribute('aria-hidden', 'true');
  if (cropDraft && !cropDraft.committed) {
    els.cols.value = cropDraft.cols0;
    els.rows.value = cropDraft.rows0;
    syncStepperUI();
  }
  cropDraft = null;
}
window.addEventListener('resize', () => {
  if (cropDraft) layoutCropFrame(false);
});
els.settingsBtn.addEventListener('click', openSettings);
els.settingsClose.addEventListener('click', closeSettings);
els.settingsScrim.addEventListener('click', closeSettings);
els.saveBtn.addEventListener('click', () => withBusy(saveDoneImage));
els.shareBtn.addEventListener('click', () => withBusy(shareDoneImage));

initScene();
syncStepperUI();
setTrayMode('list');

(function bootDemo() {
  const c = document.createElement('canvas');
  c.width = 720;
  c.height = 1080;
  const ctx = c.getContext('2d');
  // 马卡龙色块：既可爱，又能一眼看出切图是否正确
  const colors = ['#ff8fae', '#7fd8c4', '#ffd27d', '#9ccdff', '#c8b6ff', '#ffb38a'];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = colors[(x + y * 3) % colors.length];
      ctx.fillRect((x * 720) / 4, (y * 1080) / 6, 720 / 4 + 1, 1080 / 6 + 1);
    }
  }
  ctx.fillStyle = 'rgba(94, 52, 74, 0.5)';
  ctx.font = '700 64px "Baloo 2", "Yuanti SC", serif';
  ctx.fillText('拼图', 80, 540);
  c.toBlob(async (blob) => {
    sourceImage = await loadImage(blob);
    const sg = suggestGrid(720, 1080, 24);
    els.cols.value = sg.cols;
    els.rows.value = sg.rows;
    syncStepperUI();
    setHint('点「选图」换成你的照片');
    await generatePuzzle();
  });
})();
