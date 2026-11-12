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
    new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.9,
      metalness: 0.04,
      envMapIntensity: 0.5,
    }),
  )
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
      color: '#6c7076',
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 0.3,
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
            diffuseColor.rgb *= 1.0 + mid * 0.035 + big * 0.05;
          }`)
    }
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
