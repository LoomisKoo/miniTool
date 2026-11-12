import * as THREE from 'three'
import * as Mat from './mat.js'

/**
 * 店招 / 挑灯箱 / 店内背景画 / 门牌：全部用 canvas 现画文字与图形。
 * 每种店一套贴图 + 材质（一种店一个实例池），夜里 emissive 打开 = 灯箱/霓虹，白天不亮。
 */
const ZH = '"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif'
const ZHS = '"Songti SC","STSong","Noto Serif SC","SimSun",serif'

export const SHOP_TYPES = [
  { id: 'cafe', zh: '咖啡', en: 'CAFÉ · COFFEE', bg: '#3b2a20', fg: '#f3e2c4', acc: '#c8925a', style: 'box', font: ZHS, enFont: 'Georgia, serif', awning: '#5a3a26', interior: 'cafe', outdoor: 'cafe', wall: '#d9c3a0' },
  { id: 'mart', zh: '便利店', en: '24H MART', bg: '#ffffff', fg: '#0f7a3c', acc: '#f28c1e', style: 'box', stripes: true, font: ZH, enFont: '"Arial Black", Helvetica, sans-serif', awning: '#1f9a4c', interior: 'mart', outdoor: 'bikes', wall: '#eef2f0' },
  { id: 'bakery', zh: '面包房', en: 'Bakery', bg: '#f2e3c6', fg: '#7a4a24', acc: '#c98a3a', style: 'box', border: true, font: ZHS, enFont: 'Georgia, serif', awning: '#b8783a', interior: 'bread', outdoor: 'board', wall: '#f0dcb8' },
  { id: 'pharmacy', zh: '药房', en: 'PHARMACY', bg: '#ffffff', fg: '#13804a', acc: '#18a558', style: 'box', cross: true, font: ZH, enFont: 'Helvetica, Arial, sans-serif', awning: '#18a558', interior: 'pharmacy', wall: '#f4f8f6' },
  { id: 'bank', zh: '银行', en: 'BANK', bg: '#1d2b44', fg: '#e2bc4a', style: 'box', border: true, acc: '#e2bc4a', font: ZHS, enFont: '"Times New Roman", serif', awning: '#24324a', interior: 'bank', wall: '#e6e2d8' },
  { id: 'restaurant', zh: '川菜馆', en: 'SICHUAN KITCHEN', bg: '#9e1b1b', fg: '#f5cf6a', acc: '#f5cf6a', style: 'box', border: true, font: ZHS, enFont: 'Georgia, serif', awning: '#7e1414', interior: 'tables', wall: '#c9543a' },
  { id: 'books', zh: '书店', en: 'BOOKS', bg: '#1f3d2e', fg: '#e8dcc0', acc: '#c9a85a', style: 'box', font: ZHS, enFont: 'Georgia, serif', awning: '#1f3d2e', interior: 'books', outdoor: 'bikes', wall: '#d8c8a8' },
  { id: 'fashion', zh: '服饰', en: 'MODE', bg: '#111111', fg: '#ffffff', style: 'box', border: true, acc: '#c8c8c8', font: ZH, enFont: 'Futura, "Helvetica Neue", sans-serif', awning: '#2a2a2a', interior: 'racks', wall: '#f2efe9' },
  { id: 'ramen', zh: '拉面', en: 'RAMEN', bg: '#c8102e', fg: '#ffffff', style: 'noren', font: ZHS, enFont: 'Georgia, serif', awning: '#2b2b2b', interior: 'tables', outdoor: 'board', wall: '#e0c49a' },
  { id: 'bar', zh: '酒吧', en: 'BAR', bg: '#0b0b10', fg: '#ff3fa4', acc: '#38e8ff', style: 'neon', font: ZH, enFont: '"Snell Roundhand","Brush Script MT",cursive', awning: '#1a1a22', interior: 'bar', wall: '#3a2430' },
  { id: 'tea', zh: '奶茶', en: 'MILK TEA', bg: '#f7d6e0', fg: '#8a2b52', acc: '#e58aa8', style: 'box', round: true, font: ZH, enFont: '"Avenir Next", Helvetica, sans-serif', awning: '#e58aa8', interior: 'tea', outdoor: 'cafe', wall: '#fbe8ee' },
  { id: 'anime', zh: '动漫手办', en: 'ANIME · FIGURES', bg: '#ff5fa8', fg: '#ffffff', acc: '#2fd0ff', style: 'box', round: true, font: ZH, enFont: '"Arial Black", Helvetica, sans-serif', awning: '#ff5fa8', interior: 'racks', wall: '#fff0f7', only: 'anime' },
  { id: 'toys', zh: '潮玩盲盒', en: 'POP TOYS', bg: '#2fd0ff', fg: '#1a1a2e', acc: '#ffe066', style: 'box', stripes: true, font: ZH, enFont: '"Arial Black", Helvetica, sans-serif', awning: '#2fd0ff', interior: 'shelves', wall: '#eefaff', only: 'anime' },
  { id: 'flower', zh: '花店', en: 'FLOWERS', bg: '#e9f2e4', fg: '#3e7a3a', acc: '#e86a9a', style: 'box', font: ZHS, enFont: 'Georgia, serif', awning: '#3e7a3a', interior: 'flowers', outdoor: 'flowers', wall: '#f1f5ec' },
]

