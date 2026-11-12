// 动态元素：车流、行人、缆车、摩天轮、鸽子、猴群、落叶、雨。
import * as THREE from 'three'
import { MeshBuilder } from './kit.js'
import * as P from './plan.js'

/**
 * 分段合并几何：每段 [builder, tint, swing, pivotY]。
 * tint=1 的段吃 instanceColor（车漆 / 上衣），其余保持原色（玻璃、轮胎、皮肤、裤子）。
 * swing / pivotY 给行人四肢用：顶点着色器里绕 pivotY 前后摆，swing 是带正负号的幅度。
 * 材质不受光，所以按法线把明暗烘进顶点色：顶面亮、两侧依次暗，体块才立得起来。
 */
const merge = (segs) => {
  const pos = []
  const nor = []
  const col = []
  const tint = []
  const limb = []
  for (const [b, t, swing = 0, pivot = 0] of segs) {
    const g = b.build()
    const p = g.attributes.position.array
    const n = g.attributes.normal.array
    const c = g.attributes.color.array
    for (let i = 0; i < p.length; i += 3) {
      const ny = n[i + 1]
      const shade = ny > 0.5 ? 1 : ny < -0.5 ? 0.45 : Math.abs(n[i]) > Math.abs(n[i + 2]) ? 0.62 : 0.8
      pos.push(p[i], p[i + 1], p[i + 2])
      nor.push(n[i], n[i + 1], n[i + 2])
      col.push(c[i] * shade, c[i + 1] * shade, c[i + 2] * shade)
      tint.push(t)
      limb.push(swing, pivot)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('tint', new THREE.Float32BufferAttribute(tint, 1))
  g.setAttribute('limb', new THREE.Float32BufferAttribute(limb, 2))
  g.computeBoundingSphere()
  return g
}

/** 侧面是梯形的棱柱（车舱 / 斜立柱）：后下 xr0、后上 xr1、前上 xf1、前下 xf0，底宽 wb、顶宽 wt。 */
const prism = (b, color, xr0, xr1, xf1, xf0, y0, y1, wb, wt) => {
  const hb = wb / 2
  const ht = wt / 2
  const A = [xr0, y0, -hb]
  const B = [xf0, y0, -hb]
  const C = [xf1, y1, -ht]
  const D = [xr1, y1, -ht]
  const A2 = [xr0, y0, hb]
  const B2 = [xf0, y0, hb]
  const C2 = [xf1, y1, ht]
  const D2 = [xr1, y1, ht]
  b.quad(A, B, C, D, color, 0, 0, -1)
  b.quad(A2, D2, C2, B2, color, 0, 0, 1)
  b.quad(D, C, C2, D2, color, 0, 1, 0)
  b.quad(B, B2, C2, C, color, 1, 0.4, 0)
  b.quad(A, D, D2, A2, color, -1, 0.4, 0)
}

/** 沿 Z 的圆盘（扇形三角），法线朝 side。 */
const disc = (b, color, x, y, z, r, side, seg) => {
  const c = [x, y, z]
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2
    const a1 = ((i + 1) / seg) * Math.PI * 2
    b.quad(c, [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z], c, color, 0, 0, side)
  }
}

/** 圆轮（轴沿 Z）：胎面 + 胎侧 + 亮色轮毂 + 五根轮辐 + 轮心，外侧朝 side=±1。夜里轮毂要够亮才认得出是轮子。 */
const wheel = (b, x, y, z, r, w, side) => {
  const seg = 16
  const zo = z + side * w / 2
  const zi = z - side * w / 2
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2
    const a1 = ((i + 1) / seg) * Math.PI * 2
    const am = (a0 + a1) / 2
    const p = (a, zz) => [x + Math.cos(a) * r, y + Math.sin(a) * r, zz]
    b.quad(p(a0, zi), p(a1, zi), p(a1, zo), p(a0, zo), '#2a2c30', Math.cos(am), Math.sin(am), 0)
  }
  disc(b, '#34363b', x, y, zo, r, side, seg)
  disc(b, '#c4cad2', x, y, zo + side * 0.012, r * 0.64, side, seg)
  disc(b, '#6a7078', x, y, zo + side * 0.02, r * 0.5, side, seg)
  const zs = zo + side * 0.028
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const hw = r * 0.07
    const r1 = r * 0.6
    b.quad([x - sa * hw, y + ca * hw, zs], [x + sa * hw, y - ca * hw, zs], [x + ca * r1 + sa * hw, y + sa * r1 - ca * hw, zs], [x + ca * r1 - sa * hw, y + sa * r1 + ca * hw, zs], '#d6dce2', 0, 0, side)
  }
  disc(b, '#e2e6ea', x, y, zo + side * 0.034, r * 0.14, side, 8)
}

// 车型参数（车头 +X）：L 长、W 宽、h0 车身下沿、h1 腰线、cab 车舱侧面四点、y1 车顶、r 轮径、wx 前后轴
const CAR_TYPES = {
  sedan: { L: 4.6, W: 1.84, h0: 0.36, h1: 0.94, cab: [-1.5, -1.0, 0.38, 1.0], y1: 1.44, r: 0.34, wx: [-1.45, 1.42], doors: 4 },
  hatch: { L: 3.95, W: 1.76, h0: 0.36, h1: 0.94, cab: [-1.88, -1.74, 0.22, 0.86], y1: 1.5, r: 0.32, wx: [-1.25, 1.25], doors: 4 },
  suv: { L: 4.75, W: 1.96, h0: 0.5, h1: 1.12, cab: [-2.25, -2.08, 0.5, 1.18], y1: 1.84, r: 0.42, wx: [-1.52, 1.52], doors: 4, rails: true },
  van: { L: 4.95, W: 1.92, h0: 0.42, h1: 1.0, cab: [-2.42, -2.4, 1.2, 2.05], y1: 1.98, r: 0.36, wx: [-1.7, 1.62], doors: 3 },
  taxi: { L: 4.6, W: 1.84, h0: 0.36, h1: 0.94, cab: [-1.5, -1.0, 0.38, 1.0], y1: 1.44, r: 0.34, wx: [-1.45, 1.42], doors: 4, sign: true },
}

