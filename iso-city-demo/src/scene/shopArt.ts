// 店铺的画。
//
// 一张橱窗内景、一块招牌、一块竖招、一块门口黑板，全部画在 canvas 上，
// 按 业态 / 招牌样式 / 昼夜 缓存。几何那一层只负责把平面贴到墙上。
//
// 画法上刻意不追求写实：这些图在屏幕上只有几十像素高，写实只会糊成一团。
// 靠的是**色块 + 明暗关系**：货架是一排排带高光的方块，面馆是几张桌子加
// 一团蒸汽，药房是绿十字和白色货架。远看一眼能分出"这是哪类店"就够了。
//
// 40 种业态对应 8 种内景原型（货架 / 档口 / 桌椅 / 展柜 / 挂架 / 美容 /
// 服务 / 生鲜），同原型的店靠配色和一两处专属细节区分——这样贴图数量按
// 原型算，不按店算，几十家店也不会把显存吃满。

import * as THREE from 'three'
import type { ShopCatalogEntry, ShopKind } from '../data/shopCatalog'

const CJK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

// ---------------------------------------------------------------- 颜色小工具

type RGB = [number, number, number]

function parse(hex: string): RGB {
  const v = hex.replace('#', '')
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function css(c: RGB, a = 1) {
  return a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
}

/** 整体压暗 / 提亮：k<1 变暗，k>1 变亮。 */
function shade(hex: string, k: number): RGB {
  const c = parse(hex)
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)]
}

function mix(a: string, b: string, t: number): RGB {
  const x = parse(a)
  const y = parse(b)
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]
}

