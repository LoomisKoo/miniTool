import * as THREE from 'three'
import {
  GROUND, CN, add, plane, cyl, std, glowMat, trackGlow, paint, scatter, solid, mulberry32, WIN, trackEnv,
  shopInterior, cutFront, shopFront,
} from './kit.js'
import { wallFace, clad, roofKit, louver, downpipe } from './buildings.js'
import {
  podiumTower, stoneOfficeBlock, courtyardBlock,
  pointBlock, gallerySlab, brickWalkupBlock,
} from './families.js'

// 街对面那排临街面；建筑从这里往 +z 长
const FAR = 24.2
const cell = new THREE.BoxGeometry(1, 1, 1)

const winBlue = WIN.glass
const winWarm = WIN.warm
const winShade = WIN.shade
const alu = trackEnv(std('#dde4ea', { metalness: 0.7, roughness: 0.26 }), 1.0, 0.3)
const bandG = trackEnv(std('#9aa6b0', { metalness: 0.4, roughness: 0.42 }), 0.8, 0.24)
const pipe = std('#8d97a2', { metalness: 0.35, roughness: 0.5 })
const darkSteel = std('#3b444e', { metalness: 0.45, roughness: 0.46 })
const glowLow = (color, day, night) => glowMat(color, day, night, { emissive: color, roughness: 0.4 })

function textSign(text, sub, bg, fg, W = 512, H = 160) {
  return paint(W, H, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = fg
    ctx.font = `800 ${Math.round(H * (sub ? 0.42 : 0.52))}px ${CN}`
    ctx.fillText(text, W / 2, sub ? H * 0.38 : H / 2)
    if (sub) {
      ctx.font = `600 ${Math.round(H * 0.24)}px ${CN}`
      ctx.fillText(sub, W / 2, H * 0.74)
    }
  })
}

