// 体素宠物图纸：每个物种一个模板，品种 = 调色板 + 特征组合。
//
// 比例不是写实，也不是「头下面直接接脚」的极短身子：
// 全高大致 = 头 4 : 身体 3 : 腿 2，身体长度 ≈ 1.5 个头宽。
// 图纸先写紧凑的骨架（方便对齐脸和耳朵），再用 stance() 统一抬高身体、拉长腿。
// 每个物种最好认的特征必须保留，而且要靠**轮廓**表达，不是靠五官大小：
// 狐狸的尖下巴三角脸、猫的尖耳、狗的耷拉耳、熊猫的黑眼圈和黑四肢、
// 兔子的长耳和团子尾。只换颜色的「品种」认不出来。
//
// 特征槽按物种定义、互不通用。新增品种 = 在 breeds 里加一行（换色 + 选特征）；
// 新增特征 = 在模板里加一个分支。
//
// 脸用像素贴花画（2x 分辨率，半格一个像素），投到头部每列最靠前的那一格。
// K 眼睛 W 高光 N 鼻子 M 嘴 P 腮红 D 副色 B 肚皮 I 耳内

import { noise3, type Decal, type Layer, type PartDef, type Traits, type Vec3, type VoxelDesign } from './build'

const BASE_PALETTE = {
  eye: '#2a2230',
  shine: '#ffffff',
  nose: '#3a2a2e',
  mouth: '#4a3236',
  blush: '#f59aa6',
  inner: '#f4a7b2',
}

const ell = (c: Vec3, r: Vec3, color = 'fur', paint = false): Layer => ({ kind: 'ellipsoid', c, r, color, paint })
const rotEll = (c: Vec3, r: Vec3, rot: Vec3, color = 'fur', paint = false): Layer => ({ kind: 'ellipsoid', c, r, rot, color, paint })
const cap = (pts: Vec3[], r: number[], color = 'fur', paint = false): Layer => ({ kind: 'capsule', pts, r, color, paint })
const tri = (a: Vec3, b: Vec3, c: Vec3, t: number, color = 'fur', paint = false): Layer => ({ kind: 'tri', a, b, c, t, color, paint })
/**
 * 头：opt.p 越大正脸越平（贴花不会被曲面扭歪）；opt.taper 是 [下巴, 头顶]
 * 的截面倍数，小于 1 就收成尖下巴的三角脸——狐狸那种「一眼认出来」的轮廓
 * 主要靠这个，而不是靠五官大小。
 */
const head = (c: Vec3, r: Vec3, opt?: { p?: number; taper?: [number, number] }): Layer => ({
  kind: 'ellipsoid',
  c,
  r,
  p: opt?.p ?? 3.2,
  taper: opt?.taper,
  color: 'fur',
})
const body = (c: Vec3, r: Vec3): Layer => ({ kind: 'ellipsoid', c, r, p: 2.1, color: 'fur' })
/**
 * 口鼻块：脸的第二层。正面是平的（超椭球），往后埋进头里，只露出 depth 格。
 * front = 头正脸所在的 z。
 */
const muzzle = (x: number, y: number, front: number, w: number, h: number, depth: number, color = 'muzzle'): Layer => {
  const rz = depth + 2
  return { kind: 'ellipsoid', c: [x, y, front + depth - rz], r: [w, h, rz], p: 3, color, smooth: true }
}
/**
 * 头部在某个高度上的正脸 z。头一收窄（taper），正脸就往后走，
 * 口鼻块必须贴着这个面放，否则会浮在脸前面。
 */
function faceFront(c: Vec3, r: Vec3, p: number, taper: [number, number] | undefined, y: number) {
  const dy = (y - c[1]) / r[1]
  const k = taper ? taper[0] + (taper[1] - taper[0]) * Math.max(0, Math.min(1, (dy + 1) * 0.5)) : 1
  const a = Math.abs(dy)
  if (a >= 1) return c[2]
  return c[2] + r[2] * k * (1 - a ** p) ** (1 / p)
}
/** 猫、兔子的 ω 形双鼓包 */
const cheeks = (y: number, front: number, w = 1.9, depth = 0.95, color = 'muzzle'): Layer[] => [
  muzzle(1.3, y, front, w, 1.5, depth, color),
  muzzle(-1.3, y, front, w, 1.5, depth, color),
]
/**
 * 2x 分辨率的对称脸：只画左半边（列 = -宽..-1），自动镜像出右半边。
 * top 是第一行的 y（以半格为单位，y=30 即基础格 15）。
 */
const sym = (top: number, half: string[]): Decal => ({
  top,
  left: -half[0].length,
  res: 2,
  rows: half.map((h) => h + [...h].reverse().join('')),
})

/** 镜像 x：左右对称的零件只写一边 */
const mx = (p: Vec3): Vec3 => [-p[0], p[1], p[2]]
const side = (s: 1 | -1) => (s === 1 ? (p: Vec3) => p : mx)

type LegSpec = { x: number; front: number; back: number; top: number; r: number; color?: string; paw?: string; smooth?: boolean }

function legs(spec: LegSpec): PartDef[] {
  const make = (name: PartDef['name'], x: number, z: number): PartDef => {
    const top: Vec3 = [x, spec.top, z]
    const r = spec.r
    const layers: Layer[] = [{ ...cap([top, [x, r - 0.2, z]], [r, r], spec.color ?? 'fur'), smooth: spec.smooth }]
    if (spec.paw) layers.push({ kind: 'box', min: [x - r - 1, -1, z - r - 1], max: [x + r + 1, 1.6, z + r + 1], color: spec.paw, paint: true })
    return { name, pivot: top, layers }
  }
  return [make('legFL', -spec.x, spec.front), make('legFR', spec.x, spec.front), make('legBL', -spec.x, spec.back), make('legBR', spec.x, spec.back)]
}

type Map3 = (p: Vec3) => Vec3

/**
 * 逐点变换一个部件。rs 是半径缩放（胶囊和三角片厚度用 rs[0]）。
 * 花纹函数收到的仍是变换前的坐标，所以各品种的花纹阈值不用跟着改。
 * 贴花只支持纵向平移 decalDy。
 */
function xform(part: PartDef, fwd: Map3, inv: Map3, rs: Vec3 = [1, 1, 1], decalDy = 0): PartDef {
  const layers = part.layers.map((l): Layer => {
    switch (l.kind) {
      case 'ellipsoid':
        return { ...l, c: fwd(l.c), r: [l.r[0] * rs[0], l.r[1] * rs[1], l.r[2] * rs[2]] }
      case 'capsule':
        return { ...l, pts: l.pts.map(fwd), r: l.r.map((r) => r * rs[0]) }
      case 'tri':
        return { ...l, a: fwd(l.a), b: fwd(l.b), c: fwd(l.c), t: l.t * rs[0] }
      case 'box': {
        // 盒子按自身中心缩放（脚掌跟着腿一起变粗）
        const cx = (l.min[0] + l.max[0]) / 2
        const cy = (l.min[1] + l.max[1]) / 2
        const cz = (l.min[2] + l.max[2]) / 2
        const s = (lo: Vec3, hi: Vec3): [Vec3, Vec3] => [
          fwd([cx + (lo[0] - cx) * rs[0], cy + (lo[1] - cy) * rs[1], cz + (lo[2] - cz) * rs[2]]),
          fwd([cx + (hi[0] - cx) * rs[0], cy + (hi[1] - cy) * rs[1], cz + (hi[2] - cz) * rs[2]]),
        ]
        const [min, max] = s(l.min, l.max)
        return { ...l, min, max }
      }
    }
  })
  const paint = part.paint
  return {
    ...part,
    pivot: fwd(part.pivot),
    layers,
    decal: part.decal && { ...part.decal, top: part.decal.top + Math.round(decalDy * (part.decal.res ?? 1)) },
    paint:
      paint &&
      ((x, y, z, cur) => {
        const p = inv([x, y, z])
        return paint(p[0], p[1], p[2], cur)
      }),
  }
}

const translate = (part: PartDef, d: Vec3): PartDef =>
  xform(part, (p) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]], (p) => [p[0] - d[0], p[1] - d[1], p[2] - d[2]], [1, 1, 1], d[1])

/**
 * 绕部件 pivot 的 x 轴旋转（a<0 = 上端往后仰）。耳朵是薄片，侧面看完全竖直
 * 会像一根棍子，真实动物的耳朵多少都往后仰一点。
 * 椭球的 rot 是 XYZ 欧拉角（矩阵 = Rx·Ry·Rz），左乘 Rx 正好等于 x 角相加。
 */
function tiltX(part: PartDef, a: number): PartDef {
  const [, py, pz] = part.pivot
  const c = Math.cos(a)
  const s = Math.sin(a)
  const fwd: Map3 = (p) => [p[0], py + (p[1] - py) * c - (p[2] - pz) * s, pz + (p[1] - py) * s + (p[2] - pz) * c]
  const inv: Map3 = (p) => [p[0], py + (p[1] - py) * c + (p[2] - pz) * s, pz - (p[1] - py) * s + (p[2] - pz) * c]
  const out = xform(part, fwd, inv)
  out.layers = out.layers.map((l) => (l.kind === 'ellipsoid' ? { ...l, rot: [(l.rot?.[0] ?? 0) + a, l.rot?.[1] ?? 0, l.rot?.[2] ?? 0] } : l))
  return out
}

/** 整体上下平移（短腿品种把身体、头、尾巴一起往下放） */
const shiftY = (part: PartDef, dy: number) => translate(part, [0, dy, 0])

/**
 * Q 版比例：图纸先按紧凑的骨架写，再在这里微调成头大、身短、腿短的玩偶比例。
 *   lift   腿加长几格（身体、头、尾巴一起抬高），一般 0.6~1.5；再高腿就细长了
 *   body   身体缩放 [宽, 高, 长]，以胸口为锚点，只往后长
 *   legR   腿粗缩放。腿直径 ≈ 头宽的 1/4 最好看：再粗左右腿会连成一整块
 *   tail   尾巴长度缩放（以尾根为原点），tailR 尾巴粗细缩放
 *   neck   头在跟随身体之外再抬高 / 前移多少（脖子）。身体越高越要抬高，
 *          否则头会陷进胸腔里，侧面就只剩一团
 *
 * 比例的黄金线：腿长 ≈ 身高的 25%、身体高度 ≈ 30%、头 ≈ 40%。
 * 之前头占了 60%（还陷进身体里），所以整只看起来像「头下面直接是脚」。
 */
type Stance = { lift: number; body?: Vec3; legR?: number; tail?: number; tailR?: number; neck?: [number, number] }

function stance(parts: PartDef[], s: Stance): PartDef[] {
  const main = parts.find((p) => p.name === 'body')?.layers[0]
  if (!main || main.kind !== 'ellipsoid') return parts
  const [sx, sy, sz] = s.body ?? [1, 1, 1]
  const lift = s.lift
  const ay = main.c[1]
  const az = main.c[2] + main.r[2]
  const bodyFwd: Map3 = (p) => [p[0] * sx, ay + (p[1] - ay) * sy + lift, az + (p[2] - az) * sz]
  const bodyInv: Map3 = (p) => [p[0] / sx, ay + (p[1] - lift - ay) / sy, az + (p[2] - az) / sz]
  const [neckY, neckZ] = s.neck ?? [0, 0]
  const headD: Vec3 = [0, lift + main.r[1] * (sy - 1) + neckY, neckZ]
  const legR = s.legR ?? 1

  return parts.map((part) => {
    if (part.name === 'head' || part.parent === 'head') return translate(part, headD)
    if (part.name.startsWith('leg')) {
      // 只拉长腿的上段，脚掌（y<2）和脚掌配色框保持在地面
      const k = (part.pivot[1] + lift) / part.pivot[1]
      return xform(
        part,
        (p) => [p[0] * sx, p[1] > 2 ? p[1] * k : p[1], az + (p[2] - az) * sz],
        (p) => [p[0] / sx, p[1] > 2 * k ? p[1] / k : p[1], az + (p[2] - az) / sz],
        [legR, 1, legR],
      )
    }
    if (part.name === 'tail') {
      const o = part.pivot
      const n = bodyFwd(o)
      const k = s.tail ?? 1
      const r = s.tailR ?? 1
      return xform(
        part,
        (p) => [n[0] + (p[0] - o[0]) * k, n[1] + (p[1] - o[1]) * k, n[2] + (p[2] - o[2]) * k],
        (p) => [o[0] + (p[0] - n[0]) / k, o[1] + (p[1] - n[1]) / k, o[2] + (p[2] - n[2]) / k],
        [r, r, r],
      )
    }
    return xform(part, bodyFwd, bodyInv, [sx, sy, sz])
  })
}

