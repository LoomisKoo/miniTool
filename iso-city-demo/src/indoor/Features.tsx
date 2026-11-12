// 户内的特色设施：画廊墙、唱片机、望远镜、私人影院、阳台灯串。
//
// 全部按「这户有什么」（data/features.ts）派生，不存数据。位置从房间平面算：
// 先用没有洞口的墙，按长度排；画廊墙占最长那面，影院占第二面，望远镜挂在窗边。
//
// 这里只返回 3D 节点和交互点，由 SpaceRoom 挂进场景——它那边的坐标原点
// 就是房间中心，与 UnitRoomPlan 同一套。

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Art } from '../types'
import type { HomeDevices, HomeFeature } from '../data/features'
import type { BalconySpan, Side } from '../data/units'
import { BALCONY_OUT, WALL } from '../data/units'
import { balconyRect, freeWallRuns, inwardYaw, useWallCut, wallPoint, type RoomBox, type WallRun } from './RoomKit'
import { wallDecor, type WallSpan } from './WallDecor'
import type { UnitRoomPlan } from './UnitRoom'
import type { Interactable } from '../scene/PlayerRig'
import { makeArtTexture, makeSignTexture } from '../scene/textures'
import { walker } from '../game/walker'
import { useApp } from '../store'
import { record } from '../audio/record'
import { music } from '../audio/music'
import { enterScope, leaveScope, scope } from './scope'

/** 画作轮流换色：同一面墙上的几幅不能长得一样。 */
const VARIANTS = ['dawn', 'coast', 'meadow', 'signal', 'night', 'clay']
const ORDINAL = ['壹', '贰', '叁', '肆']

type Wall = WallRun

/**
 * 能挂东西的空墙段：洞口和隔墙都已经扣掉，按长度从长到短。
 * 以前这里只按"这面墙有没有洞口"筛，结果画廊墙正好被卧室隔墙从中间劈开，
 * 四幅画有两幅挂在墙外/穿进隔墙里。
 */
function blankWalls(plan: UnitRoomPlan): WallRun[] {
  return freeWallRuns(plan.box, plan.openings, plan.partitions)
}

/**
 * 一个贴墙的东西（画、留言台、布置台）占掉哪一段墙。
 * 用"离哪面墙最近"判断，而不是 sideOfPoint 的 |x|≥|z|——小房间里
 * 离墙 0.7m 的点会落进另一条轴，软装就会误判成对面那面墙被占了。
 */
function spanOf(box: RoomBox, p: [number, number], half: number): WallSpan {
  const [x, z] = p
  const dn = Math.abs(z + box.D / 2)
  const ds = Math.abs(box.D / 2 - z)
  const dw = Math.abs(x + box.W / 2)
  const de = Math.abs(box.W / 2 - x)
  const min = Math.min(dn, ds, dw, de)
  if (min === dn || min === ds) return { side: min === dn ? 'n' : 's', a0: x - half, a1: x + half }
  return { side: min === dw ? 'w' : 'e', a0: z - half, a1: z + half }
}

type FrameProps = {
  w: number
  h: number
  palette: string
  title: string
  side: Side
  box: RoomBox
  position: [number, number, number]
  rotation: [number, number, number]
}

