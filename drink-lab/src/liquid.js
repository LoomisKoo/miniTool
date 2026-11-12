// 液体：杯内体积的光线步进。每种液体只是一组吸收/散射系数。
// 四个组分：底饮（透亮）、奶（云絮状混入）、酱料（沉底+挂壁）、奶盖（浮顶）。
const THREE = window.THREE;
const v3 = (x = 0, y = 0, z = 0) => ({ value: new THREE.Vector3(x, y, z) });
const v2 = (x = 0, y = 0) => ({ value: new THREE.Vector2(x, y) });
const f = (x = 0) => ({ value: x });

export const LQ = {
  uInv: { value: new THREE.Matrix4() },
  uShape: f(), uCone: v2(1, 0), uSph: v2(1, 1),
  uYb: f(), uYt: f(3),
  uP: v3(), uN: v3(0, 1, 0),
  uHas: f(),
  uTeaA: v3(), uTeaS: v3(), uMilkA: v3(), uMilkS: v3(),
  uF: f(), uU: f(), uAge: f(99), uFlow: f(), uRipple: f(),
  uSyA: v3(), uSyS: v3(), uSyF: f(), uSyH: f(), uSyT: f(), uUs: f(), uStripe: f(), uStripeH: f(),
  uLay: f(1), uMilkH: f(),
  uFoamH: f(), uFoamC: v3(1, 1, 1), uDust: v3(1, 1, 1), uDustK: f(), uFDust: v3(1, 1, 1), uFDustK: f(),
  uLight: v3(0, 1, 0), uLight2: v3(0, 0, 1), uSky: v3(0.62, 0.70, 0.67),
};

