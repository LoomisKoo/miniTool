import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import {
  buildWorld,
  spawnBreakables,
  defaultLayout,
} from './world.js'
import {
  applyMaterialHit,
  syncShards,
  syncDust,
  syncMovers,
  TARGET_TYPES,
} from './targets.js'
import { createAudio } from './audio.js'
import { WEAPONS, WEAPON_ORDER, createViewmodels } from './weapons.js'
import { createTracerSystem } from './tracers.js'
import { createGrenadeSystem } from './grenade.js'

const canvas = document.getElementById('c')
const appEl = document.getElementById('app')
const overlay = document.getElementById('overlay')
const startBtn = document.getElementById('startBtn')
const resetBtn = document.getElementById('resetBtn')
const scoreEl = document.getElementById('score')
const leftEl = document.getElementById('left')
const weaponSlots = document.getElementById('weaponSlots')
const crosshair = document.querySelector('.crosshair')
const fireBtn = document.getElementById('fireBtn')
const joyZone = document.getElementById('joyZone')
const joyKnob = document.getElementById('joyKnob')
const targetBtn = document.getElementById('targetBtn')
const targetSheet = document.getElementById('targetSheet')
const targetNameEl = document.getElementById('targetName')

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
if (isTouch) document.body.classList.add('is-touch')

const audio = createAudio()

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.25

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(70, 9 / 16, 0.05, 40)
camera.position.set(0, 1.6, 3.2)

const controls = new PointerLockControls(camera, document.body)
controls.pointerSpeed = 0.28
scene.add(controls.object)
// 避免残留 pointer lock 导致点不了 UI
try {
  document.exitPointerLock?.()
} catch (_) {
  /* ignore */
}

let playing = false
const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const touchMove = { x: 0, y: 0 }

function resizeToApp() {
  const w = appEl.clientWidth || innerWidth
  const h = appEl.clientHeight || innerHeight
  camera.aspect = w / h
  camera.fov = w < h ? 72 : 70
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}
resizeToApp()

function setPlaying(on) {
  playing = on
  overlay.classList.toggle('hidden', on)
  if (!on) firing = false
}

function applyLook(dx, dy) {
  lookEuler.setFromQuaternion(camera.quaternion, 'YXZ')
  lookEuler.y -= dx * 0.0022
  lookEuler.x -= dy * 0.0022
  const lim = Math.PI / 2 - 0.05
  lookEuler.x = Math.max(-lim, Math.min(lim, lookEuler.x))
  camera.quaternion.setFromEuler(lookEuler)
}

function isGameplay() {
  // 不再锁鼠标，保证 HUD 按钮可点
  return playing
}

const { world, tableY, shelfY, shelfY2 } = buildWorld(scene)
const view = createViewmodels(camera)
const tracers = createTracerSystem(scene)
const grenades = createGrenadeSystem(scene, world)

let breakables = []
let shards = []
let dust = []
let score = 0
let currentWeapon = 'pistol'
let lastShot = 0
let firing = false
let recoilPitch = 0
let recoilYaw = 0
let bloom = 0 // 连射扩散（弧度）
let shakeAmp = 0
let viewKickZ = 0
let viewKickRot = 0
let viewKickUp = 0
let switchT = 0
let refillTimer = -1 // <0 空闲，>=0 倒计时补货
let currentTargetType = 'porcelain'

const keys = { w: false, a: false, s: false, d: false }
const velocity = new THREE.Vector3()
const direction = new THREE.Vector3()
const raycaster = new THREE.Raycaster()
const clock = new THREE.Clock()
const _ndc = new THREE.Vector2(0, 0)
const _hitPoint = new THREE.Vector3()

function weapon() {
  return WEAPONS[currentWeapon]
}

function setWeapon(id) {
  if (!WEAPONS[id] || id === currentWeapon) return
  currentWeapon = id
  switchT = 1
  for (const wid of WEAPON_ORDER) {
    view.models[wid].visible = wid === id
  }
  audio.switch()
  setHud()
}

