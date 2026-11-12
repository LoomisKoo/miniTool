import * as THREE from 'three'
import { W, SURFACE } from './spec.js'
import { buildWorld } from './world.js'
import { setupDay, tuneFog, SKY, SHADOW_ALLOWED } from './light.js'
import * as Mat from './mat.js'
import { setEnvMap, allMaterials, nightU, applyNight, updateUpView, waterTime, radialTex } from './mat.js'
import { buildHero } from './hero.js'
import { buildCloud } from './cloud.js'
import { tickFerris } from './amenities.js'
import { tickStreetLife } from './street.js'
import { updateChunkLOD } from './perf.js'
import { FAC } from './signs.js'

const canvas = document.querySelector('canvas')
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  // 画布本来就被天空球铺满，不需要和页面合成：不透明的 framebuffer 少一趟 alpha 合成，
  // Safari 的 WebGL 合成路径明显便宜一些；stencil 也没用上
  alpha: false,
  stencil: false,
  // t37：关掉对数深度。它让每个片元写 gl_FragDepth → GPU 无法提前深度剔除，被挡住的立面也要把整套
  // 立面 shader（凹窗 / 室内 / 噪声）跑完，城区重叠层数一多就是 10fps 的元凶。改用随高度变化的近裁剪面保精度。
  logarithmicDepthBuffer: /[?&]logz\b/.test(location.search),
})

// 像素比：Retina 上 2.0 + MSAA 填充率太高，起步 1.25、最高 1.5（自适应只在这之间调）
const maxDPR = Math.min(devicePixelRatio, 2)
let curDPR = Math.min(devicePixelRatio, 1.4)
renderer.setPixelRatio(curDPR)
renderer.setSize(innerWidth, innerHeight)

const scene = new THREE.Scene()
const { sun, env, envNight, hemi, fill, moon, sky, skyMat, stars, starMat } = setupDay(scene, renderer)
setEnvMap(env)

const loading = document.getElementById('loading')
let world = null
try {
  world = buildWorld()
  // 地面 / 自然带 / 城墙这些普通网格要接住建筑的投影，否则楼上投下的影子落不到街上。
  // 注意：受影是有代价的（每个片元 9 次深度图比较），所以只给地面系材质开。
  world.traverse((o) => {
    if (!o.isMesh) return
    const m = o.material
    // 记下"地面系"：只有它们永远接影子；墙面的受影由阴影档位决定（高级才开）
    o.userData.shadowGround = o.receiveShadow || !!(m && m.userData && m.userData.groundCraft)
    o.receiveShadow = o.userData.shadowGround || o.castShadow
    if (o.isInstancedMesh && o.castShadow === false) return
    o.castShadow = true
  })
  scene.add(world)
  setEnvMap(env) // 建筑运行时材质在建造后才登记
} catch (err) {
  console.error(err)
  if (loading) loading.textContent = '建造失败：' + (err?.message || err)
  throw err
}
if (loading) loading.hidden = true

// near 略抬高，减轻大世界里地表共面时的深度抖动
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1.2, 40_000)
const hero = buildHero()
scene.add(hero.group)
const cloudRig = buildCloud(scene)
// 预编译所有 shader（含云/主角），避免第一次看到某类物体时现场编译造成卡顿
renderer.compile(scene, camera)

/** 主角原点≈脚底，对齐可走面 */
const GROUND = SURFACE
const CLOUD_LIFT = 1.0 // 脚底到云底
const LIMIT = {
  x0: -W.cityWidth / 2 + 40,
  x1: W.cityWidth / 2 - 40,
  z0: -W.segmentLength / 2 + 40,
  z1: W.segmentLength / 2 - 40,
}

const player = {
  x: 420,
  y: GROUND,
  z: 80,
  yaw: -0.6,
  pitch: 0.28,
  dist: 16,
  face: -0.6 + Math.PI,
  onCloud: false,
  over: false,
  air: false,
  glide: false,
  vx: 0,
  vy: 0,
  vz: 0,
  landT: 0,
  landDur: 0.3,
  landK: 0,
  stepVis: 0,
  moving: 0,
  gait: 0,
}

let smoothDist = player.dist
let overSaved = null
const keys = new Set()
const modeEl = document.getElementById('mode')
const nightBtn = document.getElementById('nightBtn')
const nightTxt = document.getElementById('nightTxt')
const $ = (id) => document.getElementById(id)
const hudEl = { loc: $('hLoc'), sub: $('hSub'), xz: $('hXZ'), h: $('hH'), v: $('hV'), mode: $('hMode'), fps: $('hFps') }

let modeTimer = 0
function setMode(text, ttl = 0) {
  if (!modeEl) return
  clearTimeout(modeTimer)
  modeEl.hidden = !text
  if (text) modeEl.textContent = text
  if (text && ttl) modeTimer = setTimeout(() => { modeEl.hidden = true }, ttl)
}

// ── 昼夜 ──
let nightTarget = 0
let nightT = 0
let envNightOn = false
const DAY = SKY.day
const NIGHT = SKY.night
const cSunD = new THREE.Color('#ffe4bf') // t35 午后暖阳
const cSunN = new THREE.Color('#c5d4f2')
const cTop = new THREE.Color(DAY.top)
const cTopN = new THREE.Color(NIGHT.top)
const cMid = new THREE.Color(DAY.mid)
const cMidN = new THREE.Color(NIGHT.mid)
const cHor = new THREE.Color(DAY.horizon)
const cHorN = new THREE.Color(NIGHT.horizon)
const cBot = new THREE.Color(DAY.bottom)
const cBotN = new THREE.Color(NIGHT.bottom)
const cHemi = new THREE.Color(DAY.hemi)
const cHemiN = new THREE.Color(NIGHT.hemi)
const cGround = new THREE.Color(DAY.ground)
const cGroundN = new THREE.Color(NIGHT.ground)
const cFog = new THREE.Color(DAY.fog)
const cFogN = new THREE.Color(NIGHT.fog)
const tmpCol = new THREE.Color()

function toggleNight() {
  nightTarget = nightTarget > 0.5 ? 0 : 1
  setMode(nightTarget ? '已切换到夜晚' : '已切换到白天', 1800)
  if (nightTxt) nightTxt.textContent = nightTarget ? '白天' : '夜晚'
}
if (nightBtn) nightBtn.addEventListener('click', toggleNight)

