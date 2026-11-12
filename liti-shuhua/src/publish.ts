/**
 * 发布：把当前跨页画成一张平面图，交给小红书的 postNote 唤起发布页。
 *
 * 为什么不直接截屏：书是 CSS 3D + preserve-3d 的 DOM，WebView 拿不到截图，
 * 而 html2canvas 这类库也不支持 3D 变换。所以这里读「当前可见页」的布局几何，
 * 把每块纸的 SVG / 图片按原位置重新画到一个 2D canvas 上——结果是摊平的两页，
 * 也就是这本书最干净的样子，拿去当笔记配图刚好。
 */
import type { Spread } from './spreads'

/** 单页尺寸，和 popup.css 里的 .pb-page 一致 */
const PAGE_W = 500
const PAGE_H = 560
/** 导出倍率：2 倍图，手机上看着不糊 */
const SCALE = 2

const XHS = () => (window as unknown as { xhs?: { miniTool?: Record<string, unknown> } }).xhs?.miniTool

function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** 把页面里的一个 SVG 单独序列化成能画的图；文档里的 #diecut 滤镜引用会失效，去掉 */
function svgUrl(svg: SVGSVGElement) {
  const vb = svg.viewBox?.baseVal
  const w = (vb && vb.width) || svg.clientWidth || 300
  const h = (vb && vb.height) || svg.clientHeight || 300
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  // 剪纸的奶油色描边滤镜定义在文档里另一个隐藏 <svg> 上，单独序列化会丢引用
  // （SVG 规定引用不到的 filter 直接不绘制）。把定义抄进这张图里。
  const die = document.querySelector('#diecut')
  if (die) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    defs.appendChild(die.cloneNode(true))
    clone.insertBefore(defs, clone.firstChild)
  } else {
    // 没有滤镜定义时宁可不要描边，也别整块消失
    const filtered = clone.querySelectorAll('[filter]')
    for (let i = 0; i < filtered.length; i++) filtered[i].removeAttribute('filter')
  }
  const xml = new XMLSerializer().serializeToString(clone)
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
}

type Box = { x: number; y: number; w: number; h: number }

/** 读一块元素在页面上「没被 3D 变换过」的布局框 */
function boxOf(el: HTMLElement): Box | null {
  const cs = el.style
  const w = parseFloat(cs.width) || el.offsetWidth
  const h = parseFloat(cs.height) || el.offsetHeight
  if (!(w > 0) || !(h > 0)) return null
  const x = parseFloat(cs.left) || 0
  const y = cs.bottom ? PAGE_H - (parseFloat(cs.bottom) || 0) - h : parseFloat(cs.top) || 0
  return { x, y, w, h }
}

/** 元素里那张能被画的纸：SVG 剪纸或上传的位图 */
function artOf(el: HTMLElement) {
  const front = el.querySelector('.pb-front') ?? el
  const svg = front.querySelector('svg')
  if (svg) return svgUrl(svg as SVGSVGElement)
  const img = front.querySelector('img')
  if (img && img.getAttribute('src')) return img.getAttribute('src')!
  return null
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 一页：纸底色 + 背景墙 + 立着的纸片 + 平铺地面 */
async function drawPage(page: HTMLElement, spread: Spread, ctx: CanvasRenderingContext2D, ox: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, 0, PAGE_W, PAGE_H)
  ctx.clip()

  ctx.fillStyle = spread.page
  ctx.fillRect(ox, 0, PAGE_W, PAGE_H)

  const kids = Array.from(page.children) as HTMLElement[]
  // 背景墙永远在最里面：先画它，再按 DOM 顺序画纸片和地面
  const ordered = [
    ...kids.filter((k) => k.classList.contains('pb-wall')),
    ...kids.filter((k) => !k.classList.contains('pb-wall')),
  ]

  for (const el of ordered) {
    if (el.classList.contains('pb-paper') || el.classList.contains('pb-dots')) continue
    if (el.classList.contains('pb-card')) continue // 正文卡片下面单独画
    const box = boxOf(el)
    if (!box) continue
    const url = artOf(el)
    if (!url) continue
    const img = await loadImage(url)
    if (img) ctx.drawImage(img, ox + box.x, box.y, box.w, box.h)
  }

  ctx.restore()
}

