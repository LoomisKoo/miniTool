// 装饰：杯沿挂件、顶部点缀、吊坠、杯套、杯盖，以及各种吸管。
// 每个 build(ctx) 返回 Object3D；ctx = { spec, outerAt }。
// follow: 'surface' 的装饰每帧跟着液面走；swing 的吊坠会随杯子晃动摆。
import { addLiquidFog, RIM_FRAG, GLASS_FRAG, STRAW_FRAG, PLASTIC_FRAG, addFrag } from './liquid.js?v=112';
import { canvasTex, citrusTex, strawberryGeo, seedsTex, oreoTex, std, piece, pieceMats } from './items.js?v=112';

const THREE = window.THREE;
const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function fogStd(color, o = {}) {
  return addLiquidFog(new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, transparent: true, opacity: 1, ...o }), RIM_FRAG);
}

// 贴图很贵（画布 + 上传 GPU），随机一杯一次会用到很多装饰，缓存起来避免重复生成卡顿
const texCache = new Map();
function cachedTex(key, make) {
  let t = texCache.get(key);
  if (!t) { t = make(); texCache.set(key, t); }
  return t;
}

// 杯沿上某个角度的位置，返回一个已经朝外的 group（x 轴指向杯外）
function rimMount(ctx, angle, yOff = 0) {
  const g = new THREE.Group();
  g.rotation.y = -angle;
  const inner = new THREE.Group();
  inner.position.set(ctx.spec.rTop + 0.03, ctx.spec.yt + 0.02 + yOff, 0);
  g.add(inner);
  return { g, inner };
}

// 杯沿果片：从圆心往下切一刀，杯壁卡进切口里——一半在杯里、一半挂在杯外
function wheel(ctx, angle, tex, rind, r, flesh = 0xfbf3c4) {
  const { g, inner } = rimMount(ctx, angle);
  const sh = new THREE.Shape(), a0 = -Math.PI / 2 + 0.03, a1 = -Math.PI / 2 - 0.03 + Math.PI * 2;
  sh.moveTo(0, 0); sh.lineTo(r * Math.cos(a0), r * Math.sin(a0)); sh.absarc(0, 0, r, a0, a1, false); sh.lineTo(0, 0);
  const geo = piece(sh, r, 0.075, rind, flesh).rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, pieceMats(tex, { transparent: true, opacity: 0.94, roughness: 0.3, clearcoat: 0.2, clearcoatRoughness: 0.3 }));
  m.position.set(0, 0.01, 0);
  inner.add(m);
  inner.rotation.x = 0.1;
  return g;
}

function cherryPair() {  const g = new THREE.Group();
  const mat = fogStd(0xb3061c, { roughness: 0.15, clearcoat: 1 });
  const stemMat = fogStd(0x5d7a2a, { roughness: 0.6 });
  const top = V(0, 0.55, 0);
  for (const [x, z] of [[-0.22, 0.05], [0.2, -0.04]]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), mat);
    c.scale.set(1, 0.92, 1);
    c.position.set(x, 0, z);
    g.add(c);
    const curve = new THREE.QuadraticBezierCurve3(V(x, 0.11, z), V(x * 0.4, 0.4, z), top);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.012, 6), stemMat));
  }
  return g;
}

function umbrella() {
  const g = new THREE.Group();
  const tex = cachedTex('umbrella', () => canvasTex(256, (c, s) => {
    const cols = ['#ff6f91', '#ffd166', '#06d6a0', '#4cc9f0', '#ff9f1c', '#c77dff', '#ff6f91', '#ffd166'];
    for (let i = 0; i < 8; i++) {
      c.fillStyle = cols[i];
      c.beginPath(); c.moveTo(s / 2, s / 2); c.arc(s / 2, s / 2, s / 2, i / 8 * TAU, (i + 1) / 8 * TAU); c.fill();
    }
  }));
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.22, 8, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7 }));
  canopy.material.envMapIntensity = 1.1;
  // 圆锥 UV 按侧面展开，改成从顶点放射的极坐标贴图
  const uv = canopy.geometry.attributes.uv, pos = canopy.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z) / 0.6;
    const a = Math.atan2(z, x);
    uv.setXY(i, 0.5 + Math.cos(a) * r * 0.5, 0.5 + Math.sin(a) * r * 0.5);
  }
  canopy.position.y = 1.5;
  g.add(canopy);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.9, 6).translate(0, 0.6, 0), fogStd(0xf3e3c3, { roughness: 0.8 })));
  return g;
}

