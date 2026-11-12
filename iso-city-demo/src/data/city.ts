export type BuildingStyle = 'stone' | 'glass' | 'metal' | 'brick'

export type BuildingDef = {
  id: string
  name: string
  x: number
  z: number
  w: number
  d: number
  h: number
  style: BuildingStyle
  body: string
  trim: string
  roof: 'mechanical' | 'garden' | 'antenna' | 'plain' | 'crown'
  setback?: boolean
  balconies?: boolean
  sign?: string
  signColor?: string
  entranceSide?: 'north' | 'south' | 'east' | 'west'
  /** 面向街道的一侧（程序化街区用来挂店面和雨棚） */
  facing?: 'north' | 'south' | 'east' | 'west'
  entranceAt?: [number, number]
  target?: { kind: 'public'; id: 'gallery' | 'cafe' } | { kind: 'space'; id: string }
  entranceLabel?: string
  entranceUse?: string
  landmark?: boolean
  background?: boolean
  accent?: string
  taper?: number
  /**
   * 背景楼的造型（只对 background 楼生效）：
   * walkup 砖砌老公寓（深色檐口 + 屋顶水塔 + 消防梯），
   * deco 多级退台的装饰艺术塔楼（顶上一根尖塔），
   * billboard 临街面铺满 LED 广告屏的商业楼，
   * estate 居民小区楼（同一小区高度、颜色、朝向统一，坡屋顶、无底商）。
   */
  form?: 'walkup' | 'deco' | 'billboard' | 'estate' | 'rowhouse' | 'warehouse'
  /** 规划器挪过位置（只做记录，渲染与逻辑不依赖它）。 */
  lotShifted?: boolean
}

// 微光城区总平面：主街南北贯通，西侧是镜池广场，东侧是回声巷。
// 外围增加第二圈街区（西岸大道 / 南横街 / 东岸大道），让城市有真正的纵深可走。
export const CITY_BOUNDS = 148

/** 联排小楼的外墙色：奶油、鼠尾草绿、灰蓝、陶土、芥末黄、砖红、薄荷、雾粉 */
export const ROW_BODIES = ['#d9c7a3', '#93a68a', '#7d8ea3', '#b97a5a', '#c9a24e', '#9c5544', '#8fb3a5', '#c9978f']

// 可行走范围比 CITY_BOUNDS 大一圈：外围还有一圈街区，原来 ±148 的边界
// 正好切在这些楼的外墙内侧，走到城边就撞上一堵看不见的墙。
// 路面也一并拉到 ROUND_END，车行道才能真正通到外圈的楼。
// 城市外扩：沿街楼和居民小区排到 ±385（见 infill.ts 的 INFILL_EDGE）
export const WALK_BOUNDS = 392
/** 五条车行道的半长。 */
const ROAD_HALF = 400

