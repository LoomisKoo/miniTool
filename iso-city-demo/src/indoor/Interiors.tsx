import { Suspense, useEffect, useMemo, useRef } from 'react'
import { barista } from '../data/npcs'
import { NpcFigure } from '../scene/Npcs'
import { NoticeBoard } from '../scene/NoticeBoard'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useApp } from '../store'
import { openPetDialog } from '../pets/interact'
import type { SpaceDetail } from '../types'
import { cafeInterior, galleryInterior, roomInterior } from '../data/city'
import { isUnitSpaceId, unitMetaOfSpace, unitPlanOfSpace, unitSpaceTemplate, ROOF_FLOOR } from '../data/units'
import { FurnitureMesh, FURNITURE_META } from './Furniture'
import { PlayerRig, type Collider, type Interactable } from '../scene/PlayerRig'
import { Marker } from '../scene/Markers'
import { makeArtTexture, makeFloorTexture, makeSignTexture, makeWallTexture } from '../scene/textures'
import { palettes } from '../scene/theme'
import { ImageBasedLighting } from '../scene/lighting'
import { makeConcreteMaps } from '../scene/pbr'
import { BuildingInterior } from './BuildingInterior'
import { RoofDeck } from './RoofDeck'
import { ShopRoom } from './ShopRoom'
import { CityBackdrop } from './CityBackdrop'
import { Balcony, CeilingPendant, ClosedDoor, PartitionWalls, RoomWalls, balconyRect, roomBounds, roomBox, roomColliders, sideOfPoint, useWallCut, type LocalOpening } from './RoomKit'
import { INDOOR_STYLE, deepen, floorTone, wallTone } from './style'
import { useUnitRoomPlan } from './UnitRoom'
import { HomePets, homePetLive, homeSpots } from './HomePets'
import { useHomeFeatures } from './Features'
import { homeDevices } from '../data/features'
import { HUNGRY_AT } from '../pets/hunger'
import { fitFurniture, footprint } from './placement'

/** 楼内户的兜底尺寸：正常情况下由楼体平面正推（floorPlanOf），这里只防详情缺失。 */
const unitInterior = {
  width: 12.6,
  depth: 9.8,
  height: 3.1,
  start: [0, 2.0] as [number, number],
}

/** 阳台进深：住宅阳台做成 1.8m，楼壳上每层都有同一条堆叠的阳台带。 */
const BALCONY_DEPTH = 1.8

