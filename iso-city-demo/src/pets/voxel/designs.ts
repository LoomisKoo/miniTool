// 体素宠物图纸：每个物种一个模板，品种 = 调色板 + 特征组合。
//
// Q 版比例的硬规则：头和身体差不多大、腿只有 3~4 格、眼睛在脸的中下部且
// 左右拉开；每个物种只放大一个最好认的特征。整只约 22~24 基础格高。
//
// 特征槽按物种定义、互不通用：猫有折耳，狗有卷尾、短腿，兔子有垂耳。
// 新增品种 = 在 breeds 里加一行（换色 + 选特征）；新增特征 = 在模板里加一个分支。
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
const cap = (pts: Vec3[], r: number[], color = 'fur', paint = false): Layer => ({ kind: 'capsule', pts, r, color, paint })
const tri = (a: Vec3, b: Vec3, c: Vec3, t: number, color = 'fur', paint = false): Layer => ({ kind: 'tri', a, b, c, t, color, paint })
/** 头用超椭球：正脸是平的，像素脸不会被曲面扭歪 */
const head = (c: Vec3, r: Vec3): Layer => ({ kind: 'ellipsoid', c, r, p: 2.6, color: 'fur' })
const body = (c: Vec3, r: Vec3): Layer => ({ kind: 'ellipsoid', c, r, p: 2.3, color: 'fur' })
/**
 * 口鼻块：脸的第二层。正面是平的（超椭球），往后埋进头里，只露出 depth 格。
 * front = 头正脸所在的 z。
 */
