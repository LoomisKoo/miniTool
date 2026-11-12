// 南岸广场：胶囊形购物中心（数据见 data/mall.ts）。
//
// 结构只有四样东西，都在这里搭：
//   1) 外轮廓：一圈曲面幕墙（首层是石材 + 发光橱窗带，上面几层是玻璃带 + 竖向翅片）；
//   2) 楼板：胶囊形整板，中间挖一个 14×26m 的中庭洞（Shape + hole 一次成形）；
//   3) 店面：每层一圈，朝中庭开门——**首层也有**，和广场那圈底商不是一回事；
//   4) 中庭：四边玻璃栏杆 + 三段折返扶梯 + 屋顶一条玻璃拱顶。
//
// 扶梯是真能走的：台阶逐级生成为 stand 型碰撞面（每级 0.26m，低于
// PlayerRig 的 0.3m 跨越阈值，所以人一路小台阶走上去，不会卡在半途）。

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ESC_RISE,
  ESC_TREAD,
  MALL,
  MALL_ESCALATORS,
  MALL_KIOSKS,
  MALL_LEVELS,
  MALL_PLANTERS,
  MALL_PORTALS,
  MALL_SHOPS,
  MALL_THEME,
  MALL_TOP,
  SHOP_ROOM_DEPTH,
  escalatorGeo,
  railRuns,
  stepTop,
  type EscalatorSpec,
  type MallPortal,
  type MallShop,
} from '../data/mall'
import { shopBladeMaterial, shopSignMaterial, shopWindowMaterial } from './ShopFrontage'
import { kioskTexture } from './shopArt'
import { nightFill } from './theme'
import { GlowDisc } from './GlowDisc'

const CJK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
/** 外轮廓的采样数：一格约 1.3m，门洞的缺口才不至于比门宽出半米 */
const SEG = 168

// ---------------------------------------------------------------- 贴图

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { canvas: c, ctx: c.getContext('2d')! }
}

/** 室内地面：水磨石 + 石材拼缝 */
const floorTexCache = new Map<string, THREE.CanvasTexture>()
function floorTexture(night: boolean) {
  const key = night ? 'n' : 'd'
  const hit = floorTexCache.get(key)
  if (hit) return hit
  const S = 512
  const { canvas, ctx } = canvasOf(S, S)
  ctx.fillStyle = night ? '#2b2e33' : '#dcd7cd'
  ctx.fillRect(0, 0, S, S)
  for (let i = 0; i < 2400; i++) {
    const v = night ? 58 + Math.random() * 40 : 190 + Math.random() * 50
    ctx.fillStyle = `rgba(${v},${v - 3},${v - 9},${0.05 + Math.random() * 0.09})`
    ctx.fillRect(Math.random() * S, Math.random() * S, 1.5 + Math.random() * 2, 1.5)
  }
  ctx.strokeStyle = night ? 'rgba(170,190,205,.12)' : 'rgba(120,112,98,.22)'
  ctx.lineWidth = 1.4
  for (let i = 0; i <= 8; i++) {
    const p = (i / 8) * S
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, S)
    ctx.moveTo(0, p)
    ctx.lineTo(S, p)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 4)
  tex.anisotropy = 4
  floorTexCache.set(key, tex)
  return tex
}

/** 货架贴图。现在只用在店铺的后墙上（透过幕墙往里看，能看到这排货架）。 */
const bandTexCache = new Map<string, THREE.CanvasTexture>()
function bandTexture(night: boolean) {
  const key = night ? 'n' : 'd'
  const hit = bandTexCache.get(key)
  if (hit) return hit
  const W = 1024
  const H = 256
  const { canvas, ctx } = canvasOf(W, H)
  ctx.fillStyle = night ? '#1b2229' : '#ccd5d9'
  ctx.fillRect(0, 0, W, H)
  const goods = ['#e0603f', '#f0b13c', '#4a9a68', '#3f74b0', '#d8d2c4', '#c04a6a', '#7a8ac0']
  for (let s = 0; s < W; s += 128) {
    ctx.fillStyle = night ? '#2b343b' : '#e6ecef'
    ctx.fillRect(s + 4, 30, 120, 200)
    ctx.fillStyle = night ? '#4a5f70' : '#7f9099'
    ctx.fillRect(s + 4, 12, 120, 18)
    for (let r = 0; r < 3; r++) {
      ctx.fillStyle = night ? '#0f151a' : '#b8c2c6'
      ctx.fillRect(s + 10, 70 + r * 52, 108, 4)
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = goods[((s / 128 + i + r * 3) % goods.length) | 0]
        ctx.globalAlpha = night ? 0.9 : 0.75
        ctx.fillRect(s + 14 + i * 17, 40 + r * 52, 10 + ((i * 5) % 6), 30)
        ctx.globalAlpha = 1
      }
    }
    ctx.fillStyle = night ? '#151b21' : '#c6cfd2'
    ctx.fillRect(s, 0, 5, H)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(10, 1)
  tex.anisotropy = 4
  bandTexCache.set(key, tex)
  return tex
}

