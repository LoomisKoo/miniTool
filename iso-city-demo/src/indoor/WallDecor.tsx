// 墙面软装：发光灯牌、白板、玻璃隔断带。
//
// 参考图里最"像办公室"的其实不是家具，而是墙上那几样东西：
// 一块会发光的灯牌、一块写满东西的白板、一段带黑框的玻璃隔断。
// 它们全都贴墙安装、不占地面、不参与碰撞——所以可以无条件铺进每一户，
// 不用像家具那样担心挡住门口或把玩家关在角落里。
//
// 位置从「这户还剩哪些空墙」推：先用 freeWallRuns 扣掉洞口和隔墙，
// 再由 Features 把画廊墙 / 影院 / 画作 / 留言台已经占掉的段传进来，
// 剩下的段按长度从长到短分配。三种软装轮换着铺，同一户不重样。

import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Side } from '../data/units'
import { inwardYaw, useWallCut, wallPoint, type RoomBox, type WallRun } from './RoomKit'
import { INDOOR_STYLE, hashOf, lighten, pick } from './style'

/** 一段被占用的墙面（沿墙坐标，原点在墙中点）。 */
export type WallSpan = { side: Side; a0: number; a1: number }

/**
 * 从空墙段里扣掉已被占用的区间。
 * 剩下的段不足 1.2m 就不要了——挂不下东西，只会在墙角露出一截贴图边。
 */
export function carveRuns(walls: WallRun[], used: WallSpan[]): WallRun[] {
  const out: WallRun[] = []
  for (const w of walls) {
    const busy = used
      .filter((u) => u.side === w.side)
      .map((u) => [u.a0, u.a1] as [number, number])
      .sort((a, b) => a[0] - b[0])
    const end = w.center + w.len / 2
    let cursor = w.center - w.len / 2
    for (const [a, b] of busy) {
      const stop = Math.min(a, end)
      if (stop - cursor > 1.2) out.push({ side: w.side, center: (cursor + stop) / 2, len: stop - cursor })
      cursor = Math.max(cursor, Math.min(b, end))
    }
    if (end - cursor > 1.2) out.push({ side: w.side, center: (cursor + end) / 2, len: end - cursor })
  }
  return out
}

// ---------------------------------------------------------------------------
// 贴图：都做成"一次画好、缓存复用"，同一条文字/同一块白板只生成一次。
// ---------------------------------------------------------------------------

const neonCache = new Map<string, THREE.CanvasTexture>()

/** 霓虹字：三层外发光 + 一层白芯，配合 Bloom 就是真灯管。 */
function neonTexture(text: string, color: string) {
  const key = `${text}|${color}`
  const hit = neonCache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 320
  const ctx = canvas.getContext('2d')!
  const draw = (blur: number, fill: string) => {
    ctx.shadowColor = color
    ctx.shadowBlur = blur
    ctx.fillStyle = fill
    ctx.fillText(text, 512, 168, 900)
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 150px "Helvetica Neue", Arial, sans-serif'
  draw(64, color)
  draw(38, color)
  draw(18, lighten(color, 0.45))
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, 512, 168, 900)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  neonCache.set(key, tex)
  return tex
}

const boardCache = new Map<string, THREE.CanvasTexture>()

