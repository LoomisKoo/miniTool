import * as THREE from 'three'
import * as CANNON from 'cannon-es'

/** 程序生成 CS 风格粒子贴图 */
function makeSpriteTex(kind) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 60)
  if (kind === 'fire') {
    grd.addColorStop(0, 'rgba(255,255,230,1)')
    grd.addColorStop(0.18, 'rgba(255,200,60,0.95)')
    grd.addColorStop(0.45, 'rgba(255,90,20,0.7)')
    grd.addColorStop(0.75, 'rgba(120,20,0,0.25)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
  } else if (kind === 'smoke') {
    grd.addColorStop(0, 'rgba(90,85,80,0.75)')
    grd.addColorStop(0.4, 'rgba(55,50,48,0.5)')
    grd.addColorStop(0.75, 'rgba(30,28,26,0.2)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
  } else {
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.25, 'rgba(255,240,180,0.85)')
    grd.addColorStop(0.6, 'rgba(255,140,40,0.25)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
  }
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const TEX = {
  fire: makeSpriteTex('fire'),
  smoke: makeSpriteTex('smoke'),
  flash: makeSpriteTex('flash'),
}

export function makeGrenadeView() {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3d5c3a,
    roughness: 0.55,
    metalness: 0.35,
    emissive: 0x0e160e,
    emissiveIntensity: 0.15,
  })
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x8a9098,
    roughness: 0.35,
    metalness: 0.75,
    emissive: 0x1a1c1e,
    emissiveIntensity: 0.12,
  })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), bodyMat)
  body.scale.set(1, 1.15, 1)
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.008, 8, 20), metalMat)
  belt.rotation.x = Math.PI / 2
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.028, 12), metalMat)
  fuse.position.set(0, 0.072, 0)
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.04, 6), metalMat)
  pin.position.set(0, 0.075, 0)
  pin.rotation.x = Math.PI / 2
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0022, 6, 16), metalMat)
  ring.position.set(0.0, 0.075, 0.032)
  ring.rotation.y = Math.PI / 2
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.085, 0.006), metalMat)
  lever.position.set(-0.05, 0.03, 0)
  lever.rotation.z = -0.32
  g.add(body, belt, fuse, pin, ring, lever)
  g.userData.muzzle = new THREE.Vector3(0, 0.05, -0.1)
  return g
}

function makeWorldGrenadeMesh() {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d5c3a, roughness: 0.5, metalness: 0.35 })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.35, metalness: 0.7 })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), bodyMat)
  body.scale.set(1, 1.15, 1)
  body.castShadow = true
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 8, 16), metalMat)
  belt.rotation.x = Math.PI / 2
  g.add(body, belt)
  return g
}

function sprite(tex, color, size, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const s = new THREE.Sprite(mat)
  s.scale.set(size, size, 1)
  return s
}

function smokeSprite(size) {
  const mat = new THREE.SpriteMaterial({
    map: TEX.smoke,
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.NormalBlending,
  })
  const s = new THREE.Sprite(mat)
  s.scale.set(size, size, 1)
  return s
}

