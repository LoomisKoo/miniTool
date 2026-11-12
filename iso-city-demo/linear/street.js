import * as THREE from 'three'
import { W, SURFACE } from './spec.js'
import { mulberry, pick, range } from './rng.js'
import * as Mat from './mat.js'
import { buildCarKit, PART_KEYS } from './cars.js'

/**
 * 道路细节：人行道 / 标线 / 斑马线 / 红绿灯 + 车流
 */
export function buildStreetLife(plan, seed = 91, extraLamps = null) {
  const root = new THREE.Group()
  root.name = 'streetLife'
  const rng = mulberry(seed)

  const boxGeo = new THREE.BoxGeometry(1, 1, 1)
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
  const dummy = new THREE.Object3D()

  function pool(mat, cap) {
    const inst = new THREE.InstancedMesh(boxGeo, mat, cap)
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    inst.castShadow = false
    inst.receiveShadow = true
    inst.userData = { n: 0, cap }
    return inst
  }

  // 大设施合并地块里的路已取消：人行道/路缘/路灯/标线/斑马线等一律不放
  const closedAt = (x, z) => !!plan.isClosed?.(x, z)
  function push(inst, x, y, z, sx, sy, sz, yaw = 0, force = false) {
    if (inst.userData.n >= inst.userData.cap) return
    if (!force && closedAt(x, z)) return
    dummy.position.set(x, y, z)
    dummy.scale.set(sx, sy, sz)
    dummy.rotation.set(0, yaw, 0)
    dummy.updateMatrix()
    inst.setMatrixAt(inst.userData.n++, dummy.matrix)
  }

  const paint = pool(Mat.concrete('#e8e6dc'), 160_000)
  const yellow = pool(Mat.concrete('#e0c040'), 40_000)
  // 标线只看得到顶面：用单面片（盒子 12 个三角 → 2 个），面片放在原盒子顶面高度
  {
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.5, 0)
    paint.geometry = flat
    yellow.geometry = flat
  }
  const walk = pool(Mat.concrete('#d2c2a4'), 40_000) // t32 暖色人行道砖
  const curb = pool(Mat.concrete('#bcb2a0'), 40_000) // 浅花岗岩路缘
  const pole = pool(Mat.metal('#4a5058'), 8_000)
  const sigMat = (hex, emis) => {
    const m = new THREE.MeshStandardMaterial({ color: hex, emissive: emis, emissiveIntensity: 0, roughness: 0.4 })
    Mat.registerMaterial(m)
    Mat.registerNight(m, 0, 1.9)
    return m
  }
  const signalR = pool(sigMat('#5a1418', '#ff3048'), 4_000)
  const signalY = pool(sigMat('#5a4a14', '#ffd15c'), 4_000)
  const signalG = pool(sigMat('#145a2a', '#3dff8a'), 4_000)
  const housing = pool(Mat.metal('#2e3238'), 4_000)
  // 路灯：夜里成一串暖黄光点，整条街的骨架就出来了
  const lampPole = pool(Mat.metal('#3c424a'), 90_000)
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: '#2a2722', emissive: '#ffd9a0', emissiveIntensity: 0, roughness: 0.5, metalness: 0.4,
  })
  Mat.registerMaterial(lampHeadMat)
  Mat.registerNight(lampHeadMat, 0, 2.6)
  const lampHead = pool(lampHeadMat, 45_000)
  // 路灯光斑：径向衰减贴图 + 加色混合，替代以前的一块平板亮片
  // 高斯衰减并在边缘归零（导数也趋零）：光斑没有可见轮廓；相邻光斑叠加 → 整条路一层淡淡的环境光
  // 逐像素精确生成（canvas 渐变在 Safari 里带彩色抖动噪声 → 路灯下满地彩色碎点）
  const E = Math.exp(-4.5)
  const glowTex = Mat.radialTex(256, (t) => Math.max(0, (Math.exp(-4.5 * t * t) - E) / (1 - E)) * (1 - t * t * t * t))
  const lampGlowMat = new THREE.MeshBasicMaterial({
    color: '#ffb46a', map: glowTex, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })
  Mat.registerFade(lampGlowMat, 0, 0.36)
  const lampGlow = pool(lampGlowMat, 45_000)
  lampGlow.name = 'lampGlow'
  lampGlow.geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2) // 贴地光斑只要一个面（盒子 12 个三角）
  lampHead.name = 'lampHead'

  const riverHalf = W.riverWidth / 2 + 40
  const zLen = W.segmentLength
  const xLen = W.cityWidth - 40
  const aw = W.avenueW
  const sw = W.streetW
  // 标线：贴地薄片（6mm），略高于大道路面（+0.12），不再是凸起的条
  const yPaint = SURFACE + 0.134
  const yPaintS = SURFACE + 0.106 // 横街路面顶 +0.095
  const yWalk = SURFACE + 0.18

  // —— 人行道 + 路缘 ——
  // 人行道在路口断开（以前整条穿过横向车道，路口叠成一块块浅色板 + 共面闪烁）
  const cut = (a, b, holes) => {
    const hs = holes.filter(([h0, h1]) => h1 > a && h0 < b).sort((p, q) => p[0] - q[0])
    const out = []
    let cur = a
    for (const [h0, h1] of hs) { if (h0 > cur) out.push([cur, h0]); cur = Math.max(cur, h1) }
    if (b > cur) out.push([cur, b])
    return out.filter(([p, q]) => q - p > 1)
  }
  const streetHoles = plan.streets.map((z) => [z - sw / 2 - 0.1, z + sw / 2 + 0.1])
  const avenueHoles = plan.avenues.map((x) => [x - aw / 2 - 0.1, x + aw / 2 + 0.1])
  for (const x of plan.avenues) {
    for (const s of [-1, 1]) {
      for (const [z0, z1] of cut(-zLen * 0.49, zLen * 0.49, streetHoles)) {
        const mz = (z0 + z1) / 2
        push(walk, x + s * (aw / 2 + 3.2), yWalk, mz, 5.8, 0.16, z1 - z0)
        push(curb, x + s * (aw / 2 + 0.2), yWalk - 0.005, mz, 0.3, 0.17, z1 - z0)
      }
    }
  }
  for (const z of plan.streets) {
    for (const s of [-1, 1]) {
      // 河面打断
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -xLen / 2 : riverHalf
        const x1 = side < 0 ? -riverHalf : xLen / 2
        const cx = (x0 + x1) / 2
        const len = x1 - x0
        if (len < 40) continue
        for (const [a0, a1] of cut(x0, x1, avenueHoles)) {
          const mx = (a0 + a1) / 2
          push(walk, mx, yWalk, z + s * (sw / 2 + 3.0), a1 - a0, 0.16, 5.2)
          push(curb, mx, yWalk - 0.005, z + s * (sw / 2 + 0.2), a1 - a0, 0.17, 0.3)
        }
      }
    }
  }

  // —— 路灯：两侧交错、间距 28m（避开路口），夜里光斑真的铺满路面；位置留给主角/车的实时点光 ——
  const lampStep = 28
  // 街道设施占位登记（出生点/传送点避开灯杆、树、长椅、停的车……）
  const PCELL = 16
  const propGrid = new Map()
  const addProp = (x, z, r) => {
    const k = Math.floor(x / PCELL) * 4096 + Math.floor(z / PCELL)
    let a = propGrid.get(k)
    if (!a) propGrid.set(k, (a = []))
    a.push(x, z, r)
  }
  root.userData.propClear = (x, z, r) => {
    const cx = Math.floor(x / PCELL)
    const cz = Math.floor(z / PCELL)
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = propGrid.get((cx + i) * 4096 + cz + j)
      if (!a) continue
      for (let k = 0; k < a.length; k += 3) if (Math.hypot(x - a[k], z - a[k + 1]) < r + a[k + 2]) return false
    }
    return true
  }
  const lampY = SURFACE + 6.2
  const lamps = []
  const nearX = (v) => plan.avenues.some((a) => Math.abs(a - v) < aw / 2 + 8)
  const nearZ = (v) => plan.streets.some((s2) => Math.abs(s2 - v) < sw / 2 + 8)
  const lamp = (px, pz, hx, hz, alongZ, force = false) => {
    if (!force && closedAt(px, pz)) return
    addProp(px, pz, 0.35)
    push(lampPole, px, SURFACE + 3.2, pz, 0.18, 6.4, 0.18, 0, force)
    if (alongZ) push(lampPole, (px + hx) / 2, lampY + 0.15, pz, Math.abs(hx - px) + 0.2, 0.08, 0.08, 0, force)
    else push(lampPole, px, lampY + 0.15, (pz + hz) / 2, 0.08, 0.08, Math.abs(hz - pz) + 0.2, 0, force)
    push(lampHead, hx, lampY, hz, alongZ ? 0.9 : 0.45, 0.18, alongZ ? 0.45 : 0.9, 0, force)
    push(lampGlow, hx, SURFACE + 0.27, hz, 52.0, 0.01, 52.0, 0, force)
    lamps.push(hx, lampY - 0.3, hz)
  }
  for (const x of plan.avenues) {
    for (const s of [-1, 1]) {
      const px = x + s * (aw / 2 + 1.0)
      for (let z = -zLen / 2 + 50 + (s > 0 ? lampStep / 2 : 0); z < zLen / 2 - 50; z += lampStep) {
        if (nearZ(z)) continue
        lamp(px, z, px - s * 1.6, z, true)
      }
    }
  }
  for (const z of plan.streets) {
    for (const s of [-1, 1]) {
      const pz = z + s * (sw / 2 + 0.9)
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -xLen / 2 + 50 : riverHalf + 20
        const x1 = side < 0 ? -riverHalf - 20 : xLen / 2 - 50
        for (let x = x0 + (s > 0 ? lampStep / 2 : 0); x < x1; x += lampStep) {
          if (nearX(x)) continue
          lamp(x, pz, x, pz - s * 1.4, false)
        }
      }
    }
  }
  // —— 园区内部道路：路缘 + 两侧人行道 + 标线 + 路灯（比干道窄一号，但路的语言齐全：车一看就是在路上开）——
  for (const r of plan.inner || []) {
    const zA = r.axis === 'z'
    const len = r.hi - r.lo
    const mid = (r.lo + r.hi) / 2
    const yP = zA ? yPaint : yPaintS
    const P = (inst, off, along, y, wAcross, h, lAlong) => (zA
      ? push(inst, r.at + off, y, along, wAcross, h, lAlong, 0, true)
      : push(inst, along, y, r.at + off, lAlong, h, wAcross, 0, true))
    for (const s of [-1, 1]) {
      P(curb, s * (r.cw / 2 + 0.15), yWalk - 0.005, mid, 0.3, 0.17, len)
      P(walk, s * (r.cw / 2 + 0.3 + r.walk / 2), yWalk, mid, r.walk, 0.16, len)
      // 白色路缘线
      P(paint, s * (r.cw / 2 - 0.35), yP, mid, 0.15, 0.006, len - 2)
      // 路灯：单侧交错，每 30m 一根
      for (let a = r.lo + 12 + (s > 0 ? 15 : 0); a < r.hi - 8; a += 30) {
        const off = s * (r.cw / 2 + 0.7)
        const hoff = s * (r.cw / 2 - 0.8)
        if (zA) lamp(r.at + off, a, r.at + hoff, a, true, true)
        else lamp(a, r.at + off, a, r.at + hoff, false, true)
      }
    }
    if (r.type === 'avenue') {
      // 双向四车道：黄色中线 + 两侧车道虚线
      P(yellow, 0, yP, mid, 0.25, 0.006, len - 2)
      for (const s of [-1, 1]) for (let a = r.lo + 3; a < r.hi - 4; a += 9) P(paint, s * 3.6, yP, a + 2, 0.15, 0.006, 4)
    } else {
      // 双向两车道：黄色中心虚线
      for (let a = r.lo + 3; a < r.hi - 4; a += 8) P(yellow, 0, yP, a + 1.75, 0.18, 0.006, 3.5)
    }
    // 园区出入口：两端各一道停止线
    for (const e of [r.lo + 1.2, r.hi - 1.2]) P(paint, 0, yP + 0.002, e, r.cw - 1, 0.006, 0.4)
  }
  // 桥灯 / 公园庭院灯也进最近灯查询（夜里主角走过时有真实点光）
  if (extraLamps) for (const arr of extraLamps) if (arr) for (let i = 0; i < arr.length; i++) lamps.push(arr[i])
  root.userData.lamps = new Float32Array(lamps)
  {
    // 灯头柔光（点精灵，夜间淡入）：像空气里的一团光晕，不是一个硬亮点
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lamps), 3))
    const haloMat = new THREE.PointsMaterial({ map: glowTex, color: '#ffd29a', size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    Mat.registerFade(haloMat, 0, 0.55)
    const halos = new THREE.Points(pg, haloMat)
    halos.name = 'lampHalos'
    root.add(halos)
  }
  {
    // 最近路灯查询（给主角附近的实时点光用）：60m 网格
    const cell = 60
    const grid = new Map()
    for (let i = 0; i < lamps.length; i += 3) {
      const k = Math.floor(lamps[i] / cell) * 4096 + Math.floor(lamps[i + 2] / cell)
      let a = grid.get(k)
      if (!a) grid.set(k, (a = []))
      a.push(i)
    }
    const best = []
    root.userData.nearLamps = (x, z, n, out) => {
      best.length = 0
      const cx = Math.floor(x / cell)
      const cz = Math.floor(z / cell)
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
        const a = grid.get(i * 4096 + j)
        if (!a) continue
        for (const idx of a) best.push(idx)
      }
      best.sort((p, q) => (lamps[p] - x) ** 2 + (lamps[p + 2] - z) ** 2 - (lamps[q] - x) ** 2 - (lamps[q + 2] - z) ** 2)
      out.length = 0
      for (let k = 0; k < Math.min(n, best.length); k++) out.push(lamps[best[k]], lamps[best[k] + 1], lamps[best[k] + 2])
      return out
    }
  }
  function dashAlongZ(x, z0, z1, width, mat, dash = 4.2, gap = 5.5) {
    for (let z = z0; z < z1; z += dash + gap) {
      const len = Math.min(dash, z1 - z)
      if (len < 1.2) continue
      push(mat, x, yPaint, z + len / 2, width, 0.006, len)
    }
  }
  // 步行街/酒吧街整条铺石材：下面的车道标线不画（否则远处透过铺装闪出一截截黄线）
  const pedSt = (plan.districts || []).filter((d) => d.id === 'walk' || d.id === 'bar')
  const underPave = (x, z) => pedSt.some((d) => z === d.street && x > d.x0 - 2 && x < d.x1 + 2)
  function dashAlongX(z, x0, x1, width, mat, dash = 4.2, gap = 5.5) {
    for (let x = x0; x < x1; x += dash + gap) {
      const len = Math.min(dash, x1 - x)
      if (len < 1.2 || underPave(x + len / 2, z)) continue
      push(mat, x + len / 2, yPaintS, z, len, 0.006, width)
    }
  }
  function solidAlongZ(x, z0, z1, width, mat) {
    const step = 80
    for (let z = z0; z < z1; z += step) {
      const len = Math.min(step, z1 - z)
      push(mat, x, yPaint, z + len / 2, width, 0.006, len)
    }
  }
  function solidAlongX(z, x0, x1, width, mat) {
    const step = 80
    for (let x = x0; x < x1; x += step) {
      const len = Math.min(step, x1 - x)
      push(mat, x + len / 2, yPaintS, z, len, 0.006, width)
    }
  }

  for (const x of plan.avenues) {
    // 标准标线：单条黄色中线 + 每侧一条车道虚线（去掉双黄并行线、贴路缘的白边线）；路口内不画
    for (const [z0, z1] of cut(-zLen / 2 + 20, zLen / 2 - 20, plan.streets.map((z) => [z - sw / 2 - 6.5, z + sw / 2 + 6.5]))) {
      solidAlongZ(x, z0, z1, 0.3, yellow)
      for (const s of [-1, 1]) dashAlongZ(x + s * (aw * 0.25), z0, z1, 0.18, paint)
    }
  }

  for (const z of plan.streets) {
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -xLen / 2 + 20 : riverHalf + 10
      const x1 = side < 0 ? -riverHalf - 10 : xLen / 2 - 20
      if (x1 - x0 < 40) continue
      // 横街只留中心虚线（车道分隔），路口内不画
      for (const [a0, a1] of cut(x0, x1, plan.avenues.map((x) => [x - aw / 2 - 6.5, x + aw / 2 + 6.5]))) dashAlongX(z, a0, a1, 0.2, yellow, 3.5, 4.5)
    }
  }

  // —— 路口斑马线 + 红绿灯（隔一个路口，控制实例数）——
  const bridgeZs = new Set((plan.streets || []).filter((_, i) => i % 3 === 1))
  const commerceZ = new Set(plan.commerceStreets || [])
  let ix = 0
  for (const x of plan.avenues) {
    let iz = 0
    for (const z of plan.streets) {
      if (Math.abs(x) < W.riverWidth / 2 + 60) { iz++; continue }
      // 斑马线：只在路口、横跨车道（条纹顺着车流方向），条宽 0.5m、间距 0.5m、人行横道宽 4m
      const stripe = 0.5
      const gap = 0.5
      const XW = 4.0
      const nA = Math.floor((aw - 1.2) / (stripe + gap))
      const nS = Math.floor((sw - 1.0) / (stripe + gap))
      for (const sz of [-1, 1]) {
        // 横穿大道的人行横道：位于横街两侧人行道的延长线上
        const zz = z + sz * (sw / 2 + 0.6 + XW / 2)
        for (let i = 0; i < nA; i++) push(paint, x - (nA - 1) * (stripe + gap) / 2 + i * (stripe + gap), yPaint + 0.002, zz, stripe, 0.006, XW)
        // 停止线
        push(paint, x + sz * (aw * 0.25), yPaint + 0.002, z + sz * (sw / 2 + 0.6 + XW + 1.2), aw * 0.46, 0.006, 0.4)
      }
      for (const sx of [-1, 1]) {
        const xx = x + sx * (aw / 2 + 0.6 + XW / 2)
        for (let i = 0; i < nS; i++) push(paint, xx, yPaintS, z - (nS - 1) * (stripe + gap) / 2 + i * (stripe + gap), XW, 0.006, stripe)
        push(paint, x + sx * (aw / 2 + 0.6 + XW + 1.2), yPaintS, z - sx * (sw * 0.25), 0.4, 0.006, sw * 0.46)
      }

      // 红绿灯：只在商业街 / 隔路口，两角即可
      if (commerceZ.has(z) || (ix + iz) % 3 === 0) {
        for (const [sx, sz] of [[-1, -1], [1, 1]]) {
          const px = x + sx * (aw / 2 + 1.1)
          const pz = z + sz * (sw / 2 + 1.1)
          push(pole, px, SURFACE + 3.4, pz, 0.22, 6.8, 0.22)
          addProp(px, pz, 0.4)
          const armLen = 3.6
          push(pole, px - sx * armLen / 2, SURFACE + 6.5, pz, armLen, 0.18, 0.18)
          const hx = px - sx * (armLen - 0.4)
          push(housing, hx, SURFACE + 6.15, pz, 0.55, 1.4, 0.4)
          push(signalR, hx, SURFACE + 6.55, pz - sz * 0.22, 0.38, 0.28, 0.12)
          push(signalY, hx, SURFACE + 6.15, pz - sz * 0.22, 0.38, 0.28, 0.12)
          push(signalG, hx, SURFACE + 5.75, pz - sz * 0.22, 0.38, 0.28, 0.12)
        }
      }
      iz++
    }
    ix++
  }

  // （桥面中线标记已去掉：和横街中心虚线重复，成了一条莫名的长白线）
  void bridgeZs

  for (const inst of [paint, yellow, walk, curb, pole, signalR, signalY, signalG, housing, lampPole, lampHead, lampGlow]) {
    inst.count = inst.userData.n
    if (inst.count > 0) root.add(inst)
  }

  // —— 车流 ——
  const carKit = buildCarKit()
  // 先放家具（公交站登记 plan.busStops），再建车流（公交按站停靠）
  plan.busStops = []
  const furn = buildFurniture(plan, rng, glowTex, carKit, addProp)
  root.add(furn.group)
  root.userData.furniture = furn
  const traffic = buildTraffic(plan, rng, carKit)
  root.add(traffic.group)
  root.userData.traffic = traffic
  const peds = buildPedestrians(plan, rng)
  root.add(peds.group)
  root.userData.peds = peds

  return root
}

