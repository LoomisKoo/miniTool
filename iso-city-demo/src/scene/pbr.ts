import * as THREE from 'three'

// 程序化 PBR 贴图。
//
// 之前所有材质都只有一张颜色贴图，光照打上去就是"平的塑料"：
// 沥青没有颗粒起伏、砖缝没有凹凸、窗户边缘没有倒角，所以再怎么调光都假。
//
// 这里用同一份 height 场派生出 normal 和 roughness：
//   * normal 让掠射光在表面拉出细碎高光（街道质感的主要来源）
//   * roughness 让水洼、玻璃、金属在同一张图上分出干湿与新旧
// 全部走 canvas，不引入外部资源。

function finalize(texture: THREE.Texture, anisotropy = 16) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = anisotropy
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function canvas2d(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return { canvas, ctx: canvas.getContext('2d')! }
}

/** 灰度 canvas → 浮点高度场（0..1）。 */
function heightsOf(canvas: HTMLCanvasElement, size: number) {
  const ctx = canvas.getContext('2d')!
  const data = ctx.getImageData(0, 0, size, size).data
  const out = new Float32Array(size * size)
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4] / 255
  return out
}

/** 中央差分求切线空间法线；Y 轴按 three 的 OpenGL 约定处理。 */
function heightToNormal(heights: Float32Array, size: number, strength: number) {
  const { canvas, ctx } = canvas2d(size)
  const image = ctx.createImageData(size, size)
  const at = (x: number, y: number) =>
    heights[((y + size) % size) * size + ((x + size) % size)]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = at(x + 1, y) - at(x - 1, y)
      const dy = at(x, y + 1) - at(x, y - 1)
      let nx = -dx * strength
      let ny = dy * strength
      let nz = 1
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len
      ny /= len
      nz /= len
      const i = (y * size + x) * 4
      image.data[i] = Math.round((nx * 0.5 + 0.5) * 255)
      image.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      image.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return finalize(new THREE.CanvasTexture(canvas))
}

/** 灰度高度 + 可选的低频水洼遮罩 → 粗糙度贴图。 */
function heightsToRoughness(
  heights: Float32Array,
  size: number,
  base: number,
  contrast: number,
  wet?: (x: number, y: number) => number,
) {
  const { canvas, ctx } = canvas2d(size)
  const image = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = heights[y * size + x]
      // 低处更容易积水；再叠一层低频湿度，形成斑驳的干湿边界
      let value = base + (0.5 - h) * contrast
      if (wet) value = THREE.MathUtils.lerp(value, 0.08, wet(x, y))
      const v = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255)
      const i = (y * size + x) * 4
      image.data[i] = v
      image.data[i + 1] = v
      image.data[i + 2] = v
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return finalize(new THREE.CanvasTexture(canvas))
}

function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/** 可无缝平铺的 value noise。cells 越大频率越高（越细）。 */
function tileNoise(size: number, cells: number, seed: number) {
  const grid = new Float32Array(cells * cells)
  for (let i = 0; i < grid.length; i++) grid[i] = hash2(i + seed * 13.7, seed * 7.31)
  const wrap = (v: number) => ((v % cells) + cells) % cells
  const at = (x: number, y: number) => grid[wrap(y) * cells + wrap(x)]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  return (px: number, py: number) => {
    const fx = (px / size) * cells
    const fy = (py / size) * cells
    const ix = Math.floor(fx)
    const iy = Math.floor(fy)
    const tx = smooth(fx - ix)
    const ty = smooth(fy - iy)
    const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx
    const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx
    return top + (bottom - top) * ty
  }
}

/**
 * 分形高度场。
 *
 * 沥青的骨料必须落在「毫米到厘米」这一档：原来用 1~3px 的方块当骨料，
 * 在 12m 的贴图跨度里一颗就是 14cm，等于把碎石子放大成鹅卵石，
 * 每颗都有独立的法线高光——远处看就是一片沸腾的泡泡。
 * 改成多倍频噪声之后，颗粒密度是连续的，读起来才是"路面"。
 */
function fbmHeights(size: number, seed: number, octaves: number, baseCells: number) {
  const layers: Array<{ fn: (x: number, y: number) => number; amp: number }> = []
  let amp = 1
  let cells = baseCells
  let total = 0
  for (let o = 0; o < octaves; o++) {
    layers.push({ fn: tileNoise(size, cells, seed + o * 3.17), amp })
    total += amp
    amp *= 0.52
    cells *= 2
  }
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0
      for (const l of layers) v += l.fn(x, y) * l.amp
      out[y * size + x] = v / total
    }
  }
  return out
}

/** 低频噪声：水洼、污渍这类尺度在几米以上的变化。
    必须首尾相接（wrap 到 cells 网格），否则贴图平铺处会出现一条笔直的接缝，
    整片地面就变成一格一格的。 */
function lowFreq(x: number, y: number, cells = 4) {
  const fx = (x / 256) * cells
  const fy = (y / 256) * cells
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const wrap = (v: number) => ((v % cells) + cells) % cells
  const a = hash2(wrap(ix), wrap(iy))
  const b = hash2(wrap(ix + 1), wrap(iy))
  const c = hash2(wrap(ix), wrap(iy + 1))
  const d = hash2(wrap(ix + 1), wrap(iy + 1))
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, sx),
    THREE.MathUtils.lerp(c, d, sx),
    sy,
  )
}

const SIZE = 256

export type SurfaceMaps = {
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
  dispose: () => void
}

/**
 * 铺装砖：缝是凹下去的，砖面有轻微磨损。
 * 贴图与 makePavingTexture 同为 256、同样的 128px 网格，采样能对齐。
 */
