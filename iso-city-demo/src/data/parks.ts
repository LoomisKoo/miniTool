import { WALK_BOUNDS, alley, cedarLane, insideRoad, insideWater, plaza, plazaFountain, ferrisWheel } from './city'
import { allBuildings } from './infill'
import { pedReserved } from './pedestrian'

/**
 * 城市里的公园。
 *
 * 之前绿化的做法是"在空地上按网格撒树"，于是整座城除了路面就是树，
 * 俯视时是一片均匀的黄绿噪点，既没有广场也没有草坪——看起来像配色问题，
 * 其实是缺少"空地"这一层。
 *
 * 这里先在真正空着的街区里找出能放草坪的大块地（不压楼、不压路、不压水，
 * 避开广场/喷泉/摩天轮），再从里面挑几块分散开。Ground 画草坪与园路，
 * Greenery 在草坪内部把树压稀，剩下的树才成为"树"而不是"植被噪声"。
 */

export type Park = {
  x: number
  z: number
  w: number
  d: number
  /** 园心的小水池，只有最大的一块公园有 */
  pond?: { r: number }
}

const PARK_SIZE = 32
/** 两块公园之间至少隔这么远，免得挤在同一片街区 */
const SPREAD = 95
/** 只挑离市中心这么远的空地：太近是广场和商场，太远是城市边缘的林地 */
const MIN_R = 45
const MAX_R = 300

function rectHitsBuilding(x: number, z: number, w: number, d: number, pad: number) {
  for (const b of allBuildings) {
    if (
      x - w / 2 - pad < b.x + b.w / 2 &&
      x + w / 2 + pad > b.x - b.w / 2 &&
      z - d / 2 - pad < b.z + b.d / 2 &&
      z + d / 2 + pad > b.z - b.d / 2
    ) {
      return true
    }
  }
  return false
}

/** 沿四条边和中心采样：比逐点判据快，且能挡住整块压在路上/河边的候选 */
function rectFree(x: number, z: number, w: number, d: number) {
  const pad = 3
  if (rectHitsBuilding(x, z, w, d, pad)) return false
  const steps = 5
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = x - w / 2 + w * t
    const pz = z - d / 2 + d * t
    if (insideRoad(px, z - d / 2, pad) || insideRoad(px, z + d / 2, pad)) return false
    if (insideRoad(x - w / 2, pz, pad) || insideRoad(x + w / 2, pz, pad)) return false
    if (insideWater(px, z, pad) || insideWater(x, pz, pad)) return false
  }
  if (Math.abs(x - plaza.x) < plaza.w / 2 + w / 2 && Math.abs(z - plaza.z) < plaza.d / 2 + d / 2) return false
  // 步行街广场（南岸广场）：铺装、摊位、灯串、商场都在这里，草坪会压在上面
  const ped = pedReserved
  if (x + w / 2 > ped.x0 - 4 && x - w / 2 < ped.x1 + 4 && z + d / 2 > ped.z0 - 4 && z - d / 2 < ped.z1 + 4)
    return false
  // 林荫巷和东巷是有铺装的商业巷道
  for (const r of [alley, cedarLane]) {
    if (Math.abs(x - r.x) < r.w / 2 + w / 2 && Math.abs(z - r.z) < r.d / 2 + d / 2) return false
  }
  if (Math.hypot(x - plazaFountain.x, z - plazaFountain.z) < plazaFountain.r + w * 0.7) return false
  if (Math.hypot(x - ferrisWheel.x, z - ferrisWheel.z) < ferrisWheel.radius + w * 0.8) return false
  return true
}

function findParks(): Park[] {
  const limit = WALK_BOUNDS - PARK_SIZE
  const candidates: Array<{ x: number; z: number; r: number }> = []
  for (let x = -limit; x <= limit; x += 6) {
    for (let z = -limit; z <= limit; z += 6) {
      const r = Math.hypot(x, z)
      if (r < MIN_R || r > MAX_R) continue
      if (!rectFree(x, z, PARK_SIZE, PARK_SIZE)) continue
      candidates.push({ x, z, r })
    }
  }
  // 靠近市中心的先占位，再按间距铺开：画面中央一定要有一块草坪，
  // 全丢在城郊的话俯视时看不到。
  candidates.sort((a, b) => a.r - b.r)
  const picked: Park[] = []
  for (const c of candidates) {
    if (picked.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < SPREAD)) continue
    picked.push({ x: c.x, z: c.z, w: PARK_SIZE, d: PARK_SIZE })
    if (picked.length >= 4) break
  }
  // 最大的那块（离玩家最近的那块）中间挖一个水池
  if (picked.length) picked[0].pond = { r: 5.4 }
  return picked
}

export const parks: Park[] = findParks()

/** 点位是否落在某个公园的草坪里。pad 为负时把边缘留给树。 */
export function insidePark(x: number, z: number, pad = 0): Park | null {
  for (const p of parks) {
    if (Math.abs(x - p.x) < p.w / 2 + pad && Math.abs(z - p.z) < p.d / 2 + pad) return p
  }
  return null
}
