#!/usr/bin/env node
/**
 * Overpass JSON(out geom) → 城市白模数据。
 *
 *   node tools/osm/overpass-to-city.mjs --out src/data/osm-city.json \
 *     --in tools/osm/raw/buildings.json --in tools/osm/raw/roads.json \
 *     --in tools/osm/raw/water.json --in tools/osm/raw/areas.json
 *
 * 原始数据分四份存在 tools/osm/raw/，拆开拉是因为公共 Overpass 经常 502，
 * 小查询成功率高得多。查询语句见 tools/osm/query/*.txt：
 *
 *   [out:json][timeout:240];
 *   (
 *     way["building"](23.1030,113.3155,23.1285,113.3375);
 *     relation["building"](23.1030,113.3155,23.1285,113.3375);
 *     way["highway"](23.1030,113.3155,23.1285,113.3375);
 *     way["natural"="water"](23.1030,113.3155,23.1285,113.3375);
 *     way["waterway"="riverbank"](23.1030,113.3155,23.1285,113.3375);
 *     relation["natural"="water"](23.1030,113.3155,23.1285,113.3375);
 *   );
 *   out geom;
 *
 *   curl -s -X POST --data-urlencode "data@query.txt" \
 *     https://overpass-api.de/api/interpreter -o tools/osm/gz-raw.json
 *
 * 换城市就改 bbox，并把脚本里的 LAT0/LON0 改成新 bbox 的中心。
 *
 * 只保留三样东西：建筑轮廓、道路中线、水面。坐标投影成以 bbox 中心为原点的米制平面，
 * 2km 尺度上等距圆柱近似的误差不到 1 米，够用，而且不需要引入 GIS 库。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const inputs = []
let outputPath = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--in') inputs.push(args[++i])
  else if (args[i] === '--out') outputPath = args[++i]
  else if (!outputPath && args.length === 2) outputPath = args[i]
}
if (!inputs.length || !outputPath) {
  console.error('usage: overpass-to-city.mjs --out <out.json> --in <raw.json> [--in <areas.json>]')
  process.exit(1)
}

// 多份 Overpass 结果可以叠加：建筑/道路/水面一份，绿地广场单独一份
const elements = []
for (const path of inputs) {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  elements.push(...(raw.elements || []))
}

const LAT0 = 23.11575
const LON0 = 113.3265
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const MY = 111320

const project = (lat, lon) => [(lon - LON0) * MX, -(lat - LAT0) * MY]

// 没写高度时按类型估一个合理值；面积大的楼再往上抬一点
const TYPE_HEIGHT = {
  apartments: 60,
  residential: 45,
  house: 9,
  detached: 9,
  commercial: 30,
  retail: 14,
  office: 60,
  hotel: 80,
  industrial: 14,
  warehouse: 12,
  school: 16,
  university: 20,
  hospital: 32,
  government: 24,
  civic: 18,
  temple: 12,
  parking: 10,
  garage: 10,
  construction: 12,
  yes: 22,
}

const ROAD_WIDTH = {
  motorway: 26,
  trunk: 22,
  primary: 20,
  secondary: 14,
  tertiary: 11,
  residential: 8,
  unclassified: 8,
  living_street: 7,
  service: 5,
  pedestrian: 7,
}

const KEEP_ROADS = new Set(Object.keys(ROAD_WIDTH))

/** 面状地物分类。没列进来的一律返回 null（不画）。 */
function areaKind(tags) {
  if (tags.amenity === 'parking') return 'parking'
  if (tags.place === 'square') return 'plaza'
  if (tags.highway === 'pedestrian' && tags.area === 'yes') return 'plaza'
  const leisure = tags.leisure
  if (leisure === 'park' || leisure === 'garden' || leisure === 'recreation_ground' || leisure === 'common') return 'park'
  if (leisure === 'playground') return 'playground'
  if (leisure === 'pitch') return 'pitch'
  const landuse = tags.landuse
  if (landuse === 'grass' || landuse === 'meadow' || landuse === 'village_green') return 'grass'
  if (landuse === 'forest' || landuse === 'cemetery') return 'wood'
  if (landuse === 'education') return 'ground'
  const natural = tags.natural
  if (natural === 'wood' || natural === 'scrub') return 'wood'
  if (natural === 'grassland' || natural === 'heath') return 'grass'
  return null
}

