import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildings, crossStreet, mainStreet, southCross, insideRoad } from '../data/city'
import { seeded, nightFill } from './theme'

/**
 * 街面细节：这些都是"真实街区"一眼就能看出来的东西，缺了街就只剩柏油和楼。
 * - 路口的防撞柱
 * - 主街两侧的自行车道铺装
 * - 每个路口四个方向的斑马线
 * - 街名牌
 * - 店面雨棚
 *
 * 全部合并成几个 InstancedMesh，只多十来次 draw call。
 */

const INTERSECTIONS = [
  { x: 0, z: crossStreet.z, w: mainStreet.w, d: crossStreet.d },
  { x: 0, z: southCross.z, w: mainStreet.w, d: southCross.d },
  { x: mainStreet.x, z: 0, w: mainStreet.w, d: crossStreet.d },
]

/** 一个路口四条边上的斑马线。 */
function crosswalkStripes(road: { x: number; z: number; w: number; d: number }) {
  const out: Array<{ x: number; z: number; w: number; d: number }> = []
  const halfW = road.w / 2
  const halfD = road.d / 2
  const bar = 1.1
  const gap = 1.9
  for (const sign of [-1, 1]) {
    for (let x = -halfW + 1.0; x < halfW - 0.6; x += gap) {
      out.push({ x: road.x + x, z: road.z + sign * (halfD + 2.2), w: bar, d: 3.6 })
    }
    for (let z = -halfD + 1.0; z < halfD - 0.6; z += gap) {
      out.push({ x: road.x + sign * (halfW + 2.2), z: road.z + z, w: 3.6, d: bar })
    }
  }
  return out
}

type Item = { pos: [number, number, number]; rotY?: number; scale: [number, number, number]; color?: string }

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[]) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length))
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const c = new THREE.Color()
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, it.rotY ?? 0)
    m.compose(new THREE.Vector3(...it.pos), q, new THREE.Vector3(...it.scale))
    mesh.setMatrixAt(i, m)
    if (it.color) mesh.setColorAt(i, c.set(it.color))
  })
  mesh.count = items.length
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  return mesh
}

let glowMapCache: THREE.Texture | null = null
/** 中间亮、边缘完全淡出的暖色光斑贴图。 */
function softGlowMap() {
  if (glowMapCache) return glowMapCache
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.38)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glowMapCache = new THREE.CanvasTexture(canvas)
  return glowMapCache
}

