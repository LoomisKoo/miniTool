import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { installThemePark } from './themepark.js'

/**
 * t33 有辨识度的公共建筑 + 游乐场 + 机场：只用实例池（与 buildings.js 同一套 push / pushBuilding / claim / 碰撞）。
 * 每个类型在局部坐标系里写：x 沿临街面（-w/2..w/2），z 从临街前沿（-d/2）指向地块里侧（+d/2），y 为绝对高度。
 * 主体楼身走 pushBuilding（linear 自己的几何窗 + 逐层灯光 + 室内），异形件（壳、穹顶、尖塔、拱顶、塔身）走专用几何池。
 */
export function makeCivic(ctx) {
  const { LP, push, pushBuilding, addSolid, pad, villaTree, boards, billFrame, rng, range, S0, nextGrp, Mat, lotCar } = ctx
  const P0 = ctx.pools

  // ── 几何 ──
  const domeGeo = new THREE.SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  const sphGeo = new THREE.SphereGeometry(0.5, 20, 14)
  const coneGeo = new THREE.ConeGeometry(0.5, 1, 20)
  const pyrGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4)
  const octGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).rotateY(Math.PI / 8)
  const cylGeo = ctx.cylGeo
  const shellGeo = new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI, 0, Math.PI / 2)
  const vaultGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateY(Math.PI / 2)
  const fuseGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16).rotateX(Math.PI / 2)
  const noseGeo = new THREE.ConeGeometry(0.5, 1, 16).rotateX(Math.PI / 2)
  const torusGeo = new THREE.TorusGeometry(0.5, 0.025, 8, 56)
  const spokeGeo = mergeGeometries(Array.from({ length: 12 }, (_, k) => new THREE.BoxGeometry(1, 0.014, 0.014).rotateZ((k * Math.PI) / 12)))

  // ── 材质（v41 的鲜亮配色：白搪瓷 / 青绿 / 珊瑚 / 明黄 / 金；全部 lod 0，远看也有轮廓）──
  const L0 = (c, m, r, env, o = {}) => LP(c, m, r, env, { lod: 0, ...o })
  const cW = L0('#f4f1ea', 0.05, 0.42, 0.55)
  const cCream = L0('#efe1c4', 0.03, 0.8, 0.35)
  const cSand = L0('#e2b77e', 0.02, 0.85, 0.3)
  const cSteel = L0('#c9d1d8', 0.7, 0.3, 0.9)
  const cDark = L0('#3a3f46', 0.3, 0.6, 0.5)
  const cTeal = L0('#3fa39a', 0.3, 0.42, 0.7)
  const cCoral = L0('#e8735a', 0.05, 0.55, 0.5)
  const cYellow = L0('#f2c14e', 0.05, 0.5, 0.5)
  const cBlue = L0('#3f7fc0', 0.1, 0.5, 0.6)
  const cPurple = L0('#7a5aa0', 0.05, 0.6, 0.45)
  const cWater = L0('#2f9cc4', 0.1, 0.08, 1.2, { emissive: '#1d7fa8' })
  Mat.registerNight(cWater.mat, 0.12, 0.5)
  const cLit = L0('#fff4e0', 0, 0.4, 0.2, { emissive: '#ffe8c0' })
  Mat.registerNight(cLit.mat, 0.15, 2.2)
  const cIce = L0('#eef6fb', 0.05, 0.12, 1.0)
  const glass = P0.glassPortal
  const stone = P0.stoneStep
  const lawn = P0.lawn
  const pave = P0.pave
  const tarmac = P0.tarmac
  const red = P0.redWall
  const tile = P0.tileGrey
  const gold = P0.goldP
  const line = P0.lineW
  const G = (geo, c, m, r, env, o = {}) => L0(c, m, r, env, { geo, ...o })
  const domeW = G(domeGeo, '#f4f1ea', 0.05, 0.4, 0.6)
  const domeGold = G(domeGeo, '#d8b04a', 0.75, 0.3, 1.0)
  const domeCu = G(domeGeo, '#5fa89a', 0.4, 0.45, 0.7)
  const domeBlue = G(domeGeo, '#3d6fb0', 0.3, 0.4, 0.7)
  const sphGold = G(sphGeo, '#d8b04a', 0.75, 0.3, 1.0)
  const sphBlue = G(sphGeo, '#4a7ec8', 0.35, 0.35, 0.8)
  const sphW = G(sphGeo, '#f2f0ec', 0.2, 0.35, 0.7)
  const sphGlass = G(sphGeo, '#c96a8a', 0.55, 0.22, 1.1, { emissive: '#ffb0c8' })
  Mat.registerNight(sphGlass.mat, 0.05, 1.2)
  const coneGold = G(coneGeo, '#d8b04a', 0.75, 0.3, 1.0)
  const coneRed = G(coneGeo, '#c8543c', 0.05, 0.55, 0.45)
  const coneTeal = G(coneGeo, '#3fa39a', 0.3, 0.42, 0.7)
  const coneYel = G(coneGeo, '#f2c14e', 0.05, 0.5, 0.5)
  const conePur = G(coneGeo, '#5a4a8a', 0.1, 0.6, 0.5)
  const pyrGreen = G(pyrGeo, '#3f7a62', 0.35, 0.5, 0.6)
  const pyrStone = G(pyrGeo, '#e6dccb', 0.03, 0.75, 0.4)
  const octRed = G(octGeo, '#b8402e', 0.03, 0.8, 0.35)
  const octTile = G(octGeo, '#3f4a4a', 0.15, 0.6, 0.45)
  const cylW = G(cylGeo, '#f2efe8', 0.1, 0.4, 0.6)
  const cylSteel = G(cylGeo, '#c9d1d8', 0.7, 0.3, 0.9)
  const cylTeal = G(cylGeo, '#3fa39a', 0.3, 0.42, 0.7)
  const cylCoral = G(cylGeo, '#e8735a', 0.05, 0.55, 0.5)
  const cylYel = G(cylGeo, '#f2c14e', 0.05, 0.5, 0.5)
  const cylPur = G(cylGeo, '#7a5aa0', 0.05, 0.6, 0.45)
  const cylGlass = G(cylGeo, '#8fb6c8', 0.45, 0.14, 1.1, { emissive: '#ffe0b0' })
  Mat.registerNight(cylGlass.mat, 0.0, 0.9)
  const shellW = G(shellGeo, '#f6f4ee', 0.08, 0.3, 0.8)
  shellW.mat.side = THREE.DoubleSide
  const vaultW = G(vaultGeo, '#eef0f0', 0.25, 0.35, 0.8)
  const vaultGlass = G(vaultGeo, '#9fc4d4', 0.5, 0.15, 1.1, { emissive: '#ffe0b0' })
  Mat.registerNight(vaultGlass.mat, 0.0, 0.7)
  const vaultCu = G(vaultGeo, '#5fa89a', 0.4, 0.45, 0.7)
  const fuseW = G(fuseGeo, '#f4f4f2', 0.3, 0.3, 0.8)
  const noseW = G(noseGeo, '#f4f4f2', 0.3, 0.3, 0.8)
  const torCoral = G(torusGeo, '#e8735a', 0.4, 0.4, 0.6)
  const torTeal = G(torusGeo, '#3fa39a', 0.5, 0.35, 0.7)
  const spokeP = G(spokeGeo, '#f2efe8', 0.6, 0.35, 0.8)

  // ── 局部坐标系：f = 临街外法线 ──
  function frame(cx, cz, fx, fz) {
    const bx = -fx, bz = -fz
    const rx = bz, rz = -bx
    const yaw = Math.atan2(-rz, rx)
    const sw = Math.abs(rx) < 0.5
    const X = (lx, lz) => cx + lx * rx + lz * bx
    const Z = (lx, lz) => cz + lx * rz + lz * bz
    const F = {
      yaw, X, Z,
      B(pool, lx, y, lz, sx, sy, sz, ly = 0) { push(pool, X(lx, lz), y, Z(lx, lz), sx, sy, sz, yaw + ly) },
      /** 底面在 y0 的盒子（+ 碰撞） */
      K(pool, lx, y0, lz, sx, sy, sz, solid = true) {
        push(pool, X(lx, lz), y0 + sy / 2, Z(lx, lz), sx, sy, sz, yaw)
        if (solid) F.S(lx, lz, sx, sz, y0 + sy, y0)
      },
      S(lx, lz, w, d, top, base = S0) { addSolid(X(lx, lz), Z(lx, lz), sw ? d : w, sw ? w : d, top, base) },
      P(pool, lx, lz, w, d, top = 0.24, th = 0.2) { pad(pool, X(lx, lz), Z(lx, lz), sw ? d : w, sw ? w : d, top, th) },
      H(hex, style, lx, y0, lz, w, h, d) { pushBuilding(hex, style, X(lx, lz), y0 + h / 2, Z(lx, lz), sw ? d : w, h, sw ? w : d) },
      T(lx, lz, s = 1) { villaTree(X(lx, lz), Z(lx, lz), s) },
      sign(k, lx, y, lz, w) {
        if (!boards[k]) return
        push(boards[k], X(lx, lz), y, Z(lx, lz), w, w / 4, 0.25, yaw + Math.PI)
        push(billFrame, X(lx, lz + 0.22), y, Z(lx, lz + 0.22), w + 0.3, w / 4 + 0.3, 0.12, yaw)
      },
      /** 竖向圆柱/圆锥/球等（几何池以 y 为中心） */
      R(pool, lx, y0, lz, dia, h, dz = dia) { push(pool, X(lx, lz), y0 + h / 2, Z(lx, lz), dia, h, dz, yaw) },
      /** 穹顶：底面在 y0，高 h */
      D(pool, lx, y0, lz, dia, h) { push(pool, X(lx, lz), y0, Z(lx, lz), dia, h * 2, dia, yaw) },
    }
    return F
  }
  const S = S0
  // 树阵 / 草坪 / 灯
  function treeLine(F, x0, z0, x1, z1, step, s = 1) {
    const L = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.floor(L / step))
    for (let i = 0; i <= n; i++) F.T(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, s)
  }
  function lamp(F, x, z, h = 5) {
    F.K(cSteel, x, S, z, 0.18, h, 0.18, false)
    F.B(cLit, x, S + h + 0.2, z, 0.7, 0.4, 0.7)
  }
  function steps(F, z, w, n = 3, rise = 0.25, run = 1.4) {
    for (let i = 0; i < n; i++) F.K(stone, 0, S, z + i * run, w - i * 2, rise * (i + 1), run, false)
  }
  /** 门前广场：铺地 + 两侧树阵 + 灯 */
  function forecourt(F, w, d, z0, z1) {
    F.P(pave, 0, (z0 + z1) / 2, w, z1 - z0, 0.26, 0.2)
    for (const s of [-1, 1]) {
      treeLine(F, s * (w / 2 - 4), z0 + 4, s * (w / 2 - 4), z1 - 4, 9, 0.95)
      lamp(F, s * w * 0.25, z0 + 6)
    }
  }
  const wall4 = (F, pool, w, d, z, h = 3.2, t = 0.8, gate = 10) => {
    F.K(pool, -(w + gate) / 4 - 0, S, z - d / 2, (w - gate) / 2, h, t)
    F.K(pool, (w + gate) / 4, S, z - d / 2, (w - gate) / 2, h, t)
    F.K(pool, 0, S, z + d / 2, w, h, t)
    for (const s of [-1, 1]) F.K(pool, s * w / 2, S, z, t, h, d)
  }
  function flags(F, z, w, n) {
    const cols = [cCoral, cTeal, cYellow, cBlue, cPurple]
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * w / n
      F.K(cSteel, x, S, z, 0.16, 12, 0.16, false)
      F.B(cols[i % cols.length], x + 1.1, S + 11, z, 2.0, 1.3, 0.05)
    }
  }

  // ══════════ 各类型 ══════════
  const B = {}

  // 歌剧院：石台基 + 大台阶 + 两组白色帆壳（悉尼式，开口朝前）+ 玻璃前厅 + 两侧水池
  B.opera = (F, w, d) => {
    forecourt(F, w, d, -d / 2, -d / 2 + 30)
    const pz0 = -d / 2 + 30
    const pd = d - 34
    const pzc = pz0 + pd / 2
    F.K(stone, 0, S, pzc, w - 30, 6, pd)
    for (let i = 0; i < 6; i++) F.K(stone, 0, S, pz0 - 1.2 * (6 - i), w * 0.5, 1 * (i + 1), 1.2, false)
    const top = S + 6
    F.K(glass, 0, top, pzc + 4, w - 60, 9, pd - 24)
    for (const [hx, sc] of [[-(w - 30) * 0.22, 1], [(w - 30) * 0.24, 0.78]]) {
      const shells = [[0, 36, 44, 30], [16, 30, 36, 26], [30, 22, 26, 20], [41, 14, 16, 14]]
      for (const [oz, hgt, sw, sdep] of shells) {
        const z = pz0 + 10 + oz * sc
        F.B(shellW, hx, top + 0.2, z, sw * sc, hgt * 2 * sc, sdep * 2 * sc)
        F.B(shellW, hx, top + 0.2, z + sdep * sc * 0.9, sw * 0.86 * sc, hgt * 1.6 * sc, sdep * 1.2 * sc, Math.PI)
        F.B(glass, hx, top + hgt * sc * 0.32, z + 0.4, sw * 0.6 * sc, hgt * sc * 0.62, 0.3)
      }
      F.S(hx, pz0 + 30 * sc, 44 * sc, 70 * sc, top + 36 * sc, top)
    }
    for (const s of [-1, 1]) F.P(cWater, s * (w / 2 - 10), pzc, 14, pd - 10, 0.3, 0.1)
    F.sign('opera', 0, S + 3.2, pz0 - 8.4, 18)
  }

  // 会展中心：长条主展厅 + 五道白色波浪拱顶 + 玻璃入口大厅 + 悬挑雨棚 + 旗阵
  B.expo = (F, w, d) => {
    forecourt(F, w, d, -d / 2, -d / 2 + 32)
    flags(F, -d / 2 + 26, w * 0.6, 12)
    const hz0 = -d / 2 + 40, hd = d - 46
    const hw = w - 20
    F.H('#e9eef2', 'podium', 0, S, hz0 + hd / 2, hw, 16, hd)
    const n = 5
    for (let i = 0; i < n; i++) {
      const vz = hz0 + (i + 0.5) * hd / n
      F.B(i % 2 ? vaultGlass : vaultW, 0, S + 16 + 1.8, vz, hw + 2, 16 + (i % 2) * 4, hd / n + 0.4)
    }
    F.S(0, hz0 + hd / 2, hw, hd, S + 28)
    F.K(glass, 0, S, hz0 - 6, 70, 20, 12)
    F.K(cW, 0, S + 20, hz0 - 10, 96, 1.2, 22, false)
    for (const s of [-1, 1]) {
      F.K(cSteel, s * 40, S, hz0 - 20, 0.8, 30, 0.8, false)
      for (let k = 0; k < 3; k++) F.B(cSteel, s * (40 - 6 - k * 8), S + 25 - k * 1.5, hz0 - 18, 14, 0.12, 0.12, s * 0.5)
    }
    F.sign('expo', 0, S + 24.5, hz0 - 21.4, 26)
  }

  // 当代美术馆：玻璃底座 + 两个错位悬挑的纯白盒子（无窗展厅）+ 一条通长窄窗 + 珊瑚色雕塑
  B.art = (F, w, d) => {
    forecourt(F, w, d, -d / 2, -d / 2 + 24)
    const zc = -d / 2 + 24 + (d - 24) / 2
    F.K(glass, -8, S, zc, 46, 7, 32)
    F.K(cW, 6, S + 7, zc - 4, 84, 13, 34)
    F.B(cDark, 6, S + 13.5, zc - 21.1, 70, 1.2, 0.2)
    F.K(cW, -10, S + 20, zc + 4, 58, 11, 26)
    F.B(cDark, -10, S + 25.5, zc - 9.1, 48, 0.9, 0.2)
    F.K(cSteel, -8, S + 31, zc + 4, 30, 0.6, 18, false)
    F.R(sphW, 26, S + 0.4, -d / 2 + 12, 7, 7)
    F.R(cylCoral, 26, S, -d / 2 + 12, 0.8, 4)
    F.R(sphGlass, -30, S + 2, -d / 2 + 12, 3.5, 3.5)
    F.sign('art', -8, S + 4.6, zc - 16.6, 14)
  }

  // 电视塔：裙房 + 渐收塔身 + 两个观光球 + 旋转餐厅圆盘 + 天线（variant 1 = 飞碟顶 Googie 版）
  B.tvtower = (F, w, d, v = 0) => {
    forecourt(F, w, d, -d / 2, -d / 2 + 18)
    const zc = 6
    F.R(cylGlass, 0, S, zc, 50, 8)
    F.R(cylW, 0, S + 8, zc, 52, 1.2)
    F.S(0, zc, 50, 50, S + 9.2)
    if (v === 0) {
      const segs = [[11, 60], [9, 50], [7, 50], [5, 60]]
      let y = S + 9
      for (const [r, h] of segs) { F.R(cylW, 0, y, zc, r * 2, h); y += h }
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2
        F.R(cylSteel, Math.cos(a) * 15, S + 9, zc + Math.sin(a) * 15, 5, 96)
      }
      F.R(sphGlass, 0, S + 96, zc, 34, 34)
      F.R(cylGlass, 0, S + 112, zc, 35, 2)
      F.R(cylW, 0, S + 170, zc, 34, 7)
      F.R(cylGlass, 0, S + 177, zc, 30, 4)
      F.R(cylW, 0, S + 181, zc, 32, 2)
      F.R(sphGlass, 0, S + 210, zc, 18, 18)
      F.R(cylSteel, 0, S + 229, zc, 2.4, 60)
      F.B(P0.beacon, 0, S + 290, zc, 1.4, 1.4, 1.4)
      F.S(0, zc, 22, 22, S + 230)
    } else {
      F.R(cylSteel, 0, S + 9, zc, 14, 130)
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.5
        F.R(cylW, Math.cos(a) * 9, S + 9, zc + Math.sin(a) * 9, 3.2, 128)
      }
      F.R(coneTeal, 0, S + 132, zc, 46, 10)
      F.R(cylW, 0, S + 137, zc, 50, 5)
      F.R(cylGlass, 0, S + 142, zc, 44, 5)
      F.R(cylW, 0, S + 147, zc, 50, 1.6)
      F.R(coneYel, 0, S + 148.6, zc, 20, 8)
      F.R(cylSteel, 0, S + 156, zc, 1.6, 34)
      F.B(P0.beacon, 0, S + 191, zc, 1.2, 1.2, 1.2)
      F.S(0, zc, 16, 16, S + 150)
    }
    F.sign('tvtower', 0, S + 4.5, zc - 25.4, 16)
  }

  // 邮政大楼：古典石楼 + 临街拱廊（柱列 + 檐口）+ 中轴钟楼（四面钟 + 绿铜方尖顶）
  B.postflag = (F, w, d) => {
    F.P(pave, 0, -d / 2 + 6, w, 12, 0.26)
    const bw = w - 14, bd = d - 26
    const bz = -d / 2 + 20 + bd / 2
    F.H('#e9dcc2', 'punch', 0, S, bz, bw, 24, bd)
    const az = bz - bd / 2 - 3.2
    for (let x = -bw / 2 + 1; x <= bw / 2 - 1; x += 5.6) F.K(cCream, x, S, az - 2.6, 1.3, 8, 1.3, false)
    F.K(cCream, 0, S + 8, az, bw + 1, 1.6, 7.2, false)
    F.K(cCream, 0, S + 9.6, az + 1, bw + 1.6, 0.6, 5)
    F.S(0, az, bw, 7, S + 9.6, S + 8)
    const tz = bz - bd / 2 + 6
    F.K(cCream, 0, S + 24, tz, 12, 26, 12)
    for (const [sx, sz, ly] of [[0, -6.05, 0], [0, 6.05, 0], [-6.05, 0, Math.PI / 2], [6.05, 0, Math.PI / 2]]) {
      F.B(cW, sx, S + 43, tz + sz, 7, 7, 0.2, ly)
      F.B(cDark, sx, S + 44, tz + sz * 1.006, 0.35, 2.6, 0.12, ly)
      F.B(cDark, sx + (ly ? 0 : 0.9), S + 43, tz + sz * 1.006, 1.8, 0.35, 0.12, ly)
    }
    F.K(cCream, 0, S + 50, tz, 13, 1.2, 13, false)
    F.R(pyrGreen, 0, S + 51.2, tz, 12.4, 10)
    F.R(cylSteel, 0, S + 61, tz, 0.3, 6)
    for (let i = 0; i < 4; i++) F.K(P0.mailGreen || cTeal, -12 + i * 8, S, -d / 2 + 4, 0.8, 1.4, 0.6, false)
    F.sign('post', 0, S + 12.5, az - 3.9, 18)
  }

  // 火车站：红砖候车大楼 + 钢玻璃拱顶大厅 + 两端钟塔 + 站台雨棚 + 轨道 + 停靠列车
  B.rail = (F, w, d) => {
    forecourt(F, w, d, -d / 2, -d / 2 + 30)
    F.P(tarmac, 0, -d / 2 + 22, w - 40, 7, 0.3)
    const hz = -d / 2 + 30 + 22
    const hw = w - 60
    F.H('#c8603a', 'punch', 0, S, hz, hw, 12, 40)
    F.B(vaultGlass, 0, S + 12.6, hz, hw - 6, 32, 38)
    for (let x = -hw / 2 + 8; x < hw / 2 - 4; x += 12) F.B(cSteel, x, S + 12.6 + 8, hz, 0.4, 16, 38.4)
    F.S(0, hz, hw, 40, S + 29)
    for (const s of [-1, 1]) {
      const tx = s * (hw / 2 + 8)
      F.K(cCream, tx, S, hz - 6, 12, 40, 12)
      F.B(cW, tx, S + 34, hz - 12.1, 5, 5, 0.2)
      F.R(pyrGreen, tx, S + 40, hz - 6, 12.6, 9)
    }
    F.K(glass, 0, S, hz - 22, 36, 10, 4)
    const pz0 = hz + 24
    for (let i = 0; i < 4; i++) {
      const z = pz0 + 6 + i * 10
      if (z > d / 2 - 4) break
      F.K(stone, 0, S, z, w - 20, 0.9, 4.5, false)
      for (let x = -w / 2 + 14; x < w / 2 - 10; x += 16) F.K(cSteel, x, S + 0.9, z, 0.35, 4.6, 0.35, false)
      F.K(cTeal, 0, S + 5.5, z, w - 22, 0.35, 6.5, false)
      F.P(cDark, 0, z + 5, w - 10, 3.6, 0.22, 0.1)
      for (const k of [-0.7, 0.7]) F.B(cSteel, 0, S + 0.32, z + 5 + k, w - 10, 0.15, 0.12)
      if (i % 2 === 0) {
        F.K(cW, -10, S + 0.5, z + 5, w * 0.6, 3.8, 3.2)
        F.B(cBlue, -10, S + 2.4, z + 5, w * 0.6 + 0.1, 0.6, 3.3)
        F.B(glass, -10, S + 3.2, z + 5, w * 0.58, 0.8, 3.25)
      }
    }
    F.sign('rail', 0, S + 13.6, hz - 20.6, 26)
  }

  // 高架站：轨道高架桥（墩柱）+ 站厅（白色拱顶 + 玻璃侧墙）+ 楼梯/扶梯 + 停靠的轻轨列车
  B.skyrail = (F, w, d) => {
    F.P(pave, 0, 0, w, d, 0.24)
    const zc = 4
    const H = 10
    for (let x = -w / 2 + 6; x <= w / 2 - 6; x += 15) F.K(stone, x, S, zc, 3, H, 3)
    F.K(stone, 0, S + H, zc, w - 4, 1.6, 16)
    const top = S + H + 1.6
    for (const k of [-3.5, 3.5]) {
      F.B(cDark, 0, top + 0.2, zc + k, w - 6, 0.3, 2.6)
      F.K(cW, k < 0 ? 14 : -14, top + 0.4, zc + k, 56, 3.6, 3)
      F.B(cTeal, k < 0 ? 14 : -14, top + 2.6, zc + k, 56.1, 0.5, 3.1)
      F.B(glass, k < 0 ? 14 : -14, top + 3.0, zc + k, 54, 0.7, 3.05)
    }
    F.K(glass, 0, top, zc, 70, 7, 1, false)
    for (const s of [-1, 1]) F.K(glass, 0, top, zc + s * 8, 70, 6, 0.3, false)
    F.B(vaultW, 0, top + 7, zc, 74, 8, 18)
    F.S(0, zc, 74, 18, top + 11, top)
    for (const s of [-1, 1]) {
      const sx = s * 30
      for (let i = 0; i < 18; i++) {
        const y = S + (i + 1) * (H + 1.6) / 18
        F.K(i % 2 ? stone : P0.treadP, sx, y - 0.3, zc - 9 - (i + 0.5) * 0.9 * (18 - i) / 18 - 1, 3, 0.3, 1, true)
      }
      F.K(cSteel, sx, S, zc - 10, 3.4, H + 1.6, 0.3, false)
    }
    F.sign('skyrail', 0, top + 4.5, zc - 8.5, 14)
  }

  // 游泳馆：玻璃幕馆身 + 三道起伏拱顶 + 门前室外泳池（泳道线）
  B.swim = (F, w, d) => {
    F.P(lawn, 0, 0, w, d, 0.3, 0.3)
    const bz = d / 2 - 34
    F.H('#bfe4ea', 'curtain', 0, S, bz, w - 16, 12, 56)
    for (let i = 0; i < 3; i++) F.B(i === 1 ? vaultGlass : vaultW, 0, S + 12.8, bz - 18 + i * 18, w - 14, 14 + (i === 1 ? 6 : 0), 19)
    F.S(0, bz, w - 16, 56, S + 22)
    const pz = -d / 2 + 18
    F.P(pave, 0, pz, 56, 24, 0.34, 0.12)
    F.B(cWater, 0, S + 0.36, pz, 50, 0.04, 18)
    for (let i = 1; i < 8; i++) F.B(line, -25 + i * 50 / 8 * 1, S + 0.4, pz, 0.15, 0.02, 17.5, 0)
    for (let i = 0; i < 6; i++) { F.B(cW, -20 + i * 8, S + 0.6, pz - 11.5, 1.8, 0.3, 0.8) }
    F.sign('swim', 0, S + 9, bz - 28.6, 16)
  }

  // 溜冰馆：钢构马鞍顶馆身 + 门前室外冰场（白冰面 + 蓝色界墙）
  B.ice = (F, w, d) => {
    F.P(pave, 0, 0, w, d, 0.24)
    const bz = d / 2 - 30
    F.H('#dfe9f2', 'podium', 0, S, bz, w - 14, 13, 52)
    F.B(vaultCu, 0, S + 13.6, bz, w - 10, 16, 54)
    F.S(0, bz, w - 14, 52, S + 21.6)
    const iz = -d / 2 + 16
    F.B(cIce, 0, S + 0.3, iz, 40, 0.12, 18)
    for (const s of [-1, 1]) { F.K(cBlue, 0, S, iz + s * 9.2, 40.4, 1.1, 0.25, false); F.K(cBlue, s * 20.2, S, iz, 0.25, 1.1, 18.4, false) }
    for (let i = 0; i < 6; i++) F.K(cCoral, -12 + i * 5, S + 0.36, iz + ((i % 3) - 1) * 4, 0.5, 1.6, 0.5, false)
    F.sign('ice', 0, S + 10, bz - 26.6, 16)
  }

  // 清真寺：院墙 + 礼拜大殿 + 金色大穹顶（鼓座）+ 四小穹 + 两座宣礼塔 + 院中水池
  B.mosque = (F, w, d) => {
    F.P(pave, 0, 0, w - 2, d - 2, 0.26)
    wall4(F, cCream, w - 4, d - 4, 0)
    F.K(cTeal, 0, S, -d / 2 + 2, 10, 9, 2.4)
    const hz = d / 2 - 26
    F.H('#f1ead8', 'punch', 0, S, hz, 44, 14, 34)
    F.R(cylW, 0, S + 14.6, hz, 22, 5)
    F.D(domeGold, 0, S + 19.6, hz, 24, 14)
    F.R(coneGold, 0, S + 33.4, hz, 1.2, 5)
    for (const [sx, sz] of [[-15, -11], [15, -11], [-15, 11], [15, 11]]) F.D(domeCu, sx, S + 14.6, hz + sz, 8, 5)
    for (const s of [-1, 1]) {
      const mx = s * (w / 2 - 9), mz = hz - 12
      F.R(cylW, mx, S, mz, 4.4, 44)
      F.R(cylW, mx, S + 30, mz, 6.4, 1.2)
      F.R(cylW, mx, S + 40, mz, 5.6, 1.0)
      F.R(coneGold, mx, S + 44, mz, 4.6, 8)
      F.S(mx, mz, 4.4, 4.4, S + 44)
    }
    F.P(cWater, 0, -d / 2 + 22, 16, 10, 0.34, 0.1)
    for (const s of [-1, 1]) F.T(s * 16, -d / 2 + 20, 0.9)
    F.sign('mosque', 0, S + 11, hz - 17.6, 14)
  }

  // 东正教堂：十字形白墙 + 鼓座 + 金色洋葱顶（球 + 尖锥 + 十字）+ 四角蓝色小洋葱顶 + 前钟楼
  B.orthodox = (F, w, d) => {
    F.P(lawn, 0, 0, w, d, 0.3, 0.3)
    F.P(pave, 0, -d / 2 + 10, 8, 20, 0.34, 0.12)
    const zc = 6
    F.H('#f3eee4', 'punch', 0, S, zc, 34, 15, 16)
    F.H('#f3eee4', 'punch', 0, S, zc, 16, 15, 36)
    F.R(cylW, 0, S + 16.5, zc, 11, 9)
    F.R(sphGold, 0, S + 24.5, zc, 13, 13)
    F.R(coneGold, 0, S + 30.5, zc, 3.4, 7)
    F.B(gold, 0, S + 36.5, zc, 0.35, 4, 0.35)
    F.B(gold, 0, S + 37.3, zc, 2.2, 0.35, 0.35)
    for (const [sx, sz] of [[-11, -4], [11, -4], [-11, 16], [11, 16]]) {
      F.R(cylW, sx, S + 16.5, zc + sz - 2, 4.6, 4)
      F.R(sphBlue, sx, S + 19.5, zc + sz - 2, 5.6, 6.4)
      F.R(coneGold, sx, S + 25.2, zc + sz - 2, 1.4, 2.6)
    }
    const bz = zc - 24
    F.K(cW, 0, S, bz, 8, 26, 8)
    F.R(sphBlue, 0, S + 25.5, bz, 7, 8)
    F.R(coneGold, 0, S + 32.5, bz, 1.6, 4)
    F.sign('orthodox', 0, S + 5, bz - 4.6, 7)
  }

  // 犹太会堂：沙色石墙 + 双塔（铜绿穹顶）+ 正立面大圆窗 + 庭院绿篱
  B.synagogue = (F, w, d) => {
    F.P(lawn, 0, 0, w, d, 0.3, 0.3)
    F.P(pave, 0, -d / 2 + 6, w - 10, 10, 0.34, 0.12)
    const zc = 4
    F.H('#e6d3b0', 'punch', 0, S, zc, 30, 15, 26)
    for (const s of [-1, 1]) {
      F.K(cSand, s * 13, S, zc - 13, 7, 24, 7)
      F.D(domeCu, s * 13, S + 24, zc - 13, 7.6, 5)
    }
    F.R(cylGlass, 0, S + 6, zc - 13.2, 7, 7, 0.4)
    F.K(cSand, 0, S, zc - 13.4, 10, 4.5, 0.6, false)
    for (let i = 0; i < 5; i++) F.B(P0.hedge || lawn, -16 + i * 8, S + 1, -d / 2 + 13, 5, 1.6, 1.4)
    F.sign('synagogue', 0, S + 17, zc - 13.6, 10)
  }

  // 印度教神庙：石台基 + 层层收分的锡卡拉高塔（暖砂色 + 珊瑚色节）+ 前殿柱廊 + 金顶
  B.hindu = (F, w, d) => {
    F.P(pave, 0, 0, w, d, 0.26)
    const zc = 8
    F.K(stone, 0, S, zc, 44, 2, 44)
    const top = S + 2
    let y = top
    for (let i = 0; i < 9; i++) {
      const s = 22 - i * 2.1
      const h = i === 0 ? 8 : 3.4
      F.K(i % 2 ? cCoral : cSand, 0, y, zc + 6, s, h, s)
      y += h
    }
    F.D(domeGold, 0, y, zc + 6, 6, 3)
    F.R(coneGold, 0, y + 3, zc + 6, 1.6, 4)
    F.K(cSand, 0, top, zc - 12, 20, 7, 14)
    for (let i = 0; i < 6; i++) F.K(cCream, -9 + i * 3.6, top, zc - 19.6, 0.9, 6, 0.9, false)
    F.K(cCoral, 0, top + 7, zc - 12, 22, 1.2, 16, false)
    let y2 = top + 8.2
    for (let i = 0; i < 4; i++) { F.K(i % 2 ? cCoral : cSand, 0, y2, zc - 12, 12 - i * 2.4, 2.6, 10 - i * 2), y2 += 2.6 }
    for (let i = 0; i < 3; i++) F.K(stone, 0, S, zc - 22 - 1.2 * (3 - i), 12, 0.7 * (i + 1), 1.2, false)
    F.sign('hindu', 0, top + 9, zc - 19.4, 10)
  }

  // 七级佛塔：石台基 + 七层八角塔身（红墙 + 黛瓦出檐，逐层收分）+ 金刹 + 院内香炉/树
  B.pagoda = (F, w, d) => {
    F.P(pave, 0, 0, w, d, 0.26)
    wall4(F, red, w - 4, d - 4, 0, 3.4, 0.9, 12)
    const zc = 6
    F.R(octTile, 0, S, zc, 26, 2.4)
    let y = S + 2.4
    for (let i = 0; i < 7; i++) {
      const r = 16 - i * 1.5
      const h = i === 0 ? 6.4 : 4.6
      F.R(octRed, 0, y, zc, r, h)
      F.R(octTile, 0, y + h, zc, r + 5.2, 0.8)
      F.R(octTile, 0, y + h + 0.8, zc, r + 2.4, 0.7)
      y += h + 1.5
    }
    F.R(coneGold, 0, y, zc, 4, 3)
    F.R(cylYel, 0, y + 3, zc, 0.8, 9)
    for (let k = 0; k < 5; k++) F.R(sphGold, 0, y + 4 + k * 1.6, zc, 2.2 - k * 0.25, 0.7)
    F.S(0, zc, 16, 16, y + 10)
    F.R(cylCoral, 0, S, -d / 2 + 16, 2.2, 1.6)
    for (const s of [-1, 1]) F.T(s * (w / 2 - 12), -d / 2 + 14, 1.0)
    F.sign('pagoda', 0, S + 5, -d / 2 + 1.2, 10)
  }

  // 孔庙：红墙围合 + 棂星门 + 泮池 + 重檐大成殿（黄琉璃坡顶 ×2）+ 东西庑 + 古柏
  B.confucius = (F, w, d) => {
    F.P(pave, 0, 0, w - 2, d - 2, 0.26)
    wall4(F, red, w - 4, d - 4, 0, 4, 1, 16)
    const gz = -d / 2 + 8
    for (let i = 0; i < 4; i++) F.K(cCream, -9 + i * 6, S, gz, 1.0, 8, 1.0, false)
    F.K(red, 0, S + 6.6, gz, 22, 0.9, 1.2, false)
    F.K(cCream, 0, S + 7.6, gz, 23, 0.6, 1.4, false)
    F.P(cWater, 0, gz + 14, 26, 8, 0.32, 0.1)
    F.K(stone, 0, S, gz + 14, 4, 1.2, 10, false)
    const hz = d / 2 - 26
    F.K(stone, 0, S, hz, 50, 2.4, 30)
    for (let x = -21; x <= 21; x += 6) F.K(red, x, S + 2.4, hz - 11, 0.9, 8, 0.9, false)
    F.H('#a8402e', 'punch', 0, S + 2.4, hz + 2, 42, 9, 20)
    const gp = ctx.pools.gablePools[2]
    F.B(gp, 0, S + 11.4 + 1.8, hz + 2, 26, 3.6, 48, Math.PI / 2)
    F.K(red, 0, S + 15, hz + 2, 34, 2.6, 14, false)
    F.B(gp, 0, S + 17.6 + 2.8, hz + 2, 18, 5.6, 40, Math.PI / 2)
    F.S(0, hz + 2, 42, 20, S + 22, S + 2.4)
    for (const s of [-1, 1]) {
      const sx = s * (w / 2 - 14)
      F.H('#a8402e', 'punch', sx, S, 4, 12, 6, 42)
      F.B(gp, sx, S + 6 + 1.6, 4, 14.4, 3.2, 44)
    }
    for (const [sx, sz] of [[-30, -16], [30, -16], [-24, -4], [24, -4], [-10, -18], [10, -18]]) F.T(sx, sz, 1.1)
    F.sign('confucius', 0, S + 5, gz - 0.8, 10)
  }

  // 城市广场：铺地 + 中轴方尖碑（台阶基座）+ 长条倒影池 + 喷泉 + 树阵 + 旗杆 + 花坛
  B.civicplaza = (F, w, d) => {
    F.P(pave, 0, 0, w, d, 0.26)
    const oz = d * 0.12
    for (let i = 0; i < 3; i++) F.K(stone, 0, S, oz, 18 - i * 4, 0.6 * (i + 1), 18 - i * 4)
    F.K(stone, 0, S + 1.8, oz, 4.2, 40, 4.2)
    F.R(pyrStone, 0, S + 41.8, oz, 4.2, 4)
    F.P(cWater, 0, -d / 2 + 14 + (oz - 12 - (-d / 2 + 14)) / 2, 14, oz - 12 - (-d / 2 + 14), 0.34, 0.1)
    for (let i = 0; i < 6; i++) F.K(cW, 0, S + 0.34, -d / 2 + 18 + i * (oz - 34 + d / 2) / 6, 0.3, 2.2, 0.3, false)
    for (const s of [-1, 1]) {
      treeLine(F, s * (w / 2 - 6), -d / 2 + 6, s * (w / 2 - 6), d / 2 - 6, 10, 1)
      treeLine(F, s * 22, -d / 2 + 10, s * 22, oz - 14, 10, 0.85)
      F.P(lawn, s * (w / 4 + 6), d / 2 - 22, w / 2 - 30, 26, 0.34, 0.14)
      for (let i = 0; i < 3; i++) lamp(F, s * 12, -d / 2 + 14 + i * 22)
    }
    flags(F, d / 2 - 6, 50, 5)
    F.sign('plaza', 0, S + 3.2, oz - 9.2, 8)
  }

  // ══════════ 游乐场 ══════════
  B.amusement = (F, w, d) => {
    curRide = 0
    F.P(lawn, 0, 0, w - 2, d - 2, 0.3, 0.3)
    // 围栏（入口留口）
    for (const s of [-1, 1]) F.K(P0.fence || cW, s * (w / 4 + 10), S, -d / 2 + 1, w / 2 - 20, 1.6, 0.12, false)
    F.K(P0.fence || cW, 0, S, d / 2 - 1, w - 2, 1.6, 0.12, false)
    for (const s of [-1, 1]) F.K(P0.fence || cW, s * (w / 2 - 1), S, 0, 0.12, 1.6, d - 2, false)
    // 入口广场 + Googie 大门（双斜塔 + 弧形横梁 + 星）
    F.P(pave, 0, -d / 2 + 14, 90, 28, 0.34, 0.12)
    for (const s of [-1, 1]) {
      F.K(cTeal, s * 12, S, -d / 2 + 6, 2.4, 22, 2.4)
      F.K(cW, s * 12, S + 22, -d / 2 + 6, 3.6, 1.2, 3.6, false)
      for (let i = 0; i < 3; i++) F.K(i % 2 ? cCoral : cYellow, s * (20 + i * 5), S, -d / 2 + 6, 3.2, 3.2, 3.2)
    }
    F.B(cCoral, 0, S + 18, -d / 2 + 6, 26, 2.2, 1.6)
    F.R(coneYel, 0, S + 19.2, -d / 2 + 6, 5, 7)
    F.R(sphGold, 0, S + 25, -d / 2 + 6, 3, 3)
    F.sign('amusement', 0, S + 14.5, -d / 2 + 5, 16)
    // 主路：中轴 + 环路 + 横路
    const rx = w / 2 - 40, rz = d / 2 - 40
    F.P(pave, 0, 0, 12, rz * 2, 0.34, 0.12)
    F.P(pave, 0, -d / 2 + 34, 12, 14, 0.34, 0.12)
    for (const s of [-1, 1]) {
      F.P(pave, 0, s * rz, rx * 2 + 10, 10, 0.34, 0.12)
      F.P(pave, s * rx, 0, 10, rz * 2 + 10, 0.34, 0.12)
    }
    F.P(pave, 0, 0, rx * 2, 9, 0.34, 0.12)
    // 中心广场 + 喷泉
    F.P(pave, 0, 0, 52, 52, 0.36, 0.12)
    F.R(cylW, 0, S + 0.36, 0, 20, 0.9)
    F.P(cWater, 0, 0, 13, 13, 0.62, 0.05)
    F.R(cylW, 0, S, 0, 2, 5)
    F.R(sphGlass, 0, S + 5, 0, 3, 3)
    // 游乐设施
    carousel(F, -36, -48)
    dropTower(F, rx - 30, -rz + 30)
    swingRide(F, -rx + 34, -rz + 36)
    teacups(F, 40, -50)
    wheel(F, rx - 36, 22)
    pirate(F, -rx + 40, 30)
    bumper(F, 46, 44)
    castle(F, -40, rz - 34)
    flume(F, w, d)
    coaster(F, w, d)
    // 摊位 + 长椅 + 灯 + 树
    const awn = ctx.pools.awningPools
    const stallAt = [[-20, -rz + 18], [20, -rz + 18], [-rx + 14, -40], [rx - 14, -40], [-rx + 14, 50], [rx - 14, 60], [-60, 14], [60, -14], [-18, 34], [18, -34], [-90, rz - 12], [90, rz - 12]]
    stallAt.forEach(([x, z], i) => {
      F.K(i % 2 ? cW : cCream, x, S, z, 4.6, 2.6, 3.4)
      F.B(awn[i % awn.length], x, S + 3.0, z - 2.1, 5.2, 0.15, 1.8)
      F.B(cLit, x, S + 2.0, z - 1.72, 3.2, 0.5, 0.06)
    })
    for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) { lamp(F, i * 24, s * (rz - 7), 4.5); lamp(F, s * (rx - 7), i * 20, 4.5) }
    for (let i = 0; i < 42; i++) {
      const a = i / 42 * Math.PI * 2
      const tx = Math.cos(a) * (w / 2 - 12), tz = Math.sin(a) * (d / 2 - 12)
      if (tz < -d / 2 + 30 && Math.abs(tx) < 50) continue
      F.T(Math.max(-w / 2 + 8, Math.min(w / 2 - 8, tx * 1.08)), Math.max(-d / 2 + 8, Math.min(d / 2 - 8, tz * 1.08)), 0.9 + (i % 3) * 0.15)
    }
    for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14], [-70, -70], [70, 70], [-100, 0], [100, 0], [0, 80], [0, -80]]) F.T(x, z, 1.1)
    const fl = ctx.pools.flowerPools
    for (let i = 0; i < 24; i++) F.B(fl[i % fl.length], -24 + (i % 12) * 4.4, S + 0.5, i < 12 ? -29 : 29, 2, 0.4, 1.4)
  }
  let curRide = 0
  function carousel(F, x, z) {
    F.R(cylW, x, S, z, 22, 1.0)
    F.R(cylGold, x, S + 1, z, 3, 7)
    F.R(coneRed, x, S + 8, z, 24, 6)
    F.R(cylYel, x, S + 7.2, z, 22.4, 0.8)
    F.R(sphGold, x, S + 14, z, 1.6, 1.6)
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2
      const hx = x + Math.cos(a) * 8, hz = z + Math.sin(a) * 8
      F.R(cylSteel, hx, S + 1, hz, 0.16, 6.2)
      F.B(i % 2 ? cW : cCoral, hx, S + 2.6 + (i % 3) * 0.4, hz, 0.6, 1.1, 1.8, -a)
    }
    F.S(x, z, 22, 22, S + 7.2)
  }
  const cylGold = cylYel
  function dropTower(F, x, z) {
    F.R(cylW, x, S, z, 12, 1.2)
    F.K(cSteel, x, S, z, 3.2, 72, 3.2)
    F.R(cylCoral, x, S + 26, z, 9, 3.2)
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; F.B(cYellow, x + Math.cos(a) * 4.8, S + 25, z + Math.sin(a) * 4.8, 0.9, 1.4, 0.9) }
    F.R(cylTeal, x, S + 72, z, 6, 2)
    F.R(coneYel, x, S + 74, z, 5, 5)
    F.B(ctx.pools.beacon, x, S + 79.6, z, 0.9, 0.9, 0.9)
  }
  function swingRide(F, x, z) {
    F.R(cylW, x, S, z, 8, 1)
    F.R(cylSteel, x, S + 1, z, 1.6, 16)
    F.R(coneTeal, x, S + 15, z, 22, 5)
    F.R(cylYel, x, S + 14.6, z, 22, 0.8)
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2
      const sx = x + Math.cos(a) * 10.5, sz = z + Math.sin(a) * 10.5
      F.B(cSteel, sx, S + 11.6, sz, 0.06, 6, 0.06)
      F.B(i % 2 ? cCoral : cBlue, sx, S + 8.4, sz, 0.8, 0.5, 0.8)
    }
    F.S(x, z, 4, 4, S + 18)
  }
  function teacups(F, x, z) {
    F.R(cylTeal, x, S, z, 20, 0.6)
    const cols = [cylCoral, cylYel, cylPur, cylW, cylCoral, cylYel]
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2
      F.R(cols[i], x + Math.cos(a) * 6, S + 0.6, z + Math.sin(a) * 6, 3.6, 1.5)
    }
    F.R(cylW, x, S + 0.6, z, 3, 3.6)
    F.R(coneYel, x, S + 4.2, z, 6, 2)
  }
  function wheel(F, x, z) {
    const R = 16, hub = S + R + 3
    for (const k of [-1.2, 1.2]) {
      F.B(torCoral, x, hub, z + k, R * 2, R * 2, R * 2)
      F.B(spokeP, x, hub, z + k, R * 2, R * 2, R * 2)
    }
    for (const s of [-1, 1]) {
      F.B(cSteel, x + s * 5, S + (hub - S) / 2, z - 3, 0.7, hub - S + 1, 0.7)
      F.B(cSteel, x + s * 5, S + (hub - S) / 2, z + 3, 0.7, hub - S + 1, 0.7)
    }
    F.B(cylSteel, x, hub, z, 2, 2, 3.4)
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2
      F.B(i % 3 === 0 ? cCoral : i % 3 === 1 ? cTeal : cYellow, x + Math.cos(a) * R, hub + Math.sin(a) * R - 1.4, z, 2, 2, 2.6)
    }
    F.K(cW, x, S, z - 7, 12, 1.2, 5)
  }
  function pirate(F, x, z) {
    for (const s of [-1, 1]) {
      F.B(cSteel, x - 8, S + 8.5, z + s * 3, 0.8, 18, 0.8, 0)
      F.B(cSteel, x + 8, S + 8.5, z + s * 3, 0.8, 18, 0.8, 0)
    }
    F.B(cSteel, x, S + 17.5, z, 17, 0.8, 0.8)
    F.B(cSteel, x, S + 13, z, 0.4, 9, 0.4)
    F.K(red, x, S + 4.2, z, 16, 3.2, 4.4)
    F.K(cYellow, x, S + 7.4, z, 16.4, 0.5, 4.6, false)
    F.K(cW, x, S + 7.9, z, 0.3, 4, 0.3, false)
    F.S(x, z, 18, 7, S + 18)
  }
  function bumper(F, x, z) {
    F.P(cDark, x, z, 30, 20, 0.42, 0.12)
    for (const [sx, sz] of [[-14.6, -9.6], [14.6, -9.6], [-14.6, 9.6], [14.6, 9.6]]) F.K(cSteel, x + sx, S, z + sz, 0.4, 6, 0.4, false)
    F.K(cYellow, x, S + 6, z, 31, 0.6, 21, false)
    F.K(cCoral, x, S + 6.6, z, 26, 1.6, 0.4, false)
    const cols = [cCoral, cBlue, cYellow, cTeal, cPurple]
    for (let i = 0; i < 10; i++) F.B(cols[i % 5], x - 11 + (i % 5) * 5.5, S + 0.9, z - 5 + ((i / 5) | 0) * 9 + (i % 2), 2.2, 0.9, 1.5, i * 0.7)
    F.S(x, z, 30, 20, S + 7)
  }
  function castle(F, x, z) {
    F.H('#8a78b0', 'punch', x, S, z, 30, 12, 18)
    for (const [sx, sz, h] of [[-15, -9, 22], [15, -9, 22], [-15, 9, 18], [15, 9, 18], [0, 0, 28]]) {
      F.R(cylPur, x + sx, S, z + sz, 6, h)
      F.R(conePur, x + sx, S + h, z + sz, 7.4, 8)
      F.S(x + sx, z + sz, 6, 6, S + h)
    }
    F.K(cDark, x, S, z - 9.2, 5, 5, 0.3, false)
  }
  function flume(F, w, d) {
    // 原木漂流：矩形水道（蓝色槽 + 水面）+ 一段抬升坡 + 溅落池
    const x0 = w / 2 - 80, z0 = -12, L = 54, D = 36
    const seg = (x, z, sx, sz, y) => {
      F.K(cBlue, x, y, z, sx + 1.6, 1.2, sz + 1.6, false)
      F.B(cWater, x, y + 1.25, z, sx, 0.1, sz)
    }
    seg(x0, z0, L, 3, S)
    seg(x0, z0 + D, L, 3, S)
    seg(x0 - L / 2, z0 + D / 2, 3, D, S)
    for (let i = 0; i < 8; i++) {
      const y = S + i * 1.6
      seg(x0 + L / 2, z0 + 3 + i * (D - 6) / 8, 3, (D - 6) / 8 + 0.2, y)
      if (i) F.K(cSteel, x0 + L / 2, S, z0 + 3 + i * (D - 6) / 8, 0.4, y - S, 0.4, false)
    }
    F.P(cWater, x0, z0 + D / 2, 16, 10, 0.5, 0.1)
    F.B(cCoral, x0 + 10, S + 1.4, z0 + 0, 3, 0.8, 1.4)
  }
  function coaster(F, w, d) {
    // 过山车：后半区一圈起伏轨道（短直段拼接，带立柱）+ 一个竖直回环
    const cx = 0, cz = d / 2 - 72
    const Rx = w / 2 - 56, Rz = 40
    const N = 140
    const pts = []
    for (let i = 0; i <= N; i++) {
      const t = i / N * Math.PI * 2
      const x = cx + Math.cos(t) * Rx
      const z = cz + Math.sin(t) * Rz + Math.sin(t * 3) * 10
      const y = S + 6 + 10 * (0.5 + 0.5 * Math.sin(t * 4 + 1)) + (t < 1.2 ? (t / 1.2) * 14 : t < 1.6 ? 14 * (1 - (t - 1.2) / 0.4) : 0)
      pts.push([x, y, z])
    }
    for (let i = 0; i < N; i++) {
      const [x0, y0, z0] = pts[i]
      const [x1, y1, z1] = pts[i + 1]
      const L = Math.hypot(x1 - x0, z1 - z0)
      const ly = Math.atan2(-(z1 - z0), x1 - x0)
      F.B(cCoral, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, L + 0.5, 0.5, 2.4, ly)
      F.B(cSteel, (x0 + x1) / 2, (y0 + y1) / 2 + 0.45, (z0 + z1) / 2, L + 0.5, 0.18, 0.18, ly)
      if (i % 3 === 0) F.B(cSteel, x0, (S + y0) / 2, z0, 0.5, y0 - S, 0.5)
    }
    const lx = cx - Rx * 0.2, lz = cz + Rz + 4
    for (const k of [-0.9, 0.9]) F.B(torTeal, lx, S + 15, lz + k, 24, 24, 24)
    F.B(cSteel, lx, S + 1.5, lz, 6, 3, 2)
    F.B(cSteel, lx, S + 7, lz, 0.8, 10, 0.8)
    // 车站
    F.K(cW, cx + Rx - 6, S, cz, 14, 5.5, 10)
    F.K(cTeal, cx + Rx - 6, S + 5.5, cz, 16, 0.6, 12, false)
    // 一列车
    for (let k = 0; k < 4; k++) {
      const [x, y, z] = pts[30 + k * 2]
      F.B(k % 2 ? cYellow : cBlue, x, y + 1.1, z, 2.6, 1.2, 2.2)
    }
  }

  // ══════════ 机场（整块：落客高架/停车 → 航站楼 → 机坪 + 廊桥 + 停机 → 滑行道 → 短跑道）══════════
  function plane(F, x, z, ly, livery) {
    // 机头朝局部 -z（相对 ly 旋转）
    const c = Math.cos(ly), s = Math.sin(ly)
    const at = (u, v) => [x + u * c + v * s, z - u * s + v * c]
    const put = (pool, u, y, v, sx, sy, sz, yaw2 = 0) => { const [px, pz] = at(u, v); F.B(pool, px, y, pz, sx, sy, sz, ly + yaw2) }
    const y = S + 4.2
    put(fuseW, 0, y, 0, 4.2, 4.2, 38)
    put(noseW, 0, y, -21, 4.2, 4.2, 4, Math.PI)
    put(noseW, 0, y + 0.4, 21.5, 3.6, 3.4, 5)
    put(livery, 0, y + 0.3, 0, 4.3, 0.5, 34)
    for (const sd of [-1, 1]) {
      put(cW, sd * 9, y - 1.2, 2.5, 15, 0.5, 6, sd * -0.32)
      put(fuseW, sd * 7, y - 2.4, 0, 2.2, 2.2, 4.2)
      put(cW, sd * 3.2, y + 0.8, 18.5, 6, 0.3, 2.6, sd * -0.3)
    }
    put(livery, 0, y + 4.6, 18.5, 0.4, 7, 5)
    for (const [u, v] of [[0, -14], [-3, 2], [3, 2]]) put(cDark, u, S + 1, v, 0.6, 2, 0.6)
    const side = Math.abs(s) > 0.5
    F.S(x, z, side ? 38 : 6, side ? 6 : 38, y + 2.2)
  }
  B.airport = (F, w, d) => {
    // 局部：x 沿临街长边（w），z 指向城墙（d）
    // t34：底板改为草地（以前整块深色沥青 = 一大片纯色暗板）；只有陆侧车道 / 停车场 / 跑道滑行道是沥青，机坪是浅色混凝土
    F.P(lawn, 0, 0, w - 4, d - 4, 0.18, 0.2)
    // 陆侧：进场车道 + 落客雨棚 + 停车场 + 绿化
    F.P(tarmac, 0, -d / 2 + 28, w - 24, 9, 0.28, 0.1)
    for (const s of [-1, 1]) F.P(tarmac, s * (w / 2 - 16), -d / 2 + 50, 8, 52, 0.28, 0.1)
    for (let x = -w / 2 + 20; x < w / 2 - 20; x += 9) F.P(line, x, -d / 2 + 28, 3, 0.15, 0.34, 0.03)
    for (let i = 0; i < 28; i++) F.T(-w / 2 + 14 + i * (w - 28) / 27, -d / 2 + 6, 0.95)
    F.P(P0.pave, 0, -d / 2 + 44, w * 0.5, 8, 0.32, 0.12)
    const tz = -d / 2 + 82
    const tw = Math.min(300, w * 0.55)
    F.K(cW, 0, S + 8, -d / 2 + 44, tw * 0.8, 0.7, 14, false)
    for (let x = -tw * 0.38; x <= tw * 0.38; x += 16) F.K(cSteel, x, S, -d / 2 + 39, 0.5, 8, 0.5, false)
    for (const s of [-1, 1]) {
      const px = s * (tw / 2 + (w / 2 - tw / 2) / 2)
      const pw = w / 2 - tw / 2 - 16
      F.P(P0.tarmac, px, -d / 2 + 70, pw, 60, 0.3, 0.12)
      for (let i = 0; i < Math.floor(pw / 3); i += 1) for (const r of [-14, 0, 14]) if (rng() < 0.6) lotCar(F.X(px - pw / 2 + 2 + i * 3, -d / 2 + 70 + r), S + 0.3, F.Z(px - pw / 2 + 2 + i * 3, -d / 2 + 70 + r), F.yaw + Math.PI / 2, null, false)
      for (const r of [-7, 7]) F.P(line, px, -d / 2 + 70 + r, pw, 0.2, 0.34, 0.05)
    }
    // 航站楼：幕墙楼身 + 波浪大屋顶（三段拱顶）+ 正立面玻璃大厅
    F.H('#cfe3ec', 'curtain', 0, S, tz, tw, 16, 56)
    for (let i = 0; i < 3; i++) F.B(i === 1 ? vaultGlass : vaultW, (i - 1) * tw / 3, S + 16.6, tz, tw / 3 + 1, 16 + (i === 1 ? 6 : 0), 64)
    F.S(0, tz, tw, 56, S + 27)
    F.K(glass, 0, S, tz - 30, tw * 0.5, 14, 4, false)
    F.sign('airport', 0, S + 21, tz - 32.6, 30)
    // 指廊 + 廊桥 + 停机位
    const fz = tz + 28 + 10
    F.K(cW, 0, S, fz, tw * 0.9, 7, 14)
    F.B(glass, 0, S + 4.5, fz + 7.05, tw * 0.88, 3.2, 0.2)
    const nG = 4
    const liv = [cBlue, cCoral, cTeal, cYellow]
    for (let i = 0; i < nG; i++) {
      const gx = -tw * 0.36 + i * (tw * 0.72) / (nG - 1)
      F.K(cSteel, gx + 6, S + 4.2, fz + 7 + 9, 3, 3, 18, false)
      F.K(cSteel, gx + 6, S, fz + 7 + 16, 0.8, 4.2, 0.8, false)
      plane(F, gx, fz + 7 + 32, 0, liv[i % liv.length])
      F.P(line, gx, fz + 7 + 32, 0.3, 50, 0.24, 0.05)
    }
    // 塔台
    const cx = tw / 2 + 30
    F.R(cylW, cx, S, tz + 10, 7, 44)
    F.R(cylGlass, cx, S + 44, tz + 10, 13, 5)
    F.R(cylW, cx, S + 49, tz + 10, 15, 1.4)
    F.R(cylSteel, cx, S + 50.4, tz + 10, 0.5, 8)
    F.S(cx, tz + 10, 7, 7, S + 50)
    // 滑行道 + 跑道（贴城墙一侧，标线）
    const rz = d / 2 - 34
    // 机坪：浅色混凝土分格（stoneStep 池自带 1.2m 石板缝 + 斑驳），留出草地缓冲带再接跑道
    F.P(P0.stoneStep, 0, (fz + 7 + rz - 30) / 2, w - 30, rz - 30 - fz - 7, 0.26, 0.1)
    for (let x = -w / 2 + 30; x < w / 2 - 30; x += 20) F.P(line, x, (fz + 7 + rz - 30) / 2, 0.12, rz - 30 - fz - 9, 0.32, 0.02)
    F.P(cDark, 0, rz, w - 20, 46, 0.22, 0.05)
    for (let x = -w / 2 + 40; x < w / 2 - 40; x += 30) F.P(line, x, rz, 14, 0.8, 0.24, 0.03)
    for (const s of [-1, 1]) for (let k = 0; k < 8; k++) F.P(line, s * (w / 2 - 24), rz - 16 + k * 4.6, 12, 1.6, 0.24, 0.03)
    F.P(cYellow, 0, rz - 34, w - 40, 0.5, 0.24, 0.03)
    for (const s of [-1, 1]) F.P(cYellow, s * (w * 0.32), (fz + rz) / 2 + 10, 0.5, rz - fz - 40, 0.24, 0.03)
    plane(F, -w * 0.18, rz, Math.PI / 2, cBlue)
    for (let x = -w / 2 + 20; x < w / 2 - 20; x += 24) for (const s of [-1, 1]) F.B(cLit, x, S + 0.4, rz + s * 24, 0.5, 0.3, 0.5)
  }

  // t37 大型主题乐园（整块地，造型在 themepark.js；复用这里的几何 / 材质 / 小型游乐设施）
  installThemePark(B, {
    LP, L0, G, S, P0, Mat,
    c: { cW, cCream, cSteel, cDark, cTeal, cCoral, cYellow, cBlue, cPurple, cWater, cLit, cIce },
    geo: { cyl: cylGeo, pyr: pyrGeo, sph: sphGeo, cone: coneGeo, dome: domeGeo, torus: torusGeo, spoke: spokeGeo, shell: shellGeo, vault: vaultGeo },
    ride: { carousel, teacups, swingRide, dropTower },
    lamp, flags,
  })

  return {
    /** 是否有该类型 */
    has: (t) => !!B[t],
    /** 在 (cx,cz) 放一个 w×d 的类型，临街外法线 (fx,fz)；v 变体 */
    place(t, cx, cz, fx, fz, w, d, v = 0) {
      nextGrp()
      const F = frame(cx, cz, fx, fz)
      B[t](F, w, d, v)
      return true
    },
  }
}
