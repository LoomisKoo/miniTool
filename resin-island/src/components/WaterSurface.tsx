import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WATER_Y, WATER_SIZE } from '../config/scene'
import { createWaterMaterial, type WaterUniforms } from '../materials/waterMaterial'
import { useQuality } from '../hooks/useQuality'
import { useParams } from '../context/ParamsContext'

interface Props {
  uniforms: WaterUniforms
  setPointer: (u: number, v: number) => void
}

/**
 * 块体顶部的动态水面。
 * 几何在本地空间先 rotateX 后展开到 XZ，uv 与高度场纹理、指针命中 uv 严格一致。
 */
export default function WaterSurface({ uniforms, setPointer }: Props) {
  const { settings } = useQuality()
  const { paramsRef } = useParams()
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => createWaterMaterial(uniforms), [uniforms])

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, settings.waterSeg, settings.waterSeg)
    g.rotateX(-Math.PI / 2)
    return g
  }, [settings.waterSeg])

  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
    },
    [material, geometry],
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (mesh) mesh.position.y = WATER_Y + paramsRef.current.surface.tide * 0.12
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, WATER_Y, 0]}
      onPointerMove={(e) => {
        if (e.uv) setPointer(e.uv.x, e.uv.y)
      }}
    />
  )
}
