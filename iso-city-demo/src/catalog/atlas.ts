// 图集纹理创建：只有真正渲染时才需要 three，所以单独一层。

import * as THREE from 'three'
import { ATLAS_SIZE } from './layout'

export { ATLAS_SIZE, ATLAS_COLS, ATLAS_CELLS, CELL_UV, atlasOrigin, paintCell, atlasJobs, petCell, fishCell } from './layout'

export function createIndexTexture(data: Uint8Array, size = ATLAS_SIZE) {
  const tex = new THREE.DataTexture(data as unknown as Uint8Array<ArrayBuffer>, size, size, THREE.RedFormat, THREE.UnsignedByteType)
  // 放大必须硬边：这是「像素感」的唯一来源
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 2
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

/** 调色板 LUT：8 像素宽的 1D 表，每行一套配色。 */
export function createPaletteTexture(palettes: string[][]) {
  const w = 8
  const h = Math.max(1, palettes.length)
  const buffer = new Uint8Array(w * h * 4)
  palettes.forEach((pal, row) => {
    for (let i = 0; i < w; i++) {
      const hex = pal[i] ?? '#ff00ff'
      const n = parseInt(hex.slice(1), 16)
      const o = (row * w + i) * 4
      buffer[o] = (n >> 16) & 255
      buffer[o + 1] = (n >> 8) & 255
      buffer[o + 2] = n & 255
      buffer[o + 3] = 255
    }
  })
  const tex = new THREE.DataTexture(buffer as unknown as Uint8Array<ArrayBuffer>, w, h, THREE.RGBAFormat, THREE.UnsignedByteType)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}
