import * as THREE from 'three'
import { makeGrenadeView } from './grenade.js'

function metal(color = 0x6e757c, roughness = 0.38) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.8,
    emissive: 0x101214,
    emissiveIntensity: 0.12,
  })
}

function polymer(color = 0x2a2d32) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    metalness: 0.06,
    emissive: 0x0a0b0c,
    emissiveIntensity: 0.08,
  })
}

function wood(color = 0x7a5234) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.04,
    emissive: 0x1a1008,
    emissiveIntensity: 0.1,
  })
}

function part(g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  g.add(m)
  return m
}

const Box = (x, y, z) => new THREE.BoxGeometry(x, y, z)
/** 沿 Z 轴的圆柱（枪管等）；rTop 在后方(+Z)，rBot 在前方(-Z) */
function cylZ(g, rRear, rFront, len, mat, x, y, z, seg = 14) {
  return part(g, new THREE.CylinderGeometry(rRear, rFront, len, seg), mat, x, y, z, Math.PI / 2)
}

/** XY 截面沿 Z 拉伸（z0 < z1） */
function prismZ(profile, z0, z1, mat) {
  const s = new THREE.Shape()
  profile.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false })
  geo.translate(0, 0, z0)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, mat)
}

/** 侧视轮廓 [z, y] 沿 X 拉伸成指定厚度（枪托等） */
function sideProfile(pts, width, mat) {
  const s = new THREE.Shape()
  pts.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)))
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  })
  geo.translate(0, 0, -width / 2)
  geo.rotateY(-Math.PI / 2)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, mat)
}

/**
 * 沙漠之鹰 Mark XIX（.50AE）：长而平的侧板套筒、三角截面枪管顶部、
 * 大号方形扳机护圈、后倾握把，银色套筒 + 黑色枪身/握把。单位：米（真枪约 27cm 长）
 */
function makeDeagle() {
  const g = new THREE.Group()
  const steel = metal(0xc6cad0, 0.26)
  const dark = metal(0x26292d, 0.45)
  const rubber = polymer(0x141618)

  // 上部：下宽上窄的三角截面，两侧是平板
  g.add(
    prismZ(
      [
        [-0.0185, 0.016],
        [0.0185, 0.016],
        [0.0185, 0.036],
        [0.0095, 0.056],
        [-0.0095, 0.056],
        [-0.0185, 0.036],
      ],
      -0.272,
      -0.004,
      steel,
    ),
  )
  // 套筒 / 枪管分界线
  part(g, Box(0.0378, 0.02, 0.0016), dark, 0, 0.026, -0.125)
  // 套筒后部防滑纹
  for (let i = 0; i < 7; i++) part(g, Box(0.0378, 0.015, 0.0018), dark, 0, 0.026, -0.012 - i * 0.0055)
  // 顶部瞄具
  part(g, Box(0.004, 0.009, 0.012), dark, 0, 0.06, -0.258)
  part(g, Box(0.006, 0.008, 0.008), dark, -0.006, 0.06, -0.014)
  part(g, Box(0.006, 0.008, 0.008), dark, 0.006, 0.06, -0.014)
  // 枪口（黑色膛口）
  cylZ(g, 0.0068, 0.0068, 0.004, dark, 0, 0.034, -0.2725, 16)

  // 枪身（套筒下方，前伸到枪管下）
  part(g, Box(0.031, 0.02, 0.21), dark, 0, 0.006, -0.115)
  // 大号扳机护圈：前方平直+前钩，底部平
  part(g, Box(0.012, 0.042, 0.006), dark, 0, -0.018, -0.09, -0.12)
  part(g, Box(0.012, 0.006, 0.07), dark, 0, -0.039, -0.057)
  part(g, Box(0.012, 0.01, 0.004), dark, 0, -0.033, -0.095)
  // 扳机
  part(g, Box(0.006, 0.024, 0.006), steel, 0, -0.014, -0.055, 0.3)

  // 握把：底部朝后倾斜（约 15°）
  const grip = new THREE.Group()
  grip.position.set(0, -0.004, -0.008)
  grip.rotation.x = -0.27
  g.add(grip)
  part(grip, Box(0.03, 0.135, 0.058), dark, 0, -0.066, 0.014)
  part(grip, Box(0.036, 0.115, 0.05), rubber, 0, -0.07, 0.016)
  part(grip, Box(0.033, 0.009, 0.062), dark, 0, -0.137, 0.014)

  // 击锤、尾舌、保险、空仓挂机
  part(g, Box(0.012, 0.017, 0.01), dark, 0, 0.032, 0.004, -0.45)
  part(g, Box(0.03, 0.008, 0.022), dark, 0, 0.008, 0.008)
  part(g, Box(0.004, 0.008, 0.016), dark, 0.0205, 0.03, -0.02)
  part(g, Box(0.004, 0.008, 0.016), dark, -0.0205, 0.03, -0.02)
  part(g, Box(0.004, 0.006, 0.02), dark, -0.0175, 0.012, -0.075)

  g.userData.muzzle = new THREE.Vector3(0, 0.034, -0.276)
  return g
}

