import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BALCONY_OUT, DOOR, WALL, type BalconySpan, type Opening, type Rect, type Side } from '../data/units'
import type { Collider } from '../scene/PlayerRig'
import { makeFloorTexture, makeWallTexture } from '../scene/textures'

/**
 * 室内的"墙 + 洞口"工具。户内和电梯厅都用它：
 * 房间就是楼层平面里的那个矩形，洞口就是立面上的那几个洞，
 * 只是从里面看。坐标原点放在矩形中心，轴向与城市一致（不旋转）。
 */

/** 墙面比矩形边界往里收 2cm：外墙的内皮正好在矩形边上，贴在一起会闪。 */
const IN = 0.02
/** 户内门洞上沿：2.15m 以上补过梁。 */
const DOOR_HEAD = 2.15

export type LocalOpening = {
  side: Side
  l0: number
  l1: number
  y0: number
  y1: number
  kind: Opening['kind'] | 'door' | 'elevator'
}

export type RoomBox = { W: number; D: number; H: number; cx: number; cz: number }

export function roomBox(r: Rect, H: number): RoomBox {
  return { W: r.x1 - r.x0, D: r.z1 - r.z0, H, cx: (r.x0 + r.x1) / 2, cz: (r.z0 + r.z1) / 2 }
}

/** 楼栋沿墙坐标 → 房间局部沿墙坐标。 */
export function localAlong(box: RoomBox, side: Side, a: number) {
  return side === 'n' || side === 's' ? a - box.cx : a - box.cz
}

export function toLocalOpening(box: RoomBox, o: Pick<Opening, 'side' | 'a0' | 'a1' | 'y0' | 'y1' | 'kind'>): LocalOpening {
  const l0 = localAlong(box, o.side, o.a0)
  const l1 = localAlong(box, o.side, o.a1)
  const half = sideLength(box, o.side) / 2
  return { side: o.side, l0: Math.max(-half, l0), l1: Math.min(half, l1), y0: o.y0, y1: o.y1, kind: o.kind }
}

export function doorOpening(box: RoomBox, side: Side, at: number, kind: 'door' | 'elevator' = 'door'): LocalOpening {
  const l = localAlong(box, side, at)
  const w = kind === 'elevator' ? 1.3 : DOOR.width
  return { side, l0: l - w / 2, l1: l + w / 2, y0: 0, y1: kind === 'elevator' ? 2.3 : DOOR.height, kind }
}

export function sideLength(box: RoomBox, side: Side) {
  return side === 'n' || side === 's' ? box.W : box.D
}

/** 墙上一点（沿墙 l、离墙面往室内 inward）对应的局部坐标。 */
export function wallPoint(box: RoomBox, side: Side, l: number, inward = 0): [number, number] {
  switch (side) {
    case 'n':
      return [l, -box.D / 2 + inward]
    case 's':
      return [l, box.D / 2 - inward]
    case 'w':
      return [-box.W / 2 + inward, l]
    default:
      return [box.W / 2 - inward, l]
  }
}

/** 朝室内的方向，用来给门板、标牌、出生朝向定向。 */
export function inwardYaw(side: Side) {
  return side === 'n' ? 0 : side === 's' ? Math.PI : side === 'w' ? Math.PI / 2 : -Math.PI / 2
}

/** 让 PlayerRig 面朝 (dx, dz)。 */
export function yawToward(dx: number, dz: number) {
  return Math.atan2(-dx, -dz)
}

const SIDES: Side[] = ['n', 's', 'e', 'w']

/** 一面墙扣掉洞口后剩下的块：墙垛（整层高）+ 洞口下的窗台墙 + 洞口上的过梁。 */
function wallPieces(len: number, H: number, ops: LocalOpening[]) {
  const pieces: Array<[number, number, number, number]> = []
  let cursor = -len / 2
  for (const o of [...ops].sort((p, q) => p.l0 - q.l0)) {
    if (o.l0 > cursor) pieces.push([cursor, o.l0, 0, H])
    if (o.y0 > 0.005) pieces.push([o.l0, o.l1, 0, o.y0])
    if (o.y1 < H) pieces.push([o.l0, o.l1, Math.min(o.y1, H), H])
    cursor = Math.max(cursor, o.l1)
  }
  if (cursor < len / 2) pieces.push([cursor, len / 2, 0, H])
  return pieces.filter(([a, b, c, d]) => b - a > 0.005 && d - c > 0.005)
}

