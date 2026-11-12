import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { facadeGrid, type FacadeStyle } from './facade'
import { GlowDisc } from './GlowDisc'
import { seeded } from './theme'

/**
 * 背景楼的几种"有脸"的造型构件：砖砌老公寓的消防梯 / 水塔 / 深色檐口，
 * 装饰艺术塔楼的尖塔与亮灯冠带，商业楼的 LED 广告墙，以及广场台阶。
 * 每种构件按材质合并成一个几何体，一栋楼只多两三次 draw call。
 */

function piece(geo: THREE.BufferGeometry, x: number, y: number, z: number, rz = 0) {
  if (rz) geo.rotateZ(rz)
  geo.translate(x, y, z)
  return geo
}

function useDispose(...items: Array<{ dispose(): void } | null | undefined>) {
  useEffect(
    () => () => {
      for (const it of items) it?.dispose()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    items,
  )
}

const ironMat = new THREE.MeshStandardMaterial({ color: '#1e2124', roughness: 0.7, metalness: 0.45 })
const woodMat = new THREE.MeshStandardMaterial({ color: '#6b4a35', roughness: 0.95 })
const woodDarkMat = new THREE.MeshStandardMaterial({ color: '#3a2c25', roughness: 0.9 })
const corniceMat = new THREE.MeshStandardMaterial({ color: '#27312c', roughness: 0.8, metalness: 0.1 })

/**
 * 消防梯：挂在临街面上的一列钢平台 + 之字形斜梯。
 * 局部坐标：立面在 z=0，朝外是 +z，x 沿立面。
 */
const DOOR_COLORS = ['#3d4f43', '#5e2d27', '#2f3e50', '#4d3d2c', '#3a3a3e']
const doorMats = new Map<string, THREE.MeshStandardMaterial>()
function doorMat(color: string) {
  let m = doorMats.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 })
    doorMats.set(color, m)
  }
  return m
}
const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#8c8478', roughness: 0.7 })
const doorGlassDark = new THREE.MeshStandardMaterial({ color: '#1d242c', roughness: 0.25, metalness: 0.5 })
const doorGlassLit = new THREE.MeshStandardMaterial({
  color: '#3a2c1c',
  emissive: '#ffc277',
  emissiveIntensity: 1.1,
  roughness: 0.3,
})

/**
 * 消防梯：平台压在两列窗前，其中一列换成通往平台的门（门框落到楼层地面），
 * 另一列保持窗户；平台之间是带踏板的折返梯，最下面一段悬梯，顶上一段鹅颈梯翻上屋顶。
 * 局部坐标：立面在 z=0，朝外是 +z，x 沿立面。窗列与立面 shader 完全对齐。
 */
