import * as THREE from 'three'

/**
 * 筋斗云漫游角色
 *  - 一团实心积云 + 一层柔光点絮（各 1 个 draw call）
 *  - 云上一个小骑手：袍子 / 金箍 / 披帛 / 金箍棒，随速度俯仰、转弯侧倾
 *  - 移动时身后拉两道细尾迹（世界空间飘带，一次 draw）
 *  - 第三人称跟随相机 + 指针锁定鼠标转向 + 楼体包围盒碰撞（可落在屋顶）
 */

const CORE = [
  [0, 0, 0, 0.84],
  ...Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + 0.3
    return [Math.cos(a) * 0.7, -0.06, Math.sin(a) * 0.64, 0.54 - (i % 2) * 0.07]
  }),
  [0.2, 0.3, 0.1, 0.5],
  [-0.27, 0.26, -0.08, 0.46],
  [0.02, 0.24, -0.35, 0.43],
]

function softDot() {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.42, 'rgba(255,255,255,.8)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, s, s)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function buildCloud(scene) {
  const group = new THREE.Group()
  group.name = 'cloud'
  group.visible = false
  scene.add(group)

  const body = new THREE.Group()
  group.add(body)

  const coreMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.5,
    emissive: new THREE.Color('#eef5ff'),
    emissiveIntensity: 0.05,
  })
  const core = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), coreMat, CORE.length)
  const dummy = new THREE.Object3D()
  CORE.forEach(([x, y, z, r], i) => {
    dummy.position.set(x, y, z)
    dummy.scale.set(r, r * 0.74, r)
    dummy.updateMatrix()
    core.setMatrixAt(i, dummy.matrix)
  })
  body.add(core)

  // 柔软边缘：一圈始终面向相机的点絮
  const N = 88
  const pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    let seed = (i + 1) * 16807 % 2147483647
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const a = rnd() * Math.PI * 2
    const up = Math.pow(rnd(), 0.72) * 2 - 1
    const ring = Math.sqrt(Math.max(0, 1 - up * up))
    const shell = 0.78 + rnd() * 0.32
    pos[i * 3] = Math.cos(a) * ring * 1.12 * shell
    pos[i * 3 + 1] = up * 0.44 * shell + 0.03
    pos[i * 3 + 2] = Math.sin(a) * ring * 1.0 * shell
  }
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const pMat = new THREE.PointsMaterial({
    map: softDot(),
    size: 1.55,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    color: new THREE.Color('#f4f8ff'),
  })
  const puffs = new THREE.Points(pGeo, pMat)
  puffs.renderOrder = 5
  body.add(puffs)

  // ---- 骑手 ----
  const rider = new THREE.Group()
  rider.position.y = -1.45
  body.add(rider)

  const robeMat = new THREE.MeshStandardMaterial({ color: '#c8503a', roughness: 0.78, metalness: 0.02, envMapIntensity: 0.4 })
  const trimMat = new THREE.MeshStandardMaterial({ color: '#e8c37a', roughness: 0.42, metalness: 0.55, envMapIntensity: 0.7 })
  const skinMat = new THREE.MeshStandardMaterial({ color: '#e9bc92', roughness: 0.72 })
  const hairMat = new THREE.MeshStandardMaterial({ color: '#241d1a', roughness: 0.82 })
  const scarfMat = new THREE.MeshStandardMaterial({ color: '#f0d79a', roughness: 0.6, side: THREE.DoubleSide })

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.78, 1.02, 14, 1, true), robeMat)
  skirt.position.y = 2.55
  skirt.material.side = THREE.DoubleSide
  rider.add(skirt)

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 12), robeMat)
  torso.position.y = 3.4
  rider.add(torso)

  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.055, 8, 20), trimMat)
  sash.rotation.x = Math.PI / 2
  sash.position.y = 3.07
  rider.add(sash)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), skinMat)
  head.position.y = 3.96
  rider.add(head)

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.314, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat)
  hair.position.y = 3.98
  rider.add(hair)

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.036, 8, 22), trimMat)
  band.rotation.x = Math.PI / 2
  band.position.y = 3.9
  rider.add(band)

  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.48, 4, 8), robeMat)
    arm.position.set(s * 0.4, 3.42, 0.04)
    arm.rotation.z = s * 1.02
    arm.rotation.x = -0.28
    rider.add(arm)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skinMat)
    hand.position.set(s * 0.66, 3.24, 0.12)
    rider.add(hand)
  }

  // 金箍棒：斜挎在右手侧
  const staff = new THREE.Group()
  staff.position.set(0.78, 3.35, 0.06)
  staff.rotation.z = 0.42
  staff.rotation.x = -0.16
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 2.5, 8), new THREE.MeshStandardMaterial({ color: '#9b2f22', roughness: 0.5, metalness: 0.25 }))
  staff.add(rod)
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8), trimMat)
    cap.position.y = s * 1.3
    staff.add(cap)
  }
  rider.add(staff)

  // 披帛（两条飘带）
  const scarves = []
  for (const s of [-1, 1]) {
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.5, 1, 4), scarfMat)
    sc.position.set(s * 0.3, 3.1, -0.42)
    sc.rotation.y = s * 0.18
    rider.add(sc)
    scarves.push(sc)
  }

  return { group, body, rider, scarfL: scarves[0], scarfR: scarves[1], coreMat, pMat, core, puffs }
}

