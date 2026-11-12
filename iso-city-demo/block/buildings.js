import * as THREE from 'three'
import { buildKonbini } from './store.js'
import { buildExtra } from './extra.js'
import {
  GROUND, CN, add, plane, cyl, std, glowMat, trackGlow, trackLight, paint, scatter, mulberry32, solid,
  trackEnv, winGlass, winWarm, winShade, shopInterior, cutFront, shopFront,
} from './kit.js'

const ROW = 9

function groupAt(x, frontZ, depth) {
  const g = new THREE.Group()
  g.position.set(x, GROUND, frontZ - depth / 2)
  return g
}

const cell = new THREE.BoxGeometry(1, 1, 1)
const winGreen = winGlass
const alum = trackEnv(std('#dde4ea', { metalness: 0.52, roughness: 0.32 }), 0.62, 0.24)
const alumGreen = trackEnv(std('#dfe5e6', { metalness: 0.5, roughness: 0.34 }), 0.6, 0.24)
const bandSilver = trackEnv(std('#9aa6b0', { metalness: 0.4, roughness: 0.42 }), 0.8, 0.24)
const bandGreen = trackEnv(std('#9ba7a6', { metalness: 0.34, roughness: 0.46 }), 0.75, 0.22)

/**
 * 一片真幕墙：玻璃退进铝框，每块玻璃再做中梃、横档、窗台、上下窗楣。
 * 全部走 InstancedMesh 批次，细节翻几倍但 draw call 不增加。
 */
export function wallFace(parent, opt) {
  const {
    along, at, cx = 0, cz = 0, y0, w, h, floors, bays,
    sign = 1, lit = 0.4, seed = 1, fin = 0.28,
    glass, warm, shade, metal, band,
    // punch：窗洞占开间的宽度比。>=0.85 当幕墙（玻璃带满），否则是"墙上开洞"
    // inset：窗玻璃退进墙面的深度。石墙开洞要 0.15~0.2m 才有阴影，
    //        幕墙只要 5~8cm
    punch = 0.62, inset = 0.18,
  } = opt
  const FH = h / floors
  const bay = w / bays
  const curtain = punch > 0.85
  const winH = curtain ? 0.76 : 0.56
  const bandH = FH * (curtain ? 0.28 : 0.32)
  const glassH = FH * winH
  const gw = bay * punch
  const rnd = mulberry32(seed)
  const dark = []
  const glow = []
  const blind = []
  const fins = []
  const bands = []
  const mulls = []
  const trans = []
  const sills = []
  const reveals = []
  const xAlong = along === 'x'
  const mid = (xAlong ? cx : cz) - w / 2

  const put = (list, u, y, depth, su, sy, sd) => {
    if (xAlong) list.push([u, y, at + sign * depth, 0, su, sy, sd])
    else list.push([at + sign * depth, y, u, 0, sd, sy, su])
  }

  for (let f = 0; f < floors; f++) {
    const base = y0 + f * FH
    for (let i = 0; i < bays; i++) {
      const u = mid + bay * (i + 0.5)
      // 开洞式窗略高于层中：下面留给窗台墙，上面留给过梁，比例才像真楼
      const gy = base + FH * (curtain ? bandH + winH / 2 - 0.04 : 0.54)
      const roll = rnd()
      const list = roll < lit ? glow : roll < lit + 0.16 ? blind : dark
      put(list, u, gy, -inset, gw, glassH, 0.08)

      // 竖中梃 + 一道横档：玻璃被切成四格，不再是一整片色块
      put(mulls, u, gy, -inset + 0.008, 0.04, glassH, 0.05)
      put(trans, u, gy + glassH * 0.1, -inset + 0.008, gw, 0.04, 0.05)
      // 窗洞四周：两侧窗洞侧壁 + 窗台 + 过梁，都退到墙面内侧，
      // 阳面只留一圈窄边，阴影才会自己长出来
      put(reveals, u - gw / 2 - 0.022, gy, -inset / 2 - 0.006, 0.045, glassH + 0.02, inset - 0.012)
      put(reveals, u + gw / 2 + 0.022, gy, -inset / 2 - 0.006, 0.045, glassH + 0.02, inset - 0.012)
      put(reveals, u, gy + glassH / 2 + 0.022, -inset / 2 - 0.006, gw + 0.09, 0.045, inset - 0.012)
      // 窗台板稍微挑出墙面 3cm，下面自然有一道投影
      put(sills, u, gy - glassH / 2 - 0.035, -inset / 2 + 0.03, gw + 0.16, 0.07, inset + 0.06)
    }
    // 每层一道横带：开洞式窗把它压在窗台以下，幕墙式就做成层间梁
    const bandY = curtain ? base + bandH * 0.5 : base + FH * 0.12
    const bandT = curtain ? bandH * 0.9 : FH * 0.24
    put(bands, xAlong ? cx : cz, bandY, 0.02, w, bandT, 0.07)
    put(bands, xAlong ? cx : cz, bandY + bandT * 0.52, 0.055, w, 0.05, 0.14)
  }
  for (let i = 0; i <= bays; i++) {
    const u = mid + bay * i
    const mz = at + sign * fin * 0.42
    if (xAlong) fins.push([u, y0 + h / 2, mz, 0, 0.08, h, fin])
    else fins.push([mz, y0 + h / 2, u, 0, fin, h, 0.08])
    // 竖梃根的底座
    if (xAlong) fins.push([u, y0 + 0.06, at + sign * 0.14, 0, 0.16, 0.12, fin + 0.2])
    else fins.push([at + sign * 0.14, y0 + 0.06, u, 0, fin + 0.2, 0.12, 0.16])
  }
  scatter(parent, cell, glass, dark)
  scatter(parent, cell, warm, glow)
  scatter(parent, cell, shade, blind)
  scatter(parent, cell, metal, fins, true)
  scatter(parent, cell, band, bands)
  scatter(parent, cell, metal, mulls)
  scatter(parent, cell, metal, trans)
  scatter(parent, cell, band, sills, true)
  scatter(parent, cell, band, reveals)
}


const jointMat = std('#a9a294', { roughness: 0.86 })
const louverMat = std('#9fabb6', { metalness: 0.5, roughness: 0.42 })

