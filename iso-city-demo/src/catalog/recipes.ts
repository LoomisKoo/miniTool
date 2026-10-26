// 像素图鉴的「配方」层。
//
// 核心取舍：一只宠物不存像素，只存 8 个数字。像素由 rasterize.ts 在运行时
// 光栅化。这样 120 个图鉴蓝图 = 3.6KB，而不是 120 张图。
//
// 这个文件必须保持纯净：不 import three、不碰 DOM。服务端也要引用它做校验。

/** 像素槽位。图集里每个像素存的是「槽位号」，不是颜色。 */
export const SLOT = {
  body: 0,
  belly: 1,
  accent: 2, // 花纹 / 鳍
  eye: 3,
  ear: 4, // 宠物：耳/角/触角；鱼：鳍
  tail: 5,
  collar: 6, // 宠物专用：项圈。野生留空
  deco: 7, // 装饰品
} as const

export const SLOT_COUNT = 8

/** 8 个 hex，按 SLOT 顺序。索引色方案的全部意义就在这一行。 */
export type Palette = [string, string, string, string, string, string, string, string]

export type PetRecipe = {
  body: number // 团子 / 圆 / 扁 / 高 / 长条 / 方 / 水滴 / 星
  ears: number // 尖 / 垂 / 圆 / 角 / 触角 / 无
  tail: number // 卷 / 蓬 / 细长 / 鳍 / 光点 / 无
  eyes: number // 圆 / 豆 / 星 / 竖瞳 / 闭
  pattern: number // 无 / 斑点 / 条纹 / 渐变 / 背脊 / 肚皮 / 雪花 / 光纹
  size: number // 0 / 1 / 2 → 0.85 / 1.0 / 1.15
  seed: number // 0~1，细节抖动
}

export type FishRecipe = {
  body: number // 纺锤 / 扁 / 长鳗 / 圆胖 / 扁头
  fin: number // 扇形 / 旗形 / 飘带 / 棘
  tail: number // 叉 / 圆 / 月 / 细
  eyes: number
  pattern: number
  size: number
  seed: number
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legend'

export const SIZE_SCALE = [0.85, 1, 1.15]

export const PET_COUNTS = { body: 8, ears: 6, tail: 6, eyes: 5, pattern: 8, size: 3 }
export const FISH_COUNTS = { body: 5, fin: 4, tail: 4, eyes: 3, pattern: 6, size: 3 }

// ---------------------------------------------------------------------------
// 确定性随机：不依赖 Math.random，服务端与客户端算出的蓝图必须完全一致
// ---------------------------------------------------------------------------

export function hashString(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = <T,>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length) % list.length]

// ---------------------------------------------------------------------------
// 12 套预置配色
// ---------------------------------------------------------------------------

export const PALETTES: Palette[] = [
  ['#f2e3c6', '#fbf3e2', '#e0b47a', '#2b2320', '#efd3a8', '#d9a266', '#c9624a', '#f0b45c'], // 奶油
  ['#bfe3d0', '#e8f6ee', '#6fbf9a', '#1f2b26', '#d2f0e0', '#4fa985', '#e2645c', '#f5c86a'], // 薄荷
  ['#f7c9a8', '#fde8d8', '#e88a5f', '#33221c', '#fadcc6', '#d2724a', '#4a7d9e', '#f2d06b'], // 蜜桃
  ['#d6c8ee', '#efe9f9', '#9a7fd1', '#241f2e', '#e4dcf6', '#7d63b8', '#e07a9a', '#8fd3e8'], // 薰衣草
  ['#bcd9ef', '#e6f2fb', '#6fa8d6', '#1c2430', '#d4e8f8', '#4f88bd', '#ef8f6a', '#f7d97a'], // 晴空
  ['#4c5261', '#6b7285', '#8f9bb3', '#f2f5fa', '#5c6474', '#79839a', '#e0655a', '#7ed0f0'], // 石墨
  ['#f6c3cf', '#fde4ea', '#e07f9b', '#33202a', '#f9d7e0', '#cc6b88', '#5f9ec7', '#f7d06a'], // 玫瑰
  ['#e6d6b8', '#f6eddc', '#c2a777', '#2e261d', '#efe4cc', '#a98f61', '#8a6f8f', '#e8a05c'], // 沙岩
  ['#9fc4a4', '#d8ebda', '#5f9268', '#1d2a20', '#c4dec8', '#4a7a53', '#d97a52', '#e8cf6b'], // 森林
  ['#cfe6f2', '#eef8fd', '#8cbdd6', '#1e2a33', '#dceef7', '#6ea3c0', '#d98d7a', '#f2e2a0'], // 冰
  ['#efb79a', '#fbdcc9', '#d4713f', '#2c1a13', '#f6cdb4', '#b85c33', '#3f6e8c', '#f0c357'], // 余烬
  ['#3a4256', '#525d78', '#7d8aa8', '#e9eefb', '#46506a', '#6a7695', '#d8b25c', '#7fe0f2'], // 午夜
]

