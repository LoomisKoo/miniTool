// 可以丢进杯子的东西：几何、材质（程序化贴图）和真实密度。
// rho 密度 g/cm³（< 液体就浮），rhoJ 每颗之间的密度差异，r 碰撞半径，vol 体积（排水用），n 每点一次加几个。
// 煮好的小料、果肉大多和奶茶（≈1.03）差不多重：摇起来会悬浮满杯，静置后才慢慢分层。
import { addLiquidFog, ICE_FRAG, JELLY_FRAG, ORGANIC_FRAG, PEARL_FRAG } from './liquid.js?v=112';

const THREE = window.THREE;
const TAU = Math.PI * 2;

// ---------- 贴图 ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 柑橘横切面：果皮、白瓤、一瓣瓣果肉
function citrusTex(rind, pith, pulp, segs) {
  return canvasTex(512, (g, s) => {
    const c = s / 2;
    g.fillStyle = rind; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
    g.fillStyle = pith; g.beginPath(); g.arc(c, c, c * 0.9, 0, TAU); g.fill();
    for (let i = 0; i < segs; i++) {
      const w = 0.035 + Math.random() * 0.02;
      const a0 = i / segs * TAU + w, a1 = (i + 1) / segs * TAU - w, am = (a0 + a1) / 2;
      const gr = g.createRadialGradient(c, c, c * 0.08, c, c, c * 0.85);
      gr.addColorStop(0, pith); gr.addColorStop(0.18, pulp); gr.addColorStop(1, pulp);
      g.save();
      g.beginPath(); g.moveTo(c + Math.cos(am) * c * 0.1, c + Math.sin(am) * c * 0.1);
      g.arc(c, c, c * (0.82 + Math.random() * 0.04), a0, a1); g.closePath();
      g.fillStyle = gr; g.fill(); g.clip();
      // 一粒粒朝外的汁胞，明暗不一
      for (let k = 0; k < 90; k++) {
        const a = a0 + Math.random() * (a1 - a0), r = c * (0.16 + Math.random() * 0.68);
        g.globalAlpha = 0.18 + Math.random() * 0.3;
        g.fillStyle = Math.random() < 0.55 ? '#fff' : 'rgba(150,90,0,0.6)';
        g.beginPath(); g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, 9 + Math.random() * 8, 2.5 + Math.random() * 2, a, 0, TAU); g.fill();
      }
      g.restore();
      g.globalAlpha = 1;
    }
    g.fillStyle = pith; g.beginPath(); g.arc(c, c, c * 0.07, 0, TAU); g.fill();
  });
}

// 果皮：油胞小坑
function peelTex(base, dark, light) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = Math.random() < 0.5 ? dark : light;
      g.globalAlpha = 0.25 + Math.random() * 0.3;
      g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 0.8 + Math.random() * 1.6, 0, TAU); g.fill();
    }
  });
}

function kiwiTex() {
  return canvasTex(256, (g, s) => {
    const c = s / 2;
    g.fillStyle = '#7a5a2e'; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
    const gr = g.createRadialGradient(c, c, 0, c, c, c * 0.95);
    gr.addColorStop(0, '#f4f6d8'); gr.addColorStop(0.28, '#d8e7a0'); gr.addColorStop(0.4, '#8dbb3a'); gr.addColorStop(1, '#6aa02a');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c * 0.94, 0, TAU); g.fill();
    g.fillStyle = '#1d140c';
    for (let i = 0; i < 70; i++) {
      const a = i / 70 * TAU + Math.random() * 0.05, r = c * (0.32 + Math.random() * 0.06);
      g.beginPath(); g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, 4.5, 2.2, a, 0, TAU); g.fill();
    }
  });
}

function strawberrySliceTex() {
  return canvasTex(256, (g, s) => {
    const c = s / 2;
    g.fillStyle = '#d0142c'; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
    const gr = g.createRadialGradient(c, c * 0.95, 0, c, c, c * 0.92);
    gr.addColorStop(0, '#fbe3e0'); gr.addColorStop(0.45, '#f58c94'); gr.addColorStop(0.85, '#e23246'); gr.addColorStop(1, '#d0142c');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c * 0.92, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,240,240,0.5)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU;
      g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * c * 0.75, c + Math.sin(a) * c * 0.75); g.stroke();
    }
  });
}

// 同心环切面（西瓜、桃、菠萝……）：stops = [[半径比例, 颜色], ...] 从外到内
function ringTex(stops, extra) {
  return canvasTex(256, (g, s) => {
    const c = s / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    for (const [r, col] of [...stops].reverse()) gr.addColorStop(r, col);
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
    if (extra) extra(g, c);
  });
}

function seedsTex(base, seed) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.fillStyle = seed;
    for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
      g.beginPath(); g.ellipse((x + (y % 2) * 0.5) * s / 16, (y + 0.5) * s / 12, 2.4, 3.6, 0, 0, TAU); g.fill();
    }
  });
}

function oreoTex() {
  return canvasTex(256, (g, s) => {
    const c = s / 2;
    g.fillStyle = '#1b1210'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#2e211d'; g.lineWidth = 6;
    g.beginPath(); g.arc(c, c, c * 0.85, 0, TAU); g.stroke();
    g.beginPath(); g.arc(c, c, c * 0.45, 0, TAU); g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      g.beginPath(); g.arc(c + Math.cos(a) * c * 0.65, c + Math.sin(a) * c * 0.65, 10, 0, TAU); g.stroke();
    }
  });
}

