import { W } from './spec.js'
import { mulberry } from './rng.js'
import { CATALOG } from './catalog.js'

/**
 * 城市平面：分级路网（干道疏、间距不规则）+ 跨格合并（大塔 / 商场 / 公园 / 广场可占多格）。
 * 大街廓内部由建筑层做围合内院，避免「出门就是马路」。
 */

function makeBlock(kind, x0, x1, z0, z1, extra = {}) {
  const w = x1 - x0
  const d = z1 - z0
  return {
    kind,
    x0,
    x1,
    z0,
    z1,
    cx: (x0 + x1) / 2,
    cz: (z0 + z1) / 2,
    w,
    d,
    span: 1,
    ...extra,
  }
}

/** 两格是否隔一条路相邻（可合并） */
function edgeAdjacent(a, b) {
  const roadMax = 90
  const zOver = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)
  if (zOver > Math.min(a.d, b.d) * 0.45) {
    if (Math.abs(a.x1 - b.x0) < roadMax || Math.abs(b.x1 - a.x0) < roadMax) return 'x'
  }
  const xOver = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  if (xOver > Math.min(a.w, b.w) * 0.45) {
    if (Math.abs(a.z1 - b.z0) < roadMax || Math.abs(b.z1 - a.z0) < roadMax) return 'z'
  }
  return null
}

function unionBox(list) {
  let x0 = Infinity
  let x1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (const b of list) {
    x0 = Math.min(x0, b.x0)
    x1 = Math.max(x1, b.x1)
    z0 = Math.min(z0, b.z0)
    z1 = Math.max(z1, b.z1)
  }
  return { x0, x1, z0, z1 }
}

/**
 * 贪心合并：从种子向外吞相邻格，最多 maxCells 格。
 * kinds: 允许被吞的类型；outKind: 合并后类型
 */
function mergeSpans(blocks, rng, { kinds, outKind, maxCells, attempts, preferLarge }) {
  const set = new Set(kinds)
  const pool = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => set.has(b.kind) && !b._eaten)
  if (preferLarge) pool.sort((a, c) => c.b.w * c.b.d - a.b.w * a.b.d)
  else {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
  }

  let made = 0
  for (const seed of pool) {
    if (made >= attempts) break
    if (seed.b._eaten) continue

    const cluster = [seed.b]
    seed.b._eaten = true
    let guard = 0
    while (cluster.length < maxCells && guard++ < 12) {
      let added = null
      for (const cand of blocks) {
        if (cand._eaten || !set.has(cand.kind)) continue
        if (cluster.some((c) => edgeAdjacent(c, cand))) {
          added = cand
          break
        }
      }
      if (!added) break
      added._eaten = true
      cluster.push(added)
    }

    if (cluster.length < 2) {
      // 单格不够格：吐回去，留给原样
      seed.b._eaten = false
      continue
    }

    const box = unionBox(cluster)
    const merged = makeBlock(outKind, box.x0, box.x1, box.z0, box.z1, {
      span: cluster.length,
      mega: true,
      cells: cluster.map((c) => ({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 })),
    })
    blocks.push(merged)
    made++
  }

  // 清掉被吞的
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]._eaten) blocks.splice(i, 1)
    else delete blocks[i]._eaten
  }
}

