import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { benches, insideRoad, insideWater, lamps, planters, plazaFountain, trees } from '../data/city'
import { insideBuilding } from '../data/infill'
import { StreetLights } from './StreetLights'
import { infillLamps } from '../data/infill'
import { useApp } from '../store'
import { makeArtTexture, makeLeafClusterTexture } from './textures'
import { AssetModel } from './models'
import { Stagger } from './buildQueue'
import { palettes, nightFill, type Palette } from './theme'
import { GlowDisc } from './GlowDisc'

/** 叶簇贴图全局只做一张：同一张图换 3 个朝向就已经看不出重复。 */
let leafTexture: THREE.Texture | null = null
function useLeafTexture() {
  return useMemo(() => {
    if (!leafTexture) leafTexture = makeLeafClusterTexture(3)
    return leafTexture
  }, [])
}

/** 叶卡片几何：法线往"上"拧，叶片才吃得到顶光和路灯。
 *
 * 叶卡片是竖直平面，法线全在水平面上：月光、半球光、头顶的路灯点积都接近 0，
 * 树冠因此永远是纯黑的剪影——旁边被路灯照亮的路面越亮，这个反差越刺眼。
 * 把法线混成"七分朝上、三分朝外"，一片片叶子就像一团受光的树冠。
 */
function leafCardGeometry() {
  const geo = new THREE.PlaneGeometry(1, 1)
  const n = geo.attributes.normal
  const v = new THREE.Vector3()
  for (let i = 0; i < n.count; i++) {
    v.set(n.getX(i) * 0.42, 0.9, n.getZ(i) * 0.42 + 0.3).normalize()
    n.setXYZ(i, v.x, v.y, v.z)
  }
  n.needsUpdate = true
  return geo
}

