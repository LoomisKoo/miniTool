// 楼栋内部的“真实感”数据层。
//
// 这个文件同时被前端（Vite）和服务端（Node）引用：前端用它决定楼里有几层、
// 每层几户、门牌和电梯楼层，以及街面立面上每一扇窗、每一个阳台的位置；
// 服务端用它批量生成可认领的空间。所以这里只放纯数据与纯函数。
//
// 一栋楼只有一份平面（floorLayout）。街上看到的窗和阳台、户内墙上的洞口、
// 电梯厅的门，全部从这一份平面里取同一组数——里外不可能对不上。
//
// 坐标：楼栋局部坐标，原点在楼的中心，x 沿 w，z 沿 d（和城市坐标同向，不旋转）。
// 外墙四面记作 n(-z) / s(+z) / w(-x) / e(+x)；沿墙坐标 a：n/s 墙取 x，e/w 墙取 z。

/** 层高。 */
export const FLOOR_HEIGHT = 3.3

/** 生成空间的版本号：服务端用它判断是否需要给已有数据库补楼内户。 */
export const UNIT_SEED_VERSION = 11

/** 外墙厚。 */
export const WALL = 0.3
/** 分户墙 / 核心筒墙厚。 */
const PART = 0.24
const HP = PART / 2
/** 室内净高：层高减去楼板。 */
const CEILING = FLOOR_HEIGHT - 0.2

/** 各类开洞的竖向尺寸（相对本层楼板面）。立面与室内共用。 */
export const OPENING = {
  window: { y0: 0.9, y1: 2.4 },
  balcony: { y0: 0.04, y1: 2.45 },
  store: { y0: 0.3, y1: 3.0 },
  entry: { y0: 0.04, y1: 2.8 },
  stair: { y0: 1.1, y1: 2.3 },
}
/** 阳台挑出外墙的进深。 */
export const BALCONY_OUT = 1.5
/** 入户门洞。 */
export const DOOR = { width: 1.5, height: 2.35 }

/**
 * 有楼内场景的建筑（与 src/data/city.ts 里的命名建筑一一对应，w/d 必须一致）。
 * type 决定平面：
 * - slab     板楼：多个单元（楼梯+电梯），一梯两户，户型南北通透；
 * - tower    塔楼：中央核心筒，一梯四户风车形大平层，每户两面采光；
 * - corridor 内廊：酒店 / 青年公寓 / 工作室，走廊两侧开间。
 */
export const UNIT_BUILDINGS = [
  { id: 'riverside', name: '河岸公寓', type: 'slab', w: 58, d: 14, h: 62, face: 'north' },
  { id: 'west-residence', name: '雪松公寓', type: 'slab', w: 48, d: 14, h: 25, face: 'south' },
  { id: 'north-tower', name: '北塔', type: 'tower', w: 30, d: 28, h: 96, face: 'south' },
  { id: 'south-east', name: '青年公寓', type: 'corridor', w: 20, d: 32, h: 35, face: 'south', roomW: 8.6 },
  { id: 'harbor-hotel', name: '港湾酒店', type: 'corridor', w: 32, d: 22, h: 42, face: 'south', roomW: 4.0 },
  { id: 'soundfield', name: '声场唱片', type: 'corridor', w: 24, d: 20, h: 15, basements: 1, face: 'west', roomW: 8.0 },
  { id: 'midtown', name: '中巷工作室', type: 'corridor', w: 16, d: 20, h: 12, face: 'west', roomW: 9.0 },
]

export const UNIT_BUILDING_IDS = UNIT_BUILDINGS.map((b) => b.id)

export function unitBuilding(id) {
  return UNIT_BUILDINGS.find((b) => b.id === id) || null
}

/** 楼层数：至少 2 层，按层高从建筑高度推。 */
export function floorsOf(building) {
  const h = typeof building === 'number' ? building : building.h
  return Math.max(2, Math.floor(h / FLOOR_HEIGHT))
}

/** 立面实际高度：层数 × 层高，再加女儿墙。 */
export function shellHeightOf(building) {
  return floorsOf(building) * FLOOR_HEIGHT
}

// ---------------------------------------------------------------------------
// 平面
// ---------------------------------------------------------------------------

export const SIDE_OF_FACE = { north: 'n', south: 's', east: 'e', west: 'w' }
export const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' }

const rect = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 })

function opening(side, a0, a1, kind, owner) {
  const v = OPENING[kind]
  return { side, a0, a1, y0: v.y0, y1: v.y1, kind, owner }
}

/** 在 [a0, a1] 这段墙上按"窗宽 + 墙垛"的节奏均匀排窗，返回 [a0, a1] 区间。 */
function spread(a0, a1, width = 1.8, pier = 1.0) {
  const L = a1 - a0
  const n = Math.floor((L - pier) / (width + pier))
  if (n <= 0) {
    if (L < 1.6) return []
    const w = Math.min(width, L - 0.8)
    const c = (a0 + a1) / 2
    return [[c - w / 2, c + w / 2]]
  }
  const used = n * width + (n - 1) * pier
  const start = a0 + (L - used) / 2
  return Array.from({ length: n }, (_, i) => [start + i * (width + pier), start + i * (width + pier) + width])
}

