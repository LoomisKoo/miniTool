import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import * as Mat from './mat.js'

/**
 * 低多边形程序化车辆：轿车 / SUV / 两厢 / 出租车 / 面包车 / 公交
 * 车身 = 侧轮廓（含轮拱缺口、斜前挡、引擎盖/尾箱收分）挤出 + 倒角；
 * 深色玻璃（前后挡斜面 + 侧窗分块）；轮胎 + 轮毂；保险杠/后视镜/格栅；前后灯形状。
 * 每种车 5 个几何（车漆/玻璃/杂件/前灯/尾灯），由调用方按类型实例化。
 */
const V = (x, y) => new THREE.Vector2(x, y)

function silhouette(L, yb, r, wheels, upper) {
  const pts = [V(-L / 2 + 0.04, yb)]
  for (const cx of wheels) {
    const ra = r + 0.1
    const t0 = Math.asin(Math.max(-0.95, Math.min(0.95, (yb - r) / ra)))
    const N = 10
    for (let i = 0; i <= N; i++) {
      const t = Math.PI - t0 + (2 * t0 - Math.PI) * (i / N)
      pts.push(V(cx + ra * Math.cos(t), r + ra * Math.sin(t)))
    }
  }
  pts.push(V(L / 2 - 0.04, yb))
  for (const [x, y] of upper) pts.push(V(x, y))
  return new THREE.Shape(pts)
}

const prep = (g) => {
  const n = g.index ? g.toNonIndexed() : g
  if (!n.getAttribute('uv')) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.getAttribute('position').count * 2), 2))
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) n.deleteAttribute(k)
  return n
}
function tint(g, hex) {
  const n = prep(g)
  const c = new THREE.Color(hex)
  const cnt = n.getAttribute('position').count
  const a = new Float32Array(cnt * 3)
  for (let i = 0; i < cnt; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b }
  n.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return n
}
function box(sx, sy, sz, x, y, z) {
  const g = new THREE.BoxGeometry(sx, sy, sz)
  g.translate(x, y, z)
  return g
}
/** 斜玻璃板：沿轮廓线段 p1→p2（逆时针方向），向外法线方向略浮出车漆倒角 */
function slab(p1, p2, width, out = 0.065) {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const len = Math.hypot(dx, dy)
  const nx = dy / len
  const ny = -dx / len
  const g = new THREE.BoxGeometry(len * 0.94, 0.02, width)
  g.rotateZ(Math.atan2(dy, dx))
  g.translate((p1[0] + p2[0]) / 2 + nx * out, (p1[1] + p2[1]) / 2 + ny * out, 0)
  return g
}
function sideGlass(poly, W) {
  const sh = new THREE.Shape(poly.map(([x, y]) => V(x, y)))
  const g = new THREE.ExtrudeGeometry(sh, { depth: W + 0.02, bevelEnabled: false, curveSegments: 1 })
  g.translate(0, 0, -(W + 0.02) / 2)
  return g
}