export const LQ_GLSL = /* glsl */`
uniform mat4 uInv;
uniform float uShape, uYb, uYt, uHas, uF, uU, uAge, uFlow, uRipple;
uniform float uSyF, uSyH, uSyT, uUs, uStripe, uStripeH, uFoamH, uDustK, uFDustK, uLay, uMilkH;
uniform vec2 uCone, uSph;
uniform vec3 uP, uN, uTeaA, uTeaS, uMilkA, uMilkS, uSyA, uSyS, uFoamC, uDust, uFDust, uLight, uLight2, uSky;

float lqHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float lqNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(lqHash(i), lqHash(i + vec3(1,0,0)), f.x), mix(lqHash(i + vec3(0,1,0)), lqHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(lqHash(i + vec3(0,0,1)), lqHash(i + vec3(1,0,1)), f.x), mix(lqHash(i + vec3(0,1,1)), lqHash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float lqFbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * lqNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s / 0.875;
}

float lqRadius(float y) {
  if (uShape < 0.5) return uCone.x + uCone.y * y;
  float d = y - uSph.x;
  return sqrt(max(uSph.y * uSph.y - d * d, 0.0));
}

// 局部奶的占比：0 = 纯底饮，1 = 纯奶
float lqMilk(vec3 p) {
  if (uF <= 0.001) return 0.0;
  if (uU >= 0.999) return uF;
  float t = uFlow;
  float ang = t * 0.22 + p.y * 0.7;
  float cs = cos(ang), sn = sin(ang);
  vec3 q = vec3(cs * p.x - sn * p.z, p.y, sn * p.x + cs * p.z) * vec3(1.25, 0.85, 1.25);
  float w1 = lqNoise(q * 1.3 + vec3(0.0, t * 0.18, 0.0));
  float w2 = lqNoise(q * 1.3 + vec3(5.2, 1.3 - t * 0.14, 2.8));
  float n = lqFbm(q * 1.6 + vec3(w1, w2, w1) * 2.4 + vec3(0.0, t * 0.3, 0.0));
  n = (n - 0.5) * 2.2 + 0.5;
  float front = uP.y - uAge * 0.75;
  float sink = smoothstep(front - 0.6, front + 0.5, p.y + (n - 0.5) * 1.6);
  float wisp = smoothstep(0.5, 0.78, n);
  float cloud = clamp(wisp * sink * (0.12 + uF * 1.3), 0.0, 1.0);
  // 摇匀后仍然保留一点奶纹，真实奶茶不会变成一块死板的纯色
  return mix(cloud, uF, uU * 0.84);
}

void lqMedium(vec3 p, out vec3 sA, out vec3 sS) {
  float below = -dot(p - uP, uN);
  if (uFoamH > 0.001) {
    float edge = uFoamH + (lqNoise(vec3(p.xz * 3.0, 1.7)) - 0.5) * 0.07;
    if (below < edge) {
      vec3 col = mix(uFoamC, uDust, uDustK * (1.0 - smoothstep(0.015, 0.05, below)));
      sS = col * 26.0; sA = (1.0 - col) * 3.0 + 0.03;
      return;
    }
  }
  float c = lqMilk(p);
  float layLine = 0.0;
  // 分层：奶比茶重，静静倒进去会沉成中间一层（下面还有更重的酱料），摇匀才混掉
  if (uLay > 0.002 && uF > 0.002 && uF < 0.995 && uMilkH > 0.01) {
    float yb = p.y - uYb;
    float wob = (lqNoise(vec3(p.xz * 2.2 + uFlow * 0.35, 4.1)) - 0.5) * 0.13
              + (lqNoise(vec3(p.xz * 4.7, 8.6 + uFlow * 0.2)) - 0.5) * 0.05;
    float top = uSyH + uMilkH;
    // 上界面加一点缓慢的絮状起伏，像奶在茶里刚散开的边缘
    float wisp = (lqFbm(vec3(p.xz * 1.5, p.y * 1.2 + uFlow * 0.05)) - 0.5) * 0.22;
    float lo = smoothstep(uSyH - 0.09 + wob, uSyH + 0.14 + wob, yb);
    float hi = 1.0 - smoothstep(top - 0.13 + wob + wisp, top + 0.09 + wob + wisp * 0.6, yb);
    c = mix(c, lo * hi, uLay);
    // 分层面被光折射处那一道很细的亮边
    layLine = uLay * smoothstep(0.09, 0.0, abs(yb - top - wob));
  }
  sA = mix(uTeaA, uMilkA, c);
  sS = mix(uTeaS, uMilkS, c);
  sS += vec3(0.085, 0.082, 0.075) * layLine;
  if (uSyF > 0.0) {
    // 沉底的浆料：不规则的浆面 + 内部团块和漩涡，浓稠的会糊成一坨
    float n = lqNoise(p * vec3(4.0, 5.0, 4.0) + vec3(0.0, uFlow * 0.1, 0.0));
    float n2 = lqNoise(p * vec3(9.0, 7.0, 9.0) + 3.7);
    float surf = uSyH + (n - 0.5) * 0.13 + (n2 - 0.5) * 0.04;
    float layer = 1.0 - smoothstep(surf - 0.03, surf + 0.09, p.y - uYb);
    float stripe = 0.0;
    if (uStripe > 0.0) {
      float r = max(lqRadius(p.y), 1e-3);
      float rr = length(p.xz) / r;
      if (rr > 0.76) {
        vec2 d = p.xz / (rr * r);
        float sn = lqNoise(vec3(d.x * 3.0, p.y * 1.3 + d.y * 0.9, d.y * 3.0));
        stripe = smoothstep(0.4, 0.55, sn) * smoothstep(0.76, 0.9, rr) * (1.0 - smoothstep(uStripeH - 0.5, uStripeH, p.y)) * uStripe;
      }
    }
    // 团块让浆层有细微的浓度差；大块条纹会破坏“浓稠”的实心感
    float lump = lqNoise(p * vec3(6.5, 7.5, 6.5) + vec3(0.0, uFlow * 0.04, 0.0));
    float cs = mix(max(layer * (0.92 + 0.12 * lump), stripe), uSyF, uUs);
    cs = clamp(cs, 0.0, 1.0);
    // 越靠杯底越稠、越吸光，看起来是一坨而不是一层有颜色的水
    float deep = smoothstep(uSyH, -0.03, p.y - uYb);
    sA = mix(sA, uSyA * (1.0 + 0.9 * uSyT + 0.6 * uSyT * deep), cs);
    sS = mix(sS, uSyS * (1.0 + 0.6 * uSyT), cs);
    // 浆面被灯打亮的一线湿润反光
    float sheen = smoothstep(0.05, 0.0, abs(p.y - uYb - surf - 0.01)) * uSyT * step(0.001, layer);
    sS += vec3(0.055, 0.045, 0.035) * sheen;
  }
}

// 多次散射会放大颜色吸收，用 albedo 的幂近似，奶茶才有暖色而不是灰
vec3 lqAlbedo(vec3 sS, vec3 sT) {
  return pow(sS / sT, vec3(1.6)) * 1.12;
}

float lqLit(vec3 p) {
  float depth = max(0.0, -dot(p - uP, uN));
  vec2 side = normalize(p.xz + 1e-4);
  float rim = smoothstep(0.5, 1.0, length(p.xz) / max(lqRadius(p.y), 1e-3));
  // 主光从右前上方进杯，轮廓光从左后方；由此产生杯壁附近的明暗过渡
  float f1 = dot(side, normalize(uLight.xz + 1e-4));
  float f2 = dot(side, normalize(uLight2.xz + 1e-4));
  float fromTop = exp(-depth * 1.15);
  return 0.52 + 0.34 * fromTop
       + rim * (0.26 * f1 + 0.13 * f2 - 0.06)
       + 0.05 * max(0.0, f2);
}

// 光线在液体中的区间：杯体 ∩ [杯底, 杯口] ∩ 液面以下
bool lqRange(vec3 ro, vec3 rd, out float t0, out float t1, out bool viaSurf) {
  viaSurf = false;
  if (uShape < 0.5) {
    float k = uCone.y, q0 = uCone.x + k * ro.y;
    float A = dot(rd.xz, rd.xz) - k * k * rd.y * rd.y;
    float B = dot(ro.xz, rd.xz) - k * rd.y * q0;
    float C = dot(ro.xz, ro.xz) - q0 * q0;
    if (A < 1e-5) { t0 = -1e5; t1 = 1e5; }
    else {
      float h = B * B - A * C;
      if (h < 0.0) return false;
      h = sqrt(h);
      t0 = (-B - h) / A; t1 = (-B + h) / A;
    }
  } else {
    vec3 oc = ro - vec3(0.0, uSph.x, 0.0);
    float b = dot(oc, rd), c = dot(oc, oc) - uSph.y * uSph.y;
    float h = b * b - c;
    if (h < 0.0) return false;
    h = sqrt(h);
    t0 = -b - h; t1 = -b + h;
  }
  if (abs(rd.y) > 1e-5) {
    float ta = (uYb - ro.y) / rd.y, tb = (uYt - ro.y) / rd.y;
    t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb));
  } else if (ro.y < uYb || ro.y > uYt) return false;
  float dn = dot(rd, uN), s = dot(uP - ro, uN);
  if (abs(dn) > 1e-5) {
    float tp = s / dn;
    if (dn > 0.0) t1 = min(t1, tp);
    else if (tp > t0) { t0 = tp; viaSurf = true; }
  } else if (s < 0.0) return false;
  t0 = max(t0, 0.0);
  return t1 > t0;
}

// 给浸在液体里的物体加上它前方那段液体的遮挡
vec3 lqFog(vec3 col, vec3 worldPos, inout float alpha) {
  if (uHas < 0.5) return col;
  vec3 ro = (uInv * vec4(cameraPosition, 1.0)).xyz;
  vec3 d = (uInv * vec4(worldPos, 1.0)).xyz - ro;
  float tp = length(d); vec3 rd = d / tp;
  float t0, t1; bool vs;
  if (!lqRange(ro, rd, t0, t1, vs)) return col;
  float dist = min(tp, t1) - t0;
  if (dist <= 0.0) return col;
  vec3 pm = ro + rd * (t0 + dist * 0.5);
  vec3 sA, sS; lqMedium(pm, sA, sS);
  vec3 sT = sA + sS + 1e-4;
  vec3 tr = exp(-sT * dist);
  alpha = max(alpha, 1.0 - (tr.r + tr.g + tr.b) / 3.0);
  return col * tr + lqAlbedo(sS, sT) * (1.0 - tr) * lqLit(pm);
}
`;