function oreoCookie() {
  const g = new THREE.Group();
  const face = fogStd(0xffffff, { map: oreoTex(), roughness: 0.85 });
  const dark = fogStd(0x1b1210, { roughness: 0.9 });
  for (const y of [-0.05, 0.05]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 40), [dark, face, face]);
    m.position.y = y;
    g.add(m);
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 40), fogStd(0xfbf6ec, { roughness: 0.6 })));
  return g;
}

function creamSwirl(r) {
  const pts = [];
  const turns = 3.2;
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const a = t * turns * TAU;
    const rr = r * (1 - t * 0.92);
    pts.push(V(Math.cos(a) * rr, t * r * 1.1, Math.sin(a) * rr));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, r * 0.26, 10);
  // 裱花嘴的星形棱
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const j = i % 11;
    const k = 1 + 0.12 * Math.cos(j / 10 * TAU * 5);
    p.setXYZ(i, p.getX(i) + n.getX(i) * (k - 1) * r * 0.26, p.getY(i) + n.getY(i) * (k - 1) * r * 0.26, p.getZ(i) + n.getZ(i) * (k - 1) * r * 0.26);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, fogStd(0xfffbf2, { roughness: 0.7, sheen: 1, sheenColor: new THREE.Color(0xffffff) }));
}

function mintSprig() {
  const g = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.quadraticCurveTo(0.13, 0.12, 0, 0.32); sh.quadraticCurveTo(-0.13, 0.12, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(sh, 8);
  const mat = fogStd(0x2f9a4a, { side: THREE.DoubleSide, roughness: 0.4, clearcoat: 0.4 });
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(leafGeo, mat);
    l.position.y = 0.05 + Math.floor(i / 2) * 0.12;
    l.rotation.set(0.9 - Math.floor(i / 2) * 0.25, (i % 2) * Math.PI + i * 0.5, 0);
    g.add(l);
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.45, 5).translate(0, 0.2, 0), mat));
  return g;
}

// ---------- 吊坠 ----------
const goldMat = () => new THREE.MeshPhysicalMaterial({ color: 0xe9c27a, metalness: 1, roughness: 0.2, envMapIntensity: 1.6 });

// 亚克力挂件：透明亚克力板里夹一张印刷插画（白边贴纸风）
function acrylic(shape, size, draw) {
  const g = new THREE.Group();
  const art = canvasTex(256, (c, s) => { c.save(); c.translate(s / 2, s / 2); c.scale(s / 256, s / 256); draw(c); c.restore(); });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: art, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.55 }));
  g.add(plane);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 32 }).translate(0, 0, -0.015);
  const shell = new THREE.Mesh(geo, addFrag(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.03, transparent: true, envMapIntensity: 1.2, ior: 1.49, depthWrite: false,
  }), GLASS_FRAG));
  shell.renderOrder = 9;
  g.add(shell);
  // 顶上打孔穿环
  const box = new THREE.Box3().setFromObject(shell);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 20), goldMat());
  eye.rotation.y = Math.PI / 2; eye.position.y = box.max.y - 0.005;
  g.add(eye);
  g.position.y = -(box.max.y + 0.02);
  const wrap = new THREE.Group(); wrap.add(g);
  return wrap;
}

const circleShape = (r) => { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, TAU, false); return s; };
function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function starShape(R, r, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = Math.PI / 2 + i / (n * 2) * TAU, rr = i % 2 ? r : R;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return s;
}