// ---------- 几何 ----------
function roundedBox(sx, sy, sz, r, seg = 4) {
  const g = new THREE.BoxGeometry(sx, sy, sz, seg, seg, seg);
  const p = g.attributes.position, n = g.attributes.normal;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  const hx = sx / 2 - r, hy = sy / 2 - r, hz = sz / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
    v.sub(c).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
    v.multiplyScalar(r).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

function lumpy(geo, amt, freq) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 1 + amt * (Math.sin(v.x * freq + 1.3) * Math.sin(v.y * freq * 1.3) * Math.sin(v.z * freq + 0.7));
    p.setXYZ(i, v.x * d, v.y * d, v.z * d);
  }
  geo.computeVertexNormals();
  return geo;
}

function heartShape(s) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.9 * s);
  sh.bezierCurveTo(0.9 * s, -0.2 * s, 0.75 * s, 0.75 * s, 0, 0.35 * s);
  sh.bezierCurveTo(-0.75 * s, 0.75 * s, -0.9 * s, -0.2 * s, 0, -0.9 * s);
  return sh;
}

function strawberryGeo(s) {
  const pts = [[0, -1], [0.35, -0.8], [0.68, -0.35], [0.78, 0.1], [0.66, 0.5], [0.35, 0.72], [0, 0.75]]
    .map(([x, y]) => new THREE.Vector2(x * s, y * s));
  return new THREE.LatheGeometry(pts, 20);
}

// 挤出来的冰淇淋：一根粗奶油从杯口外圈开始一圈圈盘上去，
// 截面不是正圆而是带棱的星形（裱花嘴的齿），所以每条棱沟都是真实的挤出痕迹；
// 相邻几圈互相压着，最上面收成歪向一边的小尖。
function softServeGeo() {
  const TURNS = 3.15, N = 300, SEG = 28, FLUTES = 7;
  const path = (t) => {
    const a = t * TURNS * TAU;
    const r = 0.78 * (1 - 0.50 * Math.pow(t, 1.4));
    const y = 0.05 + 0.98 * Math.pow(t, 0.92);
    const lean = Math.pow(t, 5) * 0.2;
    return new THREE.Vector3(Math.cos(a) * r + lean, y, Math.sin(a) * r - lean * 0.7);
  };
  // 奶油绳的半径：底部粗、往上细，最后收成尖
  const rope = (t) => 0.30 * (1 - 0.72 * Math.pow(t, 2.2));

  // 沿路径做平行移动的截面坐标，避免扭转
  const T = new THREE.Vector3(), U = new THREE.Vector3(), W = new THREE.Vector3(), t2 = new THREE.Vector3();
  const pos = [], nor = [], uv = [], idx = [];
  let prevU = new THREE.Vector3(1, 0, 0);
  const frames = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const c = path(t);
    T.copy(path(Math.min(1, t + 1 / N))).sub(path(Math.max(0, t - 1 / N))).normalize();
    U.copy(prevU).addScaledVector(T, -prevU.dot(T));
    if (U.lengthSq() < 1e-8) U.set(-T.y, T.x, 0).addScaledVector(T, -T.dot(new THREE.Vector3(-T.y, T.x, 0)));
    U.normalize(); prevU.copy(U);
    W.crossVectors(T, U).normalize();
    frames.push({ c, U: U.clone(), W: W.clone(), rt: rope(t) });
  }
  for (let i = 0; i <= N; i++) {
    const { c, U: u, W: w, rt } = frames[i];
    const t = i / N;
    for (let k = 0; k <= SEG; k++) {
      const a = k / SEG * TAU;
      // 星形截面：齿越靠近尖越浅
      const flute = 1 + 0.115 * (1 - 0.6 * t) * Math.cos(FLUTES * a);
      const ca = Math.cos(a), sa = Math.sin(a);
      const p = c.clone().addScaledVector(u, ca * rt * flute).addScaledVector(w, sa * rt * flute);
      pos.push(p.x, p.y, p.z);
      const n = u.clone().multiplyScalar(ca).addScaledVector(w, sa).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(k / SEG, t);
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < SEG; k++) {
    const a = i * (SEG + 1) + k, b = a + SEG + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // 底部封口（第一圈压出的圆盘）
  const f0 = frames[0], base = pos.length / 3;
  pos.push(f0.c.x, f0.c.y - 0.01, f0.c.z); nor.push(0, -1, 0); uv.push(0.5, 0.5);
  for (let k = 0; k < SEG; k++) idx.push(base, k + 1, k);
  // 顶端收一个小圆头，避免看到空管
  const tip = frames[N], tb = pos.length / 3;
  pos.push(tip.c.x, tip.c.y + 0.055, tip.c.z); nor.push(0, 1, 0); uv.push(0.5, 1);
  const ring = N * (SEG + 1);
  for (let k = 0; k < SEG; k++) idx.push(tb, ring + k, ring + k + 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  // 底座对齐到原点
  geo.translate(0, -geo.boundingSphere.min.y, 0);
  // 记一条半径→高度的剖面，撒料要按这个曲面落，才不会悬在半空
  const pa = geo.attributes.position, BIN = 18;
  let rMax = 0.001, yMax = 0.001;
  for (let i = 0; i < pa.count; i++) {
    rMax = Math.max(rMax, Math.hypot(pa.getX(i), pa.getZ(i)));
    yMax = Math.max(yMax, pa.getY(i));
  }
  const bins = new Float32Array(BIN).fill(0);
  for (let i = 0; i < pa.count; i++) {
    const r = Math.hypot(pa.getX(i), pa.getZ(i)), b = Math.min(BIN - 1, Math.floor(r / rMax * BIN));
    bins[b] = Math.max(bins[b], pa.getY(i));
  }
  geo.userData.surf = { rMax, yMax, bins };
  return geo;
}

// 把几个几何拼成一个（每个占一个材质组），实例化网格只能用单个几何
function merge(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const arrs = parts.map((g) => g.attributes[name].array);
    const all = new Float32Array(arrs.reduce((n, a) => n + a.length, 0));
    let o = 0; for (const a of arrs) { all.set(a, o); o += a.length; }
    out.setAttribute(name, new THREE.BufferAttribute(all, name === 'uv' ? 2 : 3));
  }
  let start = 0;
  parts.forEach((g, i) => { const n = g.attributes.position.count; out.addGroup(start, n, i); start += n; });
  return out;
}

// 平面形状挤出成果片：切面平躺（y 朝上），切面按原形状平面贴图（贴图中心 = 圆心），
// 侧面用顶点色区分外皮（离圆心远）和果肉。材质组：0 切面，1 侧面
function piece(shape, R, t, rindCol, fleshCol) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: t * 0.7, bevelEnabled: true, bevelThickness: t * 0.15, bevelSize: Math.min(t * 0.15, R * 0.05), bevelSegments: 2, curveSegments: 28,
  });
  geo.translate(0, 0, -t * 0.35);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  const cols = new Float32Array(p.count * 3), rc = new THREE.Color(rindCol), fc = new THREE.Color(fleshCol), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    uv.setXY(i, x / (2 * R) + 0.5, 0.5 - z / (2 * R));
    c.copy(fc).lerp(rc, THREE.MathUtils.smoothstep(Math.hypot(x, z) / R, 0.86, 0.97));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.center();
  return geo;
}

