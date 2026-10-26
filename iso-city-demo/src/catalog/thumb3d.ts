// 图鉴缩略图：用和城市里同一份体素模型离屏渲染。
//
// 关键约束：卡片上的图必须和街上看到的是同一只，所以这里不做任何「长什么样」
// 的逻辑，只换相机和光。每个品种渲染一次后缓存成 data URL。

import * as THREE from 'three'
import { speciesOf } from './species'
import { voxelMaterial } from '../pets/voxel/build'
import { partMatrices, petModel } from '../pets/voxel/runtime'

const SIZE = 160

let renderer: THREE.WebGLRenderer | null = null
let rendererFailed = false

function getRenderer() {
  if (renderer) return renderer
  // 拿不到第二个 WebGL 上下文就别再试了，否则每个品种都会抛一次
  if (rendererFailed) return null
  try {
    const gl = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
    gl.setPixelRatio(1)
    gl.setSize(SIZE, SIZE)
    gl.setClearAlpha(0)
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.toneMapping = THREE.NoToneMapping
    renderer = gl
    return gl
  } catch {
    rendererFailed = true
    return null
  }
}

const cache = new Map<string, string>()

function render(speciesId: string, breedId: string) {
  const gl = getRenderer()
  if (!gl) return ''
  const scene = new THREE.Scene()

  // 明亮、低对比：卡通模型要软，阴影只用来分出面
  const hemi = new THREE.HemisphereLight('#ffffff', '#d8c8b8', 2.0)
  const key = new THREE.DirectionalLight('#fff6e6', 1.8)
  key.position.set(2.2, 3.6, 3.4)
  const fill = new THREE.DirectionalLight('#dbe8ff', 0.7)
  fill.position.set(-3, 1.2, 2)
  scene.add(hemi, key, fill)

  const pet = petModel(speciesId, breedId)
  const matrices = partMatrices(pet, null, 0, [])
  const box = new THREE.Box3()
  const tmp = new THREE.Box3()
  pet.parts.forEach((part, i) => {
    const mesh = new THREE.Mesh(part.geometry, voxelMaterial())
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(matrices[i])
    scene.add(mesh)
    part.geometry.computeBoundingBox()
    tmp.copy(part.geometry.boundingBox as THREE.Box3).applyMatrix4(matrices[i])
    box.union(tmp)
  })
  scene.updateMatrixWorld(true)

  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const half = sphere.radius * 0.9
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, sphere.radius * 8)
  // 更接近正面、略低的 3/4 视角：大眼和口鼻是主角，尾巴仍然露一点
  const dir = new THREE.Vector3(0.55, 0.26, 0.82).normalize()
  camera.position.copy(sphere.center).addScaledVector(dir, sphere.radius * 4)
  camera.lookAt(sphere.center)

  gl.render(scene, camera)
  return gl.domElement.toDataURL('image/png')
}

export function petThumb(speciesId: string, breedId: string) {
  const key = `${speciesId}/${breedId}`
  const hit = cache.get(key)
  if (hit) return hit
  if (!speciesOf(speciesId).breeds.some((b) => b.id === breedId)) return ''
  const url = render(speciesId, breedId)
  cache.set(key, url)
  return url
}