function Frame({ w, h, palette, title, side, box, position, rotation }: FrameProps) {
  const texture = useMemo(() => makeArtTexture(palette, 1), [palette])
  const plaque = useMemo(() => makeSignTexture(title, '#4f473c'), [title])
  useEffect(
    () => () => {
      texture.dispose()
      plaque.dispose()
    },
    [texture, plaque],
  )
  // 墙被剖面摘掉时画要一起藏，否则画浮在空气里
  const cut = useWallCut(side, box)
  return (
    // 画贴在墙上，不该被当成"挡视线的物体"淡出（以前从斜侧看它会闪成半透明）
    <group ref={cut} position={position} rotation={rotation} userData={{ noOcclude: true }}>
      {/* 画框整块都在墙面前。以前框体从墙面往里埋了一半，
          墙正好从画中间穿过去，斜着看就是"相框缺一块、在闪"。 */}
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[w + 0.16, h + 0.16, 0.07]} />
        <meshStandardMaterial color="#7c6a52" roughness={0.6} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0, 0.088]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {h > 1.1 && (
        <mesh position={[0, -h / 2 - 0.16, 0.04]}>
          <planeGeometry args={[Math.min(w, 0.9), 0.18]} />
          <meshBasicMaterial map={plaque} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/**
 * 画廊墙：在一段空墙里等距挂画。段长和幅数一起算，
 * 所以画永远落在墙内，既不会跨过隔墙，也不会互相叠住。
 */
function GalleryWall({
  box,
  side,
  a0,
  a1,
  art,
}: {
  box: RoomBox
  side: Side
  /** 这段空墙沿墙方向的起止（已扣掉洞口、隔墙和唱片机占位）。 */
  a0: number
  a1: number
  art: Art
}) {
  const usable = Math.max(0, a1 - a0)
  if (usable < 1.2) return null
  const count = Math.max(1, Math.min(4, Math.round(usable / 1.7)))
  const cell = usable / count
  const w = Math.min(1.5, cell * 0.7)
  const h = Math.min(1.9, w * 1.28)
  const y = Math.min(box.H - h / 2 - 0.45, 1.72)
  const frames = []
  for (let i = 0; i < count; i++) {
    const l = a0 + cell * (i + 0.5)
    const [x, z] = wallPoint(box, side, l, 0.03)
    frames.push(
      <Frame
        key={i}
        w={w}
        h={h}
        side={side}
        box={box}
        palette={i === 0 ? art.palette : VARIANTS[(i + VARIANTS.indexOf(art.palette)) % VARIANTS.length]}
        title={i === 0 ? art.title : `${art.title} · ${ORDINAL[i % ORDINAL.length]}`}
        position={[x, y, z]}
        rotation={[0, inwardYaw(side), 0]}
      />,
    )
  }
  return <group>{frames}</group>
}

/** 唱片机：木箱 + 转盘 + 唱臂。转盘只在放歌时转，指针用小角度摆动。 */
function RecordPlayer({ box, wall, on }: { box: RoomBox; wall: Wall; on: boolean }) {
  const l = wall.center - wall.len / 2 + 0.55
  const [x, z] = wallPoint(box, wall.side, l, 0.42)
  const platter = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!on) return
    if (platter.current) platter.current.rotation.y += delta * 2.1
    if (arm.current) arm.current.rotation.y = Math.PI / 2 + Math.sin(performance.now() / 900) * 0.02
  })

  return (
    <group position={[x, 0, z]} rotation={[0, inwardYaw(wall.side), 0]}>
      {/* 矮柜 */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.9, 0.56, 0.48]} />
        <meshStandardMaterial color="#6b5340" roughness={0.72} />
      </mesh>
      {/* 机箱 */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[0.64, 0.12, 0.46]} />
        <meshStandardMaterial color="#2f2a26" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* 转盘 */}
      <group ref={platter} position={[0, 0.695, 0]}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.022, 24]} />
          <meshStandardMaterial color="#151312" roughness={0.45} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.014, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.004, 20]} />
          <meshStandardMaterial color={on ? '#d8a25c' : '#8c7a63'} roughness={0.6} />
        </mesh>
      </group>
      {/* 唱臂 */}
      <group ref={arm} position={[0.24, 0.7, -0.12]}>
        <mesh position={[0, 0, 0.11]} rotation={[0, 0, 0.06]}>
          <boxGeometry args={[0.018, 0.018, 0.22]} />
          <meshStandardMaterial color="#c9c4bb" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      {/* 指示灯：放歌时亮 */}
      <mesh position={[0.26, 0.64, 0.2]}>
        <sphereGeometry args={[0.016, 8, 8]} />
        <meshStandardMaterial
          color={on ? '#ffcf7a' : '#4a463f'}
          emissive={on ? '#ffb347' : '#000000'}
          emissiveIntensity={on ? 2 : 0}
        />
      </mesh>
      {on && <pointLight position={[0, 0.9, 0.3]} color="#ffbe6b" intensity={0.7} distance={2.6} decay={2} />}
    </group>
  )
}

/** 望远镜：三脚架 + 镜筒，架在窗边。镜筒指向窗外。 */
function Telescope({ box, side, l }: { box: RoomBox; side: Side; l: number }) {
  const [x, z] = wallPoint(box, side, l, 0.85)
  const yaw = inwardYaw(side) + Math.PI
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.16, 0.5, Math.sin(a) * 0.16]} rotation={[0, -a, 0.16]} castShadow>
            <cylinderGeometry args={[0.018, 0.022, 1.05, 6]} />
            <meshStandardMaterial color="#8d8578" metalness={0.5} roughness={0.45} />
          </mesh>
        )
      })}
      <mesh position={[0, 1.06, 0]}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial color="#4c4941" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* 镜筒：沿 +z 指向窗外 */}
      <mesh position={[0, 1.22, 0.12]} rotation={[0.22, 0, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.088, 0.62, 14]} />
        <meshStandardMaterial color="#cfc7b6" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.29, 0.42]} rotation={[0.22, 0, 0]}>
        <cylinderGeometry args={[0.086, 0.086, 0.05, 14]} />
        <meshStandardMaterial color="#2c2f33" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.16, -0.18]} rotation={[0.22, 0, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.1, 10]} />
        <meshStandardMaterial color="#3a3d40" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** 私人影院：幕布 + 吊装投影仪。视频地址来自本地文件，不经过网络。 */
