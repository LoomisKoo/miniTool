import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BuildingDef } from '../data/city'
import { useApp } from '../store'
import { makeGrainTexture, makeShopWindowTexture, makeSignTexture } from './textures'
import { bodyColor, nightFill, palettes, seeded, type Palette } from './theme'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GlowDisc } from './GlowDisc'
import { createFacadeMaterial } from './facade'
import {
  entrancesOfBuilding,
  isUnitBuilding,
  unitBuilding,
  type UnitBuilding,
} from '../data/units'
import { UnitShell } from './UnitShell'

type Props = { def: BuildingDef }

/** 切角八边形体量：把方盒子四个角削掉，剪影立刻不再是"四四方方"。
    所有窗框仍贴在四个正面上，所以不影响窗户布置。 */
function massGeometry(w: number, d: number, h: number, chamfer: number) {
  const cw = w / 2
  const cd = d / 2
  const c = Math.max(0.4, Math.min(chamfer, Math.min(cw, cd) * 0.42))
  const shape = new THREE.Shape()
  shape.moveTo(-cw + c, -cd)
  shape.lineTo(cw - c, -cd)
  shape.lineTo(cw, -cd + c)
  shape.lineTo(cw, cd - c)
  shape.lineTo(cw - c, cd)
  shape.lineTo(-cw + c, cd)
  shape.lineTo(-cw, cd - c)
  shape.lineTo(-cw, -cd + c)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, steps: 1 })
  geo.rotateX(-Math.PI / 2)
  geo.computeVertexNormals()
  return geo
}

/** 共用的屋顶颗粒贴图：几十栋楼共用一张，不额外占显存。 */
let roofTex: THREE.Texture | null = null
function roofTexture() {
  if (!roofTex) {
    roofTex = makeGrainTexture(256, 0.5, 700)
    roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping
    // 平铺在整块屋面上：噪声贴图没有方向性，看不出接缝
    roofTex.repeat.set(4, 4)
  }
  return roofTex
}

/**
 * 屋面板：防水卷材 + 碎石。俯视时屋顶是仅次于街道的大面积，
 * 一块纯色板会把整片城市读成"未渲染"。
 *
 * 注意 y 是相对楼顶的高度：屋面要略高于楼体顶面，否则会和压顶板共面打架。
 */
function RoofDeck({
  width,
  depth,
  night,
  y = 1.14,
  inset = 0.25,
}: {
  width: number
  depth: number
  night: boolean
  y?: number
  /** 离女儿墙内侧留的缝：留太多会露出一圈压顶板的深色"水沟" */
  inset?: number
}) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#7d8a92' : '#9a9a91',
        map: roofTexture(),
        roughness: 0.97,
        metalness: 0.02,
        // 夜里屋顶不是靠"自己发光"变亮的，而是被天空辉光和周边高楼反射
        // 打亮的。那部分光属于环境光，走 envMapIntensity（IBL），
        // 以前用 emissive 假装是环境光，结果屋顶的亮度和别处不是一个来源，
        // 怎么调都读起来"不对劲"。
        envMapIntensity: night ? 1.7 : 1,
      }),
    [night],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow>
      <planeGeometry args={[Math.max(1, width - inset), Math.max(1, depth - inset)]} />
    </mesh>
  )
}

/**
 * 女儿墙：以前是一整块实心盒子，等于给屋顶盖了个盖板；压顶板又浮在它上面
 * 1m 处，从高处看屋顶就是一块纯色平板。改成四道墙围出的圈，屋面才凹进去，
 * 俯视时能看到墙内侧的阴影和屋面材质。
 */
function Parapet({
  width,
  depth,
  palette,
  height = 1.34,
  thickness = 0.34,
}: {
  width: number
  depth: number
  palette: Palette
  height?: number
  thickness?: number
}) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // 夜里不要用 trim 的 #2d2d2e：女儿墙全黑就看不出屋顶边界，
        // 相邻的楼从高处看会连成一整片。稍亮一档的混凝土色负责勾轮廓。
        color: palette.key === 'night' ? '#49525a' : palette.trim,
        roughness: 0.72,
        metalness: 0.3,
      }),
    [palette.trim, palette.key],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <group position={[0, height / 2, 0]}>
      {[
        [0, (depth + thickness) / 2, width + thickness * 2, thickness],
        [0, -(depth + thickness) / 2, width + thickness * 2, thickness],
        [(width + thickness) / 2, 0, thickness, depth],
        [-(width + thickness) / 2, 0, thickness, depth],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0, z]} castShadow receiveShadow material={mat}>
          <boxGeometry args={[w, height, d]} />
        </mesh>
      ))}
    </group>
  )
}

