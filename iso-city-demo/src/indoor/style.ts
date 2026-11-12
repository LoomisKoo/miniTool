/**
 * 室内统一风格（参照"虚拟办公室"参考图重做的一版）：
 *
 * 深蓝灰墙 + 亮暖橡木地板 + 深色细窗框 + 高饱和彩色分区。
 *
 * 上一版的问题：色板只有 5 个分区色、家具统一被 calm() 抽掉 18% 饱和，
 * 结果整间屋子是"灰蓝墙 + 灰木地板 + 灰家具"的一片灰。
 * 这一版把颜色分成三层——
 *   1. 结构性颜色（墙 / 地 / 踢脚 / 窗框）：低饱和，负责退后；
 *   2. 分区颜色（地毯地贴 + 发光描边）：高饱和，负责把空间划开；
 *   3. 家具颜色（椅面 / 抱枕 / 屏幕 / 植物）：中等饱和 + 一点自发光。
 * 各室内组件不要自己写死色值，都从这里取。
 */
export const INDOOR_STYLE = {
  /** 墙：冷蓝灰，退后但不发黑 */
  wall: '#3b4551',
  wallAlt: '#44505d',
  /** 吊顶：再暗一点，剖切俯视时不会变成一块白板 */
  ceiling: '#2a323b',
  /** 踢脚线 / 门套：勾边用 */
  skirting: '#1f272e',
  /** 窗框 / 玻璃分格：接近黑，玻璃才显亮 */
  frame: '#182026',
  /** 玻璃本体：偏青的冷白，靠反射出层次 */
  glass: '#c8e2ee',
  glassOpacity: 0.1,
  /** 地板：亮暖橡木（参考图的地板是整张图最亮的一片） */
  floor: '#dca569',
  floorDark: '#a9763f',
  /** 金属（桌腿、灯杆、椅腿） */
  metal: '#262c31',
  metalSoft: '#3a434a',
  /** 黄铜 / 铜件 */
  brass: '#c9a86e',
  /** 织物（沙发、床品） */
  fabric: '#4d7f8c',
  /** 屏幕等自发光 */
  screen: '#a8e8ff',
  /** 霓虹描边（地毯边、地贴线、墙上的灯带） */
  neon: '#5ee0c4',
  /**
   * 彩色分区：比上一版多一倍，且整体提亮。
   * 顺序按"相邻色差别大"排，靠哈希取色时同一户里也不容易撞色。
   */
  zones: [
    '#7a5cd8', // 紫罗兰
    '#2fa172', // 青绿
    '#c74b8e', // 品红
    '#3b7ec9', // 亮蓝
    '#d98a35', // 橙
    '#c9a838', // 芥黄
    '#c9553f', // 珊瑚
    '#3aa6c4', // 湖蓝
    '#8fbb44', // 柠檬绿
    '#5a63cf', // 靛蓝
  ],
  /** 抱枕 / 凳面这类小色块：挑上面分区色里最亮的那几个 */
  accents: ['#e8b64a', '#d97a63', '#7fb0dd', '#5fb69b', '#c98ad8', '#e9d9a8'],
  /** 木作（桌面、柜体、台面） */
  woods: ['#8a6440', '#7a5a3c', '#9c7350', '#6f5136'],
  /** 书脊 / 杂物：书架和桌面上的小东西 */
  spines: ['#b5544b', '#4d7f8c', '#c9a44c', '#6f6bb0', '#5f7d4f', '#c98050', '#8c5d7a'],
  /** 植物：三档绿，靠深浅做出体积 */
  leaves: ['#4f8a4a', '#6aa55a', '#3d6f42'],
  /** 屏幕光（显示器、白板、交互终端） */
  glow: '#8ad8f2',
} as const

/** 按亮度收一点饱和：家具色在深色墙前容易跳，压一档更像模型。
    （上一版默认 0.18，把彩色压成了灰；现在只压一点点。） */
export function calm(hex: string, amount = 0.07) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const mix = (v: number) => Math.round(v + (128 - v) * amount)
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`
}

/** 深色版：给台面、柜体这类需要比墙面更实的部件。 */
export function deepen(hex: string, amount = 0.24) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const mix = (v: number) => Math.round(v * (1 - amount))
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`
}

