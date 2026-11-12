import * as THREE from 'three'
import {
  GROUND, CN, add, plane, cyl, std, glowMat, trackGlow, trackLight, paint, scatter, starPath, solid,
} from './kit.js'

const W = 10
const D = 7.8
const FRONT = D / 2
let doors = null
let signMats = []
let lamps = null
let time = 0

/** 按面板真实宽高比画招牌，字不会被拉扁 */
function fasciaTex(aspect, wide) {
  const H = 150
  const w = Math.round(H * aspect)
  return paint(w, H, (ctx) => {
    ctx.fillStyle = '#d8352f'
    ctx.fillRect(0, 0, w, H)
    ctx.fillStyle = '#ffc63d'
    ctx.fillRect(0, 0, w, 14)
    ctx.fillRect(0, H - 14, w, 14)
    // 灯箱内收的一道白细线，边缘才不像一张平贴的纸
    ctx.strokeStyle = 'rgba(255,253,246,.55)'
    ctx.lineWidth = 3
    ctx.strokeRect(13, 21, w - 26, H - 42)
    const cy = H / 2
    const r = H * 0.29
    const bx = r + 26
    ctx.fillStyle = 'rgba(255,255,255,.16)'
    ctx.beginPath()
    ctx.arc(bx, cy, r + 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fffdf6'
    ctx.beginPath()
    ctx.arc(bx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d8352f'
    starPath(ctx, bx, cy, r * 0.62)
    ctx.fill()
    const tag = '24小时'
    let fs = H * (wide ? 0.5 : 0.46)
    const maxW = w - bx - r - 46 - H * 0.92
    ctx.font = `800 ${fs}px ${CN}`
    while (ctx.measureText('星光商店').width > maxW && fs > 10) {
      fs -= 2
      ctx.font = `800 ${fs}px ${CN}`
    }
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(120,22,18,.35)'
    ctx.fillText('星光商店', bx + r + 16, cy + 5)
    ctx.fillStyle = '#fffdf6'
    ctx.fillText('星光商店', bx + r + 14, cy + 2)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffe9ad'
    ctx.font = `900 ${Math.round(H * 0.28)}px ${CN}`
    ctx.fillText(tag, w - 22, cy + 2)
    // 亚克力罩的斜向反光
    const gl = ctx.createLinearGradient(0, 0, w, H)
    gl.addColorStop(0, 'rgba(255,255,255,.16)')
    gl.addColorStop(0.32, 'rgba(255,255,255,.03)')
    gl.addColorStop(0.55, 'rgba(255,255,255,0)')
    ctx.fillStyle = gl
    ctx.fillRect(0, 0, w, H)
  })
}

function poster(bg, a, b) {
  return paint(160, 220, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    ctx.beginPath()
    ctx.arc(w / 2, 74, 40, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = bg
    ctx.font = `800 38px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(a, w / 2, 74)
    ctx.fillStyle = '#fffdf6'
    ctx.font = `700 24px ${CN}`
    ctx.fillText(b, w / 2, 152)
  })
}

function signBoard(text, sub, bg, fg) {
  return paint(256, 96, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 44px ${CN}`
    ctx.fillText(text, w / 2, sub ? h / 2 - 12 : h / 2)
    if (sub) {
      ctx.font = `600 24px ${CN}`
      ctx.fillText(sub, w / 2, h / 2 + 24)
    }
  })
}

export function buildKonbini(parent) {
  const g = new THREE.Group()
  g.position.set(-20, GROUND, 9 - D / 2)
  const b = (w, h, d, mat, x, y, z, ry = 0, sh = true) => add(g, w, h, d, mat, x, y + h / 2, z, ry, sh)
  const q = (w, h, mat, x, y, z, ry = 0) => plane(g, w, h, mat, x, y, z, ry)

  // 店内墙面、货架、地面都带一点夜间自发光：室内没有足够灯位，靠自发光做均匀基础照度
  const wall = glowMat('#eef1f6', 0, 0.15, { roughness: 0.66 })
  const plinth = std('#333f56', { roughness: 0.5, metalness: 0.15 })
  const frame = std('#26303f', { roughness: 0.36, metalness: 0.3 })
  const brand = std('#d8352f', { roughness: 0.42 })
  const steel = glowMat('#c3ccda', 0, 0.1, { roughness: 0.34, metalness: 0.45 })
  const shelf = glowMat('#e8edf4', 0, 0.22, { roughness: 0.42 })
  const dark = std('#232b3a', { roughness: 0.4 })

  const floorTex = paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f2e8d6'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(178,162,138,.5)'
    ctx.lineWidth = 3
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo((i * w) / 4, 0)
      ctx.lineTo((i * w) / 4, h)
      ctx.moveTo(0, (i * h) / 4)
      ctx.lineTo(w, (i * h) / 4)
      ctx.stroke()
    }
  }, { repeat: [3, 2] })
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex, emissiveMap: floorTex, emissive: '#fff2dd', roughness: 0.62,
  })
  trackGlow(floorMat, 0, 0.26)
  b(W, 0.1, D, floorMat, 0, 0, 0, 0, false)

  b(W, 3.3, 0.18, wall, 0, 0, -D / 2 + 0.09)
  b(0.18, 3.3, D, wall, -W / 2 + 0.09, 0, 0)
  b(0.18, 3.3, 3.2, wall, W / 2 - 0.09, 0, -2.3)
  b(W, 0.12, D, wall, 0, 3.3, 0, 0, false)

  b(W + 0.2, 0.34, D + 0.2, plinth, 0, 0, 0)
  for (const [x, z, sw, sd] of [[-W / 2, FRONT, 0.16, 0.16], [W / 2, FRONT, 0.16, 0.16], [W / 2, -FRONT, 0.16, 0.16]]) {
    b(sw, 3.3, sd, frame, x, 0, z)
  }
  b(W + 0.14, 0.16, 0.14, frame, 0, 3.24, FRONT, 0, false)

  const signFront = fasciaTex((W - 0.24) / 0.72, true)
  const signSide = fasciaTex((D * 0.66) / 0.72, false)
  const signMat = trackGlow(new THREE.MeshStandardMaterial({
    map: signFront, emissiveMap: signFront, emissive: '#ffffff', roughness: 0.42,
  }), 0.42, 0.85)
  const sideMat = trackGlow(new THREE.MeshStandardMaterial({
    map: signSide, emissiveMap: signSide, emissive: '#ffffff', roughness: 0.42,
  }), 0.42, 0.85)
  signMats = [signMat, sideMat]

  b(W + 0.1, 0.8, 0.24, brand, 0, 2.55, FRONT + 0.06, 0, false)
  q(W - 0.24, 0.68, signMat, 0, 2.95, FRONT + 0.19)
  b(0.24, 0.8, D * 0.66, brand, W / 2 + 0.06, 2.55, FRONT - (D * 0.66) / 2 - 0.05, 0, false)
  q(D * 0.64, 0.68, sideMat, W / 2 + 0.19, 2.95, FRONT - (D * 0.66) / 2 - 0.05, Math.PI / 2)
  b(W + 0.1, 0.1, 0.14, std('#fff3d8'), 0, 2.48, FRONT + 0.14, 0, false)
  // 灯箱四周的金属收边：上沿一道细檐、下沿一道细槽
  const edge = std('#8d2b27', { roughness: 0.34, metalness: 0.35 })
  b(W + 0.22, 0.05, 0.34, edge, 0, 3.36, FRONT + 0.06, 0, false)
  b(W + 0.16, 0.04, 0.2, edge, 0, 2.52, FRONT + 0.16, 0, false)
  for (const sx of [-1, 1]) b(0.06, 0.86, 0.22, edge, sx * (W / 2 + 0.03), 2.55, FRONT + 0.06, 0, false)
  b(0.06, 0.86, 0.22, edge, W / 2 + 0.03, 2.55, FRONT - (D * 0.66) - 0.05, 0, false)
  const par = W / 2 + 0.03
  const pd = D / 2 + 0.03
  b(W + 0.06, 0.32, 0.1, wall, 0, 3.42, pd, 0, false)
  b(W + 0.06, 0.32, 0.1, wall, 0, 3.42, -pd, 0, false)
  b(0.1, 0.32, D + 0.06, wall, -par, 3.42, 0, 0, false)
  b(0.1, 0.32, D + 0.06, wall, par, 3.42, 0, 0, false)
  b(W + 0.2, 0.07, 0.18, frame, 0, 3.72, pd, 0, false)
  b(W + 0.2, 0.07, 0.18, frame, 0, 3.72, -pd, 0, false)
  b(0.18, 0.07, D + 0.2, frame, -par, 3.72, 0, 0, false)
  b(0.18, 0.07, D + 0.2, frame, par, 3.72, 0, 0, false)
  b(W - 0.2, 0.04, D - 0.2, std('#7b8496', { roughness: 0.86 }), 0, 3.44, 0, 0, false)

  const glass = new THREE.MeshStandardMaterial({
    color: '#dcefff', transparent: true, opacity: 0.09, roughness: 0.06,
    metalness: 0.12, envMapIntensity: 0.9, depthWrite: false,
  })
  const gx0 = -W / 2 + 0.5
  const gx1 = -1.06
  const gx2 = 1.06
  const gx3 = W / 2 - 0.5
  for (const [a, c] of [[gx0, gx1], [gx2, gx3]]) {
    q(c - a, 1.96, glass, (a + c) / 2, 1.48, FRONT - 0.02)
  }
  const sz0 = -0.7
  q(FRONT - sz0 - 0.2, 1.98, glass, W / 2 - 0.02, 1.48, (sz0 + FRONT) / 2, Math.PI / 2)
  for (const x of [gx0, -3.3, -2.1, gx1, gx2, 2.1, 3.3, gx3]) {
    b(0.08, 2.3, 0.09, frame, x, 0.34, FRONT, 0, false)
  }
  b(W - 1, 0.09, 0.1, frame, 0, 0.34, FRONT, 0, false)
  b(W - 1, 0.1, 0.1, frame, 0, 2.46, FRONT, 0, false)
  for (const z of [3.5, 2.3, 1.1, -0.1, -0.7]) b(0.09, 2.2, 0.08, frame, W / 2, 0.4, z, 0, false)
  b(0.1, 0.1, 4.7, frame, W / 2, 0.34, 1.6, 0, false)
  b(0.1, 0.12, 4.7, frame, W / 2, 2.42, 1.6, 0, false)

  const doorGlass = new THREE.MeshStandardMaterial({
    color: '#e6f6ff', transparent: true, opacity: 0.14, roughness: 0.05,
    metalness: 0.1, envMapIntensity: 0.8, depthWrite: false,
  })
  const doorL = new THREE.Group()
  const doorR = new THREE.Group()
  doorL.position.set(-0.53, 0, FRONT + 0.02)
  doorR.position.set(0.53, 0, FRONT + 0.02)
  g.add(doorL, doorR)
  for (const [dg, sx] of [[doorL, -1], [doorR, 1]]) {
    add(dg, 0.96, 2.38, 0.04, doorGlass, 0, 1.2, 0, 0, false)
    add(dg, 0.05, 2.44, 0.09, frame, 0.46 * sx, 1.2, 0, 0, false)
    add(dg, 0.05, 0.34, 0.09, frame, 0.02 * sx, 1.1, 0.06, 0, false)
  }
  b(2.3, 0.14, 0.16, frame, 0, 2.44, FRONT + 0.04, 0, false)
  b(2.3, 0.03, 0.5, dark, 0, 2.32, FRONT + 0.14, 0, false)
  doors = { L: doorL, R: doorR, l0: -0.53, r0: 0.53 }
  const matTex = paint(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#8f9b8a'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,.22)'
    ctx.lineWidth = 2
    for (let y = 4; y < h; y += 9) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(32,44,36,.4)'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, w - 6, h - 6)
  })
  b(1.7, 0.02, 1.0, new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.88 }), 0, 0.11, FRONT + 0.72, 0, false)

  const canopy = std('#d8352f', { roughness: 0.45 })
  b(3.2, 0.1, 0.95, canopy, 0, 2.44, FRONT + 0.5)
  b(3.2, 0.05, 0.14, std('#fff4de'), 0, 2.39, FRONT + 0.95, 0, false)
  for (const x of [-1.3, 1.3]) add(g, 0.03, 0.16, 0.03, frame, x, 2.4, FRONT + 0.84, 0, false)
  for (const x of [-1.25, 1.25]) {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.98, 6),
      std('#9aa4b4', { metalness: 0.6, roughness: 0.3 }),
    )
    rod.position.set(x, 2.28, FRONT + 0.52)
    rod.rotation.x = -0.98
    g.add(rod)
  }
  // 门廊下的小筒灯：光斑打在垫子上，门口才有落脚处
  const downlight = glowMat('#fff2d2', 1.2, 1.5, { emissive: '#fff0c8', roughness: 0.4 })
  for (const x of [-0.9, 0.9]) b(0.14, 0.03, 0.14, downlight, x, 2.38, FRONT + 0.36, 0, false)

  // 窗下踢脚、门槛石：把玻璃和地面接住，不让玻璃像插在地上
  b(W - 0.9, 0.22, 0.11, plinth, 0, 0.24, FRONT + 0.03, 0, false)
  b(W - 0.9, 0.03, 0.13, std('#a6b0be', { metalness: 0.55, roughness: 0.3 }), 0, 0.35, FRONT + 0.045, 0, false)
  b(2.4, 0.035, 0.16, std('#b6c0cd', { metalness: 0.55, roughness: 0.28 }), 0, 0.12, FRONT + 0.06, 0, false)
  b(0.4, 0.05, 0.12, dark, 0, 2.4, FRONT + 0.12, 0, false)
  b(0.05, 0.02, 0.015, glowMat('#5cf2a8', 1.5, 2.2, { emissive: '#5cf2a8', roughness: 0.3 }), 0.13, 2.42, FRONT + 0.18, 0, false)

  // 玻璃贴标：剪影小人、24H 圆标、自动门箭头
  const decal = (draw, w, h, x, y) => {
    const tex = paint(w, h, (ctx) => {
      ctx.clearRect(0, 0, w, h)
      draw(ctx, w, h)
    })
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w / 220, h / 220), new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0.92,
    }))
    m.position.set(x, y, FRONT + 0.005)
    m.renderOrder = 4
    g.add(m)
  }
  decal((ctx, w, h) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(w / 2, h * 0.2, w * 0.11, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = w * 0.08
    ctx.strokeStyle = '#ffffff'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(w / 2, h * 0.34)
    ctx.lineTo(w / 2, h * 0.62)
    ctx.moveTo(w / 2, h * 0.42)
    ctx.lineTo(w * 0.3, h * 0.56)
    ctx.moveTo(w / 2, h * 0.42)
    ctx.lineTo(w * 0.7, h * 0.56)
    ctx.moveTo(w / 2, h * 0.62)
    ctx.lineTo(w * 0.36, h * 0.9)
    ctx.moveTo(w / 2, h * 0.62)
    ctx.lineTo(w * 0.64, h * 0.9)
    ctx.stroke()
  }, 120, 150, -4.05, 1.62)
  decal((ctx, w, h) => {
    ctx.strokeStyle = '#e9f4ff'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#eef7ff'
    ctx.font = `900 ${w * 0.3}px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('24H', w / 2, h / 2 + 2)
  }, 120, 120, -1.72, 0.72)
  decal((ctx, w, h) => {
    ctx.fillStyle = '#e8f3ff'
    ctx.beginPath()
    ctx.moveTo(w * 0.2, h * 0.3)
    ctx.lineTo(w * 0.2, h * 0.7)
    ctx.lineTo(w * 0.62, h * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(w * 0.62, h * 0.46, w * 0.2, h * 0.08)
  }, 130, 60, 1.78, 1.32)

  // 顶灯：不再是一条条很亮的灯管，改成整片柔光灯板，照度均匀
  const tube = glowMat('#fff6e2', 0.35, 0.66, { emissive: '#fff1cc', roughness: 0.5 })
  const panel = glowMat('#f7f1e4', 0.06, 0.3, { emissive: '#fff3d8', roughness: 0.7 })
  add(g, W - 1.0, 0.03, D - 1.0, panel, 0, 3.22, 0, 0, false)
  for (const [x, z, l] of [
    [-2.4, -0.3, 4.6], [1.7, -0.5, 3.4], [-0.4, -2.5, 3.4], [2.6, 2.4, 2.2], [-2.6, 2.5, 2.4],
  ]) {
    b(l, 0.05, 0.34, tube, x, 3.14, z, 0, false)
  }
  // 天花格栅：把整块顶棚切成一块块，抬头不空
  const ceilMat = std('#dde4ee', { roughness: 0.62 })
  for (const z of [-3.3, -1.9, -0.5, 0.9, 2.3, 3.5]) b(W - 0.5, 0.025, 0.035, ceilMat, 0, 3.1, z, 0, false)
  for (const x of [-4.1, -2.2, -0.3, 1.6, 3.3]) b(0.035, 0.025, D - 0.5, ceilMat, x, 3.1, 0, 0, false)
  // 悬挂的岛头分类吊牌
  const aisle = [
    [signBoard('饭团', '面包', '#ffffff', '#2b3a4a'), -2.1, 0.2],
    [signBoard('饮料', '酒水', '#ffffff', '#2b3a4a'), -2.1, -1.4],
    [signBoard('便当', '熟食', '#ffffff', '#2b3a4a'), 1.1, 1.0],
  ]
  for (const [tex, x, z] of aisle) {
    const m = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.22,
      roughness: 0.55, side: THREE.DoubleSide,
    })
    q(1.3, 0.49, m, x, 2.72, z)
    for (const sx of [-0.5, 0.5]) b(0.012, 0.52, 0.012, steel, x + sx, 2.72, z, 0, false)
  }
  // 两盏灯拉到整个进深，强度收低，靠自发光补均匀度，不再有中间亮两头黑
  const inside = new THREE.PointLight('#fff0d4', 1, 26, 2)
  inside.position.set(-0.6, 2.8, 0.3)
  g.add(inside)
  trackLight(inside, 2.2, 9)
  const inside2 = new THREE.PointLight('#ffe3b8', 1, 22, 2)
  inside2.position.set(2.4, 2.5, -2.2)
  g.add(inside2)
  trackLight(inside2, 1.4, 6)

  const fridge = paint(1024, 460, (ctx, w, h) => {
    ctx.fillStyle = '#f4fbff'
    ctx.fillRect(0, 0, w, h)
    const cols = ['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0', '#f8961e', '#b5179e', '#90be6d', '#3a86ff', '#ffffff']
    for (let r = 0; r < 4; r++) {
      const y = 30 + r * 104
      ctx.fillStyle = '#c8d6e6'
      ctx.fillRect(0, y + 82, w, 7)
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = cols[(i * 7 + r * 3) % cols.length]
        ctx.fillRect(10 + i * 25, y + 8, 17, 68)
        ctx.fillStyle = 'rgba(255,255,255,.55)'
        ctx.fillRect(13 + i * 25, y + 16, 3, 46)
      }
    }
    for (let i = 1; i < 5; i++) {
      ctx.fillStyle = '#aebdd0'
      ctx.fillRect((i * w) / 5 - 4, 0, 8, h)
    }
  })
  const fridgeMat = trackGlow(new THREE.MeshStandardMaterial({
    map: fridge, emissiveMap: fridge, emissive: '#e8f3fb', roughness: 0.34,
  }), 0.4, 0.6)
  b(6.4, 2.2, 0.34, steel, -0.9, 0.1, -D / 2 + 0.5, 0, false)
  q(6.1, 1.95, fridgeMat, -0.9, 1.35, -D / 2 + 0.7)

  const bento = paint(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#f7fafc'
    ctx.fillRect(0, 0, w, h)
    const cols = ['#e63946', '#f4a261', '#2a9d8f', '#ffd166', '#8ecae6']
    for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
      ctx.fillStyle = cols[(i + r) % cols.length]
      ctx.fillRect(12 + i * 48, 14 + r * 72, 36, 54)
    }
  })
  b(2.4, 1.05, 0.6, std('#dbe3ee'), 2.9, 0.1, 1.5, 0, false)
  q(2.2, 0.62, new THREE.MeshStandardMaterial({ map: bento, emissiveMap: bento, emissive: '#ffffff', emissiveIntensity: 0.7, roughness: 0.4 }), 2.9, 1.02, 1.82)
  b(1.35, 0.92, 0.72, shelf, 3.3, 0.1, -0.75, 0, false)
  const oden = glowMat('#ff9a3c', 0.55, 1.6, { emissive: '#ff7a1a', roughness: 0.4 })
  for (const x of [2.95, 3.3, 3.65]) cyl(g, 0.15, 0.24, oden, x, 1.14, 1.86)

  const box = new THREE.BoxGeometry(1, 1, 1)
  const goods = new Map()
  const push = (c, it) => {
    if (!goods.has(c)) goods.set(c, [])
    goods.get(c).push(it)
  }
  const cols = ['#ef476f', '#ffd166', '#06d6a0', '#4cc9f0', '#f8961e', '#c77dff', '#ffffff', '#e9c46a', '#3a86ff']
  const strips = ['#e63946', '#ffd166', '#2a9d8f', '#4cc9f0'].map((c) => std(c, { roughness: 0.5 }))
  for (const [z, len] of [[0.55, 4.6], [-1.0, 3.4]]) {
    b(len, 1.45, 0.62, shelf, -2.1, 0.1, z, 0, false)
    b(len + 0.04, 0.05, 0.68, std('#b9c4d2'), -2.1, 1.53, z, 0, false)
    for (let t = 0; t < 4; t++) {
      b(len - 0.1, 0.04, 0.7, std('#aebdd0'), -2.1, 0.52 + t * 0.26, z, 0, false)
      // 货架前沿的价签条：一格格小色块，远看就是一排商品说明
      b(len - 0.16, 0.045, 0.02, strips[t], -2.1, 0.57 + t * 0.26, z + 0.325, 0, false)
      for (let i = 0; i < Math.floor(len / 0.19); i++) {
        for (const s of [-1, 1]) {
          push(cols[(i + t * 3 + (s > 0 ? 4 : 0)) % cols.length], [
            -2.1 - len / 2 + 0.12 + i * 0.19, 0.62 + t * 0.26, z + s * 0.24,
            0, 0.14, 0.19, 0.16,
          ])
        }
      }
    }
  }
  for (const [c, items] of goods) scatter(g, box, std(c, { roughness: 0.45 }), items)

  const mags = paint(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#f7f8fa'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#ffd166'][i % 5]
      ctx.fillRect(6 + i * 42, 12, 34, 106)
    }
  })
  b(0.9, 1.35, 1.5, std('#dbe3ee'), -4.3, 0.1, 1.5, 0, false)
  q(0.55, 1.1, new THREE.MeshStandardMaterial({ map: mags, roughness: 0.45 }), -3.84, 0.95, 1.5, Math.PI / 2)

  b(1.7, 1.0, 0.72, std('#f0d3a4'), 1.6, 0.1, -2.0, 0, false)
  b(0.36, 0.3, 0.3, dark, 1.25, 1.14, -1.9, 0, false)
  const regScreen = glowMat('#9fe8ff', 1.2, 1.6, { emissive: '#8fe0ff', roughness: 0.35 })
  b(0.3, 0.22, 0.03, regScreen, 1.2, 1.2, -1.74, 0, false)
  b(0.3, 0.62, 0.3, std('#7a5740'), 2.05, 1.14, -2.1, 0, false)
  for (let i = 0; i < 3; i++) cyl(g, 0.045, 0.08, std('#fffdf8'), 1.95, 1.3 + i * 0.09, -1.95 + i * 0.1)
  b(1.1, 2.0, 0.1, std('#cbb79b'), 3.9, 0.1, -D / 2 + 0.24, 0, false)
  // 后场门：门框、观察窗、出口指示
  b(1.26, 0.06, 0.14, steel, 3.9, 2.1, -D / 2 + 0.3, 0, false)
  for (const sx of [-1, 1]) b(0.06, 2.06, 0.14, steel, 3.9 + sx * 0.6, 0.1, -D / 2 + 0.3, 0, false)
  q(0.34, 0.5, new THREE.MeshStandardMaterial({
    color: '#26313f', roughness: 0.12, metalness: 0.3,
  }), 3.9, 1.62, -D / 2 + 0.305)
  b(0.06, 0.26, 0.06, std('#a8b2c0', { metalness: 0.7, roughness: 0.28 }), 3.44, 0.95, -D / 2 + 0.33, 0, false)
  const exitSign = glowMat('#3dff9a', 1.1, 1.3, { emissive: '#3dff9a', roughness: 0.35 })
  b(0.52, 0.16, 0.05, exitSign, 3.9, 2.26, -D / 2 + 0.33, 0, false)

  // 收银台后方的烟架：一格格小盒子，柜台才不是一块空木头
  const cig = paint(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4f6f9'
    ctx.fillRect(0, 0, w, h)
    const cs = ['#d8352f', '#2e5f8a', '#2a9d8f', '#e8b53a', '#f4f6f9', '#7a4e9c', '#3d4a5c']
    for (let r = 0; r < 5; r++) for (let i = 0; i < 12; i++) {
      ctx.fillStyle = cs[(i + r * 3) % cs.length]
      ctx.fillRect(10 + i * 41, 12 + r * 48, 32, 38)
      ctx.fillStyle = 'rgba(255,255,255,.4)'
      ctx.fillRect(13 + i * 41, 16 + r * 48, 26, 4)
    }
  })
  q(1.1, 0.95, new THREE.MeshStandardMaterial({
    map: cig, emissiveMap: cig, emissive: '#ffffff', emissiveIntensity: 0.28, roughness: 0.5,
  }), 2.7, 1.95, -D / 2 + 0.195)
  b(1.16, 0.05, 0.22, std('#c9d2de'), 2.7, 1.46, -D / 2 + 0.3, 0, false)

  // 收银台前的手提篮：叠三只，蓝色是便利店的标准色
  const basket = std('#2f6fb5', { roughness: 0.55 })
  for (let i = 0; i < 3; i++) {
    b(0.52, 0.26, 0.4, basket, 1.62, 0.12 + i * 0.1, FRONT - 0.95)
    b(0.56, 0.04, 0.44, std('#1d4d84'), 1.62, 0.36 + i * 0.1, FRONT - 0.95, 0, false)
  }

  // 墙上的挂钟
  b(0.34, 0.34, 0.04, std('#eef2f7'), -3.9, 2.43, -D / 2 + 0.2, 0, false)
  q(0.3, 0.3, new THREE.MeshStandardMaterial({
    map: paint(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#fbfcfe'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#2b3444'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, 52, 0, Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(w / 2, h / 2)
      ctx.lineTo(w / 2, h * 0.2)
      ctx.moveTo(w / 2, h / 2)
      ctx.lineTo(w * 0.78, h * 0.56)
      ctx.stroke()
    }),
    roughness: 0.4,
  }), -3.9, 2.6, -D / 2 + 0.225)

  const arrow = paint(128, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#2fa36b'
    ctx.fillRect(8, 22, 68, 18)
    ctx.beginPath()
    ctx.moveTo(76, 8)
    ctx.lineTo(118, 32)
    ctx.lineTo(76, 56)
    ctx.fill()
  })
  const arrowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), new THREE.MeshStandardMaterial({
    map: arrow, transparent: true, roughness: 0.8, depthWrite: false,
  }))
  arrowMesh.rotation.x = -Math.PI / 2
  arrowMesh.position.set(0.1, 0.12, 2.5)
  g.add(arrowMesh)

  const popTex = [
    signBoard('新品上市', '饭团', '#e63946', '#fff'),
    signBoard('现磨咖啡', '热饮', '#264653', '#ffd166'),
    signBoard('便当', '免费加热', '#2a9d8f', '#fff'),
  ]
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshStandardMaterial({
      map: popTex[i], emissiveMap: popTex[i], emissive: '#ffffff', emissiveIntensity: 0.35,
      roughness: 0.5, side: THREE.DoubleSide,
    })
    const x = -2.9 + i * 1.15
    q(0.72, 0.42, m, x, 2.02, FRONT - 0.6)
    b(0.02, 0.28, 0.02, dark, x, 2.23, FRONT - 0.6, 0, false)
  }

  const ac = std('#ccd4e0', { roughness: 0.46, metalness: 0.25 })
  for (const [x, z] of [[-2.6, -2.0], [0.4, -2.0], [3.0, -1.8]]) {
    b(0.95, 0.58, 0.5, ac, x, 3.46, z)
    b(0.55, 0.05, 0.36, dark, x, 4.02, z)
  }
  cyl(g, 0.06, 0.5, steel, 2.2, 3.48, -3.3)

  const board = std('#e8dcc4')
  b(0.1, 1.15, 1.5, board, -W / 2 - 0.12, 0.62, 0.4)
  q(0.6, 0.8, std('#fff', { map: poster('#355070', '社区', '公告栏'), roughness: 0.6 }), -W / 2 - 0.19, 1.32, 0.08, -Math.PI / 2)
  q(0.6, 0.8, std('#fff', { map: poster('#e07a28', '新到', '饭团'), roughness: 0.6 }), -W / 2 - 0.19, 1.32, 0.95, -Math.PI / 2)

  const vend = paint(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1e5fa8'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fffdf8'
    ctx.fillRect(0, 0, w, 66)
    ctx.fillStyle = '#1e5fa8'
    ctx.font = `800 40px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('饮料', w / 2, 34)
    const cs = ['#e63946', '#ffd166', '#4cc9f0', '#f4a261', '#ffffff', '#2a9d8f']
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      ctx.fillStyle = cs[(r * 3 + c) % cs.length]
      ctx.fillRect(26 + c * 72, 92 + r * 78, 52, 58)
      ctx.fillStyle = 'rgba(255,255,255,.5)'
      ctx.fillRect(32 + c * 72, 100 + r * 78, 6, 42)
    }
    ctx.fillStyle = '#0f2a44'
    ctx.fillRect(24, 470, w - 48, 30)
  })
  const vx = W / 2 + 0.62
  const vz = 2.2
  b(0.72, 1.9, 0.62, std('#12406e'), vx, 0.1, vz)
  q(0.64, 1.78, new THREE.MeshStandardMaterial({
    map: vend, emissiveMap: vend, emissive: '#ffffff', emissiveIntensity: 0.75, roughness: 0.42,
  }), vx + 0.37, 1.08, vz, Math.PI / 2)
  solid(g.position.x + vx, g.position.z + vz, 0.85, 0.75, GROUND + 1.9)

  const bike = new THREE.Group()
  bike.position.set(-3.3, 0, FRONT + 0.75)
  bike.rotation.y = 0.24
  const bf = std('#2f6fa8', { roughness: 0.42, metalness: 0.3 })
  add(bike, 0.05, 0.06, 1.0, bf, 0, 0.62, 0, 0, false)
  add(bike, 0.05, 0.5, 0.06, bf, 0, 0.6, 0.44, 0, false)
  add(bike, 0.05, 0.42, 0.05, bf, 0, 0.56, -0.42, 0, false)
  add(bike, 0.42, 0.06, 0.14, dark, 0, 0.86, -0.28, 0, false)
  add(bike, 0.5, 0.04, 0.04, dark, 0, 0.92, 0.5, 0, false)
  const tyre = std('#1b2028', { roughness: 0.72 })
  for (const dz of [-0.46, 0.46]) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.038, 8, 18), tyre)
    m.position.set(0, 0.3, dz)
    m.rotation.y = Math.PI / 2
    bike.add(m)
  }
  g.add(bike)

  cyl(g, 0.2, 0.06, steel, -1.85, 0.13, FRONT + 0.62)
  for (const [dx, dz, c] of [[-0.06, 0, '#e85d75'], [0.05, 0.06, '#3d7bd9'], [0, -0.06, '#f2f4f8']]) {
    add(g, 0.05, 0.72, 0.05, std(c), -1.85 + dx, 0.48, FRONT + 0.62 + dz, 0.14, false)
  }
  for (const [x, c] of [[-4.8, '#3d7bd9'], [-4.28, '#3fae6a'], [-3.76, '#d2453c']]) {
    b(0.44, 0.74, 0.42, std(c, { roughness: 0.5 }), x, 0.1, FRONT + 1.05)
    b(0.46, 0.05, 0.44, dark, x, 0.84, FRONT + 1.05, 0, false)
  }

  const pole = std('#8b95a5', { metalness: 0.5, roughness: 0.36 })
  const px = -W / 2 - 0.9
  const pz = -2.6
  cyl(g, 0.1, 7.4, pole, px, 3.7, pz)
  add(g, 1.2, 0.06, 0.06, pole, px + 0.5, 6.9, pz)
  add(g, 0.06, 0.5, 0.06, pole, px + 1.05, 6.66, pz, 0, false)
  // 杆上的变压器与绝缘子
  b(0.34, 0.42, 0.28, std('#9aa3b2', { metalness: 0.5, roughness: 0.42 }), px + 0.3, 5.5, pz, 0, false)
  for (const dz of [-0.14, 0.14]) {
    cyl(g, 0.05, 0.14, std('#dfe6ef', { roughness: 0.3 }), px + 0.3, 6.0, pz + dz)
  }
  for (let i = 0; i < 4; i++) add(g, 0.06, 0.03, 0.06, pole, px + 0.16, 1.2 + i * 1.2, pz, 0, false)
  b(0.56, 0.24, 0.05, std('#1d4e89'), px, 3.3, pz + 0.09, 0, false)
  q(0.48, 0.16, std('#fffdf8', { map: signBoard('星光通', '', '#1d4e89', '#fffdf8'), roughness: 0.5 }), px, 3.42, pz + 0.13)
  wire(g, [px, 7.3, pz], [px + 0.6, 7.1, pz - 5], pole)
  wire(g, [px + 1.05, 6.4, pz], [px + 6.5, 5.6, pz + 0.4], pole)

  const paintLine = std('#f2efe6', { roughness: 0.7 })
  // 落水管：两个前角各一根，把墙和地面连起来
  const pipe = std('#7f8a99', { metalness: 0.35, roughness: 0.45 })
  for (const sx of [-1, 1]) {
    cyl(g, 0.055, 3.4, pipe, sx * (W / 2 + 0.15), 1.7, FRONT - 0.05)
    for (const y of [0.5, 1.9, 3.2]) b(0.07, 0.05, 0.14, pipe, sx * (W / 2 + 0.15), y, FRONT - 0.12, 0, false)
  }
  const parkZ = FRONT + 5.2
  for (const x of [-1.5, 1.5]) b(0.09, 0.02, 2.5, paintLine, x, -0.06, parkZ, 0, false)
  b(3.1, 0.02, 0.09, paintLine, 0, -0.06, parkZ - 1.25, 0, false)
  b(3.1, 0.02, 0.09, paintLine, 0, -0.06, parkZ + 1.25, 0, false)
  b(W + 5, 0.07, 0.26, std('#4e5766'), 0.5, -0.02, FRONT + 2.9, 0, false)
  for (let i = 0; i < 8; i++) b(0.7, 0.02, 0.2, dark, -3.6 + i * 1.1, -0.02, FRONT + 2.9, 0, false)

  const board2 = std('#2f3948')
  b(0.06, 0.62, 0.5, board2, 2.6, 0.5, FRONT + 1.6)
  q(0.44, 0.5, std('#fffdf8', { map: signBoard('营业中', '24小时', '#2f3948', '#ffd166'), roughness: 0.5 }), 2.6, 0.84, FRONT + 1.86)

  const sig = W / 2 + 1.2
  const sigZ = FRONT + 2.6
  cyl(g, 0.07, 3.4, steel, sig, 1.7, sigZ)
  b(0.3, 0.78, 0.24, dark, sig, 2.9, sigZ, 0, false)
  const redL = glowMat('#3a1012', 0.22, 1.5, { emissive: '#ff3048', roughness: 0.35 })
  const yelL = glowMat('#3a3010', 0.05, 0.06, { emissive: '#ffd15c', roughness: 0.35 })
  const grnL = glowMat('#0e2a18', 0.05, 0.06, { emissive: '#3dff8a', roughness: 0.35 })
  b(0.17, 0.17, 0.07, redL, sig, 3.42, sigZ + 0.13, 0, false)
  b(0.17, 0.17, 0.07, yelL, sig, 3.19, sigZ + 0.13, 0, false)
  b(0.17, 0.17, 0.07, grnL, sig, 2.96, sigZ + 0.13, 0, false)
  lamps = { red: redL, yel: yelL, grn: grnL }

  solid(g.position.x, g.position.z, W, D, GROUND + 3.9)
  parent.add(g)
}