function Roof({ def, width, depth, top, palette }: { def: BuildingDef; width: number; depth: number; top: number; palette: Palette }) {
  // 夜里屋顶不是黑的：天光和周围更高的楼把光打下来，防水层、碎石、设备都看得见。
  // 原来压到 #16222f（线性 ~0.008），俯视时整片屋顶就是一块纯黑。
  const night = palette.key === 'night'
  const metal = night ? '#7d8f9c' : '#9b9b92'
  // 屋顶上的构件统一走这一组光照参数。
  // 不用 emissive 假装环境光：屋顶接不到直射光，但会被天空辉光和周边楼的
  // 反射照到，那属于环境光，靠 envMapIntensity 拿。
  const gearLight = {
    envMapIntensity: night ? 1.6 : 1,
  } as const

  return (
    <group position={[0, top, 0]}>
      <Parapet width={width} depth={depth} palette={palette} height={1.62} />
      {/* 屋面板：水磨石/防水卷材的颗粒，俯视时不能是一块纯色 */}
      <RoofDeck width={width} depth={depth} night={palette.key === 'night'} />

      {def.roof === 'mechanical' && (
        <>
          <mesh position={[-width * 0.16, 2.0, -depth * 0.16]} castShadow>
            <boxGeometry args={[width * 0.3, 1.9, depth * 0.26]} />
            <meshStandardMaterial color={metal} roughness={0.6} metalness={0.35} {...gearLight} />
          </mesh>
          <mesh position={[width * 0.22, 1.5, depth * 0.18]} castShadow>
            <boxGeometry args={[width * 0.18, 1.1, depth * 0.18]} />
            <meshStandardMaterial color={metal} roughness={0.6} metalness={0.35} {...gearLight} />
          </mesh>
          <mesh position={[width * 0.3, 2.6, -depth * 0.2]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 1.4, 14]} />
            <meshStandardMaterial color={metal} roughness={0.7} metalness={0.3} {...gearLight} />
          </mesh>
          <mesh position={[-width * 0.3, 2.6, depth * 0.22]}>
            <cylinderGeometry args={[0.07, 0.07, 3, 6]} />
            <meshStandardMaterial color={night ? '#6b7681' : palette.trim} {...gearLight} />
          </mesh>
          {/* 屋顶空调外机阵列 */}
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[width * (0.05 + i * 0.06), 1.35, -depth * 0.32]} castShadow>
              <boxGeometry args={[0.9, 0.7, 0.9]} />
              <meshStandardMaterial color={metal} roughness={0.65} metalness={0.4} {...gearLight} />
            </mesh>
          ))}
        </>
      )}

      {def.roof === 'garden' && (
        <>
          {[-0.26, 0.02, 0.3].map((t, i) => (
            <group key={i} position={[t * width, 0, (i % 2 ? 1 : -1) * depth * 0.22]}>
              <mesh position={[0, 1.2, 0]} castShadow>
                <boxGeometry args={[1.4, 0.7, 1.4]} />
                <meshStandardMaterial color={night ? '#6a6f70' : palette.trim} roughness={0.9} {...gearLight} />
              </mesh>
              <mesh position={[0, 2.2, 0]} castShadow>
                <icosahedronGeometry args={[1.5, 1]} />
                {/* 屋顶绿植：抬反照率就行。叶子背光会透亮是真的（次表面散射），
                    但那是 leaf 材质的特性，不该用自发光冒充环境光 */}
                <meshStandardMaterial
                  color={night ? '#5d7462' : palette.tree}
                  roughness={1}
                  flatShading
                  envMapIntensity={night ? 1.4 : 1}
                />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.15, 0]} castShadow>
            <boxGeometry args={[width * 0.32, 0.5, depth * 0.26]} />
            <meshStandardMaterial color={night ? '#6a6f70' : palette.trim} roughness={0.92} {...gearLight} />
          </mesh>
        </>
      )}

      {def.roof === 'antenna' && (
        <>
          <mesh position={[0, 1.9, 0]} castShadow>
            <boxGeometry args={[width * 0.2, 1.8, depth * 0.2]} />
            <meshStandardMaterial color={metal} roughness={0.6} metalness={0.35} {...gearLight} />
          </mesh>
          <mesh position={[width * 0.22, 5.4, 0]}>
            <cylinderGeometry args={[0.08, 0.14, 7, 8]} />
            <meshStandardMaterial color={night ? '#7e8b96' : palette.trim} metalness={0.5} roughness={0.5} {...gearLight} />
          </mesh>
        </>
      )}

      {def.roof === 'crown' && (
        <>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[width * 0.72, 1.6, depth * 0.72]} />
            <meshStandardMaterial color={night ? '#4d6d88' : '#9fb3b8'} roughness={0.35} metalness={0.6} {...gearLight} />
          </mesh>
          <mesh position={[0, 2.32, 0]}>
            <boxGeometry args={[width * 0.76, 0.12, depth * 0.76]} />
            <meshBasicMaterial color={palette.ar} toneMapped={false} />
          </mesh>
          <mesh position={[0, 8.4, 0]}>
            <cylinderGeometry args={[0.1, 0.36, 12, 10]} />
            <meshStandardMaterial color={night ? '#7e8b96' : palette.trim} metalness={0.55} roughness={0.4} {...gearLight} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Balconies({ def, width, depth, palette }: { def: BuildingDef; width: number; depth: number; palette: Palette }) {
  const floors = useMemo(() => {
    const count = Math.max(2, Math.min(6, Math.floor(def.h / 9)))
    return Array.from({ length: count }).map((_, i) => 8 + i * 5.4)
  }, [def.h])

  return (
    <group>
      {floors.map((y, fi) =>
        [-0.3, 0.02, 0.32].map((t, ci) => (
          <group key={`${fi}-${ci}`} position={[t * width, y, depth / 2 + 0.62]}>
            <mesh castShadow>
              <boxGeometry args={[Math.min(2.8, width * 0.24), 0.16, 1.3]} />
              <meshStandardMaterial color={palette.trim} roughness={0.8} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.52, 0.58]}>
              <boxGeometry args={[Math.min(2.8, width * 0.24) - 0.16, 0.12, 0.06]} />
              <meshStandardMaterial color={palette.key === 'night' ? '#3d5468' : '#8e9ba3'} metalness={0.6} roughness={0.35} />
            </mesh>
            {[-1, -0.5, 0, 0.5, 1].map((k) => (
              <mesh key={k} position={[(k * Math.min(2.6, width * 0.22)) / 2, 0.3, 0.58]}>
                <boxGeometry args={[0.035, 0.55, 0.035]} />
                <meshStandardMaterial color={palette.key === 'night' ? '#3d5468' : '#8e9ba3'} metalness={0.6} roughness={0.4} />
              </mesh>
            ))}
            {ci !== 1 && (
              <mesh position={[0, 0.36, 0]}>
                <boxGeometry args={[0.34, 0.4, 0.34]} />
                <meshStandardMaterial color={palette.tree} roughness={1} />
              </mesh>
            )}
          </group>
        )),
      )}
    </group>
  )
}

/** 檐口：两三层向外叠出的石材线脚。真实建筑最有辨识度的轮廓细节，
    也是"方盒子"和"建筑"之间最省成本的一道分界。 */
function Cornice({ width, depth, y, palette }: { width: number; depth: number; y: number; palette: Palette }) {
  const stone = palette.key === 'night' ? '#3a4d60' : '#cdd3d2'
  const shadow = palette.key === 'night' ? '#22303f' : '#9aa4a6'
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -0.06, 0]} castShadow>
        <boxGeometry args={[width + 0.16, 0.12, depth + 0.16]} />
        <meshStandardMaterial color={shadow} roughness={0.82} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[width + 0.62, 0.26, depth + 0.62]} />
        <meshStandardMaterial color={stone} roughness={0.72} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow>
        <boxGeometry args={[width + 0.34, 0.14, depth + 0.34]} />
        <meshStandardMaterial color={stone} roughness={0.66} metalness={0.14} />
      </mesh>
    </group>
  )
}