export function FireEscape({
  span,
  height,
  seed,
  style,
  inset,
  base,
  night,
}: {
  span: number
  height: number
  seed: string
  style: FacadeStyle
  inset: number
  base: number
  night: boolean
}) {
  const built = useMemo(() => {
    const rnd = seeded(seed + '-fire')
    const g = facadeGrid(style, span, inset)
    const { centers, floorH, sill, winW, winH } = g
    const floors = Math.floor((height - 1.05 - base - sill - winH) / floorH) + 1
    if (floors < 2 || centers.length < 2) return null

    // 门所在列 j，平台延伸到相邻列 j+side
    const stacks: Array<{ j: number; side: number }> = []
    const n = centers.length
    if (n >= 6 && span > 17) {
      stacks.push({ j: 1, side: -1 }, { j: n - 2, side: 1 })
    } else {
      const j = Math.min(n - 1, Math.max(0, Math.floor(n / 2 + (rnd() - 0.5) * 2)))
      stacks.push({ j, side: j === n - 1 ? -1 : j === 0 ? 1 : rnd() > 0.5 ? 1 : -1 })
    }

    const iron: THREE.BufferGeometry[] = []
    const frame: THREE.BufferGeometry[] = []
    const leaf: THREE.BufferGeometry[] = []
    const glassDark: THREE.BufferGeometry[] = []
    const glassLit: THREE.BufferGeometry[] = []
    const depth = 1.2
    const doorH = sill + winH + 0.05

    for (const { j, side } of stacks) {
      const doorX = centers[j]
      const otherX = centers[j + side]
      const cx = (doorX + otherX) / 2
      const w = Math.abs(otherX - doorX) + winW + 0.7

      for (let k = 0; k < floors; k++) {
        const y = base + k * floorH

        // 门：门套盖住整个窗洞并落到楼层地面
        frame.push(piece(new THREE.BoxGeometry(winW + 0.22, doorH + 0.1, 0.08), doorX, y + doorH / 2, 0.04))
        leaf.push(piece(new THREE.BoxGeometry(winW - 0.08, doorH - 0.08, 0.06), doorX, y + doorH / 2 - 0.02, 0.1))
        const glassH = winH * 0.5
        const glass = piece(new THREE.BoxGeometry(winW - 0.42, glassH, 0.04), doorX, y + doorH - 0.22 - glassH / 2, 0.14)
        ;(night && rnd() < 0.55 ? glassLit : glassDark).push(glass)
        // 平台：格栅板 + 前后边梁
        iron.push(piece(new THREE.BoxGeometry(w, 0.05, depth), cx, y - 0.03, depth / 2 + 0.02))
        iron.push(piece(new THREE.BoxGeometry(w, 0.14, 0.05), cx, y - 0.1, depth + 0.02))
        for (let s = 0.2; s < w - 0.1; s += 0.3) {
          iron.push(piece(new THREE.BoxGeometry(0.025, 0.06, depth), cx - w / 2 + s, y, depth / 2 + 0.02))
        }
        // 栏杆：扶手、中横杆、立柱
        for (const hy of [1.0, 0.5]) {
          iron.push(piece(new THREE.BoxGeometry(w, 0.045, 0.045), cx, y + hy, depth))
          for (const sx of [-1, 1]) {
            iron.push(piece(new THREE.BoxGeometry(0.045, 0.045, depth), cx + (sx * w) / 2, y + hy, depth / 2))
          }
        }
        for (let s = 0; s <= w + 0.01; s += w / Math.max(3, Math.round(w / 0.55))) {
          iron.push(piece(new THREE.BoxGeometry(0.03, 1.0, 0.03), cx - w / 2 + s, y + 0.5, depth))
        }
        // 斜撑：平台两端各一根顶回墙面
        for (const sx of [-1, 1]) {
          const brace = new THREE.BoxGeometry(0.05, Math.hypot(depth, 0.9), 0.05)
          brace.rotateX(Math.atan2(depth, 0.9))
          iron.push(piece(brace, cx + sx * (w / 2 - 0.15), y - 0.5, depth / 2))
        }

        // 往上一层的斜梯：两根梯梁 + 踏板，方向逐层交替
        if (k < floors - 1) {
          const dir = k % 2 === 0 ? 1 : -1
          const run = w - 1.1
          const len = Math.hypot(run, floorH)
          const angle = Math.atan2(floorH, run) * dir
          const sx = cx
          const sy = y + floorH / 2
          for (const z of [depth - 0.12, depth - 0.62]) {
            iron.push(piece(new THREE.BoxGeometry(len, 0.12, 0.04), sx, sy, z, angle))
          }
          const steps = Math.round(floorH / 0.24)
          for (let t = 1; t < steps; t++) {
            const f = t / steps
            iron.push(
              piece(new THREE.BoxGeometry(0.22, 0.03, 0.5), sx + dir * (f - 0.5) * run, y + f * floorH, depth - 0.37),
            )
          }
        }
      }

      // 最下面的悬梯：挂在一层平台外沿，离地还有两米多
      const lx = cx + (w / 2 - 0.5) * (stacks.length > 1 ? Math.sign(cx) || 1 : 1)
      const ladderLen = 2.4
      for (const dx of [-0.22, 0.22]) {
        iron.push(piece(new THREE.BoxGeometry(0.04, ladderLen, 0.04), lx + dx, base - ladderLen / 2, depth + 0.08))
      }
      for (let r = 0.2; r < ladderLen; r += 0.3) {
        iron.push(piece(new THREE.BoxGeometry(0.44, 0.03, 0.03), lx, base - r, depth + 0.08))
      }
      // 顶层鹅颈梯：从最高平台爬上女儿墙
      const topY = base + (floors - 1) * floorH
      const gx = cx - (w / 2 - 0.5)
      const gLen = height + 1.0 - topY
      for (const dx of [-0.22, 0.22]) {
        iron.push(piece(new THREE.BoxGeometry(0.045, gLen, 0.045), gx + dx, topY + gLen / 2, depth - 0.15))
      }
      for (let r = 0.3; r < gLen; r += 0.3) {
        iron.push(piece(new THREE.BoxGeometry(0.44, 0.03, 0.03), gx, topY + r, depth - 0.15))
      }
    }

    const merge = (list: THREE.BufferGeometry[]) => (list.length ? mergeGeometries(list) : null)
    const color = DOOR_COLORS[Math.floor(rnd() * DOOR_COLORS.length)]
    return {
      iron: merge(iron),
      frame: merge(frame),
      leaf: merge(leaf),
      glassDark: merge(glassDark),
      glassLit: merge(glassLit),
      leafMat: doorMat(color),
    }
  }, [span, height, seed, style, inset, base, night])
  useDispose(built?.iron, built?.frame, built?.leaf, built?.glassDark, built?.glassLit)
  if (!built) return null
  return (
    <group>
      {built.iron && <mesh geometry={built.iron} material={ironMat} castShadow />}
      {built.frame && <mesh geometry={built.frame} material={doorFrameMat} />}
      {built.leaf && <mesh geometry={built.leaf} material={built.leafMat} />}
      {built.glassDark && <mesh geometry={built.glassDark} material={doorGlassDark} />}
      {built.glassLit && <mesh geometry={built.glassLit} material={doorGlassLit} />}
    </group>
  )
}

