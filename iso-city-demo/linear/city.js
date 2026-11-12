import * as THREE from 'three'
import { W, SURFACE } from './spec.js'
import { mulberry } from './rng.js'
import * as Mat from './mat.js'
import { buildBuildings } from './buildings.js'
import { buildAmenities } from './amenities.js'
import { buildStreetLife } from './street.js'
import { buildBoats } from './boats.js'

import { chunkify } from './perf.js'

// t34 城市底板 / 滨水广场：克隆后加世界坐标分格 + 斑驳（不污染共享的 concrete 缓存）
let _gm = null, _pm = null
const reg = (m) => (Mat.registerMaterial(m), m)
const GROUND_MAT = () => _gm || (_gm = Mat.groundCraft(reg(Mat.concrete('#cdbb9c').clone()), 'ground'))
const PLAZA_MAT = () => _pm || (_pm = Mat.groundCraft(reg(Mat.concrete('#d6c4a2').clone()), 'slab'))

/**
 * 街道 / 河 / 公园设施 / 沿街密建 / 桥
 */
export function buildCity(plan, seed = 77) {
  const root = new THREE.Group()
  root.name = 'city'
  const rng = mulberry(seed)

  // 地面分两半，中间留出河道（河面低于路面 6m）
  for (const s of [-1, 1]) {
    const gw = (W.cityWidth - 2) / 2 - W.riverWidth / 2 - 2.2
    const ground = new THREE.Mesh(new THREE.BoxGeometry(gw, 3, W.segmentLength - 2), GROUND_MAT()) // t32 暖砂岩铺地（以前 #8f8b85 灰板）
    ground.position.set(s * (W.riverWidth / 2 + 2.2 + gw / 2), SURFACE - 1.5, 0)
    ground.receiveShadow = true
    root.add(ground)
  }

  root.add(buildRoads(plan))
  root.add(buildRiver())
  const amen = buildAmenities(plan, rng)
  root.add(amen)
  const buildings = buildBuildings(plan, seed)
  root.add(buildings)
  root.userData.buildings = buildings
  // 公园设施 / 摩天轮底座等也进碰撞（按包围盒，过滤地面薄片与细杆）
  {
    const addS = buildings.userData.addSolid
    amen.updateMatrixWorld(true)
    const bb = new THREE.Box3()
    const m4 = new THREE.Matrix4()
    const reg = () => {
      const sx = bb.max.x - bb.min.x
      const sy = bb.max.y - bb.min.y
      const sz = bb.max.z - bb.min.z
      if (sy < 1.0 || bb.max.y < SURFACE + 1.0 || bb.min.y > SURFACE + 2.5 || sx > 120 || sz > 120 || sx < 0.2 || sz < 0.2) return
      addS((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2, sx, sz, bb.max.y, bb.min.y)
    }
    amen.traverse((o) => {
      if (!o.isMesh || !o.geometry) return
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m4)
          m4.premultiply(o.matrixWorld)
          bb.copy(o.geometry.boundingBox).applyMatrix4(m4)
          reg()
        }
      } else {
        bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)
        reg()
      }
    })
  }
  const bridges = buildBridges(plan)
  root.add(bridges)
  root.userData.bridgeLamps = bridges.userData.lamps
  const boats = buildBoats(plan)
  root.add(boats)
  root.userData.boats = boats
  const street = buildStreetLife(plan, seed + 14, [bridges.userData.lamps, amen.userData.lamps])
  root.add(street)
  root.userData.streetLife = street
  root.userData.queryWalk = buildWalkGrid(root, buildings)
  // 性能：整城一份的静态实例（标线/路缘/灯杆/公园小件）按块拆开 + 视距裁剪
  const lampLook = street.children.filter((o) => o.isInstancedMesh && o.name === 'lampGlow')
  chunkify(street.children.filter((o) => o.isInstancedMesh && !lampLook.includes(o)), { chunk: 1000, dist: 800 })
  // 路灯地面光斑：远处就该看得见（以前 800m 才出现，走近突然冒出来）；每块只有 2 个三角，按 2.5km 大块拆，draw 不涨
  chunkify(lampLook, { chunk: 2500, dist: 3400 })
  // 桥上灯头（自发光小件）远处会成闪烁亮点 → 视距裁剪
  const bridgeLamps = []
  bridges.traverse((o) => { if (o.isInstancedMesh && o.material?.emissive && o.material.emissive.getHex() !== 0) bridgeLamps.push(o) })
  chunkify(bridgeLamps, { chunk: 1000, dist: 1200 })
  const amenInst = []
  const inFerris = (o) => { for (let p = o; p; p = p.parent) if (p.name === 'ferris') return true; return false }
  amen.traverse((o) => { if (o.isInstancedMesh && !inFerris(o)) amenInst.push(o) })
  const trees = amenInst.filter((o) => o.name === 'parkTrees')
  chunkify(trees, { chunk: 1000, dist: 2400 })
  chunkify(amenInst.filter((o) => !trees.includes(o)), { chunk: 1000, dist: 900 })

  return root
}

