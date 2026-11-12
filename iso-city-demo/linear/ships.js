import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SURFACE } from './spec.js'
import * as Mat from './mat.js'

/**
 * t33/t34 河上的大船（移植 googie/district.js 的 shipHull 放样船体 + taperBand 水线色带 + 各船型细节，按 linear 河道尺度缩小）：
 *  · 邮轮 / 集装箱船 / 汽车渡轮 / 运砂驳船（带吊机）—— 停泊在桥与桥之间、两条航道中间的空档（x≈±29.6），只轻微起伏横摇；
 *  · 拖轮 / 帆船 / 快艇 / 渔船 —— 在空档里慢速绕小椭圆漂航，不穿桥（帆船桅杆比桥洞高）。
 * 每条船所有不透明零件合并成一个顶点色几何 + 一个玻璃几何（夜里亮窗）→ 每船 2 个 draw；离相机 1600m 外不画。
 * 船体坐标：放样时沿 +x 为船艏（与 Googie 相同），合并后整体转到 +z 为船艏。
 */
const WATER_Y = SURFACE - 6
const C = {
  white: '#f6f4ee', ivory: '#ece6d8', navy: '#1f3a5a', wine: '#9a3a34', teal: '#2fa39a', coral: '#f07a5a',
  yellow: '#f2c14e', teak: '#b08a5a', silver: '#c8ced4', dark: '#2a2c30', grey: '#8a949c', blue: '#2f6fb0',
  red: '#c8402e', orange: '#f08a2a', sand: '#d8b878', black: '#1c1e22', green: '#3f8a5a', pool: '#4fb8d8', sky: '#9fd0e8',
}
const CONT = ['#c8402e', '#2f6fb0', '#f2c14e', '#3f8a5a', '#e8e4da', '#f07a5a', '#2fa39a', '#7a4a8a', '#8a949c', '#d8602a']