function aliveCount() {
  let n = 0
  for (const b of breakables) {
    if (!b.userData.alive) continue
    // 已不在场景里的视为消失，不再挡住补货
    if (!b.parent) {
      b.userData.alive = false
      continue
    }
    n += 1
  }
  return n
}

function scheduleRefill() {
  if (aliveCount() === 0 && refillTimer < 0) {
    refillTimer = 0.8
  }
}

function setHud() {
  scoreEl.textContent = String(score)
  leftEl.textContent = String(aliveCount())
  weaponSlots.querySelectorAll('.wep').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === currentWeapon)
  })
}

function clearBreakables() {
  for (const m of breakables) {
    if (m.userData.body) {
      try {
        world.removeBody(m.userData.body)
      } catch (_) {
        /* already removed */
      }
      m.userData.body = null
    }
    if (m.parent) scene.remove(m)
    m.userData.alive = false
  }
  breakables = []
}

function clearShards() {
  for (const s of shards) {
    scene.remove(s.mesh)
    s.mesh.geometry.dispose()
    s.mesh.material.dispose()
    world.removeBody(s.body)
  }
  shards = []
}

function clearDust() {
  for (const d of dust) {
    scene.remove(d.points)
    d.points.geometry.dispose()
    d.points.material.dispose()
  }
  dust = []
}

function setTargetType(id) {
  if (!TARGET_TYPES[id]) return
  currentTargetType = id
  if (targetNameEl) targetNameEl.textContent = TARGET_TYPES[id].name
  targetSheet?.querySelectorAll('.target-opt').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === id)
  })
  spawnBatch()
}

function spawnBatch() {
  clearBreakables()
  breakables = spawnBreakables(
    scene,
    world,
    defaultLayout(tableY, shelfY, shelfY2),
    currentTargetType,
  )
  refillTimer = -1
  setHud()
}

function resetScene() {
  clearShards()
  clearDust()
  grenades.clear()
  score = 0
  refillTimer = -1
  camera.position.set(0, 1.6, 3.2)
  velocity.set(0, 0, 0)
  spawnBatch()
}

function onGrenadeBlast(pos) {
  audio.explode()

  // 全屏爆闪
  const flashEl = document.getElementById('blastFlash')
  if (flashEl) {
    flashEl.classList.remove('on')
    void flashEl.offsetWidth
    flashEl.classList.add('on')
  }

  const radius = grenades.BLAST_RADIUS
  const list = breakables.filter((b) => b.userData.alive && b.parent)
  for (const vase of list) {
    const center = vase.getWorldPosition(new THREE.Vector3())
    center.y += vase.userData.height * 0.45
    const dist = center.distanceTo(pos)
    if (dist > radius) continue
    const dir = center.clone().sub(pos)
    if (dir.lengthSq() < 1e-5) dir.set(0, 1, 0)
    else dir.normalize()
    const falloff = 1 - dist / radius
    dir.y += 0.45 + falloff * 1.1
    dir.normalize().multiplyScalar(1.6 + falloff * 3.2)
    destroyVase(vase, dir, center, dir.clone(), true)
  }

  const eye = controls.object.position
  const d = eye.distanceTo(pos)
  const near = Math.max(0, 1 - d / 12)
  // CS 式短促震屏，幅度大但很快收
  shakeAmp = Math.max(shakeAmp, 0.05 + near * 0.16)
  addRecoil(0.025 + near * 0.08, 0)
  const prev = renderer.toneMappingExposure
  renderer.toneMappingExposure = prev + 0.35 + near * 0.35
  setTimeout(() => {
    renderer.toneMappingExposure = prev
  }, 70)
}

function flashHit() {
  crosshair.classList.add('hit')
  setTimeout(() => crosshair.classList.remove('hit'), 90)
}

function resolveBreakable(obj) {
  let o = obj
  while (o) {
    if (o.userData?.breakable) return o
    o = o.parent
  }
  return null
}

function getMuzzleWorld() {
  const model = view.models[currentWeapon]
  const local = model.userData.muzzle || new THREE.Vector3(0, 0.05, -0.5)
  model.updateWorldMatrix(true, false)
  return model.localToWorld(local.clone())
}

