import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// 城市里绝大多数构件（窗框、阳台、屋顶设备、街灯、树木……）都是静态的，
// 但每个小方块都是一次 draw call。这里在挂载后把静态网格按「区块 × 材质类」合并：
//
// - 小构件按 64m 网格分块合并，每个块一个网格并保留 frustumCulled，
//   转头或背对街区时整块被 three.js 剔除，阴影 pass 也会一起省掉。
// - 材质颜色烘焙进顶点色，于是"每栋楼各自的墙面色"不再是各自的材质：
//   同粗糙度/金属度的所有楼体可以合成一个 draw call。
// - 跨越多个区块的大件（楼体、地面、路面）合并到全局桶，靠自身包围球剔除。
// - castShadow 也参与合批签名，避免不投影的构件跟着一起进阴影 pass。
// - 角色、车流、行人、脉冲霓虹通过 userData.dynamic 排除。

const CHUNK = 120

type Bucket = {
  material: THREE.Material
  geos: THREE.BufferGeometry[]
  meshes: THREE.Mesh[]
  renderOrder: number
  castShadow: boolean
  receiveShadow: boolean
}

function isDynamic(node: THREE.Object3D) {
  let current: THREE.Object3D | null = node
  while (current) {
    if (current.userData.dynamic || current.userData.noMerge) return true
    current = current.parent
  }
  return false
}

const band = (value: number | undefined, step = 0.15) =>
  value === undefined ? '' : (Math.round(value / step) * step).toFixed(2)

const cache = new Map<string, THREE.Material>()

/** 把"颜色"从材质里抽出来烘焙到顶点色，只保留影响光照的粗糙度/金属度等类别。 */
function classify(source: THREE.Material): { key: string; baked: THREE.Material } | null {
  const std = source as THREE.MeshStandardMaterial
  const basic = source as THREE.MeshBasicMaterial
  const map = basic.map || null
  if (std.alphaMap) return null
  // 普通混合的半透明会依赖绘制顺序，合批会串色，跳过。
  if (source.transparent) {
    const additive = source.blending !== THREE.NormalBlending
    if (!additive || source.depthWrite) return null
  }

  const isBasic = (source as THREE.MeshBasicMaterial).isMeshBasicMaterial === true
  const key = [
    isBasic ? 'basic' : 'std',
    source.side,
    source.transparent ? 1 : 0,
    source.opacity.toFixed(2),
    source.blending,
    source.depthWrite ? 1 : 0,
    isBasic ? '' : band(std.roughness),
    isBasic ? '' : band(std.metalness),
    isBasic ? '' : (std.emissive ? std.emissive.getHexString() : ''),
    isBasic ? '' : band(std.emissiveIntensity, 0.1),
    std.flatShading ? 'flat' : '',
    source.toneMapped ? 'tm' : '',
    map ? map.uuid : '',
    (source as THREE.MeshStandardMaterial).envMapIntensity !== undefined
      ? band((source as THREE.MeshStandardMaterial).envMapIntensity, 0.25)
      : '',
  ].join('|')

  const cached = cache.get(key)
  if (cached) return { key, baked: cached }

  let created: THREE.Material
  if (isBasic) {
    created = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: map || undefined,
      vertexColors: true,
      transparent: source.transparent,
      opacity: source.opacity,
      blending: source.blending,
      depthWrite: source.depthWrite,
      side: source.side,
      toneMapped: source.toneMapped,
    })
  } else {
    created = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: std.roughness,
      metalness: std.metalness,
      emissive: std.emissive,
      emissiveIntensity: std.emissiveIntensity,
      flatShading: std.flatShading,
      metalnessMap: std.metalnessMap,
      roughnessMap: std.roughnessMap,
      envMapIntensity: std.envMapIntensity,
      transparent: source.transparent,
      opacity: source.opacity,
      blending: source.blending,
      depthWrite: source.depthWrite,
      side: source.side,
      toneMapped: source.toneMapped,
    })
  }
  cache.set(key, created)
  return { key, baked: created }
}