function CinemaScreen({
  box,
  wall,
  texture,
  playing,
}: {
  box: RoomBox
  wall: Wall
  texture: THREE.Texture | null
  playing: boolean
}) {
  const w = Math.min(3.6, Math.max(1.6, wall.len - 1.0))
  const h = w * 0.56
  const y = Math.min(box.H - h / 2 - 0.4, 1.58)
  const [x, z] = wallPoint(box, wall.side, wall.center, 0.05)
  const [px, pz] = wallPoint(box, wall.side, wall.center, 2.9)
  const cut = useWallCut(wall.side, box)
  return (
    <group ref={cut} userData={{ noOcclude: true }}>
      {/* 幕布框 */}
      <group position={[x, y, z]} rotation={[0, inwardYaw(wall.side), 0]}>
        <mesh position={[0, 0, 0.03]}>
          <boxGeometry args={[w + 0.12, h + 0.12, 0.05]} />
          <meshStandardMaterial color="#24262a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.075]}>
          <planeGeometry args={[w, h]} />
          {texture ? (
            <meshBasicMaterial map={texture} toneMapped={false} />
          ) : (
            <meshStandardMaterial color="#ded9d0" roughness={0.95} />
          )}
        </mesh>
      </group>
      {/* 吊装投影仪 */}
      <group position={[px, box.H - 0.32, pz]} rotation={[0, inwardYaw(wall.side) + Math.PI, 0]}>
        <mesh>
          <boxGeometry args={[0.34, 0.14, 0.28]} />
          <meshStandardMaterial color="#3c3f44" metalness={0.4} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.045, 0.045, 0.03, 12]} />
          <meshStandardMaterial
            color={playing ? '#fff1cf' : '#5f6368'}
            emissive={playing ? '#ffe0a8' : '#000000'}
            emissiveIntensity={playing ? 1.6 : 0}
          />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
          <meshStandardMaterial color="#55585c" metalness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