/** 石材分缝：横竖细凹槽，墙裙才有拼板感 */
export function clad(parent, w, h, x, y0, z, ry, cols, rows) {
  const items = []
  const d = 0.05
  // 竖缝要沿墙长方向铺开：原来 c 根本没参与位置计算，cols-1 条缝全叠在同一点，
  // 每个裙楼都只剩一条缝，还白白多画几层共面片
  for (let c = 1; c < cols; c++) {
    const u = -w / 2 + (c / cols) * w
    items.push([x + u, y0 + h / 2, z, ry, 0.035, h - 0.2, d])
  }
  for (let r = 1; r < rows; r++) items.push([x, y0 + (h * r) / rows, z, ry, w - 0.2, 0.035, d])
  // 沿 ry 把局部坐标转到世界，长边跟着换向
  if (ry) {
    const c = Math.cos(ry)
    const sn = Math.sin(ry)
    const swap = Math.abs(sn) > 0.5
    for (const it of items) {
      const dx = it[0] - x
      const dz = it[2] - z
      it[0] = x + dx * c + dz * sn
      it[2] = z - dx * sn + dz * c
      if (swap) {
        const t = it[4]
        it[4] = it[6]
        it[6] = t
      }
      it[3] = it[3]
    }
  }
  scatter(parent, cell, jointMat, items)
}

/** 屋顶：女儿墙压顶 + 栏杆 + 设备基座，远看不再是一块平顶 */
export function roofKit(g, w, d, y, opt = {}) {
  const { rail = true, caps = '#e7e2d8' } = opt
  const cap = std(caps, { roughness: 0.66 })
  add(g, w + 0.2, 0.12, 0.26, cap, 0, y + 0.06, d / 2, 0, false)
  add(g, w + 0.2, 0.12, 0.26, cap, 0, y + 0.06, -d / 2, 0, false)
  add(g, 0.26, 0.12, d + 0.2, cap, w / 2, y + 0.06, 0, 0, false)
  add(g, 0.26, 0.12, d + 0.2, cap, -w / 2, y + 0.06, 0, 0, false)
  if (!rail) return
  const rm = std('#b9c2cb', { metalness: 0.55, roughness: 0.36 })
  const bars = []
  const posts = []
  const sides = [
    [0, d / 2 - 0.2, w, 0],
    [0, -d / 2 + 0.2, w, 0],
    [w / 2 - 0.2, 0, 0, d],
    [-w / 2 + 0.2, 0, 0, d],
  ]
  for (const [px, pz, sx, sz] of sides) {
    const len = sx || sz
    const n = Math.max(2, Math.round(len / 1.5))
    if (sx) bars.push([px, y + 0.52, pz, 0, sx, 0.05, 0.06])
    else bars.push([px, y + 0.52, pz, 0, 0.06, 0.05, sz])
    for (let i = 0; i <= n; i++) {
      const t = (i / n - 0.5) * len
      posts.push([px + (sx ? t : 0), y + 0.26, pz + (sz ? t : 0), 0, 0.05, 0.52, 0.05])
    }
  }
  scatter(g, cell, rm, bars)
  scatter(g, cell, rm, posts)
}

/** 塔顶百叶：一片片斜板，机房与塔冠才有机械感 */
export function louver(g, w, h, x, y, z, ry, n = 6) {
  const items = []
  for (let i = 0; i < n; i++) items.push([x, y + (i * h) / n + h / (n * 2), z, ry, w, (h / n) * 0.62, 0.1])
  scatter(g, cell, louverMat, items, true)
}

const pipeMat = std('#8d97a2', { metalness: 0.4, roughness: 0.45 })
const ventMat = std('#c8d0d9', { roughness: 0.46, metalness: 0.3 })

/** 落水管：竖管 + 几道抱箍，把墙和地面接起来 */
export function downpipe(g, x, z, h, base = 0) {
  cyl(g, 0.055, h, pipeMat, x, base + h / 2, z)
  for (let y = 1.3; y < h - 0.2; y += 2.1) add(g, 0.1, 0.05, 0.2, pipeMat, x, base + y, z, 0, false)
}

/** 布篷：斜下的篷布 + 前沿垂边 + 两根斜撑 */
export function awning(g, w, y, z, color, depth = 1.0) {
  const cloth = std(color, { roughness: 0.8 })
  add(g, w, 0.06, depth, cloth, 0, y, z + depth / 2).rotation.x = -0.13
  add(g, w, 0.26, 0.04, cloth, 0, y - 0.16, z + depth, 0, false)
  for (const sx of [-1, 1]) {
    add(g, 0.03, 0.03, depth * 0.95, pipeMat, sx * (w / 2 - 0.22), y - 0.26, z + depth * 0.55, 0, false)
      .rotation.x = 0.55
  }
}