export const buildings: BuildingDef[] = [
  {
    id: 'gallery',
    name: '光盒美术馆',
    x: -59,
    z: 8,
    w: 22,
    d: 30,
    h: 19,
    style: 'stone',
    body: '#cfd7de',
    trim: '#93a2b0',
    roof: 'garden',
    setback: true,
    sign: 'LUMA',
    signColor: '#1d3d4c',
    entranceSide: 'east',
    entranceAt: [-47.1, 8],
    target: { kind: 'public', id: 'gallery' },
    entranceLabel: '光盒美术馆',
    entranceUse: '公共展厅 · 可进入',
    accent: '#ffd4a2',
  },
  {
    id: 'riverside',
    name: '河岸公寓',
    // 江景板楼：沿河横向铺开（75m 宽太长，社区里收成 58m），北面朝河。
    x: -48,
    z: 114,
    w: 58,
    d: 14,
    h: 62,
    style: 'metal',
    body: '#c4ccd6',
    trim: '#7f8f9f',
    roof: 'mechanical',
    setback: true,
    balconies: true,
    sign: 'RIVERSIDE',
    signColor: '#1c3444',
    entranceSide: 'north',
    entranceAt: [-48, 106.7],
    target: { kind: 'space', id: 'river-loft' },
    entranceLabel: '河岸公寓',
    entranceUse: '07F · 河岸小屋',
  },
  {
    id: 'soundfield',
    name: '声场唱片',
    x: 40,
    z: -36,
    w: 24,
    d: 20,
    h: 15,
    style: 'brick',
    body: '#96a5b3',
    trim: '#6d7d8d',
    roof: 'antenna',
    sign: 'SOUND FIELD',
    signColor: '#122e3a',
    entranceSide: 'west',
    entranceAt: [26.6, -36],
    target: { kind: 'space', id: 'sound-room' },
    entranceLabel: '声场唱片',
    entranceUse: 'B1 · 静音工作室',
    accent: '#ffe0b8',
  },
  {
    id: 'cafe',
    name: '街角咖啡',
    x: 35,
    z: 27,
    w: 14,
    d: 12,
    h: 5.4,
    style: 'stone',
    body: '#cfd4d2',
    trim: '#95a09f',
    roof: 'garden',
    sign: 'CORNER',
    signColor: '#3a2a1e',
    entranceSide: 'west',
    entranceAt: [27.2, 27],
    target: { kind: 'public', id: 'cafe' },
    entranceLabel: '街角咖啡',
    entranceUse: '公共室内 · 可进入',
    accent: '#ffc98f',
  },
  {
    id: 'midtown',
    name: '中巷工作室',
    x: 36,
    z: -8,
    w: 16,
    d: 20,
    h: 12,
    style: 'brick',
    body: '#a8b3bd',
    trim: '#7b8894',
    roof: 'mechanical',
    sign: 'MIDTOWN',
    signColor: '#20323f',
    entranceSide: 'west',
    entranceAt: [26.6, -8],
  },
  {
    // —— 以下为外围布景楼：只有体量与立面，不能进入 ——
    id: 'lumen-tower',
    name: '微光塔',
    x: -116,
    z: -132,
    background: true,
    w: 34,
    d: 34,
    h: 58,
    style: 'glass',
    body: '#7fa3b6',
    trim: '#4f7186',
    roof: 'crown',
    setback: true,
    taper: 0.22,
    landmark: true,
    sign: 'LUMEN',
    signColor: '#0d2733',
    accent: '#ffcf9c',
  },
  {
    id: 'office-east',
    form: 'deco',
    name: '东岸办公楼',
    x: 96,
    z: -110,
    background: true,
    w: 22,
    d: 34,
    h: 48,
    style: 'glass',
    body: '#8fabba',
    trim: '#5c7b8d',
    roof: 'mechanical',
    setback: true,
  },
  {
    id: 'west-residence',
    name: '雪松公寓',
    // 复古板楼：雪松巷北侧，东西向，朝南。52 × 14m，7 层。
    x: -55,
    z: -52,
    w: 48,
    d: 14,
    h: 25,
    style: 'stone',
    body: '#cbd3da',
    trim: '#8f9eac',
    roof: 'garden',
    balconies: true,
    entranceSide: 'south',
    entranceAt: [-55, -43.6],
  },
  {
    id: 'north-office',
    name: '北岸中心',
    x: -108,
    z: -96,
    background: true,
    w: 30,
    d: 22,
    h: 34,
    style: 'metal',
    body: '#bcc7d2',
    trim: '#8493a2',
    roof: 'mechanical',
    setback: true,
  },
  {
    id: 'east-north',
    form: 'walkup',
    name: '东仓',
    x: 118,
    z: -76,
    background: true,
    w: 24,
    d: 20,
    h: 30,
    style: 'brick',
    body: '#9aa8b5',
    trim: '#72808e',
    roof: 'antenna',
  },
  {
    id: 'south-west',
    name: '南园住宅',
    // 横街与河岸之间只剩一条 9m 的滨水带，做成低矮的船屋尺度
    x: -124,
    z: 65.5,
    background: true,
    w: 24,
    d: 9,
    h: 23,
    style: 'stone',
    body: '#cdd5dc',
    trim: '#94a2b0',
    roof: 'garden',
    balconies: true,
  },
  {
    id: 'south-east',
    name: '青年公寓',
    // 青年公寓：短内廊 + 公共客厅，10 层，每层 10 户小户型。
    x: 68,
    z: -30,
    w: 20,
    d: 32,
    h: 35,
    style: 'metal',
    body: '#c3ccd6',
    trim: '#8998a6',
    roof: 'mechanical',
    entranceSide: 'south',
    entranceAt: [68, -12.6],
  },
  {
    id: 'west-market',
    form: 'walkup',
    name: '西岸市场',
    x: -128,
    z: 18,
    background: true,
    w: 26,
    d: 32,
    h: 21,
    style: 'stone',
    body: '#c8d0d8',
    trim: '#8d9bab',
    roof: 'garden',
    sign: 'WEST MARKET',
    signColor: '#243240',
    accent: '#ffd49b',
  },
  {
    id: 'harbor-hotel',
    name: '港湾酒店',
    // 酒店：广场东侧，内廊标间，做新手临时房。
    // 面宽收成 30m：咖啡店与东岸大道之间只有 36m 的净空，
    // 32m 加上退台就摆不下 4.5m 的楼间距。
    x: 64,
    z: 18,
    w: 30,
    d: 22,
    h: 42,
    style: 'stone',
    body: '#b9c3cc',
    trim: '#7d8c99',
    roof: 'mechanical',
    setback: true,
    entranceSide: 'south',
    entranceAt: [64, 30.4],
    sign: 'HARBOR',
    signColor: '#1a2c38',
  },
  {
    id: 'north-tower',
    name: '北塔',
    // 高层塔楼：广场正北，一梯六户，28 层。
    x: 33,
    z: -68,
    w: 30,
    d: 28,
    h: 96,
    style: 'glass',
    body: '#7e9db0',
    trim: '#4e6f84',
    roof: 'mechanical',
    setback: true,
    entranceSide: 'south',
    entranceAt: [33, -52.6],
  },
  {
    id: 'lab-east',
    name: '东岸研究所',
    x: 104,
    z: -140,
    background: true,
    w: 28,
    d: 24,
    h: 44,
    style: 'metal',
    body: '#aebbc8',
    trim: '#7b8b9b',
    roof: 'mechanical',
    setback: true,
  },
  {
    id: 'arena',
    name: '回声剧场',
    x: 128,
    z: -40,
    background: true,
    w: 30,
    d: 36,
    h: 26,
    style: 'stone',
    body: '#c1cbd6',
    trim: '#8695a6',
    roof: 'plain',
    sign: 'ECHO HALL',
    signColor: '#1a2b3a',
    accent: '#ffb984',
  },
  {
    id: 'east-mall',
    form: 'billboard',
    name: '东岸商场',
    x: 126,
    z: 20,
    background: true,
    w: 28,
    d: 34,
    h: 40,
    style: 'glass',
    body: '#88a8bb',
    trim: '#5a7d92',
    roof: 'mechanical',
    setback: true,
    sign: 'EAST ARCADE',
    signColor: '#122c3b',
  },
  {
    id: 'south-tower',
    form: 'deco',
    name: '回声塔',
    x: -20,
    z: -140,
    background: true,
    w: 38,
    d: 38,
    h: 64,
    style: 'glass',
    body: '#7b9cb2',
    trim: '#4c6f86',
    roof: 'crown',
    setback: true,
    taper: 0.16,
    landmark: true,
    sign: 'ECHO',
    signColor: '#0b2431',
    accent: '#ffdcae',
  },
  {
    id: 'old-station',
    name: '旧车站',
    x: -56,
    z: 136,
    background: true,
    w: 38,
    d: 24,
    h: 18,
    style: 'stone',
    body: '#cfd6dc',
    trim: '#97a4b1',
    roof: 'plain',
    sign: 'CENTRAL',
    signColor: '#1c2c3a',
    accent: '#ffd9a6',
    balconies: false,
  },
  {
    id: 'garden-flats',
    name: '花园公寓',
    x: -124,
    z: 121,
    background: true,
    w: 26,
    d: 32,
    h: 44,
    style: 'stone',
    body: '#cad3db',
    trim: '#8f9fae',
    roof: 'garden',
    balconies: true,
  },
  {
    id: 'south-block',
    name: '南岸塔楼',
    x: 128,
    z: 114,
    background: true,
    w: 26,
    d: 28,
    h: 58,
    style: 'metal',
    body: '#b3bfcb',
    trim: '#8090a0',
    roof: 'mechanical',
  },
  {
    id: 'north-block',
    form: 'walkup',
    name: '北街公寓',
    x: 132,
    z: -104,
    background: true,
    w: 24,
    d: 26,
    h: 38,
    style: 'stone',
    body: '#c9d2da',
    trim: '#8e9dac',
    roof: 'garden',
    balconies: true,
  },
]