const stoopMat = new THREE.MeshStandardMaterial({ color: '#8a8178', roughness: 0.9 })
const planterMat = new THREE.MeshStandardMaterial({ color: '#5a4334', roughness: 0.9 })
const plantMat = new THREE.MeshStandardMaterial({ color: '#4f6b45', roughness: 0.95 })
const lampOnMat = new THREE.MeshStandardMaterial({ color: '#3a2c1c', emissive: '#ffd08a', emissiveIntensity: 2.2 })
const lampOffMat = new THREE.MeshStandardMaterial({ color: '#c9c2b6', roughness: 0.5 })

type Parts = Map<THREE.Material, THREE.BufferGeometry[]>
function add(parts: Parts, mat: THREE.Material, geo: THREE.BufferGeometry) {
  const list = parts.get(mat) ?? []
  list.push(geo)
  parts.set(mat, list)
}
function useMerged(build: () => Parts, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const merged = useMemo(() => [...build()].map(([mat, list]) => ({ mat, geo: mergeGeometries(list) })), deps)
  useEffect(() => () => merged.forEach((m) => m.geo.dispose()), [merged])
  return merged
}

/**
 * 联排小楼的门脸：门对齐到首层某一列窗（盖住那扇窗），门前三级石台阶 + 铁扶手，
 * 门上一块门楣和亮着的气窗，旁边一盏壁灯，另一扇窗下挂花箱。
 */