function kit() {
  const solid = []
  const glass = []
  const tmpM = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const add = (geo, col, glassy) => {
    let g = geo.index ? geo.toNonIndexed() : geo
    if (g !== geo) geo.dispose()
    g.deleteAttribute('uv')
    const c = new THREE.Color(col)
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3))
    ;(glassy ? glass : solid).push(g)
  }
  const place = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
    e.set(rx, ry, rz)
    q.setFromEuler(e)
    tmpM.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1))
    geo.applyMatrix4(tmpM)
    return geo
  }
  const K = {
    box(sx, sy, sz, col, x, y, z, rot = [0, 0, 0], gl = false) {
      add(place(new THREE.BoxGeometry(sx, sy, sz), x, y, z, ...rot), col, gl)
    },
    cyl(rt, rb, h, col, x, y, z, seg = 12, rot = [0, 0, 0], gl = false) {
      add(place(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, ...rot), col, gl)
    },
    sphere(r, col, x, y, z, sc = [1, 1, 1]) {
      const g = new THREE.SphereGeometry(r, 12, 8)
      g.scale(...sc)
      add(place(g, x, y, z), col)
    },
    torus(r, t, col, x, y, z, rot = [0, 0, 0]) {
      add(place(new THREE.TorusGeometry(r, t, 6, 16), x, y, z, ...rot), col)
    },
    /** 双面三角（帆） */
    tri(a, b, c, col) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3))
      g.computeVertexNormals()
      add(g, col)
    },
    /** Googie shipHull 放样：截面宽度系数 wf（艏部余弦收窄、艉部轻收）+ 舷弧，返回截面表供色带/栏杆贴合 */
    hull(o) {
      const L = o.len, B = o.beam, D = o.depth
      const draft = o.draft ?? 2
      const bowStart = o.bowStart ?? 0.66
      const sheer = o.sheer ?? 0.1
      const N = o.segN ?? 30, P = o.segP ?? 12
      const sec = []
      for (let i = 0; i <= N; i++) {
        const t = i / N
        let wf = 1
        if (t > bowStart) {
          const u = (t - bowStart) / (1 - bowStart)
          wf = Math.pow(Math.cos(u * Math.PI / 2), 0.55)
        } else if (t < 0.1) wf = 1 - 0.3 * Math.pow(1 - t / 0.1, 1.7)
        const top = D * (1 + sheer * Math.pow(Math.abs(t - 0.5) * 2, 2.4) * (t > 0.5 ? 1.6 : 0.6))
        sec.push({ x: -L / 2 + t * L, wf, top })
      }
      const pos = []
      const idx = []
      const grid = []
      for (let i = 0; i <= N; i++) {
        const s = sec[i]
        const row = []
        for (let j = 0; j <= P; j++) {
          const th = (j / P) * Math.PI
          const z = (B / 2) * s.wf * Math.sign(Math.cos(th) || 1) * Math.pow(Math.abs(Math.cos(th)), 0.62)
          const y = s.top - (s.top + draft) * Math.pow(Math.sin(th), 1.35)
          row.push(pos.length / 3)
          pos.push(s.x, y, z)
        }
        grid.push(row)
      }
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < P; j++) {
          const a = grid[i][j], b = grid[i][j + 1], c = grid[i + 1][j], d = grid[i + 1][j + 1]
          idx.push(a, c, b, b, c, d)
        }
        idx.push(grid[i][0], grid[i + 1][0], grid[i + 1][P])
        idx.push(grid[i][0], grid[i + 1][P], grid[i][P])
      }
      const s0 = sec[0]
      const center = pos.length / 3
      pos.push(s0.x, s0.top - (s0.top + draft) * 0.45, 0)
      for (let j = 0; j < P; j++) idx.push(grid[0][j], center, grid[0][j + 1])
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setIndex(idx)
      geo.computeVertexNormals()
      add(geo, o.col)
      // 甲板面（船体顶面颜色另铺）
      if (o.deck) K.band(sec, B, 0, 0, o.deck, -0.4, true)
      return sec
    },
    /** Googie taperBand：沿收窄轮廓的横向色带（水线漆 / 舷墙 / 甲板） */
    band(sec, B, y, h, col, over = 0.06, onDeck = false) {
      for (let i = 0; i < sec.length - 1; i++) {
        const s0 = sec[i], s1 = sec[i + 1]
        const w = Math.max(s0.wf, s1.wf) * B + over * 2
        const yy = onDeck ? (s0.top + s1.top) / 2 + 0.06 : y
        K.box(s1.x - s0.x + 0.05, onDeck ? 0.12 : h, Math.max(0.2, w), col, (s0.x + s1.x) / 2, yy, 0)
      }
    },
    /** 沿船体收窄的栏杆 */
    rail(sec, B, side, inset = 0.4) {
      for (let i = 0; i < sec.length - 1; i += 1) {
        const a = sec[i], b = sec[i + 1]
        const za = side * Math.max(0.5, a.wf * B / 2 - inset), zb = side * Math.max(0.5, b.wf * B / 2 - inset)
        const len = Math.hypot(b.x - a.x, zb - za)
        const ang = Math.atan2(zb - za, b.x - a.x)
        const y = (a.top + b.top) / 2 + 1.0
        K.box(len, 0.08, 0.08, C.silver, (a.x + b.x) / 2, y, (za + zb) / 2, [0, -ang, 0])
        if (i % 2 === 0) K.box(0.07, 1.0, 0.07, C.silver, a.x, a.top + 0.5, za)
      }
    },
    /** 一层上层建筑：白色楼板 + 连续玻璃带 + 竖向分隔 + 可选阳台隔板 */
    deck(x, y, len, beam, h, o = {}) {
      K.box(len, h, beam, o.col || C.white, x, y + h / 2, 0)
      for (const sz of [-1, 1]) {
        K.box(len - 1.2, h * 0.46, 0.1, C.dark, x, y + h * 0.56, sz * (beam / 2 + 0.02), [0, 0, 0], true)
        if (o.balcony) {
          for (let px = x - len / 2 + 1.5; px < x + len / 2 - 1; px += o.cell || 3.2) K.box(0.12, h * 0.6, 1.0, C.white, px, y + h * 0.34, sz * (beam / 2 + 0.5))
          K.box(len, 0.1, 0.12, C.silver, x, y + h * 0.36, sz * (beam / 2 + 1.0))
        }
      }
      for (const sx of [-1, 1]) K.box(0.1, h * 0.46, beam - 1.2, C.dark, x + sx * (len / 2 + 0.02), y + h * 0.56, 0, [0, 0, 0], true)
      K.box(len + 0.4, 0.22, beam + (o.balcony ? 2.2 : 0.4), C.silver, x, y + h + 0.05, 0)
    },
    /** 救生艇（橙色艇身 + 白顶 + 吊艇架） */
    lifeboat(x, y, z, s, L = 6) {
      K.sphere(1, C.orange, x, y, z, [L / 2, 0.75, 1.2])
      K.sphere(1, C.white, x, y + 0.55, z, [L / 2 - 0.4, 0.5, 1.0])
      for (const dx of [-L / 2 + 0.8, L / 2 - 0.8]) K.box(0.18, 2.2, 0.18, C.silver, x + dx, y + 0.3, z - s * 0.8, [s * 0.35, 0, 0])
    },
    build(glassMat, solidMat) {
      const g = new THREE.Group()
      if (solid.length) {
        const geo = mergeGeometries(solid, false)
        geo.rotateY(-Math.PI / 2)
        g.add(new THREE.Mesh(geo, solidMat))
      }
      if (glass.length) {
        const geo = mergeGeometries(glass, false)
        geo.rotateY(-Math.PI / 2)
        g.add(new THREE.Mesh(geo, glassMat))
      }
      for (const a of solid) a.dispose()
      for (const a of glass) a.dispose()
      return g
    },
  }
  return K
}

