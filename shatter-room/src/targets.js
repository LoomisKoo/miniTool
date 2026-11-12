import * as THREE from 'three'
import * as CANNON from 'cannon-es'

/** 可选目标材质 */
export const TARGET_TYPES = {
  porcelain: {
    id: 'porcelain',
    name: '瓷器',
    emoji: '🏺',
    desc: '脆响碎裂',
  },
  glass: {
    id: 'glass',
    name: '玻璃',
    emoji: '🫙',
    desc: '晶亮碎片',
  },
  wood: {
    id: 'wood',
    name: '木箱',
    emoji: '🪵',
    desc: '木屑崩飞',
  },
  metal: {
    id: 'metal',
    name: '铁罐',
    emoji: '🥫',
    desc: '金属弹飞',
  },
  cardboard: {
    id: 'cardboard',
    name: '纸箱',
    emoji: '📦',
    desc: '打出破洞',
  },
  balloon: {
    id: 'balloon',
    name: '气球',
    emoji: '🎈',
    desc: '啪一声爆开',
  },
  mixed: {
    id: 'mixed',
    name: '混合',
    emoji: '🎲',
    desc: '随机材质',
  },
}

export const TARGET_ORDER = ['porcelain', 'glass', 'wood', 'metal', 'cardboard', 'balloon', 'mixed']

const MIX_POOL = ['porcelain', 'glass', 'wood', 'metal', 'cardboard', 'balloon']

/** 花瓶轮廓：平底圈足 → 鼓腹 → 收颈 → 外翻口沿 */
function lathePoints(h, r) {
  return [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r * 0.5, 0),
    new THREE.Vector2(r * 0.55, h * 0.04),
    new THREE.Vector2(r * 0.9, h * 0.22),
    new THREE.Vector2(r, h * 0.36),
    new THREE.Vector2(r * 0.82, h * 0.58),
    new THREE.Vector2(r * 0.42, h * 0.8),
    new THREE.Vector2(r * 0.36, h * 0.9),
    new THREE.Vector2(r * 0.5, h * 0.98),
    new THREE.Vector2(r * 0.47, h),
  ]
}

function createPorcelain(seed) {
  const h = 0.36 + (seed % 5) * 0.05
  const r = 0.12 + (seed % 4) * 0.02
  const accents = [0xc45c4a, 0x3d6b8c, 0x2f6b4f, 0xb08d57]
  const geo = new THREE.LatheGeometry(lathePoints(h, r), 48)
  geo.computeBoundingBox()
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0xe8d8c8, roughness: 0.28, metalness: 0.08, side: THREE.DoubleSide }),
  )
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.82, 0.012, 8, 24),
    new THREE.MeshStandardMaterial({ color: accents[seed % accents.length], roughness: 0.5 }),
  )
  band.rotation.x = Math.PI / 2
  band.position.y = h * 0.55
  band.raycast = () => {}
  mesh.add(band)
  mesh.userData.height = h
  mesh.userData.radius = r
  mesh.userData.collider = { type: 'cylinder', r: r * 0.85, h }
  mesh.userData.comOffset = new THREE.Vector3(0, h / 2, 0)
  mesh.userData.accent = accents[seed % accents.length]
  mesh.userData.breakColor = 0xe8d8c8
  return mesh
}

function createGlass(seed) {
  const h = 0.3 + (seed % 3) * 0.06
  const r = 0.08 + (seed % 3) * 0.015
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.75, r, h, 24),
    new THREE.MeshPhysicalMaterial({
      color: [0xa8dcff, 0xd4ffe8, 0xffe0f0][seed % 3],
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.5,
      transmission: 0.55,
      thickness: 0.15,
    }),
  )
  mesh.userData.height = h
  mesh.userData.radius = r
  mesh.userData.collider = { type: 'cylinder', r, rTop: r * 0.75, h }
  mesh.userData.breakColor = 0xc8eeff
  return mesh
}

function createWood(seed) {
  const s = 0.34 + (seed % 3) * 0.05
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(s, s, s, 10, 10, 10),
    new THREE.MeshStandardMaterial({ color: [0x8b5a2b, 0xa67c52, 0x6e4b2a][seed % 3], roughness: 0.85 }),
  )
  mesh.userData.height = s
  mesh.userData.radius = s * 0.7
  mesh.userData.collider = { type: 'box', half: [s / 2, s / 2, s / 2] }
  mesh.userData.breakColor = 0x8b5a2b
  return mesh
}

function createMetal(seed) {
  const h = 0.3 + (seed % 3) * 0.04
  const r = 0.1
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 20),
    new THREE.MeshStandardMaterial({
      color: [0xc0c6cc, 0xd4a017, 0xb33a3a][seed % 3],
      roughness: 0.35,
      metalness: 0.85,
    }),
  )
  mesh.userData.height = h
  mesh.userData.radius = r
  mesh.userData.collider = { type: 'cylinder', r, h }
  mesh.userData.breakColor = 0xc0c6cc
  return mesh
}