export function makePavingMaps(wet = false): SurfaceMaps {
  const { canvas, ctx } = canvas2d(SIZE)
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < 260; i++) {
    const v = 96 + Math.floor(Math.random() * 70)
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 3, 3)
  }
  // 砖缝
  ctx.fillStyle = '#303030'
  for (let i = 0; i <= SIZE; i += 128) {
    ctx.fillRect(i - 1, 0, 3, SIZE)
    ctx.fillRect(0, i - 1, SIZE, 3)
  }
  const heights = heightsOf(canvas, SIZE)
  // 砖缝是 3px 宽、对应 14cm，法线强度不能高：一旦超过 1.5，
  // 整片铺装在斜视下会变成"搓衣板"。
  const normalMap = heightToNormal(heights, SIZE, 1.05)
  // 干湿分布不再烘进贴图：贴图是 9m 一平铺，烘进去的水洼就变成"每 9m 一格"
  // 的方块。改由材质在世界坐标里实时算低频噪声（见 Ground 的 pavingMaterial），
  // 斑块尺度不再受贴图平铺限制。
  const roughnessMap = heightsToRoughness(heights, SIZE, wet ? 0.86 : 0.88, wet ? 0.08 : 0.1)
  return {
    normalMap,
    roughnessMap,
    dispose: () => {
      normalMap.dispose()
      roughnessMap.dispose()
    },
  }
}

/** 沥青：细骨料颗粒 + 轻微平整度起伏；湿路面上水洼会变成近镜面。
 *
 * 关键的三个数字：
 *   * 法线强度 0.55 —— 超过 1 就会把颗粒放大成石子，路看起来在沸腾；
 *   * 粗糙度对比 0.06 —— 沥青整体是哑光的，只有水洼该亮；
 *   * 水洼覆盖率必须低 —— 大面积湿膜会让整条街变成镜子。
 */
export function makeAsphaltMaps(base = 0.5, wet = false): SurfaceMaps {
  // 细颗粒（高频）+ 铺装起伏（低频），两层拼起来才有真实的沥青。
  // baseCells 80 → 主频约 3px，uTile=8 时一颗骨料约 10cm，再往下走两档倍频
  // 补出 5cm / 2.5cm 的细砂感。
  const grain = fbmHeights(SIZE, 11.3, 3, 80)
  const undulate = fbmHeights(SIZE, 3.7, 2, 5)
  const heights = new Float32Array(SIZE * SIZE)
  for (let i = 0; i < heights.length; i++) {
    // 大尺度起伏只留一点点：它的周期约 1.6m，正好能看出 8m 平铺的重复，
  // 拉高只会让路面读成"一格一格的凹凸"。
  heights[i] = 0.5 + (grain[i] - 0.5) * 0.5 + (undulate[i] - 0.5) * 0.14
  }

  const normalMap = heightToNormal(heights, SIZE, 0.75)
  // 水洼同样不进贴图：贴图 8m 一平铺，烘进去就是一张 8m 网格的湿斑。
  // 湿痕由着色器用世界坐标噪声算，尺度可以做到十几米。
  // 沥青的粗糙度整体抬高：map 里的值就是最终粗糙度，base 给低了整条路都会反光。
  const roughnessMap = heightsToRoughness(heights, SIZE, 0.97 - base * 0.04, 0.05)
  return {
    normalMap,
    roughnessMap,
    dispose: () => {
      normalMap.dispose()
      roughnessMap.dispose()
    },
  }
}

/** 混凝土/抹灰：大面积细颗粒，用于立面、室内墙、走廊。 */
export function makeConcreteMaps(contrast = 0.5): SurfaceMaps {
  const { canvas, ctx } = canvas2d(SIZE)
  ctx.fillStyle = '#828282'
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < 5200; i++) {
    const v = 118 + Math.floor(Math.random() * 44)
    ctx.fillStyle = `rgba(${v},${v},${v},0.22)`
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1.5, 1.5)
  }
  // 轻微的气泡/麻点
  for (let i = 0; i < 90; i++) {
    const r = 0.6 + Math.random() * 1.2
    ctx.fillStyle = 'rgba(96,96,96,0.22)'
    ctx.beginPath()
    ctx.arc(Math.random() * SIZE, Math.random() * SIZE, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const heights = heightsOf(canvas, SIZE)
  // 混凝土是抹平的：法线只负责极细的砂粒感，绝不能出现"麻面"
  const normalMap = heightToNormal(heights, SIZE, 0.4 * contrast)
  const roughnessMap = heightsToRoughness(heights, SIZE, 0.92, 0.05)
  return {
    normalMap,
    roughnessMap,
    dispose: () => {
      normalMap.dispose()
      roughnessMap.dispose()
    },
  }
}

/** 玻璃幕墙：竖向分格 + 轻微反光不均，避免整片镜面像塑料板。 */
export function makeGlassMaps(): SurfaceMaps {
  const { canvas, ctx } = canvas2d(SIZE)
  ctx.fillStyle = '#9a9a9a'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#6a6a6a'
  for (let i = 0; i < SIZE; i += 32) ctx.fillRect(i, 0, 2, SIZE)
  for (let i = 0; i < SIZE; i += 64) ctx.fillRect(0, i, SIZE, 1)
  const heights = heightsOf(canvas, SIZE)
  const normalMap = heightToNormal(heights, SIZE, 1.4)
  const roughnessMap = heightsToRoughness(heights, SIZE, 0.16, 0.1, (x, y) => {
    // 局部脏污：幕墙不可能每块玻璃一样干净
    return THREE.MathUtils.smoothstep(lowFreq(x, y, 5), 0.6, 0.85) * 0.35
  })
  return {
    normalMap,
    roughnessMap,
    dispose: () => {
      normalMap.dispose()
      roughnessMap.dispose()
    },
  }
}
