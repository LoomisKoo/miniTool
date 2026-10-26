import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { drainTextures, queueObjectTextures, texturesReady } from './textureWarm'

// 真实模型资产（Poly Haven，CC0）。
//
// 为什么不用 drei 的 useGLTF：Vite 只会把「你 import 的那个 .gltf」当静态文件
// 复制出去，gltf 内部引用的 .bin 和 textures/*.jpg 不会被处理，打包后必然 404。
// 所以这里用 import.meta.glob 把所有相关文件都登记成 URL，再自己改写 gltf 里
// 的 uri。代价是要手写十几行，好处是开发和生产的行为完全一致。
//
// 扫描级资产的三角面数很高，只适合放"近景单品"（消防栓、垃圾桶、消防梯），
// 不适合铺满街道；树之类的重复元素仍然走程序化 + instancing。

const fileSets = import.meta.glob('../assets/models/**/*.{gltf,bin,jpg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function filesOf(id: string) {
  const prefix = `../assets/models/${id}/`
  const out = new Map<string, string>()
  for (const [path, url] of Object.entries(fileSets)) {
    if (path.startsWith(prefix)) out.set(path.slice(prefix.length), url)
  }
  return out
}

async function parseGltf(id: string): Promise<THREE.Object3D> {
  const files = filesOf(id)
  const entry = [...files.entries()].find(([path]) => path.endsWith('.gltf'))
  if (!entry) throw new Error(`model ${id} 缺少 gltf`)

  const response = await fetch(entry[1])
  if (!response.ok) throw new Error(`加载 ${id} 失败：${response.status}`)
  const json = await response.json()

  const resolve = (uri: string) => {
    if (uri.startsWith('data:')) return uri
    const clean = decodeURIComponent(uri).replace(/^\.\//, '')
    const direct = files.get(clean)
    if (direct) return direct
    const leaf = clean.split('/').pop() || clean
    const hit = [...files.entries()].find(([path]) => path.endsWith(`/${leaf}`))
    return hit ? hit[1] : uri
  }

  for (const buffer of json.buffers || []) if (buffer.uri) buffer.uri = resolve(buffer.uri)
  for (const image of json.images || []) if (image.uri) image.uri = resolve(image.uri)

  const loader = new GLTFLoader()
  const gltf = await new Promise<{ scene: THREE.Group }>((ok, fail) => {
    loader.parse(JSON.stringify(json), '', ok as never, fail)
  })

  const root = gltf.scene
  root.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = true
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      const std = material as THREE.MeshStandardMaterial
      if (std.isMeshStandardMaterial) {
        // 扫描资产的贴图已经很暗，环境反射稍微提一点才接得上城市的光。
        std.envMapIntensity = 1.15
        std.side = THREE.FrontSide
        if (std.map) std.map.anisotropy = 8
      }
    }
  })
  return root
}

const cache = new Map<string, Promise<THREE.Object3D | null>>()

function load(id: string) {
  let pending = cache.get(id)
  if (!pending) {
    pending = parseGltf(id)
      .catch((error) => {
        console.warn(`模型 ${id} 加载失败：`, error)
        return null
      })
    cache.set(id, pending)
  }
  return pending
}

/** 异步取模型；失败返回 null，调用方自己决定要不要退回程序化版本。 */
export function useAssetModel(id: string) {
  const [object, setObject] = useState<THREE.Object3D | null>(null)
  useEffect(() => {
    let alive = true
    setObject(null)
    void load(id).then((next) => {
      if (alive) setObject(next)
    })
    return () => {
      alive = false
    }
  }, [id])
  return object
}

export type AssetModelProps = {
  id: string
  /** 归一化后的世界高度（米）；模型的原始尺寸差别很大 */
  height: number
  position: [number, number, number]
  rotation?: number
  /** 落地对齐：把包围盒底部放到地面 */
  alignBottom?: boolean
}

export function AssetModel({ id, height, position, rotation = 0, alignBottom = true }: AssetModelProps) {
  const source = useAssetModel(id)
  const gl = useThree((state) => state.gl)
  const queued = useRef(false)
  const [warm, setWarm] = useState(false)

  const clone = useMemo(() => {
    if (!source) return null
    const copy = source.clone(true)
    const box = new THREE.Box3().setFromObject(copy)
    const size = box.getSize(new THREE.Vector3())
    const scale = height / Math.max(0.0001, size.y)
    copy.scale.setScalar(scale)
    if (alignBottom) copy.position.y = -box.min.y * scale
    copy.traverse((node) => {
      node.frustumCulled = true
    })
    return copy
  }, [source, height, alignBottom])

  // 模型到达那一帧不要直接挂：它的贴图（消火栓 6 张、垃圾桶 6 张）在首次绘制时
  // 是一次性 texImage2D，实测那一帧 +textures=15 / gl=185ms。先逐帧传完再显示。
  useEffect(() => {
    queued.current = false
    setWarm(false)
  }, [clone])

  useFrame(() => {
    if (!clone || warm) return
    if (!queued.current) {
      queueObjectTextures(clone)
      queued.current = true
    }
    drainTextures(gl, 2)
    if (texturesReady(clone)) setWarm(true)
  })

  if (!clone || !warm) return null
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <primitive object={clone} />
    </group>
  )
}
