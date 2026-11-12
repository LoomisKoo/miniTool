// 高分辨率体素宠物：用简单形状「塑形」，按 1 格网格离散成体素，再出网格。
//
// 坐标约定（体素单位）：y 向上，地面 y=0，脸朝 +z。体素 (i,j,k) 占据
// [i,i+1]×[j,j+1]×[k,k+1]，取中心点 (i+.5, j+.5, k+.5) 判断是否在形状内。
//
// 颜色流程：体积层按顺序写占位和颜色 → 涂色层只改已占位的体素 → 自定义 paint
// → 脸部像素贴花（每列最靠前的体素）。最后每个体素带一点亮度抖动、每个顶点
// 带 AO，这两样让「一格一格的像素」在 3D 里看得出来。

import * as THREE from 'three'

export type Vec3 = [number, number, number]

export type Shape =
  /** p>2 是「超椭球」：越大越接近圆角方块，脸会更平，贴花不会被曲面扭歪 */
  | { kind: 'ellipsoid'; c: Vec3; r: Vec3; p?: number; rot?: Vec3; taper?: [number, number] }
  /** 折线胶囊，每个点一个半径：可以做弯尾巴、上粗下细的腿 */
  | { kind: 'capsule'; pts: Vec3[]; r: number[] }
  /** 有厚度的三角片：猫耳、狐狸耳 */
  | { kind: 'tri'; a: Vec3; b: Vec3; c: Vec3; t: number }
  | { kind: 'box'; min: Vec3; max: Vec3 }

/** smooth：不加毛边（口鼻、鼻头这类要干净的面） */
export type Layer = Shape & { color: string; paint?: boolean; smooth?: boolean }

export type Decal = {
  /** 第一行对应的体素 j */
  top: number
  /** 第一列对应的体素 i */
  left: number
  rows: string[]
  /** 每个基础格画几个贴花像素。2 = 贴花按 2x 分辨率画，五官更细 */
  res?: number
}

export type PartName = 'body' | 'head' | 'earL' | 'earR' | 'legFL' | 'legFR' | 'legBL' | 'legBR' | 'tail'

export type PartDef = {
  name: PartName
  /** 跟着哪个部件动（耳朵跟头）。子部件的 pivot 仍写绝对坐标 */
  parent?: PartName
  pivot: Vec3
  layers: Layer[]
  decal?: Decal
  paint?: (x: number, y: number, z: number, current: string) => string | undefined
}

export type Palette = Record<string, string>

export type Traits = Record<string, string | number | undefined>

/** 品种 = 调色板覆盖 + 特征组合。特征槽由物种模板自己定义，不同物种不通用 */
export type BreedDef = {
  id: string
  name: string
  /** 出现权重，默认 1 */
  weight?: number
  palette?: Partial<Palette>
  traits?: Traits
  /** 品种整体缩放：小香猪这类天生小一号的品种用 0.7 左右，缺省 1 */
  size?: number
}

export type VoxelBody = {
  parts: PartDef[]
  /** 毛边幅度（基础格）：表面随机鼓起一簇簇，做出毛茸茸的轮廓。只在高分辨率下生效 */
  fuzz?: number
}

/** 物种模板：按特征生成部件 */
export type VoxelDesign = {
  id: string
  palette: Palette
  breeds: BreedDef[]
  build: (traits: Traits) => VoxelBody
}

/** 贴花字符 → 调色板键 */
const DECAL_KEYS: Record<string, string> = {
  K: 'eye',
  W: 'shine',
  N: 'nose',
  M: 'mouth',
  P: 'blush',
  F: 'fur',
  D: 'fur2',
  B: 'belly',
  I: 'inner',
}

// ---------------------------------------------------------------------------
// 形状
// ---------------------------------------------------------------------------