function RoomShell({
  width,
  depth,
  height,
  wall,
  floor,
  editing,
  onFloorClick,
  window = 'normal',
  balcony = false,
  balconyWidth,
  solidDoor = false,
}: {
  width: number
  depth: number
  height: number
  wall: string
  floor: string
  editing?: boolean
  onFloorClick?: (x: number, z: number) => void
  window?: 'normal' | 'clerestory' | 'none'
  balcony?: boolean
  /** 阳台板宽度：必须等于楼体上这一户的开间，才能和外立面的那一格严丝合缝。 */
  balconyWidth?: number
  /** 户型入户门：关着的深色门，避免从门洞直接看到楼外天空。 */
  solidDoor?: boolean
}) {
  // 入户门按真实尺寸：结构洞口 1.5 × 2.35，门扇 1.24 宽、2.24 高，
  // 和走廊那扇门是同一套数（以前这里是 2.6 × 2.7 的双开门，
  // 站在 6m 宽的房间里看像仓库大门，也把房间衬得特别小）。
  const doorWidth = 1.5
  const doorHeight = 2.35
  const leafWidth = 1.24
  const sideWidth = (width - doorWidth) / 2
  const windowWidth = Math.max(1.6, Math.min(width - 0.9, 7.2))
  // 和街面立面的洞口对齐：窗台 0.04、洞口高 2.45（bayFacadeOf 里的同一组数）
  const windowHeight = Math.min(height - 0.4, 2.45)
  const windowY = 0.04 + windowHeight / 2
  const balconyOpenWidth = Math.max(2.4, width - 0.9)
  const balconyOpenHeight = Math.min(height - 0.55, 2.45)
  const balconySideWidth = Math.max(0.5, (width - balconyOpenWidth) / 2)
  // 阳台板按开间做满：外立面每户一格，本户那一格由这里收口，
  // 板窄一截就会在阳台边上露一条缝。
  const slabWidth = balconyWidth ?? width - 1.2

  // 纯色地板/墙面在近景里非常"塑料"，加一层低对比的程序化纹理
  // （木拼板 + 涂料颗粒），只改观感，不增加几何。
  const floorMap = useMemo(() => {
    const tex = makeFloorTexture(floor, deepen(floor, 0.34))
    tex.repeat.set(Math.max(2.4, width / 2.4), Math.max(2.4, depth / 2.4))
    return tex
  }, [floor, width, depth])
  useEffect(() => () => floorMap.dispose(), [floorMap])

  const wallMap = useMemo(() => {
    const tex = makeWallTexture(wall)
    tex.repeat.set(Math.max(1, width / 3.2), Math.max(1, height / 3.2))
    return tex
  }, [wall, width, height])
  useEffect(() => () => wallMap.dispose(), [wallMap])

  // 抹灰墙的细颗粒：近距离看墙不再是"一张纯色纸"，掠射光会扫出一层很轻的
  // 起伏。整间房只加一张 256 的法线贴图，成本可以忽略。
  const wallPbr = useMemo(() => makeConcreteMaps(0.5), [])
  useEffect(() => () => wallPbr.dispose(), [wallPbr])
  useEffect(() => {
    wallPbr.normalMap.repeat.set(Math.max(1, width / 3.2), Math.max(1, height / 3.2))
    wallPbr.roughnessMap.repeat.set(Math.max(1, width / 3.2), Math.max(1, height / 3.2))
  }, [wallPbr, width, height])

  const wallMat = (
    <meshStandardMaterial
      map={wallMap}
      color="#ffffff"
      roughness={0.94}
      normalMap={wallPbr.normalMap}
      normalScale={new THREE.Vector2(0.45, 0.45)}
      side={THREE.DoubleSide}
    />
  )

  // 剖面：和 RoomWalls 用同一套规则——只留镜头对面那两面墙。
  // RoomShell 是手工搭的方盒子（展厅、咖啡馆），以前四面墙加吊顶全画，
  // iso 机位拉远之后近处的墙和整块天花板就直接糊在画面上。
  const shell = useMemo(() => ({ W: width, D: depth, H: height, cx: 0, cz: 0 }), [width, depth, height])
  const cutN = useWallCut('n', shell)
  const cutN2 = useWallCut('n', shell)
  const cutN3 = useWallCut('n', shell)
  const cutS = useWallCut('s', shell)
  const cutW = useWallCut('w', shell)
  const cutE = useWallCut('e', shell)
  const ceilingRef = useRef<THREE.Group>(null)
  const ceilingInnerRef = useRef<THREE.Mesh>(null)
  useFrame(({ camera }) => {
    const show = camera.position.y < height - 0.15
    if (ceilingRef.current) ceilingRef.current.visible = show
    if (ceilingInnerRef.current) ceilingInnerRef.current.visible = show
  })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          map={floorMap}
          color="#ffffff"
          roughness={0.52}
          metalness={0.04}
          envMapIntensity={0.7}
        />
      </mesh>

      {/* 踢脚线只在下面有一段（靠门那一侧），这里不再画第二条：
          两套踢脚线都在同一面墙上时，外表面会贴着墙面共面，走两步就闪。 */}
      <group ref={ceilingRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
          <planeGeometry args={[width, depth]} />
          {/* 天花板必须双面：镜头被推高到天花板以上时，单面朝下的平面会被背面剔除，
              于是从外面直接看进房间内部（就是那张"房间悬在一片窗户中间"的截图）。 */}
          <meshStandardMaterial color={INDOOR_STYLE.ceiling} roughness={0.94} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 北墙不能整面铺死：
          有阳台时中间是推拉门洞，普通房间中间是窗洞。
          之前这里无条件铺了一整面墙，于是阳台和窗外的城市全被挡在墙后，
          只能从文案里读到"阳台能看见城市的立面"。 */}
      <group ref={cutN}>
      {balcony ? null : window === 'normal' ? (
        <>
          {[
            {
              pos: [-((width + windowWidth) / 4), height / 2, -depth / 2] as [number, number, number],
              size: [(width - windowWidth) / 2, height] as const,
            },
            {
              pos: [(width + windowWidth) / 4, height / 2, -depth / 2] as [number, number, number],
              size: [(width - windowWidth) / 2, height] as const,
            },
            {
              pos: [0, (windowY - windowHeight / 2) / 2, -depth / 2] as [number, number, number],
              size: [windowWidth, windowY - windowHeight / 2] as const,
            },
            {
              pos: [0, (windowY + windowHeight / 2 + height) / 2, -depth / 2] as [number, number, number],
              size: [windowWidth, height - windowY - windowHeight / 2] as const,
            },
          ].map((piece, i) => (
            <mesh key={`nw${i}`} position={piece.pos}>
              <planeGeometry args={[piece.size[0], piece.size[1]]} />
              {wallMat}
            </mesh>
          ))}
        </>
      ) : (
        <mesh position={[0, height / 2, -depth / 2]}>
          <planeGeometry args={[width, height]} />
          {wallMat}
        </mesh>
      )}
      {balcony && (
        <group>
          {/* 北墙给阳台留一个推拉门洞 */}
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              position={[s * (balconyOpenWidth / 2 + balconySideWidth / 2), height / 2, -depth / 2]}
            >
              <planeGeometry args={[balconySideWidth, height]} />
              {wallMat}
            </mesh>
          ))}
          <mesh position={[0, balconyOpenHeight + (height - balconyOpenHeight) / 2, -depth / 2]}>
            <planeGeometry args={[balconyOpenWidth, height - balconyOpenHeight]} />
            {wallMat}
          </mesh>

          {/* 推拉门框 */}
          {[-balconyOpenWidth / 2, 0, balconyOpenWidth / 2].map((x) => (
            <mesh key={x} position={[x, balconyOpenHeight / 2, -depth / 2 + 0.03]}>
              <boxGeometry args={[0.07, balconyOpenHeight, 0.09]} />
              <meshStandardMaterial color={INDOOR_STYLE.frame} roughness={0.32} metalness={0.62} envMapIntensity={1.1} />
            </mesh>
          ))}
          <mesh position={[0, balconyOpenHeight, -depth / 2 + 0.03]}>
            <boxGeometry args={[balconyOpenWidth + 0.14, 0.08, 0.09]} />
            <meshStandardMaterial color={INDOOR_STYLE.frame} roughness={0.32} metalness={0.62} envMapIntensity={1.1} />
          </mesh>

          {/* 推拉玻璃门：一扇常开，滑在左侧；门洞右半边直通阳台。
              不做"按 E 开门"——门本来就开着，挡一道交互只会多一次按键。 */}
          <mesh position={[-balconyOpenWidth / 2 - balconyOpenWidth / 4 + 0.04, balconyOpenHeight / 2, -depth / 2 - 0.08]}>
            <planeGeometry args={[balconyOpenWidth / 2 - 0.06, balconyOpenHeight - 0.08]} />
            <meshStandardMaterial
              color={INDOOR_STYLE.glass}
              transparent
              opacity={0.12}
              roughness={0.03}
              metalness={0.62}
              envMapIntensity={1.4}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* 阳台楼板、压边和栏杆 */}
          <mesh position={[0, -0.06, -depth / 2 - BALCONY_DEPTH / 2]} receiveShadow>
            <boxGeometry args={[slabWidth, 0.12, BALCONY_DEPTH]} />
            <meshStandardMaterial color="#c9bda9" roughness={0.78} metalness={0.05} envMapIntensity={0.7} />
          </mesh>
          <mesh position={[0, -0.14, -depth / 2 - BALCONY_DEPTH / 2]}>
            <boxGeometry args={[slabWidth - 0.1, 0.1, BALCONY_DEPTH + 0.1]} />
            <meshStandardMaterial color="#7e7466" roughness={0.8} />
          </mesh>

          {[
            { pos: [0, 1.03, -depth / 2 - BALCONY_DEPTH + 0.05] as [number, number, number], size: [slabWidth, 0.07, 0.07] as const },
            { pos: [-slabWidth / 2, 1.03, -depth / 2 - BALCONY_DEPTH / 2] as [number, number, number], size: [0.07, 0.07, BALCONY_DEPTH] as const },
            { pos: [slabWidth / 2, 1.03, -depth / 2 - BALCONY_DEPTH / 2] as [number, number, number], size: [0.07, 0.07, BALCONY_DEPTH] as const },
          ].map((rail, i) => (
            <mesh key={i} position={rail.pos}>
              <boxGeometry args={[rail.size[0], rail.size[1], rail.size[2]]} />
              <meshStandardMaterial color={INDOOR_STYLE.frame} roughness={0.3} metalness={0.66} envMapIntensity={1.1} />
            </mesh>
          ))}

          {/* 栏杆竖杆：外沿与两侧 */}
          {Array.from({ length: 16 }).map((_, i) => {
            const span = slabWidth - 0.3
            const x = -span / 2 + (span / 15) * i
            return (
              <mesh key={`f${i}`} position={[x, 0.55, -depth / 2 - BALCONY_DEPTH + 0.05]}>
                <boxGeometry args={[0.035, 0.96, 0.035]} />
                <meshStandardMaterial color="#8e9ba3" roughness={0.4} metalness={0.5} />
              </mesh>
            )
          })}
          {[-1, 1].map((s) =>
            Array.from({ length: 7 }).map((_, i) => {
              const z = -depth / 2 - 0.2 - ((BALCONY_DEPTH - 0.3) / 6) * i
              return (
                <mesh key={`s${s}-${i}`} position={[s * slabWidth / 2, 0.55, z]}>
                  <boxGeometry args={[0.035, 0.96, 0.035]} />
                  <meshStandardMaterial color="#8e9ba3" roughness={0.4} metalness={0.5} />
                </mesh>
              )
            }),
          )}

          {/* 阳台绿植 */}
          {[-1, 1].map((s) => (
            <group key={`p${s}`} position={[s * (slabWidth / 2 - 0.55), 0.12, -depth / 2 - 0.55]}>
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
      )}
      </group>
      <group ref={cutW}>
        <mesh position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[depth, height]} />
          {wallMat}
        </mesh>
      </group>
      <group ref={cutE}>
        <mesh position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[depth, height]} />
          {wallMat}
        </mesh>
      </group>

      {/* 南墙留出门洞，不参与渲染的部分用侧墙和门楣补齐 */}
      <group ref={cutS}>
      <mesh position={[-(doorWidth + sideWidth) / 2, height / 2, depth / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[sideWidth, height]} />
        {wallMat}
      </mesh>
      <mesh position={[(doorWidth + sideWidth) / 2, height / 2, depth / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[sideWidth, height]} />
        {wallMat}
      </mesh>
      <mesh position={[0, doorHeight + (height - doorHeight) / 2, depth / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[doorWidth, height - doorHeight]} />
        {wallMat}
      </mesh>

      {[
        [-doorWidth / 2 - 0.06, doorHeight / 2, depth / 2 - 0.04, 0.12, doorHeight, 0.12],
        [doorWidth / 2 + 0.06, doorHeight / 2, depth / 2 - 0.04, 0.12, doorHeight, 0.12],
        [0, doorHeight + 0.06, depth / 2 - 0.04, doorWidth + 0.24, 0.12, 0.12],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#6a5c4b" roughness={0.75} />
        </mesh>
      ))}
      {solidDoor ? (
        <group position={[0, 0, depth / 2 + 0.04]}>
          {/* 门套内衬：门扇比洞口窄，两侧用 0.13 的门框填平，不会漏一条缝 */}
          {[-1, 1].map((s) => (
            <mesh
              key={`jamb${s}`}
              position={[s * (leafWidth / 2 + (doorWidth - leafWidth) / 4), doorHeight / 2, 0]}
            >
              <boxGeometry args={[(doorWidth - leafWidth) / 2, doorHeight - 0.04, 0.1]} />
              <meshStandardMaterial color="#6a5c4b" roughness={0.75} />
            </mesh>
          ))}
          <mesh position={[0, doorHeight / 2, 0]} castShadow>
            <boxGeometry args={[leafWidth, doorHeight - 0.06, 0.08]} />
            <meshStandardMaterial color="#5f5142" roughness={0.72} metalness={0.04} />
          </mesh>
          {[0.72, 1.72].map((y) => (
            <mesh key={y} position={[0, y, -0.05]}>
              <boxGeometry args={[leafWidth - 0.34, 0.58, 0.018]} />
              <meshStandardMaterial color="#6b5b4a" roughness={0.8} />
            </mesh>
          ))}
          <mesh position={[leafWidth / 2 - 0.15, 1.02, -0.08]}>
            <boxGeometry args={[0.05, 0.18, 0.05]} />
            <meshStandardMaterial color="#c9b68f" metalness={0.65} roughness={0.28} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, doorHeight / 2, depth / 2 + 0.02]}>
          <planeGeometry args={[doorWidth, doorHeight]} />
          <meshBasicMaterial color="#d8b47c" transparent opacity={0.45} toneMapped={false} />
        </mesh>
      )}
      </group>

      {/* 踢脚线跟着各自的墙走：剖掉的那两面不留一条浮在半空的贴边 */}
      <group ref={cutW}>
        <mesh position={[-width / 2 + 0.045, 0.08, 0]}>
          <boxGeometry args={[0.08, 0.16, depth]} />
          <meshStandardMaterial color="#b9ad9b" roughness={0.8} />
        </mesh>
      </group>
      <group ref={cutE}>
        <mesh position={[width / 2 - 0.045, 0.08, 0]}>
          <boxGeometry args={[0.08, 0.16, depth]} />
          <meshStandardMaterial color="#b9ad9b" roughness={0.8} />
        </mesh>
      </group>

      {!balcony && (
        <group ref={cutN3} position={[0, windowY, -depth / 2 + 0.03]}>
          {/* 窗框是四根边框，不再用一块板压在洞口上：
              中间必须是通的，窗后才看得见楼下这条街。 */}
          {[
            { pos: [0, windowHeight / 2 + 0.06, 0] as const, size: [windowWidth + 0.24, 0.12] as const },
            { pos: [0, -windowHeight / 2 - 0.06, 0] as const, size: [windowWidth + 0.24, 0.12] as const },
            { pos: [-(windowWidth + 0.12) / 2, 0, 0] as const, size: [0.12, windowHeight] as const },
            { pos: [(windowWidth + 0.12) / 2, 0, 0] as const, size: [0.12, windowHeight] as const },
          ].map((frame, i) => (
            <mesh key={`wf${i}`} position={[frame.pos[0], frame.pos[1], frame.pos[2]]}>
              <boxGeometry args={[frame.size[0], frame.size[1], 0.1]} />
              <meshStandardMaterial color="#8f846f" roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[windowWidth, windowHeight]} />
            <meshStandardMaterial
              color="#cfe1e8"
              transparent
              opacity={0.1}
              roughness={0.06}
              metalness={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
          {[-windowWidth / 4, 0, windowWidth / 4].map((x) => (
            <mesh key={x} position={[x, 0, 0.05]}>
              <boxGeometry args={[0.05, windowHeight, 0.04]} />
              <meshStandardMaterial color="#8f846f" roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[windowWidth, 0.05, 0.04]} />
            <meshStandardMaterial color="#8f846f" roughness={0.7} />
          </mesh>
          <mesh position={[0, -windowHeight / 2 - 0.13, 0.16]}>
            <boxGeometry args={[windowWidth + 0.36, 0.1, 0.3]} />
            <meshStandardMaterial color="#c8bca8" roughness={0.8} />
          </mesh>
        </group>
      )}

      {!balcony && window === 'clerestory' && (
        <group ref={cutN2}>
          {[-width * 0.3, -width * 0.1, width * 0.1, width * 0.3].map((x) => (
            <mesh key={x} position={[x, height - 1.45, -depth / 2 + 0.04]}>
              <planeGeometry args={[2.2, 1.9]} />
              <meshBasicMaterial color="#eef3ed" toneMapped={false} />
            </mesh>
          ))}
        </group>
      )}

      {/* 里层吊顶压在主吊顶下面 2cm，也只在天花板可见时才画：
          以前它无条件渲染，iso 机位一拉高，它就是一块白板盖住整间房。 */}
      <mesh ref={ceilingInnerRef} position={[0, height - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 1, depth - 1]} />
        <meshStandardMaterial color={INDOOR_STYLE.ceiling} roughness={1} />
      </mesh>

      {editing && (
        <>
          <gridHelper args={[Math.min(width, depth) - 0.5, 14, '#a49174', '#c0b29a']} position={[0, 0.03, 0]} />
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.045, 0]}
            onClick={(event) => {
              event.stopPropagation()
              onFloorClick?.(event.point.x, event.point.z)
            }}
          >
            <planeGeometry args={[width - 1.1, depth - 1.1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  )
}

function ArtFrame({
  palette,
  title,
  position,
  rotation,
}: {
  palette: string
  title: string
  position: [number, number, number]
  rotation: [number, number, number]
}) {
  const texture = useMemo(() => makeArtTexture(palette, 1), [palette])
  const plaque = useMemo(() => makeSignTexture(title, '#5a5144'), [title])
  // 画挂在墙上，墙被剖掉时画也得跟着消失，否则一整幅 2.5m 的画会浮在房间前面
  const cut = useWallCut(sideOfPoint(position[0], position[2]))
  return (
    <group ref={cut} position={position} rotation={rotation} userData={{ noOcclude: true }}>
      {/* 整块都在墙面前：框体往墙里埋半截，会被墙面从中间切过去 */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[2.5, 3.1, 0.09]} />
        <meshStandardMaterial color="#8d7757" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.11]}>
        <planeGeometry args={[2.2, 2.8]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.75, 0.03]}>
        <planeGeometry args={[1.35, 0.34]} />
        <meshBasicMaterial map={plaque} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.4, 1.5]} color="#ffe3ba" intensity={2.2} distance={5} decay={2} />
    </group>
  )
}