const VERT = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */`
varying vec3 vWorld;
void main() {
  if (uHas < 0.5) discard;
  vec3 ro = (uInv * vec4(cameraPosition, 1.0)).xyz;
  vec3 rd = normalize((uInv * vec4(vWorld, 1.0)).xyz - ro);
  float t0, t1; bool viaSurf;
  if (!lqRange(ro, rd, t0, t1, viaSurf)) discard;

  vec3 T = vec3(1.0), L = vec3(0.0);
  float ds = (t1 - t0) / float(STEPS);
  float j = lqHash(vec3(gl_FragCoord.xy, fract(uFlow) * 31.0));
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (t0 + (float(i) + j) * ds);
    vec3 sA, sS; lqMedium(p, sA, sS);
    vec3 sT = sA + sS + 1e-4;
    vec3 st = exp(-sT * ds);
    L += T * lqAlbedo(sS, sT) * (1.0 - st) * lqLit(p);
    T *= st;
  }

  if (viaSurf) {
    vec3 sp = ro + rd * t0;
    vec3 q = vec3(sp.xz * 5.0, uFlow * 1.5);
    float h0 = lqNoise(q);
    float rip = uRipple * (uFoamH > 0.001 ? 0.2 : 1.0);
    vec3 n = normalize(uN + rip * 6.0 * vec3(lqNoise(q + vec3(0.08, 0.0, 0.0)) - h0, 0.0, lqNoise(q + vec3(0.0, 0.08, 0.0)) - h0));
    float ndv = max(dot(-rd, n), 0.0);
    float F = (0.018 + 0.982 * pow(1.0 - ndv, 5.0)) * (uFoamH > 0.001 ? 0.3 : 1.0);
    // 两个高光都调软：插画里是柔光斑，不是针尖
    vec3 r = reflect(rd, n);
    float spec1 = pow(max(dot(r, uLight), 0.0), 60.0) * (uFoamH > 0.001 ? 0.2 : 1.05);
    float spec2 = pow(max(dot(r, uLight2), 0.0), 14.0) * (uFoamH > 0.001 ? 0.12 : 0.42);
    // 贴壁处的弯月面：液面沿杯壁微微上翘，边缘有一圈更亮的反光
    float edge = smoothstep(0.84, 1.0, length(sp.xz) / max(lqRadius(sp.y), 1e-3)) * (uFoamH > 0.001 ? 0.0 : 1.0);
    vec3 sky = mix(vec3(0.26, 0.34, 0.32), uSky, 0.8);
    L = L * (1.0 - F) + F * sky + spec1 + spec2 + edge * (0.08 + 0.08 * max(0.0, dot(normalize(uLight.xz + 1e-4), normalize(sp.xz + 1e-4))));
    T *= 1.0 - F;
  }

#ifdef PASS_T
  gl_FragColor = vec4(pow(T, vec3(1.0 / 2.2)), 1.0);
#else
  // 帧缓冲是 sRGB，直接相加会让薄液层发白；假设背后大致是背景色来扣掉多出的部分
  vec3 bg = vec3(0.49, 0.56, 0.53) * T;
  L = L / (1.0 + L * 0.12);
  gl_FragColor = vec4(max(pow(L + bg, vec3(1.0 / 2.2)) - pow(bg, vec3(1.0 / 2.2)), 0.0), 1.0);
#endif
}`;