function placePlane(box: RoomBox, side: Side, l0: number, l1: number, y0: number, y1: number, tile: number) {
  const w = l1 - l0
  const h = y1 - y0
  const g = new THREE.PlaneGeometry(w, h)
  // 按真实尺寸铺 UV：合并成一个几何体后，贴图密度在每一块墙上都一致
  const lc = (l0 + l1) / 2
  const yc = (y0 + y1) / 2
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + lc) / tile, (pos.getY(i) + yc) / tile)
  }
  g.rotateY(inwardYaw(side))
  const [x, z] = wallPoint(box, side, 0, IN)
  const along = side === 'n' || side === 's' ? [lc, 0] : [0, lc]
  g.translate(x + along[0], yc, z + along[1])
  return g
}

/** 墙上一个沿墙/竖向/离墙深度都给定的盒子（深度为正 = 墙外）。 */
function boxOnWall(box: RoomBox, side: Side, l0: number, l1: number, y0: number, y1: number, o0: number, o1: number) {
  const g = new THREE.BoxGeometry(
    side === 'n' || side === 's' ? l1 - l0 : o1 - o0,
    y1 - y0,
    side === 'n' || side === 's' ? o1 - o0 : l1 - l0,
  )
  const lc = (l0 + l1) / 2
  const oc = (o0 + o1) / 2
  const [x, z] = wallPoint(box, side, lc, -oc)
  g.translate(x, (y0 + y1) / 2, z)
  return g
}