function bladeSign(lines, bg, fg) {
  return paint(120, 420, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = fg
    ctx.lineWidth = 5
    ctx.strokeRect(8, 8, w - 16, h - 16)
    ctx.fillStyle = fg
    ctx.font = `800 62px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    lines.forEach((c, i) => ctx.fillText(c, w / 2, 76 + i * 82))
  })
}

function signMesh(parent, tex, w, h, x, y, z, ry = 0, night = 0.75) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: '#ffffff', roughness: 0.46, side: THREE.DoubleSide,
  })
  trackGlow(mat, night * 0.4, night)
  plane(parent, w, h, mat, x, y, z, ry)
  return mat
}

/* ───────────── 玻璃塔：临街一栋 15 层的蓝玻璃办公楼 ───────────── */
function glassTower() {
  const W = 16
  const D = 13
  const sW = 11.6
  const sD = 9.2
  const podH = 6.4
  const floors = 15
  const FH = 3.4
  const sH = floors * FH
  const g = new THREE.Group()
  g.position.set(-2, GROUND, FAR + D / 2)
  g.rotation.y = Math.PI

  const stone = std('#d2d8db', { roughness: 0.6 })
  const stoneD = std('#aeb6bb', { roughness: 0.66 })
  const core = std('#5e6c78', { roughness: 0.6 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  cutFront(g, W, D, podH, stone, 4.3, 13.4, -0.2)
  // 后半截护墙和正面压顶都往外多伸出 3cm，别和 cutFront 切出来的墙面齐平
  add(g, W + 0.12, 1.0, 1.1, stoneD, 0, 0.5, -D / 2 + 0.46)
  b(W + 0.16, 1.0, 0.22, stoneD, 0, 0, D / 2 - 0.05)
  // 檐口带顶面别和裙楼屋面齐平：齐平的话 fixZfight 会把整块金属带顶上来
  // 盖住整个屋面（截面变深色），而且重叠 139 m² 的面本身就会闪
  b(W + 0.26, 0.2, D + 0.26, darkSteel, 0, podH - 0.26, 0)
  // 塔身往下插进裙楼 10cm，屋面与塔底不再共面
  b(sW - 0.5, sH + 0.1, sD - 0.5, core, 0, podH - 0.1, 0)

  const skin = {
    glass: winBlue, warm: winWarm, shade: winShade, metal: alu, band: bandG,
    lit: 0.6, fin: 0.32, h: sH, y0: podH, floors, punch: 0.9, inset: 0.07,
  }
  const ax = sD / 2 - 0.04
  const az = sW / 2 - 0.04
  wallFace(g, { ...skin, along: 'x', at: ax, w: sW - 1.5, bays: 5, sign: 1, seed: 101 })
  wallFace(g, { ...skin, along: 'x', at: -ax, w: sW - 1.5, bays: 5, sign: -1, seed: 112 })
  wallFace(g, { ...skin, along: 'z', at: az, w: sD - 1.4, bays: 4, sign: 1, seed: 123 })
  wallFace(g, { ...skin, along: 'z', at: -az, w: sD - 1.4, bays: 4, sign: -1, seed: 134 })

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b(1.0, sH + 0.3, 1.0, alu, sx * (sW / 2 - 0.14), podH - 0.15, sz * (sD / 2 - 0.14))
    }
  }
  b(sW + 0.5, 0.45, sD + 0.5, alu, 0, podH + sH, 0)
  b(sW - 2.4, 3.6, sD - 2.4, core, 0, podH + sH + 0.35, 0)
  b(sW - 3.0, 0.5, sD - 3.0, alu, 0, podH + sH + 3.95, 0)
  b(0.22, 6.0, 0.22, alu, sW / 2 - 1.6, podH + sH + 4.2, -sD / 2 + 1.6)
  const avi = glowLow('#ff4152', 0.1, 1.0)
  b(0.3, 0.3, 0.3, avi, sW / 2 - 1.6, podH + sH + 10.3, -sD / 2 + 1.6)

  // 底层：药妆店 + 大堂
  const podGlass = new THREE.MeshStandardMaterial({
    color: '#f2f4f0', transparent: true, opacity: 0.24, roughness: 0.08, depthWrite: false,
  })
  plane(g, 9.6, 3.6, podGlass, -1.9, 2.2, D / 2 + 0.1)
  shopInterior(g, {
    w: 12.6, zFront: D / 2 - 0.5, depth: 4.2, h: 3.85, kind: 'pharmacy',
    floor: '#e9eeeb', back: '#f6f9f6', side: '#eef3f0', island: 2, counter: true, seed: 21,
    goods: ['#e15a72', '#f2c14e', '#54b3a6', '#6aa6d8', '#f0f2f4', '#d68fb5', '#9ac47a', '#ffffff'],
  })
  shopFront(g, { w: 12.4, z: D / 2 + 0.2, h: 3.5, doorX: -1.4, doorW: 1.3, potX: 5.6, canopy: 1.0 })
  for (const x of [-6.7, -4.2, -1.7, 2.9]) b(0.09, 3.9, 0.12, alu, x, 0.2, D / 2 + 0.17, 0, false)
  b(11, 0.3, 0.4, alu, -1.4, 4.2, D / 2 + 0.2)
  // 药妆店大灯箱：之前只有几条红色促销条，没有店名，所以认不出是什么店
  b(8.6, 1.32, 0.26, std('#eef3f2', { roughness: 0.5 }), -1.8, 4.3, D / 2 + 0.24, 0, false)
  const dsMat = new THREE.MeshStandardMaterial({
    map: textSign('松本药妆', '药 · 妆 · 日用品', '#f4f9f7', '#c0392b', 640, 180),
    emissiveMap: textSign('松本药妆', '药 · 妆 · 日用品', '#f4f9f7', '#c0392b', 640, 180),
    emissive: '#ffffff', roughness: 0.46,
  })
  trackGlow(dsMat, 0.3, 0.85)
  plane(g, 8.3, 1.1, dsMat, -1.8, 4.96, D / 2 + 0.43)
  // 大堂玻璃：和药妆店玻璃同一高度但宽度不重叠，否则同深度两层玻璃会打架
  plane(g, 2.8, 3.9, new THREE.MeshStandardMaterial({
    color: '#2f4650', roughness: 0.1, metalness: 0.4, emissive: '#bfe6f2', emissiveIntensity: 0.06,
  }), 4.9, 2.2, D / 2 + 0.104)
  b(13.4, 0.16, 1.6, alu, -0.6, 4.55, D / 2 + 0.7)
  for (const x of [-6.6, 4.6]) cyl(g, 0.11, 4.55, alu, x, 2.28, D / 2 + 1.2)
  clad(g, D, podH, W / 2 + 0.05, 0, 0, Math.PI / 2, 5, 3)
  for (const sx of [-1, 1]) {
    b(0.5, 0.8, 0.5, std('#7f8b92', { roughness: 0.8 }), sx * 6.0, 0.02, D / 2 + 1.0, 0, false)
    cyl(g, 0.5, 0.7, std('#5d7a55', { roughness: 1, flatShading: true }), sx * 6.0, 0.9, D / 2 + 1.0)
  }
  louver(g, sW - 3.4, 2.4, 0, podH + sH + 3.5, sD / 2 - 1.1, 0, 6)
  roofKit(g, sW - 2.4, sD - 2.4, podH + sH + 3.95, { rail: true, caps: '#c9d2d8' })
  for (const sx of [-1, 1]) downpipe(g, sx * (W / 2 - 0.35), D / 2 - 0.4, podH + 0.3)
  solid(g.position.x, g.position.z, W, D, GROUND + podH + sH)
  return g
}

/* ───────────── 红砖老住宅：凸窗、防火梯、屋顶水塔、底层拉面馆 ───────────── */
function brickWalkup() {
  const W = 9.2
  const D = 9.6
  const floors = 5
  const FH = 3.0
  const H = floors * FH
  const g = new THREE.Group()
  g.position.set(-25, GROUND, FAR + D / 2)
  g.rotation.y = Math.PI

  const brick = paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8b7160'
    ctx.fillRect(0, 0, w, h)
    const bh = 15
    const bw = 40
    for (let r = 0; r < h / bh; r++) {
      for (let c = -1; c < w / bw + 1; c++) {
        const off = r % 2 ? bw / 2 : 0
        const v = 158 + ((r * 37 + c * 53) % 26)
        ctx.fillStyle = `rgb(${v},${Math.round(v * 0.62)},${Math.round(v * 0.5)})`
        ctx.fillRect(c * bw + off + 1, r * bh + 1, bw - 3, bh - 3)
      }
    }
  }, { repeat: [3, 4] })
  const wall = std('#ffffff', { map: brick, roughness: 0.92 })
  const trim = std('#e9e2d4', { roughness: 0.74 })
  const wood = std('#6d4a30', { roughness: 0.72 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  cutFront(g, W, D, FH, wall, 3.2, 6.5)
  b(W, H - FH, D, wall, 0, FH, 0)
  b(W + 0.2, 0.5, D + 0.2, trim, 0, H, 0)
  b(W - 1.2, 1.6, D - 1.2, std('#b8ada0', { roughness: 0.9 }), 0, H + 0.5, 0)
  // 屋顶水塔
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    b(0.14, 1.4, 0.14, pipe, 2.4 + dx, H + 0.5, -1.8 + dz)
  }
  cyl(g, 1.5, 2.2, std('#8a7a68', { roughness: 0.8 }), 2.4, H + 2.6, -1.8)
  cyl(g, 1.6, 0.18, pipe, 2.4, H + 3.8, -1.8)
  b(2.0, 2.4, 2.0, std('#a99c8c', { roughness: 0.86 }), -2.6, H + 0.5, 1.4)

  // 木质凸窗：外挑 + 窗框 + 窗台，不是贴片
  const lit = WIN.warm
  const glassD = WIN.shade
  for (let f = 1; f < floors; f++) {
    const y = f * FH
    for (const x of [-2.5, 2.5]) {
      b(2.0, 1.9, 0.7, trim, x, y + 0.55, D / 2 + 0.35)
      b(1.6, 1.5, 0.06, (f + Math.round(x)) % 3 ? lit : glassD, x, y + 0.8, D / 2 + 0.72, 0, false)
      b(0.07, 1.5, 0.1, wood, x, y + 0.8, D / 2 + 0.75, 0, false)
      b(2.2, 0.14, 0.9, trim, x, y + 0.45, D / 2 + 0.42)
      b(2.2, 0.1, 0.9, std('#d9d0c0', { roughness: 0.8 }), x, y + 2.4, D / 2 + 0.42, 0, false)
    }
    b(W - 0.4, 0.1, 0.12, trim, 0, y - 0.05, D / 2 + 0.02, 0, false)
  }
  // 防火梯：平台 + 竖栏杆 + 斜梯
  const fe = std('#4a5560', { metalness: 0.5, roughness: 0.45 })
  for (let f = 1; f < floors; f++) {
    const y = f * FH
    b(1.5, 0.09, 2.6, fe, W / 2 + 0.75, y + 0.5, 1.2)
    b(1.5, 0.05, 0.05, fe, W / 2 + 0.75, y + 1.5, 2.45)
    b(0.05, 1.0, 0.05, fe, W / 2 + 1.45, y + 1.0, 2.45)
    for (let i = 0; i < 7; i++) b(0.04, 0.9, 0.04, fe, W / 2 + 0.1, y + 1.0, 0.05 + i * 0.4)
    const lad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.1, 0.06), fe)
    lad.position.set(W / 2 + 1.25, y - 0.5, 0.55)
    lad.rotation.x = 0.42
    g.add(lad)
  }

  // 底层拉面馆
  const shopGlass = new THREE.MeshStandardMaterial({
    color: '#ffd9a8', transparent: true, opacity: 0.36, roughness: 0.1, depthWrite: false,
  })
  plane(g, 6.4, 2.0, shopGlass, 0, 1.5, D / 2 + 0.1)
  shopInterior(g, {
    w: 6.2, zFront: D / 2 - 0.34, depth: 3.0, h: 2.7,
    floor: '#8e7458', back: '#e8d6b6', side: '#d8c4a2', counter: true, sides: true, seed: 41,
    goods: ['#a8452f', '#d9a441', '#f2e6cc', '#4f6b52', '#e6d3ae', '#7a4b2f'],
  })
  shopFront(g, { w: 6.2, z: D / 2 + 0.2, h: 2.2, doorX: 2.1, doorW: 1.0, potX: 2.7, menu: false })
  // 吧台前的高凳
  for (let i = 0; i < 4; i++) {
    cyl(g, 0.16, 0.62, darkSteel, -2.1 + i * 1.25, 0.4, D / 2 - 1.15)
    cyl(g, 0.22, 0.08, std('#c19a5b', { roughness: 0.7 }), -2.1 + i * 1.25, 0.72, D / 2 - 1.15)
  }
  for (const x of [-3.1, -1.1, 1.1, 3.1]) b(0.1, 2.1, 0.14, wood, x, 0.45, D / 2 + 0.19, 0, false)
  b(6.6, 0.24, 0.3, wood, 0, 2.4, D / 2 + 0.28)
  signMesh(g, textSign('拉面 一番', '豚骨 · 味噌', '#8f2f24', '#ffe9b8', 640, 150), 4.6, 0.7, 0, 3.1, D / 2 + 0.2, 0, 0.85)
  // 暖帘：三片布
  for (let i = 0; i < 3; i++) {
    const noren = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.85), new THREE.MeshStandardMaterial({
      color: '#2f4763', roughness: 0.9, side: THREE.DoubleSide,
    }))
    noren.position.set(-0.8 + i * 0.8, 2.0, D / 2 + 0.28)
    g.add(noren)
  }
  // 红灯笼
  for (const x of [-2.4, 2.4]) {
    const lantern = glowLow('#ff5a3c', 0.6, 1.6)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16), lantern)
    m.position.set(x, 2.75, D / 2 + 0.55)
    g.add(m)
    b(0.24, 0.04, 0.24, darkSteel, x, 3.02, D / 2 + 0.55, 0, false)
    b(0.02, 0.34, 0.02, darkSteel, x, 3.22, D / 2 + 0.55, 0, false)
  }
  solid(g.position.x, g.position.z, W, D, GROUND + H + 0.5)
  return g
}

/* ───────────── 横向带窗办公楼：每层一块挑出的楼板 ───────────── */
function ribbonOffice() {
  const W = 12
  const D = 10
  const floors = 9
  const FH = 3.6
  const H = floors * FH
  const g = new THREE.Group()
  g.position.set(15, GROUND, FAR + D / 2)
  g.rotation.y = Math.PI

  const wall = std('#e6e1d7', { roughness: 0.78 })
  const slabMat = std('#f2efe8', { roughness: 0.68 })
  const glass = WIN.warm
  const glassDark = WIN.shade
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  cutFront(g, W, D, 3.6, wall, 3.3, 8.8)
  b(W + 0.2, 0.4, D + 0.2, slabMat, 0, H, 0)
  b(W - 0.6, 2.0, D - 0.6, std('#b9b4aa', { roughness: 0.8 }), 0, H + 0.4, 0)

  const gl = []
  const gd = []
  const mull = []
  const sills = []
  for (let f = 1; f < floors; f++) {
    const y = f * FH
    b(W + 0.5, 0.3, D + 0.5, slabMat, 0, y - 0.3, 0)
    b(W + 0.14, 0.12, D + 0.14, std('#cfc9bd', { roughness: 0.72 }), 0, y - 0.02, 0, 0, false)
    const on = f % 5 !== 0
    const h = 2.2
    const yc = y + h / 2 + 0.35
    const push = (list, x, z, ry, w) => list.push([x, yc, z, ry, w, h, 1])
    push(on ? gl : gd, 0, D / 2 + 0.02, 0, W - 1.0)
    push(on ? gl : gd, 0, -D / 2 - 0.02, Math.PI, W - 1.0)
    push((f % 2) ? gl : gd, W / 2 + 0.02, 0, Math.PI / 2, D - 1.0)
    push((f % 3) ? gl : gd, -W / 2 - 0.02, 0, -Math.PI / 2, D - 1.0)
    for (let i = 0; i <= 8; i++) mull.push([-W / 2 + 0.5 + i * ((W - 1) / 8), yc, D / 2 + 0.08, 0, 0.07, h, 0.1])
    sills.push([0, y + 0.3, D / 2 + 0.16, 0, W - 0.6, 0.08, 0.26])
    // 端部实体墙墩
    for (const sx of [-1, 1]) b(0.7, FH, 0.3, wall, sx * (W / 2 - 0.45), y, D / 2 + 0.1)
  }
  scatter(g, cell, glass, gl)
  scatter(g, cell, glassDark, gd)
  scatter(g, cell, alu, mull, true)
  scatter(g, cell, slabMat, sills)

  // 屋顶广告牌
  const bill = paint(1024, 320, (ctx, w, h) => {
    ctx.fillStyle = '#12303f'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#8fe3ff'
    ctx.font = `800 128px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('光华大厦', w / 2, h * 0.44)
    ctx.fillStyle = '#ffd98a'
    ctx.font = `600 54px ${CN}`
    ctx.fillText('GUANGHUA TOWER', w / 2, h * 0.79)
  })
  b(10.4, 0.2, 0.3, alu, 0, H + 2.6, D / 2 + 2.6)
  signMesh(g, bill, 9.8, 3.0, 0, H + 4.2, D / 2 + 2.62, 0, 0.8)
  for (const sx of [-1, 1]) b(0.18, 4.2, 0.18, alu, sx * 4.6, H + 2.4, D / 2 + 2.7)

  // 底层药房
  const shopGlass = new THREE.MeshStandardMaterial({
    color: '#dff3ea', transparent: true, opacity: 0.28, roughness: 0.08, depthWrite: false,
  })
  plane(g, 8.6, 2.5, shopGlass, 0, 1.7, D / 2 + 0.1)
  for (const x of [-4.3, -1.5, 1.5, 4.3]) b(0.1, 2.6, 0.14, alu, x, 0.35, D / 2 + 0.17, 0, false)
  shopInterior(g, {
    w: 8.6, zFront: D / 2 - 0.12, depth: 3.3, h: 2.9,
    floor: '#dfe6e2', back: '#f1f7f3', island: true, counter: true, seed: 71,
    goods: ['#e15a72', '#f2c14e', '#54b3a6', '#6aa6d8', '#f0f2f4', '#9ac47a'],
  })
  shopFront(g, { w: 8.4, z: D / 2 + 0.2, h: 2.6, doorX: 2.6, doorW: 1.2, potX: 3.6, canopy: 0.86 })
  signMesh(g, textSign('康宁药房', '处方 · 医保', '#f2f7f4', '#1f7a5c', 640, 150), 5.0, 0.66, 0, 3.12, D / 2 + 0.2, 0, 0.7)
  clad(g, D, 3.6, W / 2 + 0.015, 0, 0, Math.PI / 2, 4, 2)
  for (const sx of [-1, 1]) b(0.5, 0.85, 0.5, std('#8a9188', { roughness: 0.85 }), sx * 5.0, 0.02, D / 2 + 1.05, 0, false)
  roofKit(g, W - 0.6, D - 0.6, H + 0.4, { rail: true, caps: '#dcd7cc' })
  downpipe(g, -(W / 2 - 0.3), D / 2 - 0.4, H + 0.3)
  downpipe(g, W / 2 - 0.3, D / 2 - 0.4, H + 0.3)
  solid(g.position.x, g.position.z, W, D, GROUND + H)
  return g
}