function panelGeometry(width, height, thickness, holes) {
  const shape = new THREE.Shape()
  const hw = width / 2
  const hh = height / 2
  shape.moveTo(-hw, -hh)
  shape.lineTo(hw, -hh)
  shape.lineTo(hw, hh)
  shape.lineTo(-hw, hh)
  shape.closePath()
  for (const hole of holes) {
    const path = new THREE.Path()
    const n = hole.radii.length
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const x = hole.x + Math.cos(a) * hole.radii[i]
      const y = hole.y + Math.sin(a) * hole.radii[i]
      if (i === 0) path.moveTo(x, y)
      else path.lineTo(x, y)
    }
    path.closePath()
    shape.holes.push(path)
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geo.translate(0, 0, -thickness / 2)
  geo.computeVertexNormals()
  return geo
}

/** 空心纸箱：六块薄板，洞是真的切穿，能看见里面 */
function createCardboard(seed) {
  const w = 0.44 + (seed % 2) * 0.06
  const h = 0.34 + (seed % 3) * 0.05
  const d = 0.32
  const t = 0.007
  const group = new THREE.Group()
  const color = 0xc4a574
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0, side: THREE.DoubleSide })

  const inner = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.05, h - 0.05, d - 0.05),
    new THREE.MeshStandardMaterial({ color: 0x241910, roughness: 1 }),
  )
  inner.raycast = () => {}
  group.add(inner)

  const specs = [
    { size: [w, h], pos: [0, 0, d / 2], rot: [0, 0, 0] },
    { size: [w, h], pos: [0, 0, -d / 2], rot: [0, Math.PI, 0] },
    { size: [d, h], pos: [w / 2, 0, 0], rot: [0, Math.PI / 2, 0] },
    { size: [d, h], pos: [-w / 2, 0, 0], rot: [0, -Math.PI / 2, 0] },
    { size: [w, d], pos: [0, h / 2, 0], rot: [-Math.PI / 2, 0, 0] },
    { size: [w, d], pos: [0, -h / 2, 0], rot: [Math.PI / 2, 0, 0] },
  ]
  for (const s of specs) {
    const panel = new THREE.Mesh(panelGeometry(s.size[0], s.size[1], t, []), mat)
    panel.position.set(...s.pos)
    panel.rotation.set(...s.rot)
    panel.castShadow = true
    panel.receiveShadow = true
    panel.userData.isPanel = true
    panel.userData.panelW = s.size[0]
    panel.userData.panelH = s.size[1]
    panel.userData.panelT = t
    panel.userData.holes = []
    group.add(panel)
  }

  group.userData.height = h
  group.userData.radius = Math.max(w, d) * 0.6
  group.userData.collider = { type: 'box', half: [w / 2, h / 2, d / 2] }
  group.userData.breakColor = color
  return group
}

function createBalloon(seed) {
  const colors = [0xff5a7a, 0x5ad0ff, 0xffd166, 0x9b5de5, 0x00f5d4]
  const r = 0.2
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 18),
    new THREE.MeshStandardMaterial({
      color: colors[seed % colors.length],
      roughness: 0.35,
      metalness: 0.05,
    }),
  )
  const knot = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 }),
  )
  knot.position.y = -r * 0.95
  knot.raycast = () => {}
  mesh.add(knot)
  mesh.userData.height = r * 2
  mesh.userData.radius = r
  mesh.userData.collider = { type: 'sphere', r }
  mesh.userData.breakColor = colors[seed % colors.length]
  return mesh
}

const BUILDERS = {
  porcelain: createPorcelain,
  glass: createGlass,
  wood: createWood,
  metal: createMetal,
  cardboard: createCardboard,
  balloon: createBalloon,
}

export function createTargetMesh(typeId, seed = 0) {
  const id = typeId === 'mixed' ? MIX_POOL[seed % MIX_POOL.length] : typeId
  const builder = BUILDERS[id] || createPorcelain
  const mesh = builder(seed)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.materialId = id
  mesh.userData.breakable = true
  mesh.userData.alive = true
  mesh.userData.body = null
  // 韧性质材要多次命中；脆的一击即碎
  mesh.userData.hp = id === 'cardboard' ? 12 : id === 'metal' ? 8 : id === 'wood' ? 6 : 1
  mesh.userData.damage = 0
  return mesh
}

/* ========== 更接近真实的破碎：不规则碎片 + 材质专属行为 ========== */

function makeSmokeTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30)
  grd.addColorStop(0, 'rgba(255,255,255,0.85)')
  grd.addColorStop(0.45, 'rgba(220,220,220,0.35)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const SMOKE_TEX = makeSmokeTex()

/** 不规则多边形薄片（瓷/玻璃裂纹感） */
function irregularPlateGeo(scale = 0.08, thickness = 0.012) {
  const shape = new THREE.Shape()
  const n = 5 + Math.floor(Math.random() * 3)
  const rot = Math.random() * Math.PI
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    const r = scale * (0.35 + Math.random() * 0.75)
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 1,
  })
  geo.center()
  return geo
}

function spawnDust(scene, origin, count, color, size = 0.04, life = 800, speed = 2.5, additive = false) {
  const positions = new Float32Array(count * 3)
  const velocities = []
  for (let i = 0; i < count; i++) {
    positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.05
    positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.05
    positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.05
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5)
      .normalize()
      .multiplyScalar(speed * (0.4 + Math.random() * 0.8))
    velocities.push(dir)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      map: SMOKE_TEX,
      color,
      size,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
  )
  scene.add(points)
  return { type: 'dust', points, velocities, born: performance.now(), life }
}