export function RowhouseFront({
  span,
  style,
  inset,
  seed,
  night,
}: {
  span: number
  style: FacadeStyle
  inset: number
  seed: string
  night: boolean
}) {
  const merged = useMerged(() => {
    const rnd = seeded(seed + '-row')
    const parts: Parts = new Map()
    const g = facadeGrid(style, span, inset)
    const j = rnd() > 0.5 ? 0 : g.centers.length - 1
    const x = g.centers[j]
    const rise = 0.2
    const landing = 0.9
    const sw = g.winW + 0.5
    // 台阶：落地平台 + 往外两级
    add(parts, stoopMat, piece(new THREE.BoxGeometry(sw, rise * 3, landing), x, rise * 1.5, landing / 2))
    add(parts, stoopMat, piece(new THREE.BoxGeometry(sw, rise * 2, 0.35), x, rise, landing + 0.175))
    add(parts, stoopMat, piece(new THREE.BoxGeometry(sw, rise, 0.35), x, rise / 2, landing + 0.525))
    // 扶手：两侧立柱 + 斜杆
    for (const s of [-1, 1]) {
      const rx = x + (s * sw) / 2
      add(parts, ironMat, piece(new THREE.BoxGeometry(0.04, 0.95, 0.04), rx, rise * 3 + 0.47, 0.1))
      add(parts, ironMat, piece(new THREE.BoxGeometry(0.04, 0.95, 0.04), rx, rise + 0.47, landing + 0.6))
      const bar = new THREE.BoxGeometry(0.04, 0.04, Math.hypot(landing + 0.5, rise * 2))
      bar.rotateX(Math.atan2(rise * 2, landing + 0.5))
      add(parts, ironMat, piece(bar, rx, rise * 2 + 0.95, (landing + 0.6) / 2 + 0.05))
    }
    // 门：门套落在平台上，盖住这一列的首层窗
    const doorBottom = rise * 3
    const doorH = 2.35
    add(parts, doorFrameMat, piece(new THREE.BoxGeometry(g.winW + 0.24, doorH + 0.5, 0.08), x, doorBottom + (doorH + 0.5) / 2, 0.04))
    add(parts, doorMat(DOOR_COLORS[Math.floor(rnd() * DOOR_COLORS.length)]), piece(new THREE.BoxGeometry(g.winW - 0.1, doorH, 0.06), x, doorBottom + doorH / 2, 0.1))
    add(
      parts,
      night && rnd() < 0.7 ? doorGlassLit : doorGlassDark,
      piece(new THREE.BoxGeometry(g.winW - 0.2, 0.34, 0.04), x, doorBottom + doorH + 0.24, 0.1),
    )
    // 门楣
    add(parts, corniceMat, piece(new THREE.BoxGeometry(g.winW + 0.7, 0.14, 0.5), x, doorBottom + doorH + 0.58, 0.25))
    // 壁灯
    const lx = x + (j === 0 ? 1 : -1) * (g.winW / 2 + 0.32)
    add(parts, night ? lampOnMat : lampOffMat, piece(new THREE.BoxGeometry(0.16, 0.26, 0.16), lx, doorBottom + 1.9, 0.14))
    // 花箱：挂在另一扇首层窗下
    if (g.centers.length > 1 && rnd() > 0.3) {
      const px = g.centers[j === 0 ? g.centers.length - 1 : 0]
      add(parts, planterMat, piece(new THREE.BoxGeometry(g.winW + 0.1, 0.24, 0.3), px, g.sill - 0.14, 0.17))
      add(parts, plantMat, piece(new THREE.BoxGeometry(g.winW, 0.16, 0.26), px, g.sill + 0.04, 0.17))
    }
    return parts
  }, [span, style, inset, seed, night])
  return (
    <group>
      {merged.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} castShadow={m.mat === stoopMat} receiveShadow />
      ))}
    </group>
  )
}

const SHUTTER_COLORS = ['#6f7a80', '#7d6a4f', '#4f6a73', '#8a4b3c', '#5e6b52']
const shutterMats = new Map<string, THREE.MeshStandardMaterial>()
function shutterMat(color: string) {
  let m = shutterMats.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 })
    shutterMats.set(color, m)
  }
  return m
}

