import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * 性能工具：
 *  - chunkify：把整城一份的静态 InstancedMesh 按空间分块拆开（每块自己的包围球 → 视锥剔除生效），并登记视距
 *  - updateChunkLOD：按镜头位置（含高度）切换分块可见性；俯瞰全景时远处小件自动隐藏
 *  - freezeStatic：静态物体关掉 matrixAutoUpdate，每帧不再重算上万个矩阵
 */
const registry = []

export function chunkify(list, { chunk = 1000, dist = 800 } = {}) {
  for (const im of list) {
    if (!im?.isInstancedMesh || !im.parent || im.count < 32) continue
    const parent = im.parent
    const a = im.instanceMatrix.array
    const buckets = new Map()
    for (let i = 0; i < im.count; i++) {
      const k = `${Math.floor(a[i * 16 + 12] / chunk)}|${Math.floor(a[i * 16 + 14] / chunk)}`
      let b = buckets.get(k)
      if (!b) buckets.set(k, (b = []))
      b.push(i)
    }
    const col = im.instanceColor
    for (const idx of buckets.values()) {
      const n = new THREE.InstancedMesh(im.geometry, im.material, idx.length)
      n.instanceMatrix.setUsage(THREE.StaticDrawUsage)
      const dst = n.instanceMatrix.array
      for (let j = 0; j < idx.length; j++) for (let q = 0; q < 16; q++) dst[j * 16 + q] = a[idx[j] * 16 + q]
      if (col) {
        const c = new THREE.Color()
        for (let j = 0; j < idx.length; j++) { im.getColorAt(idx[j], c); n.setColorAt(j, c) }
      }
      n.name = im.name
      n.renderOrder = im.renderOrder
      n.castShadow = false
      n.receiveShadow = false
      n.position.copy(im.position)
      n.quaternion.copy(im.quaternion)
      n.scale.copy(im.scale)
      n.updateMatrix()
      n.matrixAutoUpdate = false
      n.computeBoundingSphere()
      n.userData.lodDist = dist
      parent.add(n)
      registry.push(n)
    }
    parent.remove(im)
    im.dispose()
  }
}

const _v = new THREE.Vector3()
export function updateChunkLOD(cam) {
  for (let i = 0; i < registry.length; i++) {
    const m = registry[i]
    _v.copy(m.boundingSphere.center).applyMatrix4(m.matrixWorld)
    const d = _v.distanceTo(cam) - m.boundingSphere.radius
    m.visible = d < m.userData.lodDist
  }
}

/** 静态子树：关掉逐帧矩阵重算（skip 里的子树保持动态） */
export function freezeStatic(root, skip = []) {
  const skipSet = new Set(skip.filter(Boolean))
  const walk = (o) => {
    if (skipSet.has(o)) return
    o.updateMatrix()
    o.matrixAutoUpdate = false
    for (const c of o.children) walk(c)
  }
  walk(root)
  root.updateMatrixWorld(true)
}

/**
 * 合并静态普通网格：同材质 + 同属性布局 + 同 renderOrder + 同 1000m 分块 → mergeGeometries 成一个网格。
 * 墙体分段、自然带切片、道路、桥构件、公园底板等几千个小 Mesh → 几百个 draw call。
 */
export function mergeStatic(root, skip = [], chunk = 1000) {
  const skipSet = new Set(skip.filter(Boolean))
  root.updateMatrixWorld(true)
  const groups = new Map()
  const walk = (o) => {
    if (skipSet.has(o)) return
    for (const c of o.children) walk(c)
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.name || !o.visible) return
    if (o.material.transparent && o.material.depthWrite === false) return // 透明贴花保持独立（排序）
    // 自定义 shader 若依赖物体局部坐标（立面窗格等），合并后会错位；只合并标记为世界坐标安全的
    if (o.material.isShaderMaterial) return
    if (o.material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile && !o.material.userData.mergeOK) return
    if (o.matrixWorld.determinant() < 0) return
    const geo = o.geometry
    if (!geo?.attributes?.position || geo.morphAttributes?.position) return
    const sig = Object.keys(geo.attributes).sort().join(',') + (geo.index ? ':i' : ':n')
    if (!geo.boundingSphere) geo.computeBoundingSphere()
    const c = geo.boundingSphere.center.clone().applyMatrix4(o.matrixWorld)
    const key = `${o.material.uuid}|${sig}|${o.renderOrder}|${Math.floor(c.x / chunk)}|${Math.floor(c.z / chunk)}`
    let gArr = groups.get(key)
    if (!gArr) groups.set(key, (gArr = []))
    gArr.push(o)
  }
  walk(root)
  let merged = 0
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const geos = list.map((m) => {
      const gg = m.geometry.clone()
      gg.applyMatrix4(m.matrixWorld)
      for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k)
      return gg
    })
    let mg = null
    try { mg = mergeGeometries(geos, false) } catch { mg = null }
    for (const gg of geos) gg.dispose()
    if (!mg) continue
    const m0 = list[0]
    const out = new THREE.Mesh(mg, m0.material)
    out.renderOrder = m0.renderOrder
    out.receiveShadow = false
    out.castShadow = false
    out.matrixAutoUpdate = false
    root.add(out)
    for (const m of list) m.parent?.remove(m)
    merged += list.length
  }
  return merged
}
