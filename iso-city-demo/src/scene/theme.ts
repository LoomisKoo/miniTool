import * as THREE from 'three'

// 微光城区：默认夜间（AR 蓝）与黄昏两套配色。
// 所有场景组件从这里取色，避免颜色散落各处。

export type Palette = {
  key: 'night' | 'dusk'
  label: string
  sky: string
  fog: string
  fogNear: number
  fogFar: number
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  ambient: number
  sun: string
  sunIntensity: number
  sunPos: [number, number, number]
  exposure: number
  ground: string
  road: string
  paving: string
  pavingLine: string
  roadLine: string
  curb: string
  glowWarm: string
  glowCyan: string
  ar: string
  windowLit: string[]
  windowDark: string
  trim: string
  glass: string
  tree: string
  treeDark: string
  car: string[]
  accent: string
}

export const NIGHT: Palette = {
  key: 'night',
  label: '夜间',
  // 城市夜空不是黑蓝色：低云被街灯和橱窗映成暗橙，天比楼亮，楼是剪影。
  // 但只保留一点：之前这组颜色（#2a1f1c 纯暖棕 + 雾 #33261f）叠在天空着色器
  // 的橙色地平线上，整圈天边都是昏黄，看起来像傍晚。现在底色压冷压暗，
  // 只给地平线留一丝暖，夜晚才读成夜晚。
  sky: '#0d131a',
  fog: '#131a23',
  fogNear: 60,
  fogFar: 520,
  // 参考 slop-newyork 的"城市峡谷"配光：冷天光从上、暖石材/沥青反弹从下。
  // 之前地面色接近纯黑，等于把楼体下半截的地面反弹光全掐掉了。
  hemiSky: '#3f465c',
  // 地面反弹光：比纯橙灰一点，别把大片铺装染成粉。
  // 也不能太暖：半球光的下半部会把所有竖面的底部刷成橙黄，
  // 这是另一条"夜里看起来像黄昏"的通路。
  hemiGround: '#4a4741',
  // 半球光给"天光 + 地面反弹"的骨架，但不能当主光：
  // 平铺的环境光叠太多，整张画面就会糊成一片灰色，楼体也没有受光面/背光面。
  // 街区里没有路灯直射的地方也不是全黑：橱窗、招牌、对面楼的亮窗、
  // 被照亮的低云都在补光，所以底子要抬起来
  hemiIntensity: 1.9,
  ambient: 0.5,
  sun: '#b9c6d6',
  // 月光：夜里不投影，但需要一点方向光把体块的三个面分开，
  // 否则楼群会变成均一的黑块，看不出高差和进退。
  // 月光要有分量：夜里的楼是靠这一个方向光读出体块的，
  // 它弱了就只能靠环境光撑，画面一定发灰。
  sunIntensity: 0.95,
  sunPos: [-72, 118, -58],
  // 只作为后处理未挂载时的兜底：EffectComposer 会把 renderer.toneMapping
  // 设成 NoToneMapping，这个值在正常运行时读不到。真正的曝光在 GradeEffect.uExposure。
  exposure: 1.85,
  ground: '#2c3033',
  // 沥青的反照率约 0.10（线性），#1e1e1f 只有 0.013，夜里没有灯的地方就是纯黑
  road: '#3a3a3d',
  paving: '#4c4b48',
  pavingLine: '#5c5b57',
  roadLine: '#a39d8e',
  curb: '#2f3132',
  glowWarm: '#ffcf9a',
  glowCyan: '#7fe4ff',
  ar: '#74e4ff',
  windowLit: ['#ffd29a', '#ffc27e', '#ffe2b8', '#f4ead8', '#ffd9a6', '#cfe6ff'],
  windowDark: '#121417',
  // 夜间家具/杆件的公共色。以前是 #2d2d2e（线性约 0.026），在城市夜景里
  // 就是一片纯黑：长椅、花池、灯杆、雨棚骨架全变成剪影，读不出形体。
  // 抬到中性深灰后仍然比楼体暗，但能看清边缘和转折。
  trim: '#3f444a',
  glass: '#1c2226',
  tree: '#22302a',
  treeDark: '#18221e',
  car: ['#8a8f96', '#c9cbcd', '#4f565e', '#9c8a72', '#2a2d31', '#7a2f2a'],
  accent: '#74e4ff',
}

export const DUSK: Palette = {
  key: 'dusk',
  label: '黄昏',
  sky: '#c3d2d6',
  // 雾不要早：70m 就开始起雾会把整条街的楼洗成白纸
  fog: '#bccbd2',
  fogNear: 110,
  fogFar: 700,
  hemiSky: '#eaf3f6',
  hemiGround: '#a9a391',
  hemiIntensity: 0.62,
  ambient: 0.18,
  sun: '#ffe2bd',
  // 2.1 + 落日 HDR 叠加后墙面对比全被压到高光区，砖缝、窗台全白
  sunIntensity: 1.5,
  sunPos: [78, 96, 44],
  exposure: 0.78,
  ground: '#aeb2af',
  road: '#3c4348',
  paving: '#b4b6b0',
  pavingLine: '#a2a69b',
  roadLine: '#e8e3d2',
  curb: '#989c93',
  glowWarm: '#ffd6a2',
  glowCyan: '#8fe6f2',
  ar: '#3f9aa8',
  windowLit: ['#ffd9a8', '#ffe7c4', '#bfeef7'],
  windowDark: '#4a6270',
  trim: '#8d9a9f',
  glass: '#6d8794',
  tree: '#6f8a66',
  treeDark: '#5c7757',
  car: ['#7b8a8a', '#b9a88f', '#6b7d84', '#a59b86', '#8d7f6c'],
  accent: '#3f9aa8',
}

export const palettes = { night: NIGHT, dusk: DUSK }

/**
 * 夜间街具的"反弹光"补偿。
 *
 * 地面有 emissive 兜底（见 Ground 的 pavingGlow），所以路面在夜里是亮的；
 * 街具（长椅、花池、防撞柱、灯杆、站牌）没有这一层，只吃 ambient + 半球光，
 * 而夜间的 ambient 本来就只有 0.25：竖着的面板几乎收不到半球光，最后算出来
 * 只有 0.02 左右的线性亮度——在屏幕上看就是纯黑的剪影，形体完全读不出来。
 *
 * 这里给它们补一点点自己的颜色当自发光，相当于整座城市的灯打在物件上的
 * 反弹光。改动只影响夜里，白天返回空对象。
 */
export function nightFill(night: boolean, color = '#242b33', intensity = 1) {
  return night ? { emissive: color, emissiveIntensity: intensity } : {}
}

/** 夜间把建筑基色压成冷调，避免白天配色直接变脏。 */
export function bodyColor(hex: string, palette: Palette) {
  const base = new THREE.Color(hex)
  const lum = base.r * 0.2126 + base.g * 0.7152 + base.b * 0.0722
  // 真实城市的楼是混凝土、石材、玻璃：颜色几乎是中性灰，偏一点暖。
  // 原来的蓝灰粉彩一眼就是"风格化"，这里统一把饱和度压下去。
  const neutral = new THREE.Color(lum * 1.02, lum * 0.99, lum * 0.95)
  // 只中和掉最艳的那部分色偏，保留石材/砖/玻璃各自的暖度和明度差
  base.lerp(neutral, 0.45)
  if (palette.key !== 'night') return base
  // 夜间只压一点点：楼体是靠材质和窗框读出来的，
  // 压成剪影就只剩一墙发光方块，反而不像楼
  return base.multiplyScalar(0.9)
}

/** 稳定伪随机，避免每次渲染窗户点亮状态变化。 */
export function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
