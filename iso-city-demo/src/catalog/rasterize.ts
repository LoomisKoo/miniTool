// 配方 → 像素。纯函数，不碰 DOM、不依赖 three。
//
// 输出是「索引图」：每个像素 1 字节，编码
//   0                    → 透明
//   1 + slot + 16*shade  → slot 0..7，shade 0..14（7 为正常亮度）
// 这样一张图集同时承载了「哪个部位」和「明暗」，换色只需要换调色板。

import { SLOT, hashString, mulberry, type FishRecipe, type PetRecipe } from './recipes'

export const CELL = 64
export const PET_FRAMES = 8
export const FISH_FRAMES = 2

/** 脚底在格子里的位置：所有缩放都围绕这条线，所以宠物不会浮起来。 */
const GROUND = 0.38

const BYTE_MAX_SHADE = 14

export const decodeSlot = (byte: number) => (byte - 1) % 16
export const decodeShade = (byte: number) => Math.min(BYTE_MAX_SHADE, Math.floor((byte - 1) / 16))
/** shade 0..14 → 0.55..1.45 的亮度倍数。 */
export const shadeMul = (shade: number) => 0.55 + shade * 0.064

const clampShade = (v: number) => (v < 0 ? 0 : v > BYTE_MAX_SHADE ? BYTE_MAX_SHADE : Math.round(v))

class Cell {
  data = new Uint8Array(CELL * CELL)

  put(x: number, y: number, slot: number, shade: number) {
    const px = Math.round(x)
    const py = Math.round(y)
    if (px < 0 || py < 0 || px >= CELL || py >= CELL) return
    this.data[py * CELL + px] = 1 + slot + 16 * clampShade(shade)
  }

  on(x: number, y: number) {
    return this.data[y * CELL + x] !== 0
  }
}

const hash2 = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

// ---------------------------------------------------------------------------
// 体型原型
// ---------------------------------------------------------------------------

type BodyDef = {
  fn: (u: number, v: number) => boolean
  w: number
  h: number
  eyeDx: number
  eyeV: number
}

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 2): ((u: number, v: number) => boolean) => {
  return (u, v) => Math.pow(Math.abs((u - cx) / rx), n) + Math.pow(Math.abs((v - cy) / ry), n) <= 1
}

const teardrop = (u: number, v: number) => {
  const w = 0.3 * (1 - Math.max(0, v - 0.08) * 1.15)
  if (w <= 0.01) return false
  return (u * u) / (w * w) + ((v - 0.02) * (v - 0.02)) / (0.32 * 0.32) <= 1
}

const starBody = (u: number, v: number) => {
  const dx = u
  const dy = v - 0.03
  const r = Math.hypot(dx, dy)
  const a = Math.atan2(dy, dx)
  return r <= 0.285 * (1 + 0.22 * Math.cos(a * 5))
}

const BODIES: BodyDef[] = [
  { fn: ellipse(0, 0.02, 0.3, 0.29), w: 0.3, h: 0.29, eyeDx: 0.105, eyeV: -0.06 },
  { fn: ellipse(0, 0.02, 0.29, 0.31), w: 0.29, h: 0.31, eyeDx: 0.1, eyeV: -0.08 },
  { fn: ellipse(0, 0.04, 0.34, 0.24, 2.2), w: 0.34, h: 0.24, eyeDx: 0.12, eyeV: -0.02 },
  { fn: ellipse(0, 0.0, 0.23, 0.35), w: 0.23, h: 0.35, eyeDx: 0.085, eyeV: -0.13 },
  { fn: ellipse(0, 0.05, 0.36, 0.19, 2.4), w: 0.36, h: 0.19, eyeDx: 0.125, eyeV: 0.0 },
  { fn: ellipse(0, 0.03, 0.27, 0.27, 4), w: 0.27, h: 0.27, eyeDx: 0.1, eyeV: -0.05 },
  { fn: teardrop, w: 0.27, h: 0.32, eyeDx: 0.095, eyeV: -0.09 },
  { fn: starBody, w: 0.285, h: 0.285, eyeDx: 0.1, eyeV: -0.03 },
]

