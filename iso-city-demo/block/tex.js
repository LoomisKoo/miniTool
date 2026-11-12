/**
 * 世界坐标 triplanar 贴图。
 *
 * 场景里的建筑全是 BoxGeometry 拼的：每块盒子不同尺寸，UV 是 0~1 贴面，
 * 直接 map 会随物体大小拉伸。所以这里不走 UV —— 在 shader 里用世界坐标
 * 按"面法线的主轴"取投影平面，贴图密度就是恒定的（比如 2m 一个循环）。
 * 建筑全是轴对齐盒子，取单轴就够，不需要三轴混合的柔化。
 *
 * 贴图本身由 tools/blender/texgen.py 用 Blender 程序化烘焙（周期可平铺）：
 *   albedo 是均值≈0.93 的细节乘数，色调仍由材质自身的 color 决定；
 *   rough  是粗糙度乘数；
 *   凹凸用 albedo 的亮度做高度场，靠屏幕空间导数扰动法线。
 */
import * as THREE from 'three'

const SRC = {
  concrete: {
    albedo: new URL('./tex/concrete_albedo.png', import.meta.url).href,
    normal: new URL('./tex/concrete_normal.png', import.meta.url).href,
    rough: new URL('./tex/concrete_rough.png', import.meta.url).href,
  },
  brick: {
    albedo: new URL('./tex/brick_albedo.png', import.meta.url).href,
    normal: new URL('./tex/brick_normal.png', import.meta.url).href,
    rough: new URL('./tex/brick_rough.png', import.meta.url).href,
  },
  plaster: {
    albedo: new URL('./tex/plaster_albedo.png', import.meta.url).href,
    normal: new URL('./tex/plaster_normal.png', import.meta.url).href,
    rough: new URL('./tex/plaster_rough.png', import.meta.url).href,
  },
  metal: {
    albedo: new URL('./tex/metal_albedo.png', import.meta.url).href,
    normal: new URL('./tex/metal_normal.png', import.meta.url).href,
    rough: new URL('./tex/metal_rough.png', import.meta.url).href,
  },
}

/**
 * 每种材质的贴图密度（世界单位循环数 / 米）、各通道强度，以及在 sRGB→线性
 * 解码之后的反照率均值。均值用来把细节乘数归一到 1.0 附近，否则贴图本身
 * 的明暗会把原有配色整体压暗。
 *
 * scale 是这个镜头最关键的一个数：默认机位下整栋楼只有 100~300 像素高，
 * 2m 一个循环会被压到 7px 左右、被 mipmap 直接抹平（实测画面只变化 0.6/255，
 * 等于没做）。所以这里全部换成 4~10m 的大尺度：拼板缝、雨痕、大块斑驳。
 * 砖的砌缝在这个距离本来就看不见，也就没必要按真实砖尺寸铺。
 */
const CFG = {
  concrete: { scale: 0.13, bump: 1.2, alb: 1.0, rough: 0.7, mean: 0.664 },
  brick: { scale: 0.3, bump: 1.4, alb: 1.0, rough: 0.85, mean: 0.716 },
  plaster: { scale: 0.09, bump: 1.0, alb: 1.0, rough: 0.6, mean: 0.692 },
  metal: { scale: 0.45, bump: 0.6, alb: 0.9, rough: 0.5, mean: 0.837 },
}

function blank(v) {
  const t = new THREE.DataTexture(new Uint8Array([v, v, v, 255]), 1, 1)
  t.needsUpdate = true
  return t
}

/** 正在等贴图的 uniform 集合 */
const waiting = new Map()
let started = false

export function preloadTextures(aniso = 8) {
  if (started) return
  started = true
  const loader = new THREE.TextureLoader()
  for (const [kind, urls] of Object.entries(SRC)) {
    for (const pass of ['albedo', 'normal', 'rough']) {
      loader.load(
        urls[pass],
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping
          tex.wrapT = THREE.RepeatWrapping
          tex.anisotropy = aniso
          tex.colorSpace = pass === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace
          tex.generateMipmaps = true
          tex.minFilter = THREE.LinearMipmapLinearFilter
          for (const u of waiting.get(`${kind}|${pass}`) ?? []) {
            u[pass === 'albedo' ? 'uAlb' : pass === 'rough' ? 'uRgh' : 'uNrm'].value = tex
          }
          waiting.delete(`${kind}|${pass}`)
        },
        undefined,
        () => {
          /* 加载失败就保持 1x1 白图，视觉上等同于没有贴图 */
        },
      )
    }
  }
}

function classify(mat, maxDim) {
  if (mat.map || mat.transparent || mat.opacity < 1) return null
  if (mat.flatShading) return null
  // 小构件（护柱、花箱、轮子、栏杆）上贴微结构只会变成噪点
  if (maxDim < 1.5) return null
  if (mat.emissive && mat.emissive.getHex() !== 0) return null
  const hsl = { h: 0, s: 0, l: 0 }
  mat.color.getHSL(hsl, THREE.SRGBColorSpace)
  if (mat.metalness > 0.3) return 'metal'
  if (hsl.l > 0.72) return 'plaster'
  if (hsl.h < 0.06 && hsl.s > 0.16) return 'brick'
  return 'concrete'
}

