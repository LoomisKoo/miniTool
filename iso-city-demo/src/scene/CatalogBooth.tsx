// 图鉴亭：广场边的一个小展亭，走上前按 E 打开宠物图鉴。
//
// 不做成"贴一张海报"的牌子，是因为它需要是一个可以走到的地点：四柱撑起
// 雨檐、后面一块展板，人在亭下打开面板。构件都是盒子，没有贴图——
// 城市里的其他小设施也是这个路子，保持一致。

import * as THREE from 'three'
import { useMemo } from 'react'

const POST = '#4a5158'
const ROOF = '#333a43'
const BOARD = '#262c34'
const TRIM = '#79828d'

export function CatalogBooth({ x, z, yaw = 0 }: { x: number; z: number; yaw?: number }) {
  const postGeo = useMemo(() => new THREE.BoxGeometry(0.1, 2.2, 0.1), [])
  const capGeo = useMemo(() => new THREE.BoxGeometry(0.16, 0.1, 0.16), [])
  const boardGeo = useMemo(() => new THREE.BoxGeometry(2.2, 1.5, 0.08), [])

  const postMat = useMemo(() => new THREE.MeshStandardMaterial({ color: POST, roughness: 0.62, metalness: 0.28 }), [])
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: ROOF, roughness: 0.7, metalness: 0.2 }), [])
  const boardMat = useMemo(() => new THREE.MeshStandardMaterial({ color: BOARD, roughness: 0.5, metalness: 0.32 }), [])
  const trimMat = useMemo(() => new THREE.MeshStandardMaterial({ color: TRIM, roughness: 0.42, metalness: 0.42 }), [])
  const glowMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffce9a',
        emissive: '#ffb066',
        emissiveIntensity: 1.5,
        roughness: 0.4,
      }),
    [],
  )

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {/* 台基 */}
      <mesh position={[0, 0.07, 0]} material={trimMat} receiveShadow>
        <boxGeometry args={[2.7, 0.14, 2.1]} />
      </mesh>

      {/* 四柱 */}
      {[
        [-1.15, -0.85],
        [1.15, -0.85],
        [-1.15, 0.85],
        [1.15, 0.85],
      ].map(([px, pz], i) => (
        <mesh key={i} geometry={postGeo} material={postMat} position={[px, 1.24, pz]} castShadow />
      ))}
      {[
        [-1.15, -0.85],
        [1.15, -0.85],
        [-1.15, 0.85],
        [1.15, 0.85],
      ].map(([px, pz], i) => (
        <mesh key={`cap-${i}`} geometry={capGeo} material={trimMat} position={[px, 2.38, pz]} />
      ))}

      {/* 雨檐：两层，上大下小，靠轮廓分辨而不是靠贴图 */}
      <mesh position={[0, 2.5, 0]} material={roofMat} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.1, 2.4]} />
      </mesh>
      <mesh position={[0, 2.62, 0]} material={trimMat}>
        <boxGeometry args={[2.5, 0.08, 2.0]} />
      </mesh>

      {/* 后展板 */}
      <mesh geometry={boardGeo} material={boardMat} position={[0, 1.32, -0.85]} castShadow />
      {/* 板面上一排发光的小格：远看就知道这里在"展示什么" */}
      {[-0.66, 0, 0.66].map((px) => (
        <mesh key={px} material={glowMat} position={[px, 1.62, -0.79]}>
          <boxGeometry args={[0.3, 0.42, 0.03]} />
        </mesh>
      ))}
      {/* 板顶的名条 */}
      <mesh material={glowMat} position={[0, 2.16, -0.79]}>
        <boxGeometry args={[1.5, 0.075, 0.03]} />
      </mesh>

      {/* 台面上的一小块操作面：有它才像"可以凑近看"的设施 */}
      <mesh material={trimMat} position={[0, 1.02, 0.2]} rotation={[-0.28, 0, 0]}>
        <boxGeometry args={[1.1, 0.05, 0.55]} />
      </mesh>
    </group>
  )
}
