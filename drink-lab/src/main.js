import { LQ, addLiquidFog, FOAM_FRAG } from './liquid.js?v=112';
import { LB, buildLiquidBody, mediaColor } from './liquidbody.js?v=112';
import { BASES, MILKS, SYRUPS, FOAMS, POUR, FOAM_MAX, CUP_SHAPES, CUP_SIZES } from './data.js?v=112';
import { audioInit, pourStart, pourStop, plop, shakeStart, shakeStop, drain, tick, sprinkle } from './audio.js?v=112';
import { makeCupSpec, buildCup } from './cup.js?v=112';
import { KINDS, FRUITS, CUTS, kindVisual, canvasTex } from './items.js?v=112';
import { DECOR, STRAWS, buildStraw, setSleeveImage } from './decor.js?v=112';
import { makePoster } from './share.js?v=112';
import { Sim } from './sim.js?v=112';
import { drinkName } from './names.js?v=112';

const THREE = window.THREE;
const MAX_ITEMS = 760;
// 小料只按“杯里还有多少空位”限制，不再设每种东西的份数上限
for (const id in KINDS) {
  const d = KINDS[id];
  if (d.cat === 'topping' || d.cat === 'dust' || d.cat === 'ice') {
    d.n = Math.max(4, Math.round(d.n * 1.5));
    d.max = 400;
  }
}
const SHAKE_DUR = 1.8;
const WATER = { A: [0.004, 0.003, 0.002], S: [0, 0, 0], rho: 1, visc: 1 };
const GROUPS = { tea: BASES, milk: MILKS, syrup: SYRUPS, foam: FOAMS };

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
// 产品渲染的关键：ACES 把高光滚到白色而不是直接截断，玻璃边缘和冰块才有层次
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;

const scene = new THREE.Scene();
scene.background = studioTexture();
  scene.backgroundIntensity = 1.0;
scene.environment = buildEnv();

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

// 三点布光：暖主光定形，冷轮廓光勾玻璃边，正面补光把暗部抬起来
scene.add(new THREE.HemisphereLight(0xfff4e6, 0xdcbba4, 0.78));
const sun = new THREE.DirectionalLight(0xfff0dd, 1.45);
sun.position.set(3.6, 7.2, 4.4);
scene.add(sun);
const LIGHT_W = sun.position.clone().normalize();

const rim = new THREE.DirectionalLight(0xd6e6ff, 0.72);
rim.position.set(-5.5, 3.2, -4.2);
scene.add(rim);
const LIGHT2_W = rim.position.clone().normalize();

const fill = new THREE.DirectionalLight(0xffe6d2, 0.34);
fill.position.set(-2.6, 0.8, 5.5);
scene.add(fill);

// 接触阴影：一层紧贴杯底，一层更大更淡，避免像贴纸一样浮着
// 接触阴影：紧贴杯底的一圈最深，外面再散开两层
const shadowMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.62 });
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.001; shadow.renderOrder = -1;
scene.add(shadow);
const shadowWide = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat.clone());
shadowWide.material.opacity = 0.26;
shadowWide.rotation.x = -Math.PI / 2; shadowWide.position.y = 0.0015; shadowWide.renderOrder = -1;
scene.add(shadowWide);

// 焦散：光穿过玻璃杯在台面上聚出的一圈亮斑，是“真玻璃放在真台面上”的关键
function causticTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 30, 128, 128, 126);
  gr.addColorStop(0, 'rgba(255,244,225,0)');
  gr.addColorStop(0.55, 'rgba(255,246,228,0.10)');
  gr.addColorStop(0.80, 'rgba(255,248,234,0.55)');
  gr.addColorStop(0.94, 'rgba(255,250,240,0.20)');
  gr.addColorStop(1, 'rgba(255,250,240,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  // 亮斑不是均匀一圈：上沿更亮，下沿被杯子挡住
  g.globalCompositeOperation = 'destination-out';
  const cut = g.createLinearGradient(0, 0, 0, 256);
  cut.addColorStop(0, 'rgba(0,0,0,0)');
  cut.addColorStop(1, 'rgba(0,0,0,0.75)');
  g.fillStyle = cut; g.fillRect(0, 90, 256, 166);
  return new THREE.CanvasTexture(c);
}
const caustic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
  map: causticTexture(), transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, opacity: 0.5,
}));
caustic.rotation.x = -Math.PI / 2; caustic.position.y = 0.002; caustic.renderOrder = -1;
scene.add(caustic);

// 影棚台面：杯子有落点，玻璃折射也有内容可折射（否则背景太干净，玻璃会“消失”）
const table = new THREE.Mesh(
  new THREE.CircleGeometry(18, 96),
  new THREE.MeshStandardMaterial({ color: 0x24302c, roughness: 0.7, metalness: 0 }),
);
table.rotation.x = -Math.PI / 2;
table.position.y = -0.012;
scene.add(table);

const cup = new THREE.Group();
scene.add(cup);

// 汽水气泡
const MAX_BUB = 260;
const bubPos = new Float32Array(MAX_BUB * 3);
const bubSpeed = new Float32Array(MAX_BUB);
const bubGeo = new THREE.BufferGeometry();
bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
const bubMat = new THREE.PointsMaterial({
  size: 0.05, map: canvasTex(32, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }), transparent: true, depthWrite: false, opacity: 0.8,
});
const bubbles = new THREE.Points(bubGeo, bubMat);
bubbles.renderOrder = 4; bubbles.frustumCulled = false;

const streamMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, roughness: 0.26, transparent: true, opacity: 0.9,
  clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.85, ior: 1.34, depthWrite: false,
});
const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 1, 14, 1, true), streamMat);
stream.renderOrder = 4; stream.visible = false;

// 奶盖是半固体：单独一块绵密的“盖子”，不跟着液面晃，顶上微微拱起、表面有细小起伏
const foamMat = addLiquidFog(new THREE.MeshPhysicalMaterial({
  color: 0xffffff, roughness: 0.86, sheen: 0.9, sheenRoughness: 0.55,
  sheenColor: new THREE.Color(0xfff6ea), envMapIntensity: 0.5, ior: 1.35,
}), FOAM_FRAG);
const foamMesh = new THREE.Mesh(foamGeometry(), foamMat);
foamMesh.renderOrder = 4; foamMesh.visible = false;
foamMesh.castShadow = false;

function foamGeometry() {
  // 倒进杯里的奶盖：底部贴着杯壁、往上收成一个扁而宽的软弧，
  // 表面是被勺背抹过/自然摊开的起伏，不是规整的半球
  const prof = [
    [1.012, -0.16], [1.008, -0.06], [1.002, 0.04], [0.998, 0.16], [0.994, 0.3],
    [0.986, 0.44], [0.972, 0.57], [0.95, 0.69], [0.918, 0.79], [0.874, 0.868],
    [0.816, 0.925], [0.74, 0.965], [0.648, 0.988], [0.545, 1.0], [0.43, 1.0],
    [0.31, 0.997], [0.18, 0.993], [0.001, 0.99],
  ];
  const geo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 128);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const th = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z);
    const k = THREE.MathUtils.smoothstep(v.y, 0.02, 0.72);      // 只动上半部分
    const wall = 1 - THREE.MathUtils.smoothstep(r, 0.86, 1.0);   // 贴杯壁的边保持圆
    // 轮廓不圆：三大块软鼓 + 细碎小起伏
    const lobe = 0.026 * Math.sin(3 * th + 1.1) + 0.015 * Math.sin(5 * th - 0.6) + 0.008 * Math.sin(8 * th + 2.4);
    // 表面：中心舒展、靠边略低，带两道很缓的抹痕
    const ripple = 0.020 * Math.sin(2 * th + 0.7) + 0.012 * Math.sin(4 * th - 1.4) + 0.006 * Math.sin(7 * th + 0.2);
    // 中间偏一点的小堆头，像刚倒完没抹平
    const peak = 0.028 * Math.exp(-Math.pow((r - 0.16) / 0.22, 2)) * (0.75 + 0.25 * Math.sin(th - 0.9));
    const rr = r * (1 + (lobe * k + 0.006 * Math.sin(9 * th + r * 9)) * (0.18 + 0.82 * wall));
    const y = v.y + (ripple * 0.85 + peak) * k * wall;
    p.setXYZ(i, Math.cos(th) * rr, y, Math.sin(th) * rr);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- 状态 ----------
const sim = new Sim();
const mkPart = () => ({ vol: 0, A: [0, 0, 0], S: [0, 0, 0], col: [0, 0, 0], dust: [0, 0, 0], dustVol: 0, rho: 0, visc: 0, fizz: 0, by: {} });
const st = {
  shape: 0, size: 1, spec: null, cupObj: null, lb: null,
  tea: mkPart(), milk: mkPart(), syrup: mkPart(), foam: mkPart(),
  u: 0, us: 0, age: 99, flow: 0, ripple: 0, stripe: 0, stripeH: 0,
  carb: 0, fizzFoam: 0, churn: 0,
  pours: [], shakeT: 0, disp: 0, level: 0, surfY: 0, foamTop: 0, surfCtx: [], foamR: 1, foamH: 0, foamY0: 0,
  straw: 'none', strawMesh: null,
  decor: new Map(),
  order: [],
};
const instMeshes = {};

