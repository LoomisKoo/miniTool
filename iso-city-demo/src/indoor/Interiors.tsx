import { Suspense, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useApp } from '../store'
import { cafeInterior, galleryInterior, roomInterior } from '../data/city'
import { FurnitureMesh, FURNITURE_META } from './Furniture'
import { PlayerRig, type Collider, type Interactable } from '../scene/PlayerRig'
import { Marker } from '../scene/Markers'
import { makeArtTexture, makeFloorTexture, makeSignTexture, makeWallTexture } from '../scene/textures'

function RoomShell({
  width,
  depth,
  height,
  wall,
  floor,
  editing,
  onFloorClick,
  window = 'normal',
}: {
  width: number
  depth: number
  height: number
  wall: string
  floor: string
  editing?: boolean
  onFloorClick?: (x: number, z: number) => void
  window?: 'normal' | 'clerestory'
}) {
  const doorWidth = 2.6
  const doorHeight = 2.7
  const sideWidth = (width - doorWidth) / 2
  const windowWidth = Math.min(width * 0.52, 7)
  const windowHeight = Math.min(height * 0.46, 2.3)
  const windowY = height * 0.56

  // 纯色地板/墙面在近景里非常"塑料"，加一层低对比的程序化纹理
  // （木拼板 + 涂料颗粒），只改观感，不增加几何。
  const floorMap = useMemo(() => {
    const tex = makeFloorTexture(floor, '#7f6f58')
    tex.repeat.set(Math.max(2, width / 4.2), Math.max(2, depth / 4.2))
    return tex
  }, [floor, width, depth])
  useEffect(() => () => floorMap.dispose(), [floorMap])

  const wallMap = useMemo(() => {
    const tex = makeWallTexture(wall)
    tex.repeat.set(Math.max(1, width / 3.2), Math.max(1, height / 3.2))
    return tex
  }, [wall, width, height])
  useEffect(() => () => wallMap.dispose(), [wallMap])

  const wallMat = (
    <meshStandardMaterial map={wallMap} color="#ffffff" roughness={0.94} side={THREE.DoubleSide} />
  )
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={floorMap} color="#ffffff" roughness={0.62} metalness={0.03} />
      </mesh>

      {/* 踢脚线：墙地交界处有实体收口，房间立刻"做完了" */}
      {[
        { pos: [0, 0.07, -depth / 2 + 0.02] as [number, number, number], size: [width, 0.14, 0.04] as const },
        { pos: [0, 0.07, depth / 2 - 0.02] as [number, number, number], size: [width, 0.14, 0.04] as const },
        { pos: [-width / 2 + 0.02, 0.07, 0] as [number, number, number], size: [0.04, 0.14, depth] as const },
        { pos: [width / 2 - 0.02, 0.07, 0] as [number, number, number], size: [0.04, 0.14, depth] as const },
      ].map((b, i) => (
        <mesh key={i} position={b.pos} receiveShadow>
          <boxGeometry args={[b.size[0], b.size[1], b.size[2]]} />
          <meshStandardMaterial color="#d8d2c6" roughness={0.7} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#e3ded4" roughness={0.95} />
      </mesh>
      <mesh position={[0, height / 2, -depth / 2]}>
        <planeGeometry args={[width, height]} />
        {wallMat}
      </mesh>
      <mesh position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        {wallMat}
      </mesh>
      <mesh position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        {wallMat}
      </mesh>

      {/* 南墙留出门洞，不参与渲染的部分用侧墙和门楣补齐 */}
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
      <mesh position={[0, doorHeight / 2, depth / 2 + 0.02]}>
        <planeGeometry args={[doorWidth, doorHeight]} />
        <meshBasicMaterial color="#d8b47c" transparent opacity={0.45} toneMapped={false} />
      </mesh>

      {[
        [0, 0.08, -depth / 2 + 0.04, width, 0.16, 0.08],
        [-width / 2 + 0.04, 0.08, 0, 0.08, 0.16, depth],
        [width / 2 - 0.04, 0.08, 0, 0.08, 0.16, depth],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#b9ad9b" roughness={0.8} />
        </mesh>
      ))}

      <group position={[0, windowY, -depth / 2 + 0.03]}>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[windowWidth + 0.24, windowHeight + 0.24]} />
          <meshStandardMaterial color="#8f846f" roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[windowWidth, windowHeight]} />
          <meshBasicMaterial color="#e6efe9" toneMapped={false} />
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

      {window === 'clerestory' &&
        [-width * 0.3, -width * 0.1, width * 0.1, width * 0.3].map((x) => (
          <mesh key={x} position={[x, height - 1.45, -depth / 2 + 0.04]}>
            <planeGeometry args={[2.2, 1.9]} />
            <meshBasicMaterial color="#eef3ed" toneMapped={false} />
          </mesh>
        ))}

      <mesh position={[0, height - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 1, depth - 1]} />
        <meshStandardMaterial color="#e8e2d7" roughness={1} />
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
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[2.5, 3.1, 0.08]} />
        <meshStandardMaterial color="#8d7757" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[2.2, 2.8]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.75, 0.01]}>
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
        cameraDistance={4.4}
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
  const placeDetail = useApp((state) => state.placeDetail)
  const posts = placeDetail?.place.id === 'corner-cafe' ? placeDetail.posts : []
  const bounds = useMemo(
    () => ({
      minX: -cafeInterior.width / 2 + 0.6,
      maxX: cafeInterior.width / 2 - 0.6,
      minZ: -cafeInterior.depth / 2 + 0.6,
      maxZ: cafeInterior.depth / 2 - 0.6,
    }),
    [],
  )
  const colliders = useMemo<Collider[]>(
    () =>
      [
        { minX: -8.3, maxX: -7.9, minZ: -5.6, maxZ: 5.6 },
        { minX: 7.9, maxX: 8.3, minZ: -5.6, maxZ: 5.6 },
        { minX: -8.3, maxX: 8.3, minZ: -5.8, maxZ: -5.4 },
        { minX: -8.3, maxX: 8.3, minZ: 5.4, maxZ: 5.8 },
      ].map((c) => ({ ...c, minY: 0, maxY: 5, walk: false })),
    [],
  )
  const interactables = useMemo<Interactable[]>(
    () => [
      {
        id: 'cafe-exit',
        label: '返回主街',
        hint: '离开街角咖啡',
        x: 0,
        z: cafeInterior.depth / 2 - 0.5,
        radius: 2.2,
        action: exitCity,
      },
      {
        id: 'cafe-board',
        label: '熟客留言板',
        hint: '阅读与发布留言',
        x: 5.2,
        z: 1.4,
        radius: 3.0,
        action: () => openPlace('corner-cafe'),
      },
    ],
    [exitCity, openPlace],
  )

  return (
    <group>
      <RoomShell
        width={cafeInterior.width}
        depth={cafeInterior.depth}
        height={cafeInterior.height}
        wall="#e8ddcd"
        floor="#b99a78"
      />
      <ArtFrame palette="meadow" title="Window, 4pm" position={[-7.75, 2.3, 0]} rotation={[0, Math.PI / 2, 0]} />

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

      <group position={[-6.8, 0, 4.2]}>
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

      <Marker x={0} z={4.9} y={2.2} title="返回主街" subtitle="离开咖啡店" tone="entrance" actionId="cafe-exit" onOpen={exitCity} />
      <Marker
        x={5.2}
        z={1.4}
        y={2.4}
        title="熟客留言板"
        subtitle={`${posts.length} 条留言`}
        tone="kiosk"
        actionId="cafe-board"
        onOpen={() => openPlace('corner-cafe')}
      />

      <PlayerRig
        start={cafeInterior.start}
        startYaw={0}
        bounds={bounds}
        colliders={colliders}
        interactables={interactables}
        cameraDistance={3.3}
        interior
      />
    </group>
  )
}

