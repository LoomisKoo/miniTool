/**
 * 场景特效：所有模板都能用的「天气 / 氛围」，但开关是按页存的，翻页后不沿用。
 * 强度 1–3 分别对应稀、中、密。
 * 具体怎么画在 fx.tsx 里，这里只声明名字和默认层级。
 */

export type EffectId =
  | 'snow'
  | 'rain'
  | 'firefly'
  | 'leaf'
  | 'star'
  | 'bubble'
  | 'firework'
  | 'meteor'
  | 'lantern'
  | 'glow'
  | 'lightning'

/** 强度：0 关，1 弱，2 中，3 强 */
export type FxLevel = 0 | 1 | 2 | 3
export type Fx = { id: EffectId; level: 1 | 2 | 3 }

export type EffectDef = { id: EffectId; label: string; hint: string }

export const effectDefs: EffectDef[] = [
  { id: 'snow', label: '飘雪', hint: '细雪在风里摇着落' },
  { id: 'rain', label: '细雨', hint: '斜斜的雨丝' },
  { id: 'lightning', label: '雷电', hint: '天光一闪，偶尔劈下一道' },
  { id: 'firefly', label: '萤火', hint: '暖光小点在飘' },
  { id: 'leaf', label: '落叶', hint: '秋叶翻着慢慢坠' },
  { id: 'star', label: '星光', hint: '细碎的光在闪' },
  { id: 'bubble', label: '泡泡', hint: '气泡一直往上冒' },
  { id: 'firework', label: '烟花', hint: '升空后炸开一圈火星' },
  { id: 'meteor', label: '流星', hint: '划过夜空的细线' },
  { id: 'lantern', label: '孔明灯', hint: '暖黄的灯缓缓升空' },
]

const ids = new Set(effectDefs.map((e) => e.id))
export const isEffect = (id: string): id is EffectId => ids.has(id as EffectId)

/** 一页最多同时开几个特效：再多就卡了 */
export const MAX_FX = 4

export const fxFull = (list: Fx[]) => list.length >= MAX_FX

/**
 * 直接选档：无 / 弱 / 中 / 强。
 * 开满 4 个之后不能再从「无」往上开，但已有的特效仍然可以调档或关掉。
 */
export function setFxLevel(list: Fx[], id: EffectId, level: FxLevel): Fx[] {
  const cur = list.find((f) => f.id === id)
  if (level === 0) return list.filter((f) => f.id !== id)
  if (!cur && list.length >= MAX_FX) return list
  if (cur) return list.map((f) => (f.id === id ? { ...f, level: level as Fx['level'] } : f))
  return [...list, { id, level: level as Fx['level'] }]
}
