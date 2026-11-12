import * as THREE from 'three'
import { SURFACE, W } from './spec.js'
import { range } from './rng.js'
import * as Mat from './mat.js'
import * as Signs from './signs.js'

/**
 * 公园设施 + 摩天轮 + 商业街铺装
 */

export function buildAmenities(plan, rng) {
  const root = new THREE.Group()
  root.name = 'amenities'

  // 商业街整条浅色铺装已移除：它压在路中间，看起来像一条莫名其妙的长直线
  root.add(buildParkFacilities(plan, rng))
  if (plan.ferris) root.add(buildFerris(plan.ferris.x, plan.ferris.z))

  return root
}

function buildCommercePavement(plan) {
  const g = new THREE.Group()
  const mat = Mat.concrete('#8f8b85')
  // 商业街铺装到河岸为止，不再横穿河面
  const rEdge = W.riverWidth / 2 + 28
  const len = plan.half - 40 - rEdge
  for (const z of plan.commerceStreets || []) {
    for (const s of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 10), mat)
      walk.position.set(s * (rEdge + len / 2), SURFACE + 0.1, z)
      g.add(walk)
    }
  }
  for (const x of plan.commerceAvenues || []) {
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.14, plan.z1 - plan.z0 - 80),
      Mat.concrete('#8f8b85'),
    )
    walk.position.set(x, SURFACE + 0.1, 0)
    g.add(walk)
  }
  return g
}

