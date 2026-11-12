import * as THREE from 'three'

const cache = new Map()
const texCache = new Map()

function make(key, factory) {
  let m = cache.get(key)
  if (!m) {
    m = factory()
    m.name = key
    cache.set(key, m)
  }
  return m
}

function canvasTex(key, size, draw, opts = {}) {
  let t = texCache.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = opts.colorSpace ?? THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  texCache.set(key, t)
  return t
}

/** 多种立面图集：靠不同窗格节奏拉开观感 */
export function facadeMap(style = 'glass') {
  return canvasTex(`facade:${style}`, 256, (ctx, s) => {
    if (style === 'warm') {
      ctx.fillStyle = '#9a8870'
      ctx.fillRect(0, 0, s, s)
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 6; x++) {
          ctx.fillStyle = (x + y) % 5 !== 0 ? '#384850' : '#6e6258'
          ctx.fillRect(8 + x * 40, 6 + y * 32, 28, 22)
        }
      }
    } else if (style === 'stone') {
      ctx.fillStyle = '#9a958c'
      ctx.fillRect(0, 0, s, s)
      ctx.strokeStyle = '#7a756c'
      ctx.lineWidth = 2
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 5; x++) {
          const ox = (y % 2) * 24
          ctx.strokeRect(4 + x * 50 + ox, 4 + y * 25, 44, 20)
          ctx.fillStyle = '#384850'
          ctx.fillRect(10 + x * 50 + ox, 8 + y * 25, 16, 12)
        }
      }
    } else if (style === 'stripe') {
      ctx.fillStyle = '#3a4450'
      ctx.fillRect(0, 0, s, s)
      for (let y = 0; y < 16; y++) {
        ctx.fillStyle = y % 2 === 0 ? '#9eb4c6' : '#2e3844'
        ctx.fillRect(0, y * 16, s, 10)
        for (let x = 0; x < 10; x++) {
          ctx.fillStyle = 'rgba(220,235,245,0.35)'
          ctx.fillRect(4 + x * 25, y * 16 + 2, 10, 6)
        }
      }
    } else if (style === 'dark') {
      ctx.fillStyle = '#1c222a'
      ctx.fillRect(0, 0, s, s)
      for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 7; x++) {
          const on = (x * 3 + y * 5) % 7 !== 0
          ctx.fillStyle = on ? '#384850' : '#14181e'
          ctx.fillRect(6 + x * 36, 4 + y * 18, 28, 12)
        }
      }
    } else if (style === 'mirror') {
      ctx.fillStyle = '#4a6070'
      ctx.fillRect(0, 0, s, s)
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 10; x++) {
          ctx.fillStyle = '#384850'
          ctx.fillRect(x * 26, y * 13, 24, 11)
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(0, 0, s / 2, s)
    } else if (style === 'bronze') {
      ctx.fillStyle = '#6a5240'
      ctx.fillRect(0, 0, s, s)
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 5; x++) {
          ctx.fillStyle = (x + y) % 3 === 0 ? '#2a241c' : '#c8b896'
          ctx.fillRect(8 + x * 48, 6 + y * 28, 36, 20)
        }
      }
    } else {
      // glass curtain
      ctx.fillStyle = '#2a323c'
      ctx.fillRect(0, 0, s, s)
      for (let y = 0; y < 12; y++) {
        for (let x = 0; x < 8; x++) {
          ctx.fillStyle = '#384850'
          ctx.fillRect(3 + x * 32, 2 + y * 21, 26, 17)
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(0, 0, s, s / 3)
    }
  })
}

export function asphaltMap() {
  return canvasTex('asphalt', 128, (ctx, s) => {
    // 沥青：中灰（以前底色×材质色两次相乘接近纯黑，夜里路灯照上去也看不出）
    ctx.fillStyle = '#6a6e74'
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 800; i++) {
      const v = 80 + (Math.random() * 40) | 0
      ctx.fillStyle = `rgb(${v},${v},${v + 2})`
      ctx.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 2, 2)
    }
  }, { colorSpace: THREE.NoColorSpace })
}