function applyTimeOfDay(t) {
  skyMat.uniforms.top.value.copy(cTop).lerp(cTopN, t)
  skyMat.uniforms.mid.value.copy(cMid).lerp(cMidN, t)
  skyMat.uniforms.horizon.value.copy(cHor).lerp(cHorN, t)
  skyMat.uniforms.bottom.value.copy(cBot).lerp(cBotN, t)

  tmpCol.copy(cFog).lerp(cFogN, t)
  scene.fog.color.copy(tmpCol)

  hemi.color.copy(cHemi).lerp(cHemiN, t)
  hemi.groundColor.copy(cGround).lerp(cGroundN, t)
  hemi.intensity = 0.42 - 0.17 * t // t37 白天再降环境光（0.78→0.64）、主光加强 → 受光/背光的冷暖对比拉开； 夜里环境光压得更暗，灯光/窗光对比更强（t35 白天 0.95→0.78，夜里终值不变 0.25）
  sun.intensity = 3.6 * (1 - t) + 0.5 * t
  sun.color.copy(cSunD).lerp(cSunN, t)
  fill.intensity = 0.38 * (1 - t) + 0.02 * t
  moon.intensity = 0
  // 白天把环境图压到 0.45 让主光做主；夜里回到 1.0，否则街灯/窗光没了天光托底会糊成一团黑
  scene.environmentIntensity = 0.45 + 0.55 * t
  renderer.toneMappingExposure = 1.12 - 0.09 * t
  starMat.opacity = Math.max(0, (t - 0.32) / 0.68)
  nightU.value = t
  applyNight(t)
  const useNight = t > 0.55
  if (t > 0.6 && shNight !== 1) maybeUpdateShadow(false)
  if (useNight !== envNightOn) {
    envNightOn = useNight
    const e = useNight ? envNight : env
    scene.environment = e
    setEnvMap(e)
  }
  document.body.classList.toggle('night', useNight)
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

/** 建筑刚体碰撞（AABB）。r=身体半径；yLow=碰撞体最低点（云底），yHead=头顶 */
const BODY_R = 0.45
const STEP_H = 0.62
// 一层店面/雨棚外挑约 1m：贴地段多留一点余量，人不会钻进店厢
const padOf = (c, y) => (y < c.base + 6 ? 0.9 : 0.15)
const _rs = [0, 0] // 复用返回数组：120Hz 物理步每秒不再产生几百个临时数组
function resolveSolids(x, z, y, r = BODY_R, yLow = y, yHead = y + 1.65) {
  const query = world?.userData?.buildings?.userData?.querySolids
  if (!query) { _rs[0] = x; _rs[1] = z; return _rs }
  const list = query(x, z)
  for (let n = 0; n < 6; n++) {
    let hit = null
    for (let k = 0; k < list.length; k++) {
      const c = list[k]
      // 低于“可迈上”的高度不挡（交给 groundAt 抬脚）；头顶以上的不挡
      if (yHead < c.base + 0.05 || yLow > c.y - STEP_H) continue
      const pad = padOf(c, yLow)
      if (Math.abs(x - c.x) < c.w / 2 + r + pad && Math.abs(z - c.z) < c.d / 2 + r + pad) { hit = c; break }
    }
    if (!hit) break
    const hw = hit.w / 2 + r + padOf(hit, yLow)
    const hd = hit.d / 2 + r + padOf(hit, yLow)
    const dx = x - hit.x
    const dz = z - hit.z
    if (hw - Math.abs(dx) < hd - Math.abs(dz)) x = hit.x + Math.sign(dx || 1) * hw
    else z = hit.z + Math.sign(dz || 1) * hd
  }
  _rs[0] = x
  _rs[1] = z
  return _rs
}

/** 脚下最高可站面：路面/人行道/台阶/平台（walk 网格）+ 不高于 maxY 的屋顶等刚体顶面 */
const RIVER_HALF = W.riverWidth / 2 - 0.5
const WATER_Y = SURFACE - 6 - 1.25 // 河面在路面下 6m（桥下能过船）；河里：水没到胸口，只能游，不能在水面上走
function inWater(x, y) { return Math.abs(x) < RIVER_HALF && y < SURFACE - 0.4 }
// 城墙体量（分层退台）：筋斗云/人不能钻进墙里。dx = 离城墙内皮向外的距离
const WALL_IN = W.cityWidth / 2
const WALL_BANDS = [[0.2, 48], [8.2, 160], [18.2, 320], [28.2, 460], [38.2, 550]]
const WALL_DECK = W.wallHeight + 12
function wallTopAt(x) {
  const dx = Math.abs(x) - WALL_IN
  return dx < -10 || dx > W.wallThick + 10 ? -Infinity : WALL_DECK
}
function wallBandTop(x) {
  const dx = Math.abs(x) - WALL_IN
  if (dx < 0.2 || dx > W.wallThick) return -Infinity
  let t = -Infinity
  for (const [d, y] of WALL_BANDS) if (dx >= d) t = y
  return t
}
/** 墙体侧面推出：身体在某层墙体高度范围内且水平进入了墙皮 → 推回墙皮外 */
function pushOutWall(x, y0, y1, r) {
  const ax = Math.abs(x)
  const s = Math.sign(x) || 1
  for (let i = WALL_BANDS.length - 1; i >= 0; i--) {
    const d = WALL_BANDS[i][0]
    const top = WALL_BANDS[i][1]
    const bot = i ? WALL_BANDS[i - 1][1] : -50
    if (y0 >= top - 0.05 || y1 <= bot) continue
    const face = WALL_IN + d - 5.6 - r // 立面模块/壁柱外凸约 5.4m
    if (ax > face && ax < WALL_IN + W.wallThick) return s * face
  }
  // 平台（含 10m 挑檐）：从下面顶上来时挡住
  if (y1 > WALL_DECK - 12 && y0 < WALL_DECK - 0.05 && ax > WALL_IN - 10 - r && y0 < WALL_DECK - 12) return s * (WALL_IN - 10 - r)
  return x
}
function groundAt(x, z, maxY) {
  let g = Math.abs(x) < RIVER_HALF ? WATER_Y : GROUND
  {
    const wt = wallTopAt(x)
    if (wt <= maxY && wt > g) g = wt
    const bt = wallBandTop(x)
    if (bt <= maxY && bt > g) g = bt
  }
  const qw = world?.userData?.queryWalk
  if (qw) g = Math.max(g, qw(x, z, maxY))
  const query = world?.userData?.buildings?.userData?.querySolids
  if (query) {
    const list = query(x, z)
    for (let k = 0; k < list.length; k++) {
      const c = list[k]
      if (c.y > maxY || c.y <= g) continue
      if (Math.abs(x - c.x) <= c.w / 2 && Math.abs(z - c.z) <= c.d / 2) g = c.y
    }
  }
  return g
}

function shortAngle(from, to) {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function jump() {
  if (player.air || player.onCloud) return
  player.air = true
  player.vy = 6.9 // g=24 时约 1m 跳高
}

function toggleCloud() {
  if (player.over) return
  if (!player.onCloud) {
    player.onCloud = true
    player.air = true
    player.glide = false
    // 召云：脚下托起，速度从当前惯性开始
    player.vy = Math.max(player.vy, 0)
    player.y = Math.max(player.y, groundAt(player.x, player.z, player.y + 0.3) + CLOUD_LIFT)
    setMode('筋斗云 · Shift 冲刺 · 空格上升 · C 下降 · F 收起')
  } else {
    // 收云：不带云的速度，人直接往下掉
    player.vx = player.vy = player.vz = 0
    player.onCloud = false
    player.glide = false
    player.air = true
    setMode('空中 · 按住空格滑翔', 2500)
  }
}

function toggleOverview() {
  player.over = !player.over
  if (player.over) {
    overSaved = { yaw: player.yaw, pitch: player.pitch, dist: player.dist }
    // 默认拉到能框住整段岛（宽 5km+墙+自然带，长 5km）
    player.dist = 12_000
    smoothDist = player.dist
    player.pitch = 0.95
    player.yaw = 0.35
    setMode('全局视野 · V 返回 · 滚轮远近')
  } else {
    if (overSaved) {
      player.yaw = overSaved.yaw
      player.pitch = overSaved.pitch
      player.dist = overSaved.dist
      smoothDist = player.dist
    }
    setMode(player.onCloud ? '筋斗云 · F 收起' : player.air ? (player.glide ? '滑翔中' : '') : '')
  }
}

addEventListener('keydown', (e) => {
  const first = !keys.has(e.code)
  keys.add(e.code)
  if (first && e.code === 'KeyV') toggleOverview()
  if (first && e.code === 'KeyF') toggleCloud()
  if (first && e.code === 'KeyN') toggleNight()
  if (first && e.code === 'Space' && !player.over) {
    if (!player.air && !player.onCloud) jump()
    else if (player.air && !player.onCloud) player.glide = true
  }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) e.preventDefault()
})
addEventListener('keyup', (e) => {
  keys.delete(e.code)
  if (e.code === 'Space') player.glide = false
})

let dragging = false
let lastX = 0
let lastY = 0
canvas.addEventListener('pointerdown', (e) => {
  dragging = true
  lastX = e.clientX
  lastY = e.clientY
  canvas.setPointerCapture(e.pointerId)
})
canvas.addEventListener('pointerup', () => { dragging = false })
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  player.yaw -= dx * (player.over ? 0.003 : 0.0045)
  if (player.over) player.pitch = clamp(player.pitch + dy * 0.0022, 0.25, 1.45)
  else player.pitch = clamp(player.pitch + dy * 0.0035, -0.15, 1.25)
})
canvas.addEventListener(
  'wheel',
  (e) => {
    const step = Math.min(Math.abs(e.deltaY), 120) / 120
    const k = Math.pow(e.deltaY > 0 ? 1.08 : 1 / 1.08, step)
    if (player.over) player.dist = clamp(player.dist * k, 1_500, 40_000)
    else player.dist = clamp(player.dist * k, 2.8, 2_500)
    e.preventDefault()
  },
  { passive: false },
)