/* ───────────── 书店：三层小楼，木门脸 + 竖招 ───────────── */
function bookstore() {
  const W = 9.4
  const D = 8.8
  const floors = 3
  const FH = 3.4
  const H = floors * FH
  const g = new THREE.Group()
  g.position.set(-14.5, GROUND, FAR + D / 2)
  g.rotation.y = Math.PI

  const wall = std('#e3d9c4', { roughness: 0.84 })
  const wood = std('#6f4b31', { roughness: 0.72 })
  const cream = std('#f1e8d6', { roughness: 0.7 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  cutFront(g, W, D, FH, wall, 3.9, 7.6)
  b(W, H - FH, D, wall, 0, FH, 0)
  b(W + 0.24, 0.4, D + 0.24, cream, 0, H, 0)
  b(W + 0.1, 0.14, 0.16, wood, 0, H + 0.4, D / 2)
  for (const sx of [-1, 1]) b(0.16, H, 0.16, wood, sx * (W / 2 - 0.08), 0, D / 2 - 0.08)

  // 二层 / 三层：两扇木框窗
  const lit = glowLow('#ffca92', 0.04, 0.55)
  const dk = WIN.shade
  for (let f = 1; f < floors; f++) {
    const y = f * FH
    for (const x of [-1.9, 1.9]) {
      b(2.2, 1.9, 0.16, cream, x, y + 0.55, D / 2 + 0.06)
      b(1.7, 1.4, 0.06, (f === 1 || x > 0) ? lit : dk, x, y + 0.78, D / 2 + 0.16, 0, false)
      b(0.09, 1.4, 0.12, wood, x, y + 0.78, D / 2 + 0.18, 0, false)
      b(0.09, 1.4, 0.12, wood, x - 0.85, y + 0.78, D / 2 + 0.18, 0, false)
      b(0.09, 1.4, 0.12, wood, x + 0.85, y + 0.78, D / 2 + 0.18, 0, false)
      b(2.3, 0.12, 0.34, wood, x, y + 0.48, D / 2 + 0.18)
    }
    b(W - 0.6, 0.1, 0.14, cream, 0, y - 0.05, D / 2 + 0.04, 0, false)
  }

  // 门脸：木框 + 书堆 + 条纹布篷
  const shop = new THREE.MeshStandardMaterial({
    color: '#ffd8a4', transparent: true, opacity: 0.34, roughness: 0.1, depthWrite: false,
  })
  plane(g, 6.4, 2.2, shop, 0, 1.6, D / 2 + 0.1)
  shopInterior(g, {
    w: 7.4, zFront: D / 2 - 0.14, depth: 3.7, h: FH - 0.22, kind: 'books',
    floor: '#cdbfa6', back: '#efe3c9', side: '#e4d6bb', island: 1, counter: false, seed: 31,
    goods: ['#a63d2f', '#2f5d7c', '#c98c2f', '#3f6b4a', '#7a4e6d', '#ddd3bd'],
  })
  // 木柱只在玻璃分格处，位置避开 shopFront 的门框（x=-0.26 / 1.06）与花池，
  // 也不和布篷、招牌同深度，否则柱面会和它们打架
  for (const x of [-3.45, -1.35, 1.35, 3.45]) b(0.14, 2.36, 0.18, wood, x, 0.34, D / 2 + 0.3, 0, false)

  const stripe = paint(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8e0cd'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#3e6b58'
    for (let i = 0; i < 4; i++) ctx.fillRect(i * 32, 0, 16, h)
  }, { repeat: [4, 1] })
  const awn = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.08, 1.1), new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.86 }))
  awn.position.set(0, 2.88, D / 2 + 0.62)
  awn.rotation.x = -0.16
  g.add(awn)
  b(7.0, 0.24, 0.05, std('#3e6b58', { roughness: 0.86 }), 0, 2.62, D / 2 + 1.15, 0, false)
  for (const sx of [-1, 1]) b(0.04, 0.04, 1.0, pipe, sx * 3.2, 2.7, D / 2 + 0.6, 0, false)

  shopFront(g, { w: 7.2, z: D / 2 + 0.2, h: 2.5, doorX: 0.4, doorW: 1.2, potX: 2.55, menu: false })
  signMesh(g, textSign('旧书 · 新知', 'BOOKS', '#6f4b31', '#f7eeda', 640, 160), 4.4, 0.9, -0.6, 3.5, D / 2 + 0.2, 0, 0.8)
  const bladeMat = new THREE.MeshStandardMaterial({
    map: bladeSign(['书', '店'], '#f7eeda', '#6f4b31'), roughness: 0.6, side: THREE.DoubleSide,
  })
  trackGlow(bladeMat, 0.3, 0.75)
  plane(g, 0.66, 2.3, bladeMat, W / 2 + 0.42, 4.6, D / 2 - 0.7, Math.PI / 2)
  b(0.5, 0.06, 0.06, pipe, W / 2 + 0.2, 5.8, D / 2 - 0.7, 0, false)
  // 门口书箱
  for (const [x, c] of [[-3.6, '#a63d2f'], [-3.05, '#2f5d7c']]) {
    b(0.5, 0.5, 0.5, std(c, { roughness: 0.7 }), x, 0.16, D / 2 + 1.05)
    b(0.46, 0.3, 0.02, std('#efe6d2', { roughness: 0.9 }), x, 0.5, D / 2 + 1.31, 0, false)
  }
  solid(g.position.x, g.position.z, W, D, GROUND + H)
  return g
}