/** 露台花园：花箱、藤架、户外桌椅。阳台进深只有 1.8m，所以是"贴着栏板种一圈"。 */
function TerraceGarden({ box, bal }: { box: RoomBox; bal: BalconySpan }) {
  const far = WALL + BALCONY_OUT
  // 阳台长向沿墙、进深方向朝外。用 balconyRect 拿到整块矩形，按它排东西。
  const rect = balconyRect(box, bal)
  const along = bal.side === 'n' || bal.side === 's' ? 'x' : 'z'
  const len = along === 'x' ? rect.maxX - rect.minX : rect.maxZ - rect.minZ
  const depthMid =
    along === 'x'
      ? (rect.minZ + rect.maxZ) / 2
      : (rect.minX + rect.maxX) / 2
  const outSign = bal.side === 'n' || bal.side === 'w' ? -1 : 1

  // 花箱贴着玻璃栏板内侧一字排开，数量按长度取
  const planters = Math.max(2, Math.min(5, Math.round(len / 1.5)))
  const flowers = ['#d9818f', '#e8c46a', '#9d8fd0', '#e2a46a', '#8fbf8a']

  const items = []
  for (let i = 0; i < planters; i++) {
    const t = (i + 0.5) / planters
    const l = -len / 2 + len * t
    const x = along === 'x' ? l : depthMid
    const z = along === 'x' ? depthMid : l
    const towardRail = along === 'x' ? z + outSign * (far / 2 - 0.5) : x + outSign * (far / 2 - 0.5)
    items.push(
      <group key={`p${i}`} position={along === 'x' ? [x, 0, towardRail] : [towardRail, 0, z]}>
        <mesh position={[0, 0.16, 0]} castShadow>
          <boxGeometry args={[0.8, 0.32, 0.32]} />
          <meshStandardMaterial color="#6d5844" roughness={0.86} />
        </mesh>
        <mesh position={[0, 0.33, 0]}>
          <boxGeometry args={[0.72, 0.03, 0.26]} />
          <meshStandardMaterial color="#4a3c2e" roughness={0.95} />
        </mesh>
        {[-0.24, 0, 0.24].map((ox, k) => (
          <group key={k} position={[ox, 0.34, 0]}>
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.012, 0.014, 0.2, 5]} />
              <meshStandardMaterial color="#59763f" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.24, 0]}>
              <icosahedronGeometry args={[0.075, 0]} />
              <meshStandardMaterial color={flowers[(i + k) % flowers.length]} roughness={0.85} />
            </mesh>
          </group>
        ))}
      </group>,
    )
  }

  // 藤架：两根立柱 + 顶上几根格栅，从阳台内侧伸到栏板
  const pergolaL = Math.max(1.2, len * 0.55)
  items.push(
    <group key="pergola" position={along === 'x' ? [-len * 0.18, 0, depthMid] : [depthMid, 0, -len * 0.18]}>
      {[-pergolaL / 2, pergolaL / 2].map((o, i) => (
        <mesh
          key={i}
          position={along === 'x' ? [o, 1.15, 0] : [0, 1.15, o]}
          castShadow
        >
          <boxGeometry args={[0.07, 2.3, 0.07]} />
          <meshStandardMaterial color="#6a533c" roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0, 2.32, 0]} rotation={[0, along === 'x' ? 0 : Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[pergolaL, 0.06, far * 0.8]} />
        <meshStandardMaterial color="#7a6047" roughness={0.85} transparent opacity={0.92} />
      </mesh>
      {/* 藤架上的灯串 */}
      {[-0.4, 0, 0.4].map((t, i) => (
        <mesh key={`l${i}`} position={[along === 'x' ? pergolaL * t : 0, 2.2, along === 'x' ? 0 : pergolaL * t]}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshStandardMaterial color="#ffd9a0" emissive="#ffbc66" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      ))}
    </group>,
  )

  // 户外桌椅：两把椅子 + 一张圆桌，塞在阳台另一头
  items.push(
    <group
      key="table"
      position={along === 'x' ? [len * 0.26, 0, depthMid] : [depthMid, 0, len * 0.26]}
    >
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 16]} />
        <meshStandardMaterial color="#8f7a5e" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.36, 8]} />
        <meshStandardMaterial color="#5d4b37" roughness={0.7} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.55, 0, 0]} rotation={[0, -s * Math.PI * 0.5, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[0.4, 0.05, 0.4]} />
            <meshStandardMaterial color="#7a6a52" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.44, -0.17]} castShadow>
            <boxGeometry args={[0.4, 0.42, 0.05]} />
            <meshStandardMaterial color="#7a6a52" roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>,
  )

  return (
    <group>
      {items}
      <pointLight
        position={[0, 2.1, 0]}
        color="#ffcb85"
        intensity={0.9}
        distance={Math.max(3, len + 1)}
        decay={2}
      />
    </group>
  )
}


