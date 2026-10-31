/**
 * 裁剪模型：图片先按 cover 铺满裁剪框，再整体缩放 zoom 倍，再平移 (x, y)。
 * x / y 的单位是裁剪框宽高的比例，所以同一套参数在任何尺寸下都能复现同样的构图：
 * 屏幕上的裁剪预览、最终烘成的位图用的都是这里的 frame()。
 */
export type Crop = { zoom: number; x: number; y: number }

export const FIT: Crop = { zoom: 1, x: 0, y: 0 }
export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export type Frame = { dx: number; dy: number; dw: number; dh: number }

/** 图片在 W×H 裁剪框里应该画在哪、画多大 */
export function frame(iw: number, ih: number, W: number, H: number, c: Crop): Frame {
  const k = Math.max(W / iw, H / ih) * c.zoom
  const dw = iw * k
  const dh = ih * k
  return { dx: (W - dw) / 2 + c.x * W, dy: (H - dh) / 2 + c.y * H, dw, dh }
}

/** 把缩放和平移夹在“图片始终铺满裁剪框”的范围内 */
export function clampCrop(iw: number, ih: number, W: number, H: number, c: Crop): Crop {
  const zoom = clamp(c.zoom, MIN_ZOOM, MAX_ZOOM)
  if (!W || !H) return { ...c, zoom }
  const k = Math.max(W / iw, H / ih) * zoom
  const maxX = Math.max(0, (iw * k - W) / 2) / W
  const maxY = Math.max(0, (ih * k - H) / 2) / H
  return { zoom, x: clamp(c.x, -maxX, maxX), y: clamp(c.y, -maxY, maxY) }
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** 选一张本地图片，返回地址和原始尺寸 */
export function pickFile() {
  return new Promise<{ src: string; w: number; h: number } | null>((resolve) => {
    const el = document.createElement('input')
    el.type = 'file'
    el.accept = 'image/*'
    el.style.display = 'none'
    // 挂在 body 上再点：部分浏览器对游离节点的 click() 不弹选择器
    document.body.appendChild(el)
    const done = (v: { src: string; w: number; h: number } | null) => {
      el.remove()
      resolve(v)
    }
    el.onchange = async () => {
      const file = el.files?.[0]
      if (!file) return done(null)
      const src = URL.createObjectURL(file)
      try {
        const img = await loadImage(src)
        done({ src, w: img.naturalWidth, h: img.naturalHeight })
      } catch {
        done(null)
      }
    }
    el.addEventListener('cancel', () => done(null))
    el.click()
  })
}

function canvasOf(w: number, h: number) {
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(w))
  cv.height = Math.max(1, Math.round(h))
  const g = cv.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  // 只在图片没铺满时露出来，取纸色而不是黑色
  g.fillStyle = '#f4ecd8'
  g.fillRect(0, 0, cv.width, cv.height)
  return { cv, g }
}

function draw(g: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, c: Crop) {
  const f = frame(img.naturalWidth, img.naturalHeight, W, H, c)
  g.drawImage(img, f.dx, f.dy, f.dw, f.dh)
}

/** 按裁剪参数烘一张 W×H 的位图 */
export async function bake(src: string, W: number, H: number, c: Crop) {
  const img = await loadImage(src)
  const { cv, g } = canvasOf(W, H)
  draw(g, img, cv.width, cv.height, c)
  return cv.toDataURL('image/jpeg', 0.92)
}

/** 整张背景：按 fullW×fullH 烘一次，再从中间切成左右两半 */
export async function bakeHalves(src: string, fullW: number, fullH: number, c: Crop) {
  const img = await loadImage(src)
  const { cv, g } = canvasOf(fullW, fullH)
  draw(g, img, cv.width, cv.height, c)
  const half = cv.width / 2
  const cut = (sx: number) => {
    const { cv: out, g: og } = canvasOf(half, cv.height)
    og.drawImage(cv, sx, 0, half, cv.height, 0, 0, half, cv.height)
    return out.toDataURL('image/jpeg', 0.92)
  }
  return [cut(0), cut(half)] as const
}