const str = (t: Traits, key: string, fallback: string) => (typeof t[key] === 'string' ? (t[key] as string) : fallback)
const num = (t: Traits, key: string, fallback: number) => (typeof t[key] === 'number' ? (t[key] as number) : fallback)

// 眼睛约 2×2 基础格（脸宽 13 格的 15%~20%），带一格白高光。
// 之前放到 3×3 反而像熊猫、抢掉了头型的信息，所以收回来。
// 贴花 2x 分辨率，一格 = 半个基础格。
const EYES = [
  '.....KKK.....',
  '....KWKK.....',
  '....KKKK.....',
  '.....KKK.....',
]

type PaintTarget = 'head' | 'body' | 'tail' | 'ear'

// ===========================================================================
// 猫
//   ears:    pointed 普通尖耳 | large 大耳外展（暹罗）| tufted 耳尖簇毛（缅因）
//            | small 小圆耳（英短）| low 低位小耳（波斯）| folded 折耳
//   face:    normal | round 大圆脸 | flat 扁脸（波斯）| wedge 楔形脸（暹罗）
//   frame:   normal | cobby 矮胖 | slender 修长 | large 大骨架
//   tail:    long | thin 细长 | fluffy 蓬尾 | plume 羽状大尾
//   ruff:    1 = 胸前毛领（长毛猫）
//   fur:     毛边幅度，短毛 0.3~0.55，长毛 0.9~1.05
//   pattern: plain | tabby 虎斑 | calico 三花 | tuxedo 奶牛 | point 重点色
//            | ragdoll 布偶双色 | rosette 玫瑰斑（孟加拉）
// ===========================================================================

function catEar(kind: string, s: 1 | -1): PartDef {
  const f = side(s)
  const name = s === 1 ? 'earR' : 'earL'
  switch (kind) {
    case 'folded':
      // 折耳：一小片向前扣在头顶
      return {
        name,
        parent: 'head',
        pivot: f([3.4, 17.0, 1.0]),
        layers: [rotEll(f([3.5, 17.6, 1.8]), [2.0, 1.1, 1.7], [0.55, 0, -s * 0.2])],
      }
    case 'small':
      return {
        name,
        parent: 'head',
        pivot: f([4.2, 16.0, 0.6]),
        layers: [
          tri(f([2.7, 16.4, 0.6]), f([6.8, 15.0, 0.6]), f([5.9, 21.2, 0.5]), 2.6),
          tri(f([3.6, 16.5, 1.7]), f([6.0, 15.7, 1.7]), f([5.7, 19.8, 1.6]), 1.1, 'inner', true),
        ],
      }
    case 'low':
      // 波斯：耳朵小、位置低、向两侧分开，大半埋在长毛里
      return {
        name,
        parent: 'head',
        pivot: f([5.0, 15.2, 0.6]),
        layers: [
          tri(f([3.0, 16.4, 0.6]), f([7.6, 14.2, 0.6]), f([7.8, 21.6, 0.5]), 2.6),
          ell(f([7.6, 21.0, 0.5]), [0.8, 0.8, 1.1]),
          tri(f([4.0, 16.3, 1.7]), f([6.9, 15.0, 1.7]), f([7.2, 20.2, 1.6]), 1.1, 'inner', true),
        ],
      }
    case 'large':
      // 暹罗：耳大、耳根宽、明显向外撇，和楔形脸连成一个三角
      return {
        name,
        parent: 'head',
        pivot: f([4.2, 15.6, 0.6]),
        layers: [
          tri(f([1.9, 16.4, 0.6]), f([6.8, 14.2, 0.6]), f([7.8, 24.2, 0.4]), 2.5),
          tri(f([3.0, 16.5, 1.7]), f([6.1, 15.2, 1.7]), f([7.2, 22.2, 1.6]), 1.1, 'inner', true),
        ],
      }
    case 'tufted':
      // 缅因：耳朵高大，耳内是浅色饰毛，耳尖立着一撮深色猞猁簇毛
      return {
        name,
        parent: 'head',
        pivot: f([4.1, 16.0, 0.6]),
        layers: [
          tri(f([1.9, 16.6, 0.5]), f([6.8, 15.0, 0.5]), f([5.8, 24.4, 0.2]), 2.5),
          tri(f([3.0, 16.9, 1.7]), f([6.0, 15.9, 1.7]), f([5.4, 22.6, 1.5]), 1.1, 'inner', true),
          tri(f([5.2, 23.6, 0.3]), f([6.2, 23.4, 0.3]), f([6.1, 27.0, 0.3]), 1.0, 'tuft'),
        ],
      }
    default:
      return {
        name,
        parent: 'head',
        pivot: f([4.3, 15.9, 0.6]),
        layers: [
          tri(f([1.9, 16.5, 0.6]), f([7.0, 15.1, 0.6]), f([6.0, 23.2, 0.4]), 2.8),
          tri(f([3.2, 16.8, 1.7]), f([6.0, 16.0, 1.7]), f([5.6, 21.0, 1.6]), 1.1, 'inner', true),
        ],
      }
  }
}

function catPaint(pattern: string, target: PaintTarget): PartDef['paint'] {
  return (x, y, z, cur) => {
    if (cur !== 'fur') return undefined
    switch (pattern) {
      case 'tabby':
        if (target === 'head') return y > 16 && y < 18.6 && z > 1.5 && Math.abs(x) < 2.6 && Math.floor(x + 10) % 2 === 1 ? 'fur2' : undefined
        if (target === 'body') return y > 7.4 && Math.floor((z + 20) / 1.1) % 2 === 0 ? 'fur2' : undefined
        if (target === 'tail') return Math.floor((y - z * 0.4 + 20) / 1.6) % 2 === 0 ? 'fur2' : undefined
        return undefined
      case 'calico': {
        if (target === 'head' && y < 15) return undefined
        if (target === 'body' && y < 6.6) return undefined
        const n = noise3(x, y, z, 2.6, target === 'head' ? 11 : target === 'body' ? 23 : target === 'tail' ? 37 : 5)
        return n < 0.38 ? 'fur2' : n > 0.62 ? 'fur3' : undefined
      }
      case 'tuxedo':
        if (target === 'head') return z > 2 && (y < 12.2 || (Math.abs(x) < 1.2 && y < 15.6 && z > 3)) ? 'belly' : undefined
        return undefined
      case 'point':
        if (target === 'ear' || target === 'tail') return 'point'
        if (target === 'head') return z > 3 && Math.hypot(x / 4.4, (y - 11.8) / 3.6) < 1 ? 'point' : undefined
        return undefined
      case 'ragdoll': {
        // 布偶双色：眼周深色面罩，额头到口鼻一道白色倒 V
        if (target === 'ear' || target === 'tail') return 'point'
        if (target !== 'head' || z < 2) return undefined
        const whiteV = y < 15.6 && Math.abs(x) < (15.6 - y) * 0.62
        return !whiteV && y > 11.4 && y < 16.8 ? 'point' : undefined
      }
      case 'rosette': {
        // 孟加拉：深色斑点带一圈中间色，而不是条纹
        if (target === 'ear') return undefined
        if (target === 'head' && (y < 14.6 || z > 5)) return undefined
        if (target === 'body' && y < 5.4) return undefined
        const n = noise3(x, y, z, 1.4, target === 'head' ? 3 : target === 'body' ? 17 : 29)
        return n < 0.27 ? 'fur2' : n < 0.35 ? 'fur3' : undefined
      }
    }
    return undefined
  }
}

// 眼睛 + 腮红 + 小鼻子 + 一个很小的 ω 嘴
const CAT_FACE = sym(30, [...EYES, '.............', '....PP.......', '....PP.......', '...........NN', '..........M..', '...........M.'])
/** 扁脸：鼻子紧贴在两眼之间的下方 */
const PERSIAN_FACE = sym(30, [...EYES, '....PP.......', '....PP.......', '..........NNN', '...........NN', '..........M..', '...........M.'])