const muzzle = (x: number, y: number, front: number, w: number, h: number, depth: number, color = 'muzzle'): Layer => {
  const rz = depth + 2
  return { kind: 'ellipsoid', c: [x, y, front + depth - rz], r: [w, h, rz], p: 3, color, smooth: true }
}
/** 猫、兔子的 ω 形双鼓包 */
const cheeks = (y: number, front: number, w = 1.9, color = 'muzzle'): Layer[] => [
  muzzle(1.3, y, front, w, 1.5, 1.2, color),
  muzzle(-1.3, y, front, w, 1.5, 1.2, color),
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

type LegSpec = { x: number; front: number; back: number; top: number; r: number; color?: string; paw?: string }

function legs(spec: LegSpec): PartDef[] {
  const make = (name: PartDef['name'], x: number, z: number): PartDef => {
    const top: Vec3 = [x, spec.top, z]
    const r = spec.r
    const layers: Layer[] = [cap([top, [x, r - 0.2, z]], [r, r], spec.color ?? 'fur')]
    if (spec.paw) layers.push({ kind: 'box', min: [x - r - 1, -1, z - r - 1], max: [x + r + 1, 1.6, z + r + 1], color: spec.paw, paint: true })
    return { name, pivot: top, layers }
  }
  return [make('legFL', -spec.x, spec.front), make('legFR', spec.x, spec.front), make('legBL', -spec.x, spec.back), make('legBR', spec.x, spec.back)]
}

/** 整体上下平移（短腿品种把身体、头、尾巴一起往下放） */
function shiftY(part: PartDef, dy: number): PartDef {
  const v = (p: Vec3): Vec3 => [p[0], p[1] + dy, p[2]]
  const layers = part.layers.map((l): Layer => {
    switch (l.kind) {
      case 'ellipsoid':
        return { ...l, c: v(l.c) }
      case 'capsule':
        return { ...l, pts: l.pts.map(v) }
      case 'tri':
        return { ...l, a: v(l.a), b: v(l.b), c: v(l.c) }
      case 'box':
        return { ...l, min: v(l.min), max: v(l.max) }
    }
  })
  const paint = part.paint
  return {
    ...part,
    pivot: v(part.pivot),
    layers,
    decal: part.decal && { ...part.decal, top: part.decal.top + Math.round(dy * (part.decal.res ?? 1)) },
    paint: paint && ((x, y, z, cur) => paint(x, y - dy, z, cur)),
  }
}

const str = (t: Traits, key: string, fallback: string) => (typeof t[key] === 'string' ? (t[key] as string) : fallback)
const num = (t: Traits, key: string, fallback: number) => (typeof t[key] === 'number' ? (t[key] as number) : fallback)

const EYES = [
  '....KK.......',
  '...KWKK......',
  '...KKKK......',
  '...KKWK......',
  '....KK.......',
]

// ===========================================================================
// 猫
//   ears: pointed 尖耳 | small 小圆耳（英短）| folded 折耳
//   face: normal | round 大圆脸
//   tail: long | fluffy 大蓬尾
//   fur:  毛边幅度，短毛 0.55，长毛 0.95
//   pattern: plain | tabby 虎斑 | calico 三花 | tuxedo 奶牛 | point 重点色
// ===========================================================================

function catEar(kind: string, s: 1 | -1): PartDef {
  const f = side(s)
  const name = s === 1 ? 'earR' : 'earL'
  if (kind === 'folded') {
    // 折耳：一小片向前扣在头顶
    return {
      name,
      parent: 'head',
      pivot: f([3.4, 17.0, 1.0]),
      layers: [{ kind: 'ellipsoid', c: f([3.5, 17.6, 1.8]), r: [2.0, 1.1, 1.7], rot: [0.55, 0, -s * 0.2], color: 'fur' }],
    }
  }
  if (kind === 'small') {
    return {
      name,
      parent: 'head',
      pivot: f([4.0, 16.0, 0.6]),
      layers: [
        tri(f([2.6, 16.4, 0.6]), f([6.0, 15.4, 0.6]), f([5.1, 19.6, 0.5]), 2.6),
        tri(f([3.4, 16.6, 1.7]), f([5.4, 16.0, 1.7]), f([4.9, 18.6, 1.6]), 1.1, 'inner', true),
      ],
    }
  }
  return {
    name,
    parent: 'head',
    pivot: f([4.3, 15.9, 0.6]),
    layers: [
      tri(f([2.2, 16.6, 0.6]), f([6.4, 15.2, 0.6]), f([5.6, 21.4, 0.4]), 2.6),
      tri(f([3.2, 16.8, 1.7]), f([5.6, 16.0, 1.7]), f([5.2, 19.8, 1.6]), 1.1, 'inner', true),
    ],
  }
}

type PaintTarget = 'head' | 'body' | 'tail' | 'ear'

function catPaint(pattern: string, target: PaintTarget): PartDef['paint'] {
  return (x, y, z, cur) => {
    if (cur !== 'fur') return undefined
    switch (pattern) {
      case 'tabby':
        if (target === 'head') return y > 16 && y < 18.6 && z > 1.5 && Math.abs(x) < 2.6 && Math.floor(x + 10) % 2 === 1 ? 'fur2' : undefined
        if (target === 'body') return y > 7.4 && Math.floor((z + 20) / 1.5) % 2 === 0 ? 'fur2' : undefined
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
    }
    return undefined
  }
}

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
    nose: '#f08a9a',
  },
  breeds: [
    { id: 'cat-tabby', name: '狸花猫', weight: 3, traits: { pattern: 'tabby' }, palette: { fur: '#9c8466', fur2: '#4f3f30', belly: '#efe6d6', muzzle: '#efe6d6', paw: '#efe6d6', eye: '#4f7d22' } },
    { id: 'cat-orange', name: '橘猫', weight: 3, traits: { pattern: 'tabby' }, palette: { fur: '#f0a04b', fur2: '#cc6f24', belly: '#fff3e2', muzzle: '#fff3e2', paw: '#fff3e2' } },
    { id: 'cat-bsh', name: '英短蓝猫', weight: 2, traits: { ears: 'small', face: 'round' }, palette: { fur: '#8f98a8', belly: '#8f98a8', muzzle: '#9aa3b2', paw: '#8f98a8', eye: '#c27a12', nose: '#6f6878' } },
    { id: 'cat-calico', name: '三花猫', weight: 2, traits: { pattern: 'calico' }, palette: { fur: '#f6f2ea', fur2: '#e8913f', fur3: '#3a3437', belly: '#fbf8f2', muzzle: '#fbf8f2', paw: '#fbf8f2' } },
    { id: 'cat-tuxedo', name: '奶牛猫', weight: 2, traits: { pattern: 'tuxedo' }, palette: { fur: '#2f2b31', belly: '#f7f4ee', muzzle: '#f7f4ee', paw: '#f7f4ee', eye: '#d9a91f', shine: '#fff8cc' } },
    { id: 'cat-siamese', name: '暹罗猫', weight: 1, traits: { pattern: 'point' }, palette: { fur: '#efe2cc', point: '#4e3a31', belly: '#f3e9d8', muzzle: '#4e3a31', paw: '#4e3a31', eye: '#2f86d6', nose: '#3a2a2e' } },
    { id: 'cat-ragdoll', name: '布偶猫', weight: 1, traits: { pattern: 'point', fur: 0.95, tail: 'fluffy', face: 'round' }, palette: { fur: '#f4ede2', point: '#8a7466', belly: '#ffffff', muzzle: '#ffffff', paw: '#ffffff', eye: '#2f86d6' } },
    { id: 'cat-fold', name: '折耳猫', weight: 1, traits: { ears: 'folded', face: 'round', pattern: 'tabby' }, palette: { fur: '#bdbab4', fur2: '#6d6a66', belly: '#f2f0ec', muzzle: '#f2f0ec', paw: '#f2f0ec', eye: '#c98d22' } },
    { id: 'cat-black', name: '黑猫', weight: 1, palette: { fur: '#34303a', belly: '#34303a', muzzle: '#3e3a44', paw: '#34303a', eye: '#e2bf1e', shine: '#fff8cc', nose: '#4a3a44' } },
    { id: 'cat-white', name: '白猫', weight: 1, palette: { fur: '#f6f3ee', belly: '#ffffff', muzzle: '#ffffff', paw: '#ffffff', eye: '#3f8fd8' } },
  ],
  build: (t) => {
    const pattern = str(t, 'pattern', 'plain')
    const round = str(t, 'face', 'normal') === 'round'
    const fluffy = str(t, 'tail', 'long') === 'fluffy'
    const tailR = fluffy ? [1.8, 1.9, 1.9, 1.7] : [1.3, 1.25, 1.2, 1.1]
    const tailLayers: Layer[] = [cap([[0, 6.5, -6], [0, 8.5, -8.6], [0, 12, -9.4], [0.6, 14.2, -8.6]], tailR)]
    if (pattern === 'tabby') tailLayers.push(ell([0.6, 14, -8.7], [1.7, 1.7, 1.7], 'fur2', true))
    return {
      fuzz: num(t, 'fur', 0.55),
      parts: [
        {
          name: 'body',
          pivot: [0, 6.5, -1.5],
          layers: [body([0, 6.6, -1.4], [4.0, 3.6, 5.0]), ell([0, 5.8, 1.8], [3.0, 2.8, 2.2], 'belly', true)],
          paint: catPaint(pattern, 'body'),
        },
        {
          name: 'head',
          pivot: [0, 9.5, 1.2],
          layers: [round ? head([0, 12.9, 1.4], [6.9, 5.2, 5.0]) : head([0, 13, 1.4], [6.2, 5.3, 5.0]), ...cheeks(10.6, 6.4, round ? 2.2 : 1.9)],
          paint: catPaint(pattern, 'head'),
          decal: sym(29, [...EYES, '.............', '..PPP......NN', '..PPP.......N', '..........M.M', '...........M.']),
        },
        { ...catEar(str(t, 'ears', 'pointed'), 1), paint: catPaint(pattern, 'ear') },
        { ...catEar(str(t, 'ears', 'pointed'), -1), paint: catPaint(pattern, 'ear') },
        ...legs({ x: 2.3, front: 1.6, back: -4.4, top: 5, r: 1.55, paw: 'paw' }),
        { name: 'tail', pivot: [0, 6.5, -6], layers: tailLayers, paint: catPaint(pattern, 'tail') },
      ],
    }
  },
}