/** AK-47：弧形香蕉弹匣、木质枪托/护木/握把、枪管上方导气管、准星护翼、防尘盖、斜切枪口制退器。单位：米 */
function makeAk47() {
  const g = new THREE.Group()
  const recv = metal(0x2b2e33, 0.5)
  const blued = metal(0x1f2226, 0.42)
  const wd = wood(0x8b4a22)
  const wdDark = wood(0x6a3518)
  const mag = metal(0x34373c, 0.55)

  // 机匣 + 圆顶防尘盖
  part(g, Box(0.044, 0.058, 0.28), recv, 0, -0.022, 0.0)
  const dc = cylZ(g, 0.0215, 0.0215, 0.25, recv, 0, 0.004, 0.012, 18)
  dc.scale.set(1, 1, 0.6)
  part(g, Box(0.012, 0.01, 0.016), blued, 0, 0.012, 0.13) // 复进簧导杆卡笋
  // 前机匣 / 表尺座
  part(g, Box(0.044, 0.05, 0.03), recv, 0, -0.02, -0.155)
  part(g, Box(0.03, 0.026, 0.05), blued, 0, 0.012, -0.155)
  part(g, Box(0.022, 0.006, 0.05), blued, 0, 0.027, -0.15, 0.04)

  // 枪管（前细后粗）
  cylZ(g, 0.0095, 0.0085, 0.36, blued, 0, 0, -0.32)
  // 导气箍 + 枪管上方导气管 + 上护木
  part(g, Box(0.022, 0.042, 0.028), blued, 0, 0.015, -0.36)
  cylZ(g, 0.0095, 0.0095, 0.2, blued, 0, 0.03, -0.26)
  const uh = cylZ(g, 0.016, 0.016, 0.16, wd, 0, 0.03, -0.25, 14)
  uh.scale.set(1, 1, 0.85)
  // 下护木 + 护木箍
  cylZ(g, 0.025, 0.023, 0.19, wd, 0, -0.01, -0.235, 14)
  cylZ(g, 0.0262, 0.0262, 0.012, blued, 0, -0.01, -0.334, 14)

  // 准星座：立柱 + 两侧护翼，下方刺刀座
  part(g, Box(0.02, 0.03, 0.03), blued, 0, 0.006, -0.47)
  cylZ(g, 0.0018, 0.0018, 0.03, blued, 0, 0.035, -0.47, 6).rotation.set(0, 0, 0)
  part(g, Box(0.003, 0.03, 0.012), blued, 0.009, 0.035, -0.47)
  part(g, Box(0.003, 0.03, 0.012), blued, -0.009, 0.035, -0.47)
  part(g, Box(0.01, 0.012, 0.025), blued, 0, -0.014, -0.47)

  // 斜切枪口制退器（右侧长、左侧短）
  const brakeGeo = new THREE.CylinderGeometry(0.0115, 0.0115, 0.042, 16)
  const bp = brakeGeo.attributes.position
  for (let i = 0; i < bp.count; i++) {
    if (bp.getY(i) > 0) bp.setY(i, bp.getY(i) + bp.getX(i) * 0.9)
  }
  bp.needsUpdate = true
  brakeGeo.computeVertexNormals()
  part(g, brakeGeo, blued, 0, 0, -0.521, -Math.PI / 2)

  // 弧形香蕉弹匣：一节节沿圆弧向前弯
  const R = 0.3
  const L = 0.23
  const N = 10
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) * (L / N)
    const phi = s / R
    const y = -0.05 - R * Math.sin(phi)
    const z = -0.055 - R * (1 - Math.cos(phi))
    const depth = 0.062 - i * 0.0006
    part(g, Box(0.026, (L / N) * 1.08, depth), mag, 0, y, z, phi)
    if (i % 2 === 1) part(g, Box(0.0275, 0.004, depth * 0.8), blued, 0, y, z, phi)
  }
  part(g, Box(0.012, 0.012, 0.01), blued, 0, -0.054, -0.018) // 弹匣卡笋

  // 扳机护圈 + 扳机
  part(g, Box(0.01, 0.004, 0.065), blued, 0, -0.078, 0.008)
  part(g, Box(0.01, 0.026, 0.004), blued, 0, -0.064, -0.023)
  part(g, Box(0.005, 0.02, 0.005), blued, 0, -0.061, 0.0, 0.25)
  // 握把：底部朝后
  const grip = new THREE.Group()
  grip.position.set(0, -0.05, 0.05)
  grip.rotation.x = -0.4
  g.add(grip)
  part(grip, Box(0.03, 0.11, 0.042), wdDark, 0, -0.055, 0)
  // 右侧大号快慢机拨片 + 拉机柄
  part(g, Box(0.003, 0.014, 0.095), blued, 0.0235, -0.004, 0.02, 0.05)
  cylZ(g, 0.006, 0.006, 0.025, blued, 0.033, -0.004, -0.085, 10).rotation.set(0, 0, Math.PI / 2)

  // 木质枪托（梳状线向后下垂）+ 底板
  const stock = sideProfile(
    [
      [0.135, 0.002],
      [0.42, -0.03],
      [0.42, -0.15],
      [0.395, -0.15],
      [0.2, -0.072],
      [0.135, -0.05],
    ],
    0.034,
    wd,
  )
  g.add(stock)
  part(g, Box(0.042, 0.124, 0.006), blued, 0, -0.09, 0.425)

  g.userData.muzzle = new THREE.Vector3(0, 0, -0.545)
  return g
}