function GalleryContent() {
  const openPlace = useApp((state) => state.openPlace)
  const enterTarget = useApp((state) => state.enterTarget)
  const exitCity = useApp((state) => state.exitCity)
  const placeDetail = useApp((state) => state.placeDetail)
  const posts = placeDetail?.place.id === 'gallery-lobby' ? placeDetail.posts : []

  const bounds = useMemo(
    () => ({
      minX: -galleryInterior.width / 2 + 0.65,
      maxX: galleryInterior.width / 2 - 0.65,
      minZ: -galleryInterior.depth / 2 + 0.65,
      maxZ: galleryInterior.depth / 2 - 0.65,
    }),
    [],
  )
  const colliders = useMemo<Collider[]>(
    () =>
      [
        { minX: -13, maxX: -12.6, minZ: -8, maxZ: 8 },
        { minX: 12.6, maxX: 13, minZ: -8, maxZ: 8 },
        { minX: -13, maxX: 13, minZ: -8.3, maxZ: -7.9 },
        { minX: -13, maxX: 13, minZ: 7.9, maxZ: 8.3 },
      ].map((c) => ({ ...c, minY: 0, maxY: 7, walk: false })),
    [],
  )
  const interactables = useMemo<Interactable[]>(
    () => [
      {
        id: 'gallery-exit',
        label: '返回主街',
        hint: '离开光盒美术馆',
        x: 0,
        z: galleryInterior.depth / 2 - 0.6,
        radius: 2.2,
        action: exitCity,
      },
      {
        id: 'gallery-kiosk',
        label: '城市留言台',
        hint: '阅读与发布地点留言',
        x: 5.4,
        z: 5.1,
        radius: 3.1,
        action: () => openPlace('gallery-lobby'),
      },
      {
        id: 'gallery-upstairs',
        label: '二楼 · 光箱展厅',
        hint: '进入个人展厅',
        x: 11.6,
        z: -3,
        radius: 3.0,
        action: () => enterTarget({ kind: 'space', id: 'light-gallery' }, '光箱展厅'),
      },
    ],
    [exitCity, openPlace, enterTarget],
  )

  return (
    <group>
      <RoomShell
        width={galleryInterior.width}
        depth={galleryInterior.depth}
        height={galleryInterior.height}
        wall="#f1ece3"
        floor="#c9b79f"
        window="clerestory"
      />
      <ArtFrame palette="coast" title="低处的云 01" position={[-12.7, 3.0, -1.7]} rotation={[0, Math.PI / 2, 0]} />
      <ArtFrame palette="dawn" title="低处的云 02" position={[-12.7, 3.0, 2.0]} rotation={[0, Math.PI / 2, 0]} />
      <ArtFrame palette="signal" title="低处的云 03" position={[12.7, 3.2, 2.5]} rotation={[0, -Math.PI / 2, 0]} />

      {[
        [-4.2, -3.4],
        [0, -4.2],
        [4.2, -3.4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.25, 1.1, 1.25]} />
            <meshStandardMaterial color="#dcd4c6" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.55, 0]} castShadow>
            {i === 0 ? (
              <torusKnotGeometry args={[0.35, 0.12, 64, 12]} />
            ) : i === 1 ? (
              <icosahedronGeometry args={[0.48, 1]} />
            ) : (
              <torusGeometry args={[0.42, 0.13, 20, 44]} />
            )}
            <meshStandardMaterial
              color={i === 0 ? '#b98654' : i === 1 ? '#8c9c93' : '#c4a584'}
              roughness={0.38}
              metalness={0.35}
            />
          </mesh>
        </group>
      ))}

      <group position={[0, 0, 1.8]}>
        <mesh position={[0, 0.44, 0]} castShadow>
          <boxGeometry args={[4.2, 0.16, 0.8]} />
          <meshStandardMaterial color="#8d7659" roughness={0.8} />
        </mesh>
        {[-1.7, 1.7].map((x) => (
          <mesh key={x} position={[x, 0.2, 0]} castShadow>
            <boxGeometry args={[0.16, 0.4, 0.6]} />
            <meshStandardMaterial color="#5e5b52" roughness={0.7} />
          </mesh>
        ))}
      </group>

      <NoticeBoard x={5.4} z={5.9} yaw={Math.PI} seed="gallery-board" />
      <group position={[5.4, 0, 5.1]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[1.7, 0.9, 0.7]} />
          <meshStandardMaterial color="#7b6a55" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.94, 0]}>
          <boxGeometry args={[1.85, 0.08, 0.82]} />
          <meshStandardMaterial color="#d9ccb6" roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.04, 0.06]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.55, 0.12, 0.4]} />
          <meshStandardMaterial color="#f0e6d0" emissive="#e8c78f" emissiveIntensity={0.5} />
        </mesh>
        <pointLight position={[0, 1.6, 0]} color="#ffd9a2" intensity={2} distance={4} decay={2} />
      </group>

      <group position={[12.7, 0, -3]}>
        <mesh position={[0, 1.4, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[2.2, 2.8]} />
          <meshStandardMaterial color="#4f4234" roughness={0.8} />
        </mesh>
        <mesh position={[-0.06, 1.42, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1.7, 2.45]} />
          <meshBasicMaterial color="#e0be87" transparent opacity={0.3} />
        </mesh>
        <mesh position={[-0.1, 3.0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1.9, 0.32]} />
          <meshBasicMaterial color="#f2e4c9" transparent opacity={0.7} />
        </mesh>
      </group>

      <spotLight position={[-2, 5.8, 2]} target-position={[0, 0, 0]} angle={0.7} penumbra={1} intensity={8} color="#fff0d4" />
      <spotLight position={[7, 5.4, -3]} target-position={[5, 0, 2]} angle={0.6} penumbra={1} intensity={6} color="#ffe4be" />
      <mesh position={[0, 0.05, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 5]} />
        <meshBasicMaterial color="#f7e5c4" transparent opacity={0.07} />
      </mesh>

      <Marker x={0} z={7.2} y={2.3} title="返回主街" subtitle="离开美术馆" tone="entrance" actionId="gallery-exit" onOpen={exitCity} />
      <Marker
        x={5.4}
        z={5.1}
        y={2.4}
        title="城市留言台"
        subtitle={`${posts.length} 条留言`}
        tone="kiosk"
        actionId="gallery-kiosk"
        onOpen={() => openPlace('gallery-lobby')}
      />
      <Marker
        x={11.6}
        z={-3}
        y={2.9}
        title="二楼 · 光箱展厅"
        subtitle="个人展厅 · 可认领"
        tone="space"
        actionId="gallery-upstairs"
        onOpen={() => enterTarget({ kind: 'space', id: 'light-gallery' }, '光箱展厅')}
      />

      <PlayerRig
        start={galleryInterior.start}
        startYaw={0}
        bounds={bounds}
        colliders={colliders}
        interactables={interactables}
        cameraDistance={9.5}
        interior
      />
    </group>
  )
}

