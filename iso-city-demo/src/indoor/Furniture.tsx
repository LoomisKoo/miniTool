import * as THREE from 'three'
import type { FurnitureItem, FurnitureType } from '../types'

export const FURNITURE_META: Record<
  FurnitureType,
  { label: string; glyph: string; color: string; w: number; d: number; h: number; walk?: boolean }
> = {
  sofa: { label: '沙发', glyph: '▭', color: '#6f7f74', w: 2.0, d: 0.9, h: 0.9, walk: true },
  table: { label: '茶几', glyph: '▱', color: '#8a6a4b', w: 1.4, d: 0.85, h: 0.76, walk: true },
  chair: { label: '椅子', glyph: '▤', color: '#8e7d65', w: 0.6, d: 0.6, h: 0.95 },
  shelf: { label: '书架', glyph: '▥', color: '#9a7d5d', w: 1.5, d: 0.45, h: 1.95, walk: true },
  plant: { label: '绿植', glyph: '❧', color: '#587a58', w: 0.7, d: 0.7, h: 1.5 },
  lamp: { label: '落地灯', glyph: '✦', color: '#c9a15c', w: 0.45, d: 0.45, h: 1.7 },
  rug: { label: '地毯', glyph: '▦', color: '#b7a58e', w: 3.2, d: 2.4, h: 0.03 },
  desk: { label: '书桌', glyph: '▰', color: '#7d6a52', w: 1.7, d: 0.8, h: 0.78, walk: true },
  bench: { label: '长凳', glyph: '▬', color: '#7c6a55', w: 1.7, d: 0.5, h: 0.5, walk: true },
  pedestal: { label: '展台', glyph: '◫', color: '#ded8cc', w: 0.6, d: 0.6, h: 1.3, walk: true },
  speaker: { label: '音箱', glyph: '◉', color: '#3f4543', w: 0.65, d: 0.55, h: 1.3, walk: true },
  bed: { label: '床', glyph: '▭', color: '#8c9a92', w: 1.7, d: 2.2, h: 0.7, walk: true },
  stool: { label: '圆凳', glyph: '◍', color: '#a9853f', w: 0.5, d: 0.5, h: 0.48 },
  counter: { label: '吧台', glyph: '▬', color: '#7a6650', w: 2.2, d: 0.7, h: 1.05, walk: true },
}

function Legs({ w, d, h = 0.5 }: { w: number; d: number; h?: number }) {
  return (
    <>
      {[
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2, z]} castShadow>
          <boxGeometry args={[0.06, h, 0.06]} />
          <meshStandardMaterial color="#5b5146" roughness={0.8} />
        </mesh>
      ))}
    </>
  )
}