function spawnSmokePuff(scene, origin, color = 0xddd5cc) {
  const group = new THREE.Group()
  group.position.copy(origin)
  scene.add(group)
  const sprites = []
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.SpriteMaterial({
      map: SMOKE_TEX,
      color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const s = new THREE.Sprite(mat)
    s.scale.setScalar(0.25)
    s.position.set((Math.random() - 0.5) * 0.15, Math.random() * 0.1, (Math.random() - 0.5) * 0.15)
    s.userData.vy = 0.4 + Math.random() * 0.7
    s.userData.grow = 1.8 + Math.random() * 1.6
    group.add(s)
    sprites.push(s)
  }
  return { type: 'smoke', group, sprites, born: performance.now(), life: 900 }
}

const HIT_MASS = { cardboard: 0.35, wood: 5, metal: 0.48, porcelain: 1.1, glass: 0.35, balloon: 0.02 }
const HIT_IMPULSE = { cardboard: 0.48, wood: 0.9, metal: 0.55, porcelain: 0.25, glass: 0.18, balloon: 0.04 }
const FRICTION = { cardboard: 0.4, wood: 0.65, metal: 0.18, porcelain: 0.42, glass: 0.3, balloon: 0.35 }
const RESTITUTION = { cardboard: 0.01, wood: 0.03, metal: 0.16, porcelain: 0.02, glass: 0.05, balloon: 0.2 }
const DAMPING = {
  cardboard: [0.04, 0.18],
  wood: [0.03, 0.22],
  metal: [0.015, 0.03],
  porcelain: [0.04, 0.12],
  glass: [0.03, 0.1],
  balloon: [0.06, 0.08],
}
const CYL_Q = new CANNON.Quaternion()
CYL_Q.setFromEuler(Math.PI / 2, 0, 0)
const _syncOff = new THREE.Vector3()

function materialFor(world, id) {
  if (!world._physMats) world._physMats = {}
  if (world._physMats[id]) return world._physMats[id]
  const mat = new CANNON.Material(id)
  world._physMats[id] = mat
  if (world.groundMaterial) {
    world.addContactMaterial(new CANNON.ContactMaterial(world.groundMaterial, mat, {
      friction: FRICTION[id] ?? 0.45,
      restitution: RESTITUTION[id] ?? 0.03,
    }))
  }
  return mat
}

/** 出生就有刚体并休眠。重心在物体中心，碰撞体跟网格对齐，互相能挡住。 */
export function attachRestBody(target, world) {
  if (target.userData.body) return target.userData.body
  const id = target.userData.materialId
  const col = target.userData.collider
  const damp = DAMPING[id] || [0.04, 0.12]
  const body = new CANNON.Body({
    mass: HIT_MASS[id] ?? 0.8,
    linearDamping: damp[0],
    angularDamping: damp[1],
    allowSleep: true,
    sleepSpeedLimit: 0.06,
    sleepTimeLimit: 0.45,
    material: materialFor(world, id),
  })
  if (col?.type === 'cylinder') {
    body.addShape(new CANNON.Cylinder(col.rTop ?? col.r, col.r, col.h, 12)) // cannon-es 圆柱已沿 Y 轴，无需旋转
  } else if (col?.type === 'sphere') {
    body.addShape(new CANNON.Sphere(col.r))
  } else {
    const half = col?.half || [0.2, 0.2, 0.2]
    body.addShape(new CANNON.Box(new CANNON.Vec3(half[0], half[1], half[2])))
  }
  target.updateMatrixWorld(true)
  const off = target.userData.comOffset
  const com = off ? off.clone().applyQuaternion(target.quaternion).add(target.position) : target.position.clone()
  com.y += 0.008
  target.position.y += 0.008
  body.position.set(com.x, com.y, com.z)
  body.quaternion.set(target.quaternion.x, target.quaternion.y, target.quaternion.z, target.quaternion.w)
  world.addBody(body)
  body.sleep()
  target.userData.body = body
  target.userData.rested = true
  return body
}

/** 冲量打在击中点，高于重心就翻，打在中间就滑。不额外往上掀。 */
export function kickTarget(target, world, hitDir, hitPoint, scale = 1) {
  const body = target.userData.body || attachRestBody(target, world)
  target.userData.rested = false
  const id = target.userData.materialId
  const dir = hitDir.clone()
  if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1)
  // hitDir 的长度 = 子弹剩余动量系数（沙鹰 1.5 / AK 1.0 / 鹿弹单丸 0.25）
  const energy = Math.max(0.05, dir.length())
  dir.normalize()
  const strength = (HIT_IMPULSE[id] ?? 0.4) * energy * scale
  // 冲量严格沿弹道方向（向下打就往下压，不再强行去掉向下分量）
  const impulse = new CANNON.Vec3(dir.x * strength, dir.y * strength, dir.z * strength)
  const rel = new CANNON.Vec3(hitPoint.x - body.position.x, hitPoint.y - body.position.y, hitPoint.z - body.position.z)
  body.wakeUp()
  body.applyImpulse(impulse, rel)
}

export function syncMovers(list) {
  for (const m of list) {
    const body = m.userData.body
    if (!body || !m.userData.alive || m.userData.rested) continue
    m.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
    const off = m.userData.comOffset
    if (off) {
      _syncOff.copy(off).applyQuaternion(m.quaternion)
      m.position.set(body.position.x - _syncOff.x, body.position.y - _syncOff.y, body.position.z - _syncOff.z)
    } else {
      m.position.set(body.position.x, body.position.y, body.position.z)
    }
    if (body.sleepState === CANNON.Body.SLEEPING) m.userData.rested = true
  }
}