/** 门洞招牌 */
const portalTexCache = new Map<string, THREE.CanvasTexture>()
function portalTexture(label: string, sub: string) {
  const key = `${label}|${sub}`
  const hit = portalTexCache.get(key)
  if (hit) return hit
  const W = 1024
  const H = 220
  const { canvas, ctx } = canvasOf(W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#1e2a33')
  g.addColorStop(1, '#0c1216')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,232,196,.5)'
  ctx.lineWidth = 5
  ctx.strokeRect(12, 12, W - 24, H - 24)
  ctx.fillStyle = '#fff4de'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 92px ${CJK}`
  ctx.fillText(label, W / 2, 100, 700)
  ctx.font = `500 30px ${CJK}`
  ctx.fillStyle = 'rgba(255,238,206,.72)'
  ctx.fillText(sub, W / 2, 172, 640)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  portalTexCache.set(key, tex)
  return tex
}

/** 楼层指示牌：四层店名竖排，挂在门厅里。 */
const directoryCache = new Map<string, THREE.CanvasTexture>()
function directoryTexture(night: boolean) {
  const key = night ? 'n' : 'd'
  const hit = directoryCache.get(key)
  if (hit) return hit
  const W = 512
  const H = 1024
  const { canvas, ctx } = canvasOf(W, H)
  ctx.fillStyle = night ? '#101a22' : '#eceae4'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(140,220,255,.5)'
  ctx.lineWidth = 6
  ctx.strokeRect(14, 14, W - 28, H - 28)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = night ? '#9fe6ff' : '#2a3a44'
  ctx.font = `600 42px ${CJK}`
  ctx.fillText('南岸广场', 46, 92)
  ctx.font = `500 22px ${CJK}`
  ctx.fillStyle = night ? 'rgba(160,215,240,.6)' : '#5a6a74'
  ctx.fillText('SOUTH BANK MALL', 48, 138)

  MALL_THEME.forEach((t, i) => {
    const y = 220 + i * 168
    const floor = MALL_LEVELS.length - i
    ctx.fillStyle = night ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'
    ctx.fillRect(38, y - 54, W - 76, 128)
    ctx.fillStyle = night ? '#ffe0a8' : '#8a6a24'
    ctx.font = `700 54px ${CJK}`
    ctx.fillText(`L${floor}`, 56, y + 4)
    ctx.fillStyle = night ? '#f4f8fb' : '#1d2830'
    ctx.font = `600 38px ${CJK}`
    ctx.fillText(t.name, 152, y - 12)
    ctx.fillStyle = night ? 'rgba(190,225,240,.55)' : '#66727a'
    ctx.font = `500 20px ${CJK}`
    ctx.fillText(t.sub, 152, y + 30)
  })
  ctx.fillStyle = night ? 'rgba(150,210,235,.45)' : '#7a848a'
  ctx.font = `500 20px ${CJK}`
  ctx.fillText('扶梯在中庭 · 每层一圈', 46, H - 64)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  directoryCache.set(key, tex)
  return tex
}

// ---------------------------------------------------------------- 材质

type Mats = {
  stone: THREE.MeshStandardMaterial
  trim: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
  rail: THREE.MeshStandardMaterial
  floor: THREE.MeshStandardMaterial
  ceiling: THREE.MeshStandardMaterial
  band: THREE.MeshStandardMaterial
  shopWall: THREE.MeshStandardMaterial
  light: THREE.MeshBasicMaterial
  accent: THREE.MeshBasicMaterial
  concrete: THREE.MeshStandardMaterial
}

function useMallMats(night: boolean): Mats {
  const mats = useMemo<Mats>(() => {
    const floorTex = floorTexture(night)
    const bandTex = bandTexture(night)
    return {
      stone: new THREE.MeshStandardMaterial({
        color: night ? '#2f3942' : '#d8d1c4',
        roughness: 0.72,
        metalness: 0.18,
        side: THREE.DoubleSide,
        ...nightFill(night),
      }),
      trim: new THREE.MeshStandardMaterial({
        color: night ? '#3a444c' : '#a9b2b6',
        roughness: 0.3,
        metalness: 0.8,
        envMapIntensity: 1.3,
        side: THREE.DoubleSide,
        ...nightFill(night, '#2a333b', 0.8),
      }),
      dark: new THREE.MeshStandardMaterial({
        color: night ? '#151b20' : '#3c464c',
        roughness: 0.55,
        metalness: 0.45,
        side: THREE.DoubleSide,
        ...nightFill(night),
      }),
      // 幕墙玻璃：只留很淡的一层。太在意"玻璃感"（金属度、环境反射）就会
      // 在掠射角上反光到看不见里面，所以这里压低调子、几乎不反射。
      glass: new THREE.MeshStandardMaterial({
        color: '#cfe4ef',
        metalness: 0.08,
        roughness: 0.06,
        transparent: true,
        opacity: night ? 0.13 : 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
        envMapIntensity: 0.55,
        emissive: new THREE.Color(night ? '#33536a' : '#dbe7ea'),
        emissiveIntensity: night ? 0.16 : 0.05,
      }),
      rail: new THREE.MeshStandardMaterial({
        color: '#cfe4ee',
        metalness: 0.25,
        roughness: 0.1,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      floor: new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: night ? 0.28 : 0.4,
        metalness: 0.3,
        envMapIntensity: 1.1,
        side: THREE.DoubleSide,
        ...nightFill(night, '#39424a', 0.5),
      }),
      ceiling: new THREE.MeshStandardMaterial({
        color: night ? '#252d34' : '#e2e5e4',
        roughness: 0.85,
        metalness: 0.05,
        side: THREE.DoubleSide,
        ...nightFill(night, '#2c343b', 0.6),
      }),
      shopWall: new THREE.MeshStandardMaterial({
        color: night ? '#3b4249' : '#e8e3d8',
        roughness: 0.86,
        metalness: 0.04,
        side: THREE.DoubleSide,
        ...nightFill(night, '#39424a', 0.5),
      }),
      band: new THREE.MeshStandardMaterial({
        map: bandTex,
        emissiveMap: bandTex,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: night ? 1.05 : 0.32,
        roughness: 0.8,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
      light: new THREE.MeshBasicMaterial({ color: night ? '#ffe0b0' : '#efe3cd', toneMapped: false }),
      accent: new THREE.MeshBasicMaterial({
        // 灯带统一 12cm 高：4~6cm 在远处不到一个像素，亮线会碎成白色锯齿
        color: night ? '#8fd8ff' : '#cfd6d2',
        transparent: true,
        opacity: night ? 0.7 : 0.35,
        toneMapped: false,
        // 也用在离地 1~5mm 的地面贴条上
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      concrete: new THREE.MeshStandardMaterial({
        color: night ? '#333b42' : '#c9c6bd',
        roughness: 0.9,
        metalness: 0.05,
        side: THREE.DoubleSide,
        ...nightFill(night),
      }),
    }
  }, [night])

  useEffect(() => {
    // 只释放材质：贴图是模块级缓存的，昼夜切换还要复用
    return () => Object.values(mats).forEach((m) => m.dispose())
  }, [mats])

  return mats
}

// ---------------------------------------------------------------- 几何工具

/** 胶囊平面路径（Shape 用，x / y 即世界 x / z）。 */
function capsulePath(r: number, hx: number, path: THREE.Shape) {
  path.moveTo(r, -hx)
  path.lineTo(r, hx)
  path.absarc(0, hx, r, 0, Math.PI, false)
  path.lineTo(-r, -hx)
  path.absarc(0, -hx, r, Math.PI, Math.PI * 2, false)
  path.closePath()
  return path
}

/** 外轮廓按弧长均匀取点（局部坐标） */
function ringPoints(inset: number, count: number) {
  const r = MALL.r - inset
  const hx = MALL.hx
  const straight = 2 * hx
  const arc = Math.PI * r
  const total = 2 * straight + 2 * arc
  return Array.from({ length: count }, (_, i) => {
    let t = ((i / count) * total) % total
    if (t < straight) return { x: r, z: -hx + t }
    t -= straight
    if (t < arc) {
      const a = t / r
      return { x: Math.cos(a) * r, z: hx + Math.sin(a) * r }
    }
    t -= arc
    if (t < straight) return { x: -r, z: hx - t }
    t -= straight
    const a = Math.PI + t / r
    return { x: Math.cos(a) * r, z: -hx + Math.sin(a) * r }
  })
}

/**
 * 外轮廓的一段曲面（上下两排顶点围成的带）。
 *
 * 自己拼 BufferGeometry 而不是用 CylinderGeometry：胶囊的直段不是圆弧，
 * 圆柱做不出来；而且这样可以直接跳过门洞所在的那些格。
 */
function shellGeometry(
  inset: number,
  y0: number,
  y1: number,
  count: number,
  skip?: (x: number, z: number) => boolean,
) {
  const pts = ringPoints(inset, count)
  const pos: number[] = []
  const idx: number[] = []
  let v = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    if (skip && skip((a.x + b.x) / 2, (a.z + b.z) / 2)) continue
    pos.push(a.x, y0, a.z, b.x, y0, b.z, a.x, y1, a.z, b.x, y1, b.z)
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
    v += 4
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/**
 * 胶囊楼板。hole=true 时挖掉中庭（二到四层、屋顶），false 是一层整块实心地面。
 * shape 的 y 轴即世界 z（旋转 -90° 后 y→-z，胶囊本身左右对称）。
 */
function plateGeometry(hole = true) {
  const outer = capsulePath(MALL.r, MALL.hx, new THREE.Shape())
  if (hole) {
    const cut = new THREE.Path()
    cut.moveTo(-MALL.slotX, -MALL.slotZ)
    cut.lineTo(-MALL.slotX, MALL.slotZ)
    cut.lineTo(MALL.slotX, MALL.slotZ)
    cut.lineTo(MALL.slotX, -MALL.slotZ)
    cut.closePath()
    outer.holes.push(cut)
  }
  return new THREE.ShapeGeometry(outer, 40)
}

/** 拱顶：半圆筒面，沿 z 铺开 */
function vaultGeometry(halfW: number, halfL: number, segs = 18) {
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI
    const x = Math.cos(a) * halfW
    const y = Math.sin(a) * halfW
    pos.push(x, y, -halfL, x, y, halfL)
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** 点是否落在某个门洞的开口里（沿切向算，壳体没有厚度） */
function inPortalOpening(x: number, z: number, p: MallPortal, pad = 0) {
  const along = Math.abs((x - p.x) * Math.cos(p.yaw) - (z - p.z) * Math.sin(p.yaw))
  return along < p.w / 2 + pad
}

// ---------------------------------------------------------------- 主体

export function Mall({ night }: { night: boolean }) {
  const mats = useMallMats(night)
  const plate = useMemo(() => plateGeometry(true), [])
  const ground = useMemo(() => plateGeometry(false), [])
  useEffect(
    () => () => {
      plate.dispose()
      ground.dispose()
    },
    [plate, ground],
  )

  // 远景：玻璃切成不透明。透过半透明幕墙能看到里面层层叠叠的楼板和店面背墙，
  // 几十米外这些面深度精度不够会互相打架，整圈幕墙一直闪；
  // 不透明之后内部被深度测试直接挡掉，也省掉一大片填充。
  const camera = useThree((state) => state.camera)
  const farGlass = useRef(false)
  useFrame(() => {
    const d = Math.hypot(camera.position.x - MALL.cx, camera.position.z - MALL.cz)
    const far = farGlass.current ? d > 70 : d > 85
    if (far === farGlass.current) return
    farGlass.current = far
    const g = mats.glass
    g.transparent = !far
    g.depthWrite = far
    g.opacity = far ? 1 : night ? 0.13 : 0.15
    g.color.set(far ? (night ? '#2a3340' : '#8fa6b4') : '#cfe4ef')
    g.emissive.set(far ? (night ? '#7a6248' : '#dbe7ea') : night ? '#33536a' : '#dbe7ea')
    g.emissiveIntensity = far ? (night ? 0.55 : 0.08) : night ? 0.16 : 0.05
    g.needsUpdate = true
  })
  // 昼夜切换会重建材质，状态跟着复位
  useEffect(() => {
    farGlass.current = false
  }, [mats])

  return (
    <group position={[MALL.cx, 0, MALL.cz]}>
      <Shell night={night} mats={mats} />
      <Levels night={night} mats={mats} plate={plate} ground={ground} />
      <Atrium night={night} mats={mats} />
      <Roof night={night} mats={mats} plate={plate} />
      {MALL_PORTALS.map((p) => (
        <Portal key={p.id} portal={p} night={night} mats={mats} />
      ))}
      {night && <GlowDisc position={[0, 0.075, 0]} size={MALL.r * 2.4} color="#ffd9a8" opacity={0.09} />}
    </group>
  )
}

/** 一段曲面壳体（材质 + 可选跳过门洞） */
function Band({
  inset,
  y0,
  y1,
  mat,
  skipPortal,
  shadow,
}: {
  inset: number
  y0: number
  y1: number
  mat: THREE.Material
  skipPortal?: boolean
  shadow?: boolean
}) {
  const geo = useMemo(() => {
    const skip = skipPortal
      ? (x: number, z: number) => MALL_PORTALS.some((p) => inPortalOpening(x, z, p))
      : undefined
    return shellGeometry(inset, y0, y1, SEG, skip)
  }, [inset, y0, y1, skipPortal])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={mat} castShadow={shadow} receiveShadow={shadow} />
}

/** 外轮廓幕墙：石材基座 + 通高落地玻璃 + 挑檐 + 竖向翅片。 */
function Shell({ night, mats }: { night: boolean; mats: Mats }) {
  const fins = useMemo(() => {
    const count = 84
    const finsH = MALL_TOP - 1.5
    const geo = new THREE.BoxGeometry(0.16, finsH, 0.52)
    const mesh = new THREE.InstancedMesh(geo, mats.trim, count)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const one = new THREE.Vector3(1, 1, 1)
    const pts = ringPoints(-0.14, count)
    const zero = new THREE.Vector3(0, 0, 0)
    for (let i = 0; i < count; i++) {
      const p = pts[i]
      // 门洞里的翅片藏到地下：门洞不能被竖杆切碎
      if (MALL_PORTALS.some((pt) => inPortalOpening(p.x, p.z, pt, 0.9))) {
        m.compose(pos.set(0, -40, 0), q.identity(), zero)
        mesh.setMatrixAt(i, m)
        continue
      }
      // 法线：直段是 ±x，圆弧段是径向
      const straight = Math.abs(Math.abs(p.x) - MALL.r) < 0.35 && Math.abs(p.z) <= MALL.hx + 0.35
      const nx = straight ? Math.sign(p.x) : p.x / MALL.r
      const nz = straight ? 0 : p.z / MALL.r
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(nx, nz))
      m.compose(pos.set(p.x, 1.5 + finsH / 2 - 0.3, p.z), q, one)
      mesh.setMatrixAt(i, m)
    }
    mesh.castShadow = true
    mesh.frustumCulled = false
    mesh.userData.noMerge = true
    return mesh
  }, [mats])
  useEffect(() => () => fins.geometry.dispose(), [fins])

  return (
    <group>
      {/* 首层：石材基座 / 落地玻璃 / 檐口。四道门洞整段挖开，玻璃门由 Portal 填。
          玻璃后面就是外圈廊道和店铺的背墙，所以是能看进去的。 */}
      <Band inset={0} y0={0} y1={1.0} mat={mats.stone} skipPortal shadow />
      <Band inset={0} y0={1.0} y1={4.5} mat={mats.glass} skipPortal />
      <Band inset={0} y0={4.5} y1={4.64} mat={mats.trim} skipPortal />
      <Band inset={0} y0={4.64} y1={MALL.ground} mat={mats.stone} skipPortal shadow />
      {/* 首层檐口 */}
      <Band inset={-0.42} y0={MALL.ground - 0.34} y1={MALL.ground + 0.06} mat={mats.stone} shadow />
      <Band inset={-0.5} y0={MALL.ground + 0.08} y1={MALL.ground + 0.2} mat={mats.accent} />

      {/* 二到四层：石材带 + 玻璃带 + 挑檐。玻璃后面不再放挡光的"亮内墙"——
          那层内墙会把幕墙变成一堵发亮的实墙，远看就是"落地窗不透明"。 */}
      {MALL_LEVELS.slice(1).map((lv) => (
        <group key={lv.i}>
          {/* 层间石材带挑出 9cm：它和下一层的玻璃带在 y 上重叠 0.9m，
              贴在同一个半径上就是两张共面，深度值一样——远处整圈横向闪斑
              就来自这里。挑出来以后石材带本身成了窗台线，也更好看。 */}
          <Band inset={-0.09} y0={lv.y0 - 1.45} y1={lv.y0} mat={mats.stone} shadow />
          <Band inset={0} y0={lv.y0} y1={lv.y1 - 0.55} mat={mats.glass} />
          <Band inset={-0.5} y0={lv.y1 - 0.52} y1={lv.y1 - 0.16} mat={mats.stone} shadow />
          <Band inset={-0.62} y0={lv.y1 - 0.14} y1={lv.y1 - 0.02} mat={mats.accent} />
        </group>
      ))}

      <primitive object={fins} />
    </group>
  )
}

/** 楼板 + 栏杆 + 每层店面 + 楼层灯带 */
function Levels({
  night,
  mats,
  plate,
  ground,
}: {
  night: boolean
  mats: Mats
  plate: THREE.BufferGeometry
  ground: THREE.BufferGeometry
}) {
  return (
    <group>
      {MALL_LEVELS.map((lv) => (
        <group key={lv.i} position={[0, lv.y0, 0]}>
          {/* 楼板：一层是整块实心地面，上面几层挖中庭洞 */}
          <mesh
            geometry={lv.i === 0 ? ground : plate}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, lv.i === 0 ? 0.064 : 0, 0]}
            material={mats.floor}
            receiveShadow
          />
          {lv.i > 0 && (
            <>
              {/* 楼板底面 = 下一层的顶棚。环形整板（洞的位置和上面那张一样） */}
              <mesh geometry={plate} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.44, 0]} material={mats.ceiling} />
              {/* 洞口四周的板边，楼板才不是一张纸 */}
              <SlotRing y0={-0.5} y1={0} mats={mats} />
            </>
          )}

          {/* 中庭玻璃栏杆 */}
          {railRuns(lv.i).map((run, i) => (
            <RailRun key={i} run={run} y={0} mats={mats} />
          ))}

          {/* 一圈店面的房间（墙 / 后墙货架 / 吊顶灯），按层合并 */}
          <ShopRooms level={lv.i} mats={mats} />

          {/* 一圈店面的门脸 */}
          {MALL_SHOPS[lv.i].map((s) => (
            <ShopBay key={s.id} shop={s} h={lv.h} night={night} mats={mats} />
          ))}

          {/* 走廊顶上的灯带：贴着店面门头上沿一圈 */}
          <CapsuleStripLight at={MALL.r - MALL.shopDepth - 0.2} y={lv.h - 0.18} mats={mats} />
        </group>
      ))}
    </group>
  )
}

/** 中庭洞口四周的板边（一圈矩形带） */
function SlotRing({ y0, y1, mats }: { y0: number; y1: number; mats: Mats }) {
  const h = y1 - y0
  const cy = (y0 + y1) / 2
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[s * MALL.slotX, cy, 0]} material={mats.stone}>
          <boxGeometry args={[0.36, h, MALL.slotZ * 2]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, cy, s * MALL.slotZ]} material={mats.stone}>
          <boxGeometry args={[MALL.slotX * 2, h, 0.36]} />
        </mesh>
      ))}
    </group>
  )
}

/** 沿胶囊轮廓铺的一条连续灯带 */
function CapsuleStripLight({ at, y, mats }: { at: number; y: number; mats: Mats }) {
  const geo = useMemo(() => shellGeometry(at, y, y + 0.05, SEG), [at, y])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={mats.light} />
}

/** 一段玻璃栏杆：玻璃板 + 上扶手 + 下压条 */
function RailRun({
  run,
  y,
  mats,
}: {
  run: { axis: 'x' | 'z'; at: number; from: number; to: number }
  y: number
  mats: Mats
}) {
  const len = run.to - run.from
  if (len <= 0.05) return null
  const mid = (run.from + run.to) / 2
  const pos = run.axis === 'z' ? [run.at, y, mid] : [mid, y, run.at]
  const rot = run.axis === 'z' ? [0, Math.PI / 2, 0] : [0, 0, 0]
  return (
    <group position={pos as [number, number, number]} rotation={rot as [number, number, number]}>
      <mesh position={[0, 0.55, 0]} material={mats.rail}>
        <boxGeometry args={[len, 1.05, 0.035]} />
      </mesh>
      <mesh position={[0, 1.09, 0]} material={mats.trim}>
        <boxGeometry args={[len, 0.075, 0.11]} />
      </mesh>
      <mesh position={[0, 0.03, 0]} material={mats.trim}>
        <boxGeometry args={[len, 0.09, 0.14]} />
      </mesh>
    </group>
  )
}

/**
 * 一层的店面房间。
 *
 * 铺面门脸只是一张"画"（窗户贴图）。人在中庭里斜着走过去，视线会从窗边
 * 溜进店里——如果店里是空的、通的，就会一路看到外墙，穿帮。所以每家店都
 * 给一个 SHOP_ROOM_DEPTH 深的盒子：两侧墙、后墙、吊顶、门头以上的拦板、
 * 窗台以下的墙裙，全齐。后墙用货架贴图，斜着看进去是"店里还有货"。
 *
 * 一间房拆成 6 个盒子太碎，按层合并成三个网格（墙体 / 后墙 / 灯带），
 * 四层一共 12 个 draw call。
 */
function shopRoomGeometry(level: number) {
  const lv = MALL_LEVELS[level]
  const d = SHOP_ROOM_DEPTH
  const body: THREE.BufferGeometry[] = []
  const back: THREE.BufferGeometry[] = []
  const light: THREE.BufferGeometry[] = []

  const box = (arr: THREE.BufferGeometry[], x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const g = new THREE.BoxGeometry(sx, sy, sz)
    g.translate(x, y, z)
    arr.push(g)
  }

  for (const shop of MALL_SHOPS[level]) {
    const w = shop.w
    const winH = Math.min(2.75, lv.h - 1.8)
    const signTop = 0.5 + winH + 0.18 + 0.62 + 0.1
    const ceil = Math.min(lv.h - 0.14, signTop + 0.5)
    const place = (g: THREE.BufferGeometry) => {
      g.applyMatrix4(m4)
    }
    const m4 = new THREE.Matrix4()
      .makeTranslation(shop.x, 0, shop.z)
      .multiply(new THREE.Matrix4().makeRotationY(shop.yaw))

    const local: THREE.BufferGeometry[] = []
    // 两侧墙：厚 0.5，相邻两家的墙正好背靠背，中间不留缝
    box(local, -w / 2, lv.h / 2, -d / 2, 0.5, lv.h, d)
    box(local, w / 2, lv.h / 2, -d / 2, 0.5, lv.h, d)
    // 门头以上 / 窗台以下（这两块把正面除了橱窗以外的地方封住）
    // 上沿多压 0.12m 到招牌后面：招牌灯箱和拦板之间不能留缝
    box(local, 0, (signTop - 0.12 + lv.h) / 2, -0.18, w + 0.5, Math.max(0.2, lv.h - signTop + 0.12), 0.36)
    box(local, 0, 0.26, -0.18, w + 0.5, 0.52, 0.36)
    // 吊顶
    box(local, 0, ceil, -d / 2, w, 0.16, d)
    local.forEach(place)
    body.push(...local)

    const b: THREE.BufferGeometry[] = []
    box(b, 0, ceil / 2, -d + 0.16, w, ceil, 0.28)
    b.forEach(place)
    back.push(...b)

    const l: THREE.BufferGeometry[] = []
    box(l, 0, ceil - 0.1, -d / 2, Math.max(0.9, w * 0.55), 0.06, 0.55)
    l.forEach(place)
    light.push(...l)
  }

  const merge = (arr: THREE.BufferGeometry[]) => {
    const out = arr.length ? mergeGeometries(arr, false) : new THREE.BufferGeometry()
    arr.forEach((g) => g.dispose())
    return out ?? new THREE.BufferGeometry()
  }
  return { body: merge(body), back: merge(back), light: merge(light) }
}

/** 一层店面房间的网格 */
function ShopRooms({ level, mats }: { level: number; mats: Mats }) {
  const room = useMemo(() => shopRoomGeometry(level), [level])
  useEffect(
    () => () => {
      room.body.dispose()
      room.back.dispose()
      room.light.dispose()
    },
    [room],
  )
  return (
    <group>
      <mesh geometry={room.body} material={mats.shopWall} castShadow receiveShadow />
      <mesh geometry={room.back} material={mats.band} receiveShadow />
      <mesh geometry={room.light} material={mats.light} />
    </group>
  )
}

/**
 * 一家店的门脸：玻璃（其实是发光贴图）、窗套、招牌灯箱、竖招、门槛石。
 * 墙体在 ShopRooms 里，这里只管朝中庭的这一面。
 */
function ShopBay({ shop, h, night, mats }: { shop: MallShop; h: number; night: boolean; mats: Mats }) {
  const winH = Math.min(2.75, h - 1.8)
  const winY = 0.5 + winH / 2
  const winW = Math.max(1.4, shop.w - 0.6)
  const signH = 0.62
  const signY = 0.5 + winH + 0.18 + signH / 2
  // 橱窗往里退 0.5m：斜着看过去先看到 0.5m 深的窗洞，再看到店里的货架
  const glassZ = -0.5

  return (
    <group position={[shop.x, 0, shop.z]} rotation={[0, shop.yaw, 0]}>
      {/* 橱窗 */}
      <mesh position={[0, winY, glassZ]} material={shopWindowMaterial(shop.shop, night, 0)}>
        <planeGeometry args={[winW, winH]} />
      </mesh>
      {/* 窗套：两颊 + 上楣 + 窗台，深度做成 0.5m 的窗洞 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (winW / 2 + 0.07), winY, -0.25]} material={mats.dark}>
          <boxGeometry args={[0.14, winH + 0.26, 0.56]} />
        </mesh>
      ))}
      <mesh position={[0, winY + winH / 2 + 0.11, -0.25]} material={mats.dark}>
        <boxGeometry args={[winW + 0.3, 0.14, 0.56]} />
      </mesh>
      <mesh position={[0, winY - winH / 2 - 0.06, -0.25]} material={mats.trim}>
        <boxGeometry args={[winW + 0.32, 0.12, 0.62]} />
      </mesh>
      {/* 中挺：开面超过 4.5m 时分两格 */}
      {winW > 4.5 && (
        <mesh position={[0, winY, -0.46]} material={mats.dark}>
          <boxGeometry args={[0.09, winH, 0.1]} />
        </mesh>
      )}

      {/* 招牌灯箱 */}
      <mesh position={[0, signY, 0.06]} material={mats.dark} castShadow>
        <boxGeometry args={[winW + 0.16, signH + 0.14, 0.16]} />
      </mesh>
      <mesh position={[0, signY, 0.15]} material={shopSignMaterial(shop.shop, night)}>
        <planeGeometry args={[winW + 0.04, signH]} />
      </mesh>

      {/* 竖招：一半的店有，中庭里看过去高高低低才不呆板 */}
      {shop.shop.blade && (
        <group position={[shop.w / 2 - 0.35, signY + 0.1, 0.36]}>
          <mesh material={mats.dark}>
            <boxGeometry args={[0.05, 0.88, 0.4]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              position={[s * 0.032, 0, 0]}
              rotation={[0, (s * Math.PI) / 2, 0]}
              material={shopBladeMaterial(shop.shop, night)}
            >
              <planeGeometry args={[0.34, 0.76]} />
            </mesh>
          ))}
        </group>
      )}

      {/* 门口一片地光 */}
      <mesh position={[0, 0.005, 0.85]} rotation={[-Math.PI / 2, 0, 0]} material={mats.accent}>
        <planeGeometry args={[winW * 0.85, 0.9]} />
      </mesh>
    </group>
  )
}

/** 中庭：扶梯 + 摊车 + 楼层指示牌 + 吊灯 */
function Atrium({ night, mats }: { night: boolean; mats: Mats }) {
  return (
    <group>
      {/* 中庭四角的结构柱，从地面通到屋顶 */}
      {[
        [-MALL.slotX - 0.9, -MALL.slotZ - 0.9],
        [MALL.slotX + 0.9, -MALL.slotZ - 0.9],
        [-MALL.slotX - 0.9, MALL.slotZ + 0.9],
        [MALL.slotX + 0.9, MALL.slotZ + 0.9],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, MALL_TOP / 2, 0]} material={mats.trim} castShadow>
            <cylinderGeometry args={[0.34, 0.34, MALL_TOP, 10]} />
          </mesh>
          <mesh position={[0, MALL_TOP / 2, 0]} material={mats.accent}>
            <cylinderGeometry args={[0.355, 0.355, MALL_TOP - 1.4, 8, 1, true]} />
          </mesh>
        </group>
      ))}

      {MALL_ESCALATORS.map((spec) => (
        <Escalator key={spec.id} spec={spec} night={night} mats={mats} />
      ))}

      {MALL_KIOSKS.map((k) => (
        <Kiosk key={k.id} x={k.x} z={k.z} name={k.name} sub={k.sub} glow={k.glow} night={night} mats={mats} />
      ))}

      <Planters night={night} mats={mats} />
      <Directory x={-16.5} z={7.5} yaw={Math.PI / 2} night={night} mats={mats} />
      <Directory x={-16.5} z={-7.5} yaw={Math.PI / 2} night={night} mats={mats} />

      {/* 中庭吊灯：每层洞口一圈灯环，垂到视线高度 */}
      {MALL_LEVELS.slice(1).map((lv) => (
        <group key={lv.i} position={[0, lv.y0 - 1.6, 0]}>
          {[-5.2, 5.2].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.light}>
              <torusGeometry args={[1.6, 0.06, 5, 22]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** 走廊花箱 + 长凳 */
function Planters({ night, mats }: { night: boolean; mats: Mats }) {
  const leaf = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#3f5546' : '#5c7a52',
        roughness: 1,
        flatShading: true,
        envMapIntensity: night ? 1.3 : 1,
      }),
    [night],
  )
  useEffect(() => () => leaf.dispose(), [leaf])
  return (
    <group>
      {MALL_PLANTERS.map((p, i) => (
        <group key={i} position={[p.x, MALL_LEVELS[p.level].y0, p.z]}>
          <mesh position={[0, 0.3, 0]} material={mats.trim} castShadow receiveShadow>
            <boxGeometry args={[1.15, 0.6, 1.15]} />
          </mesh>
          <mesh position={[0, 0.72, 0]} material={leaf} castShadow>
            <icosahedronGeometry args={[0.62, 1]} />
          </mesh>
          <mesh position={[0, 1.14, 0]} material={leaf} castShadow>
            <icosahedronGeometry args={[0.38, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 楼层指示牌：一块竖灯箱，正反两面 */
function Directory({ x, z, yaw, night, mats }: { x: number; z: number; yaw: number; night: boolean; mats: Mats }) {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: directoryTexture(night),
        color: night ? '#ffffff' : '#b9b3a8',
        toneMapped: false,
      }),
    [night],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.95, 0]} material={mats.dark} castShadow>
        <boxGeometry args={[1.62, 3.4, 0.26]} />
      </mesh>
      <mesh position={[0, 1.95, 0.14]} material={mat}>
        <planeGeometry args={[1.44, 3.2]} />
      </mesh>
      <mesh position={[0, 1.95, -0.14]} rotation={[0, Math.PI, 0]} material={mat}>
        <planeGeometry args={[1.44, 3.2]} />
      </mesh>
      <mesh position={[0, 0.14, 0]} material={mats.trim}>
        <boxGeometry args={[1.8, 0.2, 0.5]} />
      </mesh>
    </group>
  )
}

/** 中庭摊车 */
function Kiosk({
  x,
  z,
  name,
  sub,
  glow,
  night,
  mats,
}: {
  x: number
  z: number
  name: string
  sub: string
  glow: string
  night: boolean
  mats: Mats
}) {
  const sign = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: kioskTexture(name, sub, glow),
        color: night ? '#f8f2e8' : '#c0bab0',
        toneMapped: false,
      }),
    [name, sub, glow, night],
  )
  useEffect(() => () => sign.dispose(), [sign])

  return (
    <group position={[x, 0.064, z]}>
      <mesh position={[0, 0.55, 0]} material={mats.dark} castShadow>
        <boxGeometry args={[2.3, 1.1, 1.0]} />
      </mesh>
      <mesh position={[0, 1.13, 0]} material={mats.trim}>
        <boxGeometry args={[2.42, 0.07, 1.1]} />
      </mesh>
      <mesh position={[0, 2.6, 0]} material={mats.trim} castShadow>
        <boxGeometry args={[2.6, 0.08, 1.24]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.15, 1.85, -0.5]} material={mats.trim}>
          <boxGeometry args={[0.07, 1.5, 0.07]} />
        </mesh>
      ))}
      <mesh position={[0, 2.3, 0.06]} material={sign}>
        <planeGeometry args={[2.2, 0.62]} />
      </mesh>
      <mesh position={[0, 2.54, 0.1]} material={mats.light}>
        <boxGeometry args={[2.1, 0.02, 0.7]} />
      </mesh>
    </group>
  )
}

/**
 * 一段自动扶梯。
 *
 * 台阶一块块画出来，同时它们就是走路用的碰撞面（见 mallColliders）。
 * 斜梯身 / 玻璃 / 扶手挂在一个倾斜的 group 里，只有台阶是水平的。
 * 倾斜段只覆盖台阶——上下平台要留出人进出的口子。
 */
function Escalator({ spec, night, mats }: { spec: EscalatorSpec; night: boolean; mats: Mats }) {
  const geo = useMemo(() => escalatorGeo(spec), [spec])
  const run = Math.abs(geo.zEnd - geo.zStart)
  const len = Math.hypot(run, geo.rise)
  const tilt = Math.atan2(geo.rise, run)
  const yaw = geo.dir > 0 ? 0 : Math.PI

  return (
    <group>
      <group position={[geo.x, geo.y0, geo.zStart]} rotation={[0, yaw, 0]}>
        <group rotation={[-tilt, 0, 0]}>
          {/* 梯身 */}
          <mesh position={[0, -0.03, len / 2]} material={mats.trim} castShadow receiveShadow>
            <boxGeometry args={[1.72, 0.26, len]} />
          </mesh>
          {/* 两侧玻璃 + 扶手带 */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.85, 0, 0]}>
              <mesh position={[0, 0.5, len / 2]} material={mats.rail}>
                <boxGeometry args={[0.04, 0.96, len]} />
              </mesh>
              <mesh position={[0, 1.02, len / 2]} material={mats.dark}>
                <boxGeometry args={[0.1, 0.1, len]} />
              </mesh>
            </group>
          ))}
          {/* 梯底一条灯 */}
          <mesh position={[0, -0.17, len / 2]} material={night ? mats.light : mats.accent}>
            <boxGeometry args={[1.25, 0.03, len * 0.94]} />
          </mesh>
        </group>
      </group>

      {/* 台阶（水平的，一路上升） */}
      {Array.from({ length: geo.steps }, (_, k) => {
        const top = stepTop(geo, k)
        return (
          <group key={k} position={[geo.x, top, geo.zAt(k)]}>
            <mesh position={[0, -ESC_RISE / 2, 0]} material={mats.dark} castShadow receiveShadow>
              <boxGeometry args={[1.5, ESC_RISE, ESC_TREAD]} />
            </mesh>
            {/* 踏面亮边：夜里能看出是一级级的 */}
            <mesh position={[0, 0.004, 0]} material={night ? mats.light : mats.trim}>
              <boxGeometry args={[1.44, 0.014, 0.06]} />
            </mesh>
          </group>
        )
      })}

      {/* 上下平台 */}
      {[
        { z: geo.zBottom, y: geo.y0, dir: -geo.dir },
        { z: geo.zTop, y: geo.y1, dir: geo.dir },
      ].map((p, i) => (
        <group key={i} position={[geo.x, p.y, p.z]}>
          <mesh position={[0, -0.07, p.dir * 0.15]} material={mats.trim} receiveShadow>
            <boxGeometry args={[1.9, 0.14, 2.4]} />
          </mesh>
          <mesh position={[0, 0.001, p.dir * 0.15]} material={mats.accent}>
            <boxGeometry args={[1.6, 0.02, 2.0]} />
          </mesh>
          <mesh position={[0, -0.3, p.dir * 0.15]} material={mats.dark}>
            <boxGeometry args={[1.9, 0.42, 2.4]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 门洞：柱、过梁、招牌、雨棚、玻璃门 */
function Portal({ portal, night, mats }: { portal: MallPortal; night: boolean; mats: Mats }) {
  const { w } = portal
  const signMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: portalTexture(portal.label, portal.sub),
        color: night ? '#ffffff' : '#b5afa4',
        toneMapped: false,
      }),
    [portal.label, portal.sub, night],
  )
  useEffect(() => () => signMat.dispose(), [signMat])

  return (
    <group position={[portal.x, 0, portal.z]} rotation={[0, portal.yaw, 0]}>
      {/* 两侧门框柱：宽度盖住壳体采样留下的缺口 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 + 0.75), 0, 0.15]}>
          <mesh position={[0, 2.7, 0]} material={mats.stone} castShadow receiveShadow>
            <boxGeometry args={[1.5, 5.4, 1.7]} />
          </mesh>
          <mesh position={[0, 2.6, 0.86]} material={mats.accent}>
            <boxGeometry args={[0.12, 4.6, 0.03]} />
          </mesh>
          <mesh position={[0, 5.45, 0]} material={mats.trim}>
            <boxGeometry args={[1.8, 0.3, 2.0]} />
          </mesh>
        </group>
      ))}

      {/* 过梁 + 招牌 */}
      <mesh position={[0, 5.12, 0.15]} material={mats.dark} castShadow>
        <boxGeometry args={[w + 3.0, 1.4, 1.7]} />
      </mesh>
      <mesh position={[0, 5.12, 1.02]} material={signMat}>
        <planeGeometry args={[w + 2.0, 1.05]} />
      </mesh>

      {/* 雨棚 + 底面灯带 */}
      <mesh position={[0, 5.9, 1.95]} material={mats.trim} castShadow>
        <boxGeometry args={[w + 4.0, 0.18, 3.5]} />
      </mesh>
      <mesh position={[0, 5.8, 1.95]} material={mats.light}>
        <boxGeometry args={[w + 3.0, 0.03, 2.6]} />
      </mesh>

      {/* 四扇玻璃门 */}
      {[0, 1, 2, 3].map((i) => {
        const panelW = (w - 0.4) / 4
        const dx = -w / 2 + 0.2 + panelW * (i + 0.5)
        return (
          <group key={i} position={[dx, 0, 0.12]}>
            <mesh position={[0, 1.6, 0]} material={mats.glass}>
              <boxGeometry args={[panelW - 0.1, 3.2, 0.06]} />
            </mesh>
            <mesh position={[panelW / 2 - 0.03, 1.6, 0.02]} material={mats.trim}>
              <boxGeometry args={[0.09, 3.2, 0.12]} />
            </mesh>
            <mesh position={[0, 0.03, 0]} material={mats.accent}>
              <boxGeometry args={[panelW - 0.14, 0.04, 0.12]} />
            </mesh>
          </group>
        )
      })}
      {/* 门内地垫光 */}
      <mesh position={[0, 0.075, -1.2]} rotation={[-Math.PI / 2, 0, 0]} material={mats.accent}>
        <planeGeometry args={[w - 0.8, 2.8]} />
      </mesh>
    </group>
  )
}

/** 屋顶：环形屋面板 + 中庭玻璃拱顶 + 设备 + 立招 */
function Roof({ night, mats, plate }: { night: boolean; mats: Mats; plate: THREE.BufferGeometry }) {
  const vault = useMemo(() => vaultGeometry(MALL.slotX, MALL.slotZ, 20), [])
  useEffect(() => () => vault.dispose(), [vault])

  const signMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: portalTexture('南岸广场', 'SOUTH BANK MALL'),
        color: night ? '#ffffff' : '#a8a29a',
        toneMapped: false,
      }),
    [night],
  )
  useEffect(() => () => signMat.dispose(), [signMat])

  return (
    <group>
      <mesh
        geometry={plate}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, MALL_TOP + 0.3, 0]}
        material={mats.concrete}
        receiveShadow
      />
      {/* 墙顶到屋面板之间的收头 */}
      <Band inset={0} y0={MALL_TOP - 0.1} y1={MALL_TOP + 0.34} mat={mats.stone} shadow />
      {/* 女儿墙 */}
      <Band inset={0.5} y0={MALL_TOP + 0.3} y1={MALL_TOP + 1.7} mat={mats.stone} shadow />
      <Band inset={0.62} y0={MALL_TOP + 1.68} y1={MALL_TOP + 1.8} mat={mats.accent} />

      {/* 中庭玻璃拱顶 */}
      <group position={[0, MALL_TOP + 0.2, 0]}>
        <mesh geometry={vault} material={mats.glass} />
        {[-11, -5.5, 0, 5.5, 11].map((z) => (
          <mesh key={z} position={[0, 0, z]} material={mats.trim}>
            <torusGeometry args={[MALL.slotX, 0.09, 5, 24, Math.PI]} />
          </mesh>
        ))}
        {/* 脊线灯 */}
        <mesh position={[0, MALL.slotX - 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.light}>
          <cylinderGeometry args={[0.06, 0.06, MALL.slotZ * 2, 6]} />
        </mesh>
      </group>

      {/* 屋面设备 */}
      {[
        [-16, 16],
        [17, 20],
        [-18, -18],
        [15, -15],
        [0, -30],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, MALL_TOP + 0.95, z]} material={mats.trim} castShadow>
          <boxGeometry args={[2.6, 1.3, 2.0]} />
        </mesh>
      ))}

      {/* 立招：立在东侧屋面，正对东面大道 */}
      <group position={[MALL.r - 8, MALL_TOP + 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 3.6, 0]} material={mats.trim} castShadow>
          <boxGeometry args={[0.5, 8.8, 2.1]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.28, 3.7, 0]} rotation={[0, s < 0 ? Math.PI : 0, 0]} material={signMat}>
            <planeGeometry args={[1.8, 6.6]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