const carGeo = (t) => {
  const p = new MeshBuilder()
  const f = new MeshBuilder()
  const { L, W, h0, h1, y1, r } = t
  const [xr0, xr1, xf1, xf0] = t.cab
  const hx = L / 2
  const bh = h1 - h0
  const glass = '#18222e'
  const trim = '#1c1e22'
  // 车身：中段整高，车头 / 车尾各削低一点，轮廓才不是一块砖
  p.box(L - 0.5, bh, W, '#ffffff', -0.03, h0 + bh / 2, 0, 0)
  p.box(0.3, bh - 0.1, W - 0.04, '#ffffff', hx - 0.15, h0 + (bh - 0.1) / 2, 0, 0)
  p.box(0.22, bh - 0.05, W - 0.04, '#ffffff', -hx + 0.11, h0 + (bh - 0.05) / 2, 0, 0)
  // 引擎盖中线微隆起
  if (xf0 < hx - 0.4) p.box(hx - xf0 - 0.3, 0.04, W * 0.5, '#ffffff', (hx + xf0) / 2 - 0.1, h1 + 0.02, 0, 0)
  // 车舱：玻璃棱柱 + 车顶 + 黑色立柱
  const wb = W - 0.1
  const wt = W - 0.42
  prism(f, glass, xr0, xr1, xf1, xf0, h1, y1, wb, wt)
  p.box(xf1 - xr1 + 0.08, 0.07, wt + 0.06, '#ffffff', (xf1 + xr1) / 2, y1 + 0.035, 0, 0)
  const bx = t.doors === 4 ? (xr1 + xf1) / 2 - 0.1 : xf1 - 0.9
  prism(f, trim, bx - 0.06, bx - 0.06, bx + 0.06, bx + 0.06, h1, y1, wb + 0.02, wt + 0.02)
  prism(f, trim, xf0 - 0.1, xf1 - 0.04, xf1 + 0.04, xf0, h1, y1, wb + 0.02, wt + 0.02)
  prism(f, trim, xr0, xr1 - 0.03, xr1 + 0.12, xr0 + 0.16, h1, y1, wb + 0.02, wt + 0.02)
  if (t.rails) for (const s of [-1, 1]) f.box(xf1 - xr1 - 0.2, 0.06, 0.06, '#2a2d32', (xf1 + xr1) / 2, y1 + 0.1, s * (wt / 2 - 0.08), 0)
  if (t.sign) {
    f.box(0.56, 0.2, 0.3, '#ffe27a', (xf1 + xr1) / 2, y1 + 0.17, 0, 0)
    f.box(0.6, 0.04, 0.34, '#2a2d32', (xf1 + xr1) / 2, y1 + 0.09, 0, 0)
  }
  // 侧面：裙边、腰线饰条、门缝、门把手、后视镜
  f.box(t.wx[1] - t.wx[0] - r * 2 - 0.1, 0.1, W + 0.02, trim, (t.wx[0] + t.wx[1]) / 2, h0 + 0.05, 0, 0)
  f.box(L - 0.9, 0.03, W + 0.014, '#5a6068', 0, h0 + bh * 0.62, 0, 0)
  const seams = t.doors === 4 ? [xf0 - 0.12, bx, xr0 + 0.2] : [xf0 - 0.12, bx]
  for (const sx of seams) f.box(0.025, bh - 0.16, W + 0.012, '#15171a', sx, h0 + bh / 2 + 0.03, 0, 0)
  for (let i = 0; i < seams.length - 1; i++) f.box(0.16, 0.035, W + 0.02, '#c4c8cc', seams[i] - 0.3, h1 - 0.14, 0, 0)
  for (const s of [-1, 1]) {
    p.box(0.16, 0.11, 0.14, '#ffffff', xf0 - 0.12, h1 + 0.1, s * (W / 2 + 0.06), 0)
    f.box(0.14, 0.03, 0.03, trim, xf0 - 0.12, h1 + 0.02, s * (W / 2 + 0.03), 0)
  }
  // 车头：保险杠、中网 + 镀铬框、大灯 + 日行灯带、雾灯
  f.box(0.16, 0.22, W + 0.04, trim, hx - 0.02, h0 + 0.11, 0, 0)
  f.box(0.04, 0.2, W * 0.44, '#0e1012', hx + 0.005, h1 - 0.24, 0, 0)
  f.box(0.03, 0.03, W * 0.46, '#c8ccd2', hx + 0.01, h1 - 0.13, 0, 0)
  for (const s of [-1, 1]) {
    f.box(0.05, 0.12, 0.42, '#fff6dc', hx + 0.005, h1 - 0.2, s * (W / 2 - 0.27), 0)
    f.box(0.05, 0.025, 0.4, '#dff2ff', hx + 0.01, h1 - 0.12, s * (W / 2 - 0.27), 0)
    f.box(0.03, 0.06, 0.12, '#ffeec8', hx + 0.07, h0 + 0.12, s * (W / 2 - 0.25), 0)
  }
  // 车尾：保险杠、尾灯 + 贯穿灯带、车牌、排气管
  f.box(0.16, 0.22, W + 0.04, trim, -hx + 0.02, h0 + 0.11, 0, 0)
  f.box(0.04, 0.035, W * 0.6, '#8a1a14', -hx - 0.005, h1 - 0.16, 0, 0)
  for (const s of [-1, 1]) f.box(0.05, 0.12, 0.38, '#ff3a2c', -hx - 0.008, h1 - 0.16, s * (W / 2 - 0.25), 0)
  f.box(0.03, 0.13, 0.42, '#e8e4d4', -hx - 0.01, h0 + 0.33, 0, 0)
  f.box(0.03, 0.13, 0.42, '#e8e4d4', hx + 0.08, h0 + 0.13, 0, 0)
  f.box(0.12, 0.06, 0.06, '#4a4e54', -hx - 0.04, h0 + 0.03, W / 2 - 0.4, 0)
  for (const x of t.wx) {
    for (const s of [-1, 1]) {
      disc(f, '#0c0d10', x, r, s * (W / 2 + 0.004), r + 0.07, s, 16)
      wheel(f, x, r, s * (W / 2 - 0.12), r, 0.26, s)
    }
  }
  return merge([[p, 1], [f, 0]])
}

const busGeo = () => {
  const b = new MeshBuilder()
  b.box(11.5, 2.9, 2.5, '#ffffff', 0, 1.9, 0, 0, { skipBottom: false })
  // 车窗：夜里亮着的暖白带状窗，两侧各一条 + 后窗
  b.box(11.0, 1.15, 2.56, '#ffe6b4', 0, 2.55, 0, 0)
  b.box(11.1, 0.34, 2.58, '#ffffff', 0, 1.72, 0, 0)
  b.box(0.1, 1.8, 2.2, '#ffe6b4', 5.76, 2.0, 0, 0)
  for (const z of [-0.8, 0.8]) {
    b.box(0.16, 0.26, 0.52, '#fff4d4', 5.78, 1.05, z, 0)
    b.box(0.14, 0.24, 0.46, '#ff4436', -5.78, 1.1, z, 0)
  }
  b.cyl(0.5, 0.3, '#1a1d21', -3.8, 0.5, 1.2, 8)
  b.cyl(0.5, 0.3, '#1a1d21', 3.8, 0.5, 1.2, 8)
  b.cyl(0.5, 0.3, '#1a1d21', -3.8, 0.5, -1.2, 8)
  b.cyl(0.5, 0.3, '#1a1d21', 3.8, 0.5, -1.2, 8)
  return b.build()
}