function pushBody(list, world, scene, mesh, half, vel, opts = {}) {
  scene.add(mesh)
  mesh.userData.shard = true
  const body = new CANNON.Body({
    mass: opts.mass ?? 0.08,
    shape: opts.shape || new CANNON.Box(new CANNON.Vec3(half.x, half.y, half.z)),
    position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
    angularDamping: opts.angularDamping ?? 0.22,
    linearDamping: opts.linearDamping ?? 0.08,
    allowSleep: true,
    sleepSpeedLimit: 0.18,
    sleepTimeLimit: 0.4,
  })
  body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w)
  body.velocity.set(vel.x, vel.y, vel.z)
  body.angularVelocity.set(
    (Math.random() - 0.5) * (opts.spin ?? 12),
    (Math.random() - 0.5) * (opts.spin ?? 12),
    (Math.random() - 0.5) * (opts.spin ?? 12),
  )
  world.addBody(body)
  list.push({ mesh, body, born: performance.now() })
}

/**
 * 碎片初速度：主体沿弹道方向从出射面喷出（锥形），带少量径向扩散和轻微上扬；
 * 少量从入射面反崩。速度随子弹动量（hitDir 长度）缩放。
 */
function outwardVel(hitDir, pos, hitPoint, boost = 1) {
  const fwd = hitDir.clone()
  const energy = fwd.length() || 1
  fwd.normalize()
  const k = THREE.MathUtils.clamp(0.55 + 0.45 * energy, 0.5, 2.2) * boost
  const o = pos.clone().sub(hitPoint)
  o.addScaledVector(fwd, -o.dot(fwd))
  if (o.lengthSq() < 1e-6) o.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
  o.normalize()
  const v = fwd.multiplyScalar((1.8 + Math.random() * 2.6) * k)
  v.addScaledVector(o, (0.6 + Math.random() * 1.6) * k)
  v.y += (0.2 + Math.random() * 0.6) * k
  if (Math.random() < 0.12) v.multiplyScalar(-0.35)
  return v
}

function scatterAround(target, hitPoint, count, radius = 0.15) {
  const pts = []
  for (let i = 0; i < count; i++) {
    pts.push(
      hitPoint
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * radius * 2,
            (Math.random() - 0.5) * radius * 2,
            (Math.random() - 0.5) * radius * 2,
          ),
        ),
    )
  }
  // 再补一些贴物体表面的点
  const box = new THREE.Box3().setFromObject(target)
  const size = new THREE.Vector3()
  box.getSize(size)
  const center = new THREE.Vector3()
  box.getCenter(center)
  for (let i = 0; i < Math.floor(count * 0.5); i++) {
    pts.push(
      new THREE.Vector3(
        center.x + (Math.random() - 0.5) * size.x,
        center.y + (Math.random() - 0.5) * size.y,
        center.z + (Math.random() - 0.5) * size.z,
      ),
    )
  }
  return pts
}

/** 沿车削轮廓插值半径，用于生成贴着器壁的弧形碎片 */
function radiusAtProfile(points, y) {
  if (y <= points[0].y) return points[0].x
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (y <= b.y) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y)
      return a.x + (b.x - a.x) * t
    }
  }
  return points[points.length - 1].x
}

/** 器壁碎片：真的从瓶身上取下一块弧面，而不是随机薄片 */
function pushShellShard(shards, world, scene, mesh, target, hitDir, hitPoint, boost) {
  mesh.geometry.computeBoundingBox()
  const bb = mesh.geometry.boundingBox
  const localCenter = bb.getCenter(new THREE.Vector3())
  const size = bb.getSize(new THREE.Vector3())
  mesh.position.copy(target.position).add(localCenter.clone().applyQuaternion(target.quaternion))
  mesh.quaternion.copy(target.quaternion)
  const radial = new THREE.Vector3(localCenter.x, 0, localCenter.z)
  if (radial.lengthSq() < 1e-6) radial.set(Math.random() - 0.5, 0, Math.random() - 0.5)
  radial.normalize()
  const vel = outwardVel(hitDir, mesh.position, hitPoint, boost)
  vel.addScaledVector(radial, 0.8 + Math.random() * 1.4)
  pushBody(
    shards,
    world,
    scene,
    mesh,
    { x: Math.max(size.x, 0.02) / 2, y: Math.max(size.y, 0.02) / 2, z: Math.max(size.z, 0.02) / 2 },
    vel,
    { mass: 0.03 + size.y * size.x * 0.6, spin: 9, angularDamping: 0.12 },
  )
}

