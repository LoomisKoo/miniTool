// 微光城区 · 约 1.6 × 1.2km 总平面（第三版：按真实城区尺度重新规划）
// 纯数据模块：江 / 山 / 路网 / 片区 / 地块 / 建筑 / 店铺 / 街道设施。
// 确定性生成（固定种子），渲染层只负责把这里的东西画出来。
//
// 总体结构（北 = +z）：
//   北山（索道、步道、小庙）── 环城路北段 z=480
//   新住宅西（6 个小区）│ 文教区（大学、图书馆、体育馆、中学）│ 新住宅东（2 个小区）
//   老城（有机街巷、菜市场、小学）│ 商业带 │ 中央公园（小河 + 湖）│ 科技园
//   步行街 + 老码头 │ CBD（江湾内侧，中轴运河 + 地标塔）│ 滨江酒店 + 摩天轮
//   ── 滨江大道（= 环城路南段，沿江弯曲）── 江滩 ── 江

export const CITY = { x0: -760, x1: 760, z1: 480 }
export const BOUNDS = 800
export const SCALE = {
  floor: 3.3,
  door: 2.2,
  sign: 3.85,
  sidewalk: 3,
  curb: 0.15,
  bike: 0.55,
  rail: 1.05,
  bench: 0.45,
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const smooth = (t) => t * t * (3 - 2 * t)
export const lerp = (a, b, t) => a + (b - a) * t

export function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// 江：在城南绕一个大弯，弯道内侧是 CBD
// ---------------------------------------------------------------------------
export const RIVER = { y: -8, half: 55 }
/** 江心线 */
export const riverZ = (x) => -470 - 95 * Math.exp(-(((x - 150) / 280) ** 2))
/** 北岸水边线 */
export const waterN = (x) => riverZ(x) + RIVER.half
// 北岸断面（相对水边线 d）：0~24 江滩(-6m) / 24~34 堤坡 / 34~60 滨江步道 / 60~90 滨江大道 / 90+ 城区
export const BANK = { beach: 24, slope: 34, walk: 60, road: 75 }
/** 滨江大道中心线 = 环城路南段 */
export const southZ = (x) => waterN(x) + BANK.road

// ---------------------------------------------------------------------------
// 路网：主干 40m / 次干 24m / 支路 12m（支路按片区分段铺）+ 老城两条斜街
// ---------------------------------------------------------------------------
export const RING = { x0: CITY.x0, x1: CITY.x1, z1: CITY.z1, r: 110, w: 30 }

/** a: 'x' 表示沿 x 走向（东西向），at 是 z；'z' 表示南北向，at 是 x。from/to：沿走向的有效区间。 */
export const ROADS = [
  // 路宽与 life.js 车道偏移联动：一级路 34m（每侧 3 车道，外侧为公交道），二级路 20m（每侧 1 车道）
  { a: 'x', at: 0, w: 34, tier: 1, name: '人民大道' },
  { a: 'z', at: 0, w: 34, tier: 1, name: '中山路' },
  { a: 'x', at: 250, w: 20, tier: 2, name: '北环路' },
  { a: 'x', at: -220, w: 20, tier: 2, name: '江湾路' },
  { a: 'z', at: -400, w: 20, tier: 2, name: '西岸大道' },
  { a: 'z', at: 400, w: 20, tier: 2, name: '东岸大道' },
  { a: 'x', at: 125, w: 12, tier: 3, to: 0, name: '学府路' },
  { a: 'x', at: 125, w: 12, tier: 3, from: 400, name: '科苑路' },
  { a: 'x', at: -110, w: 12, tier: 3, name: '解放路' },
  { a: 'x', at: -330, w: 12, tier: 3, from: 0, to: 400, name: '江湾支路' },
  { a: 'z', at: -600, w: 12, tier: 3, name: '西关路' },
  { a: 'z', at: -200, w: 12, tier: 3, name: '和平路' },
  { a: 'z', at: 600, w: 12, tier: 3, from: -220, name: '创新路' },
]

/** 路沿自身走向的有效区间。 */
export const roadSpan = (r) => [r.from ?? -Infinity, r.to ?? Infinity]
/** 路在走向坐标 t 处是否存在。 */
export const roadAt = (r, t) => t >= (r.from ?? -Infinity) && t <= (r.to ?? Infinity)
/** 实际铺装区间（被环城路截住）：东西向在 x0~x1 之间，南北向从滨江大道到北环城。 */
export function roadExtent(r) {
  const [s0, s1] = roadSpan(r)
  if (r.a === 'x') return [Math.max(CITY.x0, s0), Math.min(CITY.x1, s1)]
  return [Math.max(southZ(r.at), s0), Math.min(CITY.z1, s1)]
}

/** 老城里的两条斜街，切出三角地块与五岔路口。 */
export const DIAG = [
  { a: [-745, -200], b: [-430, 110], w: 12 },
  { a: [-575, -205], b: [-215, 95], w: 12 },
]

export function distToSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax
  const vz = bz - az
  const wx = px - ax
  const wz = pz - az
  const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz || 1), 0, 1)
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}

export function nearDiag(x, z, pad = 8) {
  for (const d of DIAG) if (distToSeg(x, z, d.a[0], d.a[1], d.b[0], d.b[1]) < d.w / 2 + pad) return true
  return false
}

/** 环城路的中心线（闭合折线）：西 / 北 / 东三段直线 + 四角圆弧 + 南段沿江弯曲。 */
export function ringPath(step = 24) {
  const { x0, x1, z1, r } = RING
  const pts = []
  const push = (x, z) => {
    const last = pts[pts.length - 1]
    if (!last || Math.hypot(last[0] - x, last[1] - z) > 0.4) pts.push([x, z])
  }
  const line = (ax, az, bx, bz) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step))
    for (let i = 0; i <= n; i++) push(lerp(ax, bx, i / n), lerp(az, bz, i / n))
  }
  const arc = (cx, cz, a0, a1) => {
    const n = Math.max(3, Math.round((Math.abs(a1 - a0) * r) / step))
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n)
      push(cx + Math.cos(a) * r, cz + Math.sin(a) * r)
    }
  }
  const s0 = southZ(x0)
  const s1 = southZ(x1)
  line(x0, s0 + r, x0, z1 - r)
  arc(x0 + r, z1 - r, Math.PI, Math.PI / 2)
  line(x0 + r, z1, x1 - r, z1)
  arc(x1 - r, z1 - r, Math.PI / 2, 0)
  line(x1, z1 - r, x1, s1 + r)
  arc(x1 - r, s1 + r, 0, -Math.PI / 2)
  const n = Math.round((x1 - x0 - 2 * r) / step)
  for (let i = 0; i <= n; i++) {
    const x = lerp(x1 - r, x0 + r, i / n)
    push(x, southZ(x))
  }
  arc(x0 + r, s0 + r, -Math.PI / 2, -Math.PI)
  return pts
}

// ---------------------------------------------------------------------------
// 地形：南岸湿地 → 江 → 江滩 → 堤坡 → 城区缓坡（向北抬 6m）→ 北山
// ---------------------------------------------------------------------------
const MOUNT_Z = 500
function mountain(z) {
  const t = clamp((z - MOUNT_Z) / 170, 0, 1)
  let h = 30 * smooth(t)
  if (z > 730) h -= 14 * smooth(clamp((z - 730) / 120, 0, 1))
  return Math.max(0, h)
}

/** 下沉广场（商场南侧）：相对地面再挖 5m。 */
export const SUNKEN = { x0: 72, x1: 128, z0: -102, z1: -78 }

export function inSunken(x, z) {
  return x > SUNKEN.x0 + 1 && x < SUNKEN.x1 - 1 && z > SUNKEN.z0 + 1 && z < SUNKEN.z1 - 1
}

/** 下沉深度：南北两侧 2.5m 内渐变，走进去是一段坡而不是掉下去。 */
export function sunkenDepth(x, z) {
  if (x < SUNKEN.x0 || x > SUNKEN.x1) return 0
  const r = Math.min(z - SUNKEN.z0, SUNKEN.z1 - z)
  if (r <= 0) return 0
  return 5 * smooth(Math.min(1, r / 2.5))
}

export function baseY(x, z) {
  const d = z - waterN(x)
  if (d < 0) {
    const s = z - (riverZ(x) - RIVER.half)
    if (s > 0) return RIVER.y
    return -6 + 4 * smooth(clamp(-s / 60, 0, 1))
  }
  if (d < BANK.beach) return -6
  let y = d < BANK.slope ? -6 + 6 * smooth((d - BANK.beach) / (BANK.slope - BANK.beach)) : 0
  y += 6 * smooth(clamp((z + 300) / 800, 0, 1))
  if (z > MOUNT_Z) y += mountain(z)
  return y
}

// 北山：一串高低不一的峰 + 山脊起伏，从城里看是一条有层次的山际线
const PEAKS = [
  [-660, 610, 40, 90], [-490, 650, 64, 110], [-310, 600, 44, 85], [-130, 660, 82, 120], [50, 610, 50, 90],
  [230, 680, 100, 130], [400, 620, 56, 95], [570, 660, 72, 110], [720, 610, 40, 80],
]
function peaks(x, z) {
  if (z <= MOUNT_Z) return 0
  const t = smooth(clamp((z - MOUNT_Z) / 150, 0, 1))
  let h = 0
  for (const [px, pz, ph, pr] of PEAKS) {
    const d2 = ((x - px) ** 2 + (z - pz) ** 2) / (pr * pr)
    h += ph * Math.exp(-d2)
  }
  h += 4 * Math.sin(x * 0.021 + z * 0.017) * Math.sin(x * 0.011 - z * 0.023)
  return Math.max(0, h * t)
}

