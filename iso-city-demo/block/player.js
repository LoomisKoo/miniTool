import * as THREE from 'three'
import { GROUND, solids, std } from './kit.js'

const R = 0.42

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.castShadow = false
  m.receiveShadow = true
  parent.add(m)
  return m
}

function buildHero() {
  const g = new THREE.Group()
  const cloth = std('#31445c', { roughness: 0.72 })
  const dark = std('#1e2834', { roughness: 0.8 })
  const skin = std('#e6c4a6', { roughness: 0.62 })
  const hair = std('#2a241e', { roughness: 0.75 })
  box(g, 0.42, 0.52, 0.24, cloth, 0, 1.16, 0)
  box(g, 0.44, 0.1, 0.26, dark, 0, 0.92, 0)
  box(g, 0.26, 0.24, 0.24, skin, 0, 1.58, 0)
  box(g, 0.28, 0.12, 0.26, hair, 0, 1.72, 0)
  box(g, 0.28, 0.28, 0.12, dark, 0, 1.22, -0.16)
  const legs = []
  const arms = []
  for (const s of [-1, 1]) {
    const leg = new THREE.Group()
    leg.position.set(s * 0.11, 0.84, 0)
    box(leg, 0.14, 0.7, 0.16, dark, 0, -0.36, 0)
    box(leg, 0.15, 0.08, 0.24, std('#14181e'), 0, -0.72, 0.04)
    g.add(leg)
    legs.push(leg)
    const arm = new THREE.Group()
    arm.position.set(s * 0.28, 1.36, 0)
    box(arm, 0.1, 0.5, 0.12, cloth, 0, -0.26, 0)
    box(arm, 0.1, 0.1, 0.12, skin, 0, -0.54, 0)
    g.add(arm)
    arms.push(arm)
  }
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#f3f6fb', roughness: 1, transparent: true, opacity: 0.94,
  })
  const cloud = new THREE.Group()
  const puff = new THREE.SphereGeometry(1, 14, 10)
  for (const [x, y, z, s] of [[0, 0.16, 0, 0.52], [0.34, 0.1, 0.04, 0.34], [-0.32, 0.12, -0.02, 0.32], [0.02, 0.28, 0.1, 0.26]]) {
    const m = new THREE.Mesh(puff, cloudMat)
    m.position.set(x, y, z)
    m.scale.set(s, s * 0.62, s)
    cloud.add(m)
  }
  cloud.visible = false
  g.add(cloud)
  return { group: g, legs, arms, cloud }
}

function groundAt(x, z) {
  if (z > 12.55 && z < 21.2 && x > -42 && x < 40) return 0.08
  return GROUND
}

function supportAt(x, z, y) {
  let h = groundAt(x, z)
  for (const c of solids) {
    if (Math.abs(x - c.x) > c.w / 2 || Math.abs(z - c.z) > c.d / 2) continue
    if (c.y > h && c.y <= y + 0.55 && y + 0.2 >= c.base) h = c.y
  }
  return h
}

function blocked(x, z, y) {
  const head = y + 1.65
  for (const c of solids) {
    if (head < c.base + 0.05 || y > c.y - 0.8) continue
    const hw = c.w / 2 + R
    const hd = c.d / 2 + R
    if (Math.abs(x - c.x) < hw && Math.abs(z - c.z) < hd) return c
  }
  return null
}

function slide(x, z, y) {
  for (let n = 0; n < 3; n++) {
    const hit = blocked(x, z, y)
    if (!hit) break
    const hw = hit.w / 2 + R
    const hd = hit.d / 2 + R
    const dx = x - hit.x
    const dz = z - hit.z
    const px = hw - Math.abs(dx)
    const pz = hd - Math.abs(dz)
    if (px < pz) x = hit.x + Math.sign(dx || 1) * hw
    else z = hit.z + Math.sign(dz || 1) * hd
  }
  return [x, z]
}

/** 镜头到人的线段穿进楼体时，把相机收到墙这一侧。 */
function camClear(px, py, pz, cx, cy, cz) {
  const dx = cx - px
  const dy = cy - py
  const dz = cz - pz
  let best = 1
  for (const c of solids) {
    const x0 = c.x - c.w / 2 - 0.2
    const x1 = c.x + c.w / 2 + 0.2
    const y0 = c.base
    const y1 = c.y + 0.4
    const z0 = c.z - c.d / 2 - 0.2
    const z1 = c.z + c.d / 2 + 0.2
    let t0 = 0
    let t1 = best
    let hit = true
    const slabs = [[dx, px, x0, x1], [dy, py, y0, y1], [dz, pz, z0, z1]]
    for (const [d, o, a, b] of slabs) {
      if (Math.abs(d) < 1e-6) {
        if (o < a || o > b) hit = false
        continue
      }
      let ta = (a - o) / d
      let tb = (b - o) / d
      if (ta > tb) { const s = ta; ta = tb; tb = s }
      if (ta > t0) t0 = ta
      if (tb < t1) t1 = tb
      if (t0 > t1) hit = false
    }
    if (hit && t0 > 0.02 && t0 < best) best = t0 * 0.92
  }
  return best
}