/** 泵动霰弹枪（雷明顿 870 风格）：钢机匣、通风导轨枪管、下方管形弹仓、带纹路的木质滑动护木、木托 */
function makeShotgun() {
  const g = new THREE.Group()
  const steel = metal(0x2f3236, 0.42)
  const wd = wood(0x8a5a38)
  const dk = polymer(0x18191b)

  part(g, Box(0.044, 0.062, 0.17), steel, 0, -0.01, 0.03)
  part(g, Box(0.002, 0.024, 0.06), dk, 0.0222, 0.004, 0.02) // 抛壳窗
  cylZ(g, 0.0115, 0.0115, 0.48, steel, 0, 0.016, -0.295)
  part(g, Box(0.008, 0.004, 0.47), steel, 0, 0.0295, -0.29)
  part(g, new THREE.SphereGeometry(0.0032, 8, 6), metal(0xe8d9a0, 0.3), 0, 0.034, -0.527)
  cylZ(g, 0.0105, 0.0105, 0.38, steel, 0, -0.012, -0.245)
  cylZ(g, 0.0122, 0.0122, 0.016, steel, 0, -0.012, -0.442)
  // 滑动护木
  cylZ(g, 0.021, 0.021, 0.16, wd, 0, -0.008, -0.2, 16)
  for (let i = 0; i < 7; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.0212, 0.0016, 6, 20), dk)
    t.position.set(0, -0.008, -0.14 - i * 0.02)
    g.add(t)
  }
  // 扳机护圈 + 扳机
  part(g, Box(0.012, 0.005, 0.07), steel, 0, -0.058, 0.055)
  part(g, Box(0.012, 0.022, 0.005), steel, 0, -0.048, 0.02)
  part(g, Box(0.005, 0.02, 0.005), steel, 0, -0.046, 0.05, 0.25)
  // 木托 + 橡胶托底
  g.add(
    sideProfile(
      [
        [0.11, 0.018],
        [0.47, -0.02],
        [0.47, -0.135],
        [0.44, -0.135],
        [0.2, -0.066],
        [0.13, -0.06],
        [0.11, -0.04],
      ],
      0.036,
      wd,
    ),
  )
  part(g, Box(0.044, 0.122, 0.02), dk, 0, -0.077, 0.482)

  g.userData.muzzle = new THREE.Vector3(0, 0.016, -0.537)
  return g
}