/** 旧仓库首层：一到两樘卷帘门（横向压条）+ 铁皮雨棚 + 门顶灯，旁边一扇小门。 */
export function LoadingDoors({ span, seed, night }: { span: number; seed: string; night: boolean }) {
  const merged = useMerged(() => {
    const rnd = seeded(seed + '-dock')
    const parts: Parts = new Map()
    const count = span > 22 ? 2 : 1
    const dw = 4.2
    const dh = 3.9
    const mat = shutterMat(SHUTTER_COLORS[Math.floor(rnd() * SHUTTER_COLORS.length)])
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? -span * 0.15 : (i === 0 ? -1 : 1) * span * 0.22
      add(parts, corniceMat, piece(new THREE.BoxGeometry(dw + 0.4, dh + 0.3, 0.1), x, (dh + 0.3) / 2, 0.05))
      add(parts, mat, piece(new THREE.BoxGeometry(dw, dh, 0.08), x, dh / 2, 0.12))
      for (let y = 0.3; y < dh; y += 0.32) {
        add(parts, ironMat, piece(new THREE.BoxGeometry(dw, 0.04, 0.03), x, y, 0.17))
      }
      // 雨棚 + 两根斜拉杆
      const canopy = new THREE.BoxGeometry(dw + 1.2, 0.08, 1.4)
      canopy.rotateX(-0.12)
      add(parts, ironMat, piece(canopy, x, dh + 0.55, 0.7))
      for (const s of [-1, 1]) {
        const rod = new THREE.BoxGeometry(0.04, 0.04, 1.6)
        rod.rotateX(0.55)
        add(parts, ironMat, piece(rod, x + s * (dw / 2 + 0.4), dh + 0.95, 0.65))
      }
      add(parts, night ? lampOnMat : lampOffMat, piece(new THREE.BoxGeometry(0.5, 0.12, 0.22), x, dh + 0.38, 0.3))
    }
    // 小门
    const px = count === 1 ? span * 0.22 : 0
    add(parts, doorFrameMat, piece(new THREE.BoxGeometry(1.2, 2.4, 0.08), px, 1.2, 0.04))
    add(parts, doorMat(DOOR_COLORS[Math.floor(rnd() * DOOR_COLORS.length)]), piece(new THREE.BoxGeometry(1.0, 2.25, 0.06), px, 1.13, 0.1))
    add(parts, night ? lampOnMat : lampOffMat, piece(new THREE.BoxGeometry(0.16, 0.24, 0.16), px + 0.85, 2.3, 0.14))
    return parts
  }, [span, seed, night])
  return (
    <group>
      {merged.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} receiveShadow />
      ))}
    </group>
  )
}

const sawMat = new THREE.MeshStandardMaterial({ color: '#5d6266', roughness: 0.6, metalness: 0.3 })

/** 锯齿形天窗屋顶：一排排单坡 + 竖直玻璃面，夜里玻璃透出车间的灯。 */
export function SawtoothRoof({ width, depth, night, seed }: { width: number; depth: number; night: boolean; seed: string }) {
  const merged = useMerged(() => {
    const rnd = seeded(seed + '-saw')
    const parts: Parts = new Map()
    const run = 3.2
    const rise = 1.7
    const len = width - 1.4
    const count = Math.max(1, Math.floor((depth - 1.6) / run))
    const start = -(count * run) / 2
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.lineTo(0, rise)
    shape.lineTo(run, 0)
    shape.closePath()
    const lit = night && rnd() < 0.75
    for (let i = 0; i < count; i++) {
      const z0 = start + (i + 1) * run
      const tooth = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false })
      tooth.rotateY(Math.PI / 2)
      add(parts, sawMat, piece(tooth, -len / 2, 0.1, z0))
      add(parts, lit ? doorGlassLit : doorGlassDark, piece(new THREE.PlaneGeometry(len - 0.3, rise - 0.3), 0, 0.1 + rise / 2, z0 + 0.03))
    }
    return parts
  }, [width, depth, night, seed])
  return (
    <group>
      {merged.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} castShadow={m.mat === sawMat} receiveShadow />
      ))}
    </group>
  )
}

/** 屋顶水塔：四条腿 + 木桶 + 尖顶。老城屋顶最好认的剪影。 */
export function WaterTower({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const { wood, dark } = useMemo(() => {
    const darkParts: THREE.BufferGeometry[] = []
    for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      darkParts.push(piece(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 6), lx, 1.1, lz))
    }
    darkParts.push(piece(new THREE.CylinderGeometry(1.55, 1.55, 0.16, 16), 0, 2.25, 0))
    darkParts.push(piece(new THREE.ConeGeometry(1.55, 1.1, 16), 0, 5.4, 0))
    const wood = new THREE.CylinderGeometry(1.38, 1.38, 2.6, 16).translate(0, 3.6, 0)
    return { wood, dark: mergeGeometries(darkParts) }
  }, [])
  useDispose(wood, dark)
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh geometry={wood} material={woodMat} castShadow receiveShadow />
      <mesh geometry={dark} material={woodDarkMat} castShadow />
    </group>
  )
}

/** 老公寓的深色厚檐口：一道压在顶上的深绿黑色线脚，楼的轮廓立刻"收住"。 */
export function WalkupCornice({ width, depth, y }: { width: number; depth: number; y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -0.75, 0]} material={corniceMat} castShadow>
        <boxGeometry args={[width + 0.4, 0.16, depth + 0.4]} />
      </mesh>
      <mesh position={[0, -0.25, 0]} material={corniceMat} castShadow>
        <boxGeometry args={[width + 0.9, 0.7, depth + 0.9]} />
      </mesh>
    </group>
  )
}