/** 白板：板面 + 手写几行 + 三张便利贴 + 底部马克笔槽。种子决定手写走向。 */
function boardTexture(seed: string) {
  const hit = boardCache.get(seed)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 576
  const ctx = canvas.getContext('2d')!
  let state = hashOf(seed) || 1
  const rand = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
  ctx.fillStyle = '#f4f5f1'
  ctx.fillRect(0, 0, 1024, 576)
  // 极淡的点阵：白板也不再是一块纯白纸
  ctx.fillStyle = 'rgba(120,140,150,.10)'
  for (let gy = 24; gy < 576; gy += 34) {
    for (let gx = 24; gx < 1024; gx += 34) ctx.fillRect(gx, gy, 2, 2)
  }
  // 手写：几段折线，像会议留下来的草图
  const inks = ['#2f4a63', '#3f6f5c', '#7a4a63']
  for (let line = 0; line < 5; line++) {
    const y = 96 + line * 74
    const ink = inks[line % inks.length]
    ctx.strokeStyle = ink
    ctx.globalAlpha = 0.82
    ctx.lineWidth = 3.2
    ctx.beginPath()
    let x = 70 + rand() * 40
    ctx.moveTo(x, y)
    const segs = 2 + Math.floor(rand() * 3)
    for (let s = 0; s < segs; s++) {
      const w = 90 + rand() * 180
      ctx.bezierCurveTo(x + w * 0.3, y - 16, x + w * 0.7, y + 14, x + w, y - 2)
      x += w + 24
    }
    ctx.stroke()
  }
  // 框 + 箭头
  ctx.strokeStyle = '#2f4a63'
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 4
  ctx.strokeRect(660, 92, 250, 150)
  ctx.beginPath()
  ctx.moveTo(700, 300)
  ctx.lineTo(820, 380)
  ctx.stroke()
  // 便利贴
  const notes = ['#f2d06b', '#e8957f', '#8bc7a8', '#a8b8e0']
  for (let i = 0; i < 3; i++) {
    const x = 120 + i * 240 + rand() * 40
    const y = 340 + rand() * 60
    const w = 120 + rand() * 40
    ctx.globalAlpha = 1
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((rand() - 0.5) * 0.12)
    ctx.fillStyle = notes[i % notes.length]
    ctx.fillRect(0, 0, w, w * 0.82)
    ctx.fillStyle = 'rgba(255,255,255,.22)'
    ctx.fillRect(0, 0, w, 10)
    ctx.strokeStyle = 'rgba(60,60,60,.35)'
    ctx.lineWidth = 2
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      ctx.moveTo(12, 22 + k * 20)
      ctx.lineTo(w - 14 - rand() * 30, 22 + k * 20)
      ctx.stroke()
    }
    ctx.restore()
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  boardCache.set(seed, tex)
  return tex
}

// ---------------------------------------------------------------------------
// 三件软装
// ---------------------------------------------------------------------------

const NEON_WORDS = ['STUDIO', 'IDEAS', 'OPEN', 'MAKE', 'WORK', 'LIVE', 'PLAY', 'CRAFT']
const NEON_COLORS = ['#5ee6c0', '#ff8ac2', '#ffd166', '#7ad5ff', '#c9a3ff']

/** 发光灯牌：深色背板 + 霓虹字 + 一圈晕光。挂在 2m 左右，抬头就能看见。 */
function NeonSign({ box, side, a0, a1, seed }: { box: RoomBox; side: Side; a0: number; a1: number; seed: string }) {
  const text = pick(NEON_WORDS, seed)
  const color = pick(NEON_COLORS, `${seed}-c`)
  const tex = useMemo(() => neonTexture(text, color), [text, color])
  const cut = useWallCut(side, box)
  const len = a1 - a0
  const w = Math.min(1.7, len)
  const h = w * 0.31
  const y = Math.min(box.H - 0.42, 2.0)
  const [x, z] = wallPoint(box, side, (a0 + a1) / 2, 0.05)
  return (
    <group ref={cut} position={[x, y, z]} rotation={[0, inwardYaw(side), 0]} userData={{ noOcclude: true }}>
      {/* 背板：比字大一圈的深色金属，字才有"装在一块板上"的感觉 */}
      <mesh position={[0, 0, 0.018]} castShadow>
        <boxGeometry args={[w + 0.1, h + 0.1, 0.03]} />
        <meshStandardMaterial color="#171d21" roughness={0.42} metalness={0.55} envMapIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.037]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* 灯牌自身的晕光：打到墙上的一小片彩色 */}
      <mesh position={[0, 0, 0.042]}>
        <planeGeometry args={[w * 1.25, h * 1.7]} />
        <meshBasicMaterial color={color} transparent opacity={0.085} toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 0, 0.5]} color={color} intensity={1.5} distance={3.6} decay={2} />
    </group>
  )
}

