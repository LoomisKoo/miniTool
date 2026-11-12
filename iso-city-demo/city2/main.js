import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { MeshBuilder, litMat } from './kit.js'
import { buildWorld } from './world.js'
import { buildLife } from './life.js'
import { makeInterior } from './interior.js'
import * as P from './plan.js'

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true })
const DPR = Math.min(window.devicePixelRatio, 2)
const shadowAt = { x: NaN, z: NaN, n: 0 }
// 自适应分辨率：最近 1 秒平均帧时间 > 22ms 降一档像素比，< 13ms 升一档（上限 DPR，下限 1）
let curDPR = 1
let accT = 0
let accN = 0
function adaptRes(dt) {
  accT += dt
  accN++
  if (accT < 1) return
  const avg = accT / accN
  accT = 0
  accN = 0
  let next = curDPR
  if (avg > 0.022 && curDPR > 1) next = Math.max(1, curDPR - 0.25)
  else if (avg < 0.013 && curDPR < DPR) next = Math.min(DPR, curDPR + 0.25)
  if (next === curDPR) return
  curDPR = next
  renderer.setPixelRatio(curDPR)
  composer.setPixelRatio(curDPR)
}
renderer.setPixelRatio(curDPR)
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
// 阴影贴图不再每帧重画：月光随玩家按 48m 网格跳动，跳格时才重画一次（城里会动的东西太小，影子不重要）
renderer.shadowMap.autoUpdate = false
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.92
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()

// 天空：cozy cyberpunk 夜空 —— 顶深蓝靛，地平线微紫，整体压暗让暖窗/霓虹跳出来
const skyTex = (() => {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 512
  const g = c.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 0, 512)
  gr.addColorStop(0, '#060814')
  gr.addColorStop(0.4, '#0c1230')
  gr.addColorStop(0.78, '#1a1848')
  gr.addColorStop(1, '#2a1858')
  g.fillStyle = gr
  g.fillRect(0, 0, 16, 512)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
scene.background = skyTex
const daySkyTex = (() => {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 512
  const g = c.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 0, 512)
  gr.addColorStop(0, '#3f86d6')
  gr.addColorStop(0.55, '#7fb6ea')
  gr.addColorStop(1, '#d6ecf7')
  g.fillStyle = gr
  g.fillRect(0, 0, 16, 512)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
scene.fog = new THREE.FogExp2('#0c1230', 0.002)

// IBL 环境光：把「天顶-地平线-地面」三段渐变贴到内翻球面上，PMREM 烘成环境贴图。
// 所有 PBR 材质（litMat）都会吃到这层柔和的环境反照 —— 穷人的 GI，
// 让墙面不再只有太阳一盏灯硬照，暗部也有天光/地面反弹的层次。
const pmrem = new THREE.PMREMGenerator(renderer)
const envCache = new Map()
function envFor(top, mid, bot) {
  const key = `${top}|${mid}|${bot}`
  const hit = envCache.get(key)
  if (hit) return hit
  const geo = new THREE.SphereGeometry(10, 32, 20)
  const p = geo.attributes.position
  const cols = new Float32Array(p.count * 3)
  const cTop = new THREE.Color(top)
  const cMid = new THREE.Color(mid)
  const cBot = new THREE.Color(bot)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) / 10 + 1) / 2 // 0 地面 → 1 天顶
    if (t < 0.5) c.copy(cBot).lerp(cMid, t / 0.5)
    else c.copy(cMid).lerp(cTop, (t - 0.5) / 0.5)
    cols[i * 3] = c.r
    cols[i * 3 + 1] = c.g
    cols[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  const s = new THREE.Scene()
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })))
  const rt = pmrem.fromScene(s, 0.04)
  geo.dispose()
  s.children[0].material.dispose()
  envCache.set(key, rt)
  return rt
}

// 对数深度缓冲 + 0.6/1600 的视锥：贴在墙面上的窗、地面上的标线不会再互相争深度
// 窄一点的视角：像「雨夜便利店」那样看小景，近处细节占满画面，而不是一片广角远景
// 远平面给到 16km：全局视野能拉得很远，楼不会被裁掉
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.6, 16000)

// cozy cyberpunk：环境光压暗偏靛蓝，靠月光拉开屋顶明暗，暖窗/霓虹自己发光
const hemi = new THREE.HemisphereLight('#6a6498', '#3a2e38', 0.88)
scene.add(hemi)
const sun = new THREE.DirectionalLight('#c0c4e8', 1.08)
sun.position.set(-55, 250, 190)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -160
sun.shadow.camera.right = 160
sun.shadow.camera.top = 160
sun.shadow.camera.bottom = -160
sun.shadow.camera.near = 20
sun.shadow.camera.far = 700
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.28
scene.add(sun)
scene.add(sun.target)

// 补光：反方向冷色弱光，只垫一点背光，别把暗部洗灰
const fill = new THREE.DirectionalLight('#6a7ab8', 0)
fill.position.set(140, 90, -180)
scene.add(fill)

// 构筑进度：每一步都换一行字，长任务期间界面不会像卡死
const loadEl = document.getElementById('loading')
const showProgress = (label, pct) => {
  if (!loadEl) return
  loadEl.textContent = `${label} · ${pct}%`
}
showProgress('规划路网与地块', 4)
const world = await buildWorld(scene, showProgress)
showProgress('街上的人与车', 97)
const life = buildLife(scene, world)
// 后期链默认的渲染目标没有 MSAA，renderer 的 antialias 在这里完全失效 —— 自己给一张 4x 多重采样的
const msaaRT = new THREE.WebGLRenderTarget(innerWidth * curDPR, innerHeight * curDPR, { type: THREE.HalfFloatType, samples: 2 })
const composer = new EffectComposer(renderer, msaaRT)
composer.addPass(new RenderPass(scene, camera))
// 泛光用半分辨率：走路时全分辨率 bloom 是掉帧的大头
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth * 0.5, innerHeight * 0.5), 0.55, 0.48, 0.88)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// ---------------------------------------------------------------- 主角
const toonOf = () => litMat({ roughness: 0.8 })
// 主角也用同一套描边，否则人和整座城市不是一个画风
const INK = new THREE.MeshBasicMaterial({ color: new THREE.Color('#171226'), side: THREE.BackSide, toneMapped: false })
const inked = (mb, mat, outline = 0.022) => {
  const m = new THREE.Mesh(mb.build(), mat)
  m.castShadow = true
  const hg = mb.buildHull()
  if (hg) m.add(new THREE.Mesh(hg, INK))
  return m
}

