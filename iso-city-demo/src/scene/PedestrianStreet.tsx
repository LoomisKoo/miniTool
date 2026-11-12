// 南岸广场的场景部分。
//
// 这块地现在是一座胶囊形商场（见 scene/Mall.tsx）+ 一圈广场。
// 这里负责广场本身：
// - 铺装；
// - 两座牌坊、街口立柱灯箱；
// - 西侧广场一条灯串 + 布幡 + 灯柱；
// - 长凳、花箱、垃圾桶、护柱、三辆小吃车。
//
// 商场本体在 Mall 里，碰撞也从那边取（mallColliders），这里只把两边的
// 碰撞盒合成一份交给 PlayerRig。

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  PED,
  PED_BANNERS,
  PED_GATES,
  PED_POLES,
  pedBenches,
  pedFloors,
  pedKiosks,
  pedProps,
  pedStringSpans,
} from '../data/pedestrian'
import { makePavingTexture } from './textures'
import { nightFill, palettes } from './theme'
import { StringLights } from './StringLights'
import { StreetArch, gateMaterials } from './StreetGate'
import { bannerTexture, kioskTexture, streetSignTexture } from './shopArt'
import { GlowDisc } from './GlowDisc'
import { Mall } from './Mall'
import { mallColliders } from '../data/mallColliders'
import type { Collider } from './PlayerRig'

/** 铺装面高度：比底盘高一点，和人行道同一层。 */
const PAVE_Y = 0.036

/** 街口的立柱灯箱：竖排街名，正对西面进场的那条道。 */
function MouthSign({ night }: { night: boolean }) {
  const tex = useMemo(
    () => streetSignTexture(PED.name, PED.sub, night ? '#1d1a16' : '#3a342c', '#fff2dc', '#ffb46b'),
    [night],
  )
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex, color: night ? '#f4ece0' : '#9a948a', toneMapped: false }),
    [tex, night],
  )
  const body = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#1a242c' : '#3d474e',
        roughness: 0.6,
        metalness: 0.4,
        ...nightFill(night),
      }),
    [night],
  )
  useEffect(
    () => () => {
      mat.dispose()
      body.dispose()
    },
    [mat, body],
  )

  return (
    <group position={[17.2, 0, 160.4]} rotation={[0, -0.5, 0]}>
      <mesh position={[0, 1.9, 0]} material={body} castShadow>
        <boxGeometry args={[0.38, 3.8, 0.72]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 2.1, s * 0.2]} rotation={[0, s < 0 ? Math.PI : 0, 0]} material={mat}>
          <planeGeometry args={[0.62, 2.2]} />
        </mesh>
      ))}
      <mesh position={[0, 3.86, 0]} material={body}>
        <boxGeometry args={[0.56, 0.1, 0.9]} />
      </mesh>
    </group>
  )
}

