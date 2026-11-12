import * as THREE from 'three'
import {
  GROUND, CN, add, plane, cyl, std, glowMat, trackGlow, trackEnv, paint, scatter,
  solid, mulberry32, WIN, cutFront,
} from './kit.js'
import { wallFace, clad, roofKit } from './buildings.js'

/**
 * 三个"族"的建筑，用来检验扩展方式：
 * 加一栋新楼 = 选族 + 调参数，而不是再手搓一遍细节。
 *
 * 每个族都只固定 L0（体量原型）和 L1（立面语法），
 * L2（构件）和 L3（扰动）留给参数和随机。
 */

const cell = new THREE.BoxGeometry(1, 1, 1)
const winBlue = WIN.glass
const winWarm = WIN.warm
const winShade = WIN.shade
const bandG = trackEnv(std('#9aa6b0', { metalness: 0.4, roughness: 0.42 }), 0.8, 0.24)
const mullMat = trackEnv(std('#dce4ea', { metalness: 0.7, roughness: 0.26 }), 1.0, 0.3)
const glowLow = (color, day, night) => glowMat(color, day, night, { emissive: color, roughness: 0.4 })

function textSign(text, sub, bg, fg, w = 512, h = 160) {
  return paint(w, h, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = fg
    ctx.font = `800 ${Math.round(h * (sub ? 0.4 : 0.5))}px ${CN}`
    ctx.fillText(text, w / 2, sub ? h * 0.36 : h / 2)
    if (sub) {
      ctx.font = `600 ${Math.round(h * 0.2)}px ${CN}`
      ctx.fillText(sub, w / 2, h * 0.74)
    }
  })
}

function signPlane(parent, tex, w, h, x, y, z, ry = 0, night = 0.8) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: '#ffffff', roughness: 0.46, side: THREE.DoubleSide,
  })
  trackGlow(mat, night * 0.35, night)
  return plane(parent, w, h, mat, x, y, z, ry)
}

/* ══════════════════════════════════════════════════════════════
 * 族 A · 地标塔：逐段收分 + 出檐（台北 101 / 金茂式）
 * 不变量：≥4 段收分 / 每段收分处有外挑檐 / 塔冠收成尖顶
 * 差异轴：段数、每段层数、收分比、平面、石材色、檐口灯
 * ══════════════════════════════════════════════════════════════ */
export function podiumTower(o = {}) {
  const {
    x = 7, z = -86, rotY = 0,
    W = 26, D = 26, podH = 7.5,
    segments = 8, floorsPerSeg = 4, FH = 3.6, shrink = 0.9,
    frameCol = '#ded6c6', lit = 0.66, seed = 900,
    name = '凌霄', sub = 'LINGXIAO · 101',
  } = o

  const g = new THREE.Group()
  g.position.set(x, GROUND, z)
  if (rotY) g.rotation.y = rotY

  const stone = std(frameCol, { roughness: 0.72 })
  const stoneD = std('#b8b0a1', { roughness: 0.78 })
  const core = std('#6b7480', { roughness: 0.62 })
  const edgeGlow = glowLow('#ffe2ac', 0.06, 0.85)
  const b = (w, h, d, mat, px, py, pz, sh = true) => add(g, w, h, d, mat, px, py + h / 2, pz, 0, sh)

  // ── 场地 ──
  add(g, W + 8, 0.7, D + 8, std('#c8c4ba', { roughness: 0.92 }), 0, -0.32, 0, 0, false)
  add(g, W + 4, 0.2, D + 4, std('#d8d3c9', { roughness: 0.86 }), 0, 0.11, 0, 0, false)

  // ── 裙楼：石材 + 入口洞 + 大堂 ──
  const pw = W + 2.4
  const pd = D + 2.4
  const openW = pw * 0.46
  cutFront(g, pw, pd, podH, stone, 4.2, openW)
  b(pw + 0.16, 0.95, pd + 0.16, stoneD, 0, 0, 0, false)

  const lobbyMat = new THREE.MeshStandardMaterial({
    color: '#26343c', roughness: 0.1, metalness: 0.45, emissive: '#cfe6f0', emissiveIntensity: 0.05,
  })
  trackGlow(lobbyMat, 0.04, 0.3)
  plane(g, openW - 0.4, podH - 1.15, lobbyMat, 0, 1.0 + (podH - 1.15) / 2, pd / 2 + 0.05)
  add(g, openW, 0.06, 4.2, std('#cfd6d9', { roughness: 0.5 }), 0, 0.19, pd / 2 - 2.1, 0, false)
  for (let i = 0; i < 3; i++) b(openW * 0.62, 0.05, 0.14, edgeGlow, 0, podH - 1.3, pd / 2 - 1.1 - i * 1.2, false)
  b(openW * 0.46, 0.9, 0.55, std('#3a444c', { roughness: 0.5 }), 0, 0.2, pd / 2 - 3.5, false)
  for (const sx of [-1, 1]) b(0.14, podH - 1.1, 0.14, mullMat, sx * (openW / 2 - 0.35), 0.2, pd / 2 + 0.16, false)
  // 雨棚
  b(openW + 1.8, 0.16, 2.2, stoneD, 0, podH - 0.55, pd / 2 + 1.15)
  for (const sx of [-1, 1]) b(0.12, 3.0, 0.12, mullMat, sx * (openW / 2 + 0.2), 0.2, pd / 2 + 2.15, false)
  // 裙楼分缝（正面留给入口）
  clad(g, pd, podH, pw / 2 + 0.02, 0, 0, Math.PI / 2, 5, 3)
  clad(g, pd, podH, -pw / 2 - 0.02, 0, 0, Math.PI / 2, 5, 3)
  clad(g, pw, podH, 0, 0, -pd / 2 - 0.02, 0, 6, 3)

  // ── 塔身：逐段收分，每段顶部出檐 ──
  let w = W
  let d = D
  let y = podH
  for (let s = 0; s < segments; s++) {
    const segH = floorsPerSeg * FH
    // 核心筒必须比幕墙小一圈，否则玻璃会埋在结构体里（夜里整栋不亮）
    b(w - 0.7, segH, d - 0.7, core, 0, y, 0)
    const skin = {
      glass: winBlue, warm: winWarm, shade: winShade, metal: mullMat, band: bandG,
      lit, fin: 0.3, h: segH, y0: y, floors: floorsPerSeg, punch: 0.88, inset: 0.08,
    }
    const baysX = Math.max(3, Math.round(w / 2.3))
    const baysZ = Math.max(3, Math.round(d / 2.3))
    wallFace(g, { ...skin, along: 'x', at: d / 2 - 0.05, w: w - 2.2, bays: baysX, sign: 1, seed: seed + s * 7 })
    wallFace(g, { ...skin, along: 'x', at: -(d / 2 - 0.05), w: w - 2.2, bays: baysX, sign: -1, seed: seed + s * 11 })
    wallFace(g, { ...skin, along: 'z', at: w / 2 - 0.05, w: d - 2.2, bays: baysZ, sign: 1, seed: seed + s * 13 })
    wallFace(g, { ...skin, along: 'z', at: -(w / 2 - 0.05), w: d - 2.2, bays: baysZ, sign: -1, seed: seed + s * 17 })

    // 转角壁柱：收分处才会显出"斗"的棱角
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) b(0.75, segH + 0.2, 0.75, stone, sx * (w / 2 - 0.28), y, sz * (d / 2 - 0.28))
    }

    // 收分处的外挑檐：两级 + 檐下灯带（101 的夜间识别点）
    const eW = w + 1.7
    const eD = d + 1.7
    b(eW, 0.34, eD, stone, 0, y + segH, 0)
    b(eW - 0.55, 0.2, eD - 0.55, stoneD, 0, y + segH + 0.34, 0, false)
    b(eW - 0.35, 0.1, eD - 0.35, edgeGlow, 0, y + segH - 0.16, 0, false)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) b(0.24, 0.24, 0.24, edgeGlow, sx * (eW / 2 - 0.55), y + segH + 0.58, sz * (eD / 2 - 0.55), false)
    }

    y += segH
    w *= shrink
    d *= shrink
  }

  // ── 塔冠：再收两级 + 尖顶 + 航空灯 ──
  const cw = w / shrink
  b(cw * 0.74, 3.2, cw * 0.74, stoneD, 0, y, 0)
  b(cw * 0.52, 0.34, cw * 0.52, stone, 0, y + 3.2, 0, false)
  b(cw * 0.34, 4.4, cw * 0.34, stoneD, 0, y + 3.54, 0)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b(0.2, 3.2, 0.2, mullMat, sx * cw * 0.34, y + 0.2, sz * cw * 0.34, false)
  }
  cyl(g, cw * 0.075, 6.2, stone, 0, y + 10.6, 0)
  cyl(g, cw * 0.038, 9.5, mullMat, 0, y + 18.4, 0)
  b(0.3, 0.3, 0.3, glowLow('#ff4152', 0.15, 1.5), 0, y + 23.2, 0, false)
  roofKit(g, cw * 0.74, cw * 0.74, y + 3.2, { rail: true, caps: '#cfc8ba' })

  // ── 竖招 + 门牌 ──
  signPlane(g, textSign(name, sub, '#1d2a33', '#ffe6b0', 420, 560), 2.4, 3.2,
    -(pw / 2 + 0.12), podH - 3.4, pd / 2 - 1.8, Math.PI / 2)
  b(0.28, 0.28, 0.28, edgeGlow, -(pw / 2 + 0.28), podH - 1.7, pd / 2 - 1.8, false)

  solid(x, z, W + 8, D + 8, GROUND + 0.7)
  solid(x, z, W, D, GROUND + y)
  return g
}

