import * as THREE from 'three'
import { radialTex, stops, nightU } from './mat.js'

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

/**
 * 环境图（IBL）。t35：白天不再是一张平滑渐变（漆面/搪瓷/金属反射出来全是一片灰蓝 → 塑料感），
 * 加 暖色太阳光斑 + 地平线暖霾 + 一圈远处城市天际线剪影 + 几团云 —— 亮面表皮的反射有了内容和方向。
 * 夜里（rich=false）保持原来的纯渐变。
 */
export function makeEnv(renderer, top = '#6aa8d8', mid = '#d0e0ee', bot = '#9a8a70', rich = false) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const geo = new THREE.SphereGeometry(1, 48, 32)
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
    if (rich && y > -0.05 && y < 0.18) c.lerp(new THREE.Color('#f2e2c8'), (1 - Math.abs(y - 0.04) / 0.14) * 0.45)
    cols[i * 3] = c.r
    cols[i * 3 + 1] = c.g
    cols[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
  const ball = new THREE.Mesh(geo, mat)
  const envScene = new THREE.Scene()
  envScene.add(ball)
  const extra = []
  if (rich) {
    // 太阳（与主光同向，HDR 亮度）+ 外圈暖晕
    const sunDir = new THREE.Vector3(-0.69, 0.5, 0.45).normalize()
    const sunM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.88, 0.66).multiplyScalar(14) })
    const sunB = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), sunM)
    sunB.position.copy(sunDir.clone().multiplyScalar(0.9))
    const haloM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.86, 0.62).multiplyScalar(1.6), transparent: true, opacity: 0.5 })
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), haloM)
    halo.position.copy(sunDir.clone().multiplyScalar(0.88))
    envScene.add(sunB, halo)
    extra.push(sunB, halo)
    // 远处城市天际线：一圈高低不一的楼块（冷灰蓝 / 暖米两种），反射里能看到「城市」而不是一片空
    let sd = 7
    const rnd = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646
    const cityA = new THREE.MeshBasicMaterial({ color: new THREE.Color('#6f8296') })
    const cityB = new THREE.MeshBasicMaterial({ color: new THREE.Color('#b8a58a') })
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + rnd() * 0.03
      const h = 0.03 + Math.pow(rnd(), 2.2) * 0.2
      const w = 0.04 + rnd() * 0.05
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), rnd() < 0.6 ? cityA : cityB)
      b.position.set(Math.cos(a) * 0.8, h / 2 - 0.02, Math.sin(a) * 0.8)
      b.lookAt(0, h / 2 - 0.02, 0)
      envScene.add(b)
      extra.push(b)
    }
    // 云团
    const cloudM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.24, 1.22) })
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2
      const el = 0.18 + rnd() * 0.45
      const r = Math.cos(el) * 0.85
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.06 + rnd() * 0.07, 10, 6), cloudM)
      c.scale.set(2.2, 0.5, 1.2)
      c.position.set(Math.cos(a) * r, Math.sin(el) * 0.85, Math.sin(a) * r)
      c.lookAt(0, c.position.y, 0)
      envScene.add(c)
      extra.push(c)
    }
  }
  const rt = pmrem.fromScene(envScene, 0.035)
  for (const e of extra) e.geometry.dispose()
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
    pos[i * 3] = Math.cos(a) * r * 26_000
    pos[i * 3 + 1] = y * 26_000
    pos[i * 3 + 2] = Math.sin(a) * r * 26_000
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
      top: { value: new THREE.Color('#1f62b4') },
      mid: { value: new THREE.Color('#4f93dc') },
      horizon: { value: new THREE.Color('#a6cbec') },
      bottom: { value: new THREE.Color('#8fb2d2') },
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
        vec3 c = mix(mid, top, smoothstep(0.12, 0.7, h));
        c = mix(horizon, c, smoothstep(-0.01, 0.22, h));
        c = mix(bottom, c, smoothstep(-0.22, -0.02, h));
        vec3 srgb = mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
        gl_FragColor = vec4(srgb, 1.0);
      }
    `,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(30_000, 24, 16), skyMat)
  sky.frustumCulled = false
  sky.renderOrder = -1
  scene.add(sky)

  const { stars, mat: starMat } = makeStars()
  scene.add(stars)

  // 几乎不通雾：之前 Fog near=3500 会把整座城蒙成蓝纱
  scene.fog = new THREE.FogExp2('#9cc0e4', 0.00015)

  // 半球光抬高，压住「受光惨白 / 背光死黑」的对比
  // t35：环境光略降、偏天空蓝，地面反射偏暖（受光 / 背光有冷暖之分，不再每个面一样亮 → 塑料感的主要来源之一）
  // 环境光压到 0.42：量过才知道，原来 hemi 0.64 + 环境图 IBL 占了画面亮度的 ~85%，
  // 主光只占 ~10% —— 所有面接到的光都差不多，建筑就成了一片平涂的贴片。
  // 环境光必须让位给主光，明暗关系才读得出来。
  const hemi = new THREE.HemisphereLight('#c6dcff', '#b39874', 0.42)
  scene.add(hemi)

  // 主光降到约 1.6：立体感还在，但背光不再比受光暗一个数量级
  // t35：午后偏侧的暖阳（高度角 ~33°），强一些 → 受光面暖亮、背光面靠天光偏冷，立体感回来
  const sun = new THREE.DirectionalLight('#ffe4bf', 3.6)
  sun.position.set(-2_400, 2_600, 1_600)
  // 阴影：这是「建筑像贴片」的第一号原因 —— 楼与楼之间不互相遮挡、楼投不到街上、
  // 墙角没有暗交界，人眼就读不到体积和尺度。
  //
  // 但整城 5000m 全画进一张图，1 个 texel 要覆盖 2m 多，边缘全是锯齿块。
  // 做法是只画镜头附近 1200m 见方（2048 图 → 约 0.6m/texel），并让视锥跟着镜头走
  // （main.js 的 maybeUpdateShadow 负责搬 target，只在移动 400m 时重画一次）。
  // ?shadows=0 可关掉，用来做 A/B 对比 / 排查
  const SHADOW_ON = !/[?&]shadows=0/.test(location.search)
  sun.castShadow = SHADOW_ON
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 200
  sun.shadow.camera.far = 5_000
  sun.shadow.camera.left = -1_200
  sun.shadow.camera.right = 1_200
  sun.shadow.camera.top = 1_200
  sun.shadow.camera.bottom = -1_200
  // bias 太小 → 自阴影痤疮（脸上起黑点）；太大 → 阴影脱离物体（peter-panning）
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.8
  sun.shadow.camera.updateProjectionMatrix()
  scene.add(sun)
  scene.add(sun.target)

  const fill = new THREE.DirectionalLight('#bcd2f2', 0.38)
  fill.position.set(2_000, 1_000, -1_200)
  scene.add(fill)

  // 月光不再单独占一盏平行光：夜里由 sun 换成月光色（少一盏灯 = 每个像素少一次光照计算）
  const moon = new THREE.DirectionalLight('#c5d4f2', 0)
  moon.position.set(1_800, 2_400, -1_600)

  renderer.shadowMap.enabled = SHADOW_ON
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // 每帧重画阴影图 = 整城几何多走一遍深度。静态城不需要：
  // 只有 maybeUpdateShadow 判定"镜头移动超过 400m"时才 needsUpdate 一次
  renderer.shadowMap.autoUpdate = false
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const env = makeEnv(renderer, '#3f86d6', '#bcd6ee', '#a8987c', true)
  // 环境图同时充当天光 + 反射。它是最均匀的一盏灯，占比过高就会把形体抹平。
  // 压到 0.45 保留反射和蓝天的补色，但不再压过主光。
  scene.environmentIntensity = 0.45
  const envNight = makeEnv(renderer, '#12203c', '#1c2a46', '#2c2218')
  scene.environment = env
  return { sun, env, envNight, hemi, fill, moon, sky, skyMat, stars, starMat }
}

/** 拉远 / 全景时进一步减雾，近处略留一点空气感 */
export function tuneFog(scene, camDist, overview) {
  if (!scene.fog) return
  // t37：空气透视改成「蓝色、随视距缩放」的雾 —— 雾色是饱和的天蓝（不是灰白），
  // 密度按相机距离/高度反比：无论贴地、筋斗云 600m 还是全景俯瞰，近处城市只蒙 2% 左右，
  // 3~5 倍视距外才明显发蓝 → 远景有层次但颜色还在，不再是一片平涂的塑料盒子。夜里减到 35%。
  const k = overview ? 0.16 : 0.2
  scene.fog.density = (k / Math.max(1200, camDist)) * (1 - 0.65 * nightU.value)
}

export const SKY = {
  day: {
    top: '#1f62b4', mid: '#4f93dc', horizon: '#a6cbec', bottom: '#8fb2d2',
    hemi: '#c6dcff', ground: '#b39874', fog: '#9cc0e4',
  },
  night: {
    top: '#03070f', mid: '#081328', horizon: '#26283c', bottom: '#15120f',
    hemi: '#2a3a5c', ground: '#1e1a16', fog: '#1a1e2c',
  },
}