/* ---------------- 船型（沿 +x 为艏） ---------------- */

function cruise(K, rng) {
  const L = 150, B = 22, D = 7
  const sec = K.hull({ len: L, beam: B, depth: D, draft: 2.6, col: C.white, sheer: 0.09, segN: 40, segP: 14, deck: C.teak })
  K.band(sec, B, 0.25, 0.6, C.wine, 0.08)
  K.band(sec, B, 1.0, 0.7, C.navy, 0.1)
  K.band(sec, B, 4.6, 0.35, C.navy, 0.08)
  for (const yy of [2.6, 5.8]) K.band(sec, B, yy, 0.05, C.silver, 0.02)
  // 舷窗两排
  for (let px = -L / 2 + 12; px < L / 2 - 14; px += 2.6) for (const sz of [-1, 1]) {
    K.box(0.9, 0.6, 0.1, C.dark, px, 3.2, sz * (B / 2 + 0.02), [0, 0, 0], true)
    K.box(0.8, 0.5, 0.1, C.dark, px, 5.3, sz * (B / 2 + 0.02), [0, 0, 0], true)
  }
  K.sphere(1, C.navy, L / 2 - 4, -0.8, 0, [3.4, 1.4, 1.8]) // 球鼻艏
  for (const sz of [-1, 1]) K.rail(sec, B, sz)
  // 上层建筑逐层收进（Googie 11 层 → 这里 8 层）
  const CX = -6
  const decks = [[110, 20.4, 3, 0], [106, 20, 2.8, 1], [102, 19.6, 2.8, 1], [96, 19, 2.8, 1], [88, 18.2, 2.8, 1], [76, 17, 2.8, 1], [58, 15, 2.8, 0], [36, 12, 2.6, 0]]
  let y = D
  for (const [len, beam, h, bal] of decks) {
    K.deck(CX, y, len, beam - (bal ? 2.2 : 0), h, { balcony: !!bal, cell: 3 })
    y += h + 0.22
  }
  // 救生艇（两舷各 6 艘，挂在第一层外）
  for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) K.lifeboat(CX - 42 + i * 15, D + 2.2, sz * (B / 2 - 0.2), sz)
  // 艏部观景厅前倾玻璃 + 驾驶台两翼
  K.box(10, 3, 16, C.dark, CX + 58, D + 1.6, 0, [0, 0, 0], true)
  K.box(3, 1.6, B + 2, C.white, CX + 50, D + 3 * 3 + 1.2, 0)
  K.box(0.2, 1.0, B + 1.6, C.dark, CX + 51.6, D + 3 * 3 + 1.4, 0, [0, 0, 0], true)
  // 顶层泳池 + 滑梯 + 遮阳伞
  const top = y
  K.box(14, 0.3, 7, C.pool, CX - 20, top - 0.05, 0)
  K.box(14.6, 0.5, 7.6, C.white, CX - 20, top - 0.3, 0)
  K.torus(3.2, 0.45, C.coral, CX - 32, top + 3.2, 3, [Math.PI / 2, 0, 0])
  K.box(0.5, 6, 0.5, C.coral, CX - 34, top + 3, 0)
  for (let i = 0; i < 6; i++) {
    const ux = CX - 6 + (i % 3) * 5, uz = i < 3 ? -4 : 4
    K.cyl(0.05, 1.6, 0.5, [C.coral, C.yellow, C.teal][i % 3], ux, top + 2.2, uz, 10)
    K.box(0.06, 2.2, 0.06, C.silver, ux, top + 1.1, uz)
  }
  // Googie 斜削烟囱：青色筒身 + 珊瑚色顶带 + 黑顶
  K.box(10, 9, 5.6, C.teal, CX - 40, top + 4, 0, [0, 0, 0.22])
  K.box(10.3, 1.4, 5.9, C.coral, CX - 41, top + 8.4, 0, [0, 0, 0.22])
  K.box(10.4, 0.5, 6, C.black, CX - 41.4, top + 9.3, 0, [0, 0, 0.22])
  K.sphere(1, C.white, CX - 30, top + 2, 0, [5, 3.2, 4.2]) // 雷达球罩 / 观景穹
  K.box(0.4, 7, 0.4, C.silver, CX + 30, top + 3.5, 0) // 雷达桅
  K.box(4, 0.2, 0.3, C.silver, CX + 30, top + 6.6, 0)
  void rng
}