function shophouse() {
  const W = 12.4
  const D = 8.2
  const H = 13.2
  const arcade = 1.75
  const g = groupAt(-3.6, ROW, D)
  const wall = std('#f4ecdf', { roughness: 0.78 })
  const tile = std('#1e6b5e', { roughness: 0.55 })
  const frame = std('#245e52', { roughness: 0.5 })
  const wood = std('#7a4e32', { roughness: 0.7 })
  const darkGlass = winShade
  const litGlass = winWarm

  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)
  cutFront(g, W, D, 4, wall, arcade + 2.9, W - 1.9)
  b(W, H - 4, D, wall, 0, 4, 0)
  b(W + 0.15, 0.22, D + 0.15, std('#e4d8c4'), 0, H, 0)
  b(W + 0.05, 0.7, 0.12, wall, 0, H + 0.22, D / 2)
  b(W + 0.05, 0.7, 0.12, wall, 0, H + 0.22, -D / 2)
  b(0.12, 0.7, D, wall, W / 2, H + 0.22, 0)
  b(0.12, 0.7, D, wall, -W / 2, H + 0.22, 0)

  const front = D / 2
  for (let i = 0; i < 5; i++) {
    const x = -W / 2 + 0.7 + i * ((W - 1.4) / 4)
    b(0.36, 3.85, 0.36, wall, x, 0, front - 0.28)
    b(0.42, 0.7, 0.42, tile, x, 0, front - 0.28)
  }
  b(W, 0.32, arcade + 0.1, std('#efe4d2'), 0, 3.7, front - arcade / 2)
  clad(g, W, 3.6, 0, 0, front + 0.03, 0, 6, 2)
  clad(g, D, 3.6, W / 2 + 0.03, 0, 0, Math.PI / 2, 4, 2)
  b(W - 0.2, 0.06, arcade - 0.15, std('#d9cbb6'), 0, 0.02, front - arcade / 2 + 0.05)

  const shopSign = paint(640, 160, (ctx, w, h) => {
    ctx.fillStyle = '#f6f1e6'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#1e6b5e'
    ctx.fillRect(0, 0, w, 12)
    ctx.fillRect(0, h - 12, w, 12)
    ctx.font = `800 72px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('冰室', w * 0.32, h / 2 + 2)
    ctx.font = `600 28px ${CN}`
    ctx.fillText('茶点 · 糖水', w * 0.7, h / 2 + 4)
  })
  const signMat = trackGlow(new THREE.MeshStandardMaterial({
    map: shopSign, emissiveMap: shopSign, emissive: '#ffffff', roughness: 0.55,
  }), 0.12, 0.9)
  plane(g, 5.4, 0.7, signMat, -1.2, 3.15, front - arcade + 0.06)

  const shopGlass = new THREE.MeshStandardMaterial({
    color: '#fff1d8', transparent: true, opacity: 0.35, roughness: 0.08, depthWrite: false,
  })
  plane(g, W - 1.8, 2.35, shopGlass, 0, 1.45, front - arcade + 0.045)
  b(1.15, 2.35, 0.08, wood, 3.6, 0.15, front - arcade + 0.18)
  shopFront(g, { w: W - 2.0, z: front - arcade + 0.26, h: 2.35, doorX: 3.6, doorW: 1.0, potX: 4.9, menu: false })
  // 冰室里座：圆桌、卡座、飞碟吊灯、水吧台
  shopInterior(g, {
    w: W - 2.2, zFront: front - arcade - 0.06, depth: 3.5, h: 2.75,
    floor: '#d9cfb8', back: '#f1e9d6', side: '#e6d9bf', counter: true, sides: true, seed: 81,
    goods: ['#c2543f', '#e8d8b6', '#3f6b4a', '#c9a227', '#8f6b46', '#f0e6d0'],
  })
  const booth = std('#3f6b52', { roughness: 0.82 })
  const tableM = std('#e9dcc2', { roughness: 0.6 })
  for (const x of [-3.4, -0.6, 2.6]) {
    cyl(g, 0.52, 0.06, tableM, x, 0.92, front - arcade - 1.5)
    cyl(g, 0.06, 0.72, std('#8a8f92', { metalness: 0.4, roughness: 0.4 }), x, 0.55, front - arcade - 1.5)
    for (const s of [-1, 1]) {
      add(g, 0.9, 0.42, 0.5, booth, x, 0.42, front - arcade - 1.5 + s * 0.95, 0, false)
      add(g, 0.9, 0.5, 0.14, booth, x, 0.86, front - arcade - 1.5 + s * 1.18, 0, false)
    }
  }
  const pendant = glowMat('#ffcf8a', 0.3, 1.3, { emissive: '#ffb968', roughness: 0.5 })
  for (const x of [-3.4, -0.6, 2.6]) {
    cyl(g, 0.02, 0.7, std('#7b8085', { metalness: 0.5, roughness: 0.4 }), x, 2.4, front - arcade - 1.5)
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 14, 1, true), std('#c2543f', { roughness: 0.6, side: THREE.DoubleSide }))
    shade.position.set(x, 2.0, front - arcade - 1.5)
    shade.rotation.x = Math.PI
    g.add(shade)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), pendant)
    bulb.position.set(x, 1.94, front - arcade - 1.5)
    g.add(bulb)
  }

  let n = 0
  const opening = (x, y, z, w, h, ry) => {
    const o = new THREE.Group()
    o.position.set(x, y, z)
    o.rotation.y = ry
    g.add(o)
    const lit = ((n += 1) * 3) % 5 !== 0
    add(o, w + 0.12, 0.07, 0.1, frame, 0, h / 2, 0, 0, false)
    add(o, w + 0.12, 0.07, 0.1, frame, 0, -h / 2, 0, 0, false)
    add(o, 0.07, h, 0.1, frame, -w / 2, 0, 0, 0, false)
    add(o, 0.07, h, 0.1, frame, w / 2, 0, 0, 0, false)
    add(o, 0.04, h - 0.1, 0.06, frame, 0, 0, 0.02, 0, false)
    plane(o, w - 0.1, h - 0.12, lit ? litGlass : darkGlass, 0, 0, 0.045)
  }
  for (let f = 0; f < 3; f++) {
    const y = 4 + f * 3.05 + 1.45
    for (const x of [-3.8, 0, 3.8]) opening(x, y, front + 0.06, 1.35, 1.7, 0)
    opening(W / 2 + 0.06, y, 1.2, 1.15, 1.55, Math.PI / 2)
    opening(W / 2 + 0.06, y, -1.6, 1.15, 1.55, Math.PI / 2)
  }
  b(1.5, 0.16, 0.42, tile, 0, 6.95, front + 0.22)
  b(0.7, 0.48, 0.42, std('#c9cdd2'), 4.6, H + 0.2, -0.4)
  const blade = paint(120, 440, (ctx, w, h) => {
    ctx.fillStyle = '#1e6b5e'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#f6f1e6'
    ctx.lineWidth = 5
    ctx.strokeRect(9, 9, w - 18, h - 18)
    ctx.fillStyle = '#ffd98a'
    ctx.font = `800 82px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ;['冰', '室', '糖', '水'].forEach((c, i) => ctx.fillText(c, w / 2, 72 + i * 100))
  })
  const bladeMat = new THREE.MeshStandardMaterial({
    map: blade, emissiveMap: blade, emissive: '#ffffff', roughness: 0.5, side: THREE.DoubleSide,
  })
  trackGlow(bladeMat, 0.5, 0.85)
  plane(g, 0.62, 2.0, bladeMat, W / 2 - 0.33, 5.4, front + 0.46, Math.PI / 2)
  b(0.34, 0.06, 0.06, pipeMat, W / 2 - 0.5, 6.35, front + 0.24, 0, false)

  awning(g, 4.6, 2.6, front - arcade + 0.02, '#c2543f', 1.0)
  b(2.6, 0.14, 0.6, std('#ddd2bd', { roughness: 0.9 }), 3.0, 0, front - arcade + 0.32)
  downpipe(g, -W / 2 + 0.3, front - 0.32, H + 0.5)
  downpipe(g, W / 2 - 0.3, -front + 0.32, H + 0.5)
  for (const [z, y] of [[-1.4, 5.2], [1.9, 8.3]]) {
    b(0.72, 0.52, 0.44, ventMat, W / 2 + 0.26, y, z, 0)
    b(0.5, 0.06, 0.36, std('#9aa4b0', { roughness: 0.5 }), W / 2 + 0.26, y + 0.54, z, 0, false)
  }
  for (const y of [6.4, 9.4]) {
    b(5.4, 0.04, 0.04, pipeMat, -1.2, y, front + 0.5, 0, false)
    for (let i = 0; i < 5; i++) {
      b(0.5, 0.6, 0.02, std(['#f4f1e8', '#cfe0ea', '#e8c9c2', '#c9d8c2', '#e6dfcc'][i], { roughness: 0.88 }),
        -3.1 + i * 0.95, y - 0.7, front + 0.52, 0, false)
    }
  }
  const frontZ = g.position.z + D / 2
  solid(g.position.x, g.position.z - arcade / 2, W, D - arcade, GROUND + H + 0.4)
  solid(g.position.x, frontZ - arcade / 2, W, arcade, GROUND + H + 0.4, GROUND + 4)
  return g
}

