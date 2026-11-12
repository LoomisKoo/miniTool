import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { applyNight, clipDecals, fixZfight, harmonizePalette } from './kit.js'
import { buildSite, flushPools } from './site.js'
import { buildBuildings } from './buildings.js'
import { tickKonbini } from './store.js'
import { createPlayer } from './player.js'

const canvas = document.querySelector('canvas')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
const dpr = Math.min(window.devicePixelRatio || 1, 1.4)
renderer.setPixelRatio(dpr)
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
// 场景是静止的：阴影只烘一次，不用每帧把近千个物体再画一遍
renderer.shadowMap.autoUpdate = false
renderer.shadowMap.needsUpdate = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2('#d5e4f2', 0.0042)

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.15, 900)
camera.position.set( -8, 8, 20)

function makeEnv(top, mid, bot) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const geo = new THREE.SphereGeometry(1, 28, 18)
  const pos = geo.attributes.position
  const cols = new Float32Array(pos.count * 3)
  const cTop = new THREE.Color(top)
  const cMid = new THREE.Color(mid)
  const cBot = new THREE.Color(bot)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y > 0) c.copy(cMid).lerp(cTop, Math.pow(y, 0.75))
    else c.copy(cMid).lerp(cBot, Math.pow(-y, 0.9))
    cols[i * 3] = c.r
    cols[i * 3 + 1] = c.g
    cols[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
  const ball = new THREE.Mesh(geo, mat)
  const probe = new THREE.Scene()
  probe.add(ball)
  const rt = pmrem.fromScene(probe, 0.05)
  geo.dispose()
  mat.dispose()
  pmrem.dispose()
  return rt.texture
}

const envDay = makeEnv('#4e8ec4', '#d5e6f4', '#c2b099')
const envNight = makeEnv('#10182e', '#24365c', '#3a2c22')
scene.environment = envDay

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    top: { value: new THREE.Color('#3f82c4') },
    horizon: { value: new THREE.Color('#d7e8f5') },
    bottom: { value: new THREE.Color('#cbbda6') },
  },
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vDir;
    uniform vec3 top;
    uniform vec3 horizon;
    uniform vec3 bottom;
    void main() {
      float h = normalize(vDir).y;
      vec3 c = mix(horizon, top, smoothstep(0.0, 0.62, h));
      c = mix(c, bottom, smoothstep(0.02, -0.18, h));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
})
const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 28, 16), skyMat)
sky.frustumCulled = false
scene.add(sky)

const starN = 160
const starPos = new Float32Array(starN * 3)
for (let i = 0; i < starN; i++) {
  const a = Math.random() * Math.PI * 2
  const r = 150 + Math.random() * 90
  starPos[i * 3] = Math.cos(a) * r
  starPos[i * 3 + 1] = 40 + Math.random() * 200
  starPos[i * 3 + 2] = Math.sin(a) * r
}
const starGeo = new THREE.BufferGeometry()
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
const starMat = new THREE.PointsMaterial({
  color: '#fff6e8', size: 1.5, transparent: true, opacity: 0, depthWrite: false, fog: false, sizeAttenuation: false,
})
const stars = new THREE.Points(starGeo, starMat)
stars.frustumCulled = false
scene.add(stars)

const hemi = new THREE.HemisphereLight('#dbe7ee', '#c2ab8e', 0.5)
scene.add(hemi)
const sun = new THREE.DirectionalLight('#fff1dc', 2.5)
sun.position.set(-52, 78, 40)
sun.target.position.set(-1, 18, -4)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
sun.shadow.camera.near = 20
sun.shadow.camera.far = 260
sun.shadow.camera.left = -78
sun.shadow.camera.right = 78
sun.shadow.camera.top = 78
sun.shadow.camera.bottom = -78
sun.shadow.bias = -0.0006
sun.shadow.normalBias = 0.08
scene.add(sun)
scene.add(sun.target)
const fill = new THREE.DirectionalLight('#d5e4f4', 0.34)
fill.position.set(40, 24, -28)
scene.add(fill)
const moon = new THREE.DirectionalLight('#c5d4f2', 0)
moon.position.set(36, 48, -24)
scene.add(moon)

const root = new THREE.Group()
scene.add(root)
buildSite(root)
buildBuildings(root)
harmonizePalette(root)
flushPools(root)
clipDecals(root)
fixZfight(root)
const player = createPlayer(scene, camera, canvas)

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  samples: 0,
  type: THREE.HalfFloatType,
}))
composer.setPixelRatio(dpr)
composer.setSize(innerWidth, innerHeight)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.15, 0.4, 0.88)
composer.addPass(bloom)
composer.addPass(new OutputPass())

const dayTop = new THREE.Color('#3f82c4')
const dayHor = new THREE.Color('#e0e8ea')
const dayBot = new THREE.Color('#cbbda6')
const nightTop = new THREE.Color('#0a1122')
const nightHor = new THREE.Color('#182848')
const nightBot = new THREE.Color('#1a160f')
const dayHemi = new THREE.Color('#dbe7ee')
const nightHemi = new THREE.Color('#2a3f63')
const dayGround = new THREE.Color('#b7a48c')
const nightGround = new THREE.Color('#3a3226')

let target = 0
let t = 0
let envNightOn = false
const modeEl = document.getElementById('mode')
const cycle = document.getElementById('cycle')

function setTarget(next) {
  target = next
  cycle.textContent = next ? '切换白天' : '切换黑夜'
}
cycle.addEventListener('click', () => setTarget(target > 0.5 ? 0 : 1))
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.pointerLockElement) return
    location.href = './index.html'
  }
  if (e.key === 'n' || e.key === 'N') setTarget(target > 0.5 ? 0 : 1)
})

function lerp(a, b, k) { return a + (b - a) * k }

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  composer.setSize(innerWidth, innerHeight)
})

let prev = 0
function frame(now) {
  requestAnimationFrame(frame)
  const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0.016
  prev = now
  player.update(dt)
  t += (target - t) * 0.055
  if (Math.abs(target - t) < 0.001) t = target

  skyMat.uniforms.top.value.copy(dayTop).lerp(nightTop, t)
  skyMat.uniforms.horizon.value.copy(dayHor).lerp(nightHor, t)
  skyMat.uniforms.bottom.value.copy(dayBot).lerp(nightBot, t)
  scene.fog.color.copy(skyMat.uniforms.horizon.value)
  scene.fog.density = player.overview ? 0 : lerp(0.0036, 0.0065, t)

  hemi.color.copy(dayHemi).lerp(nightHemi, t)
  hemi.groundColor.copy(dayGround).lerp(nightGround, t)
  hemi.intensity = lerp(0.5, 0.46, t)
  sun.intensity = lerp(2.5, 0.06, t)
  fill.intensity = lerp(0.34, 0.12, t)
  moon.intensity = lerp(0, 0.78, t)
  renderer.toneMappingExposure = lerp(1.0, 0.82, t)
  bloom.strength = lerp(0.1, 0.3, t)
  starMat.opacity = Math.max(0, t - 0.35) / 0.65
  applyNight(t)
  tickKonbini(dt)

  const useNight = t > 0.55
  if (useNight !== envNightOn) {
    envNightOn = useNight
    scene.environment = useNight ? envNight : envDay
  }
  document.body.classList.toggle('night', useNight)
  modeEl.textContent = `${useNight ? '黑夜' : '白天'} · 街上可走`

  composer.render()
}
requestAnimationFrame(frame)