/** 白板：铝框 + 板面 + 马克笔槽 + 两支护笔。自带一点冷光，俯视时不会陷进墙里。 */
function Whiteboard({ box, side, a0, a1, seed }: { box: RoomBox; side: Side; a0: number; a1: number; seed: string }) {
  const tex = useMemo(() => boardTexture(seed), [seed])
  const cut = useWallCut(side, box)
  const len = a1 - a0
  const w = Math.min(1.9, len)
  const h = Math.min(1.15, w * 0.56)
  const y = Math.min(box.H - 0.52, 1.62)
  const [x, z] = wallPoint(box, side, (a0 + a1) / 2, 0.045)
  const markers = ['#d4574e', '#3f6f9a', '#3f8a63']
  return (
    <group ref={cut} position={[x, y, z]} rotation={[0, inwardYaw(side), 0]} userData={{ noOcclude: true }}>
      {/* 铝框 */}
      <mesh position={[0, 0, 0.016]} castShadow>
        <boxGeometry args={[w + 0.07, h + 0.07, 0.03]} />
        <meshStandardMaterial color="#aab3b8" roughness={0.34} metalness={0.72} envMapIntensity={1.15} />
      </mesh>
      <mesh position={[0, 0, 0.034]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* 顶部一条很淡的冷光：白板是靠漫反射亮起来的 */}
      <mesh position={[0, 0, 0.036]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#dff0f8" transparent opacity={0.16} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* 笔槽 + 两支笔 + 板擦 */}
      <mesh position={[0, -h / 2 - 0.065, 0.055]} castShadow>
        <boxGeometry args={[w, 0.035, 0.08]} />
        <meshStandardMaterial color="#8d979c" roughness={0.4} metalness={0.6} />
      </mesh>
      {markers.map((c, i) => (
        <mesh
          key={c}
          position={[-w * 0.22 + i * 0.1, -h / 2 - 0.03, 0.062]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.014, 0.014, 0.14, 10]} />
          <meshStandardMaterial color={c} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[w * 0.28, -h / 2 - 0.03, 0.06]} castShadow>
        <boxGeometry args={[0.16, 0.04, 0.06]} />
        <meshStandardMaterial color="#2f3438" roughness={0.85} />
      </mesh>
    </group>
  )
}

/**
 * 玻璃隔断带：贴墙的一段通高玻璃 + 深色细框 + 顶部灯带。
 *
 * 参考图里那块玻璃隔断是用来"分区"的。这里做成贴墙的一条，
 * 因为户型的门洞、留言台、家具位置全都是从楼层平面推出来的，
 * 再塞一面落地隔断随时会把通道夹住；贴墙的做法能拿到同样的观感，
 * 又不用改碰撞。地面那一小段做磨砂，玻璃才有"落在地上"的重量。
 */
function GlassBand({ box, side, a0, a1 }: { box: RoomBox; side: Side; a0: number; a1: number }) {
  const cut = useWallCut(side, box)
  const len = a1 - a0
  const c = (a0 + a1) / 2
  const [x, z] = wallPoint(box, side, c, 0.05)
  const top = Math.min(box.H - 0.1, 2.6)
  const posts = Math.max(2, Math.round(len / 0.95) + 1)
  const rail = INDOOR_STYLE.frame
  return (
    <group ref={cut} position={[x, 0, z]} rotation={[0, inwardYaw(side), 0]}>
      {/* 玻璃：几乎全透，靠反射和边框读出来 */}
      <mesh position={[0, top / 2, 0]}>
        <planeGeometry args={[len, top]} />
        <meshStandardMaterial
          color={INDOOR_STYLE.glass}
          transparent
          opacity={0.15}
          roughness={0.04}
          metalness={0.55}
          envMapIntensity={1.7}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 下段磨砂：给玻璃一个"重量" */}
      <mesh position={[0, 0.4, 0.003]}>
        <planeGeometry args={[len, 0.8]} />
        <meshStandardMaterial
          color="#cfe2ea"
          transparent
          opacity={0.32}
          roughness={0.5}
          metalness={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 上下横梁 */}
      <mesh position={[0, top - 0.045, 0.02]} castShadow>
        <boxGeometry args={[len, 0.09, 0.1]} />
        <meshStandardMaterial color={rail} roughness={0.3} metalness={0.68} envMapIntensity={1.1} />
      </mesh>
      <mesh position={[0, 0.04, 0.02]} castShadow>
        <boxGeometry args={[len, 0.08, 0.1]} />
        <meshStandardMaterial color={rail} roughness={0.34} metalness={0.62} envMapIntensity={1.05} />
      </mesh>
      {/* 竖框 */}
      {Array.from({ length: posts }).map((_, i) => {
        const px = -len / 2 + (len * i) / (posts - 1)
        return (
          <mesh key={i} position={[px, top / 2, 0.02]} castShadow>
            <boxGeometry args={[i === 0 || i === posts - 1 ? 0.06 : 0.03, top, i === 0 || i === posts - 1 ? 0.1 : 0.075]} />
            <meshStandardMaterial color={rail} roughness={0.32} metalness={0.66} envMapIntensity={1.1} />
          </mesh>
        )
      })}
      {/* 顶部灯带：玻璃带自己发光，剖面里这一段会明显亮起来 */}
      <mesh position={[0, top - 0.1, 0.07]}>
        <planeGeometry args={[Math.max(0.2, len - 0.12), 0.03]} />
        <meshBasicMaterial color={INDOOR_STYLE.neon} transparent opacity={0.75} toneMapped={false} />
      </mesh>
      <pointLight position={[0, top - 0.3, 0.5]} color={INDOOR_STYLE.neon} intensity={0.9} distance={3.4} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 分配：一段墙一件，三种轮换
// ---------------------------------------------------------------------------

const KINDS = ['glass', 'board', 'neon'] as const

/** 每种软装的最小可用宽度（含两侧留白）。 */
const NEED: Record<(typeof KINDS)[number], number> = { glass: 1.5, board: 1.15, neon: 0.9 }

/**
 * 把三件软装铺进剩下的空墙。返回节点由调用方塞进房间。
 *
 * @param walls freeWallRuns 的结果（已扣洞口和隔墙）
 * @param used 已经被设施/画作/交互台占掉的墙段
 * @param seed 每户一个，决定先铺哪一种、灯牌写什么字
 */
export function wallDecor(box: RoomBox, walls: WallRun[], used: WallSpan[], seed: string) {
  const free = carveRuns(walls, used)
    .filter((run) => run.len >= 1.2)
    .sort((a, b) => b.len - a.len)
  const nodes: ReactNode[] = []
  const start = hashOf(seed) % KINDS.length
  let placed = 0
  for (const run of free) {
    if (placed >= 3) break
    // 从种子决定的位置开始试，第一种放不下就顺延到下一种
    for (let tries = 0; tries < KINDS.length; tries++) {
      const kind = KINDS[(start + placed + tries) % KINDS.length]
      const avail = run.len - 0.4
      if (avail < NEED[kind]) continue
      const c = run.center
      if (kind === 'glass') {
        const w = Math.min(2.8, avail)
        nodes.push(<GlassBand key={`glass-${placed}`} box={box} side={run.side} a0={c - w / 2} a1={c + w / 2} />)
      } else if (kind === 'board') {
        const w = Math.min(1.9, avail)
        nodes.push(
          <Whiteboard key={`board-${placed}`} box={box} side={run.side} a0={c - w / 2} a1={c + w / 2} seed={`${seed}-${placed}`} />,
        )
      } else {
        const w = Math.min(1.7, avail)
        nodes.push(
          <NeonSign key={`neon-${placed}`} box={box} side={run.side} a0={c - w / 2} a1={c + w / 2} seed={`${seed}-${placed}`} />,
        )
      }
      placed += 1
      break
    }
  }
  return nodes
}

/** 清理：贴图缓存是模块级的，退出房间不销毁（串门回来还要用）。 */
export function disposeNeonTextures() {
  for (const tex of neonCache.values()) tex.dispose()
  neonCache.clear()
  for (const tex of boardCache.values()) tex.dispose()
  boardCache.clear()
}
