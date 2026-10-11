import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { fbm } from '../utils/noise'

/** 露出水面 / 半淹的岩石，手工布点，部分高于水位 */
const ROCKS: { p: [number, number, number]; s: number; seed: number }[] = [
  { p: [0.2, -0.1, 0.55], s: 0.24, seed: 1 },
  { p: [-0.34, -0.34, 0.28], s: 0.3, seed: 2 },
  { p: [0.54, -0.16, -0.14], s: 0.2, seed: 3 },
  { p: [1.0, -0.05, 0.3], s: 0.18, seed: 4 },
  { p: [-0.62, -0.42, -0.5], s: 0.33, seed: 5 },
  { p: [0.04, -0.08, 0.98], s: 0.16, seed: 6 },
  { p: [0.86, -0.3, -0.6], s: 0.22, seed: 7 },
]

function makeRock(seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 2)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const n = fbm(x * 1.7 + seed * 9.3, z * 1.7 - seed * 4.1, 3) * 0.3 + fbm(y * 2.4 + seed * 2.2, x * 2.4, 2) * 0.22
    const k = 1 + n
    pos.setXYZ(i, x * k, y * k * 0.85, z * k)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** 散布的岩石（部分露出水面） */
export default function Rocks() {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7c7264', roughness: 0.95, metalness: 0, flatShading: true }),
    [],
  )

  const rocks = useMemo(() => ROCKS.map((r) => ({ ...r, geo: makeRock(r.seed) })), [])

  useEffect(
    () => () => {
      material.dispose()
      rocks.forEach((r) => r.geo.dispose())
    },
    [material, rocks],
  )

  return (
    <group>
      {rocks.map((r, i) => (
        <mesh
          key={i}
          geometry={r.geo}
          material={material}
          position={r.p}
          scale={r.s}
          rotation={[r.seed * 0.9, r.seed * 2.3, r.seed * 0.7]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