const numberFrom = (value) => {
  if (!value) return null
  const text = String(value).toLowerCase()
  const match = text.match(/-?\d+(\.\d+)?/)
  if (!match) return null
  let meters = Number(match[0])
  if (text.includes('ft') || text.includes('feet')) meters *= 0.3048
  return Number.isFinite(meters) ? meters : null
}

/** Overpass 返回的是完整 way，会比 bbox 大很多（珠江那条水面有 32km²）。
 *  用 Sutherland–Hodgman 把多边形裁进 bbox，不然整张地图可能都被水面盖住。 */
function clipRing(ring, rect) {
  const [minX, minZ, maxX, maxZ] = rect
  const passes = [
    [(p) => p[0] >= minX, (a, b) => minX],
    [(p) => p[0] <= maxX, (a, b) => maxX],
    [(p) => p[1] >= minZ, (a, b) => minZ],
    [(p) => p[1] <= maxZ, (a, b) => maxZ],
  ]

  let output = ring
  for (let axis = 0; axis < 2; axis++) {
    for (const [inside, limit] of passes.slice(axis * 2, axis * 2 + 2)) {
      if (!output.length) return []
      const input = output
      output = []
      for (let i = 0; i < input.length; i++) {
        const current = input[i]
        const previous = input[(i + input.length - 1) % input.length]
        const currentIn = inside(current)
        const previousIn = inside(previous)
        if (currentIn !== previousIn) {
          const edge = limit()
          const denom = current[axis] - previous[axis]
          const t = Math.abs(denom) < 1e-9 ? 0 : (edge - previous[axis]) / denom
          const point = [0, 0]
          point[axis] = edge
          point[1 - axis] = previous[1 - axis] + (current[1 - axis] - previous[1 - axis]) * t
          output.push(point)
        }
        if (currentIn) output.push(current)
      }
    }
  }
  return output
}

const ringArea = (ring) => {
  let total = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i]
    const [x2, z2] = ring[(i + 1) % ring.length]
    total += x1 * z2 - x2 * z1
  }
  return Math.abs(total) / 2
}

/** Douglas–Peucker。OSM 轮廓经常有几十个共线点，简化后顶点数能砍一半。 */
function simplify(points, tolerance, closed = false) {
  if (points.length < 4) return points

  const perpendicular = (p, a, b) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const length = Math.hypot(dx, dz)
    if (length < 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1])
    return Math.abs(dx * (a[1] - p[1]) - dz * (a[0] - p[0])) / length
  }

  const simplifyOpen = (list) => {
    if (list.length < 3) return list
    const start = list[0]
    const end = list[list.length - 1]
    let index = 0
    let best = 0
    for (let i = 1; i < list.length - 1; i++) {
      const distance = perpendicular(list[i], start, end)
      if (distance > best) {
        best = distance
        index = i
      }
    }
    if (best <= tolerance) return [start, end]
    const left = simplifyOpen(list.slice(0, index + 1))
    const right = simplifyOpen(list.slice(index))
    return left.slice(0, -1).concat(right)
  }

  if (!closed) return simplifyOpen(points)

  // 闭合环要先把起点挪到包围盒最远的一个角，否则简化会退化
  let pivot = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] + points[i][1] < points[pivot][0] + points[pivot][1]) pivot = i
  }
  const rotated = points.slice(pivot).concat(points.slice(0, pivot))
  const result = simplifyOpen(rotated.concat([rotated[0]]))
  result.pop()
  return result.length >= 3 ? result : points
}