function rnd(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
function tex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
function rr(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}
function fitFont(g, text, font, size, maxW, weight = 'bold') {
  let s = size
  g.font = `${weight} ${s}px ${font}`
  while (g.measureText(text).width > maxW && s > 10) {
    s -= 2
    g.font = `${weight} ${s}px ${font}`
  }
  return s
}

/**
 * 门头招牌 v2（统一版式）：品牌色底板（上亮下暗的细微渐变）+ 金属外框 + 内发丝线，
 * 左侧圆形徽标（首字/图形），中文主名 + 字距拉开的英文副名两行左对齐。
 * glow=true 画的是自发光图：底板压到很暗，只有字/徽标/细线亮 —— 夜里是「字亮板不亮」，不再是一整块白光。
 */
function drawFascia(t, glow) {
  return (g, w, h) => {
    const dim = (c, k) => shade(c, k)
    // 底板
    if (glow) {
      g.fillStyle = dim(t.bg, -0.88)
      g.fillRect(0, 0, w, h)
    } else {
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, dim(t.bg, 0.1))
      gr.addColorStop(1, dim(t.bg, -0.14))
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
    }
    const acc = t.acc || t.fg
    // 外框 + 内发丝线
    g.strokeStyle = glow ? dim(acc, -0.55) : acc
    g.lineWidth = 6
    g.strokeRect(3, 3, w - 6, h - 6)
    g.globalAlpha = glow ? 0.45 : 0.55
    g.strokeStyle = t.fg
    g.lineWidth = 1.5
    g.strokeRect(13, 13, w - 26, h - 26)
    g.globalAlpha = 1
    if (t.stripes) {
      g.fillStyle = glow ? dim(acc, -0.3) : acc
      g.fillRect(13, h - 24, w - 26, 6)
    }
    // 徽标
    const r = h * 0.3
    const bx = 22 + r
    const by = h / 2
    g.fillStyle = acc
    g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill()
    g.fillStyle = t.bg
    if (t.cross) {
      const a = r * 0.22, b = r * 0.62
      g.fillRect(bx - a, by - b, a * 2, b * 2)
      g.fillRect(bx - b, by - a, b * 2, a * 2)
    } else {
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `bold ${Math.round(r * 1.15)}px ${t.font}`
      g.fillText([...t.zh][0], bx, by + 2)
    }
    // 文字
    const x0 = bx + r + 22
    const maxW = w - x0 - 30
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    g.fillStyle = t.fg
    if (glow) { g.shadowColor = t.fg; g.shadowBlur = 6 }
    fitFont(g, t.zh, t.font, 60, maxW * 0.9)
    g.fillText(t.zh, x0, h * 0.6)
    g.shadowBlur = 0
    g.globalAlpha = 0.86
    g.letterSpacing = '5px'
    fitFont(g, t.en.toUpperCase(), t.enFont, 19, maxW, '600')
    g.fillText(t.en.toUpperCase(), x0 + 2, h * 0.85)
    g.letterSpacing = '0px'
    g.globalAlpha = 1
    if (t.style === 'noren') {
      g.fillStyle = 'rgba(40,0,8,0.8)'
      for (const fx of [0.62, 0.78]) g.fillRect(w * fx - 2, h * 0.62, 3, h * 0.38)
    }
  }
}