/** 提亮：给地贴边缘、灯罩这类要"亮起来"的部件。 */
export function lighten(hex: string, amount = 0.3) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const mix = (v: number) => Math.round(v + (255 - v) * amount)
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`
}

/** 字符串 → 稳定的非负整数，各"按 id 取色"的地方共用。 */
export function hashOf(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 从一组色里按 seed 稳定取一个。 */
export function pick<T>(list: readonly T[], seed: string): T {
  return list[hashOf(seed) % list.length]
}

/**
 * 老色板 → 新风格的迁移表。
 *
 * 库里 400 多户的墙/地颜色都是按旧的米黄样板写死的，直接改种子文件对存量数据无效。
 * 这里在渲染端做一次映射：命中的老色替换成新风格，用户自己挑的其它颜色原样保留，
 * 所以不需要清库，也不会盖掉自定义配色。
 *
 * 映射不再是一对一：同一支老色会分到几种冷色上，整栋楼才不会是同一种灰蓝。
 */
const WALL_TONES: Record<string, string[]> = {
  '#e9e0d2': ['#3b4551', '#3f4a57', '#37424c'],
  '#e4ded2': ['#414d5a', '#3b4551', '#374a4a'],
  '#dfe4dd': ['#37424c', '#3b4551', '#3f4a57'],
  '#e6dccf': ['#464c54', '#414d5a', '#3a4450'],
  '#dcd8cf': ['#333c46', '#2f3a44', '#3b4551'],
  '#f1ede5': ['#3b4551', '#44505d', '#37424c'],
  '#e7e2d8': ['#414d5a', '#3b4551', '#44405a'],
  '#e8ddcd': ['#454e58', '#3b4551', '#37424c'],
  '#d9d5cc': ['#37424c', '#333c46', '#3f4a57'],
  '#e4ddd0': ['#3b4551', '#414d5a', '#374a4a'],
  '#ded8cd': ['#414d5a', '#37424c', '#3a4450'],
}

const FLOOR_TONES: Record<string, string[]> = {
  '#c3ae95': ['#dca569', '#d79c5e', '#e0ad74'],
  '#b7b2a6': ['#c9a074', '#cfa87a'],
  '#bfa98d': ['#d19a5c', '#d78f52'],
  '#a9a08d': ['#b9926c', '#b08356'],
  '#cbbd9e': ['#dfb27c', '#d9a669'],
  '#d7d0c4': ['#d9c8a8', '#cfbd9d'],
  '#8f8a80': ['#8a7a5e', '#94815f'],
  '#b99a78': ['#dca569', '#d19a63'],
  '#c9c1b2': ['#cbb79c', '#bfa27e'],
  '#b3a58f': ['#bd9a6e', '#b08a5c'],
}

export function wallTone(hex: string, seed = '') {
  const hit = WALL_TONES[hex.toLowerCase()]
  if (hit) return pick(hit, seed || hex)
  // 表外但很浅的墙（店铺样板、老数据里的白墙）：同样收进深色系。
  // 深色木地板配一面白墙在剖面里会非常刺眼，而且浅墙会把窗外的夜景压没。
  if (luminance(hex) > 0.66) return pick(WALL_DEEP, seed || hex)
  return hex
}

export function floorTone(hex: string, seed = '') {
  const hit = FLOOR_TONES[hex.toLowerCase()]
  if (hit) return pick(hit, seed || hex)
  // 表外但很亮的灰地面（店铺样板常见）：换成暖木，室内才有一块"被光打到"的地方。
  if (luminance(hex) > 0.52) return pick(FLOOR_WARM, seed || hex)
  return hex
}

const WALL_DEEP = ['#3b4551', '#414d5a', '#37424c', '#3a4a4a', '#44405a', '#44505d']
const FLOOR_WARM = ['#dca569', '#d79c5e', '#c9a074', '#d19a5c', '#e0ad74']

/** 粗略的相对亮度（0~1），只用来判断"这是不是一面浅色墙/浅色地"。 */
function luminance(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  if (Number.isNaN(n)) return 0
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 分区地贴色：按家具 id 稳定取一个，同一户里不同区域颜色不打架。 */
export function zoneColor(seed: string) {
  return pick(INDOOR_STYLE.zones, seed)
}

/** 小件点缀色（抱枕、凳面、桌垫）。 */
export function accentColor(seed: string) {
  return pick(INDOOR_STYLE.accents, seed)
}

/** 旧样板的地毯色（一片暖灰），换成彩色分区；用户自己挑的颜色原样保留。 */
const OLD_RUG = new Set([
  '#b7a58e',
  '#a9a397',
  '#cfc7bb',
  '#6f746c',
  '#b3ada1',
  '#8a7a63',
  '#b0a99c',
  '#c8c4b4',
  '#9c9082',
])

export function rugTone(hex: string, seed: string) {
  return OLD_RUG.has(hex.toLowerCase()) ? zoneColor(seed) : hex
}

/**
 * 旧家具色 → 新家具色。
 *
 * 库里已有的样板家具是按旧的"低饱和木色/灰绿"写的。渲染端做一次映射，
 * 老房间也能立刻变成参考图那种配色，不用清库重建。
 * 用户后来自己调过的颜色不在表里，会原样保留。
 */
const LEGACY_FURNITURE: Record<string, string> = {
  '#6f7f74': '#4d7f8c',
  '#8c9a92': '#5f8fa0',
  '#8e7d65': '#c9a838',
  '#9a7d5d': '#8a6440',
  '#7d6a52': '#8a6440',
  '#6d5b47': '#7a5a3c',
  '#7c6a55': '#8a6440',
  '#8a6a4b': '#8a6440',
  '#7a6650': '#7a5a3c',
  '#587a58': '#4f8a4a',
  '#557456': '#4f8a4a',
  '#597a57': '#4f8a4a',
  '#6b8b62': '#6aa55a',
  '#4f6f52': '#3d6f42',
  '#c9a15c': '#c9a86e',
  '#3f4543': '#3a434a',
  '#b4544f': '#c9553f',
  '#8a7a63': '#8a6440',
}

export function furnitureTone(hex: string) {
  return LEGACY_FURNITURE[hex.toLowerCase()] ?? hex
}

