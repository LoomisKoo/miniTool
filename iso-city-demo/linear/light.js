import * as THREE from 'three'
import { radialTex, stops } from './mat.js'

export function makeSky() {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 512
  const g = c.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 0, 512)
  gr.addColorStop(0, '#3a7ab4')
  gr.addColorStop(0.45, '#7eb4dc')
  gr.addColorStop(0.78, '#c5dcec')
  gr.addColorStop(1, '#e8f1f7')
  g.fillStyle = gr
  g.fillRect(0, 0, 8, 512)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function makeEnv(renderer, top = '#6aa8d8', mid = '#d0e0ee', bot = '#9a8a70') {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const geo = new THREE.SphereGeometry(1, 32, 20)
  const pos = geo.attributes.position
  const cols = new Float32Array(pos.count * 3)
  const cTop = new THREE.Color(top)
  const cMid = new THREE.Color(mid)
  const cBot = new THREE.Color(bot)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y > 0) c.copy(cMid).lerp(cTop, Math.pow(y, 0.85))
    else c.copy(cMid).lerp(cBot, Math.pow(-y, 0.9))
    cols[i * 3] = c.r
    cols[i * 3 + 1] = c.g
    cols[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
  const ball = new THREE.Mesh(geo, mat)
  const rt = pmrem.fromScene(ball, 0.04)
  geo.dispose()
  mat.dispose()
  pmrem.dispose()
  return rt.texture
}

function makeStars() {
  const n = 900
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    // 只铺上半球，星星不会出现在地面以下
    const a = Math.random() * Math.PI * 2
    const y = 0.12 + Math.random() * 0.88
    const r = Math.sqrt(1 - y * y)
    pos[i * 3] = Math.cos(a) * r * 30_000
    pos[i * 3 + 1] = y * 30_000
    pos[i * 3 + 2] = Math.sin(a) * r * 30_000
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  // 星星：圆形柔边贴图 + 稍大点径，亚像素方点随镜头转动时的闪烁消失
  const st = radialTex(32, stops([[0, 1], [0.4, 0.55], [1, 0]]))
  const mat = new THREE.PointsMaterial({
    map: st,
    color: '#fff6e8',
    size: 3.2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    sizeAttenuation: false,
  })
  const stars = new THREE.Points(geo, mat)
  stars.frustumCulled = false
  return { stars, mat }
}

export function setupDay(scene, renderer) {
  // 天空球跟随相机，云层渐变可以直接做昼夜插值
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#3a7ab4') },
      mid: { value: new THREE.Color('#7eb4dc') },
      horizon: { value: new THREE.Color('#c5dcec') },
      bottom: { value: new THREE.Color('#e8f1f7') },
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
      uniform vec3 mid;
      uniform vec3 horizon;
      uniform vec3 bottom;
      void main() {
        float h = normalize(vDir).y;
        vec3 c = mix(mid, top, smoothstep(0.15, 0.85, h));
        c = mix(horizon, c, smoothstep(-0.02, 0.32, h));
        c = mix(bottom, c, smoothstep(-0.22, -0.02, h));
        vec3 srgb = mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
        gl_FragColor = vec4(srgb, 1.0);
      }
    `,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50_000, 24, 16), skyMat)
  sky.frustumCulled = false
  sky.renderOrder = -1
  scene.add(sky)

  const { stars, mat: starMat } = makeStars()
  scene.add(stars)

  // 几乎不通雾：之前 Fog near=3500 会把整座城蒙成蓝纱
  scene.fog = new THREE.FogExp2('#d2e0ec', 0.000018)

  // 半球光抬高，压住「受光惨白 / 背光死黑」的对比
  const hemi = new THREE.HemisphereLight('#e0f0ff', '#9a8a74', 0.95)
  scene.add(hemi)

  // 主光降到约 1.6：立体感还在，但背光不再比受光暗一个数量级
  const sun = new THREE.DirectionalLight('#fff4e4', 1.6)
  sun.position.set(-2_400, 2_600, 1_600)
  // 场景里没有任何投影体（castShadow 全关），阴影图只是白白让所有受影材质做 PCF 采样 → 整体关掉
  sun.castShadow = false
  sun.shadow.mapSize.set(16, 16)
  sun.shadow.camera.near = 50
  sun.shadow.camera.far = 6_000
  sun.shadow.camera.left = -1_800
  sun.shadow.camera.right = 1_800
  sun.shadow.camera.top = 1_800
  sun.shadow.camera.bottom = -1_800
  sun.shadow.bias = -0.0002
  sun.shadow.normalBias = 1.2
  scene.add(sun)
  scene.add(sun.target)

  const fill = new THREE.DirectionalLight('#c8daf0', 0.75)
  fill.position.set(2_000, 1_000, -1_200)
  scene.add(fill)

  // 月光不再单独占一盏平行光：夜里由 sun 换成月光色（少一盏灯 = 每个像素少一次光照计算）
  const moon = new THREE.DirectionalLight('#c5d4f2', 0)
  moon.position.set(1_800, 2_400, -1_600)

  renderer.shadowMap.enabled = false
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const env = makeEnv(renderer)
  const envNight = makeEnv(renderer, '#12203c', '#1c2a46', '#2c2218')
  scene.environment = env
  return { sun, env, envNight, hemi, fill, moon, sky, skyMat, stars, starMat }
}

/** 拉远 / 全景时进一步减雾，近处略留一点空气感 */
export function tuneFog(scene, camDist, overview) {
  if (!scene.fog) return
  if (overview || camDist > 400) scene.fog.density = 0
  else scene.fog.density = 0.000018 * Math.min(1, 40 / Math.max(40, camDist))
}

export const SKY = {
  day: {
    top: '#3a7ab4', mid: '#7eb4dc', horizon: '#c5dcec', bottom: '#e8f1f7',
    hemi: '#e0f0ff', ground: '#8a7a64', fog: '#d2e0ec',
  },
  night: {
    top: '#03070f', mid: '#081328', horizon: '#26283c', bottom: '#15120f',
    hemi: '#2a3a5c', ground: '#1e1a16', fog: '#1a1e2c',
  },
}
