import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildings, insideRoad, lamps } from '../data/city'
import { infillLamps, insideBuilding } from '../data/infill'
import { seeded } from './theme'

/**
 * 招牌与湿地反光。
 *
 * 参考那种"雨夜纽约"最显眼的一层，不是模型细节，而是：
 * 1. 立面上伸出来的发光竖招（blade sign），一条街一串；
 * 2. 路面上被灯光拉长的竖向反光条——湿沥青把灯和招牌拉成一道道竖条。
 *
 * 两者都是 InstancedMesh，各一次 draw call。
 */

type Side = 'north' | 'south' | 'east' | 'west'
const NORMAL: Record<Side, [number, number]> = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }
const YAW: Record<Side, number> = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }

// 招牌颜色收窄到"城市里真会出现"的范围：暖白、琥珀、少量红与青蓝。
// 满街品红紫绿是赛博朋克，不是街区。
const NEON = ['#ffb46b', '#ffd9a8', '#ff8a5a', '#ff6b6b', '#8fd8ff', '#c9e8ff', '#ffe9b8']

type Sign = { x: number; y: number; z: number; yaw: number; color: string; w: number; h: number }
type Streak = { x: number; z: number; yaw: number; len: number; w: number; color: string }

function streakTexture() {
  const w = 64
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    // 靠近光源那一端最亮，往下迅速衰减并留一点拖尾
    const t = y / (h - 1)
    const along = Math.pow(1 - t, 2.2) * (0.75 + 0.25 * Math.sin(t * 26.0)) + Math.pow(1 - t, 0.6) * 0.12
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x / (w - 1) - 0.5) * 2
      const across = Math.pow(Math.max(0, 1 - dx), 1.7)
      const a = Math.min(1, along * across)
      const i = (y * w + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 255
      img.data[i + 2] = 255
      img.data[i + 3] = Math.round(a * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function Neon({ night }: { night: boolean }) {
  const data = useMemo(() => {
    const rnd = seeded('neon-v1')
    const signs: Sign[] = []
    const streaks: Streak[] = []

    /* ---------- 竖招 ---------- */
    for (const b of buildings) {
      if (b.background || b.balconies || b.h < 10) continue
      const side = (b.entranceSide || b.facing) as Side | undefined
      if (!side) continue
      if (rnd() > 0.25) continue
      const [nx, nz] = NORMAL[side]
      const face = side === 'east' || side === 'west' ? b.w : b.d
      const span = side === 'east' || side === 'west' ? b.d : b.w
      const count = b.h > 40 ? 2 : 1
      for (let i = 0; i < count; i++) {
        const y = 5.5 + rnd() * Math.min(b.h - 9, 16)
        const along = (rnd() - 0.5) * Math.max(1, span - 4)
        const x = b.x + nx * (face / 2 + 0.5) + (nz !== 0 ? along : 0)
        const z = b.z + nz * (face / 2 + 0.5) + (nx !== 0 ? along : 0)
        const color = NEON[Math.floor(rnd() * NEON.length)]
        const h = 2.2 + rnd() * 2.2
        const w = 0.42 + rnd() * 0.2
        signs.push({ x, y, z, yaw: YAW[side], color, w, h })
        // 招牌在人行道/路面上的反光：亮端贴着墙根，往街心拉长
        const len = 5 + rnd() * 5
        streaks.push({
          x: b.x + nx * (face / 2 + 0.7 + len / 2) + (nz !== 0 ? along : 0),
          z: b.z + nz * (face / 2 + 0.7 + len / 2) + (nx !== 0 ? along : 0),
          // 反光条沿"离墙方向"拉长
          yaw: Math.atan2(nx, nz),
          len,
          w: w * 2.4,
          color,
        })
      }
    }

    /* ---------- 路灯的湿地反光 ---------- */
    // 灯杆在人行道上，反光落在旁边车道上，沿街方向拉长
    for (const [x, z] of [...lamps, ...infillLamps]) {
      if (insideRoad(x, z, 0.2) || insideBuilding(x, z, 0.4)) continue
      // 判断离哪条街更近：主街沿 z，横街沿 x
      const alongZ = Math.abs(x) < 30
      streaks.push({
        x: x + 0.98,
        z,
        yaw: alongZ ? 0 : Math.PI / 2,
        len: 9,
        w: 2.6,
        color: '#fff6ea',
      })
    }

    return { signs, streaks }
  }, [])

  const mats = useMemo(
    () => ({
      blade: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      frame: new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.5, metalness: 0.6 }),
      streak: new THREE.MeshBasicMaterial({
        map: streakTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    }),
    [],
  )

  const meshes = useMemo(() => {
    const { signs, streaks } = data
    const mtx = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const color = new THREE.Color()
    const make = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number) => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count))
      m.count = count
      m.frustumCulled = false
      m.userData.noMerge = true
      return m
    }

    const blade = make(new THREE.BoxGeometry(1, 1, 1), mats.blade, signs.length)
    const frame = make(new THREE.BoxGeometry(1, 1, 1), mats.frame, signs.length)
    signs.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw)
      // 招牌面垂直于立面，沿出口方向伸出去
      mtx.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(0.16, s.h, s.w))
      blade.setMatrixAt(i, mtx)
      mtx.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(0.24, s.h + 0.14, s.w + 0.1))
      frame.setMatrixAt(i, mtx)
      // 招牌本身也不该是全屏泛光那种亮度：调成"亮但看得清字"的程度
      blade.setColorAt(i, color.set(s.color).multiplyScalar(night ? 0.75 : 0.5))
    })
    if (blade.instanceColor) blade.instanceColor.needsUpdate = true

    const streakGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const streakMesh = make(streakGeo, mats.streak, streaks.length)
    streakMesh.renderOrder = 2
    streaks.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw)
      // 亮端在光源一侧：平面先沿 +z 移到半长，再整体放到落点上
      mtx.compose(new THREE.Vector3(s.x, 0.052, s.z), q, new THREE.Vector3(s.w, 1, s.len))
      streakMesh.setMatrixAt(i, mtx)
      streakMesh.setColorAt(i, color.set(s.color).multiplyScalar(0.45))
    })
    if (streakMesh.instanceColor) streakMesh.instanceColor.needsUpdate = true

    return { blade, frame, streakMesh }
  }, [data, mats])

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(
    () => () => {
      meshes.blade.geometry.dispose()
      meshes.frame.geometry.dispose()
      meshes.streakMesh.geometry.dispose()
    },
    [meshes],
  )

  useEffect(() => {
    mats.blade.color.setScalar(night ? 0.9 : 0.5)
    mats.streak.opacity = night ? 0.5 : 0.22
  }, [mats, night])

  return (
    <group userData={{ dynamic: true }}>
      <primitive object={meshes.frame} />
      <primitive object={meshes.blade} />
      <primitive object={meshes.streakMesh} />
    </group>
  )
}
