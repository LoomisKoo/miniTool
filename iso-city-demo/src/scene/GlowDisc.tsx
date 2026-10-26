import { useMemo } from 'react'
import * as THREE from 'three'

// 用一张共享的径向渐变贴图代替点光源做"光晕"。
// 夜间如果给每盏灯、每个行人、每间店铺都挂 pointLight，碎片着色器要循环几十个光源，
// 帧时间会成倍上升；改用加色混合的小平面，视觉接近但几乎不花钱。

const cache = new Map<string, THREE.CanvasTexture>()

function radialTexture(color: string) {
  const cached = cache.get(color)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 1, 64, 64, 64)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.32, `${color}aa`)
  gradient.addColorStop(0.66, `${color}40`)
  gradient.addColorStop(1, '#00000000')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  cache.set(color, texture)
  return texture
}

export function GlowDisc({
  position,
  size,
  color,
  opacity = 0.4,
  vertical = false,
}: {
  position: [number, number, number]
  size: number
  color: string
  opacity?: number
  vertical?: boolean
}) {
  const texture = useMemo(() => radialTexture(color), [color])
  return (
    <mesh
      position={position}
      rotation={vertical ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
      renderOrder={3}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        // 和地面光池同理：路面/铺装都带斜率相关的负深度偏移，
        // 光晕只要贴着它们就会被切掉一角，这里也要往相机方向再压一次。
        polygonOffset
        polygonOffsetFactor={-16}
        polygonOffsetUnits={-32}
      />
    </mesh>
  )
}