function bounds(s: Shape): [Vec3, Vec3] {
  switch (s.kind) {
    case 'ellipsoid': {
      // taper 会在中间把截面放大到不超过 max(taper)，包围盒按最大的那个算
      const k = s.taper ? Math.max(s.taper[0], s.taper[1], 1) : 1
      const r: Vec3 = [s.r[0] * k, s.r[1], s.r[2] * k]
      if (s.rot) {
        const m = Math.max(r[0], r[1], r[2])
        return [
          [s.c[0] - m, s.c[1] - m, s.c[2] - m],
          [s.c[0] + m, s.c[1] + m, s.c[2] + m],
        ]
      }
      return [
        [s.c[0] - r[0], s.c[1] - r[1], s.c[2] - r[2]],
        [s.c[0] + r[0], s.c[1] + r[1], s.c[2] + r[2]],
      ]
    }
    case 'capsule': {
      const lo: Vec3 = [Infinity, Infinity, Infinity]
      const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
      s.pts.forEach((p, i) => {
        const r = s.r[Math.min(i, s.r.length - 1)]
        for (let a = 0; a < 3; a++) {
          lo[a] = Math.min(lo[a], p[a] - r)
          hi[a] = Math.max(hi[a], p[a] + r)
        }
      })
      return [lo, hi]
    }
    case 'tri': {
      const lo: Vec3 = [Infinity, Infinity, Infinity]
      const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
      for (const p of [s.a, s.b, s.c]) {
        for (let a = 0; a < 3; a++) {
          lo[a] = Math.min(lo[a], p[a] - s.t)
          hi[a] = Math.max(hi[a], p[a] + s.t)
        }
      }
      return [lo, hi]
    }
    case 'box':
      return [s.min, s.max]
  }
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

const inverse = new WeakMap<Shape, THREE.Matrix4>()
const _v = new THREE.Vector3()

/** 椭球局部坐标：有 rot 时先转回去 */
function local(s: Extract<Shape, { kind: 'ellipsoid' }>, p: Vec3): Vec3 {
  const d: Vec3 = [p[0] - s.c[0], p[1] - s.c[1], p[2] - s.c[2]]
  if (!s.rot) return d
  let m = inverse.get(s)
  if (!m) {
    m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...s.rot)).invert()
    inverse.set(s, m)
  }
  _v.set(d[0], d[1], d[2]).applyMatrix4(m)
  return [_v.x, _v.y, _v.z]
}

/** slack：边界外扩（正）或内缩（负）多少基础格，用来做毛边 */
function inside(s: Shape, p: Vec3, slack = 0): boolean {
  switch (s.kind) {
    case 'ellipsoid': {
      const e = s.p ?? 2
      const d = local(s, p)
      // taper：截面的宽 / 深随高度线性收窄。[底, 顶] 两个倍数，
      // 底部收窄就是「尖下巴的三角脸」，狐狸、猫都靠这个
      let rx = s.r[0]
      let rz = s.r[2]
      if (s.taper) {
        const t = Math.max(0, Math.min(1, (d[1] / s.r[1] + 1) * 0.5))
        const k = s.taper[0] + (s.taper[1] - s.taper[0]) * t
        rx *= k
        rz *= k
      }
      const x = Math.abs(d[0] / rx)
      const y = Math.abs(d[1] / s.r[1])
      const zs = d[2] / rz
      const z = Math.abs(zs)
      const v = (x ** e + y ** e + z ** e) ** (1 / e)
      // 正面（脸、胸口）不加毛边：贴花要落在平整的面上
      if (!slack || zs > 0.3 || v <= 1) return v <= 1
      // 用梯度把「v 超出 1 多少」换算成真实距离，细长的耳朵才不会被毛边撑长
      const g = v ** (1 - e) * Math.hypot(x ** (e - 1) / rx, y ** (e - 1) / s.r[1], z ** (e - 1) / rz)
      return v - 1 <= slack * g
    }
    case 'capsule': {
      for (let i = 0; i < s.pts.length - 1; i++) {
        const a = s.pts[i]
        const b = s.pts[i + 1]
        const ab = sub(b, a)
        const len2 = dot(ab, ab) || 1e-6
        const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2))
        const ra = s.r[Math.min(i, s.r.length - 1)]
        const rb = s.r[Math.min(i + 1, s.r.length - 1)]
        const r = ra + (rb - ra) * t + slack
        const d = sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])
        if (dot(d, d) <= r * r) return true
      }
      return s.pts.length === 1 && dot(sub(p, s.pts[0]), sub(p, s.pts[0])) <= (s.r[0] + slack) ** 2
    }
    case 'tri': {
      const e1 = sub(s.b, s.a)
      const e2 = sub(s.c, s.a)
      const n = cross(e1, e2)
      const nl = Math.hypot(n[0], n[1], n[2]) || 1e-6
      const nn: Vec3 = [n[0] / nl, n[1] / nl, n[2] / nl]
      const ap = sub(p, s.a)
      const d = dot(ap, nn)
      if (Math.abs(d) > s.t / 2) return false
      const q = sub(ap, [nn[0] * d, nn[1] * d, nn[2] * d])
      const d00 = dot(e1, e1)
      const d01 = dot(e1, e2)
      const d11 = dot(e2, e2)
      const d20 = dot(q, e1)
      const d21 = dot(q, e2)
      const den = d00 * d11 - d01 * d01 || 1e-6
      const v = (d11 * d20 - d01 * d21) / den
      const w = (d00 * d21 - d01 * d20) / den
      return v >= -0.02 && w >= -0.02 && v + w <= 1.02
    }
    case 'box':
      return p[0] >= s.min[0] && p[0] <= s.max[0] && p[1] >= s.min[1] && p[1] <= s.max[1] && p[2] >= s.min[2] && p[2] <= s.max[2]
  }
}

