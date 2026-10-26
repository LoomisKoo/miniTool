// 城市里的野生宠物（体素模型，见 pets/voxel）。
//
// 按「品种 × 部件」实例化：同一品种的所有宠物共享几何，身体、头、耳朵、
// 四条腿、尾巴各一个 InstancedMesh。眨眼用一份闭眼的头：眨眼那几帧把
// 睁眼头的实例缩成 0、闭眼头的实例放到原位。
//
// 走 / 停交替用确定性的周期：位置只在「走」的那段时间推进，停下时原地待机，
// 不会出现播着待机动画却在地上滑行。

import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { speciesOf } from '../catalog/species'
import { walker } from '../game/walker'
import { flinch, petHeading, petPose } from './roam'
import { currentBucket, wildPool, type WildPet } from './wild'
import { live } from './live'
import { isBlinking, voxelMaterial, type VoxelPet } from './voxel/build'
import { buildModels, partMatrices, petModel, petScale } from './voxel/runtime'

const EPOCH = Date.UTC(2026, 0, 1)
const GROUND_Y = 0.03
/** 一个走停周期（秒）：前 60% 在走，后 40% 停下 */
const CYCLE = 36
const WALK_SHARE = 0.6

// ---------------------------------------------------------------------------
// 影子：一张径向渐变贴图，全体宠物共用一个 InstancedMesh
// ---------------------------------------------------------------------------

let shadowMat: THREE.MeshBasicMaterial | null = null
let shadowGeo: THREE.BufferGeometry | null = null

function shadowMaterial() {
  if (shadowMat) return shadowMat
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31)
  g.addColorStop(0, 'rgba(0,0,0,0.5)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  shadowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  return shadowMat
}

function shadowGeometry() {
  if (shadowGeo) return shadowGeo
  shadowGeo = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2)
  return shadowGeo
}

// ---------------------------------------------------------------------------
// 组装
// ---------------------------------------------------------------------------

type BreedBatch = {
  model: VoxelPet
  speciesId: string
  pets: number[]
  /** 与 model.parts 一一对应 */
  parts: THREE.InstancedMesh[]
  /** 闭眼头，对应 model.parts[blinkPart] */
  blink: THREE.InstancedMesh | null
  blinkPart: number
}

type Flock = {
  group: THREE.Group
  pets: WildPet[]
  batches: BreedBatch[]
  shadows: THREE.InstancedMesh
}

const keyOf = (pet: WildPet) => `${pet.species}/${pet.breed.id}`

function instanced(geometry: THREE.BufferGeometry, count: number, group: THREE.Group) {
  const mesh = new THREE.InstancedMesh(geometry, voxelMaterial(), count)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  group.add(mesh)
  return mesh
}

function buildFlock(pets: WildPet[]): Flock {
  const group = new THREE.Group()
  group.userData.dynamic = true

  const byBreed = new Map<string, number[]>()
  pets.forEach((pet, i) => {
    const list = byBreed.get(keyOf(pet)) ?? []
    list.push(i)
    byBreed.set(keyOf(pet), list)
  })

  const batches: BreedBatch[] = []
  for (const [key, list] of byBreed) {
    const [speciesId, breedId] = key.split('/')
    const model = petModel(speciesId, breedId)
    const parts = model.parts.map((part) => instanced(part.geometry, list.length, group))
    const blinkPart = model.parts.findIndex((part) => part.blink)
    const blink = blinkPart >= 0 ? instanced(model.parts[blinkPart].blink as THREE.BufferGeometry, list.length, group) : null
    batches.push({ model, speciesId, pets: list, parts, blink, blinkPart })
  }

  const shadows = new THREE.InstancedMesh(shadowGeometry(), shadowMaterial(), Math.max(1, pets.length))
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  shadows.frustumCulled = false
  shadows.renderOrder = 1
  group.add(shadows)

  return { group, pets, batches, shadows }
}

/** 几何属于模型缓存（图鉴缩略图也在用），这里只释放实例 */
function disposeFlock(flock: Flock) {
  for (const batch of flock.batches) {
    for (const mesh of batch.parts) mesh.dispose()
    batch.blink?.dispose()
  }
  flock.shadows.dispose()
  flock.group.removeFromParent()
}

// ---------------------------------------------------------------------------
// 每帧
// ---------------------------------------------------------------------------

const _pet = new THREE.Matrix4()
const _out = new THREE.Matrix4()
const _pos = new THREE.Vector3()
const _scl = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _yAxis = new THREE.Vector3(0, 1, 0)
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
const locals: THREE.Matrix4[] = []