const CAR_COLORS = [
  '#c8ccd2', '#2a3038', '#8a1a18', '#1a3a6a', '#d8d0c0',
  '#3a6a48', '#c09030', '#4a5560', '#e8e4dc', '#5a2a2a',
]

// ───────────────────────── 车流：围绕主角 ~450m 内循环，按车道行驶、跟车、红绿灯 ─────────────────────────
function buildTraffic(plan, rng, kit) {
  const group = new THREE.Group()
  group.name = 'traffic'
  const dummy = new THREE.Object3D()
  const N = 130 // 以前 300：路上太挤
  // 车型配比（每种车一组实例：车漆/玻璃/杂件/前灯/尾灯）
  const MIX = [['sedan', 0.4], ['suv', 0.22], ['hatch', 0.17], ['taxi', 0.12], ['van', 0.09]]
  const NBUS = 16 // 公交：只走大道外侧（靠站）车道，逐站停靠
  const typeOf = []
  for (let i = 0; i < NBUS; i++) typeOf.push('bus')
  for (let i = NBUS; i < N; i++) {
    let r = rng()
    let t = MIX[MIX.length - 1][0]
    for (const [k, w] of MIX) { if (r < w) { t = k; break } r -= w }
    typeOf.push(t)
  }
  const meshes = {}
  const idxOf = []
  const tint = new THREE.Color()
  for (const k of Object.keys(kit.types)) {
    const n = typeOf.filter((t) => t === k).length
    if (!n) continue
    const T = kit.types[k]
    meshes[k] = PART_KEYS.map((pk) => {
      const m = new THREE.InstancedMesh(T[pk], kit.mats[pk], n)
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.frustumCulled = false
      group.add(m)
      return m
    })
    const pal = kit.colors[k] || kit.colors.default
    for (let j = 0; j < n; j++) {
      tint.set(pal[(rng() * pal.length) | 0])
      meshes[k][0].setColorAt(j, tint)
    }
    meshes[k][0].instanceColor.needsUpdate = true
  }
  const cnt = {}
  for (let i = 0; i < N; i++) { const t = typeOf[i]; idxOf.push((cnt[t] = (cnt[t] || 0) + 1) - 1) }
  // 车灯：路面上一片柔和的暖白光斑（长尾渐变）+ 灯头柔光晕；尾灯一团柔红
  const mkTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
  const beamTex = mkTex(64, 128, (g, w, h) => {
    // 近车端（画布上沿）最亮，向前、向两侧平滑衰减
    const img = g.createImageData(w, h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w - 0.5
      const v = (y + 0.5) / h
      const spread = 0.12 + v * 0.38
      const a = Math.exp(-(u * u) / (2 * spread * spread * 0.35)) * Math.pow(1 - v, 1.6) * Math.min(1, v * 8)
      const o = (y * w + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
      img.data[o + 3] = Math.round(a * 255)
    }
    g.putImageData(img, 0, 0)
  })
  const softDot = Mat.radialTex(64, Mat.stops([[0, 1], [0.2, 0.5], [0.5, 0.12], [1, 0]]))
  const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe9c4', map: beamTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
  Mat.registerFade(beamMat, 0, 0.32)
  const beamGeo = new THREE.PlaneGeometry(1, 1)
  beamGeo.rotateX(-Math.PI / 2)
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, N)
  const flareGeo = new THREE.PlaneGeometry(1, 1)
  flareGeo.rotateY(Math.PI / 2)
  const flareFMat = new THREE.MeshBasicMaterial({ color: '#fff0d8', map: softDot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  const flareRMat = new THREE.MeshBasicMaterial({ color: '#ff3a30', map: softDot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  Mat.registerFade(flareFMat, 0, 0.55)
  Mat.registerFade(flareRMat, 0, 0.6)
  const flareF = new THREE.InstancedMesh(flareGeo, flareFMat, N * 2)
  const flareR = new THREE.InstancedMesh(flareGeo, flareRMat, N * 2)
  for (const m of [beams, flareF, flareR]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    m.frustumCulled = false
  }
  group.add(beams, flareF, flareR)

  const riverHalf = W.riverWidth / 2 + 50
  const lanes = []
  for (const x of plan.avenues) {
    for (const s of [-1, 1]) {
      for (const lane of [0.3, 0.72]) {
        const stops = lane > 0.5 ? (plan.busStops || []).filter((b) => b.x === x && b.s === s).map((b) => b.z).sort((a, b) => a - b) : null
        lanes.push({ axis: 'z', at: x + s * (W.avenueW * 0.5 * lane), dir: -s, side: s, lo: -W.segmentLength / 2 + 40, hi: W.segmentLength / 2 - 40, vmax: lane < 0.5 ? 17 : 13, cars: [], stops })
      }
    }
  }
  const bridgeZs = new Set(plan.streets.filter((_, i) => i % 3 === 1))
  // 步行街路段不走车：该横街在 walk 区段内断开（车开到端点就"拐走"消失）
  const pedD = (plan.districts || []).filter((d) => d.id === 'walk' || d.id === 'bar')
  for (const z of plan.streets) {
    for (const s of [-1, 1]) {
      const at = z + s * (W.streetW * 0.2)
      const peds = pedD.filter((P) => P.street === z)
      if (peds.length) {
        // 步行街/酒吧街：整段禁车，车道在步行段两端各退 30m 断开
        let spans = bridgeZs.has(z) ? [[-W.cityWidth / 2 + 40, W.cityWidth / 2 - 40]] : [[-W.cityWidth / 2 + 40, -riverHalf], [riverHalf, W.cityWidth / 2 - 40]]
        for (const P of peds) {
          const out = []
          for (const [a, b] of spans) {
            if (P.x1 + 30 <= a || P.x0 - 30 >= b) { out.push([a, b]); continue }
            if (P.x0 - 30 - a > 60) out.push([a, P.x0 - 30])
            if (b - (P.x1 + 30) > 60) out.push([P.x1 + 30, b])
          }
          spans = out
        }
        for (const [a, b] of spans) lanes.push({ axis: 'x', at, dir: -s, lo: a, hi: b, vmax: 11, cars: [] })
        continue
      }
      if (bridgeZs.has(z)) lanes.push({ axis: 'x', at, dir: -s, lo: -W.cityWidth / 2 + 40, hi: W.cityWidth / 2 - 40, vmax: 12, cars: [] })
      else for (const side of [-1, 1]) {
        lanes.push({ axis: 'x', at, dir: -s, lo: side < 0 ? -W.cityWidth / 2 + 40 : riverHalf, hi: side < 0 ? -riverHalf : W.cityWidth / 2 - 40, vmax: 11, cars: [] })
      }
    }
  }
  // 车道穿过大设施地块的段落断开（两端各退 30m，车开到端点就"拐走"）
  for (const r of plan.closed || []) {
    for (let i = lanes.length - 1; i >= 0; i--) {
      const L = lanes[i]
      const inside = L.axis === 'z' ? L.at > r.x0 && L.at < r.x1 : L.at > r.z0 && L.at < r.z1
      if (!inside) continue
      const h0 = (L.axis === 'z' ? r.z0 : r.x0) - 30
      const h1 = (L.axis === 'z' ? r.z1 : r.x1) + 30
      if (h1 <= L.lo || h0 >= L.hi) continue
      lanes.splice(i, 1)
      if (h0 - L.lo > 60) lanes.push({ ...L, hi: h0, cars: [] })
      if (L.hi - h1 > 60) lanes.push({ ...L, lo: h1, cars: [] })
    }
  }
  // 园区内部道路段：干道车道在进园区前（路口内）平滑并到窄路车道上，园区里限速，出来再回到原车道
  const RAMP0 = 28
  const RAMP1 = 5
  for (const r of plan.inner || []) {
    for (const L of lanes) {
      if (L.axis !== r.axis) continue
      const o = L.at - r.at
      const lim = r.axis === 'z' ? W.avenueW / 2 : W.streetW / 2
      if (Math.abs(o) > lim) continue
      if (r.hi + RAMP0 < L.lo || r.lo - RAMP0 > L.hi) continue
      ;(L.sq ||= []).push({ lo: r.lo, hi: r.hi, d: Math.sign(o) * r.laneAt(Math.abs(o)) - o, vmax: r.vmax })
    }
  }
  const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
  function squeeze(lane, s) {
    if (!lane.sq) return 0
    for (const q of lane.sq) {
      if (s < q.lo - RAMP0 || s > q.hi + RAMP0) continue
      const k = Math.min(sm((s - (q.lo - RAMP0)) / (RAMP0 - RAMP1)), sm(((q.hi + RAMP0) - s) / (RAMP0 - RAMP1)))
      return q.d * k
    }
    return 0
  }
  function innerVmax(lane, s) {
    if (!lane.sq) return Infinity
    for (const q of lane.sq) if (s > q.lo - RAMP0 && s < q.hi + RAMP0) return q.vmax
    return Infinity
  }
  const streetsS = plan.streets.slice().sort((a, b) => a - b)
  const avesS = plan.avenues.slice().sort((a, b) => a - b)
  const cars = []
  for (let i = 0; i < N; i++) {
    const T = kit.types[typeOf[i]]
    cars.push({ lane: null, s: 0, v: 0, L: T.L, W: T.W, H: T.H, T, type: typeOf[i], idx: idxOf[i], scooter: typeOf[i] === 'bus', bus: typeOf[i] === 'bus', alive: false, dwell: 0, served: null, pull: 0 })
  }
  const R = 420
  const busLanes = lanes.filter((l) => l.stops && l.stops.length)
  // 前方下一站（公交车中心对准站台）
  function nextStop(lane, s) {
    const st = lane.stops
    if (lane.dir > 0) { for (const v of st) if (v > s - 0.5) return v; return null }
    for (let i = st.length - 1; i >= 0; i--) if (st[i] < s + 0.5) return st[i]
    return null
  }
  function respawn(c, px, pz, first) {
    const pool = c.bus ? busLanes : lanes
    for (let tries = 0; tries < (c.bus ? 30 : 12); tries++) {
      const lane = pool[(Math.random() * pool.length) | 0]
      if (!lane) return
      const cross = lane.axis === 'z' ? px : pz
      if (Math.abs(lane.at - cross) > R * 0.85) continue
      const along = lane.axis === 'z' ? pz : px
      // 新车只在视野边缘出生，别凭空冒在眼前
      const off = first ? (Math.random() * 2 - 1) * R * 0.9 : (Math.random() < 0.5 ? -1 : 1) * R * (0.6 + Math.random() * 0.3)
      const s = along + off
      if (s < lane.lo || s > lane.hi) continue
      if (lane.cars.some((o) => Math.abs(o.s - s) < 12)) continue
      if (c.lane) c.lane.cars.splice(c.lane.cars.indexOf(c), 1)
      c.lane = lane
      c.s = s
      c.v = lane.vmax * (c.scooter ? 0.8 : 1)
      c.dwell = 0
      c.served = null
      c.pull = 0
      lane.cars.push(c)
      c.alive = true
      return
    }
  }
  function nextCross(arr, s, dir) {
    // 前方最近的交叉道路坐标
    if (dir > 0) { for (const v of arr) if (v > s) return v; return Infinity }
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] < s) return arr[i]
    return -Infinity
  }
  let clockT = 0
  function place(i, c, x, y, z, yaw) {
    const T = c.T
    dummy.rotation.set(0, yaw, 0)
    dummy.position.set(x, y, z)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    for (const m of meshes[c.type]) m.setMatrixAt(c.idx, dummy.matrix)
    const fx = Math.cos(yaw)
    const fz = -Math.sin(yaw)
    const rx = Math.sin(yaw)
    const rz = Math.cos(yaw)
    const off = T.L / 2
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1
      dummy.position.set(x + fx * (off + 0.06) + rx * sg * T.headZ, y + T.headY, z + fz * (off + 0.06) + rz * sg * T.headZ)
      dummy.scale.set(1, 0.9, 0.9)
      dummy.updateMatrix()
      flareF.setMatrixAt(i * 2 + s, dummy.matrix)
      dummy.position.set(x - fx * (off + 0.06) + rx * sg * T.headZ, y + T.tailY, z - fz * (off + 0.06) + rz * sg * T.headZ)
      dummy.scale.set(1, 0.7, 0.7)
      dummy.updateMatrix()
      flareR.setMatrixAt(i * 2 + s, dummy.matrix)
    }
    dummy.position.set(x + fx * (off + 7.2), SURFACE + 0.135, z + fz * (off + 7.2))
    dummy.rotation.set(0, yaw + Math.PI / 2, 0)
    dummy.scale.set(T.W * 3.2, 1, 14)
    dummy.updateMatrix()
    beams.setMatrixAt(i, dummy.matrix)
  }
  function hide(i, c) {
    dummy.position.set(0, -100, 0)
    dummy.scale.set(0, 0, 0)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    for (const m of meshes[c.type]) m.setMatrixAt(c.idx, dummy.matrix)
    beams.setMatrixAt(i, dummy.matrix)
    flareF.setMatrixAt(i * 2, dummy.matrix); flareF.setMatrixAt(i * 2 + 1, dummy.matrix)
    flareR.setMatrixAt(i * 2, dummy.matrix); flareR.setMatrixAt(i * 2 + 1, dummy.matrix)
  }
  function sync(dt = 0, px = 0, pz = 0) {
    clockT += dt
    // 信号周期 26s：南北绿 11s / 黄 2s / 东西绿 11s / 黄 2s
    const ph = clockT % 26
    const zGreen = ph < 11
    const xGreen = ph >= 13 && ph < 24
    for (const c of cars) {
      if (!c.alive) { respawn(c, px, pz, true); continue }
      const along = c.lane.axis === 'z' ? pz : px
      const cross = c.lane.axis === 'z' ? px : pz
      if (Math.abs(c.s - along) > R || Math.abs(c.lane.at - cross) > R) respawn(c, px, pz, false)
    }
    for (const lane of lanes) {
      const arr = lane.cars
      if (!arr.length) continue
      arr.sort((a, b) => (a.s - b.s) * lane.dir)
      const green = lane.axis === 'z' ? zGreen : xGreen
      const crosses = lane.axis === 'z' ? streetsS : avesS
      const half = lane.axis === 'z' ? W.streetW / 2 : W.avenueW / 2
      for (let k = 0; k < arr.length; k++) {
        const c = arr[k]
        let target = Math.min(lane.vmax, innerVmax(lane, c.s)) * (c.scooter ? 0.8 : 1)
        const ahead = arr[k + 1]
        if (ahead) {
          const gap = (ahead.s - c.s) * lane.dir - (ahead.L + c.L) / 2
          target = Math.min(target, Math.max(0, (gap - 3) / 1.3))
        }
        if (c.bus && lane.stops) {
          // 进站：减速对准站台 → 靠边停 6s（开门上下客）→ 出站
          const st = nextStop(lane, c.s)
          if (c.dwell > 0) {
            c.dwell -= dt
            target = 0
            if (c.dwell <= 0) c.served = st
          } else if (st != null && st !== c.served) {
            const d = (st - c.s) * lane.dir
            if (d < 60) target = Math.min(target, Math.max(0.6, Math.sqrt(Math.max(0, d) * 2 * 2.2)))
            if (d < 0.8) { c.dwell = 6 + Math.random() * 2; target = 0; c.v = Math.min(c.v, 1.5) }
          }
          // 靠边：进站前 35m 开始往路缘挪 2m，出站后 25m 挪回
          const dS = st != null ? (st - c.s) * lane.dir : 1e9
          const want = c.dwell > 0 || (dS < 35 && st !== c.served) ? 1 : 0
          c.pull += Math.max(-dt * 0.6, Math.min(dt * 0.6, want - c.pull))
        }
        if (!green) {
          const xr = nextCross(crosses, c.s, lane.dir)
          if (Number.isFinite(xr)) {
            const stop = (xr - c.s) * lane.dir - (half + 6.5) - c.L / 2
            if (stop > -1 && stop < 40) target = Math.min(target, Math.max(0, stop * 0.45))
          }
        }
        const dv = target - c.v
        c.v += Math.max(-9 * dt, Math.min(3.2 * dt, dv))
        c.s += c.v * lane.dir * dt
        if (c.s < lane.lo || c.s > lane.hi) c.alive = false
      }
    }
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i]
      if (!c.alive || !c.lane) { hide(i, c); continue }
      const lane = c.lane
      let x, z, yaw
      const sq = squeeze(lane, c.s)
      if (lane.axis === 'z') { x = lane.at + sq + (c.pull ? lane.side * 2.0 * c.pull * c.pull * (3 - 2 * c.pull) : 0); z = c.s; yaw = lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2 }
      else { z = lane.at + sq; x = c.s; yaw = lane.dir > 0 ? 0 : Math.PI }
      const y = SURFACE + (lane.axis === 'z' ? 0.12 : Math.abs(x) < W.riverWidth / 2 + 30 ? 0.26 : 0.095)
      place(i, c, x, y, z, yaw)
    }
    for (const k in meshes) for (const m of meshes[k]) m.instanceMatrix.needsUpdate = true
    beams.instanceMatrix.needsUpdate = true
    flareF.instanceMatrix.needsUpdate = true
    flareR.instanceMatrix.needsUpdate = true
  }
  return { group, sync, cars }
}