/* ───────────── 自助洗衣店：两层的白瓷砖小铺 ───────────── */
function laundromat() {
  const W = 6.0
  const D = 7.4
  const H = 6.6
  const g = new THREE.Group()
  g.position.set(25, GROUND, FAR + D / 2)
  g.rotation.y = Math.PI

  const wall = std('#e9eef0', { roughness: 0.6 })
  const tile = paint(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c9d3d7'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#b0bcc1'
    ctx.lineWidth = 2
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath()
      ctx.moveTo(i * 16, 0)
      ctx.lineTo(i * 16, h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * 16)
      ctx.lineTo(w, i * 16)
      ctx.stroke()
    }
  }, { repeat: [4, 4] })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)
  cutFront(g, W, D, 2.9, wall, 2.6, 4.9)
  b(W, H - 2.9, D, wall, 0, 2.9, 0)
  // 瓷砖只做门楣与两侧壁柱：原来这一整片 6m 宽的瓷砖板把橱窗和店内全挡住了
  const tileMat = new THREE.MeshStandardMaterial({ map: tile, roughness: 0.5 })
  b(W + 0.12, 0.8, 0.14, tileMat, 0, 2.9, D / 2 + 0.02)
  for (const sx of [-1, 1]) b(0.5, 2.9, 0.14, tileMat, sx * (W / 2 - 0.25), 0, D / 2 + 0.02)
  // 二层开窗，夜里不至于是一整块白板
  for (const x of [-1.5, 1.5]) {
    b(1.5, 1.05, 0.08, std('#9db0bb'), x, 4.05, D / 2 + 0.03)
    b(1.2, 0.8, 0.05, WIN.warm, x, 4.18, D / 2 + 0.08, 0, false)
    b(1.62, 0.09, 0.22, std('#c3ccd2'), x, 5.1, D / 2 + 0.1, 0, false)
  }
  b(W + 0.2, 0.4, D + 0.2, std('#c3ccd2', { roughness: 0.6 }), 0, H, 0)
  b(W - 0.8, 1.2, 0.9, std('#b8c3ca', { metalness: 0.3, roughness: 0.5 }), 0, H + 0.4, -1.2)

  const glass = new THREE.MeshStandardMaterial({
    color: '#e9f8ff', transparent: true, opacity: 0.3, roughness: 0.06, depthWrite: false,
  })
  plane(g, 4.6, 2.3, glass, 0, 1.35, D / 2 + 0.1)
  for (const x of [-2.3, 0, 2.3]) b(0.1, 2.5, 0.14, alu, x, 0.2, D / 2 + 0.17, 0, false)
  b(5.2, 0.24, 0.3, alu, 0, 2.6, D / 2 + 0.26)

  // 洗衣机：圆门 + 机身
  const body = std('#f4f7f8', { roughness: 0.44 })
  const drum = glowLow('#dff4ff', 0.4, 1.0)
  for (let i = 0; i < 4; i++) {
    b(1.0, 1.1, 0.8, body, -2.15 + i * 1.43, 0.16, D / 2 - 0.62)
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 20), drum)
    door.rotation.x = Math.PI / 2
    door.position.set(-2.15 + i * 1.43, 0.72, D / 2 - 0.2)
    g.add(door)
    b(0.85, 0.22, 0.1, std('#c3ccd3', { roughness: 0.4 }), -2.15 + i * 1.43, 1.28, D / 2 - 0.62, 0, false)
  }
  shopInterior(g, {
    w: 4.9, zFront: D / 2 - 0.3, depth: 2.5, h: 2.35,
    floor: '#dfe5e6', back: '#eef4f5', side: '#e6edee', sides: false, display: false, seed: 61,
  })
  // 等位长凳 + 洗涤剂售卖机
  b(2.2, 0.12, 0.5, std('#cfd6d9', { roughness: 0.6 }), 1.5, 0.48, D / 2 - 1.9, 0, false)
  for (const x of [0.5, 2.5]) b(0.1, 0.44, 0.4, std('#b7bfc3', { roughness: 0.6 }), x, 0.24, D / 2 - 1.9, 0, false)
  b(0.7, 1.5, 0.4, std('#dbe3e6', { roughness: 0.5 }), -1.9, 0.16, D / 2 - 0.7)
  b(0.5, 0.9, 0.04, glowLow('#dff4ff', 0.3, 0.9), -1.9, 1.0, D / 2 - 0.49, 0, false)
  shopFront(g, { w: 4.8, z: D / 2 + 0.2, h: 2.2, doorX: 1.9, doorW: 1.0, potX: 2.1, menu: false })
  signMesh(g, textSign('自助洗衣', '24H', '#1f6f9c', '#f2fbff', 512, 200), 3.4, 1.0, 0, 3.4, D / 2 + 0.16, 0, 0.85)
  for (const sx of [-1, 1]) b(0.12, 2.8, 0.12, alu, sx * 2.8, 0, D / 2 + 1.5)
  const awn = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.08, 1.2), std('#1f6f9c', { roughness: 0.8 }))
  awn.position.set(0, 3.05, D / 2 + 0.7)
  g.add(awn)
  solid(g.position.x, g.position.z, W, D, GROUND + H)
  return g
}

