import * as THREE from 'three'
import * as CANNON from 'cannon-es'

const PORCELAIN = 0xe8d8c8
const ACCENTS = [0xc45c4a, 0x3d6b8c, 0x2f6b4f, 0xb08d57]

function lathePoints(h = 0.55, r = 0.16) {
  return [
    new THREE.Vector2(0.02, 0),
    new THREE.Vector2(r * 0.7, h * 0.08),
    new THREE.Vector2(r, h * 0.28),
    new THREE.Vector2(r * 0.85, h * 0.55),
    new THREE.Vector2(r * 0.45, h * 0.78),
    new THREE.Vector2(r * 0.55, h * 0.9),
    new THREE.Vector2(r * 0.35, h),
  ]
}

export function createVaseMesh(seed = 0) {
  const h = 0.78 + (seed % 5) * 0.08
  const r = 0.22 + (seed % 4) * 0.035
  // 更高细分，用真实网格命中，不再靠放大判定体
  const geo = new THREE.LatheGeometry(lathePoints(h, r), 48)
  geo.computeBoundingBox()
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({
    color: PORCELAIN,
    roughness: 0.28,
    metalness: 0.08,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.82, 0.012, 8, 24),
    new THREE.MeshStandardMaterial({ color: ACCENTS[seed % ACCENTS.length], roughness: 0.5 }),
  )
  band.rotation.x = Math.PI / 2
  band.position.y = h * 0.55
  // 装饰不参与射击判定，避免挡弹/误判
  band.raycast = () => {}
  mesh.add(band)

  mesh.userData.height = h
  mesh.userData.radius = r
  mesh.userData.accent = ACCENTS[seed % ACCENTS.length]
  return mesh
}

function makeShardGeometry(kind) {
  // 瓷器碎片偏「薄片 / 弧片」
  let sx, sy, sz
  if (kind === 'plate') {
    sx = 0.06 + Math.random() * 0.1
    sy = 0.012 + Math.random() * 0.02
    sz = 0.05 + Math.random() * 0.09
  } else if (kind === 'splinter') {
    sx = 0.02 + Math.random() * 0.03
    sy = 0.04 + Math.random() * 0.08
    sz = 0.015 + Math.random() * 0.025
  } else {
    sx = 0.04 + Math.random() * 0.07
    sy = 0.03 + Math.random() * 0.06
    sz = 0.03 + Math.random() * 0.05
  }

  const geo = new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1)
  const pos = geo.attributes.position
  for (let j = 0; j < pos.count; j++) {
    const x = pos.getX(j)
    const y = pos.getY(j)
    const z = pos.getZ(j)
    // 撕扯边缘 + 轻微弯曲，更像碎瓷片
    pos.setXYZ(
      j,
      x + (Math.random() - 0.5) * sx * 0.45,
      y + (Math.random() - 0.5) * sy * 0.35 + Math.sin(x * 18) * sy * 0.15,
      z + (Math.random() - 0.5) * sz * 0.45,
    )
  }
  geo.computeVertexNormals()
  return { geo, sx, sy, sz }
}

function spawnDust(scene, origin, count = 28) {
  const positions = new Float32Array(count * 3)
  const velocities = []
  for (let i = 0; i < count; i++) {
    positions[i * 3] = origin.x
    positions[i * 3 + 1] = origin.y
    positions[i * 3 + 2] = origin.z
    velocities.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        Math.random() * 1.8 + 0.3,
        (Math.random() - 0.5) * 2.2,
      ),
    )
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xf2ebe3,
    size: 0.035,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  scene.add(points)
  return { points, velocities, born: performance.now(), life: 700 }
}