function slab() {
  const W = 16
  const D = 11.4
  const FH = 3
  const floors = 12
  const H = FH * floors
  const g = groupAt(13.2, ROW, D)

  const stucco = paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d8c7ae'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 2600; i++) {
      const v = 186 + ((i * 29) % 30)
      ctx.fillStyle = `rgba(${v},${v - 10},${v - 26},0.28)`
      ctx.fillRect((i * 53) % w, (i * 97) % h, 2, 2)
    }
    ctx.fillStyle = 'rgba(150,128,104,.14)'
    ctx.fillRect(0, h - 20, w, 20)
  }, { repeat: [3, 3] })
  const wall = std('#ffffff', { map: stucco, roughness: 0.86 })
  const band = std('#efe6d8', { roughness: 0.72 })
  const white = std('#f7f4ee', { roughness: 0.7 })
  const rail = std('#ccd4dd', { roughness: 0.3, metalness: 0.6 })
  const frameM = std('#828b95', { roughness: 0.34, metalness: 0.55 })
  const glassLit = winWarm
  const glassDark = winShade
  const curtain = std('#e6e1d4', { roughness: 0.94 })
  const acMat = std('#d3d9e0', { roughness: 0.5, metalness: 0.2 })

  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)
  b(W, H, D, wall, 0, 0, 0)
  b(W, 0.85, D + 0.16, std('#b3a896', { map: stucco, roughness: 0.9 }), 0, 0, 0)
  b(W + 0.3, 0.7, 0.14, white, 0, H, D / 2)
  b(W + 0.3, 0.7, 0.14, white, 0, H, -D / 2)
  b(0.14, 0.7, D + 0.2, white, W / 2, H, 0)
  b(0.14, 0.7, D + 0.2, white, -W / 2, H, 0)
  b(W + 0.42, 0.1, 0.26, band, 0, H + 0.7, D / 2)
  b(W + 0.42, 0.1, 0.26, band, 0, H + 0.7, -D / 2)
  b(0.26, 0.1, D + 0.42, band, W / 2, H + 0.7, 0)
  b(0.26, 0.1, D + 0.42, band, -W / 2, H + 0.7, 0)
  b(4.4, 2.5, 3.4, std('#ddd4c8'), -3.2, H, -0.6)
  cyl(g, 0.7, 1.5, std('#c5cdd4', { metalness: 0.3, roughness: 0.45 }), 3.4, H + 0.75, 1.2)
  cyl(g, 0.55, 1.2, std('#c5cdd4', { metalness: 0.3, roughness: 0.45 }), 4.8, H + 0.6, 0.2)

  // 每层的楼板腰线 + 竖向壁柱：墙面被切成格子，才不像一整块色板
  for (let f = 1; f < floors; f++) {
    const y = f * FH
    b(W + 0.1, 0.12, 0.08, band, 0, y, D / 2 + 0.03)
    b(0.08, 0.12, D + 0.1, band, W / 2 + 0.03, y, 0)
    b(0.08, 0.12, D + 0.1, band, -W / 2 - 0.03, y, 0)
  }
  for (const x of [-7.4, -3.1, 3.1, 7.4]) b(0.26, H - 2.6, 0.12, band, x, 2.6, D / 2 + 0.03)
  for (const z of [-4.4, 0, 4.4]) {
    b(0.12, H - 2.6, 0.26, band, W / 2 + 0.03, 2.6, z)
    b(0.12, H - 2.6, 0.26, band, -W / 2 - 0.03, 2.6, z)
  }

  const winPlane = new THREE.PlaneGeometry(1, 1)
  const cell = new THREE.BoxGeometry(1, 1, 1)
  const gl = []
  const gd = []
  const cn = []
  const fv = []
  const fh = []
  const sills = []
  const acs = []
  const hoods = []
  const rbars = []

  // 一扇窗 = 玻璃（退进）+ 窗帘 + 四周窗框（凸出）+ 中梃 + 窗台 + 上挑檐
  const bay = (px, pz, nx, nz, w, h, yc, on, seed) => {
    const ry = Math.atan2(nx, nz)
    const rx = Math.cos(ry)
    const rz = -Math.sin(ry)
    const put = (list, u, v, sx, sy, sz, y = yc) => {
      list.push([px + rx * u + nx * v, y, pz + rz * u + nz * v, ry, sx, sy, sz])
    }
    ;(on ? gl : gd).push([px + nx * 0.015, yc, pz + nz * 0.015, ry, w, h, 1])
    if (seed % 3 === 0) put(cn, -w * 0.24, -0.07, w * 0.5, h - 0.06, 1)
    else if (seed % 5 === 0) put(cn, w * 0.26, -0.07, w * 0.46, h - 0.06, 1)
    put(fv, -w / 2, 0.11, 0.09, h + 0.2, 0.16)
    put(fv, w / 2, 0.11, 0.09, h + 0.2, 0.16)
    put(fh, 0, 0.11, w + 0.2, 0.09, 0.16, yc + h / 2)
    put(fh, 0, 0.11, w + 0.2, 0.09, 0.16, yc - h / 2)
    put(fv, 0, 0.06, 0.05, h - 0.08, 0.09)
    put(fh, 0, 0.06, w - 0.08, 0.05, 0.09, yc + h * 0.16)
    put(sills, 0, 0.23, w + 0.4, 0.1, 0.32, yc - h / 2 - 0.07)
    put(hoods, 0, 0.17, w + 0.34, 0.07, 0.24, yc + h / 2 + 0.1)
    return { put, ry, rx, rz }
  }

  const colsFront = [-6.1, -3.65, -1.2, 1.2, 3.65, 6.1]
  for (let f = 0; f < floors; f++) {
    const yc = f * FH + 1.7
    colsFront.forEach((x, i) => {
      if (f === 0 && Math.abs(x) < 6) return
      const ac = f > 0 && (f + i) % 4 === 0 && Math.abs(x) > 3
      const h = f === 0 ? 1.5 : 1.42
      bay(x, D / 2, 0, 1, 1.25, h, yc, (f + i) % 5 !== 0, f * 7 + i)
      if (ac) acs.push([x, yc - 1.02, D / 2 + 0.44, 0, 0.66, 0.46, 0.42])
    })
    for (const face of [1, -1]) {
      for (let i = 0; i < 3; i++) {
        const z = -3.4 + i * 3.4
        const on = (f * 2 + i + face) % 4 !== 0
        bay(face * (W / 2), z, face, 0, 1.15, 1.3, yc, on, f * 5 + i + (face > 0 ? 0 : 3))
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = -5.6 + i * 2.8
      bay(x, -D / 2, 0, -1, 1.1, 1.25, yc, (f + i) % 3 !== 0, f * 3 + i)
    }
  }

  // 阳台：厚板 + 两侧翻边 + 竖栏杆 + 扶手
  for (let f = 1; f < floors; f++) {
    const y = f * FH
    b(W - 1.5, 0.2, 1.24, white, 0, y, D / 2 + 0.62)
    b(W - 1.5, 0.05, 1.3, std('#cfc6b6', { roughness: 0.8 }), 0, y - 0.05, D / 2 + 0.62, 0, false)
    for (const sx of [-1, 1]) {
      b(0.09, 0.98, 1.24, rail, sx * (W - 1.55) / 2, y + 0.2, D / 2 + 0.62)
    }
    b(W - 1.42, 0.07, 0.08, rail, 0, y + 1.16, D / 2 + 1.2)
    b(W - 1.42, 0.04, 0.05, rail, 0, y + 0.26, D / 2 + 1.2, 0, false)
    for (let i = 0; i <= 46; i++) {
      rbars.push([-(W - 1.7) / 2 + i * ((W - 1.7) / 46), y + 0.7, D / 2 + 1.18, 0, 0.035, 0.9, 0.035])
    }
    if (f % 3 === 1) {
      const dy = y + 0.2
      b(2.6, 0.04, 0.04, rail, -1.0, dy + 1.62, D / 2 + 0.8, 0, false)
      for (const x of [-2.1, -1.2, -0.3]) {
        b(0.04, 0.55, 0.04, rail, x, dy + 1.35, D / 2 + 0.8, 0, false)
      }
      b(0.9, 0.62, 0.03, std('#dfe7ee', { roughness: 0.9 }), -1.55, dy + 1.04, D / 2 + 0.8, 0, false)
      b(0.62, 0.5, 0.03, std('#e7d2c6', { roughness: 0.9 }), -0.62, dy + 1.1, D / 2 + 0.8, 0, false)
    }
  }

  scatter(g, winPlane, glassLit, gl)
  scatter(g, winPlane, glassDark, gd)
  scatter(g, winPlane, curtain, cn)
  scatter(g, cell, frameM, fv, true)
  scatter(g, cell, frameM, fh, true)
  scatter(g, cell, band, sills, true)
  scatter(g, cell, acMat, acs, true)
  scatter(g, cell, white, hoods, true)
  scatter(g, cell, rail, rbars, true)

  const lobby = new THREE.MeshStandardMaterial({
    color: '#d5e6ea', transparent: true, opacity: 0.45, roughness: 0.08, metalness: 0.2, depthWrite: false,
  })
  plane(g, 3.4, 2.35, lobby, 0, 1.45, D / 2 + 0.08)
  b(4.2, 0.08, 1.3, std('#c8d0d6', { metalness: 0.6, roughness: 0.3 }), 0, 2.75, D / 2 + 0.55)
  const name = paint(384, 96, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#5c5146'
    ctx.font = `700 40px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('翠园 · 3栋', w / 2, h / 2)
  })
  plane(g, 2.4, 0.48, new THREE.MeshStandardMaterial({ map: name, transparent: true, roughness: 0.6 }), 0, 2.45, D / 2 + 0.1)
  const shopCols = ['#3f6f8a', '#b4553c']
  for (let i = 0; i < 2; i++) {
    const x = i ? 5.2 : -5.2
    awning(g, 3.6, 3.15, D / 2 + 0.06, shopCols[i], 0.95)
    b(2.5, 0.5, 0.12, std('#eef2f5', { roughness: 0.6 }), x, 3.36, D / 2 + 0.1, 0, false)
    b(2.3, 0.3, 0.06, std(shopCols[i], { roughness: 0.5 }), x, 3.46, D / 2 + 0.17, 0, false)
  }
  // 两间底商的门脸：退进去的玻璃 + 竖梃 + 卷帘盒
  for (let i = 0; i < 2; i++) {
    const x = i ? 5.2 : -5.2
    const shopGlass = new THREE.MeshStandardMaterial({
      color: '#f6e6c8', transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false,
    })
    plane(g, 3.1, 1.95, shopGlass, x, 1.55, D / 2 + 0.02)
    b(3.3, 2.2, 0.1, std('#2b3a44', { roughness: 0.34, metalness: 0.35 }), x, 0.35, D / 2 - 0.06, 0, false)
    for (const dx of [-1.6, -0.55, 0.55, 1.6]) b(0.07, 2.2, 0.12, frameM, x + dx, 0.4, D / 2 + 0.13, 0, false)
    b(3.3, 0.1, 0.16, frameM, x, 2.6, D / 2 + 0.16, 0, false)
    b(3.4, 0.34, 0.24, std('#9aa5ad', { roughness: 0.45, metalness: 0.4 }), x, 2.36, D / 2 + 0.26, 0, false)
    b(3.2, 0.02, 0.06, std('#2b3a44', { roughness: 0.4 }), x, 2.54, D / 2 + 0.38, 0, false)
    b(1.0, 2.05, 0.07, std('#3d4b52', { roughness: 0.4 }), x + 1.05, 0.4, D / 2 + 0.11, 0, false)
  }
  b(4.0, 0.16, 1.8, std('#dcd3c4', { roughness: 0.85 }), 0, 0, D / 2 + 0.85)
  b(4.4, 0.08, 1.9, std('#b9c1c9', { metalness: 0.5, roughness: 0.35 }), 0, 2.72, D / 2 + 0.8, 0, false)
  for (const sx of [-1.9, 1.9]) b(0.1, 2.7, 0.1, pipeMat, sx, 0, D / 2 + 1.6)
  for (let i = 0; i < 5; i++) {
    b(0.3, 0.36, 0.24, std('#a9b3bd', { roughness: 0.42, metalness: 0.4 }), -3.0 + i * 0.36, 0.5, D / 2 + 0.34, 0, false)
  }
  downpipe(g, W / 2 - 0.32, D / 2 - 0.4, H + 0.4)
  downpipe(g, -W / 2 + 0.32, D / 2 - 0.4, H + 0.4)
  for (const x of [-2, 1.5, 4]) {
    cyl(g, 0.09, 1.0, ventMat, x, H + 0.5, -2.4)
    cyl(g, 0.18, 0.08, ventMat, x, H + 1.02, -2.4)
  }
  solid(g.position.x, g.position.z, W, D, GROUND + H)
  solid(g.position.x - 3.2, g.position.z - 0.6, 4.4, 3.4, GROUND + H + 2.5, GROUND + H)
  return g
}

function office() {
  const podW = 18
  const podD = 15
  const podH = 8
  const sW = 16.5
  const sD = 13
  const floors = 14
  const FH = 3.7
  const sH = floors * FH
  const g = new THREE.Group()
  g.position.set(-17.2, GROUND, -4 - podD / 2)

  const stone = std('#d4cdc2', { roughness: 0.78 })
  const stoneDark = std('#b7b1a6', { roughness: 0.8 })
  const core = std('#6a7878', { roughness: 0.7 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  b(podW, podH, podD, stone, 0, 0, 0)
  b(podW + 0.08, 1.15, podD + 0.08, stoneDark, 0, 0, 0)
  b(sW - 0.5, sH, sD - 0.5, core, 0, podH, 0)
  const officeSkin = {
    glass: winGreen, warm: winWarm, shade: winShade, metal: alumGreen, band: bandGreen,
    lit: 0.58, fin: 0.46, h: sH, y0: podH, floors, punch: 0.56, inset: 0.2,
  }
  wallFace(g, { ...officeSkin, along: 'x', at: sD / 2 - 0.04, w: sW - 1.4, bays: 7, sign: 1, seed: 4 })
  wallFace(g, { ...officeSkin, along: 'x', at: -(sD / 2 - 0.04), w: sW - 1.4, bays: 7, sign: -1, seed: 9 })
  wallFace(g, { ...officeSkin, along: 'z', at: sW / 2 - 0.04, w: sD - 1.3, bays: 5, sign: 1, seed: 11 })
  wallFace(g, { ...officeSkin, along: 'z', at: -(sW / 2 - 0.04), w: sD - 1.3, bays: 5, sign: -1, seed: 15 })

  b(9, 3.4, 6.5, std('#9aa6aa', { metalness: 0.25, roughness: 0.55 }), 0, podH + sH, -0.4)
  b(podW * 0.55, 0.1, 2.2, alumGreen, 0, 3.4, podD / 2 + 0.7)
  const lobby = new THREE.MeshStandardMaterial({
    color: '#17343a', roughness: 0.08, metalness: 0.55,
    emissive: '#9fd8c8', emissiveIntensity: 0.05,
  })
  trackGlow(lobby, 0.04, 0.26)
  plane(g, 8.5, 4.6, lobby, 0, 2.6, podD / 2 + 0.13)
  const L = new THREE.PointLight('#d5fff0', 0.2, 14, 2)
  L.position.set(0, 3.2, podD / 2 - 1)
  g.add(L)
  trackLight(L, 2, 18)
  for (const sx of [-1, 1]) {
    cyl(g, 0.09, 3.35, alumGreen, sx * 3.3, 1.68, podD / 2 + 1.35)
    b(0.5, 0.12, 0.5, stoneDark, sx * 3.3, 0, podD / 2 + 1.35, 0, false)
  }
  for (const sx of [-1, 1]) {
    b(3.6, 0.55, 2.2, std('#8a9188', { roughness: 0.9 }), sx * 6.4, 0, podD / 2 + 1.2)
    b(3.2, 0.44, 1.9, std('#54764a', { roughness: 1, flatShading: true }), sx * 6.4, 0.52, podD / 2 + 1.2, 0, false)
    b(3.4, 0.06, 2.0, std('#6d736c', { roughness: 0.9 }), sx * 6.4, 0.5, podD / 2 + 1.2, 0, false)
  }
  b(5.4, 0.04, 1.6, std('#3c4854', { roughness: 0.9 }), 0, 0.17, podD / 2 + 0.9, 0, false)
  clad(g, podW, podH, 0, 0, podD / 2 + 0.05, 0, 7, 4)
  clad(g, sD, podH, podW / 2 + 0.05, 0, 0, Math.PI / 2, 5, 4)
  clad(g, podW - 3.4, 2.4, 0, podH - 2.4, podD / 2 + 0.07, 0, 5, 1)
  b(podW - 3.4, 0.16, 0.2, stoneDark, 0, podH - 0.12, podD / 2 + 0.16, 0, false)
  // 入口雨棚的铝合金格栅
  for (let i = 0; i < 9; i++) b(0.1, 0.16, 2.1, alumGreen, -4.0 + i * 1.0, 3.42, podD / 2 + 0.75, 0, false)
  louver(g, 8.5, 2.4, 0, podH + sH + 3.45, 3.0, 0, 7)
  roofKit(g, 9, 6.5, podH + sH + 3.4, { rail: false })
  for (const sx of [-1, 1]) b(0.5, 0.9, 0.5, ventMat, sx * 5.2, 0.04, podD / 2 + 1.0, 0, false)
  downpipe(g, -podW / 2 + 0.35, podD / 2 - 0.42, podH + 0.4)
  downpipe(g, podW / 2 - 0.35, podD / 2 - 0.42, podH + 0.4)
  for (const [x, z] of [[-3.6, 2.0], [2.8, -2.4]]) {
    b(2.2, 0.9, 1.6, ventMat, x, podH + sH + 3.4, z)
    for (let i = 0; i < 3; i++) b(1.9, 0.06, 0.1, std('#9aa4b0', { roughness: 0.5 }), x, podH + sH + 3.6 + i * 0.22, z + 0.82, 0, false)
  }
  solid(g.position.x, g.position.z, podW, podD, GROUND + podH)
  solid(g.position.x, g.position.z, sW, sD, GROUND + podH + sH)
  solid(g.position.x, g.position.z - 0.4, 9, 6.5, GROUND + podH + sH + 3.4, GROUND + podH + sH)
  return g
}

function tower() {
  const podW = 20.5
  const podD = 17
  const podH = 7
  const sW = 16.5
  const shaftF = 18
  const FH = 3.45
  const sH = shaftF * FH
  const uW = 13.5
  const uH = 3 * FH
  const nH = 8.2
  const g = new THREE.Group()
  g.position.set(2.0, GROUND, -5.2 - podD / 2)

  const stone = std('#ddd6cb', { roughness: 0.76 })
  const stoneDark = std('#b9b3a8', { roughness: 0.82 })
  const metal = std('#d5dee6', { roughness: 0.28, metalness: 0.74 })
  const core = std('#8b98a3', { roughness: 0.62 })
  const trough = glowMat('#c5ced6', 0.02, 1.0, { emissive: '#ffe3b0', metalness: 0.4, roughness: 0.32 })
  const b = (w, h, d, mat, x, y, z) => add(g, w, h, d, mat, x, y + h / 2, z)

  b(podW, podH, podD, stone, 0, 0, 0)
  b(podW + 0.1, 1.2, podD + 0.1, stoneDark, 0, 0, 0)
  b(sW - 0.7, sH, sW - 0.7, core, 0, podH, 0)
  const towerSkin = {
    glass: winGlass, warm: winWarm, shade: winShade, metal: alum, band: bandSilver,
    lit: 0.62, fin: 0.32, h: sH, y0: podH, floors: shaftF, punch: 0.72, inset: 0.14,
  }
  const skin = sW / 2 - 0.02
  const clear = sW - 2.2
  wallFace(g, { ...towerSkin, along: 'x', at: skin, w: clear, bays: 6, sign: 1, seed: 21 })
  wallFace(g, { ...towerSkin, along: 'x', at: -skin, w: clear, bays: 6, sign: -1, seed: 28 })
  wallFace(g, { ...towerSkin, along: 'z', at: skin, w: clear, bays: 6, sign: 1, seed: 33 })
  wallFace(g, { ...towerSkin, along: 'z', at: -skin, w: clear, bays: 6, sign: -1, seed: 41 })

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      b(1.15, sH + 0.4, 1.15, metal, sx * (sW / 2 - 0.12), podH - 0.1, sz * (sW / 2 - 0.12))
    }
  }

  const y1 = podH + sH
  b(uW - 0.55, uH, uW - 0.55, core, 0, y1, 0)
  const crownSkin = { ...towerSkin, h: uH, y0: y1, floors: 3, fin: 0.26, lit: 0.52 }
  const skinU = uW / 2 - 0.02
  const clearU = uW - 1.4
  wallFace(g, { ...crownSkin, along: 'x', at: skinU, w: clearU, bays: 5, sign: 1, seed: 70 })
  wallFace(g, { ...crownSkin, along: 'x', at: -skinU, w: clearU, bays: 5, sign: -1, seed: 74 })
  wallFace(g, { ...crownSkin, along: 'z', at: skinU, w: clearU, bays: 5, sign: 1, seed: 78 })
  wallFace(g, { ...crownSkin, along: 'z', at: -skinU, w: clearU, bays: 5, sign: -1, seed: 82 })

  const y2 = y1 + uH
  const gap = 3.6
  const pW = (uW - gap) / 2
  b(pW - 0.2, nH, uW * 0.78, core, -(gap / 2 + pW / 2), y2, 0)
  b(pW - 0.2, nH, uW * 0.78, core, gap / 2 + pW / 2, y2, 0)
  const pierZ = uW * 0.4
  // 冠部两片墙的芯体只比墙面小 1cm 级，窗不能退太深，否则会埋进芯体
  const pierSkin = { ...towerSkin, h: nH, y0: y2, floors: 2, fin: 0.18, lit: 0.66, inset: 0.06, punch: 0.7 }
  for (const sx of [1, -1]) {
    const px = sx * (gap / 2 + pW / 2)
    wallFace(g, { ...pierSkin, along: 'x', at: pierZ, cx: px, w: pW - 0.45, bays: 2, sign: 1, seed: 90 + sx })
    wallFace(g, { ...pierSkin, along: 'x', at: -pierZ, cx: px, w: pW - 0.45, bays: 2, sign: -1, seed: 94 + sx })
    wallFace(g, { ...pierSkin, along: 'z', at: px + sx * (pW / 2 - 0.04), w: pierZ * 1.7, bays: 2, sign: sx, seed: 98 + sx })
    b(0.1, nH, 0.1, trough, sx * (gap / 2 + 0.08), y2, pierZ)
    b(0.1, nH, 0.1, trough, sx * (gap / 2 + 0.08), y2, -pierZ)
  }
  b(gap - 0.4, 0.16, uW * 0.62, trough, 0, y2 + 3.4, 0)

  const y3 = y2 + nH
  b(7.2, 5.5, 7.2, core, 0, y3, 0)
  b(4.8, 3.2, 4.8, metal, 0, y3 + 5.5, 0)
  b(7.5, 0.28, 0.22, trough, 0, y3 + 5.2, 3.55)
  b(7.5, 0.28, 0.22, trough, 0, y3 + 5.2, -3.55)
  b(0.22, 0.28, 7.5, trough, 3.55, y3 + 5.2, 0)
  b(0.22, 0.28, 7.5, trough, -3.55, y3 + 5.2, 0)
  b(0.28, 11, 0.28, metal, 0, y3 + 8.6, 0)
  b(1.1, 0.16, 1.1, trough, 0, y3 + 8.7, 0)
  louver(g, 6.6, 2.2, 0, y3 + 5.6, 3.62, 0, 7)
  louver(g, 6.6, 2.2, 0, y3 + 5.6, -3.62, 0, 7)
  louver(g, 6.6, 2.2, 3.62, y3 + 5.6, 0, Math.PI / 2, 7)
  louver(g, 6.6, 2.2, -3.62, y3 + 5.6, 0, Math.PI / 2, 7)
  roofKit(g, 7.2, 7.2, y3 + 5.5, { rail: true, caps: '#c6cdd4' })

  const lobby = new THREE.MeshStandardMaterial({
    color: '#1a2c38', roughness: 0.08, metalness: 0.5, emissive: '#cfe4f2', emissiveIntensity: 0.04,
  })
  trackGlow(lobby, 0.04, 0.4)
  plane(g, 8, 4.4, lobby, 0, 2.5, podD / 2 + 0.04)
  b(9.2, 0.1, 2.4, metal, 0, 4.5, podD / 2 + 0.85)
  // 裙楼石材分缝 + 入口格栅 + 竖招
  clad(g, podW, podH, 0, 0, podD / 2 + 0.05, 0, 8, 4)
  clad(g, podW, podH, sW / 2 + 0.05, 0, 0, Math.PI / 2, 8, 4)
  for (let i = 0; i < 11; i++) b(0.1, 0.14, 2.3, metal, -5.0 + i * 1.0, 4.58, podD / 2 + 0.95, 0, false)
  const towerSign = paint(420, 560, (ctx, w, h) => {
    ctx.fillStyle = '#101c26'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#8fe3ff'
    ctx.font = `800 150px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('云', w / 2, 150)
    ctx.fillStyle = '#f2f7fa'
    ctx.font = `700 44px ${CN}`
    ctx.fillText('中心', w / 2, 288)
    ctx.fillStyle = 'rgba(143,227,255,.4)'
    ctx.fillRect(60, 350, w - 120, 3)
    ctx.fillStyle = '#8fe3ff'
    ctx.font = `600 22px ${CN}`
    ctx.fillText('SKY CENTER', w / 2, 410)
  })
  const tsMat = new THREE.MeshStandardMaterial({
    map: towerSign, emissiveMap: towerSign, emissive: '#ffffff', roughness: 0.44,
  })
  trackGlow(tsMat, 0.32, 0.8)
  plane(g, 1.8, 2.4, tsMat, podW / 2 + 0.06, 3.2, podD / 2 - 2.4, Math.PI / 2)
  for (const sx of [-1, 1]) b(0.4, 1.2, 0.4, stone, sx * 5.4, 0.04, podD / 2 + 1.2, 0, false)
  for (const sx of [-1, 1]) cyl(g, 0.1, 4.35, metal, sx * 4.1, 2.18, podD / 2 + 1.05)
  b(6.6, 0.04, 2.0, std('#39424e', { roughness: 0.9 }), 0, 0.17, podD / 2 + 1.0, 0, false)
  const ad = paint(360, 520, (ctx, w, h) => {
    ctx.fillStyle = '#12212e'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#8fe3ff'
    ctx.font = `800 96px ${CN}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('云', w / 2, 148)
    ctx.fillStyle = '#ffd98a'
    ctx.font = `700 46px ${CN}`
    ctx.fillText('天际中心', w / 2, 300)
    ctx.fillStyle = 'rgba(143,227,255,.45)'
    ctx.fillRect(40, 380, w - 80, 4)
    ctx.fillStyle = '#8fe3ff'
    ctx.font = `600 24px ${CN}`
    ctx.fillText('SKY CENTER', w / 2, 440)
  })
  const adMat = new THREE.MeshStandardMaterial({
    map: ad, emissiveMap: ad, emissive: '#ffffff', roughness: 0.42,
  })
  trackGlow(adMat, 0.35, 0.8)
  plane(g, 1.9, 2.75, adMat, podW / 2 + 0.06, 3.7, 1.9, Math.PI / 2)
  downpipe(g, -podW / 2 + 0.35, podD / 2 - 0.42, podH + 0.4)
  downpipe(g, podW / 2 - 0.35, podD / 2 - 0.42, podH + 0.4)
  const avi = glowMat('#3a1012', 0.15, 1.3, { emissive: '#ff3b4e', roughness: 0.4 })
  b(0.24, 0.24, 0.24, avi, 0, y3 + 19.4, 0)
  for (const x of [-6.5, -3.2, 3.2, 6.5]) {
    cyl(g, 0.1, 0.75, std('#8f99a4', { metalness: 0.5, roughness: 0.4 }), x, 0.38, podD / 2 + 2.1)
    b(0.24, 0.06, 0.24, std('#c8d0d8', { metalness: 0.4, roughness: 0.45 }), x, 0.75, podD / 2 + 2.1, 0, false)
  }

  const L = new THREE.PointLight('#ffe6c2', 0, 40, 2)
  L.position.set(0, y3 + 8, 0)
  g.add(L)
  trackLight(L, 0, 36)
  solid(g.position.x, g.position.z, podW, podD, GROUND + podH)
  solid(g.position.x, g.position.z, sW, sW, GROUND + podH + sH + uH + nH + 5.5)
  return g
}

export function buildBuildings(parent) {
  buildKonbini(parent)
  parent.add(shophouse())
  parent.add(slab())
  parent.add(office())
  parent.add(tower())
  buildExtra(parent)
}
