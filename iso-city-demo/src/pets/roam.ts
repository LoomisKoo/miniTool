// 漫游：位置完全由 (id, 绝对时间) 算出，没有任何网络同步。
//
// 关键约束：必须用「绝对时间」而不是 clock.elapsedTime，否则两个客户端
// 看到的宠物会差一个页面加载时长，刷新页面也会瞬移。

import { hashString, mulberry } from '../catalog/random'

export type RoamPose = { x: number; z: number; speed: number }

export type RoamHome = { x: number; z: number; radius: number }

const cache = new Map<string, { phase: number; rate: number; wobble: number }>()

function orbit(id: string) {
  const hit = cache.get(id)
  if (hit) return hit
  const rnd = mulberry(hashString(id))
  const value = {
    phase: rnd() * Math.PI * 2,
    rate: 0.085 + rnd() * 0.055,
    wobble: 0.52 + rnd() * 0.32,
  }
  cache.set(id, value)
  return value
}

/** t 用秒。两个不同频率的正弦相叠加，轨迹不闭合，看着才像在闲逛。 */
export function petPose(id: string, home: RoamHome, t: number, scale = 1): RoamPose {
  const { phase, rate, wobble } = orbit(id)
  const r = home.radius * scale
  return {
    x: home.x + Math.cos(t * rate + phase) * r,
    z: home.z + Math.sin(t * rate * 0.71 + phase * 1.7) * r * wobble,
    speed: rate * r,
  }
}

/** 下一步的方向，用来决定精灵朝左还是朝右。 */
export function petHeading(id: string, home: RoamHome, t: number, scale = 1) {
  const a = petPose(id, home, t, scale)
  const b = petPose(id, home, t + 0.35, scale)
  return { x: b.x - a.x, z: b.z - a.z }
}

/** 玩家靠近时野生宠物会退开：这是「没被领养」最强的行为信号。 */
export function flinch(
  pose: RoamPose,
  player: { x: number; z: number },
  minDist = 2.6,
): { x: number; z: number; shy: number } {
  const dx = pose.x - player.x
  const dz = pose.z - player.z
  const d = Math.hypot(dx, dz)
  if (d >= minDist || d < 1e-3) return { x: pose.x, z: pose.z, shy: 0 }
  const push = (minDist - d) * 0.85
  return { x: pose.x + (dx / d) * push, z: pose.z + (dz / d) * push, shy: 1 - d / minDist }
}
