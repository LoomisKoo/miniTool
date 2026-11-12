// 天台：电梯的 RF 层。
//
// 天台没有户型平面，所以不能走 BuildingInterior 那一套。它是一块铺在楼体
// 顶面的平台：女儿墙、电梯机房、水箱、排风管，加上一个烟花发射台。
//
// 坐标原点 = 楼栋中心，y=0 = 屋面。CityBackdrop 用 origin [0,0] + 顶层以上
// 的标高往下折，所以从平台边缘往下看能看到自己这栋楼外面的城市。
//
// 电梯井的位置直接取本层平面的 hall.elevator，机房就压在它上面——
// 这是"表里如一"：电梯在楼下停在哪，机房就该在楼顶的哪个位置。

import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useApp } from '../store'
import { floorsOf, layoutOf, unitBuilding, type Side } from '../data/units'
import { buildingZone, ZONE_LABEL } from '../data/features'
import { PlayerRig, type Collider, type Interactable } from '../scene/PlayerRig'
import { Marker } from '../scene/Markers'
import { Fireworks } from '../scene/Fireworks'
import { CityBackdrop } from './CityBackdrop'
import { launchFromRoof, launchesLeft, roofAllowsFireworks, DAILY_LAUNCHES } from '../game/roof'
import { makeGrainTexture, makeSignTexture } from '../scene/textures'

/** 女儿墙高与厚。 */
const PARAPET = 1.15
const PARAPET_T = 0.3
/** 平台四周留的净空。 */
const EDGE = 0.55