function buildParkFacilities(plan, rng) {
  const g = new THREE.Group()
  const boxGeo = new THREE.BoxGeometry(1, 1, 1)
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
  const dummy = new THREE.Object3D()

  function pool(mat, cap) {
    const inst = new THREE.InstancedMesh(boxGeo, mat, cap)
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    inst.userData = { n: 0, cap }
    return inst
  }
  // 公园地坪改为与地面齐平（以前垫高 0.45m 像一块板）：所有园内设施整体下移 0.4m
  const PY = -0.4
  function push(inst, x, y, z, sx, sy, sz, rz = 0, rx = 0) {
    if (inst.userData.n >= inst.userData.cap) return
    dummy.position.set(x, y + PY, z)
    dummy.scale.set(sx, sy, sz)
    dummy.rotation.set(rx, 0, rz)
    dummy.updateMatrix()
    inst.setMatrixAt(inst.userData.n++, dummy.matrix)
  }

  const path = pool(Mat.concrete('#cfc3ad'), 4_000)
  const court = pool(Mat.concrete('#3a6a4a'), 400)
  const sand = pool(Mat.sand(), 400)
  const wood = pool(Mat.concrete('#8a6a48'), 3_000)
  const metal = pool(Mat.metal('#6a727c'), 2_000)
  const water = pool(Mat.water(false), 80)
  const cylPool = (mat, cap) => {
    const inst = new THREE.InstancedMesh(cylGeo, mat, cap)
    inst.userData = { n: 0, cap }
    return inst
  }
  const rim = cylPool(Mat.concrete('#cfc6b4'), 200)
  const waterC = cylPool(Mat.water(false), 100)
  const jetMat = new THREE.MeshStandardMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.55, roughness: 0.1, emissive: '#bfe4ff', emissiveIntensity: 0 })
  Mat.registerMaterial(jetMat)
  Mat.registerNight(jetMat, 0.05, 0.8)
  const jet = cylPool(jetMat, 200)
  const bright = pool(Mat.concrete('#d8c9a8'), 800)
  const lampP = pool(Mat.metal('#3a4048'), 3000)
  const lampHMat = new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#ffd9a0', emissiveIntensity: 0 })
  Mat.registerMaterial(lampHMat)
  Mat.registerNight(lampHMat, 0, 2.6)
  const lampH = pool(lampHMat, 3000)
  const binP = pool(Mat.concrete('#2f5a40'), 1500)
  const soil = pool(Mat.concrete('#5a4636'), 400)
  const edgeP = pool(Mat.concrete('#b4ab9a'), 2000)
  const flowers = ['#e05a7a', '#f2c14e', '#f4f1ea', '#b06ad8', '#ff8a4a'].map((c) => pool(Mat.concrete(c), 4000))
  const redPil = pool(Mat.concrete('#a8302a'), 400)
  const roofP = pool(Mat.concrete('#3f4a52'), 800)
  const goldP = pool(Mat.metal('#d8b04a'), 100)
  const wcP = pool(Mat.concrete('#d8d2c6'), 100)
  const kioskP = pool(Mat.concrete('#e8a030'), 100)
  const fitP = pool(Mat.metal('#5a8ac0'), 3000)
  const fitY = pool(Mat.concrete('#f2c230'), 800)
  const fitR = pool(Mat.concrete('#d84a3a'), 400)
  const fitB = pool(Mat.metal('#3aa06a'), 1000)
  const sign = (k) => {
    const inst = new THREE.InstancedMesh(boxGeo, Signs.facilityMaterial(k), 200)
    inst.userData = { n: 0, cap: 200 }
    return inst
  }
  const boardWC = sign('wc')
  const boardK = sign('kiosk')
  const boardPark = sign('park')
  const lampsOut = []

  const trunkMat = Mat.concrete('#5a4030')
  const canopyMat = Mat.grass('#3f6a3a')
  // 公园树：阔叶（多团冠）/ 伞形大树 / 针叶塔形 / 柱形，冠色逐棵微调；开阔处种大树（16~26m）
  const trunks = new THREE.InstancedMesh(cylGeo, trunkMat, 4_000)
  const canopies = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), canopyMat, 9_000)
  trunks.userData = { n: 0, cap: 4_000 }
  trunks.name = canopies.name = 'parkTrees'
  canopies.userData = { n: 0, cap: 9_000 }
  const tcol = new THREE.Color()
  const TINT = ['#ffffff', '#e8f4dc', '#d6e8c8', '#f4f0d0', '#c8dcc0', '#e0ead0']
  const putI = (inst, x, y, z, sx, sy, sz, col) => {
    const i = inst.userData.n
    if (i >= inst.userData.cap) return
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, rng() * 6.28, 0)
    dummy.scale.set(sx, sy, sz)
    dummy.updateMatrix()
    inst.setMatrixAt(i, dummy.matrix)
    if (col) inst.setColorAt(i, tcol.set(col))
    inst.userData.n++
  }
  function tree(x, z, h) {
    const r = rng()
    const col = TINT[(rng() * TINT.length) | 0]
    const tw = 0.35 + h * 0.03
    if (r < 0.18) {
      // 针叶塔形
      putI(trunks, x, SURFACE + h * 0.15, z, tw, h * 0.3, tw)
      putI(canopies, x, SURFACE + h * 0.4, z, h * 0.2, h * 0.2, h * 0.2, '#b8ccb0')
      putI(canopies, x, SURFACE + h * 0.64, z, h * 0.14, h * 0.18, h * 0.14, '#b8ccb0')
      putI(canopies, x, SURFACE + h * 0.85, z, h * 0.07, h * 0.15, h * 0.07, '#b8ccb0')
    } else if (r < 0.3) {
      // 柱形
      putI(trunks, x, SURFACE + h * 0.15, z, tw, h * 0.3, tw)
      putI(canopies, x, SURFACE + h * 0.6, z, h * 0.14, h * 0.42, h * 0.14, col)
    } else if (r < 0.5) {
      // 伞形（香樟/榕树）：宽而扁
      putI(trunks, x, SURFACE + h * 0.28, z, tw * 1.3, h * 0.56, tw * 1.3)
      putI(canopies, x, SURFACE + h * 0.68, z, h * 0.5, h * 0.2, h * 0.5, col)
      putI(canopies, x + h * 0.18, SURFACE + h * 0.62, z - h * 0.1, h * 0.3, h * 0.16, h * 0.3, col)
    } else {
      // 阔叶多团冠
      putI(trunks, x, SURFACE + h * 0.3, z, tw, h * 0.6, tw)
      putI(canopies, x, SURFACE + h * 0.7, z, h * 0.32, h * 0.3, h * 0.32, col)
      putI(canopies, x + h * 0.15, SURFACE + h * 0.78, z + h * 0.06, h * 0.23, h * 0.22, h * 0.23, col)
    }
  }

  for (const b of plan.blocks) {
    if (b.kind !== 'park' && b.kind !== 'riverbank' && b.kind !== 'plaza') continue
    if (b.kind === 'riverbank') {
      // 以前整块草地盖过河面，河只在路口露出来 → 看起来是一截截的。现在只铺两岸陆地
      const rb = W.riverWidth / 2 + 30
      for (const s of [-1, 1]) {
        const xa = s < 0 ? b.x0 : rb
        const xb = s < 0 ? -rb : b.x1
        if (xb - xa < 8) continue
        const pad = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, 0.4, Math.max(8, b.d - 2)), Mat.grass('#5a7a52'))
        pad.position.set((xa + xb) / 2, SURFACE - 0.14, b.cz)
        g.add(pad)
        const n = Math.floor(((xb - xa) * b.d) / 900)
        for (let i = 0; i < n; i++) tree(range(rng, xa + 4, xb - 4), range(rng, b.z0 + 6, b.z1 - 6), range(rng, 7, 14))
      }
      continue
    }
    const isPlaza = b.kind === 'plaza'
    const mega = !!(b.mega || (b.span ?? 1) > 1)

    // 底板：跨格公园/广场盖住中间那截路，打断网格感
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(8, b.w - 2), 0.4, Math.max(8, b.d - 2)),
      isPlaza
        ? Mat.concrete('#c4b8a4')
        : b.kind === 'riverbank'
          ? Mat.grass('#5a7a52')
          : Mat.grass('#4f7348'),
    )
    pad.position.set(b.cx, SURFACE - 0.14, b.cz)
    g.add(pad)
    // 包边路缘石（低矮，草地与人行道分界）
    for (const s of [-1, 1]) {
      push(edgeP, b.cx, SURFACE + 0.48, b.cz + s * (Math.max(8, b.d - 2) / 2), Math.max(8, b.w - 2), 0.16, 0.3)
      push(edgeP, b.cx + s * (Math.max(8, b.w - 2) / 2), SURFACE + 0.48, b.cz, 0.3, 0.16, Math.max(8, b.d - 2))
    }
    // 大广场由 buildings.placePlaza 做成「抬高平台 + 下沉庭院」，这里只铺底
    if (isPlaza && b.w > 90 && b.d > 80) continue

    const pathW = Math.min(mega ? 10 : 6, b.w * 0.08)
    push(path, b.cx, SURFACE + 0.48, b.cz, Math.max(8, b.w - 16), 0.12, pathW)
    push(path, b.cx, SURFACE + 0.48, b.cz, pathW, 0.12, Math.max(8, b.d - 16))

    // 中心硬质广场 / 喷泉（广场类型更大）
    if (b.w > 70 && b.d > 70) {
      const pw = Math.min(isPlaza || mega ? 70 : 36, b.w * (isPlaza ? 0.45 : 0.28))
      const pd = Math.min(isPlaza || mega ? 55 : 28, b.d * (isPlaza ? 0.4 : 0.24))
      push(bright, b.cx, SURFACE + 0.5, b.cz, pw, 0.14, pd)
      // 圆形喷泉：石沿 + 水池 + 中心喷柱 + 水花
      const fr = Math.min(8, Math.min(pw, pd) * 0.14)
      push(rim, b.cx, SURFACE + 0.75, b.cz, fr * 2 + 1.2, 0.6, fr * 2 + 1.2)
      push(waterC, b.cx, SURFACE + 0.92, b.cz, fr * 2, 0.4, fr * 2)
      push(rim, b.cx, SURFACE + 1.5, b.cz, 1.6, 1.4, 1.6)
      push(jet, b.cx, SURFACE + 3.0, b.cz, 0.5, 3.4, 0.5)
      push(jet, b.cx, SURFACE + 4.6, b.cz, 2.2, 0.9, 2.2)
    }

    if (b.w > 90 && b.d > 70 && rng() < (mega ? 0.75 : 0.55)) {
      const ox = b.cx + range(rng, -b.w * 0.22, b.w * 0.22)
      const oz = b.cz + range(rng, -b.d * 0.22, b.d * 0.22)
      const cw = mega ? 36 : 28
      const cd = mega ? 20 : 15
      push(court, ox, SURFACE + 0.46, oz, cw, 0.12, cd)
      push(metal, ox - cw / 2, SURFACE + 2, oz, 0.15, 3.5, 0.15)
      push(metal, ox + cw / 2, SURFACE + 2, oz, 0.15, 3.5, 0.15)
      push(metal, ox, SURFACE + 3.6, oz, cw + 0.2, 0.12, 0.12)
    }

    if (!isPlaza && b.w > 60 && rng() < 0.65) {
      const ox = b.x0 + b.w * 0.28
      const oz = b.z0 + b.d * 0.3
      push(sand, ox, SURFACE + 0.48, oz, mega ? 16 : 12, 0.25, mega ? 12 : 9)
      push(wood, ox + 2, SURFACE + 1.4, oz - 1, 0.25, 2.4, 0.25)
      push(wood, ox + 2, SURFACE + 2.5, oz + 1.2, 0.2, 0.2, 4.2)
      push(bright, ox - 2, SURFACE + 0.9, oz + 1, 2.2, 1.2, 2.2)
    }

    if (b.w > 50) {
      const bx = b.cx + b.w * 0.22
      const bz = b.cz - b.d * 0.18
      push(wood, bx, SURFACE + 2.8, bz, mega ? 16 : 10, 0.25, mega ? 6 : 4)
      for (const s of [-1, 1]) {
        push(wood, bx + s * (mega ? 6 : 4.2), SURFACE + 1.4, bz + 1.5, 0.25, 2.6, 0.25)
        push(wood, bx + s * (mega ? 6 : 4.2), SURFACE + 1.4, bz - 1.5, 0.25, 2.6, 0.25)
      }
      for (let i = -2; i <= 2; i++) {
        push(wood, bx + i * 2.2, SURFACE + 0.55, bz + 3.5, 1.6, 0.12, 0.45)
        push(wood, bx + i * 2.2, SURFACE + 0.85, bz + 3.7, 1.6, 0.4, 0.1)
      }
    }

    // ── 公园配套：环路长椅 / 庭院灯 / 垃圾桶 / 花坛 / 凉亭 / 公厕 / 小卖部 / 健身器材 / 游乐设施 / 入口标识 ──
    if (!isPlaza || b.w > 60) {
      const ix0 = b.x0 + 8, ix1 = b.x1 - 8, iz0 = b.z0 + 8, iz1 = b.z1 - 8
      // 环形步道
      push(path, b.cx, SURFACE + 0.48, iz0, ix1 - ix0, 0.12, 3)
      push(path, b.cx, SURFACE + 0.48, iz1, ix1 - ix0, 0.12, 3)
      push(path, ix0, SURFACE + 0.48, b.cz, 3, 0.12, iz1 - iz0)
      push(path, ix1, SURFACE + 0.48, b.cz, 3, 0.12, iz1 - iz0)
      // 沿路：灯 22m 一盏，长椅/垃圾桶穿插
      const along = (x0, z0, x1, z1, ox, oz) => {
        const L = Math.hypot(x1 - x0, z1 - z0)
        const n = Math.floor(L / 22)
        for (let i = 0; i <= n; i++) {
          const t = n ? i / n : 0.5
          const x = x0 + (x1 - x0) * t
          const z = z0 + (z1 - z0) * t
          push(lampP, x + ox * 2.2, SURFACE + 2.2, z + oz * 2.2, 0.14, 4.0, 0.14)
          push(lampH, x + ox * 2.2, SURFACE + 4.55, z + oz * 2.2, 0.5, 0.5, 0.5)
          lampsOut.push(x + ox * 2.2, SURFACE + 4.2, z + oz * 2.2)
          const mx = x + (x1 - x0) / Math.max(1, n) * 0.5
          const mz = z + (z1 - z0) / Math.max(1, n) * 0.5
          if (i < n) {
            const ax = Math.abs(ox) > 0
            push(wood, mx + ox * 2.4, SURFACE + 0.92, mz + oz * 2.4, ax ? 0.5 : 1.8, 0.07, ax ? 1.8 : 0.5)
            push(wood, mx + ox * 2.7, SURFACE + 1.15, mz + oz * 2.7, ax ? 0.06 : 1.8, 0.4, ax ? 1.8 : 0.06)
            push(metal, mx + ox * 2.4, SURFACE + 0.7, mz + oz * 2.4, ax ? 0.4 : 1.6, 0.42, ax ? 1.6 : 0.4)
            if (i % 2 === 0) push(binP, mx + ox * 2.4 + (ax ? 0 : 1.6), SURFACE + 0.9, mz + oz * 2.4 + (ax ? 1.6 : 0), 0.5, 0.85, 0.5)
          }
        }
      }
      along(ix0, iz0, ix1, iz0, 0, 1)
      along(ix0, iz1, ix1, iz1, 0, -1)
      along(ix0, iz0, ix0, iz1, 1, 0)
      along(ix1, iz0, ix1, iz1, -1, 0)
      // 花坛：几块弯曲轮廓的花境（土 + 花丛）
      const nb = Math.min(6, 2 + Math.floor((b.w * b.d) / 9000))
      for (let i = 0; i < nb; i++) {
        const fx = range(rng, ix0 + 10, ix1 - 10)
        const fz = range(rng, iz0 + 10, iz1 - 10)
        if (Math.hypot(fx - b.cx, fz - b.cz) < 20) continue
        const fw = range(rng, 4, 9)
        const fd = range(rng, 2, 4)
        push(soil, fx, SURFACE + 0.47, fz, fw, 0.1, fd)
        push(edgeP, fx, SURFACE + 0.5, fz - fd / 2, fw + 0.3, 0.16, 0.18)
        push(edgeP, fx, SURFACE + 0.5, fz + fd / 2, fw + 0.3, 0.16, 0.18)
        const nf = Math.floor(fw * fd * 1.4)
        for (let k = 0; k < nf; k++) push(flowers[(rng() * flowers.length) | 0], fx + range(rng, -fw * 0.45, fw * 0.45), SURFACE + 0.68, fz + range(rng, -fd * 0.42, fd * 0.42), 0.4, 0.3, 0.4)
      }
      if (!isPlaza && b.w > 70 && b.d > 60) {
        // 凉亭（中式：红柱 + 两层收分屋顶 + 宝顶）
        const px = b.x1 - b.w * 0.24
        const pz = b.z1 - b.d * 0.26
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) push(redPil, px + sx * 2.2, SURFACE + 2.0, pz + sz * 2.2, 0.32, 3.2, 0.32)
        push(roofP, px, SURFACE + 3.8, pz, 6.6, 0.35, 6.6)
        push(roofP, px, SURFACE + 4.25, pz, 5.0, 0.4, 5.0)
        push(roofP, px, SURFACE + 4.7, pz, 3.2, 0.4, 3.2)
        push(roofP, px, SURFACE + 5.1, pz, 1.4, 0.4, 1.4)
        push(goldP, px, SURFACE + 5.55, pz, 0.4, 0.5, 0.4)
        push(bright, px, SURFACE + 0.6, pz, 5.4, 0.3, 5.4)
        for (let i = -1; i <= 1; i += 2) push(wood, px + i * 1.6, SURFACE + 0.95, pz, 0.45, 0.06, 3.6)
        // 公厕
        const wx = b.x0 + b.w * 0.16
        const wz = b.z1 - 14
        push(wcP, wx, SURFACE + 2.0, wz, 9, 3.2, 5)
        push(roofP, wx, SURFACE + 3.75, wz, 9.8, 0.3, 5.8)
        push(boardWC, wx, SURFACE + 2.9, wz - 2.62, 3.2, 0.8, 0.1)
        for (const s of [-1, 1]) push(metal, wx + s * 2.2, SURFACE + 1.4, wz - 2.55, 1.0, 2.0, 0.06)
        // 小卖部
        const kx = b.cx + Math.min(30, b.w * 0.2)
        const kz = iz0 + 6
        push(kioskP, kx, SURFACE + 1.7, kz, 4, 2.6, 3)
        push(roofP, kx, SURFACE + 3.15, kz - 0.4, 4.8, 0.2, 4.2)
        push(boardK, kx, SURFACE + 2.6, kz - 1.53, 3.2, 0.8, 0.1)
        push(bright, kx, SURFACE + 1.0, kz - 1.7, 3.6, 0.1, 0.5)
        // 健身器材区
        const gx = ix0 + 14
        const gz = b.cz - Math.min(26, b.d * 0.2)
        push(court, gx, SURFACE + 0.47, gz, 12, 0.1, 8)
        for (let i = 0; i < 4; i++) {
          const ex = gx - 4.5 + i * 3
          push(fitP, ex - 0.6, SURFACE + 1.4, gz, 0.12, 2.0, 0.12)
          push(fitP, ex + 0.6, SURFACE + 1.4, gz, 0.12, 2.0, 0.12)
          push(fitP, ex, SURFACE + 2.3 - (i % 2) * 0.8, gz, 1.3, 0.1, 0.1)
          push(fitY, ex, SURFACE + 0.9, gz + 2.2, 0.8, 0.4, 0.3)
        }
      }
      if (!isPlaza && b.w > 60) {
        // 儿童游乐：滑梯（台 + 梯 + 斜槽）、秋千架、攀爬架
        const ox = b.x0 + b.w * 0.28
        const oz = b.z0 + b.d * 0.3
        push(fitY, ox - 3, SURFACE + 1.7, oz + 2.5, 1.6, 0.15, 1.6)
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) push(fitP, ox - 3 + sx * 0.7, SURFACE + 1.1, oz + 2.5 + sz * 0.7, 0.1, 1.4, 0.1)
        push(fitR, ox - 3 + 2.1, SURFACE + 1.05, oz + 2.5, 3.2, 0.1, 0.9, -0.5)
        push(fitP, ox - 3 - 1.2, SURFACE + 1.1, oz + 2.5, 0.08, 1.6, 0.6, 0.35)
        push(fitP, ox + 3, SURFACE + 2.0, oz - 2, 3.6, 0.12, 0.12)
        for (const s of [-1, 1]) push(fitP, ox + 3 + s * 1.8, SURFACE + 1.2, oz - 2, 0.12, 2.4, 0.12)
        for (const s of [-0.7, 0.7]) {
          push(fitP, ox + 3 + s, SURFACE + 1.35, oz - 2, 0.03, 1.3, 0.03)
          push(fitR, ox + 3 + s, SURFACE + 0.85, oz - 2, 0.5, 0.06, 0.25)
        }
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) push(fitB, ox + i * 0.9 - 0.9, SURFACE + 0.9 + j * 0.6, oz + 4.5, 0.06, 0.06, 2.4)
      }
      // 入口标识牌（南侧主入口）
      push(boardPark, b.cx + 6, SURFACE + 1.8, b.z0 + 3, 4.8, 1.2, 0.15)
      push(metal, b.cx + 6, SURFACE + 0.9, b.z0 + 3, 0.12, 1.4, 0.12)
    }
    // 广场少树，公园按面积种；跨格更多
    const treeMul = isPlaza ? 0.35 : 1
    const trees = Math.floor((6 + (b.w * b.d) / (mega ? 2200 : 2800)) * treeMul)
    for (let i = 0; i < trees; i++) {
      const x = b.x0 + 10 + rng() * Math.max(4, b.w - 20)
      const z = b.z0 + 10 + rng() * Math.max(4, b.d - 20)
      if (Math.hypot(x - b.cx, z - b.cz) < (mega ? 28 : 16)) continue
      tree(x, z, range(rng, 7, 16))
    }
    // 开阔草坪上的孤植大树（大公园 2~5 棵）
    if (!isPlaza && b.w > 80 && b.d > 80) {
      const nb = 2 + ((rng() * (mega ? 4 : 2)) | 0)
      for (let i = 0; i < nb; i++) {
        const x = b.x0 + b.w * range(rng, 0.2, 0.8)
        const z = b.z0 + b.d * range(rng, 0.2, 0.8)
        if (Math.hypot(x - b.cx, z - b.cz) < 30) continue
        tree(x, z, range(rng, 16, 26))
      }
    }
  }

  // 跨格大塔/商场场地铺一层场地底板，盖住被吞掉的路
  for (const b of plan.blocks) {
    if (!b.mega) continue
    if (b.kind !== 'core' && b.kind !== 'high' && b.kind !== 'mall') continue
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(b.w - 4, 0.55, b.d - 4),
      Mat.concrete('#9a9590'),
    )
    deck.position.set(b.cx, SURFACE + 0.28, b.cz)
    g.add(deck)
  }

  for (const inst of [path, court, sand, wood, metal, water, bright, lampP, lampH, binP, soil, edgeP, ...flowers, redPil, roofP, goldP, wcP, kioskP, fitP, fitY, fitR, fitB, boardWC, boardK, boardPark, rim, waterC, jet]) {
    inst.count = inst.userData.n
    g.add(inst)
  }
  trunks.count = trunks.userData.n
  canopies.count = canopies.userData.n
  g.add(trunks, canopies)
  g.userData.lamps = new Float32Array(lampsOut)
  return g
}