function buildHero() {
  const g = new THREE.Group()
  const mat = toonOf()

  // 躯干 + 头（一起合批，不摆）
  const body = new MeshBuilder(0.022)
  body.box(0.46, 0.6, 0.28, '#2b3a4e', 0, 1.16, 0, 0)
  body.box(0.48, 0.12, 0.3, '#1f2b3a', 0, 0.9, 0, 0)
  body.box(0.13, 0.13, 0.13, '#e2c3a4', 0, 1.6, 0, 0)
  body.box(0.26, 0.24, 0.24, '#e8c9a8', 0, 1.63, 0, 0)
  body.box(0.28, 0.11, 0.26, '#20242b', 0, 1.77, 0, 0)
  body.box(0.15, 0.05, 0.02, '#20242b', -0.06, 1.66, 0.13, 0)
  body.box(0.15, 0.05, 0.02, '#20242b', 0.06, 1.66, 0.13, 0)
  // 背包
  body.box(0.3, 0.34, 0.16, '#39485c', 0, 1.2, -0.2, 0)
  g.add(inked(body, mat))

  // 腿（髋关节为轴心，单独摆动）
  const legs = []
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(s * 0.12, 0.8, 0)
    const b = new MeshBuilder(0.02)
    b.box(0.15, 0.66, 0.17, '#28313d', 0, -0.35, 0, 0)
    b.box(0.16, 0.1, 0.26, '#15191f', 0, -0.72, 0.04, 0)
    pivot.add(inked(b, mat, 0.02))
    g.add(pivot)
    legs.push(pivot)
  }
  // 手臂
  const arms = []
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(s * 0.29, 1.4, 0)
    const b = new MeshBuilder(0.02)
    b.box(0.12, 0.56, 0.13, '#33445a', 0, -0.28, 0, 0)
    b.box(0.13, 0.12, 0.14, '#e8c9a8', 0, -0.6, 0, 0)
    pivot.add(inked(b, mat, 0.02))
    g.add(pivot)
    arms.push(pivot)
  }
  g.visible = false
  scene.add(g)
  return { group: g, legs, arms }
}
const hero = buildHero()

// ---------------------------------------------------------------- 筋斗云
// 参考「微光城市」：云是一只 metaball 融成的软云团（Marching Cubes 生成一次、
// 合并顶点后是连续曲面），脚下还会吐出一路会散开的水汽。不是几个球摞起来。
const CLOUD_BLOBS = [
  [-0.34, 0.0, 0.0, 0.3], [0.34, 0.0, 0.0, 0.3], [0.0, 0.04, 0.0, 0.34],
  [-0.16, 0.2, 0.06, 0.22], [0.18, 0.19, -0.04, 0.21], [0.02, 0.14, 0.22, 0.2],
  [0.04, 0.0, 0.34, 0.24], [-0.26, -0.01, 0.26, 0.2], [-0.06, 0.03, -0.32, 0.22],
  [0.26, -0.01, -0.24, 0.19], [-0.56, -0.03, 0.06, 0.16], [0.56, -0.04, -0.02, 0.16],
  [0.0, -0.1, 0.0, 0.32], [-0.28, -0.09, 0.04, 0.22], [0.28, -0.09, 0.02, 0.22],
]

let cloudGeoCache = null
function cloudGeometry() {
  if (cloudGeoCache) return cloudGeoCache
  const RES = 44
  const mc = new MarchingCubes(RES, new THREE.MeshBasicMaterial(), false, false, 20000)
  mc.isolation = 0.06
  mc.reset()
  for (const [x, y, z, r] of CLOUD_BLOBS) mc.addBall((x + 1) / 2, (y + 1) / 2, (z + 1) / 2, (r / 2) ** 2, 1)
  mc.update()
  const verts = mc.count
  const src = mc.geometry.getAttribute('position').array
  const raw = new THREE.BufferGeometry()
  raw.setAttribute('position', new THREE.BufferAttribute(src.slice(0, verts * 3), 3))
  // 合并重复顶点：平滑法线要靠共享顶点，否则一颗颗三角面会闪
  const geo = mergeVertices(raw, 1e-4)
  raw.dispose()
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const c = new THREE.Vector3()
  const sz = new THREE.Vector3()
  bb.getCenter(c)
  bb.getSize(sz)
  geo.translate(-c.x, -c.y, -c.z)
  const k = 2.5 / Math.max(sz.x, 1e-3)
  geo.scale(k, k * 0.62, k)
  geo.computeBoundingSphere()
  mc.geometry.dispose()
  mc.material.dispose()
  cloudGeoCache = geo
  return geo
}