const clock = new THREE.Clock()
const look = new THREE.Vector3()
const camLook = new THREE.Vector3()
let camInit = false

// ── 阴影档位：高(2048/PCF) → 中(1024) → 关。跟着帧率自动降级，卡的时候先牺牲影子而不是掉到十几帧 ──
// 手动指定：?shadows=high|mid|off（off 时连阴影图都不建）
const SHADOW_ARG = (location.search.match(/[?&]shadows=([a-z0-9]+)/) || [])[1]
// 默认从中档起步：高档（墙面也接影）是满屏 9 次深度比较，Safari 上一开局就吃满。
// 稳在 60fps 的机器两秒后会自动升到高档，卡机器则留在中档/关掉
let shadowLvl = SHADOW_ARG === 'off' || SHADOW_ARG === '0' ? 0 : SHADOW_ARG === 'mid' ? 1 : SHADOW_ARG === 'high' ? 2 : 1
let shadowCool = 0
let shadowInit = true
function applyShadowLvl() {
  const on = SHADOW_ALLOWED && shadowLvl > 0
  renderer.shadowMap.enabled = on
  // 高级档：墙面也接影子（楼与楼互相遮挡，转角那条暗带）；中/低档：只有地面接，
  // 省掉的正是最贵的那部分（满屏立面 × 每次 9 次深度比较）
  world?.traverse((o) => {
    if (!o.isMesh) return
    o.receiveShadow = !!o.userData.shadowGround || (shadowLvl >= 2 && !!o.castShadow)
  })
  if (!sun.castShadow) return
  const size = shadowLvl >= 2 ? 2048 : 1024
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size)
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null }
  }
  renderer.shadowMap.needsUpdate = true
  shX = 1e9 // 强制重画一次
  // 阴影开关会改 program 的 define，必须让材质重编一次，否则"关掉"了还在付采样钱。
  // 启动时不用（材质还没编译过，第一次编译就会读到最新状态）
  if (shadowInit) shadowInit = false
  else Mat.recompileAll()
}

// ── 自适应分辨率：滞回 + 冷却，不再每秒来回切 DPR（每切一次就是一次 resize 卡顿）──
let dprAccT = 0
let dprAccN = 0
let dprBad = 0
let dprGood = 0
let dprCool = 3
function adaptDPR(dt) {
  dprCool -= dt
  dprAccT += dt
  dprAccN++
  if (dprAccT < 2) return
  const avg = dprAccT / dprAccN
  dprAccT = 0
  dprAccN = 0
  // 先降阴影档位，再把分辨率往下压：影子是纯装饰，分辨率掉下去整屏都糊。
  // 门槛按「能不能锁在 60」来定：低于 45fps 就退一档，稳定锁 60（<1/56）时才升回去。
  // （以前升级门槛写的是 78fps —— 60Hz 屏幕永远达不到，高级档一旦降下来就再也回不去。）
  shadowCool -= 2
  if (!SHADOW_ARG && shadowCool <= 0 && shadowLvl === 2 && avg > 1 / 45) {
    shadowLvl = 1
    shadowCool = 8
    applyShadowLvl()
  } else if (!SHADOW_ARG && shadowCool <= 0 && shadowLvl === 1 && avg > 1 / 34) {
    shadowLvl = 0
    shadowCool = 10
    applyShadowLvl()
  } else if (!SHADOW_ARG && shadowCool <= 0 && shadowLvl < 2 && avg < 1 / 56) {
    shadowLvl++
    shadowCool = 12
    applyShadowLvl()
  }
  if (dprCool > 0) return
  dprBad = avg > 1 / 45 ? dprBad + 1 : 0
  dprGood = avg < 1 / 58 ? dprGood + 1 : 0
  let next = curDPR
  if (avg > 1 / 45) {
    // 渲染时间大致与像素数成正比 → 目标 DPR 用 sqrt 一次算到位，
    // 不再每 6 秒挪 0.25（Safari 上以前就是这样越拖越卡、最后卡在十几帧）
    // 下限：平时 1.0；真的掉到 30fps 以下才允许 0.85（整屏发软，但比卡死强）
    const floor = avg > 1 / 30 ? 0.85 : 1.0
    next = +(curDPR * Math.sqrt((1 / 56) / avg)).toFixed(2)
    next = Math.min(next, curDPR - 0.05)
    next = Math.max(floor, next)
  } else if (dprGood >= 2 && curDPR < maxDPR && avg < 1 / 58) {
    // 只有稳定锁帧（说明还有余量）才往上加，每次 0.1 —— 45~58fps 之间是死区，不会来回跳
    next = Math.min(maxDPR, +(curDPR + 0.1).toFixed(2))
  }
  if (Math.abs(next - curDPR) < 0.02) return
  curDPR = next
  dprBad = dprGood = 0
  dprCool = 3
  renderer.setPixelRatio(curDPR)
  renderer.setSize(innerWidth, innerHeight, false)
}

