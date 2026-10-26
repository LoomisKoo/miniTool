import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BALCONY_OUT,
  FLOOR_HEIGHT,
  WALL,
  floorsOf,
  layoutOf,
  type Side,
  type UnitBuilding,
} from '../data/units'
import { bodyColor, type Palette } from './theme'

/**
 * 住宅 / 酒店的外壳：每一扇窗、每一个阳台、首层的每一跨橱窗都来自楼层平面
 * （shared/units.mjs 的 floorLayout）。
 *
 * 街上的楼体和室内看出去的本栋楼用的是同一个组件——
 * 室内只是多传一个 cut：把"自己这一户 / 这个厅"的玻璃和阳台留给室内去画，
 * 墙体洞口位置不变，所以里外永远是同一栋楼。
 */
export type ShellCut = { floor: number; owner: string }

type Parts = Record<'wall' | 'glass' | 'lit' | 'store' | 'frame' | 'slab' | 'rail' | 'roof', THREE.BufferGeometry[]>

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

/**
 * 在某一面外墙上放一个盒子。
 * a：沿墙区间；y：高度区间；d：从外墙外皮往楼里量的深度区间（负数 = 挑出墙外）。
 */
function wallBox(
  list: THREE.BufferGeometry[],
  b: UnitBuilding,
  side: Side,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  d0: number,
  d1: number,
) {
  if (a1 - a0 < 0.005 || y1 - y0 < 0.005 || d1 - d0 < 0.005) return
  const hw = b.w / 2
  const hd = b.d / 2
  let x0: number, x1: number, z0: number, z1: number
  if (side === 'n') {
    x0 = a0
    x1 = a1
    z0 = -hd + d0
    z1 = -hd + d1
  } else if (side === 's') {
    x0 = a0
    x1 = a1
    z0 = hd - d1
    z1 = hd - d0
  } else if (side === 'w') {
    z0 = a0
    z1 = a1
    x0 = -hw + d0
    x1 = -hw + d1
  } else {
    z0 = a0
    z1 = a1
    x0 = hw - d1
    x1 = hw - d0
  }
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  list.push(g)
}

/** 一面外墙的沿墙全跨：n/s 墙包住转角，e/w 墙让开转角，避免两面墙在角上重叠闪烁。 */
function fullSpan(b: UnitBuilding, side: Side): [number, number] {
  return side === 'n' || side === 's' ? [-b.w / 2, b.w / 2] : [-b.d / 2 + WALL, b.d / 2 - WALL]
}

export function buildShell(b: UnitBuilding, cut: ShellCut | null): Record<keyof Parts, THREE.BufferGeometry | null> {
  const parts: Parts = { wall: [], glass: [], lit: [], store: [], frame: [], slab: [], rail: [], roof: [] }
  const H = FLOOR_HEIGHT
  const floors = floorsOf(b)
  const sides: Side[] = ['n', 's', 'e', 'w']

  for (let f = 1; f <= floors; f++) {
    const base = (f - 1) * H
    const layout = layoutOf(b, f)
    for (const side of sides) {
      const [s0, s1] = fullSpan(b, side)
      const ops = layout.facade.filter((o) => o.side === side).sort((p, q) => p.a0 - q.a0)
      let cursor = s0
      for (const op of ops) {
        if (op.a0 > cursor) wallBox(parts.wall, b, side, cursor, op.a0, base, base + H, 0, WALL)
        wallBox(parts.wall, b, side, op.a0, op.a1, base, base + op.y0, 0, WALL)
        wallBox(parts.wall, b, side, op.a0, op.a1, base + op.y1, base + H, 0, WALL)
        cursor = Math.max(cursor, op.a1)

        if (cut && cut.floor === f && cut.owner === op.owner) continue
        const y0 = base + op.y0
        const y1 = base + op.y1
        const target =
          op.kind === 'store' || op.kind === 'entry'
            ? parts.store
            : hash(`${b.id}-${f}-${side}-${op.a0.toFixed(1)}`) < 0.38
              ? parts.lit
              : parts.glass
        wallBox(target, b, side, op.a0, op.a1, y0, y1, 0.16, 0.2)
        // 窗框：四边 + 中梃
        const t = 0.07
        wallBox(parts.frame, b, side, op.a0, op.a0 + t, y0, y1, 0.1, 0.18)
        wallBox(parts.frame, b, side, op.a1 - t, op.a1, y0, y1, 0.1, 0.18)
        wallBox(parts.frame, b, side, op.a0, op.a1, y1 - t, y1, 0.1, 0.18)
        wallBox(parts.frame, b, side, op.a0, op.a1, y0, y0 + t, 0.1, 0.18)
        const width = op.a1 - op.a0
        const mullions = op.kind === 'store' || op.kind === 'entry' ? Math.max(1, Math.round(width / 2.2)) : width > 1.6 ? 2 : 1
        for (let i = 1; i < mullions; i++) {
          const a = op.a0 + (width * i) / mullions
          wallBox(parts.frame, b, side, a - 0.03, a + 0.03, y0, y1, 0.12, 0.18)
        }
        // 窗台板：外凸一点，掠射光下能读出窗洞的深度
        if (op.kind === 'window' || op.kind === 'stair') {
          wallBox(parts.frame, b, side, op.a0 - 0.08, op.a1 + 0.08, y0 - 0.06, y0, -0.06, 0.12)
        }
      }
      if (cursor < s1) wallBox(parts.wall, b, side, cursor, s1, base, base + H, 0, WALL)

      // 层间线脚：外凸 6cm，不盖住上一层的落地门
      if (f < floors) wallBox(parts.frame, b, side, s0, s1, base + H - 0.16, base + H + 0.02, -0.06, 0.02)
    }

    // 阳台：挑板 + 玻璃栏板 + 扶手
    for (const unit of layout.units) {
      const bal = unit.balcony
      if (!bal) continue
      if (cut && cut.floor === f && cut.owner === bal.owner) continue
      wallBox(parts.slab, b, bal.side, bal.a0, bal.a1, base - 0.2, base - 0.02, -BALCONY_OUT, 0)
      wallBox(parts.rail, b, bal.side, bal.a0, bal.a1, base - 0.02, base + 1.02, -BALCONY_OUT + 0.02, -BALCONY_OUT + 0.06)
      wallBox(parts.frame, b, bal.side, bal.a0, bal.a1, base + 1.0, base + 1.08, -BALCONY_OUT, -BALCONY_OUT + 0.08)
      for (const a of [bal.a0, bal.a1 - 0.05]) {
        wallBox(parts.rail, b, bal.side, a, a + 0.05, base - 0.02, base + 1.02, -BALCONY_OUT, -0.02)
      }
    }

    // 首层入口雨棚
    if (f === 1) {
      for (const hall of layout.halls) {
        if (!hall.exit) continue
        wallBox(parts.frame, b, hall.exit.side, hall.exit.a0 - 0.8, hall.exit.a1 + 0.8, 3.02, 3.18, -2.0, 0)
      }
    }
  }

  // 屋顶 + 女儿墙
  const top = floors * H
  const roof = new THREE.BoxGeometry(b.w, 0.3, b.d)
  roof.translate(0, top + 0.15, 0)
  parts.roof.push(roof)
  for (const side of sides) {
    const [s0, s1] = fullSpan(b, side)
    wallBox(parts.wall, b, side, s0, s1, top, top + 1.1, 0, 0.25)
  }

  const out = {} as Record<keyof Parts, THREE.BufferGeometry | null>
  for (const key of Object.keys(parts) as Array<keyof Parts>) {
    const list = parts[key]
    out[key] = list.length ? mergeGeometries(list, false) : null
    for (const g of list) g.dispose()
  }
  return out
}

