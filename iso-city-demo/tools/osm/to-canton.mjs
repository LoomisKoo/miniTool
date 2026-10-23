#!/usr/bin/env node
/**
 * OSM 珠江新城北岸楼群 → canton.html 用的场景坐标。
 *
 *   node tools/osm/to-canton.mjs
 *
 * canton 场景是手工建模的图鉴尺度，不是真实比例。这里选一个统一缩放，
 * 让西塔 / 东塔这两个已知锚点和 OSM 里的真实坐标对上：
 *
 *   OSM 西塔 x=-737m, 东塔 x=-174m（相对投影中心）
 *   场景 西塔 x=+2,   东塔 x=+44
 *   → k = (44-2) / (-174 - -737) = 0.0746
 *
 * 高度同理按 k 缩，所以 200m 的楼在场景里是 16 单位高，刚好和手写的
 * 普通高层（15~26 单位）一个量级。
 *
 * 输出只保留落在北岸条带里的楼；地标位置上的楼会被丢掉，避免和手写精模穿模。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'src/data/osm-city.json'
const OUT = 'canton-osm.json'

const K = 0.082
const OX = 62.4
const OZ = -36.2

// 北岸条带（场景坐标）
const Z_NEAR = -38 // 靠江一侧
const Z_FAR = -172 // 靠黄埔大道一侧
const X_MIN = -152
const X_MAX = 152

// 手写地标的落脚点：这些位置上的 OSM 楼丢掉，否则会和精模重叠
const LANDMARKS = [
  [2, -54], // 西塔
  [44, -56], // 东塔
  [40, -42], // 省博
  [-27, -40], // 大剧院
  [-52, -44], // 图书馆
  [-70, -96], // 珠江城
  [74, -104], // 广晟
  [22, -140],
  [-8, -106],
  [37, -5],
]

/** 楼高下限：CBD 里没有 5 米的小平房，估出来的矮楼要多抬一点才不像盒子。 */
const MIN_HEIGHT = 55

/**
 * 高度补偿。
 *
 * OSM 在珠江新城只有 183 栋标了 building:levels、14 栋标了 height，
 * 其余是按类型估的，估出来的重心明显偏低（p50 只有 40m）。
 * 真实北岸是 100~200m 的塔楼和近百米的高层住宅，所以这里整体抬 45%，
 * 只影响观感，不影响楼的位置和轮廓——那两样是实测的。
 */
const HEIGHT_GAIN = 1.45

/**
 * 超过这个高度的楼直接丢掉。
 *
 * 珠江新城的 200m+ 超高层在 canton 里全是手写精模（东西塔、广晟、珠江城、
 * 利通…），OSM 里同一栋楼的轮廓大概率已经被那批精模盖住。留着会变成
 * "手写塔旁边又贴了一座油桶"，比缺一栋更难看。
 */
const TALLEST_IMPORTED = 180

function nearLandmark(x, z) {
  for (const [lx, lz] of LANDMARKS) {
    if (Math.hypot(x - lx, z - lz) < 9.5) return true
  }
  return false
}

function area(ring) {
  let total = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    total += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(total) / 2
}

const data = JSON.parse(readFileSync(SRC, 'utf8'))
const out = []
let droppedOutside = 0
let droppedLandmark = 0

for (const building of data.buildings) {
  const ring = building.p
  if (ring.length < 3) continue

  let cx = 0
  let cz = 0
  for (const [x, z] of ring) {
    cx += x
    cz += z
  }
  cx /= ring.length
  cz /= ring.length

  const sx = cx * K + OX
  const sz = cz * K + OZ
  if (sz > Z_NEAR || sz < Z_FAR || sx < X_MIN || sx > X_MAX) {
    droppedOutside++
    continue
  }
  if (nearLandmark(sx, sz)) {
    droppedLandmark++
    continue
  }
  if (building.h > TALLEST_IMPORTED) {
    droppedLandmark++
    continue
  }

  const points = ring.map(([x, z]) => [Math.round((x * K + OX) * 100) / 100, Math.round((z * K + OZ) * 100) / 100])
  // 缩到场景尺度后，很多小楼只剩 1~2 单位，画出来是一堆碎渣；按面积丢
  if (Math.abs(area(points)) < 0.9) continue

  const height = Math.max(building.h, MIN_HEIGHT) * HEIGHT_GAIN * K
  out.push([points, Math.round(height * 100) / 100, building.k])
}

// 数据类型计数，前端按这个选墙面材质
const kinds = {}
for (const [, , kind] of out) kinds[kind] = (kinds[kind] || 0) + 1

const payload = {
  note: 'OpenStreetMap 珠江新城北岸楼群，已缩放到 canton 场景坐标。© OpenStreetMap contributors (ODbL)',
  scale: K,
  buildings: out,
}

writeFileSync(OUT, JSON.stringify(payload))
console.log(`kept ${out.length} buildings (${OUT})`)
console.log(`dropped ${droppedOutside} outside bank, ${droppedLandmark} on landmarks`)
console.log('kinds:', kinds)

const heights = out.map((b) => b[1]).sort((a, b) => a - b)
console.log(`height p50=${heights[Math.floor(heights.length / 2)]} max=${heights[heights.length - 1]}`)