// 远景楼群，只负责轮廓和空气透视
export const skyline: Array<{
  x: number
  z: number
  w: number
  d: number
  h: number
  color: string
}> = [
  { x: -196, z: -60, w: 30, d: 42, h: 78, color: '#243445' },
  { x: -186, z: 44, w: 24, d: 30, h: 46, color: '#1d2c3b' },
  { x: -178, z: 148, w: 32, d: 34, h: 62, color: '#213140' },
  { x: -40, z: -196, w: 40, d: 28, h: 92, color: '#243546' },
  { x: 46, z: -204, w: 30, d: 32, h: 74, color: '#1f3040' },
  { x: 172, z: -148, w: 34, d: 30, h: 58, color: '#223343' },
  { x: 196, z: -20, w: 30, d: 38, h: 96, color: '#1e2f3f' },
  { x: 186, z: 96, w: 28, d: 30, h: 52, color: '#253646' },
  { x: 128, z: 202, w: 36, d: 28, h: 68, color: '#203041' },
  { x: 12, z: 214, w: 30, d: 26, h: 48, color: '#243444' },
  { x: -130, z: 206, w: 34, d: 28, h: 56, color: '#223242' },
  { x: -212, z: 128, w: 26, d: 30, h: 40, color: '#1f2e3d' },
  { x: -120, z: -150, w: 30, d: 26, h: 50, color: '#243546' },
  { x: 120, z: -200, w: 26, d: 28, h: 64, color: '#213141' },
]