/** 更真实的碎瓷：薄片 + 粉尘 + 击点径向飞溅 */
export function createShards(vaseMesh, world, scene, hitDir, hitPoint) {
  const box = vaseMesh.geometry.boundingBox
  const size = new THREE.Vector3()
  box.getSize(size)

  const color = vaseMesh.material.color.getHex()
  const accent = vaseMesh.userData.accent || color
  const shards = []
  const extras = []
  const count = 26 + Math.floor(Math.random() * 10)
  const hitLocal = vaseMesh.worldToLocal(hitPoint.clone())

  for (let i = 0; i < count; i++) {
    const kind = i < count * 0.55 ? 'plate' : i < count * 0.8 ? 'chunk' : 'splinter'
    const { geo, sx, sy, sz } = makeShardGeometry(kind)
    const useAccent = Math.random() < 0.18
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: useAccent ? accent : color,
        roughness: 0.38,
        metalness: 0.04,
        flatShading: true,
      }),
    )
    mesh.castShadow = true

    // 碎片初始位置更贴原瓶表面分布
    const local = new THREE.Vector3(
      (Math.random() - 0.5) * size.x * 0.95,
      Math.random() * size.y,
      (Math.random() - 0.5) * size.z * 0.95,
    )
    // 略偏向命中点附近
    local.lerp(hitLocal, 0.25 + Math.random() * 0.35)
    const worldPos = vaseMesh.localToWorld(local.clone())
    mesh.position.copy(worldPos)
    mesh.quaternion.copy(vaseMesh.quaternion)
    mesh.rotateX((Math.random() - 0.5) * 1.2)
    mesh.rotateZ((Math.random() - 0.5) * 1.2)
    scene.add(mesh)

    const shape = new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2))
    const body = new CANNON.Body({
      mass: kind === 'plate' ? 0.04 + Math.random() * 0.05 : 0.06 + Math.random() * 0.1,
      shape,
      position: new CANNON.Vec3(worldPos.x, worldPos.y, worldPos.z),
      angularDamping: 0.35,
      linearDamping: 0.12,
      allowSleep: true,
      sleepSpeedLimit: 0.18,
      sleepTimeLimit: 0.35,
    })
    body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w)

    // 从击点向外炸开 + 弹道方向
    const outward = worldPos.clone().sub(hitPoint)
    if (outward.lengthSq() < 1e-4) {
      outward.copy(hitDir).normalize().multiplyScalar(0.2)
      outward.x += (Math.random() - 0.5)
      outward.z += (Math.random() - 0.5)
    }
    outward.normalize()
    const blast = outward.multiplyScalar(1.2 + Math.random() * 2.4)
    blast.addScaledVector(hitDir.clone().normalize(), 1.6 + Math.random() * 2.0)
    blast.y += 0.6 + Math.random() * 1.4

    body.velocity.set(blast.x, blast.y, blast.z)
    body.angularVelocity.set(
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 22,
    )

    world.addBody(body)
    shards.push({ mesh, body, born: performance.now() })
  }

  extras.push(spawnDust(scene, hitPoint, 36))
  // 瓶心再喷一撮粉尘
  const mid = vaseMesh.getWorldPosition(new THREE.Vector3())
  mid.y += vaseMesh.userData.height * 0.45
  extras.push(spawnDust(scene, mid, 18))

  return { shards, extras }
}

export function syncShards(shards, now, scene, world, maxAge = 5200) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i]
    s.mesh.position.copy(s.body.position)
    s.mesh.quaternion.copy(s.body.quaternion)
    if (now - s.born > maxAge || s.body.position.y < -2) {
      scene.remove(s.mesh)
      s.mesh.geometry.dispose()
      s.mesh.material.dispose()
      world.removeBody(s.body)
      shards.splice(i, 1)
    }
  }
}

export function syncDust(extras, now, dt, scene) {
  for (let i = extras.length - 1; i >= 0; i--) {
    const d = extras[i]
    const age = now - d.born
    const k = 1 - age / d.life
    if (k <= 0) {
      scene.remove(d.points)
      d.points.geometry.dispose()
      d.points.material.dispose()
      extras.splice(i, 1)
      continue
    }
    const pos = d.points.geometry.attributes.position
    for (let j = 0; j < d.velocities.length; j++) {
      const v = d.velocities[j]
      v.y -= 4.5 * dt
      v.multiplyScalar(0.98)
      pos.setXYZ(
        j,
        pos.getX(j) + v.x * dt,
        pos.getY(j) + v.y * dt,
        pos.getZ(j) + v.z * dt,
      )
    }
    pos.needsUpdate = true
    d.points.material.opacity = Math.max(0, k * 0.85)
    d.points.material.size = 0.02 + k * 0.03
  }
}
