import type { FurnitureItem, FurnitureType } from '../types'

/**
 * 禁区。weight 1 是硬约束（门口），小于 1 的是"尽量别放"——
 * 比如床不该紧挨着入户门，但房间太小时也只能妥协。
 */
export type ClearZone = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  cx: number
  cz: number
  weight?: number
  /** 只躲不放大的禁区（隔墙这种：贴着就行，不需要额外留空）。 */
  noSpread?: boolean
  /**
   * 这块禁区是什么：
   * door / balcony 是"人要走过的地方"，家具压上去就等于把门堵了；
   * object 是已经摆好的固定家具（留言台、控制台）；
   * wall 是隔墙，挡人。
   */
  kind?: 'door' | 'balcony' | 'object' | 'wall'
}
export type Box2 = { minX: number; maxX: number; minZ: number; maxZ: number }
export type Meta = { w: number; d: number; h: number; walk?: boolean }

type Candidate = { x: number; z: number; rot: number; score: number; cost: number; doorHit: boolean }

const PAD = 0.05
/** 这几件是房间的功能家具，宁可挤一点也不能不摆。 */
const ESSENTIAL = new Set<FurnitureType>(['bed', 'desk', 'counter', 'pedestal', 'sofa'])
/** 这几件最怕贴着入户门：床/沙发一进门就顶上，屋子等于没法用。 */
const DOOR_SHY = new Set<FurnitureType>(['bed', 'sofa'])
/** 这几件本来就该靠墙摆（床头、沙发背、书架、书桌），别浮在房间中间。 */
const WALL_HUG = new Set<FurnitureType>(['bed', 'sofa', 'shelf', 'desk', 'counter', 'speaker'])
/** 背板在本地 -z 上的家具：rot 决定它靠哪面墙。 */
const BACK_AT_MINUS_Z = new Set<FurnitureType>(['bed', 'sofa', 'shelf', 'desk', 'counter', 'chair', 'speaker'])
/** 靠墙角摆才好看的装饰件。 */
const CORNER_KIND = new Set<FurnitureType>(['plant', 'lamp', 'stool'])

/**
 * 可达性判定用的"人体半宽"。
 * 比 PlayerRig 的 PLAYER_RADIUS(0.42) 略小：网格是 0.25m 一格，
 * 用 0.42 去涨墙的话，1.1m 的卧室门洞只剩 0.26m，很可能刚好错过所有格心，
 * 于是整间卧室被判成"走不进去"、床被搬到客厅。0.30 能稳定留出一列可走的格。
 */
const PLAYER = 0.3
/** 可达性网格：0.25m 一格，刚好够分辨门洞和床边那条缝。 */
const CELL = 0.25
/** 摆完之后至少还要留下这么一块能走的面积，且不少于无家具时的这个比例。 */
const MIN_REACH_AREA = 4.5
const MIN_REACH_RATIO = 0.55
/** 妥协轮（怎么摆都会堵）时放宽到这里：至少人还能进得来。 */
const MIN_REACH_RATIO_HARD = 0.32

/** 家具在 rot 之后占的地面矩形（rot 只会是 0 / ±90° 附近）。 */
export function footprint(item: FurnitureItem, meta: Meta) {
  const swap = Math.abs(Math.sin(item.rot)) > 0.5
  return { w: swap ? meta.d : meta.w, d: swap ? meta.w : meta.d }
}

function rectOf(x: number, z: number, w: number, d: number): Box2 {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }
}

function overlapArea(a: Box2, b: Box2) {
  const ox = Math.min(a.maxX, b.maxX + PAD) - Math.max(a.minX, b.minX - PAD)
  const oz = Math.min(a.maxZ, b.maxZ + PAD) - Math.max(a.minZ, b.minZ - PAD)
  return ox > 0 && oz > 0 ? ox * oz : 0
}

