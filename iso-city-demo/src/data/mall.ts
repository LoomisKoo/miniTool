// 南岸广场：一座胶囊形的购物中心。
//
// 平面（局部坐标，原点在商场中心，长轴 = z）：
//
//            z = +38   ╭──────────╮        ← 北门
//                      │          │
//            z = +10   │  ╭────╮  │        ┌ 外轮廓：胶囊 r=28, hx=10
//                      │  │中庭│  │        │   长 76m × 宽 56m
//            z =   0   │  │ □  │  │  ← 西门 │ 面积 3590㎡（原来圆形 2640㎡）
//                      │  │    │  │        │
//            z = -10   │  ╰────╯  │        └ 中庭开口：14m × 26m
//                      │          │
//            z = -38   ╰──────────╯        ← 南门
//
// 一圈店面：距外轮廓 8m 处开门，进深 8m，全部朝里——**每一层都有**，
// 一层也不例外。店面到中庭之间是 13m 宽的外廊，中庭四条边围玻璃栏杆，
// 三段扶梯在中庭里折返上行，真的能走上去（台阶本身就是碰撞面）。
//
// 竖向：
//   L1  0.0 ~ 5.8   生活 · 食集（超市、咖啡、烘焙、茶饮、花店、甜品）
//   L2  5.8 ~ 10.2  时尚 · 服饰
//   L3 10.2 ~ 14.6  家居 · 数码
//   L4 14.6 ~ 19.0  影院 · 餐饮
//   屋顶 19.0        中庭上方一条 14m 宽的玻璃拱顶

import { makeShopDeck, type ShopCatalogEntry, type ShopKind } from './shopCatalog'

export const MALL = {
  cx: 50,
  cz: 152,
  /** 短轴半径（x 方向半宽） */
  r: 28,
  /** 长轴直段半长（z 方向，两端各接一个 r 的半圆） */
  hx: 10,
  /** 层数 */
  levels: 4,
  /** 首层层高（要容纳店面门头） */
  ground: 5.8,
  /** 标准层层高 */
  levelH: 4.4,
  /** 店面开间所在的环离外墙多远（= 铺位前沿到外墙的距离） */
  shopDepth: 8,
  /** 中庭开口半宽（x） */
  slotX: 7,
  /** 中庭开口半长（z） */
  slotZ: 13,
} as const

export type MallLevel = { i: number; y0: number; y1: number; h: number }

export const MALL_LEVELS: MallLevel[] = (() => {
  const out: MallLevel[] = []
  let y = 0
  for (let i = 0; i < MALL.levels; i++) {
    const h = i === 0 ? MALL.ground : MALL.levelH
    out.push({ i, y0: y, y1: y + h, h })
    y += h
  }
  return out
})()

/**
 * 一家店的房间进深。
 *
 * 不是铺位前沿到外墙的那 8m——那 8m 里只有靠前的一段是"店里"，后面留出
 * 4.6m 宽的外圈廊道：从广场透过幕墙往里看，看到的是这条廊道和店铺的
 * 背墙，而不是一层薄薄的假门窗。
 */
export const SHOP_ROOM_DEPTH = 3.4

export const MALL_TOP = MALL_LEVELS[MALL_LEVELS.length - 1].y1

/** 每层主题，印在电梯厅的楼层牌上。 */
export const MALL_THEME = [
  { name: '生活 · 食集', sub: 'MARKET & DINING' },
  { name: '时尚 · 服饰', sub: 'FASHION' },
  { name: '家居 · 数码', sub: 'HOME & TECH' },
  { name: '影院 · 餐饮', sub: 'CINEMA & DINING' },
] as const

/** 外轮廓在 ±z 方向的最远处（南北门所在） */
export const MALL_END = MALL.hx + MALL.r

// ---------------------------------------------------------------- 门

/**
 * 四道门。局部坐标 + yaw（局部 +Z 指向室外），世界位置 = 中心 + 局部。
 *
 * 西门是主入口，正对西面广场上那座牌坊；南北门在胶囊的两个圆头和
 * 侧边相切的位置，正对广场的转角空地。
 */
export type MallPortal = {
  id: string
  x: number
  z: number
  yaw: number
  w: number
  label: string
  sub: string
  main?: boolean
}