export const PALETTE_NAMES = [
  '奶油', '薄荷', '蜜桃', '薰衣草', '晴空', '石墨',
  '玫瑰', '沙岩', '森林', '冰', '余烬', '午夜',
]

/** 野生宠物用「本色」——饱和度偏低，和有主人的宠物一眼能分开。 */
export function dullPalette(p: Palette, amount = 0.35): Palette {
  const mix = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    const gray = (r + g + b) / 3
    const k = (v: number) => Math.round(v + (gray - v) * amount)
    return `#${[k(r), k(g), k(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  }
  return p.map(mix) as Palette
}

// ---------------------------------------------------------------------------
// 配方哈希：用来去重、也用作服务端校验后的缓存键
// ---------------------------------------------------------------------------

export function recipeKey(recipe: Record<string, number>) {
  return Object.keys(recipe)
    .sort()
    .map((k) => `${k}${Math.round(recipe[k] * 1000)}`)
    .join('')
}

// ---------------------------------------------------------------------------
// 蓝图的程序化生成
// ---------------------------------------------------------------------------

function petAt(rng: () => number): PetRecipe {
  return {
    body: Math.floor(rng() * PET_COUNTS.body),
    ears: Math.floor(rng() * PET_COUNTS.ears),
    tail: Math.floor(rng() * PET_COUNTS.tail),
    eyes: Math.floor(rng() * PET_COUNTS.eyes),
    pattern: Math.floor(rng() * PET_COUNTS.pattern),
    size: Math.floor(rng() * PET_COUNTS.size),
    seed: Math.round(rng() * 1000) / 1000,
  }
}

function fishAt(rng: () => number): FishRecipe {
  return {
    body: Math.floor(rng() * FISH_COUNTS.body),
    fin: Math.floor(rng() * FISH_COUNTS.fin),
    tail: Math.floor(rng() * FISH_COUNTS.tail),
    eyes: Math.floor(rng() * FISH_COUNTS.eyes),
    pattern: Math.floor(rng() * FISH_COUNTS.pattern),
    size: Math.floor(rng() * FISH_COUNTS.size),
    seed: Math.round(rng() * 1000) / 1000,
  }
}

export type PetBlueprint = { id: string; name: string; recipe: PetRecipe; rarity: Rarity }

export type FishBlueprint = {
  id: string
  name: string
  recipe: FishRecipe
  rarity: Rarity
  kg: [number, number]
}

const PET_MOD = [
  '雪', '小', '绒', '焦', '电', '云', '夜', '糖', '海', '苔',
  '光', '沙', '短', '奶', '铁', '细', '胖', '软', '野', '圆',
]
const PET_BODY = ['团子', '球球', '软饼', '高个', '长条', '方砖', '水滴', '星星']

const FISH_MOD = [
  '银', '赤', '斑', '幽', '金', '石', '雾', '蓝', '铁', '短',
  '长', '细', '胖', '灰', '刺', '绒', '荧', '暗', '浅', '环',
]
const FISH_BODY = ['鳞鲹', '鲷', '鳗', '鲀', '鲶']

const FISH_KG: Record<Rarity, [number, number]> = {
  common: [0.05, 0.6],
  uncommon: [0.3, 1.8],
  rare: [1, 5.5],
  legend: [4, 19],
}

function rarityOf(index: number, total: number): Rarity {
  const t = index / total
  if (t < 0.5) return 'common'
  if (t < 0.75) return 'uncommon'
  if (t < 0.92) return 'rare'
  return 'legend'
}

function uniqueRecipes<T extends Record<string, number>>(
  count: number,
  salt: string,
  make: (rng: () => number) => T,
) {
  const out: T[] = []
  const seen = new Set<string>()
  for (let i = 0; i < count; i++) {
    let bump = 0
    let recipe = make(mulberry(hashString(`${salt}-${i}`)))
    while (seen.has(recipeKey(recipe)) && bump < 400) {
      bump += 1
      recipe = make(mulberry(hashString(`${salt}-${i}-${bump}`)))
    }
    seen.add(recipeKey(recipe))
    out.push(recipe)
  }
  return out
}

export const PET_COUNT = 120
export const FISH_COUNT = 240

export const PET_BLUEPRINTS: PetBlueprint[] = uniqueRecipes(PET_COUNT, 'pet-bp', petAt).map(
  (recipe, i) => ({
    id: `pet-${String(i).padStart(3, '0')}`,
    name: `${PET_MOD[i % PET_MOD.length]}${PET_BODY[recipe.body]}`,
    recipe,
    rarity: rarityOf(i, PET_COUNT),
  }),
)

export const FISH_BLUEPRINTS: FishBlueprint[] = uniqueRecipes(FISH_COUNT, 'fish-bp', fishAt).map(
  (recipe, i) => {
    const rarity = rarityOf(i, FISH_COUNT)
    return {
      id: `fish-${String(i).padStart(3, '0')}`,
      name: `${FISH_MOD[i % FISH_MOD.length]}${FISH_BODY[recipe.body]}`,
      recipe,
      rarity,
      kg: FISH_KG[rarity],
    }
  },
)

/** 野生变种：图鉴之外的随机组合，永远用不完。 */
export function randomPetRecipe(seed: string): PetRecipe {
  return petAt(mulberry(hashString(seed)))
}

export function randomFishRecipe(seed: string): FishRecipe {
  return fishAt(mulberry(hashString(seed)))
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: '常见',
  uncommon: '少见',
  rare: '稀有',
  legend: '传说',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8b949e',
  uncommon: '#5aa06a',
  rare: '#8a6fd0',
  legend: '#c9a227',
}

// ---------------------------------------------------------------------------
// 校验：服务端也用这一份
// ---------------------------------------------------------------------------

export function validPetRecipe(input: unknown): PetRecipe | null {
  if (!input || typeof input !== 'object') return null
  const r = input as Record<string, unknown>
  const keys: Array<[keyof PetRecipe, number]> = [
    ['body', PET_COUNTS.body],
    ['ears', PET_COUNTS.ears],
    ['tail', PET_COUNTS.tail],
    ['eyes', PET_COUNTS.eyes],
    ['pattern', PET_COUNTS.pattern],
    ['size', PET_COUNTS.size],
  ]
  const out = {} as PetRecipe
  for (const [key, max] of keys) {
    const v = Number(r[key])
    if (!Number.isInteger(v) || v < 0 || v >= max) return null
    out[key] = v
  }
  const seed = Number(r.seed)
  if (!Number.isFinite(seed) || seed < 0 || seed > 1) return null
  out.seed = seed
  return out
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function validPalette(input: unknown): Palette | null {
  if (!Array.isArray(input) || input.length !== SLOT_COUNT) return null
  for (const c of input) if (typeof c !== 'string' || !HEX.test(c)) return null
  return input as Palette
}