export function groundY(x, z) {
  return baseY(x, z) - sunkenDepth(x, z) + peaks(x, z)
}

/** 小河：从北山流下，穿过文教区与中央公园（入湖再出湖），过人民大道后成为 CBD 中轴运河，汇入江。 */
export const CREEK = [
  [235, 760], [225, 650], [210, 545], [200, 480], [186, 420], [212, 352], [190, 262], [172, 208],
  [228, 176], [262, 152], [252, 96], [208, 42], [200, 0], [200, -120], [200, -260], [200, -400], [200, -520],
]
/** 运河段（z<0）宽 16m，山溪段 7m */
export const creekWidth = (z) => (z < 10 ? 16 : 7)
export function nearCreek(x, z, pad = 0) {
  for (let i = 0; i < CREEK.length - 1; i++) {
    const [ax, az] = CREEK[i]
    const [bx, bz] = CREEK[i + 1]
    if (distToSeg(x, z, ax, az, bx, bz) < creekWidth((az + bz) / 2) / 2 + pad) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 片区
// ---------------------------------------------------------------------------
export const DISTRICTS = [
  { id: 'A', name: 'CBD' },
  { id: 'B', name: '老城' },
  { id: 'C', name: '新住宅' },
  { id: 'D', name: '文教区' },
  { id: 'E', name: '步行街' },
  { id: 'F', name: '滨江' },
  { id: 'M', name: '商业带' },
  { id: 'P', name: '中央公园' },
  { id: 'T', name: '科技园' },
]

export function districtOf(x, z) {
  if (x > 400 && z < -220) return 'F'
  if (x > 0 && x < 400) return z < 0 ? 'A' : z < 250 ? 'P' : 'D'
  if (x > -200 && x < 0 && z > 250) return 'D'
  if (x >= 400) return z > 250 ? 'C' : 'T'
  if (z > 125 && x <= -200) return 'C'
  if (z < -220) return x > -600 ? 'E' : 'B'
  if (x > -200) return 'M'
  return 'B'
}

// ---------------------------------------------------------------------------
// 地块：路网切格子，某条支路在这里没铺就把两格合并；南边沿江的地块按滨江大道裁掉
// ---------------------------------------------------------------------------
export const blocks = (() => {
  const xsL = [{ at: CITY.x0, w: RING.w }, { at: CITY.x1, w: RING.w }]
  const zsL = [{ at: CITY.z1, w: RING.w }, { at: -640, w: 0 }]
  for (const r of ROADS) (r.a === 'z' ? xsL : zsL).push({ at: r.at, w: r.w, road: r })
  const uniq = (arr) => {
    arr.sort((p, q) => p.at - q.at)
    const out = []
    for (const l of arr) {
      const last = out[out.length - 1]
      if (last && Math.abs(last.at - l.at) < 0.5) {
        last.roads = (last.roads || [last.road]).concat([l.road])
        last.w = Math.max(last.w, l.w)
      } else out.push({ ...l, roads: [l.road] })
    }
    return out
  }
  const ns = uniq(xsL)
  const ew = uniq(zsL)
  const ni = ns.length - 1
  const nj = ew.length - 1
  // 一条线上可能是几段不同的支路（如 z=125 西段 / 东段）
  const present = (line, t) => line.roads.some((r) => !r || roadAt(r, t))
  const halfAt = (line, t) => (present(line, t) ? line.w / 2 : 0)
  const cell = (i, j) => {
    const cx = (ns[i].at + ns[i + 1].at) / 2
    const cz = (ew[j].at + ew[j + 1].at) / 2
    return {
      x0: ns[i].at + halfAt(ns[i], cz),
      x1: ns[i + 1].at - halfAt(ns[i + 1], cz),
      z0: ew[j].at + halfAt(ew[j], cx),
      z1: ew[j + 1].at - halfAt(ew[j + 1], cx),
    }
  }
  const par = Array.from({ length: ni * nj }, (_, k) => k)
  const find = (k) => (par[k] === k ? k : (par[k] = find(par[k])))
  const join = (a, b) => (par[find(a)] = find(b))
  for (let i = 0; i < ni; i++) {
    for (let j = 0; j < nj; j++) {
      const cx = (ns[i].at + ns[i + 1].at) / 2
      const cz = (ew[j].at + ew[j + 1].at) / 2
      if (i + 1 < ni && !present(ns[i + 1], cz)) join(i * nj + j, (i + 1) * nj + j)
      if (j + 1 < nj && !present(ew[j + 1], cx)) join(i * nj + j, i * nj + j + 1)
    }
  }
  const groups = new Map()
  for (let i = 0; i < ni; i++) {
    for (let j = 0; j < nj; j++) {
      const c = cell(i, j)
      const k = find(i * nj + j)
      const g = groups.get(k)
      if (!g) groups.set(k, { ...c })
      else {
        g.x0 = Math.min(g.x0, c.x0)
        g.x1 = Math.max(g.x1, c.x1)
        g.z0 = Math.min(g.z0, c.z0)
        g.z1 = Math.max(g.z1, c.z1)
      }
    }
  }
  const out = []
  for (const g of groups.values()) {
    let { x0, x1, z0, z1 } = g
    // 南边界：滨江大道（取地块宽度内最北的那一点）
    let sz = -Infinity
    for (let t = 0; t <= 8; t++) sz = Math.max(sz, southZ(lerp(x0, x1, t / 8)))
    z0 = Math.max(z0, sz + RING.w / 2)
    if (x1 - x0 < 20 || z1 - z0 < 20) continue
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    out.push({ x0: x0 + 4, x1: x1 - 4, z0: z0 + 4, z1: z1 - 4, cx, cz, district: districtOf(cx, cz), diagonal: nearDiag(cx, cz, -6) })
  }
  return out
})()

// ---------------------------------------------------------------------------
// 手放的重要建筑（先占位，地块填充时避开）
// ---------------------------------------------------------------------------
export const SITES = [
  // CBD：地标塔立在江湾尖上，运河西侧双塔，东侧金融城；商场在城市原点东南角
  { id: 'landmark', kind: 'tower', name: '微光中心', x: 300, z: -368, w: 46, d: 46, h: 330, roof: 'crown', landmark: true },
  { id: 'twin-a', kind: 'office', name: '双塔 A', x: 70, z: -278, w: 30, d: 30, h: 240, roof: 'mechanical', landmark: true },
  { id: 'twin-b', kind: 'office', name: '双塔 B', x: 140, z: -278, w: 30, d: 30, h: 240, roof: 'mechanical', landmark: true },
  { id: 'tw2', kind: 'office', name: '东岸金融', x: 320, z: -272, w: 38, d: 36, h: 220, roof: 'crown' },
  { id: 'off1', kind: 'office', name: '云谷大厦', x: 330, z: -160, w: 40, d: 28, h: 160, roof: 'mechanical' },
  { id: 'off2', kind: 'office', name: '江湾写字楼', x: 80, z: -160, w: 34, d: 28, h: 140, roof: 'mechanical' },
  { id: 'mall', kind: 'mall', name: '微光广场', x: 100, z: -45, w: 64, d: 46, h: 35, shops: 6 },
  { id: 'hotel', kind: 'hotel', name: '江畔酒店', x: 470, z: -290, w: 40, d: 34, h: 72, roof: 'mechanical' },
  // 出生点斜对面的街角便利店：整座城市的「长相基准」
  { id: 'konbini', kind: 'konbini', name: '微光便利店', x: -31, z: 29.5, w: 14, d: 12, h: 5.2, landmark: true, shops: 0 },
  // 文教区
  { id: 'stadium', kind: 'stadium', name: '微光体育馆', x: 310, z: 395, w: 76, d: 64, h: 28 },
  { id: 'library', kind: 'civic', name: '图书馆', x: 92, z: 300, w: 44, d: 32, h: 20, roof: 'garden' },
  { id: 'middle', kind: 'school', name: '微光中学', x: -110, z: 345, w: 56, d: 60, h: 16 },
  // 老城
  { id: 'market', kind: 'market', name: '西关菜市场', x: -500, z: -62, w: 60, d: 40, h: 8 },
  { id: 'school', kind: 'school', name: '西关小学', x: -300, z: 62, w: 70, d: 60, h: 15 },
  { id: 'hospital', kind: 'hospital', name: '微光医院', x: -300, z: -165, w: 52, d: 40, h: 30 },
  { id: 'clinic', kind: 'hospital', name: '社区卫生中心', x: -680, z: 60, w: 30, d: 22, h: 15 },
  { id: 'police', kind: 'civic', name: '派出所', x: -680, z: -165, w: 26, d: 20, h: 12 },
  { id: 'postoffice', kind: 'civic', name: '邮政局', x: -500, z: 100, w: 26, d: 18, h: 12 },
  { id: 'clock', kind: 'clocktower', name: '西关钟楼', x: -500, z: -165, w: 9, d: 9, h: 32, roof: 'crown', landmark: true },
  { id: 'village', kind: 'village', name: '城中村', x: -680, z: -282, w: 70, d: 70, h: 12 },
  { id: 'wc2', kind: 'civic', name: '公共厕所', x: -560, z: -150, w: 7, d: 6, h: 4.2 },
  // 商业带
  { id: 'community', kind: 'civic', name: '社区服务中心', x: -100, z: 200, w: 30, d: 20, h: 12 },
  { id: 'kindergarten', kind: 'school', name: '新苗幼儿园', x: -150, z: 160, w: 26, d: 26, h: 9 },
  // 科技园 / 公园
  { id: 'fire', kind: 'civic', name: '消防站', x: 500, z: 60, w: 36, d: 28, h: 14 },
  { id: 'bus-hub', kind: 'station', name: '公交枢纽', x: 470, z: -160, w: 50, d: 30, h: 9 },
  { id: 'construction', kind: 'site', name: '在建工地', x: 680, z: 180, w: 60, d: 46, h: 2 },
  { id: 'wc1', kind: 'civic', name: '公共厕所', x: 360, z: 228, w: 8, d: 7, h: 4.2 },
]

// ---------------------------------------------------------------------------
// 公园 / 地铁 / 广场
// ---------------------------------------------------------------------------
export const PARKS = [
  {
    id: 'central',
    name: '中央公园',
    x0: 24,
    x1: 384,
    z0: 24,
    z1: 234,
    lake: { x: 268, z: 150, rx: 58, rz: 30 },
    hill: { x: 92, z: 182, r: 40, h: 14 },
    courts: [[112, 62], [150, 62]],
  },
  { id: 'riverpark', name: '江滩公园', x0: 512, x1: 612, z0: -330, z1: -240 },
  { id: 'axis', name: '中轴运河公园', x0: 186, x1: 214, z0: -340, z1: -24 },
  { id: 'pocket1', name: '西关口袋公园', x0: -560, x1: -530, z0: -200, z1: -176 },
  { id: 'pocket2', name: '钟楼口袋公园', x0: -470, x1: -440, z0: 30, z1: 56 },
  { id: 'pocket3', name: '和平口袋公园', x0: -60, x1: -34, z0: 44, z1: 66 },
]

export const METRO = [
  { x: 0, z: 0, name: '微光广场', transfer: true },
  { x: 0, z: -220, name: '江湾路' },
  { x: 0, z: 250, name: '北山' },
  { x: 400, z: 0, name: '东岸' },
  { x: -400, z: 0, name: '西关' },
  { x: -400, z: -220, name: '老码头' },
  { x: 400, z: 250, name: '科苑' },
]

const siteRects = SITES.map((s) => ({ x0: s.x - s.w / 2 - 6, x1: s.x + s.w / 2 + 6, z0: s.z - s.d / 2 - 6, z1: s.z + s.d / 2 + 6 }))
const hitsPark = (r) =>
  PARKS.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.z0 < p.z1 && r.z1 > p.z0) ||
  (r.x0 < SUNKEN.x1 + 2 && r.x1 > SUNKEN.x0 - 2 && r.z0 < SUNKEN.z1 + 2 && r.z1 > SUNKEN.z0 - 2)
const hitsSite = (r) => siteRects.some((s) => r.x0 < s.x1 && r.x1 > s.x0 && r.z0 < s.z1 && r.z1 > s.z0)

export const buildings = []
export const shops = []

const hitsBuilding = (r) => {
  for (const b of buildings) {
    if (r.x0 < b.x + b.w / 2 && r.x1 > b.x - b.w / 2 && r.z0 < b.z + b.d / 2 && r.z1 > b.z - b.d / 2) return true
  }
  return false
}

const R = mulberry32(20261108)
const pick = (a) => a[Math.min(a.length - 1, Math.floor(R() * a.length))]

// 片区各有主色系，彼此拉开明度与色相：
// 老城 = 红砖 / 土黄 / 灰砖 / 水泥绿；新区 = 每个小区一套主色；CBD = 蓝 / 青 / 古铜 / 银灰玻璃
// 参考像素纽约：老城是红砖 / 赭红 / 深褐，新区是砖红配米色线脚，不用粉彩
// 城市感靠片区材料差：老城砖/赭、住宅米黄、CBD 才冷灰 —— 全城一灰就是工业镇
const OLD_BODY = ['#8a5a4a', '#7a5044', '#946050', '#6e4a40', '#855448']
const OLD_TRIM = ['#d6c4a4', '#c8b694', '#e0d0b0']
const NEW_BODY = ['#9a948c', '#a8a298', '#8e8880', '#b0aaa0', '#968e86']
const NEW_TRIM = ['#d8d0c4', '#c8c0b4', '#e4dcc8']
const GLASS = ['#5a6878', '#647284', '#546070']
const TECH = ['#5a6068', '#646a72', '#505860']
const STONE = ['#9a9088', '#a89e94', '#8e847c']
const COMPOUND_COL = [
  ['#a8a298', '#d8d0c4'],
  ['#9a948c', '#e4dcc8'],
  ['#b0aaa0', '#d0c8bc'],
  ['#8e8880', '#c8c0b4'],
  ['#a09088', '#d8d0c4'],
]

function addBuilding(o) {
  const b = {
    rot: 0,
    roof: 'plain',
    tier: 'B',
    shops: 0,
    enter: false,
    ...o,
  }
  buildings.push(b)
  return b
}

for (const s of SITES) {
  addBuilding({
    id: s.id,
    kind: s.kind,
    name: s.name,
    x: s.x,
    z: s.z,
    w: s.w,
    d: s.d,
    h: s.h,
    roof: s.roof || 'plain',
    tier: 'A',
    district: districtOf(s.x, s.z),
    landmark: !!s.landmark,
    shops: s.shops || 0,
    enter: true,
    color:
      s.kind === 'tower' || s.kind === 'office'
        ? pick(GLASS)
        : s.kind === 'konbini' || s.kind === 'hotel'
          ? pick(NEW_BODY)
          : pick(STONE),
    trim: pick(NEW_TRIM),
    site: true,
  })
}

/** 放一栋楼：与重要建筑、已有楼、斜街、小河都保持间距才放，放不下就跳过 */
function tryPut(o, pad = 3) {
  const r = { x0: o.x - o.w / 2 - pad, x1: o.x + o.w / 2 + pad, z0: o.z - o.d / 2 - pad, z1: o.z + o.d / 2 + pad }
  if (hitsSite(r) || hitsBuilding(r) || hitsPark(r) || nearDiag(o.x, o.z, Math.max(o.w, o.d) / 2 + 2) || nearCreek(o.x, o.z, Math.max(o.w, o.d) / 2 + 4)) return null
  return addBuilding(o)
}

/** 沿地块一条边排一排楼（frontage 是单栋面宽区间）。side 指楼在地块的哪一边。 */
function streetRow(b, side, depth, fr, make) {
  const horiz = side === 'n' || side === 's'
  const along = horiz ? b.x1 - b.x0 : b.z1 - b.z0
  const skip = horiz ? 0 : depth + 2
  const len = along - skip * 2
  if (len < fr[0]) return
  const n = Math.max(1, Math.floor(len / ((fr[0] + fr[1]) / 2)))
  const w = len / n
  for (let i = 0; i < n; i++) {
    const t = skip + w * (i + 0.5)
    const o = horiz
      ? { x: b.x0 + t, z: side === 'n' ? b.z1 - depth / 2 : b.z0 + depth / 2, w: w - 1.2, d: depth }
      : { x: side === 'e' ? b.x1 - depth / 2 : b.x0 + depth / 2, z: b.z0 + t, w: depth, d: w - 1.2 }
    // 店面朝街：north 边的楼店面朝 +z（face 's'），south 边朝 -z（face 'n'）
    o.face = side === 'n' ? 's' : side === 's' ? 'n' : side
    make(o, i)
  }
}

// ---------------------------------------------------------------------------
// 地块细分 + 多翼楼：街区先递归切成大小不一的地块（有的隔一条巷子，有的共用山墙），
// 每个地块按大小 / 临街方向 / 密度长出一组楼：矩形、L、T、U、围合院、裙房+板楼。
// 同一组楼共用颜色与造型种子（gx/gz），翼与翼紧贴，楼高按密度场上下浮动。
// ---------------------------------------------------------------------------
export const GREEN_LOTS = []

/** 密度场 0~1：地铁站周边 + CBD 江湾最高，往外衰减 */
export function densityAt(x, z) {
  let d = 0.9 * Math.exp(-((x - 200) ** 2 + (z + 260) ** 2) / 260 ** 2)
  for (const m of METRO) d = Math.max(d, Math.exp(-((x - m.x) ** 2 + (z - m.z) ** 2) / 170 ** 2))
  return d
}

/**
 * 天际线高度场：塔楼群中心最高，往外按平方指数衰减，边缘回到 0。
 * 楼层 / 塔高都从这里取，城市才会是一座「中间高、四周低」的山，而不是几根孤零零的柱子。
 */
// 天际线场略拉大：CBD + 江湾商业带都进「高楼丘」，远处才矮下去
export const SKY_C = { x: 200, z: -180, r: 380 }
export function skylineAt(x, z) {
  const d2 = (x - SKY_C.x) ** 2 + (z - SKY_C.z) ** 2
  return Math.exp(-d2 / SKY_C.r ** 2)
}

function parcelize(r, maxW, minW, gap, out = []) {
  const w = r.x1 - r.x0
  const d = r.z1 - r.z0
  if (w < minW || d < minW) return out
  if (w <= maxW && d <= maxW) {
    out.push(r)
    return out
  }
  const t = 0.36 + R() * 0.28
  // 一半的切缝是巷子，一半是共用山墙（只留 1m）
  const g = R() < 0.5 ? gap : gap * 1.7
  if (w >= d) {
    const m = r.x0 + w * t
    parcelize({ ...r, x1: m - g / 2 }, maxW, minW, gap, out)
    parcelize({ ...r, x0: m + g / 2 }, maxW, minW, gap, out)
  } else {
    const m = r.z0 + d * t
    parcelize({ ...r, z1: m - g / 2 }, maxW, minW, gap, out)
    parcelize({ ...r, z0: m + g / 2 }, maxW, minW, gap, out)
  }
  return out
}

/** 地块的临街边：贴着街区外沿的边里取最长的一条（N=+z S=-z E=+x W=-x）；内部地块返回 null */
function frontOf(p, blk) {
  const c = []
  if (blk.z1 - p.z1 < 0.6) c.push(['N', p.x1 - p.x0])
  if (p.z0 - blk.z0 < 0.6) c.push(['S', p.x1 - p.x0])
  if (blk.x1 - p.x1 < 0.6) c.push(['E', p.z1 - p.z0])
  if (p.x0 - blk.x0 < 0.6) c.push(['W', p.z1 - p.z0])
  if (!c.length) return null
  c.sort((a, b) => b[1] - a[1])
  return c[0][0]
}
const FACE_OF = { N: 's', S: 'n', E: 'e', W: 'w' }

/** 局部坐标（u 沿街、v 往地块里）→ 世界矩形 */
function toWorld(p, f, u0, u1, v0, v1) {
  if (f === 'N') return { x0: p.x0 + u0, x1: p.x0 + u1, z0: p.z1 - v1, z1: p.z1 - v0 }
  if (f === 'S') return { x0: p.x0 + u0, x1: p.x0 + u1, z0: p.z0 + v0, z1: p.z0 + v1 }
  if (f === 'E') return { x0: p.x1 - v1, x1: p.x1 - v0, z0: p.z0 + u0, z1: p.z0 + u1 }
  return { x0: p.x0 + v0, x1: p.x0 + v1, z0: p.z0 + u0, z1: p.z0 + u1 }
}

/** 楼组的翼：front 是临街主楼，其余是往后伸的翼 */
function wingPlan(W, D, shape, d1, w2) {
  const front = { u0: 0, u1: W, v0: 0, v1: Math.min(D, d1), front: true, dh: 0 }
  const dh = () => Math.floor(R() * 4) - 1
  if (shape === 'rect') return [front]
  if (shape === 'deep') return [{ ...front, v1: D }]
  const L = [front]
  // 只做「两个体块咬一个角」的 L 形：U / 口字形要多翼围合，几面屋顶贴在一起，
  // 远看像好几栋楼挤成一坨，索性不做
  if (shape === 'L') {
    w2 = Math.min(w2, W - 5)
    const left = R() < 0.5
    L.push({ u0: left ? 0 : W - w2, u1: left ? w2 : W, v0: d1, v1: D, dh: dh() })
  } else if (shape === 'podium') {
    L.push({ u0: W * 0.14, u1: W * 0.86, v0: d1 + 1, v1: D - 1, tall: true, dh: 0 })
  }
  return L
}

/** 整组放楼：每个翼都要避开别组的楼 / 重要建筑 / 公园 / 斜街 / 小河；主楼放不下整组放弃 */
function putGroup(p, f, wings, make) {
  const rects = wings.map((w) => toWorld(p, f || 'S', w.u0, w.u1, w.v0, w.v1))
  const ok = rects.map((r) => {
    const pad = 1.5
    const q = { x0: r.x0 - pad, x1: r.x1 + pad, z0: r.z0 - pad, z1: r.z1 + pad }
    const cx = (r.x0 + r.x1) / 2
    const cz = (r.z0 + r.z1) / 2
    const half = Math.max(r.x1 - r.x0, r.z1 - r.z0) / 2
    return r.x1 - r.x0 >= 7 && r.z1 - r.z0 >= 7 && !hitsSite(q) && !hitsBuilding(q) && !hitsPark(q) && !nearDiag(cx, cz, half - 1) && !nearCreek(cx, cz, half + 3)
  })
  if (!ok[0]) return 0
  // 再退 1m：地块缝隙之外也留出一道巷子，楼和楼不共用墙皮
  const inset = (r) => {
    const dx = Math.max(0, Math.min(1, (r.x1 - r.x0 - 7) / 2))
    const dz = Math.max(0, Math.min(1, (r.z1 - r.z0 - 7) / 2))
    return { x0: r.x0 + dx, x1: r.x1 - dx, z0: r.z0 + dz, z1: r.z1 - dz }
  }
  const gx = (p.x0 + p.x1) / 2
  const gz = (p.z0 + p.z1) / 2
  let n = 0
  wings.forEach((w, i) => {
    if (!ok[i]) return
    const r = inset(rects[i])
    addBuilding({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, w: r.x1 - r.x0, d: r.z1 - r.z0, gx, gz, ...make(w, i) })
    n++
  })
  return n
}

/** 地块尺寸（沿街宽 W、进深 D） */
const dimsOf = (p, f) => (f === 'E' || f === 'W' ? [p.z1 - p.z0, p.x1 - p.x0] : [p.x1 - p.x0, p.z1 - p.z0])

// 老城：14~36m 小地块，巷子 4~6m；临街一律底商；内部地块一部分留作院子绿地
function fillOldTown(blk) {
  if (blk.x1 - blk.x0 < 30 || blk.z1 - blk.z0 < 30) return
  for (const p of parcelize(blk, 28, 11, 4.5 + R() * 1.5)) {
    const f = frontOf(p, blk)
    const [W, D] = dimsOf(p, f)
    const cx = (p.x0 + p.x1) / 2
    const cz = (p.z0 + p.z1) / 2
    if (!f && R() < 0.02) {
      if (!nearDiag(cx, cz, 10)) GREEN_LOTS.push({ x: cx, z: cz, w: p.x1 - p.x0 - 2, d: p.z1 - p.z0 - 2 })
      continue
    }
    const r = R()
    let shape = 'rect'
    if (W >= 16 && D >= 17 && r < 0.45) shape = 'L'
    else if (D < 16) shape = 'deep'
    const d1 = 8.5 + R() * 3
    const w2 = 7 + R() * 2.5
    const dens = densityAt(cx, cz)
    // 老城也是 4~9 层的砖楼：两三层的小房子夹在高楼之间，尺度会断层
    const f0 = clamp(6 + Math.round(dens * 4 + (R() - 0.5) * 2.6), 5, 12)
    const color = pick(OLD_BODY)
    const trim = pick(OLD_TRIM)
    const tier = R() < 0.35 ? 'A' : 'B'
    putGroup(p, f, wingPlan(W, D, shape, d1, w2), (w) => {
      const floors = clamp(f0 + w.dh, 4, 13)
      const front = w.front && f
      return {
        kind: 'walkup',
        h: floors * SCALE.floor,
        floors,
        roof: R() < 0.5 ? 'tank' : 'solar',
        color,
        trim,
        district: blk.district,
        tier: front ? tier : 'C',
        shops: front && R() < 0.88 ? clamp(Math.floor(W / 8), 1, 4) : 0,
        face: front ? FACE_OF[f] : 's',
        enter: front && R() < 0.15,
        old: true,
        lite: !front,
      }
    })
  }
}

// 商业带：22~64m 大地块；临街多为「4 层底商裙房 + 后部板楼」，也有 L 形、围合式；楼高随密度
function fillCommercial(blk) {
  if (blk.x1 - blk.x0 < 40 || blk.z1 - blk.z0 < 40) return
  for (const p of parcelize(blk, 52, 20, 5)) {
    const f = frontOf(p, blk)
    const [W, D] = dimsOf(p, f)
    const cx = (p.x0 + p.x1) / 2
    const cz = (p.z0 + p.z1) / 2
    const dens = densityAt(cx, cz)
    const r = R()
    // 靠近塔楼群的街区多退台（podium = 前排裙房 + 后排塔楼），天际线才有厚度
    const sky = skylineAt(cx, cz)
    let shape = f ? (D >= 34 && (r < 0.55 || sky > 0.3) ? 'podium' : D >= 26 ? 'L' : 'deep') : R() < 0.03 ? null : 'deep'
    if (!shape) {
      GREEN_LOTS.push({ x: cx, z: cz, w: p.x1 - p.x0 - 3, d: p.z1 - p.z0 - 3 })
      continue
    }
    const color = pick(STONE)
    const trim = pick(NEW_TRIM)
    const body = pick(NEW_BODY)
    const midF = clamp(7 + Math.round(dens * 5 + (R() - 0.5) * 3), 6, 14)
    // 板楼封顶 20 层：商业带是中高层的「墙」，真正的高楼只留给 CBD
    const tallF = clamp(12 + Math.round(dens * 6 + sky * 10 + (R() - 0.5) * 4), 10, 28)
    // 商业带并进天际线丘：sky 稍高就起塔，把 CBD 的高楼群往外续一截
    const officeT = sky > 0.12 && D >= 18
    putGroup(p, f, wingPlan(W, D, shape, 14 + R() * 4, 10 + R() * 4), (w) => {
      const front = w.front && f
      if (w.tall || (!f && shape === 'deep')) {
        if (officeT) {
          const h = Math.round((70 + Math.pow(sky, 1.7) * 200) * (0.8 + R() * 0.35))
          return { kind: 'office', h: clamp(h, 60, 280), roof: h > 160 ? 'crown' : 'mechanical', color: pick(GLASS), trim, district: blk.district, tier: 'B', enter: true, office: true, landmark: h > 220 }
        }
        const floors = f ? tallF : clamp(tallF - 2, 12, 32)
        return { kind: 'slab', h: floors * SCALE.floor, floors, roof: 'tank', color: body, trim, district: blk.district, tier: 'B', shops: 0, balconies: true, enter: true }
      }
      if (!front && officeT && w.u1 - w.u0 >= 14 && w.v1 - w.v0 >= 14) {
        const h = Math.round((60 + Math.pow(sky, 1.7) * 170) * (0.78 + R() * 0.35))
        return { kind: 'office', h: clamp(h, 55, 240), roof: h > 150 ? 'crown' : 'mechanical', color: pick(GLASS), trim, district: blk.district, tier: 'B', enter: false, office: true }
      }
      const floors = shape === 'podium' ? 4 : clamp(midF + w.dh, 4, 16)
      return {
        kind: 'walkup',
        h: floors * SCALE.floor,
        floors,
        roof: R() < 0.4 ? 'tank' : R() < 0.7 ? 'solar' : 'plain',
        color: front ? pick(STONE) : body,
        trim,
        district: blk.district,
        tier: front ? 'A' : 'C',
        shops: front ? clamp(Math.floor(W / 9), 1, 5) : 0,
        face: front ? FACE_OF[f] : 's',
        lite: true,
        podium: !!front,
      }
    })
  }
}

// ---------------------------------------------------------------------------
// CBD：一个街区一栋塔楼（大街区两栋，对角错开 ≥25m）+ 沿街 4~6 层裙房围住街角
// ---------------------------------------------------------------------------
function fillCBD(b) {
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  if (w < 36 || d < 36) return
  // 参考「赛博巨城」天际线：街区里塞满高低错落的塔，不是草坪上几根柱子
  const cols = clamp(Math.round(w / 38), 2, 9)
  const rows = clamp(Math.round(d / 40), 2, 6)
  const cw = w / cols
  const cd = d / rows
  const tw = Math.min(32, cw - 6)
  const td = Math.min(32, cd - 6)
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (tw < 14 || td < 14) continue
      // 约 12% 格子留空当巷缝，其余全起塔
      if (R() < 0.12) continue
      const tx = b.x0 + cw * (i + 0.5) + (R() - 0.5) * 4
      const tz = b.z0 + cd * (j + 0.5) + (R() - 0.5) * 4
      const f = skylineAt(tx, tz)
      // 衰减放缓：中心 250~320m，外圈仍有一批 100~180m，剪影是一片高楼丘
      const h = Math.round((90 + Math.pow(f, 1.55) * 240) * (0.82 + R() * 0.38))
      const slim = R() < 0.35
      tryPut(
        {
          kind: 'office',
          x: tx,
          z: tz,
          w: tw * (slim ? 0.55 + R() * 0.25 : 0.78 + R() * 0.28),
          d: td * (slim ? 0.55 + R() * 0.25 : 0.78 + R() * 0.28),
          h: clamp(h, 70, 340),
          roof: h > 200 ? 'crown' : R() < 0.45 ? 'crown' : 'mechanical',
          color: pick(GLASS),
          trim: pick(NEW_TRIM),
          district: 'A',
          tier: 'B',
          enter: true,
          office: true,
          landmark: h > 260,
        },
        2.5
      )
    }
  }
  // 裙房仍补街角，但变矮、变薄，别抢塔楼天际线
  for (const side of ['n', 's', 'e', 'w']) {
    streetRow(b, side, 14, [22, 32], (o) => {
      const floors = 3 + Math.floor(R() * 3)
      tryPut({ kind: 'walkup', ...o, h: floors * SCALE.floor, floors, roof: 'plain', color: pick(STONE), trim: pick(NEW_TRIM), district: 'A', tier: 'A', shops: 2 + Math.floor(R() * 3), lite: true, podium: true }, 2)
    })
  }
}

