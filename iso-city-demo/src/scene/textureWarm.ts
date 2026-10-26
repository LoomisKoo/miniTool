import * as THREE from 'three'

/**
 * 给"异步到达"的资产（GLTF 道具）补一条和 buildQueue 一样的逐帧上传队列。
 *
 * 为什么需要：程序化生成的楼、街具都走了 buildQueue，贴图是每帧 4 张慢慢传的。
 * 但消防栓、垃圾桶这类模型是 fetch 完才 resolve 的，拿到就 <primitive> 挂上去，
 * 那一帧 15 张贴图一次性 texImage2D —— 日志里 +textures=15 / gl=185ms 就是它。
 * 而且那一帧 calls=1、tris=0，画的不是场景，纯粹在传图。
 *
 * 这里统一走一条全局队列：不管多少个模型同时到达，每帧最多传 budget 张，
 * 传完之前模型先不显示（反正片头挡着，晚 3~4 帧看不出来）。
 */

const MAP_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
] as const

/** 已经真正 texImage2D 过的贴图。同一张图被多个实例共享，只传一次。 */
const uploaded = new WeakSet<THREE.Texture>()
const queued = new WeakSet<THREE.Texture>()
const queue: THREE.Texture[] = []
/** gl.info.render.frame 是 three 自带的帧计数，比自己数 delta 可靠 */
let frame = -1
let spent = 0

function materialsOf(root: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = []
  root.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh || !mesh.material) return
    if (Array.isArray(mesh.material)) out.push(...mesh.material)
    else out.push(mesh.material)
  })
  return out
}

function slotsOf(material: THREE.Material): THREE.Texture[] {
  const record = material as unknown as Record<string, THREE.Texture | null>
  const out: THREE.Texture[] = []
  for (const slot of MAP_SLOTS) {
    const tex = record[slot]
    if (tex && tex.isTexture) out.push(tex)
  }
  return out
}

/** 把对象用到的贴图登记进队列（幂等）。 */
export function queueObjectTextures(root: THREE.Object3D) {
  for (const material of materialsOf(root)) {
    for (const tex of slotsOf(material)) {
      if (uploaded.has(tex) || queued.has(tex)) continue
      queued.add(tex)
      // 反着取：先传的放队尾，pop 时先传最早登记的
      queue.unshift(tex)
    }
  }
}

/** 每帧调一次。返回还剩多少张没传。 */
export function drainTextures(gl: THREE.WebGLRenderer, budget: number): number {
  const current = gl.info.render.frame
  if (current !== frame) {
    frame = current
    spent = 0
  }
  while (queue.length > 0 && spent < budget) {
    const tex = queue.pop()
    if (!tex) break
    gl.initTexture(tex)
    uploaded.add(tex)
    spent += 1
  }
  return queue.length
}

/** 这个对象的贴图是不是都传完了。 */
export function texturesReady(root: THREE.Object3D): boolean {
  for (const material of materialsOf(root)) {
    for (const tex of slotsOf(material)) {
      if (!uploaded.has(tex)) return false
    }
  }
  return true
}
