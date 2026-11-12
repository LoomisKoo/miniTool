// 1 楼沿街店铺。
//
// 规则来自 docs/05-housing.md 第 6 节：店铺是"长期展示位"，一人一间，外观是
// 橱窗 + 招牌 + 门头。这里只放店铺的**位置**和**内容**——几何和陈列在
// indoor/ShopFit.tsx，进门后的房间在 indoor/ShopRoom.tsx。
//
// 位置不是写死的世界坐标，而是从楼栋首层平面推出来的：店铺就是首层门厅里
// 贴着某一面外墙切出来的一条（进深 5.2m），门开在立面上，正好和街上看到的
// 那一排橱窗对齐（首层立面的 storefronts() 就是按 shop 归属生成的）。
//
// 所有店都避开两个东西：
// - 单元门 / 大堂出入口（exit 的 a0~a1）；
// - 电梯井（首层电梯都在另一面或另一头，这里逐店核对过）。

import { buildingById } from './city'
import { layoutOf, unitBuilding, WALL, type Rect, type Side } from './units'

/** 店铺业态：决定室内陈列（ShopFit）和配色。 */
export type ShopKind = 'bakery' | 'konbini' | 'florist' | 'noodle' | 'record' | 'zine' | 'tea'

export type ShopItem = { name: string; price: string; note: string }

export type ShopDef = {
  id: string
  name: string
  kind: ShopKind
  buildingId: string
  /** 一句话卖点，门口气泡和面板都用它。 */
  blurb: string
  /** 楼栋局部坐标：店铺矩形（含墙）。 */
  rect: Rect
  /** 门面所在的外墙。 */
  side: Side
  /** 门在立面上的位置：楼栋局部沿墙坐标（和 Opening.a 同一套）。 */
  doorA: number
  /** 门宽。 */
  doorWidth: number
  /**
   * 店铺落在首层的哪个门厅（板楼有多个单元）。
   * 楼壳按"门厅归属"给首层留空，所以进店时要把这一整个门厅的首层玻璃
   * 从背景楼壳里剪掉，否则会和室内门面的玻璃叠成两层。
   */
  core: number
  palette: { wall: string; floor: string; accent: string; awning: string }
  vendor: { name: string; role: string; lines: string[] }
  items: ShopItem[]
  /** 营业时间，写在面板上。 */
  hours: string
}

type Spec = {
  id: string
  name: string
  kind: ShopKind
  buildingId: string
  side: Side
  /** 店铺沿立面的区间（楼栋局部沿墙坐标）。 */
  from: number
  to: number
  /** 进深：从外墙内皮往楼里量。 */
  depth?: number
  /** 门中心离区间左端多远（默认正中）。 */
  doorOffset?: number
  doorWidth?: number
  blurb: string
  palette: ShopDef['palette']
  vendor: ShopDef['vendor']
  items: ShopItem[]
  hours: string
}

/** 店铺进深默认 5.2m：够摆一排货架 + 一条走道 + 柜台，又不至于吃掉整个门厅。 */
const DEPTH = 5.2

