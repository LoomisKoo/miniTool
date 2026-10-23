import * as THREE from 'three'

// 把 OSM 轮廓烘焙成可以一次性上屏的几何。
//
// 核心约束：一栋楼一个 mesh 在 3km 的城市里是几千个 draw call，必然掉帧。
// 所以按 160m 网格切块，每块里所有建筑合并成一个 BufferGeometry：
//   * 一个材质、一份几何 → 每块 1 次 draw call；
//   * 每块有自己的包围球 → three.js 的视锥剔除照常生效，转身时不必再画全城。
//
// 每栋楼的结构类型/高度/种子/颜色烘焙成顶点属性，合并后仍各自独立（见 osmFacade）。

export type OsmBuilding = { p: Array<[number, number]>; h: number; k: string; n?: string }
export type OsmRoad = { p: Array<[number, number]>; w: number; k: string }
export type OsmArea = { p: Array<[number, number]>; t: string }
export type OsmData = {
  name: string
  attribution: string
  center: [number, number]
  bounds: [number, number, number, number]
  buildings: OsmBuilding[]
  roads: OsmRoad[]
  /** 水面：p 是外环，h 是江心洲之类的内环（洞） */
  water: Array<{ p: Array<[number, number]>; h?: Array<Array<[number, number]>> }>
  areas: OsmArea[]
}

const CHUNK = 160

/** 立面结构（着色器里按这个下标分支）：开窗 / 阳台 / 带窗 / 幕墙 / 实墙 */
export const STYLE_PUNCH = 0
export const STYLE_BALCONY = 1
export const STYLE_RIBBON = 2
export const STYLE_CURTAIN = 3
export const STYLE_BLANK = 4

type StyleDef = { style: number; colors: string[] }

const STYLES: Record<string, StyleDef> = {
  residence: { style: STYLE_PUNCH, colors: ['#cdc5b7', '#c4bcae', '#d4ccbe', '#bab2a4', '#c8beb0'] },
  apartment: { style: STYLE_BALCONY, colors: ['#d6d0c4', '#cec7ba', '#ddd8cc', '#c6bfb2'] },
  office: { style: STYLE_CURTAIN, colors: ['#a4b4c2', '#9aacbc', '#b0bec9', '#93a6b6'] },
  ribbon: { style: STYLE_RIBBON, colors: ['#c3c6c8', '#b9bdc1', '#cdd0d1', '#b2b7bb'] },
  blank: { style: STYLE_BLANK, colors: ['#a8a49b', '#b0aca3', '#9e9a92', '#b8b3a9'] },
}

/** OSM 的 building 值 → 结构类型。这一层决定了立面长什么样。 */
function pickStyle(kind: string, height: number): StyleDef {
  if (/apartment|dormitory/.test(kind)) return STYLES.apartment
  if (/residential|house|detached|terrace/.test(kind)) return height > 24 ? STYLES.apartment : STYLES.residence
  if (/office|tower/.test(kind)) return height > 45 ? STYLES.office : STYLES.ribbon
  if (/hotel|commercial/.test(kind)) return height > 60 ? STYLES.office : STYLES.ribbon
  if (/retail|shop|market|mall/.test(kind)) return STYLES.ribbon
  if (/industrial|warehouse|garage|parking|hangar/.test(kind)) return STYLES.blank
  if (/school|hospital|university|college|government|civic|museum|temple|church/.test(kind)) return STYLES.ribbon
  // 大片 `building=yes`：高度高的按住宅、矮的按实墙处理，避免整城一片格子
  if (height > 30) return STYLES.residence
  return STYLES.blank
}

/** 稳定伪随机：同一个坐标每次都得到同一个值，热更新时楼不会换色。 */
function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function signedArea(ring: Array<[number, number]>) {
  let total = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i]
    const [x2, z2] = ring[(i + 1) % ring.length]
    total += x1 * z2 - x2 * z1
  }
  return total / 2
}

/** 点在多边形内（射线法）。屋顶杂物要确认真的落在屋顶上。 */
function contains(ring: Array<[number, number]>, x: number, z: number) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const zi = ring[i][1]
    const xj = ring[j][0]
    const zj = ring[j][1]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

type Bucket = {
  position: number[]
  normal: number[]
  seed: number[]
  top: number[]
  style: number[]
  tint: number[]
}

function emptyBucket(): Bucket {
  return { position: [], normal: [], seed: [], top: [], style: [], tint: [] }
}