/**
 * 楼体的"骨架"：幕墙竖挺、壁柱。
 *
 * 一栋楼如果只有一个挤出体量，无论贴图多细都是"模型盒子"。真实楼宇的
 * 立面永远有 10~25cm 的凸出构件——幕墙的竖挺、石材楼的壁柱。IBL 进来之后
 * 这些小凸起会在侧光下自己拉出一道亮边和一道影子，剪影和表面立刻不一样。
 * 全部合并成一个几何体，一栋楼只多一次 draw call。
 */
function Skin({
  width,
  depth,
  height,
  chamfer,
  style,
  palette,
  seed,
}: {
  width: number
  depth: number
  height: number
  chamfer: number
  style: BuildingDef['style']
  palette: Palette
  seed: number
}) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1)
      g.translate(x, y, z)
      parts.push(g)
    }
    const hw = width / 2
    const hd = depth / 2
    const in0 = chamfer + 0.06
    const innerW = Math.max(0.6, width - in0 * 2)
    const innerD = Math.max(0.6, depth - in0 * 2)

    if (style === 'glass') {
      // 幕墙：竖向竖挺 + 每层一道横向压条，剩下全靠反射
      const nx = Math.max(1, Math.round(innerW / 2.7))
      const nz = Math.max(1, Math.round(innerD / 2.7))
      for (let i = 0; i <= nx; i++) {
        const x = -innerW / 2 + (innerW * i) / nx
        box(0.11, height, 0.26, x, height / 2, hd + 0.09)
        box(0.11, height, 0.26, x, height / 2, -hd - 0.09)
      }
      for (let i = 0; i <= nz; i++) {
        const z = -innerD / 2 + (innerD * i) / nz
        box(0.26, height, 0.11, hw + 0.09, height / 2, z)
        box(0.26, height, 0.11, -hw - 0.09, height / 2, z)
      }
      // 角部斜切面上的竖挺，别让削角露成一块没有分割的玻璃
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const g = new THREE.BoxGeometry(0.13, height, 0.13)
          g.rotateY(Math.PI / 4)
          g.translate(sx * (hw - chamfer * 0.5), height / 2, sz * (hd - chamfer * 0.5))
          parts.push(g)
        }
      }
    } else {
      // 砖石 / 金属：转角壁柱 + 每跨一根，做出竖向节奏
      const bays = Math.max(2, Math.round(innerW / 5.2))
      for (const sz of [-1, 1]) {
        for (let i = 0; i <= bays; i++) {
          const x = -innerW / 2 + (innerW * i) / bays
          box(0.34, height, 0.18, x, height / 2, sz * (hd + 0.06))
        }
      }
      const bays2 = Math.max(2, Math.round(innerD / 5.2))
      for (const sx of [-1, 1]) {
        for (let i = 0; i <= bays2; i++) {
          const z = -innerD / 2 + (innerD * i) / bays2
          box(0.18, height, 0.34, sx * (hw + 0.06), height / 2, z)
        }
      }
    }

    const merged = mergeGeometries(parts, false)
    for (const g of parts) g.dispose()
    return merged
  }, [width, depth, height, chamfer, style, seed])

  useEffect(() => () => geo?.dispose(), [geo])

  if (!geo) return null

  return (
    <mesh geometry={geo} castShadow receiveShadow userData={{ noMerge: true }}>
      <meshStandardMaterial
        color={palette.trim}
        roughness={style === 'glass' ? 0.42 : 0.72}
        metalness={style === 'glass' ? 0.62 : 0.24}
        envMapIntensity={style === 'glass' ? 1.5 : 1.0}
      />
    </mesh>
  )
}

/** 墙基：深色石材勒脚，让楼体"扎"进地面，而不是浮着。 */
function Plinth({ width, depth, palette }: { width: number; depth: number; palette: Palette }) {
  return (
    <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
      <boxGeometry args={[width + 0.3, 0.56, depth + 0.3]} />
      <meshStandardMaterial
        color={palette.key === 'night' ? '#1c2833' : '#9aa19c'}
        roughness={0.78}
        metalness={0.16}
      />
    </mesh>
  )
}

/**
 * 住宅 / 酒店：外壳完全由楼层平面生成（每户的窗和阳台、首层橱窗、单元门），
 * 和室内看出去的本栋楼是同一个组件。
 */
function UnitBuildingExterior({ def }: Props) {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const source = unitBuilding(def.id) as UnitBuilding
  const entrances = useMemo(() => entrancesOfBuilding(source), [source])
  const signTexture = useMemo(
    () => makeSignTexture(def.sign || def.name, def.signColor || '#12232f'),
    [def.sign, def.name, def.signColor],
  )
  useEffect(() => () => signTexture.dispose(), [signTexture])
  const main = entrances[0]

  return (
    <group position={[def.x, 0, def.z]}>
      <UnitShell building={source} body={def.body} palette={palette} />
      <group userData={{ buildingDetailLod: true, landmark: Boolean(def.landmark) }}>
        {main && (
          <group
            position={[
              main.side === 'w' ? -source.w / 2 - 0.05 : main.side === 'e' ? source.w / 2 + 0.05 : main.x,
              0,
              main.side === 'n' ? -source.d / 2 - 0.05 : main.side === 's' ? source.d / 2 + 0.05 : main.z,
            ]}
            rotation={[0, main.side === 'e' ? Math.PI / 2 : main.side === 'w' ? -Math.PI / 2 : main.side === 'n' ? Math.PI : 0, 0]}
          >
            <mesh position={[0, 3.75, 0.02]}>
              <planeGeometry args={[4.6, 0.95]} />
              <meshBasicMaterial map={signTexture} toneMapped={false} transparent opacity={0.96} />
            </mesh>
          </group>
        )}
        {night &&
          entrances.map((e, i) => (
            <GlowDisc key={i} position={[e.x, 0.62, e.z]} size={5.2} color="#ffd2a0" opacity={0.12} />
          ))}
      </group>
    </group>
  )
}

/**
 * 街角咖啡：一层玻璃亭，四面落地玻璃，屋面板挑出 0.8m。
 * 尺寸与室内 cafeInterior 对应（外轮廓减 0.3m 外框），入口在西面正中。
 */