export const MALL_PORTALS: MallPortal[] = [
  { id: 'west', x: -MALL.r, z: 0, yaw: -Math.PI / 2, w: 9, label: '南岸广场', sub: 'SOUTH BANK MALL', main: true },
  { id: 'east', x: MALL.r, z: 0, yaw: Math.PI / 2, w: 8, label: '东庭', sub: 'EAST COURT' },
  { id: 'north', x: 0, z: MALL_END, yaw: 0, w: 8, label: '北廊', sub: 'NORTH ARCADE' },
  { id: 'south', x: 0, z: -MALL_END, yaw: Math.PI, w: 8, label: '南廊', sub: 'SOUTH ARCADE' },
]

/**
 * 门洞在店里要挖掉的范围（局部坐标的矩形）。
 *
 * 店面是按外轮廓一圈排的，门洞正好落在某一圈铺位上，所以排铺位时
 * 先把落进这几个矩形的去掉——门洞两侧的铺位就紧贴门框，不留空墙。
 */
export const MALL_PORTAL_HOLES = MALL_PORTALS.map((p) => {
  const nx = Math.sin(p.yaw)
  const nz = Math.cos(p.yaw)
  const tx = Math.cos(p.yaw)
  const tz = -Math.sin(p.yaw)
  const half = p.w / 2 + 1.0
  const depth = MALL.shopDepth + 1.6
  // 以门洞中心为基准，沿切向 ±half、沿法向向内 depth
  const pts: Array<[number, number]> = [
    [p.x + tx * half, p.z + tz * half],
    [p.x - tx * half, p.z - tz * half],
    [p.x + tx * half - nx * depth, p.z + tz * half - nz * depth],
    [p.x - tx * half - nx * depth, p.z - tz * half - nz * depth],
  ]
  return {
    x0: Math.min(...pts.map((q) => q[0])),
    x1: Math.max(...pts.map((q) => q[0])),
    z0: Math.min(...pts.map((q) => q[1])),
    z1: Math.max(...pts.map((q) => q[1])),
  }
})

export function inPortalHole(x: number, z: number, pad = 0) {
  return MALL_PORTAL_HOLES.some((h) => x > h.x0 - pad && x < h.x1 + pad && z > h.z0 - pad && z < h.z1 + pad)
}

// ---------------------------------------------------------------- 外轮廓采样

export type RingPoint = {
  x: number
  z: number
  /** 径向朝外的单位法线 */
  nx: number
  nz: number
  /** 沿周长的弧长位置 */
  s: number
}

/**
 * 胶囊外轮廓按弧长均匀取点。inset 是向内收缩量（给店面 / 走廊算线）。
 *
 * 路径一圈：右边直线 → 上半圆 → 左边直线 → 下半圆，逆时针。
 */
/** 胶囊外轮廓上弧长 s 处的精确点（局部坐标，含向外法线）。 */
export function capsulePointAt(inset: number, s: number): RingPoint {
  const r = MALL.r - inset
  const hx = MALL.hx
  const straight = 2 * hx
  const arc = Math.PI * r
  const total = 2 * straight + 2 * arc

  const wrap = (((s % total) + total) % total)
  let t = wrap
  let p: { x: number; z: number; nx: number; nz: number }
  // 右边直线：(r,-hx) → (r,hx)
  if (t < straight) {
    p = { x: r, z: -hx + t, nx: 1, nz: 0 }
  } else {
    t -= straight
    // 上半圆：中心 (0,hx)，角度 0 → π
    if (t < arc) {
      const a = t / r
      p = { x: Math.cos(a) * r, z: hx + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }
    } else {
      t -= arc
      // 左边直线：(-r,hx) → (-r,-hx)
      if (t < straight) {
        p = { x: -r, z: hx - t, nx: -1, nz: 0 }
      } else {
        t -= straight
        // 下半圆：中心 (0,-hx)，角度 π → 2π
        const a = Math.PI + t / r
        p = { x: Math.cos(a) * r, z: -hx + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }
      }
    }
  }
  return { ...p, s: wrap }
}

/** 胶囊外轮廓按弧长均匀取点。 */
export function capsuleRing(inset: number, count: number): RingPoint[] {
  const total = capsulePerimeter(inset)
  return Array.from({ length: count }, (_, i) => capsulePointAt(inset, (i / count) * total))
}

/** 外轮廓周长（inset 之后） */
export const capsulePerimeter = (inset = 0) => 4 * MALL.hx + 2 * Math.PI * (MALL.r - inset)

// ---------------------------------------------------------------- 店面

/** 店面：中心点、朝向（局部 +Z 朝中庭）、开面宽。 */
export type MallShop = { id: string; x: number; z: number; yaw: number; w: number; shop: ShopCatalogEntry }

