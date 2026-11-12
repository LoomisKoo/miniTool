import * as THREE from 'three'
import { W, SURFACE, wallBounds } from './spec.js'
import { mulberry, range } from './rng.js'
import * as Mat from './mat.js'
import { facadeMaterial } from './buildings.js'

function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = false
  m.receiveShadow = true
  return m
}

function box(w, h, d, mat) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat)
}

/**
 * 城墙：外缘车道、内侧水道、分层体量、附着塔楼、窗格阵列、水闸节点。
 */
export function buildWalls(zLen = W.segmentLength) {
  const root = new THREE.Group()
  root.name = 'walls'
  root.add(buildOne('left', zLen))
  root.add(buildOne('right', zLen))
  return root
}

function buildOne(side, zLen) {
  const g = new THREE.Group()
  g.name = `wall-${side}`
  const b = wallBounds(side)
  const H = W.wallHeight
  const T = W.wallThick
  const rng = mulberry(side === 'left' ? 11 : 29)

  // 基座埋进地下，底面不与地表共面
  // 顶面压到地表下 0.6m：以前顶面 = SURFACE，与城内地面/墙外地面共面 → 墙脚一圈闪烁
  const footing = box(T + 16, 4, zLen + 4, Mat.concrete('#1a1e24'))
  footing.position.set(b.cx, SURFACE - 2.6, 0)
  g.add(footing)

  // —— 主体分层（略作退台）——
  const bands = [
    { y0: SURFACE - 1.0, y1: 48, inset: 0, tint: '#2a3038' }, // 底面埋进地下，不在地表留一条共面缝
    { y0: 48, y1: 160, inset: 8, tint: '#3e4854' },
    { y0: 160, y1: 320, inset: 18, tint: '#5a6572' },
    { y0: 320, y1: 460, inset: 28, tint: '#738090' },
    { y0: 460, y1: H, inset: 38, tint: '#8a96a4' },
  ]
  for (const band of bands) {
    const h = band.y1 - band.y0
    const thick = T - band.inset - 0.4
    const m = box(thick, h, zLen - 1, Mat.concrete(band.tint))
    const shift = b.side * (band.inset / 2)
    m.position.set(b.cx + shift, (band.y0 + band.y1) / 2, 0)
    g.add(m)
  }

  // 外侧临海立面：略外挑，避免与主体外皮共面
  const cliff = box(18, H + 20, zLen - 2, Mat.concrete('#14181e'))
  cliff.position.set(b.xOuter - b.side * 12, H / 2 + 4, 0)
  g.add(cliff)

  // 外肋
  {
    const n = Math.floor(zLen / 180)
    const geo = new THREE.BoxGeometry(32, H + 50, 42)
    const inst = new THREE.InstancedMesh(geo, Mat.concrete('#0e1218'), n)
    const d = new THREE.Object3D()
    for (let i = 0; i < n; i++) {
      d.position.set(b.xOuter - b.side * 18, H / 2 + 16, ((i + 0.5) / n - 0.5) * zLen)
      d.updateMatrix()
      inst.setMatrixAt(i, d.matrix)
    }
    g.add(inst)
  }

  // —— 顶部平台 ——
  const topY = H
  const deck = box(T + 20, 12, zLen, Mat.deck())
  deck.position.set(b.cx, topY + 6, 0)
  g.add(deck)

  // 墙顶布局（从外到内）：护墙 | 车道 | 人行道 | 建筑带（buildings.js 生成）| 驳岸 | 水渠 | 栏杆
  const road = box(W.topRoadW, 1.2, zLen, Mat.asphalt())
  road.position.set(b.xOuter - b.side * (W.topRoadW / 2 + 16), topY + 12.6, 0)
  g.add(road)

  // 路缘护墙
  const curb = box(1.6, 3.2, zLen, Mat.concrete('#9aa3ad'))
  curb.position.set(b.xOuter - b.side * 8, topY + 14, 0)
  g.add(curb)

  // 车道内侧人行道
  const walk = box(W.topWalkW, 0.8, zLen, Mat.concrete('#b0b8c2'))
  walk.position.set(b.xOuter - b.side * (16 + W.topRoadW + W.topWalkW / 2 + 0.5), topY + 12.4, 0)
  g.add(walk)

  // 内侧水渠：混凝土 U 形槽（槽底 + 两道槽壁）坐在墙顶平台上，下面再有一排墩子托着；槽里是水
  const cw = W.topCanalW
  // 水渠坐在墙顶平台上（墙内皮往外 6m 起），以前算反了方向 → 悬在城市上空
  const ccx = b.xInner + b.side * (cw / 2 + 6)
  const trough = Mat.concrete('#7c858e')
  const floor = box(cw + 6, 1.4, zLen * 0.995, trough)
  floor.position.set(ccx, topY + 12.0 + 0.7, 0)
  g.add(floor)
  for (const k of [-1, 1]) {
    const side = box(3, 5.2, zLen * 0.995, trough)
    side.position.set(ccx + k * (cw / 2 + 1.5), topY + 12 + 1.4 + 2.6, 0)
    g.add(side)
    // 槽壁压顶 + 栏杆
    const cap = box(3.6, 0.4, zLen * 0.995, Mat.concrete('#a8b0b8'))
    cap.position.set(ccx + k * (cw / 2 + 1.5), topY + 12 + 1.4 + 5.4, 0)
    g.add(cap)
    const railM = box(0.12, 1.1, zLen * 0.995, Mat.metal('#5a626c'))
    railM.position.set(ccx + k * (cw / 2 + 2.9), topY + 12 + 1.4 + 6.15, 0)
    g.add(railM)
  }
  // 水面（低于槽壁 0.8m）
  const water = box(cw, 3.6, zLen * 0.99, Mat.water(false))
  water.position.set(ccx, topY + 12 + 1.4 + 1.8, 0)
  g.add(water)
  // 托墩：墙顶外缘向城内一侧挑出的部分下面加一排墩子（每 30m）
  {
    const n = Math.floor(zLen / 30)
    const geo = new THREE.BoxGeometry(6, 60, 5)
    const inst = new THREE.InstancedMesh(geo, Mat.concrete('#3a424c'), n)
    const dd = new THREE.Object3D()
    for (let i = 0; i < n; i++) {
      dd.position.set(b.xInner - b.side * 2.5, topY - 20.5, ((i + 0.5) / n - 0.5) * zLen) // 顶面埋进平台 0.5m，不与平台顶共面
      dd.updateMatrix()
      inst.setMatrixAt(i, dd.matrix)
    }
    g.add(inst)
  }

  // 内侧立面：用建筑的立面 shader（凹窗 + 室内纵深 + 夜间随机亮灯），不再是贴片窗
  addFacadeSkin(g, b, zLen, bands, T)

  // 附着塔楼（从墙伸向城市，丰富天际线衔接）

  // 顶部塔楼 / 观景体

  // 水闸节点（每侧一座，标志性）
  addSluice(g, b, zLen * (side === 'left' ? -0.18 : 0.22))

  return g
}

