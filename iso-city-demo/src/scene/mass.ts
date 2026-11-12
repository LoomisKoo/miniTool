import * as THREE from 'three'
import type { BuildingDef } from '../data/city'

/**
 * 楼体体量的几何约定，Building 与 FarCity 共用一份。
 *
 * 远景合批（FarCity）要把真楼换成一个简化壳子。壳子的轮廓如果和真楼
 * 不是同一个切角量、同一套开窗网格，150m 处换过去的瞬间整栋楼会"变形"：
 * 方角变切角、窗户换排列。所以切角、圆角、开窗内退量都从这里取。
 */

/** 切角量（c）与转角圆角半径（r）。c 会把过大的入参夹到短边的 42%。 */
export function cornerParams(w: number, d: number, chamfer: number) {
  const cw = w / 2
  const cd = d / 2
  const c = Math.max(0.4, Math.min(chamfer, Math.min(cw, cd) * 0.42))
  // 圆角切线长度不能超过最短边的一半，否则相邻圆角会叠在一起
  const r = Math.min(Math.max(Math.min(w, d) * 0.05, 0.35), 1.2, c * 0.45)
  return { c, r, cw, cd }
}

/** 平面轮廓：切角八边形，每个转角再倒一个圆角。 */
export function massOutline(w: number, d: number, chamfer: number) {
  const { c, cw, cd, r } = cornerParams(w, d, chamfer)
  const pts: Array<[number, number]> = [
    [-cw + c, -cd],
    [cw - c, -cd],
    [cw, -cd + c],
    [cw, cd - c],
    [cw - c, cd],
    [-cw + c, cd],
    [-cw, cd - c],
    [-cw, -cd + c],
  ]
  const shape = new THREE.Shape()
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const [px, pz] = pts[(i - 1 + n) % n]
    const [x, z] = pts[i]
    const [nx, nz] = pts[(i + 1) % n]
    const inLen = Math.hypot(x - px, z - pz)
    const outLen = Math.hypot(nx - x, nz - z)
    const t = Math.min(r, inLen * 0.45, outLen * 0.45)
    const ax = x - ((x - px) / inLen) * t
    const az = z - ((z - pz) / inLen) * t
    const bx = x + ((nx - x) / outLen) * t
    const bz = z + ((nz - z) / outLen) * t
    if (i === 0) shape.moveTo(ax, az)
    else shape.lineTo(ax, az)
    shape.quadraticCurveTo(x, z, bx, bz)
  }
  shape.closePath()
  return shape
}

/**
 * 立面开窗要离墙角多远（沿墙面量）。
 *
 * 以前这里写的是"切角量 + 0.5m"，漏了转角那个圆角：圆角在平直面上
 * 多吃掉 t = min(r, 0.45·边长, 0.45·c√2)，最多 0.636c。于是最边上那一列窗
 * 正好从平直面开始、伸进圆弧里——圆弧上的法线一转，`vertical` 判据就不满足，
 * 窗在这一段被直接切掉半扇。现在把圆角的吃进量算进去，窗列整体退到圆角切线以内。
 *
 * margin 是留给窗套的一点点余量。
 */
export function facadeInset(w: number, d: number, chamfer: number, margin = 0.35) {
  const { c, r } = cornerParams(w, d, chamfer)
  const bite = (span: number) =>
    Math.min(r, 0.45 * Math.max(0.2, span - 2 * c), 0.45 * c * Math.SQRT2)
  return c + Math.max(bite(w), bite(d)) + margin
}

/**
 * 简化体量：同一轮廓挤出的棱柱，不做倒角。
 * 远景壳子用这个——圆角、倒角在 150m 外都不到一个像素，但不做切角
 * 会让转角轮廓明显不一样。
 */
export function prismGeometry(w: number, d: number, h: number, chamfer: number) {
  const shape = massOutline(w, d, chamfer)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, h),
    steps: 1,
    curveSegments: 2,
    bevelEnabled: false,
  })
  geo.rotateX(-Math.PI / 2)
  return geo
}

/** 多层楼（≤ 这个高度）改用坡屋顶：俯视时一片深蓝坡顶是街区"有人住"的第一印象。 */
export const PITCHED_MAX_H = 30

export function isPitched(def: BuildingDef) {
  return (
    def.h <= PITCHED_MAX_H &&
    !def.setback &&
    !def.landmark &&
    (!def.form || def.form === 'rowhouse')
  )
}

/** 坡屋顶颜色：石板灰、陶瓦红、铜绿、深棕，联排小楼一户一种 */
export const ROOF_COLORS_NIGHT = ['#4d4642', '#5a3a32', '#3f5049', '#3e3a40']
export const ROOF_COLORS_DAY = ['#7a6d64', '#9a5a46', '#5f7a6c', '#5d5660']

/** 坡屋顶的挑檐，x / z 两个方向分开给（米）。
 *
 *  联排小楼和邻居共用一堵墙，那一侧的挑檐必须是 0：楼间距只有 0.3m，
 *  而挑檐是 0.55m，相邻两栋的屋顶会互相插进去 0.8m——一排楼看起来就是
 *  挤成一团、屋顶被邻居切开。共墙方向由朝向决定：朝东/西 ⇒ 一排楼沿 z 排开。
 *  其余建筑四面都有院子，四边挑檐一样。 */
export function roofOverhang(def: BuildingDef, eave = 0.55): [number, number] {
  if (def.form !== 'rowhouse') return [eave, eave]
  const rowAlongZ = def.facing === 'east' || def.facing === 'west'
  return rowAlongZ ? [eave, 0] : [0, eave]
}

/** 四坡屋顶：沿长边一条屋脊，两端是三角坡。平面法线，坡面之间是清楚的折线。
 *  ox / oz 是两个方向的挑檐（米），见 roofOverhang。 */
export function hipRoofGeometry(w: number, d: number, ox: number, oz = ox) {
  const along = w >= d
  // a 是"长边"方向的半跨、b 是短边方向，长边总是 x（w >= d 时）
  const ax = w / 2 + ox
  const az = d / 2 + oz
  const a = along ? ax : az
  const b = along ? az : ax
  const h = Math.min(b * 0.78, 6)
  const r = Math.max(0, a - b)
  const p = (x: number, y: number, z: number) => (along ? [x, y, z] : [z, y, x])
  const A = p(-a, 0, -b)
  const B = p(a, 0, -b)
  const C = p(a, 0, b)
  const D = p(-a, 0, b)
  const R1 = p(-r, h, 0)
  const R2 = p(r, h, 0)
  const tris = along
    ? [A, R1, R2, A, R2, B, D, C, R2, D, R2, R1, A, D, R1, B, R2, C]
    : [A, R2, R1, A, B, R2, D, R1, R2, D, R2, C, A, R1, D, B, C, R2]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3))
  geo.computeVertexNormals()
  // 绕序取决于 along 的镜像，任何一面朝下就整体翻过来
  const n = geo.getAttribute('normal')
  if (n.getY(0) < 0) {
    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i + 1)
      const y = pos.getY(i + 1)
      const z = pos.getZ(i + 1)
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2))
      pos.setXYZ(i + 2, x, y, z)
    }
    geo.computeVertexNormals()
  }
  return geo
}