function Tree({ x, z, scale = 1, palette }: { x: number; z: number; scale?: number; palette: Palette }) {
  // 叶簇贴图只生成一次，所有树共用；每棵树靠旋转和缩放错开，避免看出是同一张图。
  const leaf = useLeafTexture()
  const leafGeo = useMemo(leafCardGeometry, [])
  useEffect(() => () => leafGeo.dispose(), [leafGeo])
  const variant = useMemo(() => (Math.abs(x * 7.13 + z * 3.71) % 1) * Math.PI * 2, [x, z])
  const cards = useMemo(
    () =>
      [
        { rot: variant, s: 1 },
        { rot: variant + Math.PI / 3, s: 0.92 },
        { rot: variant + (Math.PI * 2) / 3, s: 1.05 },
      ],
    [variant],
  )
  const night = palette.key === 'night'

  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.3, 3.2, 10]} />
        {/* 树皮在夜里也吃得到街灯和橱窗的光，不能按"黑剪影"处理 */}
        <meshStandardMaterial
          color={night ? '#4a463c' : '#7a6550'}
          roughness={1}
          emissive={night ? '#171410' : '#000000'}
          emissiveIntensity={night ? 1 : 0}
        />
      </mesh>
      {/* 三根主枝：让树冠和树干之间有连接，不是"球插在棍子上" */}
      {[0.6, -0.5, 2.3].map((a, i) => (
        <mesh
          key={`br${i}`}
          position={[Math.cos(a) * 0.5, 3.2 + i * 0.16, Math.sin(a) * 0.5]}
          rotation={[0.5, a, 0.42]}
          castShadow
        >
          <cylinderGeometry args={[0.05, 0.11, 1.5, 6]} />
          <meshStandardMaterial color={night ? '#403c33' : '#6d5947'} roughness={1} />
        </mesh>
      ))}
      {/* 树冠内核：负责阴影体积，叶卡片负责轮廓 */}
      <mesh position={[0, 3.75, 0]} castShadow>
        <icosahedronGeometry args={[1.25, 1]} />
        <meshStandardMaterial
          color={palette.treeDark}
          roughness={1}
          flatShading
          emissive={night ? '#1b241d' : '#000000'}
          emissiveIntensity={night ? 1 : 0}
        />
      </mesh>
      {cards.map((card, i) => (
        <mesh
          key={`leaf${i}`}
          geometry={leafGeo}
          position={[0, 3.85, 0]}
          rotation={[0, card.rot, 0]}
          scale={[3.3 * card.s, 3.0 * card.s, 1]}
        >
          <meshStandardMaterial
            map={leaf}
            transparent={false}
            alphaTest={0.42}
            side={THREE.DoubleSide}
            roughness={0.82}
            color={night ? '#8fa189' : '#ffffff'}
            // 背光面的法线会被双面渲染翻成朝下，只能靠一点点自发光兜底，
            // 否则树冠里会出现一块块死黑的斑
            emissive={night ? '#1f2b22' : '#000000'}
            emissiveIntensity={night ? 1 : 0}
          />
        </mesh>
      ))}
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
  const night = palette.key === 'night'
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 5, 8]} />
        <meshStandardMaterial
          color={night ? '#4b5663' : '#4d5451'}
          roughness={0.45}
          metalness={0.55}
          {...nightFill(night)}
        />
      </mesh>
      <mesh position={[0.5, 4.95, 0]} castShadow>
        <boxGeometry args={[1.1, 0.1, 0.12]} />
        <meshStandardMaterial color={palette.trim} roughness={0.45} metalness={0.55} {...nightFill(night)} />
      </mesh>
      <mesh position={[0.98, 4.84, 0]}>
        <boxGeometry args={[0.56, 0.16, 0.32]} />
        {/* 白天灯是关着的：以前白天也自发光 + 泛光，远看一排排"小太阳" */}
        <meshStandardMaterial
          color={palette.key === 'night' ? '#f6f8ff' : '#cfd3cf'}
          emissive="#eef2ff"
          emissiveIntensity={palette.key === 'night' ? 2.2 : 0}
          roughness={0.4}
        />
      </mesh>
      {/* 灯罩下沿的发光面，泛光由后期 Bloom 产生，不再贴一张大光晕 */}
      {lit && palette.key === 'night' && (
        <mesh position={[0.98, 4.755, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 0.26]} />
          <meshBasicMaterial color="#f4f7ff" toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function Bench({ x, z, rot, palette }: { x: number; z: number; rot: number; palette: Palette }) {
  const night = palette.key === 'night'
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.12, 0.66]} />
        <meshStandardMaterial color={night ? '#55687a' : '#8a7255'} roughness={0.75} metalness={0.15} {...nightFill(night)} />
      </mesh>
      <mesh position={[0, 0.88, -0.28]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[2.4, 0.64, 0.1]} />
        <meshStandardMaterial color={night ? '#55687a' : '#8a7255'} roughness={0.75} metalness={0.15} {...nightFill(night)} />
      </mesh>
      {[-0.9, 0.9].map((sx) => (
        <mesh key={sx} position={[sx, 0.24, 0]} castShadow>
          <boxGeometry args={[0.09, 0.48, 0.56]} />
          <meshStandardMaterial color={palette.trim} roughness={0.5} metalness={0.5} {...nightFill(night)} />
        </mesh>
      ))}
    </group>
  )
}

function Planter({ x, z, size, palette }: { x: number; z: number; size: number; palette: Palette }) {
  const night = palette.key === 'night'
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
        <boxGeometry args={[size * 2, 0.68, size * 1.3]} />
        <meshStandardMaterial color={night ? '#59606a' : palette.trim} roughness={0.75} metalness={0.2} {...nightFill(night)} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[size * 1.8, 0.8, size * 1.1]} />
        {/* 花池的灌木以前用 palette.tree（#22302a），夜里就是一块纯黑，
            而俯视视角看到的又正好是这个顶面——"全黑的花池"就是这么来的。 */}
        <meshStandardMaterial color={palette.tree} roughness={1} flatShading emissive={night ? '#16201a' : '#000000'} emissiveIntensity={night ? 1 : 0} />
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
          {/* 水下那盏点光在 CityScene 的 StablePointLights 里，理由同上 */}
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

