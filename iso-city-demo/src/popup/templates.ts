/**
 * 立体书模板：位置、层级、宽高比全部写死，用户只负责往槽位里塞图片。
 * 这样生成结果不会穿模、不会压到书脊，也不需要用户理解 3D 坐标。
 */

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
  name: string
  summary: string
  /** 背景是一整张还是左右各一张 */
  wall: 'single' | 'split'
  page: string
  dots: string
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
    id: 'pages-two',
    name: '对称双景',
    summary: '左右各一张背景，每页四层立体剪纸',
    wall: 'split',
    page: '#2b2f5e',
    dots: 'rgba(255, 232, 170, .35)',
    slots: [...wallPair(), floor(), ...bothSides()],
  },
  {
    id: 'pages-one',
    name: '满幅跨页',
    summary: '一张图铺满整本书，自动在书脊处断开',
    wall: 'single',
    page: '#26405e',
    dots: 'rgba(220, 240, 255, .3)',
    slots: [wallSingle(), floor(), ...bothSides()],
  },
  {
    id: 'hero',
    name: '中央主图',
    summary: '左页四层铺景，右页四层主图',
    wall: 'split',
    page: '#3a2b4e',
    dots: 'rgba(255, 226, 188, .32)',
    // 两页都要有东西：左页用常规四层当铺景，右页四层叠成主图
    slots: [...wallPair(), floor(460, 506), ...stack(LEFT_LAYERS, 'left'), ...stack(HERO_LAYERS, 'right')],
  },
]

/** 某个槽位最终要烘成多大的位图 */
export function bakeSize(slot: Slot) {
  if (slot.kind === 'wall') {
    return slot.halves ? { w: WALL_PX.w * 2, h: WALL_PX.h } : { ...WALL_PX }
  }
  const w = Math.round((slot.w ?? 300) * 2)
  return { w, h: Math.round(w / slot.aspect) }
}