const cat: VoxelDesign = {
  id: 'cat',
  palette: {
    ...BASE_PALETTE,
    fur: '#a7a9b8',
    fur2: '#7d7f92',
    fur3: '#3a3437',
    belly: '#f4f1ec',
    muzzle: '#f4f1ec',
    paw: '#f4f1ec',
    point: '#4e3a31',
    tuft: '#3a2f2a',
    nose: '#f08a9a',
  },
  breeds: [
    { id: 'cat-tabby', name: '狸花猫', weight: 3, traits: { pattern: 'tabby' }, palette: { fur: '#9c8466', fur2: '#4f3f30', belly: '#efe6d6', muzzle: '#efe6d6', paw: '#efe6d6', eye: '#4f7d22' } },
    { id: 'cat-orange', name: '橘猫', weight: 3, traits: { pattern: 'tabby' }, palette: { fur: '#f0a04b', fur2: '#cc6f24', belly: '#fff3e2', muzzle: '#fff3e2', paw: '#fff3e2' } },
    {
      id: 'cat-bsh',
      name: '英短蓝猫',
      weight: 2,
      traits: { ears: 'small', face: 'round', frame: 'cobby', fur: 0.35 },
      palette: { fur: '#8f98a8', belly: '#8f98a8', muzzle: '#9aa3b2', paw: '#8f98a8', inner: '#b9a7ae', eye: '#d88a1c', nose: '#6f6878' },
    },
    { id: 'cat-calico', name: '三花猫', weight: 2, traits: { pattern: 'calico' }, palette: { fur: '#f6f2ea', fur2: '#e8913f', fur3: '#3a3437', belly: '#fbf8f2', muzzle: '#fbf8f2', paw: '#fbf8f2' } },
    { id: 'cat-tuxedo', name: '奶牛猫', weight: 2, traits: { pattern: 'tuxedo' }, palette: { fur: '#2f2b31', belly: '#f7f4ee', muzzle: '#f7f4ee', paw: '#f7f4ee', eye: '#d9a91f', shine: '#fff8cc' } },
    {
      id: 'cat-siamese',
      name: '暹罗猫',
      weight: 1,
      traits: { pattern: 'point', ears: 'large', face: 'wedge', frame: 'slender', tail: 'thin', fur: 0.3 },
      palette: { fur: '#efe2cc', point: '#4e3a31', belly: '#f3e9d8', muzzle: '#4e3a31', paw: '#4e3a31', inner: '#c79a8c', eye: '#2f86d6', nose: '#3a2a2e' },
    },
    {
      id: 'cat-ragdoll',
      name: '布偶猫',
      weight: 1,
      traits: { pattern: 'ragdoll', face: 'round', frame: 'large', tail: 'plume', ruff: 1, fur: 0.95 },
      palette: { fur: '#f5eee3', point: '#6f5a4e', belly: '#ffffff', muzzle: '#ffffff', paw: '#ffffff', inner: '#d9b7ae', eye: '#2f86d6' },
    },
    { id: 'cat-fold', name: '折耳猫', weight: 1, traits: { ears: 'folded', face: 'round', frame: 'cobby', pattern: 'tabby' }, palette: { fur: '#bdbab4', fur2: '#6d6a66', belly: '#f2f0ec', muzzle: '#f2f0ec', paw: '#f2f0ec', eye: '#c98d22' } },
    { id: 'cat-black', name: '黑猫', weight: 1, palette: { fur: '#34303a', belly: '#34303a', muzzle: '#3e3a44', paw: '#34303a', eye: '#e2bf1e', shine: '#fff8cc', nose: '#4a3a44' } },
    { id: 'cat-white', name: '白猫', weight: 1, palette: { fur: '#f6f3ee', belly: '#ffffff', muzzle: '#ffffff', paw: '#ffffff', eye: '#3f8fd8' } },
    {
      id: 'cat-mainecoon',
      name: '缅因猫',
      weight: 1,
      traits: { ears: 'tufted', frame: 'large', tail: 'plume', ruff: 1, pattern: 'tabby', fur: 0.9 },
      palette: { fur: '#8a6a4c', fur2: '#3e2c20', belly: '#efe4d4', muzzle: '#efe4d4', paw: '#efe4d4', inner: '#eadccb', tuft: '#3a2a20', eye: '#c9a23a' },
    },
    {
      id: 'cat-persian',
      name: '波斯猫',
      weight: 1,
      traits: { ears: 'low', face: 'flat', frame: 'cobby', tail: 'fluffy', ruff: 1, fur: 0.85 },
      palette: { fur: '#f1e8dc', belly: '#fffaf2', muzzle: '#fffaf2', paw: '#fffaf2', inner: '#e8c4bd', eye: '#d8902a' },
    },
    {
      id: 'cat-bengal',
      name: '孟加拉猫',
      weight: 1,
      traits: { pattern: 'rosette', ears: 'small', frame: 'slender', fur: 0.3 },
      palette: { fur: '#d99a50', fur2: '#4a2c1e', fur3: '#8a5a34', belly: '#f3d7ad', muzzle: '#f3d7ad', paw: '#f3d7ad', eye: '#6f9a2a' },
    },
  ],
  build: (t) => {
    const pattern = str(t, 'pattern', 'plain')
    const face = str(t, 'face', 'normal')
    const frame = str(t, 'frame', 'normal')
    const tail = str(t, 'tail', 'long')
    const earKind = str(t, 'ears', 'pointed')

    // 猫脸是「略收下巴的圆脸」：taper 只收一点，太尖就成了狐狸
    const headP = 3.2
    const taper: [number, number] =
      face === 'wedge' ? [0.52, 1] : face === 'round' || face === 'flat' ? [0.82, 1] : [0.66, 1]
    const headR: Vec3 = face === 'round' || face === 'flat' ? [7.2, 5.6, 5.2] : face === 'wedge' ? [5.9, 5.8, 4.9] : [6.6, 5.6, 5.2]
    const headC: Vec3 = [0, 13, 1.4]
    const muzzleY = face === 'flat' ? 10.9 : 10.6
    const headLayers: Layer[] = [
      head(headC, headR, { p: headP, taper }),
      ...(face === 'flat'
        ? cheeks(muzzleY, faceFront(headC, headR, headP, taper, muzzleY), 2.3, 0.4)
        : cheeks(
            muzzleY,
            faceFront(headC, headR, headP, taper, muzzleY),
            face === 'round' ? 2.4 : face === 'wedge' ? 1.6 : 1.9,
            face === 'wedge' ? 0.8 : 0.9,
          )),
    ]
    if (num(t, 'ruff', 0) > 0) headLayers.push(ell([0, 9.0, 2.6], [5.0, 2.4, 2.2], 'belly'))

    const bodyR: Vec3 =
      frame === 'cobby'
        ? [5.0, 4.4, 6.8]
        : frame === 'slender'
          ? [4.2, 4.0, 7.6]
          : frame === 'large'
            ? [5.2, 4.5, 8.0]
            : [4.8, 4.2, 7.4]
    // 胸口固定在 z≈3.6：身体变长只往后长，头的位置不变
    const bodyZ = 3.6 - bodyR[2]
    const legR = frame === 'cobby' || frame === 'large' ? 1.5 : frame === 'slender' ? 1.32 : 1.42
    const z0 = bodyZ - bodyR[2] + 0.4

    const tailPath: Vec3[] =
      tail === 'plume'
        ? [[0, 6.6, z0], [0, 8.0, z0 - 3.0], [0, 11.4, z0 - 4.6], [0.6, 14.6, z0 - 4.0]]
        : [[0, 6.5, z0], [0, 8.5, z0 - 2.6], [0, 12, z0 - 3.4], [0.6, 14.2, z0 - 2.6]]
    const tailR =
      tail === 'plume' ? [1.6, 2.3, 2.4, 2.0] : tail === 'fluffy' ? [1.8, 1.9, 1.9, 1.7] : tail === 'thin' ? [1.0, 0.95, 0.9, 0.8] : [1.3, 1.25, 1.2, 1.1]
    const tailLayers: Layer[] = [cap(tailPath, tailR)]
    if (pattern === 'tabby') {
      const tip = tailPath[tailPath.length - 1]
      tailLayers.push(ell([tip[0], tip[1] - 0.2, tip[2] - 0.1], [1.7, 1.7, 1.7], 'fur2', true))
    }

    // 头 40% / 身体 30% / 腿 25%：腿要看得出来，头也不能陷进胸腔
    const neckY = bodyR[1] + headR[1] - 7.2
    const lift = frame === 'cobby' ? 1.0 : frame === 'slender' ? 1.5 : frame === 'large' ? 1.3 : 1.2
    const real: Stance =
      frame === 'cobby'
        ? { lift, body: [1.04, 1.0, 1.0], legR: 1.18, tail: 1.05, neck: [neckY, 0.4] }
        : frame === 'slender'
          ? { lift, body: [0.98, 1.0, 1.18], legR: 1.12, tail: 1.25, neck: [neckY, 0.5] }
          : frame === 'large'
            ? { lift, body: [1.04, 1.02, 1.16], legR: 1.2, tail: 1.15, neck: [neckY, 0.45] }
            : { lift, body: [1.0, 1.0, 1.1], legR: 1.15, tail: 1.15, neck: [neckY, 0.45] }

    return {
      fuzz: num(t, 'fur', 0.55),
      parts: stance([
        {
          name: 'body',
          pivot: [0, 7.0, bodyZ],
          layers: [body([0, 7.0, bodyZ], bodyR), ell([0, 6.2, 1.8], [bodyR[0] - 1, 2.9, 2.2], 'belly', true)],
          paint: catPaint(pattern, 'body'),
        },
        {
          name: 'head',
          pivot: [0, 9.5, 1.2],
          layers: headLayers,
          paint: catPaint(pattern, 'head'),
          decal: face === 'flat' ? PERSIAN_FACE : CAT_FACE,
        },
        tiltX({ ...catEar(earKind, 1), paint: catPaint(pattern, 'ear') }, earKind === 'folded' ? 0 : -0.12),
        tiltX({ ...catEar(earKind, -1), paint: catPaint(pattern, 'ear') }, earKind === 'folded' ? 0 : -0.12),
        ...legs({ x: frame === 'slender' ? 2.9 : 3.2, front: 1.6, back: bodyZ - bodyR[2] * 0.78, top: 5.4, r: legR, paw: 'paw' }),
        { name: 'tail', pivot: [0, 7.0, z0], layers: tailLayers, paint: catPaint(pattern, 'tail') },
      ], real),
    }
  },
}

// ===========================================================================
// 狗
//   ears:  floppy 耷拉耳 | long 长垂耳（腊肠）| pricked 立耳（柴犬、哈士奇）
//          | big 大立耳（柯基）| bat 蝙蝠耳（法斗）| semi 半立耳（边牧）
//          | samoyed 毛绒立耳 | fluffy 毛团耳（泰迪、比熊）
//   snout: normal | long 长嘴 | flat 扁脸（法斗）
//   tail:  short | curl 卷尾 | sickle 镰刀尾 | plume 羽状尾 | otter 水獭尾
//          | samoyed 卷到背上的大毛尾 | fluffy 毛球尾 | stub 几乎没有
//   legs:  normal | short 短腿；length 身长倍数（只往后长）
//   build: normal | stocky 敦实 | fluffy 厚毛（毛领、腮毛）
//   topknot: 1 = 头顶一团毛（泰迪、比熊）
//   legColor: 腿的颜色键（边牧的白腿）
//   fur:   毛边幅度
//   pattern: plain | urajiro 柴犬白脸颊 | husky 哈士奇面罩 | corgi 柯基白胸口和额头
//            | collie 边牧白鼻梁、白领、白胸
// ===========================================================================

function dogEar(kind: string, s: 1 | -1): PartDef {
  const f = side(s)
  const name = s === 1 ? 'earR' : 'earL'
  switch (kind) {
    case 'pricked':
      return {
        name,
        parent: 'head',
        pivot: f([4.2, 16.2, 0.6]),
        layers: [
          tri(f([2.0, 16.8, 0.6]), f([6.5, 15.4, 0.6]), f([5.2, 22.8, 0.5]), 2.5, 'ear'),
          tri(f([3.2, 17.0, 1.6]), f([5.7, 16.1, 1.6]), f([5.0, 21.2, 1.5]), 1.0, 'inner', true),
        ],
      }
    case 'samoyed':
      // 萨摩耶：小而厚的三角立耳，耳根宽、耳尖圆，两耳分得很开、略向外撇。
      // 用一整段收细的胶囊，而不是三个叠起来的球——叠球在厚毛下会散成几颗疙瘩
      return {
        name,
        parent: 'head',
        pivot: f([4.4, 16.4, 0.2]),
        layers: [
          cap([f([4.6, 16.8, 0.1]), f([5.3, 18.8, -0.1]), f([5.9, 21.0, -0.2])], [2.1, 1.6, 0.85], 'ear'),
          cap([f([4.9, 17.4, 1.0]), f([5.3, 19.0, 0.9])], [1.0, 0.6], 'inner', true),
        ],
      }
    case 'big':
      return {
        name,
        parent: 'head',
        pivot: f([4.2, 16.0, 0.4]),
        layers: [
          tri(f([1.8, 16.6, 0.4]), f([7.0, 15.2, 0.4]), f([6.4, 24.0, 0.2]), 2.3, 'ear'),
          tri(f([2.9, 16.9, 1.4]), f([6.1, 16.0, 1.4]), f([6.0, 22.2, 1.3]), 1.0, 'inner', true),
        ],
      }
    case 'bat':
      // 法斗：又大又圆的蝙蝠耳，竖直朝前张开
      return {
        name,
        parent: 'head',
        pivot: f([4.2, 16.4, 0.4]),
        layers: [
          rotEll(f([5.0, 19.6, 0.4]), [2.5, 3.4, 0.9], [0, 0, -s * 0.3], 'ear'),
          rotEll(f([5.0, 19.6, 1.1]), [1.6, 2.5, 0.5], [0, 0, -s * 0.3], 'inner', true),
        ],
      }
    case 'semi':
      // 边牧：下半截立着，上三分之一向前折
      return {
        name,
        parent: 'head',
        pivot: f([4.2, 16.2, 0.6]),
        layers: [
          tri(f([2.1, 16.8, 0.6]), f([6.5, 15.5, 0.6]), f([5.4, 21.4, 1.4]), 2.5, 'ear'),
          tri(f([4.6, 20.8, 1.4]), f([6.3, 20.4, 1.4]), f([5.6, 19.4, 3.6]), 1.4, 'ear'),
        ],
      }
    case 'long':
      // 腊肠：又长又软的垂耳，一直垂到下巴
      return {
        name,
        parent: 'head',
        pivot: f([5.0, 17.0, 1.0]),
        layers: [cap([f([5.0, 17.0, 1.0]), f([6.6, 15.0, 1.0]), f([7.0, 11.6, 1.2]), f([6.8, 9.6, 1.2])], [1.4, 1.8, 1.9, 1.6], 'ear')],
      }
    case 'fluffy':
      return { name, parent: 'head', pivot: f([5.4, 16.4, 0.8]), layers: [ell(f([6.4, 13.2, 0.8]), [2.0, 3.4, 2.0], 'ear')] }
    default:
      return { name, parent: 'head', pivot: f([5.4, 17.2, 1.2]), layers: [cap([f([5.4, 17.2, 1.2]), f([6.9, 15.5, 1.0]), f([7.2, 12.4, 1.0])], [1.5, 1.7, 1.6], 'ear')] }
  }
}

function dogTail(kind: string, z: number): PartDef {
  const at = (p: Vec3): Vec3 => [p[0], p[1], p[2] + z]
  switch (kind) {
    case 'samoyed':
      return {
        name: 'tail',
        pivot: at([0, 8.4, -6.0]),
        layers: [
          // 萨摩耶的尾巴又长又蓬：从尾根高高翻起，向前卷着搭在后背一侧，尾梢垂向腰侧
          cap(
            [at([0, 8.6, -6.0]), at([0, 11.8, -7.2]), at([0.4, 13.8, -5.4]), at([1.2, 13.4, -2.6]), at([2.2, 12.0, -0.4]), at([3.0, 10.6, 0.6])],
            [1.3, 1.8, 2.1, 2.0, 1.7, 1.2],
          ),
        ],
      }
    case 'curl':
      // 卷尾：从屁股往上翻、卷回背上
      return { name: 'tail', pivot: at([0, 8.4, -6.2]), layers: [cap([at([0, 8.4, -6.2]), at([0, 11.4, -7.6]), at([0, 13.2, -6.0]), at([0, 12.4, -4.2])], [1.6, 1.8, 1.7, 1.4])] }
    case 'sickle':
      return { name: 'tail', pivot: at([0, 8.4, -6.2]), layers: [cap([at([0, 8.4, -6.2]), at([0, 11.0, -7.8]), at([0, 12.8, -7.0])], [1.4, 1.7, 1.3])] }
    case 'plume':
      return { name: 'tail', pivot: at([0, 8.2, -6.4]), layers: [cap([at([0, 8.2, -6.4]), at([0, 9.4, -8.6]), at([0, 9.0, -10.8])], [1.3, 1.9, 1.4])] }
    case 'otter':
      // 拉布拉多：根部粗、往后逐渐变细的「水獭尾」
      return { name: 'tail', pivot: at([0, 8.0, -6.4]), layers: [cap([at([0, 8.0, -6.4]), at([0, 8.8, -8.4]), at([0, 8.6, -10.4])], [1.8, 1.4, 0.8])] }
    case 'fluffy':
      return { name: 'tail', pivot: at([0, 8.4, -6.2]), layers: [cap([at([0, 8.4, -6.2]), at([0, 9.6, -7.2])], [1.2, 1.2]), ell(at([0, 10.4, -7.6]), [2.3, 2.5, 2.3])] }
    case 'stub':
      return { name: 'tail', pivot: at([0, 7.6, -6.4]), layers: [ell(at([0, 7.8, -6.6]), [1.3, 1.2, 1.2])] }
    default:
      return { name: 'tail', pivot: at([0, 8, -6.4]), layers: [cap([at([0, 8, -6.4]), at([0, 10.2, -7.8]), at([0, 11.8, -7.4])], [1.4, 1.3, 1.1])] }
  }
}