/** 尾迹：世界空间两条飘带，顶点朝向相机展开，越老越宽越淡 */
function buildTrail(scene) {
  const S = 2
  const N = 130
  const V = S * N * 2
  const geo = new THREE.BufferGeometry()
  const pos = new THREE.BufferAttribute(new Float32Array(V * 3), 3)
  const tan = new THREE.BufferAttribute(new Float32Array(V * 3), 3)
  const side = new THREE.BufferAttribute(new Float32Array(V), 1)
  const age = new THREE.BufferAttribute(new Float32Array(V).fill(1), 1)
  const wid = new THREE.BufferAttribute(new Float32Array(V), 1)
  for (const a of [pos, tan, age, wid]) a.setUsage(THREE.DynamicDrawUsage)
  for (let i = 0; i < V; i++) side.array[i] = i % 2 ? 1 : -1
  const idx = []
  for (let s = 0; s < S; s++) {
    for (let i = 0; i < N - 1; i++) {
      const a = (s * N + i) * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  geo.setIndex(idx)
  geo.setAttribute('position', pos)
  geo.setAttribute('aTan', tan)
  geo.setAttribute('aSide', side)
  geo.setAttribute('aAge', age)
  geo.setAttribute('aW', wid)

  const uNight = { value: 0 }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight },
    vertexShader: `
      attribute vec3 aTan; attribute float aSide; attribute float aAge; attribute float aW;
      varying float vAge; varying float vAcross;
      void main() {
        vec3 wp = position;
        vec3 V = normalize(cameraPosition - wp);
        vec3 t = aTan;
        float tl = length(t);
        t = tl > 1e-5 ? t / tl : vec3(0.0, 0.0, 1.0);
        vec3 s = cross(t, V);
        float sl = length(s);
        s = sl > 1e-4 ? s / sl : vec3(0.0, 1.0, 0.0);
        wp += s * aSide * aW * (1.0 + aAge * 2.4);
        vAge = aAge; vAcross = aSide;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `
      uniform float uNight;
      varying float vAge; varying float vAcross;
      void main() {
        float edge = 1.0 - smoothstep(0.05, 1.0, abs(vAcross));
        edge = edge * edge * (3.0 - 2.0 * edge);
        float fade = smoothstep(0.0, 0.025, vAge) * pow(max(1.0 - vAge, 0.0), 1.3);
        float a = edge * fade * 0.85;
        if (a < 0.004) discard;
        vec3 col = mix(vec3(1.0), vec3(0.88, 0.92, 0.98), vAge * 0.5);
        col *= mix(1.0, 0.78, uNight);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 6
  mesh.visible = false
  scene.add(mesh)

  const EMIT = [[-1.5, 0.02, 1.5, 0.42], [1.5, 0.02, 1.5, 0.42]]
  const LIFE = 1.15
  const trails = EMIT.map(() => [])
  const ev = new THREE.Vector3()

  function write(now, heads) {
    let any = false
    for (let s = 0; s < S; s++) {
      const pts = trails[s]
      const w0 = EMIT[s][3]
      const base = s * N * 2
      const list = heads ? [heads[s], ...pts] : pts
      const n = Math.min(N, list.length)
      for (let i = 0; i < N; i++) {
        const k = Math.min(i, n - 1)
        const p = k >= 0 ? list[k] : null
        const v = base + i * 2
        if (!p || i >= n) {
          const q = p || { x: 0, y: -9999, z: 0 }
          for (const o of [v, v + 1]) {
            pos.setXYZ(o, q.x, q.y, q.z)
            age.setX(o, 1)
            wid.setX(o, 0)
          }
          continue
        }
        const a = list[Math.max(0, k - 1)]
        const b = list[Math.min(n - 1, k + 1)]
        const ag = Math.min(1, (now - p.t) / LIFE)
        if (ag < 1) any = true
        for (const o of [v, v + 1]) {
          pos.setXYZ(o, p.x, p.y, p.z)
          tan.setXYZ(o, a.x - b.x, a.y - b.y, a.z - b.z)
          age.setX(o, ag)
          wid.setX(o, w0)
        }
      }
    }
    pos.needsUpdate = tan.needsUpdate = age.needsUpdate = wid.needsUpdate = true
    return any
  }

  return {
    mesh,
    uNight,
    update(dt, now, matrixWorld, group, speed) {
      const moving = speed > 6
      let heads = null
      if (moving) {
        heads = []
        for (let s = 0; s < S; s++) {
          ev.set(EMIT[s][0], EMIT[s][1], EMIT[s][2]).applyMatrix4(matrixWorld)
          const h = { x: ev.x, y: ev.y, z: ev.z, t: now }
          heads.push(h)
          const pts = trails[s]
          const last = pts[0]
          const minD = Math.max(1.2, speed * LIFE / (N - 24))
          if (!last || (h.x - last.x) ** 2 + (h.y - last.y) ** 2 + (h.z - last.z) ** 2 > minD * minD || now - last.t > 0.05) {
            pts.unshift({ x: h.x, y: h.y, z: h.z, t: now })
          }
        }
      }
      let total = 0
      for (const pts of trails) {
        while (pts.length && (now - pts[pts.length - 1].t > LIFE || pts.length > N - 1)) pts.pop()
        for (const p of pts) p.y += dt * 0.3
        total += pts.length
      }
      if (!total && !heads) {
        mesh.visible = false
        return
      }
      mesh.visible = write(now, heads) || !!heads
      void group
    },
  }
}

function shortAngle(a, b) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export function createRoam({ scene, camera, renderer, controls, solids = [], bounds = { x: 240, z: 760 } }) {
  const cloud = buildCloud(scene)
  const trail = buildTrail(scene)

  const CLOUD_LIFT = 2.6 // 云心离脚下平面
  const R = 2.5 // 碰撞半径
  const SPEED = 46
  const BOOST = 172
  const SLOW = 16

  const st = {
    active: false,
    t: 0,
    pos: new THREE.Vector3(0, 96, bounds.z * 0.7),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: -0.08,
    lastYaw: 0,
    turn: 0,
    speed: 0,
    fov: 36,
    cam: new THREE.Vector3(),
    focus: new THREE.Vector3(),
  }
  let saved = null
  let nightOn = false
  let locked = false
  let dragging = false
  let hudAcc = 0

  const keys = new Set()
  const hud = document.getElementById('roamHud')
  const speedEl = document.getElementById('roamSpeed')

  // ---- 碰撞：按网格索引的大体量包围盒 ----
  const CELL = 56
  const grid = new Map()
  const boxes = solids
  for (const b of boxes) {
    const c0x = Math.floor(b.x0 / CELL)
    const c1x = Math.floor(b.x1 / CELL)
    const c0z = Math.floor(b.z0 / CELL)
    const c1z = Math.floor(b.z1 / CELL)
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const k = cx + ',' + cz
        let arr = grid.get(k)
        if (!arr) grid.set(k, (arr = []))
        arr.push(b)
      }
    }
  }
  const near = []
  function gather(x, z) {
    near.length = 0
    const cx = Math.floor(x / CELL)
    const cz = Math.floor(z / CELL)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const arr = grid.get(cx + dx + ',' + (cz + dz))
        if (!arr) continue
        for (const b of arr) if (near.indexOf(b) < 0) near.push(b)
      }
    }
    return near
  }

  function collide(dt, prevY) {
    let floor = CLOUD_LIFT
    const list = gather(st.pos.x, st.pos.z)
    for (let pass = 0; pass < 2; pass++) {
      let pushed = false
      for (const b of list) {
        if (st.pos.x < b.x0 - R || st.pos.x > b.x1 + R || st.pos.z < b.z0 - R || st.pos.z > b.z1 + R) continue
        // 从上方穿过屋盖 → 落在屋顶上
        if (prevY > b.y1 - 0.8 || st.pos.y > b.y1 - 0.8) {
          if (b.y1 + CLOUD_LIFT > floor) floor = b.y1 + CLOUD_LIFT
          continue
        }
        if (st.pos.y + 2.1 < b.y0) continue
        const dx1 = b.x1 + R - st.pos.x
        const dx0 = st.pos.x - (b.x0 - R)
        const dz1 = b.z1 + R - st.pos.z
        const dz0 = st.pos.z - (b.z0 - R)
        const m = Math.min(dx0, dx1, dz0, dz1)
        if (m === dx1) { st.pos.x = b.x1 + R; if (st.vel.x < 0) st.vel.x = 0 }
        else if (m === dx0) { st.pos.x = b.x0 - R; if (st.vel.x > 0) st.vel.x = 0 }
        else if (m === dz1) { st.pos.z = b.z1 + R; if (st.vel.z < 0) st.vel.z = 0 }
        else { st.pos.z = b.z0 - R; if (st.vel.z > 0) st.vel.z = 0 }
        pushed = true
      }
      if (!pushed) break
    }
    if (st.pos.y < floor) {
      st.pos.y = floor
      if (st.vel.y < 0) st.vel.y = 0
    }
    void dt
    // 场地边界 + 高度上限
    st.pos.x = Math.max(-bounds.x, Math.min(bounds.x, st.pos.x))
    st.pos.z = Math.max(-bounds.z, Math.min(bounds.z, st.pos.z))
    st.pos.y = Math.min(820, st.pos.y)
  }

  // ---- 输入 ----
  function onKeyDown(e) {
    if (e.code === 'KeyP') {
      e.preventDefault()
      st.active ? exit() : enter()
      return
    }
    if (!st.active) return
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    keys.add(e.code)
  }
  function onKeyUp(e) {
    keys.delete(e.code)
  }
  addEventListener('keydown', onKeyDown)
  addEventListener('keyup', onKeyUp)
  addEventListener('blur', () => keys.clear())

  renderer.domElement.addEventListener('click', () => {
    if (st.active && !locked) renderer.domElement.requestPointerLock?.()
  })
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === renderer.domElement
    if (!st.active) return
    if (hud) hud.classList.toggle('unlocked', !locked)
  })
  addEventListener('mousemove', (e) => {
    if (!st.active || !locked) return
    st.yaw -= e.movementX * 0.0022
    const p = st.pitch - e.movementY * 0.0022
    st.pitch = Math.max(-1.05, Math.min(1.05, p))
  })
  // 未锁定时拖拽也能看
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!st.active || locked) return
    dragging = true
    renderer.domElement.setPointerCapture?.(e.pointerId)
  })
  renderer.domElement.addEventListener('pointerup', () => { dragging = false })
  addEventListener('pointerup', () => { dragging = false })
  addEventListener('pointermove', (e) => {
    if (!st.active || locked || !dragging) return
    st.yaw -= e.movementX * 0.0032
    st.pitch = Math.max(-1.05, Math.min(1.05, st.pitch - e.movementY * 0.0032))
  })

  const roamBtn = document.getElementById('roamBtn')
  if (roamBtn) roamBtn.addEventListener('click', () => { st.active ? exit() : enter() })

  // ---- 进出 ----
  function desiredCam(out, focusOut) {
    const cp = Math.cos(st.pitch)
    const fwd = new THREE.Vector3(-Math.sin(st.yaw) * cp, Math.sin(st.pitch), -Math.cos(st.yaw) * cp)
    const dist = 15 + Math.min(st.speed, BOOST) * 0.06
    out.copy(st.pos).addScaledVector(fwd, -dist)
    out.y += 2.6
    if (out.y < 3.5) out.y = 3.5
    focusOut.copy(st.pos).addScaledVector(fwd, 9)
    focusOut.y += 1.4
  }

  function enter() {
    if (st.active) return
    saved = {
      pos: camera.position.clone(),
      target: controls.target.clone(),
      fov: camera.fov,
    }
    st.active = true
    controls.enabled = false
    keys.clear()
    document.body.classList.add('roam')
    if (hud) hud.hidden = false
    if (roamBtn) roamBtn.textContent = '退出漫游'
    cloud.group.visible = true
    st.pos.y = Math.max(st.pos.y, 24)
    st.vel.set(0, 0, 0)
    desiredCam(st.cam, st.focus)
    camera.position.copy(st.cam)
    camera.lookAt(st.focus)
    renderer.domElement.requestPointerLock?.()
  }

  function exit() {
    if (!st.active) return
    st.active = false
    keys.clear()
    cloud.group.visible = false
    trail.mesh.visible = false
    controls.enabled = true
    document.body.classList.remove('roam')
    if (hud) hud.hidden = true
    if (roamBtn) roamBtn.textContent = '筋斗云漫游'
    if (saved) {
      camera.position.copy(saved.pos)
      controls.target.copy(saved.target)
      camera.fov = saved.fov
      camera.updateProjectionMatrix()
    }
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.()
  }

  function setNight(on) {
    nightOn = on
    cloud.coreMat.color.set(on ? '#c3d2e6' : '#ffffff')
    cloud.coreMat.emissiveIntensity = on ? 0.16 : 0.05
    cloud.pMat.color.set(on ? '#b9c8dd' : '#f4f8ff')
    cloud.pMat.opacity = on ? 0.36 : 0.5
    trail.uNight.value = on ? 1 : 0
  }

  // ---- 每帧 ----
  function update(dt) {
    if (!st.active) return false
    st.t += dt

    const boost = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const slow = keys.has('AltLeft') || keys.has('AltRight')
    const cp = Math.cos(st.pitch)
    const fwd = new THREE.Vector3(-Math.sin(st.yaw) * cp, Math.sin(st.pitch), -Math.cos(st.yaw) * cp)
    const right = new THREE.Vector3(Math.cos(st.yaw), 0, -Math.sin(st.yaw))
    const dir = new THREE.Vector3()
    if (keys.has('KeyW') || keys.has('ArrowUp')) dir.add(fwd)
    if (keys.has('KeyS') || keys.has('ArrowDown')) dir.sub(fwd)
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dir.sub(right)
    if (keys.has('KeyD') || keys.has('ArrowRight')) dir.add(right)
    if (keys.has('Space')) dir.y += 0.95
    if (keys.has('KeyC')) dir.y -= 0.95

    const want = dir.lengthSq() > 0
    if (want) dir.normalize()
    const top = boost ? BOOST : slow ? SLOW : SPEED
    const target = dir.multiplyScalar(want ? top : 0)
    st.vel.lerp(target, 1 - Math.exp(-dt * (want ? 4.6 : 3.2)))

    const nx = st.pos.x + st.vel.x * dt
    const ny = st.pos.y + st.vel.y * dt
    const nz = st.pos.z + st.vel.z * dt
    const prevY = st.pos.y
    st.pos.set(nx, ny, nz)
    collide(dt, prevY)
    if (st.pos.x !== nx) st.vel.x *= 0.2
    if (st.pos.y !== ny) st.vel.y *= 0.2
    if (st.pos.z !== nz) st.vel.z *= 0.2

    st.speed = st.vel.length()
    st.turn += (shortAngle(st.lastYaw, st.yaw) / Math.max(dt, 0.001) - st.turn) * Math.min(1, dt * 8)
    st.lastYaw = st.yaw

    // 云体
    const g = cloud.group
    const bob = Math.sin(st.t * 1.9) * 0.07 + Math.sin(st.t * 3.3) * 0.03
    g.position.set(st.pos.x, st.pos.y + bob, st.pos.z)
    if (st.speed > 1.2) {
      const yaw = Math.atan2(-st.vel.x, -st.vel.z)
      g.rotation.y += shortAngle(g.rotation.y, yaw) * Math.min(1, dt * 7)
    }
    const bank = Math.max(-0.5, Math.min(0.5, -st.turn * 0.32))
    const pitchTilt = Math.max(-0.22, Math.min(0.22, -st.vel.y * 0.004))
    cloud.body.rotation.z += (bank - cloud.body.rotation.z) * Math.min(1, dt * 6)
    cloud.body.rotation.x += (pitchTilt - cloud.body.rotation.x) * Math.min(1, dt * 6)
    cloud.rider.rotation.z = cloud.body.rotation.z * 0.4
    cloud.core.rotation.y += dt * 0.06
    cloud.puffs.rotation.y -= dt * 0.12
    const flutter = Math.min(1, st.speed / 60)
    cloud.scarfL.rotation.x = 0.25 + flutter * 0.5 + Math.sin(st.t * 9) * (0.06 + flutter * 0.12)
    cloud.scarfR.rotation.x = 0.25 + flutter * 0.5 + Math.sin(st.t * 9 + 1.7) * (0.06 + flutter * 0.12)
    g.updateMatrixWorld()

    // 相机（避开楼体：焦点 → 相机连线上取最远的空点）
    const desired = new THREE.Vector3()
    const focus = new THREE.Vector3()
    desiredCam(desired, focus)
    st.cam.lerp(desired, 1 - Math.exp(-dt * 7))
    st.focus.lerp(focus, 1 - Math.exp(-dt * 11))
    {
      const seg = st.cam.clone().sub(st.focus)
      const len = seg.length()
      if (len > 0.5) {
        seg.divideScalar(len)
        const pool = gather(st.focus.x, st.focus.z).slice()
        for (const b of gather(desired.x, desired.z)) if (pool.indexOf(b) < 0) pool.push(b)
        const hit = (p) => {
          for (const b of pool) {
            if (p.x > b.x0 - 0.7 && p.x < b.x1 + 0.7 && p.z > b.z0 - 0.7 && p.z < b.z1 + 0.7 && p.y > b.y0 - 0.7 && p.y < b.y1 + 0.7) return true
          }
          return false
        }
        let safe = st.focus
        for (let i = 1; i <= 8; i++) {
          const p = st.focus.clone().addScaledVector(seg, (len * i) / 8)
          if (hit(p)) break
          safe = p
        }
        st.cam.copy(safe)
        if (st.cam.y < 2.4) st.cam.y = 2.4
      }
    }
    camera.position.copy(st.cam)
    camera.lookAt(st.focus)
    const targetFov = 36 + Math.max(0, Math.min(1, (st.speed - 46) / 120)) * 15
    if (Math.abs(camera.fov - targetFov) > 0.03) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4)
      camera.updateProjectionMatrix()
    }

    trail.uNight.value = nightOn ? 1 : 0
    trail.update(dt, st.t, g.matrixWorld, g, st.speed)

    hudAcc += dt
    if (hudAcc > 0.12) {
      hudAcc = 0
      if (speedEl) speedEl.textContent = `${Math.round(st.speed)} m/s · 海拔 ${Math.round(st.pos.y - CLOUD_LIFT)} m`
    }
    return true
  }

  return {
    update,
    enter,
    exit,
    setNight,
    get active() { return st.active },
    get position() { return st.pos },
  }
}