// ---------------------------------------------------------------------------
// 姿态（8 帧）
// ---------------------------------------------------------------------------

export type PetPose = { squash: number; lift: number; blink: boolean }

export const PET_POSES: PetPose[] = [
  { squash: 1.0, lift: 0, blink: false },
  { squash: 1.02, lift: -1, blink: false },
  { squash: 1.04, lift: -1, blink: false },
  { squash: 1.02, lift: -1, blink: true },
  { squash: 0.97, lift: 0, blink: false },
  { squash: 1.0, lift: -2, blink: false },
  { squash: 0.88, lift: 3, blink: false },
  { squash: 0.8, lift: 5, blink: true },
]

export const PET_POSE_LABEL = ['待机·呼', '待机·吸', '待机·满', '待机·眨眼', '走·A', '走·B', '坐', '睡']
export const FISH_POSE_LABEL = ['摆尾·A', '摆尾·B']

// ---------------------------------------------------------------------------
// 尾巴
// ---------------------------------------------------------------------------

type Anchor = { x: number; y: number }

function drawTail(c: Cell, kind: number, at: Anchor, shade: number) {
  const { x: ax, y: ay } = at
  switch (kind) {
    case 0: {
      for (let a = 0; a < Math.PI * 1.7; a += 0.16) {
        const r = 2.5 + a * 1.6
        c.put(ax + Math.cos(a) * r, ay + Math.sin(a) * r * 0.85, SLOT.tail, shade)
      }
      break
    }
    case 1: {
      for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -5; dx <= 6; dx++) {
          if ((dx * dx) / 30 + (dy * dy) / 40 > 1) continue
          if (hash2(dx + 3, dy + 7) < 0.1) continue
          c.put(ax + dx, ay + dy, SLOT.tail, shade)
        }
      }
      break
    }
    case 2: {
      for (let i = 0; i < 15; i++) {
        c.put(ax + i * 0.75, ay - i * 0.55 + Math.sin(i * 0.45) * 2.2, SLOT.tail, shade)
      }
      break
    }
    case 3: {
      for (let dy = -4; dy <= 4; dy++) {
        const half = 4 - Math.abs(dy) * 0.7
        for (let dx = 0; dx <= half; dx += 0.5) c.put(ax + dx, ay + dy, SLOT.tail, shade)
      }
      break
    }
    case 4: {
      for (let i = 0; i < 4; i++) {
        const dx = 2 + i * 3
        c.put(ax + dx, ay - i, SLOT.tail, shade + 2)
        c.put(ax + dx, ay - i + 1, SLOT.tail, shade + 1)
      }
      break
    }
    default:
      break
  }
}

// ---------------------------------------------------------------------------
// 耳朵
// ---------------------------------------------------------------------------

function drawEars(c: Cell, kind: number, centerX: number, baseY: number, spacing: number, shade: number) {
  for (const side of [-1, 1]) {
    const cx = centerX + side * spacing
    const cy = baseY
    switch (kind) {
      case 0: {
        for (let dy = 0; dy <= 8; dy++) {
          const w = Math.round(((8 - dy) / 8) * 3.2)
          for (let dx = -w; dx <= w; dx++) c.put(cx + dx, cy - dy, SLOT.ear, shade - 1)
        }
        break
      }
      case 1: {
        for (let dy = 0; dy <= 9; dy++) {
          const w = 2 + Math.round(Math.sin(((dy + 1) / 10) * Math.PI) * 2.2)
          for (let dx = -w; dx <= w; dx++) c.put(cx + dx + side, cy - 1 + dy, SLOT.ear, shade - 2)
        }
        break
      }
      case 2: {
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (dx * dx + dy * dy <= 9) c.put(cx + dx, cy - 3 + dy, SLOT.ear, shade - 1)
          }
        }
        break
      }
      case 3: {
        for (let dy = 0; dy <= 8; dy++) {
          const w = Math.round(((8 - dy) / 8) * 1.6)
          for (let dx = -w; dx <= w; dx++) c.put(cx + dx + side * dy * 0.3, cy - dy, SLOT.ear, shade + 1)
        }
        break
      }
      case 4: {
        for (let dy = 0; dy <= 8; dy++) {
          c.put(cx + side * Math.round(dy * 0.45), cy - dy, SLOT.ear, shade - 3)
        }
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) c.put(cx + side * 4 + dx, cy - 9 + dy, SLOT.ear, shade + 3)
        }
        break
      }
      default:
        break
    }
  }
}

