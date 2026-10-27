// 野生宠物池：按小时切片 + 确定性推导。
//
// 服务端不存野生宠物。任何客户端、任何时刻，算出来的那一批完全一致，
// 于是「刷出来就留在街上」这种堆积问题从根上不存在——每小时整批换。
//
// 每一只都是「物种 + 品种」：物种决定模型，品种只换主毛色。

import { allBuildings, pedestrianRoutes } from '../data/infill'
import { CITY_BOUNDS, insideRoad } from '../data/city'
import { hashString, mulberry } from '../catalog/random'
import { SPECIES, WILD_SLOTS, speciesOf, type Breed } from '../catalog/species'

export { WILD_SLOTS }
export const WILD_HOUR = 3_600_000
/** 每小时固定出现的耳廓狐数量，避免稀有品种长期刷不到。 */
export const FENNEC_SLOTS = 3

export type WildSpot = { x: number; z: number; radius: number }

export type WildPet = {
  id: string
  species: string
  breed: Breed
  /** 个体大小抖动：同品种的猫也不会一样大 */
  scale: number
  spot: WildSpot
  bucket: number
  /** 已领养时才有：名字、主人、领养时间、最后一次吃饱的时间 */
  nickname?: string | null
  owner?: { id: string; name: string; color: string } | null
  adoptedAt?: string | null
  hungerAt?: string | null
}

/** 按物种表里的 spawn 权重抽：猫狗最常见，老虎、熊猫这种一小时里未必碰得到一只。 */
const TOTAL_WEIGHT = SPECIES.reduce((sum, item) => sum + item.spawn, 0)

function speciesFor(r: number) {
  let acc = 0
  const target = r * TOTAL_WEIGHT
  for (const item of SPECIES) {
    acc += item.spawn
    if (target <= acc) return item.id
  }
  return SPECIES[0].id
}

function breedFor(list: Breed[], r: number) {
  const total = list.reduce((sum, b) => sum + (b.weight ?? 1), 0)
  let acc = 0
  for (const b of list) {
    acc += b.weight ?? 1
    if (r * total <= acc) return b
  }
  return list[0]
}

/**
 * 生成点：直接沿用行人的路线。
 *
 * 人行道本来就是「会有人经过、但不会挡住交通」的那条带，宠物出现在那里最自然，
 * 也就不需要为野生宠物单独维护一份手写坐标。路线是静态数据，这个函数只在
 * 模块加载时跑一次。
 */
function collectSpots(): WildSpot[] {
  const spots: WildSpot[] = []
  const boxes = allBuildings
    .filter((b) => Math.abs(b.x) < CITY_BOUNDS + 40 && Math.abs(b.z) < CITY_BOUNDS + 40)
    .map((b) => ({
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
    }))

  // 到最近建筑外墙的距离（在建筑内返回 0）
  const clearance = (x: number, z: number) => {
    let best = Infinity
    for (const box of boxes) {
      const dx = Math.max(box.minX - x, 0, x - box.maxX)
      const dz = Math.max(box.minZ - z, 0, z - box.maxZ)
      const d = Math.hypot(dx, dz)
      if (d < best) best = d
      if (best === 0) return 0
    }
    return best
  }

  const push = (x: number, z: number) => {
    if (Math.abs(x) > CITY_BOUNDS - 4 || Math.abs(z) > CITY_BOUNDS - 4) return
    // 车行道上不能站宠物：路线偏移 ±1.6m 时会有一半落在路面上
    if (insideRoad(x, z, 0.6)) return
    const free = clearance(x, z)
    if (free < 1.4) return
    spots.push({ x, z, radius: Math.min(4.2, Math.max(1.6, free * 0.5)) })
  }

  for (const route of pedestrianRoutes) {
    if (route.kind === 'line') {
      const span = Math.abs(route.to - route.from)
      const count = Math.max(1, Math.floor(span / 21))
      for (let i = 0; i <= count; i++) {
        const v = Math.min(route.from, route.to) + (span * i) / count
        for (const side of [-1.6, 1.6]) {
          if (route.axis === 'z') push(route.offset + side, v)
          else push(v, route.offset + side)
        }
      }
    } else {
      const n = 8
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        push(route.cx + Math.cos(a) * (route.r + 1.6), route.cz + Math.sin(a) * (route.r + 1.6))
      }
    }
  }

  return spots
}

export const WILD_SPOTS: WildSpot[] = collectSpots()

const fennec = () => speciesOf('fox').breeds.find((breed) => breed.id === 'fox-fennec') as Breed

function makePet(
  id: string,
  bucket: number,
  species: string,
  breed: Breed,
  spot: WildSpot,
  rnd: () => number,
): WildPet {
  return {
    id,
    species,
    breed,
    scale: 0.92 + rnd() * 0.18,
    spot: {
      x: spot.x + (rnd() - 0.5) * 1.2,
      z: spot.z + (rnd() - 0.5) * 1.2,
      radius: Math.min(2.4, spot.radius),
    },
    bucket,
  }
}

export function wildPool(bucket = Math.floor(Date.now() / WILD_HOUR)): WildPet[] {
  const spots = WILD_SPOTS.length ? WILD_SPOTS : [{ x: 0, z: 26, radius: 3 }]
  const rnd = mulberry(hashString(`wild-${bucket}`))

  // 点位做成一副牌，抽完再洗：40 只宠物不该有十几只挤在同一个路口。
  let deck: WildSpot[] = []
  const draw = () => {
    if (!deck.length) {
      deck = spots.slice()
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1))
        const swap = deck[i]
        deck[i] = deck[j]
        deck[j] = swap
      }
    }
    return deck.pop() as WildSpot
  }

  const wild = Array.from({ length: WILD_SLOTS - FENNEC_SLOTS }, (_, i) => {
    const spot = draw()
    const species = speciesFor(rnd())
    const breed = breedFor(speciesOf(species).breeds, rnd())
    return makePet(`w-${bucket}-${i}`, bucket, species, breed, spot, rnd)
  })

  // 固定槽位：每个小时都能遇到几只耳廓狐，同时仍保留普通随机物种。
  for (let i = 0; i < FENNEC_SLOTS; i++) {
    wild.push(makePet(`w-${bucket}-fennec-${i}`, bucket, 'fox', fennec(), draw(), rnd))
  }
  return wild
}

export function currentBucket(now = Date.now()) {
  return Math.floor(now / WILD_HOUR)
}
