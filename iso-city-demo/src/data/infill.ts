import {
  alley,
  alleyMouth,
  buildings,
  cedarLane,
  crossStreet,
  eastAvenue,
  mainStreet,
  plaza,
  plazaFountain,
  roadRects,
  southCross,
  westAvenue,
  river,
  riverSegments,
  ROW_BODIES,
  ferrisWheel,
  walkerRoutes,
  type BuildingDef,
  type BuildingStyle,
} from './city'
import { pedReserved } from './pedestrian'

// 程序化街区。
//
// 整座城原来只有 23 栋手写建筑，散落在几百米见方的地面上，大道两侧是空地，
// 走在街上完全没有"城市"的感觉。这里按路网生成沿街的连续街墙：
// - 每一条大街两侧都排一行楼，进深、高度、材质按种子变化；
// - 路口、广场、巷子和已有建筑自动让位；
// - 只生成体量与立面（background），几十栋楼只多几十次 draw call。

type Rect = { x0: number; x1: number; z0: number; z1: number }

const rectOf = (x: number, z: number, w: number, d: number, pad = 0): Rect => ({
  x0: x - w / 2 - pad,
  x1: x + w / 2 + pad,
  z0: z - d / 2 - pad,
  z1: z + d / 2 + pad,
})

const overlaps = (a: Rect, b: Rect) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0

/** 稳定伪随机：同一座城每次刷新都一样。 */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// 砖和石材占大头：一城玻璃幕墙就是"钢筋水泥"，老城的气质来自砖楼
const STYLES: BuildingStyle[] = ['brick', 'brick', 'stone', 'brick', 'stone', 'metal', 'brick', 'glass']

/** 广告屏街区：主街与横街交汇的那一段，招牌集中在一处才有"时代广场"的密度。 */
function inBillboardDistrict(x: number, z: number) {
  return Math.abs(x - mainStreet.x) < 62 && z > crossStreet.z - 40 && z < crossStreet.z + 24
}
const BODIES = ['#c9d2da', '#c4ccd6', '#d0d5d2', '#b9c4cf', '#cdd3d8', '#b3bfc9', '#bcc6cd']
const TRIMS = ['#8e9dac', '#7f8f9f', '#95a09f', '#8394a4', '#8f9fae', '#97a3ae']
/** 老公寓墙色；风格化模式下会按哈希落到不同的砖色/石色色调上 */
const WALKUP_BODIES = ['#9a7b6a', '#a08572', '#8d6e5e', '#b09a86', '#7f6656', '#a3907e', '#94776a', '#8a7465', '#b5a089', '#9c8270']

/** 不可建设：广场、巷子、喷泉与已有建筑。道路由沿街布置本身避开。 */
function reservedRects(): Rect[] {
  const list: Rect[] = [
    rectOf(plaza.x, plaza.z, plaza.w, plaza.d, 2),
    rectOf(plazaFountain.x, plazaFountain.z, plazaFountain.r * 2, plazaFountain.r * 2, 4),
    rectOf(alley.x, alley.z, alley.w, alley.d, 2),
    rectOf(alleyMouth.x, alleyMouth.z, alleyMouth.w, alleyMouth.d, 2),
    rectOf(cedarLane.x, cedarLane.z, cedarLane.w, cedarLane.d, 2),
    // 空中连廊（CityScene / SkyBridges）下方的地块留空，别让新楼把桥穿掉
    rectOf(-6.5, -56.5, 49, 9, 2),
    // 河面、河岸步道、码头、摩天轮都不许建楼
    rectOf(river.x, river.z + 2, 320, river.d + 26, 2),
    rectOf(ferrisWheel.x, ferrisWheel.z + 3, 42, 18, 2),
    // 南岸广场：胶囊形商场 + 一圈广场，不许程序化街区插进来
    { x0: pedReserved.x0, x1: pedReserved.x1, z0: pedReserved.z0, z1: pedReserved.z1 },
  ]
  // 车行道本身也不可建设。“沿街布置”本来就会让楼退到路外，但地图两端
  // 和路口的边界情况会漏：有几栋街屋正好压在主街和南横街上，车流从楼里
  // 穿过去。这里把五条车行道显式列进禁区，杜绝这种情况。
  for (const r of roadRects) {
    list.push({ x0: r.x0 - 1.5, x1: r.x1 + 1.5, z0: r.z0 - 1.5, z1: r.z1 + 1.5 })
  }
  for (const b of buildings) {
    // 可进入的建筑门前要留出通道，否则招牌和入口会被新楼堵死
    list.push(rectOf(b.x, b.z, b.w, b.d, b.target ? 10 : 6))
  }
  return list
}

