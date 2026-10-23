import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { benches, lamps, planters, plazaFountain, trees } from '../data/city'
import { infillLamps } from '../data/infill'
import { useApp } from '../store'
import { makeArtTexture } from './textures'
import { palettes, type Palette } from './theme'
import { GlowDisc } from './GlowDisc'

function Tree({ x, z, scale = 1, palette }: { x: number; z: number; scale?: number; palette: Palette }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.3, 3.2, 8]} />
        <meshStandardMaterial color={palette.key === 'night' ? '#2a2a26' : '#7a6550'} roughness={1} />
      </mesh>
      <mesh position={[0, 3.4, 0]} castShadow>
        <icosahedronGeometry args={[1.45, 1]} />
        <meshStandardMaterial color={palette.tree} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.65, 3.9, 0.2]} castShadow>
        <icosahedronGeometry args={[1.0, 1]} />
        <meshStandardMaterial color={palette.tree} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[-0.55, 4.1, -0.25]} castShadow>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color={palette.treeDark} roughness={0.95} flatShading />
      </mesh>
      {palette.key === 'night' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <circleGeometry args={[1.5, 20]} />
          <meshBasicMaterial color={palette.ar} transparent opacity={0.05} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function Lamp({
  x,
  z,
  palette,
  lit = false,
}: {
  x: number
  z: number
  palette: Palette
  lit?: boolean
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 5, 8]} />
        <meshStandardMaterial
          color={palette.key === 'night' ? '#33414f' : '#4d5451'}
          roughness={0.45}
          metalness={0.55}
        />
      </mesh>
      <mesh position={[0.5, 4.95, 0]} castShadow>
        <boxGeometry args={[1.1, 0.1, 0.12]} />
        <meshStandardMaterial color={palette.trim} roughness={0.45} metalness={0.55} />
      </mesh>
      <mesh position={[0.98, 4.84, 0]}>
        <boxGeometry args={[0.56, 0.16, 0.32]} />
        <meshStandardMaterial color="#ffe7c2" emissive="#ffd6a0" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      {lit && palette.key === 'night' && (
        <GlowDisc position={[0.98, 4.7, 0]} size={3.4} color="#ffd8a8" opacity={0.5} vertical />
      )}
    </group>
  )
}

function Bench({ x, z, rot, palette }: { x: number; z: number; rot: number; palette: Palette }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.12, 0.66]} />
        <meshStandardMaterial color={palette.key === 'night' ? '#3b4b5b' : '#8a7255'} roughness={0.75} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.88, -0.28]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[2.4, 0.64, 0.1]} />
        <meshStandardMaterial color={palette.key === 'night' ? '#3b4b5b' : '#8a7255'} roughness={0.75} metalness={0.15} />
      </mesh>
      {[-0.9, 0.9].map((sx) => (
        <mesh key={sx} position={[sx, 0.24, 0]} castShadow>
          <boxGeometry args={[0.09, 0.48, 0.56]} />
          <meshStandardMaterial color={palette.trim} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function Planter({ x, z, size, palette }: { x: number; z: number; size: number; palette: Palette }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
        <boxGeometry args={[size * 2, 0.68, size * 1.3]} />
        <meshStandardMaterial color={palette.trim} roughness={0.75} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[size * 1.8, 0.8, size * 1.1]} />
        <meshStandardMaterial color={palette.tree} roughness={1} flatShading />
      </mesh>
      {palette.key === 'night' && (
        <mesh position={[0, 0.72, size * 0.66]}>
          <boxGeometry args={[size * 1.7, 0.03, 0.03]} />
          <meshBasicMaterial color={palette.ar} toneMapped={false} transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  )
}

function Fountain({ palette }: { palette: Palette }) {
  const { x, z, r } = plazaFountain
  const water = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!water.current) return
    const mat = water.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.12 + Math.sin(state.clock.elapsedTime * 0.9) * 0.06
  })

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.28, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[r, r + 0.2, 0.56, 44]} />
        <meshStandardMaterial color={palette.key === 'night' ? '#31404f' : '#c5bdae'} roughness={0.62} metalness={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.57, 0]}>
        <circleGeometry args={[r - 0.55, 44]} />
        <meshStandardMaterial
          color={palette.key === 'night' ? '#0e3346' : '#7f9ba0'}
          roughness={0.1}
          metalness={0.6}
          emissive={palette.key === 'night' ? '#1d7ea0' : '#000000'}
          emissiveIntensity={0.7}
        />
      </mesh>
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.585, 0]}>
        <ringGeometry args={[r - 3.4, r - 0.7, 44]} />
        <meshBasicMaterial color={palette.glowCyan} transparent opacity={0.18} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.72, 1.5, 20]} />
        <meshStandardMaterial color={palette.key === 'night' ? '#33424f' : '#cfc7b8'} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 2.12, 0]} castShadow>
        <cylinderGeometry args={[1.5, 1.62, 0.16, 32]} />
        <meshStandardMaterial color={palette.key === 'night' ? '#33424f' : '#c5bdae'} roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.21, 0]}>
        <circleGeometry args={[1.35, 32]} />
        <meshStandardMaterial
          color={palette.key === 'night' ? '#123a4c' : '#8fa9ac'}
          roughness={0.08}
          metalness={0.65}
          emissive={palette.key === 'night' ? '#2a8fae' : '#000000'}
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[0, 2.9, 0]}>
        <cylinderGeometry args={[0.1, 0.16, 1.5, 12]} />
        <meshStandardMaterial color={palette.trim} roughness={0.6} metalness={0.3} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + 0.4
        return (
          <mesh key={i} position={[Math.cos(angle) * 1.1, 2.75, Math.sin(angle) * 1.1]}>
            <cylinderGeometry args={[0.035, 0.06, 1.3, 6]} />
            <meshBasicMaterial color={palette.glowCyan} transparent opacity={0.4} toneMapped={false} />
          </mesh>
        )
      })}
      {palette.key === 'night' && (
        <>
          <GlowDisc position={[0, 0.66, 0]} size={r * 6} color="#63d8f5" opacity={0.16} />
          <pointLight position={[0, 2.2, 0]} color="#63d8f5" intensity={16} distance={22} decay={2} />
          <mesh position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r + 0.05, r + 0.25, 48]} />
            <meshBasicMaterial color={palette.ar} transparent opacity={0.5} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  )
}