function breakPorcelain(target, world, scene, hitDir, hitPoint, color) {
  const shards = []
  const extras = [spawnSmokePuff(scene, hitPoint, 0xf0e8e0), spawnDust(scene, hitPoint, 40, 0xf7f1ea, 0.045, 850, 3.2)]
  const h = target.userData.height || 0.8
  const r = target.userData.radius || 0.24
  const profile = lathePoints(h, r)
  const accent = target.userData.accent

  const shellMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.04,
    side: THREE.DoubleSide,
  })
  for (let i = 0; i < 16; i++) {
    const y0 = h * 0.04 + Math.random() * h * 0.72
    const y1 = Math.min(h * 0.99, y0 + h * (0.12 + Math.random() * 0.24))
    const pts = []
    for (let k = 0; k <= 3; k++) {
      const y = y0 + ((y1 - y0) * k) / 3
      pts.push(new THREE.Vector2(radiusAtProfile(profile, y), y))
    }
    const phi = 0.45 + Math.random() * 0.9
    const start = Math.random() * Math.PI * 2
    const geo = new THREE.LatheGeometry(pts, 3, start, phi)
    const mat = Math.random() > 0.86 && accent ? shellMat.clone() : shellMat
    if (mat !== shellMat) mat.color = new THREE.Color(accent)
    const mesh = new THREE.Mesh(geo, mat)
    pushShellShard(shards, world, scene, mesh, target, hitDir, hitPoint, 0.5)
  }
  return { shards, extras, sfx: 'porcelain' }
}

function breakGlass(target, world, scene, hitDir, hitPoint, color) {
  const shards = []
  const extras = [
    spawnDust(scene, hitPoint, 48, 0xe8f6ff, 0.03, 600, 4.5, true),
    spawnDust(scene, hitPoint, 26, 0xffffff, 0.02, 450, 5.5, true),
  ]
  const h = target.userData.height || 0.55
  const r = target.userData.radius || 0.15
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcf3ff,
    roughness: 0.03,
    metalness: 0.04,
    transparent: true,
    opacity: 0.5,
    transmission: 0.6,
    thickness: 0.03,
    ior: 1.5,
    side: THREE.DoubleSide,
  })
  // 杯壁弧片：从杯身上整片剥落
  for (let i = 0; i < 14; i++) {
    const thetaStart = Math.random() * Math.PI * 2
    const thetaLen = 0.25 + Math.random() * 0.6
    const y0 = -h / 2 + Math.random() * h * 0.8
    const y1 = Math.min(h / 2, y0 + h * (0.08 + Math.random() * 0.2))
    const height = Math.max(0.03, y1 - y0)
    const geo = new THREE.CylinderGeometry(r * 0.8, r, height, 4, 1, true, thetaStart, thetaLen)
    geo.translate(0, (y0 + y1) / 2, 0)
    const mesh = new THREE.Mesh(geo, glassMat)
    pushShellShard(shards, world, scene, mesh, target, hitDir, hitPoint, 0.45)
  }
  // 少量飞溅的尖细片
  for (let i = 0; i < 8; i++) {
    const long = 0.06 + Math.random() * 0.14
    const thin = 0.004 + Math.random() * 0.008
    const geo = new THREE.ConeGeometry(thin, long, 3)
    geo.translate(0, long / 2, 0)
    const mesh = new THREE.Mesh(geo, glassMat)
    mesh.position.copy(hitPoint).add(
      new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.4) * 0.14, (Math.random() - 0.5) * 0.12),
    )
    mesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3))
    pushBody(shards, world, scene, mesh, { x: thin, y: long / 2, z: thin }, outwardVel(hitDir, mesh.position, hitPoint, 0.9), {
      mass: 0.012,
      spin: 22,
      linearDamping: 0.05,
    })
  }
  return { shards, extras, sfx: 'glass' }
}

/** 撕裂木板：边缘锯出随机缺口，不是整齐的方块 */
function tornSlabGeo(w, h, d) {
  const shape = new THREE.Shape()
  const hw = w / 2
  const hh = h / 2
  const j = Math.min(w, h) * 0.12
  const pts = [
    [-hw + Math.random() * j, hh],
    [-hw + Math.random() * j, -hh],
    [hw - Math.random() * j, -hh],
    [hw, -hh + Math.random() * j],
    [hw, hh - Math.random() * j],
    [hw - Math.random() * j, hh],
  ]
  shape.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1])
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false })
  geo.translate(0, 0, -d / 2)
  geo.computeVertexNormals()
  return geo
}

function breakWood(target, world, scene, hitDir, hitPoint, color) {
  const shards = []
  const extras = [spawnDust(scene, hitPoint, 16, 0xc4a06a, 0.035, 700, 1.2)]
  const box = new THREE.Box3().setFromObject(target)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    side: THREE.DoubleSide,
  })
  const dir = hitDir.clone().normalize()
  // 沿木纹裂成三块厚板，缺口参差，缓慢分开后倒下
  for (let i = 0; i < 3; i++) {
    const w = size.x * (0.82 + Math.random() * 0.14)
    const h = size.y * (0.86 + Math.random() * 0.12)
    const d = (size.z / 3) * (0.8 + Math.random() * 0.15)
    const plank = new THREE.Mesh(tornSlabGeo(w, h, d), mat)
    plank.quaternion.copy(target.quaternion)
    const local = new THREE.Vector3((Math.random() - 0.5) * 0.03, 0, (i - 1) * (size.z / 3))
    plank.position.copy(center).add(local.applyQuaternion(target.quaternion))
    const vel = new THREE.Vector3((i - 1) * 0.2, 0.05, 0)
    vel.applyQuaternion(target.quaternion)
    vel.addScaledVector(dir, 0.26)
    pushBody(shards, world, scene, plank, { x: w * 0.45, y: h * 0.45, z: d * 0.5 }, vel, {
      mass: 0.75,
      spin: 0.9,
      linearDamping: 0.3,
      angularDamping: 0.35,
    })
  }
  chipBits(shards, world, scene, hitPoint, dir, 0xc4a06a, 8, 0.03)
  return { shards, extras, sfx: 'wood' }
}