const SPECS: Spec[] = [
  {
    id: 'shop-bakery',
    name: '麦穗面包房',
    kind: 'bakery',
    buildingId: 'west-residence',
    side: 's',
    from: -22.4,
    to: -15.4,
    blurb: '五点开炉的老面包房，柜台上永远有一盘刚出炉的盐可颂',
    palette: { wall: '#e8dcc6', floor: '#a98c6b', accent: '#b4763f', awning: '#c4713f' },
    hours: '06:00 – 19:00',
    vendor: {
      name: '麦姨',
      role: '麦穗面包房 · 店主',
      lines: [
        '五点第一炉，九点第二炉。想吃盐可颂就早点来，十点以后基本没有了。',
        '这条巷子里就我们家和隔壁花店起得最早，天没亮就开灯。',
        '面团是昨晚发的，你看这个气孔——机器揉不出来。',
      ],
    },
    items: [
      { name: '盐可颂', price: '12', note: '每天限 40 个，九点出炉' },
      { name: '黑麦酸种', price: '28', note: '整条，切片不另收费' },
      { name: '肉桂卷', price: '16', note: '周六才做' },
      { name: '豆浆（热的）', price: '6', note: '自家磨，不加糖' },
    ],
  },
  {
    id: 'shop-florist',
    name: '拾花',
    kind: 'florist',
    buildingId: 'harbor-hotel',
    side: 's',
    from: 4.2,
    to: 11.4,
    blurb: '水桶排在地上的小花店，按枝卖，也接酒店前台的瓶插',
    palette: { wall: '#e6e9de', floor: '#b9af9c', accent: '#7f9a6a', awning: '#6f8f76' },
    hours: '09:00 – 21:00',
    vendor: {
      name: '阿禾',
      role: '拾花 · 店主',
      lines: [
        '今天的洋桔梗很好，杆子硬，能插一周多。',
        '酒店前台每周要换两次瓶插，所以这个点我都在捆花。',
        '你要送人的话我给你包牛皮纸，不用额外加钱。',
      ],
    },
    items: [
      { name: '洋桔梗（一枝）', price: '9', note: '白 / 香槟 / 淡紫三色' },
      { name: '尤加利（一把）', price: '18', note: '晾干可以一直挂着' },
      { name: '牛皮纸手打花束', price: '68', note: '按当日花材配' },
      { name: '酒店瓶插（周订）', price: '120', note: '每周二、五送' },
    ],
  },
  {
    id: 'shop-konbini',
    name: '凌晨便利店',
    kind: 'konbini',
    buildingId: 'north-tower',
    side: 's',
    from: 4.4,
    to: 12.6,
    blurb: '24 小时，关东煮和热饮一直在，塔里加班的人都知道',
    palette: { wall: '#dfe6ea', floor: '#9aa7ae', accent: '#3f7f9a', awning: '#2f6d86' },
    hours: '24 小时',
    vendor: {
      name: '小唐',
      role: '凌晨便利店 · 夜班',
      lines: [
        '关东煮还有萝卜和竹轮，汤是新换的。',
        '这座塔二十层往上都是住户，半夜下来买热饮的基本都是刚下班的。',
        '门口那个冰柜别拍，压缩机老了，拍一下就嗡嗡响。',
      ],
    },
    items: [
      { name: '关东煮（三串）', price: '15', note: '萝卜 / 竹轮 / 豆腐' },
      { name: '热美式', price: '10', note: '机器现磨，24 小时' },
      { name: '饭团', price: '8', note: '明太子 / 鲑鱼 / 梅子' },
      { name: '一次性雨伞', price: '25', note: '下雨天放在门口自取' },
    ],
  },
  {
    id: 'shop-zine',
    name: '中巷纸品',
    kind: 'zine',
    buildingId: 'midtown',
    side: 'w',
    from: 2.6,
    to: 9.4,
    blurb: '独立杂志、版画和文房，墙上贴满了历年的展览海报',
    palette: { wall: '#e5e2d8', floor: '#8e8a7d', accent: '#5f6f8a', awning: '#59616e' },
    hours: '11:00 – 20:00 · 周一休',
    vendor: {
      name: '林舟',
      role: '中巷纸品 · 店主',
      lines: [
        '最里面那排是本地作者自己印的，卖完就不再版。',
        '版画是我自己刻的，用的是木板，不是数字输出。',
        '你要找上一期的话翻一翻架子最下层，那堆还没整理。',
      ],
    },
    items: [
      { name: '《中巷》第 7 期', price: '45', note: '本地作者合集，印 300 本' },
      { name: '木板版画（小幅）', price: '160', note: '手工印，每张略有差别' },
      { name: '方格笔记本', price: '32', note: 'A5，可以平摊' },
      { name: '展览海报（旧）', price: '0', note: '门口自取，一人一张' },
    ],
  },
  {
    id: 'shop-record',
    name: '转针黑胶',
    kind: 'record',
    buildingId: 'soundfield',
    side: 'w',
    from: 3.0,
    to: 9.4,
    blurb: '二手黑胶按字母排，店里有一台可以试听的唱机',
    palette: { wall: '#3b3a3d', floor: '#5b4f45', accent: '#c08a4f', awning: '#2f3033' },
    hours: '13:00 – 22:00',
    vendor: {
      name: '老周',
      role: '转针黑胶 · 店主',
      lines: [
        '二手盘都洗过，试听随意，唱针我换过新的。',
        '爵士在左边，电子在里屋，最里面那箱是别人寄卖的。',
        '楼上声场唱片跟我不是一家，别把他们的价格拿来问我。',
      ],
    },
    items: [
      { name: '二手爵士 LP', price: '80 起', note: '按品相定价，可试听' },
      { name: '本地厂牌电子 12"', price: '120', note: '压片 200 张' },
      { name: '唱针清洁刷', price: '35', note: '碳纤维' },
      { name: '寄卖（抽 20%）', price: '—', note: '一次最多 10 张' },
    ],
  },
  {
    id: 'shop-noodle',
    name: '南岸面馆',
    kind: 'noodle',
    buildingId: 'south-east',
    side: 's',
    from: 2.6,
    to: 9.4,
    blurb: '六张桌子的面馆，汤底熬一整天，过点就卖完',
    palette: { wall: '#e6d9c4', floor: '#8d7358', accent: '#a4462f', awning: '#8f3f2c' },
    hours: '11:00 – 14:30 · 17:00 – 21:00',
    vendor: {
      name: '陈叔',
      role: '南岸面馆 · 掌勺',
      lines: [
        '汤是昨天下午开始熬的，今天卖完就收，不兑水。',
        '面就三种：清汤、红烧、酸辣。想加浇头另说。',
        '中午人多，住户都下来吃，你赶时间就避开十二点半。',
      ],
    },
    items: [
      { name: '清汤牛肉面', price: '26', note: '每天 60 碗' },
      { name: '红烧牛腩面', price: '32', note: '汤头偏甜' },
      { name: '酸辣粉', price: '18', note: '可以要微辣' },
      { name: '加浇头', price: '6 起', note: '卤蛋 / 牛筋 / 青菜' },
    ],
  },
  {
    id: 'shop-tea',
    name: '河风茶室',
    kind: 'tea',
    buildingId: 'riverside',
    side: 'n',
    from: -27.6,
    to: -18.6,
    blurb: '面河的一排窗，只卖三种茶，坐一下午没人赶你',
    palette: { wall: '#e4dfd3', floor: '#8f7d64', accent: '#6a7f6b', awning: '#5d7264' },
    hours: '10:00 – 22:00',
    vendor: {
      name: '阿茉',
      role: '河风茶室 · 主理人',
      lines: [
        '窗外就是河，天气好的时候能看见摩天轮慢慢转。',
        '只有三种茶：白毫、熟普、还有一款随季节换的冷泡。',
        '靠窗那排不接受预订，先到先坐。',
      ],
    },
    items: [
      { name: '白毫银针', price: '38 / 壶', note: '可以续两次水' },
      { name: '熟普', price: '32 / 壶', note: '配一小碟陈皮' },
      { name: '季节冷泡', price: '28', note: '这一季是桂花乌龙' },
      { name: '茶点', price: '15', note: '每日现做，只有一种' },
    ],
  },
]