/** 把 relation 的 outer 成员接成闭合环：按端点贪心拼接。 */
function stitch(parts) {
  const rings = []
  const pool = parts.filter((part) => part.length >= 2).map((part) => part.slice())

  while (pool.length) {
    let ring = pool.shift()
    let guard = 0
    while (guard++ < 512) {
      const head = ring[0]
      const tail = ring[ring.length - 1]
      if (Math.hypot(head[0] - tail[0], head[1] - tail[1]) < 1.5) break
      let found = -1
      let flipped = false
      let best = 60
      for (let i = 0; i < pool.length; i++) {
        const part = pool[i]
        const a = Math.hypot(part[0][0] - tail[0], part[0][1] - tail[1])
        const b = Math.hypot(part[part.length - 1][0] - tail[0], part[part.length - 1][1] - tail[1])
        if (a < best) {
          best = a
          found = i
          flipped = false
        }
        if (b < best) {
          best = b
          found = i
          flipped = true
        }
      }
      if (found < 0) break
      const part = pool.splice(found, 1)[0]
      ring = ring.concat(flipped ? part.slice().reverse() : part)
    }
    if (ring.length >= 4) rings.push(ring)
  }

  return rings
}

const buildings = []
const roads = []
const water = []
const areas = []

/** 水面环：裁剪 + 简化 + 缩到 0.1m。太小的水面（喷泉、小池子）直接丢掉。 */
function waterRing(ring) {
  const shape = simplify(dedupe(clipRing(ring, CLIP_RECT)), 1.2, true)
  if (shape.length < 3 || ringArea(shape) < 120) return null
  return shape.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10])
}

/** 射线法：点是否在环内。判定江心洲用。 */
function pointInRing(ring, x, z) {
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

const AREA_MIN = { plaza: 60, parking: 120, pitch: 120, playground: 60, park: 150, grass: 150, wood: 200, ground: 200 }

function pushArea(ring, kind) {
  if (!ring || ring.length < 3) return
  const clean = dedupe(clipRing(ring, CLIP_RECT))
  if (clean.length < 3) return
  const shape = simplify(clean, 1.2, true)
  if (shape.length < 3) return
  if (ringArea(shape) < (AREA_MIN[kind] ?? 120)) return
  areas.push({
    p: shape.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]),
    t: kind,
  })
}

const CLIP_RECT = [-1400, -1720, 1340, 1680]

function dedupe(ring) {
  const out = []
  for (const point of ring) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.35) out.push(point)
  }
  return out
}

function pushBuilding(ring, tags) {
  if (!ring || ring.length < 3) return
  // building:part 是主楼拆出来的构件，画出来会和主楼重叠
  if (tags['building:part'] === 'yes') return
  let clean = dedupe(clipRing(ring, CLIP_RECT))
  if (Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) < 0.6) {
    clean = clean.slice(0, -1)
  }
  if (clean.length < 3) return
  clean = simplify(clean, 0.5, true)
  if (clean.length < 3) return
  const area = ringArea(clean)
  if (area < 25) return

  const kind = tags.building || 'yes'
  let height = numberFrom(tags.height)
  if (height === null || height < 2 || height > 800) {
    const levels = numberFrom(tags['building:levels'])
    if (levels && levels > 0 && levels < 200) {
      const floorH = /office|hotel|commercial|apartments/.test(kind) ? 4.1 : 3.4
      height = levels * floorH
    } else {
      const base = TYPE_HEIGHT[kind] ?? TYPE_HEIGHT.yes
      height = base * Math.min(1.8, 0.7 + Math.sqrt(Math.max(area, 30)) / 28)
    }
  }

  buildings.push({
    p: clean.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]),
    h: Math.round(Math.min(height, 700) * 10) / 10,
    k: String(kind).slice(0, 20),
    ...(tags.name ? { n: String(tags.name).slice(0, 28) } : {}),
  })
}