// 每像素透射率是分通道的（茶把背后染成琥珀色），单个混合方程做不到，
// 所以分两遍：先乘透射率，再加散射光。
export function makeLiquidMeshes(geometry) {
  const common = {
    uniforms: LQ, vertexShader: VERT, fragmentShader: LQ_GLSL + FRAG,
    transparent: true, depthWrite: false, side: THREE.BackSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  };
  const mulMat = new THREE.ShaderMaterial({
    ...common, defines: { STEPS: 16, PASS_T: 1 },
    blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const addMat = new THREE.ShaderMaterial({
    ...common, defines: { STEPS: 24 },
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const mul = new THREE.Mesh(geometry, mulMat);
  const add = new THREE.Mesh(geometry, addMat);
  mul.renderOrder = 2; add.renderOrder = 3;
  mul.frustumCulled = add.frustumCulled = false;
  return [mul, add];
}

// 给标准材质注入液体遮挡；extra 可以在遮挡之前再改颜色/透明度（vLqO 为模型局部坐标）
export function addLiquidFog(mat, extra = '') {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LQ);
    sh.vertexShader = 'varying vec3 vLqW;\nvarying vec3 vLqO;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 lqp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      lqp = instanceMatrix * lqp;
      #endif
      vLqW = (modelMatrix * lqp).xyz;
      vLqO = position;
      #ifdef USE_INSTANCING
      vLqO += vec3(float(gl_InstanceID) * 3.17);
      #endif`);
    sh.fragmentShader = 'varying vec3 vLqW;\nvarying vec3 vLqO;\n' + LQ_GLSL + sh.fragmentShader.replace('#include <tonemapping_fragment>', `
      ${extra}
      { float a = gl_FragColor.a; gl_FragColor.rgb = lqFog(gl_FragColor.rgb, vLqW, a); gl_FragColor.a = a; }
      #include <tonemapping_fragment>`);
  };
  mat.customProgramCacheKey = () => 'lq' + extra;
  return mat;
}

// 半透明物体（冰、晶球、椰果）的边缘亮、内部裂纹/霜
// 冰：几乎全透，只有掠射角（越靠轮廓越厚）是霜白的；
// 内部有不规则裂纹和小气泡，都是亮线/亮点，不整体发白
export const ICE_FRAG = /* glsl */`
{
  vec3 nn = normalize(normal); vec3 vv = normalize(vViewPosition);
  float ndv = abs(dot(nn, vv));
  float rim = pow(1.0 - ndv, 3.2);
  // 裂纹：等值线式的细线，沿几个方向拉伸，看起来像冻出来的裂面
  vec3 q = vLqO * vec3(6.0, 9.0, 6.0);
  float cr = lqNoise(q) * 0.65 + lqNoise(q * 2.7 + 4.1) * 0.35;
  float crack = 1.0 - smoothstep(0.0, 0.035, abs(cr - 0.5));
  float cr2 = lqNoise(vLqO * vec3(16.0, 5.0, 16.0) + 2.3);
  crack *= smoothstep(0.35, 0.6, cr2);
  // 小气泡
  float bub = smoothstep(0.86, 0.97, lqNoise(vLqO * 46.0));
  float frost = lqNoise(vLqO * 30.0);
  vec3 tint = vec3(0.84, 0.94, 1.0);
  // 保留环境反射，只淡淡染一点冰蓝；白色全部集中在轮廓和裂纹上
  gl_FragColor.rgb = mix(gl_FragColor.rgb, tint, 0.22);
  gl_FragColor.rgb *= 0.94 + 0.12 * frost;
  gl_FragColor.rgb += tint * (rim * 0.7 + crack * 0.26 + bub * 0.2);
  gl_FragColor.rgb += vec3(1.0) * pow(ndv, 5.0) * 0.12;
  gl_FragColor.a = clamp(0.06 + rim * 0.72 + crack * 0.26 + bub * 0.2 + (frost - 0.5) * 0.04, 0.0, 0.82);
}`;

export const JELLY_FRAG = /* glsl */`
{
  vec3 nn = normalize(normal); vec3 vv = normalize(vViewPosition);
  float fr = pow(1.0 - abs(dot(nn, vv)), 2.0);
  gl_FragColor.rgb += diffuseColor.rgb * fr * 0.5;
  gl_FragColor.a = clamp(gl_FragColor.a + fr * 0.35, 0.0, 0.97);
}`;

export const RIM_FRAG = /* glsl */`
{
  vec3 nn = normalize(normal); vec3 vv = normalize(vViewPosition);
  float fr = pow(1.0 - abs(dot(nn, vv)), 2.0);
  gl_FragColor.rgb += diffuseColor.rgb * fr * 0.6;
}`;

// 食材：颜色不均（淀粉、纤维）+ 次表面透光（边缘透出更亮更饱和的本色），避免塑料感
export const ORGANIC_FRAG = /* glsl */`
{
  vec3 nn = normalize(normal); vec3 vv = normalize(vViewPosition);
  float fr = pow(1.0 - abs(dot(nn, vv)), 2.0);
  vec3 base = diffuseColor.rgb;
  gl_FragColor.rgb *= 0.84 + 0.24 * lqNoise(vLqO * 16.0) + 0.08 * lqNoise(vLqO * 60.0 + 7.0);
  gl_FragColor.rgb += sqrt(base) * base * fr * 0.7;
}`;

// 煮好的木薯珍珠：深褐色芯，外层是半透明的胶质，边缘透出琥珀色；湿润但不是镜面
export const PEARL_FRAG = /* glsl */`
{
  vec3 nn = normalize(normal); vec3 vv = normalize(vViewPosition);
  float ndv = abs(dot(nn, vv));
  float rim = pow(1.0 - ndv, 1.6);
  float n = lqNoise(vLqO * 26.0);
  gl_FragColor.rgb *= 0.85 + 0.3 * n;
  gl_FragColor.rgb += vec3(0.36, 0.15, 0.05) * rim * 0.75;
  gl_FragColor.rgb += vec3(0.12, 0.05, 0.02) * smoothstep(0.55, 1.0, ndv) * (0.5 + n);
  // 湿润的糖壳：一个很小的高光点，别做成玻璃球
  gl_FragColor.rgb += vec3(1.0, 0.93, 0.82) * pow(ndv, 26.0) * 0.16;
}`;

// 玻璃：真实玻璃在照片里由三样东西“立”起来——
// 1) 一条极窄、偏灰的轮廓线（视线几乎平行于表面）
// 2) 柔光箱在圆柱壁上留下的竖直亮条（世界空间角度固定，转杯子会跟着移动）
// 3) 杯口、杯底这些厚的地方偏青、偏实
// 中间大面积保持通透，alpha 很低，不然就会糊成一层灰。
function glassFrag({ base, edgeA, streakA, dark, mul, edgeW = 0.17, tint = 0.10, hi = 0, frost = 0 }) {
  const f = (n) => Number(n).toFixed(3);
  const E = (k) => f(Number(edgeW) * k);
  return /* glsl */`
{
  vec3 nn = normalize(normal); vec3 vv = normalize(vViewPosition);
  float ndv = abs(dot(nn, vv));
  // 世界空间法线：viewMatrix 的 3x3 是相机旋转的转置，乘回去就得到世界方向
  mat3 vm = mat3(viewMatrix);
  vec3 wn = normalize(vec3(dot(vm[0], nn), dot(vm[1], nn), dot(vm[2], nn)));
  float ang = atan(wn.z, wn.x);
  float lit = clamp(dot(wn, normalize(vec3(0.39, 0.78, 0.48))), 0.0, 1.0);
  float side = smoothstep(0.02, 0.62, lit);

  // 柔光箱在圆柱壁上的竖向亮条：一条主光 + 两条很窄的副反射
  float streak = pow(max(0.0, cos(ang - 1.42)), 46.0) * 1.05
               + pow(max(0.0, cos(ang - 0.62)), 112.0) * 0.66
               + pow(max(0.0, cos(ang - 2.48)), 185.0) * 0.5
               + pow(max(0.0, cos(ang - 3.55)), 26.0) * 0.16;
  streak *= 0.55 + 0.45 * (0.5 + 0.5 * wn.y);
  // 大面积的柔和窗光：让圆柱有“玻璃在反光”的整体感，而不是只有几条亮线
  float broad = pow(max(0.0, cos(ang - 1.28)), 4.0) * 0.085;
  // 极窄的一条镜面高光：玻璃和塑料最大的区别就在这条线够不够利
  float glint = pow(max(0.0, cos(ang - 1.12)), 320.0) * 0.85;

  // 菲涅尔：中间全透，只有掠射角才反光
  float F = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
  float edge = 1.0 - smoothstep(${E(0.55)}, ${E(1.0)}, ndv);
  float inner = smoothstep(${E(1.02)}, ${E(1.7)}, ndv) * (1.0 - smoothstep(${E(2.0)}, ${E(3.4)}, ndv));
  float sheen = pow(ndv, 4.0) * ${f(hi)};

  // 本体几乎无色，只保留材质本身的一点冷光
  vec3 col = gl_FragColor.rgb * 1.02;
  col += vec3(1.0, 0.995, 0.975) * streak * ${f(streakA)};
  col += vec3(0.70, 0.84, 0.82) * inner * ${f(tint)} * 0.85;
  col += vec3(0.95, 1.0, 0.98) * broad;
  col += vec3(1.0, 1.0, 0.99) * glint;
  col += vec3(1.0) * sheen;
  // 小件（把手、杯口）需要一点磨砂，否则完全透明会和背景糊在一起
  col = mix(col, vec3(0.90, 0.945, 0.935), ${f(frost)} * 0.55);
  // 厚度带：背光侧偏深青，受光侧透亮；不是一层均匀的灰
  col = mix(col, mix(vec3(0.20, 0.27, 0.26), vec3(0.93, 0.99, 0.97), side), inner * 0.40);
  // 轮廓线：受光侧亮白，背光侧深青灰
  col = mix(col, mix(vec3(0.075, 0.115, 0.115), vec3(0.98, 1.0, 0.995), side), edge * ${f(dark)});
  // 紧贴轮廓内侧的二次反光，是玻璃“厚度”的关键
  float halo = smoothstep(${E(0.92)}, ${E(1.06)}, ndv) * (1.0 - smoothstep(${E(1.06)}, ${E(1.5)}, ndv));
  col += vec3(0.82, 0.93, 0.91) * halo * (0.05 + 0.28 * side);
  // 大面积仍然只染极淡的冷色，避免发灰
  col = mix(col, vec3(0.56, 0.68, 0.70), ${f(tint)} * 0.32 * smoothstep(0.3, 0.95, 1.0 - ndv));
  gl_FragColor.rgb = col;
  gl_FragColor.a = clamp((${f(base)} + F * ${f(edgeA)} * 1.2 + streak * ${f(streakA)} * 0.55 + broad * 0.6 + glint * 0.5 + sheen * 0.5 + inner * 0.25 + edge * ${f(edgeA)} * 0.3) * ${f(mul)}, 0.0, 0.98);
}`;
}
export const GLASS_FRAG = glassFrag({ base: 0.07, edgeA: 0.95, streakA: 0.32, dark: 0.92, mul: 1, tint: 0.20 });
// 内壁：别盖住液体，只要一层薄薄的反光和轮廓
export const GLASS_INNER_FRAG = glassFrag({ base: 0.04, edgeA: 0.32, streakA: 0.08, dark: 0.45, mul: 0.62, tint: 0.10 });
// 把手这类小件：透过的是两层玻璃，所以比杯壁“实”得多，否则在浅色背景上直接消失
export const GLASS_HANDLE_FRAG = glassFrag({ base: 0.34, edgeA: 1.0, streakA: 0.0, dark: 0.95, mul: 1.0, edgeW: 0.34, tint: 0.16, hi: 0.85, frost: 0.16 });
// 杯口：厚玻璃截面，比杯壁实、比把手透
export const GLASS_RIM_FRAG = glassFrag({ base: 0.34, edgeA: 0.9, streakA: 0.0, dark: 0.8, mul: 1.0, edgeW: 0.26, tint: 0.14, frost: 0.45 });

// 塑料杯：比玻璃雾一点、反光软一点，但也需要竖直亮条和清晰轮廓
export const PLASTIC_FRAG = /* glsl */`
{
  vec3 nn = normalize(normal); vec3 vv = normalize(vViewPosition);
  float ndv = abs(dot(nn, vv));
  mat3 vm = mat3(viewMatrix);
  vec3 wn = normalize(vec3(dot(vm[0], nn), dot(vm[1], nn), dot(vm[2], nn)));
  float ang = atan(wn.z, wn.x);
  float streak = pow(max(0.0, cos(ang - 1.42)), 54.0) * 1.0
               + pow(max(0.0, cos(ang - 0.55)), 110.0) * 0.7;
  float edge = 1.0 - smoothstep(0.03, 0.17, ndv);
  float band = smoothstep(0.10, 0.22, ndv) * (1.0 - smoothstep(0.22, 0.44, ndv));
  vec3 col = gl_FragColor.rgb * 1.05 + vec3(1.0, 0.99, 0.97) * streak * 0.22 + vec3(1.0) * band * 0.12;
  col = mix(col, vec3(0.46, 0.51, 0.52), edge * 0.7);
  gl_FragColor.rgb = col;
  gl_FragColor.a = clamp(0.06 + streak * 0.24 + band * 0.1 + edge * 0.82, 0.0, 0.94);
}`;

// 透明吸管：单独一套，比杯壁更实、更冷一点，保证在任何液体里都能看清
export const STRAW_FRAG = /* glsl */`
{
  vec3 nn = normalize(normal); vec3 vv = normalize(vViewPosition);
  float ndv = abs(dot(nn, vv));
  mat3 vm = mat3(viewMatrix);
  vec3 wn = normalize(vec3(dot(vm[0], nn), dot(vm[1], nn), dot(vm[2], nn)));
  float ang = atan(wn.z, wn.x);
  float streak = pow(max(0.0, cos(ang - 1.42)), 24.0) + pow(max(0.0, cos(ang - 0.55)), 56.0) * 0.7;
  // 吸管很细，同一个 ndv 阈值对应的像素宽度小得多，所以轮廓阈值要放大
  float edge = 1.0 - smoothstep(0.05, 0.45, ndv);
  vec3 col = gl_FragColor.rgb * 1.1 + vec3(0.78, 0.92, 1.0) * (streak * 0.5 + edge * 0.5);
  col = mix(col, vec3(0.55, 0.66, 0.70), edge * 0.35);
  gl_FragColor.rgb = col;
  gl_FragColor.a = clamp(0.26 + streak * 0.34 + edge * 0.48, 0.0, 0.96);
}`;

// 半固体奶盖：细密气孔、边缘透光，顶上撒粉（vLqO 为单位几何坐标，顶部 y≈1）
export const FOAM_FRAG = /* glsl */`
{
  vec3 nn = normalize(normal); vec3 vv = normalize(vViewPosition);
  float fr = pow(1.0 - abs(dot(nn, vv)), 2.0);
  float b = lqNoise(vLqO * vec3(26.0, 12.0, 26.0));            // 大块的奶油起伏
  float b2 = lqNoise(vLqO * vec3(88.0, 34.0, 88.0));           // 细密气孔
  float pore = lqNoise(vLqO * vec3(210.0, 90.0, 210.0));       // 更细的小泡
  float up = smoothstep(-0.12, 0.95, vLqO.y);
  // 整体压下来一点，别被灯光打成一团死白
  gl_FragColor.rgb *= 0.87 + 0.13 * up;
  // 凹陷处偏奶油黄，凸起处偏白
  gl_FragColor.rgb *= mix(vec3(0.955, 0.905, 0.82), vec3(1.0), smoothstep(0.35, 0.85, b));
  gl_FragColor.rgb *= 0.87 + 0.17 * b + 0.07 * b2;
  // 气孔：细小的暗坑 + 碎高光，让表面有打发的颗粒感
  gl_FragColor.rgb -= diffuseColor.rgb * smoothstep(0.70, 1.0, pore) * 0.12;
  gl_FragColor.rgb += vec3(1.0, 0.99, 0.95) * smoothstep(0.66, 0.95, b2) * 0.10;
  // 边缘被光打透的奶油感
  gl_FragColor.rgb += diffuseColor.rgb * fr * 0.14;
  // 贴着杯壁一圈轻微压暗，让奶盖和玻璃分得开
  float wall = smoothstep(0.9, 1.0, length(vLqO.xz));
  gl_FragColor.rgb *= 1.0 - wall * 0.10;
  float top = smoothstep(0.8, 1.0, vLqO.y) * uFDustK;
  float speck = 0.55 + 0.45 * lqNoise(vLqO * 80.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFDust * speck * 1.6, top * (0.75 + 0.25 * b));
}`;


export function addFrag(mat, extra) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', extra + '\n#include <tonemapping_fragment>');
  };
  mat.customProgramCacheKey = () => 'fx' + extra;
  return mat;
}