// ===========================================================================
// 狗
//   ears:  floppy 耷拉耳 | pricked 立耳（柴犬、哈士奇）| big 大立耳（柯基、法斗）| fluffy 毛团耳（泰迪、比熊）
//   snout: normal | long 长嘴（金毛）| flat 扁脸（法斗）
//   tail:  short | curl 卷尾 | fluffy 毛球尾 | stub 几乎没有
//   legs:  normal | short 短腿；length 身长倍数
//   topknot: 1 = 头顶一团毛（泰迪、比熊）
//   fur:   毛边幅度
//   pattern: plain | urajiro 柴犬白脸颊 | husky 哈士奇面罩 | corgi 柯基白胸口和额头
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
        layers: [tri(f([2.4, 16.8, 0.6]), f([6.0, 15.6, 0.6]), f([4.8, 20.8, 0.5]), 2.4, 'ear'), tri(f([3.3, 17.0, 1.6]), f([5.3, 16.3, 1.6]), f([4.6, 19.4, 1.5]), 1.0, 'inner', true)],
      }
    case 'big':
      return {
        name,
        parent: 'head',
        pivot: f([4.2, 16.0, 0.4]),
        layers: [tri(f([1.8, 16.6, 0.4]), f([6.6, 15.4, 0.4]), f([5.8, 22.6, 0.2]), 2.2, 'ear'), tri(f([2.9, 16.9, 1.4]), f([5.8, 16.1, 1.4]), f([5.4, 21.0, 1.3]), 1.0, 'inner', true)],
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
    case 'curl':
      // 卷尾：从屁股往上翻、卷回背上
      return { name: 'tail', pivot: at([0, 8.4, -6.2]), layers: [cap([at([0, 8.4, -6.2]), at([0, 11.4, -7.6]), at([0, 13.2, -6.0]), at([0, 12.4, -4.2])], [1.6, 1.8, 1.7, 1.4])] }
    case 'fluffy':
      return { name: 'tail', pivot: at([0, 8.4, -6.2]), layers: [cap([at([0, 8.4, -6.2]), at([0, 9.6, -7.2])], [1.2, 1.2]), ell(at([0, 10.4, -7.6]), [2.3, 2.5, 2.3])] }
    case 'stub':
      return { name: 'tail', pivot: at([0, 7.6, -6.4]), layers: [ell(at([0, 7.8, -6.6]), [1.3, 1.2, 1.2])] }
    default:
      return { name: 'tail', pivot: at([0, 8, -6.4]), layers: [cap([at([0, 8, -6.4]), at([0, 10.2, -7.8]), at([0, 11.8, -7.4])], [1.4, 1.3, 1.1])] }
  }
}

