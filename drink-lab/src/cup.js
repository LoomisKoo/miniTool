// 杯型：内壁半径函数、体积→液面高度表、玻璃网格。
import { addFrag, PLASTIC_FRAG } from './liquid.js?v=112';

const THREE = window.THREE;
const WALL = 0.06;

export function makeCupSpec(shape, size) {
  const k = size.k;
  const s = { shape, yb: shape.base * k, mason: !!shape.mason, plastic: !!shape.plastic };
  if (shape.sphere) {
    s.kind = 1;
    s.Rs = shape.sphere * k;
    s.cy = s.yb + Math.sqrt(1 - 0.46 * 0.46) * s.Rs;
    s.yt = s.cy + Math.sqrt(1 - 0.68 * 0.68) * s.Rs;
    s.H = s.yt + 0.04;
    s.radiusAt = (y) => Math.sqrt(Math.max(s.Rs * s.Rs - (y - s.cy) ** 2, 0));
  } else {
    s.kind = 0;
    s.H = shape.h * k;
    s.yt = s.H - 0.04;
    s.rb = shape.rb * k; s.rt = shape.rt * k;
    s.kc = (s.rt - s.rb) / (s.yt - s.yb);
    s.ac = s.rb - s.kc * s.yb;
    s.radiusAt = (y) => s.ac + s.kc * y;
  }
  s.rTop = s.radiusAt(s.yt);

  // 体积表：从杯底往上累加 πr²dy
  const N = 256, dy = (s.yt - s.yb) / N;
  s.vol = new Float32Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const r = s.radiusAt(s.yb + (i - 0.5) * dy);
    s.vol[i] = s.vol[i - 1] + Math.PI * r * r * dy;
  }
  s.levelFor = (v) => {
    if (v <= 0) return s.yb;
    const a = s.vol;
    if (v >= a[N]) return s.yt;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m; else hi = m; }
    return s.yb + (lo + (v - a[lo]) / (a[hi] - a[lo])) * dy;
  };
  s.volumeAt = (y) => {
    const t = Math.min(Math.max((y - s.yb) / dy, 0), N);
    const i = Math.floor(t);
    return i >= N ? s.vol[N] : s.vol[i] + (s.vol[i + 1] - s.vol[i]) * (t - i);
  };
  // 容量按离杯口很近的地方算，倒满时液面几乎齐平杯口
  s.capacity = s.volumeAt(s.yt - 0.1 * k);
  return s;
}

// 玻璃补充：按真实菲涅尔去反射棚里的柔光箱/天花板/台面。
// 之前这里画两条固定竖条纹，等于在杯子上刷白漆，是“假”的最大来源。
const REAL_GLASS_FRAG = /* glsl */`
{
  vec3 vn = normalize(normal);
  vec3 vv = normalize(vViewPosition);
  float ndv = clamp(abs(dot(vn, vv)), 0.0, 1.0);
  vec3 wn = normalize((vec4(vn, 0.0) * viewMatrix).xyz);
  vec3 Vw = normalize((vec4(vv, 0.0) * viewMatrix).xyz);
  vec3 R = reflect(-Vw, wn);

  // 解析版影棚环境：地面暗、顶部亮，再叠几块柔光箱（方向与场景里的灯一致）
  vec3 env = mix(vec3(0.09, 0.12, 0.11), vec3(0.42, 0.48, 0.46), smoothstep(-0.28, 0.55, R.y));
  // 柔光箱是“很亮的大面积光源”，所以 4% 的菲涅尔反射也能在杯壁上留下明显的竖光带
  env += vec3(1.0, 1.0, 0.99) * pow(max(dot(R, normalize(vec3(-0.62, 0.42, 0.66))), 0.0), 7.0) * 3.0;
  env += vec3(0.95, 0.99, 1.0) * pow(max(dot(R, normalize(vec3(0.74, 0.22, -0.40))), 0.0), 11.0) * 1.6;
  env += vec3(1.0) * pow(max(dot(R, normalize(vec3(0.05, 1.0, 0.12))), 0.0), 20.0) * 2.2;

  // 真实的玻璃不是完美光学面：反射里有一点极缓的波纹，才不会像亚克力管
  env *= 0.94 + 0.06 * (sin(wn.y * 22.0 + wn.x * 7.0) * 0.5 + 0.5);
  // 菲涅尔：正面几乎全透，掠射角几乎全反射；玻璃的“边”就来自这里
  float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, env, clamp(F, 0.0, 0.82));
  gl_FragColor.a = max(gl_FragColor.a, F * 0.92);

  // 玻璃剖面：最外圈一条很细的高光边，紧邻内侧一条暗边。
  // 这一亮一暗是照片里玻璃和塑料最容易区分的特征。
  float hot = smoothstep(0.11, 0.0, ndv);
  float shade = smoothstep(0.30, 0.07, ndv) * (1.0 - hot);
  gl_FragColor.rgb += vec3(0.92, 0.99, 0.98) * hot * 0.34;
  gl_FragColor.rgb *= 1.0 - shade * 0.16;
  gl_FragColor.a = max(gl_FragColor.a, hot * 0.9);

  // 杯口/杯底厚度处的青绿染色，让玻璃不是无色塑料
  gl_FragColor.rgb *= vec3(0.985, 1.0, 0.995);
}
`;