/**
 * 弹道参数（游戏尺度，但按真实比例换算）：
 *  energy ≈ 子弹动量 / 6 N·s —— .50AE(19g@470m/s≈9N·s)=1.5，7.62x39(8g@715m/s≈5.7N·s)=1.0，00 号鹿弹单丸≈1.4N·s=0.25
 *  spread / bloom 为弧度锥角；kick 为每发枪口上跳（弧度），之后按 recover 速率完全回正
 */
export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: '沙漠之鹰',
    key: '1',
    auto: false, // 半自动：一按一发
    cooldown: 230,
    kick: 0.05,
    kickSide: 0.012,
    recover: 7,
    recoverDelay: 90,
    viewKick: 0.07,
    shake: 0.014,
    range: 40,
    pellets: 1,
    spread: 0.0015,
    bloom: 0.008,
    bloomMax: 0.02,
    bloomDecay: 0.06,
    energy: 1.5,
    retain: 0.6,
    penetrate: 3,
    build: makeDeagle,
    hold: { x: 0.06, y: -0.17, z: -0.38, s: 0.92, rx: 0.02, ry: -0.05, rz: 0.02 },
  },
  smg: {
    id: 'smg',
    name: 'AK-47',
    key: '2',
    auto: true,
    cooldown: 100, // 600 发/分
    kick: 0.014,
    kickSide: 0.007,
    recover: 6,
    recoverDelay: 110,
    viewKick: 0.03,
    shake: 0.008,
    range: 40,
    pellets: 1,
    spread: 0.003,
    bloom: 0.0035,
    bloomMax: 0.028,
    bloomDecay: 0.05,
    energy: 1.0,
    retain: 0.55,
    penetrate: 3,
    build: makeAk47,
    hold: { x: 0.07, y: -0.17, z: -0.4, s: 0.62, rx: 0.02, ry: -0.04, rz: 0.02 },
  },
  shotgun: {
    id: 'shotgun',
    name: '霰弹枪',
    key: '3',
    auto: false, // 泵动
    cooldown: 750,
    kick: 0.07,
    kickSide: 0.015,
    recover: 6,
    recoverDelay: 120,
    viewKick: 0.11,
    shake: 0.022,
    range: 30,
    pellets: 9,
    spread: 0.045,
    bloom: 0,
    bloomMax: 0,
    energy: 0.25,
    retain: 0.3,
    penetrate: 1,
    build: makeShotgun,
    hold: { x: 0.07, y: -0.19, z: -0.42, s: 0.62, rx: 0.02, ry: -0.04, rz: 0.02 },
  },
  grenade: {
    id: 'grenade',
    name: '手雷',
    key: '4',
    auto: false,
    throw: true,
    cooldown: 1100,
    kick: 0.02,
    kickSide: 0.008,
    recover: 8,
    viewKick: 0.04,
    shake: 0.01,
    range: 0,
    pellets: 0,
    spread: 0,
    penetrate: 0,
    fuse: 2.0,
    build: makeGrenadeView,
    hold: { x: 0.1, y: -0.2, z: -0.4, s: 1.15, rx: 0.1, ry: -0.15, rz: 0.05 },
  },
}

export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'grenade']

export function createViewmodels(camera) {
  const root = new THREE.Group()
  root.name = 'viewmodels'
  camera.add(root)

  const light = new THREE.PointLight(0xfff2e0, 0.9, 2.5)
  light.position.set(0.08, 0.18, 0.12)
  root.add(light)
  const fill = new THREE.HemisphereLight(0xffffff, 0x554433, 0.55)
  root.add(fill)

  const models = {}
  for (const id of WEAPON_ORDER) {
    const def = WEAPONS[id]
    const mesh = def.build()
    const h = def.hold
    mesh.scale.setScalar(h.s)
    mesh.position.set(h.x, h.y, h.z)
    mesh.rotation.set(h.rx, h.ry, h.rz)
    mesh.visible = false
    root.add(mesh)
    models[id] = mesh
  }

  const flash = new THREE.PointLight(0xffcc66, 0, 2.8)
  flash.position.set(0.15, -0.12, -0.7)
  root.add(flash)

  return { root, models, flash }
}