/** 灯柱 + 柱间灯串上挂的布幡。 */
function PoleLine({ night }: { night: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#2b333a' : '#5d666c',
        roughness: 0.55,
        metalness: 0.55,
        ...nightFill(night),
      }),
    [night],
  )
  const bulb = useMemo(
    () => new THREE.MeshBasicMaterial({ color: night ? '#ffe6bd' : '#e8ddc6', toneMapped: false }),
    [night],
  )
  const banners = useMemo(
    () =>
      PED_BANNERS.map((ch) =>
        new THREE.MeshBasicMaterial({
          map: bannerTexture(ch, night ? '#8a2f28' : '#a8443a', '#fff2d8'),
          color: night ? '#ffffff' : '#a8a29a',
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      ),
    [night],
  )
  useEffect(
    () => () => {
      mat.dispose()
      bulb.dispose()
      banners.forEach((b) => b.dispose())
    },
    [mat, bulb, banners],
  )

  return (
    <group>
      {PED_POLES.map((p) => (
        <group key={`${p.x}-${p.z}`} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.14, 0]} material={mat} castShadow>
            <cylinderGeometry args={[0.2, 0.26, 0.28, 10]} />
          </mesh>
          <mesh position={[0, p.h / 2, 0]} material={mat} castShadow>
            <cylinderGeometry args={[0.075, 0.12, p.h, 8]} />
          </mesh>
          <mesh position={[0, p.h, 0]} material={mat}>
            <boxGeometry args={[0.42, 0.07, 0.42]} />
          </mesh>
          <mesh position={[0, p.h + 0.12, 0]} material={bulb}>
            <sphereGeometry args={[0.14, 10, 6]} />
          </mesh>
          {night && <GlowDisc position={[0, 0.05, 0]} size={6.5} color="#ffd9a0" opacity={0.1} />}
        </group>
      ))}

      {/* 布幡：挂在每一跨的灯串上，面朝缆绳侧面 */}
      {pedStringSpans.flatMap((s, si) => {
        const dz = s.b[2] - s.a[2]
        const yaw = Math.atan2(-dz, 0)
        return [0.3, 0.5, 0.7].map((t, k) => (
          <mesh
            key={`${si}-${k}`}
            position={[s.a[0], s.a[1] - s.sag * Math.sin(Math.PI * t) - 0.36, s.a[2] + dz * t]}
            rotation={[0, yaw, 0]}
            material={banners[(si + k) % banners.length]}
          >
            <planeGeometry args={[0.38, 0.62]} />
          </mesh>
        ))
      })}
    </group>
  )
}

/** 广场上的小吃车 */
function Kiosks({ night }: { night: boolean }) {
  const bodyMats = useMemo(() => {
    const map = new Map<string, THREE.MeshStandardMaterial>()
    for (const k of pedKiosks) {
      map.set(
        k.id,
        new THREE.MeshStandardMaterial({
          color: night ? k.color : new THREE.Color(k.color).lerp(new THREE.Color('#ffffff'), 0.35).getStyle(),
          roughness: 0.72,
          metalness: 0.22,
          ...nightFill(night),
        }),
      )
    }
    return map
  }, [night])
  const metal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: night ? '#2a3238' : '#8f989e', roughness: 0.45, metalness: 0.6 }),
    [night],
  )
  const signs = useMemo(
    () => pedKiosks.map((k) => new THREE.MeshBasicMaterial({ map: kioskTexture(k.name, k.sub, k.glow), color: '#f8f2e8', toneMapped: false })),
    [],
  )
  useEffect(
    () => () => {
      bodyMats.forEach((m) => m.dispose())
      metal.dispose()
      signs.forEach((m) => m.dispose())
    },
    [bodyMats, metal, signs],
  )

  return (
    <group>
      {pedKiosks.map((k, i) => (
        <group key={k.id} position={[k.x, 0, k.z]} rotation={[0, k.yaw, 0]}>
          <mesh position={[0, 0.56, 0]} material={bodyMats.get(k.id)} castShadow receiveShadow>
            <boxGeometry args={[1.8, 1.12, 0.86]} />
          </mesh>
          <mesh position={[0, 1.14, 0.02]} material={metal}>
            <boxGeometry args={[1.9, 0.06, 0.94]} />
          </mesh>
          {[
            [-0.8, -0.36],
            [0.8, -0.36],
            [-0.8, 0.36],
            [0.8, 0.36],
          ].map(([dx, dz], j) => (
            <mesh key={j} position={[dx, 1.62, dz]} material={metal}>
              <cylinderGeometry args={[0.022, 0.022, 1.0, 5]} />
            </mesh>
          ))}
          <mesh position={[0, 2.14, 0]} material={bodyMats.get(k.id)} castShadow>
            <boxGeometry args={[2.0, 0.08, 1.06]} />
          </mesh>
          <mesh position={[0, 1.86, 0.4]} material={signs[i]}>
            <planeGeometry args={[1.62, 0.44]} />
          </mesh>
          <mesh position={[0, 1.86, 0.36]} material={metal}>
            <boxGeometry args={[1.72, 0.54, 0.05]} />
          </mesh>
          {[-0.5, 0.4].map((dx) => (
            <mesh key={dx} position={[dx, 1.26, 0]} material={metal}>
              <cylinderGeometry args={[0.19, 0.16, 0.18, 10]} />
            </mesh>
          ))}
          {[-1.15, 1.15].map((dx) => (
            <group key={dx} position={[dx, 0, 0.6]}>
              <mesh position={[0, 0.32, 0]} material={metal}>
                <cylinderGeometry args={[0.04, 0.05, 0.64, 6]} />
              </mesh>
              <mesh position={[0, 0.66, 0]} material={bodyMats.get(k.id)}>
                <cylinderGeometry args={[0.19, 0.19, 0.06, 10]} />
              </mesh>
            </group>
          ))}
          {night && <GlowDisc position={[0, 0.05, 0.9]} size={3.4} color={k.glow} opacity={0.14} />}
        </group>
      ))}
    </group>
  )
}