/**
 * 店在首层的哪个门厅里。板楼一栋有两个单元，店铺只属于其中一个；
 * 找不到就退到 0（塔楼 / 内廊只有一条门厅）。
 */
function coreOf(buildingId: string, r: Rect): number {
  const b = unitBuilding(buildingId)
  if (!b) return 0
  const halls = layoutOf(b, 1).halls
  const i = halls.findIndex(
    (h) => r.x0 >= h.rect.x0 - 0.01 && r.x1 <= h.rect.x1 + 0.01 && r.z0 >= h.rect.z0 - 0.01 && r.z1 <= h.rect.z1 + 0.01,
  )
  return i < 0 ? 0 : i
}

/**
 * 把沿墙区间 + 进深换算成楼栋局部矩形。
 * 这里的 z/x 方向和 shared/units.mjs 的 rect 完全一致：n 面在 -z、s 面在 +z、
 * w 面在 -x、e 面在 +x。
 */
function rectOf(buildingId: string, side: Side, from: number, to: number, depth: number): Rect {
  const b = unitBuilding(buildingId)
  if (!b) return { x0: 0, x1: 0, z0: 0, z1: 0 }
  const W = b.w / 2 - WALL
  const D = b.d / 2 - WALL
  const a0 = Math.min(from, to)
  const a1 = Math.max(from, to)
  switch (side) {
    case 's':
      return { x0: a0, x1: a1, z0: D - depth, z1: D }
    case 'n':
      return { x0: a0, x1: a1, z0: -D, z1: -D + depth }
    case 'e':
      return { x0: W - depth, x1: W, z0: a0, z1: a1 }
    default:
      return { x0: -W, x1: -W + depth, z0: a0, z1: a1 }
  }
}

export const shops: ShopDef[] = SPECS.map((spec) => {
  const rect = rectOf(spec.buildingId, spec.side, spec.from, spec.to, spec.depth ?? DEPTH)
  return {
    id: spec.id,
    name: spec.name,
    kind: spec.kind,
    buildingId: spec.buildingId,
    blurb: spec.blurb,
    rect,
    side: spec.side,
    doorA: spec.from + (spec.doorOffset ?? (spec.to - spec.from) / 2),
    doorWidth: spec.doorWidth ?? 1.8,
    core: coreOf(spec.buildingId, rect),
    palette: spec.palette,
    vendor: spec.vendor,
    items: spec.items,
    hours: spec.hours,
  }
})

