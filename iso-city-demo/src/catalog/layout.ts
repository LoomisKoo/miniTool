// 图集排布：纯计算，不含 three。预览页与导出脚本都只依赖这一层。

import { CELL } from './rasterize'

export const ATLAS_SIZE = 2048
export const ATLAS_COLS = ATLAS_SIZE / CELL
export const ATLAS_CELLS = ATLAS_COLS * ATLAS_COLS
export const CELL_UV = CELL / ATLAS_SIZE

export function atlasOrigin(cell: number, size = ATLAS_SIZE) {
  const cols = size / CELL
  return { x: (cell % cols) * CELL, y: Math.floor(cell / cols) * CELL }
}

export function paintCell(target: Uint8Array, cell: number, data: Uint8Array, size = ATLAS_SIZE) {
  const cols = size / CELL
  const ox = (cell % cols) * CELL
  const oy = Math.floor(cell / cols) * CELL
  if (oy + CELL > size) return
  for (let y = 0; y < CELL; y++) {
    target.set(data.subarray(y * CELL, y * CELL + CELL), (oy + y) * size + ox)
  }
}

/**
 * 分帧构建：一次性画 960 个单元会卡住主线程约 40ms，
 * 拆成 generator 让调用方决定每帧画多少个。
 */
export function* atlasJobs(count: number, frames: number) {
  for (let i = 0; i < count; i++) {
    for (let f = 0; f < frames; f++) {
      yield { blueprint: i, frame: f, cell: i * frames + f }
    }
  }
}

export function petCell(index: number, frame: number) {
  return index * 8 + frame
}

export function fishCell(index: number, frame: number) {
  return index * 2 + frame
}