for (const element of elements) {
  const tags = element.tags || {}

  if (element.type === 'way') {
    if (!element.geometry) continue
    const ring = element.geometry.map((point) => project(point.lat, point.lon))

    if (tags.building && tags.building !== 'no') {
      pushBuilding(ring, tags)
      continue
    }

    const kind = areaKind(tags)
    if (kind) {
      pushArea(ring, kind)
      continue
    }

    if (tags.highway && KEEP_ROADS.has(tags.highway)) {
      const line = simplify(ring, 1.1, false)
      let width = numberFrom(tags.width)
      if (!width) {
        width = ROAD_WIDTH[tags.highway] ?? 8
        const lanes = numberFrom(tags.lanes)
        if (lanes) width = Math.max(width, lanes * 3.3)
      }
      roads.push({
        p: line.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]),
        w: Math.round(Math.min(width, 46) * 10) / 10,
        k: tags.highway,
      })
      continue
    }

    if (tags.natural === 'water' || tags.waterway === 'riverbank') {
      const shape = waterRing(ring)
      if (shape) water.push({ p: shape, h: [] })
    }
    continue
  }

  if (element.type === 'relation') {
    const collect = (role) =>
      (element.members || [])
        .filter((member) => member.type === 'way' && member.geometry && member.role === role)
        .map((member) => member.geometry.map((point) => project(point.lat, point.lon)))

    const outerParts = collect('outer')
    const innerParts = collect('inner')
    if (!outerParts.length) continue
    const rings = stitch(outerParts)
    const holes = innerParts.length ? stitch(innerParts) : []

    if (tags.building && tags.building !== 'no') {
      for (const ring of rings) pushBuilding(ring, tags)
    } else if (areaKind(tags)) {
      for (const ring of rings) pushArea(ring, areaKind(tags))
    } else if (tags.natural === 'water' || tags.waterway === 'riverbank') {
      // 河道的 relation 会把江心洲（海心沙、二沙岛）作为 inner 圈出来。
      // 忽略 inner 的话整条江连岛一起填平，岛上的楼就"泡在水里"了。
      const shapedHoles = holes.map((ring) => waterRing(ring)).filter(Boolean)
      for (const ring of rings) {
        const shape = waterRing(ring)
        if (!shape) continue
        const own = shapedHoles.filter((hole) => pointInRing(shape, hole[0][0], hole[0][1]))
        water.push({ p: shape, h: own })
      }
    }
  }
}

// 落在水面上的建筑（OSM 偶尔把水上餐厅、码头标成 building）会让整张图看着"泡汤"。
// 判定条件是「在某个外环内」且「不在任何岛（inner）内」。
function onWater(x, z) {
  for (const lake of water) {
    if (!pointInRing(lake.p, x, z)) continue
    let inHole = false
    for (const hole of lake.h) {
      if (pointInRing(hole, x, z)) {
        inHole = true
        break
      }
    }
    if (!inHole) return true
  }
  return false
}

let dropped = 0
const dryBuildings = buildings.filter((building) => {
  let cx = 0
  let cz = 0
  for (const [x, z] of building.p) {
    cx += x
    cz += z
  }
  cx /= building.p.length
  cz /= building.p.length
  if (onWater(cx, cz)) {
    dropped++
    return false
  }
  return true
})
buildings.length = 0
buildings.push(...dryBuildings)

let minX = Infinity
let maxX = -Infinity
let minZ = Infinity
let maxZ = -Infinity
for (const building of buildings) {
  for (const [x, z] of building.p) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
}

const payload = {
  name: '珠江新城 · Guangzhou',
  attribution: '© OpenStreetMap contributors (ODbL)',
  center: [LAT0, LON0],
  bounds: [Math.round(minX), Math.round(minZ), Math.round(maxX), Math.round(maxZ)],
  buildings,
  roads,
  water,
  areas,
}

writeFileSync(outputPath, JSON.stringify(payload))

const heights = buildings.map((b) => b.h).sort((a, b) => a - b)
const tallest = buildings.slice().sort((a, b) => b.h - a.h).slice(0, 5)
const kindCount = {}
for (const area of areas) kindCount[area.t] = (kindCount[area.t] || 0) + 1
console.log(
  `buildings=${buildings.length} roads=${roads.length} water=${water.length} areas=${areas.length} bytes=${
    JSON.stringify(payload).length
  }`,
)
console.log('area kinds:', kindCount)
console.log(`dropped ${dropped} buildings that sat on water`)
console.log(
  `height p50=${heights[Math.floor(heights.length / 2)]} p90=${heights[Math.floor(heights.length * 0.9)]} max=${heights[heights.length - 1]}`,
)
console.log('tallest:', tallest.map((b) => `${b.h}m ${b.k}${b.n ? ` ${b.n}` : ''}`).join(' | '))
console.log('bounds:', payload.bounds)