function make(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return { canvas, ctx: canvas.getContext('2d')! }
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function canvasTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// ---------------------------------------------------------------- 发光画法
//
// 招牌、灯箱、霓虹、竖招共用这一套。
//
// 以前的画法是"线性渐变底色 + shadowBlur 光晕"，两者都是**软**的：贴图在
// 屏幕上只有几十像素高，软渐变和软模糊一叠，字先被自己糊掉；再被 Bloom
// 沿邻域摊一次，就只剩一团白雾——远处看是一格发灰的亮块，近看也读不出字。
//
// 参考那种像素招牌之所以清楚，是因为发光有**明确的形状**：一圈实心外扩的
// 亮边，不是高斯模糊。所以这里只用三样东西：纯色底、硬边描边、flat 文字。

/** 把字画成"灯管"：外层硬光晕 → 内层亮边 → 本体。三层都是实心描边，无模糊。 */
function flatGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxW: number,
  opts: { size: number; ink: string; glow: string; halo?: number },
) {
  const { size, ink, glow } = opts
  ctx.save()
  ctx.font = `700 ${size}px ${CJK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  // 1) 外层光晕：一圈实心描边，宽度就是光晕半径。没有 blur。
  ctx.lineWidth = opts.halo ?? size * 0.24
  ctx.strokeStyle = css(parse(glow), 0.3)
  ctx.strokeText(text, cx, cy, maxW)
  // 2) 内层灯管：更窄的一圈满饱和亮边
  ctx.lineWidth = Math.max(3, size * 0.09)
  ctx.strokeStyle = css(parse(glow), 1)
  ctx.strokeText(text, cx, cy, maxW)
  // 3) 本体：flat 色，不用阴影
  ctx.fillStyle = css(parse(ink), 1)
  ctx.fillText(text, cx, cy, maxW)
  ctx.restore()
}

/** 灯管边框：一圈等宽实线，代替原来贴在边上的渐变。 */
function tubeFrame(ctx: CanvasRenderingContext2D, w: number, h: number, glow: string, inset = 5, width = 8) {
  ctx.strokeStyle = css(parse(glow), 1)
  ctx.lineWidth = width
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2)
}

// ---------------------------------------------------------------- 内景原型

type Archetype = 'shelf' | 'counter' | 'tables' | 'display' | 'rack' | 'salon' | 'service' | 'fresh'

const ARCHETYPE_OF: Record<ShopKind, Archetype> = {
  konbini: 'shelf',
  grocer: 'shelf',
  pharmacy: 'shelf',
  stationery: 'shelf',
  toy: 'shelf',
  pet: 'shelf',
  books: 'shelf',
  hardware: 'shelf',
  noodle: 'tables',
  hotpot: 'tables',
  cafe: 'tables',
  tea: 'tables',
  bar: 'tables',
  karaoke: 'tables',
  roast: 'counter',
  deli: 'counter',
  bbq: 'counter',
  sushi: 'counter',
  milktea: 'counter',
  dessert: 'counter',
  bakery: 'fresh',
  fruit: 'fresh',
  florist: 'fresh',
  seafood: 'fresh',
  clothes: 'rack',
  tailor: 'rack',
  sportswear: 'rack',
  shoes: 'rack',
  phone: 'display',
  jewelry: 'display',
  watch: 'display',
  eyewear: 'display',
  barber: 'salon',
  salon: 'salon',
  laundry: 'service',
  express: 'service',
  photo: 'service',
  print: 'service',
  gym: 'service',
  netcafe: 'service',
}

const IW = 512
const IH = 256

/** 一排货架：底板 + 一排彩色商品块。 */
function shelfRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: string,
  rnd: () => number,
  palette: string[],
) {
  ctx.fillStyle = dark
  ctx.fillRect(x, y + h - 4, w, 4)
  const n = Math.max(3, Math.round(w / 32))
  for (let i = 0; i < n; i++) {
    const bw = w / n - 4
    const bh = h * (0.42 + rnd() * 0.44)
    ctx.fillStyle = palette[Math.floor(rnd() * palette.length)]
    ctx.fillRect(x + (w / n) * i + 2, y + h - 4 - bh, bw, bh)
    // 商品顶部一道高光，远看才有"一排排东西"的密度
    ctx.fillStyle = 'rgba(255,255,255,.24)'
    ctx.fillRect(x + (w / n) * i + 2, y + h - 4 - bh, bw, 2)
  }
}

/** 圆形的果子 / 面包 / 花头。 */
function blobs(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: string[],
  rnd: () => number,
  r = 7,
) {
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)]
    ctx.beginPath()
    ctx.arc(x + rnd() * w, y + rnd() * h, r * (0.7 + rnd() * 0.5), 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 常见的商品色板：明亮、偏饱和，远看是一排排色块。 */
const GOODS = ['#e0603f', '#f0b13c', '#4a9a68', '#3f74b0', '#d8d2c4', '#c04a6a', '#f2e2b0', '#7a8ac0']
const BOOKS = ['#8f3f3a', '#3f5a7a', '#5a6b3a', '#8a7040', '#4a4a4a', '#b08a5a', '#6a4a6a', '#3a6a6a']

function paintInterior(ctx: CanvasRenderingContext2D, kind: ShopKind, night: boolean, seed: number) {
  const rnd = rng(seed)
  const arch = ARCHETYPE_OF[kind]
  // 内景一律用中性冷白画，色温交给材质去染（见 ShopFrontage 的 windowMaterial）。
  const base = '#dfe6ea'
  const wallTop = css(shade(base, night ? 0.3 : 0.66))
  const wallMid = css(shade(base, night ? 0.16 : 0.44))
  const floor = css(shade(base, night ? 0.09 : 0.26))
  const dark = css(shade(base, night ? 0.22 : 0.3))
  const metal = night ? '#39434b' : '#8d979e'

  // 后墙
  const g = ctx.createLinearGradient(0, 0, 0, IH)
  g.addColorStop(0, wallTop)
  g.addColorStop(0.55, wallMid)
  g.addColorStop(1, floor)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, IW, IH)

  // 顶部：天花板 + 两排筒灯。这一层让"室内"有高度，而不是一张平面图。
  const cg = ctx.createLinearGradient(0, 0, 0, 46)
  cg.addColorStop(0, css(shade(base, night ? 0.42 : 0.82)))
  cg.addColorStop(1, css(shade(base, night ? 0.3 : 0.66), 0))
  ctx.fillStyle = cg
  ctx.fillRect(0, 0, IW, 46)
  for (let i = 0; i < 5; i++) {
    const x = 56 + i * 100
    const lg = ctx.createRadialGradient(x, 14, 2, x, 14, 34)
    lg.addColorStop(0, css(shade(base, 1.05), night ? 0.95 : 0.55))
    lg.addColorStop(1, css(shade(base, 0.8), 0))
    ctx.fillStyle = lg
    ctx.fillRect(x - 36, 0, 72, 44)
  }

  // 地面：透视地砖 + 一条反光
  ctx.fillStyle = floor
  ctx.fillRect(0, IH - 56, IW, 56)
  ctx.strokeStyle = css(shade(base, night ? 0.14 : 0.32), 0.6)
  ctx.lineWidth = 1.5
  for (let i = 0; i < 7; i++) {
    const y = IH - 56 + i * 9
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(IW, y)
    ctx.stroke()
  }
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath()
    ctx.moveTo(IW / 2 + i * 90, IH - 56)
    ctx.lineTo(IW / 2 + i * 26, IH)
    ctx.stroke()
  }
  const fg = ctx.createLinearGradient(0, IH - 62, 0, IH)
  fg.addColorStop(0, css(shade(base, 0.9), 0))
  fg.addColorStop(0.5, css(shade(base, night ? 0.34 : 0.5), night ? 0.5 : 0.3))
  fg.addColorStop(1, css(shade(base, night ? 0.18 : 0.34), 0))
  ctx.fillStyle = fg
  ctx.fillRect(0, IH - 62, IW, 62)

  switch (arch) {
    case 'shelf': {
      if (kind === 'books' || kind === 'stationery') {
        for (let r = 0; r < 3; r++) {
          ctx.fillStyle = css(shade(base, night ? 0.24 : 0.38))
          ctx.fillRect(30, 64 + r * 54, 320, 44)
          for (let i = 0; i < 22; i++) {
            ctx.fillStyle = BOOKS[Math.floor(rnd() * BOOKS.length)]
            ctx.fillRect(36 + i * 14, 66 + r * 54, 7 + rnd() * 5, 28 + rnd() * 10)
          }
        }
        // 靠窗的文具挂钩板
        ctx.fillStyle = css(shade(base, night ? 0.3 : 0.5))
        ctx.fillRect(360, 70, 130, 120)
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = ['#e0603f', '#3f74b0', '#4a9a68', '#f0b13c'][i % 4]
          ctx.fillRect(368 + (i % 4) * 30, 82 + Math.floor(i / 4) * 36, 8, 26)
        }
      } else if (kind === 'hardware') {
        ctx.fillStyle = css(shade(base, night ? 0.26 : 0.42))
        ctx.fillRect(24, 44, 300, 150)
        ctx.fillStyle = 'rgba(0,0,0,.2)'
        for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) ctx.fillRect(32 + x * 18, 52 + y * 18, 4, 4)
        const tool = ['#b8bcc0', '#8a7a5a', '#c87a3a', '#6a8aa0']
        for (let i = 0; i < 9; i++) {
          const x = 40 + i * 32
          ctx.fillStyle = tool[i % tool.length]
          ctx.fillRect(x, 60, 7, 52)
          ctx.fillRect(x - 7, 108, 22, 9)
        }
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = css(shade(base, night ? 0.32 : 0.46))
          ctx.fillRect(340 + (i % 2) * 70, 60 + Math.floor(i / 2) * 74, 62, 62)
        }
      } else if (kind === 'pet') {
        for (let i = 0; i < 3; i++) {
          const x = 34 + i * 108
          ctx.fillStyle = css(shade(base, night ? 0.3 : 0.5))
          ctx.fillRect(x, 96, 96, 76)
          ctx.strokeStyle = metal
          ctx.lineWidth = 3
          ctx.strokeRect(x, 96, 96, 76)
          for (let k = 0; k < 5; k++) {
            ctx.fillStyle = 'rgba(255,255,255,.35)'
            ctx.fillRect(x + 6 + k * 18, 100, 2, 68)
          }
        }
        ctx.fillStyle = css(shade(base, night ? 0.34 : 0.52))
        ctx.fillRect(30, 190, 450, 8)
        blobs(ctx, 40, 168, 430, 22, ['#e8c48a', '#c8a070', '#f0d8b0'], rnd, 8)
      } else {
        // 通用货架：便利店 / 杂货 / 药房 / 玩具
        const warm = kind === 'toy' ? ['#e0603f', '#f0b13c', '#3f74b0', '#4a9a68', '#c04a6a', '#f2e2b0'] : GOODS
        for (let r = 0; r < 3; r++) shelfRow(ctx, 34, 72 + r * 44, 296, 40, dark, rnd, warm)
        if (kind === 'konbini') {
          const cg2 = ctx.createLinearGradient(354, 40, 470, 200)
          cg2.addColorStop(0, night ? '#a8e4ff' : '#d8f0ff')
          cg2.addColorStop(1, night ? '#4a8cb4' : '#8fbccc')
          ctx.fillStyle = cg2
          ctx.fillRect(352, 42, 134, 168)
          ctx.fillStyle = 'rgba(255,255,255,.5)'
          for (let r = 0; r < 4; r++) ctx.fillRect(352, 66 + r * 40, 134, 3)
        } else if (kind === 'pharmacy') {
          ctx.fillStyle = night ? '#d8ffe8' : '#f2f8f2'
          ctx.fillRect(352, 42, 140, 168)
          for (let r = 0; r < 4; r++) {
            ctx.fillStyle = night ? '#8fd8b0' : '#c8dccc'
            ctx.fillRect(352, 88 + r * 34, 140, 4)
            for (let i = 0; i < 6; i++) {
              ctx.fillStyle = ['#ffffff', '#bfe8d0', '#e8f4ff', '#f2d8a0'][Math.floor(rnd() * 4)]
              ctx.fillRect(358 + i * 22, 62 + r * 34, 14, 22)
            }
          }
          // 绿十字
          ctx.fillStyle = night ? '#7dffc4' : '#3f9a6a'
          ctx.fillRect(30, 46, 16, 56)
          ctx.fillRect(18, 62, 40, 16)
        } else if (kind === 'grocer') {
          ctx.fillStyle = css(shade(base, night ? 0.28 : 0.44))
          ctx.fillRect(352, 90, 140, 6)
          ctx.fillRect(352, 150, 140, 6)
          blobs(ctx, 356, 70, 132, 24, ['#d8b048', '#8fc24a', '#c06a3a'], rnd, 8)
          blobs(ctx, 356, 130, 132, 24, ['#e8d8b0', '#a87a4a', '#6a8a3a'], rnd, 8)
        }
      }
      break
    }

    case 'counter': {
      // 台面 + 展示柜 + 吊挂菜单
      const counterTop = css(shade(base, night ? 0.5 : 0.78))
      ctx.fillStyle = widgetCase(night)
      ctx.fillRect(16, 128, 476, 74)
      ctx.fillStyle = counterTop
      ctx.fillRect(16, 122, 476, 10)
      ctx.fillStyle = css(shade(base, night ? 0.36 : 0.5))
      ctx.fillRect(16, 202, 476, 8)

      if (kind === 'roast' || kind === 'bbq' || kind === 'deli') {
        // 挂着的烧腊 / 串 / 卤味
        ctx.fillStyle = metal
        ctx.fillRect(40, 56, 430, 5)
        for (let i = 0; i < 8; i++) {
          const x = 66 + i * 54
          ctx.fillStyle = ['#a8482a', '#c86a38', '#9a3a24'][i % 3]
          ctx.beginPath()
          ctx.ellipse(x, 88, 15, 25, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(255,220,170,.45)'
          ctx.beginPath()
          ctx.ellipse(x - 4, 80, 5, 10, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        const rg = ctx.createRadialGradient(256, 84, 10, 256, 84, 190)
        rg.addColorStop(0, 'rgba(255,180,110,.4)')
        rg.addColorStop(1, 'rgba(255,120,60,0)')
        ctx.fillStyle = rg
        ctx.fillRect(0, 0, IW, IH)
      } else if (kind === 'sushi') {
        ctx.fillStyle = '#e8edf0'
        ctx.fillRect(40, 128, 430, 40)
        for (let i = 0; i < 7; i++) {
          const x = 60 + i * 58
          ctx.fillStyle = '#f8f4ea'
          ctx.beginPath()
          ctx.ellipse(x, 148, 20, 11, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = ['#e87a5a', '#f0b06a', '#d84a5a'][i % 3]
          ctx.beginPath()
          ctx.ellipse(x, 142, 18, 8, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#20262c'
        ctx.fillRect(360, 40, 130, 54)
        ctx.fillStyle = css(parse('#ffd9a0'), 0.7)
        ctx.font = `600 22px ${CJK}`
        ctx.textAlign = 'center'
        ctx.fillText('寿司', 425, 74)
      } else if (kind === 'milktea') {
        // 一排杯子 + 封口机 + 糖浆瓶
        ctx.fillStyle = metal
        ctx.fillRect(330, 128, 96, 46)
        for (let i = 0; i < 7; i++) {
          const x = 40 + i * 40
          ctx.fillStyle = ['#d8b088', '#e8c8a8', '#c08a5a'][i % 3]
          ctx.beginPath()
          ctx.moveTo(x, 148)
          ctx.lineTo(x + 22, 148)
          ctx.lineTo(x + 18, 196)
          ctx.lineTo(x + 4, 196)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = 'rgba(255,255,255,.4)'
          ctx.fillRect(x + 5, 154, 4, 34)
        }
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = ['#8fc24a', '#e0603f', '#f0c04a', '#c04a6a'][i % 4]
          ctx.fillRect(440, 60 + i * 12, 14, 10)
        }
      } else {
        // 甜品 / 熟食：玻璃柜里一排小方块
        for (let i = 0; i < 8; i++) {
          const x = 26 + i * 58
          ctx.fillStyle = ['#f0c0d0', '#f2e2b0', '#d8b08a', '#f0d8e8'][i % 4]
          ctx.fillRect(x, 156, 44, 38)
          ctx.fillStyle = 'rgba(255,255,255,.5)'
          ctx.fillRect(x, 156, 44, 5)
        }
      }

      // 吊挂菜单
      ctx.fillStyle = css(shade(base, night ? 0.3 : 0.5))
      ctx.fillRect(30, 22, 300, 26)
      ctx.fillStyle = css(shade(base, night ? 0.86 : 0.94), 0.8)
      for (let i = 0; i < 5; i++) ctx.fillRect(46 + i * 56, 32, 34, 3)
      break
    }

    case 'tables': {
      // 两组桌椅 + 吊灯
      for (let t = 0; t < 2; t++) {
        const x = 66 + t * 196
        ctx.fillStyle = css(shade(base, night ? 0.46 : 0.7))
        ctx.fillRect(x, 152, 126, 10)
        ctx.fillStyle = dark
        ctx.fillRect(x + 58, 162, 9, 40)
        for (const s of [-1, 1]) {
          ctx.fillStyle = css(shade(base, night ? 0.32 : 0.48))
          ctx.fillRect(x + 63 + s * 74 - 9, 158, 18, 44)
        }
        if (kind === 'tea' || kind === 'cafe' || kind === 'noodle') {
          ctx.fillStyle = '#f2ece0'
          ctx.beginPath()
          ctx.arc(x + 63, 146, 15, 0, Math.PI * 2)
          ctx.fill()
        }
        if (kind === 'hotpot') {
          ctx.fillStyle = '#8a1f1a'
          ctx.beginPath()
          ctx.ellipse(x + 63, 148, 30, 13, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(255,220,190,.5)'
          ctx.beginPath()
          ctx.ellipse(x + 63, 146, 22, 8, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        if (kind === 'bar') {
          ctx.fillStyle = 'rgba(255,200,220,.55)'
          for (let i = 0; i < 3; i++) {
            ctx.beginPath()
            ctx.arc(x + 40 + i * 26, 138, 6, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      // 吊灯
      for (let i = 0; i < 3; i++) {
        const x = 100 + i * 150
        ctx.fillStyle = css(shade(base, night ? 0.9 : 0.7), 0.9)
        ctx.beginPath()
        ctx.arc(x, 44, 13, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = css(shade(base, night ? 0.4 : 0.55))
        ctx.fillRect(x - 1, 20, 2, 26)
      }
      if (kind === 'bar' || kind === 'karaoke') {
        // 墙上的一排酒 / 霓虹
        ctx.fillStyle = css(shade(base, night ? 0.24 : 0.38))
        ctx.fillRect(330, 46, 156, 96)
        for (let r = 0; r < 3; r++) {
          ctx.fillStyle = metal
          ctx.fillRect(330, 76 + r * 30, 156, 3)
          for (let i = 0; i < 9; i++) {
            ctx.fillStyle = ['#c87a4a', '#8fc27a', '#e0c060', '#a86a8a'][Math.floor(rnd() * 4)]
            ctx.fillRect(338 + i * 16, 56 + r * 30, 7, 20)
          }
        }
      }
      if (kind === 'noodle') {
        // 墙上菜牌 + 蒸汽
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = css(shade(base, night ? 0.42 : 0.58))
          ctx.fillRect(330 + (i % 2) * 78, 40 + Math.floor(i / 2) * 40, 66, 30)
        }
        ctx.fillStyle = 'rgba(255,255,255,.14)'
        for (let i = 0; i < 6; i++) {
          ctx.beginPath()
          ctx.arc(100 + i * 30, 104 + rnd() * 24, 15 + rnd() * 9, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }

    case 'display': {
      // 展柜 + 背墙小格
      ctx.fillStyle = css(shade(base, night ? 0.2 : 0.34))
      ctx.fillRect(20, 40, 472, 84)
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = css(shade(base, night ? 0.28 : 0.44))
        ctx.fillRect(34 + i * 76, 52, 62, 62)
        if (kind === 'jewelry' || kind === 'watch') {
          ctx.fillStyle = ['#ffd27a', '#e8e8f0', '#d8a04a'][i % 3]
          ctx.beginPath()
          ctx.arc(65 + i * 76, 84, 9, 0, Math.PI * 2)
          ctx.fill()
        } else if (kind === 'eyewear') {
          ctx.strokeStyle = ['#20262c', '#8a6a4a', '#4a6a8a'][i % 3]
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(52 + i * 76, 84, 8, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(74 + i * 76, 84, 8, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.fillStyle = ['#7de8ff', '#c8f0ff', '#9ad8ff'][i % 3]
          ctx.fillRect(46 + i * 76, 62, 38, 44)
        }
      }
      // 玻璃展柜
      ctx.fillStyle = night ? 'rgba(120,180,220,.14)' : 'rgba(180,215,235,.24)'
      ctx.fillRect(20, 132, 472, 76)
      ctx.fillStyle = css(shade(base, night ? 0.34 : 0.48))
      ctx.fillRect(20, 132, 472, 5)
      ctx.fillRect(20, 204, 472, 6)
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = ['#ffd27a', '#e0e8f4', '#d8a04a', '#b8d8f0'][i % 4]
        ctx.fillRect(34 + i * 46, 166, 18, 26)
      }
      break
    }

    case 'rack': {
      // 挂衣杆 + 一排衣服（鞋店摆层板）
      if (kind === 'shoes') {
        for (let r = 0; r < 3; r++) {
          ctx.fillStyle = css(shade(base, night ? 0.26 : 0.4))
          ctx.fillRect(30, 76 + r * 48, 450, 40)
          for (let i = 0; i < 9; i++) {
            ctx.fillStyle = ['#f0ede6', '#3a3f46', '#a8603f', '#2f3a4a', '#c8b090'][i % 5]
            ctx.fillRect(44 + i * 48, 88 + r * 48, 34, 18)
          }
        }
      } else {
        ctx.fillStyle = metal
        ctx.fillRect(36, 62, 436, 5)
        for (let i = 0; i < 12; i++) {
          const x = 50 + i * 36
          ctx.fillStyle = ['#e8e4dc', '#7a8a9a', '#c07a5a', '#4a5a6a', '#d8c8a8', '#8a6a8a'][i % 6]
          ctx.fillRect(x, 68, 26, 92)
          ctx.fillStyle = 'rgba(0,0,0,.18)'
          ctx.fillRect(x + 18, 68, 8, 92)
        }
        ctx.fillStyle = css(shade(base, night ? 0.3 : 0.44))
        ctx.fillRect(36, 182, 436, 7)
        // 人台
        ctx.fillStyle = css(shade(base, night ? 0.44 : 0.62))
        ctx.beginPath()
        ctx.ellipse(460, 150, 20, 34, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }

    case 'salon': {
      // 镜子 + 椅子 + 理发灯柱
      ctx.fillStyle = night ? '#4a5c66' : '#c8d4dc'
      ctx.fillRect(120, 38, 170, 126)
      ctx.strokeStyle = css(shade(base, night ? 0.42 : 0.52))
      ctx.lineWidth = 5
      ctx.strokeRect(120, 38, 170, 126)
      // 镜子里映出的货架
      ctx.fillStyle = css(shade(base, night ? 0.3 : 0.46))
      ctx.fillRect(140, 60, 130, 6)
      ctx.fillRect(140, 90, 130, 6)
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = ['#e0603f', '#f0b13c', '#4a9a68', '#3f74b0', '#d8d2c4'][i]
        ctx.fillRect(146 + i * 22, 66, 12, 20)
      }
      ctx.fillStyle = css(shade(base, night ? 0.28 : 0.42))
      ctx.fillRect(160, 128, 90, 60)
      ctx.fillStyle = dark
      ctx.fillRect(150, 184, 110, 8)
      ctx.fillRect(200, 192, 8, 24)
      // 灯柱
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#e04a4a' : '#f2f2f2'
        ctx.fillRect(350, 66 + i * 16, 18, 16)
      }
      // 洗头床
      ctx.fillStyle = css(shade(base, night ? 0.36 : 0.5))
      ctx.fillRect(392, 132, 96, 20)
      ctx.fillRect(400, 152, 10, 30)
      break
    }

    case 'service': {
      if (kind === 'laundry') {
        for (let i = 0; i < 4; i++) {
          const x = 34 + i * 118
          ctx.fillStyle = css(shade(base, night ? 0.48 : 0.62))
          ctx.fillRect(x, 78, 100, 92)
          ctx.fillStyle = night ? '#1a2630' : '#4a5860'
          ctx.beginPath()
          ctx.arc(x + 50, 124, 30, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(180,220,255,.35)'
          ctx.beginPath()
          ctx.arc(x + 50, 124, 22, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = css(shade(base, night ? 0.86 : 0.94))
          ctx.fillRect(x + 18, 180, 64, 8)
        }
      } else if (kind === 'express') {
        ctx.fillStyle = css(shade(base, night ? 0.24 : 0.36))
        ctx.fillRect(26, 46, 460, 150)
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 8; c++) {
            ctx.fillStyle = css(shade(base, night ? 0.3 + rnd() * 0.12 : 0.44 + rnd() * 0.1))
            ctx.fillRect(36 + c * 56, 56 + r * 46, 48, 38)
            ctx.fillStyle = css(shade(base, night ? 0.8 : 0.9), 0.55)
            ctx.fillRect(42 + c * 56, 82 + r * 46, 36, 4)
          }
        }
      } else if (kind === 'gym') {
        // 跑步机一排 + 镜子
        ctx.fillStyle = night ? '#243038' : '#aab6bc'
        ctx.fillRect(20, 40, 470, 92)
        ctx.fillStyle = night ? '#1a2228' : '#5a666c'
        for (let i = 0; i < 4; i++) {
          const x = 44 + i * 116
          ctx.fillRect(x, 120, 92, 18)
          ctx.fillRect(x + 8, 138, 8, 36)
          ctx.fillRect(x + 76, 138, 8, 36)
          ctx.fillStyle = '#39c8ff'
          ctx.fillRect(x + 18, 108, 56, 12)
          ctx.fillStyle = night ? '#1a2228' : '#5a666c'
        }
      } else if (kind === 'netcafe') {
        // 一排显示器
        ctx.fillStyle = css(shade(base, night ? 0.2 : 0.32))
        ctx.fillRect(24, 58, 464, 140)
        for (let i = 0; i < 6; i++) {
          const x = 40 + i * 76
          ctx.fillStyle = '#0e1418'
          ctx.fillRect(x, 78, 60, 40)
          ctx.fillStyle = ['#3ac0ff', '#a85cff', '#5ce07a'][i % 3]
          ctx.fillRect(x + 4, 82, 52, 32)
          ctx.fillStyle = css(shade(base, night ? 0.34 : 0.46))
          ctx.fillRect(x + 20, 118, 20, 6)
        }
      } else if (kind === 'print') {
        // 打印机 + 纸卷
        ctx.fillStyle = css(shade(base, night ? 0.34 : 0.48))
        ctx.fillRect(40, 96, 200, 96)
        ctx.fillStyle = metal
        ctx.fillRect(60, 74, 160, 24)
        ctx.fillStyle = css(shade(base, night ? 0.42 : 0.56))
        ctx.fillRect(270, 110, 220, 6)
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = ['#f2f2f2', '#e8e0c8', '#d0d8e0'][i % 3]
          ctx.fillRect(276, 60 + i * 30, 60, 24)
        }
      } else {
        // photo：背景布 + 三脚架 + 一排相框
        ctx.fillStyle = css(shade(base, night ? 0.38 : 0.56))
        ctx.fillRect(30, 40, 200, 160)
        ctx.fillStyle = metal
        ctx.fillRect(140, 100, 4, 100)
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = 'rgba(255,255,255,.5)'
          ctx.fillRect(300 + i * 62, 52, 48, 60)
        }
      }
      break
    }

    case 'fresh': {
      if (kind === 'fruit' || kind === 'grocer') {
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 5; c++) {
            const x = 24 + c * 96
            const y = 100 + r * 46
            ctx.fillStyle = css(shade(base, night ? 0.34 : 0.48))
            ctx.fillRect(x, y, 86, 40)
            ctx.strokeStyle = css(shade(base, night ? 0.24 : 0.38))
            ctx.lineWidth = 2
            ctx.strokeRect(x, y, 86, 40)
            blobs(
              ctx,
              x + 6,
              y + 4,
              74,
              22,
              r === 0 ? ['#e0603f', '#f0a03c', '#d84a3a'] : r === 1 ? ['#8fc24a', '#c8d84a', '#5a9a3a'] : ['#e8d8b0', '#c89a5a', '#a87a4a'],
              rnd,
              6,
            )
          }
        }
      } else if (kind === 'florist') {
        for (let i = 0; i < 5; i++) {
          const x = 42 + i * 92
          ctx.fillStyle = i % 2 ? '#4a5c6a' : '#5a6a5a'
          ctx.fillRect(x, 138, 64, 82)
          ctx.fillStyle = 'rgba(255,255,255,.12)'
          ctx.fillRect(x, 138, 64, 6)
          blobs(ctx, x - 6, 72, 76, 70, ['#e8a0b8', '#f0d060', '#e8e0d0', '#c88ad0', '#8fc24a', '#f0a060'], rnd, 9)
        }
        ctx.strokeStyle = '#5a7a4a'
        ctx.lineWidth = 3
        for (let i = 0; i < 6; i++) {
          ctx.beginPath()
          ctx.moveTo(60 + i * 70, 226)
          ctx.lineTo(80 + i * 70, 200)
          ctx.stroke()
        }
      } else if (kind === 'seafood') {
        ctx.fillStyle = night ? '#c8e4f0' : '#e0eef4'
        ctx.fillRect(24, 128, 464, 82)
        for (let i = 0; i < 18; i++) {
          ctx.fillStyle = 'rgba(255,255,255,.5)'
          ctx.fillRect(30 + rnd() * 450, 134 + rnd() * 68, 7, 3)
        }
        for (let i = 0; i < 7; i++) {
          const x = 54 + i * 62
          ctx.fillStyle = ['#8fa8b8', '#a8b8c0', '#c07a60'][i % 3]
          ctx.beginPath()
          ctx.ellipse(x, 168, 24, 9, -0.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(x + 22, 168)
          ctx.lineTo(x + 34, 158)
          ctx.lineTo(x + 34, 178)
          ctx.closePath()
          ctx.fill()
        }
      } else {
        // bakery：烤盘 + 面包
        for (let r = 0; r < 2; r++) {
          ctx.fillStyle = css(shade(base, night ? 0.36 : 0.5))
          ctx.fillRect(30, 112 + r * 62, 450, 50)
          for (let i = 0; i < 10; i++) {
            ctx.fillStyle = ['#d89a52', '#e8b46a', '#c8863f'][Math.floor(rnd() * 3)]
            ctx.beginPath()
            ctx.ellipse(56 + i * 44, 134 + r * 62, 16, 12, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = 'rgba(255,240,210,.45)'
            ctx.beginPath()
            ctx.ellipse(56 + i * 44, 130 + r * 62, 10, 5, 0, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      break
    }
  }

  // 最后压一层从门口照进去的暖光，让所有店面共享同一种"室内感"
  const vg = ctx.createRadialGradient(IW * 0.5, IH * 0.74, 20, IW * 0.5, IH * 0.7, IW * 0.62)
  vg.addColorStop(0, 'rgba(255,236,206,.1)')
  vg.addColorStop(1, 'rgba(0,0,0,.3)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, IW, IH)
}

function widgetCase(night: boolean) {
  return night ? 'rgba(150,210,240,.16)' : 'rgba(196,224,238,.28)'
}

const interiors = new Map<string, THREE.CanvasTexture>()

export function interiorTexture(kind: ShopKind, night: boolean, variant: number) {
  const arch = ARCHETYPE_OF[kind]
  // 贴图按"原型 + 业态 + 昼夜 + 变体"缓存：同原型的店共用画法，但那一两处
  // 专属细节（绿十字、冷柜、烧腊架）仍然按业态画，不能只按原型。
  const key = `${arch}|${kind}|${night ? 1 : 0}|${variant % 2}`
  const hit = interiors.get(key)
  if (hit) return hit
  // 画在 512×256 的逻辑坐标里，实际只输出一半分辨率：这些图在屏幕上
  // 也就几十像素高，再细没人看得见，显存却要付四倍。
  const { canvas, ctx } = make(IW / 2, IH / 2)
  ctx.scale(0.5, 0.5)
  paintInterior(ctx, kind, night, 1000 + variant * 7919)
  const tex = canvasTexture(canvas)
  interiors.set(key, tex)
  return tex
}

// ---------------------------------------------------------------- 招牌

const SW = 512
const SH = 128

/** 点阵字：先把字画到离屏画布，再按采样点铺灯珠。 */
function dotText(ctx: CanvasRenderingContext2D, text: string, size: number, color: string) {
  const off = make(SW, SH)
  off.ctx.font = `700 ${size}px ${CJK}`
  off.ctx.textAlign = 'center'
  off.ctx.textBaseline = 'middle'
  off.ctx.fillStyle = '#fff'
  off.ctx.fillText(text, SW / 2, SH / 2 - 4, SW * 0.82)
  const data = off.ctx.getImageData(0, 0, SW, SH).data
  const step = 5
  ctx.fillStyle = color
  for (let y = 0; y < SH; y += step) {
    for (let x = 0; x < SW; x += step) {
      if (data[(y * SW + x) * 4 + 3] > 110) ctx.fillRect(x, y, step * 0.62, step * 0.62)
    }
  }
}

function paintSign(ctx: CanvasRenderingContext2D, shop: ShopCatalogEntry, night: boolean) {
  const { panel, ink, name, tag } = shop

  if (shop.sign === 'lightbox') {
    // 灯箱：一整块匀光亚克力 + 一圈灯管 + 大字号。
    // 底色不渐变——渐变正是"塑料感"的来源，匀光面板本来就是一整块平色。
    ctx.fillStyle = css(parse(panel))
    ctx.fillRect(0, 0, SW, SH)
    tubeFrame(ctx, SW, SH, shop.glow, 4, 9)
    flatGlowText(ctx, name, SW / 2, SH / 2, SW * 0.84, {
      size: 90,
      ink,
      glow: shop.glow,
      halo: 20,
    })
  } else if (shop.sign === 'neon') {
    // 霓虹：管本身就是颜色，所以本体用 glow 而不是 ink——掺白会掉饱和度。
    ctx.fillStyle = '#080a0c'
    ctx.fillRect(0, 0, SW, SH)
    flatGlowText(ctx, name, SW / 2, SH / 2, SW * 0.8, {
      size: 94,
      ink: shop.glow,
      glow: shop.glow,
      halo: 26,
    })
  } else if (shop.sign === 'wood') {
    const g = ctx.createLinearGradient(0, 0, SW, SH)
    g.addColorStop(0, css(shade(panel, 1.14)))
    g.addColorStop(0.5, css(parse(panel)))
    g.addColorStop(1, css(shade(panel, 0.8)))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SW, SH)
    // 木纹
    ctx.strokeStyle = 'rgba(0,0,0,.13)'
    ctx.lineWidth = 1
    for (let i = 0; i < 14; i++) {
      ctx.beginPath()
      ctx.moveTo(0, 8 + i * 9)
      ctx.bezierCurveTo(SW * 0.3, 4 + i * 9.4, SW * 0.7, 14 + i * 8.6, SW, 6 + i * 9)
      ctx.stroke()
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 58px ${CJK}`
    // 阴刻：一层投影把字"压"进木头里
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,.55)'
    ctx.shadowBlur = 3
    ctx.shadowOffsetY = 2
    ctx.fillStyle = css(parse(ink), night ? 0.95 : 0.9)
    ctx.fillText(name, SW / 2, SH / 2 - 6, SW * 0.76)
    ctx.restore()
    ctx.strokeStyle = css(parse(ink), 0.32)
    ctx.lineWidth = 2
    ctx.strokeRect(14, 12, SW - 28, SH - 24)
  } else if (shop.sign === 'cloth') {
    // 布幔：中间一块布，两侧卷边
    const g = ctx.createLinearGradient(0, 0, 0, SH)
    g.addColorStop(0, css(shade(panel, 1.1)))
    g.addColorStop(1, css(shade(panel, 0.84)))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SW, SH)
    ctx.fillStyle = 'rgba(0,0,0,.2)'
    ctx.fillRect(0, 0, 26, SH)
    ctx.fillRect(SW - 26, 0, 26, SH)
    ctx.fillStyle = 'rgba(255,255,255,.05)'
    for (let x = 26; x < SW - 26; x += 6) ctx.fillRect(x, 0, 2, SH)
    ctx.fillStyle = css(mix(panel, '#2a2018', 0.6))
    ctx.fillRect(0, 4, SW, 10)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 56px ${CJK}`
    ctx.fillStyle = css(parse(ink))
    ctx.fillText(name, SW / 2, SH / 2 - 4, SW * 0.72)
    ctx.font = `600 18px ${CJK}`
    ctx.fillStyle = css(parse(ink), 0.52)
    ctx.fillText(tag, SW / 2, SH - 20, SW * 0.7)
    ctx.fillStyle = 'rgba(0,0,0,.2)'
    for (let x = 26; x < SW - 26; x += 8) ctx.fillRect(x, SH - 6, 4, 6)
  } else if (shop.sign === 'led') {
    // 点阵屏：黑底 + 灯珠。去掉原来那层 5px 网点底纹，它在远处会糊成噪点。
    ctx.fillStyle = '#07090b'
    ctx.fillRect(0, 0, SW, SH)
    dotText(ctx, name, 86, css(parse(ink), 1))
    tubeFrame(ctx, SW, SH, shop.glow, 4, 4)
  } else if (shop.sign === 'canopy') {
    // 布篷招牌：竖条纹的篷布，字印在中间那条横幅上
    ctx.fillStyle = css(shade(panel, 1.1))
    ctx.fillRect(0, 0, SW, SH)
    for (let x = 0; x < SW; x += 44) {
      ctx.fillStyle = css(shade(panel, 0.86))
      ctx.fillRect(x, 0, 22, SH)
    }
    // 下摆的波浪
    ctx.fillStyle = 'rgba(0,0,0,.18)'
    for (let x = 0; x < SW; x += 32) {
      ctx.beginPath()
      ctx.arc(x + 16, SH - 6, 16, 0, Math.PI)
      ctx.fill()
    }
    // 中间的横幅
    const bg = ctx.createLinearGradient(0, 34, 0, SH - 26)
    bg.addColorStop(0, css(shade(panel, 1.3)))
    bg.addColorStop(1, css(shade(panel, 0.92)))
    ctx.fillStyle = bg
    ctx.fillRect(24, 30, SW - 48, SH - 62)
    ctx.strokeStyle = css(parse(ink), 0.5)
    ctx.lineWidth = 3
    ctx.strokeRect(24, 30, SW - 48, SH - 62)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 52px ${CJK}`
    ctx.fillStyle = css(parse(ink))
    ctx.fillText(name, SW / 2, SH / 2 - 4, SW * 0.7)
    ctx.font = `600 15px ${CJK}`
    ctx.fillStyle = css(parse(ink), 0.55)
    ctx.fillText(tag, SW / 2, SH - 30, SW * 0.6)
  } else {
    // painted：手绘墙招。白灰底 + 红字 + 一圈手绘描边，最市井
    ctx.fillStyle = css(shade(panel, 1))
    ctx.fillRect(0, 0, SW, SH)
    ctx.fillStyle = 'rgba(0,0,0,.05)'
    for (let i = 0; i < 26; i++) ctx.fillRect(0, (i * 37) % SH, SW, 1)
    ctx.strokeStyle = css(parse(ink), 0.7)
    ctx.lineWidth = 5
    ctx.strokeRect(16, 14, SW - 32, SH - 28)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 62px ${CJK}`
    ctx.fillStyle = css(parse(ink), 0.92)
    ctx.fillText(name, SW / 2, SH / 2 - 6, SW * 0.76)
    ctx.font = `700 18px ${CJK}`
    ctx.fillStyle = css(parse(ink), 0.55)
    ctx.fillText(tag, SW / 2, SH - 22, SW * 0.7)
  }

  // 白天不压暗贴图：贴图只画一份，白天靠材质 color 压暗。
  // 一张贴图两种昼夜各画一遍的话，几百个店招会把显存吃掉一半。
}

const signs = new Map<string, THREE.CanvasTexture>()

export function signTexture(shop: ShopCatalogEntry) {
  const hit = signs.get(shop.id)
  if (hit) return hit
  const { canvas, ctx } = make(SW, SH)
  paintSign(ctx, shop, true)
  const tex = canvasTexture(canvas)
  signs.set(shop.id, tex)
  return tex
}

// ---------------------------------------------------------------- 竖招

const BW = 128
const BH = 384

/** 竖招：2~3 个字竖排，边上一圈灯管。发光款同样用硬边画法。 */
export function bladeTexture(shop: ShopCatalogEntry) {
  const key = `${shop.id}|blade`
  const hit = signs.get(key)
  if (hit) return hit
  const { canvas, ctx } = make(BW, BH)
  const chars = [...shop.name].slice(0, 3)

  const dark = shop.sign === 'lightbox' || shop.sign === 'led' || shop.sign === 'neon'
  ctx.fillStyle = dark ? css(parse(shop.panel)) : css(shade(shop.panel, 0.92))
  ctx.fillRect(0, 0, BW, BH)

  if (dark) {
    tubeFrame(ctx, BW, BH, shop.glow, 4, 6)
  } else {
    ctx.strokeStyle = css(parse(shop.ink), 0.45)
    ctx.lineWidth = 4
    ctx.strokeRect(7, 7, BW - 14, BH - 14)
  }

  const step = (BH - 44) / chars.length
  const size = Math.min(66, step * 0.8)
  chars.forEach((ch, i) => {
    const cy = 22 + step * (i + 0.5)
    if (dark) {
      flatGlowText(ctx, ch, BW / 2, cy, BW * 0.78, {
        size,
        ink: shop.ink,
        glow: shop.glow,
        halo: size * 0.26,
      })
    } else {
      ctx.save()
      ctx.font = `700 ${size}px ${CJK}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = css(parse(shop.ink))
      ctx.fillText(ch, BW / 2, cy)
      ctx.restore()
    }
  })

  const tex = canvasTexture(canvas)
  signs.set(key, tex)
  return tex
}