/* ───────────── 居酒屋：近侧街角的木造两层小楼 ───────────── */
function izakaya() {
  const W = 6.4
  const D = 6.6
  const H = 6.2
  const g = new THREE.Group()
  g.position.set(25.5, GROUND, 9 - D / 2)

  const wood = std('#5d3f2a', { roughness: 0.78 })
  const plaster = std('#e6dcc4', { roughness: 0.86 })
  const tile = std('#3f4a55', { roughness: 0.6 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  cutFront(g, W, D, 2.7, plaster, 3.0, 5.6)
  b(W, H - 2.7, D, plaster, 0, 2.7, 0)
  b(W + 0.3, 0.26, D + 0.3, wood, 0, H, 0)
  // 二层出檐 + 瓦屋面
  b(W + 0.5, 0.18, 1.5, wood, 0, 3.3, D / 2 + 0.55)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 1.0, 0.26, 1.2), tile)
  roof.position.set(0, H + 0.42, D / 2 + 0.35)
  roof.rotation.x = -0.2
  g.add(roof)
  for (let i = 0; i < 9; i++) b(0.1, 0.06, 1.2, std('#4c5866', { roughness: 0.5 }), -W / 2 + 0.4 + i * 0.7, H + 0.53, D / 2 + 0.35, 0, false)

  // 木格子门脸
  const lit = glowLow('#ffb968', 0.3, 1.2)
  for (let i = 0; i < 5; i++) b(0.5, 2.6, 0.1, wood, -W / 2 + 0.55 + i * 1.3, 0.1, D / 2 + 0.06, 0, false)
  b(W, 0.14, 0.14, wood, 0, 2.66, D / 2 + 0.08, 0, false)
  // 二层木格窗
  for (const x of [-2.3, 2.3]) {
    b(2.1, 1.3, 0.1, wood, x, 3.85, D / 2 + 0.06, 0, false)
    b(1.8, 1.0, 0.05, glowLow('#ffb968', 0.15, 0.7), x, 4.0, D / 2 + 0.13, 0, false)
    for (let i = 0; i < 4; i++) b(0.05, 1.0, 0.07, wood, x - 0.7 + i * 0.47, 4.0, D / 2 + 0.15, 0, false)
  }

  // 暖帘 + 红灯笼 + 菜单牌
  for (let i = 0; i < 3; i++) {
    const noren = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), new THREE.MeshStandardMaterial({
      color: '#8f2f24', roughness: 0.9, side: THREE.DoubleSide,
    }))
    noren.position.set(-0.7 + i * 0.7, 2.25, D / 2 + 0.26)
    g.add(noren)
  }
  for (const x of [-2.5, 2.5]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.44, 14), glowLow('#ff5a3c', 0.7, 1.7))
    m.position.set(x, 2.9, D / 2 + 0.5)
    g.add(m)
    b(0.02, 0.3, 0.02, darkSteel, x, 3.2, D / 2 + 0.5, 0, false)
  }
  shopInterior(g, {
    w: 5.4, zFront: D / 2 - 0.26, depth: 2.8, h: 2.55,
    floor: '#5a4433', back: '#e2d2b4', side: '#dccaa8', counter: true, sides: true, seed: 51,
    goods: ['#a8452f', '#d9a441', '#f2e6cc', '#4f6b52', '#7a4b2f', '#e6d3ae'],
  })
  for (let i = 0; i < 4; i++) {
    cyl(g, 0.15, 0.6, wood, -1.5 + i * 1.0, 0.38, D / 2 - 1.0)
    cyl(g, 0.2, 0.07, std('#c19a5b', { roughness: 0.7 }), -1.5 + i * 1.0, 0.7, D / 2 - 1.0)
  }
  shopFront(g, { w: 5.4, z: D / 2 + 0.2, h: 2.1, doorX: 1.9, doorW: 1.0, potX: 2.4, menu: false })
  signMesh(g, textSign('居酒屋 小满', '烧鸟 · 关东煮', '#2b2018', '#ffd48a', 640, 170), 3.6, 0.68, 0, 2.92, D / 2 + 0.24, 0, 0.9)
  // 侧面竖招
  const bladeMat = new THREE.MeshStandardMaterial({
    map: bladeSign(['小', '满', '酒', '処'], '#2b2018', '#ffd48a'), roughness: 0.55, side: THREE.DoubleSide,
  })
  trackGlow(bladeMat, 0.4, 0.95)
  plane(g, 0.6, 2.2, bladeMat, W / 2 + 0.4, 4.3, D / 2 - 0.9, Math.PI / 2)
  // 门口酒箱与暖炉
  for (let i = 0; i < 3; i++) {
    b(0.44, 0.3, 0.34, std('#c19a5b', { roughness: 0.8 }), -2.6 + i * 0.5, 0.16 + (i === 2 ? 0.3 : 0), D / 2 + 0.85)
  }
  for (let i = 0; i < 2; i++) {
    b(0.4, 0.56, 0.4, std('#a8452f', { roughness: 0.7 }), 2.5 + i * 0.46, 0.16, D / 2 + 0.9)
  }
  solid(g.position.x, g.position.z, W, D, GROUND + H)
  return g
}

