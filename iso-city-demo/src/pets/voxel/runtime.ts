// 城市和图鉴共用的运行时：取模型、算部件矩阵、分批构建。

import * as THREE from 'three'
import { speciesOf } from '../../catalog/species'
import { buildVoxelPet, posePart, type PetMotion, type VoxelPet } from './build'
import { VOXEL_DESIGNS } from './designs'

/** 城里和图鉴都用 2x：约 44 格高，毛边和五官细节都在 */
export const PET_RES = 2

export function petModel(speciesId: string, breedId: string): VoxelPet {
  return buildVoxelPet(VOXEL_DESIGNS[speciesId] ?? VOXEL_DESIGNS.cat, breedId, PET_RES)
}

/** 体素单位 → 世界单位：让整只（含耳朵）正好是物种表里的身高 */
export function petScale(speciesId: string, pet: VoxelPet) {
  return speciesOf(speciesId).height / pet.height
}

const built = new Set<string>()

/**
 * 一只 2x 模型要几十毫秒，一次全建会卡一下。每建一个让出一次主线程，
 * 城里的宠物分批出现，不卡帧。
 */
export async function buildModels(keys: string[], signal?: { cancelled: boolean }) {
  for (const key of keys) {
    if (signal?.cancelled) return
    if (built.has(key)) continue
    const [species, breed] = key.split('/')
    petModel(species, breed)
    built.add(key)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

const _r = new THREE.Matrix4()
const _s = new THREE.Matrix4()
const _e = new THREE.Euler()

/**
 * 每个部件相对宠物原点的矩阵（体素单位）。子部件（耳朵）乘在父部件上，
 * 跟着头一起转。motion 为 null 时是静止站姿（缩略图用）。
 * out 按 pet.parts 的顺序写入。
 */
export function partMatrices(pet: VoxelPet, motion: PetMotion | null, t: number, out: THREE.Matrix4[]) {
  const index = new Map<string, number>()
  pet.parts.forEach((part, i) => {
    index.set(part.name, i)
    if (!out[i]) out[i] = new THREE.Matrix4()
  })
  // 父部件总在子部件之前算：parts 里 head 排在耳朵前面，但这里不依赖顺序
  const done = new Set<number>()
  const solve = (i: number) => {
    if (done.has(i)) return
    const part = pet.parts[i]
    const pose = motion ? posePart(part.name, motion, t) : { rx: 0, ry: 0, rz: 0, dy: 0, sy: 1 }
    const parentIndex = part.parent ? index.get(part.parent) : undefined
    const parent = parentIndex !== undefined ? pet.parts[parentIndex] : undefined
    const px = parent ? part.pivot[0] - parent.pivot[0] : part.pivot[0]
    const py = (parent ? part.pivot[1] - parent.pivot[1] : part.pivot[1]) + pose.dy
    const pz = parent ? part.pivot[2] - parent.pivot[2] : part.pivot[2]
    _e.set(pose.rx, pose.ry, pose.rz)
    _r.makeRotationFromEuler(_e)
    _s.makeScale(1, pose.sy ?? 1, 1)
    const m = out[i].makeTranslation(px, py, pz).multiply(_r).multiply(_s)
    if (parentIndex !== undefined) {
      solve(parentIndex)
      m.premultiply(out[parentIndex])
    }
    done.add(i)
  }
  pet.parts.forEach((_, i) => solve(i))
  return out
}
