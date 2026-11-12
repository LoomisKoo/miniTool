// 户内的宠物：只渲染「这户主人的」已领养宠物，在房间范围内慢慢逛。
//
// 城里那份（pets/WildPets.tsx）是 InstancedMesh 合批，因为街上随时有十几只；
// 屋里最多 1~3 只，用普通 Mesh 更省事——换几何、切眨眼、单独调姿态都直接。
//
// 坐标是房间局部坐标（与 Interiors.tsx 里 SpaceRoom 的 group 同一套），
// 所以漫游范围直接用 walkBounds。

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { AdoptedPet } from '../types'
import type { LivePet } from '../pets/live'
import { petPose, petHeading, type RoamHome } from '../pets/roam'
import { hungerOf, HUNGRY_AT } from '../pets/hunger'
import { isBlinking, voxelMaterial } from '../pets/voxel/build'
import { partMatrices, petModel, petScale } from '../pets/voxel/runtime'
import { breedOf, speciesOf } from '../catalog/species'

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

/** 房间四周留出的净空：宠物不能贴墙。 */
const MARGIN = 0.55
/** 走 / 停交替的周期（秒），和城里保持同一套节奏。 */
const CYCLE = 6
const WALK_SHARE = 0.62

function roamClock(t: number) {
  const cycle = Math.floor(t / CYCLE)
  const local = t - cycle * CYCLE
  const walkSpan = CYCLE * WALK_SHARE
  return { roam: cycle * walkSpan + Math.min(local, walkSpan), walking: local < walkSpan }
}

/**
 * 每只宠物在房间里的常驻点。沿后墙一字排开，间距跟着房间宽度走：
 * 一只宠物时居中偏一侧，多只时自动分开，不会挤成堆。
 */
export function homeSpots(bounds: Bounds, count: number): RoamHome[] {
  const width = Math.max(0.4, bounds.maxX - bounds.minX)
  const depth = Math.max(0.4, bounds.maxZ - bounds.minZ)
  const usable = Math.max(0.4, width - MARGIN * 2)
  const radius = Math.min(0.9, Math.max(0.3, Math.min(usable, depth) * 0.12))
  const spots: RoamHome[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count
    spots.push({
      x: bounds.minX + MARGIN + usable * t,
      z: bounds.maxZ - MARGIN - radius,
      radius,
    })
  }
  return spots
}

/** 把一只领养的宠物包装成交互层认识的形状（位置用它的常驻点）。 */
export function homePetLive(pet: AdoptedPet, spot: RoamHome): LivePet {
  return {
    id: pet.id,
    speciesId: pet.speciesId,
    species: speciesOf(pet.speciesId).name,
    breedId: pet.breedId,
    breed: breedOf(pet.speciesId, pet.breedId).name,
    x: spot.x,
    z: spot.z,
    y: 0,
    radius: 1.6,
    scale: pet.scale,
    spot: { x: spot.x, z: spot.z, radius: spot.radius },
    nickname: pet.nickname,
    owner: pet.owner,
    adoptedAt: pet.adoptedAt,
    hunger: hungerOf(pet),
  }
}

function HomePet({ pet, home, bounds }: { pet: AdoptedPet; home: RoamHome; bounds: Bounds }) {
  const model = useMemo(() => petModel(pet.speciesId, pet.breedId), [pet.speciesId, pet.breedId])
  const material = useMemo(() => voxelMaterial(), [])
  const root = useRef<THREE.Group>(null)
  const parts = useRef<Array<THREE.Mesh | null>>([])
  const blinkMesh = useRef<THREE.Mesh | null>(null)
  const matrices = useRef<THREE.Matrix4[]>([])
  const yaw = useRef(0)
  const blinkPart = model.parts.findIndex((part) => part.blink)
  const scale = petScale(pet.speciesId, model, pet.breedId) * pet.scale

  useFrame(() => {
    const node = root.current
    if (!node) return
    // 绝对时间：刷新前后、两个客户端看到的位置都一致。
    const t = (Date.now() - 1_700_000_000_000) / 1000
    const clock = roamClock(t + Math.abs(home.x + home.z) * 0.37)
    const hungry = hungerOf(pet) < HUNGRY_AT
    // 饿了就缩在常驻点附近，动作也切成待机——和城里的表现一致。
    const pose = petPose(pet.id, home, clock.roam, hungry ? 0.25 : 1)
    const x = THREE.MathUtils.clamp(pose.x, bounds.minX + MARGIN, bounds.maxX - MARGIN)
    const z = THREE.MathUtils.clamp(pose.z, bounds.minZ + MARGIN, bounds.maxZ - MARGIN)
    node.position.set(x, 0, z)

    if (!hungry && clock.walking) {
      const heading = petHeading(pet.id, home, clock.roam, 1)
      if (Math.hypot(heading.x, heading.z) > 0.01) yaw.current = Math.atan2(heading.x, heading.z)
    }
    node.rotation.y = yaw.current

    const motion: 'idle' | 'walk' = hungry || !clock.walking ? 'idle' : 'walk'
    partMatrices(model, motion, t + pet.id.length, matrices.current)
    for (let i = 0; i < model.parts.length; i++) {
      const mesh = parts.current[i]
      if (!mesh) continue
      mesh.matrix.copy(matrices.current[i])
      mesh.matrixWorldNeedsUpdate = true
    }
    if (blinkPart >= 0 && blinkMesh.current) {
      const blinking = isBlinking(t, pet.id.length * 0.31)
      const head = parts.current[blinkPart]
      if (head) head.visible = !blinking
      blinkMesh.current.visible = blinking
      blinkMesh.current.matrix.copy(matrices.current[blinkPart])
      blinkMesh.current.matrixWorldNeedsUpdate = true
    }
  })

  return (
    <group ref={root}>
      {/* 接触阴影不跟着模型缩放，单独一层 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} renderOrder={1}>
        <circleGeometry args={[Math.max(0.18, model.height * scale * 0.3), 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <group scale={scale}>
        {model.parts.map((part, i) => (
          <mesh
            key={`${part.name}-${i}`}
            ref={(mesh) => {
              parts.current[i] = mesh
            }}
            geometry={part.geometry}
            material={material}
            matrixAutoUpdate={false}
            castShadow
          />
        ))}
        {blinkPart >= 0 && (
          <mesh
            ref={blinkMesh}
            geometry={model.parts[blinkPart].blink as THREE.BufferGeometry}
            material={material}
            matrixAutoUpdate={false}
            visible={false}
          />
        )}
      </group>
    </group>
  )
}

export function HomePets({ pets, bounds }: { pets: AdoptedPet[]; bounds: Bounds }) {
  const homes = useMemo(() => homeSpots(bounds, pets.length), [bounds, pets.length])
  return (
    <group>
      {pets.map((pet, i) => (
        <HomePet key={pet.id} pet={pet} home={homes[i]} bounds={bounds} />
      ))}
    </group>
  )
}