function Chair({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <boxGeometry args={[0.46, 0.08, 0.46]} />
        <meshStandardMaterial color="#8e7d65" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.72, -0.2]} castShadow>
        <boxGeometry args={[0.46, 0.5, 0.07]} />
        <meshStandardMaterial color="#8e7d65" roughness={0.8} />
      </mesh>
      {[
        [-0.18, -0.18],
        [0.18, -0.18],
        [-0.18, 0.18],
        [0.18, 0.18],
      ].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.22, pz]}>
          <boxGeometry args={[0.05, 0.44, 0.05]} />
          <meshStandardMaterial color="#5b5146" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function SpotLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 4.2, 8]} />
        <meshStandardMaterial color="#5d564c" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 4.18, 0]}>
        <cylinderGeometry args={[0.2, 0.12, 0.3, 16]} />
        <meshStandardMaterial color="#f2d7a8" emissive="#f0c486" emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 3.9, 0]} color="#ffd5a0" intensity={3.2} distance={7} decay={2} />
    </group>
  )
}

function CafeContent() {
  const openPlace = useApp((state) => state.openPlace)
  const exitCity = useApp((state) => state.exitCity)
  const topDown = useApp((state) => state.indoorCam === 'top')
  const placeDetail = useApp((state) => state.placeDetail)
  const posts = placeDetail?.place.id === 'corner-cafe' ? placeDetail.posts : []
  // 玻璃亭：四面都是落地玻璃，西面正中是门
  const cafe = useMemo(() => {
    const box = roomBox(
      { x0: -cafeInterior.width / 2, x1: cafeInterior.width / 2, z0: -cafeInterior.depth / 2, z1: cafeInterior.depth / 2 },
      cafeInterior.height,
    )
    const glass = (side: 'n' | 's' | 'e' | 'w', l0: number, l1: number): LocalOpening => ({
      side,
      l0,
      l1,
      y0: 0.12,
      y1: cafeInterior.height - 0.3,
      kind: 'store',
    })
    const hw = box.W / 2 - 0.05
    const hd = box.D / 2 - 0.05
    const openings: LocalOpening[] = [
      glass('n', -hw, hw),
      glass('s', -hw, hw),
      glass('e', -hd, hd),
      glass('w', -hd, -1.4),
      { side: 'w', l0: -1.4, l1: 1.4, y0: 0.04, y1: 2.8, kind: 'entry' },
      glass('w', 1.4, hd),
    ]
    return { box, openings, colliders: roomColliders(box, openings, null), bounds: roomBounds(box, null) }
  }, [])
  const bounds = cafe.bounds
  const colliders = cafe.colliders
  const interactables = useMemo<Interactable[]>(
    () => [
      {
        id: 'cafe-exit',
        label: '返回主街',
        hint: '离开街角咖啡',
        x: -cafeInterior.width / 2 + 0.7,
        z: 0,
        radius: 2.2,
        action: exitCity,
      },
      {
        id: 'cafe-board',
        label: '熟客留言板',
        hint: '阅读与发布留言',
        x: 1.2,
        z: 4.0,
        radius: 2.4,
        action: () => openPlace('corner-cafe'),
      },
      {
        id: 'cafe-barista',
        label: `${barista.name} · ${barista.role}`,
        hint: '按 E 点单聊天',
        x: barista.x + 0.3,
        z: 1.0,
        radius: 1.8,
        action: () =>
          useApp
            .getState()
            .openDialog({ name: barista.name, role: barista.role, lines: barista.lines, x: barista.x + 0.3, z: 1.0 }),
      },
    ],
    [exitCity, openPlace],
  )

  return (
    <group>
      <RoomWalls
        box={cafe.box}
        openings={cafe.openings}
        wallColor={wallTone('#e8ddcd', 'cafe')}
        floorColor={floorTone('#b99a78', 'cafe')}
        ceiling={INDOOR_STYLE.ceiling}
        hideCeiling={topDown}
      />
      <CityBackdrop buildingId="cafe" floor={1} interior />

      <group position={[5.6, 0, 0]}>
        <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 1.02, 0.8]} />
          <meshStandardMaterial color="#7b6650" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.06, 0]}>
          <boxGeometry args={[2.5, 0.08, 0.92]} />
          <meshStandardMaterial color="#dfd1b9" roughness={0.5} />
        </mesh>
        <mesh position={[-0.45, 1.28, 0]}>
          <boxGeometry args={[0.6, 0.34, 0.42]} />
          <meshStandardMaterial color="#4e5753" metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh position={[0.45, 1.2, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.22, 14]} />
          <meshStandardMaterial color="#eee7d8" roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.0, -0.5]}>
          <boxGeometry args={[2.2, 0.08, 0.35]} />
          <meshStandardMaterial color="#8b7358" roughness={0.8} />
        </mesh>
        {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
          <mesh key={i} position={[x, 2.22, -0.5]}>
            <cylinderGeometry args={[0.11, 0.11, 0.32, 12]} />
            <meshStandardMaterial color={['#d7c6a6', '#8b9d8f', '#c7a68a', '#e2d6c0'][i]} roughness={0.7} />
          </mesh>
        ))}
        <pointLight position={[0, 2.4, 0.6]} color="#ffd9a6" intensity={3} distance={6} decay={2} />
      </group>
      <NpcFigure def={barista} shadows={false} actionId="cafe-barista" />
      <NoticeBoard x={1.2} z={5.1} yaw={Math.PI} seed="cafe-board" />

      {[
        [-4.2, -2.2, 0.4],
        [-4.4, 1.0, -0.3],
        [-0.8, -3.1, 1.1],
      ].map(([x, z, rot], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.52, 0.52, 0.07, 20]} />
            <meshStandardMaterial color="#d9ccb6" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 0.72, 10]} />
            <meshStandardMaterial color="#5b5650" metalness={0.35} roughness={0.5} />
          </mesh>
          <Chair x={0.9} z={0.15} rot={-1.6 + rot} />
          <Chair x={-0.9} z={-0.1} rot={1.5 + rot} />
        </group>
      ))}

      <group position={[-5.9, 0, 4.7]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.22, 0.9, 16]} />
          <meshStandardMaterial color="#a98164" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.2, 0]} castShadow>
          <icosahedronGeometry args={[0.6, 1]} />
          <meshStandardMaterial color="#6d8966" flatShading roughness={1} />
        </mesh>
      </group>

      <SpotLamp position={[3.2, 0, 3.6]} />
      <SpotLamp position={[-2.2, 0, -2.4]} />

      <mesh position={[0, 0.05, 3.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshBasicMaterial color="#f7dfb8" transparent opacity={0.08} />
      </mesh>

      <Marker
        x={-cafeInterior.width / 2 + 0.7}
        z={0}
        y={2.2}
        title="返回主街"
        subtitle="离开咖啡店"
        tone="entrance"
        actionId="cafe-exit"
        onOpen={exitCity}
      />
      <Marker
        x={1.2}
        z={4.9}
        y={2.7}
        title="熟客留言板"
        subtitle={`${posts.length} 条留言`}
        tone="kiosk"
        actionId="cafe-board"
        onOpen={() => openPlace('corner-cafe')}
      />

      <PlayerRig
        start={cafeInterior.start}
        startYaw={-Math.PI / 2}
        bounds={bounds}
        colliders={colliders}
        interactables={interactables}
        cameraDistance={8.5}
        interior
      />
    </group>
  )
}

