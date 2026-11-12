import * as THREE from 'three'
import { W, SURFACE } from './spec.js'
import * as Mat from './mat.js'
import { buildShips } from './ships.js'

/**
 * 河上的船：渡轮 / 观光船 / 游艇 / 小摩托艇 / 划艇。
 * 每种船的盒子按材质合并成一个几何（一船 3~5 个 draw），沿河道车道往返，轻微起伏摇摆，船尾一道白色尾浪。
 * 车道 x 选在石拱桥三个拱洞的正中（±53m）和中孔两侧（±6m），所有船都能从桥下过。
 */
const WATER_Y = SURFACE - 6

function merge(parts) {
  const pos = []
  const nor = []
  for (const [sx, sy, sz, px, py, pz] of parts) {
    const g = new THREE.BoxGeometry(sx, sy, sz).translate(px, py, pz).toNonIndexed()
    pos.push(...g.attributes.position.array)
    nor.push(...g.attributes.normal.array)
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return out
}

/** 船体：前窄后宽的分段盒子（船头逐段收窄 + 抬高） */
function hull(L, B, D, list, y0 = 0) {
  const n = 6
  for (let i = 0; i < n; i++) {
    const u = i / n
    const segL = L / n
    const zc = -L / 2 + segL * (i + 0.5)
    const taper = u > 0.6 ? 1 - ((u - 0.6) / 0.4) * 0.75 : 1
    list.push([B * taper, D, segL * 1.01, 0, y0 + D / 2 + (u > 0.75 ? (u - 0.75) * D * 0.8 : 0), zc])
  }
}

function makeType(kind, mats) {
  const P = { hull: [], deck: [], cabin: [], glass: [], dark: [], accent: [] }
  let L, B, speed
  if (kind === 'ferry') {
    L = 30; B = 8; speed = 6
    hull(L, B, 1.6, P.hull)
    P.deck.push([B - 0.4, 0.2, L - 4, 0, 1.7, -1])
    P.cabin.push([B - 1.2, 2.2, L * 0.62, 0, 2.9, -1.5])
    P.glass.push([B - 1.1, 1.0, L * 0.6, 0, 3.0, -1.5])
    P.cabin.push([B - 0.6, 0.18, L * 0.68, 0, 4.1, -1.5])
    P.accent.push([B + 0.06, 0.3, L * 0.9, 0, 1.3, 0])
    P.dark.push([0.5, 0.6, 0.5, 0, 4.45, -L * 0.3])
  } else if (kind === 'tour') {
    L = 24; B = 5.2; speed = 5
    hull(L, B, 1.2, P.hull)
    P.deck.push([B - 0.3, 0.15, L - 2, 0, 1.28, -0.5])
    P.cabin.push([B - 0.6, 0.5, L * 0.7, 0, 1.6, -1])
    P.glass.push([B - 0.5, 1.3, L * 0.7, 0, 2.5, -1])
    P.cabin.push([B - 0.4, 0.12, L * 0.72, 0, 3.2, -1])
    P.accent.push([B + 0.04, 0.25, L * 0.85, 0, 1.0, 0])
  } else if (kind === 'yacht') {
    L = 16; B = 4.4; speed = 9
    hull(L, B, 1.3, P.hull)
    P.deck.push([B - 0.3, 0.12, L - 1.5, 0, 1.36, -0.3])
    P.cabin.push([B - 1.0, 0.9, L * 0.45, 0, 1.85, -0.8])
    P.glass.push([B - 0.95, 0.5, L * 0.4, 0, 2.0, -0.6])
    P.cabin.push([B - 1.6, 0.6, L * 0.25, 0, 2.6, -1.4])
    P.glass.push([B - 1.55, 0.35, L * 0.2, 0, 2.65, -1.0])
    P.dark.push([0.08, 0.6, 0.08, 0, 3.2, -1.6])
    P.accent.push([B + 0.04, 0.12, L * 0.8, 0, 1.15, 0])
  } else if (kind === 'motor') {
    L = 6.5; B = 2.3; speed = 12
    hull(L, B, 0.8, P.hull)
    P.deck.push([B - 0.3, 0.08, L - 1, 0, 0.84, -0.3])
    P.glass.push([B - 0.4, 0.45, 0.08, 0, 1.15, 0.6])
    P.dark.push([1.0, 0.5, 1.0, 0, 1.1, -0.6])
    P.dark.push([0.4, 0.7, 0.5, 0, 0.6, -L / 2 - 0.2])
  } else if (kind === 'sampan') {
    // 乌篷船：木船身 + 两段弧形竹篷（用几层收窄的盒子叠出拱）+ 船尾撑篙的人
    L = 9; B = 2.2; speed = 2.6
    hull(L, B, 0.7, P.hull)
    P.deck.push([B - 0.2, 0.06, L - 1.2, 0, 0.74, 0])
    for (const [zc, ln] of [[0.6, 2.6], [-1.6, 1.6]]) {
      P.dark.push([B - 0.3, 0.12, ln, 0, 1.75, zc])
      P.dark.push([B - 0.1, 0.5, ln, 0, 1.45, zc])
      P.dark.push([B + 0.02, 0.45, ln, 0, 1.0, zc])
    }
    P.accent.push([0.45, 0.7, 0.3, 0, 1.15, -L / 2 + 0.9])
    P.cabin.push([0.32, 0.3, 0.32, 0, 1.65, -L / 2 + 0.9])
    P.dark.push([0.06, 0.06, 4.2, 0, 1.2, -L / 2 + 1.6])
  } else if (kind === 'barge') {
    // 货驳：长而低，舱口盖成排 + 船尾驾驶楼
    L = 38; B = 7; speed = 3.5
    hull(L, B, 1.5, P.hull)
    P.deck.push([B - 0.4, 0.15, L - 3, 0, 1.58, 0])
    for (let i = 0; i < 4; i++) P.accent.push([B - 1.6, 0.9, 5.2, 0, 2.1, L / 2 - 8 - i * 6.2])
    P.cabin.push([B - 1.4, 3.2, 5, 0, 3.2, -L / 2 + 4])
    P.glass.push([B - 1.3, 0.9, 5.05, 0, 4.1, -L / 2 + 4])
    P.dark.push([0.5, 1.6, 0.5, 0, 5.6, -L / 2 + 3])
  } else {
    L = 4.2; B = 1.4; speed = 2.2
    hull(L, B, 0.5, P.hull)
    P.deck.push([B - 0.2, 0.06, L - 0.6, 0, 0.35, 0])
    for (const z of [-0.8, 0.5]) P.deck.push([B - 0.1, 0.08, 0.3, 0, 0.45, z])
    // 划船的人 + 桨
    P.accent.push([0.45, 0.6, 0.3, 0, 0.85, -0.2])
    P.dark.push([0.3, 0.3, 0.3, 0, 1.3, -0.2])
    P.dark.push([3.2, 0.05, 0.08, 0, 0.6, -0.1])
  }
  const g = new THREE.Group()
  for (const k in P) {
    if (!P[k].length) continue
    const m = new THREE.Mesh(merge(P[k]), mats[k](kind))
    m.castShadow = false
    g.add(m)
  }
  // 尾浪：船尾一条白色泡沫（半透明）
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(B * 1.6, L * 0.9).rotateX(-Math.PI / 2), mats.wake)
  wake.position.set(0, 0.05, -L / 2 - L * 0.45)
  wake.renderOrder = 3
  g.add(wake)
  g.userData = { L, B, speed, kind }
  return g
}