function StringLights({ palette }: { palette: Palette }) {
  const strands = useMemo(
    () =>
      [-16, -2, 12].map((z) => {
        const points = [
          new THREE.Vector3(15.2, 4.4, z),
          new THREE.Vector3(19, 3.6, z + 1.2),
          new THREE.Vector3(23, 3.5, z),
          new THREE.Vector3(26.8, 4.3, z + 0.8),
        ]
        return new THREE.CatmullRomCurve3(points)
      }),
    [],
  )
  const bulbColors = useMemo(
    () => [palette.glowWarm, palette.glowCyan, palette.glowWarm, '#ffd9a6'],
    [palette],
  )
  return (
    <group>
      {strands.map((curve, si) => (
        <group key={si}>
          <mesh>
            <tubeGeometry args={[curve, 24, 0.014, 4, false]} />
            <meshBasicMaterial color={palette.key === 'night' ? '#1d2a36' : '#494b45'} />
          </mesh>
          {Array.from({ length: 7 }).map((_, i) => {
            const point = curve.getPoint((i + 1) / 8)
            return (
              <mesh key={i} position={[point.x, point.y - 0.08, point.z]}>
                <sphereGeometry args={[0.075, 8, 8]} />
                <meshStandardMaterial
                  color={bulbColors[i % bulbColors.length]}
                  emissive={bulbColors[i % bulbColors.length]}
                  emissiveIntensity={3.2}
                  toneMapped={false}
                />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

/** 全息广告牌：夜间城市里最重要的 AR 元素。 */
function HoloBoard({
  position,
  rotation,
  width = 6,
  height = 3,
  label,
  palette,
}: {
  position: [number, number, number]
  rotation: number
  width?: number
  height?: number
  label: string
  palette: Palette
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#04121d'
    ctx.fillRect(0, 0, 512, 256)
    const g = ctx.createLinearGradient(0, 0, 512, 256)
    g.addColorStop(0, 'rgba(88,226,255,0.34)')
    g.addColorStop(1, 'rgba(88,226,255,0.04)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 256)
    ctx.strokeStyle = 'rgba(120,236,255,0.65)'
    ctx.lineWidth = 2
    ctx.strokeRect(12, 12, 488, 232)
    ctx.fillStyle = '#b9f2ff'
    ctx.font = '600 62px "Helvetica Neue", Arial, sans-serif'
    ctx.fillText(label, 34, 138, 440)
    ctx.font = '400 22px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = 'rgba(185,242,255,0.6)'
    ctx.fillText('LUMEN DISTRICT · LIVE', 34, 180)
    ctx.fillStyle = 'rgba(120,236,255,0.85)'
    for (let i = 0; i < 26; i++) {
      ctx.fillRect(34 + i * 17, 204, 9, 3)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [label])

  useEffectDispose(texture)

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent opacity={palette.key === 'night' ? 0.92 : 0.7} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 0.3, height + 0.3]} />
        <meshBasicMaterial color={palette.ar} transparent opacity={0.14} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}

function useEffectDispose(texture: THREE.Texture) {
  useEffect(() => () => texture.dispose(), [texture])
}

export function CityProps() {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const graffiti = useMemo(() => makeArtTexture('signal', 1), [])

  return (
    <group>
      {trees.map(([x, z, s], i) => (
        <Tree key={i} x={x} z={z} scale={s} palette={palette} />
      ))}
      {lamps.map(([x, z], i) => (
        <Lamp key={i} x={x} z={z} palette={palette} lit={i % 3 === 0} />
      ))}
      {infillLamps.map(([x, z], i) => (
        <Lamp key={`i${i}`} x={x} z={z} palette={palette} lit={i % 2 === 0} />
      ))}
      {benches.map(([x, z, rot], i) => (
        <Bench key={i} x={x} z={z} rot={rot} palette={palette} />
      ))}
      {planters.map(([x, z, s], i) => (
        <Planter key={i} x={x} z={z} size={s} palette={palette} />
      ))}
      <Fountain palette={palette} />
      <StringLights palette={palette} />

      <HoloBoard position={[27.4, 8.6, 6]} rotation={-Math.PI / 2} width={7} height={3.6} label="ECHO ALLEY" palette={palette} />
      <HoloBoard position={[-45.6, 12.4, 14]} rotation={Math.PI / 2} width={7.4} height={3.8} label="LUMA GALLERY" palette={palette} />
      <HoloBoard position={[41.6, 20, 44]} rotation={Math.PI} width={8} height={4} label="LUMEN 24H" palette={palette} />
      <HoloBoard position={[-88.6, 9.2, -30]} rotation={Math.PI / 2} width={7} height={3.4} label="WEST LINE" palette={palette} />

      <group position={[27.85, 2.1, 2]}>
        <mesh rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[7.2, 3.4]} />
          <meshBasicMaterial map={graffiti} toneMapped={false} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 1.95, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[7.4, 0.12]} />
          <meshBasicMaterial color={palette.ar} toneMapped={false} transparent opacity={0.6} />
        </mesh>
      </group>

      {/* 自行车架与路灯箱，增加街道的小尺度细节 */}
      {[
        [12.4, 24.4],
        [12.4, 33.2],
        [-12.4, -36],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 0.08, 20]} />
            <meshStandardMaterial color={palette.trim} roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.72, 8]} />
            <meshStandardMaterial color={palette.trim} metalness={0.55} roughness={0.4} />
          </mesh>
          {[0.9, Math.PI + 0.2].map((a, j) => (
            <group key={j} position={[Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2]} rotation={[0, -a, 0]}>
              <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[0.5, 0.1, 0.85]} />
                <meshStandardMaterial color={palette.trim} roughness={0.55} metalness={0.4} />
              </mesh>
              <mesh position={[0, 0.72, -0.22]}>
                <boxGeometry args={[0.5, 0.5, 0.09]} />
                <meshStandardMaterial color={palette.trim} roughness={0.55} metalness={0.4} />
              </mesh>
              {[-0.4, 0.4].map((wz) => (
                <mesh key={wz} position={[0, 0.36, wz]} rotation={[0, 0, Math.PI / 2]}>
                  <torusGeometry args={[0.28, 0.035, 8, 20]} />
                  <meshStandardMaterial color={palette.key === 'night' ? '#1d2a36' : '#3d4348'} roughness={0.7} metalness={0.4} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}

      {/* 街道指示牌 */}
      <group position={[-13.9, 0, 12]}>
        <mesh position={[0, 2.6, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.075, 5.2, 8]} />
          <meshStandardMaterial color={palette.trim} metalness={0.55} roughness={0.4} />
        </mesh>
        <mesh position={[0.75, 4.6, 0]} castShadow>
          <boxGeometry args={[1.7, 0.62, 0.07]} />
          <meshStandardMaterial color={palette.key === 'night' ? '#12293a' : '#254a52'} emissive={palette.ar} emissiveIntensity={0.4} roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0.75, 2.9, 0]}>
          <boxGeometry args={[1.5, 0.5, 0.07]} />
          <meshStandardMaterial color={palette.key === 'night' ? '#12293a' : '#254a52'} emissive={palette.ar} emissiveIntensity={0.3} roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
    </group>
  )
}