export function RoomWalls({
  box,
  openings,
  wallColor,
  floorColor,
  ceiling = '#e6e1d7',
  onFloorClick,
  editing,
}: {
  box: RoomBox
  openings: LocalOpening[]
  wallColor: string
  floorColor: string
  ceiling?: string
  onFloorClick?: (x: number, z: number) => void
  editing?: boolean
}) {
  const walls = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (const side of SIDES) {
      const ops = openings.filter((o) => o.side === side)
      for (const [l0, l1, y0, y1] of wallPieces(sideLength(box, side), box.H, ops)) {
        parts.push(placePlane(box, side, l0, l1, y0, y1, 3.2))
      }
    }
    const merged = mergeGeometries(parts, false)
    for (const g of parts) g.dispose()
    return merged
  }, [box, openings])
  useEffect(() => () => walls?.dispose(), [walls])

  // 窗洞里的玻璃与窗框：只画外墙上的洞（门、电梯另画）
  const glazing = useMemo(() => {
    const glass: THREE.BufferGeometry[] = []
    const frame: THREE.BufferGeometry[] = []
    const t = 0.07
    // 玻璃落在外墙厚度中间偏外，和楼壳上邻居家的玻璃同一个深度
    const g0 = WALL - 0.2
    const g1 = WALL - 0.16
    for (const o of openings) {
      if (o.kind === 'door' || o.kind === 'elevator') continue
      const { side, l0, l1, y0, y1 } = o
      if (o.kind === 'balcony') {
        // 推拉门：一扇固定在左半边，右半边推开，人能走出去
        const mid = (l0 + l1) / 2
        glass.push(boxOnWall(box, side, l0, mid, y0, y1, g0, g1))
        frame.push(boxOnWall(box, side, mid - 0.03, mid + 0.03, y0, y1, g0 - 0.04, g1 + 0.04))
      } else if (o.kind === 'entry') {
        // 门厅玻璃门：两侧固定扇，中间 1.8m 是门
        const mid = (l0 + l1) / 2
        glass.push(boxOnWall(box, side, l0, mid - 0.9, y0, y1, g0, g1))
        glass.push(boxOnWall(box, side, mid + 0.9, l1, y0, y1, g0, g1))
        glass.push(boxOnWall(box, side, mid - 0.9, mid + 0.9, y0, y1, g0 - 0.06, g1 - 0.06))
      } else {
        glass.push(boxOnWall(box, side, l0, l1, y0, y1, g0, g1))
        const n = o.kind === 'store' ? Math.max(1, Math.round((l1 - l0) / 2.2)) : l1 - l0 > 1.6 ? 2 : 1
        for (let i = 1; i < n; i++) {
          const a = l0 + ((l1 - l0) * i) / n
          frame.push(boxOnWall(box, side, a - 0.03, a + 0.03, y0, y1, g0 - 0.04, g1 + 0.04))
        }
      }
      frame.push(boxOnWall(box, side, l0, l0 + t, y0, y1, g0 - 0.06, g1 + 0.02))
      frame.push(boxOnWall(box, side, l1 - t, l1, y0, y1, g0 - 0.06, g1 + 0.02))
      frame.push(boxOnWall(box, side, l0, l1, y1 - t, y1, g0 - 0.06, g1 + 0.02))
      frame.push(boxOnWall(box, side, l0, l1, y0, y0 + t, g0 - 0.06, g1 + 0.02))
      // 室内窗台板
      if (o.kind === 'window' || o.kind === 'stair') {
        frame.push(boxOnWall(box, side, l0 - 0.08, l1 + 0.08, y0 - 0.04, y0, -0.18, 0.06))
      }
    }
    const merge = (list: THREE.BufferGeometry[]) => (list.length ? mergeGeometries(list, false) : null)
    const out = { glass: merge(glass), frame: merge(frame) }
    for (const g of [...glass, ...frame]) g.dispose()
    return out
  }, [box, openings])
  useEffect(
    () => () => {
      glazing.glass?.dispose()
      glazing.frame?.dispose()
    },
    [glazing],
  )

  const wallMap = useMemo(() => makeWallTexture(wallColor), [wallColor])
  const floorMap = useMemo(() => {
    const tex = makeFloorTexture(floorColor, '#7f6f58')
    tex.repeat.set(Math.max(2, box.W / 4.2), Math.max(2, box.D / 4.2))
    return tex
  }, [floorColor, box.W, box.D])
  useEffect(
    () => () => {
      wallMap.dispose()
      floorMap.dispose()
    },
    [wallMap, floorMap],
  )

  // 踢脚线：每面墙沿着墙垛走，门洞和落地洞口处断开
  const skirting = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (const side of SIDES) {
      const ops = openings.filter((o) => o.side === side && o.y0 < 0.1)
      const len = sideLength(box, side)
      let cursor = -len / 2
      for (const o of [...ops].sort((p, q) => p.l0 - q.l0)) {
        if (o.l0 - cursor > 0.05) parts.push(boxOnWall(box, side, cursor, o.l0, 0, 0.12, -IN - 0.04, -IN))
        cursor = Math.max(cursor, o.l1)
      }
      if (len / 2 - cursor > 0.05) parts.push(boxOnWall(box, side, cursor, len / 2, 0, 0.12, -IN - 0.04, -IN))
    }
    const merged = parts.length ? mergeGeometries(parts, false) : null
    for (const g of parts) g.dispose()
    return merged
  }, [box, openings])
  useEffect(() => () => skirting?.dispose(), [skirting])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[box.W, box.D]} />
        <meshStandardMaterial map={floorMap} color="#ffffff" roughness={0.62} metalness={0.03} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, box.H, 0]}>
        <planeGeometry args={[box.W, box.D]} />
        <meshStandardMaterial color={ceiling} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {walls && (
        <mesh geometry={walls} receiveShadow>
          <meshStandardMaterial map={wallMap} color="#ffffff" roughness={0.94} side={THREE.DoubleSide} />
        </mesh>
      )}
      {skirting && (
        <mesh geometry={skirting}>
          <meshStandardMaterial color="#b9ad9b" roughness={0.8} />
        </mesh>
      )}
      {glazing.frame && (
        <mesh geometry={glazing.frame} castShadow>
          <meshStandardMaterial color="#5f5a52" roughness={0.5} metalness={0.4} />
        </mesh>
      )}
      {glazing.glass && (
        <mesh geometry={glazing.glass}>
          <meshStandardMaterial
            color="#cfe1e8"
            transparent
            opacity={0.12}
            roughness={0.05}
            metalness={0.5}
            depthWrite={false}
          />
        </mesh>
      )}
      {editing && (
        <>
          <gridHelper args={[Math.min(box.W, box.D) - 0.5, 14, '#a49174', '#c0b29a']} position={[0, 0.03, 0]} />
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.045, 0]}
            onClick={(event) => {
              event.stopPropagation()
              onFloorClick?.(event.point.x, event.point.z)
            }}
          >
            <planeGeometry args={[box.W - 1.1, box.D - 1.1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  )
}