/** 装饰艺术塔楼的尖塔 + 顶灯。 */
export function DecoSpire({ width, night, height }: { width: number; night: boolean; height: number }) {
  const h = Math.max(8, height * 0.16)
  return (
    <group>
      <mesh position={[0, 1.6, 0]} castShadow>
        <boxGeometry args={[width * 0.42, 3.2, width * 0.42]} />
        <meshStandardMaterial color="#8a8d93" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 3.2 + h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.07, width * 0.12, h, 8]} />
        <meshStandardMaterial color="#b9bcc2" roughness={0.35} metalness={0.7} />
      </mesh>
      {night && (
        <mesh position={[0, 3.3 + h, 0]}>
          <sphereGeometry args={[0.28, 10, 8]} />
          <meshBasicMaterial color="#ff4a3a" toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/** 退台处的亮灯冠带：夜里把每一级台阶勾出来，阶梯形剪影才读得出。 */
export function CrownBand({ width, depth, y, night }: { width: number; depth: number; y: number; night: boolean }) {
  if (!night) return null
  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[width + 0.12, 0.22, depth + 0.12]} />
      <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
    </mesh>
  )
}

// ---------------- LED 广告墙 ----------------

const ADS: Array<{ bg: [string, string]; fg: string; text: string }> = [
  { bg: ['#ff3d7f', '#ff9a3d'], fg: '#ffffff', text: 'LUMEN' },
  { bg: ['#1e6bff', '#26c6ff'], fg: '#ffffff', text: 'NEWS 7' },
  { bg: ['#ffd400', '#ff8a00'], fg: '#c4001f', text: 'SALE' },
  { bg: ['#7b2cff', '#ff2ce0'], fg: '#ffffff', text: 'LIVE' },
  { bg: ['#00c27a', '#b6ff3d'], fg: '#05301f', text: 'MATCHA' },
  { bg: ['#ff2a2a', '#ff7a3d'], fg: '#fff6c8', text: 'RAMEN' },
  { bg: ['#141a2e', '#24305a'], fg: '#ffd166', text: 'CINEMA' },
  { bg: ['#ff9ecb', '#ffd6e8'], fg: '#b0124f', text: 'BLOOM' },
  { bg: ['#00a6ff', '#7af0ff'], fg: '#06284a', text: 'SKY AIR' },
  { bg: ['#ffe14d', '#fff3a6'], fg: '#5a2d00', text: 'BOBA' },
  { bg: ['#1b1b1b', '#000000'], fg: '#39ff88', text: 'GAME ON' },
  { bg: ['#ff6b00', '#ffb000'], fg: '#ffffff', text: 'FIZZ' },
]

const ledCache = new Map<string, THREE.MeshBasicMaterial>()

/** 像素风海报：低分辨率画布 + 最近邻采样，远看是干净色块，近看是一格格 LED。 */
function ledMaterial(index: number, wide: boolean) {
  const key = `${index}|${wide ? 1 : 0}`
  const hit = ledCache.get(key)
  if (hit) return hit
  const ad = ADS[index % ADS.length]
  const W = wide ? 128 : 64
  const H = 32
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, ad.bg[0])
  grad.addColorStop(1, ad.bg[1])
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  g.fillStyle = ad.fg
  const deco = index % 3
  if (deco === 0) {
    // 一条波浪色带
    g.globalAlpha = 0.35
    for (let x = 0; x < W; x++) g.fillRect(x, H * 0.62 + Math.sin(x * 0.35) * 3, 1, 4)
    g.globalAlpha = 1
  } else if (deco === 1) {
    // 右侧一个实心圆
    g.beginPath()
    g.arc(W - 11, H / 2, 7, 0, Math.PI * 2)
    g.fill()
  } else {
    // 底部一排小字条
    g.globalAlpha = 0.6
    g.fillRect(4, H - 7, W * 0.45, 3)
    g.fillRect(W * 0.55, H - 7, W * 0.3, 3)
    g.globalAlpha = 1
  }
  g.font = `bold ${wide ? 17 : 13}px monospace`
  g.textBaseline = 'middle'
  g.fillText(ad.text, 5, deco === 2 ? H * 0.42 : H / 2)
  g.strokeStyle = 'rgba(0,0,0,0.55)'
  g.lineWidth = 2
  g.strokeRect(1, 1, W - 2, H - 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  ledCache.set(key, mat)
  return mat
}