function drawSign(t) {
  return (g, w, h) => {
    const letters = t.style === 'letters'
    if (!letters) {
      g.fillStyle = t.bg
      if (t.round) { rr(g, 2, 2, w - 4, h - 4, 40); g.fill() } else g.fillRect(0, 0, w, h)
    }
    if (t.stripes) {
      g.fillStyle = t.fg
      g.fillRect(0, 0, w, 12)
      g.fillStyle = t.acc
      g.fillRect(0, h - 16, w, 16)
    }
    if (t.border) {
      g.strokeStyle = t.acc
      g.lineWidth = 4
      g.strokeRect(8, 8, w - 16, h - 16)
    }
    let x0 = 36
    if (t.cross) {
      g.fillStyle = t.acc
      const cx = 64, cy = h / 2, a = 18, b = 50
      g.fillRect(cx - a, cy - b, a * 2, b * 2)
      g.fillRect(cx - b, cy - a, b * 2, a * 2)
      x0 = 132
    }
    if (t.id === 'cafe') {
      // 咖啡杯
      g.strokeStyle = t.acc
      g.lineWidth = 5
      g.beginPath(); g.arc(70, h / 2 + 6, 26, 0, Math.PI); g.stroke()
      g.beginPath(); g.moveTo(44, h / 2 + 6); g.lineTo(96, h / 2 + 6); g.stroke()
      g.beginPath(); g.arc(100, h / 2 + 14, 10, -Math.PI / 2, Math.PI / 2); g.stroke()
      x0 = 128
    }
    const zh = t.zh
    const zhSize = fitFont(g, zh, t.font, 78, w * 0.48)
    const zhW = g.measureText(zh).width
    g.textBaseline = 'middle'
    const neon = t.style === 'neon'
    const y = h / 2 + 4
    const paintText = (txt, x, yy) => {
      if (neon) {
        g.shadowColor = t.fg
        g.shadowBlur = 18
        g.strokeStyle = t.fg
        g.lineWidth = 5
        g.strokeText(txt, x, yy)
        g.shadowBlur = 6
        g.strokeStyle = '#ffe8f4'
        g.lineWidth = 1.6
        g.strokeText(txt, x, yy)
        g.shadowBlur = 0
      } else {
        if (letters) {
          g.lineWidth = 3
          g.strokeStyle = 'rgba(0,0,0,0.35)'
          g.strokeText(txt, x, yy)
        }
        g.fillStyle = t.fg
        g.fillText(txt, x, yy)
      }
    }
    // 文字组整体居中（画布按网格比例 6:1 生成，不再非等比拉伸）
    const wgt = t.style === 'letters' ? '600' : 'bold'
    let enSize = 0
    let enW = 0
    const enMax0 = w - x0 - zhW - 26 - 24
    if (enMax0 > 60) {
      enSize = fitFont(g, t.en, t.enFont, 36, Math.min(enMax0, w * 0.42), wgt)
      enW = g.measureText(t.en).width
    }
    const total = zhW + (enW ? 26 + enW : 0)
    const shift = Math.max(0, (w - x0 - 24 - total) / 2)
    g.font = `bold ${zhSize}px ${t.font}`
    paintText(zh, x0 + shift, y)
    if (enW) {
      g.font = `${wgt} ${enSize}px ${t.enFont}`
      paintText(t.en, x0 + shift + zhW + 26, y + 6)
    }
    if (neon) {
      g.shadowColor = t.acc
      g.shadowBlur = 14
      g.strokeStyle = t.acc
      g.lineWidth = 4
      g.beginPath(); g.moveTo(x0, h - 18); g.lineTo(w - 30, h - 18); g.stroke()
      g.shadowBlur = 0
    }
    if (t.style === 'noren') {
      // 暖帘开衩
      g.fillStyle = 'rgba(60,0,10,0.85)'
      for (const fx of [0.25, 0.5, 0.75]) g.fillRect(w * fx - 2, h * 0.55, 4, h * 0.45)
    }
  }
}