function windowsAlong(side, a0, a1, owner, width, pier) {
  return spread(a0, a1, width, pier).map(([s, e]) => opening(side, s, e, 'window', owner))
}

/** 阳台那一面：一樘推拉门 + 剩下的窗；挑板盖住整段。 */
function balconyWall(side, a0, a1, owner) {
  const L = a1 - a0
  const bw = Math.min(4.2, Math.max(2.4, L * 0.42))
  const door = opening(side, a0 + 0.8, a0 + 0.8 + bw, 'balcony', owner)
  const rest = windowsAlong(side, door.a1 + 0.9, a1 - 0.3, owner, 1.8, 0.9)
  return {
    openings: [door, ...rest],
    balcony: { side, a0: a0 + 0.12, a1: a1 - 0.12, owner },
  }
}

/** 首层：整面橱窗，按 ~6m 一跨；入口那一段让给门厅玻璃门。 */
function storefronts(side, a0, a1, skip, ownerAt) {
  const free = []
  let from = a0
  for (const [s, e] of [...skip].sort((p, q) => p[0] - q[0])) {
    if (s - from > 0.5) free.push([from, s])
    from = Math.max(from, e)
  }
  if (a1 - from > 0.5) free.push([from, a1])
  const out = []
  for (const [s, e] of free) {
    const n = Math.max(1, Math.round((e - s) / 6))
    const bw = (e - s) / n
    for (let i = 0; i < n; i++) {
      const b0 = s + i * bw + 0.45
      const b1 = s + (i + 1) * bw - 0.45
      if (b1 - b0 < 1.2) continue
      out.push(opening(side, b0, b1, 'store', ownerAt((b0 + b1) / 2)))
    }
  }
  return out
}

/** 外墙四面在沿墙方向上的净跨（扣掉转角的外墙厚）。 */
function sideSpan(b, side) {
  return side === 'n' || side === 's'
    ? [-b.w / 2 + WALL, b.w / 2 - WALL]
    : [-b.d / 2 + WALL, b.d / 2 - WALL]
}

/** 矩形贴着哪几面外墙。 */
export function exteriorSidesOf(b, r) {
  const sides = []
  const eps = 0.02
  if (Math.abs(r.z0 - (-b.d / 2 + WALL)) < eps) sides.push('n')
  if (Math.abs(r.z1 - (b.d / 2 - WALL)) < eps) sides.push('s')
  if (Math.abs(r.x0 - (-b.w / 2 + WALL)) < eps) sides.push('w')
  if (Math.abs(r.x1 - (b.w / 2 - WALL)) < eps) sides.push('e')
  return sides
}

/** 矩形在某一面上的沿墙区间。 */
export function spanOn(r, side) {
  return side === 'n' || side === 's' ? [r.x0, r.x1] : [r.z0, r.z1]
}

/** 首层：除门厅入口外整圈橱窗；落在门厅范围内的那几跨归门厅。 */
function groundFacade(b, halls) {
  const out = []
  for (const side of ['n', 's', 'e', 'w']) {
    const [a0, a1] = sideSpan(b, side)
    const skip = []
    for (const hall of halls) {
      if (hall.exit && hall.exit.side === side) skip.push([hall.exit.a0 - 0.45, hall.exit.a1 + 0.45])
    }
    const ownerAt = (a) => {
      for (const hall of halls) {
        if (!exteriorSidesOf(b, hall.rect).includes(side)) continue
        const [s, e] = spanOn(hall.rect, side)
        if (a > s && a < e) return `h:${hall.index}`
      }
      return 'shop'
    }
    out.push(...storefronts(side, a0, a1, skip, ownerAt))
  }
  for (const hall of halls) {
    if (!hall.exit) continue
    out.push(opening(hall.exit.side, hall.exit.a0, hall.exit.a1, 'entry', `h:${hall.index}`))
  }
  return out
}