/* ══════════════════════════════════════════════════════════════
 * 族 B · 老写字楼：石材 / 砖 + 窗洞内凹 + 竖向壁柱
 * 不变量：壁柱贯通全高 / 窗洞内凹 ≥0.2 / 明确檐口 / 不许整片玻璃
 * 差异轴：开间数、窗墙比、石材色、檐口深度、屋顶构件
 * ══════════════════════════════════════════════════════════════ */
export function stoneOfficeBlock(o = {}) {
  const {
    x = -33, z = 4.5, rotY = 0,
    W = 12.5, D = 11, floors = 9, FH = 3.55,
    bays = 5, winRatio = 0.52,
    stoneCol = '#ded6c5', trimCol = '#b6ae9d',
    lit = 0.68, seed = 700,
    name = '永利', sub = 'YONGLE HOUSE',
  } = o
  const H = floors * FH
  const gH = 4.2

  const g = new THREE.Group()
  g.position.set(x, GROUND, z)
  if (rotY) g.rotation.y = rotY

  const stone = std(stoneCol, { roughness: 0.8 })
  const trim = std(trimCol, { roughness: 0.82 })
  const b = (w, h, d, mat, px, py, pz, sh = true) => add(g, w, h, d, mat, px, py + h / 2, pz, 0, sh)

  add(g, W + 5, 0.5, D + 5, std('#cbc6bb', { roughness: 0.92 }), 0, -0.22, 0, 0, false)

  // 主体：底层挖门厅，上面整块石材
  const openW = W * 0.42
  cutFront(g, W, D, gH, stone, 3.6, openW)
  b(W, H - gH, D, stone, 0, gH, 0)

  const lobbyMat = new THREE.MeshStandardMaterial({
    color: '#31404a', roughness: 0.1, metalness: 0.35, emissive: '#ffe0ae', emissiveIntensity: 0.04,
  })
  trackGlow(lobbyMat, 0.04, 0.28)
  plane(g, openW - 0.3, gH - 1.05, lobbyMat, 0, 0.95 + (gH - 1.05) / 2, D / 2 + 0.04)
  add(g, openW, 0.05, 3.6, std('#cdc6b8', { roughness: 0.6 }), 0, 0.2, D / 2 - 1.8, 0, false)
  b(openW * 0.5, 0.86, 0.5, std('#4a3c30', { roughness: 0.6 }), 0, 0.2, D / 2 - 3.0, false)
  for (let i = 0; i < 2; i++) b(openW * 0.7, 0.05, 0.12, glowLow('#ffe4bb', 0.08, 0.9), 0, gH - 0.9, D / 2 - 1.0 - i * 1.3, false)
  // 门口雨棚 + 台阶 + 立柱
  b(openW + 2.0, 0.16, 1.9, trim, 0, gH - 0.36, D / 2 + 0.92)
  b(openW + 1.1, 0.12, 0.72, std('#cdc6b8', { roughness: 0.88 }), 0, 0.06, D / 2 + 0.44, false)
  for (const sx of [-1, 1]) b(0.34, gH - 0.4, 0.34, trim, sx * (openW / 2 + 0.35), 0, D / 2 + 0.18)

  // 竖向壁柱：正背面贯通，从门厅顶到檐底（族的身份特征）
  const pillarH = H - gH - 0.3
  const stepX = W / bays
  for (const sz of [1, -1]) {
    for (let i = 0; i <= bays; i++) {
      const px = -W / 2 + i * stepX
      b(0.52, pillarH, 0.34, stone, px, gH, sz * (D / 2 + 0.1))
      b(0.62, 0.16, 0.42, trim, px, H - 0.55, sz * (D / 2 + 0.13), false)
    }
  }
  const sideBays = Math.max(2, Math.round(D / 3.2))
  for (const sx of [1, -1]) {
    for (let i = 0; i <= sideBays; i++) {
      const pz = -D / 2 + (i * D) / sideBays
      b(0.34, pillarH, 0.52, stone, sx * (W / 2 + 0.1), gH, pz)
    }
  }

  // 窗：玻璃退进 0.2，窗框与窗台外凸，才有"洞"的深度
  const litWin = []
  const darkWin = []
  const frames = []
  const sills = []
  const rnd = mulberry32(seed)
  const winH = FH * 0.54
  const winW = stepX * winRatio
  for (let f = 1; f < floors; f++) {
    const yc = f * FH + FH * 0.53
    for (let i = 0; i < bays; i++) {
      const px = -W / 2 + stepX * (i + 0.5)
      const on = rnd() > 0.3
      for (const sz of [1, -1]) {
        ;(on ? litWin : darkWin).push([px, yc, sz * (D / 2 + 0.015), 0, winW, winH, 0.06])
        frames.push([px - winW / 2 - 0.07, yc, sz * (D / 2 + 0.09), 0, 0.13, winH + 0.34, 0.2])
        frames.push([px + winW / 2 + 0.07, yc, sz * (D / 2 + 0.09), 0, 0.13, winH + 0.34, 0.2])
        frames.push([px, yc + winH / 2 + 0.11, sz * (D / 2 + 0.09), 0, winW + 0.3, 0.13, 0.2])
        sills.push([px, yc - winH / 2 - 0.08, sz * (D / 2 + 0.14), 0, winW + 0.52, 0.12, 0.34])
        // 窗内一道竖中梃，避免整片玻璃
        frames.push([px, yc, sz * (D / 2 + 0.045), 0, 0.06, winH, 0.1])
      }
    }
    // 每层腰线
    for (const sz of [1, -1]) b(W - 0.3, 0.07, 0.1, trim, 0, f * FH + 0.05, sz * (D / 2 + 0.05), false)
  }
  // 侧面窗（少一个量级，但同样内凹）
  for (let f = 1; f < floors; f++) {
    const yc = f * FH + FH * 0.53
    for (let i = 0; i < sideBays; i++) {
      const pz = -D / 2 + (D / sideBays) * (i + 0.5)
      const on = rnd() > 0.38
      for (const sx of [1, -1]) {
        ;(on ? litWin : darkWin).push([sx * (W / 2 + 0.015), yc, pz, Math.PI / 2, winW * 0.9, winH, 0.06])
        sills.push([sx * (W / 2 + 0.14), yc - winH / 2 - 0.08, pz, Math.PI / 2, winW * 0.9 + 0.4, 0.12, 0.34])
      }
    }
  }
  scatter(g, cell, winWarm, litWin)
  scatter(g, cell, winBlue, darkWin)
  scatter(g, cell, trim, frames)
  scatter(g, cell, stone, sills)

  // 檐口：外挑 + 压顶 + 檐下阴影线
  b(W + 1.2, 0.44, D + 1.2, trim, 0, H, 0)
  b(W + 0.7, 0.22, D + 0.7, stone, 0, H + 0.44, 0, false)
  b(W + 0.4, 0.14, D + 0.4, trim, 0, H - 0.16, 0, false)
  // 屋顶：楼梯间 + 水箱 + 天线
  const topY = H + 0.66
  b(W * 0.42, 2.3, D * 0.42, trim, 0, topY, -0.5)
  b(W * 0.26, 2.9, D * 0.26, stone, -W * 0.26, topY, D * 0.18)
  cyl(g, 1.25, 2.0, std('#a8a094', { roughness: 0.8 }), W * 0.24, topY + 1.05, -D * 0.18)
  cyl(g, 1.32, 0.16, std('#8f887c', { roughness: 0.8 }), W * 0.24, topY + 2.1, -D * 0.18)
  b(0.16, 6.2, 0.16, mullMat, W * 0.32, topY + 3.1, D * 0.26)
  b(0.24, 0.24, 0.24, glowLow('#ff4152', 0.15, 1.2), W * 0.32, topY + 6.2, D * 0.26, false)
  roofKit(g, W, D, topY, { rail: true, caps: '#c9c2b2' })

  // 竖招 + 雨棚下的小灯
  signPlane(g, textSign(name, sub, '#2c2620', '#e8d9b0', 420, 520), 2.2, 2.9,
    -(W / 2 + 0.3), H - 4.6, D / 2 - 2.4, Math.PI / 2)
  b(0.26, 0.26, 0.26, glowLow('#ffe4bb', 0.1, 0.9), -(W / 2 + 0.42), H - 2.9, D / 2 - 2.4, false)

  solid(x, z, W, D, GROUND + H)
  return g
}