// ── 固定步长物理（120Hz）+ 渲染插值：画面不随帧时间抖 ──
const H = 1 / 120
let physAcc = 0
let prevX = player.x
let prevY = player.y
let prevZ = player.z
// 游戏手感重力（更快下坠），终端速度 90m/s
const G = 24
const TERMINAL = 90
const DRAG_K = G / (TERMINAL * TERMINAL)
const CLOUD = { cruise: 90, boost: 320, ramp: 0.05, vUp: 70, vUpBoost: 220, r: 1.35 }

function inputDir() {
  const fwdX = -Math.sin(player.yaw)
  const fwdZ = -Math.cos(player.yaw)
  const rgtX = Math.cos(player.yaw)
  const rgtZ = -Math.sin(player.yaw)
  let mx = 0
  let mz = 0
  if (keys.has('KeyW')) { mx += fwdX; mz += fwdZ }
  if (keys.has('KeyS')) { mx -= fwdX; mz -= fwdZ }
  if (keys.has('KeyD')) { mx += rgtX; mz += rgtZ }
  if (keys.has('KeyA')) { mx -= rgtX; mz -= rgtZ }
  const len = Math.hypot(mx, mz)
  return len > 0 ? [mx / len, mz / len, 1] : [0, 0, 0]
}

/** 速度向目标靠拢，单步变化量不超过 a*h（恒定加速度） */
function approach(v, target, a, h) {
  const d = target - v
  const m = a * h
  return Math.abs(d) <= m ? target : v + Math.sign(d) * m
}

function step(h) {
  if (player.over) { player.vx = player.vz = 0; return }
  const [mx, mz, has] = inputDir()
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
  if (has) player.face += shortAngle(player.face, Math.atan2(mx, mz)) * Math.min(1, h * 12)
  player.moving = has ? Math.min(1, player.moving + h * 6) : Math.max(0, player.moving - h * 6)

  if (player.onCloud) {
    // 筋斗云：0.08s 内到满速（巡航 60 / Shift 180m/s），松手即停、无惯性
    const vmax = running ? CLOUD.boost : CLOUD.cruise
    if (has) {
      const a = vmax / CLOUD.ramp
      player.vx = approach(player.vx, mx * vmax, a, h)
      player.vz = approach(player.vz, mz * vmax, a, h)
    } else player.vx = player.vz = 0
    const up = keys.has('Space')
    const down = keys.has('KeyC') || keys.has('ControlLeft')
    const vUp = running ? CLOUD.vUpBoost : CLOUD.vUp
    const ty = up ? vUp : down ? -vUp : 0
    player.vy = ty === 0 ? 0 : approach(player.vy, ty, vUp / CLOUD.ramp, h)
  } else if (player.air) {
    // 自由落体：g=24（游戏手感），二次空气阻力只在高速时明显（终端 90m/s）
    const sp3 = Math.hypot(player.vx, player.vy, player.vz)
    const k = DRAG_K * sp3 * h
    player.vx -= player.vx * k
    player.vz -= player.vz * k
    player.vy -= player.vy * k
    player.vy -= G * h
    if (player.glide) {
      // 滑翔：垂直阻力大（降到约 4m/s），水平可操控
      if (player.vy < -4) player.vy += (-4 - player.vy) * Math.min(1, h * 3)
      if (has) {
        const want = running ? 22 : 14
        player.vx = approach(player.vx, mx * want, 8, h)
        player.vz = approach(player.vz, mz * want, 8, h)
      }
    } else if (has) {
      // 空中只给很小的操控力
      player.vx += mx * 3.0 * h
      player.vz += mz * 3.0 * h
    }
  } else {
    // 地面：加速/减速有限，不瞬停
    const swim = inWater(player.x, player.y)
    const want = swim ? (running ? 4 : 2.6) : running ? 18 : 8.5
    const a = has ? 28 : 40
    player.vx = approach(player.vx, mx * want, a, h)
    player.vz = approach(player.vz, mz * want, a, h)
    if (player.landT > 0) { player.vx *= 1 - h * 6; player.vz *= 1 - h * 6 }
  }

  // ── 水平推进 + 碰撞（云带半径，底部也算；滑墙时把撞墙分量清零）──
  const nx = clamp(player.x + player.vx * h, LIMIT.x0 - (player.onCloud ? 400 : 0), LIMIT.x1 + (player.onCloud ? 400 : 0))
  const nz = clamp(player.z + player.vz * h, LIMIT.z0 - (player.onCloud ? 400 : 0), LIMIT.z1 + (player.onCloud ? 400 : 0))
  const r = player.onCloud
    ? resolveSolids(nx, nz, player.y, CLOUD.r, player.y - CLOUD_LIFT, player.y + 1.7)
    : resolveSolids(nx, nz, player.y, BODY_R, inWater(player.x, player.y) ? player.y + 1.5 : player.y)
  {
    const lo = player.onCloud ? player.y - CLOUD_LIFT : player.y
    const wx = pushOutWall(r[0], lo, player.y + 1.7, player.onCloud ? CLOUD.r : BODY_R)
    if (wx !== r[0]) r[0] = wx
  }
  if (Math.abs(r[0] - nx) > 1e-5) player.vx = 0
  if (Math.abs(r[1] - nz) > 1e-5) player.vz = 0
  player.x = r[0]
  player.z = r[1]

  // ── 垂直 ──
  if (player.onCloud) {
    let ny = player.y + player.vy * h
    const floor = groundAt(player.x, player.z, player.y - CLOUD_LIFT + STEP_H) + CLOUD_LIFT
    if (ny < floor) { ny = floor; if (player.vy < 0) player.vy = 0 }
    if (ny > GROUND + 1200) { ny = GROUND + 1200; player.vy = Math.min(player.vy, 0) }
    player.y = ny
    player.air = true
  } else if (player.air) {
    const g = groundAt(player.x, player.z, player.y + 0.05)
    const ny = player.y + player.vy * h
    if (ny <= g && player.vy <= 0) {
      const impact = -player.vy
      player.y = g
      player.vy = 0
      player.air = false
      player.glide = false
      if (impact > 9.5) {
        // 落地冲击：按速度下蹲缓冲，重落地还要多缓一下
        player.landDur = Math.min(0.6, 0.16 + impact * 0.007)
        player.landT = player.landDur
        player.landK = Math.min(1, impact / 60)
      }
      if (!player.onCloud) setMode('')
    } else player.y = ny
  } else {
    // 贴地：台阶 ≤0.55m 直接迈上，落差 >0.6m 才转为下落
    // 水里可以爬上岸（台阶放宽到 2m）
    // 水里可以"爬上"驳岸（河面低于岸 6m，按一下前进就能扒着岸墙上去）
    const stepH = inWater(player.x, player.y) ? 8.0 : STEP_H
    const g = groundAt(player.x, player.z, player.y + stepH)
    if (g >= player.y - 0.6) {
      if (g > player.y) player.stepVis -= g - player.y // 视觉上平滑过渡（物理立即到位，不陷脚）
      player.y = g
    } else {
      player.air = true
      player.vy = 0
    }
  }
  if (player.landT > 0) player.landT = Math.max(0, player.landT - h)
}