/** 只在「走」的时段推进的漫游时间：停下时位置冻结，动画切成待机。 */
function roamClock(t: number) {
  const cycle = Math.floor(t / CYCLE)
  const local = t - cycle * CYCLE
  const walkSpan = CYCLE * WALK_SHARE
  return { roam: cycle * walkSpan + Math.min(local, walkSpan), walking: local < walkSpan }
}

function animateFlock(flock: Flock, time: number) {
  const { pets, shadows } = flock

  if (live.length !== pets.length) {
    while (live.length < pets.length) {
      live.push({ id: '', speciesId: '', species: '', breedId: '', breed: '', x: 0, z: 0, y: 0, radius: 1.6 })
    }
    live.length = pets.length
  }

  for (const batch of flock.batches) {
    const { model } = batch
    const species = speciesOf(batch.speciesId)
    for (let slot = 0; slot < batch.pets.length; slot++) {
      const index = batch.pets[slot]
      const pet = pets[index]
      const offset = index * 7.3
      const clock = roamClock(time + offset)

      const pose = petPose(pet.id, pet.spot, clock.roam, 0.9)
      const away = flinch(pose, walker.position)
      const heading = petHeading(pet.id, pet.spot, clock.roam, 0.9)
      const shy = away.shy > 0.05

      let yaw = Math.atan2(heading.x, heading.z)
      // 被吓到时扭头往外跑
      if (shy) yaw = Math.atan2(away.x - walker.position.x, away.z - walker.position.z)
      const walking = shy || clock.walking
      // 跑开时动作加快
      const animTime = (time + offset) * (shy ? 1.6 : 1)

      const s = petScale(pet.species, model) * pet.scale
      _pos.set(away.x, GROUND_Y, away.z)
      _q.setFromAxisAngle(_yAxis, yaw)
      _scl.set(s, s, s)
      _pet.compose(_pos, _q, _scl)

      partMatrices(model, walking ? 'walk' : 'idle', animTime, locals)
      const blinking = isBlinking(time + offset, index * 0.61)
      for (let k = 0; k < batch.parts.length; k++) {
        _out.multiplyMatrices(_pet, locals[k])
        if (k === batch.blinkPart && batch.blink) {
          batch.parts[k].setMatrixAt(slot, blinking ? ZERO : _out)
          batch.blink.setMatrixAt(slot, blinking ? _out : ZERO)
        } else {
          batch.parts[k].setMatrixAt(slot, _out)
        }
      }

      const r = species.height * 0.5 * pet.scale
      _pos.set(away.x, 0.028, away.z)
      _q.identity()
      _scl.set(r, 1, r * 0.85)
      _out.compose(_pos, _q, _scl)
      shadows.setMatrixAt(index, _out)

      const info = live[index]
      info.id = pet.id
      info.speciesId = pet.species
      info.species = species.name
      info.breedId = pet.breed.id
      info.breed = pet.breed.name
      info.x = away.x
      info.z = away.z
      info.y = GROUND_Y
      info.radius = 1.6
    }
    for (const mesh of batch.parts) mesh.instanceMatrix.needsUpdate = true
    if (batch.blink) batch.blink.instanceMatrix.needsUpdate = true
  }
  shadows.instanceMatrix.needsUpdate = true
}

// ---------------------------------------------------------------------------

export function WildPets() {
  const [bucket, setBucket] = useState(() => currentBucket())
  const [ready, setReady] = useState<number | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = currentBucket()
      setBucket((prev) => (next === prev ? prev : next))
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const pets = useMemo<WildPet[]>(() => wildPool(bucket), [bucket])

  // 先在后台把这一小时要用到的品种模型分批建好，再一次性放进场景
  useEffect(() => {
    const signal = { cancelled: false }
    const keys = [...new Set(pets.map(keyOf))]
    void buildModels(keys, signal).then(() => {
      if (!signal.cancelled) setReady(bucket)
    })
    return () => {
      signal.cancelled = true
    }
  }, [pets, bucket])

  const flock = useMemo(() => (ready === bucket ? buildFlock(pets) : null), [pets, ready, bucket])
  useEffect(() => () => {
    if (flock) disposeFlock(flock)
  }, [flock])

  useFrame(() => {
    // 固定纪元：不能对 86400 取模，否则每天零点整批宠物会瞬移一次
    if (flock) animateFlock(flock, (Date.now() - EPOCH) / 1000)
  })

  return flock ? <primitive object={flock.group} /> : null
}
