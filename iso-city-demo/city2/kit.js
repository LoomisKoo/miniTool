// 几何拼装：所有静态物写进一个顶点色网格，按材质桶合并。
import * as THREE from 'three'

const _c = new THREE.Color()
const _hsl = { h: 0, s: 0, l: 0 }
const _graded = new Map()

/**
 * cozy cyberpunk 调色：浅中性略暖、深中性偏靛蓝（夜景暗底），
 * 冷灰保留蓝相，绿色往青绿偏。发光件不走这里。
 */
function gradeColor(color) {
  let v = _graded.get(color)
  if (v) return v
  _c.set(color).getHSL(_hsl)
  let { h, s, l } = _hsl
  if (s < 0.14) {
    // 冷灰保留蓝相；暖砖 / 米色保留色相 —— 一律压冷灰会变成工业镇
    if (h > 0.45 && h < 0.85) s = Math.min(1, s * 1.25)
    else if (l < 0.35 && s < 0.08) {
      h = 0.62
      s = 0.06 + s * 0.4
    } else {
      s = Math.min(1, s * 1.12)
    }
  } else if (h > 0.02 && h < 0.17 && s < 0.45) {
    s = Math.min(1, s * 1.15)
  } else if (h > 0.18 && h < 0.42) {
    h += (0.45 - h) * 0.3
    s = Math.min(1, s * 1.1)
  } else {
    s = Math.min(1, s * 1.08)
  }
  _c.setHSL(h, s, l)
  v = [_c.r, _c.g, _c.b]
  _graded.set(color, v)
  return v
}

/** 快速包围球：只扫一遍顶点算 AABB，用外接角距当半径。比 computeBoundingSphere 快一倍多 */
export function fastSphere(g) {
  const p = g.attributes.position.array
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2]
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
    if (z < z0) z0 = z
    if (z > z1) z1 = z
  }
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const cz = (z0 + z1) / 2
  const r = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), r)
  return g.boundingSphere
}

/**
 * 定长缓冲：MeshBuilder 的顶点流。用 Float32Array + 倍增，避免几十万次 Array.push
 * （内存翻倍增长、GC 抖动），建几何时可以直接交给 BufferAttribute 不再整体转换一遍。
 */
class F32 {
  constructor(cap = 8192) {
    this.a = new Float32Array(cap)
    this.n = 0
  }
  _grow(k) {
    const b = new Float32Array(Math.max(this.a.length * 2, this.n + k))
    b.set(this.a)
    this.a = b
  }
  push9(x0, x1, x2, x3, x4, x5, x6, x7, x8) {
    if (this.n + 9 > this.a.length) this._grow(9)
    const a = this.a
    let i = this.n
    a[i] = x0
    a[i + 1] = x1
    a[i + 2] = x2
    a[i + 3] = x3
    a[i + 4] = x4
    a[i + 5] = x5
    a[i + 6] = x6
    a[i + 7] = x7
    a[i + 8] = x8
    this.n = i + 9
  }
  append(o) {
    if (this.n + o.n > this.a.length) this._grow(o.n)
    this.a.set(o.a.subarray(0, o.n), this.n)
    this.n += o.n
  }
  get length() {
    return this.n
  }
  /** 只取有效区间，给 BufferAttribute 用 */
  get buf() {
    return this.n === this.a.length ? this.a : this.a.slice(0, this.n)
  }
}

/** 顶点色网格构建器：直接写三角形，不建中间几何，几千个盒子也不成为瓶颈。 */
export class MeshBuilder {
  /** @param outline 描边外扩量（米）。>0 时每个体块同时生成一层放大壳，用 BackSide 渲染就是描边。 */
  constructor(outline = 0, o = {}) {
    this.pos = new F32()
    this.nor = new F32()
    this.col = new F32()
    this.outline = outline
    this.grade = o.grade ?? true
    this.inHull = false
    if (outline > 0) {
      this.hp = new F32()
      this.hn = new F32()
      this.hc = new F32()
    }
  }

  get count() {
    return this.pos.length / 3
  }