// ---------------------------------------------------------------- 雨棚布

const STRIPES = ['#7a3f36', '#3d5a50', '#57496b', '#6b5334', '#2f4356', '#8a5a3c', '#8f6a3f', '#c4713f', '#3f7a52', '#7a2a22']

/**
 * 雨棚的条纹布。纯色雨棚看着像一块塑料板，加一道 8cm 的竖条纹之后，
 * 才有"布"的质感——这是店铺材质最容易被忽略的一处。
 */
export function awningTexture(color: string, night: boolean) {
  const key = `awning|${color}|${night ? 1 : 0}`
  const hit = signs.get(key)
  if (hit) return hit
  const { canvas, ctx } = make(128, 128)
  ctx.fillStyle = css(parse(color))
  ctx.fillRect(0, 0, 128, 128)
  const stripe = css(shade(color, night ? 0.72 : 0.84))
  for (let x = 0; x < 128; x += 32) {
    ctx.fillStyle = stripe
    ctx.fillRect(x, 0, 16, 128)
  }
  // 布的织纹 + 下摆的暗部
  ctx.fillStyle = 'rgba(255,255,255,.06)'
  for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 128, 1)
  const vb = ctx.createLinearGradient(0, 0, 0, 128)
  vb.addColorStop(0, 'rgba(255,255,255,.1)')
  vb.addColorStop(0.7, 'rgba(0,0,0,0)')
  vb.addColorStop(1, 'rgba(0,0,0,.22)')
  ctx.fillStyle = vb
  ctx.fillRect(0, 0, 128, 128)

  const tex = canvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  signs.set(key, tex)
  return tex
}