function destroyVase(vase, dir, point, normal, force = false, hitObject = null) {
  if (!vase.userData.alive) return { hit: false, stops: false }
  const result = applyMaterialHit(vase, world, scene, dir, point, normal, force, hitObject)
  shards.push(...(result.shards || []))
  dust.push(...(result.extras || []))
  audio.break(result.sfx || 'break')
  flashHit()
  if (result.removed) {
    vase.userData.alive = false
    if (vase.userData.body) {
      try {
        world.removeBody(vase.userData.body)
      } catch (_) {
        /* already removed */
      }
      vase.userData.body = null
    }
    if (vase.parent) scene.remove(vase)
    score += 1
    scheduleRefill()
  }
  return { hit: true, stops: result.stops !== false }
}

function isViewmodelHit(obj) {
  let o = obj
  while (o) {
    if (o === view.root) return true
    o = o.parent
  }
  return false
}

/** 能挡子弹的环境物体：墙、桌、货架等（排除特效、碎片、枪模、瓷器本身） */
function isBulletBlocker(h) {
  const o = h.object
  if (!o.isMesh) return false
  if (o.userData.fx || o.userData.shard) return false
  if (o.material && o.material.depthWrite === false) return false
  if (isViewmodelHit(o) || resolveBreakable(o)) return false
  return true
}

/** 从相机中心沿 dir 发射：被墙/桌挡住就停；沿途依次穿透目标，每穿一个动量衰减 */
function castPenetratingShot(origin, dir, w, muzzle, drawTracer) {
  const maxDist = w.range
  raycaster.set(origin, dir)
  raycaster.near = 0
  raycaster.far = maxDist
  const penetrate = w.penetrate ?? 1

  const envHits = raycaster.intersectObjects(scene.children, true).filter(isBulletBlocker)
  const wallDist = envHits.length ? envHits[0].distance : maxDist

  const targets = breakables.filter((b) => b.userData.alive)
  const hits = raycaster
    .intersectObjects(targets, true)
    .filter((h) => h.distance <= wallDist)
    .sort((x, y) => x.distance - y.distance)

  const ordered = []
  const seen = new Set()
  for (const h of hits) {
    const vase = resolveBreakable(h.object)
    if (!vase || seen.has(vase.uuid)) continue
    seen.add(vase.uuid)
    const normal = h.face
      ? h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize()
      : dir.clone().negate()
    ordered.push({ vase, point: h.point.clone(), normal, object: h.object, distance: h.distance })
  }

  let broken = 0
  let lastBreakPoint = null
  let energy = w.energy ?? 1
  for (const item of ordered) {
    if (broken >= penetrate || energy < 0.04) break
    // 方向 = 弹道方向，长度 = 剩余动量（冲量打在命中点）
    const res = destroyVase(item.vase, dir.clone().multiplyScalar(energy), item.point, item.normal, false, item.object)
    lastBreakPoint = item.point
    if (res.stops) {
      broken += 1
      energy *= w.retain ?? 0.55
    } else {
      energy *= 0.9
    }
  }

  const end = _hitPoint.copy(origin).addScaledVector(dir, wallDist)
  if ((broken >= penetrate || energy < 0.04) && lastBreakPoint) end.copy(lastBreakPoint).addScaledVector(dir, 0.04)
  if (drawTracer) tracers.spawn(muzzle, end)
}

/** 后坐：把视角抬起并记下实际抬了多少，animate 里按同样的量回正（不会越回越低） */
function addRecoil(pitch, yaw) {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
  const lim = Math.PI / 2 - 0.05
  const nx = Math.min(lim, e.x + pitch)
  recoilPitch += nx - e.x
  recoilYaw += yaw
  e.x = nx
  e.y += yaw
  camera.quaternion.setFromEuler(e)
}