function addFacadeSkin(parent, b, zLen, bands, T) {
  // 墙内立面 = 一栋栋「贴墙的楼」：宽 26~70m 的模块，各自风格/凹进深度/高度分段，
  // 模块之间是外凸的结构壁柱，每段顶上有挑出的楼板檐 —— 不再是一整片 120m 的发光格子屏
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const looks = [['#8a96a4', 'ribbon'], ['#a39a8c', 'punch'], ['#7d8a96', 'hotel'], ['#9aa6b2', 'curtain']]
  const mats = looks.map(([c, st]) => facadeMaterial(c, st))
  const per = mats.map(() => [])
  const fins = []
  const slabs = []
  const blanks = []
  const rng = mulberry(b.side > 0 ? 913 : 377)
  for (const band of bands) {
    const thick = T - band.inset - 0.4
    const inner = b.cx + b.side * (band.inset / 2) - b.side * (thick / 2)
    const y0 = Math.max(band.y0, 0.5)
    const H = band.y1 - y0 - 1.5
    if (H < 10) continue
    let z = -zLen / 2 + 4
    while (z < zLen / 2 - 30) {
      const w = Math.min(zLen / 2 - 4 - z, range(rng, 26, 70))
      const zc = z + w / 2
      // 竖向分 1~3 段，每段不同风格/进深
      const nSt = H > 90 ? 1 + ((rng() * 3) | 0) : 1
      let yy = y0
      for (let s = 0; s < nSt; s++) {
        const h = s === nSt - 1 ? y0 + H - yy : Math.max(14, H / nSt * range(rng, 0.7, 1.3))
        if (h < 6) break
        const dep = range(rng, 1.4, 4.2)
        if (rng() < 0.14) blanks.push([inner - b.side * (dep / 2 - 0.4), yy + h / 2, zc, dep, h, w - 2.6])
        else per[(rng() * mats.length) | 0].push([inner - b.side * (dep / 2 - 0.4), yy + h / 2, zc, dep, h, w - 2.6])
        slabs.push([inner - b.side * (dep + 0.6) / 2, yy + h - 0.22, zc, dep + 1.0, 0.6, w - 1.6])
        yy += h
      }
      fins.push([inner - b.side * 2.6, y0 + (H + 1.4) / 2, z, 5.6, H + 1.4, 2.6])
      z += w
    }
  }
  const d = new THREE.Object3D()
  const emit = (arr, mat) => {
    if (!arr.length) return
    const inst = new THREE.InstancedMesh(geo, mat, arr.length)
    arr.forEach(([x, y, z, sx, sy, sz], i) => {
      d.position.set(x, y, z)
      d.scale.set(sx, sy, sz)
      d.updateMatrix()
      inst.setMatrixAt(i, d.matrix)
    })
    inst.computeBoundingSphere()
    inst.receiveShadow = true
    parent.add(inst)
  }
  per.forEach((arr, k) => emit(arr, mats[k]))
  // 壁柱 / 楼板檐 / 实墙模块：同一个材质，逐实例着色，一个 draw
  const all = [...fins, ...slabs, ...blanks]
  const cols = [...fins.map(() => '#5c6670'), ...slabs.map(() => '#9aa2aa'), ...blanks.map(() => '#6e7680')]
  if (all.length) {
    const inst = new THREE.InstancedMesh(geo, Mat.concrete('#ffffff'), all.length)
    const c = new THREE.Color()
    all.forEach(([x, y, z, sx, sy, sz], i) => {
      d.position.set(x, y, z)
      d.scale.set(sx, sy, sz)
      d.updateMatrix()
      inst.setMatrixAt(i, d.matrix)
      inst.setColorAt(i, c.set(cols[i]))
    })
    inst.computeBoundingSphere()
    parent.add(inst)
  }
}

