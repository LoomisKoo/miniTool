import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Preload } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useApp } from '../../store'
import { Environment, ExposureSync } from '../CityScene'
import { PlayerRig, type Collider } from '../PlayerRig'
import { QualityTuner } from '../QualityTuner'
import { palettes } from '../theme'
import { resetWalker } from '../../game/walker'
import {
  makeAsphaltTexture,
  makeContactShadowTexture,
  makeGrainTexture,
  makePavingTexture,
  makeWaterNormalTexture,
} from '../textures'
import { SkyDome } from './SkyDome'
import {
  buildAreas,
  buildCity,
  buildColliders,
  buildContactShadow,
  buildMarkings,
  buildRoads,
  buildRoofClutter,
  buildSidewalks,
  buildTrees,
  buildWater,
  type OsmData,
  type RoofBox,
  type TreePlacement,
} from './build'
import { createOsmFacadeMaterial } from './osmFacade'
import raw from '../../data/osm-city.json'

const data = raw as unknown as OsmData

// 花城广场边的开阔地：离最近的楼 160m，落地就有一整条天际线
const START = { x: -650, z: 20 }

// 天空与雾必须共用同一个地平线颜色，否则远处会出现"白带 + 天花板"的接缝
const SKY = {
  night: { zenith: '#040a14', horizon: '#0d1c2e', sun: '#d3e6ff', gain: 0.9 },
  dusk: { zenith: '#8fadc4', horizon: '#ccd6d6', sun: '#fff0d4', gain: 0.8 },
}

/**
 * 把若干基础几何按「带顶点色」的方式拼成一个。行道树用：树干 + 三团树冠
 * 合成一份几何，几千棵树才能靠 InstancedMesh 一次画完。
 */
function mergeParts(parts: Array<{ geometry: THREE.BufferGeometry; color: THREE.Color }>) {
  const position: number[] = []
  const normal: number[] = []
  const color: number[] = []
  for (const part of parts) {
    const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry
    const pos = geo.getAttribute('position')
    const nrm = geo.getAttribute('normal')
    for (let i = 0; i < pos.count; i++) {
      position.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      normal.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i))
      color.push(part.color.r, part.color.g, part.color.b)
    }
    if (geo !== part.geometry) geo.dispose()
    part.geometry.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  geometry.computeBoundingSphere()
  return geometry
}

function treeGeometry() {
  const trunk = new THREE.CylinderGeometry(0.17, 0.3, 3.4, 6)
  trunk.translate(0, 1.7, 0)
  const crownA = new THREE.IcosahedronGeometry(1.5, 0)
  crownA.translate(0, 3.7, 0)
  const crownB = new THREE.IcosahedronGeometry(1.05, 0)
  crownB.translate(0.7, 4.25, 0.25)
  const crownC = new THREE.IcosahedronGeometry(0.9, 0)
  crownC.translate(-0.6, 4.5, -0.3)
  return mergeParts([
    { geometry: trunk, color: new THREE.Color('#6d5a46') },
    { geometry: crownA, color: new THREE.Color('#4e6b3e') },
    { geometry: crownB, color: new THREE.Color('#5b7a47') },
    { geometry: crownC, color: new THREE.Color('#43603a') },
  ])
}

function Trees({ placements, night, shadow }: { placements: TreePlacement[]; night: boolean; shadow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(() => treeGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.94,
        metalness: 0,
        flatShading: true,
      }),
    [],
  )
  useEffect(() => {
    material.color.set(night ? '#7c8478' : '#ffffff')
  }, [material, night])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < placements.length; i++) {
      const tree = placements[i]
      dummy.position.set(tree.x, 0, tree.z)
      dummy.rotation.set(0, tree.rot, 0)
      // 每棵略不一样：有的瘦高，有的矮胖
      dummy.scale.set(tree.scale * (0.85 + tree.seed * 0.3), tree.scale, tree.scale * (0.85 + (1 - tree.seed) * 0.3))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [placements])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, placements.length]}
      castShadow={shadow}
      receiveShadow
      frustumCulled={false}
    />
  )
}

function RoofClutter({ boxes, night }: { boxes: RoofBox[]; night: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    box.translate(0, 0.5, 0)
    return box
  }, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.08 }),
    [],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    const tint = new THREE.Color()
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]
      dummy.position.set(box.x, box.y, box.z)
      dummy.rotation.set(0, box.rot, 0)
      dummy.scale.set(box.w, box.h, box.d)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // 水泥灰、铁皮灰、旧砖色之间随机
      const pick = (Math.sin(i * 12.9898) * 43758.5453) % 1
      const v = 0.34 + Math.abs(pick) * 0.22
      tint.setRGB(v, v * 0.99, v * 0.95)
      if (night) tint.multiplyScalar(0.75)
      mesh.setColorAt(i, tint)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [boxes, night])

  return <instancedMesh ref={ref} args={[geometry, material, boxes.length]} castShadow receiveShadow />
}

