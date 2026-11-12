// 不透明液体体：为了让玻璃的 transmission 真正折射到杯里的饮料，
// 液体必须是 opaque 网格。颜色直接由每种饮料的 A（吸收）/ S（散射）系数
// 按 Beer–Lambert 定律算出来，所以红茶就是红茶色，不会变成一杯灰奶昔。
const THREE = window.THREE;

export const LB = {
  uYb: { value: 0 }, uYt: { value: 3 }, uLevel: { value: 0 },
  uSyTop: { value: 0 }, uMilkTop: { value: 0 },
  uTeaCol: { value: new THREE.Vector3(0.5, 0.2, 0.08) }, uMilkCol: { value: new THREE.Vector3(0.9, 0.87, 0.8) },
  uSyCol: { value: new THREE.Vector3(0.35, 0.18, 0.08) }, uMixCol: { value: new THREE.Vector3(0.5, 0.35, 0.22) },
  uMix: { value: 0 }, uDense: { value: 0 },
  uFlow: { value: 0 }, uStripe: { value: 0 },
  uShape: { value: 0 }, uCone: { value: new THREE.Vector2(1, 0) }, uSph: { value: new THREE.Vector2(1, 1) },
  uCapR: { value: 1 }, uCapY: { value: 0 },
  uLw: { value: new THREE.Vector3(0.35, 0.85, 0.4) }, uLw2: { value: new THREE.Vector3(-0.6, 0.3, -0.5) },
  uCamW: { value: new THREE.Vector3() },
};

const NOISE = /* glsl */`
float lbHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1); p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float lbNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lbHash(i), lbHash(i + vec3(1,0,0)), f.x), mix(lbHash(i + vec3(0,1,0)), lbHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(lbHash(i + vec3(0,0,1)), lbHash(i + vec3(1,0,1)), f.x), mix(lbHash(i + vec3(0,1,1)), lbHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float lbFbm(vec3 p) {
  float s = 0.0, a = 0.55;
  for (int i = 0; i < 3; i++) { s += a * lbNoise(p); p = p * 2.07 + vec3(1.3, 7.1, 4.7); a *= 0.5; }
  return s;
}
`;

const COMMON = /* glsl */`
uniform float uYb, uYt, uLevel, uSyTop, uMilkTop, uMix, uDense, uFlow, uStripe, uShape, uCapR, uCapY;
uniform vec2 uCone, uSph;
uniform vec3 uTeaCol, uMilkCol, uSyCol, uMixCol, uLw, uLw2, uCamW;
varying vec3 vLP;
varying vec3 vNW;
varying vec3 vWW;
${NOISE}

float lbRadius(float y) {
  if (uShape < 0.5) return max(uCone.x + uCone.y * y, 0.02);
  float d = y - uSph.x;
  return sqrt(max(uSph.y * uSph.y - d * d, 0.0));
}

// 分层：酱料沉底、奶在中层、底饮在上层；每一层都有物理算出来的本色
vec3 lbLayer(vec3 p) {
  float n = lbNoise(vec3(p.xz * 1.6, p.y * 2.2 + uFlow * 0.14));
  float n2 = lbNoise(vec3(p.xz * 4.7, p.y * 4.1 + 3.7));
  float w = (n - 0.5) * 0.10 + (n2 - 0.5) * 0.03;
  vec3 sy = uSyCol;
  vec3 mk = uMilkCol;
  vec3 te = uTeaCol;
  vec3 c = sy;
  c = mix(c, mk, smoothstep(uSyTop - 0.05, uSyTop + 0.11, p.y + w));
  c = mix(c, te, smoothstep(uMilkTop - 0.07, uMilkTop + 0.13, p.y + w * 1.3));
  c = mix(c, uMixCol, clamp(uMix, 0.0, 1.0));
  // 浓稠浆料：越往下越压暗，读起来是一坨而不是一层色卡
  float deep = smoothstep(uSyTop + 0.02, uYb - 0.02, p.y);
  c *= 1.0 - 0.30 * uDense * deep;
  return c;
}
`;

function mediaColor(A, S, d, out, whiten = false) {
  const t = [Math.exp(-Math.max(A[0], 0) * d), Math.exp(-Math.max(A[1], 0) * d), Math.exp(-Math.max(A[2], 0) * d)];
  const sm = Math.max(S[0], S[1], S[2]);
  let sc = [0, 0, 0];
  const mx = Math.max(S[0] + A[0], S[1] + A[1], S[2] + A[2], 1e-4);
  const norm = Math.max((S[0] / mx), (S[1] / mx), (S[2] / mx), 1e-4);
  sc = [(S[0] / mx) / norm, (S[1] / mx) / norm, (S[2] / mx) / norm];
  const k = THREE.MathUtils.smoothstep(sm, 0.2, 2.2);
  const c = [0, 0, 0];
  for (let i = 0; i < 3; i++) c[i] = t[i] * (1 - k) + sc[i] * (0.5 + 0.5 * t[i]) * k;
  // 牛奶这类高散射介质：多次散射后几乎把蓝光也送回来，不该是米黄色
  const mw = whiten ? THREE.MathUtils.smoothstep(sm, 3.6, 5.0) : 0;
  const milkTint = [1.0, 0.985, 0.95];
  for (let i = 0; i < 3; i++) c[i] = c[i] * (1 - mw) + sc[i] * milkTint[i] * mw;
  const am = Math.max(A[0], A[1], A[2]) + sm * 0.06;
  const w = THREE.MathUtils.smoothstep(am, 0.012, 0.10);
  out.setRGB(
    (0.74 * (1 - w) + c[0] * w),
    (0.83 * (1 - w) + c[1] * w),
    (0.81 * (1 - w) + c[2] * w),
  );
  return out;
}
export { mediaColor };