export const shopById: Record<string, ShopDef> = Object.fromEntries(shops.map((s) => [s.id, s]))

/** 楼栋局部 → 世界坐标。 */
export function shopWorld(shop: ShopDef): { x: number; z: number; cx: number; cz: number } {
  const def = buildingById[shop.buildingId]
  const r = shop.rect
  return {
    x: (r.x0 + r.x1) / 2 + (def?.x ?? 0),
    z: (r.z0 + r.z1) / 2 + (def?.z ?? 0),
    cx: def?.x ?? 0,
    cz: def?.z ?? 0,
  }
}

/** 店门在街上的位置（门外 1.1m）和朝向：气泡、交互点都放这儿。 */
export function shopDoor(shop: ShopDef): { x: number; z: number; yaw: number } {
  const def = buildingById[shop.buildingId]
  const b = unitBuilding(shop.buildingId)
  const out = WALL + 1.1
  const cx = def?.x ?? 0
  const cz = def?.z ?? 0
  const W = (b?.w ?? 0) / 2
  const D = (b?.d ?? 0) / 2
  switch (shop.side) {
    case 's':
      return { x: cx + shop.doorA, z: cz + D + out, yaw: 0 }
    case 'n':
      return { x: cx + shop.doorA, z: cz - D - out, yaw: Math.PI }
    case 'e':
      return { x: cx + W + out, z: cz + shop.doorA, yaw: -Math.PI / 2 }
    default:
      return { x: cx - W - out, z: cz + shop.doorA, yaw: Math.PI / 2 }
  }
}

/**
 * 店面的立面坐标系：原点在店面外墙中心，局部 +Z 朝街外，局部 +X 沿墙。
 * 门头装饰（雨棚、招牌、门口的地堆）都按这个坐标系摆，换楼换面不用改。
 */
export type ShopFacade = { x: number; z: number; yaw: number; width: number; doorX: number }

export function shopFacade(shop: ShopDef): ShopFacade {
  const def = buildingById[shop.buildingId]
  const b = unitBuilding(shop.buildingId)
  const cx = def?.x ?? 0
  const cz = def?.z ?? 0
  const W = (b?.w ?? 0) / 2
  const D = (b?.d ?? 0) / 2
  const mid = (shop.rect.x0 + shop.rect.x1) / 2
  const midZ = (shop.rect.z0 + shop.rect.z1) / 2
  if (shop.side === 's') {
    return { x: cx + mid, z: cz + D, yaw: 0, width: shop.rect.x1 - shop.rect.x0, doorX: shop.doorA - mid }
  }
  if (shop.side === 'n') {
    return { x: cx + mid, z: cz - D, yaw: Math.PI, width: shop.rect.x1 - shop.rect.x0, doorX: mid - shop.doorA }
  }
  if (shop.side === 'e') {
    return { x: cx + W, z: cz + midZ, yaw: Math.PI / 2, width: shop.rect.z1 - shop.rect.z0, doorX: shop.doorA - midZ }
  }
  return { x: cx - W, z: cz + midZ, yaw: -Math.PI / 2, width: shop.rect.z1 - shop.rect.z0, doorX: shop.doorA - midZ }
}

/** 这一栋楼首层的所有店铺：大堂里要给它们留出背墙。 */
export function shopsInBuilding(buildingId: string): ShopDef[] {
  return shops.filter((s) => s.buildingId === buildingId)
}

/** 面板上的一行营业状态：营业中 / 已打烊。 */
export function openNow(shop: ShopDef, hour = new Date().getHours()): boolean {
  if (shop.kind === 'konbini') return true
  const [a, b] = shop.hours.split('–').map((t) => Number(t.trim().slice(0, 2)))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true
  return hour >= a && hour < b
}

/** 首层平面：拿到门厅矩形，校验店铺确实落在门厅内侧（调试用，运行时不用）。 */
export function shopInsideHall(shop: ShopDef): boolean {
  const b = unitBuilding(shop.buildingId)
  if (!b) return false
  const halls = layoutOf(b, 1).halls
  const r = shop.rect
  return halls.some(
    (h) => r.x0 >= h.rect.x0 - 0.01 && r.x1 <= h.rect.x1 + 0.01 && r.z0 >= h.rect.z0 - 0.01 && r.z1 <= h.rect.z1 + 0.01,
  )
}
