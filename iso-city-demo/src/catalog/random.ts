// 确定性随机：不依赖 Math.random。
//
// 两个用途：野生宠物池按小时切片（同一小时所有客户端算出同一批），
// 漫游轨迹按 id 推导（刷新页面不会瞬移）。服务端也用同一套算法做校验，
// 所以这两个函数必须保持纯净、不 import 任何运行时依赖。

export function hashString(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
