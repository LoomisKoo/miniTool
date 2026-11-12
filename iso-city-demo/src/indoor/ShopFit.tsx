// 1 楼店铺的室内陈列。
//
// 坐标系是"店铺自己的"：原点在店铺矩形中心，**+Z 是街面**（玻璃门那一侧），
// -Z 是背墙，±X 是沿街方向。ShopRoom 会按店门所在的外墙把这一组整体转过去，
// 所以这里只需要按"正面朝 +Z"摆一次。
//
// 每种业态只搭必要的几件东西：一块柜台、一排货架、一张工作台。陈列是从
// 业态语义出发的（面包房是托盘、花店是水桶、唱片店是唱片箱），不是随便摆盒子。

import { useMemo } from 'react'
import * as THREE from 'three'
import type { ShopDef, ShopKind } from '../data/shops'

/** 一块小黑板：菜单 / 今日供应。和街上的招牌共用同一种视觉语言，但尺寸小得多。 */
const boardCache = new Map<string, THREE.CanvasTexture>()

function boardTexture(title: string, lines: string[], bg = '#2f3a34') {
  const key = `${title}|${lines.join('/')}|${bg}`
  const hit = boardCache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 192
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 256, 192)
  ctx.strokeStyle = 'rgba(240,232,214,.35)'
  ctx.lineWidth = 3
  ctx.strokeRect(9, 9, 238, 174)
  ctx.fillStyle = '#f0e8d6'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = '600 22px "PingFang SC", "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(title, 20, 22, 216)
  ctx.font = '400 15px "PingFang SC", "Helvetica Neue", Arial, sans-serif'
  ctx.fillStyle = 'rgba(240,232,214,.78)'
  lines.slice(0, 6).forEach((line, i) => ctx.fillText(line, 20, 62 + i * 21, 216))
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  boardCache.set(key, tex)
  return tex
}

type FitProps = { shop: ShopDef; L: number; D: number }

/**
 * 柜台落在哪：陈列和碰撞共用一张表。
 * 以前柜台位置散在各个分支里，ShopRoom 算碰撞时只能复制一遍坐标，
 * 两边一改就对不上；现在位置只在这里定义。
 */
export function shopCounter(kind: ShopKind, L: number): { x: number; z: number; len: number } {
  switch (kind) {
    case 'bakery':
      return { x: L * 0.22, z: 0.6, len: 2.6 }
    case 'konbini':
      return { x: L / 2 - 1.5, z: 0.55, len: 2.2 }
    case 'florist':
      return { x: L * 0.28, z: 0.62, len: 2.0 }
    case 'noodle':
      return { x: L / 2 - 1.55, z: 0.6, len: 2.4 }
    case 'record':
      return { x: L / 2 - 1.6, z: 0.7, len: 2.2 }
    case 'zine':
      return { x: L / 2 - 1.35, z: 0.7, len: 2.0 }
    default:
      return { x: L / 2 - 1.5, z: 0.5, len: 2.2 }
  }
}

/** 柜台：独用一块深色台面，前面一行踢脚，背后留出店员的站位。 */
function Counter({
  x,
  z,
  len = 2.6,
  wood,
  top,
}: {
  x: number
  z: number
  len?: number
  wood: string
  top: string
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, 1, 0.6]} />
        <meshStandardMaterial color={wood} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[len + 0.12, 0.06, 0.7]} />
        <meshStandardMaterial color={top} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.06, 0.31]}>
        <boxGeometry args={[len, 0.12, 0.02]} />
        <meshStandardMaterial color="#3c3229" roughness={0.9} />
      </mesh>
      {/* 台面上的一盏小灯：柜台的暖光，也是"这家店开着"的信号 */}
      <mesh position={[len / 2 - 0.35, 1.24, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.28, 6]} />
        <meshStandardMaterial color="#4a443c" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[len / 2 - 0.35, 1.4, 0]}>
        <coneGeometry args={[0.16, 0.18, 14, 1, true]} />
        <meshStandardMaterial
          color="#efe0c2"
          side={THREE.DoubleSide}
          emissive="#e8bf78"
          emissiveIntensity={0.45}
          roughness={0.8}
        />
      </mesh>
    </group>
  )
}