/** 板楼：n 个单元，单元 = [户][楼梯电梯][户]，户型贯通南北。 */
function slabLayout(b, floor) {
  const X0 = -b.w / 2 + WALL
  const X1 = b.w / 2 - WALL
  const Z0 = -b.d / 2 + WALL
  const Z1 = b.d / 2 - WALL
  const face = SIDE_OF_FACE[b.face || 'south']
  const back = OPPOSITE[face]
  const n = Math.max(1, Math.round((X1 - X0) / 26))
  const groupW = (X1 - X0) / n
  const CW = 3.4
  const doorZ = (Z0 + Z1) / 2 + (face === 's' ? 1.6 : -1.6)
  const halls = []
  const units = []
  const ground = floor === 1

  for (let k = 0; k < n; k++) {
    const gx0 = X0 + k * groupW
    const gx1 = gx0 + groupW
    const cx = (gx0 + gx1) / 2
    // 首层是整单元的门厅（整块楼板），不是楼梯间那条 3.4m 宽的走廊
    const hallRect = ground
      ? rect(gx0 + (k > 0 ? HP : 0), gx1 - (k < n - 1 ? HP : 0), Z0, Z1)
      : rect(cx - CW / 2 + HP, cx + CW / 2 - HP, Z0, Z1)
    const hall = {
      index: k,
      rect: hallRect,
      elevator: { side: back, at: cx },
      exit: ground ? { side: face, at: cx, a0: cx - 2.2, a1: cx + 2.2 } : null,
      doors: [],
      openings: [],
    }
    if (!ground) hall.openings.push(opening(face, cx - 0.6, cx + 0.6, 'stair', `h:${k}`))
    halls.push(hall)
    if (ground) continue

    const left = rect(gx0 + (k > 0 ? HP : 0), cx - CW / 2 - HP, Z0, Z1)
    const right = rect(cx + CW / 2 + HP, gx1 - (k < n - 1 ? HP : 0), Z0, Z1)
    for (const [r, doorSide, gable] of [
      [left, 'e', k === 0 ? 'w' : null],
      [right, 'w', k === n - 1 ? 'e' : null],
    ]) {
      const index = units.length
      const owner = `u:${index}`
      const front = balconyWall(face, r.x0, r.x1, owner)
      const openings = [
        ...front.openings,
        ...windowsAlong(back, r.x0 + 0.4, r.x1 - 0.4, owner, 1.8, 1.2),
      ]
      if (gable) openings.push(...windowsAlong(gable, r.z0 + 1.2, r.z1 - 1.2, owner, 1.5, 2.4))
      units.push({ index, rect: r, door: { side: doorSide, at: doorZ }, openings, balcony: front.balcony, hall: k })
      hall.doors.push({ unit: index, side: OPPOSITE[doorSide], at: doorZ })
    }
  }

  const facade = ground
    ? groundFacade(b, halls)
    : [...halls.flatMap((h) => h.openings), ...units.flatMap((u) => u.openings)]
  if (ground) for (const hall of halls) hall.openings = facade.filter((o) => o.owner === `h:${hall.index}`)
  return { type: 'slab', halls, units, facade }
}

/** 塔楼：中央 8×8 核心筒，四户风车形围合，每户两面外墙、一面阳台。 */
function towerLayout(b, floor) {
  const X0 = -b.w / 2 + WALL
  const X1 = b.w / 2 - WALL
  const Z0 = -b.d / 2 + WALL
  const Z1 = b.d / 2 - WALL
  const c = 4
  const ground = floor === 1
  const hallRect = ground ? rect(X0, X1, Z0, Z1) : rect(-c + HP, c - HP, -c + HP, c - HP)
  const hall = {
    index: 0,
    rect: hallRect,
    elevator: { side: 'n', at: 1.6 },
    exit: ground ? { side: 's', at: 0, a0: -c + 0.6, a1: c - 0.6 } : null,
    doors: [],
    openings: [],
  }
  const units = []
  if (!ground) {
    const defs = [
      // [矩形, 入户门所在墙, 门位置, 阳台面, 另一面外墙]
      [rect(X0, c - HP, c + HP, Z1), 'n', 1.8, 's', 'w'],
      [rect(c + HP, X1, -c + HP, Z1), 'w', 1.8, 'e', 's'],
      [rect(-c + HP, X1, Z0, -c - HP), 's', -1.8, 'n', 'e'],
      [rect(X0, -c - HP, Z0, c - HP), 'e', -1.8, 'w', 'n'],
    ]
    for (const [r, doorSide, at, balconySide, windowSide] of defs) {
      const index = units.length
      const owner = `u:${index}`
      const [b0, b1] = spanOn(r, balconySide)
      const [w0, w1] = spanOn(r, windowSide)
      const front = balconyWall(balconySide, b0, b1, owner)
      const openings = [...front.openings, ...windowsAlong(windowSide, w0 + 0.5, w1 - 0.5, owner, 2.0, 1.4)]
      units.push({ index, rect: r, door: { side: doorSide, at }, openings, balcony: front.balcony, hall: 0 })
      hall.doors.push({ unit: index, side: OPPOSITE[doorSide], at })
    }
  }
  const halls = [hall]
  const facade = ground ? groundFacade(b, halls) : units.flatMap((u) => u.openings)
  if (ground) hall.openings = facade.filter((o) => o.owner === 'h:0')
  return { type: 'tower', halls, units, facade }
}

