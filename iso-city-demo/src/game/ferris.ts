import { ferrisWheel } from '../data/city'
import { walker } from './walker'

/**
 * 摩天轮的共享状态。转角按真实时间算，主城和室内窗外的两份摩天轮转得完全同步；
 * 乘坐时 PlayerRig 每帧把玩家钉在车厢座位上。
 */
export const CABINS = 14
/** 轴心高度：比轮半径再高 4m，车厢底壳转到最低点时正好停在站台上方。 */
export const HUB_Y = ferrisWheel.radius + 4
/** 车厢挂点到地板的距离。 */
export const CABIN_DROP = 2.9
/** 一圈 4 分钟。 */
const PERIOD = 240

export const ferris = { riding: -1 }

export function wheelAngle() {
  return ((performance.now() / 1000) * Math.PI * 2) / PERIOD
}

export function cabinAngle(i: number, angle = wheelAngle()) {
  return angle + (i / CABINS) * Math.PI * 2
}

/** 车厢地板中心的世界坐标。 */
export function cabinFloor(i: number, angle = wheelAngle()) {
  const a = cabinAngle(i, angle)
  return {
    x: ferrisWheel.x + Math.cos(a) * ferrisWheel.radius,
    y: HUB_Y + Math.sin(a) * ferrisWheel.radius - CABIN_DROP,
    z: ferrisWheel.z,
  }
}

/** 当前离地最近的车厢。 */
export function lowestCabin() {
  const angle = wheelAngle()
  let best = 0
  let low = Infinity
  for (let i = 0; i < CABINS; i++) {
    const s = Math.sin(cabinAngle(i, angle))
    if (s < low) {
      low = s
      best = i
    }
  }
  return best
}

export const boardSpot = { x: ferrisWheel.x, z: ferrisWheel.z + 6.2 }

export function boardFerris() {
  ferris.riding = lowestCabin()
  walker.flying = false
  walker.velocity.set(0, 0, 0)
  walker.vy = 0
}

export function leaveFerris() {
  ferris.riding = -1
  walker.position.set(boardSpot.x, 0, boardSpot.z)
  walker.velocity.set(0, 0, 0)
  walker.vy = 0
}

export const ferrisExit = {
  id: 'ferris-exit',
  label: '摩天轮',
  hint: '按 E 下车（随时可下，会回到上车平台）',
  x: 0,
  z: 0,
  radius: 999,
  action: leaveFerris,
}
