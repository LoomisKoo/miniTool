import { buildings } from '../data/city'
import { isUnitBuilding, shellHeightOf, unitBuilding } from '../data/units'
import { useApp } from '../store'

/** 港湾酒店楼顶的发射台。坐标取规划后的楼位，楼被挪过也跟着走。 */
export const launcher = (() => {
  const b = buildings.find((item) => item.id === 'harbor-hotel')
  if (!b) return null
  const unit = isUnitBuilding(b.id) ? unitBuilding(b.id) : null
  // UnitShell 的屋面板厚 0.3m，压在楼壳顶上
  const y = unit ? shellHeightOf(unit) + 0.3 : b.h
  return { x: b.x + b.w * 0.18, z: b.z - b.d * 0.12, y }
})()

type Launch = { x: number; y: number; z: number; at: number }

/** 待发射的一轮烟花，由场景里的 Fireworks 组件取走。 */
export const launchQueue: Launch[] = []

let lastLaunch = -Infinity

export function canLaunchFireworks() {
  const { user, world } = useApp.getState()
  if (!user) return false
  return Boolean(world?.spaces.some((space) => space.ownerId === user.id))
}

export function launchFireworks() {
  const app = useApp.getState()
  if (!launcher) return
  if (!app.user) {
    app.showToast('登录并认领空间后才能放烟花')
    return
  }
  if (!canLaunchFireworks()) {
    app.showToast('需要认领一个空间才能使用发射台')
    return
  }
  const now = performance.now() / 1000
  if (now - lastLaunch < 6) {
    app.showToast('发射台正在装填，稍等几秒')
    return
  }
  lastLaunch = now
  // 一轮 7 发，错开时间和落点
  for (let i = 0; i < 7; i++) {
    launchQueue.push({
      x: launcher.x + (Math.random() - 0.5) * 3,
      y: launcher.y + 0.8,
      z: launcher.z + (Math.random() - 0.5) * 3,
      at: now + i * 0.45 + Math.random() * 0.2,
    })
  }
  app.showToast('点火！')
}