// ───────────────────────── 街道家具：行道树（树池）/ 长椅 / 垃圾桶 / 公交站 / 路边停车 / 共享单车，按 400m 分块，近处才显示 ─────────────────────────
function buildFurniture(plan, rng, glowTex, kit, addProp = () => {}) {
  const group = new THREE.Group()
  group.name = 'furniture'
  const CH = 400
  const chunks = new Map()
  const boxGeo = new THREE.BoxGeometry(1, 1, 1)
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
  const crownGeo = new THREE.IcosahedronGeometry(1, 1)
  const M = (c, r = 0.85, m = 0.05) => { const x = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); Mat.registerMaterial(x); Mat.tactile(x, r < 0.2 ? 0.3 : 0.9); return x } // t35 布景质感
  const kinds = {
    trunk: [cylGeo, M('#5a4030')], crown: [crownGeo, M('#ffffff')], pit: [boxGeo, M('#4a4642')],
    bench: [boxGeo, M('#8a6a48')], metal: [boxGeo, M('#3c4248', 0.4, 0.6)], bin: [cylGeo, M('#2f5a40', 0.6, 0.2)],
    shelter: [boxGeo, M('#c8d4dc', 0.2, 0.1)], roof: [boxGeo, M('#3a4046', 0.5, 0.4)],
    carA: [boxGeo, M('#c9ccd1', 0.4, 0.4)], carB: [boxGeo, M('#1f2328', 0.4, 0.4)], carC: [boxGeo, M('#8a1c1c', 0.4, 0.4)], carD: [boxGeo, M('#2a4f8a', 0.4, 0.4)], carE: [boxGeo, M('#e8e8e6', 0.4, 0.4)],
    cabin: [boxGeo, Mat.glass()], bikeY: [boxGeo, M('#c9a640', 0.5, 0.3)], bikeB: [boxGeo, M('#3f7fb8', 0.5, 0.3)], wheel: [cylGeo, M('#202224', 0.7, 0.2)],
  }
  const adLit = new THREE.MeshStandardMaterial({ color: '#f4f0e6', emissive: '#fff4dc', emissiveIntensity: 0, roughness: 0.4 })
  Mat.registerMaterial(adLit)
  Mat.registerNight(adLit, 0.1, 1.4)
  kinds.ad = [boxGeo, adLit]
  const recs = new Map()
  const dm = new THREE.Object3D()
  const tc = new THREE.Color()
  function put(kind, x, y, z, sx, sy, sz, yaw = 0, force = false) {
    if (!force && plan.isClosed?.(x, z)) return
    if (kind.startsWith('car:')) addProp(x, z, 2.6)
    else if (kind !== 'pit' && kind !== 'crown' && kind !== 'wheel') addProp(x, z, Math.max(0.3, Math.max(sx, sz) / 2))
    const key = Math.floor(x / CH) + '|' + Math.floor(z / CH)
    let c = recs.get(key)
    if (!c) recs.set(key, (c = {}))
    ;(c[kind] || (c[kind] = [])).push(x, y, z, sx, sy, sz, yaw)
  }
  const aw = W.avenueW
  const sw = W.streetW
  const riverHalf = W.riverWidth / 2 + 40
  const zLen = W.segmentLength
  const xLen = W.cityWidth - 40
  const nearX = (v, pad) => plan.avenues.some((a) => Math.abs(a - v) < aw / 2 + pad)
  const nearZ = (v, pad) => plan.streets.some((s2) => Math.abs(s2 - v) < sw / 2 + pad)
  const commerce = new Set(plan.commerceStreets || [])
  // 行道树：按段落成片同种（真实街道一段一个树种），种之间形态差别明显；偶尔一棵大的
  const SPEC = ['broad', 'broad', 'clump', 'umbrella', 'column', 'conifer']
  let specRun = 0
  let spec = 'broad'
  const tree = (x, z) => {
    if (specRun-- <= 0) { spec = SPEC[(rng() * SPEC.length) | 0]; specRun = 4 + ((rng() * 8) | 0) }
    const big = rng() < 0.12
    const h = big ? range(rng, 9, 13) : range(rng, 5.5, 8.5)
    put('pit', x, SURFACE + 0.27, z, 1.4, 0.04, 1.4)
    const c = 'crown'
    const tw = 0.2 + h * 0.012
    if (spec === 'conifer') {
      // 塔形：三层逐级收小的冠叠起来
      put('trunk', x, SURFACE + h * 0.15, z, tw, h * 0.3, tw)
      put('crown', x, SURFACE + h * 0.42, z, h * 0.2, h * 0.2, h * 0.2)
      put('crown', x, SURFACE + h * 0.66, z, h * 0.14, h * 0.18, h * 0.14)
      put('crown', x, SURFACE + h * 0.86, z, h * 0.07, h * 0.14, h * 0.07)
    } else if (spec === 'column') {
      put('trunk', x, SURFACE + h * 0.15, z, tw, h * 0.3, tw)
      put('crown', x, SURFACE + h * 0.62, z, h * 0.13, h * 0.42, h * 0.13)
    } else if (spec === 'umbrella') {
      put('trunk', x, SURFACE + h * 0.3, z, tw * 1.2, h * 0.6, tw * 1.2)
      put(c, x, SURFACE + h * 0.72, z, h * 0.44, h * 0.18, h * 0.44)
    } else if (spec === 'clump') {
      put('trunk', x, SURFACE + h * 0.3, z, tw, h * 0.6, tw)
      put(c, x, SURFACE + h * 0.66, z, h * 0.27, h * 0.26, h * 0.27)
      put('crown', x + h * 0.13, SURFACE + h * 0.8, z - h * 0.07, h * 0.2, h * 0.2, h * 0.2)
    } else {
      put('trunk', x, SURFACE + h * 0.3, z, tw, h * 0.6, tw)
      put(c, x, SURFACE + h * 0.72, z, h * 0.32, h * 0.36, h * 0.32)
    }
  }
  // 天桥楼梯 / 地铁口占用的人行道段：不种树、不放长椅
  const aw0 = W.avenueW
  const sites = [
    ...(plan.overpasses || []).flatMap((o) => [[o.x - (aw0 / 2 + 4), o.z + o.s * 8.5, 9], [o.x + (aw0 / 2 + 4), o.z + o.s * 8.5, 9]]),
    ...(plan.metros || []).map((m) => [m.x, m.z + m.s * 1.5, 7]),
  ]
  const nearSite = (x, z) => sites.some(([sx, sz, r]) => Math.abs(sx - x) < 4.5 && Math.abs(sz - z) < r)
  // 长椅：木条座面 + 靠背 + 两只铸铁腿（一眼认得出是长椅），只放在行道树带，不靠店门
  const bench = (x, z, alongZ, s = 1) => {
    const L = 1.8
    put('bench', x, SURFACE + 0.72, z, alongZ ? 0.48 : L, 0.05, alongZ ? L : 0.48)
    put('bench', alongZ ? x + s * 0.24 : x, SURFACE + 1.0, alongZ ? z : z + s * 0.24, alongZ ? 0.05 : L, 0.32, alongZ ? L : 0.05)
    for (const t of [-0.72, 0.72]) {
      put('metal', alongZ ? x : x + t, SURFACE + 0.5, alongZ ? z + t : z, alongZ ? 0.46 : 0.06, 0.44, alongZ ? 0.06 : 0.46)
      put('metal', alongZ ? x + s * 0.24 : x + t, SURFACE + 0.86, alongZ ? z + t : z + s * 0.24, 0.06, 0.3, 0.06)
    }
  }
  const bin = (x, z) => put('bin', x, SURFACE + 0.7, z, 0.5, 0.9, 0.5)
  const PK = ['sedan', 'sedan', 'hatch', 'suv', 'suv', 'van', 'taxi']
  const parked = (x, z, alongZ) => {
    const t = PK[(rng() * PK.length) | 0]
    const flip = rng() < 0.5 ? 0 : Math.PI
    put('car:' + t, x, SURFACE + 0.095, z, 1, 1, 1, (alongZ ? Math.PI / 2 : 0) + flip)
  }
  // 建筑地块里的停车场/车库/警局门口等：用真车型（以前是方块车）
  for (const c of plan.lotCars || []) {
    const t = c.t || PK[(rng() * PK.length) | 0]
    put('car:' + t, c.x, c.y, c.z, 1, 1, 1, c.yaw, true)
  }
  const bikes = (x, z, alongZ, n) => {
    for (let i = 0; i < n; i++) {
      const o = (i - n / 2) * 0.7
      const bx = alongZ ? x : x + o
      const bz = alongZ ? z + o : z
      const k = rng() < 0.6 ? 'bikeY' : 'bikeB'
      put(k, bx, SURFACE + 0.75, bz, alongZ ? 1.6 : 0.08, 0.08, alongZ ? 0.08 : 1.6)
      put(k, bx, SURFACE + 0.55, bz, 0.1, 0.5, 0.1)
      for (const t of [-0.6, 0.6]) put('wheel', alongZ ? bx + t : bx, SURFACE + 0.6, alongZ ? bz : bz + t, 0.62, 0.05, 0.62, 0)
    }
  }
  const shelter = (x, z, alongZ, s) => {
    put('roof', x, SURFACE + 2.75, z, alongZ ? 1.8 : 5.5, 0.12, alongZ ? 5.5 : 1.8)
    put('shelter', alongZ ? x + s * 0.8 : x, SURFACE + 1.5, alongZ ? z : z + s * 0.8, alongZ ? 0.05 : 5.4, 2.4, alongZ ? 5.4 : 0.05)
    put('ad', alongZ ? x : x + 2.6, SURFACE + 1.5, alongZ ? z + 2.6 : z, alongZ ? 1.2 : 0.12, 1.9, alongZ ? 0.12 : 1.2)
    bench(alongZ ? x + s * 0.3 : x, alongZ ? z : z + s * 0.3, alongZ, s)
  }
  // 大道：行道树 14m 一棵（避开路灯 28m 相位），长椅/垃圾桶，800m 一座公交站
  for (const x of plan.avenues) {
    for (const s of [-1, 1]) {
      const tx = x + s * (aw / 2 + 2.0)
      for (let z = -zLen / 2 + 57; z < zLen / 2 - 50; z += 14) {
        if (nearZ(z, 6)) continue
        if (nearSite(tx, z)) continue
        const r = rng()
        if (r < 0.62) tree(tx, z)
        else if (r < 0.74) bench(tx, z, true, s)
        else if (r < 0.82) bin(tx, z)
      }
      // 公交站：每侧 400m 一座（两侧错开 200m），登记给车流里的公交车进站停靠
      for (let z = -zLen / 2 + 260 + (s > 0 ? 200 : 0); z < zLen / 2 - 100; z += 400) {
        const sx = x + s * (aw / 2 + 3.0)
        if (nearZ(z, 12) || nearSite(sx, z) || plan.isClosed?.(sx, z)) continue
        shelter(sx, z, true, s)
        ;(plan.busStops ||= []).push({ x, s, z })
      }
    }
  }
  // 横街：行道树 + 路边停车（街边车道）+ 商业街门口共享单车
  const pedF = (plan.districts || []).filter((d) => d.id === 'walk' || d.id === 'bar')
  for (const z of plan.streets) {
    const rich = commerce.has(z)
    for (const s of [-1, 1]) {
      const tz = z + s * (sw / 2 + 2.0)
      const cz = z + s * (sw / 2 - 1.3)
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -xLen / 2 + 40 : riverHalf + 20
        const x1 = side < 0 ? -riverHalf - 20 : xLen / 2 - 40
        for (let x = x0 + 7; x < x1; x += 14) {
          if (nearX(x, 6)) continue
          const r = rng()
          if (r < (rich ? 0.45 : 0.6)) tree(x, tz)
          else if (r < 0.7) bin(x, tz)
          else if (rich && r < 0.85) bikes(x, z + s * (sw / 2 + 4.6), false, 4 + ((rng() * 4) | 0))
          else if (r < 0.78) bench(x, tz, false, s)
        }
        for (let x = x0 + 3; x < x1; x += 6.5) {
          if (nearX(x, 14)) continue
          if (pedF.some((P) => z === P.street && x > P.x0 - 20 && x < P.x1 + 20)) continue
          if (rng() < (rich ? 0.34 : 0.16)) parked(x, cz, false)
        }
      }
    }
  }
  for (const [key, c] of recs) {
    const g = new THREE.Group()
    const [ix, iz] = key.split('|').map(Number)
    g.userData.cx = (ix + 0.5) * CH
    g.userData.cz = (iz + 0.5) * CH
    const carG = new THREE.Group()
    carG.userData.car = true
    g.add(carG)
    for (const kind in c) {
      const a = c[kind]
      const n = a.length / 7
      if (kind.startsWith('car:')) {
        // 路边停车：真车型（每种车 5 个实例网格），单独一组、更近才显示
        const T = kit.types[kind.slice(4)]
        const pal = kit.colors[kind.slice(4)] || kit.colors.default
        for (const pk of PART_KEYS) {
          const im = new THREE.InstancedMesh(T[pk], kit.mats[pk], n)
          for (let i = 0; i < n; i++) {
            dm.position.set(a[i * 7], a[i * 7 + 1], a[i * 7 + 2])
            dm.scale.set(1, 1, 1)
            dm.rotation.set(0, a[i * 7 + 6], 0)
            dm.updateMatrix()
            im.setMatrixAt(i, dm.matrix)
            if (pk === 'paint') im.setColorAt(i, tc.set(pal[(rng() * pal.length) | 0]))
          }
          im.computeBoundingSphere()
          carG.add(im)
        }
        continue
      }
      const [geo, mat] = kinds[kind]
      const im = new THREE.InstancedMesh(geo, mat, n)
      for (let i = 0; i < n; i++) {
        dm.position.set(a[i * 7], a[i * 7 + 1], a[i * 7 + 2])
        dm.scale.set(a[i * 7 + 3], a[i * 7 + 4], a[i * 7 + 5])
        dm.rotation.set(kind === 'wheel' ? 0 : 0, a[i * 7 + 6], kind === 'wheel' ? Math.PI / 2 : 0)
        dm.updateMatrix()
        im.setMatrixAt(i, dm.matrix)
        // 树冠：一个 draw，逐棵三种绿（以前两种绿各一个实例网格）
        if (kind === 'crown') {
          const hh = Math.abs(Math.sin(a[i * 7] * 12.9898 + a[i * 7 + 2] * 78.233) * 43758.5453) % 1
          im.setColorAt(i, tc.set(hh < 0.4 ? '#4a7a3e' : hh < 0.8 ? '#5f8a45' : '#3e6a3a'))
        }
      }
      im.computeBoundingSphere()
      im.receiveShadow = true
      g.add(im)
    }
    g.visible = false
    group.add(g)
    chunks.set(key, g)
  }
  let lx = 1e9
  let lz = 1e9
  function update(px, pz) {
    if ((px - lx) ** 2 + (pz - lz) ** 2 < 900) return
    lx = px
    lz = pz
    const r2 = (CH * 1.25) ** 2
    for (const g of group.children) {
      const d2 = (g.userData.cx - px) ** 2 + (g.userData.cz - pz) ** 2
      g.visible = d2 < r2
      // 停放车辆面数较多：只在近处两圈分块显示
      for (const c of g.children) if (c.userData.car) c.visible = d2 < (CH * 0.95) ** 2
    }
  }
  void glowTex
  return { group, update }
}