/** 水面：波纹法线缓慢流动，让高光散成粼粼的光路而不是一团死斑。 */
function Water({
  geometry,
  material,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.MeshStandardMaterial
}) {
  useFrame((state) => {
    const map = material.normalMap
    if (!map) return
    const t = state.clock.elapsedTime
    // 两组不同速度的偏移叠在一起，避免整片水朝一个方向平移的塑料感
    map.offset.set(t * 0.006, t * 0.004)
  })
  return <mesh geometry={geometry} material={material} renderOrder={1} receiveShadow />
}

/** 树底阴影：一张径向渐变的黑色贴片，InstancedMesh 一次画完。 */
function TreeShadows({ placements, night }: { placements: TreePlacement[]; night: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const texture = useMemo(() => makeContactShadowTexture(128, 0.3), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.42,
        toneMapped: false,
        color: night ? '#000000' : '#0a0c09',
      }),
    [texture, night],
  )
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1)
    plane.rotateX(-Math.PI / 2)
    return plane
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => texture.dispose(), [texture])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < placements.length; i++) {
      const tree = placements[i]
      const size = 3.4 * tree.scale
      dummy.position.set(tree.x, 0.125, tree.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(size, 1, size)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [placements])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, placements.length]}
      renderOrder={7}
      frustumCulled={false}
    />
  )
}