// ---------------------------------------------------------------------------
// 花纹
// ---------------------------------------------------------------------------

function patternHit(kind: number, u: number, v: number, seed: number) {
  switch (kind) {
    case 1:
      return hash2(Math.floor(u * 26) + seed * 90, Math.floor(v * 26)) < 0.24
    case 2:
      return Math.sin(u * 30 + seed * 9) > 0.5
    case 3:
      return hash2(Math.floor(u * 44) + 3, Math.floor(v * 44) + 5) < (v + 0.32) * 0.85
    case 4:
      return v < -0.14
    case 6:
      return hash2(Math.floor(u * 34) + 11, Math.floor(v * 34) + 7) < 0.12
    case 7:
      return Math.sin((u + v) * 24 + seed * 6) > 0.62
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// 眼睛
// ---------------------------------------------------------------------------

function drawEyes(c: Cell, kind: number, at: Anchor, dx: number, shade: number, blink: boolean) {
  const shape = blink ? 4 : kind
  for (const side of [-1, 1]) {
    const cx = at.x + side * dx
    const cy = at.y
    switch (shape) {
      case 0: {
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) c.put(cx + ox, cy + oy, SLOT.eye, 8)
        c.put(cx - 1, cy - 1, SLOT.eye, 13)
        break
      }
      case 1: {
        for (let ox = 0; ox <= 1; ox++) for (let oy = 0; oy <= 1; oy++) c.put(cx + ox - (side < 0 ? 0 : 1), cy + oy, SLOT.eye, 8)
        break
      }
      case 2: {
        c.put(cx, cy - 1, SLOT.eye, 9)
        c.put(cx - 1, cy, SLOT.eye, 9)
        c.put(cx, cy, SLOT.eye, 12)
        c.put(cx + 1, cy, SLOT.eye, 9)
        c.put(cx, cy + 1, SLOT.eye, 9)
        break
      }
      case 3: {
        for (let oy = -1; oy <= 1; oy++) c.put(cx, cy + oy, SLOT.eye, 7)
        break
      }
      default: {
        for (let ox = -1; ox <= 1; ox++) c.put(cx + ox, cy, SLOT.eye, shade - 3)
        break
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 宠物
// ---------------------------------------------------------------------------

export function rasterizePet(recipe: PetRecipe, frame: number): Uint8Array {
  const pose = PET_POSES[frame % PET_FRAMES]
  const def = BODIES[recipe.body] ?? BODIES[0]
  const c = new Cell()
  const seed = recipe.seed
  const squash = pose.squash
  const lift = pose.lift / CELL
  // 身体整体抬高一点点，给脚留出位置——脚必须落在地面线上，
  // 不能沉到 y=0 以下，否则精灵的下缘会被地面切掉。
  const foot = GROUND - 0.055

  const bodyV = (pv: number) => (pv - foot - lift) / squash + def.h
  const projY = (bv: number) => foot + (bv - def.h) * squash + lift

  // 尾巴先画，被身体压住，看起来才是「长出来的」
  const tailAt = { x: (def.w * 0.86 + 0.5) * CELL, y: (projY(def.h * 0.42) + 0.5) * CELL }
  drawTail(c, recipe.tail, tailAt, 6)

  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const u = (x + 0.5) / CELL - 0.5
      const pv = (y + 0.5) / CELL - 0.5
      const bv = bodyV(pv)
      if (!def.fn(u, bv)) continue

      const hl = Math.max(0, 1 - Math.hypot((u + 0.12) / 0.1, (bv + 0.14) / 0.08))
      const shade = 9 - bv * 10 + hl * 3

      let slot: number = SLOT.body
      if (bv > 0.16) slot = SLOT.belly
      else if (patternHit(recipe.pattern, u, bv, seed)) slot = SLOT.accent

      c.put(x, y, slot, shade)
    }
  }

  // 两只脚：椭圆的肚子下面长出两个小凸起，剪影立刻从「蛋」变成「生物」
  for (const side of [-1, 1]) {
    const fx = 32 + side * def.w * CELL * 0.44
    const fy = (GROUND + 0.5) * CELL - 1
    const rx = def.w * CELL * 0.34
    const ry = 2.6
    for (let dy = -Math.ceil(ry); dy <= 0; dy++) {
      for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue
        c.put(fx + dx, fy + dy, SLOT.belly, 6 + dy * 0.4)
      }
    }
  }

  drawEars(c, recipe.ears, 32, (projY(-def.h * 0.9) + 0.5) * CELL, def.w * CELL * 0.46, 10)

  const eyeY = (projY(def.eyeV) + 0.5) * CELL
  drawEyes(c, recipe.eyes, { x: 32, y: Math.round(eyeY) }, def.eyeDx * CELL, 9, pose.blink)

  // 嘴：两个像素的短弧。有嘴才会「有表情」，这一点比增加眼睛类型更划算
  if (!pose.blink) {
    const my = Math.round(eyeY + 5)
    c.put(32, my, SLOT.eye, 4)
    c.put(31, my - 1, SLOT.eye, 4)
    c.put(33, my - 1, SLOT.eye, 4)
  }

  outline(c)
  return c.data
}

// ---------------------------------------------------------------------------
// 鱼
// ---------------------------------------------------------------------------

type FishBodyDef = { fn: (u: number, v: number) => boolean; w: number; h: number; eyeDx: number }

const broadHead = (u: number, v: number) => {
  const head = ellipse(0.06, 0, 0.2, 0.19)(u, v)
  const tail = ellipse(-0.12, 0, 0.2, 0.11)(u, v)
  return head || tail
}

const FISH_BODIES: FishBodyDef[] = [
  { fn: ellipse(0, 0, 0.32, 0.16), w: 0.32, h: 0.16, eyeDx: 0.17 },
  { fn: ellipse(0, 0, 0.24, 0.27), w: 0.24, h: 0.27, eyeDx: 0.12 },
  { fn: ellipse(0, 0, 0.37, 0.09, 2.2), w: 0.37, h: 0.09, eyeDx: 0.22 },
  { fn: ellipse(0, 0, 0.26, 0.22), w: 0.26, h: 0.22, eyeDx: 0.14 },
  { fn: broadHead, w: 0.26, h: 0.19, eyeDx: 0.17 },
]

function drawFishTail(c: Cell, kind: number, at: Anchor, shade: number, sway: number) {
  const { x: ax, y: ay } = at
  const y0 = ay + sway
  switch (kind) {
    case 0: {
      for (let dy = -6; dy <= 6; dy++) {
        const reach = 1 + (6 - Math.abs(dy)) * 0.75
        for (let dx = 0; dx <= reach; dx++) c.put(ax - dx, y0 + dy, SLOT.tail, shade)
      }
      break
    }
    case 1: {
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = 0; dx <= 5; dx++) {
          if ((dx * dx) / 26 + (dy * dy) / 28 > 1) continue
          c.put(ax + 2 - dx, y0 + dy, SLOT.tail, shade)
        }
      }
      break
    }
    case 2: {
      for (let dy = -6; dy <= 6; dy++) {
        const d = Math.abs(dy) / 6
        const inner = 2 + d * 2
        const outer = 8 - d * 2
        for (let dx = inner; dx <= outer; dx++) c.put(ax - dx, y0 + dy * (1 - 0.2 * d), SLOT.tail, shade)
      }
      break
    }
    default: {
      for (let i = 0; i < 9; i++) c.put(ax - i * 0.8, y0 + Math.sin(i * 0.5) * 2, SLOT.tail, shade)
      break
    }
  }
}