function drawBlade(t) {
  return (g, w, h) => {
    const bg = t.style === 'letters' ? t.bg : t.bg
    g.fillStyle = bg
    rr(g, 4, 4, w - 8, h - 8, 18)
    g.fill()
    g.strokeStyle = t.acc || t.fg
    g.lineWidth = 4
    rr(g, 10, 10, w - 20, h - 20, 14)
    g.stroke()
    const chars = [...t.zh].slice(0, 3)
    const fg = t.style === 'letters' ? (t.id === 'fashion' ? '#ffffff' : t.fg) : t.fg
    const size = chars.length > 2 ? 56 : 66
    g.font = `bold ${size}px ${t.font}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const step = (h - 70) / chars.length
    chars.forEach((c, i) => {
      if (t.style === 'neon') { g.shadowColor = t.fg; g.shadowBlur = 14 }
      g.fillStyle = fg
      g.fillText(c, w / 2, 34 + step * (i + 0.5))
      g.shadowBlur = 0
    })
    g.font = `bold 15px Helvetica, Arial, sans-serif`
    g.fillStyle = fg
    g.fillText(t.en.split(' ')[0].slice(0, 9), w / 2, h - 24)
  }
}

function drawBackdrop(t, seed) {
  return (g, w, h) => {
    const r = rnd(seed)
    const col = (a) => a[(r() * a.length) | 0]
    const bright = ['#e15a72', '#f2c14e', '#54b3a6', '#6aa6d8', '#c9744a', '#f0f2f4', '#9ac47a', '#d68fb5', '#ef8b3a', '#4a6fd1']
    g.fillStyle = t.wall
    g.fillRect(0, 0, w, h)
    // 地面 + 顶灯带
    g.fillStyle = t.interior === 'bar' ? '#2a1a14' : '#8a7660'
    g.fillRect(0, h * 0.84, w, h * 0.16)
    g.fillStyle = 'rgba(255,250,235,0.55)'
    g.fillRect(w * 0.08, 6, w * 0.84, 6)
    const it = t.interior
    if (it === 'shelves' || it === 'books') {
      const rows = it === 'books' ? 4 : 3
      for (let i = 0; i < rows; i++) {
        const y = 40 + i * ((h * 0.8 - 40) / rows)
        const rowH = (h * 0.8 - 40) / rows
        let x = 16
        while (x < w - 16) {
          const iw = it === 'books' ? 5 + r() * 7 : 10 + r() * 14
          const ih = it === 'books' ? rowH * (0.6 + r() * 0.3) : rowH * (0.35 + r() * 0.35)
          g.fillStyle = it === 'books' ? col(['#7a2a2a', '#2a4a6a', '#3a6a48', '#c09030', '#5a3a68', '#d8d0c0', '#8a5a3a', '#1e1e1e']) : col(bright)
          g.fillRect(x, y + rowH - ih - 4, iw, ih)
          x += iw + (it === 'books' ? 1 : 3 + r() * 4)
        }
        g.fillStyle = it === 'books' ? '#5a3c26' : '#d8d8d8'
        g.fillRect(8, y + rowH - 4, w - 16, 6)
      }
      if (it === 'shelves' && t.id === 'pharmacy') {
        g.fillStyle = '#18a558'
        g.fillRect(w / 2 - 10, 14, 20, 50); g.fillRect(w / 2 - 25, 29, 50, 20)
      }
    } else if (it === 'menu') {
      g.fillStyle = '#2b2b2b'
      g.fillRect(40, 22, w - 80, 78)
      g.fillStyle = '#efe6d2'
      for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) {
        g.fillRect(60 + c * ((w - 120) / 3), 36 + i * 20, 60 + r() * 50, 6)
      }
      g.fillStyle = '#8a5a3a'
      g.fillRect(20, h * 0.58, w - 40, h * 0.26)
      g.fillStyle = '#c8a070'
      g.fillRect(14, h * 0.56, w - 28, 10)
      g.fillStyle = '#9aa3ad'
      g.fillRect(w * 0.62, h * 0.4, 70, h * 0.17)
      g.fillStyle = '#ffffff'
      for (let i = 0; i < 6; i++) g.fillRect(70 + i * 22, h * 0.5, 12, 12)
    } else if (it === 'bread') {
      for (let i = 0; i < 3; i++) {
        const y = 50 + i * 42
        g.fillStyle = '#7a5434'
        g.fillRect(20, y + 24, w - 40, 6)
        for (let x = 34; x < w - 40; x += 34 + r() * 10) {
          g.fillStyle = col(['#c98a3a', '#e0a95a', '#b06a2a', '#e8c48a'])
          g.beginPath(); g.ellipse(x, y + 14, 14, 9, 0, 0, Math.PI * 2); g.fill()
        }
      }
      g.fillStyle = 'rgba(220,235,240,0.6)'
      g.fillRect(30, h * 0.66, w - 60, h * 0.18)
    } else if (it === 'counter') {
      g.fillStyle = '#1d2b44'
      g.fillRect(w / 2 - 90, 24, 180, 60)
      g.fillStyle = '#e2bc4a'
      g.beginPath(); g.arc(w / 2, 54, 20, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#b8b2a6'
      g.fillRect(30, h * 0.6, w * 0.6, h * 0.24)
      g.fillStyle = '#9aa3ad'
      g.fillRect(w - 110, h * 0.36, 70, h * 0.48)
      g.fillStyle = '#1a2a3a'
      g.fillRect(w - 98, h * 0.42, 46, 30)
    } else if (it === 'tables') {
      for (let i = 0; i < 5; i++) {
        const x = 50 + i * ((w - 100) / 4)
        g.fillStyle = t.id === 'ramen' ? '#f0e0c0' : '#d22b2b'
        g.beginPath(); g.ellipse(x, 40, 14, 18, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#e8b84a'
        g.fillRect(x - 3, 56, 6, 6)
      }
      for (let i = 0; i < 3; i++) {
        const x = 60 + i * ((w - 120) / 2)
        g.fillStyle = '#4a2e1e'
        g.fillRect(x - 40, h * 0.6, 80, 10)
        g.fillRect(x - 4, h * 0.6, 8, h * 0.24)
        g.fillStyle = '#6a4a32'
        g.fillRect(x - 60, h * 0.68, 14, h * 0.16)
        g.fillRect(x + 46, h * 0.68, 14, h * 0.16)
      }
    } else if (it === 'racks') {
      g.fillStyle = '#555'
      g.fillRect(30, 60, w - 140, 4)
      for (let x = 40; x < w - 120; x += 22 + r() * 8) {
        g.fillStyle = col(['#1e1e1e', '#d8d0c0', '#8a2a28', '#2a4a6a', '#c09030', '#6a8a6a', '#f0f0f0'])
        g.beginPath()
        g.moveTo(x, 66); g.lineTo(x + 18, 66); g.lineTo(x + 22, 66 + 70 + r() * 40); g.lineTo(x - 4, 66 + 70 + r() * 40)
        g.closePath(); g.fill()
      }
      g.fillStyle = 'rgba(200,215,225,0.8)'
      g.fillRect(w - 96, 30, 60, h * 0.7)
    } else if (it === 'bar') {
      g.fillStyle = '#1a1210'
      g.fillRect(0, 0, w, h * 0.84)
      for (let i = 0; i < 3; i++) {
        const y = 30 + i * 40
        g.fillStyle = '#5a3a26'
        g.fillRect(20, y + 30, w - 40, 4)
        for (let x = 26; x < w - 30; x += 12 + r() * 6) {
          g.fillStyle = col(['#7ad1ff', '#ffb04a', '#a0e070', '#ff6a8a', '#f0e0c0'])
          g.fillRect(x, y + 6, 6, 24)
        }
      }
      g.fillStyle = '#3a2416'
      g.fillRect(10, h * 0.62, w - 20, h * 0.22)
      g.fillStyle = '#ff3fa4'
      g.fillRect(10, h * 0.62, w - 20, 3)
    } else if (it === 'flowers') {
      for (let i = 0; i < 9; i++) {
        const x = 30 + i * ((w - 60) / 8)
        g.fillStyle = '#3a3a3a'
        g.fillRect(x - 16, h * 0.6, 32, h * 0.24)
        for (let k = 0; k < 9; k++) {
          g.fillStyle = col(['#e86a9a', '#f2c14e', '#ffffff', '#d22b4b', '#b07ad8', '#ff9a5a'])
          g.beginPath(); g.arc(x + (r() - 0.5) * 34, h * 0.45 + (r() - 0.5) * 50, 7, 0, Math.PI * 2); g.fill()
        }
      }
    }
  }
}

const PLATES = ['和平里 18号', '锦绣苑 6栋', '云栖公寓 A座', '滨江花园 3号']
function drawPlate(i) {
  return (g, w, h) => {
    g.fillStyle = i % 2 ? '#1f3a5f' : '#2a2a2a'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#e8dcc0'
    g.lineWidth = 4
    g.strokeRect(8, 8, w - 16, h - 16)
    g.fillStyle = '#f4efe2'
    g.textBaseline = 'middle'
    g.textAlign = 'center'
    fitFont(g, PLATES[i], ZH, 64, w - 50)
    g.fillText(PLATES[i], w / 2, h / 2 + 2)
  }
}

function glowMat(map, day, night, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: day,
    roughness: 0.55, metalness: 0.04, envMapIntensity: 0.4, ...opts,
  })
  Mat.registerNight(m, day, night)
  return m
}

export const FAC = {
  hospital: ['市第一人民医院', "CITY PEOPLE'S HOSPITAL", '#ffffff', '#c8102e', '#c8102e'],
  emergency: ['急诊', 'EMERGENCY', '#c8102e', '#ffffff', null],
  school: ['市实验中学', 'EXPERIMENTAL MIDDLE SCHOOL', '#f6f1e6', '#1d3f73', '#b8202a'],
  gas: ['加油站', 'GAS STATION', '#ffffff', '#d71920', '#f39200'],
  parking: ['P 停车场', 'PUBLIC PARKING', '#1f5fbf', '#ffffff', null],
  gym: ['全民健身中心', 'SPORTS CENTER', '#0f6d5a', '#ffffff', '#f2c230'],
  stadium: ['市体育场', 'CITY STADIUM', '#123a6b', '#ffffff', '#f2c230'],
  library: ['市图书馆', 'PUBLIC LIBRARY', '#f4efe2', '#2d4a3a', '#a8823a'],
  arena: ['星光演艺中心', 'STAR ARENA · LIVE', '#1a0f2e', '#ff4fd8', '#38e8ff'],
  museum: ['城市博物馆', 'CITY MUSEUM', '#efe9dc', '#3a3026', '#9a7a4a'],
  cinema: ['星河影城', 'GALAXY CINEMA', '#14141c', '#ffd23a', '#e8352e'],
  metro: ['地铁站', 'METRO', '#c8102e', '#ffffff', null],
  bus: ['公交总站', 'BUS TERMINAL', '#1f7a3a', '#ffffff', null],
  police: ['公安局', 'POLICE', '#0d2a6b', '#ffffff', '#c8102e'],
  fire: ['消防站', 'FIRE STATION', '#c8102e', '#ffffff', '#ffd23a'],
  post: ['邮政局', 'CHINA POST', '#0b6b3a', '#ffffff', '#ffd23a'],
  hotel: ['君悦大酒店', 'GRAND HOTEL', '#2a1e14', '#e8c47a', null],
  market: ['惠民超市', 'SUPERMARKET', '#ffffff', '#d4201e', '#f2a01e'],
  temple: ['静安寺', 'JING AN TEMPLE', '#7a1a14', '#f3d27a', null],
  church: ['圣心教堂', 'SACRED HEART CHURCH', '#efe9dc', '#3a2e4a', null],
  mall: ['万象购物中心', 'MIXC MALL', '#111111', '#ffffff', '#e8b04a'],
  bike: ['共享单车', 'CITY BIKE', '#f2c230', '#1a1a1a', null],
  plaza: ['市民广场', 'CIVIC PLAZA', '#efe9dc', '#2a3a4a', null],
  office: ['国际金融中心', 'IFC OFFICE PLAZA', '#0e1a2a', '#cfe3f2', null],
  gov: ['市政务服务中心', 'CIVIC SERVICE CENTER', '#f4efe2', '#8a1a14', '#c8a040'],
  farmers: ['城南农贸市场', "FARMERS' MARKET", '#2f6a3a', '#ffffff', '#f2c230'],
  garage: ['立体停车楼', 'PARKING GARAGE', '#1f5fbf', '#ffffff', null],
  park: ['城市公园', 'CITY PARK', '#2f6a3a', '#ffffff', null],
  wc: ['公共厕所 WC', 'RESTROOM', '#2a5a8a', '#ffffff', null],
  kiosk: ['小卖部', 'KIOSK', '#e8a030', '#2a1a10', null],
  walkst: ['步行街', 'PEDESTRIAN STREET', '#8a1a14', '#f5d27a', null],
  barst: ['酒吧街', 'BAR STREET', '#14081e', '#ff3fa4', '#38e8ff'],
  anime: ['动漫潮玩街', 'ANIME · TOYS', '#ff5fa8', '#ffffff', '#2fd0ff'],
  oldtown: ['老城区', 'OLD TOWN', '#5a3a26', '#f3e2c4', null],
  cbd: ['中央商务区', 'CBD', '#0e1a2a', '#cfe3f2', null],
}
function drawBoard(k) {
  const [zh, en, bg, fg, acc] = FAC[k]
  return (g, w, h) => {
    g.fillStyle = bg
    rr(g, 3, 3, w - 6, h - 6, 12)
    g.fill()
    if (acc) {
      g.fillStyle = acc
      g.fillRect(3, h - 20, w - 6, 12)
    }
    g.fillStyle = fg
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    fitFont(g, zh, ZH, 64, w - 40)
    g.fillText(zh, w / 2, h * 0.4)
    fitFont(g, en, 'Helvetica, Arial, sans-serif', 22, w - 60)
    g.fillText(en, w / 2, h * 0.76)
  }
}
export function facilityMaterial(k) {
  return glowMat(tex(512, 128, drawBoard(k)), 0, 0.9)
}
export function crossMaterial() {
  return glowMat(tex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'
    rr(g, 2, 2, w - 4, h - 4, 14)
    g.fill()
    g.fillStyle = '#d0101e'
    g.fillRect(w * 0.38, h * 0.14, w * 0.24, h * 0.72)
    g.fillRect(w * 0.14, h * 0.38, w * 0.72, h * 0.24)
  }), 0, 1.3)
}

export function signMaterial(t) {
  const letters = t.style === 'letters'
  if (!letters && t.style !== 'neon') {
    return glowMat(tex(768, 128, drawFascia(t, false)), 0, 1.25, { emissiveMap: tex(768, 128, drawFascia(t, true)) })
  }
  return glowMat(tex(768, 128, drawSign(t)), 0, t.style === 'neon' ? 2.2 : 1.15,
    letters ? { alphaTest: 0.35 } : {})
}
export function bladeMaterial(t) {
  return glowMat(tex(128, 256, drawBlade(t)), 0, t.style === 'neon' ? 2.0 : 0.9)
}
export function backdropMaterial(t, i) {
  return glowMat(tex(512, 256, drawBackdrop(t, 1234 + i * 97)), 0.06, 0.8)
}
export function plateMaterial(i) {
  return glowMat(tex(512, 128, drawPlate(i)), 0, 0.6)
}


// ── 巨型广告牌：canvas 画的品牌海报（8 种），夜里灯箱自发光 ──
const ADS = [
  ['#ff3b30', '#ffffff', '极光手机', 'AURORA X9', '影像旗舰 · 现已发售'],
  ['#0a84ff', '#ffffff', '蓝鲸汽水', 'BLUE WHALE', '冰爽一夏'],
  ['#111111', '#f5c542', '黑金咖啡', 'NOIR COFFEE', '每一口都醇厚'],
  ['#34c759', '#ffffff', '绿野电动', 'GREEN EV', '续航 1000km'],
  ['#ff2d92', '#ffffff', '星梦演唱会', 'DREAM TOUR 2026', '11.30 星光演艺中心'],
  ['#5e2ced', '#ffe14d', '次元动漫展', 'ANIME EXPO', '本周末 · 会展中心'],
  ['#f7f2e8', '#c8102e', '老街火锅', 'HOTPOT', '地道川味 · 24 小时'],
  ['#0f2b46', '#9fe0ff', '云端银行', 'CLOUD BANK', '你的财富 · 随时随地'],
]
function drawAd(i) {
  const [bg, fg, zh, en, tag] = ADS[i % ADS.length]
  return (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h)
    gr.addColorStop(0, bg)
    gr.addColorStop(1, shade(bg, -0.35))
    g.fillStyle = gr
    g.fillRect(0, 0, w, h)
    const r = rnd(900 + i * 31)
    g.globalAlpha = 0.18
    for (let k = 0; k < 7; k++) {
      g.fillStyle = k % 2 ? fg : '#ffffff'
      g.beginPath()
      g.arc(w * (0.55 + r() * 0.45), h * r(), h * (0.15 + r() * 0.4), 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    g.fillStyle = fg
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    fitFont(g, zh, ZH, h * 0.3, w * 0.6, '900')
    g.fillText(zh, w * 0.06, h * 0.34)
    fitFont(g, en, '"Arial Black", Helvetica, sans-serif', h * 0.14, w * 0.55)
    g.fillText(en, w * 0.06, h * 0.6)
    fitFont(g, tag, ZH, h * 0.08, w * 0.55, '600')
    g.globalAlpha = 0.85
    g.fillText(tag, w * 0.06, h * 0.78)
    g.globalAlpha = 1
    g.strokeStyle = fg
    g.lineWidth = h * 0.02
    g.strokeRect(h * 0.02, h * 0.02, w - h * 0.04, h - h * 0.04)
  }
}
function shade(hex, k) {
  const c = new THREE.Color(hex)
  c.multiplyScalar(1 + k)
  return '#' + c.getHexString()
}
export const AD_COUNT = ADS.length
export function adMaterial(i) {
  return glowMat(tex(1024, 512, drawAd(i)), 0.12, 1.25)
}

// ── 跑马灯（LED 点阵字幕条）：贴图横向循环，tick 里平移 offset 让字滚动 ──
const LED = [
  ['#ff3b1f', '欢迎光临 · 新品上市 · 全场八折 · WELCOME · '],
  ['#ffd21f', '今日特价 · 买一送一 · 营业至深夜 · OPEN 24H · '],
  ['#39ff6a', '新鲜现做 · 外卖可送 · 扫码点单 · ORDER NOW · '],
  ['#3fd2ff', '会员日双倍积分 · 欢迎品尝 · HAPPY HOUR · '],
]
export const LED_COUNT = LED.length
export function ledMaterial(i) {
  const [col, text] = LED[i % LED.length]
  const t = tex(1024, 64, (g, w, h) => {
    g.fillStyle = '#060606'
    g.fillRect(0, 0, w, h)
    // 先把字画到一张离屏图，再按点阵采样成 LED 圆点
    const c2 = document.createElement('canvas')
    c2.width = w / 4
    c2.height = h / 4
    const g2 = c2.getContext('2d')
    g2.fillStyle = '#000'
    g2.fillRect(0, 0, c2.width, c2.height)
    g2.fillStyle = '#fff'
    g2.textBaseline = 'middle'
    g2.font = `bold ${c2.height * 0.9}px ${ZH}`
    let x = 2
    while (x < c2.width) { g2.fillText(text, x, c2.height / 2 + 1); x += Math.max(40, g2.measureText(text).width) }
    let px = null
    try { px = g2.getImageData(0, 0, c2.width, c2.height).data } catch (e) { px = null }
    for (let yy = 0; yy < c2.height; yy++) {
      for (let xx = 0; xx < c2.width; xx++) {
        const on = px ? px[(yy * c2.width + xx) * 4] > 100 : (xx + yy) % 5 === 0
        g.fillStyle = on ? col : '#1a1a1a'
        g.beginPath()
        g.arc(xx * 4 + 2, yy * 4 + 2, 1.5, 0, Math.PI * 2)
        g.fill()
      }
    }
  })
  t.wrapS = THREE.RepeatWrapping
  const m = glowMat(t, 0.9, 2.2)
  return { mat: m, tex: t }
}
