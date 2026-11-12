import * as THREE from 'three'

/**
 * 新增街区：商场 / 桥梁 / 高架 / 超高层 / 住宅区 / 停车楼 / 轻轨 / 公园
 * 以及贯穿全场地的城市路网与车流（静态摆放）。
 * 全部按 1:1 米制建模：车道 3.5m、层高 4m、门高 2.6~3.2m、车身 4.6m。
 */

/** 两点之间的圆杆（斜拉索 / 斜撑 / 栏杆） */
function strut(g, a, b, r, mat, seg = 6) {
  const v = new THREE.Vector3().subVectors(b, a)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), seg), mat)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize())
  m.castShadow = true
  g.add(m)
  return m
}

export function makeDistrict(kit) {
  const { M, box, cyl, cone, add, group, win, gridGlass, paved, treeAt, bushAt, hedge, planter, lampPost, benchAt, carAt, steps, railing, parapet } = kit

  // ---------------- 车辆族 ----------------
  function wheels(s, len, wid, r = 0.36) {
    for (const sx of [-len * 0.32, len * 0.32]) {
      for (const sz of [-1, 1]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.26, 12), M.charcoal)
        wh.rotation.x = Math.PI / 2
        wh.position.set(sx, r, sz * (wid / 2 - 0.06))
        wh.castShadow = true
        s.add(wh)
      }
    }
  }
  /** 低模小汽车：只用于街道车流（省 draw call） */
  function carLo(g, x, z, ry, col = M.paintBlue) {
    const s = new THREE.Group()
    s.position.set(x, 0, z)
    s.rotation.y = ry
    g.add(s)
    box(4.4, 0.62, 1.8, col, 0, 0.72, 0, s)
    box(2.5, 0.6, 1.66, col, -0.2, 1.28, 0, s)
    box(2.3, 0.42, 1.7, M.glSmoke, -0.2, 1.32, 0, s)
    box(0.1, 0.16, 0.32, M.glazeWhite, 2.2, 0.78, 0.58, s)
    box(0.1, 0.16, 0.32, M.glazeWhite, 2.2, 0.78, -0.58, s)
    box(0.1, 0.16, 0.3, M.paintRed, -2.2, 0.8, 0.56, s)
    box(0.1, 0.16, 0.3, M.paintRed, -2.2, 0.8, -0.56, s)
    for (const sx of [-1.4, 1.4]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.7, 8), M.charcoal)
      wh.rotation.x = Math.PI / 2
      wh.position.set(sx, 0.34, 0)
      s.add(wh)
    }
    return s
  }
  /** 公交车 11.5m */
  function busAt(g, x, z, ry, col = M.paintBlue) {
    const s = new THREE.Group()
    s.position.set(x, 0, z)
    s.rotation.y = ry
    g.add(s)
    const L = 11.5, W = 2.55
    box(L, 2.0, W, col, 0, 1.75, 0, s)
    box(L - 0.2, 1.0, W - 0.05, M.glSmoke, 0, 2.45, 0, s)
    box(L - 0.4, 1.6, W - 0.06, M.glSmoke, 0, 2.25, 0, s)
    box(L + 0.1, 0.3, W + 0.06, M.glazeWhite, 0, 3.02, 0, s)
    box(L - 0.6, 0.1, W, M.aluPanel, 0, 1.1, 0, s)
    box(2.4, 1.15, W + 0.02, M.glTeal, L / 2 - 0.05, 2.5, 0, s)
    box(0.9, 2.2, 0.14, M.glSmoke, L / 2 + 0.02, 1.6, -0.7, s)
    box(0.9, 2.2, 0.14, M.glSmoke, -L / 2 - 0.02, 1.6, -0.7, s)
    box(1.6, 0.6, 0.1, M.paintYell, L / 2 + 0.06, 2.75, 0.7, s)
    wheels(s, L, W, 0.5)
    return s
  }
  /** 货车 9m */
  function truckAt(g, x, z, ry, col = M.glazeWhite) {
    const s = new THREE.Group()
    s.position.set(x, 0, z)
    s.rotation.y = ry
    g.add(s)
    box(3.4, 2.5, 2.4, col, 3.1, 1.75, 0, s)
    box(1.6, 1.15, 2.3, M.glSmoke, 3.4, 2.6, 0, s)
    box(5.6, 3.0, 2.5, M.aluPanel, -1.0, 2.05, 0, s)
    for (let i = 0; i < 5; i++) box(0.1, 2.9, 2.56, M.aluDark, -3.4 + i * 1.2, 2.05, 0, s)
    box(0.3, 0.3, 2.1, M.charcoal, 3.1, 0.55, 0, s)
    wheels(s, 7.2, 2.5, 0.46)
    return s
  }
  /** 厢式面包车 5.6m */
  function vanAt(g, x, z, ry, col = M.glazeWhite) {
    const s = new THREE.Group()
    s.position.set(x, 0, z)
    s.rotation.y = ry
    g.add(s)
    box(5.6, 2.2, 2.0, col, 0, 1.4, 0, s)
    box(3.2, 1.0, 2.02, M.glSmoke, -0.6, 1.95, 0, s)
    box(1.6, 0.8, 2.02, M.glSmoke, 2.0, 1.9, 0, s)
    box(0.16, 0.5, 1.7, M.glazeWhite, 2.82, 0.75, 0, s)
    box(0.16, 0.4, 1.7, M.paintRed, -2.82, 0.9, 0, s)
    wheels(s, 5.0, 2.0, 0.34)
    return s
  }
  /** 摩托车 / 电动车 */
  function motoAt(g, x, z, ry, col = M.paintRed) {
    const s = new THREE.Group()
    s.position.set(x, 0, z)
    s.rotation.y = ry
    g.add(s)
    for (const sx of [-0.62, 0.62]) {
      const wh = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 14), M.charcoal)
      wh.position.set(sx, 0.3, 0)
      s.add(wh)
    }
    box(1.1, 0.24, 0.3, col, 0, 0.72, 0, s)
    box(0.34, 0.12, 0.34, M.charcoal, -0.1, 0.92, 0, s)
    box(0.7, 0.1, 0.1, M.brightSilver, 0.42, 1.0, 0, s)
    box(0.22, 0.5, 0.24, M.glazeWhite, 0.85, 0.9, 0, s)
    box(0.3, 0.5, 0.16, M.paintYell, -0.72, 0.68, 0, s)
    return s
  }
  /** 自行车 */
  function bikeAt(g, x, z, ry, col = M.paintGreen) {
    const s = new THREE.Group()
    s.position.set(x, 0, z)
    s.rotation.y = ry
    g.add(s)
    for (const sx of [-0.52, 0.52]) {
      const wh = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 4, 16), M.charcoal)
      wh.position.set(sx, 0.34, 0)
      s.add(wh)
    }
    box(1.0, 0.05, 0.05, col, 0, 0.72, 0, s)
    box(0.05, 0.5, 0.05, col, -0.3, 0.5, 0, s)
    box(0.05, 0.45, 0.05, col, 0.36, 0.55, 0, s)
    box(0.28, 0.06, 0.14, M.charcoal, -0.36, 0.86, 0, s)
    box(0.05, 0.14, 0.5, M.brightSilver, 0.44, 0.86, 0, s)
    return s
  }

  // ---------------- 137 购物中心（3×3） ----------------
  function t137(x, z) {
    const g = group(x, z, 0)
    const W = 104, D = 76, H = 22
    // 场地
    paved(g, 0, 6, 146, 158, M.paving, 4.4, 'x')
    // 主卖场（石材 + 三层通高橱窗）
    box(W, H, D, M.limestone, 0, H / 2, -18, g)
    for (const y of [7.4, 14.8, 21.6]) box(W + 0.4, 0.6, D + 0.4, M.whiteStone, 0, y, -18, g)
    for (let f = 0; f < 3; f++) {
      const y = 3.9 + f * 7.4
      for (const sz of [-1, 1]) {
        box(W - 5, 4.4, 0.26, M.glSmoke, 0, y, -18 + sz * (D / 2 + 0.12), g)
        for (let i = 0; i <= 26; i++) box(0.16, 4.4, 0.34, M.aluDark, -(W - 5) / 2 + i * ((W - 5) / 26), y, -18 + sz * (D / 2 + 0.2), g)
        box(W - 5, 0.22, 0.4, M.brightSilver, 0, y + 2.2, -18 + sz * (D / 2 + 0.22), g)
      }
      for (const sx of [-1, 1]) {
        box(0.26, 4.4, D - 6, M.glSmoke, sx * (W / 2 + 0.12), y, -18, g)
        for (let i = 0; i <= 18; i++) box(0.34, 4.4, 0.16, M.aluDark, sx * (W / 2 + 0.2), y, -18 - (D - 6) / 2 + i * ((D - 6) / 18), g)
      }
    }
    // 主入口玻璃中庭（椭圆鼓体）
    const atrium = new THREE.Mesh(new THREE.CylinderGeometry(15, 16.5, 27, 32, 1, false), M.glWhite)
    atrium.scale.z = 0.72
    atrium.position.set(4, 13.5, 24)
    atrium.castShadow = atrium.receiveShadow = true
    g.add(atrium)
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 27, 0.3), M.brightSilver)
      rib.position.set(4 + Math.cos(a) * 15.1, 13.5, 24 + Math.sin(a) * 10.9)
      rib.rotation.y = -a
      g.add(rib)
    }
    for (const y of [8.0, 16.0, 22.0]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(15.2, 0.16, 6, 40), M.brightSilver)
      ring.rotation.x = Math.PI / 2
      ring.scale.z = 0.72
      add(ring, 4, y, 24, g)
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(15.4, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.glWhite)
    dome.scale.set(1, 0.34, 0.72)
    add(dome, 4, 27, 24, g)
    // 中庭雨篷 + 旋转门
    box(34, 0.5, 9, M.membrane, 4, 7.2, 34, g)
    for (let i = 0; i < 4; i++) cyl(0.18, 0.2, 7.0, M.brightSilver, -11 + i * 10, 3.5, 38, 8, g)
    for (const dx of [-6.4, 0, 6.4]) {
      cyl(2.2, 2.2, 3.2, M.glWhite, 4 + dx, 1.6, 33.4, 18, g)
      cyl(2.3, 2.3, 0.3, M.brightSilver, 4 + dx, 3.3, 33.4, 18, g)
    }
    steps(g, 40, 3, 0.2, 1.2, 0, M.whiteStone, 33.0)
    // 巨幅 LED 屏 + 竖招牌
    box(30, 12, 0.6, M.charcoal, -32, 14, 20.6, g)
    box(28.4, 10.4, 0.2, M.glDeepBlue, -32, 14, 20.94, g)
    for (let i = 0; i < 4; i++) box(26, 0.5, 0.1, [M.glTeal, M.glRose, M.glAmber, M.glViolet][i], -32, 10 + i * 2.6, 21.06, g)
    box(2.6, 18, 0.6, M.paintRed, 44, 16, 20.6, g)
    for (let i = 0; i < 5; i++) box(1.9, 0.9, 0.16, M.glazeWhite, 44, 9.4 + i * 2.9, 21.0, g)
    // 屋顶：影院盒子（西）+ 屋顶花园（东）
    box(44, 12, 32, M.aluPanel, -28, H + 6, -22, g)
    box(45, 0.6, 33, M.aluDark, -28, H + 12.3, -22, g)
    for (let i = 0; i < 4; i++) box(7.4, 4.6, 0.4, [M.glRose, M.glTeal, M.glAmber, M.glViolet][i], -46 + i * 11, H + 5.0, -5.7, g)
    box(20, 3.0, 0.5, M.paintRed, -28, H + 9.6, -5.6, g)
    box(18, 1.6, 0.2, M.glazeWhite, -28, H + 9.6, -5.28, g)
    box(46, 0.3, 34, M.paving, 26, H + 0.2, -16, g)
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), M.leaf)
      c.position.set(12 + (i % 4) * 8, H + 1.5, -28 + Math.floor(i / 4) * 18)
      c.scale.set(1, 0.8, 1)
      c.castShadow = true
      g.add(c)
    }
    for (let i = 0; i < 5; i++) planter(g, 10 + i * 7, -6, 3.0, 1.4, H + 0.35)
    box(1.2, 1.0, 1.2, M.glazeWhite, 44, H + 0.7, -34, g)
    // 东侧三层停车楼
    const px = 52, pz = 50
    for (let lv = 0; lv < 3; lv++) {
      box(56, 0.5, 38, M.concrete, px, 3.4 + lv * 3.4, pz, g)
      for (let i = 0; i < 8; i++) {
        for (const sz of [-1, 1]) box(0.5, 3.4, 0.5, M.concrete, px - 26 + i * 7.4, 1.7 + lv * 3.4, pz + sz * 18, g)
      }
      for (const sx of [-1, 1]) box(56, 0.9, 0.3, M.aluPanel, px, 3.2 + lv * 3.4, pz + sx * 19.2, g)
      for (let i = 0; i < 6; i++) carAt(g, px - 22 + i * 8.4, pz - 10 + (lv % 2) * 0.4, lv % 2 ? Math.PI : 0, [M.glazeWhite, M.charcoal, M.paintRed, M.paintBlue, M.glSilver, M.paintYell][i], 4.6, 3.65 + lv * 3.4)
    }
    // 停车坡道 + 竖向楼梯核
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.5, 34), M.concrete)
    ramp.position.set(px + 30, 6.8, pz)
    ramp.rotation.z = -0.14
    g.add(ramp)
    box(6, 10.4, 6, M.whiteStone, px + 30, 5.2, pz + 20, g)
    // 广场：公交站 / 出租车 / 自行车 / 行人
    box(14, 0.3, 3.4, M.membrane, -34, 3.2, 44, g)
    for (const dx of [-40, -28]) cyl(0.14, 0.16, 3.2, M.aluPanel, dx, 1.6, 44, 6, g)
    benchAt(g, -34, 43, Math.PI)
    busAt(g, -20, 48, Math.PI / 2)
    for (let i = 0; i < 5; i++) carAt(g, -4 + i * 6.2, 44, 0, [M.paintYell, M.glazeWhite, M.charcoal, M.paintBlue, M.glSilver][i])
    for (let i = 0; i < 9; i++) bikeAt(g, -46 + i * 1.3, 36, Math.PI / 2, [M.paintGreen, M.paintRed, M.paintBlue][i % 3])
    for (let i = 0; i < 7; i++) treeAt(g, -52 + i * 13, 66, 1.15, 3.6)
    for (let i = 0; i < 4; i++) lampPost(g, -42 + i * 28, 62, 8.0, Math.PI)
    for (let i = 0; i < 10; i++) {
      box(0.36, 1.15, 0.3, [M.charcoal, M.paintBlue, M.paintRed, M.glazeWhite][i % 4], -30 + i * 6.4, 0.58, 38 + (i % 2) * 3, g)
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M.plaster)
      add(hd, -30 + i * 6.4, 1.32, 38 + (i % 2) * 3, g)
    }
    return { g, top: H + 14 }
  }

  // ---------------- 138 斜拉桥（3×1） ----------------
  function t138(x, z) {
    const g = group(x, z, 0)
    // 运河 + 石砌驳岸
    box(150, 0.4, 30, M.glTeal, 0, 0.12, 0, g)
    box(150, 0.5, 1.4, M.curb, 0, 0.3, 15.7, g)
    box(150, 0.5, 1.4, M.curb, 0, 0.3, -15.7, g)
    for (const sz of [-1, 1]) {
      box(150, 0.14, 10, M.paving, 0, 0.06, sz * 20.5, g)
      for (let i = 0; i < 12; i++) treeAt(g, -68 + i * 12.4, sz * 23.4, 0.7, 2.6)
      for (let i = 0; i < 6; i++) lampPost(g, -62 + i * 25, sz * 17.6, 5.4, sz > 0 ? 0 : Math.PI)
    }
    // 桥面
    box(150, 1.8, 16, M.concrete, 0, 9.0, 0, g)
    box(150, 0.3, 16.4, M.aluPanel, 0, 10.0, 0, g)
    box(150, 0.08, 13, M.aluDark, 0, 10.2, 0, g)
    for (let i = 0; i < 30; i++) box(2.4, 0.06, 0.24, M.roadPaint, -70 + i * 4.8, 10.26, 0, g)
    for (const sz of [-1, 1]) {
      box(150, 0.5, 0.4, M.brightSilver, 0, 11.0, sz * 7.6, g)
      for (let i = 0; i < 60; i++) box(0.12, 1.1, 0.12, M.brightSilver, -74 + i * 2.5, 10.75, sz * 7.6, g)
      box(150, 0.14, 0.22, M.brightSilver, 0, 11.35, sz * 7.6, g)
    }
    // 桥墩
    for (const bx of [-52, 0, 52]) {
      for (const sz of [-1, 1]) {
        box(4.4, 9.0, 3.0, M.whiteStone, bx, 4.5, sz * 4.2, g)
      }
      box(24, 1.6, 15, M.concrete, bx, 8.2, 0, g)
    }
    // 两座 A 形主塔
    for (const tx of [-22, 22]) {
      for (const sz of [-1, 1]) {
        strut(g, new THREE.Vector3(tx, 10.4, sz * 5.4), new THREE.Vector3(tx, 46, sz * 1.0), 0.8, M.whiteStone, 8)
      }
      box(6.0, 1.4, 11, M.whiteStone, tx, 32, 0, g)
      box(5.0, 1.0, 9, M.whiteStone, tx, 41.5, 0, g)
      box(2.2, 2.2, 2.2, M.glazeWhite, tx, 47.4, 0, g)
      cyl(0.16, 0.2, 6.0, M.brightSilver, tx, 51.0, 0, 6, g)
      // 斜拉索（扇形）
      for (let i = 0; i < 9; i++) {
        for (const sz of [-1, 1]) {
          strut(g, new THREE.Vector3(tx, 40.5 - i * 0.5, sz * 1.4), new THREE.Vector3(tx + (i - 4) * 5.2, 10.4, sz * 7.2), 0.055, M.brightSilver, 4)
        }
      }
    }
    // 桥上车 / 桥下游船
    for (let i = 0; i < 7; i++) carAt(g, -60 + i * 19, 3.4, 0, [M.paintRed, M.glazeWhite, M.paintBlue, M.charcoal, M.paintYell, M.glSilver, M.paintGreen][i])
    for (let i = 0; i < 6; i++) carAt(g, 66 - i * 21, -3.4, Math.PI, [M.glazeWhite, M.charcoal, M.paintBlue, M.paintRed, M.glSilver, M.paintYell][i])
    truckAt(g, -30, 3.6, 0)
    vanAt(g, 40, -3.6, Math.PI, M.glazeWhite)
    // 游船
    for (const [bx, bz, ry] of [[-8, 6, 0.1], [30, -7, Math.PI]]) {
      box(12, 1.2, 3.4, M.glazeWhite, bx, 0.5, bz, g)
      box(9, 1.6, 2.6, M.glazeWhite, bx - 0.5, 1.6, bz, g)
      box(9.2, 0.5, 2.7, M.glTeal, bx - 0.5, 2.0, bz, g)
      box(2.2, 1.0, 2.2, M.whiteStone, bx + 4, 1.6, bz, g)
      for (let i = 0; i < 3; i++) box(0.3, 0.6, 0.16, M.glazeWhite, bx - 3 + i * 2.4, 1.5, bz + 1.5, g)
      void ry
    }
    return { g, top: 56 }
  }

  // ---------------- 139 三孔石拱桥（2×1） ----------------
  function t139(x, z) {
    const g = group(x, z, 0)
    // 河道
    box(98, 0.4, 26, M.glTeal, 0, 0.12, 0, g)
    box(98, 0.5, 1.2, M.curb, 0, 0.28, 13.6, g)
    box(98, 0.5, 1.2, M.curb, 0, 0.28, -13.6, g)
    for (const sz of [-1, 1]) {
      box(98, 0.16, 12, M.paving, 0, 0.06, sz * 20, g)
      for (let i = 0; i < 8; i++) treeAt(g, -42 + i * 12, sz * 22, 0.8, 2.8)
      for (let i = 0; i < 4; i++) lampPost(g, -36 + i * 24, sz * 14.6, 4.6, sz > 0 ? 0 : Math.PI)
    }
    // 桥身（分段：两端引桥 + 中间拱上实腹）
    const deckY = 6.4
    box(98, 1.4, 12, M.tuff, 0, deckY - 0.7, 0, g)
    box(98, 0.3, 12.6, M.whiteStone, 0, deckY, 0, g)
    box(98, 0.1, 10.4, M.paving, 0, deckY + 0.2, 0, g)
    // 三个半圆拱 + 桥墩
    for (const ax of [-17, 0, 17]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(7.4, 1.9, 8, 26, Math.PI), M.tuff)
      arch.position.set(ax, deckY - 0.6, 0)
      arch.rotation.z = Math.PI
      arch.castShadow = arch.receiveShadow = true
      g.add(arch)
      const hole = new THREE.Mesh(new THREE.TorusGeometry(5.9, 1.0, 6, 22, Math.PI), M.curb)
      hole.position.set(ax, deckY - 0.6, 0)
      hole.rotation.z = Math.PI
      g.add(hole)
    }
    for (const px of [-30.5, -8.5, 8.5, 30.5]) box(3.2, deckY - 1.0, 12, M.tuff, px, (deckY - 1.0) / 2, 0, g)
    // 桥栏：望柱 + 栏板
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 26; i++) {
        box(0.4, 1.0, 0.4, M.whiteStone, -48 + i * 3.84, deckY + 0.6, sz * 6.0, g)
        box(0.24, 0.24, 0.24, M.whiteStone, -48 + i * 3.84, deckY + 1.2, sz * 6.0, g)
      }
      box(98, 0.34, 0.34, M.whiteStone, 0, deckY + 1.02, sz * 6.0, g)
      box(98, 0.2, 0.2, M.whiteStone, 0, deckY + 0.55, sz * 6.0, g)
    }
    // 拱顶石雕 + 神兽
    for (const ax of [-17, 0, 17]) {
      const beast = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), M.whiteStone)
      beast.scale.set(1.4, 0.8, 0.9)
      add(beast, ax, deckY + 1.4, 6.0, g)
    }
    // 行人 + 车
    for (let i = 0; i < 9; i++) {
      box(0.36, 1.1, 0.3, [M.charcoal, M.paintRed, M.paintBlue, M.glazeWhite][i % 4], -14 + i * 3.6, deckY + 0.75, -2 + (i % 3) * 1.4, g)
    }
    for (let i = 0; i < 4; i++) bikeAt(g, -30 + i * 14, 2.2, 0, [M.paintGreen, M.paintRed, M.paintBlue][i % 3])
    // 河岸垂柳 + 长椅
    for (const [bx, bz] of [[-34, 17], [6, 17], [-20, -17], [24, -17]]) benchAt(g, bx, bz, bz > 0 ? Math.PI : 0)
    return { g, top: 12 }
  }

  // ---------------- 140 高架快速路（2×1） ----------------
  function t140(x, z) {
    const g = group(x, z, 0)
    paved(g, 0, 0, 106, 48, M.paving, 4.2, 'x')
    const dy = 10.5
    // 高架桥面（双向 8 车道，宽 32）
    box(98, 1.8, 32, M.concrete, 0, dy, 0, g)
    box(98, 0.4, 32.4, M.whiteStone, 0, dy + 1.0, 0, g)
    box(98, 0.1, 30, M.aluDark, 0, dy + 1.12, 0, g)
    // 车道线
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 18; k++) box(2.6, 0.06, 0.2, M.roadPaint, -44 + k * 5.0, dy + 1.2, -11 + i * 7.3, g)
    }
    for (const sz of [-1, 1]) box(98, 0.12, 0.4, M.paintYell, 0, dy + 1.2, sz * 0.5, g)
    // 桥墩 + 盖梁
    for (let i = 0; i < 6; i++) {
      const px = -40 + i * 16
      box(4.6, dy, 4.2, M.whiteStone, px, dy / 2, 0, g)
      box(9.0, 1.4, 26, M.concrete, px, dy - 1.4, 0, g)
      for (const sz of [-1, 1]) box(2.2, 0.8, 2.2, M.tuff, px, 0.4, sz * 9, g)
    }
    // 两侧隔音屏（透明板 + 立柱）
    for (const sz of [-1, 1]) {
      for (let i = 0; i <= 24; i++) box(0.24, 4.6, 0.24, M.aluPanel, -48 + i * 4.0, dy + 3.4, sz * 16.1, g)
      box(98, 4.4, 0.12, M.glTeal, 0, dy + 3.4, sz * 16.1, g)
      box(98, 0.4, 0.4, M.aluDark, 0, dy + 5.7, sz * 16.1, g)
    }
    // 下行匝道（一端）
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(30, 0.9, 12), M.concrete)
    ramp.position.set(42, 5.6, 20)
    ramp.rotation.z = -0.18
    ramp.rotation.y = -0.22
    ramp.castShadow = ramp.receiveShadow = true
    g.add(ramp)
    for (let i = 0; i < 4; i++) box(2.4, 5.0 - i * 1.1, 2.4, M.whiteStone, 36 + i * 4.5, (5.0 - i * 1.1) / 2, 18 + i * 1.2, g)
    // 门架标志牌
    for (const gx of [-26, 22]) {
      for (const sz of [-1, 1]) box(0.4, 8, 0.4, M.aluPanel, gx, dy + 5.0, sz * 15, g)
      box(32, 0.6, 0.6, M.aluPanel, gx, dy + 9.2, 0, g)
      box(9.0, 3.0, 0.2, M.paintGreen, gx - 7, dy + 7.4, 0.2, g)
      box(9.0, 3.0, 0.2, M.paintBlue, gx + 5, dy + 7.4, 0.2, g)
      for (let i = 0; i < 3; i++) box(7.4, 0.22, 0.1, M.glazeWhite, gx - 7, dy + 8.2 - i * 0.8, 0.34, g)
    }
    // 桥上：轿车 / 货车 / 公交
    for (let i = 0; i < 6; i++) carAt(g, -40 + i * 15, -11, 0, [M.glazeWhite, M.charcoal, M.paintRed, M.paintBlue, M.glSilver, M.paintYell][i])
    for (let i = 0; i < 5; i++) carAt(g, 34 - i * 17, -4, Math.PI, [M.paintRed, M.glazeWhite, M.glazeWhite, M.charcoal, M.paintBlue][i])
    for (let i = 0; i < 3; i++) carAt(g, -20 + i * 22, 4, 0, [M.charcoal, M.glazeWhite, M.paintYell][i])
    truckAt(g, 8, 11, 0)
    truckAt(g, -34, 11, 0, M.paintRed)
    busAt(g, 26, -18, Math.PI)
    vanAt(g, -10, -4, Math.PI)
    // 桥下：辅路 + 停车 + 绿化
    for (let i = 0; i < 4; i++) carAt(g, -30 + i * 7.2, 22, Math.PI / 2, [M.glazeWhite, M.glazeWhite, M.charcoal, M.paintBlue][i])
    for (let i = 0; i < 10; i++) treeAt(g, -44 + i * 10, -22, 0.85, 3.0)
    for (let i = 0; i < 5; i++) lampPost(g, -40 + i * 20, 22, 6.4, 0)
    return { g, top: 24 }
  }

  // ---------------- 141 超高层地标塔（1×1） ----------------
  function t141(x, z) {
    const g = group(x, z, 0)
    paved(g, 0, 0, 44, 48, M.paving, 3.4, 'x')
    const fh = 4.2
    const floors = 72
    const H = floors * fh
    // 塔身：八边形逐段收分
    let r0 = 16.5
    let y = 0
    const segs = 6
    for (let s = 0; s < segs; s++) {
      const h = H / segs
      const r1 = 16.5 - (s + 1) * 1.55
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 8, 1, true), M.glBlue)
      body.position.set(0, y + h / 2, 0)
      body.castShadow = body.receiveShadow = true
      g.add(body)
      // 角部竖梃
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8
        const bx = Math.cos(a) * (r0 + r1) * 0.5
        const bz = Math.sin(a) * (r0 + r1) * 0.5
        box(0.5, h, 0.5, M.titan, bx, y + h / 2, bz, g)
      }
      // 每 8 层一道设备层环
      for (let f = 0; f < 8; f++) {
        const ay = y + (h / 8) * (f + 0.5)
        const rr = r0 + (r1 - r0) * ((f + 0.5) / 8)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.12, 0.1, 4, 32), M.brightSilver)
        ring.rotation.x = Math.PI / 2
        add(ring, 0, ay, 0, g)
      }
      // 竖向玻璃肋
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), M.brightSilver)
        rib.position.set(Math.cos(a) * (r0 + r1) * 0.5, y + h / 2, Math.sin(a) * (r0 + r1) * 0.5)
        g.add(rib)
      }
      y += h
      r0 = r1
    }
    // 顶部：观景平台 + 冠 + 桅杆
    box(21, 1.0, 21, M.whiteStone, 0, y + 0.5, 0, g)
    box(20, 6.0, 20, M.glIce, 0, y + 4.0, 0, g)
    box(21, 1.2, 21, M.brightSilver, 0, y + 7.6, 0, g)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      box(1.0, 9.0, 1.0, M.brightSilver, Math.cos(a) * 8, y + 11.5, Math.sin(a) * 8, g)
    }
    box(15, 3.0, 15, M.titan, 0, y + 9.5, 0, g)
    cyl(0.5, 1.8, 34, M.brightSilver, 0, y + 26, 0, 12, g)
    cyl(0.2, 0.4, 10, M.paintRed, 0, y + 46, 0, 8, g)
    // 裙房 + 商业入口
    box(40, 16, 40, M.limestone, 0, 8, 0, g)
    for (const y2 of [7.6, 15.4]) box(41, 0.7, 41, M.whiteStone, 0, y2, 0, g)
    for (const sz of [-1, 1]) {
      gridGlass(g, 0, 8.6, sz * 20.1, sz > 0 ? 0 : Math.PI, 34, 12.4, 9, 3, { glass: M.glSmoke, frame: M.aluDark })
      box(12, 4.2, 0.5, M.membrane, 0, 4.4, sz * 22.0, g)
    }
    for (const sx of [-1, 1]) gridGlass(g, sx * 20.1, 8.6, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 34, 12.4, 9, 3, { glass: M.glSmoke, frame: M.aluDark })
    // 广场 + 树 + 车 + 人
    for (let i = 0; i < 4; i++) treeAt(g, -14 + i * 9.4, 24, 0.9, 3.0)
    for (let i = 0; i < 3; i++) carAt(g, -14 + i * 8, 24, 0, [M.charcoal, M.glazeWhite, M.paintBlue][i])
    for (let i = 0; i < 6; i++) {
      box(0.34, 1.12, 0.3, [M.charcoal, M.paintRed, M.paintBlue][i % 3], -16 + i * 6.4, 0.56, 21, g)
    }
    for (const [lx, lz] of [[-20, 20], [20, 20], [-20, -20], [20, -20]]) lampPost(g, lx, lz, 9.0, 0)
    return { g, top: y + 52 }
  }

  // ---------------- 142 住宅小区（2×2） ----------------
  function t142(x, z) {
    const g = group(x, z, 0)
    paved(g, 0, 0, 96, 106, M.paving, 4.0, 'x')
    // 中央花园步道
    paved(g, 0, 0, 10, 92, M.whiteStone, 3.0, 'z')
    paved(g, 0, 0, 78, 9, M.whiteStone, 3.0, 'x')
    // 四栋住宅板楼（方塔 + 规整开窗 + 凸阳台 + 分层腰线）
    const towers = [
      [-30, -34, 21, 17, 92, 0],
      [30, -34, 18, 16, 78, 1],
      [-30, 34, 18, 17, 66, 2],
      [30, 34, 21, 17, 72, 3],
    ]
    towers.forEach(([tx, tz, w, d, H, ti]) => {
      const fh = 3.1
      const baseH = 5.8          // 两层裙房
      const wall = ti % 2 ? M.plasterWarm : M.whiteStone
      const wallAlt = ti % 2 ? M.whiteStone : M.limestone
      // 裙房
      box(w + 1.6, baseH, d + 1.6, wallAlt, tx, baseH / 2, tz, g)
      box(w + 2.2, 0.5, d + 2.2, M.whiteStone, tx, baseH - 0.2, tz, g)
      box(w + 1.4, 0.4, d + 1.4, M.concreteDark, tx, 0.2, tz, g)
      for (const sx of [-1, 1]) box(w + 1.8, 0.3, 0.4, M.whiteStone, tx, 3.0, tz + sx * (d / 2 + 0.8), g)
      // 主体
      box(w, H - baseH, d, wall, tx, baseH + (H - baseH) / 2, tz, g)
      // 转角竖线（结构柱外露）
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box(0.9, H - baseH, 0.9, M.whiteStone, tx + sx * (w / 2 - 0.15), baseH + (H - baseH) / 2, tz + sz * (d / 2 - 0.15), g)
      }
      // 分户竖缝：正立面每开间之间一条浅色竖带
      const baysX = Math.max(2, Math.round(w / 4.2))   // 长边开间
      const baysZ = Math.max(2, Math.round(d / 4.2))   // 短边开间
      const stepX = w / baysX
      const stepZ = d / baysZ
      for (let i = 1; i < baysX; i++) {
        const px = tx - w / 2 + i * stepX
        for (const sz of [-1, 1]) box(0.24, H - baseH, 0.16, M.whiteStone, px, baseH + (H - baseH) / 2, tz + sz * (d / 2 + 0.04), g)
      }
      for (let i = 1; i < baysZ; i++) {
        const pz = tz - d / 2 + i * stepZ
        for (const sx of [-1, 1]) box(0.16, H - baseH, 0.24, M.whiteStone, tx + sx * (w / 2 + 0.04), baseH + (H - baseH) / 2, pz, g)
      }
      // 每层窗 + 水平腰线
      const floors = Math.floor((H - baseH - 2.6) / fh)
      for (let f = 0; f < floors; f++) {
        const fy = baseH + f * fh
        const cy = fy + fh * 0.56
        for (let i = 0; i < baysX; i++) {
          const px = tx - w / 2 + stepX * (i + 0.5)
          const ww = Math.min(2.3, stepX - 1.0)
          for (const sz of [-1, 1]) {
            box(ww, 1.7, 0.1, M.glSmoke, px, cy, tz + sz * (d / 2 + 0.06), g)
            box(ww + 0.34, 0.1, 0.26, M.whiteStone, px, cy + 0.95, tz + sz * (d / 2 + 0.12), g)
            box(ww + 0.34, 0.1, 0.3, M.whiteStone, px, cy - 0.92, tz + sz * (d / 2 + 0.14), g)
            // 窗中梃
            box(0.07, 1.7, 0.1, M.darkFrame, px, cy, tz + sz * (d / 2 + 0.11), g)
          }
        }
        for (let i = 0; i < baysZ; i++) {
          const pz = tz - d / 2 + stepZ * (i + 0.5)
          const ww = Math.min(2.0, stepZ - 1.0)
          for (const sx of [-1, 1]) {
            box(0.1, 1.7, ww, M.glSmoke, tx + sx * (w / 2 + 0.06), cy, pz, g)
            box(0.26, 0.1, ww + 0.34, M.whiteStone, tx + sx * (w / 2 + 0.12), cy + 0.95, pz, g)
            box(0.3, 0.1, ww + 0.34, M.whiteStone, tx + sx * (w / 2 + 0.14), cy - 0.92, pz, g)
          }
        }
        // 每 3 层一道外凸腰线
        if (f % 3 === 0) {
          box(w + 0.8, 0.34, d + 0.8, M.whiteStone, tx, fy + 0.1, tz, g)
        }
      }
      // 阳台：正立面每 2 开间挑一块（错层）
      for (let f = 1; f < floors; f += 1) {
        const fy = baseH + f * fh
        const cy = fy + fh * 0.5
        for (let i = 0; i < baysX; i++) {
          if ((i + f) % 2 !== 0) continue
          const px = tx - w / 2 + stepX * (i + 0.5)
          const bw = Math.min(3.2, stepX - 0.7)
          // 阳台朝中央花园一侧
          const dir = tz < 0 ? 1 : -1
          const bz = tz + dir * d / 2
          // 阳台板 + 玻璃栏板 + 扶手 + 侧板
          box(bw, 0.16, 1.35, M.whiteStone, px, cy - 0.86, bz + dir * 0.68, g)
          box(bw - 0.16, 0.95, 0.08, M.glazeWhite, px, cy - 0.24, bz + dir * 1.32, g)
          box(bw, 0.09, 0.16, M.brightSilver, px, cy + 0.28, bz + dir * 1.34, g)
          for (const s of [-1, 1]) {
            box(0.1, 0.95, 1.35, M.glazeWhite, px + s * (bw / 2 - 0.06), cy - 0.24, bz + dir * 0.68, g)
            box(0.1, 0.09, 1.35, M.brightSilver, px + s * (bw / 2 - 0.06), cy + 0.28, bz + dir * 0.68, g)
          }
          // 阳台推拉门（比普通窗高一点）
          box(bw - 0.6, 2.0, 0.1, M.glSmoke, px, cy + 0.06, bz + dir * 0.06, g)
          // 空调机位（挂在阳台侧边）
          box(0.9, 0.7, 0.5, M.aluPanel, px + bw / 2 + 0.6, cy - 0.6, bz + dir * 0.3, g)
        }
      }
      // 楼梯间出屋面 + 电梯机房 + 水箱 + 女儿墙
      box(w + 0.5, 1.1, d + 0.5, M.whiteStone, tx, H + 0.55, tz, g)
      box(w + 0.7, 0.2, d + 0.7, M.concreteDark, tx, H + 1.15, tz, g)
      box(5.0, 3.0, 4.0, wallAlt, tx - w * 0.22, H + 1.5, tz - d * 0.18, g)
      box(5.4, 0.3, 4.4, M.aluPanel, tx - w * 0.22, H + 3.0, tz - d * 0.18, g)
      box(3.4, 2.6, 3.0, M.aluPanel, tx + w * 0.2, H + 1.3, tz + d * 0.12, g)
      for (const [ox, oz] of [[-0.5, 0], [0.5, 0], [0, -0.6], [0, 0.6]]) {
        cyl(0.7, 0.7, 1.8, M.brightSilver, tx + w * 0.12 + ox, H + 2.4, tz - d * 0.3 + oz, 8, g)
      }
      cyl(0.1, 0.1, 4.2, M.brightSilver, tx, H + 4.2, tz, 6, g)
      box(0.5, 0.4, 0.5, M.paintRed, tx, H + 6.3, tz, g)
      // 单元入口 + 雨棚 + 台阶
      box(7.0, 3.4, 2.4, M.glSmoke, tx, 1.7, tz + d / 2 + 0.7, g)
      box(7.6, 0.16, 2.8, M.whiteStone, tx, 3.5, tz + d / 2 + 0.7, g)
      box(8.0, 0.24, 3.2, M.membrane, tx, 3.7, tz + d / 2 + 0.7, g)
      for (const sx of [-1, 1]) box(0.24, 3.5, 0.24, M.aluDark, tx + sx * 3.4, 1.75, tz + d / 2 + 1.9, g)
      steps(g, 7.6, 3, 0.2, 1.0, 0, M.whiteStone, tz + d / 2 + 2.4)
    })
    // 门卫 + 大门 + 围墙
    box(9, 3.4, 6, M.whiteStone, 0, 1.7, 52, g)
    box(10, 0.5, 7, M.aluPanel, 0, 3.6, 52, g)
    gridGlass(g, 0, 2.1, 55.06, 0, 7.4, 2.0, 4, 1, { glass: M.glTeal, frame: M.aluDark })
    for (const sx of [-1, 1]) {
      box(3.6, 4.2, 3.6, M.tuff, sx * 7.2, 2.1, 52, g)
      box(1.2, 4.2, 0.3, M.aluDark, sx * 6.4, 2.1, 52.2, g)
    }
    for (const sx of [-1, 1]) {
      box(38, 3.0, 0.6, M.tuff, sx * 29, 1.5, 52, g)
      box(38, 0.3, 0.9, M.whiteStone, sx * 29, 3.1, 52, g)
    }
    // 儿童活动场 + 凉亭 + 水景
    box(18, 0.16, 14, M.paintBlue, -22, 0.1, 12, g)
    for (let i = 0; i < 6; i++) {
      cyl(0.2, 0.2, 2.4, M.brightSilver, -29 + i * 3, 1.2, 8, 6, g)
      box(6.0, 0.16, 0.16, M.brightSilver, -29 + i * 3, 2.4, 8, g)
      box(1.6, 0.14, 2.6, M.glazeWhite, -31 + i * 3, 0.7, 14, g)
      box(0.16, 0.7, 0.16, M.brightSilver, -31 + i * 3, 0.35, 14, g)
    }
    const slide = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 7.0), M.paintYell)
    slide.position.set(-14, 1.6, 12)
    slide.rotation.x = 0.5
    g.add(slide)
    cyl(3.4, 3.4, 0.4, M.whiteStone, 16, 0.2, 12, 24, g)
    cyl(3.0, 3.0, 0.1, M.glTeal, 16, 0.4, 12, 24, g)
    for (let i = 0; i < 3; i++) benchAt(g, 22 - i * 6, 16, Math.PI)
    // 绿化：成组乔木 + 花境 + 绿篱
    for (let i = 0; i < 7; i++) treeAt(g, -42 + i * 14, -8, 1.1, 3.6)
    for (let i = 0; i < 6; i++) treeAt(g, -36 + i * 14, 26, 0.9, 3.0)
    for (let i = 0; i < 4; i++) treeAt(g, 44, -46 + i * 20, 1.0, 3.4)
    for (let i = 0; i < 5; i++) planter(g, -40 + i * 20, 44, 5.0, 1.8)
    for (let i = 0; i < 12; i++) bushAt(g, -44 + (i % 6) * 8.4, 34 + Math.floor(i / 6) * 6, 0.55)
    for (let i = 0; i < 4; i++) lampPost(g, -14 + i * 10, 0, 5.0, 0)
    // 停车位 + 车
    for (let i = 0; i < 12; i++) {
      const px = -42 + (i % 6) * 6.4
      const pz = 30 + Math.floor(i / 6) * 6.4
      box(5.4, 0.06, 0.12, M.roadPaint, px, 0.12, pz, g)
      if (i % 3 !== 0) carAt(g, px, pz + 0.4, Math.PI / 2, [M.glazeWhite, M.charcoal, M.paintRed, M.glSilver, M.paintBlue][i % 5])
    }
    motorRow()
    function motorRow() {
      for (let i = 0; i < 6; i++) motoAt(g, 30 + i * 1.6, 46, Math.PI / 2, [M.paintRed, M.paintBlue, M.glazeWhite][i % 3])
    }
    return { g, top: 92 }
  }

  // ---------------- 143 立体停车楼（1×1） ----------------
  function t143(x, z) {
    const g = group(x, z, 0)
    paved(g, 0, 0, 42, 44, M.paving, 3.0, 'x')
    const W = 38, D = 30
    for (let lv = 0; lv < 5; lv++) {
      const y = lv * 3.4
      box(W, 0.45, D, M.concrete, 0, y + 3.2, 0, g)
      for (let i = 0; i <= 6; i++) {
        for (const sz of [-1, 1]) box(0.5, 3.2, 0.5, M.concrete, -W / 2 + 3 + i * 5.3, y + 1.6, sz * (D / 2), g)
      }
      for (let i = 0; i <= 4; i++) {
        for (const sx of [-1, 1]) box(0.5, 3.2, 0.5, M.concrete, sx * (W / 2), y + 1.6, -D / 2 + 3 + i * 6.0, g)
      }
      // 外侧防撞护栏 + 车位线
      for (const sz of [-1, 1]) box(W, 0.7, 0.2, M.paintYell, 0, y + 3.0, sz * (D / 2 + 0.1), g)
      for (const sx of [-1, 1]) box(0.2, 0.7, D, M.paintYell, sx * (W / 2 + 0.1), y + 3.0, 0, g)
      for (let i = 0; i < 5; i++) {
        carAt(g, -13 + i * 6.3, -8.4, lv % 2 ? 0 : Math.PI, [M.glazeWhite, M.charcoal, M.paintRed, M.glSilver, M.paintBlue][i], 4.6, y + 0.45)
        if (i < 4) carAt(g, -13 + i * 6.3, 8.4, lv % 2 ? Math.PI : 0, [M.paintYell, M.paintGreen, M.glazeWhite, M.paintRed][i], 4.6, y + 0.45)
      }
      for (let i = 0; i < 4; i++) box(2.4, 0.05, 0.16, M.roadPaint, -13 + i * 6.3, y + 3.46, -5.6, g)
    }
    // 中央坡道 + 楼梯电梯核
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.45, 26), M.concrete)
    ramp.position.set(12.6, 8.3, 0)
    ramp.rotation.z = -0.24
    g.add(ramp)
    box(6.4, 17.4, 6.4, M.whiteStone, -14.6, 8.7, 0, g)
    box(6.8, 0.5, 6.8, M.aluPanel, -14.6, 17.6, 0, g)
    gridGlass(g, -14.6, 6.0, 3.22, 0, 4.6, 3.0, 2, 1, { glass: M.glTeal, frame: M.aluDark })
    box(2.4, 2.8, 0.3, M.glSmoke, -14.6, 1.6, 3.2, g)
    // 入口 + 收费亭 + 指示牌
    box(12, 0.6, 0.3, M.paintYell, 0, 3.9, -15.2, g)
    box(8, 3.2, 0.26, M.membrane, 0, 4.6, -15.2, g)
    box(3.0, 2.6, 2.4, M.whiteStone, -6, 1.3, -18.4, g)
    box(3.4, 0.4, 2.8, M.aluPanel, -6, 2.7, -18.4, g)
    gridGlass(g, -6, 1.5, -17.18, 0, 2.2, 1.4, 2, 1, { glass: M.glTeal, frame: M.aluDark })
    box(2.2, 0.9, 0.16, M.paintRed, 6, 4.2, -18.2, g)
    box(1.8, 0.6, 0.1, M.glazeWhite, 6, 4.2, -18.1, g)
    cyl(0.2, 0.2, 4.2, M.aluPanel, 6, 2.1, -18.4, 8, g)
    // 地面车 + 树
    for (let i = 0; i < 4; i++) carAt(g, -12 + i * 6.4, 18, Math.PI / 2, [M.glazeWhite, M.paintBlue, M.charcoal, M.paintRed][i])
    for (let i = 0; i < 3; i++) treeAt(g, -18 + i * 18, 21, 0.8, 2.8)
    busAt(g, 0, 22, -Math.PI / 2)
    return { g, top: 20 }
  }

  // ---------------- 144 跨街天桥连廊（1×1） ----------------
  function t144(x, z) {
    const g = group(x, z, 0)
    paved(g, 0, 0, 42, 44, M.paving, 3.0, 'x')
    // 下方双向四车道
    box(44, 0.12, 18, M.aluDark, 0, 0.06, 0, g)
    for (let i = 0; i < 9; i++) box(3.0, 0.05, 0.18, M.roadPaint, -18 + i * 4.6, 0.14, 0, g)
    for (let i = 0; i < 7; i++) box(0.2, 0.05, 15, M.roadPaint, -20 + i * 6.6, 0.14, 0, g)
    for (let i = 0; i < 4; i++) carAt(g, -16 + i * 10, -5.2, 0, [M.glazeWhite, M.paintRed, M.charcoal, M.paintBlue][i])
    for (let i = 0; i < 3; i++) carAt(g, 12 - i * 12, 5.2, Math.PI, [M.glazeWhite, M.paintYell, M.charcoal][i])
    truckAt(g, 0, 5.4, Math.PI)
    // 两端楼梯 + 电梯
    for (const sx of [-1, 1]) {
      box(11, 9.0, 9.0, M.plasterGrey, sx * 15.5, 4.5, 0, g)
      box(11.6, 0.5, 9.6, M.whiteStone, sx * 15.5, 9.2, 0, g)
      for (let f = 0; f < 2; f++) {
        for (let i = 0; i < 2; i++) {
          win(g, sx * 15.5, 2.4 + f * 3.4, -4.6 + i * 3.0, 0, 2.2, 1.9, { glass: M.glTeal, frame: M.aluDark })
          win(g, sx * 15.5, 2.4 + f * 3.4, -4.6 + i * 3.0, Math.PI, 2.2, 1.9, { glass: M.glTeal, frame: M.aluDark })
        }
        for (let i = 0; i < 2; i++) win(g, sx * 15.5 + (sx > 0 ? 5.55 : -5.55), 2.4 + f * 3.4, -2.4 + i * 5.0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 2.2, 1.9, { glass: M.glTeal, frame: M.aluDark })
      }
      // 电梯塔
      box(4.0, 13.0, 4.6, M.glWhite, sx * 21.6, 6.5, 1.0, g)
      box(4.4, 0.5, 5.0, M.brightSilver, sx * 21.6, 13.3, 1.0, g)
      for (let i = 0; i < 4; i++) box(4.0, 0.06, 4.66, M.brightSilver, sx * 21.6, 3.2 + i * 3.2, 1.0, g)
    }
    // 桥身（玻璃连廊 + 桁架）
    box(20, 1.0, 7.6, M.concrete, 0, 9.0, 0, g)
    for (const sz of [-1, 1]) {
      box(20, 3.0, 0.2, M.glTeal, 0, 11.0, sz * 3.7, g)
      for (let i = 0; i <= 10; i++) box(0.18, 3.0, 0.3, M.aluDark, -10 + i * 2.0, 11.0, sz * 3.8, g)
      box(20, 0.3, 0.5, M.brightSilver, 0, 12.6, sz * 3.9, g)
      // 桁架斜杆
      for (let i = 0; i < 5; i++) {
        strut(g, new THREE.Vector3(-10 + i * 4, 12.6, sz * 3.9), new THREE.Vector3(-8 + i * 4, 9.6, sz * 3.9), 0.09, M.brightSilver, 4)
      }
    }
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 20.4, 18, 1, true, 0, Math.PI), M.membrane)
    roof.rotation.z = Math.PI / 2
    roof.scale.y = 0.45
    roof.position.y = 12.7
    roof.castShadow = true
    g.add(roof)
    // 桥墩
    for (const sx of [-1, 1]) box(2.6, 8.6, 3.0, M.whiteStone, sx * 9.6, 4.3, 0, g)
    // 桥上行人 / 灯带 / 自动扶梯
    for (let i = 0; i < 8; i++) {
      box(0.36, 1.12, 0.32, [M.charcoal, M.paintBlue, M.paintRed, M.glazeWhite][i % 4], -8 + i * 2.2, 9.7, 0.8 - (i % 2) * 1.6, g)
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M.plaster)
      add(hd, -8 + i * 2.2, 10.46, 0.8 - (i % 2) * 1.6, g)
    }
    for (let i = 0; i < 8; i++) box(0.3, 0.06, 6.4, M.glazeWhite, -9 + i * 2.6, 12.54, 0, g)
    const esc = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 12), M.aluPanel)
    esc.position.set(15.5, 5.5, 6.4)
    esc.rotation.x = -0.5
    g.add(esc)
    for (let i = 0; i < 6; i++) box(2.4, 0.14, 0.5, M.brightSilver, 15.5, 9.0 - i * 1.1, 4.4 + i * 1.4, g)
    // 路边绿化
    for (let i = 0; i < 3; i++) treeAt(g, -19 + i * 19, -13, 0.85, 3.0)
    for (let i = 0; i < 3; i++) treeAt(g, -19 + i * 19, 13, 0.85, 3.0)
    lampPost(g, -20, -11, 6.4, 0)
    lampPost(g, 20, 11, 6.4, Math.PI)
    return { g, top: 15 }
  }

  // ---------------- 145 轻轨高架（2×1） ----------------
  function t145(x, z) {
    const g = group(x, z, 0)
    paved(g, 0, 0, 96, 50, M.paving, 4.0, 'x')
    const dy = 9.0
    // 双线轨道梁
    for (const sz of [-1, 1]) {
      box(98, 1.6, 5.0, M.concrete, 0, dy, sz * 3.0, g)
      box(98, 0.3, 5.4, M.concrete, 0, dy + 0.9, sz * 3.0, g)
      for (const rz of [-1.0, 1.0]) box(98, 0.18, 0.2, M.brightSilver, 0, dy + 1.12, sz * 3.0 + rz, g)
      // 第三轨
      box(98, 0.14, 0.14, M.copper, 0, dy + 0.98, sz * 3.0 - 1.9, g)
      // 桥墩
      for (let i = 0; i < 6; i++) {
        const px = -40 + i * 16
        box(3.0, dy, 3.6, M.whiteStone, px, dy / 2, sz * 3.0, g)
        box(4.4, 1.0, 6.2, M.concrete, px, dy - 1.0, sz * 3.0, g)
      }
    }
    // 中央分隔 + 声屏障
    box(98, 0.8, 1.0, M.concrete, 0, dy + 1.3, 0, g)
    for (const sz of [-1, 1]) {
      for (let i = 0; i <= 24; i++) cyl(0.12, 0.14, 4.4, M.aluPanel, -48 + i * 4.0, dy + 3.4, sz * 6.4, 6, g)
      box(98, 3.6, 0.1, M.glTeal, 0, dy + 3.4, sz * 6.4, g)
    }
    // 接触网杆 + 导线
    for (let i = 0; i < 9; i++) {
      const px = -44 + i * 11
      cyl(0.16, 0.2, 7.6, M.aluPanel, px, dy + 4.0, 6.9, 6, g)
      box(0.2, 0.18, 6.4, M.aluPanel, px, dy + 7.6, 3.6, g)
      box(98, 0.08, 0.08, M.copper, 0, dy + 7.4, 2.2, g)
      box(98, 0.08, 0.08, M.copper, 0, dy + 7.4, 4.2, g)
    }
    // 列车（4 节）
    for (let c = 0; c < 4; c++) {
      const cx = -34 + c * 15.0
      box(14.4, 3.0, 2.9, M.glazeWhite, cx, dy + 2.6, 3.0, g)
      box(14.4, 1.0, 2.94, M.paintBlue, cx, dy + 4.4, 3.0, g)
      box(13.0, 1.3, 2.96, M.glSmoke, cx, dy + 3.3, 3.0, g)
      for (let i = 0; i < 6; i++) box(1.2, 1.2, 3.0, M.glazeWhite, cx - 6.0 + i * 2.4, dy + 3.3, 3.0, g)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.2, 10), M.charcoal)
        wh.rotation.x = Math.PI / 2
        wh.position.set(cx + sx * 4.6, dy + 1.5, 3.0 + sz * 0.9)
        g.add(wh)
      }
      box(1.8, 2.2, 2.9, M.charcoal, cx + 7.3, dy + 2.2, 3.0, g)
      box(0.16, 0.4, 1.2, M.glazeWhite, cx + 7.4, dy + 4.2, 3.0, g)
    }
    // 地面：站房 + 广场 + 停车 + 树
    box(20, 6.4, 12, M.glWhite, 0, 3.2, -17, g)
    box(21, 0.6, 13, M.brightSilver, 0, 6.6, -17, g)
    gridGlass(g, 0, 3.2, -10.94, 0, 16, 4.6, 6, 2, { glass: M.glSmoke, frame: M.aluDark })
    box(5.0, 3.2, 0.3, M.glSmoke, 0, 1.7, -10.8, g)
    steps(g, 12, 3, 0.2, 1.0, 0, M.whiteStone, -10.2)
    for (let i = 0; i < 5; i++) carAt(g, -30 + i * 7.0, -17, Math.PI / 2, [M.glazeWhite, M.paintBlue, M.charcoal, M.paintRed, M.glSilver][i])
    for (let i = 0; i < 8; i++) treeAt(g, -42 + i * 12, -25, 0.9, 3.2)
    for (let i = 0; i < 4; i++) lampPost(g, -36 + i * 24, -8, 6.4, 0)
    for (let i = 0; i < 8; i++) motoAt(g, -8 + i * 1.6, -22.5, Math.PI / 2, [M.paintRed, M.paintBlue, M.glazeWhite][i % 3])
    return { g, top: 20 }
  }

  // ---------------- 146 露天停车场（1×1） ----------------
  function t146(x, z) {
    const g = group(x, z, 0)
    box(42, 0.12, 44, M.aluDark, 0, 0.06, 0, g)
    // 车位线（三排）
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 6; i++) {
        const px = -15 + i * 6.0
        const pz = -14 + r * 13
        box(5.2, 0.05, 0.14, M.roadPaint, px, 0.14, pz - 4.6, g)
        box(5.2, 0.05, 0.14, M.roadPaint, px, 0.14, pz + 4.6, g)
        box(0.14, 0.05, 9.2, M.roadPaint, px + 2.6, 0.14, pz, g)
        const cols = [M.glazeWhite, M.charcoal, M.paintRed, M.paintBlue, M.glSilver, M.paintYell]
        if ((i + r) % 4 !== 0) carAt(g, px, pz + 2.6, 0, cols[(i + r) % 6])
        if ((i + r) % 5 !== 0) carAt(g, px, pz - 2.6, Math.PI, cols[(i + r + 3) % 6])
      }
    }
    // 大巴 / 货车区
    box(20, 0.1, 10, M.concrete, -10, 0.12, 18, g)
    busAt(g, -14, 18, 0)
    busAt(g, -2, 18, 0, M.paintGreen)
    truckAt(g, 14, 17, Math.PI / 2)
    vanAt(g, 18, 5, 0, M.glazeWhite)
    // 出入口收费亭 + 闸杆 + 指示牌
    box(20, 0.12, 8, M.aluDark, 0, 0.1, -21, g)
    box(2.6, 2.4, 2.2, M.whiteStone, -6, 1.2, -21, g)
    box(3.0, 0.4, 2.6, M.aluPanel, -6, 2.6, -21, g)
    gridGlass(g, -6, 1.4, -19.86, 0, 1.8, 1.2, 2, 1, { glass: M.glTeal, frame: M.aluDark })
    for (const gx of [-2.2, 4.0]) {
      cyl(0.18, 0.2, 1.2, M.paintYell, gx, 0.6, -21, 8, g)
      box(4.4, 0.14, 0.14, M.paintYell, gx + 2.2, 1.1, -21, g)
    }
    box(3.0, 2.2, 0.2, M.paintBlue, 12, 3.2, -19, g)
    for (let i = 0; i < 3; i++) box(2.4, 0.36, 0.1, M.glazeWhite, 12, 3.7 - i * 0.6, -18.86, g)
    cyl(0.16, 0.16, 4.2, M.aluPanel, 12, 2.1, -19.2, 8, g)
    // 电动车充电 + 摩托
    for (let i = 0; i < 3; i++) {
      box(0.6, 1.6, 0.4, M.glazeWhite, -18 + i * 6, 0.8, -16, g)
      box(0.5, 0.5, 0.12, M.glTeal, -18 + i * 6, 1.5, -15.76, g)
    }
    for (let i = 0; i < 7; i++) motoAt(g, 16 + i * 1.5, -12, Math.PI / 2, [M.paintRed, M.paintBlue, M.glazeWhite][i % 3])
    for (let i = 0; i < 6; i++) bikeAt(g, -18 + i * 1.2, 9, Math.PI / 2, [M.paintGreen, M.paintRed, M.paintBlue][i % 3])
    // 灯 + 树
    for (let i = 0; i < 4; i++) lampPost(g, -18 + i * 12, 12, 7.0, 0)
    for (let i = 0; i < 6; i++) treeAt(g, -20 + i * 8, 22, 0.75, 2.6)
    return { g, top: 8 }
  }

  // ---------------- 147 城市公园（2×2） ----------------
  function t147(x, z) {
    const g = group(x, z, 0)
    box(96, 0.18, 106, M.greenSoft, 0, 0.09, 0, g)
    // 湖 + 岛 + 桥
    const lake = new THREE.Mesh(new THREE.CircleGeometry(22, 40), M.glTeal)
    lake.scale.set(1.35, 1, 0.9)
    lake.rotation.x = -Math.PI / 2
    add(lake, -16, 0.22, 14, g)
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      box(3.0, 0.4, 1.6, M.curb, -16 + Math.cos(a) * 30, 0.2, 14 + Math.sin(a) * 20 * 0.9, g).rotation.y = -a
    }
    const island = new THREE.Mesh(new THREE.CircleGeometry(6, 24), M.greenSoft)
    island.rotation.x = -Math.PI / 2
    add(island, -16, 0.26, 14, g)
    treeAt(g, -16, 14, 1.2, 3.8)
    // 曲桥
    for (let i = 0; i < 5; i++) {
      box(4.4, 0.4, 3.2, M.whiteStone, -16 + 8 + i * 3.6, 1.6, 14, g)
      for (const sz of [-1, 1]) {
        box(0.18, 1.0, 0.18, M.whiteStone, -14.6 + i * 3.6, 2.3, 14 + sz * 1.5, g)
        box(0.18, 1.0, 0.18, M.whiteStone, -17.4 + i * 3.6, 2.3, 14 + sz * 1.5, g)
      }
    }
    // 步道（环形 + 十字）
    for (let i = 0; i < 4; i++) {
      paved(g, 0, -34 + i * 24, 86, 5.0, M.paving, 3.0, 'x')
    }
    paved(g, 26, 0, 6.0, 96, M.paving, 3.0, 'z')
    // 大草坪 + 花境
    for (let i = 0; i < 5; i++) {
      const fx = -34 + i * 17
      for (let k = 0; k < 6; k++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), [M.glRose, M.glAmber, M.glViolet, M.glazeWhite][k % 4])
        c.position.set(fx + (k % 3) * 1.1, 0.55, -44 + Math.floor(k / 3) * 1.2)
        c.castShadow = true
        g.add(c)
      }
      planter(g, fx, -44, 4.2, 3.0)
    }
    // 乔木群（三片）
    for (let i = 0; i < 9; i++) treeAt(g, -40 + (i % 3) * 14, -26 + Math.floor(i / 3) * 9, 1.2, 4.0)
    for (let i = 0; i < 8; i++) treeAt(g, -40 + (i % 4) * 13, 40 + Math.floor(i / 4) * 9, 1.0, 3.4)
    for (let i = 0; i < 8; i++) treeAt(g, 34 + (i % 2) * 8, -24 + Math.floor(i / 2) * 14, 0.95, 3.2)
    for (let i = 0; i < 10; i++) bushAt(g, -30 + (i % 5) * 12, 30 + Math.floor(i / 5) * 5, 0.6)
    // 凉亭
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      cyl(0.18, 0.22, 3.4, M.teak, 38 + Math.cos(a) * 3.2, 1.7, 32 + Math.sin(a) * 3.2, 8, g)
    }
    const pav = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.4, 6), M.roof)
    add(pav, 38, 4.4, 32, g)
    cyl(3.0, 3.0, 0.3, M.whiteStone, 38, 0.2, 32, 20, g)
    benchAt(g, 38, 36, Math.PI)
    // 儿童场 + 健身器材 + 长椅
    box(20, 0.14, 14, M.paintYell, 28, 0.1, -32, g)
    for (let i = 0; i < 4; i++) {
      cyl(0.16, 0.16, 2.2, M.brightSilver, 22 + i * 4, 1.1, -32, 6, g)
      box(4.2, 0.14, 0.14, M.brightSilver, 22 + i * 4, 2.2, -32, g)
    }
    const slide = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 6.6), M.paintRed)
    slide.position.set(36, 1.7, -32)
    slide.rotation.x = 0.52
    g.add(slide)
    for (let i = 0; i < 5; i++) benchAt(g, -32 + i * 15, 2, Math.PI)
    // 喷泉
    cyl(4.0, 4.4, 0.6, M.whiteStone, 0, 0.3, -18, 26, g)
    cyl(3.6, 3.6, 0.12, M.glTeal, 0, 0.66, -18, 26, g)
    cyl(0.5, 0.7, 2.2, M.whiteStone, 0, 1.5, -18, 12, g)
    cyl(1.5, 1.2, 0.3, M.whiteStone, 0, 2.4, -18, 16, g)
    // 路灯 + 游客 + 摊车
    for (let i = 0; i < 6; i++) lampPost(g, -38 + i * 15, -6, 4.6, 0)
    for (let i = 0; i < 8; i++) {
      box(0.36, 1.1, 0.32, [M.charcoal, M.paintRed, M.paintBlue, M.glazeWhite][i % 4], -26 + i * 8, 0.55, 6 + (i % 3) * 3, g)
    }
    box(3.2, 1.8, 2.0, M.glazeWhite, 8, 1.0, 20, g)
    box(3.4, 0.24, 2.2, M.paintRed, 8, 2.0, 20, g)
    bikeAt(g, 12, 22, 0.4, M.paintGreen)
    return { g, top: 22 }
  }

  // ---------------- 河道 + 各式船舶 ----------------
  // 船体材质（DoubleSide：船体是单层放样曲面，省得算绕序）
  const hullMat = (col) => new THREE.MeshStandardMaterial({
    color: col, roughness: 0.42, metalness: 0.25,
    envMap: M.glWhite.envMap, envMapIntensity: 0.9, side: THREE.DoubleSide,
  })
  const HULL_WHITE = hullMat('#eef1f2')
  const HULL_NAVY = hullMat('#28425c')
  const HULL_RUST = hullMat('#8d5c42')
  const HULL_GREEN = hullMat('#3d5a4c')
  const HULL_BLACK = hullMat('#22282c')
  // 帆布（共享一个材质，避免每艘船一个 draw call）
  const SAIL_MAT = new THREE.MeshStandardMaterial({
    color: '#f2efe6', roughness: 0.88, metalness: 0, side: THREE.DoubleSide,
  })

  /**
   * 船体：沿船长放样（艏部收窄 / 舷弧 / 圆舭 / 甲板面），比盒子更像船。
   * 返回 { group, top } —— top 是甲板高度
   */
  function shipHull(g, o) {
    const L = o.len, B = o.beam, D = o.depth
    const draft = o.draft ?? 3.4
    const bowStart = o.bowStart ?? 0.66
    const sheer = o.sheer ?? 0.10
    const N = o.segN ?? 34, P = o.segP ?? 12
    const sec = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      let wf = 1
      if (t > bowStart) {
        const u = (t - bowStart) / (1 - bowStart)
        wf = Math.pow(Math.cos(u * Math.PI / 2), 0.55)
      } else if (t < 0.1) {
        wf = 1 - 0.3 * Math.pow(1 - t / 0.1, 1.7)
      }
      // 舷弧：艏尾甲板略抬
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
      // 甲板面
      idx.push(grid[i][0], grid[i + 1][0], grid[i + 1][P])
      idx.push(grid[i][0], grid[i + 1][P], grid[i][P])
    }
    // 艉封板（扇形补齐，免得从船尾看进空壳）
    const s0 = sec[0]
    const center = pos.length / 3
    pos.push(s0.x, s0.top - (s0.top + draft) * 0.45, 0)
    for (let j = 0; j < P; j++) idx.push(grid[0][j], center, grid[0][j + 1])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, o.mat || HULL_WHITE)
    mesh.castShadow = mesh.receiveShadow = true
    g.add(mesh)
    return sec
  }
  /** 沿船体收窄的横向色带（水线漆 / 舷墙），用短段拼出弧线 */
  function taperBand(g, sec, B, y, h, col, over = 0.06) {
    for (let i = 0; i < sec.length - 1; i++) {
      const s0 = sec[i], s1 = sec[i + 1]
      const w = (Math.max(s0.wf, s1.wf) * B + over * 2)
      box(s1.x - s0.x + 0.05, h, w, col, (s0.x + s1.x) / 2, y, 0, g)
    }
  }
  /** 舷侧栏杆：n 根立柱 + 上下扶手（沿直线） */
  function sideRail(g, len, cz, y, mat, step = 3.0, cx = 0) {
    box(len, 0.1, 0.1, mat, cx, y + 1.0, cz, g)
    box(len, 0.07, 0.07, mat, cx, y + 0.55, cz, g)
    for (let i = 0; i <= Math.floor(len / step); i++) {
      box(0.08, 1.0, 0.08, mat, cx - len / 2 + i * step, y + 0.5, cz, g)
    }
  }
  /** 沿放样轮廓走的舷侧栏杆（随船体收窄，不是直线） */
  function hullRail(g, sec, B, y, side, o = {}) {
    const inset = o.inset ?? 0.55
    const mat = o.mat || M.brightSilver
    const railH = o.h ?? 1.1
    const zAt = (s) => side * Math.max(0.8, s.wf * B / 2 - inset)
    for (let i = 0; i < sec.length - 1; i++) {
      const a = sec[i], b = sec[i + 1]
      const pa = new THREE.Vector3(a.x, y + railH, zAt(a))
      const pb = new THREE.Vector3(b.x, y + railH, zAt(b))
      strut(g, pa, pb, 0.07, mat, 4)
      strut(g, pa.clone().setY(y + railH * 0.56), pb.clone().setY(y + railH * 0.56), 0.04, mat, 4)
      if (i % 2 === 0) strut(g, new THREE.Vector3(a.x, y, zAt(a)), pa, 0.05, mat, 4)
    }
  }
  /** 救生艇 + 吊艇架 */
  function lifeboat(g, x, y, z, side, L = 9.5) {
    const s = new THREE.Group()
    s.position.set(x, y, z)
    g.add(s)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.15, L, 12, 1, false, 0, Math.PI), M.glazeWhite)
    body.rotation.z = Math.PI / 2
    body.rotation.y = Math.PI / 2
    body.position.y = 0.7
    body.castShadow = true
    s.add(body)
    box(L * 0.98, 0.16, 3.1, M.paintYell, 0, 0.42, 0, s)
    box(L * 0.94, 0.1, 2.9, M.enamelYellow, 0, 1.5, 0, s)
    for (let i = 0; i < 3; i++) box(0.12, 0.5, 0.12, M.darkFrame, -L * 0.3 + i * L * 0.3, 1.25, 0, s)
    // 吊艇架
    for (const ox of [-L * 0.34, L * 0.34]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), M.brightSilver)
      arm.position.set(ox, 1.9, side * 0.9)
      arm.rotation.x = side * 0.85
      s.add(arm)
      box(0.16, 0.16, 1.8, M.brightSilver, ox, 2.4, side * 1.5, s)
      box(0.1, 1.3, 0.1, M.darkFrame, ox, 1.6, side * 2.0, s)
    }
    return s
  }
  /** 上层建筑：一层甲板（玻璃带 + 阳台 + 栏板） */
  function deckSlab(g, o) {
    const { x, y, len, beam, h } = o
    const mat = o.mat || M.glWhite
    box(len, h, beam, mat, x, y + h / 2, 0, g)
    // 甲板挑檐 + 滴水线
    box(len + 0.4, 0.22, beam + 0.4, M.aluPanel, x, y + h - 0.1, 0, g)
    box(len, 0.14, 0.3, M.darkFrame, x, y + h - 0.3, beam / 2 + 0.06, g)
    box(len, 0.14, 0.3, M.darkFrame, x, y + h - 0.3, -beam / 2 - 0.06, g)
    if (o.windows === false) return
    const cells = Math.max(2, Math.floor(len / (o.cell || 3.6)))
    const cw = len / cells
    for (const sz of [-1, 1]) {
      // 连续玻璃带（内凹）
      box(len - 1.2, h * 0.5, 0.14, o.glass || M.glWhite, x, y + h * 0.55, sz * (beam / 2 - 0.06), g)
      for (let i = 0; i < cells; i++) {
        const px = x - len / 2 + cw * (i + 0.5)
        // 分隔墙
        box(0.18, h * 0.62, 0.3, mat, px + cw / 2, y + h * 0.5, sz * (beam / 2 + 0.1), g)
        if (o.balcony) {
          // 阳台栏板 + 扶手
          box(cw - 0.3, 0.62, 0.16, M.glazeWhite, px, y + h * 0.32, sz * (beam / 2 + 0.42), g)
          box(cw - 0.3, 0.1, 0.24, M.brightSilver, px, y + h * 0.32 + 0.34, sz * (beam / 2 + 0.44), g)
          // 阳台地板
          box(cw - 0.2, 0.14, 0.9, M.paving, px, y + h * 0.08, sz * (beam / 2 + 0.2), g)
        }
      }
      if (o.balcony) box(len, 0.12, 1.0, M.aluPanel, x, y + 0.06, sz * (beam / 2 + 0.34), g)
      if (o.detail) {
        // 阳台扶手立柱 + 甲板檐口灯带 + 层间阴影缝
        const posts = Math.max(2, Math.round(len / 3.0))
        for (let i = 0; i <= posts; i++) {
          box(0.08, 0.5, 0.08, M.brightSilver, x - len / 2 + (len / posts) * i, y + 0.63, sz * (beam / 2 + 0.48), g)
        }
        for (let i = 0; i < cells; i += 2) {
          box(1.0, 0.1, 0.08, M.glChampagne, x - len / 2 + cw * (i + 0.5), y + h - 0.45, sz * (beam / 2 + 0.16), g)
        }
        box(len, 0.16, 0.1, M.darkFrame, x, y + 0.2, sz * (beam / 2 + 0.03), g)
      }
    }
  }
  /** 烟囱 */
  function funnel(g, x, y, r, h, mat) {
    const tilt = 0.1
    // 基座整流裙
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.75, h * 0.2, 22), M.glWhite)
    base.position.set(x, y + h * 0.1, 0)
    base.castShadow = true
    g.add(base)
    const f = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.14, h, 22), mat || M.wine)
    f.position.set(x, y + h / 2, 0)
    f.rotation.z = tilt
    f.castShadow = true
    g.add(f)
    // 顶部黑烟帽 + 内部排气管
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, h * 0.16, 22), M.charcoal)
    cap.position.set(x + 0.1, y + h * 0.94, 0)
    cap.rotation.z = tilt
    g.add(cap)
    for (const ox of [-r * 0.4, 0, r * 0.4]) {
      cyl(r * 0.13, r * 0.13, h * 0.26, M.darkFrame, x + 0.1 + ox * 0.6, y + h * 1.07, ox * 0.55, 10, g)
    }
    // 白色腰线 + 检修环平台 + 平台栏杆
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.06, h * 0.2, 22), M.glWhite)
    band.position.set(x + 0.06, y + h * 0.62, 0)
    band.rotation.z = tilt
    g.add(band)
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.42, r * 1.42, 0.16, 20), M.aluPanel)
    plat.position.set(x + 0.05, y + h * 0.44, 0)
    g.add(plat)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      box(0.06, 0.9, 0.06, M.brightSilver, x + 0.05 + Math.cos(a) * r * 1.4, y + h * 0.44 + 0.5, Math.sin(a) * r * 1.4, g)
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.4, 0.05, 5, 28), M.brightSilver)
    ring.rotation.x = Math.PI / 2
    add(ring, x + 0.05, y + h * 0.44 + 0.95, 0, g)
    // 汽笛 + 侧面进气格栅
    cyl(r * 0.16, r * 0.16, r * 1.1, M.brightSilver, x + r * 0.85, y + h * 0.74, -r * 0.55, 8, g)
    for (let i = 0; i < 3; i++) {
      box(r * 0.5, h * 0.08, 0.16, M.darkFrame, x + 0.06, y + h * (0.24 + i * 0.07), -r * 0.94, g)
    }
  }
  /** 雷达桅 / 天线 */
  function radarMast(g, x, y, h) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      strut(g, new THREE.Vector3(x + Math.cos(a) * 1.8, y, Math.sin(a) * 1.8),
        new THREE.Vector3(x, y + h * 0.8, 0), 0.13, M.brightSilver, 5)
    }
    cyl(0.3, 0.42, h, M.brightSilver, x, y + h / 2, 0, 8, g)
    // 横桁 + 雷达
    box(9.0, 0.22, 0.22, M.brightSilver, x, y + h * 0.86, 0, g)
    box(0.22, 0.22, 6.0, M.brightSilver, x, y + h * 0.9, 0, g)
    const radar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.34, 12), M.glazeWhite)
    radar.position.set(x, y + h * 0.95, 0)
    g.add(radar)
    for (const ox of [-3.6, 3.6]) {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.glazeWhite)
      dish.position.set(x + ox, y + h * 0.8, 1.0)
      dish.rotation.x = -0.9
      g.add(dish)
    }
    // 桅顶灯
    cyl(0.16, 0.16, 1.4, M.brightSilver, x, y + h + 0.4, 0, 6, g)
    box(0.34, 0.34, 0.34, M.glazeWhite, x, y + h + 1.2, 0, g)
    // 旗绳
    strut(g, new THREE.Vector3(x, y + h * 0.62, 0), new THREE.Vector3(x - 6, y + 1.2, 0), 0.04, M.darkFrame, 4)
  }
  /** 泳池平台：池子 + 池边 + 躺椅 + 遮阳伞 */
  function poolDeck(g, x, y, z, w, d) {
    box(w + 2.4, 0.4, d + 2.4, M.paving, x, y + 0.2, z, g)
    box(w, 0.5, d, M.glazeWhite, x, y + 0.1, z, g)
    box(w - 0.8, 0.2, d - 0.8, M.glTeal, x, y + 0.34, z, g)
    box(w - 1.6, 0.12, d - 1.6, M.glBlueGreen, x, y + 0.42, z, g)
    // 池边躺椅
    for (let i = 0; i < Math.floor(w / 2.2); i++) {
      for (const sz of [-1, 1]) {
        const lx = x - w / 2 + 1.2 + i * 2.2
        const lz = z + sz * (d / 2 + 1.4)
        box(0.7, 0.12, 1.9, M.glazeWhite, lx, y + 0.42, lz, g)
        const bk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.9), M.glazeWhite)
        bk.position.set(lx, y + 0.72, lz + sz * 0.8)
        bk.rotation.x = sz * 0.9
        g.add(bk)
      }
    }
    // 遮阳伞
    for (let i = 0; i < Math.floor(w / 5.0); i++) {
      for (const sz of [-1, 1]) {
        const ux = x - w / 2 + 2.5 + i * 5.0
        const uz = z + sz * (d / 2 + 1.4)
        cyl(0.06, 0.06, 2.2, M.aluPanel, ux, y + 1.2, uz, 6, g)
        const um = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 8), M.glazeWhite)
        um.position.set(ux, y + 2.5, uz)
        g.add(um)
      }
    }
  }

  /** 环洋邮轮：360m，13 层甲板，双烟囱 + 双泳池 + 戏水滑道 */
  function cruiseShip(g, x, z, ry = 0) {
    const root = new THREE.Group()
    root.position.set(x, 0, z)
    root.rotation.y = ry
    g.add(root)
    const L = 360, B = 48, D = 15
    const sec = shipHull(root, { len: L, beam: B, depth: D, draft: 4.4, mat: HULL_WHITE, sheer: 0.09, segN: 56, segP: 20 })
    // 防污漆（水下）+ 蓝色水线带
    taperBand(root, sec, B, 0.6, 1.1, M.wine, 0.1)
    taperBand(root, sec, B, 2.1, 1.0, M.glNavy, 0.12)
    taperBand(root, sec, B, 9.2, 0.6, M.glNavy, 0.1)
    // 外板水平分段缝（沿放样线，很细）
    for (const yy of [5.0, 7.6, 10.4, 12.9]) taperBand(root, sec, B, yy, 0.07, M.aluPanel, 0.012)
    // 舭龙骨
    for (const sz of [-1, 1]) box(96, 0.5, 0.5, M.wine, 16, 3.2, sz * (B / 2 - 0.45), root)
    // 舷侧舷窗（两层）
    for (let i = 0; i < 62; i++) {
      const px = -L / 2 + 26 + i * 4.6
      if (px > L / 2 - 22) continue
      for (const sz of [-1, 1]) {
        box(1.3, 0.9, 0.18, M.glWhite, px, 6.4, sz * (B / 2 - 0.1), root)
        box(1.1, 0.8, 0.16, M.glSmoke, px, 11.4, sz * (B / 2 - 0.14), root)
      }
    }
    // 艏部球鼻艏 + 锚 + 舷侧推进器格栅
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(4.2, 14, 10), HULL_NAVY)
    bulb.scale.set(1.7, 0.85, 1)
    bulb.position.set(L / 2 - 9, -1.2, 0)
    root.add(bulb)
    for (const sz of [-1, 1]) {
      box(3.2, 3.6, 0.5, M.charcoal, L / 2 - 22, 7.4, sz * (B / 2 - 0.5), root)
      box(2.2, 2.6, 0.4, M.darkFrame, L / 2 - 22, 7.2, sz * (B / 2 - 0.9), root)
      cyl(3.0, 3.0, 0.3, M.glWhite, L / 2 - 12, 3.2, sz * 8, 12, root)
    }
    // 主甲板漫步道：柚木铺装 + 随船体收窄的舷侧栏杆 + 甲板灯
    for (const sz of [-1, 1]) {
      box(262, 0.16, 3.0, M.teak, -6, D + 0.08, sz * 20.4, root)
      hullRail(root, sec, B, D, sz)
      // 甲板灯 / 救生圈（沿舷侧等距）
      for (let i = 0; i < 20; i++) {
        const px = -140 + i * 14
        box(0.22, 0.16, 0.22, M.glChampagne, px, D + 0.1, sz * 21.2, root)
        if (i % 5 === 2) {
          const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.15, 6, 14), M.paintRed)
          buoy.position.set(px + 4, D + 2.0, sz * 21.9)
          buoy.rotation.y = Math.PI / 2
          root.add(buoy)
          box(0.08, 0.1, 0.1, M.brightSilver, px + 4, D + 1.45, sz * 21.9, root)
        }
      }
    }
    // ---------- 上层建筑：11 层逐层收进（统一居中，艏部留观景露台） ----------
    const CX = -8
    const decks = [
      { y: 15.0, len: 300, beam: 44, h: 3.8, cell: 4.0, glass: M.glSmoke },  // 漫步甲板
      { y: 18.8, len: 292, beam: 43, h: 3.6, cell: 3.8, glass: M.glSmoke },
      { y: 22.4, len: 286, beam: 42, h: 3.6, balcony: true, cell: 3.5 },
      { y: 26.0, len: 278, beam: 41, h: 3.6, balcony: true, cell: 3.5 },
      { y: 29.6, len: 268, beam: 40, h: 3.6, balcony: true, cell: 3.5 },
      { y: 33.2, len: 254, beam: 38, h: 3.6, balcony: true, cell: 3.5 },
      { y: 36.8, len: 236, beam: 36, h: 3.6, balcony: true, cell: 3.4 },
      { y: 40.4, len: 224, beam: 33, h: 3.5, balcony: true, cell: 3.4 },
      { y: 43.9, len: 176, beam: 30, h: 3.5, balcony: true, cell: 3.4 },
      { y: 47.4, len: 132, beam: 27, h: 3.4, balcony: true, cell: 3.2 },
      { y: 50.8, len: 92, beam: 24, h: 3.4, cell: 3.6 },
    ]
    decks.forEach((d, i) => {
      deckSlab(root, {
        x: CX, y: d.y, len: d.len, beam: d.beam, h: d.h,
        balcony: d.balcony, cell: d.cell,
        detail: !!d.balcony,
        glass: d.glass || M.glWhite,
        mat: i % 2 ? M.glWhite : M.glSilver,
      })
      // 层间阳台扶手
      if (d.balcony) {
        for (const sz of [-1, 1]) {
          box(d.len, 0.12, 0.2, M.brightSilver, CX, d.y + d.h * 0.32 + 0.4, sz * (d.beam / 2 + 0.46), root)
        }
      }
    })
    // 各层艏/艉端面玻璃幕 + 端部扶手（侧立面之外也要有窗）
    decks.forEach((d) => {
      for (const sx of [-1, 1]) {
        const ex = CX + sx * d.len / 2
        const n = Math.max(2, Math.round(d.beam / 3.2))
        const cwz = d.beam / n
        for (let i = 0; i < n; i++) {
          const pz = -d.beam / 2 + cwz * (i + 0.5)
          box(0.12, d.h * 0.46, cwz - 0.24, M.glSmoke, ex + sx * 0.07, d.y + d.h * 0.55, pz, root)
          box(0.16, d.h * 0.5, 0.16, M.whiteStone, ex + sx * 0.05, d.y + d.h * 0.5, pz - cwz / 2, root)
        }
        box(0.34, 0.14, d.beam + 0.5, M.aluPanel, ex + sx * 0.05, d.y + 0.06, 0, root)
        box(0.12, 0.09, d.beam, M.brightSilver, ex + sx * 0.1, d.y + d.h * 0.32 + 0.34, 0, root)
      }
    })
    // ---------- 救生艇甲板（两舷各 9 艘） ----------
    for (let i = 0; i < 9; i++) {
      const lx = CX - 118 + i * 25
      for (const sz of [-1, 1]) lifeboat(root, lx, 18.3, sz * 22.6, sz, 11)
    }
    // ---------- 艏部观景厅（前倾玻璃幕） ----------
    box(32, 3.6, 28, M.glSmoke, 152, 16.8, 0, root)
    for (let i = 0; i < 7; i++) {
      const gx = 138 + i * 4.6
      for (const sz of [-1, 1]) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.2, 0.4), M.glWhite)
        pane.position.set(gx, 17.2, sz * 13.6)
        pane.rotation.x = sz * -0.34
        root.add(pane)
      }
    }
    box(33, 0.5, 29, M.aluPanel, 152, 18.8, 0, root)
    sideRail(root, 30, 13.4, 18.9, M.brightSilver, 2.6)
    sideRail(root, 30, -13.4, 18.9, M.brightSilver, 2.6)
    // 艏楼甲板：锚机 / 绞缆机 / 前桅 / 防浪板 / 锚链筒
    for (const sz of [-1, 1]) {
      cyl(2.0, 2.2, 1.6, M.charcoal, 120, D + 0.9, sz * 9, 12, root)
      box(4.0, 0.5, 2.2, M.darkFrame, 120, D + 1.8, sz * 9, root)
      box(6.0, 0.5, 1.6, M.aluDark, 118, D + 0.3, sz * 9, root)
      // 防浪板（前倾折板）
      const bw = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 0.3), M.glWhite)
      bw.position.set(104, D + 0.8, sz * 6.0)
      bw.rotation.y = sz * 0.45
      bw.castShadow = true
      root.add(bw)
      // 锚链筒 + 锚链
      cyl(1.1, 1.1, 0.4, M.charcoal, 143, D + 0.1, sz * 12.4, 12, root)
      for (let i = 0; i < 7; i++) {
        box(0.34, 0.3, 0.34, M.darkFrame, 140 - i * 2.2, D + 0.2, sz * (12.6 + i * 0.35), root)
      }
    }
    // 前桅 + 桅顶旗绳 + 艏旗杆
    cyl(0.22, 0.3, 9, M.brightSilver, 168, D + 4.5, 0, 8, root)
    box(6.4, 0.16, 0.16, M.brightSilver, 168, D + 8.4, 0, root)
    cyl(0.1, 0.12, 3.6, M.brightSilver, 155, D + 1.8, 0, 6, root)
    box(1.9, 0.7, 0.06, M.paintRed, 155.4, D + 3.1, 0, root)

    // ---------- 顶层阳光甲板 ----------
    poolDeck(root, CX - 6, 54.2, 0, 30, 14)
    poolDeck(root, CX - 54, 50.8, 0, 14, 11)
    // 顶层甲板：玻璃挡风板 + 栏杆 + 后部日光躺椅区
    for (const sz of [-1, 1]) {
      box(74, 1.05, 0.08, M.glSmoke, -8, 54.72, sz * 11.7, root)
      box(74, 0.09, 0.16, M.brightSilver, -8, 55.26, sz * 11.7, root)
      sideRail(root, 74, sz * 11.7, 54.2, M.brightSilver, 3.0, -8)
      sideRail(root, 26, sz * 13.1, 50.8, M.brightSilver, 2.6, -60)
    }
    // 日光躺椅（后部平台，成排）
    for (let i = 0; i < 5; i++) {
      for (const sz of [-1, 1]) {
        const lx = -48 + i * 3.4
        const lz = sz * 6.6
        box(0.8, 0.14, 2.0, M.glazeWhite, lx, 54.42, lz, root)
        const bk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 1.0), M.glazeWhite)
        bk.position.set(lx, 54.72, lz + sz * 0.85)
        bk.rotation.x = sz * 0.85
        root.add(bk)
      }
    }
    // 按摩池 ×2（带边栏）
    for (const [hx, hz] of [[-46, 7.4], [-40, -7.4]]) {
      cyl(2.5, 2.5, 0.8, M.whiteStone, hx, 54.6, hz, 20, root)
      cyl(2.1, 2.1, 0.16, M.glTeal, hx, 54.98, hz, 20, root)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        box(0.08, 0.46, 0.08, M.brightSilver, hx + Math.cos(a) * 2.4, 55.2, hz + Math.sin(a) * 2.4, root)
      }
    }
    // 戏水滑道（分段管沿抛物线）
    {
      const pts = []
      for (let i = 0; i <= 8; i++) {
        const t = i / 8
        pts.push(new THREE.Vector3(CX + 14 - t * 56, 55.4 + Math.sin(t * Math.PI) * 4.4, 9.6 - Math.sin(t * Math.PI) * 3.0))
      }
      for (let i = 0; i < pts.length - 1; i++) strut(root, pts[i], pts[i + 1], 1.15, M.glTeal, 10)
      // 支撑柱
      for (let i = 1; i < 5; i++) {
        const p = pts[i]
        cyl(0.24, 0.24, p.y - 54.2, M.brightSilver, p.x, 54.2 + (p.y - 54.2) / 2, p.z, 6, root)
      }
    }
    // 甲板家具：吧台 / 高脚凳 / 花池 / 躺椅
    // 露天吧台放在 50.8 层艉部露台，避开顶层泳池
    box(14, 1.1, 3.0, M.teak, -50, 51.35, 8.6, root)
    box(14.4, 0.14, 3.4, M.glazeWhite, -50, 51.95, 8.6, root)
    for (let i = 0; i < 5; i++) cyl(0.28, 0.28, 0.9, M.glazeWhite, -55 + i * 2.4, 51.65, 11.0, 8, root)
    for (let i = 0; i < 7; i++) {
      planter(root, CX - 30 + i * 9, 9.4, 2.2, 1.4, 54.2)
    }
    // ---------- 烟囱（艉部，坐落在第 8 层甲板顶） ----------
    funnel(root, CX - 94, 43.9, 4.4, 12, M.glNavy)
    funnel(root, CX - 110, 43.9, 3.4, 10, M.glNavy)
    box(30, 1.4, 22, M.aluPanel, CX - 102, 43.9, 0, root)
    // ---------- 驾驶台（顶层前部，前倾窗） ----------
    box(22, 3.2, 25, M.glWhite, CX + 32, 55.8, 0, root)
    for (let i = 0; i < 5; i++) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 0.4), M.glSmoke)
      pane.position.set(CX + 24 + i * 4.0, 56.2, 12.6)
      pane.rotation.x = -0.26
      root.add(pane)
      const pane2 = pane.clone()
      pane2.position.z = -12.6
      pane2.rotation.x = 0.26
      root.add(pane2)
    }
    box(23, 0.4, 26, M.aluPanel, CX + 32, 57.5, 0, root)
    // 驾驶台两翼（伸出舷外）+ 栏杆 + 探照灯 + 航行灯
    for (const sz of [-1, 1]) {
      box(8.0, 0.34, 8.0, M.aluPanel, CX + 32, 55.4, sz * 14.5, root)
      box(8.0, 0.2, 0.14, M.glSmoke, CX + 32, 57.2, sz * 18.4, root)
      for (let i = 0; i <= 4; i++) {
        box(0.08, 1.0, 0.08, M.brightSilver, CX + 28.2 + i * 1.9, 56.0, sz * 18.4, root)
      }
      box(8.0, 0.09, 0.1, M.brightSilver, CX + 32, 57.2, sz * 18.4, root)
      // 探照灯
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.0, 10), M.glazeWhite)
      lamp.position.set(CX + 34.6, 56.2, sz * 17.0)
      lamp.rotation.z = Math.PI / 2
      root.add(lamp)
      cyl(0.1, 0.1, 0.8, M.aluDark, CX + 34.6, 55.6, sz * 17.0, 6, root)
      // 航行灯（左红右绿）
      box(0.5, 0.42, 0.5, sz > 0 ? M.paintGreen : M.paintRed, CX + 28.4, 56.6, sz * 18.5, root)
      box(0.7, 0.1, 0.7, M.aluDark, CX + 28.4, 56.36, sz * 18.5, root)
      // 汽笛平台
      box(1.2, 1.0, 1.2, M.glWhite, CX + 28.4, 56.9, sz * 6.4, root)
    }
    // ---------- 雷达桅 ----------
    radarMast(root, CX + 20, 54.2, 17)
    radarMast(root, CX - 52, 50.8, 10)
    // ---------- 艉部露台 + 泳池 ----------
    box(26, 0.5, 34, M.paving, -168, D + 0.3, 0, root)
    box(18, 0.6, 16, M.glazeWhite, -170, D + 0.4, 0, root)
    box(16, 0.3, 14, M.glTeal, -170, D + 0.8, 0, root)
    for (const sz of [-1, 1]) {
      sideRail(root, 26, sz * 16.6, D + 0.4, M.brightSilver, 2.6)
    }
    // 系缆桩 + 缆绳
    for (const px of [150, 60, -60, -150]) {
      for (const sz of [-1, 1]) {
        cyl(0.45, 0.5, 0.9, M.charcoal, px, D + 0.5, sz * (B / 2 - 1.6), 8, root)
      }
    }
    // 艉旗杆 + 旗帜 + 系缆绞车 + 尾封栏杆
    cyl(0.14, 0.18, 7.0, M.brightSilver, -182, D + 3.5, 0, 8, root)
    box(0.06, 1.9, 3.0, M.paintRed, -181.9, D + 5.6, 1.5, root)
    for (const sz of [-1, 1]) {
      cyl(1.0, 1.0, 1.2, M.charcoal, -166, D + 0.85, sz * 13.0, 10, root)
      box(2.4, 0.4, 1.6, M.aluDark, -166, D + 1.6, sz * 13.0, root)
    }
    // ---------- 船名（两舷） ----------
    for (const sz of [-1, 1]) {
      box(26, 2.2, 0.24, M.glNavy, -150, 12.2, sz * (B / 2 - 0.6), root)
      box(21, 0.8, 0.2, M.glazeWhite, -150, 12.4, sz * (B / 2 - 0.48), root)
    }
    // ---------- 尾流泡沫（窄条，不要太抢眼） ----------
    for (const sz of [-1, 1]) {
      box(34, 0.1, 6.0, M.glazeWhite, -L / 2 + 12, 0.62, sz * 17, root)
    }
    box(26, 0.12, 42, M.glazeWhite, -L / 2 - 10, 0.55, 0, root)
    // 船艏破浪
    for (const sz of [-1, 1]) {
      const spray = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 7), M.glazeWhite)
      spray.scale.set(2.4, 0.28, 1)
      spray.position.set(140, 1.2, sz * 14)
      root.add(spray)
    }
    return root
  }

  /** 集装箱船：230m，8 排箱列 + 艉部上层建筑 + 双吊杆 */
  function containerShip(g, x, z, ry = 0) {
    const root = new THREE.Group()
    root.position.set(x, 0, z)
    root.rotation.y = ry
    g.add(root)
    const L = 230, B = 32, D = 11
    const sec = shipHull(root, { len: L, beam: B, depth: D, draft: 4.0, mat: HULL_NAVY, sheer: 0.07 })
    taperBand(root, sec, B, 1.4, 1.2, M.corrRust, 0.1)
    taperBand(root, sec, B, 5.2, 0.7, M.glWhite, 0.1)
    // 舱口围板
    box(L * 0.62, 1.2, B - 4, M.glWhite, 20, D + 0.6, 0, root)
    // 集装箱：6 列 x 5~7 层，颜色随机
    const cols = [M.corrRed, M.corrBlue, M.corrGreen, M.corrRust, M.enamelYellow, M.enamelBlue, M.paintGreen, M.paintBlue]
    for (let bay = 0; bay < 13; bay++) {
      const bx = -50 + bay * 12.5
      const stack = 4 + (bay % 4)
      for (let lvl = 0; lvl < stack; lvl++) {
        for (let row = 0; row < 5; row++) {
          const col = cols[(bay * 3 + row * 5 + lvl * 7) % cols.length]
          box(12.0, 2.6, 5.6, col, bx, D + 1.2 + lvl * 2.62, -12 + row * 6.0, root)
          // 箱角件
          if (lvl === stack - 1) {
            for (const ox of [-5.4, 5.4]) for (const oz of [-2.3, 2.3]) {
              box(0.5, 0.14, 0.5, M.charcoal, bx + ox, D + 1.2 + lvl * 2.62 + 1.35, -12 + row * 6.0 + oz, root)
            }
          }
        }
      }
      // 绑扎桥
      if (bay % 4 === 1) {
        box(0.5, stack * 2.62 + 2, B - 2, M.charcoal, bx + 6.4, D + 1.2 + (stack * 2.62) / 2, 0, root)
      }
    }
    // 艉部上层建筑（驾驶台 + 生活区）
    box(20, 24, 22, M.glWhite, -78, D + 12, 0, root)
    for (let f = 0; f < 7; f++) {
      for (const sz of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          box(1.5, 1.1, 0.2, M.glWhite, -86 + i * 3.2, D + 3.4 + f * 3.2, sz * 11.2, root)
        }
      }
    }
    box(22, 3.6, 20, M.glSmoke, -74, D + 25.5, 0, root)
    box(23, 0.5, 21, M.aluPanel, -74, D + 27.4, 0, root)
    // 驾驶台侧翼瞭望台
    for (const sz of [-1, 1]) {
      box(7, 1.0, 0.4, M.glazeWhite, -70, D + 25.6, sz * 13, root)
      box(0.3, 3.4, 0.3, M.brightSilver, -66, D + 26, sz * 13, root)
    }
    radarMast(root, -74, D + 27.6, 10)
    // 烟囱
    funnel(root, -92, D + 27.4, 2.8, 7, M.glNavy)
    // 艏部吊杆 + 舷墙 + 锚机
    for (let i = 0; i < 12; i++) for (const sz of [-1, 1]) {
      box(0.16, 1.1, 0.16, M.aluPanel, 62 + i * 4.2, D + 0.6, sz * 12.5, root)
    }
    box(L * 0.72, 0.12, 0.14, M.brightSilver, 38, D + 1.6, 12.5, root)
    box(L * 0.72, 0.12, 0.14, M.brightSilver, 38, D + 1.6, -12.5, root)
    for (const sz of [-1, 1]) {
      cyl(1.1, 1.2, 2.2, M.charcoal, 92, D + 0.8, sz * 9, 10, root)
      box(3.0, 0.7, 0.5, M.darkFrame, 92, D + 2.2, sz * 9, root)
    }
    // 起重吊杆
    const crane = (cx) => {
      cyl(1.1, 1.4, 14, M.enamelYellow, cx, D + 7, 0, 8, root)
      const jib = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 30, 8), M.enamelYellow)
      jib.position.set(cx + 12, D + 18, 0)
      jib.rotation.z = -0.85
      jib.castShadow = true
      root.add(jib)
      box(2.4, 2.0, 2.4, M.glWhite, cx, D + 15, 0, root)
    }
    crane(60)
    crane(-30)
    // 尾流
    box(L * 1.04, 0.12, B * 1.2, M.glazeWhite, 0, 0.9, 0, root)
    box(46, 0.14, 16, M.glazeWhite, -L / 2 - 14, 0.62, 0, root)
    return root
  }

  /** 客滚渡轮：110m，双层车甲板 + 上层客舱 + 跳板 */
  function ferryShip(g, x, z, ry = 0) {
    const root = new THREE.Group()
    root.position.set(x, 0, z)
    root.rotation.y = ry
    g.add(root)
    const L = 110, B = 24, D = 7
    const sec = shipHull(root, { len: L, beam: B, depth: D, draft: 3.0, mat: HULL_WHITE, sheer: 0.12 })
    taperBand(root, sec, B, 0.8, 1.4, M.wine, 0.1)
    taperBand(root, sec, B, 3.0, 0.7, M.glNavy, 0.1)
    // 主车甲板（敞开艏艉 + 侧面开口）
    box(L * 0.74, 5.0, B - 2.0, M.glWhite, 0, 9.6, 0, root)
    for (const sz of [-1, 1]) {
      // 车甲板侧开口
      box(30, 4.2, 0.2, M.charcoal, 0, 9.6, sz * (B / 2 - 0.9), root)
      for (let i = 0; i < 14; i++) {
        box(0.14, 4.2, 0.5, M.glWhite, -32 + i * 5.0, 9.6, sz * (B / 2 - 0.86), root)
      }
    }
    // 艏跳板
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 14), M.aluPanel)
    ramp.position.set(L / 2 + 2, 8.0, 0)
    ramp.rotation.z = 0.42
    root.add(ramp)
    for (const sz of [-1, 1]) {
      box(14, 0.3, 0.3, M.brightSilver, L / 2 + 4, 9.6, sz * 6.6, root)
      box(0.3, 3.0, 0.3, M.brightSilver, L / 2 + 10, 10.4, sz * 6.6, root)
    }
    // 上层客舱
    box(L * 0.6, 4.2, B - 4.0, M.glWhite, -6, 14.2, 0, root)
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 15; i++) {
        box(2.4, 1.5, 0.2, M.glWhite, -33 + i * 4.0, 14.2, sz * (B / 2 - 2.0), root)
      }
      box(L * 0.6, 0.3, 0.5, M.aluPanel, -6, 16.5, sz * (B / 2 - 2.0), root)
    }
    // 驾驶台悬挑
    box(16, 3.4, B - 1.0, M.glSmoke, 26, 17.6, 0, root)
    box(17, 0.5, B - 0.6, M.aluPanel, 26, 19.5, 0, root)
    for (const sz of [-1, 1]) box(6, 0.9, 0.4, M.glazeWhite, 30, 17.6, sz * (B / 2 - 0.2), root)
    radarMast(root, 26, 19.7, 8)
    funnel(root, 4, 19.6, 2.6, 6.5, M.glNavy)
    // 舷侧救生筏 + 栏杆
    for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) {
      const raft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10), M.glazeWhite)
      raft.rotation.x = Math.PI / 2
      raft.position.set(-24 + i * 9, 13.0, sz * (B / 2 - 1.4))
      root.add(raft)
      box(2.8, 0.14, 0.14, M.paintYell, -24 + i * 9, 13.8, sz * (B / 2 - 1.4), root)
    }
    box(L * 0.8, 0.12, 0.12, M.brightSilver, 0, 16.2, B / 2 - 1.8, root)
    box(L * 0.8, 0.12, 0.12, M.brightSilver, 0, 16.2, -(B / 2 - 1.8), root)
    // 系缆桩
    for (let i = 0; i < 5; i++) for (const sz of [-1, 1]) cyl(0.3, 0.34, 0.8, M.charcoal, -34 + i * 17, D + 0.4, sz * (B / 2 - 1.2), 8, root)
    box(L, 0.12, B * 1.1, M.glazeWhite, 0, 0.7, 0, root)
    return root
  }

  /** 拖船：32m，大马力、橡胶护舷、驾驶室高位 */
  function tugBoat(g, x, z, ry = 0) {
    const root = new THREE.Group()
    root.position.set(x, 0, z)
    root.rotation.y = ry
    g.add(root)
    const L = 32, B = 11, D = 5.2
    const sec = shipHull(root, { len: L, beam: B, depth: D, draft: 2.6, mat: HULL_BLACK, sheer: 0.16 })
    taperBand(root, sec, B, 2.4, 1.0, M.paintRed, 0.08)
    // 木甲板
    box(L * 0.8, 0.14, B - 1.2, M.teak, -1, D + 0.1, 0, root)
    // 上层建筑
    box(10, 3.2, 8.4, M.glWhite, -2, D + 1.7, 0, root)
    box(9.2, 2.6, 9.0, M.glSmoke, -2, D + 4.0, 0, root)
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 4; i++) box(1.4, 1.1, 0.16, M.glWhite, -6 + i * 2.6, D + 4.2, sz * 4.55, root)
    }
    box(10, 0.4, 9.6, M.aluPanel, -2, D + 5.5, 0, root)
    sideRail(root, 9.4, 4.7, D + 5.6, M.brightSilver, 2.4)
    sideRail(root, 9.4, -4.7, D + 5.6, M.brightSilver, 2.4)
    // 排气管 + 桅杆
    funnel(root, -7, D + 5.6, 1.7, 5.4, M.charcoal)
    radarMast(root, 0, D + 5.6, 7)
    // 橡胶护舷
    for (let i = 0; i < 7; i++) for (const sz of [-1, 1]) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.22, 6, 10), M.charcoal)
      tire.position.set(-12 + i * 4, D - 1.0, sz * (B / 2 + 0.1))
      tire.rotation.y = 0
      root.add(tire)
    }
    // 绞缆机 + 拖钩
    for (const ox of [-10, 6]) {
      cyl(1.5, 1.5, 1.4, M.paintYell, ox, D + 0.6, 0, 12, root)
      box(3.4, 0.4, 2.4, M.charcoal, ox, D + 0.2, 0, root)
    }
    cyl(0.7, 0.9, 1.2, M.darkFrame, -13, D + 0.8, 0, 10, root)
    // 艏部探照灯
    for (const sz of [-1, 1]) {
      cyl(0.16, 0.16, 3.0, M.brightSilver, 8, D + 1.6, sz * 3.0, 6, root)
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.6, 10), M.glazeWhite)
      lamp.position.set(8, D + 3.1, sz * 3.0)
      root.add(lamp)
    }
    box(L * 1.02, 0.1, B * 1.1, M.glazeWhite, 0, 0.62, 0, root)
    return root
  }

  /** 帆船：双桅纵帆 + 三角帆 + 索具 */
  function sailBoat(g, x, z, ry = 0, L = 18) {
    const root = new THREE.Group()
    root.position.set(x, 0, z)
    root.rotation.y = ry
    g.add(root)
    const B = L * 0.32
    const sec = shipHull(root, { len: L, beam: B, depth: 1.9, draft: 1.5, mat: HULL_WHITE, sheer: 0.22 })
    taperBand(root, sec, B, 0.7, 0.5, M.paintBlue, 0.06)
    // 木质甲板 + 舱室
    box(L * 0.7, 0.12, B - 0.6, M.teak, -1, 1.95, 0, root)
    box(L * 0.3, 1.2, B * 0.72, M.glWhite, -1.5, 2.5, 0, root)
    box(L * 0.26, 0.5, B * 0.6, M.glSmoke, -1.5, 3.0, 0, root)
    // 桅杆 + 帆 + 索具
    const mastH = L * 1.05
    cyl(0.15, 0.24, mastH, M.brightSilver, 1.4, 2.0 + mastH / 2, 0, 8, root)
    // 主帆（三角面片）
    const tri = (a, b, c, mat) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3))
      geo.computeVertexNormals()
      const m = new THREE.Mesh(geo, mat)
      m.material.side = THREE.DoubleSide
      m.castShadow = true
      return m
    }
    const main = tri([1.4, 2.4, 0], [1.4, mastH + 1.4, 0], [-L * 0.42, 2.6, 0], SAIL_MAT)
    root.add(main)
    const jib = tri([1.4, 3.0, 0], [1.4, mastH * 0.92, 0], [L * 0.42, 2.2, 0.4], SAIL_MAT)
    root.add(jib)
    // 帆骨 + 桅顶
    for (let i = 0; i < 4; i++) {
      box(L * 0.16, 0.06, 0.06, M.aluPanel, 1.0 - i * 1.0, 3.6 + i * (mastH * 0.2), 0, root)
    }
    box(0.16, 0.16, 0.16, M.glazeWhite, 1.4, 2.0 + mastH, 0, root)
    // 索具
    strut(root, new THREE.Vector3(1.4, 2.0 + mastH, 0), new THREE.Vector3(L * 0.46, 2.2, 0), 0.035, M.darkFrame, 4)
    strut(root, new THREE.Vector3(1.4, 2.0 + mastH, 0), new THREE.Vector3(-L * 0.46, 2.2, 0), 0.035, M.darkFrame, 4)
    for (const sz of [-1, 1]) {
      strut(root, new THREE.Vector3(1.4, 2.0 + mastH * 0.72, 0), new THREE.Vector3(0, 2.2, sz * (B / 2 - 0.4)), 0.03, M.darkFrame, 4)
    }
    // 舵轮 + 尾部
    cyl(0.36, 0.36, 0.3, M.teak, -L * 0.34, 3.0, 0, 10, root)
    box(L * 0.9, 0.08, 0.1, M.brightSilver, 0, 2.6, B / 2 - 0.5, root)
    box(L * 0.9, 0.08, 0.1, M.brightSilver, 0, 2.6, -(B / 2 - 0.5), root)
    return root
  }

  /** 快艇：12m，深 V 船体 + 挡风玻璃 + 舷外机 */
  function speedBoat(g, x, z, ry = 0) {
    const root = new THREE.Group()
    root.position.set(x, 0, z)
    root.rotation.y = ry
    g.add(root)
    const L = 12, B = 3.8
    const sec = shipHull(root, { len: L, beam: B, depth: 1.5, draft: 0.9, mat: HULL_WHITE, sheer: 0.3 })
    taperBand(root, sec, B, 0.5, 0.4, M.paintBlue, 0.05)
    // 甲板 + 舷墙
    box(L * 0.7, 0.12, B - 0.4, M.teak, 0, 1.5, 0, root)
    for (const sz of [-1, 1]) {
      box(L * 0.66, 0.24, 0.14, M.glWhite, 0, 1.68, sz * (B / 2 - 0.2), root)
    }
    // 挡风玻璃（斜）
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 2.6), M.glSmoke)
    ws.position.set(1.6, 2.0, 0)
    ws.rotation.z = -0.3
    root.add(ws)
    // 座椅 + 驾驶台
    for (const sz of [-1, 1]) {
      box(1.1, 0.5, 0.9, M.glazeWhite, 0.4, 1.8, sz * 0.8, root).rotation.x = 0
      box(0.3, 0.7, 0.9, M.glazeWhite, -0.2, 2.1, sz * 0.8, root)
    }
    box(1.6, 0.5, 1.2, M.darkFrame, 1.6, 1.85, 0, root)
    // 舷外机
    box(0.8, 1.2, 0.9, M.charcoal, -L / 2 + 0.4, 1.4, 0, root)
    box(0.5, 1.4, 0.14, M.charcoal, -L / 2 + 0.1, 0.7, 0, root)
    // 遮阳篷（可选）
    box(2.6, 0.1, 2.6, M.glWhite, -2.6, 2.6, 0, root)
    for (const sz of [-1, 1]) cyl(0.06, 0.06, 1.1, M.brightSilver, -3.6, 2.1, sz * 1.2, 5, root)
    // 尾流
    box(L * 1.1, 0.08, B * 1.4, M.glazeWhite, -1, 0.5, 0, root)
    return root
  }

  /** 自航驳船：84m，散货舱 + 艉部驾驶楼 + 吊臂 */
  function barge(g, x, z, ry = 0) {
    const root = new THREE.Group()
    root.position.set(x, 0, z)
    root.rotation.y = ry
    g.add(root)
    const L = 84, B = 20, D = 5.0
    const sec = shipHull(root, { len: L, beam: B, depth: D, draft: 2.4, mat: HULL_RUST, sheer: 0.04, bowStart: 0.85 })
    taperBand(root, sec, B, 1.6, 1.2, M.charcoal, 0.1)
    // 货舱围板 + 砂石
    box(L * 0.66, 1.6, B - 2.4, M.glWhite, 8, D + 0.4, 0, root)
    box(L * 0.63, 1.0, B - 3.2, M.terraPale, 8, D + 1.2, 0, root)
    for (let i = 0; i < 3; i++) {
      const pile = new THREE.Mesh(new THREE.ConeGeometry(B * 0.36, 4.0, 9), M.terraPale)
      pile.position.set(-14 + i * 21, D + 3.0, 0)
      pile.castShadow = true
      root.add(pile)
    }
    // 艉部驾驶楼
    box(11, 6.4, 15, M.glWhite, -30, D + 3.6, 0, root)
    box(10, 2.4, 15.4, M.glSmoke, -30, D + 6.4, 0, root)
    box(11.4, 0.4, 16, M.aluPanel, -30, D + 7.8, 0, root)
    radarMast(root, -30, D + 8.0, 6)
    funnel(root, -34, D + 8.0, 1.8, 4.6, M.charcoal)
    // 甲板吊臂
    const jib = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 18, 8), M.enamelYellow)
    jib.position.set(-16, D + 6.0, 0)
    jib.rotation.z = 0.9
    jib.castShadow = true
    root.add(jib)
    cyl(1.0, 1.2, 6.0, M.enamelYellow, -16, D + 3.2, 0, 8, root)
    box(1.4, 1.2, 1.4, M.glWhite, -16, D + 6.4, 0, root)
    // 系缆桩 + 舷墙
    for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) {
      cyl(0.3, 0.34, 0.8, M.charcoal, -30 + i * 14, D + 0.3, sz * (B / 2 - 1.0), 8, root)
      box(0.16, 0.9, 0.16, M.aluPanel, -34 + i * 14, D + 0.7, sz * (B / 2 - 1.2), root)
    }
    for (const sz of [-1, 1]) box(L * 0.7, 0.1, 0.1, M.brightSilver, 4, D + 1.15, sz * (B / 2 - 1.2), root)
    box(L, 0.1, B * 1.05, M.glazeWhite, 0, 0.6, 0, root)
    return root
  }

  /** 渔船：24m，拖网架 + 龙门吊 + 浮球 */
  function fishingBoat(g, x, z, ry = 0) {
    const root = new THREE.Group()
    root.position.set(x, 0, z)
    root.rotation.y = ry
    g.add(root)
    const L = 24, B = 8, D = 4.0
    const sec = shipHull(root, { len: L, beam: B, depth: D, draft: 2.2, mat: HULL_GREEN, sheer: 0.2 })
    taperBand(root, sec, B, 1.2, 0.8, M.paintRed, 0.08)
    box(L * 0.7, 0.12, B - 1.0, M.teak, -1, D + 0.1, 0, root)
    // 驾驶室
    box(7, 3.4, 5.6, M.glWhite, 2, D + 2.0, 0, root)
    box(6.4, 1.8, 6.0, M.glSmoke, 2, D + 2.4, 0, root)
    box(7.4, 0.3, 6.2, M.aluPanel, 2, D + 4.2, 0, root)
    // 桅 + 龙门架 + 拖网
    cyl(0.16, 0.2, 10, M.bark, 2, D + 9.0, 0, 6, root)
    for (const sz of [-1, 1]) {
      strut(root, new THREE.Vector3(-2, D + 0.2, sz * 3.2), new THREE.Vector3(-9, D + 7.0, sz * 3.2), 0.14, M.aluPanel, 5)
    }
    box(0.4, 0.4, 7.0, M.aluPanel, -9, D + 7.0, 0, root)
    // 拖网 + 浮球 + 绞车
    for (let i = 0; i < 4; i++) {
      cyl(0.32, 0.32, 0.5, M.paintYell, -12 + i * 2.4, D + 1.4, 2.2, 8, root)
    }
    cyl(0.9, 0.9, 1.6, M.charcoal, -6, D + 0.9, 0, 10, root)
    // 探照灯 + 舷灯
    cyl(0.1, 0.1, 2.0, M.brightSilver, 4.2, D + 5.4, 2.4, 5, root)
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.5, 9), M.glazeWhite)
    lamp.position.set(4.2, D + 6.5, 2.4)
    root.add(lamp)
    for (const sz of [-1, 1]) box(0.3, 0.3, 0.5, M.paintRed, 8, D + 4.6, sz * (B / 2 - 0.8), root)
    // 舷墙
    for (const sz of [-1, 1]) box(L * 0.8, 0.9, 0.16, M.glWhite, -1, D + 0.5, sz * (B / 2 - 0.3), root)
    box(L, 0.1, B * 1.1, M.glazeWhite, 0, 0.55, 0, root)
    return root
  }

  /** 两岸码头起重机（岸边集装箱吊） */
  function quayCrane(g, x, z, ry = 0) {
    const s = new THREE.Group()
    s.position.set(x, 0, z)
    s.rotation.y = ry
    g.add(s)
    for (const ox of [-7, 7]) for (const oz of [-5, 5]) {
      box(1.2, 24, 1.2, M.enamelYellow, ox, 12, oz, s)
    }
    for (const oy of [6, 14, 22]) {
      box(15, 1.0, 1.0, M.enamelYellow, 0, oy, -5, s)
      box(15, 1.0, 1.0, M.enamelYellow, 0, oy, 5, s)
      box(1.0, 1.0, 11, M.enamelYellow, -7, oy, 0, s)
      box(1.0, 1.0, 11, M.enamelYellow, 7, oy, 0, s)
    }
    // 大梁（悬臂伸向水面）
    box(52, 1.8, 2.0, M.enamelYellow, 6, 26.0, -5, s)
    box(52, 1.8, 2.0, M.enamelYellow, 6, 26.0, 5, s)
    box(2.0, 1.8, 12, M.enamelYellow, -20, 26.0, 0, s)
    // 小车 + 吊具
    box(4.0, 2.0, 8.0, M.glWhite, 18, 24.4, 0, s)
    box(0.3, 12, 0.3, M.charcoal, 18, 18, -2, s)
    box(0.3, 12, 0.3, M.charcoal, 18, 18, 2, s)
    box(8.0, 1.4, 5.0, M.enamelRed, 18, 11.5, 0, s)
    // 司机室
    box(4.0, 3.0, 4.0, M.glSmoke, 14, 24.0, 0, s)
    box(4.4, 0.4, 4.4, M.aluPanel, 14, 25.7, 0, s)
    // 梯形腿 + 行走机构
    for (const ox of [-7, 7]) for (const oz of [-5, 5]) {
      box(2.4, 2.0, 2.4, M.charcoal, ox, 1.0, oz, s)
      for (let i = 0; i < 2; i++) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 10), M.charcoal)
        wh.rotation.x = Math.PI / 2
        wh.position.set(ox, 0.9, oz + (i ? 1.6 : -1.6))
        s.add(wh)
      }
    }
    return s
  }

  /**
   * 河道：两岸驳岸 + 滨水步道 + 码头 + 各式船舶
   */
  function addRiver(opts = {}) {
    const cx = opts.cx ?? 0
    const cz = opts.cz ?? 820
    const len = opts.len ?? 3400
    const W = opts.width ?? 240
    const root = new THREE.Group()
    root.name = 'river'
    kit.scene.add(root)
    // 水面：单独的水材质（有反射但也吃天光，不像镜面玻璃那样发黑）
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#33627e', roughness: 0.34, metalness: 0.18,
      envMap: M.glWhite.envMap, envMapIntensity: 0.55,
    })
    const waterDeep = new THREE.MeshStandardMaterial({
      color: '#274b63', roughness: 0.42, metalness: 0.14,
      envMap: M.glWhite.envMap, envMapIntensity: 0.45,
    })
    const waterLight = new THREE.MeshStandardMaterial({
      color: '#5f95ac', roughness: 0.26, metalness: 0.2,
      envMap: M.glWhite.envMap, envMapIntensity: 0.7,
    })
    const wBase = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, W), waterDeep)
    wBase.position.set(cx, 0.0, cz)
    wBase.receiveShadow = true
    root.add(wBase)
    const wTop = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, W), waterMat)
    wTop.position.set(cx, 0.22, cz)
    wTop.receiveShadow = true
    root.add(wTop)
    // 主航道浅色带 + 岸边浅浅的水色
    for (const [zw, mat] of [[W * 0.34, waterLight], [W * 0.2, waterLight]]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, zw), mat)
      band.position.set(cx, 0.25, cz + (zw === W * 0.34 ? 12 : -46))
      root.add(band)
    }
    // 波纹（细长条，压低存在感）
    for (let i = 0; i < 90; i++) {
      const rx = cx - len / 2 + 20 + ((i * 137) % (len - 40))
      const rz2 = cz - W / 2 + 14 + ((i * 53) % (W - 28))
      const rip = new THREE.Mesh(new THREE.BoxGeometry(9 + (i % 5) * 4, 0.03, 0.5), waterLight)
      rip.position.set(rx, 0.27, rz2)
      rip.rotation.y = (i % 7) * 0.12 - 0.3
      root.add(rip)
    }
    // 两岸：驳岸 + 压顶 + 步道 + 栏杆 + 绿化
    for (const sz of [-1, 1]) {
      const zBank = cz + sz * (W / 2)
      box(len, 2.2, 4.0, M.tuff, cx, 1.1, zBank + sz * 2.0, root)
      box(len, 0.4, 5.2, M.whiteStone, cx, 2.3, zBank + sz * 2.0, root)
      box(len, 0.14, 1.2, M.curb, cx, 2.56, zBank + sz * 2.0, root)
      // 步道 + 草坪
      box(len, 0.16, 30, M.paving, cx, 2.4, zBank + sz * 18, root)
      box(len, 0.04, 26, M.paving, cx, 2.5, zBank + sz * 18, root)
      box(len, 0.4, 12, M.greenSoft, cx, 2.5, zBank + sz * 40, root)
      // 岸线栏杆
      for (let i = 0; i <= Math.floor(len / 3.0); i++) {
        box(0.1, 1.05, 0.1, M.brightSilver, cx - len / 2 + i * 3.0, 2.95, zBank + sz * 4.2, root)
      }
      box(len, 0.1, 0.16, M.brightSilver, cx, 3.45, zBank + sz * 4.2, root)
      box(len, 0.08, 0.1, M.brightSilver, cx, 3.0, zBank + sz * 4.2, root)
      // 路灯 / 长椅 / 垃圾箱 / 行道树
      for (let i = 0; i < Math.floor(len / 40); i++) {
        const px = cx - len / 2 + 18 + i * 40
        lampPost(root, px, zBank + sz * 9.5, 6.4, sz > 0 ? 0 : Math.PI)
        if (i % 2 === 0) {
          benchAt(root, px + 10, zBank + sz * 8.5, sz > 0 ? Math.PI : 0)
          treeAt(root, px + 18, zBank + sz * 15, 1.0, 3.4)
          treeAt(root, px + 26, zBank + sz * 24, 0.9, 3.0)
        }
      }
      // 垂柳贴岸
      for (let i = 0; i < Math.floor(len / 80); i++) {
        treeAt(root, cx - len / 2 + 40 + i * 80, zBank + sz * 8.0, 1.2, 3.4, 'willow')
      }
      // 台阶下到水边（两处）
      for (const sx of [-520, 480]) {
        for (let i = 0; i < 4; i++) {
          box(9, 0.3, 1.2, M.whiteStone, sx, 2.1 - i * 0.45, zBank + sz * (3.6 + i * 1.2), root)
        }
      }
    }
    // 木栈桥码头（四处）+ 系泊桩
    for (const dx of [-620, -260, 340, 760]) {
      for (const sz of [-1, 1]) {
        const zBank = cz + sz * (W / 2)
        box(34, 0.5, 30, M.teak, dx, 2.1, zBank - sz * 17, root)
        for (let i = 0; i < 4; i++) {
          for (const ox of [-14, 0, 14]) cyl(0.34, 0.4, 4.4, M.teak, dx + ox, 0.9, zBank - sz * (5 + i * 8), 8, root)
        }
        for (const ox of [-16, 16]) box(0.2, 1.0, 30, M.whiteStone, dx + ox, 2.75, zBank - sz * 17, root)
        for (let i = 0; i < 5; i++) cyl(0.26, 0.3, 0.9, M.charcoal, dx - 14 + i * 7, 2.55, zBank - sz * 5, 8, root)
        // 救生圈 + 灯
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.16, 6, 14), M.paintRed)
        ring.position.set(dx + 15, 3.5, zBank - sz * 19)
        root.add(ring)
        lampPost(root, dx + 12, zBank - sz * 26, 4.6, sz > 0 ? Math.PI : 0)
      }
    }
    // 航道浮标 + 灯浮
    for (let i = 0; i < 9; i++) {
      const bx = -1300 + i * 320
      for (const sz of [-1, 1]) {
        const buoy = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 3.0, 10), sz > 0 ? M.paintRed : M.paintGreen)
        buoy.position.set(bx, 1.4, cz + sz * (W / 2 - 12))
        root.add(buoy)
        cyl(0.16, 0.16, 2.4, M.brightSilver, bx, 4.0, cz + sz * (W / 2 - 12), 6, root)
        box(0.5, 0.5, 0.5, M.glazeWhite, bx, 5.3, cz + sz * (W / 2 - 12), root)
      }
    }
    // ---------- 船队（四条航道，互不重叠） ----------
    const L1 = cz - 58, L2 = cz + 58, L3 = cz - 92, L4 = cz + 92
    cruiseShip(root, -560, L1, 0.015)
    cruiseShip(root, 430, L2, Math.PI - 0.012)
    containerShip(root, -1020, L2, Math.PI + 0.01)
    containerShip(root, 900, L1, 0.01)
    ferryShip(root, -300, L3, 0.02)
    ferryShip(root, 1180, L4, Math.PI + 0.02)
    barge(root, -120, L4, Math.PI - 0.01)
    barge(root, 690, L4, 0.02)
    tugBoat(root, -168, L3, 0.08)
    tugBoat(root, 300, L3, Math.PI - 0.08)
    tugBoat(root, -880, L3, 0.05)
    fishingBoat(root, 92, L3, 0.1)
    fishingBoat(root, 1120, L3, Math.PI + 0.1)
    fishingBoat(root, -760, L4, 0.06)
    // 帆船队（近岸）
    for (let i = 0; i < 8; i++) {
      sailBoat(root, -760 + i * 46, cz - 92 + (i % 2) * 18, 0.18 + i * 0.08, 14 + (i % 3) * 3)
    }
    for (let i = 0; i < 5; i++) {
      sailBoat(root, 60 + i * 40, cz + 94 - (i % 2) * 16, Math.PI + i * 0.06, 13 + (i % 2) * 4)
    }
    // 快艇
    for (let i = 0; i < 6; i++) {
      speedBoat(root, 200 + i * 42, cz - 88 + (i % 2) * 20, 0.3 + i * 0.2)
    }
    // 岸边集装箱吊机（货轮附近）
    for (let i = 0; i < 4; i++) {
      quayCrane(root, -1000 + i * 30, cz + W / 2 + 16, Math.PI)
    }
    for (let i = 0; i < 3; i++) {
      quayCrane(root, 880 + i * 32, cz - W / 2 - 16, 0)
    }
    // ---------- 跨河桥（避开船只停泊位） ----------
    for (const bx of [-1320, 1290]) {
      // 桥面 + 桥墩
      box(56, 2.4, W + 76, M.concrete, bx, 24.0, cz, root)
      box(57, 0.4, W + 76, M.aluPanel, bx, 25.4, cz, root)
      box(57, 0.4, W + 76, M.concreteDark, bx, 22.6, cz, root)
      for (const pz of [-58, 0, 58]) {
        box(46, 20, 9, M.whiteStone, bx, 10.0, cz + pz, root)
        box(50, 2.0, 12, M.whiteStone, bx, 20.4, cz + pz, root)
      }
      // 栏杆 + 灯杆
      for (const sz of [-1, 1]) {
        box(56, 1.2, 0.3, M.brightSilver, bx, 26.2, cz + sz * (W / 2 + 36), root)
        for (let i = 0; i < 14; i++) {
          box(0.16, 1.2, 0.16, M.brightSilver, bx - 26 + i * 4, 26.2, cz + sz * (W / 2 + 36), root)
        }
      }
      for (let i = 0; i < 7; i++) {
        lampPost(root, bx - 24 + i * 8, cz + (W / 2 + 30), 7.0, Math.PI)
        lampPost(root, bx - 24 + i * 8, cz - (W / 2 + 30), 7.0, 0)
      }
      // 引桥（两侧坡道）
      for (const sz of [-1, 1]) {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(120, 2.0, 46), M.concrete)
        ramp.position.set(bx + sz * 88, 12.0, cz + (sz > 0 ? W / 2 + 62 : -(W / 2 + 62)))
        ramp.rotation.y = Math.PI / 2
        ramp.rotation.z = -0.18
        root.add(ramp)
      }
      // 桥上车辆
      for (let i = 0; i < 6; i++) {
        const car = carLo(root, 0, 0, 0, [M.paintRed, M.glazeWhite, M.paintBlue, M.charcoal, M.paintYell, M.glSilver][i])
        car.position.set(bx - 20 + i * 8, 26.0, cz - 12)
      }
      for (let i = 0; i < 5; i++) {
        const car = carLo(root, 0, 0, Math.PI, [M.paintBlue, M.paintYell, M.glazeWhite, M.paintGreen, M.paintRed][i])
        car.position.set(bx + 20 - i * 8, 26.0, cz + 12)
      }
    }
    return root
  }

  // ---------------- 城市路网 + 车流 ----------------
  /**
   * @param sites 已落位的地块信息 [{x,z,w,d,circ}]
   */
  function addStreets(sites, opts) {
    const { COLS, ROW_UNITS, SP_X, SP_Z } = opts
    const root = new THREE.Group()
    root.name = 'streets'
    kit.scene.add(root)
    const xs = []
    for (let k = 0; k <= COLS; k++) xs.push((k - COLS / 2) * SP_X)
    const zs = []
    for (let j = 0; j <= ROW_UNITS; j++) zs.push((j - ROW_UNITS / 2) * SP_Z)
    const x0 = xs[0] - 26
    const x1 = xs[xs.length - 1] + 26
    const z0 = zs[0] - 28
    const z1 = zs[zs.length - 1] + 28
    const zLen = z1 - z0
    const xLen = x1 - x0
    const RW = 9 // 车行道总宽
    // 沥青
    for (const sx of xs) box(RW, 0.1, zLen, M.aluDark, sx, 0.05, (z0 + z1) / 2, root)
    for (const sz of zs) box(xLen, 0.096, RW, M.aluDark, (x0 + x1) / 2, 0.052, sz, root)
    // 中心虚线 + 两侧边线
    for (const sx of xs) {
      for (let i = 0; i < Math.floor(zLen / 8); i++) box(0.18, 0.04, 3.4, M.roadPaint, sx, 0.12, z0 + 4 + i * 8, root)
      for (const o of [-RW / 2 + 0.3, RW / 2 - 0.3]) box(0.12, 0.04, zLen, M.paintYell, sx + o, 0.12, (z0 + z1) / 2, root)
    }
    for (const sz of zs) {
      for (let i = 0; i < Math.floor(xLen / 8); i++) box(3.4, 0.04, 0.18, M.roadPaint, x0 + 4 + i * 8, 0.124, sz, root)
      for (const o of [-RW / 2 + 0.3, RW / 2 - 0.3]) box(xLen, 0.04, 0.12, M.paintYell, (x0 + x1) / 2, 0.124, sz + o, root)
    }
    // 路口斑马线
    for (const sx of xs) {
      for (const sz of zs) {
        if (sx < x0 + 4 || sx > x1 - 4 || sz < z0 + 4 || sz > z1 - 4) continue
        for (let i = 0; i < 6; i++) {
          box(0.7, 0.04, RW - 1.2, M.roadPaint, sx - 5.2 - i * 1.1, 0.13, sz, root)
          box(0.7, 0.04, RW - 1.2, M.roadPaint, sx + 5.2 + i * 1.1, 0.13, sz, root)
          box(RW - 1.2, 0.04, 0.7, M.roadPaint, sx, 0.13, sz - 5.2 - i * 1.1, root)
          box(RW - 1.2, 0.04, 0.7, M.roadPaint, sx, 0.13, sz + 5.2 + i * 1.1, root)
        }
      }
    }
    // 是否压到地块
    const occupied = (px, pz, pad = 2) => {
      const list = sites
      for (let i = 0; i < list.length; i++) {
        const s = list[i]
        if (s.circ) {
          if ((px - s.x) ** 2 + (pz - s.z) ** 2 < (20.5 + pad) ** 2) return true
        } else if (Math.abs(px - s.x) < s.w / 2 + pad && Math.abs(pz - s.z) < s.d / 2 + pad) return true
      }
      return false
    }
    // 车流（沿路两侧）
    const palette = [M.glazeWhite, M.charcoal, M.glSilver, M.paintRed, M.paintBlue, M.paintYell, M.paintGreen]
    let seed = 20261
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    let cars = 0
    for (const sx of xs) {
      for (let i = 0; i < 7; i++) {
        const pz = z0 + 10 + rnd() * (zLen - 20)
        if (occupied(sx - 2.1, pz)) continue
        const kind = rnd()
        const ry = rnd() > 0.5 ? 0 : Math.PI
        const col = palette[(rnd() * palette.length) | 0]
        if (kind < 0.1) busAt(root, sx - 2.1, pz, ry, col)
        else if (kind < 0.18) truckAt(root, sx - 2.1, pz, ry, col)
        else if (kind < 0.28) vanAt(root, sx - 2.1, pz, ry, col)
        else carLo(root, sx - 2.1, pz, ry, col)
        cars++
      }
      for (let i = 0; i < 6; i++) {
        const pz = z0 + 10 + rnd() * (zLen - 20)
        if (occupied(sx + 2.1, pz)) continue
        const kind = rnd()
        const ry = rnd() > 0.5 ? 0 : Math.PI
        const col = palette[(rnd() * palette.length) | 0]
        if (kind < 0.1) busAt(root, sx + 2.1, pz, ry, col)
        else if (kind < 0.18) truckAt(root, sx + 2.1, pz, ry, col)
        else carLo(root, sx + 2.1, pz, ry, col)
        cars++
      }
    }
    for (const sz of zs) {
      for (let i = 0; i < 6; i++) {
        const px = x0 + 10 + rnd() * (xLen - 20)
        if (occupied(px, sz - 2.1)) continue
        const ry = rnd() > 0.5 ? Math.PI / 2 : -Math.PI / 2
        const col = palette[(rnd() * palette.length) | 0]
        if (rnd() < 0.1) busAt(root, px, sz - 2.1, ry, col)
        else carLo(root, px, sz - 2.1, ry, col)
        cars++
      }
      for (let i = 0; i < 5; i++) {
        const px = x0 + 10 + rnd() * (xLen - 20)
        if (occupied(px, sz + 2.1)) continue
        const ry = rnd() > 0.5 ? Math.PI / 2 : -Math.PI / 2
        const col = palette[(rnd() * palette.length) | 0]
        if (rnd() < 0.1) truckAt(root, px, sz + 2.1, ry, col)
        else carLo(root, px, sz + 2.1, ry, col)
        cars++
      }
    }
    // 人行道：路缘 + 行道树 + 路灯 + 长椅 + 自行车
    for (const sx of xs) {
      for (let i = 0; i < Math.floor(zLen / 62); i++) {
        const pz = z0 + 16 + i * 62
        for (const o of [-6.2, 6.2]) {
          if (occupied(sx + o * 1.6, pz, 0.5)) continue
          treeAt(root, sx + o, pz, 0.68, 2.6)
        }
      }
      for (let i = 0; i < Math.floor(zLen / 88); i++) {
        const pz = z0 + 30 + i * 88
        if (!occupied(sx + 5.6, pz, 1)) lampPost(root, sx + 5.6, pz, 6.2, Math.PI / 2)
        if (!occupied(sx - 5.6, pz + 26, 1)) lampPost(root, sx - 5.6, pz + 26, 6.2, -Math.PI / 2)
      }
      for (let i = 0; i < 3; i++) {
        const pz = z0 + 40 + rnd() * (zLen - 80)
        if (occupied(sx + 5.2, pz, 0.5)) continue
        if (rnd() < 0.45) benchAt(root, sx + 5.0, pz, Math.PI / 2)
        else for (let k = 0; k < 4; k++) bikeAt(root, sx + 4.9, pz + k * 0.9, Math.PI / 2, palette[(rnd() * palette.length) | 0])
      }
    }
    // 交通信号灯（路口四角）
    for (const sx of xs) {
      for (const sz of zs) {
        if (sx < x0 + 4 || sx > x1 - 4 || sz < z0 + 4 || sz > z1 - 4) continue
        for (const [ox, oz, ry] of [[-6, -6, 0], [6, 6, Math.PI], [-6, 6, Math.PI / 2], [6, -6, -Math.PI / 2]]) {
          if (occupied(sx + ox, sz + oz, 0.5)) continue
          cyl(0.14, 0.18, 5.4, M.darkFrame, sx + ox, 2.7, sz + oz, 8, root)
          box(0.4, 1.4, 0.4, M.charcoal, sx + ox, 5.6, sz + oz, root)
          const dir = ry
          for (let k = 0; k < 3; k++) {
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), [M.paintRed, M.paintYell, M.paintGreen][k])
            lamp.position.set(sx + ox + Math.sin(dir) * 0.24, 6.1 - k * 0.42, sz + oz + Math.cos(dir) * 0.24)
            root.add(lamp)
          }
        }
      }
    }
    console.info(`[streets] ${cars} vehicles / ${xs.length}×${zs.length} grid`)
    return root
  }

  return {
    t137, t138, t139, t140, t141, t142, t143, t144, t145, t146, t147,
    addStreets, addRiver, cruiseShip, containerShip, ferryShip, sailBoat,
    busAt, truckAt, vanAt, motoAt, bikeAt, carLo, strut,
  }
}
