import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { BuildingDef } from '../data/city'
import { useApp } from '../store'
import { makeGrainTexture, makeShopWindowTexture, makeSignTexture } from './textures'
import { bodyColor, nightFill, palettes, seeded, type Palette } from './theme'
import { STYLIZED } from './style'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GlowDisc } from './GlowDisc'
import { createFacadeMaterial } from './facade'
import { FacadeWindows } from './FacadeWindows'
import {
  entrancesOfBuilding,
  isUnitBuilding,
  unitBuilding,
  type UnitBuilding,
} from '../data/units'
import { UnitShell } from './UnitShell'
import { ShopFrontage } from './ShopFrontage'
import {
  CrownBand,
  DecoSpire,
  FireEscape,
  LedWall,
  LoadingDoors,
  RowhouseFront,
  SawtoothRoof,
  WalkupCornice,
} from './BuildingForms'
import { farEligible } from './FarCity'
import {
  ROOF_COLORS_DAY,
  ROOF_COLORS_NIGHT,
  facadeInset,
  hipRoofGeometry,
  isPitched,
  massOutline,
  roofOverhang,
} from './mass'

type Props = { def: BuildingDef }

/**
 * 切角八边形体量：把方盒子四个角削掉，剪影立刻不再是"四四方方"。
 * 所有窗框仍贴在四个正面上，所以不影响窗户布置。
 *
 * 每个转角再倒一个圆角、顶边再倒一道斜边：绝对锐利的直角是"白模感"的来源，
 * 倒角会在边上接住一条细高光，楼体立刻有体积、不再像钢筋水泥的硬盒子。
 * 法线按折角平滑（toCreasedNormals）：圆角内部连续，墙面与顶面的直角仍是硬的。
 */
function massGeometry(w: number, d: number, h: number, chamfer: number) {
  // 轮廓（切角 + 转角圆角）和远景壳子共用同一份，切面位置必须一致
  const shape = massOutline(w, d, chamfer)
  const bevel = Math.min(0.32, h * 0.22)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, h - bevel * 2),
    steps: 1,
    curveSegments: 3,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
  })
  geo.translate(0, 0, bevel)
  geo.rotateX(-Math.PI / 2)
  return toCreasedNormals(geo, Math.PI / 5)
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
        // 俯视时屋顶占画面一大半：浅灰屋顶会比墙还亮，整城像一盘白色积木。
        // 压成深石板蓝，亮的只留窗和灯。
        // 风格化夜景反过来：屋顶被月光照成浅蓝紫，是画面里最亮的大面，
        // 深砖墙 + 亮窗夹在中间，明暗才拉得开。
        // 饱和度要很低：再叠上偏冷的天光，#6b6a8c 这种就会亮成一片宝蓝紫
        color: night ? (STYLIZED ? '#5f5e68' : '#46484f') : '#9a9a91',
        map: roofTexture(),
        roughness: 0.97,
        metalness: 0.02,
        // 夜里屋顶不是靠"自己发光"变亮的，而是被天空辉光和周边高楼反射
        // 打亮的。那部分光属于环境光，走 envMapIntensity（IBL），
        // 以前用 emissive 假装是环境光，结果屋顶的亮度和别处不是一个来源，
        // 怎么调都读起来"不对劲"。
        // 和远景壳子（FarCity 的材质 1.05）对齐，否则远近切换时屋顶亮度跳一档
        envMapIntensity: 1.05,
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
        color: palette.key === 'night' ? (STYLIZED ? '#6c6b74' : '#55565e') : palette.trim,
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

/** 多层楼（≤ PITCHED_MAX_H）改用坡屋顶：俯视时一片深蓝坡顶是街区"有人住"的第一印象。
 *  这几样和远景壳子共用（mass.ts），两边轮廓必须一致。 */

