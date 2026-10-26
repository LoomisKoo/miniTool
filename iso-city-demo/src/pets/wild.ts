// 野生宠物池：按小时切片 + 确定性推导。
//
// 服务端不存野生宠物。任何客户端、任何时刻，算出来的那一批完全一致，
// 于是「刷出来就留在街上」这种堆积问题从根上不存在——每小时整批换。

import { allBuildings } from '../data/infill'
import { CITY_BOUNDS, insideRoad } from '../data/city'
import { pedestrianRoutes } from '../data/infill'
import {
  PALETTES,
  dullPalette,
  hashString,
  mulberry,
  randomPetRecipe,
  type Palette,
  type PetRecipe,
} from '../catalog/recipes'

export const WILD_SLOTS = 12
export const WILD_HOUR = 3_600_000

export type WildSpot = { x: number; z: number; radius: number }

export type WildPet = {
  id: string
  recipe: PetRecipe
  palette: Palette
  spot: WildSpot
  bucket: number
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
    // 半径取「到最近墙」的一半，保证漫游轨迹不会穿进楼里
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

export function wildPool(bucket = Math.floor(Date.now() / WILD_HOUR)): WildPet[] {
  const spots = WILD_SPOTS.length ? WILD_SPOTS : [{ x: 0, z: 26, radius: 3 }]
  const rnd = mulberry(hashString(`wild-${bucket}`))
  return Array.from({ length: WILD_SLOTS }, (_, i) => {
    const spot = spots[Math.floor(rnd() * spots.length) % spots.length]
    const base = PALETTES[Math.floor(rnd() * PALETTES.length) % PALETTES.length]
    return {
      id: `w-${bucket}-${i}`,
      recipe: randomPetRecipe(`wild-${bucket}-${i}`),
      // 野生用降饱和的本色：和有主人的宠物在 20 米外就能分开
      palette: dullPalette(base, 0.38),
      spot: {
        x: spot.x + (rnd() - 0.5) * 2.4,
        z: spot.z + (rnd() - 0.5) * 2.4,
        radius: spot.radius,
      },
      bucket,
    }
  })
}

export function currentBucket(now = Date.now()) {
  return Math.floor(now / WILD_HOUR)
}
