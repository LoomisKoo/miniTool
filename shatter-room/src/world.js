import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { attachRestBody, createTargetMesh } from './targets.js'

export function buildWorld(scene) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) })
  world.broadphase = new CANNON.NaiveBroadphase()
  world.allowSleep = true
  world.solver.iterations = 14
  world.defaultContactMaterial.friction = 0.4
  world.defaultContactMaterial.restitution = 0.02
  const ground = new CANNON.Material('ground')
  world.groundMaterial = ground

  // 房间（偏亮，避免黑糊糊）
  const roomMat = new THREE.MeshStandardMaterial({ color: 0x8a7d70, roughness: 0.85, metalness: 0.04 })
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x6e6358, roughness: 0.8, metalness: 0.05 })
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb5a898, roughness: 0.92, metalness: 0.02 })

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const floorBody = new CANNON.Body({ mass: 0, material: ground, shape: new CANNON.Plane() })
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  world.addBody(floorBody)

  const wallGeo = new THREE.PlaneGeometry(14, 4.5)
  const walls = [
    { pos: [0, 2.25, -7], rot: [0, 0, 0] },
    { pos: [0, 2.25, 7], rot: [0, Math.PI, 0] },
    { pos: [-7, 2.25, 0], rot: [0, Math.PI / 2, 0] },
    { pos: [7, 2.25, 0], rot: [0, -Math.PI / 2, 0] },
  ]
  for (const w of walls) {
    const m = new THREE.Mesh(wallGeo, wallMat)
    m.position.set(...w.pos)
    m.rotation.set(...w.rot)
    m.receiveShadow = true
    scene.add(m)
  }

  // 天花板氛围
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ color: 0xd8cfc4, roughness: 1 }),
  )
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = 4.5
  scene.add(ceil)

  // 桌子
  const tableGroup = new THREE.Group()
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.08, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x9a7352, roughness: 0.5 }),
  )
  top.position.y = 0.9
  top.castShadow = true
  top.receiveShadow = true
  tableGroup.add(top)

  const legMat = new THREE.MeshStandardMaterial({ color: 0x3d2c22, roughness: 0.7 })
  const legGeo = new THREE.BoxGeometry(0.08, 0.9, 0.08)
  for (const [x, z] of [[-2.1, -0.65], [2.1, -0.65], [-2.1, 0.65], [2.1, 0.65]]) {
    const leg = new THREE.Mesh(legGeo, legMat)
    leg.position.set(x, 0.45, z)
    leg.castShadow = true
    tableGroup.add(leg)
  }
  tableGroup.position.set(0, 0, -2.0)
  scene.add(tableGroup)

  const tableBody = new CANNON.Body({
    mass: 0,
    material: ground,
    shape: new CANNON.Box(new CANNON.Vec3(2.3, 0.04, 0.8)),
    position: new CANNON.Vec3(0, 0.9, -2.0),
  })
  world.addBody(tableBody)

  // 双层货架
  for (const y of [1.55, 2.45]) {
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.06, 0.5),
      roomMat,
    )
    shelf.position.set(0, y, -6.35)
    shelf.castShadow = true
    shelf.receiveShadow = true
    scene.add(shelf)
    world.addBody(new CANNON.Body({
      mass: 0,
      material: ground,
      shape: new CANNON.Box(new CANNON.Vec3(2.8, 0.03, 0.25)),
      position: new CANNON.Vec3(0, y, -6.35),
    }))
  }

  // 灯光（提亮）
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0x8a7a68, 1.15)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xfff2dc, 1.85)
  key.position.set(3.5, 7, 3)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.near = 1
  key.shadow.camera.far = 20
  key.shadow.camera.left = -8
  key.shadow.camera.right = 8
  key.shadow.camera.top = 8
  key.shadow.camera.bottom = -8
  key.shadow.bias = -0.0002
  scene.add(key)
  const fill = new THREE.PointLight(0xffe0b8, 1.1, 20)
  fill.position.set(-2.5, 3.2, 1.5)
  scene.add(fill)
  const lamp = new THREE.PointLight(0xfff5e6, 0.9, 14)
  lamp.position.set(0, 3.8, -2)
  scene.add(lamp)

  scene.background = new THREE.Color(0xcfc4b6)
  scene.fog = new THREE.Fog(0xcfc4b6, 14, 28)

  return { world, tableY: 0.94, shelfY: 1.58, shelfY2: 2.48 }
}

export function spawnBreakables(scene, world, places, targetType = 'porcelain') {
  const items = []
  places.forEach((p, i) => {
    const mesh = createTargetMesh(targetType, i + 1)
    const id = mesh.userData.materialId
    // lathe 瓷器底部在 y=0；圆柱/方块/球几何中心在原点，需抬半高
    let yOff = 0.002
    if (id === 'balloon') yOff = mesh.userData.radius
    else if (id === 'porcelain') yOff = 0.002
    else yOff = mesh.userData.height / 2
    mesh.position.set(p.x, p.y + yOff, p.z)
    mesh.rotation.y = (Math.random() - 0.5) * 0.35
    scene.add(mesh)
    attachRestBody(mesh, world)
    items.push(mesh)
  })
  return items
}

export function defaultLayout(tableY, shelfY, shelfY2) {
  const list = []
  // 桌上两排
  for (const z of [-2.45, -1.7]) {
    for (let i = 0; i < 6; i++) {
      list.push({ x: -2.0 + i * 0.8, y: tableY, z: z + (i % 2) * 0.08 })
    }
  }
  // 下层货架
  for (let i = 0; i < 7; i++) {
    list.push({ x: -2.4 + i * 0.8, y: shelfY, z: -6.3 })
  }
  // 上层货架
  for (let i = 0; i < 7; i++) {
    list.push({ x: -2.4 + i * 0.8, y: shelfY2, z: -6.3 })
  }
  return list
}
