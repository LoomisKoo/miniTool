import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BuildingDef } from '../data/city'
import { isPitched } from './mass'
import { seeded } from './theme'

/**
 * 全城屋顶的水塔、空调机组、水箱。
 *
 * 以前每栋楼自己挂这些小件，几百栋楼就是几千次 draw call，只能在 75m 外隐藏；
 * 俯视时几乎整座城都在 75m 外，屋顶全是光板，靠近才"长出"东西。
 * 现在全部收成几组 InstancedMesh：一种构件一次 draw call，常亮、不做距离切换，
 * 远景壳子（FarCity）那边也不用再补。
 */

type Placement = { x: number; y: number; z: number; sx: number; sy: number; sz: number }

/** 顶段尺寸：和 InfillBuilding 的退台规则一致 */
function topTier(def: BuildingDef) {
  const stepped = !def.form && def.setback && def.h > 44
  return stepped ? { w: def.w * 0.8, d: def.d * 0.8 } : { w: def.w, d: def.d }
}

function collect(defs: BuildingDef[]) {
  const towers: Placement[] = []
  const boxes: Placement[] = []
  const plates: Placement[] = []
  const tanks: Placement[] = []
  for (const def of defs) {
    if (!def.background || isPitched(def)) continue
    if (def.form === 'deco' || def.form === 'warehouse' || def.form === 'billboard') continue
    const { w, d } = topTier(def)
    const top = def.h

    if (def.form === 'walkup' || def.form === 'estate') {
      const rnd = seeded(def.id + '-tank')
      const count = def.w * def.d > 300 && rnd() > 0.4 ? 2 : 1
      for (let i = 0; i < count; i++) {
        const fx = (count === 1 ? rnd() - 0.5 : i === 0 ? -0.5 : 0.5) * 0.45
        const fz = (rnd() - 0.5) * 0.4
        const s = 0.85 + rnd() * 0.3
        towers.push({ x: def.x + fx * w, y: top, z: def.z + fz * d, sx: s, sy: s, sz: s })
      }
    }
    if (def.form === 'walkup') continue

    // 空调机组 / 水箱：贴着屋面内侧随机摆，留出检修通道
    const rnd = seeded(`${def.id}-gear`)
    const count = w * d > 260 ? 3 : w * d > 140 ? 2 : 1
    const maxX = Math.max(0.6, w / 2 - 2.4)
    const maxZ = Math.max(0.6, d / 2 - 2.4)
    for (let i = 0; i < count; i++) {
      const x = def.x + (rnd() * 2 - 1) * maxX
      const z = def.z + (rnd() * 2 - 1) * maxZ
      const bw = 1.6 + rnd() * 2.4
      const bh = 0.9 + rnd() * 1.1
      const bd = 1.4 + rnd() * 2.0
      const y = top + 0.22
      boxes.push({ x, y: y + bh / 2, z, sx: bw, sy: bh, sz: bd })
      if (rnd() > 0.78) {
        const r = Math.min(bw, bd) * 0.42
        tanks.push({ x, y: y + bh + 0.9, z, sx: r, sy: 1.8, sz: r })
      } else {
        plates.push({ x, y: y + bh + 0.06, z, sx: bw * 0.94, sy: 0.12, sz: bd * 0.94 })
      }
    }
  }
  return { towers, boxes, plates, tanks }
}

function useInstanced(geometry: THREE.BufferGeometry, material: THREE.Material, items: Placement[], castShadow = true) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length))
    m.count = items.length
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    items.forEach((it, i) => {
      mat.compose(p.set(it.x, it.y, it.z), q, s.set(it.sx, it.sy, it.sz))
      m.setMatrixAt(i, mat)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
    m.castShadow = castShadow
    m.receiveShadow = true
    m.userData.noMerge = true
    return m
  }, [geometry, material, items, castShadow])
  return mesh
}

export function RoofProps({ defs, night }: { defs: BuildingDef[]; night: boolean }) {
  const data = useMemo(() => collect(defs), [defs])

  const geos = useMemo(() => {
    const legs: THREE.BufferGeometry[] = []
    for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      legs.push(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 6).translate(lx, 1.1, lz))
    }
    legs.push(new THREE.CylinderGeometry(1.55, 1.55, 0.16, 16).translate(0, 2.25, 0))
    legs.push(new THREE.ConeGeometry(1.55, 1.1, 16).translate(0, 5.4, 0))
    const towerDark = mergeGeometries(legs)
    legs.forEach((g) => g.dispose())
    return {
      towerWood: new THREE.CylinderGeometry(1.38, 1.38, 2.6, 16).translate(0, 3.6, 0),
      towerDark,
      box: new THREE.BoxGeometry(1, 1, 1),
      tank: new THREE.CylinderGeometry(1, 1, 1, 12),
    }
  }, [])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])

  const mats = useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ color: '#6b4a35', roughness: 0.95 }),
      woodDark: new THREE.MeshStandardMaterial({ color: '#3a2c25', roughness: 0.9 }),
      gear: new THREE.MeshStandardMaterial({
        color: night ? '#8b98a2' : '#a9b0b2',
        roughness: 0.68,
        metalness: 0.28,
        envMapIntensity: night ? 1.6 : 1,
      }),
      plate: new THREE.MeshStandardMaterial({
        color: night ? '#5c6771' : '#96a1a4',
        roughness: 0.6,
        metalness: 0.4,
        envMapIntensity: night ? 1.6 : 1,
      }),
    }),
    [night],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  const towerWood = useInstanced(geos.towerWood, mats.wood, data.towers)
  const towerDark = useInstanced(geos.towerDark, mats.woodDark, data.towers)
  const boxes = useInstanced(geos.box, mats.gear, data.boxes)
  const plates = useInstanced(geos.box, mats.plate, data.plates, false)
  const tanks = useInstanced(geos.tank, mats.gear, data.tanks)

  return (
    <group>
      <primitive object={towerWood} />
      <primitive object={towerDark} />
      <primitive object={boxes} />
      <primitive object={plates} />
      <primitive object={tanks} />
    </group>
  )
}