// ---------------------------------------------------------------------------
// 体素化
// ---------------------------------------------------------------------------

type Grid = {
  lo: Vec3
  size: Vec3
  cells: Int16Array // -1 = 空，否则是 keys 的下标
  keys: string[]
}

function voxelize(part: PartDef, res: number, fuzz: number, decal = part.decal): Grid {
  const lo: Vec3 = [Infinity, Infinity, Infinity]
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const layer of part.layers) {
    if (layer.paint) continue
    const [a, b] = bounds(layer)
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], Math.floor((a[i] - fuzz) * res) - 1)
      hi[i] = Math.max(hi[i], Math.ceil((b[i] + fuzz) * res) + 1)
    }
  }
  const size: Vec3 = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]
  const cells = new Int16Array(size[0] * size[1] * size[2]).fill(-1)
  const keys: string[] = []
  const keyIndex = (k: string) => {
    let i = keys.indexOf(k)
    if (i < 0) {
      keys.push(k)
      i = keys.length - 1
    }
    return i
  }
  const at = (i: number, j: number, k: number) => (i - lo[0]) + size[0] * ((j - lo[1]) + size[1] * (k - lo[2]))

  const pass = (paint: boolean) => {
    for (const layer of part.layers) {
      if (!!layer.paint !== paint) continue
      const [a0, b0] = bounds(layer)
      const f = paint || layer.smooth ? 0 : fuzz
      const a = a0.map((v) => v - f)
      const b = b0.map((v) => v + f)
      const ci = keyIndex(layer.color)
      for (let k = Math.max(lo[2], Math.floor(a[2] * res)); k < Math.min(hi[2], Math.ceil(b[2] * res)); k++) {
        for (let j = Math.max(lo[1], Math.floor(a[1] * res)); j < Math.min(hi[1], Math.ceil(b[1] * res)); j++) {
          for (let i = Math.max(lo[0], Math.floor(a[0] * res)); i < Math.min(hi[0], Math.ceil(b[0] * res)); i++) {
            // 毛边：平滑的低频起伏、只往外鼓。逐格白噪声会变成满身小坑（密集恐惧）
            // x 取绝对值：毛簇左右镜像，否则高毛量的动物会左右不对称
            const slack = f ? f * clumps(Math.abs((i + 0.5) / res), (j + 0.5) / res, (k + 0.5) / res) : 0
            if (!inside(layer, [(i + 0.5) / res, (j + 0.5) / res, (k + 0.5) / res], slack)) continue
            const idx = at(i, j, k)
            if (paint && cells[idx] < 0) continue
            cells[idx] = ci
          }
        }
      }
    }
  }
  pass(false)
  pass(true)

  if (part.paint) {
    for (let k = lo[2]; k < hi[2]; k++) {
      for (let j = lo[1]; j < hi[1]; j++) {
        for (let i = lo[0]; i < hi[0]; i++) {
          const idx = at(i, j, k)
          if (cells[idx] < 0) continue
          const next = part.paint((i + 0.5) / res, (j + 0.5) / res, (k + 0.5) / res, keys[cells[idx]])
          if (next) cells[idx] = keyIndex(next)
        }
      }
    }
  }

  if (decal) {
    // 贴花按「基础格」设计：高分辨率下每个贴花像素覆盖 res×res 个细格
    const { top, left, rows } = decal
    const dres = decal.res ?? 1
    for (let j = lo[1]; j < hi[1]; j++) {
      const row = rows[top - Math.floor(((j + 0.5) / res) * dres)]
      if (!row) continue
      for (let i = lo[0]; i < hi[0]; i++) {
        const key = DECAL_KEYS[row[Math.floor(((i + 0.5) / res) * dres) - left] ?? '.']
        if (!key) continue
        for (let k = hi[2] - 1; k >= lo[2]; k--) {
          const idx = at(i, j, k)
          if (cells[idx] >= 0) {
            cells[idx] = keyIndex(key)
            break
          }
        }
      }
    }
  }

  return { lo, size, cells, keys }
}