function setCup(shapeIdx, sizeIdx) {
  st.shape = shapeIdx; st.size = sizeIdx;
  const spec = makeCupSpec(CUP_SHAPES[shapeIdx], CUP_SIZES[sizeIdx]);
  st.spec = spec;
  // 旧杯子的几何体是每次新建的，丢掉前先释放，避免随机切换时 GPU 一直涨
  if (st.cupObj) {
    for (const c of st.cupObj.group.children) c.geometry && c.geometry.dispose();
    st.cupObj.liquidGeo && st.cupObj.liquidGeo.dispose();
  }
  while (cup.children.length) cup.remove(cup.children[0]);
  for (const k in instMeshes) delete instMeshes[k];
  const built = buildCup(spec);
  st.cupObj = built;
  const lb = buildLiquidBody(spec, built.liquidGeo);
  st.lb = lb;
  cup.add(built.group, lb.body, lb.cap, bubbles, stream, foamMesh);
  LQ.uShape.value = spec.kind;
  LB.uShape.value = spec.kind;
  if (spec.kind === 0) { LQ.uCone.value.set(spec.ac, spec.kc); LB.uCone.value.set(spec.ac, spec.kc); }
  else { LQ.uSph.value.set(spec.cy, spec.Rs); LB.uSph.value.set(spec.cy, spec.Rs); }
  LQ.uYb.value = spec.yb; LQ.uYt.value = spec.yt;
  LB.uYb.value = spec.yb; LB.uYt.value = spec.yt;
  sim.setCup(spec);
  clearDrink();
  const decorIds = [...st.decor.keys()];
  st.decor.clear();
  decorIds.forEach((id) => toggleDecor(id, true));
  setStraw(st.straw);
  const sr = (spec.kind === 1 ? spec.Rs : Math.max(spec.rb, spec.rt)) * 4.4;
  shadow.scale.set(sr * 1.15, sr * 1.2, 1);
  shadowWide.scale.set(sr * 2.0, sr * 1.95, 1);
  caustic.scale.set(sr * 1.9, sr * 1.45, 1);
  resize();
}

function clearDrink() {
  seqCancel();
  st.tea = mkPart(); st.milk = mkPart(); st.syrup = mkPart(); st.foam = mkPart();
  st.u = 0; st.us = 0; st.age = 99; st.stripe = 0; st.carb = 0; st.fizzFoam = 0; st.churn = 0;
  st.pours.length = 0; st.shakeT = 0; st.order.length = 0;
  pourStop(); shakeStop();
  sim.clear();
  for (let i = 0; i < MAX_BUB; i++) bubPos[i * 3 + 1] = -99;
}

function packPart(p) {
  return { vol: p.vol, A: [...p.A], S: [...p.S], col: [...p.col], dust: [...p.dust],
    dustVol: p.dustVol, rho: p.rho, visc: p.visc, fizz: p.fizz, by: { ...p.by } };
}
function packState(label) {
  return {
    label, name: customName || $name?.value || '', shape: st.shape, size: st.size,
    straw: st.straw, decor: [...st.decor.keys()].filter((k) => k !== 'photo'),
    tea: packPart(st.tea), milk: packPart(st.milk), syrup: packPart(st.syrup), foam: packPart(st.foam),
    u: st.u, us: st.us, carb: st.carb, order: [...st.order],
    items: sim.ps.map((p) => ({
      id: p.def.id, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz,
      q: [p.q.x, p.q.y, p.q.z, p.q.w], w: [p.w.x, p.w.y, p.w.z],
      s: [p.s.x, p.s.y, p.s.z], mul: p.mul, m: p.m, rho: p.rho, seed: p.seed,
    })),
  };
}
function unpackPart(dst, src) {
  Object.assign(dst, src);
  dst.A = [...src.A]; dst.S = [...src.S]; dst.col = [...src.col]; dst.dust = [...src.dust];
  dst.by = { ...src.by };
}
function restoreState(data) {
  if (!data || !CUP_SHAPES[data.shape] || !CUP_SIZES[data.size]) return;
  for (const d of st.decor.values()) cup.remove(d.obj);
  st.decor.clear();
  setCup(data.shape, data.size);
  unpackPart(st.tea, data.tea); unpackPart(st.milk, data.milk);
  unpackPart(st.syrup, data.syrup); unpackPart(st.foam, data.foam);
  st.u = data.u || 0; st.us = data.us || 0; st.carb = data.carb || 0;
  st.order = [...(data.order || [])];
  for (const item of data.items || []) {
    const def = KINDS[item.id];
    if (!def) continue;
    const p = sim.add(def, item.x, item.y, item.z, item.mul || 1);
    p.vx = item.vx || 0; p.vy = item.vy || 0; p.vz = item.vz || 0;
    p.q.set(...(item.q || [0, 0, 0, 1]));
    p.w.set(...(item.w || [0, 0, 0])); p.s.set(...(item.s || [1, 1, 1]));
    p.m = item.m ?? 1; p.rho = item.rho ?? def.rho; p.seed = item.seed || 0;
  }
  for (const id of data.decor || []) if (DECOR[id]) toggleDecor(id, true);
  setStraw(data.straw || 'none');
  customName = data.name || ''; $name.value = customName;
  updateHud(); toast(`已恢复「${data.label || customName || '未命名配方'}」`);
}
function saveState() {
  if (liquidVol() < 1e-5 && st.foam.vol < 1e-5 && sim.ps.length === 0) {
    toast('空杯不能保存');
    return;
  }
  const defaultName = customName || drinkName({
    tea: Object.keys(st.tea.by)[0], milk: Object.keys(st.milk.by)[0],
    syrup: Object.keys(st.syrup.by)[0], fruits: [], toppings: st.order, ice: !!sim.count('ice'),
  });
  const label = window.prompt('保存这杯饮品，可以修改名字', defaultName);
  if (label == null) return;
  const all = JSON.parse(localStorage.getItem('drinkLab.states') || '[]');
  all.unshift(packState(label.trim() || '未命名配方'));
  localStorage.setItem('drinkLab.states', JSON.stringify(all.slice(0, 30)));
  toast('已保存当前状态');
  renderSaveList();
}
function renderSaveList() {
  const list = document.getElementById('saveList');
  const all = JSON.parse(localStorage.getItem('drinkLab.states') || '[]');
  list.innerHTML = '';
  if (!all.length) {
    list.innerHTML = '<p class="save-empty">还没有保存的饮品</p>';
    return;
  }
  all.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'save-item';
    const load = document.createElement('button');
    load.className = 'save-load';
    load.innerHTML = `<span>${item.label || '未命名配方'}<small>点击替换当前饮品</small></span><span>›</span>`;
    load.onclick = () => {
      const occupied = liquidVol() >= 1e-5 || st.foam.vol >= 1e-5 || sim.ps.length > 0;
      if (occupied) {
        pendingRestore = item;
        document.getElementById('replaceText').textContent = `恢复「${item.label}」会覆盖当前饮品。`;
        document.getElementById('replaceMask').classList.add('show');
        return;
      }
      restoreState(item);
      document.getElementById('saveMask').classList.remove('show');
    };
    const remove = document.createElement('button');
    remove.className = 'save-delete';
    remove.textContent = '删除';
    remove.onclick = () => {
      if (!window.confirm(`确定删除「${item.label}」吗？`)) return;
      const next = all.filter((_, index) => index !== i);
      localStorage.setItem('drinkLab.states', JSON.stringify(next));
      renderSaveList();
      toast('已删除保存的饮品');
    };
    row.append(load, remove);
    list.appendChild(row);
  });
}
let pendingRestore = null;
function closeReplace() {
  pendingRestore = null;
  document.getElementById('replaceMask').classList.remove('show');
}
document.getElementById('replaceCancel').onclick = closeReplace;
document.getElementById('replaceConfirm').onclick = () => {
  if (pendingRestore) restoreState(pendingRestore);
  document.getElementById('saveMask').classList.remove('show');
  closeReplace();
};
document.getElementById('replaceMask').addEventListener('click', (e) => {
  if (e.target.id === 'replaceMask') closeReplace();
});
function openSaveSheet() {
  renderSaveList();
  document.getElementById('saveMask').classList.add('show');
}
function closeSaveSheet() {
  document.getElementById('saveMask').classList.remove('show');
}
function loadState() {
  const all = JSON.parse(localStorage.getItem('drinkLab.states') || '[]');
  if (!all.length) { toast('还没有保存的饮品'); return; }
  const menu = all.map((x, i) => `${i + 1}. ${x.label}`).join('\n');
  const raw = window.prompt(`输入要恢复的编号：\n${menu}`, '1');
  const i = Number(raw) - 1;
  if (Number.isInteger(i) && all[i]) restoreState(all[i]);
}

