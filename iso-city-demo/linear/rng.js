/** 可复现随机：同一 seed → 同一座城 */
export function mulberry(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function pick(rng, arr) {
  return arr[(rng() * arr.length) | 0]
}

export function range(rng, a, b) {
  return a + rng() * (b - a)
}