/** zOff：身体加长后尾巴整体后移的距离，花纹阈值按未加长时的坐标写 */
function dogPaint(pattern: string, target: PaintTarget, zOff = 0): PartDef['paint'] {
  return (x, y, rawZ, cur) => {
    if (cur !== 'fur') return undefined
    const z = rawZ + zOff
    switch (pattern) {
      case 'urajiro':
        // 柴犬「里白」：脸颊、下巴、胸口是白的
        if (target === 'head') return z > 2 && y < 12.6 && Math.abs(x) > 1.2 ? 'belly' : undefined
        if (target === 'body') return z > 1.4 ? 'belly' : undefined
        if (target === 'tail') return z > -5.4 && y > 12 ? 'belly' : undefined
        return undefined
      case 'husky':
        // 哈士奇面罩：头顶深色、额头一道深色，眼睛周围和下半张脸是白的
        if (target === 'head') return z > 1.2 && y < 15.3 && !(Math.abs(x) < 1.1 && y > 12.8) ? 'belly' : undefined
        if (target === 'body') return y < 6.2 || z > 1.8 ? 'belly' : undefined
        if (target === 'tail') return z > -5.6 ? 'belly' : undefined
        return undefined
      case 'corgi':
        if (target === 'head') return z > 2 && (y < 12.4 || (Math.abs(x) < 1.1 && y < 17)) ? 'belly' : undefined
        if (target === 'body') return z > 0.8 || y < 5.4 ? 'belly' : undefined
        return undefined
      case 'collie':
        // 边牧：白色鼻梁往下变宽，接白口鼻、白领、白胸，尾尖白
        if (target === 'head') return z > 1.2 && (y < 11.6 || (y < 18 && Math.abs(x) < 0.8 + Math.max(0, 15.6 - y) * 0.45)) ? 'belly' : undefined
        if (target === 'body') return z > 1.4 || y < 4.8 ? 'belly' : undefined
        if (target === 'tail') return z < -9.8 ? 'belly' : undefined
        return undefined
    }
    return undefined
  }
}

const DOG_FACE = sym(32, [...EYES, '.............', '....PP.......', '....PP.......'])
/** 萨摩耶的「微笑」：鼻子下面一个小小的 V */
const SAMOYED_FACE = sym(31, [
  ...EYES,
  '.............',
  '....PP.......',
  '....PP.......',
  '.............',
  '.............',
  '.............',
  '..........M..',
  '...........M.',
])

const dog: VoxelDesign = {
  id: 'dog',
  palette: { ...BASE_PALETTE, fur: '#c98a5a', ear: '#8f5a36', belly: '#f6e9d8', paw: '#f6e9d8', muzzle: '#f6e9d8', nose: '#2c2224' },
  breeds: [
    { id: 'dog-mutt', name: '中华田园犬', weight: 3, traits: { ears: 'pricked', tail: 'sickle', length: 1.12, lift: 0.85 }, palette: { fur: '#d29a5e', ear: '#d29a5e', belly: '#f6e6cf', muzzle: '#f6e6cf', paw: '#f6e6cf', inner: '#e8b3a4' } },
    { id: 'dog-shiba', name: '柴犬', weight: 3, traits: { ears: 'pricked', tail: 'curl', pattern: 'urajiro', length: 1.08, lift: 0.8, tailLen: 1.08 }, palette: { fur: '#d98a43', ear: '#d98a43', belly: '#fbf3e6', muzzle: '#fbf3e6', paw: '#fbf3e6' } },
    { id: 'dog-corgi', name: '柯基', weight: 2, traits: { ears: 'big', legs: 'short', length: 1.4, lift: 0.3, tailLen: 1, pattern: 'corgi', tail: 'stub' }, palette: { fur: '#e09a4c', ear: '#e09a4c', belly: '#fbf5ea', muzzle: '#fbf5ea', paw: '#fbf5ea' } },
    { id: 'dog-golden', name: '金毛', weight: 2, traits: { snout: 'long', fur: 0.85, tail: 'plume', length: 1.14, lift: 0.95, tailLen: 1.1 }, palette: { fur: '#e8b665', ear: '#d9a04f', belly: '#f6dcaa', muzzle: '#f2d29c', paw: '#f2d29c' } },
    { id: 'dog-poodle', name: '泰迪', weight: 2, traits: { ears: 'fluffy', topknot: 1, fur: 1.0, tail: 'fluffy', length: 1.02, lift: 0.75, tailLen: 1 }, palette: { fur: '#9a5b38', ear: '#8c5032', belly: '#9a5b38', muzzle: '#a8673f', paw: '#9a5b38' } },
    { id: 'dog-husky', name: '哈士奇', weight: 1, traits: { ears: 'pricked', tail: 'sickle', pattern: 'husky', length: 1.14, lift: 0.95, tailLen: 1.08 }, palette: { fur: '#5f6673', ear: '#5f6673', belly: '#f4f3f0', muzzle: '#f4f3f0', paw: '#f4f3f0', eye: '#2f8fd0' } },
    { id: 'dog-frenchie', name: '法斗', weight: 1, traits: { ears: 'bat', snout: 'flat', tail: 'stub', build: 'stocky', fur: 0.25, length: 1.0, lift: 0.45, legR: 1.12, tailLen: 1 }, palette: { fur: '#d8bd93', ear: '#d8bd93', belly: '#efe0c6', muzzle: '#5a4a40', paw: '#efe0c6', inner: '#e5b2a6' } },
    { id: 'dog-bichon', name: '比熊', weight: 1, traits: { ears: 'fluffy', topknot: 1, fur: 1.1, tail: 'fluffy', length: 1.0, lift: 0.65, tailLen: 1 }, palette: { fur: '#fbf8f2', ear: '#f4efe6', belly: '#fbf8f2', muzzle: '#ffffff', paw: '#fbf8f2' } },
    { id: 'dog-labrador', name: '拉布拉多', weight: 1, traits: { snout: 'long', build: 'stocky', fur: 0.4, tail: 'otter', length: 1.14, lift: 0.9, tailLen: 1.08 }, palette: { fur: '#d9ad6e', ear: '#c69454', belly: '#ecd2a6', muzzle: '#e6c896', paw: '#e6c896' } },
    {
      id: 'dog-collie',
      name: '边境牧羊犬',
      weight: 1,
      traits: { ears: 'semi', snout: 'long', pattern: 'collie', tail: 'plume', legColor: 'belly', fur: 0.75, length: 1.14, lift: 0.95, tailLen: 1.12 },
      palette: { fur: '#2e3036', ear: '#25272c', belly: '#f5f1e9', muzzle: '#f5f1e9', paw: '#f5f1e9' },
    },
    {
      id: 'dog-samoyed',
      name: '萨摩耶',
      weight: 1,
      traits: { build: 'fluffy', ears: 'samoyed', tail: 'samoyed', fur: 0.8, length: 1.14, lift: 0.85, tailLen: 1.08 },
      palette: { fur: '#fffdf7', ear: '#f7f1e6', belly: '#fffdf7', muzzle: '#ffffff', paw: '#ffffff', inner: '#f0d6d0', nose: '#1f1a1c', mouth: '#1f1a1c' },
    },
    {
      id: 'dog-dachshund',
      name: '腊肠犬',
      weight: 1,
      traits: { legs: 'short', length: 1.7, lift: 0.35, snout: 'long', ears: 'long', fur: 0.3 },
      palette: { fur: '#9a5131', ear: '#7a3f27', belly: '#b9683f', muzzle: '#b9683f', paw: '#7a3f27' },
    },
  ],
  build: (t) => {
    const pattern = str(t, 'pattern', 'plain')
    const short = str(t, 'legs', 'normal') === 'short'
    const length = num(t, 'length', 1)
    const build = str(t, 'build', 'normal')
    const fluffy = build === 'fluffy'
    const stocky = build === 'stocky'
    const snoutKind = str(t, 'snout', 'normal')
    const drop = short ? -1.6 : 0

    // 胸口固定在 z≈3.7：身体加长只往后长，后腿和尾巴一起跟到身体末端
    const rz = 7.0 * length
    const bodyZ = 3.7 - rz

    const headP = 3.2
    // 狗脸比猫宽、下巴收得少：扁脸几乎不收，长嘴的反而要收一点才像
    // 狗认得出来靠一个往前伸出来的方嘴筒：侧面看头前面要明显多出一截
    const taper: [number, number] = [0.9, 1]
    const headC: Vec3 = [0, 13.4, 1.0]
    const headR: Vec3 = fluffy ? [6.4, 5.5, 5.0] : stocky ? [6.5, 5.3, 4.8] : [6.2, 5.3, 4.8]
    const muzzleY = snoutKind === 'flat' ? 10.9 : 10.9
    const front = faceFront(headC, headR, headP, taper, muzzleY)
    const headLayers: Layer[] = [head(headC, headR, { p: headP, taper })]
    const depth = snoutKind === 'long' ? 3.8 : snoutKind === 'flat' ? 1.0 : fluffy ? 2.4 : 2.9
    headLayers.push(muzzle(0, muzzleY, front, snoutKind === 'long' ? 2.7 : snoutKind === 'flat' ? 3.4 : fluffy ? 2.8 : 3.0, snoutKind === 'long' ? 2.1 : 2.2, depth))
    // 鼻头：嘴筒前端上沿的一个黑色小圆块
    headLayers.push(ell([0, muzzleY + 1.2, front + depth - 0.5], [1.3, 0.85, 0.9], 'nose'))
    // 厚毛犬的腮毛：把下半张脸往两边撑开，脸周围像一圈狮子鬃毛
    if (fluffy) headLayers.push(ell([5.2, 10.6, 1.4], [2.4, 2.7, 2.8]), ell([-5.2, 10.6, 1.4], [2.4, 2.7, 2.8]))
    if (t.topknot) headLayers.push(ell([0, 17.8, 0.8], [4.4, 2.7, 3.9]))

    // 身体加高、加长；胸口位置不动，只往后长
    const bodyR: Vec3 = [fluffy ? 5.2 : stocky ? 5.3 : 4.9, fluffy ? 4.5 : stocky ? 4.4 : 4.2, rz]
    const bodyCy = 7.2
    const bodyLayers: Layer[] = [
      body([0, bodyCy, bodyZ], bodyR),
      ell([0, bodyCy - 0.8, 1.8], [3.3, 3.0, 2.3], 'belly', true),
    ]
    // 毛领：下巴底下往前鼓出的一团胸毛。别做得太高太宽，
    // 否则和头连成一根柱子，侧面就成了一整团白胖的方块
    if (fluffy) bodyLayers.push(ell([0, bodyCy + 1.4, 3.2], [4.4, 2.6, 2.4]))

    const earKind = str(t, 'ears', 'floppy')
    const earTilt = ['pricked', 'samoyed', 'big', 'bat'].includes(earKind) ? -0.18 : 0
    const upper: PartDef[] = [
      { name: 'body', pivot: [0, 7.2, bodyZ], layers: bodyLayers, paint: dogPaint(pattern, 'body') },
      {
        name: 'head',
        pivot: [0, 9.5, 1],
        layers: headLayers,
        decal: fluffy ? SAMOYED_FACE : DOG_FACE,
        paint: dogPaint(pattern, 'head'),
      },
      tiltX(dogEar(earKind, 1), earTilt),
      tiltX(dogEar(earKind, -1), earTilt),
      // 尾根始终挂在屁股后面 0.5 格：身体越长越往后，不能写死 z
      { ...dogTail(str(t, 'tail', 'short'), 10.6 - 14 * length), paint: dogPaint(pattern, 'tail', 10.6 - 14 * length) },
    ]
    // 头 40% / 身体 30% / 腿 25%：腿要看得出来，头也不能陷进胸腔
    const neckY = bodyR[1] + headR[1] - 7.2
    const real: Stance = {
      lift: num(t, 'lift', 0.85) * 0.6 + 0.6,
      body: short ? [1.02, 0.98, 1] : [1.0, 1.0, 1],
      legR: num(t, 'legR', 1.18),
      tail: num(t, 'tailLen', 1.1),
      neck: [neckY, 0.5],
    }
    return {
      fuzz: num(t, 'fur', 0.5),
      parts: stance([
        ...upper.map((p) => (drop ? shiftY(p, drop) : p)),
        ...legs({
          x: fluffy || stocky ? 3.3 : 3.1,
          front: 1.6,
          back: bodyZ - rz * 0.78,
          top: 5.4 + drop,
          r: fluffy || stocky ? 1.6 : 1.45,
          color: str(t, 'legColor', 'fur'),
          paw: 'paw',
          smooth: fluffy,
        }),
      ], real),
    }
  },
}