/** 雨棚色号的固定顺序（合批时同色能并桶）。 */
export const AWNING_COLORS = STRIPES

// ---------------------------------------------------------------- 门口黑板 / 菜单

/** 门口那块小黑板：手写感的几行字。 */
export function aboardTexture(shop: ShopCatalogEntry) {
  const key = `${shop.id}|aboard`
  const hit = signs.get(key)
  if (hit) return hit
  const { canvas, ctx } = make(256, 320)
  ctx.fillStyle = '#1b1f1e'
  ctx.fillRect(0, 0, 256, 320)
  ctx.strokeStyle = '#6b5a42'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, 248, 312)
  ctx.fillStyle = 'rgba(255,255,255,.05)'
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 256, Math.random() * 320, 12, 1)

  ctx.fillStyle = css(parse(shop.ink), 0.92)
  ctx.textAlign = 'center'
  ctx.font = `700 30px ${CJK}`
  ctx.fillText(shop.name.slice(0, 4), 128, 54)
  ctx.strokeStyle = css(parse(shop.ink), 0.4)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(40, 74)
  ctx.lineTo(216, 74)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.font = `500 20px ${CJK}`
  const lines = ['今日', '· 招牌 / 推荐', '· 现做 / 现烤', '· 可打包', '· 营业中']
  lines.forEach((line, i) => {
    ctx.fillStyle = css(parse(shop.ink), i === 0 ? 0.9 : 0.6)
    ctx.fillText(line, 30, 116 + i * 38)
  })
  ctx.fillStyle = css(parse(shop.ink), 0.5)
  ctx.fillRect(30, 280, 150, 2)

  const tex = canvasTexture(canvas)
  signs.set(key, tex)
  return tex
}