// ── 夜间：主角附近 4 盏真实点光跟随最近的路灯（地面光斑之外，人/车也被照亮）──
const lampLights = []
// 实时点光只留 2 盏（每盏点光都会让全场每个像素多一次光照计算）；地面光斑由贴花负责
for (let i = 0; i < 2; i++) {
  const L = new THREE.PointLight('#ffc98e', 0, 46, 1.4)
  L.position.set(0, -500, 0)
  scene.add(L)
  lampLights.push(L)
}
const lampBuf = []
let lampTimer = 0
function tickLampLights(dt, x, z) {
  const near = world?.userData?.streetLife?.userData?.nearLamps
  lampTimer -= dt
  const I = 16 * Math.max(0, (nightT - 0.3) / 0.7)
  if (near && lampTimer <= 0 && I > 0) {
    lampTimer = 0.15
    near(x, z, 2, lampBuf)
    for (let i = 0; i < 2; i++) {
      if (i * 3 < lampBuf.length) lampLights[i].position.set(lampBuf[i * 3], lampBuf[i * 3 + 1], lampBuf[i * 3 + 2])
      else lampLights[i].position.set(0, -500, 0)
    }
  }
  for (const L of lampLights) L.intensity = I
}

// 脚下软影（动态角色不再依赖很少重绘的阴影图）
const blob = (() => {
  const blobTex = radialTex(64, (t) => 0.55 * (1 - Math.max(0, (t - 1 / 16) / (15 / 16))), [0, 0, 0])
  const geo = new THREE.PlaneGeometry(1, 1)
  geo.rotateX(-Math.PI / 2)
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }))
  m.renderOrder = 2
  scene.add(m)
  return m
})()

function animateHero(dt, time, rx, ry, rz) {
  player.stepVis *= Math.exp(-dt * 14)
  const vy = ry + player.stepVis
  cloudRig.group.visible = player.onCloud && !player.over
  cloudRig.update(dt, time, rx, vy, rz, player.moving > 0.2, player.vx, player.vz, player.onCloud ? player.vy : 0)

  hero.group.visible = !player.over
  hero.group.position.set(rx, vy, rz)
  hero.group.rotation.y = player.face
  hero.group.scale.set(1, 1, 1)
  const spd = Math.hypot(player.vx, player.vz)
  const grounded = !player.air && !player.onCloud
  player.gait += dt * (grounded ? 4 + spd * 0.75 : 0)
  const swing = grounded ? Math.sin(player.gait) * Math.min(1.05, 0.35 + spd * 0.045) * Math.min(1, spd / 1.5) : 0
  hero.legs[0].rotation.set(swing, 0, 0)
  hero.legs[1].rotation.set(-swing, 0, 0)
  hero.arms[0].rotation.set(-swing * 0.8, 0, 0)
  hero.arms[1].rotation.set(swing * 0.8, 0, 0)
  hero.group.rotation.x = 0

  if (player.onCloud) {
    // 踩云：手臂不摆，略张开保持平衡；身体始终直立
    hero.legs[0].rotation.set(0.12, 0, 0.06)
    hero.legs[1].rotation.set(-0.08, 0, -0.06)
    hero.arms[0].rotation.set(0.25, 0, 0.32)
    hero.arms[1].rotation.set(0.25, 0, -0.32)
  } else if (player.glide) {
    hero.legs[0].rotation.set(-0.35, 0, 0)
    hero.legs[1].rotation.set(-0.35, 0, 0)
    hero.arms[0].rotation.set(0, 0, 1.15)
    hero.arms[1].rotation.set(0, 0, -1.15)
  } else if (player.air) {
    // 下落：手臂随下落速度上扬
    const f = Math.min(1, Math.max(0, -player.vy / 45))
    hero.legs[0].rotation.set(-0.3 - f * 0.2, 0, 0)
    hero.legs[1].rotation.set(0.1 - f * 0.2, 0, 0)
    hero.arms[0].rotation.set(-0.3, 0, 0.5 + f * 1.6)
    hero.arms[1].rotation.set(-0.3, 0, -0.5 - f * 1.6)
  }
  if (player.landT > 0) {
    // 落地缓冲：下蹲 → 站起
    const u = 1 - player.landT / player.landDur
    const s = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.12 + 0.18 * player.landK)
    hero.group.scale.set(1 + s * 0.4, 1 - s, 1 + s * 0.4)
    hero.legs[0].rotation.x = hero.legs[1].rotation.x = -s * 2.2
    hero.arms[0].rotation.set(-s * 2, 0, 0.2)
    hero.arms[1].rotation.set(-s * 2, 0, -0.2)
  }
  // 软影
  const gy = groundAt(rx, rz, ry + 0.3)
  const hgt = ry - gy
  blob.visible = !player.over && hgt < 40
  blob.position.set(rx, gy + 0.03, rz)
  const bs = (player.onCloud ? 3.2 : 1.1) * (1 + hgt * 0.02)
  blob.scale.set(bs, 1, bs)
  blob.material.opacity = Math.max(0, 1 - hgt / 40)

  const wantFov = player.over ? clamp(42 + (smoothDist - 8_000) * 0.0012, 38, 58) : 50 + Math.min(8, Math.max(0, spd - 45) * 0.08)
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * (1 - Math.exp(-dt * 5))
    camera.updateProjectionMatrix()
  }
}