// ---------------------------------------------------------------------------
// 科技园：低密度、多绿地。每个街区 2~4 栋 6~14 层研发楼，楼间是草坪
// ---------------------------------------------------------------------------
function fillTech(b) {
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  if (w < 40 || d < 40) return
  const cols = clamp(Math.round(w / 62), 1, 4)
  const rows = clamp(Math.round(d / 44), 1, 4)
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const floors = 6 + Math.floor(R() * 9)
      tryPut(
        {
          kind: 'office',
          x: b.x0 + (w * (i + 0.5)) / cols,
          z: b.z0 + (d * (j + 0.5)) / rows,
          w: Math.min(48, w / cols - 12),
          d: Math.min(28, d / rows - 12),
          h: floors * SCALE.floor + 4,
          roof: 'mechanical',
          color: pick(TECH),
          trim: pick(NEW_TRIM),
          district: 'T',
          tier: 'B',
          enter: true,
          office: true,
          low: true,
        },
        8
      )
    }
  }
}

// ---------------------------------------------------------------------------
// 文教区：大学教学楼（5 层）围合成院子，中间是大草坪
// ---------------------------------------------------------------------------
function fillCampus(b) {
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  if (w < 60 || d < 60) return
  for (const side of ['n', 's', 'e', 'w']) {
    streetRow(b, side, 16, [36, 50], (o) =>
      tryPut({ kind: 'civic', ...o, h: 5 * SCALE.floor, floors: 5, roof: 'plain', color: pick(STONE), trim: pick(NEW_TRIM), district: 'D', tier: 'B', enter: false }, 10)
    )
  }
}