// 实心玻璃棒（把手）：不要杯壁那套“亮边 + 暗边”——那是薄壁剖面的特征，
// 画在圆柱上会在高光边缘产生一条断断续续的锯齿暗线（就是之前闪烁的黑点）。
const HANDLE_FRAG = /* glsl */`
{
  vec3 vn = normalize(normal);
  vec3 vv = normalize(vViewPosition);
  float ndv = clamp(abs(dot(vn, vv)), 0.0, 1.0);
  vec3 wn = normalize((vec4(vn, 0.0) * viewMatrix).xyz);
  vec3 Vw = normalize((vec4(vv, 0.0) * viewMatrix).xyz);
  vec3 R = reflect(-Vw, wn);

  vec3 env = mix(vec3(0.10, 0.13, 0.12), vec3(0.46, 0.52, 0.50), smoothstep(-0.28, 0.55, R.y));
  env += vec3(1.0, 1.0, 0.99) * pow(max(dot(R, normalize(vec3(-0.62, 0.42, 0.66))), 0.0), 6.0) * 2.6;
  env += vec3(0.95, 0.99, 1.0) * pow(max(dot(R, normalize(vec3(0.74, 0.22, -0.40))), 0.0), 10.0) * 1.4;
  env += vec3(1.0) * pow(max(dot(R, normalize(vec3(0.05, 1.0, 0.12))), 0.0), 24.0) * 1.8;

  float F = 0.04 + 0.96 * pow(1.0 - ndv, 6.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, env, clamp(F, 0.0, 0.58));
  gl_FragColor.a = max(gl_FragColor.a, F * 0.75);
  gl_FragColor.rgb *= vec3(0.985, 1.0, 0.995);
}
`;

function glassMat(side, spec, part = 'wall') {
  if (spec.plastic) {
    return addFrag(new THREE.MeshPhysicalMaterial({
      color: 0xf4f8f7, roughness: 0.18, metalness: 0, transparent: true,
      envMapIntensity: 0.75, ior: 1.52, specularIntensity: 0.5, side, depthWrite: false,
    }), PLASTIC_FRAG);
  }
  // 真玻璃：交给 three 的 transmission 做屏幕空间折射 + 厚度吸收，
  // 这样杯里的液体、配料、背景都会被正确折射（不再是贴一层假高光）
  const thick = { wall: 0.26, inner: 0.12, base: 0.62, rim: 0.34, handle: 1.15 }[part] || 0.26;
  const rough = { wall: 0.045, inner: 0.03, base: 0.06, rim: 0.05, handle: 0.10 }[part] || 0.045;
  // 把手是实心玻璃棒：厚、有色，所以它会把背景明显折弯并带一点青绿，
  // 不像薄杯壁那样几乎隐形
  const solid = part === 'handle';
  return addFrag(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: solid ? 0.03 : rough,
    transmission: 0.94, thickness: thick, ior: 1.52,
    attenuationColor: new THREE.Color(solid ? 0.62 : 0.78, solid ? 0.90 : 0.93, solid ? 0.86 : 0.91),
    attenuationDistance: solid ? 0.55 : 1.2,
    envMapIntensity: solid ? 2.6 : 2.0, clearcoat: 1, clearcoatRoughness: 0.03,
    specularIntensity: 1, transparent: true, side, depthWrite: false,
  }), solid ? HANDLE_FRAG : REAL_GLASS_FRAG);
}