export function concrete(tint = '#8a929c') {
  return make(`concrete:${tint}`, () =>
    tactile(new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.9,
      metalness: 0.04,
      envMapIntensity: 0.5,
    })),
  )
}

/** t35 共享的值噪声（GLSL）：hash + 双线性平滑插值，前缀 tq 避免和各材质自带函数重名 */
export const TQ_NOISE = `
  float tqH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float tqN(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(tqH(i), tqH(i + vec2(1.0, 0.0)), f.x), mix(tqH(i + vec2(0.0, 1.0)), tqH(i + vec2(1.0, 1.0)), f.x), f.y); }
`

/**
 * t35 通用「主题乐园布景」质感：给普通纯色材质（设施零件、公共建筑体块、船、城墙/河岸混凝土……）加
 * 世界坐标的 漆面颗粒（近）+ 有机冷暖/明暗斑驳（远也在）+ 贴地返潮污渍（竖面）+ 逐处光泽差（粗糙度起伏）。
 * 按法线主轴选投影面（简化三平面），只加 2 个 varying；amp 控制强度（0.6 小零件 / 1 默认）。
 */
export function tactile(mat, amp = 1, box = false) {
  if (mat.userData.tactile) return mat
  mat.userData.tactile = true
  // box=true：几何是单位立方体（实例缩放成实际尺寸）→ 能算出到棱边的米制距离：棱边一道细亮线（倒角受光）+ 棱内侧一圈积灰，
  // 这是「真的被建出来、刷过漆、用旧了」最强的线索
  if (box) mat.defines = { ...(mat.defines || {}), TQ_BOX: '' }
  const prev = mat.onBeforeCompile
  const A = Number(amp).toFixed(2)
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTqW;\nvarying vec3 vTqN;\n#ifdef TQ_BOX\nvarying vec3 vTqE;\n#endif')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef TQ_BOX
          #ifdef USE_INSTANCING
            vec3 _tqS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          #else
            vec3 _tqS = vec3(1.0);
          #endif
          // 每轴到该轴两端面的米制距离（朝向本面的那一轴取很大值，不算棱）
          vTqE = (0.5 - abs(position)) * _tqS + abs(objectNormal) * 1e3;
        #endif
        #ifdef USE_INSTANCING
          vTqW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vTqN = (modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).xyz;
        #else
          vTqW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vTqN = (modelMatrix * vec4(objectNormal, 0.0)).xyz;
        #endif`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTqW;
        varying vec3 vTqN;
        #ifdef TQ_BOX
          varying vec3 vTqE;
        #endif
        float tqRough = 0.0;
        ${TQ_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 tn = normalize(vTqN + 1e-5);
          vec3 an = abs(tn);
          vec2 q = an.y > 0.6 ? vTqW.xz : (an.x > an.z ? vTqW.zy : vTqW.xy);
          float fw = max(fwidth(q.x), fwidth(q.y));
          float nD = 1.0 - smoothstep(0.02, 0.14, fw);
          float mD = 1.0 - smoothstep(0.14, 1.0, fw);
          float grain = (tqN(q * 7.0) - 0.5) * nD + (tqN(q * 1.6 + 7.1) - 0.5) * mD;
          float mott = tqN(q / 3.2 + 3.0) * 0.55 + tqN(q / 12.0 + 1.0) * 0.45;
          vec3 c = diffuseColor.rgb;
          c *= 1.0 + (grain * 0.05 + (mott - 0.5) * 0.12) * ${A}; // t42 颗粒 / 斑点减半以上
          c *= mix(vec3(1.0), mix(vec3(0.96, 0.99, 1.045), vec3(1.045, 1.0, 0.945), tqN(q / 7.5 + 11.0)), ${A});
          #ifdef TQ_BOX
          {
            float ed = min(vTqE.x, min(vTqE.y, vTqE.z));
            float efw = fwidth(ed) + 1e-4;
            float lip = (1.0 - smoothstep(0.0, 0.035 + efw, ed)) * clamp(0.04 / efw, 0.0, 1.0);
            float crease = (1.0 - smoothstep(0.03, 0.35 + 0.25 * tqN(q * 1.3), ed)) * (1.0 - lip);
            float wear = smoothstep(0.45, 0.75, tqN(q * 2.3 + 17.0));
            c = mix(c, min(c * 1.22 + 0.05, vec3(1.0)), lip * (0.55 + 0.45 * wear) * ${A});
            c = mix(c, c * vec3(0.86, 0.83, 0.78), crease * 0.45 * ${A});
            tqRough += crease * 0.12 - lip * 0.1;
          }
          #endif
          float hy = vTqW.y;
          float contact = (1.0 - smoothstep(0.0, 1.0 + tqN(q * 0.7) * 0.9, hy)) * step(-0.3, hy) * (1.0 - an.y) * 0.16 * ${A};
          c = mix(c, c * vec3(0.84, 0.8, 0.74), contact * 1.6);
          diffuseColor.rgb = c;
          tqRough += ((mott - 0.5) * 0.18 + grain * 0.05 + contact * 0.5) * ${A};
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + tqRough, 0.04, 1.0);`)
  }
  const pk = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => ''
  mat.customProgramCacheKey = () => pk() + `|tactile-v3-${A}${box ? '-box' : ''}`
  mat.needsUpdate = true
  return mat
}

/**
 * t34 地面/地块工艺：世界坐标 XZ 程序化纹理，只作用在朝上的面（侧面不动），远看也保留低频分区明暗。
 * kind: 'pave' 0.6×0.3 铺砖 + 3m 分格缝 | 'slab' 1.2m 石板 | 'asphalt' 骨料噪点 + 补丁 + 油渍 | 'lawn' 4m 剪草条纹 + 草丛斑
 * | 'ground' 城市底板：6m 大板分格 + 冷暖斑块
 */
export function groundCraft(mat, kind) {
  const K = { pave: 0, slab: 1, asphalt: 2, lawn: 3, ground: 4 }[kind] ?? 0
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nvarying float vGUp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vGW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vGUp = (modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).y;
        #else
          vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vGUp = (modelMatrix * vec4(objectNormal, 0.0)).y;
        #endif`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGW;
        varying float vGUp;
        float gRgh = 0.0;
        float gHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float gNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y); }
        float gLine(float x, float P, float w, float fw) { float d = (0.5 - abs(fract(x / P) - 0.5)) * P; return 1.0 - smoothstep(w, w + fw * 1.5, d); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vGUp > 0.5) {
          vec2 q = vGW.xz;
          float fw = max(fwidth(q.x), fwidth(q.y));
          float nearD = 1.0 - smoothstep(0.04, 0.25, fw);
          float midD = 1.0 - smoothstep(0.25, 1.4, fw);
          // 低频：大尺度明暗/冷暖斑（远看也在）
          float lo = gNoise(q / 23.0) * 0.6 + gNoise(q / 7.0) * 0.4;
          vec3 c = diffuseColor.rgb * (0.93 + 0.14 * lo);
          int k = ${K};
          if (k == 0) {
            float cell = gHash(floor(q / 3.0) + 5.0);
            c *= 0.96 + 0.08 * cell;
            float row = floor(q.y / 0.3);
            float bx = q.x / 0.6 + mod(row, 2.0) * 0.5;
            float j = max(gLine(bx * 0.6, 0.6, 0.012, fw), gLine(q.y, 0.3, 0.012, fw)) * nearD;
            c *= 1.0 - 0.12 * j + (gHash(vec2(floor(bx), row)) - 0.5) * 0.07 * nearD;
            float big = max(gLine(q.x, 3.0, 0.05, fw), gLine(q.y, 3.0, 0.05, fw)) * midD;
            c *= 1.0 - 0.14 * big;
          } else if (k == 1) {
            vec2 sc = floor(q / vec2(1.2, 0.8));
            c *= 0.94 + 0.1 * gHash(sc);
            float j = max(gLine(q.x, 1.2, 0.015, fw), gLine(q.y, 0.8, 0.015, fw)) * midD;
            c *= 1.0 - 0.16 * j;
          } else if (k == 2) {
            c *= 1.0 + (gHash(floor(q * 6.0)) - 0.5) * 0.12 * nearD;
            float patchv = smoothstep(0.66, 0.7, gNoise(q / 9.0 + 3.1));
            c = mix(c, c * 1.16 + 0.015, patchv * 0.7);
            float oil = smoothstep(0.72, 0.9, gNoise(q / 2.3 + 8.0)) * 0.22;
            c *= 1.0 - oil;
          } else if (k == 3) {
            float stripe = step(0.5, fract((q.x + q.y * 0.15) / 8.0));
            c *= mix(0.94, 1.05, stripe) ;
            c *= 0.9 + 0.2 * gNoise(q * 0.9) * midD + 0.0;
            c = mix(c, c * vec3(1.08, 1.06, 0.82), smoothstep(0.7, 0.95, gNoise(q / 13.0 + 2.0)) * 0.5);
          } else {
            float big = max(gLine(q.x, 6.0, 0.06, fw), gLine(q.y, 6.0, 0.06, fw)) * midD;
            c *= 0.95 + 0.1 * gHash(floor(q / 6.0) + 9.0);
            c *= 1.0 - 0.12 * big;
            c *= 1.0 + (gHash(floor(q * 4.0)) - 0.5) * 0.05 * nearD;
          }
          // t35 有机层（所有地面）：近处颗粒 + 2~25m 不规则污渍/晒褪斑（不是方格马赛克）+ 低洼积灰；粗糙度跟着起伏（湿/磨亮处更亮滑）
          float gr = (gNoise(q * 5.0) - 0.5) * nearD + (gNoise(q * 1.3 + 4.0) - 0.5) * midD;
          float st = gNoise(q / 2.3 + 6.0) * 0.35 + gNoise(q / 8.0 + 2.0) * 0.4 + gNoise(q / 25.0) * 0.25;
          float stain = smoothstep(0.58, 0.82, st);
          c *= 1.0 + gr * 0.07;
          c = mix(c, c * vec3(0.86, 0.83, 0.78), stain * ${kind === 'lawn' ? '0.25' : '0.42'});
          c = mix(c, c * vec3(1.05, 1.03, 0.98) + 0.01, (1.0 - smoothstep(0.12, 0.32, st)) * ${kind === 'lawn' ? '0.3' : '0.5'});
          gRgh = (st - 0.5) * 0.22 - stain * ${kind === 'asphalt' ? '0.28' : '0.1'} + gr * 0.06;
          diffuseColor.rgb = c;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + gRgh * step(0.5, vGUp), 0.05, 1.0);`)
  }
  const pk = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => ''
  mat.customProgramCacheKey = () => pk() + `|ground-${kind}-v2`
  mat.needsUpdate = true
  return mat
}

export function deck() {
  return make('deck', () =>
    new THREE.MeshStandardMaterial({
      color: '#a8b0ba',
      roughness: 0.72,
      metalness: 0.08,
      envMapIntensity: 0.75,
    }),
  )
}

export function glass() {
  return make('glass', () =>
    new THREE.MeshStandardMaterial({
      color: '#384850',
      roughness: 0.22,
      metalness: 0.35,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    }),
  )
}

export function windowPanel() {
  return make('windowPanel', () =>
    new THREE.MeshStandardMaterial({
      color: '#384850',
      roughness: 0.26,
      metalness: 0.28,
      envMapIntensity: 1.1,
    }),
  )
}

export function asphalt() {
  // 干净沥青：不再用重复贴图（贴图沿路长方向被拉成一道道深色条纹，横向重复 8 次的黄线变成多条橄榄色细线）。
  // 改为按世界坐标的细噪声 + 大尺度轻微斑驳，高频部分按屏幕像素大小淡出，远处不起摩尔纹
  return make('asphalt', () => {
    const m = new THREE.MeshStandardMaterial({
      // t32 暖深炭灰沥青（以前 #6c7076 偏蓝的中灰，白天看像一条条廉价灰塑料）
      color: '#4f4d4c',
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.32,
    })
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vAXZ;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vAXZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz;
          #else
            vAXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
          #endif`)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec2 vAXZ;
          float aRgh = 0.0;
          float aHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          float aNoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(aHash(i), aHash(i + vec2(1, 0)), f.x), mix(aHash(i + vec2(0, 1)), aHash(i + vec2(1, 1)), f.x), f.y);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float fw = max(fwidth(vAXZ.x), fwidth(vAXZ.y));
            // 只留低频轻微斑驳（细噪声在远处/斜视会变成一粒粒的斑点）
            float mid = (aNoise(vAXZ * 0.12) - 0.5) * (1.0 - smoothstep(1.5, 5.0, fw));
            float big = aNoise(vAXZ * 0.018) - 0.5;
            // 骨料细斑（近处）+ 大片新旧补丁（暖/冷两种沥青略有色差），远处只剩补丁
            float patchN = aNoise(vAXZ * 0.006 + 7.3);
            diffuseColor.rgb *= 1.0 + mid * 0.06 + big * 0.07;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.03, 0.98), smoothstep(0.55, 0.75, patchN));
            // t35 质感：骨料颗粒（近）+ 不规则油渍/沥青灌缝（深、发亮）+ 细裂缝网 + 晒褪发白的旧面（哑）；粗糙度随之起伏
            float nD = 1.0 - smoothstep(0.03, 0.2, fw);
            float mD = 1.0 - smoothstep(0.2, 1.4, fw);
            float agg = (aNoise(vAXZ * 7.0) - 0.5) * nD + (aNoise(vAXZ * 1.7 + 3.0) - 0.5) * mD * 0.6;
            float oil = smoothstep(0.7, 0.9, aNoise(vAXZ / 3.1 + 11.0) * 0.6 + aNoise(vAXZ / 0.9) * 0.4 * mD);
            float crk = (1.0 - smoothstep(0.0, 0.035 + fw * 0.5, abs(aNoise(vAXZ / 2.2 + 5.0) - 0.5))) * smoothstep(0.55, 0.75, aNoise(vAXZ / 9.0 + 2.0)) * mD;
            float worn = smoothstep(0.45, 0.8, aNoise(vAXZ / 14.0 + 21.0));
            diffuseColor.rgb *= 1.0 + agg * 0.12;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.12 + vec3(0.02, 0.018, 0.015), worn * 0.45);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, max(oil * 0.55, crk * 0.7));
            aRgh = -oil * 0.35 - crk * 0.2 + worn * 0.06 + agg * 0.08;
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + aRgh, 0.2, 1.0);`)
    }
    m.customProgramCacheKey = () => 'asphalt-v2'

    m.userData.mergeOK = true // 着色只依赖世界坐标
    return m
  })
}

/** 水面时钟（main 每帧写入）：所有水面共用 */
export const waterTime = { value: 0 }

/**
 * 水：多组方向波叠加扰动法线（随时间流动）→ 环境反射碎成粼粼波光；掠射角 fresnel 提亮天空色，正视偏深透
 */
export function water(deep = false) {
  return make(`water:${deep ? 'd' : 's'}`, () => {
    const m = new THREE.MeshStandardMaterial({
      color: deep ? '#0f3a52' : '#1f5f78',
      roughness: 0.08,
      metalness: 0.55,
      envMapIntensity: 1.6,
      transparent: true,
      opacity: deep ? 0.94 : 0.9,
    })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = waterTime
      sh.uniforms.uNightW = nightU
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPosW;\nvarying float vUpW;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec4 _wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
            vUpW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal).y;
          #else
            vec4 _wp = modelMatrix * vec4(transformed, 1.0);
            vUpW = normalize(mat3(modelMatrix) * objectNormal).y;
          #endif
          vWPosW = _wp.xyz;`)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uNightW;\nvarying vec3 vWPosW;\nvarying float vUpW;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          if (vUpW > 0.5) {
            vec2 p = vWPosW.xz;
            float t = uTime;
            vec2 g = vec2(0.0);
            // 每个波段按「每像素相位变化」淡出：远处/俯瞰时高频波不再混叠成同心圆摩尔纹
            float wfw = max(max(fwidth(p.x), fwidth(p.y)), 1e-4);
            #define WF(f) (1.0 - smoothstep(0.6, 2.2, (f) * wfw))
            vec2 d1 = vec2(0.8, 0.6); vec2 d2 = vec2(-0.45, 0.89); vec2 d3 = vec2(0.96, -0.28); vec2 d4 = vec2(0.17, 0.98); vec2 d5 = vec2(-0.7, -0.71);
            g += d1 * cos(dot(p, d1) * 0.32 + t * 1.1) * 0.30 * WF(0.32);
            g += d2 * cos(dot(p, d2) * 0.85 + t * 1.9) * 0.17 * WF(0.85);
            g += d3 * cos(dot(p, d3) * 2.1 + t * 3.0) * 0.09 * WF(2.1);
            g += d4 * cos(dot(p, d4) * 4.7 + t * 4.3) * 0.05 * WF(4.7);
            g += d5 * cos(dot(p, d5) * 9.3 + t * 6.1) * 0.025 * WF(9.3);
            // 很远处（单像素跨几十米）整体压平，镜面反射不再闪
            g *= 1.0 - smoothstep(6.0, 40.0, wfw);
            vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
            normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
          }`)
        .replace('#include <opaque_fragment>', `
          if (vUpW > 0.5) {
            float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
            outgoingLight = mix(outgoingLight, outgoingLight * 0.6 + vec3(0.30, 0.42, 0.52) * (1.0 - uNightW * 0.85), fres * 0.65);
            diffuseColor.a = mix(diffuseColor.a, 1.0, fres);
          }
          #include <opaque_fragment>`)
    }
    m.userData.mergeOK = true // 着色只依赖世界坐标
    return m
  })
}