/** 内廊：沿长边一条走廊，核心筒在一端，两侧开间。首层是门厅。 */
function corridorLayout(b, floor) {
  const axis = b.w >= b.d ? 'x' : 'z'
  const U = axis === 'x' ? b.w : b.d
  const V = axis === 'x' ? b.d : b.w
  const face = SIDE_OF_FACE[b.face || 'south']
  const ends = axis === 'x' ? ['w', 'e'] : ['n', 's']
  // 正面在端头时门厅就放在那一头，否则放在 -u 端、从长边进门
  const su = face === ends[1] ? -1 : 1
  const sideOf = (uv) => {
    if (uv === 'u0') return su > 0 ? ends[0] : ends[1]
    if (uv === 'u1') return su > 0 ? ends[1] : ends[0]
    if (axis === 'x') return uv === 'v0' ? 'n' : 's'
    return uv === 'v0' ? 'w' : 'e'
  }
  const uvSideOf = (side) => ['u0', 'u1', 'v0', 'v1'].find((uv) => sideOf(uv) === side)
  const toRect = (u0, u1, v0, v1) => {
    const a = su * u0
    const c = su * u1
    const lo = Math.min(a, c)
    const hi = Math.max(a, c)
    return axis === 'x' ? rect(lo, hi, v0, v1) : rect(v0, v1, lo, hi)
  }
  /** 沿 u 的区间换算成沿墙坐标 a（v 墙上 a = ±u）。 */
  const aOfU = (u0, u1) => {
    const a = su * u0
    const c = su * u1
    return [Math.min(a, c), Math.max(a, c)]
  }
  const atU = (u) => su * u

  const U0 = -U / 2 + WALL
  const U1 = U / 2 - WALL
  const V0 = -V / 2 + WALL
  const V1 = V / 2 - WALL
  const CORE = 4.8
  const HV = 1.2
  const ground = floor === 1
  const basement = floor < 0
  const units = []

  if (ground) {
    // 首层是整层门厅
    const LOBBY = U1 - U0
    const hallRect = toRect(U0, U1, V0, V1)
    const faceUV = uvSideOf(face)
    const exit =
      faceUV === 'u0'
        ? { side: face, at: 0, a0: -2.2, a1: 2.2 }
        : (() => {
            const mid = U0 + LOBBY / 2
            const [a0, a1] = aOfU(mid - 2.2, mid + 2.2)
            return { side: face, at: atU(mid), a0, a1 }
          })()
    const hall = {
      index: 0,
      rect: hallRect,
      elevator: { side: sideOf('u1'), at: 0 },
      exit,
      doors: [],
      openings: [],
    }
    const facade = groundFacade(b, [hall])
    hall.openings = facade.filter((o) => o.owner === 'h:0')
    return { type: 'corridor', halls: [hall], units, facade }
  }

  const hall = {
    index: 0,
    rect: toRect(U0, U1, -HV, HV),
    elevator: { side: sideOf('u0'), at: 0 },
    exit: null,
    doors: [],
    openings: basement ? [] : [opening(sideOf('u1'), -0.8, 0.8, 'window', 'h:0')],
  }
  const start = U0 + CORE + PART
  const len = U1 - start
  const n = Math.max(1, Math.round(len / (b.roomW || 4.4)))
  const rw = (len - (n - 1) * PART) / n
  for (const sgn of [1, -1]) {
    for (let i = 0; i < n; i++) {
      const ru0 = start + i * (rw + PART)
      const ru1 = ru0 + rw
      const r = sgn > 0 ? toRect(ru0, ru1, HV + PART, V1) : toRect(ru0, ru1, V0, -HV - PART)
      const index = units.length
      const owner = `u:${index}`
      const doorUV = sgn > 0 ? 'v0' : 'v1'
      const outUV = sgn > 0 ? 'v1' : 'v0'
      const at = atU(ru0 + Math.min(1.4, rw / 2))
      const openings = []
      if (!basement) {
        const ww = Math.min(2.0, rw - 1.2)
        const [a0, a1] = aOfU((ru0 + ru1) / 2 - ww / 2, (ru0 + ru1) / 2 + ww / 2)
        openings.push(opening(sideOf(outUV), a0, a1, 'window', owner))
      }
      units.push({ index, rect: r, door: { side: sideOf(doorUV), at }, openings, balcony: null, hall: 0 })
      hall.doors.push({ unit: index, side: sideOf(outUV === 'v1' ? 'v1' : 'v0'), at })
    }
  }
  const facade = basement ? [] : [...hall.openings, ...units.flatMap((u) => u.openings)]
  if (!basement) {
    // 核心筒（楼梯间）两侧的小窗：属于公共部分，谁也不剪
    for (const uv of ['v0', 'v1']) {
      const [a0, a1] = aOfU(U0 + 1.6, U0 + 2.8)
      facade.push(opening(sideOf(uv), a0, a1, 'stair', 'core'))
    }
  }
  return { type: 'corridor', halls: [hall], units, facade }
}

// ---------------------------------------------------------------------------
// 户内隔墙
// ---------------------------------------------------------------------------

/** 户内隔墙厚 / 户内门洞宽。 */
const INNER_PT = 0.12
const INNER_DOOR = 1.1

const rectOverlap = (a, b, pad = 0) =>
  a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad

const rectInside = (inner, outer, pad = 0.02) =>
  inner.x0 >= outer.x0 - pad &&
  inner.x1 <= outer.x1 + pad &&
  inner.z0 >= outer.z0 - pad &&
  inner.z1 <= outer.z1 + pad

const onUnitEdge = (room, unit, side) =>
  side === 'n' ?
    Math.abs(room.z0 - unit.z0) < 0.05
  : side === 's' ?
    Math.abs(room.z1 - unit.z1) < 0.05
  : side === 'w' ?
    Math.abs(room.x0 - unit.x0) < 0.05
  : Math.abs(room.x1 - unit.x1) < 0.05

function doorPoint(unit) {
  const d = unit.door
  const r = unit.rect
  if (d.side === 'n') return [d.at, r.z0]
  if (d.side === 's') return [d.at, r.z1]
  if (d.side === 'w') return [r.x0, d.at]
  return [r.x1, d.at]
}