/* ══════════════════════════════════════════════════════════════
 * 族 C · 围合式住宅街坊：数栋板楼围出可进入的内院
 * 不变量：体量围合出院子 / 每栋都是连续阳台板楼 / 沿街一段有门脸
 * 差异轴：院宽深、层数、院门宽度、阳台进深、墙面色
 * ══════════════════════════════════════════════════════════════ */

/** 一栋板楼翼：连续阳台 + 竖杆栏杆 + 空调机位 + 晾衣杆，背面与山墙另开窗 */
function slabWing(parent, o) {
  const {
    w, d, floors, FH, x, z, ry = 0,
    wall, white, railM, lit = 0.62, seed = 1, balcony = 1.05,
  } = o
  const H = floors * FH
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  if (ry) g.rotation.y = ry
  parent.add(g)
  const b = (ww, hh, dd, mat, px, py, pz, sh = true) => add(g, ww, hh, dd, mat, px, py + hh / 2, pz, 0, sh)

  b(w, H, d, wall, 0, 0, 0)
  b(w + 0.18, 0.55, d + 0.18, white, 0, 0, 0, false)
  b(w + 0.12, 0.72, d + 0.12, white, 0, H, 0)
  b(w + 0.34, 0.12, d + 0.34, white, 0, H + 0.72, 0, false)

  const zf = d / 2
  const cols = Math.max(3, Math.round(w / 2.7))
  const cw = w / cols
  const bars = []
  const acs = []
  const litWin = []
  const darkWin = []
  const rnd = mulberry32(seed)
  const acMat = std('#d6dbe0', { roughness: 0.45, metalness: 0.2 })
  const lineMat = std('#b9bec2', { metalness: 0.3, roughness: 0.5 })

  for (let f = 1; f < floors; f++) {
    const y = f * FH
    // 连续阳台：外挑板 + 下翻边 + 扶手 + 竖杆 + 两端翻边
    b(w - 0.7, 0.16, balcony, white, 0, y, zf + balcony / 2)
    b(w - 0.7, 0.06, balcony, std('#cfc6b6', { roughness: 0.8 }), 0, y - 0.06, zf + balcony / 2, false)
    b(w - 0.7, 0.07, 0.07, railM, 0, y + 0.98, zf + balcony - 0.07, false)
    for (const sx of [-1, 1]) b(0.09, 1.02, balcony, railM, sx * ((w - 0.7) / 2), y, zf + balcony / 2)
    const count = Math.max(12, Math.round((w - 1.0) / 0.17))
    for (let i = 0; i <= count; i++) {
      bars.push([-(w - 1.0) / 2 + (i * (w - 1.0)) / count, y + 0.5, zf + balcony - 0.07, 0, 0.035, 0.9, 0.035])
    }
    for (let i = 0; i < cols; i++) {
      const px = -w / 2 + cw * (i + 0.5)
      const on = rnd() > 0.28
      ;(on ? litWin : darkWin).push([px, y + FH * 0.54, zf + 0.07, 0, cw * 0.64, FH * 0.5, 0.06])
      if (rnd() > 0.58) acs.push([px + cw * 0.34, y + 0.34, zf + 0.3, 0, 0.62, 0.46, 0.36])
      if (rnd() > 0.66) b(cw * 0.46, 0.04, 0.04, lineMat, px, y + 1.42, zf + balcony - 0.16, false)
    }
  }
  // 底层（内院里能看到的那排窗）
  for (let i = 0; i < cols; i++) {
    const px = -w / 2 + cw * (i + 0.5)
    darkWin.push([px, 1.55, zf + 0.07, 0, cw * 0.58, 1.95, 0.06])
  }
  // 背立面
  for (let f = 1; f < floors; f++) {
    for (let i = 0; i < cols; i++) {
      const px = -w / 2 + cw * (i + 0.5)
      const on = rnd() > 0.38
      ;(on ? litWin : darkWin).push([px, f * FH + FH * 0.54, -zf - 0.07, Math.PI, cw * 0.54, FH * 0.48, 0.06])
    }
  }
  // 山墙：每层一扇小窗，两端朝向各自外面
  for (let f = 1; f < floors; f++) {
    const yc = f * FH + FH * 0.54
    litWin.push([w / 2 + 0.05, yc, 0, Math.PI / 2, d * 0.3, FH * 0.42, 0.06])
    darkWin.push([-w / 2 - 0.05, yc, 0, -Math.PI / 2, d * 0.3, FH * 0.42, 0.06])
  }
  scatter(g, cell, railM, bars)
  scatter(g, cell, acMat, acs, true)
  scatter(g, cell, winWarm, litWin)
  scatter(g, cell, winShade, darkWin)
  return g
}