const bezelMat = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.6, metalness: 0.5 })

/**
 * 一面立面上的 LED 广告墙：从店面以上一路叠到楼顶，宽窄交错，偶尔留一行窗。
 * 局部坐标：立面在 z=0，朝外 +z。
 */
export function LedWall({
  span,
  height,
  seed,
  night,
  density = 1,
}: {
  span: number
  height: number
  seed: string
  night: boolean
  density?: number
}) {
  const panels = useMemo(() => {
    const rnd = seeded(seed + '-ledwall')
    const list: Array<{ x: number; y: number; w: number; h: number; mat: THREE.MeshBasicMaterial }> = []
    const top = height - 1.6
    let y = 5.0
    while (y < top - 2.4) {
      const h = Math.min(top - y, 3 + rnd() * 3.4)
      if (rnd() < density) {
        if (rnd() < 0.55 || span < 9) {
          const w = span * (0.82 + rnd() * 0.12)
          list.push({ x: (rnd() - 0.5) * (span - w), y: y + h / 2, w, h, mat: ledMaterial(Math.floor(rnd() * 99), w / h > 2.6) })
        } else {
          const split = 0.4 + rnd() * 0.2
          const gap = 0.5
          const w1 = span * 0.9 * split - gap / 2
          const w2 = span * 0.9 * (1 - split) - gap / 2
          const x0 = -span * 0.45
          list.push({ x: x0 + w1 / 2, y: y + h / 2, w: w1, h, mat: ledMaterial(Math.floor(rnd() * 99), w1 / h > 2.6) })
          list.push({ x: x0 + w1 + gap + w2 / 2, y: y + h / 2, w: w2, h, mat: ledMaterial(Math.floor(rnd() * 99), w2 / h > 2.6) })
        }
      }
      y += h + 0.45
    }
    return list
  }, [span, height, seed, density])

  return (
    <group>
      {panels.map((p, i) => (
        <group key={i} position={[p.x, p.y, 0]}>
          <mesh position={[0, 0, 0.12]} material={bezelMat} castShadow>
            <boxGeometry args={[p.w + 0.3, p.h + 0.3, 0.24]} />
          </mesh>
          <mesh position={[0, 0, 0.26]} material={p.mat} scale={[p.w, p.h, 1]} userData={{ noGhost: true }}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>
      ))}
      {night && <GlowDisc position={[0, 0.62, 5]} size={Math.max(10, span * 0.9)} color="#ff9ad6" opacity={0.12} />}
    </group>
  )
}

/** 广场看台台阶：一组朝向广告街区的红色大台阶，夜里底部一圈暖光。 */
export const PLAZA_STEPS = { x: -29, z: 29.5, w: 18, d: 6, rise: 0.42, count: 6 }

export function PlazaSteps({ night }: { night: boolean }) {
  const { x, z, w, d, rise, count } = PLAZA_STEPS
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const tread = d / count
    // 台阶低的一端朝南（+z，横街和广告墙那一侧），往北一级级升高
    for (let k = 0; k < count; k++) {
      const h = rise * (k + 1)
      parts.push(piece(new THREE.BoxGeometry(w, h, tread), 0, h / 2, d / 2 - tread * (k + 0.5)))
    }
    return mergeGeometries(parts)
  }, [w, d, rise, count])
  useDispose(geo)
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#c3332e" roughness={0.6} />
      </mesh>
      {/* 两侧矮挡墙 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (w + 0.5)) / 2, (rise * count) / 2 + 0.1, 0]} castShadow>
          <boxGeometry args={[0.5, rise * count + 0.2, d]} />
          <meshStandardMaterial color="#d9d4cc" roughness={0.8} />
        </mesh>
      ))}
      {night && <GlowDisc position={[0, 0.62, d / 2 + 2]} size={w * 1.1} color="#ffb48a" opacity={0.16} />}
    </group>
  )
}
