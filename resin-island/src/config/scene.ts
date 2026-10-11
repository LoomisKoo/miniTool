/**
 * 场景全局常量（世界坐标，单位约为「米」，块体约 3 单位宽）
 * 布局：块体中心在原点，底部 -H/2，顶部 +H/2。
 * 水面在块体内部偏上，岛峰低于块体顶面（上方留一层清水树脂）。
 */

export const BLOCK = {
  size: 3,
  height: 1.3,
  radius: 0.15,
} as const

/** 海床顶面高度 */
export const SEABED_Y = -0.5

/** 静止水位（潮位会在此基础上偏移） */
export const WATER_Y = 0.06

/** 水面高度场平面的边长（略小于块体，避免穿出圆角） */
export const WATER_SIZE = 2.9

/** 岛地形覆盖的角部区域：x/z ∈ [0, TERRAIN_SIZE] */
export const TERRAIN_SIZE = 1.42
export const TERRAIN_SEG = 96

/** 岛的圆心与半径（在块体角部） */
export const ISLAND_CX = 0.68
export const ISLAND_CZ = 0.68
export const ISLAND_R = 0.95

/** 果冻摆动的支点（低于块体底部，使顶部摆幅大于底部） */
export const PIVOT_Y = -0.85

/** 水面高度场 uv 空间的岛心（与 PlaneGeometry 的 uv 一致） */
export const ISLAND_UV: [number, number] = [
  (ISLAND_CX + BLOCK.size / 2) / BLOCK.size,
  (BLOCK.size / 2 - ISLAND_CZ) / BLOCK.size,
]

export const ISLAND_UV_RADIUS = ISLAND_R / BLOCK.size