function RoofDeck({ buildingId }: { buildingId: string }) {
  const building = unitBuilding(buildingId)
  const openElevator = useApp((state) => state.openElevator)

  const plan = useMemo(() => {
    if (!building) return null
    const top = floorsOf(building)
    const layout = layoutOf(building, top)
    const hall = layout.halls[0]
    // 电梯井在楼栋局部坐标里的位置：side 决定贴哪面墙，at 是沿墙坐标
    const lift = hall?.elevator ?? { side: 's' as Side, at: 0 }
    const W = building.w
    const D = building.d
    const half = (s: Side) => (s === 'n' ? -D / 2 : s === 's' ? D / 2 : s === 'w' ? -W / 2 : W / 2)
    const axis = lift.side === 'n' || lift.side === 's'
    const cx = axis ? lift.at : half(lift.side) - Math.sign(half(lift.side)) * 1.9
    const cz = axis ? half(lift.side) - Math.sign(half(lift.side)) * 1.9 : lift.at
    return {
      W,
      D,
      top,
      lift: { x: cx, z: cz, side: lift.side },
      zone: buildingZone(buildingId),
    }
  }, [building, buildingId])

  const groundMap = useMemo(() => {
    const tex = makeGrainTexture(256, 0.34, 520)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(6, 6)
    return tex
  }, [])

  const roofSign = useMemo(() => makeSignTexture(`${building?.name ?? ''} · RF`, '#242b31'), [building?.name])
  useEffect(() => () => roofSign.dispose(), [roofSign])
  // 次数存在 localStorage 里，不走 React，所以点完火要手动刷新一次
  const [left, setLeft] = useState(() => launchesLeft())
  if (!building || !plan) return null
  const { W, D, lift, zone } = plan
  const allows = roofAllowsFireworks(buildingId)

  // 发射台放在楼顶另一侧的空地上，避开机房
  const padX = THREE.MathUtils.clamp(-lift.x * 0.6, -W / 2 + 3, W / 2 - 3)
  const padZ = THREE.MathUtils.clamp(-lift.z * 0.6, -D / 2 + 3, D / 2 - 3)
  const fire = () => {
    launchFromRoof(buildingId, padX, 1.3, padZ)
    setLeft(launchesLeft())
  }
  const bounds = {
    minX: -W / 2 + EDGE,
    maxX: W / 2 - EDGE,
    minZ: -D / 2 + EDGE,
    maxZ: D / 2 - EDGE,
  }

  const colliders: Collider[] = [
    // 机房：一整间都是实体，能从门进去只是视觉上"门开着"
    { minX: lift.x - 1.6, maxX: lift.x + 1.6, minZ: lift.z - 1.6, maxZ: lift.z + 1.6, minY: 0, maxY: 3 },
    // 发射台底座
    { minX: padX - 0.9, maxX: padX + 0.9, minZ: padZ - 0.9, maxZ: padZ + 0.9, minY: 0, maxY: 1.2, camera: false },
  ]

  const start: [number, number] = [lift.x + (lift.x > 0 ? -2.4 : 2.4), lift.z + (lift.z > 0 ? -2.4 : 2.4)]
  const startYaw = Math.atan2(-(padX - start[0]), -(padZ - start[1]))

  const interactables: Interactable[] = [
    {
      id: 'roof-launcher',
      label: '烟花发射台',
      hint: allows
        ? `按 E 点火 · 今天还能放 ${left}/${DAILY_LAUNCHES} 轮`
        : '老街区安静区 · 不放烟花',
      x: padX + 1.2,
      z: padZ,
      radius: 2.6,
      action: fire,
    },
    {
      id: 'roof-elevator',
      label: '电梯',
      hint: '下楼',
      x: lift.x,
      z: lift.z + 2.6,
      radius: 2.4,
      action: () => openElevator(buildingId),
    },
  ]

  return (
    <group>
      {/* 周围的城市：往下折到本层楼顶的标高。
          这里传一个永远匹配不到任何户的 cut——目的是让 CityBackdrop 肯画本栋楼壳
          （它只在 cut 非空时才画），这样从天台边缘往下看不会是一栋空心楼。 */}
      <CityBackdrop buildingId={buildingId} floor={plan.top + 1} origin={[0, 0]} cut={{ floor: 0, owner: 'roof' }} />

      {/* 屋面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={groundMap} color="#a9a49b" roughness={0.94} metalness={0.03} />
      </mesh>

      {/* 女儿墙：四面各一条，顶上加一圈压顶 */}
      {[
        { x: 0, z: -D / 2 + PARAPET_T / 2, w: W, d: PARAPET_T },
        { x: 0, z: D / 2 - PARAPET_T / 2, w: W, d: PARAPET_T },
        { x: -W / 2 + PARAPET_T / 2, z: 0, w: PARAPET_T, d: D - PARAPET_T * 2 },
        { x: W / 2 - PARAPET_T / 2, z: 0, w: PARAPET_T, d: D - PARAPET_T * 2 },
      ].map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, PARAPET / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[p.w, PARAPET, p.d]} />
            <meshStandardMaterial color="#cfc9bd" roughness={0.9} />
          </mesh>
          <mesh position={[0, PARAPET + 0.03, 0]} castShadow>
            <boxGeometry args={[p.w + 0.08, 0.07, p.d + 0.08]} />
            <meshStandardMaterial color="#8f8a80" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* 电梯机房：压在电梯井正上方，门朝楼顶中央 */}
      <group position={[lift.x, 0, lift.z]}>
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 3, 3.2]} />
          <meshStandardMaterial color="#b6b1a6" roughness={0.92} />
        </mesh>
        <mesh position={[0, 3.06, 0]} castShadow>
          <boxGeometry args={[3.4, 0.12, 3.4]} />
          <meshStandardMaterial color="#8b877e" roughness={0.85} />
        </mesh>
        {/* 机房门口朝向楼顶中央 */}
        <mesh
          position={[lift.x > 0 ? -1.62 : 1.62, 1.05, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[1.0, 2.1]} />
          <meshStandardMaterial color="#4b4f52" roughness={0.6} metalness={0.3} />
        </mesh>
        <pointLight position={[0, 2.4, 0]} color="#ffd9a0" intensity={0.8} distance={6} decay={2} />
      </group>

      {/* 水箱：一根柱子托一个圆柱，楼顶最容易认出来的东西 */}
      <group position={[W / 2 - 3.2, 0, -D / 2 + 3.2]}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.7, 0.7, Math.sin(a) * 0.7]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 1.4, 6]} />
              <meshStandardMaterial color="#7d7a72" metalness={0.5} roughness={0.5} />
            </mesh>
          )
        })}
        <mesh position={[0, 2.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.15, 1.15, 1.3, 18]} />
          <meshStandardMaterial color="#d9d3c6" roughness={0.8} metalness={0.15} />
        </mesh>
        <mesh position={[0, 2.78, 0]} castShadow>
          <coneGeometry args={[1.2, 0.36, 18]} />
          <meshStandardMaterial color="#9a958b" roughness={0.8} />
        </mesh>
      </group>

      {/* 排风管：几根粗细不同的竖管，打破屋面的空 */}
      {[
        [-W / 2 + 3.6, D / 2 - 4.2, 0.34, 1.5],
        [-W / 2 + 5.2, D / 2 - 6.4, 0.22, 1.1],
        [W / 2 - 5.6, D / 2 - 3.4, 0.26, 0.9],
      ].map(([x, z, r, h], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, h / 2, 0]} castShadow>
            <cylinderGeometry args={[r, r, h, 10]} />
            <meshStandardMaterial color="#9aa0a3" metalness={0.55} roughness={0.5} />
          </mesh>
          <mesh position={[0, h + 0.06, 0]} castShadow>
            <cylinderGeometry args={[r * 1.6, r * 1.6, 0.1, 10]} />
            <meshStandardMaterial color="#6f7478" metalness={0.6} roughness={0.45} />
          </mesh>
        </group>
      ))}

      {/* 发射台：金属底座 + 一排发射管 + 点火柱 */}
      <group position={[padX, 0, padZ]}>
        <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.28, 1.7]} />
          <meshStandardMaterial color="#3a3f48" roughness={0.7} metalness={0.4} />
        </mesh>
        {[-0.42, 0, 0.42].flatMap((x) =>
          [-0.42, 0, 0.42].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.62, z]} rotation={[x * 0.3, 0, -z * 0.3]} castShadow>
              <cylinderGeometry args={[0.13, 0.15, 0.62, 10, 1, true]} />
              <meshStandardMaterial color="#b43a3a" roughness={0.6} side={THREE.DoubleSide} />
            </mesh>
          )),
        )}
        <mesh position={[1.2, 0.5, 0]} castShadow>
          <boxGeometry args={[0.26, 1.0, 0.26]} />
          <meshStandardMaterial color="#2c3036" roughness={0.6} />
        </mesh>
        <mesh position={[1.2, 1.03, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.06, 14]} />
          <meshStandardMaterial
            color={allows && left > 0 ? '#ff4d4d' : '#6a4a4a'}
            emissive={allows && left > 0 ? '#ff2a2a' : '#000000'}
            emissiveIntensity={allows && left > 0 ? 1.4 : 0}
          />
        </mesh>
        {allows && left > 0 && (
          <pointLight position={[1.2, 1.2, 0]} color="#ff6a5a" intensity={0.9} distance={4} decay={2} />
        )}
      </group>

      {/* 天台是公共的：一块写着楼名和楼层的牌子 */}
      <group position={[lift.x + (lift.x > 0 ? -2.0 : 2.0), 2.05, lift.z]}>
        <mesh>
          <boxGeometry args={[0.06, 0.5, 1.5]} />
          <meshStandardMaterial color="#3d4348" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[lift.x > 0 ? -0.05 : 0.05, 0, 0]} rotation={[0, lift.x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <planeGeometry args={[1.4, 0.35]} />
          <meshBasicMaterial map={roofSign} toneMapped={false} />
        </mesh>
      </group>

      <Marker
            x={padX + 1.2}
            z={padZ}
            y={2.4}
            title="烟花发射台"
            subtitle={
              allows ? `今天 ${left}/${DAILY_LAUNCHES} 轮 · ${ZONE_LABEL[zone]}` : `${ZONE_LABEL[zone]} · 安静区`
            }
            tone="space"
            actionId="roof-launcher"
            onOpen={fire}
          />
          <Marker
            x={lift.x}
            z={lift.z + 2.6}
            y={2.2}
            title="电梯"
            subtitle={building.name}
            tone="kiosk"
            actionId="roof-elevator"
            onOpen={() => openElevator(buildingId)}
          />

      {/* 烟花：这里的坐标就是天台局部坐标，不需要换算 */}
      <Fireworks showLauncher={false} />

      <PlayerRig
        start={start}
        startYaw={startYaw}
        bounds={bounds}
        colliders={colliders}
        interactables={interactables}
        cameraDistance={7.2}
        interior
      />
    </group>
  )
}

export { RoofDeck }