/** 长凳、垃圾桶、花箱、护柱。 */
function StreetFurniture({ night }: { night: boolean }) {
  const palette = night ? palettes.night : palettes.dusk
  const wood = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#4a3a2c' : '#9a7a56',
        roughness: 0.88,
        metalness: 0.06,
        ...nightFill(night),
      }),
    [night],
  )
  const metal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: night ? '#2a3238' : '#6f7a80', roughness: 0.5, metalness: 0.55 }),
    [night],
  )
  const leaf = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#3f5546' : palette.tree,
        roughness: 1,
        flatShading: true,
        envMapIntensity: night ? 1.3 : 1,
      }),
    [palette.tree, night],
  )
  useEffect(
    () => () => {
      wood.dispose()
      metal.dispose()
      leaf.dispose()
    },
    [wood, metal, leaf],
  )

  return (
    <group>
      {pedBenches.map((b, i) => (
        <group key={`b${i}`} position={[b.x, 0, b.z]} rotation={[0, b.yaw, 0]}>
          <mesh position={[0, 0.43, 0]} material={wood} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.08, 0.42]} />
          </mesh>
          {[-0.64, 0.64].map((dx) => (
            <mesh key={dx} position={[dx, 0.21, 0]} material={metal}>
              <boxGeometry args={[0.07, 0.42, 0.38]} />
            </mesh>
          ))}
          <mesh position={[0, 0.7, -0.19]} rotation={[-0.14, 0, 0]} material={wood} castShadow>
            <boxGeometry args={[1.6, 0.4, 0.05]} />
          </mesh>
        </group>
      ))}

      {pedProps.map((p, i) => {
        if (p.kind === 'bin') {
          return (
            <group key={`p${i}`} position={[p.x, 0, p.z]}>
              <mesh position={[0, 0.36, 0]} material={metal} castShadow>
                <cylinderGeometry args={[0.24, 0.2, 0.72, 10]} />
              </mesh>
              <mesh position={[0, 0.75, 0]} material={metal}>
                <cylinderGeometry args={[0.25, 0.25, 0.06, 10]} />
              </mesh>
            </group>
          )
        }
        if (p.kind === 'bollard') {
          return (
            <mesh key={`p${i}`} position={[p.x, 0.36, p.z]} material={metal} castShadow>
              <cylinderGeometry args={[0.09, 0.11, 0.72, 8]} />
            </mesh>
          )
        }
        return (
          <group key={`p${i}`} position={[p.x, 0, p.z]}>
            <mesh position={[0, 0.3, 0]} material={metal} castShadow receiveShadow>
              <boxGeometry args={[1.1, 0.6, 1.1]} />
            </mesh>
            <mesh position={[0, 0.94, 0]} material={leaf} castShadow>
              <icosahedronGeometry args={[0.66, 1]} />
            </mesh>
            <mesh position={[0, 1.5, 0]} material={leaf} castShadow>
              <icosahedronGeometry args={[0.44, 0]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

export function PedestrianStreet({ night }: { night: boolean }) {
  const palette = night ? palettes.night : palettes.dusk
  const pavingGlow = night ? 0.2 : 0

  const plazaPaving = useMemo(() => {
    const tex = makePavingTexture(night ? '#3f3e3b' : '#b6b8b2', night ? '#4e4d49' : '#a4a89d')
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    const f = pedFloors[0]
    tex.repeat.set((f.x1 - f.x0) / 8, (f.z1 - f.z0) / 8)
    const material = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.9,
      metalness: 0.1,
      envMapIntensity: 0.8,
    })
    if (pavingGlow) {
      material.emissive = new THREE.Color(palette.paving).lerp(new THREE.Color('#39424a'), 0.4)
      material.emissiveIntensity = pavingGlow
    }
    return material
  }, [night, pavingGlow, palette.paving])
  useEffect(
    () => () => {
      plazaPaving.map?.dispose()
      plazaPaving.dispose()
    },
    [plazaPaving],
  )

  const gates = useMemo(() => gateMaterials(night), [night])
  useEffect(() => () => Object.values(gates).forEach((m) => m.dispose()), [gates])

  return (
    <group>
      <mesh
        position={[(PED.x0 + PED.x1) / 2, PAVE_Y, (PED.z0 + PED.z1) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={plazaPaving}
        receiveShadow
      >
        <planeGeometry args={[PED.x1 - PED.x0, PED.z1 - PED.z0]} />
      </mesh>

      <Mall night={night} />

      <StreetFurniture night={night} />
      <PoleLine night={night} />
      <Kiosks night={night} />
      <StringLights spans={pedStringSpans} night={night} pitch={0.85} />
      <MouthSign night={night} />

      {PED_GATES.map((g) => (
        <StreetArch
          key={g.id}
          x={g.x}
          z={g.z}
          yaw={g.yaw}
          span={g.span}
          label={g.label}
          sub={g.sub}
          mats={gates}
          night={night}
        />
      ))}
    </group>
  )
}

/** 步行区碰撞：商场（店面/栏杆/扶梯/楼板）、街具、牌坊。楼里可走。 */
export function pedestrianColliders(): Collider[] {
  const out: Collider[] = [...mallColliders()]
  for (const g of PED_GATES) {
    for (const s of [-1, 1]) {
      const lx = (s * g.span) / 2
      const x = g.x + lx * Math.cos(g.yaw)
      const z = g.z - lx * Math.sin(g.yaw)
      out.push({ minX: x - 0.62, maxX: x + 0.62, minZ: z - 0.62, maxZ: z + 0.62, minY: 0, maxY: 7.4 })
    }
  }
  for (const k of pedKiosks) {
    out.push({ minX: k.x - 1.1, maxX: k.x + 1.1, minZ: k.z - 0.65, maxZ: k.z + 0.65, minY: 0, maxY: 2.2 })
  }
  for (const b of pedBenches) {
    const along = Math.abs(Math.cos(b.yaw)) > 0.5
    const hx = along ? 0.85 : 0.35
    const hz = along ? 0.35 : 0.85
    out.push({ minX: b.x - hx, maxX: b.x + hx, minZ: b.z - hz, maxZ: b.z + hz, minY: 0, maxY: 0.85 })
  }
  for (const p of pedProps) {
    const r = p.kind === 'bollard' ? 0.16 : p.kind === 'bin' ? 0.3 : 0.6
    out.push({ minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r, minY: 0, maxY: 1.2 })
  }
  for (const p of PED_POLES) {
    out.push({ minX: p.x - 0.24, maxX: p.x + 0.24, minZ: p.z - 0.24, maxZ: p.z + 0.24, minY: 0, maxY: p.h + 0.4 })
  }
  return out
}