/** 竖挂的菜单条：面馆 / 烧腊挂在门侧。 */
export function menuStripTexture(shop: ShopCatalogEntry) {
  const key = `${shop.id}|menu`
  const hit = signs.get(key)
  if (hit) return hit
  const { canvas, ctx } = make(96, 320)
  ctx.fillStyle = css(shade(shop.panel, 1.05))
  ctx.fillRect(0, 0, 96, 320)
  ctx.strokeStyle = css(parse(shop.ink), 0.35)
  ctx.lineWidth = 3
  ctx.strokeRect(5, 5, 86, 310)
  ctx.fillStyle = css(parse(shop.ink), 0.85)
  ctx.textAlign = 'center'
  ctx.font = `700 26px ${CJK}`
  ;['菜', '单'].forEach((ch, i) => ctx.fillText(ch, 48, 46 + i * 34))
  ctx.font = `500 13px ${CJK}`
  ctx.fillStyle = css(parse(shop.ink), 0.55)
  for (let i = 0; i < 8; i++) ctx.fillRect(12, 130 + i * 22, 72, 2)

  const tex = canvasTexture(canvas)
  signs.set(key, tex)
  return tex
}

// ---------------------------------------------------------------- 街道自己的招牌

/** 街口的立柱灯箱：竖排的大字，底下跟一行小字。 */
export function streetSignTexture(title: string, sub: string, panel: string, ink: string, glow: string) {
  const key = `street|${title}|${sub}`
  const hit = signs.get(key)
  if (hit) return hit
  const W = 128
  const H = 512
  const { canvas, ctx } = make(W, H)
  // 纯色底 + 一圈灯管 + 竖排大字。原来那块渐变底和 18px 模糊字去掉之后，
  // 远处读到的是一根清楚的"亮条"，而不是一团发蓝的雾。
  ctx.fillStyle = css(parse(panel))
  ctx.fillRect(0, 0, W, H)
  tubeFrame(ctx, W, H, glow, 4, 6)

  const chars = [...title]
  const step = (H - 80) / chars.length
  const size = Math.min(78, step * 0.84)
  chars.forEach((ch, i) => {
    flatGlowText(ctx, ch, W / 2, 40 + step * (i + 0.5), W * 0.82, {
      size,
      ink,
      glow,
      halo: size * 0.24,
    })
  })

  const tex = canvasTexture(canvas)
  signs.set(key, tex)
  return tex
}

