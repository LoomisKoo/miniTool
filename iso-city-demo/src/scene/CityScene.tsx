import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Preload, Sky, Stars } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useApp } from '../store'
import { buildings as authoredBuildings, CITY_BOUNDS, plazaFountain, skyline } from '../data/city'
import { infill } from '../data/infill'

// 手写地标 + 程序化外围街区：城市有纵深，但地标和可进入的楼仍是手写的。
const buildings = [...authoredBuildings, ...infill]
import { Building, InfillBuilding } from './Building'
import { Ground } from './Ground'
import { CityProps } from './Props'
import { Traffic } from './Traffic'
import { Citizens } from './Citizens'
import { PlayerRig, type Collider, type Interactable } from './PlayerRig'
import { EntrancePortal, Marker } from './Markers'
import { walker } from '../game/walker'
import { StaticMerge } from './StaticMerge'
import { QualityTuner } from './QualityTuner'
import { palettes } from './theme'

function Skyline({ night }: { night: boolean }) {
  return (
    <group>
      {skyline.map((item, i) => (
        <group key={i} position={[item.x, item.h / 2, item.z]}>
          <mesh receiveShadow={false}>
            <boxGeometry args={[item.w, item.h, item.d]} />
            <meshStandardMaterial
              color={night ? item.color : '#aab6b9'}
              roughness={0.9}
              metalness={night ? 0.25 : 0.05}
              emissive={night ? '#1b3448' : '#000000'}
              emissiveIntensity={night ? 0.5 : 0}
            />
          </mesh>
          {night && (
            <mesh position={[0, item.h * 0.18, 0]} scale={[1.004, 0.55, 1.004]}>
              <boxGeometry args={[item.w, item.h, item.d]} />
              <meshBasicMaterial color="#4f8ba8" transparent opacity={0.08} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

function HorizonGlow() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.62, 'rgba(38,96,134,0.06)')
    grad.addColorStop(0.86, 'rgba(74,158,196,0.26)')
    grad.addColorStop(1, 'rgba(24,70,96,0.34)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 8, 256)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
  return (
    <mesh position={[0, 60, 0]}>
      <cylinderGeometry args={[420, 420, 260, 48, 1, true]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

function Moon() {
  return (
    <group position={[-190, 175, -260]}>
      <mesh>
        <sphereGeometry args={[16, 24, 24]} />
        <meshBasicMaterial color="#dfeaff" toneMapped={false} />
      </mesh>
      <mesh scale={2.6}>
        <sphereGeometry args={[16, 24, 24]} />
        <meshBasicMaterial color="#7fb2e0" transparent opacity={0.12} toneMapped={false} />
      </mesh>
    </group>
  )
}

function SkyBridges() {
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2c4658',
        roughness: 0.12,
        metalness: 0.85,
        emissive: '#3f8ea8',
        emissiveIntensity: 0.18,
      }),
    [],
  )
  const frame = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b3d4d', roughness: 0.45, metalness: 0.6 }),
    [],
  )
  return (
    <group>
      {[
        { x: 47, y: 24, z: -16, len: 24, axis: 'x' as const },
        { x: 30, y: 30, z: 74, len: 30, axis: 'x' as const },
        { x: -22, y: 18, z: 82, len: 22, axis: 'z' as const },
      ].map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]} rotation={[0, b.axis === 'x' ? 0 : Math.PI / 2, 0]}>
          <mesh castShadow material={frame}>
            <boxGeometry args={[b.len, 0.5, 3.2]} />
          </mesh>
          <mesh position={[0, 1.05, 0]} material={glass}>
            <boxGeometry args={[b.len, 2.1, 2.8]} />
          </mesh>
          {/* 灯带必须完全脱离玻璃表面，压在面上会形成一条闪烁的亮线 */}
          <mesh position={[0, 1.05, 1.47]}>
            <boxGeometry args={[b.len * 0.96, 0.05, 0.06]} />
            <meshBasicMaterial color="#eaf4ff" toneMapped={false} transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, 1.05, -1.47]}>
            <boxGeometry args={[b.len * 0.96, 0.05, 0.06]} />
            <meshBasicMaterial color="#eaf4ff" toneMapped={false} transparent opacity={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 切换夜间/黄昏时同步曝光，避免沿用旧主题的亮度。 */
export function ExposureSync({ value }: { value: number }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.toneMappingExposure = value
  }, [gl, value])
  return null
}

/** 太阳阴影只覆盖玩家周围一圈，并随玩家平移（按纹素对齐避免抖动）。
    整城都塞进阴影相机时，阴影 pass 等于把城市再画一遍。 */
function SunRig({
  palette,
  quality,
  extent: extentOverride,
  follow = true,
  center,
}: {
  palette: typeof palettes.night
  quality: number
  extent?: number
  /** true：阴影相机跟着玩家走（小场景用）。false：固定覆盖整片城区，阴影不会跳。 */
  follow?: boolean
  /** follow=false 时的阴影中心 */
  center?: [number, number]
}) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  // 手写街区只有 60m 见方，96m 足够；OSM 那张 3km 的地图要更大的视锥
  const extent = extentOverride ?? 96
  // 静态阴影要盖住整片城区，同样的贴图分辨率下每个纹素更大，所以静态模式分辨率翻倍
  const resolution = follow ? (quality >= 2 ? 2048 : 1024) : quality >= 2 ? 4096 : 2048
  // 光源离场景多远：跟随模式下贴着玩家，静态模式下要往后退够远，
  // 否则 400m 的高楼会被阴影相机的 far 面切掉，影子随视角时有时无。
  const lightDistance = follow ? 0.55 : extent * 1.7

  useEffect(() => {
    const l = light.current
    if (!l) return
    l.target = target
    if (follow) return
    // 静态阴影：只设一次，之后不再随玩家移动，画面因此完全稳定
    const cx = center?.[0] ?? 0
    const cz = center?.[1] ?? 0
    const dir = new THREE.Vector3(...palette.sunPos).normalize()
    target.position.set(cx, 0, cz)
    target.updateMatrixWorld()
    l.position.set(cx + dir.x * lightDistance, Math.max(80, dir.y * lightDistance), cz + dir.z * lightDistance)
    l.updateMatrixWorld()
  }, [follow, center, palette.sunPos, lightDistance, target])

  const last = useRef(new THREE.Vector2(1e6, 1e6))

  useFrame(() => {
    const l = light.current
    if (!l || !follow) return
    // 阴影相机逐帧跟随会因亚 texel 偏移产生整片闪烁；只按 16m 步进又会
    // 出现阴影整体“跳格”。这里把目标点吸附到阴影贴图的 texel 栅格上：
    // 视角移动时阴影边界只会整格移动，不再抖动。
    const texel = (extent * 2) / resolution
    const snap = texel * 2
    const x = Math.round(walker.position.x / snap) * snap
    const z = Math.round(walker.position.z / snap) * snap
    if (Math.abs(x - last.current.x) < 1e-4 && Math.abs(z - last.current.y) < 1e-4) return
    last.current.set(x, z)
    target.position.set(x, 0, z)
    target.updateMatrixWorld()
    l.position.set(
      x + palette.sunPos[0] * lightDistance,
      Math.max(70, palette.sunPos[1] * lightDistance),
      z + palette.sunPos[2] * lightDistance,
    )
    l.updateMatrixWorld()
  })

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        castShadow
        position={palette.sunPos}
        intensity={palette.sunIntensity}
        color={palette.sun}
        shadow-mapSize={[resolution, resolution]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={follow ? 420 : extent * 4.5}
        shadow-bias={-0.0006}
        shadow-normalBias={follow ? 0.28 : 0.45}
        shadow-radius={2.2}
      />
    </>
  )
}

export function Environment({
  night,
  quality,
  shadowExtent,
  shadowFollow = true,
  shadowCenter,
  sky = true,
}: {
  night: boolean
  quality: number
  shadowExtent?: number
  shadowFollow?: boolean
  shadowCenter?: [number, number]
  /** false 时只提供灯光，天空交给调用方自己画（避免两套天空撞在一起） */
  sky?: boolean
}) {
  const p = night ? palettes.night : palettes.dusk
  if (night) {
    return (
      <>
        {sky && <color attach="background" args={[p.sky]} />}
        {sky && <fog attach="fog" args={[p.fog, p.fogNear, p.fogFar]} />}
        {sky && (
          <Stars radius={320} depth={90} count={2600} factor={4} saturation={0} fade speed={0.4} />
        )}
        {sky && <Moon />}
        {sky && <HorizonGlow />}
        <hemisphereLight args={[p.hemiSky, p.hemiGround, p.hemiIntensity]} />
        <ambientLight intensity={p.ambient} />
        <SunRig palette={p} quality={quality} extent={shadowExtent} follow={shadowFollow} center={shadowCenter} />
        {/* 冷色补光，让背光面不糊成一片 */}
        <directionalLight position={[120, 80, 140]} intensity={0.3} color="#5f9fc4" />
      </>
    )
  }
  return (
    <>
      {sky && <color attach="background" args={[p.sky]} />}
      {sky && (
        <Sky
          distance={1200}
          sunPosition={[110, 13, -150]}
          turbidity={6.5}
          rayleigh={1.35}
          mieCoefficient={0.01}
          mieDirectionalG={0.9}
        />
      )}
      {sky && <fog attach="fog" args={[p.fog, p.fogNear, p.fogFar]} />}
      <hemisphereLight args={[p.hemiSky, p.hemiGround, p.hemiIntensity]} />
      <ambientLight intensity={p.ambient} />
      <SunRig palette={p} quality={quality} extent={shadowExtent} follow={shadowFollow} center={shadowCenter} />
    </>
  )
}

export function CityScene() {
  const world = useApp((state) => state.world)
  const night = useApp((state) => state.night)
  const quality = useApp((state) => state.quality)
  const enterTarget = useApp((state) => state.enterTarget)
  const openPlace = useApp((state) => state.openPlace)
  const p = night ? palettes.night : palettes.dusk

  const colliders = useMemo<Collider[]>(
    () =>
      buildings.map((b) => ({
        minX: b.x - b.w / 2 - 0.16,
        maxX: b.x + b.w / 2 + 0.16,
        minZ: b.z - b.d / 2 - 0.16,
        maxZ: b.z + b.d / 2 + 0.16,
        minY: 0,
        maxY: b.h + 1,
      })),
    [],
  )

  const interactables = useMemo<Interactable[]>(() => {
    const list: Interactable[] = []
    for (const b of buildings) {
      if (!b.target || !b.entranceAt) continue
      const space =
        b.target.kind === 'space' ? world?.spaces.find((item) => item.id === b.target!.id) : null
      const use =
        b.target.kind === 'space'
          ? space?.owner
            ? `${space.owner.name} 的空间 · ${b.entranceUse || ''}`
            : '可认领 · 样板陈设'
          : b.entranceUse || '可进入'
      list.push({
        id: `entrance-${b.id}`,
        label: b.entranceLabel || b.name,
        hint: `进入 ${use}`,
        x: b.entranceAt[0] + Math.sign(b.entranceAt[0] - b.x) * 1.4,
        z: b.entranceAt[1] + Math.sign(b.entranceAt[1] - b.z) * 1.4,
        radius: 4.6,
        action: () => enterTarget(b.target!, b.entranceLabel || b.name),
      })
    }
    for (const place of world?.places || []) {
      if (place.id === 'gallery-lobby' || place.id === 'corner-cafe') continue
      list.push({
        id: `place-${place.id}`,
        label: place.name,
        hint: '查看地点档案与留言',
        x: place.x,
        z: place.z,
        radius: place.kind === 'plaza' ? 10 : 5.5,
        action: () => openPlace(place.id),
      })
    }
    return list
  }, [world, enterTarget, openPlace])

  return (
    <div className="scene-root">
      <Canvas
        id="city-canvas"
        shadows={quality > 0 ? 'soft' : false}
        dpr={quality >= 2 ? [1, 1.25] : quality === 1 ? 1 : 0.8}
        camera={{ fov: 62, near: 0.45, far: 1100, position: [0, 4, 34] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          if (import.meta.env.DEV) {
            ;(window as unknown as Record<string, unknown>).__scene = scene
            ;(window as unknown as Record<string, unknown>).__gl = gl
          }
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = p.exposure
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
      >
        <Suspense fallback={null}>
          <ExposureSync value={p.exposure} />
          <Environment night={night} quality={quality} />
          <Ground />
          {buildings.map((building) =>
            building.background ? (
              <InfillBuilding key={building.id} def={building} />
            ) : (
              <Building key={building.id} def={building} />
            ),
          )}
          <Skyline night={night} />
          <SkyBridges />
          <CityProps />
          <Traffic />
          <Citizens />

          {world?.places
            .filter((place) => place.id !== 'gallery-lobby' && place.id !== 'corner-cafe')
            .map((place) => (
              <Marker
                key={place.id}
                x={place.x}
                y={place.kind === 'plaza' ? 5.2 : 2.6}
                z={place.z}
                title={place.name}
                subtitle={`${place.postCount} 条留言`}
                tone="place"
                actionId={`place-${place.id}`}
                onOpen={() => openPlace(place.id)}
              />
            ))}

          {buildings
            .filter((building) => building.target && building.entranceAt)
            .map((building) => {
              const space =
                building.target?.kind === 'space'
                  ? world?.spaces.find((item) => item.id === building.target!.id)
                  : null
              const subtitle =
                building.target?.kind === 'space'
                  ? space?.owner
                    ? `${space.owner.name} 的空间`
                    : '可认领 · 样板陈设'
                  : building.entranceUse || '公共室内'
              // 门在墙上，所以光圈稍微往外挪一点，让玩家能站在门前的光里而不是墙里。
              const [ex, ez] = building.entranceAt!
              const outX = ex + Math.sign(ex - building.x) * 1.4
              const outZ = ez + Math.sign(ez - building.z) * 1.4
              return (
                <group key={`entrance-${building.id}`}>
                  <EntrancePortal
                    x={outX}
                    z={outZ}
                    color={building.target?.kind === 'space' ? (building.accent ?? '#c3b6ff') : '#9fd8ff'}
                  />
                  <Marker
                    x={outX}
                    z={outZ}
                    y={2.1}
                    title={building.entranceLabel || building.name}
                    subtitle={subtitle}
                    tone={building.target?.kind === 'space' ? 'space' : 'entrance'}
                    actionId={`entrance-${building.id}`}
                    onOpen={() => enterTarget(building.target!, building.entranceLabel || building.name)}
                  />
                </group>
              )
            })}

          <StaticMerge version={night ? 2 : 1} />
          <QualityTuner />

          <PlayerRig
            colliders={[
              ...colliders,
              {
                minX: plazaFountain.x - plazaFountain.r - 0.3,
                maxX: plazaFountain.x + plazaFountain.r + 0.3,
                minZ: plazaFountain.z - plazaFountain.r - 0.3,
                maxZ: plazaFountain.z + plazaFountain.r + 0.3,
                minY: 0,
                maxY: 4,
              },
            ]}
            bounds={{ minX: -CITY_BOUNDS, maxX: CITY_BOUNDS, minZ: -CITY_BOUNDS, maxZ: CITY_BOUNDS }}
            interactables={interactables}
            cameraDistance={5.6}
          />
          <Preload all />
        </Suspense>
        {quality > 0 && (
          <EffectComposer
            multisampling={0}
            enableNormalPass={false}
            resolutionScale={quality >= 2 ? 1 : 0.8}
          >
            {/* 窗框、楼层线、灯带这类细长几何在移动时是典型的边缘走样；
                SMAA 只在边缘做形态学抗锯齿，比全程 4x MSAA 便宜得多。 */}
            <SMAA />
            <Bloom
              luminanceThreshold={night ? 0.62 : 0.86}
              luminanceSmoothing={0.3}
              intensity={night ? 0.72 : 0.26}
              mipmapBlur
              radius={0.58}
            />
            <Vignette offset={0.24} darkness={night ? 0.72 : 0.5} eskil={false} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  )
}