function SpaceRoom() {
  const interiorId = useApp((state) => state.interior?.kind === 'space' ? state.interior.id : null)
  const detail = useApp((state) => state.spaceDetail)
  const worldSpace = useApp((state) =>
    state.interior?.kind === 'space'
      ? state.world?.spaces.find((space) => space.id === state.interior!.id) || null
      : null,
  )
  const user = useApp((state) => state.user)
  const editor = useApp((state) => state.editor)
  const selectedId = useApp((state) => state.selectedFurnitureId)
  const selectFurniture = useApp((state) => state.selectFurniture)
  const floorClick = useApp((state) => state.editorFloorClick)
  const openSpace = useApp((state) => state.openSpace)
  const startEditing = useApp((state) => state.startEditing)
  const exitCity = useApp((state) => state.exitCity)

  const space = detail?.space.id === interiorId ? detail.space : worldSpace
  const isOwner = Boolean(space && user && space.ownerId === user.id)
  const editing = Boolean(editor && isOwner)
  const config = roomInterior

  useEffect(() => {
    if (interiorId && space?.id !== interiorId) void openSpace(interiorId, true)
  }, [interiorId, space?.id, openSpace])

  if (!space) {
    return (
      <group>
        <ambientLight intensity={1.2} />
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[1.2, 0.2, 1.2]} />
          <meshStandardMaterial color="#b9a98f" />
        </mesh>
        {/* 空间详情异步加载时也保留玩家控制，避免进入二楼后整段时间无法移动。 */}
        <PlayerRig
          start={roomInterior.start}
          startYaw={0}
          bounds={{
            minX: -roomInterior.width / 2 + 0.6,
            maxX: roomInterior.width / 2 - 0.6,
            minZ: -roomInterior.depth / 2 + 0.6,
            maxZ: roomInterior.depth / 2 - 0.6,
          }}
          colliders={[]}
          interactables={[]}
          cameraDistance={4.5}
          interior
        />
      </group>
    )
  }

  const wall = editing ? editor!.wallColor : space.wallColor
  const floor = editing ? editor!.floorColor : space.floorColor
  const layout = editing ? editor!.layout : space.layout
  const art = editing ? editor!.art : space.art
  const items = layout.items

  const bounds = {
    minX: -config.width / 2 + 0.6,
    maxX: config.width / 2 - 0.6,
    minZ: -config.depth / 2 + 0.6,
    maxZ: config.depth / 2 - 0.6,
  }
  const colliders: Collider[] = [
    ...items
      .filter((item) => FURNITURE_META[item.type]?.walk)
      .map((item) => {
        const meta = FURNITURE_META[item.type]
        return {
          minX: item.x - meta.w / 2,
          maxX: item.x + meta.w / 2,
          minZ: item.z - meta.d / 2,
          maxZ: item.z + meta.d / 2,
          minY: 0,
          maxY: meta.h,
          camera: false,
        }
      }),
    { minX: -12.3, maxX: -11.9, minZ: -10.3, maxZ: 10.3, minY: 0, maxY: 5, walk: false },
    { minX: 11.9, maxX: 12.3, minZ: -10.3, maxZ: 10.3, minY: 0, maxY: 5, walk: false },
    { minX: -12.3, maxX: 12.3, minZ: -10.3, maxZ: -9.9, minY: 0, maxY: 5, walk: false },
    { minX: -12.3, maxX: 12.3, minZ: 9.9, maxZ: 10.3, minY: 0, maxY: 5, walk: false },
  ]

  const interactables: Interactable[] = [
    {
      id: 'space-exit',
      label: '返回主街',
      hint: '离开这间空间',
      x: 0,
      z: config.depth / 2 - 0.5,
      radius: 2.2,
      action: exitCity,
    },
    {
      id: 'space-guestbook',
      label: '访客留言台',
      hint: '阅读、留言、收藏与分享',
      x: 5.1,
      z: 3.1,
      radius: 3.0,
      action: () => openSpace(space.id),
    },
    isOwner
      ? {
          id: 'space-console',
          label: '布置控制台',
          hint: '修改名称、颜色、家具与画作',
          x: -4.9,
          z: 3.2,
          radius: 3.0,
          action: startEditing,
        }
      : {
          id: 'space-claim',
          label: space.ownerId ? '空间信息' : '认领这间空间',
          hint: space.ownerId ? '查看主人与访问记录' : '由服务端安全认领，每人限一间',
          x: -4.9,
          z: 3.2,
          radius: 3.0,
          action: () => openSpace(space.id),
        },
  ]

  return (
    <group>
      <RoomShell
        width={config.width}
        depth={config.depth}
        height={config.height}
        wall={wall}
        floor={floor}
        editing={editing}
        onFloorClick={floorClick}
      />
      <ArtFrame
        palette={art.palette}
        title={art.title}
        position={[-config.width / 2 + 0.04, 2.45, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />

      {items.map((item) => (
        <FurnitureMesh
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          editing={editing}
          onSelect={() => selectFurniture(item.id)}
        />
      ))}

      <group position={[5.1, 0, 3.1]}>
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

      <group position={[-4.9, 0, 3.2]}>
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
            x={0}
            z={config.depth / 2 - 0.5}
            y={2.2}
            title="返回主街"
            subtitle="离开个人空间"
            tone="entrance"
            actionId="space-exit"
            onOpen={exitCity}
          />
          <Marker
            x={5.1}
            z={3.1}
            y={2.2}
            title="访客留言台"
            subtitle={`${detail?.posts.length ?? space.postCount} 条留言 · ${space.visitCount} 次访问`}
            tone="kiosk"
            actionId="space-guestbook"
            onOpen={() => openSpace(space.id)}
          />
          <Marker
            x={-4.9}
            z={3.2}
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
        start={config.start}
        startYaw={0}
        bounds={bounds}
        colliders={colliders}
        interactables={interactables}
        cameraDistance={4.5}
        interior
      />
    </group>
  )
}

function InteriorEnvironment() {
  return (
    <>
      <color attach="background" args={['#242a27']} />
      <fog attach="fog" args={['#2c322f', 26, 70]} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#f4efe4', '#7a6e60', 0.7]} />
      <directionalLight position={[3, 9, -7]} intensity={1.5} color="#fff1d8" castShadow shadow-mapSize={[1024, 1024]} />
    </>
  )
}

export function InteriorScene() {
  const interior = useApp((state) => state.interior)
  if (!interior) return null
  return (
    <div className="scene-root">
      <Canvas
        shadows
        dpr={[1, 1.7]}
        camera={{ fov: 64, near: 0.05, far: 120, position: [0, 2, 6] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.08
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
      >
        <Suspense fallback={null}>
          <InteriorEnvironment />
          {interior.kind === 'public' && interior.id === 'gallery' && <GalleryContent />}
          {interior.kind === 'public' && interior.id === 'cafe' && <CafeContent />}
          {interior.kind === 'space' && <SpaceRoom />}
        </Suspense>
      </Canvas>
    </div>
  )
}