// 插画（画布坐标以中心为原点，范围约 ±128）：先描一圈粗白边，再填色
function sticker(c, path, fill, outline = 14) {
  c.lineJoin = 'round';
  c.strokeStyle = '#fff'; c.lineWidth = outline; path(c); c.stroke();
  c.fillStyle = fill; path(c); c.fill();
}
const circ = (x, y, r) => (c) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
function face(c, y, eyeDx, col = '#2a1a14') {
  c.fillStyle = col;
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * eyeDx, y, 7, 9, 0, 0, TAU); c.fill(); }
  c.fillStyle = '#fff';
  for (const s of [-1, 1]) { c.beginPath(); c.arc(s * eyeDx + 2, y - 3, 2.5, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,120,140,0.55)';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * (eyeDx + 16), y + 16, 11, 7, 0, 0, TAU); c.fill(); }
}

const ART = {
  bear(c) {
    const head = (k) => { k.beginPath(); k.arc(0, 12, 78, 0, TAU); k.moveTo(-36, -52); k.arc(-58, -52, 26, 0, TAU); k.moveTo(84, -52); k.arc(58, -52, 26, 0, TAU); };
    sticker(c, head, '#c98b57', 18);
    c.fillStyle = '#f2b8a8'; circ(-58, -52, 13)(c); c.fill(); circ(58, -52, 13)(c); c.fill();
    c.fillStyle = '#f7e1c8'; c.beginPath(); c.ellipse(0, 38, 34, 26, 0, 0, TAU); c.fill();
    face(c, 4, 30);
    c.fillStyle = '#3a2418'; c.beginPath(); c.ellipse(0, 28, 10, 7, 0, 0, TAU); c.fill();
    c.strokeStyle = '#3a2418'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 34); c.quadraticCurveTo(-8, 48, -16, 42); c.moveTo(0, 34); c.quadraticCurveTo(8, 48, 16, 42); c.stroke();
  },
  cat(c) {
    const head = (k) => { k.beginPath(); k.moveTo(-80, -10); k.lineTo(-70, -92); k.lineTo(-24, -58); k.quadraticCurveTo(0, -64, 24, -58); k.lineTo(70, -92); k.lineTo(80, -10); k.bezierCurveTo(88, 70, -88, 70, -80, -10); };
    sticker(c, head, '#f5f0ea', 18);
    c.fillStyle = '#f39a3c'; c.beginPath(); c.moveTo(-70, -84); c.lineTo(-30, -56); c.quadraticCurveTo(-60, -40, -78, -14); c.closePath(); c.fill();
    c.fillStyle = '#f7b3b8'; c.beginPath(); c.moveTo(62, -78); c.lineTo(36, -58); c.lineTo(66, -40); c.fill();
    face(c, -2, 32);
    c.fillStyle = '#f08a9a'; c.beginPath(); c.moveTo(-7, 14); c.lineTo(7, 14); c.lineTo(0, 22); c.fill();
    c.strokeStyle = '#6b5a50'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 22); c.quadraticCurveTo(-7, 32, -15, 26); c.moveTo(0, 22); c.quadraticCurveTo(7, 32, 15, 26);
    for (const s of [-1, 1]) for (const dy of [-6, 6]) { c.moveTo(s * 50, 18 + dy); c.lineTo(s * 86, 14 + dy * 2); }
    c.stroke();
  },
  berry(c) {
    const body = (k) => { k.beginPath(); k.moveTo(0, 96); k.bezierCurveTo(-60, 70, -96, 10, -82, -34); k.bezierCurveTo(-70, -72, -20, -70, 0, -58); k.bezierCurveTo(20, -70, 70, -72, 82, -34); k.bezierCurveTo(96, 10, 60, 70, 0, 96); };
    sticker(c, body, '#ec3d4f', 18);
    c.fillStyle = '#ffd86a';
    for (let i = 0; i < 22; i++) { const x = ((i * 37) % 130) - 65, y = ((i * 53) % 120) - 30; if (Math.abs(x) < 70 - Math.max(0, y) * 0.4) { c.beginPath(); c.ellipse(x, y, 3, 5, 0, 0, TAU); c.fill(); } }
    const leaf = (k) => { k.beginPath(); for (let i = 0; i < 5; i++) { const a = Math.PI + i / 4 * Math.PI; k.moveTo(0, -60); k.quadraticCurveTo(Math.cos(a - 0.3) * 40, -60 + Math.sin(a - 0.3) * 30, Math.cos(a) * 52, -60 + Math.sin(a) * 34); k.quadraticCurveTo(Math.cos(a + 0.3) * 40, -60 + Math.sin(a + 0.3) * 30, 0, -60); } };
    sticker(c, leaf, '#4caf50', 10);
    face(c, 18, 26);
    c.strokeStyle = '#2a1a14'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(0, 30, 9, 0.2, Math.PI - 0.2); c.stroke();
  },
  boba(c) {
    const cupP = (k) => { k.beginPath(); k.moveTo(-62, -50); k.lineTo(62, -50); k.lineTo(48, 96); k.quadraticCurveTo(0, 104, -48, 96); k.closePath(); };
    sticker(c, (k) => { cupP(k); k.rect(-12, -112, 22, 70); }, '#f6e7d4', 18);
    c.fillStyle = '#ff8fab'; c.save(); c.translate(0, -78); c.rotate(0.18); c.fillRect(-9, -36, 18, 76); c.restore();
    c.fillStyle = '#d9a575'; c.beginPath(); c.moveTo(-58, -20); c.lineTo(58, -20); c.lineTo(48, 96); c.quadraticCurveTo(0, 104, -48, 96); c.fill();
    c.fillStyle = '#3a1f12';
    for (const [x, y] of [[-30, 82], [-8, 86], [14, 84], [36, 80], [-20, 66], [4, 70], [26, 64]]) { c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill(); }
    c.fillStyle = '#fff'; c.fillRect(-64, -56, 128, 10);
    face(c, 18, 22);
    c.strokeStyle = '#2a1a14'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(0, 28, 7, 0.2, Math.PI - 0.2); c.stroke();
  },
  duck(c) {
    const body = (k) => { k.beginPath(); k.arc(-4, -34, 50, 0, TAU); k.moveTo(86, 40); k.ellipse(6, 40, 80, 56, 0, 0, TAU); };
    sticker(c, body, '#ffd23f', 18);
    c.fillStyle = '#ff9a2e'; c.beginPath(); c.ellipse(42, -26, 24, 11, 0.1, 0, TAU); c.fill();
    c.fillStyle = '#ffc21f'; c.beginPath(); c.ellipse(-10, 48, 42, 24, -0.3, 0, TAU); c.fill();
    c.fillStyle = '#2a1a14'; c.beginPath(); c.ellipse(14, -44, 6, 8, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(16, -47, 2.2, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,120,140,0.5)'; c.beginPath(); c.ellipse(-8, -22, 10, 6, 0, 0, TAU); c.fill();
  },
};