/** 沿人行道摆的真实街道家具。
 *
 *  这里放的是扫描资产（Poly Haven CC0）：消防栓和垃圾桶在近景里有明确的
 *  金属磨损、漆面剥落和锈迹，程序化材质很难伪造这种"被用了很多年"的细节。
 *  资产没加载出来时整组直接不渲染，不会留下空洞。 */
function StreetFurniture() {
  const hydrants = useMemo(
    () =>
      [
        [-11.55, -71.5, 0.4],
        [11.55, -18.2, 2.2],
        [-11.55, 48.4, 1.1],
        [11.55, 61.6, 3.4],
        [-11.55, -112.4, 0.7],
      ].filter(([x, z]) => !insideRoad(x, z, 0.25) && !insideWater(x, z, 1)),
    [],
  )
  const bins = useMemo(
    () =>
      [
        [11.5, -72.4, 0.9],
        [-11.5, 20.6, 2.6],
        [11.5, 52.2, 1.4],
        [-11.5, 60.2, 3.1],
        [11.5, -108.6, 0.3],
      ].filter(([x, z]) => !insideRoad(x, z, 0.25) && !insideWater(x, z, 1)),
    [],
  )

  return (
    <group>
      {hydrants.map(([x, z, rot], i) => (
        <AssetModel key={`h${i}`} id="fire_hydrant" height={0.78} position={[x, 0.045, z]} rotation={rot} />
      ))}
      {bins.map(([x, z, rot], i) => (
        <AssetModel key={`b${i}`} id="metal_trash_can" height={1.02} position={[x, 0.045, z]} rotation={rot} />
      ))}
    </group>
  )
}

