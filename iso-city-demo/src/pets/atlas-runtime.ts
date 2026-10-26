// 运行时图集：把若干「图鉴之外的组合」（野生宠物）画进一张小图集。
//
// 为什么不用主图集：图鉴的 120 个蓝图已经占满 2048²。野生宠物是随机组合，
// 每小时整批换，只能单独画。1024² / 64px = 256 格，装 12 只 × 8 帧 = 96 格。

import * as THREE from 'three'
import { CELL, PET_FRAMES, rasterizePet } from '../catalog/rasterize'
import { paintCell } from '../catalog/layout'
import type { PetRecipe } from '../catalog/recipes'

export const RUNTIME_ATLAS = 1024
export const RUNTIME_COLS = RUNTIME_ATLAS / CELL

export type RuntimeAtlas = {
  /** 索引图（R8）：每像素 = 1 + slot + 16 * shade，0 = 透明 */
  index: THREE.DataTexture
  /** 调色板 LUT：8 × N */
  palette: THREE.DataTexture
  rows: number
  cellUv: number
  cols: number
  dispose: () => void
}

export function buildRuntimeAtlas(recipes: PetRecipe[], palettes: string[][]): RuntimeAtlas {
  const buffer = new Uint8Array(RUNTIME_ATLAS * RUNTIME_ATLAS)

  recipes.forEach((recipe, i) => {
    for (let f = 0; f < PET_FRAMES; f++) {
      paintCell(buffer, i * PET_FRAMES + f, rasterizePet(recipe, f), RUNTIME_ATLAS)
    }
  })

  const index = new THREE.DataTexture(
    buffer as unknown as Uint8Array<ArrayBuffer>,
    RUNTIME_ATLAS,
    RUNTIME_ATLAS,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  )
  index.magFilter = THREE.NearestFilter
  // 索引图不能生成 mipmap：相邻格子的槽位号会混在一起，远处会闪出别的颜色
  index.minFilter = THREE.NearestFilter
  index.generateMipmaps = false
  index.wrapS = THREE.ClampToEdgeWrapping
  index.wrapT = THREE.ClampToEdgeWrapping
  index.needsUpdate = true

  const rows = Math.max(1, palettes.length)
  const lut = new Uint8Array(8 * rows * 4)
  palettes.forEach((pal, row) => {
    for (let i = 0; i < 8; i++) {
      const hex = pal[i] ?? '#ff00ff'
      const n = parseInt(hex.slice(1), 16)
      const o = (row * 8 + i) * 4
      lut[o] = (n >> 16) & 255
      lut[o + 1] = (n >> 8) & 255
      lut[o + 2] = n & 255
      lut[o + 3] = 255
    }
  })
  const palette = new THREE.DataTexture(
    lut as unknown as Uint8Array<ArrayBuffer>,
    8,
    rows,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  )
  palette.magFilter = THREE.NearestFilter
  palette.minFilter = THREE.NearestFilter
  palette.generateMipmaps = false
  palette.needsUpdate = true

  return {
    index,
    palette,
    rows,
    cellUv: CELL / RUNTIME_ATLAS,
    cols: RUNTIME_COLS,
    dispose: () => {
      index.dispose()
      palette.dispose()
    },
  }
}