function throwCurrentGrenade() {
  const w = weapon()
  const now = performance.now()
  if (now - lastShot < w.cooldown) return
  lastShot = now

  const origin = camera.getWorldPosition(new THREE.Vector3())
  origin.y -= 0.05
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  // 从身前抛出，避免穿模
  origin.addScaledVector(forward, 0.45)
  origin.x += forward.z * 0.12
  origin.z -= forward.x * 0.12

  grenades.throwGrenade(origin, forward, w.fuse ?? 2)
  audio.throw()
  viewKickZ = w.viewKick
  viewKickUp = Math.max(viewKickUp, 0.04)
  viewKickRot = 0.05
  switchT = 0.6
}

function shoot(at = performance.now()) {
  const w = weapon()
  if (w.throw) {
    throwCurrentGrenade()
    return
  }

  const now = at
  if (now - lastShot < w.cooldown) return
  lastShot = now

  // 弹道从相机中心（准星）出发；散布是以准星为中心的圆锥（弧度），与屏幕比例无关
  const muzzle = getMuzzleWorld()
  const origin = camera.getWorldPosition(new THREE.Vector3())
  const fwd = camera.getWorldDirection(new THREE.Vector3())
  const q = camera.getWorldQuaternion(new THREE.Quaternion())
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
  const cone = (w.spread || 0) + bloom
  for (let i = 0; i < w.pellets; i++) {
    const t = Math.tan(cone * Math.sqrt(Math.random()))
    const phi = Math.random() * Math.PI * 2
    const dir = fwd
      .clone()
      .addScaledVector(right, Math.cos(phi) * t)
      .addScaledVector(up, Math.sin(phi) * t)
      .normalize()
    castPenetratingShot(origin, dir, w, muzzle, w.pellets === 1 || i % 3 === 0)
  }
  bloom = Math.min(w.bloomMax ?? 0, bloom + (w.bloom ?? 0))

  audio.shoot(w.id)
  view.flash.intensity = w.id === 'shotgun' ? 4.5 : w.id === 'pistol' ? 3.6 : 2.8
  view.flash.position.copy(view.root.worldToLocal(muzzle.clone()))

  // 后坐在开枪之后：枪口上跳 + 随机横摆
  addRecoil(w.kick * (0.85 + Math.random() * 0.3), (Math.random() - 0.5) * 2 * w.kickSide)
  shakeAmp = Math.max(shakeAmp, w.shake * 0.6)
  viewKickZ = w.viewKick
  viewKickRot = w.kick * 2.2
  viewKickUp = Math.max(viewKickUp, w.kick * 0.55)

  setHud()
}

startBtn.addEventListener('click', async () => {
  await audio.unlock()
  try {
    controls.unlock()
  } catch (_) {
    /* ignore */
  }
  setPlaying(true)
})

resetBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  resetScene()
})

// 桌面：仅在画布上拖动瞄准 / 按住开火，不锁指针
let canvasDrag = false
canvas.addEventListener('mousedown', (e) => {
  if (isTouch || !isGameplay()) return
  if (e.button !== 0) return
  if (e.target !== canvas) return
  canvasDrag = true
  firing = true
  shoot()
})
window.addEventListener('mousemove', (e) => {
  if (!canvasDrag || !isGameplay()) return
  applyLook(e.movementX, e.movementY)
})
window.addEventListener('mouseup', () => {
  canvasDrag = false
  firing = false
})

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k in keys) keys[k] = true
  if (k === 'r') resetScene()
  if (k === '1') setWeapon('pistol')
  if (k === '2') setWeapon('smg')
  if (k === '3') setWeapon('shotgun')
  if (k === '4') setWeapon('grenade')
})
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase()
  if (k in keys) keys[k] = false
})

document.addEventListener(
  'wheel',
  (e) => {
    if (!isGameplay()) return
    e.preventDefault()
    const idx = WEAPON_ORDER.indexOf(currentWeapon)
    const next = e.deltaY > 0 ? (idx + 1) % WEAPON_ORDER.length : (idx - 1 + WEAPON_ORDER.length) % WEAPON_ORDER.length
    setWeapon(WEAPON_ORDER[next])
  },
  { passive: false },
)

weaponSlots.addEventListener('click', (e) => {
  const slot = e.target.closest('.wep')
  if (!slot) return
  setWeapon(slot.dataset.id)
})