// 水汽：几颗高斯斑叠出来的软边贴图，一块面向镜头的公告板
const PUFF_COUNT = 96
const puffTex = (() => {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const blobs = [[0.5, 0.52, 0.34, 0.9], [0.36, 0.56, 0.22, 0.7], [0.64, 0.58, 0.22, 0.7], [0.47, 0.4, 0.2, 0.62], [0.58, 0.42, 0.17, 0.55], [0.3, 0.46, 0.14, 0.45], [0.7, 0.48, 0.14, 0.45]]
  for (const [x, y, r, a] of blobs) {
    const gr = g.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s)
    gr.addColorStop(0, `rgba(255,255,255,${a})`)
    gr.addColorStop(0.55, `rgba(255,255,255,${a * 0.42})`)
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, s, s)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

function buildCloud() {
  const g = new THREE.Group()
  const body = new THREE.Group()
  const shell = new THREE.Mesh(
    cloudGeometry(),
    new THREE.MeshStandardMaterial({ color: '#e8edf4', roughness: 0.98, metalness: 0, emissive: '#cfe4f4', emissiveIntensity: 0.07, transparent: true })
  )
  shell.frustumCulled = false
  body.add(shell)
  g.add(body)
  // 云底一层柔光，夜里像踩着光
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 24),
    new THREE.MeshBasicMaterial({ color: '#9fc0e8', transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.y = -0.16
  g.add(halo)

  // 水汽：InstancedMesh + 自定义着色器，一次画完
  const pg = new THREE.PlaneGeometry(1, 1)
  pg.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(PUFF_COUNT), 1))
  pg.setAttribute('aSpin', new THREE.InstancedBufferAttribute(new Float32Array(PUFF_COUNT), 1))
  const pm = new THREE.ShaderMaterial({
    uniforms: { map: { value: puffTex }, uTop: { value: new THREE.Color('#eef5ff') }, uBottom: { value: new THREE.Color('#b6c8e0') } },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aSpin;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        vUv = uv;
        vAlpha = aAlpha;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float s = length(instanceMatrix[0].xyz);
        float c = cos(aSpin);
        float n = sin(aSpin);
        vec2 p = vec2(position.x * c - position.y * n, position.x * n + position.y * c);
        center.xy += p * s;
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 uTop;
      uniform vec3 uBottom;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float a = texture2D(map, vUv).a * vAlpha;
        if (a < 0.004) discard;
        vec3 col = mix(uBottom, uTop, smoothstep(0.15, 0.85, vUv.y));
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
  })
  const puffs = new THREE.InstancedMesh(pg, pm, PUFF_COUNT)
  puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  puffs.frustumCulled = false
  puffs.count = 0
  scene.add(puffs) // 水汽在世界坐标里，不能挂在会转动的云上

  g.visible = false
  scene.add(g)

  const list = Array.from({ length: PUFF_COUNT }, () => ({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    age: 0,
    life: 1,
    s0: 1,
    s1: 1,
    a0: 0,
    spin: 0,
    spinRate: 0,
    alive: false,
  }))
  const _m = new THREE.Matrix4()
  const _q = new THREE.Quaternion()
  const _s = new THREE.Vector3()
  const anchor = new THREE.Vector3()
  const last = new THREE.Vector3()
  const dir = new THREE.Vector3()
  let travelled = 0
  let hasLast = false
  let idle = 0

  const spawn = (speed, still, at) => {
    let p = null
    for (const q of list) if (!q.alive) { p = q; break }
    if (!p) {
      for (const q of list) if (!p || q.age / q.life > p.age / p.life) p = q
    }
    const jit = still ? 0.4 : 0.2 + speed * 0.12
    p.pos.copy(at)
    if (!still) p.pos.addScaledVector(dir, -0.55)
    p.pos.x += (Math.random() - 0.5) * jit * 2
    p.pos.y += (Math.random() - 0.5) * 0.1 - (still ? 0.12 : 0.05)
    p.pos.z += (Math.random() - 0.5) * jit * 2
    if (still) p.vel.set((Math.random() - 0.5) * 0.1, -0.15 - Math.random() * 0.08, (Math.random() - 0.5) * 0.1)
    else p.vel.set((Math.random() - 0.5) * 0.24, 0.04 + Math.random() * 0.06, (Math.random() - 0.5) * 0.24).addScaledVector(dir, -0.14)
    p.age = 0
    p.life = still ? 0.9 + Math.random() * 0.4 : 0.7 + Math.random() * 0.3 + speed * 0.3
    p.s0 = still ? 0.34 + Math.random() * 0.14 : 0.4 + Math.random() * 0.14
    p.s1 = still ? 0.72 + Math.random() * 0.24 : 0.9 + Math.random() * 0.3 + speed * 0.3
    p.a0 = still ? 0.13 : 0.1 + speed * 0.05
    p.spin = Math.random() * Math.PI * 2
    p.spinRate = (Math.random() - 0.5) * 0.8
    p.alive = true
  }

  return {
    group: g,
    body,
    halo,
    update(dt, time, px, py, pz, moving) {
      if (!g.visible) {
        hasLast = false
        travelled = 0
        puffs.count = 0
        return
      }
      // 云体缓慢呼吸 + 微微侧倾，静止时也是活的
      const breathe = 1 + Math.sin(time * 2.1) * 0.025
      body.scale.set(breathe, 1 / breathe, breathe)
      body.rotation.z = Math.sin(time * 1.3) * 0.04
      g.position.set(px, py - 0.3 + Math.sin(time * 1.6) * 0.07, pz)
      g.rotation.y += dt * 0.16

      anchor.set(px, py - 0.34, pz)
      const speed = moving ? 0.55 : 0
      dir.set(player.x - last.x, 0, player.z - last.z)
      const step = hasLast ? dir.length() : 0
      if (step > 1e-4) dir.divideScalar(step)
      if (!hasLast || step > 6) travelled = 0
      else if (step > 0.004) travelled += step
      let n = 0
      while (travelled > 0.12 && n < 8) {
        travelled -= 0.12
        spawn(speed, false, anchor)
        n++
      }
      if (travelled > 0.12) travelled = 0
      if (step < 0.004) {
        idle += dt
        if (idle > 0.42) {
          idle = 0
          spawn(0, true, anchor)
        }
      }
      last.set(player.x, 0, player.z)
      hasLast = true

      const alpha = pg.getAttribute('aAlpha')
      const spin = pg.getAttribute('aSpin')
      let c = 0
      for (const p of list) {
        if (!p.alive) continue
        p.age += dt
        const k = p.age / p.life
        if (k >= 1) { p.alive = false; continue }
        p.vel.multiplyScalar(Math.exp(-2.2 * dt))
        p.vel.y += 0.05 * dt
        p.pos.addScaledVector(p.vel, dt)
        p.spin += p.spinRate * dt
        const grow = 1 - Math.pow(1 - k, 2.2)
        _s.setScalar(p.s0 + (p.s1 - p.s0) * grow)
        _m.compose(p.pos, _q, _s)
        puffs.setMatrixAt(c, _m)
        alpha.setX(c, Math.min(1, k / 0.08) * Math.pow(1 - k, 1.8) * p.a0)
        spin.setX(c, p.spin)
        c++
      }
      puffs.count = c
      puffs.instanceMatrix.needsUpdate = true
      alpha.needsUpdate = true
      spin.needsUpdate = true
    },
  }
}
const cloudRig = buildCloud()
const cloud = cloudRig.group