/** 每个几何补一份 color 属性，值等于它原材质的颜色。 */
function bakeColor(geo: THREE.BufferGeometry, color: THREE.Color) {
  const count = geo.attributes.position.count
  const existing = geo.attributes.color
  if (existing && existing.itemSize === 3) {
    for (let i = 0; i < count; i++) {
      existing.setXYZ(
        i,
        existing.getX(i) * color.r,
        existing.getY(i) * color.g,
        existing.getZ(i) * color.b,
      )
    }
    existing.needsUpdate = true
    return
  }
  const array = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    array[i * 3] = color.r
    array[i * 3 + 1] = color.g
    array[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(array, 3))
}

function mergeScene(scene: THREE.Scene) {
  scene.updateMatrixWorld(true)

  const buckets = new Map<string, Bucket>()
  const box = new THREE.Box3()
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()

  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return
    const mesh = obj as THREE.Mesh
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) return
    if (Array.isArray(mesh.material) || !mesh.material) return
    if (isDynamic(mesh)) return
    const geo = mesh.geometry as THREE.BufferGeometry
    if (!geo || !geo.attributes.position || !geo.attributes.normal || !geo.attributes.uv) return
    const classified = classify(mesh.material)
    if (!classified) return

    if (!geo.boundingBox) geo.computeBoundingBox()
    box.copy(geo.boundingBox!).applyMatrix4(mesh.matrixWorld)
    box.getSize(size)
    box.getCenter(center)

    // 跨越多个区块的大件（楼体、地面、路面）走全局桶，靠包围球剔除。
    const spansChunks = size.x > CHUNK * 0.9 || size.z > CHUNK * 0.9
    const cell = spansChunks
      ? 'global'
      : `${Math.floor(center.x / CHUNK)}_${Math.floor(center.z / CHUNK)}`
    // 属性集合与是否索引必须一致，否则 mergeGeometries 会失败。
    const layout = `${geo.index ? 'i' : 'n'}_${Object.keys(geo.attributes).sort().join(',')}`
    const key = `${cell}|${mesh.castShadow ? 1 : 0}|${layout}|${classified.key}`

    const existing = buckets.get(key)
    if (existing) {
      existing.geos.push(geo)
      existing.meshes.push(mesh)
      existing.renderOrder = Math.max(existing.renderOrder, mesh.renderOrder)
      existing.receiveShadow = existing.receiveShadow || mesh.receiveShadow
      return
    }
    buckets.set(key, {
      material: classified.baked,
      geos: [geo],
      meshes: [mesh],
      renderOrder: mesh.renderOrder,
      castShadow: mesh.castShadow,
      receiveShadow: mesh.receiveShadow,
    })
  })

  const root = new THREE.Group()
  root.name = 'static-merged'
  root.frustumCulled = false
  scene.add(root)
  const hidden: THREE.Object3D[] = []

  buckets.forEach((bucket) => {
    if (bucket.meshes.length < 2) return
    const baked: THREE.BufferGeometry[] = []
    for (const mesh of bucket.meshes) {
      const clone = mesh.geometry.clone()
      clone.applyMatrix4(mesh.matrixWorld)
      const source = mesh.material as THREE.MeshStandardMaterial
      if (source.color) bakeColor(clone, source.color)
      baked.push(clone)
    }
    const merged = mergeGeometries(baked, false)
    baked.forEach((geo) => geo.dispose())
    if (!merged) return
    merged.computeBoundingSphere()
    merged.computeBoundingBox()

    const mesh = new THREE.Mesh(merged, bucket.material)
    mesh.matrixAutoUpdate = false
    mesh.renderOrder = bucket.renderOrder
    mesh.castShadow = bucket.castShadow
    mesh.receiveShadow = bucket.receiveShadow
    mesh.frustumCulled = true
    mesh.userData.merged = true
    root.add(mesh)

    for (const original of bucket.meshes) {
      original.visible = false
      hidden.push(original)
    }
  })

  return () => {
    for (const child of [...root.children]) {
      const mesh = child as THREE.Mesh
      mesh.removeFromParent()
      mesh.geometry.dispose()
    }
    root.removeFromParent()
    for (const original of hidden) original.visible = true
  }
}

export function StaticMerge({ version }: { version: number }) {
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    let dispose: (() => void) | null = null
    let cancelled = false
    // 等一帧，确保所有子组件的矩阵和几何都已提交。
    const raf = requestAnimationFrame(() => {
      if (cancelled) return
      dispose = mergeScene(scene)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      dispose?.()
    }
  }, [scene, version])

  return null
}