function CafePavilion({ def }: Props) {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const W = def.w
  const D = def.d
  const GLASS_TOP = 4.4
  const signTexture = useMemo(
    () => makeSignTexture(def.sign || def.name, def.signColor || '#3a2a1e'),
    [def.sign, def.name, def.signColor],
  )
  useEffect(() => () => signTexture.dispose(), [signTexture])

  const frame = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = new THREE.BoxGeometry(w, h, d)
      g.translate(x, y, z)
      parts.push(g)
    }
    // 底框、顶框、转角柱
    for (const s of [-1, 1]) {
      add(W, 0.3, 0.3, 0, 0.15, (s * (D - 0.3)) / 2)
      add(0.3, 0.3, D, (s * (W - 0.3)) / 2, 0.15, 0)
      add(W, 0.3, 0.3, 0, GLASS_TOP - 0.15, (s * (D - 0.3)) / 2)
      add(0.3, 0.3, D, (s * (W - 0.3)) / 2, GLASS_TOP - 0.15, 0)
      for (const t of [-1, 1]) add(0.3, GLASS_TOP, 0.3, (s * (W - 0.3)) / 2, GLASS_TOP / 2, (t * (D - 0.3)) / 2)
    }
    // 竖梃：约 2.2m 一档；西面中间留门
    const mull = (len: number) => Math.max(1, Math.round(len / 2.2))
    const nx = mull(W)
    for (let i = 1; i < nx; i++) {
      const x = -W / 2 + (W * i) / nx
      for (const s of [-1, 1]) add(0.08, GLASS_TOP, 0.14, x, GLASS_TOP / 2, (s * (D - 0.14)) / 2)
    }
    const nz = mull(D)
    for (let i = 1; i < nz; i++) {
      const z = -D / 2 + (D * i) / nz
      add(0.14, GLASS_TOP, 0.08, (W - 0.14) / 2, GLASS_TOP / 2, z)
      if (Math.abs(z) > 1.5) add(0.14, GLASS_TOP, 0.08, -(W - 0.14) / 2, GLASS_TOP / 2, z)
    }
    // 门框
    for (const z of [-1.4, 1.4]) add(0.16, 2.8, 0.1, -(W - 0.14) / 2, 1.4, z)
    add(0.16, 0.12, 2.9, -(W - 0.14) / 2, 2.8, 0)
    const m = mergeGeometries(parts, false)!
    for (const g of parts) g.dispose()
    return m
  }, [W, D])
  useEffect(() => () => frame.dispose(), [frame])

  // 透过玻璃能看到的室内：暖色地面、吧台、几张桌子、吊灯
  const furniture = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = new THREE.BoxGeometry(w, h, d)
      g.translate(x, y, z)
      parts.push(g)
    }
    add(2.5, 1.06, 0.9, W / 2 - 1.4, 0.53, 0)
    for (const [x, z] of [
      [-2.6, -2.6],
      [-2.6, 2.6],
      [0.6, -3.2],
      [0.6, 3.2],
      [0.2, 0],
    ]) {
      add(1.0, 0.06, 1.0, x, 0.74, z)
      add(0.12, 0.72, 0.12, x, 0.36, z)
    }
    const m = mergeGeometries(parts, false)!
    for (const g of parts) g.dispose()
    return m
  }, [W])
  useEffect(() => () => furniture.dispose(), [furniture])

  return (
    <group position={[def.x, 0, def.z]}>
      {/* 地台 + 室内地面 */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[W + 1.2, 0.12, D + 1.2]} />
        <meshStandardMaterial color={palette.paving} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - 0.4, D - 0.4]} />
        <meshStandardMaterial color="#b99a78" roughness={0.6} />
      </mesh>
      <mesh geometry={furniture} castShadow>
        <meshStandardMaterial color="#7b6650" roughness={0.75} />
      </mesh>

      <mesh geometry={frame} castShadow receiveShadow>
        <meshStandardMaterial color={night ? '#2a2620' : '#3c3a36'} roughness={0.45} metalness={0.55} />
      </mesh>
      {/* 四面落地玻璃 */}
      <mesh position={[0, GLASS_TOP / 2 + 0.15, 0]}>
        <boxGeometry args={[W - 0.2, GLASS_TOP - 0.3, D - 0.2]} />
        <meshStandardMaterial
          color={night ? '#3a2c1e' : '#b9d0d6'}
          emissive={night ? '#ffbf7a' : '#000000'}
          emissiveIntensity={night ? 0.18 : 0}
          transparent
          opacity={night ? 0.32 : 0.22}
          roughness={0.04}
          metalness={0.6}
          depthWrite={false}
        />
      </mesh>

      {/* 屋面板：挑出 0.8m，下沿一圈暖光 */}
      <mesh position={[0, GLASS_TOP + 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[W + 1.6, 0.6, D + 1.6]} />
        <meshStandardMaterial color={bodyColor(def.body, palette)} roughness={0.8} />
      </mesh>
      <mesh position={[0, GLASS_TOP - 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 1.5, D + 1.5]} />
        <meshStandardMaterial color="#e9dfcf" emissive={night ? '#ffcf96' : '#000000'} emissiveIntensity={night ? 0.5 : 0} />
      </mesh>
      {[-2.6, 0.6, 3.8].map((x) => (
        <mesh key={x} position={[x, GLASS_TOP - 0.7, 0]}>
          <sphereGeometry args={[0.22, 12, 10]} />
          <meshBasicMaterial color="#ffd9a6" toneMapped={false} />
        </mesh>
      ))}
      {/* 招牌：西侧屋面板外沿 */}
      <mesh position={[-W / 2 - 0.82, GLASS_TOP + 0.3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[4.2, 0.5]} />
        <meshBasicMaterial map={signTexture} toneMapped={false} />
      </mesh>
      {night && <GlowDisc position={[-W / 2 - 1.6, 0.62, 0]} size={6} color="#ffd2a0" opacity={0.14} />}
    </group>
  )
}

export function Building({ def }: Props) {
  if (def.id === 'cafe') return <CafePavilion def={def} />
  return isUnitBuilding(def.id) ? <UnitBuildingExterior def={def} /> : <PlainBuilding def={def} />
}