export function buildPlan(seed = 20261110) {
  const rng = mulberry(seed)
  const half = W.cityWidth / 2
  const z0 = -W.segmentLength / 2
  const z1 = W.segmentLength / 2

  // 分级干道：不规则间距，南北约 460–720m，东西约 340–560m，偶发更大空档
  const irregular = (lo, hi, minG, maxG, skip) => {
    const out = []
    let x = lo + minG * (0.35 + rng() * 0.5)
    while (x <= hi) {
      if (!skip || !skip(x)) out.push(Math.round(x * 10) / 10)
      let step = minG + rng() * (maxG - minG)
      if (rng() < 0.22) step += minG * (0.28 + rng() * 0.45)
      x += step
    }
    return out
  }
  const avenues = irregular(
    -half + 160,
    half - 160,
    460,
    720,
    (x) => Math.abs(x) < W.riverWidth / 2 + 90,
  )
  const streets = irregular(z0 + 70, z1 - 70, 340, 560, null)

  const commerceStreets = streets.filter((_, i) => i % 2 === 1)
  const commerceAvenues = avenues.filter((_, i) => i % 2 === 0)

  const blocks = []
  const xs = [-half + 30, ...avenues, half - 30].sort((a, b) => a - b)
  const zs = [z0 + 30, ...streets, z1 - 30].sort((a, b) => a - b)

  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iz = 0; iz < zs.length - 1; iz++) {
      const xA = xs[ix]
      const xB = xs[ix + 1]
      const zA = zs[iz]
      const zB = zs[iz + 1]
      const roadPad = 6
      const x0 = xA + (ix === 0 ? 0 : W.avenueW / 2) + roadPad
      const x1 = xB - (ix === xs.length - 2 ? 0 : W.avenueW / 2) - roadPad
      const zz0 = zA + (iz === 0 ? 0 : W.streetW / 2) + roadPad
      const zz1 = zB - (iz === zs.length - 2 ? 0 : W.streetW / 2) - roadPad
      const w = x1 - x0
      const d = zz1 - zz0
      if (w < 28 || d < 28) continue

      const cx = (x0 + x1) / 2
      const cz = (zz0 + zz1) / 2

      if (Math.abs(cx) < W.riverWidth / 2 + 55) {
        blocks.push(makeBlock('riverbank', x0, x1, zz0, zz1, { ix, iz }))
        continue
      }

      const distWall = half - Math.abs(cx)
      const onShopStreet =
        commerceStreets.some((z) => Math.abs(z - zA) < 40 || Math.abs(z - zB) < 40) ||
        commerceAvenues.some((x) => Math.abs(x - xA) < 50 || Math.abs(x - xB) < 50)

      // 摩天楼主导：core/high 占大头，矮铺只留商业街
      const t = rng()
      let kind = 'high'
      if (distWall < 380) kind = t < 0.06 ? 'park' : t < 0.55 ? 'high' : 'wallside'
      else if (Math.abs(cx) < W.riverWidth / 2 + 240) kind = t < 0.07 ? 'park' : t < 0.45 ? 'high' : 'waterfront'
      else if (Math.abs(cx) < 1100 && Math.abs(cz) < 700) kind = t < 0.55 ? 'core' : 'high'
      else if (onShopStreet && t < 0.55) kind = 'shop'
      else if (t < 0.03) kind = 'park'
      else if (t < 0.04) kind = 'plaza'
      else if (t < 0.08) kind = 'low'
      else if (t < 0.18) kind = 'shop'
      else if (t < 0.32) kind = 'mid'
      else if (t < 0.55) kind = 'high'
      else kind = 'core'

      blocks.push(makeBlock(kind, x0, x1, zz0, zz1, { ix, iz }))
    }
  }

  // —— 跨格合并：公园少而大；建成区合并成大塔/商场场地 ——
  mergeSpans(blocks, rng, {
    kinds: ['park'],
    outKind: 'park',
    maxCells: 2,
    attempts: 6,
    preferLarge: true,
  })
  mergeSpans(blocks, rng, {
    kinds: ['plaza'],
    outKind: 'plaza',
    maxCells: 2,
    attempts: 3,
    preferLarge: false,
  })
  // 纽约以「地皮」为单元，少做跨好多格的超大地块
  mergeSpans(blocks, rng, {
    kinds: ['core', 'high'],
    outKind: 'core',
    maxCells: 2,
    attempts: 4,
    preferLarge: true,
  })
  mergeSpans(blocks, rng, {
    kinds: ['shop', 'mid'],
    outKind: 'mall',
    maxCells: 2,
    attempts: 4,
    preferLarge: true,
  })

  // 再标几个未合并的商场
  const mallAble = blocks
    .filter((b) => (b.kind === 'mid' || b.kind === 'shop') && b.w > 100 && b.d > 90 && !b.mega)
    .sort((a, b) => b.w * b.d - a.w * a.d)
  for (let i = 0; i < Math.min(6, mallAble.length); i++) {
    if (i % 2 === 1) continue
    mallAble[i].kind = 'mall'
  }

  // —— 功能区：东北角低密度别墅区；散布医院/学校/体育/停车/加油站 ——
  const hsh = (x, z) => Math.abs(Math.sin(x * 0.0131 + z * 0.0173) * 43758.5453) % 1
  const plain = (b) => !b.mega && ['mid', 'low', 'shop', 'high'].includes(b.kind)
  for (const b of blocks) {
    if (plain(b) && b.cz > 1450 && b.cx > 650 && b.cx < 1950) b.kind = 'villa'
  }
  // —— 特色片区：步行街 / 酒吧街 / 动漫潮玩区 / 老城区 / CBD ——
  const districts = []
  {
    const cs = commerceStreets.slice().sort((a, b) => Math.abs(a) - Math.abs(b))
    const zw = cs[0] ?? streets[1]
    const zb = cs.find((z) => Math.abs(z - zw) > 600) ?? cs[1] ?? streets[3]
    // 步行街：一条商业街的东段（不走车，铺地 + 灯笼 + 摊位）
    districts.push({ id: 'walk', name: '步行街', x0: 520, x1: 1500, z0: zw - 70, z1: zw + 70, street: zw })
    // 酒吧街：另一条商业街的西段（霓虹）
    districts.push({ id: 'bar', name: '酒吧街', x0: -1500, x1: -520, z0: zb - 70, z1: zb + 70, street: zb })
    districts.push({ id: 'anime', name: '动漫潮玩街', x0: -1650, x1: -1000, z0: -1300, z1: -650 })
    districts.push({ id: 'old', name: '老城区', x0: -2150, x1: -1500, z0: 650, z1: 1450 })
    districts.push({ id: 'cbd', name: '中央商务区', x0: -1100, x1: 1100, z0: -700, z1: 700, soft: true })
  }
  const facs = []
  // —— 大型设施跨多格：体育场 2×3 格（约 400×270m 场地，碗体 250×200m）、演艺中心 2×2、图书馆/博物馆 1×2 ——
  // 被合并的格子之间的道路整段取消（closed 区域：路面/人行道/路灯/标线/车流/行人都不进）
  const closed = []
  {
    const cell = new Map()
    for (const b of blocks) if (b.ix != null && !b.mega) cell.set(b.ix + ',' + b.iz, b)
    const inDist = (b) => districts.some((d) => b.x1 > d.x0 - 20 && b.x0 < d.x1 + 20 && b.z1 > d.z0 - 20 && b.z0 < d.z1 + 20)
    const okCell = (b) => b && plain(b) && Math.abs(b.cx) > 420 && Math.abs(b.cx) < 2100 && Math.abs(b.cz) < 2280 && !inDist(b) &&
      !(b.cz > 1350 && b.cx > 550 && b.cx < 2050)
    const anchors = blocks.filter(okCell).sort((a, b) => hsh(a.cx * 1.3, a.cz) - hsh(b.cx * 1.3, b.cz))
    // 学校 / 寺院也跨两格（整圈围合 + 内部设施，单格放不下）
    // 街廓已经够大，设施占一格即可，不再跨两三格把道路封掉一大片
    const MEGA = [['stadium', 1, 1], ['arena', 1, 1], ['library', 1, 1], ['museum', 1, 1], ['school', 1, 1], ['temple', 1, 1]]
    for (const [kind, nx, nz] of MEGA) {
      for (const a of anchors) {
        if (a._eaten) continue
        const cells = []
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) cells.push(cell.get((a.ix + i) + ',' + (a.iz + j)))
        if (!cells.every((c) => okCell(c) && !c._eaten)) continue
        const box = unionBox(cells)
        const cxm = (box.x0 + box.x1) / 2
        const czm = (box.z0 + box.z1) / 2
        if (facs.some((f) => Math.hypot(f.cx - cxm, f.cz - czm) < 520)) continue
        for (const c of cells) c._eaten = true
        const m = makeBlock(kind, box.x0, box.x1, box.z0, box.z1, { span: cells.length, mega: true, big: true })
        blocks.push(m)
        facs.push(m)
        closed.push({ x0: box.x0, x1: box.x1, z0: box.z0, z1: box.z1 })
        break
      }
    }
    for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i]._eaten) blocks.splice(i, 1)
  }
  const megaN = (k) => facs.filter((f) => f.kind === k).length
  // 城市设施：医院/学校/体育 + 体育场、图书馆、演艺中心、博物馆、影城、公交总站、公安、消防、邮局、酒店、超市、寺庙/教堂、立体车库、写字楼广场
  const want = [['hospital', 2], ['school', 3], ['stadium', 1], ['gym', 1], ['sports', 2], ['library', 1], ['arena', 1], ['museum', 1],
    ['cinema', 2], ['busterm', 1], ['police', 2], ['fire', 2], ['post', 2], ['hotel', 3], ['market', 2], ['farmers', 1], ['temple', 1], ['church', 1],
    ['garage', 3], ['office', 1], ['gov', 1], ['parking', 4], ['gas', 4]]
  const cands = blocks.filter((b) => plain(b) && Math.abs(b.cx) > 300 && Math.abs(b.cx) < 2150 && b.w > 100 && b.d > 56)
    .sort((a, b) => hsh(a.cx, a.cz) - hsh(b.cx, b.cz))
  for (const [k, n0] of want) {
    const n = Math.max(0, n0 - megaN(k))
    let got = 0
    for (const b of cands) {
      if (got >= n) break
      if (b.kind !== 'mid' && b.kind !== 'low' && b.kind !== 'shop' && b.kind !== 'high') continue
      if (facs.some((f) => Math.hypot(f.cx - b.cx, f.cz - b.cz) < (f.kind === k ? 1100 : 200))) continue
      if (k === 'stadium' && (b.w < 120 || b.d < 64)) continue
      b.kind = k
      facs.push(b)
      got++
    }
  }
  // 别墅区里放一所学校
  const vs = blocks.filter((b) => b.kind === 'villa' && b.w > 120).sort((a, b) => hsh(a.cz, a.cx) - hsh(b.cz, b.cx))
  if (vs.length) vs[0].kind = 'school'

  for (const b of blocks) {
    for (const d of districts) {
      if (d.soft) continue
      if (b.cx > d.x0 && b.cx < d.x1 && b.cz > d.z0 && b.cz < d.z1) {
        b.district = d.id
        // 老城/动漫/步行街/酒吧街：压成低层街区
        if (['high', 'core', 'mid', 'wallside', 'waterfront'].includes(b.kind) && !b.mega) b.kind = d.id === 'old' ? 'low' : 'shop'
      }
    }
  }
  // —— 园区内部道路：跨格合并的地块中间原本是一条干道（大道/横街）。以前整块铺成场地/广场、路面整段不画，
  // 但车流仍按干道车道穿过去 → 车在一片灰地上开。现在把那一截降级成园区内部道路（更窄的沥青路 + 路缘 + 人行道），
  // 地块沿内部道路切回两半分别建楼（仍保留 mega 高度/体量），车流在这一段收窄车道、减速通过。
  const inner = []
  const INNER = {
    avenue: { cw: 14, walk: 3.4, lane: (o) => (o < 8 ? 1.9 : 5.3), vmax: 9 },
    street: { cw: 8, walk: 3.0, lane: () => 2.1, vmax: 8 },
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (!b.cells || b.cells.length !== 2) continue
    const [p, q] = b.cells
    let axis = null
    let at = 0
    let type = null
    if (p.x1 <= q.x0 + 1 || q.x1 <= p.x0 + 1) {
      const g0 = Math.min(p.x1, q.x1)
      const g1 = Math.max(p.x0, q.x0)
      const c = (g0 + g1) / 2
      const ave = avenues.find((x) => Math.abs(x - c) < 3)
      if (ave != null && g1 - g0 < 60) { axis = 'z'; at = ave; type = 'avenue' }
    } else if (p.z1 <= q.z0 + 1 || q.z1 <= p.z0 + 1) {
      const g0 = Math.min(p.z1, q.z1)
      const g1 = Math.max(p.z0, q.z0)
      const c = (g0 + g1) / 2
      const st = streets.find((z) => Math.abs(z - c) < 3)
      if (st != null && g1 - g0 < 60) { axis = 'x'; at = st; type = 'street' }
    }
    if (!axis) continue
    const S = INNER[type]
    const hw = S.cw / 2 + 0.3 + S.walk + 0.6 // 车行道半宽 + 路缘 + 人行道 + 退线
    const r = {
      axis, at, type, cw: S.cw, walk: S.walk, vmax: S.vmax, laneAt: S.lane,
      lo: axis === 'z' ? b.z0 : b.x0, hi: axis === 'z' ? b.z1 : b.x1,
      x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1,
    }
    inner.push(r)
    const extra = { span: b.span, mega: true, district: b.district, innerSide: true }
    const parts = axis === 'z'
      ? [makeBlock(b.kind, b.x0, at - hw, b.z0, b.z1, extra), makeBlock(b.kind, at + hw, b.x1, b.z0, b.z1, extra)]
      : [makeBlock(b.kind, b.x0, b.x1, b.z0, at - hw, extra), makeBlock(b.kind, b.x0, b.x1, at + hw, b.z1, extra)]
    blocks.splice(i, 1, ...parts.filter((k) => k.w > 20 && k.d > 20))
  }

  // —— t33：别墅区分散到城边 / 大公园旁几片；城边一块做机场。都放在设施分配之后，只改这几块的 kind，不触发设施重排 ——
  {
    const near = (x, z, ok) => {
      let best = null, bd = 1e9
      for (const b of blocks) {
        if (!ok(b)) continue
        const dd = Math.hypot(b.cx - x, b.cz - z)
        if (dd < bd) { bd = dd; best = b }
      }
      return bd < 160 ? best : null
    }
    const fabric = (b) => ['core', 'high', 'mid', 'low', 'shop', 'villa'].includes(b.kind) && !b.district
    for (const v of CATALOG.villas || []) {
      const b = near(v.x, v.z, (k) => fabric(k) && !(Math.abs(k.cx) < 1100 && Math.abs(k.cz) < 700) && Math.abs(k.cx) > W.riverWidth / 2 + 240)
      if (b) b.kind = 'villa'
    }
    for (const c of CATALOG.civic || []) {
      if (!c.block) continue
      const b = near(c.block.x, c.block.z, (k) => (c.kinds || ['high', 'wallside', 'core']).includes(k.kind))
      if (!b) continue
      b.kind = c.id
      // t40 整片扩张（主题乐园）：把同一对干道之间、z 落在 grow 范围内的地块一起并进来；
      // 中间被吞掉的支路整段登记为 closed（路面 / 人行道 / 路灯 / 车流都不进），两侧干道不动
      if (c.grow) {
        const eat = blocks.filter((k) => k !== b && Math.abs(k.x0 - b.x0) < 30 && Math.abs(k.x1 - b.x1) < 30 &&
          k.z0 >= c.grow.z0 - 5 && k.z1 <= c.grow.z1 + 5 && !['riverbank', 'airport', 'park'].includes(k.kind))
        if (eat.length) {
          const all = [b, ...eat]
          const box = unionBox(all)
          Object.assign(b, makeBlock(c.id, box.x0, box.x1, box.z0, box.z1, { span: all.length, mega: true, big: true }))
          for (const k of eat) blocks.splice(blocks.indexOf(k), 1)
          closed.push({ x0: box.x0, x1: box.x1, z0: box.z0, z1: box.z1 })
        }
      }
    }
  }
  const parks = blocks.filter((b) => b.kind === 'park').sort((a, b) => b.w * b.d - a.w * a.d)
  let ferris = null
  if (parks.length) {
    const p = parks[0]
    ferris = { x: p.cx, z: p.cz, block: p }
  } else {
    ferris = { x: half * 0.35, z: -W.segmentLength * 0.18, block: null }
  }

  // 大塔候选：跨格 core/high，给建筑层用
  const landmarks = blocks
    .filter((b) => (b.kind === 'core' || b.kind === 'high') && (b.mega || b.w * b.d > 25_000))
    .sort((a, b) => b.w * b.d - a.w * a.d)
    .slice(0, 8)

  return {
    avenues,
    streets,
    commerceStreets,
    commerceAvenues,
    blocks,
    landmarks,
    half,
    z0,
    z1,
    ferris,
    districts,
    closed,
    /** 园区内部道路（跨格合并地块里被降级的那一截干道） */
    inner,
    /** 点是否落在被合并的大设施地块 / 园区内部道路段里（pad>0 向内收，pad<0 向外扩）：干道的人行道/路灯/标线/行人都不进 */
    isClosed(x, z, pad = 0.5) {
      for (const r of closed) if (x > r.x0 + pad && x < r.x1 - pad && z > r.z0 + pad && z < r.z1 - pad) return true
      for (const r of inner) if (x > r.x0 + pad && x < r.x1 - pad && z > r.z0 + pad && z < r.z1 - pad) return true
      return false
    },
  }
}

