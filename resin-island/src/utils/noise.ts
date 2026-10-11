/** 轻量确定性噪声工具（CPU 侧：地形高度、植被布点） */

export function clamp(x: number, lo: number, hi: number) {
  return x < lo ? lo : x > hi ? hi : x
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export function mix(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** 稳定 hash，避免 Math.sin 大数精度差异 */
function hash2(x: number, y: number) {
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return (h >>> 0) / 4294967295
}

export function rand2(x: number, y: number, seed = 0) {
  return hash2(x + seed * 71.13, y - seed * 37.77)
}

/** 二维值噪声，平滑插值 */
export function valueNoise(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return mix(mix(a, b, u), mix(c, d, u), v) * 2 - 1
}

export function fbm(x: number, y: number, octaves = 5, lacunarity = 2.0, gain = 0.5) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq) * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

/** 脊状噪声：制造陡峭崖壁的锐利褶皱，输出 0..1 */
export function ridged(x: number, y: number, octaves = 4) {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq))
    sum += n * n * amp
    norm += amp
    amp *= 0.5
    freq *= 2.07
  }
  return sum / norm
}