/**
 * 可站立面网格：人行道 / 路缘 / 台阶 / 一层平台 / 河岸步道 / 桥面……
 * 主角每步取脚下“不高于 maxY 的最高面”，脚不再陷进高出路面的小平台
 */
function buildWalkGrid(root, buildings) {
  const CELL = 16
  const grid = new Map()
  const rects = []
  const add = (x0, z0, x1, z1, top) => {
    const r = [x0, z0, x1, z1, top]
    rects.push(r)
    const i0 = Math.floor(x0 / CELL)
    const i1 = Math.floor(x1 / CELL)
    const j0 = Math.floor(z0 / CELL)
    const j1 = Math.floor(z1 / CELL)
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = (i + 4096) * 8192 + (j + 4096)
      let a = grid.get(k)
      if (!a) grid.set(k, (a = []))
      a.push(r)
    }
  }
  const skip = new Set(['traffic', 'furniture', 'pedestrians'])
  const bb = new THREE.Box3()
  const m4 = new THREE.Matrix4()
  const take = () => {
    const sy = bb.max.y - bb.min.y
    const top = bb.max.y
    if (top <= SURFACE + 0.05 || top > SURFACE + 1.3 || sy > 1.6 || sy < 0.03) return
    if (bb.max.x - bb.min.x < 0.3 || bb.max.z - bb.min.z < 0.3) return
    add(bb.min.x, bb.min.z, bb.max.x, bb.max.z, top)
  }
  root.updateMatrixWorld(true)
  const visit = (o) => {
    if (o === buildings || skip.has(o.name)) return
    if (o.isMesh && o.geometry) {
      const mat = o.material
      if (!(mat && (mat.transparent && mat.blending === THREE.AdditiveBlending))) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
        if (o.isInstancedMesh) {
          const n = o.count
          for (let i = 0; i < n; i++) {
            o.getMatrixAt(i, m4)
            m4.premultiply(o.matrixWorld)
            bb.copy(o.geometry.boundingBox).applyMatrix4(m4)
            take()
          }
        } else {
          bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)
          take()
        }
      }
    }
    for (const c of o.children) visit(c)
  }
  visit(root)
  for (const w of buildings.userData.walks || []) add(w.x - w.w / 2, w.z - w.d / 2, w.x + w.w / 2, w.z + w.d / 2, w.y)
  return (x, z, maxY) => {
    const a = grid.get((Math.floor(x / CELL) + 4096) * 8192 + (Math.floor(z / CELL) + 4096))
    let g = SURFACE
    if (!a) return g
    for (let k = 0; k < a.length; k++) {
      const r = a[k]
      if (r[4] > maxY || r[4] <= g) continue
      if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) g = r[4]
    }
    return g
  }
}