function wire(parent, a, b, mat) {
  const mid = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 0.9, (a[2] + b[2]) / 2]
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(...a),
    new THREE.Vector3(...mid),
    new THREE.Vector3(...b),
  ])
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.02, 5, false), mat)
  mesh.castShadow = false
  parent.add(mesh)
}

export function tickKonbini(dt) {
  time += dt
  if (doors) {
    const phase = time % 8.5
    const open = phase > 5.2 && phase < 7.1
    const shift = open ? 0.78 : 0
    doors.L.position.x += (doors.l0 - shift - doors.L.position.x) * Math.min(1, dt * 4)
    doors.R.position.x += (doors.r0 + shift - doors.R.position.x) * Math.min(1, dt * 4)
  }
  if (signMats.length && Math.random() < dt * 0.3) signMats[0].userData.flick = 0.5
  for (const m of signMats) {
    if (!m.userData.flick) continue
    m.userData.flick = Math.max(0, m.userData.flick - dt * 3)
    m.emissiveIntensity *= 0.45 + 0.55 * (1 - m.userData.flick)
  }
  if (!lamps) return
  const s = time % 10
  const red = s < 4.2
  const yel = s >= 4.2 && s < 5.1
  lamps.red.emissiveIntensity = red ? 1.6 : 0.05
  lamps.yel.emissiveIntensity = yel ? 1.4 : 0.04
  lamps.grn.emissiveIntensity = !red && !yel ? 1.4 : 0.04
}
