import * as THREE from 'three'

/**
 * 被遮挡时的角色剪影。
 *
 * 原理是两遍模板测试：
 * 1. 角色正常绘制时，每个通过深度测试的像素往模板缓冲写 1；
 * 2. 剪影用 GreaterDepth（只在"被别的东西挡住"的地方通过），
 *    并且只画模板 ≠ 1 的像素。
 * 这样手臂挡住身体时不会出剪影（那块像素角色自己已经写了 1），
 * 只有楼、树、车挡住的部分才显示一层半透明轮廓。剪影自己也写 1，
 * 前后重叠的部位不会叠成更亮的一块。
 *
 * 需要渲染器和后处理都开启模板缓冲（Canvas gl.stencil / EffectComposer stencilBuffer）。
 */
const GHOST = new THREE.MeshBasicMaterial({
  color: '#8fdcff',
  transparent: true,
  opacity: 0.46,
  depthWrite: false,
  depthFunc: THREE.GreaterDepth,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilFail: THREE.KeepStencilOp,
  stencilZFail: THREE.KeepStencilOp,
  stencilZPass: THREE.ReplaceStencilOp,
  fog: false,
  toneMapped: false,
})

const noRaycast = () => {}

function markSolid(material: THREE.Material) {
  material.stencilWrite = true
  material.stencilRef = 1
  material.stencilFunc = THREE.AlwaysStencilFunc
  material.stencilZPass = THREE.ReplaceStencilOp
}

/** 给 root 下所有 mesh 挂一份剪影（userData.noGhost 的子树跳过）。返回清理函数。 */
export function attachSilhouette(root: THREE.Object3D) {
  const pairs: Array<[THREE.Mesh, THREE.Mesh]> = []
  const visit = (node: THREE.Object3D) => {
    if (node.userData.noGhost || node.userData.isGhost) return
    const mesh = node as THREE.Mesh
    if (mesh.isMesh && mesh.geometry) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (list.every((m) => m && !m.transparent)) {
        list.forEach(markSolid)
        const ghost = new THREE.Mesh(mesh.geometry, GHOST)
        ghost.userData.isGhost = true
        ghost.userData.noOcclude = true
        ghost.raycast = noRaycast
        ghost.renderOrder = 20
        ghost.castShadow = false
        ghost.receiveShadow = false
        pairs.push([mesh, ghost])
      }
    }
    for (const child of node.children) visit(child)
  }
  visit(root)
  // 收集完再挂，避免遍历时把剪影自己也访问一遍
  for (const [mesh, ghost] of pairs) mesh.add(ghost)
  return () => {
    for (const [, ghost] of pairs) ghost.removeFromParent()
  }
}