/** 房间的某一面墙离入户门最近的点，用来挑"门开在哪一面"。 */
function edgeCenter(room, side) {
  const cx = (room.x0 + room.x1) / 2
  const cz = (room.z0 + room.z1) / 2
  if (side === 'n') return [cx, room.z0]
  if (side === 's') return [cx, room.z1]
  if (side === 'w') return [room.x0, cz]
  return [room.x1, cz]
}

/**
 * 一户的室内分区与隔墙。
 *
 * 以前每户就是一整个开间：169 m² 的公寓和 33 m² 的酒店房进去都是"一间空房"。
 * 这里按真实尺寸切出卧室（大户型两间）和卫生间，并生成带门洞的隔墙；
 * 床只会摆进卧室，卫生间也是真的能走进去的一间。
 */
function interiorOfUnit(unit) {
  const r = unit.rect
  const W = r.x1 - r.x0
  const D = r.z1 - r.z0
  const area = W * D
  const living = { kind: 'living', rect: r, doors: [] }
  const studio = { rooms: [living], walls: [], headers: [], bedroom: null, bath: null }
  if (area < 28) return studio

  const dSide = unit.door.side
  const [dx, dz] = doorPoint(unit)

  // 入户门内那一块必须留空（否则一进门就是卫生间的墙）
  const doorClear =
    dSide === 'n' ? rect(dx - 0.85, dx + 0.85, r.z0, r.z0 + 2.2)
    : dSide === 's' ? rect(dx - 0.85, dx + 0.85, r.z1 - 2.2, r.z1)
    : dSide === 'w' ? rect(r.x0, r.x0 + 2.2, dz - 0.85, dz + 0.85)
    : rect(r.x1 - 2.2, r.x1, dz - 0.85, dz + 0.85)

  // ---- 卫生间：贴着某一面墙，离入户门最近又不挡门的那个位置 ----
  const baths = []
  if (W * D >= 30) {
    for (const side of ['n', 's', 'e', 'w']) {
      const horiz = side === 'n' || side === 's'
      const span = horiz ? W : D
      const perp = horiz ? D : W
      const alongLen = Math.min(2.4, Math.max(1.8, span * 0.5))
      const inLen = Math.min(2.3, Math.max(1.7, perp * 0.28))
      if (span < alongLen + 0.6 || perp < inLen + 1.0) continue
      const lo = horiz ? r.x0 : r.z0
      const hi = horiz ? r.x1 : r.z1
      for (const a0 of [lo, hi - alongLen]) {
        const box =
          side === 'n' ? rect(a0, a0 + alongLen, r.z0, r.z0 + inLen)
          : side === 's' ? rect(a0, a0 + alongLen, r.z1 - inLen, r.z1)
          : side === 'w' ? rect(r.x0, r.x0 + inLen, a0, a0 + alongLen)
          : rect(r.x1 - inLen, r.x1, a0, a0 + alongLen)
        if (!rectInside(box, r)) continue
        if (rectOverlap(box, doorClear, 0.05)) continue
        baths.push(box)
      }
    }
    baths.sort(
      (p, q) =>
        Math.hypot((p.x0 + p.x1) / 2 - dx, (p.z0 + p.z1) / 2 - dz) -
        Math.hypot((q.x0 + q.x1) / 2 - dx, (q.z0 + q.z1) / 2 - dz),
    )
  }

  // ---- 卧室：大户型切 1~2 间 ----
  const bedroomsOf = (bath) => {
    if (area < 48) return []
    const own = (unit.openings || []).filter((o) => o.kind === 'window' || o.kind === 'balcony')
    const widest = own.slice().sort((p, q) => q.a1 - q.a0 - (p.a1 - p.a0))[0]
    const facade = unit.balcony?.side || widest?.side || null
    if (!facade) return null
    const axisX = facade === 'n' || facade === 's'
    const alongSpan = axisX ? W : D
    const perpSpan = axisX ? D : W
    const count = area >= 150 && alongSpan >= 8.4 ? 2 : 1
    const bw = Math.min(5.4, Math.max(3.0, (alongSpan - 3.0) / count))
    const bd = Math.min(5.0, Math.max(3.2, perpSpan * 0.46))
    // 有阳台的户型，卧室退到阳台对面（采光靠背面的窗）；只有窗的户，卧室贴着窗那一面
    const back = unit.balcony ? OPPOSITE[facade] : facade
    const band =
      back === 'n' ? [r.z0, r.z0 + bd]
      : back === 's' ? [r.z1 - bd, r.z1]
      : back === 'w' ? [r.x0, r.x0 + bd]
      : [r.x1 - bd, r.x1]
    // 离入户门最远的那一头起排；那一头被卫生间占了就换另一头
    const doorAlong = axisX ? (dSide === 'n' || dSide === 's' ? dx : null) : dSide === 'e' || dSide === 'w' ? dz : null
    const lo = axisX ? r.x0 : r.z0
    const hi = axisX ? r.x1 : r.z1
    const firstFromLo =
      doorAlong == null ? dSide === 'e' || dSide === 's' : doorAlong > (lo + hi) / 2
    const build = (fromLo) => {
      const out = []
      for (let i = 0; i < count; i++) {
        const a0 = fromLo ? lo + i * (bw + INNER_PT) : hi - (i + 1) * bw - i * INNER_PT
        const a1 = a0 + bw
        if (a1 > hi + 0.01 || a0 < lo - 0.01) break
        const box = axisX ? rect(a0, a1, band[0], band[1]) : rect(band[0], band[1], a0, a1)
        if (bath && rectOverlap(box, bath, 0.25)) return null
        out.push({ kind: 'bedroom', rect: box, doors: [] })
      }
      return out
    }
    return build(firstFromLo) || build(!firstFromLo) || []
  }

  let rooms = []
  for (const bath of baths) {
    const bedrooms = bedroomsOf(bath)
    if (bedrooms && bedrooms.length) {
      rooms = [{ kind: 'bath', rect: bath, doors: [] }, ...bedrooms]
      break
    }
  }
  const bedroomsOnly = rooms.length ? [] : bedroomsOf(null) || []
  if (!rooms.length) rooms = bedroomsOnly
  if (!rooms.length) {
    // 卧室放不下（小户型），至少给一间卫生间
    if (baths.length) rooms = [{ kind: 'bath', rect: baths[0], doors: [] }]
    else return studio
  }

  // 每间房的门：开在离入户门最近的那一面内墙上
  for (const room of rooms) {
    let best = null
    for (const side of ['n', 's', 'e', 'w']) {
      if (onUnitEdge(room.rect, r, side)) continue
      const [ex, ez] = edgeCenter(room.rect, side)
      const dist = Math.hypot(ex - dx, ez - dz)
      if (!best || dist < best.dist) best = { side, dist }
    }
    if (!best) continue
    const horiz = best.side === 'n' || best.side === 's'
    const a0 = horiz ? room.rect.x0 : room.rect.z0
    const a1 = horiz ? room.rect.x1 : room.rect.z1
    const half = INNER_DOOR / 2 + 0.05
    const want = Math.min(a1 - half, Math.max(a0 + half, horiz ? dx : dz))
    room.doors.push({ side: best.side, at: want, width: INNER_DOOR })
  }

  // 隔墙：房间每一条不在户边界上的边 → 一道墙，扣掉门洞（门洞上面留过梁）
  const walls = []
  const headers = []
  for (const room of rooms) {
    for (const side of ['n', 's', 'e', 'w']) {
      if (onUnitEdge(room.rect, r, side)) continue
      const horiz = side === 'n' || side === 's'
      const lo = horiz ? room.rect.x0 : room.rect.z0
      const hi = horiz ? room.rect.x1 : room.rect.z1
      const fixed = horiz ? (side === 'n' ? room.rect.z0 : room.rect.z1) : side === 'w' ? room.rect.x0 : room.rect.x1
      const gap = room.doors.find((d) => d.side === side)
      const spans = []
      if (gap) {
        const g0 = Math.max(lo, gap.at - gap.width / 2)
        const g1 = Math.min(hi, gap.at + gap.width / 2)
        if (g0 - lo > 0.06) spans.push([lo, g0])
        if (hi - g1 > 0.06) spans.push([g1, hi])
        if (g1 - g0 > 0.1) {
          headers.push(
            horiz
              ? { x0: g0, x1: g1, z0: fixed - INNER_PT / 2, z1: fixed + INNER_PT / 2 }
              : { x0: fixed - INNER_PT / 2, x1: fixed + INNER_PT / 2, z0: g0, z1: g1 },
          )
        }
      } else {
        spans.push([lo, hi])
      }
      for (const [s0, s1] of spans) {
        if (s1 - s0 < 0.06) continue
        walls.push(
          horiz
            ? { x0: s0, x1: s1, z0: fixed - INNER_PT / 2, z1: fixed + INNER_PT / 2 }
            : { x0: fixed - INNER_PT / 2, x1: fixed + INNER_PT / 2, z0: s0, z1: s1 },
        )
      }
    }
  }

  const firstBed = rooms.find((x) => x.kind === 'bedroom') || null
  const bathRoom = rooms.find((x) => x.kind === 'bath') || null
  return {
    rooms: [living, ...rooms],
    walls,
    headers,
    bedroom: firstBed ? firstBed.rect : null,
    bath: bathRoom ? { rect: bathRoom.rect } : null,
  }
}