export function buildBoats(plan) {
  void plan
  const root = new THREE.Group()
  root.name = 'boats'
  const std = (c, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.1, ...opts })
    Mat.registerMaterial(m)
    Mat.tactile(m, 0.7) // t35
    return m
  }
  const HULL = { ferry: std('#f4f4f2'), tour: std('#1f3a5a'), yacht: std('#fafafa', { roughness: 0.25 }), motor: std('#d83a2a'), row: std('#8a5a34'), sampan: std('#5a3e28'), barge: std('#3a4650') }
  const DECK = { ferry: std('#5a6670'), tour: std('#c8b89a'), yacht: std('#b08a5a'), motor: std('#e8e2d4'), row: std('#a8784a'), sampan: std('#8a6a48'), barge: std('#6a5a4a') }
  const cabin = std('#f2f0ea')
  const glass = new THREE.MeshStandardMaterial({ color: '#2a3a48', roughness: 0.1, metalness: 0.5, emissive: '#ffd8a0', emissiveIntensity: 0 })
  Mat.registerMaterial(glass)
  Mat.registerNight(glass, 0, 0.9)
  const dark = std('#2a2c30')
  const ACC = { ferry: std('#1f6ab0'), tour: std('#e8c040'), yacht: std('#1a2a44'), motor: std('#f2f2f2'), row: std('#c84a3a'), sampan: std('#3a5a8a'), barge: std('#b8502a') }
  const wake = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, depthWrite: false })
  const mats = { hull: (k) => HULL[k], deck: (k) => DECK[k], cabin: () => cabin, glass: () => glass, dark: () => dark, accent: (k) => ACC[k], wake }

  // 河道 4 条航道（石拱桥拱洞正中）+ 两侧城墙顶水渠各 2 条航道（水面 = 墙顶平台 +17m）
  const lanes = [-53.3, -6, 6, 53.3]
  const cw = W.topCanalW
  const half = W.cityWidth / 2
  const canalY = W.wallHeight + 12 + 1.4 + 3.6 - 0.25
  const canal = [-(half + 6 + cw * 0.3), -(half + 6 + cw * 0.7), half + 6 + cw * 0.3, half + 6 + cw * 0.7]
  const fleet = [
    ['ferry', 0], ['ferry', 3], ['tour', 1], ['tour', 2], ['tour', 0], ['yacht', 2], ['yacht', 1], ['yacht', 3],
    ['motor', 1], ['motor', 2], ['motor', 0], ['motor', 3], ['row', 0], ['row', 3], ['row', 1], ['row', 2],
    ['sampan', 0], ['sampan', 3], ['barge', 1], ['barge', 2], ['sampan', 2],
    ['sampan', 4], ['tour', 4], ['barge', 5], ['yacht', 5], ['sampan', 5], ['motor', 4], ['row', 4],
    ['sampan', 6], ['ferry', 6], ['barge', 7], ['tour', 7], ['sampan', 7], ['yacht', 6], ['row', 7],
  ]
  const zMax = W.segmentLength * 0.47
  const boats = []
  fleet.forEach(([kind, li], i) => {
    const b = makeType(kind, mats)
    const onCanal = li >= 4
    const x = onCanal ? canal[li - 4] : lanes[li]
    const dir = onCanal ? (li % 2 ? 1 : -1) : li < 2 ? -1 : 1 // 左两道往 -z，右两道往 +z
    b.userData.dir = dir
    b.userData.lane = x
    b.userData.wy = onCanal ? canalY : WATER_Y - 0.25
    b.userData.sway = onCanal ? 0.6 : 1.2
    b.userData.z = -zMax + ((i * 0.618) % 1) * zMax * 2
    b.userData.ph = i * 1.7
    b.rotation.y = dir > 0 ? 0 : Math.PI
    b.position.set(x, b.userData.wy, b.userData.z)
    root.add(b)
    boats.push(b)
  })
  // t33/t34：Googie 大船（邮轮 / 集装箱船 / 汽车渡轮 / 运砂驳船）停在航道之间的空档 + 拖轮 / 帆船 / 快艇 / 渔船空档内漂航
  let sd = 9137
  const srng = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646
  const shipTick = buildShips(root, srng)
  root.userData.tick = (dt, t, cam) => {
    shipTick(dt, t, cam)
    for (const b of boats) {
      const u = b.userData
      u.z += u.dir * u.speed * dt
      if (u.z > zMax) u.z = -zMax
      if (u.z < -zMax) u.z = zMax
      // 远处的船不画（每条船 4~6 个 draw）
      if (cam) {
        const dx = u.lane - cam.x, dy = u.wy - cam.y, dz = u.z - cam.z
        b.visible = dx * dx + dy * dy + dz * dz < 1600 * 1600
        if (!b.visible) continue
      }
      b.position.set(u.lane + Math.sin(t * 0.13 + u.ph) * u.sway, u.wy + Math.sin(t * 1.3 + u.ph) * 0.06, u.z)
      b.rotation.z = Math.sin(t * 0.9 + u.ph) * (u.kind === 'row' ? 0.05 : 0.02)
      b.rotation.x = Math.sin(t * 1.1 + u.ph * 1.3) * 0.012
    }
  }
  return root
}