  /** 把之后的写入临时改到描边壳缓冲里，跑完 fn 再切回来。 */
  _hull(fn) {
    if (this.outline <= 0 || this.inHull) return
    const p = this.pos
    const n = this.nor
    const c = this.col
    this.pos = this.hp
    this.nor = this.hn
    this.col = this.hc
    this.inHull = true
    fn()
    this.inHull = false
    this.pos = p
    this.nor = n
    this.col = c
  }

  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color, nx, ny, nz) {
    let r, g, b
    if (this.grade) [r, g, b] = gradeColor(color)
    else ({ r, g, b } = _c.set(color))
    this.pos.push9(ax, ay, az, bx, by, bz, cx, cy, cz)
    this.nor.push9(nx, ny, nz, nx, ny, nz, nx, ny, nz)
    this.col.push9(r, g, b, r, g, b, r, g, b)
  }

  /** 任意四边形，自动保证法线朝外（与 expected 同向）。 */
  quad(a, b, c, d, color, ex, ey, ez) {
    const ux = b[0] - a[0]
    const uy = b[1] - a[1]
    const uz = b[2] - a[2]
    const vx = c[0] - a[0]
    const vy = c[1] - a[1]
    const vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len
    ny /= len
    nz /= len
    if (ex !== undefined && nx * ex + ny * ey + nz * ez < 0) {
      const t = b
      b = d
      d = t
      nx = -nx
      ny = -ny
      nz = -nz
    }
    this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], color, nx, ny, nz)
    this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], color, nx, ny, nz)
  }

  box(w, h, d, color, x, y, z, ry = 0, o = {}) {
    const g = this.outline
    // 小于 0.85m 的构件不描边：远处看不见那圈线，近处那圈线还会把栏杆、五金糊成一根粗棒
    if (!this.inHull && g > 0 && Math.max(w, h, d) >= 0.85)
      this._hull(() => this.box(w + g * 2, h + g * 2, d + g * 2, color, x, y, z, ry, { skipBottom: true, skipTop: true, skip: o.skip }))
    const hw = w / 2
    const hh = h / 2
    const hd = d / 2
    const s = Math.sin(ry)
    const c = Math.cos(ry)
    const P = (px, py, pz) => [x + px * c + pz * s, y + py, z - px * s + pz * c]
    const A = P(-hw, -hh, -hd)
    const B = P(hw, -hh, -hd)
    const C = P(hw, -hh, hd)
    const D = P(-hw, -hh, hd)
    const E = P(-hw, hh, -hd)
    const F = P(hw, hh, -hd)
    const G = P(hw, hh, hd)
    const H = P(-hw, hh, hd)
    const nx = c
    const nz = -s
    const sx = s
    const sz = c
    if (!o.skipTop) this.quad(E, F, G, H, color, 0, 1, 0)
    if (!o.skipBottom) this.quad(A, D, C, B, color, 0, -1, 0)
    const sk = o.skip
    if (sk !== 'pz') this.quad(D, H, G, C, color, sx, 0, sz)
    if (sk !== 'nz') this.quad(B, F, E, A, color, -sx, 0, -sz)
    if (sk !== 'px') this.quad(C, G, F, B, color, nx, 0, nz)
    if (sk !== 'nx') this.quad(A, E, H, D, color, -nx, 0, -nz)
  }

  /** 收分长方体（塔楼：每段顶部略小）。 */
  taper(w, h, d, topScale, color, x, y, z, ry = 0, o = {}) {
    const tw = (w * topScale) / 2
    const bw = w / 2
    const td = (d * topScale) / 2
    const bd = d / 2
    const hh = h / 2
    const y0 = y - hh
    const y1 = y + hh
    const s = Math.sin(ry)
    const c = Math.cos(ry)
    const P = (px, py, pz) => [x + px * c + pz * s, y0 + py, z - px * s + pz * c]
    const A = P(-bw, 0, -bd)
    const B = P(bw, 0, -bd)
    const C = P(bw, 0, bd)
    const D = P(-bw, 0, bd)
    const E = P(-tw, h, -td)
    const F = P(tw, h, -td)
    const G = P(tw, h, td)
    const H = P(-tw, h, td)
    this.quad(E, F, G, H, color, 0, 1, 0)
    if (!o.skipBottom) this.quad(A, D, C, B, color, 0, -1, 0)
    const sx = s
    const sz = c
    this.quad(D, H, G, C, color, sx, 0, sz)
    this.quad(B, F, E, A, color, -sx, 0, -sz)
    this.quad(C, G, F, B, color, c, 0, -s)
    this.quad(A, E, H, D, color, -c, 0, s)
    void y1
  }

  cyl(r, h, color, x, y, z, seg = 10, o = {}) {
    const g = this.outline
    if (!this.inHull && g > 0 && r * 2 >= 0.7) this._hull(() => this.cyl(r + g, h + g * 2, color, x, y - g, z, seg, { rt: o.rt === undefined ? undefined : o.rt + g, noCap: true }))
    const rt = o.rt === undefined ? r : o.rt
    const y0 = y
    const y1 = y + h
    const top = []
    const bot = []
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      top.push([x + ca * rt, y1, z + sa * rt])
      bot.push([x + ca * r, y0, z + sa * r])
    }
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg
      const a = ((i + 0.5) / seg) * Math.PI * 2
      this.quad(bot[i], bot[j], top[j], top[i], color, Math.cos(a), 0, Math.sin(a))
    }
    if (!o.noCap) {
      // 顶盖：每段一个三角（以前写成四点四边形，退了两个退化三角，白画一倍）
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg
        this.tri(x, y1, z, top[i][0], top[i][1], top[i][2], top[j][0], top[j][1], top[j][2], color, 0, 1, 0)
      }
    }
  }

  cone(r, h, color, x, y, z, seg = 8) {
    const g = this.outline
    if (!this.inHull && g > 0 && r * 2 >= 0.8) this._hull(() => this.cone(r + g, h + g, color, x, y - g, z, seg))
    const apex = [x, y + h, z]
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const b = ((i + 1) / seg) * Math.PI * 2
      const p = [x + Math.cos(a) * r, y, z + Math.sin(a) * r]
      const q = [x + Math.cos(b) * r, y, z + Math.sin(b) * r]
      const m = (a + b) / 2
      this.quad(p, q, apex, apex, color, Math.cos(m), 0.5, Math.sin(m))
    }
  }

  sphere(r, color, x, y, z, seg = 8, rings = 5) {
    const g = this.outline
    if (!this.inHull && g > 0 && r * 2 >= 0.8) this._hull(() => this.sphere(r + g, color, x, y, z, seg, rings))
    for (let j = 0; j < rings; j++) {
      const p0 = (j / rings) * Math.PI
      const p1 = ((j + 1) / rings) * Math.PI
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2
        const a1 = ((i + 1) / seg) * Math.PI * 2
        const P = (p, a) => [x + Math.sin(p) * Math.cos(a) * r, y + Math.cos(p) * r, z + Math.sin(p) * Math.sin(a) * r]
        const A = P(p0, a0)
        const B = P(p0, a1)
        const C = P(p1, a1)
        const D = P(p1, a0)
        const am = (a0 + a1) / 2
        const pm = (p0 + p1) / 2
        this.quad(A, B, C, D, color, Math.sin(pm) * Math.cos(am), Math.cos(pm), Math.sin(pm) * Math.sin(am))
      }
    }
  }

  /** 描边壳几何（只保留位置，材质用 BackSide 纯色）。 */
  buildHull() {
    if (!this.hp || this.hp.length === 0) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.hp.buf, 3))
    fastSphere(g)
    return g
  }

  build() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.buf, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.buf, 3))
    g.setAttribute('color', new THREE.BufferAttribute(this.col.buf, 3))
    fastSphere(g)
    return g
  }
}