// ---------------------------------------------------------------------------
// 出网格：每个外露面一个四边形，顶点色 = 调色板色 × 体素抖动 × AO
// ---------------------------------------------------------------------------

const AO_LEVEL = [0.72, 0.82, 0.92, 1]

const CLUMP = 2.2

/** 三线性插值的值噪声，晶格 CLUMP 个基础格：一簇一簇的毛，0..1 */
function clumps(x: number, y: number, z: number) {
  const fx = x / CLUMP
  const fy = y / CLUMP
  const fz = z / CLUMP
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const z0 = Math.floor(fz)
  const tx = smooth(fx - x0)
  const ty = smooth(fy - y0)
  const tz = smooth(fz - z0)
  let v = 0
  for (let c = 0; c < 8; c++) {
    const dx = c & 1
    const dy = (c >> 1) & 1
    const dz = (c >> 2) & 1
    const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz)
    v += w * hash3(x0 + dx + 311, y0 + dy + 97, z0 + dz + 53)
  }
  return v
}

/** 给图纸用的值噪声（0..1）：三花猫的色块、斑点这类大块花纹 */
export function noise3(x: number, y: number, z: number, cell: number, seed: number) {
  return clumps((x + seed * 13.1) * (CLUMP / cell), (y + seed * 7.7) * (CLUMP / cell), (z + seed * 3.3) * (CLUMP / cell))
}

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

function hash3(i: number, j: number, k: number) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

type Occ = (i: number, j: number, k: number) => 0 | 1

/**
 * own：本部件占位，决定哪些面要画（部件会动，接缝处的面不能省）；
 * world：所有部件合在一起的占位，只用来算 AO，接缝处才会自然变暗。
 */
