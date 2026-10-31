/**
 * 立体书模板：位置、层级、宽高比全部写死，用户只负责往槽位里塞图片。
 * 这样生成结果不会穿模、不会压到书脊，也不需要用户理解 3D 坐标。
 */

import type { Fx } from './effects'

/** 单面背景墙的宽高比，和 art.tsx 里 SVG 墙一致（501 × 341） */
export const WALL_ASPECT = 501 / 341
/** 背景墙渲染用的位图尺寸（2 倍图） */
export const WALL_PX = { w: 1002, h: 682 }

export type Slot = {
  id: string
  label: string
  kind: 'wall' | 'floor' | 'subject'
  side: 'left' | 'right'
  /** 裁剪框宽高比（宽 / 高） */
  aspect: number
  /** 整张背景：裁剪完从中间切成两半，分别给左右两面墙 */
  halves?: boolean
  /** 立体纸片：中心 x、底边 y、宽度（书页 500×560 坐标）；flat 层的 y 是中心 */
  x?: number
  y?: number
  w?: number
  /** 纸片允许的最大高度：内置剪纸按自己的宽高比缩进这个框里 */
  maxH?: number
  flat?: boolean
  rot?: number
}

export type Template = {
  id: string
  /** 主题名，就是这一页的场景：万圣夜、午后生活…… */
  name: string
  summary: string
  /** 版式：左右各一张背景 / 一张铺满 / 中央主图 */
  layout: 'split' | 'single' | 'hero'
  wall: 'single' | 'split'
  page: string
  dots: string
  /** 这个主题能用的背景 */
  walls: string[]
  /** 这个主题能用的地面 */
  floors: string[]
  /** 这个主题能用的贴纸（特效是全主题共用的） */
  stickers: string[]
  /** 按场景预置的氛围特效：选这个主题就自动带上，用户还能再改 */
  fx?: Fx[]
  slots: Slot[]
}

const wallPair = (): Slot[] => [
  { id: 'wallL', label: '左页背景', kind: 'wall', side: 'left', aspect: WALL_ASPECT },
  { id: 'wallR', label: '右页背景', kind: 'wall', side: 'right', aspect: WALL_ASPECT },
]

const wallSingle = (): Slot => ({
  id: 'wallSingle',
  label: '整张背景',
  kind: 'wall',
  side: 'left',
  aspect: (WALL_PX.w * 2) / WALL_PX.h,
  halves: true,
})

const floor = (w = 460, y = 502): Slot => ({
  id: 'floor',
  label: '地面前景',
  kind: 'floor',
  side: 'right',
  aspect: 500 / 120,
  x: 250,
  y,
  w,
  flat: true,
})

/** 一层景深：底边 y 越大越靠前（离读者越近） */
type LayerSpec = { tag: string; x: number; y: number; w: number; maxH: number; aspect: number }

/**
 * 每页四层：后景 / 中景 / 前景 / 近景。
 * 越靠后给得越高越宽，前排压小压扁；四层之间的空隙保证折起来时前后不互相穿插。
 */
const LEFT_LAYERS: LayerSpec[] = [
  { tag: '后景', x: 152, y: 320, w: 310, maxH: 285, aspect: 1.1 },
  { tag: '中景', x: 312, y: 408, w: 215, maxH: 200, aspect: 1.2 },
  { tag: '前景', x: 208, y: 480, w: 180, maxH: 155, aspect: 1 },
  { tag: '近景', x: 412, y: 526, w: 135, maxH: 105, aspect: 1.3 },
]

/** 右页是左页的镜像，左右跨页看起来才对称 */
const mirror = (l: LayerSpec): LayerSpec => ({ ...l, x: 500 - l.x })

const stack = (specs: LayerSpec[], side: 'left' | 'right'): Slot[] =>
  specs.map((s, i) => ({
    id: `${side}-${i + 1}`,
    label: `${side === 'left' ? '左' : '右'}页 · ${s.tag}`,
    kind: 'subject',
    side,
    x: s.x,
    y: s.y,
    w: s.w,
    maxH: s.maxH,
    aspect: s.aspect,
  }))

const bothSides = (): Slot[] => [...stack(LEFT_LAYERS, 'left'), ...stack(LEFT_LAYERS.map(mirror), 'right')]

/** 主图模板：四层都叠在正中，稍微左右错开一点免得像个柱子 */
const HERO_LAYERS: LayerSpec[] = [
  { tag: '后景', x: 250, y: 336, w: 420, maxH: 300, aspect: 1.2 },
  { tag: '中景', x: 212, y: 424, w: 310, maxH: 215, aspect: 1 },
  { tag: '前景', x: 290, y: 490, w: 230, maxH: 160, aspect: 0.9 },
  { tag: '近景', x: 234, y: 534, w: 155, maxH: 105, aspect: 1.4 },
]

