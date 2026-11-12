import { useMemo } from 'react'
import type { Rect, Side, UnitInfo } from '../data/units'
import {
  doorOpening,
  freeWallRuns,
  inwardYaw,
  localAlong,
  roomBounds,
  roomBox,
  roomColliders,
  sideLength,
  toLocalOpening,
  wallPoint,
  yawToward,
  type LocalOpening,
  type RoomBox,
} from './RoomKit'

const INWARD: Record<Side, [number, number]> = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }

export type UnitRoomPlan = {
  box: RoomBox
  openings: LocalOpening[]
  bal: UnitInfo['unit']['balcony']
  bounds: ReturnType<typeof roomBounds>
  colliders: ReturnType<typeof roomColliders>
  door: { side: Side; l: number; x: number; z: number }
  start: [number, number]
  startYaw: number
  guest: [number, number]
  console: [number, number]
  /** 门口和阳台门前要留空的区域（房间局部坐标），家具不能摆进来。 */
  clears: Array<{
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    cx: number
    cz: number
    noSpread?: boolean
    /** door / balcony 是要走人的门洞，object 是固定家具，wall 是隔墙。 */
    kind?: 'door' | 'balcony' | 'object' | 'wall'
  }>
  /** 户内隔墙（房间局部坐标）：既是实体墙也是家具禁区。 */
  partitions: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>
  /** 门洞上方的过梁（只画，不参与碰撞）。 */
  headers: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>
  /** 卧室范围：床只能摆在这里。 */
  bedroom: { minX: number; maxX: number; minZ: number; maxZ: number } | null
  art: { position: [number, number, number]; rotation: [number, number, number] } | null
}

/**
 * 户内布局全部从楼层平面里这一户的矩形推出来：
 * 墙上的洞就是立面上那几个洞，入户门就是走廊/电梯厅那扇门。
 */