/* ───────────── 退台塔：装饰艺术风的阶梯轮廓 ───────────── */
function setbackTower() {
  const g = new THREE.Group()
  g.position.set(-37, GROUND, -21)
  const stone = std('#d8cdb8', { roughness: 0.7 })
  const stoneD = std('#b3a892', { roughness: 0.74 })
  const core = std('#6a6656', { roughness: 0.7 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  const tiers = [
    [18.0, 17.0, 26, 0],
    [14.5, 14.0, 13, 26],
    [11.0, 10.5, 10, 39],
    [7.6, 7.2, 7, 49],
  ]
  for (const [w, d, h, y] of tiers) {
    // 核心筒必须比幕墙小一圈，否则 wallFace 贴的玻璃会埋在结构体里，夜里整栋不亮
    b(w - 0.6, h, d - 0.6, core, 0, y, 0)
    const skin = {
      glass: winBlue, warm: winWarm, shade: winShade, metal: alu, band: bandG,
      lit: 0.62, fin: 0.22, h, y0: y, floors: Math.max(1, Math.round(h / 3.4)),
      punch: 0.88, inset: 0.08,
    }
    const bays = Math.max(3, Math.round(w / 2.4))
    wallFace(g, { ...skin, along: 'x', at: d / 2 - 0.04, w: w - 1.2, bays, sign: 1, seed: 200 + y })
    wallFace(g, { ...skin, along: 'x', at: -(d / 2 - 0.04), w: w - 1.2, bays, sign: -1, seed: 210 + y })
    wallFace(g, { ...skin, along: 'z', at: w / 2 - 0.04, w: d - 1.2, bays, sign: 1, seed: 220 + y })
    wallFace(g, { ...skin, along: 'z', at: -(w / 2 - 0.04), w: d - 1.2, bays, sign: -1, seed: 230 + y })
    b(w + 0.4, 0.44, d + 0.4, stone, 0, y + h, 0)
    // 竖向壁柱
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) b(0.9, h, 0.9, stone, sx * (w / 2 - 0.2), y, sz * (d / 2 - 0.2))
    }
  }
  for (const [w, d, h, y] of tiers) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b(0.22, h - 0.6, 0.22, stone, sx * (w / 2 - 0.55), y + 0.4, sz * (d / 2 - 0.55), 0, false)
      }
    }
    b(w + 0.7, 0.14, d + 0.7, stoneD, 0, y + h + 0.34, 0, 0, false)
  }
  const yTop = 56
  b(5.0, 4.0, 5.0, stoneD, 0, yTop, 0)
  louver(g, 3.6, 1.8, 0, yTop + 1.0, 2.56, 0, 5)
  louver(g, 3.6, 1.8, 0, yTop + 1.0, -2.56, 0, 5)
  b(1.4, 7.0, 1.4, stoneD, 0, yTop + 4, 0)
  cyl(g, 0.22, 8.0, stoneD, 0, yTop + 9, 0)
  const avi = glowLow('#ff4152', 0.2, 1.2)
  b(0.26, 0.26, 0.26, avi, 0, yTop + 13.1, 0)
  solid(g.position.x, g.position.z, 18, 17, GROUND + 26)
  solid(g.position.x, g.position.z, 14.5, 14, GROUND + 39)
  return g
}

/* ───────────── 双塔：两栋细塔 + 空中连廊 ───────────── */
function twinTower() {
  const g = new THREE.Group()
  g.position.set(27, GROUND, -17)
  const stone = std('#cfd5d8', { roughness: 0.64 })
  const core = std('#5b6873', { roughness: 0.62 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  b(25, 7.5, 17, stone, 0, 0, 0)
  b(25.2, 0.8, 17.2, std('#aab3b8', { roughness: 0.66 }), 0, 0, 0)
  const floors = 13
  const FH = 3.3
  const sH = floors * FH
  for (const sx of [-1, 1]) {
    const cx = sx * 7.0
    // 核心筒必须比幕墙内缩 0.6：壁面在 ±4.96 / ±5.46，核心筒做到 11x10
    // 就把每一扇窗都埋进实心体里了（夜里整栋不亮）
    b(11 - 1.2, sH, 10 - 1.2, core, cx, 7.5, 0)
    const skin = {
      glass: winBlue, warm: winWarm, shade: winShade, metal: alu, band: bandG,
      lit: 0.62, fin: 0.26, h: sH, y0: 7.5, floors, punch: 0.9, inset: 0.07,
    }
    wallFace(g, { ...skin, along: 'x', at: 4.96, cx, w: 9.8, bays: 4, sign: 1, seed: 300 + sx })
    wallFace(g, { ...skin, along: 'x', at: -4.96, cx, w: 9.8, bays: 4, sign: -1, seed: 310 + sx })
    wallFace(g, { ...skin, along: 'z', at: cx + sx * 5.46, w: 8.8, bays: 3, sign: sx, seed: 320 + sx })
    // 核心筒内缩后，四个角要补壁柱，否则转角会露出凹进去的结构体
    for (const ex of [-1, 1]) {
      for (const ez of [-1, 1]) b(0.52, sH + 0.24, 0.52, alu, cx + ex * 5.22, 7.5, ez * 4.72)
    }
    b(11.4, 0.4, 10.4, alu, cx, 7.5 + sH, 0)
    b(8.6, 2.4, 7.8, core, cx, 7.5 + sH + 0.4, 0)
    b(8.8, 0.24, 1.4, alu, cx, 7.5 + sH + 1.4, 4.6, 0, false)
    const avi = glowLow('#ff4152', 0.15, 1.1)
    b(0.26, 0.26, 0.26, avi, cx, 7.5 + sH + 3.0, 0)
  }
  // 空中连廊
  const bridgeY = 7.5 + 8 * FH
  b(4.6, 3.0, 4.6, std('#8fa0ad', { metalness: 0.4, roughness: 0.4 }), 0, bridgeY, 0)
  b(4.8, 0.3, 4.8, alu, 0, bridgeY + 3.0, 0)
  for (const sz of [-1, 1]) {
    b(4.2, 1.1, 0.08, glassPane(), 0, bridgeY + 0.9, sz * 2.24, 0, false)
  }
  // 底层：两家店
  signMesh(g, textSign('南山咖啡', 'CAFE', '#2d3a33', '#f0e6cf', 512, 180), 5.4, 1.4, -7.0, 4.4, 8.7, 0, 0.7)
  signMesh(g, textSign('恒生银行', '24H 自助', '#123a63', '#eaf4ff', 512, 180), 5.4, 1.4, 7.0, 4.4, 8.7, 0, 0.7)
  const shopGlass = new THREE.MeshStandardMaterial({
    color: '#f4f0e2', transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false,
  })
  for (const cx of [-7.0, 7.0]) plane(g, 8.0, 3.0, shopGlass, cx, 2.2, 8.62)
  clad(g, 17, 7.5, 12.53, 0, 0, Math.PI / 2, 5, 4)
  for (const cx of [-7.0, 7.0]) {
    for (const dx of [-3.7, -1.25, 1.25, 3.7]) b(0.1, 3.1, 0.14, alu, cx + dx, 0.4, 8.72, 0, false)
    b(8.4, 0.28, 0.5, alu, cx, 4.0, 8.75, 0, false)
    b(8.2, 0.03, 1.4, std('#3a4248', { roughness: 0.9 }), cx, 0.2, 9.2, 0, false)
  }
  // 连廊：斜撑 + 栏杆 + 底部吊顶灯带
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.6, 8), alu)
      rod.position.set(sx * 2.0, bridgeY - 1.9, sz * 2.1)
      rod.rotation.z = sx * 0.5
      g.add(rod)
    }
    b(4.6, 0.06, 0.06, alu, 0, bridgeY + 1.15, sz * 2.28, 0, false)
    for (let i = 0; i < 7; i++) b(0.05, 1.1, 0.05, alu, -2.1 + i * 0.7, bridgeY + 0.6, sz * 2.28, 0, false)
  }
  const strip = glowLow('#ffe6b8', 0.2, 1.1)
  b(4.0, 0.06, 0.12, strip, 0, bridgeY + 2.95, 2.0, 0, false)
  b(4.0, 0.06, 0.12, strip, 0, bridgeY + 2.95, -2.0, 0, false)
  for (const cx of [-7.0, 7.0]) {
    for (const x of [-2.6, 0, 2.6]) b(0.6, 0.9, 0.6, std('#5f7d55', { roughness: 1, flatShading: true }), cx + x, 0.2, 8.5, 0, false)
  }
  roofKit(g, 11.4, 10.4, 7.5 + sH + 0.4, { rail: false })
  solid(g.position.x, g.position.z, 25, 17, GROUND + 7.5 + sH)
  return g
}

