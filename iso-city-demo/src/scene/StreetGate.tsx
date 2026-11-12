// 街口牌坊。
//
// 牌坊负责"这里是商业街的入口"：两根方柱、上下两道横梁、中间一块发光匾额、
// 顶上坡檐。主街南北各一座，中巷巷口一座小一号的。
//
// 主街上的灯串、立柱全部拆掉了：那条是车行道，彩灯带挂上去之后和步行街的
// 灯串打架，反而分不清哪段是步行区。现在主街上只剩路灯光和店面本身的光，
// 灯串只在南岸步行街里出现（见 PedestrianStreet.tsx）。
//
// 牌坊的位置也要留意：主街这两座在 z = ±120，南岸步行街的街口牌坊在 z = 135，
// 最近的一根柱子相距 10m 以上，不会再出现两座门架叠在一起的情况。

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { nightFill } from './theme'
import { GlowDisc } from './GlowDisc'
import type { Collider } from './PlayerRig'

/** 牌坊。主街两座跨 26m（街宽 22m），中巷那座跨 9.4m。 */
const GATES = [
  { x: 0, z: 120, yaw: 0, span: 26, label: '微光街', sub: 'LUMEN STREET' },
  { x: 0, z: -120, yaw: 0, span: 26, label: '微光街', sub: 'LUMEN STREET' },
  { x: 12.2, z: 0, yaw: Math.PI / 2, span: 9.4, label: '中巷', sub: 'MID LANE' },
] as const

/** 牌坊柱子占的碰撞盒：横跨街道的两根柱子。 */
export function gateColliders(): Collider[] {
  const out: Collider[] = []
  for (const g of GATES) {
    for (const s of [-1, 1]) {
      const lx = (s * g.span) / 2
      const x = g.x + lx * Math.cos(g.yaw)
      const z = g.z - lx * Math.sin(g.yaw)
      out.push({ minX: x - 0.62, maxX: x + 0.62, minZ: z - 0.62, maxZ: z + 0.62, minY: 0, maxY: 7.4 })
    }
  }
  return out
}

const CJK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