export function courtyardBlock(o = {}) {
  const {
    x = -45.5, z = -46, rotY = 0,
    w = 22, d = 19, wingD = 5.2,
    floors = 6, FH = 3.0, gate = 5.6,
    wallCol = '#e8dfcb', whiteCol = '#f4efe4',
    lit = 0.62, seed = 500,
    name = '梧桐里',
  } = o
  const H = floors * FH

  const g = new THREE.Group()
  g.position.set(x, GROUND, z)
  if (rotY) g.rotation.y = rotY

  const wall = std(wallCol, { roughness: 0.84 })
  const white = std(whiteCol, { roughness: 0.72 })
  const railM = std('#ccd6de', { metalness: 0.45, roughness: 0.34 })
  const b = (ww, hh, dd, mat, px, py, pz, sh = true) => add(g, ww, hh, dd, mat, px, py + hh / 2, pz, 0, sh)

  add(g, w + 5.5, 0.5, d + 5.5, std('#cbc6bb', { roughness: 0.92 }), 0, -0.22, 0, 0, false)

  const zdn = -d / 2 + wingD / 2
  const zdp = d / 2 - wingD / 2
  const xdn = -w / 2 + wingD / 2
  const xdp = w / 2 - wingD / 2
  const sideLen = d - 2 * wingD
  const fw = (w - gate) / 2

  // 四翼：后 / 左 / 右 / 前（前翼留出院门）
  slabWing(g, { w, d: wingD, floors, FH, x: 0, z: zdn, ry: 0, wall, white, railM, lit, seed: seed + 1 })
  slabWing(g, { w: sideLen, d: wingD, floors, FH, x: xdn, z: 0, ry: Math.PI / 2, wall, white, railM, lit, seed: seed + 2 })
  slabWing(g, { w: sideLen, d: wingD, floors, FH, x: xdp, z: 0, ry: -Math.PI / 2, wall, white, railM, lit, seed: seed + 3 })
  for (const s of [-1, 1]) {
    slabWing(g, { w: fw, d: wingD, floors, FH, x: s * (gate / 2 + fw / 2), z: zdp, ry: Math.PI, wall, white, railM, lit, seed: seed + 4 + s })
  }

  // ── 内院：铺装 + 十字步道 + 树 + 自行车棚 + 石桌 ──
  const inW = w - 2 * wingD
  const inD = d - 2 * wingD
  add(g, inW - 0.3, 0.08, inD - 0.3, std('#cfc7b6', { roughness: 0.9 }), 0, 0.2, 0, 0, false)
  add(g, 1.7, 0.06, inD - 0.5, std('#dcd5c4', { roughness: 0.88 }), 0, 0.24, 0, 0, false)
  add(g, inW - 0.5, 0.06, 1.7, std('#dcd5c4', { roughness: 0.88 }), 0, 0.24, 0, 0, false)

  const bark = std('#6b5344', { roughness: 0.9 })
  const leafA = std('#6d9850', { roughness: 1, flatShading: true })
  const leafB = std('#587e42', { roughness: 1, flatShading: true })
  const leafGeo = new THREE.IcosahedronGeometry(1, 1)
  for (const [tx, tz, s] of [[-3.4, 2.5, 1], [3.2, -2.7, 0.86]]) {
    cyl(g, 0.16 * s, 2.2 * s, bark, tx, 1.1 * s, tz)
    const c1 = new THREE.Mesh(leafGeo, leafA)
    c1.position.set(tx, 2.9 * s, tz)
    c1.scale.setScalar(1.15 * s)
    c1.castShadow = true
    g.add(c1)
    const c2 = new THREE.Mesh(leafGeo, leafB)
    c2.position.set(tx - 0.5 * s, 2.4 * s, tz + 0.3 * s)
    c2.scale.setScalar(0.75 * s)
    g.add(c2)
  }
  // 自行车棚
  add(g, 3.4, 0.08, 1.5, std('#8fa1a8', { metalness: 0.3, roughness: 0.6 }), -3.6, 2.3, -3.0, 0, false)
  for (const sx of [-1, 1]) cyl(g, 0.06, 2.3, std('#7c8a90', { metalness: 0.4, roughness: 0.5 }), -3.6 + sx * 1.6, 1.15, -3.5)
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12)
  for (let i = 0; i < 4; i++) {
    const bx = -4.75 + i * 0.76
    for (const dz of [-0.4, 0.4]) {
      const wheel = new THREE.Mesh(wheelGeo, std('#2f353a', { roughness: 0.6 }))
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(bx, 0.45, -3.0 + dz)
      g.add(wheel)
    }
    add(g, 0.05, 0.05, 0.8, std('#9aa4aa', { metalness: 0.4, roughness: 0.4 }), bx, 0.74, -3.0, 0, false)
  }
  // 石桌与凳
  cyl(g, 0.55, 0.07, std('#ded5c2', { roughness: 0.7 }), 3.0, 0.8, 1.7)
  cyl(g, 0.08, 0.72, std('#8a8f92', { metalness: 0.4, roughness: 0.4 }), 3.0, 0.4, 1.7)
  for (const dx of [-0.95, 0.95]) cyl(g, 0.22, 0.42, std('#c9c1b0', { roughness: 0.8 }), 3.0 + dx, 0.3, 1.7)

  // ── 单元门 + 信报箱（后翼内侧）──
  const doorZ = zdn + wingD / 2 + 0.06
  for (const dx of [-3.4, 0.4, 3.6]) {
    b(1.24, 2.35, 0.14, std('#5f6a72', { roughness: 0.6 }), dx, 0.06, doorZ)
    b(1.02, 2.05, 0.06, glowLow('#ffe0ae', 0.12, 0.9), dx, 0.16, doorZ + 0.09, false)
    b(0.5, 0.26, 0.1, std('#c8ced2', { metalness: 0.4, roughness: 0.4 }), dx + 0.74, 1.5, doorZ + 0.06, false)
    b(0.9, 0.8, 0.16, std('#9aa4aa', { metalness: 0.3, roughness: 0.5 }), dx + 1.55, 1.0, doorZ + 0.06, false)
    b(1.7, 0.1, 0.5, white, dx + 0.4, 2.5, doorZ + 0.2, false)
  }

  // ── 院门：门柱 + 门楣 + 门牌 + 灯 ──
  const gz = zdp + wingD / 2
  for (const sx of [-1, 1]) {
    b(0.72, 2.7, 0.72, white, sx * (gate / 2 - 0.36), 0, gz + 0.1)
    b(0.94, 0.2, 0.94, white, sx * (gate / 2 - 0.36), 2.7, gz + 0.1, false)
  }
  b(gate + 0.4, 0.36, 0.8, white, 0, 2.9, gz + 0.1)
  b(gate - 0.9, 0.12, 0.14, glowLow('#ffe4bb', 0.1, 0.9), 0, 2.66, gz + 0.52, false)
  signPlane(g, textSign(name, 'COURTYARD', '#3b4a3f', '#efe6cf', 480, 180), 2.5, 0.94, 0, 3.44, gz + 0.55)
  // 铁门扇（半开，两片）
  for (const sx of [-1, 1]) {
    b(gate * 0.3, 1.8, 0.06, std('#4a5459', { metalness: 0.4, roughness: 0.5 }), sx * (gate * 0.3), 0.2, gz + 0.34, false)
    for (let i = 0; i < 5; i++) b(0.05, 1.7, 0.09, std('#5b666c', { metalness: 0.4, roughness: 0.5 }), sx * (gate * 0.15 + (i * gate * 0.3) / 4), 0.25, gz + 0.36, false)
  }
  // 门口盆栽
  for (const sx of [-1, 1]) {
    b(0.5, 0.44, 0.5, std('#8b8276', { roughness: 0.85 }), sx * (gate / 2 + 0.9), 0.22, gz + 0.6, false)
    cyl(g, 0.34, 0.5, std('#54764a', { roughness: 1, flatShading: true }), sx * (gate / 2 + 0.9), 0.7, gz + 0.6)
  }

  // ── 沿街门脸（前翼外侧）──
  const shopZ = zdp + wingD / 2 + 0.03
  const shopGlass = new THREE.MeshStandardMaterial({
    color: '#ffe9c6', transparent: true, opacity: 0.32, roughness: 0.1, depthWrite: false,
  })
  const shopCols = ['#37614f', '#8d5b3c']
  for (let s = 0; s < 2; s++) {
    const sx = s ? 1 : -1
    const cx = sx * (gate / 2 + fw / 2)
    plane(g, fw - 1.7, 2.2, shopGlass, cx, 1.5, shopZ)
    for (const dx of [-1, 1]) b(0.12, 2.42, 0.16, std('#39443f', { roughness: 0.6 }), cx + dx * ((fw - 1.7) / 2 + 0.06), 0, shopZ + 0.08, false)
    b(fw - 1.2, 0.2, 0.3, std('#39443f', { roughness: 0.6 }), cx, 2.42, shopZ + 0.1)
    const awn = new THREE.Mesh(new THREE.BoxGeometry(fw - 1.4, 0.07, 1.0), std(shopCols[s], { roughness: 0.85 }))
    awn.position.set(cx, 2.64, shopZ + 0.55)
    awn.rotation.x = -0.14
    g.add(awn)
    signPlane(g, textSign(s ? '梧桐理发' : '里弄杂货', s ? 'BARBER' : 'GROCERY', shopCols[s], '#f4ecd8', 420, 150),
      fw - 1.9, 0.62, cx, 2.98, shopZ + 0.16)
    b(fw - 2.2, 0.05, 0.1, glowLow('#ffe4bb', 0.1, 0.9), cx, 2.3, shopZ + 0.3, false)
    // 台阶
    b(fw - 1.4, 0.1, 0.6, std('#cfc7b8', { roughness: 0.88 }), cx, 0.06, shopZ + 0.32, false)
  }

  // ── 碰撞：四翼各自一格，院子留空可以走进去 ──
  if (!rotY) {
    solid(x, z + zdn, w, wingD, GROUND + H)
    solid(x + xdn, z, wingD, sideLen, GROUND + H)
    solid(x + xdp, z, wingD, sideLen, GROUND + H)
    for (const s of [-1, 1]) solid(x + s * (gate / 2 + fw / 2), z + zdp, fw, wingD, GROUND + H)
  } else {
    solid(x, z, w + 2, d + 2, GROUND + H)
  }
  return g
}