// ---------------------------------------------------------------- 状态
const player = {
  x: -14,
  z: 30,
  y: 0,
  // 出生点朝东北看：镜头正对 CBD 塔楼群，一进城市就有天际线
  yaw: -0.88,
  pitch: 0.32,
  dist: 14,
  face: -0.88 + Math.PI,
  inside: null,
  onCloud: false,
  over: false,
  vy: 0,
  moving: 0,
  spd: 0,            // 地面速度（m/s），带加减速
  dirX: 0,
  dirZ: 1,
  gait: 0,           // 步态相位：按实际速度推进，跑得快腿摆得快
  air: false,        // 离地（跳跃/滑翔/下落）
  glide: false,      // 张伞滑翔中
  jumpLock: 0,
}
let dragging = false
let lastX = 0
let lastY = 0
const keys = new Set()

let currentLook = { fog: 0.0022 }
const vignetteEl = document.getElementById('vignette')
const promptEl = document.getElementById('prompt')
const indoorEl = document.getElementById('indoor')
const titleEl = document.getElementById('title')
const modeEl = document.getElementById('mode')
let prompt = null

function setMode(text) {
  if (!modeEl) return
  if (!text) {
    modeEl.hidden = true
    return
  }
  modeEl.textContent = text
  modeEl.hidden = false
}

addEventListener('keydown', (e) => {
  const first = !keys.has(e.code)
  keys.add(e.code)
  if (e.code === 'KeyE') interact()
  if (e.code === 'Escape' && player.inside) exitRoom()
  if (first && e.code === 'KeyV') toggleOverview()
  if (first && e.code === 'KeyF') toggleCloud()
  // 空格：地面上是跳跃，空中按住是滑翔
  if (first && e.code === 'Space' && !player.inside && !player.over) {
    if (!player.air && !player.onCloud) jump()
    else if (player.air) player.glide = true
  }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) e.preventDefault()
})
addEventListener('keyup', (e) => {
  keys.delete(e.code)
  if (e.code === 'Space') player.glide = false
})

const cv = renderer.domElement
cv.addEventListener('pointerdown', (e) => {
  dragging = true
  lastX = e.clientX
  lastY = e.clientY
  cv.setPointerCapture(e.pointerId)
})
cv.addEventListener('pointerup', (e) => {
  dragging = false
  try {
    cv.releasePointerCapture(e.pointerId)
  } catch (err) {}
})
cv.addEventListener('pointermove', (e) => {
  if (!dragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  if (player.over) {
    player.yaw -= dx * 0.003
    player.pitch = P.clamp(player.pitch + dy * 0.0022, 0.25, 1.5)
    return
  }
  player.yaw -= dx * 0.0045
  player.pitch = P.clamp(player.pitch + dy * 0.0035, -0.18, 1.32)
})
// 滚轮：指数缩放，一格明显拉近/拉远；[ ] 键再给一档瞬移式远近
cv.addEventListener(
  'wheel',
  (e) => {
    // 一格滚轮只给 6%（触控板的细碎 deltaY 也不会一次跳很远），距离越远步长越保守
    const step = Math.min(Math.abs(e.deltaY), 120) / 120
    const k = Math.pow(e.deltaY > 0 ? 1.075 : 1 / 1.075, step)
    if (player.over) player.dist = P.clamp(player.dist * k, 700, 9000)
    else player.dist = P.clamp(player.dist * k, 2.4, 1100)
    e.preventDefault()
  },
  { passive: false }
)

let overSaved = null
function toggleOverview() {
  if (player.inside) return
  player.over = !player.over
  if (player.over) {
    overSaved = { yaw: player.yaw, pitch: player.pitch, dist: player.dist }
    player.dist = 2600
    smoothDist = player.dist
    player.pitch = 0.62
    setMode('全局视野 · V 返回 · 滚轮升降')
    hero.group.visible = false
    cloud.visible = false
    if (vignetteEl) vignetteEl.style.opacity = '0'
  } else {
    if (overSaved) {
      player.yaw = overSaved.yaw
      player.pitch = overSaved.pitch
      player.dist = overSaved.dist
      smoothDist = player.dist
    }
    if (vignetteEl) vignetteEl.style.opacity = String(currentLook.vignette ?? 1)
    setMode(player.onCloud ? '筋斗云 · F 落地' : player.air ? (player.glide ? '滑翔中' : '空中') : '')
  }
}

/** 起跳：地面按空格。 */
function jump() {
  if (player.air) return
  player.air = true
  player.vy = 10.2
}

function toggleCloud() {
  if (player.inside || player.over) return
  if (!player.onCloud) {
    player.onCloud = true
    player.air = true
    player.glide = false
    player.vy = 0
    // 原地起飞：云在脚下长出来，人的高度保持不变（自己按空格才升）
    const base = standY(player.x, player.z, player.y)
    player.y = Math.max(player.y, base)
    setMode('筋斗云 · 空格上升 · C 下降 · F 收起')
  } else {
    // 空中取消：云散开，直接落下去（按住空格才滑翔）
    player.onCloud = false
    player.glide = false
    player.air = true
    player.vy = Math.min(player.vy, -18)
    setMode('空中 · 按住空格滑翔')
  }
}

function nearestDoor() {
  if (player.inside) return null
  let best = null
  let bd = 5.2
  for (const d of world.doors) {
    const dist = Math.hypot(d.x - player.x, d.z - player.z)
    if (dist < bd) {
      bd = dist
      best = d
    }
  }
  return best
}

let room = null
let saved = null
function interact() {
  if (player.inside) {
    exitRoom()
    return
  }
  if (player.over) return
  const d = nearestDoor()
  if (!d) return
  const kind =
    d.kind === 'metro' || d.kind === 'station'
      ? 'metro'
      : d.kind === 'mall'
        ? 'mall'
        : d.kind === 'office' || d.kind === 'civic'
          ? 'office'
          : 'store'
  room = makeInterior(kind, d.name)
  scene.add(room.group)
  saved = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch, dist: player.dist, cloud: player.onCloud }
  player.inside = d
  player.onCloud = false
  cloud.visible = false
  player.x = room.spawn[0]
  player.z = room.spawn[2]
  player.y = room.spawn[1]
  player.yaw = 0
  player.pitch = 0.06
  player.dist = 0
  hero.group.visible = false
  indoorEl.textContent = d.name
  indoorEl.hidden = false
  if (titleEl) titleEl.hidden = true
  setMode('')
}