const liquidVol = () => st.tea.vol + st.milk.vol + st.syrup.vol;
const mixedCol = new THREE.Color(), mixed2 = new THREE.Color();
const colorTmp = new THREE.Color();
// 每种饮料的颜色按它自己的吸收/散射系数算，再加权平均：
// 这样红茶是红茶色、抹茶是抹茶绿，混在一起也不会变成一坨灰
function mediaMix(out, part, group, d) {
  const G = GROUPS[group];
  let r = 0, g = 0, b = 0, n = 0;
  for (const id in part.by) {
    const def = G[id];
    if (!def || !def.A) continue;
    mediaColor(def.A, def.S || [0, 0, 0], d, colorTmp, group === 'milk');
    const w = part.by[id];
    r += colorTmp.r * w; g += colorTmp.g * w; b += colorTmp.b * w; n += w;
  }
  if (n > 1e-6) out.set(r / n, g / n, b / n);
  else out.set(0.74, 0.83, 0.81);
  return out;
}

// ---------- 倒液体 ----------
function pour(group, id, frac = POUR[group], speed = 1) {
  if (!inSeq) seqCancel();
  st.pours.push({ group, id, left: frac * st.spec.capacity, speed });
}

function addLiquid(group, def, dv, keepMix = false) {
  const p = st[group];
  const before = group === 'syrup' ? p.vol : st.tea.vol + st.milk.vol;
  p.vol += dv;
  for (let k = 0; k < 3; k++) {
    if (def.A) p.A[k] += def.A[k] * dv;
    if (def.S) p.S[k] += def.S[k] * dv;
    if (def.col) p.col[k] += def.col[k] * dv;
  }
  if (def.dust) { p.dustVol += dv; for (let k = 0; k < 3; k++) p.dust[k] += def.dust[k] * dv; }
  p.rho += def.rho * dv; p.visc += def.visc * dv; p.fizz += (def.fizz || 0) * dv;
  if (def.id) p.by[def.id] = (p.by[def.id] || 0) + dv;
  if ((group === 'tea' || group === 'milk') && !keepMix) {
    if (before > 0) st.u *= before / (before + dv);
    if (st.tea.vol === 0) st.u = 1;
  }
  if (group === 'syrup' && before > 0) st.us *= before / (before + dv);
}

function applyPour(dt) {
  const p = st.pours[0];
  if (!p) { stream.visible = false; pourStop(); return; }
  const def = GROUPS[p.group][p.id];
  const spec = st.spec;
  // 奶盖不占杯子容量：它是堆在杯口上面的一坨
  const foam = p.group === 'foam';
  const room = foam
    ? FOAM_MAX * spec.capacity - st.foam.vol
    : spec.capacity - (liquidVol() + st.disp);
  if (!p.started) {
    p.started = true;
    p.t0 = performance.now();
    if (foam && liquidVol() < 1e-6) { st.pours.shift(); toast('先倒点喝的，奶盖要浮在上面'); return; }
    if (room < 0.05) { st.pours.length = 0; pourStop(); if (!foam) toast('杯子满啦'); return; }
    if (p.group === 'foam' && sim.count('scoopV') + sim.count('scoopC') + sim.count('scoopS') + sim.count('scoopM') > 0) {
      clearScoops();
      toast('冰淇淋换成奶盖了');
    }
    pourStart(p.group, def.visc);
    if (p.group === 'milk' || p.group === 'tea') st.age = 0;
    if (p.group === 'tea' && def.fizz) st.carb = 1;
    if (p.group === 'syrup') { st.stripe = 1; st.stripeH = Math.min(spec.yt, Math.max(st.level + 0.8, spec.yb + (spec.yt - spec.yb) * 0.6)); }
  }
  const rate = spec.capacity * 0.28 * (p.speed || 1) / Math.sqrt(def.visc);
  // 真机掉帧时 dt 会被夹住，倒入会拖得没完；超过 2.5 秒就加速收尾
  const overtime = performance.now() - (p.t0 || 0) > 2500;
  const dv = Math.min(p.left, rate * dt * (overtime ? 6 : 1), Math.max(room, 0));
  addLiquid(p.group, { ...def, id: p.id }, dv);
  p.left -= dv;
  st.ripple = Math.max(st.ripple, p.group === 'syrup' ? 0.15 : 0.5);

  streamMat.color.set(def.dot);
  streamMat.opacity = def.S && def.S[0] < 0.5 ? 0.75 : 1;
  const top = spec.H + 3, bottom = Math.max(spec.yb, st.level);
  const r = { tea: 0.06, milk: 0.06, syrup: 0.035, foam: 0.1 }[p.group];
  stream.visible = true;
  stream.scale.set(r * (0.9 + Math.sin(st.flow * 40) * 0.1), top - bottom, r);
  stream.position.set(-spec.rTop * 0.25, (top + bottom) / 2, -0.1);

  if (p.left <= 1e-5 || room <= 1e-5) {
    st.pours.shift();
    if (room <= 1e-5 && !foam) { st.pours.length = 0; toast('杯子满啦'); }
    if (!st.pours.length) pourStop();
  }
}

// ---------- 加料 ----------
function cupUsed() {
  let v = 0;
  for (const p of sim.ps) v += (p.def.vol || 0) * (p.def.footprint || 1);
  return v;
}

function addItem(id) {
  if (!inSeq) seqCancel();
  const def = KINDS[id];
  if (def.cat === 'top' && liquidVol() < 1e-6) { toast('先倒点喝的，冰淇淋要坐在液面上'); return; }
  if (def.cat === 'dust' && liquidVol() < 1e-6) { toast('先倒点喝的，撒料才有东西托着'); return; }
  if (def.cat === 'top' && st.foam.vol > 0) {
    clearFoam();
    toast('奶盖换成冰淇淋了');
  }
  if (sim.ps.length >= MAX_ITEMS) { toast('杯里塞不下啦'); return; }
  const spec = st.spec;
  // 只按杯子的空位限制：装得下就一直能加，满了才提示
  const roomV = spec.capacity * 1.45 - liquidVol() - st.disp - cupUsed();
  const per = Math.max((def.vol || 0.004) * (def.fit ? spec.rTop * def.fit : 1), 0.0015);
  const fitN = Math.floor(roomV / per);
  if (fitN <= 0) { toast('杯子装满啦'); return; }
  const n = Math.min(def.n, fitN, MAX_ITEMS - sim.ps.length);
  // 冰淇淋这类按杯口缩放，铺满整个杯口
  const mul = def.fit ? spec.rTop * def.fit : 1;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * spec.rTop * 0.5;
    const x = def.fit ? 0 : Math.cos(a) * r, z = def.fit ? 0 : Math.sin(a) * r;
    sim.add(def, x, spec.yt + 0.4 + def.r * mul + i * def.r * mul * 0.6, z, mul);
  }
  if (def.cat === 'dust') sprinkle();
  if (!st.order.includes(id)) st.order.push(id);
}

// 一次加好几颗的时候声音会叠成一团，稍微限一下
let plopT = 0, plopN = 0;
function onPlop(def, speed) {
  const now = performance.now();
  if (now - plopT > 150) { plopT = now; plopN = 0; }
  if (plopN++ > 3) return;
  plop({ rho: def.rho, r: def.r, vol: def.vol, speed, kind: def.cat === 'ice' ? 'ice' : '' });
}

function onMelt(def, dv) {
  if (!liquidVol()) return;
  // 融化是慢慢渗开的，不重新制造云絮
  if (def.meltInto === 'water') addLiquid('tea', WATER, dv, true);
  else addLiquid('milk', { A: def.creamA, S: [10, 10, 9.6], rho: 1.03, visc: 2 }, dv, true);
}

// 奶盖只能占着杯口，加冰淇淋时让位（反过来加奶盖也一样）
function clearFoam() {
  st.foam = mkPart();
}
function clearScoops() {
  for (let i = sim.ps.length - 1; i >= 0; i--) if (sim.ps[i].def.cat === 'top') sim.ps.splice(i, 1);
  st.order = st.order.filter((k) => KINDS[k].cat !== 'top');
}

function ensureInst(id) {
  if (instMeshes[id]) return instMeshes[id];
  const d = KINDS[id];
  const { geo, mat } = kindVisual(id);
  const m = new THREE.InstancedMesh(geo, mat, d.max);
  m.count = 0; m.frustumCulled = false;
  // 透明的冰/晶球要画在杯壁之后（杯壁是 8），否则会被杯子的折射整片盖掉
  m.renderOrder = mat.transparent || mat.depthWrite === false ? 12 : 4;
  if (d.multiColor) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(d.max * 3), 3);
  cup.add(m);
  instMeshes[id] = m;
  return m;
}

// ---------- 装饰 / 吸管 ----------
function toggleDecor(id, force) {
  const d = DECOR[id];
  if (st.decor.has(id) && !force) {
    cup.remove(st.decor.get(id).obj);
    st.decor.delete(id);
    return;
  }
  if (d.noSphere && st.spec.kind === 1) { if (!force) toast('圆肚杯套不上杯套'); return; }
  // 杯套只能有一个：自定义图片和牛皮纸、针织互斥
  if (id === 'photo') {
    for (const k of ['kraft', 'knit']) if (st.decor.has(k)) toggleDecor(k);
  } else if (id === 'kraft' || id === 'knit') {
    if (st.decor.has('photo')) toggleDecor('photo');
  }
  const obj = d.build({ spec: st.spec, outerAt: st.cupObj.outerAt });
  cup.add(obj);
  st.decor.set(id, { obj, sw: { x: 0, z: 0, vx: 0, vz: 0 } });
}