export function FurnitureMesh({
  item,
  selected,
  editing,
  onSelect,
}: {
  item: FurnitureItem
  selected: boolean
  editing: boolean
  onSelect: () => void
}) {
  const material = (roughness = 0.85) => (
    <meshStandardMaterial color={item.color} roughness={roughness} metalness={0.04} />
  )
  const content = (() => {
    switch (item.type) {
      case 'sofa':
        return (
          <>
            <mesh position={[0, 0.34, 0]} castShadow>
              <boxGeometry args={[1.95, 0.42, 0.82]} />
              {material()}
            </mesh>
            <mesh position={[0, 0.68, -0.32]} castShadow>
              <boxGeometry args={[1.95, 0.56, 0.18]} />
              {material()}
            </mesh>
            <mesh position={[-0.9, 0.58, 0]} castShadow>
              <boxGeometry args={[0.18, 0.5, 0.8]} />
              {material()}
            </mesh>
            <mesh position={[0.9, 0.58, 0]} castShadow>
              <boxGeometry args={[0.18, 0.5, 0.8]} />
              {material()}
            </mesh>
            <mesh position={[-0.45, 0.58, 0.02]}>
              <boxGeometry args={[0.72, 0.16, 0.64]} />
              <meshStandardMaterial color="#c8c4b4" roughness={0.95} />
            </mesh>
            <mesh position={[0.45, 0.58, 0.02]}>
              <boxGeometry args={[0.72, 0.16, 0.64]} />
              <meshStandardMaterial color="#c8c4b4" roughness={0.95} />
            </mesh>
          </>
        )
      case 'table':
        return (
          <>
            <mesh position={[0, 0.72, 0]} castShadow>
              <boxGeometry args={[1.35, 0.08, 0.82]} />
              {material(0.6)}
            </mesh>
            <Legs w={1.1} d={0.6} h={0.68} />
            <mesh position={[0.3, 0.83, 0.1]}>
              <cylinderGeometry args={[0.08, 0.1, 0.18, 12]} />
              <meshStandardMaterial color="#ded2be" roughness={0.5} />
            </mesh>
          </>
        )
      case 'chair':
        return (
          <>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[0.5, 0.08, 0.5]} />
              {material()}
            </mesh>
            <mesh position={[0, 0.78, -0.21]} castShadow>
              <boxGeometry args={[0.5, 0.55, 0.07]} />
              {material()}
            </mesh>
            <Legs w={0.4} d={0.4} h={0.48} />
          </>
        )
      case 'shelf':
        return (
          <>
            {[0.25, 0.75, 1.25, 1.72].map((y) => (
              <mesh key={y} position={[0, y, 0]} castShadow>
                <boxGeometry args={[1.4, 0.06, 0.42]} />
                {material(0.7)}
              </mesh>
            ))}
            {[-0.67, 0.67].map((x) => (
              <mesh key={x} position={[x, 1, 0]} castShadow>
                <boxGeometry args={[0.07, 1.95, 0.42]} />
                {material(0.7)}
              </mesh>
            ))}
            {[
              [-0.4, 0.95, '#8b6a55'],
              [-0.15, 1.05, '#5f776d'],
              [0.3, 0.92, '#b09a74'],
            ].map(([x, y, c], i) => (
              <mesh key={i} position={[x as number, y as number, 0.02]}>
                <boxGeometry args={[0.36, 0.3, 0.25]} />
                <meshStandardMaterial color={c as string} roughness={0.9} />
              </mesh>
            ))}
          </>
        )
      case 'plant':
        return (
          <>
            <mesh position={[0, 0.22, 0]} castShadow>
              <cylinderGeometry args={[0.24, 0.18, 0.44, 16]} />
              <meshStandardMaterial color="#b78b6c" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.82, 0]} castShadow>
              <icosahedronGeometry args={[0.42, 1]} />
              <meshStandardMaterial color={item.color} roughness={1} flatShading />
            </mesh>
            <mesh position={[0.18, 1.14, 0.06]} castShadow>
              <icosahedronGeometry args={[0.3, 1]} />
              <meshStandardMaterial color="#6b8b62" roughness={1} flatShading />
            </mesh>
            <mesh position={[-0.2, 1.02, -0.08]}>
              <icosahedronGeometry args={[0.24, 1]} />
              <meshStandardMaterial color="#4f6f52" roughness={1} flatShading />
            </mesh>
          </>
        )
      case 'lamp':
        return (
          <>
            <mesh position={[0, 0.04, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.24, 0.08, 16]} />
              <meshStandardMaterial color="#4f4b44" roughness={0.5} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.82, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.03, 1.56, 8]} />
              <meshStandardMaterial color="#5e584f" metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh position={[0, 1.62, 0]}>
              <cylinderGeometry args={[0.19, 0.25, 0.3, 20, 1, true]} />
              <meshStandardMaterial
                color="#f4d8a6"
                emissive="#efc180"
                emissiveIntensity={1.8}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
            <pointLight position={[0, 1.5, 0]} color="#ffd7a0" intensity={1.4} distance={4.2} decay={2} />
          </>
        )
      case 'rug':
        return (
          <mesh position={[0, 0.015, 0]} receiveShadow>
            <boxGeometry args={[3.0, 0.02, 2.2]} />
            <meshStandardMaterial color={item.color} roughness={1} />
          </mesh>
        )
      case 'desk':
        return (
          <>
            <mesh position={[0, 0.74, 0]} castShadow>
              <boxGeometry args={[1.7, 0.08, 0.78]} />
              {material(0.7)}
            </mesh>
            <mesh position={[0.55, 0.5, 0]} castShadow>
              <boxGeometry args={[0.55, 0.5, 0.7]} />
              {material()}
            </mesh>
            {[-0.72, 0.15].map((x) => (
              <mesh key={x} position={[x, 0.36, 0]} castShadow>
                <boxGeometry args={[0.06, 0.72, 0.06]} />
                <meshStandardMaterial color="#5b5146" roughness={0.8} />
              </mesh>
            ))}
            <mesh position={[-0.2, 0.84, -0.05]}>
              <boxGeometry args={[0.36, 0.02, 0.26]} />
              <meshStandardMaterial color="#dfdfd7" roughness={0.6} />
            </mesh>
          </>
        )
      case 'bench':
        return (
          <>
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[1.65, 0.1, 0.46]} />
              {material(0.75)}
            </mesh>
            {[-0.65, 0.65].map((x) => (
              <mesh key={x} position={[x, 0.22, 0]} castShadow>
                <boxGeometry args={[0.1, 0.44, 0.4]} />
                <meshStandardMaterial color="#5a554c" roughness={0.7} />
              </mesh>
            ))}
          </>
        )
      case 'pedestal':
        return (
          <>
            <mesh position={[0, 0.55, 0]} castShadow>
              <boxGeometry args={[0.62, 1.1, 0.62]} />
              {material(0.88)}
            </mesh>
            <mesh position={[0, 1.28, 0]} castShadow>
              <torusKnotGeometry args={[0.2, 0.065, 48, 8]} />
              <meshStandardMaterial color="#c9a06d" roughness={0.34} metalness={0.55} />
            </mesh>
          </>
        )
      case 'speaker':
        return (
          <>
            <mesh position={[0, 0.62, 0]} castShadow>
              <boxGeometry args={[0.62, 1.2, 0.52]} />
              {material(0.75)}
            </mesh>
            {[0.86, 0.44].map((y) => (
              <mesh key={y} position={[0, y, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.19, 0.19, 0.04, 20]} />
                <meshStandardMaterial color="#1f2423" roughness={0.9} />
              </mesh>
            ))}
          </>
        )
      case 'bed':
        return (
          <>
            <mesh position={[0, 0.22, 0]} castShadow>
              <boxGeometry args={[1.7, 0.28, 2.15]} />
              <meshStandardMaterial color="#6f5b46" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[1.6, 0.22, 2.02]} />
              <meshStandardMaterial color="#ddd6c8" roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.54, 0.3]}>
              <boxGeometry args={[1.58, 0.08, 1.3]} />
              <meshStandardMaterial color={item.color} roughness={0.98} />
            </mesh>
            <mesh position={[0, 0.62, -0.72]}>
              <boxGeometry args={[0.82, 0.14, 0.4]} />
              <meshStandardMaterial color="#f0e9da" roughness={0.98} />
            </mesh>
            <mesh position={[0, 0.72, -1.06]} castShadow>
              <boxGeometry args={[1.72, 0.9, 0.12]} />
              <meshStandardMaterial color="#8c7c68" roughness={0.85} />
            </mesh>
          </>
        )
      case 'stool':
        return (
          <>
            <mesh position={[0, 0.46, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.24, 0.08, 18]} />
              {material()}
            </mesh>
            {[0, 2.1, 4.2].map((a) => (
              <mesh key={a} position={[Math.cos(a) * 0.14, 0.22, Math.sin(a) * 0.14]} castShadow>
                <cylinderGeometry args={[0.025, 0.035, 0.44, 8]} />
                <meshStandardMaterial color="#5b5146" roughness={0.8} />
              </mesh>
            ))}
          </>
        )
      case 'counter':
        return (
          <>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[2.2, 0.92, 0.7]} />
              {material(0.8)}
            </mesh>
            <mesh position={[0, 0.99, 0]} castShadow>
              <boxGeometry args={[2.3, 0.08, 0.82]} />
              <meshStandardMaterial color="#d5c9b4" roughness={0.55} />
            </mesh>
            <mesh position={[-0.55, 1.15, 0]}>
              <boxGeometry args={[0.5, 0.26, 0.36]} />
              <meshStandardMaterial color="#4b5451" metalness={0.4} roughness={0.4} />
            </mesh>
          </>
        )
      default:
        return null
    }
  })()

  return (
    <group
      position={[item.x, 0, item.z]}
      rotation={[0, item.rot, 0]}
      onClick={(event) => {
        if (!editing) return
        event.stopPropagation()
        onSelect()
      }}
      onPointerOver={(event) => {
        if (!editing) return
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      {content}
      {selected && editing && (
        <group position={[0, 0.015, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.56, 0.66, 32]} />
            <meshBasicMaterial color="#d39a52" transparent opacity={0.95} toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.56, 32]} />
            <meshBasicMaterial color="#d39a52" transparent opacity={0.12} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}