// t39 整岛包围盒（城内 5km + 城墙 + 墙外自然带；高度含城墙 550m 与超高楼；海面顶 -6.4）
const ISLE_BOX = { x: W.cityWidth / 2 + W.wallThick + 1_100, z: W.segmentLength / 2 + 400, top: 900, bot: -12, sea: SURFACE - 6.4 }
function tickCamera(dt, rx, ry, rz) {
  // 与帧率无关的指数平滑
  smoothDist += (player.dist - smoothDist) * (1 - Math.exp(-dt * 12))
  const cy = Math.cos(player.pitch)
  if (player.over) {
    const d = smoothDist
    camera.position.set(Math.sin(player.yaw) * cy * d, Math.sin(player.pitch) * d + 200, Math.cos(player.yaw) * cy * d)
    camera.lookAt(0, 80, 0)
  } else {
    // 水平严格跟随插值位置（无拖影），垂直平滑（台阶/落地不晃镜头）
    look.set(rx, ry + player.stepVis + 1.45, rz)
    if (!camInit) { camLook.copy(look); camInit = true }
    camLook.x = look.x
    camLook.z = look.z
    // 云上/空中：垂直也严格跟随（以前指数平滑，云上 220m/s 升降时镜头落后十几米 → 人不在屏幕中心）
    // 只有地面走台阶时才平滑（台阶的视觉过渡由 stepVis 负责）
    if (player.onCloud || player.air) camLook.y = look.y
    else camLook.y += (look.y - camLook.y) * (1 - Math.exp(-dt * 9))
    const ox = Math.sin(player.yaw) * cy
    const oz = Math.cos(player.yaw) * cy
    camera.position.set(camLook.x + ox * smoothDist, camLook.y + 0.45 + Math.sin(player.pitch) * smoothDist, camLook.z + oz * smoothDist)
    camera.lookAt(camLook)
  }
  camera.updateMatrixWorld()
  updateUpView(camera)
  tuneFog(scene, Math.max(smoothDist, camera.position.y - GROUND), player.over)
  sky.position.copy(camera.position)
  stars.position.copy(camera.position)
  // t37 动态近裁剪面（没有对数深度后靠它保远处深度精度）：贴地 1.2m，320m 高空约 8m，最高 14m
  // t39：全景 / 高空时相机在整座岛的包围盒外面，最近的几何也在几公里外 → 近裁剪面直接推到「到包围盒距离的一半」
  // （同时不超过离海面高度的 0.7 倍，海面是无限大平面）。24 位深度的误差 ≈ d²/(near·2²⁴)：
  // 全景 12km 时 near 14m → 0.3~0.6m 误差（薄铺装 / 草坪 / 屋面 / 路面互相打架闪烁），near≈5km → 毫米级。
  // 仍是普通线性深度，不写 gl_FragDepth，地面早期深度剔除不受影响。
  {
    const p = camera.position
    const dx = Math.max(0, Math.abs(p.x) - ISLE_BOX.x), dz = Math.max(0, Math.abs(p.z) - ISLE_BOX.z)
    const dy = Math.max(0, p.y - ISLE_BOX.top, ISLE_BOX.bot - p.y)
    const boxD = Math.hypot(dx, dy, dz)
    const seaD = p.y - ISLE_BOX.sea
    let nn = Math.min(14, Math.max(1.2, (p.y - GROUND) * 0.025))
    nn = Math.max(nn, Math.min(boxD * 0.5, seaD * 0.7))
    const ff = player.over ? Math.max(40_000, smoothDist + 20_000) : 40_000
    if (Math.abs(nn - camera.near) > camera.near * 0.08 || ff !== camera.far) { camera.near = nn; camera.far = ff; camera.updateProjectionMatrix() }
  }
}

// ── 阴影图：只在走出 400m 或昼夜切换时重绘一次（以前每 30 帧整张重绘 → 周期性顿挫）──
let shX = 1e9
let shZ = 1e9
let shNight = -1
function maybeUpdateShadow(force) {
  const nightOn = nightT > 0.6 ? 1 : 0
  const moved = (player.x - shX) ** 2 + (player.z - shZ) ** 2 > 550 * 550
  if (!force && !moved && nightOn === shNight) return
  shNight = nightOn
  if (nightOn && !force) return
  // 阴影视锥现在是 ±1200m / 2048 texel：按 texel 尺寸对齐，避免移动时阴影边缘游动
  const snap = 1600 / 2048
  shX = Math.round(player.x / 80) * 80
  shZ = Math.round(player.z / 80) * 80
  const gx = Math.round(shX / snap) * snap
  const gz = Math.round(shZ / snap) * snap
  sun.target.position.set(gx, 0, gz)
  // 与 light.js 里 sun 的初始方向保持一致（同一束光的投影方向必须和受光方向一致，
  // 否则会出现"影子朝哪都说不清"的假感）
  sun.position.set(gx - 2_000, 1_050, gz + 1_300)
  sun.target.updateMatrixWorld()
  renderer.shadowMap.needsUpdate = true
}

// ── HUD：所在区域 / 坐标 / 别墅区怎么去（4Hz 刷新，不每帧改 DOM）──
const DISTRICT = {
  core: '中央商务区', high: '高层住宅区', mid: '多层街区', low: '低层老街', shop: '商业街区', mall: '购物中心', park: '城市公园', plaza: '市民广场',
  waterfront: '滨江区', wallside: '城墙边', villa: '锦绣别墅区', hospital: '市第一医院', school: '学校', gym: '体育馆', sports: '体育中心', parking: '停车场', gas: '加油站',
}
Object.assign(DISTRICT, { riverbank: '滨河公园' })
// 设施名一律取招牌（signs.js FAC）上的中文名，HUD / 菜单 / 招牌三处一致
const SIGN_KEY = { sports: 'gym', busterm: 'bus', walk: 'walkst', bar: 'barst', old: 'oldtown' }
const signName = (k) => FAC[SIGN_KEY[k] || k]?.[0]
for (const k of ['hospital', 'school', 'gym', 'sports', 'parking', 'gas', 'stadium', 'arena', 'garage', 'busterm', 'temple', 'church', 'office', 'gov', 'library',
  'museum', 'cinema', 'police', 'fire', 'post', 'hotel', 'market', 'farmers', 'airport', 'themepark', 'parkresort']) if (signName(k)) DISTRICT[k] = signName(k)