export const mainStreet = { x: 0, z: 0, w: 22, d: ROAD_HALF * 2 }
export const crossStreet = { x: 0, z: 45, w: ROAD_HALF * 2, d: 20 }
export const southCross = { x: 0, z: -95, w: ROAD_HALF * 2, d: 16 }
export const westAvenue = { x: -92, z: 0, w: 16, d: ROAD_HALF * 2 }
export const eastAvenue = { x: 92, z: 0, w: 16, d: ROAD_HALF * 2 }
// 东边收到 x=-11，正好是主街车行道的边；再往东就压到车道上了，
// 广场铺装比路面高 6cm，车流经过时车身会穿进这块板里。
export const plaza = { x: -29, z: 6, w: 36, d: 54 }
export const cedarLane = { x: -20, z: -22, w: 56, d: 10 }
export const alley = { x: 21, z: -2, w: 12, d: 44 }
export const alleyMouth = { x: 11, z: 0, w: 8, d: 8 }

export type RoadRect = { x0: number; x1: number; z0: number; z1: number }

const rectOfRoad = (s: { x: number; z: number; w: number; d: number }): RoadRect => ({
  x0: s.x - s.w / 2,
  x1: s.x + s.w / 2,
  z0: s.z - s.d / 2,
  z1: s.z + s.d / 2,
})

/** 五条车行道（不含人行道）。路灯、树、长椅、楼、车流都不该落在里面。 */
export const roadRects: RoadRect[] = [mainStreet, crossStreet, southCross, westAvenue, eastAvenue].map(rectOfRoad)

/**
 * 点位是否落在车行道上。
 *
 * 城市数据是手写的，坐标难免有几处压在路面上：路灯长在车道中央、长椅摆在
 * 十字路口中间。这些道具人走过去不觉得，但车流是沿固定车道跑的，一眼就能
 * 看出"车穿过了路灯"。所以道具在渲染前用这个判一遍，压线的直接不显示。
 */