/** [a,b] 去掉 holes 后剩下的区段 */
function cutSpan(a, b, holes) {
  const hs = holes.filter(([h0, h1]) => h1 > a && h0 < b).sort((p, q) => p[0] - q[0])
  const out = []
  let cur = a
  for (const [h0, h1] of hs) { if (h0 > cur) out.push([cur, h0]); cur = Math.max(cur, h1) }
  if (b > cur) out.push([cur, b])
  return out.filter(([p, q]) => q - p > 1)
}

function buildRoads(plan) {
  const g = new THREE.Group()
  // 大设施地块里的干道整段取消；园区内部道路段由下面单独画（窄一号）
  const closed = [...(plan.closed || []), ...(plan.inner || [])]
  for (const x of plan.avenues) {
    // 大设施地块内部的道路整段取消
    const holes = closed.filter((r) => x > r.x0 && x < r.x1).map((r) => [r.z0, r.z1])
    for (const [z0, z1] of cutSpan(-W.segmentLength / 2, W.segmentLength / 2, holes)) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(W.avenueW, 0.12, z1 - z0), Mat.asphalt())
      road.position.set(x, SURFACE + 0.06, (z0 + z1) / 2)
      road.receiveShadow = true
      g.add(road)
    }
  }
  // 横街到河岸为止（不再从水面下穿过去把河切成一段段）；过河的只有桥
  const rEdge = W.riverWidth / 2 + 28
  const len = (W.cityWidth - 20) / 2 - rEdge
  for (const z of plan.streets) {
    const holes = closed.filter((r) => z > r.z0 && z < r.z1).map((r) => [r.x0, r.x1])
    for (const s of [-1, 1]) {
      const a0 = s < 0 ? -(rEdge + len) : rEdge
      for (const [x0, x1] of cutSpan(a0, a0 + len, holes)) {
        const road = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.12, W.streetW), Mat.asphalt())
        road.position.set((x0 + x1) / 2, SURFACE + 0.035, z) // 比大道低 2.5cm，路口不再共面闪烁
        road.receiveShadow = true
        g.add(road)
      }
    }
  }
  // 园区内部道路：沿原干道中线，车行道收窄（大道 14m / 横街 8m），路面高度与原干道一致（车不用抬升）
  for (const r of plan.inner || []) {
    const len = r.hi - r.lo
    const mid = (r.lo + r.hi) / 2
    const road = r.axis === 'z'
      ? new THREE.Mesh(new THREE.BoxGeometry(r.cw, 0.12, len), Mat.asphalt())
      : new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, r.cw), Mat.asphalt())
    if (r.axis === 'z') road.position.set(r.at, SURFACE + 0.06, mid)
    else road.position.set(mid, SURFACE + 0.035, r.at)
    road.receiveShadow = true
    road.name = 'innerRoad'
    g.add(road)
  }
  return g
}

/** 河面高度：低于路面 6m，桥下有净空（船能过），驳岸是真正的石砌河墙 */
export const RIVER_WATER_Y = SURFACE - 6

function buildRiver() {
  const g = new THREE.Group()
  const len = W.segmentLength * 0.98
  const RW = W.riverWidth
  // 河床（深色，防止透过水面看到底下空）
  const bed = new THREE.Mesh(new THREE.BoxGeometry(RW + 2, 2, len), Mat.concrete('#1c2a2e'))
  bed.position.set(0, RIVER_WATER_Y - 4.5, 0)
  g.add(bed)
  // 水面：薄盒，顶面 = RIVER_WATER_Y；波纹/反射在 Mat.water 的 shader 里
  const water = new THREE.Mesh(new THREE.BoxGeometry(RW, 0.6, len), Mat.water(false))
  water.position.set(0, RIVER_WATER_Y - 0.3, 0)
  water.name = 'riverWater'
  g.add(water)

  for (const s of [-1, 1]) {
    // 石砌河墙（从河床到岸顶）+ 压顶
    const wallH = 0.45 - (RIVER_WATER_Y - 3.5)
    const qw = new THREE.Mesh(new THREE.BoxGeometry(2.2, wallH, len), Mat.concrete('#7a7266'))
    qw.position.set(s * (RW / 2 + 1.1), 0.45 - wallH / 2, 0)
    g.add(qw)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, len * 0.98), Mat.concrete('#b8b0a2'))
    cap.position.set(s * (RW / 2 + 0.7), 0.58, 0)
    g.add(cap)
    // 水位线附近的深色水渍带
    const stain = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, len), Mat.concrete('#3a3a34'))
    stain.position.set(s * (RW / 2 + 0.0), RIVER_WATER_Y + 0.4, 0)
    g.add(stain)

    const bank = new THREE.Mesh(
      new THREE.BoxGeometry(28, 1.3, W.segmentLength * 0.96),
      PLAZA_MAT(), // t32 滨水广场石台：暖米色（以前 #8a8478 灰板）
    )
    bank.position.set(s * (RW / 2 + 14), SURFACE - 0.225, 0) // 顶面比驳岸压顶低 2.5cm，不共面
    g.add(bank)

    // （滨河绿地板已删：与 amenities 的滨河绿地两层同高叠在一起 → 草地闪烁）
    const walk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.12, W.segmentLength * 0.88), Mat.concrete('#cfc3ad'))
    walk.position.set(s * (RW / 2 + 42), SURFACE + 0.07, 0)
    g.add(walk)
  }
  return g
}