// ---------------------------------------------------------------------------
// 步行街：15m 宽，横穿老城南缘，两侧 2~3 层小体量商业，招牌墙最密
// ---------------------------------------------------------------------------
export const PEDESTRIAN = { x0: -590, x1: -30, z: -278, w: 15 }
function fillPedestrian(b) {
  const PS = PEDESTRIAN
  const x0 = Math.max(b.x0, PS.x0)
  const x1 = Math.min(b.x1, PS.x1)
  if (x1 - x0 < 20) return
  for (const sideZ of [1, -1]) {
    const dep = 14
    const z = PS.z + sideZ * (PS.w / 2 + dep / 2 + 0.5)
    if (z + dep / 2 > b.z1 || z - dep / 2 < b.z0) continue
    let x = x0 + 1
    while (x < x1 - 8) {
      const fw = Math.min(x1 - 1 - x, 9 + R() * 8)
      if (fw < 8) break
      const floors = 2 + Math.floor(R() * 2)
      tryPut(
        {
          kind: 'walkup',
          x: x + fw / 2,
          z,
          w: fw - 0.6,
          d: dep,
          h: floors * SCALE.floor + 1,
          floors,
          roof: 'plain',
          color: pick(OLD_BODY),
          trim: pick(OLD_TRIM),
          district: 'E',
          tier: 'A',
          shops: 1 + Math.floor(fw / 8),
          // sideZ>0：楼在街北侧，店面朝 -z（'n'）；反之朝 +z（'s'）
          face: sideZ > 0 ? 'n' : 's',
          lite: true,
          old: true,
        },
        0.2
      )
      x += fw
    }
  }
}

