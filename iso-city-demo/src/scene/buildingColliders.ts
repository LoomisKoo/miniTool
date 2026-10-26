import type { BuildingDef } from '../data/city'
import { BALCONY_OUT, FLOOR_HEIGHT, floorsOf, isUnitBuilding, shellHeightOf, layoutOf, unitBuilding, type Side, type UnitBuilding } from '../data/units'
import type { Collider } from './PlayerRig'

/**
 * 楼的碰撞体与渲染体量保持一致。
 *
 * 以前每栋楼只有一个"占地 × 全高"的盒子：裙房顶、退台、阳台这些伸出来的平台
 * 看着能站，落上去却被整栋楼的盒子挡在外面，或者直接穿过去。
 * 这里按体量拆开：裙房一块、塔楼一块、高层退台上下各一块、每个阳台一块薄板，
 * 平台类的都标 stand，人可以落在上面。
 */

/** 裙房高度，与 Building.tsx 的 PlainBuilding 一致。 */
const PODIUM = 5.6

function box(cx: number, cz: number, w: number, d: number, minY: number, maxY: number, extra: Partial<Collider> = {}): Collider {
  return {
    minX: cx - w / 2 - 0.16,
    maxX: cx + w / 2 + 0.16,
    minZ: cz - d / 2 - 0.16,
    maxZ: cz + d / 2 + 0.16,
    minY,
    maxY,
    ...extra,
  }
}

/** 阳台挑板在楼的局部坐标里的矩形（同 UnitShell.wallBox 的换算）。 */
function balconyRect(b: UnitBuilding, side: Side, a0: number, a1: number) {
  const hw = b.w / 2
  const hd = b.d / 2
  const d0 = -BALCONY_OUT
  const d1 = 0
  if (side === 'n') return { x0: a0, x1: a1, z0: -hd + d0, z1: -hd + d1 }
  if (side === 's') return { x0: a0, x1: a1, z0: hd - d1, z1: hd - d0 }
  if (side === 'w') return { x0: -hw + d0, x1: -hw + d1, z0: a0, z1: a1 }
  return { x0: hw - d1, x1: hw - d0, z0: a0, z1: a1 }
}

export function collidersOfBuilding(def: BuildingDef): Collider[] {
  const out: Collider[] = []

  if (isUnitBuilding(def.id)) {
    const b = unitBuilding(def.id) as UnitBuilding
    // 楼顶高度按楼壳算（层数 × 层高），def.h 只是规划时的估计值；
    // 用 def.h 会让人站在楼顶上方的空气里。
    out.push(box(def.x, def.z, def.w, def.d, 0, shellHeightOf(b) + 0.3))
    const floors = floorsOf(b)
    for (let f = 2; f <= floors; f++) {
      const top = (f - 1) * FLOOR_HEIGHT - 0.02
      for (const unit of layoutOf(b, f).units) {
        const bal = unit.balcony
        if (!bal) continue
        const r = balconyRect(b, bal.side, bal.a0, bal.a1)
        out.push({
          minX: def.x + r.x0,
          maxX: def.x + r.x1,
          minZ: def.z + r.z0,
          maxZ: def.z + r.z1,
          minY: top - 0.2,
          maxY: top,
          stand: true,
          camera: false,
        })
      }
    }
    return out
  }

  if (def.background) {
    // 程序化街区：高楼在 76% 处退台一次，下段的屋顶是一圈能站的平台
    if (def.setback && def.h > 44) {
      const cut = def.h * 0.76
      out.push(box(def.x, def.z, def.w, def.d, 0, cut, { stand: true }))
      out.push(box(def.x, def.z, def.w * 0.8, def.d * 0.8, cut, def.h + 1))
    } else {
      out.push(box(def.x, def.z, def.w, def.d, 0, def.h + 1))
    }
    return out
  }

  // 手写地标：裙房 + 塔楼
  if (def.setback) {
    out.push(box(def.x, def.z, def.w, def.d, 0, PODIUM, { stand: true }))
    out.push(box(def.x, def.z, def.w * 0.86, def.d * 0.86, PODIUM, def.h + 1))
  } else {
    out.push(box(def.x, def.z, def.w, def.d, 0, def.h + 1))
  }

  // 阳台：Building.tsx 的 Balconies，南立面每层三块挑板
  if (def.balconies) {
    const bodyW = def.setback ? def.w * 0.86 : def.w
    const bodyD = def.setback ? def.d * 0.86 : def.d
    const count = Math.max(2, Math.min(6, Math.floor(def.h / 9)))
    const slabW = Math.min(2.8, bodyW * 0.24)
    for (let i = 0; i < count; i++) {
      const y = 8 + i * 5.4
      for (const t of [-0.3, 0.02, 0.32]) {
        out.push({
          minX: def.x + t * bodyW - slabW / 2,
          maxX: def.x + t * bodyW + slabW / 2,
          minZ: def.z + bodyD / 2 - 0.03,
          maxZ: def.z + bodyD / 2 + 1.27,
          minY: y - 0.08,
          maxY: y + 0.08,
          stand: true,
          camera: false,
        })
      }
    }
  }
  return out
}