/* ══════════════════════════════════════════════════════════════
 * 族 D · 点式住宅：方形平面 + 四角切角 + 居中核心筒
 * 不变量：长宽比 <1.4 / 四角切角 / 四面小开间窗 / 每两户一组小阳台
 * 差异轴：层数、切角大小、开间数、墙色、阳台层间隔
 * ══════════════════════════════════════════════════════════════ */
export function pointBlock(o = {}) {
  const {
    x = 45, z = -34, rotY = 0,
    W = 12, D = 12, corners = 1.7,
    floors = 14, FH = 3.0,
    wallCol = '#e2dbcb', trimCol = '#c6beab',
    lit = 0.6, seed = 300,
    name = '云栖公寓',
  } = o
  const H = floors * FH
  const hw = W / 2
  const hd = D / 2

  const g = new THREE.Group()
  g.position.set(x, GROUND, z)
  if (rotY) g.rotation.y = rotY

  const wall = std(wallCol, { roughness: 0.84 })
  const trim = std(trimCol, { roughness: 0.8 })
  const core = std('#6f7883', { roughness: 0.62 })
  const railM = std('#c9d2d9', { metalness: 0.4, roughness: 0.34 })
  const b = (w, h, d, mat, px, py, pz, sh = true) => add(g, w, h, d, mat, px, py + h / 2, pz, 0, sh)

  add(g, W + 6, 0.5, D + 6, std('#cbc6bb', { roughness: 0.92 }), 0, -0.22, 0, 0, false)

  // 八边形切角楼体：平直段刚好落在 ±W/2、±D/2，wallFace 可以直接贴
  const sh = new THREE.Shape()
  sh.moveTo(-hw + corners, -hd)
  sh.lineTo(hw - corners, -hd)
  sh.lineTo(hw, -hd + corners)
  sh.lineTo(hw, hd - corners)
  sh.lineTo(hw - corners, hd)
  sh.lineTo(-hw + corners, hd)
  sh.lineTo(-hw, hd - corners)
  sh.lineTo(-hw, -hd + corners)
  sh.closePath()
  const bodyGeo = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false })
  bodyGeo.rotateX(-Math.PI / 2)
  const body = new THREE.Mesh(bodyGeo, wall)
  body.castShadow = body.receiveShadow = true
  g.add(body)
  b(W - 2 * corners, H, D - 2 * corners, core, 0, 0, 0, false)

  // 腰线：只在四个平直段，不绕切角
  const flatX = W - 2 * corners
  const flatZ = D - 2 * corners
  b(flatX, 0.22, 0.14, trim, 0, 1.1, hd + 0.02, false)
  b(flatX, 0.22, 0.14, trim, 0, 1.1, -hd - 0.02, false)
  b(0.14, 0.22, flatZ, trim, hw + 0.02, 1.1, 0, false)
  b(0.14, 0.22, flatZ, trim, -hw - 0.02, 1.1, 0, false)

  // 四面窗：每个平直段 3 个开间
  const skin = {
    glass: winBlue, warm: winWarm, shade: winShade, metal: mullMat, band: bandG,
    lit, fin: 0.28, h: H, y0: 0, floors, punch: 0.6, inset: 0.08,
  }
  // 楼体是实心挤出体，窗只能贴在墙外：at 要比墙面多出一个 inset 再留 4cm，
  // 玻璃才落在实心体外面（否则整栋窗全被埋掉，夜里不亮）
  wallFace(g, { ...skin, along: 'x', at: hd + 0.12, w: flatX, bays: 3, sign: 1, seed: seed + 1 })
  wallFace(g, { ...skin, along: 'x', at: -hd - 0.12, w: flatX, bays: 3, sign: -1, seed: seed + 2 })
  wallFace(g, { ...skin, along: 'z', at: hw + 0.12, w: flatZ, bays: 3, sign: 1, seed: seed + 3 })
  wallFace(g, { ...skin, along: 'z', at: -hw - 0.12, w: flatZ, bays: 3, sign: -1, seed: seed + 4 })

  // 每两户一组的小阳台：四个平直段的中开间外挑
  const bars = []
  const acs = []
  const acMat = std('#d6dbe0', { roughness: 0.45, metalness: 0.2 })
  const rnd = mulberry32(seed)
  for (let f = 2; f < floors; f += 2) {
    const y = f * FH
    for (const sz of [1, -1]) {
      b(2.5, 0.15, 0.66, wall, 0, y, sz * (hd + 0.33))
      b(2.5, 0.06, 0.66, trim, 0, y - 0.05, sz * (hd + 0.33), false)
      b(2.5, 0.06, 0.07, railM, 0, y + 0.94, sz * (hd + 0.62), false)
      for (const sx of [-1, 1]) b(0.07, 0.96, 0.62, railM, sx * 1.22, y, sz * (hd + 0.33))
      for (let i = 0; i <= 12; i++) bars.push([-1.2 + i * 0.2, y + 0.49, sz * (hd + 0.62), 0, 0.035, 0.86, 0.035])
      if (rnd() > 0.5) acs.push([1.0, y + 0.32, sz * (hd + 0.3), 0, 0.6, 0.44, 0.34])
    }
    for (const sx of [1, -1]) {
      b(0.66, 0.15, 2.5, wall, sx * (hw + 0.33), y, 0)
      b(0.66, 0.06, 2.5, trim, sx * (hw + 0.33), y - 0.05, 0, false)
      b(0.07, 0.06, 2.5, railM, sx * (hw + 0.62), y + 0.94, 0, false)
      for (const sz of [-1, 1]) b(0.62, 0.96, 0.07, railM, sx * (hw + 0.33), y, sz * 1.22)
      for (let i = 0; i <= 12; i++) bars.push([sx * (hw + 0.62), y + 0.49, -1.2 + i * 0.2, 0, 0.035, 0.86, 0.035])
      if (rnd() > 0.5) acs.push([sx * (hw + 0.3), y + 0.32, 1.0, 0, 0.34, 0.44, 0.6])
    }
  }
  scatter(g, cell, railM, bars)
  scatter(g, cell, acMat, acs, true)

  // 底层门厅（在东面）
  const lobbyMat = new THREE.MeshStandardMaterial({
    color: '#2b3841', roughness: 0.12, metalness: 0.4, emissive: '#ffe0ae', emissiveIntensity: 0.04,
  })
  trackGlow(lobbyMat, 0.04, 0.28)
  plane(g, 3.0, 2.5, lobbyMat, 0, 1.35, hd + 0.04)
  b(3.8, 0.14, 1.4, trim, 0, 2.9, hd + 0.6)
  for (const sx of [-1, 1]) b(0.12, 2.9, 0.12, railM, sx * 1.9, 0.1, hd + 1.2, false)
  b(1.4, 0.85, 0.4, std('#4a3c30', { roughness: 0.6 }), 0.9, 0.1, hd - 0.9, false)

  // 女儿墙 + 屋顶设备
  b(W - 0.6, 0.85, D - 0.6, wall, 0, H, 0)
  b(W - 0.3, 0.14, D - 0.3, trim, 0, H + 0.85, 0, false)
  const topY = H + 0.99
  b(3.0, 2.4, 2.6, trim, 0, topY, -1.4)
  cyl(g, 1.25, 2.1, std('#a8a094', { roughness: 0.8 }), 2.2, topY + 1.05, 2.0)
  cyl(g, 1.32, 0.16, std('#8f887c', { roughness: 0.8 }), 2.2, topY + 2.1, 2.0)
  b(0.14, 3.0, 0.14, mullMat, -2.4, topY + 1.5, -2.4)
  b(0.22, 0.22, 0.22, glowLow('#ff4152', 0.15, 1.2), -2.4, topY + 3.0, -2.4, false)
  // 门牌
  signPlane(g, textSign(name, 'CLOUD COURT', '#39443f', '#f0e6d0', 460, 190), 2.6, 1.05, 0, 3.6, hd + 0.08)

  solid(x, z, W + 6, D + 6, GROUND + 0.5)
  solid(x, z, W, D, GROUND + H)
  return g
}