// ===========================================================================
// 狐狸：独立模板，不复用狗。
//   赤狐：大三角耳（耳背和耳尖黑）、白腮白下巴、黑「袜子」、白尾尖、尾巴平拖在身后
//   北极狐：耳朵小而圆（防冻）、吻部短、身体圆、毛最厚
//   耳廓狐：巨大的宽耳朵，长度超过头高，约 40° 向两侧外展；体型小、尾尖一小撮深褐
// ===========================================================================

function foxEar(kind: string, s: 1 | -1): PartDef {
  const f = side(s)
  const name = s === 1 ? 'earR' : 'earL'
  if (kind === 'arctic') {
    // 北极狐：小而圆、几乎埋在毛里的耳朵
    return {
      name,
      parent: 'head',
      pivot: f([4.4, 17.0, 0.4]),
      layers: [
        rotEll(f([4.6, 19.0, 0.4]), [2.1, 2.8, 0.9], [0, 0, -s * 0.35], 'ear'),
        rotEll(f([4.65, 19.1, 1.0]), [1.3, 2.0, 0.5], [0, 0, -s * 0.35], 'inner', true),
      ],
    }
  }
  if (kind === 'fennec') {
    // 耳根从头顶一直延伸到眼睛高度的头侧，耳尖斜指向外上方。
    // 三角片定出轮廓，叠一片外展的椭圆把两侧边缘撑成饱满的弧线。
    // 整只耳朵以耳根为中心放大 K 倍：耳廓狐的耳朵要比头还高
    const K = 1.35
    const g = (p: Vec3): Vec3 => f([3.9 + (p[0] - 3.9) * K, 15.4 + (p[1] - 15.4) * K, p[2]])
    const tilt: Vec3 = [0, 0, -s * 0.6]
    return {
      name,
      parent: 'head',
      pivot: f([3.9, 15.4, 0.4]),
      layers: [
        tri(g([1.6, 16.4, 0.3]), g([6.6, 13.2, 0.3]), g([11.4, 25.4, 0.0]), 2.6, 'ear'),
        rotEll(g([7.4, 19.6, 0.3]), [3.0 * K, 5.6 * K, 1.2], tilt, 'ear'),
        ell(g([10.9, 24.6, 0.2]), [1.4, 1.4, 1.1], 'ear'),
        rotEll(g([7.3, 19.5, 1.1]), [2.1 * K, 4.6 * K, 0.6], tilt, 'inner', true),
      ],
    }
  }
  // 赤狐：大三角耳，耳根宽、竖得很直，耳尖有一小撮深色
  return {
    name,
    parent: 'head',
    pivot: f([3.6, 15.6, 0.4]),
    layers: [
      tri(f([1.1, 16.6, 0.4]), f([6.4, 14.4, 0.4]), f([5.4, 25.2, 0.1]), 2.2, 'ear'),
      tri(f([2.4, 16.9, 1.4]), f([5.4, 15.2, 1.4]), f([5.0, 22.8, 1.2]), 0.9, 'inner', true),
    ],
  }
}

/** tipZ：尾尖从哪个 z 开始换色（尾巴末端往前约 2.5 格） */
function foxPaint(kind: string, target: PaintTarget, tipZ = -11.2): PartDef['paint'] {
  return (x, y, z, cur) => {
    switch (target) {
      case 'head':
        // 狐狸的白只在下半张脸：两颊的白色往上翘到眼睛下方，中间留一道
        // 橙色的鼻梁。整张脸刷白就变成狗了。
        // 嘴的上半截保持橙色，下半截和下巴是白的
        if (cur !== 'fur' || z < 0.6) return undefined
        if (Math.abs(x) < 2.6) return y < 10.9 ? 'belly' : undefined
        return y < 11.8 ? 'belly' : undefined
      case 'ear':
        return kind === 'red' && cur === 'ear' && y > 22.6 ? 'tip' : undefined
      case 'tail':
        if (cur !== 'fur') return undefined
        return z < tipZ ? (kind === 'fennec' ? 'tip' : 'tailtip') : undefined
    }
    return undefined
  }
}

// 鼻子那两行正好落在嘴筒前端（y≈10.5~11.5），贴花投到每列最靠前的格子
const FOX_FACE = sym(33, [
  '.............',
  '.....KKK.....',
  '....KWKK.....',
  '....KKKK.....',
  '.....KKK.....',
  '.............',
  '....PP.......',
  '....PP.......',
  '.............',
  '.............',
  '...........NN',
  '...........NN',
])

const fox: VoxelDesign = {
  id: 'fox',
  palette: {
    ...BASE_PALETTE,
    fur: '#d2733b',
    ear: '#c96a33',
    tip: '#3a2622',
    inner: '#f6ece0',
    belly: '#f8f0e4',
    stock: '#3a2622',
    paw: '#3a2622',
    tailtip: '#fbf7f0',
    nose: '#241a1a',
    eye: '#2a1e1a',
  },
  breeds: [
    { id: 'fox-red', name: '赤狐', weight: 3, traits: { kind: 'red', fur: 0.7 } },
    {
      id: 'fox-arctic',
      name: '北极狐',
      weight: 1,
      traits: { kind: 'arctic', fur: 0.85 },
      palette: { fur: '#f3f1ec', ear: '#e8e4dd', tip: '#e8e4dd', inner: '#fbf8f4', belly: '#ffffff', stock: '#ece8e2', paw: '#ece8e2', tailtip: '#ffffff', nose: '#2c2628' },
    },
    {
      id: 'fox-fennec',
      name: '耳廓狐',
      weight: 1,
      traits: { kind: 'fennec', fur: 0.5 },
      palette: { fur: '#e2b47c', ear: '#dcaa70', inner: '#f3dccf', belly: '#f9ecd8', tip: '#8a6040', stock: '#e2b47c', paw: '#f3dcc0', nose: '#2c2228' },
    },
  ],
  build: (t) => {
    const kind = str(t, 'kind', 'red')
    const fennec = kind === 'fennec'
    const arctic = kind === 'arctic'

    // 狐狸的脸是三角楔：上面是一块宽的颅骨（顶平、有耳根的宽度），
    // 下面接着一块向下收尖的吻部。用一个圆球再怎么收窄都不像狐狸，
    // 因为圆球最宽的地方在中间，会变成圆脸。
    // 狐狸认得出来靠三样：①往前伸出来的嘴筒（侧面最明显）②两颊往外翘的白毛
    // ③大三角耳。头本身只是略收下巴的圆脸。
    const headP = 2.8
    const headC: Vec3 = [0, 13.4, 1.2]
    const headR: Vec3 = fennec ? [5.9, 4.9, 4.5] : arctic ? [6.5, 5.2, 4.9] : [6.2, 5.0, 4.6]
    const taper: [number, number] = [0.78, 1]
    const snoutY = 11.0
    const front = faceFront(headC, headR, headP, taper, snoutY)
    const snoutLen = fennec ? 2.2 : arctic ? 1.8 : 2.5
    const headLayers: Layer[] = [
      head(headC, headR, { p: headP, taper }),
      // 短而圆的嘴筒，鼻头印在最前面
      {
        ...muzzle(0, snoutY, front, 2.5, 1.9, snoutLen, 'fur'),
        smooth: true,
      },
      // 白腮毛：往两侧和下方翘出去，正面看是上宽下尖的狐狸脸
      { ...ell([5.0, 11.0, 1.8], [2.4, 1.7, 2.4], 'belly'), smooth: true },
      { ...ell([-5.0, 11.0, 1.8], [2.4, 1.7, 2.4], 'belly'), smooth: true },
    ]

    const bodyR: Vec3 = fennec ? [4.2, 3.6, 6.6] : arctic ? [5.0, 4.3, 7.2] : [4.7, 4.2, 7.6]
    const bodyZ = 3.4 - bodyR[2]
    const bodyCy = 7.2

    // 尾根紧贴屁股（只埋进身体 1 格），否则前半截尾巴藏在身体里，露出来的就很短。
    // 三个品种的尾巴各不一样，而且都是「根细、中段最蓬、末端收尖」的毛刷形，
    // 粗细均匀的话就像一根香肠：
    //   赤狐：又长又蓬，几乎水平地拖在身后，末端微微上翘，白尾尖
    //   北极狐：最粗最蓬、偏短，高高翘起再往后卷，整条都是白的
    //   耳廓狐：细一些，往下垂到快贴地，黑尾尖
    const t0 = bodyZ - bodyR[2] + 1.0
    const tailPath: Vec3[] = fennec
      ? [[0, 7.6, t0], [0, 6.2, t0 - 2.2], [0, 4.6, t0 - 4.4], [0, 3.6, t0 - 6.6], [0, 3.2, t0 - 8.2]]
      : arctic
        ? [[0, 8.4, t0], [0, 10.0, t0 - 2.4], [0, 11.4, t0 - 4.6], [0, 11.6, t0 - 6.8], [0, 10.4, t0 - 8.2]]
        : [[0, 8.0, t0], [0, 7.4, t0 - 2.6], [0, 6.6, t0 - 5.6], [0, 6.8, t0 - 8.4], [0, 8.0, t0 - 10.4]]
    const tailR = fennec ? [0.8, 1.5, 1.9, 1.8, 1.0] : arctic ? [1.4, 3.0, 3.6, 3.2, 1.8] : [1.0, 2.4, 3.1, 2.8, 1.3]
    const tipZ = fennec ? t0 - 6.6 : arctic ? -Infinity : t0 - 7.8
    // 狐狸的整体感全靠「身子像一根长条 + 大尾巴」；脖子必须把三角脸抬到肩上方
    const neckY = bodyCy + bodyR[1] - 1.6 - (headC[1] - headR[1])
    const real: Stance = fennec
      ? { lift: 1.2, body: [1.0, 1.0, 1.0], legR: 1.15, neck: [neckY, 0.5] }
      : arctic
        ? { lift: 1.0, body: [1.0, 1.0, 1.0], legR: 1.2, neck: [neckY, 0.5] }
        : { lift: 1.3, body: [1.0, 1.0, 1.0], legR: 1.15, neck: [neckY, 0.5] }

    return {
      fuzz: num(t, 'fur', 0.7),
      parts: stance([
        {
          name: 'body',
          pivot: [0, bodyCy, bodyZ],
          layers: [body([0, bodyCy, bodyZ], bodyR), ell([0, bodyCy - 0.4, 2.2], [bodyR[0] - 0.9, 2.7, 2.0], 'belly', true)],
        },
        { name: 'head', pivot: [0, 9.5, 1], layers: headLayers, decal: FOX_FACE, paint: foxPaint(kind, 'head') },
        // 侧面看耳朵往后仰：耳廓狐最明显
        tiltX({ ...foxEar(kind, 1), paint: foxPaint(kind, 'ear') }, fennec ? -0.32 : -0.2),
        tiltX({ ...foxEar(kind, -1), paint: foxPaint(kind, 'ear') }, fennec ? -0.32 : -0.2),
        ...legs({
          x: fennec ? 2.4 : arctic ? 3.0 : 2.7,
          front: 1.4,
          back: bodyZ - bodyR[2] * 0.75,
          top: 5.4,
          r: fennec ? 1.3 : arctic ? 1.5 : 1.4,
          color: 'stock',
          paw: 'paw',
          smooth: arctic,
        }),
        { name: 'tail', pivot: tailPath[0], layers: [cap(tailPath, tailR)], paint: foxPaint(kind, 'tail', tipZ) },
      ], real),
    }
  },
}

// ===========================================================================
// 熊猫：白底 + 黑耳 + 黑眼圈 + 黑四肢和肩带，更圆更胖
// ===========================================================================