function SpaceRoom() {
  const interiorId = useApp((state) => state.interior?.kind === 'space' ? state.interior.id : null)
  const detail = useApp((state) => state.spaceDetail)
  const user = useApp((state) => state.user)
  const editor = useApp((state) => state.editor)
  const selectedId = useApp((state) => state.selectedFurnitureId)
  const selectFurniture = useApp((state) => state.selectFurniture)
  const floorClick = useApp((state) => state.editorFloorClick)
  const openSpace = useApp((state) => state.openSpace)
  const startEditing = useApp((state) => state.startEditing)
  const exitCity = useApp((state) => state.exitCity)
  const topDown = useApp((state) => state.indoorCam === 'top')

  const isUnitRoom = Boolean(interiorId && isUnitSpaceId(interiorId))
  // 户型尺寸不再写死：从楼体平面正推（户宽 = 面宽 / 每层户数）。
  const unit = useMemo(() => (isUnitRoom && interiorId ? unitPlanOfSpace(interiorId) : null), [isUnitRoom, interiorId])
  const plan = useUnitRoomPlan(unit)
  // 阳台挑板的范围：PlayerRig 用它判断人是否已经走出推拉门，
  // 从而把镜头连续地滑到肩后平视（不是切换机位模式）。
  const balconyZone = useMemo(() => (plan?.bal ? balconyRect(plan.box, plan.bal) : null), [plan])
  const room = unit?.room
  const config = room
    ? { width: room.width, depth: room.depth, height: room.height, start: unitInterior.start }
    : isUnitRoom
      ? unitInterior
      : roomInterior
  const meta = useMemo(() => (interiorId ? unitMetaOfSpace(interiorId) : null), [interiorId])
  const shellCut = useMemo(
    () => (meta && meta.floor >= 1 ? { floor: meta.floor, owner: `u:${meta.index}` } : null),
    [meta],
  )
  const balcony = false
  const windowKind: 'normal' | 'clerestory' | 'none' = 'normal'
  // 加载中和加载完成必须是同一套机位参数，否则详情一到，镜头会突然拉近一次。
  // iso 机位要能装下整间房：按房间最长边给距离，小房间也要到 7m 左右才看得出整层。
  const camDistance = Math.max(7, Math.min(13, Math.max(config.width, config.depth) * 1.3))
  const walkBounds = plan
    ? plan.bounds
    : {
        minX: -config.width / 2 + 0.6,
        maxX: config.width / 2 - 0.6,
        minZ: -config.depth / 2 + 0.6,
        maxZ: config.depth / 2 - 0.6,
      }
  const exitPos: [number, number] = plan ? [plan.door.x, plan.door.z] : [0, config.depth / 2 - 0.5]
  const startPos: [number, number] = plan ? plan.start : config.start
  const startYaw = plan ? plan.startYaw : 0
  // 留言台和布置台贴着后墙摆，不能再用固定的 ±5.1：户型是按楼体推出来的，
  // 小楼里的房间只有 5.6m 宽，写死就会跑到墙外面去。
  const guestPos: [number, number] = plan ? plan.guest : [config.width / 2 - 0.75, config.depth / 2 - 0.75]
  const consolePos: [number, number] = plan ? plan.console : [-config.width / 2 + 0.75, config.depth / 2 - 0.75]
  // 详情没到（或后端还没补齐这户）时，先用本地生成的样板把房间完整搭出来：
  // 墙、天花板、家具、阳台和"返回走廊"的门都必须在，不能把玩家丢进一片虚空。
  const local = useMemo(() => (interiorId ? unitSpaceTemplate(interiorId) : null), [interiorId])
  const remote = detail?.space.id === interiorId ? detail.space : null
  const space: SpaceDetail['space'] | null = remote
    ? remote
    : local
      ? {
          ...local,
          owner: null,
          visitCount: 0,
          postCount: 0,
          createdAt: '',
          updatedAt: '',
        }
      : null
  const isOwner = Boolean(space && user && space.ownerId === user.id)
  const editing = Boolean(editor && isOwner)

  // 这户主人的宠物：住宅户内和老式个人空间都摆出来。房主不在场时访客也能看到——
  // 「家里有猫」本身就是这户人家的门面。
  const adopted = useApp((state) => state.pets)
  const homePets = useMemo(
    () => (space?.ownerId ? adopted.filter((pet) => pet.owner.id === space.ownerId) : []),
    [space?.ownerId, adopted],
  )
  const petHomes = useMemo(
    () => homeSpots(walkBounds, homePets.length),
    [walkBounds.minX, walkBounds.maxX, walkBounds.minZ, walkBounds.maxZ, homePets.length],
  )

  useEffect(() => {
    if (interiorId && detail?.space.id !== interiorId) void openSpace(interiorId, true)
  }, [interiorId, detail?.space?.id, openSpace])

  // 后端暂时拿不到详情时定时重试；房间已经用样板渲染，不用干等。
  useEffect(() => {
    if (!interiorId || remote) return
    const timer = window.setInterval(() => void openSpace(interiorId, true), 2500)
    return () => window.clearInterval(timer)
  }, [interiorId, remote, openSpace])

  // 特色设施：按楼型/楼层派生，不存数据。位置、模型和交互点都在 Features.tsx 里算好。
  const devices = useMemo(() => homeDevices(unit), [unit])
  const featureArt = detail?.space.id === interiorId ? detail.space.art : local?.art
  const features = useHomeFeatures(
    plan,
    devices,
    featureArt ?? { title: '样板陈设', palette: 'dawn' },
    interiorId ?? '',
  )

  if (!space) {
    return (
      <group>
        <ambientLight intensity={1.2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[config.width, config.depth]} />
          <meshStandardMaterial color="#c3ae95" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[1.2, 0.2, 1.2]} />
          <meshStandardMaterial color="#b9a98f" />
        </mesh>
        {/* 空间详情异步加载时也保留玩家控制，避免进入二楼后整段时间无法移动。 */}
        <PlayerRig
          start={startPos}
          startYaw={startYaw}
          bounds={walkBounds}
          colliders={[]}
          interactables={[
            {
              id: 'space-exit',
              label: '返回',
              hint: '离开这间空间',
              x: exitPos[0],
              z: exitPos[1],
              radius: 3,
              action: exitCity,
            },
          ]}
          cameraDistance={camDistance}
          interior
        />
        <Marker
          x={exitPos[0]}
          z={exitPos[1]}
          y={2.2}
          title="返回"
          subtitle="离开这间空间"
          tone="entrance"
          actionId="space-exit"
          onOpen={exitCity}
        />
      </group>
    )
  }

  const wall = wallTone(editing ? editor!.wallColor : space.wallColor, interiorId ?? space.id)
  const floor = floorTone(editing ? editor!.floorColor : space.floorColor, interiorId ?? space.id)
  const layout = editing ? editor!.layout : space.layout
  const art = editing ? editor!.art : space.art
  const items = layout.items

  const bounds = walkBounds

  // 家具避开入户门与阳台门前：一进门不该被床顶住
  const placed = useMemo(() => {
    if (!plan) return items
    const box = {
      minX: -plan.box.W / 2 + 0.5,
      maxX: plan.box.W / 2 - 0.5,
      minZ: -plan.box.D / 2 + 0.5,
      maxZ: plan.box.D / 2 - 0.5,
    }
    // 床只进卧室：户型里有隔墙时，床的候选范围就是那间卧室
    const bedroom = plan.bedroom
    const bedroomBox = bedroom
      ? {
          minX: bedroom.minX + 0.06,
          maxX: bedroom.maxX - 0.06,
          minZ: bedroom.minZ + 0.06,
          maxZ: bedroom.maxZ - 0.06,
        }
      : null
    return fitFurniture(
      items,
      box,
      plan.clears,
      (type) => FURNITURE_META[type],
      (item) => (item.type === 'bed' && bedroomBox ? bedroomBox : null),
    )
  }, [items, plan])

  const colliders: Collider[] = [
    ...placed
      .filter((item) => FURNITURE_META[item.type]?.walk)
      .map((item) => {
        const meta = FURNITURE_META[item.type]
        const { w, d } = footprint(item, meta)
        return {
          minX: item.x - w / 2,
          maxX: item.x + w / 2,
          minZ: item.z - d / 2,
          maxZ: item.z + d / 2,
          minY: 0,
          maxY: meta.h,
          camera: false,
        }
      }),
    ...(plan
      ? [
          ...plan.colliders,
          // 户内隔墙也是实体：不挡的话能直接穿墙进卧室
          ...plan.partitions.map((w) => ({
            minX: w.minX,
            maxX: w.maxX,
            minZ: w.minZ,
            maxZ: w.maxZ,
            minY: 0,
            maxY: plan.box.H,
            camera: false,
          })),
        ]
      : [
          { minX: -config.width / 2 - 0.2, maxX: -config.width / 2 + 0.2, minZ: -config.depth / 2, maxZ: config.depth / 2, minY: 0, maxY: config.height, walk: false },
          { minX: config.width / 2 - 0.2, maxX: config.width / 2 + 0.2, minZ: -config.depth / 2, maxZ: config.depth / 2, minY: 0, maxY: config.height, walk: false },
          { minX: -config.width / 2, maxX: config.width / 2, minZ: config.depth / 2 - 0.2, maxZ: config.depth / 2 + 0.2, minY: 0, maxY: config.height, walk: false },
          { minX: -config.width / 2, maxX: config.width / 2, minZ: -config.depth / 2 - 0.2, maxZ: -config.depth / 2 + 0.2, minY: 0, maxY: config.height, walk: false },
          { minX: -config.width / 2, maxX: config.width / 2, minZ: -config.depth / 2, maxZ: config.depth / 2, minY: config.height, maxY: config.height + 0.6, walk: false },
        ]),
  ]

  const interactables: Interactable[] = [
    {
      id: 'space-exit',
      label: isUnitRoom ? '返回走廊' : '返回主街',
      hint: isUnitRoom ? '回到本层走廊' : '离开这间空间',
      x: exitPos[0],
      z: exitPos[1],
      radius: 2.2,
      action: exitCity,
    },
    {
      id: 'space-guestbook',
      label: '访客留言台',
      hint: '阅读、留言、收藏与分享',
      x: guestPos[0],
      z: guestPos[1],
      radius: 3.0,
      action: () => openSpace(space.id),
    },
    isOwner
      ? {
          id: 'space-console',
          label: '布置控制台',
          hint: '修改名称、颜色、家具与画作',
          x: consolePos[0],
          z: consolePos[1],
          radius: 3.0,
          action: startEditing,
        }
      : {
          id: 'space-claim',
          label: space.ownerId ? '空间信息' : '认领这间空间',
          hint: space.ownerId ? '查看主人与访问记录' : '由服务端安全认领，每人限一间',
          x: consolePos[0],
          z: consolePos[1],
          radius: 3.0,
          action: () => openSpace(space.id),
        },
    // 家里的宠物：常驻点不会动，交互半径给宽一点，免得它逛到角落就点不到了。
    ...homePets.map((pet, i) => {
      const spot = petHomes[i]
      const home = homePetLive(pet, spot)
      return {
        id: `pet-${pet.id}`,
        label: pet.nickname || home.breed,
        hint: home.hunger < HUNGRY_AT ? '按 E 互动 · 它好像饿了' : '按 E 互动 · 它在你家里',
        x: spot.x,
        z: spot.z,
        radius: 2.8,
        action: () => openPetDialog(home),
      }
    }),
    // 特色设施（画廊墙 / 唱片机 / 望远镜 / 私人影院）
    ...features.interactables,
  ]

  return (
    <group>
      {plan ? (
        <>
          <RoomWalls
            box={plan.box}
            openings={plan.openings}
            wallColor={wall}
            floorColor={floor}
            editing={editing}
            onFloorClick={floorClick}
            hideCeiling={topDown}
          />
          <PartitionWalls walls={plan.partitions} headers={plan.headers} height={plan.box.H} />
          <ClosedDoor box={plan.box} side={plan.door.side} l={plan.door.l} />
          {plan.bal && <Balcony box={plan.box} bal={plan.bal} />}
          {/* 房间中心挂一盏吊灯：参考图里每块区域都有一盏暖灯，
              再配一盏弱一点的点光当"补光"，深色墙才不会整片发黑。 */}
          {!topDown && <CeilingPendant height={plan.box.H} neck={0.42} shade={0.4} />}
          <pointLight position={[0, plan.box.H - 0.4, 0]} color="#ffe2bc" intensity={1.6} distance={Math.max(plan.box.W, plan.box.D) + 2} decay={1.6} />
        </>
      ) : (
        <RoomShell
          width={config.width}
          depth={config.depth}
          height={config.height}
          wall={wall}
          floor={floor}
          editing={editing}
          onFloorClick={floorClick}
          balcony={balcony}
          window={windowKind}
          solidDoor={isUnitRoom}
        />
      )}
      {meta && shellCut && (
        <CityBackdrop
          buildingId={meta.buildingId}
          floor={meta.floor}
          origin={plan ? [plan.box.cx, plan.box.cz] : [0, 0]}
          cut={shellCut}
          interior
        />
      )}
      {/* 有画廊墙的那面墙已经挂了一整排画；再挂一幅 2.2×2.8 的单幅画，
          会正好压在最中间那幅上（以前就是两套画叠在一起）。 */}
      {(plan ? plan.art : true) && !devices.list.includes('gallery-wall') && (
        <ArtFrame
          palette={art.palette}
          title={art.title}
          position={plan?.art ? plan.art.position : [-config.width / 2 + 0.04, 2.45, 0]}
          rotation={plan?.art ? plan.art.rotation : [0, Math.PI / 2, 0]}
        />
      )}

      {placed.map((item) => {
        // 老数据是按 12.6 × 9.8 存的，户型缩到真实尺寸后可能落在墙外。
        // 渲染时夹到房间内，不改进库数据（认领者下次拖动就会写回新位置）。
        const clamped = item
        return (
          <FurnitureMesh
            key={item.id}
            item={clamped}
            selected={selectedId === item.id}
            editing={editing}
            onSelect={() => selectFurniture(item.id)}
          />
        )
      })}

      {homePets.length > 0 && <HomePets pets={homePets} bounds={walkBounds} />}
      {features.nodes}

      <group position={[guestPos[0], 0, guestPos[1]]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.9, 0.84, 0.7]} />
          <meshStandardMaterial color="#d3c8b6" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.9, 0]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.62, 0.1, 0.42]} />
          <meshStandardMaterial color="#f1e6cf" emissive="#e5c38d" emissiveIntensity={0.35} />
        </mesh>
        <pointLight position={[0, 1.4, 0]} color="#ffd8a1" intensity={1.4} distance={3.2} decay={2} />
      </group>

      <group position={[consolePos[0], 0, consolePos[1]]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.85, 1.1, 0.5]} />
          <meshStandardMaterial color="#5a615c" roughness={0.5} metalness={0.25} />
        </mesh>
        <mesh position={[0, 0.92, 0.27]} rotation={[-0.25, 0, 0]}>
          <planeGeometry args={[0.62, 0.4]} />
          <meshBasicMaterial color="#d8e4d7" transparent opacity={0.55} />
        </mesh>
        <pointLight position={[0, 1.4, 0.4]} color="#dce9d8" intensity={0.8} distance={2.4} decay={2} />
      </group>

      {!editing && (
        <>
          <Marker
            x={exitPos[0]}
            z={exitPos[1]}
            y={2.2}
            title={isUnitRoom ? '返回走廊' : '返回主街'}
            subtitle={isUnitRoom ? '回到本层走廊' : '离开个人空间'}
            tone="entrance"
            actionId="space-exit"
            onOpen={exitCity}
          />
          <Marker
            x={guestPos[0]}
            z={guestPos[1]}
            y={2.2}
            title="访客留言台"
            subtitle={`${detail?.posts.length ?? space.postCount} 条留言 · ${space.visitCount} 次访问`}
            tone="kiosk"
            actionId="space-guestbook"
            onOpen={() => openSpace(space.id)}
          />
          <Marker
            x={consolePos[0]}
            z={consolePos[1]}
            y={2.3}
            title={isOwner ? '布置控制台' : space.ownerId ? '空间信息' : '认领这间空间'}
            subtitle={isOwner ? '开启编辑模式' : space.ownerId ? `主人 ${space.owner?.name || '其他访客'}` : '样板陈设 · 可认领'}
            tone="space"
            actionId={isOwner ? 'space-console' : 'space-claim'}
            onOpen={isOwner ? startEditing : () => openSpace(space.id)}
          />
        </>
      )}

      <PlayerRig
        start={startPos}
        startYaw={startYaw}
        bounds={bounds}
        colliders={colliders}
        interactables={interactables}
        cameraDistance={camDistance}
        balcony={balconyZone}
        interior
      />
    </group>
  )
}

