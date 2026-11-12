// 天台：楼顶的公共空间与烟花。
//
// 三条规则来自 docs/05-housing.md 第 7.4 节：
// - 只能在楼顶放，楼顶是整栋楼住户共用的；
// - 每人每天 3 次（一轮 7 发，约 30 秒）；
// - 老街区（雪松公寓）是安静区，不能放。
//
// 次数存 localStorage：这是一个 demo，没有理由为了三次点烟花加一张表和一条接口。
// 日期按本地日历切，跨天自动归零。

import { useApp } from '../store'
import { unitBuilding, floorsOf } from '../data/units'
import { buildingZone } from '../data/features'
import { launchQueue } from './fireworks'

const KEY = 'lumen-fireworks'

/** 每天几轮。 */
export const DAILY_LAUNCHES = 3
/** 一轮几发。 */
const PER_ROUND = 7

type Log = { day: string; used: number }

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function read(): Log {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const log = JSON.parse(raw) as Log
      // 换了一天就当没放过；跨月跨年也只看日期串是否相同
      if (log.day === today() && typeof log.used === 'number') return log
    }
  } catch {
    /* 隐私模式下读不到，这一次就按 0 算 */
  }
  return { day: today(), used: 0 }
}

function write(log: Log) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(log))
  } catch {
    /* 记不住也不影响这一发 */
  }
}

export function launchesLeft() {
  return Math.max(0, DAILY_LAUNCHES - read().used)
}

/** 这一栋楼的天台能不能放烟花。 */
export function roofAllowsFireworks(buildingId: string) {
  return buildingZone(buildingId) !== 'old-town'
}

/** 天台的标高（楼体顶面）。和 UnitShell 的屋面板一致。 */
export function roofHeight(buildingId: string) {
  const building = unitBuilding(buildingId)
  if (!building) return 0
  return floorsOf(building) * 3.3
}

/**
 * 在天台放一轮。坐标是楼顶局部坐标（原点在楼栋中心、y=0 是屋面），
 * 烟花只在室内的那一套 Canvas 里渲染，所以直接用局部坐标即可。
 */
export function launchFromRoof(buildingId: string, x = 0, y = 1.2, z = 0) {
  const app = useApp.getState()
  if (!app.user) {
    app.showToast('认领一间房之后，才能用楼顶的发射台')
    return false
  }
  if (!roofAllowsFireworks(buildingId)) {
    app.showToast('雪松公寓是老街区的安静区，楼顶不能放烟花')
    return false
  }
  const log = read()
  if (log.used >= DAILY_LAUNCHES) {
    app.showToast(`今天的 ${DAILY_LAUNCHES} 轮放完了，明天再来`)
    return false
  }
  const now = performance.now() / 1000
  for (let i = 0; i < PER_ROUND; i++) {
    launchQueue.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + 0.6,
      z: z + (Math.random() - 0.5) * 4,
      at: now + i * 0.45 + Math.random() * 0.2,
    })
  }
  write({ day: log.day, used: log.used + 1 })
  const left = DAILY_LAUNCHES - log.used - 1
  app.showToast(left > 0 ? `点火！今天还能放 ${left} 轮` : '点火！今天的份放完了')
  return true
}

/** 一轮放完大约多久：7 发 × 0.45 秒 + 一发升空 2 秒。 */
export const ROUND_SECONDS = PER_ROUND * 0.45 + 2.2
