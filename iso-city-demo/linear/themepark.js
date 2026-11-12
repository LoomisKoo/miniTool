import * as THREE from 'three'

/**
 * t37 大型原创主题乐园「云岬乐园 CLOUDCAPE PARK」（整块地，约 640m × 610m，城东南角）。
 * 只用实例池（与 civic.js 同一套 F 局部坐标：x 沿临街面，z 从入口 -d/2 指向园内 +d/2，y 绝对高度）。
 * 分区：入口广场 → 主街 → 中央泻湖 + 云岬灯塔（地标）+ 环湖巡游大道；
 *   四个主题园区：糖果镇（西前）、星港（东前）、雨林秘境（西后）、赤岩峡谷（东后）；后中：湖畔露天剧场；东侧：云岬大剧院；西侧：大摩天轮。
 * 预算：新增池子约 40 个（每池每块 1 个 draw call），全部是盒 / 柱 / 锥 / 球实例；灯串 / 摊位 / 长椅这类小件 lod 裁剪。
 * 全部原创造型与命名，不使用任何既有影视 / 乐园 IP。
 */
export function installThemePark(B, api) {
  const { LP, L0, G, S, P0, c, geo, ride, lamp, flags, Mat } = api
  const { cW, cCream, cSteel, cDark, cTeal, cCoral, cYellow, cBlue, cPurple, cWater, cLit } = c

  // ── 专用池 ──
  const icoGeo = new THREE.IcosahedronGeometry(0.5, 1)
  const torusH = new THREE.TorusGeometry(0.5, 0.012, 6, 72).rotateX(Math.PI / 2)
  const finGeo = new THREE.CylinderGeometry(0.0, 0.5, 1, 3)
  const crownG = ['#4f8a3e', '#62a04a', '#3f7a3a', '#76a850'].map((h) => G(icoGeo, h, 0.0, 0.85, 0.35))
  const crownPink = G(icoGeo, '#f2a7c3', 0.0, 0.8, 0.35)
  const crownPalm = G(icoGeo, '#5fae5a', 0.0, 0.8, 0.35)
  const trunk = G(geo.cyl, '#7a5a40', 0.0, 0.9, 0.3)
  const rockRed = L0('#b85a3c', 0.02, 0.92, 0.3)
  const rockSand = L0('#d9a066', 0.02, 0.92, 0.3)
  const rockGrey = L0('#8f8c84', 0.02, 0.92, 0.3)
  const pyrRock = G(geo.pyr, '#c26a46', 0.02, 0.9, 0.3)
  const pyrGreyR = G(geo.pyr, '#8f8c84', 0.02, 0.9, 0.3)
  const pyrTemple = G(geo.pyr, '#cdbb92', 0.03, 0.85, 0.35)
  const showGreen = L0('#6f8f6a', 0.02, 0.85, 0.3)
  const showTan = L0('#c9b28a', 0.02, 0.85, 0.3)
  const showLav = L0('#8d7ab8', 0.03, 0.75, 0.35)
  const candyPink = L0('#f29ab8', 0.05, 0.5, 0.5)
  const candyMint = L0('#8fd8c0', 0.05, 0.5, 0.5)
  const sphPink = G(geo.sph, '#f07aa8', 0.1, 0.35, 0.6)
  const sphMint = G(geo.sph, '#7fd6b8', 0.1, 0.35, 0.6)
  const sphYel = G(geo.sph, '#f6cf5a', 0.1, 0.35, 0.6)
  const sphWhite = G(geo.sph, '#fbfaf6', 0.05, 0.6, 0.45)
  const sphGoldT = G(geo.sph, '#e0b44a', 0.8, 0.25, 1.1)
  const cylWhite = G(geo.cyl, '#f6f3ec', 0.08, 0.4, 0.6)
  const cylTealT = G(geo.cyl, '#2f9c94', 0.35, 0.35, 0.8)
  const cylCoralT = G(geo.cyl, '#e8735a', 0.1, 0.45, 0.55)
  const cylGoldT = G(geo.cyl, '#e0b44a', 0.8, 0.25, 1.1)
  const cylStone = G(geo.cyl, '#d8cdb8', 0.02, 0.85, 0.35)
  const cylSteelT = G(geo.cyl, '#c9d1d8', 0.7, 0.3, 0.9)
  const cylRedT = G(geo.cyl, '#d0473a', 0.1, 0.45, 0.55)
  const cylBlueT = G(geo.cyl, '#3f7fc0', 0.2, 0.4, 0.6)
  const cylWaterT = G(geo.cyl, '#2a8fbf', 0.1, 0.06, 1.3, { emissive: '#1d7fa8' })
  Mat.registerNight(cylWaterT.mat, 0.1, 0.55)
  const lantern = G(geo.cyl, '#ffe9b8', 0.2, 0.2, 1.0, { emissive: '#ffd890' })
  Mat.registerNight(lantern.mat, 0.25, 3.2)
  const coneGoldT = G(geo.cone, '#e0b44a', 0.8, 0.25, 1.1)
  const coneTealT = G(geo.cone, '#2f9c94', 0.35, 0.35, 0.8)
  const coneCoralT = G(geo.cone, '#e8735a', 0.1, 0.45, 0.55)
  const conePinkT = G(geo.cone, '#f07aa8', 0.1, 0.45, 0.55)
  const coneWhiteT = G(geo.cone, '#f6f3ec', 0.1, 0.4, 0.6)
  const domeWhite = G(geo.dome, '#f6f3ec', 0.1, 0.35, 0.7)
  const domeTealT = G(geo.dome, '#2f9c94', 0.4, 0.3, 0.8)
  const domeGlassT = G(geo.dome, '#a8d0e4', 0.5, 0.12, 1.2, { emissive: '#bfe4ff' })
  Mat.registerNight(domeGlassT.mat, 0.0, 0.9)
  const ringGold = G(torusH, '#e0b44a', 0.85, 0.22, 1.2)
  const ringTeal = G(torusH, '#3fb8b0', 0.4, 0.3, 0.9, { emissive: '#3fe0d0' })
  Mat.registerNight(ringTeal.mat, 0.0, 1.6)
  const torV = G(geo.torus, '#e8735a', 0.5, 0.3, 0.7)
  const torVTeal = G(geo.torus, '#2f9c94', 0.5, 0.3, 0.7)
  const spokeT = G(geo.spoke, '#f6f3ec', 0.6, 0.35, 0.8)
  const torGlow = G(geo.torus, '#ff8fb0', 0.1, 0.4, 0.4, { emissive: '#ff6fa0' })
  Mat.registerNight(torGlow.mat, 0.1, 2.4)
  const finTeal = G(finGeo, '#2f9c94', 0.3, 0.4, 0.7)
  const shellT = G(geo.shell, '#f6f4ee', 0.08, 0.3, 0.8)
  shellT.mat.side = THREE.DoubleSide
  const vaultT = G(geo.vault, '#eef0f0', 0.25, 0.35, 0.8)
  const trackR = L0('#e8473a', 0.5, 0.35, 0.8)
  const trackB = L0('#2f6fc0', 0.5, 0.35, 0.8)
  const wood = L0('#9a6a44', 0.02, 0.85, 0.3)
  const paveWarm = L0('#e6cfa6', 0.02, 0.88, 0.35, { craft: 'pave' })
  const paveRose = L0('#e3b3a2', 0.02, 0.88, 0.35, { craft: 'pave' })
  const parade = L0('#d9544a', 0.02, 0.8, 0.4)
  // 夜灯：灯串彩泡 / 地灯 / 装饰灯带（一律 emissive，白天弱、夜里亮）
  const bulbCols = ['#ffd27a', '#ff8fb0', '#8fe0ff', '#fff2d0']
  const bulbs = bulbCols.map((h) => {
    const p = LP(h, 0, 0.5, 0.2, { emissive: h, lod: 900 })
    Mat.registerNight(p.mat, 0.12, 2.6)
    return p
  })
  const neon = ['#ff5fa2', '#4fe0d8', '#ffd04a'].map((h) => {
    const p = LP(h, 0, 0.45, 0.3, { emissive: h, lod: 0 })
    Mat.registerNight(p.mat, 0.25, 2.2)
    return p
  })
  const small = (h, m = 0.05, r = 0.7) => LP(h, m, r, 0.4, { lod: 700 })
  const benchP = small('#8a6a48')
  const stallW = small('#f6f1e6')
  const stallR = small('#e8735a')
  const stallT = small('#3fa39a')
  const binP = small('#3f6a50')
  const flower = ['#f07aa8', '#f6cf5a', '#fbfaf6', '#a68ad8', '#ff9a6a'].map((h) => small(h, 0, 0.8))
  const crowdC = ['#e8735a', '#3f7fc0', '#f6cf5a', '#f6f3ec', '#7a5aa0', '#3fa39a'].map((h) => LP(h, 0.02, 0.8, 0.3, { lod: 380 }))

  // ── 小工具 ──
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
  const tree = (F, x, z, s = 1, kind = 0) => {
    const h = 3.2 * s
    F.R(trunk, x, S, z, 0.5 * s, h)
    const pool = kind === 1 ? crownPink : kind === 2 ? crownPalm : crownG[(rnd() * 4) | 0]
    const r = (3.6 + rnd() * 1.6) * s
    F.B(pool, x, S + h + r * 0.35, z, r * 1.25, r * 1.05, r * 1.25, rnd() * 6)
    F.B(pool, x + 0.6 * s, S + h + r * 0.85, z - 0.4 * s, r * 0.85, r * 0.8, r * 0.85, rnd() * 6)
  }
  const palm = (F, x, z, s = 1) => {
    F.R(trunk, x, S, z, 0.5 * s, 9 * s)
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + rnd(); F.B(crownPalm, x + Math.cos(a) * 2.2 * s, S + 9 * s, z + Math.sin(a) * 2.2 * s, 4.4 * s, 0.9 * s, 1.6 * s, -a) }
  }
  /** 拉一串彩泡：a→b，高度 y，每 step 米一颗 */
  const festoon = (F, x0, z0, x1, z1, y, step = 2.2, sag = 0.8) => {
    const L = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(2, Math.round(L / step))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      F.B(bulbs[i % bulbs.length], x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t, 0.45, 0.45, 0.45)
    }
  }
  /** 沿折线摆长条（路面 / 轨道 / 巡游线）：yaw 旋转的薄盒 */
  const strip = (F, pool, pts, wid, y, th = 0.12) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1]
      const L = Math.hypot(bx - ax, bz - az)
      F.B(pool, (ax + bx) / 2, y, (az + bz) / 2, L + wid * 0.08, th, wid, Math.atan2(-(bz - az), bx - ax))
    }
  }
  const circle = (cx, cz, r, n, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r] })
  /** 主题小楼：漆色立面（linear 立面 shader，带窗）+ 坡顶 + 遮阳篷 + 招牌灯带 */
  const shop = (F, x, z, w, d, h, hex, face = -1, gi = 0) => {
    F.H(hex, 'punch', x, S, z, w, h, d)
    const gp = P0.gablePools[gi % P0.gablePools.length]
    F.B(gp, x, S + h + 2.2, z, w + 1.2, 4.4, d + 1.2, 0)
    const fz = z + face * (d / 2 + 0.9)
    const aw = P0.awningPools[gi % P0.awningPools.length]
    F.B(aw, x, S + 3.4, fz, w * 0.8, 0.18, 1.8)
    F.B(neon[gi % 3], x, S + 4.4, z + face * (d / 2 + 0.12), w * 0.55, 0.5, 0.1)
  }
  /** 大型暗乘 / 剧场「秀馆」：大体量墙 + 主题门脸（前沿 z0，朝 -z） */
  const showBox = (F, pool, x, z, w, d, h) => {
    F.K(pool, x, S, z, w, h, d)
    F.K(cDark, x, S, z - d / 2 - 0.2, w * 0.22, 5, 0.4, false)
    F.B(neon[(x > 0) | 0], x, S + 5.8, z - d / 2 - 0.3, w * 0.3, 0.6, 0.12)
    // 夜里屋檐一圈灯带（远看秀馆有轮廓）
    const nk = neon[((x * 0.37) | 0) & 1 ? 2 : 1]
    F0B(nk, x, S + h + 0.2, z - d / 2, w, 0.35, 0.35)
    F0B(nk, x, S + h + 0.2, z + d / 2, w, 0.35, 0.35)
    for (const sx of [-1, 1]) F0B(nk, x + sx * w / 2, S + h + 0.2, z, 0.35, 0.35, d)
  }
  let F0B = () => {}

  /** 乐园核心区（约 640m 宽）：入口 + 主街 + 泻湖灯塔 + 环湖巡游 + 四个初始园区；F 是带占地登记的框架 */
  function core(F, F0, w, d) {
    const hw = w / 2, hd = d / 2
    const LC = [0, 20] // 泻湖中心
    const LR = 78 // 泻湖半径
    const RR = 116 // 巡游环路半径
    // ── 主题园区铺装底（整块草坪由外层铺）──
    F.P(paveWarm, 0, -hd + 40, 230, 76, 0.36, 0.12) // 入口广场
    F.P(paveWarm, 0, (-hd + 78 + LC[1] - RR) / 2, 64, LC[1] - RR - (-hd + 78), 0.36, 0.12) // 主街
    F.P(paveRose, -190, -150, 200, 120, 0.34, 0.1) // 糖果镇广场
    F.P(paveWarm, 190, -150, 200, 120, 0.34, 0.1) // 星港广场
    F.P(rockSand, 190, 180, 210, 190, 0.33, 0.08) // 峡谷砂地
    // ══ 入口广场 + 大门（双塔 + 弧梁 + 云团 + 金环）══
    const gz = -hd + 62
    for (const s of [-1, 1]) {
      F.R(cylTealT, s * 22, S, gz, 9, 30)
      F.R(cylWhite, s * 22, S + 30, gz, 11, 2)
      F.R(coneGoldT, s * 22, S + 32, gz, 9, 12)
      F.R(sphGoldT, s * 22, S + 44.5, gz, 2.2, 2.2)
      F.B(ringGold, s * 22, S + 20, gz, 13, 40, 13)
      for (let k = 0; k < 4; k++) F.R(cylCoralT, s * (40 + k * 16), S, gz + 2, 3.2, 8 + (k % 2) * 3)
      // 售票亭
      for (let k = 0; k < 5; k++) {
        const bx = s * (36 + k * 9)
        F.K(cW, bx, S, gz - 8, 6, 3.6, 4)
        F.K(k % 2 ? cCoral : cTeal, bx, S + 3.6, gz - 8, 7, 0.7, 5, false)
      }
    }
    F.K(cCoral, 0, S + 22, gz, 46, 3.2, 3.2, false)
    F.K(cYellow, 0, S + 25.2, gz, 40, 0.8, 3.6, false)
    for (const [x, y, s] of [[0, 31, 9], [-7, 28.6, 6.6], [7, 28.6, 6.6], [-13, 27, 4.6], [13, 27, 4.6], [3.5, 34, 5]]) F.B(sphWhite, x, S + y, gz, s, s * 0.8, s * 0.8)
    F.sign('themepark', 0, S + 18.4, gz - 1.9, 24)
    for (let k = -6; k <= 6; k++) F.K(cSteel, k * 3, S, gz + 6, 0.5, 1.1, 2, false) // 检票闸机
    flags(F, -hd + 18, 200, 14)
    for (let x = -100; x <= 100; x += 25) lamp(F, x, -hd + 30, 5.5)
    F.R(cylStone, 0, S, -hd + 36, 26, 1.0)
    F.R(cylWaterT, 0, S + 1.0, -hd + 36, 22, 0.25)
    F.R(cylWhite, 0, S + 1.0, -hd + 36, 3, 6)
    F.R(sphGoldT, 0, S + 7, -hd + 36, 4, 4)
    for (let i = 0; i < 30; i++) F.B(flower[i % 5], -60 + (i % 15) * 8.5, S + 0.6, -hd + (i < 15 ? 48 : 24), 3, 0.5, 2)

    // ══ 主街（两排漆色小楼 + 篷 + 灯串）══
    const ms0 = gz + 16, ms1 = LC[1] - RR - 6
    const pal = ['#f2b8a0', '#a8d8c8', '#f6dc8a', '#c8b8e8', '#f4c4d4', '#b8d4f0', '#f0c890']
    let gi = 0
    for (const s of [-1, 1]) {
      for (let z = ms0 + 10; z < ms1 - 10; z += 21) {
        const h = 9 + ((gi * 7) % 4) * 1.4
        shop(F, s * 42, z, 18, 19, h, pal[gi % pal.length], 0, gi)
        F.B(P0.awningPools[gi % P0.awningPools.length], s * 31.6, S + 3.4, z, 2, 0.18, 15)
        F.B(neon[gi % 3], s * 32.6, S + 5.2, z, 0.12, 0.6, 9)
        gi++
      }
      for (let z = ms0 + 4; z < ms1; z += 14) { lamp(F, s * 28, z, 5); F.B(benchP, s * 26.5, S + 0.45, z + 6, 0.6, 0.5, 2.2) }
    }
    for (let z = ms0 + 4; z < ms1; z += 14) festoon(F, -28, z, 28, z, 6.4, 2.4, 1.2)
    for (let z = ms0 + 20; z < ms1 - 8; z += 30) for (const s of [-1, 1]) tree(F, s * 18, z, 0.75)

    // ══ 中央泻湖 + 云岬灯塔 ══
    const [lx, lz] = LC
    F.R(cylStone, lx, S, lz, LR * 2 + 8, 0.7)
    F.R(cylWaterT, lx, S + 0.7, lz, LR * 2, 0.12)
    // 环湖巡游大道（宽 16m，红色巡游中线）+ 彩旗灯串
    strip(F, paveWarm, circle(lx, lz, RR, 72), 18, S + 0.2, 0.3)
    strip(F, parade, circle(lx, lz, RR, 72), 1.4, S + 0.37, 0.04)
    for (const [x, z] of circle(lx, lz, RR + 11, 36)) { lamp(F, x, z, 6) }
    const fp = circle(lx, lz, RR + 11, 36)
    for (let i = 0; i < 36; i++) festoon(F, fp[i][0], fp[i][1], fp[i + 1][0], fp[i + 1][1], 6.4, 2.2, 0.9)
    for (const [x, z] of circle(lx, lz, LR + 9, 28)) tree(F, x, z, 0.8, 1)
    // 巡游花车（停在大道上：车台 + 造型 + 彩泡）
    const floatCols = [[cCoral, sphYel], [cTeal, sphPink], [cPurple, sphMint], [cYellow, sphPink], [cBlue, sphYel], [cCoral, sphMint], [cTeal, sphYel], [cPurple, sphPink]]
    floatCols.forEach(([base, top], i) => {
      const a = -Math.PI * 0.5 + 0.55 + i * 0.36
      const x = lx + Math.cos(a) * RR, z = lz + Math.sin(a) * RR
      const yaw = Math.atan2(Math.cos(a), -Math.sin(a)) - Math.PI / 2
      F.B(base, x, S + 1.3, z, 4.4, 1.6, 9, yaw)
      F.B(top, x, S + 4.6, z, 4.6, 5, 4.6, yaw)
      F.B(i % 2 ? coneGoldT : coneCoralT, x, S + 8.2, z, 2.4, 3, 2.4, yaw)
      for (let k = 0; k < 6; k++) F.B(bulbs[k % 4], x + Math.cos(a) * 2.4, S + 2.3, z + Math.sin(a) * 2.4 + (k - 2.5) * 1.4, 0.4, 0.4, 0.4)
      for (let k = 0; k < 14; k++) { const aa = a + (rnd() - 0.5) * 0.25; const rr = RR + (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 2); F.B(crowdC[(rnd() * 6) | 0], lx + Math.cos(aa) * rr, S + 0.85, lz + Math.sin(aa) * rr, 0.55, 1.7, 0.4) }
    })
    // 灯塔岛：岩石底座 + 三层白塔（逐层收分）+ 彩带 + 灯笼 + 金穹 + 尖顶 + 两道悬浮光环
    F.R(cylStone, lx, S, lz, 56, 3)
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; F.R(k % 2 ? pyrGreyR : pyrRock, lx + Math.cos(a) * 25, S, lz + Math.sin(a) * 25, 12 + (k % 3) * 4, 8 + (k % 4) * 3) }
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + 0.2; palm(F, lx + Math.cos(a) * 21, lz + Math.sin(a) * 21, 0.8) }
    let y = S + 3
    const tiers = [[34, 24, cylCoralT], [27, 24, cylTealT], [20, 22, cylCoralT]]
    for (const [dia, h, band] of tiers) {
      F.R(cylWhite, lx, y, lz, dia, h)
      F.R(band, lx, y + h - 2.4, lz, dia + 1.2, 2.4)
      F.B(ringTeal, lx, y + h - 3.0, lz, dia + 1.6, 30, dia + 1.6)
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; F.B(lantern, lx + Math.cos(a) * (dia / 2 + 0.1), y + h * 0.55, lz + Math.sin(a) * (dia / 2 + 0.1), 1.6, h * 0.42, 1.6, -a) }
      F.R(cylWhite, lx, y + h, lz, dia + 4, 1.0)
      y += h + 1
    }
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; F.B(finTeal, lx + Math.cos(a) * 19, S + 3 + 22, lz + Math.sin(a) * 19, 9, 44, 9, -a) }
    F.R(lantern, lx, y, lz, 15, 9)
    F.R(cylGoldT, lx, y + 9, lz, 18, 1.2)
    F.D(domeTealT, lx, y + 10.2, lz, 16, 7)
    F.R(coneGoldT, lx, y + 16, lz, 7, 24)
    F.R(sphGoldT, lx, y + 40.5, lz, 3, 3)
    F.B(P0.beacon, lx, y + 43, lz, 1.2, 1.2, 1.2)
    F.B(ringGold, lx, S + 40, lz, 62, 70, 62)
    F.B(ringTeal, lx, S + 64, lz, 46, 60, 46)
    F.B(ringGold, lx, y + 4, lz, 28, 50, 28)
    F.S(lx, lz, 34, 34, y + 16)
    // 湖上喷泉
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; F.R(cIceLike(), lx + Math.cos(a) * 48, S + 0.8, lz + Math.sin(a) * 48, 0.9, 6 + (k % 3) * 3) }
    // 桥（主街 → 灯塔岛）
    F.K(cW, lx, S + 0.8, lz - (LR + 28) / 2 - 2, 9, 0.8, LR - 26, false)
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) F.B(bulbs[k % 4], lx + s * 4.6, S + 2.4, lz - 30 - k * 9, 0.4, 0.4, 0.4)

    // ══ 糖果镇（西前）══
    {
      const ox = -190, oz = -150
      const cpal = ['#f4c4d4', '#c8e8d8', '#fbe6a8', '#d8c8f0', '#ffd0b8', '#bfe0f4']
      for (let k = 0; k < 7; k++) shop(F, ox - 84 + k * 26, oz - 46, 16, 14, 8 + (k % 3) * 2, cpal[k % 6], 1, k + 2)
      for (let k = 0; k < 5; k++) shop(F, ox - 70 + k * 30, oz + 48, 18, 14, 9 + (k % 2) * 3, cpal[(k + 3) % 6], -1, k + 4)
      ride.carousel(F, ox - 20, oz)
      ride.teacups(F, ox + 40, oz - 6)
      ride.swingRide(F, ox - 74, oz + 4)
      // 糖果工厂（暗乘秀馆）+ 棒棒糖烟囱
      showBox(F, candyPink, ox + 20, oz + 108, 64, 38, 16)
      F.K(candyMint, ox + 20, S + 16, oz + 108, 50, 3, 30, false)
      for (let k = 0; k < 3; k++) { F.R(cylWhite, ox - 4 + k * 24, S + 19, oz + 112, 2, 12); F.R([sphPink, sphMint, sphYel][k], ox - 4 + k * 24, S + 31, oz + 112, 8, 8) }
      for (let k = 0; k < 14; k++) { const x = ox - 90 + k * 13; F.R(cylWhite, x, S, oz + 24, 0.35, 4.5); F.R([sphPink, sphMint, sphYel][k % 3], x, S + 4.2, oz + 24, 1.8, 1.8) }
      for (let k = 0; k < 16; k++) tree(F, ox - 95 + rnd() * 190, oz + 70 + rnd() * 20, 0.8, 1)
      for (let k = 0; k < 8; k++) festoon(F, ox - 90 + k * 22, oz - 28, ox - 68 + k * 22, oz - 28, 5.6)
      for (let k = 0; k < 10; k++) { F.K(k % 2 ? stallW : stallR, ox - 80 + k * 18, S, oz + 34, 3.6, 2.6, 3, false); F.B(neon[k % 3], ox - 80 + k * 18, S + 2.9, oz + 32.4, 2.6, 0.3, 0.1) }
    }
    // ══ 星港（东前）══
    {
      const ox = 190, oz = -150
      // 火箭塔：白身 + 三翼 + 红锥 + 舷窗灯
      F.R(cylWhite, ox - 50, S, oz - 10, 9, 52)
      F.R(coneCoralT, ox - 50, S + 52, oz - 10, 9.4, 14)
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; F.B(finTeal, ox - 50 + Math.cos(a) * 5.5, S + 7, oz - 10 + Math.sin(a) * 5.5, 6, 14, 6, -a) }
      for (let k = 0; k < 5; k++) F.B(ringTeal, ox - 50, S + 12 + k * 8, oz - 10, 9.6, 30, 9.6)
      F.S(ox - 50, oz - 10, 9, 9, S + 66)
      ride.dropTower(F, ox + 70, oz - 50)
      // 飞碟转盘
      F.R(cylSteelT, ox + 10, S, oz - 52, 2, 14)
      F.R(cylTealT, ox + 10, S + 14, oz - 52, 26, 1.6)
      F.D(domeGlassT, ox + 10, S + 15.6, oz - 52, 12, 4)
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; F.B(neon[k % 3], ox + 10 + Math.cos(a) * 12.6, S + 14, oz - 52 + Math.sin(a) * 12.6, 1.2, 0.6, 1.2, -a) }
      // 穹顶群 + 星际机库（暗乘秀馆）
      F.D(domeWhite, ox + 30, S, oz + 30, 38, 18)
      F.D(domeGlassT, ox + 60, S, oz + 40, 22, 11)
      F.D(domeWhite, ox - 4, S, oz + 64, 18, 9)
      F.S(ox + 30, oz + 30, 30, 30, S + 18)
      F.K(showLav, ox - 30, S, oz + 112, 70, 14, 40)
      F.B(vaultT, ox - 30, S + 14 + 5, oz + 112, 70, 10, 40)
      F.B(neon[1], ox - 30, S + 6, oz + 91.6, 26, 0.6, 0.12)
      F.K(cDark, ox - 30, S, oz + 91.8, 14, 5, 0.4, false)
      // 单轨（高架 + 两列车）
      const mono = circle(ox + 10, oz + 10, 74, 40)
      strip(F, cW, mono, 1.6, S + 9, 1.2)
      for (let i = 0; i < 40; i += 2) F.R(cylWhite, mono[i][0], S, mono[i][1], 1.2, 8.4)
      for (let k = 0; k < 4; k++) { const [x, z] = mono[6 + k]; F.B(k ? cW : cCoral, x, S + 11, z, 3, 2.4, 3) }
      for (let k = 0; k < 10; k++) { F.K(k % 2 ? stallW : stallT, ox - 90 + k * 16, S, oz - 34, 3.6, 2.6, 3, false); F.B(neon[(k + 1) % 3], ox - 90 + k * 16, S + 2.9, oz - 35.6, 2.6, 0.3, 0.1) }
      for (let k = 0; k < 10; k++) palm(F, ox - 90 + k * 20, oz + 2, 0.9)
    }
    // ══ 雨林秘境（西后）：大岩山 + 瀑布 + 原木漂流 + 神殿暗乘 ══
    {
      const ox = -195, oz = 185
      const mx = ox - 20, mz = oz + 30
      const rocks = [[0, 0, 80, 30], [-14, 8, 56, 46], [12, -6, 40, 58], [-6, 14, 26, 70]]
      for (const [dx, dz, s, h] of rocks) F.R(pyrGreyR, mx + dx, S, mz + dz, s, h)
      for (const [dx, dz, s, h] of [[30, -26, 30, 20], [-34, -18, 26, 16], [24, 30, 22, 24]]) F.R(pyrRock, mx + dx, S, mz + dz, s, h)
      F.S(mx, mz, 60, 60, S + 46)
      F.K(cWater, mx + 6, S, mz - 26, 8, 40, 1.2, false) // 瀑布
      F.R(cylWaterT, mx + 6, S + 0.3, mz - 34, 26, 0.2)
      // 漂流水道：一圈环绕岩山
      const fl = circle(mx, mz, 58, 30)
      strip(F, cBlue, fl, 6, S + 0.9, 1.6)
      strip(F, cWater, fl, 4.4, S + 1.75, 0.1)
      for (let k = 0; k < 5; k++) { const [x, z] = fl[3 + k * 5]; F.B(wood, x, S + 2.2, z, 4.2, 0.8, 1.8) }
      // 神殿暗乘
      F.K(showGreen, ox + 80, S, oz + 70, 60, 12, 44)
      for (let k = 0; k < 4; k++) F.K(cCream, ox + 80, S + 12 + k * 4, oz + 70, 44 - k * 9, 4, 32 - k * 6, false)
      F.R(pyrTemple, ox + 80, S + 28, oz + 70, 12, 10)
      F.K(cDark, ox + 80, S, oz + 47.8, 12, 7, 0.4, false)
      for (const s of [-1, 1]) { F.R(cylStone, ox + 80 + s * 10, S, oz + 46, 2.4, 10); F.R(lantern, ox + 80 + s * 10, S + 10, oz + 46, 2, 1.6) }
      for (let k = 0; k < 90; k++) {
        const x = ox - 110 + rnd() * 220, z = oz - 90 + rnd() * 190
        if (Math.hypot(x - mx, z - mz) < 66 || (Math.abs(x - ox - 80) < 36 && Math.abs(z - oz - 70) < 28)) continue
        if (Math.hypot(x - lx, z - lz) < RR + 22) continue
        rnd() < 0.3 ? palm(F, x, z, 0.9 + rnd() * 0.4) : tree(F, x, z, 0.9 + rnd() * 0.6)
      }
    }
    // ══ 赤岩峡谷（东后）：红岩台地 + 大型过山车（提升坡 45m + 两个回环）+ 矿车暗乘 ══
    {
      const ox = 190, oz = 180
      for (const [dx, dz, sw, sd, h] of [[60, 60, 46, 34, 26], [40, 82, 30, 22, 38], [-70, 70, 38, 30, 20], [95, -60, 24, 30, 30], [-10, 90, 26, 18, 16]]) {
        F.K(rockRed, ox + dx, S, oz + dz, sw, h * 0.6, sd)
        F.K(rockSand, ox + dx, S + h * 0.6, oz + dz, sw * 0.8, h * 0.25, sd * 0.8)
        F.K(rockRed, ox + dx, S + h * 0.85, oz + dz, sw * 0.65, h * 0.15, sd * 0.65)
      }
      const cx = ox - 10, cz = oz - 10, Rx = 100, Rz = 74, N = 260
      const pts = []
      for (let i = 0; i <= N; i++) {
        const t = i / N * Math.PI * 2
        const x = cx + Math.cos(t) * Rx + Math.sin(2 * t) * 18
        const z = cz + Math.sin(t) * Rz
        let h
        if (t < 1.0) h = 6 + 39 * (t / 1.0)
        else if (t < 1.45) h = 45 - 41 * Math.pow((t - 1.0) / 0.45, 1.4)
        else h = 4 + 14 * (0.5 + 0.5 * Math.cos((t - 1.45) * 3.2)) * (1 - (t - 1.45) / 5.2) + 2
        pts.push([x, S + h, z])
      }
      for (let i = 0; i < N; i++) {
        const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1]
        const L = Math.hypot(x1 - x0, z1 - z0)
        const ly = Math.atan2(-(z1 - z0), x1 - x0)
        F.B(trackR, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, L + 0.4, Math.abs(y1 - y0) + 0.5, 2.0, ly)
        F.B(cSteel, (x0 + x1) / 2, (y0 + y1) / 2 + 0.5, (z0 + z1) / 2, L + 0.4, 0.2, 2.6, ly)
        if (i % 4 === 0 && y0 - S > 3) F.B(cSteel, x0, (S + y0) / 2, z0, 0.7, y0 - S, 0.7)
        if (i % 3 === 0) F0.B(bulbs[(i / 3) % 4 | 0], x0, Math.max(y0, y1) + 0.9, z0, 0.5, 0.5, 0.5)
      }
      for (const [k, s] of [[150, 1], [200, -1]]) {
        const [x, , z] = pts[k]
        for (const o of [-1.2, 1.2]) F.B(torV, x, S + 15, z + o, 26, 26, 26)
        F.B(cSteel, x, S + 1.2, z, 8, 2.4, 3)
      }
      for (let k = 0; k < 6; k++) { const [x, yy, z] = pts[40 + k * 3]; F.B(k % 2 ? cYellow : cBlue, x, yy + 1.3, z, 2.6, 1.3, 2.2) }
      // 车站 + 矿车暗乘（木构矿井门脸）
      F.K(wood, cx + Rx - 4, S, cz, 16, 6, 12)
      F.K(cCoral, cx + Rx - 4, S + 6, cz, 18, 0.7, 14, false)
      showBox(F, showTan, ox - 60, oz + 95, 56, 34, 14)
      F.K(wood, ox - 60, S + 14, oz + 95, 20, 9, 12, false)
      F.K(wood, ox - 68, S, oz + 76, 1.2, 12, 1.2, false)
      F.K(wood, ox - 52, S, oz + 76, 1.2, 12, 1.2, false)
      F.K(wood, ox - 60, S + 11, oz + 76, 18, 1.2, 1.4, false)
      for (let k = 0; k < 12; k++) { const x = ox - 90 + rnd() * 190, z = oz - 80 + rnd() * 170; F.R(cylTealT, x, S, z, 1.0, 3 + rnd() * 3) } // 仙人掌
    }
    // ══ 湖畔露天剧场（后中，朝湖）+ 云岬大剧院（东）+ 大摩天轮（西）══
    {
      const tz = LC[1] + RR + 62
      F.B(shellT, 0, S + 0.3, tz + 12, 56, 52, 40, Math.PI)
      F.K(cW, 0, S, tz + 6, 40, 1.4, 16)
      for (let r = 0; r < 7; r++) {
        const rr = 26 + r * 5
        const arc = circle(0, tz + 8, rr, 14, Math.PI * 1.15, Math.PI * 1.85)
        strip(F, r % 2 ? cCream : P0.stoneStep, arc, 4, S + (0.6 + r * 0.55) / 2, 0.6 + r * 0.55)
      }
      for (let k = 0; k < 10; k++) F.B(neon[k % 3], -18 + k * 4, S + 1.6, tz - 2.2, 3, 0.4, 0.1)
      for (const s of [-1, 1]) { F.K(cSteel, s * 30, S, tz + 4, 0.8, 18, 0.8, false); F.B(cLit, s * 30, S + 18, tz + 4, 2.4, 1.2, 1.2) }
      // 大剧院
      const hx = 170, hz = LC[1]
      F.H('#f2d4b8', 'punch', hx, S, hz, 48, 20, 44)
      F.B(vaultT, hx, S + 20 + 5, hz, 50, 10, 46)
      F.K(cCoral, hx, S + 6, hz - 22 - 2, 34, 1.2, 4, false)
      for (let k = 0; k < 16; k++) F.B(bulbs[k % 4], hx - 16 + k * 2.1, S + 6.9, hz - 26, 0.4, 0.4, 0.4)
      F.B(neon[0], hx, S + 9, hz - 22.2, 24, 1.4, 0.15)
      F.S(hx, hz, 48, 44, S + 30)
      // 大摩天轮（R 34m，16 个舱）
      const wx = -172, wz = LC[1], R = 34, hub = S + R + 4
      for (const k of [-1.6, 1.6]) { F.B(torV, wx, hub, wz + k, R * 2, R * 2, R * 2); F.B(spokeT, wx, hub, wz + k, R * 2, R * 2, R * 2); F.B(torGlow, wx, hub, wz + k * 1.15, R * 2 + 1.4, R * 2 + 1.4, R * 1.2) }
      for (const s of [-1, 1]) for (const o of [-4, 4]) F.B(cSteel, wx + s * 9, S + (hub - S) / 2, wz + o, 1.0, hub - S + 2, 1.0, 0)
      F.B(cylGoldT, wx, hub, wz, 3.4, 3.4, 4.6)
      const cabC = [cCoral, cTeal, cYellow, cPurple]
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; F.B(cabC[i % 4], wx + Math.cos(a) * R, hub + Math.sin(a) * R - 2, wz, 2.8, 2.8, 3.4) }
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; F.B(bulbs[i % 4], wx + Math.cos(a) * (R + 0.6), hub + Math.sin(a) * (R + 0.6), wz - 1.8, 0.6, 0.6, 0.6) }
      F.K(cW, wx, S, wz - 10, 16, 3, 6)
      F.S(wx, wz, 20, 10, S + 3)
    }
    // ══ 园路网（环路 → 四区）+ 摊位 / 长椅 / 垃圾桶 / 游客 ══
    for (const [a, len] of [[-2.4, 120], [-0.75, 120], [2.4, 60], [0.75, 110]]) {
      const x0 = lx + Math.cos(a) * (RR + 9), z0 = lz + Math.sin(a) * (RR + 9)
      const pts = [[x0, z0], [x0 + Math.cos(a) * len, z0 + Math.sin(a) * len]]
      strip(F, paveWarm, pts, 12, S + 0.2, 0.3)
      for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6; const x = x0 + Math.cos(a) * len * t, z = z0 + Math.sin(a) * len * t; F.B(benchP, x + Math.sin(a) * 7, S + 0.45, z - Math.cos(a) * 7, 2.2, 0.5, 0.6, -a); F.B(binP, x - Math.sin(a) * 7, S + 0.5, z + Math.cos(a) * 7, 0.7, 1, 0.7) }
    }
    for (let i = 0; i < 520; i++) {
      // 游客（远看是一片彩色小点 → 园子是「满」的）
      const a = rnd() * Math.PI * 2
      let x, z
      if (i < 260) { const r = RR + (rnd() - 0.5) * 14; x = lx + Math.cos(a) * r; z = lz + Math.sin(a) * r } else if (i < 360) { x = (rnd() - 0.5) * 50; z = ms0 + rnd() * (ms1 - ms0) } else if (i < 440) { x = (rnd() - 0.5) * 200; z = -hd + 10 + rnd() * 50 } else { x = (rnd() < 0.5 ? -1 : 1) * (100 + rnd() * 180); z = -150 + (rnd() - 0.5) * 110 }
      F.B(crowdC[(rnd() * 6) | 0], x, S + 0.85, z, 0.55, 1.7, 0.4)
    }
  }
  // ════════════ t40 扩建：整园 ≈ 1386m × 611m（核心区居中，两翼各两大园区）+ 干道对面的度假区 ════════════
  const iceW = L0('#eaf3f8', 0.05, 0.5, 0.7)
  const iceB = L0('#9fd0ea', 0.15, 0.25, 1.0)
  const pyrIce = G(geo.pyr, '#eef6fb', 0.05, 0.35, 0.8)
  const pyrIceB = G(geo.pyr, '#a8d4ee', 0.1, 0.3, 0.9)
  const conePine = G(geo.cone, '#2f5a3a', 0.0, 0.85, 0.3)
  const conePineS = G(geo.cone, '#e8f0f4', 0.0, 0.7, 0.4)
  const brass = L0('#b8864a', 0.75, 0.32, 1.0)
  const cylBrass = G(geo.cyl, '#b8864a', 0.75, 0.32, 1.0)
  const torBrass = G(geo.torus, '#b8864a', 0.75, 0.32, 1.0)
  const brick = L0('#a8553e', 0.02, 0.88, 0.3)
  const sphAir = G(geo.sph, '#c8643e', 0.2, 0.5, 0.6)
  const stemG = G(geo.cyl, '#5f9a48', 0.0, 0.7, 0.4)
  const sphPet = ['#f07aa8', '#f6cf5a', '#ff9a6a', '#a68ad8', '#fbfaf6'].map((h) => G(geo.sph, h, 0.05, 0.5, 0.5))
  const slideC = ['#e8473a', '#f6cf5a', '#2f9cc4', '#5fbf6a'].map((h) => L0(h, 0.2, 0.35, 0.7))
  const sandP = L0('#f0dcb0', 0.0, 0.95, 0.3, { craft: 'pave' })
  const iceGround = L0('#e4eef4', 0.02, 0.7, 0.5, { craft: 'pave' })
  const carC = ['#e8735a', '#3f7fc0', '#f2f0ec', '#3a3f46', '#f6cf5a', '#7a8a96'].map((h) => LP(h, 0.4, 0.4, 0.6, { lod: 600 }))
  const pine = (F, x, z, s = 1, snow = false) => { F.R(trunk, x, S, z, 0.5 * s, 2 * s); F.R(conePine, x, S + 2 * s, z, 5 * s, 9 * s); if (snow) F.R(conePineS, x, S + 7.4 * s, z, 2.6 * s, 3.8 * s) }

  /** 通用过山车：椭圆环 + 提升坡 + 俯冲 + 逐渐变小的波浪，可加竖直回环；轨道按段拼（只绕 y 旋转，远看连续） */
  function coasterLoop(F, F0, cx, cz, Rx, Rz, lift, o = {}) {
    const N = o.N || 200, tk = o.track || trackR, sup = o.sup || cSteel
    const pts = []
    for (let i = 0; i <= N; i++) {
      const t = i / N * Math.PI * 2
      const x = cx + Math.cos(t) * Rx + Math.sin(2 * t) * (o.wob ?? Rx * 0.15)
      const z = cz + Math.sin(t) * Rz
      let h
      if (t < 1.0) h = 5 + (lift - 5) * t
      else if (t < 1.45) h = lift - (lift - 4) * Math.pow((t - 1.0) / 0.45, 1.4)
      else h = 4 + lift * 0.35 * (0.5 + 0.5 * Math.cos((t - 1.45) * 3.4)) * (1 - (t - 1.45) / 5.2) + 2
      pts.push([x, S + h, z])
    }
    for (let i = 0; i < N; i++) {
      const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1]
      const L = Math.hypot(x1 - x0, z1 - z0), ly = Math.atan2(-(z1 - z0), x1 - x0)
      F.B(tk, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, L + 0.4, Math.abs(y1 - y0) + 0.5, o.wide || 2.0, ly)
      F0.B(cSteel, (x0 + x1) / 2, (y0 + y1) / 2 + 0.5, (z0 + z1) / 2, L + 0.4, 0.2, (o.wide || 2.0) + 0.6, ly)
      if (i % (o.supStep || 4) === 0 && y0 - S > 3) {
        F.B(sup, x0, (S + y0) / 2, z0, o.supW || 0.7, y0 - S, o.supW || 0.7)
        if (o.lattice && y0 - S > 8) for (let k = 1; k < (y0 - S) / 6; k++) F0.B(sup, x0, S + k * 6, z0, 0.4, 0.4, 3.2, ly)
      }
      if (i % 3 === 0) F0.B(bulbs[(i / 3) % 4 | 0], x0, Math.max(y0, y1) + 0.9, z0, 0.5, 0.5, 0.5)
    }
    for (const k of o.loops || []) { const [x, , z] = pts[k]; for (const off of [-1.2, 1.2]) F.B(o.loopPool || torV, x, S + 14, z + off, 24, 24, 24); F.B(cSteel, x, S + 1.2, z, 8, 2.4, 3) }
    for (let k = 0; k < (o.cars || 5); k++) { const [x, yy, z] = pts[Math.floor(N * 0.12) + k * 2]; F.B(k % 2 ? cYellow : (o.carPool || cBlue), x, yy + 1.3, z, 2.6, 1.3, 2.2) }
    const [sx, , sz] = pts[0]
    F.K(o.station || cW, sx - 4, S, sz, 16, 6, 12)
    F.K(cCoral, sx - 4, S + 6, sz, 18, 0.7, 14, false)
    return pts
  }
  function bigWheel(F, F0, wx, wz, R, cols) {
    const hub = S + R + 4
    for (const k of [-1.8, 1.8]) { F.B(torV, wx, hub, wz + k, R * 2, R * 2, R * 2); F.B(spokeT, wx, hub, wz + k, R * 2, R * 2, R * 2); F0.B(torGlow, wx, hub, wz + k * 1.15, R * 2 + 1.4, R * 2 + 1.4, R * 1.2) }
    for (const s of [-1, 1]) for (const o of [-5, 5]) F.B(cSteel, wx + s * R * 0.28, S + (hub - S) / 2, wz + o, 1.3, hub - S + 2, 1.3, 0)
    F.B(cylGoldT, wx, hub, wz, 4, 4, 6)
    const n = Math.round(R * 0.7)
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; F0.B(cols[i % cols.length], wx + Math.cos(a) * R, hub + Math.sin(a) * R - 2, wz, 3, 3, 3.6) }
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2; F0.B(bulbs[i % 4], wx + Math.cos(a) * (R + 0.6), hub + Math.sin(a) * (R + 0.6), wz - 2, 0.7, 0.7, 0.7) }
    F.K(cW, wx, S, wz - 12, 18, 3.4, 7)
  }
  function spiralSlide(F, cx, cz, top, r, a0, pool, turns = 2.4) {
    const N = Math.round(turns * 18)
    let p0 = null
    for (let i = 0; i <= N; i++) {
      const a = a0 + i / N * turns * Math.PI * 2, y = top - (top - 1.5) * i / N
      const p = [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]
      if (p0) { const L = Math.hypot(p[0] - p0[0], p[2] - p0[2]); F.B(pool, (p[0] + p0[0]) / 2, (p[1] + p0[1]) / 2, (p[2] + p0[2]) / 2, L + 0.3, Math.abs(p[1] - p0[1]) + 1.1, 2.2, Math.atan2(-(p[2] - p0[2]), p[0] - p0[0])) }
      p0 = p
    }
  }

  // ── 极地冰原（西前）：冰山 + 雪橇过山车 + 冰屋穹顶 + 极光塔 + 雪花转盘 + 雪松林 ──
  function polar(F, F0, ox, oz) {
    F.P(iceGround, ox, oz, 330, 250, 0.33, 0.08)
    const mx = ox - 60, mz = oz - 30
    for (const [dx, dz, s, h] of [[0, 0, 96, 34], [-12, 8, 66, 52], [10, -6, 44, 70], [-4, 10, 26, 84], [34, 26, 34, 30], [-38, -24, 30, 26]]) F.R(dx % 2 ? pyrIceB : pyrIce, mx + dx, S, mz + dz, s, h)
    F.S(mx, mz, 70, 70, S + 60)
    coasterLoop(F, F0, mx + 10, mz + 6, 100, 78, 34, { track: iceB, carPool: cCoral, N: 180, loops: [], station: iceW })
    for (const [x, z, r] of [[ox + 70, oz - 80, 22], [ox + 110, oz - 40, 16], [ox + 50, oz + 70, 18], [ox + 120, oz + 60, 12], [ox + 140, oz - 100, 10]]) { F.D(domeWhite, x, S, z, r * 2, r); F.K(cDark, x, S, z - r - 0.2, r * 0.4, 3.6, 0.5, false) }
    // 极光观测塔
    F.R(cylWhite, ox + 100, S, oz + 10, 10, 46)
    for (let k = 0; k < 6; k++) F0.B(ringTeal, ox + 100, S + 8 + k * 7, oz + 10, 11, 40, 11)
    F.R(domeGlassT, ox + 100, S + 46, oz + 10, 14, 6)
    F.R(coneWhiteT, ox + 100, S + 52, oz + 10, 6, 12)
    // 雪花转盘
    F.R(cylTealT, ox - 120, S, oz + 80, 30, 0.8)
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; F.B(iceW, ox - 120 + Math.cos(a) * 7, S + 6, oz + 80 + Math.sin(a) * 7, 14, 0.8, 1.2, -a); F.B(sphWhite, ox - 120 + Math.cos(a) * 13, S + 3, oz + 80 + Math.sin(a) * 13, 3, 2.4, 3) }
    F.R(cylWhite, ox - 120, S, oz + 80, 2, 8)
    for (let k = 0; k < 6; k++) shop(F, ox - 150 + k * 24, oz + 112, 16, 12, 8 + (k % 2) * 2, ['#dbeaf4', '#f4f0e6', '#cfe4f0'][k % 3], -1, k + 1)
    for (let k = 0; k < 60; k++) { const x = ox - 160 + rnd() * 320, z = oz - 120 + rnd() * 240; if (Math.hypot(x - mx, z - mz) < 60) continue; pine(F, x, z, 0.9 + rnd() * 0.6, true) }
  }
  // ── 蒸汽工坊（西后）：飞艇塔（82m 次地标）+ 木质过山车 + 巨型齿轮 + 机械工厂暗乘 + 「天轮」大摩天轮 ──
  function steam(F, F0, ox, oz) {
    F.P(paveRose, ox, oz, 330, 250, 0.33, 0.08)
    const tx = ox + 90, tz = oz - 40
    F.R(cylBrass, tx, S, tz, 12, 74)
    for (let k = 0; k < 7; k++) F.R(cylDarkLike(), tx, S + 8 + k * 10, tz, 13.4, 1.2)
    F.R(cylBrass, tx, S + 74, tz, 22, 2)
    F.D(domeTealT, tx, S + 76, tz, 14, 7)
    F.R(coneGoldT, tx, S + 83, tz, 4, 12)
    F.B(sphAir, tx - 26, S + 66, tz, 42, 12, 12)
    F.B(brass, tx - 26, S + 58.6, tz, 12, 3, 4)
    for (const s of [-1, 1]) F.B(cDark, tx - 46, S + 66, tz + s * 3, 6, 0.6, 5)
    F.B(cSteel, tx - 6, S + 66, tz, 10, 0.6, 0.6)
    F.S(tx, tz, 12, 12, S + 76)
    coasterLoop(F, F0, ox - 40, oz + 10, 115, 90, 38, { track: wood, sup: wood, supW: 0.9, supStep: 2, lattice: true, N: 220, carPool: cCoral, station: brick })
    for (const [x, z, r] of [[ox + 140, oz + 80, 16], [ox + 112, oz + 96, 10], [ox - 140, oz - 90, 13]]) { F.B(torBrass, x, S + r, z, r * 2, r * 2, r * 6); F.B(spokeT, x, S + r, z, r * 2, r * 2, r * 2); F.B(cylBrass, x, S + r, z, 3, 3, 3) }
    showBox(F, brick, ox - 30, oz + 115 - 40, 70, 40, 18)
    for (let k = 0; k < 4; k++) F.R(cylDarkLike(), ox - 56 + k * 17, S + 18, oz + 80, 3, 14)
    bigWheel(F, F0, ox - 120, oz - 20, 46, [cCoral, cYellow, cTeal, cPurple])
    for (let k = 0; k < 5; k++) shop(F, ox + 40 + k * 22, oz + 112, 16, 12, 9 + (k % 2) * 2, ['#c98a5a', '#d8b48a', '#a87a5a'][k % 3], -1, k + 3)
  }
  // ── 童话花园（东前）：巨型花朵 + 树篱迷宫 + 毛毛虫小过山车 + 玻璃温室 + 花瓣转转杯 ──
  function garden(F, F0, ox, oz) {
    F.P(paveWarm, ox, oz, 330, 250, 0.33, 0.08)
    for (let k = 0; k < 26; k++) {
      const x = ox - 150 + rnd() * 300, z = oz - 110 + rnd() * 70, h = 6 + rnd() * 16
      F.R(stemG, x, S, z, 0.9, h)
      const p = sphPet[(rnd() * 5) | 0], r = 3 + h * 0.25
      for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2; F0.B(p, x + Math.cos(a) * r * 0.55, S + h, z + Math.sin(a) * r * 0.55, r, r * 0.35, r) }
      F0.B(sphYel, x, S + h + 0.4, z, r * 0.55, r * 0.4, r * 0.55)
    }
    // 树篱迷宫
    const qx = ox + 80, qz = oz + 40
    for (let i = 0; i <= 8; i++) {
      if (i % 2) F.K(P0.hedge, qx, S, qz - 40 + i * 10, 80 - (i % 4) * 10, 2.4, 1.6, false)
      else F.K(P0.hedge, qx - 40 + i * 10, S, qz, 1.6, 2.4, 80 - (i % 3) * 14, false)
    }
    F.R(sphGoldT, qx, S + 2, qz, 4, 4)
    coasterLoop(F, F0, ox - 70, oz + 50, 60, 40, 14, { track: L0('#7fc65a', 0.1, 0.5, 0.5), carPool: cYellow, N: 110, wob: 10, station: cCream })
    F.D(domeGlassT, ox + 120, S, oz - 30, 56, 26)
    F.S(ox + 120, oz - 30, 44, 44, S + 26)
    ride.teacups(F, ox - 10, oz - 20)
    ride.carousel(F, ox + 30, oz - 70)
    for (let k = 0; k < 6; k++) shop(F, ox - 150 + k * 22, oz + 112, 16, 12, 7 + (k % 3) * 2, ['#f4c4d4', '#fbe6a8', '#c8e8d8'][k % 3], -1, k + 2)
  }
  // ── 浪花湾（东后）：造浪池 + 沙滩 + 四色螺旋滑梯塔 + 激流勇进 + 漂流河 + 遮阳伞 ──
  function splash(F, F0, ox, oz) {
    F.P(sandP, ox, oz, 330, 250, 0.33, 0.08)
    F.P(cWater, ox - 60, oz + 30, 150, 80, 0.4, 0.1)
    for (let k = 0; k < 30; k++) { const x = ox - 130 + (k % 10) * 15, z = oz - 20 - ((k / 10) | 0) * 9; F.R(cylWhite, x, S, z, 0.25, 3); F.R([coneCoralT, coneTealT, conePinkT][k % 3], x, S + 3, z, 4, 1.2); F.B(crowdC[k % 6], x + 1.2, S + 0.5, z + 1, 0.6, 0.4, 1.7) }
    const sx = ox + 100, sz = oz + 50
    F.R(cylWhite, sx, S, sz, 10, 32)
    F.R(cylTealT, sx, S + 32, sz, 14, 1.4)
    F.R(coneCoralT, sx, S + 33.4, sz, 14, 6)
    for (let k = 0; k < 4; k++) spiralSlide(F, sx, sz, S + 31 - k * 5, 9 + k * 3.2, k * 1.6, slideC[k], 2.2 - k * 0.3)
    F.P(cWater, sx, sz + 30, 30, 14, 0.42, 0.1)
    // 激流勇进：长坡 + 溅落池
    const fx = ox - 120, fz = oz - 90
    for (let i = 0; i < 16; i++) { const y = S + 1 + Math.min(i, 10) * 2.2 - Math.max(0, i - 10) * 4.4; F.K(cBlue, fx + i * 6, Math.max(S, y - 1.2), fz, 6.4, 1.4, 6, false); F.B(cWater, fx + i * 6, Math.max(S, y - 1.2) + 1.45, fz, 6, 0.1, 4.6); if (y > S + 3) F.B(cSteel, fx + i * 6, (S + y) / 2, fz, 0.6, y - S, 0.6) }
    F.P(cWater, fx + 110, fz, 24, 20, 0.45, 0.1)
    const river = circle(ox - 60, oz + 30, 100, 40)
    strip(F, cWater, river.map(([x, z]) => [x, z * 0.9 + (oz + 30) * 0.1]), 6, S + 0.42, 0.1)
    for (let k = 0; k < 24; k++) palm(F, ox - 160 + rnd() * 320, oz + 100 + rnd() * 20, 0.9)
  }
  function cylDarkLike() { return c.cDarkCyl || (c.cDarkCyl = G(geo.cyl, '#4a3a30', 0.4, 0.5, 0.5)) }

  B.themepark = (F0, w, d) => {
    seed = 7
    F0B = (...a) => F0.B(...a)
    const hw = w / 2, hd = d / 2
    // 占地栅格（6m 一格）：所有落地的件都登记，最后在空草坪上补种树 / 花坛 / 灌木 / 游客 → 园子是「满」的，不是一片空草地
    const CS = 6, NX = Math.ceil(w / CS), NZ = Math.ceil(d / CS)
    const occ = new Uint8Array(NX * NZ)
    const mark = (x, z, sx, sz, v = 1, y0 = 0) => {
      if (y0 > S + 6) return
      const i0 = Math.max(0, Math.floor((x - sx / 2 + hw) / CS)), i1 = Math.min(NX - 1, Math.floor((x + sx / 2 + hw) / CS))
      const j0 = Math.max(0, Math.floor((z - sz / 2 + hd) / CS)), j1 = Math.min(NZ - 1, Math.floor((z + sz / 2 + hd) / CS))
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) occ[j * NX + i] = Math.max(occ[j * NX + i], v)
    }
    const F = Object.assign(Object.create(F0), {
      K(pool, x, y0, z, sx, sy, sz, solid) { mark(x, z, sx, sz, 1, y0); return F0.K(pool, x, y0, z, sx, sy, sz, solid) },
      B(pool, x, y, z, sx, sy, sz, ly = 0) { const m = ly ? Math.max(sx, sz) : 0; mark(x, z, m || sx, m || sz, sy < 0.6 && y < S + 1 ? 2 : 1, y - sy / 2); return F0.B(pool, x, y, z, sx, sy, sz, ly) },
      R(pool, x, y0, z, dia, h, dz = dia) { mark(x, z, dia, dz, 1, y0); return F0.R(pool, x, y0, z, dia, h, dz) },
      D(pool, x, y0, z, dia, h) { mark(x, z, dia, dia, 1, y0); return F0.D(pool, x, y0, z, dia, h) },
      H(hex, style, x, y0, z, ww, h, dd) { mark(x, z, ww, dd, 1, y0); return F0.H(hex, style, x, y0, z, ww, h, dd) },
      P(pool, x, z, ww, dd, top, th) { if (pool !== P0.lawn) mark(x, z, ww, dd, pool === rockSand || pool === sandP || pool === iceGround ? 3 : 2); return F0.P(pool, x, z, ww, dd, top, th) },
    })
    F.P(P0.lawn, 0, 0, w - 2, d - 2, 0.3, 0.3)
    // ── 外围：绿篱 + 密林（入口留口）──
    for (const s of [-1, 1]) F.K(P0.hedge, s * (hw - 5), S, 0, 6, 3.4, d - 20, false)
    F.K(P0.hedge, 0, S, hd - 5, w - 20, 3.4, 6, false)
    for (const s of [-1, 1]) F.K(P0.hedge, s * (hw / 2 + 62), S, -hd + 4, hw - 124, 3.4, 5, false)
    for (let i = 0; i < 260; i++) {
      const t = i / 260
      tree(F, -hw + 30 + t * (w - 60), hd - 14 - rnd() * 8, 1.1 + rnd() * 0.5)
      if (Math.abs(-hw + 30 + t * (w - 60)) > 130) tree(F, -hw + 30 + t * (w - 60), -hd + 12 + rnd() * 5, 1.0 + rnd() * 0.4)
    }
    for (let i = 0; i < 50; i++) for (const s of [-1, 1]) tree(F, s * (hw - 14 - rnd() * 6), -hd + 30 + i / 50 * (d - 50), 1.1 + rnd() * 0.5)
    // ── 核心区（居中 640m）──
    core(F, F0, 640, d)
    // ── 两翼 E-W 巡游大道（穿过四个新园区，连到核心区的环湖大道）──
    for (const s of [-1, 1]) {
      const x0 = s * 300, x1 = s * (hw - 20)
      F.P(paveWarm, (x0 + x1) / 2, 0, Math.abs(x1 - x0), 18, 0.36, 0.12)
      F.P(parade, (x0 + x1) / 2, 0, Math.abs(x1 - x0), 1.4, 0.4, 0.04)
      for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x += 16) { lamp(F, x, -11, 6); lamp(F, x, 11, 6); festoon(F, x, -11, x + 16, -11, 6.4); festoon(F, x, 11, x + 16, 11, 6.4) }
      for (let k = 0; k < 6; k++) {
        const x = s * (380 + k * 48)
        const [base, top] = [[cCoral, sphYel], [cTeal, sphPink], [cPurple, sphMint]][k % 3]
        F.B(base, x, S + 1.3, 3, 9, 1.6, 4.4)
        F.B(top, x, S + 4.6, 3, 4.6, 5, 4.6)
        F.B(k % 2 ? coneGoldT : coneCoralT, x, S + 8.2, 3, 2.4, 3, 2.4)
        for (let q = 0; q < 16; q++) F.B(crowdC[(rnd() * 6) | 0], x + (rnd() - 0.5) * 30, S + 0.85, (rnd() < 0.5 ? -1 : 1) * (7 + rnd() * 2), 0.55, 1.7, 0.4)
      }
    }
    polar(F, F0, -(hw + 330) / 2 - 8, -158)
    steam(F, F0, -(hw + 330) / 2 - 8, 160)
    garden(F, F0, (hw + 330) / 2 + 8, -158)
    splash(F, F0, (hw + 330) / 2 + 8, 160)
    fillLawn(F0, occ, NX, NZ, CS, hw, hd)
  }

  // ── 乐园度假区（干道对面）：主题大酒店 + 现代酒店塔 + 入口小镇步行街 + 停车场 + 跨干道步行桥 & 单轨 ──
  B.parkresort = (F, w, d) => {
    seed = 11
    const hw = w / 2, hd = d / 2
    F.P(P0.lawn, 0, 0, w - 2, d - 2, 0.3, 0.3)
    // 入口小镇步行街（正对步行桥）
    F.P(paveWarm, 0, -hd + 150, 60, 300, 0.36, 0.12)
    const pal = ['#f2b8a0', '#a8d8c8', '#f6dc8a', '#c8b8e8', '#f4c4d4', '#b8d4f0']
    for (const s of [-1, 1]) for (let k = 0; k < 11; k++) {
      const z = -hd + 20 + k * 25
      F.H(pal[(k + (s > 0 ? 3 : 0)) % 6], 'punch', s * 40, S, z, 20, 10 + (k % 3) * 2, 22)
      F.B(P0.gablePools[k % P0.gablePools.length], s * 40, S + 12 + (k % 3) * 2, z, 21, 4.4, 23)
      F.B(P0.awningPools[k % P0.awningPools.length], s * 29, S + 3.4, z, 2, 0.18, 18)
      F.B(neon[k % 3], s * 29.9, S + 5.2, z, 0.12, 0.6, 10)
      lamp(F, s * 26, z + 12, 5)
      festoon(F, -26, z + 12, 26, z + 12, 6.4, 2.4, 1.2)
    }
    for (let i = 0; i < 160; i++) F.B(crowdC[(rnd() * 6) | 0], (rnd() - 0.5) * 48, S + 0.85, -hd + 10 + rnd() * 290, 0.55, 1.7, 0.4)
    // 主题大酒店（U 形：主楼 + 两翼 + 中庭泳池 + 金穹顶）
    const hz = hd - 100
    F.H('#f2d4b8', 'punch', 0, S, hz + 40, 150, 46, 34)
    for (const s of [-1, 1]) { F.H('#f4e0c8', 'punch', s * 62, S, hz - 20, 30, 34, 90); F.B(P0.gablePools[1], s * 62, S + 36, hz - 20, 31, 5, 91) }
    F.B(P0.gablePools[1], 0, S + 48.5, hz + 40, 151, 5, 35)
    F.D(domeTealT, 0, S + 51, hz + 40, 26, 14)
    F.R(coneGoldT, 0, S + 65, hz + 40, 5, 12)
    F.P(cWater, 0, hz - 10, 70, 50, 0.4, 0.1)
    for (let k = 0; k < 14; k++) palm(F, -40 + (k % 7) * 13, hz - 44 + ((k / 7) | 0) * 68, 0.9)
    // 现代酒店塔 + 霓虹冠
    F.H('#9fc4e0', 'curtain', hw - 70, S, hz, 40, 92, 34)
    F0ring(F, hw - 70, S + 92, hz)
    // 停车场（两大片）+ 车
    for (const s of [-1, 1]) {
      const px = s * (hw - 120), pz = -hd + 130
      F.P(P0.tarmac, px, pz, 200, 220, 0.42, 0.14)
      for (let r = 0; r < 8; r++) for (let q = 0; q < 26; q++) {
        if (rnd() < 0.25) continue
        F.B(carC[(rnd() * 6) | 0], px - 90 + q * 7, S + 1.12, pz - 95 + r * 26, 2.0, 1.4, 4.4)
      }
      for (let r = 0; r < 8; r++) F.P(P0.lineW, px, pz - 95 + r * 26 + 13, 190, 0.3, 0.46, 0.03)
    }
    // 跨干道步行桥（桥面 8m 高，车从下面过）+ 单轨（12m）：两端各一个楼梯塔，不在干道上铺任何板
    const bz0 = -hd + 4, bz1 = -hd - 54
    F.B(cW, 110, S + 8, (bz0 + bz1) / 2, 10, 1.0, bz0 - bz1)
    for (const s of [-1, 1]) F.B(cSteel, 110 + s * 5, S + 9.2, (bz0 + bz1) / 2, 0.2, 1.4, bz0 - bz1)
    F.B(cTeal, 110, S + 12, (bz0 + bz1) / 2, 11, 0.4, bz0 - bz1)
    for (const z of [bz0 + 2, bz1 - 2]) { F.K(cW, 110, S, z, 12, 12.4, 6); F.R(cylTealT, 110 + 8, S, z, 3, 12) }
    for (let k = 0; k < 24; k++) F.B(bulbs[k % 4], 110 + (k % 2 ? 5.4 : -5.4), S + 11.6, bz0 - k * 2.4, 0.45, 0.45, 0.45)
    F.B(cW, 150, S + 14, (bz0 + bz1) / 2 + 40, 2, 1.4, bz0 - bz1 + 80)
    F.R(cylWhite, 150, S, bz0 + 20, 1.6, 13.3)
    for (let k = 0; k < 4; k++) F.B(k ? cW : cCoral, 150, S + 16, bz0 - 10 - k * 5, 3, 2.6, 4.6)
    F.sign('themepark', 110, S + 14.6, bz0 - 2, 14)
    // 度假区园林：密植树 + 花坛 + 灌木 + 小径（避开步行街 / 停车场 / 酒店 / 塔楼 / 桥头），航拍不再是一整片空草坪
    const busy = (x, z) => Math.abs(x) < 36 && z < -hd + 305 || Math.abs(Math.abs(x) - (hw - 120)) < 106 && Math.abs(z - (-hd + 130)) < 116 ||
      Math.abs(x) < 84 && z > hz - 70 && z < hz + 62 || Math.abs(x - (hw - 70)) < 26 && Math.abs(z - hz) < 22 || Math.abs(x - 110) < 14 && z < -hd + 12
    for (const s of [-1, 1]) F.P(paveWarm, s * 160, hz - 60, 8, d - 340, 0.36, 0.12)
    F.P(paveWarm, 0, hz - 90, w - 60, 8, 0.36, 0.12)
    for (let k = 0; k < 2600; k++) {
      const x = (rnd() - 0.5) * (w - 24), z = (rnd() - 0.5) * (d - 24)
      if (busy(x, z) || Math.abs(Math.abs(x) - 160) < 6 || Math.abs(z - (hz - 90)) < 6) continue
      const r = rnd()
      if (r < 0.36) tree(F, x, z, 0.8 + rnd() * 0.5, rnd() < 0.15 ? 1 : 0)
      else if (r < 0.5) { F.B(flower[(rnd() * 5) | 0], x, S + 0.55, z, 3.2, 0.5, 2.2, rnd() * 3); F.B(flower[(rnd() * 5) | 0], x + 1.6, S + 0.55, z + 1.4, 2.2, 0.5, 1.6, rnd() * 3) }
      else if (r < 0.6) F.B(P0.hedge, x, S + 0.7, z, 3 + rnd() * 2, 1.4, 1.2, rnd() * 3)
    }
  }
  function F0ring(F, x, y, z) { for (let k = 0; k < 3; k++) F.B(neon[k], x, y - 2 - k * 3, z, 42, 0.6, 36) }
  function cIceLike() { return c.cIce }
  function fillLawn(F, occ, NX, NZ, CS, hw, hd) {
    for (let j = 2; j < NZ - 2; j++) for (let i = 2; i < NX - 2; i++) {
      const v = occ[j * NX + i]
      const x = -hw + (i + 0.5) * CS + (rnd() - 0.5) * 3, z = -hd + (j + 0.5) * CS + (rnd() - 0.5) * 3
      const r = rnd()
      if (v === 0) {
        if (r < 0.3) tree(F, x, z, 0.7 + rnd() * 0.5, rnd() < 0.18 ? 1 : 0)
        else if (r < 0.42) { F.B(flower[(rnd() * 5) | 0], x, S + 0.55, z, 3.2, 0.5, 2.2, rnd() * 3); F.B(flower[(rnd() * 5) | 0], x + 1.6, S + 0.55, z + 1.4, 2.2, 0.5, 1.6, rnd() * 3) }
        else if (r < 0.5) F.B(P0.hedge, x, S + 0.7, z, 3 + rnd() * 2, 1.4, 1.2, rnd() * 3)
        else if (r < 0.53) F.B(benchP, x, S + 0.45, z, 2.2, 0.5, 0.6, rnd() * 3)
      } else if (v === 2 && r < 0.09) {
        F.B(crowdC[(rnd() * 6) | 0], x, S + 0.85, z, 0.55, 1.7, 0.4)
        if (r < 0.03) F.B(crowdC[(rnd() * 6) | 0], x + 0.8, S + 0.8, z + 0.3, 0.5, 1.6, 0.4)
      } else if (v === 3 && r < 0.06) F.R(cylTealT, x, S, z, 0.9, 2.5 + rnd() * 3)
    }
  }
}