function openTargetSheet(open) {
  if (!targetSheet) return
  targetSheet.classList.toggle('hidden', !open)
  targetSheet.setAttribute('aria-hidden', open ? 'false' : 'true')
}
targetBtn?.addEventListener('click', (e) => {
  e.stopPropagation()
  openTargetSheet(true)
})
document.getElementById('targetClose')?.addEventListener('click', () => openTargetSheet(false))
targetSheet?.addEventListener('click', (e) => {
  if (e.target === targetSheet) openTargetSheet(false)
  const opt = e.target.closest('.target-opt')
  if (!opt) return
  setTargetType(opt.dataset.id)
  openTargetSheet(false)
})

// —— 触控：右半屏拖动瞄准，左摇杆移动，开火键射击 ——
let lookId = null
let joyId = null
canvas.addEventListener('touchstart', (e) => {
  if (!isGameplay()) return
  const bounds = appEl.getBoundingClientRect()
  for (const t of e.changedTouches) {
    const localX = t.clientX - bounds.left
    if (localX > bounds.width * 0.4 && lookId == null) {
      lookId = t.identifier
      canvas._lookPrev = { x: t.clientX, y: t.clientY }
    }
  }
}, { passive: true })
canvas.addEventListener('touchmove', (e) => {
  if (!isGameplay() || lookId == null) return
  for (const t of e.changedTouches) {
    if (t.identifier !== lookId) continue
    const prev = canvas._lookPrev || { x: t.clientX, y: t.clientY }
    applyLook(t.clientX - prev.x, t.clientY - prev.y)
    canvas._lookPrev = { x: t.clientX, y: t.clientY }
  }
}, { passive: true })
function endLook(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === lookId) {
      lookId = null
      canvas._lookPrev = null
    }
  }
}
canvas.addEventListener('touchend', endLook)
canvas.addEventListener('touchcancel', endLook)

if (fireBtn) {
  const onFireDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isGameplay()) return
    firing = true
    shoot()
  }
  const onFireUp = (e) => {
    e.preventDefault()
    firing = false
  }
  fireBtn.addEventListener('touchstart', onFireDown, { passive: false })
  fireBtn.addEventListener('touchend', onFireUp)
  fireBtn.addEventListener('touchcancel', onFireUp)
  fireBtn.addEventListener('mousedown', onFireDown)
  fireBtn.addEventListener('mouseup', onFireUp)
}

if (joyZone) {
  const base = document.getElementById('joyBase')
  const maxR = 40
  function setKnob(x, y) {
    joyKnob.style.transform = `translate(${x}px, ${y}px)`
  }
  function joyFromTouch(t) {
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = t.clientX - cx
    let dy = t.clientY - cy
    const len = Math.hypot(dx, dy) || 1
    const k = Math.min(1, maxR / len)
    dx *= k
    dy *= k
    setKnob(dx, dy)
    touchMove.x = dx / maxR
    touchMove.y = dy / maxR
  }
  joyZone.addEventListener('touchstart', (e) => {
    if (!isGameplay()) return
    const t = e.changedTouches[0]
    joyId = t.identifier
    joyFromTouch(t)
  }, { passive: true })
  joyZone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) joyFromTouch(t)
    }
  }, { passive: true })
  const endJoy = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null
        touchMove.x = 0
        touchMove.y = 0
        setKnob(0, 0)
      }
    }
  }
  joyZone.addEventListener('touchend', endJoy)
  joyZone.addEventListener('touchcancel', endJoy)
}

addEventListener('resize', resizeToApp)