const plan = world?.userData?.plan
const boats = world?.children?.find((c) => c.userData?.boats)?.userData?.boats
function districtAt(x, z) {
  if (!plan) return ''
  if (Math.abs(x) < W.riverWidth / 2) return '中央河道'
  if (Math.abs(x) < W.riverWidth / 2 + 30) return '滨河步道'
  // 特色街区（步行街/酒吧街/动漫区/老城区）优先；CBD 是软区域，只有在地块属于高层/核心时才显示
  for (const d of plan.districts || []) {
    if (x < d.x0 || x > d.x1 || z < d.z0 || z > d.z1 || d.soft) continue
    return d.name
  }
  let best = null
  let bd = 1e9
  for (const b of plan.blocks) {
    const dx = Math.max(0, Math.abs(x - b.cx) - b.w / 2)
    const dz = Math.max(0, Math.abs(z - b.cz) - b.d / 2)
    const d = dx + dz
    if (d < bd) { bd = d; best = b }
  }
  if (!best || bd > 60) return '街道'
  let name = DISTRICT[best.kind] || best.kind
  if (best.kind === 'mid' || best.kind === 'high') {
    const soft = (plan.districts || []).find((d) => d.soft && x > d.x0 && x < d.x1 && z > d.z0 && z < d.z1)
    if (soft) name = soft.name
  }
  return name + (bd > 0 ? '（路边）' : '')
}
// ── 瞬移目的地（T 依次切换 / M 打开菜单点选）──
const TP_META = {
  villa: ['锦绣别墅区', '居住', '🏡'], core: ['中央商务区', '商务', '🏙️'], office: [0, '商务', '🏢'], hotel: [0, '商务', '🏨'], gov: [0, '公共服务', '🏛️'],
  stadium: [0, '文体', '🏟️'], arena: [0, '文体', '🎤'], sports: [0, '文体', '⛹️'], cinema: [0, '文体', '🎬'],
  library: [0, '文化', '📚'], museum: [0, '文化', '🏛️'], temple: [0, '文化', '🛕'], church: [0, '文化', '⛪'],
  hospital: [0, '生活', '🏥'], school: [0, '生活', '🏫'], market: [0, '生活', '🛒'], farmers: [0, '生活', '🥬'], post: [0, '生活', '📮'],
  busterm: [0, '交通', '🚌'], airport: [0, '交通', '🛸'], themepark: [0, '文体', '🎢'], parkresort: [0, '文体', '🏨'], garage: [0, '交通', '🅿️'], police: [0, '公共服务', '🚓'], fire: [0, '公共服务', '🚒'],
  walk: [0, '特色街区', '🛍️'], bar: [0, '特色街区', '🍸'], anime: [0, '特色街区', '🎮'], old: [0, '特色街区', '🏮'],
}
for (const k in TP_META) if (!TP_META[k][0]) TP_META[k][0] = signName(k) || k
const TP_GROUPS = [['特色街区', '逛街 · 夜生活'], ['文体', '体育 · 演出 · 电影'], ['文化', '人文 · 古迹'], ['商务', 'CBD · 酒店'], ['居住', ''], ['生活', '医疗 · 教育 · 购物'], ['交通', ''], ['公共服务', '']]
const TP = []
if (plan) {
  const near = (list, x, z) => list.sort((a, b) => Math.hypot(a.cx - x, a.cz - z) - Math.hypot(b.cx - x, b.cz - z))[0]
  // (x,z) 落点；(fx,fz) 镜头要正对的目标（建筑中心）
  const add = (key, x, z, fx = null, fz = null) => { const m = TP_META[key]; if (m) TP.push({ key, name: m[0], group: m[1], icon: m[2], x, z, fx, fz }) }
  for (const d of plan.districts || []) if (!d.soft) {
    const cx = (d.x0 + d.x1) / 2
    const sz = d.street ?? (d.z0 + d.z1) / 2
    // 站在街口，沿街道纵深看进去
    add(d.id, d.x0 + 6, sz, cx, sz)
  }
  const spots = [['villa', 1300, 1950], ['core', 400, 0], ['hospital', 0, 0], ['school', 0, 0], ['sports', 0, 0]]
  for (const f of ['stadium', 'arena', 'library', 'museum', 'cinema', 'busterm', 'temple', 'church', 'hotel', 'market', 'farmers', 'gov', 'office', 'garage', 'police', 'fire', 'post', 'airport']) spots.push([f, 0, 0])
  for (const [kind, x, z] of spots) {
    const list = plan.blocks.filter((q) => q.kind === kind)
    const b = near(list.filter((q) => q.big).length ? list.filter((q) => q.big) : list, x, z)
    // 站在地块正面那条街靠本侧的车道上（镜头在 16m 后的对向车道，避开两侧行道树），面朝建筑中心
    if (!b) continue
    const st = (plan.streets || []).filter((v) => v < b.z0 + 1 && v > b.z0 - 40).sort((p, q) => q - p)[0]
    add(kind, b.cx, st != null ? st + W.streetW / 2 - 1.5 : b.z0 - 8, b.cx, b.cz)
  }
  // t37 主题乐园：站在入口广场前（朝城内那条干道一侧），正对大门和中央灯塔
  {
    const b = plan.blocks.find((q) => q.kind === 'themepark')
    if (b) { const fx = b.cx > 0 ? -1 : 1; add('themepark', b.cx + fx * (b.w / 2 - 26), b.cz, b.cx, b.cz) }
  }
}
let tpIdx = 0
let tpCur = -1
function teleport(i = tpIdx++ % Math.max(1, TP.length)) {
  if (!TP.length) return
  if (player.over) toggleOverview()
  const t = TP[i]
  tpCur = i
  player.onCloud = false
  player.air = false
  player.glide = false
  player.vx = player.vy = player.vz = 0
  const [cx, cz] = clearSpot(t.x, t.z)
  player.x = cx
  player.z = cz
  player.y = groundAt(cx, cz, GROUND + 3)
  prevX = player.x
  prevY = player.y
  prevZ = player.z
  // 正对目标：前向 = (-sin yaw, -cos yaw)
  player.yaw = t.fx == null ? 0 : Math.atan2(-(t.fx - cx), -(t.fz - cz))
  // 镜头放平一些：能看到建筑立面与招牌，而不是只看到地面
  player.pitch = t.fx == null ? 0.32 : 0.12
  player.dist = 16
  camInit = false
  setMode(`${t.icon} 已到达 ${t.name}`, 2600)
  renderTP()
}
// 菜单
const tpPanel = $('tp')
const tpList = $('tpList')
function renderTP() {
  if (!tpList) return
  let html = ''
  for (const [g, sub] of TP_GROUPS) {
    const items = TP.map((t, i) => [t, i]).filter(([t]) => t.group === g)
    if (!items.length) continue
    html += `<div class="grp">${g}${sub ? ' · ' + sub : ''}</div><div class="items">`
    for (const [t, i] of items) html += `<button class="item${i === tpCur ? ' cur' : ''}" data-i="${i}"><span class="ic">${t.icon}</span><span><b>${t.name}</b><small>${i === tpCur ? '当前位置' : '距你 ' + (Math.hypot(t.x - player.x, t.z - player.z) / 1000).toFixed(1) + ' km'}</small></span></button>`
    html += '</div>'
  }
  tpList.innerHTML = html
}
function openTP(open = tpPanel?.hidden) {
  if (!tpPanel) return
  if (open) renderTP()
  tpPanel.hidden = !open
}
tpList?.addEventListener('click', (e) => {
  const el = e.target.closest('.item')
  if (!el) return
  teleport(+el.dataset.i)
  openTP(false)
})
$('tpBtn')?.addEventListener('click', () => openTP())
$('tpClose')?.addEventListener('click', () => openTP(false))
$('overBtn')?.addEventListener('click', () => toggleOverview())
const helpEl = $('help')
// 点按钮不抢焦点（否则之后按空格会再次触发按钮）
document.querySelector('.ui')?.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault() })
addEventListener('keydown', (e) => {
  if (e.repeat) return
  if (e.code === 'KeyT') teleport()
  if (e.code === 'KeyM') openTP()
  if (e.code === 'Escape') openTP(false)
  if (e.code === 'KeyH') helpEl?.classList.toggle('min')
})