const panda: VoxelDesign = {
  id: 'panda',
  palette: { ...BASE_PALETTE, fur: '#f5f3ef', fur2: '#2e2c33', belly: '#f5f3ef', muzzle: '#f5f3ef', eye: '#151318', shine: '#ffffff' },
  breeds: [
    { id: 'panda-classic', name: '大熊猫', weight: 3 },
    { id: 'panda-brown', name: '棕色熊猫', weight: 1, palette: { fur2: '#6b4a34', fur: '#efe4d6', muzzle: '#efe4d6' } },
  ],
  build: () => {
    // 熊和狗的区别全在「圆」：球一样的头、球一样的胖身子、几乎看不见的短粗腿、
    // 不往前伸的小嘴。头和身子都用 p=2 的正椭球，不用方一点的超椭球。
    const headP = 2.2
    const headC: Vec3 = [0, 13.4, 1.4]
    const headR: Vec3 = [7.0, 6.0, 5.6]
    const muzzleY = 11.0
    const bodyCy = 6.6
    const bodyRy = 5.0
    const neckY = bodyCy + bodyRy - 2.2 - (headC[1] - headR[1])
    return {
      fuzz: 0.6,
      parts: stance([
        {
          name: 'body',
          pivot: [0, bodyCy, -1],
          layers: [
            { kind: 'ellipsoid', c: [0, bodyCy, -1.4], r: [5.8, bodyRy, 6.2], p: 2, color: 'fur' },
            // 肩带：黑色一圈连到前腿
            ell([0, bodyCy + 0.6, 1.8], [6.0, 5.2, 2.0], 'fur2', true),
          ],
        },
        {
          name: 'head',
          pivot: [0, 10, 1.2],
          layers: [
            head(headC, headR, { p: headP }),
            muzzle(0, muzzleY, faceFront(headC, headR, headP, undefined, muzzleY), 2.4, 1.7, 0.6),
          ],
          decal: sym(32, [
            '.....DDD.....',
            '....DDDDD....',
            '...DDKKKDD...',
            '...DDKWKDD...',
            '...DDKKKDD...',
            '....DDKDD....',
            '.....DDD.....',
            '.............',
            '..........NNN',
            '...........NN',
            '..........M..',
            '...........M.',
          ]),
        },
        // 圆耳朵长在头顶两角，不是头侧
        { name: 'earR', parent: 'head', pivot: [4.6, 18.0, 0.4], layers: [ell([4.9, 19.4, 0.4], [2.3, 2.3, 1.5], 'fur2')] },
        { name: 'earL', parent: 'head', pivot: [-4.6, 18.0, 0.4], layers: [ell([-4.9, 19.4, 0.4], [2.3, 2.3, 1.5], 'fur2')] },
        ...legs({ x: 3.5, front: 1.6, back: -5.6, top: 4.4, r: 2.2, color: 'fur2' }),
        { name: 'tail', pivot: [0, bodyCy + 0.6, -7.4], layers: [ell([0, bodyCy + 0.6, -7.5], [1.5, 1.5, 1.2])] },
      ], { lift: 0.3, body: [1.0, 1.0, 1.0], legR: 1.1, neck: [neckY, 0.6] }),
    }
  },
}

// ===========================================================================
// 兔子
//   ears: up 竖耳 | lop 垂耳
//   pattern: plain | dutch 荷兰兔（前半身和脸中间白）
// ===========================================================================

function bunnyEar(kind: string, s: 1 | -1): PartDef {
  const f = side(s)
  const name = s === 1 ? 'earR' : 'earL'
  if (kind === 'lop') {
    // 垂耳：从头顶两侧垂到脸颊外
    const rot: Vec3 = [0.1, 0, s * 0.22]
    return {
      name,
      parent: 'head',
      pivot: f([3.8, 16.2, 0.6]),
      layers: [rotEll(f([5.9, 13.0, 0.8]), [1.3, 4.4, 1.9], rot), rotEll(f([5.3, 12.6, 0.9]), [0.6, 3.4, 1.2], rot, 'inner', true)],
    }
  }
  // 扁长的椭球：正面宽、侧面薄，向外张开一点、往后仰一点
  const rot: Vec3 = [-0.1, 0, -s * 0.12]
  return {
    name,
    parent: 'head',
    pivot: f([2.4, 15.8, 0.4]),
    layers: [rotEll(f([2.7, 21.6, 0.4]), [1.75, 6.4, 1.0], rot), rotEll(f([2.75, 21.9, 1.1]), [0.95, 5.2, 0.5], rot, 'inner', true)],
  }
}

function bunnyPaint(pattern: string, target: PaintTarget): PartDef['paint'] {
  if (pattern !== 'dutch') return undefined
  return (x, y, z, cur) => {
    if (cur !== 'fur') return undefined
    if (target === 'head') return z > 2 && (Math.abs(x) < 1.6 || y < 11.2) ? 'belly' : undefined
    if (target === 'body') return z > -0.6 ? 'belly' : undefined
    return undefined
  }
}

const bunny: VoxelDesign = {
  id: 'bunny',
  palette: { ...BASE_PALETTE, fur: '#d7a77e', fur2: '#b9875f', belly: '#fbf3ea', muzzle: '#fbf3ea', paw: '#fbf3ea', nose: '#f08a9a' },
  breeds: [
    { id: 'bunny-brown', name: '棕兔', weight: 3 },
    { id: 'bunny-white', name: '白兔', weight: 2, palette: { fur: '#f8f5f0', belly: '#ffffff', muzzle: '#ffffff', paw: '#ffffff', eye: '#d0405a', shine: '#ffd6de' } },
    { id: 'bunny-grey', name: '灰兔', weight: 2, palette: { fur: '#a8a29a', belly: '#f2eee8', muzzle: '#f2eee8', paw: '#f2eee8' } },
    { id: 'bunny-black', name: '黑兔', weight: 1, palette: { fur: '#3d3739', belly: '#efe9e2', muzzle: '#efe9e2', paw: '#efe9e2', eye: '#d9a91f', shine: '#fff4c8' } },
    { id: 'bunny-lop', name: '垂耳兔', weight: 2, traits: { ears: 'lop', fur: 0.7 }, palette: { fur: '#e8d3b4', belly: '#fbf6ee', muzzle: '#fbf6ee', paw: '#fbf6ee' } },
    { id: 'bunny-dutch', name: '荷兰兔', weight: 1, traits: { pattern: 'dutch' }, palette: { fur: '#3d3739', belly: '#fbf8f3', muzzle: '#fbf8f3', paw: '#fbf8f3' } },
  ],
  build: (t) => {
    const pattern = str(t, 'pattern', 'plain')
    const ears = str(t, 'ears', 'up')
    // 兔子和狗的区别：蹲坐的姿势。身体是后高前低的蛋形，后腿是贴在身体两侧的
    // 大肉团 + 平放在地上的长脚掌，前腿只露出一小截。不能有四条一样的腿。
    const headP = 2.4
    const headC: Vec3 = [0, 12.4, 1.6]
    const headR: Vec3 = [6.2, 5.3, 5.0]
    const taper: [number, number] = [0.86, 1]
    const muzzleY = 10.4
    const bodyCy = 5.6
    const bodyRy = 4.8
    const neckY = bodyCy + bodyRy - 2.4 - (headC[1] - headR[1])
    return {
      fuzz: num(t, 'fur', 0.55),
      parts: stance([
        {
          name: 'body',
          pivot: [0, bodyCy, -1],
          layers: [
            { kind: 'ellipsoid', c: [0, bodyCy, -2.2], r: [4.8, bodyRy, 5.8], p: 2, color: 'fur' },
            ell([0, bodyCy - 0.6, 1.8], [3.2, 3.2, 2.0], 'belly', true),
            // 蹲坐的后腿：身体后半段两侧的大肉团。和前爪之间要留出一段肚子，
            // 否则侧面看四只脚全挤在身子正下方
            ell([3.6, 3.6, -4.4], [2.0, 3.0, 3.2]),
            ell([-3.6, 3.6, -4.4], [2.0, 3.0, 3.2]),
            // 平放在地上的长后脚掌：脚跟在屁股下面，脚尖伸到肚子中间
            ell([3.4, 0.8, -3.8], [1.5, 0.9, 3.0], 'paw'),
            ell([-3.4, 0.8, -3.8], [1.5, 0.9, 3.0], 'paw'),
          ],
          paint: bunnyPaint(pattern, 'body'),
        },
        {
          name: 'head',
          pivot: [0, 9, 1.2],
          layers: [
            head(headC, headR, { p: headP, taper }),
            ...cheeks(muzzleY, faceFront(headC, headR, headP, taper, muzzleY), 1.9, 0.85),
          ],
          paint: bunnyPaint(pattern, 'head'),
          decal: sym(29, [
            ...EYES,
            '.............',
            '....PP.......',
            '....PP.......',
            '...........NN',
            '..........M..',
            '...........M.',
          ]),
        },
        bunnyEar(ears, 1),
        bunnyEar(ears, -1),
        // 只有两条前腿会摆：短短的，撑在胸口最前面
        ...legs({ x: 2.0, front: 2.6, back: -3.0, top: 3.8, r: 1.25, paw: 'paw' }).filter((p) => p.name === 'legFL' || p.name === 'legFR'),
        { name: 'tail', pivot: [0, bodyCy, -7.6], layers: [ell([0, bodyCy + 0.2, -8.0], [2.0, 2.0, 1.8], 'belly')] },
      ], { lift: 0, body: [1.0, 1.0, 1.0], legR: 1.0, neck: [neckY, 0.4] }),
    }
  },
}

// ===========================================================================
// 松鼠
//   红松鼠：耳尖一撮长毛 + 尾巴从屁股后面立起来绕过背，末梢在头顶后方勾回来
//   灰松鼠：没有耳簇，身子更长、尾巴更平更大，垂在身后
//   花栗鼠：小一号，背上有五道纵纹，尾巴短而竖起
// 「一眼是松鼠」靠的是大尾巴，所以三个品种的尾巴形状都不一样，不是只换颜色。
// ===========================================================================

function squirrelEar(tufted: boolean, s: 1 | -1): PartDef {
  const f = side(s)
  const layers: Layer[] = [tri(f([1.5, 16.9, 0.5]), f([5.8, 15.4, 0.5]), f([4.8, 21.8, 0.3]), 1.9)]
  // 耳尖的毛簇：红松鼠最有辨识度的一处，比耳朵本身还长
  if (tufted) layers.push(cap([f([4.6, 21.0, 0.5]), f([5.6, 24.8, 0.4])], [0.9, 0.4]))
  layers.push(tri(f([2.5, 17.2, 1.4]), f([5.0, 16.2, 1.4]), f([4.5, 20.4, 1.3]), 0.8, 'inner', true))
  return { name: s === 1 ? 'earR' : 'earL', parent: 'head', pivot: f([3.4, 16.2, 0.5]), layers }
}

const SQUIRREL_FACE = sym(27, [...EYES, '.............', '....PP.......', '....PP.......', '...........NN', '..........M..', '...........M.'])

