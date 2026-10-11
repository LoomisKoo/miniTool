import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BLOCK, SEABED_Y } from '../config/scene'
import { createSeabedMaterial, type SeabedUniforms } from '../materials/seabedMaterial'

interface Props {
  uniforms: SeabedUniforms
}

/** 块体内部的沙色海床（带程序化焦散光斑） */
export default function Seabed({ uniforms }: Props) {
  const material = useMemo(() => createSeabedMaterial(uniforms), [uniforms])

  const geometry = useMemo(() => new THREE.BoxGeometry(BLOCK.size - 0.05, 0.14, BLOCK.size - 0.05, 1, 1, 1), [])

  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
    },
    [material, geometry],
  )

  useFrame((_, rawDelta) => {
    uniforms.uTime.value += Math.min(rawDelta, 1 / 30)
  })

  return (
    <mesh geometry={geometry} material={material} position={[0, SEABED_Y - 0.075, 0]} receiveShadow />
  )
}