let hudT = 0
let hudN = 0
let hudAcc = 0
function updateHUD(dt) {
  hudT += dt
  hudN++
  hudAcc += dt
  if (hudAcc < 0.25) return
  hudAcc = 0
  const fps = hudN / Math.max(hudT, 1e-3)
  hudT = 0
  hudN = 0
  const v = Math.hypot(player.vx, player.vz)
  const loc = districtAt(player.x, player.z)
  const road = loc.endsWith('（路边）')
  hudEl.loc.textContent = road ? loc.slice(0, -4) : loc
  hudEl.sub.textContent = road ? '路边' : ''
  hudEl.xz.textContent = `${player.x.toFixed(0)}, ${player.z.toFixed(0)}`
  hudEl.h.textContent = `${(player.y - GROUND).toFixed(1)} m`
  hudEl.v.textContent = `${(v * 3.6).toFixed(0)} km/h`
  hudEl.mode.textContent = player.over ? '🗺️ 全景俯瞰' : player.onCloud ? '☁️ 筋斗云' : player.glide ? '🪂 滑翔' : player.air ? '空中' : v > 12 ? '🏃 奔跑' : '🚶 步行'
  hudEl.fps.innerHTML = `<span class="${fps >= 50 ? 'ok' : 'warn'}">${fps.toFixed(0)} fps</span> · dpr ${curDPR}`
}

let lodX = 1e9
let lodZ = 1e9
let lodY = 1e9
const lampHalos = world?.getObjectByName('lampHalos')

// ?perf：帧率 / 分辨率 / draw call 面板（Safari 上排查性能用，默认不显示）
const PERF = /[?&]perf\b/.test(location.search) ? document.createElement('div') : null
if (PERF) {
  PERF.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:999;font:12px/1.45 ui-monospace,SFMono-Regular,monospace;color:#fff;background:rgba(0,0,0,.62);padding:6px 9px;border-radius:6px;white-space:pre;pointer-events:none'
  document.body.appendChild(PERF)
}
let perfT = 0
let perfN = 0
function tickPerf(dt) {
  if (!PERF) return
  perfT += dt
  perfN++
  if (perfT < 0.5) return
  const i = renderer.info.render
  PERF.textContent = `${(perfN / perfT).toFixed(0)} fps  ${(perfT / perfN * 1000).toFixed(1)} ms\n`
    + `dpr ${curDPR.toFixed(2)}  ${renderer.domElement.width}x${renderer.domElement.height}\n`
    + `draws ${i.calls}  tris ${(i.triangles / 1e6).toFixed(2)}M  shadow ${shadowLvl}`
  perfT = 0
  perfN = 0
}

function tick() {
  const frameDt = Math.min(clock.getDelta(), 0.1)
  const time = clock.elapsedTime
  physAcc += frameDt
  let n = 0
  while (physAcc >= H && n < 15) {
    prevX = player.x
    prevY = player.y
    prevZ = player.z
    step(H)
    physAcc -= H
    n++
  }
  if (n >= 15) physAcc = 0
  const a = physAcc / H
  const rx = prevX + (player.x - prevX) * a
  const ry = prevY + (player.y - prevY) * a
  const rz = prevZ + (player.z - prevZ) * a
  animateHero(frameDt, time, rx, ry, rz)
  tickCamera(frameDt, rx, ry, rz)
  if (nightT !== nightTarget) {
    nightT += (nightTarget - nightT) * Math.min(1, frameDt * 1.8)
    if (Math.abs(nightTarget - nightT) < 0.001) nightT = nightTarget
    applyTimeOfDay(nightT)
  }
  const bld = world?.userData?.buildings
  {
    // 按「镜头」移动触发（俯瞰/滚轮拉远时玩家不动但镜头动了）；含高度
    const cp = camera.position
    const dx = cp.x - lodX
    const dz = cp.z - lodZ
    const dy = cp.y - lodY
    if (dx * dx + dz * dz + dy * dy > 400) {
      lodX = cp.x
      lodZ = cp.z
      lodY = cp.y
      bld?.userData?.updateLOD?.(cp.x, cp.z, cp.y)
      updateChunkLOD(cp)
      // 远景/俯瞰：路灯光晕点精灵会缩成亚像素亮点闪烁 → 镜头高于 350m 时隐藏
      if (lampHalos) lampHalos.visible = cp.y < 350
      // 高空/俯瞰：车、行人、街道家具、船都小于一个像素，只会闪 → 整组隐藏（也省掉几百个 draw call）
      const far = cp.y > 700
      if (world?.userData?.streetLife) world.userData.streetLife.visible = !far
      if (boats) boats.visible = !far
    }
  }
  if (world?.userData?.ferris) tickFerris(world.userData.ferris, frameDt)
  waterTime.value = time
  bld?.userData?.tick?.(frameDt)
  boats?.userData?.tick?.(frameDt, time, camera.position)
  if (world?.userData?.streetLife && !player.over) tickStreetLife(world.userData.streetLife, frameDt, rx, rz)
  tickLampLights(frameDt, rx, rz)
  adaptDPR(frameDt)
  maybeUpdateShadow(false)
  renderer.render(scene, camera)
  tickPerf(frameDt)
  updateHUD(frameDt)
  requestAnimationFrame(tick)
}

// 调试用：控制台可直接查场景（仅开发环境）
if (import.meta.env?.DEV) window.__city = { scene, renderer, camera, world, player, hero, resolveSolids, groundAt, teleport, TP }

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

maybeUpdateShadow(true)
applyShadowLvl() // 初始档位落地（含墙体是否接影）
/** 出生点：在起点附近螺旋搜索一块空地（避开灯杆/红绿灯/树/长椅/垃圾桶/停的车/建筑刚体） */
function clearSpot(x0, z0, r = 1.1) {
  const propClear = world?.userData?.streetLife?.userData?.propClear
  const ok = (x, z) => {
    if (propClear && !propClear(x, z, r)) return false
    if (Math.abs(x) < W.riverWidth / 2 + 2) return false
    const g = groundAt(x, z, GROUND + 1)
    if (g > GROUND + 0.6) return false
    const q = resolveSolids(x, z, g, r + 0.3)
    return Math.abs(q[0] - x) < 1e-4 && Math.abs(q[1] - z) < 1e-4
  }
  if (ok(x0, z0)) return [x0, z0]
  for (let rad = 1.5; rad < 120; rad += 1.5) {
    const n = Math.ceil((rad * Math.PI * 2) / 1.5)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const x = x0 + Math.cos(a) * rad
      const z = z0 + Math.sin(a) * rad
      if (ok(x, z)) return [x, z]
    }
  }
  return [x0, z0]
}
{
  const [sx, sz] = clearSpot(player.x, player.z)
  player.x = prevX = sx
  player.z = prevZ = sz
}
player.y = groundAt(player.x, player.z, player.y + 1)
prevY = player.y
tick()

// 调试/截图：/linear.html?night&overview 直接进夜景全景
{
  const q = location.search
  if (/[?&]night\b/.test(q)) { toggleNight(); nightT = nightTarget; applyTimeOfDay(nightT) }
  if (/[?&]overview\b/.test(q)) toggleOverview()
}