// 珍珠串：一串珠光小珍珠，末端坠个金色小爱心
function beadStrand() {
  const g = new THREE.Group();
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xfbf4ec, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 1, sheenColor: new THREE.Color(0xffd6e8), iridescence: 0.6, iridescenceIOR: 1.4 });
  const geo = new THREE.SphereGeometry(0.032, 16, 12);
  for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(geo, pearl); b.position.y = -0.03 - i * 0.066; g.add(b); }
  const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShapeS(0.09), { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 16 }).center(), goldMat());
  heart.rotation.z = Math.PI; heart.position.y = -0.56;
  g.add(heart);
  return g;
}
function heartShapeS(s) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.9 * s);
  sh.bezierCurveTo(0.9 * s, -0.2 * s, 0.75 * s, 0.75 * s, 0, 0.35 * s);
  sh.bezierCurveTo(-0.75 * s, 0.75 * s, -0.9 * s, -0.2 * s, 0, -0.9 * s);
  return sh;
}

function metalStar() {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.16, 0.075), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }).center(), goldMat());
  s.position.y = -0.2;
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 20), goldMat());
  eye.rotation.y = Math.PI / 2; eye.position.y = -0.02;
  g.add(s, eye);
  return g;
}

// 毛球：表面密集小毛刺 + 绒面
function pompom(color) {
  const geo = new THREE.IcosahedronGeometry(0.15, 5);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (Math.random() - 0.5) * 0.12);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 1, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xffffff) }));
  m.position.y = -0.17;
  const g = new THREE.Group(); g.add(m);
  return g;
}