/** 草地：按世界坐标的多尺度噪声做深浅/黄绿变化，不再是一整块纯色板 */
export function grass(tint = '#4f7348') {
  return make(`grass:${tint}`, () => {
    const m = new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.28,
    })
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGXZ;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vGXZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz;
          #else
            vGXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
          #endif`)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec2 vGXZ;
          float gHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          float gNoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            float n1 = gNoise(vGXZ * 0.035);
            float n2 = gNoise(vGXZ * 0.21);
            float gfw = max(fwidth(vGXZ.x), fwidth(vGXZ.y));
            float n3 = mix(0.5, gNoise(vGXZ * 1.7), 1.0 - smoothstep(0.15, 0.6, gfw));
            n2 = mix(0.5, n2, 1.0 - smoothstep(1.2, 4.5, gfw));
            vec3 dry = vec3(0.62, 0.62, 0.36);
            vec3 lush = vec3(0.78, 1.05, 0.72);
            diffuseColor.rgb *= mix(lush, dry, smoothstep(0.55, 0.85, n1)) * (0.82 + 0.3 * n2) * (0.9 + 0.2 * n3);
          }`)
    }
    m.userData.mergeOK = true // 着色只依赖世界坐标
    return m
  })
}

export function sand() {
  return make('sand', () =>
    new THREE.MeshStandardMaterial({
      color: '#c2b49a',
      roughness: 0.98,
      metalness: 0,
      envMapIntensity: 0.25,
    }),
  )
}

export function metal(tint = '#6a727c') {
  return make(`metal:${tint}`, () =>
    new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.32,
      metalness: 0.94,
      envMapIntensity: 1.25,
    }),
  )
}

const FACADE_PBR = {
  glass: { roughness: 0.32, metalness: 0.35, env: 0.7 },
  mirror: { roughness: 0.22, metalness: 0.42, env: 0.85 },
  stripe: { roughness: 0.55, metalness: 0.2, env: 0.55 },
  dark: { roughness: 0.62, metalness: 0.28, env: 0.5 },
  bronze: { roughness: 0.52, metalness: 0.35, env: 0.65 },
  warm: { roughness: 0.84, metalness: 0.04, env: 0.4 },
  stone: { roughness: 0.9, metalness: 0.03, env: 0.35 },
}

/**
 * 立面材质。band = 高度档，决定窗格 repeat，避免高楼贴图被纵向拉成一块塑料。
 * band: 'L' | 'M' | 'H' | 'X'
 */
export function facade(style = 'glass', tint = '#ffffff', band = 'M') {
  return make(`facade:${style}:${tint}:${band}`, () => {
    const map = facadeMap(style).clone()
    const rep =
      band === 'L' ? [3, 5] :
      band === 'H' ? [2.5, 22] :
      band === 'X' ? [2, 36] :
      [3, 12]
    map.repeat.set(rep[0], rep[1])
    map.needsUpdate = true
    const p = FACADE_PBR[style] || FACADE_PBR.stone
    return new THREE.MeshStandardMaterial({
      color: tint,
      map,
      roughness: p.roughness,
      metalness: p.metalness,
      envMapIntensity: p.env,
    })
  })
}

export function facadeBand(h) {
  if (h >= 320) return 'X'
  if (h >= 160) return 'H'
  if (h >= 60) return 'M'
  return 'L'
}

const extras = new Set()

/** 建筑运行时创建的材质也要吃到 IBL */
export function registerMaterial(mat) {
  if (mat) extras.add(mat)
}

export function allMaterials() {
  return [...cache.values(), ...extras]
}

export function setEnvMap(env) {
  // 只有「有/无环境图」变化才需要重编译；昼夜之间换一张环境图只换 uniform，不触发全场 shader 重建（以前切昼夜会卡一下）
  for (const m of allMaterials()) {
    if (m.envMap === env) continue
    if (!!m.envMap !== !!env) m.needsUpdate = true
    m.envMap = env
  }
}

/** 昼夜插值 0~1，所有自发光材质共用 */
export const nightU = { value: 0 }

/** 相机 up 在 view 空间的方向：立面做平面窗视差时要它算水平切向 */
export const upViewU = { value: new THREE.Vector3(0, 1, 0) }

const _m3 = new THREE.Matrix3()
export function updateUpView(camera) {
  _m3.setFromMatrix4(camera.matrixWorldInverse)
  upViewU.value.set(0, 1, 0).applyMatrix3(_m3).normalize()
}

const nightMats = []
const fades = []

/** 登记昼夜两端自发光强度；主线每帧把 emissiveIntensity 插值过去 */
export function registerNight(mat, day, night) {
  if (!mat) return
  nightMats.push({ mat, day, night })
  mat.emissiveIntensity = day
}

/** 登记昼夜两端透明度（地面光斑、灯雾等） */
export function registerFade(mat, day, night) {
  if (!mat) return
  fades.push({ mat, day, night })
  mat.opacity = day
}

export function applyNight(t) {
  for (const n of nightMats) {
    n.mat.emissiveIntensity = n.day + (n.night - n.day) * t
  }
  for (const f of fades) {
    f.mat.opacity = f.day + (f.night - f.day) * t
  }
}

/**
 * 径向渐变贴图（逐像素精确计算，DataTexture）。
 * 不用 canvas createRadialGradient：Safari/WebKit 的 CoreGraphics 会给渐变加逐通道抖动噪声，
 * 平常看不出，但加色混合的光斑把它放大成满地彩色碎点。
 * alphaAt(t) → 0..1，t 为到中心的归一化距离（0..1，外面为 0）；rgb 为 0..255 的白色/指定色
 */
export function radialTex(size, alphaAt, rgb = [255, 255, 255], srgb = true) {
  const data = new Uint8Array(size * size * 4)
  const h = size / 2
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const t = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h
    const a = t >= 1 ? 0 : Math.max(0, Math.min(1, alphaAt(t)))
    const o = (y * size + x) * 4
    data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]
    data[o + 3] = Math.round(a * 255)
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

/** 按色标线性插值（等价于 canvas addColorStop 的 alpha 部分） */
export function stops(list) {
  return (t) => {
    for (let i = 1; i < list.length; i++) {
      if (t <= list[i][0]) { const [t0, a0] = list[i - 1]; const [t1, a1] = list[i]; return a0 + (a1 - a0) * ((t - t0) / Math.max(1e-6, t1 - t0)) }
    }
    return list[list.length - 1][1]
  }
}