const VERT = /* glsl */`
varying vec3 vLP;
varying vec3 vNW;
varying vec3 vWW;
void main() {
  vLP = position;
  vNW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const VERT_CAP = /* glsl */`
uniform float uCapR, uCapY;
varying vec3 vLP;
varying vec3 vNW;
varying vec3 vWW;
void main() {
  vec3 p = position;
  p.xz *= uCapR;
  p.y = uCapY;
  vLP = vec3(p.x, 0.0, p.z);
  vNW = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG_BODY = /* glsl */`
precision highp float;
${COMMON}
void main() {
  float y = vLP.y;
  if (y < uYb - 0.002 || y > uLevel + 0.002) discard;

  vec3 c = lbLayer(vLP);

  // 贴壁一圈：光程更长，颜色更深；这是透明杯里最像饮料的细节
  float rr = length(vLP.xz) / max(lbRadius(y), 1e-3);
  float wall = smoothstep(0.60, 1.0, rr);
  c *= 1.0 - 0.34 * wall;

  // 挂壁酱料
  if (uStripe > 0.001) {
    float ang = atan(vLP.z, vLP.x);
    float sn = lbNoise(vec3(ang * 2.1, y * 1.9, 5.5));
    c = mix(c, uSyCol, smoothstep(0.50, 0.70, sn) * smoothstep(0.5, 0.92, rr) * uStripe * 0.9);
  }

  // 视觉上的“表面”其实是靠近相机那一侧的近壁：用柱面法线算明暗，
  // 中心正对相机最亮、两侧掠射最暗，杯子才有圆柱体积感（BackSide 的原始法线是反的，会一片死平）
  vec2 rad = vLP.xz / max(length(vLP.xz), 1e-4);
  vec3 N = normalize(vec3(-rad.x, 0.16 * smoothstep(uYb, uLevel, y), -rad.y));
  vec3 V = normalize(uCamW - vWW);
  float facing = clamp(dot(N, V), 0.0, 1.0);
  vec3 Lh = normalize(vec3(uLw.x, 0.0, uLw.z));
  vec3 Lh2 = normalize(vec3(uLw2.x, 0.0, uLw2.z));
  float key = clamp(dot(N, Lh), 0.0, 1.0);
  float fill = clamp(dot(N, Lh2), 0.0, 1.0);
  float shade = 0.50 + 0.50 * key + 0.18 * fill;

  vec3 lit = c * shade;
  // 掠射处光程最长：颜色更浓、更暗，同时边缘会透一点光
  float dense = 1.0 - facing;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  lit = mix(vec3(luma), lit, 1.0 + 0.55 * dense);
  lit *= 1.0 - 0.30 * dense * dense;
  lit += c * pow(dense, 2.2) * 0.55;
  // 上浅下深：底部的酱料/茶汤总是更浓
  lit *= 0.84 + 0.24 * smoothstep(uYb, uLevel, y);
  // 极轻微的竖向纹理，避免整根饮料像一块纯色塑料
  float grain = lbNoise(vec3(vLP.xz * 2.6, y * 0.45 + uFlow * 0.06));
  lit *= 0.955 + 0.09 * grain;
  // 液体表面也有一点柔和的镜面，不是完全哑光的粉墙
  vec3 Hh = normalize(V + Lh);
  lit += vec3(1.0, 0.99, 0.96) * pow(max(dot(N, Hh), 0.0), 26.0) * 0.10;
  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const FRAG_CAP = /* glsl */`
precision highp float;
${COMMON}
void main() {
  if (uLevel <= uYb + 0.004) discard;
  vec3 p = vec3(vLP.x, uLevel, vLP.z);
  vec3 c = lbLayer(p);

  vec3 N = normalize(vNW);
  vec3 V = normalize(uCamW - vWW);
  float lam = clamp(dot(N, uLw), 0.0, 1.0);
  vec3 lit = c * (0.78 + 0.35 * lam);

  // 液面高光：柔光箱在圆盘上拉成一条弧形反光
  vec3 H = normalize(uLw + V);
  float sp = pow(max(dot(N, H), 0.0), 220.0);
  float sp2 = pow(max(dot(N, normalize(uLw2 + V)), 0.0), 90.0);
  lit += vec3(1.0, 0.98, 0.95) * (sp * 0.55 + sp2 * 0.12);

  // 边缘弯月面：贴着杯壁的一圈更亮更薄
  float rr = length(vLP.xz) / max(uCapR, 1e-3);
  float men = smoothstep(0.86, 1.0, rr);
  lit = mix(lit, c * 1.28 + 0.035, men * 0.45);

  float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 4.0);
  lit += vec3(0.85, 0.93, 0.91) * fres * 0.10;

  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function uniforms() {
  const u = {};
  for (const k in LB) u[k] = LB[k];
  return u;
}

// 杯身里的饮料体（BackSide，配料能透出来）+ 液面盖
export function buildLiquidBody(spec, geo) {
  const body = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: uniforms(), vertexShader: VERT, fragmentShader: FRAG_BODY,
    side: THREE.BackSide, depthWrite: true, depthTest: true,
  }));
  body.renderOrder = 1;
  body.frustumCulled = false;

  const cap = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: uniforms(), vertexShader: VERT_CAP, fragmentShader: FRAG_CAP,
    side: THREE.DoubleSide, depthWrite: false,
  }));
  cap.renderOrder = 2;
  cap.frustumCulled = false;

  return { body, cap };
}