// 挂在杯沿外：金色龙虾扣夹住杯沿，细链往下，末端挂坠子
function charm(ctx, angle, figure, len = 0.32) {
  const { g, inner } = rimMount(ctx, angle);
  inner.position.x += 0.02;
  const gm = goldMat();
  const clasp = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 24, Math.PI * 1.7), gm);
  clasp.rotation.z = -Math.PI * 0.45;
  clasp.position.set(-0.03, 0.0, 0);
  inner.add(clasp);
  const pivot = new THREE.Group();
  pivot.position.x = 0.03;
  inner.add(pivot);
  const n = Math.round(len / 0.035), link = new THREE.TorusGeometry(0.016, 0.0045, 6, 12);
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(link, gm);
    l.scale.y = 1.4;
    l.position.y = -0.03 - i * 0.035;
    l.rotation.y = i % 2 ? Math.PI / 2 : 0;
    pivot.add(l);
  }
  figure.position.y = -0.03 - n * 0.035;
  figure.rotation.y = Math.PI / 2;
  pivot.add(figure);
  g.userData.pivot = pivot;
  g.userData.len = len + 0.2;
  return g;
}

// 自定义杯套：用户上传的图片，裁成绕杯一圈的图案（正面居中、两侧留边）
let photoImg = null;
export function setSleeveImage(img) { photoImg = img; }
export function hasSleeveImage() { return !!photoImg; }
function photoTex({ r, hs }) {
  // 让画布比例和杯套展开后的实际比例一致，图片就不会被拉扁
  const W = 2048;
  const H = Math.max(240, Math.round(W * hs / (TAU * r)));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f7ebdb'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(196,154,108,0.28)';
  for (let x = 0; x < W; x += 46) g.fillRect(x, 0, 2, H);

  const ph = Math.round(H * 0.78), pw = Math.round(ph * 1.34);
  const x = (W - pw) / 2, y = (H - ph) / 2, fr = Math.max(6, Math.round(H * 0.035));
  g.save();
  g.beginPath(); g.roundRect(x - fr, y - fr, pw + fr * 2, ph + fr * 2, fr * 2.2); g.fillStyle = '#fffdf9'; g.fill();
  g.restore();
  g.save();
  g.beginPath(); g.roundRect(x, y, pw, ph, fr * 1.6); g.clip();
  if (photoImg) {
    const k = Math.max(pw / photoImg.width, ph / photoImg.height);
    const dw = photoImg.width * k, dh = photoImg.height * k;
    g.drawImage(photoImg, x + (pw - dw) / 2, y + (ph - dh) / 2, dw, dh);
  } else {
    g.fillStyle = '#eadfce'; g.fillRect(x, y, pw, ph);
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function sleeve(ctx, kind) {
  const { spec, outerAt } = ctx;
  const y0 = spec.yb + (spec.yt - spec.yb) * 0.28, y1 = spec.yb + (spec.yt - spec.yb) * 0.62;
  const tex = kind === 'photo' ? photoTex({ r: outerAt((y0 + y1) / 2), hs: y1 - y0 }) : kind === 'kraft'
    ? cachedTex('sleeve-kraft', () => canvasTex(512, (c, s) => {
      c.fillStyle = '#c49a6c'; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 40},30,0.08)`; c.fillRect(Math.random() * s, Math.random() * s, 2, 1); }
      c.fillStyle = '#5a3418'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('调饮', s * 0.25, s / 2); c.fillText('调饮', s * 0.75, s / 2);
      c.strokeStyle = '#5a3418'; c.lineWidth = 6; c.strokeRect(8, 30, s - 16, s - 60);
    }))
    : cachedTex('sleeve-knit', () => canvasTex(256, (c, s) => {
      c.fillStyle = '#f2a7b8'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#e48aa0'; c.lineWidth = 5;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
        const px = x * s / 16, py = y * s / 8;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px + s / 32, py + s / 10); c.lineTo(px + s / 16, py); c.stroke();
      }
      c.fillStyle = '#fff'; c.fillRect(0, s * 0.45, s, s * 0.1);
    }));
  if (kind === 'knit') { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 1.2); }
  const pad = kind === 'kraft' ? 0.02 : 0.05;
  const geo = new THREE.CylinderGeometry(outerAt(y1) + pad, outerAt(y0) + pad, y1 - y0, 72, 1, true).translate(0, (y0 + y1) / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: kind === 'photo' ? 0.82 : kind === 'kraft' ? 0.9 : 1, side: THREE.DoubleSide }));
  // 圆柱 UV 的接缝在正面，转半圈把接缝藏到背后，图案正面朝外
  if (kind === 'photo') m.rotation.y = Math.PI;
  m.renderOrder = 9;
  return m;
}

function lid(ctx) {
  const r = ctx.spec.rTop + 0.09;
  const g = new THREE.Group();
  const mat = addFrag(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.18, transparent: true, envMapIntensity: 1.0, depthWrite: false, side: THREE.DoubleSide }), PLASTIC_FRAG);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 16, 0, TAU, 0.18, Math.PI / 2 - 0.18), mat);
  dome.scale.y = 0.55;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 64), mat);
  ring.rotation.x = Math.PI / 2;
  g.add(dome, ring);
  g.position.y = ctx.spec.yt + 0.04;
  g.children.forEach((c) => { c.renderOrder = 9; });
  return g;
}

export const DECOR = {
  lemonRim:  { name: '柠檬挂杯', dot: '#f7e04a', build: (c) => wheel(c, 0.5, citrusTex('#f2d31c', '#fbf6d8', '#f6e66a', 10), 0xf0cf1a, 0.48) },
  orangeRim: { name: '橙片挂杯', dot: '#f7931e', build: (c) => wheel(c, 1.1, citrusTex('#ef8a12', '#fcebd0', '#f9a430', 11), 0xef8a12, 0.5, 0xfde3bf) },
  limeRim:   { name: '青柠挂杯', dot: '#8fcf3c', build: (c) => wheel(c, -0.3, citrusTex('#4f9a1e', '#eef6d0', '#b4e05a', 9), 0x4a9a1c, 0.38, 0xe4f2c0) },
  berryRim:  { name: '草莓挂杯', dot: '#d0142c', build: (c) => {
    const { g, inner } = rimMount(c, -0.9, 0);
    const b = new THREE.Mesh(strawberryGeo(0.3), fogStd(0xffffff, { map: seedsTex('#d3172f', '#f6d04a'), roughness: 0.3, clearcoat: 0.8 }));
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.06, 7), fogStd(0x3d8a2a, { roughness: 0.6 }));
    leaf.position.y = 0.24;
    b.add(leaf);
    b.position.set(0.08, 0.05, 0);
    b.rotation.z = -0.5;
    inner.add(b);
    return g;
  } },
  cherry:    { name: '樱桃', dot: '#b3061c', build: (c) => {
    const { g, inner } = rimMount(c, 2.2, 0.0);
    const ch = cherryPair(); ch.position.set(0.16, -0.5, 0); ch.rotation.y = Math.PI / 2;
    inner.add(ch);
    return g;
  } },
  umbrella:  { name: '小雨伞', dot: '#ff6f91', build: (c) => {
    const { g, inner } = rimMount(c, -2.2, 0);
    const u = umbrella(); u.position.set(-0.3, -0.6, 0); u.rotation.z = -0.35;
    inner.add(u);
    return g;
  } },
  oreoWhole: { name: '整块奥利奥', dot: '#1b1210', follow: 'surface', build: (c) => {
    const g = new THREE.Group();
    const o = oreoCookie(); o.rotation.set(Math.PI / 2 - 0.35, 0, 0.3); o.position.set(c.spec.rTop * 0.45, 0.18, 0.1);
    g.add(o);
    return g;
  } },
  cream:     { name: '奶油顶', dot: '#fffbf2', follow: 'surface', build: (c) => {
    const g = new THREE.Group();
    g.add(creamSwirl(Math.min(0.75, c.spec.rTop * 0.72)));
    return g;
  } },
  mintTop:   { name: '薄荷枝', dot: '#2f9a4a', follow: 'surface', build: (c) => {
    const g = new THREE.Group();
    const m = mintSprig(); m.position.set(-c.spec.rTop * 0.4, 0, -0.2);
    g.add(m);
    return g;
  } },
  bearCharm: { name: '小熊亚克力', dot: '#c98b57', swing: true, build: (c) => charm(c, Math.PI - 0.3, acrylic(circleShape(0.2), 0.4, ART.bear)) },
  catCharm:  { name: '猫猫亚克力', dot: '#f39a3c', swing: true, build: (c) => charm(c, Math.PI + 0.35, acrylic(circleShape(0.2), 0.4, ART.cat), 0.25) },
  berryCharm:{ name: '草莓亚克力', dot: '#ec3d4f', swing: true, build: (c) => charm(c, 2.4, acrylic(roundRectShape(0.36, 0.4, 0.09), 0.4, ART.berry), 0.4) },
  bobaCharm: { name: '奶茶亚克力', dot: '#d9a575', swing: true, build: (c) => charm(c, -2.5, acrylic(roundRectShape(0.34, 0.42, 0.08), 0.42, ART.boba), 0.28) },
  duckCharm: { name: '小鸭亚克力', dot: '#ffd23f', swing: true, build: (c) => charm(c, Math.PI + 0.9, acrylic(circleShape(0.2), 0.4, ART.duck), 0.36) },
  pearlCharm:{ name: '珍珠串', dot: '#fbf4ec', swing: true, build: (c) => charm(c, Math.PI - 0.8, beadStrand(), 0.12) },
  starCharm: { name: '金星星', dot: '#e9c27a', swing: true, build: (c) => charm(c, Math.PI + 1.3, metalStar(), 0.45) },
  pomCharm:  { name: '毛球', dot: '#ffb3c7', swing: true, build: (c) => charm(c, Math.PI - 1.2, pompom(0xffb3c7), 0.2) },
  kraft:     { name: '牛皮纸杯套', dot: '#c49a6c', noSphere: true, build: (c) => sleeve(c, 'kraft') },
  knit:      { name: '针织杯套', dot: '#f2a7b8', noSphere: true, build: (c) => sleeve(c, 'knit') },
  photo:     { name: '自定义杯套', dot: '#d9b18a', noSphere: true, custom: true, build: (c) => sleeve(c, 'photo') },
  lid:       { name: '杯盖', dot: '#e8f0f6', build: (c) => lid(c) },
};

// ---------- 吸管 ----------
function stripeTex(a, b, diagonal) {
  return cachedTex('stripe-' + a + b + diagonal, () => {
    const t = canvasTex(128, (c, s) => {
      c.fillStyle = a; c.fillRect(0, 0, s, s);
      c.fillStyle = b;
      if (diagonal) {
        for (let i = -s; i < s * 2; i += s / 2) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + s / 4, 0); c.lineTo(i + s / 4 - s, s); c.lineTo(i - s, s); c.fill(); }
      } else c.fillRect(0, s * 0.45, s, s * 0.1);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

export const STRAWS = {
  none:   { name: '不要吸管' },
  boba:   { name: '粗吸管', dot: '#f3a0b5', r: 0.13, path: 'straight', mat: () => fogStd(0xf3a0b5, { roughness: 0.3, clearcoat: 0.6 }) },
  clear:  { name: '透明粗管', dot: '#bfe8f5', r: 0.14, path: 'straight', mat: () => addLiquidFog(new THREE.MeshPhysicalMaterial({ color: 0xa9dce9, roughness: 0.1, transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.06, ior: 1.46, envMapIntensity: 1.2, depthWrite: true, side: THREE.DoubleSide }), STRAW_FRAG) },
  bendy:  { name: '弯头吸管', dot: '#7ec8e3', r: 0.065, path: 'bendy', mat: () => fogStd(0x7ec8e3, { roughness: 0.35, clearcoat: 0.6 }) },
  spiral: { name: '螺旋吸管', dot: '#96dc78', r: 0.06, path: 'spiral', mat: () => fogStd(0x96dc78, { roughness: 0.35, clearcoat: 0.6 }) },
  heart:  { name: '爱心吸管', dot: '#ff7aa2', r: 0.06, path: 'heart', mat: () => fogStd(0xff7aa2, { roughness: 0.35, clearcoat: 0.6 }) },
  paper:  { name: '纸吸管', dot: '#e94b4b', r: 0.08, path: 'straight', mat: () => { const t = stripeTex('#ffffff', '#e94b4b', true); t.repeat.set(14, 1); return fogStd(0xffffff, { map: t, roughness: 0.9 }); } },
  bamboo: { name: '竹吸管', dot: '#9bbf5a', r: 0.09, path: 'straight', mat: () => { const t = stripeTex('#a9c46a', '#6f8f3a', false); t.repeat.set(6, 1); return fogStd(0xffffff, { map: t, roughness: 0.6 }); } },
  glass:  { name: '玻璃吸管', dot: '#a6dced', r: 0.085, path: 'bendy', mat: () => addLiquidFog(new THREE.MeshPhysicalMaterial({ color: 0xb7e9f2, roughness: 0.08, transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.04, ior: 1.48, envMapIntensity: 1.4, depthWrite: true, side: THREE.DoubleSide }), STRAW_FRAG) },
};

export function buildStraw(id, spec) {
  const s = STRAWS[id];
  if (!s || !s.path) return null;
  const x0 = Math.min(0.45, spec.radiusAt(spec.yb) * 0.5), y0 = spec.yb + 0.18, H = spec.yt;
  let pts;
  if (s.path === 'straight') pts = [V(x0, y0, 0.16), V(spec.rTop * 0.7, H + 1.25, 0.3)];
  // 弯头：弯的位置压低，弯完之后再平着延伸一段，管口有完整的圆柱切口
  else if (s.path === 'bendy') pts = [
    V(x0, y0, 0.2), V(x0 + 0.05, H * 0.58, 0.22), V(x0 + 0.11, H + 0.36, 0.24),
    V(x0 + 0.19, H + 0.62, 0.26), V(x0 + 0.34, H + 0.72, 0.27), V(x0 + 0.72, H + 0.73, 0.28),
    V(x0 + 1.16, H + 0.70, 0.3),
  ];
  else if (s.path === 'spiral') {
    pts = [V(x0, y0, 0.2), V(x0, H * 0.6, 0.2), V(x0, H + 0.3, 0.2)];
    for (let i = 1; i <= 36; i++) {
      const a = i / 36 * Math.PI * 6;
      pts.push(V(x0 - 0.3 + Math.cos(a) * 0.3, H + 0.35 + i / 36 * 1.0, 0.2 + Math.sin(a) * 0.3));
    }
    pts.push(V(x0, H + 1.48, 0.2), V(x0, H + 1.62, 0.2));
  } else {
    // 爱心：从底部尖端进入，沿轮廓绕一整圈，最后在凹口上方收口。
    // 整圈都在一个略微前倾的平面上，收口从凹口中间往上走，不会穿过爱心本体
    const S = 0.037, cy = H + 0.62, z0 = 0.2, dz = 0.3;
    const hy = (t) => 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const tipY = cy + hy(Math.PI) * S, notchY = cy + hy(0) * S;
    pts = [V(x0, y0, z0), V(x0, H * 0.5, z0), V(x0, tipY - 0.03, z0 + 0.01)];
    for (let i = 0; i <= 64; i++) {
      const t = Math.PI + i / 64 * TAU;
      const k = i / 64;
      pts.push(V(x0 + 16 * Math.sin(t) ** 3 * S, cy + hy(t) * S, z0 + 0.01 + dz * k));
    }
    pts.push(V(x0, notchY + 0.16, z0 + dz + 0.02), V(x0, notchY + 0.5, z0 + dz + 0.03));
  }
  const curve = pts.length === 2 ? new THREE.LineCurve3(pts[0], pts[1]) : new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, pts.length === 2 ? 4 : (s.path === 'heart' ? 320 : 240), s.r, 16, false);
  const m = new THREE.Mesh(geo, s._mat || (s._mat = s.mat()));
  m.renderOrder = 5;
  return m;
}