const layoutCache = new Map()

/**
 * 一层的完整平面：
 * - halls：公共空间（首层门厅 / 电梯厅 / 走廊），含电梯、出口、户门、外墙开洞；
 * - units：每一户的矩形、入户门、外墙开洞、阳台；
 * - facade：这一层所有外墙开洞（立面直接用它）。
 * 标准层都一样，按 首层 / 标准层 / 地下层 三种缓存。
 */
export function floorLayout(building, floor = 2) {
  const kind = floor === 1 ? 'g' : floor < 0 ? 'b' : 't'
  const key = `${building.id}:${kind}`
  const hit = layoutCache.get(key)
  if (hit) return hit
  const f = kind === 'g' ? 1 : kind === 'b' ? -1 : 2
  const type = building.type || 'corridor'
  const layout =
    type === 'slab' ? slabLayout(building, f) : type === 'tower' ? towerLayout(building, f) : corridorLayout(building, f)
  // 户内隔墙/房间分区：整个场景（街面、走廊、户内）用同一份数据
  for (const unit of layout.units) unit.interior = interiorOfUnit(unit)
  // 地下层（只有内廊型才有）没有外墙
  if (f < 0) layout.facade = []
  layoutCache.set(key, layout)
  return layout
}

/** 每层户数（标准层）。 */
export function unitsOf(building) {
  return floorLayout(building, 2).units.length
}