function setStraw(id) {
  st.straw = id;
  if (st.strawMesh) { cup.remove(st.strawMesh); st.strawMesh.geometry.dispose(); st.strawMesh = null; }
  const m = buildStraw(id, st.spec);
  if (m) { cup.add(m); st.strawMesh = m; }
}

// ---------- 摇 ----------
function shake() {
  if (st.shakeT > 0) return;
  st.shakeT = SHAKE_DUR;
  audioInit();
  shakeStart(SHAKE_DUR);
}

// ---------- 随机一杯 ----------
const pick = (o) => { const k = Object.keys(o); return k[Math.floor(Math.random() * k.length)]; };
const chance = (p) => Math.random() < p;

// 随机配方不是瞬间摆好，而是一步步做出来：等液体倒完再接下一件，节奏才像真的。
// 用墙钟定时器推进，不依赖渲染帧——掉帧/切后台也不会把队列卡在半路。
let seq = [], seqWait = 0, inSeq = false, hudBackup = 0;
const pourWatch = { left: -1, since: 0 };
function seqCancel() { seq.length = 0; seqWait = 0; }
function seqStep(fn, gap = 0.45) { seq.push({ fn, gap }); }
function seqTick() {
  if (inSeq) return;
  if (st.pours.length) {
    // 渲染帧被节流/卡住时，倒入也跟着停；用墙钟补进，别让队列干等
    const idle = performance.now() - lastFrameAt;
    if (idle > 400) applyPour(Math.min(idle / 1000, 0.5));
    // 超过 2.5 秒还是没有进展，就把剩余量直接补上
    const p = st.pours[0];
    if (p && p.left !== pourWatch.left) { pourWatch.left = p.left; pourWatch.since = performance.now(); }
    else if (p && performance.now() - pourWatch.since > 2500) {
      const def = GROUPS[p.group][p.id];
      if (p.left > 1e-6) addLiquid(p.group, { ...def, id: p.id }, p.left);
      p.left = 0; st.pours.shift(); stream.visible = false; pourStop();
      pourWatch.left = -1;
    }
    hudT = 0; updateHud();
    return;
  }
  pourWatch.left = -1;
  if (!seq.length) {
    // 渲染帧被节流时，文字状态也别停在上一步
    if ((++hudBackup % 4) === 0) updateHud();
    return;
  }
  // 间隔用墙钟算：定时器被节流也会按真实时间放行
  if (seqWait > performance.now()) return;
  const s = seq.shift();
  inSeq = true;
  try { s.fn(); } catch (e) { console.error('[sequence]', e); }
  finally { inSeq = false; }
  seqWait = performance.now() + (s.gap || 0) * 1000;
}
setInterval(seqTick, 80);

function surprise() {
  seqCancel();
  // 先摘掉旧装饰再换杯型，否则 setCup 会把旧装饰按新杯子重建一遍再丢掉
  [...st.decor.keys()].forEach((id) => toggleDecor(id));
  setCup(Math.floor(Math.random() * CUP_SHAPES.length), Math.floor(Math.random() * 3));
  const kindsBy = (cat) => Object.keys(KINDS).filter((k) => KINDS[k].cat === cat);
  const any = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = st.spec.capacity;

  // 先规划整杯，再按顺序执行；算好配料占的体积，给底饮留空间
  let used = 0, syrupFrac = 0;
  const addStep = (id) => {
    const d = KINDS[id];
    const n = Math.min(d.n || 1, d.max || d.n || 1);
    used += (d.vol || (4 / 3) * Math.PI * Math.pow(d.r || 0.1, 3)) * n * 0.85;
    seqStep(() => addItem(id), 0.4);
  };
  const pourStep = (g, id, frac, speed) => seqStep(() => pour(g, id, frac, speed), 0.24);

  if (chance(0.55)) { syrupFrac = 0.05 + Math.random() * 0.05; pourStep('syrup', pick(SYRUPS), syrupFrac, 1.2); }
  if (chance(0.7)) addStep(any(kindsBy('topping')));
  if (chance(0.6)) addStep(any(kindsBy('fruit')));
  if (chance(0.3)) addStep(any(kindsBy('fruit')));
  if (chance(0.6)) addStep('ice');

  // 奶和茶最后倒，配料先在杯底，酱料先挂壁
  const milk = chance(0.65) ? 0.16 + Math.random() * 0.16 : 0;
  const filled = used / cap + syrupFrac;
  if (milk) pourStep('milk', pick(MILKS), milk, 3.4);
  pourStep('tea', pick(BASES), Math.max(0.15, 0.97 - filled - milk), 3.4);
  if (chance(0.45)) pourStep('foam', pick(FOAMS), FOAM_MAX, 2.6);
  else if (chance(0.4)) addStep(any(kindsBy('top')));
  if (chance(0.55)) addStep(any(kindsBy('dust')));

  seqStep(() => {
    const dk = Object.keys(DECOR).filter((k) => k !== 'lid' && k !== 'photo');
    for (let i = 0; i < 2; i++) if (chance(0.6)) { const k = dk[Math.floor(Math.random() * dk.length)]; if (!st.decor.has(k)) toggleDecor(k); }
    const sk = Object.keys(STRAWS);
    setStraw(sk[1 + Math.floor(Math.random() * (sk.length - 1))]);
    renderChips();
  }, 0.25);
}

// ---------- UI ----------
const TABS = [
  ['cup', '杯子'], ['base', '底饮'], ['milk', '奶'], ['syrup', '酱料'], ['topping', '小料'],
  ['fruit', '水果'], ['ice', '冰'], ['top', '顶部'], ['dust', '撒料'], ['decor', '装饰'], ['straw', '吸管'],
];
let tab = 'base';
const $tabs = document.getElementById('tabs'), $chips = document.getElementById('chips');
for (const [id, name] of TABS) {
  const b = document.createElement('button');
  b.className = 'tab'; b.textContent = name; b.dataset.tab = id;
  b.onclick = () => { tab = id; renderChips(); };
  $tabs.appendChild(b);
}

function chip(name, dot, onClick, on, cls) {
  const b = document.createElement('button');
  b.className = 'chip' + (on ? ' on' : '') + (cls ? ' ' + cls : '');
  if (dot) { const i = document.createElement('i'); i.style.setProperty('--c', dot); b.appendChild(i); }
  b.appendChild(document.createTextNode(name));
  // 液体按钮支持长按连续倒入，短按仍保持一次倒入。
  const hold = cls === 'liquid-chip';
  let holdTimer = 0, holding = false;
  if (hold) {
    b.addEventListener('pointerdown', () => {
      holding = false;
      holdTimer = setTimeout(() => {
        holding = true;
        onClick();
        holdTimer = setInterval(onClick, 150);
      }, 360);
    });
    const stopHold = () => {
      clearTimeout(holdTimer);
      clearInterval(holdTimer);
      holdTimer = 0;
    };
    b.addEventListener('pointerup', stopHold);
    b.addEventListener('pointercancel', stopHold);
    b.addEventListener('pointerleave', stopHold);
  }
  b.onclick = () => {
    if (holding) { holding = false; return; }
    audioInit(); tick(); rotV = 0; onClick();
  };
  $chips.appendChild(b);
  return b;
}
// ---------- 水果切法 sheet ----------
const $sheet = document.getElementById('sheet'), $sheetGrid = document.getElementById('sheetGrid');
$sheet.addEventListener('click', (e) => { if (e.target === $sheet) closeSheet(); });
function closeSheet() { $sheet.classList.remove('show'); }
function openCutSheet(f) {
  const F = FRUITS[f];
  document.getElementById('sheetTitle').textContent = `${F.name}要怎么切？`;
  $sheetGrid.innerHTML = '';
  for (const c in F.cuts) {
    const b = document.createElement('button');
    b.className = 'cut';
    b.append(cutIcon(c, F.dot), document.createTextNode(CUTS[c]));
    b.onclick = () => { addItem(`${f}_${c}`); closeSheet(); };
    $sheetGrid.appendChild(b);
  }
  $sheet.classList.add('show');
}