/** 小吃车的招牌灯箱。 */
export function kioskTexture(name: string, sub: string, glow: string) {
  const key = `kiosk|${name}`
  const hit = signs.get(key)
  if (hit) return hit
  const W = 256
  const H = 72
  const { canvas, ctx } = make(W, H)
  // 灯箱底压成一个很暗的中间调，让亮字自己跳出来；不再画三段渐变。
  ctx.fillStyle = 'rgba(12,14,17,1)'
  ctx.fillRect(0, 0, W, H)
  tubeFrame(ctx, W, H, glow, 3, 3)
  flatGlowText(ctx, name, W / 2, H / 2 + 1, W * 0.84, {
    size: 48,
    ink: glow,
    glow,
    halo: 14,
  })

  const tex = canvasTexture(canvas)
  signs.set(key, tex)
  return tex
}

/** 挂在灯串上的小布幡：一个字一面，风里一排。 */
export function bannerTexture(ch: string, panel: string, ink: string) {
  const key = `banner|${ch}|${panel}`
  const hit = signs.get(key)
  if (hit) return hit
  const { canvas, ctx } = make(96, 160)
  ctx.fillStyle = css(parse(panel))
  ctx.fillRect(0, 0, 96, 160)
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  ctx.fillRect(0, 0, 96, 8)
  ctx.fillRect(0, 152, 96, 8)
  ctx.fillStyle = css(parse(ink), 0.92)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 56px ${CJK}`
  ctx.fillText(ch, 48, 84)
  const tex = canvasTexture(canvas)
  signs.set(key, tex)
  return tex
}