function PitchedRoof({
  width,
  depth,
  palette,
  variant = 0,
  eave = [0.55, 0.55],
}: {
  width: number
  depth: number
  palette: Palette
  variant?: number
  /** 两个方向的挑檐，联排小楼的共墙方向是 0，见 mass.ts 的 roofOverhang */
  eave?: [number, number]
}) {
  const [ex, ez] = eave
  const geo = useMemo(() => hipRoofGeometry(width, depth, ex, ez), [width, depth, ex, ez])
  useEffect(() => () => geo.dispose(), [geo])
  const night = palette.key === 'night'
  const k = variant % ROOF_COLORS_NIGHT.length
  return (
    <mesh geometry={geo} position={[0, 0.05, 0]} castShadow receiveShadow>
      {/* 深石板蓝：和暖色墙面、暖窗形成冷暖对比，是地图类夜景的主色之一 */}
      {/* 饱和度要低：#3c4878 这种纯蓝在夜里会亮成一块宝蓝，像塑料玩具 */}
      {/* 风格化：屋顶跟墙走暖灰褐，蓝屋顶在冷色天光下会被照成一块宝蓝 */}
      <meshStandardMaterial
        color={night ? (STYLIZED ? ROOF_COLORS_NIGHT[k] : '#3b4256') : STYLIZED ? ROOF_COLORS_DAY[k] : '#67708a'}
        roughness={0.82}
        envMapIntensity={0.6}
      />
    </mesh>
  )
}

function Roof({ def, width, depth, top, palette }: { def: BuildingDef; width: number; depth: number; top: number; palette: Palette }) {
  if (isPitched(def)) {
    return (
      <group position={[0, top, 0]}>
        <PitchedRoof width={width} depth={depth} palette={palette} eave={roofOverhang(def)} />
      </group>
    )
  }
  return <FlatRoof def={def} width={width} depth={depth} top={top} palette={palette} />
}