// ---------------------------------------------------------------------------
// 新住宅：一个街区一个封闭小区。塔楼南北成排、南低北高、同排同高，行距 ≥ 1.2 倍南排楼高的
// 一半以上（按日照放宽），中间园林；沿街一条 3 层底商在围墙外
// ---------------------------------------------------------------------------
export const COMPOUNDS = []
const COMPOUND_NAMES = ['微光家园', '望江里', '北山苑', '枫林湾', '云栖府', '桂语园', '翠湖居', '星河湾']
function fillCompound(b) {
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  if (w < 70 || d < 70) return
  const ci = COMPOUNDS.length
  const [body, trim] = COMPOUND_COL[ci % COMPOUND_COL.length]
  // 沿南侧街道的底商（围墙外），中间留 18m 小区大门
  const shopD = 12
  const gateHalf = 9
  for (const [a0, a1] of [[b.x0 + 2, b.cx - gateHalf], [b.cx + gateHalf, b.x1 - 2]]) {
    const len = a1 - a0
    const n = Math.max(1, Math.round(len / 26))
    for (let i = 0; i < n; i++) {
      const sw = len / n
      tryPut({ kind: 'walkup', x: a0 + sw * (i + 0.5), z: b.z0 + shopD / 2, w: sw - 1, d: shopD, h: 3 * SCALE.floor, floors: 3, roof: 'solar', color: pick(NEW_BODY), trim: pick(NEW_TRIM), district: 'C', tier: 'A', shops: 3, face: 'n', lite: true }, 0.4)
    }
  }
  const c = { id: `c${ci + 1}`, name: COMPOUND_NAMES[ci % COMPOUND_NAMES.length], x0: b.x0 + 2, x1: b.x1 - 2, z0: b.z0 + shopD + 3, z1: b.z1 - 2 }
  COMPOUNDS.push(c)
  const cw = c.x1 - c.x0
  const cd = c.z1 - c.z0
  // 一半小区是点式高层，一半是板楼（11~18 层，行距更小、排数更多）
  const slabType = ci % 2 === 1
  const hLow = slabType ? 33 + Math.floor(R() * 3) * 3.3 : 54 + Math.floor(R() * 3) * 6
  const hHigh = slabType ? hLow + 16 + Math.floor(R() * 2) * 3.3 : hLow + 24 + Math.floor(R() * 2) * 6
  const tw = slabType ? 36 + R() * 8 : 18 + Math.floor(R() * 3) * 3
  const td = slabType ? 13 : 15
  const gapX = slabType ? 12 : 14
  const pitch = slabType ? 32 : 42
  const cols = Math.max(2, Math.floor((cw - 8) / (tw + gapX)))
  const rows = Math.max(1, Math.min(6, Math.floor((cd - 30) / pitch) + 1))
  const zStart = c.z0 + 18 + Math.max(0, (cd - 30 - pitch * (rows - 1)) / 2)
  for (let j = 0; j < rows; j++) {
    const z = zStart + pitch * j
    const h = rows === 1 ? hHigh : Math.round(hLow + ((hHigh - hLow) * j) / (rows - 1))
    for (let i = 0; i < cols; i++) {
      // 隔排错开：前后排不正对，视线和日照都更通透
      const off = j % 2 && !slabType ? Math.min(8, cw / cols / 5) : 0
      tryPut(
        {
          kind: slabType ? 'slab' : 'tower',
          x: c.x0 + (cw * (i + 0.5)) / cols + off * (i % 2 ? -1 : 1),
          z,
          w: tw,
          d: td,
          h,
          floors: Math.round(h / SCALE.floor),
          roof: slabType ? 'tank' : 'mechanical',
          color: body,
          trim,
          district: 'C',
          tier: 'B',
          enter: true,
          compound: c.id,
          balconies: true,
        },
        5
      )
    }
  }
}