const SPECS = {
  sedan: {
    L: 4.6, W: 1.82, yb: 0.3, r: 0.33, wheels: [-1.42, 1.38],
    upper: [[2.3, 0.42], [2.33, 0.66], [2.05, 0.84], [1.25, 0.93], [0.5, 1.42], [-0.8, 1.43], [-1.4, 0.98], [-2.2, 0.92], [-2.32, 0.72], [-2.3, 0.42]],
    wind: [[1.25, 0.93], [0.5, 1.42]], rear: [[-0.8, 1.43], [-1.4, 0.98]],
    sides: [[[1.06, 0.99], [0.47, 1.36], [0.02, 1.36], [0.02, 0.99]], [[-0.1, 0.99], [-0.1, 1.36], [-0.74, 1.37], [-1.2, 0.99]]],
    head: [2.27, 0.68, 0.62, 0.36, 0.12], tail: [-2.3, 0.8, 0.64, 0.4, 0.12], bump: 0.4, mirror: [1.15, 1.0],
  },
  hatch: {
    L: 4.0, W: 1.76, yb: 0.3, r: 0.32, wheels: [-1.25, 1.25],
    upper: [[2.0, 0.42], [2.03, 0.66], [1.75, 0.84], [1.1, 0.92], [0.4, 1.44], [-1.6, 1.46], [-1.95, 1.2], [-2.02, 0.8], [-2.0, 0.42]],
    wind: [[1.1, 0.92], [0.4, 1.44]], rear: [[-1.6, 1.46], [-1.95, 1.2]],
    sides: [[[0.94, 0.97], [0.38, 1.38], [-0.2, 1.38], [-0.2, 0.97]], [[-0.32, 0.97], [-0.32, 1.38], [-1.5, 1.4], [-1.75, 0.99]]],
    head: [1.97, 0.68, 0.6, 0.34, 0.12], tail: [-2.0, 0.98, 0.64, 0.14, 0.3], bump: 0.4, mirror: [1.0, 1.0],
  },
  suv: {
    L: 4.8, W: 1.95, yb: 0.38, r: 0.4, wheels: [-1.5, 1.5],
    upper: [[2.4, 0.5], [2.42, 0.85], [2.1, 1.02], [1.35, 1.08], [0.75, 1.75], [-2.1, 1.78], [-2.35, 1.5], [-2.4, 0.95], [-2.4, 0.5]],
    wind: [[1.35, 1.08], [0.75, 1.75]], rear: [[-2.1, 1.78], [-2.35, 1.5]],
    sides: [[[1.2, 1.13], [0.7, 1.68], [0.12, 1.68], [0.12, 1.13]], [[0.0, 1.13], [0.0, 1.68], [-1.0, 1.68], [-1.0, 1.13]], [[-1.12, 1.13], [-1.12, 1.68], [-2.04, 1.7], [-2.2, 1.13]]],
    head: [2.38, 0.9, 0.68, 0.38, 0.13], tail: [-2.4, 1.15, 0.72, 0.16, 0.3], bump: 0.52, mirror: [1.25, 1.15], rails: true,
  },
  van: {
    L: 5.2, W: 2.0, yb: 0.36, r: 0.37, wheels: [-1.75, 1.65],
    upper: [[2.6, 0.5], [2.62, 0.95], [2.3, 1.2], [1.35, 2.2], [1.2, 2.3], [-2.5, 2.3], [-2.6, 2.2], [-2.6, 0.5]],
    wind: [[2.3, 1.2], [1.35, 2.2]], rear: null,
    sides: [[[2.03, 1.35], [1.3, 2.1], [0.75, 2.1], [0.75, 1.35]]],
    head: [2.58, 0.92, 0.72, 0.36, 0.14], tail: [-2.62, 1.05, 0.86, 0.18, 0.36], bump: 0.46, mirror: [2.0, 1.3],
  },
  bus: {
    L: 11.5, W: 2.5, yb: 0.4, r: 0.5, wheels: [-3.6, 3.4],
    upper: [[5.75, 0.5], [5.78, 2.8], [5.6, 3.05], [-5.6, 3.05], [-5.75, 2.85], [-5.75, 0.5]],
    wind: [[5.78, 1.05], [5.78, 2.75]], rear: [[-5.75, 2.75], [-5.75, 2.0]],
    sides: [[[5.2, 1.55], [5.2, 2.75], [-5.4, 2.75], [-5.4, 1.55]], [[4.95, 0.65], [4.95, 1.48], [4.1, 1.48], [4.1, 0.65]]],
    head: [5.77, 0.78, 1.0, 0.36, 0.16], tail: [-5.76, 0.95, 1.05, 0.2, 0.32], bump: 0.5, mirror: [5.6, 2.3],
  },
}
SPECS.taxi = { ...SPECS.sedan, sign: true }