/* ══════════════════════════════════════════════════════════════
 * 族 E · 外廊筒子楼：单侧贯通外廊 + 等分开间 + 端部楼梯筒
 * 不变量：连续外廊贯通全长 / 门直接开向走廊 / 走廊外侧长栏杆 / 无阳台隔板
 * 差异轴：层数、开间数、外廊宽、楼梯筒位置、墙色
 * ══════════════════════════════════════════════════════════════ */
export function gallerySlab(o = {}) {
  const {
    x = -53, z = -2, rotY = 0,
    W = 10, D = 14,
    floors = 8, FH = 3.0,
    gallery = 1.5, bay = 3.2,
    wallCol = '#ddd5c4', whiteCol = '#f0ebe0',
    lit = 0.58, seed = 200,
    name = '红星宿舍',
  } = o
  const H = floors * FH

  const g = new THREE.Group()
  g.position.set(x, GROUND, z)
  if (rotY) g.rotation.y = rotY

  const wall = std(wallCol, { roughness: 0.85 })
  const white = std(whiteCol, { roughness: 0.76 })
  const railM = std('#c4ced6', { metalness: 0.5, roughness: 0.32 })
  const doorMat = std('#5a4a3c', { roughness: 0.7 })
  const b = (w, h, d, mat, px, py, pz, sh = true) => add(g, w, h, d, mat, px, py + h / 2, pz, 0, sh)

  add(g, W + gallery + 6, 0.5, D + 8, std('#cbc6bb', { roughness: 0.92 }), gallery / 2, -0.22, -1, 0, false)

  const bays = Math.max(3, Math.floor(D / bay))
  const bw = D / bays
  const xf = W / 2

  b(W, H, D, wall, 0, 0, 0)
  b(W + 0.2, 0.6, D + 0.2, white, 0, 0, 0, false)
  // 背立面开窗（朝北，小窗）
  const backLit = []
  const backDark = []
  const rnd = mulberry32(seed)
  for (let f = 1; f < floors; f++) {
    for (let i = 0; i < bays; i++) {
      const zc = -D / 2 + bw * (i + 0.5)
      const on = rnd() > 0.4
      ;(on ? backLit : backDark).push([-xf - 0.06, f * FH + FH * 0.6, zc, -Math.PI / 2, bw * 0.42, FH * 0.36, 0.06])
    }
  }
  // 山墙竖窗（外廊端头的楼梯间采光）
  for (let f = 1; f < floors; f++) {
    backDark.push([0, f * FH + FH * 0.58, -D / 2 - 0.06, Math.PI, 1.5, FH * 0.4, 0.06])
  }
  scatter(g, cell, winWarm, backLit)
  scatter(g, cell, winShade, backDark)

  // 外廊 + 栏杆 + 门
  const bars = []
  const doors = []
  const doorLamps = []
  const corrLight = []
  for (let f = 0; f < floors; f++) {
    const y = f * FH
    // 廊板
    b(gallery, 0.2, D, white, xf + gallery / 2, y, 0)
    b(gallery, 0.07, D, std('#cfc6b6', { roughness: 0.82 }), xf + gallery / 2, y - 0.06, 0, false)
    // 长栏杆：连续，无隔板（这是外廊与板楼阳台的区别）
    b(0.08, 0.08, D, railM, xf + gallery - 0.06, y + 1.02, 0, false)
    const n = Math.max(14, Math.round(D / 0.18))
    for (let i = 0; i <= n; i++) {
      bars.push([xf + gallery - 0.06, y + 0.52, -D / 2 + (i * D) / n, 0, 0.035, 0.95, 0.035])
    }
    // 廊顶（上一层的板底）下藏灯
    if (f) corrLight.push([xf + gallery * 0.6, y - 0.12, 0, 0, 0.5, 0.06, D - 0.8])
    // 每开间：一扇门 + 门旁窗 + 门牌
    for (let i = 0; i < bays; i++) {
      const zc = -D / 2 + bw * (i + 0.5)
      doors.push([xf + 0.04, y + 1.05, zc - bw * 0.18, 0, 0.1, 2.1, 0.88])
      const on = rnd() > 0.32
      ;(on ? backLit : backDark).push([xf + 0.06, y + FH * 0.62, zc + bw * 0.26, Math.PI / 2, bw * 0.32, FH * 0.3, 0.06])
      if (i % 2 === 0) doorLamps.push([xf + 0.1, y + 2.42, zc - bw * 0.18])
    }
  }
  scatter(g, cell, railM, bars)
  scatter(g, cell, doorMat, doors)
  scatter(g, cell, glowLow('#ffe4bb', 0.1, 1.0), doorLamps.map((p) => [p[0], p[1], p[2], 0, 0.16, 0.1, 0.3]))
  scatter(g, cell, glowLow('#fff0d8', 0.1, 0.75), corrLight)

  // 端部楼梯筒：外凸，实体，竖窗贯通
  const sw = 3.6
  b(W, H + 0.9, 2.2, wall, 0, 0, -D / 2 - 1.1)
  b(W + 0.2, 0.16, 2.4, white, 0, H + 0.9, -D / 2 - 1.1, false)
  for (let f = 0; f < floors; f++) {
    for (const sx of [-1, 1]) {
      b(0.6, 1.0, 0.08, std('#9aa6b0', { metalness: 0.3, roughness: 0.45 }), sx * 2.2, f * FH + 1.5, -D / 2 - 2.26, false)
    }
  }

  // 底层外廊柱 + 架空
  for (let i = 0; i <= bays; i += 2) {
    cyl(g, 0.11, FH, white, xf + gallery - 0.12, FH / 2, -D / 2 + i * bw)
  }

  // 女儿墙 + 屋顶水箱 + 晾衣杆
  b(W + 0.1, 0.8, D + 0.1, white, 0, H, 0)
  b(W + 0.36, 0.12, D + 0.36, white, 0, H + 0.8, 0, false)
  const topY = H + 0.92
  cyl(g, 1.15, 2.0, std('#a8a094', { roughness: 0.8 }), -1.6, topY + 1.0, 1.2)
  cyl(g, 1.22, 0.16, std('#8f887c', { roughness: 0.8 }), -1.6, topY + 2.0, 1.2)
  for (let i = 0; i < 4; i++) b(0.04, 0.04, 2.6, std('#b9bec2', { metalness: 0.3, roughness: 0.5 }), -1.0 + i * 1.1, H + 1.5, 3.4, false)
  for (const sx of [-1, 1]) b(0.06, 1.4, 0.06, railM, sx * 2.0, H + 1.0, 2.1, false)

  // 楼名（横招，贴在外廊端头）
  signPlane(g, textSign(name, 'DORMITORY', '#2f3a33', '#e9dfc6', 460, 170), 3.2, 1.2,
    xf + gallery + 0.06, FH * 3.4, -D / 2 + 2.4, Math.PI / 2)

  solid(x, z, W + gallery + 1, D + 2.4, GROUND + H)
  return g
}