function TerraceLights({ box, side, a0, a1 }: { box: RoomBox; side: Side; a0: number; a1: number }) {
  const { bulbs, center } = useMemo(() => {
    const out: Array<[number, number, number]> = []
    const count = Math.max(6, Math.round(Math.abs(a1 - a0) / 0.55))
    for (let i = 0; i <= count; i++) {
      const t = i / count
      const a = a0 + (a1 - a0) * t
      const [x, z] = wallPoint(box, side, a, 2.35)
      out.push([x, 2.55 + Math.sin(t * Math.PI) * -0.22, z])
    }
    const [cx, cz] = wallPoint(box, side, (a0 + a1) / 2, 1.9)
    return { bulbs: out, center: [cx, 2.5, cz] as [number, number, number] }
  }, [box, side, a0, a1])
  return (
    <group>
      {bulbs.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#ffd8a0" emissive="#ffbb63" emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={center} color="#ffc078" intensity={1.3} distance={6} decay={2} />
    </group>
  )
}

type HomeFeatureScene = {
  nodes: ReactNode
  interactables: Interactable[]
}

/**
 * 把这一户的设施铺进房间。返回的交互点直接并进 SpaceRoom 那张表。
 */
export function useHomeFeatures(
  plan: UnitRoomPlan | null,
  devices: HomeDevices,
  art: Art,
  /** 这户的 id：灯牌文字、软装顺序都从它派生，同尺寸的两户才不会长得一样。 */
  seed = '',
): HomeFeatureScene {
  // 唱片机开关：房间级的临时状态，不写服务端——访客也各听各的。
  const [recordOn, setRecordOn] = useState(false)
  // 影院：本地视频文件。地址是 blob:，离开房间就释放。
  const movie = useRef<{ video: HTMLVideoElement | null; texture: THREE.VideoTexture | null }>({
    video: null,
    texture: null,
  })
  const [movieTick, setMovieTick] = useState(0)
  const [playing, setPlaying] = useState(false)

  // 离开房间时停机：不然音乐和视频会跟到街上。
  useEffect(
    () => () => {
      record.stop()
      const m = movie.current
      if (m.video) {
        m.video.pause()
        m.video.src = ''
        m.video = null
      }
      m.texture?.dispose()
      m.texture = null
      // 视频和唱片都可能压过 BGM，退出时按用户偏好恢复
      music.setMuted(!useApp.getState().musicOn)
    },
    [],
  )

  // 走路就退出望远镜：观景是站定了看的，一迈步就该放手。
  useFrame(() => {
    if (scope.active && walker.speed > 0.35) leaveScope()
  })

  const walls = useMemo(() => (plan ? blankWalls(plan) : []), [plan])
  const windowWall = useMemo(() => {
    if (!plan) return null
    const hit = plan.openings.find((o) => o.kind === 'window')
    if (!hit) return null
    return { side: hit.side, l: (hit.l0 + hit.l1) / 2 }
  }, [plan])

  const nodes: ReactNode[] = []
  const interactables: Interactable[] = []
  /** 已经被占掉的墙段：软装要避开它们，否则灯牌会压在画上。 */
  const usedWalls: WallSpan[] = []
  if (!plan) return { nodes: null, interactables }

  const box = plan.box
  const has = (id: HomeFeature) => devices.list.includes(id)

  // 画廊墙占最长的那段空墙；影院占第二段（只有一段时不硬塞，免得两块叠在一起）
  const galleryWall = has('gallery-wall') ? walls[0] ?? null : null
  const cinemaWall = has('cinema') ? walls[has('gallery-wall') ? 1 : 0] ?? null : null
  // 唱片机尽量另找一段墙；只有一段时挪到画廊墙的最左端，把画往右让
  const recordWall = has('record-player') ? walls[1] ?? walls[0] ?? null : null
  const recordOnGallery = Boolean(recordWall && galleryWall && recordWall.side === galleryWall.side && recordWall.center === galleryWall.center)

  if (galleryWall) {
    // 段内留 0.25 的边距；唱片机在同一段时再让出 1m
    const pad = 0.25
    const a0 = galleryWall.center - galleryWall.len / 2 + pad + (recordOnGallery ? 1 : 0)
    const a1 = galleryWall.center + galleryWall.len / 2 - pad
    nodes.push(
      <GalleryWall key="gallery" box={box} side={galleryWall.side} a0={a0} a1={a1} art={art} />,
    )
    usedWalls.push({ side: galleryWall.side, a0: a0 - 0.2, a1: a1 + 0.2 })
    const mid = (a0 + a1) / 2
    interactables.push({
      id: 'home-gallery',
      label: '画廊墙',
      hint: `${ORDINAL.length} 幅画 · 房主挑的`,
      x: wallPoint(box, galleryWall.side, mid, 0.9)[0],
      z: wallPoint(box, galleryWall.side, mid, 0.9)[1],
      radius: Math.min(3.2, Math.max(1.2, (a1 - a0) * 0.5)),
      action: () =>
        useApp
          .getState()
          .showToast(`《${art.title}》和另外几幅挂在同一面墙上，都是房主挑的。`),
    })
  }

  if (has('record-player') && recordWall) {
    nodes.push(<RecordPlayer key="record" box={box} wall={recordWall} on={recordOn} />)
    const rl = recordWall.center - recordWall.len / 2 + 0.55
    usedWalls.push({ side: recordWall.side, a0: rl - 0.8, a1: rl + 0.8 })
    const [rx, rz] = wallPoint(box, recordWall.side, recordWall.center - recordWall.len / 2 + 0.55, 1.0)
    interactables.push({
      id: 'home-record',
      label: recordOn ? '唱片机 · 正在放' : '唱片机',
      hint: recordOn ? '按 E 停下' : '按 E 放一张唱片',
      x: rx,
      z: rz,
      radius: 2.0,
      action: () => {
        const on = record.toggle()
        setRecordOn(on)
      },
    })
  }

  if (has('telescope') && windowWall) {
    nodes.push(
      <Telescope key="scope" box={box} side={windowWall.side} l={windowWall.l} />,
    )
    const [tx, tz] = wallPoint(box, windowWall.side, windowWall.l, 1.1)
    // 窗外 140m 处的一个点：抬高一点看向天际线，而不是盯着楼下的马路
    const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[windowWall.side]
    interactables.push({
      id: 'home-scope',
      label: '望远镜',
      hint: scope.active ? '按 E 松开' : '按 E 看看远处',
      x: tx,
      z: tz,
      radius: 1.7,
      action: () => {
        if (scope.active) {
          leaveScope()
          return
        }
        enterScope(tx + out[0] * 140, 26, tz + out[1] * 140)
      },
    })
  }

  if (cinemaWall) {
    const m = movie.current
    const screenW = Math.min(3.6, Math.max(1.6, cinemaWall.len - 1.0))
    usedWalls.push({
      side: cinemaWall.side,
      a0: cinemaWall.center - screenW / 2 - 0.25,
      a1: cinemaWall.center + screenW / 2 + 0.25,
    })
    nodes.push(
      <CinemaScreen
        key={`cinema-${movieTick}`}
        box={box}
        wall={cinemaWall}
        texture={m.texture}
        playing={playing}
      />,
    )
    const [cx, cz] = wallPoint(box, cinemaWall.side, cinemaWall.center, 1.5)
    interactables.push({
      id: 'home-cinema',
      label: playing ? '私人影院 · 放映中' : m.video ? '私人影院' : '私人影院 · 放入片子',
      hint: m.video ? (playing ? '按 E 暂停' : '按 E 继续放') : '选一个本地视频，文件不离开你的电脑',
      x: cx,
      z: cz,
      radius: 2.4,
      action: () => {
        const video = movie.current.video
        if (video) {
          if (video.paused) {
            void video.play()
            setPlaying(true)
            music.setMuted(true)
          } else {
            video.pause()
            setPlaying(false)
            music.setMuted(!useApp.getState().musicOn)
          }
          return
        }
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'video/*'
        input.onchange = () => {
          const file = input.files?.[0]
          if (!file) return
          const url = URL.createObjectURL(file)
          const v = document.createElement('video')
          v.src = url
          v.loop = true
          v.playsInline = true
          v.muted = false
          const texture = new THREE.VideoTexture(v)
          texture.colorSpace = THREE.SRGBColorSpace
          movie.current = { video: v, texture }
          void v
            .play()
            .then(() => {
              setPlaying(true)
              music.setMuted(true)
            })
            .catch(() => setPlaying(false))
          setMovieTick((n) => n + 1)
        }
        input.click()
      },
    })
  }

  if (devices.terrace && plan.bal) {
    nodes.push(
      <TerraceLights key="terrace" box={box} side={plan.bal.side} a0={plan.bal.a0} a1={plan.bal.a1} />,
    )
  }

  if (devices.garden && plan.bal) {
    nodes.push(<TerraceGarden key="garden" box={box} bal={plan.bal} />)
    // 花园的交互点放在阳台中央：站在门口就能触发，不用挤到栏板边
    const [gx, gz] = wallPoint(box, plan.bal.side, (plan.bal.a0 + plan.bal.a1) / 2, -(WALL + 0.7))
    interactables.push({
      id: 'home-garden',
      label: '露台花园',
      hint: '花箱、藤架和户外桌椅 · 宠物会来晒太阳',
      x: gx,
      z: gz,
      radius: 2.2,
      action: () =>
        useApp
          .getState()
          .showToast('露台花园：底商的屋顶归 2 楼住户用。花箱是房主自己摆的，宠物喜欢在藤架下打盹。'),
    })
  }

  // 挂画（ArtFrame 是 2.5m 宽）和留言台 / 布置台也贴着墙，软装得避开它们。
  if (plan.art) usedWalls.push(spanOf(box, [plan.art.position[0], plan.art.position[2]], 1.45))
  usedWalls.push(spanOf(box, plan.guest, 0.8))
  usedWalls.push(spanOf(box, plan.console, 0.8))

  // 剩下的空墙铺墙面软装：玻璃隔断带 / 白板 / 发光灯牌，一段一件轮换。
  nodes.push(...wallDecor(box, walls, usedWalls, seed))

  // movieTick 只是为了让纹理换上去之后重渲染一次
  return { nodes: <>{nodes}</>, interactables }
}