function container(K, rng) {
  const L = 160, B = 24, D = 8
  const sec = K.hull({ len: L, beam: B, depth: D, draft: 3, col: C.navy, bowStart: 0.72, sheer: 0.08, segN: 36, segP: 12, deck: C.grey })
  K.band(sec, B, 0.3, 1.2, C.red, 0.08)
  K.band(sec, B, 1.4, 0.25, C.white, 0.1)
  for (const sz of [-1, 1]) K.rail(sec, B, sz, 0.3)
  // 艉部生活楼（6 层，白色 + 玻璃带）+ 驾驶台两翼 + 烟囱
  const AX = -L / 2 + 14
  let y = D
  for (let i = 0; i < 6; i++) { K.deck(AX, y, 12, 18 - i * 0.4, 2.8); y += 3.0 }
  K.box(4, 1.4, B + 1, C.white, AX + 4, y - 1.2, 0)
  K.box(0.15, 0.9, B, C.dark, AX + 6, y - 1.0, 0, [0, 0, 0], true)
  K.box(5, 7, 4.5, C.red, AX - 6, y + 1.5, 0)
  K.box(5.2, 1.0, 4.7, C.black, AX - 6, y + 5.3, 0)
  K.box(0.3, 6, 0.3, C.silver, AX + 1, y + 3, 0)
  // 集装箱舱位：10 列 × 8 排 × 2–5 层，随机彩色箱
  for (let bay = 0; bay < 10; bay++) {
    const bx = AX + 14 + bay * 12.6
    if (bx > L / 2 - 18) break
    const rows = bx > L / 2 - 34 ? 6 : 8
    const tiers = 2 + Math.floor(rng() * 4)
    for (let r = 0; r < rows; r++) {
      const bz = (r - (rows - 1) / 2) * 2.55
      const tt = Math.max(1, tiers - (r === 0 || r === rows - 1 ? 1 : 0) - (rng() < 0.2 ? 1 : 0))
      for (let t = 0; t < tt; t++) K.box(12.1, 2.5, 2.4, CONT[Math.floor(rng() * CONT.length)], bx, D + 0.15 + 1.25 + t * 2.6, bz)
    }
    K.box(0.4, 6, B - 3, C.grey, bx - 6.6, D + 3, 0) // 绑扎桥
  }
  K.box(6, 2.4, B * 0.6, C.navy, L / 2 - 8, D + 1.5, 0) // 艏楼防浪板
  for (const sz of [-1, 1]) K.cyl(0.6, 0.6, 1, C.black, L / 2 - 10, D + 0.6, sz * 4, 10)
}