function mesh(grid: Grid, palette: Palette, pivot: Vec3, world: Occ, res: number) {
  const { lo, size, cells, keys } = grid
  // 只保留很轻的明暗差，避免高分辨率下表面发脏、发麻
  const jitterAmp = res > 1 ? 0.035 : 0.05
  const colors = keys.map((k) => new THREE.Color(palette[k] ?? '#ff00ff'))
  const occ = (i: number, j: number, k: number): 0 | 1 => {
    const x = i - lo[0]
    const y = j - lo[1]
    const z = k - lo[2]
    if (x < 0 || y < 0 || z < 0 || x >= size[0] || y >= size[1] || z >= size[2]) return 0
    return cells[x + size[0] * (y + size[1] * z)] >= 0 ? 1 : 0
  }

  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const c = new THREE.Color()

  for (let k = lo[2]; k < lo[2] + size[2]; k++) {
    for (let j = lo[1]; j < lo[1] + size[1]; j++) {
      for (let i = lo[0]; i < lo[0] + size[0]; i++) {
        const cell = cells[(i - lo[0]) + size[0] * ((j - lo[1]) + size[1] * (k - lo[2]))]
        if (cell < 0) continue
        const base = colors[cell]
        const jitter = 1 + (hash3(i, j, k) - 0.5) * jitterAmp
        const v: Vec3 = [i, j, k]

        for (let axis = 0; axis < 3; axis++) {
          for (const s of [1, -1]) {
            const n: Vec3 = [0, 0, 0]
            n[axis] = s
            if (occ(i + n[0], j + n[1], k + n[2])) continue
            const u = (axis + 1) % 3
            const w = (axis + 2) % 3
            const corners: [number, number][] = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]]
            const start = pos.length / 3
            const ao: number[] = []
            for (const [du, dw] of corners) {
              const p: Vec3 = [v[0], v[1], v[2]]
              if (s > 0) p[axis] += 1
              p[u] += du
              p[w] += dw
              pos.push(p[0] / res - pivot[0], p[1] / res - pivot[1], p[2] / res - pivot[2])
              nor.push(n[0], n[1], n[2])

              const o: Vec3 = [i + n[0], j + n[1], k + n[2]]
              const su = du ? 1 : -1
              const sw = dw ? 1 : -1
              const a1: Vec3 = [o[0], o[1], o[2]]
              a1[u] += su
              const a2: Vec3 = [o[0], o[1], o[2]]
              a2[w] += sw
              const a3: Vec3 = [o[0], o[1], o[2]]
              a3[u] += su
              a3[w] += sw
              const s1 = world(...a1)
              const s2 = world(...a2)
              const s3 = world(...a3)
              const level = s1 && s2 ? 0 : 3 - (s1 + s2 + s3)
              ao.push(level)
              c.copy(base).multiplyScalar(jitter * AO_LEVEL[level])
              col.push(c.r, c.g, c.b)
            }
            // 顺着 AO 较亮的对角线切三角形，避免明暗出现斜向接缝
            if (ao[0] + ao[2] >= ao[1] + ao[3]) {
              idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
            } else {
              idx.push(start + 1, start + 2, start + 3, start + 1, start + 3, start)
            }
          }
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeBoundingSphere()
  return geo
}

// ---------------------------------------------------------------------------

export type VoxelPart = {
  name: PartName
  parent?: PartName
  pivot: Vec3
  geometry: THREE.BufferGeometry
  /** 闭眼版本（只有带眼睛贴花的部件有） */
  blink?: THREE.BufferGeometry
}

/**
 * 从睁眼贴花自动推出闭眼贴花：眼睛（K/W）整块抹掉，用同一行左右最近的非眼睛
 * 像素补上（熊猫眼圈里补黑，其它补空），再在眼睛偏下的那一行画一条横线。
 */
function closedEyes(decal: Decal): Decal {
  const isEye = (ch: string) => ch === 'K' || ch === 'W'
  const rows = decal.rows.map((r) => [...r])
  const eyeRows = rows.map((r, i) => (r.some(isEye) ? i : -1)).filter((i) => i >= 0)
  if (!eyeRows.length) return decal
  const r0 = eyeRows[0]
  const r1 = eyeRows[eyeRows.length - 1]
  const line = r0 + Math.round((r1 - r0) * 0.65)
  const cols = new Set<number>()
  for (let r = r0; r <= r1; r++) {
    const row = rows[r]
    const src = decal.rows[r]
    for (let c = 0; c < row.length; c++) {
      if (!isEye(src[c])) continue
      cols.add(c)
      let fill = '.'
      for (let d = 1; d < row.length; d++) {
        const l = src[c - d]
        const rr = src[c + d]
        if (l !== undefined && !isEye(l)) {
          fill = l
          break
        }
        if (rr !== undefined && !isEye(rr)) {
          fill = rr
          break
        }
      }
      row[c] = fill
    }
  }
  for (const c of cols) rows[line][c] = 'K'
  return { ...decal, rows: rows.map((r) => r.join('')) }
}

export type VoxelPet = { parts: VoxelPart[]; height: number }

const cache = new Map<string, VoxelPet>()

const PRIORITY: Record<PartName, number> = { head: 0, earL: 1, earR: 1, body: 2, tail: 3, legFL: 4, legFR: 4, legBL: 4, legBR: 4 }

function forEachCell(g: Grid, fn: (i: number, j: number, k: number, idx: number) => void) {
  const { lo, size, cells } = g
  for (let k = 0; k < size[2]; k++) {
    for (let j = 0; j < size[1]; j++) {
      for (let i = 0; i < size[0]; i++) {
        const idx = i + size[0] * (j + size[1] * k)
        if (cells[idx] >= 0) fn(i + lo[0], j + lo[1], k + lo[2], idx)
      }
    }
  }
}

/** res：每个基础格切成几份。1 = 约 22 格高，2 = 约 44 格高 */
export function buildVoxelPet(design: VoxelDesign, breedId?: string, res = 1): VoxelPet {
  const key = `${design.id}/${breedId ?? ''}/${res}`
  const hit = cache.get(key)
  if (hit) return hit
  const breed = design.breeds.find((b) => b.id === breedId)
  const palette: Palette = { ...design.palette, ...(breed?.palette ?? {}) } as Palette
  // 部件之间有重叠。同一格只归一个部件（头 > 身体 > 尾巴 > 腿），否则两个
  // 部件在同一位置各画一个面，会 z-fighting 闪烁。
  const shape = design.build(breed?.traits ?? {})
  const defs = shape.parts
  // 毛边只留一点轮廓起伏：之前的高频毛簇会变成密集的小坑
  const fuzz = (shape.fuzz ?? 0) * Math.min(1, Math.max(0, res - 1)) * 0.3
  const grids = defs.map((part) => voxelize(part, res, fuzz))
  const order = defs.map((_, i) => i).sort((a, b) => PRIORITY[defs[a].name] - PRIORITY[defs[b].name])
  const owner = new Map<string, number>()
  for (const pi of order) {
    const g = grids[pi]
    forEachCell(g, (i, j, k, idx) => {
      const key = `${i},${j},${k}`
      if (owner.has(key)) g.cells[idx] = -1
      else owner.set(key, pi)
    })
  }
  const world: Occ = (i, j, k) => (owner.has(`${i},${j},${k}`) ? 1 : 0)

  let top = 0
  const parts = defs.map((part, pi) => {
    const grid = grids[pi]
    top = Math.max(top, (grid.lo[1] + grid.size[1]) / res)
    let blink: THREE.BufferGeometry | undefined
    if (part.decal && part.decal.rows.some((r) => r.includes('K'))) {
      // 头优先级最高，格子不会被别的部件抢走，直接重新体素化一份闭眼的
      blink = mesh(voxelize(part, res, fuzz, closedEyes(part.decal)), palette, part.pivot, world, res)
    }
    return { name: part.name, parent: part.parent, pivot: part.pivot, geometry: mesh(grid, palette, part.pivot, world, res), blink }
  })
  const pet = { parts, height: top }
  cache.set(key, pet)
  return pet
}

/** 共用材质：顶点色 + 偏哑光 */
let material: THREE.MeshStandardMaterial | null = null
export function voxelMaterial() {
  if (!material) material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 })
  return material
}