export function createPlayer(scene, camera, canvas) {
  const hero = buildHero()
  scene.add(hero.group)

  const p = {
    x: -12.2,
    y: GROUND,
    z: 11.15,
    yaw: 0.42,
    pitch: 0.34,
    dist: 8,
    vx: 0,
    vz: 0,
    vy: 0,
    face: 0.42,
    flying: false,
    grounded: true,
    gliding: false,
    overview: false,
    savedDist: 8,
    savedPitch: 0.34,
    gait: 0,
    speed: 0,
  }
  const keys = new Set()
  let dragging = false
  let lastX = 0
  let lastY = 0
  let jumpLatch = false
  let camFit = 1
  const cam = new THREE.Vector3(90, 18, 24)
  const look = new THREE.Vector3()

  const act = document.getElementById('act')

  addEventListener('keydown', (e) => {
    if (e.repeat) return
    keys.add(e.code)
    if (e.code === 'Space') e.preventDefault()
    if (e.code === 'KeyF' && !p.overview) {
      p.flying = !p.flying
      p.gliding = false
      p.vy = p.flying ? Math.max(p.vy, 5.4) : -1.2
      p.grounded = false
      if (p.flying) p.dist = Math.max(p.dist, 9)
    }
    if (e.code === 'KeyV') {
      p.overview = !p.overview
      if (p.overview) {
        p.savedDist = p.dist
        p.savedPitch = p.pitch
        p.dist = 156
        p.pitch = 1.02
        p.vx = 0
        p.vz = 0
        p.vy = 0
      } else {
        p.dist = p.savedDist
        p.pitch = p.savedPitch
      }
    }
  })
  addEventListener('keyup', (e) => keys.delete(e.code))
  addEventListener('blur', () => keys.clear())

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    canvas.requestPointerLock?.()
  })
  addEventListener('pointerup', () => { dragging = false })
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || document.pointerLockElement) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    turn(dx, dy)
  })
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return
    turn(e.movementX, e.movementY)
  })
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const raw = clamp(e.deltaY * 0.001, -0.12, 0.12)
    const max = p.overview ? 240 : 28
    const min = p.overview ? 70 : 3.2
    p.dist = clamp(p.dist * Math.exp(raw), min, max)
  }, { passive: false })

  function turn(dx, dy) {
    const sens = p.overview ? 0.0024 : 0.0022
    p.yaw -= dx * sens
    p.pitch = clamp(p.pitch + dy * sens, p.overview ? 0.72 : -0.75, 1.25)
  }

  function update(dt) {
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
    const side = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
    const fx = -Math.sin(p.yaw)
    const fz = -Math.cos(p.yaw)
    const rx = Math.cos(p.yaw)
    const rz = -Math.sin(p.yaw)
    let mx = 0
    let mz = 0
    if ((fwd || side) && !p.overview) {
      const len = Math.hypot(fwd, side)
      mx = (fx * fwd + rx * side) / len
      mz = (fz * fwd + rz * side) / len
    }

    const space = keys.has('Space')
    const descend = keys.has('KeyC') || keys.has('KeyX') || keys.has('KeyZ') || keys.has('ControlLeft') || keys.has('ControlRight')

    if (!p.overview && p.flying) {
      const len = Math.hypot(fwd, side) || 1
      const cp = Math.cos(p.pitch)
      const fly = sprint ? 14 : 8
      const wishX = (fx * cp * fwd + rx * side) / len
      const wishY = (-Math.sin(p.pitch) * fwd) / len
      const wishZ = (fz * cp * fwd + rz * side) / len
      const blend = 1 - Math.exp(-6 * dt)
      const moving = fwd || side
      p.vx += ((moving ? wishX * fly : 0) - p.vx) * blend
      p.vz += ((moving ? wishZ * fly : 0) - p.vz) * blend
      const vertical = (space ? 1 : 0) - (descend ? 1 : 0)
      const vTarget = vertical !== 0 ? vertical * (sprint ? 10 : 6) : (moving ? wishY * fly : 0)
      p.vy += (vTarget - p.vy) * (1 - Math.exp(-7 * dt))
      p.gliding = false
      p.grounded = false
    } else if (!p.overview) {
      if (space && p.grounded && !jumpLatch) {
        p.vy = 6.6
        p.grounded = false
        jumpLatch = true
      }
      if (!space) jumpLatch = false
      p.gliding = space && !p.grounded && p.vy < 0.4
      if (p.gliding) p.vy = Math.max(p.vy, -1.8)

      const want = (fwd || side) ? (sprint ? 7.4 : 4.4) * (p.gliding ? 1.15 : 1) : 0
      const blend = 1 - Math.exp(-(p.grounded ? 12 : 4.5) * dt)
      p.vx += (mx * want - p.vx) * blend
      p.vz += (mz * want - p.vz) * blend
      if (!fwd && !side && p.grounded) {
        const fr = 1 - Math.exp(-14 * dt)
        p.vx *= 1 - fr
        p.vz *= 1 - fr
      }
      if (!p.flying) {
        p.vy -= 18 * dt
      }
    }

    if (!p.overview) {
      const nx = clamp(p.x + p.vx * dt, -38, 34)
      const nz = clamp(p.z + p.vz * dt, -32, 26)
      ;[p.x, p.z] = slide(nx, p.z, p.y)
      ;[p.x, p.z] = slide(p.x, nz, p.y)
      p.y += p.vy * dt
      const floor = supportAt(p.x, p.z, p.y)
      if (p.y <= floor) {
        p.y = floor
        if (p.vy < 0) p.vy = 0
        p.grounded = !p.flying
        if (!p.flying) p.gliding = false
      } else if (!p.flying) {
        p.grounded = false
      }
      if (p.flying && p.y < floor) {
        p.y = floor
        p.vy = Math.max(0, p.vy)
      }
      p.y = clamp(p.y, floor, 150)
    }

    p.speed = Math.hypot(p.vx, p.vz)
    if (p.speed > 0.35) {
      const face = Math.atan2(p.vx, p.vz)
      let d = face - p.face
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      p.face += d * Math.min(1, dt * 12)
    }
    p.gait += dt * (2.2 + p.speed * 1.8)

    hero.group.visible = !p.overview
    hero.group.position.set(p.x, p.y, p.z)
    hero.group.rotation.y = p.face
    hero.cloud.visible = p.flying && !p.overview
    hero.cloud.position.y = Math.sin(performance.now() * 0.003) * 0.045

    const swing = Math.sin(p.gait) * clamp(p.speed / 3.2, 0, 1)
    if (p.flying) {
      hero.legs[0].rotation.x = -1.25
      hero.legs[1].rotation.x = -1.25
      hero.arms[0].rotation.x = -0.35
      hero.arms[1].rotation.x = -0.35
      hero.arms[0].rotation.z = -0.15
      hero.arms[1].rotation.z = 0.15
    } else if (p.gliding) {
      hero.legs[0].rotation.x = -0.35
      hero.legs[1].rotation.x = -0.35
      hero.arms[0].rotation.x = 0
      hero.arms[1].rotation.x = 0
      hero.arms[0].rotation.z = 1.15
      hero.arms[1].rotation.z = -1.15
    } else if (!p.grounded) {
      hero.legs[0].rotation.x = -0.45
      hero.legs[1].rotation.x = -0.2
      hero.arms[0].rotation.x = -0.7
      hero.arms[1].rotation.x = -0.5
      hero.arms[0].rotation.z = 0
      hero.arms[1].rotation.z = 0
    } else {
      hero.legs[0].rotation.x = swing
      hero.legs[1].rotation.x = -swing
      hero.arms[0].rotation.x = -swing * 0.85
      hero.arms[1].rotation.x = swing * 0.85
      hero.arms[0].rotation.z = 0
      hero.arms[1].rotation.z = 0
    }

    const cy = Math.cos(p.pitch)
    const dist = p.dist
    const focusX = p.overview ? -1 : p.x
    const focusY = p.overview ? 14 : p.y + 1.35
    const focusZ = p.overview ? -2 : p.z
    let tx = focusX + Math.sin(p.yaw) * cy * dist
    let ty = (p.overview ? focusY : p.y + 1.7) + Math.sin(p.pitch) * dist
    let tz = focusZ + Math.cos(p.yaw) * cy * dist
    if (!p.overview && dist > 2.4) {
      const fit = camClear(p.x, p.y + 1.4, p.z, tx, ty, tz)
      camFit += (fit - camFit) * Math.min(1, dt * 10)
      tx = p.x + Math.sin(p.yaw) * cy * dist * camFit
      ty = p.y + 1.7 + Math.sin(p.pitch) * dist * camFit
      tz = p.z + Math.cos(p.yaw) * cy * dist * camFit
    } else camFit = 1
    if (!p.overview) ty = Math.max(ty, groundAt(tx, tz) + 0.45)
    cam.lerp(look.set(tx, ty, tz), 1 - Math.exp(-8 * dt))
    camera.position.copy(cam)
    camera.lookAt(focusX, focusY, focusZ)
    const wantFov = p.overview ? 58 : 48
    if (Math.abs(camera.fov - wantFov) > 0.05) {
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 3.5)
      camera.updateProjectionMatrix()
    }

    if (act) {
      act.textContent = p.overview
        ? '总览 · V 回到街上'
        : p.flying
          ? '飞行 · 空格上升 · C 下降 · F 落地'
          : p.gliding
            ? '滑翔中'
            : ''
    }
  }

  return {
    update,
    get overview() { return p.overview },
  }
}