function pushVertex(
  bucket: Bucket,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  seed: number,
  top: number,
  style: number,
  color: THREE.Color,
) {
  bucket.position.push(x, y, z)
  bucket.normal.push(nx, ny, nz)
  bucket.seed.push(seed)
  bucket.top.push(top)
  bucket.style.push(style)
  bucket.tint.push(color.r, color.g, color.b)
}

function bucketGeometry(bucket: Bucket) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.position, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normal, 3))
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(bucket.seed, 1))
  geometry.setAttribute('aTop', new THREE.Float32BufferAttribute(bucket.top, 1))
  geometry.setAttribute('aStyle', new THREE.Float32BufferAttribute(bucket.style, 1))
  geometry.setAttribute('aTint', new THREE.Float32BufferAttribute(bucket.tint, 3))
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  return geometry
}

export type OsmChunk = { key: string; geometry: THREE.BufferGeometry }

/** 建筑 → 分块几何。 */
export function buildCity(data: OsmData) {
  const buckets = new Map<string, Bucket>()
  const color = new THREE.Color()
  const contour: THREE.Vector2[] = []

  for (const building of data.buildings) {
    let ring = building.p
    if (ring.length < 3) continue
    const area = signedArea(ring)
    if (Math.abs(area) < 22) continue
    // 统一成逆时针，墙面朝向才一致
    if (area < 0) ring = ring.slice().reverse()

    let cx = 0
    let cz = 0
    for (const [x, z] of ring) {
      cx += x
      cz += z
    }
    cx /= ring.length
    cz /= ring.length

    const key = `${Math.floor(cx / CHUNK)}_${Math.floor(cz / CHUNK)}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = emptyBucket()
      buckets.set(key, bucket)
    }

    const def = pickStyle(building.k, building.h)
    color.set(def.colors[Math.floor(hash(cx * 0.37 + cz * 0.11) * def.colors.length) % def.colors.length])
    const seed = hash(cx * 1.7 + cz * 2.3)
    const top = building.h

    // ---- 墙 ----
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const length = Math.hypot(dx, dz)
      if (length < 0.4) continue
      // 逆时针轮廓的外法线
      const nx = dz / length
      const nz = -dx / length
      pushVertex(bucket, ax, 0, az, nx, 0, nz, seed, top, def.style, color)
      pushVertex(bucket, bx, top, bz, nx, 0, nz, seed, top, def.style, color)
      pushVertex(bucket, bx, 0, bz, nx, 0, nz, seed, top, def.style, color)
      pushVertex(bucket, ax, 0, az, nx, 0, nz, seed, top, def.style, color)
      pushVertex(bucket, ax, top, az, nx, 0, nz, seed, top, def.style, color)
      pushVertex(bucket, bx, top, bz, nx, 0, nz, seed, top, def.style, color)
    }

    // ---- 屋顶 ----
    contour.length = 0
    for (const [x, z] of ring) contour.push(new THREE.Vector2(x, z))
    const tris = THREE.ShapeUtils.triangulateShape(contour, [])
    for (const [i0, i1, i2] of tris) {
      const a = ring[i0]
      const b = ring[i1]
      const c = ring[i2]
      // 用叉积的 y 分量判断绕序，保证法线朝上
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      const order = cross <= 0 ? [a, b, c] : [a, c, b]
      for (const [x, z] of order) {
        pushVertex(bucket, x, top, z, 0, 1, 0, seed, top, def.style, color)
      }
    }
  }

  const chunks: OsmChunk[] = []
  for (const [key, bucket] of buckets) {
    if (!bucket.position.length) continue
    chunks.push({ key, geometry: bucketGeometry(bucket) })
  }

  return chunks
}

export type Collider = { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number }

function boundsOf(ring: Array<[number, number]>) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, z] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { minX, maxX, minZ, maxZ }
}

/** 碰撞盒：多边形取 AABB。略微保守，但玩家不会穿进楼里。 */
export function buildColliders(data: OsmData): Collider[] {
  const list: Collider[] = []
  for (const building of data.buildings) {
    if (building.p.length < 3 || building.h < 2) continue
    const b = boundsOf(building.p)
    if (b.maxX - b.minX < 1.6 || b.maxZ - b.minZ < 1.6) continue
    list.push({ ...b, minY: 0, maxY: building.h })
  }
  return list
}

// ---------------------------------------------------------------------------
// 道路 / 人行道 / 标线
// ---------------------------------------------------------------------------

type Flat = { position: number[]; color: number[]; uv: number[] }

/** 沿中线铺一条带子。两端各延长 extend，拐角处才不会裂开。 */
function ribbon(
  out: Flat,
  points: Array<[number, number]>,
  half: number,
  y: number,
  color: THREE.Color,
  uvScale: number,
) {
  let travelled = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const length = Math.hypot(dx, dz)
    if (length < 0.2) continue
    const ux = dx / length
    const uz = dz / length
    const px = -uz * half
    const pz = ux * half
    const extend = Math.min(half, length * 0.5)
    const sx = ax - ux * extend
    const sz = az - uz * extend
    const ex = bx + ux * extend
    const ez = bz + uz * extend

    const tile = (travelled + length) / uvScale
    const quad: Array<[number, number, number, number]> = [
      [sx + px, sz + pz, 0, 0],
      [sx - px, sz - pz, 0, 1],
      [ex - px, ez - pz, tile, 1],
      [ex + px, ez + pz, tile, 0],
    ]
    for (const tri of [0, 1, 2, 0, 2, 3]) {
      const [x, z, u, v] = quad[tri]
      out.position.push(x, y, z)
      out.color.push(color.r, color.g, color.b)
      out.uv.push(u, v)
    }
    travelled += length
  }
}

function flatGeometry(out: Flat) {
  if (!out.position.length) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(out.color, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2))
  // 全是水平四边形，法线一律朝上，省掉逐点计算
  const normals = new Float32Array(out.position.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.computeBoundingSphere()
  return geometry
}

export const ROAD_COLOR: Record<string, string> = {
  motorway: '#33383c',
  trunk: '#35393d',
  primary: '#383c40',
  secondary: '#3a3f43',
  tertiary: '#3d4246',
  residential: '#42474b',
  unclassified: '#42474b',
  living_street: '#474c50',
  service: '#4b5054',
  pedestrian: '#54585a',
}

export const ROAD_Y: Record<string, number> = {
  pedestrian: 0.075,
  service: 0.075,
  living_street: 0.077,
  residential: 0.077,
  unclassified: 0.077,
  tertiary: 0.079,
  secondary: 0.081,
  primary: 0.083,
  trunk: 0.085,
  motorway: 0.087,
}

/** 路面：所有等级各自合并成一份几何。 */
export function buildRoads(data: OsmData) {
  const byKind = new Map<string, Flat>()
  const color = new THREE.Color()
  for (const road of data.roads) {
    if (road.p.length < 2) continue
    let out = byKind.get(road.k)
    if (!out) {
      out = { position: [], color: [], uv: [] }
      byKind.set(road.k, out)
    }
    color.set(ROAD_COLOR[road.k] ?? '#42474b')
    ribbon(out, road.p, Math.max(1.4, road.w / 2), ROAD_Y[road.k] ?? 0.08, color, 6)
  }
  const list: THREE.BufferGeometry[] = []
  for (const out of byKind.values()) {
    const geometry = flatGeometry(out)
    if (geometry) list.push(geometry)
  }
  return list
}

/** 人行道：比路面宽 3m，比路面低 6mm，形成一圈路缘台阶。 */
export function buildSidewalks(data: OsmData) {
  const out: Flat = { position: [], color: [], uv: [] }
  const color = new THREE.Color('#8e8b84')
  for (const road of data.roads) {
    if (road.p.length < 2) continue
    if (road.k === 'service' || road.k === 'pedestrian') continue
    const y = (ROAD_Y[road.k] ?? 0.08) - 0.012
    ribbon(out, road.p, Math.max(1.4, road.w / 2) + 3.2, y, color, 5)
  }
  // 路口处颜色要跟地面拉开一点，稍微加深
  return flatGeometry(out)
}

/** 标线：主干道虚线中线 + 两侧实线。 */
export function buildMarkings(data: OsmData) {
  const out: Flat = { position: [], color: [], uv: [] }
  const center = new THREE.Color('#d9d3b8')
  const edge = new THREE.Color('#c9c6bd')

  const pushQuad = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    halfWidth: number,
    y: number,
    tint: THREE.Color,
  ) => {
    const dx = x2 - x1
    const dz = z2 - z1
    const len = Math.hypot(dx, dz)
    if (len < 0.01) return
    const px = (-dz / len) * halfWidth
    const pz = (dx / len) * halfWidth
    const quad = [
      [x1 + px, z1 + pz],
      [x1 - px, z1 - pz],
      [x2 - px, z2 - pz],
      [x2 + px, z2 + pz],
    ]
    for (const i of [0, 1, 2, 0, 2, 3]) {
      out.position.push(quad[i][0], y, quad[i][1])
      out.color.push(tint.r, tint.g, tint.b)
      out.uv.push(0, 0)
    }
  }

  for (const road of data.roads) {
    const half = Math.max(1.4, road.w / 2)
    const y = (ROAD_Y[road.k] ?? 0.08) + 0.004
    const major = road.k === 'trunk' || road.k === 'primary' || road.k === 'secondary' || road.k === 'tertiary'

    if (major && road.w > 9) {
      // 中线：4m 实、6m 空的节奏，比等距虚线更像国内主干道
      let travelled = 0
      for (let i = 0; i < road.p.length - 1; i++) {
        const [ax, az] = road.p[i]
        const [bx, bz] = road.p[i + 1]
        const dx = bx - ax
        const dz = bz - az
        const len = Math.hypot(dx, dz)
        if (len < 0.1) continue
        const ux = dx / len
        const uz = dz / len
        let cursor = 0
        while (cursor < len) {
          const phase = (travelled + cursor) % 10
          const dash = phase < 4 ? Math.min(4 - phase, len - cursor) : 0
          if (dash > 0.2) {
            const sx = ax + ux * cursor
            const sz = az + uz * cursor
            pushQuad(sx, sz, sx + ux * dash, sz + uz * dash, 0.12, y, center)
          }
          cursor += dash > 0.2 ? dash : Math.min(10 - phase, len - cursor)
        }
        travelled += len
      }
    }

    if (road.w > 12) {
      // 边线：距离路缘 0.7m 的连续细线
      for (const side of [-1, 1]) {
        const offset = (half - 0.8) * side
        for (let i = 0; i < road.p.length - 1; i++) {
          const [ax, az] = road.p[i]
          const [bx, bz] = road.p[i + 1]
          const dx = bx - ax
          const dz = bz - az
          const len = Math.hypot(dx, dz)
          if (len < 0.2) continue
          const nx = (-dz / len) * offset
          const nz = (dx / len) * offset
          pushQuad(ax + nx, az + nz, bx + nx, bz + nz, 0.08, y, edge)
        }
      }
    }
  }
  return flatGeometry(out)
}

// ---------------------------------------------------------------------------
// 行道树
// ---------------------------------------------------------------------------

export type TreePlacement = { x: number; z: number; scale: number; rot: number; seed: number }

/** 楼体包围盒进网格索引，给行道树和屋顶杂物做排除测试。 */
function buildingGrid(data: OsmData, cell = 40) {
  const grid = new Map<string, Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>>()
  for (const building of data.buildings) {
    if (building.p.length < 3) continue
    const b = boundsOf(building.p)
    const x0 = Math.floor(b.minX / cell)
    const x1 = Math.floor(b.maxX / cell)
    const z0 = Math.floor(b.minZ / cell)
    const z1 = Math.floor(b.maxZ / cell)
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const key = `${x}_${z}`
        let list = grid.get(key)
        if (!list) grid.set(key, (list = []))
        list.push(b)
      }
    }
  }
  return {
    near(x: number, z: number, radius: number) {
      const list = grid.get(`${Math.floor(x / cell)}_${Math.floor(z / cell)}`)
      if (!list) return false
      for (const b of list) {
        if (
          x > b.minX - radius &&
          x < b.maxX + radius &&
          z > b.minZ - radius &&
          z < b.maxZ + radius
        ) {
          return true
        }
      }
      return false
    },
  }
}

/** 行道树：沿街两侧每 20m 一棵，落在人行道上，避开路口和楼体。 */
export function buildTrees(data: OsmData): TreePlacement[] {
  const grid = buildingGrid(data)
  const used = new Set<string>()
  const list: TreePlacement[] = []

  for (const road of data.roads) {
    if (road.w < 6 || road.k === 'service' || road.k === 'pedestrian') continue
    const half = Math.max(1.4, road.w / 2) + 1.6
    let travelled = 0
    for (let i = 0; i < road.p.length - 1; i++) {
      const [ax, az] = road.p[i]
      const [bx, bz] = road.p[i + 1]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 0.5) continue
      const ux = dx / len
      const uz = dz / len
      const nx = -uz
      const nz = ux

      let cursor = 9 - (travelled % 20)
      while (cursor < len) {
        for (const side of [-1, 1]) {
          const jitter = (hash(travelled + cursor * 3.1 + side) - 0.5) * 2.4
          const offset = half + jitter
          const x = ax + ux * cursor + nx * offset * side
          const z = az + uz * cursor + nz * offset * side
          if (grid.near(x, z, 2.6)) continue
          const key = `${Math.round(x / 7)}_${Math.round(z / 7)}`
          if (used.has(key)) continue
          used.add(key)
          list.push({
            x,
            z,
            scale: 0.78 + hash(x * 3.7 + z * 1.9) * 0.55,
            rot: hash(x * 1.3 + z * 2.7) * Math.PI * 2,
            seed: hash(x * 5.1 + z * 0.7),
          })
        }
        cursor += 20
      }
      travelled += len
    }
  }
  return list
}

// ---------------------------------------------------------------------------
// 屋顶杂物
// ---------------------------------------------------------------------------

export type RoofBox = { x: number; y: number; z: number; w: number; h: number; d: number; rot: number }

/** 屋顶的水箱、机房、空调外机。没有这些，所有楼读起来都是干净的白盒子。 */
export function buildRoofClutter(data: OsmData): RoofBox[] {
  const list: RoofBox[] = []
  for (const building of data.buildings) {
    const ring = building.p
    if (ring.length < 3 || building.h < 6) continue
    const b = boundsOf(ring)
    const innerW = b.maxX - b.minX
    const innerD = b.maxZ - b.minZ
    if (innerW < 6 || innerD < 6) continue

    // 高楼屋顶是设备层，矮楼屋顶是水箱 + 楼梯间，数量按面积给
    const area = innerW * innerD
    const count = Math.max(1, Math.min(7, Math.round(area / 240)))
    const stable = hash(b.minX * 0.31 + b.minZ * 0.17)

    let placed = 0
    for (let attempt = 0; attempt < count * 4 && placed < count; attempt++) {
      const r1 = hash(stable * 13.7 + attempt * 1.7)
      const r2 = hash(stable * 7.3 + attempt * 3.1)
      const x = b.minX + 2.5 + r1 * Math.max(0, innerW - 5)
      const z = b.minZ + 2.5 + r2 * Math.max(0, innerD - 5)
      if (!contains(ring, x, z)) continue
      const tall = building.h > 60
      const w = 1.4 + r1 * (tall ? 4.5 : 2.6)
      const d = 1.4 + r2 * (tall ? 4.5 : 2.6)
      const h = 0.8 + hash(x * 0.9 + z * 1.3) * (tall ? 3.4 : 2.2)
      list.push({ x, y: building.h, z, w, h, d, rot: r1 * Math.PI })
      placed++
    }
  }
  return list
}

// ---------------------------------------------------------------------------
// 水面
// ---------------------------------------------------------------------------

export function buildWater(data: OsmData) {
  const position: number[] = []
  const uv: number[] = []

  for (const lake of data.water) {
    const ring = lake.p
    if (!ring || ring.length < 3) continue
    const outer = ring.map(([x, z]) => new THREE.Vector2(x, z))
    const holes = (lake.h ?? []).filter((hole) => hole.length >= 3).map((hole) => hole.map(([x, z]) => new THREE.Vector2(x, z)))
    // triangulateShape 的索引指向「外环 + 所有内环」拼起来的数组
    const all = outer.concat(...holes)
    const tris = THREE.ShapeUtils.triangulateShape(outer, holes)
    for (const [i0, i1, i2] of tris) {
      const tri = [all[i0], all[i1], all[i2]]
      // 保证三角面朝上，背面剔除才不会把水面剔掉
      const cross = (tri[1].x - tri[0].x) * (tri[2].y - tri[0].y) - (tri[1].y - tri[0].y) * (tri[2].x - tri[0].x)
      const order = cross <= 0 ? tri : [tri[0], tri[2], tri[1]]
      for (const point of order) {
        position.push(point.x, 0.06, point.y)
        // 世界坐标当 UV：波纹在整条江上连续，不会按面片重复
        uv.push(point.x / 26, point.y / 26)
      }
    }
  }

  if (!position.length) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  const normals = new Float32Array(position.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.computeBoundingSphere()
  return geometry
}

// ---------------------------------------------------------------------------
// 绿地 / 广场 / 停车场
// ---------------------------------------------------------------------------

const AREA_COLOR: Record<string, string[]> = {
  // 草地不要用饱和的绿，真实城市里的草皮偏灰黄
  park: ['#4c5f3e', '#54683f', '#46583a', '#5b6d47'],
  grass: ['#4f6240', '#566a44', '#485b3c'],
  wood: ['#33472f', '#3b5036', '#2e412b'],
  plaza: ['#9c9a92', '#a5a29a', '#93918a'],
  pitch: ['#5d7050', '#6a7a56', '#b06a52'],
  parking: ['#43484c', '#4a4f53'],
  playground: ['#8a7f6d', '#938876'],
  ground: ['#8b8d84', '#93958c'],
}

/** 面状地物：每类合并成一份几何，带顶点色 + UV。 */
export function buildAreas(data: OsmData) {
  const byKind = new Map<string, Flat>()
  const color = new THREE.Color()
  const contour: THREE.Vector2[] = []

  for (const area of data.areas ?? []) {
    const ring = area.p
    if (ring.length < 3) continue
    let out = byKind.get(area.t)
    if (!out) {
      out = { position: [], color: [], uv: [] }
      byKind.set(area.t, out)
    }
    // 同一片区域内的草色也要有变化，否则一整块纯色像贴纸
    let cx = 0
    let cz = 0
    for (const [x, z] of ring) {
      cx += x
      cz += z
    }
    cx /= ring.length
    cz /= ring.length
    const palette = AREA_COLOR[area.t] ?? AREA_COLOR.ground
    color.set(palette[Math.floor(hash(cx * 0.21 + cz * 0.13) * palette.length) % palette.length])

    contour.length = 0
    for (const [x, z] of ring) contour.push(new THREE.Vector2(x, z))
    const tris = THREE.ShapeUtils.triangulateShape(contour, [])
    for (const [i0, i1, i2] of tris) {
      const a = ring[i0]
      const b = ring[i1]
      const c = ring[i2]
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      const order = cross <= 0 ? [a, b, c] : [a, c, b]
      for (const [x, z] of order) {
        out.position.push(x, 0.02, z)
        out.color.push(color.r, color.g, color.b)
        // 世界坐标直接当 UV：同一张颗粒贴图在整张地图上连续
        out.uv.push(x / 9, z / 9)
      }
    }
  }

  const list: THREE.BufferGeometry[] = []
  for (const out of byKind.values()) {
    const geometry = flatGeometry(out)
    if (geometry) list.push(geometry)
  }
  return list
}

// ---------------------------------------------------------------------------
// 楼脚接触阴影
// ---------------------------------------------------------------------------

/**
 * 楼脚接触阴影。
 *
 * 真正的 AO 应该是屏幕空间的，但 3km 的场景里深度精度不够，SSAO 的采样半径
 * 在远处会完全失效；阴影贴图又只覆盖玩家周围一圈。所以这里用几何做：
 * 沿每条墙线往外铺一条 2.4m 的带子，内侧 alpha 深、外侧渐隐。楼和地面之间
 * 有一圈暗部，视觉上就"压"住了，不会浮在地面上。
 */
export function buildContactShadow(data: OsmData, width = 2.4) {
  const position: number[] = []
  // three 的 vertexColors 支持 4 分量 color：rgb 是阴影颜色（纯黑），a 是强度
  const color: number[] = []

  for (const building of data.buildings) {
    const ring = building.p
    if (ring.length < 3) continue
    const strength = Math.min(0.62, 0.3 + building.h / 240)

    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 0.4) continue
      // 外法线：轮廓在数据里是逆时针，外法线就是 (dz, -dx)
      const nx = dz / len
      const nz = -dx / len
      // 两端各延长，避免凸角处出现三角缺口
      const ux = dx / len
      const uz = dz / len
      const ext = width * 0.55
      const a0x = ax - ux * ext
      const a0z = az - uz * ext
      const b0x = bx + ux * ext
      const b0z = bz + uz * ext

      const quad: Array<[number, number, number]> = [
        [a0x, a0z, strength],
        [b0x, b0z, strength],
        [b0x + nx * width, b0z + nz * width, 0],
        [a0x + nx * width, a0z + nz * width, 0],
      ]
      for (const i2 of [0, 1, 2, 0, 2, 3]) {
        position.push(quad[i2][0], 0.115, quad[i2][1])
        color.push(0, 0, 0, quad[i2][2])
      }
    }
  }

  if (!position.length) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 4))
  geometry.computeBoundingSphere()
  return geometry
}