// 切法小图标：用水果的主色画出大概形状
function cutIcon(cut, color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 104;
  const g = cv.getContext('2d'), c = 52, R = 40;
  const flesh = color, rind = shade(color, -0.35), light = shade(color, 0.45);
  g.lineJoin = 'round';
  const disc = (a0, a1, hole = 0) => {
    g.beginPath();
    if (a1 - a0 < Math.PI * 2) g.moveTo(c, c);
    g.arc(c, c, R, a0, a1);
    if (hole) { g.moveTo(c + hole, c); g.arc(c, c, hole, 0, Math.PI * 2, true); }
    g.closePath();
    g.fillStyle = rind; g.fill();
    g.save(); g.clip();
    g.fillStyle = light; g.beginPath(); g.arc(c, c, R - 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = shade(color, 0.7); g.lineWidth = 2;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R); g.stroke(); }
    g.restore();
  };
  const ballAt = (x, y, r) => {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, light); gr.addColorStop(1, rind);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  if (cut === 'whole') ballAt(c, c, R * 0.85);
  else if (cut === 'slice') disc(0, Math.PI * 2);
  else if (cut === 'half') { g.translate(0, 14); disc(Math.PI, Math.PI * 2); }
  else if (cut === 'quarter') { g.translate(-14, 14); disc(-Math.PI / 2, 0); }
  else if (cut === 'ring') disc(0, Math.PI * 2, 11);
  else if (cut === 'halfW') {
    g.fillStyle = rind; g.beginPath(); g.arc(c, c - 4, R * 0.8, 0, Math.PI); g.fill();
    g.fillStyle = light; g.beginPath(); g.ellipse(c, c - 4, R * 0.8, R * 0.3, 0, 0, Math.PI * 2); g.fill();
  } else if (cut === 'dice') {
    const s = 26;
    g.fillStyle = light; g.beginPath(); g.moveTo(c, c - s); g.lineTo(c + s, c - s / 2); g.lineTo(c, c); g.lineTo(c - s, c - s / 2); g.fill();
    g.fillStyle = flesh; g.beginPath(); g.moveTo(c - s, c - s / 2); g.lineTo(c, c); g.lineTo(c, c + s); g.lineTo(c - s, c + s / 2); g.fill();
    g.fillStyle = rind; g.beginPath(); g.moveTo(c + s, c - s / 2); g.lineTo(c, c); g.lineTo(c, c + s); g.lineTo(c + s, c + s / 2); g.fill();
  } else if (cut === 'ball') { ballAt(c - 14, c + 8, 16); ballAt(c + 14, c + 8, 16); ballAt(c, c - 14, 16); }
  else if (cut === 'tri') {
    g.translate(0, -18);
    g.beginPath(); g.moveTo(c, c - 8); g.arc(c, c - 8, R + 16, Math.PI / 2 - 0.45, Math.PI / 2 + 0.45); g.closePath();
    g.fillStyle = '#2e7d32'; g.fill();
    g.beginPath(); g.moveTo(c, c - 8); g.arc(c, c - 8, R + 9, Math.PI / 2 - 0.45, Math.PI / 2 + 0.45); g.closePath();
    g.fillStyle = flesh; g.fill();
  } else if (cut === 'strip') {
    g.fillStyle = flesh; g.save(); g.translate(c, c); g.rotate(-0.5); g.beginPath(); g.roundRect(-R, -9, R * 2, 18, 8); g.fill(); g.restore();
  } else if (cut === 'moon') {
    g.beginPath(); g.arc(c - 10, c, R, -1.1, 1.1); g.arc(c - 46, c, R * 1.25, 0.72, -0.72, true); g.closePath();
    g.fillStyle = flesh; g.fill(); g.strokeStyle = rind; g.lineWidth = 5; g.beginPath(); g.arc(c - 10, c, R - 2, -1.05, 1.05); g.stroke();
  } else for (let i = 0; i < 14; i++) ballAt(c + Math.cos(i * 2.4) * (i * 2.4), c + Math.sin(i * 2.4) * (i * 2.4), 6);
  return cv;
}
function shade(hex, k) {
  const col = new THREE.Color(hex);
  return '#' + (k > 0 ? col.lerp(new THREE.Color(1, 1, 1), k) : col.multiplyScalar(1 + k)).getHexString();
}

function sep(t) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = t; $chips.appendChild(s); }

function renderChips() {
  [...$tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const x = $chips.scrollLeft;
  $chips.innerHTML = '';
  const kinds = (cat) => Object.keys(KINDS).filter((k) => KINDS[k].cat === cat).forEach((k) => chip(KINDS[k].name, KINDS[k].dot, () => addItem(k)));
  if (tab === 'cup') {
    CUP_SIZES.forEach((s, i) => chip(s.name, null, () => { if (i !== st.size) { setCup(st.shape, i); renderChips(); } }, i === st.size));
    sep('|');
    CUP_SHAPES.forEach((s, i) => chip(s.name, null, () => { if (i !== st.shape) { setCup(i, st.size); renderChips(); } }, i === st.shape));
  } else if (tab === 'base') for (const k in BASES) chip(BASES[k].name, BASES[k].dot, () => pour('tea', k), false, 'liquid-chip');
  else if (tab === 'milk') for (const k in MILKS) chip(MILKS[k].name, MILKS[k].dot, () => pour('milk', k), false, 'liquid-chip');
  else if (tab === 'syrup') for (const k in SYRUPS) chip(SYRUPS[k].name, SYRUPS[k].dot, () => pour('syrup', k), false, 'liquid-chip');
  else if (tab === 'top') {
    for (const k in FOAMS) chip(FOAMS[k].name, FOAMS[k].dot, () => pour('foam', k));
    sep('·');
    kinds('top');
  }
  else if (tab === 'decor') for (const k in DECOR) chip(DECOR[k].name, DECOR[k].dot, () => {
    // 自定义杯套：点一下就是选图/换图，换别的杯套会自动把它摘掉
    if (k === 'photo') { $sleeveFile.click(); return; }
    toggleDecor(k); renderChips();
  }, st.decor.has(k));
  else if (tab === 'straw') for (const k in STRAWS) chip(STRAWS[k].name, STRAWS[k].dot, () => { setStraw(k); renderChips(); }, st.straw === k);
  else if (tab === 'fruit') {
    for (const f in FRUITS) {
      const F = FRUITS[f], cuts = Object.keys(F.cuts);
      chip(F.name, F.dot, () => (cuts.length === 1 ? addItem(`${f}_${cuts[0]}`) : openCutSheet(f)));
    }
  } else kinds(tab);
  $chips.scrollLeft = x;
}

document.getElementById('shake').onclick = () => { audioInit(); shake(); };
document.getElementById('reset').onclick = () => {
  audioInit(); drain();
  customName = ''; $name.value = '';
  st.decor.forEach((d) => cup.remove(d.obj)); st.decor.clear();
  st.straw = 'none';
  rotY = -0.4; rotV = 0;
  setCup(0, 1); renderChips(); updateHud();
};
document.getElementById('random').onclick = () => { audioInit(); tick(); surprise(); };

const $name = document.getElementById('name'), $sub = document.getElementById('sub'), $mix = document.getElementById('mix');
// 自己起的名字优先；清空就回到自动命名
let customName = '';
let hasSleeveImg = false;
$name.addEventListener('input', () => { customName = $name.value.trim(); });
$name.addEventListener('keydown', (e) => { if (e.key === 'Enter') $name.blur(); });
$name.addEventListener('blur', () => { if (!customName) updateHud(); });
function updateHud() {
  const top = (p) => { let b = null, v = 0; for (const k in p.by) if (p.by[k] > v) { v = p.by[k]; b = k; } return b; };
  const ids = new Set(sim.ps.map((p) => p.def.id));
  const order = st.order.filter((k) => ids.has(k));
  if (!customName && document.activeElement !== $name) $name.value = drinkName({
    tea: top(st.tea), milk: top(st.milk), syrup: top(st.syrup), foam: top(st.foam),
    fruits: [...new Set(order.filter((k) => KINDS[k].cat === 'fruit').map((k) => KINDS[k].fruit || k))],
    toppings: order.filter((k) => KINDS[k].cat === 'topping'),
    ice: order.some((k) => KINDS[k].cat === 'ice'),
    scoop: order.some((k) => k.startsWith('scoop')),
  });
  const mixing = st.tea.vol > 0 && st.milk.vol > 0;
  const syr = st.syrup.vol > 0;
  const prog = mixing && syr ? (st.u + st.us) / 2 : mixing ? st.u : syr ? st.us : 0;
  $mix.style.width = prog * 100 + '%';
  let s;
  if (liquidVol() === 0 && !st.foam.vol) s = sim.ps.length ? '小料就位，倒点底饮吧' : '先选杯子，再倒底饮、加料';
  else if (st.pours.length) s = '倒入中…';
  else if (seq.length) s = '正在调制…';
  else if (st.shakeT > 0) s = '摇摇摇～';
  else if (syr && st.us < 0.1 && !mixing) s = '酱料沉在杯底、挂在杯壁上，摇一摇会化开';
  else if (!mixing && !syr) s = st.carb > 0.3 ? '气泡咕嘟咕嘟往上冒' : '加点奶或酱料试试';
  else if (prog < 0.15) s = mixing ? '奶沉在下面成了分层，摇一摇就融合' : '酱料还沉在杯底，摇一摇会化开';
  else if (prog < 0.95) s = `融合中 ${Math.round(prog * 100)}%`;
  else s = '已经摇匀啦';
  $sub.textContent = s;
}

let toastTimer = 0;
function toast(t) {
  const el = document.getElementById('toast');
  el.textContent = t; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1200);
}

let rotY = -0.4, rotV = 0, drag = null;
canvas.addEventListener('pointerdown', (e) => {
  audioInit();
  drag = { x: e.clientX, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  // 手指/鼠标刚开始动的那几像素不算拖动：加料、点按的时候杯子不会自己转
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
    drag.moved = true;
    drag.x = e.clientX;
    return;
  }
  const dx = e.clientX - drag.x;
  drag.x = e.clientX;
  rotY += dx * 0.008;
  rotV = THREE.MathUtils.clamp(dx * 6, -3, 3);
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6 && performance.now() - drag.t < 350) { rotV = 0; shake(); }
  drag = null;
});