function drawFishFin(c: Cell, kind: number, at: Anchor, shade: number) {
  const { x: ax, y: ay } = at
  switch (kind) {
    case 0: {
      for (let dy = 0; dy <= 5; dy++) {
        const half = (5 - dy) * 1.3
        for (let dx = -half; dx <= half; dx += 0.5) c.put(ax + dx, ay - dy, SLOT.ear, shade)
      }
      break
    }
    case 1: {
      for (let dy = 0; dy <= 7; dy++) {
        const w = 1 + dy * 0.35
        c.put(ax - w, ay - dy, SLOT.ear, shade)
        c.put(ax, ay - dy, SLOT.ear, shade)
        c.put(ax + w, ay - dy, SLOT.ear, shade)
      }
      break
    }
    case 2: {
      for (let i = 0; i < 8; i++) c.put(ax - i * 0.9, ay - i * 0.5 + Math.sin(i * 0.6) * 1.5, SLOT.ear, shade)
      break
    }
    default: {
      for (let i = 0; i < 4; i++) c.put(ax - 3 + i * 2, ay - 3 - (i % 2), SLOT.ear, shade + 1)
      break
    }
  }
}

export function rasterizeFish(recipe: FishRecipe, frame: number): Uint8Array {
  const def = FISH_BODIES[recipe.body] ?? FISH_BODIES[0]
  const c = new Cell()
  const sway = frame % 2 === 0 ? -2 : 2

  // 尾巴在左，头在右
  drawFishTail(c, recipe.tail, { x: 32 - def.w * CELL * 0.9, y: 32 }, 6, sway)

  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const u = (x + 0.5) / CELL - 0.5
      const v = (y + 0.5) / CELL - 0.5
      if (!def.fn(u, v)) continue
      const shade = 9 - v * 9 + Math.max(0, 1 - Math.hypot((u + 0.1) / 0.16, (v + 0.1) / 0.07)) * 2.5
      let slot: number = SLOT.body
      if (v > 0.04) slot = SLOT.belly
      else if (patternHit(recipe.pattern, u, v, recipe.seed)) slot = SLOT.accent
      c.put(x, y, slot, shade)
    }
  }

  drawFishFin(c, recipe.fin, { x: 32 + def.w * CELL * 0.1, y: (0.5 - def.h) * CELL }, 8)

  // 鱼是侧视：只画一只眼
  const eyeX = 32 + def.eyeDx * CELL
  const eyeY = 30
  const er = recipe.eyes === 0 ? 1 : 0
  for (let ox = -er; ox <= er; ox += 1) {
    for (let oy = -er; oy <= er; oy += 1) c.put(eyeX + ox, eyeY + oy, SLOT.eye, 8)
  }
  if (er > 0) c.put(eyeX - 1, eyeY - 1, SLOT.eye, 13)

  outline(c)
  return c.data
}

