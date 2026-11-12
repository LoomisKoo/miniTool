import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { plaza } from '../data/city'
import { parks, type Park } from '../data/parks'
import { makeGrainTexture } from './textures'
import { GROUND_DEPTH } from './style'
import { GlowDisc } from './GlowDisc'

/**
 * 公园：草坪 + 十字园路 + 水池。
 *
 * 城市原先只有"楼、路、树"三样，俯视时是一张黄绿噪点图，中间没有可以喘气
 * 的空地。公园是画面上唯一"低矮、深绿、带水面"的区域，它同时也是
 * 树多的解药：一片草坪立刻把周围的树压成"围绕绿地的树"。
 */

/** 草坪：一片很平的草地，靠噪声贴图做深浅，不铺砖缝。 */
function Lawn({ p, night, y = 0.036 }: { p: Park; night: boolean; y?: number }) {
  const texture = useMemo(() => makeGrainTexture(256, 0.3, 260), [])
  useEffect(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(p.w / 9, p.d / 9)
  }, [texture, p.w, p.d])

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      map: texture,
      // 白天是草绿，夜里压到接近树冠的深绿：公园不能比楼还亮
      color: night ? '#243a2b' : '#6f9a5c',
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.2,
    })
    // 和铺装同高，靠分层偏移决定先后（草坪压在铺装补片之上）
    m.polygonOffset = true
    m.polygonOffsetFactor = GROUND_DEPTH.pavingPatch.polygonOffsetFactor
    m.polygonOffsetUnits = GROUND_DEPTH.pavingPatch.polygonOffsetUnits
    return m
  }, [texture, night])

  useEffect(
    () => () => {
      material.dispose()
      texture.dispose()
    },
    [material, texture],
  )

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[p.x, y, p.z]}
      receiveShadow
      material={material}
      userData={{ noMerge: true }}
    >
      <planeGeometry args={[p.w, p.d]} />
    </mesh>
  )
}

/** 十字园路：两条浅色砂石带，把草坪分成四块，也是"这是公园"的形状线索。 */
function Paths({ p, night }: { p: Park; night: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#565048' : '#c9c0ac',
        roughness: 0.95,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: GROUND_DEPTH.marking.polygonOffsetFactor,
        polygonOffsetUnits: GROUND_DEPTH.marking.polygonOffsetUnits,
      }),
    [night],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const w = 4
  return (
    <group position={[p.x, 0.039, p.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mat} userData={{ noMerge: true }}>
        <planeGeometry args={[p.w, w]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mat} userData={{ noMerge: true }}>
        <planeGeometry args={[w, p.d]} />
      </mesh>
    </group>
  )
}

/** 园心水池：石沿 + 水面 + 细水柱，夜里水面自己发光。 */
function PondBody({ p, night }: { p: Park; night: boolean }) {
  if (!p.pond) return null
  const r = p.pond.r
  return (
    <group position={[p.x, 0, p.z]}>
      {/* 石沿比草坪亮一档，从高处能读出公园的中心 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.042, 0]} receiveShadow userData={{ noMerge: true }}>
        <ringGeometry args={[r, r + 1.1, 40]} />
        <meshStandardMaterial color={night ? '#3b3a36' : '#b7b1a2'} roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} userData={{ noMerge: true }}>
        <circleGeometry args={[r, 40]} />
        <meshStandardMaterial
          color={night ? '#0f2c3c' : '#6f8f96'}
          roughness={0.08}
          metalness={0.55}
          emissive={night ? '#1a6a8a' : '#000000'}
          emissiveIntensity={night ? 0.85 : 0}
        />
      </mesh>
      {/* 水柱：细锥 + 落水环，夜景里是公园唯一的亮色 */}
      <mesh position={[0, 1.1, 0]} userData={{ noMerge: true }}>
        <cylinderGeometry args={[0.12, 0.34, 2.2, 10, 1, true]} />
        <meshBasicMaterial
          color={night ? '#9fd8dc' : '#e4f2f3'}
          transparent
          opacity={night ? 0.42 : 0.28}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.047, 0]} userData={{ noMerge: true }}>
        <ringGeometry args={[r * 0.42, r * 0.86, 32]} />
        <meshBasicMaterial
          color={night ? '#9fd8dc' : '#e8f4f4'}
          transparent
          opacity={night ? 0.16 : 0.1}
          toneMapped={false}
        />
      </mesh>
      {night && <GlowDisc position={[p.x, 0.3, p.z]} size={(r + 3) * 2} color="#8fd0d8" opacity={0.14} />}
    </group>
  )
}

/**
 * 市中心广场的公园化。
 *
 * 广场本来就是全城唯一的大空地，但一直是整片灰色铺装 + 一个喷泉：
 * 从高处看，城市中间是一块"停车场"。这里把广场中心收成草坪，
 * 四周留 4m 铺装当环形步道，喷泉落在草坪中央——参考图里
 * "城市中心一大片绿地 + 中心水景"的关系就出来了。
 */
const PLAZA_PARK: Park = {
  x: plaza.x,
  z: plaza.z,
  w: plaza.w - 8,
  d: plaza.d - 8,
}

export function Parks({ night }: { night: boolean }) {
  return (
    <group>
      {/* 广场草坪压在铺装之上 1mm，靠 pavingPatch 的深度台阶保证顺序 */}
      <Lawn p={PLAZA_PARK} night={night} y={0.031} />
      {parks.map((p, i) => (
        <group key={i}>
          <Lawn p={p} night={night} />
          <Paths p={p} night={night} />
          <PondBody p={p} night={night} />
        </group>
      ))}
    </group>
  )
}

/** 公园水池的碰撞盒（给 PlayerRig 用） */
export const pondColliders = parks
  .filter((p) => p.pond)
  .map((p) => ({
    minX: p.x - p.pond!.r - 0.6,
    maxX: p.x + p.pond!.r + 0.6,
    minZ: p.z - p.pond!.r - 0.6,
    maxZ: p.z + p.pond!.r + 0.6,
    minY: 0,
    maxY: 2,
  }))