function sector(R, a0, a1) {
  const sh = new THREE.Shape();
  if (a1 - a0 >= TAU - 1e-3) { sh.absarc(0, 0, R, 0, TAU, false); return sh; }
  sh.moveTo(0, 0); sh.lineTo(R * Math.cos(a0), R * Math.sin(a0)); sh.absarc(0, 0, R, a0, a1, false); sh.lineTo(0, 0);
  return sh;
}
function ring(R, r) {
  const sh = new THREE.Shape(); sh.absarc(0, 0, R, 0, TAU, false);
  const h = new THREE.Path(); h.absarc(0, 0, r, 0, TAU, true); sh.holes.push(h);
  return sh;
}
// 月牙：外弧以原点为圆心，内弧往里偏
function crescent(R, th, d) {
  const px = R * Math.cos(th), py = R * Math.sin(th);
  const Ri = Math.hypot(px + d, py), ph = Math.atan2(py, px + d);
  const sh = new THREE.Shape();
  sh.moveTo(px, -py); sh.absarc(0, 0, R, -th, th, false); sh.absarc(-d, 0, Ri, ph, -ph, true);
  return sh;
}

// ---------- 材质 ----------
const mats = {};
function std(color, o = {}, extra = ORGANIC_FRAG) {
  // 不透明的东西必须走 opaque 队列，才会被玻璃的 transmission 折射到；
  // 否则它会被画在杯子后面，然后被杯子的折射背景整片盖掉（珍珠就是这样消失的）
  const op = o.opacity ?? 1;
  return addLiquidFog(new THREE.MeshPhysicalMaterial({
    color, roughness: 0.44, transparent: op < 1, opacity: op, depthWrite: op >= 1,
    // 食物不是塑料：给一点柔和的镜面反射和环境反射，边缘才通透
    envMapIntensity: 1.2, specularIntensity: 1.05, ior: 1.42, ...o,
  }), extra);
}
function iceMat() {
  // 真冰是透明的：正对着看能看穿，只有轮廓、裂纹和霜花是白的
  return mats.ice ||= addLiquidFog(new THREE.MeshPhysicalMaterial({
    color: 0xdff2ff, roughness: 0.015, transparent: true, opacity: 1, depthWrite: false,
    envMapIntensity: 1.8, clearcoat: 1, clearcoatRoughness: 0, ior: 1.31, specularIntensity: 1.2,
  }), ICE_FRAG);
}
function jelly(color, opacity = 0.55, o = {}) {
  return addLiquidFog(new THREE.MeshPhysicalMaterial({
    color, roughness: 0.14, transparent: true, opacity, depthWrite: false,
    clearcoat: 0.7, clearcoatRoughness: 0.14, envMapIntensity: 1.55, ior: 1.4, specularIntensity: 1.1, ...o,
  }), JELLY_FRAG);
}
// 果片：[切面, 侧面(顶点色)]
function pieceMats(tex, o = {}) {
  const face = std(0xffffff, { map: tex, roughness: 0.4, ...o });
  const side = std(0xffffff, { vertexColors: true, roughness: 0.45 });
  return [face, side];
}

// ---------- 水果 × 切法 ----------
export const CUTS = {
  whole: '整颗', slice: '圆片', half: '半月片', quarter: '扇形片', dice: '果丁', ball: '果球',
  tri: '三角块', strip: '果条', moon: '月牙瓣', ring: '果环', halfW: '对半切', pulp: '果肉',
};

