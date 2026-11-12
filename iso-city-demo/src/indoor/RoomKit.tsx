import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BALCONY_OUT, DOOR, WALL, type BalconySpan, type Opening, type Rect, type Side } from '../data/units'
import type { Collider } from '../scene/PlayerRig'
import { walker } from '../game/walker'
import { makeFloorTexture, makeWallTexture } from '../scene/textures'
import { INDOOR_STYLE, deepen } from './style'

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

/** 一面墙上连续的一段空墙（沿墙坐标，原点在墙中点）。 */
export type WallRun = { side: Side; center: number; len: number }

/** 洞口/隔墙两边各留的空：画挂到边上会贴着墙角或隔墙。 */
const RUN_EDGE = 0.3
/** 太短的一段不值得挂东西。 */
const RUN_MIN = 2.0

/**
 * 每面墙上真正能挂东西的连续段。
 *
 * 只避开洞口是不够的：户内隔墙（卧室墙）会从中间把一面墙劈开，
 * 以前画廊墙按整面墙等距排四幅，画就直接穿过隔墙了。
 * 这里把洞口和贴着这面墙的隔墙都算成"被占掉"，返回剩下的段。
 */
export function freeWallRuns(
  box: RoomBox,
  openings: LocalOpening[],
  partitions: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> = [],
): WallRun[] {
  const runs: WallRun[] = []
  for (const side of SIDES) {
    const half = sideLength(box, side) / 2
    const busy: Array<[number, number]> = []
    for (const o of openings) if (o.side === side) busy.push([o.l0 - RUN_EDGE, o.l1 + RUN_EDGE])
    for (const w of partitions) {
      const touches =
        side === 'n'
          ? w.minZ <= -box.D / 2 + 0.4
          : side === 's'
            ? w.maxZ >= box.D / 2 - 0.4
            : side === 'w'
              ? w.minX <= -box.W / 2 + 0.4
              : w.maxX >= box.W / 2 - 0.4
      if (!touches) continue
      busy.push(side === 'n' || side === 's' ? [w.minX - RUN_EDGE, w.maxX + RUN_EDGE] : [w.minZ - RUN_EDGE, w.maxZ + RUN_EDGE])
    }
    busy.sort((p, q) => p[0] - q[0])
    let cursor = -half
    for (const [a, b] of busy) {
      const end = Math.min(a, half)
      if (end - cursor > 0.2) runs.push({ side, center: (cursor + end) / 2, len: end - cursor })
      cursor = Math.max(cursor, Math.min(b, half))
    }
    if (half - cursor > 0.2) runs.push({ side, center: (cursor + half) / 2, len: half - cursor })
  }
  return runs.filter((r) => r.len >= RUN_MIN).sort((a, b) => b.len - a.len)
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

/** 两面墙净距小于这个值（且另一向明显更长）就当作走廊。 */
const NARROW_SPAN = 4.8
/** 长短比达到这个值才算走廊，方正的小房间不算。 */
const CORRIDOR_RATIO = 1.7
/** 镜头的横向偏移占比低于这个值（≈27°）就算"顺着这条轴看"。 */
const ALONG_SIN = 0.45

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

type WallPart = {
  side: Side
  wall: THREE.BufferGeometry | null
  frame: THREE.BufferGeometry | null
  glass: THREE.BufferGeometry | null
  skirt: THREE.BufferGeometry | null
}

/**
 * 剖面要摘掉哪些墙。
 *
 * 普通房间：x 轴摘一面、z 轴摘一面，永远是"朝着镜头的那两面"，
 * 结果和相机距离无关，不会出现"四面墙都在"的中间态。
 *
 * 走廊（酒店内廊、板楼楼梯间，净宽 2.4~3.2m）要另算：那两面墙本来就挨得很近，
 * 顺着走廊走的时候镜头基本平行于它们，几乎看不到墙面，只剩一点点厚度；
 * 这时再摘掉近的那面，走廊就只剩一面墙挂在那儿，另一侧直接漏成空地。
 * 所以窄向的两面墙在"顺着看"时都留着，只切掉近头那面端墙——就是一条剖开的走廊。
 * 反过来横着看走廊（镜头在侧边）时必须切，否则近侧那面 2.8m 高的墙会把地面全挡死。
 */
export function cutSides(box: RoomBox, p: THREE.Vector3) {
  // 室内场景的坐标系原点就是房间中心（CityBackdrop 用 box.cx/cz 反算城市位置），
  // 所以这里直接和 0 比，不要用 box.cx / box.cz（那是楼栋坐标）。
  const lateral = Math.hypot(p.x, p.z) || 1
  // 镜头几乎顺着 z / x 轴看：横向偏移占全长不到 45%，约 27° 以内
  const alongZ = Math.abs(p.x) / lateral < ALONG_SIN
  const alongX = Math.abs(p.z) / lateral < ALONG_SIN
  // 窄向 + 另一向明显更长 = 走廊。方正的小房间不算，它的近墙照样要摘。
  const corridorX = box.W < NARROW_SPAN && box.D > box.W * CORRIDOR_RATIO
  const corridorZ = box.D < NARROW_SPAN && box.W > box.D * CORRIDOR_RATIO
  const keepX = corridorX && alongZ
  const keepZ = corridorZ && alongX
  return {
    n: !keepZ && p.z <= 0,
    s: !keepZ && p.z > 0,
    w: !keepX && p.x <= 0,
    e: !keepX && p.x > 0,
  } as Record<Side, boolean>
}

/** 相机在房间中心的正对角线上时，两面都判断为"近"，取其一即可。 */
export function wallHiddenAt(side: Side, _box: RoomBox | undefined, p: THREE.Vector3) {
  return cutSides(_box ?? { W: 0, D: 0, H: 0, cx: 0, cz: 0 }, p)[side]
}

/**
 * 挂在墙上的东西（画框、幕布）也要跟着那面墙一起藏。
 * 不然剖面把墙摘掉之后，画还浮在空气里。
 */
/** 墙上一点 (x,z) 属于哪一面墙（室内坐标原点 = 房间中心）。 */
export function sideOfPoint(x: number, z: number): Side {
  return Math.abs(x) >= Math.abs(z) ? (x < 0 ? 'w' : 'e') : z < 0 ? 'n' : 's'
}

export function useWallCut(side: Side, box?: RoomBox) {
  const camera = useThree((state) => state.camera)
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.visible = !wallHiddenAt(side, box, camera.position)
  })
  return ref
}