function cloneVisual(target) {
  const saved = target.userData.body
  target.userData.body = undefined
  let copy
  try {
    copy = target.clone(true)
  } finally {
    target.userData.body = saved
  }
  copy.userData.body = null
  copy.userData.breakable = false
  copy.userData.alive = false
  copy.traverse((c) => {
    if (c.isMesh) c.raycast = () => {}
  })
  return copy
}

function breakMetal(target, world, scene, hitDir, hitPoint, color) {
  const shards = []
  const extras = [
    spawnDust(scene, hitPoint, 50, 0xffb347, 0.055, 380, 7, true),
    spawnDust(scene, hitPoint, 24, 0xfff0a8, 0.03, 280, 8, true),
  ]
  // 真实感：整罐被打飞 + 撕开成 3～4 片弧形罐壁，而不是瓷片雨
  const h = target.userData.height || 0.5
  const r = target.userData.radius || 0.16
  const flying = cloneVisual(target)
  flying.traverse((c) => {
    if (c.isMesh) {
      c.material = c.material.clone()
      c.material.metalness = 0.9
      c.material.roughness = 0.35
    }
  })
  // 压扁一点
  flying.scale.set(1.05, 0.72, 1.05)
  flying.position.copy(target.position)
  flying.quaternion.copy(target.quaternion)
  // 0.5kg 的罐子被子弹打飞只有几 m/s；爆炸（hitDir 更长）才飞得远
  const e = THREE.MathUtils.clamp(hitDir.length(), 0.3, 3)
  const kick = hitDir.clone().normalize().multiplyScalar((2.2 + Math.random()) * e)
  kick.y += 0.6 + Math.random() * 0.6
  pushBody(shards, world, scene, flying, { x: r, y: h * 0.35, z: r }, kick, {
    mass: 0.55,
    spin: 9,
    linearDamping: 0.05,
    angularDamping: 0.08,
  })

  for (let i = 0; i < 4; i++) {
    const panel = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.02, r * 1.02, h * (0.35 + Math.random() * 0.3), 12, 1, true, (i / 4) * Math.PI * 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness: 0.25, side: THREE.DoubleSide }),
    )
    panel.position.copy(hitPoint)
    panel.position.y += (Math.random() - 0.5) * 0.15
    const vel = outwardVel(hitDir, panel.position, hitPoint, 1.4)
    pushBody(shards, world, scene, panel, { x: r * 0.5, y: h * 0.2, z: 0.02 }, vel, {
      mass: 0.12,
      spin: 14,
      linearDamping: 0.05,
    })
  }
  return { shards, extras, sfx: 'metal' }
}

function breakCardboard(target, world, scene, hitDir) {
  const shards = []
  const box = new THREE.Box3().setFromObject(target)
  const size = new THREE.Vector3()
  box.getSize(size)
  const flying = cloneVisual(target)
  flying.position.copy(target.position)
  flying.quaternion.copy(target.quaternion)
  flying.traverse((c) => {
    if (c.isMesh) c.raycast = () => {}
  })
  const vel = hitDir.clone()
  if (vel.lengthSq() < 1e-6) vel.set(0, 1, 0)
  vel.normalize().multiplyScalar(1.6)
  vel.y += 0.8
  pushBody(
    shards,
    world,
    scene,
    flying,
    { x: Math.max(size.x, 0.2) / 2, y: Math.max(size.y, 0.2) / 2, z: Math.max(size.z, 0.2) / 2 },
    vel,
    { mass: 0.45, spin: 1.6, linearDamping: 0.45, angularDamping: 0.55 },
  )
  return { shards, extras: [], sfx: 'cardboard' }
}

function breakBalloon(target, world, scene, hitDir, hitPoint, color) {
  const shards = []
  const extras = []
  // 先鼓一下再消失的残影
  const ghost = cloneVisual(target)
  ghost.traverse((c) => {
    if (c.isMesh) {
      c.material = c.material.clone()
      c.material.transparent = true
      c.material.opacity = 0.85
      c.material.depthWrite = false
    }
  })
  ghost.position.copy(target.position)
  ghost.quaternion.copy(target.quaternion)
  scene.add(ghost)
  extras.push({ type: 'pop', mesh: ghost, born: performance.now(), life: 160 })

  extras.push(spawnDust(scene, hitPoint, 70, color, 0.08, 500, 7.5))
  extras.push(spawnDust(scene, hitPoint, 40, 0xffffff, 0.05, 420, 6.5))
  // 软皮碎屑（极少，轻飘）
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06 + Math.random() * 0.08, 0.04 + Math.random() * 0.06),
      new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        roughness: 0.7,
        transparent: true,
        opacity: 0.9,
      }),
    )
    mesh.position.copy(hitPoint)
    const vel = new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6)
    pushBody(shards, world, scene, mesh, { x: 0.04, y: 0.002, z: 0.03 }, vel, {
      mass: 0.008,
      spin: 30,
      linearDamping: 0.35,
    })
  }
  return { shards, extras, sfx: 'balloon' }
}

