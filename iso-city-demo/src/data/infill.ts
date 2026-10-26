import {
  alley,
  alleyMouth,
  buildings,
  cedarLane,
  CITY_BOUNDS,
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
  ferrisWheel,
  walkerRoutes,
  type BuildingDef,
  type BuildingStyle,
} from './city'

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

const STYLES: BuildingStyle[] = ['stone', 'brick', 'metal', 'stone', 'brick', 'glass']
const BODIES = ['#c9d2da', '#c4ccd6', '#d0d5d2', '#b9c4cf', '#cdd3d8', '#b3bfc9', '#bcc6cd']
const TRIMS = ['#8e9dac', '#7f8f9f', '#95a09f', '#8394a4', '#8f9fae', '#97a3ae']

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

export function generateInfill(): BuildingDef[] {
  const out: BuildingDef[] = []
  const blocked = reservedRects()
  const rand = rng(20261023)
  const limit = CITY_BOUNDS - 14

  for (const street of STREETS) {
    for (const side of [-1, 1]) {
      let along = -limit
      while (along < limit) {
        const w = 10 + Math.round(rand() * 10)
        const d = 11 + Math.round(rand() * 8)
        const step = w + 1.4 + rand() * 2.6
        const t = along + w / 2
        along += step

        if (nearIntersection(street.axis, t)) continue
        // 留一些空隙，街墙不至于整齐得像贴图
        if (rand() < 0.08) continue
        if (out.length >= 84) break

        // 建筑中心在街道中心线外侧：人行道 + 半个进深
        const out1 = street.center + side * (street.half + d / 2)
        const x = street.axis === 'z' ? out1 : t
        const z = street.axis === 'z' ? t : out1
        const ww = street.axis === 'z' ? d : w
        const dd = street.axis === 'z' ? w : d
        // 退让时是真的把楼改窄：以前只缩小判定用的地块，楼还是原尺寸，
        // 于是"没有重叠"的两栋楼在场景里只剩 1m 的缝。
        // pad 要给足：街屋之间至少留 7m，加上阳台挑出也有 4m 以上。
        let bw = dd
        let lot = rectOf(x, z, ww, bw, 3.5)
        if (blocked.some((r) => overlaps(lot, r))) {
          // 主地块被占，退一步试试更窄的街屋
          bw = Math.max(8, dd * 0.62)
          lot = rectOf(x, z, ww, bw, 3.5)
          if (blocked.some((r) => overlaps(lot, r))) continue
        }

        const style = STYLES[Math.floor(rand() * STYLES.length)]
        // 越靠近城市中心越高，外围压成低矮的街墙
        const core = 1 - Math.min(1, Math.hypot(x, z) / 170)
        // 整体拔高：真实街区的楼高远大于路宽，街道才有"峡谷"的包围感
        const base = 16 + core * 34
        const h = Math.round(base + rand() * (24 + core * 62))

        // 临街面：竖街看 x 方向，横街看 z 方向
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
          body: BODIES[Math.floor(rand() * BODIES.length)],
          trim: TRIMS[Math.floor(rand() * TRIMS.length)],
          roof: 'plain',
          background: true,
          balconies: style === 'brick' && rand() > 0.55,
          setback: h > 48 && rand() > 0.45,
          taper: rand() > 0.75 ? 0.1 : 0,
        })
        blocked.push(lot)
      }
      if (out.length >= 84) break
    }
    if (out.length >= 84) break
  }

  // 外圈：沿城市边界再排一圈楼，走出主街时视线有落点，城市不会突然断在空地上。
  const edge = CITY_BOUNDS - 12
  for (const side of [-1, 1]) {
    for (const horizontal of [false, true]) {
      let along = -edge
      while (along < edge) {
        if (out.length >= 86) break
        const w = 16 + Math.round(rand() * 20)
        const d = 14 + Math.round(rand() * 16)
        const t = along + w / 2
        along += w + 2 + rand() * 3

        const x = horizontal ? t : side * (edge + d / 2)
        const z = horizontal ? side * (edge + d / 2) : t
        const ww = horizontal ? w : d
        const dd = horizontal ? d : w
        // 外圈同样留出 MIN_GAP：判定地块放大，楼本身不再缩水
        const lot = rectOf(x, z, ww, dd, 3.5)
        if (blocked.some((r) => overlaps(lot, r))) continue

        const style = STYLES[Math.floor(rand() * STYLES.length)]
        const h = 48 + Math.round(rand() * 92)
        // 外圈楼的临街面朝向城内
        const facing =
          horizontal
            ? side > 0
              ? 'north'
              : 'south'
            : side > 0
              ? 'west'
              : 'east'

        out.push({
          id: `infill-${out.length}`,
          name: '街区',
          x,
          z,
          w: ww,
          d: dd,
          h,
          facing,
          style,
          body: BODIES[Math.floor(rand() * BODIES.length)],
          trim: TRIMS[Math.floor(rand() * TRIMS.length)],
          roof: 'plain',
          background: true,
          setback: rand() > 0.45,
          taper: rand() > 0.6 ? 0.12 : 0,
        })
        blocked.push(lot)
      }
    }
  }

  return out
}

export const infill = generateInfill()

/** 沿新街区临街面生成的街灯位置（每第三栋一盏），补足街道尺度细节。 */
export const infillLamps: Array<[number, number]> = infill
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