function carFerry(K) {
  const L = 84, B = 16, D = 5
  const sec = K.hull({ len: L, beam: B, depth: D, draft: 2, col: C.white, bowStart: 0.7, sheer: 0.06, segN: 30, segP: 12, deck: C.grey })
  K.band(sec, B, 0.3, 0.8, C.blue, 0.08)
  K.band(sec, B, 3.2, 0.7, C.blue, 0.08)
  K.band(sec, B, 4.2, 0.25, C.yellow, 0.08)
  // 车辆甲板 + 客舱三层（Googie 渡轮：长玻璃带 + 圆角端）
  K.box(L - 16, 4.2, B - 0.6, C.white, -4, D + 2.1, 0)
  for (const sz of [-1, 1]) for (let px = -40; px < 32; px += 6) K.box(4.6, 2.2, 0.1, C.dark, px, D + 2.3, sz * (B / 2 - 0.25), [0, 0, 0], true)
  K.deck(-2, D + 4.3, 54, B - 1, 3, {})
  K.deck(2, D + 7.5, 36, B - 2.4, 2.8, {})
  K.cyl(B / 2 - 1.2, B / 2 - 1.2, 2.8, C.white, 20, D + 7.5 + 1.4, 0, 20)
  K.deck(6, D + 10.5, 14, B - 4, 2.4, {})
  K.box(3, 1.2, B + 1.6, C.white, 12, D + 12.3, 0)
  for (const sz of [-1, 1]) K.box(3.2, 6, 2.2, C.yellow, -16, D + 10.6 + 3, sz * 3.2, [0, 0, 0.15])
  for (const sz of [-1, 1]) K.box(3.3, 0.8, 2.3, C.black, -16.5, D + 10.6 + 6.1, sz * 3.2, [0, 0, 0.15])
  K.box(0.4, 7, B - 3, C.dark, -L / 2 + 0.6, D + 2.5, 0) // 艉门
  K.box(4, 3.5, B * 0.5, C.white, L / 2 - 6, D + 1.4, 0, [0, 0, -0.25]) // 艏门罩
  K.lifeboat(-6, D + 6.5, B / 2 - 0.6, 1, 5)
  K.lifeboat(-6, D + 6.5, -B / 2 + 0.6, -1, 5)
}

function sandBarge(K, rng) {
  const L = 70, B = 14, D = 3.4
  const sec = K.hull({ len: L, beam: B, depth: D, draft: 1.8, col: C.dark, bowStart: 0.85, sheer: 0.04, segN: 20, segP: 8, deck: C.grey })
  K.band(sec, B, 0.3, 0.6, C.wine, 0.06)
  K.band(sec, B, D - 0.4, 0.4, C.orange, 0.08)
  // 料舱围壁 + 砂堆（阶梯叠出的缓坡）
  const HX = 4
  K.box(46, 1.6, 0.4, C.grey, HX, D + 0.8, B / 2 - 1)
  K.box(46, 1.6, 0.4, C.grey, HX, D + 0.8, -B / 2 + 1)
  for (let i = 0; i < 4; i++) {
    const k = 1 - i * 0.22
    K.box(44 * k, 0.9, (B - 2.6) * (0.98 - i * 0.2), C.sand, HX + (rng() - 0.5) * 3, D + 0.5 + i * 0.85, 0)
  }
  K.sphere(1, C.sand, HX - 8, D + 3.4, 0, [6, 1.6, 3.2])
  K.sphere(1, C.sand, HX + 10, D + 3.0, 0.6, [5, 1.3, 3])
  // 艉部驾驶室
  K.deck(-L / 2 + 7, D, 7, 9, 2.6, { col: C.ivory })
  K.deck(-L / 2 + 7, D + 2.9, 5, 7, 2.2, { col: C.ivory })
  K.box(0.3, 3, 0.3, C.silver, -L / 2 + 6, D + 6.6, 0)
  // 吊机：底座 + 回转台 + 斜臂 + 抓斗
  const cx = L / 2 - 12
  K.cyl(1.4, 1.6, 3, C.yellow, cx, D + 1.5, 0, 12)
  K.box(4, 2.4, 3.2, C.yellow, cx, D + 4.2, 0)
  K.box(0.6, 1.2, 1.2, C.dark, cx + 1.6, D + 4.6, 1.0, [0, 0, 0], true)
  K.box(22, 0.8, 0.8, C.yellow, cx - 9, D + 10, 0, [0, 0, -0.55])
  K.box(0.06, 8, 0.06, C.dark, cx - 18.5, D + 10.5, 0)
  K.box(2, 1.4, 2, C.dark, cx - 18.5, D + 6, 0)
}