// 脸朝 +Z。只有上衣和袖子吃 instanceColor；腿绕髋、手臂绕肩反向摆。
const HIP = 0.84
const SHOULDER = 1.44
const personGeo = () => {
  const skin = '#e8bf98'
  const hair = '#1e1a18'
  const pants = '#2c3039'
  const torso = new MeshBuilder()
  torso.box(0.44, 0.6, 0.26, '#ffffff', 0, 1.17, 0, 0)
  const head = new MeshBuilder()
  head.box(0.12, 0.06, 0.12, skin, 0, 1.5, 0, 0)
  head.box(0.26, 0.28, 0.26, skin, 0, 1.66, 0, 0)
  head.box(0.28, 0.08, 0.28, hair, 0, 1.83, 0, 0)
  head.box(0.28, 0.2, 0.06, hair, 0, 1.71, -0.12, 0)
  head.box(0.42, 0.12, 0.25, pants, 0, 0.83, 0, 0)
  const segs = [
    [torso, 1],
    [head, 0],
  ]
  for (const s of [-1, 1]) {
    const sleeve = new MeshBuilder()
    sleeve.box(0.11, 0.56, 0.13, '#ffffff', s * 0.28, 1.18, 0, 0)
    const hand = new MeshBuilder()
    hand.box(0.1, 0.1, 0.11, skin, s * 0.28, 0.85, 0, 0)
    const leg = new MeshBuilder()
    leg.box(0.17, 0.76, 0.19, pants, s * 0.11, 0.42, 0, 0)
    leg.box(0.18, 0.08, 0.27, '#18181c', s * 0.11, 0.04, 0.03, 0)
    segs.push([sleeve, 1, -s * 0.5, SHOULDER], [hand, 0, -s * 0.5, SHOULDER], [leg, 0, s * 0.55, HIP])
  }
  return merge(segs)
}

const monkeyGeo = () => {
  const b = new MeshBuilder()
  const fur = '#6b4a2e'
  const face = '#c9a25a'
  b.box(0.42, 0.5, 0.32, fur, 0, 0.62, 0, 0, { skipBottom: false })
  b.box(0.32, 0.3, 0.3, fur, 0, 1.0, 0, 0)
  b.box(0.2, 0.16, 0.12, face, 0, 1.0, 0.17, 0)
  b.box(0.1, 0.34, 0.1, fur, -0.22, 0.62, 0, 0, { skipBottom: false })
  b.box(0.1, 0.34, 0.1, fur, 0.22, 0.62, 0, 0, { skipBottom: false })
  b.box(0.1, 0.32, 0.1, fur, -0.12, 0.2, 0, 0, { skipBottom: false })
  b.box(0.1, 0.32, 0.1, fur, 0.12, 0.2, 0, 0, { skipBottom: false })
  b.box(0.08, 0.08, 0.38, fur, 0.0, 0.52, -0.24, 0)
  return b.build()
}

/**
 * 动态物件的材质：不受光。
 * 夜里整座城的亮度几乎全给了窗和招牌，靠月光照的实例（车、人、狗）会糊成一团黑。
 * 直接把颜色画出来（顶点色 × 实例色），像素风本来就不讲究光照，反而更干净。
 */
const flat = (k = 1) => new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color().setScalar(k) })

/**
 * 车、人要排在地面加亮贴片（路灯光池 / 车灯 / 湿地倒影，离地 0.1~0.3m 且不写深度）之后画：
 * 否则低于贴片的轮子、鞋会被叠上一层光，下半截发白。走透明队列 + 高 renderOrder，不透明度仍是 1。
 */
const LATE = 10
const lateFlat = (k = 1) => {
  const m = flat(k)
  m.transparent = true
  return m
}

/**
 * 配合 merge：instanceColor 只乘到 tint=1 的顶点上。
 * walk=true 时几何需带实例属性 walk（步态相位），四肢按 limb 绕 X 轴摆动。
 */
const tinted = (k = 1, walk = false) => {
  const m = lateFlat(k)
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float tint;\n${walk ? 'attribute vec2 limb;\nattribute float walk;' : ''}`)
      .replace('#include <color_vertex>', 'vColor = color;\n#ifdef USE_INSTANCING_COLOR\nvColor *= mix(vec3(1.0), instanceColor, tint);\n#endif')
    if (walk)
      s.vertexShader = s.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        float la = sin(walk) * limb.x;
        float ly = transformed.y - limb.y;
        float lz = transformed.z;
        transformed.y = limb.y + ly * cos(la) - lz * sin(la);
        transformed.z = ly * sin(la) + lz * cos(la);`
      )
  }
  m.customProgramCacheKey = () => (walk ? 'tinted-walk' : 'tinted')
  return m
}