function FlatRoof({ def, width, depth, top, palette }: { def: BuildingDef; width: number; depth: number; top: number; palette: Palette }) {
  // 夜里屋顶不是黑的：天光和周围更高的楼把光打下来，防水层、碎石、设备都看得见。
  // 原来压到 #16222f（线性 ~0.008），俯视时整片屋顶就是一块纯黑。
  const night = palette.key === 'night'
  const metal = night ? '#5c5f68' : '#9b9b92'
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
  const stone = palette.key === 'night' ? (STYLIZED ? '#55504b' : '#3a4d60') : '#cdd3d2'
  const shadow = palette.key === 'night' ? (STYLIZED ? '#3b3733' : '#22303f') : '#9aa4a6'
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
    // 风格化：壁柱 / 竖挺在 75m 内才显示，走近时整栋楼就像罩上了一圈栏杆
    if (STYLIZED) return null
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
    // 竖挺只有 11~34cm：远处不到一个像素，SMAA 修不了，只会在"有/无"之间闪，交给远景降级隐藏
    <mesh geometry={geo} castShadow receiveShadow userData={{ noMerge: true, buildingDetailLod: true }}>
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

  // 窗格要退到转角圆角的切线以内，否则最边上那一列会被圆弧切掉半扇
  const edgeInset = useMemo(() => facadeInset(bodyW, bodyD, chamfer), [bodyW, bodyD, chamfer])
  const bodyBase = def.setback ? 4.4 : 3.6
  // 临街面一定有窗；侧墙按种子留山墙，街区看着才不像四面都开满窗的模型
  const blank: 'x' | 'z' | 'none' =
    seeded(def.id + '-gable')() > 0.4
      ? def.entranceSide === 'east' || def.entranceSide === 'west'
        ? 'z'
        : 'x'
      : 'none'


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
        height: bodyH,
        base: bodyBase,
        inset: edgeInset,
        blank,
        seed: seeded(def.id + '-facade')(),
      }),
    [baseColor, def.style, def.id, bodyW, bodyD, bodyH, bodyBase, blank, palette, edgeInset],
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
  // 每栋楼的识别色：只给"入口"用一处，不再满楼描边。
  // 以前这个色会同时出现在裙房灯带、雨棚底、屋顶光环、竖向光缝上，
  // 一栋楼自己就有五六道发光边，远景看就是一张荧光网格。
  const accent = def.accent || palette.glowWarm

  const mass = useMemo(
    () => massGeometry(bodyW, bodyD, bodyH, chamfer),
    [bodyW, bodyH, chamfer],
  )
  useEffect(() => () => mass.dispose(), [mass])

  const podiumMass = useMemo(
    () => massGeometry(def.w, def.d, Math.max(0.5, podium), 0.6),
    [def.w, def.d, podium],
  )
  useEffect(() => () => podiumMass.dispose(), [podiumMass])

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

  useEffect(() => () => outline?.dispose(), [outline])

  return (
    <group position={[def.x, 0, def.z]}>
      {def.setback && (
        <>
          <mesh geometry={podiumMass} castShadow receiveShadow>
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
      <group position={[0, podium, 0]}>
        <FacadeWindows
          style={def.style}
          width={bodyW}
          depth={bodyD}
          height={bodyH}
          base={bodyBase}
          inset={edgeInset}
          blank={blank}
          wall={baseColor}
        />
      </group>

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
          <meshBasicMaterial
            map={STYLIZED ? null : shopWindow}
            toneMapped={false}
            color={palette.key === 'night' ? (STYLIZED ? '#ffcf8f' : '#ffffff') : '#8d979d'}
          />
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
          {/* 雨棚底面只该有一条暖光，不该是一整块发光板。
              原来 0.4 的青色叠加面在夜里读成"荧光蓝雨棚"。 */}
          <meshBasicMaterial color={palette.glowWarm} transparent opacity={0.18} toneMapped={false} />
        </mesh>
        <mesh position={[0, 3.6, 0.24]}>
          <boxGeometry args={[Math.min(faceWidth * 0.82, 8), 0.09, 0.07]} />
          <meshBasicMaterial color={palette.glowWarm} toneMapped={false} />
        </mesh>
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
      </group>

      {/* 屋顶、檐口、压顶是剪影的一部分，不能进远景降级：
          俯视时整座城都在 75m 外，进了降级组就等于屋顶永远是光板。
          手写楼只有二十几栋，常亮的开销可以忽略。 */}
      <Plinth width={bodyW} depth={bodyD} palette={palette} />
      <Cornice width={bodyW} depth={bodyD} y={def.h - 0.9} palette={palette} />

      <Roof def={def} width={bodyW} depth={bodyD} top={def.h} palette={palette} />

      {/* 顶部压边：跟着切角走，才不会在削角处露出一个方角 */}
      <mesh position={[0, podium + bodyH - 0.08, 0]} geometry={cap}>
        <meshStandardMaterial color={palette.trim} roughness={0.5} metalness={0.45} />
      </mesh>

      <group userData={{ buildingDetailLod: true, landmark: Boolean(def.landmark) }}>
        {/* 轮廓线只留给地标：普通楼体在移动时这条细亮线会闪成"漏光" */}
        {outline && def.landmark && (
          <lineSegments position={[0, podium, 0]} geometry={outline}>
            <lineBasicMaterial color={palette.glowWarm} transparent opacity={0.28} toneMapped={false} />
          </lineSegments>
        )}

        {/* 屋顶标志物：以前每栋楼顶都有一颗青色信标 + 一圈光环 + 一圈轮廓线，
            俯瞰时整城是一张发光的网格。参考那种城市模型里，屋顶是"实体"，
            发光只属于街道层。这里只留地标楼的一盏暖白航空障碍灯。 */}
        {palette.key === 'night' && def.landmark && (
          <mesh position={[bodyW * 0.36, def.h + 1.2, bodyD * 0.36]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color="#ff8a6a" toneMapped={false} />
          </mesh>
        )}
      </group>
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

  // 砖楼和居民楼是直角：切角面上排不了窗，转角会露出一条没窗的异色墙
  const chamfer = useMemo(
    () =>
      def.form === 'walkup' || def.form === 'estate' || def.form === 'rowhouse' || def.form === 'warehouse'
        ? 0.4
        : Math.min(Math.min(def.w, def.d) * 0.07, 2.6),
    [def.w, def.d, def.form],
  )

  // 退台：高楼的 78% 处收一次，上段更窄。真实高层几乎都有这个层次。
  const stepped = !def.form && def.setback && def.h > 44
  const tiers = useMemo(() => {
    if (def.form === 'deco') {
      // 装饰艺术塔楼：四级退台，越往上越瘦，顶上再立一根尖塔
      const steps: Array<[number, number]> = [
        [0.5, 1],
        [0.7, 0.78],
        [0.85, 0.58],
        [1, 0.4],
      ]
      let y0 = 0
      return steps.map(([cut, k]) => {
        const t = { y0, y1: Math.round(def.h * cut), w: def.w * k, d: def.d * k }
        y0 = t.y1
        return t
      })
    }
    if (!stepped) return [{ y0: 0, y1: def.h, w: def.w, d: def.d }]
    const cut = def.h * 0.76
    return [
      { y0: 0, y1: cut, w: def.w, d: def.d },
      { y0: cut, y1: def.h, w: def.w * 0.8, d: def.d * 0.8 },
    ]
  }, [stepped, def.form, def.h, def.w, def.d])

  // 每段的体量、压顶、材质
  const parts = useMemo(
    () =>
      tiers.map((t) => {
        const c = Math.min(chamfer, Math.min(t.w, t.d) * 0.4)
        // 窗格退到转角圆角的切线以内：只让出切角量不够，圆角还会再吃掉
        // 最多 0.64c，最边上一列窗就会被圆弧裁掉
        const inset = facadeInset(t.w, t.d, c)
        const base = (def.form === 'rowhouse' ? 0 : def.style === 'glass' ? 4.2 : 3.4) - t.y0
        // 侧墙（垂直于临街面）：多层楼贴着邻楼建，侧墙基本是不开窗的山墙；
        // 只有少数街角楼两面临街。高楼独立成栋，一半四面开窗
        const lowRise = def.form === 'walkup' || def.form === 'estate' || def.form === 'rowhouse' || def.form === 'warehouse'
        const blank: 'x' | 'z' | 'none' =
          seeded(def.id + '-gable')() > (lowRise ? 0.15 : 0.45)
            ? def.facing === 'east' || def.facing === 'west'
              ? 'z'
              : 'x'
            : 'none'
        return {
          tier: t,
          chamfer: c,
          inset,
          base,
          blank,
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
            // 联排小楼没有店面，首层也住人，窗从地面那层就开始排
            base,
            inset,
            blank,
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
  // 店面尽量占满整个临街面：商业街的连续性来自"一间挨着一间"，
  // 只在中间开 11m 的口子，两侧各留 4m 实墙，走过去就断成一节一节。
  // 两端要让开切角 + 转角圆角，否则店面会飘出墙面之外。
  // 用和立面窗格同一个 inset，店面和最外一列窗才不会互相错位。
  const edgeInset = parts.length > 0 ? parts[0].inset : facadeInset(def.w, def.d, chamfer)
  const shopW = Math.max(3, Math.min(span - edgeInset * 2, 26))
  // 以前 20% 的楼没有首层店面，街上就会突然出现一段没有灯的实墙。
  // 现在只留极少数例外，保证整条街的店面是连着的。
  // 居民小区不临街开店
  const hasShop = useMemo(
    () =>
      def.form !== 'estate' && def.form !== 'rowhouse' && def.form !== 'warehouse' && seeded(def.id + '-shop')() > 0.05,
    [def.id, def.form],
  )
  const roofVariant = useMemo(() => Math.floor(seeded(def.id + '-roof')() * 16), [def.id])

  return (
    <group position={[def.x, 0, def.z]} userData={farEligible(def) ? { hlod: def.id } : undefined}>
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
            <FacadeWindows
              style={def.style}
              width={p.tier.w}
              depth={p.tier.d}
              height={tierH}
              base={p.base}
              inset={p.inset}
              blank={p.blank}
              wall={wall}
            />
            {def.form === 'walkup' || def.form === 'estate' ? (
              <WalkupCornice width={p.tier.w} depth={p.tier.d} y={tierH} />
            ) : (
              <Cornice width={p.tier.w} depth={p.tier.d} y={tierH - 0.85} palette={palette} />
            )}
            {def.form === 'deco' && <CrownBand width={p.tier.w} depth={p.tier.d} y={tierH - 1.4} night={lightsOn} />}
            <mesh position={[0, tierH - 0.09, 0]} geometry={p.cap}>
              <meshStandardMaterial color={palette.trim} roughness={0.6} metalness={0.3} />
            </mesh>
            {/* 屋面：压顶板只是一圈檐口，屋顶本身要有卷材颗粒，
                否则俯视时每栋楼都是一块黑色平板，相邻的楼还会糊成一整片。 */}
            {isTop && isPitched(def) ? (
              <group position={[0, tierH, 0]}>
                <PitchedRoof
                  width={p.tier.w}
                  depth={p.tier.d}
                  palette={palette}
                  variant={def.form === 'rowhouse' ? roofVariant : 0}
                  eave={roofOverhang(def)}
                />
              </group>
            ) : (
            <>
            <RoofDeck width={p.tier.w} depth={p.tier.d} night={lightsOn} y={tierH + 0.22} />
            <group position={[0, tierH, 0]}>
              <Parapet width={p.tier.w} depth={p.tier.d} palette={palette} height={0.9} thickness={0.26} />
              {isTop && def.form === 'warehouse' && (
                <SawtoothRoof width={p.tier.w} depth={p.tier.d} night={lightsOn} seed={def.id} />
              )}
              {isTop && def.form === 'deco' && <DecoSpire width={p.tier.w} height={def.h} night={lightsOn} />}
              {/* 水塔、空调机组统一在 RoofProps 里实例化绘制，不再按楼挂载 */}
            </group>
            </>
            )}
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
          {/* 首层商铺带：分间橱窗 + 雨棚 + 发光店招 + 竖招。
              以前这里只有一块暗玻璃和大雨棚，整条街没有一处亮着的招牌。 */}
          <ShopFrontage width={shopW} palette={palette} night={lightsOn} seed={def.id} />
        </group>
      )}

      {def.form === 'walkup' && (
        <group
          position={[front.x, 0, front.z]}
          rotation={[0, rotation, 0]}
          userData={{ buildingDetailLod: true, landmark: Boolean(def.landmark) }}
        >
          <FireEscape
            span={span}
            height={def.h}
            seed={def.id}
            style={def.style}
            inset={parts[0].inset}
            base={def.style === 'glass' ? 4.2 : 3.4}
            night={lightsOn}
          />
        </group>
      )}
      {(def.form === 'rowhouse' || def.form === 'warehouse') && (
        <group
          position={[front.x, 0, front.z]}
          rotation={[0, rotation, 0]}
          userData={{ buildingDetailLod: true, landmark: Boolean(def.landmark) }}
        >
          {def.form === 'rowhouse' ? (
            <RowhouseFront span={span} style={def.style} inset={parts[0].inset} seed={def.id} night={lightsOn} />
          ) : (
            <LoadingDoors span={span} seed={def.id} night={lightsOn} />
          )}
        </group>
      )}
      {/* 广告墙不进远景降级：它是远看时城市颜色的主要来源 */}
      {def.form === 'billboard' && (
        <group position={[front.x, 0, front.z]} rotation={[0, rotation, 0]}>
          <LedWall span={span - edgeInset * 2} height={def.h} seed={def.id} night={lightsOn} />
          {/* 转角那一面也挂一列，招牌要从两条街上都看得见 */}
          <group position={[span / 2, 0, -frontDepth]} rotation={[0, Math.PI / 2, 0]}>
            <LedWall
              span={frontDepth * 2 - edgeInset * 2}
              height={def.h}
              seed={def.id + '-side'}
              night={lightsOn}
              density={0.7}
            />
          </group>
        </group>
      )}
    </group>
  )
}