function buildType(s) {
  const { L, W } = s
  const body = new THREE.ExtrudeGeometry(silhouette(L, s.yb, s.r, s.wheels, s.upper), {
    depth: W - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 4,
  })
  body.translate(0, 0, -(W - 0.1) / 2)
  body.computeVertexNormals()
  const glassParts = [slab(s.wind[0], s.wind[1], W - 0.3)]
  if (s.rear) glassParts.push(slab(s.rear[0], s.rear[1], W - 0.34))
  for (const p of s.sides) glassParts.push(sideGlass(p, W))
  const parts = []
  for (const cx of s.wheels) {
    for (const sz of [-1, 1]) {
      const tw = s.r > 0.45 ? 0.32 : 0.26
      const tire = new THREE.CylinderGeometry(s.r, s.r, tw, 16)
      tire.rotateX(Math.PI / 2)
      tire.translate(cx, s.r, sz * (W / 2 - 0.16))
      parts.push(tint(tire, '#18191b'))
      const rim = new THREE.CylinderGeometry(s.r * 0.6, s.r * 0.6, tw + 0.02, 10)
      rim.rotateX(Math.PI / 2)
      rim.translate(cx, s.r, sz * (W / 2 - 0.16))
      parts.push(tint(rim, '#b9bdc3'))
    }
  }
  const fx = s.upper[0][0]
  const rx = s.upper[s.upper.length - 1][0]
  parts.push(tint(box(0.16, 0.2, W - 0.06, fx + 0.04, s.bump, 0), '#24262a'))
  parts.push(tint(box(0.16, 0.2, W - 0.06, rx - 0.04, s.bump, 0), '#24262a'))
  parts.push(tint(box(0.04, 0.14, W * 0.38, fx + 0.06, s.head[1] - 0.12, 0), '#141516'))
  parts.push(tint(box(0.03, 0.11, 0.42, rx - 0.07, s.bump + 0.16, 0), '#e8e6de'))
  for (const sz of [-1, 1]) parts.push(tint(box(0.12, 0.1, 0.16, s.mirror[0], s.mirror[1], sz * (W / 2 + 0.07)), '#202226'))
  if (s.rails) for (const sz of [-1, 1]) parts.push(tint(box(2.4, 0.05, 0.05, -0.6, 1.83, sz * 0.72), '#2a2c30'))
  if (s.sign) parts.push(tint(box(0.32, 0.2, 0.7, -0.15, 1.53, 0), '#f6f0d0'))
  const lamp = (a, back) => {
    const [x, y, z, w, h] = a
    return mergeGeometries([-1, 1].map((sz) => prep(box(0.08, h, back ? Math.min(w, 0.4) : w * 0.5, x + (back ? -0.01 : 0.01), y, sz * z))))
  }
  return {
    L, W, H: Math.max(...s.upper.map((p) => p[1])), headY: s.head[1], headZ: s.head[2], tailY: s.tail[1],
    paint: prep(body),
    glass: mergeGeometries(glassParts.map(prep)),
    parts: mergeGeometries(parts),
    head: lamp(s.head, false),
    tail: lamp(s.tail, true),
  }
}

let kit = null
export function buildCarKit() {
  if (kit) return kit
  const paint = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.36, metalness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.12, emissive: '#ffffff', emissiveIntensity: 0 })
  const glass = new THREE.MeshStandardMaterial({ color: '#16202a', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.2 })
  const parts = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.65, metalness: 0.3 })
  const head = new THREE.MeshStandardMaterial({ color: '#e8e4da', emissive: '#fff1d6', emissiveIntensity: 0, roughness: 0.25 })
  const tail = new THREE.MeshStandardMaterial({ color: '#6a1a1a', emissive: '#ff3a32', emissiveIntensity: 0, roughness: 0.3 })
  for (const m of [paint, glass, parts, head, tail]) Mat.registerMaterial(m)
  Mat.registerNight(paint, 0, 0.03)
  Mat.registerNight(head, 0.05, 1.5)
  Mat.registerNight(tail, 0.1, 1.2)
  const types = {}
  for (const k in SPECS) types[k] = buildType(SPECS[k])
  kit = {
    types,
    mats: { paint, glass, parts, head, tail },
    colors: {
      default: ['#c8ccd2', '#2a3038', '#8a1a18', '#1a3a6a', '#e8e8e6', '#5b6066', '#3a5a40', '#b8a888', '#14161a', '#a0a6ae', '#6a2a4a', '#d8d0c0'],
      taxi: ['#f2c230'],
      bus: ['#2f8a4a', '#2a5fa8', '#c8382c', '#e8e4da'],
      van: ['#e8e8e6', '#c8ccd2', '#2a3038', '#d8d0c0', '#3a5f8a'],
    },
  }
  return kit
}

export const PART_KEYS = ['paint', 'glass', 'parts', 'head', 'tail']