function faceHole(target, point, normal, radius, innerColor, rimColor) {
  const root = new THREE.Group()
  root.position.copy(point).addScaledVector(normal, 0.012)
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize())
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 14),
    new THREE.MeshBasicMaterial({ color: innerColor, side: THREE.DoubleSide, depthWrite: true }),
  )
  root.add(disc)
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.85, radius * 1.35, 14),
    new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.95, side: THREE.DoubleSide }),
  )
  rim.position.z = 0.002
  root.add(rim)
  // 撕开的纸边 / 金属翻边
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.random() * 0.3
    const flap = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 0.7, radius * 0.9),
      new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.9, side: THREE.DoubleSide }),
    )
    flap.position.set(Math.cos(a) * radius * 1.05, Math.sin(a) * radius * 1.05, 0.01)
    flap.rotation.z = a
    flap.rotation.x = -0.7 - Math.random() * 0.4
    root.add(flap)
  }
  target.attach(root)
  return root
}

function chipBits(shards, world, scene, point, normal, color, n, size) {
  for (let i = 0; i < n; i++) {
    const s = size * (0.6 + Math.random() * 0.8)
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s * 0.7),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }),
    )
    mesh.position.copy(point).addScaledVector(normal, 0.02)
    const vel = normal.clone().multiplyScalar(1.2 + Math.random() * 2)
    vel.x += (Math.random() - 0.5) * 1.5
    vel.y += 0.6 + Math.random()
    vel.z += (Math.random() - 0.5) * 1.5
    pushBody(shards, world, scene, mesh, { x: s / 2, y: 0.002, z: s / 2 }, vel, {
      mass: 0.01,
      spin: 12,
      linearDamping: 0.25,
    })
  }
}

/**
 * 按材质物理：
 * 纸箱 — 子弹只打洞，箱子不散；只有爆炸才把整箱掀翻
 * 铁罐 — 凹陷/破孔 + 火花，打够了整罐飞走（不碎成渣）
 * 木头 — 箱子钉在原地，只崩木屑；打够了沿纹裂开再倒下
 * 瓷/玻璃/气球 — 脆，一击破坏
 * force=true（爆炸）时韧性质材直接破坏
 */
function findPanel(obj) {
  let o = obj
  while (o) {
    if (o.userData?.isPanel) return o
    o = o.parent
  }
  return null
}

function nearestPanel(target, point) {
  let best = null
  let bestD = Infinity
  target.traverse((o) => {
    if (!o.userData?.isPanel) return
    const d = o.getWorldPosition(new THREE.Vector3()).distanceToSquared(point)
    if (d < bestD) {
      bestD = d
      best = o
    }
  })
  return best
}

function punchPanel(panel, worldPoint) {
  const local = panel.worldToLocal(worldPoint.clone())
  const margin = 0.045
  const x = THREE.MathUtils.clamp(local.x, -panel.userData.panelW / 2 + margin, panel.userData.panelW / 2 - margin)
  const y = THREE.MathUtils.clamp(local.y, -panel.userData.panelH / 2 + margin, panel.userData.panelH / 2 - margin)
  const base = 0.012 + Math.random() * 0.006
  const radii = []
  for (let i = 0; i < 12; i++) radii.push(base * (0.9 + Math.random() * 0.2))
  panel.userData.holes.push({ x, y, radii })
  const next = panelGeometry(panel.userData.panelW, panel.userData.panelH, panel.userData.panelT, panel.userData.holes)
  panel.geometry.dispose()
  panel.geometry = next
  // 弹孔边缘一块纸板向内翻
  const flap = new THREE.Mesh(
    new THREE.PlaneGeometry(base * 1.6, base * 2.2),
    panel.material,
  )
  flap.position.set(x, y, -0.004)
  flap.rotation.x = 1.1
  flap.raycast = () => {}
  panel.add(flap)
}

function dentMesh(mesh, worldPoint, worldNormal, radius, depth) {
  if (!mesh?.isMesh || !mesh.geometry?.attributes?.position) return
  if (!mesh.geometry.userData.deformed) {
    mesh.geometry = mesh.geometry.clone()
    mesh.geometry.userData.deformed = true
  }
  const pos = mesh.geometry.attributes.position
  const localPoint = mesh.worldToLocal(worldPoint.clone())
  const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert()
  const localN = worldNormal.clone().transformDirection(inv).normalize()
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const d = v.distanceTo(localPoint)
    if (d >= radius) continue
    const k = Math.cos((d / radius) * Math.PI * 0.5)
    v.addScaledVector(localN, -depth * k * k)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  mesh.geometry.computeVertexNormals()
}