function addWindows(parent, b, zLen) {
  const geo = new THREE.PlaneGeometry(7.5, 3.6)
  const litMat = new THREE.MeshStandardMaterial({ color: '#384850', roughness: 0.3, metalness: 0.2, emissive: '#ffd2a0', emissiveIntensity: 0 })
  Mat.registerMaterial(litMat)
  Mat.registerNight(litMat, 0, 0.75)
  const cols = Math.floor(zLen / 22)
  const rows = 36
  const meshes = [new THREE.InstancedMesh(geo, Mat.windowPanel(), cols * rows), new THREE.InstancedMesh(geo, litMat, cols * rows)]
  const cnt = [0, 0]
  const d = new THREE.Object3D()
  for (let r = 0; r < rows; r++) {
    const y = 56 + r * 11.5
    if (y > W.wallHeight - 50) continue
    for (let c = 0; c < cols; c++) {
      if ((c + r) % 7 === 0) continue
      const z = ((c + 0.5) / cols - 0.5) * zLen * 0.97 + (r % 2) * 5
      d.position.set(b.xInner - b.side * 0.8, y, z)
      d.rotation.set(0, b.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0)
      d.updateMatrix()
      const lit = Math.abs(Math.sin(c * 12.9898 + r * 78.233) * 43758.5453) % 1 < 0.38 ? 1 : 0
      meshes[lit].setMatrixAt(cnt[lit]++, d.matrix)
    }
  }
  meshes.forEach((m, i) => { m.count = cnt[i]; parent.add(m) })
}