/** 街上的入口：首层门厅出口外 1.4m 处（楼栋局部坐标）。 */
export function entrancesOf(building) {
  const layout = floorLayout(building, 1)
  return layout.halls
    .filter((hall) => hall.exit)
    .map((hall) => {
      const { side, at } = hall.exit
      const out = 1.4
      const x = side === 'w' ? -building.w / 2 - out : side === 'e' ? building.w / 2 + out : at
      const z = side === 'n' ? -building.d / 2 - out : side === 's' ? building.d / 2 + out : at
      return { hall: hall.index, side, x, z }
    })
}

export function floorLabel(floor) {
  return floor < 0 ? `B${-floor}` : `${floor}F`
}

/** 电梯里能选的楼层：先地下层，再 1F..顶层。 */
export function floorList(building) {
  const list = []
  const basements = building.basements || 0
  for (let i = basements; i >= 1; i--) list.push(-i)
  for (let f = 1; f <= floorsOf(building); f++) list.push(f)
  return list
}

/** 老内容保留：这几户沿用已有空间，不重新生成。 */
export function specialSpaceOf(buildingId, floor, index) {
  if (buildingId === 'riverside' && floor === 7 && index === 0) return 'river-loft'
  if (buildingId === 'soundfield' && floor === -1 && index === 0) return 'sound-room'
  return null
}

export function unitSpaceId(buildingId, floor, index) {
  const special = specialSpaceOf(buildingId, floor, index)
  if (special) return special
  const f = floor < 0 ? `b${-floor}` : String(floor).padStart(2, '0')
  return `${buildingId}-${f}-${String(index + 1).padStart(2, '0')}`
}

/** 户号：01 室、02 室…… */
export function unitLabel(index) {
  return `${String(index + 1).padStart(2, '0')}室`
}

export function unitName(building, floor, index) {
  const special = specialSpaceOf(building.id, floor, index)
  if (special === 'river-loft') return '河岸小屋'
  if (special === 'sound-room') return '静音工作室'
  return `${building.name} ${floorLabel(floor)} · ${unitLabel(index)}`
}

export function unitAt(building, floor, index) {
  const layout = floorLayout(building, floor)
  const unit = layout.units[index]
  if (!unit) return null
  const width = unit.rect.x1 - unit.rect.x0
  const depth = unit.rect.z1 - unit.rect.z0
  return {
    spaceId: unitSpaceId(building.id, floor, index),
    buildingId: building.id,
    floor,
    index,
    label: unitLabel(index),
    name: unitName(building, floor, index),
    special: specialSpaceOf(building.id, floor, index),
    unit,
    hall: unit.hall,
    balcony: Boolean(unit.balcony),
    exterior: unit.openings.length > 0,
    room: { width, depth, height: CEILING },
    area: Math.round(width * depth),
  }
}

export function unitsOnFloor(building, floor) {
  return floorLayout(building, floor).units.map((_, index) => unitAt(building, floor, index))
}

/** 从空间 id 反查所属楼栋与楼层，用于阳台外景与门牌。 */
export function unitMetaOfSpace(spaceId) {
  if (spaceId === 'river-loft') {
    return { buildingId: 'riverside', floor: 7, index: 0, label: '01室' }
  }
  if (spaceId === 'sound-room') {
    return { buildingId: 'soundfield', floor: -1, index: 0, label: '01室' }
  }
  const match = /^(.+)-(\d{2}|b\d+)-(\d{2})$/.exec(spaceId)
  if (!match) return null
  const floor = match[2].startsWith('b') ? -Number(match[2].slice(1)) : Number(match[2])
  return {
    buildingId: match[1],
    floor,
    index: Number(match[3]) - 1,
    label: `${match[3]}室`,
  }
}

export function isUnitSpaceId(spaceId) {
  return Boolean(unitMetaOfSpace(spaceId))
}

// ---------------------------------------------------------------------------
// 可认领户的样板陈设：用确定性 hash 从几套布局里挑，保证每次启动一致。
// ---------------------------------------------------------------------------

const WALLS = ['#e9e0d2', '#e4ded2', '#dfe4dd', '#e6dccf', '#dcd8cf']
const FLOORS = ['#c3ae95', '#b7b2a6', '#bfa98d', '#a9a08d', '#cbbd9e']
const ARTS = ['dawn', 'coast', 'meadow', 'signal', 'night', 'clay']