function PlainBuilding({ def }: Props) {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk

  const podium = def.setback ? 5.6 : 0
  const bodyW = def.setback ? def.w * 0.86 : def.w
  const bodyD = def.setback ? def.d * 0.86 : def.d
  const bodyH = Math.max(4, def.h - podium)
  const side = def.entranceSide || 'south'
  const signTexture = useMemo(
    () => (def.sign ? makeSignTexture(def.sign, def.signColor || '#12232f') : null),
    [def.sign, def.signColor],
  )
  useEffect(() => () => signTexture?.dispose(), [signTexture])

  // 橱窗内景：4 个变体缓存复用，几十栋楼只多 4 张贴图
  const shopWindow = useMemo(
    () => makeShopWindowTexture(palette.key === 'night', Math.floor(seeded(def.id + '-shopwin')() * 4)),
    [def.id, palette.key],
  )

  const baseColor = useMemo(() => {
    const c = bodyColor(def.body, palette)
    // 每栋楼偏一点点色相/明度：整条街所有楼一个色号，是最像"CG 预览"的破绽。
    // 白天不压，夜里稍微压一点，但别再压成剪影。
    const rnd = seeded(def.id + '-tone')
    c.offsetHSL((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.14, (rnd() - 0.5) * 0.1)
    return c
  }, [def.id, def.body, palette])

  // 玻璃塔切角更大，砖石楼只轻微削角；同一街区也有强弱变化。
  const chamfer = useMemo(() => {
    const rnd = seeded(def.id + '-mass')
    const base = def.style === 'glass' ? 0.1 : 0.06
    return Math.min(Math.min(bodyW, bodyD) * (base + rnd() * 0.05), 3.4)
  }, [def.id, def.style, bodyW, bodyD])


  // 程序化立面：窗户、窗台、楼层线与夜间灯光都在着色器里算完，
  // 一栋楼只剩这一个材质 / 一次 draw call。
  const bodyMaterial = useMemo(
    () =>
      createFacadeMaterial({
        wall: baseColor,
        trim: palette.trim,
        glass: def.style === 'glass' ? palette.glass : palette.windowDark,
        litWarm: palette.windowLit[0],
        litCool: palette.windowLit[2],
        style: def.style,
        night: palette.key === 'night',
        width: def.setback ? def.w * 0.86 : def.w,
        depth: def.setback ? def.d * 0.86 : def.d,
        height: Math.max(4, def.h - (def.setback ? 5.6 : 0)),
        base: def.setback ? 4.4 : 3.6,
        inset: chamfer + 0.5,
        // 临街面一定有窗；背面按种子留山墙，街区看着才不像四面都开满窗的模型
        blank:
          seeded(def.id + '-gable')() > 0.55
            ? def.entranceSide === 'east' || def.entranceSide === 'west'
              ? 'z'
              : 'x'
            : 'none',
        seed: seeded(def.id + '-facade')(),
      }),
    [baseColor, def.style, def.id, def.w, def.d, def.h, def.setback, palette],
  )
  useEffect(() => () => bodyMaterial.dispose(), [bodyMaterial])

  const faceWidth = Math.min(side === 'east' || side === 'west' ? bodyD : bodyW, 10)
  // 裙房与占地齐平：以前四边各外扩 0.8m，碰撞盒却只到占地边，
  // 走到墙边时人会插进裙房里，镜头也会钻进去看到楼的内部。
  const baseW = def.w
  const baseD = def.d
  const faceBase = side === 'east' ? baseW / 2 : side === 'west' ? -baseW / 2 : 0
  const faceBaseZ = side === 'south' ? baseD / 2 : side === 'north' ? -baseD / 2 : 0
  const rotation = side === 'east' ? Math.PI / 2 : side === 'west' ? -Math.PI / 2 : side === 'north' ? Math.PI : 0
  // 店面整组离墙 16cm：原来贴墙 10cm 时，店面玻璃/门框背面正好和墙面共面，
  // 走动时那条接缝会闪成一条亮线。
  const offset = 0.16
  const accent = def.accent || palette.ar

  const mass = useMemo(
    () => massGeometry(bodyW, bodyD, bodyH, chamfer),
    [bodyW, bodyH, chamfer],
  )
  useEffect(() => () => mass.dispose(), [mass])

  // 轮廓线也要跟着切角体量走，否则会在削掉的墙角外侧悬空。
  const outline = useMemo(() => {
    const edges = new THREE.EdgesGeometry(mass, 24)
    return edges
  }, [mass])

  const cap = useMemo(
    () => massGeometry(bodyW + 0.2, bodyD + 0.2, 0.16, chamfer + 0.1),
    [bodyW, bodyD, chamfer],
  )
  useEffect(() => () => cap.dispose(), [cap])

  const roofLine = useMemo(() => {
    const geo = new THREE.BoxGeometry(bodyW + 0.4, 0.5, bodyD + 0.4)
    const edges = new THREE.EdgesGeometry(geo)
    geo.dispose()
    return edges
  }, [bodyW, bodyD])

  useEffect(() => () => outline?.dispose(), [outline])

  return (
    <group position={[def.x, 0, def.z]}>
      {def.setback && (
        <>
          <mesh position={[0, podium / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[baseW, podium, baseD]} />
            <meshStandardMaterial
              // 裙房顶是俯视时看得见的大面：夜里原来是 #20303f，
              // 一整块深蓝黑，和旁边有屋面的楼对比特别脏
              color={night ? '#33414d' : '#b7c1c4'}
              roughness={0.62}
              metalness={0.28}
              emissive={night ? '#1a2229' : '#000000'}
              emissiveIntensity={night ? 0.6 : 0}
            />
          </mesh>
          {/* 裙房屋顶：外露的平台要有防水层颗粒和一圈矮女儿墙，
              否则俯视就是一整块纯色板，还会和隔壁楼的顶连成一片 */}
          <group position={[0, podium, 0]}>
            <RoofDeck width={baseW} depth={baseD} night={night} y={0.06} inset={0.5} />
            <Parapet width={baseW} depth={baseD} palette={palette} height={0.55} thickness={0.28} />
          </group>
          {/* 裙房顶的 AR 灯带 */}
          <mesh position={[0, podium - 0.06, baseD / 2 + 0.055]}>
            <boxGeometry args={[baseW * 0.96, 0.06, 0.06]} />
            <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={palette.key === 'night' ? 0.85 : 0.35} />
          </mesh>
        </>
      )}

      <mesh
        position={[0, podium, 0]}
        castShadow
        receiveShadow
        material={bodyMaterial}
        geometry={mass}
        // 自定义 shader 不能被合批（合批会换成普通材质）
        userData={{ noMerge: true }}
      />

      <group userData={{ buildingDetailLod: true, landmark: Boolean(def.landmark) }}>
        {def.balconies && <Balconies def={def} width={bodyW} depth={bodyD} palette={palette} />}

        {/* 立面骨架：竖挺 / 壁柱 */}
        <group position={[0, podium, 0]}>
          <Skin
            width={bodyW}
            depth={bodyD}
            height={bodyH}
            chamfer={chamfer}
            style={def.style}
            palette={palette}
            seed={seeded(def.id + '-skin')()}
          />
        </group>

        {/* 首层店面 */}
        <group
          position={[
            faceBase + (side === 'east' ? offset : side === 'west' ? -offset : 0),
            0,
            faceBaseZ + (side === 'south' ? offset : side === 'north' ? -offset : 0),
          ]}
          rotation={[0, rotation, 0]}
        >
        <mesh position={[0, 2.0, 0]}>
          <boxGeometry args={[faceWidth, 3.6, 0.2]} />
          <meshStandardMaterial
            color={palette.key === 'night' ? '#0c1a26' : '#3c4e55'}
            roughness={0.12}
            metalness={0.8}
            emissive={palette.glowWarm}
            emissiveIntensity={palette.key === 'night' ? 0.14 : 0.05}
          />
        </mesh>
        {/* 橱窗内景，替代以前那张半透明玻璃板：
            0.12 透明度的整块平面在夜里就是一块"矩形遮罩"，
            换成有灯槽 / 货架 / 柜台的内景贴图，门口才像一间开着的店。 */}
        <mesh position={[0, 2.0, 0.115]}>
          <planeGeometry args={[faceWidth - 1.4, 2.85]} />
          <meshBasicMaterial map={shopWindow} toneMapped={false} color={palette.key === 'night' ? '#ffffff' : '#8d979d'} />
        </mesh>
        {/* 门框与门 */}
        <mesh position={[0, 1.5, 0.14]}>
          <boxGeometry args={[2.6, 3.0, 0.16]} />
          <meshStandardMaterial color={palette.key === 'night' ? '#16242f' : '#56676e'} roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.35, 0.24]}>
          <boxGeometry args={[2.2, 2.7, 0.08]} />
          <meshStandardMaterial
            color={palette.key === 'night' ? '#0d2230' : '#4b6169'}
            emissive={palette.glowWarm}
            emissiveIntensity={palette.key === 'night' ? 0.35 : 0.08}
            roughness={0.15}
            metalness={0.6}
          />
        </mesh>
        <mesh position={[1.0, 1.4, 0.3]}>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        {[-0.34, 0, 0.34].map((p, i) => (
          <mesh key={i} position={[p * faceWidth, 2.0, 0.17]}>
            <boxGeometry args={[0.09, 3.2, 0.1]} />
            <meshStandardMaterial color={palette.trim} roughness={0.5} metalness={0.5} {...nightFill(palette.key === 'night')} />
          </mesh>
        ))}
        {/* 店面两侧的砖垛：把玻璃"嵌"进墙里 0.35m。人视线高度上，
            这一圈实体框比任何贴图都更能说明"这是一间店"。 */}
        {[-1, 1].map((s) => {
          const pw = Math.min(1.15, faceWidth * 0.17)
          return (
            <mesh key={`pier${s}`} position={[s * (faceWidth / 2 - pw / 2), 1.9, 0.12]} castShadow>
              <boxGeometry args={[pw, 3.8, 0.34]} />
              {/* 店面砖垛是玩家视线高度上最近的一圈实体面：夜里没有自发光
                  补偿的话，整条街的店面会塌成一排纯黑的洞。 */}
              <meshStandardMaterial color={palette.trim} roughness={0.7} metalness={0.18} {...nightFill(palette.key === 'night')} />
            </mesh>
          )
        })}
        {/* 雨棚 */}
        <mesh position={[0, 3.75, 1.2]} castShadow>
          <boxGeometry args={[Math.min(faceWidth * 0.82, 8), 0.14, 2.6]} />
          <meshStandardMaterial color={palette.trim} roughness={0.55} metalness={0.4} />
        </mesh>
        <mesh position={[0, 3.66, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.min(faceWidth * 0.78, 7.6), 2.4]} />
          <meshBasicMaterial color={accent} transparent opacity={0.4} toneMapped={false} />
        </mesh>
        <mesh position={[0, 3.6, 0.24]}>
          <boxGeometry args={[Math.min(faceWidth * 0.82, 8), 0.09, 0.07]} />
          <meshBasicMaterial color={palette.glowWarm} toneMapped={false} />
        </mesh>
        {palette.key === 'night' && (
          <>
            <mesh position={[0, 4.1, 0.2]}>
              <boxGeometry args={[faceWidth * 0.86, 0.05, 0.05]} />
              <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.8} />
            </mesh>
          </>
        )}
        {signTexture && (
          <mesh position={[0, 4.85, 0.22]}>
            <planeGeometry args={[Math.min(faceWidth * 0.72, 7.4), 1.8]} />
            <meshBasicMaterial map={signTexture} toneMapped={false} transparent opacity={0.96} />
          </mesh>
        )}
        {palette.key === 'night' && (
          <>
            {/* 店铺暖光溢出：只用贴地的一层径向软光。
                以前这里是两块加色平面——一块贴地的硬边矩形、一块 6.5m 的
                竖直面横在门口，隔着它看墙和巷子，就是一团"矩形半透明遮罩"。 */}
            <GlowDisc position={[0, 0.62, 1.8]} size={6.4} color="#ffd2a0" opacity={0.13} />
          </>
        )}
        </group>

        <Plinth width={bodyW} depth={bodyD} palette={palette} />
        <Cornice width={bodyW} depth={bodyD} y={def.h - 0.9} palette={palette} />

        <Roof def={def} width={bodyW} depth={bodyD} top={def.h} palette={palette} />

        {/* 顶部压边：跟着切角走，才不会在削角处露出一个方角 */}
        <mesh position={[0, podium + bodyH - 0.08, 0]} geometry={cap}>
          <meshStandardMaterial color={palette.trim} roughness={0.5} metalness={0.45} />
        </mesh>

        {/* 轮廓线只留给地标：普通楼体在移动时这条细亮线会闪成"漏光" */}
        {outline && def.landmark && (
          <lineSegments position={[0, podium, 0]} geometry={outline}>
            <lineBasicMaterial
              color={accent}
              transparent
              opacity={0.4}
              toneMapped={false}
            />
          </lineSegments>
        )}

        {palette.key === 'night' && (
          <group position={[0, def.h + 1.2, 0]}>
            <mesh position={[bodyW * 0.36, 0, bodyD * 0.36]}>
              <sphereGeometry args={[0.28, 10, 10]} />
              <meshBasicMaterial color={accent} toneMapped={false} />
            </mesh>
            <mesh position={[bodyW * 0.36, 0, bodyD * 0.36]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.5, 0.62, 20]} />
              <meshBasicMaterial color={accent} transparent opacity={0.4} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}

        {/* 屋顶一圈 AR 光环，俯瞰时勾勒出城市轮廓 */}
        {palette.key === 'night' && (
          <lineSegments position={[0, def.h + 0.35, 0]} geometry={roofLine}>
            <lineBasicMaterial color={accent} transparent opacity={def.landmark ? 0.75 : 0.45} toneMapped={false} />
          </lineSegments>
        )}

        {/* 楼体竖向光缝（少量） */}
        {def.landmark && (
          <>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * (bodyW / 2 + 0.06), podium + bodyH / 2, bodyD / 2 * 0.3]}>
                <boxGeometry args={[0.05, bodyH * 0.72, 0.05]} />
                <meshBasicMaterial color={accent} transparent opacity={0.5} toneMapped={false} />
              </mesh>
            ))}
          </>
        )}
      </group>
    </group>
  )
}

