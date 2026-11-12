import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createRoam } from './roam.js'
import { makeDistrict } from './district.js'

/**
 * 建筑原型集 · 136 型
 *
 * 十二组，每组一种立面/材料/功能逻辑：
 *   一  玻璃幕墙      —— 截面变化（圆筒 / 椭圆 / 扭转 / 三角 / 六边 / 鼓形）
 *   二  实墙开窗      —— 石材 / 砖 / 混凝土 / 铝板 / 铜 / 搪瓷
 *   三  遮阳表皮      —— 陶土百叶 / 木格栅 / 穿孔铝 / 砖镂空 / 绿植 / 幻彩钢
 *   四  特殊造型      —— 金字塔 / 斜交网格 / 螺旋 / 顶部开洞 / 双塔 / 悬挑
 *   五  金属工艺      —— 釉面陶瓷 / 空心砌块 / 阳极氧化 / 石板叠涩 / 白瓷鳍 / 金属网
 *   六  日常与公共    —— 联排 / 半木构 / 夯土 / 仓库 / 美术馆 / 教堂 / 清真寺 /
 *                       钟楼 / 温室 / 礼拜堂 / 茅草屋 / 集装箱 / 车库 / 公寓 /
 *                       市集 / 町屋 / 徽派 / 石塔 / 水塔 / 灯塔 / 粮仓 / 学校 / 影院
 *   七  住宅与社区    —— 板式高层 / 点式塔 / 小区行列式 / 联排别墅 / 四合院
 *   八  体育与演艺    —— 圆形体育场 / 室内体育馆 / 演唱会场馆
 *   九  文教与政务    —— 图书馆 / 博物馆 / 大学 / 医院 / 消防站 / 政府 / 法院 /
 *                       市政厅 / 银行
 *   十  宗教建筑      —— 佛寺 / 佛塔 / 孔庙 / 天主堂 / 东正堂 / 礼拜堂 /
 *                       犹太会堂 / 印度神庙
 *   十一 交通与市政   —— 加油站 / 超市 / 小学 / 幼儿园 / 游泳馆 / 火车站 /
 *                       地铁口 / 汽车站 / 机场 / 电视塔 / 摩天轮
 *   十二 高层与设施   —— 双子塔 / 螺旋塔 / 板式办公 / 城市综合体 / 通信塔 /
 *                       数据中心 / 变电站 / 水厂 / 转运站 / 公交枢纽 / 服务中心 / 高架
 *   十三 异型结构     —— 子弹头 / 倾斜 / 门洞 / V 形双塔 / 花瓣 / 刀片 /
 *                       分叉巨柱 / 折纸 / 积木堆叠 / 卵形 / 竹节 / 双曲面
 *   十四 文化教育     —— 歌剧院 / 会展中心 / 美术馆 / 公寓塔 / 办公园 / 邮局 /
 *                       市场 / 步行街 / 酒店 / 养老院 / 溜冰馆
 *   十五 交通与工业   —— 服务区 / 收费站 / 天桥 / 高架站 / 码头 / 污水厂 /
 *                       火电厂 / 风电场 / 光伏站 / 焚烧厂 / 城市广场
 *
 * 性能：全场景静态，建完后按材质一次性合批（见 mergeStaticMeshes）+ 阴影只烘一次。
 */

// 构建耗时打点（控制台可查 window.__boot）
const __t0 = performance.now()

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  // 场景纵深 5000+ 米，普通深度缓冲远处精度不足，大面积近共面构件会闪；
  // 对数深度把精度按距离分配，远处 z-fighting 明显减少。
  logarithmicDepthBuffer: true,
})
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
renderer.shadowMap.enabled = true
// PCFSoft 每个片元十几个采样点，全屏铺满时很吃填充率；
// 静态阴影用 PCF 足够，配合一次烘焙整体轻很多。
renderer.shadowMap.type = THREE.PCFShadowMap
// 场景是静态的（只有相机在动）：阴影贴图只烘一次，之后每帧省掉整个 shadow pass。
// 顺带彻底消除"阴影每帧重算 → 边缘抖动/闪烁"。
// 注意：needsUpdate 要在场景全部建好后再置位（见文件末尾的 firstRender）。
renderer.shadowMap.autoUpdate = false
document.body.appendChild(renderer.domElement)

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(innerWidth, innerHeight)
labelRenderer.domElement.style.position = 'fixed'
labelRenderer.domElement.style.inset = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.getElementById('labels').appendChild(labelRenderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0xbcd0e2, 1400, 5200)

const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 1, 5600)
camera.position.set(420, 700, 1320)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 70, 0)
controls.enableDamping = true
controls.dampingFactor = 0.07
controls.maxPolarAngle = Math.PI * 0.492
controls.minDistance = 40
controls.maxDistance = 3000
let roam = null

// ---------- 天空 + 环境反射 ----------
function skyMat() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    // 自定义着色器不走 three 的对数深度分支，直接关掉深度测试最省事
    depthTest: false,
    uniforms: {
      top: { value: new THREE.Color('#2c6ca8') },
      mid: { value: new THREE.Color('#94bade') },
      bot: { value: new THREE.Color('#e6ebee') },
      sun: { value: new THREE.Vector3(0.5, 0.5, 0.55).normalize() },
    },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top, mid, bot, sun;
      varying vec3 vP;
      void main(){
        vec3 d = normalize(vP);
        float t = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = mix(bot, mid, smoothstep(0.40, 0.60, t));
        c = mix(c, top, smoothstep(0.56, 0.99, t));
        float s = max(dot(d, sun), 0.0);
        c += vec3(1.0,0.96,0.88) * pow(s, 70.0) * 1.25;
        c += vec3(1.0,0.97,0.93) * pow(s, 4.0) * 0.10;
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
}
const sky = new THREE.Mesh(new THREE.SphereGeometry(3400, 48, 24), skyMat())
sky.userData.noMerge = true
sky.renderOrder = -1
sky.frustumCulled = false
scene.add(sky)

const pmrem = new THREE.PMREMGenerator(renderer)
const envScene = new THREE.Scene()
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), skyMat()))
{
  const tones = ['#93a9bc', '#7d94a8', '#a6b8c6', '#8fa2b2', '#9aa8b4']
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const rad = 30 + (i % 4) * 3
    const w = 3 + ((i * 7) % 9)
    const h = 14 + ((i * 13) % 28)
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * 0.8),
      new THREE.MeshBasicMaterial({ color: tones[i % tones.length] }),
    )
    b.position.set(Math.cos(a) * rad, h / 2 - 10, Math.sin(a) * rad)
    b.rotation.y = -a
    envScene.add(b)
  }
}
const envMap = pmrem.fromScene(envScene, 0.03).texture
pmrem.dispose()

// ---------- 程序化贴图 ----------
function tex(size, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function noise(g, s, base, amt, dark) {
  g.fillStyle = base
  g.fillRect(0, 0, s, s)
  for (let i = 0; i < s * 16; i++) {
    g.fillStyle = Math.random() < 0.5
      ? `rgba(255,255,255,${Math.random() * amt})`
      : `rgba(${dark},${Math.random() * amt})`
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
}

// 石材干挂分缝
const stoneTex = tex(256, (g, s) => {
  noise(g, s, '#d4ccba', 0.1, '96,88,76')
  g.strokeStyle = 'rgba(96,88,76,0.5)'
  g.lineWidth = 1.6
  for (let y = 0; y <= s; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke() }
  for (let row = 0; row < 4; row++) {
    for (let x = (row % 2) * 64; x <= s; x += 128) {
      g.beginPath(); g.moveTo(x, row * 64); g.lineTo(x, row * 64 + 64); g.stroke()
    }
  }
}, 2, 3)

// 砖砌
const brickTex = tex(256, (g, s) => {
  noise(g, s, '#9c5a4a', 0.08, '60,30,22')
  g.strokeStyle = 'rgba(60,30,22,0.55)'
  g.lineWidth = 2
  const bh = 16
  for (let y = 0, row = 0; y <= s; y += bh, row++) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke()
    for (let x = (row % 2) * 16; x <= s; x += 32) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh); g.stroke()
    }
  }
}, 3, 5)

// 清水混凝土（木模板缝 + 螺栓孔）
const concreteTex = tex(256, (g, s) => {
  noise(g, s, '#b0ada5', 0.12, '96,94,88')
  g.strokeStyle = 'rgba(110,108,102,0.35)'
  g.lineWidth = 2.5
  for (let y = 0; y <= s; y += 85) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke() }
  for (let x = 0; x <= s; x += 85) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke() }
  g.fillStyle = 'rgba(96,94,88,0.4)'
  for (const [x, y] of [[42, 42], [128, 42], [214, 42], [42, 128], [128, 128], [214, 128], [42, 214], [128, 214], [214, 214]]) {
    g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill()
  }
}, 2, 4)

// 穿孔铝板（透孔 + 背衬亮点）
const perfTex = tex(128, (g, s) => {
  g.fillStyle = '#b9bfc2'
  g.fillRect(0, 0, s, s)
  g.fillStyle = '#4a5054'
  for (let y = 8; y < s; y += 16) {
    for (let x = 8 + ((y / 16) % 2) * 8; x < s; x += 16) {
      g.beginPath(); g.arc(x, y, 4.2, 0, Math.PI * 2); g.fill()
    }
  }
}, 3, 4)

// 砖镂空屏（伊斯兰式）
const screenTex = tex(128, (g, s) => {
  g.fillStyle = '#a85c44'
  g.fillRect(0, 0, s, s)
  noise(g, s, '#a85c44', 0.06, '60,30,22')
  g.fillStyle = '#3a2018'
  for (let y = 0; y < s; y += 32) {
    for (let x = 0; x < s; x += 32) {
      g.beginPath()
      g.moveTo(x + 16, y + 4)
      g.lineTo(x + 28, y + 16)
      g.lineTo(x + 16, y + 28)
      g.lineTo(x + 4, y + 16)
      g.closePath()
      g.fill()
    }
  }
}, 5, 8)

// 彩釉玻璃（frit）—— 白点渐变
const fritTex = tex(256, (g, s) => {
  g.fillStyle = '#c8dcea'
  g.fillRect(0, 0, s, s)
  for (let y = 0; y < s; y++) {
    const a = (y / s) * 0.55
    g.fillStyle = `rgba(255,255,255,${a})`
    g.fillRect(0, y, s, 1)
  }
  g.fillStyle = 'rgba(255,255,255,0.85)'
  for (let y = 0; y < s; y += 8) {
    for (let x = 0; x < s; x += 8) {
      g.beginPath(); g.arc(x + 2, y + 2, 1.5, 0, Math.PI * 2); g.fill()
    }
  }
}, 2, 3)

// 木格栅
const woodTex = tex(128, (g, s) => {
  noise(g, s, '#8a6440', 0.08, '50,34,20')
  g.globalAlpha = 0.15
  for (let x = 0; x < s; x += 3) {
    g.fillStyle = x % 6 ? '#ffffff' : '#3a2414'
    g.fillRect(x, 0, 1, s)
  }
  g.globalAlpha = 1
}, 1, 1)

// 绿植墙
const leafTex = tex(128, (g, s) => {
  g.fillStyle = '#3f5c38'
  g.fillRect(0, 0, s, s)
  const cols = ['#4e7044', '#5f8552', '#6e9460', '#3a5233', '#527a48']
  for (let i = 0; i < 420; i++) {
    g.fillStyle = cols[i % cols.length]
    g.beginPath()
    g.ellipse(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 1.4 + Math.random() * 2.4, Math.random() * 3.14, 0, Math.PI * 2)
    g.fill()
  }
}, 3, 4)

// 幻彩不锈钢（iridescent）
function iridTex() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const g = c.getContext('2d')
  const grd = g.createLinearGradient(0, 0, 256, 0)
  grd.addColorStop(0, '#9fd8ff')
  grd.addColorStop(0.25, '#c9a8ff')
  grd.addColorStop(0.5, '#ffb0d8')
  grd.addColorStop(0.75, '#ffd8a8')
  grd.addColorStop(1, '#a8ffe0')
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 64)
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.2})`
    g.fillRect(Math.random() * 256, Math.random() * 64, 2, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 6)
  return t
}

// 耐候钢（锈蚀）
const rustTex = tex(256, (g, s) => {
  g.fillStyle = '#8a5a3a'
  g.fillRect(0, 0, s, s)
  for (let i = 0; i < 900; i++) {
    const cols = ['#6e4228', '#9c6a44', '#7a4c30', '#b07c50', '#5c3720']
    g.fillStyle = cols[i % cols.length]
    g.globalAlpha = 0.3 + Math.random() * 0.5
    g.beginPath()
    g.ellipse(Math.random() * s, Math.random() * s, 3 + Math.random() * 16, 2 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
}, 2, 4)

// 釉面陶瓷板（分格 + 高光釉面）
const glazeTex = tex(256, (g, s) => {
  noise(g, s, '#3f5d78', 0.05, '20,34,48')
  g.strokeStyle = 'rgba(18,30,42,0.55)'
  g.lineWidth = 2
  for (let y = 0; y <= s; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke() }
  for (let x = 0; x <= s; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke() }
  g.fillStyle = 'rgba(255,255,255,0.06)'
  for (let y = 4; y < s; y += 64) g.fillRect(0, y, s, 10)
}, 3, 5)

// 空心砌块（breeze block）：方格镂空
const breezeTex = tex(256, (g, s) => {
  noise(g, s, '#cdc8bc', 0.1, '110,106,100')
  g.fillStyle = 'rgba(58,56,52,0.9)'
  const cell = 64
  for (let y = 0; y < s; y += cell) {
    for (let x = 0; x < s; x += cell) {
      g.fillRect(x + 18, y + 18, cell - 36, cell - 36)
    }
  }
  g.strokeStyle = 'rgba(120,116,108,0.5)'
  g.lineWidth = 2
  for (let y = 0; y <= s; y += cell) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke() }
  for (let x = 0; x <= s; x += cell) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke() }
}, 4, 6)

// 石板瓦（错缝薄片）
const slateTex = tex(256, (g, s) => {
  noise(g, s, '#575d63', 0.1, '26,30,34')
  g.strokeStyle = 'rgba(24,28,32,0.55)'
  g.lineWidth = 2
  const rh = 32
  for (let y = 0, row = 0; y <= s; y += rh, row++) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke()
    for (let x = (row % 2) * 32; x <= s; x += 64) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + rh); g.stroke()
    }
  }
}, 3, 4)

// 阳极氧化渐变铝（银 → 蓝紫）
const anodTex = (() => {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 256
  const g = c.getContext('2d')
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#c8d4dc')
  grd.addColorStop(0.45, '#8fa6b8')
  grd.addColorStop(0.78, '#6d7fa4')
  grd.addColorStop(1, '#4e5a78')
  g.fillStyle = grd
  g.fillRect(0, 0, 8, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 1)
  return t
})()

// 白色大理石（细脉）
const marbleTex = tex(256, (g, s) => {
  noise(g, s, '#eceae4', 0.04, '150,148,142')
  g.strokeStyle = 'rgba(120,120,118,0.35)'
  for (let i = 0; i < 22; i++) {
    g.lineWidth = 0.6 + Math.random() * 1.6
    g.beginPath()
    let x = Math.random() * s
    let y = 0
    g.moveTo(x, y)
    while (y < s) {
      x += (Math.random() - 0.5) * 26
      y += 10 + Math.random() * 20
      g.lineTo(x, y)
    }
    g.stroke()
  }
}, 2, 3)

// 深色金属网格（密纹）
const meshTex = tex(128, (g, s) => {
  g.fillStyle = '#2b3136'
  g.fillRect(0, 0, s, s)
  g.strokeStyle = 'rgba(150,162,170,0.75)'
  g.lineWidth = 2
  for (let i = 0; i <= s; i += 12) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke()
    g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke()
  }
}, 6, 10)

// 白灰抹面（limewash，带竖向流痕）
const plasterTex = tex(256, (g, s) => {
  noise(g, s, '#efece5', 0.06, '150,146,138')
  for (let i = 0; i < 44; i++) {
    const x = Math.random() * s
    const grd = g.createLinearGradient(x, 0, x, s)
    grd.addColorStop(0, 'rgba(140,136,126,0)')
    grd.addColorStop(1, `rgba(140,136,126,${0.05 + Math.random() * 0.12})`)
    g.fillStyle = grd
    g.fillRect(x, 0, 2 + Math.random() * 6, s)
  }
}, 2, 2)

// 夯土（水平层带）
const earthTex = tex(256, (g, s) => {
  g.fillStyle = '#b08a62'
  g.fillRect(0, 0, s, s)
  const cols = ['#a07c56', '#c09a70', '#96714b', '#c6a279', '#8d6a47']
  for (let i = 0; i < 46; i++) {
    g.fillStyle = cols[i % cols.length]
    g.globalAlpha = 0.5 + Math.random() * 0.4
    g.fillRect(0, Math.random() * s, s, 3 + Math.random() * 12)
  }
  g.globalAlpha = 0.35
  g.fillStyle = '#6f543a'
  for (let i = 0; i < 300; i++) g.fillRect(Math.random() * s, Math.random() * s, 2, 1)
  g.globalAlpha = 1
}, 2, 3)

// 波纹铁皮（竖向肋 + 锈斑）
const corrTex = tex(128, (g, s) => {
  g.fillStyle = '#b4bdc2'
  g.fillRect(0, 0, s, s)
  for (let x = 0; x < s; x += 8) {
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x, 0, 2, s)
    g.fillStyle = 'rgba(40,48,54,0.32)'; g.fillRect(x + 4, 0, 3, s)
  }
  g.fillStyle = 'rgba(150,92,56,0.28)'
  for (let i = 0; i < 44; i++) g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 5, 1 + Math.random() * 3)
}, 4, 2)

// 陶瓦屋面（半圆瓦垄）
const tileTex = tex(128, (g, s) => {
  noise(g, s, '#a9573c', 0.1, '60,28,18')
  for (let y = 0; y < s; y += 16) {
    g.fillStyle = 'rgba(40,18,12,0.45)'; g.fillRect(0, y, s, 3)
    for (let x = ((y / 16) % 2) * 8; x < s; x += 16) {
      g.fillStyle = 'rgba(255,190,150,0.10)'; g.fillRect(x + 2, y + 4, 5, 10)
      g.fillStyle = 'rgba(40,18,12,0.28)'; g.fillRect(x + 8, y + 4, 2, 10)
    }
  }
}, 3, 6)

// 茅草（草茎笔触）
const thatchTex = tex(128, (g, s) => {
  noise(g, s, '#b39a63', 0.1, '110,90,50')
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = i % 3 ? 'rgba(140,116,64,0.5)' : 'rgba(214,196,150,0.5)'
    g.lineWidth = 1
    const x = Math.random() * s, y = Math.random() * s
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y + 5 + Math.random() * 10); g.stroke()
  }
}, 3, 5)

// 玻璃砖（方格）
const blockTex = tex(128, (g, s) => {
  g.fillStyle = '#a8c6d2'; g.fillRect(0, 0, s, s)
  for (let y = 0; y < s; y += 16) {
    for (let x = 0; x < s; x += 16) {
      const grd = g.createLinearGradient(x, y, x + 16, y + 16)
      grd.addColorStop(0, 'rgba(255,255,255,0.78)')
      grd.addColorStop(1, 'rgba(130,172,190,0.8)')
      g.fillStyle = grd; g.fillRect(x + 1.5, y + 1.5, 13, 13)
    }
  }
  g.strokeStyle = 'rgba(88,118,130,0.55)'; g.lineWidth = 1
  for (let i = 0; i <= s; i += 16) {
    g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke()
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke()
  }
}, 4, 6)

// 烧杉板（炭化木）
const charredTex = tex(128, (g, s) => {
  noise(g, s, '#2a2622', 0.12, '10,8,6')
  for (let x = 0; x < s; x += 9) {
    g.fillStyle = 'rgba(78,66,54,0.26)'; g.fillRect(x, 0, 2, s)
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(x + 6, 0, 2, s)
  }
}, 4, 3)

// 木壁板（水平叠板）
const sidingTex = tex(128, (g, s) => {
  noise(g, s, '#d2d6cf', 0.06, '120,126,116')
  for (let y = 0; y < s; y += 12) {
    g.fillStyle = 'rgba(108,114,104,0.38)'; g.fillRect(0, y + 10, s, 2)
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, y, s, 2)
  }
}, 3, 4)

// 蓝白瓷砖（azulejo）
const azulejoTex = tex(128, (g, s) => {
  g.fillStyle = '#eef2f0'; g.fillRect(0, 0, s, s)
  const cell = 32
  for (let y = 0; y < s; y += cell) {
    for (let x = 0; x < s; x += cell) {
      g.strokeStyle = 'rgba(36,78,132,0.85)'; g.lineWidth = 2.5
      g.strokeRect(x + 3, y + 3, cell - 6, cell - 6)
      g.beginPath()
      g.moveTo(x + cell / 2, y + 3); g.lineTo(x + cell / 2, y + cell - 3)
      g.moveTo(x + 3, y + cell / 2); g.lineTo(x + cell - 3, y + cell / 2)
      g.stroke()
      g.fillStyle = 'rgba(36,78,132,0.72)'
      g.beginPath(); g.arc(x + cell / 2, y + cell / 2, 4, 0, Math.PI * 2); g.fill()
    }
  }
}, 4, 5)

// 凝灰岩 / 石灰岩（水平层理 + 错缝）
const tuffTex = tex(256, (g, s) => {
  noise(g, s, '#cbbfa6', 0.09, '110,100,82')
  for (let y = 0; y < s; y += 14) {
    g.fillStyle = y % 28 ? 'rgba(120,110,92,0.24)' : 'rgba(90,82,68,0.26)'
    g.fillRect(0, y, s, 2 + Math.random() * 3)
  }
  g.strokeStyle = 'rgba(96,88,72,0.45)'; g.lineWidth = 1.5
  for (let y = 0; y <= s; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke() }
  for (let r = 0; r < 6; r++) {
    for (let x = (r % 2) * 40; x <= s; x += 80) {
      g.beginPath(); g.moveTo(x, r * 42); g.lineTo(x, r * 42 + 42); g.stroke()
    }
  }
}, 3, 3)

// 马赛克（小方块拼贴）
const mosaicTex = tex(128, (g, s) => {
  g.fillStyle = '#7d7366'; g.fillRect(0, 0, s, s)
  const cols = ['#d8cbb0', '#b8825e', '#8fa0a8', '#c8a06a', '#9c6d52', '#dcd8cc']
  for (let y = 0; y < s; y += 8) {
    for (let x = 0; x < s; x += 8) {
      g.fillStyle = cols[(x + y) % cols.length]
      g.fillRect(x + 1, y + 1, 6, 6)
    }
  }
}, 6, 8)

// 涂料（细颗粒，用于彩色粉刷墙）
const paintTex = tex(64, (g, s) => {
  noise(g, s, '#ffffff', 0.05, '120,120,120')
}, 2, 2)

// ---------- 材质库 ----------
const glassM = (tint, metal = 0.42, env = 1.85, map = null) => new THREE.MeshStandardMaterial({
  color: map ? '#ffffff' : tint, map, roughness: 0.04, metalness: metal, envMap, envMapIntensity: env,
})
const aluM = (tint, rough = 0.55, map = null) => new THREE.MeshStandardMaterial({
  color: map ? '#ffffff' : tint, map, roughness: rough, metalness: 0, envMap, envMapIntensity: 0.42,
})
const metalM = (tint, rough = 0.3, env = 1.1, map = null) => new THREE.MeshStandardMaterial({
  color: map ? '#ffffff' : tint, map, roughness: rough, metalness: 1, envMap, envMapIntensity: env,
})
const stoneM = (tint, rough = 0.88, map = null) => new THREE.MeshStandardMaterial({
  color: map ? '#ffffff' : tint, map, roughness: rough, metalness: 0, envMap, envMapIntensity: 0.26,
})
// 釉面/抛光面：低粗糙度 + 一点环境反射
const glazeM = (tint, rough = 0.16, map = null) => new THREE.MeshStandardMaterial({
  color: map ? '#ffffff' : tint, map, roughness: rough, metalness: 0.04, envMap, envMapIntensity: 0.85,
})
// 带色贴图（贴图与颜色相乘，用于给同一张纹理换颜色的做法）
const tintedM = (tint, rough, metal, env, map) => new THREE.MeshStandardMaterial({
  color: tint, map, roughness: rough, metalness: metal, envMap, envMapIntensity: env,
})

// 夜间窗光：不用贴图（贴图在小窗格上会被压成条纹），
// 改成在片元里按"世界坐标"切成 2.4m x 3.3m 的格子，逐格随机构造明暗。
// 优点：和几何尺寸无关，大幕墙是密密的窗，小窗格是一整扇亮或暗，不会拉花。
function injectWindowLight(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWinPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWinPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWinPos;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float cx = floor((vWinPos.x + vWinPos.z) * 0.42);
          float cy = floor(vWinPos.y * 0.30);
          float h = fract(sin(cx * 12.9898 + cy * 78.233) * 43758.5453);
          float lit = step(0.26, h);                       // 约 3/4 亮灯
          float br = 0.30 + 0.70 * fract(h * 13.13);        // 每扇亮度不等
          totalEmissiveRadiance *= lit * br;
        }`)
  }
  // 所有玻璃共用同一份注入代码，让它们仍然共享同一个 shader program
  mat.customProgramCacheKey = () => 'win-light'
  mat.needsUpdate = true
}

const M = {
  // 玻璃
  glBlue: glassM('#8fb6d0'),
  glIce: glassM('#b6cfdd', 0.5, 2.0),
  glNavy: glassM('#4a6d8c', 0.5, 1.72),
  glGreen: glassM('#7fae9e', 0.4, 1.85),
  glMint: glassM('#a9d4c4', 0.36, 1.9),
  glAmber: glassM('#c79a5a', 0.38, 1.8),
  glBronze: glassM('#8a6a4e', 0.48, 1.72),
  glRose: glassM('#c08a94', 0.4, 1.85),
  glSmoke: glassM('#5c6a72', 0.55, 1.75),
  glSilver: glassM('#c8d2d8', 0.58, 2.05),
  glWhite: glassM('#dde5e8', 0.45, 2.0),
  glBlack: glassM('#333c44', 0.6, 1.6),
  glFrit: glassM('#ffffff', 0.35, 1.9, fritTex),
  glTeal: glassM('#4f8f92', 0.44, 1.8),
  // 新增玻璃色系
  glViolet: glassM('#8d80b4', 0.42, 1.92),
  glOlive: glassM('#8e9370', 0.44, 1.84),
  glDeepBlue: glassM('#38556e', 0.56, 1.66),
  glChampagne: glassM('#cbb68c', 0.4, 1.9),
  glBlueGreen: glassM('#5f9a9e', 0.46, 1.86),

  // 金属
  gold: metalM('#cbb190', 0.26, 1.15),
  copper: metalM('#a87050', 0.32, 1.05),
  copperAged: metalM('#7a9a86', 0.42, 0.95),
  titan: metalM('#9fa8ae', 0.2, 1.25),
  darkTi: metalM('#414950', 0.34, 0.9),
  brightSilver: metalM('#d8dde0', 0.22, 1.25),
  irid: metalM('#ffffff', 0.16, 1.5, iridTex()),
  rust: metalM('#ffffff', 0.72, 0.5, rustTex),
  brushed: metalM('#b4bcc2', 0.4, 1.0),

  // 实墙
  beige: stoneM('#ffffff', 0.88, stoneTex),
  limestone: stoneM('#d8d0bd'),
  brick: stoneM('#ffffff', 0.92, brickTex),
  brickDark: stoneM('#7e4940', 0.93),
  concrete: stoneM('#ffffff', 0.92, concreteTex),
  concreteDark: stoneM('#8e8b83', 0.94),
  aluPanel: aluM('#c6cbcd', 0.58),
  aluWarm: aluM('#bfb39d', 0.6),
  aluDark: aluM('#5b6266', 0.5),
  enamelRed: aluM('#9e4a42', 0.42),
  enamelYellow: aluM('#c9a955', 0.44),
  enamelBlue: aluM('#3f5f88', 0.44),
  terra: stoneM('#b0603f', 0.86),
  terraPale: stoneM('#c49a72', 0.86),
  whiteStone: stoneM('#e6e4de', 0.86),
  blackStone: stoneM('#4c4e50', 0.82),

  // 表皮
  perf: aluM('#ffffff', 0.5, perfTex),
  screen: stoneM('#ffffff', 0.9, screenTex),
  wood: stoneM('#ffffff', 0.78, woodTex),
  woodDark: stoneM('#6a4a2e', 0.8),
  green: stoneM('#ffffff', 0.95, leafTex),
  greenSoft: stoneM('#5d7a4e', 0.95),

  // 新增：釉面 / 砌块 / 石材 / 阳极氧化 / 金属网
  glaze: glazeM('#ffffff', 0.16, glazeTex),
  glazeWhite: glazeM('#e9e5dd', 0.18),
  glazeRed: glazeM('#8d453c', 0.2),
  breeze: stoneM('#ffffff', 0.82, breezeTex),
  slate: stoneM('#ffffff', 0.6, slateTex),
  marble: glazeM('#ffffff', 0.24, marbleTex),
  anod: metalM('#ffffff', 0.22, 1.15, anodTex),
  mesh: metalM('#ffffff', 0.55, 0.8, meshTex),
  charcoal: stoneM('#3b3f44', 0.7),
  bronze: metalM('#9c7d52', 0.3, 1.0),
  glDark: glassM('#1d272e', 0.8, 1.5),
  wine: stoneM('#6e3a3f', 0.74),
  ochre: stoneM('#b48a54', 0.86),
  sandstone: stoneM('#c8a882', 0.9),

  // 新增：日常建筑的常见材料
  plaster: stoneM('#ffffff', 0.93, plasterTex),
  plasterWarm: stoneM('#e4d6bd', 0.92),
  plasterGrey: stoneM('#cfd0c9', 0.94),
  earth: stoneM('#ffffff', 0.96, earthTex),
  tuff: stoneM('#ffffff', 0.9, tuffTex),
  mosaic: stoneM('#ffffff', 0.55, mosaicTex),
  azulejo: glazeM('#ffffff', 0.2, azulejoTex),
  tileRed: stoneM('#ffffff', 0.86, tileTex),
  thatch: stoneM('#ffffff', 0.98, thatchTex),
  glassBlock: tintedM('#ffffff', 0.3, 0.1, 1.15, blockTex),
  charred: stoneM('#ffffff', 0.82, charredTex),
  siding: stoneM('#ffffff', 0.88, sidingTex),
  corr: tintedM('#dfe6ea', 0.52, 0.35, 0.95, corrTex),
  corrRust: tintedM('#c09a76', 0.7, 0.3, 0.7, corrTex),
  corrRed: tintedM('#b0543e', 0.55, 0.3, 0.85, corrTex),
  corrBlue: tintedM('#3f6b85', 0.55, 0.3, 0.85, corrTex),
  corrGreen: tintedM('#5c7a58', 0.58, 0.3, 0.8, corrTex),
  paintRed: tintedM('#a8453a', 0.62, 0.05, 0.5, paintTex),
  paintGreen: tintedM('#486e56', 0.62, 0.05, 0.5, paintTex),
  paintBlue: tintedM('#3c5b7e', 0.62, 0.05, 0.5, paintTex),
  paintYell: tintedM('#c9a24e', 0.64, 0.05, 0.5, paintTex),
  teak: stoneM('#8a5a34', 0.7),
  darkTile: glazeM('#36393c', 0.32),

  // 双面片材（看台碗体、膜结构屋面）
  sheet: new THREE.MeshStandardMaterial({
    color: '#c9c7bf', roughness: 0.86, metalness: 0.05, envMap, envMapIntensity: 0.35, side: THREE.DoubleSide,
  }),
  membrane: new THREE.MeshStandardMaterial({
    color: '#e8eaea', roughness: 0.42, metalness: 0.12, envMap, envMapIntensity: 0.8, side: THREE.DoubleSide,
  }),

  // 通用
  band: metalM('#5d6c78', 0.42, 0.7),
  bandLight: metalM('#9ba7ae', 0.45, 0.65),
  mullion: metalM('#8d969d', 0.38, 0.9),
  darkFrame: metalM('#333a40', 0.5, 0.45),
  paving: stoneM('#adb0ae'),
  pad: stoneM('#c3bfb4', 0.86),
  curb: stoneM('#9b9d99', 0.9),
  leaf: stoneM('#556e48', 0.9),
  bark: stoneM('#5c4f3f', 0.95),
  roof: stoneM('#8a8d8c', 0.85),
  // 路面标线：哑光漆，夜里不参与自发光（斑马线不再像灯管）
  roadPaint: tintedM('#c2beb2', 0.78, 0.02, 0.28, paintTex),
  // 花树冠（不发光，避免夜里树也在亮）
  blossom: stoneM('#d9a7b4', 0.86),
  blossomWhite: stoneM('#e9e4da', 0.88),
  // 深绿 / 秋色叶，丰富植被色调
  leafDeep: stoneM('#3f5a38', 0.94),
  leafOlive: stoneM('#6f7d4a', 0.92),
  leafAutumn: stoneM('#a8763c', 0.9),
}

// 兜底：幕墙细部（竖梃/横带/压顶/收边框）统一做一点点深度前移。
// 这类构件本来就贴在墙外，和墙面/玻璃面重合时让细部赢，避免转动时闪。
for (const key of ['band', 'bandLight', 'mullion', 'darkFrame', 'titan', 'brightSilver', 'brushed', 'darkTi', 'gold', 'copper', 'copperAged']) {
  const m = M[key]
  if (!m) continue
  m.polygonOffset = true
  m.polygonOffsetFactor = -1
  m.polygonOffsetUnits = -1
}

// ---------- 灯光 ----------
const ambient = new THREE.AmbientLight(0xdfe9f2, 0.2)
scene.add(ambient)
const hemi = new THREE.HemisphereLight(0xbcd8f4, 0x8a8880, 0.42)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xfff6e8, 2.6)
sun.position.set(160, 240, 140)
sun.castShadow = true
sun.shadow.mapSize.set(3072, 3072)
// 阴影视锥必须紧贴建筑群实际范围。原来 ±280/±300 覆盖 560×400，
// 2048 贴图下每个纹素 0.27m，转动时阴影边缘游走 → 这就是"大面积闪烁"的主因。
sun.shadow.camera.near = 20
sun.shadow.camera.far = 2400
sun.shadow.camera.left = -380
sun.shadow.camera.right = 380
sun.shadow.camera.top = 860
sun.shadow.camera.bottom = -860
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.32
sun.shadow.radius = 3
scene.add(sun)
const fill = new THREE.DirectionalLight(0xa8c8ea, 0.3)
fill.position.set(-140, 90, -120)
scene.add(fill)

// ---------- 星空（夜景时显示） ----------
const starGeo = new THREE.BufferGeometry()
{
  const N = 900
  const pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const u = Math.random() * Math.PI * 2
    const v = Math.random() * 0.92 + 0.04
    const r = 3000
    pos[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r
    pos[i * 3 + 1] = v * r
    pos[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: '#dfeaff', size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0,
  depthWrite: false, fog: false,
}))
stars.userData.noMerge = true
stars.frustumCulled = false
scene.add(stars)

// ---------- 昼夜切换 ----------
const NIGHT_GLASS = [
  'glSmoke', 'glWhite', 'glTeal', 'glAmber', 'glViolet', 'glRose',
  'glDeepBlue', 'glBlueGreen', 'glBlue', 'glIce', 'glMint', 'glChampagne', 'glDark',
]
const glassBase = new Map()
for (const k of NIGHT_GLASS) {
  const m = M[k]
  if (m) {
    glassBase.set(k, m.envMapIntensity)
    injectWindowLight(m)
  }
}
// 全部标准材质的日间环境反射强度，夜里统一压低，避免整城反着白天的天光
const matBase = new Map()
for (const k in M) {
  const m = M[k]
  if (m && m.isMeshStandardMaterial) matBase.set(m, m.envMapIntensity)
}
// 夜间窗色：多数暖白，少量冷白/琥珀，形成参差的灯光层次
const nightTint = (k) => ({
  glTeal: '#9fe8d8', glMint: '#b6f0dc', glBlueGreen: '#8fd8d4', glDeepBlue: '#8fb8e8',
  glBlue: '#b6d2f0', glIce: '#cfe4f8', glRose: '#f0b6c4', glViolet: '#c8b6f0',
  glAmber: '#ffcf8a', glChampagne: '#ffe0b0', glDark: '#ffd7a0',
}[k] || '#ffdca8')
let night = false
const nightBtn = document.getElementById('nightBtn')
function setNight(on) {
  night = on
  document.body.classList.toggle('night', on)
  if (nightBtn) nightBtn.textContent = on ? '日景模式' : '夜景模式'
  renderer.toneMappingExposure = on ? 0.95 : 1.0
  // 天空渐变
  const u = sky.material.uniforms
  u.top.value.set(on ? '#050b16' : '#2c6ca8')
  u.mid.value.set(on ? '#0d1c2e' : '#94bade')
  u.bot.value.set(on ? '#22303e' : '#e6ebee')
  u.sun.value.set(0.42, on ? 0.62 : 0.5, 0.58).normalize()
  scene.fog.color.set(on ? '#18242f' : '#bcd0e2')
  scene.fog.near = on ? 700 : 900
  scene.fog.far = on ? 3000 : 3200
  // 光照
  sun.intensity = on ? 0.42 : 2.6
  sun.color.set(on ? '#a8c8f2' : '#fff6e8')
  sun.position.set(on ? -180 : 160, on ? 200 : 240, on ? -160 : 140)
  // 夜景不能太黑：城市里到处是路灯／店铺灯箱，暗部需要抬起来看得到细节
  ambient.intensity = on ? 0.22 : 0.2
  hemi.intensity = on ? 0.34 : 0.42
  hemi.color.set(on ? '#5b7ba8' : '#bcd8f4')
  hemi.groundColor.set(on ? '#2c323a' : '#8a8880')
  fill.intensity = on ? 0.22 : 0.3
  fill.color.set(on ? '#ffcf9a' : '#a8c8ea')
  // 环境反射整体压暗
  for (const [m, base] of matBase) m.envMapIntensity = on ? base * 0.14 : base
  // 窗玻璃自发光 → 万家灯火。
  // 遮罩在 shader 里按世界坐标逐"窗"生成，只有部分窗亮、亮度还各不相同，
  // 所以不会出现整面墙发光，也不会被小窗格压成条纹。
  for (const [k] of glassBase) {
    const m = M[k]
    m.emissive.set(on ? nightTint(k) : '#000000')
    m.emissiveIntensity = on ? 1.25 : 0
  }
  // 白釉灯具、金属铭牌：弱自发光，只当路灯/灯箱用
  M.glazeWhite.emissive.set(on ? '#fff0d0' : '#000000')
  M.glazeWhite.emissiveIntensity = on ? 0.3 : 0
  stars.material.opacity = on ? 0.95 : 0
  if (roam) roam.setNight(on)
  if (nightBtn) nightBtn.setAttribute('aria-pressed', on ? 'true' : 'false')
  // 静态阴影只烘一次，切换光照后重烘
  renderer.shadowMap.needsUpdate = true
}
if (nightBtn) {
  nightBtn.addEventListener('click', () => setNight(!night))
  addEventListener('keydown', (e) => {
    if (e.key === 'n' || e.key === 'N') setNight(!night)
  })
}

// ---------- 工具 ----------
// 单位几何体复用：box / 等径圆柱 / 圆锥都是自相似体，尺寸用 mesh.scale 表达。
// 全场景有上万个小构件，若每个都 new 一份 BufferGeometry，
// 光属性数组分配 + GC 就要好几秒（实测 X ms）。
const SHARED_GEO = new WeakSet()
function sharedGeo(g) { SHARED_GEO.add(g); return g }
const UNIT_BOX = sharedGeo(new THREE.BoxGeometry(1, 1, 1))
const unitCylCache = new Map()
const unitConeCache = new Map()
function unitCyl(seg, open) {
  const key = seg + (open ? 'o' : 'c')
  let g = unitCylCache.get(key)
  if (!g) { g = sharedGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, seg, 1, open)); unitCylCache.set(key, g) }
  return g
}
function unitCone(seg) {
  let g = unitConeCache.get(seg)
  if (!g) { g = sharedGeo(new THREE.ConeGeometry(0.5, 1, seg)); unitConeCache.set(seg, g) }
  return g
}

function add(mesh, x, y, z, parent = scene) {
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}
function box(w, h, d, m, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(UNIT_BOX, m)
  mesh.scale.set(w, h, d)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return add(mesh, x, y, z, parent)
}
function cyl(rT, rB, h, m, x, y, z, seg = 48, parent = scene, open = false) {
  const s = Math.max(3, seg | 0)
  const equal = Math.abs(rT - rB) < 1e-6
  const geo = equal ? unitCyl(s, open) : new THREE.CylinderGeometry(rT, rB, h, s, 1, open)
  const mesh = new THREE.Mesh(geo, m)
  if (equal) mesh.scale.set(rT * 2, h, rT * 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return add(mesh, x, y, z, parent)
}
function group(x, z, yaw = 0) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = yaw
  scene.add(g)
  return g
}

/** 圆角矩形轮廓 */
function roundedProfile(w, d, r) {
  const s = new THREE.Shape()
  const hw = w / 2
  const hd = d / 2
  r = Math.min(r, hw * 0.99, hd * 0.99)
  s.moveTo(-hw + r, -hd)
  s.lineTo(hw - r, -hd)
  s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false)
  s.lineTo(hw, hd - r)
  s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false)
  s.lineTo(-hw + r, hd)
  s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-hw, -hd + r)
  s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}
function prismGeo(w, d, rad, h) {
  const geo = new THREE.ExtrudeGeometry(roundedProfile(w, d, rad), {
    depth: h, bevelEnabled: false, curveSegments: 10,
  })
  geo.rotateX(-Math.PI / 2)
  return geo
}

/** 圆筒竖梃 */
function mullionsRound(parent, r, y0, h, count, mat, topRatio = 1) {
  const geo = new THREE.BoxGeometry(0.08, h, 0.08)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const m = new THREE.Mesh(geo, mat)
    m.position.set(Math.cos(a) * r, y0 + h / 2, Math.sin(a) * r)
    m.lookAt(0, y0 + h / 2, 0)
    // 0.08 宽的竖梃远小于阴影纹素，投影只会变成噪点/闪点，直接不投影
    m.castShadow = false
    parent.add(m)
  }
}
/** 圆角棱柱竖梃 */
function mullionsPrism(parent, w, d, rad, y0, h, count, mat, ox = 0) {
  const pts = roundedProfile(w, d, rad).getSpacedPoints(count)
  const geo = new THREE.BoxGeometry(0.08, h, 0.08)
  for (let i = 0; i < count; i++) {
    const p = pts[Math.floor((i / count) * pts.length)]
    const m = new THREE.Mesh(geo, mat)
    m.position.set(p.x + ox, y0 + h / 2, -p.y)
    m.lookAt(ox, y0 + h / 2, 0)
    m.castShadow = false
    parent.add(m)
  }
}

/** 圆筒：按段收分的玻璃幕墙 + 层间带 + 竖梃 */
function glassCyl(g, r0, r1, y0, h, bands, s) {
  const bh = h / bands
  for (let b = 0; b < bands; b++) {
    const ra = r0 + (r1 - r0) * (b / bands)
    const rb = r0 + (r1 - r0) * ((b + 1) / bands)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, bh, 64, 1, true), s.glass)
    m.castShadow = m.receiveShadow = true
    add(m, 0, y0 + b * bh + bh / 2, 0, g)
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rb + 0.12, rb + 0.12, 0.4, 64, 1, true), s.band)
    add(ring, 0, y0 + (b + 1) * bh, 0, g)
    mullionsRound(g, (ra + rb) / 2 + 0.045, y0 + b * bh, bh, Math.round((ra + rb) * 2.8), s.mullion, rb / ra)
  }
}

/** 塔冠：挑檐 + 穹顶 + 桅杆 */
function crownDome(g, r, y, s, scale = 0.9) {
  // 全部抬 LIFT，避免与楼身顶面、环带共面
  cyl(r * 1.15, r * 1.15, 0.5, s.crown, 0, y + LIFT + 0.25, 0, 56, g)
  cyl(r * 1.01, r * 1.01, 0.85, s.band, 0, y + LIFT + 0.92, 0, 56, g)
  const dr = r * scale
  const dome = new THREE.Mesh(new THREE.SphereGeometry(dr, 56, 22, 0, Math.PI * 2, 0, Math.PI / 2), s.dome)
  dome.castShadow = true
  add(dome, 0, y + LIFT + 1.34, 0, g)
  cyl(0.16, 0.24, dr * 0.8, s.crown, 0, y + LIFT + 1.34 + dr * 0.6, 0, 12, g)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 10), new THREE.MeshBasicMaterial({ color: '#e06858' }))
  add(beacon, 0, y + LIFT + 1.34 + dr * 0.6 + dr * 0.4, 0, g)
  return y + LIFT + 1.34 + dr * 1.05
}
function crownSpire(g, r, y, s, hh = 12) {
  cyl(r * 1.1, r * 1.1, 0.42, s.crown, 0, y + LIFT + 0.21, 0, 48, g)
  cyl(r * 0.9, r * 0.62, 2.4, s.crown, 0, y + LIFT + 1.62, 0, 40, g)
  cyl(0.18, 0.26, hh, s.crown, 0, y + LIFT + 2.8 + hh / 2, 0, 12, g)
  return y + LIFT + 3 + hh
}
/** 平屋顶收头：女儿墙 + 屋顶设备房（大多数真实高楼的收法，替代穹顶） */
function crownFlat(g, r, y, s, o = {}) {
  cyl(r * 1.03, r * 1.03, 0.5, s.crown, 0, y + LIFT + 0.25, 0, 56, g)
  const w = o.w ?? r * 1.0
  box(w, 0.8, w * 0.78, s.band, 0, y + LIFT + 0.9, 0, g)
  if (o.mast !== false) cyl(0.1, 0.16, 3.6, s.mullion, w * 0.34, y + LIFT + 3.1, 0, 8, g)
  return y + LIFT + 1.4
}

// ---------- 屋顶 / 门窗细部（日常建筑用） ----------
function cone(r, h, m, x, y, z, seg = 4, parent = scene) {
  const mesh = new THREE.Mesh(unitCone(Math.max(3, seg | 0)), m)
  mesh.scale.set(r * 2, h, r * 2)
  mesh.castShadow = mesh.receiveShadow = true
  // +0.02：锥底圆盘不能和下面的顶面共面，否则会闪
  return add(mesh, x, y + 0.02, z, parent)
}
/** 双坡屋顶：脊沿 x 向，可带出檐与横向偏移 */
function gableRoof(g, w, d, y, h, mat, over = 0.45, ox = 0) {
  const W = w + over * 2
  const D = d + over * 2
  const shape = new THREE.Shape()
  shape.moveTo(-D / 2, 0); shape.lineTo(D / 2, 0); shape.lineTo(0, h); shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false })
  geo.rotateY(Math.PI / 2)
  geo.translate(-W / 2, 0, 0)
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = m.receiveShadow = true
  // 屋顶底面比墙顶高一点，避免共面闪烁
  return add(m, ox, y + 0.02, 0, g)
}
/** 尖拱轮廓 */
function archShape(w, h, pointy = 0.5) {
  const s = new THREE.Shape()
  const hw = w / 2
  const hb = h * (1 - pointy)
  s.moveTo(-hw, 0)
  s.lineTo(hw, 0)
  s.lineTo(hw, hb)
  s.quadraticCurveTo(hw, h, 0, h)
  s.quadraticCurveTo(-hw, h, -hw, hb)
  s.closePath()
  return s
}
/** 拱形窗/门/券洞（depth 沿 +z 挤出，从 z 处向外） */
function archPanel(w, h, depth, mat, x, y, z, parent = scene, ry = 0) {
  const geo = new THREE.ExtrudeGeometry(archShape(w, h), { depth, bevelEnabled: false, curveSegments: 8 })
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = m.receiveShadow = true
  m.rotation.y = ry
  return add(m, x, y, z, parent)
}
/** 木构架（半木构/ Tudor）：贴在外墙上的梁柱 */
function timberFrame(g, w, d, y0, h, floors, mat) {
  const zf = d / 2 + 0.05
  for (const sz of [-1, 1]) {
    for (let f = 0; f <= floors; f++) box(w + 0.24, 0.28, 0.2, mat, 0, y0 + (h / floors) * f, sz * zf, g)
    for (let i = 0; i <= 4; i++) box(0.26, h, 0.18, mat, -w / 2 + (w / 4) * i, y0 + h / 2, sz * zf, g)
    for (let f = 0; f < floors; f++) {
      // 斜撑
      const yy = y0 + (h / floors) * (f + 0.5)
      for (const sx of [-1, 1]) {
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.2, h / floors * 1.05, 0.16), mat)
        br.position.set(sx * (w / 4), yy, sz * (zf + 0.01))
        br.rotation.z = sx * 0.5
        br.castShadow = true
        g.add(br)
      }
    }
  }
  for (const sx of [-1, 1]) {
    for (let f = 0; f <= floors; f++) box(0.2, 0.28, d + 0.24, mat, sx * (w / 2 + 0.05), y0 + (h / floors) * f, 0, g)
    for (let i = 0; i <= 3; i++) box(0.18, h, 0.26, mat, sx * (w / 2 + 0.05), y0 + h / 2, -d / 2 + (d / 3) * i, g)
  }
}
/** 竖向木格栅（日式格子/窗棂） */
function lattice(g, w, h, y, z, n, mat) {
  for (let i = 0; i < n; i++) box(0.07, h, 0.1, mat, -w / 2 + (w / (n - 1)) * i, y, z, g)
  box(w + 0.16, 0.1, 0.14, mat, 0, y + h / 2, z, g)
  box(w + 0.16, 0.1, 0.14, mat, 0, y - h / 2, z, g)
}
// 叠面偏移：任何"盖子压在上面"的构件都不能和下面的顶面共面，
// 否则深度相等 → 一转动就闪。统一往上抬 LIFT。
const LIFT = 0.03

function crownParapet(g, w, d, y, s, wall) {
  box(w + 0.4, 0.9, d + 0.4, wall, 0, y + LIFT + 0.45, 0, g)
  box(w + 0.56, 0.12, d + 0.56, s.crown, 0, y + LIFT + 0.96, 0, g)
  return y + LIFT + 1.04
}

/** 裙房（圆） */
function podRound(g, r, h, s) {
  cyl(r, r * 0.98, h, s.podium, 0, h / 2, 0, 56, g)
  // 比裙房高 LIFT，避免顶面与压顶底面共面
  cyl(r * 1.03, r * 1.03, 0.22, s.crown, 0, h + LIFT + 0.11, 0, 56, g)
  // 大堂玻璃内缩 0.04，且不进到裙房里面（原来整块埋在实体里，白费三角面还容易闪）
  cyl(r * 0.985, r * 0.985, h * 0.62, s.lobby, 0, h * 0.4, 0, 56, g, true)
  return h + LIFT + 0.22
}
/** 裙房（矩形） */
function podRect(g, w, d, h, s, rad = 2) {
  const m = new THREE.Mesh(prismGeo(w, d, rad, h), s.podium)
  m.castShadow = m.receiveShadow = true
  add(m, 0, 0, 0, g)
  box(w + 1.2, 0.22, d + 1.2, s.crown, 0, h + LIFT + 0.11, 0, g)
  // 大堂玻璃只贴外侧，不实心塞满
  box(w * 0.7, h * 0.6, 0.14, s.lobby, 0, h * 0.45, d * 0.35 - 0.07, g)
  box(w * 0.7, h * 0.6, 0.14, s.lobby, 0, h * 0.45, -d * 0.35 + 0.07, g)
  return h + LIFT + 0.22
}

function S(glass, podium, o = {}) {
  return {
    glass, podium,
    lobby: o.lobby ?? glass,
    band: o.band ?? M.band,
    mullion: o.mullion ?? M.titan,
    crown: o.crown ?? M.titan,
    dome: o.dome ?? glass,
  }
}

// ---------- 立面语法 ----------

/** 实墙 + 凹窗洞 */
function fasciaPunched(g, w, d, y0, floorH, floors, win, reveal, o = {}) {
  const bay = o.bay ?? 3.0
  const ratio = o.ratio ?? 0.6
  const nx = Math.max(2, Math.round(w / bay))
  const nz = Math.max(2, Math.round(d / bay))
  const cwx = w / nx
  const cwz = d / nz
  const wh = floorH * (o.wh ?? 0.56)
  for (let f = 1; f < floors; f++) {
    const y = y0 + floorH * f + floorH * 0.52
    for (let i = 0; i < nx; i++) {
      const px = -w / 2 + cwx * (i + 0.5)
      for (const sz of [-1, 1]) {
        box(cwx * ratio + 0.3, wh + 0.3, 0.24, reveal, px, y, sz * (d / 2 - 0.07), g)
        box(cwx * ratio, wh, 0.05, win, px, y, sz * (d / 2 + 0.05), g)
      }
    }
    for (let i = 0; i < nz; i++) {
      const pz = -d / 2 + cwz * (i + 0.5)
      for (const sx of [-1, 1]) {
        box(0.24, wh + 0.3, cwz * ratio + 0.3, reveal, sx * (w / 2 - 0.07), y, pz, g)
        box(0.05, wh, cwz * ratio, win, sx * (w / 2 + 0.05), y, pz, g)
      }
    }
    if (o.ledge !== false) box(w + 0.14, 0.16, d + 0.14, reveal, 0, y0 + floorH * f, 0, g)
  }
}

/** 实墙 + 横向连续窗带 */
function fasciaRibbon(g, w, d, y0, floorH, floors, win, band, o = {}) {
  const wh = floorH * (o.h ?? 0.48)
  for (let f = 1; f < floors; f++) {
    const y = y0 + floorH * f + floorH * 0.55
    for (const sz of [-1, 1]) {
      box(w + 0.04, wh, 0.1, win, 0, y, sz * (d / 2 + 0.02), g)
      box(w + 0.12, 0.11, 0.15, band, 0, y - wh / 2, sz * (d / 2 + 0.02), g)
      box(w + 0.12, 0.11, 0.15, band, 0, y + wh / 2, sz * (d / 2 + 0.02), g)
    }
    for (const sx of [-1, 1]) {
      box(0.1, wh, d + 0.04, win, sx * (w / 2 + 0.02), y, 0, g)
      box(0.15, 0.11, d + 0.12, band, sx * (w / 2 + 0.02), y - wh / 2, 0, g)
      box(0.15, 0.11, d + 0.12, band, sx * (w / 2 + 0.02), y + wh / 2, 0, g)
    }
    const nx = Math.max(2, Math.round(w / 1.9))
    for (let i = 0; i <= nx; i++) {
      const px = -w / 2 + (w / nx) * i
      for (const sz of [-1, 1]) box(0.07, wh, 0.11, band, px, y, sz * (d / 2 + 0.03), g)
    }
  }
}

/** 竖向遮阳鳍（矩形塔） */
function fasciaFins(g, w, d, y0, h, fin, glass, o = {}) {
  const step = o.step ?? 0.95
  const nx = Math.max(4, Math.round(w / step))
  const nz = Math.max(4, Math.round(d / step))
  const depth = o.depth ?? 0.44
  for (let i = 0; i <= nx; i++) {
    const px = -w / 2 + (w / nx) * i
    for (const sz of [-1, 1]) box(0.1, h, depth, fin, px, y0 + h / 2, sz * (d / 2 + depth / 2), g)
  }
  for (let i = 0; i <= nz; i++) {
    const pz = -d / 2 + (d / nz) * i
    for (const sx of [-1, 1]) box(depth, h, 0.1, fin, sx * (w / 2 + depth / 2), y0 + h / 2, pz, g)
  }
  const every = o.every ?? 4
  if (every > 0) {
    for (let f = every; f * 3.9 < h; f += every) {
      box(w + depth * 2 + 0.4, 0.2, d + depth * 2 + 0.4, fin, 0, y0 + f * 3.9, 0, g)
    }
  }
}

/** 圆筒遮阳鳍 */
function finsRound(g, r, y0, h, fin, o = {}) {
  const n = Math.round(r * 4.4)
  const depth = o.depth ?? 0.46
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, depth), fin)
    // 往墙里插 0.02，细部内表面不能和幕墙面正好贴平（共面必闪）
    m.position.set(Math.cos(a) * (r + depth / 2 - 0.02), y0 + h / 2, Math.sin(a) * (r + depth / 2 - 0.02))
    m.lookAt(0, y0 + h / 2, 0)
    m.castShadow = false
    g.add(m)
  }
  const every = o.every ?? 4
  const fh = o.floorH ?? 3.9
  if (every > 0) {
    for (let f = every; f * fh < h; f += every) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + depth + 0.24, r + depth + 0.24, 0.22, 56), fin)
      ring.castShadow = true
      add(ring, 0, y0 + f * fh, 0, g)
    }
  }
}

/** 斜交网格（diagrid）：两个方向的螺旋管 */
function diagrid(g, r, y0, h, mat, o = {}) {
  const n = o.n ?? 10
  const dirs = [1, -1]
  for (const dir of dirs) {
    for (let i = 0; i < n; i++) {
      const pts = []
      const turns = 1.25
      const steps = 18
      for (let k = 0; k <= steps; k++) {
        const t = k / steps
        const a = (i / n) * Math.PI * 2 + dir * t * Math.PI * 2 * turns
        const rr = r + 0.16 - t * (o.taper ?? 0) * r
        pts.push(new THREE.Vector3(Math.cos(a) * rr, y0 + t * h, Math.sin(a) * rr))
      }
      const curve = new THREE.CatmullRomCurve3(pts)
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, o.radius ?? 0.2, 6, false), mat)
      tube.castShadow = true
      g.add(tube)
    }
  }
  // 每层环梁
  const floors = o.floors ?? 20
  for (let f = 1; f < floors; f++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.14, 0.09, 6, 56), mat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y0 + (h / floors) * f
    ring.castShadow = true
    g.add(ring)
  }
}

// ============================================================
//  24 个塔型
// ============================================================

// —— 一、玻璃幕墙 ——

/** 01 圆柱收分 */
function t01(x, z, s) {
  const g = group(x, z, 0.2)
  const r0 = 9.6
  const r1 = 6.4
  const fh = 3.9
  const h = 30 * fh
  const y0 = podRound(g, r0 * 1.32, fh * 1.6, s)
  glassCyl(g, r0, r1, y0, h, 6, s)
  return { g, top: crownDome(g, r1, y0 + h, s) }
}

/** 02 椭圆截面 */
function t02(x, z, s) {
  const r = t01(0, 0, s)
  r.g.position.set(x, 0, z)
  r.g.scale.set(1.62, 1, 0.76)
  return r
}

/** 03 扭转塔 */
function t03(x, z, s) {
  const g = group(x, z)
  const w = 17
  const d = 15
  const rad = 5
  const fh = 3.9
  const steps = 24
  const H = 32 * fh
  const sh = H / steps
  let y = podRect(g, w * 1.4, d * 1.28, fh * 1.7, s, rad * 1.2)
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    const k = 1 - 0.12 * t
    const seg = new THREE.Mesh(prismGeo(w * k, d * k, rad * k, sh * 1.02), s.glass)
    seg.castShadow = seg.receiveShadow = true
    seg.position.y = y
    seg.rotation.y = Math.PI * 0.6 * t
    g.add(seg)
    if (i % 2 === 1) {
      const ring = new THREE.Mesh(prismGeo(w * k + 0.14, d * k + 0.14, rad * k, 0.34), s.band)
      ring.position.y = y + sh
      ring.rotation.y = Math.PI * 0.6 * t
      g.add(ring)
    }
    y += sh
  }
  box(w * 0.94, 0.6, d * 0.94, s.crown, 0, y + 0.3, 0, g)
  const lan = new THREE.Mesh(prismGeo(w * 0.62, d * 0.62, rad * 0.7, 4.2), s.dome)
  lan.castShadow = true
  add(lan, 0, y + 0.6, 0, g)
  return { g, top: y + 12 }
}

/** 04 三角棱柱 */
function t04(x, z, s) {
  const g = group(x, z, 0.3)
  const r = 11.4
  const fh = 3.9
  const floors = 24
  const H = floors * fh
  const y0 = podRound(g, r * 1.24, fh * 1.5, s)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.84, r, H, 3, 1, true), s.glass)
  m.castShadow = m.receiveShadow = true
  add(m, 0, y0 + H / 2, 0, g)
  for (let f = 1; f < floors; f++) {
    const k = 1 - 0.16 * (f / floors)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * k + 0.1, r * k + 0.1, 0.38, 3, 1, true), s.band)
    band.position.y = y0 + fh * f
    g.add(band)
  }
  mullionsRound(g, r * 0.93, y0, H, 18, s.mullion, 0.84)
  return { g, top: crownFlat(g, r * 0.52, y0 + H, s) }
}

/** 05 六边形 */
function t05(x, z, s) {
  const g = group(x, z, -0.15)
  const r = 10.2
  const fh = 3.9
  const floors = 28
  const H = floors * fh
  const y0 = podRound(g, r * 1.2, fh * 1.6, s)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, H, 6, 1, true), s.glass)
  m.castShadow = m.receiveShadow = true
  add(m, 0, y0 + H / 2, 0, g)
  for (let f = 1; f < floors; f++) {
    const t = f / floors
    const rr = r * (1 - 0.1 * t) + 0.1
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.38, 6, 1, true), s.band)
    band.position.y = y0 + fh * f
    g.add(band)
  }
  mullionsRound(g, r * 0.95, y0, H, 24, s.mullion, 0.9)
  return { g, top: crownDome(g, r * 0.62, y0 + H, s, 0.9) }
}

/** 06 鼓形膨胀筒 */
function t06(x, z, s) {
  const g = group(x, z)
  const fh = 3.9
  let y = podRound(g, 10.4, fh * 1.5, s)
  const H = 24 * fh
  const pts = []
  const steps = 44
  const ribR = 34
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push(new THREE.Vector2(7.0 + Math.sin(t * Math.PI) * 2.7, t * H))
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, ribR), s.glass)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y, 0, g)
  for (let f = 1; f < 24; f++) {
    const t = f / 24
    const rr = 7.0 + Math.sin(t * Math.PI) * 2.7
    const band = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.19, 6, ribR), s.band)
    band.rotation.x = Math.PI / 2
    band.position.y = y + t * H
    g.add(band)
  }
  for (let i = 0; i < ribR; i++) {
    const a = (i / ribR) * Math.PI * 2
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(Math.cos(a) * (p.x + 0.04), y + p.y, Math.sin(a) * (p.x + 0.04))),
    )
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 26, 0.04, 4, false), s.mullion)
    tube.castShadow = true
    g.add(tube)
  }
  y += H
  return { g, top: crownDome(g, 7.0, y, s, 0.95) }
}

// —— 二、实墙开窗 ——

/** 07 石材打孔窗 */
function t07(x, z) {
  const s = S(M.glIce, M.blackStone, { band: M.limestone, crown: M.limestone })
  const g = group(x, z, 0.1)
  const w = 20
  const d = 16
  const rad = 4.5
  const fh = 3.9
  const floors = 20
  const H = floors * fh
  const y0 = podRect(g, w * 1.26, d * 1.26, fh * 1.7, s, rad * 1.1)
  const body = new THREE.Mesh(prismGeo(w, d, rad, H), M.beige)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  fasciaPunched(g, w, d, y0, fh, floors, s.glass, M.limestone, { bay: 3.2, ratio: 0.58 })
  const top = crownParapet(g, w, d, y0 + H, s, M.beige)
  box(w * 0.32, 2.2, d * 0.26, M.roof, -w * 0.16, y0 + H + 2.2, -d * 0.18, g)
  return { g, top: top + 3 }
}

/** 08 红砖小窗 */
function t08(x, z) {
  const s = S(M.glSmoke, M.brickDark, { band: M.brickDark, crown: M.brickDark })
  const g = group(x, z, -0.25)
  const w = 16
  const d = 15
  const rad = 2.4
  const fh = 3.6
  const floors = 18
  const H = floors * fh
  const y0 = podRect(g, w * 1.24, d * 1.2, fh * 1.6, s, rad * 1.1)
  const body = new THREE.Mesh(prismGeo(w, d, rad, H), M.brick)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  fasciaPunched(g, w, d, y0, fh, floors, s.glass, M.brickDark, { bay: 2.7, ratio: 0.44, wh: 0.52 })
  // 阳台板 + 栏板
  for (let f = 2; f < floors; f += 2) {
    const y = y0 + f * fh
    box(7, 0.16, 1.6, M.concreteDark, -w * 0.2, y + 0.08, d / 2 + 0.7, g)
    box(7, 1.0, 0.08, M.concreteDark, -w * 0.2, y + 0.6, d / 2 + 1.44, g)
  }
  const top = crownParapet(g, w, d, y0 + H, s, M.brick)
  return { g, top: top + 2 }
}

/** 09 清水混凝土 */
function t09(x, z) {
  const s = S(M.glNavy, M.concreteDark, { band: M.concreteDark, crown: M.concreteDark })
  const g = group(x, z, 0.18)
  const w = 19
  const d = 17
  const rad = 2
  const fh = 3.9
  const floors = 24
  const H = floors * fh
  const y0 = podRect(g, w * 1.22, d * 1.22, fh * 1.75, s, rad * 1.1)
  const body = new THREE.Mesh(prismGeo(w, d, rad, H), M.concrete)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  fasciaPunched(g, w, d, y0, fh, floors, s.glass, M.concreteDark, { bay: 3.4, ratio: 0.5, ledge: false })
  const top = crownParapet(g, w, d, y0 + H, s, M.concrete)
  return { g, top: top + 2 }
}

/** 10 氟碳铝板横向条窗 */
function t10(x, z) {
  const s = S(M.glSmoke, M.aluDark, { band: M.aluDark, crown: M.aluDark })
  const g = group(x, z, -0.4)
  const w = 22
  const d = 17
  const rad = 3.4
  const fh = 3.9
  const floors = 22
  const H = floors * fh
  const y0 = podRect(g, w * 1.22, d * 1.2, fh * 1.6, s, rad * 1.1)
  const body = new THREE.Mesh(prismGeo(w, d, rad, H), M.aluPanel)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  fasciaRibbon(g, w, d, y0, fh, floors, s.glass, M.aluDark, { h: 0.5 })
  const top = crownParapet(g, w, d, y0 + H, s, M.aluPanel)
  return { g, top: top + 2 }
}

/** 11 搪瓷钢板（彩色） */
function t11(x, z) {
  const s = S(M.glTeal, M.enamelBlue, { band: M.enamelBlue, crown: M.enamelBlue })
  const g = group(x, z, 0.35)
  const w = 17
  const d = 15
  const rad = 3
  const fh = 3.9
  const floors = 16
  const H = floors * fh
  const y0 = podRect(g, w * 1.24, d * 1.24, fh * 1.7, s, rad * 1.1)
  const body = new THREE.Mesh(prismGeo(w, d, rad, H), M.enamelYellow)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  fasciaRibbon(g, w, d, y0, fh, floors, s.glass, M.enamelRed, { h: 0.44 })
  // 色块：每 4 层换一块搪瓷板
  for (let i = 0; i < 3; i++) {
    const yy = y0 + H * (0.18 + i * 0.26)
    box(w + 0.16, fh * 1.6, d + 0.16, i === 1 ? M.enamelRed : M.enamelBlue, 0, yy, 0, g)
  }
  const top = crownParapet(g, w, d, y0 + H, s, M.enamelBlue)
  return { g, top: top + 2 }
}

/** 12 铜板 / 耐候钢 */
function t12(x, z) {
  const s = S(M.glBronze, M.copperAged, { band: M.copper, crown: M.copper, mullion: M.copper })
  const g = group(x, z, -0.1)
  const fh = 3.9
  const floors = 26
  const H = floors * fh
  const r0 = 9.2
  const r1 = 7.6
  const y0 = podRound(g, r0 * 1.3, fh * 1.6, s)
  // 铜板实墙
  cyl(r1, r0, H, M.rust, 0, y0 + H / 2, 0, 56, g)
  // 竖向铜条（随收分走，不能固定半径，否则上端会悬空）
  const n = 40
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * (r0 + 0.08), y0, Math.sin(a) * (r0 + 0.08)),
      new THREE.Vector3(Math.cos(a) * (r1 + 0.08), y0 + H, Math.sin(a) * (r1 + 0.08)),
    ])
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.085, 5, false), M.copper)
    m.castShadow = true
    g.add(m)
  }
  // 窄条窗
  for (let f = 2; f < floors - 1; f++) {
    const y = y0 + f * fh
    const rr = r0 + (r1 - r0) * (f / floors) + 0.05
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.9, 56, 1, true), s.glass)
    add(ring, 0, y, 0, g)
  }
  return { g, top: crownSpire(g, r0, y0 + H, s, 10) }
}

// —— 三、遮阳表皮 ——

/** 13 陶土百叶筒 */
function t13(x, z) {
  const s = S(M.glAmber, M.blackStone, { band: M.terra, crown: M.terra, mullion: M.terra })
  const g = group(x, z)
  const fh = 3.9
  const floors = 24
  const H = floors * fh
  const r = 9.6
  const y0 = podRound(g, r * 1.32, fh * 1.7, s)
  cyl(r, r, H, s.glass, 0, y0 + H / 2, 0, 56, g)
  finsRound(g, r, y0, H, M.terraPale, { depth: 0.5, every: 4, floorH: fh })
  const top = y0 + H
  cyl(r * 1.12, r * 1.12, 0.6, M.terra, 0, top + 0.3, 0, 56, g)
  return { g, top: crownDome(g, r * 0.6, top + 0.6, s, 0.7) }
}

/** 14 木格栅塔 */
function t14(x, z) {
  const s = S(M.glIce, M.concreteDark, { band: M.woodDark, crown: M.woodDark, mullion: M.woodDark })
  const g = group(x, z, 0.25)
  const w = 18
  const d = 16
  const rad = 2.5
  const fh = 3.9
  const floors = 18
  const H = floors * fh
  const y0 = podRect(g, w * 1.24, d * 1.24, fh * 1.7, s, rad * 1.1)
  const body = new THREE.Mesh(prismGeo(w, d, rad, H), s.glass)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  fasciaFins(g, w, d, y0, H, M.wood, s.glass, { step: 0.7, depth: 0.4, every: 3 })
  const top = crownParapet(g, w, d, y0 + H, s, M.woodDark)
  return { g, top: top + 2 }
}

/** 15 穿孔铝板 */
function t15(x, z) {
  const s = S(M.glSmoke, M.aluDark, { band: M.aluDark, crown: M.aluDark })
  const g = group(x, z, -0.3)
  const fh = 3.9
  const floors = 22
  const H = floors * fh
  const r0 = 9.0
  const r1 = 8.0
  const y0 = podRound(g, r0 * 1.3, fh * 1.6, s)
  cyl(r1 * 0.99, r0, H, s.glass, 0, y0 + H / 2, 0, 56, g)
  // 外层穿孔铝包皮
  const skin = new THREE.Mesh(new THREE.CylinderGeometry(r1 + 0.34, r0 + 0.34, H, 56, 1, true), M.perf)
  skin.castShadow = skin.receiveShadow = true
  add(skin, 0, y0 + H / 2, 0, g)
  // 竖向分缝（同样随收分，不要固定半径）
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * (r0 + 0.42), y0, Math.sin(a) * (r0 + 0.42)),
      new THREE.Vector3(Math.cos(a) * (r1 + 0.42), y0 + H, Math.sin(a) * (r1 + 0.42)),
    ])
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.055, 5, false), M.aluDark)
    g.add(m)
  }
  return { g, top: crownFlat(g, r1, y0 + H, s) }
}

/** 16 砖镂空屏 */
function t16(x, z) {
  const s = S(M.glAmber, M.brickDark, { band: M.brickDark, crown: M.brickDark, mullion: M.brickDark })
  const g = group(x, z, 0.4)
  const w = 17
  const d = 15
  const rad = 2
  const fh = 3.9
  const floors = 16
  const H = floors * fh
  const y0 = podRect(g, w * 1.24, d * 1.24, fh * 1.7, s, rad * 1.1)
  const body = new THREE.Mesh(prismGeo(w, d, rad, H), s.glass)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  // 镂空砖屏：比主体外扩
  const shell = new THREE.Mesh(prismGeo(w + 0.7, d + 0.7, rad, H), M.screen)
  shell.castShadow = shell.receiveShadow = true
  add(shell, 0, y0, 0, g)
  // 屏后玻璃缝（每 2 层一条）
  for (let f = 1; f < floors; f += 2) {
    box(w * 0.9, 0.6, 0.2, s.glass, 0, y0 + f * fh, d / 2 + 0.42, g)
    box(0.2, 0.6, d * 0.9, s.glass, w / 2 + 0.42, y0 + f * fh, 0, g)
  }
  const top = crownParapet(g, w + 0.7, d + 0.7, y0 + H, s, M.screen)
  return { g, top: top + 2 }
}

/** 17 绿植退台塔 */
function t17(x, z) {
  const s = S(M.glMint, M.concreteDark, { band: M.concreteDark, crown: M.concreteDark })
  const g = group(x, z, -0.2)
  const fh = 3.9
  let y = 0
  let w = 21
  let d = 18
  const tiers = [
    { floors: 5, shrink: 0.9 },
    { floors: 5, shrink: 0.9 },
    { floors: 5, shrink: 0.9 },
    { floors: 4, shrink: 0.92 },
  ]
  let first = true
  tiers.forEach((T) => {
    const hh = T.floors * fh
    const rad = w * 0.22
    const body = new THREE.Mesh(prismGeo(w, d, rad, hh), s.glass)
    body.castShadow = body.receiveShadow = true
    add(body, 0, y, 0, g)
    if (first) {
      // 首层石材
      const pod = new THREE.Mesh(prismGeo(w + 2, d + 2, rad + 1, fh * 1.6), M.blackStone)
      pod.castShadow = pod.receiveShadow = true
      add(pod, 0, 0, 0, g)
      first = false
      y += fh * 1.6
    }
    for (let f = 1; f < T.floors; f++) {
      const band = new THREE.Mesh(prismGeo(w + 0.12, d + 0.12, rad + 0.06, 0.36), s.band)
      band.position.y = y + fh * f
      g.add(band)
    }
    mullionsPrism(g, w, d, rad, y, hh, 26, s.mullion)
    // 退台花池 + 绿植
    box(w + 0.8, 0.8, d + 0.8, M.concreteDark, 0, y + hh + 0.4, 0, g)
    for (let k = 0; k < 10; k++) {
      const t = (k / 10) * Math.PI * 2
      const rr = Math.min(w, d) * 0.42
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 9), M.greenSoft)
      b.castShadow = true
      add(b, Math.cos(t) * rr, y + hh + 1.3, Math.sin(t) * rr * 0.8, g)
    }
    y += hh + 0.8
    w *= T.shrink
    d *= T.shrink
  })
  return { g, top: y + 4 }
}

/** 18 幻彩不锈钢筒 */
function t18(x, z) {
  const s = S(M.glIce, M.darkTi, { band: M.darkTi, crown: M.brightSilver, mullion: M.brightSilver })
  const g = group(x, z, 0.15)
  const fh = 3.9
  const floors = 26
  const H = floors * fh
  const r0 = 8.8
  const r1 = 7.2
  const y0 = podRound(g, r0 * 1.32, fh * 1.7, s)
  // 幻彩不锈钢板（竖向分格）
  const bands = 26
  const bh = H / bands
  for (let b = 0; b < bands; b++) {
    const ra = r0 + (r1 - r0) * (b / bands)
    const rb = r0 + (r1 - r0) * ((b + 1) / bands)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, bh * 0.94, 56, 1, true), M.irid)
    m.castShadow = m.receiveShadow = true
    add(m, 0, y0 + b * bh + bh / 2, 0, g)
    const gap = new THREE.Mesh(new THREE.CylinderGeometry(rb + 0.02, rb + 0.02, bh * 0.06, 56, 1, true), s.band)
    add(gap, 0, y0 + (b + 1) * bh, 0, g)
  }
  // 窄水平窗（每 6 层）
  for (let f = 6; f < bands; f += 6) {
    const t = f / bands
    const rr = r0 + (r1 - r0) * t + 0.06
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.7, 56, 1, true), s.glass)
    add(ring, 0, y0 + f * bh, 0, g)
  }
  return { g, top: crownFlat(g, r1, y0 + H, s) }
}

// —— 四、特殊造型 ——

/** 19 四棱锥收尖 */
function t19(x, z) {
  const s = S(M.glWhite, M.concreteDark, { band: M.brightSilver, crown: M.brightSilver, mullion: M.brightSilver })
  const g = group(x, z, 0.2)
  const fh = 3.9
  const floors = 26
  const H = floors * fh
  const r = 11
  const y0 = podRect(g, r * 2.5, r * 2.2, fh * 1.6, s, 3)
  // 四棱锥（CylinderGeometry 4 边，顶半径趋 0）
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, r, H, 4, 1, true), s.glass)
  body.castShadow = body.receiveShadow = true
  body.rotation.y = Math.PI / 4
  add(body, 0, y0 + H / 2, 0, g)
  // 层间环
  for (let f = 1; f < floors; f++) {
    const t = f / floors
    const rr = 1.2 + (r - 1.2) * (1 - t)
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rr + 0.1, rr + 0.1, 0.4, 4, 1, true), s.band)
    ring.rotation.y = Math.PI / 4
    ring.position.y = y0 + fh * f
    g.add(ring)
  }
  // 四角棱
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * r, y0, Math.sin(a) * r),
      new THREE.Vector3(Math.cos(a) * 1.2, y0 + H, Math.sin(a) * 1.2),
    ])
    const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.22, 6, false), s.mullion)
    rib.castShadow = true
    g.add(rib)
  }
  cyl(0.2, 0.28, 10, s.crown, 0, y0 + H + 5, 0, 12, g)
  return { g, top: y0 + H + 12 }
}

/** 20 斜交网格塔 */
function t20(x, z) {
  const s = S(M.glTeal, M.darkTi, { band: M.brightSilver, crown: M.brightSilver, mullion: M.brightSilver })
  const g = group(x, z, -0.2)
  const fh = 3.9
  const floors = 34
  const H = floors * fh
  const r0 = 10.2
  const r1 = 7.8
  const y0 = podRound(g, r0 * 1.32, fh * 1.7, s)
  // 内层玻璃筒
  cyl(r1, r0, H, s.glass, 0, y0 + H / 2, 0, 56, g)
  // 外露斜交网格
  diagrid(g, r0, y0, H, M.brightSilver, { n: 9, taper: 0.22, radius: 0.24, floors })
  // 顶部环梁
  cyl(r1 + 0.3, r1 + 0.3, 0.8, M.brightSilver, 0, y0 + H + 0.4, 0, 56, g)
  return { g, top: crownFlat(g, r1, y0 + H + 0.8, s) }
}

/** 21 螺旋塔 */
function t21(x, z) {
  const s = S(M.glSilver, M.darkTi, { band: M.darkTi, crown: M.brightSilver, mullion: M.brightSilver })
  const g = group(x, z)
  const fh = 3.9
  const floors = 30
  const step = fh * 1.02
  const H = floors * fh
  const y0 = podRound(g, 11.5, fh * 1.7, s)
  const rot = Math.PI * 0.55
  for (let f = 0; f < floors; f++) {
    const t = f / floors
    const k = 1 - 0.22 * t
    // 每层一块偏心圆盘（错位形成螺旋）
    const off = 1.5 * t
    const a = rot * t
    const m = new THREE.Mesh(new THREE.CylinderGeometry(8.4 * k, 8.4 * k, step * 0.94, 56), s.glass)
    m.castShadow = m.receiveShadow = true
    m.position.set(Math.cos(a) * off, y0 + f * step + step / 2, Math.sin(a) * off)
    m.rotation.y = a
    g.add(m)
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(9.0 * k, 8.8 * k, 0.2, 56), s.band)
    disc.castShadow = true
    disc.position.set(Math.cos(a) * off, y0 + (f + 1) * step, Math.sin(a) * off)
    g.add(disc)
  }
  const topY = y0 + H + 1.4
  cyl(7.4, 4.4, 4.0, s.glass, 0, topY + 2.0, 0, 48, g)
  cyl(0.22, 0.3, 12, M.brightSilver, 0, topY + 10, 0, 12, g)
  return { g, top: topY + 16 }
}

/** 22 顶部开洞（环形塔冠） */
function t22(x, z) {
  const s = S(M.glNavy, M.aluDark, { band: M.aluDark, crown: M.aluPanel, mullion: M.brightSilver })
  const g = group(x, z, 0.3)
  const fh = 3.9
  const floors = 26
  const H = floors * fh
  const r = 9.6
  const y0 = podRound(g, r * 1.3, fh * 1.6, s)
  glassCyl(g, r, r * 0.9, y0, H, 7, s)
  // 顶部：环形冠，中间开洞
  const topY = y0 + H
  const cRing = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.02, 3.4, 56, 1, true), s.crown)
  cRing.castShadow = cRing.receiveShadow = true
  add(cRing, 0, topY + 1.7, 0, g)
  // 内圈
  const iRing = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, 3.4, 56, 1, true), M.aluDark)
  add(iRing, 0, topY + 1.7, 0, g)
  // 顶面环
  const cap = new THREE.Mesh(new THREE.RingGeometry(r * 0.66, r * 1.02, 56), s.crown)
  cap.rotation.x = -Math.PI / 2
  add(cap, 0, topY + 3.4, 0, g)
  // 洞里几根斜撑
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.6, 0.22), M.brightSilver)
    m.position.set(Math.cos(a) * r * 0.84, topY + 1.7, Math.sin(a) * r * 0.84)
    m.rotation.y = a
    g.add(m)
  }
  return { g, top: topY + 8 }
}

/** 23 双塔 + 空中连桥 */
function t23(x, z) {
  const s = S(M.glRose, M.whiteStone, { band: M.gold, crown: M.gold, mullion: M.gold, dome: M.glRose })
  const g = group(x, z, 0.1)
  const fh = 3.9
  const floors = 24
  const H = floors * fh
  const gap = 8.2
  const r = 6.2
  const y0 = fh * 1.6
  // 裙房
  const pod = new THREE.Mesh(prismGeo(gap * 2 + r * 2.6, r * 2.6, 4, y0), M.whiteStone)
  pod.castShadow = pod.receiveShadow = true
  add(pod, 0, 0, 0, g)
  box(gap * 2 + r * 2.7, 0.24, r * 2.7, M.gold, 0, y0 + 0.12, 0, g)
  for (const dx of [-gap, gap]) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.93, r, H, 48, 1, true), s.glass)
    body.castShadow = body.receiveShadow = true
    add(body, dx, y0 + H / 2, 0, g)
    for (let f = 1; f < floors; f++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.4, 48, 1, true), s.band)
      band.position.set(dx, y0 + fh * f, 0)
      g.add(band)
    }
    // 竖梃（按塔心偏移）
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, H, 0.08), s.mullion)
      m.position.set(dx + Math.cos(a) * (r + 0.04), y0 + H / 2, Math.sin(a) * (r + 0.04))
      m.lookAt(dx, y0 + H / 2, 0)
      g.add(m)
    }
    cyl(r * 1.12, r * 1.12, 0.55, s.crown, dx, y0 + H + 0.28, 0, 48, g)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), s.dome)
    dome.castShadow = true
    add(dome, dx, y0 + H + 0.55, 0, g)
  }
  // 空中连桥（两层）
  for (const fy of [0.42, 0.74]) {
    box(gap * 2 - r * 1.2, 3.4, 5.0, s.glass, 0, y0 + H * fy, 0, g)
    box(gap * 2 - r * 1.2 + 0.4, 0.28, 5.4, s.crown, 0, y0 + H * fy + 1.85, 0, g)
    box(gap * 2 - r * 1.2 + 0.4, 0.28, 5.4, s.crown, 0, y0 + H * fy - 1.85, 0, g)
  }
  return { g, top: y0 + H + r + 4 }
}

/** 24 错位悬挑筒 */
function t24(x, z) {
  const s = S(M.glGreen, M.darkTi, { band: M.darkTi, crown: M.brightSilver, mullion: M.brightSilver })
  const g = group(x, z, -0.35)
  const fh = 3.9
  let y = fh * 1.6
  cyl(12, 12, y, M.blackStone, 0, y / 2, 0, 56, g)
  const segs = [
    { h: 9 * fh, dx: 0, dz: 0, r: 8.6 },
    { h: 8 * fh, dx: 4.0, dz: 2.6, r: 8.0 },
    { h: 7 * fh, dx: -3.2, dz: 4.4, r: 7.4 },
    { h: 6 * fh, dx: 1.8, dz: -3.4, r: 6.6 },
  ]
  for (const sg of segs) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(sg.r * 0.96, sg.r, sg.h, 56, 1, true), s.glass)
    m.castShadow = m.receiveShadow = true
    add(m, sg.dx, y + sg.h / 2, sg.dz, g)
    const nf = Math.round(sg.h / fh)
    for (let f = 1; f < nf; f++) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(sg.r + 0.1, sg.r + 0.1, 0.4, 56, 1, true), s.band)
      ring.position.set(sg.dx, y + fh * f, sg.dz)
      g.add(ring)
    }
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sg.dx + Math.cos(a) * (sg.r + 0.04), y, sg.dz + Math.sin(a) * (sg.r + 0.04)),
        new THREE.Vector3(sg.dx + Math.cos(a) * (sg.r * 0.96 + 0.04), y + sg.h, sg.dz + Math.sin(a) * (sg.r * 0.96 + 0.04)),
      ])
      const mm = new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.045, 4, false), s.mullion)
      g.add(mm)
    }
    cyl(sg.r * 1.16, sg.r * 1.16, 0.5, s.crown, sg.dx, y + sg.h + 0.25, sg.dz, 56, g)
    y += sg.h + 0.5
  }
  return { g, top: y + 4 }
}

// ============================================================
//  五、新增工艺（25–30）
// ============================================================

/** 25 釉面陶瓷腰鼓塔 */
function t25(x, z) {
  const s = S(M.glFrit, M.slate, { band: M.glazeWhite, crown: M.glazeWhite, mullion: M.glazeWhite })
  const g = group(x, z, 0.35)
  const fh = 3.9
  const floors = 30
  const H = floors * fh
  const y0 = podRound(g, 11.4, fh * 1.6, s)
  const prof = (t) => 9.0 - Math.sin(t * Math.PI) * 1.5
  const pts = []
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push(new THREE.Vector2(prof(t), t * H))
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), M.glaze)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  // 横向玻璃凹槽
  for (let f = 2; f < floors; f += 2) {
    const rr = prof(f / floors) + 0.03
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.8, 64, 1, true), s.glass)
    add(ring, 0, y0 + f * fh, 0, g)
  }
  const topY = y0 + H
  cyl(prof(1) * 1.14, prof(1) * 1.14, 0.7, s.crown, 0, topY + 0.35, 0, 64, g)
  return { g, top: crownFlat(g, prof(1) * 0.72, topY + 0.7, s) }
}

/** 26 空心砌块屏塔 */
function t26(x, z) {
  const s = S(M.glAmber, M.ochre, { band: M.ochre, crown: M.ochre, mullion: M.ochre })
  const g = group(x, z, -0.28)
  const fh = 3.9
  const floors = 21
  const H = floors * fh
  const w = 16.5
  const d = 15
  const rad = 2.4
  const y0 = podRect(g, w * 1.26, d * 1.26, fh * 1.7, s, rad * 1.1)
  const body = new THREE.Mesh(prismGeo(w, d, rad, H), s.glass)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  // 砌块屏分三段，段间留缝露出里面的玻璃与暖光
  const segH = H / 3
  for (let k = 0; k < 3; k++) {
    const shell = new THREE.Mesh(prismGeo(w + 0.9, d + 0.9, rad, segH - 1.2), M.breeze)
    shell.castShadow = shell.receiveShadow = true
    add(shell, 0, y0 + k * segH, 0, g)
    // 段缝里的灯槽
    const band = new THREE.Mesh(prismGeo(w + 0.5, d + 0.5, rad, 0.34), M.glChampagne)
    add(band, 0, y0 + k * segH + segH - 0.9, 0, g)
  }
  const top = crownParapet(g, w + 0.9, d + 0.9, y0 + H - 1.2, s, M.breeze)
  return { g, top: top + 2 }
}

/** 27 渐变阳极氧化八棱塔 */
function t27(x, z) {
  const s = S(M.glDeepBlue, M.anod, { band: M.anod, crown: M.darkTi, mullion: M.anod })
  const g = group(x, z, 0.18)
  const fh = 3.9
  const floors = 32
  const H = floors * fh
  const r0 = 11.2
  const r1 = 8.0
  const y0 = podRound(g, r0 * 1.24, fh * 1.7, s)
  // 八棱面 + 竖向渐变贴图（CylinderGeometry 的 v 沿高度走）
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, H, 8, 1, false), M.anod)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0 + H / 2, 0, g)
  // 八条棱线（沿收分角度斜下去）
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * (r0 + 0.06), y0, Math.sin(a) * (r0 + 0.06)),
      new THREE.Vector3(Math.cos(a) * (r1 + 0.06), y0 + H, Math.sin(a) * (r1 + 0.06)),
    ])
    const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.15, 5, false), M.darkTi)
    rib.castShadow = true
    g.add(rib)
  }
  // 深色窄条窗（每 3 层）
  for (let f = 3; f < floors; f += 3) {
    const t = f / floors
    const rr = r0 + (r1 - r0) * t + 0.05
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.55, 8, 1, true), s.glass)
    ring.position.y = y0 + f * fh
    g.add(ring)
  }
  return { g, top: crownSpire(g, r1, y0 + H, s, 9) }
}

/** 28 石板叠涩塔 */
function t28(x, z) {
  const s = S(M.glChampagne, M.marble, { band: M.marble, crown: M.charcoal, mullion: M.charcoal })
  const g = group(x, z, -0.15)
  const fh = 3.9
  let y = podRect(g, 24, 20, fh * 1.7, s, 3)
  const n = 9
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const k = 0.78 + Math.sin(t * Math.PI) * 0.3
    const w = 17 * k
    const d = 15.5 * k
    // 石板薄片（每片约 2.4 层高）
    const slab = new THREE.Mesh(prismGeo(w, d, 4, fh * 2.4), M.slate)
    slab.castShadow = slab.receiveShadow = true
    add(slab, 0, y, 0, g)
    // 片间内缩玻璃带
    const gl = new THREE.Mesh(prismGeo(w - 2.4, d - 2.4, 3.2, fh * 1.15), s.glass)
    add(gl, 0, y + fh * 2.4 + 0.1, 0, g)
    // 大理石板边
    box(w + 0.24, 0.2, d + 0.24, s.band, 0, y + fh * 2.4 + 0.06, 0, g)
    y += fh * 2.4 + fh * 1.15 + 0.2
  }
  box(11.2, 0.4, 10.2, s.crown, 0, y - 0.1, 0, g)
  return { g, top: y + 4 }
}

/** 29 白瓷百叶 + 蓝绿玻璃 */
function t29(x, z) {
  const s = S(M.glBlueGreen, M.glazeWhite, { band: M.glazeWhite, crown: M.glazeWhite, mullion: M.glazeWhite })
  const g = group(x, z, 0.42)
  const fh = 3.9
  const floors = 26
  const H = floors * fh
  const r = 9.4
  const y0 = podRound(g, r * 1.3, fh * 1.6, s)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 56, 1, true), s.glass)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0 + H / 2, 0, g)
  finsRound(g, r, y0, H, M.glazeWhite, { depth: 0.52, every: 3, floorH: fh })
  const topY = y0 + H
  cyl(r * 1.06, r * 1.06, 0.6, s.crown, 0, topY + LIFT + 0.3, 0, 56, g)
  return { g, top: crownFlat(g, r * 0.6, topY + 0.6, s) }
}

/** 30 深色金属网罩 + 暖光内胆 */
function t30(x, z) {
  const s = S(M.glChampagne, M.charcoal, { band: M.charcoal, crown: M.charcoal, mullion: M.charcoal })
  const g = group(x, z, -0.32)
  const fh = 3.9
  const floors = 24
  const H = floors * fh
  const r = 8.8
  const y0 = podRound(g, r * 1.4, fh * 1.7, s)
  // 内胆：暖色自发光（表现室内灯光）
  const glow = new THREE.MeshBasicMaterial({ color: '#e6bd85' })
  cyl(r * 0.9, r * 0.9, H, glow, 0, y0 + H / 2, 0, 40, g, true)
  // 外罩：深色金属网，分三段留缝
  const segH = H / 3
  for (let k = 0; k < 3; k++) {
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, segH - 1.4, 32, 1, true), M.mesh)
    shell.castShadow = shell.receiveShadow = true
    add(shell, 0, y0 + k * segH + (segH - 1.4) / 2, 0, g)
  }
  // 竖向骨架
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, H, 0.14), M.charcoal)
    m.position.set(Math.cos(a) * (r * 1.06), y0 + H / 2, Math.sin(a) * (r * 1.06))
    m.lookAt(0, y0 + H / 2, 0)
    g.add(m)
  }
  const top = crownParapet(g, r * 2.1, r * 2.1, y0 + H - 1.4, s, M.charcoal)
  return { g, top: top + 2 }
}

// ============================================================
//  六、日常与公共建筑（31–54）
//  有意避开"办公楼玻璃盒"：住宅、教堂、清真寺、市集、车库、
//  仓库、灯塔、水塔、粮仓、影院……材料也换成抹灰/夯土/铁皮/
//  陶瓦/茅草/玻璃砖/砌块/烧杉板这类真实城市里最常见的东西。
// ============================================================

/** 31 白灰联排住宅 */
function t31(x, z) {
  const g = group(x, z, 0.1)
  const fh = 3.1
  const floors = 3
  const H = floors * fh
  const uw = 6.6
  for (let i = -1; i <= 1; i++) {
    const ux = i * uw
    box(uw - 0.12, H, 11, M.plaster, ux, H / 2, 0, g)
    for (let f = 0; f < floors; f++) {
      for (const sx of [-1.7, 1.7]) {
        box(1.44, 1.78, 0.14, M.charcoal, ux + sx, 1.95 + f * fh, 5.53, g)
        box(1.2, 1.52, 0.1, M.glWhite, ux + sx, 1.95 + f * fh, 5.63, g)
      }
    }
    box(1.36, 2.5, 0.18, M.paintGreen, ux, 1.25, 5.55, g)
    box(2.3, 0.16, 1.15, M.charcoal, ux, 2.68, 5.9, g)
    gableRoof(g, uw - 0.12, 11, H, 2.9, M.tileRed, 0.4, ux)
  }
  for (const ux of [-uw, uw * 0.5]) {
    box(0.9, 3.4, 0.9, M.brick, ux, H + 2.2, 2.4, g)
    box(1.06, 0.2, 1.06, M.charcoal, ux, H + 3.95, 2.4, g)
  }
  return { g, top: H + 6 }
}

/** 32 半木构坡顶宅 */
function t32(x, z) {
  const g = group(x, z, -0.22)
  const fh = 3.2
  const floors = 3
  const H = floors * fh
  box(12.5, H, 10.5, M.plasterWarm, 0, H / 2, 0, g)
  box(12.7, fh * 0.95, 10.7, M.brickDark, 0, fh * 0.48, 0, g)
  timberFrame(g, 12.5, 10.5, 0, H, floors, M.woodDark)
  for (let f = 0; f < floors; f++) {
    for (const sx of [-3.4, 3.4]) {
      box(1.52, 1.52, 0.12, M.glWhite, sx, fh * (f + 0.58), 5.3, g)
      box(1.72, 0.16, 0.32, M.woodDark, sx, fh * (f + 0.2), 5.38, g)
    }
  }
  box(1.5, 2.4, 0.2, M.teak, 0, 1.2, 5.4, g)
  gableRoof(g, 12.5, 10.5, H, 4.4, M.tileRed, 0.6)
  box(0.9, 3.0, 0.9, M.brick, -4.4, H + 2.0, 0, g)
  return { g, top: H + 7 }
}

/** 33 夯土民居 */
function t33(x, z) {
  const g = group(x, z, 0.3)
  const w = 14
  const d = 11
  const H = 7.6
  box(w, H, d, M.earth, 0, H / 2, 0, g)
  for (let i = 0; i < 7; i++) {
    for (const sz of [-1, 1]) box(0.26, 0.26, 0.9, M.woodDark, -w / 2 + 1.4 + i * 1.9, H - 1.4, sz * (d / 2 + 0.1), g)
  }
  for (const [wx, wy] of [[-4, 4.4], [0, 5.6], [4, 4.4], [-3.4, 2.2], [3.4, 2.2]]) {
    box(1.1, 1.3, 0.18, M.woodDark, wx, wy, d / 2 + 0.02, g)
    box(0.9, 1.1, 0.12, M.glAmber, wx, wy, d / 2 + 0.12, g)
  }
  box(1.5, 2.3, 0.24, M.teak, 0, 1.15, d / 2 + 0.05, g)
  box(w + 0.3, 1.0, d + 0.3, M.earth, 0, H + 0.52, 0, g)
  for (let i = 0; i < 5; i++) box(2.2, 0.5, 1.4, M.earth, -w / 2 + 2 + i * 2.6, H + 1.2, -1.4, g)
  return { g, top: H + 4 }
}

/** 34 波纹铁皮仓库 */
function t34(x, z) {
  const g = group(x, z, -0.12)
  const w = 24
  const d = 15
  const H = 8.5
  box(w, H, d, M.corr, 0, H / 2, 0, g)
  for (let i = 0; i <= 8; i++) box(0.2, H, 0.14, M.corrRust, -w / 2 + (w / 8) * i, H / 2, d / 2 + 0.06, g)
  box(w * 0.86, 1.0, 0.14, M.glSmoke, 0, H - 1.9, d / 2 + 0.06, g)
  box(7.4, 5.2, 0.24, M.charcoal, -4.5, 2.6, d / 2 + 0.08, g)
  for (let i = 0; i < 9; i++) box(7.4, 0.12, 0.1, M.corr, -4.5, 1.0 + i * 0.5, d / 2 + 0.2, g)
  box(1.2, 2.4, 0.2, M.paintRed, 7.6, 1.2, d / 2 + 0.1, g)
  gableRoof(g, w, d, H, 3.2, M.corrRust, 0.5)
  return { g, top: H + 5 }
}

/** 35 清水混凝土美术馆（基座 + 通高展厅 + 天窗 + 水庭 + 坡道） */
function t35(x, z) {
  const g = group(x, z, 0.18)
  const H = 8

  // 场地：广场铺装 + 路缘
  paved(g, 0, 4, 32, 26, M.paving, 4.0, 'x')
  box(30, 0.4, 5.0, M.whiteStone, 0, 0.2, 13.6, g)
  // 基座（清水混凝土台 + 台阶）
  box(28, 0.6, 19, M.concrete, 0, 0.3, 0, g)
  steps(g, 12, 3, 0.2, 0.6, 0.6, M.concrete, 18.4)
  // 主体
  box(26, H, 17, M.concrete, 0, H / 2 + 0.6, 0, g)
  // 模板分缝（竖向 + 横向，细线）
  for (let i = 0; i < 13; i++) for (const sz of [-1, 1]) {
    box(0.05, H - 0.4, 0.06, M.concreteDark, -12.0 + i * 2.0, H / 2 + 0.6, sz * 8.52, g)
  }
  for (const yy of [2.6, 5.0]) for (const sz of [-1, 1]) {
    box(25.9, 0.06, 0.06, M.concreteDark, 0, yy + 0.6, sz * 8.53, g)
  }
  // 通高玻璃展廊（正面） + 竖梃 + 玻璃门
  box(16, 5.4, 0.16, M.glSmoke, -4, 3.6, 8.56, g)
  for (let i = 0; i <= 7; i++) box(0.1, 5.4, 0.2, M.aluDark, -12 + i * 2.28, 3.6, 8.64, g)
  box(16.2, 0.18, 0.26, M.aluDark, -4, 6.4, 8.64, g)
  box(0.1, 5.4, 0.2, M.aluDark, 4.0, 3.6, 8.64, g)
  // 入口门斗 + 雨篷
  box(4.6, 3.4, 0.9, M.glSmoke, 7.2, 2.3, 8.85, g)
  box(6.6, 0.34, 3.2, M.concrete, 7.2, 4.3, 9.9, g)
  for (const sx of [-1, 1]) cyl(0.16, 0.16, 4.2, M.brightSilver, 7.2 + sx * 2.9, 2.1, 11.2, 8, g)
  box(5.0, 0.2, 0.12, M.charcoal, 7.2, 3.6, 8.72, g)
  // 二层体量（悬挑处 + 通高侧窗）
  box(9, 4.4, 11, M.concrete, -3, 10.2, 1, g)
  box(9.1, 0.5, 11.1, M.concrete, -3, 12.65, 1, g)
  for (const sz of [-1, 1]) box(8.6, 1.4, 0.14, M.glSmoke, -3, 10.6, 1 + sz * 5.56, g)
  box(0.14, 1.4, 6.4, M.glSmoke, -3 + 4.56, 10.6, 1, g)
  // 侧面竖向百叶（遮阳）
  for (let i = 0; i < 10; i++) box(0.14, 5.0, 0.7, M.aluDark, 12.9, 3.9, -6.0 + i * 1.35, g)
  for (let i = 0; i < 8; i++) box(0.7, 5.0, 0.14, M.aluDark, -8.0 + i * 1.6, 3.9, -8.9, g)
  // 屋顶：天窗条 + 通风帽 + 女儿墙
  box(24, 0.7, 0.32, M.concrete, 0, H + 1.0, 8.2, g)
  box(24, 0.7, 0.32, M.concrete, 0, H + 1.0, -8.2, g)
  for (const sx of [-1, 1]) box(0.32, 0.7, 17, M.concrete, sx * 12.8, H + 1.0, 0, g)
  box(14, 0.5, 2.4, M.glIce, 0, H + 1.1, -3.6, g)
  for (let i = 0; i < 6; i++) box(0.1, 0.6, 2.4, M.aluDark, -6 + i * 2.4, H + 1.1, -3.6, g)
  for (const [ox, oz] of [[9.0, -5.0], [9.0, -2.0]]) {
    cyl(0.6, 0.6, 1.0, M.aluPanel, ox, H + 1.4, oz, 10, g)
    cyl(0.74, 0.6, 0.24, M.aluDark, ox, H + 2.0, oz, 10, g)
  }
  // 水庭（镜面水池 + 石板桥 + 睡莲）
  box(9.4, 0.2, 6.4, M.whiteStone, -6, 0.1, 11.5, g)
  box(9, 0.2, 6, M.glTeal, -6, 0.1, 11.5, g)
  for (let i = 0; i < 3; i++) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 9), M.leaf)
    add(pad, -8.0 + i * 2.0, 0.24, 10.6 + (i % 2) * 1.2, g)
  }
  box(1.6, 0.16, 6.6, M.whiteStone, -6, 0.35, 11.5, g)
  for (let i = 0; i < 4; i++) box(0.9, 0.05, 0.1, M.glazeWhite, -8.6, 0.06, 9.6 + i * 1.2, g)
  // 室外展品（雕塑）+ 长椅 + 灯 + 树
  const sc = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.28, 8, 18), M.bronze)
  sc.position.set(7.0, 1.5, 12.6)
  sc.rotation.x = 0.4
  sc.castShadow = true
  g.add(sc)
  box(2.0, 0.4, 2.0, M.concrete, 7.0, 0.2, 12.6, g)
  for (const sx of [-1, 1]) benchAt(g, sx * 4.0, 8.6, 0)
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) treeAt(g, sx * (10.2 + i * 3.6), 10.2, 0.85, 3.2, i % 2 ? 'column' : null)
  for (const ox of [-6.0, 2.0, 10.0]) lampPost(g, ox, 16.4, 6.0, 0)
  return { g, top: 16 }
}

/** 36 白色现代主义别墅（底层架空 + 横向长窗 + 屋顶花园 + 泳池） */
function t36(x, z) {
  const g = group(x, z, -0.3)
  const FL0 = 3.2     // 架空层高
  const W = 16
  const D = 10

  // 场地：铺装 + 草坪 + 车道
  paved(g, 0, 6, 30, 20, M.paving, 4.0, 'x')
  box(26, 0.3, 12, M.greenSoft, 0, 0.15, -6.5, g)
  box(6.0, 0.06, 12, M.concrete, 9.0, 0.04, 8.0, g)

  // 架空底层：圆柱 + 玻璃盒子（起居）
  for (const sx of [-6, 6]) for (const sz of [-4, 4]) {
    cyl(0.36, 0.42, FL0, M.plaster, sx, FL0 / 2, sz, 12, g)
    cyl(0.5, 0.5, 0.16, M.concrete, sx, 0.1, sz, 12, g)
  }
  box(13.0, FL0 - 0.2, 6.0, M.glSmoke, -1.0, (FL0 - 0.2) / 2, 0, g)
  for (let i = 0; i <= 6; i++) box(0.09, FL0 - 0.2, 0.12, M.aluDark, -7.5 + i * 2.17, (FL0 - 0.2) / 2, 3.06, g)
  box(13.4, 0.24, 6.4, M.plaster, -1.0, FL0 - 0.12, 0, g)
  // 底层入口 + 台阶 + 雨篷
  box(2.6, 2.4, 0.14, M.teak, 5.4, 1.2, 3.05, g)
  box(4.0, 0.2, 2.4, M.plaster, 5.4, 2.9, 4.4, g)
  steps(g, 4.2, 3, 0.18, 0.5, 0.55, M.whiteStone, 5.0)

  // 主体（2 层居住）
  box(W, FL0, D, M.plaster, 0, FL0 + FL0 / 2, 0, g)
  box(W + 0.2, FL0, D + 0.2, M.plaster, 0, FL0 * 2 + FL0 / 2 - 0.1, 0, g)
  // 横向长窗（正面 + 背面连续带）
  box(W - 1.0, 1.6, 0.16, M.glSmoke, 0, FL0 + 2.1, D / 2 + 0.06, g)
  box(W - 1.0, 1.6, 0.16, M.glSmoke, 0, FL0 * 2 + 1.9, D / 2 + 0.16, g)
  box(W - 1.0, 1.6, 0.16, M.glSmoke, 0, FL0 + 2.1, -D / 2 - 0.06, g)
  box(W - 1.0, 1.6, 0.16, M.glSmoke, 0, FL0 * 2 + 1.9, -D / 2 - 0.16, g)
  // 山墙侧窗
  for (const sx of [-1, 1]) {
    box(0.14, 1.5, D - 2.0, M.glSmoke, sx * (W / 2 + 0.06), FL0 + 2.1, 0, g)
    box(0.14, 1.3, D - 4.0, M.glSmoke, sx * (W / 2 + 0.16), FL0 * 2 + 1.9, 0, g)
  }
  // 白色遮阳板（带形，出挑）
  for (const yy of [FL0 + 0.05, FL0 * 2 + 0.05, FL0 * 3 + 0.05]) {
    box(W + 0.9, 0.28, D + 0.9, M.plaster, 0, yy, 0, g)
  }
  // 竖向分户缝 + 勒脚
  for (let i = 0; i < 5; i++) box(0.1, FL0 * 2, 0.14, M.plasterGrey, -7.0 + i * 3.5, FL0 * 1.5, D / 2 + 0.1, g)

  // 屋顶花园：女儿墙 + 花池 + 遮阳格架 + 楼梯间 + 烟囱
  const RH = FL0 * 3
  box(W, 1.0, 0.24, M.plaster, 0, RH + 0.5, D / 2 - 0.12, g)
  box(W, 1.0, 0.24, M.plaster, 0, RH + 0.5, -D / 2 + 0.12, g)
  for (const sx of [-1, 1]) box(0.24, 1.0, D, M.plaster, sx * (W / 2 - 0.12), RH + 0.5, 0, g)
  for (let i = 0; i < 4; i++) planter(g, -5.5 + i * 3.6, -4.2, 2.4, 1.2, RH)
  box(5.0, 2.4, 5.0, M.plaster, -4.5, RH + 1.2, 1.5, g)
  box(5.3, 0.24, 5.3, M.plaster, -4.5, RH + 2.5, 1.5, g)
  box(1.2, 2.0, 0.14, M.glSmoke, -4.5, RH + 1.1, 4.05, g)
  // 格架（pergola 式）
  for (let i = 0; i < 6; i++) box(0.12, 2.2, 0.12, M.plaster, 1.4 + i * 2.0, RH + 1.1, -3.6, g)
  for (let i = 0; i < 3; i++) box(10.4, 0.14, 0.14, M.plaster, 6.4, RH + 2.2, -3.6 + i * 1.2, g)
  cyl(0.34, 0.4, 3.0, M.plaster, 6.8, RH + 1.5, 3.4, 12, g)   // 烟囱

  // 泳池 + 露台 + 躺椅 + 绿篱
  box(9.0, 0.18, 4.6, M.whiteStone, 5.5, 0.09, 10.6, g)
  box(8.4, 0.16, 4.0, M.glTeal, 5.5, 0.12, 10.6, g)
  for (const sz of [-1, 1]) box(9.2, 0.34, 0.3, M.whiteStone, 5.5, 0.28, 10.6 + sz * 2.4, g)
  for (let i = 0; i < 3; i++) lounger(g, 9.4, 7.2 + i * 1.3, Math.PI / 2)
  // 花园围墙 + 门 + 树
  for (const sx of [-1, 1]) {
    box(0.4, 1.6, 18, M.whiteStone, sx * 14.0, 0.8, 2.0, g)
    box(0.6, 0.14, 18.2, M.whiteStone, sx * 14.0, 1.66, 2.0, g)
  }
  box(28.4, 1.6, 0.4, M.whiteStone, 0, 0.8, 11.0, g)
  for (const sx of [-1, 1]) box(1.4, 2.6, 1.4, M.whiteStone, sx * 3.2, 1.3, 11.0, g)
  box(6.0, 0.14, 0.12, M.aluDark, 0, 2.0, 10.8, g)
  for (const sx of [-1, 1]) {
    treeAt(g, sx * 11.0, -4.0, 1.0, 3.6, 'umbrella')
    treeAt(g, sx * 10.6, 5.6, 0.8, 3.0, 'column')
  }
  carAt(g, 9.0, 9.4, 0, M.charcoal)
  for (const ox of [-8.0, 0, 9.0]) lampPost(g, ox, 12.6, 4.6, 0)
  return { g, top: RH + 5 }
}

/** 37 石造哥特教堂 */
function t37(x, z) {
  const g = group(x, z, 0.1)
  const naveH = 12
  const w = 11
  const d = 23
  box(w, naveH, d, M.tuff, 0, naveH / 2, 0, g)
  for (const sx of [-1, 1]) box(3.16, 7, d - 2, M.tuff, sx * (w / 2 + 1.62), 3.5, 0, g)
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) {
      archPanel(1.9, 4.2, 0.18, M.glViolet, sx * (w / 2 + 0.03), 4.6, -7 + i * 4.7, g, (sx > 0 ? 1 : -1) * Math.PI / 2)
    }
  }
  const rose = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), M.glRose)
  add(rose, 0, naveH - 3.4, d / 2 + 0.02, g)
  gableRoof(g, w, d, naveH, 5.2, M.slate, 0.6)
  box(5.2, 20, 5.2, M.tuff, 0, 10, d / 2 - 0.5, g)
  box(5.6, 0.4, 5.6, M.darkFrame, 0, 20.2, d / 2 - 0.5, g)
  cone(3.6, 9, M.slate, 0, 24.9, d / 2 - 0.5, 4, g)
  archPanel(1.6, 3.4, 0.2, M.teak, 0, 0, d / 2 + 2.1, g)
  box(1.4, 1.6, 0.16, M.charcoal, 0, 17.4, d / 2 + 2.12, g)
  return { g, top: 32 }
}

/** 38 清真寺（拱廊 + 宣礼塔，不用大穹顶） */
function t38(x, z) {
  const g = group(x, z, -0.18)
  const w = 19
  const d = 15
  const H = 8
  box(w, H, d, M.tuff, 0, H / 2, 0, g)
  const bays = 5
  for (let i = 0; i < bays; i++) {
    const px = -w / 2 + (w / bays) * (i + 0.5)
    box(w / bays - 0.5, 5.4, 0.5, M.plasterWarm, px, 2.7, d / 2 + 0.4, g)
    archPanel(w / bays - 1.1, 3.6, 0.3, M.charcoal, px, 0.5, d / 2 + 0.68, g)
  }
  box(w + 0.1, 1.8, d + 0.1, M.azulejo, 0, 0.9, 0, g)
  box(w + 1.2, 0.6, d + 1.2, M.plasterWarm, 0, H + 0.3, 0, g)
  const mx = -w / 2 - 3.2
  const mz = -d / 2 + 3
  cyl(1.9, 2.3, 26, M.plasterWarm, mx, 13, mz, 24, g)
  for (const yy of [9, 17]) cyl(2.5, 2.5, 0.4, M.azulejo, mx, yy, mz, 24, g)
  cyl(3.0, 2.6, 0.6, M.plasterWarm, mx, 19.4, mz, 24, g)
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    box(0.1, 1.1, 0.1, M.gold, mx + Math.cos(a) * 2.95, 20.2, mz + Math.sin(a) * 2.95, g)
  }
  cyl(1.5, 1.9, 3.4, M.plasterWarm, mx, 27.6, mz, 20, g)
  cone(2.2, 4.4, M.gold, mx, 31.5, mz, 8, g)
  archPanel(3.2, 5.2, 0.3, M.teak, 0, 0, d / 2 + 0.68, g)
  return { g, top: 35 }
}

/** 39 砖砌钟楼市政厅（四面立面 + 门廊 + 钟塔） */
function t39(x, z) {
  const g = group(x, z, 0.14)
  const w = 21
  const d = 15
  const H = 12

  // 台基 + 台阶
  box(w + 2.6, 0.5, d + 2.6, M.tuff, 0, 0.25, 0, g)
  box(w + 1.2, 0.9, d + 1.2, M.whiteStone, 0, 0.75, 0, g)
  box(w, H, d, M.brick, 0, H / 2 + 0.6, 0, g)
  // 砖砌壁柱 + 腰线 + 檐口齿饰
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(1.0, H, 1.0, M.brickDark, sx * (w / 2 - 0.4), H / 2 + 0.6, sz * (d / 2 - 0.4), g)
    box(1.1, 0.24, 1.1, M.whiteStone, sx * (w / 2 - 0.4), H + 0.44, sz * (d / 2 - 0.4), g)
  }
  for (const px of [-7.2, -2.4, 2.4, 7.2]) {
    for (const sz of [-1, 1]) box(0.55, H, 0.4, M.brickDark, px, H / 2 + 0.6, sz * (d / 2 + 0.14), g)
  }
  for (const pz of [-4.0, 4.0]) {
    for (const sx of [-1, 1]) box(0.4, H, 0.55, M.brickDark, sx * (w / 2 + 0.14), H / 2 + 0.6, pz, g)
  }
  box(w + 0.5, 0.34, d + 0.5, M.whiteStone, 0, 6.4, 0, g)
  box(w + 1.0, 0.75, d + 1.0, M.whiteStone, 0, H + 0.95, 0, g)
  for (let i = 0; i < 24; i++) {
    for (const sz of [-1, 1]) box(0.36, 0.26, 0.2, M.whiteStone, -w / 2 + 0.7 + i * 0.84, H + 0.5, sz * (d / 2 + 0.55), g)
  }
  // 屋面 + 老虎窗 + 烟囱
  gableRoof(g, w, d, H + 1.3, 3.4, M.copperAged, 0.55)
  for (const ox of [-5.6, 0, 5.6]) {
    box(2.0, 1.6, 1.4, M.brick, ox, H + 2.6, -2.4, g)
    gableRoof(g, 2.0, 1.4, H + 3.4, 0.9, M.copperAged, 0.2)
    box(1.5, 1.0, 0.1, M.glSmoke, ox, H + 2.7, -1.72, g)
  }

  // 窗：四面三层（正面 6 樘，背面 6 樘，两侧 4 樘）
  const bay = (px, pz, ry, ww = 1.4, hh = 1.9, yy = 0) => {
    const s = new THREE.Group()
    s.position.set(px, yy, pz)
    s.rotation.y = ry
    g.add(s)
    box(ww + 0.5, hh + 0.5, 0.16, M.whiteStone, 0, 0, 0, s)
    box(ww, hh, 0.1, M.glSmoke, 0, 0, 0.1, s)
    box(0.07, hh, 0.1, M.darkFrame, 0, 0, 0.14, s)
    box(ww + 0.72, 0.14, 0.34, M.whiteStone, 0, -hh / 2 - 0.28, 0.08, s)
    const arc = new THREE.Mesh(new THREE.TorusGeometry(ww / 2 + 0.18, 0.08, 4, 12, Math.PI), M.whiteStone)
    arc.position.set(0, hh / 2 + 0.3, 0.06)
    s.add(arc)
  }
  for (const yy of [2.6, 8.2]) {
    for (let i = 0; i < 6; i++) {
      const px = -8.0 + i * 3.2
      bay(px, d / 2 + 0.22, 0, 1.4, 1.9, yy)
      bay(px, -d / 2 - 0.22, Math.PI, 1.4, 1.9, yy)
    }
    for (let i = 0; i < 3; i++) {
      const pz = -3.6 + i * 3.6
      bay(w / 2 + 0.22, pz, Math.PI / 2, 1.4, 1.9, yy)
      bay(-w / 2 - 0.22, pz, -Math.PI / 2, 1.4, 1.9, yy)
    }
  }
  // 背立面山墙圆窗
  const ocl = new THREE.Mesh(new THREE.CircleGeometry(0.9, 18), M.glSmoke)
  add(ocl, 0, H + 2.9, -d / 2 - 0.02, g)
  const orr = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.1, 5, 18), M.whiteStone)
  add(orr, 0, H + 2.9, -d / 2 - 0.08, g)

  // 门廊：四柱 + 檐部 + 山花 + 台阶 + 匾额
  colonnade(g, 6.6, 1.2, 4.6, M.whiteStone, d / 2 + 2.4, 4, 0.36)
  box(7.8, 0.3, 3.4, M.whiteStone, 0, 6.1, d / 2 + 2.4, g)
  box(8.2, 0.55, 3.7, M.whiteStone, 0, 6.5, d / 2 + 2.4, g)
  pediment(g, 8.2, 1.4, 0.9, M.whiteStone, 6.78, d / 2 + 2.4)
  box(5.4, 3.6, 0.3, M.teak, 0, 2.4, d / 2 + 0.1, g)
  for (const sx of [-1, 1]) box(0.16, 3.6, 0.3, M.bronze, sx * 2.4, 2.4, d / 2 + 0.06, g)
  steps(g, 8.4, 3, 0.24, 0.55, 0.4, M.whiteStone, d / 2 + 4.0)
  box(3.4, 0.42, 0.1, M.charcoal, 0, 5.65, d / 2 + 2.06, g)
  for (const sx of [-1, 1]) {
    cyl(0.15, 0.2, 0.45, M.glazeWhite, sx * 3.0, 4.4, d / 2 + 3.4, 8, g)
    cyl(0.08, 0.08, 0.8, M.aluDark, sx * 3.0, 4.9, d / 2 + 3.4, 6, g)
  }

  // 钟塔（四角 + 四面钟 + 百叶 + 锥顶）
  const tx = -w / 2 + 1.2
  const tz = d / 2 + 1.2
  box(5.6, 24, 5.6, M.brick, tx, 12, tz, g)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.7, 24, 0.7, M.brickDark, tx + sx * 2.55, 12, tz + sz * 2.55, g)
  }
  for (const yy of [13.4, 16.6, 23.4]) box(6.0, 0.26, 6.0, M.whiteStone, tx, yy, tz, g)
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
    const cx = tx + dx * 2.82, cz = tz + dz * 2.82
    const dial = new THREE.Mesh(new THREE.CircleGeometry(1.4, 22), M.whiteStone)
    dial.position.set(cx, 20, cz)
    dial.rotation.y = ry
    g.add(dial)
    const bez = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.13, 5, 22), M.bronze)
    bez.position.set(cx, 20, cz)
    bez.rotation.y = ry
    g.add(bez)
    const hh = box(0.14, 0.9, 0.06, M.charcoal, cx + dx * 0.07, 20.4, cz + dz * 0.07, g)
    hh.rotation.y = ry
    const mm = box(0.1, 1.24, 0.06, M.charcoal, cx + dx * 0.07, 20.6, cz + dz * 0.07, g)
    mm.rotation.y = ry
    mm.rotation.z = 0.55
    // 钟层百叶
    box(1.9, 1.4, 0.14, M.darkFrame, cx + dx * 0.06, 16.9, cz + dz * 0.06, g)
    for (let k = 0; k < 4; k++) box(1.7, 0.1, 0.18, M.bronze, cx + dx * 0.1, 16.45 + k * 0.28, cz + dz * 0.1, g)
  }
  // 塔顶四坡锥 + 风向标 + 金球
  cone(3.6, 7.8, M.copperAged, tx, 27.9, tz, 4, g)
  cyl(0.08, 0.1, 1.8, M.bronze, tx, 32.8, tz, 6, g)
  box(0.05, 0.07, 1.9, M.bronze, tx, 33.3, tz, g)
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), M.gold)
  add(orb, tx, 33.9, tz, g)
  // 落水管
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) downpipe(g, sx * (w / 2 + 0.3), sz * (d / 2 + 0.3), H + 1.2)

  // 场地：广场铺装 / 树 / 旗杆 / 长椅 / 灯
  paved(g, 0, d / 2 + 8.0, 32, 12, M.paving, 3.6, 'x')
  for (const sx of [-1, 1]) {
    cyl(0.16, 0.2, 8.0, M.brightSilver, sx * 9.0, 4.0, d / 2 + 6.6, 8, g)
    box(0.05, 1.6, 2.4, sx > 0 ? M.paintBlue : M.paintRed, sx * 9.0 + 0.05, 7.0, d / 2 + 7.8, g)
    for (let i = 0; i < 2; i++) treeAt(g, sx * (11.6 + i * 4.2), d / 2 + 3.6, 0.9, 3.2, i % 2 ? 'column' : null)
    benchAt(g, sx * 6.4, d / 2 + 6.4, sx * Math.PI / 2)
    lampPost(g, sx * 13.4, d / 2 + 9.0, 4.6, 0)
    hedge(g, sx * 9.6, d / 2 + 12.6, 9, true, 0.8, 1.0)
  }
  for (const sx of [-1, 1]) box(6.0, 0.14, 18, M.paving, sx * 14.2, 0.07, 0, g)
  return { g, top: 36 }
}

/** 40 玻璃砖温室 / 游泳馆 */
function t40(x, z) {
  const g = group(x, z, 0.2)
  const w = 22
  const d = 12
  const H = 6.5
  box(w + 0.4, 1.2, d + 0.4, M.brickDark, 0, 0.6, 0, g)
  box(w, H, d, M.glassBlock, 0, 1.22 + H / 2, 0, g)
  for (let i = 0; i <= 7; i++) {
    for (const sz of [-1, 1]) box(0.18, H, 0.18, M.darkFrame, -w / 2 + (w / 7) * i, 1.2 + H / 2, sz * (d / 2 + 0.04), g)
  }
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, w + 0.4, 32, 1, true), M.glassBlock)
  vault.rotation.z = Math.PI / 2
  vault.castShadow = vault.receiveShadow = true
  add(vault, 0, 1.22 + H, 0, g)
  for (let i = 0; i <= 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(d / 2, 0.1, 5, 20, Math.PI), M.darkFrame)
    rib.rotation.y = Math.PI / 2
    add(rib, -w / 2 + (w / 6) * i, 1.2 + H, 0, g)
  }
  box(3.4, 3.0, 0.4, M.darkFrame, 0, 1.2 + 1.5, d / 2 + 0.1, g)
  return { g, top: 1.2 + H + d / 2 + 2 }
}

/** 41 木瓦山墙礼拜堂（石基 + 尖塔 + 侧廊 + 墓园） */
function t41(x, z) {
  const g = group(x, z, -0.15)
  const w = 11
  const d = 16
  const H = 7.4
  // 石基 + 台阶
  box(w + 1.2, 0.7, d + 1.2, M.tuff, 0, 0.35, 0, g)
  box(w + 1.5, 0.22, d + 1.5, M.whiteStone, 0, 0.76, 0, g)
  steps(g, 4.6, 3, 0.2, 1.0, 0.85, M.whiteStone, d / 2 + 1.4)
  // 木瓦主体 + 转角压条
  box(w, H, d, M.woodDark, 0, H / 2 + 0.7, 0, g)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.34, H, 0.34, M.plaster, sx * (w / 2 - 0.1), H / 2 + 0.7, sz * (d / 2 - 0.1), g)
  }
  // 腰线 + 檐口
  box(w + 0.3, 0.26, d + 0.3, M.plaster, 0, 3.9, 0, g)
  box(w + 0.24, 0.24, 0.3, M.plaster, 0, H + 0.6, d / 2 + 0.02, g)
  box(w + 0.24, 0.24, 0.3, M.plaster, 0, H + 0.6, -d / 2 - 0.02, g)
  // 山墙尖券窗 + 木百叶
  for (const sx of [-2.6, 2.6]) {
    archPanel(1.7, 3.4, 0.14, M.whiteStone, sx, 2.6, d / 2 + 0.03, g)
    archPanel(1.4, 3.1, 0.14, M.glWhite, sx, 2.6, d / 2 + 0.14, g)
    for (let i = 0; i < 3; i++) box(0.07, 2.4, 0.1, M.darkFrame, sx - 0.4 + i * 0.4, 2.4, d / 2 + 0.24, g)
  }
  // 大门 + 门套 + 门廊雨庇 + 门灯
  archPanel(2.1, 3.6, 0.28, M.teak, 0, 0.7, d / 2 + 0.04, g)
  archPanel(2.5, 3.9, 0.14, M.plaster, 0, 0.7, d / 2 + 0.0, g)
  box(4.4, 0.24, 2.2, M.slate, 0, 4.4, d / 2 + 1.1, g)
  for (const sx of [-1, 1]) {
    box(0.16, 3.4, 0.16, M.teak, sx * 1.9, 2.4, d / 2 + 2.0, g)
    box(0.28, 0.44, 0.28, M.darkFrame, sx * 1.5, 3.2, d / 2 + 0.3, g)
    box(0.22, 0.3, 0.22, M.glazeWhite, sx * 1.5, 3.16, d / 2 + 0.3, g)
  }
  // 主屋顶 + 檐沟 + 雨水管
  gableRoof(g, w, d, H + 0.7, 5.4, M.slate, 0.75)
  for (const sz of [-1, 1]) box(w + 1.5, 0.14, 0.26, M.aluDark, 0, H + 0.68, sz * (d / 2 + 0.7), g)
  for (const sx of [-1, 1]) downpipe(g, sx * (w / 2 + 0.12), d / 2 + 0.2, H + 1.4, M.plaster)
  // 尖塔（钟室 + 尖顶 + 风向鸡）
  const tz = d / 2 - 2.6
  box(2.6, 1.0, 2.6, M.tuff, 0, H + 1.2, tz, g)
  box(2.2, 4.6, 2.2, M.woodDark, 0, H + 4.0, tz, g)
  box(2.45, 0.2, 2.45, M.plaster, 0, H + 5.0, tz, g)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const dx = Math.sin(a)
    const dz = Math.cos(a)
    archPanel(0.9, 1.5, 0.14, M.charcoal, dx * 1.11, H + 4.6, tz + dz * 1.11, g, a)
  }
  cone(2.1, 4.8, M.slate, 0, H + 7.4, tz, 4, g)
  cyl(0.1, 0.12, 1.4, M.copperAged, 0, H + 10.4, tz, 6, g)
  box(1.1, 0.1, 0.1, M.copperAged, 0.1, H + 10.9, tz, g)
  // 侧廊（矮披檐）+ 侧窗
  for (const sx of [-1, 1]) {
    box(2.0, 2.9, d - 4, M.woodDark, sx * (w / 2 + 1.0), 2.15, 0, g)
    box(2.4, 0.2, d - 3.6, M.slate, sx * (w / 2 + 1.0), 3.7, 0, g).rotation.z = sx * 0.12
    for (let i = 0; i < 3; i++) {
      const wz = -4.2 + i * 4.2
      archPanel(1.0, 2.0, 0.14, M.whiteStone, sx * (w / 2 + 2.02), 2.2, wz, g, sx > 0 ? Math.PI / 2 : -Math.PI / 2)
      archPanel(0.8, 1.8, 0.1, M.glWhite, sx * (w / 2 + 2.1), 2.2, wz, g, sx > 0 ? Math.PI / 2 : -Math.PI / 2)
    }
  }
  // 后殿
  const apse = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, H - 0.2, 14, 1, false, -Math.PI / 2, Math.PI), M.woodDark)
  add(apse, 0, (H - 0.2) / 2 + 0.7, -d / 2, g)
  const apseRoof = new THREE.Mesh(new THREE.SphereGeometry(3.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.slate)
  apseRoof.scale.set(1, 0.6, 1)
  add(apseRoof, 0, H + 0.4, -d / 2, g)
  // 墓园 + 石墙 + 柏树 + 长椅
  box(26, 0.7, 0.5, M.tuff, 0, 0.35, -13.2, g)
  box(26.2, 0.16, 0.7, M.whiteStone, 0, 0.76, -13.2, g)
  for (let i = 0; i < 6; i++) {
    const tx = -10 + i * 4.0
    box(0.8, 1.0 + (i % 3) * 0.18, 0.2, M.whiteStone, tx, 0.85, -11.2 + (i % 2) * 1.4, g)
    crossAt(g, tx, 1.4 + (i % 3) * 0.18, -11.2 + (i % 2) * 1.4, 0.42, M.whiteStone)
  }
  box(24, 0.12, 6.5, M.greenSoft, 0, 0.08, -10.4, g)
  for (let i = 0; i < 4; i++) treeAt(g, -8 + i * 5.4, -12.0, 0.72, 2.6, 'column')
  for (const sx of [-1, 1]) treeAt(g, sx * 9.0, 6.0, 0.95, 3.4)
  benchAt(g, 7.4, 4.6, -Math.PI / 2)
  lampPost(g, -6.4, d / 2 + 3.0, 4.0, Math.PI)
  paved(g, 0, d / 2 + 4.6, 20, 7, M.paving, 2.4, 'x')
  return { g, top: H + 12 }
}

/** 42 茅草屋顶小屋 */
function t42(x, z) {
  const g = group(x, z, 0.35)
  const w = 9.5
  const d = 7.5
  const H = 4.6
  box(w, H, d, M.plaster, 0, H / 2, 0, g)
  box(w + 0.2, 0.8, d + 0.2, M.tuff, 0, 0.4, 0, g)
  gableRoof(g, w, d, H, 5.0, M.thatch, 1.5)
  box(1.4, 1.4, 1.0, M.thatch, 0, H + 2.2, d / 2 + 0.4, g)
  box(0.9, 0.9, 0.14, M.glAmber, 0, H + 2.2, d / 2 + 0.92, g)
  box(1.3, 2.2, 0.2, M.teak, -2.2, 1.1, d / 2 + 0.06, g)
  for (const sx of [1.2, 3.0]) {
    box(1.0, 1.2, 0.16, M.glAmber, sx, 2.4, d / 2 + 0.04, g)
    for (const o of [-1, 1]) box(0.46, 1.3, 0.1, M.paintGreen, sx + o * 0.78, 2.4, d / 2 + 0.12, g)
  }
  box(0.8, 3.2, 0.8, M.tuff, 3.4, H + 2.6, -1.4, g)
  return { g, top: H + 8 }
}

/** 43 集装箱堆叠公寓（模块错叠 + 楼梯核 + 入户平台 + 场地） */
function t43(x, z) {
  const g = group(x, z, -0.2)
  const mats = [M.corrRed, M.corrBlue, M.corrGreen, M.corrRust]
  const cw = 11.6
  const ch = 2.7
  const cd = 5.0
  const lvls = 4

  // 场地：铺装 + 碎石带 + 绿篱
  paved(g, 0, 2, 32, 22, M.paving, 4.0, 'x')
  box(30, 0.06, 3.0, M.concreteDark, 0, 0.05, 12.4, g)

  // 集装箱模块：南北向，逐层错位 + 悬挑
  let k = 0
  for (let lvl = 0; lvl < lvls; lvl++) {
    const count = 3 - Math.floor(lvl / 2)
    for (let i = 0; i < count; i++) {
      const ox = (i - (count - 1) / 2) * (cd + 0.6) + (lvl % 2 ? 0.5 : 0)
      const oz = (lvl % 2 ? 1 : -1) * (lvl * 0.45)
      const m = mats[(k++) % mats.length]
      const y0 = lvl * ch
      box(cw, ch, cd, m, ox, y0 + ch / 2, oz, g)
      // 波纹壁（横向浅肋）
      for (let j = 0; j < 10; j++) {
        for (const sz of [-1, 1]) box(cw - 0.5, 0.06, 0.06, M.darkFrame, ox, y0 + 0.35 + j * 0.22, oz + sz * (cd / 2 + 0.02), g)
      }
      // 端墙波肋
      for (let j = 0; j < 10; j++) {
        for (const sx of [-1, 1]) box(0.06, 0.06, cd - 0.5, M.darkFrame, ox + sx * (cw / 2 + 0.02), y0 + 0.35 + j * 0.22, oz, g)
      }
      // 角柱 + 顶部/底部边框
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box(0.3, ch, 0.3, M.aluDark, ox + sx * (cw / 2 - 0.1), y0 + ch / 2, oz + sz * (cd / 2 - 0.1), g)
      }
      box(cw + 0.1, 0.14, cd + 0.1, M.aluDark, ox, y0 + ch - 0.06, oz, g)
      box(cw + 0.1, 0.14, cd + 0.1, M.aluDark, ox, y0 + 0.06, oz, g)
      // 开门/开窗（朝 +z 面）
      box(1.0, 2.1, 0.12, M.teak, ox + 2.6, y0 + 1.05, oz + cd / 2 + 0.06, g)
      box(2.2, 1.3, 0.12, M.glSmoke, ox - 2.2, y0 + 1.45, oz + cd / 2 + 0.06, g)
      box(2.4, 0.1, 0.14, M.darkFrame, ox - 2.2, y0 + 2.14, oz + cd / 2 + 0.08, g)
      for (let j = 0; j < 3; j++) box(0.08, 1.3, 0.12, M.darkFrame, ox - 3.0 + j * 0.8, y0 + 1.45, oz + cd / 2 + 0.1, g)
      // 空调外机挂架
      box(0.9, 0.7, 0.5, M.glazeWhite, ox + cw / 2 - 0.9, y0 + 0.7, oz + cd / 2 + 0.3, g)
      // 入户平台 + 栏杆（每层外侧）
      if (lvl > 0) {
        box(cw - 1.0, 0.14, 1.5, M.aluPanel, ox, y0 + 0.07, oz + cd / 2 + 0.85, g)
        box(cw - 1.0, 0.08, 0.08, M.brightSilver, ox, y0 + 1.15, oz + cd / 2 + 1.55, g)
        for (let j = 0; j < 6; j++) box(0.06, 1.1, 0.06, M.brightSilver, ox - (cw - 1.2) / 2 + j * ((cw - 1.2) / 5), y0 + 0.6, oz + cd / 2 + 1.55, g)
      }
    }
  }
  // 楼梯 / 电梯核心筒（东侧）
  const coreX = cw / 2 + 2.6
  box(3.4, ch * lvls + 1.6, 5.4, M.concrete, coreX, (ch * lvls + 1.6) / 2, 0, g)
  for (let lvl = 0; lvl < lvls; lvl++) {
    box(3.5, 0.18, 1.6, M.aluPanel, coreX, lvl * ch + ch, 3.5, g)
    box(2.0, 2.0, 0.12, M.glSmoke, coreX, lvl * ch + 1.2, -2.72, g)
    box(1.2, 2.1, 0.12, M.teak, coreX - 3.4 / 2 * 0 + 0, lvl * ch + 1.05, 2.72, g)
  }
  box(3.7, 0.3, 5.7, M.aluDark, coreX, ch * lvls + 1.7, 0, g)
  // 核心筒外挂疏散楼梯 + 栏杆
  for (let lvl = 0; lvl < lvls; lvl++) {
    for (let j = 0; j < 6; j++) {
      box(1.0, 0.07, 0.26, M.aluDark, coreX - 4.6, lvl * ch + 0.2 + j * 0.42, -1.4 + j * 0.5, g)
    }
    box(0.08, 1.0, 3.0, M.brightSilver, coreX - 5.1, lvl * ch + 0.9, 0.0, g)
  }
  // 顶部连廊 + 屋面设备
  box(cw + 2.0, 1.6, 1.6, M.aluPanel, -1.0, ch * lvls + 0.8, 0, g)
  box(4.0, 1.2, 3.0, M.aluPanel, -3.0, ch * lvls + 2.0, -1.0, g)
  for (const ox of [0.4, 2.4]) cyl(0.5, 0.5, 1.0, M.aluPanel, ox, ch * lvls + 1.9, 1.4, 10, g)
  // 场地：入口门廊 + 车 + 树 + 灯 + 垃圾站
  box(5.0, 3.0, 2.0, M.glazeWhite, 1.0, 1.5, 9.0, g)
  box(6.0, 0.28, 3.0, M.aluPanel, 1.0, 3.2, 9.6, g)
  steps(g, 5.4, 3, 0.18, 0.45, 0.5, M.concrete, 10.6)
  box(2.4, 2.0, 2.4, M.paintGreen, -13.0, 1.0, 10.0, g)
  box(2.6, 0.2, 2.6, M.aluDark, -13.0, 2.1, 10.0, g)
  for (const [cx, cz] of [[-12.0, 6.0], [-7.6, 6.0], [8.0, 6.0]]) carAt(g, cx, cz, Math.PI / 2, M.glSilver)
  for (let i = 0; i < 3; i++) treeAt(g, -14.0 + i * 4.4, -8.0, 0.85, 3.0, 'column')
  for (let i = 0; i < 4; i++) bushAt(g, -10.0 + i * 6.0, 12.8, 0.6)
  for (const ox of [-12.0, 2.0, 14.0]) lampPost(g, ox, 11.0, 5.6, 0)
  return { g, top: ch * lvls + 4 }
}

/** 44 立体车库 */
function t44(x, z) {
  const g = group(x, z, 0.12)
  const w = 21
  const d = 15
  const lv = 5
  const lh = 3.2
  for (let i = 0; i < lv; i++) {
    box(w, 0.4, d, M.concrete, 0, i * lh, 0, g)
    for (const sz of [-1, 1]) {
      for (let j = 0; j < 4; j++) box(w, 0.7, 0.14, M.concreteDark, 0, i * lh + 1.0 + j * 0.62, sz * (d / 2), g)
      for (let j = 0; j <= 6; j++) box(0.3, lh - 0.4, 0.3, M.concreteDark, -w / 2 + (w / 6) * j, i * lh + lh / 2, sz * (d / 2), g)
    }
  }
  for (let i = 0; i < lv - 1; i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 15), M.concreteDark)
    r.rotation.z = 0.14
    add(r, -w / 2 - 3.2, i * lh + lh / 2, 0, g)
  }
  return { g, top: lv * lh + 3 }
}

/** 45 老式砖砌公寓（四面立面 + 消防梯 + 底层商铺 + 屋顶木箱水塔） */
function t45(x, z) {
  const g = group(x, z, 0.22)
  const w = 17
  const d = 12
  const floors = 6
  const fh = 3.2
  const H = floors * fh

  // 人行道 + 台阶
  box(w + 5.0, 0.22, d + 5.0, M.paving, 0, 0.11, 0.6, g)
  box(w + 0.9, 0.9, d + 0.9, M.whiteStone, 0, 0.75, 0, g)
  box(w, H, d, M.brick, 0, H / 2 + 0.6, 0, g)
  // 转角隅石 + 腰线 + 檐口托石
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let k = 0; k < 8; k++) {
      const hh = k % 2 ? 0.7 : 1.0
      box(1.1, hh, 1.1, k % 2 ? M.whiteStone : M.brickDark, sx * (w / 2 - 0.35), 1.2 + k * 1.0 + hh / 2, sz * (d / 2 - 0.35), g)
    }
  }
  for (let f = 1; f < floors; f++) box(w + 0.24, 0.16, d + 0.24, M.whiteStone, 0, 0.6 + f * fh, 0, g)
  box(w + 0.8, 0.7, d + 0.8, M.whiteStone, 0, H + 0.95, 0, g)
  for (let i = 0; i < 16; i++) {
    for (const sz of [-1, 1]) box(0.4, 0.42, 0.3, M.whiteStone, -w / 2 + 0.7 + i * 1.04, H + 0.45, sz * (d / 2 + 0.4), g)
    for (const sx of [-1, 1]) box(0.3, 0.42, 0.4, M.whiteStone, sx * (w / 2 + 0.4), H + 0.45, -d / 2 + 0.7 + i * 0.76, g)
  }
  // 女儿墙
  box(w + 0.4, 0.8, 0.32, M.brick, 0, H + 1.6, d / 2 - 0.16, g)
  box(w + 0.4, 0.8, 0.32, M.brick, 0, H + 1.6, -d / 2 + 0.16, g)
  for (const sx of [-1, 1]) box(0.32, 0.8, d, M.brick, sx * (w / 2 - 0.16), H + 1.6, 0, g)
  for (let i = 0; i < 14; i++) box(w + 0.6, 0.14, 0.42, M.whiteStone, 0, H + 2.06, d / 2 - 0.16, g)

  // 窗：四面开窗（正面 5 樘，背面 5 樘，两侧 3 樘）
  const winAt = (px, pz, ry, ww = 1.6, hh = 2.0, yy = 0) => {
    const s = new THREE.Group()
    s.position.set(px, yy, pz)
    s.rotation.y = ry
    g.add(s)
    box(ww + 0.5, hh + 0.5, 0.14, M.whiteStone, 0, 0, 0, s)
    box(ww, hh, 0.1, M.glSmoke, 0, 0, 0.09, s)
    box(0.07, hh, 0.1, M.darkFrame, 0, 0, 0.14, s)
    box(ww, 0.07, 0.1, M.darkFrame, 0, hh * 0.2, 0.14, s)
    box(ww + 0.7, 0.12, 0.3, M.whiteStone, 0, -hh / 2 - 0.26, 0.08, s)
    // 窗楣石 + 窗下小线脚
    box(ww + 0.6, 0.2, 0.26, M.whiteStone, 0, hh / 2 + 0.26, 0.08, s)
  }
  for (let f = 0; f < floors; f++) {
    const yy = 2.2 + f * fh
    for (let i = 0; i < 5; i++) {
      const px = -6.6 + i * 3.3
      winAt(px, d / 2 + 0.16, 0, 1.6, 2.0, yy)
      winAt(px, -d / 2 - 0.16, Math.PI, 1.6, 2.0, yy)
    }
    for (let i = 0; i < 3; i++) {
      const pz = -3.4 + i * 3.4
      winAt(w / 2 + 0.16, pz, Math.PI / 2, 1.4, 2.0, yy)
      winAt(-w / 2 - 0.16, pz, -Math.PI / 2, 1.4, 2.0, yy)
    }
    // 空调外机（错落，不每户都有）
    if (f > 0) {
      for (let i = 0; i < 5; i++) {
        if ((i + f) % 3 !== 0) continue
        acUnit(g, -6.6 + i * 3.3 + 1.2, yy - 1.3, d / 2 + 0.34, 0)
      }
      // 落水管贴附
      for (const sx of [-1, 1]) downpipe(g, sx * (w / 2 - 1.4), d / 2 + 0.3, yy + 0.4)
    }
  }

  // 底层商铺（正面）+ 门厅 + 雨篷
  box(w - 1.0, 2.6, 0.2, M.glTeal, 0, 1.9, d / 2 + 0.14, g)
  for (let i = 0; i <= 5; i++) box(0.12, 2.6, 0.24, M.aluDark, -8.0 + i * 3.2, 1.9, d / 2 + 0.24, g)
  box(w - 0.8, 0.3, 0.9, M.aluPanel, 0, 3.35, d / 2 + 0.5, g)
  box(3.6, 2.6, 0.24, M.teak, -4.6, 1.4, d / 2 + 0.26, g)
  // 店铺招牌 + 挑出灯箱
  for (const [ox, mat] of [[-4.6, M.paintGreen], [1.2, M.paintRed], [6.0, M.paintBlue]]) {
    box(3.0, 0.5, 0.14, mat, ox, 2.75, d / 2 + 0.42, g)
    box(2.6, 0.16, 0.1, M.glazeWhite, ox, 2.75, d / 2 + 0.5, g)
  }

  // 消防梯（正面偏西，逐层钢平台 + 斜梯）
  for (let f = 1; f < floors; f++) {
    const yy = f * fh
    box(4.6, 0.12, 1.5, M.darkFrame, -3.2, yy + 0.4, d / 2 + 0.9, g)
    box(4.6, 0.07, 0.07, M.darkFrame, -3.2, yy + 1.5, d / 2 + 1.6, g)
    for (let j = 0; j <= 5; j++) box(0.07, 1.1, 0.07, M.darkFrame, -5.5 + j * 0.92, yy + 0.95, d / 2 + 1.6, g)
    // 斜梯
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 3.4), M.darkFrame)
    ladder.position.set(-4.4, yy + 1.8, d / 2 + 1.0)
    ladder.rotation.x = 0.72
    g.add(ladder)
    for (let j = 0; j < 7; j++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.24), M.darkFrame)
      st.position.set(-4.4, yy + 0.9 + j * 0.34, d / 2 + 0.2 + j * 0.36)
      g.add(st)
    }
  }
  // 首层平台斜梯（下到地面）
  const bottomLadder = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 3.6), M.darkFrame)
  bottomLadder.position.set(-4.4, 1.4, d / 2 + 1.4)
  bottomLadder.rotation.x = 0.86
  g.add(bottomLadder)

  // 屋面：木箱水塔 + 楼梯间 + 烟囱
  const tx = 1.0
  const ty = H + 2.2
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.24, 1.6, 0.24, M.aluDark, tx + sx * 1.5, ty + 0.8, -2.0 + sz * 1.5, g)
  box(4.0, 0.2, 4.0, M.aluDark, tx, ty + 1.7, -2.0, g)
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.2, 16), M.wood)
  add(tank, tx, ty + 3.0, -2.0, g)
  for (let i = 0; i < 4; i++) cyl(1.65, 1.65, 0.1, M.darkFrame, tx, ty + 2.1 + i * 0.55, -2.0, 16, g, true)
  cone(1.8, 1.2, M.aluPanel, tx, ty + 4.7, -2.0, 12, g)
  box(4.0, 2.6, 3.6, M.brick, -6.0, H + 2.9, -2.0, g)
  box(4.3, 0.3, 3.9, M.whiteStone, -6.0, H + 4.35, -2.0, g)
  box(1.0, 2.0, 0.12, M.teak, -6.0, H + 2.6, -0.14, g)
  cyl(1.3, 1.3, 1.8, M.brickDark, 6.4, H + 2.5, -2.4, 12, g)

  // 后巷 + 垃圾桶 + 树 + 车
  box(3.0, 0.1, 18, M.concreteDark, 0, 0.05, -d / 2 - 4.0, g)
  for (const [bx, bz] of [[-6.0, -9.6], [-4.4, -9.6]]) {
    cyl(0.5, 0.42, 1.1, M.paintGreen, bx, 0.55, bz, 10, g)
    cyl(0.54, 0.54, 0.12, M.aluDark, bx, 1.16, bz, 10, g)
  }
  for (let i = 0; i < 3; i++) treeAt(g, -9.0 + i * 9.0, -9.0, 0.9, 3.2, i % 2 ? 'column' : null)
  carAt(g, 8.6, 8.6, Math.PI / 2, M.glSilver)
  for (const ox of [-8.0, 0, 8.0]) lampPost(g, ox, 8.4, 5.0, 0)
  for (const sx of [-1, 1]) benchAt(g, sx * 4.2, 8.0, 0)
  return { g, top: H + 8 }
}

/** 46 拱廊市集（玻璃拱顶） */
function t46(x, z) {
  const g = group(x, z, -0.1)
  const w = 26
  const d = 16
  const H = 6
  box(w, H, d, M.brick, 0, H / 2, 0, g)
  for (let i = 0; i < 7; i++) {
    const px = -w / 2 + (w / 7) * (i + 0.5)
    archPanel(2.4, 4.2, 0.3, M.charcoal, px, 0.5, d / 2 + 0.02, g)
    archPanel(2.4, 4.2, 0.3, M.charcoal, px, 0.5, -d / 2 - 0.32, g, Math.PI)
    box(w / 7 - 0.4, 0.5, 0.6, M.whiteStone, px, 5.0, d / 2 + 0.1, g)
  }
  for (const oz of [-d / 4, d / 4]) {
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, w, 24, 1, true), M.glFrit)
    vault.rotation.z = Math.PI / 2
    vault.castShadow = vault.receiveShadow = true
    add(vault, 0, H, oz, g)
  }
  for (let i = 0; i <= 6; i++) {
    for (const oz of [-d / 4, d / 4]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.1, 5, 18, Math.PI), M.darkFrame)
      rib.rotation.y = Math.PI / 2
      add(rib, -w / 2 + (w / 6) * i, H, oz, g)
    }
  }
  for (let i = 0; i < 3; i++) box(4.4, 0.16, 2.0, i % 2 ? M.paintRed : M.paintYell, -w / 2 + 4 + i * 8, 2.6, d / 2 + 2.2, g)
  return { g, top: H + 10 }
}

/** 47 日式町屋 */
function t47(x, z) {
  const g = group(x, z, 0.28)
  const w = 10
  const d = 14
  const H = 6.8
  box(w, H, d, M.plasterWarm, 0, H / 2, 0, g)
  for (const sz of [-1, 1]) {
    lattice(g, w - 1.2, 2.6, 1.9, sz * (d / 2 + 0.08), 9, M.charred)
    box(w - 1.0, 0.18, 1.4, M.charred, 0, 3.3, sz * (d / 2 + 0.55), g)
    lattice(g, w - 2.4, 1.8, 5.4, sz * (d / 2 + 0.06), 7, M.charred)
    box(w + 0.4, 0.24, 1.6, M.charred, 0, 4.4, sz * (d / 2 + 0.6), g)
  }
  box(1.8, 1.2, 0.12, M.paintBlue, 0, 2.4, d / 2 + 0.2, g)
  gableRoof(g, w, d, H, 2.2, M.darkTile, 1.4)
  return { g, top: H + 5 }
}

/** 48 徽派白墙黑瓦民居 */
function t48(x, z) {
  const g = group(x, z, 0.16)
  const w = 13
  const d = 15
  const H = 8
  box(w, H, d, M.plaster, 0, H / 2, 0, g)
  box(w + 0.1, 1.2, d + 0.1, M.tuff, 0, 0.6, 0, g)
  for (const sx of [-1, 1]) {
    let y = H * 0.42
    for (let i = 0; i < 3; i++) {
      const dz = d * (1 - i * 0.2)
      box(0.5, H * 0.3, dz, M.plaster, sx * (w / 2 + 0.1), y + H * 0.15, 0, g)
      box(0.7, 0.28, dz + 0.2, M.darkTile, sx * (w / 2 + 0.1), y + H * 0.3, 0, g)
      y += H * 0.24
    }
  }
  for (const [wx, wy] of [[-3, 5.6], [3, 5.6], [-3, 3.0], [3, 3.0]]) {
    box(1.1, 1.1, 0.14, M.charcoal, wx, wy, d / 2 + 0.02, g)
    box(0.9, 0.9, 0.1, M.glAmber, wx, wy, d / 2 + 0.1, g)
  }
  box(1.7, 2.6, 0.2, M.teak, 0, 1.3, d / 2 + 0.04, g)
  box(2.6, 0.2, 1.4, M.darkTile, 0, 2.85, d / 2 + 0.6, g)
  gableRoof(g, w, d, H, 3.2, M.darkTile, 0.3)
  return { g, top: H + 7 }
}

/** 49 石材体量塔（雕凿式开洞） */
function t49(x, z) {
  const g = group(x, z, -0.12)
  const w = 13
  const d = 13
  const H = 22
  box(w, H, d, M.tuff, 0, H / 2, 0, g)
  for (let i = 0; i < 7; i++) box(w + 0.5, 0.5, d + 0.5, M.tuff, 0, 3 + i * 3, 0, g)
  for (let i = 0; i < 6; i++) {
    for (const sz of [-1, 1]) box(0.5, 2.0, 0.2, M.charcoal, -3.4 + (i % 3) * 3.4, 4.4 + i * 3, sz * (d / 2 + 0.06), g)
  }
  box(5.4, 5.4, 3.4, M.mosaic, 4.2, 2.7, d / 2 + 1.2, g)
  box(2.6, 3.0, 0.3, M.charcoal, 4.2, 1.5, d / 2 + 2.95, g)
  box(w + 0.6, 0.6, d + 0.6, M.tuff, 0, H + 0.3, 0, g)
  return { g, top: H + 3 }
}

/** 50 水塔 */
function t50(x, z) {
  const g = group(x, z, 0.1)
  const R = 6.4
  const legH = 11
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, legH, 10), M.concrete)
      leg.position.set(sx * R * 0.7, legH / 2, sz * R * 0.7)
      leg.rotation.z = -sx * 0.05
      leg.rotation.x = sz * 0.05
      leg.castShadow = true
      g.add(leg)
    }
  }
  cyl(R * 0.86, R * 0.86, 0.5, M.concrete, 0, legH * 0.55, 0, 24, g, true)
  cyl(R, R, 6.4, M.corr, 0, legH + 3.2, 0, 32, g)
  for (let i = 0; i < 4; i++) cyl(R + 0.12, R + 0.12, 0.22, M.corrRust, 0, legH + 1.2 + i * 1.6, 0, 32, g, true)
  cone(R + 0.2, 2.2, M.corrRust, 0, legH + 7.5, 0, 24, g)
  cyl(0.16, 0.2, 3.0, M.brightSilver, 0, legH + 9.6, 0, 8, g)
  for (let i = 0; i < 14; i++) box(0.9, 0.1, 0.1, M.darkFrame, 0, 0.9 + i * 0.85, R * 0.74, g)
  return { g, top: legH + 12 }
}

/** 51 灯塔 */
function t51(x, z) {
  const g = group(x, z, 0.2)
  const H = 20
  cyl(3.2, 4.6, 2.0, M.tuff, 0, 1.0, 0, 24, g)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 3.1, H, 32, 1, true), M.plaster)
  body.castShadow = body.receiveShadow = true
  add(body, 0, 2 + H / 2, 0, g)
  for (const t of [0.22, 0.52, 0.8]) {
    const rr = 3.1 + (1.7 - 3.1) * t
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rr + 0.02, rr + 0.02, 2.4, 32, 1, true), M.paintRed)
    add(band, 0, 2 + H * t, 0, g)
  }
  cyl(2.6, 2.6, 0.4, M.darkFrame, 0, 2 + H, 0, 24, g)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    box(0.08, 1.0, 0.08, M.darkFrame, Math.cos(a) * 2.5, 2 + H + 0.7, Math.sin(a) * 2.5, g)
  }
  cyl(1.5, 1.5, 1.8, M.glChampagne, 0, 2 + H + 1.3, 0, 16, g)
  cone(1.9, 1.6, M.darkFrame, 0, 2 + H + 3.1, 0, 16, g)
  box(1.2, 2.2, 0.2, M.teak, 0, 3.1, 2.95, g)
  return { g, top: 2 + H + 5 }
}

/** 52 粮仓筒仓（筒顶走道 + 装车棚 + 地磅房 + 输送廊） */
function t52(x, z) {
  const g = group(x, z, -0.18)
  const H = 16
  const R = 2.1
  const N = 5
  const span = 4.2

  // 混凝土地坪 + 基础环梁
  paved(g, 0, 2.0, 32, 22, M.concrete, 4.0, 'x')
  box(N * span + 1.4, 0.7, 6.6, M.concrete, 0, 0.35, -2.2, g)
  // 筒体 + 环箍 + 底裙
  for (let i = 0; i < N; i++) {
    const ox = -(N - 1) * span / 2 + i * span
    const cz = -2.2
    cyl(R, R, H, M.corr, ox, H / 2 + 0.6, cz, 30, g)
    for (let k = 1; k < 5; k++) cyl(R + 0.12, R + 0.12, 0.18, M.corrRust, ox, 0.6 + k * 3.4, cz, 30, g, true)
    // 底部加厚裙板
    cyl(R + 0.24, R + 0.24, 1.4, M.corrRust, ox, 1.3, cz, 30, g)
    // 顶部锥形盖 + 人孔
    cone(R + 0.22, 2.4, M.corrRust, ox, H + 2.4, cz, 22, g)
    cyl(0.62, 0.62, 0.9, M.darkFrame, ox, H + 4.1, cz, 12, g)
    cyl(0.8, 0.62, 0.28, M.aluDark, ox, H + 4.55, cz, 12, g)
    // 筒壁竖梯 + 护圈
    box(0.12, H - 2.2, 0.12, M.aluDark, ox + R + 0.2, H / 2 + 0.6, cz - 1.2, g)
    for (let k = 0; k < 17; k++) box(0.34, 0.05, 0.05, M.aluDark, ox + R + 0.08, 2.0 + k * 0.82, cz - 1.2, g)
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.22, 0.05, 4, 20, Math.PI), M.aluDark)
      ring.position.set(ox + R + 0.06, 2.6 + k * 5.4, cz - 1.2)
      ring.rotation.y = Math.PI / 2
      g.add(ring)
    }
  }
  // 筒顶连通走道 + 栏杆
  box(N * span + 1.0, 0.3, 2.4, M.aluPanel, 0, H + 0.9, -3.5, g)
  for (const sz of [-1, 1]) {
    const rz = -3.5 + sz * 1.2
    box(N * span + 1.0, 0.16, 0.14, M.brightSilver, 0, H + 3.0, rz, g)
    box(N * span + 1.0, 0.08, 0.08, M.brightSilver, 0, H + 2.3, rz, g)
    for (let i = 0; i <= 20; i++) {
      box(0.06, 1.1, 0.06, M.brightSilver, -(N * span + 1.0) / 2 + i * ((N * span + 1.0) / 20), H + 2.45, rz, g)
    }
  }
  // 竖向斗提机塔 + 顶部横向输送廊
  box(2.2, H + 6, 2.2, M.corrRust, -9.8, (H + 6) / 2 + 0.6, -5.2, g)
  box(2.6, 0.5, 2.6, M.aluDark, -9.8, H + 6.6, -5.2, g)
  const gal = new THREE.Mesh(new THREE.BoxGeometry(N * span + 2.6, 2.2, 2.6), M.corrRust)
  gal.position.set(0, H + 2.2, -5.0)
  gal.castShadow = true
  g.add(gal)
  box(N * span + 2.6, 0.28, 2.8, M.aluDark, 0, H + 3.4, -5.0, g)
  for (let i = 0; i < 6; i++) box(0.16, 0.9, 0.16, M.aluDark, -10 + i * 4.0, H + 1.1, -5.0, g)
  for (let i = 0; i < 8; i++) box(1.5, 0.7, 0.12, M.glSmoke, -9.8 + i * 2.8, H + 2.4, -6.34, g)

  // 装车棚（筒前）：柱 + 桁架 + 波形板顶
  const cw = N * span + 2.6
  for (const ox of [-cw / 2 + 0.6, 0, cw / 2 - 0.6]) {
    for (const oz of [2.2, 7.0]) box(0.34, 6.0, 0.34, M.aluDark, ox, 3.0, oz, g)
  }
  box(cw, 0.3, 5.6, M.corr, 0, 6.1, 4.6, g)
  for (let i = 0; i < 7; i++) box(cw, 0.12, 0.16, M.corrRust, 0, 6.3 + (i % 2) * 0.06, 2.0 + i * 0.86, g)
  box(cw + 0.4, 0.2, 0.24, M.aluDark, 0, 6.0, 7.4, g)
  // 装车位（卸料槽 + 挡轮 + 伸缩装车管）
  for (const ox of [-4.2, 4.2]) {
    box(3.4, 0.1, 6.4, M.paving, ox, 0.06, 5.0, g)
    for (const sz of [-1, 1]) box(3.6, 0.3, 0.24, M.corrRust, ox, 0.2, 5.0 + sz * 2.8, g)
    cyl(0.42, 0.42, 2.2, M.aluPanel, ox, 4.8, 5.0, 10, g)
    cyl(0.52, 0.42, 0.3, M.aluDark, ox, 3.7, 5.0, 10, g)
  }

  // 地磅（南侧）+ 地磅房 + 门卫室
  box(9.2, 0.3, 4.2, M.concreteDark, -4.0, 0.15, 11.6, g)
  for (const sx of [-1, 1]) box(0.6, 0.5, 4.4, M.paintYell, -4.0 + sx * 4.9, 0.25, 11.6, g)
  box(5.4, 3.2, 4.2, M.plasterWarm, -12.4, 1.6, 11.0, g)
  box(5.8, 0.4, 4.6, M.whiteStone, -12.4, 3.4, 11.0, g)
  box(2.6, 1.4, 0.14, M.glSmoke, -12.4, 2.1, 13.13, g)
  box(5.4, 0.5, 1.2, M.aluPanel, -12.4, 3.9, 13.2, g)
  box(2.8, 3.0, 2.6, M.aluPanel, 8.6, 1.5, 11.4, g)
  box(3.2, 0.3, 3.0, M.aluDark, 8.6, 3.15, 11.4, g)
  box(1.6, 1.2, 0.12, M.glSmoke, 8.6, 1.9, 12.72, g)

  // 消防水池 + 栏杆
  cyl(3.2, 3.2, 1.6, M.concrete, 12.4, 0.8, -6.6, 20, g)
  cyl(2.8, 2.8, 0.3, M.glTeal, 12.4, 1.5, -6.6, 20, g)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    box(0.08, 1.0, 0.08, M.brightSilver, 12.4 + Math.cos(a) * 3.4, 0.5, -6.6 + Math.sin(a) * 3.4, g)
  }
  // 围墙 + 大门 + 道闸
  box(1.1, 2.2, 13, M.tuff, -16.0, 1.1, 4.0, g)
  box(1.3, 0.3, 13.2, M.whiteStone, -16.0, 2.25, 4.0, g)
  box(1.1, 2.2, 13, M.tuff, 16.0, 1.1, 4.0, g)
  box(1.3, 0.3, 13.2, M.whiteStone, 16.0, 2.25, 4.0, g)
  for (const sx of [-1, 1]) box(1.4, 2.6, 1.4, M.tuff, sx * 6.4, 1.3, 14.6, g)
  box(0.24, 1.1, 0.24, M.aluDark, 3.0, 0.55, 14.4, g)
  box(6.6, 0.16, 0.16, M.paintRed, -0.2, 1.05, 14.4, g)
  // 树 / 灯
  for (let i = 0; i < 4; i++) treeAt(g, -12.0 + i * 8.0, 15.6, 0.85, 3.0, 'column')
  for (const ox of [-13.0, 0, 13.0]) lampPost(g, ox, 13.4, 6.0, 0)
  return { g, top: H + 12 }
}

/** 53 砖砌学校（外廊式 + 四面立面 + 操场 + 门廊） */
function t53(x, z) {
  const g = group(x, z, 0.08)
  const w = 28
  const d = 13
  const floors = 3
  const fh = 3.6
  const H = floors * fh

  // 场地：混凝土操场 + 铺装
  paved(g, 0, 8, 36, 20, M.concrete, 4.0, 'x')
  box(10, 0.1, 16, M.paving, 0, 0.05, 12, g)

  // 主体
  box(w + 1.0, 0.8, d + 1.0, M.whiteStone, 0, 0.4, 0, g)
  box(w, H, d, M.brick, 0, H / 2 + 0.8, 0, g)
  box(w + 0.8, 0.7, d + 0.8, M.whiteStone, 0, H + 1.1, 0, g)
  // 山墙端部壁柱 + 腰线
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.9, H, 0.9, M.brickDark, sx * (w / 2 - 0.3), H / 2 + 0.8, sz * (d / 2 - 0.3), g)
  }
  for (let f = 1; f < floors; f++) box(w + 0.3, 0.2, d + 0.3, M.whiteStone, 0, 0.8 + f * fh, 0, g)
  // 女儿墙
  box(w + 0.4, 0.9, 0.34, M.brick, 0, H + 1.9, d / 2 - 0.17, g)
  box(w + 0.4, 0.9, 0.34, M.brick, 0, H + 1.9, -d / 2 + 0.17, g)
  for (const sx of [-1, 1]) box(0.34, 0.9, d, M.brick, sx * (w / 2 - 0.17), H + 1.9, 0, g)

  // 南面：外廊（每层）+ 窗
  for (let f = 0; f < floors; f++) {
    // 走廊楼板 + 栏杆 + 立柱
    box(w - 1.6, 0.26, 2.6, M.concrete, 0, 0.8 + f * fh + 0.13, d / 2 + 1.5, g)
    box(w - 1.6, 0.1, 0.14, M.brightSilver, 0, 0.8 + f * fh + 1.4, d / 2 + 2.76, g)
    for (let i = 0; i < 15; i++) {
      box(0.09, 1.0, 0.09, M.brightSilver, -13.0 + i * 1.86, 0.8 + f * fh + 0.9, d / 2 + 2.76, g)
    }
    // 廊柱
    for (let i = 0; i < 8; i++) {
      box(0.36, fh, 0.36, M.plaster, -12.6 + i * 3.6, 0.8 + f * fh + fh / 2, d / 2 + 2.7, g)
    }
    for (let i = 0; i < 8; i++) {
      const px = -13.0 + i * 3.72
      box(2.5, 2.0, 0.14, M.whiteStone, px, 0.8 + f * fh + 1.9, d / 2 + 0.06, g)
      box(2.2, 1.7, 0.1, M.glTeal, px, 0.8 + f * fh + 1.9, d / 2 + 0.16, g)
      box(0.07, 1.7, 0.1, M.darkFrame, px, 0.8 + f * fh + 1.9, d / 2 + 0.21, g)
    }
  }
  // 北立面：每层 8 樘窗（无外廊，窗更高）
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < 8; i++) {
      const px = -13.0 + i * 3.72
      for (const sz of [-1, 1]) {
        box(2.5, 2.2, 0.14, M.whiteStone, px, 0.8 + f * fh + 2.0, sz * (d / 2 + 0.06), g)
        box(2.2, 1.9, 0.1, M.glTeal, px, 0.8 + f * fh + 2.0, sz * (d / 2 + 0.16), g)
        box(0.07, 1.9, 0.1, M.darkFrame, px, 0.8 + f * fh + 2.0, sz * (d / 2 + 0.21), g)
        box(2.7, 0.14, 0.34, M.whiteStone, px, 0.8 + f * fh + 0.82, sz * (d / 2 + 0.2), g)
      }
    }
  }
  // 东西山墙：每层 2 樘窄窗
  for (const sx of [-1, 1]) {
    for (let f = 0; f < floors; f++) {
      for (const pz of [-2.8, 2.8]) {
        box(0.14, 2.0, 2.2, M.whiteStone, sx * (w / 2 + 0.06), 0.8 + f * fh + 1.9, pz, g)
        box(0.1, 1.7, 1.9, M.glTeal, sx * (w / 2 + 0.16), 0.8 + f * fh + 1.9, pz, g)
      }
    }
  }

  // 主入口（南面中部）：门斗 + 坡道 + 雨篷 + 校名牌
  box(6.2, 3.6, 2.0, M.whiteStone, 0, 1.8, d / 2 + 3.9, g)
  archPanel(2.6, 3.0, 0.3, M.teak, 0, 0.8, d / 2 + 4.95, g)
  box(7.6, 0.28, 3.4, M.whiteStone, 0, 5.0, d / 2 + 4.6, g)
  box(7.8, 0.16, 3.6, M.aluPanel, 0, 5.22, d / 2 + 4.6, g)
  for (const sx of [-1, 1]) box(0.3, 4.2, 0.3, M.aluDark, sx * 3.3, 2.1, d / 2 + 6.0, g)
  steps(g, 6.6, 3, 0.2, 0.5, 0.8, M.whiteStone, d / 2 + 5.4)
  box(4.4, 0.44, 0.12, M.paintBlue, 0, 4.3, d / 2 + 4.92, g)
  for (const sx of [-1, 1]) {
    cyl(0.16, 0.2, 6.4, M.brightSilver, sx * 8.6, 3.2, d / 2 + 4.2, 8, g)
    box(0.05, 1.3, 2.0, M.paintRed, sx * 8.6 + 0.05, 5.9, d / 2 + 5.2, g)
  }

  // 端部山墙钟 + 旗杆
  box(3.0, 2.4, 0.4, M.whiteStone, 0, H + 3.6, d / 2 - 0.5, g)
  const clk = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), M.glazeWhite)
  add(clk, 0, H + 3.6, d / 2 - 0.28, g)
  const clkRing = new THREE.Mesh(new THREE.TorusGeometry(0.94, 0.1, 5, 18), M.bronze)
  add(clkRing, 0, H + 3.6, d / 2 - 0.24, g)
  cyl(0.08, 0.12, 12, M.brightSilver, -w / 2 + 2.4, H + 6.4, d / 2 + 3.0, 8, g)
  // 屋面：水箱 + 通风帽 + 天窗
  box(5.0, 2.6, 4.0, M.plaster, 6.0, H + 2.9, 0, g)
  box(5.4, 0.3, 4.4, M.whiteStone, 6.0, H + 4.35, 0, g)
  cyl(1.6, 1.6, 2.2, M.brightSilver, -8.0, H + 2.7, -2.0, 14, g)
  cyl(1.7, 1.7, 0.2, M.aluPanel, -8.0, H + 3.9, -2.0, 14, g)
  for (const ox of [-3.0, 0.0, 3.0]) {
    cyl(0.5, 0.5, 0.9, M.aluPanel, ox, H + 2.2, 2.6, 10, g)
    cyl(0.62, 0.5, 0.22, M.aluDark, ox, H + 2.75, 2.6, 10, g)
  }
  box(12, 0.5, 2.0, M.glIce, -2.0, H + 2.1, -4.2, g)
  for (let i = 0; i < 5; i++) box(0.1, 0.55, 2.0, M.aluDark, -7.0 + i * 2.6, H + 2.1, -4.2, g)
  // 落水管
  for (const sx of [-1, 1]) {
    downpipe(g, sx * (w / 2 + 0.3), d / 2 + 0.3, H + 1.8)
    downpipe(g, sx * (w / 2 + 0.3), -d / 2 - 0.3, H + 1.8)
  }

  // 操场：跑道 + 篮球场 + 旗杆 + 看台 + 树
  box(30, 0.12, 14, M.paintRed, 0, 0.06, 19.0, g)
  box(27, 0.14, 11, M.greenSoft, 0, 0.09, 19.0, g)
  for (let i = 1; i <= 3; i++) {
    box(27 - 0.0, 0.03, 0.12, M.glazeWhite, 0, 0.17, 19.0 - 5.5 + i * 2.75, g)
  }
  for (const sx of [-1, 1]) {
    cyl(0.4, 0.4, 0.3, M.whiteStone, sx * 5.0, 0.3, 25.0, 12, g)
    // 篮球架
    cyl(0.14, 0.14, 3.4, M.aluDark, sx * 5.0, 1.7, 25.0, 8, g)
    box(1.8, 1.1, 0.1, M.glazeWhite, sx * 5.0, 3.2, 25.0, g)
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 5, 12), M.paintRed)
    hoop.rotation.x = Math.PI / 2
    add(hoop, sx * 5.0, 2.75, 25.6, g)
  }
  // 看台
  for (let i = 0; i < 3; i++) box(26, 0.42, 1.2, M.concrete, 0, 0.21 + i * 0.42, 26.6 + i * 1.2, g)
  for (let i = 0; i < 9; i++) treeAt(g, -17.0 + i * 4.4, 14.0, 0.9, 3.2, i % 3 ? null : 'column')
  for (const ox of [-12.0, 0, 12.0]) lampPost(g, ox, 12.4, 6.4, 0)
  for (let i = 0; i < 6; i++) bushAt(g, 15.0, -6.0 + i * 2.4, 0.55)
  return { g, top: H + 12 }
}

/** 54 多厅影城（石材裙房 + 玻璃中庭 + IMAX 圆厅 + 巨幕招牌） */
function t54(x, z) {
  const g = group(x, z, 0)
  const W = 56   // 面宽
  const D = 44   // 进深
  const H = 21   // 三层，层高 7m（影院层高大）
  // 前广场
  paved(g, 0, 22, 92, 34, M.paving, 4.0, 'x')
  // 石材主体
  box(W, H, D, M.plasterWarm, 0, H / 2, -10, g)
  for (const y of [7.0, 14.0, 20.6]) box(W + 0.8, 0.7, D + 0.8, M.whiteStone, 0, y, -10, g)
  // 侧墙：条窗 + 竖缝
  for (let f = 0; f < 2; f++) {
    for (const sx of [-1, 1]) {
      box(0.3, 3.0, D - 8, M.glSmoke, sx * (W / 2 + 0.12), 4.6 + f * 7.0, -10, g)
      for (let i = 0; i <= 14; i++) box(0.34, 3.0, 0.16, M.charcoal, sx * (W / 2 + 0.2), 4.6 + f * 7.0, -10 - (D - 8) / 2 + i * ((D - 8) / 14), g)
    }
  }
  // 入口玻璃中庭（通高 18m）
  const lob = new THREE.Group()
  lob.position.set(-4, 0, 12)
  g.add(lob)
  box(30, 18, 8, M.glWhite, 0, 9, 0, lob)
  for (let i = 0; i <= 10; i++) box(0.22, 18, 0.3, M.brightSilver, -15 + i * 3.0, 9, 4.05, lob)
  for (const y of [6.0, 12.0, 17.6]) box(30.2, 0.24, 0.4, M.brightSilver, 0, y, 4.06, lob)
  for (let i = 0; i < 3; i++) {
    cyl(2.0, 2.0, 3.4, M.glWhite, -9 + i * 6, 1.7, 4.4, 16, lob)
    cyl(2.1, 2.1, 0.28, M.brightSilver, -9 + i * 6, 3.5, 4.4, 16, lob)
  }
  // 中庭雨篷 + 台阶
  box(34, 0.5, 9, M.membrane, -4, 8.4, 18, g)
  for (let i = 0; i < 4; i++) cyl(0.18, 0.22, 8.0, M.brightSilver, -18 + i * 9.4, 4.0, 22, 8, g)
  steps(g, 34, 4, 0.18, 1.2, 0, M.whiteStone, 20.5)
  // IMAX 圆厅（西侧凸出）
  const imax = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 13.2, 27, 28), M.aluPanel)
  imax.position.set(-32, 13.5, -4)
  imax.castShadow = imax.receiveShadow = true
  g.add(imax)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    box(0.3, 27, 0.3, M.brightSilver, -32 + Math.cos(a) * 12.9, 13.5, -4 + Math.sin(a) * 12.9, g)
  }
  for (const y of [4.6, 9.2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(13.1, 0.2, 6, 36), M.brightSilver)
    ring.rotation.x = Math.PI / 2
    add(ring, -32, y, -4, g)
  }
  box(10.5, 2.4, 0.4, M.paintRed, -32, 22.0, 8.4, g)
  box(9.2, 1.1, 0.2, M.glazeWhite, -32, 22.0, 8.62, g)
  // 巨幅竖招牌（东侧）
  box(3.4, 24, 0.8, M.paintRed, 30, 16, 12.2, g)
  for (let i = 0; i < 6; i++) box(2.6, 1.3, 0.2, M.glazeWhite, 30, 6.4 + i * 3.5, 12.66, g)
  box(3.8, 0.6, 1.2, M.charcoal, 30, 28.3, 12.2, g)
  // 屋顶设备 + 广告牌
  box(22, 4.0, 12, M.aluPanel, 8, H + 2.0, -16, g)
  box(22.4, 0.4, 12.4, M.aluDark, 8, H + 4.2, -16, g)
  for (let i = 0; i < 5; i++) box(0.5, 0.5, 0.5, M.aluPanel, -2 + i * 5, H + 4.6, -20, g)
  // 海报墙 + 取票机（放在中庭右侧空墙面）
  for (let i = 0; i < 4; i++) {
    box(4.0, 6.0, 0.3, M.charcoal, 13.6 + i * 4.4, 5.4, 12.3, g)
    box(3.6, 5.4, 0.16, [M.glRose, M.glTeal, M.glAmber, M.glViolet][i], 13.6 + i * 4.4, 5.4, 12.46, g)
  }
  for (let i = 0; i < 4; i++) {
    box(1.2, 2.2, 0.8, M.glazeWhite, 14 + i * 4.0, 1.1, 14.2, g)
    box(1.2, 0.7, 0.1, M.glDeepBlue, 14 + i * 4.0, 1.9, 14.66, g)
  }
  for (let i = 0; i < 7; i++) {
    box(0.08, 1.0, 0.08, M.brightSilver, -10 + i * 3.4, 0.5, 17.4, g)
    box(3.4, 0.06, 0.06, M.brightSilver, -10 + i * 3.4 + 1.7, 1.0, 17.4, g)
  }
  // 停车位 + 车 + 出租车排队 + 公交站
  for (let i = 0; i < 10; i++) {
    const px = -40 + i * 6.4
    box(5.4, 0.06, 0.12, M.roadPaint, px, 0.1, 30, g)
    box(5.4, 0.06, 0.12, M.roadPaint, px, 0.1, 38.4, g)
    if (i < 8) carAt(g, px, 32, 0, [M.glazeWhite, M.charcoal, M.paintBlue, M.paintRed, M.glSilver, M.paintYell, M.paintGreen, M.charcoal][i])
    if (i < 8) carAt(g, px, 36.4, Math.PI, [M.paintBlue, M.glazeWhite, M.charcoal, M.glazeWhite, M.paintRed, M.glSilver, M.paintYell, M.paintBlue][i])
  }
  for (let i = 0; i < 3; i++) carAt(g, 14 + i * 6.0, 30, 0, M.paintYell)
  box(16, 0.3, 3.4, M.membrane, 14, 3.2, 36, g)
  for (const dx of [7, 21]) cyl(0.14, 0.16, 3.2, M.aluPanel, dx, 1.6, 36, 6, g)
  benchAt(g, 14, 35, Math.PI)
  DK.busAt(g, 24, 41, Math.PI / 2)
  // 绿化 + 灯 + 人
  for (let i = 0; i < 6; i++) treeAt(g, -40 + i * 15, 25, 1.05, 3.4)
  for (let i = 0; i < 4; i++) lampPost(g, -33 + i * 22, 20, 7.0, Math.PI)
  for (let i = 0; i < 10; i++) {
    box(0.36, 1.12, 0.3, [M.charcoal, M.paintRed, M.paintBlue, M.glazeWhite][i % 4], -22 + i * 5.0, 0.56, 16 + (i % 3) * 2.2, g)
  }
  return { g, top: H + 8 }
}

// ============================================================
//  七～十一：住宅 / 体育场馆 / 文教政务 / 宗教 / 交通市政（55–90）
// ============================================================

// ---------- 立面细节工具 ----------
/** 带框窗：ry=0 时外法线为 +z。返回子组，可继续往里加东西 */
function win(g, x, y, z, ry, w, h, o = {}) {
  const s = new THREE.Group()
  s.position.set(x, y, z)
  s.rotation.y = ry
  g.add(s)
  const frame = o.frame ?? M.darkFrame
  const t = o.t ?? 0.11
  box(w, h, 0.1, o.glass ?? M.glSmoke, 0, 0, 0.02, s)
  box(w + 0.2, t, 0.2, frame, 0, h / 2 + t / 2, 0.07, s)
  box(w + 0.2, t, 0.2, frame, 0, -h / 2 - t / 2, 0.07, s)
  box(t, h, 0.2, frame, -w / 2 - t / 2, 0, 0.07, s)
  box(t, h, 0.2, frame, w / 2 + t / 2, 0, 0.07, s)
  const n = o.mull ?? 1
  for (let i = 1; i <= n; i++) box(0.06, h, 0.12, frame, -w / 2 + (w / (n + 1)) * i, 0, 0.07, s)
  if (o.transom) box(w, 0.06, 0.11, frame, 0, h * 0.26, 0.07, s)
  if (o.sill) box(w + 0.66, 0.1, 0.34, o.sillMat ?? M.whiteStone, 0, -h / 2 - t - 0.18, 0.12, s)
  return s
}
/** 幕墙分格：玻璃板 + 竖梃 + 横梁 */
function gridGlass(g, x, y, z, ry, w, h, cols, rows, o = {}) {
  const s = new THREE.Group()
  s.position.set(x, y, z)
  s.rotation.y = ry
  g.add(s)
  const frame = o.frame ?? M.brightSilver
  box(w, h, 0.12, o.glass ?? M.glSmoke, 0, 0, 0, s)
  for (let i = 0; i <= cols; i++) box(o.mw ?? 0.09, h, 0.16, frame, -w / 2 + (w / cols) * i, 0, 0.08, s)
  for (let j = 0; j <= rows; j++) box(w, o.mh ?? 0.12, 0.16, frame, 0, -h / 2 + (h / rows) * j, 0.08, s)
  return s
}
/** 一圈楼板腰线 / 窗台线 */
function bandRing(g, w, d, y, mat, t = 0.15, out = 0.1) {
  box(w + out * 2, t, out * 2, mat, 0, y, d / 2, g)
  box(w + out * 2, t, out * 2, mat, 0, y, -d / 2, g)
  box(out * 2, t, d, mat, w / 2, y, 0, g)
  box(out * 2, t, d, mat, -w / 2, y, 0, g)
}
/** 女儿墙 + 压顶 */
function parapet(g, w, d, y, mat, h = 0.95, t = 0.3) {
  box(w, h, t, mat, 0, y + h / 2, d / 2 - t / 2, g)
  box(w, h, t, mat, 0, y + h / 2, -d / 2 + t / 2, g)
  box(t, h, d, mat, w / 2 - t / 2, y + h / 2, 0, g)
  box(t, h, d, mat, -w / 2 + t / 2, y + h / 2, 0, g)
  box(w + 0.24, 0.13, t + 0.24, M.whiteStone, 0, y + h + 0.06, d / 2 - t / 2, g)
  box(w + 0.24, 0.13, t + 0.24, M.whiteStone, 0, y + h + 0.06, -d / 2 + t / 2, g)
  box(t + 0.24, 0.13, d, M.whiteStone, w / 2 - t / 2, y + h + 0.06, 0, g)
  box(t + 0.24, 0.13, d, M.whiteStone, -w / 2 + t / 2, y + h + 0.06, 0, g)
}
/** 空调外机（挂墙） */
function acUnit(g, x, y, z, ry) {
  const s = new THREE.Group()
  s.position.set(x, y, z)
  s.rotation.y = ry
  g.add(s)
  box(0.9, 0.66, 0.38, M.glazeWhite, 0, 0, 0.19, s)
  for (let i = 0; i < 6; i++) box(0.78, 0.03, 0.06, M.darkFrame, 0, -0.24 + i * 0.1, 0.38, s)
  box(0.16, 0.06, 0.52, M.darkFrame, -0.3, -0.36, 0.24, s)
  box(0.16, 0.06, 0.52, M.darkFrame, 0.3, -0.36, 0.24, s)
  return s
}
/** 雨水管 / 落水管 */
function downpipe(g, x, z, h, mat = M.aluPanel) {
  cyl(0.085, 0.085, h, mat, x, h / 2, z, 6, g)
  cyl(0.14, 0.06, 0.22, mat, x, h + 0.06, z, 6, g)
}
/** 栏杆：n 根立柱 + 上下横管 */
function railing(g, w, y, z, mat, n = 8, h = 1.05) {
  box(w, 0.06, 0.06, mat, 0, y + h, z, g)
  box(w, 0.05, 0.05, mat, 0, y + h * 0.55, z, g)
  for (let i = 0; i <= n; i++) box(0.05, h, 0.05, mat, -w / 2 + (w / n) * i, y + h / 2, z, g)
}
/** 花池 + 灌木 */
function planter(g, x, z, w = 3, d = 1.6, y = 0) {
  box(w, 0.5, d, M.concreteDark, x, y + 0.25, z, g)
  box(w - 0.24, 0.1, d - 0.24, M.bark, x, y + 0.52, z, g)
  for (let i = 0; i < Math.max(1, Math.round(w / 1.1)); i++) {
    const px = x - w / 2 + 0.7 + i * ((w - 1.4) / Math.max(1, Math.round(w / 1.1) - 1))
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 7), M.leaf)
    c.scale.set(1, 0.85, 1)
    c.castShadow = true
    add(c, px, y + 0.92, z, g)
  }
}
/** 出入口雨篷：梁 + 拉杆 + 立柱 */
function awning(g, x, y, z, w, d, mat = M.brightSilver, ry = 0) {
  const s = new THREE.Group()
  s.position.set(x, y, z)
  s.rotation.y = ry
  g.add(s)
  box(w, 0.18, d, mat, 0, 0, d / 2, s)
  for (const sx of [-1, 1]) {
    cyl(0.09, 0.09, 2.6, M.brightSilver, sx * (w / 2 - 0.4), -1.3, d - 0.3, 6, s)
  }
  return s
}

// ---------- 场地细部：植被 / 铺装 / 街具 / 车辆 ----------
/** 稳定哈希：同一位置每次生成同一种树，避免相机移动时"变树" */
function hash2(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return n - Math.floor(n)
}
/** 树冠薄片（阔叶用）：几个扁球叠出蓬松感 */
function canopyBall(g, x, y, z, r, sy, mat = M.leaf, seg = 10) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 3)), mat)
  c.position.set(x, y, z)
  c.scale.set(1, sy, 1)
  c.castShadow = c.receiveShadow = true
  g.add(c)
  return c
}
/** 针叶树（松/杉）：塔状多层锥 */
function treeConifer(g, x, z, s, h) {
  cyl(0.14 * s, 0.24 * s, h * s, M.bark, x, h * s / 2, z, 7, g)
  const layers = 4
  for (let i = 0; i < layers; i++) {
    const r = (1.9 - i * 0.36) * s
    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(r, 2.3 * s, 9), M.leaf)
    cone1.position.set(x, (h * 0.62 + i * 1.05) * s, z)
    cone1.castShadow = true
    g.add(cone1)
  }
}
/** 柱状树（柏树 / 杨树）：细长椭圆 */
function treeColumn(g, x, z, s, h) {
  cyl(0.12 * s, 0.2 * s, h * s * 0.7, M.bark, x, h * s * 0.35, z, 6, g)
  canopyBall(g, x, h * s * 0.95, z, 0.95 * s, 3.4, M.leaf, 9)
  canopyBall(g, x, h * s * 1.5, z, 0.62 * s, 2.0, M.leaf, 8)
}
/** 棕榈：弧形树干 + 放射状叶 */
function treePalm(g, x, z, s, h) {
  const segs = 6
  const lean = (hash2(x, z) - 0.5) * 0.9 * s
  for (let i = 0; i < segs; i++) {
    const t = i / segs
    const t2 = (i + 1) / segs
    const px = x + lean * t * t
    const py = h * s * (t + t2) * 0.5
    const px2 = x + lean * t2 * t2
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.17 * s, h * s / segs + 0.1, 7), M.bark)
    trunk.position.set((px + px2) * 0.5, py, z)
    trunk.rotation.z = -Math.atan2(lean * (t2 - t), h * s / segs) * 1.2
    trunk.castShadow = true
    g.add(trunk)
  }
  const tx = x + lean
  const ty = h * s
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3
    const frond = new THREE.Mesh(new THREE.BoxGeometry(2.0 * s, 0.07 * s, 0.46 * s), M.leaf)
    frond.position.set(tx + Math.cos(a) * 1.0 * s, ty - 0.1 * s, z + Math.sin(a) * 1.0 * s)
    frond.rotation.y = -a
    frond.rotation.z = -0.42
    frond.castShadow = true
    g.add(frond)
  }
  // 椰子
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 7, 6), M.bark)
    nut.position.set(tx + Math.cos(a) * 0.32 * s, ty - 0.3 * s, z + Math.sin(a) * 0.32 * s)
    g.add(nut)
  }
}
/** 垂柳：宽冠 + 下垂枝条 */
function treeWillow(g, x, z, s, h) {
  cyl(0.16 * s, 0.28 * s, h * s, M.bark, x, h * s / 2, z, 7, g)
  canopyBall(g, x, h * s + 0.5 * s, z, 1.7 * s, 0.95)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.02 * s, 2.4 * s, 4), M.leaf)
    strand.position.set(x + Math.cos(a) * 1.5 * s, h * s - 0.7 * s, z + Math.sin(a) * 1.5 * s)
    strand.rotation.z = Math.cos(a) * 0.1
    strand.rotation.x = Math.sin(a) * 0.1
    g.add(strand)
  }
}
/** 伞形松（地中海松 / 榕树）：平顶伞冠 */
function treeUmbrella(g, x, z, s, h) {
  cyl(0.16 * s, 0.26 * s, h * s * 1.25, M.bark, x, h * s * 0.62, z, 7, g)
  const pad = new THREE.Mesh(new THREE.SphereGeometry(1.9 * s, 12, 6), M.leaf)
  pad.position.set(x, h * s * 1.28, z)
  pad.scale.set(1.15, 0.32, 1.15)
  pad.castShadow = true
  g.add(pad)
  canopyBall(g, x + 0.6 * s, h * s * 1.16, z - 0.4 * s, 0.9 * s, 0.4)
}
/** 花树（樱 / 紫薇）：粉白冠 */
function treeBlossom(g, x, z, s, h) {
  const mat = hash2(z, x) > 0.55 ? M.blossom : M.blossomWhite
  cyl(0.13 * s, 0.22 * s, h * s, M.bark, x, h * s / 2, z, 7, g)
  canopyBall(g, x, h * s + 0.3 * s, z, 1.35 * s, 0.9, mat, 10)
  canopyBall(g, x + 0.7 * s, h * s + 0.9 * s, z + 0.3 * s, 0.8 * s, 0.85, mat, 8)
  canopyBall(g, x - 0.6 * s, h * s + 0.7 * s, z - 0.4 * s, 0.72 * s, 0.85, mat, 8)
}
/**
 * 乔木入口：按位置哈希自动选树种，城市里自然混出高低胖瘦。
 * 想要指定树种时可传 kind: 'round'|'conifer'|'column'|'palm'|'willow'|'umbrella'|'blossom'
 */
function treeAt(g, x, z, s = 1, h = 3.2, kind = null, mat = null) {
  const k = kind || ['round', 'round', 'round', 'conifer', 'column', 'willow', 'umbrella', 'blossom', 'palm'][(hash2(x, z) * 9) | 0]
  // 尺度也抖一点：同一树种有大有小
  const jitter = 0.82 + hash2(z + 3.1, x - 1.7) * 0.55
  const sc = s * jitter
  if (k === 'conifer') return treeConifer(g, x, z, sc, h)
  if (k === 'column') return treeColumn(g, x, z, sc, h * 1.4)
  if (k === 'palm') return treePalm(g, x, z, sc * 1.15, h * 1.5)
  if (k === 'willow') return treeWillow(g, x, z, sc * 1.1, h * 0.95)
  if (k === 'umbrella') return treeUmbrella(g, x, z, sc * 1.1, h * 1.05)
  if (k === 'blossom') return treeBlossom(g, x, z, sc * 0.9, h * 0.9)
  // 阔叶树：树干 + 分叉 + 两三层树冠
  const leafMat = mat || [M.leaf, M.leaf, M.leafDeep, M.leafOlive, M.leafAutumn][(hash2(x + 5.3, z - 2.2) * 5) | 0]
  cyl(0.16 * sc, 0.26 * sc, h * sc, M.bark, x, h * sc / 2, z, 8, g)
  for (const [ox, oz, ang] of [[0.5, 0.2, 0.3], [-0.45, -0.2, -0.28]]) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * sc, 0.12 * sc, 1.6 * sc, 6), M.bark)
    br.position.set(x + ox * sc, h * sc * 0.82, z + oz * sc)
    br.rotation.z = ang
    br.castShadow = true
    g.add(br)
  }
  const tiers = [[1.55, 1.15, 0.42], [1.2, 0.95, 0.82], [0.78, 0.72, 1.22]]
  for (const [r, sy, oy] of tiers) {
    canopyBall(g, x, h * sc + oy * sc * 1.5, z, r * sc, sy, leafMat, 12)
  }
}
/** 小树苗（广场 / 人行道用，1.5~3m） */
function treeSmall(g, x, z, s = 1) {
  cyl(0.09 * s, 0.14 * s, 1.6 * s, M.bark, x, 0.8 * s, z, 6, g)
  canopyBall(g, x, 2.1 * s, z, 0.72 * s, 1.05, M.leaf, 9)
}
/** 灌木丛 */
function bushAt(g, x, z, r = 0.8) {
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r * (0.7 + i * 0.15), 9, 7), M.leaf)
    c.position.set(x + (i - 1) * r * 0.7, r * 0.55, z + (i % 2) * r * 0.35)
    c.scale.set(1, 0.8, 1)
    c.castShadow = c.receiveShadow = true
    g.add(c)
  }
}
/** 绿篱（沿 x 或 z 向） */
function hedge(g, x, z, len, alongX = true, h = 1.0, t = 1.1) {
  const w = alongX ? len : t
  const d = alongX ? t : len
  box(w, h, d, M.leaf, x, h / 2, z, g)
  box(w - 0.2, 0.14, d - 0.2, M.leaf, x, h + 0.05, z, g)
}
/** 带分缝的铺装场地（每次调用微抬 4mm，避免与相邻铺装共面闪烁） */
function paved(g, x, z, w, d, mat = M.paving, step = 2.4, axis = 'x') {
  paved._k = ((paved._k || 0) + 1) % 7
  const y = 0.04 + paved._k * 0.004
  box(w, 0.1, d, mat, x, y, z, g)
  if (axis === 'x') for (let i = 1; i < w / step; i++) box(0.06, 0.02, d - 0.2, M.curb, x - w / 2 + i * step, y + 0.06, z, g)
  else for (let i = 1; i < d / step; i++) box(w - 0.2, 0.02, 0.06, M.curb, x, y + 0.06, z - d / 2 + i * step, g)
}
/** 小汽车 */
function carAt(g, x, z, ry, col = M.paintBlue, len = 4.6, y = 0) {
  const s = new THREE.Group()
  s.position.set(x, y, z)
  s.rotation.y = ry
  g.add(s)
  const wid = 1.86
  box(len, 0.62, wid, col, 0, 0.78, 0, s)
  box(len - 0.3, 0.28, wid - 0.06, M.charcoal, 0, 0.44, 0, s)
  box(len * 0.55, 0.58, wid - 0.16, col, -0.25, 1.34, 0, s)
  box(len * 0.5, 0.44, wid - 0.1, M.glSmoke, -0.25, 1.36, 0, s)
  box(len * 0.13, 0.42, wid - 0.24, M.charcoal, len * 0.36, 1.3, 0, s)
  for (const sx of [-len * 0.32, len * 0.32]) {
    for (const sz of [-1, 1]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 12), M.charcoal)
      wh.rotation.x = Math.PI / 2
      wh.position.set(sx, 0.36, sz * (wid / 2 - 0.1))
      wh.castShadow = true
      s.add(wh)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 8), M.brightSilver)
      hub.rotation.x = Math.PI / 2
      hub.position.set(sx, 0.36, sz * (wid / 2 - 0.1))
      s.add(hub)
    }
  }
  for (const sz of [-1, 1]) {
    box(0.14, 0.16, 0.34, M.glazeWhite, len / 2 - 0.02, 0.9, sz * 0.62, s)
    box(0.12, 0.14, 0.3, M.paintRed, -len / 2 + 0.02, 0.92, sz * 0.62, s)
    box(0.1, 0.1, 0.26, col, len * 0.18, 1.24, sz * (wid / 2 + 0.06), s)
  }
  return s
}
/** 路灯 */
function lampPost(g, x, z, h = 5.4, ry = 0) {
  cyl(0.09, 0.14, h, M.darkFrame, x, h / 2, z, 8, g)
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), M.darkFrame)
  arm.position.set(x, h - 0.25, z)
  arm.rotation.z = Math.PI / 2
  arm.rotation.y = ry
  g.add(arm)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.42), M.glazeWhite)
  head.position.set(x + Math.cos(ry) * 0.55, h - 0.32, z - Math.sin(ry) * 0.55)
  g.add(head)
  box(0.98, 0.1, 0.5, M.darkFrame, x + Math.cos(ry) * 0.55, h - 0.22, z - Math.sin(ry) * 0.55, g)
  cyl(0.22, 0.28, 0.3, M.concreteDark, x, 0.15, z, 10, g)
}
/** 长椅 */
function benchAt(g, x, z, ry = 0) {
  const s = new THREE.Group()
  s.position.set(x, 0, z)
  s.rotation.y = ry
  g.add(s)
  box(1.9, 0.09, 0.56, M.teak, 0, 0.46, 0, s)
  box(1.9, 0.5, 0.08, M.teak, 0, 0.72, -0.24, s)
  for (const sx of [-1, 1]) {
    box(0.1, 0.46, 0.5, M.charcoal, sx * 0.78, 0.23, 0, s)
    box(0.08, 0.55, 0.08, M.charcoal, sx * 0.78, 0.72, -0.26, s)
  }
}
/** 水池：池壁 + 压顶 + 水面 + 入水台阶 + 扶梯 */
function poolAt(g, x, z, w, d, water = M.glTeal) {
  box(w + 1.2, 0.5, d + 1.2, M.whiteStone, x, 0.25, z, g)
  box(w, 0.34, d, M.glWhite, x, 0.44, z, g)
  box(w - 0.3, 0.08, d - 0.3, water, x, 0.5, z, g)
  for (let i = 0; i < 4; i++) box(w - 0.6, 0.1, 0.1, M.curb, x, 0.62, z - d / 2 + 0.5 + i * 0.28, g)
  // 入水台阶
  for (let i = 0; i < 4; i++) box(2.0, 0.22, 1.4 - i * 0.34, M.whiteStone, x - w / 2 + 1.4, 0.24 + i * 0.2, z + d / 2 - 1.2, g)
  // 扶梯
  const lx = x + w / 2 - 1.0
  for (const sz of [-1, 1]) cyl(0.05, 0.05, 1.0, M.brightSilver, lx + sz * 0.28, 0.95, z - d / 2 + 1.2, 6, g)
  for (const oy of [0.6, 1.05, 1.4]) box(0.62, 0.05, 0.05, M.brightSilver, lx, oy, z - d / 2 + 1.2, g)
}
/** 廊架（花架） */
function pergola(g, x, z, w, d, h = 3.0, ry = 0) {
  const s = new THREE.Group()
  s.position.set(x, 0, z)
  s.rotation.y = ry
  g.add(s)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) box(0.22, h, 0.22, M.teak, sx * (w / 2 - 0.2), h / 2, sz * (d / 2 - 0.2), s)
  }
  for (const sx of [-1, 1]) box(0.18, 0.24, d, M.teak, sx * (w / 2 - 0.2), h + 0.1, 0, s)
  for (let i = 0; i <= Math.round(d / 1.1); i++) {
    box(w - 0.2, 0.12, 0.14, M.teak, 0, h + 0.3, -d / 2 + 0.2 + i * ((d - 0.4) / Math.round(d / 1.1)), s)
  }
  // 攀爬绿植
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), M.leaf)
    c.position.set(-w / 2 + 0.4 + i * (w / 3), h + 0.42, (i % 2 ? 1 : -1) * d * 0.3)
    c.scale.set(1.3, 0.6, 1)
    s.add(c)
  }
}
/** 遮阳伞 */
function parasol(g, x, z, r = 1.5, mat = M.glazeWhite) {
  cyl(0.06, 0.06, 2.4, M.brightSilver, x, 1.2, z, 6, g)
  cone(r, 0.55, mat, x, 2.5, z, 10, g)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    box(r * 0.95, 0.05, 0.05, mat, x + Math.cos(a) * r * 0.5, 2.32, z + Math.sin(a) * r * 0.5, g).rotation.y = -a
  }
  cyl(0.3, 0.3, 0.16, M.concreteDark, x, 0.08, z, 10, g)
}
/** 躺椅 */
function lounger(g, x, z, ry = 0) {
  const s = new THREE.Group()
  s.position.set(x, 0, z)
  s.rotation.y = ry
  g.add(s)
  box(0.7, 0.1, 1.9, M.glazeWhite, 0, 0.42, 0, s)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.8), M.glazeWhite)
  back.position.set(0, 0.66, -0.78)
  back.rotation.x = -0.7
  s.add(back)
  for (const sx of [-0.28, 0.28]) for (const sz of [-0.75, 0.75]) {
    box(0.06, 0.4, 0.06, M.brightSilver, sx, 0.22, sz, s)
  }
}
/** 玻璃栏板（露台） */
function glassRail(g, w, y, z, n = 6) {
  box(w, 0.96, 0.06, M.glWhite, 0, y + 0.5, z, g)
  box(w + 0.12, 0.1, 0.14, M.brightSilver, 0, y + 1.0, z, g)
  box(w + 0.12, 0.08, 0.12, M.brightSilver, 0, y + 0.06, z, g)
  for (let i = 0; i <= n; i++) box(0.07, 1.0, 0.1, M.brightSilver, -w / 2 + (w / n) * i, y + 0.5, z, g)
}

/** 中式殿宇/房舍：台基 + 檐柱 + 额枋 + 双坡瓦顶 + 正脊，可整体旋转 */
function tradHall(g, cx, cz, o = {}) {
  const w = o.w ?? 18
  const d = o.d ?? 7.4
  const wallH = o.wallH ?? 3.6
  const roofH = o.roofH ?? 2.8
  const y0 = 0.75
  const over = o.over ?? 1.2
  const wallMat = o.wallMat ?? M.plaster
  const colMat = o.colMat ?? M.paintRed
  const roofMat = o.roofMat ?? M.darkTile

  const rg = new THREE.Group()
  rg.position.set(cx, 0, cz)
  rg.rotation.y = o.ry ?? 0
  g.add(rg)

  // 台基（两层）+ 阶条石
  box(w + 2.2, 0.55, d + 2.2, M.tuff, 0, 0.275, 0, rg)
  box(w + 2.6, 0.2, d + 2.6, M.whiteStone, 0, 0.65, 0, rg)
  // 墙身
  box(w, wallH, d, wallMat, 0, y0 + wallH / 2, 0, rg)
  // 檐柱 + 柱础
  const n = Math.max(3, Math.round(w / 3.4) + 1)
  if (o.cols !== false) {
    for (let i = 0; i < n; i++) {
      const px = -w / 2 + 0.35 + i * ((w - 0.7) / (n - 1))
      for (const sz of [-1, 1]) {
        cyl(0.24, 0.28, wallH + 0.12, colMat, px, y0 + wallH / 2, sz * (d / 2 + 0.46), 10, rg)
        box(0.66, 0.16, 0.66, M.tuff, px, y0 + 0.08, sz * (d / 2 + 0.46), rg)
      }
    }
    for (const sz of [-1, 1]) {
      box(w + 1.1, 0.34, 0.28, colMat, 0, y0 + wallH - 0.16, sz * (d / 2 + 0.46), rg)
      box(w + 1.1, 0.14, 0.4, M.gold, 0, y0 + wallH - 0.42, sz * (d / 2 + 0.46), rg)
    }
    bracketBand(rg, w + 0.4, d + 1.0, y0 + wallH - 0.62, M.darkTile, Math.max(5, n + 1), 4)
  }
  // 格扇门（正面）+ 横披窗
  const dn = o.doors ?? 4
  const dw = (w - 1.6) / dn
  for (let i = 0; i < dn; i++) {
    const px = -w / 2 + 0.8 + dw * (i + 0.5)
    box(dw - 0.14, wallH - 0.7, 0.14, M.teak, px, y0 + (wallH - 0.7) / 2 + 0.1, d / 2 + 0.02, rg)
    for (let k = 0; k < 5; k++) box(dw - 0.3, 0.09, 0.08, M.darkFrame, px, y0 + 0.7 + k * 0.5, d / 2 + 0.1, rg)
    box(0.1, wallH - 0.7, 0.1, M.darkFrame, px, y0 + (wallH - 0.7) / 2 + 0.1, d / 2 + 0.1, rg)
    // 门顶横披窗（透光格心）
    box(dw - 0.3, 0.5, 0.1, M.glAmber, px, y0 + wallH - 0.36, d / 2 + 0.04, rg)
    for (let k = 0; k < 4; k++) box(0.07, 0.5, 0.12, M.darkFrame, px - dw / 2 + 0.2 + k * ((dw - 0.4) / 3), y0 + wallH - 0.36, d / 2 + 0.1, rg)
  }
  // 后墙直棂窗 + 侧面高窗
  for (let i = 0; i < Math.max(1, dn - 1); i++) {
    const px = -w / 2 + 1.6 + i * ((w - 3.2) / Math.max(1, dn - 2))
    box(1.3, 1.1, 0.1, M.glAmber, px, y0 + wallH - 1.1, -d / 2 - 0.02, rg)
    for (let k = 0; k < 4; k++) box(0.08, 1.1, 0.12, M.darkFrame, px - 0.45 + k * 0.3, y0 + wallH - 1.1, -d / 2 - 0.08, rg)
  }
  for (let i = 0; i < Math.max(1, dn - 2); i++) {
    for (const sx of [-1, 1]) {
      const pz = -d / 4 + i * (d / 2 / Math.max(1, dn - 3))
      box(0.1, 1.0, 1.4, M.glAmber, sx * (w / 2 + 0.02), y0 + wallH - 1.0, pz, rg)
      for (let k = 0; k < 3; k++) box(0.12, 1.0, 0.08, M.darkFrame, sx * (w / 2 + 0.08), y0 + wallH - 1.0, pz - 0.4 + k * 0.4, rg)
    }
  }
  // 屋顶（瓦垄 + 正脊 + 鸱吻 + 檐口瓦当）
  const ry = y0 + wallH + 0.36
  cnGableRoof(rg, w, d, ry, roofH, roofMat, over)
  return rg
}

/** 中式抄手游廊：柱 + 坐凳栏杆 + 卷棚顶 */
function corridor(g, cx, cz, len, ry = 0) {
  const s = new THREE.Group()
  s.position.set(cx, 0, cz)
  s.rotation.y = ry
  g.add(s)
  const n = Math.max(2, Math.round(len / 2.8))
  for (let i = 0; i <= n; i++) {
    const px = -len / 2 + (len / n) * i
    for (const sz of [-1, 1]) {
      cyl(0.16, 0.18, 2.7, M.paintRed, px, 1.35, sz * 1.1, 8, s)
      box(0.4, 0.5, 0.28, M.paintRed, px, 0.55, sz * 1.1, s)
    }
    box(0.2, 0.12, 2.4, M.paintRed, px, 2.75, 0, s)
  }
  const geo = new THREE.CylinderGeometry(1.5, 1.5, len + 0.6, 14, 1, false, 0, Math.PI)
  const r = new THREE.Mesh(geo, M.darkTile)
  r.rotation.z = Math.PI / 2
  r.rotation.y = Math.PI / 2
  r.position.set(0, 3.0, 0)
  r.scale.set(1, 1, 0.62)
  r.castShadow = true
  s.add(r)
  return s
}

/** 中式院墙（两点之间） */
function courtWall(g, x1, z1, x2, z2, h = 3.0) {
  const len = Math.hypot(x2 - x1, z2 - z1)
  const cx = (x1 + x2) / 2
  const cz = (z1 + z2) / 2
  const ry = Math.atan2(x2 - x1, z2 - z1)
  const s = new THREE.Group()
  s.position.set(cx, 0, cz)
  s.rotation.y = ry
  g.add(s)
  box(0.5, h, len, M.plasterGrey, 0, h / 2, 0, s)
  box(0.74, 0.18, len + 0.1, M.tuff, 0, 0.12, 0, s)
  box(1.0, 0.3, len + 0.2, M.darkTile, 0, h + 0.15, 0, s)
  box(0.86, 0.12, len + 0.3, M.darkFrame, 0, h + 0.34, 0, s)
  return s
}

// ---------- 这批建筑专用的屋顶/构件 ----------
/** 四坡 / 攒尖顶（方锥），over 为出檐，ox/oz 用于偏置 */
function hipRoof(g, w, d, y, h, mat, over = 0.8, ox = 0, oz = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4, 1, false), mat)
  m.rotation.y = Math.PI / 4
  m.scale.set((w + over * 2) * 0.70711, h, (d + over * 2) * 0.70711)
  m.castShadow = m.receiveShadow = true
  return add(m, ox, y + h / 2 + 0.02, oz, g)
}

// ---------- 中式瓦面：瓦垄 / 正脊 / 鸱吻 / 戗脊 / 起翘 / 角铃 ----------
/** 两点之间的斜梁、屋脊（几何沿 z 对齐后 lookAt） */
function beamBetween(g, ax, ay, az, bx, by, bz, t, mat, h = t) {
  const dir = new THREE.Vector3(bx - ax, by - ay, bz - az)
  const len = dir.length()
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, h, len), mat)
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
  // 用局部四元数对齐 +Z，避免依赖尚未更新的父级世界矩阵
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize())
  m.castShadow = m.receiveShadow = true
  g.add(m)
  return m
}
/** 双坡屋面的瓦垄 + 檐口滴水（dir=+1 朝 +z，-1 朝 -z） */
function tileSlope(g, w, dHalf, y, h, mat, over, dir, step = 0.46) {
  const run = dHalf + over
  const len = Math.hypot(run, h)
  const ang = Math.atan2(h, run)
  const n = Math.max(2, Math.round((w + over * 2) / step))
  for (let i = 0; i <= n; i++) {
    const x = -(w / 2 + over) + (w + over * 2) * (i / n)
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, len), mat)
    r.position.set(x, y + h / 2 + 0.06, dir * run / 2)
    r.rotation.x = dir * ang
    g.add(r)
  }
  // 檐口压边 + 瓦当 + 滴水
  box(w + over * 2 + 0.3, 0.18, 0.34, mat, 0, y + 0.04, dir * (run + 0.05), g)
  for (let i = 0; i <= n; i += 2) {
    const x = -(w / 2 + over) + (w + over * 2) * (i / n)
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 7), mat)
    d.rotation.x = Math.PI / 2
    d.position.set(x, y + 0.06, dir * (run + 0.2))
    g.add(d)
  }
  // 檐角起翘
  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.46), mat)
    tip.position.set(sx * (w / 2 + over + 0.3), y + 0.2, dir * (run - 0.12))
    tip.rotation.z = sx * 0.34
    tip.rotation.x = dir * -0.1
    g.add(tip)
  }
}
/** 正脊 + 两端鸱吻 */
function ridgeBeast(g, x, y, z, sx, mat) {
  box(0.46, 0.66, 0.42, mat, x, y - 0.16, z, g)
  box(0.34, 0.5, 0.34, mat, x - sx * 0.1, y + 0.34, z, g)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.78, 4), mat)
  tail.position.set(x + sx * 0.16, y + 0.72, z)
  tail.rotation.z = sx * 0.45
  g.add(tail)
}
/** 中式双坡屋顶（可整体 x 偏移） */
function cnGableRoof(g, w, d, y, h, mat, over = 1.0, ox = 0) {
  const s = new THREE.Group()
  s.position.x = ox
  g.add(s)
  gableRoof(s, w, d, y, h, mat, over)
  tileSlope(s, w, d / 2, y, h, mat, over, 1)
  tileSlope(s, w, d / 2, y, h, mat, over, -1)
  // 正脊 + 鸱吻
  box(w + over * 2 + 0.3, 0.3, 0.56, mat, 0, y + h - 0.02, 0, s)
  box(w + over * 2 + 0.44, 0.1, 0.72, M.darkFrame, 0, y + h + 0.14, 0, s)
  for (const sx of [-1, 1]) ridgeBeast(s, sx * (w / 2 + over), y + h + 0.1, 0, sx, mat)
  // 山面博缝板 + 悬鱼
  for (const sx of [-1, 1]) {
    box(0.16, 0.28, d * 0.5, mat, sx * (w / 2 + over - 0.1), y + h * 0.55, 0, s).rotation.x = 0
    const fish = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 4), M.gold)
    fish.position.set(sx * (w / 2 + over - 0.02), y + h * 0.44, 0)
    fish.rotation.x = Math.PI
    s.add(fish)
  }
  return s
}
/** 中式庑殿顶：正脊 + 四坡瓦垄 + 垂脊 + 起翘 + 角铃（矩形平面用） */
function hippedRoof(g, w, d, y, h, mat, over = 1.2, ox = 0, oz = 0, o = {}) {
  const s = new THREE.Group()
  s.position.set(ox, 0, oz)
  g.add(s)
  const X = w / 2 + over
  const Z = d / 2 + over
  const R = Math.max(0.6, (w - d) / 2)   // 正脊半长
  const ay = y + h
  // 屋面四个坡面（两个梯形 + 两个三角）
  const pos = []
  const uv = []
  const push = (a, b, c, u, v) => { pos.push(a, b, c); uv.push(u, v) }
  const quad = (a, b, c, dd) => {
    push(...a, 0, 0); push(...b, 1, 0); push(...c, 1, 1)
    push(...a, 0, 0); push(...c, 1, 1); push(...dd, 0, 1)
  }
  quad([-X, y, Z], [X, y, Z], [R, ay, 0], [-R, ay, 0])
  quad([X, y, -Z], [-X, y, -Z], [-R, ay, 0], [R, ay, 0])
  push(X, y, Z, 0, 0); push(X, y, -Z, 0, 1); push(R, ay, 0, 1, 0)
  push(-X, y, -Z, 0, 0); push(-X, y, Z, 0, 1); push(-R, ay, 0, 1, 0)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.computeVertexNormals()
  const shell = new THREE.Mesh(geo, mat)
  shell.castShadow = shell.receiveShadow = true
  s.add(shell)

  const clampR = (px) => Math.max(-R, Math.min(R, px))
  // 前后坡瓦垄（向正脊收拢）
  for (const sz of [-1, 1]) {
    const n = Math.max(4, Math.round((X * 2) / 0.46))
    for (let i = 0; i <= n; i++) {
      const px = -X + (X * 2) * (i / n)
      beamBetween(s, px, y + 0.04, sz * Z, clampR(px), ay, 0, 0.14, mat, 0.1)
    }
  }
  // 两端山坡瓦垄（向正脊端点收拢）
  for (const sx of [-1, 1]) {
    const n = Math.max(3, Math.round((Z * 2) / 0.46))
    for (let i = 0; i <= n; i++) {
      const pz = -Z + (Z * 2) * (i / n)
      beamBetween(s, sx * X, y + 0.04, pz, sx * R, ay, 0, 0.14, mat, 0.1)
    }
  }
  // 正脊 + 鸱吻
  box(R * 2 + 0.5, 0.3, 0.58, mat, 0, ay - 0.02, 0, s)
  box(R * 2 + 0.66, 0.1, 0.74, M.darkFrame, 0, ay + 0.15, 0, s)
  for (const sx of [-1, 1]) ridgeBeast(s, sx * (R + 0.1), ay + 0.1, 0, sx, mat)
  // 垂脊 + 起翘 + 角铃
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      beamBetween(s, sx * R, ay, 0, sx * X, y + 0.04, sz * Z, 0.26, mat, 0.26)
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.5), mat)
      tip.position.set(sx * (X + 0.26), y + 0.22, sz * Z)
      tip.rotation.z = sx * 0.36
      s.add(tip)
      if (o.bells) {
        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), M.gold)
        bell.position.set(sx * (X + 0.48), y - 0.02, sz * Z)
        bell.rotation.x = Math.PI
        s.add(bell)
      }
    }
  }
  // 檐口压边 + 瓦当
  for (const sz of [-1, 1]) {
    box(X * 2 + 0.34, 0.18, 0.34, mat, 0, y + 0.06, sz * Z, s)
    for (let i = 0; i <= 12; i++) {
      const d2 = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 7), mat)
      d2.rotation.x = Math.PI / 2
      d2.position.set(-X + (X * 2) * (i / 12), y + 0.07, sz * (Z + 0.16))
      s.add(d2)
    }
  }
  for (const sx of [-1, 1]) box(0.34, 0.18, Z * 2 + 0.34, mat, sx * X, y + 0.06, 0, s)
  return s
}

/** 中式四坡/攒尖屋顶（含戗脊、起翘、放射瓦垄、角铃） */
function cnHipRoof(g, w, d, y, h, mat, over = 1.2, ox = 0, oz = 0, o = {}) {
  const s = new THREE.Group()
  s.position.set(ox, 0, oz)
  g.add(s)
  hipRoof(s, w, d, y, h, mat, over)
  const X = w / 2 + over
  const Z = d / 2 + over
  const ay = y + h + 0.02
  // 放射瓦垄（四面）
  for (const dir of [1, -1]) {
    const n = Math.max(3, Math.round(X * 2 / 0.9))
    for (let i = 0; i <= n; i++) {
      const px = -X + (X * 2) * (i / n)
      beamBetween(s, px, y + 0.04, dir * Z, 0, ay, 0, 0.13, mat, 0.11)
    }
    const m = Math.max(3, Math.round(Z * 2 / 0.9))
    for (let i = 0; i <= m; i++) {
      const pz = -Z + (Z * 2) * (i / m)
      beamBetween(s, dir * X, y + 0.04, pz, 0, ay, 0, 0.13, mat, 0.11)
    }
  }
  // 戗脊 + 起翘 + 角铃
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      beamBetween(s, sx * X, y + 0.02, sz * Z, 0, ay + 0.04, 0, 0.26, mat, 0.28)
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.5), mat)
      tip.position.set(sx * (X + 0.28), y + 0.22, sz * Z)
      tip.rotation.z = sx * 0.36
      s.add(tip)
      if (o.bells !== false) {
        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 8), M.gold)
        bell.position.set(sx * (X + 0.5), y - 0.02, sz * Z)
        bell.rotation.x = Math.PI
        s.add(bell)
      }
    }
  }
  // 檐口压边
  for (const sz of [-1, 1]) box(w + over * 2 + 0.36, 0.18, 0.36, mat, 0, y + 0.06, sz * (Z + 0.02), s)
  for (const sx of [-1, 1]) box(0.36, 0.18, d + over * 2 + 0.36, mat, sx * (X + 0.02), y + 0.06, 0, s)
  // 宝顶
  if (o.finial !== false) {
    cyl(0.3, 0.42, 0.7, M.gold, 0, ay + 0.3, 0, 10, s)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), M.gold)
    add(orb, 0, ay + 0.95, 0, s)
    cone(0.24, 0.8, M.gold, 0, ay + 1.5, 0, 10, s)
  }
  return s
}
/** 筒拱顶（沿 x 向的半圆壳，y 为起拱高度） */
function barrelRoof(g, len, r, y, mat, z = 0, seg = 22) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1, true, 0, Math.PI), mat)
  m.rotation.z = Math.PI / 2
  m.castShadow = m.receiveShadow = true
  return add(m, 0, y, z, g)
}
/** 筒拱的横向拱肋 */
function vaultRibs(g, len, r, y, mat, n = 6, z = 0) {
  for (let i = 0; i <= n; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.1, 5, 18, Math.PI), mat)
    rib.rotation.y = Math.PI / 2
    add(rib, -len / 2 + (len / n) * i, y, z, g)
  }
}
/** 洋葱顶（东正教） */
function onionDome(g, r, y, mat, seg = 28) {
  const prof = [[1, 0], [1.14, 0.3], [1.16, 0.58], [1.04, 0.95], [0.76, 1.34], [0.4, 1.66], [0.1, 1.9], [0, 1.96]]
  const pts = prof.map(([a, b]) => new THREE.Vector2(Math.max(a * r, 0.002), b * r))
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat)
  m.castShadow = true
  return add(m, 0, y, 0, g)
}
/** 檐下斗拱：一圈托块 */
function bracketBand(g, w, d, y, mat, nx = 7, nz = 5) {
  for (let i = 0; i < nx; i++) {
    const t = -w / 2 + (w / (nx - 1)) * i
    for (const sz of [-1, 1]) box(0.42, 0.34, 0.72, mat, t, y, sz * (d / 2 + 0.02), g)
  }
  for (let i = 1; i < nz - 1; i++) {
    const t = -d / 2 + (d / (nz - 1)) * i
    for (const sx of [-1, 1]) box(0.72, 0.34, 0.42, mat, sx * (w / 2 + 0.02), y, t, g)
  }
}
/** 柱廊：一排圆柱 + 檐部 */
function colonnade(g, w, y0, h, mat, z, n = 6, r = 0.42) {
  for (let i = 0; i < n; i++) {
    const px = -w / 2 + (w / (n - 1)) * i
    cyl(r, r * 1.08, h, mat, px, y0 + h / 2, z, 12, g)
    cyl(r * 1.5, r * 1.5, 0.2, mat, px, y0 + 0.1, z, 12, g)
    cyl(r * 1.4, r * 1.4, 0.24, mat, px, y0 + h - 0.12, z, 12, g)
  }
  box(w + 1.2, 0.7, 1.6, mat, 0, y0 + h + 0.35, z, g)
}
/** 三角山花（真实三角面，而非三棱柱） */
function pediment(g, w, h, d, mat, y, z) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = m.receiveShadow = true
  return add(m, 0, y, z - d / 2, g)
}
/** 台阶：y 为平台顶标高，向外逐级降低；y=0 时退化为矮台 */
function steps(g, w, n, h, d, y, mat, z) {
  for (let i = 0; i < n; i++) {
    const hh = y > 0 ? Math.max(0.1, y - i * h) : h
    box(w, hh, d, mat, 0, hh / 2, z + i * d, g)
  }
}

/** 55 板式高层住宅 */
function t55(x, z) {
  const g = group(x, z, 0.05)
  const bays = 11
  const bw = 3.4
  const w = bays * bw
  const d = 12
  const fh = 2.9
  const floors = 18
  const H = floors * fh

  box(w, H, d, M.plasterWarm, 0, H / 2, 0, g)
  // 勒脚 + 两端山墙壁柱
  box(w + 0.5, 1.2, d + 0.5, M.whiteStone, 0, 0.6, 0, g)
  for (const sx of [-1, 1]) box(0.46, H, d + 0.2, M.whiteStone, sx * (w / 2 + 0.06), H / 2, 0, g)
  // 山墙上的雨水管
  for (const sx of [-1, 1]) {
    downpipe(g, sx * (w / 2 + 0.32), d / 2 - 0.5, H + 0.6)
    downpipe(g, sx * (w / 2 + 0.32), -d / 2 + 0.5, H + 0.6)
  }

  for (let f = 0; f < floors; f++) {
    const y = f * fh
    // 楼板腰线（每层一圈）
    bandRing(g, w, d, y + fh - 0.1, M.whiteStone, 0.2, 0.13)
    for (let i = 0; i < bays; i++) {
      const px = -w / 2 + bw * (i + 0.5)

      // 南立面：挑出阳台
      box(3.0, 0.16, 1.6, M.plaster, px, y + 0.08, d / 2 + 0.8, g)          // 阳台板
      box(2.96, 0.98, 0.15, M.plasterWarm, px, y + 0.65, d / 2 + 1.52, g)   // 栏板
      box(3.06, 0.08, 0.26, M.whiteStone, px, y + 1.16, d / 2 + 1.52, g)    // 扶手压顶
      for (const sx of [-1, 1]) box(0.14, 0.98, 1.55, M.plasterWarm, px + sx * 1.44, y + 0.65, d / 2 + 0.77, g)
      // 阳台内墙：推拉门 + 侧窗
      win(g, px - 0.22, y + 1.16, d / 2 + 0.05, 0, 2.4, 2.16, { glass: M.glSmoke, frame: M.aluPanel, mull: 2 })
      win(g, px + 1.34, y + 1.62, d / 2 + 0.05, 0, 0.62, 1.2, { glass: M.glSmoke, frame: M.aluPanel })
      // 晾衣杆
      for (const oy of [0.15, 0.34]) box(2.7, 0.05, 0.05, M.brightSilver, px, y + 2.62 + oy, d / 2 + 1.3, g)
      // 空调外机（挂在阳台侧上方）
      if (f > 0) acUnit(g, px + 1.5, y + 2.28, d / 2 + 0.02, 0)

      // 北立面：厨房窗 + 卫生间小窗
      win(g, px - 0.55, y + 1.9, -d / 2 - 0.03, Math.PI, 1.75, 1.5, { glass: M.glSmoke, frame: M.aluPanel, mull: 1 })
      win(g, px + 1.0, y + 2.1, -d / 2 - 0.03, Math.PI, 0.85, 1.05, { glass: M.glSmoke, frame: M.aluPanel })
    }
  }

  // 两个楼梯电梯间（北侧外凸）+ 单元入口
  for (const sx of [-1, 1]) {
    const ux = sx * w / 4
    const uh = H + 3.4
    box(3.5, uh, 1.7, M.aluPanel, ux, uh / 2, -d / 2 - 0.85, g)
    box(3.9, 0.5, 2.1, M.whiteStone, ux, uh + 0.25, -d / 2 - 0.85, g)
    // 楼梯间竖向条窗
    for (let f = 0; f < floors; f++) {
      if (f % 2 === 0) box(1.5, 1.35, 0.1, M.glWhite, ux, f * fh + 1.85, -d / 2 - 1.72, g)
    }
    // 单元门 + 台阶 + 雨篷 + 门牌 + 信报箱
    box(2.5, 2.5, 0.22, M.charcoal, ux, 1.35, -d / 2 - 1.78, g)
    box(2.1, 2.2, 0.12, M.glSmoke, ux, 1.3, -d / 2 - 1.9, g)
    box(0.07, 2.2, 0.14, M.aluPanel, ux, 1.3, -d / 2 - 1.97, g)
    for (let k = 0; k < 3; k++) box(3.6, 0.2, 0.4 + k * 0.4, M.whiteStone, ux, 0.1 + (2 - k) * 0.2, -d / 2 - 2.3 - k * 0.4, g)
    awning(g, ux, 3.4, -d / 2 - 1.9, 3.2, 1.5, M.brightSilver, Math.PI)
    box(0.7, 1.5, 0.14, M.glazeWhite, ux + 1.85, 1.4, -d / 2 - 1.9, g)
    box(0.5, 0.3, 0.12, M.paintBlue, ux + 1.85, 2.55, -d / 2 - 1.98, g)
  }

  // 屋面：女儿墙、楼梯间出屋面、水箱、太阳能、机房、避雷针
  parapet(g, w, d, H, M.plasterWarm, 0.95, 0.32)
  for (const sx of [-1, 1]) {
    const ux = sx * w / 4
    box(3.5, 2.2, 1.7, M.aluPanel, ux, H + 1.1, -d / 2 - 0.85, g)
    box(3.7, 0.16, 1.9, M.whiteStone, ux, H + 2.26, -d / 2 - 0.85, g)
  }
  // 水箱（不锈钢圆柱）
  cyl(2.0, 2.0, 2.4, M.brightSilver, w / 2 - 5, H + 1.2, 1.5, 20, g)
  cyl(2.2, 2.2, 0.16, M.aluDark, w / 2 - 5, H + 2.48, 1.5, 20, g)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    box(0.16, 1.0, 0.16, M.aluDark, w / 2 - 5 + Math.cos(a) * 1.5, H + 0.5, 1.5 + Math.sin(a) * 1.5, g)
  }
  // 太阳能板阵列
  for (let i = 0; i < 5; i++) {
    const px = -w / 2 + 6 + i * 2.6
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.3), M.glDeepBlue)
    p.position.set(px, H + 1.3, -1.6)
    p.rotation.x = -0.42
    p.castShadow = true
    g.add(p)
    box(0.08, 0.85, 0.08, M.aluDark, px - 0.8, H + 0.85, -1.9, g)
    box(0.08, 0.85, 0.08, M.aluDark, px + 0.8, H + 0.85, -1.9, g)
  }
  // 电梯机房 + 通风管 + 避雷针
  box(4.6, 2.6, 3.6, M.plasterGrey, -w / 2 + 4.6, H + 1.3, 1.2, g)
  box(5.0, 0.18, 4.0, M.whiteStone, -w / 2 + 4.6, H + 2.68, 1.2, g)
  for (let i = 0; i < 4; i++) cyl(0.14, 0.14, 1.1, M.aluPanel, -6 + i * 3.4, H + 0.55, 3.2, 6, g)
  cyl(0.05, 0.05, 3.2, M.darkFrame, -w / 2 + 1.5, H + 1.6, 0, 4, g)

  // 场地：单元步道 + 停车位 + 花池
  for (const sx of [-1, 1]) box(4.0, 0.1, 6.5, M.paving, sx * w / 4, 0.06, -d / 2 - 6.6, g)
  for (let i = 0; i < 6; i++) box(0.12, 0.05, 5.0, M.roadPaint, -15 + i * 5.6, 0.12, -d / 2 - 12.4, g)
  for (const sx of [-1, 1]) planter(g, sx * 9, d / 2 + 5.5, 7, 1.8)
  return { g, top: H + 8 }
}

/** 56 点式住宅塔（八边形，每层 6 户） */
function t56(x, z) {
  const g = group(x, z, 0)
  const r = 9.6
  const apo = r * Math.cos(Math.PI / 8)
  const edge = 2 * r * Math.sin(Math.PI / 8)
  const fh = 2.9
  const floors = 18
  const H = floors * fh

  // 主体 + 勒脚（八边形，先转 22.5° 让面正对坐标轴）
  const body = cyl(r, r, H, M.plasterWarm, 0, H / 2, 0, 8, g)
  body.rotation.y = Math.PI / 8
  const plinth = cyl(r + 0.42, r + 0.42, 1.1, M.whiteStone, 0, 0.55, 0, 8, g)
  plinth.rotation.y = Math.PI / 8
  const base = cyl(r + 0.62, r + 0.62, 0.22, M.whiteStone, 0, 1.2, 0, 8, g)
  base.rotation.y = Math.PI / 8

  for (let f = 0; f < floors; f++) {
    const y = f * fh
    for (let i = 0; i < 8; i++) {
      const A = (i / 8) * Math.PI * 2
      const ry = Math.PI / 2 - A
      const s = new THREE.Group()
      s.position.set(Math.cos(A) * apo, y, Math.sin(A) * apo)
      s.rotation.y = ry
      g.add(s)

      if (i % 4 === 0) {
        // 电梯/楼梯面：竖向条窗 + 层间梁
        win(s, 0, 1.55, 0.04, 0, 1.7, 1.5, { glass: M.glWhite, frame: M.aluPanel, mull: 1 })
        box(edge - 0.6, 0.16, 0.18, M.whiteStone, 0, 0.02, 0.09, s)
        box(edge - 0.6, 0.2, 0.18, M.whiteStone, 0, fh - 0.16, 0.09, s)
        continue
      }

      // 窗台线 / 过梁线（每户一条，形成水平线条）
      box(edge - 0.24, 0.14, 0.2, M.whiteStone, 0, 1.06, 0.1, s)
      box(edge - 0.24, 0.22, 0.2, M.whiteStone, 0, fh - 0.16, 0.1, s)

      // 凹阳台：底板 + 栏板 + 侧板
      box(4.3, 0.16, 1.4, M.plaster, 0, 0.1, 0.72, s)
      box(4.26, 0.96, 0.15, M.plasterWarm, 0, 0.66, 1.4, s)
      box(4.38, 0.09, 0.26, M.whiteStone, 0, 1.17, 1.4, s)
      for (const sx of [-1, 1]) box(0.14, 0.96, 1.35, M.plasterWarm, sx * 2.1, 0.66, 0.7, s)
      // 阳台门 + 两侧卧室窗
      win(s, 0, 1.2, 0.05, 0, 2.5, 2.2, { glass: M.glSmoke, frame: M.aluPanel, mull: 2 })
      for (const sx of [-1, 1]) win(s, sx * 3.05, 1.72, 0.05, 0, 1.45, 1.5, { glass: M.glSmoke, frame: M.aluPanel, mull: 1 })
      // 晾衣杆 + 空调外机
      for (const oy of [0.1, 0.28]) box(3.9, 0.05, 0.05, M.brightSilver, 0, 2.6 + oy, 1.15, s)
      if (f > 0) acUnit(s, 2.55, 2.32, 0.02, 0)
    }
  }

  // 入口（正面 +z 方向的面）
  {
    const A = Math.PI / 2
    const ry = Math.PI / 2 - A
    const s = new THREE.Group()
    s.position.set(Math.cos(A) * apo, 0, Math.sin(A) * apo)
    s.rotation.y = ry
    g.add(s)
    box(4.4, 3.2, 0.3, M.charcoal, 0, 1.6, 0.1, s)
    box(3.6, 2.7, 0.16, M.glSmoke, 0, 1.42, 0.24, s)
    box(0.08, 2.7, 0.16, M.aluPanel, 0, 1.42, 0.3, s)
    for (let k = 0; k < 3; k++) box(5.2, 0.2, 0.5 + k * 0.42, M.whiteStone, 0, 0.1 + (2 - k) * 0.2, 0.6 + k * 0.42, s)
    awning(s, 0, 3.5, 0.2, 4.6, 1.7, M.brightSilver, 0)
    box(0.62, 1.2, 0.14, M.glazeWhite, 0, 1.6, 0.32, s)
  }

  // 屋面：女儿墙（八段）、电梯机房、水箱、避雷针
  for (let i = 0; i < 8; i++) {
    const A = (i / 8) * Math.PI * 2
    const seg = box(edge + 0.3, 0.95, 0.34, M.plasterWarm, Math.cos(A) * apo, H + 0.48, Math.sin(A) * apo, g)
    seg.rotation.y = Math.PI / 2 - A
    const cap = box(edge + 0.44, 0.13, 0.5, M.whiteStone, Math.cos(A) * apo, H + 0.99, Math.sin(A) * apo, g)
    cap.rotation.y = Math.PI / 2 - A
  }
  cyl(3.0, 3.0, 2.6, M.plasterGrey, 0, H + 1.3, 0, 8, g).rotation.y = Math.PI / 8
  cyl(3.2, 3.2, 0.18, M.whiteStone, 0, H + 2.7, 0, 8, g).rotation.y = Math.PI / 8
  cyl(1.9, 1.9, 2.2, M.brightSilver, 3.4, H + 1.1, 3.4, 18, g)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    box(0.14, 0.9, 0.14, M.aluDark, 3.4 + Math.cos(a) * 1.4, H + 0.45, 3.4 + Math.sin(a) * 1.4, g)
  }
  for (const [px, pz] of [[-4, 4], [4.6, -3.6]]) cyl(0.05, 0.05, 3.4, M.darkFrame, px, H + 1.7, pz, 4, g)

  // 场地：环形步道 + 花池
  const walk = new THREE.Mesh(new THREE.RingGeometry(apo + 2.2, apo + 5.2, 40), M.paving)
  walk.rotation.x = -Math.PI / 2
  add(walk, 0, 0.07, 0, g)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    planter(g, Math.cos(a) * (apo + 6.2), Math.sin(a) * (apo + 6.2), 3.4, 1.6)
  }
  return { g, top: H + 5 }
}

/** 57 小区行列式住宅 */
function t57(x, z) {
  const g = group(x, z, 0.05)
  const fh = 2.9
  const floors = 6
  const H = floors * fh
  const bw = 3.3
  const bays = 9
  const w = bays * bw
  const d = 10.6

  for (let bi = 0; bi < 2; bi++) {
    const bz = bi ? 7.6 : -7.6
    box(w, H, d, M.plaster, 0, H / 2, bz, g)
    box(w + 0.44, 1.0, d + 0.44, M.whiteStone, 0, 0.5, bz, g)          // 勒脚
    box(w + 0.66, 0.46, d + 0.66, M.whiteStone, 0, H + 0.23, bz, g)    // 檐口
    // 两端山墙
    for (const sx of [-1, 1]) box(0.4, H, d + 0.1, M.whiteStone, sx * (w / 2 + 0.05), H / 2, bz, g)
    for (const sx of [-1, 1]) downpipe(g, sx * (w / 2 + 0.26), bz + d / 2 - 0.4, H + 0.5)

    for (let f = 0; f < floors; f++) {
      const y = f * fh
      // 圈梁腰线
      box(w + 0.26, 0.17, 0.2, M.whiteStone, 0, y + fh - 0.08, bz + d / 2, g)
      box(w + 0.26, 0.17, 0.2, M.whiteStone, 0, y + fh - 0.08, bz - d / 2, g)
      for (let i = 0; i < bays; i++) {
        const px = -w / 2 + bw * (i + 0.5)
        const zf = bz + d / 2
        // 阳台
        box(2.7, 0.15, 1.35, M.plaster, px, y + 0.08, zf + 0.67, g)
        box(2.66, 0.94, 0.14, M.plasterWarm, px, y + 0.62, zf + 1.3, g)
        box(2.78, 0.08, 0.24, M.whiteStone, px, y + 1.12, zf + 1.3, g)
        for (const sx of [-1, 1]) box(0.13, 0.94, 1.3, M.plasterWarm, px + sx * 1.29, y + 0.62, zf + 0.66, g)
        win(g, px, y + 1.12, zf + 0.04, 0, 2.3, 2.1, { glass: M.glSmoke, frame: M.aluPanel, mull: 2 })
        for (const oy of [0.12, 0.3]) box(2.4, 0.05, 0.05, M.brightSilver, px, y + 2.5 + oy, zf + 1.15, g)
        if (f > 0) acUnit(g, px + 1.32, y + 2.2, zf + 0.02, 0)
        // 北面窗
        const zb = bz - d / 2
        win(g, px - 0.5, y + 1.85, zb - 0.03, Math.PI, 1.55, 1.4, { glass: M.glSmoke, frame: M.aluPanel })
        win(g, px + 1.0, y + 2.05, zb - 0.03, Math.PI, 0.8, 1.0, { glass: M.glSmoke, frame: M.aluPanel })
      }
    }

    // 三个单元入口
    for (let u = 0; u < 3; u++) {
      const ux = -10 + u * 10
      const zf = bz + d / 2 + 0.02
      box(3.4, 3.0, 1.3, M.plasterGrey, ux, 1.5, zf - 0.55, g)
      box(3.7, 0.24, 1.7, M.whiteStone, ux, 3.1, zf - 0.55, g)
      box(2.3, 2.4, 0.2, M.charcoal, ux, 1.25, zf + 0.1, g)
      box(1.9, 2.15, 0.12, M.glSmoke, ux, 1.22, zf + 0.22, g)
      for (let k = 0; k < 3; k++) box(4.0, 0.18, 0.36 + k * 0.36, M.whiteStone, ux, 0.09 + (2 - k) * 0.18, zf + 0.5 + k * 0.36, g)
      awning(g, ux, 3.6, zf + 0.15, 3.0, 1.4, M.brightSilver, 0)
      box(0.6, 1.35, 0.12, M.glazeWhite, ux + 1.55, 1.35, zf + 0.2, g)
      box(0.52, 0.28, 0.1, M.paintBlue, ux + 1.55, 2.45, zf + 0.22, g)
    }
    // 屋面：女儿墙 + 太阳能 + 楼梯间
    parapet(g, w, d, H + 0.46, M.plaster, 0.9, 0.3)
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 1.2), M.glDeepBlue)
      p.position.set(-12 + i * 4.8, H + 1.5, bz - 2.2)
      p.rotation.x = -0.42
      p.castShadow = true
      g.add(p)
      box(0.07, 0.8, 0.07, M.aluDark, -12.8 + i * 4.8, H + 1.05, bz - 2.5, g)
    }
    for (const ux of [-10, 10]) {
      box(3.4, 2.2, 3.0, M.aluPanel, ux, H + 1.1, bz, g)
      box(3.7, 0.16, 3.3, M.whiteStone, ux, H + 2.26, bz, g)
    }
    cyl(1.6, 1.6, 2.0, M.brightSilver, 0, H + 1.0, bz, 16, g)
  }

  // 院落：步道 + 花池 + 儿童活动 + 停车 + 垃圾分类
  box(30, 0.12, 7, M.paving, 0, 0.06, 0, g)
  for (const sx of [-1, 1]) planter(g, sx * 9, 0, 9, 2.0)
  box(5.0, 0.1, 4.0, M.sandstone, -11, 0.1, 12.5, g)        // 沙坑
  box(3.4, 0.16, 2.6, M.paintYell, -11.6, 1.6, 11.4, g)     // 游戏台
  cyl(0.14, 0.14, 1.6, M.paintGreen, -10.2, 0.8, 11.4, 8, g)
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 3.4), M.paintBlue)
  slide.position.set(-12.8, 0.9, 13.4)
  slide.rotation.x = 0.44
  slide.castShadow = true
  g.add(slide)
  for (let i = 0; i < 6; i++) box(0.12, 0.05, 5.0, M.roadPaint, 2 + i * 3.4, 0.13, 13.6, g)
  box(3.2, 2.3, 2.2, M.plasterGrey, 14, 1.15, 5.0, g)        // 垃圾房
  box(3.5, 0.18, 2.5, M.aluDark, 14, 2.4, 5.0, g)
  for (const sxx of [-1, 1]) box(0.9, 1.1, 0.12, M.paintGreen, 14 + sxx * 0.8, 0.9, 6.1, g)
  // 自行车棚
  box(9, 0.16, 2.6, M.membrane, 6, 2.5, 14.5, g)
  for (let i = 0; i < 4; i++) cyl(0.1, 0.1, 2.4, M.brightSilver, 2.4 + i * 2.4, 1.2, 15.6, 6, g)

  // 围墙 + 门楼 + 门卫
  for (const sx of [-1, 1]) {
    box(0.45, 2.2, 30, M.brick, sx * 15.6, 1.1, 0, g)
    box(0.62, 0.2, 30.2, M.whiteStone, sx * 15.6, 2.28, 0, g)
  }
  box(31, 2.2, 0.45, M.brick, 0, 1.1, -15.6, g)
  box(31.2, 0.2, 0.62, M.whiteStone, 0, 2.28, -15.6, g)
  for (const sx of [-1, 1]) {
    box(13, 2.2, 0.45, M.brick, sx * 9.5, 1.1, 15.6, g)
    box(13.2, 0.2, 0.62, M.whiteStone, sx * 9.5, 2.28, 15.6, g)
  }
  box(5.2, 3.6, 2.4, M.brick, 0, 1.8, 15.6, g)
  hipRoof(g, 5.2, 2.4, 3.6, 1.6, M.tileRed, 0.6, 0, 15.6)
  box(2.2, 2.9, 0.16, M.teak, 0, 1.45, 16.85, g)
  box(3.2, 2.6, 2.8, M.plaster, -3.6, 1.3, 15.6, g)
  box(1.4, 1.1, 0.12, M.glSmoke, -3.6, 1.7, 17.02, g)
  box(3.5, 0.18, 3.1, M.aluDark, -3.6, 2.68, 15.6, g)
  for (let i = 0; i < 5; i++) {
    const tx = -13 + i * 6.5
    cyl(0.18, 0.24, 3.2, M.bark, tx, 1.6, 17.6, 8, g)
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), M.leaf)
    c.scale.set(1, 1.15, 1)
    c.castShadow = true
    add(c, tx, 4.2, 17.6, g)
  }
  return { g, top: H + 6 }
}

/** 58 独栋别墅（整座宅院，跨 2×2 地块） */
function t58(x, z) {
  const g = group(x, z, 0)
  const HX = -11            // 主楼中心 x
  const HZ = -18            // 主楼中心 z
  const WALL_Z = 42         // 院墙南边
  const GATE_X = 12

  // ---------- 院墙 + 大门 ----------
  const walls = [
    [-44, 3, 0.5, 78], [44, 3, 0.5, 78],            // 东西
    [0, 3 - 39, 88, 0.5],                           // 北
  ]
  for (const [wx, wz, ww, wd] of walls) {
    box(ww, 2.3, wd, M.tuff, wx, 1.15, wz, g)
    box(ww + 0.24, 0.22, wd + 0.24, M.whiteStone, wx, 2.4, wz, g)
    box(ww + 0.1, 0.3, wd + 0.1, M.tuff, wx, 0.15, wz, g)
  }
  // 南墙分两段留出大门
  for (const [cx, segW] of [[-18, 52], [30, 28]]) {
    box(segW, 2.3, 0.5, M.tuff, cx, 1.15, WALL_Z, g)
    box(segW + 0.2, 0.22, 0.74, M.whiteStone, cx, 2.4, WALL_Z, g)
    box(segW, 0.3, 0.66, M.tuff, cx, 0.15, WALL_Z, g)
  }
  // 门柱 + 门扇 + 门灯 + 信报箱
  for (const sx of [-1, 1]) {
    const px = GATE_X + sx * 3.2
    box(1.3, 3.6, 1.3, M.tuff, px, 1.8, WALL_Z, g)
    box(1.6, 0.3, 1.6, M.whiteStone, px, 3.75, WALL_Z, g)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), M.tuff)
    add(orb, px, 4.05, WALL_Z, g)
    // 门灯（在柱内侧）
    box(0.28, 0.42, 0.28, M.darkFrame, px - sx * 0.72, 2.6, WALL_Z + 0.6, g)
    box(0.22, 0.3, 0.22, M.glazeWhite, px - sx * 0.72, 2.56, WALL_Z + 0.6, g)
  }
  // 铁艺门：上下横梁 + 竖杆 + 涡卷
  for (const sx of [-1, 1]) {
    const cx = GATE_X + sx * 1.55
    box(3.0, 0.1, 0.1, M.darkFrame, cx, 3.0, WALL_Z, g)
    box(3.0, 0.1, 0.1, M.darkFrame, cx, 0.35, WALL_Z, g)
    box(3.0, 0.08, 0.08, M.darkFrame, cx, 2.4, WALL_Z, g)
    for (let i = 0; i < 7; i++) box(0.07, 2.7, 0.07, M.darkFrame, cx - 1.4 + i * 0.47, 1.65, WALL_Z, g)
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 4, 12), M.darkFrame)
      add(ring, cx - 0.9 + i * 0.9, 2.0, WALL_Z, g)
    }
    // 门柱灯罩顶部
    box(0.5, 0.12, 0.5, M.darkFrame, cx, 3.1, WALL_Z + 0.0, g)
  }
  box(0.5, 0.9, 0.5, M.tuff, GATE_X - 4.5, 0.45, WALL_Z + 0.9, g)
  box(0.34, 0.3, 0.24, M.darkFrame, GATE_X - 4.5, 1.05, WALL_Z + 0.9, g)

  // ---------- 车道 + 前庭铺装 ----------
  paved(g, GATE_X, 26, 5.6, 30, M.paving, 1.8, 'z')
  for (const sx of [-1, 1]) hedge(g, GATE_X + sx * 3.4, 26, 28, false, 0.85, 0.9)
  paved(g, -6, 22, 34, 26, M.paving, 2.6, 'x')
  // 步道（通向门廊）
  paved(g, HX, 8, 4.2, 12, M.whiteStone, 1.4, 'z')
  // 草坪 + 花池
  box(28, 0.14, 12, M.greenSoft, -26, 0.08, 32, g)
  for (let i = 0; i < 5; i++) bushAt(g, -38 + i * 5.4, 36, 0.6)
  box(14, 0.14, 8, M.greenSoft, 30, 0.08, 30, g)
  for (let i = 0; i < 3; i++) treeAt(g, 24 + i * 6, 32, 0.85)

  // 前庭喷泉
  cyl(3.2, 3.6, 0.5, M.whiteStone, -20, 0.25, 28, 24, g)
  cyl(2.9, 2.9, 0.1, M.glTeal, -20, 0.47, 28, 24, g)
  cyl(0.7, 0.9, 1.4, M.whiteStone, -20, 1.2, 28, 14, g)
  cyl(1.5, 1.3, 0.24, M.whiteStone, -20, 1.9, 28, 18, g)
  cyl(1.3, 1.3, 0.06, M.glTeal, -20, 2.0, 28, 18, g)
  cyl(0.16, 0.22, 0.9, M.whiteStone, -20, 2.45, 28, 10, g)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    box(0.5, 0.24, 0.5, M.whiteStone, -20 + Math.cos(a) * 3.4, 0.42, 28 + Math.sin(a) * 3.4, g)
  }

  // 路灯 + 长椅
  lampPost(g, GATE_X + 5.2, 36, 3.4, Math.PI)
  lampPost(g, GATE_X - 5.2, 12, 3.4, 0)
  lampPost(g, -2, 26, 3.4, -Math.PI / 2)
  benchAt(g, -13, 33, 0.1)
  benchAt(g, -28, 22, Math.PI / 2)

  // ---------- 主楼 ----------
  const hg = new THREE.Group()
  hg.position.set(HX, 0, HZ)
  g.add(hg)

  // 基座 + 主体
  box(27.4, 0.9, 15.4, M.tuff, 0, 0.45, 0, hg)
  box(27.6, 0.22, 15.6, M.whiteStone, 0, 0.95, 0, hg)
  box(26, 6.4, 14, M.siding, 0, 4.15, 0, hg)
  // 转角板 + 檐口
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.5, 6.4, 0.5, M.glazeWhite, sx * 12.8, 4.15, sz * 6.8, hg)
  }
  box(26.6, 0.36, 14.6, M.glazeWhite, 0, 7.4, 0, hg)
  box(27.0, 0.16, 15.0, M.whiteStone, 0, 7.65, 0, hg)
  // 坡屋顶 + 老虎窗 + 烟囱
  gableRoof(hg, 26, 14, 7.7, 3.6, M.slate, 0.95)
  for (const dx of [-7.5, 5.5]) {
    box(2.6, 1.9, 2.2, M.siding, dx, 9.3, 4.4, hg)
    gableRoof(hg, 2.6, 2.2, 10.2, 1.0, M.slate, 0.24, 0)
    hg.children[hg.children.length - 1].position.set(dx, 10.22, 4.4)
    win(hg, dx, 9.5, 5.53, 0, 1.1, 1.0, { glass: M.glWhite, frame: M.glazeWhite })
  }
  box(1.5, 4.2, 1.5, M.brick, 8.4, 9.2, -3.2, hg)
  box(1.8, 0.24, 1.8, M.whiteStone, 8.4, 11.4, -3.2, hg)
  box(0.7, 0.5, 0.7, M.charcoal, 8.4, 11.75, -3.2, hg)
  // 檐沟 + 雨水管
  for (const sz of [-1, 1]) box(26.4, 0.16, 0.28, M.aluPanel, 0, 7.42, sz * 7.32, hg)
  for (const sx of [-1, 1]) {
    downpipe(hg, sx * 12.9, 7.0, 7.4, M.glazeWhite)
    downpipe(hg, sx * 12.9, -7.0, 7.4, M.glazeWhite)
  }

  // 正立面：门廊 + 门 + 窗
  const pz = 7.0
  box(9.0, 0.3, 4.2, M.whiteStone, 0, 0.85, pz + 2.1, hg)      // 门廊平台
  for (let k = 0; k < 3; k++) box(9.6, 0.24, 0.6, M.tuff, 0, 0.6 - k * 0.24, pz + 4.2 + k * 0.6, hg)
  for (const sx of [-1, 1]) {
    cyl(0.36, 0.42, 3.0, M.glazeWhite, sx * 3.6, 2.5, pz + 3.5, 14, hg)
    cyl(0.5, 0.5, 0.2, M.glazeWhite, sx * 3.6, 1.05, pz + 3.5, 14, hg)
    cyl(0.46, 0.46, 0.22, M.glazeWhite, sx * 3.6, 3.95, pz + 3.5, 14, hg)
  }
  box(9.4, 0.4, 4.6, M.glazeWhite, 0, 4.2, pz + 2.2, hg)
  box(9.8, 0.18, 5.0, M.whiteStone, 0, 4.45, pz + 2.2, hg)
  // 双开门 + 侧窗 + 门楣
  box(3.0, 3.0, 0.24, M.teak, 0, 2.35, pz + 0.04, hg)
  box(1.3, 2.7, 0.14, M.glSmoke, -0.74, 2.35, pz + 0.16, hg)
  box(1.3, 2.7, 0.14, M.glSmoke, 0.74, 2.35, pz + 0.16, hg)
  box(0.08, 2.7, 0.18, M.charcoal, 0, 2.35, pz + 0.22, hg)
  for (const sx of [-1, 1]) {
    box(0.9, 2.9, 0.18, M.glSmoke, sx * 2.1, 2.3, pz + 0.06, hg)
    box(1.06, 0.14, 0.24, M.glazeWhite, sx * 2.1, 3.78, pz + 0.08, hg)
  }
  box(4.6, 0.34, 0.3, M.glazeWhite, 0, 3.95, pz + 0.08, hg)
  box(1.0, 0.5, 0.12, M.glazeWhite, 0, 3.2, pz + 0.14, hg)   // 门牌
  // 二层阳台 + 落地门
  box(8.4, 0.22, 2.6, M.whiteStone, 0, 4.5, pz + 1.3, hg)
  glassRail(hg, 8.2, 4.6, pz + 2.5, 8)
  // 阳台两端玻璃栏板
  for (const sx of [-1, 1]) {
    box(0.06, 0.96, 2.4, M.glWhite, sx * 4.15, 5.1, pz + 1.3, hg)
    box(0.14, 0.1, 2.5, M.brightSilver, sx * 4.15, 5.6, pz + 1.3, hg)
    for (const oz of [-1.0, 0, 1.0]) box(0.1, 1.0, 0.07, M.brightSilver, sx * 4.15, 5.1, pz + 1.3 + oz, hg)
  }
  win(hg, -1.6, 5.9, pz + 0.04, 0, 1.5, 2.5, { glass: M.glSmoke, frame: M.glazeWhite, mull: 1 })
  win(hg, 1.6, 5.9, pz + 0.04, 0, 1.5, 2.5, { glass: M.glSmoke, frame: M.glazeWhite, mull: 1 })
  // 凸窗（西侧）
  box(3.6, 3.4, 1.0, M.siding, -10.6, 2.2, pz + 0.5, hg)
  box(4.0, 0.24, 1.4, M.glazeWhite, -10.6, 3.98, pz + 0.5, hg)
  for (const ox of [-1.0, 1.0]) win(hg, -10.6 + ox, 2.3, pz + 1.03, 0, 1.2, 2.0, { glass: M.glSmoke, frame: M.glazeWhite, mull: 1 })
  win(hg, -10.6, 2.3, pz + 1.03, 0, 1.0, 2.0, { glass: M.glSmoke, frame: M.glazeWhite })
  // 东侧对窗 + 百叶
  win(hg, 9.8, 2.3, pz + 0.04, 0, 2.6, 2.1, { glass: M.glSmoke, frame: M.glazeWhite, mull: 2 })
  for (const sx of [-1, 1]) box(0.42, 2.1, 0.14, M.paintGreen, 9.8 + sx * 1.62, 2.3, pz + 0.1, hg)
  for (const wx of [-8.6, -3.4, 3.4, 8.6]) {
    win(hg, wx, 5.7, pz + 0.04, 0, 1.5, 1.7, { glass: M.glSmoke, frame: M.glazeWhite, mull: 1, transom: true })
    for (const sx of [-1, 1]) box(0.4, 1.7, 0.13, M.paintGreen, wx + sx * 0.95, 5.7, pz + 0.1, hg)
  }

  // 背立面：厨房门 + 窗 + 空调 + 露台
  const bz = -7.0
  box(2.2, 2.6, 0.2, M.teak, 3.2, 1.85, bz - 0.05, hg)
  box(0.9, 1.0, 0.12, M.glSmoke, 3.2, 3.5, bz - 0.12, hg)
  for (const wx of [-8.4, -3.0, 8.4]) {
    win(hg, wx, 2.4, bz - 0.05, Math.PI, 1.7, 1.6, { glass: M.glSmoke, frame: M.glazeWhite, mull: 1 })
    win(hg, wx, 5.7, bz - 0.05, Math.PI, 1.5, 1.6, { glass: M.glSmoke, frame: M.glazeWhite })
  }
  acUnit(hg, -11.0, 1.1, bz, Math.PI)
  acUnit(hg, 11.4, 1.1, bz, Math.PI)
  box(7.0, 0.24, 4.0, M.whiteStone, 0, 0.6, bz - 2.0, hg)
  awning(hg, 3.2, 3.9, bz - 0.3, 3.0, 1.8, M.teak, Math.PI)
  // 侧窗
  for (const sx of [-1, 1]) {
    const ry = sx > 0 ? Math.PI / 2 : -Math.PI / 2
    for (const wz of [-3.6, 1.2]) {
      win(hg, sx * 13.02, 2.4, wz, ry, 1.6, 1.6, { glass: M.glSmoke, frame: M.glazeWhite, mull: 1 })
      win(hg, sx * 13.02, 5.7, wz, ry, 1.6, 1.6, { glass: M.glSmoke, frame: M.glazeWhite })
    }
  }

  // ---------- 车库 + 连廊 ----------
  const gx = 23
  const gz = 2
  box(11, 4.4, 9, M.siding, gx, 2.2, gz, g)
  box(12.0, 0.4, 10.0, M.whiteStone, gx, 4.5, gz, g)
  box(11.4, 0.3, 9.4, M.glazeWhite, gx, 0.85, gz, g)
  // 车库门 + 分格
  box(5.0, 3.0, 0.24, M.glazeWhite, gx - 2.4, 1.75, gz + 4.56, g)
  for (let k = 0; k < 6; k++) box(4.8, 0.1, 0.1, M.aluPanel, gx - 2.4, 0.5 + k * 0.42, gz + 4.7, g)
  for (let k = 1; k < 3; k++) box(0.1, 3.0, 0.12, M.aluPanel, gx - 2.4 + (k - 1.5) * 1.7, 1.75, gz + 4.7, g)
  box(5.4, 0.3, 0.4, M.glazeWhite, gx - 2.4, 3.4, gz + 4.6, g)
  // 侧门 + 台阶 + 壁灯
  box(1.0, 2.2, 0.2, M.teak, gx + 3.1, 1.3, gz + 4.56, g)
  for (let k = 0; k < 2; k++) box(1.6, 0.18, 0.4 + k * 0.3, M.tuff, gx + 3.1, 0.09 + (1 - k) * 0.18, gz + 4.8 + k * 0.3, g)
  box(0.2, 0.3, 0.2, M.darkFrame, gx - 5.0, 2.9, gz + 4.6, g)
  // 车库二层储物窗 + 屋顶设备
  win(g, gx, 5.6, gz + 4.56, 0, 1.6, 1.0, { glass: M.glWhite, frame: M.glazeWhite })
  box(2.2, 1.0, 1.6, M.aluPanel, gx + 2.6, 5.0, gz - 2.0, g)
  // 连廊（廊架 + 铺装）
  paved(g, 13.5, -6.5, 18, 3.6, M.paving, 1.8, 'x')
  pergola(g, 13.5, -6.5, 17, 4.2, 3.0)

  // ---------- 后花园露台 + 餐区 ----------
  paved(g, -6, -13.5, 22, 9, M.paving, 2.2, 'x')
  pergola(g, -1, -13.0, 10, 7, 3.1)
  // 户外餐桌 + 椅
  box(3.2, 0.16, 1.5, M.teak, -1, 0.95, -13.0, g)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.12, 0.9, 0.12, M.teak, -1 + sx * 1.4, 0.45, -13.0 + sz * 0.6, g)
  }
  for (const [cx, cz, ry] of [[-4.2, -13.0, Math.PI / 2], [1.8, -13.0, -Math.PI / 2], [-1, -11.2, 0], [-1, -14.8, Math.PI]]) {
    const s = new THREE.Group()
    s.position.set(cx, 0, cz)
    s.rotation.y = ry
    g.add(s)
    box(0.5, 0.08, 0.5, M.teak, 0, 0.5, 0, s)
    box(0.5, 0.5, 0.08, M.teak, 0, 0.78, -0.24, s)
    for (const ox of [-0.2, 0.2]) for (const oz of [-0.2, 0.2]) box(0.06, 0.48, 0.06, M.teak, ox, 0.25, oz, s)
  }
  // 烧烤台 + 花池
  box(2.4, 1.0, 0.9, M.tuff, -11, 0.5, -13.4, g)
  box(2.6, 0.14, 1.1, M.whiteStone, -11, 1.06, -13.4, g)
  box(0.9, 0.5, 0.7, M.charcoal, -11, 1.35, -13.4, g)
  planter(g, 6.5, -12.6, 3.6, 1.4)
  planter(g, -15.5, -12.6, 3.6, 1.4)

  // ---------- 泳池区 ----------
  paved(g, -29, 10, 24, 20, M.paving, 2.4, 'x')
  poolAt(g, -31, 10, 15, 7.5)
  for (const [lx, lz, ry] of [[-38, 5.4, 0], [-35, 5.4, 0], [-32, 5.4, 0]]) lounger(g, lx, lz, ry)
  parasol(g, -40, 7.0, 1.7)
  parasol(g, -29, 5.2, 1.5, M.paintRed)
  // 泳池围栏 + 灯
  for (let i = 0; i < 3; i++) lampPost(g, -40 + i * 10, 17.5, 2.8, Math.PI)
  benchAt(g, -42, 14, Math.PI / 2)
  // 更衣小亭
  box(3.4, 2.6, 3.0, M.siding, -41, 1.3, 18.5, g)
  box(3.9, 0.32, 3.5, M.slate, -41, 2.75, 18.5, g)
  win(g, -41, 1.6, 20.0, 0, 1.2, 1.4, { glass: M.glWhite, frame: M.glazeWhite })
  box(0.9, 2.0, 0.18, M.teak, -40.0, 1.0, 20.02, g)

  // ---------- 后院菜园 / 工具房 ----------
  box(4.6, 3.0, 3.8, M.siding, -37, 1.5, -28, g)
  gableRoof(g, 4.6, 3.8, 3.0, 1.5, M.slate, 0.42, -37)
  g.children[g.children.length - 1].position.z = -28
  box(1.1, 2.1, 0.2, M.teak, -37, 1.05, -26.06, g)
  box(0.54, 0.5, 0.12, M.glWhite, -37, 2.0, -26.16, g)
  for (let i = 0; i < 4; i++) {
    box(4.0, 0.24, 1.6, M.bark, 22 + i * 0, 0.3, -20 + i * 3.2, g)
    for (let k = 0; k < 5; k++) bushAt(g, 20.6 + k * 0.9, -20 + i * 3.2, 0.28)
  }
  hedge(g, 8, -30, 32, true, 1.1, 1.0)
  for (let i = 0; i < 4; i++) treeAt(g, -20 + i * 9, -31, 0.9)
  acUnit(g, 30, 0.9, -8, Math.PI)

  // ---------- 花园翼楼（现代玻璃盒 + 平屋顶） ----------
  {
    const wx = 6
    const wz = -8
    box(16, 4.4, 10, M.siding, wx, 2.2, wz, g)
    box(16.4, 0.4, 10.4, M.whiteStone, wx, 4.5, wz, g)
    // 通高玻璃幕墙（朝庭院）
    box(15.0, 3.4, 0.24, M.glSmoke, wx, 2.0, wz + 5.1, g)
    for (let i = 0; i <= 6; i++) box(0.16, 3.4, 0.34, M.glazeWhite, wx - 7.5 + i * 2.5, 2.0, wz + 5.16, g)
    box(15.2, 0.18, 0.4, M.glazeWhite, wx, 3.7, wz + 5.2, g)
    box(4.2, 0.24, 2.2, M.whiteStone, wx, 0.55, wz + 6.4, g)
    // 屋顶木平台 + 花池
    box(14, 0.18, 8.4, M.teak, wx, 4.8, wz, g)
    for (let i = 0; i < 4; i++) planter(g, wx - 5 + i * 3.4, wz - 3.0, 2.6, 1.2, 4.9)
    for (const sx of [-1, 1]) box(0.14, 0.9, 8.4, M.glWhite, wx + sx * 7.0, 5.3, wz, g)
    // 室外木平台 + 躺椅
    box(18, 0.2, 7, M.teak, wx, 0.12, wz + 9.4, g)
    for (let i = 0; i < 3; i++) lounger(g, wx - 5 + i * 5, wz + 9.6, 0)
  }

  // ---------- 前庭花园：大草坪 + 花境 + 成年乔木 ----------
  {
    // 草坪（带滚边）
    box(44, 0.14, 20, M.greenSoft, -6, 0.09, -2, g)
    box(44.6, 0.22, 0.5, M.curb, -6, 0.14, 8.2, g)
    box(44.6, 0.22, 0.5, M.curb, -6, 0.14, -12.2, g)
    // 汀步石
    for (let i = 0; i < 9; i++) box(1.6, 0.12, 1.1, M.whiteStone, -20 + i * 4.4, 0.16, -2 + Math.sin(i * 1.7) * 2.2, g)
    // 花境：色块花丛
    const petals = [M.glRose, M.glAmber, M.glViolet, M.glazeWhite, M.paintRed, M.paintYell]
    for (let i = 0; i < 16; i++) {
      const fx = -42 + (i % 8) * 11.0
      const fz = i < 8 ? 7.4 : -12.6
      planter(g, fx, fz, 7.0, 2.2)
      for (let k = 0; k < 5; k++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.44, 8, 6), petals[(i + k) % petals.length])
        c.position.set(fx - 2.4 + k * 1.2, 0.8, fz + (k % 2 ? 0.4 : -0.4))
        c.scale.set(1, 0.85, 1)
        c.castShadow = true
        g.add(c)
      }
    }
    // 成年乔木（高 6~9m，成组布置）
    const trees = [
      [-40, 4, 1.5, 4.4], [-34, 1, 1.2, 4.0], [-28, 5, 1.35, 4.2],
      [-22, 0, 1.1, 3.8], [16, 4, 1.3, 4.2], [24, 10, 1.5, 4.6],
      [30, 2, 1.2, 4.0], [34, -4, 1.35, 4.2], [24, -8, 1.2, 3.8],
      [-24, -6, 1.3, 4.2], [-34, -8, 1.45, 4.6], [-42, -18, 1.2, 4.0],
      [40, 24, 1.4, 4.4], [-44, 26, 1.25, 4.0], [4, -30, 1.5, 4.8], [18, -30, 1.2, 4.0],
    ]
    for (const [tx, tz, s2, h2] of trees) treeAt(g, tx, tz, s2, h2)
    for (let i = 0; i < 10; i++) bushAt(g, -42 + i * 6.6, 24.0, 0.7)
    // 修剪绿篱围合草坪
    hedge(g, -6, 8.6, 44, true, 0.7, 0.9)
    hedge(g, -28.5, -2, 20, false, 0.7, 0.9)
    // 花园灯 + 长椅
    for (let i = 0; i < 4; i++) lampPost(g, -22 + i * 12, 22.4, 3.2, Math.PI)
    benchAt(g, -8, 14.5, Math.PI)
    benchAt(g, 8, 14.5, Math.PI)
    // 秋千 + 沙坑（后花园）
    for (const sx of [-1, 1]) cyl(0.12, 0.16, 3.0, M.teak, -14 + sx * 3.0, 1.5, -22, 8, g)
    box(6.6, 0.2, 0.2, M.teak, -14, 3.0, -22, g)
    for (let i = 0; i < 2; i++) {
      box(0.06, 1.6, 0.06, M.brightSilver, -16 + i * 4, 2.1, -22, g)
      box(1.4, 0.12, 0.6, M.teak, -16 + i * 4, 1.3, -22, g)
    }
    box(8, 0.3, 6, M.paintYell, -6, 0.12, -24, g)
  }

  // ---------- 车库屋顶露台 + 花园小径 ----------
  {
    box(11, 0.16, 9, M.paving, 23, 4.62, 2, g)
    for (const sx of [-1, 1]) box(0.14, 0.9, 9, M.glWhite, 23 + sx * 5.5, 5.1, 2, g)
    for (let i = 0; i < 3; i++) planter(g, 19 + i * 4, -11.0, 3.2, 1.2, 4.7)
    for (let i = 0; i < 3; i++) planter(g, 19 + i * 4, -5.5, 3.2, 1.2, 4.7)
    paved(g, 6, 18, 6, 22, M.paving, 2.0, 'z')
    for (let i = 0; i < 5; i++) lampPost(g, 2.0, 10 + i * 5.0, 2.6, -Math.PI / 2)
  }

  return { g, top: 18 }
}

/** 59 三进四合院（跨 2×2 地块） */
function t59(x, z) {
  const g = group(x, z, 0)
  const WX = 30
  const WZ = -38

  // ---------- 院墙 ----------
  courtWall(g, -34, 40, 20, 40, 3.1)
  courtWall(g, 28, 40, 34, 40, 3.1)
  courtWall(g, -34, -38, 34, -38, 3.1)
  courtWall(g, 34, 40, 34, -38, 3.1)
  courtWall(g, -34, 40, -34, -38, 3.1)

  // ---------- 宅门（东南角） ----------
  {
    const gx = 24
    const gz = 40
    box(9.0, 0.7, 7.0, M.tuff, gx, 0.35, gz - 2.5, g)
    box(9.6, 0.22, 7.6, M.whiteStone, gx, 0.76, gz - 2.5, g)
    box(7.4, 4.4, 0.5, M.plasterGrey, gx, 2.9, gz, g)
    box(6.6, 3.4, 0.3, M.teak, gx, 2.6, gz + 0.16, g)
    box(6.2, 3.0, 0.12, M.paintRed, gx, 2.6, gz + 0.3, g)
    box(0.1, 3.0, 0.16, M.gold, gx, 2.6, gz + 0.38, g)
    for (const sx of [-1, 1]) {
      cyl(0.26, 0.3, 4.6, M.paintRed, gx + sx * 3.4, 2.9, gz + 0.5, 10, g)
      // 门簪
      box(0.34, 0.34, 0.5, M.gold, gx + sx * 1.3, 4.3, gz + 0.32, g)
      box(0.34, 0.34, 0.5, M.gold, gx + sx * 2.2, 4.3, gz + 0.32, g)
    }
    hippedRoof(g, 8.6, 6.4, 5.4, 2.4, M.darkTile, 1.1, gx, gz, { bells: true })
    box(3.0, 0.5, 0.24, M.gold, gx, 4.55, gz + 0.34, g)   // 匾额
    // 台阶
    for (let k = 0; k < 3; k++) box(7.4, 0.24, 0.7, M.tuff, gx, 0.55 - k * 0.24, gz + 1.0 + k * 0.7, g)
    // 抱鼓石 / 石狮
    for (const sx of [-1, 1]) {
      box(1.0, 1.5, 1.0, M.whiteStone, gx + sx * 4.6, 0.75, gz + 0.9, g)
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.34, 14), M.whiteStone)
      drum.rotation.z = Math.PI / 2
      add(drum, gx + sx * 4.6, 1.75, gz + 0.9, g)
      box(0.9, 0.5, 1.2, M.whiteStone, gx + sx * 6.4, 0.25, gz + 2.4, g)
      const lion = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 8), M.whiteStone)
      lion.scale.set(1, 1.2, 1)
      add(lion, gx + sx * 6.4, 1.1, gz + 2.4, g)
    }
  }

  // ---------- 影壁 ----------
  {
    const px = 20
    const pz = 33
    box(7.0, 0.6, 1.8, M.tuff, px, 0.3, pz, g)
    box(6.4, 3.4, 1.0, M.plasterGrey, px, 2.2, pz, g)
    box(5.0, 2.4, 0.16, M.tuff, px, 2.3, pz + 0.54, g)
    for (const [ox, oy] of [[0, 0], [-1.4, 1.0], [1.4, 1.0], [-1.4, -1.0], [1.4, -1.0]]) {
      box(0.8, 0.8, 0.1, M.darkTile, px + ox, 2.3 + oy, pz + 0.62, g)
    }
    hipRoof(g, 7.6, 2.0, 3.9, 1.1, M.darkTile, 0.6, px, pz)
  }

  // ---------- 倒座房（南，面向北） ----------
  tradHall(g, -8, 33, {
    w: 24, d: 7, wallH: 3.4, roofH: 2.6, doors: 6, ry: Math.PI, over: 1.2,
  })

  // ---------- 垂花门（前后院之间） ----------
  {
    const px = -2
    const pz = 25
    box(7.2, 0.5, 4.4, M.tuff, px, 0.25, pz, g)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        cyl(0.22, 0.26, 3.4, M.paintRed, px + sx * 2.6, 1.7, pz + sz * 1.4, 10, g)
      }
    }
    box(6.4, 2.8, 0.26, M.paintRed, px, 1.9, pz, g)
    box(2.4, 2.6, 0.16, M.teak, px, 1.8, pz + 0.2, g)
    box(0.08, 2.6, 0.2, M.gold, px, 1.8, pz + 0.3, g)
    // 垂莲柱
    for (const sx of [-1, 1]) {
      cyl(0.2, 0.3, 0.9, M.gold, px + sx * 2.6, 3.0, pz + 1.8, 10, g)
      box(0.5, 0.4, 0.5, M.gold, px + sx * 2.6, 2.5, pz + 1.8, g)
    }
    hipRoof(g, 7.0, 4.6, 3.4, 1.9, M.darkTile, 0.9, px, pz)
    for (let k = 0; k < 2; k++) box(6.0, 0.2, 0.5, M.tuff, px, 0.4 - k * 0.2, pz + 2.4 + k * 0.5, g)
  }

  // ---------- 正房 + 耳房 ----------
  tradHall(g, -2, -14, { w: 22, d: 8, wallH: 3.9, roofH: 3.3, doors: 5, over: 1.5 })
  for (const sx of [-1, 1]) {
    tradHall(g, -2 + sx * 13.4, -15, { w: 4.4, d: 7, wallH: 3.2, roofH: 2.2, doors: 1, over: 0.9, cols: false })
  }

  // ---------- 东西厢房 ----------
  tradHall(g, 17, 1, { w: 15, d: 6.8, wallH: 3.4, roofH: 2.7, doors: 4, ry: Math.PI / 2, over: 1.15 })
  tradHall(g, -21, 1, { w: 15, d: 6.8, wallH: 3.4, roofH: 2.7, doors: 4, ry: -Math.PI / 2, over: 1.15 })

  // ---------- 后罩房 ----------
  tradHall(g, -2, -32, { w: 26, d: 6.4, wallH: 3.2, roofH: 2.4, doors: 7, over: 1.1 })

  // ---------- 抄手游廊 ----------
  corridor(g, 11.0, 7, 26, Math.PI / 2)
  corridor(g, -15.0, 7, 26, Math.PI / 2)
  corridor(g, -2, -8.2, 24, 0)

  // ---------- 院面铺装 + 甬路 ----------
  paved(g, -2, 12, 46, 50, M.paving, 3.0, 'x')
  paved(g, -2, 28.5, 9, 12, M.whiteStone, 1.5, 'z')
  paved(g, -2, 3, 6, 40, M.whiteStone, 1.5, 'z')
  paved(g, -2, 6, 30, 5, M.whiteStone, 1.5, 'x')
  // 后院
  paved(g, -2, -26, 34, 10, M.paving, 2.6, 'x')

  // ---------- 庭院陈设 ----------
  // 石桌石凳
  cyl(1.3, 1.3, 0.18, M.whiteStone, -2, 0.95, 10, 16, g)
  cyl(0.4, 0.5, 0.85, M.whiteStone, -2, 0.45, 10, 12, g)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    cyl(0.36, 0.4, 0.42, M.whiteStone, -2 + Math.cos(a) * 2.0, 0.21, 10 + Math.sin(a) * 2.0, 12, g)
  }
  // 荷花缸
  cyl(1.0, 0.85, 0.9, M.copperAged, 6.5, 0.45, 16, 16, g)
  cyl(0.92, 0.92, 0.06, M.glTeal, 6.5, 0.86, 16, 16, g)
  // 石灯一对
  for (const sx of [-1, 1]) {
    box(0.9, 0.3, 0.9, M.tuff, -2 + sx * 8.2, 0.15, -6, g)
    cyl(0.22, 0.28, 1.2, M.tuff, -2 + sx * 8.2, 0.9, -6, 8, g)
    box(0.8, 0.8, 0.8, M.tuff, -2 + sx * 8.2, 1.9, -6, g)
    hipRoof(g, 1.1, 1.1, 2.3, 0.55, M.tuff, 0.2, -2 + sx * 8.2, -6)
  }
  // 老树
  treeAt(g, -12, 20, 1.5, 3.6)
  treeAt(g, 8, 22, 1.2, 3.0)
  treeAt(g, 24, -12, 1.1, 2.8)
  // 花池
  for (const sx of [-1, 1]) planter(g, -2 + sx * 6.6, 30, 3.0, 1.4)
  // 后院石井 + 树
  cyl(0.9, 0.9, 0.8, M.tuff, 12, 0.4, -26, 14, g)
  cyl(0.84, 0.84, 0.06, M.charcoal, 12, 0.82, -26, 14, g)
  for (const sx of [-1, 1]) box(0.14, 1.6, 0.14, M.teak, 12 + sx * 0.9, 0.8, -26, g)
  box(2.1, 0.12, 0.16, M.teak, 12, 1.6, -26, g)
  treeAt(g, -18, -28, 1.2, 3.0)
  return { g, top: 15 }
}

/** 60 圆形体育场（跨 2×2 地块） */
function t60(x, z) {
  const g = group(x, z, 0)

  // 碗体与场地放进椭圆缩放组（真实体育场都不是正圆）
  const bg = new THREE.Group()
  bg.scale.set(1.1, 1, 0.88)
  g.add(bg)

  // 看台剖面：内墙 → 走道 → 26 级踏步 → 外背墙
  const prof = [
    new THREE.Vector2(28.4, 0),
    new THREE.Vector2(29.0, 2.6),
    new THREE.Vector2(30.6, 2.6),
  ]
  let rr = 30.6
  let yy = 2.6
  for (let i = 0; i < 26; i++) {
    prof.push(new THREE.Vector2(rr, yy + 0.42))
    prof.push(new THREE.Vector2(rr + 0.55, yy + 0.42))
    rr += 0.55
    yy += 0.42
  }
  prof.push(new THREE.Vector2(rr, yy + 2.4))
  prof.push(new THREE.Vector2(rr + 0.9, yy + 2.4))
  prof.push(new THREE.Vector2(rr + 0.9, 0))

  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), M.sheet)
  bowl.castShadow = bowl.receiveShadow = true
  bg.add(bowl)

  // 草坪 + 跑道 + 分道线
  const field = new THREE.Mesh(new THREE.CircleGeometry(27.6, 56), M.greenSoft)
  field.rotation.x = -Math.PI / 2
  add(field, 0, 0.12, 0, bg)
  const track = new THREE.Mesh(new THREE.RingGeometry(27.6, 30.6, 64), M.paintRed)
  track.rotation.x = -Math.PI / 2
  add(track, 0, 0.13, 0, bg)
  for (let i = 1; i <= 7; i++) {
    const lane = new THREE.Mesh(new THREE.RingGeometry(27.6 + i * 0.42, 27.6 + i * 0.42 + 0.09, 64), M.glazeWhite)
    lane.rotation.x = -Math.PI / 2
    add(lane, 0, 0.15, 0, bg)
  }
  // 足球门 + 中线
  for (const sx of [-1, 1]) {
    const gx = sx * 24
    for (const sz of [-1, 1]) box(0.16, 2.5, 0.16, M.glazeWhite, gx, 1.25, sz * 3.7, bg)
    box(0.16, 0.16, 7.6, M.glazeWhite, gx, 2.5, 0, bg)
    box(3.4, 0.1, 7.8, M.paintBlue, gx + sx * 1.2, 0.16, 0, bg)
  }
  box(0.14, 0.06, 52, M.roadPaint, 0, 0.16, 0, bg)

  // 看台分区环线 + 竖向通道
  for (const ty of [4.8, 8.2, 11.6]) {
    const rad = 30.6 + (ty - 2.6) / 0.42 * 0.55
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.12, 5, 72), M.glazeWhite)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, ty, 0, bg)
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const stair = new THREE.Mesh(new THREE.BoxGeometry(1.5, 11.4, 0.2), M.concreteDark)
    stair.position.set(Math.cos(a) * 38.6, 7.7, Math.sin(a) * 38.6)
    stair.rotation.y = -a
    stair.rotation.x = 0.16
    bg.add(stair)
  }

  // 外立面：竖向分格 + 两道环梁
  const cols = 36
  for (let i = 0; i < cols; i++) {
    const a = (i / cols) * Math.PI * 2
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 16.2, 0.9), M.concrete)
    c.position.set(Math.cos(a) * 46.2, 8.1, Math.sin(a) * 46.2)
    c.rotation.y = -a
    c.castShadow = c.receiveShadow = true
    bg.add(c)
  }
  for (const by of [3.2, 9.4]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(46.6, 0.34, 8, 72), M.whiteStone)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, by, 0, bg)
  }
  // 入口门洞（4 个方向）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const gate = new THREE.Mesh(new THREE.BoxGeometry(9, 5.4, 1.2), M.charcoal)
    gate.position.set(Math.cos(a) * 46.4, 2.7, Math.sin(a) * 46.4)
    gate.rotation.y = -a
    bg.add(gate)
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 5.2), M.membrane)
    canopy.position.set(Math.cos(a) * 48.4, 6.2, Math.sin(a) * 48.4)
    canopy.rotation.y = -a
    canopy.castShadow = true
    bg.add(canopy)
    for (const s of [-1, 1]) {
      const px = Math.cos(a) * 50.2 - Math.sin(a) * s * 4.4
      const pz = Math.sin(a) * 50.2 + Math.cos(a) * s * 4.4
      cyl(0.22, 0.22, 6.0, M.brightSilver, px, 3.0, pz, 8, bg)
    }
  }

  // 环形雨篷：内外环梁 + 径向梁 + 支撑柱
  const ringRoof = new THREE.Mesh(new THREE.RingGeometry(29, 45.8, 72), M.membrane)
  ringRoof.rotation.x = -Math.PI / 2
  ringRoof.castShadow = ringRoof.receiveShadow = true
  add(ringRoof, 0, 18.4, 0, bg)
  for (const [rad, tube] of [[45.8, 0.42], [29, 0.3]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 72), M.brightSilver)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, 18.4, 0, bg)
  }
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2
    const beam = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.22, 0.3), M.brightSilver)
    beam.position.set(Math.cos(a) * 37.4, 18.42, Math.sin(a) * 37.4)
    beam.rotation.y = -a
    bg.add(beam)
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    cyl(0.2, 0.26, 3.6, M.brightSilver, Math.cos(a) * 45.4, 16.6, Math.sin(a) * 45.4, 8, bg)
  }

  // 记分屏（面向场地）
  const screen = new THREE.Mesh(new THREE.BoxGeometry(15, 5.4, 0.7), M.charcoal)
  screen.position.set(0, 12.5, -42.6)
  screen.rotation.y = Math.PI
  bg.add(screen)
  box(13.6, 4.2, 0.2, M.glDeepBlue, 0, 12.5, -42.22, bg)

  // 四座灯塔（不在缩放组内）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const px = Math.cos(a) * 45.0
    const pz = Math.sin(a) * 36.0
    cyl(0.44, 0.72, 42, M.concreteDark, px, 21, pz, 10, g)
    for (const oy of [26, 33]) cyl(1.1, 1.1, 0.22, M.brightSilver, px, oy, pz, 10, g)
    const head = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.2, 0.6), M.darkFrame)
    head.position.set(px, 43.2, pz)
    head.rotation.y = -a + Math.PI / 2
    head.castShadow = true
    g.add(head)
    for (let k = 0; k < 4; k++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.18), M.glazeWhite)
      lamp.position.set(px + Math.cos(a + Math.PI / 2) * (-2.0 + k * 1.35), 43.2, pz + Math.sin(a + Math.PI / 2) * (-2.0 + k * 1.35))
      lamp.rotation.y = -a + Math.PI / 2
      g.add(lamp)
    }
  }

  // 场外广场 + 旗杆 + 停车
  const plaza = new THREE.Mesh(new THREE.RingGeometry(47.4, 51.2, 72), M.paving)
  plaza.rotation.x = -Math.PI / 2
  plaza.scale.set(1.1, 1, 0.88)
  add(plaza, 0, 0.1, 0, g)
  for (let i = 0; i < 6; i++) cyl(0.1, 0.14, 14, M.brightSilver, -30 + i * 12, 7, 40, 8, g)
  for (let i = 0; i < 8; i++) {
    const tx = -40 + i * 11
    cyl(0.2, 0.28, 3.4, M.bark, tx, 1.7, -40, 8, g)
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), M.leaf)
    c.scale.set(1, 1.1, 1)
    c.castShadow = true
    add(c, tx, 4.4, -40, g)
  }
  return { g, top: 48 }
}

/** 61 综合性体育馆（跨 2×2 地块） */
function t61(x, z) {
  const g = group(x, z, 0)
  const w = 44
  const d = 34
  const H = 14

  // 台基 + 主体
  box(w + 3.0, 1.2, d + 3.0, M.concrete, 0, 0.6, 0, g)
  box(w + 3.6, 0.26, d + 3.6, M.whiteStone, 0, 1.3, 0, g)
  box(w, H, d, M.concrete, 0, 1.2 + H / 2, 0, g)
  // 外露钢柱 + 环梁
  for (let i = 0; i < 11; i++) {
    const px = -w / 2 + (w / 10) * i
    for (const sz of [-1, 1]) box(0.62, H + 1.4, 0.62, M.aluDark, px, 1.2 + (H + 1.4) / 2, sz * (d / 2 + 0.28), g)
  }
  for (let i = 0; i < 9; i++) {
    const pz = -d / 2 + (d / 8) * i
    for (const sx of [-1, 1]) box(0.62, H + 1.4, 0.62, M.aluDark, sx * (w / 2 + 0.28), 1.2 + (H + 1.4) / 2, pz, g)
  }
  for (const [oy, t] of [[1.37, 0.5], [6.0, 0.34], [12.4, 0.5]]) {
    box(w + 0.8, t, 0.4, M.aluDark, 0, oy, d / 2 + 0.28, g)
    box(w + 0.8, t, 0.4, M.aluDark, 0, oy, -d / 2 - 0.28, g)
    box(0.4, t, d + 0.8, M.aluDark, w / 2 + 0.28, oy, 0, g)
    box(0.4, t, d + 0.8, M.aluDark, -w / 2 - 0.28, oy, 0, g)
  }
  // 立面：下部混凝土 + 上部条窗 + 百叶
  for (const sz of [-1, 1]) {
    box(w - 1, 4.2, 0.3, M.concrete, 0, 3.3, sz * (d / 2 + 0.16), g)
    box(w - 2.2, 4.6, 0.18, M.glSmoke, 0, 9.2, sz * (d / 2 + 0.18), g)
    for (let i = 0; i < 20; i++) box(0.12, 4.6, 0.26, M.aluDark, -w / 2 + 1.4 + i * ((w - 2.8) / 19), 9.2, sz * (d / 2 + 0.24), g)
    for (let i = 0; i < 14; i++) box(2.0, 1.1, 0.4, M.aluPanel, -w / 2 + 2.6 + i * 2.9, 11.8, sz * (d / 2 + 0.3), g)
  }
  for (const sx of [-1, 1]) {
    box(0.3, 4.2, d - 1, M.concrete, sx * (w / 2 + 0.16), 3.3, 0, g)
    box(0.18, 4.6, d - 2.2, M.glSmoke, sx * (w / 2 + 0.18), 9.2, 0, g)
    for (let i = 0; i < 15; i++) box(0.26, 4.6, 0.12, M.aluDark, sx * (w / 2 + 0.24), 9.2, -d / 2 + 1.4 + i * ((d - 2.8) / 14), g)
  }

  // 筒拱屋面 + 拱肋 + 两道采光带 + 马道
  barrelRoof(g, w + 2.2, d / 2 + 1.2, H + 1.2, M.membrane, 0)
  vaultRibs(g, w + 2.2, d / 2 + 1.26, H + 1.2, M.brightSilver, 12, 0)
  for (const sz of [-1, 1]) {
    box(w - 2, 0.14, 0.6, M.glWhite, 0, H + 1.2 + d / 2 + 1.0, sz * 6.5, g)
  }
  for (let i = 0; i < 5; i++) {
    box(0.9, 0.9, 26, M.brightSilver, -w / 2 + 4 + i * 9, H + 1.2 + d / 2 - 1.4, 0, g)
  }
  // 屋面设备
  for (const [px, pz] of [[-14, 15], [0, 15], [14, 15], [-14, -15], [14, -15]]) {
    box(3.2, 1.6, 2.2, M.aluPanel, px, H + 1.9, pz, g)
  }

  // 场地：木地板 + 篮球场 + 排球/羽毛球线
  box(36, 0.16, 22, M.teak, 0, 1.36, 0, g)
  box(34, 0.04, 20, M.paintYell, 0, 1.46, 0, g)
  box(28, 0.06, 15, M.teak, 0, 1.5, 0, g)
  for (const sz of [-1, 1]) box(28, 0.05, 0.16, M.roadPaint, 0, 1.54, sz * 7.5, g)
  box(0.16, 0.05, 15, M.glazeWhite, 0, 1.54, 0, g)
  const c1 = new THREE.Mesh(new THREE.RingGeometry(1.8, 1.9, 32), M.glazeWhite)
  c1.rotation.x = -Math.PI / 2
  add(c1, 0, 1.54, 0, g)
  for (const sx of [-1, 1]) {
    cyl(0.16, 0.22, 3.6, M.brightSilver, sx * 13.2, 3.3, 0, 8, g)
    box(1.8, 0.1, 1.1, M.glazeWhite, sx * 12.2, 4.9, 0, g)
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 5, 16), M.paintRed)
    hoop.rotation.x = Math.PI / 2
    add(hoop, sx * 11.6, 4.55, 0, g)
    box(0.08, 0.9, 0.9, M.glazeWhite, sx * 13.2, 4.7, 0, g)
  }
  // 两侧看台（8 排）+ 座椅色带 + 栏杆
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      box(34, 0.62, 1.15, M.concrete, 0, 1.5 + i * 0.62, sz * (12.6 + i * 1.15), g)
      box(33.2, 0.1, 0.82, i % 2 ? M.paintBlue : M.paintRed, 0, 1.86 + i * 0.62, sz * (12.6 + i * 1.15), g)
    }
    railing(g, 34, 1.5 + 8 * 0.62, sz * 21.4, M.brightSilver, 20, 1.0)
  }
  // 端部看台
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      box(1.15, 0.62, 20, M.concrete, sx * (19 + i * 1.15), 1.5 + i * 0.62, 0, g)
    }
  }

  // 入口门厅 + 雨篷 + 大台阶 + 售票窗
  const ez = d / 2 + 1.6
  box(22, 7.4, 6.0, M.glWhite, 0, 3.7 + 1.2, ez + 2.4, g)
  box(23.6, 0.7, 7.4, M.brightSilver, 0, 11.6, ez + 2.4, g)
  for (let i = 0; i < 8; i++) box(0.22, 7.4, 0.22, M.aluDark, -10 + i * 2.9, 4.9, ez + 5.2, g)
  box(18, 0.5, 7.0, M.membrane, 0, 9.0, ez + 8.0, g)
  for (const sx of [-1, 1]) cyl(0.26, 0.26, 8.6, M.brightSilver, sx * 8.6, 4.3, ez + 10.8, 8, g)
  steps(g, 24, 5, 0.24, 1.1, 1.2, M.whiteStone, ez + 11.4)
  for (const sx of [-1, 1]) {
    box(4.0, 2.6, 0.3, M.glSmoke, sx * 7.6, 2.5, ez + 5.3, g)
    box(4.2, 0.3, 0.4, M.aluDark, sx * 7.6, 3.9, ez + 5.3, g)
  }
  // 旗杆 + 广场 + 停车
  for (let i = 0; i < 3; i++) cyl(0.09, 0.13, 15, M.brightSilver, -18 + i * 3.0, 7.5, ez + 8, 8, g)
  for (let i = 0; i < 6; i++) box(0.12, 0.05, 5.4, M.roadPaint, -22 + i * 5.6, 0.13, ez + 16, g)
  for (let i = 0; i < 4; i++) carAt(g, -22 + i * 5.6, ez + 16, Math.PI / 2, [M.paintBlue, M.glazeWhite, M.charcoal, M.paintRed][i])
  for (let i = 0; i < 4; i++) treeAt(g, -26 + i * 15, ez + 22, 1.0)
  for (const sx of [-1, 1]) lampPost(g, sx * 26, ez + 13, 6.0, Math.PI)
  return { g, top: H + 24 }
}

/** 62 大型演唱会场馆（完整椭圆碗 · 约 6 万席 · 跨 5×5）
 *  碗体剖面直接放大自 t60，保证闭合；舞台只占内场一端，不再切开/盖住看台。 */
function t62(x, z) {
  const g = group(x, z, 0)
  const bg = new THREE.Group()
  bg.scale.set(1.1, 1, 0.9)
  g.add(bg)

  // ---------- 看台碗：t60 同款剖面 ×2.05（收进 5×5 地块） ----------
  const S = 2.05
  const prof = [
    new THREE.Vector2(28.4 * S, 0),
    new THREE.Vector2(29.0 * S, 2.6 * S),
    new THREE.Vector2(30.6 * S, 2.6 * S),
  ]
  let rr = 30.6 * S
  let yy = 2.6 * S
  for (let i = 0; i < 32; i++) {
    prof.push(new THREE.Vector2(rr, yy + 0.42 * S))
    prof.push(new THREE.Vector2(rr + 0.7 * S, yy + 0.42 * S))
    rr += 0.7 * S
    yy += 0.42 * S
  }
  prof.push(new THREE.Vector2(rr, yy + 3.2 * S))
  prof.push(new THREE.Vector2(rr + 1.2 * S, yy + 3.2 * S))
  prof.push(new THREE.Vector2(rr + 1.2 * S, 0))

  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), M.sheet)
  bowl.castShadow = bowl.receiveShadow = true
  bg.add(bowl)
  const Rout = rr + 1.2 * S

  // 内场
  const Rin = 28.4 * S
  const field = new THREE.Mesh(new THREE.CircleGeometry(Rin - 0.4, 72), M.concrete)
  field.rotation.x = -Math.PI / 2
  add(field, 0, 0.12, 0, bg)
  for (let i = 1; i <= 4; i++) {
    const lane = new THREE.Mesh(new THREE.RingGeometry(Rin * 0.35 + i * 5.5, Rin * 0.35 + i * 5.5 + 0.14, 72), M.roadPaint)
    lane.rotation.x = -Math.PI / 2
    add(lane, 0, 0.15, 0, bg)
  }

  // 走道环 + 放射通道
  for (const ty of [6, 12, 18, 24]) {
    const rad = 30.6 * S + ((ty - 2.6 * S) / (0.42 * S)) * (0.7 * S)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.16, 6, 96), M.glazeWhite)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, ty, 0, bg)
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const stair = new THREE.Mesh(new THREE.BoxGeometry(2.0, 22, 0.28), M.concreteDark)
    stair.position.set(Math.cos(a) * (Rout * 0.72), 14, Math.sin(a) * (Rout * 0.72))
    stair.rotation.y = -a
    stair.rotation.x = 0.18
    bg.add(stair)
  }

  // ---------- 端舞台：只在内场 +z，高度压低，绝不盖看台 ----------
  const sz = Rin - 14
  box(36, 2.2, 12, M.charcoal, 0, 1.1, sz, bg)
  box(38, 0.35, 13, M.brightSilver, 0, 2.35, sz, bg)
  box(28, 14, 1.2, M.charcoal, 0, 9.5, sz + 5.2, bg)
  box(26.5, 12.5, 0.25, M.glDeepBlue, 0, 9.5, sz + 4.5, bg)
  for (const sx of [-1, 1]) {
    box(8, 8, 0.7, M.charcoal, sx * 20, 7, sz + 1, bg)
    box(7.2, 7.2, 0.2, M.glDeepBlue, sx * 20, 7, sz + 0.5, bg)
    box(3.4, 12, 3.4, M.charcoal, sx * 18, 6, sz - 6, bg)
    for (let k = 0; k < 5; k++) box(3.0, 1.6, 0.3, M.glazeWhite, sx * 18, 2.0 + k * 2.2, sz - 7.8, bg)
  }
  box(40, 0.4, 0.4, M.brightSilver, 0, 18, sz - 1, bg)
  box(40, 0.4, 0.4, M.brightSilver, 0, 18, sz + 3, bg)
  for (let i = 0; i < 9; i++) box(0.3, 0.3, 4.2, M.brightSilver, -16 + i * 4.0, 18, sz + 1, bg)
  for (let i = 0; i < 10; i++) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.45), M.glazeWhite)
    add(lamp, -18 + i * 4.0, 17.4, sz + ((i % 2) ? 2.5 : -0.5), bg)
  }
  box(10, 1.2, 10, M.charcoal, 0, 0.6, sz - 12, bg)

  // ---------- 外立面：连续外墙皮 + 柱廊（避免门洞看起来像缺了一块） ----------
  cyl(Rout + 2.2, Rout + 2.2, 26, M.concrete, 0, 13, 0, 72, bg, true)
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 26, 1.2), M.concrete)
    c.position.set(Math.cos(a) * (Rout + 2.7), 13, Math.sin(a) * (Rout + 2.7))
    c.rotation.y = -a
    c.castShadow = c.receiveShadow = true
    bg.add(c)
  }
  for (const by of [4, 12, 22]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Rout + 2.9, 0.4, 8, 96), M.whiteStone)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, by, 0, bg)
  }
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2
    const shop = new THREE.Mesh(new THREE.BoxGeometry(6.5, 5.0, 3.8), M.glSmoke)
    shop.position.set(Math.cos(a) * (Rout + 6.5), 2.5, Math.sin(a) * (Rout + 6.5))
    shop.rotation.y = -a
    bg.add(shop)
    const lid = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.3, 4.0), M.brightSilver)
    lid.position.set(Math.cos(a) * (Rout + 6.5), 5.15, Math.sin(a) * (Rout + 6.5))
    lid.rotation.y = -a
    bg.add(lid)
  }

  // ---------- 环形雨篷（同 t60：盖看台、中心开空） ----------
  const roofY = yy + 3.2 * S + 1.2
  const ringRoof = new THREE.Mesh(new THREE.RingGeometry(Rin + 2, Rout + 1.5, 96), M.membrane)
  ringRoof.rotation.x = -Math.PI / 2
  ringRoof.castShadow = ringRoof.receiveShadow = true
  add(ringRoof, 0, roofY, 0, bg)
  for (const [rad, tube] of [[Rout + 1.5, 0.45], [Rin + 2, 0.3]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 96), M.brightSilver)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, roofY, 0, bg)
  }
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    const beam = new THREE.Mesh(new THREE.BoxGeometry(Rout - Rin - 0.5, 0.26, 0.36), M.brightSilver)
    beam.position.set(Math.cos(a) * ((Rin + Rout) / 2 + 1), roofY + 0.05, Math.sin(a) * ((Rin + Rout) / 2 + 1))
    beam.rotation.y = -a
    bg.add(beam)
    cyl(0.24, 0.3, 4.5, M.brightSilver, Math.cos(a) * (Rout + 0.8), roofY - 2.4, Math.sin(a) * (Rout + 0.8), 8, bg)
  }

  // ---------- 灯光塔 ----------
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const px = Math.cos(a) * (Rout + 8)
    const pz = Math.sin(a) * (Rout + 8)
    cyl(0.6, 0.85, 48, M.concreteDark, px, 24, pz, 10, bg)
    for (const oy of [28, 40]) cyl(1.4, 1.4, 0.28, M.brightSilver, px, oy, pz, 10, bg)
    const head = new THREE.Mesh(new THREE.BoxGeometry(7, 2.6, 0.8), M.darkFrame)
    head.position.set(px, 49, pz)
    head.rotation.y = -a + Math.PI / 2
    bg.add(head)
    for (let k = 0; k < 5; k++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.35), M.glazeWhite)
      lamp.position.set(px + Math.cos(a + Math.PI / 2) * (-2.6 + k * 1.3), 49, pz + Math.sin(a + Math.PI / 2) * (-2.6 + k * 1.3))
      lamp.rotation.y = -a + Math.PI / 2
      bg.add(lamp)
    }
  }

  // ---------- 入口 ----------
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    // 玻璃门洞嵌在连续外墙上，不再挖空
    const gate = new THREE.Mesh(new THREE.BoxGeometry(12, 7.5, 0.6), M.glSmoke)
    gate.position.set(Math.cos(a) * (Rout + 2.5), 3.8, Math.sin(a) * (Rout + 2.5))
    gate.rotation.y = -a
    bg.add(gate)
    for (let k = 0; k < 5; k++) {
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7.5, 0.7), M.aluDark)
      mull.position.set(
        Math.cos(a) * (Rout + 2.55) - Math.sin(a) * (-4.5 + k * 2.25),
        3.8,
        Math.sin(a) * (Rout + 2.55) + Math.cos(a) * (-4.5 + k * 2.25),
      )
      mull.rotation.y = -a
      bg.add(mull)
    }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(14, 0.45, 7), M.membrane)
    cap.position.set(Math.cos(a) * (Rout + 6), 8.0, Math.sin(a) * (Rout + 6))
    cap.rotation.y = -a
    bg.add(cap)
    for (const s of [-1, 1]) {
      cyl(0.22, 0.22, 8.0, M.brightSilver,
        Math.cos(a) * (Rout + 7) - Math.sin(a) * s * 5.5,
        4.0,
        Math.sin(a) * (Rout + 7) + Math.cos(a) * s * 5.5, 8, bg)
    }
  }
  // 主门厅（-z）
  box(34, 9, 12, M.glWhite, 0, 4.5, -(Rout + 10), bg)
  box(36, 0.55, 14, M.brightSilver, 0, 9.3, -(Rout + 10), bg)
  box(38, 0.45, 8, M.membrane, 0, 10.8, -(Rout + 15), bg)
  for (const sx of [-1, 1]) cyl(0.35, 0.35, 10.5, M.brightSilver, sx * 15, 5.2, -(Rout + 17), 8, bg)
  for (let k = 0; k < 5; k++) box(36, 0.28, 1.0 + k * 0.5, M.whiteStone, 0, 0.14 + (4 - k) * 0.28, -(Rout + 15 + k * 0.55), bg)
  for (const sx of [-1, 1]) {
    box(22, 11, 0.7, M.charcoal, sx * 48, 6.5, -(Rout + 1), bg)
    box(20, 9.5, 0.25, sx > 0 ? M.glDeepBlue : M.paintRed, sx * 48, 6.5, -(Rout + 1.5), bg)
  }

  // ---------- 外圈广场（收进地块，不压邻居） ----------
  const plaza = new THREE.Mesh(new THREE.RingGeometry(Rout + 5, Rout + 12, 96), M.paving)
  plaza.rotation.x = -Math.PI / 2
  add(plaza, 0, 0.08, 0, bg)
  for (let i = 0; i < 6; i++) carAt(bg, -40 + i * 10, Rout + 14, Math.PI / 2, [M.charcoal, M.glazeWhite, M.paintRed, M.paintBlue, M.aluPanel, M.paintGreen][i])
  for (let i = 0; i < 4; i++) box(8, 3.2, 3.0, [M.corrRed, M.corrBlue, M.corrGreen, M.corrRust][i], -24 + i * 14, 1.6, Rout + 12, bg)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    lampPost(bg, Math.cos(a) * (Rout + 14), Math.sin(a) * (Rout + 14), 9, 0)
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.15
    treeAt(bg, Math.cos(a) * (Rout + 16), Math.sin(a) * (Rout + 16), 0.95, 3.4, i % 3 ? null : 'column')
  }
  return { g, top: 55 }
}

/** 63 市图书馆（石基座 + 玻璃阅览厅 + 书库，跨 2×2 地块） */
function t63(x, z) {
  const g = group(x, z, 0)

  // ---------- 基座（两层石砌书库） ----------
  const BW = 52
  const BD = 34
  const BH = 9.0
  box(BW + 1.6, 1.0, BD + 1.6, M.tuff, 0, 0.5, -2, g)
  box(BW + 2.2, 0.24, BD + 2.2, M.whiteStone, 0, 1.06, -2, g)
  box(BW, BH, BD, M.tuff, 0, 1.1 + BH / 2, -2, g)
  // 石材分缝 + 基座长窗
  for (let i = 0; i < 5; i++) {
    for (const sz of [-1, 1]) box(BW + 0.08, 0.09, 0.12, M.whiteStone, 0, 1.1 + 1.8 * i, -2 + sz * (BD / 2 + 0.04), g)
  }
  for (let f = 0; f < 2; f++) {
    const y = 1.1 + 2.6 + f * 3.4
    for (const sz of [-1, 1]) {
      const zf = -2 + sz * (BD / 2 + 0.03)
      box(BW - 6, 1.7, 0.16, M.glSmoke, 0, y, zf, g)
      for (let i = 0; i <= 18; i++) box(0.14, 1.7, 0.24, M.aluDark, -BW / 2 + 3 + i * ((BW - 6) / 18), y, zf + sz * 0.06, g)
      box(BW - 5.6, 0.22, 0.34, M.whiteStone, 0, y - 0.95, zf + sz * 0.1, g)
    }
    for (const sx of [-1, 1]) {
      const xf = sx * (BW / 2 + 0.03)
      box(0.16, 1.7, BD - 8, M.glSmoke, xf, y, -2, g)
      for (let i = 0; i <= 10; i++) box(0.24, 1.7, 0.14, M.aluDark, xf + sx * 0.06, y, -2 - BD / 2 + 4 + i * ((BD - 8) / 10), g)
    }
  }
  // 基座壁柱
  for (let i = 0; i <= 12; i++) {
    for (const sz of [-1, 1]) box(0.9, BH, 0.5, M.whiteStone, -BW / 2 + i * (BW / 12), 1.1 + BH / 2, -2 + sz * (BD / 2 + 0.18), g)
  }

  // ---------- 上部玻璃阅览厅 ----------
  const GW = 42
  const GD = 26
  const GH = 8.4
  const gy = 1.1 + BH
  box(GW, GH, GD, M.glSmoke, 0, gy + GH / 2, -2, g)
  for (let i = 0; i <= 14; i++) {
    for (const sz of [-1, 1]) box(0.16, GH, 0.22, M.brightSilver, -GW / 2 + i * (GW / 14), gy + GH / 2, -2 + sz * (GD / 2 + 0.06), g)
    for (const sx of [-1, 1]) box(0.22, GH, 0.16, M.brightSilver, sx * (GW / 2 + 0.06), gy + GH / 2, -2 - GD / 2 + i * (GD / 14), g)
  }
  for (const oy of [gy + 2.8, gy + 5.6]) {
    for (const sz of [-1, 1]) box(GW + 0.2, 0.14, 0.3, M.brightSilver, 0, oy, -2 + sz * (GD / 2 + 0.08), g)
    for (const sx of [-1, 1]) box(0.3, 0.14, GD + 0.2, M.brightSilver, sx * (GW / 2 + 0.08), oy, -2, g)
  }
  // 阅览厅内书架（沿玻璃排列，从外部可见）
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const bx = -GW / 2 + 2.4 + i * 3.2
      box(2.2, 2.4, 0.8, M.teak, bx, gy + 1.2, -2 + sz * (GD / 2 - 2.2), g)
      for (let k = 0; k < 4; k++) box(2.0, 0.06, 0.9, M.darkFrame, bx, gy + 0.5 + k * 0.55, -2 + sz * (GD / 2 - 2.22), g)
      for (let k = 0; k < 12; k++) box(0.1, 0.34, 0.6, [M.paintRed, M.paintBlue, M.paintYell, M.glazeWhite][k % 4], bx - 0.9 + k * 0.16, gy + 0.72 + (k % 4) * 0.02, -2 + sz * (GD / 2 - 2.24), g)
    }
    // 阅览长桌 + 台灯
    for (let i = 0; i < 5; i++) {
      box(5.0, 0.12, 1.6, M.teak, -14 + i * 7, gy + 0.85, -2 + sz * 4.6, g)
      for (const ox of [-1.8, 1.8]) box(0.16, 0.82, 1.4, M.darkFrame, -14 + i * 7 + ox, gy + 0.41, -2 + sz * 4.6, g)
      for (const ox of [-1.4, 0, 1.4]) {
        cyl(0.14, 0.18, 0.18, M.charcoal, -14 + i * 7 + ox, gy + 1.0, -2 + sz * 4.6, 8, g)
        cyl(0.04, 0.04, 0.5, M.brightSilver, -14 + i * 7 + ox, gy + 1.32, -2 + sz * 4.6, 5, g)
        cone(0.26, 0.28, M.glazeWhite, -14 + i * 7 + ox, gy + 1.62, -2 + sz * 4.6, 10, g)
      }
    }
  }
  // 玻璃厅遮阳百叶（南向）
  for (let i = 0; i < 6; i++) {
    for (const sz of [-1, 1]) box(GW - 2, 0.16, 0.8, M.aluPanel, 0, gy + 0.8 + i * 1.3, -2 + sz * (GD / 2 + 0.6), g)
  }
  // 大挑檐 + 屋面
  box(GW + 3.2, 0.9, GD + 3.2, M.brightSilver, 0, gy + GH + 0.45, -2, g)
  box(GW + 3.6, 0.22, GD + 3.6, M.aluDark, 0, gy + GH + 0.98, -2, g)
  parapet(g, GW + 3.2, GD + 3.2, gy + GH + 1.0, M.brightSilver, 0.7, 0.3)
  box(12, 2.4, 9, M.aluPanel, -8, gy + GH + 2.2, -6, g)
  box(12.3, 0.2, 9.3, M.aluDark, -8, gy + GH + 3.5, -6, g)
  for (let i = 0; i < 5; i++) {
    const sk = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.14, 2.4), M.glWhite)
    sk.position.set(-12 + i * 6.0, gy + GH + 1.4, 6)
    sk.castShadow = true
    g.add(sk)
  }

  // ---------- 入口柱廊 + 台阶 ----------
  const pz = -2 + BD / 2
  for (let i = 0; i < 8; i++) {
    const px = -14 + i * 4.0
    cyl(0.55, 0.62, 8.6, M.whiteStone, px, 1.1 + 4.3, pz + 2.6, 14, g)
    box(1.4, 0.3, 1.4, M.whiteStone, px, 1.25, pz + 2.6, g)
    box(1.4, 0.28, 1.4, M.whiteStone, px, 9.6, pz + 2.6, g)
  }
  box(36, 1.0, 6.0, M.whiteStone, 0, 10.2, pz + 2.6, g)
  box(36.6, 0.3, 6.6, M.whiteStone, 0, 10.9, pz + 2.6, g)
  // 柱间通高玻璃 + 旋转门
  box(33, 8.2, 0.3, M.glSmoke, 0, 1.1 + 4.1, pz + 0.05, g)
  for (let i = 0; i < 4; i++) box(0.24, 8.2, 0.4, M.whiteStone, -14 + i * 9.3, 1.1 + 4.1, pz + 0.02, g)
  box(5.0, 3.6, 0.24, M.glWhite, 0, 2.9, pz + 2.7, g)
  cyl(1.8, 1.8, 3.6, M.glWhite, 0, 2.9, pz + 2.7, 16, g)
  steps(g, 34, 5, 0.26, 1.1, 1.1, M.whiteStone, pz + 5.6)
  // 台阶侧石墩
  for (const sx of [-1, 1]) {
    box(2.0, 1.2, 2.0, M.whiteStone, sx * 17.5, 0.6, pz + 7.0, g)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), M.whiteStone)
    add(orb, sx * 17.5, 1.7, pz + 7.0, g)
  }
  // 无障碍坡道
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 12), M.whiteStone)
    r.position.set(sx * 21.5, 1.3, pz + 5.4)
    r.rotation.x = -0.16
    r.castShadow = true
    g.add(r)
    railing(g, 11.0, 2.1, pz + 10.6, M.brightSilver, 8, 0.9)
  }

  // ---------- 广场 ----------
  paved(g, 0, pz + 16, 50, 16, M.paving, 3.0, 'x')
  // 雕塑
  cyl(2.6, 2.8, 0.6, M.whiteStone, -16, 0.3, pz + 14, 20, g)
  const sc = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.36, 8, 28), M.bronze)
  sc.position.set(-16, 3.0, pz + 14)
  sc.rotation.y = 0.6
  sc.castShadow = true
  g.add(sc)
  // 旗杆 / 灯 / 树 / 长椅 / 自行车架
  for (let i = 0; i < 3; i++) cyl(0.09, 0.13, 13, M.brightSilver, 14 + i * 2.4, 6.5, pz + 10, 8, g)
  for (const [lx, lz] of [[-22, pz + 8], [22, pz + 8], [-26, pz + 18], [26, pz + 18]]) lampPost(g, lx, lz, 6.4, 0)
  for (let i = 0; i < 5; i++) treeAt(g, -24 + i * 12, pz + 21, 1.0)
  for (const [bx, bz] of [[-10, pz + 18], [10, pz + 18]]) benchAt(g, bx, bz, Math.PI)
  for (let i = 0; i < 8; i++) {
    box(0.08, 0.66, 0.08, M.brightSilver, -32 + i * 1.0, 0.33, pz + 12.4, g)
    box(0.86, 0.06, 0.06, M.brightSilver, -31.6 + i * 1.0, 0.66, pz + 12.4, g)
  }
  return { g, top: gy + GH + 6 }
}

/** 64 博物馆（古典柱廊 + 新馆玻璃体） */
function t64(x, z) {
  const g = group(x, z, -0.08)
  box(24, 10, 16, M.tuff, 0, 5, 0, g)
  box(26, 1.0, 18, M.whiteStone, 0, 10.5, 0, g)
  // 柱廊 + 山花
  colonnade(g, 18, 0, 8.4, M.whiteStone, 7.6, 7, 0.5)
  steps(g, 20, 4, 0.3, 1.0, 0.0, M.whiteStone, 8.4)
  pediment(g, 19, 4.2, 1.6, M.whiteStone, 11.0, 7.6)
  // 新馆：悬挑玻璃盒
  box(14, 7, 10, M.glSmoke, 12, 3.6, -6, g)
  for (let i = 0; i < 6; i++) box(0.16, 7, 0.16, M.brightSilver, 5.4 + i * 2.7, 3.6, -0.9, g)
  box(15.6, 0.5, 11.6, M.aluPanel, 12, 7.4, -6, g)
  // 玻璃新馆幕墙分格（前后 + 侧面）
  for (const sz of [-1, 1]) {
    for (let i = 0; i <= 7; i++) box(0.14, 7, 0.16, M.brightSilver, 5.4 + i * 1.9, 3.6, -6 + sz * 5.06, g)
    for (const oy of [1.8, 3.6, 5.4]) box(14.1, 0.12, 0.2, M.brightSilver, 12, oy, -6 + sz * 5.06, g)
  }
  for (let i = 0; i <= 5; i++) box(0.16, 7, 0.14, M.brightSilver, 5.0, 3.6, -11 + i * 2, g)
  box(15.7, 0.3, 0.3, M.darkFrame, 12, 7.15, -0.4, g)
  // 主馆石材分缝 + 壁柱
  for (let i = 0; i < 4; i++) {
    for (const sz of [-1, 1]) box(24.06, 0.06, 0.1, M.whiteStone, 0, 2.0 + i * 1.9, sz * 8.03, g)
  }
  for (const px of [-11.6, -8.4, 8.4, 11.6]) box(0.9, 10, 0.4, M.whiteStone, px, 5, 8.06, g)
  // 台阶石墩 + 广场铺装 + 旗杆 + 雕塑
  for (const sx of [-1, 1]) {
    box(1.4, 1.6, 1.4, M.whiteStone, sx * 9.6, 0.8, 9.4, g)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 9), M.whiteStone)
    add(orb, sx * 9.6, 2.0, 9.4, g)
  }
  box(26, 0.1, 8, M.paving, 0, 0.06, 13, g)
  for (let i = 0; i < 7; i++) box(0.1, 0.03, 7.8, M.curb, -13.2 + i * 4.4, 0.12, 13, g)
  for (const sx of [-1, 1]) cyl(0.09, 0.13, 13, M.brightSilver, sx * 6, 6.5, 15, 8, g)
  // 雕塑基座 + 抽象雕塑
  cyl(2.2, 2.6, 0.9, M.whiteStone, -11, 0.45, 15, 16, g)
  const sc = new THREE.Mesh(new THREE.TorusKnotGeometry(1.2, 0.34, 48, 8), M.copperAged)
  sc.position.set(-11, 2.8, 15)
  sc.castShadow = true
  g.add(sc)
  // 屋面设备
  box(5.2, 1.5, 4.0, M.aluPanel, -6, 11.6, -3, g)
  return { g, top: 16 }
}

/** 65 大学教学楼（三翼围合庭院 + 钟塔 + 四面立面） */
function t65(x, z) {
  const g = group(x, z, 0.12)
  const fh = 4.0
  const floors = 4
  const H = floors * fh
  const wingZ = -9          // 北翼中心
  const wingX = 10.5        // 东西翼中心
  const NZ0 = wingZ + 4.5   // 北翼南墙 = -4.5
  const NX = 15             // 东西翼外侧
  const IX = 6              // 内院侧墙

  // ---------- 基座（整体抬高的石台 + 勒脚） ----------
  box(32.2, 0.55, 24.6, M.whiteStone, 0, 0.27, -1.6, g)
  box(31.4, 0.3, 23.8, M.tuff, 0, 0.62, -1.6, g)
  // 三翼
  box(30, H, 9, M.brick, 0, H / 2 + 0.7, wingZ, g)
  for (const sx of [-1, 1]) box(9, H, 16, M.brick, sx * wingX, H / 2 + 0.7, 1, g)
  // 勒脚（石材） + 窗台线 + 檐口
  box(30.5, 1.1, 9.5, M.whiteStone, 0, 1.25, wingZ, g)
  for (const sx of [-1, 1]) box(9.5, 1.1, 16.5, M.whiteStone, sx * wingX, 1.25, 1, g)
  box(30.7, 0.8, 9.7, M.whiteStone, 0, H + 0.9, wingZ, g)
  for (const sx of [-1, 1]) box(9.7, 0.8, 16.7, M.whiteStone, sx * wingX, H + 0.9, 1, g)
  // 顶部女儿墙 + 压顶（各翼独立）
  const parapetAt = (cw, cd, cx, cz, y, mat, ph = 1.0, t = 0.36) => {
    box(cw, ph, t, mat, cx, y + ph / 2, cz + cd / 2 - t / 2, g)
    box(cw, ph, t, mat, cx, y + ph / 2, cz - cd / 2 + t / 2, g)
    box(t, ph, cd, mat, cx + cw / 2 - t / 2, y + ph / 2, cz, g)
    box(t, ph, cd, mat, cx - cw / 2 + t / 2, y + ph / 2, cz, g)
    box(cw + 0.24, 0.13, t + 0.24, M.whiteStone, cx, y + ph + 0.06, cz + cd / 2 - t / 2, g)
    box(cw + 0.24, 0.13, t + 0.24, M.whiteStone, cx, y + ph + 0.06, cz - cd / 2 + t / 2, g)
    box(t + 0.24, 0.13, cd, M.whiteStone, cx + cw / 2 - t / 2, y + ph + 0.06, cz, g)
    box(t + 0.24, 0.13, cd, M.whiteStone, cx - cw / 2 + t / 2, y + ph + 0.06, cz, g)
  }
  parapetAt(30.4, 9.4, 0, wingZ, H + 1.3, M.brick)
  for (const sx of [-1, 1]) parapetAt(9.4, 16.4, sx * wingX, 1, H + 1.3, M.brick)

  // ---------- 立面开窗 ----------
  // 单樘窗：石框 + 玻璃 + 窗台 + 过梁
  const bay = (px, py, pz, ry, ww = 2.0, hh = 2.3) => {
    const s = new THREE.Group()
    s.position.set(px, py, pz)
    s.rotation.y = ry
    g.add(s)
    box(ww + 0.44, hh + 0.44, 0.16, M.whiteStone, 0, 0, 0, s)
    box(ww, hh, 0.12, M.glTeal, 0, 0, 0.1, s)
    box(0.07, hh, 0.12, M.darkFrame, 0, 0, 0.16, s)
    box(ww, 0.07, 0.12, M.darkFrame, 0, hh * 0.18, 0.16, s)
    box(ww + 0.66, 0.14, 0.34, M.whiteStone, 0, -hh / 2 - 0.28, 0.1, s)
    box(ww + 0.6, 0.16, 0.22, M.whiteStone, 0, hh / 2 + 0.3, 0.06, s)
  }
  // 北翼：南立面（面向内院）拱廊 + 三层窗；北立面同样开窗
  for (let i = 0; i < 7; i++) {
    const px = -12 + i * 4
    archPanel(2.6, 3.4, 0.3, M.charcoal, px, 0.9, NZ0 + 0.06, g)
    for (let f = 1; f < floors; f++) bay(px, 0.7 + f * fh + 2.0, NZ0 + 0.1, 0)
  }
  for (let i = 0; i < 7; i++) {
    const px = -12 + i * 4
    for (let f = 0; f < floors; f++) bay(px, 0.7 + f * fh + 2.0, wingZ - 4.6, Math.PI)
  }
  // 东西翼：外侧 + 内院侧 各 4 开间
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const pz = -5.2 + i * 4.1
      // 外侧
      for (let f = 0; f < floors; f++) bay(sx * (NX + 0.1), 0.7 + f * fh + 2.0, pz, sx * Math.PI / 2)
      // 内院侧：首层拱廊，上面开窗
      archPanel(2.4, 3.2, 0.3, M.charcoal, sx * (IX - 0.06), 0.9, pz, g, -sx * Math.PI / 2)
      for (let f = 1; f < floors; f++) bay(sx * (IX - 0.1), 0.7 + f * fh + 2.0, pz, -sx * Math.PI / 2)
    }
  }
  // 落水管（四角 + 山墙两端）
  for (const px of [-14.6, 14.6, -5.6, 5.6]) downpipe(g, px, NZ0 + 0.12, H + 1.4)
  for (const sx of [-1, 1]) {
    downpipe(g, sx * (NX + 0.12), -6.4, H + 1.4)
    downpipe(g, sx * (NX + 0.12), 8.4, H + 1.4)
  }

  // ---------- 门廊（东西翼南端入口） ----------
  for (const sx of [-1, 1]) {
    // 门斗 + 雨篷 + 台阶
    box(6.4, 4.6, 1.4, M.whiteStone, sx * wingX, 3.0, 9.4, g)
    archPanel(3.0, 3.8, 0.3, M.teak, sx * wingX, 0.9, 10.14, g)
    for (const ox of [-2.9, 2.9]) box(0.7, 4.6, 0.7, M.whiteStone, sx * wingX + ox, 3.0, 10.4, g)
    box(7.6, 0.28, 2.2, M.whiteStone, sx * wingX, 5.5, 10.2, g)
    box(7.8, 0.16, 2.4, M.aluPanel, sx * wingX, 5.72, 10.2, g)
    steps(g, 7.0, 3, 0.22, 0.5, 0.66, M.whiteStone, 10.9)
    // 门牌横匾
    box(4.6, 0.5, 0.12, M.charcoal, sx * wingX, 4.6, 10.2, g)
    box(4.0, 0.16, 0.1, M.glazeWhite, sx * wingX, 4.6, 10.28, g)
    // 门厅灯
    for (const ox of [-1.6, 1.6]) {
      cyl(0.14, 0.2, 0.5, M.glazeWhite, sx * wingX + ox, 5.0, 10.5, 8, g)
    }
  }

  // ---------- 庭院 + 旗杆 + 廊架 ----------
  box(20, 0.14, 14, M.paving, 0, 0.74, 2, g)
  box(8.4, 0.1, 8.4, M.whiteStone, 0, 0.82, 2.4, g)
  cyl(2.4, 2.7, 0.6, M.whiteStone, 0, 1.1, 2.4, 20, g)
  cyl(1.4, 1.8, 0.5, M.greenSoft, 0, 1.55, 2.4, 18, g)
  // 旗杆 + 旗帜 + 基座
  cyl(0.11, 0.15, 13, M.brightSilver, 0, 7.5, 2.4, 8, g)
  box(0.05, 2.0, 3.4, M.paintRed, 0.06, 11.4, 4.1, g)
  // 庭院四周绿篱 + 长椅
  for (const sz of [-1, 1]) hedge(g, 0, 2 + sz * 6.6, 17, true, 0.75, 0.9)
  for (const sx of [-1, 1]) {
    hedge(g, sx * 4.8, 2, 12.4, false, 0.75, 0.9)
    for (let i = 0; i < 2; i++) benchAt(g, sx * 3.4, 0.5 + i * 4.4, sx * Math.PI / 2)
  }
  for (const sx of [-1, 1]) {
    treeAt(g, sx * 3.6, -2.4, 0.85, 3.2, 'umbrella')
    lampPost(g, sx * 4.4, 6.2, 4.2, sx * Math.PI / 2)
  }

  // ---------- 钟塔 ----------
  const TH = H + 6.4
  box(4.8, TH, 4.8, M.brick, 0, TH / 2 + 0.7, wingZ, g)
  box(5.3, 1.0, 5.3, M.whiteStone, 0, 1.3, wingZ, g)          // 塔基
  box(5.4, 0.7, 5.4, M.whiteStone, 0, TH - 3.2, wingZ, g)     // 钟层下弦
  box(5.6, 0.8, 5.6, M.whiteStone, 0, TH + 0.5, wingZ, g)     // 塔顶檐口
  // 塔身壁柱与竖向装饰
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.6, TH - 1.0, 0.6, M.whiteStone, sx * 2.15, (TH - 1.0) / 2 + 1.0, wingZ + sz * 2.15, g)
  }
  // 钟层面：四面时钟 + 石框
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
    const cx = dx * 2.44, cz = wingZ + dz * 2.44
    const dial = new THREE.Mesh(new THREE.CircleGeometry(1.45, 24), M.glazeWhite)
    dial.position.set(cx, TH - 1.6, cz)
    dial.rotation.y = ry
    g.add(dial)
    const bez = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.16, 6, 26), M.whiteStone)
    bez.position.set(cx, TH - 1.6, cz)
    bez.rotation.y = ry
    g.add(bez)
    // 指针（时针 / 分针）
    const hh = box(0.16, 0.95, 0.07, M.charcoal, cx + dx * 0.08, TH - 1.28, cz + dz * 0.08, g)
    hh.rotation.y = ry
    const mm = box(0.12, 1.32, 0.07, M.charcoal, cx + dx * 0.08, TH - 1.0, cz + dz * 0.08, g)
    mm.rotation.y = ry
    mm.rotation.z = 0.7
    // 钟层百叶
    box(1.5, 1.1, 0.12, M.darkFrame, cx + dx * 0.06, TH + 1.6, cz + dz * 0.06, g)
    for (let k = 0; k < 4; k++) box(1.36, 0.09, 0.16, M.bronze, cx + dx * 0.1, TH + 1.2 + k * 0.24, cz + dz * 0.1, g)
  }
  // 铜四坡顶 + 风向标
  hipRoof(g, 5.0, 5.0, TH + 0.9, 5.4, M.copperAged, 0.7, 0, wingZ)
  cyl(0.1, 0.12, 1.8, M.bronze, 0, TH + 6.6, wingZ, 6, g)
  box(0.06, 0.09, 1.9, M.bronze, 0, TH + 7.1, wingZ, g)
  for (const sz of [-1, 1]) {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), M.bronze)
    arrow.position.set(0, TH + 7.1, wingZ + sz * 0.95)
    arrow.rotation.x = sz * Math.PI / 2
    g.add(arrow)
  }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), M.gold)
  add(orb, 0, TH + 7.6, wingZ, g)

  // ---------- 屋面：天窗 / 设备 / 楼梯间 ----------
  // 北翼中央采光天窗（连续拱形）
  barrelRoof(g, 18, 1.5, H + 1.3, M.glIce, wingZ, 16)
  for (const ox of [-9, -6, -3, 0, 3, 6, 9]) box(0.12, 1.1, 3.4, M.aluPanel, ox, H + 1.9, wingZ, g)
  // 东西翼屋顶设备 + 水箱
  for (const sx of [-1, 1]) {
    box(3.4, 2.0, 2.6, M.aluPanel, sx * wingX, H + 2.3, -2.6, g)
    for (let i = 0; i < 5; i++) box(3.2, 0.06, 0.06, M.darkFrame, sx * wingX, H + 1.6 + i * 0.3, -1.32, g)
    cyl(1.5, 1.5, 2.4, M.brightSilver, sx * wingX + 2.6, H + 2.5, 5.0, 14, g)
    cyl(1.6, 1.6, 0.2, M.aluPanel, sx * wingX + 2.6, H + 3.8, 5.0, 14, g)
    box(2.6, 1.5, 2.2, M.tuff, sx * wingX - 2.4, H + 2.0, 5.6, g)
    acUnit(g, sx * wingX + 3.2, H + 2.1, -3.4, sx * Math.PI / 2)
  }
  // 北翼女儿墙内的机房与通风帽
  box(6.0, 2.4, 4.0, M.brick, -9, H + 2.5, wingZ, g)
  box(6.4, 0.3, 4.4, M.whiteStone, -9, H + 3.85, wingZ, g)
  for (const ox of [5.4, 7.4, 9.4]) {
    cyl(0.5, 0.5, 1.0, M.aluPanel, ox, H + 2.1, wingZ, 10, g)
    cyl(0.62, 0.5, 0.24, M.aluDark, ox, H + 2.7, wingZ, 10, g)
  }
  // 钟塔检修门
  box(1.1, 2.2, 0.16, M.charcoal, 0, 2.2, wingZ + 2.42, g)

  // ---------- 场地：前广场 / 绿化 / 停车 ----------
  box(34, 0.16, 12, M.paving, 0, 0.08, 15.4, g)
  paved(g, 0, 15.4, 34, 12, M.paving, 4.0, 'x')
  box(9, 0.2, 4.2, M.whiteStone, 0, 0.1, 11.6, g)          // 中央步道
  // 广场水池 / 树阵 / 长椅 / 灯
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      treeAt(g, sx * (7.5 + i * 3.6), 14.0, 0.9, 3.4, i % 2 ? 'blossom' : null)
      bushAt(g, sx * (6.4 + i * 3.6), 17.6, 0.62)
    }
    benchAt(g, sx * 6.0, 12.0, sx * Math.PI / 2)
    lampPost(g, sx * 10.4, 12.2, 5.0, 0)
  }
  // 沿街绿篱 + 入口标识
  for (const sx of [-1, 1]) {
    hedge(g, sx * 12.6, 20.4, 11, true, 0.9, 1.1)
    hedge(g, sx * 17.4, 4.0, 20, false, 0.9, 1.1)
  }
  box(6.2, 0.5, 0.4, M.charcoal, 0, 2.9, 21.0, g)
  box(5.6, 0.22, 0.12, M.glazeWhite, 0, 2.9, 21.2, g)
  for (const sx of [-1, 1]) box(0.3, 3.2, 0.3, M.aluDark, sx * 2.8, 1.6, 21.0, g)
  // 西侧停车位 + 车 + 自行车架
  for (let i = 0; i < 3; i++) {
    const px = -18.6
    const pz = -7.6 + i * 6.4
    box(0.12, 0.06, 5.4, M.roadPaint, px - 2.8, 0.12, pz + 2.7, g)
    box(0.12, 0.06, 5.4, M.roadPaint, px + 2.8, 0.12, pz + 2.7, g)
  }
  carAt(g, -18.6, -7.0, Math.PI / 2, M.glSilver)
  carAt(g, -18.6, -0.6, Math.PI / 2, M.charcoal)
  carAt(g, -18.6, 5.8, Math.PI / 2, M.paintBlue)
  for (let i = 0; i < 5; i++) {
    // 自行车架：两根立管 + 斜靠杆
    const bx = 15.0
    const bz = -4.0 + i * 2.2
    cyl(0.06, 0.06, 1.0, M.brightSilver, bx, 0.5, bz, 6, g)
    cyl(0.06, 0.06, 1.0, M.brightSilver, bx + 0.9, 0.5, bz, 6, g)
    beamBetween(g, bx, 0.95, bz, bx + 0.9, 0.95, bz, 0.07, M.brightSilver, 0.07)
  }
  return { g, top: TH + 10 }
}

/** 66 综合医院（门诊 + 住院 + 急诊，跨 2×2 地块） */
function t66(x, z) {
  const g = group(x, z, 0)

  // ---------- 门诊医技楼（4 层裙房） ----------
  const PW = 40
  const PD = 26
  const pf = 4
  const fh = 4.3
  const PH = pf * fh
  box(PW + 1.2, 1.2, PD + 1.2, M.tuff, 0, 0.6, 2, g)
  box(PW, PH, PD, M.whiteStone, 0, PH / 2 + 1.2, 2, g)
  for (let f = 0; f < pf; f++) {
    const y = 1.2 + f * fh
    // 层间饰带
    box(PW + 0.3, 0.4, PD + 0.3, M.whiteStone, 0, y + fh, 2, g)
    for (const sz of [-1, 1]) {
      const zf = 2 + sz * (PD / 2 + 0.02)
      box(PW - 3.0, 2.4, 0.16, M.glTeal, 0, y + 2.3, zf, g)
      const n = 14
      for (let i = 0; i <= n; i++) box(0.14, 2.4, 0.22, M.aluPanel, -PW / 2 + 1.4 + i * ((PW - 2.8) / n), y + 2.3, zf + sz * 0.06, g)
      box(PW - 2.6, 0.16, 0.34, M.whiteStone, 0, y + 1.05, zf + sz * 0.1, g)
      // 竖向遮阳鳍
      for (let i = 0; i < 9; i++) {
        const px = -PW / 2 + 3 + i * 4.4
        const fin = box(0.24, 2.8, 0.7, M.whiteStone, px, y + 2.3, zf + sz * 0.4, g)
        fin.rotation.y = sz * 0.24
      }
    }
    for (const sx of [-1, 1]) {
      const xf = sx * (PW / 2 + 0.02)
      box(0.16, 2.4, PD - 5, M.glTeal, xf, y + 2.3, 2, g)
      for (let i = 0; i <= 8; i++) box(0.22, 2.4, 0.14, M.aluPanel, xf + sx * 0.06, y + 2.3, -PD / 2 + 2.2 + i * ((PD - 4.4) / 8), g)
    }
  }
  // 入口通高玻璃 + 门厅
  gridGlass(g, -4, 5.2, 15.2, 0, 22, 10.4, 11, 4, { glass: M.glSmoke, frame: M.aluPanel, mw: 0.14, mh: 0.18 })
  for (let i = 0; i < 5; i++) box(0.24, 10.4, 0.3, M.brightSilver, -15 + i * 5.5, 5.2, 15.4, g)
  // 入口雨篷 + 落客环道
  box(26, 0.7, 10, M.whiteStone, -4, 11.4, 20, g)
  box(26.4, 0.18, 10.4, M.aluPanel, -4, 11.8, 20, g)
  for (let i = 0; i < 6; i++) cyl(0.3, 0.34, 10.6, M.whiteStone, -16 + i * 4.8, 5.3, 24.2, 10, g)
  for (let i = 0; i < 8; i++) box(3.0, 0.2, 0.5, M.glWhite, -15 + i * 3.4, 11.0, 22, g)
  paved(g, -4, 28, 34, 12, M.paving, 2.6, 'x')
  for (let i = 0; i < 7; i++) box(0.16, 0.05, 10, M.roadPaint, -18 + i * 4.6, 0.13, 28, g)
  // 主入口推拉门 + 导医台（透过玻璃）
  box(7.0, 3.4, 0.2, M.glWhite, -4, 2.9, 15.9, g)
  box(0.1, 3.4, 0.26, M.aluPanel, -4, 2.9, 16.0, g)
  cyl(1.6, 1.8, 1.1, M.whiteStone, -4, 0.55, 10, 20, g)
  cyl(1.9, 1.9, 0.12, M.teak, -4, 1.2, 10, 20, g)

  // ---------- 住院塔楼（12 层） ----------
  const TW = 22
  const TD = 20
  const tf = 12
  const th = 3.8
  const TH = tf * th
  const tx = -26
  const tz = -24
  box(TW + 1.0, 1.4, TD + 1.0, M.tuff, tx, 0.7, tz, g)
  box(TW, TH, TD, M.whiteStone, tx, TH / 2 + 0.8, tz, g)
  for (let f = 0; f < tf; f++) {
    const y = 0.8 + f * th
    box(TW + 0.26, 0.34, TD + 0.26, M.whiteStone, tx, y + th, tz, g)
    // 病房窗单元：每层 7 开间，两侧带独立窗台
    for (const sz of [-1, 1]) {
      const zf = tz + sz * (TD / 2 + 0.02)
      for (let i = 0; i < 7; i++) {
        const px = tx - TW / 2 + 1.7 + i * 3.0
        box(2.0, 1.9, 0.16, M.glTeal, px, y + 2.5, zf, g)
        box(2.2, 0.14, 0.3, M.whiteStone, px, y + 1.5, zf + sz * 0.08, g)
        for (const ox of [-1.0, 1.0]) box(0.16, 1.9, 0.24, M.aluPanel, px + ox, y + 2.5, zf + sz * 0.06, g)
        if (i % 2 === 0) {
          const fin = box(0.18, 2.2, 0.62, M.whiteStone, px + 1.55, y + 2.5, zf + sz * 0.32, g)
          fin.rotation.y = sz * 0.2
        }
      }
    }
    for (const sx of [-1, 1]) {
      const xf = tx + sx * (TW / 2 + 0.02)
      box(0.16, 1.9, TD - 6, M.glTeal, xf, y + 2.5, tz, g)
      for (let i = 0; i < 5; i++) box(0.24, 1.9, 0.14, M.aluPanel, xf + sx * 0.06, y + 2.5, tz - TD / 2 + 2.4 + i * ((TD - 4.8) / 4), g)
      // 医护走廊端窗
      box(0.2, 2.0, 1.6, M.glWhite, xf + sx * 0.04, y + 2.4, tz - TD / 2 + 1.4, g)
    }
  }
  // 塔楼顶层机房 + 直升机坪
  box(TW + 0.4, 0.9, TD + 0.4, M.whiteStone, tx, TH + 1.35, tz, g)
  box(7.0, 3.0, 6.0, M.aluPanel, tx - 4, TH + 3.3, tz, g)
  box(7.3, 0.2, 6.3, M.whiteStone, tx - 4, TH + 4.9, tz, g)
  cyl(7.0, 7.0, 0.5, M.concreteDark, tx + 4, TH + 2.0, tz + 2, 30, g)
  cyl(6.7, 6.7, 0.06, M.charcoal, tx + 4, TH + 2.3, tz + 2, 30, g)
  box(4.2, 0.12, 0.9, M.paintYell, tx + 4, TH + 2.36, tz + 2, g)
  for (const sx of [-1, 1]) box(0.9, 0.12, 3.0, M.paintYell, tx + 4 + sx * 1.7, TH + 2.36, tz + 2, g)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    cyl(0.1, 0.1, 0.4, M.glazeWhite, tx + 4 + Math.cos(a) * 6.4, TH + 2.4, tz + 2 + Math.sin(a) * 6.4, 5, g)
  }
  // 塔楼竖向设备管井 + 航空障碍灯
  for (const [ox, oz] of [[-1, -1], [1, 1]]) box(1.4, TH + 3, 1.4, M.whiteStone, tx + ox * (TW / 2 - 1.2), (TH + 3) / 2, tz + oz * (TD / 2 - 1.2), g)
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    cyl(0.1, 0.1, 0.5, M.paintRed, tx + px * (TW / 2), TH + 1.6, tz + pz * (TD / 2), 5, g)
  }

  // ---------- 玻璃中庭（连接体） ----------
  const ax = 3
  const az = -20
  box(14, 1.0, 14, M.tuff, ax, 0.5, az, g)
  box(13, 22, 13, M.glSmoke, ax, 11.4, az, g)
  for (let i = 0; i <= 6; i++) {
    for (const sz of [-1, 1]) box(0.2, 22, 0.24, M.brightSilver, ax - 6.5 + i * (13 / 6), 11.4, az + sz * 6.56, g)
    for (const sx of [-1, 1]) box(0.24, 22, 0.2, M.brightSilver, ax + sx * 6.56, 11.4, az - 6.5 + i * (13 / 6), g)
  }
  for (let i = 1; i <= 4; i++) box(13.3, 0.16, 13.3, M.brightSilver, ax, 1.0 + i * 5.0, az, g)
  // 斜玻璃顶
  const atr = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.3, 14.4), M.glWhite)
  atr.position.set(ax, 22.6, az)
  atr.rotation.x = 0.1
  atr.castShadow = true
  g.add(atr)
  // 自动扶梯（穿过中庭，面向入口）
  for (let i = 0; i < 3; i++) {
    const esc = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 13), M.brightSilver)
    esc.position.set(ax - 3 + i * 3, 3.2 + i * 4.4, az + 1)
    esc.rotation.x = -0.32
    esc.castShadow = true
    g.add(esc)
    for (const sx of [-1, 1]) {
      const rl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 13), M.glWhite)
      rl.position.set(ax - 3 + i * 3 + sx * 1.25, 3.9 + i * 4.4, az + 1)
      rl.rotation.x = -0.32
      g.add(rl)
    }
  }

  // ---------- 急诊部 ----------
  const ex = 30
  const ez = 12
  box(18, 4.2, 18, M.whiteStone, ex, 2.1, ez, g)
  box(18.8, 0.8, 18.8, M.paintBlue, ex, 4.6, ez, g)
  box(17, 3.6, 0.2, M.glSmoke, ex, 1.9, ez + 9.06, g)
  for (let i = 0; i < 5; i++) box(0.14, 3.6, 0.26, M.aluPanel, ex - 8 + i * 4, 1.9, ez + 9.14, g)
  // 急诊雨篷 + 救护车停靠
  box(16, 0.4, 8, M.whiteStone, ex, 5.4, ez + 11.5, g)
  box(16.4, 0.14, 8.4, M.paintBlue, ex, 5.66, ez + 11.5, g)
  for (const sx of [-1, 1]) cyl(0.22, 0.22, 5.2, M.brightSilver, ex + sx * 7.4, 2.6, ez + 15.0, 8, g)
  // 红色十字标识
  box(2.6, 0.8, 0.2, M.paintRed, ex, 6.6, ez + 9.2, g)
  box(0.8, 2.6, 0.2, M.paintRed, ex, 6.6, ez + 9.2, g)
  box(3.6, 0.9, 0.26, M.paintRed, ex, 7.9, ez + 9.06, g)
  box(2.6, 0.4, 0.1, M.glazeWhite, ex - 0.3, 7.9, ez + 9.22, g)
  box(2.6, 0.4, 0.1, M.glazeWhite, ex + 0.3, 7.9, ez + 9.22, g)
  // 救护车
  for (const [ox, oz] of [[-5, 19.5], [5, 19.5]]) {
    box(6.0, 2.5, 2.4, M.glazeWhite, ex + ox, 1.55, ez + oz, g)
    box(2.0, 1.2, 2.44, M.glSmoke, ex + ox - 2.0, 2.0, ez + oz, g)
    box(0.6, 1.0, 0.16, M.paintRed, ex + ox + 1.4, 2.0, ez + oz + 1.24, g)
    box(0.16, 1.0, 0.6, M.paintRed, ex + ox + 0.8, 2.0, ez + oz + 1.24, g)
    box(0.5, 0.3, 0.4, M.paintBlue, ex + ox - 2.6, 3.0, ez + oz, g)
    for (const sx of [-2.0, 2.0]) for (const sz of [-1.05, 1.05]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), M.charcoal)
      wh.rotation.x = Math.PI / 2
      add(wh, ex + ox + sx, 0.42, ez + oz + sz, g)
    }
  }
  // 分诊指示牌
  box(4.2, 0.9, 0.2, M.paintBlue, ex - 3, 3.6, ez + 16.6, g)
  for (let i = 0; i < 3; i++) box(3.2, 0.14, 0.06, M.roadPaint, ex - 3, 3.8 - i * 0.28, ez + 16.72, g)

  // ---------- 裙房屋顶 ----------
  parapet(g, PW, PD, PH + 1.2, M.whiteStone, 1.0, 0.34)
  for (const [px, pz] of [[-12, 2], [0, 2], [12, 2], [-10, -8], [10, -8]]) {
    box(4.4, 2.2, 3.4, M.aluPanel, px, PH + 2.3, pz, g)
    box(4.7, 0.18, 3.7, M.whiteStone, px, PH + 3.5, pz, g)
  }
  for (let i = 0; i < 8; i++) {
    for (let k = 0; k < 2; k++) {
      const pan = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 2.6), M.glDark)
      pan.position.set(-12 + i * 3.4, PH + 2.0, -10 + k * 3.2)
      pan.rotation.x = k ? 0.22 : -0.22
      g.add(pan)
    }
  }

  // ---------- 场地：停车 + 绿化 + 标识 ----------
  const pz2 = 36
  box(34, 0.1, 16, M.paving, 22, 0.05, pz2, g)
  for (let i = 0; i < 8; i++) box(0.14, 0.05, 5.0, M.roadPaint, 9 + i * 3.7, 0.13, pz2 + 1, g)
  for (let i = 0; i < 7; i++) carAt(g, 10.8 + i * 3.7, pz2 + 1.2, 0, [M.paintBlue, M.glazeWhite, M.charcoal, M.paintRed][i % 4])
  for (let i = 0; i < 4; i++) {
    box(0.14, 0.05, 5.0, M.roadPaint, -26 + i * 3.7, 0.13, pz2, g)
    if (i < 3) carAt(g, -24.2 + i * 3.7, pz2 + 1.4, 0, [M.glazeWhite, M.charcoal, M.paintBlue][i])
  }
  // 导视牌
  cyl(0.18, 0.22, 6.6, M.darkFrame, -30, 3.3, 17, 8, g)
  box(3.6, 2.2, 0.24, M.paintBlue, -30, 7.0, 17, g)
  for (let i = 0; i < 4; i++) box(2.9, 0.16, 0.06, M.roadPaint, -30, 7.7 - i * 0.42, 17.14, g)
  // 绿化 + 长椅 + 路灯
  for (let i = 0; i < 5; i++) treeAt(g, -34 + i * 13, 44, 1.0)
  for (let i = 0; i < 3; i++) treeAt(g, 30 + i * 7, -30 + i * 4, 0.9)
  for (const [bx, bz] of [[-16, 40], [6, 40], [26, 40]]) benchAt(g, bx, bz, 0)
  for (const [lx, lz, ry] of [[-22, 34, -1.2], [4, 34, 0], [30, 30, 1.2]]) lampPost(g, lx, lz, 6.0, ry)
  hedge(g, -40, 8, 40, false, 1.0, 1.2)
  return { g, top: TH + 8 }
}

/** 67 消防站 */
function t67(x, z) {
  const g = group(x, z, 0)
  const H = 7.6
  const w = 26
  const d = 16

  // 主楼：红砖 + 石勒脚 + 檐口
  box(w, H, d, M.brick, 0, H / 2, -2, g)
  box(w + 0.7, 1.1, d + 0.7, M.tuff, 0, 0.55, -2, g)
  box(w + 0.9, 0.7, d + 0.9, M.whiteStone, 0, H + 0.35, -2, g)
  box(w + 1.2, 0.26, d + 1.2, M.whiteStone, 0, H + 0.83, -2, g)
  gableRoof(g, w, d, H + 0.96, 3.0, M.tileRed, 0.72, 0)
  // 屋顶烟囱 + 通风帽
  box(1.2, 1.8, 1.2, M.brick, 8, H + 3.4, -2, g)
  box(1.4, 0.16, 1.4, M.whiteStone, 8, H + 4.36, -2, g)
  for (const px of [-8, -4]) cyl(0.34, 0.34, 1.4, M.aluDark, px, H + 2.6, -2, 8, g)

  // 二层拱窗
  for (let i = 0; i < 5; i++) {
    const px = -9.2 + i * 4.6
    archPanel(1.7, 2.6, 0.2, M.glSmoke, px, H - 2.9, 6.06, g)
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.14, 5, 14, Math.PI), M.whiteStone)
    add(arch, px, H - 1.6, 6.16, g)
    box(0.1, 2.6, 0.14, M.whiteStone, px, H - 2.9, 6.16, g)
    box(2.0, 0.16, 0.36, M.whiteStone, px, H - 4.3, 6.14, g)
  }
  // 一层小窗
  for (let i = 0; i < 4; i++) {
    win(g, -9.8 + i * 4.6, 2.6, 6.06, 0, 1.5, 1.4, { glass: M.glSmoke, frame: M.whiteStone, sill: true, sillMat: M.whiteStone })
  }

  // 三扇车库门：门洞 + 卷帘 + 门楣 + 雨篷
  for (let i = 0; i < 3; i++) {
    const px = -7.4 + i * 7.4
    box(6.4, 5.0, 0.3, M.charcoal, px, 2.5, 6.1, g)
    box(6.0, 4.5, 0.2, M.aluPanel, px, 2.25, 6.24, g)
    for (let k = 0; k < 9; k++) box(5.9, 0.1, 0.1, M.aluDark, px, 0.3 + k * 0.48, 6.36, g)
    box(6.9, 0.5, 0.6, M.whiteStone, px, 4.98, 6.2, g)
    box(2.0, 0.34, 0.16, M.paintRed, px, 5.5, 6.42, g)   // 门号
    box(7.2, 0.22, 0.24, M.paintRed, px, 6.1, 6.26, g)   // 红色标识带
    for (let k = 0; k < 5; k++) box(7.0, 0.14, 0.9 + k * 0.34, M.concrete, px, 0.07, 6.6 + k * 0.34, g)
  }
  // 主入口（侧边）
  box(2.4, 3.0, 0.26, M.teak, 11.8, 1.5, 6.06, g)
  box(1.0, 2.2, 0.1, M.glSmoke, 11.8, 1.7, 6.2, g)
  awning(g, 11.8, 4.2, 6.2, 3.4, 1.8, M.paintRed, 0)

  // 训练塔：砖塔 + 窗洞 + 栏杆 + 爬梯
  const tx = 12.0
  const tz = -8.5
  box(5.2, 17, 5.2, M.brick, tx, 8.5, tz, g)
  for (let k = 1; k < 5; k++) box(5.5, 0.26, 5.5, M.whiteStone, tx, k * 3.4, tz, g)
  box(5.7, 0.5, 5.7, M.whiteStone, tx, 17.2, tz, g)
  for (let k = 0; k < 5; k++) {
    for (const [ox, oz, ry] of [[1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2], [0, 1, 0], [0, -1, Math.PI]]) {
      if (oz !== 0 && k % 2 === 0) continue
      box(0.12, 1.8, 0.9, M.charcoal, tx + ox * 2.62, 2.4 + k * 3.4, tz + oz * 2.62, g).rotation.y = ry
    }
  }
  // 塔顶栏杆
  railing(g, 5.0, 17.5, tz + 2.7, M.brightSilver, 6, 1.0)
  railing(g, 5.0, 17.5, tz - 2.7, M.brightSilver, 6, 1.0)
  // 塔侧爬梯
  for (let k = 0; k < 10; k++) box(0.7, 0.07, 0.07, M.brightSilver, tx - 2.7, 1.2 + k * 1.7, tz - 2.4, g)
  box(0.07, 17, 0.07, M.brightSilver, tx - 3.0, 8.5, tz - 2.4, g)
  box(0.07, 17, 0.07, M.brightSilver, tx - 2.4, 8.5, tz - 2.4, g)

  // 旗杆 + 三面旗
  cyl(0.1, 0.14, 14, M.brightSilver, -13, 7, 9.5, 8, g)
  for (const [oy, col] of [[11.6, M.paintRed], [10.0, M.glazeWhite], [8.4, M.paintBlue]]) {
    box(1.9, 1.2, 0.08, col, -11.9, oy, 9.5, g)
  }

  // 消防车（两辆，带警灯与云梯）
  for (const px of [-7.4, 0.4]) {
    box(8.2, 2.8, 3.0, M.paintRed, px, 1.7, 10.4, g)
    box(8.4, 0.5, 3.1, M.paintRed, px, 3.25, 10.4, g)
    box(2.2, 1.2, 3.04, M.glSmoke, px - 2.6, 2.6, 10.4, g)
    box(0.9, 1.0, 3.04, M.glSmoke, px + 1.4, 2.6, 10.4, g)
    for (let i = 0; i < 4; i++) box(0.34, 0.16, 0.34, i % 2 ? M.paintBlue : M.glazeWhite, px - 3.4 + i * 2.2, 3.6, 10.4, g)
    // 云梯
    for (let i = 0; i < 7; i++) box(1.0, 0.1, 0.5, M.brightSilver, px - 3 + i * 1.1, 4.2 + i * 0.12, 10.4, g)
    for (const sx of [-2.9, 2.9]) for (const sz of [-1.25, 1.25]) cyl(0.52, 0.52, 0.42, M.charcoal, px + sx, 0.55, 10.4 + sz, 10, g)
    box(2.2, 0.16, 3.2, M.paving, px, 0.14, 10.4, g)
  }
  // 广场铺装 + 停车线 + 树
  box(30, 0.1, 8, M.paving, 0, 0.06, 14, g)
  for (let i = 0; i < 6; i++) box(0.12, 0.05, 5.0, M.roadPaint, -14 + i * 5.6, 0.13, 17.5, g)
  for (let i = 0; i < 4; i++) {
    const px = -17 + i * 8.6
    cyl(0.16, 0.22, 3.0, M.bark, px, 1.5, 20.5, 8, g)
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.3, 11, 8), M.leaf)
    c.scale.set(1, 1.1, 1)
    c.castShadow = true
    add(c, px, 3.8, 20.5, g)
  }
  return { g, top: H + 12 }
}

/** 68 政府办公楼 */
function t68(x, z) {
  const g = group(x, z, 0)
  const fh = 4.2
  const floors = 5
  const H = floors * fh

  box(28, H, 16, M.whiteStone, 0, H / 2, 0, g)
  box(28.8, 1.2, 16.8, M.tuff, 0, 0.6, 0, g)
  box(29.4, 0.8, 17.4, M.whiteStone, 0, H + 0.4, 0, g)
  // 中央突出体量 + 柱廊 + 檐部
  box(13, H + 3, 4.6, M.whiteStone, 0, (H + 3) / 2, 9.6, g)
  colonnade(g, 11, 0, H - 2.2, M.whiteStone, 11.6, 6, 0.56)
  box(13.4, 0.6, 5.0, M.whiteStone, 0, H + 3.3, 9.6, g)
  box(13.8, 0.24, 5.4, M.whiteStone, 0, H + 3.72, 9.6, g)
  steps(g, 15, 6, 0.3, 1.1, 0, M.whiteStone, 12.4)
  // 台阶两侧石墩
  for (const sx of [-1, 1]) {
    box(1.0, 1.2, 1.0, M.whiteStone, sx * 7.9, 0.6, 12.6, g)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), M.whiteStone)
    add(orb, sx * 7.9, 1.5, 12.6, g)
  }

  // 竖条窗（两侧各四）+ 层间线脚
  for (let f = 1; f < floors; f++) {
    const y = f * fh
    for (const sz of [-1, 1]) box(28.6, 0.16, 0.22, M.tuff, 0, y + fh - 0.08, sz * 8.06, g)
    for (const px of [-11.2, -8.2, 8.2, 11.2]) {
      win(g, px, y + 2.2, 8.06, 0, 1.5, 2.5, {
        glass: M.glSmoke, frame: M.charcoal, mull: 1, sill: true, sillMat: M.whiteStone,
      })
      box(1.9, 0.18, 0.3, M.whiteStone, px, y + 3.55, 8.1, g)
    }
  }
  // 女儿墙 + 屋面设备
  parapet(g, 28, 16, H + 0.8, M.whiteStone, 0.8, 0.3)
  box(5.0, 1.8, 4.0, M.aluPanel, -8, H + 1.7, -2, g)
  box(4.0, 1.4, 3.2, M.plasterGrey, 7, H + 1.5, -3, g)

  // 旗杆三根 + 广场铺装 + 花池
  for (const px of [-9, 0, 9]) {
    cyl(0.09, 0.13, 14, M.brightSilver, px, 7, 16, 8, g)
    box(1.8, 1.1, 0.08, M.paintRed, px + 1.0, 12.6, 16, g)
    cyl(0.5, 0.6, 0.4, M.whiteStone, px, 0.2, 16, 12, g)
  }
  box(26, 0.1, 7, M.paving, 0, 0.06, 15, g)
  for (let i = 0; i < 6; i++) box(0.1, 0.03, 6.8, M.curb, -12 + i * 4.8, 0.12, 15, g)
  for (const sx of [-1, 1]) planter(g, sx * 12.5, 11.5, 4, 1.6)
  return { g, top: H + 8 }
}

/** 69 法院（柱廊 + 山花 + 穹顶，跨 2×2 地块） */
function t69(x, z) {
  const g = group(x, z, 0)

  // ---------- 台基 ----------
  box(56, 2.0, 40, M.tuff, 0, 1.0, -2, g)
  box(58, 0.4, 42, M.whiteStone, 0, 2.2, -2, g)
  // 台基线脚
  box(56.4, 0.3, 40.4, M.whiteStone, 0, 1.7, -2, g)

  // ---------- 主体（三层 + 檐部） ----------
  const bz = -4
  box(46, 13.2, 30, M.whiteStone, 0, 2.4 + 6.6, bz, g)
  box(47.2, 1.2, 31.2, M.whiteStone, 0, 15.6, bz, g)          // 檐口
  box(47.6, 0.4, 31.6, M.tuff, 0, 16.3, bz, g)
  // 屋顶栏板
  for (const sz of [-1, 1]) {
    box(46, 1.2, 0.5, M.whiteStone, 0, 17.0, bz + sz * 15, g)
    for (let i = 0; i < 46; i += 1.6) box(0.4, 1.2, 0.4, M.whiteStone, -23 + i, 17.0, bz + sz * 15, g)
  }
  for (const sx of [-1, 1]) {
    box(0.5, 1.2, 30, M.whiteStone, sx * 23, 17.0, bz, g)
  }

  // ---------- 立面壁柱 + 窗 ----------
  for (let f = 0; f < 3; f++) {
    const y = 2.4 + f * 4.4
    for (let i = 0; i < 8; i++) {
      const px = -20 + i * 5.7
      if (Math.abs(px) > 12) {
        // 侧开间窗
        if (f === 0) {
          archPanel(2.3, 3.6, 0.24, M.glSmoke, px, y + 0.5, bz + 15.05, g)
          box(2.9, 0.34, 0.4, M.whiteStone, px, y + 0.32, bz + 15.2, g)
        } else {
          box(2.3, 2.6, 0.2, M.glSmoke, px, y + 2.0, bz + 15.04, g)
          box(2.9, 0.3, 0.4, M.whiteStone, px, y + 0.6, bz + 15.18, g)
          box(0.5, 0.34, 0.34, M.whiteStone, px, y + 3.4, bz + 15.2, g)
        }
        for (const ox of [-1.45, 1.45]) box(0.6, 4.2, 0.5, M.whiteStone, px + ox, y + 2.1, bz + 15.16, g)
      }
    }
    // 侧面窗
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const pz = bz - 12 + i * 6
        box(0.2, 2.6, 2.3, M.glSmoke, sx * 23.02, y + 2.0, pz, g)
        box(0.4, 0.3, 2.9, M.whiteStone, sx * 23.16, y + 0.6, pz, g)
        for (const oz of [-1.45, 1.45]) box(0.5, 4.2, 0.6, M.whiteStone, sx * 23.14, y + 2.1, pz + oz, g)
      }
    }
  }

  // ---------- 中央柱廊 + 山花 ----------
  const pz = bz + 15
  box(26, 1.0, 6.0, M.whiteStone, 0, 2.7, pz + 2.4, g)
  for (let i = 0; i < 9; i++) {
    const px = -10.4 + i * 2.6
    cyl(0.62, 0.7, 11.4, M.whiteStone, px, 2.4 + 5.7, pz + 3.2, 16, g)
    // 柱础 + 柱头
    box(1.5, 0.35, 1.5, M.whiteStone, px, 2.6, pz + 3.2, g)
    box(1.4, 0.5, 1.4, M.whiteStone, px, 13.5, pz + 3.2, g)
    for (let k = 0; k < 3; k++) box(1.2, 0.12, 1.2, M.whiteStone, px, 13.85 + k * 0.14, pz + 3.2, g)
  }
  // 檐部 + 山花
  box(27, 1.5, 6.4, M.whiteStone, 0, 14.6, pz + 3.0, g)
  box(27.6, 0.4, 6.8, M.tuff, 0, 15.5, pz + 3.0, g)
  pediment(g, 27, 5.4, 1.6, M.whiteStone, 15.7, pz + 3.0)
  // 山花浮雕 + 顶端雕像
  const tri = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 16), M.bronze)
  tri.rotation.x = Math.PI / 2
  add(tri, 0, 17.2, pz + 6.06, g)
  box(0.3, 2.6, 0.3, M.whiteStone, 0, 20.6, pz + 3.0, g)
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), M.gold)
  add(finial, 0, 22.1, pz + 3.0, g)
  // 大门（青铜双扉 + 门套）
  box(6.0, 8.0, 0.4, M.whiteStone, 0, 6.4, pz + 0.6, g)
  box(5.0, 7.2, 0.24, M.bronze, 0, 6.2, pz + 0.84, g)
  box(0.12, 7.2, 0.3, M.gold, 0, 6.2, pz + 0.98, g)
  for (const sx of [-1, 1]) box(1.9, 3.0, 0.1, M.gold, sx * 1.3, 7.2, pz + 0.98, g)
  box(6.8, 0.6, 0.6, M.whiteStone, 0, 10.6, pz + 0.7, g)

  // ---------- 穹顶 ----------
  cyl(8.4, 8.8, 6.4, M.whiteStone, 0, 17.0 + 3.2, bz - 4, 26, g)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    cyl(0.3, 0.3, 5.4, M.whiteStone, Math.cos(a) * 8.4, 20.2, bz - 4 + Math.sin(a) * 8.4, 8, g)
    box(0.3, 5.0, 0.3, M.glAmber, Math.cos(a) * 8.44, 20.2, bz - 4 + Math.sin(a) * 8.44, g)
  }
  cyl(9.2, 9.2, 0.5, M.whiteStone, 0, 23.6, bz - 4, 26, g)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8.6, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.copperAged)
  dome.position.set(0, 23.8, bz - 4)
  dome.scale.y = 0.86
  dome.castShadow = dome.receiveShadow = true
  g.add(dome)
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.14, 5, 20, Math.PI / 2), M.brightSilver)
    rib.position.set(0, 23.8, bz - 4)
    rib.rotation.y = (i / 6) * Math.PI * 2
    rib.rotation.z = 0
    g.add(rib)
  }
  cyl(2.0, 2.4, 2.6, M.whiteStone, 0, 31.6, bz - 4, 14, g)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    box(0.34, 1.8, 0.34, M.whiteStone, Math.cos(a) * 2.0, 31.6, bz - 4 + Math.sin(a) * 2.0, g)
  }
  cone(1.5, 2.2, M.copperAged, 0, 33.8, bz - 4, 10, g)
  box(0.14, 1.8, 0.14, M.gold, 0, 35.4, bz - 4, g)

  // ---------- 大台阶 + 两侧石墩 ----------
  steps(g, 30, 6, 0.34, 1.2, 2.0, M.whiteStone, pz + 6.2)
  for (let i = 0; i < 6; i++) box(30, 0.04, 1.0, M.tuff, 0, 2.0 - i * 0.34 + 0.16, pz + 6.2 + i * 1.2, g)
  for (const sx of [-1, 1]) {
    box(2.8, 2.4, 2.8, M.whiteStone, sx * 17.6, 1.2, pz + 8.4, g)
    box(3.2, 0.4, 3.2, M.whiteStone, sx * 17.6, 2.5, pz + 8.4, g)
    // 石狮
    const lion = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), M.whiteStone)
    lion.scale.set(1, 1.2, 1.3)
    add(lion, sx * 17.6, 3.6, pz + 8.4, g)
    box(1.2, 0.7, 1.8, M.whiteStone, sx * 17.6, 3.0, pz + 8.4, g)
  }
  // 台阶壁灯
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) {
      box(0.5, 1.1, 0.5, M.darkFrame, sx * 15.4, 3.4 + i * 0.9, pz + 5.4 - i * 1.2, g)
      box(0.36, 0.7, 0.36, M.glazeWhite, sx * 15.4, 3.4 + i * 0.9, pz + 5.4 - i * 1.2, g)
    }
  }

  // ---------- 前方广场 ----------
  paved(g, 0, 30, 56, 20, M.paving, 3.0, 'x')
  for (const [fx, fz] of [[-22, 26], [22, 26]]) {
    cyl(4.4, 4.8, 0.7, M.whiteStone, fx, 0.35, fz, 26, g)
    cyl(4.0, 4.0, 0.1, M.glTeal, fx, 0.74, fz, 26, g)
    cyl(2.6, 2.8, 0.5, M.whiteStone, fx, 0.85, fz, 22, g)
    cyl(0.6, 0.8, 1.8, M.whiteStone, fx, 1.9, fz, 12, g)
    cyl(1.4, 1.2, 0.24, M.whiteStone, fx, 2.9, fz, 18, g)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      cyl(0.08, 0.08, 0.6, M.glazeWhite, fx + Math.cos(a) * 2.2, 3.1, fz + Math.sin(a) * 2.2, 5, g)
    }
  }
  // 旗杆 + 防撞柱 + 长椅 + 树 + 灯
  for (const px of [-8, 0, 8]) {
    cyl(0.09, 0.13, 15, M.brightSilver, px, 7.5, 25, 8, g)
    box(2.0, 1.2, 0.08, M.paintRed, px + 1.1, 13.2, 25, g)
    cyl(0.6, 0.7, 0.4, M.whiteStone, px, 0.2, 25, 12, g)
  }
  for (let i = 0; i < 12; i++) {
    for (const sz of [-1, 1]) cyl(0.18, 0.18, 0.9, M.darkFrame, -28 + i * 5.0, 0.45, 32 + sz * 1.4, 8, g)
  }
  for (const [bx, bz2] of [[-30, 36], [30, 36], [-14, 39], [14, 39]]) benchAt(g, bx, bz2, Math.PI)
  for (let i = 0; i < 5; i++) treeAt(g, -30 + i * 15, 43, 1.0)
  for (const [lx, lz] of [[-34, 30], [34, 30], [-24, 40], [24, 40]]) lampPost(g, lx, lz, 7.0, 0)
  return { g, top: 37 }
}

/** 70 小市政厅（钟塔 + 四面立面 + 门廊广场） */
function t70(x, z) {
  const g = group(x, z, 0.14)
  const H = 9.5
  const W = 20
  const D = 13

  // 台基 + 勒脚
  box(W + 2.4, 0.5, D + 2.4, M.tuff, 0, 0.25, 0, g)
  box(W + 0.6, 1.0, D + 0.6, M.whiteStone, 0, 0.85, 0, g)
  // 主体
  box(W, H, D, M.plasterWarm, 0, H / 2 + 0.6, 0, g)
  // 壁柱（四角 + 正立面分间）
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.7, H, 0.7, M.whiteStone, sx * (W / 2 - 0.3), H / 2 + 0.6, sz * (D / 2 - 0.3), g)
  }
  for (const px of [-7, -3.4, 3.4, 7]) {
    for (const sz of [-1, 1]) box(0.42, H - 1.0, 0.3, M.whiteStone, px, (H - 1.0) / 2 + 1.1, sz * (D / 2 + 0.1), g)
  }
  for (const pz of [-3.4, 3.4]) {
    for (const sx of [-1, 1]) box(0.3, H - 1.0, 0.42, M.whiteStone, sx * (W / 2 + 0.1), (H - 1.0) / 2 + 1.1, pz, g)
  }
  // 腰线（两层分隔）+ 檐口 + 齿饰
  box(W + 0.5, 0.34, D + 0.5, M.whiteStone, 0, 5.5, 0, g)
  box(W + 1.2, 0.7, D + 1.2, M.whiteStone, 0, H + 0.95, 0, g)
  for (let i = 0; i < 26; i++) {
    for (const sz of [-1, 1]) box(0.34, 0.28, 0.2, M.whiteStone, -W / 2 + 0.6 + i * 0.76, H + 0.55, sz * (D / 2 + 0.66), g)
  }
  gableRoof(g, W, D, H + 1.3, 3.0, M.tileRed, 0.7)

  // 窗：两排 × 四面（正面 5 樘，侧背 3 樘）
  const bay = (px, pz, ry, ww = 1.7, hh = 2.2, yy = 0) => {
    const s = new THREE.Group()
    s.position.set(px, yy, pz)
    s.rotation.y = ry
    g.add(s)
    box(ww + 0.5, hh + 0.5, 0.14, M.whiteStone, 0, 0, 0, s)
    box(ww, hh, 0.1, M.glSmoke, 0, 0, 0.09, s)
    box(0.07, hh, 0.1, M.darkFrame, 0, 0, 0.14, s)
    box(ww, 0.07, 0.1, M.darkFrame, 0, hh * 0.2, 0.14, s)
    box(ww + 0.72, 0.14, 0.32, M.whiteStone, 0, -hh / 2 - 0.28, 0.08, s)
    // 窗顶小拱饰
    const arc = new THREE.Mesh(new THREE.TorusGeometry(ww / 2 + 0.2, 0.09, 5, 14, Math.PI), M.whiteStone)
    arc.position.set(0, hh / 2 + 0.32, 0.06)
    s.add(arc)
  }
  const rows = [2.6, 6.9]
  for (const yy of rows) {
    for (let i = 0; i < 5; i++) bay(-7.2 + i * 3.6, D / 2 + 0.16, 0, 1.7, 2.1, yy)
    for (let i = 0; i < 5; i++) bay(-7.2 + i * 3.6, -D / 2 - 0.16, Math.PI, 1.7, 2.1, yy)
    for (let i = 0; i < 3; i++) {
      const pz = -3.6 + i * 3.6
      bay(W / 2 + 0.16, pz, Math.PI / 2, 1.6, 2.1, yy)
      bay(-W / 2 - 0.16, pz, -Math.PI / 2, 1.6, 2.1, yy)
    }
  }
  // 背面山墙圆窗（山花）
  const ocl = new THREE.Mesh(new THREE.CircleGeometry(1.0, 18), M.glSmoke)
  add(ocl, 0, H + 2.6, -D / 2 + 0.02, g)
  const oring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 6, 20), M.whiteStone)
  add(oring, 0, H + 2.6, -D / 2 - 0.06, g)

  // 门廊 + 台阶 + 雨篷 + 匾额
  colonnade(g, 7.0, 1.35, 4.4, M.whiteStone, D / 2 + 2.6, 4, 0.34)
  box(8.4, 0.3, 3.6, M.whiteStone, 0, 5.9, D / 2 + 2.6, g)
  box(8.8, 0.6, 3.9, M.whiteStone, 0, 6.3, D / 2 + 2.6, g)
  pediment(g, 8.8, 1.5, 1.0, M.whiteStone, 6.6, D / 2 + 2.6)
  box(8, 4.6, 1.2, M.whiteStone, 0, 2.95, D / 2 + 1.4, g)
  archPanel(2.8, 3.6, 0.3, M.teak, 0, 1.1, D / 2 + 2.02, g)
  steps(g, 8.8, 3, 0.3, 0.6, 0.5, M.whiteStone, D / 2 + 4.4)
  box(3.6, 0.44, 0.1, M.charcoal, 0, 5.5, D / 2 + 2.02, g)
  // 门厅壁灯 + 旗杆
  for (const sx of [-1, 1]) {
    cyl(0.16, 0.22, 0.5, M.glazeWhite, sx * 3.3, 4.2, D / 2 + 3.0, 8, g)
    cyl(0.09, 0.09, 0.9, M.aluDark, sx * 3.3, 4.75, D / 2 + 3.0, 6, g)
  }
  for (const sx of [-1, 1]) {
    cyl(0.16, 0.2, 7.0, M.brightSilver, sx * 8.4, 4.0, D / 2 + 6.4, 8, g)
    box(0.05, 1.4, 2.2, sx > 0 ? M.paintBlue : M.paintRed, sx * 8.4 + 0.05, 6.4, D / 2 + 7.5, g)
  }

  // 钟塔（四角壁柱 + 百叶钟层 + 四面钟 + 铜顶）
  const TX = 4
  const TZ = -1
  const TH = 18
  box(5.0, TH, 5.0, M.plasterWarm, 0, TH / 2 + 0.6, 0, g)
  box(5.0, TH, 5.0, M.plasterWarm, TX, TH / 2 + 0.6, TZ, g)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.55, TH, 0.55, M.whiteStone, TX + sx * 2.3, TH / 2 + 0.6, TZ + sz * 2.3, g)
  }
  box(5.8, 0.5, 5.8, M.whiteStone, TX, 15.4, TZ, g)
  box(6.0, 0.7, 6.0, M.whiteStone, TX, TH + 0.6, TZ, g)
  // 钟层面：四面钟盘
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
    const cx = TX + dx * 2.52, cz = TZ + dz * 2.52
    const dial = new THREE.Mesh(new THREE.CircleGeometry(1.35, 22), M.glazeWhite)
    dial.position.set(cx, 13.6, cz)
    dial.rotation.y = ry
    g.add(dial)
    const bez = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.14, 6, 24), M.whiteStone)
    bez.position.set(cx, 13.6, cz)
    bez.rotation.y = ry
    g.add(bez)
    const hh = box(0.15, 0.88, 0.06, M.charcoal, cx + dx * 0.07, 14.0, cz + dz * 0.07, g)
    hh.rotation.y = ry
    const mm = box(0.11, 1.2, 0.06, M.charcoal, cx + dx * 0.07, 14.25, cz + dz * 0.07, g)
    mm.rotation.y = ry
    mm.rotation.z = 0.6
    // 百叶
    box(1.7, 1.3, 0.14, M.darkFrame, cx + dx * 0.05, 16.7, cz + dz * 0.05, g)
    for (let k = 0; k < 4; k++) box(1.55, 0.1, 0.18, M.bronze, cx + dx * 0.09, 16.3 + k * 0.26, cz + dz * 0.09, g)
  }
  hipRoof(g, 5.0, 5.0, TH + 1.0, 5.0, M.copperAged, 0.6, TX, TZ)
  cyl(0.09, 0.11, 1.4, M.bronze, TX, TH + 6.6, TZ, 6, g)
  box(0.05, 0.08, 1.6, M.bronze, TX, TH + 7.0, TZ, g)
  const orb2 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M.gold)
  add(orb2, TX, TH + 7.4, TZ, g)

  // 屋面设备
  box(3.6, 1.8, 2.6, M.aluPanel, -6, H + 3.0, -2, g)
  cyl(0.9, 0.9, 1.6, M.brick, -6, H + 4.4, -2, 12, g)
  for (let i = 0; i < 4; i++) box(3.4, 0.06, 0.06, M.darkFrame, -6, H + 2.4 + i * 0.26, -0.66, g)
  // 落水管
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) downpipe(g, sx * (W / 2 + 0.34), sz * (D / 2 + 0.34), H + 1.0)

  // 前广场：铺装 / 绿篱 / 树 / 长椅 / 灯
  paved(g, 0, D / 2 + 8.4, 30, 12, M.paving, 3.4, 'x')
  box(6.0, 0.16, 3.0, M.whiteStone, 0, 0.1, D / 2 + 5.4, g)
  for (const sx of [-1, 1]) {
    hedge(g, sx * 9.4, D / 2 + 12.2, 9, true, 0.85, 1.0)
    for (let i = 0; i < 2; i++) treeAt(g, sx * (11.2 + i * 4.0), D / 2 + 4.2, 0.95, 3.3, i % 2 ? 'column' : null)
    benchAt(g, sx * 7.2, D / 2 + 6.0, sx * Math.PI / 2)
    lampPost(g, sx * 13.0, D / 2 + 9.4, 4.6, 0)
  }
  // 侧巷绿化 + 铺装
  for (const sx of [-1, 1]) {
    box(6.0, 0.14, 20, M.paving, sx * 14.0, 0.07, 0, g)
    for (let i = 0; i < 2; i++) bushAt(g, sx * 15.2, -4.0 + i * 8.0, 0.6)
  }
  return { g, top: TH + 10 }
}

/** 71 银行大楼 */
function t71(x, z) {
  const g = group(x, z, 0)
  const fh = 3.9
  const floors = 12
  const H = floors * fh

  // 石材基座（营业厅）
  box(22, 9, 17, M.tuff, 0, 4.5, 0, g)
  box(22.8, 1.2, 17.8, M.tuff, 0, 0.6, 0, g)
  box(22.6, 0.8, 17.6, M.whiteStone, 0, 9.35, 0, g)
  // 石材分缝
  for (let i = 0; i < 6; i++) {
    for (const sz of [-1, 1]) box(22.04, 0.05, 0.1, M.whiteStone, 0, 1.6 + i * 1.25, sz * 8.53, g)
    for (const sx of [-1, 1]) box(0.1, 0.05, 17.04, M.whiteStone, sx * 11.03, 1.6 + i * 1.25, 0, g)
  }
  // 通高营业厅玻璃 + 竖梃
  for (const sz of [-1, 1]) {
    box(16, 5.6, 0.16, M.glSmoke, 0, 4.2, sz * 8.56, g)
    for (let i = 0; i <= 8; i++) box(0.14, 5.6, 0.2, M.bronze, -8 + i * 2, 4.2, sz * 8.62, g)
    box(16.2, 0.2, 0.3, M.bronze, 0, 7.1, sz * 8.6, g)
    box(16.2, 0.2, 0.3, M.bronze, 0, 1.4, sz * 8.6, g)
  }
  // 柱廊 + 柱头细节 + 檐部
  colonnade(g, 17, 0, 8.4, M.whiteStone, 9.0, 6, 0.5)
  box(18.0, 0.9, 2.2, M.whiteStone, 0, 9.0, 9.0, g)
  box(18.4, 0.24, 2.6, M.whiteStone, 0, 9.54, 9.0, g)
  // 入口铜门 + 雨篷 + 台阶 + 石墩
  box(4.6, 4.4, 0.3, M.bronze, 0, 2.2, 8.7, g)
  box(4.0, 3.9, 0.14, M.glDark, 0, 2.15, 8.86, g)
  box(0.09, 3.9, 0.18, M.gold, 0, 2.15, 8.94, g)
  box(6.4, 0.4, 3.4, M.bronze, 0, 5.6, 9.8, g)
  for (const sx of [-1, 1]) cyl(0.16, 0.16, 5.4, M.gold, sx * 2.7, 2.7, 11.2, 8, g)
  steps(g, 18, 4, 0.3, 1.0, 0, M.whiteStone, 9.8)
  for (const sx of [-1, 1]) {
    box(1.1, 1.4, 1.1, M.whiteStone, sx * 8.4, 0.7, 10.4, g)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 8), M.gold)
    add(orb, sx * 8.4, 1.72, 10.4, g)
  }

  // 上部塔身：青铜玻璃 + 金色层线/竖梃
  box(18, H - 9, 14, M.glBronze, 0, 9 + (H - 9) / 2, 0, g)
  for (let f = 4; f < floors; f++) {
    const y = f * fh
    box(18.3, 0.24, 14.3, M.gold, 0, y, 0, g)
    for (let i = 0; i <= 7; i++) {
      const px = -8.4 + i * 2.4
      box(0.12, fh, 0.12, M.gold, px, y + fh / 2, 7.06, g)
      box(0.12, fh, 0.12, M.gold, px, y + fh / 2, -7.06, g)
    }
    for (const sx of [-1, 1]) box(0.12, fh, 0.12, M.gold, sx * 9.06, y + fh / 2, 0, g)
  }
  box(18.7, 1.0, 14.7, M.gold, 0, H + 0.5, 0, g)
  box(19.1, 0.3, 15.1, M.bronze, 0, H + 1.12, 0, g)
  // 屋顶标识塔 + 旗杆 + 设备
  box(4.2, 3.4, 3.2, M.gold, -4.4, H + 2.8, 0, g)
  box(4.4, 0.24, 3.4, M.bronze, -4.4, H + 4.6, 0, g)
  box(9, 1.5, 0.34, M.glazeWhite, 3.4, H + 2.6, 7.0, g)
  box(9.4, 0.2, 0.5, M.gold, 3.4, H + 3.4, 7.0, g)
  cyl(0.08, 0.12, 10, M.brightSilver, 8.4, 5, 7.6, 8, g)
  box(1.5, 0.9, 0.08, M.paintRed, 9.2, 9.2, 7.6, g)

  // 广场：铺装分格 + 花池 + 树
  box(28, 0.1, 7, M.paving, 0, 0.06, 14.4, g)
  for (let i = 0; i < 7; i++) box(0.1, 0.03, 6.8, M.curb, -14 + i * 4.6, 0.12, 14.4, g)
  for (const sx of [-1, 1]) planter(g, sx * 13.5, 12.4, 3.6, 1.5)
  for (let i = 0; i < 4; i++) {
    const tx = -15 + i * 10
    cyl(0.18, 0.24, 3.4, M.bark, tx, 1.7, 17.4, 8, g)
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.5, 11, 8), M.leaf)
    c.scale.set(1, 1.1, 1)
    c.castShadow = true
    add(c, tx, 4.4, 17.4, g)
  }
  return { g, top: H + 5 }
}

/** 72 佛寺（山门 + 钟鼓楼 + 大雄宝殿，跨 2×2 地块） */
function t72(x, z) {
  const g = group(x, z, 0)

  // ---------- 院墙（红墙青瓦） ----------
  for (const sx of [-1, 1]) {
    box(0.8, 4.2, 86, M.paintRed, sx * 40, 2.1, 1, g)
    box(1.5, 0.4, 86.4, M.darkTile, sx * 40, 4.4, 1, g)
    box(1.0, 0.5, 86.4, M.tuff, sx * 40, 0.25, 1, g)
  }
  for (const [cx, len, ry] of [[-22, 36, 0], [22, 36, 0]]) {
    box(len, 4.2, 0.8, M.paintRed, cx, 2.1, -42, g)
    box(len + 0.4, 0.4, 1.5, M.darkTile, cx, 4.4, -42, g)
  }
  box(80, 4.2, 0.8, M.paintRed, 0, 2.1, -42, g)
  box(80.4, 0.4, 1.5, M.darkTile, 0, 4.4, -42, g)
  // 南墙（山门两侧）
  for (const cx of [-27, 27]) {
    box(26, 4.2, 0.8, M.paintRed, cx, 2.1, 44, g)
    box(26.4, 0.4, 1.5, M.darkTile, cx, 4.4, 44, g)
  }

  // ---------- 山门 ----------
  tradHall(g, 0, 40, { w: 16, d: 8, wallH: 4.6, roofH: 3.2, doors: 3, wallMat: M.paintRed, over: 1.5, colMat: M.paintRed })
  for (let k = 0; k < 3; k++) box(11, 0.22, 0.8, M.whiteStone, 0, 0.7 - k * 0.22, 45.2 + k * 0.8, g)
  // 匾额 + 金刚像（门洞内暗部）
  box(4.4, 1.1, 0.3, M.gold, 0, 5.4, 44.1, g)
  for (const sx of [-1, 1]) {
    box(3.2, 3.4, 1.0, M.charcoal, sx * 4.6, 2.4, 42.8, g)
    const st = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), M.gold)
    add(st, sx * 4.6, 4.0, 43.4, g)
  }
  // 石狮一对
  for (const sx of [-1, 1]) {
    box(1.3, 1.6, 1.3, M.whiteStone, sx * 8.4, 0.8, 46.6, g)
    const lion = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), M.whiteStone)
    lion.scale.set(1, 1.25, 1)
    add(lion, sx * 8.4, 2.1, 46.6, g)
  }

  // ---------- 放生池 + 石桥 ----------
  {
    const pz = 31
    box(24, 0.6, 12, M.tuff, 0, 0.3, pz, g)
    box(22, 0.1, 10, M.glTeal, 0, 0.62, pz, g)
    for (const sz of [-1, 1]) box(24, 0.5, 0.9, M.whiteStone, 0, 0.85, pz + sz * 5.6, g)
    for (const sx of [-1, 1]) box(0.9, 0.5, 12, M.whiteStone, sx * 11.6, 0.85, pz, g)
    // 石拱桥
    box(4.0, 0.4, 13, M.whiteStone, 0, 1.1, pz, g)
    for (const sx of [-1, 1]) box(0.24, 0.9, 13, M.whiteStone, sx * 2.0, 1.7, pz, g)
    for (let i = 0; i < 6; i++) {
      for (const sx of [-1, 1]) box(0.34, 1.2, 0.34, M.whiteStone, sx * 2.0, 1.85, pz - 5 + i * 2.0, g)
    }
    // 睡莲 + 石灯
    for (let i = 0; i < 4; i++) {
      const lx = -8 + i * 5.2
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12), M.leaf)
      pad.rotation.x = -Math.PI / 2
      add(pad, lx, 0.7, pz + 2.8, g)
    }
  }

  // ---------- 钟楼 / 鼓楼 ----------
  for (const sx of [-1, 1]) {
    const bx = sx * 26
    const bz = 30
    box(9, 0.8, 9, M.tuff, bx, 0.4, bz, g)
    box(8, 5.0, 8, M.paintRed, bx, 3.3, bz, g)
    // 下层券门
    box(3.0, 3.6, 0.3, M.charcoal, bx, 2.6, bz + 4.0, g)
    // 平座栏杆
    box(9.4, 0.3, 9.4, M.whiteStone, bx, 6.0, bz, g)
    railing(g, 9.0, 6.15, bz + 4.5, M.paintRed, 8, 0.8)
    railing(g, 9.0, 6.15, bz - 4.5, M.paintRed, 8, 0.8)
    // 上层
    box(6.4, 3.6, 6.4, M.paintRed, bx, 8.0, bz, g)
    for (let k = 0; k < 4; k++) box(1.8, 2.0, 0.12, M.glAmber, bx - 2.0 + k * 1.3, 8.2, bz + 3.24, g)
    bracketBand(g, 6.4, 6.4, 9.9, M.gold, 5, 5)
    cnHipRoof(g, 8.6, 8.6, 10.1, 3.2, M.darkTile, 1.2, bx, bz, { bells: true })
    cyl(0.3, 0.4, 0.8, M.gold, bx, 13.6, bz, 10, g)
    // 钟 / 鼓
    if (sx > 0) {
      cyl(1.0, 1.3, 1.8, M.bronze, bx, 6.9, bz, 14, g)
      box(2.0, 0.14, 0.14, M.teak, bx, 8.0, bz, g)
    } else {
      cyl(1.2, 1.2, 1.3, M.paintRed, bx, 6.8, bz, 16, g)
    }
  }

  // ---------- 天王殿 ----------
  tradHall(g, 0, 18, { w: 20, d: 8, wallH: 4.4, roofH: 3.0, doors: 3, wallMat: M.paintRed, over: 1.4 })
  box(5.0, 1.0, 0.26, M.gold, 0, 5.0, 22.1, g)
  for (const sx of [-1, 1]) {
    box(1.2, 1.2, 0.26, M.glAmber, sx * 7.4, 4.2, 22.1, g)
    box(1.6, 0.6, 0.4, M.tuff, sx * 7.4, 7.1, 22.0, g)
  }

  // ---------- 东西配殿 ----------
  tradHall(g, 26, -2, { w: 20, d: 7, wallH: 4.0, roofH: 2.8, doors: 5, ry: Math.PI / 2, wallMat: M.paintRed, over: 1.3 })
  tradHall(g, -26, -2, { w: 20, d: 7, wallH: 4.0, roofH: 2.8, doors: 5, ry: -Math.PI / 2, wallMat: M.paintRed, over: 1.3 })

  // ---------- 大雄宝殿（三层台基 + 重檐） ----------
  const bz = -16
  box(36, 0.7, 24, M.whiteStone, 0, 0.35, bz, g)
  box(32, 0.7, 21, M.whiteStone, 0, 1.05, bz, g)
  box(28, 0.8, 18, M.whiteStone, 0, 1.8, bz, g)
  // 三面台阶 + 御路石
  for (let k = 0; k < 3; k++) {
    box(10, 0.26, 1.0, M.whiteStone, 0, 0.65 - k * 0.26, bz + 13.2 + k * 1.0, g)
  }
  box(3.2, 0.2, 4.0, M.marble, 0, 0.9, bz + 13.6, g)
  // 殿身 + 前廊柱
  box(22, 7.2, 13, M.paintRed, 0, 2.2 + 3.6, bz, g)
  for (let i = 0; i < 8; i++) {
    cyl(0.4, 0.44, 7.4, M.paintRed, -10.5 + i * 3.0, 2.2 + 3.7, bz + 7.4, 12, g)
    box(0.9, 0.24, 0.9, M.whiteStone, -10.5 + i * 3.0, 2.3, bz + 7.4, g)
  }
  // 格扇门 + 匾额
  for (let i = 0; i < 6; i++) {
    box(2.6, 5.0, 0.16, M.teak, -7.5 + i * 3.0, 2.2 + 2.5, bz + 6.6, g)
    for (let k = 0; k < 7; k++) box(2.4, 0.1, 0.08, M.darkFrame, -7.5 + i * 3.0, 2.9 + k * 0.62, bz + 6.7, g)
  }
  box(6.4, 1.5, 0.3, M.gold, 0, 9.4, bz + 6.7, g)
  // 下檐 + 斗拱
  bracketBand(g, 22, 13, 9.9, M.gold, 9, 6)
  hippedRoof(g, 25, 16, 10.1, 3.0, M.darkTile, 2.6, 0, bz, { bells: true })
  // 上层殿身 + 上檐 + 宝顶（先补一圈腰檐收口，避免上下层脱开）
  box(16.4, 0.8, 10.4, M.paintRed, 0, 12.1, bz, g)
  box(17.0, 0.22, 11.0, M.gold, 0, 12.55, bz, g)
  box(15, 4.0, 9, M.paintRed, 0, 14.2, bz, g)
  for (let i = 0; i < 4; i++) box(2.0, 2.2, 0.14, M.glAmber, -4.8 + i * 3.2, 14.4, bz + 4.56, g)
  bracketBand(g, 15, 9, 16.3, M.gold, 7, 4)
  hippedRoof(g, 18, 12, 16.5, 4.6, M.darkTile, 1.8, 0, bz, { bells: true })
  cyl(0.6, 0.85, 1.4, M.gold, 0, 22.0, bz, 12, g)
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), M.gold)
  orb.castShadow = true
  add(orb, 0, 23.4, bz, g)
  cone(0.55, 2.0, M.gold, 0, 25.0, bz, 12, g)
  // 月台陈设：香炉 + 石灯 + 幡杆
  cyl(1.6, 2.0, 1.5, M.bronze, 0, 2.6, bz + 11.0, 16, g)
  cyl(1.3, 1.5, 0.5, M.bronze, 0, 3.5, bz + 11.0, 16, g)
  for (const sx of [-1, 1]) {
    cyl(0.16, 0.2, 9.0, M.teak, sx * 9, 2.2 + 4.5, bz + 11.6, 8, g)
    box(1.4, 3.0, 0.1, M.paintYell, sx * 9.6, 6.6, bz + 11.6, g)
    // 石灯
    box(1.0, 0.4, 1.0, M.tuff, sx * 13, 0.2 + 2.2, bz + 10.6, g)
    cyl(0.26, 0.32, 1.4, M.tuff, sx * 13, 3.0, bz + 10.6, 8, g)
    box(0.9, 0.9, 0.9, M.tuff, sx * 13, 4.1, bz + 10.6, g)
    hipRoof(g, 1.2, 1.2, 4.55, 0.6, M.tuff, 0.22, sx * 13, bz + 10.6)
  }

  // ---------- 藏经楼（后，两层） ----------
  tradHall(g, 0, -35, { w: 22, d: 8, wallH: 4.2, roofH: 2.9, doors: 5, wallMat: M.paintRed, over: 1.3 })
  box(20.4, 0.6, 7.4, M.paintRed, 0, 8.5, -35, g)
  box(19, 4.0, 6.4, M.paintRed, 0, 10.6, -35, g)
  for (let i = 0; i < 5; i++) box(2.2, 1.8, 0.12, M.glAmber, -7.2 + i * 3.6, 10.8, -31.76, g)
  hippedRoof(g, 21, 8.4, 12.8, 2.6, M.darkTile, 1.2, 0, -35, { bells: true })
  for (let i = 0; i < 5; i++) box(2.0, 1.8, 0.14, M.glAmber, -7.4 + i * 3.7, 10.8, -31.6, g)
  box(6.6, 0.5, 0.6, M.whiteStone, 0, 8.4, -31.2, g)

  // ---------- 回廊 ----------
  corridor(g, 14, 6, 28, Math.PI / 2)
  corridor(g, -14, 6, 28, Math.PI / 2)

  // ---------- 院内铺地 / 银杏 / 碑亭 ----------
  paved(g, 0, 8, 60, 68, M.paving, 3.0, 'x')
  paved(g, 0, 5, 8, 76, M.whiteStone, 1.6, 'z')
  treeAt(g, -16, 8, 1.7, 4.2)
  treeAt(g, 16, 8, 1.7, 4.2)
  treeAt(g, -30, -26, 1.3, 3.4)
  treeAt(g, 30, -26, 1.3, 3.4)
  // 碑亭
  for (const sx of [-1, 1]) {
    const px = sx * 35
    box(4.4, 0.5, 4.4, M.tuff, px, 0.25, 38, g)
    for (const ox of [-1.6, 1.6]) for (const oz of [-1.6, 1.6]) cyl(0.2, 0.22, 3.4, M.paintRed, px + ox, 1.9, 38 + oz, 8, g)
    box(1.6, 2.6, 0.5, M.marble, px, 1.9, 38, g)
    cnHipRoof(g, 4.6, 4.6, 3.6, 1.8, M.darkTile, 0.7, px, 38, { bells: false })
  }
  return { g, top: 30 }
}

/** 73 七级八角佛塔（须弥座 + 平座 + 斗拱 + 角铃 + 塔刹） */
function t73(x, z) {
  const g = group(x, z, 0)

  // ---------- 寺院小院 ----------
  paved(g, 0, 4, 36, 34, M.paving, 2.8, 'x')
  for (const sx of [-1, 1]) {
    box(0.5, 2.6, 30, M.plasterGrey, sx * 16, 1.3, 2, g)
    box(0.9, 0.3, 30.2, M.darkTile, sx * 16, 2.7, 2, g)
    box(0.7, 0.26, 30.2, M.tuff, sx * 16, 0.13, 2, g)
  }

  // ---------- 须弥座（三层台基 + 石栏 + 四面台阶） ----------
  const base = [[19, 1.0], [16.4, 0.9], [14.0, 0.9]]
  let by = 0
  for (const [bw, bh] of base) {
    box(bw, bh, bw, M.whiteStone, 0, by + bh / 2, 0, g)
    box(bw + 0.5, 0.18, bw + 0.5, M.tuff, 0, by + bh, 0, g)
    by += bh
  }
  // 石栏 + 望柱
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const px = -9 + i * 3
      box(0.34, 1.1, 0.34, M.whiteStone, px, by + 0.55, sz * 9.6, g)
      box(0.24, 0.7, 2.7, M.whiteStone, px + 1.5, by + 0.5, sz * 9.6, g)
    }
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const pz = -9 + i * 3
      box(0.34, 1.1, 0.34, M.whiteStone, sx * 9.6, by + 0.55, pz, g)
      box(2.7, 0.7, 0.24, M.whiteStone, sx * 9.6, by + 0.5, pz + 1.5, g)
    }
  }
  // 四面踏跺
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let k = 0; k < 4; k++) {
      box(sx ? 0.9 : 7.4 - k * 0.2, 0.24, sz ? 0.9 : 7.4 - k * 0.2,
        M.whiteStone, sx * (9.4 + k * 0.9), 0.98 - k * 0.24, sz * (9.4 + k * 0.9), g)
    }
  }
  // 转角石灯
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(1.0, 0.4, 1.0, M.tuff, sx * 8.0, by + 0.2, sz * 8.0, g)
    cyl(0.24, 0.3, 1.3, M.tuff, sx * 8.0, by + 1.05, sz * 8.0, 8, g)
    box(0.86, 0.86, 0.86, M.tuff, sx * 8.0, by + 2.1, sz * 8.0, g)
    hipRoof(g, 1.1, 1.1, by + 2.55, 0.55, M.tuff, 0.2, sx * 8.0, sz * 8.0)
  }

  // ---------- 塔身七级 ----------
  let y = by
  let w = 11.2
  for (let i = 0; i < 7; i++) {
    const hb = 3.1 - i * 0.1
    // 塔身（八角）
    const body = cyl(w / 2, w / 2, hb, M.plasterWarm, 0, y + hb / 2, 0, 8, g)
    body.rotation.y = Math.PI / 8
    // 转角倚柱
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8
      cyl(0.16, 0.18, hb, M.paintRed, Math.cos(a) * (w / 2 - 0.08), y + hb / 2, Math.sin(a) * (w / 2 - 0.08), 6, g)
    }
    // 四面壸门 / 直棂窗
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
      const s = new THREE.Group()
      s.position.set(dx * w * 0.465, y, dz * w * 0.465)
      s.rotation.y = ry
      g.add(s)
      // 券门 + 门套
      archPanel(1.5, 2.0, 0.16, M.glAmber, 0, 0.35, 0.05, s)
      box(2.0, 0.22, 0.24, M.paintRed, 0, 2.45, 0.06, s)
      box(0.22, 2.2, 0.24, M.paintRed, -0.95, 1.35, 0.06, s)
      box(0.22, 2.2, 0.24, M.paintRed, 0.95, 1.35, 0.06, s)
    }
    // 额枋（八角）+ 斗拱一圈
    const eaveRing = cyl(w * 0.56, w * 0.56, 0.28, M.paintRed, 0, y + hb - 0.12, 0, 8, g)
    eaveRing.rotation.y = Math.PI / 8
    bracketBand(g, w * 0.72, w * 0.72, y + hb - 0.44, M.darkTile, Math.max(4, Math.round(w / 1.8)), Math.max(4, Math.round(w / 1.8)))
    // 出檐（八角攒尖 + 瓦垄 + 戗脊 + 角铃）
    cnHipRoof(g, w * 1.02, w * 1.02, y + hb + 0.02, 1.1, M.darkTile, 1.35, 0, 0, { bells: true, finial: false })
    // 平座（塔檐上的八角栏杆，供上层）
    const py = y + hb + 1.0
    const deck = cyl(w * 0.5, w * 0.5, 0.26, M.whiteStone, 0, py, 0, 8, g)
    deck.rotation.y = Math.PI / 8
    const RR = w * 0.46
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8
      box(0.16, 0.72, 0.16, M.paintRed, Math.cos(a) * RR, py + 0.48, Math.sin(a) * RR, g)
      const a2 = ((k + 1) / 8) * Math.PI * 2 + Math.PI / 8
      beamBetween(g, Math.cos(a) * RR, py + 0.84, Math.sin(a) * RR,
        Math.cos(a2) * RR, py + 0.84, Math.sin(a2) * RR, 0.1, M.paintRed, 0.1)
      beamBetween(g, Math.cos(a) * RR, py + 0.32, Math.sin(a) * RR,
        Math.cos(a2) * RR, py + 0.32, Math.sin(a2) * RR, 0.08, M.paintRed, 0.08)
    }
    y = py + 0.24
    w *= 0.885
  }

  // ---------- 塔刹 ----------
  cyl(1.0, 1.3, 0.7, M.whiteStone, 0, y + 0.35, 0, 12, g)
  cyl(0.62, 0.9, 1.0, M.copperAged, 0, y + 1.2, 0, 12, g)
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72 - i * 0.09, 0.08, 5, 18), M.gold)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, y + 1.85 + i * 0.33, 0, g)
  }
  // 宝盖 + 宝珠 + 相轮尖
  cone(0.9, 0.5, M.gold, 0, y + 4.0, 0, 12, g)
  cyl(0.16, 0.16, 1.2, M.gold, 0, y + 4.8, 0, 8, g)
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), M.gold)
  add(orb, 0, y + 5.5, 0, g)
  cone(0.2, 1.0, M.gold, 0, y + 6.3, 0, 10, g)

  // ---------- 院内陈设：香炉 + 幡杆 + 经幢 + 树 ----------
  cyl(1.6, 2.0, 0.6, M.whiteStone, 0, 0.3, 13.5, 18, g)
  cyl(1.2, 1.5, 1.4, M.bronze, 0, 1.3, 13.5, 16, g)
  cyl(1.0, 1.1, 0.3, M.bronze, 0, 2.1, 13.5, 16, g)
  const smoke = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), M.glazeWhite)
  smoke.position.set(0, 2.7, 13.5)
  g.add(smoke)
  for (const sx of [-1, 1]) {
    cyl(0.12, 0.16, 8.0, M.teak, sx * 11.0, 4.0, 11.0, 8, g)
    box(1.2, 2.6, 0.08, M.paintYell, sx * 11.6, 6.4, 11.0, g)
    // 经幢
    box(1.2, 0.5, 1.2, M.tuff, sx * 12.5, 0.25, -4.0, g)
    cyl(0.34, 0.4, 3.6, M.whiteStone, sx * 12.5, 2.3, -4.0, 8, g)
    for (let k = 0; k < 4; k++) box(1.0, 0.2, 1.0, M.whiteStone, sx * 12.5, 0.9 + k * 0.85, -4.0, g)
    cone(0.42, 0.9, M.whiteStone, sx * 12.5, 4.5, -4.0, 8, g)
  }
  treeAt(g, -12, 6, 1.25, 3.4)
  treeAt(g, 12.5, 4, 1.15, 3.2)
  for (const [bx, bz] of [[-6, 12], [6, 12]]) benchAt(g, bx, bz, Math.PI)
  // 小香案
  box(3.0, 0.9, 1.3, M.teak, 0, 0.45, 15.5, g)
  box(3.2, 0.12, 1.5, M.tuff, 0, 0.95, 15.5, g)
  for (let i = 0; i < 3; i++) cyl(0.05, 0.05, 0.55, M.paintRed, -0.7 + i * 0.7, 1.25, 15.5, 6, g)
  return { g, top: y + 12 }
}

/** 74 孔庙（红墙 + 牌坊 + 大成殿） */
function t74(x, z) {
  const g = group(x, z, 0.06)
  const D = 22
  // 红墙围合
  for (const sx of [-1, 1]) {
    box(0.7, 3.8, D, M.paintRed, sx * 12, 1.9, 0, g)
    box(1.2, 0.34, D + 0.4, M.darkTile, sx * 12, 3.9, 0, g)
  }
  box(24, 3.8, 0.7, M.paintRed, 0, 1.9, -D / 2, g)
  box(24.4, 0.34, 1.2, M.darkTile, 0, 3.9, -D / 2, g)
  // 大成殿：台基 + 柱廊 + 庑殿顶
  box(20, 1.0, 13, M.tuff, 0, 0.5, -4, g)
  box(18.6, 4.6, 11.6, M.paintRed, 0, 3.3, -4, g)
  colonnade(g, 16.4, 1.0, 4.4, M.paintRed, 1.6, 6, 0.34)
  bracketBand(g, 18.6, 11.6, 5.7, M.gold, 7, 5)
  hippedRoof(g, 21, 14, 5.9, 3.6, M.tileRed, 2.0, 0, -4, { bells: true })
  box(5.2, 1.4, 0.3, M.gold, 0, 4.6, 1.88, g)
  // 大成殿格扇门 + 横披窗 + 两侧直棂窗
  for (let i = 0; i < 5; i++) {
    const dx = -6.4 + i * 3.2
    box(2.4, 3.6, 0.14, M.teak, dx, 2.9, 1.72, g)
    for (let k = 0; k < 6; k++) box(2.2, 0.09, 0.08, M.darkFrame, dx, 1.4 + k * 0.5, 1.8, g)
    box(0.09, 3.6, 0.1, M.darkFrame, dx, 2.9, 1.8, g)
    box(2.2, 0.5, 0.1, M.glAmber, dx, 5.0, 1.74, g)
    for (let k = 0; k < 3; k++) box(0.07, 0.5, 0.12, M.darkFrame, dx - 0.7 + k * 0.7, 5.0, 1.8, g)
  }
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      box(1.3, 1.6, 0.1, M.glAmber, sx * 8.6, 3.6, 1.72 + k * 0.0, g)
      for (let j = 0; j < 4; j++) box(0.08, 1.6, 0.12, M.darkFrame, sx * 8.6 - 0.45 + j * 0.3, 3.6, 1.78, g)
    }
  }
  // 殿内供案 + 匾
  box(6.0, 1.0, 1.6, M.teak, 0, 2.0, -1.6, g)
  box(6.4, 0.14, 1.9, M.tuff, 0, 2.55, -1.6, g)
  for (const sx of [-1.5, 0, 1.5]) {
    cyl(0.22, 0.26, 0.7, M.bronze, sx, 2.95, -1.6, 10, g)
    cone(0.2, 0.5, M.gold, sx, 3.5, -1.6, 8, g)
  }
  // 牌坊（三间）
  const px = [-5.4, 0, 5.4]
  for (const v of px) box(0.5, 7.0, 0.5, M.paintRed, v, 3.5, 8.6, g)
  for (const v of [-8.2, 8.2]) box(0.44, 5.6, 0.44, M.paintRed, v, 2.8, 8.6, g)
  hipRoof(g, 3.2, 1.4, 7.0, 1.1, M.tileRed, 0.5, 0, 8.6)
  hipRoof(g, 4.6, 1.5, 6.4, 1.3, M.tileRed, 0.55, -5.4, 8.6)
  hipRoof(g, 4.6, 1.5, 6.4, 1.3, M.tileRed, 0.55, 5.4, 8.6)
  hipRoof(g, 3.0, 1.3, 5.2, 1.0, M.tileRed, 0.45, -8.2, 8.6)
  hipRoof(g, 3.0, 1.3, 5.2, 1.0, M.tileRed, 0.45, 8.2, 8.6)
  box(18, 0.12, 8, M.paving, 0, 0.07, 4, g)
  return { g, top: 12 }
}

/** 75 哥特式主教座堂（双塔 + 飞扶壁 + 后殿，跨 2×2 地块） */
function t75(x, z) {
  const g = group(x, z, 0)
  const NZ = -10          // 中殿中心 z
  const NL = 50           // 中殿长
  const NW = 12           // 中殿净宽
  const AISLE = 4.6       // 侧廊宽
  const naveH = 21
  const aisleH = 12.5

  // ---------- 侧廊外墙 + 尖券窗 ----------
  for (const sx of [-1, 1]) {
    const wx = sx * (NW / 2 + AISLE)
    box(0.9, aisleH, NL, M.brick, wx, aisleH / 2, NZ, g)
    box(1.4, 0.5, NL + 0.6, M.whiteStone, wx, aisleH + 0.1, NZ, g)
    box(1.2, 0.4, NL + 0.4, M.tuff, wx, 0.2, NZ, g)
    for (let i = 0; i < 6; i++) {
      const wz = NZ - NL / 2 + 5 + i * 8
      archPanel(1.9, 5.4, 0.26, M.glViolet, wx + sx * 0.5, 4.4, wz, g, sx > 0 ? Math.PI / 2 : -Math.PI / 2)
      // 窗套 + 窗台
      box(0.32, 0.5, 2.6, M.whiteStone, wx + sx * 0.55, 4.0, wz, g)
    }
  }
  // 侧廊单坡屋顶
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(AISLE + 1.2, 0.4, NL), M.slate)
    r.position.set(sx * (NW / 2 + AISLE / 2), aisleH + 1.4, NZ)
    r.rotation.z = sx * 0.24
    r.castShadow = r.receiveShadow = true
    g.add(r)
  }

  // ---------- 中殿高侧墙 + 高窗 + 主屋顶 ----------
  box(NW, naveH - aisleH, NL, M.brick, 0, aisleH + (naveH - aisleH) / 2, NZ, g)
  for (const sz of [-1, 1]) {
    // 中殿端墙
    box(NW + 2 * AISLE, aisleH, 0.9, M.brick, 0, aisleH / 2, NZ + sz * NL / 2, g)
  }
  // 高侧窗（南北两侧）
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const wz = NZ - NL / 2 + 5 + i * 8
      archPanel(1.7, 4.4, 0.24, M.glRose, sx * (NW / 2 + 0.02), aisleH + 3.2, wz, g, sx > 0 ? Math.PI / 2 : -Math.PI / 2)
    }
  }
  // 主屋顶（脊沿 z）
  const rg = new THREE.Group()
  rg.position.set(0, 0, NZ)
  rg.rotation.y = Math.PI / 2
  g.add(rg)
  gableRoof(rg, NL, NW, naveH, 6.4, M.slate, 0.75)
  // 屋脊装饰 + 十字
  box(1.0, 0.3, 1.0, M.whiteStone, 0, naveH + 6.4, NZ - NL / 2 + 1, g)

  // ---------- 横厅（transept） ----------
  const TW = 44
  const tz = NZ - 12
  box(TW, naveH, 12, M.brick, 0, naveH / 2, tz, g)
  box(TW + 0.6, 0.8, 12.6, M.whiteStone, 0, naveH + 0.4, tz, g)
  const tr = new THREE.Group()
  tr.position.set(0, 0, tz)
  tr.rotation.y = Math.PI / 2
  g.add(tr)
  gableRoof(tr, 12, TW, naveH, 6.4, M.slate, 0.75)
  // 横厅端部玫瑰窗 + 山墙
  for (const sx of [-1, 1]) {
    const rose = new THREE.Mesh(new THREE.CircleGeometry(3.2, 30), M.glRose)
    rose.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2
    add(rose, sx * (TW / 2 + 0.03), 15.4, tz, g)
    const rr = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.26, 6, 30), M.whiteStone)
    rr.rotation.y = Math.PI / 2
    add(rr, sx * (TW / 2 + 0.05), 15.4, tz, g)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      box(0.14, 3.1, 0.16, M.whiteStone, sx * (TW / 2 + 0.08), 15.4 + Math.sin(a) * 1.5, tz + Math.cos(a) * 1.5, g)
    }
    // 端部尖券窗
    for (const oz of [-3.0, 3.0]) archPanel(1.5, 4.2, 0.24, M.glViolet, sx * (TW / 2), 5.0, tz + oz, g, Math.PI / 2)
  }

  // ---------- 后殿（半圆形） + 辐射小礼拜堂 ----------
  const az = NZ - NL / 2
  const apse = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, naveH, 22, 1, true, Math.PI, Math.PI), M.brick)
  apse.position.set(0, naveH / 2, az)
  apse.castShadow = apse.receiveShadow = true
  g.add(apse)
  cyl(8.2, 8.2, 0.4, M.tuff, 0, 0.2, az, 22, g)
  // 半锥屋顶
  const apseRoof = new THREE.Mesh(new THREE.ConeGeometry(9.2, 5.6, 22, 1, false, Math.PI, Math.PI), M.slate)
  apseRoof.position.set(0, naveH + 2.8, az)
  apseRoof.castShadow = true
  g.add(apseRoof)
  // 辐射窗 + 扶壁
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 5)
    const wx = Math.cos(a) * 8.62
    const wz = az + Math.sin(a) * 8.62
    archPanel(1.6, 5.2, 0.26, M.glRose, wx, 5.4, wz, g, -a + Math.PI / 2)
    box(1.2, 12, 1.2, M.brick, Math.cos(a) * 10.4, 6, az + Math.sin(a) * 10.4, g)
    cone(0.7, 3.0, M.whiteStone, Math.cos(a) * 10.4, 13.2, az + Math.sin(a) * 10.4, 4, g)
  }
  // 后殿环形小礼拜堂
  cyl(11.0, 11.4, 4.2, M.brick, 0, 2.1, az, 20, g)
  cyl(11.4, 11.4, 0.4, M.whiteStone, 0, 4.3, az, 20, g)

  // ---------- 飞扶壁 ----------
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const pz = NZ - NL / 2 + 4 + i * 8.6
      const px = sx * (NW / 2 + AISLE + 1.4)
      // 墩柱 + 基座 + 小尖塔
      box(1.5, 15, 1.5, M.whiteStone, px, 7.5, pz, g)
      box(2.1, 0.8, 2.1, M.tuff, px, 0.4, pz, g)
      box(1.9, 0.4, 1.9, M.whiteStone, px, 15.1, pz, g)
      cone(0.85, 3.4, M.whiteStone, px, 17.0, pz, 4, g)
      // 飞券（斜撑） + 上方小拱
      for (let k = 0; k < 3; k++) {
        box(3.0, 0.52, 0.9, M.whiteStone, px - sx * (1.4 + k * 1.1), 15.4 + k * 1.5, pz, g)
      }
      box(3.4, 0.5, 0.8, M.whiteStone, sx * (NW / 2 + 2.2), 19.8, pz, g)
      // 排水兽
      box(1.1, 0.32, 0.32, M.whiteStone, px - sx * 1.1, 15.0, pz, g)
    }
  }

  // ---------- 西立面：双塔 + 玫瑰窗 + 三重门廊 ----------
  const fz = NZ + NL / 2
  box(NW + 2 * AISLE, aisleH + 2, 2.2, M.brick, 0, (aisleH + 2) / 2, fz + 0.4, g)
  box(NW, naveH, 2.2, M.brick, 0, naveH / 2, fz + 1.6, g)
  // 山墙三角
  pediment(g, NW, 5.4, 2.2, M.brick, naveH, fz + 2.7)
  // 玫瑰窗（正面）
  const rose = new THREE.Mesh(new THREE.CircleGeometry(4.4, 34), M.glRose)
  add(rose, 0, 14.6, fz + 2.75, g)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.34, 6, 34), M.whiteStone)
  add(ring, 0, 14.6, fz + 2.78, g)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    box(0.16, 4.2, 0.18, M.whiteStone, Math.cos(a) * 2.1, 14.6 + Math.sin(a) * 2.1, fz + 2.82, g)
    box(0.15, 2.0, 0.16, M.whiteStone, Math.cos(a) * 3.7, 14.6 + Math.sin(a) * 3.7, fz + 2.82, g)
  }
  // 双塔
  for (const sx of [-1, 1]) {
    const tx = sx * 9.8
    const tz2 = fz + 1.0
    box(9.0, 34, 9.0, M.brick, tx, 17, tz2, g)
    box(9.6, 0.7, 9.6, M.whiteStone, tx, 34.2, tz2, g)
    box(9.4, 0.5, 9.4, M.whiteStone, tx, 14.0, tz2, g)
    box(9.4, 0.5, 9.4, M.whiteStone, tx, 24.0, tz2, g)
    // 角部扶壁 + 小尖塔
    for (const ox of [-1, 1]) for (const oz of [-1, 1]) {
      box(1.5, 33, 1.5, M.whiteStone, tx + ox * 4.2, 16.5, tz2 + oz * 4.2, g)
      cone(0.7, 3.4, M.whiteStone, tx + ox * 4.2, 35.0, tz2 + oz * 4.2, 4, g)
    }
    // 钟楼层百叶
    for (const [oy, hh] of [[28.6, 3.4]]) {
      archPanel(3.6, hh, 0.3, M.charcoal, tx, oy - hh / 2, tz2 + 4.55, g)
      for (let k = 0; k < 5; k++) box(3.4, 0.18, 0.2, M.aluDark, tx, oy - 1.3 + k * 0.65, tz2 + 4.72, g)
      archPanel(3.6, hh, 0.3, M.charcoal, tx, oy - hh / 2, tz2 - 4.55, g, Math.PI)
    }
    // 中段尖券窗 + 时钟
    for (const oy of [5.4, 10.6, 18.0]) archPanel(2.2, 4.4, 0.28, M.glViolet, tx, oy, tz2 + 4.55, g)
    archPanel(2.2, 4.4, 0.28, M.glViolet, tx, 18.0, tz2 - 4.55, g, Math.PI)
    const clk = new THREE.Mesh(new THREE.CircleGeometry(2.0, 26), M.glazeWhite)
    add(clk, tx, 23.0, tz2 + 4.58, g)
    const clkR = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.16, 5, 26), M.gold)
    add(clkR, tx, 23.0, tz2 + 4.6, g)
    box(0.16, 1.5, 0.1, M.charcoal, tx, 23.7, tz2 + 4.66, g)
    box(1.2, 0.16, 0.1, M.charcoal, tx + 0.5, 23.0, tz2 + 4.66, g)
    // 尖塔（四棱锥 + 小十字）
    cone(6.6, 15.0, M.slate, tx, 42.0, tz2, 4, g)
    box(0.16, 2.4, 0.16, M.gold, tx, 50.2, tz2, g)
    box(1.2, 0.16, 0.16, M.gold, tx, 50.8, tz2, g)
    // 塔基大门
    archPanel(4.2, 6.4, 0.4, M.teak, tx, 0, tz2 + 4.6, g)
    archPanel(5.2, 7.4, 0.3, M.whiteStone, tx, 0, tz2 + 4.5, g)
  }
  // 中央大门 + 门斗 + 台阶
  box(8.4, 8.4, 2.6, M.whiteStone, 0, 4.2, fz + 3.0, g)
  archPanel(3.4, 6.2, 0.3, M.teak, 0, 0, fz + 4.34, g)
  archPanel(4.4, 7.2, 0.24, M.whiteStone, 0, 0, fz + 4.28, g)
  archPanel(5.4, 8.2, 0.2, M.brick, 0, 0, fz + 4.22, g)
  // 山墙十字
  box(0.2, 3.0, 0.2, M.gold, 0, naveH + 6.4, fz + 1.6, g)
  box(1.5, 0.2, 0.2, M.gold, 0, naveH + 7.0, fz + 1.6, g)
  steps(g, 22, 4, 0.26, 1.1, 0, M.whiteStone, fz + 4.6)

  // ---------- 柱廊内部（透过门窗可见） ----------
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) {
      cyl(0.55, 0.6, naveH - 2, M.whiteStone, sx * NW / 2, (naveH - 2) / 2, NZ - 20 + i * 9, 10, g)
    }
  }
  box(10, 0.5, 44, M.whiteStone, 0, 1.1, NZ - 2, g)

  // ---------- 教堂广场 ----------
  paved(g, 0, 34, 46, 20, M.paving, 3.0, 'x')
  for (let i = 0; i < 3; i++) {
    for (const sx of [-1, 1]) {
      cyl(0.28, 0.4, 1.4, M.whiteStone, sx * 15, 0.7, 30 + i * 5, 10, g)
      box(1.2, 0.12, 1.2, M.whiteStone, sx * 15, 1.45, 30 + i * 5, g)
    }
  }
  for (const [tx, tz2] of [[-19, 38], [19, 38], [-19, 26], [19, 26]]) treeAt(g, tx, tz2, 1.05)
  for (const [bx, bz] of [[-8, 30], [8, 30]]) benchAt(g, bx, bz, Math.PI)
  for (const [lx, lz] of [[-13, 33], [13, 33]]) lampPost(g, lx, lz, 6.4, Math.PI)
  return { g, top: 54 }
}

/** 76 东正教堂（洋葱顶） */
/** 76 东正教堂（石砌教堂 + 五个金顶 + 钟楼 + 铁艺围墙） */
function t76(x, z) {
  const g = group(x, z, 0)
  const H = 13.5
  const NW = 13     // 中殿面宽
  const ND = 20     // 中殿进深
  const nz = -2     // 中殿中心 z

  // ---------- 台基 + 广场 ----------
  box(NW + 3.0, 0.7, ND + 3.0, M.tuff, 0, 0.35, nz, g)
  box(NW + 3.4, 0.24, ND + 3.4, M.whiteStone, 0, 0.78, nz, g)
  paved(g, 0, 14, 34, 12, M.paving, 3.2, 'x')
  steps(g, 12, 4, 0.22, 1.1, 0.85, M.whiteStone, nz + ND / 2 + 2.4)

  // ---------- 中殿：石墙 + 壁柱 + 层线 ----------
  box(NW, H, ND, M.plasterWarm, 0, H / 2 + 0.85, nz, g)
  for (const y of [4.4, 8.2, 12.2]) box(NW + 0.5, 0.45, ND + 0.5, M.whiteStone, 0, y + 0.85, nz, g)
  // 转角壁柱
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.9, H, 0.9, M.whiteStone, sx * (NW / 2 - 0.2), H / 2 + 0.85, nz + sz * (ND / 2 - 0.2), g)
    for (let k = 0; k < 5; k++) box(1.15, 0.28, 1.15, M.whiteStone, sx * (NW / 2 - 0.2), 2.4 + k * 2.6, nz + sz * (ND / 2 - 0.2), g)
  }
  // 墙面壁柱（侧立面）
  for (const sz of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      box(0.7, H - 1.6, 0.5, M.whiteStone, i * 5.4, (H - 1.6) / 2 + 1.2, nz + sz * (ND / 2 + 0.12), g)
    }
  }
  // ---------- 高拱窗（带框 + 窗台） ----------
  for (const sz of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      const wx = i * 5.4
      const wz = nz + sz * (ND / 2 + 0.3)
      const ry = sz > 0 ? 0 : Math.PI
      // 框
      archPanel(2.0, 4.4, 0.16, M.whiteStone, wx, 5.0, wz, g, ry)
      archPanel(1.6, 4.0, 0.14, M.glAmber, wx, 5.0, wz + sz * 0.1, g, ry)
      // 窗棂
      for (let k = 0; k < 3; k++) box(0.1, 3.0, 0.1, M.darkFrame, wx - 0.5 + k * 0.5, 4.6, wz + sz * 0.2, g)
      box(1.5, 0.1, 0.1, M.darkFrame, wx, 4.0, wz + sz * 0.2, g)
      // 窗台 + 线脚
      box(2.4, 0.22, 0.5, M.whiteStone, wx, 2.6, wz + sz * 0.2, g)
    }
  }
  // 西立面圆窗
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.22, 6, 20), M.whiteStone)
    add(ring, sx * (NW / 2 + 0.1), 9.6, nz, g)
    ring.rotation.y = Math.PI / 2
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 22), M.glAmber)
    add(disc, sx * (NW / 2 + 0.06), 9.6, nz, g)
    disc.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2
    // 窗花
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.08), M.darkFrame)
      bar.position.set(sx * (NW / 2 + 0.16), 9.6, nz)
      bar.rotation.x = a
      g.add(bar)
    }
  }

  // ---------- 半圆后殿（apse） ----------
  const apse = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, H - 1.2, 16, 1, false, -Math.PI / 2, Math.PI), M.plasterWarm)
  add(apse, 0, (H - 1.2) / 2 + 0.85, nz - ND / 2, g)
  box(9.2, 0.5, 1.2, M.whiteStone, 0, H - 0.5, nz - ND / 2 - 3.2, g)
  for (let i = -1; i <= 1; i++) {
    archPanel(1.2, 3.0, 0.14, M.glAmber, i * 2.6, 5.2, nz - ND / 2 - 4.24, g, Math.PI)
  }
  // 半穹顶
  const apseDome = new THREE.Mesh(new THREE.SphereGeometry(4.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.roof)
  apseDome.scale.set(1, 0.72, 1)
  add(apseDome, 0, H - 4.2, nz - ND / 2, g)

  // ---------- 屋顶 + 中央鼓座 ----------
  box(NW + 0.4, 1.0, ND + 0.4, M.whiteStone, 0, H + 0.9, nz, g)
  parapet(g, NW + 0.4, ND + 0.4, H + 1.4, M.whiteStone, 0.6, 0.3)
  const drumY = H + 1.4
  cyl(4.4, 4.8, 6.4, M.plasterWarm, 0, drumY + 3.2, nz, 20, g)
  // 鼓座壁柱 + 拱窗
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    box(0.4, 6.4, 0.5, M.whiteStone, Math.cos(a) * 4.6, drumY + 3.2, nz + Math.sin(a) * 4.6, g).rotation.y = -a
    archPanel(1.15, 3.0, 0.16, M.glAmber, Math.cos(a + 0.39) * 4.66, drumY + 2.6, nz + Math.sin(a + 0.39) * 4.66, g, -a + 0.39 + Math.PI / 2)
  }
  for (const y of [drumY + 1.0, drumY + 5.6]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.75, 0.2, 6, 26), M.whiteStone)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, y, nz, g)
  }
  onionDome(g, 4.9, drumY + 6.4, M.gold)
  g.children[g.children.length - 1].position.set(0, drumY + 6.4, nz)
  // 大十字
  crossAt(g, 0, drumY + 6.4 + 9.6, nz, 2.6, M.gold)

  // ---------- 四角小穹顶 ----------
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx2 = sx * (NW / 2 - 1.6)
    const cz2 = nz + sz * (ND / 2 - 1.6)
    cyl(0.55, 0.7, 2.4, M.whiteStone, cx2, H + 2.2, cz2, 10, g)
    cyl(1.55, 1.7, 2.6, M.plasterWarm, cx2, H + 4.6, cz2, 14, g)
    archPanel(0.8, 1.7, 0.12, M.glAmber, cx2, H + 4.3, cz2 + 1.68, g)
    onionDome(g, 1.75, H + 5.9, M.gold)
    g.children[g.children.length - 1].position.set(cx2, H + 5.9, cz2)
    crossAt(g, cx2, H + 5.9 + 3.4, cz2, 1.1, M.gold)
  }

  // ---------- 钟楼 ----------
  const bx = -10.5
  const bz = nz + 4.0
  box(5.0, 3.0, 5.0, M.whiteStone, bx, 1.5, bz, g)
  box(4.6, 19.0, 4.6, M.plasterWarm, bx, 12.5, bz, g)
  for (const y of [6.0, 10.0, 14.0, 17.6]) box(5.0, 0.4, 5.0, M.whiteStone, bx, y, bz, g)
  // 角柱
  for (const ox of [-1, 1]) for (const oz of [-1, 1]) {
    box(0.6, 19.0, 0.6, M.whiteStone, bx + ox * 2.1, 12.5, bz + oz * 2.1, g)
  }
  // 钟室（四面拱洞）
  box(5.4, 0.5, 5.4, M.whiteStone, bx, 22.2, bz, g)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const dx = Math.sin(a)
    const dz = Math.cos(a)
    archPanel(1.6, 3.4, 0.3, M.charcoal, bx + dx * 2.36, 19.4, bz + dz * 2.36, g, a)
    // 钟
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.bronze)
    bell.position.set(bx + dx * 1.6, 20.9, bz + dz * 1.6)
    g.add(bell)
    box(0.08, 0.6, 0.08, M.bronze, bx + dx * 1.6, 21.3, bz + dz * 1.6, g)
  }
  // 钟楼顶 + 洋葱顶 + 十字
  box(6.2, 0.5, 6.2, M.whiteStone, bx, 23.9, bz, g)
  cyl(2.4, 2.7, 2.2, M.plasterWarm, bx, 25.2, bz, 14, g)
  onionDome(g, 2.8, 26.2, M.gold)
  g.children[g.children.length - 1].position.set(bx, 26.2, bz)
  crossAt(g, bx, 26.2 + 5.6, bz, 1.6, M.gold)

  // ---------- 门廊 + 大门 ----------
  const pz = nz + ND / 2
  box(8.4, 1.1, 4.2, M.whiteStone, 0, 1.4, pz + 1.8, g)
  box(8.8, 0.3, 4.6, M.tuff, 0, 0.95, pz + 1.8, g)
  for (const sx of [-1, 1]) {
    cyl(0.34, 0.4, 5.4, M.whiteStone, sx * 3.2, 4.6, pz + 3.0, 12, g)
    box(0.9, 0.3, 0.9, M.whiteStone, sx * 3.2, 1.9, pz + 3.0, g)
    box(0.9, 0.3, 0.9, M.whiteStone, sx * 3.2, 7.4, pz + 3.0, g)
  }
  box(8.8, 0.6, 4.8, M.whiteStone, 0, 7.8, pz + 1.8, g)
  box(9.2, 0.22, 5.2, M.roof, 0, 8.2, pz + 1.8, g)
  // 门洞（拱） + 双开门 + 门楣圣像
  archPanel(3.0, 4.4, 0.4, M.whiteStone, 0, 1.1, pz + 0.3, g)
  archPanel(2.4, 4.0, 0.22, M.teak, 0, 1.1, pz + 0.55, g)
  box(0.1, 3.2, 0.2, M.darkFrame, 0, 3.1, pz + 0.72, g)
  for (let i = 0; i < 3; i++) box(0.9, 0.08, 0.1, M.gold, -1.0 + i * 1.0, 2.1, pz + 0.72, g)
  // 门楣马赛克 + 金框
  box(4.0, 2.0, 0.2, M.gold, 0, 8.9, pz + 0.4, g)
  box(3.6, 1.6, 0.14, M.mosaic, 0, 8.9, pz + 0.5, g)
  for (let i = 0; i < 5; i++) box(0.2, 0.2, 0.16, M.gold, -1.6 + i * 0.8, 10.2, pz + 0.5, g)
  // 门前花园 + 灯
  for (const sx of [-1, 1]) {
    planter(g, sx * 8.5, pz + 5.6, 4.4, 2.2)
    lampPost(g, sx * 6.6, 13.6, 4.4, sx > 0 ? Math.PI : 0)
    treeAt(g, sx * 12.0, 11.0, 0.95, 3.4)
    treeAt(g, sx * 13.0, 16.6, 0.85, 3.0, 'column')
  }
  // 铁艺围墙 + 门扇
  for (let i = 0; i < 9; i++) {
    box(0.14, 1.6, 0.14, M.darkFrame, -16 + i * 4.0, 0.8, 20.0, g)
  }
  box(32, 0.1, 0.1, M.darkFrame, 0, 1.55, 20.0, g)
  box(32, 0.1, 0.1, M.darkFrame, 0, 0.5, 20.0, g)
  for (const sx of [-1, 1]) {
    box(1.7, 2.2, 0.5, M.whiteStone, sx * 3.6, 1.1, 20.0, g)
    box(2.1, 0.3, 0.7, M.whiteStone, sx * 3.6, 2.3, 20.0, g)
  }
  return { g, top: H + 16 }
}

/** 十字架：竖杆 + 横杆 + 斜杆 */
function crossAt(g, x, y, z, s = 1, mat = M.gold) {
  box(0.12 * s, 2.4 * s, 0.12 * s, mat, x, y, z, g)
  box(1.2 * s, 0.12 * s, 0.12 * s, mat, x, y + 0.55 * s, z, g)
  box(0.8 * s, 0.1 * s, 0.1 * s, mat, x, y + 0.95 * s, z, g)
  const diag = new THREE.Mesh(new THREE.BoxGeometry(0.85 * s, 0.1 * s, 0.1 * s), mat)
  diag.position.set(x, y - 0.35 * s, z)
  diag.rotation.z = 0.42
  g.add(diag)
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), mat)
  add(orb, x, y + 1.22 * s, z, g)
}

/** 77 乡村小礼拜堂（石砌 + 尖券窗 + 钟架 + 墓园） */
function t77(x, z) {
  const g = group(x, z, 0.16)
  const H = 7.2
  const W = 10.4
  const D = 15.0
  // 台基 + 台阶
  box(W + 1.6, 0.5, D + 1.6, M.tuff, 0, 0.25, 0, g)
  box(W + 1.9, 0.2, D + 1.9, M.whiteStone, 0, 0.55, 0, g)
  steps(g, 5.0, 3, 0.2, 1.0, 0.6, M.whiteStone, D / 2 + 1.4)
  // 主体
  box(W, H, D, M.plaster, 0, H / 2 + 0.6, 0, g)
  box(W + 0.4, 0.5, D + 0.4, M.tuff, 0, 0.85, 0, g)
  for (const y of [3.4, 6.9]) box(W + 0.5, 0.34, D + 0.5, M.whiteStone, 0, y + 0.6, 0, g)
  gableRoof(g, W, D, H + 1.1, 4.2, M.slate, 0.7)
  // 瓦楞 + 檐口 + 雨水管
  for (const sz of [-1, 1]) box(W + 1.4, 0.12, 0.3, M.aluDark, 0, H + 1.05, sz * (D / 2 + 0.35), g)
  // 山墙小窗 + 十字
  const rose = new THREE.Mesh(new THREE.CircleGeometry(0.85, 18), M.glAmber)
  add(rose, 0, H + 3.2, D / 2 + 0.06, g)
  const roseRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.12, 6, 18), M.whiteStone)
  add(roseRing, 0, H + 3.2, D / 2 + 0.1, g)
  crossAt(g, 0, H + 7.0, D / 2 - 0.2, 0.8, M.copperAged)
  // 钟架 + 钟
  for (const sx of [-1, 1]) box(0.24, 3.2, 0.24, M.teak, sx * 1.2, H + 2.6, D / 2 - 0.8, g)
  box(2.8, 0.24, 0.24, M.teak, 0, H + 4.1, D / 2 - 0.8, g)
  const bell1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.8, 12), M.bronze)
  add(bell1, 0, H + 3.6, D / 2 - 0.8, g)
  box(0.1, 0.4, 0.1, M.bronze, 0, H + 4.1, D / 2 - 0.8, g)
  // 尖券门 + 门套 + 门环
  archPanel(3.0, 4.4, 0.2, M.whiteStone, 0, 0.6, D / 2 + 0.1, g)
  archPanel(2.2, 3.8, 0.22, M.teak, 0, 0.6, D / 2 + 0.28, g)
  for (let i = 0; i < 4; i++) box(0.1, 2.4, 0.1, M.darkFrame, -0.75 + i * 0.5, 2.2, D / 2 + 0.44, g)
  for (const sx of [-1, 1]) {
    const kn = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 5, 10), M.bronze)
    add(kn, sx * 0.42, 1.9, D / 2 + 0.44, g)
  }
  // 台阶侧石墩
  for (const sx of [-1, 1]) {
    box(0.7, 1.0, 0.7, M.whiteStone, sx * 2.9, 0.95, D / 2 + 1.1, g)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.whiteStone)
    add(orb, sx * 2.9, 1.6, D / 2 + 1.1, g)
  }
  // 侧立面尖券窗（三扇）+ 彩色玻璃
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const wz = -4.6 + i * 4.6
      const ry = sx > 0 ? Math.PI / 2 : -Math.PI / 2
      archPanel(1.35, 3.0, 0.16, M.whiteStone, sx * (W / 2 + 0.1), 4.2, wz, g, ry)
      archPanel(1.05, 2.7, 0.14, [M.glViolet, M.glAmber, M.glTeal][i], sx * (W / 2 + 0.2), 4.2, wz, g, ry)
      box(0.14, 0.16, 1.2, M.darkFrame, sx * (W / 2 + 0.28), 3.2, wz, g)
      box(0.14, 1.8, 0.1, M.darkFrame, sx * (W / 2 + 0.28), 4.4, wz, g)
    }
  }
  // 扶壁 + 尖顶饰
  for (const oz of [-5.2, 0.4, 5.4]) {
    for (const sx of [-1, 1]) {
      box(0.8, 3.8, 1.1, M.plaster, sx * (W / 2 + 0.5), 1.9, oz, g)
      box(0.95, 0.3, 1.25, M.whiteStone, sx * (W / 2 + 0.5), 3.9, oz, g)
      cone(0.55, 1.0, M.whiteStone, sx * (W / 2 + 0.5), 4.6, oz, 4, g)
    }
  }
  // 后殿（半圆）
  const apse = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, H - 0.6, 14, 1, false, -Math.PI / 2, Math.PI), M.plaster)
  add(apse, 0, (H - 0.6) / 2 + 0.6, -D / 2, g)
  const apseRoof = new THREE.Mesh(new THREE.SphereGeometry(3.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.slate)
  apseRoof.scale.set(1, 0.55, 1)
  add(apseRoof, 0, H - 0.4, -D / 2, g)
  // 墓园：矮石墙 + 墓碑 + 柏树
  box(30, 0.7, 0.6, M.tuff, -4, 0.35, -16, g)
  for (let i = 0; i < 7; i++) {
    const tx = -16 + i * 4.2
    box(0.9, 1.1 + (i % 3) * 0.2, 0.22, M.whiteStone, tx, 0.9, -13.4 + (i % 2) * 1.6, g)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.22, 10, 1, false, 0, Math.PI), M.whiteStone)
    top.rotation.x = Math.PI / 2
    add(top, tx, 1.45 + (i % 3) * 0.2, -13.4 + (i % 2) * 1.6, g)
    treeAt(g, tx + 1.4, -15.4 + (i % 2) * 1.6, 0.72, 2.6, 'column')
  }
  // 草地 + 长椅 + 灯
  box(30, 0.12, 9, M.greenSoft, -4, 0.08, -13.4, g)
  benchAt(g, 7.0, 4.0, -Math.PI / 2)
  benchAt(g, -7.0, 4.0, Math.PI / 2)
  lampPost(g, 5.0, D / 2 + 3.2, 4.2, Math.PI)
  lampPost(g, -5.0, D / 2 + 3.2, 4.2, Math.PI)
  treeAt(g, -9.5, 9.0, 1.0, 3.6)
  treeAt(g, 9.5, 9.0, 1.0, 3.6)
  paved(g, 0, 11, 24, 8, M.paving, 2.6, 'x')
  return { g, top: H + 9 }
}

/** 78 犹太会堂 */
function t78(x, z) {
  const g = group(x, z, -0.12)
  const H = 14
  const w = 17
  const d = 21
  box(w, H, d, M.tuff, 0, H / 2, 0, g)
  box(w + 0.5, 0.9, d + 0.5, M.whiteStone, 0, H + 0.45, 0, g)
  // 女儿墙
  box(w + 0.3, 0.7, 0.5, M.whiteStone, 0, H + 1.2, d / 2, g)
  // 高拱窗
  for (let i = 0; i < 3; i++) {
    archPanel(2.0, 4.6, 0.2, M.glViolet, -5 + i * 5, 5.4, d / 2 + 0.02, g)
    archPanel(2.0, 4.6, 0.2, M.glViolet, -5 + i * 5, 5.4, -d / 2 - 0.22, g, Math.PI)
  }
  // 山墙上的玫瑰窗 + 双石板
  const rose = new THREE.Mesh(new THREE.CircleGeometry(2.0, 24), M.glRose)
  add(rose, 0, 11.6, d / 2 + 0.03, g)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.18, 6, 24), M.whiteStone)
  add(ring, 0, 11.6, d / 2 + 0.06, g)
  for (const sx of [-1, 1]) {
    const tab = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 12, 1, false, 0, Math.PI), M.whiteStone)
    tab.rotation.x = Math.PI / 2
    add(tab, sx * 2.4, H + 2.2, d / 2 + 0.1, g)
  }
  // 门廊 + 台阶
  box(7.0, 4.6, 2.6, M.whiteStone, 0, 4.6, d / 2 + 1.2, g)
  colonnade(g, 6.0, 0, 4.6, M.whiteStone, d / 2 + 2.4, 4, 0.34)
  archPanel(2.4, 4.2, 0.3, M.teak, 0, 0, d / 2 + 0.3, g)
  steps(g, 9, 3, 0.3, 1.0, 0.0, M.whiteStone, d / 2 + 3.0)
  return { g, top: H + 6 }
}

/** 79 印度教神庙（阶梯塔） */
function t79(x, z) {
  const g = group(x, z, 0.05)
  box(18, 1.2, 20, M.tuff, 0, 0.6, 0, g)
  steps(g, 7, 4, 0.3, 1.2, 1.2, M.sandstone, 10.2)
  // 前厅（柱廊）
  box(10, 5.0, 8, M.sandstone, 0, 1.2 + 2.5, 4.5, g)
  for (const sx of [-1, 1]) box(10.6, 0.6, 8.6, M.sandstone, 0, 6.5, 4.5, g)
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) cyl(0.42, 0.46, 4.2, M.sandstone, sx * 3.4, 3.3, 2 + i * 2.2, 10, g)
  }
  hipRoof(g, 10, 8, 6.8, 3.0, M.sandstone, 0.7, 0, 4.5)
  // 主塔（shikhara）：层层收进 + 竖向棱
  let w = 9.6
  let y = 1.2 + 5.0
  for (let i = 0; i < 9; i++) {
    const hh = 2.5
    box(w, hh, w, M.sandstone, 0, y + hh / 2, -3, g)
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      box(ox !== 0 ? 0.5 : w * 0.3, hh, oz !== 0 ? 0.5 : w * 0.3, M.terra,
        ox * (w / 2 - 0.1), y + hh / 2, -3 + oz * (w / 2 - 0.1), g)
      // 壁龛 + 龛内神像 + 叠涩檐口
      const nx = ox * (w / 2 + 0.03)
      const nz = -3 + oz * (w / 2 + 0.03)
      const ry = ox > 0 ? Math.PI / 2 : ox < 0 ? -Math.PI / 2 : oz > 0 ? 0 : Math.PI
      const ng = new THREE.Group()
      ng.position.set(nx, y, nz)
      ng.rotation.y = ry
      g.add(ng)
      box(w * 0.34, hh * 0.5, 0.2, M.charcoal, 0, hh * 0.32, 0.02, ng)
      const idol = new THREE.Mesh(new THREE.SphereGeometry(w * 0.08, 10, 8), M.gold)
      add(idol, 0, hh * 0.36, 0.16, ng)
      box(w * 0.44, 0.14, 0.3, M.sandstone, 0, hh * 0.62, 0.1, ng)
      box(w * 0.46, 0.12, 0.34, M.sandstone, 0, hh * 0.02, 0.12, ng)
      // 两角小像
      for (const sx of [-1, 1]) {
        const st = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M.sandstone)
        add(st, sx * w * 0.42, hh * 0.2, 0.1, ng)
      }
    }
    // 层间檐口（叠涩）
    box(w + 0.7, 0.24, w + 0.7, M.sandstone, 0, y + hh - 0.06, -3, g)
    box(w + 0.4, 0.16, w + 0.4, M.terra, 0, y + hh - 0.28, -3, g)
    y += hh
    w *= 0.9
  }
  // 顶部压顶石 + 宝瓶
  cyl(2.6, 2.9, 0.8, M.sandstone, 0, y + 0.4, -3, 16, g)
  cyl(1.1, 1.6, 1.4, M.sandstone, 0, y + 1.5, -3, 12, g)
  const kal = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), M.gold)
  add(kal, 0, y + 2.7, -3, g)
  cone(0.34, 1.0, M.gold, 0, y + 3.7, -3, 8, g)
  // 旗
  cyl(0.1, 0.12, 6, M.darkFrame, 7.4, 4, 6, 6, g)
  box(1.8, 1.2, 0.08, M.paintYell, 8.3, 6.4, 6, g)
  return { g, top: y + 6 }
}

/** 80 加油站 */
function t80(x, z) {
  const g = group(x, z, 0)
  // 便利店：主体 + 檐口 + 玻璃橱窗 + 自动门
  box(12, 4.6, 8, M.plasterGrey, -9, 2.3, -5, g)
  box(12.6, 0.42, 8.6, M.paintRed, -9, 4.8, -5, g)
  box(12.9, 0.2, 8.9, M.whiteStone, -9, 5.06, -5, g)
  for (const sz of [-1, 1]) gridGlass(g, -9, 2.2, -5 + sz * 4.04, sz > 0 ? 0 : Math.PI, 10.6, 2.8, 6, 1, { glass: M.glSmoke, frame: M.aluDark })
  gridGlass(g, -2.94, 2.2, -5, Math.PI / 2, 6.6, 2.8, 4, 1, { glass: M.glSmoke, frame: M.aluDark })
  box(2.2, 2.6, 0.2, M.glWhite, -6.6, 1.3, -0.9, g)
  box(1.9, 2.4, 0.12, M.glSmoke, -6.6, 1.25, -0.76, g)
  box(0.08, 2.4, 0.14, M.aluPanel, -6.6, 1.25, -0.7, g)
  steps(g, 3.4, 2, 0.18, 0.8, 0, M.concrete, -0.4)
  // 店内货架（透过玻璃可见）
  for (let i = 0; i < 3; i++) box(1.0, 1.6, 4.4, M.plaster, -11 + i * 2, 0.9, -6.4, g)
  box(1.1, 0.2, 4.5, M.paintYell, -11, 1.75, -6.4, g)
  box(1.1, 0.2, 4.5, M.paintRed, -9, 1.75, -6.4, g)
  // 便利店屋顶空调 + 招牌
  box(2.4, 1.2, 1.8, M.aluPanel, -11, 5.4, -6, g)
  box(9.0, 1.1, 0.3, M.paintRed, -9, 5.3, -0.82, g)
  box(6.0, 0.3, 0.12, M.glazeWhite, -9, 5.3, -0.64, g)

  // 加油岛（两组）+ 加油机 + 罩棚立柱
  for (const px of [2, 10]) {
    box(7.0, 0.26, 2.8, M.paving, px, 0.16, 2, g)
    box(7.2, 0.14, 3.0, M.paintYell, px, 0.3, 2, g)
    for (const oz of [0.6, 3.4]) {
      box(1.15, 1.9, 0.8, M.paintRed, px, 1.2, oz, g)
      box(0.95, 1.0, 0.16, M.glazeWhite, px, 2.45, oz, g)
      box(0.8, 0.62, 0.1, M.glDark, px, 2.1, oz + 0.44, g)
      box(0.24, 0.5, 0.24, M.charcoal, px - 0.42, 1.95, oz + 0.4, g)
      box(0.5, 0.4, 0.16, M.glazeWhite, px + 0.3, 2.2, oz + 0.42, g)
      box(1.3, 0.1, 0.9, M.concrete, px, 0.38, oz, g)
    }
    // 防撞柱
    for (const oz of [-0.4, 4.4]) cyl(0.16, 0.16, 1.1, M.paintYell, px + 2.9, 0.55, oz, 8, g)
    cyl(0.26, 0.26, 5.4, M.brightSilver, px, 2.7, -0.2, 8, g)
    cyl(0.26, 0.26, 5.4, M.brightSilver, px, 2.7, 4.2, 8, g)
  }
  // 罩棚：白顶 + 红边 + 底面灯带 + 顶面设备
  box(25, 0.7, 13, M.glazeWhite, 6, 5.8, 2, g)
  box(25.4, 0.36, 13.4, M.paintRed, 6, 6.3, 2, g)
  for (let i = 0; i < 6; i++) box(20, 0.12, 0.24, M.glWhite, 6, 5.4, -3.9 + i * 2.4, g)
  box(9, 1.2, 0.36, M.paintYell, 6, 6.9, 8.4, g)
  box(6, 0.3, 0.12, M.paintRed, 6, 6.9, 8.56, g)
  for (const px of [-2, 14]) box(2.0, 1.0, 1.6, M.aluPanel, px, 6.6, 2, g)

  // 价格牌
  cyl(0.2, 0.26, 8.2, M.darkFrame, 18, 4.1, 9, 8, g)
  box(3.4, 2.6, 0.3, M.paintRed, 18, 8.6, 9, g)
  box(2.8, 0.3, 0.12, M.glazeWhite, 18, 9.2, 9.16, g)
  box(2.2, 0.24, 0.12, M.glazeWhite, 18, 8.6, 9.16, g)
  cyl(0.06, 0.06, 1.2, M.brightSilver, 18, 11.9, 9, 4, g)

  // 洗车房（左侧）
  box(9, 4.0, 6.5, M.plasterGrey, -9, 2.0, 9, g)
  box(9.4, 0.4, 7.0, M.paintBlue, -9, 4.2, 9, g)
  box(7.4, 3.2, 0.24, M.charcoal, -9, 1.6, 12.3, g)
  for (let i = 0; i < 12; i++) box(0.12, 3.0, 0.14, M.glBlue, -12.4 + i * 0.68, 1.6, 12.44, g)
  box(4.0, 0.3, 0.4, M.paintBlue, -9, 3.9, 12.4, g)
  // 洗车排队线 + 停车位
  for (let i = 0; i < 3; i++) box(0.12, 0.05, 5.0, M.roadPaint, -13 + i * 3.4, 0.13, 16, g)
  for (let i = 0; i < 4; i++) box(0.12, 0.05, 5.2, M.roadPaint, 12 + i * 3.4, 0.13, -8, g)
  // 油罐区围栏 + 标示
  box(7, 0.14, 0.14, M.paintYell, 12, 1.4, -14, g)
  for (let i = 0; i < 3; i++) box(0.14, 1.4, 0.14, M.paintYell, 9 + i * 3, 0.7, -14, g)
  box(2.0, 0.7, 0.16, M.paintRed, 12, 1.9, -14, g)
  // 灯柱 + 绿地
  for (const [px, pz] of [[-18, 4], [18, -2]]) {
    cyl(0.14, 0.2, 8.0, M.brightSilver, px, 4.0, pz, 6, g)
    box(1.4, 0.28, 0.4, M.glazeWhite, px, 8.1, pz, g)
  }
  for (const sx of [-1, 1]) planter(g, sx * 16, 14, 5, 1.6)
  return { g, top: 13 }
}

/** 81 超市大卖场 */
function t81(x, z) {
  const g = group(x, z, 0)
  const w = 50
  const d = 34
  const H = 11.5

  // ---------- 主体大卖场 ----------
  box(w, H, d, M.plasterGrey, 0, H / 2, -4, g)
  box(w + 0.8, 1.6, d + 0.8, M.aluPanel, 0, H + 0.8, -4, g)
  box(w + 1.2, 0.3, d + 1.2, M.aluDark, 0, H + 1.72, -4, g)
  // 竖向板缝 + 横向分缝
  for (let i = 0; i <= 24; i++) {
    for (const sz of [-1, 1]) box(0.08, H, 0.1, M.aluDark, -w / 2 + i * (w / 24), H / 2, -4 + sz * (d / 2 + 0.04), g)
  }
  for (let i = 0; i < 5; i++) {
    for (const sz of [-1, 1]) box(w + 0.1, 0.09, 0.12, M.aluDark, 0, 2.6 + i * 2.0, -4 + sz * (d / 2 + 0.05), g)
  }
  // 招牌带 + 品牌字块
  box(w * 0.82, 3.0, 0.6, M.paintRed, 0, H - 2.2, 12.24, g)
  box(w * 0.82 + 0.4, 0.24, 0.8, M.aluDark, 0, H - 0.66, 12.3, g)
  box(w * 0.82 + 0.4, 0.24, 0.8, M.aluDark, 0, H - 3.74, 12.3, g)
  for (let i = 0; i < 10; i++) box(2.6, 1.5, 0.14, M.glazeWhite, -w * 0.36 + i * 3.9, H - 2.2, 12.55, g)
  // 生鲜区外窗
  for (let i = 0; i < 8; i++) box(3.4, 1.4, 0.14, M.glSmoke, -w / 2 + 4 + i * 6.0, 1.9, 12.14, g)

  // ---------- 入口门斗 ----------
  box(24, 8.5, 5.4, M.glWhite, -2, 4.25, 15.4, g)
  box(26.0, 0.8, 6.8, M.brightSilver, -2, 8.8, 15.6, g)
  for (let i = 0; i < 9; i++) box(0.2, 8.5, 0.2, M.aluDark, -13 + i * 3.1, 4.25, 18.1, g)
  box(12, 4.2, 0.24, M.glSmoke, -2, 2.2, 18.3, g)
  for (let i = 0; i < 5; i++) box(0.24, 4.2, 0.3, M.aluDark, -10 + i * 4, 2.2, 18.44, g)
  box(6.0, 0.2, 0.34, M.brightSilver, -2, 4.4, 18.4, g)
  steps(g, 26, 2, 0.22, 1.2, 0, M.concrete, 18.8)
  // 推车棚 + 自动售货机
  box(9, 2.6, 4.4, M.brightSilver, 18, 1.3, 19.6, g)
  box(9.3, 0.24, 4.7, M.aluDark, 18, 2.74, 19.6, g)
  for (let i = 0; i < 9; i++) {
    const cx = 14.6 + i * 0.85
    box(0.7, 0.9, 0.55, M.brightSilver, cx, 0.6, 19.6, g)
    cyl(0.12, 0.12, 0.14, M.charcoal, cx - 0.26, 0.14, 19.3, 6, g)
    cyl(0.12, 0.12, 0.14, M.charcoal, cx + 0.26, 0.14, 19.3, 6, g)
  }

  // ---------- 侧立面 ----------
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) box(0.18, 1.6, 3.0, M.glSmoke, sx * (w / 2 + 0.04), 6.4, -14 + i * 6, g)
    box(1.6, 4.0, 8, M.paintRed, sx * (w / 2 + 0.62), 5.0, -4, g)
    for (let i = 0; i < 4; i++) box(0.1, 3.2, 1.2, M.glazeWhite, sx * (w / 2 + 0.7), 5.0, -7.2 + i * 2.2, g)
    // 货运侧门
    box(0.24, 3.0, 3.4, M.aluPanel, sx * (w / 2 + 0.02), 1.5, -14, g)
  }

  // ---------- 屋顶 ----------
  for (let i = 0; i < 5; i++) {
    box(5.2, 2.4, 4.0, M.aluPanel, -18 + i * 9, H + 3.1, -12, g)
    box(5.5, 0.2, 4.3, M.aluDark, -18 + i * 9, H + 4.42, -12, g)
    for (let k = 0; k < 4; k++) cyl(1.1, 1.1, 0.16, M.darkFrame, -18 + i * 9, H + 4.5, -13.3 + k * 0.9, 14, g)
  }
  for (let i = 0; i < 8; i++) {
    const sk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.8), M.glWhite)
    sk.position.set(-19 + i * 5.4, H + 1.9, 4)
    sk.castShadow = true
    g.add(sk)
  }
  for (let i = 0; i < 6; i++) {
    const pan = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.1, 2.4), M.glDark)
    pan.position.set(-16 + i * 6.4, H + 2.0, -2)
    pan.rotation.x = -0.2
    g.add(pan)
  }
  // 屋顶楼梯间 + 电梯机房
  box(6.0, 3.4, 5.0, M.plasterGrey, 20, H + 2.4, -14, g)
  box(6.3, 0.2, 5.3, M.aluDark, 20, H + 4.2, -14, g)

  // ---------- 北侧卸货区 ----------
  box(34, 0.12, 12, M.concrete, -4, 0.06, -25, g)
  for (const px of [-12, -4, 4]) {
    box(6.0, 4.8, 0.3, M.aluPanel, px, 2.4, -21.1, g)
    for (let k = 0; k < 8; k++) box(5.8, 0.1, 0.1, M.aluDark, px, 0.4 + k * 0.55, -21.24, g)
    box(8.0, 1.0, 4.2, M.concrete, px, 0.5, -23.2, g)
    box(1.8, 0.6, 0.3, M.paintYell, px, 5.0, -20.9, g)
  }
  // 货车 + 拖车
  box(9.0, 3.4, 2.6, M.glazeWhite, -4, 2.0, -27, g)
  box(2.4, 2.2, 2.5, M.paintBlue, -9.6, 1.4, -27, g)
  box(2.0, 1.0, 2.54, M.glSmoke, -10.0, 2.2, -27, g)
  for (const sx of [-6.4, -2.4, -1.4]) for (const sz of [-1.2, 1.2]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.34, 12), M.charcoal)
    wh.rotation.x = Math.PI / 2
    add(wh, sx, 0.5, -27 + sz, g)
  }

  // ---------- 停车场 ----------
  for (let r = 0; r < 2; r++) {
    const pz = 27 + r * 11
    for (let i = 0; i < 13; i++) box(0.14, 0.05, 5.4, M.roadPaint, -19 + i * 3.3, 0.13, pz, g)
    for (let i = 0; i < 6; i++) {
      const cols = [M.paintBlue, M.glazeWhite, M.charcoal, M.paintRed, M.aluPanel, M.paintGreen]
      carAt(g, -17.4 + i * 6.4, pz, r ? Math.PI : 0, cols[(i + r) % 6])
    }
  }
  // EV 充电桩
  for (let i = 0; i < 4; i++) {
    box(0.6, 1.9, 0.5, M.glazeWhite, -12 + i * 4, 0.95, 23.4, g)
    box(0.3, 0.5, 0.2, M.glBlue, -12 + i * 4, 1.5, 23.66, g)
  }
  // 价格塔
  cyl(0.26, 0.34, 12, M.darkFrame, -30, 6, 24, 8, g)
  box(4.2, 3.6, 0.4, M.paintRed, -30, 11.2, 24, g)
  box(3.4, 0.5, 0.12, M.glazeWhite, -30, 12.0, 24.24, g)
  box(2.6, 0.34, 0.12, M.glazeWhite, -30, 11.2, 24.24, g)
  box(2.6, 0.34, 0.12, M.glazeWhite, -30, 10.5, 24.24, g)

  // ---------- 花园区 / 餐饮外摆 ----------
  box(12, 0.4, 10, M.concreteDark, 32, 0.2, -12, g)
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 3; k++) bushAt(g, 28 + k * 3.0, -15 + i * 2.4, 0.5)
  }
  box(12.4, 0.24, 10.4, M.glWhite, 32, 4.6, -12, g)
  for (let i = 0; i < 5; i++) for (const sz of [-1, 1]) cyl(0.1, 0.1, 4.4, M.brightSilver, 27 + i * 2.4, 2.2, -12 + sz * 4.6, 6, g)
  // 外摆桌椅
  for (let i = 0; i < 3; i++) {
    const tx = -18 + i * 4.6
    cyl(0.9, 0.9, 0.08, M.teak, tx, 0.78, 21, 14, g)
    cyl(0.14, 0.2, 0.76, M.darkFrame, tx, 0.4, 21, 8, g)
    for (const sx of [-1, 1]) {
      box(0.42, 0.08, 0.42, M.teak, tx + sx * 1.4, 0.5, 21, g)
      box(0.42, 0.45, 0.08, M.teak, tx + sx * 1.4, 0.72, 21.2, g)
    }
    parasol(g, tx, 21, 1.5, M.paintRed)
  }
  // 绿化 + 灯柱 + 自行车架
  for (let i = 0; i < 5; i++) treeAt(g, -40 + i * 4.6, 44, 1.0)
  for (let i = 0; i < 4; i++) lampPost(g, -22 + i * 17, 42, 8.0, 0)
  for (let i = 0; i < 7; i++) {
    box(0.08, 0.7, 0.08, M.brightSilver, -6 + i * 1.0, 0.35, 19.4, g)
    box(0.85, 0.06, 0.06, M.brightSilver, -5.6 + i * 1.0, 0.7, 19.4, g)
  }
  return { g, top: H + 6 }
}

/** 82 小学（教学楼 + 体育馆 + 200m 跑道，跨 2×2 地块） */
function t82(x, z) {
  const g = group(x, z, 0)
  const fh = 3.9
  const floors = 4
  const H = floors * fh

  // ---------- 主教学楼（南向外廊，L 形） ----------
  const mw = 42
  const md = 11
  const mz = -30
  box(mw, H, md, M.paintYell, -2, H / 2, mz, g)
  box(mw + 0.8, 1.2, md + 0.8, M.tuff, -2, 0.6, mz, g)
  box(mw + 1.0, 0.55, md + 1.0, M.whiteStone, -2, H + 0.27, mz, g)
  // 西翼
  box(11, H, 22, M.paintBlue, -21.5, H / 2, -14, g)
  box(11.8, 0.55, 22.8, M.whiteStone, -21.5, H + 0.27, -14, g)
  box(11.8, 1.2, 22.8, M.tuff, -21.5, 0.6, -14, g)

  for (let f = 0; f < floors; f++) {
    const y = f * fh
    // 北面教室窗
    for (let i = 0; i < 10; i++) {
      const px = -20 + i * 4.0
      win(g, px, y + 2.2, mz - md / 2 - 0.04, Math.PI, 2.4, 1.9, {
        glass: M.glTeal, frame: M.whiteStone, mull: 2, sill: true, sillMat: M.whiteStone,
      })
      if (i % 2 === 0) acUnit(g, px + 1.5, y + 0.6, mz - md / 2 - 0.2, Math.PI)
    }
    // 南向外廊：楼板 + 栏板 + 教室门 + 彩色遮阳板
    box(mw - 1, 0.2, 2.2, M.concrete, -2, y + 0.1, mz + md / 2 + 1.1, g)
    railing(g, mw - 1, y + 0.2, mz + md / 2 + 2.15, M.brightSilver, 20, 1.0)
    for (let i = 0; i < 10; i++) {
      const px = -20 + i * 4.0
      box(1.2, 2.3, 0.14, M.teak, px, y + 1.25, mz + md / 2 + 0.04, g)
      box(1.8, 1.6, 0.12, M.glSmoke, px + 1.2, y + 2.1, mz + md / 2 + 0.04, g)
      if (i % 2 === 0) {
        const col = [M.paintRed, M.paintYell, M.paintBlue][(i / 2) % 3]
        box(3.2, 0.4, 1.8, col, px, y + 3.0, mz + md / 2 + 1.0, g)
      }
    }
    // 西翼东面窗
    for (let i = 0; i < 5; i++) {
      win(g, -15.94, y + 2.2, -22 + i * 4.0, Math.PI / 2, 2.2, 1.9, { glass: M.glTeal, frame: M.whiteStone, mull: 1 })
      win(g, -21.5, y + 2.2, -2.94, 0, 2.2, 1.9, { glass: M.glTeal, frame: M.whiteStone, mull: 1 })
    }
  }
  // 楼梯间外凸 + 竖向色带
  for (const [sx, sz, ww, dd] of [[20.6, -30, 3.8, 4.4], [-21.5, -2.6, 4.0, 4.0]]) {
    box(ww, H + 3.4, dd, M.paintRed, sx, (H + 3.4) / 2, sz, g)
    box(ww + 0.4, 0.4, dd + 0.4, M.whiteStone, sx, H + 3.6, sz, g)
    for (let f = 0; f < floors; f++) box(0.18, 1.1, 1.5, M.glWhite, sx + (sx > 0 ? ww / 2 + 0.02 : -ww / 2 - 0.02), f * fh + 2.4, sz, g)
  }
  // 主入口门厅（L 形转角处）
  box(14, 6.6, 6.0, M.glWhite, -8, 3.3, -21.5, g)
  box(15.6, 0.6, 7.6, M.membrane, -8, 6.8, -21.5, g)
  for (let i = 0; i < 6; i++) box(0.2, 6.6, 0.2, M.aluDark, -14 + i * 2.6, 3.3, -18.5, g)
  box(7.0, 4.4, 0.22, M.glSmoke, -8, 2.2, -18.4, g)
  box(0.22, 4.4, 0.28, M.aluDark, -8, 2.2, -18.28, g)
  steps(g, 16, 3, 0.24, 1.0, 0, M.whiteStone, -18.1)
  box(6.4, 1.2, 0.3, M.paintRed, -8, 7.6, -21.7, g)
  box(4.6, 0.24, 0.1, M.glazeWhite, -8, 7.6, -21.5, g)
  // 主楼屋面：太阳能 + 电梯机房 + 水箱
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.8), M.glDeepBlue)
    p.position.set(-18 + i * 4.6, H + 1.4, mz + 2)
    p.rotation.x = -0.42
    p.castShadow = true
    g.add(p)
  }
  box(4.4, 3.0, 4.0, M.aluPanel, 12, H + 1.8, mz, g)
  cyl(1.8, 1.8, 2.2, M.brightSilver, -16, H + 1.6, mz - 3, 16, g)
  parapet(g, mw, md, H + 0.55, M.paintYell, 0.8, 0.28)

  // ---------- 体育馆 ----------
  const gx = 26
  const gz = 6
  box(28, 10, 20, M.plasterGrey, gx, 5, gz, g)
  box(29.0, 1.0, 21.0, M.whiteStone, gx, 10.5, gz, g)
  box(27, 3.0, 0.24, M.glSmoke, gx, 4.4, gz + 10.06, g)
  for (let i = 0; i < 8; i++) box(0.16, 3.0, 0.3, M.aluDark, gx - 12 + i * 3.4, 4.4, gz + 10.14, g)
  barrelRoof(g, 28.6, 10.6, 10.8, M.membrane, gz)
  vaultRibs(g, 28.6, 10.66, 10.8, M.brightSilver, 8, gz)
  for (const sx of [-1, 1]) {
    box(0.24, 6.0, 14, M.glTeal, gx + sx * 14.02, 5.5, gz, g)
    for (let i = 0; i < 6; i++) box(0.3, 6.0, 0.16, M.aluDark, gx + sx * 14.1, 5.5, gz - 6.5 + i * 2.6, g)
  }
  // 体育馆入口 + 雨篷
  box(8, 4.2, 3.4, M.glWhite, gx, 2.1, gz + 11.8, g)
  box(9.4, 0.5, 4.6, M.brightSilver, gx, 4.5, gz + 12.0, g)
  steps(g, 9, 2, 0.22, 1.0, 0, M.whiteStone, gz + 14.0)
  // 体育馆侧面：器材库门 + 空调

  // ---------- 200m 跑道 + 球场 ----------
  const tx = 0
  const tz = 34
  const track = new THREE.Mesh(new THREE.RingGeometry(14, 18, 48), M.paintRed)
  track.rotation.x = -Math.PI / 2
  track.scale.set(1.62, 1, 1)
  add(track, tx, 0.12, tz, g)
  const infield = new THREE.Mesh(new THREE.CircleGeometry(14, 44), M.greenSoft)
  infield.rotation.x = -Math.PI / 2
  infield.scale.set(1.62, 1, 1)
  add(infield, tx, 0.11, tz, g)
  // 跑道分道线
  for (let k = 0; k < 4; k++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(14.5 + k, 14.62 + k, 48), M.glazeWhite)
    ring.rotation.x = -Math.PI / 2
    ring.scale.set(1.62, 1, 1)
    add(ring, tx, 0.14, tz, g)
  }
  // 足球场：白线 + 球门 + 中圈
  box(48, 0.05, 18.6, M.greenSoft, tx, 0.15, tz, g)
  for (const sz of [-1, 1]) {
    box(48, 0.05, 0.14, M.roadPaint, tx, 0.17, tz + sz * 9.3, g)
    box(0.14, 0.05, 18.6, M.roadPaint, tx + sz * 24, 0.17, tz, g)
    // 球门
    for (const ox of [-3.2, 3.2]) cyl(0.09, 0.09, 2.4, M.glazeWhite, tx + sz * 22.6, 1.2, tz + ox, 6, g)
    box(0.1, 0.1, 6.4, M.glazeWhite, tx + sz * 22.6, 2.4, tz, g)
  }
  const mid = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.55, 32), M.glazeWhite)
  mid.rotation.x = -Math.PI / 2
  add(mid, tx, 0.17, tz, g)
  // 篮球场 ×2
  for (const [bx, bz] of [[-34, 12], [-34, 26]]) {
    box(15.2, 0.1, 8.6, M.concrete, bx, 0.12, bz, g)
    for (const sz of [-1, 1]) box(15.0, 0.04, 0.1, M.roadPaint, bx, 0.2, bz + sz * 4.2, g)
    box(0.1, 0.04, 8.4, M.glazeWhite, bx, 0.2, bz, g)
    for (const sx of [-1, 1]) {
      cyl(0.12, 0.16, 3.4, M.brightSilver, bx + sx * 6.4, 1.7, bz, 8, g)
      box(1.8, 0.1, 1.1, M.glazeWhite, bx + sx * 5.8, 3.2, bz, g)
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 5, 14), M.paintRed)
      hoop.rotation.x = Math.PI / 2
      add(hoop, bx + sx * 5.4, 2.9, bz, g)
    }
  }
  // 跳远沙坑 + 看台
  box(9, 0.1, 4.0, M.paintYell, -30, 0.12, 40, g)
  for (let i = 0; i < 3; i++) box(22, 0.55, 1.4, M.concrete, tx, 0.3 + i * 0.55, tz - 20 - i * 1.4, g)

  // ---------- 校门 / 围墙 / 旗杆 ----------
  for (let i = 0; i < 10; i++) {
    box(0.22, 2.0, 0.22, M.paintBlue, -44 + i * 9.6, 1.0, 46, g)
  }
  box(90, 0.1, 0.1, M.paintBlue, 0, 2.0, 46, g)
  box(90, 0.1, 0.1, M.paintBlue, 0, 1.1, 46, g)
  for (const [px, ww] of [[-2, 14], [12, 10]]) {
    box(ww, 0.9, 1.6, M.tuff, px, 0.45, 46, g)
    box(ww + 0.6, 0.3, 2.0, M.whiteStone, px, 0.95, 46, g)
  }
  box(3.2, 3.4, 3.2, M.brick, 20, 1.7, 46, g)
  box(3.8, 0.4, 3.8, M.whiteStone, 20, 3.6, 46, g)
  box(2.2, 1.4, 0.16, M.glSmoke, 20, 2.4, 47.62, g)
  box(9.0, 2.0, 0.6, M.paintRed, -20, 2.6, 46, g)
  box(7.6, 0.4, 0.1, M.glazeWhite, -20, 2.9, 46.34, g)
  // 旗杆
  cyl(0.1, 0.15, 15, M.brightSilver, -8, 7.5, 38, 8, g)
  box(2.2, 1.4, 0.08, M.paintRed, -6.9, 13.2, 38, g)
  // 自行车棚
  box(14, 0.2, 3.4, M.brightSilver, 32, 3.0, 38, g)
  for (let i = 0; i < 6; i++) cyl(0.08, 0.08, 3.0, M.brightSilver, 26 + i * 2.4, 1.5, 36.6, 6, g)
  for (let i = 0; i < 8; i++) {
    box(0.08, 0.7, 0.08, M.darkFrame, 26 + i * 1.7, 0.35, 38.4, g)
    box(1.4, 0.06, 0.06, M.darkFrame, 26.6 + i * 1.7, 0.7, 38.4, g)
  }
  // 绿化 / 灯 / 垃圾桶
  for (let i = 0; i < 5; i++) treeAt(g, -40 + i * 9, 44, 1.0)
  for (let i = 0; i < 4; i++) treeAt(g, -36 + i * 6, -40, 1.0)
  for (let i = 0; i < 3; i++) lampPost(g, -34 + i * 16, 22, 6.0, Math.PI)
  for (const [bx, bz] of [[-12, 20], [10, 20], [-30, 44]]) benchAt(g, bx, bz, Math.PI)
  return { g, top: H + 12 }
}

/** 83 幼儿园 */
function t83(x, z) {
  const g = group(x, z, 0)
  // 三个彩色体块
  box(13, 4.6, 9.4, M.plaster, -5, 2.3, -3, g)
  box(8.8, 6.8, 8.4, M.paintYell, 5.8, 3.4, -4, g)
  box(6.6, 3.6, 6.6, M.paintBlue, 7.2, 1.8, 5, g)
  box(13.4, 0.42, 9.8, M.paintRed, -5, 4.8, -3, g)
  box(9.2, 0.5, 8.8, M.tileRed, 5.8, 7.1, -4, g)
  box(7.0, 0.4, 7.0, M.whiteStone, 7.2, 3.8, 5, g)
  // 圆窗 + 彩色窗 + 窗套
  const cw = new THREE.Mesh(new THREE.CircleGeometry(1.7, 22), M.glazeWhite)
  add(cw, 5.8, 3.9, 0.26, g)
  const cwr = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.13, 5, 22), M.paintRed)
  add(cwr, 5.8, 3.9, 0.3, g)
  for (let i = 0; i < 3; i++) {
    win(g, -9.2 + i * 3.2, 2.7, 1.74, 0, 1.9, 1.5, { glass: M.glTeal, frame: M.whiteStone, mull: 1 })
    win(g, -9.2 + i * 3.2, 2.7, -7.74, Math.PI, 1.9, 1.5, { glass: M.glTeal, frame: M.whiteStone })
    win(g, -3.0 + i * 2.0, 2.4, 8.24, 0, 1.6, 1.5, { glass: M.glAmber, frame: M.whiteStone })
  }
  win(g, 4.4, 5.4, 0.26, 0, 1.4, 1.4, { glass: M.glWhite, frame: M.paintBlue })
  win(g, 7.2, 5.6, 0.26, 0, 1.4, 1.4, { glass: M.glWhite, frame: M.paintBlue })
  // 主入口：门斗 + 雨篷 + 台阶 + 门牌
  box(8.0, 3.6, 2.6, M.glWhite, -5, 1.8, 3.8, g)
  box(9.0, 0.42, 3.6, M.paintRed, -5, 3.9, 3.9, g)
  box(3.0, 2.6, 0.2, M.teak, -5, 1.3, 5.16, g)
  box(2.2, 1.4, 0.12, M.glSmoke, -5, 1.7, 5.26, g)
  steps(g, 9, 2, 0.2, 0.7, 0, M.paintYell, 5.3)
  box(5.0, 1.1, 0.26, M.paintBlue, -5, 4.9, 3.6, g)
  box(3.2, 0.24, 0.1, M.glazeWhite, -5, 4.9, 3.76, g)

  // 活动场地：沙坑 + 滑梯 + 攀爬架 + 戏水盘
  box(6.0, 0.12, 5.0, M.sandstone, -10, 0.1, 9.5, g)
  box(2.8, 0.16, 2.4, M.paintYell, -11.4, 1.7, 8.2, g)
  cyl(0.14, 0.14, 1.6, M.paintGreen, -10.2, 0.8, 8.2, 8, g)
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 3.6), M.paintBlue)
  slide.position.set(-12.9, 0.95, 10.4)
  slide.rotation.x = 0.44
  slide.castShadow = true
  g.add(slide)
  // 攀爬架
  for (const sx of [-1, 1]) {
    box(0.16, 2.4, 0.16, M.paintRed, -2, 1.2, 11 + sx * 1.4, g)
    box(0.16, 2.4, 0.16, M.paintRed, 0.4, 1.2, 11 + sx * 1.4, g)
  }
  for (let i = 0; i < 4; i++) box(2.6, 0.14, 0.14, M.paintBlue, -0.8, 0.6 + i * 0.6, 11, g)
  // 戏水盘
  cyl(2.0, 2.0, 0.4, M.whiteStone, 6, 0.2, 12, 20, g)
  cyl(1.8, 1.8, 0.1, M.glTeal, 6, 0.42, 12, 20, g)
  // 小树 + 围栏 + 大门
  for (const [tx, tz] of [[-14, 2], [-14, 12], [13, 8], [12, 12]]) {
    cyl(0.18, 0.24, 2.8, M.bark, tx, 1.4, tz, 8, g)
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.4, 11, 8), M.leaf)
    c.scale.set(1, 1.05, 1)
    c.castShadow = true
    add(c, tx, 3.6, tz, g)
  }
  for (let i = 0; i < 12; i++) box(0.12, 1.5, 0.12, M.paintGreen, -16 + i * 2.9, 0.75, 16.4, g)
  box(34, 0.12, 0.12, M.paintGreen, 0, 1.5, 16.4, g)
  box(34, 0.12, 0.12, M.paintGreen, 0, 0.7, 16.4, g)
  box(3.4, 2.2, 0.2, M.paintGreen, 0, 1.1, 16.4, g)
  return { g, top: 10 }
}

/** 84 游泳馆（50m 比赛池 + 跳水池 + 看台，跨 2×2 地块） */
function t84(x, z) {
  const g = group(x, z, 0)
  const w = 76
  const d = 44
  const H = 11.0
  const cx = 2

  // ---------- 基座与外墙 ----------
  box(w + 1.2, 0.8, d + 1.2, M.concrete, cx, 0.4, 0, g)
  box(w + 1.8, 0.24, d + 1.8, M.whiteStone, cx, 0.9, 0, g)
  // 南北立面：矮墙 + 通高玻璃 + 竖梃
  for (const sz of [-1, 1]) {
    box(w, 2.2, 0.4, M.whiteStone, cx, 1.1 + 0.8, sz * d / 2, g)
    box(w - 1.2, H - 2.4, 0.16, M.glTeal, cx, 0.8 + 2.2 + (H - 2.4) / 2, sz * (d / 2 + 0.04), g)
    for (let i = 0; i <= 24; i++) box(0.14, H - 2.4, 0.24, M.aluDark, cx - w / 2 + (w / 24) * i, 0.8 + 2.2 + (H - 2.4) / 2, sz * (d / 2 + 0.1), g)
    for (const oy of [0.8 + 2.2, 0.8 + H - 0.15]) box(w, 0.22, 0.3, M.aluDark, cx, oy, sz * (d / 2 + 0.12), g)
    // 玻璃分格横档
    for (const oy of [0.8 + 4.8, 0.8 + 7.4]) box(w - 1.2, 0.1, 0.24, M.aluPanel, cx, oy, sz * (d / 2 + 0.12), g)
  }
  for (const sx of [-1, 1]) {
    box(0.4, H + 1.2, d, M.whiteStone, cx + sx * w / 2, 0.8 + (H + 1.2) / 2, 0, g)
    box(0.16, H - 3.4, d - 3, M.glTeal, cx + sx * (w / 2 + 0.08), 0.8 + 2.6 + (H - 3.4) / 2, 0, g)
    for (let i = 0; i < 10; i++) box(0.24, H - 3.4, 0.14, M.aluDark, cx + sx * (w / 2 + 0.14), 0.8 + 2.6 + (H - 3.4) / 2, -d / 2 + 2.4 + i * ((d - 4.8) / 9), g)
  }
  // 筒拱屋面 + 拱肋 + 屋面通风带
  barrelRoof(g, w + 1.0, d / 2 + 1.6, H + 0.8, M.membrane, 0)
  vaultRibs(g, w + 1.0, d / 2 + 1.66, H + 0.8, M.brightSilver, 14, 0)
  for (const [px, pz] of [[-26, 12], [0, 12], [26, 12], [-26, -12], [0, -12], [26, -12]]) {
    box(4.0, 1.4, 2.6, M.aluPanel, cx + px, H + 3.4, pz, g)
  }
  for (const [px, pz] of [[-13, 16], [13, 16]]) cyl(1.6, 1.6, 1.2, M.aluDark, cx + px, H + 6.2, pz, 14, g)

  // ---------- 比赛池 50×25（10 泳道） ----------
  const px = cx - 10
  box(52, 0.7, 27, M.whiteStone, px, 1.05, 0, g)
  box(50, 0.16, 25, M.glTeal, px, 1.4, 0, g)
  // 池壁 + 溢水沟 + 池边平台
  for (const sz of [-1, 1]) {
    box(50, 0.14, 0.7, M.curb, px, 1.46, sz * 12.5, g)
    for (let i = 0; i < 50; i++) box(0.5, 0.06, 0.14, M.roadPaint, px - 25 + 1 + i, 1.47, sz * 12.5, g)
  }
  // 10 条泳道线（水线）
  for (let i = 1; i < 10; i++) {
    box(50, 0.05, 0.12, i % 2 ? M.roadPaint : M.paintBlue, px, 1.49, -12.5 + i * 2.5, g)
  }
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.03, 4, 20), M.glazeWhite)
    ring.rotation.x = Math.PI / 2
    add(ring, px + 25 - 2.5, 1.49, -10 + i * 5, g)
  }
  // 出发台（10 座，两端）
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const lz = -11.25 + i * 2.5
      box(0.9, 0.62, 0.9, M.glazeWhite, px + sx * 26.0, 1.42, lz, g)
      box(0.86, 0.1, 0.86, M.paintBlue, px + sx * 26.0, 1.76, lz, g)
      box(0.12, 0.45, 0.1, M.brightSilver, px + sx * 26.0, 1.55, lz + 1.1, g)
    }
  }
  // 池边扶手 / 救生椅 / 起跳牌
  for (const [lz, sx] of [[12, 1], [-12, 1], [12, -1]]) {
    for (const oz of [-0.35, 0.35]) cyl(0.05, 0.05, 0.9, M.brightSilver, px + sx * 26.2, 1.9, lz + oz, 6, g)
    box(0.06, 0.06, 0.8, M.brightSilver, px + sx * 26.2, 2.35, lz, g)
  }
  for (const bx of [px - 18, px + 18]) {
    box(1.1, 0.14, 1.1, M.paintRed, bx, 2.5, 14.6, g)
    box(1.1, 1.4, 0.14, M.paintRed, bx, 3.2, 15.1, g)
    for (const ox of [-0.45, 0.45]) for (const oz of [-0.45, 0.45]) cyl(0.05, 0.05, 2.4, M.brightSilver, bx + ox, 1.2, 14.6 + oz, 5, g)
  }
  // 仰泳转身标志旗
  box(54, 0.06, 0.06, M.brightSilver, px, 5.4, -1, g)
  for (let i = 0; i < 13; i++) box(0.4, 0.4, 0.06, M.paintRed, px - 27 + i * 4.4, 5.15, -1, g)

  // ---------- 跳水池 + 跳台 ----------
  const dx = cx + 27
  box(22, 0.7, 22, M.whiteStone, dx, 1.05, -2, g)
  box(20, 0.16, 20, M.glTeal, dx, 1.4, -2, g)
  box(20, 0.05, 0.14, M.roadPaint, dx, 1.49, -12.0, g)
  for (const [plx, ph, pz] of [[-6, 3.0, -13], [-2, 5.0, -13], [2, 7.5, -13], [6, 10.0, -13]]) {
    cyl(0.42, 0.62, ph, M.concrete, dx + plx, ph / 2 + 0.8, pz, 14, g)
    box(3.2, 0.3, 3.0, M.concrete, dx + plx, ph + 0.95, pz, g)
    box(2.8, 0.12, 0.6, M.glazeWhite, dx + plx, ph + 1.14, pz + 1.2, g)
    for (const ox of [-1.2, 1.2]) cyl(0.04, 0.04, 0.9, M.brightSilver, dx + plx + ox, ph + 1.5, pz + 1.4, 5, g)
  }
  // 跳台后墙 + 楼梯
  box(24, 11, 0.5, M.concrete, dx, 5.8, -14.4, g)
  for (let k = 0; k < 11; k++) box(1.4, 0.22, 0.5, M.brightSilver, dx - 12.6, 0.9 + k * 0.9, -13.6, g)
  // 水下观察窗
  for (const oz of [-6, 4]) box(3.0, 1.6, 0.24, M.glDeepBlue, dx + 11.0, 1.6, -2 + oz, g)

  // ---------- 看台（北侧 10 排，约 500 座） ----------
  for (let i = 0; i < 10; i++) {
    const zz = -16.4 - i * 1.25
    box(58, 0.62, 1.3, M.concrete, cx, 0.62 + i * 0.62, zz, g)
    box(57.2, 0.12, 0.9, i % 3 === 0 ? M.paintYell : M.paintBlue, cx, 0.96 + i * 0.62, zz, g)
  }
  // 看台栏板 + 台阶通道
  railing(g, 58, 0.62 + 6.2, -28.3, M.brightSilver, 26, 1.05)
  for (const ox of [-22, 0, 22]) {
    for (let i = 0; i < 10; i++) box(1.4, 0.62, 1.3, M.concrete, cx + ox, 0.62 + i * 0.62, -16.4 - i * 1.25, g)
  }
  // 西端活动看台
  for (let i = 0; i < 6; i++) {
    box(1.2, 0.6, 20, M.concrete, cx - 32 + i * 1.2, 0.6 + i * 0.6, -2, g)
  }
  // 大屏 + 计时牌
  box(16, 5.4, 0.6, M.darkFrame, cx - 6, 9.2, -28.4, g)
  box(15.2, 4.6, 0.2, M.glDeepBlue, cx - 7.4, 9.2, -28.1, g)
  for (let i = 0; i < 3; i++) box(4.2, 0.9, 0.1, M.glazeWhite, cx - 13.4 + i * 5.0, 9.2, -28.0, g)
  box(10, 1.6, 0.4, M.paintRed, cx + 24, 8.4, -28.2, g)
  box(8.6, 0.9, 0.1, M.glazeWhite, cx + 24, 8.4, -28.0, g)

  // ---------- 更衣 / 检录 / 热身区 ----------
  for (let i = 0; i < 6; i++) {
    box(3.2, 2.6, 0.24, M.teak, cx - 30 + i * 4.2, 2.2, 20.0, g)
    box(1.8, 2.2, 0.1, M.glSmoke, cx - 30 + i * 4.2, 2.1, 20.16, g)
  }
  box(30, 0.3, 4.2, M.whiteStone, cx - 20, 4.4, 20.0, g)
  for (let i = 0; i < 8; i++) cyl(0.12, 0.12, 3.6, M.brightSilver, cx - 33 + i * 3.6, 2.2, 21.9, 6, g)
  // 热身池 25×12
  box(27, 0.5, 14, M.whiteStone, cx + 26, 0.75, 15, g)
  box(25, 0.12, 12, M.glTeal, cx + 26, 1.0, 15, g)
  for (let i = 1; i < 5; i++) box(25, 0.04, 0.1, M.roadPaint, cx + 26, 1.06, 9 + i * 2.4, g)
  // 池边躺椅
  for (let i = 0; i < 4; i++) lounger(g, cx + 14 + i * 3.2, 16, Math.PI)

  // ---------- 入口门厅 ----------
  const ez = d / 2 + 2.0
  box(26, 7.4, 6.0, M.glWhite, cx - 8, 3.7, ez + 1.6, g)
  box(27.6, 0.7, 7.4, M.brightSilver, cx - 8, 7.9, ez + 1.8, g)
  for (let i = 0; i < 8; i++) box(0.2, 7.4, 0.2, M.aluDark, cx - 20 + i * 3.4, 3.7, ez + 4.4, g)
  box(10, 4.6, 0.24, M.glSmoke, cx - 8, 2.3, ez + 4.55, g)
  box(0.24, 4.6, 0.3, M.aluDark, cx - 8, 2.3, ez + 4.68, g)
  steps(g, 28, 3, 0.24, 1.0, 0, M.whiteStone, ez + 4.8)
  box(10, 1.2, 0.3, M.paintBlue, cx - 8, 8.9, ez + 1.6, g)
  box(7.4, 0.24, 0.1, M.glazeWhite, cx - 8, 8.9, ez + 1.78, g)
  // 售票窗 + 检票闸机
  for (let i = 0; i < 4; i++) {
    box(2.2, 2.2, 0.2, M.glazeWhite, cx - 19 + i * 2.6, 2.0, ez + 4.5, g)
    box(2.4, 0.5, 0.7, M.whiteStone, cx - 19 + i * 2.6, 3.2, ez + 4.7, g)
  }

  // ---------- 场地 ----------
  paved(g, cx - 2, 34, 44, 14, M.paving, 2.6, 'x')
  for (let i = 0; i < 8; i++) box(0.14, 0.05, 5.0, M.roadPaint, cx - 30 + i * 6, 0.13, 34, g)
  for (let i = 0; i < 5; i++) carAt(g, cx - 28 + i * 6, 34, 0, [M.paintBlue, M.glazeWhite, M.charcoal, M.paintRed, M.aluPanel][i])
  for (let i = 0; i < 5; i++) treeAt(g, cx - 38 + i * 15, 42, 1.0)
  for (const [lx, lz] of [[cx - 34, 28], [cx + 20, 30], [cx + 34, 22]]) lampPost(g, lx, lz, 7.0, 0)
  // 国旗三面
  for (let i = 0; i < 3; i++) {
    cyl(0.08, 0.12, 13, M.brightSilver, cx - 34 + i * 2.8, 6.5, 24, 8, g)
    box(1.7, 1.0, 0.06, [M.paintRed, M.paintBlue, M.paintYell][i], cx - 33.1 + i * 2.8, 11.9, 24, g)
  }
  return { g, top: H + 26 }
}

/** 85 火车站（跨 2 格） */
function t85(x, z) {
  const g = group(x, z, 0)
  const H = 13
  const sw = 46
  const sd = 16

  // 站房：砖墙 + 石材勒脚与檐口 + 壁柱
  box(sw, H, sd, M.brick, 0, H / 2, 4, g)
  box(sw + 1.0, 1.5, sd + 1.0, M.tuff, 0, 0.75, 4, g)
  box(sw + 1.2, 1.0, sd + 1.2, M.whiteStone, 0, H + 0.5, 4, g)
  box(sw + 1.4, 0.32, sd + 1.4, M.whiteStone, 0, H + 1.16, 4, g)
  for (let i = 0; i < 11; i++) {
    const px = -21 + i * 4.2
    box(0.95, H - 1.6, 0.5, M.tuff, px, (H - 1.6) / 2 + 0.8, 12.02, g)
    if (i < 10) win(g, px + 2.1, 8.2, 12.06, 0, 2.5, 4.4, { glass: M.glAmber, frame: M.whiteStone, mull: 2, transom: true })
  }
  // 二层窗
  for (let i = 0; i < 10; i++) win(g, -18.9 + i * 4.2, 4.2, 12.06, 0, 1.6, 1.5, { glass: M.glWhite, frame: M.whiteStone, mull: 1 })

  // 中央钟塔
  box(7.4, 30, 7.4, M.brick, 0, 15, 4, g)
  box(8.2, 0.7, 8.2, M.whiteStone, 0, 29.6, 4, g)
  box(8.6, 0.4, 8.6, M.whiteStone, 0, 30.6, 4, g)
  const clk = new THREE.Mesh(new THREE.CircleGeometry(2.2, 26), M.glazeWhite)
  add(clk, 0, 25.4, 7.72, g)
  const clkRing = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.2, 6, 26), M.copperAged)
  add(clkRing, 0, 25.4, 7.74, g)
  box(0.2, 1.7, 0.1, M.charcoal, 0, 26.0, 7.84, g)
  box(1.25, 0.2, 0.1, M.charcoal, 0.55, 25.4, 7.84, g)
  hipRoof(g, 7.4, 7.4, 30.8, 7.0, M.copperAged, 0.7, 0, 4)
  // 塔身竖窗
  for (const oy of [17.5, 21]) {
    for (let i = 0; i < 3; i++) archPanel(1.2, 2.6, 0.16, M.glAmber, -2.2 + i * 2.2, oy, 7.72, g)
  }

  // 入口柱廊 + 雨篷 + 大台阶
  colonnade(g, 26, 0, 9.6, M.whiteStone, 18.6, 8, 0.62)
  box(26, 10.4, 0.6, M.glSmoke, 0, 5.2, 12.4, g)
  for (let i = 0; i < 8; i++) box(0.3, 10.4, 0.3, M.whiteStone, -12 + i * 3.43, 5.2, 12.5, g)
  box(28.4, 1.0, 3.4, M.whiteStone, 0, 10.4, 18.6, g)
  box(28.4, 0.28, 0.5, M.copperAged, 0, 10.96, 20.1, g)
  steps(g, 30, 5, 0.32, 1.1, 0, M.whiteStone, 20.6)
  for (const sx of [-1, 1]) planter(g, sx * 17, 22.5, 6, 1.8)

  // 站台区：道砟 + 枕木 + 钢轨 + 站台 + 筒拱雨棚
  const railZ = [-8, -18, -28]
  for (const rz of railZ) {
    box(74, 0.35, 3.4, M.charcoal, 0, 0.16, rz, g)
    for (let i = 0; i < 50; i++) box(0.5, 0.12, 2.6, M.bark, -36 + i * 1.48, 0.38, rz, g)
    for (const o of [-0.72, 0.72]) box(74, 0.16, 0.18, M.brightSilver, 0, 0.5, rz + o, g)
  }
  for (const pz of [-13, -23]) {
    box(70, 1.0, 6.4, M.concrete, 0, 0.5, pz, g)
    for (let i = 0; i < 3; i++) box(70, 0.05, 0.14, M.roadPaint, 0, 1.03, pz - 1.6 + i * 1.6, g)
    box(70, 0.12, 0.3, M.paintYell, 0, 1.04, pz + 3.05, g)
    for (let i = 0; i < 14; i++) {
      const px = -33 + i * 5.1
      cyl(0.18, 0.24, 5.6, M.brightSilver, px, 1 + 2.8, pz + 2.6, 8, g)
      box(1.5, 0.1, 0.8, M.brightSilver, px, 6.6, pz + 2.6, g)
      box(1.0, 0.5, 0.14, M.paintBlue, px, 6.0, pz + 2.6, g)
    }
  }
  // 雨棚（跨整片站台）
  barrelRoof(g, 72, 13.4, 7.0, M.glFrit, -18)
  vaultRibs(g, 72, 13.46, 7.0, M.brightSilver, 16, -18)
  for (const oy of [-4.2, 4.2]) {
    cyl(0.28, 0.28, 72, M.brightSilver, 0, 7.0, -22.2 + (oy > 0 ? 8.4 : 0), 8, g).rotation.z = Math.PI / 2
  }

  // 广场：出租车落客 + 停车 + 灯柱 + 行道树
  box(66, 0.1, 8, M.paving, 0, 0.06, 26, g)
  for (let i = 0; i < 9; i++) box(0.14, 0.05, 5.4, M.roadPaint, -24 + i * 6, 0.13, 25.4, g)
  for (let i = 0; i < 6; i++) {
    cyl(0.12, 0.16, 6.4, M.darkFrame, -30 + i * 12, 3.2, 23, 6, g)
    box(1.2, 0.24, 0.4, M.glazeWhite, -30 + i * 12, 6.5, 23, g)
  }
  for (let i = 0; i < 10; i++) {
    const tx = -36 + i * 8
    cyl(0.18, 0.26, 3.6, M.bark, tx, 1.8, 30.4, 8, g)
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), M.leaf)
    c.scale.set(1, 1.15, 1)
    c.castShadow = true
    add(c, tx, 4.6, 30.4, g)
  }
  return { g, top: 38 }
}

/** 86 地铁站入口 */
function t86(x, z) {
  const g = group(x, z, 0.24)
  // 下沉口（用深色板假装井口，避免挖穿地坪）
  box(11, 0.06, 14, M.charcoal, 0, 0.05, -1, g)
  for (let i = 0; i < 5; i++) box(9, 0.04, 0.24, M.glazeWhite, 0, 0.09, 0.6 - i * 1.1, g)
  for (const sx of [-1, 1]) box(0.14, 1.1, 14, M.brightSilver, sx * 4.4, 0.55, -1, g)
  // 玻璃亭（入口）：幕墙分格 + 竖梃 + 门斗 + 顶灯带
  box(11, 4.0, 9, M.glWhite, 0, 2.0, 7.6, g)
  box(11.6, 0.5, 9.6, M.brightSilver, 0, 4.2, 7.6, g)
  gridGlass(g, 0, 2.0, 12.11, 0, 9.4, 3.4, 5, 2, { glass: M.glSmoke, frame: M.brightSilver, mw: 0.1, mh: 0.12 })
  for (let i = 0; i < 5; i++) box(0.16, 4.0, 0.16, M.brightSilver, -5 + i * 2.5, 2.0, 11.9, g)
  for (const sz of [-1, 1]) {
    box(0.16, 4.0, 8.8, M.brightSilver, 5.54, 2.0, 7.6 + sz * 0.1, g)
    box(0.16, 4.0, 8.8, M.brightSilver, -5.54, 2.0, 7.6, g)
  }
  for (let i = 0; i < 4; i++) box(10.8, 0.12, 0.22, M.glWhite, 0, 3.9, 4 + i * 2.4, g)
  // 闸机 + 售票机 + 导视牌
  for (let i = 0; i < 3; i++) {
    box(0.9, 1.1, 0.6, M.brightSilver, -3 + i * 2.2, 0.55, 9.4, g)
    box(0.1, 0.16, 0.7, M.glBlue, -3 + i * 2.2, 1.2, 9.6, g)
  }
  box(1.1, 1.8, 0.7, M.paintBlue, 4.2, 0.9, 9.2, g)
  box(0.8, 0.5, 0.1, M.glazeWhite, 4.2, 1.4, 9.58, g)
  box(3.2, 0.7, 0.14, M.paintRed, 0, 3.4, 12.0, g)
  box(2.4, 0.16, 0.1, M.glazeWhite, 0, 3.4, 12.08, g)
  // 标志柱
  cyl(0.2, 0.24, 7.0, M.paintRed, -5.6, 3.5, 6.4, 8, g)
  box(2.8, 1.0, 0.14, M.paintRed, -5.6, 6.8, 6.4, g)
  box(1.8, 0.14, 0.12, M.glazeWhite, -5.6, 6.8, 6.48, g)
  return { g, top: 9 }
}

/** 87 汽车站 */
function t87(x, z) {
  const g = group(x, z, -0.06)
  box(24, 7, 12, M.plasterGrey, 0, 3.5, -7, g)
  box(24.6, 0.6, 12.6, M.aluPanel, 0, 7.3, -7, g)
  box(20, 3.4, 0.2, M.glSmoke, 0, 2.6, -1.06, g)
  for (let i = 0; i < 5; i++) box(1.0, 3.4, 0.3, M.aluDark, -8 + i * 4, 2.6, -1.0, g)
  // 站房侧墙与二层窗
  for (const sx of [-1, 1]) {
    win(g, sx * 12.02, 2.6, -5.5, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 2.4, 2.6, { glass: M.glTeal, frame: M.aluPanel, mull: 2 })
    win(g, sx * 12.02, 5.6, -5.5, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 2.4, 2.0, { glass: M.glTeal, frame: M.aluPanel, mull: 1 })
  }
  for (let i = 0; i < 5; i++) win(g, -8 + i * 4.0, 5.6, -0.94, 0, 2.4, 1.8, { glass: M.glTeal, frame: M.aluPanel, mull: 1 })
  // 站房门斗 + 雨棚
  box(9, 3.6, 1.6, M.glWhite, 0, 1.8, -0.2, g)
  box(10, 0.4, 2.6, M.aluPanel, 0, 3.9, -0.2, g)
  box(5.0, 3.0, 0.16, M.glSmoke, 0, 1.6, 0.62, g)
  box(0.14, 3.0, 0.22, M.aluDark, 0, 1.6, 0.72, g)
  // 候车厅座椅 + 时刻表
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 5; i++) {
      box(2.0, 0.12, 0.6, M.paintBlue, -8 + i * 4, 0.62, -3.2 + r * 2.2, g)
      box(2.0, 0.5, 0.1, M.paintBlue, -8 + i * 4, 0.95, -3.5 + r * 2.2, g)
      for (const ox of [-0.8, 0.8]) box(0.08, 0.6, 0.5, M.darkFrame, -8 + i * 4 + ox, 0.3, -3.2 + r * 2.2, g)
    }
  }
  box(3.6, 1.8, 0.16, M.glDeepBlue, 0, 4.6, -0.94, g)
  for (let i = 0; i < 5; i++) box(3.0, 0.1, 0.06, M.roadPaint, 0, 5.3 - i * 0.28, -0.84, g)
  // 长雨棚
  box(30, 0.5, 9, M.membrane, 0, 5.8, 4.5, g)
  for (let i = 0; i < 6; i++) cyl(0.2, 0.2, 5.6, M.brightSilver, -12.5 + i * 5, 2.8, 8.4, 8, g)
  for (let i = 0; i < 7; i++) box(26, 0.1, 0.26, M.glWhite, 0, 5.5, 1.2 + i * 1.1, g)
  for (let i = 0; i < 6; i++) box(0.5, 0.16, 1.4, M.glazeWhite, -12.5 + i * 5, 5.5, 8.4, g)
  box(30, 0.22, 9, M.concrete, 0, 0.11, 4.5, g)
  // 大巴
  for (const px of [-8, 0, 8]) {
    box(11, 3.0, 2.8, M.glazeWhite, px, 1.75, 3.2, g)
    box(11, 0.8, 2.8, M.paintBlue, px, 0.55, 3.2, g)
    box(2.6, 1.4, 2.84, M.glSmoke, px - 3.6, 2.2, 3.2, g)
    for (const sx of [-3.6, 3.6]) for (const sz of [-1.2, 1.2]) {
      cyl(0.45, 0.45, 0.4, M.charcoal, px + sx, 0.5, 3.2 + sz, 10, g)
    }
  }
  // 站牌
  cyl(0.12, 0.16, 5.2, M.darkFrame, -13, 2.6, 9.4, 6, g)
  box(2.2, 1.2, 0.12, M.paintBlue, -13, 5.4, 9.4, g)
  return { g, top: 9 }
}

/** 88 机场航站楼（跨 2 格） */
function t88(x, z) {
  const g = group(x, z, 0)
  const w = 62
  const d = 22
  const H = 12

  // 航站楼主体 + 勒脚
  box(w, H, d, M.aluPanel, 0, H / 2, -4, g)
  box(w + 1.2, 1.0, d + 1.2, M.concrete, 0, 0.5, -4, g)
  // 前后玻璃幕带（细分格）
  for (const sz of [-1, 1]) {
    gridGlass(g, 0, 5.6, -4 + sz * (d / 2 + 0.08), sz > 0 ? 0 : Math.PI, w * 0.95, 7.2, 26, 3, {
      glass: M.glSmoke, frame: M.aluDark, mw: 0.11, mh: 0.2,
    })
    box(w * 0.97, 0.42, 0.34, M.aluDark, 0, 9.5, -4 + sz * (d / 2 + 0.14), g)
    box(w * 0.97, 0.42, 0.34, M.aluDark, 0, 1.9, -4 + sz * (d / 2 + 0.14), g)
  }
  // 端墙竖向铝板分格
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 9; i++) box(0.5, H, 1.2, M.aluPanel, sx * (w / 2 + 0.1), H / 2, -13 + i * 2.1, g)
  }

  // 筒拱屋面 + 拱肋 + 天窗带
  barrelRoof(g, w + 1.4, d / 2, H, M.membrane, -4)
  vaultRibs(g, w + 1.4, d / 2 + 0.06, H, M.brightSilver, 14, -4)
  for (let i = 0; i < 9; i++) {
    const sk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.5), M.glWhite)
    sk.position.set(-24 + i * 6, H + d / 2 - 0.1, -4)
    sk.castShadow = true
    g.add(sk)
  }

  // 塔台
  cyl(3.6, 5.0, 30, M.whiteStone, 26, 15, -18, 18, g)
  cyl(4.2, 4.2, 0.6, M.brightSilver, 26, 30.3, -18, 18, g)
  cyl(6.2, 5.6, 5.4, M.glTeal, 26, 33.2, -18, 18, g)
  cyl(6.4, 6.4, 0.5, M.whiteStone, 26, 36.1, -18, 18, g)
  cyl(0.18, 0.26, 4.0, M.brightSilver, 26, 38.3, -18, 8, g)

  // 登机廊桥 + 机位
  for (const px of [-22, -4, 14]) {
    box(4.2, 3.4, 16, M.brightSilver, px, 6.2, -21, g)
    box(4.6, 3.6, 3.0, M.glSmoke, px, 6.2, -28.4, g)
    box(4.2, 3.4, 4.0, M.brightSilver, px, 6.2, -13.4, g)
    for (const sx of [-1.4, 1.4]) cyl(0.2, 0.2, 4.6, M.brightSilver, px + sx, 2.3, -21, 8, g)
  }
  // 停机坪：混凝土坪 + 机位标线 + 引导线
  box(74, 0.16, 26, M.concreteDark, 0, 0.08, -32, g)
  for (const px of [-22, -4, 14]) {
    for (const sx of [-1, 1]) box(0.3, 0.04, 14, M.roadPaint, px + sx * 6.5, 0.18, -34, g)
    box(13.3, 0.04, 0.3, M.roadPaint, px, 0.18, -26.6, g)
    cyl(0.12, 0.12, 1.1, M.paintYell, px + 5.2, 0.6, -36, 6, g)
  }
  box(70, 0.04, 0.4, M.paintYell, 0, 0.18, -22.6, g)

  // 落客车道 + 雨篷 + 停车
  box(64, 0.12, 9, M.paving, 0, 0.06, 14, g)
  for (let i = 0; i < 12; i++) box(0.14, 0.05, 6.0, M.roadPaint, -30 + i * 5.4, 0.13, 13.4, g)
  box(40, 0.5, 5.2, M.membrane, 0, 7.6, 12.4, g)
  for (let i = 0; i < 9; i++) cyl(0.22, 0.22, 7.4, M.brightSilver, -18 + i * 4.5, 3.7, 14.6, 8, g)
  // 大巴 + 出租车
  for (const [px, pz, col] of [[-20, 9.5, M.glazeWhite], [-8, 9.5, M.paintYell], [8, 9.5, M.glazeWhite]]) {
    box(7.4, 2.2, 2.6, col, px, 1.15, pz, g)
    box(2.4, 1.2, 2.64, M.glSmoke, px - 2.0, 1.9, pz, g)
    for (const sx of [-2.4, 2.4]) for (const sz of [-1.1, 1.1]) cyl(0.42, 0.42, 0.34, M.charcoal, px + sx, 0.42, pz + sz, 10, g)
  }
  // 灯柱
  for (let i = 0; i < 10; i++) {
    cyl(0.14, 0.2, 9, M.brightSilver, -45 + i * 10, 4.5, 20, 6, g)
    box(1.6, 0.28, 0.5, M.glazeWhite, -45 + i * 10, 9.1, 20, g)
  }
  return { g, top: 42 }
}

/** 89 电视塔 */
function t89(x, z) {
  const g = group(x, z, 0)
  // 基座：裙房 + 台基
  cyl(17.0, 18.0, 1.6, M.paving, 0, 0.8, 0, 40, g)
  cyl(14.0, 15.0, 4.4, M.tuff, 0, 2.2, 0, 32, g)
  cyl(14.6, 14.6, 0.4, M.whiteStone, 0, 4.5, 0, 32, g)
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    box(0.5, 4.4, 0.9, M.tuff, Math.cos(a) * 14.2, 2.2, Math.sin(a) * 14.2, g).rotation.y = -a
  }
  // 入口
  const ez = 14.4
  box(9, 4.2, 3.0, M.glSmoke, 0, 2.1, ez, g)
  box(10.4, 0.4, 4.4, M.brightSilver, 0, 4.6, ez + 0.7, g)
  for (const sx of [-1, 1]) cyl(0.22, 0.22, 4.4, M.brightSilver, sx * 4.2, 2.2, ez + 2.4, 8, g)

  // 塔身（收分曲线）
  const prof = [
    [11.0, 0], [8.6, 16], [6.4, 40], [4.4, 64], [3.2, 82], [2.6, 98],
  ].map(([a, b]) => new THREE.Vector2(a, b))
  const shaft = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), M.concrete)
  shaft.castShadow = shaft.receiveShadow = true
  add(shaft, 0, 4.4, 0, g)
  // 塔身竖向凹槽
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    const px = Math.cos(a) * 9.4
    const pz = Math.sin(a) * 9.4
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.4, 46, 1.6), M.concreteDark)
    groove.position.set(px, 27, pz)
    groove.rotation.y = -a
    groove.rotation.x = 0.045
    g.add(groove)
  }
  for (const oy of [22, 48, 74]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.2 - (oy - 22) * 0.045, 0.22, 6, 40), M.whiteStone)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, oy, 0, g)
  }

  // 观光球舱（窗带：上下环梁 + 竖向窗间柱 + 幕墙分格）
  const podY = 88
  const pod = new THREE.Mesh(new THREE.SphereGeometry(9.6, 40, 22), M.glSmoke)
  pod.scale.set(1, 0.5, 1)
  pod.castShadow = true
  add(pod, 0, podY, 0, g)
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2
    box(0.22, 3.1, 0.3, M.brightSilver, Math.cos(a) * 9.58, podY, Math.sin(a) * 9.58, g).rotation.y = -a
  }
  // 舱内可见的楼板 + 参观者（剪影）
  for (const oy of [-1.4, 1.4]) {
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(9.2 - Math.abs(oy) * 0.6, 9.2 - Math.abs(oy) * 0.6, 0.24, 36), M.whiteStone)
    add(disk, 0, podY + oy, 0, g)
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2
    const px = Math.cos(a) * 8.4
    const pz = Math.sin(a) * 8.4
    box(0.34, 1.1, 0.3, M.charcoal, px, podY - 1.0, pz, g)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M.plaster)
    add(head, px, podY - 0.36, pz, g)
  }
  // 塔身设备窗 + 检修门
  for (const oy of [30, 56, 70]) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      box(1.1, 1.5, 0.3, M.glSmoke, Math.cos(a) * 7.4, oy, Math.sin(a) * 7.4, g).rotation.y = -a
    }
  }
  box(2.2, 3.0, 0.4, M.aluPanel, 0, 6.6, 10.4, g)
  box(0.24, 0.24, 0.5, M.brightSilver, 1.0, 6.9, 10.7, g)
  for (const oy of [-4.4, 0, 4.4]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9.6 - Math.abs(oy) * 0.5, 0.34, 8, 48), M.brightSilver)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, podY + oy, 0, g)
  }
  cyl(9.8, 9.8, 0.5, M.whiteStone, 0, podY - 5.2, 0, 40, g)
  cyl(4.0, 4.6, 3.0, M.aluPanel, 0, podY + 6.4, 0, 20, g)

  // 上部平台 + 微波天线
  cyl(5.0, 5.0, 2.4, M.whiteStone, 0, 101, 0, 24, g)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    box(0.8, 1.6, 0.5, M.aluPanel, Math.cos(a) * 4.2, 102.4, Math.sin(a) * 4.2, g).rotation.y = -a
  }
  cyl(2.6, 3.2, 1.2, M.concreteDark, 0, 102.8, 0, 20, g)

  // 天线桅杆
  cyl(0.5, 2.4, 28, M.brightSilver, 0, 117, 0, 12, g)
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9 - i * 0.26, 0.1, 4, 14), M.brightSilver)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, 106 + i * 4, 0, g)
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: '#e06858' }))
  add(beacon, 0, 131.2, 0, g)
  return { g, top: 134 }
}

/** 90 观景摩天轮（跨 2×2 地块） */
function t90(x, z) {
  const g = group(x, z, 0)
  const R = 26
  const cy = 33

  // 站房 + 排队廊 + 售票亭
  box(18, 5.4, 11, M.plasterGrey, 0, 2.7, 0, g)
  box(19, 0.6, 12, M.paintBlue, 0, 5.7, 0, g)
  gridGlass(g, 0, 3.0, 5.56, 0, 12, 3.6, 8, 2, { glass: M.glSmoke, frame: M.aluDark })
  box(6.0, 3.4, 0.22, M.glSmoke, 0, 1.7, 5.66, g)
  box(13, 0.35, 6.5, M.membrane, 0, 7.4, 6.4, g)
  for (const sx of [-1, 1]) cyl(0.2, 0.2, 7.2, M.brightSilver, sx * 5.6, 3.6, 9.2, 8, g)
  box(3.4, 3.0, 3.4, M.plasterGrey, 15, 1.5, 8, g)
  box(3.7, 0.24, 3.7, M.paintRed, 15, 3.1, 8, g)
  box(2.2, 1.5, 0.16, M.glSmoke, 15, 1.9, 9.72, g)

  // A 形支架（4 条腿）+ 横撑
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.86, 38, 12), M.brightSilver)
      leg.position.set(sx * 8.4, 17.4, sz * 5.2)
      leg.rotation.z = -sx * 0.23
      leg.rotation.x = sz * 0.14
      leg.castShadow = true
      g.add(leg)
    }
  }
  for (const oy of [10, 21]) {
    box(15.4, 0.4, 0.4, M.brightSilver, 0, oy, 4.0, g)
    box(15.4, 0.4, 0.4, M.brightSilver, 0, oy, -4.0, g)
  }

  // 轮圈（主圈 + 内圈）+ 斜拉索
  for (const [rr, tt] of [[R, 0.42], [R * 0.9, 0.16], [R * 0.42, 0.2]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, tt, 8, 72), M.brightSilver)
    ring.castShadow = true
    add(ring, 0, cy, 0, g)
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, R, 6), M.brightSilver)
    sp.position.set(Math.cos(a) * R / 2, cy + Math.sin(a) * R / 2, 0)
    sp.rotation.z = a - Math.PI / 2
    g.add(sp)
    // 斜索
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, R * 0.97, 4), M.brightSilver)
    cable.position.set(Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, 0)
    cable.rotation.z = a + Math.PI * 0.27
    g.add(cable)
  }
  // 观景舱
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const cx = Math.cos(a) * (R + 1.7)
    const cyy = cy + Math.sin(a) * (R + 1.7)
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.7, 12), i % 4 ? M.glazeWhite : M.paintRed)
    cab.position.set(cx, cyy, 0)
    cab.castShadow = true
    g.add(cab)
    cyl(1.6, 1.6, 0.16, M.brightSilver, cx, cyy + 0.9, 0, 12, g)
    cyl(1.6, 1.6, 0.16, M.brightSilver, cx, cyy - 0.9, 0, 12, g)
    box(0.1, 2.2, 0.1, M.brightSilver, cx, cyy + 2.0, 0, g)
  }
  // 轮毂
  cyl(1.9, 1.9, 8.0, M.aluDark, 0, cy, 0, 16, g).rotation.x = Math.PI / 2
  for (const sz of [-1, 1]) cyl(2.6, 2.6, 0.5, M.brightSilver, 0, cy, sz * 4.2, 16, g).rotation.x = Math.PI / 2

  // 广场 + 铺装 + 灯柱 + 树
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(46, 48), M.paving)
  plaza.rotation.x = -Math.PI / 2
  add(plaza, 0, 0.06, 0, g)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    cyl(0.12, 0.18, 6.6, M.darkFrame, Math.cos(a) * 40, 3.3, Math.sin(a) * 40, 6, g)
    box(1.3, 0.26, 0.4, M.glazeWhite, Math.cos(a) * 40, 6.7, Math.sin(a) * 40, g)
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4
    const tx = Math.cos(a) * 42
    const tz = Math.sin(a) * 42
    cyl(0.2, 0.28, 3.6, M.bark, tx, 1.8, tz, 8, g)
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), M.leaf)
    c.scale.set(1, 1.1, 1)
    c.castShadow = true
    add(c, tx, 4.6, tz, g)
  }
  return { g, top: cy + R + 6 }
}

// ============================================================
//  布局：8 列，行数按条目自动计算
// ============================================================
/** 91 双子塔（裙房 + 空中连桥） */
function t91(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 44, M.paving, 3, 'x')
  // 裙房 + 商业幕墙 + 入口雨棚
  box(36, 12, 24, M.tuff, 0, 6, 0, g)
  box(36.8, 0.7, 24.8, M.whiteStone, 0, 12.3, 0, g)
  for (const sz of [-1, 1]) {
    gridGlass(g, 0, 4.6, sz * 12.1, sz > 0 ? 0 : Math.PI, 32, 7.4, 10, 3, { glass: M.glSmoke, frame: M.brightSilver })
    box(32, 0.3, 0.5, M.whiteStone, 0, 8.1, sz * 12.2, g)
  }
  for (const sx of [-1, 1]) gridGlass(g, sx * 18.1, 4.6, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 21, 7.4, 6, 3, { glass: M.glSmoke, frame: M.brightSilver })
  box(9, 5.6, 4.2, M.glWhite, 0, 2.8, 12.6, g)
  box(11.6, 0.45, 5.6, M.brightSilver, 0, 5.9, 13.4, g)
  for (const sx of [-1, 1]) cyl(0.16, 0.16, 5.4, M.brightSilver, sx * 4.4, 2.7, 15.2, 8, g)
  box(6.4, 1.1, 0.24, M.paintBlue, 0, 7.0, 12.7, g)

  // 双塔
  const fh = 3.9
  const floors = 38
  const H = floors * fh
  for (const sx of [-1, 1]) {
    const cx = sx * 12
    box(13, H, 13, M.glDeepBlue, cx, 12 + H / 2, 0, g)
    // 角柱
    for (const ax of [-1, 1]) for (const az of [-1, 1]) {
      box(1.7, H, 1.7, M.whiteStone, cx + ax * 5.7, 12 + H / 2, az * 5.7, g)
      box(2.0, 0.4, 2.0, M.brightSilver, cx + ax * 5.7, 12 + H, az * 5.7, g)
    }
    // 幕墙分格（每 8 层一段，四面）
    for (let f = 0; f < floors; f += 8) {
      const yy = 12 + (f + 4) * fh
      const hh = 8 * fh - 0.9
      for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
        gridGlass(g, cx + dx * 6.66, yy, dz * 6.66, ry, 10.6, hh, 4, 8, { glass: M.glWhite, frame: M.brightSilver, mw: 0.1, mh: 0.1 })
      }
    }
    // 设备层腰线
    for (let f = 8; f < floors; f += 8) {
      box(13.6, 0.5, 13.6, M.brightSilver, cx, 12 + f * fh, 0, g)
      box(14.1, 0.2, 14.1, M.glWhite, cx, 12 + f * fh + 0.3, 0, g)
    }
    // 塔冠 + 桅杆 + 航空灯
    box(14, 3.0, 14, M.aluPanel, cx, 12 + H + 1.5, 0, g)
    box(11, 3.4, 11, M.glSmoke, cx, 12 + H + 4.6, 0, g)
    cyl(0.3, 0.9, 12, M.brightSilver, cx, 12 + H + 12, 0, 8, g)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), M.paintRed)
    add(lamp, cx, 12 + H + 18.2, 0, g)
  }
  // 空中连桥（含幕墙与楼板）
  box(17, 4.6, 8, M.glWhite, 0, 76, 0, g)
  for (const sz of [-1, 1]) gridGlass(g, 0, 76, sz * 4.06, sz > 0 ? 0 : Math.PI, 16, 3.0, 6, 1, { glass: M.glSmoke, frame: M.brightSilver })
  box(17.6, 0.4, 8.6, M.brightSilver, 0, 78.5, 0, g)
  box(17.6, 0.4, 8.6, M.brightSilver, 0, 73.5, 0, g)
  // 场地：车道、绿化、旗杆、路灯
  for (let i = 0; i < 4; i++) carAt(g, -16 + i * 5.4, 18.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed][i])
  for (const sx of [-1, 1]) hedge(g, sx * 19, 0, 34, false, 0.9, 1.1)
  for (const [lx, lz] of [[-19, 19], [19, 19], [-19, -19], [19, -19]]) lampPost(g, lx, lz, 7.4, 0)
  cyl(0.1, 0.14, 14, M.brightSilver, 15, 7, 18, 8, g)
  box(2.4, 1.5, 0.06, M.paintRed, 16.2, 12.6, 18, g)
  return { g, top: 12 + H + 20 }
}

/** 92 螺旋扭转塔（38 层，每层错转） */
function t92(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 44, M.paving, 3, 'x')
  // 退台裙房
  box(28, 9, 28, M.tuff, 0, 4.5, 0, g)
  box(28.8, 0.6, 28.8, M.whiteStone, 0, 9.3, 0, g)
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
    gridGlass(g, dx * 14.1, 4.4, dz * 14.1, ry, 24, 6.4, 8, 2, { glass: M.glSmoke, frame: M.aluDark })
  }
  box(8, 5, 3, M.glWhite, 0, 2.5, 14.4, g)
  box(10.4, 0.4, 4.2, M.brightSilver, 0, 5.2, 15.4, g)

  const fh = 4.0
  const floors = 38
  const H = floors * fh
  for (let i = 0; i < floors; i++) {
    const t = i / floors
    const k = 1 - 0.18 * t
    const seg = box(10.4 * k, fh * 1.02, 10.4 * k, i % 2 ? M.glViolet : M.glSmoke, 0, 9 + i * fh + fh / 2, 0, g)
    seg.rotation.y = t * Math.PI * 0.8
    // 白色挑檐鳍（每层错位旋转）
    const fin = box(11.6 * k, 0.24, 11.6 * k, M.whiteStone, 0, 9 + i * fh, 0, g)
    fin.rotation.y = seg.rotation.y
    // 每层一道玻璃竖梃
    if (i % 2 === 0) {
      const mull = box(0.14, fh, 10.6 * k, M.brightSilver, 0, 9 + i * fh + fh / 2, 0, g)
      mull.rotation.y = seg.rotation.y
    }
  }
  // 顶部冠 + 露天观景台
  box(8.6, 2.2, 8.6, M.brightSilver, 0, 9 + H + 1.1, 0, g)
  cyl(4.4, 4.4, 0.4, M.whiteStone, 0, 9 + H + 2.4, 0, 20, g)
  railing(g, 8.6, 9 + H + 2.6, 0, M.brightSilver, 12, 1.1)
  cyl(0.3, 0.8, 10, M.brightSilver, 0, 9 + H + 8, 0, 8, g)
  // 广场铺装与树池
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(6.4, 0.5, 6.4, M.whiteStone, sx * 17, 0.25, sz * 17, g)
    treeAt(g, sx * 17, sz * 17, 1.1, 3.4)
  }
  for (const [lx, lz] of [[-20, 0], [20, 0], [0, 20]]) lampPost(g, lx, lz, 7.0, 0)
  return { g, top: 9 + H + 14 }
}

/** 93 板式办公塔（横向条窗 + 屋顶机房） */
function t93(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 44, M.paving, 3, 'x')
  const fh = 4.0
  const floors = 22
  const H = floors * fh
  const w = 32
  const d = 15
  box(w, H, d, M.aluPanel, 0, H / 2, 0, g)
  // 端部核心筒（石材）
  for (const sx of [-1, 1]) {
    box(6.4, H + 4.6, d + 1.2, M.whiteStone, sx * (w / 2 - 2.4), (H + 4.6) / 2, 0, g)
    box(7.0, 0.6, d + 1.8, M.tuff, sx * (w / 2 - 2.4), H + 4.9, 0, g)
    for (let f = 0; f < floors; f += 2) box(0.2, 1.5, 2.2, M.glWhite, sx * (w / 2 + 0.82), f * fh + 2.4, 0, g)
  }
  // 南北向连续横向条窗
  for (let f = 0; f < floors; f++) {
    const y = f * fh + 2.25
    for (const sz of [-1, 1]) {
      const m = box(w - 13.2, 1.95, 0.22, M.glTeal, 0, y, sz * (d / 2 + 0.06), g)
      m.castShadow = false
      box(w - 13.2, 0.14, 0.4, M.whiteStone, 0, y + 1.1, sz * (d / 2 + 0.16), g)
    }
  }
  // 竖向遮阳鳍
  for (let i = 0; i <= 12; i++) {
    const px = -w / 2 + 7 + i * ((w - 14) / 12)
    for (const sz of [-1, 1]) box(0.22, H, 0.5, M.whiteStone, px, H / 2, sz * (d / 2 + 0.22), g)
  }
  // 首层门厅
  gridGlass(g, 0, 3.4, d / 2 + 0.05, 0, w - 8, 6.4, 8, 2, { glass: M.glSmoke, frame: M.aluDark })
  box(8, 4.6, 3.4, M.glWhite, 0, 2.3, d / 2 + 1.4, g)
  box(10.4, 0.4, 4.8, M.brightSilver, 0, 4.8, d / 2 + 2.0, g)
  // 屋面：冷却塔 + 电梯机房 + 光伏 + 女儿墙
  parapet(g, w, d, H, M.whiteStone, 1.0, 0.35)
  for (const sx of [-1, 1]) {
    box(6.0, 2.4, 4.0, M.aluPanel, sx * 9, H + 1.2, 2.0, g)
    for (let i = 0; i < 5; i++) box(5.4, 0.1, 0.22, M.aluDark, sx * 9, H + 2.2, 0.4 + i * 0.8, g)
  }
  for (let i = 0; i < 5; i++) box(4.0, 0.18, 2.6, M.glDeepBlue, -12 + i * 5.0, H + 0.9, -4.2, g)
  // 广场、停车、入口
  for (let i = 0; i < 5; i++) carAt(g, -12 + i * 5.6, 20, Math.PI, [M.charcoal, M.glazeWhite, M.paintBlue, M.aluPanel, M.paintRed][i])
  for (const sx of [-1, 1]) hedge(g, sx * 19, 16, 10, false, 0.8, 1.0)
  lampPost(g, -18, 20, 7.0, 0)
  lampPost(g, 18, 20, 7.0, 0)
  box(4.6, 1.0, 0.2, M.paintBlue, 0, 6.2, d / 2 + 3.2, g)
  return { g, top: H + 5 }
}

/** 94 城市综合体（商场裙房 + 酒店塔楼，跨 2 格） */
function t94(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 4, 96, 42, M.paving, 3.4, 'x')
  // 商场体块（退台两层）
  box(64, 10, 30, M.limestone, -14, 5, -2, g)
  box(58, 9, 24, M.tuff, -14, 14.5, -2, g)
  box(66, 0.7, 32, M.whiteStone, -14, 10.2, -2, g)
  box(60, 0.7, 26, M.whiteStone, -14, 19.2, -2, g)
  // 商业幕墙与入口
  for (const sz of [-1, 1]) {
    gridGlass(g, -14, 4.4, sz * 15.1 - 2, sz > 0 ? 0 : Math.PI, 58, 6.6, 14, 2, { glass: M.glSmoke, frame: M.brightSilver })
    box(58, 0.5, 0.4, M.whiteStone, -14, 7.9, sz * 15.3 - 2, g)
  }
  gridGlass(g, -46.1, 4.4, -2, -Math.PI / 2, 26, 6.6, 6, 2, { glass: M.glSmoke, frame: M.brightSilver })
  box(20, 8.2, 4.0, M.glWhite, -14, 4.1, 16.6, g)
  box(24, 0.6, 6.4, M.membrane, -14, 8.6, 17.6, g)
  for (let i = 0; i < 4; i++) cyl(0.22, 0.22, 8.0, M.brightSilver, -24 + i * 6.6, 4.0, 20.4, 8, g)
  box(12, 1.5, 0.3, M.paintRed, -14, 9.6, 17.0, g)
  box(9, 0.3, 0.1, M.glazeWhite, -14, 9.6, 17.2, g)
  // 中庭天窗（玻璃拱）
  for (let i = 0; i < 7; i++) {
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 7.0, 14, 1, true, 0, Math.PI), M.glWhite)
    arch.rotation.z = Math.PI / 2
    arch.position.set(-14, 19.4, -11 + i * 3.0)
    g.add(arch)
  }
  // 酒店塔楼（22 层）
  const fh = 3.6
  const floors = 24
  const H = floors * fh
  const tx = 30
  box(16, H, 16, M.glChampagne, tx, H / 2, -3, g)
  for (let f = 0; f < floors; f += 6) {
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
      gridGlass(g, tx + dx * 8.1, 3 + (f + 3) * fh, -3 + dz * 8.1, ry, 13.4, 6 * fh - 1.0, 5, 6, { glass: M.glSmoke, frame: M.gold, mw: 0.12, mh: 0.14 })
    }
  }
  for (let f = 6; f < floors; f += 6) box(16.6, 0.4, 16.6, M.gold, tx, f * fh, -3, g)
  box(17, 2.2, 17, M.aluPanel, tx, H + 1.1, -3, g)
  box(13, 3.0, 13, M.glSmoke, tx, H + 3.6, -3, g)
  cyl(0.3, 0.9, 9, M.brightSilver, tx, H + 9.5, -3, 8, g)
  // 室外广场：停车、树池、灯、广告牌
  for (let i = 0; i < 7; i++) carAt(g, -38 + i * 6.2, 14, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed, M.aluPanel, M.glTeal, M.paintYell][i])
  for (let i = 0; i < 6; i++) treeAt(g, -44 + i * 14, 20, 1.1, 3.6)
  for (const [lx, lz] of [[-44, 10], [-20, 21], [6, 21], [38, 12]]) lampPost(g, lx, lz, 7.0, 0)
  box(1.0, 8.0, 1.0, M.aluDark, -46, 4, 6, g)
  box(7.0, 4.0, 0.4, M.glDeepBlue, -45.0, 7.0, 6, g)
  box(5.6, 0.6, 0.1, M.glazeWhite, -45.0, 8.1, 6.25, g)
  // 公交站台
  box(9, 0.22, 2.4, M.concrete, 12, 0.11, 20.5, g)
  box(8.6, 0.24, 2.8, M.brightSilver, 12, 3.0, 20.6, g)
  for (let i = 0; i < 4; i++) cyl(0.1, 0.1, 2.9, M.brightSilver, 8.4 + i * 2.4, 1.5, 21.6, 6, g)
  benchAt(g, 9.5, 20.4, 0)
  benchAt(g, 14.5, 20.4, 0)
  return { g, top: H + 16 }
}

/** 95 通信铁塔（角钢格构 + 天线 + 机房） */
function t95(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 2, 40, 38, M.paving, 3.0, 'x')
  // 机房 + 设备柜 + 围栏
  box(9, 4.2, 6, M.plasterGrey, -9, 2.1, -8, g)
  box(9.6, 0.4, 6.6, M.aluPanel, -9, 4.4, -8, g)
  win(g, -9, 2.5, -4.94, 0, 1.6, 1.4, { glass: M.glTeal, frame: M.aluDark })
  win(g, -4.94, 2.3, -8, Math.PI / 2, 1.2, 1.2, { glass: M.glTeal, frame: M.aluDark })
  box(2.4, 1.9, 0.9, M.aluPanel, -9, 0.95, -4.4, g)
  for (let i = 0; i < 4; i++) box(1.6, 1.8, 0.8, M.aluDark, 2 + i * 2.0, 0.9, -9.4, g)
  // 格构塔（4 根角钢 + 交叉腹杆）
  const H = 62
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    beamBetween(g, sx * 4.2, 0, sz * 4.2, sx * 1.1, H, sz * 1.1, 0.24, M.aluPanel, 0.24)
  }
  for (let i = 0; i < 12; i++) {
    const y0 = i * (H / 12)
    const y1 = y0 + H / 12
    const k0 = 4.2 - (3.1 * y0) / H
    const k1 = 4.2 - (3.1 * y1) / H
    for (const sz of [-1, 1]) {
      beamBetween(g, -k0, y0, sz * k0, k1, y1, sz * k1, 0.13, M.aluPanel, 0.13)
      beamBetween(g, k0, y0, sz * k0, -k1, y1, sz * k1, 0.13, M.aluPanel, 0.13)
    }
    for (const sx of [-1, 1]) {
      beamBetween(g, sx * k0, y0, -k0, sx * k1, y1, k1, 0.13, M.aluPanel, 0.13)
      beamBetween(g, sx * k0, y0, k0, sx * k1, y1, -k1, 0.13, M.aluPanel, 0.13)
    }
    box(k0 * 2 + 0.4, 0.16, 0.16, M.aluPanel, 0, y1, -k1, g)
    box(k0 * 2 + 0.4, 0.16, 0.16, M.aluPanel, 0, y1, k1, g)
  }
  // 平台 + 基站天线 + 微波锅 + 避雷针
  for (const oy of [44, 56]) {
    box(7.2, 0.3, 7.2, M.aluPanel, 0, oy, 0, g)
    for (let i = 0; i < 3; i++) {
      box(0.36, 3.4, 0.6, M.glazeWhite, -2.4 + i * 2.4, oy + 2.0, 3.4, g)
      box(0.5, 0.3, 0.7, M.aluDark, -2.4 + i * 2.4, oy + 0.4, 3.4, g)
    }
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.glazeWhite)
    dish.position.set(3.0, oy + 1.8, -3.0)
    dish.rotation.x = Math.PI * 0.7
    g.add(dish)
  }
  cyl(0.12, 0.3, 9, M.brightSilver, 0, H + 4, 0, 8, g)
  box(0.5, 0.5, 0.5, M.paintRed, 0, H + 8.6, 0, g)
  // 围栏 + 警示牌 + 草坪
  for (const sx of [-1, 1]) hedge(g, sx * 16, 0, 32, false, 1.1, 1.2)
  for (let i = 0; i < 5; i++) treeAt(g, -16 + i * 8, 16, 1.0, 3.0)
  box(2.2, 1.0, 0.12, M.paintYell, 8, 1.3, 12, g)
  lampPost(g, 6, 14, 6.4, 0)
  return { g, top: H + 10 }
}

/** 96 数据中心（无窗机房 + 冷却机组 + 柴发） */
function t96(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 44, M.concrete, 3.0, 'x')
  // 主机房：实墙 + 竖向百叶 + 屋面板
  box(34, 13, 22, M.aluPanel, 0, 6.5, -3, g)
  box(35, 0.8, 23, M.whiteStone, 0, 13.4, -3, g)
  box(35.6, 0.24, 23.6, M.aluDark, 0, 13.9, -3, g)
  // 两侧冷却百叶带
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 16; i++) box(1.9, 3.2, 0.3, M.aluDark, -16 + i * 2.1, 4.0, sz * 8.2 - 3, g)
    box(34, 0.3, 0.5, M.aluPanel, 0, 6.0, sz * 8.4 - 3, g)
  }
  // 入口门斗 + 标识 + 安保亭
  box(8, 4.2, 3.2, M.glWhite, 0, 2.1, 8.4, g)
  box(9.4, 0.45, 4.4, M.brightSilver, 0, 4.4, 9.0, g)
  gridGlass(g, 0, 2.2, 10.05, 0, 6.6, 3.4, 4, 1, { glass: M.glSmoke, frame: M.aluDark })
  box(5.0, 1.2, 0.2, M.paintBlue, 0, 5.6, 8.6, g)
  box(2.6, 3.0, 2.6, M.plasterGrey, 15, 1.5, 15, g)
  box(2.9, 0.3, 2.9, M.aluPanel, 15, 3.1, 15, g)
  win(g, 15, 2.0, 16.32, 0, 1.5, 1.0, { glass: M.glTeal, frame: M.aluDark })
  // 屋面冷却机组
  for (let i = 0; i < 4; i++) {
    const cx = -12 + i * 8
    box(5.2, 2.2, 4.0, M.aluPanel, cx, 14.7, -5, g)
    for (let j = 0; j < 4; j++) cyl(1.5, 1.5, 0.12, M.aluDark, cx - 1.2 + (j % 2) * 2.4, 15.9, -6.2 + Math.floor(j / 2) * 2.4, 14, g)
    box(0.4, 0.5, 0.4, M.aluDark, cx - 2.2, 13.9, -3.2, g)
  }
  // 柴发机组 + 储油罐 + 升压变
  for (let i = 0; i < 3; i++) {
    box(6.4, 3.0, 3.0, M.aluDark, -13 + i * 7.4, 1.5, 17.4, g)
    box(6.8, 0.3, 3.4, M.aluPanel, -13 + i * 7.4, 3.1, 17.4, g)
    box(0.5, 1.6, 0.5, M.brightSilver, -16 + i * 7.4, 3.6, 17.4, g)
  }
  cyl(1.8, 1.8, 4.2, M.aluPanel, 15, 2.1, 16, 18, g)
  cyl(1.9, 1.9, 0.2, M.aluDark, 15, 4.3, 16, 18, g)
  // 围墙 + 大门 + 绿化
  for (const sz of [-1, 1]) hedge(g, 0, sz * 21, 40, true, 1.2, 1.0)
  for (const sx of [-1, 1]) hedge(g, sx * 21, 0, 40, false, 1.2, 1.0)
  for (let i = 0; i < 5; i++) treeAt(g, -20 + i * 10, 20, 0.9, 2.8)
  return { g, top: 18 }
}

/** 97 110kV 变电站（构架 + 主变 + 母线） */
function t97(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 44, M.concrete, 3.0, 'x')
  // 主控楼
  box(16, 7, 8, M.plasterGrey, -11, 3.5, -14, g)
  box(16.6, 0.5, 8.6, M.whiteStone, -11, 7.2, -14, g)
  for (let i = 0; i < 5; i++) win(g, -17 + i * 3.0, 4.6, -9.94, 0, 1.9, 1.5, { glass: M.glTeal, frame: M.aluDark })
  box(2.4, 2.6, 0.2, M.aluDark, -8, 1.3, -9.94, g)
  // 主变压器（散热片 + 套管 + 油枕）
  for (const cx of [-11, 5]) {
    box(6.4, 3.0, 4.4, M.aluPanel, cx, 1.5, 2, g)
    box(6.8, 0.4, 4.8, M.aluDark, cx, 3.2, 2, g)
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 9; i++) box(0.18, 2.4, 0.7, M.aluDark, cx + sx * 3.5, 1.7, -0.6 + i * 0.65, g)
    }
    for (let i = 0; i < 3; i++) {
      cyl(0.14, 0.22, 2.2, M.glazeWhite, cx - 1.8 + i * 1.8, 4.1, 2, 8, g)
      for (let k = 0; k < 5; k++) cyl(0.34, 0.34, 0.1, M.glazeWhite, cx - 1.8 + i * 1.8, 3.4 + k * 0.36, 2, 10, g)
    }
    cyl(0.7, 0.7, 2.4, M.aluPanel, cx + 2.2, 3.6, 2, 12, g)
  }
  // 出线构架（门型钢架 + 绝缘子串）
  for (const [gx, gw] of [[-13, 12], [1, 12], [14, 8]]) {
    for (const sx of [-1, 1]) beamBetween(g, gx + sx * gw / 2, 0, -8, gx + sx * gw / 2, 11, -8, 0.34, M.aluPanel, 0.34)
    box(gw + 1.0, 0.4, 0.4, M.aluPanel, gx, 11, -8, g)
    box(gw + 1.0, 0.3, 0.3, M.aluPanel, gx, 8.4, -8, g)
    for (let i = 0; i < 3; i++) {
      const ix = gx - gw / 2 + (gw / 2) * (i + 0.5) / 1.5
      beamBetween(g, ix, 11, -8, ix, 9.2, -8, 0.1, M.glazeWhite, 0.1)
      for (let k = 0; k < 6; k++) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12), M.glazeWhite)
        disc.position.set(ix, 9.5 + k * 0.28, -8)
        g.add(disc)
      }
    }
  }
  // 母线 + 电缆沟 + 围栏 + 警示
  for (const zz of [-12, -2, 8]) box(38, 0.06, 0.4, M.aluDark, 0, 0.03, zz, g)
  for (let i = 0; i < 5; i++) box(0.5, 1.6, 0.5, M.paintYell, -20 + i * 10, 0.8, 13, g)
  for (const sz of [-1, 1]) hedge(g, 0, sz * 21, 40, true, 1.3, 0.8)
  for (const sx of [-1, 1]) hedge(g, sx * 21, 0, 40, false, 1.3, 0.8)
  for (let i = 0; i < 4; i++) treeAt(g, -18 + i * 12, -20, 0.9, 2.8)
  box(3.0, 1.2, 0.14, M.paintRed, 16, 1.8, 20, g)
  return { g, top: 14 }
}

/** 98 自来水厂（沉淀池 + 泵房 + 水塔） */
function t98(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 44, M.concrete, 3.0, 'x')
  // 三座圆形沉淀池
  for (const [cx, cz] of [[-12, -8], [4, -8], [-4, 8]]) {
    cyl(6.4, 6.6, 2.2, M.whiteStone, cx, 1.1, cz, 24, g)
    cyl(6.0, 6.0, 0.4, M.glTeal, cx, 2.1, cz, 24, g)
    cyl(6.2, 6.2, 0.22, M.brightSilver, cx, 2.35, cz, 24, g)
    // 中心刮泥桥 + 走道
    box(12.4, 0.3, 1.1, M.brightSilver, cx, 2.6, cz, g)
    cyl(0.5, 0.5, 1.6, M.aluPanel, cx, 3.1, cz, 10, g)
    railing(g, 12.0, 2.7, cz - 0.5, M.brightSilver, 10, 0.9)
    // 进出水管
    cyl(0.5, 0.5, 2.4, M.brightSilver, cx + 6.6, 1.2, cz, 12, g)
  }
  // 泵房 + 加药间
  box(14, 6.5, 8, M.plasterGrey, 14, 3.25, 10, g)
  box(14.6, 0.5, 8.6, M.whiteStone, 14, 6.7, 10, g)
  for (let i = 0; i < 4; i++) win(g, 8.6 + i * 3.2, 4.4, 14.03, 0, 2.0, 1.6, { glass: M.glTeal, frame: M.aluDark })
  box(2.6, 2.8, 0.2, M.aluDark, 10, 1.4, 14.03, g)
  for (let i = 0; i < 3; i++) box(2.0, 1.4, 0.9, M.aluPanel, 9 + i * 3.0, 0.7, 15.6, g)
  // 水塔
  const wt = 17
  cyl(0.9, 1.2, 12, M.whiteStone, wt, 6, -14, 12, g)
  for (let i = 0; i < 4; i++) beamBetween(g, wt, 1.2 + i * 3.4, -14, wt, 7.6 + i * 3.4, -14, 0.18, M.aluPanel, 0.18)
  cyl(4.2, 4.2, 5.0, M.whiteStone, wt, 16.5, -14, 20, g)
  cyl(4.4, 4.4, 0.4, M.aluPanel, wt, 19.2, -14, 20, g)
  cone(4.4, 2.2, M.aluPanel, wt, 20.5, -14, 20, g)
  cyl(0.16, 0.16, 2.2, M.brightSilver, wt, 22.5, -14, 8, g)
  // 管道 + 阀门 + 围栏
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 22, 12), M.brightSilver)
  pipe.rotation.z = Math.PI / 2
  add(pipe, -4, 2.0, 0, g)
  const pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 16, 12), M.brightSilver)
  pipe2.rotation.z = Math.PI / 2
  add(pipe2, -8, 3.0, -14, g)
  for (let i = 0; i < 4; i++) cyl(0.6, 0.6, 0.4, M.paintRed, -12 + i * 6, 1.6, 0, 12, g)
  for (const sz of [-1, 1]) hedge(g, 0, sz * 21, 40, true, 1.2, 1.0)
  for (const sx of [-1, 1]) hedge(g, sx * 21, 0, 40, false, 1.2, 1.0)
  for (let i = 0; i < 5; i++) treeAt(g, -20 + i * 10, 20, 0.95, 3.0)
  lampPost(g, 18, 18, 6.5, 0)
  return { g, top: 24 }
}

/** 99 垃圾转运站（坡道 + 压缩车间 + 集装箱） */
function t99(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 44, M.concrete, 3.0, 'x')
  // 转运车间（大跨度 + 高侧窗 + 卷帘门）
  box(28, 11, 20, M.plasterGrey, -3, 5.5, -8, g)
  box(28.8, 0.7, 20.8, M.aluPanel, -3, 11.2, -8, g)
  for (let i = 0; i < 4; i++) box(5.0, 1.4, 0.3, M.glTeal, -14 + i * 7.4, 9.0, 2.1, g)
  for (let i = 0; i < 3; i++) {
    box(6.4, 6.2, 0.24, M.aluDark, -13 + i * 9.4, 3.1, 2.1, g)
    for (let k = 0; k < 8; k++) box(6.2, 0.1, 0.3, M.aluPanel, -13 + i * 9.4, 0.5 + k * 0.72, 2.2, g)
  }
  // 卸料坡道
  for (let i = 0; i < 7; i++) box(12, 0.5, 3.2, M.concrete, -3, 0.25 + i * 0.85, 5 + i * 2.0, g)
  railing(g, 12, 1.2, 5.2, M.paintYell, 8, 1.0)
  // 压缩主机 + 集装箱
  for (let i = 0; i < 2; i++) {
    box(5.0, 3.0, 4.0, M.aluDark, -10 + i * 10, 1.5, -10, g)
    box(0.5, 1.6, 0.5, M.brightSilver, -12 + i * 10, 3.6, -10, g)
  }
  for (const [bx, bz, col] of [[12, 4, M.paintBlue], [16, -8, M.glTeal], [12, -14, M.paintYell]]) {
    box(6.4, 2.8, 2.6, col, bx, 1.4, bz, g)
    for (let k = 0; k < 6; k++) box(0.1, 2.4, 2.8, M.aluDark, bx - 3.0 + k * 1.2, 1.4, bz, g)
    for (const sx of [-1, 1]) cyl(0.4, 0.4, 0.3, M.charcoal, bx + sx * 2.2, 0.4, bz + 0.9, 10, g)
  }
  // 地磅 + 洗车台 + 除臭塔
  box(8, 0.3, 3.4, M.aluDark, 14, 0.2, 14, g)
  box(8.4, 0.2, 3.8, M.paintYell, 14, 0.36, 14, g)
  box(4.0, 0.4, 4.0, M.concrete, 10, 0.2, 10, g)
  cyl(1.2, 1.4, 7.0, M.aluPanel, -19, 3.5, 6, 14, g)
  cyl(1.3, 1.3, 0.5, M.aluDark, -19, 7.2, 6, 14, g)
  // 树、围栏、指示牌
  for (const sz of [-1, 1]) hedge(g, 0, sz * 21, 40, true, 1.2, 1.0)
  for (let i = 0; i < 5; i++) treeAt(g, -20 + i * 10, 19, 0.95, 3.2)
  for (let i = 0; i < 3; i++) treeAt(g, 18, -2 + i * 8, 1.0, 3.0)
  box(2.4, 1.0, 0.14, M.paintBlue, 18, 2.4, 16, g)
  lampPost(g, 4, 18, 6.6, 0)
  return { g, top: 14 }
}

/** 100 公交枢纽（站台雨棚 + 候车厅 + 巴士） */
function t100(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 2, 44, 40, M.paving, 2.8, 'x')
  // 候车厅（玻璃盒 + 檐口）
  box(18, 5.4, 9, M.glWhite, -10, 2.7, 9, g)
  box(19.2, 0.6, 10.2, M.brightSilver, -10, 5.9, 9, g)
  for (const sz of [-1, 1]) gridGlass(g, -10, 2.7, 9 + sz * 4.56, sz > 0 ? 0 : Math.PI, 16.4, 4.4, 8, 2, { glass: M.glSmoke, frame: M.aluDark })
  box(3.6, 4.2, 0.24, M.glSmoke, -10, 2.1, 13.6, g)
  box(8.0, 1.4, 0.3, M.paintBlue, -10, 6.6, 9.4, g)
  box(5.6, 0.3, 0.1, M.glazeWhite, -10, 6.6, 9.58, g)
  // 站台雨棚（三跨，带排水沟）
  box(40, 0.45, 16, M.membrane, 2, 6.4, -6, g)
  box(40.6, 0.2, 16.6, M.brightSilver, 2, 6.72, -6, g)
  for (let i = 0; i < 7; i++) cyl(0.2, 0.2, 6.2, M.brightSilver, -16 + i * 6, 3.1, -13.4, 8, g)
  for (let i = 0; i < 7; i++) box(38, 0.12, 0.28, M.glWhite, 2, 6.0, -13 + i * 2.3, g)
  // 站台 + 巴士
  box(38, 0.24, 2.0, M.concrete, 2, 0.12, 0.4, g)
  for (let i = 0; i < 3; i++) {
    const bx = -10 + i * 11
    box(10.4, 3.0, 2.9, M.glazeWhite, bx, 1.8, -3.4, g)
    box(10.4, 0.9, 2.9, M.paintBlue, bx, 0.55, -3.4, g)
    box(3.0, 1.5, 2.94, M.glSmoke, bx - 3.2, 2.3, -3.4, g)
    for (let k = 0; k < 5; k++) box(1.5, 1.1, 0.06, M.glDeepBlue, bx + 3.4 + (k % 3) * 1.9, 2.3, -1.94, g)
    for (const sx of [-3.4, 3.4]) for (const sz of [-1.2, 1.2]) cyl(0.46, 0.46, 0.4, M.charcoal, bx + sx, 0.5, -3.4 + sz, 10, g)
  }
  // 候车座椅 + 导视 + 垃圾桶 + 灯
  for (let i = 0; i < 4; i++) benchAt(g, -15 + i * 3.2, 4.6, 0)
  for (let i = 0; i < 3; i++) {
    box(0.7, 2.6, 0.12, M.paintBlue, -18, 1.3, 2.4 + i * 2.2, g)
    box(0.5, 2.2, 0.06, M.glazeWhite, -18, 1.3, 2.47 + i * 2.2, g)
  }
  box(2.6, 1.4, 0.16, M.glDeepBlue, 2, 4.6, 0.4, g)
  for (let i = 0; i < 4; i++) box(2.0, 0.1, 0.06, M.roadPaint, 2, 5.1 - i * 0.3, 0.5, g)
  for (const [lx, lz] of [[-19, -14], [0, -14], [19, -14]]) lampPost(g, lx, lz, 7.2, 0)
  for (let i = 0; i < 4; i++) treeAt(g, -19 + i * 12, 16, 1.0, 3.2)
  return { g, top: 12 }
}

/** 101 社区服务中心 / 派出所（四层 + 服务大厅） */
function t101(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 6, 40, 32, M.paving, 2.8, 'x')
  const fh = 3.6
  const floors = 4
  const H = floors * fh
  // 主体：石材基座 + 涂料上部 + 竖向色带
  box(26, H, 16, M.plasterWarm, 0, H / 2, -4, g)
  box(27, 1.2, 17, M.tuff, 0, 0.6, -4, g)
  box(26.8, 0.5, 16.8, M.whiteStone, 0, H + 0.25, -4, g)
  for (const sx of [-1, 1]) box(1.4, H, 17, M.paintBlue, sx * 12.4, H / 2, -4, g)
  // 南立面窗 + 竖向遮阳
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < 8; i++) {
      const px = -10.5 + i * 3.0
      if (f === 0 && i > 2 && i < 6) continue
      win(g, px, f * fh + 2.1, -4 + 8.06, 0, 2.0, 1.7, { glass: M.glTeal, frame: M.aluPanel, mull: 1 })
    }
    for (let i = 0; i <= 8; i++) {
      if (f === 0 && i > 2 && i < 7) continue
      box(0.14, fh - 0.6, 0.5, M.whiteStone, -12 + i * 3.0, f * fh + 1.9, 4.3, g)
    }
  }
  // 入口大厅（两层通高玻璃 + 门廊 + 国徽/标识）
  box(10, 6.4, 3.2, M.glWhite, 0, 3.2, 5.0, g)
  box(11.6, 0.5, 4.4, M.whiteStone, 0, 6.6, 5.6, g)
  for (let i = 0; i < 5; i++) box(0.2, 6.4, 0.2, M.aluDark, -5 + i * 2.5, 3.2, 6.7, g)
  box(4.2, 3.4, 0.2, M.glSmoke, 0, 1.7, 6.82, g)
  for (let k = 0; k < 3; k++) box(9.6, 0.2, 0.5 + k * 0.5, M.whiteStone, 0, 0.1 + (2 - k) * 0.2, 7.0 + k * 0.5, g)
  box(6.0, 1.0, 0.2, M.paintRed, 0, 7.3, 5.6, g)
  box(1.4, 1.4, 0.2, M.gold, 0, 8.3, 5.6, g)
  // 北立面与侧立面窗
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < 7; i++) win(g, -9 + i * 3.0, f * fh + 2.1, -12.06, Math.PI, 2.0, 1.7, { glass: M.glTeal, frame: M.aluPanel })
    for (const sx of [-1, 1]) {
      win(g, sx * 13.06, f * fh + 2.1, -8.5, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 2.2, 1.7, { glass: M.glTeal, frame: M.aluPanel })
      win(g, sx * 13.06, f * fh + 2.1, -1.5, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 2.2, 1.7, { glass: M.glTeal, frame: M.aluPanel })
    }
  }
  // 屋顶设备 + 旗杆
  const roofG = new THREE.Group()
  roofG.position.z = -4
  g.add(roofG)
  parapet(roofG, 26, 16, H, M.whiteStone, 0.9, 0.3)
  box(6.0, 2.0, 4.0, M.aluPanel, -6, H + 1.0, -6, g)
  box(4.0, 1.6, 3.0, M.aluPanel, 8, H + 0.8, -6, g)
  cyl(0.1, 0.14, 12, M.brightSilver, 16, 6, 6, 8, g)
  box(2.4, 1.5, 0.06, M.paintRed, 17.2, 10.8, 6, g)
  // 停车 + 无障碍 + 绿化 + 宣传栏
  for (let i = 0; i < 5; i++) {
    carAt(g, -14 + i * 5.2, 12, 0, [M.glazeWhite, M.charcoal, M.paintBlue, M.aluPanel, M.paintRed][i])
    box(2.4, 0.04, 4.4, M.glazeWhite, -14 + i * 5.2, 0.06, 12, g)
  }
  for (const sx of [-1, 1]) hedge(g, sx * 17, 2, 16, false, 0.9, 1.0)
  for (let i = 0; i < 4; i++) treeAt(g, -15 + i * 10, 16, 0.95, 3.0)
  box(6.0, 2.2, 0.3, M.paintBlue, 14, 1.4, 14, g)
  box(4.6, 1.6, 0.1, M.glazeWhite, 14, 1.4, 14.16, g)
  lampPost(g, -16, 15, 6.4, 0)
  lampPost(g, 16, 15, 6.4, 0)
  return { g, top: H + 4 }
}

/** 102 高架立交（主线 + 匝道 + 桥墩，跨 2 格） */
function t102(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 92, 42, M.concrete, 3.2, 'x')
  const deckY = 8.4
  // 主线高架（沿 x）
  box(92, 1.1, 11, M.concrete, 0, deckY, 0, g)
  box(92, 0.3, 11.8, M.aluDark, 0, deckY + 0.7, 0, g)
  // 中央分隔 + 护栏 + 隔音屏
  box(92, 1.4, 0.4, M.concrete, 0, deckY + 1.2, 0, g)
  for (const sz of [-1, 1]) {
    box(92, 1.5, 0.22, M.aluPanel, 0, deckY + 1.35, sz * 5.9, g)
    for (let i = 0; i < 12; i++) box(0.3, 0.9, 0.24, M.aluPanel, -44 + i * 8, deckY + 2.0, sz * 5.9, g)
  }
  // 桥墩（双柱 + 盖梁）
  for (let i = 0; i < 7; i++) {
    const px = -42 + i * 14
    box(10, 0.9, 11.6, M.concrete, px, deckY - 0.9, 0, g)
    for (const sz of [-1, 1]) {
      box(1.8, deckY - 1.6, 1.8, M.whiteStone, px, (deckY - 1.6) / 2, sz * 4.0, g)
      box(3.0, 0.4, 3.0, M.tuff, px, 0.2, sz * 4.0, g)
    }
    // 桥墩排水管
    cyl(0.16, 0.16, deckY - 1.2, M.aluDark, px + 1.2, (deckY - 1.2) / 2, 4.6, 8, g)
  }
  // 匝道（斜向下桥）
  for (const [dz, dir] of [[-1, 1], [1, -1]]) {
    for (let i = 0; i < 8; i++) {
      const t = i / 8
      const seg = box(11, 0.9, 6, M.concrete, dir * (12 + i * 5.6), deckY - t * 7.2, dz * (8 + i * 1.6), g)
      seg.rotation.y = dir * dz * 0.16
      seg.rotation.z = -dir * 0.19
      box(11, 1.1, 0.2, M.aluPanel, dir * (12 + i * 5.6), deckY - t * 7.2 + 0.8, dz * (11 + i * 1.6), g)
      box(1.6, deckY - t * 7.2, 1.6, M.whiteStone, dir * (12 + i * 5.6), (deckY - t * 7.2) / 2, dz * (8 + i * 1.6), g)
    }
  }
  // 主路车辆 + 桥下停车 + 绿化 + 灯杆
  for (let i = 0; i < 8; i++) {
    const cx = -38 + i * 11
    carAt(g, cx, 2.2, Math.PI / 2, [M.paintBlue, M.charcoal, M.glazeWhite, M.paintRed][i % 4])
    carAt(g, cx + 4, -2.2, -Math.PI / 2, [M.glTeal, M.aluPanel, M.paintYell, M.paintBlue][i % 4])
  }
  for (let i = 0; i < 6; i++) {
    carAt(g, -34 + i * 13, 15, Math.PI / 2, [M.glazeWhite, M.charcoal, M.paintBlue][i % 3])
    box(5.2, 0.05, 2.4, M.glazeWhite, -34 + i * 13, 0.08, 15, g)
  }
  for (let i = 0; i < 9; i++) {
    for (const sz of [-1, 1]) treeAt(g, -40 + i * 10, sz * 18, 0.9, 2.8)
  }
  for (let i = 0; i < 6; i++) {
    const px = -40 + i * 16
    cyl(0.16, 0.22, 9, M.aluPanel, px, 4.5, 8.6, 8, g)
    box(2.4, 0.2, 0.5, M.brightSilver, px + 0.8, 9.0, 8.6, g)
  }
  return { g, top: 14 }
}

/** 103 子弹头塔（双曲面连续收尖） */
function t103(x, z) {
  const g = group(x, z, 0)
  const H = 118
  const y0 = 10
  // 连续收分轮廓（腰略鼓，顶收成尖）
  const ctrl = [[0.3, 0], [11.4, 1.4], [12.5, 16], [12.0, 40], [10.0, 66], [6.9, 90], [3.6, 106], [1.1, 115], [0.25, H]]
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([r, y]) => new THREE.Vector3(r, y, 0)))
  const prof = curve.getPoints(46).map((p) => new THREE.Vector2(Math.max(0.22, p.x), p.y))
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), M.glSmoke)
  body.castShadow = body.receiveShadow = true
  add(body, 0, y0, 0, g)
  const rAt = (yy) => {
    for (let i = 1; i < prof.length; i++) {
      if (prof[i].y >= yy) {
        const a = prof[i - 1]
        const b = prof[i]
        const t = (yy - a.y) / Math.max(1e-4, b.y - a.y)
        return a.x + (b.x - a.x) * t
      }
    }
    return prof[prof.length - 1].x
  }
  // 竖向玻璃肋
  const ribs = 26
  const segN = 16
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2
    for (let k = 0; k < segN; k++) {
      const t0 = k / segN
      const t1 = (k + 1) / segN
      const ra = rAt(t0 * H) + 0.07
      const rb = rAt(t1 * H) + 0.07
      const m = beamBetween(g, Math.cos(a) * ra, y0 + t0 * H, Math.sin(a) * ra,
        Math.cos(a) * rb, y0 + t1 * H, Math.sin(a) * rb, 0.15, M.brightSilver, 0.13)
      m.castShadow = false
    }
  }
  // 三条螺旋光带（菱形网格的斜向脉络）
  for (let s = 0; s < 3; s++) {
    const n = 48
    for (let k = 0; k < n; k++) {
      const t0 = k / n
      const t1 = (k + 1) / n
      const a0 = s * 2.094 + t0 * 2.5
      const a1 = s * 2.094 + t1 * 2.5
      const ra = rAt(t0 * H * 0.95) + 0.14
      const rb = rAt(t1 * H * 0.95) + 0.14
      const m = beamBetween(g, Math.cos(a0) * ra, y0 + t0 * H * 0.95, Math.sin(a0) * ra,
        Math.cos(a1) * rb, y0 + t1 * H * 0.95, Math.sin(a1) * rb, 0.44, M.glChampagne, 0.1)
      m.castShadow = false
    }
  }
  // 塔尖 + 航空灯
  cyl(0.16, 0.5, 4.0, M.brightSilver, 0, y0 + H + 1.6, 0, 10, g)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.paintRed)
  add(beacon, 0, y0 + H + 3.8, 0, g)
  // 圆形裙房 + 大堂 + 雨棚
  cyl(16.6, 17.2, 10, M.tuff, 0, 5, 0, 48, g)
  cyl(17.2, 17.4, 0.5, M.whiteStone, 0, 10.2, 0, 48, g)
  cyl(16.2, 16.2, 6.4, M.glSmoke, 0, 3.4, 0, 48, g, true)
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2
    box(0.24, 6.4, 0.24, M.brightSilver, Math.cos(a) * 16.3, 3.4, Math.sin(a) * 16.3, g)
  }
  cyl(13.4, 13.4, 0.4, M.brightSilver, 0, 6.9, 0, 40, g)
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    cyl(0.18, 0.18, 6.6, M.brightSilver, Math.cos(a) * 15.6, 3.3, Math.sin(a) * 15.6, 8, g)
  }
  // 广场
  paved(g, 0, 0, 40, 40, M.paving, 3.0, 'x')
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3
    treeAt(g, Math.cos(a) * 19.5, Math.sin(a) * 19.5, 0.95, 3.2)
  }
  for (const [lx, lz] of [[-19, 16], [19, 16], [-19, -16], [19, -16]]) lampPost(g, lx, lz, 7.0, 0)
  for (let i = 0; i < 4; i++) carAt(g, -12 + i * 7.6, 20.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed][i])
  return { g, top: y0 + H + 4 }
}

/** 104 倾斜塔（塔身逐层外倾 + 斜柱落地） */
function t104(x, z) {
  const g = group(x, z, 0)
  const fh = 3.8
  const floors = 24
  const H = fh * floors
  const lean = 0.15
  const baseY = 2.8
  // 台基（覆盖倾斜投影）
  box(34, 1.6, 26, M.whiteStone, 0, 0.8, 0, g)
  box(31, 1.2, 23, M.tuff, 0, 2.2, 0, g)
  // 塔身逐层错位堆叠
  for (let i = 0; i < floors; i++) {
    const ox = i * fh * lean
    const y = baseY + i * fh
    const seg = new THREE.Mesh(prismGeo(17, 15, 3.2, fh + 0.02), i % 2 ? M.glIce : M.glSmoke)
    seg.castShadow = seg.receiveShadow = true
    add(seg, ox, y, 0, g)
    const belt = new THREE.Mesh(prismGeo(17.9, 15.9, 3.4, 0.26), M.brightSilver)
    add(belt, ox, y + fh - 0.13, 0, g)
    // 玻璃分格压条
    if (i % 2 === 0) {
      const mull = new THREE.Mesh(prismGeo(17.2, 15.2, 3.3, 0.06), M.aluDark)
      add(mull, ox, y + fh * 0.5, 0, g)
    }
  }
  // 倾斜竖向鳍（沿倾斜方向连续）
  for (const sz of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const zz = sz * (7.4 - k * 1.9)
      const m = beamBetween(g, 0, baseY, zz, H * lean, baseY + H, zz, 0.26, M.whiteStone, 0.3)
      m.castShadow = false
    }
  }
  // 底部斜撑
  for (const sz of [-1, 1]) {
    const m = beamBetween(g, H * lean * 0.62, 12, sz * 7.0, H * lean * 0.62 + 0.6, 40, sz * 7.4, 1.1, M.whiteStone, 1.1)
    m.castShadow = true
    box(2.4, 0.8, 2.4, M.tuff, H * lean * 0.62, 0.4, sz * 7.0, g)
  }
  // 首层大堂
  box(21, 0.2, 24, M.paving, H * lean * 0.2, baseY + 0.1, 0, g)
  gridGlass(g, H * lean * 0.1, 1.6, 7.7, 0, 14, 3.0, 6, 1, { glass: M.glSmoke, frame: M.aluDark })
  box(8.4, 0.4, 3.0, M.brightSilver, H * lean * 0.06, 3.6, 9.2, g)
  // 屋顶观景台 + 冠
  const tx = H * lean
  box(19, 0.5, 17, M.whiteStone, tx, baseY + H + 0.25, 0, g)
  railing(g, 17, baseY + H + 0.5, 8.4, M.brightSilver, 10, 1.1)
  railing(g, 17, baseY + H + 0.5, -8.4, M.brightSilver, 10, 1.1)
  box(15, 3.0, 13, M.aluPanel, tx, baseY + H + 2.0, 0, g)
  box(11, 2.4, 9, M.glWhite, tx, baseY + H + 4.7, 0, g)
  cyl(0.2, 0.6, 9, M.brightSilver, tx, baseY + H + 10.4, 0, 8, g)
  // 广场
  paved(g, 0, 0, 42, 40, M.paving, 3.0, 'x')
  for (let i = 0; i < 8; i++) treeAt(g, -18 + i * 5.2, 18.5, 0.85, 3.0)
  for (const [lx, lz] of [[-17, 13], [17, 13], [-17, -13], [17, -13]]) lampPost(g, lx, lz, 6.8, 0)
  for (let i = 0; i < 4; i++) carAt(g, -12 + i * 8, -18.5, Math.PI, [M.charcoal, M.glazeWhite, M.glTeal, M.paintRed][i])
  return { g, top: baseY + H + 14 }
}

/** 105 门洞塔（双塔顶部悬挑对接，中间透空） */
function t105(x, z) {
  const g = group(x, z, 0)
  const H = 96
  const LW = 11.5
  const LD = 13
  const LEG = 13.5
  // 两条塔腿（逐 4m 分段的幕墙）
  for (const s of [-1, 1]) {
    for (let i = 0; i < 21; i++) {
      const y = i * 4
      const seg = new THREE.Mesh(prismGeo(LW, LD, 1.2, 4.02), i % 2 ? M.glSmoke : M.glNavy)
      seg.castShadow = seg.receiveShadow = true
      add(seg, s * LEG, y + 2, 0, g)
      box(LW + 0.3, 0.22, LD + 0.3, M.brightSilver, s * LEG, y + 4, 0, g)
    }
    // 腿端核心筒
    for (const zz of [-1, 1]) box(LW + 0.6, H, 1.4, M.whiteStone, s * LEG, H / 2, zz * (LD / 2 + 0.4), g)
    // 外立面 X 形斜交网格
    for (const zz of [-1, 1]) {
      for (let k = 0; k < 7; k++) {
        const y0 = 4 + k * 13
        const y1 = y0 + 13
        const zf = zz * (LD / 2 + 0.16)
        const a = beamBetween(g, s * (LEG - LW / 2 + 0.4), y0, zf, s * (LEG + LW / 2 - 0.4), y1, zf, 0.34, M.brightSilver, 0.34)
        const b = beamBetween(g, s * (LEG + LW / 2 - 0.4), y0, zf, s * (LEG - LW / 2 + 0.4), y1, zf, 0.34, M.brightSilver, 0.34)
        a.castShadow = false
        b.castShadow = false
      }
    }
  }
  // 顶部横向体块（悬挑对接）
  box(LEG * 2 + LW, 14, LD, M.glNavy, 0, 89, 0, g)
  for (const zz of [-1, 1]) {
    gridGlass(g, 0, 89, zz * (LD / 2 + 0.05), zz > 0 ? 0 : Math.PI, 34, 12, 12, 3, { glass: M.glWhite, frame: M.brightSilver })
  }
  box(LEG * 2 + LW + 0.8, 0.6, LD + 0.8, M.brightSilver, 0, 96.3, 0, g)
  box(LEG * 2 + LW + 0.4, 0.5, LD + 0.4, M.whiteStone, 0, 81.8, 0, g)
  // 顶梁下弦斜撑桁架
  for (let i = 0; i < 6; i++) {
    const px = -16 + i * 6.4
    const a = beamBetween(g, px, 82.2, -5.4, px + 6.4, 86.0, -5.4, 0.45, M.aluPanel, 0.45)
    const b = beamBetween(g, px, 86.0, -5.4, px + 6.4, 82.2, -5.4, 0.45, M.aluPanel, 0.45)
    a.castShadow = b.castShadow = false
    box(0.5, 3.8, 0.4, M.aluPanel, px, 84.1, -5.4, g)
  }
  // 顶部悬挑体块底面（门洞顶棚）：吊顶板 + 筒灯 + 竖向挡板
  box(LEG * 2 + LW - 1.0, 0.3, LD - 1.0, M.aluPanel, 0, 81.75, 0, g)
  for (let i = 0; i < 7; i++) {
    for (let k = 0; k < 3; k++) {
      const lx = -15.0 + i * 5.0
      const lz = -4.0 + k * 4.0
      const dl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 12), M.glChampagne)
      add(dl, lx, 81.55, lz, g)
    }
  }
  for (const zz of [-1, 1]) {
    box(LEG * 2 + LW, 0.9, 0.14, M.brightSilver, 0, 81.4, zz * (LD / 2 - 0.5), g)
  }
  // 两塔腿内侧面（门洞侧壁）：竖梃 + 竖缝，避免大面积素玻璃
  for (const sgn of [-1, 1]) {
    const innerX = sgn * (LEG - LW / 2 - 0.02)
    for (let i = 0; i < 20; i++) {
      box(0.16, 3.9, 0.16, M.brightSilver, innerX, 2 + i * 4.0, -LD / 2 + 1.2, g)
      box(0.16, 3.9, 0.16, M.brightSilver, innerX, 2 + i * 4.0, LD / 2 - 1.2, g)
    }
    for (let i = 0; i < 4; i++) {
      box(0.18, H - 8, 0.24, M.whiteStone, innerX - sgn * 0.06, H / 2 + 4, -LD / 2 + 2.4 + i * 2.8, g)
    }
  }
  // 门洞底部：下沉广场 + 树池 + 台阶（人可从洞中穿过）
  box(LEG * 2 - LW, 0.24, 6.0, M.paving, 0, 0.12, 0, g)
  for (const sgn of [-1, 1]) {
    planter(g, sgn * 6.0, 0, 3.0, 2.0, 0.24)
    steps(g, 8.0, 3, 0.18, 0.5, 0.24, M.whiteStone, sgn * 9.0)
  }
  // 底部基座 + 入口
  box(LEG * 2 + LW + 8, 13, 18, M.tuff, 0, 6.5, 0, g)
  box(LEG * 2 + LW + 9, 0.7, 19, M.whiteStone, 0, 13.2, 0, g)
  gridGlass(g, 0, 3.4, 9.05, 0, 20, 6.4, 8, 2, { glass: M.glSmoke, frame: M.aluDark })
  box(12, 5.2, 3.2, M.glWhite, 0, 2.6, 10.4, g)
  box(14, 0.45, 4.4, M.brightSilver, 0, 5.4, 11.2, g)
  box(9, 4.4, 0.2, M.glSmoke, 0, 2.2, 12.0, g)
  // 屋面设备 + 航空灯
  box(10, 2.0, 6, M.aluPanel, 4, 97.6, -2, g)
  box(6, 1.6, 5, M.aluPanel, -8, 97.4, 2, g)
  for (const px of [-17, 17]) {
    cyl(0.14, 0.3, 6, M.brightSilver, px, 99.4, 0, 8, g)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), M.paintRed)
    add(lamp, px, 102.6, 0, g)
  }
  // 广场
  paved(g, 0, 0, 92, 40, M.paving, 3.2, 'x')
  for (let i = 0; i < 10; i++) treeAt(g, -40 + i * 8.8, 16.5, 0.9, 3.0)
  for (let i = 0; i < 10; i++) treeAt(g, -40 + i * 8.8, -16.5, 0.9, 3.0)
  for (let i = 0; i < 6; i++) carAt(g, -24 + i * 7.0, 18.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.glazeWhite, M.paintRed, M.aluPanel][i])
  for (const [lx, lz] of [[-26, 14], [0, 14], [26, 14]]) lampPost(g, lx, lz, 7.0, 0)
  return { g, top: 103 }
}

/** 106 V 形双塔（底部收拢、顶部张开 + 三道连桥） */
function t106(x, z) {
  const g = group(x, z, 0)
  const fh = 4.0
  const floors = 26
  const H = fh * floors
  const spread = 0.42
  const baseX = 6.2
  // 裙房
  box(34, 9, 22, M.tuff, 0, 4.5, 0, g)
  box(35, 0.6, 23, M.whiteStone, 0, 9.3, 0, g)
  gridGlass(g, 0, 3.6, 11.1, 0, 28, 6.6, 10, 2, { glass: M.glSmoke, frame: M.brightSilver })
  box(9, 5.0, 3.2, M.glWhite, 0, 2.5, 12.4, g)
  box(12, 0.45, 4.6, M.brightSilver, 0, 5.3, 13.4, g)
  // 两塔
  for (const s of [-1, 1]) {
    for (let i = 0; i < floors; i++) {
      const cx = s * (baseX + i * spread)
      const y = 9 + i * fh
      const seg = new THREE.Mesh(prismGeo(13, 13, 2.2, fh + 0.02), i % 2 ? M.glChampagne : M.glWhite)
      seg.castShadow = seg.receiveShadow = true
      add(seg, cx, y + fh / 2, 0, g)
      box(13.6, 0.22, 13.6, M.brightSilver, cx, y + fh, 0, g)
    }
    // 塔冠
    const tx = s * (baseX + (floors - 1) * spread)
    box(14, 2.4, 14, M.aluPanel, tx, 9 + H + 1.2, 0, g)
    box(10.5, 3.0, 10.5, M.glSmoke, tx, 9 + H + 3.9, 0, g)
    cyl(0.24, 0.7, 10, M.brightSilver, tx, 9 + H + 10.4, 0, 8, g)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), M.paintRed)
    add(lamp, tx, 9 + H + 15.6, 0, g)
    // 竖向鳍（外侧面）
    for (const zz of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const m = beamBetween(g, s * (baseX - 5.4 + k * 5.4), 9, zz * 6.6,
          s * (baseX + (floors - 1) * spread - 5.4 + k * 5.4), 9 + H, zz * 6.6, 0.18, M.whiteStone, 0.5)
        m.castShadow = false
      }
    }
    // 内侧面对立面的横向遮阳带 + 竖向分格（原来只有素玻璃）
    for (let i = 0; i < floors; i += 2) {
      const cx = s * (baseX + i * spread)
      const y = 9 + i * fh
      box(13.2, 0.5, 0.2, M.whiteStone, cx - s * 6.5, y + fh * 0.62, 0, g)
    }
    for (let i = 0; i < floors; i += 3) {
      const cx = s * (baseX + i * spread)
      const y = 9 + i * fh
      box(0.2, fh * 3.0, 0.24, M.brightSilver, cx - s * 6.6, y + fh * 1.5, 0, g)
    }
    // 内侧角部竖向装饰肋（随倾斜角度）
    for (const zz of [-1, 1]) {
      const m = beamBetween(g, s * (baseX - 6.4), 9, zz * 6.4,
        s * (baseX + (floors - 1) * spread - 6.4), 9 + H, zz * 6.4, 0.3, M.whiteStone, 0.42)
      m.castShadow = false
    }
  }
  // 三道连桥
  for (const by of [32, 58, 84]) {
    const i = (by - 9) / fh
    const half = baseX + i * spread
    const len = (half - 6.5) * 2
    box(len, 4.2, 7.4, M.glWhite, 0, by, 0, g)
    for (const zz of [-1, 1]) gridGlass(g, 0, by, zz * 3.76, zz > 0 ? 0 : Math.PI, len - 1.6, 2.8, 7, 1, { glass: M.glSmoke, frame: M.brightSilver })
    box(len + 0.6, 0.35, 8.0, M.brightSilver, 0, by + 2.3, 0, g)
    box(len + 0.6, 0.35, 8.0, M.brightSilver, 0, by - 2.3, 0, g)
    box(0.5, 4.2, 0.5, M.aluDark, 0, by, 3.6, g)
    // 桥底吊顶 + 灯带，桥面栏杆 + 天窗
    box(len - 1.2, 0.24, 7.0, M.aluPanel, 0, by - 2.42, 0, g)
    for (let k = 0; k < 6; k++) box(len / 7, 0.08, 0.16, M.glChampagne, -len / 2 + (len / 7) * (k + 0.5), by - 2.56, 0, g)
    box(len - 3.0, 0.3, 2.4, M.glIce, 0, by + 2.55, 0, g)
    for (let k = 0; k < 5; k++) box(0.1, 0.4, 2.4, M.aluDark, -len / 2 + (len / 5) * (k + 0.5), by + 2.55, 0, g)
    for (const zz of [-1, 1]) {
      box(len, 0.09, 0.12, M.brightSilver, 0, by + 3.3, zz * 3.9, g)
      for (let k = 0; k <= 10; k++) box(0.06, 0.95, 0.06, M.brightSilver, -len / 2 + (len / 10) * k, by + 2.85, zz * 3.9, g)
    }
  }
  // 广场
  paved(g, 0, 0, 94, 42, M.paving, 3.2, 'x')
  for (let i = 0; i < 9; i++) treeAt(g, -40 + i * 10, 17.5, 0.9, 3.0)
  for (let i = 0; i < 5; i++) carAt(g, -16 + i * 8, 18.8, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed, M.aluPanel][i])
  for (const [lx, lz] of [[-38, 12], [-14, 13], [14, 13], [38, 12]]) lampPost(g, lx, lz, 7.0, 0)
  return { g, top: 9 + H + 17 }
}

/** 107 三瓣花瓣塔 */
function t107(x, z) {
  const g = group(x, z, 0)
  const H = 90
  const segs = 20
  const fh = H / segs
  // 核心筒
  cyl(5.6, 6.0, H + 8, M.whiteStone, 0, (H + 8) / 2, 0, 24, g)
  for (let i = 1; i < 12; i++) cyl(5.9, 5.9, 0.18, M.brightSilver, 0, i * 7.4, 0, 24, g)
  // 三个瓣
  for (let p = 0; p < 3; p++) {
    const a = (p / 3) * Math.PI * 2
    const bx = Math.cos(a) * 8.6
    const bz = Math.sin(a) * 8.6
    for (let i = 0; i < segs; i++) {
      const t = i / segs
      const r = 8.2 - t * 2.6
      const seg = cyl(r, r + 0.16, fh + 0.02, i % 2 ? M.glSilver : M.glWhite, bx, i * fh + fh / 2, bz, 26, g)
      seg.scale.set(1.45, 1, 0.82)
      seg.rotation.y = -a
      const belt = cyl(r + 0.24, r + 0.34, 0.24, M.whiteStone, bx, (i + 1) * fh, bz, 26, g)
      belt.scale.set(1.45, 1, 0.82)
      belt.rotation.y = -a
    }
    // 瓣顶斜切锥
    const topR = 5.6
    const cone = new THREE.Mesh(new THREE.ConeGeometry(topR, 9, 26), M.glWhite)
    cone.scale.set(1.45, 1, 0.82)
    cone.rotation.y = -a
    cone.castShadow = true
    add(cone, bx, H + 4.5, bz, g)
    // 瓣面竖肋
    for (let k = -3; k <= 3; k++) {
      const off = (k / 3) * 0.9
      const m = beamBetween(g, bx + Math.cos(a + Math.PI / 2) * off * 11.4, 0, bz + Math.sin(a + Math.PI / 2) * off * 11.4,
        bx + Math.cos(a + Math.PI / 2) * off * 7.8, H, bz + Math.sin(a + Math.PI / 2) * off * 7.8, 0.14, M.brightSilver, 0.14)
      m.castShadow = false
    }
    // 瓣间凹槽玻璃（内凹竖条）
    box(0.5, H * 0.92, 2.2, M.glDeepBlue, bx * 1.02, H * 0.46, bz * 1.02, g).rotation.y = -a
  }
  // 核心筒顶：观光平台 + 冠
  cyl(6.6, 6.6, 0.5, M.whiteStone, 0, H + 8.2, 0, 24, g)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    cyl(0.1, 0.1, 1.2, M.brightSilver, Math.cos(a) * 6.2, H + 9.0, Math.sin(a) * 6.2, 6, g)
  }
  cyl(6.3, 6.3, 0.1, M.brightSilver, 0, H + 9.6, 0, 24, g)
  cyl(0.3, 1.2, 4.0, M.brightSilver, 0, H + 11.6, 0, 10, g)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), M.paintRed)
  add(beacon, 0, H + 13.8, 0, g)
  // 裙房 + 三瓣基座水景
  cyl(21, 21.6, 7, M.tuff, 0, 3.5, 0, 48, g)
  cyl(21.4, 21.4, 0.4, M.whiteStone, 0, 7.2, 0, 48, g)
  cyl(15.6, 15.6, 4.6, M.glSmoke, 0, 2.3, 0, 40, g, true)
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2
    box(0.2, 4.6, 0.2, M.brightSilver, Math.cos(a) * 15.7, 2.3, Math.sin(a) * 15.7, g)
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 3
    box(7.0, 0.6, 3.0, M.glTeal, Math.cos(a) * 19.0, 0.3, Math.sin(a) * 19.0, g).rotation.y = -a + Math.PI / 2
  }
  // 广场
  paved(g, 0, 0, 44, 44, M.paving, 3.0, 'x')
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5
    treeAt(g, Math.cos(a) * 20.5, Math.sin(a) * 20.5, 0.9, 3.0)
  }
  for (let i = 0; i < 4; i++) carAt(g, -12 + i * 8, 21.5, 0, [M.glazeWhite, M.charcoal, M.paintBlue, M.paintYell][i])
  for (const [lx, lz] of [[-20, 15], [20, 15], [0, 22]]) lampPost(g, lx, lz, 7.0, 0)
  return { g, top: H + 15 }
}

/** 108 刀片塔（极薄板式 + 楔形收尖） */
function t108(x, z) {
  const g = group(x, z, 0)
  const fh = 4.0
  const floors = 27
  const H = fh * floors
  // 台基 + 大堂
  box(38, 1.2, 14, M.whiteStone, 0, 0.6, 0, g)
  box(36, 5.4, 12, M.tuff, 0, 2.7, 0, g)
  gridGlass(g, 0, 2.4, 6.1, 0, 30, 4.4, 12, 1, { glass: M.glSmoke, frame: M.aluDark })
  gridGlass(g, 0, 2.4, -6.1, Math.PI, 30, 4.4, 12, 1, { glass: M.glSmoke, frame: M.aluDark })
  // 塔身（逐段收窄，端部形成刀锋）
  for (let i = 0; i < floors; i++) {
    const w = 30 - i * 0.34
    const y = 5.4 + i * fh
    const seg = box(w, fh + 0.02, 7.0, i % 2 ? M.glIce : M.glSilver, 0, y + fh / 2, 0, g)
    seg.castShadow = seg.receiveShadow = true
    box(w + 0.4, 0.22, 7.6, M.whiteStone, 0, y + fh, 0, g)
  }
  // 顶部楔形
  const tw = 30 - (floors - 1) * 0.34
  const ty = 5.4 + H
  box(tw * 0.8, 4.0, 6.6, M.glWhite, 0, ty + 2.0, 0, g)
  box(tw * 0.5, 3.4, 5.6, M.glWhite, 0, ty + 5.6, 0, g)
  box(tw * 0.2, 2.6, 4.0, M.aluPanel, 0, ty + 8.6, 0, g)
  cyl(0.16, 0.5, 14, M.brightSilver, 0, ty + 17.0, 0, 8, g)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.paintRed)
  add(beacon, 0, ty + 24.2, 0, g)
  // 南北立面：连续横向窗带 + 竖向鳍
  for (let i = 0; i < floors; i++) {
    const w = 30 - i * 0.34
    const y = 5.4 + i * fh
    for (const sz of [-1, 1]) {
      box(w - 1.6, 1.5, 0.16, M.glDeepBlue, 0, y + fh * 0.55, sz * 3.56, g)
      box(w - 1.6, 0.1, 0.26, M.brightSilver, 0, y + fh * 0.55 + 0.75, sz * 3.6, g)
    }
  }
  for (let i = 0; i <= 12; i++) {
    const px = -13.6 + i * 1.7
    for (const sz of [-1, 1]) {
      const m = beamBetween(g, px, 5.4, sz * 3.6, px * 0.74, 5.4 + H, sz * 3.6, 0.16, M.brightSilver, 0.42)
      m.castShadow = false
    }
  }
  // 两端核心筒（石材收头）
  for (const sx of [-1, 1]) {
    const m = beamBetween(g, sx * 15.4, 5.4, 0, sx * 11.2, 5.4 + H, 0, 4.4, M.whiteStone, 8.4)
    m.castShadow = true
    for (let i = 0; i < 6; i++) {
      const t = (i + 1) / 7
      box(0.4, 1.4, 2.0, M.glWhite, sx * (15.4 - 4.2 * t), 5.4 + H * t, 4.2, g)
      box(0.4, 1.4, 2.0, M.glWhite, sx * (15.4 - 4.2 * t), 5.4 + H * t, -4.2, g)
    }
  }
  // 广场
  paved(g, 0, 0, 44, 40, M.paving, 3.0, 'x')
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) treeAt(g, sx * 17.5, -8 + i * 6, 0.85, 3.0)
  for (let i = 0; i < 5; i++) carAt(g, -16 + i * 8, 10.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed, M.aluPanel][i])
  for (const [lx, lz] of [[-20, 10], [20, 10], [-20, -10], [20, -10]]) lampPost(g, lx, lz, 6.8, 0)
  return { g, top: ty + 26 }
}
/** 109 分叉巨柱塔（树状斜柱托起悬挑塔楼） */
function t109(x, z) {
  const g = group(x, z, 0)
  const lift = 24
  const H = 70
  const top = lift + H
  // 核心筒（落地）
  box(9.5, top + 4, 9.5, M.tuff, 0, (top + 4) / 2, 0, g)
  box(10.2, 0.4, 10.2, M.whiteStone, 0, top + 4.2, 0, g)
  // 分叉斜柱：四角各两根，从地面散点汇聚到塔底
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const k of [-1, 1]) {
        const bx = sx * 15 + (k > 0 ? sx * 2 : 0)
        const bz = sz * (k > 0 ? 12 : 15)
        box(2.0, 1.0, 2.0, M.tuff, bx, 0.5, bz, g)
        const m = beamBetween(g, bx, 1.0, bz, sx * 7.6, lift, sz * 7.6, 1.7, M.whiteStone, 1.7)
        m.castShadow = true
        box(1.9, 1.4, 1.9, M.brightSilver, sx * 7.6, lift - 0.7, sz * 7.6, g)
      }
    }
  }
  // 塔底悬挑板
  box(23, 1.3, 23, M.aluPanel, 0, lift + 0.65, 0, g)
  box(23.6, 0.3, 23.6, M.brightSilver, 0, lift + 1.4, 0, g)
  // 塔身
  const fh = 4.2
  const floors = Math.floor(H / fh)
  for (let i = 0; i < floors; i++) {
    const y = lift + 1.4 + i * fh
    const seg = new THREE.Mesh(prismGeo(19, 19, 2.6, fh + 0.02), i % 2 ? M.glTeal : M.glWhite)
    seg.castShadow = seg.receiveShadow = true
    add(seg, 0, y + fh / 2, 0, g)
    box(19.6, 0.24, 19.6, M.whiteStone, 0, y + fh, 0, g)
    // 角部实墙带
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(3.2, fh, 3.2, M.tuff, sx * 8.0, y + fh / 2, sz * 8.0, g)
    }
    // 每层一道窗间墙
    if (i % 2 === 0) {
      for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
        box(9.6, 0.16, 0.2, M.aluDark, dx * 9.75, y + fh * 0.5, dz * 9.75, g)
      }
    }
  }
  // 冠 + 塔顶花园
  const ty = lift + 1.4 + floors * fh
  box(20, 2.6, 20, M.aluPanel, 0, ty + 1.3, 0, g)
  box(15, 3.2, 15, M.glSmoke, 0, ty + 4.2, 0, g)
  cyl(0.26, 0.8, 11, M.brightSilver, 0, ty + 11.0, 0, 8, g)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.paintRed)
  add(beacon, 0, ty + 16.6, 0, g)
  // 底部架空广场（柱间穿行）
  paved(g, 0, 0, 44, 44, M.paving, 3.0, 'x')
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(5.2, 0.4, 5.2, M.whiteStone, sx * 8.4, 0.2, sz * 8.4, g)
    treeAt(g, sx * 8.4, sz * 8.4, 0.85, 2.6)
  }
  for (let i = 0; i < 4; i++) benchAt(g, -6 + i * 4, 15.4, 0)
  for (const [lx, lz] of [[-19, 17], [19, 17], [-19, -17], [19, -17]]) lampPost(g, lx, lz, 6.8, 0)
  for (let i = 0; i < 4; i++) carAt(g, -13 + i * 8.6, -19.5, Math.PI, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed][i])
  return { g, top: ty + 18 }
}

/** 110 折纸塔（三角折面逐段旋转 60°） */
function t110(x, z) {
  const g = group(x, z, 0)
  const segH = 26
  const segs = 4
  // 裙房
  box(30, 8, 26, M.tuff, 0, 4, 0, g)
  box(31, 0.5, 27, M.whiteStone, 0, 8.2, 0, g)
  box(1.0, 0.5, 27, M.aluPanel, 0, 8.5, 0, g)
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
    gridGlass(g, dx * 15.1, 3.4, dz * 13.1, ry, dx ? 24 : 28, 5.8, 8, 2, { glass: M.glSmoke, frame: M.aluDark })
  }
  box(8, 4.6, 3.2, M.glWhite, 0, 2.3, 14.4, g)
  box(11, 0.4, 4.4, M.brightSilver, 0, 4.8, 15.4, g)
  // 四段折面
  for (let s = 0; s < segs; s++) {
    const r = 16 - s * 2.1
    const y = 8 + s * segH
    const rot = (s * Math.PI) / 3 + Math.PI / 6
    const body = cyl(r, r + 0.3, segH, s % 2 ? M.glIce : M.glSilver, 0, y + segH / 2, 0, 3, g)
    body.rotation.y = rot
    body.castShadow = body.receiveShadow = true
    // 折面檐口
    const eave = cyl(r * 1.18, r * 1.24, 1.1, M.whiteStone, 0, y + segH, 0, 3, g)
    eave.rotation.y = rot
    cyl(r * 1.2, r * 1.2, 0.16, M.brightSilver, 0, y + segH + 0.6, 0, 3, g).rotation.y = rot
    // 三条竖向棱
    for (let k = 0; k < 3; k++) {
      const a = rot + (k / 3) * Math.PI * 2 + Math.PI / 2
      const px = Math.cos(a) * r
      const pz = Math.sin(a) * r
      box(0.34, segH, 0.34, M.brightSilver, px, y + segH / 2, pz, g)
      const px2 = Math.cos(a) * (r * 1.2)
      const pz2 = Math.sin(a) * (r * 1.2)
      box(0.3, 1.0, 0.3, M.whiteStone, px2, y + segH + 0.4, pz2, g)
    }
    // 横向窗带
    for (let k = 0; k < 4; k++) {
      cyl(r + 0.08, r + 0.08, 0.16, M.brightSilver, 0, y + 5.2 + k * 5.4, 0, 3, g).rotation.y = rot
    }
    // 面上竖向折线
    for (let k = 0; k < 3; k++) {
      const a = rot + (k / 3) * Math.PI * 2
      const m = beamBetween(g, Math.cos(a + 0.5) * r * 0.94, y + 1.2, Math.sin(a + 0.5) * r * 0.94,
        Math.cos(a + 0.5) * r * 0.94, y + segH - 1.2, Math.sin(a + 0.5) * r * 0.94, 0.12, M.aluDark, 0.12)
      m.castShadow = false
    }
  }
  // 顶冠（三角锥）
  const ty = 8 + segs * segH
  const cap = new THREE.Mesh(new THREE.ConeGeometry(5.2, 10, 3), M.whiteStone)
  cap.rotation.y = Math.PI / 6
  cap.castShadow = true
  add(cap, 0, ty + 5, 0, g)
  cyl(0.2, 0.6, 8, M.brightSilver, 0, ty + 13.4, 0, 8, g)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), M.paintRed)
  add(beacon, 0, ty + 17.8, 0, g)
  // 广场
  paved(g, 0, 0, 44, 44, M.paving, 3.0, 'x')
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.2
    box(5.0, 0.6, 5.0, M.whiteStone, Math.cos(a) * 18.5, 0.3, Math.sin(a) * 18.5, g)
    treeAt(g, Math.cos(a) * 18.5, Math.sin(a) * 18.5, 0.9, 3.0)
  }
  for (let i = 0; i < 4; i++) carAt(g, -13 + i * 8.6, 20.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed][i])
  for (const [lx, lz] of [[-19, 14], [19, 14], [-19, -14], [19, -14]]) lampPost(g, lx, lz, 6.8, 0)
  return { g, top: ty + 19 }
}

/** 111 积木堆叠塔（错位外挑体块 + 外露钢柱） */
function t111(x, z) {
  const g = group(x, z, 0)
  const blocks = [
    [0, 0, 24, 20, 14, 0],
    [-4.5, 1.5, 20, 17, 13, 0.1],
    [5.0, -2.0, 21, 15, 12, -0.09],
    [-3.0, 2.5, 18, 17, 13, 0.05],
    [4.5, 0.5, 16, 15, 12, 0.14],
    [-2.5, -1.5, 15, 15, 13, -0.06],
    [1.5, 1.5, 12, 12, 11, 0.1],
  ]
  // 外露钢柱（贯穿体块，从地面到顶）
  const totalH = blocks.reduce((s, b) => s + b[4], 0)
  for (const [px, pz] of [[-8.5, -6.5], [8.5, -6.5], [-8.5, 6.5], [8.5, 6.5]]) {
    box(0.9, totalH + 3.0, 0.9, M.aluDark, px, (totalH + 3.0) / 2, pz, g)
    for (let i = 0; i < 6; i++) box(1.3, 0.25, 1.3, M.brightSilver, px, 3 + i * 12, pz, g)
  }
  let y = 0
  for (let i = 0; i < blocks.length; i++) {
    const [bx, bz, bw, bd, bh, rot] = blocks[i]
    const gl = i % 2 ? M.glWhite : M.glSmoke
    const s = new THREE.Group()
    s.position.set(bx, y, bz)
    s.rotation.y = rot
    g.add(s)
    const m = new THREE.Mesh(prismGeo(bw, bd, 1.0, bh), gl)
    m.castShadow = m.receiveShadow = true
    s.add(m)
    // 体块顶板 + 底部托板
    box(bw + 0.5, 0.3, bd + 0.5, M.brightSilver, 0, bh + 0.15, 0, s)
    box(bw + 0.3, 0.26, bd + 0.3, M.aluDark, 0, -0.13, 0, s)
    // 四面幕墙分格
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
      gridGlass(s, dx * (bw / 2 + 0.05), bh * 0.55, dz * (bd / 2 + 0.05), ry, dx ? bd - 2 : bw - 2, bh * 0.66, 5, 1, { glass: gl, frame: M.aluDark, mw: 0.08, mh: 0.1 })
    }
    // 屋顶设备 / 露台
    if (i < blocks.length - 1) {
      box(bw * 0.4, 1.1, 1.6, M.aluPanel, -bw * 0.2, bh + 0.85, bd * 0.22, s)
    } else {
      // 顶块：露台栏杆
      for (const sz of [-1, 1]) railing(s, bw - 1, bh + 0.3, sz * (bd / 2 - 0.3), M.brightSilver, 6, 1.0)
      box(bw * 0.3, 2.6, bd * 0.3, M.aluPanel, 0, bh + 1.6, 0, s)
      cyl(0.16, 0.4, 8, M.brightSilver, 0, bh + 7.0, 0, 8, s)
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), M.paintRed)
      add(beacon, 0, bh + 11.4, 0, s)
    }
    y += bh
  }
  // 广场
  paved(g, 0, 0, 44, 44, M.paving, 3.0, 'x')
  for (let i = 0; i < 6; i++) treeAt(g, -19 + i * 7.6, 18.5, 0.85, 3.0)
  for (let i = 0; i < 4; i++) carAt(g, -13 + i * 8.6, 22.0, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintYell][i])
  for (const [lx, lz] of [[-18, 14], [18, 14], [-18, -14], [18, -14]]) lampPost(g, lx, lz, 6.8, 0)
  return { g, top: totalH + 14 }
}

/** 112 卵形倾斜体（斜置椭球 + 玻璃鳞片） */
function t112(x, z) {
  const g = group(x, z, 0)
  const R = 18
  const tilt = new THREE.Group()
  tilt.rotation.z = -0.19
  tilt.position.y = 34
  g.add(tilt)
  // 椭球壳（顶底开口）
  const egg = new THREE.Mesh(
    new THREE.SphereGeometry(R, 56, 36, 0, Math.PI * 2, Math.PI * 0.12, Math.PI * 0.76),
    M.glChampagne,
  )
  egg.castShadow = egg.receiveShadow = true
  tilt.add(egg)
  tilt.scale.set(1, 1.5, 1)
  // 水平环带
  for (let i = 0; i <= 10; i++) {
    const phi = Math.PI * 0.12 + (i / 10) * Math.PI * 0.76
    const rr = R * Math.sin(phi)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.16, 5, 48), M.brightSilver)
    ring.rotation.x = Math.PI / 2
    ring.position.y = R * Math.cos(phi)
    tilt.add(ring)
  }
  // 竖肋
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    for (let k = 0; k < 10; k++) {
      const p0 = Math.PI * 0.12 + (k / 10) * Math.PI * 0.76
      const p1 = Math.PI * 0.12 + ((k + 1) / 10) * Math.PI * 0.76
      const m = beamBetween(tilt,
        Math.cos(a) * R * Math.sin(p0), R * Math.cos(p0), Math.sin(a) * R * Math.sin(p0),
        Math.cos(a) * R * Math.sin(p1), R * Math.cos(p1), Math.sin(a) * R * Math.sin(p1),
        0.14, M.aluDark, 0.11)
      m.castShadow = false
    }
  }
  // 顶部开口平台 + 内圈玻璃
  cyl(6.0, 6.0, 0.6, M.whiteStone, 0, R * Math.cos(Math.PI * 0.12) - 0.3, 0, 24, tilt)
  cyl(5.6, 5.6, 4.0, M.glDeepBlue, 0, R * Math.cos(Math.PI * 0.12) + 1.8, 0, 24, tilt, true)
  const rr2 = 5.8
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    box(0.1, 4.2, 0.1, M.brightSilver, Math.cos(a) * rr2, R * Math.cos(Math.PI * 0.12) + 1.9, Math.sin(a) * rr2, tilt)
  }
  // 倾斜撑（卵体与地面之间的斜柱）
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const m = beamBetween(g, sx * 13.5, 0, sz * 9.5, sx * 6.0, 22, sz * 5.0, 1.1, M.whiteStone, 1.1)
    m.castShadow = true
    box(2.2, 0.8, 2.2, M.tuff, sx * 13.5, 0.4, sz * 9.5, g)
  }
  // 裙房 + 大堂
  box(34, 9, 26, M.tuff, 0, 4.5, 0, g)
  box(35, 0.6, 27, M.whiteStone, 0, 9.3, 0, g)
  gridGlass(g, 0, 3.6, 13.1, 0, 26, 6.6, 10, 2, { glass: M.glSmoke, frame: M.aluDark })
  box(9.5, 4.8, 3.0, M.glWhite, 0, 2.4, 14.2, g)
  box(12, 0.45, 4.4, M.brightSilver, 0, 5.1, 15.2, g)
  // 广场
  paved(g, 0, 0, 44, 44, M.paving, 3.0, 'x')
  for (let i = 0; i < 6; i++) treeAt(g, -19 + i * 7.6, 19.5, 0.85, 3.0)
  for (let i = 0; i < 4; i++) carAt(g, -13 + i * 8.6, 21.5, 0, [M.glazeWhite, M.charcoal, M.paintBlue, M.aluPanel][i])
  for (const [lx, lz] of [[-19, 15], [19, 15], [-19, -15], [19, -15]]) lampPost(g, lx, lz, 6.8, 0)
  return { g, top: 68 }
}

/** 113 竹节三角塔（三角节段收分 + X 形斜撑） */
function t113(x, z) {
  const g = group(x, z, 0)
  const segH = 26
  const segs = 4
  // 裙房
  box(34, 9, 28, M.tuff, 0, 4.5, 0, g)
  box(35, 0.6, 29, M.whiteStone, 0, 9.3, 0, g)
  // 三角主体
  for (let s = 0; s < segs; s++) {
    const r = 16.5 - s * 2.5
    const y = 9 + s * segH
    const rot = Math.PI / 6
    const body = cyl(r, r + 0.5, segH, s % 2 ? M.glNavy : M.glDeepBlue, 0, y + segH / 2, 0, 3, g)
    body.rotation.y = rot
    body.castShadow = body.receiveShadow = true
    // 三条棱线
    for (let k = 0; k < 3; k++) {
      const a = rot + (k / 3) * Math.PI * 2 + Math.PI / 2
      box(0.5, segH, 0.5, M.aluPanel, Math.cos(a) * r, y + segH / 2, Math.sin(a) * r, g)
    }
    // 层带
    for (let k = 0; k < 4; k++) {
      cyl(r + 0.12, r + 0.12, 0.2, M.aluPanel, 0, y + 5.4 + k * 5.2, 0, 3, g).rotation.y = rot
    }
    // 三个面的 X 形斜撑
    for (let k = 0; k < 3; k++) {
      const a = rot + (k / 3) * Math.PI * 2
      const nx = Math.cos(a)
      const nz = Math.sin(a)
      const tx = -nz
      const tz = nx
      const half = r * 0.8
      const cx = nx * r * 0.5
      const cz = nz * r * 0.5
      for (const dir of [1, -1]) {
        const m = beamBetween(g,
          cx + tx * half * dir, y + 1.4, cz + tz * half * dir,
          cx - tx * half * dir, y + segH - 1.4, cz - tz * half * dir,
          0.3, M.aluPanel, 0.3)
        m.castShadow = false
      }
    }
    // 节段顶部倒锥收进
    const collar = new THREE.Mesh(new THREE.ConeGeometry(r * 1.14, 7.0, 3), M.aluPanel)
    collar.rotation.y = rot
    collar.castShadow = true
    add(collar, 0, y + segH + 3.0, 0, g)
    cyl(r * 1.16, r * 1.16, 0.2, M.whiteStone, 0, y + segH + 0.2, 0, 3, g).rotation.y = rot
  }
  // 顶冠 + 桅杆
  const ty = 9 + segs * segH
  const topR = 16.5 - (segs - 1) * 2.5
  const cap = new THREE.Mesh(new THREE.ConeGeometry(topR * 0.62, 12, 3), M.aluPanel)
  cap.rotation.y = Math.PI / 6
  cap.castShadow = true
  add(cap, 0, ty + 6, 0, g)
  cyl(0.2, 0.7, 14, M.brightSilver, 0, ty + 19, 0, 8, g)
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 - i * 0.2, 0.06, 4, 12), M.brightSilver)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, ty + 16 + i * 1.2, 0, g)
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.paintRed)
  add(beacon, 0, ty + 26.4, 0, g)
  // 入口 + 广场
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
    gridGlass(g, dx * 17.1, 3.6, dz * 14.1, ry, dx ? 26 : 30, 6.4, 8, 2, { glass: M.glSmoke, frame: M.aluDark })
  }
  box(10, 5.0, 3.2, M.glWhite, 0, 2.5, 15.4, g)
  box(13, 0.5, 4.6, M.brightSilver, 0, 5.3, 16.4, g)
  paved(g, 0, 0, 44, 44, M.paving, 3.0, 'x')
  for (let i = 0; i < 6; i++) treeAt(g, -19 + i * 7.6, 20.5, 0.85, 3.0)
  for (let i = 0; i < 4; i++) carAt(g, -13 + i * 8.6, 22.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed][i])
  for (const [lx, lz] of [[-19, 16], [19, 16], [-19, -16], [19, -16]]) lampPost(g, lx, lz, 6.8, 0)
  return { g, top: ty + 28 }
}

/** 114 双曲面塔（腰部内收的超大曲面） */
function t114(x, z) {
  const g = group(x, z, 0)
  const H = 92
  const yw = 44
  const rw = 11.5
  const c = 32
  const rAt = (y) => rw * Math.sqrt(1 + ((y - yw) / c) ** 2)
  const pts = []
  for (let i = 0; i <= 34; i++) {
    const y = (i / 34) * H
    pts.push(new THREE.Vector2(rAt(y), y))
  }
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), M.glBlueGreen)
  shell.castShadow = shell.receiveShadow = true
  add(shell, 0, 0, 0, g)
  // 水平环带
  for (let i = 1; i <= 10; i++) {
    const y = (i / 11) * H
    const rr = rAt(y) + 0.12
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.2, 6, 56), M.brightSilver)
    ring.rotation.x = Math.PI / 2
    add(ring, 0, y, 0, g)
  }
  // 竖肋
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    for (let k = 0; k < 16; k++) {
      const y0 = (k / 16) * H
      const y1 = ((k + 1) / 16) * H
      const ra = rAt(y0) + 0.07
      const rb = rAt(y1) + 0.07
      const m = beamBetween(g, Math.cos(a) * ra, y0, Math.sin(a) * ra,
        Math.cos(a) * rb, y1, Math.sin(a) * rb, 0.14, M.whiteStone, 0.12)
      m.castShadow = false
    }
  }
  // 顶部环梁 + 露天观景平台 + 内圈
  const tr = rAt(H)
  cyl(tr, tr, 1.6, M.whiteStone, 0, H + 0.8, 0, 56, g)
  cyl(tr - 1.2, tr - 1.2, 0.4, M.aluPanel, 0, H + 1.8, 0, 48, g)
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    box(0.14, 1.3, 0.14, M.brightSilver, Math.cos(a) * (tr - 0.6), H + 2.6, Math.sin(a) * (tr - 0.6), g)
  }
  cyl(tr - 0.6, tr - 0.6, 0.1, M.brightSilver, 0, H + 3.3, 0, 48, g)
  cyl(tr - 4.2, tr - 4.2, 4.2, M.glSmoke, 0, H + 3.6, 0, 40, g, true)
  cyl(tr - 4.0, tr - 4.0, 0.3, M.aluPanel, 0, H + 5.8, 0, 32, g)
  // 底部环柱廊 + 入口
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2
    cyl(0.42, 0.48, 7.0, M.whiteStone, Math.cos(a) * (rAt(0) + 1.4), 3.5, Math.sin(a) * (rAt(0) + 1.4), 10, g)
  }
  cyl(rAt(0) + 2.0, rAt(0) + 2.0, 0.8, M.whiteStone, 0, 7.4, 0, 48, g)
  cyl(rAt(0) + 1.2, rAt(0) + 1.2, 6.6, M.glSmoke, 0, 3.3, 0, 48, g, true)
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    box(0.2, 6.6, 0.2, M.brightSilver, Math.cos(a) * (rAt(0) + 1.3), 3.3, Math.sin(a) * (rAt(0) + 1.3), g)
  }
  // 广场
  paved(g, 0, 0, 44, 44, M.paving, 3.0, 'x')
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.25
    treeAt(g, Math.cos(a) * 20.2, Math.sin(a) * 20.2, 0.85, 3.0)
  }
  for (let i = 0; i < 4; i++) carAt(g, -13 + i * 8.6, 21.0, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintYell][i])
  for (const [lx, lz] of [[-19, 15], [19, 15], [-19, -15], [19, -15]]) lampPost(g, lx, lz, 6.8, 0)
  return { g, top: H + 8 }
}

/** 115 歌剧院（三片壳体帆顶 + 亲水平台） */
function t115(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 4, 44, 40, M.whiteStone, 3.0, 'x')
  // 基座 + 台阶
  box(34, 2.2, 24, M.limestone, 0, 1.1, -2, g)
  box(34.6, 0.3, 24.6, M.whiteStone, 0, 2.35, -2, g)
  for (let k = 0; k < 4; k++) box(20, 0.26, 1.2, M.whiteStone, 0, 0.65 - k * 0.26, 10.6 + k * 1.2, g)
  // 门厅玻璃体
  box(22, 7.6, 10, M.glSmoke, 0, 6.0, 3.0, g)
  for (let i = 0; i <= 8; i++) box(0.22, 7.6, 0.3, M.whiteStone, -11 + i * 2.75, 6.0, 8.06, g)
  box(22.6, 0.5, 10.6, M.whiteStone, 0, 10.1, 3.0, g)
  // 三片壳体（弧形帆）
  const sails = [[-9.5, 12, 11, 15, 22, -0.32], [1.5, 14, 9.5, 17, 26, 0.14], [11.5, 12.5, 8.5, 14, 20, 0.4]]
  for (const [sx, sz, rx, ry, rz, rot] of sails) {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.glazeWhite)
    shell.scale.set(rx, ry, rz)
    shell.rotation.y = rot
    shell.castShadow = shell.receiveShadow = true
    add(shell, sx, 2.2, sz - 6, g)
    // 壳体肋（沿径向）
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const m = beamBetween(g, sx + Math.cos(a) * rx * 0.96, 2.24, sz - 6 + Math.sin(a) * rz * 0.96,
        sx, 2.24 + ry * 0.98, sz - 6, 0.2, M.whiteStone, 0.2)
      m.castShadow = false
    }
    // 底边环梁
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rx, 0.22, 5, 40), M.whiteStone)
    ring.rotation.x = Math.PI / 2
    ring.scale.z = rz / rx
    add(ring, sx, 2.3, sz - 6, g)
  }
  // 侧翼排练厅（左）+ 后台（右）
  box(11, 9, 14, M.limestone, -20, 4.5, -8, g)
  box(11.6, 0.5, 14.6, M.whiteStone, -20, 9.2, -8, g)
  for (let i = 0; i < 3; i++) win(g, -20, 5.4, -1 + i * 4.4, 0, 2.4, 2.4, { glass: M.glTeal, frame: M.whiteStone, mull: 1 })
  box(22, 11, 15, M.tuff, 6, 5.5, -14, g)
  box(22.6, 0.6, 15.6, M.whiteStone, 6, 11.3, -14, g)
  // 广场：水景 + 旗杆 + 灯 + 车
  box(30, 0.3, 5.0, M.whiteStone, 0, 0.15, 15.5, g)
  box(29, 0.1, 4.0, M.glTeal, 0, 0.32, 15.5, g)
  for (let i = 0; i < 3; i++) {
    cyl(0.1, 0.14, 12, M.brightSilver, -16 + i * 2.6, 6, 19.4, 8, g)
    box(2.2, 1.4, 0.06, [M.paintRed, M.paintBlue, M.paintYell][i], -15.0 + i * 2.6, 11.0, 19.4, g)
  }
  for (let i = 0; i < 5; i++) treeAt(g, -20 + i * 10, 19.0, 0.9, 3.0)
  for (const [lx, lz] of [[-21, 12], [21, 12], [-21, -12], [21, -12]]) lampPost(g, lx, lz, 7.0, 0)
  for (let i = 0; i < 4; i++) carAt(g, -13 + i * 8.6, -19.5, Math.PI, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed][i])
  return { g, top: 32 }
}

/** 116 会展中心（大跨桁架展厅 + 入口通廊，跨 2 格） */
function t116(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 6, 94, 40, M.paving, 3.4, 'x')
  // 展厅（三跨，钢桁架 + 金属屋面）
  for (const [bx, bw] of [[-28, 30], [0, 30], [28, 30]]) {
    box(bw, 16, 26, M.aluPanel, bx, 8, -4, g)
    // 屋盖桁架
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const y0 = 16 + i * 2.2
        box(bw, 0.26, 0.26, M.aluDark, bx, y0, sz * 13, g)
      }
      for (let i = 0; i < 5; i++) {
        const px = bx - bw / 2 + (bw / 5) * (i + 0.5)
        const a = beamBetween(g, px - bw / 10, 16.6, sz * 13, px + bw / 10, 25.6, sz * 13, 0.22, M.aluDark, 0.22)
        const b = beamBetween(g, px + bw / 10, 16.6, sz * 13, px - bw / 10, 25.6, sz * 13, 0.22, M.aluDark, 0.22)
        a.castShadow = b.castShadow = false
      }
    }
    // 高侧窗
    for (const sz of [-1, 1]) {
      box(bw - 2, 2.6, 0.2, M.glIce, bx, 14.2, sz * 13.06, g)
      for (let i = 0; i <= 6; i++) box(0.14, 2.6, 0.28, M.aluDark, bx - bw / 2 + (bw / 6) * i, 14.2, sz * 13.1, g)
    }
    // 首层玻璃幕墙
    for (const sz of [-1, 1]) gridGlass(g, bx, 6.2, sz * 13.1, sz > 0 ? 0 : Math.PI, bw - 1.4, 11.6, 7, 3, { glass: M.glSmoke, frame: M.aluDark })
  }
  // 屋面板
  box(92, 0.5, 27, M.membrane, 0, 26.2, -4, g)
  box(92.6, 0.24, 27.6, M.aluPanel, 0, 25.8, -4, g)
  // 中央通廊（玻璃拱顶）
  for (let i = 0; i < 9; i++) {
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 9.4, 14, 1, true, 0, Math.PI), M.glWhite)
    arch.rotation.z = Math.PI / 2
    arch.position.set(-4 + i * 10, 18.6, 15.5)
    g.add(arch)
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI
      box(9.4, 0.16, 0.16, M.aluDark, -4 + i * 10, 18.6 + Math.sin(a) * 3.4, 15.5 + Math.cos(a) * 3.4, g)
    }
  }
  // 通廊楼板 + 柱
  box(92, 0.4, 7.6, M.whiteStone, 0, 15.4, 15.5, g)
  for (let i = 0; i < 10; i++) for (const sz of [-1, 1]) cyl(0.26, 0.3, 15.2, M.aluDark, -42 + i * 9.4, 7.6, 15.5 + sz * 3.4, 8, g)
  // 入口门斗 + 检票 + 标识
  box(18, 12, 5.4, M.glSmoke, 0, 6, 21.0, g)
  box(20, 0.5, 6.6, M.brightSilver, 0, 12.4, 21.4, g)
  for (let i = 0; i <= 6; i++) box(0.26, 12, 0.3, M.aluDark, -9 + i * 3, 6, 23.8, g)
  box(9, 1.6, 0.3, M.paintRed, 0, 14.2, 21.4, g)
  box(6.4, 0.3, 0.1, M.glazeWhite, 0, 14.2, 21.6, g)
  steps(g, 22, 3, 0.26, 1.2, 0, M.whiteStone, 24.2)
  // 停车 + 大巴 + 树列
  for (let i = 0; i < 6; i++) {
    carAt(g, -40 + i * 6.4, 18.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed, M.aluPanel, M.glTeal][i])
    box(2.6, 0.04, 5.0, M.glazeWhite, -40 + i * 6.4, 0.06, 18.5, g)
  }
  for (const bx of [-30, -18, 18, 30]) {
    box(11, 3.0, 2.8, M.glazeWhite, bx, 1.8, 26.5, g)
    box(11, 0.9, 2.8, M.paintBlue, bx, 0.55, 26.5, g)
    for (const sx of [-3.6, 3.6]) for (const sz of [-1.2, 1.2]) cyl(0.46, 0.46, 0.4, M.charcoal, bx + sx, 0.5, 26.5 + sz, 10, g)
  }
  for (let i = 0; i < 11; i++) treeAt(g, -44 + i * 8.8, 30.5, 0.85, 3.0)
  for (let i = 0; i < 8; i++) lampPost(g, -42 + i * 12, 34.5, 8.0, 0)
  return { g, top: 30 }
}

/** 117 当代美术馆（错位悬挑白盒 + 玻璃基座） */
function t117(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 2, 42, 40, M.paving, 2.8, 'x')
  // 玻璃基座
  box(30, 7.0, 22, M.glSmoke, 0, 3.5, -2, g)
  for (const sz of [-1, 1]) {
    box(30.8, 0.4, 0.4, M.whiteStone, 0, 7.2, sz * 11.2 - 2, g)
    for (let i = 0; i <= 7; i++) box(0.16, 7.0, 0.24, M.whiteStone, -15 + i * 4.3, 3.5, sz * 11.15 - 2, g)
  }
  for (const sx of [-1, 1]) for (let i = 0; i <= 4; i++) box(0.24, 7.0, 0.16, M.whiteStone, sx * 15.05, 3.5, -13 + i * 5.6, g)
  // 首层入口 + 台阶
  box(9, 4.4, 2.6, M.glWhite, 0, 2.2, 10.0, g)
  box(11, 0.4, 3.8, M.brightSilver, 0, 4.6, 10.6, g)
  steps(g, 12, 3, 0.22, 0.9, 0, M.whiteStone, 11.8)
  // 三个错位白盒
  const boxesArr = [
    [-6.5, 9.5, 15, 8.0, 11, 0.05],
    [4.0, 15.5, 18, 7.2, 13, -0.07],
    [-2.0, 23.0, 13, 6.4, 10, 0.1],
  ]
  for (const [bx, by, bw, bh, bd, rot] of boxesArr) {
    const s = new THREE.Group()
    s.position.set(bx, by, -2)
    s.rotation.y = rot
    g.add(s)
    box(bw, bh, bd, M.glazeWhite, 0, bh / 2, 0, s)
    // 带形高窗（四角内收）
    for (let k = 0; k < 2; k++) {
      box(bw - 1.2, 1.5, 0.16, M.glDeepBlue, 0, bh * 0.36 + k * 2.4, bd / 2 + 0.04, s)
      box(bw - 1.2, 1.5, 0.16, M.glDeepBlue, 0, bh * 0.36 + k * 2.4, -bd / 2 - 0.04, s)
    }
    // 顶部灯槽
    box(bw + 0.3, 0.24, bd + 0.3, M.whiteStone, 0, bh + 0.12, 0, s)
    box(bw * 0.5, 0.16, bd + 0.36, M.glazeWhite, 0, bh - 0.2, 0, s)
  }
  // 室外雕塑 + 水景
  const sph = new THREE.Mesh(new THREE.SphereGeometry(1.9, 20, 14), M.bronze)
  add(sph, -12, 1.9, 12.5, g)
  cyl(3.0, 3.2, 0.4, M.whiteStone, -12, 0.2, 12.5, 20, g)
  box(12, 0.24, 4.4, M.whiteStone, 12, 0.12, 13.0, g)
  box(11, 0.1, 3.4, M.glTeal, 12, 0.26, 13.0, g)
  // 广场
  for (let i = 0; i < 5; i++) treeAt(g, -18 + i * 9, 18.5, 0.9, 3.2)
  for (const [lx, lz] of [[-19, 6], [19, 6], [-19, -10], [19, -10]]) lampPost(g, lx, lz, 6.8, 0)
  for (let i = 0; i < 4; i++) carAt(g, -13 + i * 8.6, -17.5, Math.PI, [M.charcoal, M.glazeWhite, M.paintBlue, M.aluPanel][i])
  return { g, top: 34 }
}

/** 118 高层公寓塔（40 层叠落阳台 + 空中花园） */
function t118(x, z) {
  const g = group(x, z, 0)
  const fh = 3.1
  const floors = 40
  const H = floors * fh
  // 裙房 + 入口
  box(26, 8, 20, M.tuff, 0, 4, 0, g)
  box(27, 0.6, 21, M.whiteStone, 0, 8.3, 0, g)
  gridGlass(g, 0, 3.2, 10.1, 0, 22, 6.0, 8, 2, { glass: M.glSmoke, frame: M.aluDark })
  box(8.5, 4.4, 3.0, M.glWhite, 0, 2.2, 11.4, g)
  box(11, 0.4, 4.4, M.brightSilver, 0, 4.6, 12.2, g)
  // 塔身（错落体块，三段）
  const towerX = 0
  box(16, H, 15, M.plasterWarm, towerX, 8 + H / 2, 0, g)
  for (let f = 0; f < floors; f++) {
    const y = 8 + f * fh
    // 南北向阳台（每层错位）
    const out = f % 2 === 0 ? 1.6 : 1.9
    for (const sz of [-1, 1]) {
      box(14.5, 0.24, out, M.whiteStone, towerX, y + 0.2, sz * (7.5 + out / 2), g)
      box(14.5, 0.85, 0.14, M.glWhite, towerX, y + 0.72, sz * (7.5 + out), g)
      box(14.9, 0.1, 0.24, M.brightSilver, towerX, y + 1.16, sz * (7.5 + out), g)
      // 阳台门 + 窗
      win(g, towerX, y + 1.5, sz * 7.55, sz > 0 ? 0 : Math.PI, 4.2, 2.3, { glass: M.glSmoke, frame: M.aluPanel, mull: 2 })
      for (const sx of [-1, 1]) win(g, towerX + sx * 5.0, y + 1.5, sz * 7.55, sz > 0 ? 0 : Math.PI, 2.0, 1.9, { glass: M.glSmoke, frame: M.aluPanel })
      // 花池 + 空调
      box(4.6, 0.5, 0.6, M.tuff, towerX, y + 0.55, sz * (7.5 + out - 0.3), g)
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 9, 7), M.leaf)
      bush.scale.set(3.1, 0.6, 0.5)
      add(bush, towerX, y + 0.95, sz * (7.5 + out - 0.3), g)
      if (f % 3 === 0) acUnit(g, towerX + 6.4, y + 0.9, sz * (7.5 + out - 0.2), sz > 0 ? 0 : Math.PI)
    }
    // 东西山墙窗
    for (const sx of [-1, 1]) {
      box(0.14, 1.6, 9.6, M.glSmoke, sx * 8.05, y + 1.7, 0, g)
      for (let i = 0; i < 3; i++) box(0.2, 1.6, 0.1, M.aluPanel, sx * 8.1, y + 1.7, -3.2 + i * 3.2, g)
    }
    // 层间腰线
    if (f % 5 === 4) box(16.6, 0.3, 15.6, M.whiteStone, towerX, y + fh, 0, g)
  }
  // 空中花园（20 层、32 层挑台）
  for (const lf of [20, 32]) {
    const y = 8 + lf * fh
    box(24, 0.5, 8, M.whiteStone, towerX, y, 9.5, g)
    railing(g, 23, y + 0.25, 13.4, M.brightSilver, 12, 1.1)
    for (let i = 0; i < 4; i++) treeAt(g, towerX - 9 + i * 6, 11.0, 0.6, 2.0)
    for (let i = 0; i < 3; i++) benchAt(g, towerX - 6 + i * 6, 12.4, Math.PI)
  }
  // 顶冠 + 设备层
  box(17, 2.4, 16, M.aluPanel, towerX, 8 + H + 1.2, 0, g)
  box(12, 3.0, 11, M.glSmoke, towerX, 8 + H + 4.0, 0, g)
  cyl(0.26, 0.8, 10, M.brightSilver, towerX, 8 + H + 10.5, 0, 8, g)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.paintRed)
  add(beacon, towerX, 8 + H + 16.2, 0, g)
  // 屋顶水箱 + 光伏
  cyl(2.2, 2.2, 2.6, M.brightSilver, 6, 8 + H + 2.3, -5, 16, g)
  for (let i = 0; i < 4; i++) box(3.4, 0.16, 2.2, M.glDeepBlue, -6 + i * 3.8, 8 + H + 1.4, -6.4, g)
  // 场地
  paved(g, 0, 0, 42, 40, M.paving, 2.8, 'x')
  for (let i = 0; i < 5; i++) carAt(g, -16 + i * 7.6, 16.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed, M.aluPanel][i])
  for (let i = 0; i < 4; i++) treeAt(g, -17 + i * 11.4, 20.5, 0.95, 3.4)
  for (const [lx, lz] of [[-17, 13], [17, 13], [-17, -13], [17, -13]]) lampPost(g, lx, lz, 6.8, 0)
  benchAt(g, 10, 18.6, 0)
  benchAt(g, 14, 18.6, 0)
  return { g, top: 8 + H + 18 }
}

/** 119 庭院式办公园（四栋围合 + 中庭水院） */
function t119(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 44, M.paving, 3.0, 'x')
  const fh = 3.8
  const floors = 6
  const H = floors * fh
  const blocks = [[0, -13, 30, 9, 0], [0, 13, 30, 9, 0], [-15, 0, 9, 17, 0], [15, 0, 9, 17, 0]]
  for (const [bx, bz, bw, bd, rot] of blocks) {
    box(bw, H, bd, M.limestone, bx, H / 2, bz, g)
    box(bw + 0.6, 0.5, bd + 0.6, M.whiteStone, bx, H + 0.25, bz, g)
    box(bw + 0.8, 1.1, bd + 0.8, M.tuff, bx, 0.55, bz, g)
    // 外立面横向窗带（朝外一侧）
    const long = bw > bd
    for (let f = 0; f < floors; f++) {
      const y = f * fh + 2.1
      for (const dir of [-1, 1]) {
        if (long) {
          const sz = bz === 0 ? dir : (bz > 0 ? dir : dir)
          gridGlass(g, bx, y, bz + dir * (bd / 2 + 0.06), dir > 0 ? 0 : Math.PI, bw - 4, 2.2, 8, 1, { glass: M.glTeal, frame: M.aluDark })
        } else {
          gridGlass(g, bx + dir * (bw / 2 + 0.06), y, bz, dir > 0 ? Math.PI / 2 : -Math.PI / 2, bd - 4, 2.2, 5, 1, { glass: M.glTeal, frame: M.aluDark })
        }
      }
    }
    // 内院柱廊
    const inX = bx > 0 ? bx - bw / 2 - 1.8 : bx < 0 ? bx + bw / 2 + 1.8 : bx
    const inZ = bz > 0 ? bz - bd / 2 - 1.8 : bz < 0 ? bz + bd / 2 + 1.8 : bz
    if (long) {
      box(bw - 2, 0.3, 3.6, M.whiteStone, bx, H * 0.62, inZ, g)
      for (let i = 0; i < 6; i++) cyl(0.22, 0.26, H * 0.6, M.whiteStone, bx - bw / 2 + 2.6 + i * ((bw - 5.2) / 5), H * 0.3, inZ, 8, g)
    } else {
      box(3.6, 0.3, bd - 2, M.whiteStone, inX, H * 0.62, bz, g)
      for (let i = 0; i < 4; i++) cyl(0.22, 0.26, H * 0.6, M.whiteStone, inX, H * 0.3, bz - bd / 2 + 2.6 + i * ((bd - 5.2) / 3), 8, g)
    }
  }
  // 中庭水院 + 步道 + 树
  box(22, 0.3, 13, M.whiteStone, 0, 0.15, 0, g)
  box(20, 0.1, 11, M.glTeal, 0, 0.32, 0, g)
  for (let i = 0; i < 4; i++) box(22, 0.14, 0.14, M.brightSilver, 0, 0.42, -4.5 + i * 3, g)
  for (let i = 0; i < 3; i++) {
    box(1.4, 0.2, 12.6, M.whiteStone, -7 + i * 7, 0.46, 0, g)
    treeAt(g, -7 + i * 7, 5.4, 0.7, 2.4)
  }
  // 南入口门厅
  box(12, 5.4, 4.0, M.glWhite, 0, 2.7, 21.5, g)
  box(14, 0.5, 5.4, M.brightSilver, 0, 5.6, 22.2, g)
  box(6, 3.6, 0.2, M.glSmoke, 0, 1.8, 23.6, g)
  box(4.6, 0.9, 0.2, M.paintBlue, 0, 6.3, 21.6, g)
  // 场地
  for (let i = 0; i < 4; i++) carAt(g, -14 + i * 8.6, 25.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed][i])
  for (let i = 0; i < 5; i++) treeAt(g, -20 + i * 10, 25.5, 0.85, 3.0)
  lampPost(g, -19, 20, 6.6, 0)
  lampPost(g, 19, 20, 6.6, 0)
  return { g, top: H + 2 }
}

/** 120 邮政大楼（石材立面 + 钟塔 + 骑楼入口） */
function t120(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 4, 40, 34, M.paving, 2.8, 'x')
  const H = 20
  // 主体
  box(30, H, 18, M.limestone, 0, H / 2, -4, g)
  box(31, 1.6, 19, M.tuff, 0, 0.8, -4, g)
  box(31.4, 1.0, 19.4, M.whiteStone, 0, H + 0.5, -4, g)
  box(31.8, 0.34, 19.8, M.whiteStone, 0, H + 1.16, -4, g)
  // 竖向壁柱 + 窗
  for (let f = 0; f < 4; f++) {
    for (let i = 0; i < 6; i++) {
      const px = -12.5 + i * 5.0
      win(g, px, 4.4 + f * 4.4, 5.06, 0, 2.6, 2.8, { glass: M.glAmber, frame: M.whiteStone, mull: 2, sill: true })
    }
    for (let i = 0; i <= 6; i++) {
      box(0.9, 4.2, 0.5, M.limestone, -15 + i * 5.0, 4.4 + f * 4.4, 5.1, g)
    }
  }
  // 侧立面
  for (let f = 0; f < 4; f++) for (let i = 0; i < 3; i++) {
    win(g, 15.06, 4.4 + f * 4.4, -10 + i * 6.0, Math.PI / 2, 2.4, 2.8, { glass: M.glAmber, frame: M.whiteStone, mull: 1 })
    win(g, -15.06, 4.4 + f * 4.4, -10 + i * 6.0, -Math.PI / 2, 2.4, 2.8, { glass: M.glAmber, frame: M.whiteStone, mull: 1 })
  }
  // 骑楼柱廊入口
  colonnade(g, 18, 0, 7.6, M.whiteStone, 9.6, 6, 0.62)
  box(18, 8.4, 0.8, M.limestone, 0, 4.2, 6.2, g)
  box(20, 0.9, 2.4, M.whiteStone, 0, 8.6, 7.4, g)
  box(5.0, 5.6, 0.3, M.teak, 0, 3.0, 6.66, g)
  for (const sx of [-1, 1]) box(1.6, 2.4, 0.32, M.glAmber, sx * 6.4, 3.0, 6.66, g)
  steps(g, 14, 3, 0.24, 1.0, 0, M.whiteStone, 10.2)
  // 钟塔
  box(7.4, 34, 7.4, M.limestone, 9, 17, -4, g)
  box(8.2, 0.7, 8.2, M.whiteStone, 9, 33.6, -4, g)
  box(8.6, 0.4, 8.6, M.whiteStone, 9, 34.6, -4, g)
  const clk = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20), M.glazeWhite)
  add(clk, 9, 30.0, -0.24, g)
  const clkRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 6, 20), M.copperAged)
  add(clkRing, 9, 30.0, -0.22, g)
  box(0.12, 0.8, 0.08, M.charcoal, 9, 30.2, -0.14, g)
  box(0.6, 0.1, 0.08, M.charcoal, 9.3, 30.0, -0.14, g)
  for (const oy of [22, 25.5]) {
    archPanel(1.1, 2.2, 0.16, M.glAmber, 9, oy, -0.2, g, Math.PI)
    archPanel(1.1, 2.2, 0.16, M.glAmber, 9, oy, -7.8, g)
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(5.0, 8.0, 4), M.copperAged)
  cap.rotation.y = Math.PI / 4
  cap.castShadow = true
  add(cap, 9, 38.8, -4, g)
  cyl(0.1, 0.26, 3.2, M.gold, 9, 44.4, -4, 8, g)
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), M.gold)
  add(orb, 9, 46.3, -4, g)
  // 广场：邮筒、报亭、树、车
  cyl(0.5, 0.5, 1.3, M.paintRed, -9.5, 0.65, 11.4, 12, g)
  cyl(0.56, 0.56, 0.12, M.paintRed, -9.5, 1.36, 11.4, 12, g)
  box(2.2, 0.1, 0.14, M.charcoal, -9.5, 0.95, 11.9, g)
  box(3.0, 2.4, 2.0, M.paintBlue, 11.5, 1.2, 12.5, g)
  box(3.4, 0.3, 2.4, M.whiteStone, 11.5, 2.55, 12.5, g)
  box(3.2, 1.0, 0.14, M.glazeWhite, 11.5, 1.9, 12.5, g)
  for (let i = 0; i < 4; i++) treeAt(g, -17 + i * 11, 13.5, 0.9, 3.2)
  for (const [lx, lz] of [[-16, 9], [16, 9]]) lampPost(g, lx, lz, 6.6, 0)
  for (let i = 0; i < 4; i++) carAt(g, -13 + i * 8.6, 16.5, Math.PI, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintYell][i])
  return { g, top: 48 }
}
/** 121 农贸市场（钢桁架大厅 + 摊位 + 冷链车） */
function t121(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 42, M.concrete, 2.8, 'x')
  // 大厅：柱 + 大跨桁架 + 金属屋面
  const W = 30
  const D = 20
  box(W, 7.0, D, M.plasterGrey, 0, 3.5, -3, g)
  for (const sz of [-1, 1]) {
    box(W, 3.0, 0.2, M.glTeal, 0, 5.6, sz * (D / 2 + 0.02) - 3, g)
    for (let i = 0; i <= 8; i++) box(0.12, 3.0, 0.28, M.aluDark, -W / 2 + (W / 8) * i, 5.6, sz * (D / 2 + 0.06) - 3, g)
  }
  // 桁架
  for (let i = 0; i <= 6; i++) {
    const px = -W / 2 + (W / 6) * i
    for (const sz of [-1, 1]) {
      cyl(0.18, 0.22, 11.0, M.aluPanel, px, 7.0 + 5.5, sz * (D / 2), 8, g)
      if (i < 6) {
        const a = beamBetween(g, px, 8.2, sz * D / 2, px + W / 6, 12.2, sz * D / 2, 0.16, M.aluPanel, 0.16)
        const b = beamBetween(g, px, 12.2, sz * D / 2, px + W / 6, 8.2, sz * D / 2, 0.16, M.aluPanel, 0.16)
        a.castShadow = b.castShadow = false
      }
    }
  }
  box(W + 2.4, 0.6, D + 2.4, M.aluPanel, 0, 12.9, -3, g)
  box(W + 2.6, 0.2, D + 2.6, M.membrane, 0, 13.3, -3, g)
  // 卷帘门与入口
  box(9.0, 4.6, 0.24, M.glSmoke, 0, 2.3, 7.1, g)
  for (let k = 0; k < 6; k++) box(8.8, 0.14, 0.3, M.aluPanel, 0, 0.4 + k * 0.75, 7.2, g)
  box(11, 0.5, 2.6, M.brightSilver, 0, 5.0, 8.0, g)
  box(20, 1.2, 0.3, M.paintBlue, 0, 8.0, 7.1, g)
  box(16, 0.26, 0.1, M.glazeWhite, 0, 8.0, 7.24, g)
  // 摊位（双排，遮阳棚 + 台面 + 货箱）
  for (let i = 0; i < 4; i++) {
    for (const sz of [-1, 1]) {
      const pz = sz * 4.0 - 3
      box(5.2, 0.9, 2.0, M.tuff, -9 + i * 6.2, 0.45, pz, g)
      box(5.4, 0.12, 2.2, M.whiteStone, -9 + i * 6.2, 0.96, pz, g)
      box(5.4, 0.16, 2.4, [M.paintRed, M.paintYell, M.paintBlue, M.glTeal][(i + (sz > 0 ? 1 : 0)) % 4], -9 + i * 6.2, 3.1, pz, g)
      for (const sx of [-1, 1]) cyl(0.08, 0.1, 3.1, M.aluPanel, -9 + i * 6.2 + sx * 2.5, 1.55, pz + sz * 1.1, 6, g)
      for (let k = 0; k < 4; k++) box(0.8, 0.4, 0.7, [M.terra, M.leaf, M.paintYell, M.glazeWhite][k % 4], -10.6 + i * 6.2 + k * 1.0, 1.2, pz, g)
    }
  }
  // 冷链车 + 手推车 + 垃圾桶
  box(8.0, 2.6, 2.6, M.glazeWhite, 13, 1.5, 12.0, g)
  box(2.2, 2.0, 2.5, M.paintBlue, 17.4, 1.2, 12.0, g)
  for (const sx of [-2.8, 2.8]) for (const sz of [-1.1, 1.1]) cyl(0.44, 0.44, 0.36, M.charcoal, 13 + sx, 0.46, 12.0 + sz, 10, g)
  for (let i = 0; i < 3; i++) {
    box(1.0, 0.7, 1.4, M.aluPanel, -16 + i * 3.4, 0.55, 11.4, g)
    for (const sx of [-1, 1]) cyl(0.2, 0.2, 0.12, M.charcoal, -16 + i * 3.4 + sx * 0.5, 0.2, 11.4, 8, g)
  }
  for (const [bx, bz] of [[-15, 3], [15, 3], [-15, -10], [15, -10]]) {
    cyl(0.5, 0.44, 1.0, M.paintBlue, bx, 0.5, bz, 12, g)
  }
  // 广场与树
  for (let i = 0; i < 6; i++) treeAt(g, -18 + i * 7.2, 19.5, 0.9, 3.0)
  for (let i = 0; i < 4; i++) carAt(g, -12 + i * 8.4, 18.8, 0, [M.glazeWhite, M.paintBlue, M.charcoal, M.paintRed][i])
  for (const [lx, lz] of [[-19, 8], [19, 8], [-19, -14], [19, -14]]) lampPost(g, lx, lz, 6.6, 0)
  return { g, top: 14 }
}

/** 122 商业步行街（两排店铺 + 遮阳连廊，跨 2 格） */
function t122(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 90, 34, M.paving, 2.4, 'x')
  // 中央步道铺装分格
  box(90, 0.12, 9.0, M.whiteStone, 0, 0.1, 0, g)
  for (let i = 0; i < 18; i++) box(0.14, 0.14, 9.0, M.tuff, -44 + i * 5.2, 0.18, 0, g)
  // 两排店铺（三层，每间不同色彩与材质）
  const tones = [M.plasterWarm, M.brick, M.plasterGrey, M.limestone, M.tuff, M.plasterWarm, M.terra]
  const awn = [M.paintRed, M.paintBlue, M.paintYell, M.glTeal, M.paintRed, M.paintYell, M.paintBlue]
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const bx = -36 + i * 12
      const bz = sz * 12.6
      const h = 12.0 + (i % 3) * 1.2
      box(11.0, h, 10.0, tones[i % tones.length], bx, h / 2, bz, g)
      box(11.4, 0.5, 10.4, M.whiteStone, bx, h + 0.25, bz, g)
      box(11.6, 0.9, 10.6, M.tuff, bx, 0.45, bz, g)
      // 首层橱窗（朝向步道）
      const fz = bz - sz * 5.06
      box(9.6, 3.4, 0.2, M.glSmoke, bx, 2.3, fz, g)
      for (let k = 0; k <= 4; k++) box(0.14, 3.4, 0.3, M.aluDark, bx - 4.8 + k * 2.4, 2.3, fz - sz * 0.06, g)
      box(9.8, 0.3, 0.34, M.aluDark, bx, 4.1, fz - sz * 0.1, g)
      // 店招 + 雨棚
      box(9.0, 1.1, 0.24, awn[i % awn.length], bx, 4.9, fz - sz * 0.16, g)
      box(6.4, 0.22, 0.1, M.glazeWhite, bx, 4.9, fz - sz * 0.3, g)
      const aw = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.16, 2.6), awn[(i + 2) % awn.length])
      aw.position.set(bx, 4.4, fz - sz * 1.4)
      aw.rotation.x = sz * 0.16
      aw.castShadow = true
      g.add(aw)
      for (const sx of [-1, 1]) cyl(0.07, 0.07, 4.3, M.aluDark, bx + sx * 4.8, 2.15, fz - sz * 2.6, 6, g)
      // 二三层窗 + 空调
      for (let f = 1; f < 3; f++) {
        for (let k = 0; k < 3; k++) {
          win(g, bx - 3.4 + k * 3.4, 4.9 + f * 2.6, fz, sz > 0 ? Math.PI : 0, 1.9, 1.6, { glass: M.glTeal, frame: M.aluPanel, sill: true })
        }
        if (i % 2 === 0) acUnit(g, bx + 4.2, 3.9 + f * 2.6, fz - sz * 0.3, sz > 0 ? Math.PI : 0)
      }
      // 屋顶设备 / 女儿墙
      parapet(g, 11.0, 10.0, h, M.whiteStone, 0.7, 0.26)
      if (i % 3 === 1) box(3.0, 1.2, 2.2, M.aluPanel, bx - 2, h + 0.8, bz, g)
      // 楼间缝
      if (i < 6) box(0.4, h, 0.3, M.aluDark, bx + 5.6, h / 2, fz + sz * 0.2, g)
    }
  }
  // 步道设施：树池、长椅、灯、花箱、雕塑
  for (let i = 0; i < 9; i++) {
    const px = -40 + i * 10
    box(2.6, 0.4, 2.6, M.whiteStone, px, 0.2, 0, g)
    treeAt(g, px, 0, 0.85, 3.0)
    if (i < 8) {
      benchAt(g, px + 5.0, 3.2, Math.PI)
      benchAt(g, px + 5.0, -3.2, 0)
    }
  }
  for (let i = 0; i < 10; i++) {
    for (const sz of [-1, 1]) lampPost(g, -40 + i * 9, sz * 5.6, 5.4, 0)
  }
  for (const px of [-26, 0, 26]) {
    box(1.2, 0.6, 1.2, M.whiteStone, px, 0.3, 0, g)
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), M.bronze)
    add(sc, px, 1.5, 0, g)
  }
  for (const px of [-46, 46]) {
    box(3.0, 4.2, 2.4, M.plasterGrey, px, 2.1, 8.0, g)
    box(3.4, 0.3, 2.8, M.whiteStone, px, 4.35, 8.0, g)
  }
  return { g, top: 15 }
}

/** 123 五星酒店（裙房 + 塔楼 + 屋顶泳池） */
function t123(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 2, 42, 40, M.paving, 2.8, 'x')
  // 裙房
  box(32, 10, 26, M.limestone, 0, 5, -2, g)
  box(33, 0.7, 27, M.whiteStone, 0, 10.3, -2, g)
  box(33.6, 1.2, 27.6, M.tuff, 0, 0.6, -2, g)
  for (const sz of [-1, 1]) gridGlass(g, 0, 4.0, sz * 13.1 - 2, sz > 0 ? 0 : Math.PI, 28, 7.0, 9, 2, { glass: M.glAmber, frame: M.gold })
  // 门廊（雨棚 + 圆柱 + 车道）
  box(16, 6.4, 5.0, M.glWhite, 0, 3.2, 14.0, g)
  box(19, 0.6, 7.2, M.whiteStone, 0, 6.7, 15.4, g)
  for (let i = 0; i < 5; i++) cyl(0.42, 0.46, 6.4, M.whiteStone, -8 + i * 4.0, 3.2, 17.2, 12, g)
  box(7.0, 4.4, 0.24, M.glSmoke, 0, 2.2, 16.4, g)
  for (let i = 0; i <= 4; i++) box(0.18, 4.4, 0.3, M.gold, -3.4 + i * 1.7, 2.2, 16.52, g)
  steps(g, 12, 3, 0.24, 1.0, 0, M.whiteStone, 18.4)
  // 塔楼（22 层）
  const fh = 3.5
  const floors = 22
  const ty = 10
  const H = floors * fh
  box(19, H, 15, M.glChampagne, 0, ty + H / 2, -6, g)
  for (let f = 0; f < floors; f++) {
    const y = ty + f * fh
    // 每层通长阳台 + 玻璃栏板
    for (const sz of [-1, 1]) {
      box(18.0, 0.22, 1.5, M.whiteStone, 0, y + 0.2, -6 + sz * 8.2, g)
      box(18.0, 0.85, 0.1, M.glWhite, 0, y + 0.72, -6 + sz * 8.9, g)
      box(18.2, 0.1, 0.2, M.gold, 0, y + 1.16, -6 + sz * 8.9, g)
      win(g, 0, y + 1.6, -6 + sz * 7.58, sz > 0 ? 0 : Math.PI, 12.0, 2.2, { glass: M.glSmoke, frame: M.gold, mull: 4 })
    }
    // 山墙竖向窗
    for (const sx of [-1, 1]) box(0.14, 2.0, 9.0, M.glSmoke, sx * 9.56, y + 1.7, -6, g)
    if (f % 4 === 3) box(19.6, 0.3, 15.6, M.gold, 0, y + fh, -6, g)
  }
  // 屋顶泳池 + 空中酒吧 + 塔冠
  const ry = ty + H
  box(20, 0.6, 16, M.whiteStone, 0, ry + 0.3, -6, g)
  box(11, 0.9, 7.0, M.whiteStone, -3, ry + 0.75, -3, g)
  box(10, 0.2, 6.0, M.glTeal, -3, ry + 1.25, -3, g)
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) lounger(g, -7 + i * 3.2, -1 + (sx > 0 ? 1.4 : 0), 0)
  box(6.0, 3.4, 5.0, M.glSmoke, 7, ry + 2.0, -8, g)
  box(6.6, 0.4, 5.6, M.gold, 7, ry + 3.9, -8, g)
  box(4.0, 1.0, 0.2, M.glazeWhite, 7, ry + 3.0, -5.4, g)
  for (let i = 0; i < 3; i++) {
    cyl(0.06, 0.06, 2.6, M.brightSilver, 1 + i * 3.0, ry + 1.6, -8, 6, g)
    cone(1.7, 0.5, M.glazeWhite, 1 + i * 3.0, ry + 3.0, -8, 10, g)
  }
  cyl(0.24, 0.7, 9, M.gold, 0, ry + 9.6, -6, 8, g)
  // 场地：代客泊车、旗杆、绿篱、水景
  for (let i = 0; i < 5; i++) carAt(g, -16 + i * 8.0, 22.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.aluPanel, M.paintRed][i])
  for (let i = 0; i < 3; i++) {
    cyl(0.1, 0.13, 11, M.brightSilver, -15 + i * 2.6, 5.5, 25.4, 8, g)
    box(2.0, 1.3, 0.06, [M.paintRed, M.paintBlue, M.paintYell][i], -14.1 + i * 2.6, 10.0, 25.4, g)
  }
  for (const sx of [-1, 1]) hedge(g, sx * 19, 18, 12, false, 0.9, 1.0)
  for (let i = 0; i < 4; i++) treeAt(g, -18 + i * 12, 19.5, 0.95, 3.4)
  for (const [lx, lz] of [[-19, 12], [19, 12]]) lampPost(g, lx, lz, 6.8, 0)
  return { g, top: ry + 12 }
}

/** 124 养老院（低层院落 + 无障碍坡道 + 疗养花园） */
function t124(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 42, M.paving, 2.8, 'x')
  const fh = 3.4
  const floors = 3
  const H = floors * fh
  // 三栋围合（U 形）
  const wings = [[0, -12, 32, 9], [-13, 2, 9, 20], [13, 2, 9, 20]]
  for (const [bx, bz, bw, bd] of wings) {
    box(bw, H, bd, M.plasterWarm, bx, H / 2, bz, g)
    box(bw + 0.5, 0.45, bd + 0.5, M.whiteStone, bx, H + 0.22, bz, g)
    box(bw + 0.7, 0.9, bd + 0.7, M.tuff, bx, 0.45, bz, g)
    // 连续外廊（朝内院一侧）+ 栏板
    const long = bw > bd
    const inX = bx > 0 ? bx - bw / 2 - 1.6 : bx < 0 ? bx + bw / 2 + 1.6 : bx
    const inZ = bz > 0 ? bz - bd / 2 - 1.6 : bz < 0 ? bz + bd / 2 + 1.6 : bz
    for (let f = 0; f < floors; f++) {
      const y = f * fh
      if (long) {
        box(bw - 1, 0.2, 3.0, M.concrete, bx, y + 0.1, inZ, g)
        railing(g, bw - 1, y + 0.2, inZ - (inZ > bz ? 0 : 0) + (inZ > bz ? -1.4 : 1.4), M.brightSilver, 14, 1.0)
        for (let i = 0; i < 8; i++) {
          win(g, bx - bw / 2 + 2 + i * ((bw - 4) / 7), y + 1.9, inZ + (inZ > bz ? 1.3 : -1.3), 0, 1.6, 2.0, { glass: M.glTeal, frame: M.aluPanel })
        }
      } else {
        box(3.0, 0.2, bd - 1, M.concrete, inX, y + 0.1, bz, g)
        railing(g, bd - 1, y + 0.2, bz, M.brightSilver, 10, 1.0)
        for (let i = 0; i < 5; i++) {
          win(g, inX + (inX > bx ? -1.3 : 1.3), y + 1.9, bz - bd / 2 + 2.4 + i * ((bd - 4.8) / 4), Math.PI / 2, 1.6, 2.0, { glass: M.glTeal, frame: M.aluPanel })
        }
      }
    }
  }
  // 入口门厅 + 无障碍坡道
  box(12, 6.2, 4.0, M.glWhite, 0, 3.1, 14.0, g)
  box(14, 0.5, 5.4, M.brightSilver, 0, 6.4, 14.8, g)
  box(5.0, 3.8, 0.2, M.glSmoke, 0, 1.9, 16.1, g)
  box(4.0, 0.9, 0.2, M.paintRed, 0, 7.0, 14.2, g)
  for (let i = 0; i < 7; i++) {
    box(6.0, 0.2, 1.2, M.whiteStone, 8.4, 0.6 - i * 0.12, 15.6 + i * 1.1, g)
    railing(g, 6.0, 0.9 - i * 0.12, 16.1 + i * 1.1, M.brightSilver, 5, 0.9)
  }
  // 内院花园：步道 + 花池 + 廊架 + 座椅
  box(18, 0.1, 12, M.paving, 0, 0.06, 3, g)
  for (const sx of [-1, 1]) {
    box(3.4, 0.5, 10, M.whiteStone, sx * 7.0, 0.25, 3, g)
    for (let i = 0; i < 5; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.65, 9, 7), M.leaf)
      bush.scale.set(1, 0.85, 1)
      add(bush, sx * 7.0, 0.85, -1.4 + i * 2.2, g)
    }
  }
  // 廊架
  for (let i = 0; i < 5; i++) {
    cyl(0.1, 0.12, 2.6, M.teak, -3.4 + i * 1.7, 1.3, 7.6, 6, g)
    cyl(0.1, 0.12, 2.6, M.teak, -3.4 + i * 1.7, 1.3, 9.4, 6, g)
  }
  for (let i = 0; i < 5; i++) box(7.4, 0.08, 0.1, M.teak, 0, 2.6, 7.6 + i * 0.45, g)
  box(7.6, 0.16, 2.2, M.teak, 0, 2.66, 8.5, g)
  benchAt(g, 0, 6.4, 0)
  // 场地
  for (let i = 0; i < 4; i++) treeAt(g, -17 + i * 11.4, 18.5, 0.95, 3.4)
  for (let i = 0; i < 4; i++) carAt(g, -14 + i * 8.6, 20.5, 0, [M.glazeWhite, M.paintBlue, M.charcoal, M.paintRed][i])
  lampPost(g, -18, 12, 6.0, 0)
  lampPost(g, 18, 12, 6.0, 0)
  return { g, top: H + 2 }
}

/** 125 溜冰馆（拱壳屋面 + 冰场 + 看台） */
function t125(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 42, M.concrete, 2.8, 'x')
  // 主体 + 拱壳
  box(32, 11, 22, M.plasterGrey, 0, 5.5, -3, g)
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(12.6, 12.6, 33, 26, 1, true, 0, Math.PI), M.membrane)
  shell.rotation.z = Math.PI / 2
  shell.position.y = 11
  shell.castShadow = shell.receiveShadow = true
  g.add(shell)
  for (let i = 0; i < 7; i++) {
    const x0 = -15 + i * 5.0
    const rib = new THREE.Mesh(new THREE.TorusGeometry(12.6, 0.24, 5, 22, Math.PI), M.aluPanel)
    rib.rotation.y = Math.PI / 2
    rib.position.set(x0, 11, -3)
    g.add(rib)
  }
  // 端部玻璃幕墙（拱形）
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI
      box(0.24, 2.4, 0.24, M.aluDark, -12 + i * 3.0, 11 + Math.sin(a) * 2.0, sz * 11 - 3, g)
    }
    box(30, 11, 0.3, M.glSmoke, 0, 5.5, sz * 11 - 3, g)
    for (let i = 0; i <= 8; i++) box(0.18, 11, 0.4, M.aluDark, -14 + i * 3.5, 5.5, sz * 11.13 - 3, g)
  }
  // 冰场 + 围板 + 球门 + 看台
  box(26, 0.16, 14, M.glIce, 0, 0.2, -3, g)
  for (const sz of [-1, 1]) {
    box(26, 1.1, 0.3, M.glazeWhite, 0, 0.7, sz * 7 - 3, g)
    box(26, 0.2, 0.44, M.paintBlue, 0, 1.3, sz * 7 - 3, g)
  }
  for (const sx of [-1, 1]) {
    box(0.3, 1.1, 14, M.glazeWhite, sx * 13, 0.7, -3, g)
    box(0.44, 0.2, 14, M.paintBlue, sx * 13, 1.3, -3, g)
  }
  for (const sx of [-1, 1]) {
    const goal = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 5, 14, Math.PI), M.paintRed)
    goal.rotation.y = Math.PI / 2
    add(goal, sx * 11.5, 1.2, -3, g)
  }
  // 中线与圆
  const circ = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.05, 4, 32), M.paintRed)
  circ.rotation.x = Math.PI / 2
  add(circ, 0, 0.3, -3, g)
  box(0.14, 0.02, 14, M.paintRed, 0, 0.3, -3, g)
  // 看台（南侧三级）
  for (let t = 0; t < 5; t++) {
    box(30, 0.7, 1.6, M.concrete, 0, 0.35 + t * 0.7, 9.0 + t * 1.6, g)
    for (let i = 0; i < 12; i++) box(1.6, 0.34, 1.4, M.paintBlue, -13.5 + i * 2.4, 0.87 + t * 0.7, 9.0 + t * 1.6, g)
  }
  // 入口 + 冰鞋租借 + 广场
  box(10, 5.0, 3.4, M.glWhite, -9, 2.5, 12.4, g)
  box(12, 0.45, 4.6, M.brightSilver, 0, 5.2, 13.0, g)
  box(4.6, 3.6, 0.2, M.glSmoke, -9, 1.8, 14.15, g)
  box(7.0, 1.2, 0.24, M.paintBlue, -9, 6.0, 12.6, g)
  box(9, 3.4, 4.0, M.plasterGrey, 12, 1.7, 13.0, g)
  box(9.6, 0.4, 4.6, M.whiteStone, 12, 3.6, 13.0, g)
  win(g, 12, 2.0, 15.06, 0, 4.0, 2.0, { glass: M.glTeal, frame: M.aluDark, mull: 3 })
  for (let i = 0; i < 5; i++) carAt(g, -14 + i * 7.8, 17.5, 0, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed, M.aluPanel][i])
  for (let i = 0; i < 5; i++) treeAt(g, -18 + i * 9, 20.5, 0.85, 3.0)
  lampPost(g, -18, 14, 6.6, 0)
  lampPost(g, 18, 14, 6.6, 0)
  return { g, top: 24 }
}
/** 126 高速服务区（主楼四面 + 加油站 + 停车区 + 场地） */
function t126(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 42, M.concrete, 3.0, 'x')
  // 主路（贯穿）+ 车道线 + 边线
  box(44, 0.14, 9.0, M.aluDark, 0, 0.07, 6, g)
  for (let i = 0; i < 22; i++) box(1.6, 0.04, 0.2, M.roadPaint, -21 + i * 2.0, 0.16, 6, g)
  for (let i = 0; i < 11; i++) box(0.16, 0.04, 9.0, M.roadPaint, -20 + i * 4.0, 0.16, 6, g)
  for (const sz of [-1, 1]) box(44, 0.05, 0.16, M.glazeWhite, 0, 0.16, 6 + sz * 4.4, g)
  // 主楼
  box(24, 7.4, 12, M.plasterWarm, -6, 3.7, -10, g)
  box(24.4, 0.9, 12.4, M.whiteStone, -6, 0.45, -10, g)   // 勒脚
  box(25, 0.6, 13, M.aluPanel, -6, 7.7, -10, g)
  box(25.4, 0.24, 13.4, M.whiteStone, -6, 8.1, -10, g)
  // 女儿墙
  box(25.2, 0.7, 0.3, M.plaster, -6, 8.5, -10 + 6.35, g)
  box(25.2, 0.7, 0.3, M.plaster, -6, 8.5, -10 - 6.35, g)
  for (const sx of [-1, 1]) box(0.3, 0.7, 13, M.plaster, -6 + sx * 12.35, 8.5, -10, g)
  // 南立面：大面积玻璃幕 + 竖梃
  for (let i = 0; i < 6; i++) gridGlass(g, -16 + i * 4.0, 3.2, -3.94, 0, 3.2, 4.6, 2, 2, { glass: M.glTeal, frame: M.aluDark })
  box(24.4, 0.4, 0.6, M.aluPanel, -6, 5.7, -3.9, g)
  // 东、西、北立面窗（之前全空）
  for (let i = 0; i < 3; i++) {
    const pz = -13.4 + i * 3.6
    win(g, -6 + 12.1, 3.4, pz, Math.PI / 2, 2.4, 2.6, { glass: M.glTeal, frame: M.aluDark, mull: 2 })
    win(g, -6 - 12.1, 3.4, pz, -Math.PI / 2, 2.4, 2.6, { glass: M.glTeal, frame: M.aluDark, mull: 2 })
    win(g, -14.0 + i * 8.0, 3.4, -16.1, Math.PI, 2.6, 2.6, { glass: M.glTeal, frame: M.aluDark, mull: 2 })
  }
  // 屋顶设备 + 天窗 + 通风帽
  box(7.0, 2.0, 5.0, M.aluPanel, -12.0, 9.4, -13.0, g)
  box(5.0, 1.6, 4.0, M.aluPanel, -1.0, 9.2, -13.0, g)
  box(12.0, 0.4, 2.0, M.glIce, -8.0, 8.6, -8.0, g)
  for (let i = 0; i < 5; i++) box(0.1, 0.45, 2.0, M.aluDark, -13.0 + i * 2.6, 8.6, -8.0, g)
  for (const ox of [-15.0, -3.0]) {
    cyl(0.6, 0.6, 1.0, M.aluPanel, ox, 8.9, -5.0, 10, g)
    cyl(0.74, 0.6, 0.24, M.aluDark, ox, 9.5, -5.0, 10, g)
  }
  // 入口门斗 + 雨篷 + 台阶 + 自动门
  box(9, 4.4, 3.0, M.glWhite, -6, 2.2, -3.4, g)
  box(11, 0.45, 4.4, M.brightSilver, -6, 4.6, -2.6, g)
  box(11.2, 0.14, 4.6, M.aluPanel, -6, 4.86, -2.6, g)
  box(4.2, 3.0, 0.2, M.glSmoke, -6, 1.6, -1.85, g)
  for (let i = 0; i < 3; i++) box(0.1, 3.0, 0.22, M.aluDark, -8.0 + i * 2.0, 1.6, -1.78, g)
  steps(g, 9.0, 3, 0.16, 0.5, 0.32, M.whiteStone, -1.0)
  // 招牌（双柱 + 灯箱）
  box(14, 1.6, 0.4, M.paintBlue, -6, 9.6, -3.8, g)
  box(10, 0.3, 0.1, M.glazeWhite, -6, 9.6, -3.56, g)
  for (const ox of [-15, 3]) {
    cyl(0.2, 0.2, 6.0, M.aluDark, ox, 3.0, -3.6, 8, g)
    box(0.5, 0.5, 0.5, M.glazeWhite, ox, 6.2, -3.6, g)
  }
  // 加油站：罩棚 + 岛 + 加油机 + 立柱
  box(18, 0.7, 8.0, M.paintRed, 12, 7.4, -8, g)
  box(18.4, 0.3, 8.4, M.whiteStone, 12, 7.0, -8, g)
  box(18, 0.28, 0.6, M.paintRed, 12, 7.9, -4.0, g)
  box(17.0, 0.1, 7.4, M.glazeWhite, 12, 6.94, -8, g)   // 罩棚底面
  for (let i = 0; i < 6; i++) box(0.2, 0.09, 7.4, M.aluPanel, 4.5 + i * 3.0, 6.88, -8, g)
  for (const px of [8, 16]) {
    for (const pz of [-10.0, -6.0]) cyl(0.34, 0.38, 7.0, M.whiteStone, px, 3.5, pz, 10, g)
    box(6.0, 0.26, 2.2, M.paving, px, 0.16, -8, g)
    box(1.0, 2.2, 0.7, M.glazeWhite, px, 1.1, -8, g)
    box(0.7, 0.8, 0.5, M.paintBlue, px, 2.5, -8, g)
    // 加油机顶部灯罩 + 消防箱
    box(0.9, 0.24, 0.6, M.glazeWhite, px, 2.9, -8, g)
    box(0.6, 0.5, 0.4, M.paintRed, px + 2.0, 0.5, -8, g)
  }
  // 大车停车区
  for (let i = 0; i < 4; i++) {
    box(13, 3.4, 3.0, M.glazeWhite, -18 + i * 4.0, 2.0, 12.5, g)
    box(13, 1.0, 3.0, M.paintBlue, -18 + i * 4.0, 0.7, 12.5, g)
    box(4.0, 1.6, 3.04, M.glSmoke, -22 + i * 4.0, 2.6, 12.5, g)
    for (const sx of [-4.4, 4.4]) for (const sz of [-1.2, 1.2]) cyl(0.5, 0.5, 0.42, M.charcoal, -18 + i * 4.0 + sx, 0.52, 12.5 + sz, 10, g)
    // 车位线
    box(15, 0.04, 0.16, M.glazeWhite, -18 + i * 4.0, 0.18, 15.0, g)
  }
  // 小客车位
  for (let i = 0; i < 4; i++) {
    carAt(g, 6 + i * 6.2, 16.5, 0, [M.charcoal, M.glazeWhite, M.paintRed, M.aluPanel][i])
    box(3.0, 0.06, 5.4, M.roadPaint, 8 + i * 6.2, 0.1, 16.5, g)
    box(0.14, 0.04, 5.4, M.glazeWhite, 4.6 + i * 6.2, 0.18, 16.5, g)
  }
  // 卫生间 + 垃圾房
  box(7, 4.0, 5.0, M.plasterGrey, 18, 2.0, 6.5, g)
  box(7.4, 0.36, 5.4, M.whiteStone, 18, 4.2, 6.5, g)
  box(0.24, 2.2, 0.2, M.aluDark, 18, 1.1, 9.06, g)
  box(2.0, 2.0, 0.2, M.teak, 18, 1.0, 9.06, g)
  win(g, 18, 2.6, 4.0 - 0.06, Math.PI, 5.0, 1.4, { glass: M.glTeal, frame: M.aluDark })
  box(4.0, 2.6, 3.2, M.paintGreen, 12.0, 1.3, 8.0, g)
  box(4.3, 0.24, 3.5, M.aluDark, 12.0, 2.7, 8.0, g)
  // 绿化 + 灯 + 标志牌
  for (let i = 0; i < 5; i++) treeAt(g, -19 + i * 9.4, -18.0, 0.9, 3.2)
  for (let i = 0; i < 4; i++) treeAt(g, -18 + i * 12, 20.0, 0.85, 3.0, i % 2 ? 'column' : null)
  for (let i = 0; i < 8; i++) bushAt(g, -20 + i * 5.6, -16.2, 0.55)
  for (const [lx, lz] of [[-20, 2], [20, 2], [-20, 16], [20, 16], [0, -1.5], [-14, 2.6]]) lampPost(g, lx, lz, 8.0, 0)
  return { g, top: 12 }
}

/** 127 收费站（六车道 + ETC 门架 + 管理楼） */
function t127(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 40, M.concrete, 3.0, 'x')
  // 路面
  box(44, 0.12, 20, M.aluDark, 0, 0.06, 0, g)
  for (let i = 0; i < 7; i++) {
    for (let k = 0; k < 9; k++) box(1.4, 0.04, 0.2, M.roadPaint, -18 + i * 6.0 + (k % 2) * 2.8, 0.15, -4.4 + k * 1.1, g)
  }
  // 岛头 + 收费亭
  for (let i = 0; i < 6; i++) {
    const px = -15 + i * 6.0
    box(1.6, 0.7, 11.0, M.whiteStone, px, 0.35, 0, g)
    box(1.8, 0.16, 11.2, M.paintYell, px, 0.74, 0, g)
    if (i < 5) {
      box(2.0, 2.6, 3.0, M.glazeWhite, px + 3.0, 2.0, 0, g)
      for (let k = 0; k < 4; k++) box(2.06, 0.5, 3.06, M.paintBlue, px + 3.0, 0.9 + k * 0.62, 0, g)
      box(2.4, 0.2, 3.4, M.whiteStone, px + 3.0, 3.4, 0, g)
      box(0.16, 0.3, 0.9, M.glazeWhite, px + 3.0, 3.6, 0, g)
    }
  }
  // 大罩棚
  for (let i = 0; i < 4; i++) cyl(0.34, 0.4, 7.6, M.aluPanel, -14 + i * 9.4, 3.8, 0, 10, g)
  box(38, 0.7, 12.0, M.membrane, 0, 8.0, 0, g)
  box(38.4, 0.28, 12.4, M.aluPanel, 0, 7.6, 0, g)
  box(38.6, 1.2, 0.4, M.paintBlue, 0, 8.7, 6.0, g)
  box(30, 0.26, 0.12, M.glazeWhite, 0, 8.7, 6.24, g)
  for (let i = 0; i < 8; i++) box(4.4, 0.12, 0.3, M.glazeWhite, -16 + i * 4.6, 7.3, -1.0 + (i % 3) * 1.0, g)
  // ETC 门架
  for (const gx of [-19, 19]) {
    for (const sz of [-1, 1]) cyl(0.24, 0.3, 7.4, M.aluDark, gx, 3.7, sz * 10.6, 8, g)
    box(1.2, 0.5, 22.0, M.aluDark, gx, 7.4, 0, g)
    for (let i = 0; i < 3; i++) box(0.9, 1.0, 0.5, M.glazeWhite, gx, 6.6, -6 + i * 6, g)
    for (let i = 0; i < 3; i++) box(0.3, 0.16, 0.6, M.brightSilver, gx, 6.1, -6 + i * 6, g)
  }
  // 管理楼 + 宿舍
  box(12, 8.4, 8, M.plasterWarm, 14, 4.2, -15, g)
  box(12.6, 0.5, 8.6, M.aluPanel, 14, 8.6, -15, g)
  for (let f = 0; f < 2; f++) for (let i = 0; i < 4; i++) win(g, 9.6 + i * 2.8, 2.6 + f * 3.2, -10.94, 0, 1.8, 1.6, { glass: M.glTeal, frame: M.aluDark })
  box(3.0, 8.4, 0.3, M.paintBlue, 14, 4.2, -10.8, g)
  box(6, 3.0, 3, M.plasterGrey, 19, 1.5, -15, g)
  // 绿化 + 灯
  for (let i = 0; i < 6; i++) treeAt(g, -20 + i * 8, -17.5, 0.85, 3.0)
  for (let i = 0; i < 4; i++) treeAt(g, -20 + i * 13, 17.0, 0.85, 3.0)
  for (const [lx, lz] of [[-21, 12], [21, 12], [-21, -8], [21, -8]]) lampPost(g, lx, lz, 7.6, 0)
  return { g, top: 11 }
}

/** 128 人行天桥（跨路连廊 + 楼梯 + 电梯） */
function t128(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 40, M.concrete, 3.0, 'x')
  // 下方道路
  box(44, 0.1, 12, M.aluDark, 0, 0.05, -2, g)
  for (let i = 0; i < 12; i++) box(3.2, 0.04, 0.24, M.roadPaint, -20 + i * 3.6, 0.14, -2, g)
  // 两侧建筑（桥端落地）
  for (const sx of [-1, 1]) {
    box(11, 8.0, 12, M.plasterGrey, sx * 15, 4, 0, g)
    box(11.6, 0.5, 12.6, M.whiteStone, sx * 15, 8.2, 0, g)
    for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) {
      win(g, sx * 15, 2.4 + f * 3.2, -4 + i * 4.0, 0, 2.2, 1.8, { glass: M.glTeal, frame: M.aluDark })
      win(g, sx * 15, 2.4 + f * 3.2, -4 + i * 4.0, Math.PI, 2.2, 1.8, { glass: M.glTeal, frame: M.aluDark })
    }
    box(11, 3.0, 3.0, M.glWhite, sx * 15, 10.5, 3.4, g)
  }
  // 桥身（双层：走道 + 顶棚）
  box(20, 1.0, 6.0, M.concrete, 0, 7.0, 0, g)
  for (const sz of [-1, 1]) {
    box(20, 2.4, 0.2, M.glTeal, 0, 8.4, sz * 3.0, g)
    for (let i = 0; i <= 8; i++) box(0.14, 2.4, 0.26, M.aluDark, -10 + i * 2.5, 8.4, sz * 3.1, g)
    box(20, 0.24, 0.3, M.brightSilver, 0, 9.7, sz * 3.2, g)
  }
  // 顶棚（曲面）
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 20.4, 18, 1, true, 0, Math.PI), M.membrane)
  roof.rotation.z = Math.PI / 2
  roof.scale.y = 0.42
  roof.position.y = 9.7
  roof.castShadow = true
  g.add(roof)
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.12, 4, 16, Math.PI), M.aluPanel)
    rib.rotation.y = Math.PI / 2
    rib.scale.y = 0.42
    rib.position.set(-9.4 + i * 3.8, 9.7, 0)
    g.add(rib)
  }
  // 桥墩（两侧落地）
  for (const sx of [-1, 1]) {
    box(2.2, 7.0, 2.6, M.whiteStone, sx * 9.4, 3.5, 0, g)
    box(3.0, 0.4, 3.4, M.tuff, sx * 9.4, 0.2, 0, g)
  }
  // 楼梯（一端，折跑）+ 电梯（另端）
  for (let i = 0; i < 10; i++) {
    box(2.6, 0.3, 0.9, M.whiteStone, -9.4, 6.6 - i * 0.62, 3.6 + i * 0.85, g)
    railing(g, 2.6, 7.0 - i * 0.62, 4.05 + i * 0.85, M.brightSilver, 2, 0.95)
  }
  box(3.0, 7.2, 3.0, M.glWhite, 9.4, 3.6, 5.0, g)
  box(3.4, 0.4, 3.4, M.brightSilver, 9.4, 7.3, 5.0, g)
  for (const sz of [-1, 1]) box(0.2, 7.2, 3.1, M.aluDark, 9.4, 3.6, 5.0 + sz * 1.5, g)
  // 桥上行人剪影 + 灯带
  for (let i = 0; i < 9; i++) {
    box(0.34, 1.1, 0.3, [M.charcoal, M.paintBlue, M.paintRed][i % 3], -8 + i * 2.0, 8.0, 0.5 - (i % 2) * 1.0, g)
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M.plaster)
    add(hd, -8 + i * 2.0, 8.72, 0.5 - (i % 2) * 1.0, g)
  }
  for (let i = 0; i < 7; i++) box(0.3, 0.05, 4.6, M.glazeWhite, -9 + i * 3.0, 9.55, 0, g)
  // 场地
  for (let i = 0; i < 4; i++) carAt(g, -15 + i * 8.6, 12.5, Math.PI / 2, [M.charcoal, M.glazeWhite, M.paintBlue, M.paintRed][i])
  for (let i = 0; i < 4; i++) treeAt(g, -18 + i * 12, 17.5, 0.85, 3.0)
  lampPost(g, -19, 8, 6.4, 0)
  lampPost(g, 19, 8, 6.4, 0)
  return { g, top: 14 }
}

/** 129 地铁高架站（站台雨棚 + 天桥 + 站房） */
function t129(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 40, M.paving, 3.0, 'x')
  // 高架轨道（沿 x）
  box(44, 1.2, 8.0, M.concrete, 0, 8.0, -4, g)
  box(44.4, 0.3, 8.4, M.aluPanel, 0, 8.75, -4, g)
  for (const sz of [-1, 1]) box(44, 0.5, 0.24, M.aluDark, 0, 9.4, sz * 4.0 - 4, g)
  for (let i = 0; i < 4; i++) {
    const px = -18 + i * 12
    box(3.2, 8.0, 3.0, M.whiteStone, px, 4.0, -4, g)
    box(4.2, 0.5, 4.0, M.tuff, px, 0.25, -4, g)
    box(4.0, 0.4, 3.8, M.aluPanel, px, 7.9, -4, g)
  }
  // 轨道 + 接触网杆
  for (const sz of [-1, 1]) {
    box(44, 0.16, 0.3, M.brightSilver, 0, 9.6, sz * 1.6 - 4, g)
    for (let i = 0; i < 6; i++) box(0.14, 0.1, 1.4, M.aluDark, -20 + i * 8, 9.6, sz * 2.2 - 4, g)
  }
  for (let i = 0; i < 6; i++) {
    cyl(0.14, 0.18, 3.4, M.aluPanel, -20 + i * 8, 11.2, -2.0, 6, g)
    box(0.24, 0.2, 4.4, M.aluPanel, -20 + i * 8, 12.8, -4.0, g)
  }
  // 站台（两侧）+ 屏蔽门 + 座椅
  for (const sz of [-1, 1]) {
    box(34, 1.1, 4.0, M.whiteStone, 0, 9.6, sz * 5.0 - 4, g)
    box(30, 0.22, 0.2, M.glazeWhite, 0, 10.5, sz * 3.2 - 4, g)
    for (let i = 0; i < 10; i++) box(0.16, 2.2, 0.24, M.glazeWhite, -14 + i * 3.2, 11.5, sz * 3.2 - 4, g)
    box(30, 0.3, 0.3, M.brightSilver, 0, 12.7, sz * 3.2 - 4, g)
    for (let i = 0; i < 5; i++) box(2.2, 0.2, 0.6, M.paintBlue, -12 + i * 6, 10.7, sz * 6.0 - 4, g)
  }
  // 雨棚（大跨）
  for (let i = 0; i < 7; i++) cyl(0.26, 0.3, 6.0, M.aluPanel, -15 + i * 5.0, 13.0, -4, 8, g)
  box(38, 0.5, 16, M.membrane, 0, 16.2, -4, g)
  box(38.6, 0.24, 16.6, M.aluPanel, 0, 15.9, -4, g)
  for (let i = 0; i < 9; i++) box(34, 0.1, 0.3, M.glazeWhite, 0, 15.6, -10 + i * 1.6, g)
  // 站房（地面）+ 天桥连廊
  box(18, 7.0, 10, M.glWhite, 0, 3.5, 8.0, g)
  box(19, 0.6, 11, M.brightSilver, 0, 7.3, 8.0, g)
  gridGlass(g, 0, 3.0, 13.05, 0, 15, 5.4, 6, 2, { glass: M.glSmoke, frame: M.aluDark })
  box(5.0, 3.4, 0.22, M.glSmoke, 0, 1.7, 13.4, g)
  steps(g, 12, 3, 0.22, 0.9, 0, M.whiteStone, 14.2)
  box(8.0, 1.4, 0.3, M.paintBlue, 0, 7.9, 8.4, g)
  box(5.6, 0.3, 0.1, M.glazeWhite, 0, 7.9, 8.56, g)
  // 天桥（站台到站房）
  box(5.0, 0.5, 11, M.whiteStone, 0, 9.0, 2.0, g)
  for (const sx of [-1, 1]) box(0.2, 2.6, 11, M.glWhite, sx * 2.4, 10.2, 2.0, g)
  box(5.4, 0.3, 11.4, M.brightSilver, 0, 11.6, 2.0, g)
  for (let i = 0; i < 4; i++) cyl(0.16, 0.16, 9.0, M.brightSilver, -2.0 + i * 1.4, 4.5, 6.0, 6, g)
  // 车（地面公交）+ 广场
  for (let i = 0; i < 3; i++) {
    box(9.6, 2.8, 2.7, M.glazeWhite, -13 + i * 11, 1.7, -16.0, g)
    box(9.6, 0.8, 2.7, M.paintBlue, -13 + i * 11, 0.55, -16.0, g)
    for (const sx of [-3.2, 3.2]) for (const sz of [-1.1, 1.1]) cyl(0.42, 0.42, 0.36, M.charcoal, -13 + i * 11 + sx, 0.46, -16.0 + sz, 10, g)
  }
  for (let i = 0; i < 6; i++) treeAt(g, -19 + i * 7.6, 18.5, 0.85, 3.0)
  for (let i = 0; i < 4; i++) carAt(g, -14 + i * 9.0, 20.0, 0, [M.charcoal, M.glazeWhite, M.paintRed, M.aluPanel][i])
  for (const [lx, lz] of [[-20, 14], [20, 14], [-20, 2], [20, 2]]) lampPost(g, lx, lz, 7.0, 0)
  return { g, top: 18 }
}

/** 130 集装箱码头（岸桥 + 堆场 + 货轮，跨 2 格） */
function t130(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 92, 42, M.concrete, 3.2, 'x')
  // 码头岸线 + 水面
  box(92, 0.4, 12, M.whiteStone, 0, 0.2, -15, g)
  box(92, 0.1, 12.0, M.glTeal, 0, 0.05, -22, g)
  // 岸桥（三台，门架 + 悬臂 + 小车）
  for (let i = 0; i < 3; i++) {
    const cx = -28 + i * 26
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(1.4, 26, 1.4, M.aluPanel, cx + sx * 6.0, 13, -8 + sz * 7.0, g)
    }
    box(14, 1.4, 16, M.aluPanel, cx, 26.7, -8, g)
    box(14, 0.6, 16.6, M.brightSilver, cx, 27.6, -8, g)
    // 前伸悬臂（伸向水面）
    box(3.0, 1.2, 22, M.aluPanel, cx, 24.0, -20, g)
    for (let k = 0; k < 5; k++) {
      const a = beamBetween(g, cx, 25.0, -12 + k * 0.1, cx, 24.6, -8 - k * 5.0, 0.4, M.aluDark, 0.4)
      a.castShadow = false
    }
    box(2.4, 2.0, 3.0, M.paintRed, cx, 22.0, -20, g)
    // 小车 + 吊具
    box(2.4, 1.2, 2.6, M.paintYell, cx, 23.0, -16, g)
    box(0.16, 4.0, 0.16, M.aluDark, cx, 20.6, -16, g)
    box(5.0, 0.6, 2.4, M.paintYell, cx, 18.4, -16, g)
    // 拉杆
    for (const sx of [-1, 1]) {
      const m = beamBetween(g, cx + sx * 6.0, 27.0, -8, cx + sx * 1.6, 23.6, -24, 0.3, M.aluPanel, 0.3)
      m.castShadow = false
    }
  }
  // 集装箱堆场（4 层 3 排）
  const cols = [M.paintRed, M.paintBlue, M.paintYell, M.glTeal, M.terra, M.aluPanel]
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 14; c++) {
      const hgt = 1 + ((c + r) % 4)
      for (let k = 0; k < hgt; k++) {
        const bx = -40 + c * 6.2
        const bz = -2 + r * 7.0
        const col = cols[(c + r + k) % cols.length]
        box(5.8, 2.5, 2.4, col, bx, 1.25 + k * 2.55, bz, g)
        for (let q = 0; q < 5; q++) box(0.12, 2.3, 2.45, M.aluDark, bx - 2.2 + q * 1.1, 1.25 + k * 2.55, bz, g)
      }
    }
  }
  // 货轮（外侧）
  box(58, 3.4, 10, M.glNavy, 4, 1.9, -24, g)
  box(58, 1.0, 10.2, M.paintRed, 4, 0.5, -24, g)
  box(14, 9.0, 8.0, M.glazeWhite, 30, 6.5, -24, g)
  box(14.4, 1.0, 8.4, M.whiteStone, 30, 11.4, -24, g)
  for (let i = 0; i < 4; i++) box(12, 1.0, 0.2, M.glSmoke, 30, 3.2 + i * 1.8, -19.9, g)
  cyl(1.4, 1.8, 5.0, M.paintRed, 36, 11.0, -24, 12, g)
  cyl(1.5, 1.5, 0.4, M.charcoal, 36, 13.6, -24, 12, g)
  for (let i = 0; i < 6; i++) box(10, 2.4, 2.4, cols[i % cols.length], -16 + i * 4.6, 3.8, -24, g)
  // 管理楼 + 闸口 + 灯
  box(14, 7, 9, M.plasterGrey, -34, 3.5, 17, g)
  box(14.6, 0.5, 9.6, M.whiteStone, -34, 7.3, 17, g)
  for (let f = 0; f < 2; f++) for (let i = 0; i < 4; i++) win(g, -38.5 + i * 3.0, 2.4 + f * 3.0, 21.56, 0, 1.9, 1.6, { glass: M.glTeal, frame: M.aluDark })
  for (let i = 0; i < 3; i++) {
    box(3.0, 3.4, 0.4, M.glazeWhite, -28 + i * 7, 1.7, 13.0, g)
    box(3.4, 0.4, 0.8, M.paintYell, -28 + i * 7, 3.6, 13.0, g)
  }
  for (let i = 0; i < 6; i++) {
    for (const sz of [-1, 1]) {
      cyl(0.22, 0.3, 14, M.aluPanel, -40 + i * 16, 7, sz * 12 + 2, 8, g)
      box(1.6, 0.3, 1.6, M.glazeWhite, -40 + i * 16, 14.2, sz * 12 + 2, g)
    }
  }
  return { g, top: 32 }
}
/** 131 污水处理厂（曝气池 + 沉淀池 + 中控楼） */
function t131(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 42, M.concrete, 3.0, 'x')
  // 四座圆形沉淀池（带刮桥）
  for (const [cx, cz] of [[-11, 8], [11, 8], [-11, -6], [11, -6]]) {
    cyl(6.2, 6.4, 2.4, M.whiteStone, cx, 1.2, cz, 24, g)
    cyl(5.8, 5.8, 0.4, M.glTeal, cx, 2.3, cz, 24, g)
    cyl(6.0, 6.0, 0.2, M.brightSilver, cx, 2.55, cz, 24, g)
    box(12.0, 0.28, 0.9, M.brightSilver, cx, 2.7, cz, g)
    cyl(0.45, 0.45, 1.4, M.aluPanel, cx, 3.1, cz, 10, g)
    // 出水堰 + 管
    cyl(0.42, 0.42, 2.2, M.brightSilver, cx + 6.4, 1.2, cz, 10, g)
    box(1.0, 0.14, 6.0, M.aluPanel, cx, 2.62, cz + 3.0, g)
  }
  // 曝气池（矩形，带廊道）
  box(20, 2.2, 10, M.whiteStone, 0, 1.1, -17, g)
  box(19, 0.3, 9.0, M.glTeal, 0, 2.2, -17, g)
  for (let i = 0; i < 5; i++) box(18.6, 0.12, 0.24, M.aluPanel, 0, 2.36, -20.5 + i * 1.8, g)
  for (let i = 0; i < 5; i++) box(1.6, 0.5, 1.2, M.aluDark, -7 + i * 3.6, 2.6, -17, g)
  railing(g, 20, 2.3, -12.0, M.brightSilver, 10, 0.9)
  railing(g, 20, 2.3, -22.0, M.brightSilver, 10, 0.9)
  // 中控楼 + 加药间 + 鼓风机房
  box(14, 8.0, 9, M.plasterGrey, -13, 4.0, 17, g)
  box(14.6, 0.5, 9.6, M.whiteStone, -13, 8.3, 17, g)
  for (let f = 0; f < 2; f++) for (let i = 0; i < 4; i++) win(g, -17.5 + i * 3.0, 2.6 + f * 3.0, 21.56, 0, 1.9, 1.6, { glass: M.glTeal, frame: M.aluDark })
  box(2.6, 2.6, 0.2, M.aluDark, -13, 1.3, 21.56, g)
  box(9, 5.0, 7, M.plasterGrey, 13, 2.5, 17, g)
  box(9.6, 0.4, 7.6, M.aluPanel, 13, 5.2, 17, g)
  for (let i = 0; i < 3; i++) box(2.4, 1.8, 0.8, M.aluPanel, 10 + i * 3.0, 1.0, 20.6, g)
  // 管道 + 阀 + 除臭塔
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 22, 12), M.brightSilver)
  pipe.rotation.z = Math.PI / 2
  add(pipe, 0, 1.4, 1.0, g)
  for (let i = 0; i < 4; i++) cyl(0.66, 0.66, 0.4, M.paintRed, -7 + i * 5.0, 1.4, 1.0, 12, g)
  cyl(1.1, 1.3, 8.0, M.aluPanel, 18, 4.0, 8, 14, g)
  cyl(1.2, 1.2, 0.5, M.aluDark, 18, 8.2, 8, 14, g)
  // 绿化 + 围栏
  for (const sz of [-1, 1]) hedge(g, 0, sz * 20.5, 40, true, 1.2, 0.9)
  for (let i = 0; i < 5; i++) treeAt(g, -18 + i * 9, 21.0, 0.9, 3.0)
  for (const [lx, lz] of [[-19, 12], [19, 12], [-19, -14], [19, -14]]) lampPost(g, lx, lz, 6.6, 0)
  return { g, top: 10 }
}

/** 132 火电厂（冷却塔 + 烟囱 + 汽机房 + 输煤栈桥） */
function t132(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 42, M.concrete, 3.0, 'x')
  // 双曲线冷却塔
  for (const cx of [-11, 11]) {
    const ctrl = [[7.6, 0], [6.6, 8], [5.6, 18], [4.9, 26], [5.6, 34]]
    const curve = new THREE.CatmullRomCurve3(ctrl.map(([r, y]) => new THREE.Vector3(r, y, 0)))
    const prof = curve.getPoints(24).map((p) => new THREE.Vector2(p.x, p.y))
    const tower = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), M.concrete)
    tower.castShadow = tower.receiveShadow = true
    add(tower, cx, 0, -8, g)
    // 底部柱廊
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      box(0.5, 3.6, 0.7, M.concreteDark, cx + Math.cos(a) * 7.3, 1.8, -8 + Math.sin(a) * 7.3, g).rotation.y = -a
    }
    // 顶部栏杆
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.65, 0.16, 6, 36), M.concreteDark)
    ring.rotation.x = Math.PI / 2
    add(ring, cx, 34.2, -8, g)
  }
  // 烟囱（红白环带）
  const chH = 58
  cyl(2.4, 3.2, chH, M.plasterGrey, 0, chH / 2, -17, 20, g)
  for (let i = 0; i < 6; i++) cyl(2.5 + (i < 1 ? 0.2 : 0), 2.6 + i * 0.1, 4.0, i % 2 ? M.paintRed : M.glazeWhite, 0, 8 + i * 8.0, -17, 20, g)
  cyl(3.4, 3.4, 0.6, M.concreteDark, 0, chH + 0.4, -17, 20, g)
  cyl(1.0, 1.0, 2.0, M.charcoal, 0, chH + 1.6, -17, 12, g)
  // 汽机房 + 锅炉（大跨厂房）
  box(30, 22, 14, M.plasterGrey, 0, 11, 10, g)
  box(30.8, 0.8, 14.8, M.aluPanel, 0, 22.3, 10, g)
  box(31.2, 0.24, 15.2, M.concreteDark, 0, 22.9, 10, g)
  // 高侧窗带
  for (const sz of [-1, 1]) {
    box(28, 3.2, 0.2, M.glTeal, 0, 18.0, sz * 7.06 + 10, g)
    for (let i = 0; i <= 9; i++) box(0.16, 3.2, 0.3, M.aluDark, -14 + i * 3.1, 18.0, sz * 7.12 + 10, g)
  }
  // 山墙卷帘门
  for (let i = 0; i < 3; i++) {
    box(6.0, 8.0, 0.3, M.aluDark, -10 + i * 10, 4.0, 17.06, g)
    for (let k = 0; k < 10; k++) box(5.8, 0.12, 0.4, M.aluPanel, -10 + i * 10, 0.4 + k * 0.8, 17.1, g)
  }
  // 输煤栈桥（斜向）
  for (let i = 0; i < 7; i++) {
    const t = i / 7
    const m = box(3.4, 2.4, 6.4, M.aluPanel, -14 + t * 6, 12 - t * 5, 16 + t * 3.4, g)
    m.rotation.y = -0.7
    box(1.4, 10 - t * 4, 1.4, M.concreteDark, -14 + t * 6, (12 - t * 5) / 2, 16 + t * 3.4, g)
  }
  // 变电站（户外）
  for (let i = 0; i < 3; i++) {
    box(4.0, 2.4, 3.0, M.aluPanel, -17 + i * 4.6, 1.2, 19.0, g)
    for (let k = 0; k < 3; k++) cyl(0.1, 0.16, 1.8, M.glazeWhite, -18 + i * 4.6 + k * 1.2, 3.3, 19.0, 8, g)
  }
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) cyl(0.16, 0.2, 11, M.aluPanel, 8 + i * 4.0 + sx * 2.4, 5.5, 19.0, 8, g)
    box(5.6, 0.3, 0.3, M.aluPanel, 8 + i * 4.0, 11, 19.0, g)
  }
  // 围栏 + 绿化
  for (const sz of [-1, 1]) hedge(g, 0, sz * 20.5, 40, true, 1.3, 0.9)
  for (let i = 0; i < 5; i++) treeAt(g, -18 + i * 9, -20.0, 0.85, 3.0)
  for (const [lx, lz] of [[-19, 0], [19, 0], [-19, 18], [19, 18]]) lampPost(g, lx, lz, 8.0, 0)
  return { g, top: 62 }
}

/** 133 风力发电场（三台风机 + 升压站 + 检修道 + 围栏） */
function t133(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 42, M.plasterGrey, 3.4, 'x')
  // 草地色块（深浅拼接）
  for (let i = 0; i < 6; i++) {
    box(12, 0.04, 10, i % 2 ? M.plasterGrey : M.concrete, -19 + (i % 3) * 14, 0.06, -18 + Math.floor(i / 3) * 32, g)
  }
  // 碎石检修道：连接三台风机与升压站
  const roadSeg = (x1, z1, x2, z2, w = 3.4) => {
    const len = Math.hypot(x2 - x1, z2 - z1)
    const m = box(len, 0.1, w, M.concreteDark, (x1 + x2) / 2, 0.1, (z1 + z2) / 2, g)
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1)
    // 路肩
    for (const sz of [-1, 1]) {
      const s2 = box(len, 0.14, 0.3, M.plasterGrey, (x1 + x2) / 2, 0.12, (z1 + z2) / 2 + sz * (w / 2), g)
      s2.rotation.y = m.rotation.y
    }
    return m
  }
  roadSeg(-12, 4, 10, -10)
  roadSeg(-12, 4, 14, 12)
  roadSeg(10, -10, 14, 12)
  roadSeg(-12, 4, -16, -12)
  roadSeg(-16, -12, -16, -15)

  const turbines = [[-12, 4, 1.0, 0.5], [10, -10, 0.85, 2.1], [14, 12, 0.72, 4.0]]
  for (const [tx, tz, sc, rot] of turbines) {
    const H = 44 * sc
    // 基础：八边形混凝土台 + 碎石散水 + 接地网
    cyl(3.4 * sc, 3.7 * sc, 0.8, M.concrete, tx, 0.4, tz, 8, g)
    cyl(4.6 * sc, 4.6 * sc, 0.12, M.concreteDark, tx, 0.06, tz, 8, g)
    // 塔筒（逐段收分）+ 法兰环 + 塔门
    const seg = 5
    for (let i = 0; i < seg; i++) {
      const r0 = (1.9 - i * 0.22) * sc
      const r1 = (1.9 - (i + 1) * 0.22) * sc
      cyl(r1, r0, H / seg, M.glazeWhite, tx, 0.8 + i * (H / seg) + H / seg / 2, tz, 16, g)
      // 段间法兰
      if (i > 0) cyl(r0 + 0.08, r0 + 0.08, 0.12, M.whiteStone, tx, 0.8 + i * (H / seg), tz, 16, g)
    }
    box(1.3 * sc, 2.2 * sc, 0.3, M.aluDark, tx, 1.9 * sc, tz + 1.8 * sc, g)
    box(1.5 * sc, 0.16, 0.5, M.whiteStone, tx, 3.1 * sc, tz + 1.85 * sc, g)
    // 机舱 + 顶部散热格栅 + 吊装孔
    const ny = 0.8 + H
    const nac = new THREE.Mesh(new THREE.BoxGeometry(2.0 * sc, 2.0 * sc, 5.8 * sc), M.glazeWhite)
    nac.position.set(tx, ny + 0.4 * sc, tz)
    nac.castShadow = true
    g.add(nac)
    box(2.1 * sc, 0.3, 4.4 * sc, M.whiteStone, tx, ny + 1.45 * sc, tz, g)
    for (let k = 0; k < 4; k++) box(2.02 * sc, 0.1, 0.16, M.aluPanel, tx, ny + 0.4 * sc - 0.3 + k * 0.24, tz + 2.9 * sc, g)
    // 轮毂 + 三叶片
    const hub = new THREE.Mesh(new THREE.SphereGeometry(1.0 * sc, 14, 10), M.glazeWhite)
    add(hub, tx, ny + 0.4 * sc, tz + 3.1 * sc, g)
    cyl(1.05 * sc, 1.05 * sc, 0.4 * sc, M.whiteStone, tx, ny + 0.4 * sc, tz + 3.5 * sc, 14, g)
    for (let k = 0; k < 3; k++) {
      const a = rot + (k / 3) * Math.PI * 2
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.0 * sc, 22 * sc, 0.24 * sc), M.glazeWhite)
      blade.position.set(tx + Math.sin(a) * 11 * sc, ny + 0.4 * sc + Math.cos(a) * 11 * sc, tz + 3.1 * sc)
      blade.rotation.z = -a
      blade.castShadow = true
      g.add(blade)
      // 叶片中部细带 + 叶尖红条
      const bandN = new THREE.Mesh(new THREE.BoxGeometry(1.02 * sc, 1.4 * sc, 0.26 * sc), M.aluPanel)
      bandN.position.set(tx + Math.sin(a) * 13 * sc, ny + 0.4 * sc + Math.cos(a) * 13 * sc, tz + 3.1 * sc)
      bandN.rotation.z = -a
      g.add(bandN)
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.02 * sc, 2.2 * sc, 0.26 * sc), M.paintRed)
      tip.position.set(tx + Math.sin(a) * 20.6 * sc, ny + 0.4 * sc + Math.cos(a) * 20.6 * sc, tz + 3.1 * sc)
      tip.rotation.z = -a
      g.add(tip)
    }
    // 塔身检修平台 + 爬梯 + 航标灯
    cyl(1.6 * sc, 1.6 * sc, 0.16, M.brightSilver, tx, ny - 2.4 * sc, tz, 14, g)
    for (let k = 0; k < 16; k++) box(0.24 * sc, 0.04, 0.04, M.aluDark, tx + 1.72 * sc, 2.4 + k * 2.0 * sc, tz, g)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M.paintRed)
    add(lamp, tx, ny + 1.8 * sc, tz, g)
  }

  // 升压站：主变 + 构架 + 开关柜室
  box(9, 5, 6.4, M.plasterGrey, -16, 2.5, -19, g)
  box(9.6, 0.4, 7.0, M.aluPanel, -16, 5.2, -19, g)
  box(9.2, 0.9, 6.6, M.whiteStone, -16, 0.45, -19, g)
  win(g, -16, 3.4, -15.78, Math.PI, 4.0, 1.8, { glass: M.glTeal, frame: M.aluDark, mull: 2 })
  win(g, -11.4, 3.4, -19, Math.PI / 2, 3.0, 1.8, { glass: M.glTeal, frame: M.aluDark, mull: 2 })
  box(2.0, 2.4, 0.2, M.aluDark, -16, 1.2, -15.8, g)
  // 主变压器（带散热片与套管）
  box(3.0, 2.4, 2.4, M.aluPanel, -20.0, 1.2, -12.0, g)
  for (const sxx of [-1, 1]) for (let k = 0; k < 4; k++) {
    box(0.1, 1.8, 0.16, M.aluDark, -20.0 + sxx * 1.6, 1.3, -13.0 + k * 0.66, g)
  }
  for (const ox of [-0.8, 0, 0.8]) {
    cyl(0.1, 0.16, 1.4, M.glazeWhite, -20.0 + ox, 3.0, -12.0, 8, g)
    cyl(0.22, 0.22, 0.1, M.bronze, -20.0 + ox, 3.7, -12.0, 8, g)
  }
  // 构架（门形钢架 + 母线）
  for (const ox of [-22.0, -18.0]) {
    for (const oz of [-8.0, -5.0]) {
      cyl(0.16, 0.16, 6.0, M.brightSilver, ox, 3.0, oz, 8, g)
      box(4.0, 0.2, 0.2, M.brightSilver, ox + 2.0, 6.0, oz, g)
    }
  }
  for (const ox of [-18.0, -22.0]) box(0.24, 0.24, 3.2, M.brightSilver, ox, 6.0, -6.5, g)
  for (let i = 0; i < 3; i++) {
    cyl(0.07, 0.07, 3.0, M.glazeWhite, -21.0 + i * 1.0, 4.5, -6.5, 6, g)
    cyl(0.26, 0.26, 0.08, M.bronze, -21.0 + i * 1.0, 6.0, -6.5, 8, g)
  }
  // 开关柜室（3 个集装箱式柜体）
  for (let i = 0; i < 3; i++) {
    box(3.0, 2.2, 2.4, M.aluPanel, -19 + i * 4.0, 1.1, -3.0, g)
    box(3.1, 0.14, 2.5, M.aluDark, -19 + i * 4.0, 2.24, -3.0, g)
    for (let k = 0; k < 3; k++) box(0.5, 0.6, 0.1, M.glazeWhite, -20.0 + i * 4.0 + k * 1.0, 1.2, -1.86, g)
    for (let k = 0; k < 3; k++) cyl(0.08, 0.14, 1.6, M.glazeWhite, -20 + i * 4.0 + k * 1.0, 3.0, -1.8, 8, g)
  }
  // 场地围栏 + 大门
  for (let i = 0; i < 20; i++) {
    box(0.1, 1.8, 0.1, M.aluDark, -20 + i * 2.1, 0.9, -21.0, g)
    box(0.1, 1.8, 0.1, M.aluDark, -20 + i * 2.1, 0.9, 20.0, g)
  }
  for (let i = 0; i < 21; i++) box(0.1, 1.8, 0.1, M.aluDark, -20.8, 0.9, -20 + i * 2.0, g)
  box(42, 0.08, 0.08, M.aluDark, 0, 1.78, -21.0, g)
  box(42, 0.08, 0.08, M.aluDark, 0, 1.78, 20.0, g)
  for (const sx of [-1, 1]) box(0.34, 2.4, 0.34, M.aluDark, sx * 3.2, 1.2, 20.0, g)
  box(6.0, 0.16, 0.16, M.paintRed, 0, 1.9, 19.8, g)
  // 标识牌 + 塔号
  box(3.0, 1.6, 0.12, M.paintBlue, -3.0, 2.0, 19.4, g)
  box(2.4, 0.2, 0.08, M.glazeWhite, -3.0, 2.4, 19.32, g)
  // 草地灌木丛（低多边形，避免大片空灰）
  for (let i = 0; i < 22; i++) {
    bushAt(g, -19 + (i % 11) * 3.6, (i > 10 ? -18.5 : 17.6), 0.42 + (i % 3) * 0.12)
  }
  for (const [bx, bz] of [[-6, -16], [6, 8], [-2, 16], [18, -2]]) treeAt(g, bx, bz, 0.8, 3.0, 'column')
  return { g, top: 62 }
}

/** 134 太阳能电站（光伏阵列 + 逆变器 + 监控室） */
function t134(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 42, M.concrete, 3.4, 'x')
  // 光伏阵列（6 排 × 5 组，倾斜支架）
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 5; c++) {
      const px = -16 + c * 8.0
      const pz = -16 + r * 6.4
      // 支架
      for (const sx of [-1, 1]) {
        cyl(0.12, 0.14, 2.6, M.brightSilver, px + sx * 3.0, 1.3, pz + 1.2, 6, g)
        cyl(0.1, 0.12, 1.9, M.brightSilver, px + sx * 3.0, 0.95, pz - 1.2, 6, g)
      }
      // 面板（倾斜）
      const panel = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.14, 3.4), M.glDeepBlue)
      panel.position.set(px, 2.05, pz)
      panel.rotation.x = -0.36
      panel.castShadow = panel.receiveShadow = true
      g.add(panel)
      // 边框 + 分格
      box(6.8, 0.1, 3.6, M.aluPanel, px, 2.0, pz, g).rotation.x = -0.36
      for (let k = 1; k < 4; k++) box(0.06, 0.16, 3.4, M.aluPanel, px - 3.3 + k * 1.65, 2.08, pz, g).rotation.x = -0.36
      box(0.06, 0.16, 3.4, M.aluPanel, px + 3.3, 2.08, pz, g).rotation.x = -0.36
      // 逆变器（每组一台）
      if (c % 2 === 0) box(1.0, 1.4, 0.5, M.glazeWhite, px + 3.0, 0.7, pz + 2.4, g)
    }
  }
  // 监控室 + 升压变 + 围栏
  box(9, 4.6, 6, M.plasterGrey, -15, 2.3, 17, g)
  box(9.6, 0.4, 6.6, M.aluPanel, -15, 4.7, 17, g)
  win(g, -15, 2.8, 20.06, 0, 4.0, 1.8, { glass: M.glTeal, frame: M.aluDark, mull: 3 })
  box(2.4, 2.6, 0.2, M.aluDark, -11.2, 1.3, 20.06, g)
  for (let i = 0; i < 2; i++) {
    box(3.4, 2.6, 2.6, M.aluPanel, 6 + i * 5.0, 1.3, 17, g)
    for (let k = 0; k < 3; k++) cyl(0.08, 0.14, 1.8, M.glazeWhite, 4.6 + i * 5.0 + k * 1.0, 3.4, 17, 8, g)
  }
  // 场地围栏 + 检修道
  for (const sz of [-1, 1]) {
    box(40, 0.06, 2.0, M.concrete, 0, 0.04, sz * 19.5, g)
    for (let i = 0; i < 21; i++) cyl(0.06, 0.06, 1.6, M.aluPanel, -20 + i * 2.0, 0.8, sz * 20.6, 5, g)
    for (let i = 0; i < 2; i++) box(40.4, 0.05, 0.05, M.aluPanel, 0, 0.9 + i * 0.6, sz * 20.6, g)
  }
  for (let i = 0; i < 6; i++) treeAt(g, -19 + i * 7.6, 20.4, 0.7, 2.4)
  return { g, top: 6 }
}

/** 135 垃圾焚烧厂（焚烧车间 + 大烟囱 + 卸料大厅） */
function t135(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 42, 42, M.concrete, 3.0, 'x')
  // 焚烧主厂房（大跨 + 弧形屋面）
  box(30, 24, 18, M.plasterGrey, 0, 12, -4, g)
  const arc = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.4, 30, 22, 1, true, 0, Math.PI), M.aluPanel)
  arc.rotation.z = Math.PI / 2
  arc.position.set(0, 24, -4)
  arc.castShadow = true
  g.add(arc)
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(9.4, 0.24, 5, 18, Math.PI), M.aluDark)
    rib.rotation.y = Math.PI / 2
    rib.position.set(-15 + i * 6, 24, -4)
    g.add(rib)
  }
  // 玻璃幕墙带 + 竖向色带
  for (let i = 0; i < 3; i++) gridGlass(g, 0, 15.0, 5.06, 0, 26, 8.0, 10, 3, { glass: M.glTeal, frame: M.aluDark })
  for (const sx of [-1, 1]) gridGlass(g, sx * 15.06, 12, -4, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 14, 16, 5, 4, { glass: M.glSmoke, frame: M.aluDark })
  box(31, 1.0, 19, M.aluPanel, 0, 24.4, -4, g)
  // 卸料大厅（大卷帘门 + 坡道）
  box(20, 12, 9, M.plasterGrey, 0, 6, 12.5, g)
  box(20.6, 0.6, 9.6, M.aluPanel, 0, 12.3, 12.5, g)
  for (let i = 0; i < 3; i++) {
    box(5.0, 7.0, 0.3, M.aluDark, -6 + i * 6, 3.5, 17.1, g)
    for (let k = 0; k < 9; k++) box(4.8, 0.12, 0.4, M.aluPanel, -6 + i * 6, 0.4 + k * 0.72, 17.15, g)
  }
  for (let i = 0; i < 4; i++) box(14, 0.5, 3.0, M.concrete, 0, 0.25 + i * 0.5, 18 + i * 1.4, g)
  railing(g, 14, 2.3, 18.3, M.paintYell, 8, 1.0)
  // 大烟囱
  const chH = 62
  cyl(3.0, 4.0, chH, M.plasterGrey, 12, chH / 2, -14, 20, g)
  for (let i = 0; i < 4; i++) cyl(3.2 + i * 0.12, 3.4 + i * 0.12, 3.0, M.glazeWhite, 12, 46 + i * 5.0, -14, 20, g)
  cyl(3.5, 3.5, 1.2, M.aluDark, 12, chH + 0.6, -14, 20, g)
  cyl(1.2, 1.2, 2.4, M.charcoal, 12, chH + 2.2, -14, 12, g)
  // 汽轮机房（侧）
  box(14, 10, 11, M.plasterGrey, -13, 5, -19, g)
  box(14.6, 0.5, 11.6, M.aluPanel, -13, 10.3, -19, g)
  for (let i = 0; i < 4; i++) box(3.0, 2.0, 0.2, M.glTeal, -18 + i * 3.4, 8.2, -13.44, g)
  // 臭气处理 + 管道 + 场地
  cyl(1.6, 1.8, 9, M.aluPanel, -18, 4.5, 8, 14, g)
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 16, 12), M.brightSilver)
  pipe.rotation.z = Math.PI / 2
  add(pipe, -8, 8.0, 5.0, g)
  for (const sz of [-1, 1]) hedge(g, 0, sz * 20.5, 40, true, 1.2, 1.0)
  for (let i = 0; i < 5; i++) treeAt(g, -18 + i * 9, 20.4, 0.85, 3.0)
  for (const [lx, lz] of [[-19, 14], [19, 14], [-19, 0], [19, 0]]) lampPost(g, lx, lz, 8.0, 0)
  return { g, top: 66 }
}

/** 136 城市广场（方尖碑 + 镜面水池 + 柱廊 + 旗阵） */
function t136(x, z) {
  const g = group(x, z, 0)
  paved(g, 0, 0, 44, 44, M.paving, 2.6, 'x')
  // 中央圆形铺装
  cyl(15, 15.2, 0.14, M.whiteStone, 0, 0.07, 0, 40, g)
  cyl(13.6, 13.6, 0.06, M.tuff, 0, 0.15, 0, 40, g)
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    box(0.16, 0.02, 2.4, M.paving, Math.cos(a) * 14.3, 0.18, Math.sin(a) * 14.3, g).rotation.y = -a
  }
  // 方尖碑
  cyl(3.4, 4.0, 0.9, M.whiteStone, 0, 0.45, 0, 4, g).rotation.y = Math.PI / 4
  cyl(2.6, 3.2, 0.7, M.tuff, 0, 1.25, 0, 4, g).rotation.y = Math.PI / 4
  const obH = 26
  const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.9, obH, 4), M.whiteStone)
  ob.rotation.y = Math.PI / 4
  ob.castShadow = true
  add(ob, 0, 1.6 + obH / 2, 0, g)
  // 碑身竖向凹槽 + 铭牌
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    box(0.12, obH * 0.9, 0.5, M.tuff, Math.cos(a) * 1.5, 1.6 + obH * 0.5, Math.sin(a) * 1.5, g).rotation.y = -a
  }
  box(1.4, 2.2, 0.12, M.bronze, 0, 4.4, 1.65, g)
  for (let i = 0; i < 6; i++) box(1.0, 0.06, 0.05, M.gold, 0, 3.6 + i * 0.3, 1.72, g)
  // 碑顶金尖
  const capTip = new THREE.Mesh(new THREE.ConeGeometry(1.45, 4.2, 4), M.gold)
  capTip.rotation.y = Math.PI / 4
  capTip.castShadow = true
  add(capTip, 0, 1.6 + obH + 2.1, 0, g)
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), M.gold)
  add(orb, 0, 1.6 + obH + 4.6, 0, g)
  // 四组镜面水池
  for (const [px, pz] of [[-11, 11], [11, 11], [-11, -11], [11, -11]]) {
    box(7.0, 0.5, 4.4, M.whiteStone, px, 0.25, pz, g)
    box(6.0, 0.1, 3.4, M.glTeal, px, 0.53, pz, g)
    for (let k = 0; k < 3; k++) {
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.6 + k * 0.5, 8), M.glazeWhite)
      add(jet, px - 1.6 + k * 1.6, 1.3 + k * 0.25, pz, g)
    }
  }
  // 弧形柱廊（北侧）
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7
    const cx = Math.cos(a) * 17.5
    const cz = -Math.sin(a) * 17.5
    cyl(0.42, 0.46, 6.4, M.whiteStone, cx, 3.2, cz, 12, g)
    cyl(0.56, 0.56, 0.3, M.tuff, cx, 0.15, cz, 12, g)
    cyl(0.6, 0.6, 0.4, M.whiteStone, cx, 6.4, cz, 12, g)
  }
  const ent = new THREE.Mesh(new THREE.TorusGeometry(17.5, 0.7, 6, 20, Math.PI * 0.7), M.whiteStone)
  ent.rotation.x = Math.PI / 2
  ent.rotation.z = Math.PI * 0.15
  ent.position.y = 6.8
  g.add(ent)
  box(26, 1.0, 3.0, M.whiteStone, 0, 8.2, -17.0, g).rotation.y = 0
  // 旗阵
  for (let i = 0; i < 5; i++) {
    cyl(0.09, 0.12, 9.0, M.brightSilver, -8 + i * 4.0, 4.5, 16.5, 8, g)
    box(1.8, 1.1, 0.06, [M.paintRed, M.paintBlue, M.paintYell, M.glTeal, M.paintRed][i], -8 + i * 4.0 + 0.9, 8.2, 16.5, g)
  }
  // 长椅 + 树 + 灯
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4
    benchAt(g, Math.cos(a) * 16.5, Math.sin(a) * 16.5, -a + Math.PI / 2)
  }
  for (let i = 0; i < 4; i++) treeAt(g, [-19, 19, -19, 19][i], [19, 19, -19, -19][i], 0.95, 3.4)
  for (const [lx, lz] of [[-16, 0], [16, 0], [0, -16], [0, 16]]) lampPost(g, lx, lz, 7.0, 0)
  return { g, top: 32 }
}

const COLS = 8
const SP_X = 62
const SP_Z = 66
// 单块地盘半径（圆形铺装）；跨格地块改用矩形铺装
const PAD_R = 20.5

// 新街区（商场 / 桥梁 / 高架 / 超高层 / 住宅 / 停车 / 轻轨 / 公园 / 路网）
const DK = makeDistrict({
  scene, M, box, cyl, cone, add, group, win, gridGlass, paved, treeAt, bushAt, hedge,
  planter, lampPost, benchAt, carAt, steps, railing, parapet,
})

const items = [
  // 一 · 玻璃幕墙
  { n: 1, name: '圆柱收分', mat: '蓝灰玻璃 + 钛银竖梃', fn: (x, z) => t01(x, z, S(M.glBlue, M.whiteStone)) },
  { n: 2, name: '椭圆截面', mat: '紫罗兰玻璃 + 香槟金', fn: (x, z) => t02(x, z, S(M.glViolet, M.limestone, { mullion: M.gold, band: M.gold, crown: M.gold, dome: M.glIce })) },
  { n: 3, name: '扭转塔', mat: '墨绿玻璃 + 深灰铝板', fn: (x, z) => t03(x, z, S(M.glGreen, M.aluDark, { mullion: M.darkTi, band: M.darkTi })) },
  { n: 4, name: '三角棱柱', mat: '琥珀玻璃 + 铜饰', fn: (x, z) => t04(x, z, S(M.glAmber, M.terra, { mullion: M.copper, band: M.copper, crown: M.copper })) },
  { n: 5, name: '六边形塔', mat: '玫瑰金玻璃 + 白石', fn: (x, z) => t05(x, z, S(M.glRose, M.whiteStone, { mullion: M.gold, band: M.gold, crown: M.gold })) },
  { n: 6, name: '鼓形膨胀筒', mat: '蓝绿玻璃 + 白铝', fn: (x, z) => t06(x, z, S(M.glBlueGreen, M.aluPanel, { mullion: M.brightSilver, band: M.brightSilver, crown: M.brightSilver })) },

  // 二 · 实墙开窗
  { n: 7, name: '石材打孔窗', mat: '米黄石材 + 凹窗洞', fn: t07 },
  { n: 8, name: '红砖小窗', mat: '红砖 + 阳台板', fn: t08 },
  { n: 9, name: '清水混凝土', mat: '木模板缝 + 螺栓孔', fn: t09 },
  { n: 10, name: '铝板横向条窗', mat: '氟碳铝板 + 连续窗带', fn: t10 },
  { n: 11, name: '搪瓷钢板', mat: '三色搪瓷 + 条窗', fn: t11 },
  { n: 12, name: '耐候钢锈面', mat: '锈蚀钢 + 铜条 + 窄缝', fn: t12 },

  // 三 · 遮阳表皮
  { n: 13, name: '陶土百叶筒', mat: '陶土竖鳍 + 内层玻璃', fn: t13 },
  { n: 14, name: '木格栅塔', mat: '木鳍 + 玻璃 + 木挑板', fn: t14 },
  { n: 15, name: '穿孔铝包皮', mat: '穿孔铝 + 内层玻璃', fn: t15 },
  { n: 16, name: '砖镂空屏', mat: '菱形镂空砖 + 玻璃', fn: t16 },
  { n: 17, name: '绿植退台', mat: '玻璃 + 花池 + 绿植', fn: t17 },
  { n: 18, name: '幻彩不锈钢', mat: '幻彩板 + 窄窗', fn: t18 },

  // 四 · 特殊造型
  { n: 19, name: '四棱锥收尖', mat: '白玻璃 + 银棱', fn: t19 },
  { n: 20, name: '斜交网格塔', mat: '外露钢网格 + 玻璃', fn: t20 },
  { n: 21, name: '螺旋错层塔', mat: '银白玻璃 + 错位圆盘', fn: t21 },
  { n: 22, name: '顶部开洞', mat: '深海蓝玻璃 + 环形冠', fn: t22 },
  { n: 23, name: '双塔连桥', mat: '玫瑰金玻璃 + 金饰', fn: t23 },
  { n: 24, name: '错位悬挑筒', mat: '墨绿玻璃 + 挑檐', fn: t24 },

  // 五 · 新增工艺
  { n: 25, name: '釉面陶瓷腰鼓塔', mat: '深蓝釉面陶瓷 + 玻璃凹槽', fn: t25 },
  { n: 26, name: '空心砌块屏塔', mat: '混凝土砌块镂空 + 暖光缝', fn: t26 },
  { n: 27, name: '渐变阳极氧化塔', mat: '阳极氧化渐变铝 + 深蓝玻璃', fn: t27 },
  { n: 28, name: '石板叠涩塔', mat: '深灰石板薄片 + 大理石边', fn: t28 },
  { n: 29, name: '白瓷百叶塔', mat: '白釉陶瓷鳍 + 蓝绿玻璃', fn: t29 },
  { n: 30, name: '金属网罩塔', mat: '深色金属网 + 暖光内胆', fn: t30 },

  // 六 · 日常与公共建筑
  { n: 31, name: '白灰联排住宅', mat: '白灰抹面 + 陶瓦坡顶', fn: t31 },
  { n: 32, name: '半木构坡顶宅', mat: '深色木构架 + 灰泥 + 红陶瓦', fn: t32 },
  { n: 33, name: '夯土民居', mat: '夯土层带 + 出挑木梁', fn: t33 },
  { n: 34, name: '波纹铁皮仓库', mat: '镀锌铁皮 + 卷帘门', fn: t34 },
  { n: 35, name: '清水混凝土美术馆', mat: '木模板混凝土 + 长缝窗', fn: t35 },
  { n: 36, name: '白色现代主义别墅', mat: '白抹灰 + 带形窗 + 架空柱', fn: t36 },
  { n: 37, name: '石造哥特教堂', mat: '凝灰岩 + 尖拱彩窗 + 石板顶', fn: t37 },
  { n: 38, name: '清真寺', mat: '石灰岩 + 蓝白瓷砖 + 宣礼塔', fn: t38 },
  { n: 39, name: '砖砌钟楼市政厅', mat: '红砖 + 白石线脚 + 铜绿屋面', fn: t39 },
  { n: 40, name: '玻璃砖温室', mat: '玻璃砖 + 黑色钢框 + 筒拱', fn: t40 },
  { n: 41, name: '木瓦山墙礼拜堂', mat: '深色木瓦 + 尖塔 + 拱窗', fn: t41 },
  { n: 42, name: '茅草屋顶小屋', mat: '茅草顶 + 白灰墙 + 绿百叶', fn: t42 },
  { n: 43, name: '集装箱公寓', mat: '彩色波纹箱体 + 钢楼梯', fn: t43 },
  { n: 44, name: '立体车库', mat: '清水混凝土板 + 横向挡板', fn: t44 },
  { n: 45, name: '老式砖砌公寓', mat: '红砖 + 白石窗套 + 消防梯', fn: t45 },
  { n: 46, name: '拱廊市集', mat: '砖拱券 + 玻璃拱顶 + 彩棚', fn: t46 },
  { n: 47, name: '日式町屋', mat: '烧杉板格子 + 深檐 + 灰瓦', fn: t47 },
  { n: 48, name: '徽派民居', mat: '白墙 + 黑瓦马头墙', fn: t48 },
  { n: 49, name: '石材体量塔', mat: '凝灰岩分层 + 马赛克入口', fn: t49 },
  { n: 50, name: '水塔', mat: '混凝土支腿 + 波纹钢水箱', fn: t50 },
  { n: 51, name: '灯塔', mat: '白抹灰 + 红色环带 + 灯室', fn: t51 },
  { n: 52, name: '粮仓筒仓', mat: '镀锌钢筒 + 锥形顶', fn: t52 },
  { n: 53, name: '砖砌学校', mat: '红砖 + 白石窗套 + 外廊', fn: t53 },
  { n: 54, name: '多厅影城', mat: '石材裙房 + 玻璃中庭 + IMAX 圆厅 + 巨幕招牌', fn: t54, sw: 2, sd: 2 },

  // 七 · 住宅与社区
  { n: 55, name: '板式高层住宅', mat: '暖白抹灰 + 挑出阳台', fn: t55 },
  { n: 56, name: '点式住宅塔', mat: '环形阳台 + 落地窗带', fn: t56 },
  { n: 57, name: '小区行列式住宅', mat: '浅灰抹灰 + 阳台 + 围墙门楼', fn: t57 },
  { n: 58, name: '独栋别墅庄园', mat: '主楼 + 泳池 + 车库 + 院墙 + 花园', fn: t58, sw: 2, sd: 2 },
  { n: 59, name: '三进四合院', mat: '宅门影壁 + 垂花门 + 抄手游廊', fn: t59, sw: 2, sd: 2 },

  // 八 · 体育与演艺
  { n: 60, name: '圆形体育场', mat: '清水混凝土看台 + 环形钢挑檐', fn: t60, sw: 3, sd: 3, k: 1.32 },
  { n: 61, name: '室内体育馆', mat: '混凝土墙 + 膜结构筒拱 + 看台', fn: t61, sw: 2, sd: 2, k: 1.3 },
  { n: 62, name: '演唱会场馆', mat: '完整椭圆碗约 6 万席 + 端舞台巨屏 + 环膜挑檐', fn: t62, sw: 5, sd: 5, k: 1.1 },

  // 九 · 文教与政务
  { n: 63, name: '市图书馆', mat: '石砌书库 + 玻璃阅览厅 + 柱廊', fn: t63, sw: 2, sd: 2 },
  { n: 64, name: '博物馆', mat: '古典柱廊 + 悬挑玻璃新馆', fn: t64 },
  { n: 65, name: '大学教学楼', mat: '红砖 + 石线脚 + 拱廊庭院', fn: t65 },
  { n: 66, name: '综合医院', mat: '门诊裙房 + 住院塔 + 急诊 + 停机坪', fn: t66, sw: 2, sd: 2 },
  { n: 67, name: '消防站', mat: '红砖 + 卷帘车库 + 训练塔', fn: t67 },
  { n: 68, name: '政府办公楼', mat: '白色石材 + 柱廊 + 广场旗杆', fn: t68 },
  { n: 69, name: '法院', mat: '巨柱柱廊 + 山花 + 穹顶 + 广场', fn: t69, sw: 2, sd: 2, k: 1.1 },
  { n: 70, name: '小市政厅', mat: '暖白抹灰 + 钟塔 + 铜绿尖顶', fn: t70 },
  { n: 71, name: '银行大楼', mat: '石材基座 + 青铜玻璃 + 金线', fn: t71 },

  // 十 · 宗教建筑
  { n: 72, name: '佛寺建筑群', mat: '山门 + 钟鼓楼 + 重檐大雄宝殿', fn: t72, sw: 2, sd: 2 },
  { n: 73, name: '七级佛塔', mat: '白灰塔身 + 层层出檐 + 塔刹', fn: t73 },
  { n: 74, name: '孔庙', mat: '红墙 + 牌坊 + 黄瓦大成殿', fn: t74 },
  { n: 75, name: '哥特式主教座堂', mat: '双塔 + 飞扶壁 + 玫瑰窗 + 后殿', fn: t75, sw: 2, sd: 2, k: 1.12 },
  { n: 76, name: '东正教堂', mat: '暖白灰 + 金色洋葱顶', fn: t76 },
  { n: 77, name: '乡村礼拜堂', mat: '白灰墙 + 石板顶 + 钟架', fn: t77 },
  { n: 78, name: '犹太会堂', mat: '凝灰岩 + 高拱窗 + 玫瑰窗', fn: t78 },
  { n: 79, name: '印度教神庙', mat: '砂岩阶梯塔 + 金色宝瓶', fn: t79 },

  // 十一 · 交通与市政
  { n: 80, name: '加油站', mat: '白罩棚 + 红招牌 + 便利店', fn: t80 },
  { n: 81, name: '超市大卖场', mat: '大盒卖场 + 入口门斗 + 停车场', fn: t81, sw: 2, sd: 2, k: 1.12 },
  { n: 82, name: '小学', mat: '彩色教学楼 + 体育馆 + 200m 跑道', fn: t82, sw: 3, sd: 2, k: 1.1 },
  { n: 83, name: '幼儿园', mat: '三色体块 + 滑梯 + 围栏', fn: t83 },
  { n: 84, name: '游泳馆', mat: '膜结构筒拱 + 50m 泳池 + 跳台', fn: t84, sw: 2, sd: 2 },
  { n: 85, name: '火车站', mat: '红砖站房 + 钟塔 + 玻璃站台棚', fn: t85, sw: 3, sd: 2, k: 1.22 },
  { n: 86, name: '地铁站入口', mat: '玻璃亭 + 不锈钢栏杆 + 标志柱', fn: t86 },
  { n: 87, name: '汽车站', mat: '候车厅 + 膜雨棚 + 大巴', fn: t87 },
  { n: 88, name: '机场航站楼', mat: '金属板 + 筒拱屋面 + 塔台', fn: t88, sw: 3, sd: 2, k: 1.3 },
  { n: 89, name: '电视塔', mat: '混凝土塔身 + 观光球舱 + 桅杆', fn: t89 },
  { n: 90, name: '摩天轮', mat: '钢轮圈 + 观景舱 + 站房', fn: t90, sw: 2, sd: 2 },

  // 十二 · 超高层与城市设施
  { n: 91, name: '双子塔', mat: '深海蓝幕墙 + 白石角柱 + 连桥', fn: t91 },
  { n: 92, name: '螺旋观景塔', mat: '紫罗兰玻璃 + 白色挑檐鳍', fn: t92 },
  { n: 93, name: '板式办公塔', mat: '铝板 + 横向条窗 + 光伏屋面', fn: t93 },
  { n: 94, name: '城市综合体', mat: '石材商场 + 香槟酒店塔', fn: t94, sw: 2, sd: 1 },
  { n: 95, name: '通信铁塔', mat: '角钢格构 + 基站天线', fn: t95 },
  { n: 96, name: '数据中心', mat: '铝合金无窗机房 + 冷却机组', fn: t96 },
  { n: 97, name: '变电站', mat: '门型构架 + 主变 + 绝缘子', fn: t97 },
  { n: 98, name: '自来水厂', mat: '沉淀池 + 泵房 + 水塔', fn: t98 },
  { n: 99, name: '垃圾转运站', mat: '大跨车间 + 压缩装箱', fn: t99 },
  { n: 100, name: '公交枢纽', mat: '膜结构雨棚 + 玻璃候车厅', fn: t100 },
  { n: 101, name: '社区服务中心', mat: '涂料墙面 + 通高门厅', fn: t101 },
  { n: 102, name: '高架立交', mat: '混凝土箱梁 + 匝道 + 隔音屏', fn: t102, sw: 3, sd: 2, k: 1.18 },

  // 十三 · 异型结构
  { n: 103, name: '子弹头塔', mat: '双曲面收尖 + 螺旋光带', fn: t103 },
  { n: 104, name: '倾斜塔', mat: '逐层外倾 + 斜柱 + 观景台', fn: t104 },
  { n: 105, name: '门洞塔', mat: '双塔悬挑对接 + 斜交网格', fn: t105, sw: 2, sd: 1 },
  { n: 106, name: 'V 形双塔', mat: '向外张开 + 三道连桥', fn: t106, sw: 2, sd: 1 },
  { n: 107, name: '三瓣花瓣塔', mat: '三个曲面瓣体 + 核心筒', fn: t107 },
  { n: 108, name: '刀片塔', mat: '极薄板式 + 楔形收尖', fn: t108 },
  { n: 109, name: '分叉巨柱塔', mat: '树状斜柱 + 架空悬挑', fn: t109 },
  { n: 110, name: '折纸塔', mat: '三角折面逐段旋转 60°', fn: t110 },
  { n: 111, name: '积木堆叠塔', mat: '错位外挑体块 + 外露钢柱', fn: t111 },
  { n: 112, name: '卵形倾斜体', mat: '斜置椭球 + 玻璃鳞片环带', fn: t112 },
  { n: 113, name: '竹节三角塔', mat: '三角节段收分 + X 斜撑', fn: t113 },
  { n: 114, name: '双曲面塔', mat: '腰部内收曲面 + 顶部平台', fn: t114 },

  // 十四 · 文化教育设施
  { n: 115, name: '歌剧院', mat: '三片壳体帆顶 + 亲水平台', fn: t115, sw: 2, sd: 2, k: 1.18 },
  { n: 116, name: '会展中心', mat: '三跨钢桁架 + 玻璃通廊', fn: t116, sw: 3, sd: 2, k: 1.15 },
  { n: 117, name: '当代美术馆', mat: '错位悬挑白盒 + 玻璃基座', fn: t117 },
  { n: 118, name: '高层公寓塔', mat: '40 层叠落阳台 + 空中花园', fn: t118 },
  { n: 119, name: '庭院式办公园', mat: '四栋围合 + 中庭水院', fn: t119 },
  { n: 120, name: '邮政大楼', mat: '石材壁柱 + 钟塔 + 骑楼', fn: t120 },
  { n: 121, name: '农贸市场', mat: '钢桁架大厅 + 摊位棚', fn: t121 },
  { n: 122, name: '商业步行街', mat: '两排店铺 + 遮阳连廊', fn: t122, sw: 2, sd: 1 },
  { n: 123, name: '五星酒店', mat: '石材裙房 + 香槟塔 + 屋顶泳池', fn: t123 },
  { n: 124, name: '养老院', mat: '三栋围合 + 外廊 + 疗养花园', fn: t124 },
  { n: 125, name: '溜冰馆', mat: '拱壳屋面 + 冰场看台', fn: t125 },

  // 十五 · 交通与工业设施
  { n: 126, name: '高速服务区', mat: '餐厅 + 加油站 + 大车停靠', fn: t126 },
  { n: 127, name: '收费站', mat: '六车道 + ETC 门架 + 管理楼', fn: t127 },
  { n: 128, name: '人行天桥', mat: '跨路连廊 + 楼梯 + 电梯', fn: t128 },
  { n: 129, name: '地铁高架站', mat: '站台雨棚 + 天桥 + 站房', fn: t129 },
  { n: 130, name: '集装箱码头', mat: '岸桥 + 堆场 + 货轮', fn: t130, sw: 3, sd: 2, k: 1.2 },
  { n: 131, name: '污水处理厂', mat: '沉淀池 + 曝气池 + 中控楼', fn: t131 },
  { n: 132, name: '火电厂', mat: '双曲冷却塔 + 烟囱 + 汽机房', fn: t132, sw: 2, sd: 2, k: 1.18 },
  { n: 133, name: '风力发电场', mat: '三台风机 + 升压站', fn: t133 },
  { n: 134, name: '太阳能电站', mat: '光伏阵列 + 逆变器', fn: t134 },
  { n: 135, name: '垃圾焚烧厂', mat: '弧形车间 + 大烟囱 + 卸料厅', fn: t135 },
  { n: 136, name: '城市广场', mat: '方尖碑 + 镜面水池 + 柱廊', fn: t136 },

  // 十六 · 商业 / 桥梁 / 城市交通
  { n: 137, name: '购物中心', mat: '石材卖场 + 玻璃中庭 + 影院 + 停车楼', fn: DK.t137, sw: 3, sd: 3 },
  { n: 138, name: '斜拉桥', mat: 'A 形主塔 + 扇形斜拉索 + 运河', fn: DK.t138, sw: 3, sd: 1 },
  { n: 139, name: '三孔石拱桥', mat: '石砌拱券 + 望柱栏板 + 垂柳河岸', fn: DK.t139, sw: 2, sd: 1 },
  { n: 140, name: '高架快速路', mat: '双向八车道 + 隔音屏 + 匝道', fn: DK.t140, sw: 2, sd: 1 },
  { n: 141, name: '超高层地标塔', mat: '八边形收分 + 观景平台 + 桅杆', fn: DK.t141, rect: true },
  { n: 142, name: '住宅小区', mat: '四栋塔楼 + 中央花园 + 儿童场', fn: DK.t142, sw: 2, sd: 2 },
  { n: 143, name: '立体停车楼', mat: '五层坡道 + 车位 + 收费亭', fn: DK.t143, rect: true },
  { n: 144, name: '跨街天桥', mat: '玻璃连廊 + 自动扶梯 + 电梯', fn: DK.t144, rect: true },
  { n: 145, name: '轻轨高架', mat: '双线轨道梁 + 列车 + 站房', fn: DK.t145, sw: 2, sd: 1 },
  { n: 146, name: '露天停车场', mat: '车位 + 大巴货车 + 充电桩', fn: DK.t146, rect: true },
  { n: 147, name: '城市公园', mat: '湖面 + 曲桥 + 密林 + 凉亭', fn: DK.t147, sw: 2, sd: 2 },
]

// 排版：按 sw/sd 跨格打包，整块场地再居中
const placed = []
{
  let col = 0
  let row = 0
  let rowSpan = 1
  for (const it of items) {
    const sw = it.sw ?? 1
    const sd = it.sd ?? 1
    if (col + sw > COLS) {
      row += rowSpan
      col = 0
      rowSpan = 1
    }
    placed.push({ it, col, row, sw, sd })
    col += sw
    rowSpan = Math.max(rowSpan, sd)
  }
}
const ROW_UNITS = placed.reduce((m, p) => Math.max(m, p.row + p.sd), 0)

// 地坪
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4400, 4400), M.paving)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
}

function label(text, sub, x, y, z) {
  const el = document.createElement('div')
  el.className = 'tag'
  el.innerHTML = `<b>${text}</b><span>${sub}</span>`
  const obj = new CSS2DObject(el)
  obj.position.set(x, y, z)
  scene.add(obj)
}

const sites = []
for (const { it, col, row, sw, sd } of placed) {
  // 跨格中心按格中心计算；整块场地居中
  const x = (col + sw / 2 - COLS / 2) * SP_X
  const z = (row + sd / 2 - ROW_UNITS / 2) * SP_Z

  if (sw === 1 && sd === 1 && !it.rect) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R, PAD_R + 0.6, 0.5, 56), M.pad)
    pad.position.set(x, -0.05, z)
    pad.receiveShadow = true
    scene.add(pad)
    sites.push({ x, z, circ: true })
  } else {
    // 大场地：矩形铺装 + 路缘石
    const pw = sw * SP_X - 14
    const pd = sd * SP_Z - 14
    const pad = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.5, pd), M.pad)
    pad.position.set(x, -0.05, z)
    pad.receiveShadow = true
    scene.add(pad)
    box(pw + 1.2, 0.42, 0.7, M.curb, 0, 0.16, z + pd / 2 + 0.4, scene)
    box(pw + 1.2, 0.42, 0.7, M.curb, 0, 0.16, z - pd / 2 - 0.4, scene)
    box(0.7, 0.42, pd, M.curb, x - pw / 2 - 0.4, 0.16, z, scene)
    box(0.7, 0.42, pd, M.curb, x + pw / 2 + 0.4, 0.16, z, scene)
    sites.push({ x, z, w: pw, d: pd })
  }

  const r = it.fn(x, z)
  // 体量校正：整体放大到真实尺度（不改变构件间的比例关系）
  if (it.k) {
    r.g.scale.setScalar(it.k)
    r.top = (r.top ?? 40) * it.k
  }
  label(`${String(it.n).padStart(2, '0')} · ${it.name}`, it.mat, x, (r.top ?? 60) + 7, z)
}

// 城市路网 + 车流（画在地块之间的街道里）
DK.addStreets(sites, { COLS, ROW_UNITS, SP_X, SP_Z })

// 南侧大河 + 滨水步道 + 游轮/货轮/渡轮/帆船等
DK.addRiver({
  cx: 0,
  cz: (ROW_UNITS / 2) * SP_Z + 196,
  len: 3400,
  width: 240,
})

// 城市外围树木（借用统一树种库，随机造型与高度）
function tree(x, z, s = 1) {
  const kinds = ['round', 'round', 'conifer', 'column', 'umbrella', 'blossom', 'willow']
  const k = kinds[(hash2(x, z) * kinds.length) | 0]
  treeAt(scene, x, z, s * 1.15, 3.8, k)
}
// 外围绿化带：沿建筑群外缘排一圈
{
  const zEdge = (ROW_UNITS / 2) * SP_Z + 34
  const xEdge = (COLS / 2) * SP_X + 28
  // 绿化带改成两排错位的树，前后高矮不同
  for (let i = 0; i < 22; i++) {
    const px = -xEdge + i * ((xEdge * 2) / 21)
    tree(px, -zEdge, 0.95)
    tree(px + 8, -zEdge - 13, 0.8)
    tree(px, zEdge, 0.95)
    tree(px + 8, zEdge + 13, 0.8)
  }
  for (let i = 1; i < 10; i++) {
    tree(-xEdge, -zEdge + i * ((zEdge * 2) / 10), 0.85)
    tree(xEdge, -zEdge + i * ((zEdge * 2) / 10), 0.85)
    tree(-xEdge - 13, -zEdge + i * ((zEdge * 2) / 10) + 6, 0.75)
    tree(xEdge + 13, -zEdge + i * ((zEdge * 2) / 10) + 6, 0.75)
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  labelRenderer.setSize(innerWidth, innerHeight)
})

function tick(now = performance.now()) {
  requestAnimationFrame(tick)
  const dt = Math.min(0.05, (now - lastFrame) / 1000)
  lastFrame = now
  if (!roam || !roam.update(dt)) controls.update()
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}
let lastFrame = performance.now()
// ============================================================
//  静态合批：把成千上万个竖梃/鳍片/窗洞按材质合并成少数几个 Mesh
//  场景只有相机在动，合批后 draw call 从 ~2500 降到几十，
//  这是"动起来卡"的根本解法（不是材质太重）。
// ============================================================
let mergeStats = null
function mergeStaticMeshes(worldReady = false) {
  // 世界矩阵在 collectSolids 里已经算过一次，这里不必重复遍历整棵树
  if (!worldReady) scene.updateMatrixWorld(true)
  const buckets = new Map()
  // 共享单位几何体（盒 / 圆柱 / 圆锥）直接走实例化：
  // 一个材质一个 InstancedMesh，完全不用 clone / 复制顶点。
  // 这比"逐个烘焙矩阵再拼接"快一个数量级（实测 merge 2.6s → 0.1s）。
  const instBuckets = new Map()
  const victims = []
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return
    if (o.userData.noMerge) return
    if (Array.isArray(o.material) || !o.geometry?.attributes?.position) return
    if (SHARED_GEO.has(o.geometry)) {
      const key = o.geometry.uuid + '|' + o.material.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0)
      let b = instBuckets.get(key)
      if (!b) {
        b = { geometry: o.geometry, material: o.material, cast: o.castShadow, receive: o.receiveShadow, mats: [] }
        instBuckets.set(key, b)
      }
      b.mats.push(o.matrixWorld.elements.slice())
      victims.push(o)
      return
    }
    const key = [o.material.uuid, o.geometry.index ? 'i' : 'n', o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0].join('|')
    let b = buckets.get(key)
    if (!b) {
      b = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] }
      buckets.set(key, b)
    }
    const g = o.geometry.clone()
    g.applyMatrix4(o.matrixWorld)
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
    }
    if (!g.attributes.uv) {
      const n = g.attributes.position.count
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    }
    g.clearGroups()
    b.geos.push(g)
    victims.push(o)
  })

  // 注意：不能逐个 removeFromParent()。Object3D.remove 内部是 indexOf + splice，
  // 上万个同级构件就是 O(n²)，实测单这一步就要 0.5s。改为按父节点一次性过滤。
  {
    const victimSet = new Set(victims)
    const parents = new Set()
    for (const o of victims) if (o.parent) parents.add(o.parent)
    for (const p of parents) {
      const kids = p.children
      let w = 0
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i]
        if (!victimSet.has(c)) kids[w++] = c
      }
      kids.length = w
    }
    for (const o of victims) o.parent = null
  }
  // 合批前的原始几何体从未上传过 GPU，交给 GC 即可；
  // 这里不做 dispose，避免与其他未合并网格共享同一份几何时被误释放。

  let merged = 0
  const tmpM = new THREE.Matrix4()
  for (const b of instBuckets.values()) {
    const im = new THREE.InstancedMesh(b.geometry, b.material, b.mats.length)
    for (let i = 0; i < b.mats.length; i++) im.setMatrixAt(i, tmpM.fromArray(b.mats[i]))
    im.instanceMatrix.needsUpdate = true
    im.castShadow = b.cast
    im.receiveShadow = b.receive
    // 一个材质批次横跨整个城市，视锥剔除没有意义，反而多一次包围球计算
    im.frustumCulled = false
    im.matrixAutoUpdate = false
    scene.add(im)
    merged++
  }
  for (const b of buckets.values()) {
    if (!b.geos.length) continue
    const geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false)
    if (!geo) {
      b.geos.forEach((g) => g.dispose())
      continue
    }
    const mesh = new THREE.Mesh(geo, b.material)
    mesh.castShadow = b.cast
    mesh.receiveShadow = b.receive
    mesh.matrixAutoUpdate = false
    scene.add(mesh)
    merged++
    if (b.geos.length > 1) b.geos.forEach((g) => g.dispose())
  }
  console.info(`[merge] ${victims.length} meshes → ${merged} batches（实例 ${instBuckets.size} / 合并 ${buckets.size}）`)
  mergeStats = { meshes: victims.length, batches: merged, instanced: instBuckets.size, mergedGroups: buckets.size }
}
const __tGen = performance.now()
const solids = collectSolids()
const __tSolids = performance.now()
mergeStaticMeshes(true)
const __tMerge = performance.now()

// ============================================================
//  筋斗云漫游：飞行碰撞体
//  合批前把大体量构件（塔身 / 屋盖 / 大厅）的包围盒收集起来，
//  小构件（竖梃、窗框、栏杆）忽略，保证飞行时不会穿进主楼体。
// ============================================================
function collectSolids() {
  const out = []
  const tmp = new THREE.Box3()
  scene.updateMatrixWorld(true)
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.noMerge) return
    if (Array.isArray(o.material) || !o.geometry?.attributes?.position) return
    const geo = o.geometry
    if (!geo.boundingBox) geo.computeBoundingBox()
    tmp.copy(geo.boundingBox).applyMatrix4(o.matrixWorld)
    const sx = tmp.max.x - tmp.min.x
    const sy = tmp.max.y - tmp.min.y
    const sz = tmp.max.z - tmp.min.z
    if (sy < 6 || sx < 3.5 || sz < 3.5) return
    if (tmp.max.y < 3) return
    const vol = sx * sy * sz
    if (vol < 300) return
    out.push({ x0: tmp.min.x, x1: tmp.max.x, y0: tmp.min.y, y1: tmp.max.y, z0: tmp.min.z, z1: tmp.max.z, vol })
  })
  // 大盒吞掉完全被包含的小盒，减少重复推挤
  out.sort((a, b) => b.vol - a.vol)
  const keep = []
  for (const b of out) {
    const cx = (b.x0 + b.x1) * 0.5
    const cy = (b.y0 + b.y1) * 0.5
    const cz = (b.z0 + b.z1) * 0.5
    let inside = false
    for (let i = 0; i < keep.length; i++) {
      const k = keep[i]
      if (cx > k.x0 && cx < k.x1 && cy > k.y0 && cy < k.y1 && cz > k.z0 && cz < k.z1) { inside = true; break }
    }
    if (!inside) keep.push(b)
  }
  console.info(`[roam] solids ${out.length} → ${keep.length}`)
  return keep.map(({ x0, x1, y0, y1, z0, z1 }) => ({ x0, x1, y0, y1, z0, z1 }))
}
roam = createRoam({
  scene,
  camera,
  renderer,
  controls,
  solids,
  bounds: { x: (COLS / 2) * SP_X + 300, z: (ROW_UNITS / 2) * SP_Z + 420 },
})

// 调试视角：?view=river 直接飞到河面上看船
{
  // 供控制台 / 调试脚本操作
  window.__city = { camera, controls, scene, setNight, renderer }
  const q = new URLSearchParams(location.search)
  if (q.get('view') === 'river') {
    const rz = (ROW_UNITS / 2) * SP_Z + 196
    camera.position.set(-330, 150, rz + 200)
    controls.target.set(-560, 22, rz - 58)
    controls.update()
  }
}

// 场景已全部建好，烘焙一次静态阴影
renderer.shadowMap.needsUpdate = true
const __tBuilt = performance.now()
window.__boot = {
  buildMs: Math.round(__tBuilt - __t0),
  phases: {
    prototypes: Math.round(__tGen - __t0),
    solids: Math.round(__tSolids - __tGen),
    merge: Math.round(__tMerge - __tSolids),
    rest: Math.round(__tBuilt - __tMerge),
  },
  firstFrameMs: 0,
  merge: mergeStats,
}
tick()

// 首帧之后撤掉加载遮罩
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const boot = document.getElementById('boot')
    if (!boot) return
    boot.classList.add('done')
    setTimeout(() => boot.remove(), 600)
    window.__boot.firstFrameMs = Math.round(performance.now() - __t0)
    console.info(`[boot] 构建 ${window.__boot.buildMs}ms · 首帧 ${window.__boot.firstFrameMs}ms`)
  })
})