/**
 * 阳台的剖面。
 *
 * 阳台不能直接用 useWallCut：人一走到阳台上，镜头必然越过那面外墙，
 * "近侧墙"判定成立，整组阳台（挑板 + 玻璃栏板 + 扶手）会被一起摘掉，
 * 结果就是站在半空里——地板和围墙全没了。
 *
 * 所以这里加一个条件：**人还在屋里**时才按近侧摘掉（那是为了避免半透玻璃
 * 在镜头前糊成一层雾），人已经站到阳台上了就一律保留。
 */
export function useBalconyCut(bal: BalconySpan, box: RoomBox) {
  const camera = useThree((state) => state.camera)
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ref.current) return
    const p = walker.position
    const r = balconyRect(box, bal)
    // 门口那一小段也算"在阳台上"：跨门槛时不能闪一下
    const m = 0.6
    const standing = p.x > r.minX - m && p.x < r.maxX + m && p.z > r.minZ - m && p.z < r.maxZ + m
    // 正上方俯视（室内的"俯视"机位）：横向偏移几乎为 0，近侧判定会随机命中，
    // 阳台就会莫名其妙消失。这种机位下阳台一直留着。
    const overhead = Math.hypot(camera.position.x, camera.position.z) < 1.5
    ref.current.visible = standing || overhead || !wallHiddenAt(bal.side, box, camera.position)
  })
  return ref
}

/**
 * 剖面墙：镜头跑到哪面墙的外侧，就把那面墙（连同它的窗套、玻璃、踢脚线）摘掉。
 *
 * iso 视角下房间只有几米宽，镜头必然站在墙外。以前四面墙和吊顶永远显示，
 * 于是默认机位只能压得很近——再拉远就被墙挡死，房间里永远是个特写。
 * 这里不靠 React 状态：每帧比较相机位置和四面墙的平面，带 0.25m 死区，
 * 贴着墙转视角时不会闪。窗外的城市照旧从保留的那两面墙的洞口看出去。
 */