function tug(K) {
  const L = 22, B = 8, D = 2.8
  const sec = K.hull({ len: L, beam: B, depth: D, draft: 1.6, col: C.red, bowStart: 0.6, sheer: 0.14, segN: 18, segP: 10, deck: C.grey })
  K.band(sec, B, D - 0.4, 0.7, C.black, 0.35) // 橡胶护舷
  K.band(sec, B, 0.4, 0.5, C.dark, 0.06)
  K.deck(1, D, 8, 5.6, 2.4, { col: C.white })
  K.deck(2, D + 2.6, 4.6, 4.6, 2.0, { col: C.white })
  K.box(1.6, 3.4, 1.6, C.yellow, -2.2, D + 4.6, 0)
  K.box(1.7, 0.5, 1.7, C.black, -2.2, D + 6.4, 0)
  K.box(0.2, 3, 0.2, C.silver, 3, D + 6, 0)
  K.cyl(0.5, 0.5, 0.9, C.dark, -7, D + 0.45, 0, 8)
}

function sail(K) {
  const L = 14, B = 4.2, D = 1.4
  const sec = K.hull({ len: L, beam: B, depth: D, draft: 1.2, col: C.white, bowStart: 0.55, sheer: 0.12, segN: 16, segP: 10, deck: C.teak })
  K.band(sec, B, 0.3, 0.25, C.navy, 0.04)
  K.box(4, 0.8, 2.2, C.white, -1, D + 0.4, 0)
  K.box(3.6, 0.3, 0.06, C.dark, -1, D + 0.55, 1.12, [0, 0, 0], true)
  K.box(0.2, 15, 0.2, C.silver, 0.8, D + 7.5, 0)
  K.box(6, 0.14, 0.14, C.silver, -2.2, D + 1.8, 0)
  K.tri([0.7, D + 1.9, 0], [0.7, D + 14.6, 0], [-5.2, D + 1.9, 0], '#f8f6f0')
  K.tri([0.9, D + 13.6, 0], [L / 2 - 0.4, D + 0.6, 0], [0.9, D + 1.4, 0], '#f2e8d2')
}

function speedboat(K) {
  const L = 9, B = 2.8, D = 1.0
  const sec = K.hull({ len: L, beam: B, depth: D, draft: 0.6, col: C.white, bowStart: 0.5, sheer: 0.2, segN: 14, segP: 8, deck: C.ivory })
  K.band(sec, B, 0.5, 0.25, C.coral, 0.04)
  K.box(1.2, 0.6, B - 0.6, C.dark, 0.6, D + 0.4, 0, [0, 0, -0.5], true)
  K.box(2.2, 0.5, B - 0.8, C.teak, -1.6, D + 0.3, 0)
  K.box(0.8, 0.9, 0.8, C.dark, -L / 2 - 0.2, D - 0.2, 0)
}

