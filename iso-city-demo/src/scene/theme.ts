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
  sky: '#070f1e',
  fog: '#0d1c2e',
  fogNear: 70,
  fogFar: 560,
  hemiSky: '#4d7ba8',
  hemiGround: '#0a1018',
  hemiIntensity: 1.5,
  ambient: 0.52,
  sun: '#c2dcff',
  sunIntensity: 1.5,
  sunPos: [-72, 118, -58],
  exposure: 1.4,
  ground: '#16202e',
  road: '#121b27',
  paving: '#243040',
  pavingLine: '#36485f',
  roadLine: '#7f8fa4',
  curb: '#2a3a4d',
  glowWarm: '#ffcf9a',
  glowCyan: '#7fe4ff',
  ar: '#74e4ff',
  windowLit: ['#ffd6a2', '#ffc88a', '#a9ecff', '#d8f3ff', '#ffe6bf'],
  windowDark: '#101d2c',
  trim: '#26374a',
  glass: '#1b3145',
  tree: '#24453f',
  treeDark: '#1a332f',
  car: ['#8fa3b8', '#c8d2dc', '#5d7385', '#a98f6d', '#6f8b8f'],
  accent: '#74e4ff',
}

export const DUSK: Palette = {
  key: 'dusk',
  label: '黄昏',
  sky: '#c3d2d6',
  fog: '#c2cfd2',
  fogNear: 70,
  fogFar: 460,
  hemiSky: '#eaf3f6',
  hemiGround: '#a9a391',
  hemiIntensity: 0.78,
  ambient: 0.22,
  sun: '#ffe2bd',
  sunIntensity: 2.1,
  sunPos: [78, 96, 44],
  exposure: 1.02,
  ground: '#b9bcb5',
  road: '#3c4348',
  paving: '#b9bcb2',
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

/** 夜间把建筑基色压成冷调，避免白天配色直接变脏。 */
export function bodyColor(hex: string, palette: Palette) {
  const base = new THREE.Color(hex)
  if (palette.key !== 'night') return base
  const lum = base.r * 0.2126 + base.g * 0.7152 + base.b * 0.0722
  const target = new THREE.Color('#3d5470').multiplyScalar(0.7 + lum * 0.8)
  return base.lerp(target, 0.62)
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