export function createGrenadeSystem(scene, world) {
  const live = []
  const fx = []

  function throwGrenade(origin, direction, fuse = 2.0) {
    const mesh = makeWorldGrenadeMesh()
    mesh.position.copy(origin)
    scene.add(mesh)

    const body = new CANNON.Body({
      mass: 0.45,
      shape: new CANNON.Sphere(0.07),
      position: new CANNON.Vec3(origin.x, origin.y, origin.z),
      linearDamping: 0.12,
      angularDamping: 0.2,
    })
    const speed = 9.5
    const dir = direction.clone().normalize()
    body.velocity.set(dir.x * speed, dir.y * speed + 2.8, dir.z * speed)
    body.angularVelocity.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 14,
    )
    world.addBody(body)

    live.push({
      mesh,
      body,
      born: performance.now(),
      fuse: fuse * 1000,
      exploded: false,
    })
  }

  /**
   * CS HE 手雷风格：
   * 瞬间白黄闪 → 橙黄火球快速膨胀 → 黑灰烟团上涌扩散 → 火星短促飞溅
   */
  function spawnExplosionFx(pos) {
    const group = new THREE.Group()
    group.position.copy(pos)
    scene.add(group)

    const light = new THREE.PointLight(0xffcc66, 35, 14)
    group.add(light)

    // 中心闪白
    const flash = sprite(TEX.flash, 0xffffff, 1.2, 1)
    group.add(flash)

    // 主火球（多层 sprite，模拟 CS 火团）
    const fires = []
    for (let i = 0; i < 6; i++) {
      const f = sprite(TEX.fire, i < 2 ? 0xffffff : 0xffaa44, 0.8 + i * 0.15, 0.95)
      f.position.set(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.2 + 0.15,
        (Math.random() - 0.5) * 0.3,
      )
      f.userData.phase = Math.random() * Math.PI * 2
      f.userData.grow = 2.2 + Math.random() * 1.8
      fires.push(f)
      group.add(f)
    }

    // 烟团：先贴地胀开，再上涌（CS 蘑菇烟感）
    const smokes = []
    for (let i = 0; i < 14; i++) {
      const s = smokeSprite(1.1 + Math.random() * 0.6)
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.3
      const rad = 0.15 + Math.random() * 0.35
      s.position.set(Math.cos(ang) * rad, 0.1 + Math.random() * 0.2, Math.sin(ang) * rad)
      s.material.color.setRGB(0.45 + Math.random() * 0.15, 0.42, 0.38)
      s.userData.vx = Math.cos(ang) * (0.8 + Math.random() * 1.4)
      s.userData.vz = Math.sin(ang) * (0.8 + Math.random() * 1.4)
      s.userData.vy = 1.2 + Math.random() * 1.8
      s.userData.grow = 2.5 + Math.random() * 2.2
      s.userData.delay = Math.random() * 0.08
      smokes.push(s)
      group.add(s)
    }
    // 中心升烟
    for (let i = 0; i < 6; i++) {
      const s = smokeSprite(1.4)
      s.position.set((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4)
      s.material.color.setRGB(0.35, 0.33, 0.3)
      s.userData.vx = (Math.random() - 0.5) * 0.6
      s.userData.vz = (Math.random() - 0.5) * 0.6
      s.userData.vy = 2.2 + Math.random() * 1.5
      s.userData.grow = 3.2
      s.userData.delay = 0.05 + i * 0.03
      smokes.push(s)
      group.add(s)
    }

    // 火星
    const sparkN = 40
    const sparkPos = new Float32Array(sparkN * 3)
    const sparkVel = []
    for (let i = 0; i < sparkN; i++) {
      sparkPos[i * 3] = 0
      sparkPos[i * 3 + 1] = 0.1
      sparkPos[i * 3 + 2] = 0
      sparkVel.push(
        new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.85 + 0.1, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(5 + Math.random() * 9),
      )
    }
    const sGeo = new THREE.BufferGeometry()
    sGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
    const sparks = new THREE.Points(
      sGeo,
      new THREE.PointsMaterial({
        color: 0xffcc66,
        size: 0.08,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        map: TEX.flash,
      }),
    )
    group.add(sparks)

    // 地面焦痕光环（很短）
    const scorch = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 1.2, 32),
      new THREE.MeshBasicMaterial({
        color: 0x1a120c,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    scorch.rotation.x = -Math.PI / 2
    scorch.position.y = 0.02
    group.add(scorch)

    fx.push({
      group,
      light,
      flash,
      fires,
      smokes,
      sparks,
      sparkVel,
      scorch,
      born: performance.now(),
      life: 1400,
    })
  }

  function explodeAt(pos, onBlast) {
    spawnExplosionFx(pos)
    onBlast?.(pos)
  }

  function update(now, dt, onBlast) {
    for (let i = live.length - 1; i >= 0; i--) {
      const g = live[i]
      g.mesh.position.copy(g.body.position)
      g.mesh.quaternion.copy(g.body.quaternion)
      if (!g.exploded && now - g.born >= g.fuse) {
        g.exploded = true
        const pos = new THREE.Vector3(g.body.position.x, g.body.position.y, g.body.position.z)
        scene.remove(g.mesh)
        world.removeBody(g.body)
        live.splice(i, 1)
        explodeAt(pos, onBlast)
      }
    }

    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]
      const age = now - f.born
      const t = age / f.life
      if (t >= 1) {
        scene.remove(f.group)
        f.flash.material.dispose()
        f.fires.forEach((x) => x.material.dispose())
        f.smokes.forEach((x) => x.material.dispose())
        f.sparks.geometry.dispose()
        f.sparks.material.dispose()
        f.scorch.geometry.dispose()
        f.scorch.material.dispose()
        fx.splice(i, 1)
        continue
      }

      // CS：前 ~120ms 强闪，火球在 ~350ms 内胀开并淡出，烟持续更久
      const flashK = Math.max(0, 1 - age / 100)
      f.light.intensity = 45 * flashK + 8 * Math.max(0, 1 - age / 400)
      f.light.color.setRGB(1, 0.75 + flashK * 0.25, 0.35 + flashK * 0.5)
      f.flash.scale.setScalar(1.2 + (1 - flashK) * 4.5)
      f.flash.material.opacity = flashK

      for (const fire of f.fires) {
        const ft = Math.min(1, age / 380)
        const s = 0.5 + ft * fire.userData.grow
        fire.scale.setScalar(s)
        fire.material.opacity = Math.max(0, (1 - ft) * (1 - ft) * 0.95)
        fire.position.y += dt * 0.6
        fire.material.rotation = fire.userData.phase + age * 0.002
      }

      for (const s of f.smokes) {
        const local = Math.max(0, age / 1000 - s.userData.delay)
        if (local <= 0) {
          s.visible = false
          continue
        }
        s.visible = true
        const st = Math.min(1, local / 1.15)
        s.position.x += s.userData.vx * dt
        s.position.z += s.userData.vz * dt
        s.position.y += s.userData.vy * dt
        s.userData.vy *= 0.985
        s.userData.vx *= 0.99
        s.userData.vz *= 0.99
        const sc = 0.8 + st * s.userData.grow
        s.scale.set(sc, sc * 0.9, 1)
        // 烟：先不透明，后半段淡出
        s.material.opacity = Math.max(0, st < 0.35 ? st / 0.35 * 0.8 : (1 - (st - 0.35) / 0.65) * 0.75)
      }

      const sp = f.sparks.geometry.attributes.position
      for (let j = 0; j < f.sparkVel.length; j++) {
        const v = f.sparkVel[j]
        v.y -= 16 * dt
        sp.setXYZ(j, sp.getX(j) + v.x * dt, sp.getY(j) + v.y * dt, sp.getZ(j) + v.z * dt)
      }
      sp.needsUpdate = true
      f.sparks.material.opacity = Math.max(0, 1 - age / 450)

      f.scorch.scale.setScalar(1 + Math.min(1, age / 200) * 1.8)
      f.scorch.material.opacity = Math.max(0, 0.5 * (1 - age / 900))
    }
  }

  function clear() {
    for (const g of live) {
      scene.remove(g.mesh)
      world.removeBody(g.body)
    }
    live.length = 0
    for (const f of fx) scene.remove(f.group)
    fx.length = 0
  }

  return { throwGrenade, update, clear, BLAST_RADIUS: 4.0 }
}