// ---------- 主循环 ----------
const clock = new THREE.Clock();
const prevPos = new THREE.Vector3(), prevVel = new THREE.Vector3(), accW = new THREE.Vector3(), tmpA = new THREE.Vector3();
const tmpPos = new THREE.Vector3(), tmpVel = new THREE.Vector3();
const qInv = new THREE.Quaternion();
const slosh = new THREE.Vector2(), sloshV = new THREE.Vector2();
const nW = new THREE.Vector3(), gL = new THREE.Vector3(), inertL = new THREE.Vector3();
const mtx = new THREE.Matrix4(), pos = new THREE.Vector3(), col = new THREE.Color(), scl = new THREE.Vector3();
const simEnv = { has: false, P: LQ.uP.value, N: LQ.uN.value, rho: 1, visc: 1, g: gL, inert: inertL, stir: 0 };
let hudT = 0, lastFrameAt = performance.now();

function frame() {
  try { step(); }
  catch (e) { console.error('[frame]', e); }
  finally { requestAnimationFrame(frame); }
}

function step() {
  lastFrameAt = performance.now();
  const raw = clock.getDelta();
  const dt = Math.min(Math.max(raw, 1 / 240), 1 / 30);
  // 队列按真实时间推进：掉帧时也不会看起来像卡死
  const rdt = Math.min(raw, 0.5);
  const spec = st.spec;

  // 杯子：拖动旋转 + 摇晃
  if (!drag) { rotY += rotV * dt; rotV *= Math.pow(0.04, dt); }
  let env = 0;
  if (st.shakeT > 0) {
    st.shakeT = Math.max(0, st.shakeT - dt);
    const t = SHAKE_DUR - st.shakeT;
    env = Math.sin(Math.PI * t / SHAKE_DUR);
    cup.position.set(Math.sin(t * 26) * 0.22 * env, Math.abs(Math.sin(t * 26)) * 0.08 * env, 0);
    cup.rotation.set(0, rotY, Math.sin(t * 26 + 0.8) * 0.14 * env);
  } else {
    cup.position.set(0, 0, 0);
    cup.rotation.set(0, rotY, 0);
  }
  cup.updateMatrixWorld(true);
  shadow.position.x = cup.position.x + 0.16;
  shadowWide.position.x = cup.position.x + 0.24;

  cup.getWorldPosition(tmpPos);
  tmpVel.subVectors(tmpPos, prevPos).divideScalar(dt);
  accW.lerp(tmpA.subVectors(tmpVel, prevVel).divideScalar(dt), 0.5);
  prevPos.copy(tmpPos); prevVel.copy(tmpVel);
  cup.getWorldQuaternion(qInv).invert();

  applyPour(rdt);
  seqTick();

  // 混合物的整体性质
  const tv = st.tea.vol, mv = st.milk.vol, sv = st.syrup.vol, fv = st.foam.vol;
  const liq = tv + mv + sv;
  const bulkV = tv + mv + sv * st.us;
  const rho = bulkV > 0 ? (st.tea.rho + st.milk.rho + st.syrup.rho * st.us) / bulkV : 1;
  const visc = bulkV > 0 ? (st.tea.visc + st.milk.visc + st.syrup.visc * st.us) / bulkV : 1;
  const fizz = liq > 0 ? st.tea.fizz / liq * st.carb : 0;

  // 液面晃动：越稠晃得越慢
  const sd = 6 * Math.sqrt(visc);
  const tx = THREE.MathUtils.clamp(accW.x * 0.0022, -0.5, 0.5), tz = THREE.MathUtils.clamp(accW.z * 0.0022, -0.5, 0.5);
  sloshV.x += ((tx - slosh.x) * 90 - sloshV.x * sd) * dt;
  sloshV.y += ((tz - slosh.y) * 90 - sloshV.y * sd) * dt;
  slosh.addScaledVector(sloshV, dt);
  nW.set(slosh.x, 1, slosh.y).normalize();

  // 摇匀
  const mixing = tv > 0 && mv > 0;
  if (env > 0) {
    if (mixing) st.u = Math.min(1, st.u + dt * 0.85 * env / Math.sqrt(visc));
    if (sv > 0 && liq > sv) st.us = Math.min(1, st.us + dt * 0.5 * env);
    st.ripple = Math.max(st.ripple, env);
    if (fizz > 0) { st.fizzFoam += env * dt * fizz * spec.capacity * 0.06; st.carb = Math.max(0, st.carb - dt * 0.08); }
  }
  if (mixing) st.u = Math.min(1, st.u + dt * 0.003);
  // 液体被搅动的程度：摇的时候拉满，倒液体时冲一下，停下后几秒内慢慢平息（越稠停得越快）
  if (env > 0) st.churn = Math.max(st.churn, env);
  if (stream.visible) st.churn = Math.max(st.churn, 0.3);
  st.churn *= Math.exp(-dt * 0.4 * Math.sqrt(visc));
  st.carb = Math.max(0, st.carb - dt / 240);
  st.fizzFoam = Math.max(0, st.fizzFoam - dt * spec.capacity * 0.004);
  st.flow += dt * (1 + env * 7) / Math.sqrt(visc);
  st.age += dt;
  st.ripple = Math.max(0.04, st.ripple - dt * 0.6, sim.splash);
  sim.splash = Math.max(0, sim.splash - dt * 2);

  // 液体 uniforms
  const has = liq + fv > 0.001;
  // 液面 → 汽水泡沫（液体着色器里画）→ 奶盖（单独网格）
  const liqTop = spec.levelFor(liq + st.disp);
  const fizzTop = spec.levelFor(liq + st.disp + st.fizzFoam);
  st.level = fizzTop; // 奶盖不算在液面里，它堆在上面
  LQ.uHas.value = liq + st.fizzFoam > 0.001 ? 1 : 0;
  LQ.uP.value.set(0, fizzTop, 0);
  LQ.uN.value.copy(nW).applyQuaternion(qInv);
  LQ.uLight.value.copy(LIGHT_W).applyQuaternion(qInv);
  LQ.uLight2.value.copy(LIGHT2_W).applyQuaternion(qInv);
  LQ.uTeaA.value.fromArray(st.tea.A).divideScalar(tv || 1);
  LQ.uTeaS.value.fromArray(st.tea.S).divideScalar(tv || 1);
  LQ.uMilkA.value.fromArray(st.milk.A).divideScalar(mv || 1);
  LQ.uMilkS.value.fromArray(st.milk.S).divideScalar(mv || 1);
  LQ.uSyA.value.fromArray(st.syrup.A).divideScalar(sv || 1);
  LQ.uSyS.value.fromArray(st.syrup.S).divideScalar(sv || 1);
  LQ.uF.value = tv + mv > 0 ? mv / (tv + mv) : 0;
  // uU = 摇匀程度：0 时按密度分层（酱料底部、奶中间、茶上层），摇一摇才混成奶茶
  LQ.uU.value = st.u;
  LQ.uSyF.value = liq > 0 ? sv / liq : 0;
  LQ.uSyH.value = spec.levelFor(sv) - spec.yb;
  // 浆料有多稠（1 = 接近芋泥/蜂蜜），决定底部那一坨有多实
  LQ.uSyT.value = sv > 0 ? THREE.MathUtils.clamp((st.syrup.visc / sv - 1.5) / 50, 0, 1) : 0;
  // 分层奶带：按密度顺序，酱料在最底、奶在中间、茶在上层
  LQ.uMilkH.value = Math.max(0, spec.levelFor(sv + mv) - spec.levelFor(sv));
  LQ.uLay.value = THREE.MathUtils.clamp(1 - st.u, 0, 1);
  LQ.uUs.value = st.us;
  // ---- 不透明液体（颜色由 A/S 系数按 Beer–Lambert 算出）----
  LB.uLevel.value = liqTop;
  LB.uSyTop.value = sv > 0 ? spec.levelFor(sv) : spec.yb;
  LB.uMilkTop.value = spec.levelFor(sv + mv);
  LB.uMix.value = st.u;
  LB.uDense.value = LQ.uSyT.value;
  LB.uFlow.value = st.flow;
  LB.uStripe.value = st.stripe;
  LB.uCapY.value = liqTop - 0.006;
  LB.uCapR.value = Math.max(spec.radiusAt(THREE.MathUtils.clamp(liqTop, spec.yb, spec.yt)) - 0.012, 0.05);
  const tv2 = tv || 1, mv2 = mv || 1;
  mediaMix(LB.uTeaCol.value, st.tea, 'tea', 1.05);
  mediaMix(LB.uMilkCol.value, st.milk, 'milk', 1.5);
  mediaMix(LB.uSyCol.value, st.syrup, 'syrup', 0.55);
  // 摇匀后的整体颜色：按体积把三种介质混在一起
  mixedCol.setRGB(LB.uTeaCol.value.x, LB.uTeaCol.value.y, LB.uTeaCol.value.z);
  mixed2.setRGB(LB.uMilkCol.value.x, LB.uMilkCol.value.y, LB.uMilkCol.value.z);
  mixedCol.lerp(mixed2, mv / (tv + mv || 1));
  mixed2.setRGB(LB.uSyCol.value.x, LB.uSyCol.value.y, LB.uSyCol.value.z);
  mixedCol.lerp(mixed2, sv / (tv + mv + sv || 1));
  LB.uMixCol.value.set(mixedCol.r, mixedCol.g, mixedCol.b);
  if (st.lb) { st.lb.cap.visible = liq > 0.001; st.lb.body.visible = liq > 0.001; }
  LB.uCamW.value.copy(camera.position);
  LB.uLw.value.copy(LIGHT_W);
  LB.uLw2.value.copy(LIGHT2_W);
  LQ.uStripe.value = st.stripe;
  LQ.uStripeH.value = st.stripeH;
  LQ.uFoamH.value = st.fizzFoam > 0 ? fizzTop - liqTop : 0;
  LQ.uFoamC.value.set(0.95, 0.93, 0.88);
  LQ.uDustK.value = 0;
  updateFoam(fizzTop, fv);
  LQ.uAge.value = st.age;
  LQ.uFlow.value = st.flow;
  LQ.uRipple.value = st.ripple;
  LQ.uInv.value.copy(cup.matrixWorld).invert();

  // 配料物理
  gL.set(0, -1, 0).applyQuaternion(qInv);
  inertL.copy(accW).applyQuaternion(qInv);
  simEnv.has = has && liq > 0.001; simEnv.rho = rho; simEnv.visc = visc; simEnv.stir = has ? env : 0; simEnv.churn = has ? st.churn : 0;
  simEnv.level = st.level;
  st.surfY = Math.max(st.level, st.foamTop || 0);
  simEnv.top = st.surfY;
  // 每帧把“顶面”缓存一次（奶盖 + 冰淇淋），撒料按这个曲面落
  st.surfCtx = [];
  if (sim.ps.length) {
    for (const p of sim.ps) {
      if (!p.def.fit) continue;
      const prof = kindVisual(p.def.id).geo.userData.surf;
      if (prof) st.surfCtx.push({ x: p.x, z: p.z, y: p.y, mul: p.mul, R: prof.rMax * p.mul, prof });
    }
  }
  simEnv.topAt = topAt; simEnv.surfN = surfN;
  simEnv.onPlop = onPlop;
  sim.update(dt, simEnv, onMelt);

  const counts = {};
  let disp = 0;
  for (const p of sim.ps) {
    const id = p.def.id;
    const m = ensureInst(id);
    const i = counts[id] = (counts[id] || 0);
    const k = Math.cbrt(p.m);
    pos.set(p.x, p.y, p.z);
    scl.copy(p.s).multiplyScalar(k);
    mtx.compose(pos, p.q, scl);
    m.setMatrixAt(i, mtx);
    if (p.color != null) m.setColorAt(i, col.set(p.color));
    counts[id]++;
    disp += p.def.vol * p.m * p.sub;
  }
  st.disp = liq > 0 ? disp : 0;
  for (const id in instMeshes) {
    const m = instMeshes[id];
    m.count = counts[id] || 0;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  updateBubbles(dt, fizz, liq);
  updateDecor(dt);

  hudT -= dt;
  if (hudT <= 0) { hudT = 0.15; updateHud(); }

  renderer.render(scene, camera);
  window.__dl = { st, sim, foamMesh, camera, renderer, cup, scene, LB, liqVol: liquidVol };
}

function updateBubbles(dt, fizz, liq) {
  const spec = st.spec;
  const n = Math.round(MAX_BUB * Math.min(1, fizz * 1.2));
  bubGeo.setDrawRange(0, n);
  bubMat.opacity = 0.8 * (1 - LQ.uF.value) * (1 - LQ.uSyF.value * (1 - st.us));
  if (!n) return;
  const top = LQ.uP.value.y - LQ.uFoamH.value;
  for (let i = 0; i < n; i++) {
    const j = i * 3;
    if (bubPos[j + 1] < spec.yb || bubPos[j + 1] > top) {
      const y = spec.yb + Math.random() * Math.min(0.3, top - spec.yb);
      const r = Math.sqrt(Math.random()) * spec.radiusAt(y) * 0.95, a = Math.random() * Math.PI * 2;
      bubPos[j] = Math.cos(a) * r; bubPos[j + 1] = y; bubPos[j + 2] = Math.sin(a) * r;
      bubSpeed[i] = 0.5 + Math.random() * 1.2;
    }
    bubPos[j] += Math.sin(st.flow * 9 + i) * 0.004;
    bubPos[j + 1] += bubSpeed[i] * dt * (1 + (st.shakeT > 0 ? 2 : 0));
  }
  bubGeo.attributes.position.needsUpdate = true;
}

// 奶盖：底部贴着液面，高度由体积算（圆顶 ≈ 半椭球），可以高过杯口像软冰淇淋那样堆着
function updateFoam(y0, fv) {
  const spec = st.spec;
  foamMesh.visible = fv > 0.0008;
  if (!foamMesh.visible) { st.foamTop = 0; return; }
  const R = Math.max(spec.radiusAt(Math.min(y0, spec.yt)) - 0.014, 0.1);
  const H = THREE.MathUtils.clamp(1.15 * fv / (Math.PI * R * R), 0.03, 0.7);
  foamMesh.position.y = y0 - 0.02;
  foamMesh.scale.set(R, H, R);
  st.foamR = R; st.foamH = H; st.foamY0 = y0 - 0.02;
  st.foamTop = y0 - 0.02 + H * 1.03;
  foamMat.color.fromArray(st.foam.col).multiplyScalar(1 / fv);
  LQ.uFDustK.value = st.foam.dustVol > 0 ? Math.min(1, st.foam.dustVol / fv * 4) : 0;
  if (st.foam.dustVol > 0) LQ.uFDust.value.fromArray(st.foam.dust).multiplyScalar(1 / st.foam.dustVol);
}

// 奶盖剖面（与 foamGeometry 的轮廓一致），用于让撒料贴着鼓起的表面落
const FOAM_PROF = [[0, 0.99], [0.18, 0.993], [0.31, 0.997], [0.43, 1.0], [0.545, 1.0], [0.648, 0.988], [0.74, 0.965], [0.816, 0.925], [0.874, 0.868], [0.918, 0.79], [0.95, 0.69], [0.972, 0.57], [0.986, 0.44], [0.994, 0.3], [0.998, 0.16], [1.002, 0.04]];
function profAt(prof, t) {
  if (t <= prof[0][0]) return prof[0][1];
  for (let i = 1; i < prof.length; i++) {
    if (t <= prof[i][0] || i === prof.length - 1) {
      const a = prof[i - 1], b = prof[i];
      const k = THREE.MathUtils.clamp((t - a[0]) / Math.max(1e-4, b[0] - a[0]), 0, 1);
      return a[1] + (b[1] - a[1]) * k;
    }
  }
  return prof[prof.length - 1][1];
}

// 杯子里最高的那块“顶”：有奶盖就按奶盖的圆顶，有冰淇淋就按冰淇淋的螺旋面，否则是平的液面
function topAt(x, z) {
  let y = st.level;
  if (foamMesh.visible) {
    const t = Math.hypot(x, z) / Math.max(st.foamR, 1e-3);
    if (t < 1.02) y = Math.max(y, st.foamY0 + st.foamH * profAt(FOAM_PROF, t));
  }
  const list = st.surfCtx;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const t = Math.hypot(x - c.x, z - c.z) / Math.max(c.R, 1e-3);
    if (t < 1) {
      const b = c.prof.bins, BIN = b.length, ft = t * BIN, i0 = Math.min(BIN - 1, Math.floor(ft));
      const h = b[i0] + (b[Math.min(BIN - 1, i0 + 1)] - b[i0]) * (ft - i0);
      y = Math.max(y, c.y + c.mul * h);
    }
  }
  return y;
}
function surfN(x, z, out) {
  const d = 0.05;
  const hx = topAt(x + d, z) - topAt(x - d, z), hz = topAt(x, z + d) - topAt(x, z - d);
  return out.set(-hx / (2 * d), 1, -hz / (2 * d)).normalize();
}