const FRAG_DECL = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
uniform sampler2D uAlb;
uniform sampler2D uNrm;
uniform sampler2D uRgh;
uniform float uTexScale;
uniform float uBump;
uniform float uRoughAmt;
uniform float uAlbAmt;
uniform float uAlbMean;
vec3 gAlb = vec3(1.0);
vec3 gNrm = vec3(0.5, 0.5, 1.0);
float gRgh = 1.0;
int gPlane = 0;
`

const FRAG_UV = /* glsl */ `
{
  vec3 tn = normalize(vWNrm);
  vec2 tuv;
  // 选投影平面，同时记下用的是哪一个，法线要按它搭切线基
  if (abs(tn.y) >= max(abs(tn.x), abs(tn.z))) { tuv = vWPos.xz; gPlane = 0; }
  else if (abs(tn.x) >= abs(tn.z)) { tuv = vWPos.zy; gPlane = 1; }
  else { tuv = vWPos.xy; gPlane = 2; }
  tuv *= uTexScale;
  gAlb = texture2D(uAlb, tuv).rgb;
  gRgh = texture2D(uRgh, tuv).r;
  gNrm = texture2D(uNrm, tuv).xyz;
}
`

export function applyTriplanar(mat, kind) {
  const cfg = CFG[kind]
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAlb = shader.uniforms.uAlb ?? { value: blank(255) }
    shader.uniforms.uNrm = shader.uniforms.uNrm ?? { value: blank(128) }
    shader.uniforms.uRgh = shader.uniforms.uRgh ?? { value: blank(230) }
    shader.uniforms.uTexScale = { value: cfg.scale }
    shader.uniforms.uBump = { value: cfg.bump }
    shader.uniforms.uRoughAmt = { value: cfg.rough }
    shader.uniforms.uAlbAmt = { value: cfg.alb }
    shader.uniforms.uAlbMean = { value: cfg.mean }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
            wn = mat3(instanceMatrix) * wn;
          #endif
          vWPos = (modelMatrix * wp).xyz;
          vWNrm = normalize(mat3(modelMatrix) * wn);
        }`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FRAG_UV)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        // 先按均值归一，细节乘数才围绕 1.0 波动，不会整体压暗配色
        diffuseColor.rgb *= mix(vec3(1.0), gAlb / uAlbMean, uAlbAmt);
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        float roughnessFactor = roughness;
        roughnessFactor = clamp(roughnessFactor * mix(1.0, gRgh / 0.9, uRoughAmt), 0.03, 1.0);
        `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        {
          vec3 nrm = normalize(normal);
          // 每个投影平面配一组世界坐标切线基；场景是轴对齐盒子，
          // 直接把世界轴转到视空间就是正确的 TBN。
          vec3 tW, bW;
          if (gPlane == 0) { tW = vec3(1.0, 0.0, 0.0); bW = vec3(0.0, 0.0, 1.0); }
          else if (gPlane == 1) { tW = vec3(0.0, 0.0, 1.0); bW = vec3(0.0, 1.0, 0.0); }
          else { tW = vec3(1.0, 0.0, 0.0); bW = vec3(0.0, 1.0, 0.0); }
          vec3 tV = normalize((viewMatrix * vec4(tW, 0.0)).xyz);
          vec3 bV = normalize((viewMatrix * vec4(bW, 0.0)).xyz);
          vec3 nm = gNrm * 2.0 - 1.0;
          normal = normalize(nrm + (tV * nm.x + bV * nm.y) * uBump);
        }`,
      )

    mat.userData.tri = shader.uniforms
    for (const pass of ['albedo', 'normal', 'rough']) {
      const key = `${kind}|${pass}`
      const u = shader.uniforms[pass === 'albedo' ? 'uAlb' : pass === 'rough' ? 'uRgh' : 'uNrm']
      if (!u.value.isTexture || u.value.image?.width === 1) {
        const list = waiting.get(key) ?? []
        list.push(shader.uniforms)
        waiting.set(key, list)
      }
    }
  }
  mat.needsUpdate = true
}

/** 扫一遍场景，给大块不透明标准材质挂上 triplanar 微结构 */
/** 扫一遍场景，给大块不透明标准材质挂上 triplanar 微结构。
 *
 * 默认关闭。参考图那种"干净棚拍"的质感靠的是柔光和倒角，不是表面纹理 ——
 * 微结构在建筑只有一两百像素高的时候既看不见、还会把干净的面弄脏。
 * 因此改成显式 opt-in：`?fx` 打开，`?fx=2` 加深。
 */
export function dressSurfaces(root, { minDim = 1.5 } = {}) {
  const q = new URLSearchParams(location.search)
  if (!q.has('fx')) return 0
  preloadTextures()
  const seen = new Set()
  const box = new THREE.Box3()
  const size = new THREE.Vector3()
  root.traverse((o) => {
    if (!o.isMesh) return
    o.geometry.computeBoundingBox?.()
    const bb = o.geometry.boundingBox
    if (!bb) return
    bb.getSize(size)
    const sc = o.getWorldScale(new THREE.Vector3())
    const maxDim = Math.max(size.x * sc.x, size.y * sc.y, size.z * sc.z)
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    for (const mat of mats) {
      if (!mat || seen.has(mat)) continue
      seen.add(mat)
      if (!mat.isMeshStandardMaterial) continue
      const kind = classify(mat, maxDim)
      if (!kind) continue
      applyTriplanar(mat, kind)
    }
  })
  void box
  return seen.size
}