/** 桥灯光斑贴图 */
let bridgeGlowTex = null
function glowTexture() {
  if (bridgeGlowTex) return bridgeGlowTex
  // 逐像素生成（Safari canvas 渐变有彩色抖动）
  bridgeGlowTex = Mat.radialTex(128, (t) => Math.max(0, (Math.exp(-4.5 * t * t) - Math.exp(-4.5)) / (1 - Math.exp(-4.5))))
  return bridgeGlowTex
}

/** 一组实例盒子（可带任意旋转） */
function boxSet(mat, list) {
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, Math.max(1, list.length))
  const d = new THREE.Object3D()
  list.forEach(([x, y, z, sx, sy, sz, rz = 0, ry = 0], i) => {
    d.position.set(x, y, z)
    d.rotation.set(0, ry, rz)
    d.scale.set(sx, sy, sz)
    d.updateMatrix()
    inst.setMatrixAt(i, d.matrix)
  })
  inst.count = list.length
  inst.computeBoundingSphere()
  inst.receiveShadow = true
  return inst
}

/**
 * 桥：桥面与路面齐平（车/人照常走），三种造型轮换：
 *  石拱桥（三孔弧拱 + 拱上实腹）/ 钢系杆拱（桥面上方大拱 + 吊杆）/ 斜拉桥（中塔 + 扇形拉索）
 * 每座都有栏杆（立柱 + 扶手）、人行道、桥头灯柱，夜里灯头发光 + 桥面光斑
 */