/** 简化摩天轮：支架 + 轮盘 + 吊舱（可被 main 转动） */
export function buildFerris(x, z) {
  const g = new THREE.Group()
  g.name = 'ferris'
  g.position.set(x, SURFACE, z)

  const R = 48
  const hubY = R + 8
  const steel = Mat.metal('#8a929c')
  const dark = Mat.metal('#4a5058')
  const cabinMat = Mat.concrete('#e8dcc8')

  // 站台
  const deck = new THREE.Mesh(new THREE.BoxGeometry(70, 0.5, 28), Mat.concrete('#6e7378'))
  deck.position.set(0, 0.25, 0)
  g.add(deck)

  // A 字支架
  for (const side of [-1, 1]) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, hubY + 2, 1.2), steel)
      leg.position.set(s * 18, (hubY + 2) / 2, side * 6)
      leg.rotation.z = s * -0.35
      g.add(leg)
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(28, 0.8, 0.8), steel)
    cross.position.set(0, hubY * 0.45, side * 6)
    g.add(cross)
  }

  // 可旋转轮盘
  const wheel = new THREE.Group()
  wheel.name = 'ferrisWheel'
  wheel.position.set(0, hubY, 0)
  g.add(wheel)

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 5, 16), dark)
  hub.rotation.x = Math.PI / 2
  wheel.add(hub)

  const spokes = 16
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.45, R - 2, 0.45), steel)
    spoke.position.set(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, 0)
    spoke.rotation.z = a - Math.PI / 2
    wheel.add(spoke)
  }

  // 外圈分段
  const rimSeg = 32
  for (let i = 0; i < rimSeg; i++) {
    const a0 = (i / rimSeg) * Math.PI * 2
    const a1 = ((i + 1) / rimSeg) * Math.PI * 2
    const am = (a0 + a1) / 2
    const chord = 2 * R * Math.sin(Math.PI / rimSeg)
    const rim = new THREE.Mesh(new THREE.BoxGeometry(chord, 0.7, 1.1), dark)
    rim.position.set(Math.cos(am) * R, Math.sin(am) * R, 0)
    rim.rotation.z = am
    wheel.add(rim)
  }

  // 吊舱（挂在 rim 上，自身保持水平靠动画）
  const cabins = []
  const CAB = 12
  for (let i = 0; i < CAB; i++) {
    const a = (i / CAB) * Math.PI * 2
    const hold = new THREE.Group()
    hold.position.set(Math.cos(a) * (R - 1.2), Math.sin(a) * (R - 1.2), 0)
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 2.4), cabinMat)
    hold.add(box)
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.4, 0.1),
      Mat.glass(),
    )
    glass.position.set(0, 0.2, 1.25)
    hold.add(glass)
    wheel.add(hold)
    cabins.push(hold)
  }

  // 售票亭
  const booth = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 3.4), Mat.concrete('#cfc6b6'))
  booth.position.set(-22, 1.6, 10)
  g.add(booth)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.3, 4), Mat.concrete('#8d8272'))
  roof.position.set(-22, 3.35, 10)
  g.add(roof)

  g.userData = { wheel, cabins, hubY }
  return g
}

/** 每帧转轮；吊舱反向转以保持直立 */
export function tickFerris(ferris, dt) {
  if (!ferris?.userData?.wheel) return
  const { wheel, cabins } = ferris.userData
  wheel.rotation.z += dt * 0.12
  for (const c of cabins) c.rotation.z = -wheel.rotation.z
}