export function applyMaterialHit(target, world, scene, hitDir, hitPoint, normal, force = false, hitObject = null) {
  const id = target.userData.materialId || 'porcelain'
  const n = (normal && normal.lengthSq() > 0 ? normal.clone().normalize() : hitDir.clone().negate().normalize())
  const color = target.userData.breakColor || 0xffffff
  const shards = []
  const extras = []

  if (id === 'cardboard' && !force) {
    const panel = findPanel(hitObject) || nearestPanel(target, hitPoint)
    if (panel) punchPanel(panel, hitPoint)
    extras.push(spawnDust(scene, hitPoint, 6, 0xd7c4a4, 0.03, 420, 0.8))
    kickTarget(target, world, hitDir, hitPoint)
    return { removed: false, stops: false, shards, extras, sfx: 'cardboard' }
  }

  if (id === 'cardboard' && force) {
    const wreck = breakCardboard(target, world, scene, hitDir)
    return { removed: true, stops: false, shards: wreck.shards, extras: wreck.extras, sfx: 'cardboard' }
  }

  if (id === 'metal' && !force) {
    dentMesh(target, hitPoint, n, (target.userData.radius || 0.16) * 0.7, 0.03)
    extras.push(spawnDust(scene, hitPoint, 14, 0xffb347, 0.035, 260, 4.5, true))
    kickTarget(target, world, hitDir, hitPoint)
    target.userData.damage = (target.userData.damage || 0) + 1
    if (target.userData.damage < target.userData.hp) {
      return { removed: false, stops: true, shards, extras, sfx: 'metal' }
    }
    const wreck = breakMetal(target, world, scene, hitDir, hitPoint, color)
    return { removed: true, stops: true, shards: shards.concat(wreck.shards), extras: extras.concat(wreck.extras), sfx: 'metal' }
  }

  if (id === 'wood' && !force) {
    dentMesh(target, hitPoint, n, 0.075, 0.028)
    chipBits(shards, world, scene, hitPoint, n, 0xa67c52, 5, 0.028)
    extras.push(spawnDust(scene, hitPoint, 10, 0xc4a06a, 0.03, 500, 1.2))
    kickTarget(target, world, hitDir, hitPoint, 0.22)
    target.userData.damage = (target.userData.damage || 0) + 1
    if (target.userData.damage < target.userData.hp) {
      return { removed: false, stops: true, shards, extras, sfx: 'wood' }
    }
    const wreck = breakWood(target, world, scene, hitDir, hitPoint, color)
    return { removed: true, stops: true, shards: shards.concat(wreck.shards), extras: extras.concat(wreck.extras), sfx: 'wood' }
  }

  const fx = createBreakFx(target, world, scene, hitDir, hitPoint)
  const stops = id !== 'balloon'
  return { removed: true, stops, shards: shards.concat(fx.shards), extras: extras.concat(fx.extras), sfx: fx.sfx }
}

export function createBreakFx(targetMesh, world, scene, hitDir, hitPoint) {
  const matId = targetMesh.userData.materialId || 'porcelain'
  const color = targetMesh.userData.breakColor || 0xffffff
  if (matId === 'glass') return breakGlass(targetMesh, world, scene, hitDir, hitPoint, color)
  if (matId === 'wood') return breakWood(targetMesh, world, scene, hitDir, hitPoint, color)
  if (matId === 'metal') return breakMetal(targetMesh, world, scene, hitDir, hitPoint, color)
  if (matId === 'cardboard') return breakCardboard(targetMesh, world, scene, hitDir, hitPoint, color)
  if (matId === 'balloon') return breakBalloon(targetMesh, world, scene, hitDir, hitPoint, color)
  return breakPorcelain(targetMesh, world, scene, hitDir, hitPoint, color)
}

export function syncShards(shards, now, scene, world, maxAge = 5500) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i]
    s.mesh.position.copy(s.body.position)
    s.mesh.quaternion.copy(s.body.quaternion)
    if (now - s.born > maxAge || s.body.position.y < -2) {
      scene.remove(s.mesh)
      s.mesh.traverse?.((c) => {
        if (c.isMesh) {
          c.geometry?.dispose?.()
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose?.())
          else c.material?.dispose?.()
        }
      })
      if (s.mesh.isMesh) {
        s.mesh.geometry?.dispose?.()
        s.mesh.material?.dispose?.()
      }
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
      if (d.type === 'dust') {
        scene.remove(d.points)
        d.points.geometry.dispose()
        d.points.material.dispose()
      } else if (d.type === 'smoke') {
        scene.remove(d.group)
        d.sprites.forEach((s) => s.material.dispose())
      } else if (d.type === 'pop') {
        scene.remove(d.mesh)
      }
      extras.splice(i, 1)
      continue
    }

    if (d.type === 'dust') {
      const pos = d.points.geometry.attributes.position
      for (let j = 0; j < d.velocities.length; j++) {
        const v = d.velocities[j]
        v.y -= 5.5 * dt
        v.multiplyScalar(0.985)
        pos.setXYZ(j, pos.getX(j) + v.x * dt, pos.getY(j) + v.y * dt, pos.getZ(j) + v.z * dt)
      }
      pos.needsUpdate = true
      d.points.material.opacity = Math.max(0, k * 0.9)
      d.points.material.size = (d.points.material.size || 0.04) * (1 + dt * 0.8)
    } else if (d.type === 'smoke') {
      for (const s of d.sprites) {
        s.position.y += s.userData.vy * dt
        const sc = 0.25 + (1 - k) * s.userData.grow
        s.scale.setScalar(sc)
        s.material.opacity = Math.max(0, k * 0.55)
      }
    } else if (d.type === 'pop') {
      // 气球：先胀大再迅速瘪掉
      const t = age / d.life
      const s = t < 0.35 ? 1 + t * 1.2 : Math.max(0.01, 1.4 * (1 - (t - 0.35) / 0.65))
      d.mesh.scale.setScalar(s)
      d.mesh.traverse((c) => {
        if (c.isMesh && c.material) c.material.opacity = Math.max(0, 1 - t)
      })
    }
  }
}

