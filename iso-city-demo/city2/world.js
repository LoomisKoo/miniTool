// 世界拼装：地形、路面、建筑、招牌、街道设施、公园与地标。
import * as THREE from 'three'
import { MeshBuilder, litMat, canvasLabel, fastSphere } from './kit.js'
import * as P from './plan.js'

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'

export async function buildWorld(scene, onProgress = () => {}) {
  // 分步让出主线程：每到一个阶段就把「正在构筑城市 …」的字换掉，浏览器也能喘口气
  let __pct = 0
  const step = async (label, pct) => {
    __pct = pct ?? __pct
    onProgress(label, __pct)
    await new Promise((r) => setTimeout(r, 0))
  }
  await step('规划路网与地块', 6)
  // 描边壳：和「雨夜便利店」一样，每个体块外扩一层，用 BackSide 渲染就是描边
  const OUT = 0.07
  const solid = new MeshBuilder(OUT)
  // 店面构件（竖梃 / 雨棚 / 壁柱 / 门口杂物）：便利店那种 2cm 细描边，粗描边会把小构件描成一坨
  const shopB = new MeshBuilder(0.022)
  // 立面细部（窗框 / 窗台 / 窗楣 / 阳台栏杆 / 空调架）：全是十几厘米的东西，
  // 用 7cm 的楼体描边会整根变黑条 —— 窗户「脏」就是这么来的
  const trim = new MeshBuilder(0.018)
  const glass = new MeshBuilder()
  // 店内单独一个桶：里面是灯下的室内，不能和室外共用「受阳光照」的材质，
  // 否则楼体一挡光，橱窗里就是一团黑。它用自己的自发光材质，永远恒亮。
  const LIT_SRC = { grade: false }
  const inner = new MeshBuilder(0, LIT_SRC)
  // 店内的灯管 / 冷柜玻璃 / 灯箱：单独一个桶，溢出倍率比全城招牌（1.85）低得多，
  // 不然整间店的高光件一起烧白，橱窗就成了一块白板
  const innerHot = new MeshBuilder(0, LIT_SRC)
  const lightPools = [] // 店面洒在人行道上的光斑（最后一次性画）
  const beaconPos = [] // 高塔顶上的航空障碍灯（会一闪一闪，天际线上最容易被记住的点）
  const glow = new MeshBuilder(0, LIT_SRC)
  const bright = new MeshBuilder(0, LIT_SRC)
  const skin = new MeshBuilder()

  const colliders = []
  const doors = []
  const signs = []
  // 额外的暖光点（阳台串灯 / 壁灯 / 灯笼）：统一并进灯头光晕那一次 draw call
  const haloExtra = []

  // 夜景自发光材质注册表：白天这些灯要「灭掉」（乘一个很小的系数），
  // 否则晴天的楼还是一格格亮窗。day 是白天保留的亮度比例。
  const nightMats = []
  const regNight = (mat, day = 0.1) => {
    nightMats.push({ mat, base: mat.color.clone(), day })
    return mat
  }
  // 会动的小东西：灯笼摆、布旗飘、猫转头，最后各合成一个 InstancedMesh
  const swing = { lanterns: [], flags: [], cats: [] }
  // 生活感配色：高饱和只出现在小物件上（花、衣服、铁皮棚、灯笼）
  const FLOWERS = ['#ff7a9a', '#ffd166', '#ff9f5a', '#f25c78', '#fff4e0', '#c77dff', '#ff6b6b']
  const CLOTH = ['#ff8fa3', '#7fc8f8', '#ffd166', '#ffffff', '#9be3b0', '#f4a261', '#c3a6ff', '#e76f51']
  const CURTAIN = ['#e9a3a3', '#f2c27a', '#f6d6ad']
  const TIN = ['#4f86c6', '#d9534f', '#5aa36e', '#e8a33c', '#7fb3c8', '#c46b8a']

  await step('堆叠地形与水岸', 12)
  // ---------------------------------------------------------------- 地形
  const groundMat = litMat({ roughness: 0.95 })
  const S = 10
  const gx0 = -860
  const gx1 = 860
  const gz0 = -720
  const gz1 = 780
  const grid = []
  const nx = Math.round((gx1 - gx0) / S)
  const nz = Math.round((gz1 - gz0) / S)
  for (let i = 0; i <= nx; i++) {
    const row = []
    for (let j = 0; j <= nz; j++) {
      const x = gx0 + i * S
      const z = gz0 + j * S
      row.push([x, P.groundY(x, z), z])
    }
    grid.push(row)
  }
  const colorAt = (x, z, y) => {
    if (y < -7.3) return '#232a33'
    const d = z - P.waterN(x)
    const n = Math.abs(Math.sin(Math.round(x / 10) * 127.1 + Math.round(z / 10) * 311.7) * 43758.5453) % 1
    // 城外一律压暗，融进夜色：亮绿的底座和山会让整座城看起来像摆在桌上的沙盘
    if (d < 0) return n > 0.5 ? '#2c3a2c' : '#304030'
    if (d < P.BANK.beach) return n > 0.5 ? '#4a4436' : '#4e483a'
    if (d < P.BANK.slope) return '#34442f'
    if (d < P.BANK.walk) return '#4a4640'
    if (z > P.CITY.z1 + 16) {
      // 按海拔分带：山脚 → 山腰深林 → 山顶岩石，再按格子抖一点明暗，不是一整片平涂
      const yy = y - 6
      if (yy > 70) return n > 0.5 ? '#4e4c52' : '#48464c'
      if (yy > 48) return n > 0.6 ? '#3a3e34' : '#34392e'
      if (yy > 16) return n > 0.5 ? '#26352a' : '#29382c'
      return n > 0.5 ? '#2e3c2e' : '#314030'
    }
    if (x < P.CITY.x0 - 16 || x > P.CITY.x1 + 16) return n > 0.5 ? '#2e3c2e' : '#314030'
    // 绿地压到接近铺装的暗橄榄，俯视不能冒出大块玩具绿
    for (const p of P.PARKS) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return n > 0.5 ? '#2a3830' : '#2e3c34'
    for (const c of P.COMPOUNDS) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return '#2c3830'
    for (const g of P.GREEN_LOTS) if (Math.abs(x - g.x) < g.w / 2 + 2 && Math.abs(z - g.z) < g.d / 2 + 2) return '#2c3a32'
    if (P.districtOf(x, z) === 'D') return '#303c34'
    // 楼间：偏暖的城市铺装（冷死灰 = 厂房感）
    return n > 0.5 ? '#3e3c42' : '#383640'
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = grid[i][j]
      const b = grid[i + 1][j]
      const c = grid[i + 1][j + 1]
      const d = grid[i][j + 1]
      const cx = (a[0] + c[0]) / 2
      const cz = (a[2] + c[2]) / 2
      const col = colorAt(cx, cz, (a[1] + c[1]) / 2)
      skin.quad([a[0], a[1], a[2]], [b[0], b[1], b[2]], [c[0], c[1], c[2]], [d[0], d[1], d[2]], col, 0, 1, 0)
    }
  }
  const groundGeo = skin.build()
  // 地形同样切块；addSplit 定义在后面，这里先记下，等函数就绪再加
  const groundLater = groundGeo

  /** 沿折线铺一条带子（江面、岸线、小河、斜街都用它）。yAt 返回该点高度。 */
  const strip = (mb, pts, w, yAt, col, off = 0) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const dx = b[0] - a[0]
      const dz = b[1] - a[1]
      const len = Math.hypot(dx, dz) || 1
      const px = -dz / len
      const pz = dx / len
      const o0 = off - w / 2
      const o1 = off + w / 2
      const ya = yAt(a[0], a[1])
      const yb = yAt(b[0], b[1])
      mb.quad(
        [a[0] + px * o0, ya, a[1] + pz * o0],
        [b[0] + px * o0, yb, b[1] + pz * o0],
        [b[0] + px * o1, yb, b[1] + pz * o1],
        [a[0] + px * o1, ya, a[1] + pz * o1],
        col,
        0,
        1,
        0
      )
    }
  }

  // 江面：沿弯道的一条宽带
  const riverPts = []
  for (let x = gx0 - 200; x <= gx1 + 200; x += 20) riverPts.push([x, P.riverZ(x)])
  const waterB = new MeshBuilder()
  strip(waterB, riverPts, P.RIVER.half * 2 + 6, () => -7.9, '#2a3462')
  const waterMat = litMat({ color: '#2a3462', transparent: true, opacity: 0.94, roughness: 0.22, envMapIntensity: 1.25 })
  const water = new THREE.Mesh(waterB.build(), waterMat)
  water.frustumCulled = false
  scene.add(water)
  const waterEdge = new MeshBuilder()
  const edgeN = riverPts.map(([x]) => [x, P.waterN(x)])
  strip(waterEdge, edgeN, 1.2, () => -7.8, '#8fa6b8')
  const edgeMesh = new THREE.Mesh(waterEdge.build(), new THREE.MeshBasicMaterial({ vertexColors: true }))
  edgeMesh.frustumCulled = false
  scene.add(edgeMesh)

  const cvTex = (w, h, draw) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    draw(g, w, h)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }
  const roundRect = (g, x, y, w, h, r) => {
    g.beginPath()
    g.moveTo(x + r, y)
    g.arcTo(x + w, y, x + w, y + h, r)
    g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r)
    g.arcTo(x, y, x + w, y, r)
    g.closePath()
  }
  const CN_FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'
  const PROD = ['#ff6b81', '#ffd166', '#06d6a0', '#4cc9f0', '#f8961e', '#c77dff', '#fffdf6', '#8ecae6', '#ef476f']

  // 店内贴图：四种变体（货架多/冷柜多/面馆/杂货），只建一次反复用
  const interiorTex = []
  for (let v = 0; v < 4; v++) {
    interiorTex.push(
      cvTex(512, 256, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, 0, h)
        grd.addColorStop(0, '#6d5a46')
        grd.addColorStop(0.16, '#efdcbe')
        grd.addColorStop(0.72, '#e2c8a4')
        grd.addColorStop(1, '#b99a76')
        g.fillStyle = grd
        g.fillRect(0, 0, w, h)
        // 天花灯 + 光锥
        for (let i = 0; i < 3; i++) {
          const cx = w * (0.24 + i * 0.26)
          g.fillStyle = '#fffaf0'
          roundRect(g, cx - 30, 10, 60, 8, 4)
          g.fill()
          const lg = g.createLinearGradient(0, 18, 0, 120)
          lg.addColorStop(0, 'rgba(255,246,226,.5)')
          lg.addColorStop(1, 'rgba(255,246,226,0)')
          g.fillStyle = lg
          g.beginPath()
          g.moveTo(cx - 26, 18)
          g.lineTo(cx + 26, 18)
          g.lineTo(cx + 74, 130)
          g.lineTo(cx - 74, 130)
          g.fill()
        }
        // 货架：3 层 × 两排商品
        const shelfY = [h * 0.4, h * 0.58, h * 0.76]
        for (let r = 0; r < shelfY.length; r++) {
          const y = shelfY[r]
          g.fillStyle = '#a98d6b'
          g.fillRect(w * 0.2, y + 46, w * 0.5, 7)
          g.fillStyle = '#c9ae8a'
          g.fillRect(w * 0.2, y + 44, w * 0.5, 3)
          for (let i = 0; i < 16; i++) {
            if ((i + r) % 7 === 5) continue
            const px = w * 0.21 + i * (w * 0.0305)
            const pw = w * 0.021
            const ph = 20 + ((i * 7 + r * 5) % 12)
            g.fillStyle = PROD[(i * 5 + r * 3 + v * 2) % PROD.length]
            roundRect(g, px, y + 44 - ph, pw, ph, 3)
            g.fill()
            g.fillStyle = 'rgba(255,255,255,.45)'
            g.fillRect(px + 2, y + 48 - ph, 2, ph * 0.6)
            // 价签
            g.fillStyle = '#fffdf2'
            g.fillRect(px - 1, y + 47, pw + 2, 5)
          }
        }
        // 冷柜（右侧）：蓝白发光 + 四排饮料
        const fx = w * 0.72
        g.fillStyle = '#e9f3ff'
        g.fillRect(fx, h * 0.2, w * 0.26, h * 0.62)
        g.fillStyle = 'rgba(190,225,250,.55)'
        g.fillRect(fx, h * 0.2, w * 0.26, h * 0.05)
        for (let r = 0; r < 4; r++) {
          const y = h * 0.26 + r * (h * 0.135)
          g.fillStyle = '#b9c6dc'
          g.fillRect(fx, y + h * 0.1, w * 0.26, 4)
          for (let i = 0; i < 6; i++) {
            g.fillStyle = PROD[(i * 3 + r * 4) % PROD.length]
            roundRect(g, fx + 6 + i * (w * 0.041), y + h * 0.03, w * 0.026, h * 0.075, 3)
            g.fill()
          }
        }
        for (let i = 1; i < 3; i++) {
          g.fillStyle = '#9aa7bf'
          g.fillRect(fx + (i * w * 0.26) / 3 - 2, h * 0.2, 4, h * 0.62)
        }
        // 收银台（左下）
        g.fillStyle = '#5d4a38'
        g.fillRect(w * 0.02, h * 0.66, w * 0.16, h * 0.3)
        g.fillStyle = '#8f7659'
        g.fillRect(w * 0.01, h * 0.62, w * 0.18, h * 0.05)
        g.fillStyle = '#2f353a'
        g.fillRect(w * 0.13, h * 0.5, w * 0.05, h * 0.12)
        g.fillStyle = '#d6edf6'
        g.fillRect(w * 0.134, h * 0.51, w * 0.042, h * 0.1)
        // 地面反光
        const fl = g.createLinearGradient(0, h * 0.92, 0, h)
        fl.addColorStop(0, 'rgba(255,238,206,.0)')
        fl.addColorStop(1, 'rgba(255,232,196,.55)')
        g.fillStyle = fl
        g.fillRect(0, h * 0.92, w, h * 0.08)
      })
    )
  }

  // 玻璃：几乎透明 + 三道斜向高光，夜里的店面才有「隔着玻璃」的感觉
  const glassTex = cvTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = 'rgba(214,240,255,.30)'
    g.beginPath()
    g.moveTo(w * 0.12, h)
    g.lineTo(w * 0.24, h)
    g.lineTo(w * 0.45, 0)
    g.lineTo(w * 0.33, 0)
    g.fill()
    g.fillStyle = 'rgba(214,240,255,.16)'
    g.beginPath()
    g.moveTo(w * 0.3, h)
    g.lineTo(w * 0.35, h)
    g.lineTo(w * 0.56, 0)
    g.lineTo(w * 0.51, 0)
    g.fill()
    g.beginPath()
    g.moveTo(w * 0.66, h)
    g.lineTo(w * 0.76, h)
    g.lineTo(w * 0.97, 0)
    g.lineTo(w * 0.87, 0)
    g.fill()
  })
  // 玻璃：贴图本身只有几道斜向高光（其余是透明的），所以 opacity 高也挡不住店内，
  // 只会让那几道反光更明显 —— 和「雨夜便利店」同一个做法
  const paneMat = new THREE.MeshBasicMaterial({
    map: glassTex,
    color: '#f4fbff',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    toneMapped: false,
  })

  const UNIT = new THREE.PlaneGeometry(1, 1)
  const interiorMats = interiorTex.map((t) => regNight(new THREE.MeshBasicMaterial({ map: t, toneMapped: false }), 0.55))
  // 售货机正面：一瓶瓶饮料的贴图，只建一次
  const vendMat = regNight(new THREE.MeshBasicMaterial({
    toneMapped: false,
    map: cvTex(128, 160, (g, w, h) => {
      g.fillStyle = '#eaf6ff'
      g.fillRect(0, 0, w, h)
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i < 5; i++) {
          g.fillStyle = PROD[(i * 3 + r * 2) % PROD.length]
          roundRect(g, 8 + i * 23, 10 + r * 36, 16, 26, 4)
          g.fill()
        }
        g.fillStyle = '#c3d2e4'
        g.fillRect(0, 40 + r * 36, w, 3)
      }
    }),
  }), 0.4)


  await step('铺装路面与桥', 24)
  // ---------------------------------------------------------------- 路面
  const roadMat = litMat({ emissive: new THREE.Color('#12131e'), emissiveIntensity: 0.35 })
  const road = new MeshBuilder()
  const paint = new MeshBuilder()
  const walk = new MeshBuilder()
  const medianBushes = []

  /** 沿轴向铺一条带（x0..x1 或 z0..z1 给出宽度）。 */
  const band = (Mb, axis, at, half, from, to, y, color) => {
    const len = to - from
    const steps = Math.max(1, Math.round(Math.abs(len) / 10))
    for (let i = 0; i < steps; i++) {
      const t0 = from + (len * i) / steps
      const t1 = from + (len * (i + 1)) / steps
      if (axis === 'x') {
        const y0 = P.groundY(t0, at) + y
        const y1 = P.groundY(t1, at) + y
        Mb.quad([t0, y0, at - half], [t1, y1, at - half], [t1, y1, at + half], [t0, y0, at + half], color, 0, 1, 0)
      } else {
        const y0 = P.groundY(at, t0) + y
        const y1 = P.groundY(at, t1) + y
        Mb.quad([at - half, y0, t0], [at + half, y0, t0], [at + half, y1, t1], [at - half, y1, t1], color, 0, 1, 0)
      }
    }
  }

  // 断面色：沥青带一点紫，和「雨夜便利店」的地面同一个色系
  const ROAD_COL = '#2e2f3c'
  const WALK_COL = '#5c5a60'
  const CURB_COL = '#8a8682'
  const PAINT_COL = '#e6e0d6'
  const YEL = '#d8b25a'

  const walkW = (t) => (t <= 2 ? 3 : 2.5)

  /** 这条路在哪些位置被交叉路截断（画线要断开，不能横穿路口）。 */
  const gapsFor = (r) => {
    const out = []
    for (const o of P.ROADS) {
      if (o.a === r.a || !P.roadAt(o, r.at)) continue
      out.push([o.at - o.w / 2 - 1.5, o.at + o.w / 2 + 1.5])
    }
    return out
  }

  const segs = (from, to, gaps) => {
    let out = [[from, to]]
    for (const [g0, g1] of gaps) {
      const next = []
      for (const [a, b] of out) {
        if (g1 <= a || g0 >= b) {
          next.push([a, b])
          continue
        }
        if (g0 > a) next.push([a, g0])
        if (g1 < b) next.push([g1, b])
      }
      out = next
    }
    return out.filter(([a, b]) => b - a > 0.4)
  }

  const line = (axis, at, off, width, from, to, y, color, gaps) => {
    for (const [a, b] of segs(from, to, gaps)) band(paint, axis, at + off, width / 2, a, b, y, color)
  }
  const dash = (axis, at, off, width, from, to, y, color, gaps) => {
    for (const [a, b] of segs(from, to, gaps)) {
      for (let s = a + 1; s < b - 1; s += 9) {
        const e = Math.min(b - 0.5, s + 3.6)
        if (e - s > 1) band(paint, axis, at + off, width / 2, s, e, y, color)
      }
    }
  }

  for (const r of P.ROADS) {
    const half = r.w / 2
    const ww = walkW(r.tier)
    const curb = half - ww
    const median = r.tier === 1 ? 2.5 : r.tier === 2 ? 1.0 : 0
    const bike = r.tier <= 2 ? 2.5 : 0
    const driveOuter = curb - bike
    const gaps = gapsFor(r)
    const [a0, a1] = P.roadExtent(r)
    const ax = r.a

    // 沥青只铺车行部分，人行道在它外侧
    band(road, ax, r.at, curb, a0, a1, 0.045, ROAD_COL)
    for (const s of [-1, 1]) {
      band(walk, ax, r.at + s * (curb + (ww + 1.2) / 2), (ww + 1.2) / 2, a0, a1, 0.2, WALK_COL)
      band(walk, ax, r.at + s * (curb + 0.09), 0.09, a0, a1, 0.24, CURB_COL)
    }

    // 中央：主干道绿化带 / 次干道双黄线 / 支路黄虚线
    if (median > 0) {
      for (const [s0, s1] of segs(a0, a1, gaps)) {
        band(walk, ax, r.at, median, s0, s1, 0.22, '#33472f')
        for (const s of [-1, 1]) band(walk, ax, r.at + s * (median + 0.1), 0.1, s0, s1, 0.25, CURB_COL)
        for (let t = s0 + 4; t < s1 - 3; t += 9) {
          const bx = ax === 'x' ? t : r.at
          const bz = ax === 'x' ? r.at : t
          medianBushes.push([bx, bz])
        }
      }
    } else if (r.tier === 2) {
      for (const s of [-1, 1]) line(ax, r.at, s * 0.22, 0.1, a0, a1, 0.08, YEL, gaps)
    } else {
      dash(ax, r.at, 0, 0.1, a0, a1, 0.08, YEL, gaps)
    }

    // 机动车道边缘实线 + 车道虚线
    for (const s of [-1, 1]) {
      line(ax, r.at, s * driveOuter, 0.12, a0, a1, 0.08, PAINT_COL, gaps)
      const n = Math.max(1, Math.round((driveOuter - median) / 3.6))
      for (let k = 1; k < n; k++) dash(ax, r.at, s * (median + ((driveOuter - median) * k) / n), 0.1, a0, a1, 0.085, PAINT_COL, gaps)
    }
  }

  // 环城路
  const ring = P.ringPath(16)
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]
    const b = ring[i + 1]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz) || 1
    const nxv = (-dz / len) * (P.RING.w / 2)
    const nzv = (dx / len) * (P.RING.w / 2)
    const ya = P.groundY(a[0], a[1]) + 0.06
    const yb = P.groundY(b[0], b[1]) + 0.06
    road.quad([a[0] - nxv, ya, a[1] - nzv], [b[0] - nxv, yb, b[1] - nzv], [b[0] + nxv, yb, b[1] + nzv], [a[0] + nxv, ya, a[1] + nzv], ROAD_COL, 0, 1, 0)
    // 内侧人行道
    const ox = (dx / len) * 0.2
    const oz = (dz / len) * 0.2
    walk.quad(
      [a[0] - nxv * 1.12 + ox, ya + 0.14, a[1] - nzv * 1.12 + oz],
      [b[0] - nxv * 1.12 + ox, yb + 0.14, b[1] - nzv * 1.12 + oz],
      [b[0] - nxv * 1.05 + ox, yb + 0.14, b[1] - nzv * 1.05 + oz],
      [a[0] - nxv * 1.05 + ox, ya + 0.14, a[1] - nzv * 1.05 + oz],
      '#565b74',
      0,
      1,
      0
    )
  }

  // 老城斜街：沥青 + 两侧人行道
  for (const dg of P.DIAG) {
    const pts = []
    const n = Math.ceil(Math.hypot(dg.b[0] - dg.a[0], dg.b[1] - dg.a[1]) / 12)
    for (let i = 0; i <= n; i++) pts.push([P.lerp(dg.a[0], dg.b[0], i / n), P.lerp(dg.a[1], dg.b[1], i / n)])
    strip(road, pts, dg.w - 5, (x, z) => P.groundY(x, z) + 0.05, ROAD_COL)
    for (const sd of [-1, 1]) strip(walk, pts, 2.5, (x, z) => P.groundY(x, z) + 0.2, WALK_COL, sd * (dg.w / 2 - 1.25))
  }

  // 小河 / 中轴运河：过路的地方断开（路面当桥），两岸石砌
  {
    const onRoad = (x, z) =>
      P.ROADS.some((r) => {
        const along = r.a === 'x' ? x : z
        const [e0, e1] = P.roadExtent(r)
        return along > e0 - 1 && along < e1 + 1 && Math.abs((r.a === 'x' ? z : x) - r.at) < r.w / 2 + 1.5
      }) || z > P.CITY.z1 - 18 && z < P.CITY.z1 + 18
    const creek = new MeshBuilder()
    let run = []
    const flush = () => {
      if (run.length > 1) {
        const w = P.creekWidth(run[0][1])
        strip(creek, run, w, (x, z) => P.groundY(x, z) + 0.06, '#2c3866')
        for (const sd of [-1, 1]) strip(walk, run, 0.8, (x, z) => P.groundY(x, z) + 0.3, '#9a9285', sd * (w / 2 + 0.4))
      }
      run = []
    }
    for (let i = 0; i < P.CREEK.length - 1; i++) {
      const [ax, az] = P.CREEK[i]
      const [bx, bz] = P.CREEK[i + 1]
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4))
      for (let k = 0; k < n; k++) {
        const x = P.lerp(ax, bx, k / n)
        const z = P.lerp(az, bz, k / n)
        if (z < P.waterN(x) + 2 || onRoad(x, z)) flush()
        else run.push([x, z])
      }
    }
    flush()
    const cm = new THREE.Mesh(creek.build(), litMat({ color: '#34417a', transparent: true, opacity: 0.92, roughness: 0.22, envMapIntensity: 1.25 }))
    cm.frustumCulled = false
    scene.add(cm)
  }

  // 步行街与几处小广场：铺装换色，没有车
  band(walk, 'x', P.PEDESTRIAN.z, P.PEDESTRIAN.w / 2, P.PEDESTRIAN.x0, P.PEDESTRIAN.x1, 0.22, '#5b554b')
  for (let x = P.PEDESTRIAN.x0; x < P.PEDESTRIAN.x1; x += 6) {
    band(walk, 'x', P.PEDESTRIAN.z, P.PEDESTRIAN.w / 2 - 0.4, x, x + 0.25, 0.38, '#6a6357')
  }
  // 广场铺装用浅暖石色：夜里比沥青亮一大截，一眼看得出「这里是广场」
  for (const p of P.PLAZAS) {
    band(walk, 'x', p.z, p.d / 2, p.x - p.w / 2, p.x + p.w / 2, 0.22, '#b8ab96')
    for (let i = -2; i <= 2; i++) band(paint, 'x', p.z + i * 4, 0.12, p.x - p.w / 2, p.x + p.w / 2, 0.36, '#9a8e7c')
  }
  // 步行街口的石球
  for (let x = P.PEDESTRIAN.x0; x <= P.PEDESTRIAN.x1; x += 24) {
    const y = P.groundY(x, P.PEDESTRIAN.z - P.PEDESTRIAN.w / 2 + 1)
    walk.sphere(0.55, '#a9a49a', x, y + 0.55, P.PEDESTRIAN.z - P.PEDESTRIAN.w / 2 + 1, 6, 4)
  }

  // 斑马线：条纹沿车行方向，只铺在路口四边，不横穿路口
  for (const s of P.SIGNALS) {
    const xr = P.ROADS.find((r) => r.a === 'x' && Math.abs(r.at - s.z) < 2)
    const zr = P.ROADS.find((r) => r.a === 'z' && Math.abs(r.at - s.x) < 2)
    if (!xr || !zr) continue
    const hx = xr.w / 2 - walkW(xr.tier)
    const hz = zr.w / 2 - walkW(zr.tier)
    for (const sx of [-1, 1]) {
      const cx = s.x + sx * (hz + 2.6)
      for (let z = s.z - hx + 0.7; z <= s.z + hx - 0.7; z += 1.1) {
        paint.box(3.2, 0.06, 0.52, PAINT_COL, cx, P.groundY(cx, z) + 0.09, z, 0, { skipBottom: false })
      }
    }
    for (const sz of [-1, 1]) {
      const cz = s.z + sz * (hx + 2.6)
      for (let x = s.x - hz + 0.7; x <= s.x + hz - 0.7; x += 1.1) {
        paint.box(0.52, 0.06, 3.2, PAINT_COL, x, P.groundY(x, cz) + 0.09, cz, 0, { skipBottom: false })
      }
    }
  }

  /**
   * 全城合并网格按 240m 一格切块：每块有自己的包围球，视锥剔除和阴影相机才剔得掉看不见的部分
   * （整城一个网格时，每帧主画面 + 阴影各画一遍全城）
   */
  const CELL = 240
  const addSplit = (geo, mat, o = {}) => {
    if (!geo) return null
    if (geo.index) geo = geo.toNonIndexed()
    const pos = geo.attributes.position
    const pa = pos.array
    const names = Object.keys(geo.attributes)
    // 两遍扫：先把每个三角形归到某个格子（Int32Array，不建数组对象），再按格子的偏移量整段拷贝
    const nt = pos.count / 3
    const owner = new Int32Array(nt)
    const cells = []
    const cellOf = new Map()
    for (let t = 0; t < nt; t++) {
      const i = t * 9
      const cx = (pa[i] + pa[i + 3] + pa[i + 6]) / 3
      const cz = (pa[i + 2] + pa[i + 5] + pa[i + 8]) / 3
      const k = (Math.floor(cx / CELL) + 100) * 1000 + Math.floor(cz / CELL) + 100
      let ci = cellOf.get(k)
      if (ci === undefined) cellOf.set(k, (ci = cells.length)), cells.push({ k, n: 0, at: 0, tris: null })
      owner[t] = ci
      cells[ci].n++
    }
    for (const c of cells) c.tris = new Int32Array(c.n)
    const fill = new Int32Array(cells.length)
    for (let t = 0; t < nt; t++) {
      const c = cells[owner[t]]
      c.tris[fill[owner[t]]++] = t
    }
    let first = null
    for (const bucket of cells) {
      const tris = bucket.tris
      const g = new THREE.BufferGeometry()
      // 包围球在搬 position 的那一遍里顺手算掉：addSplit 每个三角形都要遍历一次顶点，
      // 单独再跑一次 fastSphere 等于白扫一遍全集（全城几百万三角形，这里是几百毫秒）
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity
      for (const name of names) {
        const a = geo.attributes[name]
        const sz = a.itemSize
        const src = a.array
        const arr = new a.array.constructor(tris.length * 3 * sz)
        const chunk = 3 * sz
        let off = 0
        // 直接按下标搬，不用 subarray：每次 subarray 都会建一个视图对象，几十万次就是 GC 的主因
        if (sz === 3 && name === 'position') {
          for (let q = 0; q < tris.length; q++) {
            for (let e = tris[q] * chunk, end = e + chunk; e < end; e += 3) {
              const x = src[e]
              const y = src[e + 1]
              const z = src[e + 2]
              arr[off++] = x
              arr[off++] = y
              arr[off++] = z
              if (x < x0) x0 = x
              if (x > x1) x1 = x
              if (y < y0) y0 = y
              if (y > y1) y1 = y
              if (z < z0) z0 = z
              if (z > z1) z1 = z
            }
          }
        } else {
          for (let q = 0; q < tris.length; q++) {
            for (let e = tris[q] * chunk, end = e + chunk; e < end; e++) arr[off++] = src[e]
          }
        }
        g.setAttribute(name, new THREE.BufferAttribute(arr, sz))
      }
      g.boundingSphere = new THREE.Sphere(
        new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
        Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2
      )
      const m = new THREE.Mesh(g, mat)
      if (o.shadow) {
        m.castShadow = true
        m.receiveShadow = true
      } else if (o.receive) m.receiveShadow = true
      if (o.order !== undefined) m.renderOrder = o.order
      scene.add(m)
      first = first || m
    }
    geo.dispose()
    return first
  }
  const addMesh = (Mb, mat, shadow = true) => addSplit(Mb.build(), mat, { shadow }) || new THREE.Object3D()
  addSplit(groundLater, groundMat, { receive: true })

  // 开了对数深度之后 polygonOffset 不起作用，共面的路面会按像素来回闪。
  // 在片元深度上把后铺的一层往镜头前推一点点（正交阴影相机不推，避免影子跟着花）。
  const biasDepth = (mat, d) => {
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <logdepthbuf_fragment>',
        `#include <logdepthbuf_fragment>\n#if defined( USE_LOGDEPTHBUF )\n\tif (vIsPerspective != 0.0) gl_FragDepth += ${d};\n#endif`
      )
    }
    mat.customProgramCacheKey = () => 'depthbias' + d
  }
  biasDepth(roadMat, -0.00018)
  addMesh(road, roadMat, false)
  const paintMat = litMat({ roughness: 0.9 })
  biasDepth(paintMat, -0.0005)
  addMesh(paint, paintMat, false)
  const walkMat = roadMat.clone()
  biasDepth(walkMat, -0.00034)
  addMesh(walk, walkMat, false)

  await step('起楼', 34)
  // ---------------------------------------------------------------- 建筑
  const faceInfo = (b, side) => {
    if (side === 's') return { x: b.x, z: b.z + b.d / 2, nx: 0, nz: 1, w: b.w, rot: 0 }
    if (side === 'n') return { x: b.x, z: b.z - b.d / 2, nx: 0, nz: -1, w: b.w, rot: Math.PI }
    if (side === 'e') return { x: b.x + b.w / 2, z: b.z, nx: 1, nz: 0, w: b.d, rot: Math.PI / 2 }
    return { x: b.x - b.w / 2, z: b.z, nx: -1, nz: 0, w: b.d, rot: -Math.PI / 2 }
  }

  const facade = (Mb, f, cx, y, w, h, color, out = 0.02) => {
    const tx = f.nz
    const tz = -f.nx
    // 贴面统一往外抬一档：层与层之间至少留 1.8cm，远处看才不会两层面互相争深度（闪）
    const o = 0.02 + out * 1.7
    const x = f.x + f.nx * o
    const z = f.z + f.nz * o
    Mb.quad(
      [x - tx * (w / 2) + tx * cx, y, z - tz * (w / 2) + tz * cx],
      [x - tx * (w / 2) + tx * cx + tx * w, y, z - tz * (w / 2) + tz * cx + tz * w],
      [x - tx * (w / 2) + tx * cx + tx * w, y + h, z - tz * (w / 2) + tz * cx + tz * w],
      [x - tx * (w / 2) + tx * cx, y + h, z - tz * (w / 2) + tz * cx],
      color,
      f.nx,
      0,
      f.nz
    )
  }

  // 楼角竖向霓虹灯条：像素画最典型的一笔 —— 一条纯色亮线从裙房拉到檐口
  // 霓虹灯带：青 / 品红 / 暖橙为主（参考图那三色），紫绿作少量变化
  const NEON_STRIP = ['#26d8ff', '#ff3d8a', '#ff9a2e', '#c07bff', '#3de0ff', '#ff5ab0', '#ffd23d']
  const cornerNeon = (b, bottom) => {
    // 霓虹灯条：步行街 / 商业带多一点，进 glow（白天关掉）
    if (b.compound || b.kind === 'site' || b.kind === 'village' || b.kind === 'stadium') return
    if (b.h < 8 || b.h > 260) return
    const d = b.district
    const p = d === 'E' ? 0.5 : d === 'M' ? 0.28 : d === 'C' ? 0.1 : 0.04
    if (rnd01(b, 88) > p) return
    const c0 = NEON_STRIP[Math.floor(rnd01(b, 89) * NEON_STRIP.length)]
    const c1 = NEON_STRIP[Math.floor(rnd01(b, 90) * NEON_STRIP.length)]
    const y0 = bottom + (b.shops ? 4.6 : 2.6)
    const hh = b.h - (y0 - bottom) - 1.2
    if (hh < 4) return
    let k = 0
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      if (kv_[k++] !== 0) continue
      glow.box(0.22, hh, 0.22, (k % 3 ? c0 : c1), b.x + sx * (b.w / 2 - 0.1), y0 + hh / 2, b.z + sz * (b.d / 2 - 0.1), 0)
      haloExtra.push([b.x + sx * (b.w / 2), y0 + hh * 0.5, b.z + sz * (b.d / 2), c0])
    }
    glow.box(b.w + 0.22, 0.12, b.d + 0.22, c1, b.x, bottom + b.h - 1.1, b.z, 0)
  }
  const kv_ = [0, 1, 1, 0]

  /** 四角壁柱：让一个盒子有「转角」，是低层楼最重要的轮廓线。 */
  const pilasters = (b, y0, h, col, out = 0.12, w = 0.42) => {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        solid.box(w, h, w, col, b.x + sx * (b.w / 2 - w / 2 + out), y0 + h / 2, b.z + sz * (b.d / 2 - w / 2 + out), 0)
  }

  await step('砌立面与窗', 44)
  // ------------------------------------------------------------------ 立面
  // 全城一套模数：开间固定、窗宽统一、层线连续。乱的不是数量，是没有模数。
  // 窗小、墙多：远看楼是一整块体量，亮窗是零星的点；大窗洞铺满立面会读成格子贴图
  // 巷弄尺度：人高感竖窗（约 1.5×1.6），不是 CBD 那种细幕墙格
  const F = { bay: 3.2, winH: 1.55, ratio: 0.5, sill: 0.95, edge: 1.2, floor: P.SCALE.floor }
  const _shc = new THREE.Color()
  /** 在同一个色相上压暗 / 提亮，保证墙、线脚、窗框属于同一种材料。 */
  const shade = (hex, k) => {
    _shc.set(hex)
    _shc.multiplyScalar(k)
    return '#' + _shc.getHexString()
  }
  /** 屋面：住宅偏暖石板，塔楼偏冷灰，俯视片区一眼能分 */
  const _rfc = new THREE.Color()
  const SLATE_WARM = new THREE.Color('#a89888')
  const SLATE_COOL = new THREE.Color('#8a909a')
  const SKY_GLASS = new THREE.Color('#9a989e')
  const roofOf = (b) => {
    const cool = b.office || b.kind === 'office' || b.kind === 'tower' || b.district === 'A' || b.district === 'T'
    return '#' + _rfc.set(b.color || '#6a6e80').lerp(cool ? SLATE_COOL : SLATE_WARM, 0.68).getHexString()
  }
  // 往白里提：室内的东西都在灯下，不能按室外夜色去配色（雨夜便利店的店内就是一片白亮）
  const _litc = new THREE.Color()
  const WHITE = new THREE.Color('#ffffff')
  const lit = (hex, t = 0.34) => {
    _litc.set(hex).lerp(WHITE, t)
    return '#' + _litc.getHexString()
  }
  const lum = (hex) => {
    _litc.set(hex)
    return 0.2126 * _litc.r + 0.7152 * _litc.g + 0.0722 * _litc.b
  }
  // 灯光在湿地面上摊开的一滩：中心亮、边缘完全消失，不能是一块硬边方片
  /**
   * 地面灯光的衰减（d：0 灯下 ~ 1 贴片边缘）：平方反比 1/(1+(d/r0)²) 给出「灯下亮、外圈拖很长的淡尾」，
   * 再乘 (1-d²)² 让尾巴在边缘平滑归零。高斯会把光收成一团，读起来是贴片。
   */
  // 便宜的值噪声（几层不同频率的 sin 叠加）：把光池边缘推得不规则，不再是数学上的正圆
  const wobble = (x, y) =>
    Math.sin(x * 12.9898 + y * 78.233) * 0.5 + Math.sin(x * 39.346 + y * 11.135) * 0.32 + Math.sin(x * 73.156 + y * 52.235) * 0.18
  /**
   * 光池衰减：亮芯 + 长尾。pow(1-d², 1.8) 给一片平台状的亮区，
   * 乘一个随 d 衰减的芯项让中心不炸，整体峰值压到 ~0.6 ——
   * 加法混合下 alpha 越高越像「一块灯牌」而不是「一滩光」。
   * 边缘半径被低频噪声推来拱去，相邻灯的光才会自然糊在一起。
   */
  const poolByte = (xx, yy, w, h) => {
    const d = Math.hypot((xx - w / 2 + 0.5) / (w / 2), (yy - h / 2 + 0.5) / (h / 2))
    if (d >= 1) return 0
    const de = d * (1 + 0.14 * wobble(xx * 0.07, yy * 0.07))
    if (de >= 1) return 0
    const a = Math.pow(1 - de * de, 1.8) * (0.5 + 0.5 * Math.exp(-de * de * 7)) * 0.62
    // 8 位量化会出一圈圈色阶；加一点随机抖动打散
    return Math.max(0, Math.min(255, Math.round(a * 255 + Math.random() - 0.5)))
  }
  const shopPoolTex = cvTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h)
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const o = (yy * w + xx) * 4
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
        img.data[o + 3] = poolByte(xx, yy, w, h)
      }
    }
    g.putImageData(img, 0, 0)
  })
  // 右图夜巷窗光：暖白琥珀为主，少量冷蓝；彩色留给霓虹招牌
  const LIT = ['#ffb050', '#ffc878', '#ffa040', '#ffe0a8']
  const BRIGHT = ['#ffe8b8']
  const LIT_COOL = ['#d8e8ff', '#c8daf0']
  const LIT_NEON = ['#ffb050', '#ffc878', '#8ec8ff']
  const CANDY = ['#8ec8ff', '#ff9ad0']
  const DIM = ['#2a3140']

  const hash = (a, b, c) => {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }

  const faceOf = (cx, cz, w, d, side) => {
    if (side === 's') return { x: cx, z: cz + d / 2, nx: 0, nz: 1, w }
    if (side === 'n') return { x: cx, z: cz - d / 2, nx: 0, nz: -1, w }
    if (side === 'e') return { x: cx + w / 2, z: cz, nx: 1, nz: 0, w: d }
    return { x: cx - w / 2, z: cz, nx: -1, nz: 0, w: d }
  }

  /**
   * 一面墙按开间 × 楼层铺窗。返回开间信息，供阳台/空调/防盗网对齐。
   * 每层画一条楼板线 + 每个窗一条窗台阴影：这两条线让立面立刻有尺度。
   */
  /** 墙外 7m 内有别的楼时，被它挡住的高度（绝对 y）；这一段不开窗 —— 挨得很近的墙是山墙 */
  const BOXES = P.buildings.map((n) => ({ x0: n.x - n.w / 2, x1: n.x + n.w / 2, z0: n.z - n.d / 2, z1: n.z + n.d / 2, top: P.groundY(n.x, n.z) + n.h }))
  const clearOf = (f) => {
    let top = -Infinity
    const a0 = (f.nz !== 0 ? f.x : f.z) - f.w / 2 + 0.8
    const a1 = (f.nz !== 0 ? f.x : f.z) + f.w / 2 - 0.8
    for (const n of BOXES) {
      if (n.top <= top) continue
      let gap
      if (f.nz !== 0) {
        if (n.x1 < a0 || n.x0 > a1) continue
        gap = f.nz > 0 ? n.z0 - f.z : f.z - n.z1
      } else {
        if (n.z1 < a0 || n.z0 > a1) continue
        gap = f.nx > 0 ? n.x0 - f.x : f.x - n.x1
      }
      if (gap > -0.4 && gap < 7) top = n.top
    }
    return top
  }
  /** 正对面最近一栋楼的距离：小于 15m 说明这面墙是「贴脸墙」，不该铺满窗 */
  const faceGapAhead = (f) => {
    let g = Infinity
    for (const n of BOXES) {
      let d
      if (f.nz !== 0) {
        if (Math.abs((n.x0 + n.x1) / 2 - f.x) > (n.x1 - n.x0) / 2 + f.w / 2) continue
        d = f.nz > 0 ? n.z0 - f.z : f.z - n.z1
      } else {
        if (Math.abs((n.z0 + n.z1) / 2 - f.z) > (n.z1 - n.z0) / 2 + f.w / 2) continue
        d = f.nx > 0 ? n.x0 - f.x : f.x - n.x1
      }
      if (d > -0.4 && d < g) g = d
    }
    return g
  }
  /**
   * 会变的窗：暗窗里挑一部分，另建一层实例面板，每隔一会儿各自亮/灭。
   * 只挑暗窗 —— 亮窗已经烘进合并网格里了，在上面再叠一层只会更白。
   */
  const LIVE_WIN = []
  const LIVE_MAX = 6000
  const pushLive = (f, cx, y, w, h, seed, tone = 'warm') => {
    if (LIVE_WIN.length >= LIVE_MAX) return
    if (hash(seed, 3, 11) > 0.04) return
    LIVE_WIN.push({ f, cx, y, w, h, tone, ph: hash(seed, 7, 5) * 40, rate: 0.12 + hash(seed, 9, 13) * 0.5 })
  }

  const FOCUS = { x: (P.SUNKEN.x0 + P.SUNKEN.x1) / 2, z: (P.SUNKEN.z0 + P.SUNKEN.z1) / 2, r: 85 }
  const inFocus = (b) => Math.hypot(b.x - FOCUS.x, b.z - FOCUS.z) < FOCUS.r && !b.office && b.kind !== 'office'
  /** 功能色：同一座城靠窗光就分出用途 —— 办公冷白、商业霓虹、住宅暖黄 */
  const toneOf = (b) => {
    // 霓虹只集中在下沉广场（广告墙所在）+ 商场 + 步行街，做全城的彩色焦点；其余街区一律暖光
    if (b.kind === 'mall' || b.district === 'E' || inFocus(b)) return 'neon'
    if (b.office || b.kind === 'office' || b.kind === 'tower' || b.district === 'A' || b.district === 'T') return 'cool'
    return 'warm'
  }
  const neonOf = (b) => {
    if (b.kind === 'mall' || inFocus(b)) return 0.2
    if (b.district === 'E') return 0.14
    if (b.district === 'M') return 0.08
    return 0.02
  }

  /** 广告牌占位：{ f, cx, y0, w, h, land, d }。挂了广告牌的那块墙不再开窗、不挂阳台 */
  const ROOF_JOBS = []
  const AD_PLAN = []
  const adsOn = (f) =>
    AD_PLAN.filter((a) => a.f.nx === f.nx && a.f.nz === f.nz && Math.abs(a.f.x - f.x) < 1.2 && Math.abs(a.f.z - f.z) < 1.2)
  const adHit = (ads, cx, y, w, h) => ads.some((a) => Math.abs(cx - a.cx) < (a.w + w) / 2 + 0.3 && y + h > a.y0 - 0.4 && y < a.y0 + a.h + 0.4)
  const facadeGrid = (f, y0, height, o = {}) => {
    const edge = o.edge ?? F.edge
    const span = f.w - 2 * edge
    if (span < 2.6) return null
    const bay = o.bay || F.bay
    // sparse：贴脸墙 / 后墙上的小窗（卫生间、楼梯间），比正立面少一半、小一号
    const sp = !!o.sparse
    let cols = Math.max(1, Math.min(o.maxCols || 30, Math.round(span / bay)))
    if (sp) cols = Math.max(1, Math.round(cols / 2))
    const cw = span / cols
    const winW = cw * (o.ratio ?? F.ratio) * (sp ? 0.6 : 1)
    const winH = (o.winH ?? F.winH) * (sp ? 0.68 : 1)
    const sill = (o.sill ?? F.sill) + (sp ? 0.55 : 0)
    const wantH = o.floorH ?? F.floor
    // 层数取整后把层高均分，立面上下不会留下一条没窗的空白带
    const floors = Math.max(1, Math.round(height / wantH))
    const floorH = height / floors
    if (floorH < sill + winH + 0.2) return null
    const seedX = Math.round(f.x * 2.3)
    const seedZ = Math.round(f.z * 1.7)
    const seedS = Math.round(f.nx * 31 + f.nz * 17)
    // 线脚只比墙色深一点（雨夜便利店：墙 #cbb6a6 / 线 #b49f90），重了窗就成了贴纸
    const body = o.body || '#c8cfd6'
    const bandCol = o.bandColor || shade(body, 0.9)
    const trimCol = o.trim || shade(body, 0.78)
    const frameCol = o.frame || shade(body, 0.62)
    const sillCol = o.sillColor || shade(body, 1.12)
    const clear = clearOf(f)
    const ads = adsOn(f)
    // 功能色：tone 决定这栋楼的灯是什么色系，neon 决定里面掺多少彩色窗
    const tone = o.tone || (o.cool ? 'cool' : 'warm')
    const LITS = tone === 'cool' ? LIT_COOL : tone === 'neon' ? LIT_NEON : LIT
    // 彩色窗很少：青/粉留给招牌；窗本身暖琥珀或少量冷蓝
    const neonP = o.neon ?? (tone === 'neon' ? 0.12 : tone === 'cool' ? 0 : 0.03)
    const darkWin = '#2e3644'
    // 巷弄夜景亮窗略密一点，才有「有人住」
    const litRate = tone === 'neon' ? 0.42 : Math.min(0.4, 0.15 / Math.max(0.05, o.dark ?? 0.3))
    // 亮窗黑框：光被框住，细节不会被 bloom 吃掉（右图关键）
    const litFrame = '#12141a'
    for (let j = 0; j < floors; j++) {
      const fy = y0 + j * floorH
      if (fy + floorH * 0.8 < clear) continue
      if (j % 2 === 0) facade(trim, f, 0, fy, span + edge * 0.85, 0.14, bandCol, 0.012)
      for (let i = 0; i < cols; i++) {
        const cx = -span / 2 + (i + 0.5) * cw
        if (ads.length && adHit(ads, cx, fy, winW, floorH)) continue
        if (hash(seedX + i * 11 + seedS, seedZ + j * 19, 41) < 0.06) continue
        const r = hash(seedX + i * 13, seedZ + j * 29, seedS)
        const fMode = hash(seedX + 3, seedZ + j * 31, 91)
        const lit = r > 1 - litRate * (0.3 + fMode * 1.4)
        const rc = hash(seedX + i * 7, seedZ + j * 13, 57)
        const baseCol = r > 0.94 ? BRIGHT[0] : LITS[Math.floor(hash(seedX + i, seedZ + j, 7) * LITS.length) % LITS.length]
        const col = lit
          ? shade(rc < neonP ? CANDY[Math.floor(hash(seedX + i * 3, seedZ + j * 5, 21) * CANDY.length) % CANDY.length] : baseCol, 0.9 + hash(seedX + i * 9, seedZ + j * 27, 77) * 0.18)
          : darkWin
        const wy = fy + sill
        if (!lit) {
          facade(glass, f, cx, wy, winW, winH, darkWin, 0.03)
          if (!o.noLive) pushLive(f, cx, wy, winW, winH, seedX + i * 17 + seedZ * 3 + j * 29, tone)
          continue
        }
        // 黑窗框包住暖光
        facade(trim, f, cx, wy - 0.08, winW + 0.28, winH + 0.26, litFrame, 0.026)
        facade(glass, f, cx, wy, winW, winH, darkWin, 0.03)
        facade(glow, f, cx, wy, winW * 0.92, winH * 0.92, col, 0.05)
        if (rc > 0.58) facade(glow, f, cx, wy, winW * 0.92, winH * 0.38, shade(col, 0.7), 0.056)
        // 中挺十字：亮着也能看出窗格
        facade(trim, f, cx, wy + winH * 0.42, winW * 0.88, 0.05, litFrame, 0.058)
        facade(trim, f, cx, wy + winH * 0.12, 0.05, winH * 0.78, litFrame, 0.058)
        facade(trim, f, cx, wy - 0.16, winW + 0.34, 0.1, sillCol, 0.07)
        if (o.life) windowLife(f, cx, wy, winW, winH, lit, hash(seedX + i * 7, seedZ + j * 11, seedS + 5), j)
      }
    }
    return { cols, cw, winW, span, edge, floorH, sill, floors, clear, ads }
  }

  /**
   * CBD 塔楼的玻璃幕墙：整层通透玻璃 + 每层一道深色层间板（spandrel），
   * 格子占满开间 —— 和普通建筑「一格格小窗」完全是两种立面语言。
   * 夜里写字楼是成片的光：整层随机亮 / 暗，亮层里大部分格子一起亮。
   */
  // 幕墙：楼层高 × 约 1.1m 宽的细竖格（参考真实写字楼），不要一人高的大方窗
  const GLASS_TONE = '#3a4658'
  const curtainWall = (f, y0, y1, o = {}) => {
    const edge = o.edge ?? 0.35
    const span = f.w - 2 * edge
    if (span < 4) return null
    const bay = o.bay || 1.1
    const cols = Math.max(2, Math.min(o.maxCols || 72, Math.round(span / bay)))
    const cw = span / cols
    const floorH = o.floorH || P.SCALE.floor
    const floors = Math.max(1, Math.round((y1 - y0) / floorH))
    const fh = (y1 - y0) / floors
    // 薄层间板 + 细竖缝：远看是密竖条，不是大方块
    const spandrelH = Math.min(0.38, fh * 0.09)
    const glassH = fh - spandrelH - 0.05
    if (glassH < 1) return null
    const seedX = Math.round(f.x * 2.1)
    const seedZ = Math.round(f.z * 1.9)
    const seedS = Math.round(f.nx * 31 + f.nz * 17)
    const body = o.body || '#6a7688'
    const spandrel = o.spandrel || shade(body, 1.15)
    const mullion = shade(body, 0.88)
    for (let j = 0; j < floors; j++) {
      const fy = y0 + j * fh
      facade(solid, f, 0, fy, span, spandrelH + 0.03, spandrel, 0.018)
      const gy = fy + spandrelH + 0.03
      const floorLit = hash(seedX + 7, seedZ + j * 31, seedS + 11) > 0.74
      for (let i = 0; i < cols; i++) {
        const cx = -span / 2 + (i + 0.5) * cw
        const r = hash(seedX + i * 17, seedZ + j * 23, seedS + 5)
        // 同色相内极小明度差，做出棋盘反射，不要跳色
        const pane = shade(GLASS_TONE, 0.9 + r * 0.18)
        // 玻璃略收，露出细竖梃（楼身色）
        facade(glass, f, cx, gy, cw * 0.9, glassH, pane, 0.04)
        if (floorLit && r > 0.52) {
          const col = shade(LIT_COOL[Math.floor(hash(seedX + i, seedZ + j, 3) * LIT_COOL.length) % LIT_COOL.length], 0.76)
          facade(glow, f, cx, gy, cw * 0.88, glassH, col, 0.055)
        }
      }
      // 每隔几格一道略明显的竖梃，结构感，但不粗
      for (let i = 4; i < cols; i += 4) {
        facade(solid, f, -span / 2 + i * cw, gy, 0.05, glassH, mullion, 0.045)
      }
    }
    return { span, cols, cw, fh }
  }

  /** 贴墙的小体块：a 沿墙（右为正），o 离墙距离。 */
  const wallBox = (Mb, f, a, o, yc, wa, h, dep, col) => {
    const tx = f.nz
    const tz = -f.nx
    Mb.box(f.nx === 0 ? wa : dep, h, f.nx === 0 ? dep : wa, col, f.x + tx * a + f.nx * o, yc, f.z + tz * a + f.nz * o, 0)
  }

  /** 住宅窗户的生活痕迹：彩色窗帘、窗里的盆栽剪影、窗台花箱。 */
  const windowLife = (f, cx, wy, winW, winH, lit, r, floor) => {
    if (lit && r < 0.18) facade(glow, f, cx - winW * 0.3, wy + winH * 0.06, winW * 0.28, winH * 0.9, CURTAIN[Math.floor(r * 97) % CURTAIN.length], 0.058)
    if (lit && r > 0.84) {
      facade(glow, f, cx + winW * 0.22, wy, winW * 0.2, winH * 0.32, '#5a3a32', 0.059)
      facade(glow, f, cx + winW * 0.22, wy + winH * 0.32, winW * 0.3, winH * 0.16, '#3f5a3a', 0.059)
    }
    if (floor < 6 && r > 0.5 && r < 0.62) {
      wallBox(trim, f, cx, 0.18, wy - 0.02, winW * 0.8, 0.2, 0.24, '#a8643e')
      wallBox(trim, f, cx, 0.18, wy + 0.09, winW * 0.62, 0.1, 0.18, '#4f8a4e')
    }
  }

  const windows = (b, side, y0, floors, opts = {}) => {
    if (b.tier === 'C') return null
    const f = faceInfo(b, side)
    const bottom = P.groundY(b.x, b.z) - 0.2
    const room = bottom + b.h - 0.5 - y0
    const height = Math.min(opts.height ?? (floors || Math.floor(b.h / F.floor)) * F.floor, room)
    if (height < 2) return null
    return facadeGrid(f, y0, height, opts)
  }

  /** 阳台：挂在某个开间上，同一条竖线从上到下，才不会读成随机盒子。 */
  const balcony = (f, cx, y, w) => {
    const tx = f.nz
    const tz = -f.nx
    const out = 0.92
    const bx = f.x + f.nx * 0.5 + tx * cx
    const bz = f.z + f.nz * 0.5 + tz * cx
    const r = hash(Math.round(bx * 3), Math.round(y * 5), Math.round(bz * 3))
    const toward = (k) => [f.x + f.nx * k + tx * cx, f.z + f.nz * k + tz * cx]
    // 底板：一块薄板，不出挑太多（挑太多整排都成了凸出来的盒子）
    if (f.nx === 0) trim.box(w, 0.1, out, '#8d949c', bx, y, bz, 0, { skipBottom: false })
    else trim.box(out, 0.1, w, '#8d949c', bx, y, bz, 0, { skipBottom: false })
    // 栏杆：上横杆 + 下横杆 + 几根细立柱，中间是透的（能看见窗，才不像一坨黑）
    const [fx2, fz2] = toward(0.5 + out - 0.05)
    const railC = '#9aa1a8'
    if (f.nx === 0) {
      trim.box(w, 0.07, 0.07, railC, fx2, y + 0.88, fz2, 0)
      trim.box(w, 0.05, 0.05, railC, fx2, y + 0.16, fz2, 0)
    } else {
      trim.box(0.07, 0.07, w, railC, fx2, y + 0.88, fz2, 0)
      trim.box(0.05, 0.05, w, railC, fx2, y + 0.16, fz2, 0)
    }
    const nR = Math.max(3, Math.round(w / 0.46))
    for (let k = 1; k < nR; k++) {
      const a = -w / 2 + (k * w) / nR
      const px2 = fx2 + tx * a
      const pz2 = fz2 + tz * a
      if (f.nx === 0) trim.box(0.035, 0.74, 0.035, railC, px2, y + 0.52, pz2, 0)
      else trim.box(0.035, 0.74, 0.035, railC, px2, y + 0.52, pz2, 0)
    }
    // 侧栏杆只做靠外的半截，不做一堵立板
    for (const sd of [-1, 1]) {
      const a0 = sd * (w / 2 - 0.05)
      const [sx2, sz2] = toward(0.5 + out / 2)
      const ax = sx2 + tx * a0
      const az = sz2 + tz * a0
      if (f.nx === 0) trim.box(0.05, 0.07, out * 0.9, railC, ax, y + 0.88, az, 0)
      else trim.box(out * 0.9, 0.07, 0.05, railC, ax, y + 0.88, az, 0)
    }

    // 生活痕迹：晾的衣服 / 一盆绿植 / 偶尔一串小灯
    const at = (a, o) => [bx + tx * a + f.nx * o, bz + tz * a + f.nz * o]
    const sideBox = (a, o, yc, wa, h, dep, col, Mb = trim) => {
      const [px2, pz2] = at(a, o)
      Mb.box(f.nx === 0 ? wa : dep, h, f.nx === 0 ? dep : wa, col, px2, yc, pz2, 0)
    }
    if (r < 0.34) {
      const n = 2 + (Math.floor(r * 10) % 2)
      for (let k = 0; k < n; k++) {
        const a = -w / 2 + 0.4 + (k + 0.5) * ((w - 0.8) / n)
        const ch = 0.45 + ((r * 53 + k) % 1) * 0.28
        sideBox(a, 0.14, y + 0.9 - ch / 2, 0.4, ch, 0.035, CLOTH[Math.floor(r * 211 + k * 5) % CLOTH.length])
      }
    }
    if (r > 0.55 && r < 0.78) {
      const a = (r > 0.66 ? 1 : -1) * (w / 2 - 0.4)
      sideBox(a, out / 2 - 0.2, y + 0.24, 0.3, 0.26, 0.3, '#b0643c')
      const [px2, pz2] = at(a, out / 2 - 0.2)
      trim.sphere(0.26, '#4f8a4e', px2, y + 0.56, pz2, 6, 4)
    }
    if (r > 0.9) {
      const [hx, hz] = at(0, 0.5 + out)
      for (let k = 0; k < 5; k++) {
        const a = -w / 2 + 0.3 + (k * (w - 0.6)) / 4
        sideBox(a, 0.5 + out, y + 0.9, 0.07, 0.07, 0.07, k % 2 ? '#ffd27a' : '#ffb86b', glow)
      }
      haloExtra.push([hx, y + 0.88, hz, '#ffcf7a'])
    }
  }

  const acUnit = (f, cx, y) => {
    const x = f.x + f.nx * 0.4 + (f.nx === 0 ? cx : 0)
    const z = f.z + f.nz * 0.4 + (f.nz === 0 ? cx : 0)
    const ry = f.nx === 0 ? 0 : Math.PI / 2
    trim.box(0.86, 0.56, 0.4, '#8e959b', x, y, z, ry)
    trim.box(0.68, 0.05, 0.46, '#7c838a', x, y + 0.27, z, ry)
  }

  const entryDoor = (b, side, name) => {
    const f = faceInfo(b, side)
    const fh = P.SCALE.door
    const y = P.groundY(f.x, f.z) + 0.2
    // 门斗 + 溢光 + 地垫 + 雨棚
    solid.box(f.nx === 0 ? 2.4 : 0.3, fh, f.nx === 0 ? 0.3 : 2.4, '#2a3036', f.x + f.nx * 0.1, y, f.z + f.nz * 0.1, 0)
    glow.quad(
      [f.x - f.nz * 1.1 + f.nx * 0.06, y + 0.4, f.z + f.nx * 1.1 + f.nz * 0.06],
      [f.x + f.nz * 1.1 + f.nx * 0.06, y + 0.4, f.z - f.nx * 1.1 + f.nz * 0.06],
      [f.x + f.nz * 1.1 + f.nx * 0.06, y + fh, f.z - f.nx * 1.1 + f.nz * 0.06],
      [f.x - f.nz * 1.1 + f.nx * 0.06, y + fh, f.z + f.nx * 1.1 + f.nz * 0.06],
      '#ffd9a2',
      f.nx,
      0,
      f.nz
    )
    solid.box(f.nx === 0 ? 3.2 : 1.4, 0.08, f.nx === 0 ? 1.4 : 3.2, '#3a3f45', f.x + f.nx * 0.8, y + 0.02, f.z + f.nz * 0.8, 0, { skipBottom: false })
    solid.box(f.nx === 0 ? 3.6 : 1.6, 0.16, f.nx === 0 ? 1.6 : 3.6, '#5a6167', f.x + f.nx * 1.4, y + 2.9, f.z + f.nz * 1.4, 0)
    doors.push({ x: f.x + f.nx * 1.6, z: f.z + f.nz * 1.6, y, name, kind: b.kind, b })
  }

  await step('布置店内', 54)
  // ---------------------------------------------------------------- 店内实景
  // 1:1 的真店面：楼的首层正面被掏空，店内是一间 3.4m 深、2.6m 高的真房间，
  // 地面 / 吊顶 / 后墙 / 侧墙 / 家具设备全部是真几何，按业态各建各的。
  // 坐标：a 沿门面（右为正）、d 由后墙向街（0 → 橱窗）、y 绝对高度。
  const GOODS = ['#e2584b', '#e8a13c', '#f2d75e', '#5aa86a', '#4a90c8', '#8a6ac8', '#e88aa8', '#efeee8', '#c9503c', '#68b0a0']
  const FRUIT = ['#d94b3c', '#e8a02c', '#f0d34a', '#7ab84a', '#c85a2a', '#8ab03a', '#e07a8a']
  const FLOWER = ['#e85a7a', '#f0c85a', '#d878c8', '#f4f0e8']
  const ARCH_OF = {
    store: 'shelves', market: 'shelves', pharmacy: 'shelves', liquor: 'shelves', deli: 'deli',
    stationery: 'shelves', book: 'shelves', baby: 'shelves', pet: 'shelves', music: 'shelves',
    hardware: 'shelves', glasses: 'shelves',
    fastfood: 'dining', noodle: 'dining', rest: 'dining', restaurant: 'dining', hotpot: 'dining',
    bbq: 'dining', breakfast: 'dining',
    tea: 'drinks', coffee: 'drinks', bakery: 'display', fruit: 'display', flower: 'display',
    ktv: 'night', netbar: 'night', escape: 'night', billiard: 'night', gym: 'night', spa: 'night',
    bank: 'night',
    barber: 'service', beauty: 'service', phone: 'service', print: 'service', parcel: 'service',
    estate: 'service', lottery: 'service', laundry: 'service', repair: 'service', tailor: 'racks',
    retail: 'racks', service: 'service',
  }

  const buildShopInterior = ({ kind, x, z, nx, nz, fy, sw, D, rr, ink, h }) => {
    const ux = nz
    const uz = -nx
    const at = (a, d) => [x + ux * a + nx * d, z + uz * a + nz * d]
    const box = (a, d, yc, wa, hb, dep, col, Mb) => {
      const b = Mb || inner
      // 灯下：颜色先往白里提，再按进深做一点衰减，靠里稍暗、靠门稍亮，保留纵深
      // 只提 12%，别把颜色洗成白纸；进深方向上从 0.78（后墙）到 1.0（靠门）
      const c = b === inner ? shade(lit(col, 0.12), 0.78 + 0.22 * Math.min(1, d / D)) : col
      const [px, pz] = at(a, d)
      b.box(nx === 0 ? wa : dep, hb, nx === 0 ? dep : wa, c, px, yc, pz, 0)
    }
    const cy = (a, d, yb, r, hb, col, seg) => {
      const [px, pz] = at(a, d)
      inner.cyl(r, hb, lit(col, 0.12), px, yb, pz, seg || 8)
    }
    const sp = (a, d, y, r, col, seg, rings) => {
      const [px, pz] = at(a, d)
      inner.sphere(r, lit(col, 0.1), px, y, pz, seg || 6, rings || 4)
    }
    // 店内的高光件换成弱一档的桶
    const bright = innerHot
    const glow = innerHot
    const y0 = fy + 0.30 // 地坪
    const hT = h || 2.58 // 净高
    const yc = y0 + hT // 吊顶
    const hw = sw / 2
    const arch = ARCH_OF[kind] || 'shelves'
    const dark = arch === 'night'
    const warm = arch === 'dining' || arch === 'display' || arch === 'drinks'
    const wallC = dark ? '#33303e' : warm ? '#efe2c9' : '#e9e6dc'
    const floorC = dark ? '#3a3644' : arch === 'dining' ? '#d8ccb2' : warm ? '#ddd3c0' : '#d2d0c8'
    const ceilC = dark ? '#443f4e' : '#f6f0e2'
    const lampC = dark ? '#e4ecff' : '#ffffff'
    const D2 = (t) => D * t // 按进深比例摆东西

    // ---- 屋子：地 / 顶 / 后墙 / 两侧墙 / 踢脚
    box(0, D / 2, y0 - 0.06, sw, 0.12, D, floorC)
    box(0, D / 2, yc + 0.06, sw, 0.12, D, ceilC)
    box(0, 0.05, y0 + hT / 2, sw, hT, 0.1, wallC) // 后墙
    for (const t of [-1, 1]) box(t * (hw - 0.05), D / 2, y0 + hT / 2, 0.1, hT, D, wallC)
    for (const t of [-1, 1]) box(t * (hw - 0.06), D / 2, y0 + 0.09, 0.04, 0.18, D, dark ? '#26232d' : '#b9ad97')
    box(0, 0.06, y0 + 0.09, sw, 0.18, 0.03, dark ? '#26232d' : '#b9ad97')
    // 吊顶整片透光（中国小店的白色吊顶 + 灯管），夜里屋顶是亮的
    box(0, D * 0.5, yc - 0.02, sw * 0.9, 0.015, D * 0.8, dark ? '#3a3a52' : '#c9bda4', glow)
    // 吊顶灯盘：从街上抬头就看见屋顶是亮的
    const lamps = Math.max(2, Math.min(4, Math.round(sw / 1.8)))
    for (let i = 0; i < lamps; i++) {
      const a = -hw + (sw * (i + 0.5)) / lamps
      for (const t of [0.3, 0.72]) {
        const d = D2(t)
        box(a, d, yc - 0.08, 0.2, 0.03, 0.2, '#fdfaf2', bright)
        box(a, d, yc - 0.03, 0.3, 0.04, 0.3, '#cfd6dc')
      }
    }

    // ---- 便利店 / 超市 / 药房 / 烟酒：靠墙货架 + 中岛 + 冷柜 + 收银台
    if (arch === 'shelves') {
      // 货架上的东西按业态换：药房白绿药盒、烟酒红金瓶、五金橙灰工具、书店彩色书脊……
      const PAL = {
        pharmacy: ['#f4f6f2', '#3fae6a', '#e8f0f4', '#2a9df4', '#ffffff', '#cfe8d4'],
        liquor: ['#b23a26', '#e8b84a', '#6a2a1a', '#f2e0b0', '#2a5a3a', '#8a1a1a'],
        hardware: ['#e8732c', '#8a8e94', '#f2c230', '#3a3f46', '#c8c8c0', '#d2453c'],
        book: ['#c0392b', '#2a6bd6', '#f2c230', '#2f8a5a', '#f4efe2', '#8a4ac0'],
        stationery: ['#ff7a9a', '#4cc9f0', '#ffd166', '#90be6d', '#ffffff', '#c77dff'],
        pet: ['#f4a261', '#2a9d8f', '#e9c46a', '#e76f51', '#ffffff', '#8ab17d'],
        baby: ['#ffc8dd', '#bde0fe', '#fff1a8', '#cdeac0', '#ffffff', '#e2c2ff'],
        glasses: ['#1e1e22', '#d9a441', '#c0392b', '#2a6bd6', '#8a4a2a', '#e8e2d6', '#2f8a5a'],
        music: ['#2b2b2b', '#c0392b', '#f2c230', '#8a5a3a', '#f4efe2', '#3a5a8a'],
      }
      const goods = PAL[kind] || GOODS
      const fridge = kind === 'store' || kind === 'market' || kind === 'liquor'
      const shelfUnit = (ac, len, d, hgt, levels) => {
        const woodS = warm || kind === 'book' || kind === 'glasses' || kind === 'music'
        const postC = woodS ? '#8a5e3c' : '#7c8590'
        for (const t of [-1, 1]) box(ac + (t * len) / 2, d, y0 + hgt / 2, 0.06, hgt, 0.46, postC)
        box(ac, d, y0 + hgt + 0.04, len + 0.06, 0.07, 0.5, woodS ? '#a8744a' : '#9aa3ad')
        box(ac, d, y0 + 0.06, len, 0.12, 0.44, woodS ? '#6a4630' : '#5e6670')
        box(ac, d - 0.24, y0 + hgt / 2, len, hgt, 0.02, woodS ? '#d8b88a' : '#e6ebef')
        for (let k = 1; k <= levels; k++) {
          const y = y0 + (hgt * k) / levels
          box(ac, d, y, len, 0.045, 0.44, woodS ? '#c89a68' : '#d8dde2')
          box(ac, d + 0.21, y - 0.02, len, 0.05, 0.01, kind === 'pharmacy' ? '#3fae6a' : '#f2c45a')
          box(ac, d - 0.2, y + 0.05, len - 0.04, 0.03, 0.02, '#fff8e8', bright)
          const n = Math.max(3, Math.floor(len / 0.2))
          for (let i = 0; i < n; i++) {
            if ((i * 7 + k * 5) % 11 === 3) continue
            const a = ac - len / 2 + (len / n) * (i + 0.5)
            const ph = 0.14 + rr() * 0.1
            box(a, d + (rr() - 0.5) * 0.08, y + 0.03 + ph / 2, 0.09 + rr() * 0.06, ph, 0.09 + rr() * 0.05, goods[(i * 3 + k) % goods.length])
          }
        }
      }
      shelfUnit(0, sw - 0.5, 0.36, 1.9, 3)
      shelfUnit(-hw + 1.1, Math.min(2.0, sw * 0.3), D2(0.52), 1.42, 2)
      if (!fridge) shelfUnit(hw - 1.1, Math.min(1.9, sw * 0.28), D2(0.52), 1.42, 2)
      if (kind === 'pharmacy') {
        // 后墙上方的绿十字灯箱
        box(0, 0.12, y0 + 2.2, 0.5, 0.14, 0.03, '#3fd07a', bright)
        box(0, 0.12, y0 + 2.2, 0.14, 0.5, 0.03, '#3fd07a', bright)
      }
      if (kind === 'hardware') {
        // 侧墙挂板 + 挂着的工具
        box(hw - 0.12, D2(0.5), y0 + 1.3, 0.04, 1.2, D * 0.6, '#8a6a48')
        for (let i = 0; i < 6; i++) box(hw - 0.18, D2(0.3 + i * 0.08), y0 + 1.1 + (i % 2) * 0.4, 0.06, 0.3, 0.06, goods[i % goods.length])
      }
    }
    // 饮料冷柜（发光门 + 一瓶瓶饮料）：只有便利店 / 超市 / 烟酒店有
    if (arch === 'shelves' && (kind === 'store' || kind === 'market' || kind === 'liquor')) {
      const ca = hw - 0.5
      box(ca, D2(0.82), y0 + 0.98, 0.62, 1.9, 0.78, '#e2e7ea')
      box(ca, D2(0.82) + 0.42, y0 + 0.98, 0.46, 1.68, 0.03, '#d5ecff', glow)
      for (let k = 0; k < 3; k++) {
        const y = y0 + 0.34 + k * 0.56
        box(ca, D2(0.82) + 0.2, y, 0.52, 0.04, 0.3, '#c8ccd0')
        for (let i = 0; i < 4; i++) cy(ca - 0.18 + i * 0.12, D2(0.82) + 0.22, y + 0.02, 0.042, 0.2, GOODS[(i + k) % 6], 6)
      }
    }
    if (arch === 'shelves') {
      // 收银台（靠门一侧）
      const ta = -hw + 0.85
      const td = D2(0.74)
      box(ta, td, y0 + 0.55, 0.9, 1.1, 0.52, '#cbb99c')
      box(ta, td, y0 + 1.13, 0.98, 0.07, 0.6, '#e4d6ba')
      box(ta, td + 0.02, y0 + 1.31, 0.32, 0.27, 0.22, '#3a4048')
      box(ta, td - 0.12, y0 + 1.34, 0.24, 0.17, 0.02, '#bfe4ff', bright)
      box(ta + 0.3, td, y0 + 1.21, 0.2, 0.12, 0.16, '#d8d2c4')
    }

    // ---- 卤味：白瓷砖墙 + 红色台面的玻璃柜 + 一盘盘卤货 + 挂在横杆上的烧鹅 + 砧板
    if (arch === 'deli') {
      box(0, 0.06, y0 + 1.1, sw - 0.2, 1.6, 0.02, '#f2f0ea')
      for (let i = 0; i < 5; i++) box(0, 0.075, y0 + 0.4 + i * 0.32, sw - 0.2, 0.012, 0.01, '#d8d4ca')
      const cd = D2(0.62)
      box(0, cd, y0 + 0.45, sw - 0.5, 0.9, 0.62, '#b8352c')
      box(0, cd, y0 + 0.92, sw - 0.44, 0.06, 0.68, '#e8e2d4')
      box(0, cd + 0.3, y0 + 1.18, sw - 0.5, 0.5, 0.03, '#e8f4f8', glass)
      box(0, cd, y0 + 1.44, sw - 0.5, 0.04, 0.62, '#d8d0c0')
      box(0, cd, y0 + 1.4, sw - 0.6, 0.03, 0.1, '#fff2d8', bright)
      const MEAT = ['#8a3a1e', '#a8552a', '#6a2a14', '#c8783a', '#9a4a24']
      const n = Math.max(3, Math.floor((sw - 0.8) / 0.42))
      for (let i = 0; i < n; i++) {
        const a = -(sw - 0.9) / 2 + ((sw - 0.9) / Math.max(1, n - 1)) * i
        box(a, cd, y0 + 0.97, 0.34, 0.04, 0.4, '#f4f1ea')
        for (let k = 0; k < 3; k++) sp(a + (k - 1) * 0.08, cd + (rr() - 0.5) * 0.12, y0 + 1.04, 0.06, MEAT[(i + k) % MEAT.length], 6, 4)
      }
      // 横杆上挂的烧鹅 / 卤鸭
      const rd = D2(0.3)
      box(0, rd, y0 + 2.05, sw - 0.6, 0.04, 0.04, '#8a8e94')
      const m = Math.max(3, Math.floor((sw - 0.8) / 0.5))
      for (let i = 0; i < m; i++) {
        const a = -(sw - 1) / 2 + ((sw - 1) / Math.max(1, m - 1)) * i
        box(a, rd, y0 + 1.95, 0.015, 0.16, 0.015, '#5a5a5a')
        sp(a, rd, y0 + 1.68, 0.16, i % 2 ? '#a8552a' : '#8a3a1e', 7, 5)
        box(a, rd, y0 + 1.44, 0.08, 0.14, 0.08, '#6a2a14')
      }
      // 砧板 + 菜刀 + 后墙红底价目牌
      box(sw * 0.3, D2(0.42), y0 + 0.95, 0.5, 0.06, 0.34, '#c8a070')
      box(0, 0.08, y0 + 2.2, sw * 0.6, 0.34, 0.03, '#b8352c', bright)
      for (let i = 0; i < 3; i++) box(0, 0.06, y0 + 2.12 + i * 0.08, sw * 0.4, 0.025, 0.02, '#ffe9a8')
    }

    // ---- 面馆 / 沙县 / 快餐 / 火锅 / 烧烤：灶台 + 油烟罩 + 菜单牌 + 桌椅碗筷
    if (arch === 'dining') {
      box(0, 0.42, y0 + 0.52, sw - 0.4, 1.04, 0.62, '#b6b9b6')
      box(0, 0.42, y0 + 1.06, sw - 0.34, 0.07, 0.68, '#949897')
      for (const t of [-1, 1]) {
        cy(t * sw * 0.16, 0.42, y0 + 1.1, 0.18, 0.13, '#cacdc9', 10)
        cy(t * sw * 0.16, 0.42, y0 + 1.23, 0.15, 0.04, '#eef1ed', 10)
        cy(t * sw * 0.16, 0.42, y0 + 1.2, 0.02, 0.18, '#e8e4d4', 5) // 蒸汽柱
      }
      box(0, 0.34, y0 + 1.98, sw - 0.5, 0.46, 0.6, '#9ba1a3')
      box(0, 0.5, y0 + 1.94, sw - 0.62, 0.06, 0.05, '#ffe0ae', bright)
      // 挂墙菜单：深底 + 米色灯箱 + 几行红字
      box(0, 0.15, y0 + 1.72, sw * 0.74, 0.5, 0.04, '#33291f')
      box(0, 0.13, y0 + 1.72, sw * 0.68, 0.42, 0.03, '#f2e6ca', bright)
      for (let i = 0; i < 4; i++) box(0, 0.11, y0 + 1.57 + i * 0.09, sw * 0.46, 0.03, 0.02, '#b23a26')
      // 两张方桌 + 塑料圆凳 + 碗筷 + 吊灯
      for (const t of [-1, 1]) {
        const a = t * sw * 0.24
        const d = D2(0.66)
        box(a, d, y0 + 0.74, 0.72, 0.05, 0.72, '#c9a97a')
        box(a, d, y0 + 0.7, 0.66, 0.04, 0.66, '#b8996c')
        for (const [sx, sz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]])
          box(a + sx, d + sz, y0 + 0.36, 0.05, 0.72, 0.05, '#7d7365')
        cy(a - 0.07, d, y0 + 0.78, 0.1, 0.05, '#f4f1e8', 10)
        cy(a + 0.15, d, y0 + 0.79, 0.03, 0.13, '#8a5a3a', 6)
        for (const r2 of [-1, 1]) {
          const sa = a + r2 * 0.52
          cy(sa, d, y0 + 0.46, 0.16, 0.05, r2 > 0 ? '#d0524a' : '#d8d8d0', 10)
          cy(sa, d, y0 + 0.02, 0.04, 0.44, '#4a4a4a', 6)
        }
        cy(a, d, y0 + 1.56, 0.16, 0.16, '#e8cfa0', 8)
        box(a, d, y0 + 1.45, 0.3, 0.03, 0.3, '#fff0cc', bright)
        cy(a, d, y0 + 2.0, 0.015, 0.5, '#4a4038', 4)
      }
    }

    // ---- 水果 / 鲜花 / 蛋糕 / 卤味：阶梯木箱 + 真水果 + 价签 + 玻璃柜
    if (arch === 'display') {
      if (kind === 'flower') {
        for (let k = 0; k < 2; k++) {
          const d = D2(0.5 + k * 0.24)
          for (let i = 0; i < 5; i++) {
            const a = -sw * 0.32 + i * (sw * 0.16)
            cy(a, d, y0 + 0.03, 0.12, 0.44, '#6a7a68', 8)
            for (let j = 0; j < 3; j++) cy(a + (j - 1) * 0.035, d, y0 + 0.44, 0.02, 0.32, '#5a7a5a', 4)
            sp(a, d, y0 + 0.82, 0.14, FLOWER[(i + k) % 4], 7, 4)
          }
        }
        box(0, 0.15, y0 + 1.95, sw * 0.5, 0.24, 0.04, '#2b3b30')
      } else if (kind === 'bakery' || kind === 'deli') {
        const cd = D2(0.5)
        box(0, cd, y0 + 0.44, sw - 0.5, 0.88, 0.6, '#8a6a48')
        box(0, cd, y0 + 0.9, sw - 0.44, 0.07, 0.68, '#ded1b8')
        for (const t of [-1, 1]) box(t * (sw / 2 - 0.32), cd, y0 + 1.34, 0.04, 0.86, 0.6, '#dce8ee', glass)
        box(0, cd - 0.28, y0 + 1.34, sw - 0.62, 0.86, 0.04, '#dce8ee', glass)
        box(0, cd, y0 + 1.78, sw - 0.5, 0.05, 0.66, '#c8bda6')
        for (let i = 0; i < 5; i++) {
          const a = -sw * 0.28 + i * (sw * 0.14)
          cy(a, cd, y0 + 0.93, 0.1, 0.15, i % 2 ? '#f0e2c8' : '#e8c06a', 10)
          box(a, cd - 0.2, y0 + 1.12, 0.16, 0.02, 0.1, '#fffaf0', bright)
        }
        box(0, 0.16, y0 + 1.86, sw * 0.62, 0.42, 0.04, '#2f2a26')
        box(0, 0.14, y0 + 1.86, sw * 0.56, 0.34, 0.03, '#f6e3e8', bright)
      } else {
        for (let k = 0; k < 3; k++) {
          const d = D2(0.34 + k * 0.19)
          const hb = 0.66 - k * 0.11
          box(0, d, y0 + hb / 2 + 0.03, sw - 0.44, hb, 0.42, '#8a5a34')
          box(0, d, y0 + hb + 0.05, sw - 0.4, 0.05, 0.46, '#a06c40')
          const n = Math.max(4, Math.round((sw - 0.7) / 0.24))
          for (let i = 0; i < n; i++) {
            const a = -(sw - 0.8) / 2 + ((sw - 0.8) / Math.max(1, n - 1)) * i
            sp(a, d + (rr() - 0.5) * 0.06, y0 + hb + 0.16, 0.1 + rr() * 0.03, FRUIT[(i + k) % FRUIT.length], 7, 5)
          }
          box(-sw * 0.18, d + 0.22, y0 + hb - 0.08, 0.2, 0.1, 0.02, '#fffdf0', bright)
          box(sw * 0.2, d + 0.22, y0 + hb - 0.08, 0.2, 0.1, 0.02, '#fffdf0', bright)
        }
      }
    }

    // ---- 奶茶 / 咖啡：吧台 + 机器 + 杯塔 + 菜单灯箱 + 高脚凳
    if (arch === 'drinks') {
      const bd = D2(0.42)
      box(0, bd, y0 + 0.56, sw - 0.4, 1.12, 0.62, '#8a6a48')
      box(0, bd, y0 + 1.15, sw - 0.3, 0.07, 0.7, '#c9a878')
      box(-sw * 0.15, bd, y0 + 1.33, 0.5, 0.36, 0.36, '#c8ccd0')
      box(-sw * 0.15, bd, y0 + 1.35, 0.34, 0.22, 0.03, '#3a4048')
      box(-sw * 0.15, bd + 0.2, y0 + 1.26, 0.36, 0.06, 0.06, '#eef1ee', bright)
      box(0, 0.14, y0 + 1.82, sw - 0.4, 0.68, 0.04, '#2a2622')
      box(0, 0.12, y0 + 1.82, sw - 0.46, 0.58, 0.03, '#f8ecd4', bright)
      for (let i = 0; i < 4; i++) box(0, 0.09, y0 + 1.58 + i * 0.13, sw * 0.44, 0.03, 0.02, i % 2 ? '#b23a26' : '#5a4030')
      for (let i = 0; i < 6; i++) cy(sw * 0.2 + (i % 3) * 0.11, bd - 0.08, y0 + 1.19 + Math.floor(i / 3) * 0.13, 0.045, 0.12, '#f4f2ea', 8)
      for (let i = 0; i < 4; i++) cy(-sw * 0.01 + i * 0.09, bd - 0.08, y0 + 1.19, 0.03, 0.19, ['#e0b050', '#c04a3a', '#8a5ac0', '#5aa86a'][i], 6)
      for (const t of [-1, 1]) {
        cy(t * sw * 0.28, D2(0.64), y0 + 0.63, 0.16, 0.05, '#c84a4a', 10)
        cy(t * sw * 0.28, D2(0.64), y0 + 0.02, 0.04, 0.6, '#6a6a6a', 6)
      }
    }

    // ---- 网咖 / KTV / 台球 / 银行 / 健身：暗底 + 霓虹带 + 具体家具
    if (arch === 'night') {
      box(0, 0.13, y0 + 1.92, sw - 0.44, 0.05, 0.05, ink || '#ff5ad2', bright)
      box(0, 0.13, y0 + 1.78, sw - 0.56, 0.03, 0.04, '#59d2ff', bright)
      if (kind === 'billiard') {
        const d = D2(0.5)
        box(0, d, y0 + 0.84, sw - 0.6, 0.18, 0.82, '#2f6a4a')
        box(0, d, y0 + 0.94, sw - 0.5, 0.07, 0.9, '#3f7a56')
        for (const t of [-1, 1]) box(t * (sw * 0.22), d, y0 + 0.94, 0.09, 0.14, 0.94, '#5a4430')
        for (const a of [-sw * 0.18, sw * 0.18]) for (const dz of [-0.32, 0.32]) cy(a, d + dz, y0 + 0.02, 0.07, 0.82, '#4a3a2a', 6)
        for (let i = 0; i < 6; i++) sp(-sw * 0.16 + i * 0.08, d + (i % 3 - 1) * 0.14, y0 + 1.0, 0.05, i % 2 ? '#f4f0e0' : '#e04a3a', 6, 4)
        for (const t of [-1, 1]) box(t * sw * 0.2, d, y0 + 2.1, 0.36, 0.05, 0.36, '#fff0cc', bright)
      } else if (kind === 'netbar') {
        for (let k = 0; k < 3; k++) {
          for (let i = 0; i < 3; i++) {
            const a = -sw * 0.3 + i * (sw * 0.3)
            const d = D2(0.34 + k * 0.2)
            box(a, d, y0 + 0.54, 0.72, 0.1, 0.44, '#4a4450')
            box(a, d, y0 + 0.3, 0.06, 0.5, 0.06, '#3a3440')
            box(a, d + 0.1, y0 + 0.9, 0.46, 0.34, 0.05, '#20222a')
            box(a, d + 0.08, y0 + 0.9, 0.4, 0.28, 0.02, ['#59d2ff', '#ff7ab4', '#8dffb0'][(i + k) % 3], bright)
            cy(a, d - 0.24, y0 + 0.36, 0.16, 0.05, '#3a3444', 8)
            cy(a, d - 0.24, y0 + 0.02, 0.035, 0.34, '#2a2830', 6)
          }
        }
      } else if (kind === 'bank') {
        for (let i = 0; i < 3; i++) {
          const a = -sw * 0.28 + i * (sw * 0.28)
          const d = D2(0.5)
          box(a, d, y0 + 0.76, 0.7, 1.52, 0.52, '#5a6470')
          box(a, d + 0.27, y0 + 1.12, 0.44, 0.52, 0.03, '#9ad8ff', bright)
          box(a, d + 0.27, y0 + 0.8, 0.26, 0.15, 0.03, '#cfe6ff', bright)
          box(a, d + 0.3, y0 + 0.5, 0.5, 0.1, 0.14, '#8a929c')
        }
        box(0, 0.11, y0 + 1.98, sw - 0.4, 0.1, 0.04, '#cfe6ff', bright)
      } else {
        const rd = D2(0.42)
        box(-hw + 0.75, rd, y0 + 0.52, 1.1, 1.04, 0.66, '#4a4248')
        box(-hw + 0.75, rd, y0 + 1.05, 1.2, 0.07, 0.72, '#8a7a6a')
        box(-hw + 0.75, rd - 0.2, y0 + 1.28, 0.42, 0.02, 0.24, ink || '#ff5ad2', bright)
        for (let k = 0; k < 2; k++) {
          const d = D2(0.42 + k * 0.28)
          box(sw * 0.16, d, y0 + 0.34, sw * 0.36, 0.52, 0.4, k ? '#5a3a4a' : '#3a4a5a')
          box(sw * 0.16, d - 0.22, y0 + 0.66, sw * 0.32, 0.52, 0.14, k ? '#6a4454' : '#46586a')
          cy(sw * 0.16, d + 0.28, y0 + 0.44, 0.24, 0.05, '#8a7a6a', 8)
          cy(sw * 0.16, d + 0.28, y0 + 0.02, 0.05, 0.4, '#5a5048', 6)
        }
      }
    }

    // ---- 理发 / 美甲 / 维修 / 打印 / 快递 / 中介：柜台 + 工作台 + 座位 / 货堆
    if (arch === 'service') {
      if (kind === 'barber' || kind === 'beauty') {
        for (const t of [-1, 1]) {
          const a = t * sw * 0.24
          const d = D2(0.58)
          cy(a, d, y0 + 0.02, 0.15, 0.52, '#3a3a40', 8)
          box(a, d, y0 + 0.66, 0.5, 0.2, 0.5, '#4a3a34')
          box(a, d + 0.18, y0 + 0.94, 0.48, 0.52, 0.12, '#4a3a34')
          box(a, d + 0.24, y0 + 0.66, 0.54, 0.05, 0.09, '#2a2a30')
          box(a, 0.16, y0 + 1.38, 0.54, 0.74, 0.03, '#d8ecf2', bright)
          cy(a, D2(0.3), y0 + 0.88, 0.17, 0.13, '#f0f0ea', 10)
          box(a, D2(0.3), y0 + 0.72, 0.46, 0.42, 0.4, '#9a9084')
        }
        box(0, D2(0.42), y0 + 0.58, sw - 0.7, 0.05, 0.4, '#b8a894')
      } else if (kind === 'parcel') {
        const td = D2(0.74)
        box(-hw + 0.75, td, y0 + 0.55, 0.9, 1.04, 0.52, '#cbb99c')
        box(-hw + 0.75, td, y0 + 1.11, 0.98, 0.07, 0.6, '#e4d6ba')
        for (let k = 0; k < 3; k++) {
          const d = D2(0.3 + k * 0.12)
          box(sw * 0.12, d, y0 + 0.92, sw * 0.56, 0.06, 0.42, '#a8a49a')
          for (let i = 0; i < 5; i++) {
            const a = sw * 0.12 - sw * 0.24 + i * (sw * 0.12)
            const hb = 0.2 + rr() * 0.16
            box(a, d, y0 + 0.95 + hb / 2, 0.26, hb, 0.3, k % 2 ? '#c8a878' : '#b89a6a')
          }
        }
      } else {
        const fd = D2(0.5)
        box(-sw * 0.12, fd, y0 + 0.56, sw * 0.52, 1.1, 0.56, '#b8a894')
        box(-sw * 0.12, fd, y0 + 1.14, sw * 0.58, 0.07, 0.64, '#dccfb6')
        const wd = D2(0.46)
        box(sw * 0.3, wd, y0 + 0.42, 0.72, 0.84, 0.52, '#8a8378')
        box(sw * 0.3, wd, y0 + 0.86, 0.8, 0.06, 0.58, '#a8a294')
        box(sw * 0.3, wd, y0 + 1.04, 0.32, 0.3, 0.3, '#3a4048')
        box(sw * 0.3, wd - 0.17, y0 + 1.06, 0.24, 0.19, 0.02, '#9ad8ff', bright)
        for (let k = 0; k < 2; k++) box(-hw + 0.6, 0.42 + k * 0.12, y0 + 0.78 + k * 0.5, 0.95, 0.05, 0.42, '#a8a49a')
        for (let i = 0; i < 4; i++) cy(-hw + 0.85 + i * 0.13, 0.42, y0 + 1.4, 0.04, 0.18, GOODS[i], 6)
        cy(sw * 0.02, D2(0.74), y0 + 0.44, 0.18, 0.05, '#4a4a52', 8)
        cy(sw * 0.02, D2(0.74), y0 + 0.02, 0.04, 0.42, '#4a4a52', 6)
      }
    }

    // ---- 服装 / 鞋 / 布料：挂衣杆 + 衣服 + 模特
    if (arch === 'racks') {
      for (const t of [-1, 1]) {
        const a = t * sw * 0.25
        const d = D2(0.5)
        box(a, d, y0 + 0.95, 0.07, 1.9, 0.07, '#8a8278')
        box(a, d, y0 + 1.9, 1.1, 0.05, 0.05, '#c8c2b4')
        for (let i = 0; i < 5; i++) {
          const aa = a - 0.44 + i * 0.22
          box(aa, d, y0 + 1.32, 0.18, 1.0, 0.32, GOODS[(i + (t > 0 ? 2 : 0)) % GOODS.length])
        }
        box(a, d, y0 + 0.44, 0.95, 0.06, 0.44, '#a8a49a')
      }
      cy(0, D2(0.8), y0 + 0.02, 0.17, 0.06, '#4a4a4a', 8)
      cy(0, D2(0.8), y0 + 0.08, 0.11, 0.64, '#e8e2d6', 10)
      cy(0, D2(0.8), y0 + 0.72, 0.14, 0.52, '#d8cfc0', 10)
      sp(0, D2(0.8), y0 + 1.38, 0.13, '#e8e2d6', 8, 5)
      box(0, 0.14, y0 + 1.92, sw * 0.42, 0.32, 0.04, '#2f2a26')
    }
  }

  /** 逃生梯：老红砖楼侧面一列铁平台 + 栏杆 + 直梯，纽约那味道就在这里 */
  const fireEscape = (b, bottom, side) => {
    const nx = side === 'e' ? 1 : -1
    const fx = b.x + nx * (b.w / 2)
    const fz = b.z
    const w = Math.min(4.2, b.d - 2.4)
    if (w < 2.6) return
    const dep = 1.35
    const floors = Math.max(3, Math.round(b.h / P.SCALE.floor))
    const fh = b.h / floors
    for (let j = 1; j < floors; j++) {
      const y = bottom + j * fh
      solid.box(dep, 0.1, w, '#2f343b', fx + (nx * dep) / 2, y, fz, 0)
      // 外侧栏杆：上下横杆 + 三根立柱
      solid.box(0.07, 0.06, w, '#39404a', fx + nx * (dep - 0.06), y + 0.92, fz, 0)
      solid.box(0.07, 0.06, w, '#39404a', fx + nx * (dep - 0.06), y + 0.5, fz, 0)
      for (const t of [-0.4, 0, 0.4]) solid.box(0.06, 0.92, 0.06, '#39404a', fx + nx * (dep - 0.06), y + 0.46, fz + t * w, 0)
      // 直梯（一上一下交替，远看就是折返楼梯）
      solid.box(0.08, fh, 0.5, '#2f343b', fx + nx * (dep - 0.2), y + fh / 2, fz + (j % 2 ? -0.9 : 0.9), 0)
    }
  }

  /** 屋顶楼梯间：一个小方盒子 + 门 + 门灯，几乎每栋平顶楼都有，是最容易读出的「楼顶」 */
  const bulkhead = (b, top, rr) => {
    if (b.w < 8 || b.d < 8) return
    const w = 2.6 + rr() * 1.4
    const d = 2.2 + rr() * 1.2
    const x = b.x + (rr() < 0.5 ? -1 : 1) * (b.w / 2 - w / 2 - 1.2)
    const z = b.z + (rr() < 0.5 ? -1 : 1) * (b.d / 2 - d / 2 - 1.2)
    const h = 2.4 + rr() * 0.8
    const col = shade(b.color || '#8a4536', 0.94)
    solid.box(w, h, d, col, x, top + h / 2, z, 0)
    solid.box(w + 0.24, 0.16, d + 0.24, shade(col, 0.82), x, top + h + 0.06, z, 0)
    // 门（朝场内）+ 门头一盏小灯
    const dz = z + (z > b.z ? -1 : 1) * (d / 2 + 0.02)
    solid.box(0.9, 1.9, 0.06, '#3c3028', x, top + 0.95, dz, 0)
    glow.box(0.26, 0.16, 0.1, '#ffd9a0', x, top + 2.1, dz + Math.sign(z - b.z || 1) * 0.04, 0)
  }

  /** 屋顶生活：彩色铁皮棚 / 水塔 / 屋顶小菜园 / 晾衣绳 / 一串小灯。俯视时最先看到的就是这一层。 */
  const roofLife = (b, top) => {
    const rr = P.mulberry32(Math.floor(Math.abs(b.x) * 13 + Math.abs(b.z) * 7) + 11)
    const qx = (k) => b.x + (rr() - 0.5) * b.w * k
    const qz = (k) => b.z + (rr() - 0.5) * b.d * k
    if (rr() < 0.45) {
      const x = qx(0.4)
      const z = qz(0.4)
      const w = 3 + rr() * 1.8
      const d = 2.6 + rr() * 1.2
      const col = TIN[Math.floor(rr() * TIN.length)]
      solid.box(w, 2.1, d, shade(col, 0.95), x, top + 1.05, z, 0)
      solid.box(w + 0.5, 0.18, d + 0.5, col, x, top + 2.2, z, 0)
      for (let k = -2; k <= 2; k++) solid.box(0.08, 0.06, d + 0.5, shade(col, 0.8), x + k * (w / 5), top + 2.31, z, 0)
      solid.box(0.9, 1.7, 0.06, '#6a4a3a', x - w * 0.2, top + 0.85, z + d / 2 + 0.02, 0)
      glow.box(0.7, 0.5, 0.06, '#ffd08a', x + w * 0.2, top + 1.3, z + d / 2 + 0.03, 0)
    }
    if (rr() < 0.78) {
      // 木水塔：四条支腿 + 木桶 + 锥顶 + 一圈箍 —— 纽约天际线上最典型的屋顶配件
      const x = qx(0.55)
      const z = qz(0.55)
      for (const [dx, dz] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) {
        solid.box(0.1, 2.4, 0.1, '#4a4038', x + dx, top + 1.2, z + dz, 0)
        solid.box(0.22, 0.12, 0.22, '#4a4038', x + dx, top + 0.06, z + dz, 0)
      }
      solid.cyl(1.15, 2.1, rr() < 0.6 ? '#8a6a4a' : '#6f5a4a', x, top + 2.4, z, 12)
      for (const hy of [0.4, 1.05, 1.7]) solid.cyl(1.2, 0.09, '#3a322c', x, top + 2.4 + hy, z, 12)
      solid.cone(1.3, 0.7, '#5a4a3e', x, top + 4.5, z, 12)
      solid.cyl(0.08, 0.5, '#3a322c', x, top + 5.2, z, 5)
    }
    if (rr() < 0.4) {
      const x = qx(0.35)
      const z = qz(0.35)
      for (let k = 0; k < 3; k++) {
        const px = x + (k - 1) * 1.4
        solid.box(1.1, 0.45, 0.9, '#a8643e', px, top + 0.22, z, 0)
        solid.sphere(0.45, k === 1 ? '#5c9a52' : '#4f8a4e', px, top + 0.75, z, 6, 4)
        if (rr() < 0.6) solid.sphere(0.14, FLOWERS[Math.floor(rr() * FLOWERS.length)], px + 0.2, top + 1.1, z + 0.15, 5, 3)
      }
      // 遮阳伞
      if (rr() < 0.5) {
        solid.cyl(0.05, 2.1, '#d8d0c4', x, top, z + 1.8, 5)
        solid.cone(1.4, 0.5, TIN[Math.floor(rr() * TIN.length)], x, top + 2.0, z + 1.8, 8)
      }
    }
    if (rr() < 0.45) {
      const x = qx(0.3)
      const z = qz(0.3)
      for (const s of [-1, 1]) solid.box(0.08, 1.9, 0.08, '#7a6a5e', x + s * 2.2, top + 0.95, z, 0)
      solid.box(4.4, 0.03, 0.03, '#3a3430', x, top + 1.86, z, 0)
      for (let k = 0; k < 5; k++) {
        const ch = 0.5 + rr() * 0.4
        solid.box(0.5, ch, 0.04, CLOTH[Math.floor(rr() * CLOTH.length)], x - 1.7 + k * 0.85, top + 1.84 - ch / 2, z, 0)
      }
    }
    if (rr() < 0.16) {
      const x = b.x
      const z = b.z + b.d * 0.3
      for (let k = 0; k < 9; k++) {
        const t = k / 8
        glow.box(0.12, 0.12, 0.12, k % 2 ? '#ffd27a' : '#ff9f6b', x - b.w * 0.35 + t * b.w * 0.7, top + 2.4 - Math.sin(t * Math.PI) * 0.5, z, 0)
      }
      haloExtra.push([x, top + 2.0, z, '#ffc27a'])
    }
  }

  /** 有店面的楼：首层正面掏空，店面才有真进深（骑楼式）。 */
  const CUT_H = 2.90
  const FRONT_FACE = { s: 'pz', n: 'nz', e: 'px', w: 'nx' }
  const MASS_CUT = (b, bottom) => {
    if (b.shops && b.h > CUT_H + 1.2) {
      const face = FRONT_FACE[b.face || 's']
      return { rest: b.h - CUT_H, face }
    }
    return null
  }

  await step('造型变体', 60)
  // ------------------------------------------------ 造型变体：按片区 + 位置哈希，同一栋永远一样
  // 瓦色偏陶土红褐：俯视天际线有暖色，不像厂房灰顶
  const TILE = ['#6a3a32', '#5c342c', '#7a4a38', '#4a302c', '#684438', '#5a4038']
  const ACCENT = ['#c8553d', '#3d7fa8', '#d9a441', '#5a8f5a', '#9a5ab0', '#e07a5f']
  const rnd01 = (b, salt) => hash(Math.round((b.gx ?? b.x) * 3), Math.round((b.gz ?? b.z) * 3), salt)
  const strHash = (str) => [...String(str)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)
  /** 坡顶 / 退台 / 构架拉开天际线；平板屋面一多就读成工业镇 */
  const roofStyle = (b) => {
    if (b.kind === 'office' || b.kind === 'tower') return 'flat'
    if (b.kind === 'slab' && b.h >= 55) return 'flat'
    const r = rnd01(b, 77)
    if (b.kind === 'civic') return r < 0.6 ? 'gable' : r < 0.88 ? 'terrace' : 'frame'
    if (b.district === 'B' || b.old) return r < 0.68 ? 'gable' : r < 0.88 ? 'terrace' : 'flat'
    if (b.district === 'E') return r < 0.58 ? 'gable' : r < 0.82 ? 'terrace' : 'frame'
    if (b.district === 'C') return r < 0.35 ? 'gable' : r < 0.65 ? 'terrace' : r < 0.88 ? 'frame' : 'flat'
    if (b.district === 'M' || b.kind === 'walkup') return r < 0.28 ? 'gable' : r < 0.55 ? 'terrace' : r < 0.8 ? 'frame' : 'flat'
    if (b.kind === 'slab') return r < 0.4 ? 'terrace' : r < 0.7 ? 'frame' : 'flat'
    return r < 0.35 ? 'terrace' : r < 0.65 ? 'frame' : 'flat'
  }
  /** 双坡屋顶：屋脊沿长边，两端山墙用墙色补齐 */
  const gable = (cx, cz, w, d, y0, rh, col, wall, ov = 0.5) => {
    const alongX = w >= d
    const L = (alongX ? w : d) / 2
    const S = (alongX ? d : w) / 2
    const pt = (a, sd, yy) => (alongX ? [cx + a, yy, cz + sd] : [cx + sd, yy, cz + a])
    for (const sd of [-1, 1]) {
      solid.quad(pt(-L - ov, sd * (S + ov), y0 - rh * (ov / S)), pt(L + ov, sd * (S + ov), y0 - rh * (ov / S)), pt(L + ov, 0, y0 + rh), pt(-L - ov, 0, y0 + rh), col, alongX ? 0 : sd, 1, alongX ? sd : 0)
    }
    for (const e of [-1, 1]) {
      const C = pt(e * L, 0, y0 + rh)
      solid.quad(pt(e * L, -S, y0), pt(e * L, S, y0), C, C, wall, alongX ? e : 0, 0, alongX ? 0 : e)
    }
    solid.box(alongX ? 2 * L + 2 * ov : 0.4, 0.28, alongX ? 0.4 : 2 * L + 2 * ov, shade(col, 0.7), cx, y0 + rh + 0.05, cz, 0)
  }
  /** 屋顶开敞构架：四角柱 + 顶圈梁 + 两道横梁（国内住宅常见的屋顶装饰框） */
  const roofFrame = (cx, cz, w, d, y0, fh, col, lit) => {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) solid.box(0.5, fh, 0.5, col, cx + sx * (w / 2 - 0.25), y0 + fh / 2, cz + sz * (d / 2 - 0.25), 0)
    solid.box(w, 0.5, 0.5, col, cx, y0 + fh, cz + d / 2 - 0.25, 0)
    solid.box(w, 0.5, 0.5, col, cx, y0 + fh, cz - d / 2 + 0.25, 0)
    solid.box(0.5, 0.5, d, col, cx + w / 2 - 0.25, y0 + fh, cz, 0)
    solid.box(0.5, 0.5, d, col, cx - w / 2 + 0.25, y0 + fh, cz, 0)
    for (const k of [-1, 1]) solid.box(0.35, 0.4, d, col, cx + k * w * 0.17, y0 + fh, cz, 0)
    if (lit) bright.box(w - 0.6, 0.12, 0.12, lit, cx, y0 + fh - 0.32, cz + d / 2 - 0.2, 0)
  }
  /** 退台阁楼：北侧缩进一层 + 南侧花架露台 + 几盆绿植 */
  const terrace = (b, top, wallCol) => {
    const pw = b.w * 0.56
    const pd = b.d * 0.46
    const pz = b.z - b.d / 2 + pd / 2 + 0.6
    solid.box(pw, 3.0, pd, wallCol, b.x, top + 1.5, pz, 0)
    solid.box(pw + 0.6, 0.25, pd + 0.6, shade(wallCol, 0.8), b.x, top + 3.1, pz, 0)
    glow.box(pw * 0.62, 1.3, 0.1, '#ffd59a', b.x, top + 1.6, pz + pd / 2 + 0.06, 0)
    const z0 = pz + pd / 2
    const z1 = b.z + b.d / 2 - 0.6
    if (z1 - z0 < 2) return
    for (const sx of [-1, 1]) for (const zz of [z1]) solid.box(0.18, 2.6, 0.18, '#6a5a48', b.x + sx * pw * 0.45, top + 1.3, zz, 0)
    for (let k = 0; k < 5; k++) solid.box(0.12, 0.14, z1 - z0, '#7a6650', b.x - pw * 0.45 + (pw * 0.9 * k) / 4, top + 2.65, (z0 + z1) / 2, 0)
    for (const sx of [-0.3, 0.32]) solid.sphere(0.7, '#4f8a4a', b.x + sx * b.w, top + 0.9, z1 - 0.8, 6, 4)
  }

  const massing = (b) => {
    const y = P.groundY(b.x, b.z)
    const bottom = y - 0.2
    const sty = roofStyle(b)
    if (b.kind === 'tower') {
      // 同一个小区一套造型：只在「顶部」和「收头线脚」上做区别。
      // 塔身是一整段通高——上下同一套窗距、同一层线，不会出现上下两套风格
      const ch = strHash(b.compound || `${Math.round(b.x / 60)},${Math.round(b.z / 60)}`)
      const tStyle = b.landmark || !b.compound ? 0 : ch % 3
      const acc = ACCENT[(ch >> 3) % ACCENT.length]
      const crown = Math.min(6.4, b.h * 0.24)
      solid.box(b.w, b.h, b.d, b.color, b.x, bottom + b.h / 2, b.z, 0)
      // 顶部两层冠：浅一档 + 冠下一道深色收头线，比在立面刷色带干净得多
      solid.box(b.w + 0.36, crown, b.d + 0.36, shade(b.color, 1.07), b.x, bottom + b.h - crown / 2 + 0.2, b.z, 0)
      solid.box(b.w + 0.6, 0.42, b.d + 0.6, shade(b.color, 0.66), b.x, bottom + b.h - crown, b.z, 0)
      // 冠顶女儿墙
      solid.box(b.w + 0.7, 0.5, b.d + 0.7, shade(b.color, 0.9), b.x, bottom + b.h + 0.35, b.z, 0)
      // 山墙两侧的落水管 + 每层的空调机位：真实感的来源是这些附件，不是色块
      for (const sx of [-1, 1]) {
        const px = b.x + (sx * b.w) / 2 - sx * 0.5
        solid.cyl(0.13, b.h - crown, '#8d949a', px, bottom + (b.h - crown) / 2, b.z + b.d / 2 - 0.55, 5)
      }
      const fad = (f0) => ({ bay: 3.2, ratio: 0.5, winH: 1.55, maxCols: 10, sparse: faceGapAhead(f0) < 15, bandColor: shade(b.color, 0.9), trim: shade(b.color, 0.8), tone: toneOf(b), neon: neonOf(b) })
      for (const sd of ['s', 'e', 'n', 'w']) {
        const f0 = faceOf(b.x, b.z, b.w, b.d, sd)
        facadeGrid(f0, bottom + 1.4, b.h - crown - 2.2, fad(f0))
        const fc = faceOf(b.x, b.z, b.w + 0.36, b.d + 0.36, sd)
        facadeGrid(fc, bottom + b.h - crown + 0.9, crown - 1.5, { ...fad(fc), sparse: false, maxCols: 8, ratio: 0.5 })
      }
      // 冠上一条同小区色的细灯带（各家颜色不同，远看仍能分辨小区）
      if (b.compound) bright.box(b.w + 0.74, 0.13, b.d + 0.74, acc, b.x, bottom + b.h - crown - 0.3, b.z, 0)
      // 首层入户大堂：正面一块挑高暖光玻璃 + 门头雨棚 + 门前光池
      {
        const f = faceOf(b.x, b.z, b.w, b.d, 's')
        const lw = Math.min(9, b.w * 0.55)
        facade(solid, f, 0, bottom + 0.2, lw + 1.2, 6.4, '#4a4038', 0.08)
        facade(glow, f, 0, bottom + 0.5, lw, 5.6, '#efcf98', 0.1)
        facade(solid, f, 0, bottom + 3.2, lw, 0.22, '#5a4e44', 0.12)
        solid.box(lw + 2, 0.35, 3, '#d8d2c6', f.x, bottom + 6.9, f.z + 1.5, 0)
        lightPools.push({ x: f.x, z: f.z + 3.2, w: lw + 3, d: 5.5, y: y + 0.22, c: '#ff9a40' })
      }
      const topW = b.w + 0.36
      const topD = b.d + 0.36
      if (tStyle === 1) {
        // 坡屋顶帽子 + 屋脊灯
        gable(b.x, b.z, topW, topD, bottom + b.h + 1, Math.min(topW, topD) * 0.36, TILE[ch % TILE.length], shade(b.color, 1.05), 0.8)
        bright.box(Math.max(topW, topD) * 0.8, 0.14, 0.14, '#ffd9a2', b.x, bottom + b.h + 1.3 + Math.min(topW, topD) * 0.36, b.z, topW >= topD ? 0 : Math.PI / 2)
      } else if (tStyle === 2) {
        // 开敞构架 + 构架灯带
        solid.box(topW * 0.5, 4, topD * 0.5, shade(b.color, 1.12), b.x, bottom + b.h + 2, b.z, 0)
        roofFrame(b.x, b.z, topW, topD, bottom + b.h + 0.8, 7, b.trim, acc)
      } else {
        solid.box(b.w * 0.62, 7, b.d * 0.62, shade(b.color, 1.12), b.x, bottom + b.h + 3.5, b.z, 0)
        solid.box(b.w * 0.16, 6, b.d * 0.16, '#c9d3dc', b.x, bottom + b.h + 10, b.z, 0)
        glow.box(b.w * 0.66, 0.5, b.d * 0.66, '#ffd9a2', b.x, bottom + b.h + 7.2, b.z, 0)
      }
      // 每 12 层一道设备平台
      for (let f = 4; f < b.h / P.SCALE.floor; f += 12) {
        const yy = bottom + f * P.SCALE.floor
        solid.box(b.w + 0.6, 0.35, b.d + 0.6, '#9aa3ab', b.x, yy, b.z, 0)
      }
    } else if (b.kind === 'office') {
      // 挑高两层的玻璃大堂（9m）：石材门框 + 通透暖光大堂 + 竖梃，正面加雨棚。不再是一圈实心基座
      const LOBBY = 9.2
      // 退台：高塔分 2~3 段逐级收窄，每段顶上一道挑檐。直上直下的方柱是「丑」的主要来源
      const tiers = b.low ? 1 : b.h > 150 ? 3 : b.h > 80 ? 2 : 1
      const SPLIT = tiers === 3 ? [0, 0.56, 0.82, 1] : tiers === 2 ? [0, 0.7, 1] : [0, 1]
      const SCL = [1, 0.8, 0.62]
      const tierAt = (yy) => {
        for (let k = 0; k < tiers; k++) if (yy < bottom + LOBBY + (b.h - LOBBY) * SPLIT[k + 1]) return k
        return tiers - 1
      }
      for (let k = 0; k < tiers; k++) {
        const y0 = bottom + LOBBY + (b.h - LOBBY) * SPLIT[k]
        const y1 = bottom + LOBBY + (b.h - LOBBY) * SPLIT[k + 1]
        solid.box(b.w * 0.97 * SCL[k], y1 - y0, b.d * 0.97 * SCL[k], b.color, b.x, (y0 + y1) / 2, b.z, 0)
        if (k < tiers - 1) {
          solid.box(b.w * SCL[k] + 0.3, 0.7, b.d * SCL[k] + 0.3, shade(b.color, 0.7), b.x, y1 - 0.35, b.z, 0)
          solid.box(b.w * 0.97 * SCL[k] - 0.6, 1.1, b.d * 0.97 * SCL[k] - 0.6, shade(b.color, 0.82), b.x, y1 + 0.2, b.z, 0)
        }
      }
      const bt = { ...b, w: b.w * SCL[tiers - 1], d: b.d * SCL[tiers - 1], h: tiers > 1 ? (b.h - LOBBY) * (1 - SPLIT[tiers - 1]) * 2 : b.h }
      b.topW = bt.w * 0.97
      b.topD = bt.d * 0.97
      solid.box(b.w * 0.9, LOBBY, b.d * 0.9, '#3a3430', b.x, bottom + LOBBY / 2, b.z, 0)
      solid.box(b.w * 0.99, 1.1, b.d * 0.99, '#c9c2b6', b.x, bottom + LOBBY - 0.2, b.z, 0)
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
        solid.box(1.4, LOBBY, 1.4, '#c9c2b6', b.x + sx * (b.w * 0.485 - 0.7), bottom + LOBBY / 2, b.z + sz * (b.d * 0.485 - 0.7), 0)
      for (const s of ['s', 'e', 'n', 'w']) {
        const f = faceOf(b.x, b.z, b.w * 0.9, b.d * 0.9, s)
        const gw = f.w - 3.2
        facade(glow, f, 0, bottom + 0.5, gw, LOBBY - 1.5, '#e6c48e', 0.03)
        // 大堂里的层次：二层夹层板 + 吊灯带
        facade(solid, f, 0, bottom + 4.6, gw, 0.35, '#5a4e44', 0.05)
        facade(glow, f, 0, bottom + LOBBY - 1.6, gw, 0.3, '#fff2d0', 0.05)
        for (let k = 0, n = Math.max(3, Math.round(gw / 3)); k <= n; k++) facade(solid, f, -gw / 2 + (gw * k) / n, bottom + 0.5, 0.14, LOBBY - 1.5, '#2c2a2e', 0.06)
      }
      {
        const f = faceOf(b.x, b.z, b.w * 0.9, b.d * 0.9, 's')
        const cw = Math.min(14, b.w * 0.5)
        solid.box(cw, 0.45, 4.2, '#d9d4cc', f.x, bottom + 4.4, f.z + 2.2, 0)
        glow.box(cw - 0.6, 0.12, 3.8, '#fff0cf', f.x, bottom + 4.15, f.z + 2.2, 0)
        lightPools.push({ x: f.x, z: f.z + 4, w: cw + 4, d: 7, y: y + 0.22, c: '#ff9a40' })
      }
      // 玻璃幕墙：连续横向玻璃带 + 竖向翼片（每段退台各铺一套）
      for (let k = 0; k < tiers; k++) {
        const y0 = bottom + LOBBY + (b.h - LOBBY) * SPLIT[k] + (k ? 1.2 : 0.6)
        const y1 = bottom + LOBBY + (b.h - LOBBY) * SPLIT[k + 1] - (k < tiers - 1 ? 1.0 : 0.6)
        if (y1 - y0 < 4) continue
        for (const s of ['s', 'e', 'n', 'w']) {
          const f = faceOf(b.x, b.z, b.w * 0.97 * SCL[k], b.d * 0.97 * SCL[k], s)
          // 远看天际线：开间更窄，窗点更密，楼才显得「巨」
          const g = curtainWall(f, y0, y1, { body: b.color, bay: 0.95, maxCols: 96 })
          if (!g) continue
          // 转角只留细线脚；竖分格交给幕墙自身的窄开间
          for (const cx of [-g.span / 2 - 0.16, g.span / 2 + 0.16]) facade(solid, f, cx, y0 - 0.2, 0.12, y1 - y0, shade(b.color, 1.14), 0.04)
        }
      }
      // 避难层（每 15 层百叶）
      for (let f = 15; f < b.h / P.SCALE.floor; f += 15) {
        const yy = bottom + f * P.SCALE.floor
        const s = SCL[tierAt(yy)]
        solid.box(b.w * 0.975 * s, 3.0, b.d * 0.975 * s, shade(b.color, 0.75), b.x, yy, b.z, 0)
      }
      solid.box(bt.w * 0.4, 5, bt.d * 0.4, '#5a6068', b.x, bottom + b.h + 2.5, b.z, 0)
      // 屋顶设备：几台冷却塔 + 水箱，楼顶不再是一块平板
      for (let k = 0; k < 3; k++) {
        const ox = (rnd01(b, 70 + k) - 0.5) * bt.w * 0.5
        const oz = (rnd01(b, 80 + k) - 0.5) * bt.d * 0.5
        solid.box(2.6, 2.2, 2.6, '#4a5058', b.x + ox, bottom + b.h + 1.1, b.z + oz, 0)
      }
      if (b.landmark) {
        solid.box(bt.w * 0.12, b.h * 0.12, bt.d * 0.12, '#dfe6ec', b.x, bottom + b.h + 6, b.z, 0)
        glow.box(bt.w * 0.2, 0.6, bt.d * 0.2, '#ffe0a8', b.x, bottom + b.h + 4.4, b.z, 0)
      }
      // 塔冠落在最上一段退台上：块内的 b 换成顶段尺寸（top0 仍按真实楼高）
      const realH = b.h
      {
      const b = bt
      // CBD 夜景三件套：顶部 LED 冠带、转角竖向灯带、避障红灯；首层大堂是一整片暖光
      const hr = hash(Math.round(b.x), Math.round(b.z), 23)
      // 冠带统一暖白 / 琥珀：彩色只留给商业区那一处焦点
      const CROWN = ['#fff2d6', '#ffe0a8', '#ffd27a', '#f4e6cc']
      const crown = CROWN[Math.floor(hr * CROWN.length)]
      const top0 = bottom + realH
      if (b.low) {
        bright.box(b.w * 0.985, 0.3, b.d * 0.985, crown, b.x, top0 - 1.2, b.z, 0)
        // 科技园屋顶：屋顶花园 / 光伏阵列 / 锯齿天窗，三选一
        const lv = Math.floor(hr * 3)
        if (lv === 0) {
          solid.box(b.w * 0.8, 0.5, b.d * 0.8, '#5c9a4c', b.x, top0 + 0.3, b.z, 0)
          for (let k = 0; k < 5; k++) solid.sphere(1.2 + rnd01(b, k) * 0.8, k % 2 ? '#4f8a4a' : '#6aa452', b.x + (rnd01(b, k + 9) - 0.5) * b.w * 0.6, top0 + 1.4, b.z + (rnd01(b, k + 19) - 0.5) * b.d * 0.6, 6, 4)
        } else if (lv === 1) {
          for (let k = -2; k <= 2; k++) solid.box(b.w * 0.7, 0.12, 2.2, '#2f4a6a', b.x, top0 + 1.0, b.z + k * (b.d * 0.16), 0.0)
        } else {
          for (let k = -2; k <= 2; k++) {
            const zz = b.z + k * (b.d * 0.17)
            solid.box(b.w * 0.8, 2.2, 0.3, shade(b.color, 0.9), b.x, top0 + 1.1, zz - 1.2, 0)
            glow.box(b.w * 0.78, 1.6, 0.1, '#cfe6ff', b.x, top0 + 1.0, zz - 1.0, 0)
          }
        }
      } else {
      bright.box(b.w * 0.985, 0.7, b.d * 0.985, crown, b.x, top0 - 1.6, b.z, 0)
      bright.box(b.w * 0.985, 0.25, b.d * 0.985, crown, b.x, top0 - 4.2, b.z, 0)
      if (b.roof === 'crown' || hr > 0.6) {
        // 收分塔冠 + 尖顶：天际线上真正的「CBD 剪影」
        solid.box(b.w * 0.72, 10, b.d * 0.72, b.color, b.x, top0 + 5, b.z, 0)
        bright.box(b.w * 0.735, 0.4, b.d * 0.735, crown, b.x, top0 + 9.4, b.z, 0)
        solid.box(b.w * 0.42, 8, b.d * 0.42, shade(b.color, 0.9), b.x, top0 + 14, b.z, 0)
        solid.box(0.8, 22, 0.8, '#d8dee6', b.x, top0 + 29, b.z, 0)
        beaconPos.push([b.x, top0 + 40.4, b.z])
        haloExtra.push([b.x, top0 + 40.4, b.z, '#ff4a3a'])
      } else {
        // 塔冠四选一：退台婚礼蛋糕 / 斜切玻璃顶 / 圆柱冠 / 双侧竖鳍
        const v = Math.floor(rnd01(b, 41) * 4)
        let vt = top0 + 5.3
        if (v === 0) {
          for (let k = 1; k <= 2; k++) {
            const s2 = 1 - k * 0.2
            const hh = b.h * 0.07
            solid.box(b.w * s2, hh, b.d * s2, b.color, b.x, top0 + (k - 0.5) * hh, b.z, 0)
            bright.box(b.w * s2 + 0.1, 0.35, b.d * s2 + 0.1, crown, b.x, top0 + k * hh - 0.6, b.z, 0)
          }
          vt = top0 + b.h * 0.14 + 0.5
        } else if (v === 1) {
          const rh = Math.min(b.w, b.d) * 0.7
          const hw = b.w * 0.49
          const hd = b.d * 0.49
          const yl = top0 + 0.2
          const yh = yl + rh
          solid.quad([b.x - hw, yl, b.z + hd], [b.x + hw, yl, b.z + hd], [b.x + hw, yh, b.z - hd], [b.x - hw, yh, b.z - hd], shade(b.color, 1.1), 0, 1, 1)
          for (const sx of [-1, 1]) solid.quad([b.x + sx * hw, yl, b.z + hd], [b.x + sx * hw, yl, b.z - hd], [b.x + sx * hw, yh, b.z - hd], [b.x + sx * hw, yh, b.z - hd], b.color, sx, 0, 0)
          solid.box(b.w * 0.98, rh, 0.3, b.color, b.x, yl + rh / 2, b.z - hd, 0)
          bright.box(b.w * 0.98, 0.25, 0.25, crown, b.x, yh, b.z - hd, 0)
          vt = yh + 0.6
        } else if (v === 2) {
          const r = Math.min(b.w, b.d) * 0.36
          solid.cyl(r, 14, shade(b.color, 1.05), b.x, top0, b.z, 16)
          bright.cyl(r + 0.08, 0.4, crown, b.x, top0 + 9, b.z, 16)
          solid.cyl(0.35, 16, '#d8dee6', b.x, top0 + 14, b.z, 6)
          vt = top0 + 30.4
        } else {
          for (const sx of [-1, 1]) {
            solid.box(0.8, b.h * 0.5 + 14, b.d * 0.5, shade(b.color, 1.12), b.x + sx * (b.w / 2 + 0.3), top0 - b.h * 0.25 + 7, b.z, 0)
            bright.box(0.2, b.h * 0.5 + 14, 0.2, crown, b.x + sx * (b.w / 2 + 0.75), top0 - b.h * 0.25 + 7, b.z + b.d * 0.25, 0)
          }
          vt = top0 + 14.5
        }
        if (v === 2) {
          beaconPos.push([b.x, vt, b.z])
          haloExtra.push([b.x, vt, b.z, '#ff4a3a'])
        } else {
          for (const [sx, sz] of [[1, 1], [-1, -1]]) {
            beaconPos.push([b.x + sx * b.w * 0.2, vt, b.z + sz * b.d * 0.2])
            haloExtra.push([b.x + sx * b.w * 0.2, vt, b.z + sz * b.d * 0.2, '#ff4a3a'])
          }
        }
      }
      if (hr < 0.45 && tiers === 1) {
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
          bright.box(0.22, b.h - LOBBY - 2, 0.22, crown, b.x + sx * b.w * 0.488, bottom + LOBBY + 1 + (b.h - LOBBY - 2) / 2, b.z + sz * b.d * 0.488, 0)
      }
      }
      }
    } else if (b.kind === 'walkup') {
      const cut = MASS_CUT(b, bottom)
      if (cut) {
        solid.box(b.w, cut.rest, b.d, b.color, b.x, bottom + CUT_H + cut.rest / 2, b.z, 0)
        solid.box(b.w, CUT_H, b.d, b.color, b.x, bottom + CUT_H / 2, b.z, 0, { skip: cut.face })
        solid.box(b.w + 0.1, 0.26, b.d + 0.1, shade(b.color, 0.78), b.x, bottom + CUT_H - 0.13, b.z, 0)
      } else {
        solid.box(b.w, b.h, b.d, b.color, b.x, bottom + b.h / 2, b.z, 0)
        // 石材墙裙：和街角便利店同一块石头，楼才有「落地」
        solid.box(b.w + 0.16, 1.15, b.d + 0.16, '#b9b0a2', b.x, bottom + 0.58, b.z, 0)
      }
      pilasters(b, bottom, b.h, shade(b.color, 0.82))
      solid.box(b.w + 0.5, 0.5, b.d + 0.5, b.trim, b.x, bottom + b.h, b.z, 0)
      solid.box(b.w + 0.3, 0.22, b.d + 0.3, b.trim, b.x, bottom + b.h - 0.5, b.z, 0)
      // 偶发竖向色带 / 层间腰线：打破「一整块灰混凝土」的厂房感
      if ((b.old || b.district === 'B' || b.district === 'E') && rnd01(b, 41) < 0.55) {
        const acc = ACCENT[Math.floor(rnd01(b, 42) * ACCENT.length)]
        solid.box(0.35, b.h * 0.72, 0.12, shade(acc, 0.75), b.x + b.w / 2 - 0.05, bottom + b.h * 0.45, b.z, 0)
      }
      if (b.h > 14 && rnd01(b, 43) < 0.4) {
        solid.box(b.w + 0.2, 0.35, b.d + 0.2, shade(b.trim || b.color, 1.15), b.x, bottom + b.h * 0.42, b.z, 0)
      }
      // 有沿街店铺的楼，二层以上才开窗，别压到店面上
      const wy0 = bottom + (b.shops ? 4.62 : 0.9)
      for (const s of ['s', 'n', 'e', 'w']) {
        const f = faceInfo(b, s)
        const g = facadeGrid(f, wy0, b.h - (wy0 - bottom) - 0.4, {
          bay: b.podium ? 3.4 : 3.2,
          ratio: b.podium ? 0.5 : 0.48,
          winH: b.podium ? 1.55 : 1.5,
          sill: 0.9,
          sparse: faceGapAhead(f) < 14,
          maxCols: 8,
          dark: 0.28,
          life: !b.lite,
          tone: toneOf(b),
          neon: neonOf(b),
          bandColor: shade(b.color, 0.9),
          trim: shade(b.color, 0.8),
        })
        if (!g || b.lite) continue
        const front = (s === 's' || s === 'e') && faceGapAhead(f) >= 14
        for (let i = 0; i < g.cols; i++) {
          const cx = -g.span / 2 + (i + 0.5) * g.cw
          const hasBalcony = front && i % 2 === 0
          for (let j = 0; j < g.floors; j++) {
            const fy = wy0 + j * g.floorH
            if (fy + g.floorH * 0.8 < g.clear) continue
            if (g.ads.length && adHit(g.ads, cx, fy, g.winW + 1, g.floorH)) continue
            if (hasBalcony) {
              balcony(f, cx, fy + 0.03, Math.min(2.5, g.winW + 1.0))
            } else {
              // 防盗网是栏杆不是铁板：上下横杆 + 细竖杆，窗光要透得出来
              const gw = g.winW + 0.16
              for (const dy of [-0.74, 0.74]) wallBox(solid, f, cx, 0.24, fy + 1.62 + dy, gw, 0.06, 0.08, '#5d6268')
              for (let k = 0; k <= 4; k++) wallBox(solid, f, cx - gw / 2 + (gw * k) / 4, 0.24, fy + 1.62, 0.04, 1.5, 0.04, '#5d6268')
              if (j % 2 === 1) acUnit(f, cx + g.winW * 0.36, fy + 1.0)
            }
          }
        }
      }
      // 老城砖楼：侧面挂一列逃生梯
      if (b.district === 'B' || b.district === 'E') {
        if (b.h > 11 && !b.lite && rnd01(b, 77) < 0.5) fireEscape(b, bottom, rnd01(b, 78) < 0.5 ? 'e' : 'w')
      }
      if (b.h > 12) solid.box(b.w + 0.22, 0.22, b.d + 0.22, '#cfc6b6', b.x, bottom + Math.min(11, b.h * 0.42), b.z, 0)
      // 屋顶设备：空调外机 + 排风管，和便利店屋顶同一套零件
      if (sty === 'flat' || sty === 'frame') {
        const top = bottom + b.h
        solid.box(2.4, 1.05, 1.7, '#b8bdbe', b.x + Math.min(3, b.w * 0.22), top + 0.62, b.z - 1.2, 0)
        solid.box(1.7, 0.75, 1.3, '#a6acad', b.x - Math.min(3.2, b.w * 0.2), top + 0.48, b.z + 1.1, 0)
        solid.cyl(0.32, 0.85, '#8f9596', b.x + 0.4, top + 0.5, b.z - Math.min(2.4, b.d * 0.28), 8)
        solid.box(2.2, 1.6, 2.2, '#b9c0c6', b.x + 3, top + 1.0, b.z, 0)
        solid.box(2.4, 0.12, 1.6, '#5a6d7d', b.x - 4, top + 0.35, b.z, 0.2)
      }
      // 南立面挂几台外机，不全楼铺满
      {
        const f = faceInfo(b, 's')
        const n = Math.max(1, Math.min(4, Math.floor(f.w / 7)))
        for (let i = 0; i < n; i++) acUnit(f, -f.w * 0.35 + (i * f.w * 0.7) / n, bottom + 5.2 + (i % 2) * 3.3)
      }
      // 楼道窗
      solid.box(1.2, 1.6, 0.2, '#3d4750', b.x + b.w / 2 - 1.2, bottom + b.h * 0.55, b.z + b.d / 2, 0)
      if (!b.shops) {
        // 单元门口的壁灯：灯罩 + 暖光 + 光晕 + 地上一滩光，巷子里也有暖点
        const f = faceInfo(b, 's')
        const la = b.w / 2 - 2.2
        wallBox(solid, f, la, 0.16, bottom + 3.0, 0.3, 0.12, 0.32, '#5a4a3e')
        wallBox(glow, f, la, 0.2, bottom + 2.78, 0.22, 0.32, 0.22, '#ffd59a')
        haloExtra.push([f.x + f.nz * la + f.nx * 0.3, bottom + 2.8, f.z - f.nx * la + f.nz * 0.3, '#ffc98a'])
        lightPools.push({ x: f.x + f.nz * la + f.nx * 1.6, z: f.z - f.nx * la + f.nz * 1.6, w: 4.2, d: 3.6, y: y + 0.22, c: '#ff9a40' })
        // 侧墙上的海报 / 小广告：一块彩色、一块米白
        const fw = faceInfo(b, 'w')
        const pr = hash(Math.round(b.x), Math.round(b.z), 3)
        wallBox(solid, fw, 0, 0.05, bottom + 1.9, 0.9, 1.2, 0.04, ['#e0322f', '#2a9df4', '#f4a52a', '#3fae6a'][Math.floor(pr * 4)])
        wallBox(solid, fw, 1.1, 0.05, bottom + 1.8, 0.7, 0.9, 0.04, '#f3ead8')
      }
      if (b.shops) {
        // 有店面时门就在店面上，不再往墙上贴一块门板
        const f = faceInfo(b, b.face || 's')
        doors.push({ x: f.x + f.nx * 1.6, z: f.z + f.nz * 1.6, y: P.groundY(f.x, f.z), name: b.name || '沿街店铺', kind: b.kind, b })
      }
    } else if (b.kind === 'slab') {
      const cut = MASS_CUT(b, bottom)
      if (cut) {
        solid.box(b.w, cut.rest, b.d, b.color, b.x, bottom + CUT_H + cut.rest / 2, b.z, 0)
        solid.box(b.w, CUT_H, b.d, b.color, b.x, bottom + CUT_H / 2, b.z, 0, { skip: cut.face })
        solid.box(b.w + 0.1, 0.26, b.d + 0.1, shade(b.color, 0.8), b.x, bottom + CUT_H - 0.13, b.z, 0)
      } else {
        solid.box(b.w, b.h, b.d, b.color, b.x, bottom + b.h / 2, b.z, 0)
        solid.box(b.w + 0.16, 1.15, b.d + 0.16, '#b9b0a2', b.x, bottom + 0.58, b.z, 0)
      }
      pilasters(b, bottom, b.h, shade(b.color, 0.84))
      solid.box(b.w * 0.3, b.h, b.d * 0.5, b.trim, b.x, bottom + b.h / 2, b.z, 0)
      const sy0 = bottom + (b.shops ? 4.62 : 1.4)
      for (const s of ['s', 'n']) {
        const f = faceInfo(b, s)
        const g = facadeGrid(f, sy0, b.h - (sy0 - bottom) - 0.4, { bay: 3.2, ratio: 0.5, winH: 1.55, life: true, tone: toneOf(b), neon: neonOf(b), bandColor: shade(b.color, 0.9), trim: shade(b.color, 0.76) })
        if (!g) continue
        for (let i = 0; i < g.cols; i++) {
          const cx = -g.span / 2 + (i + 0.5) * g.cw
          for (let j = 0; j < g.floors; j++) if (sy0 + (j + 0.8) * g.floorH >= g.clear) balcony(f, cx, sy0 + j * g.floorH + 0.02, Math.min(2.6, g.winW + 0.8))
        }
      }
      if (b.h > 16) solid.box(b.w + 0.2, 0.22, b.d + 0.2, '#cfc6b6', b.x, bottom + 12, b.z, 0)
      {
        const top = bottom + b.h
        solid.box(2.6, 1.1, 1.8, '#b8bdbe', b.x + 4, top + 0.7, b.z - 2, 0)
        solid.cyl(0.4, 1.1, '#8f9596', b.x - 3, top + 0.6, b.z + 2, 8)
        solid.box(2.4, 1.8, 2.4, '#b9c0c6', b.x, top + 1.1, b.z + 3, 0)
      }
    } else if (b.kind === 'mall') {
      solid.box(b.w, b.h * 0.75, b.d, b.color, b.x, bottom + b.h * 0.375, b.z, 0)
      solid.box(b.w * 0.86, b.h * 0.25, b.d * 0.86, '#c3ced8', b.x, bottom + b.h * 0.88, b.z, 0)
      // 广告屏
      solid.box(b.w * 0.42, 9, 0.5, '#14181f', b.x, bottom + b.h * 0.52, b.z + b.d / 2 + 0.4, 0)
      glow.box(b.w * 0.4, 8.2, 0.2, '#3a9cc8', b.x, bottom + b.h * 0.52, b.z + b.d / 2 + 0.7, 0)
      // 主入口雨棚
      solid.box(16, 0.5, 6, '#d6dee6', b.x, bottom + 8.4, b.z + b.d / 2 + 3, 0)
      solid.box(0.5, 6.4, 0.5, '#8f99a2', b.x - 7, bottom + 3.2, b.z + b.d / 2 + 5.6, 0)
      solid.box(0.5, 6.4, 0.5, '#8f99a2', b.x + 7, bottom + 3.2, b.z + b.d / 2 + 5.6, 0)
      // 屋顶冷却塔
      for (let i = 0; i < 3; i++) solid.cyl(2.6, 2.2, '#aab4bd', b.x - 18 + i * 18, bottom + b.h, b.z - 6, 8)
      entryDoor(b, 's', b.name)
      for (const s of ['s', 'e', 'w', 'n'])
        facadeGrid(faceOf(b.x, b.z, b.w, b.d, s), bottom + 8.6, b.h * 0.62, { bay: 5.2, ratio: 0.7, winH: 2.0, maxCols: 8, tone: 'cool', bandColor: shade(b.color, 0.9), trim: shade(b.color, 0.76) })
    } else if (b.kind === 'hotel') {
      solid.box(b.w, b.h * 0.22, b.d, '#b9c2ca', b.x, bottom + b.h * 0.11, b.z, 0)
      solid.box(b.w * 0.72, b.h * 0.78, b.d * 0.72, b.color, b.x, bottom + b.h * 0.22 + b.h * 0.39, b.z, 0)
      // 客房规整窗格：窄开间、每层一排，越整齐越像酒店
      for (const s of ['s', 'e', 'n', 'w'])
        facadeGrid(faceOf(b.x, b.z, b.w * 0.72, b.d * 0.72, s), bottom + b.h * 0.235, b.h * 0.77, {
          bay: 3.0,
          ratio: 0.48,
          winH: 1.5,
          sill: 0.9,
          maxCols: 14,
          dark: 0.45,
          tone: 'warm',
          neon: 0.08,
          bandColor: shade(b.color, 1.04),
          trim: shade(b.color, 0.8),
        })
      solid.box(12, 2.4, 0.4, '#1b2733', b.x, bottom + b.h + 1.2, b.z + b.d * 0.3, 0)
      glow.box(11, 1.6, 0.2, '#ffd9a2', b.x, bottom + b.h + 1.2, b.z + b.d * 0.3 + 0.3, 0)
      solid.box(10, 0.4, 4, '#d6dee6', b.x, bottom + 4.2, b.z + b.d * 0.5 + 2.4, 0)
      entryDoor(b, 's', b.name)
    } else if (b.kind === 'stadium') {
      solid.cyl(b.w * 0.42, b.h, '#c3ccd4', b.x, bottom, b.z, 18)
      solid.cyl(b.w * 0.4, 3, '#dfe6ec', b.x, bottom + b.h, b.z, 18, { rt: b.w * 0.26 })
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2
        solid.box(2.6, 12, 1.0, '#9aa5ae', b.x + Math.cos(a) * b.w * 0.44, bottom + 6, b.z + Math.sin(a) * b.w * 0.44, -a)
      }
      for (let i = 0; i < 6; i++) solid.box(3.2, 0.4, b.d * 0.9, '#b7c1c9', b.x - b.w * 0.45, bottom + 1.2 + i * 1.1, b.z, 0, { skipBottom: false })
      entryDoor(b, 's', b.name)
    } else if (b.kind === 'school') {
      solid.box(b.w * 0.62, b.h, b.d * 0.34, '#d8cbb4', b.x - b.w * 0.14, bottom + b.h / 2, b.z - b.d * 0.22, 0)
      solid.box(b.w * 0.3, b.h * 0.75, b.d * 0.3, '#cfc0a6', b.x + b.w * 0.32, bottom + b.h * 0.38, b.z + b.d * 0.1, 0)
      for (let i = 0; i < 4; i++) {
        const yy = bottom + 1.4 + i * 3.3
        solid.box(b.w * 0.62, 0.28, 1.4, '#b5a68c', b.x - b.w * 0.14, yy, b.z - b.d * 0.34, 0)
      }
      windows(b, 's', bottom + 4.4, 3, { maxBays: 9, winH: 1.8, ratio: 0.66, bay: 3.6 })
      // 操场
      solid.box(b.w * 0.8, 0.12, b.d * 0.44, '#8a6a4a', b.x, bottom + 0.06, b.z + b.d * 0.26, 0, { skipBottom: false })
      solid.box(b.w * 0.5, 0.1, b.d * 0.24, '#5c7a4a', b.x, bottom + 0.14, b.z + b.d * 0.26, 0, { skipBottom: false })
      entryDoor(b, 's', b.name)
    } else if (b.kind === 'hospital') {
      solid.box(b.w, b.h, b.d, '#e2e6e8', b.x, bottom + b.h / 2, b.z, 0)
      solid.box(b.w * 0.5, 0.4, 4, '#c8d2d8', b.x, bottom + 3.6, b.z + b.d / 2 + 2, 0)
      glow.box(1.6, 0.3, 0.12, '#ff3b30', b.x, bottom + 5.4, b.z + b.d / 2 + 0.1, 0)
      glow.box(0.3, 1.6, 0.12, '#ff3b30', b.x, bottom + 5.4, b.z + b.d / 2 + 0.1, 0)
      windows(b, 's', bottom + 2, 5, { maxBays: 6, winH: 1.6, ratio: 0.6, bay: 3.2 })
      entryDoor(b, 's', b.name)
    } else if (b.kind === 'market') {
      solid.box(b.w, 4.5, b.d, '#a89c86', b.x, bottom + 2.25, b.z, 0)
      solid.box(b.w + 1, 0.4, b.d + 1, '#7d715c', b.x, bottom + 4.7, b.z, 0)
      for (let i = 0; i < 5; i++) solid.box(1.6, 0.5, b.d, '#8e826c', b.x - b.w * 0.4 + i * (b.w * 0.2), bottom + 5.1, b.z, 0)
      for (let i = 0; i < 6; i++) solid.box(0.4, 5.0, 0.4, '#6b6152', b.x - b.w * 0.45 + i * (b.w * 0.18), bottom + 2.5, b.z + b.d * 0.46, 0)
      glow.box(b.w * 0.6, 1.2, 0.24, '#ffd9a2', b.x, bottom + 3.4, b.z + b.d / 2 + 0.2, 0)
      entryDoor(b, 's', b.name)
    } else if (b.kind === 'konbini') {
      // 街角便利店：整座城市的画法基准。
      // 结构：石材墙裙 + 米色墙身 + 一整圈玻璃橱窗 + 挑出雨棚 + 亮灯店招 + 屋顶设备
      const g0 = bottom
      const wallH = b.h - 1.4
      const wallCol = b.color || '#e8ded0'
      // 墙身：核心体往里缩，四周留出 2.6m 深的真店内
      solid.box(b.w, 0.34, b.d, wallCol, b.x, g0 + 3.66, b.z, 0) // 窗带以上的墙帽
      solid.box(b.w - 4.6, 3.55, b.d - 4.6, wallCol, b.x, g0 + 1.78, b.z, 0)
      // 四角壁柱：把四面店面的两端堵住，橱窗里不会露出空洞
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          solid.box(2.5, 3.55, 2.5, shade(wallCol, 0.94), b.x + sx * (b.w / 2 - 1.25), g0 + 1.78, b.z + sz * (b.d / 2 - 1.25), 0)
      // 石材墙裙：围着店面一圈，不挡住橱窗
      for (const sg of [-1, 1]) {
        solid.box(b.w + 0.2, 1.05, 0.3, '#b9b0a2', b.x, g0 + 0.52, b.z + sg * (b.d / 2 - 0.05), 0)
        solid.box(0.3, 1.05, b.d + 0.2, '#b9b0a2', b.x + sg * (b.w / 2 - 0.05), g0 + 0.52, b.z, 0)
      }
      // 顶板 + 檐口
      solid.box(b.w + 1.2, 0.42, b.d + 1.2, '#cfc6b6', b.x, g0 + wallH + 0.21, b.z, 0)
      solid.box(b.w + 0.8, 0.2, b.d + 0.8, '#b5ab9c', b.x, g0 + wallH + 0.5, b.z, 0)

      // 四个立面：一整圈「店内」发光贴图 + 玻璃 + 深色竖梃 + 窗台
      // （和普通店铺同一套画法：细节是画的，不是拿小方块拼的）
      const konFace = (side, out, w, h, yc, mat, order) => {
        const f = faceInfo(b, side)
        const m = new THREE.Mesh(UNIT, mat)
        m.scale.set(w, h, 1)
        m.position.set(f.x + f.nx * out, yc, f.z + f.nz * out)
        m.rotation.y = side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2
        if (order) m.renderOrder = order
        m.frustumCulled = false
        scene.add(m)
        return m
      }
      for (const side of ['s', 'e', 'n', 'w']) {
        const f = faceInfo(b, side)
        const gw = f.w - 1.6
        const gy = g0 + 0.95
        const gh = 2.6
        const KD = 2.2
        const iw2 = f.w - 5.1
        // 窗洞框 + 窗台
        facade(solid, f, 0, gy - 0.18, gw + 0.5, gh + 0.4, '#8a7f70', 0.06)
        facade(solid, f, 0, gy - 0.34, gw + 0.5, 0.18, '#d5cbbd', 0.1)
        // 店内：2.6m 深的真货架 / 冷柜 / 收银台
        const [ix0, iz0] = [f.x + f.nx * (0.14 - KD), f.z + f.nz * (0.14 - KD)]
        buildShopInterior({
          kind: 'store', x: ix0, z: iz0, nx: f.nx, nz: f.nz, fy: gy - 0.3, sw: iw2, D: KD,
          rr: P.mulberry32(Math.floor(Math.abs(f.x) * 53 + Math.abs(f.z) * 29) + (side === 's' ? 1 : side === 'e' ? 2 : 3)),
          ink: '#1f8a5b', h: 2.6,
        })
        // 玻璃
        konFace(side, 0.18, gw + 0.06, gh, gy + gh / 2, paneMat, 3)
        // 竖梃 + 上横梁
        for (let i = 0; i <= 4; i++) {
          const cx = -gw / 2 + (gw * i) / 4
          facade(solid, f, cx, gy, 0.11, gh, '#39405a', 0.14)
        }
        facade(solid, f, 0, gy + gh - 0.06, gw, 0.12, '#39405a', 0.14)
        // 玻璃下面的石材基座，把橱窗垫起来
        solid.box(f.nx === 0 ? gw + 0.3 : 0.16, gy - g0, f.nx === 0 ? 0.16 : gw + 0.3, '#b9b0a2', f.x + f.nx * 0.16, g0 + (gy - g0) / 2, f.z + f.nz * 0.16, 0)
      }

      // 主入口（朝南）：门套 + 自动门 + 门垫 + 雨棚
      const fy0 = g0 + 0.04
      solid.box(3.4, 0.1, 3.2, '#3c3a38', b.x, fy0 + 0.24, b.z + b.d / 2 + 1.4, 0, { skipBottom: false })
      solid.box(3.0, 2.6, 0.3, '#6f6658', b.x - 1.7, fy0 + 1.3, b.z + b.d / 2 + 0.18, 0)
      solid.box(3.0, 2.6, 0.3, '#6f6658', b.x + 1.7, fy0 + 1.3, b.z + b.d / 2 + 0.18, 0)
      glow.box(2.8, 2.4, 0.16, '#f5e0b4', b.x, fy0 + 1.2, b.z + b.d / 2 + 0.2, 0)
      solid.box(0.1, 2.4, 0.1, '#5f574b', b.x, fy0 + 1.2, b.z + b.d / 2 + 0.24, 0)
      // 雨棚 + 斜撑 + 棚下灯带
      solid.box(5.0, 0.16, 2.0, '#d8cfc0', b.x, fy0 + 2.9, b.z + b.d / 2 + 1.0, 0)
      for (const t of [-1, 1]) solid.box(0.09, 0.8, 0.09, '#8d8272', b.x + t * 2.2, fy0 + 2.5, b.z + b.d / 2 + 1.85, 0)
      bright.box(4.6, 0.08, 0.14, '#ffe9c0', b.x, fy0 + 2.8, b.z + b.d / 2 + 1.95, 0)
      // 门口暖光地池
      glow.box(4.4, 0.03, 3.0, '#c9a870', b.x, fy0 + 0.28, b.z + b.d / 2 + 1.6, 0, { skipBottom: false })

      // 主店招：白底绿字的灯箱，压在雨棚上
      const sgY = g0 + wallH - 0.55
      for (const s of ['s', 'e']) {
        const f = faceInfo(b, s)
        const sw = s === 's' ? b.w * 0.62 : b.d * 0.6
        const nx = f.nx
        const nz = f.nz
        const bx0 = f.x + nx * 0.16
        const bz0 = f.z + nz * 0.16
        solid.box(nx === 0 ? sw + 0.3 : 0.22, 1.2, nx === 0 ? 0.22 : sw + 0.3, '#2f3a33', bx0, sgY, bz0, 0)
        bright.box(nx === 0 ? sw : 0.08, 1.0, nx === 0 ? 0.08 : sw, '#d8f0d8', bx0 + nx * 0.14, sgY + 0.1, bz0 + nz * 0.14, 0)
        // 灯箱外框两条横线
        solid.box(nx === 0 ? sw + 0.4 : 0.26, 0.08, nx === 0 ? 0.26 : sw + 0.4, '#3e4a42', bx0, sgY - 0.62, bz0, 0)
        solid.box(nx === 0 ? sw + 0.4 : 0.26, 0.08, nx === 0 ? 0.26 : sw + 0.4, '#3e4a42', bx0, sgY + 0.62, bz0, 0)
      }
      // 竖挑招牌（远处也能认出来）
      solid.box(0.16, 3.2, 0.9, '#2f3a33', b.x + b.w / 2 + 0.5, g0 + wallH + 1.4, b.z + b.d / 2 - 1.2, 0)
      bright.box(0.1, 2.8, 0.76, '#c8ecd0', b.x + b.w / 2 + 0.6, g0 + wallH + 1.5, b.z + b.d / 2 - 1.2, 0)

      // 屋顶：空调外机 + 排风 + 女儿墙
      solid.box(b.w * 0.3, 0.9, b.d * 0.3, '#b8bdbe', b.x - 3, g0 + wallH + 0.75, b.z - 2, 0)
      solid.box(b.w * 0.24, 0.7, b.d * 0.24, '#a6acad', b.x + 3.4, g0 + wallH + 0.65, b.z + 1.4, 0)
      solid.cyl(0.42, 0.9, '#8f9596', b.x + 1.2, g0 + wallH + 0.6, b.z - 3.4, 8)
      for (const s of [-1, 1]) {
        solid.box(b.w + 0.6, 0.7, 0.18, '#cfc6b6', b.x, g0 + wallH + 0.9, b.z + s * (b.d / 2 + 0.2), 0)
        solid.box(0.18, 0.7, b.d + 0.6, '#cfc6b6', b.x + s * (b.w / 2 + 0.2), g0 + wallH + 0.9, b.z, 0)
      }

      // 门口杂项：垃圾桶、报纸箱、自行车、地贴
      const dx0 = b.x + b.w / 2 + 1.6
      const dz0 = b.z + b.d / 2 + 0.8
      solid.cyl(0.32, 0.9, '#5d6b60', dx0, P.groundY(dx0, dz0) + 0.1, dz0, 8)
      solid.box(0.5, 0.9, 0.4, '#c8a04a', b.x - b.w / 2 - 1.2, P.groundY(b.x - b.w / 2 - 1.2, dz0) + 0.55, dz0, 0)

      // 真正的字：绿底白字的 24 小时灯箱（远看就是那块熟悉的牌子）
      {
        const c = document.createElement('canvas')
        c.width = 1024
        c.height = 256
        const g = c.getContext('2d')
        g.fillStyle = '#1f6f4a'
        g.fillRect(0, 0, 1024, 256)
        g.fillStyle = '#0e3d2a'
        g.fillRect(0, 214, 1024, 42)
        g.strokeStyle = '#f2f7f3'
        g.lineWidth = 6
        g.strokeRect(12, 12, 1000, 232)
        g.fillStyle = '#f6fbf7'
        g.font = 'bold 118px "PingFang SC", "Microsoft YaHei", sans-serif'
        g.textBaseline = 'middle'
        g.fillText('微光便利店', 56, 116)
        g.font = 'bold 62px "PingFang SC", "Microsoft YaHei", sans-serif'
        g.fillText('24H', 800, 116)
        g.font = '34px "PingFang SC", "Microsoft YaHei", sans-serif'
        g.fillText('LUMEN  MART', 56, 236)
        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
        const sw = b.w * 0.66
        const sg = new THREE.PlaneGeometry(sw, sw / 4)
        // 南面主招牌
        const m1 = new THREE.Mesh(sg, mat)
        m1.position.set(b.x, g0 + wallH - 0.5, b.z + b.d / 2 + 0.32)
        scene.add(m1)
        // 东面侧招牌（街角来的方向也看得到）
        const m2 = new THREE.Mesh(sg, mat)
        m2.position.set(b.x + b.w / 2 + 0.32, g0 + wallH - 0.5, b.z)
        m2.rotation.y = Math.PI / 2
        m2.scale.set(b.d / b.w, 1, 1)
        scene.add(m2)
      }

      entryDoor(b, 's', b.name)
    } else if (b.kind === 'site') {
      // 围挡 + 塔吊 + 钢管堆
      const green = '#3f7a52'
      solid.box(b.w, 2.6, 0.3, green, b.x, bottom + 1.3, b.z + b.d / 2, 0)
      solid.box(b.w, 2.6, 0.3, green, b.x, bottom + 1.3, b.z - b.d / 2, 0)
      solid.box(0.3, 2.6, b.d, green, b.x - b.w / 2, bottom + 1.3, b.z, 0)
      solid.box(0.3, 2.6, b.d, green, b.x + b.w / 2, bottom + 1.3, b.z, 0)
      solid.box(2.2, 34, 2.2, '#d8b23a', b.x - 10, bottom + 17, b.z, 0)
      solid.box(30, 1.4, 1.4, '#d8b23a', b.x + 4, bottom + 32, b.z, 0)
      solid.box(1.0, 6, 1.0, '#d8b23a', b.x + 18, bottom + 27, b.z, 0)
      for (let i = 0; i < 5; i++) solid.box(12, 0.8, 2.4, '#8a9299', b.x - 16, bottom + 0.5 + i * 0.9, b.z + 8, 0.1)
      solid.box(8, 5, 8, '#9aa2a8', b.x + 12, bottom + 2.5, b.z - 10, 0)
    } else if (b.kind === 'village') {
      const rnd = P.mulberry32(77)
      for (let i = 0; i < 26; i++) {
        const x = b.x - b.w / 2 + 4 + rnd() * (b.w - 8)
        const z = b.z - b.d / 2 + 4 + rnd() * (b.d - 8)
        const h = 3.3 * (3 + Math.floor(rnd() * 3))
        const w = 6 + rnd() * 4
        solid.box(w, h, 7 + rnd() * 4, rnd() < 0.5 ? '#c2b7a4' : '#b0a795', x, bottom + h / 2, z, 0)
        solid.box(w + 0.4, 0.35, 7.6, '#8b8271', x, bottom + h, z, 0)
        for (let f = 1; f < h / 3.3; f++) glow.box(w * 0.4, 1.0, 0.1, '#ffd9a2', x, bottom + f * 3.3 + 1.2, z + 3.6, 0)
        solid.box(w * 0.5, 0.8, 0.16, '#c23a2a', x, bottom + 2.6, z + 3.7, 0)
      }
    } else if (b.kind === 'clocktower') {
      solid.box(b.w * 1.5, 5, b.d * 1.5, '#b9a58a', b.x, bottom + 2.5, b.z, 0)
      solid.taper(b.w, b.h - 8, b.d, 0.82, '#c9b69a', b.x, bottom + 5 + (b.h - 8) / 2, b.z, 0, { skipBottom: false })
      solid.box(b.w + 0.8, 1.0, b.d + 0.8, '#8d7c62', b.x, bottom + b.h - 3, b.z, 0)
      solid.cone(b.w * 0.9, 4.2, '#7a4a2e', b.x, bottom + b.h - 2.6, b.z, 4)
      for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        glow.box(nx === 0 ? 3.4 : 0.12, 3.4, nx === 0 ? 0.12 : 3.4, '#f4e6c8', b.x + nx * (b.w / 2 + 0.06), bottom + b.h - 7, b.z + nz * (b.d / 2 + 0.06), 0)
        solid.box(nx === 0 ? 0.2 : 0.16, 1.4, nx === 0 ? 0.16 : 0.2, '#2a2622', b.x + nx * (b.w / 2 + 0.14), bottom + b.h - 6.6, b.z + nz * (b.d / 2 + 0.14), 0)
        solid.box(nx === 0 ? 0.9 : 0.16, 0.18, nx === 0 ? 0.16 : 0.9, '#2a2622', b.x + nx * (b.w / 2 + 0.14), bottom + b.h - 7.4, b.z + nz * (b.d / 2 + 0.14), 0)
      }
      glow.box(b.w + 1.0, 0.24, b.d + 1.0, '#ffd9a2', b.x, bottom + b.h - 2.4, b.z, 0)
      entryDoor(b, 's', b.name)
    } else if (b.kind === 'station') {
      solid.box(b.w, 3.2, b.d * 0.5, '#c6d0d8', b.x, bottom + 1.6, b.z - b.d * 0.2, 0)
      for (let i = 0; i < 5; i++) solid.box(0.4, 5.4, 0.4, '#8f9aa4', b.x - b.w * 0.42 + i * (b.w * 0.21), bottom + 2.7, b.z + b.d * 0.4, 0)
      solid.box(b.w, 0.5, b.d * 0.6, '#d6dee6', b.x, bottom + 5.6, b.z + b.d * 0.25, 0)
      for (let i = 0; i < 3; i++) solid.box(b.w * 0.24, 0.9, 0.9, '#7f8890', b.x - b.w * 0.28 + i * (b.w * 0.28), bottom + 0.45, b.z + b.d * 0.3, 0)
      entryDoor(b, 's', b.name)
    } else {
      // civic 等通用体量
      solid.box(b.w, b.h, b.d, b.color, b.x, bottom + b.h / 2, b.z, 0)
      solid.box(b.w + 0.6, 0.6, b.d + 0.6, b.trim, b.x, bottom + b.h, b.z, 0)
      solid.box(6, 0.3, 3.4, '#c8d2d8', b.x, bottom + 3.8, b.z + b.d / 2 + 1.7, 0)
      windows(b, 's', bottom + 1.6, Math.max(1, Math.floor((b.h - 1.6) / 3.3)), { maxBays: 6, winH: 1.6, ratio: 0.58, bay: 3.2 })
      windows(b, 'e', bottom + 1.6, Math.max(1, Math.floor((b.h - 1.6) / 3.3)), { maxBays: 6, winH: 1.6, ratio: 0.58, bay: 3.2 })
      entryDoor(b, 's', b.name)
    }

    // ------------------------------------------------ 屋顶与墙身收口（每栋都做）
    // 檐口 + 女儿墙 + 落水管 + 墙裙：这四件是「雨夜便利店」里让盒子变成建筑的细节
    const cor = b.trim || shade(b.color || '#c8cfd6', 0.82)
    const cap = b.color ? shade(b.color, 1.06) : '#d7d0c4'
    const b0 = b
    if (b.kind !== 'site' && b.kind !== 'village' && b.kind !== 'stadium' && b.kind !== 'clocktower' && b.kind !== 'station' && b.kind !== 'konbini') {
      // 退台塔楼的檐口 / 女儿墙落在顶段上（块内 b 换成顶段尺寸）
      const b = b0.topW ? { ...b0, w: b0.topW, d: b0.topD } : b0
      const top = bottom + b.h
      solid.box(b.w + 0.9, 0.3, b.d + 0.9, cor, b.x, top - 0.1, b.z, 0)
      // 屋面比墙亮一档的石板灰：俯视时每栋楼的顶都是一块清楚的亮面，楼和楼不再糊成一片
      if (sty !== 'gable') solid.box(b.w + 0.2, 0.08, b.d + 0.2, roofOf(b0), b.x, top + 0.09, b.z, 0)
      if (sty === 'gable') {
        const rh = Math.min(b.w, b.d) * (b.district === 'B' ? 0.34 : 0.26)
        gable(b.x, b.z, b.w, b.d, top, rh, TILE[Math.floor(rnd01(b, 5) * TILE.length)], b.color || '#c8cfd6')
        // 老城坡顶上偶尔一个老虎窗
        if (b.district === 'B' && rnd01(b, 6) < 0.5 && b.w > 9) {
          const dz = b.w >= b.d ? b.z + b.d * 0.18 : b.z
          const dx = b.w >= b.d ? b.x : b.x + b.w * 0.18
          solid.box(2.2, 1.6, 2.0, b.color || '#c8cfd6', dx, top + rh * 0.35 + 0.8, dz, 0)
          glow.box(1.2, 0.9, 0.08, '#ffd59a', dx, top + rh * 0.35 + 0.8, dz + 1.02, 0)
        }
      } else {
      // 女儿墙：四条薄板围一圈，屋顶不再是平板
      const pw = b.w + 0.5
      const pd = b.d + 0.5
      const ph = 0.95
      solid.box(pw, ph, 0.26, cap, b.x, top + ph / 2, b.z + pd / 2, 0)
      solid.box(pw, ph, 0.26, cap, b.x, top + ph / 2, b.z - pd / 2, 0)
      solid.box(0.26, ph, pd, cap, b.x + pw / 2, top + ph / 2, b.z, 0)
      solid.box(0.26, ph, pd, cap, b.x - pw / 2, top + ph / 2, b.z, 0)
      if (sty === 'terrace' && b.w > 8 && b.d > 8) terrace(b, top, b.color || '#c8cfd6')
      if (b.h < 160 && b.w > 10 && b.d > 10 && rnd01(b, 61) < 0.75) bulkhead(b, top, P.mulberry32(Math.floor(Math.abs(b.x * 7 + b.z * 11)) + 3))
      if (sty === 'frame') roofFrame(b.x, b.z, b.w + 0.4, b.d + 0.4, top + 0.9, 3.2, cap, null)
      }
      cornerNeon(b, bottom)
      // 落水管：两个对角，从地面贴到檐口
      for (const [sx, sz] of [
        [1, 1],
        [-1, -1],
      ])
        solid.cyl(0.1, b.h - 0.4, '#8d93a8', b.x + sx * (b.w / 2 + 0.14), y + 0.1, b.z + sz * (b.d / 2 + 0.14), 5)
      // 墙裙（首层石材感），有店面的楼不压
      if (!b.shops && b.h > 6)
        solid.box(b.w + 0.16, 2.4, b.d + 0.16, shade(b.color || '#c8cfd6', 0.86), b.x, bottom + 1.2, b.z, 0)
      if (sty === 'flat' && b.h < 48 && b.kind !== 'tower' && b.kind !== 'office' && b.w > 8 && b.d > 8) roofLife(b, top)
      // 屋顶招牌要等 signMeshes / solid 都准备好，先记下来，楼全部建完再生成
      if (b.kind === 'walkup' || b.kind === 'slab' || b.kind === 'hotel') ROOF_JOBS.push([b0, bottom])
    }

    // 接地暗部（假接触阴影）
    aoAll.quad(
      [b.x - b.w / 2 - 0.6, y + 0.26, b.z + b.d / 2 + 0.6],
      [b.x + b.w / 2 + 0.6, y + 0.26, b.z + b.d / 2 + 0.6],
      [b.x + b.w / 2 + 0.6, y + 0.26, b.z - b.d / 2 - 0.6],
      [b.x - b.w / 2 - 0.6, y + 0.26, b.z - b.d / 2 - 0.6],
      '#1b1f24',
      0,
      1,
      0
    )
    if (b.kind === 'tower' || b.kind === 'office' || b.kind === 'walkup' || b.kind === 'mall' || b.kind === 'hotel' || b.kind === 'stadium' || b.kind === 'school' || b.kind === 'hospital' || b.kind === 'market' || b.kind === 'civic' || b.kind === 'station' || b.kind === 'clocktower' || b.kind === 'konbini') {
      colliders.push({ x: b.x, z: b.z, w: b.w, d: b.d, y: y + b.h, rot: 0 })
    }
  }

  // 广告位：下沉广场一圈 + 步行街两侧。每面墙至多一块，横版 2:1 或竖版 1:2，上下沿对齐楼层
  {
    const planAd = (b, s, rr) => {
      const f = faceOf(b.x, b.z, b.w, b.d, s)
      const by = P.groundY(b.x, b.z)
      const base = by + 5.4
      const availH = by + b.h - 1.4 - base
      if (availH < 4.5 || f.w < 6) return
      const land = f.w > availH * 1.2 && rr() < 0.75
      let w
      let h
      if (land) {
        w = Math.min(f.w - 2.4, 20, availH * 1.9)
        h = w / 2
      } else {
        h = Math.min(availH * 0.94, 16, (f.w - 2.4) * 2)
        w = h / 2
      }
      if (w < 3) return
      const fl = P.SCALE.floor
      const y0 = base + Math.floor(rr() * (Math.max(0, availH - h) / fl + 0.99)) * fl
      const cx = (rr() - 0.5) * Math.max(0, f.w - 2.4 - w)
      AD_PLAN.push({ f, cx, y0, w, h, land, d: Math.floor(rr() * (land ? 6 : 8)) })
    }
    // 核心商圈：每面朝街的墙都挂，竖向堆两块，像像素纽约的时代广场
    const AD_C = { x: (P.SUNKEN.x0 + P.SUNKEN.x1) / 2, z: (P.SUNKEN.z0 + P.SUNKEN.z1) / 2 }
    const planAdStack = (b, s2, rr) => {
      const f = faceOf(b.x, b.z, b.w, b.d, s2)
      const by = P.groundY(b.x, b.z)
      const base = by + 5.2
      const availH = by + b.h - 1.2 - base
      if (availH < 5 || f.w < 6) return
      const land = f.w > availH * 1.25
      const h = land ? Math.min(availH * 0.62, 11) : Math.min(availH * 0.9, 15, (f.w - 2) * 2)
      const w = land ? Math.min(f.w - 2, h * 2) : h / 2
      if (w < 3) return
      const cx = (rr() - 0.5) * Math.max(0, f.w - 2 - w)
      const y0 = base + (availH > h * 1.7 ? Math.floor(rr() * 2) * (h + 1.2) : 0)
      AD_PLAN.push({ f, cx, y0, w, h, land, d: Math.floor(rr() * (land ? 6 : 8)) })
      // 上方再叠一块，整面墙被广告包住
      if (y0 + h * 2 + 1.6 < by + b.h - 1) AD_PLAN.push({ f, cx, y0: y0 + h + 1.2, w, h, land, d: Math.floor(rr() * (land ? 6 : 8)) })
    }
    for (const b of P.buildings) {
      const dx = b.x - AD_C.x
      const dz = b.z - AD_C.z
      const dist = Math.hypot(dx, dz)
      if (dist > 150 || b.h < 10 || b.compound || b.site) continue
      const rr = P.mulberry32(Math.floor(Math.abs(b.x * 31 + b.z * 17)) + 7)
      const near = dist < 85
      const s1 = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'w' : 'e') : dz > 0 ? 'n' : 's'
      const s3 = Math.abs(dx) > Math.abs(dz) ? (dz > 0 ? 'n' : 's') : dx > 0 ? 'w' : 'e'
      if (near) {
        planAdStack(b, s1, rr)
        if (rr() < 0.7) planAdStack(b, s3, rr)
      } else {
        planAd(b, s1, rr)
        if (rr() < 0.5) planAd(b, s3, rr)
      }
    }
    const PS = P.PEDESTRIAN
    for (const b of P.buildings) {
      if (b.x < PS.x0 || b.x > PS.x1 || b.h < 9) continue
      if (Math.abs(b.z - PS.z) - b.d / 2 > 14) continue
      const rr = P.mulberry32(Math.floor(Math.abs(b.x * 13 + b.z * 7)) + 3)
      if (rr() > 0.3) continue
      planAd(b, b.z > PS.z ? 'n' : 's', rr)
    }
  }
  const aoAll = new MeshBuilder()
  for (let __i = 0; __i < P.buildings.length; __i++) {
    massing(P.buildings[__i])
    if (__i % 140 === 139) await step('起楼', 34 + Math.round((__i / P.buildings.length) * 10))
  }
  {
    const aom = new THREE.Mesh(aoAll.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false }))
    aom.renderOrder = 1
    aom.frustumCulled = false
    scene.add(aom)
  }

  // 双塔空中连廊（两塔东西并排）
  {
    const A = P.byId['twin-a']
    const B = P.byId['twin-b']
    if (A && B) {
      const x0 = A.x + A.w / 2
      const x1 = B.x - B.w / 2
      const len = x1 - x0 + 1
      const cx = (x0 + x1) / 2
      const y = P.groundY(cx, A.z) + 118
      solid.box(len, 3.6, 9, '#9fb2c0', cx, y, A.z, 0)
      glow.box(len - 1, 1.0, 0.14, '#ffe6b8', cx, y - 0.9, A.z + 4.6, 0)
      glow.box(len - 1, 1.0, 0.14, '#ffe6b8', cx, y - 0.9, A.z - 4.6, 0)
      solid.box(len + 0.4, 0.3, 9.4, '#c6d0d8', cx, y + 1.9, A.z, 0)
    }
  }

  // 小区围墙 + 门岗 + 道闸
  for (const c of P.COMPOUNDS) {
    const wallH = 2.2
    const gate = 9
    const cx = (c.x0 + c.x1) / 2
    const yz = (z) => P.groundY(cx, z)
    // 南墙（留大门）
    solid.box((c.x1 - c.x0) / 2 - gate / 2, wallH, 0.4, '#c2bba8', c.x0 + (c.x1 - c.x0) / 4 - gate / 4, yz(c.z0) + wallH / 2, c.z0, 0)
    solid.box((c.x1 - c.x0) / 2 - gate / 2, wallH, 0.4, '#c2bba8', c.x1 - (c.x1 - c.x0) / 4 + gate / 4, yz(c.z0) + wallH / 2, c.z0, 0)
    for (const z of [c.z1]) solid.box(c.x1 - c.x0, wallH, 0.4, '#c2bba8', cx, P.groundY(cx, z) + wallH / 2, z, 0)
    for (const x of [c.x0, c.x1]) solid.box(0.4, wallH, c.z1 - c.z0, '#c2bba8', x, P.groundY(x, (c.z0 + c.z1) / 2) + wallH / 2, (c.z0 + c.z1) / 2, 0)
    // 门岗
    const gy = P.groundY(cx, c.z0)
    solid.box(4.2, 3.2, 3.0, '#d8d2c4', cx + gate / 2 + 1.6, gy + 1.6, c.z0, 0)
    glow.box(2.4, 1.2, 0.14, '#ffe6b8', cx + gate / 2 + 1.6, gy + 2.0, c.z0 + 1.55, 0)
    solid.box(3.6, 0.4, 5.4, '#8f9aa4', cx, gy + 3.4, c.z0, 0)
    solid.box(0.3, 1.0, 0.3, '#7f8890', cx - 3.4, gy + 0.5, c.z0 + 2.4, 0)
    solid.box(0.3, 1.0, 0.3, '#7f8890', cx + 3.4, gy + 0.5, c.z0 + 2.4, 0)
    solid.box(7.2, 0.18, 0.18, '#d8d2c2', cx, gy + 1.2, c.z0 + 2.4, 0)
    // 小区名牌
    glow.box(5.0, 0.9, 0.14, '#ffd9a2', cx + gate / 2 + 1.6, gy + 3.5, c.z0 + 1.6, 0)
  }

  await step('装配店面', 66)
  // ---------------------------------------------------------------- 沿街店面
  // 参照「雨夜便利店」的画法：门面 = 深色框 + 一块「店内」发光贴图 + 一层带斜向
  // 高光的玻璃 + 连续品牌檐板 + 一道薄雨棚。细节全画在贴图里，几何只留框架，
  // 近看是货架/冷柜/收银台，远看是一条暖色灯带 —— 而不是一堆小方块拼的脚手架。
  // 门面常量（相对地面 fy）
  const GY0 = 0.30, GH = 2.55, FY0 = 3.09, FH = 0.82
  const DEP = 3.4 // 店面进深：楼的首层正面掏空后，店面真的是 3.4 米深的房间
  const FRAME = '#39405a'
  await step('画招牌', 72)
  // ---------------------------------------------------------------- 店招
  // plan.js 里给每家店都排了招牌样式（s.s），这里一间一间照着画：
  // 灯箱 / 亚克力 / LED / 木牌 / 布幡 / 刀旗 / 背光字 / 霓虹 / 喷绘 / VI / 场景 / 黑板。
  // 样式之间在远看就能分辨：底色明暗、压边、有没有徽章、字是实心还是发光的。
  const SIGN_GLOW = {
    lightbox: 1.05,
    panel: 0.94,
    led: 0.72,
    wood: 0.86,
    cloth: 0.84,
    blade: 0.92,
    backlight: 0.9,
    neon: 0.82,
    sleeve: 0.98,
    vi: 1.06,
    scene: 1.08,
    chalk: 0.86,
  }

  /** 浅底（白 / 米色）灯箱最容易烧白：按底色亮度再压 */
  const TAGLINE = {
    glasses: '验光配镜', pharmacy: '医保定点', noodle: '手工现做', breakfast: '现磨豆浆', tea: '鲜果现泡', coffee: '现磨咖啡',
    bakery: '每日现烤', fruit: '产地直供', hotpot: '老火底料', bbq: '炭火现烤', barber: '洗剪吹', laundry: '干洗熨烫',
    parcel: '快递代收', print: '复印打印', phone: '以旧换新', book: '新书上架', flower: '鲜花速递', pet: '洗护寄养',
    repair: '修鞋配钥匙', restaurant: '家常小炒', deli: '秘制卤味', gym: '24H健身', bank: '自助服务', store: '日用百货',
    market: '新鲜蔬果', liquor: '名酒名烟', hardware: '水电五金', stationery: '文具教辅', baby: '母婴用品', ktv: '欢唱不打烊',
  }
  const signLit = (s, style) => (SIGN_GLOW[style] || 1) * (lum(s.color) > 0.7 ? 0.78 : lum(s.color) > 0.5 ? 0.9 : 1)
  const drawSign = (g, w, h, s, style) => {
    g.textAlign = 'left'
    const dark = lum(s.color) < 0.34
    const ink = s.ink
    const white = '#fffdf6'
    const txt = dark ? white : ink
    const bar = Math.max(3, h * 0.07)
    // 字号自动缩到可用宽度里，绝不溢出、绝不被拉扁
    const fit = (maxW, start = h * 0.56, min = h * 0.26) => {
      let fs = start
      do {
        g.font = `900 ${Math.round(fs)}px ${CN_FONT}`
        if (g.measureText(s.name).width <= maxW) return fs
        fs -= 2
      } while (fs > min)
      return min
    }
    const base = (c) => {
      g.fillStyle = c
      g.fillRect(0, 0, w, h)
    }
    const gloss = (a = 0.28) => {
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, `rgba(255,255,255,${a})`)
      gr.addColorStop(0.45, 'rgba(255,255,255,0)')
      gr.addColorStop(1, 'rgba(0,0,0,.18)')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
    }
    const nameAt = (x, y, color) => {
      g.fillStyle = color
      g.textBaseline = 'middle'
      g.fillText(s.name, x, y)
    }
    const chain = (s.kind === 'store' || s.kind === 'market' || s.kind === 'pharmacy') && s.tier === 'A'

    if (style === 'lightbox' || style === 'backlight') {
      // 雨夜便利店式灯箱：饱和底 + 上下压边 + 白圆徽章里的星
      base(s.color)
      gloss(0.16)
      const pale = lum(s.color) > 0.7
      const edge = pale ? s.ink : style === 'backlight' ? shade(s.color, 1.5) : dark ? s.ink : shade(s.color, 0.62)
      g.fillStyle = edge
      g.fillRect(0, 0, w, pale ? bar * 1.8 : bar)
      g.fillRect(0, h - (pale ? bar * 1.8 : bar), w, pale ? bar * 1.8 : bar)
      const br = h * 0.3
      const bx = h * 0.5
      g.fillStyle = pale ? s.ink : '#fffdf6'
      g.beginPath()
      g.arc(bx, h / 2, br, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = pale ? '#fffdf6' : s.color
      if (chain) {
        g.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5
          const r = i % 2 ? br * 0.45 : br * 0.9
          const px = bx + Math.cos(a) * r
          const py = h / 2 + Math.sin(a) * r
          i ? g.lineTo(px, py) : g.moveTo(px, py)
        }
        g.closePath()
        g.fill()
      } else {
        // 独立小店：方徽里一个店名首字，比每家门口一颗星星像正经招牌
        g.font = `900 ${Math.round(br * 1.14)}px ${CN_FONT}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText([...s.name][0], bx, h / 2 + br * 0.06)
        g.textAlign = 'left'
      }
      const nx = h * 0.92
      const tag = !chain && w / h > 5.2 ? TAGLINE[s.kind] : null
      const fs = fit(w - nx - h * (chain ? 1.55 : tag ? 2.3 : 0.36))
      g.lineWidth = Math.max(2, fs * 0.12)
      g.strokeStyle = dark ? 'rgba(0,0,0,.34)' : 'rgba(255,255,255,.5)'
      g.strokeText(s.name, nx, h * 0.54)
      nameAt(nx, h * 0.54, txt)
      if (tag) {
        // 右侧业态标语：小一号字 + 圆角描边框（「验光配镜」「手工现做」……）
        const tfs = Math.round(h * 0.24)
        g.font = `700 ${tfs}px ${CN_FONT}`
        const tw = g.measureText(tag).width
        const tx = w - h * 0.3 - tw
        g.strokeStyle = pale ? s.ink : dark ? 'rgba(255,240,210,.8)' : s.ink
        g.lineWidth = Math.max(1.5, h * 0.03)
        roundRect(g, tx - tfs * 0.4, h * 0.5 - tfs * 0.75, tw + tfs * 0.8, tfs * 1.5, tfs * 0.3)
        g.stroke()
        g.fillStyle = g.strokeStyle
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        g.fillText(tag, tx, h * 0.52)
      }
      if (chain) {
        g.textAlign = 'right'
        g.fillStyle = dark ? '#ffe9b8' : s.ink
        g.fillText('24小时', w - h * 0.26, h * 0.54)
        g.textAlign = 'left'
      }
    } else if (style === 'panel') {
      // 亚克力字：淡底 + 四边细线 + 居中的字，最朴素的一种
      base(lit(s.color, 0.16))
      g.strokeStyle = 'rgba(0,0,0,.28)'
      g.lineWidth = Math.max(2, h * 0.03)
      g.strokeRect(h * 0.12, h * 0.12, w - h * 0.24, h - h * 0.24)
      const fs = fit(w - h * 0.7, h * 0.5)
      g.textAlign = 'center'
      nameAt(w / 2, h * 0.5, ink)
      g.textAlign = 'left'
      g.fillStyle = ink
      g.globalAlpha = 0.5
      g.fillRect(w / 2 - fs * 0.9, h * 0.78, fs * 1.8, Math.max(2, h * 0.035))
      g.globalAlpha = 1
    } else if (style === 'led') {
      // LED 发光字：近黑底板 + 描边会晕开的字
      base('#12141a')
      g.strokeStyle = s.color
      g.lineWidth = Math.max(2, h * 0.035)
      g.strokeRect(h * 0.1, h * 0.1, w - h * 0.2, h - h * 0.2)
      const fs = fit(w - h * 0.8, h * 0.56)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.shadowColor = ink
      g.shadowBlur = h * 0.08
      g.fillStyle = ink
      g.fillText(s.name, w / 2, h * 0.52)
      g.shadowBlur = 0
      g.textAlign = 'left'
    } else if (style === 'wood') {
      // 木牌：木头横纹 + 深木边框 + 米黄刻字，小馆子最爱
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, '#8a5f36')
      gr.addColorStop(0.5, '#6f4a29')
      gr.addColorStop(1, '#54351d')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
      g.globalAlpha = 0.16
      g.fillStyle = '#2e1a0c'
      for (let i = 0; i < 7; i++) g.fillRect(0, h * (0.1 + i * 0.13), w, Math.max(1, h * 0.02))
      g.globalAlpha = 1
      g.strokeStyle = '#3a2412'
      g.lineWidth = Math.max(3, h * 0.08)
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth)
      const fs = fit(w - h * 0.9, h * 0.5)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = '#ffe6b4'
      g.fillText(s.name, w / 2, h * 0.52)
      g.textAlign = 'left'
      for (const px of [h * 0.22, w - h * 0.22]) {
        g.fillStyle = '#d8c8a8'
        g.beginPath()
        g.arc(px, h * 0.5, h * 0.045, 0, Math.PI * 2)
        g.fill()
      }
    } else if (style === 'cloth') {
      // 布幡 / 红布招牌：竖向布褶 + 白字 + 下沿流苏
      base(dark ? s.color : '#b8342c')
      g.globalAlpha = 0.14
      g.fillStyle = '#000000'
      for (let i = 0; i < 9; i++) g.fillRect((w / 9) * i + w * 0.03, 0, w * 0.022, h)
      g.globalAlpha = 1
      const fs = fit(w - h * 0.8, h * 0.54)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = white
      g.fillText(s.name, w / 2, h * 0.46)
      g.textAlign = 'left'
      g.fillStyle = '#f2d9a0'
      for (let i = 0; i < Math.floor(w / (h * 0.22)); i++) {
        const x0 = i * h * 0.22 + h * 0.08
        g.beginPath()
        g.moveTo(x0, h * 0.84)
        g.lineTo(x0 + h * 0.1, h * 0.84)
        g.lineTo(x0 + h * 0.05, h)
        g.closePath()
        g.fill()
      }
    } else if (style === 'blade') {
      // 刀旗 / 立体字招牌：浅色板 + 左侧斜切色块 + 深字
      base('#ecebe4')
      g.fillStyle = s.color
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(h * 1.5, 0)
      g.lineTo(h * 0.9, h)
      g.lineTo(0, h)
      g.closePath()
      g.fill()
      fit(w - h * 2.0, h * 0.52)
      g.textBaseline = 'middle'
      nameAt(h * 1.75, h * 0.52, ink)
      g.strokeStyle = 'rgba(0,0,0,.25)'
      g.lineWidth = Math.max(2, h * 0.035)
      g.strokeRect(1, 1, w - 2, h - 2)
    } else if (style === 'neon') {
      // 霓虹：深底 + 管状字（先粗管，再细白芯）
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, 'rgba(40,20,60,.9)')
      gr.addColorStop(1, 'rgba(6,4,12,.98)')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
      const fs = fit(w - h * 1.0, h * 0.56)
      const nx = h * 0.5
      g.textBaseline = 'middle'
      g.lineJoin = 'round'
      g.shadowColor = ink
      g.shadowBlur = h * 0.12
      g.strokeStyle = ink
      g.lineWidth = Math.max(3, h * 0.1)
      g.strokeText(s.name, nx, h * 0.52)
      g.shadowBlur = 0
      g.strokeStyle = '#ffffff'
      g.lineWidth = Math.max(1.5, h * 0.035)
      g.strokeText(s.name, nx, h * 0.52)
      g.fillStyle = ink
      g.fillRect(nx, h * 0.84, w - nx - h * 0.5, Math.max(2, h * 0.04))
    } else if (style === 'sleeve') {
      // 喷绘招牌套：大色块 + 斜白带，最便宜的那种街边店招
      base(lit(s.color, 0.1))
      g.fillStyle = dark ? shade(s.color, 1.7) : shade(s.color, 0.5)
      g.fillRect(0, 0, w, h)
      g.globalAlpha = 0.9
      g.fillStyle = lit(s.color, 0.75)
      g.beginPath()
      g.moveTo(w * 0.58, 0)
      g.lineTo(w * 0.74, 0)
      g.lineTo(w * 0.52, h)
      g.lineTo(w * 0.36, h)
      g.closePath()
      g.fill()
      g.globalAlpha = 1
      const fs = fit(w * 0.5, h * 0.54)
      g.textBaseline = 'middle'
      nameAt(h * 0.55, h * 0.52, dark ? white : ink)
      g.textAlign = 'right'
      g.font = `700 ${Math.round(h * 0.26)}px ${CN_FONT}`
      g.globalAlpha = 0.8
      g.fillStyle = dark ? white : ink
      g.fillText('欢迎光临', w - h * 0.3, h * 0.54)
      g.globalAlpha = 1
      g.textAlign = 'left'
    } else if (style === 'vi') {
      // VI 招牌：纯品牌色 + 左侧白色方圆 logo 里放一个字
      base(s.color)
      const sq = h * 0.64
      g.fillStyle = '#fffdf6'
      g.fillRect(h * 0.3, (h - sq) / 2, sq, sq)
      g.fillStyle = s.color
      g.font = `900 ${Math.round(sq * 0.7)}px ${CN_FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText([...s.name][0], h * 0.3 + sq / 2, h * 0.52)
      g.textAlign = 'left'
      const fs = fit(w - h * 1.5, h * 0.5)
      nameAt(h * 1.15, h * 0.52, dark ? white : ink)
    } else if (style === 'scene') {
      // 场景照片招牌：纵向渐变 + 几点灯光，像一张夜里拍的实景
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, shade(s.color, 1.9))
      gr.addColorStop(0.55, s.color)
      gr.addColorStop(1, shade(s.color, 0.5))
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 26; i++) {
        const px = ((i * 137) % 1000) / 1000 * w
        const py = ((i * 71) % 1000) / 1000 * h
        g.fillStyle = `rgba(255,236,190,${0.1 + ((i * 37) % 10) / 26})`
        g.fillRect(px, py, h * 0.03, h * 0.03)
      }
      const fs = fit(w - h * 0.9, h * 0.54)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.shadowColor = 'rgba(0,0,0,.6)'
      g.shadowBlur = h * 0.18
      g.fillStyle = white
      g.fillText(s.name, w / 2, h * 0.52)
      g.shadowBlur = 0
      g.textAlign = 'left'
    } else {
      // chalk 黑板：深绿底 + 粉笔白框 + 粉笔字
      base('#20291f')
      g.globalAlpha = 0.5
      g.fillStyle = '#cfd8c2'
      for (let i = 0; i < 6; i++) g.fillRect((w / 6) * i + w * 0.04, 0, w * 0.06, h)
      g.globalAlpha = 1
      g.strokeStyle = '#c9c2ac'
      g.lineWidth = Math.max(2, h * 0.05)
      g.strokeRect(h * 0.16, h * 0.16, w - h * 0.32, h - h * 0.32)
      const fs = fit(w - h * 0.8, h * 0.48)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = '#eae4cf'
      g.fillText(s.name, w / 2, h * 0.5)
      g.textAlign = 'left'
    }
  }

  // 竖挂招牌：垂直于门面支出墙外，字一个一个竖着排（老城/步行街最多）
  const drawVerticalSign = (g, w, h, s, style) => {
    const dark = lum(s.color) < 0.34
    if (style === 'neon' || style === 'led') {
      g.fillStyle = '#0d0b18'
      g.fillRect(0, 0, w, h)
    } else if (style === 'wood' || style === 'cloth') {
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, '#7a5230')
      gr.addColorStop(1, '#4c3018')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
    } else {
      g.fillStyle = s.color
      g.fillRect(0, 0, w, h)
    }
    g.strokeStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)'
    g.lineWidth = Math.max(2, w * 0.06)
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth)
    const chars = [...s.name]
    const fs = Math.min(w * 0.68, (h * 0.82) / chars.length)
    g.font = `900 ${Math.round(fs)}px ${CN_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const glow = style === 'neon' || style === 'led'
    g.fillStyle = dark ? '#fffdf6' : s.ink
    if (glow) {
      g.shadowColor = s.ink
      g.shadowBlur = w * 0.3
    }
    const step = Math.min(fs * 1.12, (h * 0.84) / chars.length)
    const y0 = h / 2 - ((chars.length - 1) * step) / 2
    chars.forEach((ch, i) => g.fillText(ch, w / 2, y0 + i * step))
    g.shadowBlur = 0
  }

  const signMeshes = []
  /**
   * 屋顶招牌：低层砖楼顶上一块板 + 三面立体字。参考图里「LISA」「HOTEL」那种，
   * 是夜里最能读出「这是老派砖楼」的元素。同组楼只做一块。
   */
  const ROOF_WORDS = ['HOTEL', '社', '茶', '旅社', 'APART', 'LOFT', '商行', 'BAR', 'LOAN', 'HOTEL', '书店', '药房']
  // 按字缓存：同一块招牌字只做一张贴图 / 一份材质，几十块招牌不产生几十份纹理
  const ROOF_TEX = new Map()
  const roofSignTex = (word) =>
    ROOF_TEX.get(word) ||
    ROOF_TEX.set(
      word,
      cvTex(512, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h)
      g.font = `900 ${Math.round(h * 0.66)}px ${CN_FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = '#0e0f14'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#fff4d6'
      g.shadowColor = '#ffd27a'
      g.shadowBlur = h * 0.18
      g.fillText(word, w / 2, h / 2 + h * 0.03)
      g.shadowBlur = 0
      g.strokeStyle = 'rgba(255,220,150,.45)'
      g.lineWidth = 4
      g.strokeRect(2, 2, w - 4, h - 4)
      })
    ).get(word)
  const ROOF_MAT = new Map()
  const roofMat = (word) => {
    let m = ROOF_MAT.get(word)
    if (!m) {
      m = new THREE.MeshBasicMaterial({ map: roofSignTex(word), toneMapped: false, color: new THREE.Color(1.45, 1.4, 1.25) })
      ROOF_MAT.set(word, m)
    }
    return m
  }
  const roofSign = (b, bot) => {
    if (b.h < 12 || b.h > 46 || b.w < 10) return
    const rr = P.mulberry32(Math.floor(Math.abs(b.x * 19 + b.z * 23)) + 5)
    if (rr() > 0.22) return
    const word = ROOF_WORDS[Math.floor(rr() * ROOF_WORDS.length)]
    const top = bot + b.h + 1.1
    const sw = Math.min(b.w - 2, 3.2 * [...word].length + 2)
    const sh = Math.min(4.4, sw * 0.26)
    const along = Math.abs(b.w - b.d) < 1 ? rr() < 0.5 : b.w > b.d
    const ry = along ? 0 : Math.PI / 2
    const w2 = along ? sw : 0.24
    const d2 = along ? 0.24 : sw
    for (const s of [-1, 1]) {
      solid.box(w2 * 0.1, sh * 0.9, d2 * 0.9, '#2a2c33', b.x + (along ? 0 : s * sw * 0.42), top + sh / 2, b.z + (along ? s * sw * 0.42 : 0), 0)
    }
    solid.box(along ? sw + 0.4 : 0.2, 0.22, along ? 0.2 : sw + 0.4, '#3a3c44', b.x, top + sh + 0.11, b.z, 0)
    const geo = new THREE.PlaneGeometry(sw, sh)
    const mat = roofMat(word)
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(b.x + (along ? 0 : s * 0.14), top + sh / 2, b.z + (along ? s * 0.14 : 0))
      m.rotation.y = along ? (s > 0 ? 0 : Math.PI) : s > 0 ? Math.PI / 2 : -Math.PI / 2
      scene.add(m)
      signMeshes.push(m)
    }
    haloExtra.push([b.x, top + sh * 0.5, b.z, '#ffd9a0'])
  }

  // 楼全部建完、招牌贴图 / 材质 / 合批 builder 都就绪之后，再生成屋顶招牌
  for (const [jb, jbot] of ROOF_JOBS) roofSign(jb, jbot)

  // 真房间 + 玻璃反光面每家都是独立 draw call：只给离出生点最近的一批 A 级店，其余用合批的背光块
  const RICH = new Set(
    P.shops
      .filter((s) => s.tier === 'A' && s.open)
      .sort((a, b) => Math.hypot(a.x + 14, a.z - 30) - Math.hypot(b.x + 14, b.z - 30))
      .slice(0, 340)
  )
  // 其余的店：店内贴图 / 玻璃反光走 InstancedMesh，招牌画进图集 —— 全城几次 draw call，精致度不打折
  const cheapRooms = []
  const panes = []
  const ATLAS = 2048
  const SLOT = 384
  const atlases = []
  const newAtlas = () => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = ATLAS
    const a = { cv, g: cv.getContext('2d'), x: 0, y: 0, rowH: 0, pos: [], uv: [], col: [], idx: [] }
    atlases.push(a)
    return a
  }
  const atlasSign = (s, style, cx, cy, cz, rot, w, h, lit) => {
    let a = atlases[atlases.length - 1] || newAtlas()
    const ph = Math.max(28, Math.round((SLOT * h) / w))
    if (a.x + SLOT > ATLAS) {
      a.x = 0
      a.y += a.rowH + 2
      a.rowH = 0
    }
    if (a.y + ph > ATLAS) a = newAtlas()
    const x0 = a.x
    const y0 = a.y
    a.g.save()
    a.g.translate(x0, y0)
    a.g.beginPath()
    a.g.rect(0, 0, SLOT, ph)
    a.g.clip()
    drawSign(a.g, SLOT, ph, s, style)
    a.g.restore()
    a.x += SLOT + 2
    a.rowH = Math.max(a.rowH, ph)
    const rx = Math.cos(rot)
    const rz = -Math.sin(rot)
    const base = a.pos.length / 3
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      a.pos.push(cx + (rx * sx * w) / 2, cy + (sy * h) / 2, cz + (rz * sx * w) / 2)
      a.uv.push((x0 + (sx > 0 ? SLOT : 0)) / ATLAS, 1 - (y0 + (sy > 0 ? 0 : ph)) / ATLAS)
      a.col.push(lit, lit * 0.99, lit * 0.96)
    }
    a.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  for (let __qi = 0; __qi < P.shops.length; __qi++) {
    const s = P.shops[__qi]
    if (__qi % 220 === 219) await step('装配店面', 66 + Math.round((__qi / P.shops.length) * 5))
    if (s.tier === 'C') continue
    const rich = RICH.has(s)
    const faceRot = s.face === 's' ? 0 : s.face === 'n' ? Math.PI : s.face === 'e' ? Math.PI / 2 : -Math.PI / 2
    const nx = s.face === 's' ? 0 : s.face === 'n' ? 0 : s.face === 'e' ? 1 : -1
    const nz = s.face === 's' ? 1 : s.face === 'n' ? -1 : 0
    const fy = P.groundY(s.x, s.z)
    const ux = nz
    const uz = -nx
    const at = (a, o) => [s.x + ux * a + nx * o, s.z + uz * a + nz * o]
    const fbox = (Mb, a, o, yc, wa, hb, dep, col) => {
      const [px, pz] = at(a, o)
      Mb.box(nx === 0 ? wa : dep, hb, nx === 0 ? dep : wa, col, px, yc, pz, 0)
    }
    const facePlane = (mat, o, w, hgt, yc, order) => {
      const [px, pz] = at(0, o)
      const m = new THREE.Mesh(UNIT, mat)
      m.scale.set(w, hgt, 1)
      m.position.set(px, yc, pz)
      m.rotation.y = s.face === 's' ? 0 : s.face === 'n' ? Math.PI : s.face === 'e' ? Math.PI / 2 : -Math.PI / 2
      if (order) m.renderOrder = order
      m.frustumCulled = false
      scene.add(m)
      return m
    }

    const gw = s.w - 0.08
    const iw = gw
    const rr = P.mulberry32(Math.floor(Math.abs(s.x) * 71 + Math.abs(s.z) * 37 + s.w * 13))
    const dim = !s.open
    const FRAMES = ['#23262c', '#2a2f36', '#8f969e', '#5a4636', '#c8ccd0']
    const TILES = ['#3a3f46', '#5a3a32', '#2f4a44', '#4a4038', '#6a6058', '#2e3a52']
    const CLADS = ['#d9c7b0', '#cfd3d6', '#b8a48a', '#8a8f96', '#e6dcc8', '#6e5a48']
    const frameC = FRAMES[Math.floor(rr() * FRAMES.length)]
    const tileC = TILES[Math.floor(rr() * TILES.length)]
    const cladC = CLADS[Math.floor(rr() * CLADS.length)]
    // ---- 1. 店内：近处的店是 3.4m 真房间，其余店是贴在玻璃后的浅货架（不伸进楼体）
    if (!dim && rich) {
      const [bx0, bz0] = at(0, 0.12 - DEP)
      buildShopInterior({ kind: s.kind, x: bx0, z: bz0, nx, nz, fy, sw: s.w - 0.2, D: DEP, rr, ink: s.ink, h: 2.58 })
      // 后墙品牌形象墙：一条品牌色 + 中间一块 logo 牌
      fbox(inner, 0, 0.18 - DEP, fy + GY0 + GH - 0.42, gw * 0.7, 0.46, 0.04, s.color)
      fbox(innerHot, 0, 0.22 - DEP, fy + GY0 + GH - 0.42, 0.5, 0.3, 0.03, s.ink)
    } else if (!dim) {
      // 浅房间贴在玻璃后 1m 内，不伸进楼体被墙吃掉；后墙是亮的，货架直接看得见
      const ID = 0.95
      fbox(inner, 0, -ID, fy + GY0 + GH / 2, gw, GH, 0.08, '#f4ead8')
      for (const t of [-1, 1]) fbox(inner, t * gw * 0.48, -ID / 2, fy + GY0 + GH / 2, 0.06, GH, ID, '#e6d4b8')
      fbox(inner, 0, -ID / 2, fy + GY0 + 0.04, gw * 0.94, 0.06, ID, '#cbb89a')
      fbox(innerHot, 0, -0.32, fy + GY0 + GH - 0.1, gw * 0.8, 0.05, 0.14, '#fffaf2')
      for (let row = 0; row < 2; row++) {
        const hy = fy + GY0 + 0.78 + row * 0.72
        fbox(inner, 0, -ID + 0.16, hy, gw * 0.78, 0.05, 0.26, '#a88868')
        const n = Math.max(3, Math.min(6, Math.round(gw / 0.85)))
        for (let k = 0; k < n; k++) {
          const a = -gw * 0.32 + (k * gw * 0.64) / Math.max(1, n - 1)
          fbox(innerHot, a, -ID + 0.18, hy + 0.16, 0.18, 0.2 + (k % 3) * 0.07, 0.12, [s.color, s.ink, '#f2c45a', '#7fb8d8', '#e88a7a', '#fff6e8'][k % 6])
        }
      }
    }

    // ---- 2. 玻璃 + 深色框架（在洞口外沿）
    if (!dim && rich) facePlane(paneMat, 0.16, gw, GH, fy + GY0 + GH / 2, 3)
    else if (!dim) {
      const [qx, qz] = at(0, 0.16)
      panes.push({ x: qx, z: qz, y: fy + GY0 + GH / 2, w: gw, h: GH, rot: faceRot })
    }
    else fbox(glass, 0, 0.15, fy + GY0 + GH / 2, iw, GH, 0.02, '#242a33')

    // 下槛石 + 上卷帘盒
    fbox(shopB, 0, 0.14, fy + GY0 - 0.15, s.w - 0.1, 0.3, 0.34, tileC)
    fbox(shopB, 0, 0.32, fy + GY0 - 0.01, s.w - 0.1, 0.04, 0.05, shade(tileC, 1.5))
    for (let k = 1; k < Math.round(s.w / 0.6); k++) fbox(shopB, -s.w / 2 + k * 0.6, 0.31, fy + GY0 - 0.15, 0.02, 0.28, 0.02, shade(tileC, 0.7))
    fbox(shopB, 0, 0.15, fy + GY0 + GH + 0.06, s.w - 0.06, 0.16, 0.26, '#3a3730')
    // 竖梃：4~6 道，宽度统一，玻璃才被「切」成一间间
    const bays = Math.max(2, Math.round(gw / 1.25))
    for (let i = 0; i <= bays; i++) {
      const a = -gw / 2 + (i * gw) / bays
      fbox(shopB, a, 0.16, fy + GY0 + GH / 2, 0.06, GH, 0.12, frameC)
    }
    fbox(shopB, 0, 0.16, fy + GY0 + GH - 0.04, gw, 0.07, 0.12, frameC)
    // 气窗横档：玻璃上部再切一道，橱窗有了「上亮子」
    fbox(shopB, 0, 0.17, fy + GY0 + GH - 0.5, gw, 0.05, 0.1, frameC)
    // 推拉门：挑一格做成带框的玻璃门（门框 + 把手 + 门槛），整排才不会都是橱窗
    if (!dim) {
      const db = rr() < 0.5 ? 0 : bays - 1
      const dA = -gw / 2 + (db + 0.5) * (gw / bays)
      const dW = gw / bays - 0.14
      fbox(shopB, dA, 0.19, fy + GY0 + 1.02, dW, 2.04, 0.05, frameC)
      fbox(glass, dA, 0.21, fy + GY0 + 1.0, dW - 0.14, 1.88, 0.02, '#cfe6f5')
      fbox(shopB, dA + dW / 2 - 0.13, 0.27, fy + GY0 + 1.02, 0.035, 0.54, 0.09, '#9aa0a8')
      fbox(shopB, dA, 0.2, fy + GY0 + 0.03, dW, 0.07, 0.2, '#8a8f96')
      // 门楣小灯：门头那一点暖光
      fbox(glow, dA, 0.12, fy + GY0 + 2.1, dW * 0.7, 0.04, 0.05, '#ffe2b8')
      // 玻璃上的贴纸：营业时间 + 支付码 + 门把下的「推 / 拉」
      fbox(glow, dA - dW * 0.2, 0.23, fy + GY0 + 1.5, 0.22, 0.3, 0.01, '#f4efe2')
      fbox(shopB, dA - dW * 0.2, 0.235, fy + GY0 + 1.56, 0.16, 0.03, 0.01, '#3a3f46')
      fbox(glow, dA + dW * 0.18, 0.23, fy + GY0 + 1.42, 0.16, 0.16, 0.01, rr() < 0.5 ? '#2fae6a' : '#2a8fe0')
      // 「营业中」小灯牌挂在橱窗一角
      const oa = (db === 0 ? 1 : -1) * (gw / 2 - 0.5)
      fbox(shopB, oa, 0.0, fy + GY0 + GH - 0.75, 0.62, 0.22, 0.04, '#1e2026')
      fbox(glow, oa, 0.03, fy + GY0 + GH - 0.75, 0.52, 0.13, 0.02, rr() < 0.5 ? '#ff5a4a' : '#ffb84a')
      // 橱窗里的陈列台：矮台 + 商品 + 价签
      const da = (db === 0 ? 1 : -1) * gw * 0.22
      const dw = Math.min(1.8, gw * 0.32)
      fbox(inner, da, -0.28, fy + GY0 + 0.28, dw, 0.52, 0.4, shade(cladC, 0.88))
      fbox(inner, da, -0.28, fy + GY0 + 0.56, dw * 0.96, 0.04, 0.36, '#efe6d4')
      for (let k = 0; k < 4; k++) {
        const gx = da + (k - 1.5) * (dw / 4.4)
        fbox(innerHot, gx, -0.28, fy + GY0 + 0.72, 0.16, 0.16 + rr() * 0.28, 0.14, [s.color, s.ink, '#f2c45a', '#7fb8d8', '#e88a7a', '#fff6e8'][Math.floor(rr() * 6)])
        fbox(glow, gx, -0.08, fy + GY0 + 0.62, 0.1, 0.06, 0.01, '#fff8ee')
      }
      // 玻璃腰线：不发光，别挡住店内
      fbox(shopB, 0, 0.22, fy + GY0 + 0.42, gw * 0.92, 0.045, 0.012, shade(s.color, 0.7))
    }
    // 门头精修：灯箱底槽 + 两侧壁灯 + 门牌号
    if (!dim) {
      fbox(shopB, 0, 0.2, fy + GY0 + GH + 0.22, s.w - 0.2, 0.08, 0.22, '#1c1e24')
      for (const t of [-1, 1]) {
        const la = t * (s.w / 2 - 0.28)
        fbox(shopB, la, 0.38, fy + GY0 + GH - 0.15, 0.08, 0.22, 0.16, '#2a2c32')
        fbox(glow, la, 0.46, fy + GY0 + GH - 0.28, 0.1, 0.08, 0.08, '#ffe6c0')
      }
      const numA = -(s.w / 2 + 0.12)
      fbox(shopB, numA, 0.54, fy + 1.35, 0.22, 0.28, 0.03, '#f4efe6')
      fbox(shopB, numA, 0.56, fy + 1.35, 0.14, 0.04, 0.01, '#2a3038')
    }
    // 两侧壁柱（现在兼作洞口之间的墩子）
    for (const t of [-1, 1]) {
      fbox(shopB, t * (s.w / 2 + 0.12), 0.26, fy + 1.75, 0.44, 3.5, 0.52, cladC)
      // 壁柱上的分缝 + 门牌
      for (let k = 1; k < 4; k++) fbox(shopB, t * (s.w / 2 + 0.12), 0.53, fy + k * 0.86, 0.46, 0.025, 0.02, shade(cladC, 0.78))
    }
    {
      const [hx, hz] = at(-(s.w / 2 + 0.12), 0.54)
      shopB.box(nx === 0 ? 0.26 : 0.03, 0.16, nx === 0 ? 0.03 : 0.26, '#2a4a8a', hx, fy + 2.2, hz, 0)
    }

    // ---- 3. 雨棚：薄薄一片 + 前沿白条，压在玻璃顶上、檐板之下
    // 雨棚：薄薄一片压在洞口上沿，往前挑出六十公分
    const aw = Math.min(s.w + 0.04, 6.4)
    const ay = fy + GY0 + GH + 0.04
    const adp = 0.66
    const cloth = !dim && ['noodle', 'hotpot', 'bbq', 'restaurant', 'breakfast', 'tea', 'fastfood', 'deli', 'bakery', 'coffee', 'fruit', 'flower'].includes(s.kind)
    if (cloth) {
      const n = Math.max(4, Math.round(aw / 0.42))
      const sw2 = aw / n
      for (let k = 0; k < n; k++) {
        const col = k % 2 ? '#f4efe2' : s.color
        const a2 = -aw / 2 + (k + 0.5) * sw2
        fbox(shopB, a2, 0.4, ay + 0.05, sw2 + 0.005, 0.07, 0.95, col)
        fbox(shopB, a2, 0.88, ay - 0.12, sw2 + 0.005, k % 2 ? 0.26 : 0.34, 0.03, col)
      }
    } else {
      fbox(shopB, 0, 0.26, ay, aw, 0.09, adp, dim ? '#4a4c52' : s.color)
      fbox(shopB, 0, 0.26 + adp / 2 - 0.02, ay - 0.06, aw, 0.16, 0.05, '#f4efe2')
    }
    for (const t of [-1, 1]) {
      fbox(shopB, t * (aw / 2 - 0.16), 0.26 + adp / 2 - 0.05, ay - 0.4, 0.05, 0.72, 0.05, '#7c7264')
    }
    if (!dim) {
      // 棚下灯管 + 两盏筒灯
      fbox(glow, 0, 0.26 + adp / 2 - 0.09, ay - 0.11, aw * 0.94, 0.04, 0.05, '#ffe6c4')
      for (const t of [-1, 1]) fbox(glow, t * aw * 0.28, 0.42, ay - 0.16, 0.16, 0.05, 0.16, '#fff4dc')
    }
    // 餐饮菜单板：门侧一块深色框 + 暖底
    if (!dim && cloth && s.w > 3.4) {
      const ma = (rr() < 0.5 ? -1 : 1) * (s.w / 2 - 0.42)
      fbox(shopB, ma, 0.22, fy + GY0 + 1.35, 0.08, 1.15, 0.62, '#1e2228')
      fbox(glow, ma, 0.26, fy + GY0 + 1.38, 0.04, 0.96, 0.48, '#f6ead0')
      for (let k = 0; k < 4; k++) fbox(shopB, ma, 0.3, fy + GY0 + 1.05 + k * 0.2, 0.02, 0.03, 0.36, '#6a5a48')
    }

    // ---- 4. 檐板（品牌灯箱）：A 级写店名，B 级只有色带 + 两条白线
    // 每条街的店都该有名字：A 级是完整灯箱，B 级只是更小的字
    if (s.open && !rich) {
      const style = s.signStyle || 'lightbox'
      const [sx2, sz2] = at(0, 0.34)
      atlasSign(s, style, sx2, fy + FY0 + FH / 2, sz2, faceRot, s.w - 0.1, FH, signLit(s, style))
    } else if (s.open) {
      const style = s.signStyle || 'lightbox'
      const tw2 = 640
      const tex = cvTex(tw2, Math.max(64, Math.round((tw2 * FH) / Math.max(2, s.w - 0.2))), (g, w, h) => drawSign(g, w, h, s, style))
      const lit2 = signLit(s, style)
      const m = facePlane(
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(lit2, lit2 * 0.99, lit2 * 0.96) }),
        0.34,
        s.w - 0.1,
        FH,
        fy + FY0 + FH / 2,
        0
      )
      signMeshes.push(m)
    } else {
      // 关门的店：招牌熄了，只剩一块底色板
      fbox(shopB, 0, 0.3, fy + FY0 + FH / 2, s.w - 0.1, FH, 0.18, '#2d3038')
      fbox(shopB, 0, 0.36, fy + FY0 + FH / 2, s.w - 0.3, 0.06, 0.05, shade(s.color, 0.55))
    }
    // ---- 4b. 竖挂招牌：垂直于门面支出墙外，字一个一个竖着排
    // 门头已经有一块檐板招牌，竖挂牌只留给老城里少数几家，不然一家店两块牌子
    if (!dim && s.vertical && hash(Math.round(s.x), Math.round(s.z), 9) < 0.35) {
      const vstyle = s.signStyle || 'lightbox'
      const vw = 0.8
      const vh = Math.min(2.6, 0.34 * [...s.name].length + 0.9)
      const sideV = rr() < 0.5 ? -1 : 1
      const [vx2, vz2] = at(sideV * (s.w / 2 - 0.46), 0.98)
      const svy = fy + 3.05
      shopB.box(nx === 0 ? 0.86 : 0.06, 0.06, nx === 0 ? 0.06 : 0.86, '#5a5248', vx2 - nx * 0.36, svy + vh / 2 + 0.12, vz2 - nz * 0.36, 0)
      shopB.box(nx === 0 ? vw + 0.12 : 0.16, vh + 0.12, nx === 0 ? 0.16 : vw + 0.12, '#2b2622', vx2, svy, vz2, 0)
      const vtex = cvTex(128, 384, (g, w, h) => drawVerticalSign(g, w, h, s, vstyle))
      const vmat = new THREE.MeshBasicMaterial({
        map: vtex,
        toneMapped: false,
        color: new THREE.Color(1.2, 1.18, 1.14),
        side: THREE.DoubleSide,
      })
      for (const sd of [-1, 1]) {
        const vm = new THREE.Mesh(UNIT, vmat)
        vm.scale.set(vw, vh, 1)
        vm.position.set(vx2 + (nx === 0 ? 0 : sd * 0.085), svy, vz2 + (nx === 0 ? sd * 0.085 : 0))
        vm.rotation.y = nx === 0 ? (sd > 0 ? 0 : Math.PI) : sd > 0 ? Math.PI / 2 : -Math.PI / 2
        scene.add(vm)
        signMeshes.push(vm)
      }
    }

    // 檐板外框
    fbox(shopB, 0, 0.26, fy + FY0 + FH + 0.06, s.w + 0.06, 0.12, 0.42, '#3a3730')
    fbox(shopB, 0, 0.26, fy + FY0 - 0.06, s.w + 0.06, 0.12, 0.42, '#3a3730')
    // 檐板上方的墙面：一条浅色抹灰带 + 一道阴影线，店面和楼上不再「断开」
    fbox(shopB, 0, 0.1, fy + FY0 + FH + 0.3, s.w + 0.1, 0.42, 0.14, '#cfc6b6')
    fbox(shopB, 0, 0.1, fy + FY0 + FH + 0.54, s.w + 0.16, 0.1, 0.2, '#9d9587')

    // 招牌上沿的灯带：从上方洗下来，招牌在夜里真的「亮着」
    if (!dim) {
      const nL = s.w > 5 ? 3 : 2
      for (let k = 0; k < nL; k++) {
        const la = (k - (nL - 1) / 2) * (s.w / nL)
        fbox(shopB, la, 0.42, fy + FY0 + FH + 0.2, 0.04, 0.04, 0.5, '#2a2c30')
        fbox(shopB, la, 0.66, fy + FY0 + FH + 0.12, 0.14, 0.12, 0.16, '#2a2c30')
        fbox(glow, la, 0.66, fy + FY0 + FH + 0.05, 0.1, 0.02, 0.1, '#fff2d6')
      }
    }

    if (dim) {
      // 关门的卷帘：竖向肋条 + 一张告示
      for (let i = 0; i < 7; i++) {
        fbox(shopB, -gw / 2 + 0.14 + (i * (gw - 0.28)) / 6, 0.16, fy + GY0 + GH / 2, 0.09, GH, 0.06, '#565c66')
      }
      fbox(shopB, 0, 0.2, fy + GY0 + 1.5, 0.4, 0.5, 0.03, '#ddd6c4')
    }

    // ---- 6. 门口地面：门槛 + 地垫 + 一块暖光地池
    fbox(shopB, 0, 0.16, fy + 0.12, s.w - 0.1, 0.14, 0.18, '#8d8375')
    fbox(shopB, 0, 0.85, fy + 0.06, Math.min(s.w - 1.2, 2.6), 0.04, 0.9, '#3b3a38')
    // 店内灯光洒到人行道上：一条暖色光池，夜里整条街才有烟火气
    if (!dim) {
      const night = ['ktv', 'netbar', 'escape', 'billiard', 'gym', 'spa', 'bank'].includes(s.kind)
      // 光池纵深 4.6，中心离墙 2.4：从墙外开始铺，不伸进店里和玻璃底边、门槛打架
      const [lx, lz] = at(0, 2.4)
      lightPools.push({ x: lx, z: lz, w: Math.min(s.w + 1.6, 7.2), d: 4.6, y: fy + 0.19, c: night ? '#5a3a98' : '#ff9a40', a: night ? 0.48 : 0.62 })
    }

    // ---- 6b. 会动的小东西：餐饮门口挂红灯笼、门前立布旗、偶尔一只猫
    if (!dim) {
      const food = ['noodle', 'hotpot', 'bbq', 'restaurant', 'breakfast', 'tea', 'rest', 'fastfood', 'deli', 'bakery', 'coffee'].includes(s.kind)
      const rot = s.face === 's' ? 0 : s.face === 'n' ? Math.PI : s.face === 'e' ? Math.PI / 2 : -Math.PI / 2
      if (food || rr() < 0.18) {
        const lc = s.kind === 'tea' || s.kind === 'coffee' || s.kind === 'bakery' ? '#ffc56b' : '#ff5a3c'
        for (const t of [-1, 1]) {
          const [lx2, lz2] = at(t * Math.min(s.w / 2 - 0.5, 2.2), 0.8)
          swing.lanterns.push({ x: lx2, y: ay - 0.08, z: lz2, c: lc, ph: rr() * 6 })
          haloExtra.push([lx2, ay - 0.45, lz2, lc])
        }
        const [px4, pz4] = at(0, 1.4)
        lightPools.push({ x: px4, z: pz4, w: Math.min(s.w, 5), d: 2.6, y: fy + 0.2, c: lc === '#ff5a3c' ? '#c8503a' : '#c89a50' })
      }
      if (s.tier === 'A' && rr() < 0.45) {
        const t = rr() < 0.5 ? -1 : 1
        const fc = rr() < 0.5 ? s.color : ['#e0322f', '#f2b134', '#2a9df4', '#3fae6a', '#ff7ab4'][Math.floor(rr() * 5)]
        for (let k = 0; k < 2; k++) {
          const [fx, fz] = at(t * (s.w / 2 + 0.3 + k * 0.6), 1.25)
          const gy4 = P.groundY(fx, fz)
          shopB.cyl(0.03, 2.3, '#d8dbe6', fx, gy4 + 0.2, fz, 5)
          swing.flags.push({ x: fx, y: gy4 + 2.45, z: fz, rot, c: k ? fc : '#ffd166', ph: rr() * 6 })
        }
      }
      if (rr() < 0.08) {
        const [cx3, cz3] = at((rr() - 0.5) * (s.w - 1), 0.75)
        swing.cats.push({ x: cx3, y: P.groundY(cx3, cz3) + 0.22, z: cz3, ry: rot + (rr() - 0.5) * 1.5, c: ['#2b2738', '#e8a25a', '#f2ede4', '#8a7a6a'][Math.floor(rr() * 4)], ph: rr() * 6 })
      }
    }

    if (!dim) {
      // ---- 7. 门口：售货机 / 伞桶 / 绿植 / A 字牌（B 级也有，只是概率低一档）
      const side = rr() < 0.5 ? -1 : 1
      const aTier = s.tier === 'A'
      // 门口两块铺装，和人行道灰区分开
      fbox(shopB, 0, 0.55, fy + 0.08, Math.min(s.w - 0.4, 3.2), 0.03, 1.15, '#c8c0b4')
      fbox(shopB, 0, 0.55, fy + 0.1, Math.min(s.w - 0.8, 2.4), 0.02, 0.7, shade(s.color, 0.55))
      if (s.w > 4.0 && rr() < (aTier ? 0.55 : 0.22)) {
        const va = side * (s.w / 2 - 0.75)
        const [vx, vz] = at(va, 0.62)
        const vy = P.groundY(vx, vz)
        const vc = ['#d8344a', '#2f7fd0', '#e8a52c', '#eeeae0', '#3fae6a'][Math.floor(rr() * 5)]
        shopB.box(nx === 0 ? 1.0 : 0.76, 1.9, nx === 0 ? 0.76 : 1.0, vc, vx, vy + 0.98, vz, 0)
        shopB.box(nx === 0 ? 1.08 : 0.82, 0.1, nx === 0 ? 0.82 : 1.08, '#3c3c3a', vx, vy + 1.98, vz, 0)
        const pw = new THREE.Mesh(UNIT, vendMat)
        pw.scale.set(0.82, 1.02, 1)
        pw.position.set(vx + nx * 0.44, vy + 1.3, vz + nz * 0.44)
        pw.rotation.y = s.face === 's' ? 0 : s.face === 'n' ? Math.PI : s.face === 'e' ? Math.PI / 2 : -Math.PI / 2
        scene.add(pw)
        shopB.box(nx === 0 ? 0.56 : 0.08, 0.18, nx === 0 ? 0.08 : 0.56, '#23262a', vx + nx * 0.4, vy + 0.44, vz + nz * 0.4, 0)
        bright.box(nx === 0 ? 0.84 : 0.07, 0.06, nx === 0 ? 0.07 : 0.84, '#eef8ff', vx + nx * 0.4, vy + 1.9, vz + nz * 0.4, 0)
      }
      if (rr() < (aTier ? 0.55 : 0.28)) {
        const [sx2, sz2] = at(-side * (s.w / 2 - 0.32), 0.52)
        const sy2 = P.groundY(sx2, sz2)
        shopB.cyl(0.25, 0.7, '#5d6b60', sx2, sy2 + 0.04, sz2, 8)
        for (let i = 0; i < 3; i++) {
          const a2 = (i / 3) * Math.PI * 2 + 0.5
          shopB.box(0.05, 0.92, 0.05, i % 2 ? '#8a4a4a' : '#3f4a58', sx2 + Math.cos(a2) * 0.1, sy2 + 0.82, sz2 + Math.sin(a2) * 0.1, 0.25)
        }
      }
      // 门口绿植：陶盆 + 两颗球，餐饮/奶茶门口常见
      if (rr() < (aTier ? 0.7 : 0.4) && s.w > 3.2) {
        const [gx, gz] = at(-side * (s.w / 2 - 0.55), 0.7)
        const gy3 = P.groundY(gx, gz)
        shopB.cyl(0.26, 0.5, '#9a6b4a', gx, gy3 + 0.26, gz, 8, { rt: 0.2 })
        shopB.cyl(0.22, 0.04, '#5a4632', gx, gy3 + 0.52, gz, 8)
        shopB.sphere(0.34, '#4e7a52', gx, gy3 + 0.86, gz, 7, 5)
        shopB.sphere(0.24, '#5c8a5e', gx + 0.16, gy3 + 1.12, gz - 0.1, 6, 4)
      }
      // A 字牌
      if (rr() < (aTier ? 0.55 : 0.25)) {
        const [ax2, az2] = at(side * (s.w / 2 - 1.5), 1.05)
        const ay2 = P.groundY(ax2, az2) + 0.1
        const arot = Math.atan2(nx, nz) + 0.2
        shopB.box(0.82, 1.05, 0.07, '#2f343a', ax2, ay2 + 0.62, az2, arot)
        bright.box(0.66, 0.3, 0.05, s.color, ax2 + nx * 0.05, ay2 + 0.8, az2 + nz * 0.05, arot)
        shopB.box(0.82, 0.07, 0.42, '#2a2f35', ax2, ay2 + 0.12, az2, arot)
      }
    }
  }

  {
    const m4 = new THREE.Matrix4()
    const q4 = new THREE.Quaternion()
    const e4 = new THREE.Euler()
    const v4 = new THREE.Vector3()
    const s4 = new THREE.Vector3()
    const instPlanes = (list, mat, order) => {
      if (!list.length) return
      const im = new THREE.InstancedMesh(UNIT, mat, list.length)
      const tc = new THREE.Color()
      list.forEach((p, i) => {
        m4.compose(v4.set(p.x, p.y, p.z), q4.setFromEuler(e4.set(0, p.rot, 0)), s4.set(p.w, p.h, 1))
        im.setMatrixAt(i, m4)
        if (p.tone) im.setColorAt(i, tc.setRGB(p.tone[0], p.tone[1], p.tone[2]))
      })
      im.frustumCulled = false
      if (order) im.renderOrder = order
      scene.add(im)
    }
    interiorMats.forEach((m, t) => {
      m.color.setScalar(1.15)
      instPlanes(cheapRooms.filter((r) => r.t === t), m)
    })
    instPlanes(panes, paneMat, 3)
    for (const a of atlases) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2))
      geo.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3))
      geo.setIndex(a.idx)
      const tex = new THREE.CanvasTexture(a.cv)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, toneMapped: false }))
      m.frustumCulled = false
      scene.add(m)
      signMeshes.push(m)
    }
  }

  await step('种树摆灯', 78)
  // ---------------------------------------------------------------- 街道设施
  const propMat = litMat({ roughness: 0.88 })
  const props = new MeshBuilder(OUT * 0.6)
  const glowProps = new MeshBuilder(0, LIT_SRC)

  // 中央绿化带的灌木（在路面上，晚于 propMat 才能合批）
  for (const [bx, bz] of medianBushes) {
    const gy = P.groundY(bx, bz)
    props.sphere(0.62, '#3c5a3c', bx, gy + 1.0, bz, 6, 3)
    props.sphere(0.42, '#47673f', bx + 0.35, gy + 1.38, bz, 5, 3)
  }

  // 行道树：店面前的树会直接挡住招牌（还会糊住整个店面），所以先挑掉
  const shopFronts = P.shops.map((sh) => {
    const nx = sh.face === 's' ? 0 : sh.face === 'n' ? 0 : sh.face === 'e' ? 1 : -1
    const nz = sh.face === 's' ? 1 : sh.face === 'n' ? -1 : 0
    return [sh.x + nx * 3.4, sh.z + nz * 3.4]
  })
  const nearShop = (x, z, d) => {
    for (const f of shopFronts) {
      if (Math.abs(x - f[0]) < d && Math.abs(z - f[1]) < d) return true
    }
    return false
  }
  // 建筑近旁也不种：树冠半径 2m，贴着墙就糊住一层楼的立面
  const nearBuilding = (x, z, d) => {
    for (const b of P.buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + d && Math.abs(z - b.z) < b.d / 2 + d) return true
    }
    return false
  }
  for (const t of P.TREES) {
    if (nearShop(t.x, t.z, 6.2)) continue
    if (nearBuilding(t.x, t.z, 2.6)) continue
    const y = P.groundY(t.x, t.z)
    // 四种树：阔叶（香樟）/ 塔形（水杉）/ 开花（樱花）/ 秋色（银杏）。颜色比之前亮两档，
    // 夜里压暗后仍读得出绿；树冠由 4~5 个错位小球拼成，有轮廓起伏，不再是一坨
    const s = t.s
    const tr = hash(Math.round(t.x * 3), Math.round(t.z * 3), 41)
    const tx = t.x
    const tz = t.z
    if (tr < 0.2) {
      props.cyl(0.16 * s, 1.6 * s, '#6a4a34', tx, y + 0.2, tz, 5)
      props.cone(1.7 * s, 3.2 * s, '#4f9a5a', tx, y + 1.4 * s, tz, 7)
      props.cone(1.3 * s, 2.8 * s, '#5eae66', tx, y + 3.2 * s, tz, 7)
      props.cone(0.85 * s, 2.4 * s, '#72c276', tx, y + 4.9 * s, tz, 6)
      continue
    }
    const pal =
      tr < 0.32 ? ['#e8a4b8', '#f2bccb', '#f8d4de'] : tr < 0.42 ? ['#d8a23a', '#e8b84a', '#f2cc66'] : tr < 0.7 ? ['#5c9e4c', '#6fb25a', '#86c46c'] : ['#4e9254', '#62a762', '#7cbd72']
    props.cyl(0.2 * s, 3.2 * s, '#6a4a34', tx, y + 0.2, tz, 5)
    props.sphere(1.6 * s, pal[0], tx, y + 4.5 * s, tz, 7, 4)
    props.sphere(1.25 * s, pal[1], tx + 0.95 * s, y + 4.9 * s, tz - 0.3 * s, 6, 4)
    props.sphere(1.2 * s, pal[1], tx - 0.85 * s, y + 4.8 * s, tz + 0.5 * s, 6, 4)
    props.sphere(1.05 * s, pal[2], tx + 0.2 * s, y + 5.9 * s, tz + 0.15 * s, 6, 3)
    props.sphere(0.8 * s, pal[2], tx - 0.4 * s, y + 5.4 * s, tz - 0.9 * s, 5, 3)
  }

  for (const l of P.LAMPS) {
    const y = P.groundY(l.x, l.z)
    // 灯柱正好立在店门口就挪到两店之间（否则招牌会被一根杆子劈开）
    if (nearShop(l.x, l.z, 2.4)) continue
    props.cyl(0.16, 8.2, '#9a9488', l.x, y + 0.2, l.z, 6)
    props.box(2.6, 0.18, 0.3, '#9a9488', l.x + Math.sin(l.rot) * 1.2, y + 8.2, l.z + Math.cos(l.rot) * 1.2, l.rot)
    glowProps.box(0.9, 0.22, 0.5, '#eaf3ff', l.x + Math.sin(l.rot) * 2.3, y + 8.05, l.z + Math.cos(l.rot) * 2.3, l.rot)
  }

  // 步行街的红灯笼：一串横过街面，是最便宜的「中国街」识别点
  for (let x = P.PEDESTRIAN.x0 + 10; x <= P.PEDESTRIAN.x1 - 6; x += 16) {
    const zc = P.PEDESTRIAN.z
    const gy = P.groundY(x, zc)
    for (const s of [-1, 1]) {
      const z = zc + s * (P.PEDESTRIAN.w / 2 - 1.4)
      props.cyl(0.11, 6.2, '#4a4038', x, gy + 0.2, z, 5)
    }
    props.box(0.1, 0.08, P.PEDESTRIAN.w - 2.6, '#3b342c', x, gy + 6.2, zc, 0)
    for (let k = -2; k <= 2; k++) {
      const z = zc + k * 2.0
      props.cyl(0.02, 0.5, '#2a2622', x, gy + 5.7, z, 4)
      props.sphere(0.42, '#c8342c', x, gy + 5.28, z, 8, 5)
      glowProps.sphere(0.3, '#ff7a52', x, gy + 5.28, z, 6, 4)
      props.cyl(0.1, 0.08, '#2a2622', x, gy + 4.86, z, 5)
    }
  }

  // 灯下光池：加法混合的告示贴图，不是实体光锥
  const poolCv = document.createElement('canvas')
  poolCv.width = 128
  poolCv.height = 128
  const pg = poolCv.getContext('2d')
  // 渐变要又长又软，边界再被噪声打碎：一坨完美圆形的高亮贴片最「生硬」
  const pimg = pg.createImageData(128, 128)
  for (let yy = 0; yy < 128; yy++) {
    for (let xx = 0; xx < 128; xx++) {
      const o = (yy * 128 + xx) * 4
      pimg.data[o] = 255
      pimg.data[o + 1] = 226
      pimg.data[o + 2] = 186
      pimg.data[o + 3] = poolByte(xx, yy, 128, 128)
    }
  }
  pg.putImageData(pimg, 0, 0)
  const poolTex = new THREE.CanvasTexture(poolCv)
  const poolGeo = new THREE.PlaneGeometry(1, 1)
  const poolMat = regNight(new THREE.MeshBasicMaterial({
    map: poolTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.2,
  }), 0.1)
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, P.LAMPS.length)
  const pmat = new THREE.Matrix4()
  const pq = new THREE.Quaternion()
  const pe = new THREE.Euler()
  const pv = new THREE.Vector3()
  const ps = new THREE.Vector3()
  const prnd = P.mulberry32(4477)
  const _lampC = new THREE.Color()
  const _lampC2 = new THREE.Color('#ffd49a')
  P.LAMPS.forEach((l, i) => {
    const px = l.x + Math.sin(l.rot) * 2.3
    const pz = l.z + Math.cos(l.rot) * 2.3
    const y = P.groundY(px, pz)
    // 8m 高的灯，光会铺到二三十米外：贴片做大，靠平方反比衰减让外圈自然淡出，相邻的灯叠成一片
    const k = 0.9 + prnd() * 0.2
    pq.setFromEuler(pe.set(-Math.PI / 2, 0, 0))
    const alongX = Math.abs(Math.sin(l.rot)) > 0.5
    ps.set((alongX ? 64 : 44) * k, (alongX ? 44 : 64) * k, 1)
    pmat.compose(pv.set(px, y + 0.3 + prnd() * 0.04, pz), pq, ps)
    pools.setMatrixAt(i, pmat)
    // 每盏灯色温/亮度略有差别：整齐划一的光斑是「贴片感」的来源之一
    pools.setColorAt(i, _lampC.set('#ffe4bd').lerp(_lampC2.set('#ffd49a'), prnd()).multiplyScalar(0.82 + prnd() * 0.3))
  })
  pools.frustumCulled = false
  scene.add(pools)

  // 店面洒到人行道上的一滩暖光：每家店一片，最后一次性画完
  // 公园
  const park = new MeshBuilder()
  // 公园要在夜里「读得出来」：浅色环路 + 一路暖灯 + 喷泉广场 + 花坛，而不只是一块深绿地
  const parkLamp = (x, z) => {
    const gy = P.groundY(x, z)
    park.cyl(0.08, 3.2, '#4a4f56', x, gy, z, 5)
    glow.box(0.42, 0.42, 0.42, '#ffd9a0', x, gy + 3.35, z, 0)
    haloExtra.push([x, gy + 3.35, z, '#ffcf8a'])
    lightPools.push({ x, z, w: 30, d: 30, y: gy + 0.26, c: '#7a5e3c' })
  }
  const disc = (Mb, x, z, rx, rz, y, col, seg = 28) => {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2
      const a1 = ((i + 1) / seg) * Math.PI * 2
      Mb.tri(x, y, z, x + Math.cos(a1) * rx, y, z + Math.sin(a1) * rz, x + Math.cos(a0) * rx, y, z + Math.sin(a0) * rz, col, 0, 1, 0)
    }
  }
  const pathLoop = (x, z, rx, rz, w, col, lampEvery) => {
    const seg = Math.max(24, Math.round((Math.PI * (rx + rz)) / 6))
    let acc = 0
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2
      const a1 = ((i + 1) / seg) * Math.PI * 2
      const x0 = x + Math.cos(a0) * rx
      const z0 = z + Math.sin(a0) * rz
      const x1 = x + Math.cos(a1) * rx
      const z1 = z + Math.sin(a1) * rz
      const L = Math.hypot(x1 - x0, z1 - z0)
      const mx = (x0 + x1) / 2
      const mz = (z0 + z1) / 2
      park.box(L + 0.6, 0.12, w, col, mx, P.groundY(mx, mz) + 0.2, mz, -Math.atan2(z1 - z0, x1 - x0), { skipBottom: false })
      acc += L
      if (lampEvery && acc > lampEvery) {
        acc = 0
        const nx = Math.cos((a0 + a1) / 2)
        const nz = Math.sin((a0 + a1) / 2)
        parkLamp(mx + nx * (w / 2 + 0.8), mz + nz * (w / 2 + 0.8))
      }
    }
  }
  // 长椅：木条座面 + 靠背 + 铁脚，朝向由 rot 决定（0 = 面朝 +Z）
  const bench = (x, z, rot = 0) => {
    const gy = P.groundY(x, z)
    park.box(2.0, 0.12, 0.56, '#a8784c', x, gy + 0.62, z, rot)
    park.box(2.0, 0.5, 0.1, '#a8784c', x + Math.sin(rot) * 0.26, gy + 0.95, z + Math.cos(rot) * 0.26, rot)
    for (const s of [-1, 1]) {
      const lx = x + Math.cos(rot) * s * 0.86
      const lz = z - Math.sin(rot) * s * 0.86
      park.box(0.1, 0.6, 0.5, '#4a4f56', lx, gy + 0.32, lz, rot)
    }
  }
  // 垃圾桶：深绿桶身 + 顶部一圈亮口
  const parkBin = (x, z) => {
    const gy = P.groundY(x, z)
    park.cyl(0.34, 1.0, '#3f5c46', x, gy + 0.18, z, 8)
    park.cyl(0.36, 0.12, '#c9c2b4', x, gy + 1.08, z, 8)
  }
  // 公园咖啡亭：吧台 + 座椅 + 门面灯带，是公园里的「客厅」
  const kiosk = (x, z) => {
    const gy = P.groundY(x, z)
    park.box(6, 0.3, 4.6, '#c9bda6', x, gy + 0.15, z, 0, { skipBottom: false })
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) props.box(0.26, 2.8, 0.26, '#5a4a3a', x + sx * 2.6, gy + 1.6, z + sz * 1.9, 0)
    park.box(6.8, 0.24, 5.4, '#7a4a3a', x, gy + 3.3, z, 0)
    glow.box(5.6, 0.7, 0.1, '#ffd9a0', x, gy + 2.1, z + 2.36, 0)
    props.box(1.8, 1.1, 0.9, '#8a6a48', x - 1.6, gy + 0.85, z + 2.2, 0)
    haloExtra.push([x, gy + 3.0, z, '#ffcf8a'])
    lightPools.push({ x, z: z + 3.4, w: 12, d: 8, y: gy + 0.24, c: '#ff9a40' })
    bench(x + 3.4, z, -Math.PI / 2)
    bench(x - 3.4, z, Math.PI / 2)
  }
  // 休憩亭：四根柱 + 双坡顶 + 顶下灯
  const pavilion = (x, z, w = 7) => {
    const gy = P.groundY(x, z)
    const hd = w * 0.8
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) props.box(0.32, 3.4, 0.32, '#7a6a52', x + sx * (w / 2 - 0.4), gy + 1.9, z + sz * (hd / 2 - 0.4), 0)
    park.box(w + 0.8, 0.28, hd + 0.8, '#6e5a44', x, gy + 3.9, z, 0)
    for (const s of [-1, 1]) {
      // 坡屋面：两块斜板
      const d2 = hd * 0.58
      park.box(w + 1.2, 0.2, d2, '#9a3f32', x, gy + 4.5, z + s * d2 * 0.45, 0)
    }
    glow.box(w * 0.5, 0.12, 0.22, '#ffd9a0', x, gy + 3.66, z, 0)
    haloExtra.push([x, gy + 3.7, z, '#ffcf8a'])
    bench(x - w * 0.34, z, 0)
    bench(x + w * 0.34, z, 0)
  }
  // 儿童游乐场：滑梯 + 秋千 + 沙坑
  const playground = (x, z) => {
    const gy = P.groundY(x, z)
    park.box(16, 0.16, 12, '#d8c9a8', x, gy + 0.18, z, 0, { skipBottom: false })
    // 沙坑
    park.box(7, 0.3, 6, '#e2cfa4', x - 6, gy + 0.3, z + 2.4, 0)
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) park.box(0.24, 0.5, 2.4, '#b9752e', x - 6 + sx * 3.4, gy + 0.42, z + 2.4 + sz * 0, 0)
    // 滑梯：台阶塔 + 斜面 + 两侧扶手
    park.box(2.6, 2.6, 2.6, '#e0603c', x + 2, gy + 1.5, z - 1.2, 0)
    park.box(1.2, 0.22, 5.4, '#5aa0d8', x + 2, gy + 1.2, z + 1.8, 0.5)
    for (const s of [-1, 1]) park.box(0.12, 0.7, 5.4, '#f0e8d8', x + 2 + s * 0.7, gy + 1.5, z + 1.8, 0.5)
    // 秋千：两道门架 + 两根摆绳 + 座板
    for (const s of [-1, 1]) {
      park.box(0.22, 2.6, 0.22, '#4a4f56', x + s * 2.6, gy + 1.5, z - 4.4, 0)
    }
    park.box(5.6, 0.18, 0.18, '#4a4f56', x, gy + 2.8, z - 4.4, 0)
    for (const s of [-0.9, 1.1]) {
      park.box(0.06, 1.6, 0.06, '#8d9298', x + s, gy + 2.0, z - 4.4, 0)
      park.box(0.7, 0.1, 0.4, '#c9762e', x + s, gy + 1.2, z - 4.4, 0)
    }
    parkLamp(x + 7.6, z + 4.6)
    bench(x - 7, z - 4, 1.57)
  }
  const BED_COL = ['#e86a8a', '#f2c14a', '#b07ad8', '#f08a4b', '#f4f0e6']
  const bed = (x, z, w, d, k) => {
    const gy = P.groundY(x, z)
    park.box(w + 0.4, 0.35, d + 0.4, '#bdb2a0', x, gy + 0.18, z, 0)
    park.box(w, 0.5, d, BED_COL[Math.abs(k) % BED_COL.length], x, gy + 0.4, z, 0)
  }
  for (const p of P.PARKS) {
    const cx = (p.x0 + p.x1) / 2
    const cz = (p.z0 + p.z1) / 2
    const y = P.groundY(cx, cz)
    const pw = p.x1 - p.x0
    const pd = p.z1 - p.z0
    if (pw > 80) {
      pathLoop(cx, cz, pw / 2 - 8, pd / 2 - 8, 3.4, '#76706a', 15)
      // 喷泉广场（东南角空地）
      const fx = p.x1 - 22
      const fz = p.z0 + 20
      const fy = P.groundY(fx, fz)
      disc(park, fx, fz, 12, 12, fy + 0.24, '#cfc3ad')
      park.cyl(5, 0.7, '#ddd5c6', fx, fy + 0.2, fz, 18)
      disc(glow, fx, fz, 4.4, 4.4, fy + 0.95, '#5fb0e0', 18)
      park.cyl(0.9, 1.2, '#ddd5c6', fx, fy + 0.6, fz, 10)
      glow.box(0.35, 2.8, 0.35, '#bfe6ff', fx, fy + 2.6, fz, 0)
      haloExtra.push([fx, fy + 3.6, fz, '#9fd8ff'])
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        if (i % 2) parkLamp(fx + Math.cos(a) * 11, fz + Math.sin(a) * 11)
        else bed(fx + Math.cos(a) * 8, fz + Math.sin(a) * 8, 2.2, 2.2, i)
      }
      // 东北角再加一组设施：第二个游乐场 + 咖啡亭，公园腹地才不是「只有一圈人」
      playground(p.x1 - 94, p.z0 + 46)
      kiosk(p.x1 - 76, p.z1 - 30)
      pavilion(p.x0 + pw * 0.3, p.z0 + pd * 0.35, 8)
    } else {
      // 小公园：中心铺地 + 花坛 + 长椅 + 四盏灯
      const r = Math.min(pw, pd) * 0.28
      disc(park, cx, cz, r, r, y + 0.24, '#cfc3ad', 20)
      bed(cx, cz, r * 0.7, r * 0.7, Math.round(cx))
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parkLamp(cx + sx * (r + 1.2), cz + sz * (r + 1.2))
      for (const s of [-1, 1]) park.box(2.2, 0.45, 0.6, '#a07850', cx + s * (r + 0.4), y + 0.45, cz, 0)
    }
    if (p.lake) {
      const ly = P.groundY(p.lake.x, p.lake.z)
      disc(park, p.lake.x, p.lake.z, p.lake.rx, p.lake.rz, ly - 0.3, '#2f6a98', 36)
      disc(park, p.lake.x, p.lake.z, p.lake.rx * 0.8, p.lake.rz * 0.8, ly - 0.28, '#3a7cad', 36)
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2
        park.box(1.4, 0.5, 0.8, '#8d9298', p.lake.x + Math.cos(a) * p.lake.rx, ly + 0.1, p.lake.z + Math.sin(a) * p.lake.rz, -a)
      }
    }
    if (p.hill) {
      const hy = P.groundY(p.hill.x, p.hill.z)
      park.cone(p.hill.r, p.hill.h, '#3a5040', p.hill.x, hy - 0.2, p.hill.z, 14)
      park.cyl(2.4, 0.6, '#c9c2b4', p.hill.x, hy + p.hill.h - 0.4, p.hill.z, 8)
      park.box(3.0, 2.2, 0.4, '#7f8890', p.hill.x, hy + p.hill.h + 1.4, p.hill.z, 0)
    }
    // 步道：外圈环路 + 两条贯穿的直路 + 一条斜路，公园里能真正「走进去」
    park.box(p.x1 - p.x0, 0.12, 3.2, '#76706a', cx, y + 0.18, p.z0 + 6, 0, { skipBottom: false })
    park.box(3.2, 0.12, p.z1 - p.z0, '#76706a', p.x0 + 8, y + 0.18, cz, 0, { skipBottom: false })
    if (pw > 80) {
      // 南北向主路（对齐中轴）+ 东西向主路
      park.box(4.2, 0.14, pd - 8, '#76706a', cx, y + 0.19, cz, 0, { skipBottom: false })
      park.box(pw - 8, 0.14, 4.2, '#76706a', cx, y + 0.19, cz, 0, { skipBottom: false })
      // 斜路：从西南角切到东北角，路上隔一段一盏灯
      const dl = Math.hypot(pw, pd) - 24
      const da = Math.atan2(pd, pw)
      park.box(dl, 0.14, 3.0, '#76706a', cx, y + 0.19, cz, -da, { skipBottom: false })
      for (let k = -1; k <= 1; k++) parkLamp(cx + Math.cos(da) * k * dl * 0.3, cz + Math.sin(da) * k * dl * 0.3)
      // 长椅沿主路两侧摆
      for (let k = -2; k <= 2; k++) {
        if (!k) continue
        bench(cx - 6.4, cz + k * (pd / 7), 1.57)
        bench(cx + 6.4, cz + k * (pd / 7), -1.57)
        bench(cx + k * (pw / 7), cz + 6.4, 0)
        parkBin(cx - 3.2, cz + k * (pd / 7) + 2)
      }
      pavilion(p.x0 + 34, p.z1 - 26, 8)
      playground(p.x0 + 62, p.z0 + 34)
    } else {
      // 小口袋公园：交叉口 + 两张长椅 + 一个垃圾桶
      bench(cx - 3.2, cz + 2.4, 0.6)
      bench(cx + 3.2, cz - 2.4, 3.7)
      parkBin(cx + 2.6, cz + 2.6)
    }
  }
  // 篮球场
  for (const [x, z] of P.PARKS[0].courts) {
    const y = P.groundY(x, z)
    park.box(26, 0.14, 15, '#4a5f6a', x, y + 0.2, z, 0, { skipBottom: false })
    park.box(26, 0.1, 0.24, '#d8ddd6', x, y + 0.26, z, 0, { skipBottom: false })
    for (const s of [-1, 1]) park.box(0.3, 3.2, 0.3, '#7f8890', x + s * 11, y + 1.8, z, 0)
  }

  if (lightPools.length) {
    const spMat = regNight(new THREE.MeshBasicMaterial({
      map: shopPoolTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.5,
      // 光池和人行道面（+0.2，自带 polygonOffset）几乎共面，必须压得更狠才不闪
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -16,
    }), 0.12)
    const spMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), spMat, lightPools.length)
    const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    const mm = new THREE.Matrix4()
    const cc = new THREE.Color()
    lightPools.forEach((q, i) => {
      // 长尾衰减的有效亮区比贴片小，横向放大 1.5 倍；纵深只放 1.2 倍，免得伸进店里
      mm.compose(new THREE.Vector3(q.x, q.y + 0.05, q.z), q2, new THREE.Vector3(q.w * 1.5, q.d * 1.2, 1))
      spMesh.setMatrixAt(i, mm)
      spMesh.setColorAt(i, cc.set(q.c))
    })
    spMesh.frustumCulled = false
    scene.add(spMesh)
  }

  // 湿地面：招牌与路灯在地面上的拉长倒影。加法混合 + 不写深度，不画暗色圆片。
  const wetCv = document.createElement('canvas')
  wetCv.width = 128
  wetCv.height = 128
  const wg = wetCv.getContext('2d')
  const wgr = wg.createRadialGradient(64, 64, 0, 64, 64, 64)
  wgr.addColorStop(0, 'rgba(255,255,255,0.85)')
  wgr.addColorStop(0.42, 'rgba(255,255,255,0.20)')
  wgr.addColorStop(1, 'rgba(255,255,255,0)')
  wg.fillStyle = wgr
  wg.fillRect(0, 0, 128, 128)
  const wetTex = new THREE.CanvasTexture(wetCv)
  const wetMat = regNight(new THREE.MeshBasicMaterial({
    map: wetTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.62,
  }), 0.3)
  const wetSpots = []
  for (const s of P.shops) {
    if (s.tier === 'C') continue
    const nx = s.face === 's' ? 0 : s.face === 'n' ? 0 : s.face === 'e' ? 1 : -1
    const nz = s.face === 's' ? 1 : s.face === 'n' ? -1 : 0
    const along = nz === 0 ? 6.5 : Math.min(5.2, s.w * 0.8)
    wetSpots.push({
      x: s.x + nx * 3.1,
      z: s.z + nz * 3.1,
      sx: nz === 0 ? 6.5 : along,
      sz: nz === 0 ? Math.min(5.2, s.w * 0.8) : 6.5,
      col: s.open ? s.ink : '#2a303a',
      k: s.open ? 0.72 : 0.1,
    })
  }
  for (const l of P.LAMPS) {
    wetSpots.push({
      x: l.x + Math.sin(l.rot) * 2.3,
      z: l.z + Math.cos(l.rot) * 2.3,
      sx: 2.6,
      sz: 11,
      col: '#ffd9a8',
      k: 0.28,
    })
  }
  const wet = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), wetMat, wetSpots.length)
  const wcol = new THREE.Color()
  wetSpots.forEach((p, i) => {
    const y = P.groundY(p.x, p.z)
    pmat.compose(new THREE.Vector3(p.x, y + 0.26, p.z), pq, new THREE.Vector3(p.sx, p.sz, 1))
    wet.setMatrixAt(i, pmat)
    wet.setColorAt(i, wcol.set(p.col).multiplyScalar(p.k))
  })
  if (wet.instanceColor) wet.instanceColor.needsUpdate = true
  wet.frustumCulled = false
  wet.renderOrder = 2
  scene.add(wet)

  // 灯头光晕：一张柔光贴图 + Points，一次 draw call。灯只有亮点没有光晕，夜景会像贴纸。
  {
    const hc = document.createElement('canvas')
    hc.width = 64
    hc.height = 64
    const hg = hc.getContext('2d')
    const hr = hg.createRadialGradient(32, 32, 0, 32, 32, 32)
    // 小而亮的核 + 很淡的外晕：大块实心渐变从高处看就是一颗颗白球
    hr.addColorStop(0, 'rgba(255,255,255,1)')
    hr.addColorStop(0.08, 'rgba(255,255,255,0.75)')
    hr.addColorStop(0.22, 'rgba(255,255,255,0.22)')
    hr.addColorStop(0.5, 'rgba(255,255,255,0.05)')
    hr.addColorStop(1, 'rgba(255,255,255,0)')
    hg.fillStyle = hr
    hg.fillRect(0, 0, 64, 64)
    const spots = []
    for (const l of P.LAMPS) {
      spots.push([l.x + Math.sin(l.rot) * 2.3, P.groundY(l.x, l.z) + 8.05, l.z + Math.cos(l.rot) * 2.3, '#ffe4bc'])
    }
    for (const h of haloExtra) spots.push(h)
    const pos = new Float32Array(spots.length * 3)
    const col = new Float32Array(spots.length * 3)
    const cc = new THREE.Color()
    spots.forEach((p, i) => {
      pos[i * 3] = p[0]
      pos[i * 3 + 1] = p[1]
      pos[i * 3 + 2] = p[2]
      cc.set(p[3])
      col[i * 3] = cc.r
      col[i * 3 + 1] = cc.g
      col[i * 3 + 2] = cc.b
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const halo = new THREE.Points(
      geo,
      regNight(new THREE.PointsMaterial({
        map: new THREE.CanvasTexture(hc),
        size: 3.6,
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
        toneMapped: false,
      }), 0.15)
    )
    halo.frustumCulled = false
    halo.renderOrder = 4
    scene.add(halo)
  }

  for (const s of P.SIGNALS) {
    const xr = P.ROADS.find((r) => r.a === 'x' && Math.abs(r.at - s.z) < 2)
    const zr = P.ROADS.find((r) => r.a === 'z' && Math.abs(r.at - s.x) < 2)
    if (!xr || !zr) continue
    const hx = xr.w / 2 + 1.6
    const hz = zr.w / 2 + 1.6
    const y = P.groundY(s.x, s.z)
    for (const [ox, oz, rot] of [
      [hz, hx, -Math.PI / 4],
      [-hz, hx, Math.PI / 4],
      [hz, -hx, -Math.PI * 0.75],
      [-hz, -hx, Math.PI * 0.75],
    ]) {
      props.cyl(0.18, 6.4, '#3f464d', s.x + ox, y + 0.2, s.z + oz, 6)
      props.box(1.4, 0.18, 0.3, '#3f464d', s.x + ox - Math.cos(rot) * 0.6, y + 5.6, s.z + oz - Math.sin(rot) * 0.6, rot)
      glowProps.box(0.34, 0.9, 0.26, '#ff4a3a', s.x + ox, y + 5.9, s.z + oz, rot)
      glowProps.box(0.34, 0.9, 0.26, '#3ad06a', s.x + ox, y + 4.9, s.z + oz, rot)
    }
  }

  for (const b of P.BUS_STOPS) {
    const y = P.groundY(b.x, b.z)
    const rot = b.side === 'e' ? -Math.PI / 2 : b.side === 'w' ? Math.PI / 2 : b.side === 's' ? 0 : Math.PI
    props.box(0.24, 3.0, 0.24, '#5a636b', b.x, y + 1.5, b.z + 2.6, rot)
    props.box(6.4, 0.2, 2.2, '#8f99a2', b.x, y + 3.1, b.z, rot)
    glowProps.box(5.6, 0.22, 0.12, '#ffd9a2', b.x, y + 2.94, b.z + 1.0, rot)
    props.box(3.4, 0.5, 0.5, '#7f8890', b.x, y + 0.6, b.z - 0.6, rot)
    props.box(0.14, 1.2, 0.14, '#5a636b', b.x - 1.5, y + 0.6, b.z - 0.6, rot)
    props.box(0.14, 1.2, 0.14, '#5a636b', b.x + 1.5, y + 0.6, b.z - 0.6, rot)
    props.box(0.5, 2.6, 0.16, '#2a3644', b.x + 3.2, y + 1.7, b.z + 1.2, rot)
    glowProps.box(0.36, 0.9, 0.1, '#7ad2ff', b.x + 3.2, y + 2.4, b.z + 1.3, rot)
  }

  for (const bk of P.BIKES) {
    const y = P.groundY(bk.x, bk.z)
    const n = bk.n
    for (let i = 0; i < n; i++) {
      const cx = bk.x + Math.cos(bk.rot) * (i - n / 2) * P.SCALE.bike
      const cz = bk.z + Math.sin(bk.rot) * (i - n / 2) * P.SCALE.bike
      if (P.mulberry32(i * 31 + Math.floor(bk.x))() < 0.18) continue
      props.box(0.08, 0.7, 1.5, ['#f2c230', '#3a9ad9', '#f07a3a', '#5ab56e'][Math.floor(bk.x * 7 + i) & 3], cx, y + 0.55, cz, bk.rot)
      props.cyl(0.3, 0.1, '#2a2f35', cx - 0.5, y + 0.3, cz, 7)
      props.cyl(0.3, 0.1, '#2a2f35', cx + 0.5, y + 0.3, cz, 7)
      props.box(0.35, 0.05, 0.16, '#2a2f35', cx, y + 0.95, cz, bk.rot)
    }
    props.quad(
      [bk.x - 5, y + 0.24, bk.z + 1.4],
      [bk.x + 5, y + 0.24, bk.z + 1.4],
      [bk.x + 5, y + 0.24, bk.z - 1.4],
      [bk.x - 5, y + 0.24, bk.z - 1.4],
      '#8a9296',
      0,
      1,
      0
    )
  }

  // 地铁口
  for (const m of P.METRO) {
    for (const [dx, dz] of m.transfer ? [[26, 26], [-26, 26], [26, -26], [-26, -26]] : [[22, 22], [-22, -22]]) {
      const x = m.x + dx
      const z = m.z + dz
      const y = P.groundY(x, z)
      solid.box(5.2, 3.4, 3.6, '#33414d', x, y + 1.7, z, 0)
      glow.box(4.4, 0.9, 0.2, '#7ad2ff', x, y + 3.1, z + 1.7, 0)
      solid.box(5.8, 0.3, 4.2, '#c6d0d8', x, y + 3.5, z, 0)
      solid.box(0.3, 1.1, 0.3, '#7f8890', x - 2.4, y + 0.55, z + 1.6, 0)
      solid.box(0.3, 1.1, 0.3, '#7f8890', x + 2.4, y + 0.55, z + 1.6, 0)
      doors.push({ x: x, z: z + 2.6, y, name: m.name + ' 地铁站', kind: 'metro', b: null })
    }
  }

  // 消防栓 / 垃圾桶 / 长椅 / 路灯杆
  const hydrant = (x, z) => {
    const y = P.groundY(x, z)
    props.cyl(0.22, 0.9, '#c8352a', x, y + 0.2, z, 6)
    props.box(0.5, 0.16, 0.16, '#c8352a', x, y + 0.9, z, 0)
  }
  // 分类垃圾桶：蓝 / 绿 / 红 / 灰四色一排，和「雨夜便利店」门口那组一样是画面里的彩色点
  const bin = (x, z) => {
    const y = P.groundY(x, z)
    const cols = ['#3d7bd9', '#3fae6a', '#d2453c', '#8a8e9a']
    cols.forEach((c, k) => {
      const bx = x + (k - 1.5) * 0.62
      props.box(0.54, 0.95, 0.54, c, bx, y + 0.68, z, 0)
      props.box(0.6, 0.08, 0.6, shade(c, 0.75), bx, y + 1.18, z, 0)
      props.box(0.3, 0.04, 0.04, '#1f2238', bx, y + 1.0, z + 0.28, 0)
    })
  }
  const onZRoad = (x, pad) => P.ROADS.some((r) => r.a === 'z' && Math.abs(x - r.at) < r.w / 2 + pad)
  for (let x = P.CITY.x0 + 20; x < P.CITY.x1 - 20; x += 15) {
    if (onZRoad(x, 3) || onZRoad(x + 6, 3)) continue
    hydrant(x, -21)
    bin(x + 6, 20)
  }
  for (let z = P.southZ(0) + 24; z < P.CITY.z1 - 20; z += 13) if (Math.abs(z) > 24) bin(-21, z)
  /** 停车场 / 加油站这类附属：候选点里挑不压楼、不压路的 */
  const freeLot = (x, z, w, d) =>
    !P.buildings.some((b) => Math.abs(x - b.x) < (w + b.w) / 2 + 2 && Math.abs(z - b.z) < (d + b.d) / 2 + 2) &&
    !P.ROADS.some((r) => {
      const [e0, e1] = P.roadExtent(r)
      const t = r.a === 'x' ? x : z
      const o = r.a === 'x' ? z : x
      return t > e0 - 20 && t < e1 + 20 && Math.abs(o - r.at) < r.w / 2 + (r.a === 'x' ? d : w) / 2 + 2
    }) &&
    !P.nearCreek(x, z, Math.max(w, d) / 2 + 2) &&
    !P.PARKS.some((pk) => x > pk.x0 - w / 2 - 2 && x < pk.x1 + w / 2 + 2 && z > pk.z0 - d / 2 - 2 && z < pk.z1 + d / 2 + 2) &&
    Math.hypot(x - P.FERRIS.x, z - P.FERRIS.z) > P.FERRIS.r + 20

  // 老城固定摊位：摊车 + 遮阳伞 + 手写牌 + 折叠桌
  // 解放路老城段：路边一溜早夜市摊
  const stallsAt = []
  for (let x = -590, i = 0; x < -420; x += 21, i++) {
    if (onZRoad(x, 4) || P.nearDiag(x, -110, 2)) continue
    stallsAt.push([x, -110 + (i % 2 ? 3.2 : -3.2)])
  }
  for (const [x, z] of stallsAt) {
    const y = P.groundY(x, z)
    props.box(2.2, 0.9, 1.3, '#b9b2a4', x, y + 0.75, z, 0)
    props.box(2.3, 0.08, 1.4, '#8a8375', x, y + 1.24, z, 0)
    props.cyl(0.06, 2.6, '#7f8890', x + 0.8, y + 1.2, z + 0.5, 5)
    props.cone(1.9, 0.6, '#c85a4a', x + 0.8, y + 3.4, z + 0.5, 8)
    solid.box(1.2, 0.5, 0.08, '#2a2622', x - 0.4, y + 1.6, z + 0.75, 0)
    glowProps.box(1.0, 0.3, 0.04, '#ffd9a2', x - 0.4, y + 1.6, z + 0.8, 0)
    for (let i = 0; i < 2; i++) {
      props.box(0.4, 0.06, 0.4, '#c9a24e', x + 1.9, y + 0.5, z - 0.8 + i * 1.2, 0)
      props.box(0.06, 0.5, 0.06, '#6a5a44', x + 1.9, y + 0.25, z - 0.8 + i * 1.2, 0)
    }
  }

  // 公交站牌 / 路名牌 / 公告栏
  const board = (x, z, rot, w, h, col) => {
    const y = P.groundY(x, z)
    props.cyl(0.08, 2.6, '#5a636b', x - w / 2, y + 1.3, z, 5)
    props.cyl(0.08, 2.6, '#5a636b', x + w / 2, y + 1.3, z, 5)
    solid.box(w, h, 0.12, col, x, y + 2.2, z, rot)
    glowProps.box(w - 0.2, h - 0.2, 0.04, '#d8e2ea', x, y + 2.2, z + 0.08, rot)
  }
  board(-150, P.PEDESTRIAN.z - 8, 0, 3.2, 1.8, '#3a4650')
  board(-380, 22, 0, 3.0, 1.7, '#3a4650')
  board(30, 20, 0, 2.6, 1.5, '#3a4650')
  board(-300, 20, Math.PI / 2, 2.6, 1.5, '#3a4650')

  // 路名牌（路口四角）
  for (const s of P.SIGNALS) {
    for (const [ox, oz, rot] of [[25, 25, 0], [-25, -25, Math.PI]]) {
      const y = P.groundY(s.x + ox, s.z + oz)
      props.cyl(0.07, 3.2, '#5a636b', s.x + ox, y + 1.6, s.z + oz, 5)
      solid.box(2.4, 0.42, 0.1, '#2f4a63', s.x + ox + 1.1, y + 3.1, s.z + oz, rot)
      glowProps.box(2.15, 0.24, 0.04, '#d8e2ea', s.x + ox + 1.1, y + 3.1, s.z + oz + 0.07, rot)
    }
  }

  // 地面停车场（道闸 + 车位线 + 限位器）
  /** 全城按 40m 网格扫一遍空地，彼此至少隔 sep 米，最多 n 个 */
  const pickFree = (w, d, n, sep, taken = []) => {
    const out = []
    for (let z = -300; z <= 440; z += 40)
      for (let x = -720; x <= 720; x += 40) {
        if (out.length >= n || !freeLot(x, z, w, d)) continue
        if ([...taken, ...out].some((o) => Math.hypot(o.x - x, o.z - z) < sep)) continue
        out.push({ x, z })
      }
    return out
  }
  const LOTS = pickFree(30, 16, 6, 160).map((l) => ({ ...l, n: 8, rot: 0 }))
  for (const lot of LOTS) {
    const y = P.groundY(lot.x, lot.z)
    props.box(lot.rot ? 16 : 30, 0.08, lot.rot ? 30 : 16, '#3a3f45', lot.x, y + 0.22, lot.z, 0, { skipBottom: false })
    for (let i = 0; i < lot.n; i++) {
      const o = (i - lot.n / 2 + 0.5) * 3.2
      if (lot.rot) {
        props.box(0.12, 0.06, 5.2, '#c6ccc8', lot.x + o, y + 0.3, lot.z, 0, { skipBottom: false })
        props.box(0.6, 0.16, 0.16, '#8f959c', lot.x, y + 0.4, lot.z + o, 0)
      } else {
        props.box(0.12, 0.06, 5.2, '#c6ccc8', lot.x + o, y + 0.3, lot.z, 0, { skipBottom: false })
        props.box(0.6, 0.16, 0.16, '#8f959c', lot.x + o, y + 0.4, lot.z + 2.4, 0)
      }
    }
    props.cyl(0.1, 1.4, '#c8352a', lot.x - 16, y + 0.9, lot.z - 8, 5)
    props.box(lot.rot ? 5 : 0.16, 0.16, lot.rot ? 0.16 : 5, '#d8d2c2', lot.x - 16 + 2.5, y + 1.5, lot.z - 8, 0)
  }

  // 加油站
  for (const g of pickFree(18, 12, 2, 500, LOTS)) {
    const y = P.groundY(g.x, g.z)
    props.box(16, 0.5, 10, '#8f9aa4', g.x, y + 5.4, g.z, 0)
    glowProps.box(14, 0.3, 0.3, '#ffe6b8', g.x, y + 5.1, g.z + 4.6, 0)
    for (const s of [-1, 1]) props.cyl(0.24, 5.2, '#c6d0d8', g.x + s * 6, y + 2.6, g.z, 6)
    for (const s of [-1, 1]) {
      props.box(1.0, 1.6, 0.7, '#d8d2c2', g.x + s * 3, y + 0.8, g.z, 0)
      props.box(1.1, 0.5, 0.8, '#c8352a', g.x + s * 3, y + 1.85, g.z, 0)
      glowProps.box(0.7, 0.24, 0.1, '#ffd9a2', g.x + s * 3, y + 1.4, g.z + 0.4, 0)
    }
    props.box(2.4, 4.4, 0.3, '#2f4a63', g.x - 8, y + 2.2, g.z - 4, 0)
    glowProps.box(2.0, 1.2, 0.1, '#ffd9a2', g.x - 8, y + 3.2, g.z - 3.8, 0)
  }

  // 出租车候客点：护栏 + 顶牌
  for (const t of [{ x: 34, z: -24, rot: 0 }, { x: -30, z: 24, rot: 0 }, { x: 34, z: -196, rot: 0 }, { x: 426, z: 24, rot: 0 }, { x: -374, z: -24, rot: 0 }]) {
    const y = P.groundY(t.x, t.z)
    props.cyl(0.07, 3.0, '#5a636b', t.x, y + 1.5, t.z, 5)
    glowProps.box(1.4, 0.4, 0.1, '#ffcf6a', t.x, y + 3.1, t.z, 0)
    for (let i = 0; i < 5; i++) {
      props.box(0.06, 1.0, 0.06, '#9aa3aa', t.x - 2 + i * 1.0, y + 0.7, t.z + 2.4, 0)
      props.box(1.0, 0.06, 0.06, '#9aa3aa', t.x - 1.5 + i * 1.0, y + 1.2, t.z + 2.4, 0)
    }
  }

  // 井盖 / 雨水篦子
  for (let x = P.CITY.x0 + 20; x < P.CITY.x1 - 20; x += 18) {
    if (onZRoad(x, 1) || onZRoad(x + 9, 1)) continue
    props.cyl(0.45, 0.06, '#33383d', x, P.groundY(x, -19) + 0.32, -19, 8)
    props.cyl(0.45, 0.06, '#33383d', x + 9, P.groundY(x + 9, 19) + 0.32, 19, 8)
  }

  // 小区游乐场 / 车棚 / 垃圾分类亭
  for (const c of P.COMPOUNDS) {
    const gy = P.groundY(c.x0 + 9, c.z0 + 10)
    const px = c.x0 + 9
    const pz = c.z0 + 10
    props.box(7, 0.2, 5, '#c9b98a', px, gy + 0.2, pz, 0, { skipBottom: false })
    props.box(1.4, 1.1, 1.4, '#c85a4a', px - 1.6, gy + 0.75, pz, 0)
    props.box(0.9, 2.6, 0.12, '#8f959c', px, gy + 1.4, pz - 1.6, 0.5)
    props.box(0.9, 2.6, 0.12, '#8f959c', px, gy + 1.4, pz + 1.6, -0.5)
    props.box(1.0, 0.1, 0.1, '#9aa3aa', px + 2.2, gy + 2.6, pz, 0)
    props.box(0.06, 2.4, 0.06, '#7f8890', px + 3.4, gy + 1.2, pz, 0)
    props.box(0.06, 2.4, 0.06, '#7f8890', px - 3.2, gy + 1.2, pz, 0)
    // 电动车棚
    const sy = P.groundY(c.x1 - 8, c.z0 + 8)
    props.box(10, 0.2, 4.4, '#7f9aa8', c.x1 - 8, sy + 2.6, c.z0 + 8, 0)
    for (const s of [-1, 1]) props.cyl(0.1, 2.6, '#5a636b', c.x1 - 8 + s * 4.6, sy + 1.3, c.z0 + 8, 5)
    for (let i = 0; i < 5; i++) props.box(0.06, 0.5, 0.06, '#5a636b', c.x1 - 12 + i * 2, sy + 0.25, c.z0 + 9, 0)
    // 垃圾四分类亭
    const ty = P.groundY(c.x0 + 6, c.z1 - 8)
    props.box(4.2, 0.2, 2.2, '#5a636b', c.x0 + 6, ty + 2.3, c.z1 - 8, 0)
    for (let i = 0; i < 4; i++) {
      props.box(0.8, 1.0, 0.8, ['#3f6a52', '#3a6a8a', '#8a3a2a', '#6a6a5a'][i], c.x0 + 4.6 + i * 0.95, ty + 0.7, c.z1 - 8, 0)
      glowProps.box(0.2, 0.2, 0.04, '#d8e2ea', c.x0 + 4.6 + i * 0.95, ty + 1.3, c.z1 - 7.5, 0)
    }
  }

  // 校车停靠位（小学正门）
  {
    const sc = P.byId.school
    const x = sc ? sc.x : -300
    const z = sc ? sc.z - sc.d / 2 - 4 : 30
    const y = P.groundY(x, z)
    props.box(11, 2.6, 2.4, '#e8a23a', x, y + 1.6, z, 0)
    props.box(10.4, 1.0, 2.44, '#2a3a4a', x, y + 2.2, z, 0)
    for (const s of [-1, 1]) for (const d of [-1, 1]) props.cyl(0.46, 0.26, '#1a1d21', x + s * 3.6, y + 0.4, z + d * 1.1, 8)
    glowProps.box(1.4, 0.3, 0.1, '#ffd9a2', x + 4, y + 2.8, z + 1.3, 0)
  }

  // 广告牌：每块都有内容（产品图形 + 标题 + 副标题 + 品牌），画在一张图集里，全城一次 draw call
  {
    const AW = 2048
    const cv = document.createElement('canvas')
    cv.width = cv.height = AW
    const g = cv.getContext('2d')
    const LAND = [
      ['#ffd6e4', '#ff8fab', 'cup', '新品上市', '第二杯半价 · 鲜果现泡', '茶语时光', '#6a1a3a'],
      ['#141832', '#3a4a8a', 'phone', '超感影像', '旗舰新品 现货发售', 'NOVA 12', '#ffffff'],
      ['#0f3a4a', '#3a8a9a', 'city', '江景大平层', '首付20万起 · 地铁口', '望江府', '#fff3d6'],
      ['#eef3f6', '#9fbccc', 'car', '纯电长续航', '新能源 限时置换补贴', 'EV7', '#1a2a3a'],
      ['#7a1410', '#e0392a', 'pot', '老成都火锅', '麻辣鲜香 · 营业至凌晨2点', '蜀香阁', '#ffe9b0'],
      ['#120e26', '#5a2a7a', 'star', '全国热映', '《星河归途》 国庆档', 'IMAX', '#ffd27a'],
      // 高饱和霓虹：像素纽约那种整块纯色 + 亮字
      ['#ff2e8a', '#7a1aff', 'mic', '今夜开唱', '20:00 主舞台', 'LIVE', '#fff7e0'],
      ['#00c8ff', '#0050ff', 'card', '极速到账', '扫码即办', 'PAY', '#ffffff'],
      ['#ffd400', '#ff7a00', 'star', '限时五折', '全场通用', 'SALE', '#3a1a00'],
    ]
    const PORT = [
      ['#ff6a3a', '#ffb03a', 'shoe', '轻·跑', '新一代缓震', 'RUN', '#ffffff'],
      ['#3a2a1e', '#8a5a3a', 'cup2', '早安', '现磨咖啡', 'BEAN', '#fff1d6'],
      ['#d8f0ff', '#8ac8f0', 'drop', '水润', '一夏', 'AQUA', '#1a4a7a'],
      ['#2a6a4a', '#8ac87a', 'mount', '去山里', '过周末', '北山', '#ffffff'],
      ['#1a1240', '#6a3ad8', 'star', '新赛季', '今日开启', 'GAME', '#7ff0ff'],
      ['#0e3a6a', '#2a7ad8', 'card', '一卡', '通行', '城商银行', '#ffffff'],
      ['#e8b020', '#ffe070', 'beer', '冰爽', '一夏', '江城啤酒', '#5a3a0a'],
      ['#2a0e2a', '#c03a8a', 'mic', '今夏', '开唱', 'LIVE', '#ffffff'],
      ['#0affc0', '#00a88a', 'drop', '清爽', '零糖零卡', 'MINT', '#04302a'],
      ['#ff5a00', '#ffc400', 'pot', '凌晨宵夜', '营业到 4 点', '夜市', '#3a1400'],
    ]
    const motif = (kind, cx, cy, r, ink) => {
      g.save()
      g.fillStyle = 'rgba(255,255,255,.92)'
      g.strokeStyle = ink
      g.lineWidth = r * 0.06
      if (kind === 'cup' || kind === 'cup2') {
        g.beginPath()
        g.moveTo(cx - r * 0.5, cy - r * 0.6)
        g.lineTo(cx + r * 0.5, cy - r * 0.6)
        g.lineTo(cx + r * 0.38, cy + r * 0.7)
        g.lineTo(cx - r * 0.38, cy + r * 0.7)
        g.closePath()
        g.fill()
        g.fillStyle = kind === 'cup' ? '#ff8fab' : '#8a5a3a'
        g.fillRect(cx - r * 0.44, cy - r * 0.1, r * 0.88, r * 0.5)
        g.fillStyle = ink
        if (kind === 'cup') g.fillRect(cx + r * 0.1, cy - r * 1.0, r * 0.08, r * 0.5)
        else g.fillRect(cx - r * 0.56, cy - r * 0.72, r * 1.12, r * 0.14)
      } else if (kind === 'phone' || kind === 'card') {
        const w = kind === 'phone' ? r * 0.9 : r * 1.5
        const h = kind === 'phone' ? r * 1.7 : r * 0.95
        roundRect(g, cx - w / 2, cy - h / 2, w, h, r * 0.14)
        g.fill()
        const gr = g.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
        gr.addColorStop(0, '#7fd0ff')
        gr.addColorStop(1, '#c77dff')
        g.fillStyle = gr
        if (kind === 'phone') roundRect(g, cx - w / 2 + r * 0.07, cy - h / 2 + r * 0.07, w - r * 0.14, h - r * 0.14, r * 0.1)
        else roundRect(g, cx - w / 2 + r * 0.1, cy - h * 0.1, w * 0.3, h * 0.24, r * 0.05)
        g.fill()
      } else if (kind === 'city') {
        for (let i = 0; i < 7; i++) {
          const bh = r * (0.6 + ((i * 37) % 9) / 9)
          g.fillRect(cx - r * 1.2 + i * r * 0.34, cy + r * 0.7 - bh, r * 0.26, bh)
        }
        g.fillStyle = '#ffd27a'
        g.beginPath()
        g.arc(cx + r * 0.8, cy - r * 0.6, r * 0.22, 0, Math.PI * 2)
        g.fill()
      } else if (kind === 'car') {
        g.fillStyle = '#2a3a4a'
        roundRect(g, cx - r * 1.2, cy - r * 0.1, r * 2.4, r * 0.55, r * 0.2)
        g.fill()
        roundRect(g, cx - r * 0.7, cy - r * 0.5, r * 1.3, r * 0.5, r * 0.25)
        g.fill()
        g.fillStyle = '#7fd0ff'
        roundRect(g, cx - r * 0.55, cy - r * 0.42, r * 1.0, r * 0.32, r * 0.14)
        g.fill()
        g.fillStyle = '#111'
        for (const sx of [-0.7, 0.7]) {
          g.beginPath()
          g.arc(cx + sx * r, cy + r * 0.48, r * 0.24, 0, Math.PI * 2)
          g.fill()
        }
      } else if (kind === 'pot') {
        g.fillStyle = '#2a2a2a'
        g.beginPath()
        g.ellipse(cx, cy + r * 0.2, r * 1.0, r * 0.5, 0, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#ff5a2a'
        g.beginPath()
        g.ellipse(cx, cy + r * 0.05, r * 0.86, r * 0.3, 0, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = 'rgba(255,255,255,.7)'
        for (const sx of [-0.4, 0, 0.4]) {
          g.beginPath()
          g.moveTo(cx + sx * r, cy - r * 0.2)
          g.quadraticCurveTo(cx + sx * r + r * 0.2, cy - r * 0.6, cx + sx * r, cy - r * 0.95)
          g.stroke()
        }
      } else if (kind === 'shoe') {
        g.beginPath()
        g.moveTo(cx - r, cy + r * 0.3)
        g.quadraticCurveTo(cx - r * 0.6, cy - r * 0.6, cx, cy - r * 0.3)
        g.quadraticCurveTo(cx + r * 0.6, cy - r * 0.1, cx + r, cy + r * 0.3)
        g.closePath()
        g.fill()
        g.fillStyle = ink
        g.fillRect(cx - r, cy + r * 0.3, r * 2, r * 0.16)
      } else if (kind === 'drop') {
        g.beginPath()
        g.moveTo(cx, cy - r)
        g.quadraticCurveTo(cx + r * 0.8, cy + r * 0.1, cx, cy + r * 0.7)
        g.quadraticCurveTo(cx - r * 0.8, cy + r * 0.1, cx, cy - r)
        g.fill()
      } else if (kind === 'mount') {
        g.beginPath()
        g.moveTo(cx - r * 1.1, cy + r * 0.6)
        g.lineTo(cx - r * 0.3, cy - r * 0.6)
        g.lineTo(cx + r * 0.2, cy)
        g.lineTo(cx + r * 0.5, cy - r * 0.3)
        g.lineTo(cx + r * 1.1, cy + r * 0.6)
        g.closePath()
        g.fill()
      } else if (kind === 'beer') {
        roundRect(g, cx - r * 0.3, cy - r * 0.6, r * 0.6, r * 1.4, r * 0.1)
        g.fill()
        g.fillRect(cx - r * 0.12, cy - r * 0.95, r * 0.24, r * 0.4)
        g.fillStyle = '#e8b020'
        g.fillRect(cx - r * 0.3, cy - r * 0.1, r * 0.6, r * 0.4)
      } else if (kind === 'mic') {
        g.beginPath()
        g.arc(cx, cy - r * 0.4, r * 0.38, 0, Math.PI * 2)
        g.fill()
        g.fillRect(cx - r * 0.1, cy - r * 0.05, r * 0.2, r * 0.9)
      } else {
        g.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5
          const rr2 = i % 2 ? r * 0.42 : r
          g.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2)
        }
        g.closePath()
        g.fill()
      }
      g.restore()
    }
    const fitFont = (txt, maxW, start, weight = 900) => {
      let fs = start
      do {
        g.font = `${weight} ${Math.round(fs)}px ${CN_FONT}`
        if (g.measureText(txt).width <= maxW) break
        fs -= 2
      } while (fs > 12)
      return fs
    }
    const drawAd = (x, y, w, h, [c0, c1, mot, head, sub, brand, ink], land) => {
      g.save()
      g.translate(x, y)
      const gr = g.createLinearGradient(0, 0, w, h)
      gr.addColorStop(0, c0)
      gr.addColorStop(1, c1)
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
      // 斜向光带 + 角落色块：画面有层次，不是一块平涂
      g.fillStyle = 'rgba(255,255,255,.12)'
      g.beginPath()
      g.moveTo(w * 0.55, 0)
      g.lineTo(w * 0.8, 0)
      g.lineTo(w * 0.45, h)
      g.lineTo(w * 0.2, h)
      g.fill()
      g.fillStyle = ink
      g.textBaseline = 'middle'
      g.textAlign = 'left'
      if (land) {
        motif(mot, w * 0.74, h * 0.5, h * 0.3, ink)
        fitFont(head, w * 0.52, h * 0.24)
        g.fillText(head, w * 0.06, h * 0.36)
        fitFont(sub, w * 0.52, h * 0.1, 600)
        g.fillText(sub, w * 0.06, h * 0.6)
        g.fillStyle = ink
        g.globalAlpha = 0.85
        fitFont(brand, w * 0.3, h * 0.09, 800)
        g.fillText(brand, w * 0.06, h * 0.84)
      } else {
        motif(mot, w * 0.5, h * 0.62, w * 0.3, ink)
        fitFont(head, w * 0.84, w * 0.32)
        g.textAlign = 'center'
        g.fillText(head, w * 0.5, h * 0.16)
        fitFont(sub, w * 0.84, w * 0.16, 600)
        g.fillText(sub, w * 0.5, h * 0.3)
        g.globalAlpha = 0.85
        fitFont(brand, w * 0.8, w * 0.12, 800)
        g.fillText(brand, w * 0.5, h * 0.9)
      }
      g.restore()
    }
    LAND.forEach((d, i) => drawAd((i % 2) * 1024, Math.floor(i / 2) * 512, 1024, 512, d, true))
    PORT.forEach((d, i) => drawAd(i * 256, 1536, 256, 512, d, false))

    const pos = []
    const uv = []
    const idx = []
    for (const a of AD_PLAN) {
      const { f } = a
      const tx = f.nz
      const tz = -f.nx
      const at2 = (u, o) => [f.x + tx * u + f.nx * o, f.z + tz * u + f.nz * o]
      // 边框 + 背板 + 顶部三盏射灯
      const [bx, bz] = at2(a.cx, 0.2)
      solid.box(f.nx === 0 ? a.w + 0.5 : 0.36, a.h + 0.5, f.nx === 0 ? 0.36 : a.w + 0.5, '#2a2a32', bx, a.y0 + a.h / 2, bz, 0)
      for (let k = 0; k < 3; k++) {
        const u = a.cx + (k - 1) * a.w * 0.33
        const [lx, lz] = at2(u, 0.9)
        const [ax2, az2] = at2(u, 0.55)
        solid.box(f.nx === 0 ? 0.08 : 0.7, 0.08, f.nx === 0 ? 0.7 : 0.08, '#3a3a40', ax2, a.y0 + a.h + 0.45, az2, 0)
        glow.box(f.nx === 0 ? 0.36 : 0.2, 0.14, f.nx === 0 ? 0.2 : 0.36, '#fff2d6', lx, a.y0 + a.h + 0.38, lz, 0)
      }
      // 画面
      const [sx, sy, sw, sh] = a.land ? [(a.d % 2) * 1024, Math.floor(a.d / 2) * 512, 1024, 512] : [a.d * 256, 1536, 256, 512]
      const [cx0, cz0] = at2(a.cx, 0.4)
      const base = pos.length / 3
      for (const [ux, uy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        pos.push(cx0 + (tx * ux * a.w) / 2, a.y0 + a.h / 2 + (uy * a.h) / 2, cz0 + (tz * ux * a.w) / 2)
        uv.push((sx + (ux > 0 ? sw : 0)) / AW, 1 - (sy + (uy > 0 ? 0 : sh)) / AW)
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
    if (pos.length) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      geo.setIndex(idx)
      const tex = new THREE.CanvasTexture(cv)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.92, 0.92, 0.92) }))
      m.frustumCulled = false
      scene.add(m)
    }
  }

  // 屋顶通信天线（几栋写字楼）
  for (const b of P.buildings) {
    if (b.kind !== 'office' && b.kind !== 'tower') continue
    if (P.mulberry32(Math.floor(b.x * 13 + b.z))() > 0.4) continue
    const y = P.groundY(b.x, b.z) + b.h
    props.cyl(0.12, 6, '#8f9aa4', b.x + 4, y, b.z + 4, 5)
    props.box(1.6, 0.1, 0.1, '#8f9aa4', b.x + 4, y + 5.2, b.z + 4, 0.4)
    glowProps.box(0.18, 0.18, 0.18, '#ff4a3a', b.x + 4, y + 6.1, b.z + 4, 0)
  }

  // 江堤：码头前的大台阶 + 堤顶栏杆 + 防汛墙 + 水位标尺 / 救生圈，全部沿弯曲的岸线
  const bank = new MeshBuilder()
  const ST = P.STEPS
  const inSteps = (x) => x > ST.x0 - 2 && x < ST.x1 + 2
  for (let x = ST.x0; x < ST.x1; x += 8) {
    const cx = x + 4
    const wn = P.waterN(cx)
    for (let i = 0; i < 6; i++) {
      const z = wn + P.BANK.beach + i * 1.8
      bank.box(8.05, 0.4, 1.9, '#8d9298', cx, P.baseY(cx, z) + 0.2, z, 0, { skipBottom: false })
    }
  }
  const railZ = (x) => P.waterN(x) + P.BANK.slope
  for (let x = P.CITY.x0; x <= P.CITY.x1; x += 2.4) {
    if (inSteps(x)) continue
    const z = railZ(x)
    const z2 = railZ(x + 2.4)
    const y = P.groundY(x, z)
    bank.box(0.12, 1.05, 0.12, '#7f8890', x, y + 0.75, z, 0)
    bank.box(2.4, 0.08, 0.1, '#9aa3aa', x + 1.2, y + 1.25, (z + z2) / 2, Math.atan2(z - z2, 2.4))
  }
  for (let x = P.CITY.x0; x <= P.CITY.x1; x += 6) {
    if (inSteps(x)) continue
    const z = railZ(x) + 1.6
    const z2 = railZ(x + 6) + 1.6
    bank.box(6.05, 0.5, 0.4, '#6a7078', x + 3, P.groundY(x + 3, z) + 0.25, (z + z2) / 2, Math.atan2(z - z2, 6))
  }
  for (const x of [-560, -150, 40, 250, 560]) {
    const z = railZ(x) + 3.4
    const y = P.groundY(x, z)
    bank.box(0.5, 3.2, 2.2, '#c6ccc8', x, y + 1.6, z, 0)
    for (let i = 0; i < 6; i++) bank.box(0.56, 0.06, 0.5, i % 2 ? '#2f4a63' : '#d8ddd6', x, y + 0.6 + i * 0.42, z - 0.9, 0)
    bank.cyl(0.05, 1.4, '#c8352a', x + 1.6, y + 0.9, railZ(x) - 0.4, 5)
    bank.cyl(0.34, 0.12, '#e8a23a', x + 1.6, y + 1.9, railZ(x) - 0.4, 8)
  }

  // 下沉广场：底面 + 南北两段台阶
  const pit = new MeshBuilder()
  {
    const SK = P.SUNKEN
    const cx = (SK.x0 + SK.x1) / 2
    const cz = (SK.z0 + SK.z1) / 2
    const pw = SK.x1 - SK.x0 - 4
    const pd = SK.z1 - SK.z0
    const py = P.groundY(cx, cz)
    pit.box(pw, 0.3, pd - 2, '#7d848c', cx, py + 0.1, cz, 0, { skipBottom: false })
    for (let i = 0; i < 5; i++) pit.box(pw, 0.34, 1.2, '#9aa1a8', cx, py + 0.3 + i * 0.9, SK.z1 - 2.6 + i * 0.5, 0, { skipBottom: false })
    for (let i = 0; i < 5; i++) pit.box(pw, 0.34, 1.2, '#9aa1a8', cx, py + 0.3 + i * 0.9, SK.z0 + 2.6 - i * 0.5, 0, { skipBottom: false })
  }

  await step('地标', 84)
  // ---------------------------------------------------------------- 摩天轮
  // 结构：混凝土基座 + 两榀 A 字支架 + 中心轴 + 双侧轮辐 + 外圈桁架 + 悬挂座舱
  const fw = P.FERRIS
  const fy = P.groundY(fw.x, fw.z)
  const hubY = fy + fw.r + 7.5
  const R = fw.r

  // 站台：整块抬起的地坪（轮子在里面转），上客雨棚放在轮盘外侧，
  // 不能压在轮盘平面上，否则吊舱会穿过棚顶。
  props.box(70, 0.42, 30, '#6e7378', fw.x, fy + 0.21, fw.z + 1, 0, { skipBottom: false })
  props.box(70, 0.12, 0.34, '#c9b98a', fw.x, fy + 0.48, fw.z + 16, 0, { skipBottom: false })
  props.box(70, 0.12, 0.34, '#c9b98a', fw.x, fy + 0.48, fw.z - 14, 0, { skipBottom: false })
  props.box(30, 0.12, 0.34, '#c9b98a', fw.x + 35, fy + 0.48, fw.z + 1, 0, { skipBottom: false })
  props.box(30, 0.12, 0.34, '#c9b98a', fw.x - 35, fy + 0.48, fw.z + 1, 0, { skipBottom: false })
  // 上客雨棚（轮盘外侧）
  const canopyZ = fw.z + 7.2
  props.box(21, 0.28, 6.4, '#8d949a', fw.x, fy + 4.3, canopyZ, 0)
  props.box(21.4, 0.16, 6.8, '#6f7a82', fw.x, fy + 4.5, canopyZ, 0)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) props.cyl(0.17, 4.3, '#6e7378', fw.x + sx * 9.6, fy + 0.42, canopyZ + sz * 2.6, 6)
  glow.box(20.2, 0.12, 0.16, '#ffe0b0', fw.x, fy + 4.1, canopyZ + 3.2, 0)
  glow.box(20.2, 0.12, 0.16, '#ffe0b0', fw.x, fy + 4.1, canopyZ - 3.2, 0)
  // 排队栏杆（矮栏板，给站台一点人味）
  for (let i = -3; i <= 3; i++) props.box(0.1, 0.9, 3.2, '#c8ccd0', fw.x + i * 2.4, fy + 0.9, canopyZ + 4.6, 0)
  props.box(17, 0.08, 0.08, '#c8ccd0', fw.x, fy + 1.35, canopyZ + 6.2, 0)
  // 售票亭
  props.box(5, 3.2, 3.4, '#cfc6b6', fw.x - 17.5, fy + 1.6, fw.z + 8.5, 0)
  props.box(5.8, 0.3, 4.0, '#8d8272', fw.x - 17.5, fy + 3.35, fw.z + 8.5, 0)
  glow.box(3.6, 1.2, 0.12, '#f2d9a8', fw.x - 17.5, fy + 1.9, fw.z + 10.25, 0)

  // ---------------------------------------------------------------- 杆件
  // 任意两点间的方杆。端点精确落在两点上，所以辐条、环、斜撑都能真正接上，
  // 不会出现「向心线断在中间」的观感。
  const bar3 = (Mb, a, b, w, col, w2) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const L = Math.hypot(d[0], d[1], d[2]) || 1
    const dir = [d[0] / L, d[1] / L, d[2] / L]
    const up = Math.abs(dir[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0]
    let sv = [dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2], dir[0] * up[1] - dir[1] * up[0]]
    const sl = Math.hypot(sv[0], sv[1], sv[2]) || 1
    const hw = w / 2
    const hh = (w2 === undefined ? w : w2) / 2
    const S = [(sv[0] / sl) * hw, (sv[1] / sl) * hw, (sv[2] / sl) * hw]
    const uv = [S[1] * dir[2] - S[2] * dir[1], S[2] * dir[0] - S[0] * dir[2], S[0] * dir[1] - S[1] * dir[0]]
    const ul = Math.hypot(uv[0], uv[1], uv[2]) || 1
    const U = [(uv[0] / ul) * hh, (uv[1] / ul) * hh, (uv[2] / ul) * hh]
    const off = [
      [-S[0] - U[0], -S[1] - U[1], -S[2] - U[2]],
      [S[0] - U[0], S[1] - U[1], S[2] - U[2]],
      [S[0] + U[0], S[1] + U[1], S[2] + U[2]],
      [-S[0] + U[0], -S[1] + U[1], -S[2] + U[2]],
    ]
    const A = off.map((o) => [a[0] + o[0], a[1] + o[1], a[2] + o[2]])
    const B = off.map((o) => [b[0] + o[0], b[1] + o[1], b[2] + o[2]])
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      const om = off[i]
      const ol = Math.hypot(om[0], om[1], om[2]) || 1
      Mb.quad(A[i], A[j], B[j], B[i], col, om[0] / ol, om[1] / ol, om[2] / ol)
    }
    Mb.quad(A[3], A[2], A[1], A[0], col, -dir[0], -dir[1], -dir[2])
    Mb.quad(B[0], B[1], B[2], B[3], col, dir[0], dir[1], dir[2])
  }

  /** 沿 Z 轴的鼓形（轮毂）：扇形端面 + 侧面。 */
  const drum = (Mb, r, z0, z1, seg, col) => {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2
      const a1 = ((i + 1) / seg) * Math.PI * 2
      const p0 = [Math.cos(a0) * r, Math.sin(a0) * r]
      const p1 = [Math.cos(a1) * r, Math.sin(a1) * r]
      const am = (a0 + a1) / 2
      Mb.quad([p0[0], p0[1], z0], [p1[0], p1[1], z0], [p1[0], p1[1], z1], [p0[0], p0[1], z1], col, Math.cos(am), Math.sin(am), 0)
      Mb.quad([0, 0, z0], [p1[0], p1[1], z0], [p0[0], p0[1], z0], [0, 0, z0], col, 0, 0, -1)
      Mb.quad([0, 0, z1], [p0[0], p0[1], z1], [p1[0], p1[1], z1], [0, 0, z1], col, 0, 0, 1)
    }
  }

  // ---------------------------------------------------------------- A 字支架
  // 两榀 A 架，一榀在轮子前面、一榀在后面；每榀两根腿在地面张开、在轴心收拢。
  const legR = R * 0.9
  const legZ = 10.5
  const hubZ = 4.5
  const legPt = (sx, sz, t) => [
    fw.x + sx * legR * (1 - t),
    fy + 0.4 + (hubY - fy - 0.4) * t,
    fw.z + sz * (legZ - (legZ - hubZ) * t),
  ]
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) props.box(3.6, 1.3, 3.6, '#79828a', fw.x + sx * legR, fy + 0.65, fw.z + sz * legZ, 0)
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) bar3(props, legPt(sx, sz, 0), legPt(sx, sz, 1), 1.35, '#a3adb4', 1.1)
    // 三道横撑（端点落在两腿中轴线上，接得死）
    for (const t of [0.3, 0.56, 0.82]) bar3(props, legPt(-1, sz, t), legPt(1, sz, t), 0.46, '#8d979f')
    // 交叉斜撑
    bar3(props, legPt(-1, sz, 0.02), legPt(1, sz, 0.56), 0.34, '#8d979f')
    bar3(props, legPt(1, sz, 0.02), legPt(-1, sz, 0.56), 0.34, '#8d979f')
    bar3(props, legPt(-1, sz, 0.58), legPt(1, sz, 0.82), 0.3, '#8d979f')
  }
  // 前后两榀之间的联系梁（沿 Z）
  for (const sx of [-1, 1])
    for (const t of [0.3, 0.82]) bar3(props, legPt(sx, -1, t), legPt(sx, 1, t), 0.42, '#87919a')
  // 轴心处的固定轴承座（不转）
  for (const sz of [-1, 1]) props.box(4.4, 2.4, 1.2, '#6f7a82', fw.x, hubY, fw.z + sz * 4.6, 0)

  // ---------------------------------------------------------------- 轮子
  // 局部坐标：原点是轴心，XY 是轮盘平面，Z 是轴的厚度方向。
  const wheel = new THREE.Group()
  wheel.position.set(fw.x, hubY, fw.z)
  const wheelGeo = new MeshBuilder(0.035)
  const wheelGlow = new MeshBuilder(0, LIT_SRC)
  const SPOKES = 20
  const SEG = 60          // 外圈的细分段数（每 ~6.7m 一节）
  const zF = 2.75
  const zB = -2.75
  const HOOP = R * 0.66

  // 主轴贯穿两榀支架，轮毂盘在轴上，辐条从盘面长出来
  drum(wheelGeo, 1.15, -4.9, 4.9, 12, '#77828a')
  drum(wheelGeo, 2.15, zF - 0.4, zF + 0.25, 16, '#9aa4ab')
  drum(wheelGeo, 2.15, zB - 0.25, zB + 0.4, 16, '#9aa4ab')
  drum(wheelGeo, 2.6, zF - 0.18, zF + 0.06, 16, '#b6c0c7')
  drum(wheelGeo, 2.6, zB - 0.06, zB + 0.18, 16, '#b6c0c7')
  wheelGlow.box(1.5, 0.34, 0.16, '#ffdca6', 0, 1.0, zF + 0.3, 0)

  /** 轮盘平面上的一点。 */
  const wpt = (a, r, z) => [Math.cos(a) * r, Math.sin(a) * r, z]

  // 1) 向心辐条：从轴心一直画到轮缘，两侧各一榀 —— 保证「向心线」是完整的一条
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * Math.PI * 2
    for (const z of [zF, zB]) {
      bar3(wheelGeo, [0, 0, z], wpt(a, R, z), 0.34, '#e6eef3', 0.3)
    }
  }

  // 2) 外圈：节点 + 弦杆（弦杆首尾相接，环永远闭合）
  const ringNodes = []
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2
    ringNodes.push(wpt(a, R, zF))
  }
  for (let i = 0; i < SEG; i++) {
    const p = ringNodes[i]
    const q = ringNodes[(i + 1) % SEG]
    bar3(wheelGeo, p, q, 0.5, '#dfe8ee', 0.46)
    bar3(wheelGeo, [p[0], p[1], zB], [q[0], q[1], zB], 0.5, '#dfe8ee', 0.46)
  }
  // 内外两圈之间的斜撑（隔一段一道，才是「W」而不是一团放射线）
  for (let i = 0; i < SEG; i += 2) {
    const a0 = (i / SEG) * Math.PI * 2
    const a1 = ((i + 1) / SEG) * Math.PI * 2
    bar3(wheelGeo, wpt(a0, HOOP, zF), wpt(a1, R * 0.995, zF), 0.2, '#b9c4cb', 0.18)
    bar3(wheelGeo, wpt(a0, HOOP, zB), wpt(a1, R * 0.995, zB), 0.2, '#b9c4cb', 0.18)
  }
  // 内圈（第二道环）
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI * 2
    const a1 = ((i + 1) / SEG) * Math.PI * 2
    bar3(wheelGeo, wpt(a0, HOOP, zF), wpt(a1, HOOP, zF), 0.34, '#cfd8de', 0.3)
    bar3(wheelGeo, wpt(a0, HOOP, zB), wpt(a1, HOOP, zB), 0.34, '#cfd8de', 0.3)
  }
  // 3) 前后两榀之间的横向拉杆（每 3 个节点一道）
  for (let i = 0; i < SEG; i += 3) {
    const a = (i / SEG) * Math.PI * 2
    bar3(wheelGeo, wpt(a, R, zB), wpt(a, R, zF), 0.26, '#b3bec6')
    bar3(wheelGeo, wpt(a, HOOP, zB), wpt(a, HOOP, zF), 0.2, '#b3bec6')
  }
  // 4) 轮缘节点块 + 灯
  for (let i = 0; i < SEG; i += 3) {
    const a = (i / SEG) * Math.PI * 2
    for (const z of [zF, zB]) {
      const p = wpt(a, R, z)
      wheelGeo.box(0.85, 0.85, 0.7, '#eef5f9', p[0], p[1], z, 0)
      const g2 = wpt(a, R, z + (z > 0 ? 0.45 : -0.45))
      wheelGlow.box(0.34, 0.34, 0.14, i % 6 === 0 ? '#ff9a72' : '#ffe3b8', g2[0], g2[1], g2[2], 0)
    }
  }
  // 辐条中段的销接点（结构感，也让辐条看起来「有节点、不是一根面条」）
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * Math.PI * 2
    for (const z of [zF, zB]) {
      for (const r of [R * 0.34, R * 0.62]) {
        const p = wpt(a, r, z)
        wheelGeo.box(0.56, 0.56, 0.56, '#f2f7fa', p[0], p[1], z, 0)
      }
    }
    // 前后辐条之间的连杆，让轮盘有厚度
    if (i % 2 === 0) {
      const p = wpt(a, R * 0.62, zF)
      const q = wpt(a, R * 0.62, zB)
      bar3(wheelGeo, p, q, 0.2, '#aeb9c1')
    }
  }

  wheel.add(new THREE.Mesh(wheelGeo.build(), litMat({ roughness: 0.6, side: THREE.DoubleSide })))
  const wheelHull = wheelGeo.buildHull()
  if (wheelHull)
    wheel.add(new THREE.Mesh(wheelHull, new THREE.MeshBasicMaterial({ color: new THREE.Color('#171226'), side: THREE.BackSide, toneMapped: false })))
  wheel.add(new THREE.Mesh(wheelGlow.build(), regNight(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), 0.15)))
  scene.add(wheel)

  // ---------------------------------------------------------------- 座舱
  // 挂在轮缘的销轴上，自身永不旋转（真实摩天轮的吊舱永远水平）。
  const cabins = new THREE.Group()
  cabins.position.set(fw.x, hubY, fw.z)
  scene.add(cabins)
  const CAB = 16
  const cabColors = ['#ff9f5a', '#63c8f0', '#f2789a', '#8fd8a4']
  for (let i = 0; i < CAB; i++) {
    const cb = new MeshBuilder(0.028)
    const col = cabColors[i % cabColors.length]
    // 吊臂 + 销轴
    cb.box(0.16, 1.5, 0.16, '#8a939a', 0, -0.75, 0, 0)
    cb.box(0.3, 0.3, 0.9, '#d8dee3', 0, 0, 0, 0)
    cb.box(1.7, 0.14, 0.14, '#8a939a', 0, -1.4, 0, 0)
    // 顶盖
    cb.box(2.25, 0.2, 2.1, '#e8eef2', 0, -1.55, 0, 0)
    cb.box(2.0, 0.3, 1.9, col, 0, -1.75, 0, 0)
    // 顶部/底部的横档：玻璃带被框在中间
    cb.box(2.1, 0.1, 2.0, '#e8eef2', 0, -1.86, 0, 0)
    cb.box(2.1, 0.1, 2.0, '#e8eef2', 0, -2.94, 0, 0)
    // 腰线 + 底盘
    cb.box(2.02, 0.44, 1.92, col, 0, -3.13, 0, 0)
    cb.box(2.16, 0.16, 2.02, '#5f676d', 0, -3.42, 0, 0)
    // 四个立角柱：舱体是「框」出来的，不是一块色块
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) cb.box(0.14, 1.16, 0.14, '#e8eef2', sx * 1.03, -2.4, sz * 0.98, 0)
    const m = new THREE.Mesh(cb.build(), litMat({ roughness: 0.7, metalness: 0.35 }))
    const hg2 = cb.buildHull()
    if (hg2) m.add(new THREE.Mesh(hg2, new THREE.MeshBasicMaterial({ color: new THREE.Color('#171226'), side: THREE.BackSide, toneMapped: false })))
    // 舱内灯：贴在玻璃带内侧
    const wg = new MeshBuilder(0, LIT_SRC)
    wg.box(2.06, 1.0, 1.96, i % 3 === 1 ? '#ffe6b6' : '#ffd79a', 0, -2.4, 0, 0)
    m.add(new THREE.Mesh(wg.build(), regNight(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), 0.5)))
    m.position.set(Math.cos((i / CAB) * Math.PI * 2) * R, Math.sin((i / CAB) * Math.PI * 2) * R, 0)
    cabins.add(m)
  }

  // 索道
  const cbl = P.CABLE
  const cg = new MeshBuilder()
  const mkStation = (s, name) => {
    const y = P.groundY(s.x, s.z)
    cg.box(16, 9, 12, '#c6d0d8', s.x, y + 4.5, s.z, 0)
    cg.box(18, 0.6, 14, '#8f9aa4', s.x, y + 9.3, s.z, 0)
    glow.box(14, 1.0, 0.3, '#ffd9a2', s.x, y + 8.2, s.z + 6.2, 0)
    doors.push({ x: s.x, z: s.z + 7, y, name, kind: 'cable', b: null })
  }
  mkStation(cbl.base, '索道山脚站')
  mkStation(cbl.top, '索道山顶站')
  for (const t of cbl.towers) {
    const y = P.groundY(t.x, t.z)
    cg.box(1.6, 22, 1.6, '#8f9aa4', t.x, y + 11, t.z, 0)
    cg.box(8, 0.8, 0.8, '#8f9aa4', t.x, y + 21, t.z, 0)
  }
  // 缆索与车厢在 life.js 里动

  // 人行天桥
  for (const br of P.BRIDGES) {
    const [ax, az] = br.a
    const [bx, bz] = br.b
    const mx = (ax + bx) / 2
    const mz = (az + bz) / 2
    const len = Math.hypot(bx - ax, bz - az)
    const y = P.groundY(mx, mz) + br.y
    const rot = Math.atan2(bx - ax, bz - az)
    cg.box(4.0, 0.5, len, '#b9c3cb', mx, y, mz, rot)
    for (const s of [-1, 1]) {
      cg.box(0.16, 1.1, len, '#d6dee6', mx + Math.cos(rot) * 2 * s, y + 0.8, mz - Math.sin(rot) * 2 * s, rot)
    }
    cg.box(6, 0.4, 10, '#c6d0d8', mx, y + 3.0, mz, rot)
    for (const p of [br.a, br.b]) {
      const sy = P.groundY(p[0], p[1])
      cg.cyl(0.5, br.y, '#8f9aa4', p[0], sy + 0.2, p[1], 8)
      cg.box(3.4, 0.4, 6, '#b9c3cb', p[0], sy + 3.2, p[1], rot)
    }
  }

  // 渡轮码头
  const dy = P.groundY(P.DOCK.x, P.DOCK.z)
  cg.box(18, 3.2, 7, '#c6d0d8', P.DOCK.x, dy + 1.6, P.DOCK.z, 0)
  cg.box(2.2, 0.3, 26, '#8f9aa4', P.DOCK.x, dy + 0.6, P.DOCK.z - 13, 0)
  for (let i = 0; i < 6; i++) cg.box(0.16, 1.0, 0.16, '#7f8890', P.DOCK.x - 0.8 + (i % 2) * 1.6, dy + 1.1, P.DOCK.z - 2 - i * 4, 0)
  doors.push({ x: P.DOCK.x, z: P.DOCK.z + 4.2, y: dy, name: '渡轮码头', kind: 'ferry', b: null })

  // 山体步道 / 观景台 / 小庙
  const mg = new MeshBuilder()
  const TP = P.TEMPLE
  // 观景台：小庙西侧的山肩上
  const lx = TP.x - 70
  const lz = TP.z - 30
  const top = P.groundY(lx, lz)
  mg.box(20, 0.4, 14, '#8a8c86', lx, top + 0.2, lz, 0, { skipBottom: false })
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mg.box(0.14, 1.0, 0.14, '#7f8890', lx + sx * 9.6, top + 0.9, lz + sz * 6.6, 0)
  // 石阶山道：环城路北 → 小庙，之字形
  const trail = (x0, z0, x1, z1, n, amp) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const z = P.lerp(z0, z1, t)
      const x = P.lerp(x0, x1, t) + Math.sin(i * 0.5) * amp
      const y = P.groundY(x, z)
      mg.box(3.0, 0.3, 1.4, '#9a9c94', x, y + 0.2, z, 0, { skipBottom: false })
    }
  }
  trail(TP.x, P.CITY.z1 + 18, TP.x, TP.z - 8, 40, 14)
  trail(lx, P.CITY.z1 + 18, lx, lz - 8, 30, 10)
  for (let i = 0; i < 3; i++) {
    const x = TP.x - 16 + i * 14
    const z = P.CITY.z1 + 40 + i * 26
    const y = P.groundY(x, z)
    mg.box(6, 0.3, 6, '#8a8c86', x, y + 0.2, z, 0, { skipBottom: false })
    mg.box(0.14, 1.0, 0.14, '#7f8890', x - 2.6, y + 0.7, z - 2.6, 0)
    mg.box(0.14, 1.0, 0.14, '#7f8890', x + 2.6, y + 0.7, z - 2.6, 0)
  }
  const templeY = P.groundY(TP.x, TP.z)
  mg.box(14, 0.8, 12, '#8a8c86', TP.x, templeY + 0.2, TP.z, 0, { skipBottom: false })
  mg.box(9, 4, 7, '#9c5a3a', TP.x, templeY + 2, TP.z, 0)
  mg.box(11, 0.6, 9, '#6d4128', TP.x, templeY + 4.4, TP.z, 0)
  mg.cone(7.4, 3.4, '#7a4a2e', TP.x, templeY + 4.6, TP.z, 4)
  glow.box(1.2, 1.6, 0.1, '#ffcf8a', TP.x, templeY + 1.4, TP.z - 3.55, 0)

  addSplit(park.build(), propMat)
  addSplit(bank.build(), propMat)
  addSplit(pit.build(), propMat)
  addSplit(cg.build(), propMat)
  addSplit(mg.build(), propMat)
  addSplit(props.build(), propMat)
  addSplit(glowProps.build(), regNight(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), 0.15))
  // 招牌/霓虹/灯箱：颜色乘到 1 以上，只让它们越过 bloom 阈值，窗光不外溢
  // 白天几乎熄灭：俯视不能留一城霓虹/灯带彩点
  addSplit(bright.build(), regNight(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(1.85, 1.85, 1.85) }), 0.04))
  // 店内：不吃场景光，直接按颜色自发光（雨夜便利店的店里就是这个观感）
  // 0.82：室内有灯就够了，不用再乘溢出的亮度（之前 1.16 直接把货架洗白）
  {
    const ig = inner.build()
    const nA = ig.attributes.normal
    const cA = ig.attributes.color
    const pA = ig.attributes.position
    let gx = NaN
    let gz = NaN
    let gy = 0
    for (let i = 0; i < cA.count; i++) {
      const ny = nA.getY(i)
      let f = ny > 0.5 ? 1.0 : ny < -0.5 ? 0.62 : 0.74 + 0.16 * Math.abs(nA.getZ(i))
      const x = pA.getX(i)
      const z = pA.getZ(i)
      if (Math.abs(x - gx) > 4 || Math.abs(z - gz) > 4) {
        gx = x
        gz = z
        gy = P.groundY(x, z)
      }
      const t = Math.min(1, Math.max(0, (pA.getY(i) - gy) / 2.9))
      f *= 0.7 + 0.36 * t
      cA.setXYZ(i, cA.getX(i) * f, cA.getY(i) * f, cA.getZ(i) * f)
    }
    cA.needsUpdate = true
    addSplit(ig, regNight(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(1.08, 1.04, 0.96) }), 0.6))
  }
  const innerHotMat = regNight(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(0.98, 0.96, 0.92) }), 0.6)
  innerHotMat.polygonOffset = true
  innerHotMat.polygonOffsetFactor = -2
  innerHotMat.polygonOffsetUnits = -4
  addSplit(innerHot.build(), innerHotMat)

  // 描边：体块放大壳 + BackSide，只留下轮廓那一圈，和「雨夜便利店」同一个做法
  const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#171226'), side: THREE.BackSide, toneMapped: false })
  for (const Mb of [solid, props, shopB, trim]) {
    const hg = Mb.buildHull()
    if (!hg) continue
    addSplit(hg, lineMat, { order: 0 })
  }

  await step('山林', 90)
  // ---------------------------------------------------------------- 北山森林
  // 一整片针叶 + 阔叶混交林，偶尔几棵秋色树；山顶岩石带留空。合成一个网格，一次画完。
  {
    const forest = new MeshBuilder()
    const fr = P.mulberry32(5150)
    const PINE = ['#3f6a44', '#36603e', '#4a7a4a', '#2f5638']
    const LEAF = ['#5a8a4e', '#6a9a52', '#4f7f48', '#d98a3a', '#c8603a', '#e0b04a']
    for (let k = 0; k < 3200; k++) {
      const x = -850 + fr() * 1700
      const z = P.CITY.z1 + 20 + fr() * 330
      if (Math.abs(x - P.CABLE.base.x) < 9 && z < P.CABLE.top.z + 6) continue
      if (Math.hypot(x - P.TEMPLE.x, z - P.TEMPLE.z) < 16 || Math.hypot(x - P.TEMPLE.x + 70, z - P.TEMPLE.z + 30) < 14) continue
      if (P.nearCreek(x, z, 2)) continue
      const y = P.groundY(x, z)
      if (y - 6 > 70) continue
      const s = 0.8 + fr() * 0.9
      if (fr() < 0.62) {
        forest.cyl(0.22 * s, 1.4 * s, '#5a4632', x, y - 0.2, z, 5)
        forest.cone(1.7 * s, 3.6 * s, PINE[Math.floor(fr() * PINE.length)], x, y + 1.0 * s, z, 6)
        forest.cone(1.25 * s, 2.8 * s, PINE[Math.floor(fr() * PINE.length)], x, y + 2.9 * s, z, 6)
      } else {
        forest.cyl(0.22 * s, 2.0 * s, '#5a4632', x, y - 0.2, z, 5)
        const c = fr() < 0.86 ? LEAF[Math.floor(fr() * 3)] : LEAF[3 + Math.floor(fr() * 3)]
        forest.sphere(1.9 * s, c, x, y + 3.2 * s, z, 6, 4)
        forest.sphere(1.3 * s, shade(c, 1.08), x + 0.8 * s, y + 3.9 * s, z - 0.5 * s, 5, 3)
      }
    }
    // 山顶几块裸岩
    for (let k = 0; k < 160; k++) {
      const x = -820 + fr() * 1640
      const z = 560 + fr() * 220
      const y = P.groundY(x, z)
      if (y - 6 < 56) continue
      forest.sphere(2 + fr() * 3, fr() < 0.5 ? '#9a8c78' : '#8a7e6c', x, y, z, 5, 3)
    }
    addSplit(forest.build(), propMat, { receive: true })
  }

  await step('人流', 95)
  // ---------------------------------------------------------------- 会动的小东西
  // 灯笼 / 布旗 / 猫各一个 InstancedMesh，每帧只改矩阵。轴心都放在悬挂点，摆起来才像挂着的。
  const _am = new THREE.Matrix4()
  const _aq = new THREE.Quaternion()
  const _ae = new THREE.Euler()
  const _ap = new THREE.Vector3()
  const _as = new THREE.Vector3(1, 1, 1)
  const _ac = new THREE.Color()
  const instanced = (geo, mat, list, colorOf) => {
    if (!list.length) return null
    const m = new THREE.InstancedMesh(geo, mat, list.length)
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    list.forEach((it, i) => {
      if (colorOf) m.setColorAt(i, _ac.set(colorOf(it)))
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.frustumCulled = false
    scene.add(m)
    return m
  }

  const lanternGeo = (() => {
    const lb = new MeshBuilder(0, LIT_SRC)
    lb.cyl(0.012, 0.16, '#2a2622', 0, -0.16, 0, 4)
    lb.cyl(0.13, 0.06, '#2a2018', 0, -0.22, 0, 8)
    lb.sphere(0.26, '#ffffff', 0, -0.5, 0, 10, 6)
    lb.cyl(0.13, 0.06, '#2a2018', 0, -0.8, 0, 8)
    lb.box(0.03, 0.22, 0.03, '#ffd166', 0, -0.96, 0, 0)
    const g = lb.build()
    g.scale(1, 1.15, 1)
    return g
  })()
  const lanterns = instanced(
    lanternGeo,
    regNight(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }), 0.3),
    swing.lanterns,
    (l) => l.c
  )

  const flagGeo = new THREE.PlaneGeometry(0.55, 1.7)
  flagGeo.translate(0.3, -0.85, 0)
  const flagMat = litMat({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide })
  const flags = instanced(flagGeo, flagMat, swing.flags, (f) => f.c)

  const catGeo = (() => {
    const cb = new MeshBuilder()
    cb.box(0.26, 0.24, 0.4, '#ffffff', 0, 0.12, 0, 0)
    cb.box(0.22, 0.2, 0.2, '#ffffff', 0, 0.32, 0.18, 0)
    for (const s of [-1, 1]) cb.cone(0.05, 0.1, '#ffffff', s * 0.06, 0.42, 0.18, 4)
    cb.box(0.05, 0.05, 0.3, '#ffffff', 0.06, 0.2, -0.3, 0)
    for (const s of [-1, 1]) cb.box(0.04, 0.04, 0.02, '#ffe66b', s * 0.05, 0.34, 0.285, 0)
    return cb.build()
  })()
  const cats = instanced(catGeo, litMat({ roughness: 0.9 }), swing.cats, (c) => c.c)

  // 航空障碍灯：不写进合并网格，单独一个 InstancedMesh，每盏按自己的相位闪
  const beacons = beaconPos.length
    ? instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ff3b30', toneMapped: false }), beaconPos, () => '#ff3b30')
    : null
  if (beacons) {
    beaconPos.forEach((p, i) => {
      _am.compose(_ap.set(p[0], p[1], p[2]), _aq.identity(), _as.set(1.7, 1.7, 1.7))
      beacons.setMatrixAt(i, _am)
    })
    beacons.instanceMatrix.needsUpdate = true
  }

  // 会亮会灭的窗：一层加法贴片，按各自相位开关，整座城的灯不再是一张固定的图
  const liveWin = (() => {
    if (!LIVE_WIN.length) return null
    const geo = new THREE.PlaneGeometry(1, 1)
    const mat = regNight(new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }), 0.01)
    const m = new THREE.InstancedMesh(geo, mat, LIVE_WIN.length)
    m.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    const q = new THREE.Quaternion()
    const p3 = new THREE.Vector3()
    const s3 = new THREE.Vector3()
    const mx = new THREE.Matrix4()
    const c = new THREE.Color()
    const up = new THREE.Vector3(0, 1, 0)
    // 后亮起来的窗也守功能色：住宅暖黄、办公冷白、商业霓虹
    const TONE_COL = {
      warm: ['#ffb050', '#ffc878', '#ffe0a8'],
      cool: ['#d8e8ff', '#c8daf0'],
      neon: ['#ffb050', '#8ec8ff'],
    }
    LIVE_WIN.forEach((w, i) => {
      const pal = TONE_COL[w.tone] || TONE_COL.warm
      w.tint = c.set(pal[i % pal.length]).clone()
      q.setFromAxisAngle(up, Math.atan2(w.f.nx, w.f.nz))
      p3.set(w.f.x + w.f.nx * 0.055 + w.f.nz * w.cx, w.y + w.h / 2, w.f.z + w.f.nz * 0.055 - w.f.nx * w.cx)
      s3.set(w.w, w.h, 1)
      mx.compose(p3, q, s3)
      m.setMatrixAt(i, mx)
      m.setColorAt(i, c.set('#000000'))
    })
    m.instanceMatrix.needsUpdate = true
    m.instanceColor.needsUpdate = true
    m.frustumCulled = false
    scene.add(m)
    return m
  })()
  // 每帧只更新一小片（全城扫一遍约 0.4 秒），CPU 几乎为零
  let liveCursor = 0
  const LIVE_SWEEP = 340
  const liveColor = new THREE.Color()

  const anim = {
    update(time) {
      if (liveWin) {
        const n = LIVE_WIN.length
        for (let k = 0; k < LIVE_SWEEP; k++) {
          const i = (liveCursor + k) % n
          const w = LIVE_WIN[i]
          const s2 = Math.sin(time * w.rate + w.ph) * 0.5 + 0.5
          // 只在周期的后半段亮：大部分时间这扇窗是暗的，亮起来才显眼
          const b = Math.max(0, Math.min(1, (s2 - 0.72) / 0.14))
          liveColor.copy(w.tint).multiplyScalar(b * 0.7)
          liveWin.setColorAt(i, liveColor)
        }
        liveCursor = (liveCursor + LIVE_SWEEP) % n
        liveWin.instanceColor.needsUpdate = true
      }
      if (beacons) {
        beaconPos.forEach((p, i) => {
          // 1.2 秒一周期、亮暗各半：远看就是城市剪影上几点红色呼吸
          const k = 0.35 + 0.65 * Math.max(0, Math.sin(time * 2.6 + i * 1.7))
          _am.compose(_ap.set(p[0], p[1], p[2]), _aq.identity(), _as.set(k * 2.4, k * 2.4, k * 2.4))
          beacons.setMatrixAt(i, _am)
        })
        _as.set(1, 1, 1)
        beacons.instanceMatrix.needsUpdate = true
      }
      if (lanterns) {
        swing.lanterns.forEach((l, i) => {
          _ae.set(Math.sin(time * 1.1 + l.ph) * 0.08, 0, Math.sin(time * 1.4 + l.ph) * 0.1)
          _am.compose(_ap.set(l.x, l.y, l.z), _aq.setFromEuler(_ae), _as)
          lanterns.setMatrixAt(i, _am)
        })
        lanterns.instanceMatrix.needsUpdate = true
      }
      if (flags) {
        swing.flags.forEach((f, i) => {
          _ae.set(0, f.rot + Math.sin(time * 1.6 + f.ph) * 0.28, Math.sin(time * 2.3 + f.ph) * 0.03)
          _am.compose(_ap.set(f.x, f.y, f.z), _aq.setFromEuler(_ae), _as)
          flags.setMatrixAt(i, _am)
        })
        flags.instanceMatrix.needsUpdate = true
      }
      if (cats) {
        swing.cats.forEach((c, i) => {
          const breathe = 1 + Math.sin(time * 2 + c.ph) * 0.03
          _ae.set(0, c.ry + Math.sin(time * 0.4 + c.ph) * 0.5, 0)
          _am.compose(_ap.set(c.x, c.y, c.z), _aq.setFromEuler(_ae), _as.set(1, breathe, 1))
          cats.setMatrixAt(i, _am)
        })
        _as.set(1, 1, 1)
        cats.instanceMatrix.needsUpdate = true
      }
    },
  }
  anim.update(0)

  // 合并网格
  const solidMat = litMat({ roughness: 0.78, envMapIntensity: 1.35 })
  const glassMat = litMat({ transparent: true, opacity: 0.88, roughness: 0.28, metalness: 0.12, envMapIntensity: 1.7 })
  // 暖窗略提亮；霓虹同桶，bloom 吃这层
  const glowMat = regNight(new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    color: new THREE.Color(1.2, 1.08, 0.92),
    transparent: true,
    opacity: 1,
  }), 0)
  glowMat.polygonOffset = true
  glowMat.polygonOffsetFactor = -3
  glowMat.polygonOffsetUnits = -6
  glowMat.userData.dayHide = true
  const mMesh = addMesh(solid, solidMat)
  addMesh(shopB, solidMat)
  addMesh(trim, solidMat)
  const gMesh = addMesh(glass, glassMat, false)
  const lMesh = addMesh(glow, glowMat, false)
  mMesh.name = 'solid'
  gMesh.name = 'glass'
  lMesh.name = 'glow'

  return { colliders, doors, wheel, cabins, ferris: { x: fw.x, z: fw.z, y: hubY, r: R, n: CAB }, signs: signMeshes, solidMat, glowMat, wetMat, anim, nightMats }
}