const lemonTex = () => mats.lemonT ||= citrusTex('#f2d31c', '#fbf6d8', '#f6e66a', 10);
const limeTex = () => mats.limeT ||= citrusTex('#4f9a1e', '#eef6d0', '#b4e05a', 9);
const orangeTex = () => mats.orangeT ||= citrusTex('#ef8a12', '#fcebd0', '#f9a430', 11);
const kumTex = () => mats.kumT ||= citrusTex('#f28a0c', '#fde7c4', '#fbb040', 6);

// 圆片类（slice/half/quarter）共用：R 半径，t 厚度
function discCuts(R, t, tex, rind, flesh, opts) {
  const m = () => pieceMats(tex(), opts);
  return {
    slice:   { geo: () => piece(sector(R, 0, TAU), R, t, rind, flesh), mat: m, r: R * 0.8, vol: Math.PI * R * R * t, flat: true, n: 2, max: 6 },
    half:    { geo: () => piece(sector(R, 0, Math.PI), R, t, rind, flesh), mat: m, r: R * 0.62, vol: Math.PI * R * R * t / 2, flat: true, n: 2, max: 8 },
    quarter: { geo: () => piece(sector(R, 0, Math.PI / 2), R, t, rind, flesh), mat: m, r: R * 0.48, vol: Math.PI * R * R * t / 4, flat: true, n: 3, max: 12 },
  };
}
const dice = (s, mat) => ({ geo: () => roundedBox(s, s * 0.92, s, s * 0.18), mat, r: s * 0.6, vol: s * s * s, n: 8, max: 32, spinny: true });
const ball = (r, mat) => ({ geo: () => new THREE.SphereGeometry(r, 20, 14), mat, r, vol: 4 / 3 * Math.PI * r ** 3, n: 5, max: 20 });

