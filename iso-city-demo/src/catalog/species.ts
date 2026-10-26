// 物种与品种（图鉴、刷新、城里渲染共用）。
//
// 形象来自体素图纸 src/pets/voxel/designs.ts：每个物种一个模板，品种 = 换色 +
// 特征组合（折耳、短腿、卷尾、花纹……）。这里只补图鉴需要的元数据：名字、
// 稀有度、出现权重、在城里的身高。新增品种只改 designs.ts。

import { VOXEL_DESIGNS } from '../pets/voxel/designs'

export type Rarity = 'common' | 'uncommon' | 'rare'

export type Breed = {
  id: string
  name: string
  /** 出现权重，默认 1 */
  weight?: number
  /** 主毛色：缩略图还没渲染出来时的色块 */
  swatch: string
}

export type Species = {
  id: string
  name: string
  kind: 'pet' | 'wild'
  /** 站立高度（世界单位，含耳朵） */
  height: number
  /** 在城里出现的权重 */
  spawn: number
  rarity: Rarity
  breeds: Breed[]
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: '常见',
  uncommon: '少见',
  rare: '稀有',
}

type Meta = Omit<Species, 'breeds'>

const META: Meta[] = [
  { id: 'cat', name: '猫', kind: 'pet', height: 0.9, spawn: 22, rarity: 'common' },
  { id: 'dog', name: '狗', kind: 'pet', height: 0.95, spawn: 18, rarity: 'common' },
  { id: 'bunny', name: '兔子', kind: 'pet', height: 0.95, spawn: 10, rarity: 'common' },
  { id: 'panda', name: '熊猫', kind: 'wild', height: 1.1, spawn: 3, rarity: 'rare' },
]

export const SPECIES: Species[] = META.map((meta) => {
  const design = VOXEL_DESIGNS[meta.id]
  return {
    ...meta,
    breeds: design.breeds.map((b) => ({
      id: b.id,
      name: b.name,
      weight: b.weight,
      swatch: b.palette?.fur ?? design.palette.fur,
    })),
  }
})

const byId = new Map(SPECIES.map((s) => [s.id, s]))

export const speciesOf = (id: string) => byId.get(id) ?? SPECIES[0]

export const BREED_COUNT = SPECIES.reduce((sum, s) => sum + s.breeds.length, 0)