// ---------------------------------------------------------------------------
// 描边：轮廓外扩 1px 的暗色，像素精灵「站得住」全靠这一圈
// ---------------------------------------------------------------------------

function outline(c: Cell) {
  const src = c.data
  const filled = new Uint8Array(CELL * CELL)
  for (let i = 0; i < src.length; i++) filled[i] = src[i] ? 1 : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= CELL || y >= CELL ? 0 : filled[y * CELL + x])
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (at(x, y)) continue
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
        src[y * CELL + x] = 1 + SLOT.body + 16 * 1
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 装饰品：独立一层，叠在宠物上（不烘进图集，避免组合爆炸）
// ---------------------------------------------------------------------------

export const DECOS = ['hat', 'scarf', 'bow', 'glasses', 'wings', 'bell'] as const
export type DecoId = (typeof DECOS)[number]

export const DECO_LABEL: Record<DecoId, string> = {
  hat: '小帽',
  scarf: '围巾',
  bow: '蝴蝶结',
  glasses: '眼镜',
  wings: '小翅膀',
  bell: '铃铛',
}

export function rasterizeDeco(id: DecoId): Uint8Array {
  const c = new Cell()
  switch (id) {
    case 'hat': {
      for (let dx = -9; dx <= 9; dx++) c.put(32 + dx, 14, SLOT.deco, 8)
      for (let dy = 1; dy <= 7; dy++) {
        const w = 5 - Math.floor(dy / 2)
        for (let dx = -w; dx <= w; dx++) c.put(32 + dx, 14 - dy, SLOT.deco, 9)
      }
      break
    }
    case 'scarf': {
      for (let dx = -11; dx <= 11; dx++) {
        c.put(32 + dx, 36, SLOT.deco, 8)
        c.put(32 + dx, 37, SLOT.deco, 8)
      }
      for (let dy = 0; dy < 7; dy++) {
        c.put(32 + 9, 38 + dy, SLOT.deco, 7)
        c.put(32 + 10, 38 + dy, SLOT.deco, 7)
      }
      break
    }
    case 'bow': {
      for (let dx = 2; dx <= 7; dx++) {
        for (let dy = -2; dy <= 2; dy++) c.put(32 + dx, 14 + dy, SLOT.deco, 9)
        for (let dy = -2; dy <= 2; dy++) c.put(32 - dx, 14 + dy, SLOT.deco, 9)
      }
      c.put(32, 14, SLOT.deco, 12)
      break
    }
    case 'glasses': {
      for (const side of [-1, 1]) {
        const cx = 32 + side * 7
        for (let a = 0; a < 6.28; a += 0.25) c.put(cx + Math.cos(a) * 4, 28 + Math.sin(a) * 3.2, SLOT.deco, 9)
      }
      for (let dx = -3; dx <= 3; dx++) c.put(32 + dx, 28, SLOT.deco, 9)
      break
    }
    case 'wings': {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const w = 5 - i * 0.6
          for (let dy = 0; dy <= w; dy += 0.5) c.put(32 + side * (12 + i), 34 + dy, SLOT.deco, 8 + i * 0.4)
        }
      }
      break
    }
    default: {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) c.put(32 + dx, 38 + dy, SLOT.deco, 10)
      break
    }
  }
  outline(c)
  return c.data
}