export function UnitShell({
  building,
  body,
  palette,
  cut = null,
  shadows = true,
}: {
  building: UnitBuilding
  body: string
  palette: Palette
  cut?: ShellCut | null
  shadows?: boolean
}) {
  const night = palette.key === 'night'
  const geo = useMemo(() => buildShell(building, cut), [building, cut?.floor, cut?.owner])
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g?.dispose()
    },
    [geo],
  )

  const mats = useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({ color: bodyColor(body, palette), roughness: 0.86, metalness: 0.04 })
    const glass = new THREE.MeshStandardMaterial({
      color: night ? '#0f1a24' : '#41545e',
      roughness: 0.08,
      metalness: 0.7,
      envMapIntensity: 1.3,
    })
    const lit = new THREE.MeshStandardMaterial({
      color: night ? '#2a2016' : '#56656c',
      roughness: 0.2,
      metalness: 0.3,
      emissive: night ? '#ffc98a' : '#000000',
      emissiveIntensity: night ? 0.9 : 0,
    })
    const store = new THREE.MeshStandardMaterial({
      color: night ? '#2c2118' : '#6d7b80',
      roughness: 0.12,
      metalness: 0.45,
      emissive: night ? '#ffd2a0' : '#3a3028',
      emissiveIntensity: night ? 0.75 : 0.25,
    })
    const frame = new THREE.MeshStandardMaterial({
      color: night ? '#2a333b' : '#4e5459',
      roughness: 0.45,
      metalness: 0.55,
    })
    const slab = new THREE.MeshStandardMaterial({ color: night ? '#3d4650' : '#c9c6bd', roughness: 0.85, metalness: 0.04 })
    const rail = new THREE.MeshStandardMaterial({
      color: night ? '#5a7a88' : '#a9c3cb',
      roughness: 0.1,
      metalness: 0.4,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
    const roof = new THREE.MeshStandardMaterial({
      // 原来的 #2a3038 在线性空间里接近黑，从高处看这些楼的屋顶就是一块黑板
      color: night ? '#5b6871' : '#6c7073',
      roughness: 0.95,
      emissive: new THREE.Color(night ? '#2b3339' : '#000000'),
      emissiveIntensity: night ? 0.6 : 0,
    })
    return { wall, glass, lit, store, frame, slab, rail, roof }
  }, [body, palette, night])
  useEffect(
    () => () => {
      for (const m of Object.values(mats)) m.dispose()
    },
    [mats],
  )

  return (
    <group>
      {(Object.keys(geo) as Array<keyof typeof geo>).map((key) =>
        geo[key] ? (
          <mesh
            key={key}
            geometry={geo[key]!}
            material={mats[key]}
            castShadow={shadows && (key === 'wall' || key === 'slab' || key === 'roof')}
            receiveShadow={shadows && key !== 'rail'}
          />
        ) : null,
      )}
    </group>
  )
}
