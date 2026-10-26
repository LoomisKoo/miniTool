import { useMemo } from 'react'
import * as THREE from 'three'
import { insideRoad, plazaFountain } from '../data/city'
import { insideBuilding } from '../data/infill'
import { seeded } from './theme'

const NOTE_COLORS = ['#fff3a8', '#ffd1dc', '#c9f0ff', '#d8ffc9', '#ffffff', '#ffe0b3']

/* ---------- 共享资源 ----------
 *
 * 这个组件是"world 数据回来之后才挂载"的，整城 11 块板会在同一帧里一起
 * 建出来。以前每个 mesh 都内联写一份 <meshStandardMaterial> 和
 * <boxGeometry>，一块板约 45 个 mesh、11 块板就是 ~500 个材质实例 +
 * 500 份几何：那一下正好发生在首屏后 1~2 秒（boot 的网络往返结束），
 * 表现为一次明显的掉帧。
 *
 * 现在材质和几何都在模块级建一次，所有板共用；尺寸靠 mesh.scale 表达，
 * 位置靠 position。顶点/材质数量从 500 降到 4，StaticMerge 也能把整块板
 * 合进城市里，之后的 draw call 也一起降下来。
 */

const MAT = {
  post: new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.8 }),
  frame: new THREE.MeshStandardMaterial({ color: '#6e5440', roughness: 0.75 }),
  cork: new THREE.MeshStandardMaterial({ color: '#c39a68', roughness: 0.95 }),
  canopy: new THREE.MeshStandardMaterial({ color: '#3f4a52', roughness: 0.6, metalness: 0.3 }),
  pinRed: new THREE.MeshStandardMaterial({ color: '#d9534f', roughness: 0.4 }),
  pinBlue: new THREE.MeshStandardMaterial({ color: '#3b7dd8', roughness: 0.4 }),
  ink: new THREE.MeshBasicMaterial({ color: '#6b6f75' }),
  notes: new Map<string, THREE.MeshStandardMaterial>(),
}

function noteMat(color: string) {
  let m = MAT.notes.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    MAT.notes.set(color, m)
  }
  return m
}

const GEO = {
  post: new THREE.BoxGeometry(0.09, 2.0, 0.09),
  frame: new THREE.BoxGeometry(1.98, 1.12, 0.07),
  cork: new THREE.BoxGeometry(1.82, 0.98, 0.02),
  canopy: new THREE.BoxGeometry(2.2, 0.05, 0.36),
  pin: new THREE.SphereGeometry(0.018, 8, 6),
  /** 便签和"字"都是单位平面，尺寸用 scale 表达。 */
  plane: new THREE.PlaneGeometry(1, 1),
}

/** 留言板：两根立柱 + 软木板 + 小雨檐，上面钉着几张便签。正面朝本地 +z。 */
export function NoticeBoard({
  x,
  z,
  yaw = 0,
  seed = 'board',
  scale = 1,
}: {
  x: number
  z: number
  yaw?: number
  seed?: string
  scale?: number
}) {
  const notes = useMemo(() => {
    const rnd = seeded(seed)
    return Array.from({ length: 9 }, (_, i) => ({
      x: -0.62 + (i % 3) * 0.6 + (rnd() - 0.5) * 0.18,
      y: 1.25 + Math.floor(i / 3) * 0.32 + (rnd() - 0.5) * 0.08,
      w: 0.26 + rnd() * 0.1,
      h: 0.2 + rnd() * 0.08,
      rot: (rnd() - 0.5) * 0.35,
      color: NOTE_COLORS[Math.floor(rnd() * NOTE_COLORS.length)],
      pin: rnd() > 0.5 ? MAT.pinRed : MAT.pinBlue,
    }))
  }, [seed])

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]} scale={scale}>
      {[-0.95, 0.95].map((px) => (
        <mesh
          key={px}
          geometry={GEO.post}
          material={MAT.post}
          position={[px, 1.0, -0.02]}
          castShadow
        />
      ))}
      {/* 外框 + 软木板 */}
      <mesh
        geometry={GEO.frame}
        material={MAT.frame}
        position={[0, 1.55, -0.03]}
        castShadow
        receiveShadow
      />
      <mesh geometry={GEO.cork} material={MAT.cork} position={[0, 1.55, 0.008]} />
      {/* 小雨檐 */}
      <mesh
        geometry={GEO.canopy}
        material={MAT.canopy}
        position={[0, 2.16, 0.04]}
        rotation={[0.35, 0, 0]}
        castShadow
      />
      {notes.map((n, i) => (
        <group key={i} position={[n.x, n.y, 0.022]} rotation={[0, 0, n.rot]}>
          <mesh
            geometry={GEO.plane}
            material={noteMat(n.color)}
            scale={[n.w, n.h, 1]}
          />
          <mesh
            geometry={GEO.pin}
            material={n.pin}
            position={[0, n.h / 2 - 0.03, 0.01]}
          />
          {/* 便签上的几行"字" */}
          {[0, 1].map((r) => (
            <mesh
              key={r}
              geometry={GEO.plane}
              material={MAT.ink}
              position={[0, 0.02 - r * 0.05, 0.002]}
              scale={[n.w * 0.7, 0.012, 1]}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

/** 户外留言板落点：避开喷泉、车道和楼。 */
export function boardSpot(x: number, z: number): [number, number] {
  const tries: Array<[number, number]> = [[0, 0]]
  for (let r = 1.5; r <= 9; r += 1.5) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      tries.push([Math.cos(a) * r, Math.sin(a) * r])
    }
  }
  for (const [dx, dz] of tries) {
    const px = x + dx
    const pz = z + dz
    if (Math.hypot(px - plazaFountain.x, pz - plazaFountain.z) < plazaFountain.r + 1.8) continue
    if (insideRoad(px, pz, 1.2) || insideBuilding(px, pz, 1.4)) continue
    return [px, pz]
  }
  return [x, z]
}