/** 靠墙货架：木框 + 几层隔板 + 一排彩色"货"。cols 决定每层摆几件。 */
function Shelf({
  x,
  z,
  len,
  h = 1.9,
  wood = '#8b7355',
  tiers = 4,
  colors,
  yaw = 0,
}: {
  x: number
  z: number
  len: number
  h?: number
  wood?: string
  tiers?: number
  colors: string[]
  yaw?: number
}) {
  const rows = Math.max(2, tiers)
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, h / 2, -0.16]} castShadow receiveShadow>
        <boxGeometry args={[len, h, 0.08]} />
        <meshStandardMaterial color={wood} roughness={0.82} />
      </mesh>
      {[-len / 2 + 0.05, len / 2 - 0.05].map((sx) => (
        <mesh key={sx} position={[sx, h / 2, 0]} castShadow>
          <boxGeometry args={[0.09, h, 0.36]} />
          <meshStandardMaterial color={wood} roughness={0.82} />
        </mesh>
      ))}
      {Array.from({ length: rows }).map((_, i) => {
        const y = 0.16 + (i * (h - 0.2)) / rows
        return (
          <group key={i}>
            <mesh position={[0, y, 0]} receiveShadow>
              <boxGeometry args={[len - 0.16, 0.035, 0.34]} />
              <meshStandardMaterial color="#6e5a42" roughness={0.86} />
            </mesh>
            {Array.from({ length: Math.max(3, Math.round(len / 0.42)) }).map((_, k) => {
              const cx = -len / 2 + 0.24 + k * ((len - 0.45) / Math.max(1, Math.round(len / 0.42) - 1))
              const ch = 0.16 + ((i + k) % 3) * 0.05
              return (
                <mesh key={k} position={[cx, y + 0.02 + ch / 2, 0.01]} castShadow>
                  <boxGeometry args={[0.12, ch, 0.22]} />
                  <meshStandardMaterial color={colors[(i * 3 + k) % colors.length]} roughness={0.85} />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}

/** 小圆桌 + 两把凳子。面馆和茶室共用。 */
function Setting({ x, z, wood = '#7a5c40', r = 0.42 }: { x: number; z: number; wood?: string; r?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, 0.05, 18]} />
        <meshStandardMaterial color={wood} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.72, 8]} />
        <meshStandardMaterial color="#4e4033" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.22, 0.24, 0.05, 14]} />
        <meshStandardMaterial color="#4e4033" metalness={0.3} roughness={0.6} />
      </mesh>
      {[
        [-r - 0.36, 0],
        [r + 0.36, 0],
      ].map(([sx, sz], i) => (
        <group key={i} position={[sx, 0, sz]}>
          <mesh position={[0, 0.44, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.15, 0.06, 12]} />
            <meshStandardMaterial color={wood} roughness={0.75} />
          </mesh>
          {[
            [-0.09, -0.09],
            [0.09, -0.09],
            [-0.09, 0.09],
            [0.09, 0.09],
          ].map(([lx, lz], k) => (
            <mesh key={k} position={[lx, 0.22, lz]}>
              <cylinderGeometry args={[0.016, 0.016, 0.44, 5]} />
              <meshStandardMaterial color="#4e4033" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** 吊灯：一盏灯罩 + 一根吊线。真正照亮房间的是 ShopRoom 里的那一盏点光。 */
function Pendant({ x, z, y = 2.5, color = '#efe0c2' }: { x: number; z: number; y?: number; color?: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, y + 0.3, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.6, 4]} />
        <meshBasicMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0, y, 0]}>
        <coneGeometry args={[0.2, 0.22, 16, 1, true]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} emissive="#e9c78e" emissiveIntensity={0.4} roughness={0.8} />
      </mesh>
      <mesh position={[0, y - 0.1, 0]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial color="#fff2d8" emissive="#ffcf8a" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** 面包房的托盘：木托盘 + 几个椭圆面包。 */
function BreadTray({ x, z, yaw = 0 }: { x: number; z: number; yaw?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[0.72, 0.06, 0.44]} />
        <meshStandardMaterial color="#b99a6c" roughness={0.9} />
      </mesh>
      {[
        [-0.2, 0.1, 0.16, '#c98a45'],
        [0.02, -0.03, 0.18, '#b4763f'],
        [0.22, 0.08, 0.15, '#d8a35a'],
      ].map(([bx, bz, r, c], i) => (
        <mesh key={i} position={[bx as number, 0.11, bz as number]} scale={[1.35, 0.72, 1]} castShadow>
          <sphereGeometry args={[r as number, 12, 10]} />
          <meshStandardMaterial color={c as string} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** 花店的水桶：铁皮桶 + 几根花茎和花头。 */
function FlowerBucket({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.14, 0.44, 14, 1, true]} />
        <meshStandardMaterial color="#6f7d80" metalness={0.5} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        const h = 0.5 + (i % 3) * 0.09
        return (
          <group key={i}>
            <mesh position={[Math.cos(a) * 0.07, 0.44 + h / 2, Math.sin(a) * 0.07]}>
              <cylinderGeometry args={[0.008, 0.01, h, 4]} />
              <meshStandardMaterial color="#5c7a45" roughness={0.9} />
            </mesh>
            <mesh position={[Math.cos(a) * 0.075, 0.46 + h, Math.sin(a) * 0.075]}>
              <icosahedronGeometry args={[0.055, 0]} />
              <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** 唱片箱：斜面木箱 + 一排竖着露头的唱片。 */
function RecordBins({ x, z, yaw = 0, len = 2.2 }: { x: number; z: number; yaw?: number; len?: number }) {
  const covers = ['#6a4a3a', '#3f5060', '#7a6a3a', '#4a3f50', '#8a5040', '#3f5a50']
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.42, 0]} rotation={[-0.22, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, 0.84, 0.52]} />
        <meshStandardMaterial color="#6a533c" roughness={0.85} />
      </mesh>
      {Array.from({ length: Math.round(len / 0.16) }).map((_, i) => (
        <mesh
          key={i}
          position={[-len / 2 + 0.12 + i * 0.16, 0.72, 0.04]}
          rotation={[-0.22, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.32, 0.32, 0.012]} />
          <meshStandardMaterial color={covers[i % covers.length]} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** 玻璃门冷柜：里面亮着，外面一层淡淡的玻璃。 */
function Fridge({ x, z, yaw = 0, color = '#3f7f9a' }: { x: number; z: number; yaw?: number; color?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 1.9, 0.62]} />
        <meshStandardMaterial color="#c9ced2" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.95, 0.315]}>
        <planeGeometry args={[1.1, 1.6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
          roughness={0.2}
          metalness={0.1}
          transparent
          opacity={0.55}
        />
      </mesh>
      {[0.5, 0.95, 1.4].map((y) => (
        <mesh key={y} position={[0, y, 0.32]}>
          <boxGeometry args={[1.12, 0.02, 0.02]} />
          <meshStandardMaterial color="#8d979d" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 1.36, 0.2]}>
        <planeGeometry args={[0.9, 0.2]} />
        <meshBasicMaterial map={boardTexture('冷柜', ['饮料 / 冰淇淋', '门口自取'], color)} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** 黑板：斜靠在墙上或立在柜台边，写今日供应。 */
function Chalkboard({
  x,
  z,
  yaw,
  title,
  lines,
  bg,
}: {
  x: number
  z: number
  yaw: number
  title: string
  lines: string[]
  bg?: string
}) {
  const tex = useMemo(() => boardTexture(title, lines, bg), [title, lines.join('/'), bg])
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.62, 0]} rotation={[-0.14, 0, 0]} castShadow>
        <boxGeometry args={[0.62, 0.9, 0.03]} />
        <meshStandardMaterial color="#5a4a38" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.62, 0.017]} rotation={[-0.14, 0, 0]}>
        <planeGeometry args={[0.56, 0.82]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* 两条腿：A 字架 */}
      {[-0.22, 0.22].map((lx) => (
        <mesh key={lx} position={[lx, 0.12, -0.14]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.04, 0.28, 0.04]} />
          <meshStandardMaterial color="#5a4a38" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

/** 后墙的挂画 / 海报：用店里的主色画几块色块，不做贴图。 */
function PosterWall({ z, y, colors, width = 2.4 }: { z: number; y: number; colors: string[]; width?: number }) {
  return (
    <group position={[0, y, z]}>
      {colors.slice(0, 3).map((c, i) => (
        <mesh key={i} position={[-width / 2 + 0.5 + i * (width / 2.6), 0, 0.02]}>
          <planeGeometry args={[0.52, 0.72]} />
          <meshStandardMaterial color={c} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Fit({ shop, L, D }: FitProps) {
  const p = shop.palette
  const back = -D / 2 + 0.22
  const near = D / 2 - 0.34
  const wood = '#8b7355'
  const c = shopCounter(shop.kind, L)
  const goods = [p.accent, '#c9a06a', '#7f9a8c', '#b4763f', '#6f7f9a', '#a4627f']

  switch (shop.kind as ShopKind) {
    case 'bakery':
      return (
        <>
          <Shelf x={-L * 0.22} z={back} len={Math.min(L * 0.55, 4.4)} colors={['#c98a45', '#b4763f', '#d8a35a', '#8a5c3a']} />
          <Counter {...c} wood={p.accent} top="#e5d7bd" />
          {/* 中间的展示台：托盘是面包房的视觉中心 */}
          <group position={[-0.5, 0, 1.1]}>
            <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.9, 0.84, 0.7]} />
              <meshStandardMaterial color="#a98c6b" roughness={0.86} />
            </mesh>
            <mesh position={[0, 0.86, 0]}>
              <boxGeometry args={[2.0, 0.05, 0.78]} />
              <meshStandardMaterial color="#e0d2b8" roughness={0.7} />
            </mesh>
            <group position={[0, 0.88, 0]}>
              <BreadTray x={-0.52} z={0} yaw={0.06} />
              <BreadTray x={0.14} z={0.02} yaw={-0.04} />
              <BreadTray x={0.66} z={-0.02} yaw={0.1} />
            </group>
          </group>
          <Chalkboard x={L / 2 - 0.55} z={near - 0.25} yaw={Math.PI * 0.82} title="今日出炉" lines={['盐可颂 09:00', '黑麦 11:00', '肉桂卷 周六']} />
          <group position={[L / 2 - 0.9, 0, back + 0.5]}>
            {/* 面粉袋 */}
            <mesh position={[0, 0.24, 0]} castShadow>
              <boxGeometry args={[0.44, 0.48, 0.34]} />
              <meshStandardMaterial color="#d9cfbb" roughness={0.95} />
            </mesh>
            <mesh position={[0.5, 0.18, 0.04]} rotation={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[0.4, 0.36, 0.3]} />
              <meshStandardMaterial color="#cdc2ac" roughness={0.95} />
            </mesh>
          </group>
        </>
      )

    case 'konbini':
      return (
        <>
          <Shelf x={0} z={back} len={Math.min(L - 1.4, 5.4)} h={2.0} tiers={5} colors={goods} />
          {/* 两条中岛货架：便利店最典型的一眼 */}
          {[-1.35, 0.15].map((zx) => (
            <group key={zx} position={[zx, 0, 0.15]}>
              <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.52, 1.24, Math.min(D - 2.6, 2.4)]} />
                <meshStandardMaterial color="#cfd4d6" roughness={0.7} metalness={0.15} />
              </mesh>
              {[0.32, 0.72, 1.12].map((y) => (
                <mesh key={y} position={[0, y, 0]}>
                  <boxGeometry args={[0.54, 0.03, Math.min(D - 2.6, 2.4)]} />
                  <meshStandardMaterial color="#e8ebec" roughness={0.6} />
                </mesh>
              ))}
            </group>
          ))}
          <Counter {...c} wood="#5d6a70" top="#e8ebec" />
          <Fridge x={-L / 2 + 0.55} z={0.4} yaw={Math.PI / 2} color={p.accent} />
          <Chalkboard x={-L / 2 + 0.9} z={near - 0.5} yaw={-0.5} title="关东煮" lines={['萝卜 · 竹轮', '豆腐 · 鱼丸', '汤 24h 保温']} />
        </>
      )

    case 'florist':
      return (
        <>
          <Shelf x={-L * 0.18} z={back} len={Math.min(L * 0.5, 3.6)} tiers={3} colors={['#d98a9a', '#e8cf6a', '#9d8fd0', '#8fbf8a']} />
          {/* 地上的一排水桶：花店的主角 */}
          {[-1.6, -1.0, -0.4, 0.2].map((bx, i) => (
            <FlowerBucket key={bx} x={bx} z={0.35 + (i % 2) * 0.5} color={['#e6a2b4', '#f0d87a', '#b3a2e0', '#a8d8a0'][i]} />
          ))}
          <Counter {...c} wood="#8f7a5e" top="#e6e9de" />
          {/* 工作台：一叠牛皮纸 + 剪刀 */}
          <group position={[L * 0.18, 0, back + 0.9]}>
            <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.5, 0.88, 0.66]} />
              <meshStandardMaterial color="#9a886c" roughness={0.86} />
            </mesh>
            <mesh position={[-0.3, 0.91, 0]} rotation={[0, 0.2, 0]}>
              <boxGeometry args={[0.42, 0.03, 0.3]} />
              <meshStandardMaterial color="#c9ad82" roughness={0.95} />
            </mesh>
            <mesh position={[0.32, 0.9, 0.06]} rotation={[0, -0.3, 0.2]}>
              <boxGeometry args={[0.24, 0.02, 0.06]} />
              <meshStandardMaterial color="#8a8f92" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
          <Chalkboard x={-L / 2 + 0.75} z={near - 0.45} yaw={0.5} title="今日花材" lines={['洋桔梗 9/枝', '尤加利 18/把', '牛皮纸 免费']} />
        </>
      )

    case 'noodle':
      return (
        <>
          <Shelf x={0} z={back} len={Math.min(L - 1.6, 3.6)} h={1.5} tiers={2} colors={['#a4462f', '#c9a06a', '#6f7f6a']} />
          <Counter {...c} wood="#7a5c40" top="#d8c9ad" />
          <Setting x={-L / 2 + 1.5} z={-0.4} />
          <Setting x={-L / 2 + 1.5} z={1.3} />
          <Pendant x={-L / 2 + 1.5} z={0.45} y={2.35} />
          <Pendant x={L / 2 - 1.55} z={0.6} y={2.35} />
          <Chalkboard x={-L / 2 + 0.7} z={near - 0.5} yaw={0.35} title="今日菜单" lines={['清汤牛肉 26', '红烧牛腩 32', '酸辣粉 18']} bg="#3a2f28" />
          {/* 后墙的碗架 */}
          <group position={[L / 2 - 0.9, 0, back + 0.35]}>
            {[0.9, 1.2, 1.5].map((y) => (
              <group key={y}>
                <mesh position={[0, y, 0]}>
                  <boxGeometry args={[1.5, 0.03, 0.3]} />
                  <meshStandardMaterial color="#6e5a42" roughness={0.86} />
                </mesh>
                {[-0.5, -0.2, 0.1, 0.4].map((x) => (
                  <mesh key={x} position={[x, y + 0.07, 0]}>
                    <cylinderGeometry args={[0.11, 0.09, 0.09, 12]} />
                    <meshStandardMaterial color="#e4ddcf" roughness={0.5} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        </>
      )

    case 'record':
      return (
        <>
          <RecordBins x={-L / 2 + 1.35} z={-0.5} yaw={Math.PI / 2} len={2.6} />
          <RecordBins x={L / 2 - 1.35} z={-1.5} yaw={-Math.PI / 2} len={2.2} />
          <Counter {...c} wood="#4a4038" top="#2f2b28" />
          {/* 试听台：转盘 + 两只耳机 */}
          <group position={[L * 0.02, 0, -0.55]}>
            <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.3, 0.8, 0.6]} />
              <meshStandardMaterial color="#5b4f45" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.83, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.04, 20]} />
              <meshStandardMaterial color="#2a2724" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.86, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.01, 20]} />
              <meshStandardMaterial color="#171614" roughness={0.35} metalness={0.2} />
            </mesh>
            <mesh position={[0.22, 0.88, 0.08]} rotation={[0, 0, -0.2]}>
              <boxGeometry args={[0.28, 0.03, 0.03]} />
              <meshStandardMaterial color="#9a948c" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
          <PosterWall z={back + 0.08} y={1.7} colors={['#c08a4f', '#8a5040', '#3f5060']} width={Math.min(L - 1.2, 3.2)} />
          <Chalkboard x={-L / 2 + 0.8} z={near - 0.5} yaw={0.45} title="可试听" lines={['爵士 · 电子', '二手 80 起', '唱针已换新']} bg="#26262a" />
        </>
      )

    case 'zine':
      return (
        <>
          <Shelf x={-L * 0.2} z={back} len={Math.min(L * 0.6, 4.4)} h={2.0} tiers={5} colors={['#5f6f8a', '#8a7a4a', '#9c5f52', '#4f6b73', '#6b5a7a']} />
          {/* 中间的平摊台：小册子和明信片摊开摆 */}
          <group position={[-0.3, 0, 0.55]}>
            <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.2, 0.84, 0.9]} />
              <meshStandardMaterial color="#8e8a7d" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.87, 0]}>
              <boxGeometry args={[2.3, 0.06, 1.0]} />
              <meshStandardMaterial color="#e5e2d8" roughness={0.7} />
            </mesh>
            {[
              [-0.7, 0.1, 0.26, 0.34, '#4f6b73'],
              [-0.25, -0.08, 0.3, 0.3, '#9c5f52'],
              [0.25, 0.12, 0.28, 0.3, '#5f6f8a'],
              [0.7, -0.05, 0.24, 0.32, '#8a7a4a'],
            ].map(([bx, bz, bw, bh, c], i) => (
              <mesh key={i} position={[bx as number, 0.9 + (bh as number) / 2, bz as number]} rotation={[0, i * 0.12 - 0.15, 0]} castShadow>
                <boxGeometry args={[bw as number, bh as number, 0.02]} />
                <meshStandardMaterial color={c as string} roughness={0.9} />
              </mesh>
            ))}
          </group>
          <Counter {...c} wood="#7f7a6d" top="#e5e2d8" />
          <PosterWall z={back + 0.08} y={1.95} colors={['#5f6f8a', '#c9a06a', '#6b5a7a']} width={Math.min(L - 1.2, 3.0)} />
        </>
      )

    case 'tea':
    default:
      return (
        <>
          <Shelf x={0} z={back} len={Math.min(L - 1.6, 3.8)} h={1.8} tiers={3} colors={['#6a7f6b', '#c9a06a', '#8f7a5e', '#e4dfd3']} />
          <Counter {...c} wood="#7d6a52" top="#e4dfd3" />
          {/* 面河的一排窗边座：贴着玻璃，朝街 */}
          <group position={[-L * 0.1, 0, near - 0.55]}>
            <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
              <boxGeometry args={[Math.min(L - 2.2, 3.4), 0.06, 0.5]} />
              <meshStandardMaterial color="#a89a80" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.36, 0]}>
              <boxGeometry args={[Math.min(L - 2.4, 3.2), 0.68, 0.14]} />
              <meshStandardMaterial color="#8f7d64" roughness={0.85} />
            </mesh>
            {[-1.1, 0, 1.1].map((sx) => (
              <group key={sx} position={[sx, 0, 0.55]}>
                <mesh position={[0, 0.44, 0]} castShadow>
                  <cylinderGeometry args={[0.17, 0.16, 0.06, 12]} />
                  <meshStandardMaterial color="#7d6a52" roughness={0.75} />
                </mesh>
                <mesh position={[0, 0.22, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.44, 8]} />
                  <meshStandardMaterial color="#4e4033" roughness={0.7} />
                </mesh>
              </group>
            ))}
          </group>
          <Setting x={-L / 2 + 1.6} z={-0.7} wood="#7d6a52" r={0.4} />
          <Pendant x={-L / 2 + 1.6} z={-0.7} y={2.3} />
          <Pendant x={L / 2 - 1.5} z={0.5} y={2.3} />
          <Chalkboard x={-L / 2 + 0.8} z={near - 0.6} yaw={0.4} title="三种茶" lines={['白毫 38/壶', '熟普 32/壶', '冷泡 28']} bg="#2d3a34" />
        </>
      )
  }
}

export function ShopFit(props: FitProps) {
  return <Fit {...props} />
}