// ---------------------------------------------------------------------------
// 动作：每个部件绕自己的 pivot 转，身体整体上下弹
// ---------------------------------------------------------------------------

export type PetMotion = 'idle' | 'walk'

export type PartPose = { rx: number; ry: number; rz: number; dy: number; sy?: number }

export function posePart(name: PartName, motion: PetMotion, t: number): PartPose {
  const walk = motion === 'walk'
  const f = walk ? 9 : 2
  const swing = walk ? 0.55 : 0
  const bob = walk ? Math.abs(Math.sin(t * f)) * 0.7 : Math.sin(t * 1.6) * 0.18
  switch (name) {
    case 'legFL':
    case 'legBR':
      return { rx: Math.sin(t * f) * swing, ry: 0, rz: 0, dy: 0 }
    case 'legFR':
    case 'legBL':
      return { rx: -Math.sin(t * f) * swing, ry: 0, rz: 0, dy: 0 }
    case 'head':
      return {
        rx: walk ? Math.sin(t * f * 2) * 0.04 : Math.sin(t * 0.7) * 0.05,
        ry: walk ? 0 : Math.sin(t * 0.45) * 0.22,
        rz: walk ? Math.sin(t * f) * 0.05 : Math.sin(t * 0.9 + 1) * 0.06,
        dy: bob,
      }
    case 'tail':
      return { rx: 0, ry: Math.sin(t * (walk ? 12 : 4)) * (walk ? 0.45 : 0.3), rz: 0, dy: bob }
    case 'earL':
    case 'earR': {
      // 每隔几秒快速抖一下，左右耳错开
      const side = name === 'earR' ? 1 : -1
      const cyc = (t * 0.27 + (side > 0 ? 0 : 0.43)) % 1
      const twitch = cyc < 0.05 ? Math.sin((cyc / 0.05) * Math.PI) : 0
      return { rx: walk ? -Math.abs(Math.sin(t * f)) * 0.12 : 0, ry: 0, rz: -side * twitch * 0.4, dy: 0 }
    }
    case 'body':
      // 呼吸 / 落地时的轻微压扁
      return {
        rx: 0,
        ry: 0,
        rz: walk ? Math.sin(t * f) * 0.03 : 0,
        dy: bob,
        sy: walk ? 1 - (1 - Math.abs(Math.sin(t * f))) * 0.06 : 1 + Math.sin(t * 1.6) * 0.025,
      }
  }
}

/** 眨眼：每 3~5 秒闭眼 0.13 秒，phase 让每只错开 */
export function isBlinking(t: number, phase: number) {
  const period = 3.4 + (phase % 1.7)
  return (t + phase * 3.1) % period < 0.13
}