export function CityProps() {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const graffiti = useMemo(() => makeArtTexture('signal', 1), [])

  // 手写的点位里有十几处压在车行道上（路灯长在车道中央、长椅摆在路口）。
  // 车流按固定车道跑，这些道具会被车直接穿过去，所以在渲染前就剔掉。
  const props = useMemo(
    () => ({
      // 楼可能被规划器挪过位置，道具再按新楼表过滤一遍，
      // 否则会出现"树从墙里长出来"这种一眼假的画面。
      trees: trees.filter(([x, z]) => !insideRoad(x, z, 0.3) && !insideWater(x, z, 1) && !insideBuilding(x, z, 0.6)),
      lamps: lamps.filter(([x, z]) => !insideRoad(x, z, 0.2) && !insideWater(x, z, 1) && !insideBuilding(x, z, 0.4)),
      benches: benches.filter(([x, z]) => !insideRoad(x, z, 0.2) && !insideWater(x, z, 1) && !insideBuilding(x, z, 0.4)),
      planters: planters.filter(([x, z]) => !insideRoad(x, z, 0.2) && !insideWater(x, z, 1) && !insideBuilding(x, z, 0.4)),
      infillLamps: infillLamps.filter(([x, z]) => !insideRoad(x, z, 0.2) && !insideWater(x, z, 1) && !insideBuilding(x, z, 0.4)),
    }),
    [],
  )
  const lampHeads = useMemo(
    () => [...props.lamps, ...props.infillLamps].map(([x, z]) => [x, z] as [number, number]),
    [props],
  )

  // 一片树/一排灯一起挂载时，R3F 要在一次 commit 里造出几百个对象，实测 1 秒。
  // 按 8 个一组摊到不同帧上，单帧就只剩一百多毫秒。
  const treeBatches = useMemo(() => chunk(props.trees, 8), [props.trees])
  const lampBatches = useMemo(() => chunk([...props.lamps, ...props.infillLamps], 14), [props])

  return (
    <group>
      {treeBatches.map((batch, b) => (
        <Stagger key={`t${b}`} name="props:tree">
          {batch.map(([x, z, s], i) => (
            <Tree key={`${b}-${i}`} x={x} z={z} scale={s} palette={palette} />
          ))}
        </Stagger>
      ))}
      {lampBatches.map((batch, b) => (
        <Stagger key={`l${b}`} name="props:lamp">
          {batch.map(([x, z], i) => (
            <Lamp key={`${b}-${i}`} x={x} z={z} palette={palette} lit />
          ))}
        </Stagger>
      ))}
      {/* 路灯的聚光灯不套 Stagger：聚光灯数量一变，整城材质重编译 */}
      <StreetLights lamps={lampHeads} night={night} />
      <Stagger name="props:seat">
        {props.benches.map(([x, z, rot], i) => (
          <Bench key={i} x={x} z={z} rot={rot} palette={palette} />
        ))}
        {props.planters.map(([x, z, s], i) => (
          <Planter key={`p${i}`} x={x} z={z} size={s} palette={palette} />
        ))}
      </Stagger>
      <Stagger name="props:water">
        <Fountain palette={palette} />
      </Stagger>
      <Stagger name="props:wire">
        <StringLights palette={palette} />
      </Stagger>
      <Stagger name="props:furniture">
        <StreetFurniture />
      </Stagger>

      {/* 每块全息招牌要单独生成一张 canvas 贴图，四块一起是 390ms，
          拆成一块一组。 */}
      <Stagger name="props:board">
        <HoloBoard position={[27.4, 8.6, 6]} rotation={-Math.PI / 2} width={7} height={3.6} label="ECHO ALLEY" palette={palette} />
      </Stagger>
      <Stagger name="props:board">
        <HoloBoard position={[-45.6, 12.4, 14]} rotation={Math.PI / 2} width={7.4} height={3.8} label="LUMA GALLERY" palette={palette} />
      </Stagger>
      <Stagger name="props:board">
        <HoloBoard position={[41.6, 20, 44]} rotation={Math.PI} width={8} height={4} label="LUMEN 24H" palette={palette} />
      </Stagger>
      <Stagger name="props:board">
        <HoloBoard position={[-88.6, 9.2, -30]} rotation={Math.PI / 2} width={7} height={3.4} label="WEST LINE" palette={palette} />
      </Stagger>

      <Stagger name="props:signs">
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
      </Stagger>

      {/* 自行车架与路灯箱，增加街道的小尺度细节 */}
      <Stagger name="props:racks">
      {[
        [12.4, 24.4],
        [12.4, 33.2],
        [-12.4, -36],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 0.08, 20]} />
            <meshStandardMaterial color={palette.trim} roughness={0.5} metalness={0.5} {...nightFill(palette.key === 'night')} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.72, 8]} />
            <meshStandardMaterial color={palette.trim} metalness={0.55} roughness={0.4} {...nightFill(palette.key === 'night')} />
          </mesh>
          {[0.9, Math.PI + 0.2].map((a, j) => (
            <group key={j} position={[Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2]} rotation={[0, -a, 0]}>
              <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[0.5, 0.1, 0.85]} />
                <meshStandardMaterial color={palette.trim} roughness={0.55} metalness={0.4} {...nightFill(palette.key === 'night')} />
              </mesh>
              <mesh position={[0, 0.72, -0.22]}>
                <boxGeometry args={[0.5, 0.5, 0.09]} />
                <meshStandardMaterial color={palette.trim} roughness={0.55} metalness={0.4} {...nightFill(palette.key === 'night')} />
              </mesh>
              {[-0.4, 0.4].map((wz) => (
                <mesh key={wz} position={[0, 0.36, wz]} rotation={[0, 0, Math.PI / 2]}>
                  <torusGeometry args={[0.28, 0.035, 8, 20]} />
                  <meshStandardMaterial color={palette.key === 'night' ? '#3a444f' : '#3d4348'} roughness={0.7} metalness={0.4} {...nightFill(palette.key === 'night')} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
      </Stagger>

      {/* 街道指示牌 */}
      <Stagger name="props:signpost">
      <group position={[-13.9, 0, 12]}>
        <mesh position={[0, 2.6, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.075, 5.2, 8]} />
          <meshStandardMaterial color={palette.trim} metalness={0.55} roughness={0.4} {...nightFill(palette.key === 'night')} />
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
      </Stagger>
    </group>
  )
}

/** 按固定长度切片，用来把一次挂载拆成几帧。 */
function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}