export function useUnitRoomPlan(unit: UnitInfo | null): UnitRoomPlan | null {
  return useMemo(() => {
    if (!unit) return null
    const box = roomBox(unit.unit.rect, unit.room.height)
    const d = unit.unit.door
    const openings = [...unit.unit.openings.map((o) => toLocalOpening(box, o)), doorOpening(box, d.side, d.at)]
    const bal = unit.balcony ? unit.unit.balcony : null
    const doorL = localAlong(box, d.side, d.at)
    const [dx, dz] = wallPoint(box, d.side, doorL, 0.6)
    const [sx, sz] = wallPoint(box, d.side, doorL, 1.7)
    const inward = INWARD[d.side]

    // 留言台 / 控制台：沿墙找空位，避开门口、阳台门和彼此
    const blocked: Array<[number, number]> = [[dx, dz]]
    for (const o of openings) {
      if (o.kind !== 'balcony') continue
      blocked.push(wallPoint(box, o.side, (o.l0 + o.l1) / 2, 0.6))
    }
    const order: Side[] = [d.side, ...(['n', 's', 'e', 'w'] as Side[]).filter((s) => s !== d.side)]
    const spots: Array<[number, number]> = []
    for (const side of order) {
      const len = sideLength(box, side)
      for (const l of [len / 2 - 0.9, -len / 2 + 0.9, len / 4, -len / 4]) {
        const p = wallPoint(box, side, l, 0.7)
        const onBalconyDoor = openings.some(
          (o) => o.side === side && o.kind === 'balcony' && l > o.l0 - 0.6 && l < o.l1 + 0.6,
        )
        if (onBalconyDoor) continue
        if ([...blocked, ...spots].some(([x, z]) => Math.hypot(p[0] - x, p[1] - z) < 1.8)) continue
        spots.push(p)
        if (spots.length === 2) break
      }
      if (spots.length === 2) break
    }
    while (spots.length < 2) spots.push([sx + inward[1] * (spots.length ? -1 : 1), sz + inward[0] * (spots.length ? -1 : 1)])

    // 门口净空：门内 2m 深，家具一律绕开，不然一进来就被床或柜子顶住。
    // kind 让摆家具那边能区分"门口/阳台门前的通路"和"已经摆好的固定家具"。
    // 这里的 cx/cz 取净空区的中心（门内 1m）：可达性检查就是从这一点开始往外走的。
    const clears: UnitRoomPlan['clears'] = []
    const pushClear = (side: Side, lc: number, halfW: number, depthIn: number, kind: 'door' | 'balcony') => {
      const [px, pz] = wallPoint(box, side, lc, 0)
      const inward = INWARD[side]
      const ax = Math.abs(inward[0])
      const cx = px + inward[0] * (depthIn / 2)
      const cz = pz + inward[1] * (depthIn / 2)
      clears.push({
        minX: Math.min(px, cx) - (ax ? 0 : halfW),
        maxX: Math.max(px, cx) + (ax ? 0 : halfW),
        minZ: Math.min(pz, cz) - (ax ? halfW : 0),
        maxZ: Math.max(pz, cz) + (ax ? halfW : 0),
        cx,
        cz,
        kind,
      })
    }
    // 门口净空：门内 2m 深、比门宽两边各多 0.55m。
    // 以前这里是 3m × 2.4m，在一个 3.5m 进深的小户里等于半个房间，
    // 结果床怎么摆都算"压门口"，最后干脆被放在门口把路堵死。
    // 真正要保住的只是"进门能站人、能转身"这一块。
    pushClear(d.side, doorL, 1.0, 2.0, 'door')
    for (const o of openings) {
      if (o.kind !== 'balcony') continue
      pushClear(o.side, (o.l0 + o.l1) / 2, Math.min(1.6, Math.max(0.9, (o.l1 - o.l0) / 2)), 1.6, 'balcony')
    }

    // 户内隔墙（楼栋坐标 → 房间局部坐标）
    const localRect = (r: Rect) => ({
      minX: r.x0 - box.cx,
      maxX: r.x1 - box.cx,
      minZ: r.z0 - box.cz,
      maxZ: r.z1 - box.cz,
    })
    const interior = unit.unit.interior
    const partitions = (interior?.walls ?? []).map(localRect)
    const headers = (interior?.headers ?? []).map(localRect)
    const bedroom = interior?.bedroom ? localRect(interior.bedroom) : null
    // 隔墙是硬禁区，但不要额外放大（贴着墙摆是正常的）
    for (const w of partitions) {
      clears.push({ ...w, cx: (w.minX + w.maxX) / 2, cz: (w.minZ + w.maxZ) / 2, noSpread: true, kind: 'wall' })
    }
    // 户内房门（卧室/卫生间）的门口也要留空：过梁的横向长度就是门洞宽度，
    // 沿垂直方向各放开 0.45m，家具就不会正好堵在门框里。
    for (const h of headers) {
      const horiz = h.maxX - h.minX > h.maxZ - h.minZ
      const pad = 0.45
      const zx = horiz ? 0 : pad
      const zz = horiz ? pad : 0
      clears.push({
        minX: h.minX - zx,
        maxX: h.maxX + zx,
        minZ: h.minZ - zz,
        maxZ: h.maxZ + zz,
        cx: (h.minX + h.maxX) / 2,
        cz: (h.minZ + h.maxZ) / 2,
        kind: 'door',
      })
    }
    // 留言台和控制台是固定家具：算进禁区，否则床/沙发会直接压在上面
    for (const [ox, oz] of spots) {
      clears.push({
        minX: ox - 0.55,
        maxX: ox + 0.55,
        minZ: oz - 0.55,
        maxZ: oz + 0.55,
        cx: ox,
        cz: oz,
        kind: 'object',
      })
    }
    // 留言台/控制台不能贴到隔墙上
    const onWall = (x: number, z: number) =>
      partitions.some((w) => x > w.minX - 0.45 && x < w.maxX + 0.45 && z > w.minZ - 0.45 && z < w.maxZ + 0.45)

    // 挂画：挑一段最长的空墙。洞口和贴着墙的隔墙都要避开，
    // 否则画会横跨隔墙，一半在这间、一半在卧室里。
    const runs = freeWallRuns(box, openings, partitions)
    let art: UnitRoomPlan['art'] = null
    const run = runs[0]
    if (run) {
      const [x, z] = wallPoint(box, run.side, run.center, 0.04)
      art = { position: [x, Math.min(1.75, box.H - 0.9), z], rotation: [0, inwardYaw(run.side), 0] }
    }

    return {
      box,
      openings,
      bal,
      bounds: roomBounds(box, bal),
      colliders: roomColliders(box, openings, bal),
      door: { side: d.side, l: doorL, x: dx, z: dz },
      start: [sx, sz],
      startYaw: yawToward(inward[0], inward[1]),
      guest: onWall(spots[0][0], spots[0][1]) ? spots[1] : spots[0],
      console: onWall(spots[1][0], spots[1][1]) ? spots[0] : spots[1],
      clears,
      partitions,
      headers,
      bedroom,
      art,
    }
  }, [unit])
}