export const templates: Template[] = [
  {
    id: 'moon-town',
    name: '月夜小镇',
    summary: '月光落在屋顶上，邮差提着灯笼走过',
    layout: 'split',
    wall: 'split',
    page: '#2b2f5e',
    dots: 'rgba(255, 232, 170, .35)',
    walls: ['night', 'dawn', 'forest'],
    floors: ['cobble', 'grass', 'water'],
    stickers: [
      'house', 'windmill', 'postoffice', 'row', 'girl', 'cat', 'lamp', 'cart', 'garland', 'balloon',
      'island', 'kite', 'plane', 'boat', 'butterfly',
    ],
    // 夜里的星光 + 慢升的孔明灯
    fx: [{ id: 'star', level: 2 }, { id: 'lantern', level: 2 }],
    slots: [...wallPair(), floor(), ...bothSides()],
  },
  {
    id: 'halloween',
    name: '万圣夜',
    summary: '南瓜灯亮起来，幽灵和小女巫出门了',
    layout: 'single',
    wall: 'single',
    page: '#2a1a3d',
    dots: 'rgba(255, 198, 120, .32)',
    walls: ['haunt', 'night', 'forest'],
    floors: ['cobble', 'snowgrass', 'grass'],
    stickers: [
      'pumpkin', 'ghost', 'bat', 'tombstone', 'witch', 'candy', 'candle', 'spider', 'owl', 'cat',
      'lamp', 'campfire', 'house',
    ],
    // 枯叶在夜色里打转，零星几点星
    fx: [{ id: 'leaf', level: 2 }, { id: 'star', level: 1 }],
    slots: [wallSingle(), floor(), ...bothSides()],
  },
  {
    id: 'forest-camp',
    name: '森林营地',
    summary: '萤火虫和篝火，树影里过一夜',
    layout: 'split',
    wall: 'split',
    page: '#1d3a34',
    dots: 'rgba(180, 236, 190, .28)',
    walls: ['forest', 'night'],
    floors: ['grass', 'water', 'snowgrass'],
    stickers: [
      'pines', 'campfire', 'deer', 'owl', 'girl-sit', 'picnic', 'tree', 'garland', 'tent', 'lamp',
      'cart', 'butterfly', 'squirrel', 'dandelion', 'jar',
    ],
    // 森林里最出彩的就是萤火
    fx: [{ id: 'firefly', level: 3 }, { id: 'star', level: 1 }],
    slots: [...wallPair(), floor(460, 504), ...bothSides()],
  },
  {
    id: 'undersea',
    name: '海底漫游',
    summary: '鲸鱼图书馆从珊瑚礁上方游过',
    layout: 'single',
    wall: 'single',
    page: '#18506f',
    dots: 'rgba(198, 240, 255, .3)',
    walls: ['sea', 'sky'],
    floors: ['seabed', 'shells', 'water'],
    stickers: ['whale', 'jelly', 'girl-diver', 'kelp', 'coral', 'balloon', 'island', 'boat'],
    // 气泡从海底一直往上冒
    fx: [{ id: 'bubble', level: 3 }],
    slots: [wallSingle(), floor(460, 508), ...bothSides()],
  },
  {
    id: 'sky',
    name: '云上飞行',
    summary: '热气球慢慢升起来，云海一直在下面',
    layout: 'single',
    wall: 'single',
    page: '#3a5573',
    dots: 'rgba(255, 240, 220, .3)',
    walls: ['sky', 'dawn'],
    floors: ['cloud', 'grass', 'water'],
    stickers: ['balloon', 'island', 'garland', 'girl', 'tree', 'cart', 'picnic', 'kite', 'plane'],
    // 高空里几盏孔明灯
    fx: [{ id: 'lantern', level: 2 }],
    slots: [wallSingle(), floor(460, 512), ...bothSides()],
  },
  {
    id: 'daily',
    name: '午后生活',
    summary: '一杯咖啡、一摞书，猫在打盹',
    layout: 'split',
    wall: 'split',
    page: '#e3cbb6',
    dots: 'rgba(120, 84, 58, .18)',
    walls: ['room', 'library'],
    floors: ['rug', 'wood', 'grass'],
    stickers: [
      'coffee', 'books', 'plant', 'catnap', 'lamp', 'picnic', 'cart', 'garland', 'cat', 'girl-sit',
      'desklamp', 'cake', 'rabbit',
    ],
    // 午后飘着一点薄絮似的光斑
    fx: [{ id: 'leaf', level: 1 }],
    slots: [...wallPair(), floor(460, 508), ...bothSides()],
  },
  {
    id: 'dusk-city',
    name: '黄昏街区',
    summary: '天刚暗下来，街灯一盏盏亮了',
    layout: 'hero',
    wall: 'split',
    page: '#4a3a63',
    dots: 'rgba(255, 214, 160, .3)',
    walls: ['dawn', 'night', 'haunt'],
    floors: ['cobble', 'wood', 'water'],
    stickers: ['row', 'postoffice', 'lamp', 'girl', 'windmill', 'balloon', 'garland', 'cart', 'tent', 'kite', 'plane'],
    // 天刚暗，街灯边飘着萤火
    fx: [{ id: 'firefly', level: 2 }, { id: 'star', level: 1 }],
    slots: [...wallPair(), floor(460, 506), ...stack(LEFT_LAYERS, 'left'), ...stack(HERO_LAYERS, 'right')],
  },
  {
    id: 'space',
    name: '星际漫游',
    summary: '火箭升空，飞碟从行星旁边掠过',
    layout: 'split',
    wall: 'split',
    page: '#241a4a',
    dots: 'rgba(214, 198, 255, .3)',
    walls: ['cosmos', 'night'],
    floors: ['cloud', 'cobble', 'shells'],
    stickers: ['rocket', 'planet', 'ufo', 'island', 'balloon', 'plane', 'kite', 'jar'],
    // 星空里偶尔划过一道流星
    fx: [{ id: 'star', level: 3 }, { id: 'meteor', level: 2 }],
    slots: [...wallPair(), floor(460, 508), ...bothSides()],
  },
  {
    id: 'winter',
    name: '冬日雪夜',
    summary: '雪落在松枝上，雪人戴着红围巾',
    layout: 'single',
    wall: 'single',
    page: '#31506e',
    dots: 'rgba(226, 244, 255, .3)',
    walls: ['winter', 'aurora', 'forest', 'sky'],
    floors: ['snowgrass', 'cloud', 'grass'],
    stickers: ['snowman', 'pines', 'deer', 'jar', 'tent', 'lamp', 'girl-sit', 'rabbit', 'tree'],
    // 雪夜当然要下雪
    fx: [{ id: 'snow', level: 3 }],
    slots: [wallSingle(), floor(460, 508), ...bothSides()],
  },
  {
    id: 'desert',
    name: '沙漠日落',
    summary: '沙丘被夕阳染红，驼铃从远处传来',
    layout: 'split',
    wall: 'split',
    page: '#c2764d',
    dots: 'rgba(255, 232, 196, .35)',
    walls: ['desert', 'dawn'],
    floors: ['sand', 'cobble'],
    stickers: ['tent', 'campfire', 'cart', 'lamp', 'cactus', 'balloon', 'dandelion', 'deer', 'owl', 'jar'],
    // 太阳沉下去后，天上开始有星
    fx: [{ id: 'star', level: 1 }, { id: 'leaf', level: 1 }],
    slots: [...wallPair(), floor(460, 506), ...bothSides()],
  },
  {
    id: 'blossom',
    name: '春日花见',
    summary: '樱花落在鸟居下，风一吹整条路都是粉的',
    layout: 'single',
    wall: 'single',
    page: '#c98aa0',
    dots: 'rgba(255, 246, 250, .4)',
    walls: ['blossom', 'dawn', 'sky'],
    floors: ['petals', 'grass'],
    stickers: ['cherry', 'torii', 'girl-sit', 'picnic', 'butterfly', 'rabbit', 'lamp', 'boat', 'kite', 'squirrel'],
    // 花瓣一直落
    fx: [{ id: 'leaf', level: 3 }],
    slots: [wallSingle(), floor(460, 508), ...bothSides()],
  },
  {
    id: 'neon',
    name: '霓虹夜市',
    summary: '招牌一盏接一盏，纸飞机从楼缝里穿过',
    layout: 'split',
    wall: 'split',
    page: '#241235',
    dots: 'rgba(255, 120, 200, .32)',
    walls: ['neon', 'dawn'],
    floors: ['tiles', 'cobble'],
    stickers: ['row', 'postoffice', 'lamp', 'cart', 'cat', 'cake', 'coffee', 'balloon', 'plane', 'garland', 'ufo'],
    // 夜市收尾时偶尔放一串烟花
    fx: [{ id: 'firework', level: 2 }],
    slots: [...wallPair(), floor(460, 506), ...bothSides()],
  },
  {
    id: 'cave',
    name: '水晶洞窟',
    summary: '洞顶在滴水，蓝水晶把黑暗撑开一条缝',
    layout: 'single',
    wall: 'single',
    page: '#22314f',
    dots: 'rgba(168, 240, 255, .3)',
    walls: ['cave', 'cosmos'],
    floors: ['seabed', 'shells', 'cobble'],
    stickers: ['crystal', 'jar', 'dandelion', 'island', 'ufo', 'deer', 'owl', 'boat', 'jelly', 'kelp'],
    // 洞顶滴水、荧光粒
    fx: [{ id: 'firefly', level: 2 }, { id: 'bubble', level: 1 }],
    slots: [wallSingle(), floor(460, 508), ...bothSides()],
  },
  {
    id: 'harbor',
    name: '港口黄昏',
    summary: '灯塔刚亮，最后一班帆船靠岸',
    layout: 'split',
    wall: 'split',
    page: '#5a4a70',
    dots: 'rgba(255, 214, 160, .3)',
    walls: ['dawn', 'sea'],
    floors: ['water', 'wood', 'shells'],
    stickers: ['lighthouse', 'boat', 'lamp', 'cat', 'garland', 'balloon', 'postoffice', 'cart', 'kite', 'plane', 'girl'],
    // 港口傍晚，天上开始出星
    fx: [{ id: 'star', level: 1 }, { id: 'lantern', level: 1 }],
    slots: [...wallPair(), floor(460, 508), ...bothSides()],
  },
  {
    id: 'meadow',
    name: '田原午后',
    summary: '风车慢慢转，草地上摊开一块野餐布',
    layout: 'hero',
    wall: 'split',
    page: '#4c6b4f',
    dots: 'rgba(255, 246, 214, .3)',
    walls: ['rainbow', 'forest', 'dawn', 'sky'],
    floors: ['grass', 'water', 'snowgrass'],
    stickers: [
      'windmill', 'tree', 'deer', 'picnic', 'butterfly', 'squirrel', 'pines', 'girl', 'cart', 'dandelion',
      'rabbit', 'kite',
    ],
    // 草上飘着一点落叶和蒲公英似的絮
    fx: [{ id: 'leaf', level: 1 }],
    slots: [...wallPair(), floor(460, 506), ...stack(LEFT_LAYERS, 'left'), ...stack(HERO_LAYERS, 'right')],
  },
  {
    id: 'free',
    name: '自由拼贴',
    summary: '不限主题，所有贴纸都可以用',
    layout: 'split',
    wall: 'split',
    page: '#2f3350',
    dots: 'rgba(255, 236, 200, .3)',
    walls: [
      'night', 'dawn', 'sea', 'sky', 'forest', 'haunt', 'room', 'cosmos', 'winter', 'desert', 'blossom',
      'neon', 'cave', 'aurora', 'rainbow', 'volcano', 'candy', 'library', 'jungle',
    ],
    floors: [
      'grass', 'snowgrass', 'cobble', 'water', 'cloud', 'shells', 'seabed', 'rug', 'wood', 'sand', 'petals',
      'tiles',
    ],
    stickers: [
      'girl', 'girl-sit', 'girl-diver', 'cat', 'campfire', 'house', 'postoffice', 'row', 'windmill', 'island',
      'deer', 'owl', 'whale', 'jelly', 'tree', 'pines', 'kelp', 'coral', 'lamp', 'balloon', 'cart', 'picnic',
      'garland', 'pumpkin', 'ghost', 'bat', 'tombstone', 'witch', 'candy', 'coffee', 'books', 'plant', 'catnap',
      'tent', 'candle', 'spider', 'desklamp', 'cake', 'rabbit', 'butterfly', 'squirrel', 'dandelion', 'jar',
      'boat', 'kite', 'plane', 'rocket', 'planet', 'ufo', 'snowman', 'cactus', 'cherry', 'torii', 'crystal',
      'lighthouse',
    ],
    slots: [...wallPair(), floor(), ...bothSides()],
  },
]

/** 空白页：草稿页用的主题，什么预设都不放，留给用户自己挑 */
export const draftTemplate: Template = {
  id: 'draft',
  name: '空白页',
  summary: '挑一个主题开始这一页',
  layout: 'split',
  wall: 'split',
  page: '#3a3a48',
  dots: 'rgba(255, 255, 255, .1)',
  walls: [],
  floors: [],
  stickers: [],
  slots: [...wallPair(), floor(), ...bothSides()],
}

/** 某个槽位最终要烘成多大的位图 */
export function bakeSize(slot: Slot) {
  if (slot.kind === 'wall') {
    return slot.halves ? { w: WALL_PX.w * 2, h: WALL_PX.h } : { ...WALL_PX }
  }
  const w = Math.round((slot.w ?? 300) * 2)
  return { w, h: Math.round(w / slot.aspect) }
}