const plaqueCache = new Map<string, THREE.CanvasTexture>()
/** 匾额：深色底 + 暖白字 + 双线边框，整块就是一块灯箱。 */
function plaqueTexture(label: string, sub: string) {
  const key = `${label}|${sub}`
  const hit = plaqueCache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 288
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 288)
  g.addColorStop(0, '#2a3138')
  g.addColorStop(0.5, '#151a1e')
  g.addColorStop(1, '#0b0f12')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 288)
  ctx.strokeStyle = 'rgba(255,232,196,.6)'
  ctx.lineWidth = 8
  ctx.strokeRect(16, 16, 992, 256)
  ctx.strokeStyle = 'rgba(255,232,196,.26)'
  ctx.lineWidth = 3
  ctx.strokeRect(34, 34, 956, 220)
  ctx.fillStyle = '#fff3dc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 132px ${CJK}`
  ctx.fillText(label, 512, 118, 780)
  ctx.font = `500 40px "Helvetica Neue", Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,238,206,.82)'
  // 字距靠逐字画出来，不用 letterSpacing（CanvasRenderingContext2D 的这个
  // 属性在旧版 Safari 上不存在，会静默丢掉整行小字）
  const chars = [...sub]
  const advance = Math.min(46, 700 / Math.max(1, chars.length))
  const startX = 512 - (advance * (chars.length - 1)) / 2
  chars.forEach((ch, i) => ctx.fillText(ch, startX + advance * i, 226))
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  plaqueCache.set(key, tex)
  return tex
}

export type GateMats = {
  stone: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  cable: THREE.MeshStandardMaterial
  strip: THREE.MeshBasicMaterial
  bulb: THREE.MeshBasicMaterial
  halo: THREE.MeshBasicMaterial
}

/** 牌坊共用的那组材质。步行街的牌坊也直接拿这套，颜色才和主街一致。 */
export function gateMaterials(night: boolean): GateMats {
  return {
    stone: new THREE.MeshStandardMaterial({
      color: night ? '#3e4a52' : '#c4c9c3',
      roughness: 0.88,
      metalness: 0.05,
      ...nightFill(night),
    }),
    dark: new THREE.MeshStandardMaterial({
      color: night ? '#242c33' : '#4a545a',
      roughness: 0.62,
      metalness: 0.42,
      ...nightFill(night),
    }),
    cable: new THREE.MeshStandardMaterial({
      color: night ? '#33383d' : '#54585a',
      roughness: 0.72,
      metalness: 0.35,
      ...nightFill(night, '#1d2226', 0.6),
    }),
    strip: new THREE.MeshBasicMaterial({ color: night ? '#ffe6bb' : '#e6d7ba', toneMapped: false }),
    bulb: new THREE.MeshBasicMaterial({ color: night ? '#fff3d6' : '#efe4cd', toneMapped: false }),
    halo: new THREE.MeshBasicMaterial({
      color: '#ffcf94',
      transparent: true,
      opacity: night ? 0.22 : 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  }
}

/**
 * 一座牌坊。传入的世界位置 / 朝向 / 跨度，主街和步行街共用。
 * 跨度沿局部 X，柱子落在 ±span/2。
 */
export function StreetArch({
  x,
  z,
  yaw,
  span,
  label,
  sub,
  mats,
  night,
}: {
  x: number
  z: number
  yaw: number
  span: number
  label: string
  sub: string
  mats: GateMats
  night: boolean
}) {
  const half = span / 2
  const plaqueW = Math.min(span * 0.58, 10)
  const plaqueTex = useMemo(() => plaqueTexture(label, sub), [label, sub])
  // 匾额是自发光灯箱：白天压到 0.7，夜里满亮
  const plaqueMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: plaqueTex, toneMapped: false, color: night ? '#ffffff' : '#bdb7a8' }),
    [plaqueTex, night],
  )
  useEffect(() => () => plaqueMat.dispose(), [plaqueMat])

  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * half, 0, 0]}>
          <mesh position={[0, 3.7, 0]} material={mats.stone} castShadow receiveShadow>
            <boxGeometry args={[0.95, 7.4, 0.95]} />
          </mesh>
          {/* 柱脚：勒脚比柱身宽一圈，柱子才像"立"在地上 */}
          <mesh position={[0, 0.34, 0]} material={mats.dark} castShadow receiveShadow>
            <boxGeometry args={[1.52, 0.68, 1.52]} />
          </mesh>
          <mesh position={[0, 0.72, 0]} material={mats.stone} castShadow>
            <boxGeometry args={[1.16, 0.16, 1.16]} />
          </mesh>
          {/* 柱身四面各一条内嵌灯带：plane 单面，四个方向各转一次朝外 */}
          {(
            [
              [0, 0.49, 0],
              [0, -0.49, Math.PI],
              [0.49, 0, Math.PI / 2],
              [-0.49, 0, -Math.PI / 2],
            ] as const
          ).map(([ox, oz, stripYaw], i) => (
            <mesh key={i} position={[ox, 3.9, oz]} rotation={[0, stripYaw, 0]} material={mats.strip}>
              <planeGeometry args={[0.16, 4.6]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 下梁 / 上梁 */}
      <mesh position={[0, 5.6, 0]} material={mats.stone} castShadow receiveShadow>
        <boxGeometry args={[span + 2.2, 0.44, 0.68]} />
      </mesh>
      <mesh position={[0, 7.28, 0]} material={mats.stone} castShadow receiveShadow>
        <boxGeometry args={[span + 3.0, 0.36, 0.78]} />
      </mesh>

      {/* 匾额：底板 + 两面贴图（正面朝 +Z，背面朝 -Z） */}
      <mesh position={[0, 6.42, 0]} material={mats.dark} castShadow>
        <boxGeometry args={[plaqueW, 1.34, 0.22]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 6.42, s * 0.12]} rotation={[0, s < 0 ? Math.PI : 0, 0]} material={plaqueMat}>
          <planeGeometry args={[plaqueW - 0.14, 1.2]} />
        </mesh>
      ))}

      {/* 匾额两侧的格栅：上下梁之间那一段空档，不加就只剩两根横杆 */}
      {[-1, 1].map((s) =>
        Array.from({ length: Math.max(3, Math.round((half - plaqueW / 2) / 0.62)) }).map((_, i) => (
          <mesh
            key={`${s}-${i}`}
            position={[
              s * (plaqueW / 2 + 0.3 + ((half - plaqueW / 2 - 0.4) * i) / Math.max(3, Math.round((half - plaqueW / 2) / 0.62))),
              6.42,
              0,
            ]}
            material={mats.dark}
            castShadow
          >
            <boxGeometry args={[0.09, 1.3, 0.12]} />
          </mesh>
        )),
      )}

      {/* 上梁下沿的一排小托块（简化斗拱） */}
      {Array.from({ length: Math.floor((span + 2.4) / 1.1) }).map((_, i, arr) => (
        <mesh
          key={`br-${i}`}
          position={[-((arr.length - 1) * 1.1) / 2 + i * 1.1, 6.98, 0.3]}
          material={mats.dark}
          castShadow
        >
          <boxGeometry args={[0.34, 0.22, 0.24]} />
        </mesh>
      ))}

      {/* 顶檐：中间一块挑出的薄板 + 两端微微翘起的飞檐 */}
      <mesh position={[0, 7.62, 0]} material={mats.dark} castShadow receiveShadow>
        <boxGeometry args={[span + 3.8, 0.16, 1.5]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={`eave-${s}`}
          position={[s * (span / 2 + 2.1), 7.78, 0]}
          rotation={[0, 0, s * 0.3]}
          material={mats.dark}
          castShadow
        >
          <boxGeometry args={[1.1, 0.14, 1.42]} />
        </mesh>
      ))}
      <mesh position={[0, 7.86, 0]} material={mats.dark} castShadow>
        <boxGeometry args={[plaqueW + 1.2, 0.3, 0.9]} />
      </mesh>

      {/* 夜里：匾额下沿 + 梁下各一条灯管 */}
      {night && (
        <>
          <mesh position={[0, 5.82, 0.4]} material={mats.strip}>
            <boxGeometry args={[span * 0.92, 0.05, 0.05]} />
          </mesh>
          <mesh position={[0, 7.46, 0.48]} material={mats.strip}>
            <boxGeometry args={[span * 0.9, 0.05, 0.05]} />
          </mesh>
          <GlowDisc position={[0, 0.06, 0]} size={span * 0.8} color="#ffcf9a" opacity={0.1} />
        </>
      )}
    </group>
  )
}

export function StreetGate({ night }: { night: boolean }) {
  const mats = useMemo(() => gateMaterials(night), [night])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  return (
    <group>
      {GATES.map((g) => (
        <StreetArch
          key={`${g.x}-${g.z}`}
          x={g.x}
          z={g.z}
          yaw={g.yaw}
          span={g.span}
          label={g.label}
          sub={g.sub}
          mats={mats}
          night={night}
        />
      ))}
    </group>
  )
}