/**
 * 户内隔墙：卧室/卫生间的墙。
 *
 * 数据来自楼层平面（shared/units.mjs 的 interior），所以走廊外面看到的户型
 * 和进屋看到的隔墙是同一份；墙上的门洞也是在那里扣好的，这里只画剩下的墙段。
 */
export function PartitionWalls({
  walls,
  headers = [],
  height,
  color = '#e7e2d8',
}: {
  walls: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>
  /** 门洞上方的过梁：门洞不该是一条通到天花板的缝。 */
  headers?: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>
  height: number
  color?: string
}) {
  if (!walls.length && !headers.length) return null
  return (
    <group>
      {walls.map((w, i) => (
        <mesh
          key={i}
          position={[(w.minX + w.maxX) / 2, height / 2, (w.minZ + w.maxZ) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[Math.max(0.02, w.maxX - w.minX), height, Math.max(0.02, w.maxZ - w.minZ)]} />
          <meshStandardMaterial color={color} roughness={0.94} />
        </mesh>
      ))}
      {headers.map((w, i) => (
        <mesh
          key={`h${i}`}
          position={[(w.minX + w.maxX) / 2, (DOOR_HEAD + height) / 2, (w.minZ + w.maxZ) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[Math.max(0.02, w.maxX - w.minX), height - DOOR_HEAD, Math.max(0.02, w.maxZ - w.minZ)]} />
          <meshStandardMaterial color={color} roughness={0.94} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * 关着的门。
 *
 * 洞里先塞一块把整个墙厚填满的"门芯"（比洞口各边小 1cm，正好顶到两侧墙面里 1cm），
 * 再在两边各贴一层门扇和门套。以前只画两片薄门板，门板和洞口之间会漏出一圈缝，
 * 站在走廊就能从缝里看进房间——现在洞是实心的，两侧只是装饰面。
 */
export function ClosedDoor({
  box,
  side,
  l,
  color = '#5f5142',
  elevator = false,
}: {
  box: RoomBox
  side: Side
  l: number
  color?: string
  elevator?: boolean
}) {
  const w = elevator ? 1.3 : DOOR.width
  const h = elevator ? 2.3 : DOOR.height
  const [x, z] = wallPoint(box, side, l, 0)
  const frameColor = elevator ? '#8d9297' : '#6a5c4b'
  const leafColor = elevator ? '#b9bec2' : color
  // 墙厚两侧的墙面各比矩形边往里 2cm，门芯要跨过这一整段
  const depth = WALL + IN * 2

  const leaf = (front: boolean) => (
    <group position={[0, 0, front ? IN : -WALL - IN]} rotation={[0, front ? 0 : Math.PI, 0]}>
      <mesh position={[0, h / 2, 0.03]} castShadow receiveShadow>
        <boxGeometry args={[w - 0.02, h - 0.01, 0.05]} />
        <meshStandardMaterial
          color={leafColor}
          roughness={elevator ? 0.3 : 0.72}
          metalness={elevator ? 0.8 : 0.05}
        />
      </mesh>
      {/* 门套：包在门扇四周，把门扇和洞口之间的 1cm 压掉 */}
      {[-1, 1].map((s) => (
        <mesh key={`j${s}`} position={[s * (w / 2 + 0.045), h / 2, 0.055]}>
          <boxGeometry args={[0.1, h + 0.09, 0.05]} />
          <meshStandardMaterial color={frameColor} roughness={0.55} metalness={elevator ? 0.6 : 0.05} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.045, 0.055]}>
        <boxGeometry args={[w + 0.2, 0.1, 0.05]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={elevator ? 0.6 : 0.05} />
      </mesh>
      {elevator ? (
        <mesh position={[0, h / 2, 0.07]}>
          <boxGeometry args={[0.05, h - 0.12, 0.03]} />
          <meshStandardMaterial color="#7d848a" roughness={0.4} metalness={0.7} />
        </mesh>
      ) : (
        <mesh position={[w / 2 - 0.16, 1.02, 0.1]}>
          <boxGeometry args={[0.05, 0.18, 0.05]} />
          <meshStandardMaterial color="#c9b68f" metalness={0.65} roughness={0.28} />
        </mesh>
      )}
    </group>
  )

  return (
    <group position={[x, 0, z]} rotation={[0, inwardYaw(side), 0]}>
      {/* 门芯：填满洞口和整个墙厚，两侧墙面之间不再有缝 */}
      <mesh position={[0, h / 2, -WALL / 2]} receiveShadow>
        <boxGeometry args={[w - 0.01, h - 0.01, depth]} />
        <meshStandardMaterial color={elevator ? '#5a6166' : '#3a3027'} roughness={0.9} metalness={0.1} />
      </mesh>
      {leaf(true)}
      {leaf(false)}
    </group>
  )
}

/** 阳台在房间局部坐标里的矩形（含外墙厚度那一段过道）。 */
export function balconyRect(box: RoomBox, bal: BalconySpan) {
  const l0 = localAlong(box, bal.side, bal.a0)
  const l1 = localAlong(box, bal.side, bal.a1)
  const far = WALL + BALCONY_OUT
  switch (bal.side) {
    case 'n':
      return { minX: l0, maxX: l1, minZ: -box.D / 2 - far, maxZ: -box.D / 2 }
    case 's':
      return { minX: l0, maxX: l1, minZ: box.D / 2, maxZ: box.D / 2 + far }
    case 'w':
      return { minX: -box.W / 2 - far, maxX: -box.W / 2, minZ: l0, maxZ: l1 }
    default:
      return { minX: box.W / 2, maxX: box.W / 2 + far, minZ: l0, maxZ: l1 }
  }
}

/** 本户自己的阳台：挑板、玻璃栏板、扶手、两盆绿植。楼壳那边已经把这一户留空了。 */
export function Balcony({ box, bal }: { box: RoomBox; bal: BalconySpan }) {
  const geo = useMemo(() => {
    const slab: THREE.BufferGeometry[] = []
    const rail: THREE.BufferGeometry[] = []
    const glass: THREE.BufferGeometry[] = []
    const l0 = localAlong(box, bal.side, bal.a0)
    const l1 = localAlong(box, bal.side, bal.a1)
    const near = WALL
    const far = WALL + BALCONY_OUT
    // 挑板：从外墙外皮挑出 1.5m；墙厚那一段是门槛
    slab.push(boxOnWall(box, bal.side, l0, l1, -0.2, -0.02, near, far))
    slab.push(boxOnWall(box, bal.side, l0, l1, -0.2, 0.0, 0, near))
    glass.push(boxOnWall(box, bal.side, l0, l1, -0.02, 1.02, far - 0.06, far - 0.02))
    rail.push(boxOnWall(box, bal.side, l0, l1, 1.0, 1.08, far - 0.08, far))
    for (const a of [l0, l1 - 0.05]) {
      glass.push(boxOnWall(box, bal.side, a, a + 0.05, -0.02, 1.02, near, far))
      rail.push(boxOnWall(box, bal.side, a, a + 0.05, 1.0, 1.08, near, far))
    }
    const merge = (list: THREE.BufferGeometry[]) => {
      const m = mergeGeometries(list, false)
      for (const g of list) g.dispose()
      return m
    }
    return { slab: merge(slab), rail: merge(rail), glass: merge(glass) }
  }, [box, bal])
  useEffect(
    () => () => {
      geo.slab?.dispose()
      geo.rail?.dispose()
      geo.glass?.dispose()
    },
    [geo],
  )

  const plants = useMemo(() => {
    const l0 = localAlong(box, bal.side, bal.a0)
    const l1 = localAlong(box, bal.side, bal.a1)
    return [l0 + 0.6, l1 - 0.6].map((l) => wallPoint(box, bal.side, l, -(WALL + 0.45)))
  }, [box, bal])

  return (
    <group>
      <mesh geometry={geo.slab} receiveShadow>
        <meshStandardMaterial color="#b8ab97" roughness={0.86} />
      </mesh>
      <mesh geometry={geo.rail}>
        <meshStandardMaterial color="#5f5a52" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh geometry={geo.glass}>
        <meshStandardMaterial color="#a9c3cb" roughness={0.1} metalness={0.4} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {plants.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.18, 0.36, 12]} />
            <meshStandardMaterial color="#9c7f63" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <icosahedronGeometry args={[0.34, 1]} />
            <meshStandardMaterial color="#587a58" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * 碰撞：四面墙按"墙垛"生成，只有能走的洞（阳台门）留空；
 * 阳台外沿与两侧是栏杆；阳台两旁、外墙厚度那一圈用实体填上，
 * 这样走路边界可以直接用"房间 + 阳台"的外包矩形。
 */
export function roomColliders(box: RoomBox, openings: LocalOpening[], bal: BalconySpan | null): Collider[] {
  const list: Collider[] = []
  const T = 0.12
  for (const side of SIDES) {
    const len = sideLength(box, side)
    const walkable = openings
      .filter((o) => o.side === side && o.kind === 'balcony')
      .sort((p, q) => p.l0 - q.l0)
    let cursor = -len / 2 - WALL
    const segs: Array<[number, number]> = []
    for (const o of walkable) {
      segs.push([cursor, o.l0])
      cursor = o.l1
    }
    segs.push([cursor, len / 2 + WALL])
    for (const [a, b] of segs) {
      if (b - a < 0.01) continue
      const [x0, z0] = wallPoint(box, side, a, -WALL)
      const [x1, z1] = wallPoint(box, side, b, T)
      list.push({
        minX: Math.min(x0, x1),
        maxX: Math.max(x0, x1),
        minZ: Math.min(z0, z1),
        maxZ: Math.max(z0, z1),
        minY: 0,
        maxY: box.H,
      })
    }
  }
  if (bal) {
    const r = balconyRect(box, bal)
    const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[bal.side]
    // 外沿栏杆
    if (out[0] === 0) {
      const z = out[1] < 0 ? r.minZ : r.maxZ
      list.push({ minX: r.minX, maxX: r.maxX, minZ: z - 0.12, maxZ: z + 0.12, minY: 0, maxY: 1.2 })
      list.push({ minX: r.minX - 0.12, maxX: r.minX + 0.08, minZ: r.minZ, maxZ: r.maxZ, minY: 0, maxY: 1.2 })
      list.push({ minX: r.maxX - 0.08, maxX: r.maxX + 0.12, minZ: r.minZ, maxZ: r.maxZ, minY: 0, maxY: 1.2 })
      // 阳台两旁（房间更宽的那部分）
      list.push({ minX: -box.W / 2 - 1, maxX: r.minX, minZ: r.minZ - 0.2, maxZ: r.maxZ + 0.2, minY: 0, maxY: box.H })
      list.push({ minX: r.maxX, maxX: box.W / 2 + 1, minZ: r.minZ - 0.2, maxZ: r.maxZ + 0.2, minY: 0, maxY: box.H })
    } else {
      const x = out[0] < 0 ? r.minX : r.maxX
      list.push({ minX: x - 0.12, maxX: x + 0.12, minZ: r.minZ, maxZ: r.maxZ, minY: 0, maxY: 1.2 })
      list.push({ minX: r.minX, maxX: r.maxX, minZ: r.minZ - 0.12, maxZ: r.minZ + 0.08, minY: 0, maxY: 1.2 })
      list.push({ minX: r.minX, maxX: r.maxX, minZ: r.maxZ - 0.08, maxZ: r.maxZ + 0.12, minY: 0, maxY: 1.2 })
      list.push({ minX: r.minX - 0.2, maxX: r.maxX + 0.2, minZ: -box.D / 2 - 1, maxZ: r.minZ, minY: 0, maxY: box.H })
      list.push({ minX: r.minX - 0.2, maxX: r.maxX + 0.2, minZ: r.maxZ, maxZ: box.D / 2 + 1, minY: 0, maxY: box.H })
    }
  }
  // 天花：只挡镜头
  list.push({
    minX: -box.W / 2,
    maxX: box.W / 2,
    minZ: -box.D / 2,
    maxZ: box.D / 2,
    minY: box.H,
    maxY: box.H + 0.6,
    walk: false,
  })
  return list
}

/** 行走边界：房间 + 阳台的外包矩形。 */
export function roomBounds(box: RoomBox, bal: BalconySpan | null) {
  const b = { minX: -box.W / 2 + 0.45, maxX: box.W / 2 - 0.45, minZ: -box.D / 2 + 0.45, maxZ: box.D / 2 - 0.45 }
  if (!bal) return b
  const r = balconyRect(box, bal)
  return {
    minX: Math.min(b.minX, r.minX + 0.45),
    maxX: Math.max(b.maxX, r.maxX - 0.45),
    minZ: Math.min(b.minZ, r.minZ + 0.45),
    maxZ: Math.max(b.maxZ, r.maxZ - 0.45),
  }
}
