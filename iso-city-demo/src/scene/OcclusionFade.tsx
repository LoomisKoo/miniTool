import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { walker } from '../game/walker'

/**
 * 挡在镜头和人物之间的东西变半透明。
 *
 * 淡出是按 mesh 做的：第一次挡住时给这个 mesh 换一份克隆材质，恢复后再换回原材质。
 * 以前直接改共享材质的 opacity，一盏路灯挡住视线，整条街共用这份材质的灯杆
 * 一起变透明又恢复——这就是"墙和柱子在闪"。
 *
 * 另外带一段保持时间：射线擦着物体边缘时会在挡/不挡之间来回跳，
 * 保持 0.45 秒再恢复，物体就不会一明一暗地抖。
 */

/** 重新打射线的间隔（秒）。 */
const INTERVAL = 0.08
/** 遮挡物淡到多少不透明度。 */
const TARGET = 0.25
/** 淡出/恢复速度（每秒收敛率）。 */
const SPEED = 10
/** 离开视线后保持多久才开始恢复。 */
const HOLD = 0.45
/** 离人物这么近的命中不算遮挡。 */
const GUARD = 0.42
/** 太小的东西不值得淡（灯杆、栏杆），淡了反而一闪一闪。 */
const MIN_RADIUS = 0.9
/** 太大的东西是合批后的整片城市，淡它等于整座城变透明。 */
const MAX_RADIUS = 70
/**
 * 相机离人物超过这个距离，就完全不做遮挡检测。
 *
 * 入城运镜/飞行/总览时相机在几十到两百米外，这一条射线要横穿合批后的整块
 * 城市——一块就是几万个三角形，而且没有 BVH，是逐三角形求交。每个检测周期
 * 都在这上面花几十毫秒，表现出来就是"飞行途中一顿一顿"。
 * 只有近身第三人称才可能被挡住，远了直接跳过。
 */
const MAX_DISTANCE = 30
/** 每个检测周期最多认几个遮挡物：一帧里克隆一堆材质本身就是一次尖峰。 */
const MAX_HITS = 6

type Faded = {
  mesh: THREE.Mesh
  original: THREE.Material | THREE.Material[]
  clones: THREE.Material[]
  base: number[]
  opacity: number
  hold: number
  castShadow: boolean
}

function blocksView(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (node.userData.noOcclude) return false
    if (!node.visible) return false
  }
  return true
}

function fadable(material: THREE.Material) {
  if (!material || !material.visible) return false
  if (material.transparent && material.opacity < 0.85) return false
  if (material.depthTest === false) return false
  if ((material as THREE.ShaderMaterial).isShaderMaterial) return false
  return true
}

function sizeOf(mesh: THREE.Mesh) {
  const geo = mesh.geometry
  if (!geo.boundingSphere) geo.computeBoundingSphere()
  const r = geo.boundingSphere?.radius ?? 0
  const s = mesh.matrixWorld.getMaxScaleOnAxis()
  return r * s
}

export function OcclusionFade() {
  const { camera, scene } = useThree()
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const from = useMemo(() => new THREE.Vector3(), [])
  const to = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const playerAt = useMemo(() => new THREE.Vector3(), [])
  const timer = useRef(INTERVAL)
  const faded = useRef(new Map<THREE.Mesh, Faded>())

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const entries = faded.current

    // 相机离人太远（飞行、总览、入城运镜）就没有"被人挡住"这回事，
    // 连射线都不打。已经在淡出的物件仍然按原逻辑恢复，不然会留在半透明状态。
    const farAway =
      camera.position.distanceTo(
        playerAt.set(walker.position.x, walker.position.y + 1.2, walker.position.z),
      ) > MAX_DISTANCE

    timer.current += delta
    if (timer.current >= INTERVAL && !farAway) {
      timer.current = 0
      // 同时打胸口和头顶两条：只打一条时，镜头稍一抬就会在挡/不挡之间跳
      const hitNow = new Set<THREE.Mesh>()
      for (const height of [1.0, 1.55]) {
        to.set(walker.position.x, walker.position.y + height, walker.position.z)
        from.copy(camera.position)
        dir.subVectors(to, from)
        const distance = dir.length()
        if (distance <= GUARD + 0.3) continue
        ray.set(from, dir.normalize())
        ray.near = 0.05
        ray.far = Math.max(0.05, distance - GUARD)
        for (const hit of ray.intersectObjects(scene.children, true)) {
          if (hitNow.size >= MAX_HITS) break
          const mesh = hit.object as THREE.Mesh
          if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) continue
          if (hitNow.has(mesh) || entries.has(mesh)) {
            hitNow.add(mesh)
            continue
          }
          if (!blocksView(mesh)) continue
          const r = sizeOf(mesh)
          if (r < MIN_RADIUS || r > MAX_RADIUS) continue
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          if (!list.every(fadable)) continue
          hitNow.add(mesh)
        }
      }

      for (const mesh of hitNow) {
        const entry = entries.get(mesh)
        if (entry) {
          entry.hold = HOLD
          continue
        }
        const original = mesh.material
        const list = Array.isArray(original) ? original : [original]
        // 克隆一份专属材质：只影响这一个 mesh，不连累共用材质的其它物体。
        // 透明材质要关深度写入，否则淡掉的墙依旧把后面挡住。
        const clones = list.map((m) => {
          const c = m.clone()
          c.transparent = true
          c.depthWrite = false
          return c
        })
        mesh.material = Array.isArray(original) ? clones : clones[0]
        entries.set(mesh, {
          mesh,
          original,
          clones,
          base: list.map((m) => m.opacity),
          opacity: 1,
          hold: HOLD,
          castShadow: mesh.castShadow,
        })
        // 看不见的墙不该继续投一片实心的影
        mesh.castShadow = false
      }
    }

    for (const [mesh, entry] of entries) {
      if (entry.hold > 0) entry.hold -= delta
      const target = entry.hold > 0 ? TARGET : 1
      entry.opacity = THREE.MathUtils.damp(entry.opacity, target, SPEED, delta)
      entry.clones.forEach((c, i) => {
        c.opacity = entry.base[i] * entry.opacity
      })
      if (entry.hold <= 0 && entry.opacity > 0.985) {
        mesh.material = entry.original
        mesh.castShadow = entry.castShadow
        entry.clones.forEach((c) => c.dispose())
        entries.delete(mesh)
      }
    }
  })

  return null
}
