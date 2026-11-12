import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildings } from '../data/city'
import { isUnitBuilding } from '../data/units'
import { seeded } from './theme'

/**
 * 立面附件：消防梯与楼顶水塔。
 *
 * 这两个东西是"纽约"最容易被认出来的轮廓：
 * - 砖楼正面那一列黑色铁消防梯，一格一格压在窗间；
 * - 屋顶上一只木水塔，底下四条腿。
 *
 * 全部合并成一个 InstancedMesh（铁件）和一个（木桶），不加 draw call。
 */

type Box = { pos: [number, number, number]; rotY?: number; scale: [number, number, number] }

const SIDE: Record<string, { n: [number, number] }> = {
  east: { n: [1, 0] },
  west: { n: [-1, 0] },
  north: { n: [0, -1] },
  south: { n: [0, 1] },
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Box[]) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length))
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  items.forEach((it, i) => {
    q.setFromAxisAngle(up, it.rotY ?? 0)
    m.compose(new THREE.Vector3(...it.pos), q, new THREE.Vector3(...it.scale))
    mesh.setMatrixAt(i, m)
  })
  mesh.count = items.length
  mesh.frustumCulled = false
  return mesh
}

export function FacadeDetail({ night }: { night: boolean }) {
  const data = useMemo(() => {
    const rnd = seeded('facade-detail-v1')
    const iron: Box[] = []
    const wood: Box[] = []

    for (const b of buildings) {
      if (isUnitBuilding(b.id)) continue
      const sideKey = b.entranceSide || b.facing
      const normal = sideKey ? SIDE[sideKey] : null
      const top = b.setback && b.h > 44 ? b.h * 0.76 : b.h

      /* ---------- 消防梯 ---------- */
      // 砖楼、石材楼才有；玻璃塔什么都没有
      if (normal && (b.style === 'brick' || b.style === 'stone') && b.h > 13 && !b.background) {
        const [nx, nz] = normal.n
        const span = nz !== 0 ? b.w : b.d
        const yaw = Math.atan2(nx, nz)
        const w = Math.min(span * 0.32, 4.2)
        const offset = (nz !== 0 ? b.d : b.w) / 2 + 0.42
        const cx = b.x + nx * offset
        const cz = b.z + nz * offset
        const floors = Math.min(9, Math.floor((top - 6) / 3.3))
        for (let f = 0; f < floors; f++) {
          const y = 5.6 + f * 3.3
          // 平台
          iron.push({ pos: [cx, y, cz], rotY: yaw, scale: [w, 0.09, 1.1] })
          // 前栏杆（远看就是一道横线）
          iron.push({
            pos: [cx + nx * 0.48, y + 0.52, cz + nz * 0.48],
            rotY: yaw,
            scale: [w, 0.06, 0.05],
          })
          // 斜梯：每层一段，方向交替，看起来是折返的
          const flip = f % 2 === 0 ? 1 : -1
          iron.push({
            pos: [cx + (nz !== 0 ? flip * w * 0.35 : 0), y + 1.7, cz + (nz === 0 ? flip * w * 0.2 : 0)],
            rotY: yaw,
            scale: [0.55, 3.2, 0.1],
          })
        }
        // 竖杆
        for (const s of [-1, 1]) {
          iron.push({
            pos: [cx + (nz !== 0 ? s * w * 0.5 : 0), 5.6 + (floors * 3.3) / 2, cz + (nz === 0 ? s * 0.5 : 0)],
            rotY: yaw,
            scale: [0.07, floors * 3.3 + 1, 0.07],
          })
        }
      }

      /* ---------- 屋顶水塔 ---------- */
      const tall = b.background ? b.h > 26 : b.h > 18
      if (tall && !b.setback && !b.form && rnd() > 0.55) {
        const r = 2.1 + rnd() * 0.8
        const hgt = 3.4 + rnd() * 1.6
        const tx = b.x + (rnd() - 0.5) * Math.max(0, b.w - r * 3)
        const tz = b.z + (rnd() - 0.5) * Math.max(0, b.d - r * 3)
        // 桶身
        wood.push({ pos: [tx, top + 3.1 + hgt / 2, tz], scale: [r * 2, hgt, r * 2] })
        // 锥顶
        wood.push({ pos: [tx, top + 3.1 + hgt + 0.7, tz], scale: [r * 2.3, 1.4, r * 2.3] })
        // 四条腿
        for (const [sx, sz] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const) {
          iron.push({
            pos: [tx + sx * r * 0.62, top + 1.55, tz + sz * r * 0.62],
            scale: [0.16, 3.1, 0.16],
          })
        }
        // 底部圈梁
        iron.push({ pos: [tx, top + 1.4, tz], scale: [r * 1.5, 0.1, 0.1] })
        iron.push({ pos: [tx, top + 1.4, tz], scale: [0.1, 0.1, r * 1.5] })
      }
    }

    return { iron, wood }
  }, [])

  const mats = useMemo(
    () => ({
      // 这两种材质的"暗"不是缺光，是反照率写错了。
      //
      // 原来的 #14171a 在线性空间只有 0.006——那是黑漆级别的反照率，
      // 自然界几乎不存在；真实涂漆深灰钢约 0.07（≈#4a4e52）。
      // 木头的 #3b2b20 同样只有 0.02，而风化的木材是 0.08~0.12。
      // 反照率差 10 倍，光照再足也只能渲染成一块黑。
      //
      // 另外金属度也错了：涂漆钢外面是油漆，油漆是电介质，metalness 应接近 0。
      // 给 0.55 会把漫反射几乎全部推掉、只剩环境反射，夜里环境本来就暗，
      // 结果就是"物理正确地"渲染成纯黑。
      //
      // 所以这里不再用自发光去补——那等于给错误的反照率打光。
      // 反照率按真实材料给，剩下的交给月光和天光。
      iron: new THREE.MeshStandardMaterial({
        color: night ? '#4a4e52' : '#2b2f31',
        roughness: 0.62,
        metalness: night ? 0.12 : 0.55,
      }),
      wood: new THREE.MeshStandardMaterial({
        color: night ? '#5f4a38' : '#6b4f38',
        roughness: 0.9,
        metalness: 0,
      }),
    }),
    [night],
  )
  useEffect(
    () => () => {
      mats.iron.dispose()
      mats.wood.dispose()
    },
    [mats],
  )

  const meshes = useMemo(() => {
    const { iron, wood } = data
    const ironMesh = instanced(new THREE.BoxGeometry(1, 1, 1), mats.iron, iron)
    const barrel = instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 12), mats.wood, wood.filter((_, i) => i % 2 === 0).map((w) => ({ ...w, scale: [w.scale[0], w.scale[1], w.scale[2]] })))
    const cone = instanced(new THREE.ConeGeometry(0.55, 1, 12), mats.wood, wood.filter((_, i) => i % 2 === 1))
    ironMesh.castShadow = true
    barrel.castShadow = true
    cone.castShadow = true
    return { ironMesh, barrel, cone }
  }, [data, mats])

  useEffect(() => () => Object.values(meshes).forEach((m) => m.geometry.dispose()), [meshes])

  return (
    <group userData={{ dynamic: true }}>
      <primitive object={meshes.ironMesh} />
      <primitive object={meshes.barrel} />
      <primitive object={meshes.cone} />
    </group>
  )
}
