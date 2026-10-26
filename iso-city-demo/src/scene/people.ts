import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * 路人 / NPC 的共享人体模型。
 *
 * 以前的路人是"一根圆柱 + 两根胶囊 + 一个球"，没有脖子、没有手、没有鞋，
 * 远看像保龄球瓶。这里按真实比例（约 1.72m，8 头身偏卡通的 7.2 头身）重做：
 * 胯、收腰的上衣、肩头、上臂/前臂、手、脖子、略长的头、几种发型、鞋。
 * 每个部件烘焙顶点色后合并成 5 块几何（身体 + 双臂 + 双腿），
 * 手臂和腿各自有关节支点，可以摆臂走路。
 */

export type HairStyle = 'short' | 'long' | 'bun' | 'cap' | 'bald'

export type Look = {
  coat: string
  coatDark: string
  shirt: string
  pants: string
  shoes: string
  skin: string
  hair: string
  hairStyle: HairStyle
  /** 外套下摆长度：0 = 短夹克，1 = 过臀长外套 */
  coatLength: number
  bag: boolean
  /** 身形：肩宽系数 */
  build: number
}

const COATS = ['#c9d6e2', '#8fa3b6', '#5e7184', '#dfe6ec', '#a7b4a0', '#7e93a6', '#c2b8a8', '#9a6f5c', '#3e4a56', '#d4c3a3']
const PANTS = ['#2f3b47', '#3b4754', '#26303a', '#4a5460', '#5d564c', '#1f2429', '#6b7a86']
const SHOES = ['#1d2025', '#e9e6df', '#5a4636', '#2b3036', '#8a8f94']
const SKIN = ['#e6c2a2', '#d9b294', '#c39572', '#a97650', '#8a5c3c']
const HAIR = ['#1e1a17', '#2a2622', '#4a3626', '#7a5a3a', '#b8a58a', '#3a3a3e']
const SHIRTS = ['#f1eee8', '#d8dee4', '#2d3640', '#e8d9c0']
const STYLES: HairStyle[] = ['short', 'short', 'long', 'bun', 'cap', 'short', 'long', 'bald']

const shade = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString()

export function randomLook(rnd: () => number): Look {
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length) % list.length]
  const coat = pick(COATS)
  return {
    coat,
    coatDark: shade(coat, 0.72),
    shirt: pick(SHIRTS),
    pants: pick(PANTS),
    shoes: pick(SHOES),
    skin: pick(SKIN),
    hair: pick(HAIR),
    hairStyle: pick(STYLES),
    coatLength: rnd(),
    bag: rnd() > 0.65,
    build: 0.92 + rnd() * 0.16,
  }
}

function tint(geo: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color)
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  const count = g.attributes.position.count
  const array = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    array[i * 3] = c.r
    array[i * 3 + 1] = c.g
    array[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(array, 3))
  // 只保留合并需要的属性，几何体之间才能 merge
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name)
  }
  return g
}

function merge(parts: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(parts, false)!
  parts.forEach((p) => p.dispose())
  return merged
}

/** 绕 Y 轴旋转的轮廓体（衣服、躯干这种上下粗细不同的形状用它最自然）。 */
function lathe(profile: Array<[number, number]>, segments = 14, depth = 0.72) {
  const geo = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  )
  geo.scale(1, 1, depth)
  return geo
}

export type PersonGeometry = {
  body: THREE.BufferGeometry
  arm: THREE.BufferGeometry
  leg: THREE.BufferGeometry
}

/** 关节支点（模型坐标，脚底为 0）。 */
export const HIP_Y = 0.9
export const SHOULDER_Y = 1.4
export const SHOULDER_X = 0.2
export const HIP_X = 0.095