for (const wid of WEAPON_ORDER) view.models[wid].visible = wid === currentWeapon
resetScene()

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.033)
  const w = weapon()
  const model = view.models[currentWeapon]
  const hold = w.hold

  // 枪械按住连发；手雷只点射
  // 按时间补发：掉帧也不会把连发节奏拖断（每帧最多补 3 发）
  if (isGameplay() && firing && w.auto && !w.throw) {
    const nowMs = performance.now()
    for (let i = 0; i < 3; i++) {
      if (nowMs - lastShot < w.cooldown) break
      shoot(lastShot + w.cooldown)
    }
  }

  // 每帧检查：场上没有存活瓷器就补货（避免漏触发）
  scheduleRefill()
  if (refillTimer >= 0) {
    refillTimer -= dt
    if (refillTimer <= 0) spawnBatch()
  }

  if (isGameplay()) {
    const speed = 1.35
    direction.set(0, 0, 0)
    if (keys.w) direction.z -= 1
    if (keys.s) direction.z += 1
    if (keys.a) direction.x -= 1
    if (keys.d) direction.x += 1
    // 触屏摇杆：x 左右，y 前后（上为前进）
    if (isTouch) {
      direction.x += touchMove.x
      direction.z += touchMove.y
    }
    if (direction.lengthSq() > 0) direction.normalize()

    velocity.x -= velocity.x * 8 * dt
    velocity.z -= velocity.z * 8 * dt
    velocity.x += direction.x * speed * dt
    velocity.z += direction.z * speed * dt

    controls.moveRight(velocity.x)
    controls.moveForward(-velocity.z)

    const p = controls.object.position
    p.x = THREE.MathUtils.clamp(p.x, -6.2, 6.2)
    p.z = THREE.MathUtils.clamp(p.z, -6.2, 6.2)
    p.y = 1.6
  }

  // 后坐回正：停火片刻后按记录的量指数回落，最终精确回到原准星
  if ((recoilPitch !== 0 || recoilYaw !== 0) && performance.now() - lastShot > (w.recoverDelay ?? 80)) {
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    const r = 1 - Math.exp(-(w.recover ?? 7) * dt)
    const dp = recoilPitch * r
    const dy = recoilYaw * r
    euler.x -= dp
    euler.y -= dy
    recoilPitch -= dp
    recoilYaw -= dy
    if (Math.abs(recoilPitch) < 1e-5) recoilPitch = 0
    if (Math.abs(recoilYaw) < 1e-5) recoilYaw = 0
    camera.quaternion.setFromEuler(euler)
  }
  bloom = Math.max(0, bloom - (w.bloomDecay ?? 0.06) * dt)

  shakeAmp *= Math.exp(-10 * dt)

  world.step(1 / 60, dt, 3)
  syncMovers(breakables)
  const now = performance.now()
  syncShards(shards, now, scene, world)
  syncDust(dust, now, dt, scene)
  tracers.update(now)
  grenades.update(now, dt, onGrenadeBlast)

  const t = performance.now() * 0.001
  const moving = keys.w || keys.a || keys.s || keys.d
  const bobX = Math.sin(t * (moving ? 9 : 1.5)) * (moving ? 0.012 : 0.003)
  const bobY = Math.abs(Math.sin(t * (moving ? 18 : 1.6))) * (moving ? 0.014 : 0.004)
  viewKickZ = THREE.MathUtils.damp(viewKickZ, 0, 12, dt)
  viewKickRot = THREE.MathUtils.damp(viewKickRot, 0, 10, dt)
  viewKickUp = THREE.MathUtils.damp(viewKickUp, 0, 11, dt)
  switchT = THREE.MathUtils.damp(switchT, 0, 8, dt)

  // 枪口上抬：枪身上移 + 枪管朝上仰
  model.position.set(
    hold.x + bobX,
    hold.y - bobY - switchT * 0.2 + viewKickUp,
    hold.z + viewKickZ,
  )
  model.rotation.set(
    (hold.rx || 0) - viewKickRot,
    hold.ry || 0,
    (hold.rz || 0) + bobX * 1.2,
  )

  if (view.flash.intensity > 0) {
    view.flash.intensity = THREE.MathUtils.damp(view.flash.intensity, 0, 20, dt)
  }

  const eye = controls.object
  eye.position.y = 1.6
  const sx = shakeAmp > 0.0005 ? (Math.random() - 0.5) * shakeAmp : 0
  const sy = shakeAmp > 0.0005 ? (Math.random() - 0.5) * shakeAmp * 0.8 : 0
  eye.position.x += sx
  eye.position.y += sy
  renderer.render(scene, camera)
  eye.position.x -= sx
  eye.position.y -= sy
}

animate()