function buildBridges(plan) {
  const g = new THREE.Group()
  const picks = plan.streets.filter((_, i) => i % 3 === 1)
  const L = W.riverWidth + 60
  const RW = W.riverWidth
  const stone = Mat.concrete('#a89c88')
  const stoneDark = Mat.concrete('#8a7e6c')
  const steel = Mat.metal('#d0d4d8')
  const steelRed = Mat.metal('#a8382c')
  const railM = Mat.metal('#3a4048')
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#ffd9a0', emissiveIntensity: 0 })
  Mat.registerMaterial(lampHeadMat)
  Mat.registerNight(lampHeadMat, 0, 2.8)
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffb46a', map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  Mat.registerFade(glowMat, 0, 0.4)
  const lamps = []
  picks.forEach((z, bi) => {
    const type = bi % 3
    const deckMat = type === 0 ? stone : Mat.deck()
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 20), deckMat)
    deck.position.set(0, SURFACE - 0.3, z)
    g.add(deck)
    const road = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, W.streetW - 4), Mat.asphalt())
    road.position.set(0, SURFACE + 0.2, z)
    g.add(road)
    // 人行道
    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(L, 0.22, 2.4), Mat.concrete('#c4bcae'))
      sw.position.set(0, SURFACE + 0.26, z + s * 8.6)
      g.add(sw)
    }
    // 栏杆：立柱每 2m + 上下扶手（石桥用石栏板）
    const posts = []
    for (const s of [-1, 1]) {
      for (let x = -L / 2 + 1; x <= L / 2 - 1; x += 2) posts.push([x, SURFACE + 0.9, z + s * 9.75, type === 0 ? 0.35 : 0.08, type === 0 ? 1.1 : 1.0, type === 0 ? 0.35 : 0.08])
    }
    g.add(boxSet(type === 0 ? stoneDark : railM, posts))
    for (const s of [-1, 1]) {
      const hr = new THREE.Mesh(new THREE.BoxGeometry(L, type === 0 ? 0.25 : 0.08, type === 0 ? 0.42 : 0.1), type === 0 ? stone : railM)
      hr.position.set(0, SURFACE + 1.5, z + s * 9.75)
      g.add(hr)
      if (type !== 0) {
        const mid = new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, 0.06), railM)
        mid.position.set(0, SURFACE + 0.85, z + s * 9.75)
        g.add(mid)
      } else {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(L, 0.7, 0.18), stone)
        panel.position.set(0, SURFACE + 0.85, z + s * 9.75)
        g.add(panel)
      }
    }
    // 桥灯：两侧每 24m 一根（错开），灯头 + 桥面光斑
    const lampPoles = []
    const heads = []
    const glows = []
    for (const s of [-1, 1]) {
      for (let x = -L / 2 + 6 + (s > 0 ? 12 : 0); x < L / 2 - 4; x += 24) {
        const px = x
        const pz = z + s * 9.75
        if (type === 0) {
          lampPoles.push([px, SURFACE + 2.6, pz, 0.22, 3.4, 0.22])
          heads.push([px, SURFACE + 4.5, pz, 0.6, 0.7, 0.6])
        } else {
          lampPoles.push([px, SURFACE + 4, pz, 0.16, 6.4, 0.16])
          lampPoles.push([px, SURFACE + 7.1, pz - s * 0.9, 0.08, 0.08, 1.8])
          heads.push([px, SURFACE + 7.0, pz - s * 1.7, 0.45, 0.16, 0.8])
        }
        glows.push([px, SURFACE + 0.4, pz - s * 3, 26, 0.01, 26])
        lamps.push(px, SURFACE + (type === 0 ? 4.2 : 6.7), pz - s * (type === 0 ? 0 : 1.7))
      }
    }
    g.add(boxSet(type === 0 ? stoneDark : railM, lampPoles))
    g.add(boxSet(lampHeadMat, heads))
    const gl = boxSet(glowMat, glows)
    gl.renderOrder = 2
    g.add(gl)

    const yW = SURFACE - 6
    if (type === 0) {
      // 石拱桥：三孔弧拱（拱券 = 一圈楔块），拱上实腹墙，河中两座桥墩带分水尖
      const span = RW / 3
      const rise = 5.0
      const R = (span * span / 4 + rise * rise) / (2 * rise)
      const spring = yW - 0.4
      const vous = []
      const fill = []
      for (let k = 0; k < 3; k++) {
        const c = -RW / 2 + span * (k + 0.5)
        const n = 18
        const a0 = Math.asin(span / 2 / R)
        for (let i = 0; i < n; i++) {
          const a = -a0 + (2 * a0) * ((i + 0.5) / n)
          const x = c + Math.sin(a) * R
          const yy = spring + Math.cos(a) * R - (R - rise)
          const seg = (2 * a0 * R) / n
          for (const s of [-1, 1]) vous.push([x, yy + 0.45, z + s * 9.6, seg * 1.04, 0.9, 0.8, -a])
          // 拱上实腹：从拱背到桥面下
          const top = SURFACE - 0.75
          const h = top - (yy + 0.9)
          if (h > 0.1) fill.push([x, yy + 0.9 + h / 2, z, seg * 1.02, h, 19.2])
        }
      }
      for (const px of [-RW / 2 + span, -RW / 2 + span * 2]) {
        fill.push([px, (spring - 3 + SURFACE - 0.75) / 2, z, 4.2, SURFACE - 0.75 - (spring - 3), 20])
        for (const s of [-1, 1]) fill.push([px, spring + 1.0, z + s * 10.6, 3.0, 8, 3.0, 0, Math.PI / 4])
      }
      g.add(boxSet(stoneDark, vous))
      g.add(boxSet(stone, fill))
    } else if (type === 1) {
      // 钢系杆拱：两条拱肋在桥面上方，吊杆每 8m，端部桥墩
      const half = RW / 2
      const rise = 26
      const R = (half * half + rise * rise) / (2 * rise)
      const ribs = []
      const hangers = []
      const n = 40
      const a0 = Math.asin(half / R)
      for (const s of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          const a = -a0 + 2 * a0 * ((i + 0.5) / n)
          const x = Math.sin(a) * R
          const yy = SURFACE + 0.5 + Math.cos(a) * R - (R - rise)
          ribs.push([x, yy, z + s * 10.4, (2 * a0 * R) / n * 1.05, 1.4, 1.0, -a])
        }
        for (let x = -half + 8; x < half - 4; x += 8) {
          const yy = SURFACE + 0.5 + Math.sqrt(R * R - x * x) - (R - rise)
          hangers.push([x, (SURFACE + 0.5 + yy) / 2, z + s * 10.4, 0.12, yy - SURFACE - 0.5, 0.12])
        }
      }
      // 拱顶横撑
      for (let x = -half * 0.5; x <= half * 0.5; x += half * 0.25) {
        const yy = SURFACE + 0.5 + Math.sqrt(R * R - x * x) - (R - rise)
        ribs.push([x, yy, z, 0.8, 0.8, 20.8])
      }
      for (const s of [-1, 1]) {
        hangers.push([s * (half + 2), (yW - 2 + SURFACE - 0.75) / 2, z, 5, SURFACE - 0.75 - yW + 2, 22])
      }
      const girder = new THREE.Mesh(new THREE.BoxGeometry(L, 1.4, 20.6), steelRed)
      girder.position.set(0, SURFACE - 1.0, z)
      g.add(girder)
      g.add(boxSet(steelRed, ribs))
      g.add(boxSet(steel, hangers))
    } else {
      // 斜拉桥：中央 H 形塔 + 两侧扇形拉索，塔下河中桥墩
      const H = 48
      const parts = []
      const cables = []
      for (const s of [-1, 1]) parts.push([0, SURFACE + H / 2, z + s * 10.8, 1.8, H, 1.8])
      parts.push([0, SURFACE + H * 0.62, z, 1.4, 1.4, 23])
      parts.push([0, SURFACE + H - 1, z, 1.4, 1.6, 23])
      parts.push([0, (yW - 2 + SURFACE - 0.75) / 2, z, 6, SURFACE - 0.75 - yW + 2, 24])
      for (const s of [-1, 1]) {
        for (let i = 1; i <= 9; i++) {
          for (const dir of [-1, 1]) {
            const x1 = dir * i * 8.5
            const y1 = SURFACE + 0.6
            const x0 = 0
            const y0 = SURFACE + H - 3 - i * 1.6
            const dx = x1 - x0
            const dy = y1 - y0
            const len = Math.hypot(dx, dy)
            cables.push([(x0 + x1) / 2, (y0 + y1) / 2, z + s * 10.8, len, 0.1, 0.1, Math.atan2(dy, dx)])
          }
        }
      }
      const girder = new THREE.Mesh(new THREE.BoxGeometry(L, 1.2, 20.6), Mat.concrete('#9aa0a6'))
      girder.position.set(0, SURFACE - 0.95, z)
      g.add(girder)
      g.add(boxSet(Mat.concrete('#d8dce0'), parts))
      g.add(boxSet(steel, cables))
      // 塔顶航空灯
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), lampHeadMat)
      tl.position.set(0, SURFACE + H + 0.6, z)
      g.add(tl)
    }
  })
  g.userData.lamps = new Float32Array(lamps)
  return g
}