const LAYOUTS = {
  home: [
    ['rug', 0, 0.2, 0, '#b7a58e'],
    ['sofa', 0, -2.2, 0, '#6f7f74'],
    ['table', 0, 0.3, 0, '#8a6a4b'],
    ['shelf', -4.3, -2.4, Math.PI / 2, '#9a7d5d'],
    ['plant', 4.2, -2.6, 0, '#587a58'],
    ['bed', 3.0, 2.4, -Math.PI / 2, '#8c9a92'],
  ],
  studio: [
    ['rug', 0, 0.4, 0, '#a9a397'],
    ['desk', 0, -2.8, 0, '#7d6a52'],
    ['chair', 0, -1.5, 0, '#8e7d65'],
    ['shelf', -4.3, 0.2, Math.PI / 2, '#6d5b47'],
    ['plant', 4.2, -2.8, 0, '#557456'],
    ['lamp', 4.2, 2.6, 0, '#c9a15c'],
  ],
  gallery: [
    ['rug', 0, 0.2, 0, '#cfc7bb'],
    ['pedestal', -2.4, -1.4, 0, '#ded8cc'],
    ['pedestal', 2.4, -1.8, 0, '#ded8cc'],
    ['bench', 0, 2.4, 0, '#7c6a55'],
    ['plant', 4.2, -3.0, 0, '#597a57'],
  ],
  music: [
    ['rug', 0, 0.4, 0, '#6f746c'],
    ['speaker', -2.6, -2.7, 0.22, '#3f4543'],
    ['speaker', 2.6, -2.7, -0.22, '#3f4543'],
    ['desk', 3.8, 1.2, -Math.PI / 2, '#7d6a52'],
    ['shelf', -4.3, 0.4, Math.PI / 2, '#6d5b47'],
    ['chair', 2.4, 1.6, 1.2, '#8e7d65'],
  ],
  collection: [
    ['rug', 0, 0.3, 0, '#b3ada1'],
    ['shelf', -4.3, -1.8, Math.PI / 2, '#8a7458'],
    ['shelf', -4.3, 1.8, Math.PI / 2, '#8a7458'],
    ['pedestal', 0, -1.4, 0, '#ded8cc'],
    ['pedestal', 2.6, 0.8, 0, '#ded8cc'],
    ['bench', 0, 2.7, 0, '#7c6a55'],
  ],
}

const TEMPLATE_KEYS = Object.keys(LAYOUTS)
const DESCRIPTIONS = [
  '一扇朝外的窗，午后会有整块光落在地板上。',
  '电梯厅很安静，关上门就是自己的一方天地。',
  '阳台能看见城市的立面，夜里对面会亮起零星的灯。',
  '南北通透，推开窗就是街区的风。',
  '适合一个人住，也适合把朋友叫来看夜景。',
]

function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  }
  return (h >>> 0) / 4294967296
}

function pick(list, seed) {
  return list[Math.min(list.length - 1, Math.floor(seed * list.length))]
}

/**
 * 生成所有楼内户的初始空间数据。
 * 已有数据库只需要把返回结果按 id 合并进去；重复调用是幂等的。
 */
export function buildUnitSpaces() {
  const result = []
  for (const building of UNIT_BUILDINGS) {
    for (const floor of floorList(building)) {
      const units = unitsOnFloor(building, floor)
      for (const unit of units) {
        if (!unit) continue
        const id = unit.spaceId
        // 样板陈设是按 12.6 × 9.8 写的，缩放到这一户的真实净尺寸
        const sx = Math.min(1.4, unit.room.width / 12.6)
        const sz = Math.min(1.4, unit.room.depth / 9.8)
        const seed = hash(id)
        const template = pick(TEMPLATE_KEYS, seed)
        const items = LAYOUTS[template].map(([type, x, z, rot, color], i) => ({
          id: `${id}-f${i}`,
          type,
          x: Number((x * sx).toFixed(2)),
          z: Number((z * sz).toFixed(2)),
          rot,
          color,
        }))
        result.push({
          id,
          name: unit.name,
          description: pick(DESCRIPTIONS, hash(`${id}-desc`)),
          building: `${building.name} · ${floorLabel(floor)}`,
          template,
          room: unit.room,
          wallColor: pick(WALLS, hash(`${id}-wall`)),
          floorColor: pick(FLOORS, hash(`${id}-floor`)),
          art: {
            title: '窗外的城市',
            palette: pick(ARTS, hash(`${id}-art`)),
          },
          layout: { items },
          ownerId: null,
          isOpen: true,
        })
      }
    }
  }
  return result
}

/**
 * 现在这套户型里存在的全部空间 id。种子升级时用它清掉旧编号——
 * 楼型重排后每层户数变了，旧 id（例如 06 室）在新平面里根本找不到对应的房间，
 * 前端只能退回到一个 12.6 × 9.8 的假盒子，家具就会乱摆（床堵在门口）。
 */
export function currentUnitSpaceIds() {
  return buildUnitSpaces().map((space) => space.id)
}

/** 一栋楼的总户数（含保留户），用于入口文案。 */
export function unitCountOf(building) {
  return floorList(building).reduce((sum, floor) => sum + floorLayout(building, floor).units.length, 0)
}
