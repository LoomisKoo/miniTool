import * as THREE from 'three'
import { ISLAND_CX, ISLAND_CZ, ISLAND_R, SEABED_Y, WATER_Y } from '../config/scene'
import { clamp, fbm, mix, ridged, smoothstep } from './noise'

/**
 * 「朝崖侧」程度：1 = 崖侧（外海/块角方向），0 = 滩侧（朝块体中心）。
 * 岛心处方向向量不连续，用半径淡出到 0.5 避免出现放射状伪影。
 */
function cliffSide(x: number, z: number) {
  const dx = x - ISLAND_CX
  const dz = z - ISLAND_CZ
  const r = Math.hypot(dx, dz)
  const co = (dx + dz) / (Math.SQRT2 * Math.max(r, 1e-4))
  const fade = smoothstep(0.0, 0.14, r)
  return mix(0.5, smoothstep(-0.85, 0.85, co), fade)
}

/**
 * 岛屿相对海床的起伏量（未含 SEABED_Y 偏移）。
 *
 * 采用「两级台地」而不是穹顶：
 *   滩侧 → 低矮的平坦沙台（几乎贴着水位，形成大片浅滩）
 *   崖侧 → 高台地 + 陡崖带（露岩，带冲沟）
 * 中间由平滑过渡带连接，天然形成一道崖坎。
 */
export function islandRelief(x: number, z: number): number {
  const dx = x - ISLAND_CX
  const dz = z - ISLAND_CZ
  const r = Math.hypot(dx, dz)
  const rn = r / ISLAND_R
  if (rn >= 1.26) return 0.02

  const co = (dx + dz) / (Math.SQRT2 * Math.max(r, 1e-4))
  const sharp = cliffSide(x, z) // 1 = 崖侧，0 = 滩侧

  const top = mix(0.7, 0.92, sharp) // 台地高度：滩侧矮、崖侧高
  const flatR = mix(0.46, 0.72, sharp) // 平台外缘
  const toeR = mix(1.2, 0.98, sharp) // 坡脚半径 → 滩侧冲得远 = 缓滩

  const terrace = 1 - smoothstep(flatR, toeR, rn)

  // 冲沟只在崖侧陡坎带内生成
  const band = 4 * terrace * (1 - terrace)
  const crag = ridged(x * 6.0, z * 6.0, 3) * 0.24 * band * (0.25 + 0.75 * sharp)

  // 台地上的缓和起伏
  const n = fbm(x * 3.0 + 4.1, z * 3.0 - 2.3, 4) * 0.055

  let h = terrace * top + n * terrace + crag

  // 弧形海湾（滩侧）：只在台地边缘切出浅湾，不动台地内部
  const bayAngle = Math.exp(-Math.pow((co + 0.55) * 2.1, 2))
  const bayRadial = Math.exp(-Math.pow(Math.abs(rn - 0.72) / 0.42, 2.2))
  h -= bayAngle * bayRadial * 0.5

  // 边缘收口
  h *= 1 - smoothstep(0.86, 1.24, rn)

  return Math.max(0.02, h)
}

/** 岛屿绝对高度（块体坐标 y） */
export function islandHeight(x: number, z: number): number {
  return SEABED_Y + islandRelief(x, z)
}

/** 有限差分求地形坡度（0 平 → 1 陡） */
export function islandSlope(x: number, z: number, eps = 0.02): number {
  const hx = islandHeight(x + eps, z) - islandHeight(x - eps, z)
  const hz = islandHeight(x, z + eps) - islandHeight(x, z - eps)
  return Math.min(1, (Math.hypot(hx, hz) / (2 * eps)) * 0.8)
}

const C_DEEP_SAND = new THREE.Color('#6b5b41')
const C_MID_SAND = new THREE.Color('#b8a377')
const C_SHORE_SAND = new THREE.Color('#f0e2b4')
const C_ROCK = new THREE.Color('#5f5749')
const C_ROCK_LIGHT = new THREE.Color('#9a8e7e')
const C_GRASS = new THREE.Color('#5f8c33')
const C_GRASS_DARK = new THREE.Color('#3a5220')

const _c = new THREE.Color()

/**
 * 分层着色（按「相对水位的高度」为主，坡度为辅）：
 *   水下暗沙 → 潮间带亮沙环 → 岩壁 / 草坡
 * 亮沙带的垂直厚度固定，因此坡越缓沙带越宽 —— 滩侧自然出现大片浅滩。
 */
export function islandColor(x: number, z: number, y: number, slope: number, out: THREE.Color) {
  const beachSide = 1 - cliffSide(x, z)
  const above = y - WATER_Y

  // 1) 沙：水下暗 → 近岸亮
  out.copy(C_DEEP_SAND).lerp(C_MID_SAND, smoothstep(-0.4, -0.12, above))
  out.lerp(C_SHORE_SAND, smoothstep(-0.12, 0.06, above))

  // 2) 潮间带亮沙环（滩侧更宽更亮）
  const bandLo = -0.16 - 0.12 * beachSide
  const bandHi = 0.12 + 0.14 * beachSide
  const band = smoothstep(bandLo, bandLo + 0.1, above) * (1 - smoothstep(bandHi - 0.08, bandHi + 0.06, above))
  const steepShore = 1 - 0.45 * smoothstep(0.95, 1.7, slope)
  out.lerp(_c.copy(C_SHORE_SAND), clamp(band, 0, 1) * steepShore * (0.55 + 0.45 * beachSide))

  // 3) 岩壁：明显高于水位且陡
  const cliff = smoothstep(0.5, 0.95, slope) * smoothstep(0.06, 0.2, above)
  _c.copy(C_ROCK).lerp(C_ROCK_LIGHT, fbm(x * 9.0, z * 9.0, 3) * 0.5 + 0.5)
  out.lerp(_c, cliff * 0.95)

  // 4) 草坡：高于水位且平缓
  const veg = smoothstep(0.16, 0.32, above) * smoothstep(0.78, 0.34, slope)
  _c.copy(C_GRASS).lerp(C_GRASS_DARK, fbm(x * 12.0 + 5.0, z * 12.0, 2) * 0.5 + 0.5)
  out.lerp(_c, clamp(veg, 0, 1) * 0.92)

  // 细微明暗打散
  out.offsetHSL(0, 0, fbm(x * 26.0, z * 26.0, 3) * 0.045)
}