/** 把一个禁区往外扩 d 米，并压成低权重（软约束）。 */
function spread(clear: ClearZone, d: number, weight: number): ClearZone {
  return {
    ...clear,
    minX: clear.minX - d,
    maxX: clear.maxX + d,
    minZ: clear.minZ - d,
    maxZ: clear.maxZ + d,
    weight,
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// ---------------------------------------------------------------------------
// 家具之间那条缝
//
// 只查"有没有重叠"是不够的：床和书桌隔了 0.4m，既不重叠也不挡门，
// 可达面积也只是少了一点点，于是照样摆上去——画面上看是一条缝，
// 人却挤不过去，整个房间像是被切成两半。
//
// 所以两件家具正面相对时只允许两种关系：并在一起（缝 < TOUCH），
// 或者留出真能走人的宽度（≥ WALK，玩家直径 0.84m 再留一点余量）。
// 中间那段"看着能过、其实过不去"的缝按长度扣分，只在没别的选择时才用。
// ---------------------------------------------------------------------------

/** 小于这个缝就算并在一起（贴边、椅子塞进桌下、床头柜靠床）。 */
const GAP_TOUCH = 0.12
/** 人能侧身走过的净宽：玩家直径 0.84m，再留一点余量。 */
const GAP_WALK = 1.0
/** 只算真正挡在中间的那段：短于这个长度的缝不影响走动。 */
const GAP_SHARED = 0.35

/** 两件家具正面相对时返回那条缝的宽度和长度；斜着错开返回 null。 */
function facingGap(a: Box2, b: Box2) {
  const dx = Math.max(b.minX - a.maxX, a.minX - b.maxX)
  const dz = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ)
  if (dx > 0 && dz <= 0) {
    const shared = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ)
    if (shared >= GAP_SHARED) return { gap: dx, shared }
  }
  if (dz > 0 && dx <= 0) {
    const shared = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
    if (shared >= GAP_SHARED) return { gap: dz, shared }
  }
  return null
}

/** 这条缝是不是"看着能过、其实过不去"。返回加起来的总长度（米）。 */
function narrowSlots(rect: Box2, others: Box2[]) {
  let bad = 0
  for (const other of others) {
    const slot = facingGap(rect, other)
    if (!slot) continue
    if (slot.gap > GAP_TOUCH && slot.gap < GAP_WALK) bad += slot.shared
  }
  return bad
}

// ---------------------------------------------------------------------------
// 可达性网格
//
// 以前只按"离门口多远"打分，结果床可以正好横在门口：分数难看但它是功能家具，
// 照样被摆上去，人就进不来了。所以还得真的走一遍：把家具按玩家半径往外涨一圈
// 当障碍，从门口做一次洪水填充，看还剩多少地方能站。
// ---------------------------------------------------------------------------

type Grid = { nx: number; nz: number; minX: number; minZ: number; blocked: Uint8Array }

function makeGrid(box: Box2): Grid {
  const nx = Math.max(1, Math.ceil((box.maxX - box.minX) / CELL))
  const nz = Math.max(1, Math.ceil((box.maxZ - box.minZ) / CELL))
  return { nx, nz, minX: box.minX, minZ: box.minZ, blocked: new Uint8Array(nx * nz) }
}

function markRect(g: Grid, r: Box2, inflate: number, value = 1) {
  const x0 = Math.max(0, Math.floor((r.minX - inflate - g.minX) / CELL))
  const x1 = Math.min(g.nx - 1, Math.ceil((r.maxX + inflate - g.minX) / CELL))
  const z0 = Math.max(0, Math.floor((r.minZ - inflate - g.minZ) / CELL))
  const z1 = Math.min(g.nz - 1, Math.ceil((r.maxZ + inflate - g.minZ) / CELL))
  for (let iz = z0; iz <= z1; iz++) {
    const cz = g.minZ + (iz + 0.5) * CELL
    if (cz < r.minZ - inflate || cz > r.maxZ + inflate) continue
    for (let ix = x0; ix <= x1; ix++) {
      const cx = g.minX + (ix + 0.5) * CELL
      if (cx < r.minX - inflate || cx > r.maxX + inflate) continue
      g.blocked[ix + iz * g.nx] = value
    }
  }
}