type Street = {
  /** 沿哪条轴延伸 */
  axis: 'x' | 'z'
  /** 街道中心线坐标（axis 为 z 时是 x，反之是 z） */
  center: number
  /** 到人行道外缘的距离 */
  half: number
}

const STREETS: Street[] = [
  { axis: 'z', center: mainStreet.x, half: mainStreet.w / 2 + 5 },
  { axis: 'z', center: westAvenue.x, half: westAvenue.w / 2 + 4.5 },
  { axis: 'z', center: eastAvenue.x, half: eastAvenue.w / 2 + 4.5 },
  { axis: 'x', center: crossStreet.z, half: crossStreet.d / 2 + 4.5 },
  { axis: 'x', center: southCross.z, half: southCross.d / 2 + 4.5 },
]

/** 交叉口附近不建楼，保证每条街都能看穿、能转弯。 */
function nearIntersection(axis: 'x' | 'z', along: number) {
  const crossings =
    axis === 'z'
      ? [crossStreet.z, southCross.z]
      : [mainStreet.x, westAvenue.x, eastAvenue.x]
  return crossings.some((c) => Math.abs(along - c) < 13)
}

/** 沿街楼和居民小区能排到的范围（城市外缘，比原来的 CITY_BOUNDS 大一圈）。 */
export const INFILL_EDGE = 385