export function buildPerson(look: Look): PersonGeometry {
  const b = look.build
  const parts: THREE.BufferGeometry[] = []

  // ---------- 躯干 ----------
  // 胯（裤子）
  const pelvis = new THREE.SphereGeometry(0.15, 14, 10)
  pelvis.scale(1.05 * b, 0.62, 0.72)
  pelvis.translate(0, HIP_Y + 0.02, 0)
  parts.push(tint(pelvis, look.pants))

  // 上衣：腰收、胸宽、肩部圆滑
  const hem = 0.86 - look.coatLength * 0.12
  const torso = lathe(
    [
      [0.0, hem],
      [0.165 * b, hem],
      [0.155 * b, 1.02],
      [0.15 * b, 1.1],
      [0.172 * b, 1.26],
      [0.178 * b, 1.34],
      [0.15 * b, 1.41],
      [0.07, 1.45],
      [0.0, 1.455],
    ],
    16,
    0.66,
  )
  parts.push(tint(torso, look.coat))
  // 里衬 / 领口
  const collar = new THREE.CylinderGeometry(0.062, 0.075, 0.06, 12)
  collar.translate(0, 1.455, 0.005)
  parts.push(tint(collar, look.shirt))
  // 门襟一条深色线，正面立刻有"衣服"的读感
  const placket = new THREE.BoxGeometry(0.018, 0.5 - look.coatLength * 0.1, 0.01)
  placket.translate(0, 1.17 - look.coatLength * 0.05, 0.118)
  parts.push(tint(placket, look.coatDark))
  // 腰带
  const belt = new THREE.CylinderGeometry(0.158 * b, 0.16 * b, 0.035, 16)
  belt.scale(1, 1, 0.68)
  belt.translate(0, 0.95, 0)
  if (look.coatLength < 0.45) parts.push(tint(belt, look.coatDark))

  // 斜挎包
  if (look.bag) {
    const strap = new THREE.BoxGeometry(0.03, 0.62, 0.012)
    strap.rotateZ(0.62)
    strap.translate(0.0, 1.16, 0.122)
    parts.push(tint(strap, '#3a2f27'))
    const pouch = new THREE.BoxGeometry(0.2, 0.15, 0.07)
    pouch.translate(-0.17, 0.95, 0.08)
    parts.push(tint(pouch, '#4a3b2f'))
  }

  // ---------- 脖子 + 头 ----------
  const neck = new THREE.CylinderGeometry(0.045, 0.052, 0.09, 10)
  neck.translate(0, 1.49, 0)
  parts.push(tint(neck, shade(look.skin, 0.92)))
  const head = new THREE.SphereGeometry(0.105, 16, 12)
  head.scale(0.9, 1.08, 0.98)
  head.translate(0, 1.615, 0.008)
  parts.push(tint(head, look.skin))
  // 鼻子与耳朵：极小，但侧面剪影一下子就有了
  const nose = new THREE.SphereGeometry(0.018, 8, 6)
  nose.scale(0.8, 1, 1.1)
  nose.translate(0, 1.6, 0.1)
  parts.push(tint(nose, shade(look.skin, 0.95)))
  for (const s of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.022, 8, 6)
    ear.scale(0.5, 1, 0.8)
    ear.translate(s * 0.094, 1.61, 0)
    parts.push(tint(ear, shade(look.skin, 0.9)))
    const eye = new THREE.SphereGeometry(0.011, 6, 5)
    eye.translate(s * 0.036, 1.632, 0.094)
    parts.push(tint(eye, '#1b1a1a'))
    const brow = new THREE.BoxGeometry(0.03, 0.007, 0.008)
    brow.translate(s * 0.036, 1.657, 0.096)
    parts.push(tint(brow, shade(look.hair, 0.9)))
  }

  // 发型
  const hair = look.hair
  if (look.hairStyle !== 'bald') {
    const cap = new THREE.SphereGeometry(0.112, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52)
    cap.scale(0.94, 1.06, 1.02)
    cap.translate(0, 1.632, -0.004)
    parts.push(tint(cap, hair))
    // 后脑勺下沿
    const back = new THREE.SphereGeometry(0.104, 14, 8, Math.PI * 0.62, Math.PI * 0.76, Math.PI * 0.35, Math.PI * 0.4)
    back.scale(0.94, 1.08, 1.02)
    back.translate(0, 1.615, -0.006)
    parts.push(tint(back, hair))
  }
  if (look.hairStyle === 'long') {
    const fall = new THREE.BoxGeometry(0.2, 0.26, 0.06)
    fall.translate(0, 1.5, -0.075)
    parts.push(tint(fall, hair))
    for (const s of [-1, 1]) {
      const side = new THREE.BoxGeometry(0.04, 0.2, 0.08)
      side.translate(s * 0.092, 1.56, -0.02)
      parts.push(tint(side, hair))
    }
  } else if (look.hairStyle === 'bun') {
    const bun = new THREE.SphereGeometry(0.05, 10, 8)
    bun.translate(0, 1.72, -0.07)
    parts.push(tint(bun, hair))
  } else if (look.hairStyle === 'cap') {
    const crown = new THREE.SphereGeometry(0.118, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.48)
    crown.scale(0.96, 0.9, 1.02)
    crown.translate(0, 1.645, -0.004)
    parts.push(tint(crown, look.coatDark))
    const brim = new THREE.CylinderGeometry(0.075, 0.075, 0.012, 14, 1, false, -Math.PI / 2, Math.PI)
    brim.scale(1.2, 1, 1.2)
    brim.translate(0, 1.66, 0.08)
    parts.push(tint(brim, look.coatDark))
  }

  // ---------- 手臂（支点在肩） ----------
  const armParts: THREE.BufferGeometry[] = []
  const shoulder = new THREE.SphereGeometry(0.062, 12, 10)
  shoulder.scale(1, 0.9, 0.9)
  armParts.push(tint(shoulder, look.coat))
  const upper = new THREE.CapsuleGeometry(0.048, 0.22, 4, 10)
  upper.translate(0, -0.15, 0)
  armParts.push(tint(upper, look.coat))
  const fore = new THREE.CapsuleGeometry(0.042, 0.2, 4, 10)
  fore.rotateX(-0.18)
  fore.translate(0, -0.4, 0.02)
  armParts.push(tint(fore, look.coat))
  const cuff = new THREE.CylinderGeometry(0.046, 0.046, 0.03, 10)
  cuff.translate(0, -0.52, 0.04)
  armParts.push(tint(cuff, look.coatDark))
  const hand = new THREE.SphereGeometry(0.042, 10, 8)
  hand.scale(0.85, 1.25, 0.6)
  hand.translate(0, -0.58, 0.045)
  armParts.push(tint(hand, look.skin))

  // ---------- 腿（支点在胯） ----------
  const legParts: THREE.BufferGeometry[] = []
  const thigh = new THREE.CapsuleGeometry(0.068, 0.34, 4, 10)
  thigh.translate(0, -0.22, 0)
  legParts.push(tint(thigh, look.pants))
  const shin = new THREE.CapsuleGeometry(0.056, 0.34, 4, 10)
  shin.translate(0, -0.6, 0)
  legParts.push(tint(shin, look.pants))
  const shoe = new THREE.BoxGeometry(0.095, 0.075, 0.24)
  shoe.translate(0, -HIP_Y + 0.0375, 0.045)
  legParts.push(tint(shoe, look.shoes))
  const toe = new THREE.SphereGeometry(0.048, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  toe.scale(1, 0.8, 1.1)
  toe.translate(0, -HIP_Y + 0.04, 0.15)
  legParts.push(tint(toe, look.shoes))
  const sole = new THREE.BoxGeometry(0.1, 0.022, 0.27)
  sole.translate(0, -HIP_Y + 0.011, 0.05)
  legParts.push(tint(sole, shade(look.shoes, 0.6)))

  return { body: merge(parts), arm: merge(armParts), leg: merge(legParts) }
}

/** 所有路人共享的一份材质：顶点色 + 偏哑光的布料质感。 */
export const PERSON_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.82,
  metalness: 0.02,
})