function InteriorEnvironment() {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  return (
    <>
      {/* 室内的材质反射必须和窗外同一套环境，否则玻璃、金属栏杆会像没通电。 */}
      <ImageBasedLighting mood={night ? 'night' : 'city'} intensity={night ? 0.5 : 0.42} rotation={night ? 1.1 : 2.1} />
      <color attach="background" args={[palette.fog]} />
      {/* 雾的远端要留给阳台外的城市背景；近处室内几乎不受影响 */}
      <fog attach="fog" args={[palette.fog, 90, 560]} />
      {/* 室内不用"太阳"投影：一盏从天花板上方照下来的平行光，会让墙和吊顶
          在地板上投出一大片斜影，看着像屋顶被掀开了。室内的明暗交给
          环境光 + 天光 + AO，局部的阴影靠家具自身的接触暗部。
          基调偏冷（和深色墙同一色系），亮度靠地板和暖色点光找回来。 */}
      <ambientLight intensity={night ? 0.34 : 0.52} color={night ? '#8ea2b8' : '#e8eef4'} />
      <hemisphereLight args={[night ? '#26323f' : '#dfe9ef', '#3a3630', night ? 0.34 : 0.5]} />
      <directionalLight
        position={[3, 9, -7]}
        intensity={night ? 0.42 : 0.82}
        color={night ? '#9fb6cc' : '#fff3de'}
      />
      {/* 靠窗那一侧的补光：让玻璃幕墙附近的墙、地板不至于沉进阴影里 */}
      <directionalLight
        position={[-6, 5, 8]}
        intensity={night ? 0.18 : 0.3}
        color={night ? '#6f8ba6' : '#cfe4f2'}
      />
    </>
  )
}