export function StreetDetail({ night }: { night: boolean }) {
  const data = useMemo(() => {
    const rnd = seeded('street-detail-v2')

    /* ---------- 防撞柱：路口四个角 ---------- */
    const bollards: Item[] = []
    for (const road of INTERSECTIONS) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          for (let k = 0; k < 3; k++) {
            const x = road.x + sx * (road.w / 2 + 1.2)
            const z = road.z + sz * (road.d / 2 + 1.0 + k * 2.6)
            if (insideRoad(x, z, 0.05)) continue
            bollards.push({ pos: [x, 0.47, z], scale: [1, 1, 1] })
          }
        }
      }
    }

    /* ---------- 街名牌 ---------- */
    const signs: Item[] = []
    for (const road of INTERSECTIONS) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = road.x + sx * (road.w / 2 + 2.8)
          const z = road.z + sz * (road.d / 2 + 2.8)
          if (insideRoad(x, z, 0.5)) continue
          const yaw = Math.atan2(-sx, -sz)
          signs.push({ pos: [x, 2.45, z], rotY: yaw, scale: [1, 1, 1] })
        }
      }
    }

    /* ---------- 雨棚：临街商铺 ---------- */
    const awnings: Item[] = []
    for (const b of buildings) {
      if (b.background || b.balconies || b.h < 8) continue
      const side = b.entranceSide || b.facing
      if (!side) continue
      if (rnd() > 0.5) continue
      const span = side === 'east' || side === 'west' ? b.d : b.w
      const depth = side === 'east' || side === 'west' ? b.w : b.d
      const w = Math.min(span * 0.7, 9)
      const yaw = side === 'east' ? Math.PI / 2 : side === 'west' ? -Math.PI / 2 : side === 'north' ? Math.PI : 0
      const nx = side === 'east' ? 1 : side === 'west' ? -1 : 0
      const nz = side === 'south' ? 1 : side === 'north' ? -1 : 0
      const along = (rnd() - 0.5) * Math.max(0, span - w) * 0.55
      const x = b.x + nx * (depth / 2 + 1.05) + (nz !== 0 ? along : 0)
      const z = b.z + nz * (depth / 2 + 1.05) + (nx !== 0 ? along : 0)
      awnings.push({
        pos: [x, 3.5, z],
        rotY: yaw,
        scale: [w, 0.1, 2.0],
        color: rnd() > 0.5 ? '#7c3a2f' : '#2f4a5c',
      })
    }

    /* ---------- 自行车道：主街两侧 ---------- */
    const bike: Item[] = []
    for (const dir of [-1, 1]) {
      // 人行道上的抬高自行车道：铺装面在 0.032，画在它上面一点
      const x = dir * (mainStreet.w / 2 + 1.7)
      for (let z = -140; z < 140; z += 2) {
        if (Math.abs(z - crossStreet.z) < 13 || Math.abs(z - southCross.z) < 11) continue
        if (insideRoad(x, z, 0)) continue
        bike.push({ pos: [x, 0.041, z], scale: [1.7, 0.004, 2.0], color: '#2b4b3f' })
      }
    }

    /* ---------- 店铺灯光在人行道上的溢出 ----------
       夜里最"真"的一层不是灯本身，而是灯照出的那片暖色地面。
       每个临街面铺一块很淡的暖色，宽度跟着店面走。 */
    const spill: Item[] = []
    for (const b of buildings) {
      const side = b.entranceSide || b.facing
      if (!side || b.h < 6) continue
      const span = side === 'east' || side === 'west' ? b.d : b.w
      const depth = side === 'east' || side === 'west' ? b.w : b.d
      const nx = side === 'east' ? 1 : side === 'west' ? -1 : 0
      const nz = side === 'south' ? 1 : side === 'north' ? -1 : 0
      const w = Math.min(span * 0.95, 16)
      spill.push({
        pos: [b.x + nx * (depth / 2 + 2.6), 0.038, b.z + nz * (depth / 2 + 2.6)],
        rotY: Math.atan2(nx, nz),
        scale: [w, 1, 7],
        color: '#ffc98e',
      })
    }

    const stripes = INTERSECTIONS.flatMap(crosswalkStripes)
    return { bollards, signs, awnings, bike, stripes, spill }
  }, [])

  const materials = useMemo(
    () => ({
      // 防撞柱是近景里最常被看到的一圈物件。以前 #3a3d40 + metalness 0.7：
      // 夜里没有可反射的亮面，金属度越高越黑，整根柱子直接糊成一个黑洞。
      // 降金属度、把基色抬到能吃到环境光的中灰，再补一层夜间自发光。
      steel: new THREE.MeshStandardMaterial({ color: '#5c6268', roughness: 0.55, metalness: 0.45, ...nightFill(night) }),
      band: new THREE.MeshBasicMaterial({ color: night ? '#e6e2d8' : '#d8d2c2', toneMapped: false }),
      signFace: new THREE.MeshStandardMaterial({ color: '#1f2e36', roughness: 0.55, metalness: 0.25, ...nightFill(night) }),
      signText: new THREE.MeshBasicMaterial({ color: '#d7e2e8', toneMapped: false }),
      cloth: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88 }),
      bike: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, ...nightFill(night) }),
      spill: new THREE.MeshBasicMaterial({
        map: softGlowMap(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.3,
      }),
      paint: new THREE.MeshBasicMaterial({
        color: night ? '#c3bfb0' : '#f0ebdc',
        // 不透明：透明贴花一旦和地面/光斑层的绘制顺序打架，
        // 整块标线会突然变暗，读起来就是"斑马线被切掉一截"
        transparent: false,
        polygonOffset: true,
        polygonOffsetFactor: -8,
        polygonOffsetUnits: -16,
        toneMapped: false,
      }),
    }),
    [night],
  )
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  const meshes = useMemo(() => {
    const { bollards, signs, awnings, bike, stripes, spill } = data
    const spillMesh = instanced(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      materials.spill,
      spill.map((s) => ({ ...s, scale: [s.scale[0], 1, s.scale[2]] as [number, number, number] })),
    )
    spillMesh.renderOrder = 1
    const pole = instanced(new THREE.CylinderGeometry(0.09, 0.11, 0.95, 10), materials.steel, bollards)
    const band = instanced(new THREE.CylinderGeometry(0.115, 0.115, 0.07, 10), materials.band, bollards.map((b) => ({ ...b, pos: [b.pos[0], 0.8, b.pos[2]] as [number, number, number] })))
    const signPole = instanced(
      new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8),
      materials.steel,
      signs.map((s) => ({ ...s, pos: [s.pos[0], 1.3, s.pos[2]] as [number, number, number] })),
    )
    const signFace = instanced(new THREE.BoxGeometry(0.92, 0.6, 0.05), materials.signFace, signs)
    const signBar = instanced(new THREE.BoxGeometry(0.6, 0.07, 0.02), materials.signText, signs)
    const awning = instanced(new THREE.BoxGeometry(1, 1, 1), materials.cloth, awnings)
    const valance = instanced(
      new THREE.BoxGeometry(1, 1, 1),
      materials.cloth,
      awnings.map((a) => {
        const nx = Math.sin(a.rotY ?? 0)
        const nz = Math.cos(a.rotY ?? 0)
        return {
          ...a,
          pos: [a.pos[0] + nx * (a.scale[2] / 2), a.pos[1] - 0.18, a.pos[2] + nz * (a.scale[2] / 2)] as [number, number, number],
          scale: [a.scale[0], 0.26, 0.06] as [number, number, number],
        }
      }),
    )
    const bikeLane = instanced(new THREE.BoxGeometry(1, 1, 1), materials.bike, bike)
    const crosswalks = instanced(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      materials.paint,
      stripes.map((s) => ({ pos: [s.x, 0.054, s.z] as [number, number, number], scale: [s.w, 1, s.d] as [number, number, number] })),
    )
    const all = [pole, band, signPole, signFace, signBar, awning, valance, bikeLane, crosswalks, spillMesh]
    all.forEach((m) => {
      m.frustumCulled = false
      m.userData.noMerge = true
    })
    return all
  }, [data, materials])

  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes])

  return (
    <group userData={{ dynamic: true }}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}
