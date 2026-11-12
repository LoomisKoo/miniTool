import * as THREE from 'three'

/** 统一纹理设置：高各向异性 + mipmap，远处的细线才不会变成摩尔纹噪点。 */
function finalize(texture: THREE.Texture, anisotropy = 16) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = anisotropy
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function canvas2d(size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return { canvas, ctx: canvas.getContext('2d')! }
}

export function makePavingTexture(tint = '#d6d2c7', line = '#bdb8aa') {
  const { canvas, ctx } = canvas2d(256)
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 220; i++) {
    const v = 190 + Math.floor(Math.random() * 40)
    ctx.fillStyle = `rgba(${v},${v - 4},${v - 12},${0.03 + Math.random() * 0.04})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4)
  }
  ctx.strokeStyle = line
  // 缝更淡更细：远景读成柔和的分格，而不是一片跳动的白线。
  ctx.globalAlpha = 0.3
  ctx.lineWidth = 1.5
  for (let i = 0; i <= 256; i += 128) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 256)
    ctx.moveTo(0, i)
    ctx.lineTo(256, i)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return finalize(texture, 16)
}

export function makeAsphaltTexture(base = '#393d3e', speck = 1) {
  const { canvas, ctx } = canvas2d(256)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) {
    const v = Math.floor((44 + Math.random() * 34) * speck)
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 2},${0.1 + Math.random() * 0.12})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3)
  }
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = 'rgba(28,30,31,.22)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(Math.random() * 256, 0)
    ctx.lineTo(Math.random() * 256, 256)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return finalize(texture, 16)
}

export function makeSignTexture(text: string, background = '#31514c') {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = 'rgba(255,245,225,.55)'
  ctx.lineWidth = 6
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36)
  ctx.fillStyle = '#f8f0df'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 92px "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4, canvas.width - 100)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

const ART_STOPS: Record<string, string[]> = {
  dawn: ['#f4d6b4', '#e0a17f', '#a27070', '#5d7189'],
  coast: ['#e8efea', '#a9c6c6', '#6f9aa0', '#3f5d6a'],
  meadow: ['#eee9d2', '#c4c79d', '#8da07c', '#586a5b'],
  signal: ['#efe0c8', '#c99766', '#8d6b58', '#3e5961'],
  night: ['#2c3c4b', '#596b84', '#a78e70', '#e2c08d'],
  clay: ['#efddcb', '#d0a488', '#a87462', '#6d5750'],
}

export function makeArtTexture(palette: string, variant = 0) {
  const colors = ART_STOPS[palette] || ART_STOPS.dawn
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 800
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, colors[0])
  gradient.addColorStop(0.55, colors[1])
  gradient.addColorStop(1, colors[3])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.globalAlpha = 0.7
  for (let i = 0; i < 5; i++) {
    const x = 80 + Math.random() * 480
    const y = 100 + Math.random() * 540
    const r = 80 + Math.random() * 230
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
    glow.addColorStop(0, colors[2])
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 0.85
  ctx.fillStyle = colors[2]
  ctx.fillRect(0, 520 + variant * 22, canvas.width, 10)
  ctx.fillRect(0, 548 + variant * 22, canvas.width * 0.62, 4)
  ctx.globalAlpha = 0.25
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = '#2f2e2b'
    ctx.fillRect(0, Math.random() * 800, 640, 1)
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** 光池贴图按颜色缓存：整城几十个门口，每个都画一张 128px canvas 是全屏卡顿的来源之一。 */
const glowCache = new Map<string, THREE.CanvasTexture>()

export function makeGlowTexture(color = '#ffd9a0') {
  const hit = glowCache.get(color)
  if (hit) return hit
  const { canvas, ctx } = canvas2d(128)
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.35, color)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  glowCache.set(color, texture)
  return texture
}

/** 室内木地板：长条拼板 + 板缝 + 木纹，颜色跟随空间配色。 */
export function makeFloorTexture(base = '#c9b79a', dark = '#8f7d63') {
  const { canvas, ctx } = canvas2d(512)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 512)
  const plankH = 64
  const rnd = (i: number) => {
    const v = Math.sin(i * 127.1) * 43758.5453
    return v - Math.floor(v)
  }
  for (let row = 0; row < 512 / plankH; row++) {
    const offset = (row % 2) * 128
    for (let col = -1; col < 3; col++) {
      const x = col * 256 + offset
      const tint = 0.9 + rnd(row * 7 + col) * 0.2
      ctx.globalAlpha = 0.5
      ctx.fillStyle = tint > 1 ? '#ffffff' : dark
      ctx.fillRect(x + 2, row * plankH + 2, 252, plankH - 4)
      ctx.globalAlpha = 1
      // 木纹
      ctx.strokeStyle = 'rgba(90,70,50,0.12)'
      ctx.lineWidth = 1
      for (let g = 0; g < 5; g++) {
        const gy = row * plankH + 8 + rnd(row * 3 + col * 5 + g) * (plankH - 16)
        ctx.beginPath()
        ctx.moveTo(x + 6, gy)
        ctx.bezierCurveTo(x + 80, gy + 4, x + 170, gy - 5, x + 250, gy + 2)
        ctx.stroke()
      }
    }
    ctx.strokeStyle = 'rgba(60,45,32,0.22)'
    ctx.beginPath()
    ctx.moveTo(0, row * plankH)
    ctx.lineTo(512, row * plankH)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return finalize(tex)
}

/** 室内墙面：极细的涂料颗粒，避免大面积纯色像塑料。 */
export function makeWallTexture(base = '#e6e1d8') {
  const { canvas, ctx } = canvas2d(256)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 5200; i++) {
    const a = 0.02 + Math.random() * 0.05
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(80,75,66,${a})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return finalize(tex)
}

/** 一朵云絮：几块实心白圆用 blur 糊在一起堆出团块轮廓，
    再整体收边。关键是"先在高分辨率画、再降采样"：
    直接在 256 上叠渐变，alpha 只有 8bit，边缘会出现一圈一圈的色阶点，
    放大到屏幕上就是那些密集的噪点。 */
export function makeCloudTexture() {
  const final = 256
  const ss = 4 // 超采样倍数
  const size = final * ss
  const work = canvas2d(size)
  const mid = size / 2
  const ctx = work.ctx

  // 固定序列：热更新时形状不变，不会闪一下
  let seed = 20261023
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  // 团块边缘用 blur 软化，而不是靠多层半透明渐变叠加。
  // 叠加会把 alpha 累加到 1 附近，量化后就是可见的环状色阶。
  ctx.filter = `blur(${Math.round(size * 0.012)}px)`
  ctx.fillStyle = '#ffffff'
  const lobes = 18
  for (let i = 0; i < lobes; i++) {
    const angle = rnd() * Math.PI * 2
    const distance = Math.sqrt(rnd()) * size * 0.27
    const x = mid + Math.cos(angle) * distance
    const y = mid + Math.sin(angle) * distance
    const r = size * (0.15 + rnd() * 0.13)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.filter = 'none'

  // 整体收边：同样用 blur 过的圆当遮罩，边缘是连续灰阶而不是硬边
  ctx.globalCompositeOperation = 'destination-in'
  const maskCtx = canvas2d(size)
  maskCtx.ctx.filter = `blur(${Math.round(size * 0.026)}px)`
  maskCtx.ctx.fillStyle = '#ffffff'
  maskCtx.ctx.beginPath()
  maskCtx.ctx.arc(mid, mid, size * 0.43, 0, Math.PI * 2)
  maskCtx.ctx.fill()
  maskCtx.ctx.filter = 'none'
  ctx.drawImage(maskCtx.canvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'

  // 降采样：超采样累积的灰阶在这里被平均掉，噪点消失
  const out = canvas2d(final)
  out.ctx.imageSmoothingEnabled = true
  out.ctx.imageSmoothingQuality = 'high'
  out.ctx.drawImage(work.canvas, 0, 0, final, final)

  const texture = new THREE.CanvasTexture(out.canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

/** 入口光柱：竖直方向从亮到透明的一张渐变，用来做传送门的软光。 */
export function makeBeamTexture() {
  const { canvas, ctx } = canvas2d(64)
  const vertical = ctx.createLinearGradient(0, 0, 0, 64)
  vertical.addColorStop(0, 'rgba(255,255,255,0)')
  vertical.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  vertical.addColorStop(1, 'rgba(255,255,255,0.95)')
  ctx.fillStyle = vertical
  ctx.fillRect(0, 0, 64, 64)
  // 横向也要收边，否则贴到 Sprite 上就是一个发光的矩形
  ctx.globalCompositeOperation = 'destination-in'
  const horizontal = ctx.createLinearGradient(0, 0, 64, 0)
  horizontal.addColorStop(0, 'rgba(255,255,255,0)')
  horizontal.addColorStop(0.5, 'rgba(255,255,255,1)')
  horizontal.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = horizontal
  ctx.fillRect(0, 0, 64, 64)
  ctx.globalCompositeOperation = 'source-over'
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** 灰阶颗粒：草地、铺装、屋顶用同一张，靠顶点色决定最终颜色。 */
/**
 * 细颗粒"细节贴图"：给地面/屋面加一点噪声，避免一整块纯色。
 *
 * 注意它会被当作 colorMap 乘到材质颜色上，所以必须接近白色（1.0）。
 * 以前底色是 #808080，等价于把材质颜色乘 0.216——屋顶和地面被凭空压掉
 * 八成亮度，夜里看就是一片纯黑，怎么加灯都救不回来。
 */
export function makeGrainTexture(size = 512, contrast = 0.14, blobs = 900) {
  const { canvas, ctx } = canvas2d(size)
  ctx.fillStyle = '#ececec'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < blobs; i++) {
    const v = Math.round(232 + (Math.random() - 0.5) * 255 * contrast * 0.6)
    const r = 2 + Math.random() * 14
    ctx.fillStyle = `rgba(${v},${v},${v},0.22)`
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return finalize(texture, 8)
}

/**
 * 叶簇：一张带透明通道的枝叶片，贴在交叉平面上。
 *
 * 行道树如果只用一个多面体，剪影是"绿球"，任何光照都救不回来。
 * 真实感的来源是镂空的轮廓、叶片之间的空隙，以及透过叶子漏下来的光。
 * 这里用 260 片随机椭圆叶拼成一团，外包 alphaTest 的卡片，近景能看到
 * 一片片的叶子，远景 mipmap 会自然融成蓬松的一团。
 */
export function makeLeafClusterTexture(seed = 1) {
  const size = 512
  const { canvas, ctx } = canvas2d(size)
  let state = seed * 9301 + 49297
  const rand = () => {
    state = (state * 9301 + 49297) % 233280
    return state / 233280
  }
  const center = size / 2
  for (let i = 0; i < 300; i++) {
    // 半径用 pow 偏置：中心密、外缘疏，剪影才有毛边
    const r = Math.pow(rand(), 0.62) * (center - 24)
    const a = rand() * Math.PI * 2
    const x = center + Math.cos(a) * r
    const y = center + Math.sin(a) * r * 0.92
    const len = 15 + rand() * 24
    const wide = len * (0.34 + rand() * 0.2)
    const rot = rand() * Math.PI
    // 受光面偏黄绿，背光面偏墨绿；再掺一点秋色，避免整团一个色号
    const hue = 96 + rand() * 26
    const light = 22 + rand() * 24 + (1 - r / center) * 10
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.fillStyle = `hsl(${hue} 34% ${light}%)`
    ctx.beginPath()
    ctx.ellipse(0, 0, len / 2, wide / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    // 叶脉：一条更亮的细线，远景看不出来，近景能救回"塑料片"的观感
    ctx.strokeStyle = `hsl(${hue} 30% ${light + 14}% / 0.7)`
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(-len / 2 + 2, 0)
    ctx.lineTo(len / 2 - 2, 0)
    ctx.stroke()
    ctx.restore()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return finalize(texture, 8)
}

/** 接触阴影：中心深、边缘完全透明。铺在树和路灯下面，让物体"压"在地面上。 */
export function makeContactShadowTexture(size = 128, softness = 0.42) {  const { canvas, ctx } = canvas2d(size)
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(0,0,0,0.85)')
  gradient.addColorStop(softness, 'rgba(0,0,0,0.5)')
  gradient.addColorStop(0.78, 'rgba(0,0,0,0.14)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * 水面法线贴图：几组整数频率的正弦叠加，天生无缝平铺。
 *
 * 为什么需要它：水面如果只有 roughness 很小的光滑表面，平行光会在上面打出一个
 * 又小又亮的椭圆高光（夜里看起来像一团鬼火）。加了法线扰动后，高光被打散成一条
 * 粼粼的光路，才是水该有的样子。
 */
export function makeWaterNormalTexture(size = 256, strength = 1) {
  const { canvas, ctx } = canvas2d(size)
  const image = ctx.createImageData(size, size)
  const data = image.data

  // 频率必须是整数，平铺时才不会在接缝处跳变
  const waves = [
    { ax: 1, az: 2, amp: 1.0, phase: 0.0 },
    { ax: 3, az: -1, amp: 0.55, phase: 1.3 },
    { ax: -2, az: 5, amp: 0.3, phase: 2.6 },
    { ax: 6, az: 3, amp: 0.16, phase: 0.9 },
    { ax: 9, az: -7, amp: 0.08, phase: 4.1 },
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0
      let dz = 0
      for (const w of waves) {
        const t =
          ((x / size) * w.ax + (y / size) * w.az) * Math.PI * 2 + w.phase
        const c = Math.cos(t) * w.amp
        dx += c * w.ax
        dz += c * w.az
      }
      // 归一到 [-1,1] 再缩放，太强的法线会让水面像揉皱的锡纸
      const nx = dx * 0.11 * strength
      const nz = dz * 0.11 * strength
      const len = Math.hypot(nx, nz, 1)
      const index = (y * size + x) * 4
      data[index] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
      data[index + 1] = Math.round(((nz / len) * 0.5 + 0.5) * 255)
      data[index + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
      data[index + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  // 法线贴图不能当颜色空间处理
  texture.colorSpace = THREE.NoColorSpace
  return finalize(texture, 8)
}

const shopWindowCache = new Map<string, THREE.CanvasTexture>()

/** 橱窗"店内"：一张画好的暖光内景，替掉以前那张靠透明度叠出来的玻璃板。
    半透明大平面在夜里只会被读成一块矩形遮罩；有货架、柜台、灯槽的
    内景才像一间开着门的店。贴图按 4 个变体缓存，几十栋楼共用 4 张。 */
export function makeShopWindowTexture(night = true, variant = 0) {
  const key = `${night ? 'n' : 'd'}${variant % 4}`
  const cached = shopWindowCache.get(key)
  if (cached) return cached

  const w = 512
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  let state = 1000 + variant * 7919
  const rnd = () => {
    state = (state * 9301 + 49297) % 233280
    return state / 233280
  }

  const wallTop = night ? '#343a42' : '#8f979d'
  const wallBottom = night ? '#0a0d12' : '#333c43'
  const warm = night ? '#ffd8a2' : '#efeade'

  // 后墙：上亮下暗
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, wallTop)
  bg.addColorStop(0.5, night ? '#1b2028' : '#6b747b')
  bg.addColorStop(1, wallBottom)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // 灯槽打在墙上的一团暖光
  const lamp = ctx.createRadialGradient(w * 0.5, 40, 8, w * 0.5, 40, 210)
  lamp.addColorStop(0, night ? 'rgba(255,224,176,0.75)' : 'rgba(255,255,255,0.3)')
  lamp.addColorStop(0.45, night ? 'rgba(255,198,138,0.24)' : 'rgba(255,255,255,0.1)')
  lamp.addColorStop(1, 'rgba(255,200,140,0)')
  ctx.fillStyle = lamp
  ctx.fillRect(0, 0, w, h)

  // 天花板灯槽
  ctx.fillStyle = warm
  ctx.fillRect(64, 30, w - 128, 5)
  ctx.globalAlpha = 0.35
  ctx.fillRect(64, 35, w - 128, 2)
  ctx.globalAlpha = 1

  // 两层货架 + 货品剪影，让"店内"有进深
  for (let row = 0; row < 2; row++) {
    const y = 108 + row * 46
    ctx.fillStyle = night ? 'rgba(10,12,16,0.85)' : 'rgba(40,46,52,0.75)'
    ctx.fillRect(70, y, w - 140, 4)
    let x = 78
    while (x < w - 96) {
      const bw = 6 + rnd() * 12
      const bh = 8 + rnd() * 18
      ctx.fillStyle =
        night && rnd() > 0.55
          ? ['#c8a273', '#8ea0a6', '#a9869b', '#c2b183'][Math.floor(rnd() * 4)]
          : night
            ? 'rgba(40,46,54,0.9)'
            : 'rgba(70,78,86,0.9)'
      ctx.fillRect(x, y - bh, bw, bh)
      x += bw + 6 + rnd() * 10
    }
  }

  // 柜台：站在门口看到的那道横向暗部
  ctx.fillStyle = night ? '#0d1116' : '#39424a'
  ctx.fillRect(56, 196, w - 112, 60)
  ctx.fillStyle = night ? 'rgba(255,214,160,0.5)' : 'rgba(255,255,255,0.25)'
  ctx.fillRect(56, 196, w - 112, 2)

  // 玻璃反光：几道很淡的斜向高光，说明这是一层玻璃而不是敞开的洞
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 3; i++) {
    const x = 60 + rnd() * (w - 120)
    const g = ctx.createLinearGradient(x, 0, x + 90, h)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, night ? 'rgba(190,225,255,0.055)' : 'rgba(255,255,255,0.09)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, 90, h)
  }
  ctx.globalCompositeOperation = 'source-over'

  // 四周压暗：贴图边缘直接融进窗框，不会出现一条硬边
  const edge = ctx.createLinearGradient(0, 0, 0, h)
  edge.addColorStop(0, 'rgba(0,0,0,0.55)')
  edge.addColorStop(0.18, 'rgba(0,0,0,0)')
  edge.addColorStop(0.86, 'rgba(0,0,0,0)')
  edge.addColorStop(1, 'rgba(0,0,0,0.7)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, w, h)
  const side = ctx.createLinearGradient(0, 0, w, 0)
  side.addColorStop(0, 'rgba(0,0,0,0.6)')
  side.addColorStop(0.1, 'rgba(0,0,0,0)')
  side.addColorStop(0.9, 'rgba(0,0,0,0)')
  side.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = side
  ctx.fillRect(0, 0, w, h)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 8
  shopWindowCache.set(key, texture)
  return texture
}