/* ───────────── 扭转玻璃塔：逐层旋转的板式塔楼 ───────────── */
function twistTower() {
  const W = 22
  const floors = 40
  const FH = 2.5
  const podH = 7.4
  const g = new THREE.Group()
  g.position.set(-13, GROUND, -48)

  const stone = std('#ccd2d6', { roughness: 0.6 })
  const stoneD = std('#a9b1b7', { roughness: 0.7 })
  const core = std('#46525c', { roughness: 0.55 })
  const mull = std('#e3eaef', { metalness: 0.8, roughness: 0.18 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)
  const rot = (lx, lz, a) => {
    const c = Math.cos(a)
    const sn = Math.sin(a)
    return [lx * c + lz * sn, -lx * sn + lz * c]
  }

  // 场地、台阶、裙楼
  add(g, 38, 0.7, 38, std('#c4c0b6', { roughness: 0.92 }), 0, -0.34, 0, 0, false)
  add(g, 30, 0.18, 30, std('#d6d1c7', { roughness: 0.86 }), 0, 0.09, 0, 0, false)
  const podW = 26
  b(podW, podH, podW, stone, 0, 0, 0)
  b(podW + 0.3, 1.1, podW + 0.3, stoneD, 0, 0, 0)
  b(podW + 0.5, 0.34, podW + 0.5, stoneD, 0, podH - 0.34, 0)
  clad(g, podW, podH, podW / 2 + 0.01, 0, 0, Math.PI / 2, 8, 4)
  clad(g, podW, podH, 0, 0, -podW / 2 - 0.01, 0, 8, 4)
  clad(g, podW, podH, -podW / 2 - 0.01, 0, 0, Math.PI / 2, 8, 4)

  // 大堂玻璃 + 雨棚 + 旋转门
  const lobbyMat = new THREE.MeshStandardMaterial({
    color: '#2c4854', roughness: 0.1, metalness: 0.45, emissive: '#bfe8f2', emissiveIntensity: 0.05,
  })
  trackGlow(lobbyMat, 0.05, 0.3)
  plane(g, 20.0, 4.2, lobbyMat, 0, 2.5, podW / 2 + 0.07)
  b(21.4, 0.16, 3.0, stoneD, 0, 4.8, podW / 2 + 1.1)
  for (const x of [-9.6, -4.0, 4.0, 9.6]) b(0.16, 4.8, 0.16, mull, x, 0.1, podW / 2 + 2.3, 0, false)
  for (const x of [-2.3, 2.3]) {
    const rev = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 3.4, 18, 1, true), mull)
    rev.position.set(x, 1.8, podW / 2 + 0.6)
    g.add(rev)
    b(0.14, 3.4, 2.2, mull, x, 0.1, podW / 2 + 0.6, 0, false)
  }
  for (let i = 0; i < 11; i++) {
    b(0.5, 0.55, 1.5, stoneD, -12.0 + i * 1.3, 0.02, podW / 2 + 1.4, 0, false)
    b(0.6, 1.0, 0.6, std('#5f7d55', { roughness: 1, flatShading: true }), -12.0 + i * 1.3, 0.55, podW / 2 + 1.4, 0, false)
  }
  for (const x of [-15.2, 15.2]) {
    b(2.4, 0.7, 1.6, stoneD, x, 0.02, podW / 2 + 1.0, 0, false)
    b(2.0, 0.55, 1.2, std('#54764a', { roughness: 1, flatShading: true }), x, 0.72, podW / 2 + 1.0, 0, false)
  }

  // 塔身：每层转一点，楼板出挑，玻璃按格分块并贴在幕墙面上
  const slabs = []
  const skins = []
  const spand = []
  const fins = []
  const litWin = []
  const darkWin = []
  const rnd = mulberry32(303)
  for (let f = 0; f < floors; f++) {
    const a = (f * 1.15 * Math.PI) / 180
    const y = podH + f * FH
    const s = 1 - f * 0.0042
    const wf = W * s
    slabs.push([0, y + 0.14, 0, a, wf + 0.8, 0.28, wf + 0.8])
    spand.push([0, y + FH * 0.18, 0, a, wf + 0.05, FH * 0.22, wf + 0.05])
    // 幕墙面：比结构体小一圈，窗格贴在它外侧
    const gw = wf - 0.1
    const yc = y + FH * 0.6
    // 每面切成 3 格，逐格点灯，灯不再是一块飘在外面的板
    const n = 7
    const cw = gw / n
    for (let face = 0; face < 4; face++) {
      for (let i = 0; i < n; i++) {
        const u = -gw / 2 + (i + 0.5) * cw
        const d = gw / 2 - 0.015
        let lx
        let lz
        let ry = 0
        let sx
        let sz
        // 窗格必须横平竖直地贴在幕墙面上：侧面只交换长宽，不能再转 90°，
        // 否则长边会朝外，玻璃像刀片一样戳出楼体
        if (face === 0) { lx = u; lz = d; sx = cw - 0.1; sz = 0.1 }
        else if (face === 1) { lx = -u; lz = -d; sx = cw - 0.1; sz = 0.1 }
        else if (face === 2) { lx = d; lz = u; sx = 0.1; sz = cw - 0.1 }
        else { lx = -d; lz = -u; sx = 0.1; sz = cw - 0.1 }
        const [px, pz] = rot(lx, lz, a)
        // 窗高盖住楼板与窗楣之间的缝，避免从缝里看到楼内空腔
        const item = [px, yc, pz, a + ry, sx, FH * 0.74, sz]
        ;(rnd() > 0.26 ? litWin : darkWin).push(item)
      }
    }
    for (const [lx, lz] of [[wf / 2, wf / 2], [-wf / 2, wf / 2], [wf / 2, -wf / 2], [-wf / 2, -wf / 2]]) {
      const [px, pz] = rot(lx, lz, a)
      fins.push([px, y + FH * 0.5, pz, a, 0.34, FH, 0.34])
    }
  }
  scatter(g, cell, bandG, slabs, true)
  scatter(g, cell, winBlue, darkWin)
  scatter(g, cell, winWarm, litWin)
  scatter(g, cell, bandG, spand)
  scatter(g, cell, mull, fins, true)

  // 塔冠：收分环 + 百叶 + 尖塔
  const topY = podH + floors * FH
  const crown = [[W * 0.94, 2.4], [W * 0.78, 2.0], [W * 0.6, 1.6]]
  let cy = topY
  for (let i = 0; i < crown.length; i++) {
    const [w, h] = crown[i]
    b(w, h, w, i === 0 ? stoneD : stone, 0, cy, 0)
    louver(g, w - 0.6, h * 0.62, 0, cy + h * 0.2, w / 2 + 0.02, 0, 6)
    louver(g, w - 0.6, h * 0.62, 0, cy + h * 0.2, -w / 2 - 0.02, 0, 6)
    louver(g, w - 0.6, h * 0.62, w / 2 + 0.02, cy + h * 0.2, 0, Math.PI / 2, 6)
    louver(g, w - 0.6, h * 0.62, -w / 2 - 0.02, cy + h * 0.2, 0, Math.PI / 2, 6)
    cy += h
  }
  b(2.6, 1.4, 2.6, stoneD, 0, cy, 0)
  cyl(g, 0.62, 6.4, stoneD, 0, cy + 3.6, 0)
  cyl(g, 0.3, 7.0, stoneD, 0, cy + 10.2, 0)
  cyl(g, 0.08, 5.0, mull, 0, cy + 16.2, 0)
  const avi = glowLow('#ff4152', 0.15, 1.4)
  b(0.3, 0.3, 0.3, avi, 0, cy + 18.9, 0)
  for (const sx of [-1, 1]) b(0.12, 3.2, 0.12, mull, sx * 1.0, cy + 1.6, 6, 0, false)

  solid(g.position.x, g.position.z, 38, 38, GROUND + 0.7)
  solid(g.position.x, g.position.z, W + 2, W + 2, GROUND + podH + floors * FH)
  return g
}