function exitRoom() {
  if (!player.inside) return
  scene.remove(room.group)
  const d = player.inside
  room = null
  player.inside = null
  player.x = (saved ? saved.x : d.x) + 0.9
  player.z = (saved ? saved.z : d.z) + 0.9
  player.yaw = saved ? saved.yaw : 0
  player.pitch = saved ? saved.pitch : 0.3
  player.dist = saved ? saved.dist : 9
  player.y = P.groundY(player.x, player.z)
  hero.group.visible = true
  indoorEl.hidden = true
  if (titleEl) titleEl.hidden = false
}

const looks = {
  night: {
    bg: skyTex,
    fog: 0.0017,
    fogCol: '#18142e',
    // 夜巷城市：环境光略暖，砖/米色墙还能读色，不是冷灰厂房
    hemi: 0.88,
    hemiCol: '#6a6498',
    hemiGnd: '#3a2e38',
    sun: 1.08,
    fill: 0.3,
    sunCol: '#c0c4e8',
    exposure: 0.94,
    bloom: 0.58,
    wet: 0.78,
    rain: false,
    night: true,
    vignette: 0.95,
    env: ['#0c1230', '#2a3870', '#14101e'],
    envSolid: 1.15,
    envGlass: 1.4,
  },
  day: {
    bg: daySkyTex,
    // 白天略加雾：远景收进大气里，俯视边缘不像沙盘底板
    fog: 0.00055,
    fogCol: '#b8d0e4',
    hemi: 1.05,
    hemiCol: '#d4e4f4',
    hemiGnd: '#7a7068',
    sun: 1.65,
    fill: 0.45,
    sunCol: '#fff1d6',
    exposure: 0.88,
    bloom: 0.03,
    wet: 0.12,
    rain: false,
    night: false,
    vignette: 0.22,
    env: ['#4a88c8', '#d0e4f4', '#6a5a48'],
    envSolid: 1.05,
    envGlass: 1.35,
  },
  rain: {
    bg: skyTex,
    fog: 0.0024,
    fogCol: '#10163a',
    hemi: 0.75,
    hemiCol: '#4a5690',
    hemiGnd: '#2a2438',
    sun: 1.05,
    fill: 0.24,
    sunCol: '#a8b8e0',
    exposure: 0.9,
    bloom: 0.52,
    wet: 0.9,
    rain: true,
    night: true,
    vignette: 0.92,
    env: ['#0c1230', '#283868', '#14101e'],
    envSolid: 1.1,
    envGlass: 1.35,
  },
}

function setLook(name) {
  const L = looks[name]
  currentLook = L
  scene.background = L.bg.isTexture ? L.bg : new THREE.Color(L.bg)
  scene.fog = new THREE.FogExp2(L.fogCol, player.over ? 0.00035 : L.fog)
  hemi.intensity = L.hemi
  hemi.color = new THREE.Color(L.hemiCol)
  hemi.groundColor = new THREE.Color(L.hemiGnd)
  sun.intensity = L.sun
  sun.color = new THREE.Color(L.sunCol)
  fill.intensity = L.fill || 0
  renderer.toneMappingExposure = L.exposure
  bloom.strength = L.bloom
  life.state.rainOn = L.rain
  life.state.night = L.night
  // 白天：窗灯等 dayHide 材质直接透明（露出统一玻璃底），其余自发光乘 day 系数
  for (const e of world.nightMats) {
    if (e.mat.userData.dayHide) {
      e.mat.color.copy(e.base)
      e.mat.opacity = L.night ? 1 : 0
      e.mat.depthWrite = !!L.night
      e.mat.visible = true
    } else {
      e.mat.color.copy(e.base).multiplyScalar(L.night ? 1 : e.day)
    }
  }
  scene.environment = envFor(...L.env).texture
  if (world.solidMat) world.solidMat.envMapIntensity = L.envSolid ?? 0.9
  if (world.glassMat) world.glassMat.envMapIntensity = L.envGlass ?? 1.15
  if (vignetteEl && !player.over) vignetteEl.style.opacity = String(L.vignette ?? 1)
  if (world.wetMat) world.wetMat.opacity = L.wet
  for (const el of document.querySelectorAll('[data-look]')) el.classList.toggle('on', el.dataset.look === name)
}
for (const el of document.querySelectorAll('[data-look]')) el.addEventListener('click', () => setLook(el.dataset.look))
setLook('night')