export function InteriorScene({ active = true }: { active?: boolean }) {
  const interior = useApp((state) => state.interior)
  const night = useApp((state) => state.night)
  // 退出内景时 store 会把 interior 清空，但 Canvas 不能跟着卸载：
  // 每次进出都重建一遍场景、重新编译一遍材质，就是"进出建筑不流畅"的来源。
  // 这里记住最后进过的房间，退到城市时把它留在后台停帧。
  const last = useRef(interior)
  if (interior) last.current = interior
  const shown = interior ?? last.current
  if (!shown) return null
  return (
    <div className="scene-root">
      <Canvas
        frameloop={active ? 'always' : 'never'}
        shadows
        dpr={[1, 1.7]}
        camera={{ fov: 64, near: 0.12, far: 900, position: [0, 2, 6] }}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.08
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
      >
        <Suspense fallback={null}>
          <InteriorEnvironment />
          {shown.kind === 'public' && shown.id === 'gallery' && <GalleryContent />}
          {shown.kind === 'public' && shown.id === 'cafe' && <CafeContent />}
          {shown.kind === 'space' && <SpaceRoom />}
          {shown.kind === 'shop' && <ShopRoom key={shown.id} id={shown.id} />}
          {shown.kind === 'building' &&
            (shown.floor === ROOF_FLOOR ? (
              <RoofDeck key={`${shown.id}-roof`} buildingId={shown.id} />
            ) : (
              <BuildingInterior
                key={`${shown.id}-${shown.floor ?? 1}-${shown.core ?? 0}-${shown.from ?? ''}`}
                id={shown.id}
                floor={shown.floor ?? 1}
                core={shown.core ?? 0}
                from={shown.from}
              />
            ))}
        </Suspense>
        <EffectComposer stencilBuffer multisampling={0}>
          {/* 室内的廉价感一大半来自"墙和地接缝处没有变暗"。
              这里原先用 SSAO：半径 3.5cm、16 采样、intensity 30，
              采样点几乎重合，结果就是柜子和墙角外面围一圈黑噪点。
              换成 N8AO：半径按真实米级给，自带泊松去噪，边缘是连续的暗部。 */}
          <N8AO
            aoRadius={0.5}
            distanceFalloff={0.8}
            intensity={2.4}
            quality="medium"
            aoSamples={16}
            denoiseSamples={8}
            denoiseRadius={12}
            color="#050a12"
          />
          {/* 泛光：参考图里那些"亮起来"的东西——显示器的光、灯罩、地贴边缘。
              阈值给高一点，只抓真正的自发光，地板和墙面不会跟着糊成一片。 */}
          <Bloom
            intensity={night ? 0.62 : 0.34}
            luminanceThreshold={0.92}
            luminanceSmoothing={0.25}
            mipmapBlur
            radius={0.72}
          />
          <Vignette offset={0.2} darkness={night ? 0.5 : 0.38} eskil={false} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