export const DECO_FRAMES = 1
export const decoIndex = (id: DecoId) => DECOS.indexOf(id)

/**
 * 项圈：一个按体型生成的独立图层。
 *
 * 为什么不烘进宠物图集——因为「有没有项圈」和「什么颜色的项圈」是运行时的
 * 归属状态，烘进去就得为每只宠物存两套图。做成 8 个（每种体型一个）的
 * 通用图层，配 SLOT.collar 取色即可，代价只有 8 个格子。
 */
export function rasterizeCollar(bodyIndex: number): Uint8Array {
  const def = BODIES[bodyIndex] ?? BODIES[0]
  const c = new Cell()
  const halfW = Math.round(def.w * CELL * 0.9)
  // 项圈落在身体下部约 1/3 处：再往下就滑到脚底，再往上会挡住眼睛
  const bandY = Math.round((GROUND + (0.02 - def.h) + 0.5) * CELL)
  for (let dx = -halfW; dx <= halfW; dx++) {
    const t = Math.abs(dx) / halfW
    if (t > 0.97) continue
    const th = t > 0.88 ? 1 : t > 0.5 ? 2 : 3
    for (let k = 0; k < th; k++) c.put(32 + dx, bandY + k, SLOT.collar, 11 - t * 4)
  }
  // 小铃铛：只在正面中央
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) c.put(32 + dx, bandY + 3 + dy, SLOT.deco, 12)
  }
  return c.data
}

export const COLLAR_COUNT = BODIES.length