// ───────────────────────── 行人：主角周围 ~220m 的人行道上走动（低多边形 + 摆腿），走远了就回收到附近 ─────────────────────────
function buildPedestrians(plan, rng) {
  const group = new THREE.Group()
  group.name = 'pedestrians'
  const N = 110 // 以前 260
  const box = new THREE.BoxGeometry(1, 1, 1)
  const legGeo = new THREE.BoxGeometry(1, 1, 1)
  legGeo.translate(0, -0.5, 0)
  const mk = (c, emis = 0.16) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, emissive: c, emissiveIntensity: 0 })
    Mat.registerMaterial(m)
    Mat.registerNight(m, 0, emis)
    return m
  }
  const torso = new THREE.InstancedMesh(box, mk('#ffffff', 0.05), N)
  const head = new THREE.InstancedMesh(box, mk('#e2bf9c'), N)
  const hair = new THREE.InstancedMesh(box, mk('#1e1c1a'), N)
  const legs = new THREE.InstancedMesh(legGeo, mk('#2a2e36'), N * 2)
  const arms = new THREE.InstancedMesh(legGeo, mk('#ffffff', 0.05), N * 2)
  for (const m of [torso, head, hair, legs, arms]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false }
  const cols = ['#c8463c', '#3a5f8a', '#e8e4dc', '#2e2e32', '#6a8a4a', '#d8a040', '#8a5a9a', '#4a8aa0', '#b8b0a4', '#a04a5a']
  const tc = new THREE.Color()
  for (let i = 0; i < N; i++) {
    tc.set(cols[(rng() * cols.length) | 0])
    torso.setColorAt(i, tc)
    arms.setColorAt(i * 2, tc)
    arms.setColorAt(i * 2 + 1, tc)
  }
  torso.instanceColor.needsUpdate = true
  arms.instanceColor.needsUpdate = true
  group.add(torso, head, hair, legs, arms)
  // 人行道中线：大道两侧 / 横街两侧
  const aw = W.avenueW
  const sw = W.streetW
  const lines = []
  for (const x of plan.avenues) for (const s of [-1, 1]) lines.push({ axis: 'z', at: x + s * (aw / 2 + 3.6) })
  for (const z of plan.streets) for (const s of [-1, 1]) lines.push({ axis: 'x', at: z + s * (sw / 2 + 3.4) })
  // 园区内部道路两侧人行道（只在园区段内走）
  for (const r of plan.inner || []) for (const s of [-1, 1]) lines.push({ axis: r.axis, at: r.at + s * (r.cw / 2 + 0.3 + r.walk / 2), lo: r.lo + 2, hi: r.hi - 2, inner: true })
  const riverHalf = W.riverWidth / 2 + 45
  const P = Array.from({ length: N }, () => ({ line: null, s: 0, off: 0, dir: 1, v: 1.3, ph: 0, h: 1.7, alive: false }))
  const R = 230
  function respawn(p, px, pz, first) {
    for (let t = 0; t < 10; t++) {
      const L = lines[(Math.random() * lines.length) | 0]
      const cross = L.axis === 'z' ? px : pz
      if (Math.abs(L.at - cross) > R * 0.8) continue
      const along = L.axis === 'z' ? pz : px
      const s = along + (first ? (Math.random() * 2 - 1) * R * 0.85 : (Math.random() < 0.5 ? -1 : 1) * R * (0.55 + Math.random() * 0.3))
      if (L.axis === 'x' && Math.abs(s) < riverHalf) continue
      if (Math.abs(s) > 2440) continue
      if (L.inner ? s < L.lo || s > L.hi : plan.isClosed?.(L.axis === 'z' ? L.at : s, L.axis === 'z' ? s : L.at, -4)) continue
      p.line = L
      p.s = s
      p.off = (Math.random() - 0.5) * (L.inner ? 1.6 : 3.2)
      p.dir = Math.random() < 0.5 ? -1 : 1
      p.v = 1.1 + Math.random() * 0.6
      p.ph = Math.random() * 6.28
      p.h = 1.55 + Math.random() * 0.3
      p.alive = true
      return
    }
  }
  const dm = new THREE.Object3D()
  const hide = () => { dm.scale.set(0, 0, 0); dm.position.set(0, -50, 0); dm.updateMatrix() }
  function update(dt, px, pz) {
    for (let i = 0; i < N; i++) {
      const p = P[i]
      if (!p.alive) respawn(p, px, pz, true)
      else {
        const along = p.line.axis === 'z' ? pz : px
        const cross = p.line.axis === 'z' ? px : pz
        if (Math.abs(p.s - along) > R || Math.abs(p.line.at - cross) > R) respawn(p, px, pz, false)
        else if (p.line.inner ? p.s < p.line.lo || p.s > p.line.hi : plan.isClosed?.(p.line.axis === 'z' ? p.line.at : p.s, p.line.axis === 'z' ? p.s : p.line.at, -4)) { p.alive = false; respawn(p, px, pz, false) }
      }
      if (!p.alive) {
        hide()
        torso.setMatrixAt(i, dm.matrix); head.setMatrixAt(i, dm.matrix); hair.setMatrixAt(i, dm.matrix)
        legs.setMatrixAt(i * 2, dm.matrix); legs.setMatrixAt(i * 2 + 1, dm.matrix); arms.setMatrixAt(i * 2, dm.matrix); arms.setMatrixAt(i * 2 + 1, dm.matrix)
        continue
      }
      p.s += p.v * p.dir * dt
      p.ph += p.v * 3.6 * dt
      const zAx = p.line.axis === 'z'
      const x = zAx ? p.line.at + p.off : p.s
      const z = zAx ? p.s : p.line.at + p.off
      const yaw = zAx ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      const k = p.h / 1.7
      const y0 = SURFACE + 0.26
      const sw2 = Math.sin(p.ph) * 0.55
      dm.rotation.set(0, yaw, 0)
      dm.position.set(x, y0 + 1.15 * k, z); dm.scale.set(0.42 * k, 0.6 * k, 0.24 * k); dm.updateMatrix(); torso.setMatrixAt(i, dm.matrix)
      dm.position.set(x, y0 + 1.6 * k, z); dm.scale.set(0.22 * k, 0.24 * k, 0.22 * k); dm.updateMatrix(); head.setMatrixAt(i, dm.matrix)
      dm.position.set(x, y0 + 1.74 * k, z); dm.scale.set(0.24 * k, 0.08 * k, 0.24 * k); dm.updateMatrix(); hair.setMatrixAt(i, dm.matrix)
      const fx = Math.sin(yaw)
      const fz = Math.cos(yaw)
      const rx = fz
      const rz = -fx
      for (let s = 0; s < 2; s++) {
        const sg = s ? 1 : -1
        dm.rotation.set(sg * sw2, yaw, 0, 'YXZ')
        dm.position.set(x + rx * 0.11 * sg * k, y0 + 0.85 * k, z + rz * 0.11 * sg * k)
        dm.scale.set(0.15 * k, 0.85 * k, 0.16 * k)
        dm.updateMatrix()
        legs.setMatrixAt(i * 2 + s, dm.matrix)
        dm.rotation.set(-sg * sw2 * 0.8, yaw, 0, 'YXZ')
        dm.position.set(x + rx * 0.27 * sg * k, y0 + 1.42 * k, z + rz * 0.27 * sg * k)
        dm.scale.set(0.11 * k, 0.6 * k, 0.12 * k)
        dm.updateMatrix()
        arms.setMatrixAt(i * 2 + s, dm.matrix)
      }
      dm.rotation.set(0, 0, 0, 'XYZ')
    }
    for (const m of [torso, head, hair, legs, arms]) m.instanceMatrix.needsUpdate = true
  }
  return { group, update }
}

export function tickStreetLife(root, dt, px = 0, pz = 0) {
  const ud = root?.userData
  if (!ud) return
  if (ud.traffic) ud.traffic.sync(dt, px, pz)
  // 行人 30Hz 更新就足够（步速 1.4m/s），隔帧累计 dt
  if (ud.peds) {
    ud._pedAcc = (ud._pedAcc || 0) + dt
    ud._pedFlip = !ud._pedFlip
    if (ud._pedFlip) { ud.peds.update(ud._pedAcc, px, pz); ud._pedAcc = 0 }
  }
  if (ud.furniture) ud.furniture.update(px, pz)
}
