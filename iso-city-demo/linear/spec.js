/** 线性超级城市 · 阶段一已定尺度 */

/** 城内可走面绝对高度：人物脚底、建筑底、路面顶都对齐这里 */
export const SURFACE = 0

export const W = {
  /** 城墙内侧之间净宽 */
  cityWidth: 5_000,
  wallHeight: 550,
  wallThick: 300,
  /** 样板段长（宽度不变，沿 Z 拉长） */
  segmentLength: 5_000,
  /** 墙外自然带平均宽度（沿 Z 会起伏） */
  natureMean: 560,
  natureAmp: 220,
  /** 中央景观河（非全程大江） */
  riverWidth: 160,
  topRoadW: 36,
  topCanalW: 64,
  topWalkW: 14,
  avenueW: 32,
  streetW: 18,
  blockTarget: 140,
}

/** 派生：整岛建筑主体半宽（含墙） */
export function islandHalf() {
  return W.cityWidth / 2 + W.wallThick
}

export function wallBounds(side) {
  const halfCity = W.cityWidth / 2
  if (side === 'left') {
    return {
      side: -1,
      xInner: -halfCity,
      xOuter: -halfCity - W.wallThick,
      cx: -halfCity - W.wallThick / 2,
    }
  }
  return {
    side: 1,
    xInner: halfCity,
    xOuter: halfCity + W.wallThick,
    cx: halfCity + W.wallThick / 2,
  }
}

/** 墙外自然带宽度（随纵向变化，保持狭长岛轮廓） */
export function natureWidth(z, side = -1) {
  const u = (z / W.segmentLength) * Math.PI * 2
  const wobble = Math.sin(u * 1.1 + side) * W.natureAmp * 0.55
    + Math.sin(u * 2.3 - side) * W.natureAmp * 0.35
  return Math.max(220, W.natureMean + wobble)
}