export function OsmScene() {
  const night = useApp((state) => state.night)
  const quality = useApp((state) => state.quality)
  const p = night ? palettes.night : palettes.dusk
  const sky = night ? SKY.night : SKY.dusk

  // 在渲染阶段就摆好，子组件的 useFrame 第一帧才不会用上一个场景的坐标
  useMemo(() => resetWalker(START.x, START.z, 0, 0.24), [])

  const size = useMemo(() => {
    const [minX, minZ, maxX, maxZ] = data.bounds
    return { w: maxX - minX, d: maxZ - minZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 }
  }, [])

  const chunks = useMemo(() => buildCity(data), [])
  const colliders = useMemo<Collider[]>(() => buildColliders(data), [])
  const roads = useMemo(() => buildRoads(data), [])
  const sidewalks = useMemo(() => buildSidewalks(data), [])
  const markings = useMemo(() => buildMarkings(data), [])
  const water = useMemo(() => buildWater(data), [])
  const areas = useMemo(() => buildAreas(data), [])
  const contact = useMemo(() => buildContactShadow(data), [])
  const treePlacements = useMemo(() => buildTrees(data), [])
  const roofBoxes = useMemo(() => buildRoofClutter(data), [])

  const buildingMaterial = useMemo(() => createOsmFacadeMaterial({ night }), [night])
  useEffect(() => () => buildingMaterial.dispose(), [buildingMaterial])

  const roadTexture = useMemo(() => makeAsphaltTexture('#4a4f52', 0.9), [])
  const roadMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: roadTexture,
        roughness: 0.93,
        metalness: 0.02,
        // 路面、人行道、标线彼此重叠，靠 renderOrder + 不写深度来避免共面闪烁
        depthWrite: false,
      }),
    [roadTexture],
  )
  useEffect(() => () => roadMaterial.dispose(), [roadMaterial])

  const flatMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.02,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => flatMaterial.dispose(), [flatMaterial])

  const markingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7,
        metalness: 0,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => markingMaterial.dispose(), [markingMaterial])

  const groundTexture = useMemo(() => {
    const texture = makePavingTexture('#8d8d88', '#7c7c76')
    // 铺装格子按 8 米一格，3km 的地面才不会读成一块灰板
    texture.repeat.set((size.w * 3.4) / 8, (size.d * 3.4) / 8)
    return texture
  }, [size])
  const groundMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#3b3b40' : '#b3b3ac',
        map: groundTexture,
        roughness: 0.96,
        metalness: 0.02,
      }),
    [night, groundTexture],
  )
  useEffect(() => () => groundMaterial.dispose(), [groundMaterial])

  const grainTexture = useMemo(() => makeGrainTexture(512, 0.2, 1100), [])
  const areaMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: grainTexture,
        roughness: 0.96,
        metalness: 0,
        depthWrite: false,
      }),
    [grainTexture],
  )
  useEffect(() => () => areaMaterial.dispose(), [areaMaterial])
  useEffect(() => () => grainTexture.dispose(), [grainTexture])

  // 纯黑的软阴影贴片：rgb 全 0，靠顶点 alpha 渐隐
  const contactMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => () => contactMaterial.dispose(), [contactMaterial])

  const waterNormal = useMemo(() => makeWaterNormalTexture(256, 1), [])
  const waterMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // 珠江这种内河是偏黄的深青，不是海蓝
        color: night ? '#0b1c24' : '#2a4b52',
        roughness: 0.34,
        metalness: 0,
        normalMap: waterNormal,
        normalScale: new THREE.Vector2(0.22, 0.22),
        envMapIntensity: 0.5,
        side: THREE.DoubleSide,
      }),
    [night, waterNormal],
  )
  useEffect(() => () => waterMaterial.dispose(), [waterMaterial])
  useEffect(() => () => waterNormal.dispose(), [waterNormal])

  const bounds = useMemo<Collider>(() => {
    const [minX, minZ, maxX, maxZ] = data.bounds
    const pad = (maxX - minX) * 0.16
    return {
      minX: minX - pad,
      maxX: maxX + pad,
      minZ: minZ - pad,
      maxZ: maxZ + pad,
      minY: -1,
      maxY: 0,
    }
  }, [])

  return (
    <div className="scene-root">
      <Canvas
        id="city-canvas"
        // 阴影与像素比不跟画质档走：切档时重建 shadow map / 绘制缓冲会卡一下，
        // 而且阴影突然消失会让整座城亮一档。档位只降后处理采样数。
        shadows="soft"
        dpr={1.25}
        camera={{ fov: 62, near: 0.45, far: 2600, position: [START.x, 4, START.z + 34] }}
        gl={{ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = p.exposure
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
      >
        <Suspense fallback={null}>
          <ExposureSync value={p.exposure} />
          <SkyDome
            night={night}
            horizon={sky.horizon}
            zenith={sky.zenith}
            sunDir={p.sunPos}
            sunColor={sky.sun}
            sunGain={sky.gain}
            center={[size.cx, size.cz]}
          />
          {/* 天空自己画，Environment 只出灯光。
              阴影相机固定覆盖整片城区（不跟玩家移动），影子的位置就永远是稳定的；
              跟着玩家走时，楼一旦进出阴影视锥，影子会突然出现/消失。 */}
          <Environment
            night={night}
            sky={false}
            shadowExtent={800}
            shadowFollow={false}
            shadowCenter={[size.cx, size.cz]}
          />
          <fog attach="fog" args={[sky.horizon, 260, 1650]} />

          {/* 地面：一整块，靠雾把边界吃掉 */}
          <mesh
            position={[size.cx, 0, size.cz]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            material={groundMaterial}
          >
            <planeGeometry args={[size.w * 3.4, size.d * 3.4]} />
          </mesh>

          {water && <Water geometry={water} material={waterMaterial} />}

          {/* 绿地 / 广场 / 停车场：压在地面之上、道路之下 */}
          {areas.map((geometry, i) => (
            <mesh
              key={`area-${i}`}
              geometry={geometry}
              material={areaMaterial}
              renderOrder={2}
              receiveShadow
            />
          ))}

          {/* 人行道 / 路面 / 标线：从低到高、renderOrder 递增，
              都不写深度。共面的三角面不会互相比深度，也就不会闪烁。 */}
          {sidewalks && (
            <mesh geometry={sidewalks} material={flatMaterial} renderOrder={3} receiveShadow />
          )}
          {roads.map((geometry, i) => (
            <mesh key={i} geometry={geometry} material={roadMaterial} renderOrder={4} receiveShadow />
          ))}
          {markings && (
            <mesh geometry={markings} material={markingMaterial} renderOrder={5} receiveShadow />
          )}

          {/* 建筑：每个 160m 区块一个 mesh，几十栋楼一次 draw call */}
          {chunks.map((chunk) => (
            <mesh
              key={chunk.key}
              geometry={chunk.geometry}
              material={buildingMaterial}
              castShadow
              receiveShadow
            />
          ))}

          {/* 屋顶设备和行道树：真实感的大头。没有这两样，
              整座城就是一片干净的白盒子。 */}
          <RoofClutter boxes={roofBoxes} night={night} />
          <Trees placements={treePlacements} night={night} shadow={quality > 1} />
          <TreeShadows placements={treePlacements} night={night} />

          {/* 楼脚的接触阴影。没有这一层，楼和地面之间会有一道"浮空"的缝。 */}
          {contact && (
            <mesh
              geometry={contact}
              material={contactMaterial}
              renderOrder={6}
              frustumCulled={false}
            />
          )}

          <QualityTuner />

          <PlayerRig
            colliders={colliders}
            bounds={{ minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ }}
            interactables={[]}
            cameraDistance={5.6}
          />
          <Preload all />
        </Suspense>
        {/* 后处理常开：挂在 quality > 0 里时，掉一档整条链会消失，画面突然发灰过曝 */}
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <SMAA />
          <Bloom
            luminanceThreshold={night ? 0.62 : 0.86}
            luminanceSmoothing={0.3}
            intensity={night ? 0.72 : 0.26}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