function addAttached(parent, b, zLen, rng) {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mats = [Mat.facade('glass', '#dce8f0'), Mat.facade('stone', '#e8e2d8'), Mat.facade('warm', '#ddd0c4')]
  const groups = mats.map((m) => {
    const inst = new THREE.InstancedMesh(geo, m, 90)
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    inst.userData.n = 0
    return inst
  })
  const d = new THREE.Object3D()
  for (let i = 0; i < 120; i++) {
    const depth = range(rng, 50, 200)
    const w = range(rng, 22, 55)
    const h = range(rng, 50, 220)
    const z = (rng() - 0.5) * zLen * 0.92
    const y0 = range(rng, 30, 280)
    const gi = (rng() * groups.length) | 0
    const inst = groups[gi]
    d.position.set(b.xInner - b.side * (depth / 2 + 4), y0 + h / 2, z)
    d.scale.set(depth, h, w)
    // 贴图随体量拉伸：通过 scale 影响不大，材质是共享的；接受
    d.updateMatrix()
    inst.setMatrixAt(inst.userData.n++, d.matrix)
  }
  for (const inst of groups) {
    inst.count = inst.userData.n
    parent.add(inst)
  }
}

function addCrown(parent, b, zLen, rng) {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const inst = new THREE.InstancedMesh(geo, Mat.facade('glass', '#c5d8e6'), 28)
  const d = new THREE.Object3D()
  let n = 0
  for (let i = 0; i < 28; i++) {
    const z = ((i + 0.5) / 28 - 0.5) * zLen * 0.9
    const h = 30 + (i % 6) * 18 + rng() * 40
    const s = 22 + (i % 3) * 8
    d.position.set(b.cx - b.side * range(rng, 20, 80), W.wallHeight + 12 + h / 2, z)
    d.scale.set(s, h, s)
    d.updateMatrix()
    inst.setMatrixAt(n++, d.matrix)
  }
  inst.count = n
  parent.add(inst)
}

function addSluice(parent, b, z) {
  const gate = new THREE.Group()
  const body = box(W.wallThick * 0.9, 120, 90, Mat.concrete('#4a5560'))
  body.position.set(b.cx, 60, z)
  gate.add(body)

  const mouth = box(40, 36, 70, Mat.water(true))
  mouth.position.set(b.xOuter - b.side * 10, 28, z)
  gate.add(mouth)

  const channel = box(W.wallThick + 40, 18, 36, Mat.water(false))
  channel.position.set(b.cx, 22, z)
  gate.add(channel)

  const towers = [ -28, 28 ]
  for (const dz of towers) {
    const t = box(18, 160, 18, Mat.metal('#6a7380'))
    t.position.set(b.xInner - b.side * 30, 80, z + dz)
    gate.add(t)
  }

  // 引水：从闸口顺墙面落入墙脚蓄水池（不再有一条悬在城里的水槽）
  const fall = box(3, 60, 22, Mat.water(true))
  fall.position.set(b.xInner - b.side * 4, 30 + 1, z)
  gate.add(fall)
  const basinWall = box(26, 2.2, 40, Mat.concrete('#6a737c'))
  basinWall.position.set(b.xInner - b.side * 13, 1.1, z)
  gate.add(basinWall)
  const basin = box(24, 0.4, 38, Mat.water(false))
  basin.position.set(b.xInner - b.side * 13, 1.8, z)
  gate.add(basin)

  parent.add(gate)
}
