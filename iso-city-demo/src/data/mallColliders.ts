// 商场的碰撞盒。
//
// 纯数学，不碰 react / three：这样 node 里可以直接跑一遍，验证"人真的能
// 顺着扶梯走上楼"，不用开浏览器。

import {
  ESC_RISE,
  ESC_TREAD,
  MALL,
  MALL_ESCALATORS,
  MALL_KIOSKS,
  MALL_LEVELS,
  MALL_PLANTERS,
  MALL_SHOPS,
  MALL_TOP,
  SHOP_ROOM_DEPTH,
  escalatorGeo,
  escalatorSpan,
  railRuns,
  stepTop,
} from './mall'
import type { Collider } from '../scene/PlayerRig'

/**
 * 商场的碰撞，四类：
 *   楼板   stand 薄板，玩家站在每层地面上；
 *   店面   每层一圈，门洞处断开；
 *   栏杆   中庭四边，扶梯进出口断开；
 *   扶梯   每级台阶一块 stand 板（上楼靠的就是这些）。
 *
 * 坐标都按局部算，最后统一加到商场中心。
 */
export function mallColliders(): Collider[] {
  const out: Collider[] = []

  // 楼板：左右两条长板 + 前后两个圆头
  for (const lv of MALL_LEVELS) {
    if (lv.i === 0) continue
    const y = lv.y0
    // 中庭洞是 |x|<slotX 且 |z|<slotZ：两条长板铺到 slotZ，两头圆头从 slotZ 起
    out.push({ minX: MALL.slotX, maxX: MALL.r, minZ: -MALL.slotZ, maxZ: MALL.slotZ, minY: y - 0.6, maxY: y, stand: true })
    out.push({ minX: -MALL.r, maxX: -MALL.slotX, minZ: -MALL.slotZ, maxZ: MALL.slotZ, minY: y - 0.6, maxY: y, stand: true })
    out.push({ minX: -MALL.r, maxX: MALL.r, minZ: MALL.slotZ, maxZ: MALL.hx + MALL.r, minY: y - 0.6, maxY: y, stand: true })
    out.push({
      minX: -MALL.r,
      maxX: MALL.r,
      minZ: -MALL.hx - MALL.r,
      maxZ: -MALL.slotZ,
      minY: y - 0.6,
      maxY: y,
      stand: true,
    })
  }

  for (const lv of MALL_LEVELS) {
    // 店面：每家一块，从店面前沿一直占回外墙
    for (const s of MALL_SHOPS[lv.i]) {
      const halfW = s.w / 2 + 0.3
      const tx = Math.cos(s.yaw)
      const tz = -Math.sin(s.yaw)
      const nx = Math.sin(s.yaw)
      const nz = Math.cos(s.yaw)
      const xs: number[] = []
      const zs: number[] = []
      for (const [a, d] of [
        [1, 0],
        [-1, 0],
        [1, SHOP_ROOM_DEPTH + 0.4],
        [-1, SHOP_ROOM_DEPTH + 0.4],
      ]) {
        xs.push(s.x + tx * halfW * a - nx * d)
        zs.push(s.z + tz * halfW * a - nz * d)
      }
      out.push({
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs),
        minY: lv.y0,
        maxY: lv.y0 + lv.h,
      })
    }

    // 中庭栏杆
    for (const run of railRuns(lv.i)) {
      const lo = Math.min(run.from, run.to)
      const hi = Math.max(run.from, run.to)
      out.push({
        minX: run.axis === 'z' ? run.at - 0.1 : lo,
        maxX: run.axis === 'z' ? run.at + 0.1 : hi,
        minZ: run.axis === 'z' ? lo : run.at - 0.1,
        maxZ: run.axis === 'z' ? hi : run.at + 0.1,
        minY: lv.y0,
        maxY: lv.y0 + 1.1,
      })
    }
  }

  // 扶梯：台阶 + 两块侧板 + 上下平台
  for (const spec of MALL_ESCALATORS) {
    const geo = escalatorGeo(spec)
    const [za, zb] = escalatorSpan(geo)
    for (let k = 0; k < geo.steps; k++) {
      const top = stepTop(geo, k)
      out.push({
        minX: geo.x - 0.8,
        maxX: geo.x + 0.8,
        minZ: geo.zAt(k) - ESC_TREAD / 2,
        maxZ: geo.zAt(k) + ESC_TREAD / 2,
        minY: top - ESC_RISE,
        maxY: top,
        stand: true,
      })
    }
    for (const s of [-1, 1]) {
      out.push({
        minX: geo.x + s * 0.88 - 0.06,
        maxX: geo.x + s * 0.88 + 0.06,
        minZ: za,
        maxZ: zb,
        minY: geo.y0,
        maxY: geo.y1,
      })
    }
    // 平台靠中庭的那一侧 + 远离台阶的一侧要围住，否则人从平台侧面一步就掉进中庭
    for (const [z, yl, far, isBottom] of [
      [geo.zBottom, geo.y0, -geo.dir, true],
      [geo.zTop, geo.y1, geo.dir, false],
    ] as Array<[number, number, number, boolean]>) {
      // 中庭一侧（背离楼板）
      out.push({
        minX: geo.x - spec.side * 0.98 - 0.08,
        maxX: geo.x - spec.side * 0.98 + 0.08,
        minZ: z - 1.3,
        maxZ: z + 1.3,
        minY: yl,
        maxY: yl + 1.1,
      })
      // 平台尽端：一层的下平台留空——那是从大厅走上扶梯的入口
      if (!(isBottom && geo.level === 0)) {
        out.push({
          minX: geo.x - 1.0,
          maxX: geo.x + 1.0,
          minZ: z + far * 1.24 - 0.08,
          maxZ: z + far * 1.24 + 0.08,
          minY: yl,
          maxY: yl + 1.1,
        })
      }
    }

    // 平台：有意压过楼板边缘 0.4m——碰撞面之间不能留缝，否则人会从缝里掉下去
    const lx = [-1.45, 1.45].map((d) => geo.x + d)
    out.push({
      minX: Math.min(...lx),
      maxX: Math.max(...lx),
      minZ: geo.zBottom - 1.3,
      maxZ: geo.zBottom + 1.3,
      minY: geo.y0 - 0.35,
      maxY: geo.y0,
      stand: true,
    })
    out.push({
      minX: Math.min(...lx),
      maxX: Math.max(...lx),
      minZ: geo.zTop - 1.3,
      maxZ: geo.zTop + 1.3,
      minY: geo.y1 - 0.35,
      maxY: geo.y1,
      stand: true,
    })
  }

  // 中庭四角的柱子
  for (const [x, z] of [
    [-7.9, -13.9],
    [7.9, -13.9],
    [-7.9, 13.9],
    [7.9, 13.9],
  ]) {
    out.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, minY: 0, maxY: MALL_TOP })
  }

  // 花箱
  for (const p of MALL_PLANTERS) {
    out.push({
      minX: p.x - 0.62,
      maxX: p.x + 0.62,
      minZ: p.z - 0.62,
      maxZ: p.z + 0.62,
      minY: MALL_LEVELS[p.level].y0,
      maxY: MALL_LEVELS[p.level].y0 + 1.2,
    })
  }

  // 摊车 + 楼层指示牌
  for (const k of MALL_KIOSKS) {
    out.push({ minX: k.x - 1.25, maxX: k.x + 1.25, minZ: k.z - 0.85, maxZ: k.z + 0.85, minY: 0, maxY: 1.3 })
  }
  for (const z of [7.5, -7.5]) {
    out.push({ minX: -16.75, maxX: -16.25, minZ: z - 0.9, maxZ: z + 0.9, minY: 0, maxY: 3.6 })
  }

  return out.map((c) => ({
    ...c,
    minX: c.minX + MALL.cx,
    maxX: c.maxX + MALL.cx,
    minZ: c.minZ + MALL.cz,
    maxZ: c.maxZ + MALL.cz,
  }))
}