const squirrel: VoxelDesign = {
  id: 'squirrel',
  palette: { ...BASE_PALETTE, fur: '#b4703f', fur2: '#7a4526', belly: '#f7e9d3', muzzle: '#f7e9d3', paw: '#8a5330' },
  breeds: [
    { id: 'squirrel-red', name: '红松鼠', weight: 3, traits: { tail: 'curl', tufts: 1, pattern: 'plain' } },
    {
      id: 'squirrel-grey',
      name: '灰松鼠',
      weight: 3,
      traits: { tail: 'plume', tufts: 0, pattern: 'plain', build: 1.12 },
      palette: { fur: '#9ba0a6', fur2: '#6e7278', belly: '#f4f2ee', muzzle: '#f4f2ee', paw: '#7c8085' },
    },
    {
      id: 'squirrel-chipmunk',
      name: '花栗鼠',
      weight: 1,
      traits: { tail: 'short', tufts: 0, pattern: 'chipmunk', build: 0.86 },
      palette: { fur: '#c98f5c', fur2: '#5b3a24', belly: '#fbf1e2', muzzle: '#fbf1e2', paw: '#8a6240' },
    },
  ],
  build: (t) => {
    const headP = 2.6
    const kind = str(t, 'tail', 'curl')
    const small = num(t, 'build', 1)
    const headC: Vec3 = [0, 12.6, 1.6]
    const headR: Vec3 = [5.5, 4.9, 4.7]
    const bodyCy = 6.0
    const bodyRy = 4.0
    const bodyR: Vec3 = [4.5, bodyRy, 5.2]
    const bodyZ = 2.8 - bodyR[2]
    const neckY = bodyCy + bodyRy - 1.4 - (headC[1] - headR[1])
    const t0 = bodyZ - bodyR[2] + 1.2
    // 三条尾巴：绕背一圈 / 垂在身后的大蓬尾 / 短而竖起
    const tails: Record<string, Vec3[]> = {
      curl: [
        [0, 6.2, t0],
        [0, 9.2, t0 - 2.8],
        [0, 13.6, t0 - 3.8],
        [0, 17.2, t0 - 1.6],
        [0, 18.0, t0 + 1.8],
      ],
      plume: [
        [0, 6.4, t0],
        [0, 6.0, t0 - 3.6],
        [0, 7.6, t0 - 6.8],
        [0, 11.4, t0 - 8.4],
      ],
      short: [
        [0, 6.8, t0],
        [0, 9.6, t0 - 2.0],
        [0, 12.4, t0 - 2.4],
      ],
    }
    const radii: Record<string, number[]> = {
      curl: [1.3, 3.0, 3.6, 3.4, 2.0],
      plume: [1.4, 2.6, 3.2, 2.2],
      short: [1.2, 2.0, 1.1],
    }
    return {
      fuzz: 0.5,
      parts: stance([
        {
          name: 'body',
          pivot: [0, bodyCy, bodyZ],
          layers: [
            body([0, bodyCy, bodyZ], bodyR),
            ell([0, bodyCy - 0.4, 2.0], [3.0, 2.9, 2.0], 'belly', true),
            // 蹲坐的后腿：比前腿粗
            ell([3.4, bodyCy - 1.2, -3.0], [1.6, 2.2, 2.6]),
            ell([-3.4, bodyCy - 1.2, -3.0], [1.6, 2.2, 2.6]),
          ],
          // 花栗鼠：背脊一道深色纵纹 + 两侧各一道浅色
          paint: (x, y, z, cur) => {
            if (str(t, 'pattern', 'plain') !== 'chipmunk') return undefined
            if (cur !== 'fur') return undefined
            if (z > 1.4 || y < 4.6) return undefined
            const ax = Math.abs(x)
            if (ax < 0.9) return 'fur2'
            if (ax > 2.2 && ax < 3.3) return 'belly'
            return undefined
          },
        },
        {
          name: 'head',
          pivot: [0, 9.5, 1.2],
          layers: [
            head(headC, headR, { p: headP }),
            muzzle(0, 10.4, faceFront(headC, headR, headP, undefined, 10.4), 2.1, 1.6, 1.2),
          ],
          decal: SQUIRREL_FACE,
          // 花栗鼠的过眼纹：从鼻子穿过眼睛一直到耳根
          paint: (x, y, z, cur) =>
            str(t, 'pattern', 'plain') === 'chipmunk' && cur === 'fur' && Math.abs(y - 13.4) < 1.1 && z > 2.6 ? 'fur2' : undefined,
        },
        squirrelEar(num(t, 'tufts', 0) > 0, 1),
        squirrelEar(num(t, 'tufts', 0) > 0, -1),
        ...legs({ x: 2.5, front: 1.8, back: t0 + 2.2, top: 5.0, r: 1.3, paw: 'paw' }),
        { name: 'tail', pivot: tails[kind][0], layers: [cap(tails[kind], radii[kind])] },
      ], {
        lift: 0.7,
        legR: 1.0,
        body: [small, small, small],
        neck: [neckY, 0.5],
      }),
    }
  },
}

// ===========================================================================
// 猪
// 猪和狗最大的区别是头的姿态：狗把头顶在身体上方，猪的头跟身子是同一个高度，
// 直接长在桶形身体的前端，几乎没有脖子。所以这里 headC 的 y 和身体中心几乎相等，
// 再用 neck 把 stance 自动抬高抵消掉，头就不会像狗一样抬起来。
// 另外加了三样：扁平的鼻子盘、往前耷拉到眼睛上的大耳朵、垂下来的两腮肉。
// ===========================================================================

function pigEar(kind: string, s: 1 | -1): PartDef {
  const f = side(s)
  const name = s === 1 ? 'earR' : 'earL'
  if (kind === 'prick') {
    // 野猪：小而竖立的尖耳
    return {
      name,
      parent: 'head',
      pivot: f([3.0, 11.0, 1.0]),
      layers: [
        tri(f([1.8, 11.6, 0.6]), f([4.6, 11.2, 0.6]), f([6.2, 15.4, 1.2]), 1.2),
        tri(f([2.4, 11.8, 1.5]), f([4.2, 11.5, 1.5]), f([5.6, 14.6, 1.8]), 0.4, 'inner', true),
      ],
    }
  }
  return {
    name,
    parent: 'head',
    pivot: f([2.6, 11.0, 2.0]),
    layers: [
      // 耳根长在头顶，整片往前盖住眼睛，耳尖朝前下方
      tri(f([0.8, 12.0, 0.6]), f([5.6, 11.2, 0.6]), f([8.4, 8.0, 5.6]), 1.4),
      tri(f([2.0, 11.6, 1.8]), f([5.0, 11.2, 1.8]), f([7.2, 8.6, 5.2]), 0.5, 'inner', true),
    ],
  }
}

const PIG_FACE = sym(20, [...EYES, '.............', '.............'])

const pig: VoxelDesign = {
  id: 'pig',
  palette: { ...BASE_PALETTE, inner: '#fbd9dc', fur: '#f2b8b2', fur2: '#b8696b', belly: '#f8d7d2', muzzle: '#f8d7d2', paw: '#8f6b64', nose: '#c95f6b' },
  breeds: [
    { id: 'pig-house', name: '家猪', weight: 3, traits: { snout: 'disc', ears: 'flop' } },
    {
      id: 'pig-boar',
      name: '野猪',
      weight: 1,
      traits: { snout: 'long', ears: 'prick', tusks: 1 },
      palette: { inner: '#8a6a70', fur: '#6b5a4c', fur2: '#3c332c', belly: '#8a7768', muzzle: '#4a4038', paw: '#332b26', nose: '#2c2420' },
    },
  ],
  build: (t) => {
    const headP = 2.5
    const boar = str(t, 'snout', 'disc') === 'long'
    const bodyCy = 7.2
    const bodyRy = 4.3
    const bodyR: Vec3 = [5.4, bodyRy, 5.2]
    const bodyZ = 1.2 - bodyR[2]
    // 头和身体几乎同一个高度：这是猪不像狗的关键
    const headCy = 7.5
    const headC: Vec3 = [0, headCy, 3.2]
    const headR: Vec3 = [4.9, 4.4, 3.5]
    // 野猪的吻更长更窄，家猪是一块扁平的鼻子盘
    const snoutY = headCy - 1.7
    const snoutZ = faceFront(headC, headR, headP, undefined, snoutY)
    const t0 = bodyZ - bodyR[2] + 1.2
    return {
      fuzz: boar ? 0.55 : 0.16,
      parts: stance([
        {
          name: 'body',
          pivot: [0, bodyCy, bodyZ],
          layers: [
            body([0, bodyCy, bodyZ], bodyR),
            ell([0, bodyCy - 0.6, 1.8], [3.5, 3.4, 2.4], 'belly', true),
            // 野猪的鬃毛：背脊一道立起来的毛
            ...(boar
              ? [
                  cap([[0, bodyCy + 3.6, 2.2], [0, bodyCy + 4.6, -1.0], [0, bodyCy + 4.2, -4.6]], [0.9, 1.3, 0.8], 'fur2'),
                ]
              : []),
          ],
        },
        {
          name: 'head',
          pivot: [0, headCy, 1.4],
          layers: [
            head(headC, headR, { p: headP }),
            // 两腮肉：家猪最圆的地方
            ell([2.8, headCy - 1.4, snoutZ - 1.6], [2.0, 2.2, 2.0], 'fur'),
            ell([-2.8, headCy - 1.4, snoutZ - 1.6], [2.0, 2.2, 2.0], 'fur'),
            // 鼻子盘：一块几乎垂直的扁平圆盘，不是狗的锥形嘴。
            // 宽度只有脸的一半、高度 1/3 左右，太大了就成了熊嘴
            {
              kind: 'ellipsoid',
              c: [0, snoutY, snoutZ + (boar ? 1.6 : 0.5)],
              r: boar ? [1.3, 1.1, 1.9] : [1.9, 1.15, 0.8],
              p: 2.4,
              color: 'nose',
            },
            // 野猪的獠牙
            ...(boar
              ? [
                  cap([[1.5, snoutY - 1.4, snoutZ + 2.0], [2.0, snoutY - 0.2, snoutZ + 2.9]], [0.5, 0.2], 'belly'),
                  cap([[-1.5, snoutY - 1.4, snoutZ + 2.0], [-2.0, snoutY - 0.2, snoutZ + 2.9]], [0.5, 0.2], 'belly'),
                ]
              : []),
          ],
          decal: PIG_FACE,
        },
        pigEar(str(t, 'ears', 'flop'), 1),
        pigEar(str(t, 'ears', 'flop'), -1),
        ...legs({ x: 3.1, front: 2.2, back: t0 + 2.6, top: 5.2, r: 1.5, paw: 'paw' }),
        // 卷尾巴
        {
          name: 'tail',
          pivot: [0, bodyCy + 1.6, t0],
          layers: [
            cap(
              [
                [0, bodyCy + 1.6, t0],
                [0, bodyCy + 3.0, t0 - 1.8],
                [0, bodyCy + 4.2, t0 - 0.6],
                [0, bodyCy + 3.4, t0 + 0.6],
              ],
              [0.85, 0.85, 0.85, 0.8],
            ),
          ],
        },
      ], { lift: 0.4, neck: [-0.4, 0.4], legR: 1.05 }),
    }
  },
}

// ===========================================================================
// 浣熊：灰身子 + 横过眼睛的黑色「强盗面罩」+ 一条一圈黑一圈灰的尾巴。
// 面罩和环纹是两个瞬间识别的特征，缺一个就变成一只灰猫。
// ===========================================================================

const RACCOON_FACE = sym(30, [
  '.............',
  '...BBBBBBBBB.',
  '..DDDDDDDDDD.',
  '..DDKKKDDDDD.',
  '..DDKWKDDDDD.',
  '..DDKKKDDDDD.',
  '..DDDDDDDDDD.',
  '.............',
  '...........NN',
  '..........M..',
  '...........M.',
])

function raccoonEar(s: 1 | -1): PartDef {
  const f = side(s)
  return {
    name: s === 1 ? 'earR' : 'earL',
    parent: 'head',
    pivot: f([4.0, 16.0, 0.4]),
    layers: [
      rotEll(f([4.4, 17.8, 0.4]), [2.0, 2.2, 1.1], [0, 0, -s * 0.35], 'ear'),
      rotEll(f([4.45, 17.9, 1.0]), [1.2, 1.4, 0.5], [0, 0, -s * 0.35], 'inner', true),
    ],
  }
}

const raccoon: VoxelDesign = {
  id: 'raccoon',
  palette: {
    ...BASE_PALETTE,
    fur: '#9c9a9e',
    fur2: '#2c282e',
    ear: '#8a888d',
    belly: '#eae7e2',
    muzzle: '#f2f0ec',
    paw: '#2f2b31',
  },
  breeds: [{ id: 'raccoon-grey', name: '浣熊', weight: 1 }],
  build: () => {
    const headP = 2.8
    const headC: Vec3 = [0, 12.8, 1.6]
    const headR: Vec3 = [5.9, 5.0, 4.8]
    const bodyCy = 6.2
    const bodyRy = 4.2
    const bodyR: Vec3 = [4.9, bodyRy, 5.6]
    const bodyZ = 2.6 - bodyR[2]
    const neckY = bodyCy + bodyRy - 1.4 - (headC[1] - headR[1])
    const front = faceFront(headC, headR, headP, undefined, 10.6)
    const t0 = bodyZ - bodyR[2] + 1.0
    // 尾巴粗而长，接近水平地拖在身后，好让环纹垂直于尾巴
    const tailPath: Vec3[] = [
      [0, 8.0, t0],
      [0, 7.6, t0 - 2.6],
      [0, 7.0, t0 - 5.4],
      [0, 6.4, t0 - 8.0],
    ]
    return {
      fuzz: 0.45,
      parts: stance([
        {
          name: 'body',
          pivot: [0, bodyCy, bodyZ],
          layers: [body([0, bodyCy, bodyZ], bodyR), ell([0, bodyCy - 0.5, 2.2], [3.3, 3.0, 2.0], 'belly', true)],
        },
        {
          name: 'head',
          pivot: [0, 9.6, 1.2],
          layers: [
            head(headC, headR, { p: headP }),
            // 浣熊的吻比较尖长，白嘴白下巴
            muzzle(0, 10.5, front, 2.4, 1.7, 2.0, 'muzzle'),
            ...cheeks(10.2, front, 2.0, 0.8, 'muzzle'),
          ],
          decal: RACCOON_FACE,
        },
        raccoonEar(1),
        raccoonEar(-1),
        ...legs({ x: 2.7, front: 1.6, back: t0 + 2.0, top: 5.0, r: 1.35, color: 'fur', paw: 'paw' }),
        {
          name: 'tail',
          pivot: tailPath[0],
          layers: [cap(tailPath, [1.4, 2.4, 2.3, 1.6])],
          // 环纹：沿尾巴每 2 格换一次色
          paint: (_x, y, z, cur) => (cur === 'fur' && Math.floor((z + 40) / 2.1) % 2 === 0 ? 'fur2' : undefined),
        },
      ], { lift: 0.7, legR: 1.0, neck: [neckY, 0.5] }),
    }
  },
}