/** 地块类型 → 建筑高度；整体抬高，摩天楼为主 */
export function heightFor(kind, rng, block) {
  const mega = block?.mega || (block?.span ?? 1) > 1
  const boost = mega ? 1.3 + rng() * 0.4 : 1
  let h
  switch (kind) {
    case 'core':
      // 默认中高层；超高由 buildings 里 CBD 簇决定
      h = 180 + rng() * 160
      break
    case 'high':
      h = 120 + rng() * 140
      break
    case 'wallside':
      h = 80 + rng() * 110
      break
    case 'waterfront':
      h = 55 + rng() * 90
      break
    case 'mid':
      // t32：mid = 4~12 层（以前 45~115m 已经是高层）
      h = 14 + rng() * 26
      break
    case 'shop':
      h = 7 + rng() * 11
      break
    case 'mall':
      h = mega ? 32 + rng() * 28 : 24 + rng() * 18
      break
    case 'low':
      h = 7 + rng() * 16
      break
    default:
      h = 40 + rng() * 80
  }
  return h * (kind === 'shop' || kind === 'low' || kind === 'mid' ? 1 : boost)
}

export function styleFor(kind, rng) {
  const roll = rng()
  if (kind === 'mall' || kind === 'shop') return roll < 0.5 ? 'glass' : 'warm'
  if (kind === 'core' || kind === 'high') {
    if (roll < 0.45) return 'glass'
    if (roll < 0.65) return 'mirror'
    if (roll < 0.8) return 'stripe'
    return 'dark'
  }
  if (kind === 'waterfront') return roll < 0.4 ? 'glass' : roll < 0.7 ? 'warm' : 'bronze'
  if (kind === 'wallside') return roll < 0.4 ? 'glass' : roll < 0.65 ? 'stone' : 'stripe'
  if (roll < 0.25) return 'glass'
  if (roll < 0.45) return 'warm'
  if (roll < 0.65) return 'stone'
  if (roll < 0.8) return 'stripe'
  return 'dark'
}