/**
 * 中高层砖楼街区（像素纽约的主体）：6~12 层的方墩子沿街围合、占满街区，楼顶水箱。
 * 取代一排排同高同款的小区板楼 —— 重复的点式楼阵列从空中看就是「贴图平铺」。
 */
function fillMidrise(blk) {
  if (blk.x1 - blk.x0 < 30 || blk.z1 - blk.z0 < 30) return
  for (const p of parcelize(blk, 38, 14, 4 + R() * 1.5)) {
    const f = frontOf(p, blk)
    const [W, D] = dimsOf(p, f)
    const cx = (p.x0 + p.x1) / 2
    const cz = (p.z0 + p.z1) / 2
    if (!f && R() < 0.02) {
      GREEN_LOTS.push({ x: cx, z: cz, w: p.x1 - p.x0 - 2, d: p.z1 - p.z0 - 2 })
      continue
    }
    let shape = 'deep'
    if (W >= 18 && D >= 22 && R() < 0.5) shape = 'L'
    const dens = densityAt(cx, cz)
    const f0 = clamp(8 + Math.round(dens * 4 + (R() - 0.5) * 4), 7, 14)
    const color = R() < 0.6 ? pick(OLD_BODY) : pick(NEW_BODY)
    const trim = pick(OLD_TRIM)
    putGroup(p, f, wingPlan(W, D, shape, 12 + R() * 4, 9 + R() * 3), (w) => {
      const floors = clamp(f0 + w.dh, 6, 16)
      const front = w.front && f
      return {
        kind: 'walkup',
        h: floors * SCALE.floor,
        floors,
        roof: 'tank',
        color,
        trim,
        district: blk.district,
        tier: front ? 'A' : 'C',
        shops: front && R() < 0.7 ? clamp(Math.floor(W / 9), 1, 4) : 0,
        face: front ? FACE_OF[f] : 's',
        enter: front && R() < 0.12,
        lite: !front,
      }
    })
  }
}

// 滨江东段：酒店 + 摩天轮 + 江滩公园，不再排普通楼
for (const b of blocks) {
  const D = b.district
  if (D === 'B') fillOldTown(b)
  else if (D === 'E') {
    fillPedestrian(b)
    // 步行街北面：沿江湾路一排老城砖楼；南面靠江的一条留作绿地
    streetRow(b, 'n', 13, [14, 20], (o) => {
      const floors = 5 + Math.floor(R() * 2)
      tryPut({ kind: 'walkup', ...o, h: floors * SCALE.floor, floors, roof: 'tank', color: pick(OLD_BODY), trim: pick(OLD_TRIM), district: 'E', tier: 'B', shops: 2 + Math.floor(R() * 2), old: true }, 1)
    })
  } else if (D === 'M') fillCommercial(b)
  else if (D === 'A') fillCBD(b)
  else if (D === 'T') fillTech(b)
  else if (D === 'D') fillCampus(b)
  else if (D === 'C') fillMidrise(b)
}
void fillCompound


// ---------------------------------------------------------------------------
// 店铺目录：按片区规则分配（老城放开、新区管控）
// ---------------------------------------------------------------------------
export const CATALOG = [
  { n: '星光便利店', k: 'store', s: 'lightbox', c: '#f4f7fb', t: '#2b6bd6' },
  { n: '好邻居便利店', k: 'store', s: 'lightbox', c: '#f2f6f3', t: '#1f8a5b' },
  { n: '鲜丰水果', k: 'fruit', s: 'panel', c: '#f0c23c', t: '#7a3d10' },
  { n: '百草堂药房', k: 'pharmacy', s: 'lightbox', c: '#eef6f1', t: '#158a52' },
  { n: '康宁药店', k: 'pharmacy', s: 'led', c: '#1b1f24', t: '#ff3b30' },
  { n: '老张包子铺', k: 'breakfast', s: 'wood', c: '#6b4a2a', t: '#ffe6b0' },
  { n: '阿姨豆浆油条', k: 'breakfast', s: 'cloth', c: '#c8342a', t: '#fff3d8' },
  { n: '老灶火锅店', k: 'hotpot', s: 'blade', c: '#8e1b1b', t: '#ffe9a8' },
  { n: '日式料理', k: 'rest', s: 'backlight', c: '#101a22', t: '#ffe9c0' },
  { n: '西餐厅', k: 'rest', s: 'lightbox', c: '#232a30', t: '#f0dcb8' },
  { n: '快餐便当', k: 'rest', s: 'vi', c: '#e8ae1c', t: '#3a2600' },
  { n: '夜市大排档', k: 'bbq', s: 'sleeve', c: '#2a1a12', t: '#ffd27a' },
  { n: '服装店', k: 'retail', s: 'vi', c: '#f0ece4', t: '#26262a' },
  { n: '运动鞋店', k: 'retail', s: 'blade', c: '#1c2b4a', t: '#8fe0ff' },
  { n: '家居建材', k: 'retail', s: 'lightbox', c: '#3a4048', t: '#dfe6ee' },
  { n: '电玩城', k: 'ktv', s: 'neon', c: '#160d2e', t: '#ff7ab4' },
  { n: '棋牌室', k: 'ktv', s: 'sleeve', c: '#10251c', t: '#8dffb0' },
  { n: '照相馆', k: 'service', s: 'vi', c: '#f2efe6', t: '#4a3a20' },
  { n: '中国电信', k: 'service', s: 'backlight', c: '#0b2a5c', t: '#ffffff' },
  { n: '老电影院', k: 'ktv', s: 'neon', c: '#3a0a1a', t: '#ffcf5c' },
  { n: '兰州牛肉面', k: 'noodle', s: 'wood', c: '#7a3f22', t: '#ffe9bd' },
  { n: '重庆小面', k: 'noodle', s: 'panel', c: '#b5342c', t: '#ffe9c2' },
  { n: '老王烧烤', k: 'bbq', s: 'neon', c: '#2a2018', t: '#ff8a3c' },
  { n: '夜色烤串', k: 'bbq', s: 'scene', c: '#241a16', t: '#ffd27a' },
  { n: '古茗奶茶', k: 'tea', s: 'vi', c: '#f2e9dc', t: '#8a5a2b' },
  { n: '蜜雪冰城', k: 'tea', s: 'vi', c: '#e8322a', t: '#ffffff' },
  { n: '书亦烧仙草', k: 'tea', s: 'vi', c: '#f4f1e6', t: '#7a5c3a' },
  { n: '麻辣烫', k: 'hotpot', s: 'led', c: '#241d18', t: '#ff4d3d' },
  { n: '沙县小吃', k: 'fastfood', s: 'vi', c: '#f2e7d2', t: '#b23a26' },
  { n: '川湘人家', k: 'restaurant', s: 'wood', c: '#6d2a1e', t: '#ffd9a0' },
  { n: '陈记卤味', k: 'deli', s: 'panel', c: '#c9a24e', t: '#4a2a12' },
  { n: '幸福蛋糕', k: 'bakery', s: 'backlight', c: '#f6e7ea', t: '#c04b6a' },
  { n: '转角咖啡', k: 'coffee', s: 'chalk', c: '#2b2b2b', t: '#f0e2c8' },
  { n: '阿强理发', k: 'barber', s: 'wood', c: '#3f4a52', t: '#ffe0b0' },
  { n: 'three 色造型', k: 'barber', s: 'neon', c: '#201a24', t: '#ff6bd6' },
  { n: '美甲美睫', k: 'beauty', s: 'vi', c: '#f2d7e2', t: '#a03a6a' },
  { n: '干洗店', k: 'laundry', s: 'panel', c: '#dfe8ef', t: '#2a5a8a' },
  { n: '打印复印', k: 'print', s: 'cloth', c: '#2c5aa0', t: '#ffffff' },
  { n: '手机维修', k: 'phone', s: 'led', c: '#1d1f22', t: '#43d17a' },
  { n: '五金建材', k: 'hardware', s: 'panel', c: '#8e8a7a', t: '#3a3226' },
  { n: '文具书店', k: 'stationery', s: 'wood', c: '#5a4a34', t: '#ffe8b8' },
  { n: '花间花店', k: 'flower', s: 'chalk', c: '#274235', t: '#ffe1ea' },
  { n: '彩票投注', k: 'lottery', s: 'led', c: '#2a1d16', t: '#ff3a2a' },
  { n: '裁缝铺', k: 'tailor', s: 'cloth', c: '#c9c2b0', t: '#5a4632' },
  { n: '修鞋配钥匙', k: 'repair', s: 'panel', c: '#b5ac93', t: '#3a3226' },
  { n: '快递驿站', k: 'parcel', s: 'panel', c: '#e8a23a', t: '#3a2606' },
  { n: '房产中介', k: 'estate', s: 'vi', c: '#1f8a5b', t: '#ffffff' },
  { n: '华联超市', k: 'market', s: 'led', c: '#1f2a3a', t: '#ff9a2a' },
  { n: '烟酒行', k: 'liquor', s: 'panel', c: '#8a2a22', t: '#ffe4b0' },
  { n: '网咖', k: 'netbar', s: 'neon', c: '#161a2a', t: '#5ad2ff' },
  { n: '星际电竞', k: 'netbar', s: 'neon', c: '#1a1424', t: '#b06bff' },
  { n: '密室逃脱', k: 'escape', s: 'led', c: '#221a1a', t: '#ff5a2a' },
  { n: '剧本杀', k: 'escape', s: 'backlight', c: '#221c2a', t: '#ffd9a0' },
  { n: '星光 KTV', k: 'ktv', s: 'neon', c: '#1a1020', t: '#ff5ad2' },
  { n: '台球厅', k: 'billiard', s: 'panel', c: '#1a2a24', t: '#7affc0' },
  { n: '健身房', k: 'gym', s: 'vi', c: '#20242a', t: '#ffd23a' },
  { n: '足浴养生', k: 'spa', s: 'neon', c: '#241a1a', t: '#ffb04a' },
  { n: '银行营业厅', k: 'bank', s: 'backlight', c: '#1a2c44', t: '#ffffff' },
  { n: 'ATM 自助银行', k: 'bank', s: 'lightbox', c: '#2a3a52', t: '#cfe6ff' },
  { n: '宠物生活馆', k: 'pet', s: 'vi', c: '#f2e4d2', t: '#8a5a2b' },
  { n: '母婴用品', k: 'baby', s: 'vi', c: '#f6e2ea', t: '#c04b6a' },
  { n: '眼镜店', k: 'glasses', s: 'lightbox', c: '#eef2f6', t: '#2a5a9a' },
  { n: '二手书店', k: 'book', s: 'wood', c: '#5a4632', t: '#ffe4b0' },
  { n: '乐器行', k: 'music', s: 'panel', c: '#2a2420', t: '#ffce7a' },
]