function CutawayWalls({
  box,
  wallMap,
  ceilingColor,
  hideCeiling,
  parts,
}: {
  box: RoomBox
  wallMap: THREE.Texture
  ceilingColor: string
  hideCeiling: boolean
  parts: WallPart[]
}) {
  const camera = useThree((state) => state.camera)
  const groups = useRef<Partial<Record<Side, THREE.Group | null>>>({})
  const slab = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const p = camera.position
    for (const side of SIDES) {
      const node = groups.current[side]
      if (node) node.visible = !wallHiddenAt(side, box, p)
    }
    // 吊顶：镜头高过墙顶就必须收掉，否则俯视全是白板
    if (slab.current) slab.current.visible = !hideCeiling && p.y < box.H - 0.1
  })

  return (
    <group>
      {parts.map((part) => (
        <group
          key={part.side}
          ref={(node) => {
            groups.current[part.side] = node
          }}
        >
          {part.wall && (
            <mesh geometry={part.wall} receiveShadow>
              <meshStandardMaterial
                map={wallMap}
                color="#ffffff"
                roughness={0.9}
                metalness={0.02}
                envMapIntensity={0.55}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
          {part.skirt && (
            <mesh geometry={part.skirt}>
              <meshStandardMaterial color={INDOOR_STYLE.skirting} roughness={0.62} metalness={0.12} />
            </mesh>
          )}
          {/* 踢脚线上沿的一条细灯带：深色墙在剖面视角里最容易糊成一片，
              这一条冷光把墙脚勾出来，也是参考图里最明显的"室内通电"的信号。
              借用踢脚线几何，只压扁 y 方向，不增加顶点。 */}
          {part.skirt && (
            <mesh geometry={part.skirt} position={[0, 0.118, 0]} scale={[1, 0.22, 1]}>
              <meshBasicMaterial color={INDOOR_STYLE.neon} transparent opacity={0.5} toneMapped={false} />
            </mesh>
          )}
          {part.frame && (
            <mesh geometry={part.frame} castShadow>
              <meshStandardMaterial
                color={INDOOR_STYLE.frame}
                roughness={0.34}
                metalness={0.62}
                envMapIntensity={0.9}
              />
            </mesh>
          )}
          {part.glass && (
            <mesh geometry={part.glass}>
              <meshStandardMaterial
                color={INDOOR_STYLE.glass}
                transparent
                opacity={INDOOR_STYLE.glassOpacity}
                roughness={0.03}
                metalness={0.62}
                envMapIntensity={1.4}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      ))}
      <mesh ref={slab} rotation={[Math.PI / 2, 0, 0]} position={[0, box.H, 0]}>
        <planeGeometry args={[box.W, box.D]} />
        <meshStandardMaterial color={ceilingColor} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>    </group>
  )
}

export function RoomWalls({
  box,
  openings,
  wallColor,
  floorColor,
  ceiling = INDOOR_STYLE.ceiling,
  onFloorClick,
  editing,
  hideCeiling = false,
}: {
  box: RoomBox
  openings: LocalOpening[]
  wallColor: string
  floorColor: string
  ceiling?: string
  onFloorClick?: (x: number, z: number) => void
  editing?: boolean
  /** 剖切俯视：天花板要收掉，否则镜头只能看到一块白板 */
  hideCeiling?: boolean
}) {
  // 四面墙分开成四份几何：iso 剖面要把靠近镜头的那两面摘掉，
  // 合批成一整块就只能整层一起消失（以前这就是"穿墙什么都看不见"的来源）。
  const walls = useMemo(() => {
    const out = {} as Record<Side, THREE.BufferGeometry | null>
    for (const side of SIDES) {
      const ops = openings.filter((o) => o.side === side)
      const parts = wallPieces(sideLength(box, side), box.H, ops).map(([l0, l1, y0, y1]) =>
        placePlane(box, side, l0, l1, y0, y1, 3.2),
      )
      out[side] = parts.length ? mergeGeometries(parts, false) : null
      for (const g of parts) g.dispose()
    }
    return out
  }, [box, openings])
  useEffect(
    () => () => {
      for (const side of SIDES) walls[side]?.dispose()
    },
    [walls],
  )

  // 窗洞里的玻璃与窗框：只画外墙上的洞（门、电梯另画）
  const glazing = useMemo(() => {
    const glass = {} as Record<Side, THREE.BufferGeometry[]>
    const frame = {} as Record<Side, THREE.BufferGeometry[]>
    for (const side of SIDES) {
      glass[side] = []
      frame[side] = []
    }
    const t = 0.07
    // 玻璃落在外墙厚度中间偏外，和楼壳上邻居家的玻璃同一个深度
    const g0 = WALL - 0.2
    const g1 = WALL - 0.16
    for (const o of openings) {
      if (o.kind === 'door' || o.kind === 'elevator') continue
      const { side, l0, l1, y0, y1 } = o
      const glassOf = glass[side]
      const frameOf = frame[side]
      if (o.kind === 'balcony') {
        // 推拉门：一扇固定在左半边，右半边推开，人能走出去
        const mid = (l0 + l1) / 2
        glassOf.push(boxOnWall(box, side, l0, mid, y0, y1, g0, g1))
        frameOf.push(boxOnWall(box, side, mid - 0.03, mid + 0.03, y0, y1, g0 - 0.04, g1 + 0.04))
      } else if (o.kind === 'entry') {
        // 门厅玻璃门：两侧固定扇，中间 1.8m 是门
        const mid = (l0 + l1) / 2
        glassOf.push(boxOnWall(box, side, l0, mid - 0.9, y0, y1, g0, g1))
        glassOf.push(boxOnWall(box, side, mid + 0.9, l1, y0, y1, g0, g1))
        glassOf.push(boxOnWall(box, side, mid - 0.9, mid + 0.9, y0, y1, g0 - 0.06, g1 - 0.06))
      } else {
        glassOf.push(boxOnWall(box, side, l0, l1, y0, y1, g0, g1))
        const n = o.kind === 'store' ? Math.max(1, Math.round((l1 - l0) / 2.2)) : Math.max(1, Math.round((l1 - l0) / 1.15))
        for (let i = 1; i < n; i++) {
          const a = l0 + ((l1 - l0) * i) / n
          frameOf.push(boxOnWall(box, side, a - 0.03, a + 0.03, y0, y1, g0 - 0.04, g1 + 0.04))
        }
      }
      frameOf.push(boxOnWall(box, side, l0, l0 + t, y0, y1, g0 - 0.06, g1 + 0.02))
      frameOf.push(boxOnWall(box, side, l1 - t, l1, y0, y1, g0 - 0.06, g1 + 0.02))
      frameOf.push(boxOnWall(box, side, l0, l1, y1 - t, y1, g0 - 0.06, g1 + 0.02))
      frameOf.push(boxOnWall(box, side, l0, l1, y0, y0 + t, g0 - 0.06, g1 + 0.02))
      // 室内窗台板
      if (o.kind === 'window' || o.kind === 'stair') {
        frameOf.push(boxOnWall(box, side, l0 - 0.08, l1 + 0.08, y0 - 0.04, y0, -0.18, 0.06))
      }
    }
    const merge = (list: THREE.BufferGeometry[]) => (list.length ? mergeGeometries(list, false) : null)
    const out = { glass: {} as Record<Side, THREE.BufferGeometry | null>, frame: {} as Record<Side, THREE.BufferGeometry | null> }
    for (const side of SIDES) {
      out.glass[side] = merge(glass[side])
      out.frame[side] = merge(frame[side])
      for (const g of [...glass[side], ...frame[side]]) g.dispose()
    }
    return out
  }, [box, openings])
  useEffect(
    () => () => {
      for (const side of SIDES) {
        glazing.glass[side]?.dispose()
        glazing.frame[side]?.dispose()
      }
    },
    [glazing],
  )

  const wallMap = useMemo(() => makeWallTexture(wallColor), [wallColor])
  // 板缝色由地板色自己派生：换一套色板时木纹不会突然变成另一个色系
  const floorMap = useMemo(() => {
    const tex = makeFloorTexture(floorColor, deepen(floorColor, 0.34))
    tex.repeat.set(Math.max(2.4, box.W / 2.4), Math.max(2.4, box.D / 2.4))
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
    const out = {} as Record<Side, THREE.BufferGeometry | null>
    for (const side of SIDES) {
      const parts: THREE.BufferGeometry[] = []
      const ops = openings.filter((o) => o.side === side && o.y0 < 0.1)
      const len = sideLength(box, side)
      let cursor = -len / 2
      for (const o of [...ops].sort((p, q) => p.l0 - q.l0)) {
        if (o.l0 - cursor > 0.05) parts.push(boxOnWall(box, side, cursor, o.l0, 0, 0.12, -IN - 0.04, -IN))
        cursor = Math.max(cursor, o.l1)
      }
      if (len / 2 - cursor > 0.05) parts.push(boxOnWall(box, side, cursor, len / 2, 0, 0.12, -IN - 0.04, -IN))
      out[side] = parts.length ? mergeGeometries(parts, false) : null
      for (const g of parts) g.dispose()
    }
    return out
  }, [box, openings])
  useEffect(
    () => () => {
      for (const side of SIDES) skirting[side]?.dispose()
    },
    [skirting],
  )

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[box.W, box.D]} />
        <meshStandardMaterial
          map={floorMap}
          color="#ffffff"
          roughness={0.46}
          metalness={0.04}
          envMapIntensity={0.95}
        />
      </mesh>
      <CutawayWalls
        box={box}
        wallMap={wallMap}
        ceilingColor={ceiling}
        hideCeiling={hideCeiling}
        parts={SIDES.map((side) => ({
          side,
          wall: walls[side],
          frame: glazing.frame[side],
          glass: glazing.glass[side],
          skirt: skirting[side],
        }))}
      />
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
  color = INDOOR_STYLE.wallAlt,
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
 * 吊灯：一根细吊杆 + 金属锥形灯罩 + 暖光盘。
 * 参考图里每块区域的上方都挂着一盏，是房间里最直接的"暖色点"。
 * 只做视觉，不参与碰撞；挂在天花板下面，不会挡家具。
 */
export function CeilingPendant({
  x = 0,
  z = 0,
  height,
  neck = 0.5,
  shade = 0.42,
}: {
  x?: number
  z?: number
  height: number
  /** 吊杆长度 */
  neck?: number
  /** 灯罩半径 */
  shade?: number
}) {
  const y = height - neck
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height - 0.01, 0]}>
        <cylinderGeometry args={[shade * 0.2, shade * 0.2, 0.02, 16]} />
        <meshStandardMaterial color={INDOOR_STYLE.skirting} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, height - neck / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, neck, 6]} />
        <meshStandardMaterial color={INDOOR_STYLE.metal} roughness={0.35} metalness={0.7} />
      </mesh>
      {/* 灯罩：外深内亮，DoubleSide 才能从下面看到发光的那一面 */}
      <mesh position={[0, y, 0]}>
        <cylinderGeometry args={[shade * 0.42, shade, shade * 0.62, 24, 1, true]} />
        <meshStandardMaterial
          color="#2a3138"
          emissive="#ffc47a"
          emissiveIntensity={0.55}
          side={THREE.DoubleSide}
          roughness={0.5}
          metalness={0.35}
        />
      </mesh>
      {/* 灯芯：一块朝下的暖光圆盘，Bloom 会把它带出一圈光晕 */}
      <mesh position={[0, y - shade * 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[shade * 0.46, 20]} />
        <meshBasicMaterial color="#ffe0ab" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, y - 0.12, 0]} color="#ffd39a" intensity={2.1} distance={5.4} decay={2} />
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

  const cut = useWallCut(side, box)
  return (
    <group ref={cut} position={[x, 0, z]} rotation={[0, inwardYaw(side), 0]}>
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

  // 阳台挑在近处这面墙上时整组摘掉：栏杆玻璃是半透明的，
  // 留在画面里就是一层雾挡在房间前面。
  // 但如果人自己已经走到阳台上了，就绝不能摘——否则脚下没有板、身边没有栏板。
  const cut = useBalconyCut(bal, box)

  return (
    <group ref={cut}>
      <mesh geometry={geo.slab} receiveShadow>
        <meshStandardMaterial color="#c9bda9" roughness={0.78} metalness={0.05} envMapIntensity={0.7} />
      </mesh>
      <mesh geometry={geo.rail}>
        <meshStandardMaterial color={INDOOR_STYLE.frame} roughness={0.3} metalness={0.66} envMapIntensity={1.1} />
      </mesh>
      <mesh geometry={geo.glass}>
        <meshStandardMaterial color={INDOOR_STYLE.glass} roughness={0.04} metalness={0.6} envMapIntensity={1.5} transparent opacity={0.15} depthWrite={false} />
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