/* ══════════════════════════════════════════════════════════════
 * 族 F · 砖砌老楼：砖缝贴面 + 小窗深凹 + 防盗网 + 外挂空调
 * 不变量：砖纹材质 / 窗墙比 <0.35 / 每窗防盗网 / 女儿墙 + 屋顶水箱 + 晾衣
 * 差异轴：砖色、层数、开间数、防盗网密度、女儿墙形式
 * ══════════════════════════════════════════════════════════════ */
export function brickWalkupBlock(o = {}) {
  const {
    x = -35, z = 31, rotY = Math.PI,
    W = 9, D = 10, floors = 5, FH = 3.1,
    brickCol = '#9c6046', mortarCol = '#cdbda8',
    lit = 0.55, seed = 100,
    name = '和平里',
  } = o
  const H = floors * FH

  const g = new THREE.Group()
  g.position.set(x, GROUND, z)
  if (rotY) g.rotation.y = rotY

  // 砖纹：一张图解决整面墙，不需要几千根细条
  const brickTex = paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = mortarCol
    ctx.fillRect(0, 0, w, h)
    const rows = 8
    const cols = 4
    const bh = h / rows
    const bw = w / cols
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw / 2)
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle = brickCol
        ctx.fillRect(off + c * bw + 2, r * bh + 2, bw - 4, bh - 4)
      }
    }
  }, { repeat: [Math.round(W / 1.1), Math.round(H / 1.1)] })
  const brick = std('#ffffff', { map: brickTex, roughness: 0.9 })
  const trim = std('#cfc4b0', { roughness: 0.85 })
  const b = (w, h, d, mat, px, py, pz, sh = true) => add(g, w, h, d, mat, px, py + h / 2, pz, 0, sh)

  add(g, W + 5, 0.45, D + 5, std('#c7c0b2', { roughness: 0.92 }), 0, -0.2, 0, 0, false)
  const dh = 2.4
  cutFront(g, W, D, dh, brick, 2.6, 2.2)
  b(W, H - dh, D, brick, 0, dh, 0)
  b(W + 0.16, 0.2, D + 0.16, trim, 0, 0, 0, false)

  const bays = Math.max(2, Math.round(W / 2.6))
  const bw = W / bays
  const bayZ = Math.max(2, Math.round(D / 3.4))
  const bz = D / bayZ

  const litWin = []
  const darkWin = []
  const grilles = []
  const acs = []
  const rnd = mulberry32(seed)
  const winW = Math.min(1.0, bw * 0.42)
  const winH = 1.35
  const grilleMat = std('#6e7a80', { metalness: 0.5, roughness: 0.42 })
  const acMat = std('#b9c0c4', { roughness: 0.5, metalness: 0.2 })

  // 正背面：每开间一扇小窗，深凹 0.24，外面一层防盗网
  for (let f = 0; f < floors; f++) {
    const yc = f * FH + FH * 0.58
    for (let i = 0; i < bays; i++) {
      const px = -W / 2 + bw * (i + 0.5)
      const on = rnd() > 0.45
      for (const sz of [1, -1]) {
        ;(on ? litWin : darkWin).push([px, yc, sz * (D / 2 + 0.012), 0, winW, winH, 0.07])
        // 窗框
        b(winW + 0.24, 0.1, 0.14, trim, px, yc + winH / 2 + 0.05, sz * (D / 2 + 0.02), false)
        b(winW + 0.24, 0.1, 0.14, trim, px, yc - winH / 2 - 0.05, sz * (D / 2 + 0.02), false)
        // 防盗网：4 竖 + 2 横
        for (let k = 0; k < 4; k++) {
          grilles.push([px - winW / 2 + (k * winW) / 3, yc, sz * (D / 2 + 0.1), 0, 0.03, winH + 0.1, 0.03])
        }
        grilles.push([px, yc + winH * 0.28, sz * (D / 2 + 0.1), 0, winW, 0.03, 0.03])
        grilles.push([px, yc - winH * 0.28, sz * (D / 2 + 0.1), 0, winW, 0.03, 0.03])
        // 外挂空调
        if (rnd() > 0.5) acs.push([px + winW * 0.85, yc - winH * 0.42, sz * (D / 2 + 0.24), 0, 0.56, 0.42, 0.3])
        // 窗台
        b(winW + 0.3, 0.1, 0.24, trim, px, yc - winH / 2 - 0.16, sz * (D / 2 + 0.1), false)
      }
    }
    // 楼板腰线（砖楼每层一道浅色带）
    for (const sz of [1, -1]) b(W + 0.1, 0.08, 0.1, trim, 0, f * FH + FH - 0.04, sz * (D / 2 + 0.03), false)
  }
  // 山墙：每层两扇小窗
  for (let f = 0; f < floors; f++) {
    const yc = f * FH + FH * 0.58
    for (let i = 0; i < bayZ; i++) {
      const pz = -D / 2 + bz * (i + 0.5)
      const on = rnd() > 0.5
      for (const sx of [1, -1]) {
        ;(on ? litWin : darkWin).push([sx * (W / 2 + 0.012), yc, pz, Math.PI / 2, winW, winH, 0.07])
        for (let k = 0; k < 3; k++) {
          grilles.push([sx * (W / 2 + 0.1), yc, pz - winW / 2 + (k * winW) / 2, 0, 0.03, winH + 0.1, 0.03])
        }
      }
    }
  }
  scatter(g, cell, winWarm, litWin)
  scatter(g, cell, winShade, darkWin)
  scatter(g, cell, grilleMat, grilles)
  scatter(g, cell, acMat, acs, true)

  // 女儿墙：砖 + 压顶，转角加一小段花格
  b(W + 0.2, 0.95, D + 0.2, brick, 0, H, 0)
  b(W + 0.42, 0.14, D + 0.42, trim, 0, H + 0.95, 0, false)
  for (let i = 0; i < 4; i++) b(0.5, 0.5, 0.12, trim, -W / 2 + 1.0 + i * 2.0, H + 1.1, D / 2 + 0.15, false)

  // 屋顶：水箱 + 晾衣绳 + 电视天线
  const topY = H + 1.1
  cyl(g, 1.1, 2.0, std('#a39a8c', { roughness: 0.82 }), -2.0, topY + 1.0, -1.6)
  cyl(g, 1.18, 0.16, std('#8b8276', { roughness: 0.82 }), -2.0, topY + 2.0, -1.6)
  for (let i = 0; i < 3; i++) b(0.04, 0.04, 5.0, std('#b0a99a', { metalness: 0.3, roughness: 0.6 }), -1.6 + i * 1.6, topY + 0.4, -2.6, false)
  for (const sx of [-1, 1]) b(0.06, 1.2, 0.06, trim, sx * 3.4, topY + 0.5, -4.4, false)
  b(0.1, 3.4, 0.1, std('#8f8880', { metalness: 0.4, roughness: 0.5 }), 3.0, topY + 1.7, 3.2)
  for (let i = 0; i < 3; i++) b(1.4 - i * 0.3, 0.05, 0.05, std('#8f8880', { metalness: 0.4, roughness: 0.5 }), 3.0, topY + 2.5 + i * 0.32, 3.2, false)

  // 底层：门洞 + 卷帘门 + 小门脸招牌
  const lobbyMat = new THREE.MeshStandardMaterial({
    color: '#2c2a26', roughness: 0.16, metalness: 0.3, emissive: '#ffd9a0', emissiveIntensity: 0.05,
  })
  trackGlow(lobbyMat, 0.04, 0.3)
  plane(g, 1.8, dh - 0.5, lobbyMat, 0, 1.3, D / 2 + 0.02)
  b(2.8, 0.16, 1.2, trim, 0, dh - 0.1, D / 2 + 0.55)
  for (const sx of [-1, 1]) b(0.12, dh, 0.12, trim, sx * 1.3, 0, D / 2 + 1.05, false)
  // 卷帘门（右侧小铺）
  for (let i = 0; i < 9; i++) b(2.4, 0.1, 0.06, std('#8a8f8c', { metalness: 0.35, roughness: 0.55 }), W / 2 - 2.0, 0.35 + i * 0.22, D / 2 + 0.03, false)
  signPlane(g, textSign(name, 'HEPING LI', '#3a2c24', '#e6d3ae', 420, 150), 2.4, 0.78, W / 2 - 2.0, 2.9, D / 2 + 0.1)
  // 门灯
  b(0.22, 0.22, 0.16, glowLow('#ffd9a0', 0.12, 1.0), 1.5, 2.55, D / 2 + 0.14, false)

  solid(x, z, W + 5, D + 5, GROUND + 0.45)
  solid(x, z, W, D, GROUND + H)
  return g
}