const DECK = makeShopDeck(160, 'south-bank-mall-v2')

/**
 * 楼层业态。购物中心真实的分层逻辑：一层客流最大放快消餐饮，往上客单价
 * 和停留时长递增，顶层影院和正餐靠目的性消费把人拉上去。
 */
const FLOOR_KINDS: ShopKind[][] = [
  ['konbini', 'grocer', 'deli', 'cafe', 'bakery', 'tea', 'milktea', 'florist', 'dessert', 'fruit'],
  ['clothes', 'tailor', 'shoes', 'sportswear', 'jewelry', 'watch', 'eyewear', 'salon', 'barber'],
  ['phone', 'books', 'stationery', 'hardware', 'photo', 'print', 'laundry', 'pharmacy', 'pet'],
  ['bar', 'roast', 'bbq', 'hotpot', 'noodle', 'sushi', 'seafood', 'cafe', 'dessert', 'karaoke', 'gym', 'toy'],
]

function floorDeck(floor: number, count: number): ShopCatalogEntry[] {
  const kinds = FLOOR_KINDS[floor % FLOOR_KINDS.length]
  const pool = DECK.filter((s) => kinds.includes(s.kind))
  const src = pool.length >= count ? pool : DECK
  return Array.from({ length: count }, (_, i) => src[(floor * 7 + i) % src.length])
}

const SHOPS_PER_LEVEL = 24

/** 每层一圈店面（朝里开门，整齐排在中庭四周）。 */
export const MALL_SHOPS: MallShop[][] = MALL_LEVELS.map((lv) => {
  const deck = floorDeck(lv.i, SHOPS_PER_LEVEL)
  const seg = capsulePerimeter(MALL.shopDepth) / SHOPS_PER_LEVEL
  const out: MallShop[] = []
  for (let i = 0; i < SHOPS_PER_LEVEL; i++) {
    // 沿周长等分取中心点（精确弧长，不用采样近似，否则店与店之间会漏缝）
    const p = capsulePointAt(MALL.shopDepth, (i + 0.5) * seg)
    if (inPortalHole(p.x, p.z, 0.5)) continue
    out.push({
      id: `mall-${lv.i}-${i}`,
      x: p.x,
      z: p.z,
      // 局部 +Z 朝中庭 = 法线反向
      yaw: Math.atan2(-p.nx, -p.nz),
      w: seg - 0.42,
      shop: deck[i % deck.length],
    })
  }
  return out
})

/** 一层中庭里的摊车（吃喝）。 */
export const MALL_KIOSKS = [
  { id: 'k1', x: -13.5, z: -9, name: '咖啡', sub: 'COFFEE', glow: '#ffc27a' },
  { id: 'k2', x: -13.5, z: 3.5, name: '冰淇淋', sub: 'GELATO', glow: '#ffb0c8' },
  { id: 'k3', x: -13.5, z: 13.5, name: '茶饮', sub: 'TEA', glow: '#a8e86a' },
  { id: 'k4', x: 13.5, z: -4, name: '面包', sub: 'BAKERY', glow: '#ffcf8a' },
  { id: 'k5', x: 13.5, z: 9, name: '花店', sub: 'FLOWERS', glow: '#c8f0a0' },
  { id: 'k6', x: 0, z: 18.5, name: '糖水', sub: 'SWEET', glow: '#ffb06a' },
  { id: 'k7', x: 0, z: -18.5, name: '烤串', sub: 'SKEWERS', glow: '#ff8a4a' },
] as const

/**
 * 走廊里的花箱 / 长凳。每层沿中庭摆一列，让 13m 宽的廊子看起来有人气，
 * 也给逛店的人一个坐下来的地方。
 */
export const MALL_PLANTERS: Array<{ level: number; x: number; z: number }> = MALL_LEVELS.flatMap((lv) =>
  [-8.5, 0, 8.5].flatMap((z) => [
    { level: lv.i, x: -10.4, z },
    { level: lv.i, x: 10.4, z: -z },
  ]),
)

// ---------------------------------------------------------------- 扶梯

/** 一级台阶高 / 深。台阶高必须 < 0.3：PlayerRig 的 blocked() 只放行脚下 0.3m 以内的坎。 */
export const ESC_RISE = 0.26
export const ESC_TREAD = 0.4

/**
 * 一段扶梯。level 是它从哪一层起步，side=-1 靠中庭西边、+1 靠东边，
 * z 是下平台中心，dir=+1 往 +z 上行。
 *
 * 三段首尾错开、东西交替：从下往上走是一个之字，站在中庭里能看到
 * 三段梯子一段压一段，这就是商场中庭的典型剖面。
 */