function dogPaint(pattern: string, target: PaintTarget): PartDef['paint'] {
  return (x, y, z, cur) => {
    if (cur !== 'fur') return undefined
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
    }
    return undefined
  }
}

const DOG_FACE = sym(31, [...EYES, '.............', '..PPP.....NNN', '..PPP.....NNN', '...........NN', '............N', '............M', '..........MM.'])

const dog: VoxelDesign = {
  id: 'dog',
  palette: { ...BASE_PALETTE, fur: '#c98a5a', ear: '#8f5a36', belly: '#f6e9d8', paw: '#f6e9d8', muzzle: '#f6e9d8', nose: '#2c2224' },
  breeds: [
    { id: 'dog-mutt', name: '中华田园犬', weight: 3 },
    { id: 'dog-shiba', name: '柴犬', weight: 3, traits: { ears: 'pricked', tail: 'curl', pattern: 'urajiro' }, palette: { fur: '#d98a43', ear: '#d98a43', belly: '#fbf3e6', muzzle: '#fbf3e6', paw: '#fbf3e6' } },
    { id: 'dog-corgi', name: '柯基', weight: 2, traits: { ears: 'big', legs: 'short', length: 1.22, tail: 'stub', pattern: 'corgi' }, palette: { fur: '#e09a4c', ear: '#e09a4c', belly: '#fbf5ea', muzzle: '#fbf5ea', paw: '#fbf5ea' } },
    { id: 'dog-golden', name: '金毛', weight: 2, traits: { snout: 'long', fur: 0.8, tail: 'fluffy' }, palette: { fur: '#e8b665', ear: '#d9a04f', belly: '#f6dcaa', muzzle: '#f2d29c', paw: '#f2d29c' } },
    { id: 'dog-poodle', name: '泰迪', weight: 2, traits: { ears: 'fluffy', topknot: 1, fur: 1.0, tail: 'fluffy' }, palette: { fur: '#9a5b38', ear: '#8c5032', belly: '#9a5b38', muzzle: '#a8673f', paw: '#9a5b38' } },
    { id: 'dog-husky', name: '哈士奇', weight: 1, traits: { ears: 'pricked', tail: 'curl', pattern: 'husky' }, palette: { fur: '#5f6673', ear: '#5f6673', belly: '#f4f3f0', muzzle: '#f4f3f0', paw: '#f4f3f0', eye: '#2f8fd0' } },
    { id: 'dog-frenchie', name: '法斗', weight: 1, traits: { ears: 'big', snout: 'flat', tail: 'stub', fur: 0.25 }, palette: { fur: '#d8bd93', ear: '#d8bd93', belly: '#efe0c6', muzzle: '#5a4a40', paw: '#efe0c6' } },
    { id: 'dog-bichon', name: '比熊', weight: 1, traits: { ears: 'fluffy', topknot: 1, fur: 1.1, tail: 'fluffy' }, palette: { fur: '#fbf8f2', ear: '#f4efe6', belly: '#fbf8f2', muzzle: '#ffffff', paw: '#fbf8f2' } },
  ],
  build: (t) => {
    const pattern = str(t, 'pattern', 'plain')
    const short = str(t, 'legs', 'normal') === 'short'
    const length = num(t, 'length', 1)
    const back = (length - 1) * 5
    const snout = str(t, 'snout', 'normal')
    const drop = short ? -1.5 : 0

    const headLayers: Layer[] = [head([0, 13.2, 1.2], [6.0, 5.2, 4.9])]
    if (snout === 'long') headLayers.push(muzzle(0, 11, 6.1, 2.9, 2.1, 3.6))
    else if (snout === 'flat') headLayers.push(muzzle(0, 10.8, 6.1, 3.4, 2.2, 1.2))
    else headLayers.push(muzzle(0, 11, 6.1, 3.2, 2.3, 2.6))
    if (t.topknot) headLayers.push(ell([0, 17.8, 0.8], [4.2, 2.6, 3.8]))

    const upper: PartDef[] = [
      {
        name: 'body',
        pivot: [0, 6.5, -1.5 - back / 2],
        layers: [body([0, 6.6, -1.6 - back / 2], [4.2, 3.7, 5.3 * length]), ell([0, 5.8, 1.8], [3.1, 2.9, 2.3], 'belly', true)],
        paint: dogPaint(pattern, 'body'),
      },
      { name: 'head', pivot: [0, 9.5, 1], layers: headLayers, decal: DOG_FACE, paint: dogPaint(pattern, 'head') },
      dogEar(str(t, 'ears', 'floppy'), 1),
      dogEar(str(t, 'ears', 'floppy'), -1),
      { ...dogTail(str(t, 'tail', 'short'), -back), paint: dogPaint(pattern, 'tail') },
    ]
    return {
      fuzz: num(t, 'fur', 0.5),
      parts: [
        ...upper.map((p) => (drop ? shiftY(p, drop) : p)),
        ...legs({ x: 2.4, front: 1.6, back: -4.6 - back, top: 5 + drop, r: 1.6, paw: 'paw' }),
      ],
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
  build: () => ({
    fuzz: 0.6,
    parts: [
      {
        name: 'body',
        pivot: [0, 7, -1],
        layers: [
          body([0, 7, -1], [4.8, 4.2, 5.2]),
          // 肩带：黑色一圈连到前腿
          ell([0, 8.2, 1.6], [5.2, 4.6, 1.9], 'fur2', true),
        ],
      },
      {
        name: 'head',
        pivot: [0, 10, 1.2],
        layers: [head([0, 13.4, 1.4], [6.5, 5.4, 5.1]), muzzle(0, 11, 6.5, 2.8, 1.9, 1.4)],
        decal: sym(32, [
          '......DDD....',
          '.....DDDDD...',
          '....DDKKDDD..',
          '...DDKWKKDD..',
          '...DDKKKKDD..',
          '...DDKKWKD...',
          '...DDDKKDD...',
          '....DDDDD....',
          '.....DDD.....',
          '..........NNN',
          '...........NN',
          '............M',
          '..........MM.',
        ]),
      },
      { name: 'earR', parent: 'head', pivot: [4.4, 17.2, 0.6], layers: [ell([4.7, 18.4, 0.6], [2.0, 2.0, 1.5], 'fur2')] },
      { name: 'earL', parent: 'head', pivot: [-4.4, 17.2, 0.6], layers: [ell([-4.7, 18.4, 0.6], [2.0, 2.0, 1.5], 'fur2')] },
      ...legs({ x: 2.7, front: 1.4, back: -4.2, top: 5.4, r: 1.9, color: 'fur2' }),
      { name: 'tail', pivot: [0, 7.5, -6.2], layers: [ell([0, 7.6, -6.3], [1.5, 1.5, 1.2])] },
    ],
  }),
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
      layers: [
        { kind: 'ellipsoid', c: f([5.9, 13.0, 0.8]), r: [1.3, 4.4, 1.9], rot, color: 'fur' },
        { kind: 'ellipsoid', c: f([5.3, 12.6, 0.9]), r: [0.6, 3.4, 1.2], rot, color: 'inner', paint: true },
      ],
    }
  }
  // 扁长的椭球：正面宽、侧面薄，向外张开一点、往后仰一点
  const rot: Vec3 = [-0.12, 0, -s * 0.16]
  return {
    name,
    parent: 'head',
    pivot: f([2.4, 15.8, 0.4]),
    layers: [
      { kind: 'ellipsoid', c: f([2.8, 19.8, 0.4]), r: [1.5, 4.7, 0.95], rot, color: 'fur' },
      { kind: 'ellipsoid', c: f([2.85, 20.0, 1.05]), r: [0.8, 3.8, 0.5], rot, color: 'inner', paint: true },
    ],
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
    { id: 'bunny-black', name: '黑兔', weight: 1, palette: { fur: '#3d3739', belly: '#efe9e2', muzzle: '#efe9e2', paw: '#efe9e2' } },
    { id: 'bunny-lop', name: '垂耳兔', weight: 2, traits: { ears: 'lop', fur: 0.7 }, palette: { fur: '#e8d3b4', belly: '#fbf6ee', muzzle: '#fbf6ee', paw: '#fbf6ee' } },
    { id: 'bunny-dutch', name: '荷兰兔', weight: 1, traits: { pattern: 'dutch' }, palette: { fur: '#3d3739', belly: '#fbf8f3', muzzle: '#fbf8f3', paw: '#fbf8f3' } },
  ],
  build: (t) => {
    const pattern = str(t, 'pattern', 'plain')
    const ears = str(t, 'ears', 'up')
    return {
      fuzz: num(t, 'fur', 0.55),
      parts: [
        {
          name: 'body',
          pivot: [0, 6, -1],
          layers: [
            body([0, 6.1, -1.2], [4.0, 3.6, 4.6]),
            ell([0, 5.4, 1.6], [2.8, 2.6, 2.0], 'belly', true),
            // 大后脚贴在身体两侧
            ell([3.2, 1.6, -2.4], [1.5, 1.6, 2.7]),
            ell([-3.2, 1.6, -2.4], [1.5, 1.6, 2.7]),
          ],
          paint: bunnyPaint(pattern, 'body'),
        },
        {
          name: 'head',
          pivot: [0, 9, 1.2],
          layers: [head([0, 12.4, 1.6], [5.8, 4.9, 4.8]), ...cheeks(10.2, 6.4)],
          paint: bunnyPaint(pattern, 'head'),
          decal: sym(27, [
            '.....KK......',
            '....KWKK.....',
            '....KKKK.....',
            '....KKWK.....',
            '.....KK......',
            '..PPP........',
            '..PPP......NN',
            '..PPP.......N',
            '..........M.M',
            '...........M.',
          ]),
        },
        bunnyEar(ears, 1),
        bunnyEar(ears, -1),
        // 只有前腿会摆：后腿就是身体上的大脚，不单独动
        ...legs({ x: 2.0, front: 1.8, back: -2.4, top: 4.2, r: 1.3, paw: 'paw' }).filter((p) => p.name === 'legFL' || p.name === 'legFR'),
        { name: 'tail', pivot: [0, 6, -5.6], layers: [ell([0, 6.4, -6.0], [2.0, 2.0, 1.8], 'belly')] },
      ],
    }
  },
}

export const VOXEL_DESIGNS: Record<string, VoxelDesign> = { cat, dog, panda, bunny }