// ===========================================================================
// 羊
//   绵羊：一整团羊毛（不是光滑的身体）+ 一张小小的深色脸从毛里探出来 + 四根细腿
//   山羊：短毛的瘦身子 + 向后弯的长角 + 竖起来的耳朵 + 下巴一撮胡须
// 两者不靠颜色区分：角和毛是两套完全不同的轮廓。
// ===========================================================================

// 绵羊的脸在毛团前半部、山羊的脸更高更前，贴花 top 得分开写，否则眼睛会顶到头顶
const SHEEP_FACE = sym(22, [
  '.............',
  '.............',
  '.............',
  '.......BBBBB.',
  '......BBKKKBB',
  '......BBKWKBB',
  '.......BBKKBB',
  '.............',
  '............N',
  '...........M.',
  '............M',
])

const GOAT_FACE = sym(25, [
  '.............',
  '.............',
  '.......BBBBB.',
  '......BBKKKBB',
  '......BBKWKBB',
  '.......BBKKBB',
  '.............',
  '............N',
  '...........M.',
  '............M',
])

/** 羊毛：一大团 + 头顶三团 + 后臀一团。团数少、每团大，轮廓才是云而不是疙瘩 */
function woolClumps(bodyCy: number, bodyZ: number): Layer[] {
  return [
    body([0, bodyCy, bodyZ], [5.2, 4.2, 5.4]),
    ell([0, bodyCy + 3.2, bodyZ + 1.0], [3.8, 2.2, 4.2]),
    ell([3.0, bodyCy + 2.4, bodyZ - 1.4], [2.4, 2.2, 2.8]),
    ell([-3.0, bodyCy + 2.4, bodyZ - 1.4], [2.4, 2.2, 2.8]),
    ell([0, bodyCy + 0.6, bodyZ - 4.2], [3.6, 3.4, 2.4]),
    // 脖子：把毛往前推到脸的根部，脸才不像贴上去的
    ell([0, bodyCy + 0.6, bodyZ + 6.0], [2.9, 2.7, 1.8]),
  ]
}

const sheep: VoxelDesign = {
  id: 'sheep',
  palette: { ...BASE_PALETTE, fur: '#efe7d8', fur2: '#46404a', ear: '#5a5358', belly: '#f7f2e8', muzzle: '#6b6367', paw: '#3f3a3e' },
  breeds: [
    { id: 'sheep-wool', name: '绵羊', weight: 3, traits: { kind: 'wool' } },
    {
      id: 'sheep-goat',
      name: '山羊',
      weight: 2,
      traits: { kind: 'goat' },
      palette: { fur: '#e2d8c6', fur2: '#6b6157', ear: '#cbbfa9', belly: '#f2ece0', muzzle: '#7a6f62', paw: '#4a4239' },
    },
  ],
  build: (t) => {
    const goat = str(t, 'kind', 'wool') === 'goat'
    const headP = goat ? 2.7 : 2.8
    const bodyCy = goat ? 8.6 : 7.4
    const bodyRy = goat ? 3.2 : 4.6
    const bodyZ = goat ? -0.2 : -1.2
    // 绵羊的脸小而圆、从毛里往前探出来；山羊的脸窄而长
    const headC: Vec3 = goat ? [0, 12.4, 3.6] : [0, 10.6, 4.8]
    const headR: Vec3 = goat ? [3.1, 3.2, 3.9] : [2.8, 2.9, 3.0]
    const front = faceFront(headC, headR, headP, undefined, headC[1] - 0.8)
    const parts: PartDef[] = [
      {
        name: 'body',
        pivot: [0, bodyCy, bodyZ],
        layers: goat
          ? [
              { kind: 'ellipsoid', c: [0, bodyCy, bodyZ], r: [3.6, bodyRy, 5.4], p: 2.2, color: 'fur' },
              ell([0, bodyCy - 0.6, bodyZ + 2.0], [2.4, 2.2, 1.8], 'belly', true),
            ]
          : woolClumps(bodyCy, bodyZ),
      },
      {
        name: 'head',
        pivot: [0, bodyCy - 1.0, 2.0],
        layers: [
          { kind: 'ellipsoid', c: headC, r: headR, p: headP, color: 'fur2' },
          // 吻：山羊更长更窄，绵羊短一点、位置压在眼睛下面
          muzzle(
            0,
            headC[1] - (goat ? 1.0 : 1.9),
            front,
            goat ? 1.5 : 1.7,
            goat ? 1.3 : 1.25,
            goat ? 2.4 : 1.6,
            'muzzle',
          ),
          // 山羊的下巴胡须
          ...(goat
            ? [cap([[0, headC[1] - 2.6, front - 0.6], [0, headC[1] - 4.6, front - 1.6]], [0.8, 0.5], 'fur2')]
            : []),
          // 绵羊额头上的一撮毛
          ...(goat ? [] : [ell([0, headC[1] + 2.4, headC[2] + 0.8], [1.6, 1.0, 1.5], 'fur')]),
        ],
        decal: goat ? GOAT_FACE : SHEEP_FACE,
      },
    ]
    if (goat) {
      // 向后上方弯的长角
      for (const s of [1, -1] as const) {
        parts.push({
          name: s === 1 ? 'earR' : 'earL',
          parent: 'head',
          pivot: [s * 2.2, headC[1] + 2.8, headC[2] - 0.4],
          layers: [
            cap(
              [
                [s * 2.2, headC[1] + 2.8, headC[2] - 0.4],
                [s * 3.0, headC[1] + 4.6, headC[2] - 1.8],
                [s * 3.4, headC[1] + 5.0, headC[2] - 3.8],
              ],
              [1.0, 0.7, 0.4],
              'ear',
            ),
            // 竖起来的耳朵，在角下面
            tri([s * 3.0, headC[1] + 1.6, headC[2] + 0.4], [s * 4.6, headC[1] + 2.6, headC[2] - 0.8], [s * 6.4, headC[1] + 3.0, headC[2] - 1.6], 1.0, 'ear'),
          ],
        })
      }
    } else {
      // 垂下来的小耳
      for (const s of [1, -1] as const) {
        parts.push({
          name: s === 1 ? 'earR' : 'earL',
          parent: 'head',
          pivot: [s * 2.6, headC[1] + 1.6, headC[2] + 0.4],
          layers: [rotEll([s * 4.2, headC[1] + 0.2, headC[2] - 0.4], [1.9, 0.85, 1.1], [0, 0, s * 0.45], 'ear')],
        })
      }
    }
    parts.push(
      ...legs({
        x: goat ? 2.2 : 2.8,
        front: goat ? 2.6 : 3.0,
        back: goat ? -3.4 : -4.6,
        top: goat ? 8.0 : 6.4,
        r: goat ? 0.95 : 1.15,
        color: 'fur2',
        smooth: true,
      }),
    )
    parts.push({
      name: 'tail',
      pivot: [0, bodyCy + 1.2, bodyZ - 5.4],
      layers: [
        goat
          ? cap([[0, bodyCy + 1.2, bodyZ - 5.4], [0, bodyCy + 2.6, bodyZ - 6.2]], [0.7, 0.4], 'fur2')
          : ell([0, bodyCy + 0.6, bodyZ - 6.0], [1.7, 1.8, 1.5], 'fur'),
      ],
    })
    return {
      fuzz: goat ? 0.35 : 1.05,
      parts: stance(parts, { lift: 0, neck: [0, 0] }),
    }
  },
}

// ===========================================================================
// 刺猬：一个低矮的圆拱壳 + 壳上一根根朝外支出去的尖刺 + 从壳前面伸出来的尖鼻子。
// 刺不能只是「表面的毛」：必须撑出轮廓，侧面看才是一把会走路的刷子。
// 所以刺从壳体表面往外长 2 格，而且是沿着法线方向、长度足够、顶端收成尖的。
// ===========================================================================

function hedgehogSpikes(cy: number, cz: number, rx: number, ry: number, rz: number): Layer[] {
  const out: Layer[] = []
  // 按「从头顶往外一圈圈」排，保证整个壳（包括两侧）都长满刺，
  // 侧面轮廓才是一把刷子，而不是头顶稀稀拉拉几根。
  const rings = [0.18, 0.5, 0.82, 1.12, 1.36]
  const counts = [1, 7, 11, 13, 13]
  for (let r = 0; r < rings.length; r++) {
    const theta = rings[r]
    for (let i = 0; i < counts[r]; i++) {
      const phi = counts[r] === 1 ? 0 : (i / counts[r]) * Math.PI * 2 + (r % 2 ? 0.28 : 0)
      const sx = Math.sin(theta) * Math.cos(phi)
      const sz = Math.sin(theta) * Math.sin(phi)
      const sy = Math.cos(theta)
      const x = rx * sx * 0.9
      const z = cz + rz * sz * 0.9
      const y = cy + ry * sy * 0.9
      // 正前方整片留出来给脸：不然会有一根刺从脸上方伸出去
      if (sz > 0.42) continue
      const n: Vec3 = [x / (rx * rx), (y - cy) / (ry * ry), (z - cz) / (rz * rz)]
      const len = Math.hypot(n[0], n[1], n[2])
      const k = 2.2 / len
      out.push(cap([[x, y, z], [x + (n[0] / len) * k, y + (n[1] / len) * k, z + (n[2] / len) * k]], [0.8, 0.22], 'fur2'))
    }
  }
  return out
}

const hedgehog: VoxelDesign = {
  id: 'hedgehog',
  palette: { ...BASE_PALETTE, fur: '#e2c9a8', fur2: '#4a3a2c', belly: '#f4e6d2', muzzle: '#f4e6d2', paw: '#6b5744' },
  breeds: [{ id: 'hedgehog-brown', name: '刺猬', weight: 1 }],
  build: () => {
    const cy = 5.2
    const cz = -1.4
    const rx = 4.6
    const ry = 3.1
    const rz = 5.0
    const faceZ = cz + rz * 0.92
    return {
      fuzz: 0.2,
      parts: stance([
        {
          name: 'body',
          pivot: [0, cy, cz],
          layers: [
            // 浅色的下身：肚子和四条腿根
            { kind: 'ellipsoid', c: [0, cy - 1.0, cz], r: [4.4, 2.9, 4.9], p: 2.2, color: 'fur' },
            // 深色的刺壳，比刺的根小一圈，刺才不会被吃掉
            { kind: 'ellipsoid', c: [0, cy, cz], r: [4.1, 3.0, 4.6], p: 2.2, color: 'fur2' },
            ...hedgehogSpikes(cy, cz, rx, ry, rz),
          ],
        },
        {
          name: 'head',
          pivot: [0, 3.0, 1.6],
          layers: [
            // 吻：从壳的前下方伸出来的一根锥子，越往前越细
            cap([[0, 5.4, faceZ - 0.6], [0, 4.6, faceZ + 2.6], [0, 3.9, faceZ + 4.6]], [2.6, 1.7, 0.72], 'muzzle'),
            { kind: 'ellipsoid', c: [0, 3.85, faceZ + 5.1], r: [0.7, 0.65, 0.6], p: 2, color: 'nose' },
            // 眼睛和耳朵用小球，锥面上贴花会歪
            { kind: 'ellipsoid', c: [1.45, 5.5, faceZ + 0.4], r: [0.6, 0.72, 0.55], p: 2, color: 'eye' },
            { kind: 'ellipsoid', c: [-1.45, 5.5, faceZ + 0.4], r: [0.6, 0.72, 0.55], p: 2, color: 'eye' },
            { kind: 'ellipsoid', c: [2.3, 6.3, faceZ - 1.2], r: [0.85, 1.0, 0.45], p: 2, color: 'fur' },
            { kind: 'ellipsoid', c: [-2.3, 6.3, faceZ - 1.2], r: [0.85, 1.0, 0.45], p: 2, color: 'fur' },
          ],
        },
        ...legs({ x: 2.6, front: 2.2, back: -3.6, top: 4.2, r: 1.0, color: 'paw', paw: 'paw' }),
      ], { lift: 0.4, legR: 1.0, neck: [0, 0] }),
    }
  },
}

export const VOXEL_DESIGNS: Record<string, VoxelDesign> = { cat, dog, fox, panda, bunny, squirrel, pig, raccoon, sheep, hedgehog }