export type EscalatorSpec = { id: string; level: number; side: -1 | 1; z: number; dir: 1 | -1 }

export const MALL_ESCALATORS: EscalatorSpec[] = [
  { id: 'e01', level: 0, side: -1, z: -10, dir: 1 },
  { id: 'e12', level: 1, side: 1, z: 7, dir: -1 },
  { id: 'e23', level: 2, side: -1, z: -3, dir: 1 },
]

export type EscalatorGeo = {
  id: string
  level: number
  x: number
  y0: number
  y1: number
  steps: number
  /** 台阶第一级的中心 z */
  zStep0: number
  /** 第一级台阶的近边（踏板开始的位置） */
  zStart: number
  /** 最后一级台阶的远边 */
  zEnd: number
  /** 每级中心 z（含方向） */
  zAt: (k: number) => number
  /** 下平台中心 */
  zBottom: number
  /** 上平台中心 */
  zTop: number
  dir: 1 | -1
  rise: number
}

/** 一段扶梯的全部尺寸。渲染和碰撞都从这里取，台阶面才对得上。 */
export function escalatorGeo(spec: EscalatorSpec): EscalatorGeo {
  const y0 = MALL_LEVELS[spec.level].y0
  const y1 = MALL_LEVELS[spec.level + 1].y0
  const rise = y1 - y0
  const steps = Math.round(rise / ESC_RISE)
  const run = steps * ESC_TREAD
  const zStep0 = spec.z + spec.dir * 1.05
  const zTop = zStep0 + spec.dir * (run + 1.05)
  return {
    id: spec.id,
    level: spec.level,
    x: spec.side * (MALL.slotX - 1.05),
    y0,
    y1,
    steps,
    zStep0,
    zStart: zStep0 - spec.dir * (ESC_TREAD / 2),
    zEnd: zStep0 + spec.dir * ((steps - 0.5) * ESC_TREAD),
    zAt: (k) => zStep0 + spec.dir * k * ESC_TREAD,
    zBottom: spec.z,
    zTop,
    dir: spec.dir,
    rise,
  }
}

/** 每级台阶的踏面高度 */
export const stepTop = (geo: EscalatorGeo, k: number) => geo.y0 + (k + 1) * ESC_RISE

/** 倾斜段（台阶 + 两侧玻璃）占的 z 范围。上下平台不在这段里，人才出得来。 */
export function escalatorSpan(geo: EscalatorGeo): [number, number] {
  return [Math.min(geo.zStart, geo.zEnd), Math.max(geo.zStart, geo.zEnd)]
}

/**
 * 某一层、某一侧的中庭栏杆要断开的位置（扶梯上下平台的进出口）。
 * 不挖开的话，人会站在栏杆外面看着扶梯上不去。
 */
export function railGaps(level: number, side: -1 | 1): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const spec of MALL_ESCALATORS) {
    if (spec.side !== side) continue
    const geo = escalatorGeo(spec)
    if (spec.level === level) out.push([geo.zBottom - 1.3, geo.zBottom + 1.3])
    if (spec.level + 1 === level) out.push([geo.zTop - 1.3, geo.zTop + 1.3])
  }
  return out
}

/** 中庭栏杆的分段（沿着 z 的两条长边 + 前后两条短边）。 */
export type RailRun = { axis: 'x' | 'z'; at: number; from: number; to: number }

export function railRuns(level: number): RailRun[] {
  const out: RailRun[] = []
  // 一层地面是整块实心楼板（中庭从二层开始通高），一层不需要栏杆
  if (level === 0) return out
  for (const side of [-1, 1] as const) {
    const gaps = railGaps(level, side).sort((a, b) => a[0] - b[0])
    let cursor = -MALL.slotZ
    for (const [g0, g1] of gaps) {
      if (g0 - cursor > 0.4) out.push({ axis: 'z', at: side * MALL.slotX, from: cursor, to: g0 })
      cursor = Math.max(cursor, g1)
    }
    if (MALL.slotZ - cursor > 0.4) out.push({ axis: 'z', at: side * MALL.slotX, from: cursor, to: MALL.slotZ })
  }
  out.push({ axis: 'x', at: MALL.slotZ, from: -MALL.slotX, to: MALL.slotX })
  out.push({ axis: 'x', at: -MALL.slotZ, from: -MALL.slotX, to: MALL.slotX })
  return out
}
