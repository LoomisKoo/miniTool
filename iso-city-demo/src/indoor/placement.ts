import type { FurnitureItem, FurnitureType } from '../types'

/**
 * 禁区。weight 1 是硬约束（门口），小于 1 的是"尽量别放"——
 * 比如床不该紧挨着入户门，但房间太小时也只能妥协。
 */
export type ClearZone = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  cx: number
  cz: number
  weight?: number
  /** 只躲不放大的禁区（隔墙这种：贴着就行，不需要额外留空）。 */
  noSpread?: boolean
}
export type Box2 = { minX: number; maxX: number; minZ: number; maxZ: number }
export type Meta = { w: number; d: number; h: number; walk?: boolean }

const PAD = 0.05
/** 这几件是房间的功能家具，宁可挤一点也不能不摆。 */
const ESSENTIAL = new Set<FurnitureType>(['bed', 'desk', 'counter', 'pedestal', 'sofa'])
/** 这几件最怕贴着入户门：床/沙发一进门就顶上，屋子等于没法用。 */
const DOOR_SHY = new Set<FurnitureType>(['bed', 'sofa'])
/** 这几件本来就该靠墙摆（床头、沙发背、书架、书桌），别浮在房间中间。 */
const WALL_HUG = new Set<FurnitureType>(['bed', 'sofa', 'shelf', 'desk', 'counter', 'speaker'])

/** 家具在 rot 之后占的地面矩形（rot 只会是 0 / ±90° 附近）。 */
export function footprint(item: FurnitureItem, meta: Meta) {
  const swap = Math.abs(Math.sin(item.rot)) > 0.5
  return { w: swap ? meta.d : meta.w, d: swap ? meta.w : meta.d }
}

function rectOf(x: number, z: number, w: number, d: number): Box2 {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }
}

function overlapArea(a: Box2, b: Box2) {
  const ox = Math.min(a.maxX, b.maxX + PAD) - Math.max(a.minX, b.minX - PAD)
  const oz = Math.min(a.maxZ, b.maxZ + PAD) - Math.max(a.minZ, b.minZ - PAD)
  return ox > 0 && oz > 0 ? ox * oz : 0
}