/* ───────────── 横向白石带塔：逐级退台 + 屋顶花园 ───────────── */
function bandTower() {
  const g = new THREE.Group()
  g.position.set(31, GROUND, -54)
  const FH = 2.85
  const podH = 5.4
  const tiers = [
    { w: 26, d: 20.5, floors: 17, y: podH },
    { w: 21, d: 16.5, floors: 7, y: podH + 17 * FH },
    { w: 15.5, d: 12.2, floors: 5, y: podH + 24 * FH },
  ]
  const stone = std('#ded8cb', { roughness: 0.72 })
  const stoneD = std('#bdb6a8', { roughness: 0.76 })
  const core = std('#5a6470', { roughness: 0.62 })
  const mull = std('#cfd6db', { metalness: 0.7, roughness: 0.24 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  add(g, 39, 0.7, 33, std('#c6c2b8', { roughness: 0.92 }), 0, -0.34, 0, 0, false)
  const podW = 29
  const podD = 23
  b(podW, podH, podD, stone, 0, 0, 0)
  b(podW + 0.4, 0.9, podD + 0.4, stoneD, 0, 0, 0)
  clad(g, podW, podH, podD / 2 + 0.01, 0, 0, Math.PI / 2, 8, 3)

  const lobbyMat = new THREE.MeshStandardMaterial({
    color: '#2b3f47', roughness: 0.1, metalness: 0.4, emissive: '#ffe3b4', emissiveIntensity: 0.06,
  })
  trackGlow(lobbyMat, 0.05, 0.34)
  plane(g, 18.0, 3.6, lobbyMat, 0, 2.3, podD / 2 + 0.09)
  b(19.4, 0.18, 2.6, stoneD, 0, 4.5, podD / 2 + 1.1)
  for (const x of [-8.6, -3.5, 3.5, 8.6]) b(0.14, 4.5, 0.14, mull, x, 0.1, podD / 2 + 2.15, 0, false)
  // 雨棚下的灯带：一条一条分开，别互相叠在一起闪烁
  for (let i = 0; i < 5; i++) b(1.45, 0.05, 0.1, glowLow('#ffe0ae', 0.1, 0.9), -3.6 + i * 1.8, 4.48, podD / 2 + 0.8, 0, false)

  const win = []
  const litWin = []
  const sills = []
  const bands = []
  const rnd = mulberry32(404)

  for (const t of tiers) {
    b(t.w, t.floors * FH, t.d, core, 0, t.y, 0)
    for (let f = 0; f <= t.floors; f++) {
      const y = t.y + f * FH
      bands.push([0, y + 0.2, 0, 0, t.w + 0.55, 0.4, t.d + 0.55])
    }
    // 四角壁柱
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b(1.0, t.floors * FH, 1.0, stone, sx * (t.w / 2 - 0.25), t.y, sz * (t.d / 2 - 0.25))
      }
    }
    for (let f = 0; f < t.floors; f++) {
      const y = t.y + f * FH + 0.55
      const faces = [
        [0, t.d / 2 + 0.03, 0, t.w],
        [0, -t.d / 2 - 0.03, 0, t.w],
        [t.w / 2 + 0.03, 0, Math.PI / 2, t.d],
        [-t.w / 2 - 0.03, 0, Math.PI / 2, t.d],
      ]
      for (const [fx, fz, ry, len] of faces) {
        const n = Math.max(2, Math.round(len / 2.4))
        for (let i = 0; i < n; i++) {
          const u = -len / 2 + ((i + 0.5) * len) / n
          const px = ry ? fx : u
          const pz = ry ? u : fz
          const on = rnd() > 0.26
          const list = on ? litWin : win
          if (ry) list.push([px, y + 0.78, pz, 0, 0.1, 1.45, 1.1])
          else list.push([px, y + 0.78, pz, 0, 1.1, 1.45, 0.1])
          // 窗台与窗楣（实体，读得出凹进）
          if (ry) sills.push([px + (fx > 0 ? 0.06 : -0.06), y + 0.02, pz, 0, 0.34, 0.14, 1.4])
          else sills.push([px, y + 0.02, pz + (fz > 0 ? 0.06 : -0.06), 0, 1.4, 0.14, 0.34])
        }
      }
    }
    // 女儿墙
    b(t.w + 0.5, 0.5, t.d + 0.5, stoneD, 0, t.y + t.floors * FH, 0)
  }
  scatter(g, cell, winBlue, win)
  scatter(g, cell, winWarm, litWin)
  scatter(g, cell, bandG, bands, true)
  scatter(g, cell, stone, sills)

  const topY = podH + 29 * FH + 0.5
  // 屋顶花园：矮墙、绿植、铺装
  b(15.5, 0.2, 12.2, std('#7f8a6c', { roughness: 1 }), 0, topY, 0, 0, false)
  for (let i = 0; i < 6; i++) {
    cyl(g, 0.36, 0.8, std('#54764a', { roughness: 1, flatShading: true }), -4.2 + i * 1.55, topY + 0.5, 3.4)
  }
  for (let i = 0; i < 5; i++) b(1.5, 0.14, 0.5, std('#d8d2c6', { roughness: 0.8 }), -3.0 + i * 1.5, topY + 0.2, -3.0, 0, false)
  // 电梯机房 + 天线
  b(7.0, 3.4, 5.6, stoneD, 0, topY + 0.2, -0.8)
  louver(g, 6.0, 1.9, 0, topY + 0.6, 2.02, 0, 6)
  louver(g, 6.0, 1.9, 0, topY + 0.6, -3.62, 0, 6)
  roofKit(g, 11, 9, topY + 0.18, { rail: true, caps: '#cfc8ba' })
  cyl(g, 0.14, 9.0, mull, 3.0, topY + 7.0, -3.0)
  cyl(g, 0.07, 4.0, mull, 3.0, topY + 13.0, -3.0)
  const avi = glowLow('#ff4152', 0.15, 1.3)
  b(0.26, 0.26, 0.26, avi, 3.0, topY + 15.2, -3.0)
  for (let i = 0; i < 3; i++) b(1.2, 0.08, 1.2, mull, -4.0 + i * 1.6, topY + 3.4, -0.8, 0, false)

  solid(g.position.x, g.position.z, 39, 33, GROUND + 0.7)
  solid(g.position.x, g.position.z, 26, 20.5, GROUND + 0.7 + 17 * FH)
  solid(g.position.x, g.position.z, 21, 16.5, GROUND + 0.7 + 24 * FH)
  return g
}

function glassPane() {
  return new THREE.MeshStandardMaterial({
    color: '#bcd8e6', transparent: true, opacity: 0.4, roughness: 0.08,
    metalness: 0.4, depthWrite: false,
  })
}

export function buildExtra(parent) {
  parent.add(glassTower())
  parent.add(brickWalkup())
  parent.add(ribbonOffice())
  parent.add(bookstore())
  parent.add(laundromat())
  parent.add(izakaya())
  parent.add(setbackTower())
  parent.add(twinTower())
  parent.add(twistTower())
  parent.add(bandTower())
  // 三个"族"的代表：收分地标塔 / 石材老写字楼 / 围合住宅街坊
  parent.add(podiumTower())
  parent.add(stoneOfficeBlock())
  parent.add(courtyardBlock())
  parent.add(pointBlock())
  parent.add(gallerySlab())
  parent.add(brickWalkupBlock())
}