function fishing(K) {
  const L = 16, B = 5, D = 1.8
  const sec = K.hull({ len: L, beam: B, depth: D, draft: 1.2, col: C.blue, bowStart: 0.6, sheer: 0.16, segN: 16, segP: 10, deck: C.grey })
  K.band(sec, B, 0.3, 0.4, C.wine, 0.05)
  K.band(sec, B, D - 0.2, 0.3, C.white, 0.06)
  K.deck(3, D, 4, 3.6, 2.2, { col: C.white })
  K.box(0.15, 5, 0.15, C.silver, 1, D + 4.5, 0)
  // 艉部 A 字吊架 + 渔网卷筒 + 橙色浮球
  for (const sz of [-1, 1]) K.box(0.25, 4, 0.25, C.orange, -L / 2 + 1.2, D + 2, sz * 1.8, [sz * 0.25, 0, 0])
  K.box(0.3, 0.3, 3.4, C.orange, -L / 2 + 1.2, D + 3.9, 0)
  K.cyl(0.8, 0.8, 2.6, C.green, -3, D + 0.9, 0, 10, [Math.PI / 2, 0, 0])
  for (let i = 0; i < 5; i++) K.sphere(0.25, C.orange, -5 + i * 0.7, D + 0.25, 1.6)
}

const TYPES = { cruise, container, carFerry, sandBarge, tug, sail, speedboat, fishing }

/**
 * @param {THREE.Group} root 挂到 boats 根节点
 * @param {() => number} rng
 */
export function buildShips(root, rng) {
  const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.08, envMapIntensity: 0.7 })
  Mat.registerMaterial(solidMat)
  Mat.tactile(solidMat, 0.8) // t35 船壳漆面颗粒 + 斑驳 + 光泽差
  const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.4, emissive: '#ffd8a0', emissiveIntensity: 0, envMapIntensity: 1.0 })
  Mat.registerMaterial(glassMat)
  Mat.registerNight(glassMat, 0, 0.9)
  const ships = []
  const mk = (type, x, z, yaw, drift) => {
    const K = kit()
    TYPES[type](K, rng)
    const g = K.build(glassMat, solidMat)
    g.name = `ship-${type}`
    g.position.set(x, WATER_Y, z)
    g.rotation.y = yaw
    g.userData = { x, z, yaw, drift, ph: rng() * 10, big: !drift }
    root.add(g)
    ships.push(g)
  }
  // 停泊大船：桥 z = -1541 / -239 / 1235 之间，空档 x=±29.6
  mk('container', 29.6, -2000, Math.PI, null)
  mk('cruise', -29.6, -900, 0, null)
  mk('carFerry', 29.6, 480, Math.PI, null)
  mk('sandBarge', -29.6, 1800, 0, null)
  // 漂航小船：在空档里绕小椭圆（不过桥）
  const drift = [
    ['tug', -29.6, -1880, 120], ['sail', 29.6, -1100, 160], ['sail', -29.6, 300, 140], ['speedboat', 29.6, -600, 160],
    ['fishing', -29.6, 900, 140], ['tug', 29.6, 1700, 160], ['speedboat', -29.6, -1300, 120], ['fishing', 29.6, 2150, 90],
  ]
  for (const [type, x, z, R] of drift) mk(type, x, z, 0, { R, w: (type === 'speedboat' ? 0.05 : 0.018) * (rng() < 0.5 ? 1 : -1) })
  return (dt, t, cam) => {
    for (const s of ships) {
      const u = s.userData
      let x = u.x, z = u.z, yaw = u.yaw
      if (u.drift) {
        const a = t * u.drift.w + u.ph
        x = u.x + Math.sin(a) * 9
        z = u.z + Math.cos(a) * u.drift.R
        // 航向 = 轨迹切线
        const dx = Math.cos(a) * 9 * u.drift.w, dz = -Math.sin(a) * u.drift.R * u.drift.w
        yaw = Math.atan2(dx, dz)
      }
      if (cam) {
        const ex = x - cam.x, ey = WATER_Y - cam.y, ez = z - cam.z
        s.visible = ex * ex + ey * ey + ez * ez < 1600 * 1600
        if (!s.visible) continue
      }
      const amp = u.big ? 0.12 : 0.08
      s.position.set(x, WATER_Y + Math.sin(t * (u.big ? 0.5 : 1.2) + u.ph) * amp, z)
      s.rotation.set(Math.sin(t * 0.7 + u.ph * 1.3) * (u.big ? 0.003 : 0.01), yaw, Math.sin(t * 0.6 + u.ph) * (u.big ? 0.006 : 0.03))
    }
  }
}
