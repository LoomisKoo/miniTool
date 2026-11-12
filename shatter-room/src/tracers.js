import * as THREE from 'three'

/** 淡淡的弹道残影（短、细、半透明） */
export function createTracerSystem(scene) {
  const tracers = []

  function spawn(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    if (len < 0.08) return
    dir.normalize()

    const geo = new THREE.CylinderGeometry(0.003, 0.0015, len, 5, 1, true)
    geo.translate(0, len / 2, 0)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff0c8,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(from)
    mesh.userData.fx = true
    mesh.raycast = () => {}
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    scene.add(mesh)

    tracers.push({ mesh, born: performance.now(), life: 38 })
  }

  function update(now) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i]
      const k = 1 - (now - t.born) / t.life
      if (k <= 0) {
        scene.remove(t.mesh)
        t.mesh.geometry.dispose()
        t.mesh.material.dispose()
        tracers.splice(i, 1)
        continue
      }
      t.mesh.material.opacity = 0.28 * k * k
    }
  }

  return { spawn, update }
}