function updateDecor(dt) {
  for (const [id, d] of st.decor) {
    const def = DECOR[id];
    if (def.follow === 'surface') {
      d.obj.position.y = Math.max(st.surfY, st.spec.yb) - 0.04;
      d.obj.visible = liquidVol() + st.foam.vol > 0.01;
    }
    if (def.swing) {
      // 吊坠单摆：受重力和杯子加速度驱动
      const pv = d.obj.userData.pivot, s = d.sw;
      const a = -d.obj.rotation.y;
      const ca = Math.cos(a), sa = Math.sin(a);
      const ax = inertL.x * ca + inertL.z * sa, az = -inertL.x * sa + inertL.z * ca;
      const gx = gL.x * ca + gL.z * sa, gz = -gL.x * sa + gL.z * ca;
      const L = d.obj.userData.len || 0.55, w2 = 218 / L;
      s.vx += (-w2 * (s.x - Math.atan2(gx, -gL.y)) - ax / L - 3 * s.vx) * dt;
      s.vz += (-w2 * (s.z - Math.atan2(gz, -gL.y)) - az / L - 3 * s.vz) * dt;
      s.x += s.vx * dt; s.z += s.vz * dt;
      s.x = THREE.MathUtils.clamp(s.x, -1.2, 0.25);
      pv.rotation.set(-s.z, 0, s.x);
    }
  }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const spec = st.spec;
  if (spec) {
    const dockH = document.querySelector('.dock').getBoundingClientRect().height + 20;
    const hudH = 96;
    const band = Math.max(120, h - dockH - hudH);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const y0 = -0.1, y1 = spec.H + 2.0;
    const halfW = (spec.kind === 1 ? spec.Rs : Math.max(spec.rt, spec.rb)) + 1.0;
    const dist = Math.max((y1 - y0) * h / band / (2 * tan), halfW * 2 / (2 * tan * camera.aspect));
    const ty = (y0 + y1) / 2;
    camera.position.set(0, ty + dist * 0.17, dist);
    camera.lookAt(0, ty, 0);
    camera.setViewOffset(w, h, 0, (dockH - hudH) / 2, w, h);
  }
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

setCup(0, 1);
renderChips();
updateHud();
requestAnimationFrame(frame);
setTimeout(warmUp, 300);

// 首次用到某种材质时才编译着色器会卡一下（随机一杯一次用上很多种），
// 所以启动后把所有配料/装饰/吸管在视野外放一份，后台并行编译好
function warmUp() {
  const g = new THREE.Group();
  g.position.y = -1000;
  for (const id in KINDS) { const { geo, mat } = kindVisual(id); g.add(new THREE.InstancedMesh(geo, mat, 1)); }
  for (const id in DECOR) { try { g.add(DECOR[id].build({ spec: st.spec, outerAt: st.cupObj.outerAt })); } catch (e) { /* 圆肚杯不支持的装饰 */ } }
  for (const id in STRAWS) { const m = buildStraw(id, st.spec); if (m) g.add(m); }
  scene.add(g);
  const done = () => scene.remove(g);
  if (renderer.compileAsync) renderer.compileAsync(g, camera, scene).then(done, done);
  else { renderer.compile(scene, camera); done(); }
}

// ---------- 自定义杯套 ----------
const $sleeveFile = document.getElementById('sleeveFile');
$sleeveFile.addEventListener('change', () => {
  const f = $sleeveFile.files && $sleeveFile.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => {
    setSleeveImage(img);
    hasSleeveImg = true;
    // 和别的杯套互斥
    for (const k of ['kraft', 'knit', 'photo']) if (st.decor.has(k)) toggleDecor(k);
    toggleDecor('photo', true);
    renderChips();
    toast('杯套换成你的图了');
    URL.revokeObjectURL(url);
  };
  img.onerror = () => { toast('这张图读不出来'); URL.revokeObjectURL(url); };
  img.src = url;
  $sleeveFile.value = '';
});

// ---------- 分享（小红书竖图） ----------
const $shareMask = document.getElementById('shareMask'), $shareImg = document.getElementById('shareImg');
const $shareSend = document.getElementById('shareSend');
let shareBlob = null, shareFile = null, shareName = '';
function closeShare() { $shareMask.classList.remove('show'); }
document.getElementById('shareClose').onclick = closeShare;
$shareMask.addEventListener('click', (e) => { if (e.target === $shareMask) closeShare(); });

function openShare() {
  audioInit(); tick();
  const name = (customName || $name.value || '我的调饮').trim();
  // 名字太长会把海报占满，截一下
  const title = name.length > 16 ? name.slice(0, 16) : name;
  toast('正在生成分享图…');
  let canvas;
  try {
    canvas = makePoster({
      renderer, scene, camera, spec: st.spec, name: title,
      sub: ($sub.textContent || '').replace(/&nbsp;/g, ' '),
      tags: ['#调饮实验室', '#自制饮品', '#奶茶DIY'],
    });
  } catch (e) {
    toast('生成失败，再试一次');
    return;
  }
  // 刚才临时改过画布尺寸，立刻补渲一帧，避免闪一下
  renderer.render(scene, camera);
  $shareImg.src = canvas.toDataURL('image/png');
  shareName = `调饮实验室-${title}`.replace(/[\\/:*?"<>|]/g, '');
  canvas.toBlob((b) => {
    if (!b) return;
    shareBlob = b;
    shareFile = new File([b], shareName + '.png', { type: 'image/png' });
  }, 'image/png');
  $shareMask.classList.add('show');
}

document.getElementById('shareSave').onclick = () => {
  if (!shareBlob) { toast('还在生成，稍等一下'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(shareBlob);
  a.download = shareName + '.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('已保存，去小红书发吧');
};
$shareSend.onclick = async () => {
  if (!shareBlob) { toast('还在生成，稍等一下'); return; }
  // 手机上优先用系统分享面板，可以直接选小红书
  if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
    try {
      await navigator.share({ files: [shareFile], title: shareName, text: '我在调饮实验室调了一杯，你也来试试' });
      closeShare();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(shareBlob);
  a.download = shareName + '.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('当前设备不支持直接发布，已保存图片，请打开小红书发布');
};

document.getElementById('share').onclick = openShare;
document.getElementById('saveTop').onclick = openSaveSheet;
document.getElementById('saveNew').onclick = saveState;
document.getElementById('saveMask').addEventListener('click', (e) => {
  if (e.target.id === 'saveMask') closeSaveSheet();
});

// ---------- 工具 ----------
function gradientTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 摄影棚背景：中心亮、四周压暗，表面加一点颗粒防色带
function studioTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(S * 0.5, S * 0.34, S * 0.03, S * 0.5, S * 0.5, S * 0.82);
  // 冷调影棚背景：比饮料的暖色低一档，玻璃和白奶盖才有轮廓
  gr.addColorStop(0, '#95a4a0');
  gr.addColorStop(0.38, '#7f8f8b');
  gr.addColorStop(0.7, '#65746f');
  gr.addColorStop(1, '#46514d');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const top = g.createLinearGradient(0, 0, 0, S * 0.42);
  top.addColorStop(0, 'rgba(236, 250, 246,0.16)');
  top.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = top; g.fillRect(0, 0, S, S * 0.42);
  // 四周再压暗一点，白玻璃边缘才有东西可反衬
  const edge = g.createRadialGradient(S * 0.5, S * 0.46, S * 0.26, S * 0.5, S * 0.5, S * 0.82);
  edge.addColorStop(0, 'rgba(24,38,34,0)');
  edge.addColorStop(1, 'rgba(24,38,34,0.36)');
  g.fillStyle = edge; g.fillRect(0, 0, S, S);

  // 背景里要有“结构”：玻璃的折射才会被看见。
  // 一条很淡的竖直光带 + 一条台面水平线，被杯壁弯折的一瞬间就有真玻璃感。
  const band = g.createLinearGradient(S * 0.10, 0, S * 0.34, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, 'rgba(248,255,252,0.10)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = band; g.fillRect(S * 0.10, S * 0.06, S * 0.24, S * 0.86);
  const band2 = g.createLinearGradient(S * 0.66, 0, S * 0.92, 0);
  band2.addColorStop(0, 'rgba(255,255,255,0)');
  band2.addColorStop(0.45, 'rgba(250,255,253,0.07)');
  band2.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = band2; g.fillRect(S * 0.66, S * 0.06, S * 0.26, S * 0.86);
  const hor = g.createLinearGradient(0, S * 0.52, 0, S * 0.60);
  hor.addColorStop(0, 'rgba(255,255,255,0)');
  hor.addColorStop(0.5, 'rgba(228,242,238,0.05)');
  hor.addColorStop(1, 'rgba(20,32,28,0.06)');
  g.fillStyle = hor; g.fillRect(0, S * 0.52, S, S * 0.08);

  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 2;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 118, 4, 128, 128, 124);
  gr.addColorStop(0, 'rgba(10,16,14,0.62)');
  gr.addColorStop(0.30, 'rgba(12,19,17,0.34)');
  gr.addColorStop(0.66, 'rgba(14,22,20,0.10)');
  gr.addColorStop(1, 'rgba(16,24,22,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildEnv() {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(12, 48, 24);
  const p = geo.attributes.position, cols = [];
  const lo = new THREE.Color(0.20, 0.26, 0.25), hi = new THREE.Color(1.10, 1.16, 1.14), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(lo).lerp(hi, THREE.MathUtils.smoothstep(p.getY(i) / 12, -0.35, 0.55));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  // 柔光箱 + 灯带：反射里要有明确的亮块，玻璃和冰块才不是一片糊
  const soft = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 5.15, 5.1), side: THREE.DoubleSide });
  const top = new THREE.MeshBasicMaterial({ color: new THREE.Color(6.0, 6.1, 6.05), side: THREE.DoubleSide });
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(8.4, 8.6, 8.7), side: THREE.DoubleSide });
  const cool = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.9, 2.6), side: THREE.DoubleSide });
  const panels = [
    [-6.5, 5.2, 4.5, 5.5, 8, soft], [6.8, 4.0, 3.6, 4, 6.5, soft], [0, 10.5, 0, 9, 7, top],
    [-7.8, 2.2, 2.4, 1.0, 13, strip], [7.4, 2.0, 2.8, 0.7, 13, strip],
    [-3.5, 4.2, -8.5, 4, 7, cool],
  ];
  for (const [x, y, z, w, h, m] of panels) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(x, y, z); mesh.lookAt(0, y * 0.35, 0);
    s.add(mesh);
  }
  // 地面冷色反弹
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.34, 0.42, 0.40) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3.2;
  s.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.025).texture;
  pm.dispose();
  return tex;
}