function freeCellNear(g: Grid, x: number, z: number) {
  const ix = clamp(Math.round((x - g.minX) / CELL - 0.5), 0, g.nx - 1)
  const iz = clamp(Math.round((z - g.minZ) / CELL - 0.5), 0, g.nz - 1)
  if (!g.blocked[ix + iz * g.nx]) return ix + iz * g.nx
  // 螺旋外扩找最近的一格空地
  for (let r = 1; r < Math.max(g.nx, g.nz); r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
        const px = ix + dx
        const pz = iz + dz
        if (px < 0 || pz < 0 || px >= g.nx || pz >= g.nz) continue
        if (!g.blocked[px + pz * g.nx]) return px + pz * g.nx
      }
    }
  }
  return -1
}

/** 从 start 这一格洪水填充；seen/queue 传进来是为了复用缓冲区（每摆一件要试上千个位置）。 */
function floodInto(g: Grid, start: number, seen: Uint8Array, queue: Int32Array) {
  seen.fill(0)
  let head = 0
  let tail = 0
  if (start >= 0) {
    queue[tail++] = start
    seen[start] = 1
  }
  let count = 0
  while (head < tail) {
    const cell = queue[head++]
    count++
    const ix = cell % g.nx
    const iz = (cell - ix) / g.nx
    if (ix > 0) {
      const n = cell - 1
      if (!seen[n] && !g.blocked[n]) {
        seen[n] = 1
        queue[tail++] = n
      }
    }
    if (ix < g.nx - 1) {
      const n = cell + 1
      if (!seen[n] && !g.blocked[n]) {
        seen[n] = 1
        queue[tail++] = n
      }
    }
    if (iz > 0) {
      const n = cell - g.nx
      if (!seen[n] && !g.blocked[n]) {
        seen[n] = 1
        queue[tail++] = n
      }
    }
    if (iz < g.nz - 1) {
      const n = cell + g.nx
      if (!seen[n] && !g.blocked[n]) {
        seen[n] = 1
        queue[tail++] = n
      }
    }
  }
  return count
}

function flood(g: Grid, start: number) {
  const size = g.nx * g.nz
  return { count: floodInto(g, start, new Uint8Array(size), new Int32Array(size)) }
}

/**
 * 这件家具贴边的一圈里，有没有"人站得住、而且确实走得到"的格子。
 * 书架三面贴墙是正常的，但至少要有一面能走过去——否则这件家具等于不存在。
 */
function approachable(g: Grid, seen: Uint8Array, r: Box2, inflate: number) {
  const x0 = Math.floor((r.minX - inflate - g.minX) / CELL)
  const x1 = Math.ceil((r.maxX + inflate - g.minX) / CELL)
  const z0 = Math.floor((r.minZ - inflate - g.minZ) / CELL)
  const z1 = Math.ceil((r.maxZ + inflate - g.minZ) / CELL)
  for (let iz = z0 - 1; iz <= z1 + 1; iz++) {
    if (iz < 0 || iz >= g.nz) continue
    const cz = g.minZ + (iz + 0.5) * CELL
    for (let ix = x0 - 1; ix <= x1 + 1; ix++) {
      if (ix < 0 || ix >= g.nx) continue
      const insideZ = cz >= r.minZ - inflate && cz <= r.maxZ + inflate
      const cx = g.minX + (ix + 0.5) * CELL
      const insideX = cx >= r.minX - inflate && cx <= r.maxX + inflate
      if (insideX && insideZ) continue
      if (seen[ix + iz * g.nx]) return true
    }
  }
  return false
}

/** 家具背板（本地 -z）在世界里的方向。 */
function backDir(rot: number): [number, number] {
  return [-Math.sin(rot), -Math.cos(rot)]
}