// rhoW 整颗（果皮里有气，偏轻），rho 果肉
const FRUITS = {
  lemon: { name: '柠檬', dot: '#f7e04a', rhoW: 0.93, rho: 1.01, cuts: {
    whole: { geo: () => lumpy(new THREE.SphereGeometry(0.36, 28, 20), 0.03, 14), scale: [1.3, 1, 1], mat: () => std(0xffffff, { map: peelTex('#f2d01e', '#d9b40e', '#fff07a'), roughness: 0.42 }), r: 0.4, vol: 0.26, n: 1, max: 2 },
    ...discCuts(0.42, 0.07, lemonTex, 0xf0cf1a, 0xfbf3c4, { transparent: true, opacity: 0.94 }),
  } },
  lime: { name: '青柠', dot: '#8fcf3c', rhoW: 0.93, rho: 1.01, cuts: {
    whole: { geo: () => lumpy(new THREE.SphereGeometry(0.3, 28, 20), 0.03, 14), scale: [1.12, 1, 1], mat: () => std(0xffffff, { map: peelTex('#4e9a1e', '#3b7c14', '#8fcf4a'), roughness: 0.42 }), r: 0.32, vol: 0.13, n: 1, max: 3 },
    ...discCuts(0.34, 0.07, limeTex, 0x4a9a1c, 0xe4f2c0, { transparent: true, opacity: 0.94 }),
  } },
  orange: { name: '香橙', dot: '#f7931e', rhoW: 0.93, rho: 1.01, cuts: discCuts(0.45, 0.08, orangeTex, 0xef8a12, 0xfde3bf) },
  kumquat: { name: '金桔', dot: '#f9a21b', rhoW: 0.94, rho: 1.01, cuts: {
    whole: { geo: () => new THREE.SphereGeometry(0.17, 20, 14), scale: [1.15, 1, 1], mat: () => std(0xffffff, { map: peelTex('#f59a12', '#d97b06', '#ffc04a'), roughness: 0.38 }), r: 0.18, vol: 0.024, n: 3, max: 12 },
    halfW: { geo: () => merge([
      new THREE.SphereGeometry(0.17, 20, 10, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI),
      new THREE.CircleGeometry(0.17, 24).rotateX(-Math.PI / 2),
    ]).translate(0, 0.06, 0), scale: [1.15, 1, 1], mat: () => [std(0xffffff, { map: peelTex('#f59a12', '#d97b06', '#ffc04a'), roughness: 0.38 }), std(0xffffff, { map: kumTex(), roughness: 0.4 })], r: 0.16, vol: 0.012, flat: true, n: 4, max: 16 },
  } },
  kiwi: { name: '猕猴桃', dot: '#7dbb2e', rho: 1.03, cuts: {
    ...discCuts(0.33, 0.06, () => mats.kiwiT ||= kiwiTex(), 0x7a5a2e, 0x8dbb3a),
    dice: dice(0.18, () => jelly(0x86b832, 0.95, { roughness: 0.3 })),
  } },
  berry: { name: '草莓', dot: '#d0142c', rhoW: 0.94, rho: 1.01, cuts: {
    whole: { geo: () => strawberryGeo(0.2), mat: () => std(0xffffff, { map: seedsTex('#d3172f', '#f6d04a'), roughness: 0.32 }), r: 0.16, vol: 0.02, n: 3, max: 9 },
    halfW: { geo: () => {
      const s = 0.2, prof = [[0, -1], [0.35, -0.8], [0.68, -0.35], [0.78, 0.1], [0.66, 0.5], [0.35, 0.72], [0, 0.75]];
      const half = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * s, y * s)), 14, 0, Math.PI);
      const sh = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x * s, y * s)).concat(prof.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector2(-x * s, y * s))));
      const face = new THREE.ShapeGeometry(sh, 6).rotateY(-Math.PI / 2);
      const uv = face.attributes.uv, p = face.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i) / (1.7 * s) + 0.5, (p.getY(i) + s) / (1.8 * s));
      return merge([half, face]).rotateZ(Math.PI / 2);
    }, mat: () => [std(0xffffff, { map: seedsTex('#d3172f', '#f6d04a'), roughness: 0.32 }), std(0xffffff, { map: mats.berryT ||= strawberrySliceTex(), roughness: 0.4 })], r: 0.15, vol: 0.01, flat: true, n: 3, max: 12 },
    slice: { geo: () => piece(sector(0.17, 0, TAU), 0.17, 0.05, 0xd0142c, 0xf58c94), scale: [1, 1, 1.25], mat: () => pieceMats(mats.berryT ||= strawberrySliceTex()), r: 0.16, vol: 0.006, flat: true, n: 4, max: 16 },
    dice: dice(0.15, () => std(0xe0303e, { roughness: 0.4 })),
  } },
  mango: { name: '芒果', dot: '#ffb21c', rho: 1.05, cuts: {
    dice: dice(0.22, () => jelly(0xffaa18, 0.96, { roughness: 0.28 })),
    strip: { geo: () => roundedBox(0.5, 0.13, 0.15, 0.05), mat: () => jelly(0xffaa18, 0.96, { roughness: 0.28 }), r: 0.2, vol: 0.01, flat: true, n: 4, max: 12 },
    ball: ball(0.12, () => jelly(0xffb320, 0.96, { roughness: 0.25 })),
  } },
  melon: { name: '西瓜', dot: '#ff4b5c', rho: 0.98, cuts: {
    dice: dice(0.24, () => jelly(0xff3f55, 0.96, { roughness: 0.32 })),
    ball: ball(0.13, () => jelly(0xff4058, 0.96, { roughness: 0.3 })),
    tri: { geo: () => piece(sector(0.55, -0.42, 0.42), 0.55, 0.18, 0x2e7d32, 0xff4a5a), mat: () => pieceMats(mats.melonT ||= ringTex(
      [[1, '#1f6b2a'], [0.95, '#3d9a3f'], [0.92, '#e9f4cf'], [0.86, '#ff8a8f'], [0.8, '#ff3f55'], [0, '#ff3a52']],
      (g, c) => { g.fillStyle = '#1a1210'; for (let i = 0; i < 24; i++) { const a = Math.random() * TAU, r = c * (0.35 + Math.random() * 0.35); g.beginPath(); g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, 5, 2.6, a, 0, TAU); g.fill(); } })), r: 0.24, vol: 0.018, flat: true, n: 2, max: 6 },
  } },
  peach: { name: '蜜桃', dot: '#ffb08a', rho: 1.03, cuts: {
    dice: dice(0.2, () => std(0xffbf90, { roughness: 0.38 })),
    moon: { geo: () => piece(crescent(0.42, 1.2, 1.0), 0.42, 0.1, 0xf06a6a, 0xffc79a), mat: () => pieceMats(mats.peachT ||= ringTex([[1, '#e8505a'], [0.95, '#ff9a8a'], [0.88, '#ffc79a'], [0.4, '#ffd8a8'], [0.2, '#ff9a7a'], [0, '#c95a4a']])), r: 0.22, vol: 0.012, flat: true, n: 3, max: 12 },
  } },
  pine: { name: '菠萝', dot: '#ffd23a', rho: 1.02, cuts: {
    dice: dice(0.2, () => jelly(0xffd040, 0.96, { roughness: 0.35 })),
    ring: { geo: () => piece(ring(0.45, 0.1), 0.45, 0.08, 0xc79a3a, 0xffd56a), mat: () => pieceMats(mats.pineT ||= ringTex([[1, '#a77a2a'], [0.95, '#f2c84a'], [0.3, '#ffe27a'], [0.22, '#fff1b8'], [0, '#fff1b8']],
      (g, c) => { g.strokeStyle = 'rgba(230,170,40,0.45)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.25, c + Math.sin(a) * c * 0.25); g.lineTo(c + Math.cos(a) * c * 0.92, c + Math.sin(a) * c * 0.92); g.stroke(); } })), r: 0.36, vol: 0.045, flat: true, n: 1, max: 4 },
  } },
  grape: { name: '葡萄', dot: '#c9e08a', rho: 1.07, cuts: {
    whole: { geo: () => new THREE.SphereGeometry(0.13, 20, 14), scale: [1, 1.15, 1], mat: () => jelly(0xd2e69a, 0.82), r: 0.13, vol: 0.009, n: 5, max: 24 },
    halfW: { geo: () => merge([
      new THREE.SphereGeometry(0.13, 20, 10, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI),
      new THREE.CircleGeometry(0.13, 24).rotateX(-Math.PI / 2),
    ]).translate(0, 0.05, 0), scale: [1, 1, 1.15], mat: () => [jelly(0xd2e69a, 0.82), jelly(0xe6f2c0, 0.9)], r: 0.12, vol: 0.0045, flat: true, n: 6, max: 24 },
  } },
  blueberry: { name: '蓝莓', dot: '#3a3f86', rho: 1.01, cuts: {
    whole: { geo: () => new THREE.SphereGeometry(0.08, 16, 12), scale: [1, 0.85, 1], mat: () => std(0x2e3170, { roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0x9aa2d8), sheenRoughness: 0.6 }), r: 0.08, vol: 0.002, n: 8, max: 32 },
  } },
  lychee: { name: '荔枝', dot: '#f6f1e6', rho: 1.04, cuts: {
    whole: { geo: () => lumpy(new THREE.SphereGeometry(0.17, 22, 16), 0.06, 16), scale: [1, 1.1, 1], mat: () => jelly(0xf8f4ea, 0.85, { roughness: 0.15 }), r: 0.17, vol: 0.02, n: 3, max: 12 },
  } },
  passion: { name: '百香果', dot: '#f2c230', rho: 1.05, cuts: {
    pulp: { geo: () => new THREE.SphereGeometry(0.055, 12, 8), mat: () => jelly(0xf1b414, 0.72), r: 0.055, vol: 0.0007, n: 22, max: 88 },
  } },
};

// ---------- 种类 ----------
// cat: topping 小料 / fruit 水果 / ice 冰 / top 顶部
// flat: 浮着时会躺平；melt: 在液体里融化的秒数，meltInto 融成什么
const sphereVol = (r) => 4 / 3 * Math.PI * r ** 3;
const pearlGeo = (r) => () => lumpy(new THREE.SphereGeometry(r, 22, 16), 0.035, 40 / r * 0.1);

export const KINDS = {
  // 小料（煮好的，吸了水，和奶茶差不多重）
  pearl:   { cat: 'topping', name: '黑糖珍珠', dot: '#2b140a', rho: 1.06, r: 0.105, n: 16, max: 64,
    geo: pearlGeo(0.105), mat: () => std(0x2a1309, { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 2.2, specularIntensity: 1.2 }, PEARL_FRAG) },
  mini:    { cat: 'topping', name: '小珍珠', dot: '#5a2e14', rho: 1.06, r: 0.06, n: 26, max: 90,
    geo: pearlGeo(0.06), mat: () => std(0x4a2210, { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 2.2, specularIntensity: 1.2 }, PEARL_FRAG) },
  crystal: { cat: 'topping', name: '晶球', dot: '#eef2f0', rho: 1.03, r: 0.09, n: 14, max: 56,
    geo: () => new THREE.SphereGeometry(0.09, 18, 12), mat: () => jelly(0xf4f8f4, 0.45) },
  taroBall:{ cat: 'topping', name: '芋圆', dot: '#a98bc9', rho: 1.08, r: 0.1, n: 10, max: 40, spinny: true,
    geo: () => lumpy(roundedBox(0.2, 0.15, 0.22, 0.06), 0.04, 30), mat: () => std(0xa68bc8, { roughness: 0.48, sheen: 0.4, sheenColor: new THREE.Color(0xe8dcff) }) },
  yamBall: { cat: 'topping', name: '地瓜圆', dot: '#f0a340', rho: 1.08, r: 0.1, n: 10, max: 40, spinny: true,
    geo: () => lumpy(roundedBox(0.2, 0.15, 0.22, 0.06), 0.04, 30), mat: () => std(0xf0a03c, { roughness: 0.48, sheen: 0.4, sheenColor: new THREE.Color(0xffe2b0) }) },
  redBean: { cat: 'topping', name: '红豆', dot: '#6e1e1e', rho: 1.1, r: 0.05, n: 30, max: 120, scale: [1.25, 0.85, 0.85],
    geo: () => new THREE.SphereGeometry(0.05, 12, 8), mat: () => std(0x5a1816, { roughness: 0.42, clearcoat: 0.15, clearcoatRoughness: 0.4 }) },
  nata:    { cat: 'topping', name: '椰果', dot: '#f4f4ea', rho: 1.02, r: 0.08, n: 14, max: 56, spinny: true,
    geo: () => roundedBox(0.15, 0.15, 0.15, 0.025), mat: () => jelly(0xfbfbf0, 0.5) },
  grass:   { cat: 'topping', name: '仙草冻', dot: '#1a1410', rho: 1.01, r: 0.12, n: 8, max: 32, spinny: true,
    geo: () => roundedBox(0.22, 0.22, 0.22, 0.03), mat: () => jelly(0x1e1610, 0.88, { roughness: 0.08 }) },
  popMango:{ cat: 'topping', name: '芒果爆珠', dot: '#ffc23a', rho: 1.02, r: 0.09, n: 12, max: 48,
    geo: () => new THREE.SphereGeometry(0.09, 18, 12), mat: () => jelly(0xffb81c, 0.75) },
  popBerry:{ cat: 'topping', name: '草莓爆珠', dot: '#ff6c8a', rho: 1.02, r: 0.09, n: 12, max: 48,
    geo: () => new THREE.SphereGeometry(0.09, 18, 12), mat: () => jelly(0xff5a7c, 0.75) },
  sago:    { cat: 'topping', name: '西米', dot: '#f0f0f0', rho: 1.04, r: 0.035, n: 40, max: 160,
    geo: () => new THREE.SphereGeometry(0.035, 10, 8), mat: () => jelly(0xffffff, 0.5) },
  pudding: { cat: 'topping', name: '布丁', dot: '#f6d36b', rho: 1.03, r: 0.17, n: 3, max: 9, spinny: true,
    geo: () => roundedBox(0.32, 0.28, 0.32, 0.05), mat: () => jelly(0xf7cf5c, 0.92, { roughness: 0.25 }) },

  // 冰：真实冰 0.917，但会被别的冰和配料压住、被水流卷下去；碎冰夹着气泡更轻
  ice:     { cat: 'ice', name: '方冰', dot: '#d8eefa', rho: 0.96, rhoJ: 0.035, r: 0.25, n: 3, max: 10, vol: 0.064, spinny: true, melt: 300, meltInto: 'water', jitter: 0.1,
    geo: () => roundedBox(0.4, 0.4, 0.4, 0.07, 5), mat: iceMat },
  crushed: { cat: 'ice', name: '碎冰', dot: '#e8f6ff', rho: 0.95, rhoJ: 0.04, r: 0.11, n: 14, max: 56, vol: 0.005, spinny: true, melt: 120, meltInto: 'water', jitter: 0.35,
    geo: () => lumpy(new THREE.IcosahedronGeometry(0.11, 0), 0.15, 9), mat: iceMat },
  sphereIce:{ cat: 'ice', name: '冰球', dot: '#cfe9f8', rho: 0.95, rhoJ: 0.02, r: 0.42, n: 1, max: 2, vol: 0.31, melt: 600, meltInto: 'water',
    geo: () => new THREE.SphereGeometry(0.42, 32, 24), mat: iceMat },
  heartIce:{ cat: 'ice', name: '爱心冰', dot: '#ffd6e2', rho: 0.96, rhoJ: 0.035, r: 0.24, n: 2, max: 6, vol: 0.05, spinny: true, melt: 300, meltInto: 'water',
    geo: () => new THREE.ExtrudeGeometry(heartShape(0.3), { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 16 }).center(),
    mat: () => mats.heartIce ||= addLiquidFog(new THREE.MeshPhysicalMaterial({ color: 0xffe2ea, roughness: 0.06, transparent: true, opacity: 0.25, depthWrite: false, envMapIntensity: 2.2, clearcoat: 1 }), ICE_FRAG) },

  // 顶部
  scoopV:  { cat: 'top', name: '香草冰淇淋', dot: '#fbf1d6', rho: 0.62, rhoJ: 0, r: 0.55, n: 1, max: 3, vol: 0.46, fit: 0.94, melt: 90, meltInto: 'cream', creamA: [0.02, 0.05, 0.18], spinny: false, upright: true, surfaceTop: 'base',
    geo: () => softServeGeo(), mat: () => std(0xfdf7e6, { roughness: 0.68, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xfff6dd) }) },
  scoopC:  { cat: 'top', name: '巧克力冰淇淋', dot: '#5a321e', rho: 0.62, rhoJ: 0, r: 0.55, n: 1, max: 3, vol: 0.46, fit: 0.94, melt: 90, meltInto: 'cream', creamA: [1.2, 1.8, 2.4], spinny: false, upright: true, surfaceTop: 'base',
    geo: () => softServeGeo(), mat: () => std(0x53301d, { roughness: 0.72, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x8a5230) }) },
  scoopS:  { cat: 'top', name: '草莓冰淇淋', dot: '#f7a6b8', rho: 0.62, rhoJ: 0, r: 0.55, n: 1, max: 3, vol: 0.46, fit: 0.94, melt: 90, meltInto: 'cream', creamA: [0.05, 0.8, 0.5], spinny: false, upright: true, surfaceTop: 'base',
    geo: () => softServeGeo(), mat: () => std(0xf9b9c6, { roughness: 0.7, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffd6de) }) },
  scoopM:  { cat: 'top', name: '抹茶冰淇淋', dot: '#a6c46a', rho: 0.62, rhoJ: 0, r: 0.55, n: 1, max: 3, vol: 0.46, fit: 0.94, melt: 90, meltInto: 'cream', creamA: [0.9, 0.2, 0.9], spinny: false, upright: true, surfaceTop: 'base',
    geo: () => softServeGeo(), mat: () => std(0xaecb74, { roughness: 0.7, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xcfe0a0) }) },
  // 撒料：都漂在最上面（有奶盖就落在奶盖上），被水冲会散开，但不会沉下去
  oreo:    { cat: 'dust', name: '奥利奥碎', dot: '#1b1210', rho: 0.9, rhoJ: 0.02, r: 0.07, n: 20, max: 80, spinny: true, jitter: 0.4, surface: true,
    geo: () => lumpy(new THREE.BoxGeometry(0.14, 0.04, 0.11), 0.2, 30), mat: () => std(0x1d1411, { roughness: 0.9 }) },
  oreoDust:{ cat: 'dust', name: '奥利奥粉', dot: '#241a15', rho: 0.7, r: 0.026, n: 34, max: 200, spinny: true, surface: true, jitter: 0.5,
    geo: () => lumpy(new THREE.IcosahedronGeometry(0.026, 0), 0.35, 60), mat: () => std(0x1e1512, { roughness: 1 }) },
  cocoa:   { cat: 'dust', name: '可可粉', dot: '#6b3a22', rho: 0.6, r: 0.02, n: 40, max: 240, spinny: true, surface: true, jitter: 0.5,
    geo: () => lumpy(new THREE.IcosahedronGeometry(0.02, 0), 0.35, 70), mat: () => std(0x5f3320, { roughness: 1 }) },
  matchaDust:{ cat: 'dust', name: '抹茶粉', dot: '#7ba63a', rho: 0.6, r: 0.02, n: 40, max: 240, spinny: true, surface: true, jitter: 0.5,
    geo: () => lumpy(new THREE.IcosahedronGeometry(0.02, 0), 0.35, 70), mat: () => std(0x74a034, { roughness: 1 }) },
  coconut: { cat: 'dust', name: '椰蓉', dot: '#fdfaf2', rho: 0.55, r: 0.035, n: 26, max: 150, spinny: true, surface: true, jitter: 0.5,
    geo: () => new THREE.BoxGeometry(0.09, 0.012, 0.06), mat: () => std(0xfdfaf0, { roughness: 0.95, sheen: 1 }) },
  nut:     { cat: 'dust', name: '坚果碎', dot: '#d9a45e', rho: 0.9, r: 0.032, n: 24, max: 140, spinny: true, surface: true, jitter: 0.5,
    geo: () => lumpy(new THREE.BoxGeometry(0.07, 0.035, 0.06), 0.25, 40), mat: () => std(0xd8a05a, { roughness: 0.7 }) },
  brownSugar:{ cat: 'dust', name: '黄糖粉', dot: '#c98a42', rho: 0.8, r: 0.026, n: 32, max: 180, spinny: true, surface: true, jitter: 0.45,
    geo: () => lumpy(new THREE.IcosahedronGeometry(0.026, 0), 0.3, 55), mat: () => std(0xc98a42, { roughness: 0.55 }) },
  rose:    { cat: 'dust', name: '玫瑰花瓣', dot: '#e58aa8', rho: 0.5, r: 0.045, n: 14, max: 80, spinny: true, surface: true, flat: true, jitter: 0.3,
    geo: () => {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.bezierCurveTo(0.09, 0.06, 0.11, 0.16, 0.04, 0.2); sh.bezierCurveTo(-0.04, 0.24, -0.1, 0.12, -0.06, 0.04);
      sh.bezierCurveTo(-0.04, 0.0, -0.02, -0.01, 0, 0);
      return new THREE.ShapeGeometry(sh, 8).rotateX(-Math.PI / 2).center();
    },
    mat: () => std(0xe083a2, { roughness: 0.7, side: THREE.DoubleSide }) },
  gold:    { cat: 'dust', name: '金箔碎', dot: '#e8c06a', rho: 0.8, r: 0.022, n: 18, max: 90, spinny: true, surface: true, flat: true, jitter: 0.6,
    geo: () => new THREE.PlaneGeometry(0.08, 0.06).rotateX(-Math.PI / 2),
    mat: () => new THREE.MeshStandardMaterial({ color: 0xf0c874, metalness: 1, roughness: 0.25, side: THREE.DoubleSide }) },
  sprinkle:{ cat: 'dust', name: '彩针糖', dot: '#ff7ab0', rho: 0.9, rhoJ: 0.02, r: 0.04, n: 40, max: 160, spinny: true, surface: true, multiColor: [0xff6fa8, 0x7ad3ff, 0xffd84a, 0x8be07a, 0xffffff, 0xb28cff],
    geo: () => new THREE.CapsuleGeometry(0.018, 0.08, 3, 6), mat: () => std(0xffffff, { roughness: 0.45 }) },
  marsh:   { cat: 'dust', name: '棉花糖', dot: '#fff6fb', rho: 0.25, r: 0.13, n: 5, max: 20, spinny: true, surface: true,
    geo: () => new THREE.CylinderGeometry(0.12, 0.12, 0.16, 20), mat: () => std(0xfff4f8, { roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xffffff) }) },
  mint:    { cat: 'dust', name: '薄荷叶', dot: '#3ea65a', rho: 0.85, r: 0.12, n: 3, max: 12, flat: true, surface: true,
    geo: () => {
      const sh = new THREE.Shape();
      sh.moveTo(0, -0.2); sh.quadraticCurveTo(0.14, -0.05, 0, 0.2); sh.quadraticCurveTo(-0.14, -0.05, 0, -0.2);
      return new THREE.ShapeGeometry(sh, 8).rotateX(-Math.PI / 2);
    },
    mat: () => std(0x3a9e50, { roughness: 0.45, side: THREE.DoubleSide }) },
};

// 水果每种切法注册成一个种类：id = 水果_切法
for (const f in FRUITS) {
  const F = FRUITS[f];
  for (const c in F.cuts) {
    const d = F.cuts[c];
    KINDS[`${f}_${c}`] = {
      cat: 'fruit', fruit: f, cut: c, name: c === 'whole' || c === 'pulp' ? F.name : `${F.name}${CUTS[c]}`, dot: F.dot,
      rho: c === 'whole' || c === 'halfW' ? (F.rhoW ?? F.rho) : F.rho, rhoJ: 0.045, ...d,
    };
  }
}
export { FRUITS };

for (const k in KINDS) {
  const d = KINDS[k];
  d.id = k;
  d.vol ??= sphereVol(d.r) * 0.85;
}

const cache = {};
export function kindVisual(id) {
  if (!cache[id]) {
    const d = KINDS[id];
    cache[id] = { geo: d.geo(), mat: d.mat() };
  }
  return cache[id];
}

export { canvasTex, citrusTex, strawberryGeo, seedsTex, oreoTex, roundedBox, heartShape, std, jelly, lumpy, merge, piece, sector, pieceMats };