/**
 * 屋顶检修设备：空调外机、水箱、楼梯间。
 *
 * 从高处看，没有任何构件的屋顶只是一块平板；相邻两栋楼同样高时，
 * 两块平板直接连成一整片，看起来就是"楼合并了"。放几组设备之后，
 * 每栋楼的屋顶边界、进深关系立刻分开。
 */
function RoofGear({
  seedKey,
  width,
  depth,
  palette,
}: {
  seedKey: string
  width: number
  depth: number
  palette: Palette
}) {
  const units = useMemo(() => {
    const rnd = seeded(seedKey)
    const night = palette.key === 'night'
    const count = width * depth > 260 ? 3 : width * depth > 140 ? 2 : 1
    const list: Array<{ x: number; z: number; w: number; h: number; d: number; kind: number }> = []
    for (let i = 0; i < count; i++) {
      // 贴着屋面内侧随机摆，留出 1.5m 检修通道，不要压到女儿墙
      const maxX = Math.max(0.6, width / 2 - 2.4)
      const maxZ = Math.max(0.6, depth / 2 - 2.4)
      list.push({
        x: (rnd() * 2 - 1) * maxX,
        z: (rnd() * 2 - 1) * maxZ,
        w: 1.6 + rnd() * 2.4,
        h: 0.9 + rnd() * 1.1,
        d: 1.4 + rnd() * 2.0,
        kind: rnd() > 0.78 ? 1 : 0,
      })
    }
    return { list, night }
  }, [seedKey, width, depth, palette.key])

  const body = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: units.night ? '#8b98a2' : '#a9b0b2',
        roughness: 0.68,
        metalness: 0.28,
        // 屋顶设备被天空辉光和邻楼反射照亮，那属于环境光，走 envMapIntensity。
        // 以前用自发光补，等于自己给自己打光，和周围屋面不是一个来源。
        envMapIntensity: units.night ? 1.6 : 1,
      }),
    [units.night],
  )
  const dark = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: units.night ? '#5c6771' : palette.trim,
        roughness: 0.6,
        metalness: 0.4,
        envMapIntensity: units.night ? 1.6 : 1,
      }),
    [palette.trim, units.night],
  )
  useEffect(
    () => () => {
      body.dispose()
      dark.dispose()
    },
    [body, dark],
  )

  return (
    <group position={[0, 0.22, 0]}>
      {units.list.map((u, i) => (
        <group key={i} position={[u.x, 0, u.z]}>
          <mesh position={[0, u.h / 2, 0]} castShadow receiveShadow material={body}>
            <boxGeometry args={[u.w, u.h, u.d]} />
          </mesh>
          {u.kind === 1 ? (
            // 水箱：圆筒 + 顶盖，剪影比第二个方盒子好认
            <mesh position={[0, u.h + 0.9, 0]} castShadow material={body}>
              <cylinderGeometry args={[Math.min(u.w, u.d) * 0.42, Math.min(u.w, u.d) * 0.42, 1.8, 12]} />
            </mesh>
          ) : (
            // 外机格栅：顶上压一块深色板，俯视时有一道明显的暗边
            <mesh position={[0, u.h + 0.06, 0]} castShadow material={dark}>
              <boxGeometry args={[u.w * 0.94, 0.12, u.d * 0.94]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

/** 外围填充楼：只画体量 + 立面 + 檐口 + 临街店面。
    高一点的楼分成两段退台，剪影不再是"一根方柱"；
    所有构件都用标准材质，静态合批会一起吃掉，几十栋也只多几十次 draw call。 */
export function InfillBuilding({ def }: Props) {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const wall = useMemo(() => bodyColor(def.body, palette), [def.body, palette])
  const lightsOn = palette.key === 'night'

  const chamfer = useMemo(
    () => Math.min(Math.min(def.w, def.d) * 0.07, 2.6),
    [def.w, def.d],
  )

  // 退台：高楼的 78% 处收一次，上段更窄。真实高层几乎都有这个层次。
  const stepped = def.setback && def.h > 44
  const tiers = useMemo(() => {
    if (!stepped) return [{ y0: 0, y1: def.h, w: def.w, d: def.d }]
    const cut = def.h * 0.76
    return [
      { y0: 0, y1: cut, w: def.w, d: def.d },
      { y0: cut, y1: def.h, w: def.w * 0.8, d: def.d * 0.8 },
    ]
  }, [stepped, def.h, def.w, def.d])

  // 每段的体量、压顶、材质
  const parts = useMemo(
    () =>
      tiers.map((t) => {
        const c = Math.min(chamfer, Math.min(t.w, t.d) * 0.4)
        return {
          tier: t,
          chamfer: c,
          mass: massGeometry(t.w, t.d, t.y1 - t.y0, c),
          cap: massGeometry(t.w + 0.24, t.d + 0.24, 0.18, c + 0.1),
          material: createFacadeMaterial({
            wall,
            trim: palette.trim,
            glass: def.style === 'glass' ? palette.glass : palette.windowDark,
            litWarm: palette.windowLit[0],
            litCool: palette.windowLit[2],
            style: def.style,
            night: lightsOn,
            width: t.w,
            depth: t.d,
            height: t.y1 - t.y0,
            // 首层留给店面；上段用负的 base 接着下段的楼层继续排，
            // 不会在退台处出现半层错位
            base: (def.style === 'glass' ? 4.2 : 3.4) - t.y0,
            inset: c + 0.5,
            // 背街一面留作山墙
            blank:
              seeded(def.id + '-gable')() > 0.45
                ? def.facing === 'east' || def.facing === 'west'
                  ? 'z'
                  : 'x'
                : 'none',
            seed: seeded(def.id + '-facade')(),
          }),
        }
      }),
    [tiers, chamfer, wall, def.style, def.id, palette, lightsOn],
  )
  useEffect(
    () => () => {
      for (const p of parts) {
        p.mass.dispose()
        p.cap.dispose()
        p.material.dispose()
      }
    },
    [parts],
  )

  const facing = def.facing ?? 'south'
  const rotation =
    facing === 'east' ? Math.PI / 2 : facing === 'west' ? -Math.PI / 2 : facing === 'north' ? Math.PI : 0
  const span = facing === 'east' || facing === 'west' ? def.d : def.w
  const frontDepth = (facing === 'east' || facing === 'west' ? def.w : def.d) / 2
  const front = {
    x: facing === 'east' ? frontDepth : facing === 'west' ? -frontDepth : 0,
    z: facing === 'south' ? frontDepth : facing === 'north' ? -frontDepth : 0,
  }
  const shopW = Math.min(span * 0.8, 11)
  const hasShop = useMemo(() => seeded(def.id + '-shop')() > 0.2, [def.id])
  const shopWindow = useMemo(
    () => makeShopWindowTexture(lightsOn, Math.floor(seeded(def.id + '-shopwin')() * 4)),
    [def.id, lightsOn],
  )

  return (
    <group position={[def.x, 0, def.z]}>
      {parts.map((p, i) => {
        const tierH = p.tier.y1 - p.tier.y0
        const isTop = i === parts.length - 1
        return (
          <group key={i} position={[0, p.tier.y0, 0]}>
            <mesh
              geometry={p.mass}
              material={p.material}
              castShadow
              receiveShadow
              userData={{ noMerge: true }}
            />
            <Cornice width={p.tier.w} depth={p.tier.d} y={tierH - 0.85} palette={palette} />
            <mesh position={[0, tierH - 0.09, 0]} geometry={p.cap}>
              <meshStandardMaterial color={palette.trim} roughness={0.6} metalness={0.3} />
            </mesh>
            {/* 屋面：压顶板只是一圈檐口，屋顶本身要有卷材颗粒，
                否则俯视时每栋楼都是一块黑色平板，相邻的楼还会糊成一整片。 */}
            <RoofDeck width={p.tier.w} depth={p.tier.d} night={lightsOn} y={tierH + 0.22} />
            <group position={[0, tierH, 0]}>
              <Parapet width={p.tier.w} depth={p.tier.d} palette={palette} height={0.9} thickness={0.26} />
              {isTop && (
                <group userData={{ buildingDetailLod: true, landmark: Boolean(def.landmark) }}>
                  <RoofGear seedKey={`${def.id}-gear`} width={p.tier.w} depth={p.tier.d} palette={palette} />
                </group>
              )}
            </group>
            <group userData={{ buildingDetailLod: true, landmark: Boolean(def.landmark) }}>
              <Skin
                width={p.tier.w}
                depth={p.tier.d}
                height={tierH}
                chamfer={p.chamfer}
                style={def.style}
                palette={palette}
                seed={seeded(def.id + '-skin' + i)()}
              />
            </group>
          </group>
        )
      })}

      <Plinth width={def.w} depth={def.d} palette={palette} />

      {hasShop && (
        <group
          position={[front.x, 0, front.z]}
          rotation={[0, rotation, 0]}
          userData={{ buildingDetailLod: true, landmark: Boolean(def.landmark) }}
        >
          {/* 店面推离墙面 0.2m：勒脚比墙面外凸 0.15m，贴太近会被它挡住 */}
          <mesh position={[0, 1.75, 0.2]}>
            <boxGeometry args={[shopW, 3.3, 0.14]} />
            <meshStandardMaterial
              color={lightsOn ? '#0d1723' : '#3f4d57'}
              roughness={0.1}
              metalness={0.78}
              emissive={palette.glowWarm}
              emissiveIntensity={lightsOn ? 0.16 : 0.04}
            />
          </mesh>
          {/* 橱窗内景：一张贴图就是"店里"，比一块加色矩形干净得多 */}
          <mesh position={[0, 1.7, 0.36]}>
            <planeGeometry args={[shopW * 0.86, 2.6]} />
            <meshBasicMaterial
              map={shopWindow}
              toneMapped={false}
              color={lightsOn ? '#ffffff' : '#8d979d'}
            />
          </mesh>
          {/* 雨棚 + 灯带 */}
          <mesh position={[0, 3.62, 0.95]} castShadow>
            <boxGeometry args={[shopW + 0.4, 0.16, 1.9]} />
            <meshStandardMaterial color={palette.trim} roughness={0.55} metalness={0.35} />
          </mesh>
          <mesh position={[0, 3.5, 1.88]}>
            <boxGeometry args={[shopW + 0.2, 0.05, 0.06]} />
            <meshBasicMaterial
              color={def.style === 'glass' ? palette.glass : palette.ar}
              transparent
              opacity={lightsOn ? 0.8 : 0.28}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
    </group>
  )
}