/** 三步色阶（三渲二的硬转折）。 */
export function toonMap(steps = 3) {
  // 与「雨夜便利店」同一组色阶：暗部不死黑、中间调偏高，硬转折但不脏
  const RAMP = steps === 3 ? [70, 160, 255] : null
  const data = new Uint8Array(steps)
  for (let i = 0; i < steps; i++) data[i] = RAMP ? RAMP[i] : Math.round(((i + 1) / steps) * 255)
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat)
  tex.needsUpdate = true
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  return tex
}

/**
 * 风格化 PBR 受光材质：顶点色 + 低金属度 + 较大粗糙度。
 * 明暗来自真实光照（太阳/半球光）+ scene.environment 的 IBL 反照，
 * 不再用三步色阶硬切阴影；envMapIntensity 默认 0.9，水面/玻璃可调高吃反射。
 */
export function litMat(o = {}) {
  const { envMapIntensity = 0.9, ...rest } = o
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.0,
    envMapIntensity,
    ...rest,
  })
}

export function canvasLabel(text, o = {}) {
  const w = o.w || 256
  const h = o.h || 64
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  g.fillStyle = o.bg || '#111418'
  g.fillRect(0, 0, w, h)
  if (o.border) {
    g.strokeStyle = o.border
    g.lineWidth = 3
    g.strokeRect(1.5, 1.5, w - 3, h - 3)
  }
  g.fillStyle = o.ink || '#ffffff'
  g.font = `${o.weight || 700} ${o.size || Math.floor(h * 0.6)}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, h / 2 + 1)
  const tex = new THREE.CanvasTexture(cv)
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 店铺招牌贴图（文字 + 底色），只在看得清的距离上用。 */
export function signMaterial(shop) {
  const tex = canvasLabel(shop.name, {
    bg: shop.color,
    ink: shop.ink,
    h: 64,
    w: 256,
    size: 34,
    border: shop.signStyle === 'wood' ? '#c9a25a' : undefined,
  })
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: false })
}