const DAILY = ['store', 'pharmacy', 'fruit', 'breakfast', 'noodle', 'tea', 'market', 'parcel', 'barber', 'laundry', 'bbq', 'fastfood', 'deli', 'print']
const HUSTLE = ['ktv', 'netbar', 'escape', 'billiard', 'spa', 'gym', 'hotpot', 'restaurant', 'liquor', 'repair', 'tailor']

function shopFor(district, key) {
  let allowed
  if (district === 'A') allowed = CATALOG.filter((c) => c.s !== 'led' && c.s !== 'cloth' && c.s !== 'scene')
  else if (district === 'C' || district === 'D')
    allowed = CATALOG.filter((c) => ['store', 'pharmacy', 'tea', 'bakery', 'flower', 'parcel', 'estate', 'print', 'laundry', 'market', 'fruit'].includes(c.k))
  else allowed = CATALOG
  // 老城/步行街：日常店与娱乐店权重翻倍，读起来才像中国一条街
  if (district === 'B' || district === 'E') {
    const w = district === 'B' ? DAILY : HUSTLE
    allowed = allowed.concat(allowed.filter((c) => w.includes(c.k)))
  }
  // 乘散列再取模：位置相近的两家店也不会撞同一家
  const h = (Math.floor(key) * 2654435761) % allowed.length
  return allowed[(h + allowed.length) % allowed.length]
}

const NEXT = { n: 'n', s: 's', e: 'e', w: 'w' }

/** 首层切成 5~8 家店，产生招牌与门。 */
function makeShops(b) {
  if (!b.shops) return
  const face = b.face || (b.district === 'A' ? 's' : 's')
  const along = face === 'n' || face === 's' ? b.w : b.d
  const n = Math.max(1, Math.min(8, Math.round(along / 8)))
  const unit = along / n
  let prevName = ''
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * unit - along / 2
    let x = b.x
    let z = b.z
    let rot = 0
    if (face === 's') z = b.z + b.d / 2 + 0.15
    else if (face === 'n') z = b.z - b.d / 2 - 0.15
    else if (face === 'e') x = b.x + b.w / 2 + 0.15
    else x = b.x - b.w / 2 - 0.15
    if (face === 's' || face === 'n') x += t
    else z += t
    const rot2 = face === 'e' ? Math.PI / 2 : face === 'w' ? -Math.PI / 2 : 0
    const key0 = Math.abs(b.x * 3.7 + b.z * 1.9) + i * 37
    let c = shopFor(b.district, key0)
    for (let g = 1; g < 6 && c.n === prevName; g++) c = shopFor(b.district, key0 + g * 101)
    prevName = c.n
    const scale = b.district === 'B' ? 0.8 + R() * 0.5 : 1
    shops.push({
      x,
      z,
      w: unit - 0.5,
      face,
      rot: rot2,
      b: b.id,
      building: b,
      ...c,
      name: c.n,
      kind: c.k,
      // 步行街 / 商业带多挂霓虹：夜巷气质靠招牌色，不是靠墙
      signStyle:
        b.district === 'E' || b.district === 'M'
          ? c.s === 'lightbox' || c.s === 'panel' || c.s === 'backlight'
            ? R() < 0.55
              ? 'neon'
              : c.s
            : c.s
          : b.district === 'B'
            ? c.s
            : c.s === 'led'
              ? 'backlight'
              : c.s,
      color: c.c,
      ink: c.t,
      h: 3.2 * scale,
      tier: b.tier,
      open: R() < 0.86,
      vertical: b.district === 'B' && R() < 0.4,
      stacked: b.district === 'B' && R() < 0.35,
    })
  }
}


// 退线：楼压到马路就沿垂直方向最小位移退出来（含 1.2m 人行道余量）；环城路同理
for (const b of buildings) {
  for (let pass = 0; pass < 4; pass++) {
    for (const r of ROADS) {
      const alongZ = r.a === 'z'
      const t = alongZ ? b.z : b.x
      const [e0, e1] = roadExtent(r)
      if (t < e0 - 2 || t > e1 + 2) continue
      const cur = alongZ ? b.x : b.z
      const need = r.w / 2 + 1.2 + (alongZ ? b.w : b.d) / 2
      if (Math.abs(cur - r.at) >= need) continue
      const dir = Math.sign(cur - r.at) || 1
      if (alongZ) b.x = r.at + dir * need
      else b.z = r.at + dir * need
    }
    const half = RING.w / 2 + 1.2
    b.x = clamp(b.x, CITY.x0 + half + b.w / 2, CITY.x1 - half - b.w / 2)
    b.z = Math.min(b.z, CITY.z1 - half - b.d / 2)
  }
}

// 退线会把楼往里推，推完可能叠在一起：普通楼一旦和前面的楼相交就去掉
for (let i = buildings.length - 1; i >= 0; i--) {
  const a = buildings[i]
  if (a.site) continue
  const hit = buildings.some(
    (b, j) => j !== i && (b.site || j < i) && Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.3 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 0.3
  )
  if (hit) buildings.splice(i, 1)
}

for (const b of buildings) makeShops(b)

// ---------------------------------------------------------------------------
// 街道设施：红绿灯 / 公交站 / 地铁口 / 共享单车 / 树 / 路灯
// ---------------------------------------------------------------------------
const crossing = (a, b) => roadAt(a, b.at) && roadAt(b, a.at)
export const SIGNALS = []
for (const zr of ROADS.filter((r) => r.a === 'z' && r.tier <= 2)) {
  for (const xr of ROADS.filter((r) => r.a === 'x' && r.tier <= 2)) {
    if (!crossing(zr, xr)) continue
    const [z0] = roadExtent(zr)
    if (xr.at < z0) continue
    if (Math.abs(zr.at) < 20 && Math.abs(xr.at) < 20) continue
    SIGNALS.push({ x: zr.at, z: xr.at })
  }
}

/** 某点是否落在任一路口范围内（排树 / 排灯时跳过路口） */
const nearCrossRoad = (axis, t, pad) => ROADS.some((o) => o.a !== axis && Math.abs(o.at - t) < o.w / 2 + pad)

export const BUS_STOPS = []
for (let z = -380; z <= 450; z += 85) {
  if (nearCrossRoad('z', z, 14) || nearCrossRoad('z', z + 40, 14)) continue
  BUS_STOPS.push({ x: -27, z, side: 'e', name: '中山路站' })
  BUS_STOPS.push({ x: 27, z: z + 40, side: 'w', name: '中山路站' })
}
for (let x = -700; x <= 700; x += 110) {
  if (nearCrossRoad('x', x, 14)) continue
  BUS_STOPS.push({ x, z: -30, side: 's', name: '人民大道站' })
}