/** 正文卡片：左页那张手写感的纸条，用 canvas 重新排一遍 */
function drawCard(spread: Spread, ctx: CanvasRenderingContext2D, ox: number) {
  const x = ox + 34
  const y = 418
  const w = 310
  ctx.save()
  ctx.translate(x + w / 2, y)
  ctx.rotate((-2 * Math.PI) / 180)
  ctx.translate(-w / 2, 0)
  ctx.fillStyle = 'rgba(250, 240, 219, .94)'
  roundRect(ctx, 0, 0, w, 130, 4)
  ctx.fill()

  ctx.fillStyle = '#8a6a4a'
  ctx.font = '600 12px system-ui, -apple-system, "PingFang SC", sans-serif'
  ctx.fillText(spread.sub, 16, 26)

  ctx.fillStyle = '#4a3423'
  ctx.font = '15px system-ui, -apple-system, "PingFang SC", sans-serif'
  // 按像素宽度逐字折行，中文没有空格可断
  const lines: string[] = []
  let line = ''
  for (const ch of spread.text) {
    if (ctx.measureText(line + ch).width > w - 32) {
      lines.push(line)
      line = ch
      if (lines.length === 5) break
    } else line += ch
  }
  if (line && lines.length < 5) lines.push(line)
  lines.forEach((l, i) => ctx.fillText(l, 16, 52 + i * 22))
  ctx.restore()
}

/** 当前跨页 → JPEG dataURI */
export async function captureSpread(book: HTMLElement, spread: Spread) {
  const pages = Array.from(book.querySelectorAll<HTMLElement>('.pb-page')).filter((p) => {
    // visibility:hidden 仍占布局，getClientRects 也非空，必须单独排掉
    if (p.style.display === 'none' || p.style.visibility === 'hidden') return false
    // 翻页纸背面转过 180°，里面放的是下一跨页；摊平时不该被当成可见页
    if (p.closest('.pb-face.back')) return false
    return p.getClientRects().length > 0 && p.offsetWidth > 0
  })
  const left = pages.find((p) => p.classList.contains('pb-left'))
  const right = pages.find((p) => p.classList.contains('pb-right'))

  const cv = document.createElement('canvas')
  cv.width = PAGE_W * 2 * SCALE
  cv.height = PAGE_H * SCALE
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.scale(SCALE, SCALE)

  if (left) await drawPage(left, spread, ctx, 0)
  else {
    ctx.fillStyle = spread.page
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  }
  if (right) await drawPage(right, spread, ctx, PAGE_W)
  else {
    ctx.fillStyle = spread.page
    ctx.fillRect(PAGE_W, 0, PAGE_W, PAGE_H)
  }
  drawCard(spread, ctx, 0)

  return cv.toDataURL('image/jpeg', 0.92)
}

export type PublishResult = 'ok' | 'nobridge' | 'noimage'

/** 唤起小红书发布页；没注入 JSBridge（普通浏览器预览）时返回 nobridge */
export async function publishSpread(book: HTMLElement, spread: Spread): Promise<PublishResult> {
  const bridge = XHS()
  const dataUrl = await captureSpread(book, spread)
  if (!dataUrl) return 'noimage'
  if (!bridge || typeof bridge.postNote !== 'function') return 'nobridge'
  await (bridge.postNote as (o: unknown) => Promise<unknown>)({
    title: spread.title.slice(0, 20),
    content: `${spread.text}\n\n立体书 · ${spread.sub}`.slice(0, 1000),
    pageType: 'photo_publish',
    mediaInfo: { image_resources: [{ url: dataUrl }] },
  })
  return 'ok'
}