/**
 * 把一户的样板家具摆进真实户型里。
 *
 * 样板是按 12.6 × 9.8 画的，缩到真实房间后必然挤；再加上每户的入户门可以在任意
 * 一面墙上，原来的坐标很可能正好压在门口。
 *
 * 现在的规则（按优先级）：
 * 1. 不能把人堵死：摆上去之后从门口洪水填充，能站的面积不能掉太多（硬约束）；
 * 2. 门口和阳台门前的空地不许压（床、沙发额外再躲 0.9m）；
 * 3. 背板贴墙：床的床头、沙发的靠背、书架/书桌的背面都要有一面墙；
 * 4. 成组：茶几挨着沙发，椅子挨着书桌，地毯垫在沙发/茶几下面；
 * 5. 装饰件靠墙角，别浮在房间正中。
 * 实在放不下的非功能家具直接不摆，而不是立在门口挡路。
 */
export function fitFurniture(
  items: FurnitureItem[],
  box: Box2,
  clears: ClearZone[],
  metaOf: (type: FurnitureType) => Meta | undefined,
  /** 某件家具只能摆在指定区域里（床只进卧室）。 */
  boxOf?: (item: FurnitureItem) => Box2 | null,
): FurnitureItem[] {
  const placed: Box2[] = []
  /** 只有带碰撞的家具才挡路，可达性网格用它。 */
  const placedWalk: Box2[] = []
  const result: Array<FurnitureItem | null> = new Array(items.length).fill(null)

  // ---------- 可达性基准 ----------
  const walls = clears.filter((c) => c.kind === 'wall' || c.noSpread)
  const doorZone = clears.find((c) => c.kind === 'door')
  const baseGrid = makeGrid(box)
  for (const w of walls) markRect(baseGrid, w, PLAYER)
  // 门口站人的位置：门内 1.2m 左右（和 pushClear 的 cx/cz 一致）
  const entry = doorZone
    ? { x: doorZone.cx, z: doorZone.cz }
    : { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 }
  const entryCell = freeCellNear(baseGrid, entry.x, entry.z)
  const baseReach = Math.max(1, flood(baseGrid, entryCell).count)
  const softNeed = Math.max(MIN_REACH_AREA / (CELL * CELL), baseReach * MIN_REACH_RATIO)
  const hardNeed = Math.max(MIN_REACH_AREA * 0.6 / (CELL * CELL), baseReach * MIN_REACH_RATIO_HARD)

  // 试位置用的复用缓冲区：每件家具要试上千个候选，不能每次都新建数组
  const trailGrid: Grid = { ...baseGrid, blocked: baseGrid.blocked.slice() }
  const trailSeen = new Uint8Array(baseGrid.blocked.length)
  const trailQueue = new Int32Array(baseGrid.blocked.length)

  // 大件先摆：大件挑位置的余地小
  const order = items
    .map((item, index) => {
      const meta = metaOf(item.type)
      return { item, index, area: (meta?.w ?? 0) * (meta?.d ?? 0) }
    })
    .sort((a, b) => b.area - a.area)

  /** 已经摆好的大件，用来做"成组"（茶几跟沙发、椅子跟书桌）。 */
  const anchors: Array<{ type: FurnitureType; rect: Box2 }> = []
  const corners: Array<[number, number]> = [
    [box.minX + 0.45, box.minZ + 0.45],
    [box.maxX - 0.45, box.minZ + 0.45],
    [box.minX + 0.45, box.maxZ - 0.45],
    [box.maxX - 0.45, box.maxZ - 0.45],
  ]

  for (const { item, index } of order) {
    const meta = metaOf(item.type)
    if (!meta) {
      result[index] = item
      continue
    }
    // 地毯这种贴地的随便摆，不参与避让（最后再统一垫到沙发/茶几下面）
    if (meta.h < 0.12) {
      result[index] = item
      continue
    }

    const areas = [boxOf?.(item), box].filter((b): b is Box2 => Boolean(b))
    const rots = [item.rot, item.rot + Math.PI / 2, item.rot - Math.PI / 2, item.rot + Math.PI]
    /** 严格轮：不压门、可达面积够。 */
    let best: Candidate | null = null
    /** 妥协轮：实在没地方时允许压一点门口，但人必须还能进来。 */
    let loose: Candidate | null = null

    // 床、沙发额外躲开"门口那块"（比硬约束大一圈），房间放得下就别贴着门
    const zones = DOOR_SHY.has(item.type)
      ? [
          ...clears,
          ...clears
            .filter((clear) => (clear.weight ?? 1) >= 1 && !clear.noSpread)
            .map((clear) => spread(clear, 0.9, 0.4)),
        ]
      : clears

    const needsPath = Boolean(meta.walk)

    /**
     * 在一段范围里撒候选位置。
     * 返回严格轮和妥协轮各自最优的一颗；调用方先严格、再退让。
     */
    const search = (areaBox: Box2) => {
      const spanX = areaBox.maxX - areaBox.minX
      const spanZ = areaBox.maxZ - areaBox.minZ
      const cx = (areaBox.minX + areaBox.maxX) / 2
      const cz = (areaBox.minZ + areaBox.maxZ) / 2
      let strict: Candidate | null = null
      let relax: Candidate | null = null

      for (const rot of rots) {
        const { w, d } = footprint({ ...item, rot }, meta)
        if (w > spanX + 0.01 || d > spanZ + 0.01) continue
        const loX = areaBox.minX + w / 2
        const hiX = areaBox.maxX - w / 2
        const loZ = areaBox.minZ + d / 2
        const hiZ = areaBox.maxZ - d / 2
        const xs = new Set<number>([
          clamp(item.x, loX, hiX),
          clamp(2 * cx - item.x, loX, hiX),
          loX,
          hiX,
          cx,
        ])
        const zs = new Set<number>([
          clamp(item.z, loZ, hiZ),
          clamp(2 * cz - item.z, loZ, hiZ),
          loZ,
          hiZ,
          cz,
        ])
        // 沿两个方向各撒几档，小房间里靠"挪到另一头"才躲得开门口
        for (let i = 0; i <= 6; i++) {
          xs.add(loX + ((hiX - loX) * i) / 6)
          zs.add(loZ + ((hiZ - loZ) * i) / 6)
        }

        for (const x of xs) {
          for (const z of zs) {
            const rect = rectOf(x, z, w, d)
            // 硬禁区（门洞/隔墙/固定家具）和软禁区（床沙发门口多躲的那一圈）分开计分
            let hard = 0
            let soft = 0
            let doorHit = false
            for (const clear of zones) {
              const area = overlapArea(rect, clear)
              if (area <= 0) continue
              const weight = clear.weight ?? 1
              const isDoor =
                clear.kind === 'door' || clear.kind === 'balcony' || clear.kind === 'object'
              if (weight >= 1) {
                hard += area * weight
                if (isDoor) doorHit = true
              } else {
                soft += area * weight
              }
            }
            let crowded = 0
            for (const other of placed) crowded += overlapArea(rect, other)
            // 已经压到别人身上了，连洪水填充都不用跑：这一格不可能被选中
            if (needsPath && crowded > 0.35) continue
            // 床和书桌之间留一条 0.4m 的缝 —— 不重叠、不挡门，但人过不去。
            // 这里只记进 cost：同样的可行解里优先选缝够宽或者干脆并起来的那个。
            const narrow = narrowSlots(rect, placed)

            // ---------- 可达性 ----------
            let shortfall = 0
            if (needsPath) {
              trailGrid.blocked.set(baseGrid.blocked)
              // 已经摆好的大件也要算进去：一件件单独都能过，合起来可能把路堵死
              for (const other of placedWalk) markRect(trailGrid, other, PLAYER)
              markRect(trailGrid, rect, PLAYER)
              const count = floodInto(trailGrid, entryCell, trailSeen, trailQueue)
              // 连人都进不来：这个位置永远不能用
              if (count < hardNeed) continue
              // 摆上去之后这件家具也得走得到（床封住卧室门 = 这张床没法睡）
              if (!approachable(trailGrid, trailSeen, rect, PLAYER)) continue
              if (count < softNeed) shortfall = softNeed - count
            }

            let cost =
              Math.abs(x - item.x) + Math.abs(z - item.z) + (rot === item.rot ? 0 : 1.2)
            // 一条 1m 长的窄缝，代价和"搬远 3.5m"相当：只有实在没位置时才将就
            cost += narrow * 3.5

            // 背板贴墙：床头/沙发背/书架背对着墙，留一点缝
            if (WALL_HUG.has(item.type) && BACK_AT_MINUS_Z.has(item.type)) {
              const [bx, bz] = backDir(rot)
              const backGap =
                bx < -0.5
                  ? x - w / 2 - areaBox.minX
                  : bx > 0.5
                    ? areaBox.maxX - (x + w / 2)
                    : bz < -0.5
                      ? z - d / 2 - areaBox.minZ
                      : areaBox.maxZ - (z + d / 2)
              cost += Math.abs(backGap - 0.04) * 3.2
              // 反方向也要有墙可贴，否则床头悬在房间中间
              if (backGap > 0.6) cost += 4
            } else if (WALL_HUG.has(item.type)) {
              const gap = Math.min(
                x - w / 2 - areaBox.minX,
                areaBox.maxX - (x + w / 2),
                z - d / 2 - areaBox.minZ,
                areaBox.maxZ - (z + d / 2),
              )
              cost += Math.max(0, gap) * 2.2
            }

            // 床尽量离门口远一点：一进门不该先看到一张床挡住路
            if (DOOR_SHY.has(item.type) && doorZone) {
              cost += Math.exp(-Math.hypot(x - doorZone.cx, z - doorZone.cz) / 1.8) * 2.4
            }

            // 茶几放在沙发前面 1.3m 左右，别贴着沙发也别跑到房间另一头
            if (item.type === 'table') {
              const sofa = anchors.find((a) => a.type === 'sofa')
              if (sofa) {
                const scx = (sofa.rect.minX + sofa.rect.maxX) / 2
                const scz = (sofa.rect.minZ + sofa.rect.maxZ) / 2
                cost += Math.abs(Math.hypot(x - scx, z - scz) - 1.45) * 2.6
              }
            }

            // 椅子/圆凳挨着书桌、吧台
            if (item.type === 'chair' || item.type === 'stool') {
              const desk = anchors.find((a) => a.type === 'desk' || a.type === 'counter' || a.type === 'table')
              if (desk) {
                const dcx = (desk.rect.minX + desk.rect.maxX) / 2
                const dcz = (desk.rect.minZ + desk.rect.maxZ) / 2
                cost += Math.max(0, Math.abs(Math.hypot(x - dcx, z - dcz) - 0.75) - 0.25) * 5
              }
            }

            // 装饰件靠墙角
            if (CORNER_KIND.has(item.type)) {
              let nearest = Infinity
              for (const [qx, qz] of corners) nearest = Math.min(nearest, Math.hypot(x - qx, z - qz))
              cost += nearest * 1.4
            }

            // 压门洞/压墙是硬约束；可达面积缺口比它更硬
            const score = shortfall * 40 + hard * 1000 + soft * 30 + crowded * 60
            const cand: Candidate = { x, z, rot, score, cost, doorHit }
            if (!doorHit) {
              if (!strict || score < strict.score - 1e-4 || (Math.abs(score - strict.score) <= 1e-4 && cost < strict.cost)) {
                strict = cand
              }
            } else if (!relax || score < relax.score - 1e-4) {
              // 实在没地方：压门口也比不摆好，留作妥协轮
              relax = cand
            }
          }
        }
      }
      return { strict, relax }
    }

    // 有指定房间的（床只进卧室）先只在那间房里找；那间房实在放不下才退回整间屋
    for (const areaBox of areas) {
      const found = search(areaBox)
      if (found.strict) {
        best = found.strict
        break
      }
      // 那间房能塞下（只是挤）就塞进去，别把床搬到客厅
      if (found.relax) {
        loose = found.relax
        break
      }
    }

    const chosen = best ?? loose
    if (!chosen) {
      // 房间比这件家具还小：功能家具贴着"离门最远的那面墙"兜底，
      // 绝不能原样留着——样板里的原位经常正好是门口。
      if (!ESSENTIAL.has(item.type)) {
        result[index] = null
        continue
      }
      let away: { x: number; z: number; rot: number; dist: number } | null = null
      for (const areaBox of areas) {
        const cx = (areaBox.minX + areaBox.maxX) / 2
        const cz = (areaBox.minZ + areaBox.maxZ) / 2
        for (const rot of rots) {
          const { w, d } = footprint({ ...item, rot }, meta)
          if (w > areaBox.maxX - areaBox.minX + 0.01 || d > areaBox.maxZ - areaBox.minZ + 0.01) continue
          const [bx, bz] = backDir(rot)
          const x = bx < -0.5 ? areaBox.minX + w / 2 : bx > 0.5 ? areaBox.maxX - w / 2 : cx
          const z = bz < -0.5 ? areaBox.minZ + d / 2 : bz > 0.5 ? areaBox.maxZ - d / 2 : cz
          const dist = doorZone ? Math.hypot(x - doorZone.cx, z - doorZone.cz) : 0
          if (!away || dist > away.dist) away = { x, z, rot, dist }
        }
        if (away) break
      }
      if (away) {
        result[index] = {
          ...item,
          x: Number(away.x.toFixed(2)),
          z: Number(away.z.toFixed(2)),
          rot: Number(away.rot.toFixed(4)),
        }
        // 兜底摆上去的也要登记：不然后面的家具看不见它，会直接摞上来
        const { w, d } = footprint({ ...item, rot: away.rot }, meta)
        const rect = rectOf(away.x, away.z, w, d)
        placed.push(rect)
        if (meta.walk) placedWalk.push(rect)
      } else {
        result[index] = item
      }
      continue
    }
    // 只有妥协轮才可能压门；非功能家具宁可不摆，也不立在门口挡路
    if (chosen.doorHit && !ESSENTIAL.has(item.type)) {
      result[index] = null
      continue
    }

    const placedItem: FurnitureItem = {
      ...item,
      x: Number(chosen.x.toFixed(2)),
      z: Number(chosen.z.toFixed(2)),
      rot: Number(chosen.rot.toFixed(4)),
    }
    result[index] = placedItem
    const { w, d } = footprint(placedItem, meta)
    const rect = rectOf(placedItem.x, placedItem.z, w, d)
    // 所有实体都记进占位表（椅子、绿植也要让后面的东西躲开），
    // 但只有带碰撞的才进可达性网格。
    placed.push(rect)
    if (meta.walk) placedWalk.push(rect)
    if (WALL_HUG.has(item.type) || item.type === 'table') anchors.push({ type: item.type, rect })
  }

  // ---------- 成组收尾 ----------
  const sofa = anchors.find((a) => a.type === 'sofa')
  const desk = anchors.find((a) => a.type === 'desk' || a.type === 'table' || a.type === 'counter')
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const meta = metaOf(item.type)
    if (!meta || meta.h >= 0.12) continue
    // 地毯：垫在沙发（没沙发就垫在书桌/茶几）正下方
    const host = item.type === 'rug' ? sofa ?? desk : null
    if (host) {
      const hx = (host.rect.minX + host.rect.maxX) / 2
      const hz = (host.rect.minZ + host.rect.maxZ) / 2
      result[i] = {
        ...item,
        x: Number(clamp(hx, box.minX + meta.w / 2, box.maxX - meta.w / 2).toFixed(2)),
        z: Number(clamp(hz, box.minZ + meta.d / 2, box.maxZ - meta.d / 2).toFixed(2)),
        rot: 0,
      }
    }
  }

  return result.filter((item): item is FurnitureItem => Boolean(item))
}