/** 把一个禁区往外扩 d 米，并压成低权重（软约束）。 */
function spread(clear: ClearZone, d: number, weight: number): ClearZone {
  return {
    ...clear,
    minX: clear.minX - d,
    maxX: clear.maxX + d,
    minZ: clear.minZ - d,
    maxZ: clear.maxZ + d,
    weight,
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * 把一户的样板家具摆进真实户型里。
 *
 * 样板是按 12.6 × 9.8 画的，缩到真实房间后必然挤；再加上每户的入户门可以在任意
 * 一面墙上，原来的坐标很可能正好压在门口。这里对每件家具撒一组候选位置
 * （原位、镜像、沿墙滑动、转 90°），按"压门洞 > 压别的家具 > 挪动距离"排序，
 * 挑第一个不压门洞的；实在放不下的非功能家具直接不摆，而不是立在门口挡路。
 */
export function fitFurniture(
  items: FurnitureItem[],
  box: Box2,
  clears: ClearZone[],
  metaOf: (type: FurnitureType) => Meta | undefined,
  /** 某件家具只能摆在指定区域里（床只进卧室）。 */
  boxOf?: (item: FurnitureItem) => Box2 | null,
): FurnitureItem[] {
  const placed: Box2[] = []
  const result: Array<FurnitureItem | null> = new Array(items.length).fill(null)

  // 大件先摆：大件挑位置的余地小
  const order = items
    .map((item, index) => {
      const meta = metaOf(item.type)
      return { item, index, area: (meta?.w ?? 0) * (meta?.d ?? 0) }
    })
    .sort((a, b) => b.area - a.area)

  for (const { item, index } of order) {
    const meta = metaOf(item.type)
    if (!meta) {
      result[index] = item
      continue
    }
    // 地毯这种贴地的随便摆，不参与避让
    if (meta.h < 0.12) {
      result[index] = item
      continue
    }

    // 床这类要进指定房间的家具，候选范围换成那间房
    const areaBox = boxOf?.(item) ?? box
    const spanX = areaBox.maxX - areaBox.minX
    const spanZ = areaBox.maxZ - areaBox.minZ
    const cx = (areaBox.minX + areaBox.maxX) / 2
    const cz = (areaBox.minZ + areaBox.maxZ) / 2
    const rots = [item.rot, item.rot + Math.PI / 2, item.rot - Math.PI / 2]
    let best: { x: number; z: number; rot: number; score: number; cost: number } | null = null

    // 床、沙发额外躲开"门口那块"（比硬约束大一圈），房间放得下就别贴着门
    const zones = DOOR_SHY.has(item.type)
      ? [
          ...clears,
          ...clears
            .filter((clear) => (clear.weight ?? 1) >= 1 && !clear.noSpread)
            .map((clear) => spread(clear, 0.9, 0.4)),
        ]
      : clears

    for (const rot of rots) {
      const { w, d } = footprint({ ...item, rot }, meta)
      if (w > spanX + 0.01 || d > spanZ + 0.01) continue
      const loX = areaBox.minX + w / 2
      const hiX = areaBox.maxX - w / 2
      const loZ = areaBox.minZ + d / 2
      const hiZ = areaBox.maxZ - d / 2
      const xs = new Set<number>([
        clamp(item.x, loX, hiX),
        clamp(2 * cx - item.x, loX, hiX),
        loX,
        hiX,
        cx,
      ])
      const zs = new Set<number>([
        clamp(item.z, loZ, hiZ),
        clamp(2 * cz - item.z, loZ, hiZ),
        loZ,
        hiZ,
        cz,
      ])
      // 沿两个方向各撒几档，小房间里靠"挪到另一头"才躲得开门口
      for (let i = 0; i <= 6; i++) {
        xs.add(loX + ((hiX - loX) * i) / 6)
        zs.add(loZ + ((hiZ - loZ) * i) / 6)
      }

      for (const x of xs) {
        for (const z of zs) {
          const rect = rectOf(x, z, w, d)
          let blocked = 0
          for (const clear of zones) blocked += overlapArea(rect, clear) * (clear.weight ?? 1)
          let crowded = 0
          for (const other of placed) crowded += overlapArea(rect, other)
          // 压门洞是硬约束（权重远超家具之间的小重叠）
          const score = blocked * 1000 + crowded
          let cost = Math.abs(x - item.x) + Math.abs(z - item.z) + (rot === item.rot ? 0 : 1.2)
          if (WALL_HUG.has(item.type)) {
            // 离最近的墙有多远：越贴墙越好
            const gap = Math.min(
              x - w / 2 - areaBox.minX,
              areaBox.maxX - (x + w / 2),
              z - d / 2 - areaBox.minZ,
              areaBox.maxZ - (z + d / 2),
            )
            cost += Math.max(0, gap) * 2.2
          }
          if (!best || score < best.score - 1e-4 || (Math.abs(score - best.score) <= 1e-4 && cost < best.cost)) {
            best = { x, z, rot, score, cost }
          }
        }
      }
    }

    if (!best) {
      // 房间比这件家具还小：功能家具留在原地，其它不摆
      result[index] = ESSENTIAL.has(item.type) ? item : null
      continue
    }
    const blockedHard = best.score >= 1000
    if (blockedHard && !ESSENTIAL.has(item.type)) {
      result[index] = null
      continue
    }
    const chosen: FurnitureItem = {
      ...item,
      x: Number(best.x.toFixed(2)),
      z: Number(best.z.toFixed(2)),
      rot: Number(best.rot.toFixed(4)),
    }
    result[index] = chosen
    if (meta.walk) {
      const { w, d } = footprint(chosen, meta)
      placed.push(rectOf(chosen.x, chosen.z, w, d))
    }
  }

  return result.filter((item): item is FurnitureItem => Boolean(item))
}