/** 带高度判断的碰撞：人站在楼顶以上时不再被这栋楼挡住。 */
function collideHeight(nx, nz, y) {
  const r = 0.55
  let x = nx
  let z = nz
  for (const c of world.colliders) {
    if (y > c.y - 0.6) continue
    const hw = c.w / 2 + r
    const hd = c.d / 2 + r
    if (Math.abs(x - c.x) < hw && Math.abs(z - c.z) < hd) {
      const dx = hw - Math.abs(x - c.x)
      const dz = hd - Math.abs(z - c.z)
      if (dx < dz) x = c.x + Math.sign(x - c.x || 1) * hw
      else z = c.z + Math.sign(z - c.z || 1) * hd
    }
  }
  return [x, z]
}

/** 脚下能踩住的最高面（地形 / 楼顶）。y 是当前高度，比它高的屋顶不算。 */
function standY(x, z, y) {
  let h = P.groundY(x, z)
  for (const c of world.colliders) {
    if (Math.abs(x - c.x) > c.w / 2 || Math.abs(z - c.z) > c.d / 2) continue
    if (c.y > h && c.y <= y + 0.35) h = c.y
  }
  return h
}

function collide(nx, nz) {
  const r = 0.55
  let x = nx
  let z = nz
  for (const c of world.colliders) {
    const hw = c.w / 2 + r
    const hd = c.d / 2 + r
    if (Math.abs(x - c.x) < hw && Math.abs(z - c.z) < hd) {
      const dx = hw - Math.abs(x - c.x)
      const dz = hd - Math.abs(z - c.z)
      if (dx < dz) x = c.x + Math.sign(x - c.x || 1) * hw
      else z = c.z + Math.sign(z - c.z || 1) * hd
    }
  }
  return [x, z]
}

const tmp = new THREE.Vector3()
let t0 = performance.now()
let time = 0
// 距离做轻微阻尼：滚轮推一下是「滑过去」，而不是跳一下
let smoothDist = player.dist
let camFit = 1

/** 镜头到人的线段被楼挡住时，返回能看到人的那段比例（相机收到墙的这一侧）。 */
function camClear(px, py, pz, cx, cy, cz) {
  const dx = cx - px
  const dy = cy - py
  const dz = cz - pz
  let t = 1
  const pad = 0.15
  for (const c of world.colliders) {
    const x0 = c.x - c.w / 2 - pad
    const x1 = c.x + c.w / 2 + pad
    const y0 = -4
    const y1 = c.y + 0.8
    const z0 = c.z - c.d / 2 - pad
    const z1 = c.z + c.d / 2 + pad
    let t0 = 0
    let t1 = t
    let hit = true
    const slabs = [
      [dx, px, x0, x1],
      [dy, py, y0, y1],
      [dz, pz, z0, z1],
    ]
    for (let i = 0; i < 3; i++) {
      const d = slabs[i][0]
      const o = slabs[i][1]
      let a = slabs[i][2]
      let b = slabs[i][3]
      if (Math.abs(d) < 1e-7) {
        if (o < a || o > b) hit = false
        continue
      }
      let ta = (a - o) / d
      let tb = (b - o) / d
      if (ta > tb) {
        const s = ta
        ta = tb
        tb = s
      }
      if (ta > t0) t0 = ta
      if (tb < t1) t1 = tb
      if (t0 > t1) hit = false
    }
    // 人站在盒子里（贴墙）不算挡住；只在射线真正穿入楼体时把相机收到这一侧墙面
    if (hit && t0 > 0.001 && t0 < t) t = t0 * 0.96
  }
  return t
}

/** 相机射线与建筑 AABB 求交，避免相机钻进楼里。 */
function rayHit(px, pz, dx, dz, c, pad) {
  const hw = c.w / 2 + pad
  const hd = c.d / 2 + pad
  let tmin = 0
  let tmax = 1e9
  if (Math.abs(dx) < 1e-6) {
    if (px < c.x - hw || px > c.x + hw) return Infinity
  } else {
    let t1 = (c.x - hw - px) / dx
    let t2 = (c.x + hw - px) / dx
    if (t1 > t2) {
      const s = t1
      t1 = t2
      t2 = s
    }
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
  }
  if (Math.abs(dz) < 1e-6) {
    if (pz < c.z - hd || pz > c.z + hd) return Infinity
  } else {
    let t1 = (c.z - hd - pz) / dz
    let t2 = (c.z + hd - pz) / dz
    if (t1 > t2) {
      const s = t1
      t1 = t2
      t2 = s
    }
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
  }
  return tmax >= tmin ? tmin : Infinity
}

function shortAngle(a, b) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