export const BIKES = []
for (const m of METRO) {
  for (const d of [-1, 1]) BIKES.push({ x: m.x + d * 22, z: m.z + 22, n: 12, rot: d > 0 ? 0 : Math.PI })
}
BIKES.push({ x: -300, z: -100, n: 14, rot: 0 })
BIKES.push({ x: 120, z: 270, n: 16, rot: Math.PI })
BIKES.push({ x: 470, z: -140, n: 16, rot: Math.PI / 2 })

const freeSpot = (x, z, pad) =>
  !buildings.some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) && !nearCreek(x, z, 2)

export const TREES = []
// 主干 / 次干道两侧行道树
for (const r of ROADS.filter((o) => o.tier <= 2)) {
  const [e0, e1] = roadExtent(r)
  const step = r.tier === 1 ? 13 : 15
  for (let t = e0 + 8; t <= e1 - 8; t += step) {
    if (nearCrossRoad(r.a, t, 6)) continue
    for (const s of [-1, 1]) {
      const off = r.at + s * (r.w / 2 + 1.5)
      const x = r.a === 'x' ? t : off
      const z = r.a === 'x' ? off : t
      if (freeSpot(x, z, 1.5)) TREES.push({ x, z, s: 0.9 })
    }
  }
}
// 滨江步道两排树、环城路北段内侧一排
for (let x = CITY.x0 + 20; x <= CITY.x1 - 20; x += 16) {
  TREES.push({ x, z: waterN(x) + BANK.slope + 9, s: 1.1 })
  TREES.push({ x: x + 8, z: waterN(x + 8) + BANK.walk - 3, s: 1.0 })
  if (freeSpot(x, CITY.z1 - 19, 1)) TREES.push({ x, z: CITY.z1 - 19, s: 1.0 })
}
for (const g of GREEN_LOTS) {
  const rg = mulberry32(Math.floor(Math.abs(g.x) * 31 + Math.abs(g.z) * 17))
  const n = 2 + Math.floor(rg() * 3)
  for (let i = 0; i < n; i++) TREES.push({ x: g.x + (rg() - 0.5) * g.w * 0.7, z: g.z + (rg() - 0.5) * g.d * 0.7, s: 0.8 + rg() * 0.5, lot: true })
}
// 小区园林：围墙内侧一圈 + 楼间中庭成片
for (const c of COMPOUNDS) {
  const rg = mulberry32(Math.floor(Math.abs(c.x0) * 7 + c.z0))
  const clear = (x, z) => freeSpot(x, z, 3) && !(x < c.x0 + 16 && z < c.z0 + 16) && !(x > c.x1 - 16 && z < c.z0 + 14)
  for (let x = c.x0 + 4; x <= c.x1 - 4; x += 10) for (const z of [c.z0 + 3, c.z1 - 3]) if (clear(x, z)) TREES.push({ x, z, s: 0.9 })
  for (let z = c.z0 + 12; z <= c.z1 - 12; z += 10) for (const x of [c.x0 + 3, c.x1 - 3]) if (clear(x, z)) TREES.push({ x, z, s: 0.9 })
  const n = Math.round(((c.x1 - c.x0) * (c.z1 - c.z0)) / 420)
  for (let i = 0; i < n; i++) {
    const x = c.x0 + 8 + rg() * (c.x1 - c.x0 - 16)
    const z = c.z0 + 8 + rg() * (c.z1 - c.z0 - 16)
    if (clear(x, z)) TREES.push({ x, z, s: 0.8 + rg() * 0.6, lot: true })
  }
}
// 中央公园 / 文教区草坪 / 科技园：成片种树，避开湖、小河、步道和球场
{
  const rg = mulberry32(777)
  const P0 = PARKS[0]
  const inLake = (x, z) => ((x - P0.lake.x) / (P0.lake.rx + 5)) ** 2 + ((z - P0.lake.z) / (P0.lake.rz + 5)) ** 2 < 1
  const zones = [
    [P0.x0 + 6, P0.x1 - 6, P0.z0 + 6, P0.z1 - 6, 260],
    [20, 388, 262, 461, 120],
    [-188, -20, 262, 461, 50],
    [412, 745, -208, 238, 200],
  ]
  for (const [x0, x1, z0, z1, n] of zones) {
    for (let i = 0; i < n; i++) {
      const x = x0 + rg() * (x1 - x0)
      const z = z0 + rg() * (z1 - z0)
      if (inLake(x, z) || !freeSpot(x, z, 4)) continue
      if (P0.courts.some(([cx, cz]) => Math.abs(x - cx) < 16 && Math.abs(z - cz) < 10)) continue
      if (Math.hypot(x - (P0.x1 - 22), z - (P0.z0 + 20)) < 16) continue
      TREES.push({ x, z, s: 0.8 + rg() * 0.7, lot: true })
    }
  }
}

export const LAMPS = []
// 每条路都装灯（支路也装），灯距收紧：夜里路网要靠连续的暖光「画」出来
for (const r of ROADS) {
  const [e0, e1] = roadExtent(r)
  const step = r.tier === 1 ? 22 : r.tier === 2 ? 24 : 30
  let k = 0
  for (let t = e0 + 12; t <= e1 - 12; t += step / 2) {
    if (nearCrossRoad(r.a, t, 4)) continue
    const s = k++ % 2 ? 1 : -1
    const off = r.at + s * (r.w / 2 + 1.5)
    if (r.a === 'x') LAMPS.push({ x: t, z: off, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2 })
    else LAMPS.push({ x: off, z: t, rot: s > 0 ? Math.PI : 0 })
  }
}
for (let x = CITY.x0 + 12; x <= CITY.x1 - 12; x += 24) LAMPS.push({ x, z: waterN(x) + BANK.slope + 5.5, rot: 0 })

/** 索道：山脚站 → 山顶站，中间两座塔架。 */
export const CABLE = {
  base: { x: 120, z: 502, y: groundY(120, 502) },
  top: { x: 120, z: 652, y: groundY(120, 652) + 16 },
  towers: [
    { x: 120, z: 552 },
    { x: 120, z: 604 },
  ],
}
/** 山上的小庙 */
export const TEMPLE = { x: 300, z: 600 }

export const FERRIS = { x: 660, z: -290, r: 32, y: groundY(660, -290) }
export const DOCK = { x: -300, z: waterN(-300) + 8 }
export const STEPS = { x0: -340, x1: -260, z0: waterN(-300) + 2, z1: waterN(-300) + BANK.slope }

/** 人行天桥：跨中山路 / 江湾路 / 东岸大道。axis 是桥下那条路的走向。 */
export const BRIDGES = [
  { a: [-60, 0], b: [60, 0], axis: 'z', y: 6.2 },
  { a: [0, -250], b: [0, -190], axis: 'x', y: 6.2 },
  { a: [400, -30], b: [400, 30], axis: 'x', y: 6.2 },
]

/** 步行街与主街上的小广场景点（地面铺装变化 + 座椅 + 树池）。 */
export const PLAZAS = [
  { x: -310, z: -278, w: 40, d: 24 },
  { x: -110, z: -278, w: 34, d: 22 },
  { x: -500, z: -278, w: 30, d: 20 },
  { x: 244, z: -368, w: 50, d: 40 },
]

/** 江边一带的小体量商业（渔具店、江鲜馆、茶摊……），只有首层，在滨江步道上。 */
const KIOSK_DEF = [
  [-560, 9, 7, '老李渔具', '#2f6a8a', '#ffffff'],
  [-520, 10, 7, '江鲜馆', '#b23a26', '#ffe9bd'],
  [-470, 7, 6, '茶摊', '#4a6a3a', '#ffe6b0'],
  [-230, 8, 6, '冰粉凉虾', '#c9a24e', '#3a2410'],
  [-160, 7, 6, '烤鱼摊', '#241a16', '#ffb04a'],
  [-60, 10, 7, '江畔咖啡', '#2b2b2b', '#f0e2c8'],
  [420, 8, 6, '观光纪念品', '#3a5a7a', '#ffffff'],
  [700, 8, 6, '江滩小卖部', '#e8a23a', '#3a2606'],
]
export const KIOSKS = KIOSK_DEF.map(([x, w, d, name, sign, ink]) => ({ x, z: waterN(x) + BANK.walk - d / 2 - 2, w, d, name, sign, ink }))

/** 玩家可活动范围 */
export const LIMITS = { x0: CITY.x0 - 60, x1: CITY.x1 + 60, z0: -640, z1: 780 }

export const byId = Object.fromEntries(buildings.map((b, i) => [b.id || `b${i}`, b]))

// 江边小商业：只有首层，紧贴滨江步道，店面朝江
for (const k of KIOSKS) {
  addBuilding({
    id: 'kiosk-' + k.name,
    kind: 'shop',
    name: k.name,
    x: k.x,
    z: k.z,
    w: k.w,
    d: k.d,
    h: 4.2,
    floors: 1,
    roof: 'plain',
    color: '#636b7a',
    trim: '#8e949e',
    district: 'F',
    tier: 'A',
    shops: 1,
    enter: true,
    face: 'n',
    kiosk: true,
    signColor: k.sign,
    signInk: k.ink,
  })
  makeShops(buildings[buildings.length - 1])
}