// 沿一条样条生成粗细可变的管（TubeGeometry 只能等粗，把手需要两端加厚）
function tubeGeo(pts, radiusAt, segs = 64, radial = 16) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.4);
  curve.arcLengthDivisions = 200;
  const fr = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const N = fr.normals[i], B = fr.binormals[i], r = radiusAt(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
      pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r);
      nor.push(nx, ny, nz);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // 两端封口（埋在杯壁里，主要是防止从侧面看穿）
  for (const [t, dir] of [[0, -1], [1, 1]]) {
    const c = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const ci = pos.length / 3;
    pos.push(c.x, c.y, c.z);
    nor.push(tg.x * dir, tg.y * dir, tg.z * dir);
    uv.push(0, 0);
    const off = Math.round(t * segs) * (radial + 1);
    for (let j = 0; j < radial; j++) {
      if (dir > 0) idx.push(ci, off + j, off + j + 1);
      else idx.push(ci, off + j + 1, off + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// 返回杯子网格（背面先画会被液体染色，正面最后画）和液体包围体
export function buildCup(spec) {
  const g = new THREE.Group();
  const back = [], front = [];
  let liquidGeo, innerGeo, baseR, rimR = spec.rTop, rimY = spec.yt;
  if (spec.kind === 1) {
    const R = spec.Rs + WALL;
    const th0 = Math.acos((spec.yt - spec.cy) / R);
    const th1 = Math.acos(Math.max(-1, (0 - spec.cy) / R));
    const th0i = Math.acos(THREE.MathUtils.clamp((spec.yt - spec.cy) / spec.Rs, -1, 1));
    const th1i = Math.acos(THREE.MathUtils.clamp((0 - spec.cy) / spec.Rs, -1, 1));
    const outer = new THREE.SphereGeometry(R, 96, 56, 0, Math.PI * 2, th0, th1 - th0).translate(0, spec.cy, 0);
    front.push(new THREE.Mesh(outer, glassMat(THREE.FrontSide, spec)));
    // 内壁不参与折射，只作为一条“厚度线”参与混合：这就是杯壁看得见厚度的原因
    innerGeo = new THREE.SphereGeometry(spec.Rs, 80, 44, 0, Math.PI * 2, th0i, th1i - th0i).translate(0, spec.cy, 0);
    liquidGeo = new THREE.SphereGeometry(spec.Rs - 0.012, 56, 30).translate(0, spec.cy, 0);
    baseR = Math.sqrt(Math.max(R * R - spec.cy * spec.cy, 0.04));
    rimR = Math.sqrt(Math.max(R * R - (spec.yt - spec.cy) ** 2, 0.02));
  } else {
    const rTopO = spec.rt + WALL, rBotO = spec.rb + WALL;
    // 内壁一直做到杯口，和外壁齐平；否则俯视时会看到一圈空腔
    const topY = spec.H - 0.006;
    const outer = new THREE.CylinderGeometry(rTopO, rBotO, spec.H, 96, 1, true).translate(0, spec.H / 2, 0);
    front.push(new THREE.Mesh(outer, glassMat(THREE.FrontSide, spec)));
    innerGeo = new THREE.CylinderGeometry(spec.rt, spec.rb, spec.yt - spec.yb, 80, 1, true)
      .translate(0, (spec.yb + spec.yt) / 2, 0);
    liquidGeo = new THREE.CylinderGeometry(spec.rt - 0.012, spec.rb - 0.012, spec.yt - spec.yb, 56, 1)
      .translate(0, (spec.yb + spec.yt) / 2, 0);
    baseR = rBotO;
    rimR = spec.radiusAt(topY) + WALL / 2;
    rimY = topY;
  }

  // 杯底是一整块厚玻璃：比杯壁更挡光、更青，透过液面能看到底部的厚度
  const baseMat = spec.plastic
    ? addFrag(new THREE.MeshPhysicalMaterial({
      color: 0xf6fdfb, roughness: 0.18, transparent: true, envMapIntensity: 0.7, ior: 1.52, specularIntensity: 0.45, depthWrite: false,
    }), PLASTIC_FRAG + '{ gl_FragColor.a = max(gl_FragColor.a, 0.30); }')
    : glassMat(THREE.FrontSide, spec, 'base');
  // 底玻璃比外壁缩进 4mm：既填满杯底（不会露空腔），又不会和外壁共面产生闪烁，
  // 也不会像之前那样在杯底两侧鼓出一圈。
  const baseIn = Math.max(baseR - 0.004, 0.05);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(baseIn, baseIn * 0.995, spec.yb, 80).translate(0, spec.yb / 2, 0), baseMat);
  back.push(base);
  // 杯底与杯壁的圆角过渡（外沿刚好收在杯壁轮廓以内）
  const fillet = new THREE.Mesh(new THREE.TorusGeometry(baseIn - 0.035, 0.035, 10, 80), baseMat);
  fillet.rotation.x = Math.PI / 2; fillet.position.y = spec.yb;
  back.push(fillet);

  // 杯口：内外壁之间封一圈，玻璃厚度一眼可见。做成一圈“唇”，
  // 不是一根细白线——真杯子的杯口是圆润的一坨玻璃。
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(rimR - WALL * 0.2, spec.plastic ? WALL * 0.6 : WALL * 0.4, 16, 96),
    glassMat(THREE.FrontSide, spec, 'rim'),
  );
  rim.rotation.x = Math.PI / 2; rim.position.y = rimY;
  front.push(rim);

  // 内壁：不参与折射，只当作厚度线（薄薄一层染色 + 边缘加深）
  if (innerGeo && !spec.plastic) {
    const inner = new THREE.Mesh(innerGeo, new THREE.MeshPhysicalMaterial({
      color: 0xeaf6f3, roughness: 0.12, metalness: 0,
      transparent: true, opacity: 0.16, depthWrite: false,
      side: THREE.BackSide, envMapIntensity: 0.8, clearcoat: 1,
    }));
    inner.renderOrder = 3;
    back.push(inner);
  }

  if (spec.mason) {
    // 瓶口螺纹：细而扁的一圈圈，之前的又粗又浮
    for (let i = 0; i < 3; i++) {
      const y = spec.yt - 0.10 - i * 0.11;
      const t = new THREE.Mesh(new THREE.TorusGeometry(spec.radiusAt(y) + WALL + 0.006, 0.02, 8, 72), glassMat(THREE.FrontSide, spec));
      t.scale.set(1, 1, 0.8);
      t.rotation.x = Math.PI / 2; t.position.y = y;
      front.push(t);
    }

    // 把手：一条带粗细变化的实心玻璃管。
    // 两端只埋进杯壁厚度的一半（不再穿进杯腔），否则会看到一根管子插在饮料里。
    const hy = spec.H * 0.46;
    const rW = spec.radiusAt(hy);              // 内壁半径
    const rO = rW + WALL;                      // 外壁半径
    const reach = Math.max(0.42, rW * 0.40);
    const halfH = Math.min(0.66, spec.H * 0.30);
    const tube = 0.082;
    const hm = glassMat(THREE.FrontSide, spec, 'handle');
    // 端点就落在杯外壁上：端面贴着杯壁，不穿进杯腔，也不和杯壁互相穿插
    const hx = rO;
    const pts = [
      [hx, hy + halfH, 0],
      [rO + reach * 0.45, hy + halfH * 0.96, 0],
      [rO + reach, hy + halfH * 0.52, 0],
      [rO + reach * 1.06, hy, 0],
      [rO + reach, hy - halfH * 0.52, 0],
      [rO + reach * 0.45, hy - halfH * 0.96, 0],
      [hx, hy - halfH, 0],
    ];
    // 两端鼓起一个“焊点”然后收口：把手和杯壁的连接处是一整块玻璃长出来的。
    // 关键是一次成型的单个网格——之前用额外的球去补，两个透明网格互相穿插，
    // 折射会互相采样到对方，就出现那些一闪一闪的黑点。
    const rad = (t) => {
      const e = Math.min(t, 1 - t) / 0.16;
      const k = Math.min(e, 1);
      const bump = 1 - k * k * (3 - 2 * k);      // 端点 1 → 离开端点 0
      return tube * (1 + 0.42 * bump);
    };
    const handle = new THREE.Mesh(tubeGeo(pts, rad, 96, 24), hm);
    handle.renderOrder = 9;
    front.push(handle);
  }

  back.forEach((m) => { m.renderOrder = 1; g.add(m); });
  front.forEach((m) => { m.renderOrder = 8; g.add(m); });
  return { group: g, liquidGeo, outerAt: (y) => spec.radiusAt(Math.min(Math.max(y, spec.yb), spec.yt)) + WALL };
}