function frame() {
  const now = performance.now()
  const dt = Math.min(0.05, (now - t0) / 1000)
  t0 = now
  time += dt

  if (!player.over) {
    if (keys.has('BracketRight') || keys.has('Equal')) player.dist = P.clamp(player.dist * (1 - dt * 1.6), 2.4, 1100)
    if (keys.has('BracketLeft') || keys.has('Minus')) player.dist = P.clamp(player.dist * (1 + dt * 1.6), 2.4, 1100)
  }

  if (!player.inside) {
    const fwdX = -Math.sin(player.yaw)
    const fwdZ = -Math.cos(player.yaw)
    const rgtX = Math.cos(player.yaw)
    const rgtZ = -Math.sin(player.yaw)
    let mx = 0
    let mz = 0
    if (keys.has('KeyW')) {
      mx += fwdX
      mz += fwdZ
    }
    if (keys.has('KeyS')) {
      mx -= fwdX
      mz -= fwdZ
    }
    if (keys.has('KeyD')) {
      mx += rgtX
      mz += rgtZ
    }
    if (keys.has('KeyA')) {
      mx -= rgtX
      mz -= rgtZ
    }
    const len = Math.hypot(mx, mz)
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const ground = P.groundY(player.x, player.z)

    if (len > 0 && !player.over) {
      mx /= len
      mz /= len
      player.face += shortAngle(player.face, Math.atan2(mx, mz)) * Math.min(1, dt * 12)
      if (player.onCloud) {
        const sp = (running ? 78 : 38) * dt
        // 云也是刚体：撞楼时只沿墙滑，不会穿过去
        const [x, z] = collideHeight(player.x + mx * sp, player.z + mz * sp, player.y)
        player.x = P.clamp(x, P.LIMITS.x0 - 14, P.LIMITS.x1 + 14)
        player.z = P.clamp(z, P.LIMITS.z0 - 14, P.LIMITS.z1 + 12)
      } else if (player.glide || player.air) {
        const sp = (player.glide ? (running ? 19 : 12) : 5.0) * dt
        const [x, z] = collideHeight(player.x + mx * sp, player.z + mz * sp, player.y)
        player.x = P.clamp(x, P.LIMITS.x0, P.LIMITS.x1)
        player.z = P.clamp(z, P.LIMITS.z0, P.LIMITS.z1)
      } else {
        // 3A 式移动：默认慢跑 8m/s，Shift 冲刺 17m/s；速度带加速度，起步有冲劲、松手有惯性
        const want = running ? 17 : 8
        player.spd += (want - player.spd) * Math.min(1, dt * (want > player.spd ? 4.5 : 6))
        player.dirX = mx
        player.dirZ = mz
      }
      player.moving = Math.min(1, player.moving + dt * 6)
    } else {
      player.moving = Math.max(0, player.moving - dt * 6)
    }
    if (!player.onCloud && !player.glide && !player.air && !player.over) {
      if (!(len > 0)) player.spd = Math.max(0, player.spd - dt * 38)
      if (player.spd > 0.01) {
        const sp = player.spd * dt
        const [x, z] = collideHeight(player.x + player.dirX * sp, player.z + player.dirZ * sp, player.y)
        player.x = P.clamp(x, P.LIMITS.x0, P.LIMITS.x1)
        player.z = P.clamp(z, P.LIMITS.z0, P.LIMITS.z1)
      }
    } else if (player.air && !player.glide && !player.onCloud) {
      // 起跳保留地面速度：冲刺起跳能跳得远
      const sp = player.spd * 0.85 * dt
      const [x, z] = collideHeight(player.x + player.dirX * sp, player.z + player.dirZ * sp, player.y)
      player.x = P.clamp(x, P.LIMITS.x0, P.LIMITS.x1)
      player.z = P.clamp(z, P.LIMITS.z0, P.LIMITS.z1)
    } else player.spd = 0

    if (player.onCloud) {
      const g2 = standY(player.x, player.z, player.y)
      // Shift 升降也加速（原先只有水平加速）
      const vSp = (running ? 52 : 26) * dt
      if (keys.has('Space')) player.y += vSp
      if (keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight')) player.y -= vSp
      player.y = Math.max(g2 + 0.02, player.y)
      if (player.y > g2 + 300) player.y = g2 + 300
      player.vy = 0
      player.air = true
    } else if (player.air) {
      // 上升仍用原来的重力，免得跳一下就掉回去；下坠单独加重，接近自由落体
      player.vy -= (player.glide ? 4.2 : player.vy < 2 ? 78 : 34) * dt
      if (player.glide && keys.has('Space')) player.vy = Math.min(player.vy + 22 * dt, -1.4)
      player.vy = Math.max(player.vy, player.glide ? -7.5 : -120)
      const land = standY(player.x, player.z, player.y)
      const ny = player.y + player.vy * dt
      if (ny <= land + 0.02) {
        player.y = land
        player.vy = 0
        player.air = false
        player.glide = false
        hero.group.rotation.x = 0
        setMode('')
      } else {
        player.y = ny
      }
    } else if (player.y - standY(player.x, player.z, player.y) > 0.7) {
      // 脚下真的空了（走出楼沿 / 屋顶边）：立刻交给重力，别慢悠悠飘下去。
      // 用 standY 而不是地形高度：站在屋顶上时地形本来就在下面，那不是「悬空」
      player.air = true
      player.vy = -12
    } else {
      player.y += (ground - player.y) * Math.min(1, dt * 14)
    }

    cloud.visible = player.onCloud && !player.over
    cloudRig.update(dt, time, player.x, player.y, player.z, player.moving > 0.2)
    hero.group.visible = !player.over
    hero.group.position.set(player.x, player.y, player.z)
    hero.group.rotation.y = player.face
    player.gait += dt * (4 + player.spd * 0.75)
    const swing = Math.sin(player.gait) * Math.min(1.05, 0.35 + player.spd * 0.045) * player.moving
    // 速度感只靠步幅 + 视角张开：整个人不前倾（前倾会让人看起来是「歪」的）
    // 全局视野用长焦：近似等轴测，楼不再透视发散，整座城像一块完整的街区
    const wantFov = player.over ? 15 : 40 + Math.max(0, player.spd - 8) * 0.55
    if (Math.abs(camera.fov - wantFov) > 0.05) {
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 5)
      camera.updateProjectionMatrix()
    }
    hero.legs[0].rotation.x = swing
    hero.legs[1].rotation.x = -swing
    hero.arms[0].rotation.x = -swing * 0.8
    hero.arms[1].rotation.x = swing * 0.8
    if (player.onCloud) {
      for (const l of hero.legs) l.rotation.x = 0.25
      hero.legs[0].rotation.z = 0.1
    } else if (player.glide) {
      // 滑翔：双臂张开、身体略前倾
      for (const l of hero.legs) l.rotation.x = -0.35
      hero.arms[0].rotation.z = 1.15
      hero.arms[1].rotation.z = -1.15
      hero.arms[0].rotation.x = 0
      hero.arms[1].rotation.x = 0
      hero.legs[0].rotation.z = 0
      hero.group.rotation.x = 0
    } else if (player.air) {
      for (const l of hero.legs) l.rotation.x = -0.5
      hero.arms[0].rotation.z = 0
      hero.arms[1].rotation.z = 0
      hero.legs[0].rotation.z = 0
      hero.group.rotation.x = 0
    } else {
      hero.legs[0].rotation.z = 0
      hero.arms[0].rotation.z = 0
      hero.arms[1].rotation.z = 0
      hero.group.rotation.x = 0
    }

    prompt = player.over || player.air ? null : nearestDoor()
    if (prompt) {
      promptEl.textContent = 'E · 进入 ' + prompt.name
      promptEl.hidden = false
    } else promptEl.hidden = true
  } else {
    const fwdX = -Math.sin(player.yaw)
    const fwdZ = -Math.cos(player.yaw)
    const sp = 3.4 * dt
    if (keys.has('KeyW')) player.z += fwdZ * sp
    if (keys.has('KeyS')) player.z -= fwdZ * sp
    if (keys.has('KeyA')) player.x -= sp
    if (keys.has('KeyD')) player.x += sp
    player.x = P.clamp(player.x, -12, 12)
    player.z = P.clamp(player.z, -9, 9)
    promptEl.textContent = 'E · 离开'
    promptEl.hidden = false
  }

  // 距离阻尼（滚轮是目标值，相机平滑追上去）
  smoothDist += (player.dist - smoothDist) * Math.min(1, dt * 12)
  if (Math.abs(smoothDist - player.dist) < 0.01) smoothDist = player.dist

  const cy = Math.cos(player.pitch)
  if (player.over) {
    const d = player.dist
    // 绕玩家所在片区转：想去城市另一头就走过去再按 V
    const cx = player.x * 0.55
    const cz = player.z * 0.55
    camera.position.set(
      cx + Math.sin(player.yaw) * Math.cos(player.pitch) * d,
      Math.sin(player.pitch) * d + 40,
      cz + Math.cos(player.yaw) * Math.cos(player.pitch) * d
    )
    camera.lookAt(cx, 20, cz)
  } else {
    const ox = Math.sin(player.yaw) * cy
    const oz = Math.cos(player.yaw) * cy
    // 滚轮决定想要的距离；楼挡在镜头和人之间时，把相机收到墙这边，窄巷里才看得到人
    const camD = player.inside ? 0.001 : smoothDist
    let camX = player.x + ox * camD
    let camY = player.y + (player.onCloud ? 2.6 : 1.9) + Math.sin(player.pitch) * camD
    let camZ = player.z + oz * camD
    if (!player.inside && camD > 2) {
      const fit = camClear(player.x, player.y + 1.45, player.z, camX, camY, camZ)
      camFit += (fit - camFit) * Math.min(1, dt * 9)
      camX = player.x + ox * camD * camFit
      camY = player.y + (player.onCloud ? 2.6 : 1.9) + Math.sin(player.pitch) * camD * camFit
      camZ = player.z + oz * camD * camFit
    } else camFit = 1
    const gy = P.groundY(camX, camZ)
    camera.position.set(camX, Math.max(camY, gy + 0.6), camZ)
    tmp.set(player.x, player.y + (player.inside ? 1.55 : 1.45), player.z)
    camera.lookAt(tmp)
  }

  // 雾按相机距离衰减：拉远时视距成倍变长，雾不减就会整片发白；全局视野直接关掉
  // 全局视野直接关雾：城市有一千多米宽，任何能看见的量都会把整座城蒙上一层蓝纱
  scene.fog.density = player.over ? 0 : currentLook.fog * Math.min(1, 30 / Math.max(30, smoothDist))
  const wantBloom = currentLook.bloom * (player.over ? 0.72 : 1)
  bloom.strength += (wantBloom - bloom.strength) * Math.min(1, dt * 4)

  // 月光从南侧斜上方来（雨夜便利店也是从正面打光）：店面多数朝南，背光时门脸会整片发黑
  const sgx = Math.round(player.x / 48) * 48
  const sgz = Math.round(player.z / 48) * 48
  if (sgx !== shadowAt.x || sgz !== shadowAt.z) {
    shadowAt.x = sgx
    shadowAt.z = sgz
    // 偏南而不是正 45°：南立面明显亮于东西立面，相邻两个面一明一暗
    sun.position.set(sgx - 55, 250, sgz + 190)
    sun.target.position.set(sgx, 0, sgz)
    sun.target.updateMatrixWorld()
    renderer.shadowMap.needsUpdate = true
  }

  if (world.wheel) {
    world.wheel.rotation.z += dt * 0.055
    // 座舱挂在轮缘上，但自身不转（真实摩天轮的吊舱永远朝下）
    const F = world.ferris
    if (world.cabins && F) {
      for (let i = 0; i < world.cabins.children.length; i++) {
        const a = (i / F.n) * Math.PI * 2 + world.wheel.rotation.z
        world.cabins.children[i].position.set(Math.cos(a) * F.r, Math.sin(a) * F.r, 0)
        world.cabins.children[i].rotation.z = 0
      }
    }
  }
  life.update(dt, time, player)
  world.anim.update(time)

  composer.render()
  adaptRes(dt)
  requestAnimationFrame(frame)
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  composer.setSize(innerWidth, innerHeight)
})

setTimeout(() => {
  const hint = document.getElementById('loading')
  if (!hint) return
  hint.style.transition = 'opacity .45s ease'
  hint.style.opacity = '0'
  setTimeout(() => hint.remove(), 480)
}, 320)

frame()