/** 稳定的整数哈希：同一路段 / 同一小区拿到同一组参数。 */
function hashKey(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

type Theme = { style: BuildingStyle; form: BuildingDef['form']; h: number; body: string; trim: string }

/**
 * 路段主题：同一条街、同一侧、同一段（约 70m）的楼共用风格、高度和墙色。
 * 真实街区是一排一排建起来的，一段街的楼大致同高同材质；
 * 每栋各自随机，整条街就是"大小不一、乱"。
 */
function segmentTheme(key: string, core: number): Theme {
  const r = rng(hashKey(key))
  const pick = r()
  const body = BODIES[Math.floor(r() * BODIES.length)]
  const trim = TRIMS[Math.floor(r() * TRIMS.length)]
  // 外圈（离中心 150m 以外）是老街坊：联排小楼、旧仓库、老公寓为主
  if (core < 0.12) {
    if (pick < 0.34) return { style: 'brick', form: 'rowhouse', h: 1.2 + (3 + Math.round(r())) * 3.3, body, trim }
    if (pick < 0.5) return { style: 'brick', form: 'warehouse', h: 10 + Math.round(r() * 3), body, trim }
    if (pick < 0.8) return { style: 'brick', form: 'walkup', h: 17 + Math.round(r() * 3) * 3.3, body, trim }
  }
  if (pick < 0.5) return { style: 'brick', form: 'walkup', h: 17 + Math.round(r() * 3) * 3.3, body, trim }
  if (pick < 0.8) return { style: 'stone', form: undefined, h: Math.round(22 + core * 12 + r() * 8), body, trim }
  return { style: r() < 0.5 ? 'metal' : 'glass', form: undefined, h: Math.round(30 + core * 26 + r() * 10), body, trim }
}

export function generateInfill(): BuildingDef[] {
  const out: BuildingDef[] = []
  const blocked = reservedRects()
  const rand = rng(20261023)
  const limit = INFILL_EDGE - 10
  let streetCount = 0

  STREETS.forEach((street, si) => {
    for (const side of [-1, 1]) {
      let along = -limit
      while (along < limit) {
        // 先按下一段的主题定开间：联排小楼一户 7~9m 紧挨着，仓库 20m 以上
        const preT = along + 7
        const preCore = 1 - Math.min(1, Math.hypot(street.axis === 'z' ? street.center : preT, street.axis === 'z' ? preT : street.center) / 170)
        const preForm = segmentTheme(`${si}:${side}:${Math.floor((preT + 400) / 70)}`, preCore).form
        // 开间宽度收窄到 12~16m：一排楼的体量接近，街墙才整齐
        const w =
          preForm === 'rowhouse'
            ? 7 + Math.round(rand() * 2)
            : preForm === 'warehouse'
              ? 20 + Math.round(rand() * 6)
              : 12 + Math.round(rand() * 4)
        const d = preForm === 'rowhouse' ? 11 + Math.round(rand() * 2) : 13 + Math.round(rand() * 4)
        const step = w + (preForm === 'rowhouse' ? 0.3 : 2 + rand() * 1.5)
        const t = along + w / 2
        along += step

        if (nearIntersection(street.axis, t)) continue
        if (preForm !== 'rowhouse' && rand() < 0.06) continue
        if (streetCount >= 300) break

        const out1 = street.center + side * (street.half + d / 2)
        const x = street.axis === 'z' ? out1 : t
        const z = street.axis === 'z' ? t : out1
        const ww = street.axis === 'z' ? d : w
        const dd = street.axis === 'z' ? w : d
        let bw = dd
        // 联排小楼一户挨一户，不留 3.5m 的楼间距
        const pad = preForm === 'rowhouse' ? 0.1 : 3.5
        let lot = rectOf(x, z, ww, bw, pad)
        if (blocked.some((r) => overlaps(lot, r))) {
          bw = Math.max(8, dd * 0.62)
          lot = rectOf(x, z, ww, bw, pad)
          if (blocked.some((r) => overlaps(lot, r))) continue
        }

        const core = 1 - Math.min(1, Math.hypot(x, z) / 170)
        const theme = segmentTheme(`${si}:${side}:${Math.floor((preT + 400) / 70)}`, preCore)
        let { style, form } = theme
        // 同一段里只有很小的高差（±1 层），屋顶线连成一条；联排小楼层数一户一样
        let h = form === 'rowhouse' ? theme.h : Math.round(theme.h + (rand() - 0.5) * 3.3)
        // 老公寓和联排小楼同高同款，但一栋一个墙色：真实街道是一户户刷的
        const body =
          form === 'rowhouse'
            ? ROW_BODIES[Math.floor(rand() * ROW_BODIES.length)]
            : form === 'walkup'
              ? WALKUP_BODIES[Math.floor(rand() * WALKUP_BODIES.length)]
              : theme.body
        if (inBillboardDistrict(x, z)) {
          form = 'billboard'
          h = Math.max(h, 24)
          style = style === 'glass' ? 'stone' : style
        } else if (core > 0.45 && style === 'stone' && rand() < 0.14) {
          // 装饰艺术塔楼：多级退台 + 尖塔，是天际线的主角
          form = 'deco'
          h = Math.round(70 + rand() * 40)
        }

        const facing =
          street.axis === 'z'
            ? side > 0
              ? 'west'
              : 'east'
            : side > 0
              ? 'north'
              : 'south'

        out.push({
          id: `infill-${out.length}`,
          name: '街区',
          x,
          z,
          w: ww,
          d: bw,
          h,
          facing,
          style,
          body,
          trim: theme.trim,
          roof: 'plain',
          background: true,
          setback: !form && h > 48,
          form,
        })
        blocked.push(lot)
        streetCount++
      }
    }
  })

  out.push(...generateEstates(blocked, out.length))
  return out
}

const ESTATE_CELL = 52
/** 街区半宽：52m 格子四周各让出 4m，相邻街区之间是 8m 的小区路 + 人行道 */
const ESTATE_BLOCK = ESTATE_CELL / 2 - 4
/** 小区楼总数上限：每栋楼都有独立的立面材质，再多帧率扛不住 */
const ESTATE_MAX = 300
/** 小区网格里每一格：built=false 的格子是留出来的绿地 */
const estateCells: Array<{ cx: number; cz: number; built: boolean }> = []

/**
 * 居民街区：空地按 52m 网格铺行列式小区——南北两排板楼，山墙之间留 6m，
 * 两排之间是宅间院子。楼间距按防火与日照间距排，而不是一栋挨一栋贴死。
 */
function generateEstates(blocked: Rect[], startId: number): BuildingDef[] {
  const out: BuildingDef[] = []
  const CELL = ESTATE_CELL
  const B = ESTATE_BLOCK
  const edge = INFILL_EDGE - 6
  for (let cx = -edge + CELL / 2; cx <= edge - CELL / 2; cx += CELL) {
    for (let cz = -edge + CELL / 2; cz <= edge - CELL / 2; cz += CELL) {
      const r = rng(hashKey(`estate:${cx}:${cz}`))
      // 留一些街区做街心公园，城市不至于被楼铺满
      if (r() < 0.16 || out.length >= ESTATE_MAX) {
        estateCells.push({ cx, cz, built: false })
        continue
      }
      const before = out.length
      const dN = 12 + Math.round(r() * 2)
      const dS = 12 + Math.round(r() * 2)
      // 楼与楼山墙之间至少 6m（多层住宅防火间距），拆开的两栋之间留出一条宅间路
      const gap = 6
      type Lot = { x: number; z: number; w: number; d: number; facing: BuildingDef['facing'] }
      const lots: Lot[] = []
      // 行列式：南北各一排板楼，中间约 20m 是宅间院子（≈ 楼高，满足日照间距）。
      // 不再在东西两边夹楼：那样四角贴死、院子被四面 5~8 层楼围成天井。
      // 每排一半概率拆成两栋，屋顶线才有高低错落
      for (const [side, depth] of [[-1, dN], [1, dS]] as const) {
        const z = cz + side * (B - depth / 2)
        const facing = side < 0 ? 'north' : 'south'
        if (r() < 0.5) {
          lots.push({ x: cx, z, w: B * 2, d: depth, facing })
        } else {
          const split = (r() - 0.5) * 12
          const wl = B + split - gap / 2
          const wr = B - split - gap / 2
          lots.push({ x: cx - B + wl / 2, z, w: wl, d: depth, facing })
          lots.push({ x: cx + B - wr / 2, z, w: wr, d: depth, facing })
        }
      }
      // 同一街区的楼间距已在上面排好，只和街区外的禁区比
      const placed: Rect[] = []
      for (const l of lots) {
        if (out.length >= ESTATE_MAX) break
        const lot = rectOf(l.x, l.z, l.w, l.d, 0.6)
        if (blocked.some((b) => overlaps(lot, b))) continue
        // 4~6 层：两排楼相距约 20m，再高就挡光
        const floors = 4 + Math.floor(r() * 3)
        out.push({
          id: `infill-${startId + out.length}`,
          name: '居民楼',
          x: l.x,
          z: l.z,
          w: l.w,
          d: l.d,
          h: Math.round(3.4 + floors * 3.3),
          facing: l.facing,
          style: r() < 0.72 ? 'brick' : 'stone',
          body: WALKUP_BODIES[Math.floor(r() * WALKUP_BODIES.length)],
          trim: TRIMS[Math.floor(r() * TRIMS.length)],
          roof: 'plain',
          background: true,
          form: 'estate',
        })
        placed.push(lot)
      }
      blocked.push(...placed)
      estateCells.push({ cx, cz, built: out.length > before })
    }
  }
  return out
}

export const infill = generateInfill()

/** 沿新街区临街面生成的街灯位置（每第三栋一盏），补足街道尺度细节。 */
export const infillLamps: Array<[number, number]> = infill
  .filter((b) => b.form !== 'estate')
  .filter((_, i) => i % 3 === 0)
  .map((b) => {
    const sideX = b.facing === 'east' || b.facing === 'west'
    const half = sideX ? b.w / 2 : b.d / 2
    const nx = b.facing === 'east' ? 1 : b.facing === 'west' ? -1 : 0
    const nz = b.facing === 'south' ? 1 : b.facing === 'north' ? -1 : 0
    return [b.x + nx * (half + 2.1), b.z + nz * (half + 2.1)] as [number, number]
  })

/** 手写地标 + 程序化外围街区的完整楼表。车流和碰撞都按这张表避让。 */
export const allBuildings: BuildingDef[] = [...buildings, ...infill]

// ---------------------------------------------------------------------------
// 小区地面：内部车道、宅间步道、草坪
// ---------------------------------------------------------------------------
//
// 小区格子里原来只有底盘颜色，俯视时大片地面是一整块深色。这里按 52m 网格
// 补上小区路网：街区四周是车道（相邻两格共用），车道内侧贴一圈人行道，
// 围合院子里铺草坪；没建楼的格子整块是街心公园。

export type GroundRect = { x: number; z: number; w: number; d: number }

/** 河、广场、摩天轮这些自带地面的区域：小区地面一律不许压上去 */
const specialAreas: Rect[] = [
  rectOf(plaza.x, plaza.z, plaza.w, plaza.d, 1),
  rectOf(plazaFountain.x, plazaFountain.z, plazaFountain.r * 2, plazaFountain.r * 2, 2),
  rectOf(alley.x, alley.z, alley.w, alley.d, 1),
  rectOf(alleyMouth.x, alleyMouth.z, alleyMouth.w, alleyMouth.d, 1),
  rectOf(cedarLane.x, cedarLane.z, cedarLane.w, cedarLane.d, 1),
  rectOf(river.x, river.z + 2, 340, river.d + 26, 1),
  rectOf(ferrisWheel.x, ferrisWheel.z + 3, 42, 18, 1),
  { x0: pedReserved.x0, x1: pedReserved.x1, z0: pedReserved.z0, z1: pedReserved.z1 },
]

/** 沿 axis 方向、宽 2*half 的一条带子，去掉被挡住的部分 */
function clipStrip(axis: 'x' | 'z', offset: number, half: number, lo: number, hi: number, rects: Rect[], minLen: number): Interval[] {
  const hits: Interval[] = []
  for (const r of rects) {
    const a0 = axis === 'x' ? r.x0 : r.z0
    const a1 = axis === 'x' ? r.x1 : r.z1
    const o0 = axis === 'x' ? r.z0 : r.x0
    const o1 = axis === 'x' ? r.z1 : r.x1
    if (o1 <= offset - half || o0 >= offset + half) continue
    if (a1 <= lo || a0 >= hi) continue
    hits.push([Math.max(lo, a0), Math.min(hi, a1)])
  }
  hits.sort((p, q) => p[0] - q[0])
  const out: Interval[] = []
  let cursor = lo
  for (const [h0, h1] of hits) {
    if (h0 - cursor >= minLen) out.push([cursor, h0])
    cursor = Math.max(cursor, h1)
  }
  if (hi - cursor >= minLen) out.push([cursor, hi])
  return out
}

function estateGround() {
  const lanes: GroundRect[] = []
  const paths: GroundRect[] = []
  const lawns: GroundRect[] = []
  const solid: Rect[] = [...allBuildings.map((b) => rectOf(b.x, b.z, b.w, b.d, 0.05)), ...specialAreas]
  const half = ESTATE_CELL / 2
  const B = ESTATE_BLOCK
  const strip = (list: GroundRect[], axis: 'x' | 'z', offset: number, width: number, lo: number, hi: number, minLen: number) => {
    for (const [a, b] of clipStrip(axis, offset, width / 2, lo, hi, solid, minLen)) {
      const len = b - a
      const mid = (a + b) / 2
      list.push(axis === 'x' ? { x: mid, z: offset, w: len, d: width } : { x: offset, z: mid, w: width, d: len })
    }
  }
  const boundaries = new Set<string>()
  for (const { cx, cz, built } of estateCells) {
    if (!built) {
      // 街心公园只铺中间一块草，四周留水泥地：46m 一整块绿在俯视下太抢
      const size = 28
      const lawn = rectOf(cx, cz, size, size)
      if (!specialAreas.some((r) => overlaps(lawn, r))) lawns.push({ x: cx, z: cz, w: size, d: size })
      continue
    }
    // 四周车道，相邻格子共用一条；横竖两组在路口重叠，同色同层，看不出接缝
    for (const z of [cz - half, cz + half]) {
      const key = `x:${z}:${cx}`
      if (boundaries.has(key)) continue
      boundaries.add(key)
      strip(lanes, 'x', z, 6, cx - half - 3, cx + half + 3, 6)
    }
    for (const x of [cx - half, cx + half]) {
      const key = `z:${x}:${cz}`
      if (boundaries.has(key)) continue
      boundaries.add(key)
      strip(lanes, 'z', x, 6, cz - half - 3, cz + half + 3, 6)
    }
    // 人行道：贴着街区外沿一圈，压在车道内侧
    const sw = 1.8
    const o = B + 0.1 + sw / 2
    strip(paths, 'x', cz - o, sw, cx - o - sw / 2, cx + o + sw / 2, 3)
    strip(paths, 'x', cz + o, sw, cx - o - sw / 2, cx + o + sw / 2, 3)
    strip(paths, 'z', cx - o, sw, cz - o + sw / 2, cz + o - sw / 2, 3)
    strip(paths, 'z', cx + o, sw, cz - o + sw / 2, cz + o - sw / 2, 3)
    // 围合院子：草坪铺在楼底下也看不见，所以直接按院子最大可能的尺寸铺
    lawns.push({ x: cx, z: cz, w: B * 2 - 22, d: B * 2 - 22 })
  }
  return { lanes, paths, lawns }
}

export const estateGroundRects = estateGround()

/** 点位是否落在某栋楼的平面内（道具摆位用）。 */
export function insideBuilding(x: number, z: number, pad = 0): boolean {
  for (const b of allBuildings) {
    if (x > b.x - b.w / 2 - pad && x < b.x + b.w / 2 + pad && z > b.z - b.d / 2 - pad && z < b.z + b.d / 2 + pad) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 人行道
// ---------------------------------------------------------------------------
//
// 行人路线原来是几条手写的长直线，其中两条正好从楼里穿过去（南岸塔楼、
// 街角咖啡、东岸商场）。这里把每条线按"楼体 + 河面 + 喷泉 + 摩天轮"切成
// 若干段可走的直线，行人只在真正空着的段落上来回走。

/** 行人半宽：判定避让时按这条带宽算。 */
const PED_HALF = 1.1
/** 太短的残段没有意义（走两步就折返）。 */
const MIN_WALK = 16

type Interval = [number, number]

const blockers: Rect[] = (() => {
  const list: Rect[] = allBuildings.map((b) => rectOf(b.x, b.z, b.w, b.d, 1.2))
  // 河面：只有桥/大道那几跨能走，其它段落一律截断
  for (const [x0, x1] of riverSegments) {
    list.push({ x0, x1, z0: river.z - river.d / 2 - 2, z1: river.z + river.d / 2 + 2 })
  }
  list.push(rectOf(plazaFountain.x, plazaFountain.z, plazaFountain.r * 2, plazaFountain.r * 2, 1.4))
  list.push(rectOf(ferrisWheel.x, ferrisWheel.z, ferrisWheel.radius * 2, ferrisWheel.radius * 2, 2))
  return list
})()

function freeSpans(axis: 'x' | 'z', offset: number, from: number, to: number): Interval[] {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const hits: Interval[] = []
  for (const r of blockers) {
    const a0 = axis === 'x' ? r.x0 : r.z0
    const a1 = axis === 'x' ? r.x1 : r.z1
    const o0 = axis === 'x' ? r.z0 : r.x0
    const o1 = axis === 'x' ? r.z1 : r.x1
    if (o1 <= offset - PED_HALF || o0 >= offset + PED_HALF) continue
    if (a1 <= lo || a0 >= hi) continue
    hits.push([Math.max(lo, a0), Math.min(hi, a1)])
  }
  hits.sort((p, q) => p[0] - q[0])
  const out: Interval[] = []
  let cursor = lo
  for (const [h0, h1] of hits) {
    if (h0 - cursor > 0.5) out.push([cursor, h0])
    cursor = Math.max(cursor, h1)
  }
  if (hi - cursor > 0.5) out.push([cursor, hi])
  return out.filter(([a, b]) => b - a >= MIN_WALK)
}

export type PedestrianRoute =
  | { kind: 'line'; axis: 'x' | 'z'; offset: number; from: number; to: number; speed: number; dir: 1 | -1 }
  | { kind: 'circle'; cx: number; cz: number; r: number; speed: number; dir: 1 | -1 }

export const pedestrianRoutes: PedestrianRoute[] = (() => {
  const out: PedestrianRoute[] = []
  let flip = 1
  for (const route of walkerRoutes) {
    if (route.kind === 'circle') {
      // 环形步道按圆周采样判定：广场那两圈要绕开喷泉，
      // 用外接矩形判会把整圈都误杀（喷泉在圈里侧，本来就不挡路）。
      let clash = false
      for (let i = 0; i < 48 && !clash; i++) {
        const a = (i / 48) * Math.PI * 2
        const px = route.cx + Math.cos(a) * route.r
        const pz = route.cz + Math.sin(a) * route.r
        clash = blockers.some((r) => px > r.x0 && px < r.x1 && pz > r.z0 && pz < r.z1)
      }
      if (!clash) out.push(route)
      continue
    }
    for (const [a, b] of freeSpans(route.axis, route.offset, route.from, route.to)) {
      out.push({ ...route, from: a, to: b, dir: (flip > 0 ? 1 : -1) as 1 | -1 })
      flip = -flip
    }
  }
  return out
})()