export function insideRoad(x: number, z: number, pad = 0): boolean {
  for (const r of roadRects) {
    if (x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 城市规划
// ---------------------------------------------------------------------------
//
// 手写坐标难免有几栋楼压在车道上（地图两端最明显），也有几栋楼只隔 1m，
// 走过去像在挤缝。与其一栋一栋改坐标，不如把"退线"变成一条规则：
// 楼离开车道边至少 WALK_MARGIN（人行道 + 退距），楼与楼之间至少 MIN_GAP。
// 这一步在模块加载时跑一次，之后的街面、碰撞、车流、行人都用修正后的坐标。

/** 车道边到建筑外墙的距离：4m 人行道 + 1.5m 退距。 */
const WALK_MARGIN = 5.5
/** 两栋楼之间的最小净距。 */
const MIN_GAP = 4.5

type PlanRect = { x0: number; x1: number; z0: number; z1: number }

/**
 * 楼的实际占地：除了主体，还要算上阳台的挑出。
 * 只按主体墙体算间距，就会出现"两栋楼主体差 4.5m、阳台却快碰上了"。
 */
function facadeOverhang(b: BuildingDef) {
  return b.balconies ? 1.3 : 0
}

const planRectOf = (b: BuildingDef): PlanRect => {
  const pad = facadeOverhang(b)
  return {
    x0: b.x - b.w / 2 - pad,
    x1: b.x + b.w / 2 + pad,
    z0: b.z - b.d / 2 - pad,
    z1: b.z + b.d / 2 + pad,
  }
}

const planOverlap = (a: PlanRect, b: PlanRect) =>
  a.x0 < b.x1 - 1e-3 && a.x1 > b.x0 + 1e-3 && a.z0 < b.z1 - 1e-3 && a.z1 > b.z0 + 1e-3

/** 把 a 推离 b 所需的最小位移（四个方向里挑最短的一条）。 */
function separation(a: PlanRect, b: PlanRect): { dx: number; dz: number } | null {
  if (!planOverlap(a, b)) return null
  const left = b.x0 - a.x1
  const right = b.x1 - a.x0
  const north = b.z0 - a.z1
  const south = b.z1 - a.z0
  const moves = [
    { dx: left, dz: 0 },
    { dx: right, dz: 0 },
    { dx: 0, dz: north },
    { dx: 0, dz: south },
  ]
  return moves.sort((p, q) => Math.abs(p.dx) + Math.abs(p.dz) - (Math.abs(q.dx) + Math.abs(q.dz)))[0]
}

/**
 * 按路网把楼摆正。
 *
 * 顺序是贪心的：楼表里靠前的先占位，后面的让位。每次只移动"后来者"，
 * 所以不会出现两栋楼互相推来推去、每一轮都换一个方向的情况。
 * 原地修改 buildings（连同 entranceAt 一起平移），入口光门与可进入的标记
 * 不用重新标坐标。
 */
function planStreets(list: BuildingDef[], extraZones: PlanRect[] = []) {
  const roadZones: PlanRect[] = [
    ...roadRects.map((r) => ({
      x0: r.x0 - WALK_MARGIN,
      x1: r.x1 + WALK_MARGIN,
      z0: r.z0 - WALK_MARGIN,
      z1: r.z1 + WALK_MARGIN,
    })),
    ...extraZones,
  ]
  const onRoad = (r: PlanRect) => roadZones.some((zone) => planOverlap(r, zone))

  const move = (r: PlanRect, dx: number, dz: number): PlanRect => ({
    x0: r.x0 + dx,
    x1: r.x1 + dx,
    z0: r.z0 + dz,
    z1: r.z1 + dz,
  })

  /** 把 r 挪到不压车道；几个方向里挑位移最小的。
      一条街对面还是街（河边尤其常见），所以要把所有车道都解干净，不能只解一圈。 */
  const offRoad = (r: PlanRect): PlanRect => {
    let cur = r
    for (let i = 0; i < 12 && onRoad(cur); i++) {
      let best: { rect: PlanRect; cost: number } | null = null
      for (const zone of roadZones) {
        if (!planOverlap(cur, zone)) continue
        // 四条出路：贴到这条路的四个外沿之外
        for (const cand of [
          move(cur, zone.x0 - cur.x1, 0),
          move(cur, zone.x1 - cur.x0, 0),
          move(cur, 0, zone.z0 - cur.z1),
          move(cur, 0, zone.z1 - cur.z0),
        ]) {
          const cost = Math.abs(cand.x0 - cur.x0) + Math.abs(cand.z0 - cur.z0)
          if (!best || cost < best.cost) best = { rect: cand, cost }
        }
      }
      if (!best) break
      cur = best.rect
    }
    return cur
  }

  let placed: PlanRect[] = []
  for (const b of list) {
    const startX = b.x
    const startZ = b.z
    let rect = offRoad(planRectOf(b))
    // 离已经摆好的楼太近就让位：同样挑位移最小的那一条出路
    for (let pass = 0; pass < 24; pass++) {
      // 判定框要往外扩"整个" MIN_GAP（不是一半）：扩一半的话，
      // 推开时两者只是刚好不重叠，实际净距只剩 MIN_GAP/2。
      const half: PlanRect = {
        x0: rect.x0 - MIN_GAP,
        x1: rect.x1 + MIN_GAP,
        z0: rect.z0 - MIN_GAP,
        z1: rect.z1 + MIN_GAP,
      }
      let clash: PlanRect | null = null
      for (const other of placed) {
        if (planOverlap(half, other)) {
          clash = other
          break
        }
      }
      if (!clash) break
      let best: { rect: PlanRect; cost: number } | null = null
      for (const cand of [
        move(rect, clash.x0 - MIN_GAP - rect.x1, 0),
        move(rect, clash.x1 + MIN_GAP - rect.x0, 0),
        move(rect, 0, clash.z0 - MIN_GAP - rect.z1),
        move(rect, 0, clash.z1 + MIN_GAP - rect.z0),
      ]) {
        const settled = offRoad(cand)
        const cost = Math.abs(settled.x0 - rect.x0) + Math.abs(settled.z0 - rect.z0)
        // 让完之后还得检查是否撞上别的楼、是否又落回车道
        const half2 = {
          x0: settled.x0 - MIN_GAP,
          x1: settled.x1 + MIN_GAP,
          z0: settled.z0 - MIN_GAP,
          z1: settled.z1 + MIN_GAP,
        }
        const extra = placed.filter((o) => planOverlap(half2, o)).length * 4000
        const road = onRoad(settled) ? 1e7 : 0
        const total = cost + extra + road
        if (!best || total < best.cost) best = { rect: settled, cost: total }
      }
      if (!best) break
      rect = best.rect
    }
    const dx = (rect.x0 + rect.x1) / 2 - startX
    const dz = (rect.z0 + rect.z1) / 2 - startZ
    if (Math.abs(dx) > 1e-3 || Math.abs(dz) > 1e-3) {
      b.x += dx
      b.z += dz
      if (b.entranceAt) b.entranceAt = [b.entranceAt[0] + dx, b.entranceAt[1] + dz]
      b.lotShifted = true
    }
    placed = [...placed, planRectOf(b)]
  }
}



export const trees: Array<[number, number, number?]> = [
  [-42, -20, 1.1],
  [-41, 16, 1.25],
  [-35, 22, 0.95],
  [-14, -22, 0.9],
  [-14, 22, 1.05],
  [-46, -8, 0.85],
  [-46, 9, 0.9],
  [10, -12, 0.8],
  [10, 18, 0.82],
  [43, 40, 1.0],
  [33, 42, 0.9],
  [-10, 42, 0.95],
  [-10, 51, 0.9],
  [-58, -30, 0.85],
  [12, -51, 0.9],
  [-56, 70, 1.0],
  [4, 62, 0.9],
  [82, 60, 1.05],
  [82, 34, 0.95],
  [-84, 70, 1.0],
  [-82, -72, 0.9],
  [82, -80, 0.95],
  [104, 42, 0.9],
  [-104, 62, 0.85],
  [-104, -20, 1.0],
  [-14, -70, 0.9],
  [14, -70, 0.9],
  [-30, 62, 0.9],
  [18, 62, 0.9],
  [42, 62, 0.95],
  [-74, 130, 0.9],
]

export const lamps: Array<[number, number]> = [
  [-12.8, -80],
  [-12.8, -54],
  [-12.8, -28],
  [-12.8, -8],
  [-12.8, 20],
  [-12.8, 62],
  [-12.8, 68],
  [12.8, -86],
  [12.8, -58],
  [12.8, -30],
  [12.8, -6],
  [12.8, 24],
  [12.8, 64],
  [12.8, 68],
  [-44, 25],
  [-30, 25],
  [-18, 25],
  [-44, -25],
  [-30, -25],
  [-8, 32],
  [-8, -8],
  [-8, 70],
  [16, 40],
  [30, 40],
  [56, 40],
  [-42, 40],
  [-82, 36],
  [-82, 54],
  [82, 34],
  [82, 58],
  [-100, 8],
  [-100, -18],
  [100, 8],
  [100, -18],
  [-20, -92],
  [20, -92],
  [-20, 62],
  [20, 62],
  // 滨水线：北岸步道上一排灯，夜里把水面和摩天轮的基座一起照亮。
  // 没有这排灯时，河面只有环境反射，站在岸上几乎看不出那里有水。
  [-80, 71],
  [-52, 71],
  [-26, 71],
  [20, 71],
  [50, 71],
  [78, 71],
]

export const benches: Array<[number, number, number]> = [
  [-34, 11, 0],
  [-22, 11, 0],
  [-27, 2.2, Math.PI],
  [-16, -17, Math.PI / 2],
  [-45, -18, Math.PI / 2],
  [22, 12, 0.2],
  [18, 20, 0],
  [40, 54, -1.1],
  [-17, 40, Math.PI / 2],
  [17, 40, -Math.PI / 2],
  [-60, 30, 0],
  [-60, -14, 0],
  [66, 40, Math.PI],
  [-8, 66, Math.PI / 2],
]

export const cars: Array<{ x: number; z: number; rot: number; color: string }> = [
  { x: -8.2, z: -128, rot: 0, color: '#9db0c2' },
  { x: -8.2, z: 76, rot: 0, color: '#c6d2dc' },
  { x: 8.2, z: -64, rot: Math.PI, color: '#6f879b' },
  { x: 8.2, z: 108, rot: Math.PI, color: '#a9b8c6' },
  { x: -44, z: 62, rot: -Math.PI / 2, color: '#8ea1b3' },
  { x: 62, z: 39.4, rot: Math.PI / 2, color: '#c1ced9' },
  { x: -118, z: 36, rot: 0, color: '#95a8ba' },
]

export const planters: Array<[number, number, number]> = [
  [-40, 10, 2.2],
  [-40, 2, 2.2],
  [-14, 10, 1.8],
  [-14, 2, 1.8],
  [13.5, -44, 1.7],
  [13.5, 34, 1.6],
  [44, 58, 2.0],
  [-8, 60, 1.6],
  [30, 68, 1.8],
  [70, 50, 1.9],
  [-104, 44, 1.9],
]

export const plazaFountain = { x: -27, z: 6, r: 5.2 }

// —— 社区水系与滨水设施 ——
// 主城原本没有水，钓鱼只能去 OSM 场景。社区南侧加一条东西向的河：
// 江景板楼面朝它，河岸步道、码头、摩天轮连成一条滨水线。

/** 河：z ∈ [74, 100]，主街在桥处跨河。 */
export const river = { x: 0, z: 87, w: 300, d: 26, y: -0.35 }
/** 码头：桥西侧的北岸，上船点。 */
export const dock = { x: -22, z: 71 }
/** 河岸步道：北岸铺装带。 */
export const riverwalk = { z: 70, d: 9 }
/** 桥：主街跨河段。 */
export const bridge = { x: 0, z: 87, w: 22, d: 28 }
/** 跨河的三条竖向车道（主街 + 东西大道）：水面在这里断开，做成路面高度的堤道。 */
export const riverCrossings: Array<{ x: number; w: number }> = [
  { x: -92, w: 16 },
  { x: 0, w: 22 },
  { x: 92, w: 16 },
]
/** 被堤道切开之后的各段水面 [x0, x1]。 */
export const riverSegments: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = []
  let from = river.x - river.w / 2
  for (const c of riverCrossings) {
    const a = c.x - c.w / 2
    if (a - from > 1) out.push([from, a])
    from = c.x + c.w / 2
  }
  const end = river.x + river.w / 2
  if (end - from > 1) out.push([from, end])
  return out
})()
/** 摩天轮：广场西南的滨水线上，直径 60m（半径 30m）。 */
export const ferrisWheel = { x: -62, z: 62, radius: 30 }

/**
 * 点位是否落在水面上。
 *
 * 水面是 z ∈ [river.z - d/2, river.z + d/2]，中间被三条堤道切开。
 * 街道家具（消防栓、垃圾桶、长椅……）以前只判"是否压车道"，滨水那一排在
 * 河道里也照摆不误——站在岸上看就是"垃圾桶泡在水里"。
 */
export function insideWater(x: number, z: number, pad = 0): boolean {
  if (z < river.z - river.d / 2 - pad || z > river.z + river.d / 2 + pad) return false
  for (const [x0, x1] of riverSegments) {
    if (x > x0 - pad && x < x1 + pad) return true
  }
  return false
}

/** 车道：用于动态车流。dir 表示沿轴正方向为 1。 */
export type Lane = {
  axis: 'x' | 'z'
  offset: number
  dir: 1 | -1
  from: number
  to: number
  speed: number
}

export const lanes: Lane[] = [
  { axis: 'z', offset: -8.4, dir: 1, from: -396, to: 396, speed: 11 },
  { axis: 'z', offset: -3.2, dir: 1, from: -396, to: 396, speed: 14 },
  { axis: 'z', offset: 3.2, dir: -1, from: -396, to: 396, speed: 13 },
  { axis: 'z', offset: 8.4, dir: -1, from: -396, to: 396, speed: 10 },
  { axis: 'x', offset: 40.4, dir: -1, from: -396, to: 396, speed: 12 },
  { axis: 'x', offset: 49.6, dir: 1, from: -396, to: 396, speed: 12 },
  { axis: 'x', offset: -99.6, dir: 1, from: -396, to: 396, speed: 10 },
  { axis: 'x', offset: -90.4, dir: -1, from: -396, to: 396, speed: 10 },
  { axis: 'z', offset: -88.5, dir: 1, from: -392, to: 392, speed: 9 },
  { axis: 'z', offset: 88.5, dir: -1, from: -392, to: 392, speed: 9 },
]

/** 行人：主街 / 横街人行道与广场环形步道。 */
export type WalkerRoute =
  | { kind: 'line'; axis: 'x' | 'z'; offset: number; from: number; to: number; speed: number; dir: 1 | -1 }
  | { kind: 'circle'; cx: number; cz: number; r: number; speed: number; dir: 1 | -1 }

export const walkerRoutes: WalkerRoute[] = [
  { kind: 'line', axis: 'z', offset: -11.6, from: -130, to: 130, speed: 1.5, dir: 1 },
  { kind: 'line', axis: 'z', offset: -11.6, from: -120, to: 120, speed: 1.25, dir: -1 },
  { kind: 'line', axis: 'z', offset: 11.6, from: -130, to: 130, speed: 1.65, dir: -1 },
  { kind: 'line', axis: 'z', offset: 11.6, from: -110, to: 120, speed: 1.35, dir: 1 },
  { kind: 'line', axis: 'x', offset: 57.5, from: -60, to: 130, speed: 1.4, dir: 1 },
  { kind: 'line', axis: 'x', offset: 32.5, from: 20, to: 120, speed: 1.5, dir: -1 },
  { kind: 'circle', cx: -27, cz: 6, r: 9.4, speed: 0.32, dir: 1 },
  { kind: 'circle', cx: -27, cz: 6, r: 11.2, speed: 0.26, dir: -1 },
  { kind: 'line', axis: 'z', offset: -82.2, from: -100, to: 130, speed: 1.3, dir: 1 },
  { kind: 'line', axis: 'x', offset: 62, from: -100, to: 100, speed: 1.2, dir: -1 },
  // 南岸广场：商场里外廊上逛店的人（沿长轴来回走，避开中庭栏杆）
  { kind: 'line', axis: 'z', offset: 38, from: 132, to: 172, speed: 0.85, dir: 1 },
  { kind: 'line', axis: 'z', offset: 38, from: 138, to: 170, speed: 0.7, dir: -1 },
  { kind: 'line', axis: 'z', offset: 62, from: 132, to: 172, speed: 0.8, dir: -1 },
  { kind: 'line', axis: 'z', offset: 62, from: 136, to: 168, speed: 0.75, dir: 1 },
  { kind: 'line', axis: 'z', offset: 50, from: 136, to: 168, speed: 0.65, dir: 1 },
  // 广场西侧那条进场道
  { kind: 'line', axis: 'z', offset: 19.6, from: 124, to: 180, speed: 0.9, dir: 1 },
  { kind: 'line', axis: 'z', offset: 17.4, from: 128, to: 176, speed: 0.8, dir: -1 },
]

export const galleryInterior = {
  width: 26,
  depth: 16,
  height: 6.4,
  start: [0, 2.8] as [number, number],
}

/** 咖啡馆是一层玻璃亭：室内 = 外轮廓 14 × 12 减去 0.3m 外框。 */
export const cafeInterior = {
  width: 13.4,
  depth: 11.4,
  height: 4.2,
  start: [-5.0, 0] as [number, number],
}

export const roomInterior = {
  // 个人空间不再是统一的“小盒子”：城区里可进入的建筑普遍更宽，
  // 室内至少保持与常见建筑 footprint 接近的比例。
  width: 24,
  depth: 20,
  height: 4.5,
  // 出生在门口内侧的空地上，避开各空间的家具布局。
  start: [0, 6.8] as [number, number],
}

export const buildingById = Object.fromEntries(buildings.map((b) => [b.id, b]))

// 楼表定稿后再做一次规划：这里才能拿到河面、广场这些后面才声明的地块。
planStreets(buildings, [
  // 河面 + 两岸步道
  { x0: -CITY_BOUNDS - 60, x1: CITY_BOUNDS + 60, z0: river.z - river.d / 2 - 4, z1: river.z + river.d / 2 + 4 },
  // 摩天轮占地
  {
    x0: ferrisWheel.x - ferrisWheel.radius - 2,
    x1: ferrisWheel.x + ferrisWheel.radius + 2,
    z0: ferrisWheel.z - ferrisWheel.radius - 2,
    z1: ferrisWheel.z + ferrisWheel.radius + 2,
  },
])