export function buildLife(scene, ctx) {
  // 建筑刚体：车和行人都不能穿过去
  const colliders = ctx.colliders || []
  // 碰撞按 48m 格子分桶：行人和车每帧只查附近几格，不再扫全城
  const CELL = 48
  const buckets = new Map()
  const bkey = (ix, iz) => ix * 73856093 + iz
  for (const c of colliders) {
    const x0 = Math.floor((c.x - c.w / 2) / CELL)
    const x1 = Math.floor((c.x + c.w / 2) / CELL)
    const z0 = Math.floor((c.z - c.d / 2) / CELL)
    const z1 = Math.floor((c.z + c.d / 2) / CELL)
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = bkey(ix, iz)
        let a = buckets.get(k)
        if (!a) buckets.set(k, (a = []))
        a.push(c)
      }
    }
  }
  const blocked = (x, z, r) => {
    const ix = Math.floor(x / CELL)
    const iz = Math.floor(z / CELL)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const a = buckets.get(bkey(ix + dx, iz + dz))
        if (!a) continue
        for (const c of a) {
          if (Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r) return true
        }
      }
    }
    return false
  }
  const rnd = P.mulberry32(913)
  const group = new THREE.Group()
  scene.add(group)

  // ---------------------------------------------------------------- 车流
  const lanes = []
  // 车道：主干道双向各两条、次干道各一条；t ∈ [0, len)，坐标 = lo + t
  for (const r of P.ROADS) {
    if (r.tier > 2) continue
    const [lo, hi] = P.roadExtent(r)
    // 与 plan.js 路宽联动：一级路车行区 2.5~11.5m 分 3 道（外侧 10.0 给公交），二级路 1.0~4.5m 一道
    const offs = r.tier === 1 ? [4.0, 7.0] : [2.75]
    for (const o of offs) {
      for (const sd of [-1, 1]) {
        const dir = r.a === 'z' ? -sd : sd
        lanes.push({ axis: r.a, off: r.at + sd * o, dir, speed: 8 + rnd() * 5, lo: lo + 6, len: hi - lo - 12, t: 0 })
      }
    }
  }
  for (const l of lanes) l.t = rnd() * l.len
  const CARS = 110

  // 真实街面的车色：白 / 银 / 黑占多数，彩色点缀才是少数；不要再按索引循环排序（那样一眼看出是程序）
  const palette = ['#e8e6e0', '#d8d8d6', '#9aa0a6', '#6e747a', '#3a3e44', '#2a2d33', '#f2ede4', '#cfd6dc', '#c9a24a', '#a8322e', '#3f6f9e', '#4a5470']
  const taxiCols = ['#f2c230', '#3f9a68', '#e9e3d2']
  const carTint = new THREE.Color()
  const TYPE_W = [['sedan', 0.34], ['hatch', 0.2], ['suv', 0.28], ['van', 0.1], ['taxi', 0.08]]
  const pickType = () => {
    let t = rnd()
    for (const [k, w] of TYPE_W) if ((t -= w) <= 0) return k
    return 'sedan'
  }
  const geoCache = {}
  const geoOf = (k) => geoCache[k] || (geoCache[k] = carGeo(CAR_TYPES[k]))
  /** 一队车：每种车型一个 InstancedMesh，slots[i] 指向第 i 辆车所在的 mesh 和槽位。 */
  const fleet = (n, mat, pow) => {
    const types = Array.from({ length: n }, pickType)
    const meshes = {}
    for (const k of new Set(types)) {
      const m = new THREE.InstancedMesh(geoOf(k), mat, types.filter((x) => x === k).length)
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      // 实例矩阵每帧都在变，包围球会把整队车当成一个点剔掉（车流时有时无），干脆不剔
      m.frustumCulled = false
      m.renderOrder = LATE
      m.userData.n = 0
      meshes[k] = m
      group.add(m)
    }
    const slots = types.map((k) => {
      const mesh = meshes[k]
      const i = mesh.userData.n++
      const c = k === 'taxi' ? taxiCols[Math.floor(rnd() * taxiCols.length)] : palette[Math.floor(Math.pow(rnd(), pow) * palette.length)]
      mesh.setColorAt(i, carTint.set(c))
      mesh.setMatrixAt(i, new THREE.Matrix4())
      return { mesh, i }
    })
    const list = Object.values(meshes)
    for (const m of list) m.instanceColor.needsUpdate = true
    return { slots, list }
  }
  // 一点自发光：夜里的车身不会掉进纯黑，颜色还能看出来
  const cars = fleet(CARS, tinted(0.8), 0.75)

  const busMat = lateFlat(0.72)
  // 车头灯在地面上的两团光：车走灯走，夜里马路上才「活」
  // 车灯：不是一个圆斑，是「车头附近最亮、往前摊开、边缘碎掉」的一条光锥
  const lampCv = document.createElement('canvas')
  lampCv.width = 128
  lampCv.height = 64
  const lg2 = lampCv.getContext('2d')
  const img = lg2.createImageData(128, 64)
  for (let yy = 0; yy < 64; yy++) {
    for (let xx = 0; xx < 128; xx++) {
      const u = xx / 127
      const v = (yy - 31.5) / 31.5
      // 车头处淡入、往前慢慢衰减；横向高斯，越远摊得越宽。峰值不到 1，叠加后才不会糊成一块白
      const along = THREE.MathUtils.smoothstep(u, 0, 0.18) * Math.pow(1 - u, 1.7)
      const w = 0.22 + u * 0.55
      const f = along * Math.exp(-3 * (v / w) * (v / w)) * 1.15
      const a = Math.min(1, Math.max(0, f)) * 0.8
      const o = (yy * 128 + xx) * 4
      img.data[o] = 255
      img.data[o + 1] = 236
      img.data[o + 2] = 198
      img.data[o + 3] = a * 255
    }
  }
  lg2.putImageData(img, 0, 0)
  const lampTex = new THREE.CanvasTexture(lampCv)
  const lampMat = new THREE.MeshBasicMaterial({ map: lampTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.45 })
  const headlights = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), lampMat, CARS + 8)
  headlights.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  headlights.frustumCulled = false
  group.add(headlights)
  const hQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
  const hY = new THREE.Quaternion()
  const hQ2 = new THREE.Quaternion()
  const hV = new THREE.Vector3()
  // 沿行进方向拉长（本地 +X 始终顺着车头），横向收窄
  // 车灯摊得更宽更长：光源近、地面湿，光会铺出去十几米
  const hS = new THREE.Vector3(17, 9.5, 1)
  const setHead = (i, x, y, z, ry, dim = 1) => {
    hY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry)
    hQ2.copy(hY).multiply(hQ)
    hMat.compose(hV.set(x, y + 0.06, z), hQ2, hS)
    headlights.setMatrixAt(i, hMat)
    // 每辆车灯的亮度/新旧不同，车流才不会像一排同一个灯板
    headlights.setColorAt(i, carTint.setRGB(dim, dim * 0.985, dim * 0.94))
  }
  const hMat = new THREE.Matrix4()

  // 路边停车：贴着路沿一溜停着，间距不匀、有的车头朝反方向，街道立刻不那么「摆拍」
  const parkedMat = tinted(0.64)
  const parkedSpots = []
  for (const r of P.ROADS) {
    if (r.tier > 2) continue
    const [lo, hi] = P.roadExtent(r)
    for (const sd of [-1, 1]) {
      let t = lo + 8 + rnd() * 12
      while (t < hi - 10) {
        if (rnd() < 0.34) {
          // 停在路沿内侧的车行道上（人行道宽 3m，见 world.js walkW），不压到人行道
          const off = r.at + sd * (r.w / 2 - 3 - 1.15)
          const x = r.a === 'x' ? t : off
          const z = r.a === 'x' ? off : t
          if (!blocked(x, z, 1.6)) parkedSpots.push({ x, z, axis: r.a, flip: rnd() < 0.5 })
        }
        t += 7.5 + rnd() * 9
      }
    }
  }
  const parked = fleet(Math.max(1, parkedSpots.length), parkedMat, 0.7)
  const parkedQ = new THREE.Quaternion()
  const parkedE = new THREE.Euler()
  const parkedP = new THREE.Vector3()
  const parkedS = new THREE.Vector3(1, 1, 1)
  const parkedM = new THREE.Matrix4()
  parkedSpots.forEach((p, i) => {
    const base = p.axis === 'x' ? (p.flip ? Math.PI : 0) : p.flip ? Math.PI / 2 : -Math.PI / 2
    parkedQ.setFromEuler(parkedE.set(0, base + (rnd() - 0.5) * 0.07, 0))
    parkedM.compose(parkedP.set(p.x, P.groundY(p.x, p.z) + 0.08, p.z), parkedQ, parkedS)
    const s = parked.slots[i]
    s.mesh.setMatrixAt(s.i, parkedM)
  })
  for (const m of parked.list) {
    m.instanceMatrix.needsUpdate = true
    m.visible = parkedSpots.length > 0
  }

  const buses = new THREE.InstancedMesh(busGeo(), busMat, 8)
  buses.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  for (let i = 0; i < 8; i++) {
    buses.setColorAt(i, carTint.set(i % 3 === 0 ? '#2f8a5a' : i % 3 === 1 ? '#c23a2a' : '#d8d2c2'))
    buses.setMatrixAt(i, new THREE.Matrix4())
  }
  buses.instanceColor.needsUpdate = true
  buses.frustumCulled = false
  buses.renderOrder = LATE
  group.add(buses)

  // ---------------------------------------------------------------- 行人
  // 行人分布在每条路两侧的人行道上 + 步行街（步行街最密、走得最慢）
  const N = 760
  const peopleMat = tinted(0.85, true)
  const people = new THREE.InstancedMesh(personGeo(), peopleMat, N)
  people.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  people.renderOrder = LATE
  const walkPhase = new THREE.InstancedBufferAttribute(new Float32Array(N), 1)
  walkPhase.setUsage(THREE.DynamicDrawUsage)
  people.geometry.setAttribute('walk', walkPhase)
  const walkers = []
  const strollers = [] // 公园里绕圈散步的人
  const shirt = ['#ece8e0', '#2e3440', '#5a6b82', '#b0403a', '#d9b26a', '#3f6b5a', '#c9c2b4', '#23272e', '#7a4a6a', '#e07a50', '#4a78b8', '#f4f2ec']
  const N_ROAD = 470
  const N_PARK = 290
  for (let i = 0; i < N; i++) {
    people.setColorAt(i, carTint.set(shirt[i % shirt.length]))
    if (i < 70) {
      const PS = P.PEDESTRIAN
      walkers.push({
        axis: 'x',
        off: PS.z + (rnd() - 0.5) * (PS.w - 4),
        t: PS.x0 + rnd() * (PS.x1 - PS.x0),
        lo: PS.x0 + 2,
        hi: PS.x1 - 2,
        dir: rnd() < 0.5 ? 1 : -1,
        speed: 0.8 + rnd() * 0.5,
        phase: rnd() * 6.28,
      })
      continue
    }
    if (i >= N_ROAD) {
      // 公园里散步：一半沿环路椭圆绕圈，一半在步道上来回直走 ——
      // 只画一条大椭圆的话，视觉上就是「公园边上一圈人、里面没人」
      const p = P.PARKS[0]
      const big = rnd() < 0.72
      const q = big ? p : P.PARKS[1 + Math.floor(rnd() * (P.PARKS.length - 1))]
      const cx = (q.x0 + q.x1) / 2
      const cz = (q.z0 + q.z1) / 2
      const pw = q.x1 - q.x0
      const pd = q.z1 - q.z0
      const phase = rnd() * 6.28
      if (pw > 80 && rnd() < 0.5) {
        // 环路步道（和 world.js pathLoop 同一条线）
        strollers.push({ mode: 'loop', cx, cz, rx: pw / 2 - 10, rz: pd / 2 - 10, a: rnd() * 6.28, dir: rnd() < 0.5 ? 1 : -1, speed: (0.5 + rnd() * 0.45) / Math.max(6, (pw + pd) / 4), phase })
        continue
      }
      // 直线路：优先挑公园的边路 / 中轴步道；有湖的公园中轴要绕开湖面
      const inLake = (x, z) =>
        q.lake && ((x - q.lake.x) / (q.lake.rx + 7)) ** 2 + ((z - q.lake.z) / (q.lake.rz + 7)) ** 2 < 1
      const segs = []
      const trySeg = (ax, az, bx, bz) => {
        const mx = (ax + bx) / 2
        const mz = (az + bz) / 2
        if (!inLake(ax, az) && !inLake(bx, bz) && !inLake(mx, mz)) segs.push([ax, az, bx, bz])
      }
      if (pw > 50) {
        trySeg(q.x0 + 8, q.z0 + 6, q.x1 - 8, q.z0 + 6)
        trySeg(q.x0 + 8, q.z1 - 6, q.x1 - 8, q.z1 - 6)
        trySeg(q.x0 + 8, q.z0 + 8, q.x0 + 8, q.z1 - 8)
        trySeg(q.x1 - 8, q.z0 + 8, q.x1 - 8, q.z1 - 8)
        trySeg(cx, q.z0 + 8, cx, q.z1 - 8)
        trySeg(q.x0 + 8, cz, q.x1 - 8, cz)
      } else {
        trySeg(q.x0 + 4, cz, q.x1 - 4, cz)
        trySeg(cx, q.z0 + 4, cx, q.z1 - 4)
      }
      if (segs.length) {
        const [ax, az, bx, bz] = segs[Math.floor(rnd() * segs.length)]
        strollers.push({ mode: 'line', ax, az, bx, bz, t: rnd(), dir: rnd() < 0.5 ? 1 : -1, speed: 0.9 + rnd() * 0.5, phase })
      } else {
        strollers.push({ mode: 'loop', cx, cz, rx: Math.min(pw, pd) * 0.22, rz: Math.min(pw, pd) * 0.22, a: rnd() * 6.28, dir: rnd() < 0.5 ? 1 : -1, speed: 0.12 + rnd() * 0.08, phase })
      }
      continue
    }
    // 按路宽加权挑路：主干道人最多，支路少
    const wsum = P.ROADS.reduce((a2, r2) => a2 + (r2.tier === 1 ? 4 : r2.tier === 2 ? 2 : 1), 0)
    let pickT = rnd() * wsum
    let r = P.ROADS[0]
    for (const r2 of P.ROADS) {
      pickT -= r2.tier === 1 ? 4 : r2.tier === 2 ? 2 : 1
      if (pickT <= 0) {
        r = r2
        break
      }
    }
    const axis = r.a
    const side = rnd() < 0.5 ? -1 : 1
    // 站在人行道上（不是车道边缘）：路沿外再往里一个多人宽
    const walkW = r.tier <= 2 ? 3 : 2.5
    const off = r.w / 2 - walkW + 1.15 + rnd() * 0.9
    const [e0, e1] = P.roadExtent(r)
    const lo = e0 + 4
    const hi = e1 - 4
    walkers.push({
      axis,
      off: r.at + side * off,
      t: lo + rnd() * (hi - lo),
      lo,
      hi,
      dir: rnd() < 0.5 ? 1 : -1,
      speed: 1.1 + rnd() * 0.6,
      phase: rnd() * 6.28,
    })
  }

  // 有车的路口不横穿：把每个行人的往返区间截在两侧交叉路的车行道之间（车行道 = 路宽减两侧 3m 人行道）
  for (const w of walkers) {
    for (const r2 of P.ROADS) {
      if (r2.tier > 2 || r2.a === w.axis) continue
      const [c0, c1] = P.roadExtent(r2)
      if (w.off < c0 || w.off > c1) continue
      const half = r2.w / 2 - 3 + 0.6
      const a = r2.at - half
      const b = r2.at + half
      if (w.t > a && w.t < b) w.t = w.t - a < b - w.t ? a - 0.5 : b + 0.5
      if (b <= w.t) w.lo = Math.max(w.lo, b)
      else w.hi = Math.min(w.hi, a)
    }
    if (w.hi - w.lo < 2) w.hi = w.lo + 2
    w.t = Math.min(w.hi, Math.max(w.lo, w.t))
  }

  // 遛狗：每 9 个行人里有一个牵着狗，狗跟在主人斜后方一蹦一蹦
  const dogGeo = (() => {
    const b = new MeshBuilder()
    b.box(0.26, 0.24, 0.6, '#ffffff', 0, 0.36, 0, 0, { skipBottom: false })
    b.box(0.22, 0.22, 0.24, '#ffffff', 0, 0.56, 0.34, 0)
    b.box(0.12, 0.1, 0.12, '#ffffff', 0, 0.52, 0.5, 0)
    for (const s of [-1, 1]) {
      b.box(0.06, 0.1, 0.04, '#ffffff', s * 0.08, 0.7, 0.3, 0)
      b.box(0.07, 0.26, 0.07, '#ffffff', s * 0.09, 0.13, 0.22, 0, { skipBottom: false })
      b.box(0.07, 0.26, 0.07, '#ffffff', s * 0.09, 0.13, -0.22, 0, { skipBottom: false })
    }
    b.box(0.05, 0.05, 0.24, '#ffffff', 0, 0.5, -0.38, 0)
    return b.build()
  })()
  const dogOwners = walkers.map((w, i) => i).filter((i) => i % 9 === 4)
  const dogs = new THREE.InstancedMesh(dogGeo, flat(0.7), dogOwners.length)
  dogs.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const dogCols = ['#c8955a', '#f2ede4', '#2b2738', '#e0b06a', '#8a6a4a']
  dogOwners.forEach((_, k) => dogs.setColorAt(k, carTint.set(dogCols[k % dogCols.length])))
  dogs.instanceColor.needsUpdate = true
  dogs.frustumCulled = false

  // 流浪猫：沿街边慢慢溜达，走一阵、停一阵
  const catGeo = (() => {
    const b = new MeshBuilder()
    b.box(0.2, 0.18, 0.42, '#ffffff', 0, 0.22, 0, 0, { skipBottom: false })
    b.box(0.18, 0.16, 0.16, '#ffffff', 0, 0.36, 0.24, 0)
    for (const s of [-1, 1]) b.cone(0.04, 0.08, '#ffffff', s * 0.05, 0.44, 0.24, 4)
    b.box(0.04, 0.04, 0.3, '#ffffff', 0, 0.34, -0.32, 0)
    for (const s of [-1, 1]) for (const zz of [-0.14, 0.14]) b.box(0.05, 0.14, 0.05, '#ffffff', s * 0.06, 0.07, zz, 0, { skipBottom: false })
    return b.build()
  })()
  const CN = 26
  const strays = new THREE.InstancedMesh(catGeo, flat(0.7), CN)
  strays.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const catCols = ['#2b2738', '#e8a25a', '#f2ede4', '#8a7a6a', '#d8b48a']
  const strayCats = []
  for (let i = 0; i < CN; i++) {
    strays.setColorAt(i, carTint.set(catCols[i % catCols.length]))
    const w = walkers[70 + Math.floor(rnd() * Math.max(1, walkers.length - 70))]
    strayCats.push({ axis: w.axis, off: w.off + (rnd() - 0.5) * 1.2, t: w.t, lo: w.lo, hi: w.hi, dir: rnd() < 0.5 ? 1 : -1, rest: rnd() * 4, ph: rnd() * 6 })
  }
  strays.instanceColor.needsUpdate = true
  strays.frustumCulled = false

  // 鸟群：几群鸟在城市上空绕圈，翅膀一开一合
  const birdGeo = (() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.5, 0.05, -0.1, 0, 0, -0.1, 0, 0, 0.25, 0, 0, -0.1, 0.5, 0.05, -0.1], 3))
    g.computeVertexNormals()
    return g
  })()
  const BN = 48
  const birds = new THREE.InstancedMesh(birdGeo, new THREE.MeshBasicMaterial({ color: '#2a2438', side: THREE.DoubleSide }), BN)
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  birds.frustumCulled = false
  const flocks = [[-500, -60, 38], [200, 130, 52], [-300, 200, 44], [300, -250, 60], [600, 0, 50]]
  const birdData = []
  for (let i = 0; i < BN; i++) birdData.push({ f: flocks[i % flocks.length], a: rnd() * 0.8, r: 18 + rnd() * 10, dy: (rnd() - 0.5) * 5, ph: rnd() * 6 })
  people.instanceColor.needsUpdate = true
  people.frustumCulled = false
  group.add(people)

  // 雨天每个行人撑一把彩色伞（透明伞、红伞、黄伞……雨夜街头最出彩的颜色）
  const umbrellaGeo = (() => {
    const b = new MeshBuilder()
    b.cyl(0.02, 0.75, '#3a3430', 0, 1.35, 0, 4)
    b.cone(0.72, 0.32, '#ffffff', 0, 2.05, 0, 10)
    return b.build()
  })()
  const umbrellas = new THREE.InstancedMesh(umbrellaGeo, flat(0.8), N)
  umbrellas.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const umbCols = ['#e63946', '#ffd166', '#cfe8f5', '#ff8fab', '#4cc9f0', '#90be6d', '#f8961e', '#ffffff', '#9b5de5']
  for (let i = 0; i < N; i++) umbrellas.setColorAt(i, carTint.set(umbCols[(i * 7) % umbCols.length]))
  umbrellas.instanceColor.needsUpdate = true
  umbrellas.frustumCulled = false
  group.add(umbrellas, dogs, strays, birds)

  // ---------------------------------------------------------------- 缆车
  const cableCars = []
  const cg = new MeshBuilder()
  cg.box(1.6, 1.6, 1.6, '#e2e8ee', 0, 0, 0, 0)
  cg.box(1.7, 0.2, 1.7, '#8f9aa4', 0, 0.8, 0, 0)
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(cg.build(), flat(0.9))
    group.add(m)
    cableCars.push({ m, t: i * 0.5 })
  }

  // ---------------------------------------------------------------- 鸽群
  const pigeonGeo = () => {
    const b = new MeshBuilder()
    b.box(0.26, 0.16, 0.4, '#d8dde2', 0, 0.16, 0, 0)
    b.box(0.14, 0.14, 0.14, '#b9c0c8', 0, 0.3, 0.2, 0)
    return b.build()
  }
  const PN = 26
  const pigeons = new THREE.InstancedMesh(pigeonGeo(), flat(0.85), PN)
  pigeons.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const flock = []
  const FLOCK = { x: P.PARKS[0].x1 - 22, z: P.PARKS[0].z0 + 36 }
  for (let i = 0; i < PN; i++) {
    flock.push({ x: FLOCK.x + (rnd() - 0.5) * 10, z: FLOCK.z + (rnd() - 0.5) * 8, y: 0, vy: 0, a: rnd() * 6.28, sp: 0.4 + rnd() * 0.7 })
  }
  group.add(pigeons)

  // ---------------------------------------------------------------- 猴群
  const MN = 10
  const monkeys = new THREE.InstancedMesh(monkeyGeo(), flat(0.75), MN)
  monkeys.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const troop = []
  const MK = { x: P.TEMPLE.x - 40, z0: P.CITY.z1 + 50, z1: P.TEMPLE.z + 20 }
  for (let i = 0; i < MN; i++) troop.push({ x: MK.x + (rnd() - 0.5) * 60, z: MK.z0 + rnd() * (MK.z1 - MK.z0), a: rnd() * 6.28, sp: 0.3 + rnd() * 0.4, hop: rnd() * 6.28 })
  group.add(monkeys)

  // ---------------------------------------------------------------- 落叶
  const leafN = 220
  const leafPos = new Float32Array(leafN * 3)
  const leafSeed = []
  for (let i = 0; i < leafN; i++) {
    const tree = P.TREES[Math.floor(rnd() * P.TREES.length)]
    leafSeed.push({ x: tree.x + (rnd() - 0.5) * 8, z: tree.z + (rnd() - 0.5) * 8, t: rnd() * 10, sp: 0.5 + rnd() * 0.8 })
  }
  const leafGeo = new THREE.BufferGeometry()
  leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3))
  const leaves = new THREE.Points(leafGeo, new THREE.PointsMaterial({ color: '#d9b06a', size: 0.5, transparent: true, opacity: 0.9, sizeAttenuation: true }))
  group.add(leaves)

  // ---------------------------------------------------------------- 雨
  const rainN = 4200
  const rainPos = new Float32Array(rainN * 6)
  for (let i = 0; i < rainN; i++) {
    const x = (rnd() - 0.5) * 220
    const z = (rnd() - 0.5) * 220
    const y = rnd() * 70
    rainPos.set([x, y, z, x, y - 1.6, z], i * 6)
  }
  const rainGeo = new THREE.BufferGeometry()
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#9fb6cc', transparent: true, opacity: 0.5 }))
  rain.frustumCulled = false
  group.add(rain)

  const mtx = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const sc = new THREE.Vector3(1, 1, 1)
  const pos = new THREE.Vector3()
  const eul = new THREE.Euler()

  const setI = (mesh, i, x, y, z, ry, s = 1) => {
    q.setFromEuler(eul.set(0, ry, 0))
    pos.set(x, y, z)
    sc.set(s, s, s)
    mtx.compose(pos, q, sc)
    mesh.setMatrixAt(i, mtx)
  }

  const state = { rainOn: true, night: true }

  // 每辆车在车道上的占位（用于排队，不互相穿过）
  const carState = []
  for (let i = 0; i < CARS; i++) {
    const lane = lanes[i % lanes.length]
    carState.push({
      lane,
      t: rnd() * lane.len,
      // 每辆车自己的巡航系数：有的稳，有的急，速度差让车队自然散开、拉长
      cruise: 0.74 + rnd() * 0.46,
      // 车道内左右偏移 ±0.35m：不再一根线上排得整整齐齐
      lat: (rnd() - 0.5) * 0.7,
      // 车灯新旧不同
      dim: 0.42 + rnd() * 0.58,
      // 少数车跟在别人后面会「忍一下」，不会永远保持等距
      brake: 0,
      live: true,
    })
  }

  function update(dt, time, player) {
    // 车：沿车道前进；前方有楼或有前车就减速停下（刚体）
    let ci = 0
    const byLane = new Map()
    for (let i = 0; i < carState.length; i++) {
      const st = carState[i]
      st.i = i
      let list = byLane.get(st.lane)
      if (!list) byLane.set(st.lane, (list = []))
      list.push(st)
    }
    for (const list of byLane.values()) {
      list.sort((a, b) => a.t - b.t)
      const lane = list[0].lane
      for (let i = 0; i < list.length; i++) {
        const st = list[i]
        const nxt = list[(i + 1) % list.length]
        let gap = list.length < 2 ? 999 : (nxt.t - st.t) * lane.dir
        if (gap <= 0) gap += lane.len
        const cruiseV = lane.speed * st.cruise
        const hold = gap < 14 ? Math.max(0, (gap - 6) / 8) : 1
        st.brake += (hold - st.brake) * Math.min(1, dt * 2.4)
        const want = cruiseV * st.brake * dt
        const allow = gap < 9 ? Math.max(0, (gap - 6) * 0.42) * dt : want
        const stepT = Math.min(want, allow)
        const prevT = st.t
        st.t = (st.t + stepT * lane.dir + lane.len) % lane.len
        const t = lane.lo + st.t
        const off = lane.off + st.lat
        const x = lane.axis === 'x' ? t : off
        const z = lane.axis === 'x' ? off : t
        const ry = lane.axis === 'x' ? (lane.dir > 0 ? 0 : Math.PI) : lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2
        const hx = Math.cos(ry)
        const hz = -Math.sin(ry)
        let px = x
        let pz = z
        if (blocked(x + hx * 4.5, z + hz * 4.5, 1.1)) {
          st.t = prevT
          const bt = lane.lo + prevT
          px = lane.axis === 'x' ? bt : lane.off
          pz = lane.axis === 'x' ? lane.off : bt
        }
        const y = P.groundY(px, pz) + 0.08
        const slot = cars.slots[st.i]
        setI(slot.mesh, slot.i, px, y, pz, ry)
        ci++
        setHead(ci - 1, px + Math.cos(ry) * 4.2, y, pz - Math.sin(ry) * 4.2, ry, st.dim)
      }
    }
    headlights.count = ci + 8
    headlights.instanceMatrix.needsUpdate = true
    headlights.instanceColor.needsUpdate = true
    for (const m of cars.list) m.instanceMatrix.needsUpdate = true

    for (let i = 0; i < 8; i++) {
      const along = i < 4 ? 'z' : 'x'
      const dir = i % 2 ? 1 : -1
      const lane = (along === 'z' ? -dir : dir) * 10.0
      const [b0, b1] = P.roadExtent(P.ROADS[along === 'x' ? 0 : 1])
      const blen = b1 - b0 - 20
      const t = b0 + 10 + ((((time * (8 + i * 0.7) * dir) % blen) + blen) % blen)
      const x = along === 'x' ? t : lane
      const z = along === 'x' ? lane : t
      const y = P.groundY(x, z) + 0.08
      const ry = along === 'x' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? -Math.PI / 2 : Math.PI / 2
      setI(buses, i, x, y, z, ry)
      const hb = 6.6
      setHead(ci + i, x + Math.cos(ry) * hb, y, z - Math.sin(ry) * hb, ry, 0.95)
    }
    buses.instanceMatrix.needsUpdate = true

    // 行人
    for (let i = 0; i < walkers.length; i++) {
      const w = walkers[i]
      const nt = w.t + dt * w.speed * w.dir
      const nx = w.axis === 'z' ? w.off : nt
      const nz = w.axis === 'z' ? nt : w.off
      // 前面是人行道边界或建筑就掉头（行人也是刚体），加冷却避免原地抖
      w.cd = (w.cd || 0) - dt
      if (nt < w.lo || nt > w.hi || blocked(nx, nz, 0.55)) {
        if (w.cd <= 0) {
          w.dir *= -1
          w.cd = 0.8
        }
      } else {
        w.t = nt
        // 一步约 0.7m：相位推进和实际位移挂钩，脚不打滑
        w.phase += dt * w.speed * 4.4
      }
      walkPhase.array[i] = w.phase
      const x = w.axis === 'z' ? w.off : w.t
      const z = w.axis === 'z' ? w.t : w.off
      // 双腿并拢（cos=±1）时身体最高，起伏只有几厘米
      const y = P.groundY(x, z) + 0.2 + Math.abs(Math.cos(w.phase)) * 0.03
      const ry = w.axis === 'z' ? (w.dir > 0 ? 0 : Math.PI) : w.dir > 0 ? Math.PI / 2 : -Math.PI / 2
      setI(people, i, x, y, z, ry)
      setI(umbrellas, i, x, y, z, ry)
    }
    // 公园里散步的人：环路绕圈 / 步道上来回直走
    for (let k = 0; k < strollers.length; k++) {
      const w = strollers[k]
      w.phase += dt * 3.6
      walkPhase.array[walkers.length + k] = w.phase
      const idx = walkers.length + k
      let x
      let z
      let ry
      if (w.mode === 'line') {
        const len = Math.hypot(w.bx - w.ax, w.bz - w.az) || 1
        w.t += (dt * w.speed * w.dir) / len
        if (w.t > 1) {
          w.t = 1
          w.dir = -1
        } else if (w.t < 0) {
          w.t = 0
          w.dir = 1
        }
        x = w.ax + (w.bx - w.ax) * w.t
        z = w.az + (w.bz - w.az) * w.t
        ry = Math.atan2((w.bx - w.ax) * w.dir, (w.bz - w.az) * w.dir)
      } else {
        w.a += dt * w.speed * w.dir
        x = w.cx + Math.cos(w.a) * w.rx
        z = w.cz + Math.sin(w.a) * w.rz
        // 朝向 = 椭圆切线
        const tx = -Math.sin(w.a) * w.rx * w.dir
        const tz = Math.cos(w.a) * w.rz * w.dir
        ry = Math.atan2(tx, tz)
      }
      const y = P.groundY(x, z) + 0.2 + Math.abs(Math.cos(w.phase)) * 0.03
      setI(people, idx, x, y, z, ry)
      setI(umbrellas, idx, x, y, z, ry)
    }
    people.count = walkers.length + strollers.length
    umbrellas.count = people.count
    people.instanceMatrix.needsUpdate = true
    walkPhase.needsUpdate = true
    umbrellas.visible = state.rainOn
    // 白天车灯不亮：白天开着光斑的车流很出戏
    headlights.visible = state.night
    umbrellas.instanceMatrix.needsUpdate = true

    // 狗：在主人外侧斜后方，蹦跳着走
    dogOwners.forEach((wi, k) => {
      const w = walkers[wi]
      const back = -w.dir * 1.1
      const x = w.axis === 'z' ? w.off + 0.6 : w.t + back
      const z = w.axis === 'z' ? w.t + back : w.off + 0.6
      const y = P.groundY(x, z) + 0.2 + Math.abs(Math.sin(time * 7 + k)) * 0.06
      setI(dogs, k, x, y, z, w.axis === 'z' ? (w.dir > 0 ? 0 : Math.PI) : w.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
    })
    dogs.instanceMatrix.needsUpdate = true

    // 流浪猫：走走停停
    strayCats.forEach((c, k) => {
      c.rest -= dt
      if (c.rest < -3 - (k % 3)) c.rest = 2 + ((k * 7) % 5)
      if (c.rest < 0) {
        const nt = c.t + dt * 0.7 * c.dir
        const nx = c.axis === 'z' ? c.off : nt
        const nz = c.axis === 'z' ? nt : c.off
        if (nt < c.lo || nt > c.hi || blocked(nx, nz, 0.3)) c.dir *= -1
        else c.t = nt
      }
      const x = c.axis === 'z' ? c.off : c.t
      const z = c.axis === 'z' ? c.t : c.off
      const ry = (c.axis === 'z' ? (c.dir > 0 ? 0 : Math.PI) : c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + (c.rest > 0 ? Math.sin(time * 0.6 + c.ph) * 0.8 : 0)
      setI(strays, k, x, P.groundY(x, z) + 0.2, z, ry)
    })
    strays.instanceMatrix.needsUpdate = true

    // 鸟：绕群中心转圈，翅膀一开一合（翼展方向缩放）
    birdData.forEach((b, k) => {
      const a = time * 0.25 + b.a + (k % 4) * 1.6
      const x = b.f[0] + Math.cos(a) * b.r
      const z = b.f[1] + Math.sin(a) * b.r
      const flap = 0.3 + Math.abs(Math.sin(time * 8 + b.ph))
      q.setFromEuler(eul.set(0, -a, 0))
      pos.set(x, b.f[2] + b.dy + Math.sin(time + b.ph) * 1.2, z)
      sc.set(flap * 1.6, 1.6, 1.6)
      mtx.compose(pos, q, sc)
      birds.setMatrixAt(k, mtx)
    })
    birds.instanceMatrix.needsUpdate = true

    // 缆车
    for (let i = 0; i < cableCars.length; i++) {
      const c = cableCars[i]
      c.t = (c.t + dt * 0.035) % 1
      const k = i === 0 ? c.t : 1 - c.t
      const x = P.CABLE.base.x + 0
      const z = P.lerp(P.CABLE.base.z, P.CABLE.top.z, k)
      const y = P.lerp(P.CABLE.base.y + 11, P.CABLE.top.y + 11, k) - Math.sin(k * Math.PI) * 2
      c.m.position.set(x, y, z)
    }

    // 鸽子：玩家靠近就飞一圈
    const near = Math.hypot(player.x - FLOCK.x, player.z - FLOCK.z) < 16
    for (let i = 0; i < flock.length; i++) {
      const p = flock[i]
      if (near) {
        p.y = Math.min(9, p.y + dt * 5)
        p.a += dt * 1.4
        p.x += Math.cos(p.a) * dt * 4
        p.z += Math.sin(p.a) * dt * 4
      } else {
        p.y = Math.max(0, p.y - dt * 3)
        p.x += Math.cos(p.a) * dt * p.sp
        p.z += Math.sin(p.a) * dt * p.sp
        if (Math.hypot(p.x - FLOCK.x, p.z - FLOCK.z) > 12) p.a += Math.PI * 0.5
      }
      setI(pigeons, i, p.x, P.groundY(p.x, p.z) + 0.2 + p.y, p.z, -p.a, 1)
    }
    pigeons.instanceMatrix.needsUpdate = true

    // 猴子
    for (let i = 0; i < troop.length; i++) {
      const m = troop[i]
      m.a += Math.sin(time * 0.3 + m.hop) * dt * 0.6
      m.x += Math.cos(m.a) * dt * m.sp
      m.z += Math.sin(m.a) * dt * m.sp
      if (m.x < 20 || m.x > 130) m.a += Math.PI
      if (m.z < MK.z0 || m.z > MK.z1) m.a += Math.PI
      const y = P.groundY(m.x, m.z) + 0.1 + Math.abs(Math.sin(time * 3 + m.hop)) * 0.12
      setI(monkeys, i, m.x, y, m.z, -m.a, 1 + (i % 3) * 0.15)
    }
    monkeys.instanceMatrix.needsUpdate = true

    // 落叶
    for (let i = 0; i < leafN; i++) {
      const s = leafSeed[i]
      const y = P.groundY(s.x, s.z) + 2 + ((time * s.sp + s.t * 3) % 9)
      const sway = Math.sin(time * 0.9 + i) * 1.6
      leafPos[i * 3] = s.x + sway
      leafPos[i * 3 + 1] = y
      leafPos[i * 3 + 2] = s.z + Math.cos(time * 0.7 + i) * 1.2
    }
    leafGeo.attributes.position.needsUpdate = true
    leaves.visible = state.night

    // 雨：跟着玩家走，只在雨天气显示
    rain.visible = state.rainOn
    if (state.rainOn) {
      const arr = rainGeo.attributes.position.array
      for (let i = 0; i < rainN; i++) {
        const j = i * 6
        arr[j + 1] -= dt * 46
        arr[j + 4] -= dt * 46
        if (arr[j + 1] < 0) {
          const x = player.x + (rnd() - 0.5) * 160
          const z = player.z + (rnd() - 0.5) * 160
          const y = 60 + rnd() * 20
          arr[j] = x
          arr[j + 1] = y
          arr[j + 2] = z
          arr[j + 3] = x
          arr[j + 4] = y - 1.8
          arr[j + 5] = z
        }
      }
      rainGeo.attributes.position.needsUpdate = true
    }
  }

  return { update, wheel: ctx.wheel, state, monkeys, pigeons }
}
