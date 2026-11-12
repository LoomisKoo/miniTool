// 临街 1 楼商铺带。
//
// 每面墙按 3.6~6.4m 切成几个开间，每个开间从 data/shopCatalog.ts 里领一家店。
// 店决定四件事：橱窗里画什么（业态）、门头什么做法、门面怎么开、门口摆什么。
//
// 这一版在几何上做了两件事：
// - 橱窗有了真实进深（门套 + 内退的内景 + 挑出的窗台 + 橱窗吊灯），
//   不再是"在墙上贴一张画"；
// - 雨棚用条纹布贴图，招牌按做法分四种立体结构（灯箱盒 / 霓虹管 / 木匾 /
//   布篷），板子的厚度、挂法、灯管位置都不一样。
//
// 坐标系和 ShopFronts.tsx 一致：原点在店面外墙中心，局部 +Z 朝街外、+X 沿墙，
// y=0 是地面。调用方负责把 group 摆到立面上。

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { makeShopDeck, type ShopCatalogEntry, type PropKind } from '../data/shopCatalog'
import {
  aboardTexture,
  awningTexture,
  bladeTexture,
  interiorTexture,
  menuStripTexture,
  signTexture,
} from './shopArt'
import { nightFill, seeded, type Palette } from './theme'
import { GlowDisc } from './GlowDisc'
import { STYLIZED } from './style'

// ---------------------------------------------------------------- 材质缓存
//
// 招牌和橱窗的颜色都烘在贴图里，材质只负责"白天压暗、夜里满亮"。
// 按 shop.id 缓存，整座城几百个开间最后只有几十个材质。

/**
 * 贴在墙面/背板上的发光面离底板只有 1~2cm，拉远后深度精度不够，
 * 一动视角就和底板来回抢（z-fighting）。用深度偏移让它稳定地画在前面。
 */
const DECAL = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } as const

const signMats = new Map<string, THREE.MeshBasicMaterial>()
function signMaterial(shop: ShopCatalogEntry, night: boolean) {
  const key = `${shop.id}|${night ? 1 : 0}`
  const hit = signMats.get(key)
  if (hit) return hit
  const mat = new THREE.MeshBasicMaterial({
    map: signTexture(shop),
    // 夜里也不给纯白：map 颜色乘 1.0 正好压在 Bloom 阈值上，一动就烧成一团白。
    // 0.94 仍然是"亮"，但色相留得住。
    color: night ? '#f0e8dc' : '#b4aea2',
    toneMapped: false,
    ...DECAL,
  })
  signMats.set(key, mat)
  return mat
}

const bladeMats = new Map<string, THREE.MeshBasicMaterial>()
function bladeMaterial(shop: ShopCatalogEntry, night: boolean) {
  const key = `${shop.id}|blade|${night ? 1 : 0}`
  const hit = bladeMats.get(key)
  if (hit) return hit
  const mat = new THREE.MeshBasicMaterial({
    map: bladeTexture(shop),
    color: night ? '#f0e8dc' : '#a8a29a',
    ...DECAL,
    toneMapped: false,
  })
  bladeMats.set(key, mat)
  return mat
}

const windowMats = new Map<string, THREE.MeshBasicMaterial>()
function windowMaterial(shop: ShopCatalogEntry, night: boolean, variant: number) {
  const key = `${shop.kind}|${shop.light}|${night ? 1 : 0}|${variant}`
  const hit = windowMats.get(key)
  if (hit) return hit
  // 内景画的是中性冷白，这里用业态的灯色染上去：面馆偏橙、药房偏青、
  // 便利店是冷白。同一张图，不同店进去是不同色温。
  const tint = new THREE.Color(shop.light).lerp(new THREE.Color('#ffffff'), 0.2)
  // 夜里不能满亮：BasicMaterial 的白色就是纯发光色，拉满会糊成一块灯箱。
  if (night) tint.multiplyScalar(0.82)
  else tint.multiplyScalar(0.54)
  // 风格化：橱窗只是一块按业态灯色发光的玻璃，不画店内陈设
  if (STYLIZED) tint.multiplyScalar(night ? 0.9 : 0.75)
  const mat = new THREE.MeshBasicMaterial({
    map: STYLIZED ? null : interiorTexture(shop.kind, night, variant),
    color: tint,
    toneMapped: false,
  })
  windowMats.set(key, mat)
  return mat
}

const aboardMats = new Map<string, THREE.MeshBasicMaterial>()
function aboardMaterial(shop: ShopCatalogEntry) {
  const key = shop.id
  const hit = aboardMats.get(key)
  if (hit) return hit
  const mat = new THREE.MeshBasicMaterial({ map: aboardTexture(shop), toneMapped: false })
  aboardMats.set(key, mat)
  return mat
}

const menuMats = new Map<string, THREE.MeshBasicMaterial>()
function menuMaterial(shop: ShopCatalogEntry) {
  const key = shop.id
  const hit = menuMats.get(key)
  if (hit) return hit
  const mat = new THREE.MeshBasicMaterial({ map: menuStripTexture(shop), toneMapped: false, side: THREE.DoubleSide })
  menuMats.set(key, mat)
  return mat
}

/** 雨棚布：条纹贴图按颜色缓存，同色的店共用。 */
const awningMats = new Map<string, THREE.MeshStandardMaterial>()
function awningMaterial(color: string, night: boolean) {
  const key = `${color}|${night ? 1 : 0}`
  const hit = awningMats.get(key)
  if (hit) return hit
  const mat = new THREE.MeshStandardMaterial({
    map: awningTexture(color, night),
    roughness: 0.94,
    metalness: 0.02,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(color),
    emissiveIntensity: night ? 0.06 : 0,
  })
  awningMats.set(key, mat)
  return mat
}

/** 灯管 / 洗墙光。按颜色缓存，别每个开间新建一个材质。 */
const glowMats = new Map<string, THREE.MeshBasicMaterial>()
function glowMaterial(color: string, night: boolean, wash: boolean) {
  const key = `${color}|${night ? 1 : 0}|${wash ? 1 : 0}`
  const hit = glowMats.get(key)
  if (hit) return hit
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: wash ? (night ? 0.16 : 0.06) : night ? 0.88 : 0.4,
    blending: wash ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !wash,
    toneMapped: false,
    ...DECAL,
  })
  glowMats.set(key, mat)
  return mat
}

/** 玻璃那层薄雾。全城共用两个，别按开间新建。 */
const sheenMats = [true, false].map(
  (n) =>
    new THREE.MeshBasicMaterial({
      color: '#cfe6ff',
      transparent: true,
      opacity: n ? 0.05 : 0.09,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
)

const lanternMats = new Map<string, THREE.MeshBasicMaterial>()
function lanternMaterial(night: boolean) {
  const key = night ? 'n' : 'd'
  const hit = lanternMats.get(key)
  if (hit) return hit
  const mat = new THREE.MeshBasicMaterial({ color: night ? '#ff8f66' : '#c2603f', toneMapped: false })
  lanternMats.set(key, mat)
  return mat
}

const canopyMats = new Map<string, THREE.MeshStandardMaterial>()
function canopyMaterial(color: string, glow: string, night: boolean) {
  const key = `${color}|${glow}|${night ? 1 : 0}`
  const hit = canopyMats.get(key)
  if (hit) return hit
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(glow),
    emissiveIntensity: night ? 0.12 : 0.02,
  })
  canopyMats.set(key, mat)
  return mat
}

type Bay = {
  x: number
  w: number
  shop: ShopCatalogEntry
  /** 窗台高：落地窗 0.25，高窗 0.75，半墙 1.1 */
  plinth: number
  door: number
  hasDoor: boolean
  wash: boolean
  variant: number
}

const WINDOW_TOP = 2.72
const SIGN_BASE = 3.0

/** 商场内圈店复用同一套材质缓存，别为每个铺位再生成一张贴图。 */
export const shopSignMaterial = signMaterial
export const shopWindowMaterial = windowMaterial
export const shopBladeMaterial = bladeMaterial

export function ShopFrontage({
  width,
  palette,
  night,
  seed,
  deck,
  deckBase = 0,
  shop: fixed,
}: {
  /** 店面沿墙宽度 */
  width: number
  palette: Palette
  night: boolean
  seed: string
  /**
   * 预先发好的店（见 data/shopCatalog.ts 的 makeShopDeck）。
   * 传了就从 deck[deckBase + i] 里取，保证这一段街上没有重名的店。
   */
  deck?: ShopCatalogEntry[]
  deckBase?: number
  /** 整面墙只有一家店（商场铺位就是这种）：所有开间都用它。 */
  shop?: ShopCatalogEntry
}) {
  const bays = useMemo<Bay[]>(() => {
    const rnd = seeded(`${seed}-bays`)
    // 先定开间数，再把总宽按随机权重分下去。
    // 不这么分的话，最后一个开间经常只剩 2m，只能并回上一间，
    // 于是一面 9m 的墙变成一整家店——街上看过去就成了"大平墙"。
    const n = Math.max(1, Math.min(5, Math.round(width / 4.8)))
    const gaps = 0.12 * (n - 1)
    const usable = width - gaps
    const weights = Array.from({ length: n }, () => 0.78 + rnd() * 0.5)
    const sum = weights.reduce((a, b) => a + b, 0)
    let widths = weights.map((w) => (usable * w) / sum)
    if (Math.min(...widths) < 2.7) widths = Array.from({ length: n }, () => usable / n)

    let cursor = -width / 2
    const deckLocal = deck ?? makeShopDeck(8, seed)
    return widths.map((w, i) => {
      const shop = fixed ?? deckLocal[(deckBase + i) % deckLocal.length]
      const x = cursor + w / 2
      cursor += w + 0.12
      const plinth =
        shop.front === 'half' ? 1.05 : shop.front === 'counter' ? 0.9 : [0.24, 0.38, 0.62][Math.floor(rnd() * 3)]
      return {
        x,
        w,
        shop,
        plinth,
        door: shop.front === 'counter' ? 0 : rnd() > 0.5 ? -0.5 : 0.5,
        hasDoor: shop.front !== 'counter',
        wash: shop.sign !== 'cloth' && shop.sign !== 'painted' && rnd() > 0.35,
        variant: Math.floor(rnd() * 2),
      }
    })
  }, [width, seed, deck, deckBase, fixed])

  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#2c343b' : palette.trim,
        roughness: 0.34,
        metalness: 0.72,
        envMapIntensity: 1.15,
        ...nightFill(night),
      }),
    [palette.trim, night],
  )
  const darkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#141a20' : '#39444b',
        roughness: 0.58,
        metalness: 0.35,
      }),
    [night],
  )
  const stoneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#3a3a38' : '#9a968c',
        roughness: 0.88,
        metalness: 0.06,
        ...nightFill(night),
      }),
    [night],
  )
  const woodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: night ? '#3a2c22' : '#7a5c3c',
        roughness: 0.82,
        metalness: 0.05,
      }),
    [night],
  )
  const greenMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: night ? '#2c3d30' : '#5f7a52', roughness: 1, flatShading: true }),
    [night],
  )
  useEffect(
    () => () => {
      frameMat.dispose()
      darkMat.dispose()
      stoneMat.dispose()
      woodMat.dispose()
      greenMat.dispose()
    },
    [frameMat, darkMat, stoneMat, woodMat, greenMat],
  )

  const mats = useMemo(() => ({ frameMat, darkMat, stoneMat, woodMat, greenMat }), [frameMat, darkMat, stoneMat, woodMat, greenMat])

  return (
    <group>
      {bays.map((b) => (
        <Bay key={b.x} b={b} night={night} {...mats} />
      ))}
      {night && <GlowDisc position={[0, 0.05, 1.9]} size={Math.min(width + 1.4, 11)} color="#ffd2a0" opacity={0.12} />}
    </group>
  )
}

type Mats = {
  frameMat: THREE.Material
  darkMat: THREE.Material
  stoneMat: THREE.Material
  woodMat: THREE.Material
  greenMat: THREE.Material
}

function Bay({ b, night, frameMat, darkMat, stoneMat, woodMat, greenMat }: { b: Bay; night: boolean } & Mats) {
  const { shop } = b
  const inner = b.w - 0.24
  const winH = WINDOW_TOP - b.plinth
  const winY = b.plinth + winH / 2
  const signH = shop.sign === 'cloth' ? 0.94 : shop.sign === 'canopy' ? 0.66 : 0.72
  const signY = SIGN_BASE + signH / 2
  const signGlow = shop.glow

  // 橱窗深度：内景退到墙面，四周一圈门套往前挑，于是有真实视差。
  const DEPTH = 0.32

  return (
    <group position={[b.x, 0, 0]}>
      {/* ── 橱窗 ───────────────────────────────────────── */}
      {/* 内景退到墙面附近 */}
      <mesh position={[0, winY, 0.06]} material={windowMaterial(shop, night, b.variant)}>
        <planeGeometry args={[inner, winH]} />
      </mesh>

      {/* 门套：两颊 + 上楣 + 挑出的窗台 */}
      {[-1, 1].map((s) => (
        <mesh
          key={`j${s}`}
          position={[s * (inner / 2 + 0.04), winY, DEPTH / 2 + 0.02]}
          material={frameMat}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.12, winH + 0.28, DEPTH]} />
        </mesh>
      ))}
      <mesh position={[0, WINDOW_TOP + 0.14, DEPTH / 2 + 0.02]} material={frameMat} castShadow>
        <boxGeometry args={[inner + 0.26, 0.18, DEPTH]} />
      </mesh>
      {/* 窗台：石质，往外挑 0.14m，白天落一道阴影 */}
      <mesh position={[0, b.plinth - 0.07, DEPTH * 0.5 + 0.1]} material={stoneMat} castShadow receiveShadow>
        <boxGeometry args={[inner + 0.32, 0.14, DEPTH + 0.2]} />
      </mesh>
      <mesh position={[0, b.plinth - 0.17, DEPTH * 0.5 + 0.14]} material={stoneMat}>
        <boxGeometry args={[inner + 0.18, 0.12, DEPTH + 0.06]} />
      </mesh>

      {/* 内景上方一条灯槽 */}
      <mesh position={[0, WINDOW_TOP - 0.05, 0.16]} material={glowMaterial(signGlow, night, false)}>
        <boxGeometry args={[inner - 0.12, 0.025, 0.04]} />
      </mesh>

      {/* 橱窗里的吊灯：吊杆 + 灯罩 + 灯泡。真实的前后关系比任何贴图都更能
          说明"这是橱窗，不是一张画"。 */}
      {shop.front === 'glass' && winH > 1.9 && (
        <group position={[(b.variant % 2 ? 0.22 : -0.22) * inner, 0, 0.18]}>
          <mesh position={[0, WINDOW_TOP - 0.38, 0]} material={darkMat}>
            <cylinderGeometry args={[0.007, 0.007, 0.62, 4]} />
          </mesh>
          <mesh position={[0, WINDOW_TOP - 0.72, 0]} material={darkMat} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.115, 0.14, 10, 1, true]} />
          </mesh>
          <mesh position={[0, WINDOW_TOP - 0.78, 0]} material={glowMaterial(signGlow, night, false)}>
            <sphereGeometry args={[0.045, 6, 4]} />
          </mesh>
        </group>
      )}

      {/* ── 门面做法 ───────────────────────────────────── */}
      {shop.front === 'glass' && (
        <>
          {/* 中挺：把整面玻璃分成 2~3 格，别让橱窗像一块大屏幕 */}
          {inner > 3.6 && (
            <mesh position={[0, winY, 0.3]} material={frameMat}>
              <boxGeometry args={[0.06, winH, 0.1]} />
            </mesh>
          )}
          {inner > 5.2 &&
            [-0.28, 0.28].map((f) => (
              <mesh key={f} position={[f * inner, winY, 0.3]} material={frameMat}>
                <boxGeometry args={[0.05, winH, 0.08]} />
              </mesh>
            ))}
          {b.hasDoor && (
            <group position={[b.door * (b.w / 2 - 0.72), 0, 0.3]}>
              {[-0.42, 0.42].map((dx) => (
                <mesh key={dx} position={[dx, 1.14, 0]} material={frameMat}>
                  <boxGeometry args={[0.05, 2.26, 0.1]} />
                </mesh>
              ))}
              <mesh position={[0, 2.28, 0]} material={frameMat}>
                <boxGeometry args={[0.9, 0.05, 0.1]} />
              </mesh>
              {/* 门把手 */}
              <mesh position={[0.24, 1.16, 0.07]} material={frameMat}>
                <boxGeometry args={[0.035, 0.3, 0.035]} />
              </mesh>
              {/* 门槛石 */}
              <mesh position={[0, 0.02, 0.1]} material={stoneMat}>
                <boxGeometry args={[1.06, 0.05, 0.44]} />
              </mesh>
            </group>
          )}
          {/* 玻璃的一点点反光，只是一层薄雾，不挡里面 */}
          <mesh position={[0, winY, 0.33]} material={sheenMats[night ? 0 : 1]}>
            <planeGeometry args={[inner, winH]} />
          </mesh>
        </>
      )}

      {shop.front === 'counter' && (
        <>
          {/* 敞开档口：下面是实心台基，上面空着 */}
          <mesh position={[0, 0.44, 0.32]} material={woodMat} castShadow receiveShadow>
            <boxGeometry args={[inner, 0.88, 0.6]} />
          </mesh>
          {/* 台面：一层薄石，比木台基亮一点，反出店里的光 */}
          <mesh position={[0, 0.92, 0.32]} material={stoneMat} castShadow>
            <boxGeometry args={[inner + 0.06, 0.08, 0.68]} />
          </mesh>
          {/* 台面上的收银机 / 托盘 */}
          {[-0.3, -0.02, 0.26].map((f) => (
            <mesh key={f} position={[f * inner, 1.0, 0.3]} material={darkMat}>
              <boxGeometry args={[Math.min(0.46, inner * 0.17), 0.1, 0.32]} />
            </mesh>
          ))}
          {/* 档口上方的横梁：有了它，空着的上半截才不显得"缺一块" */}
          <mesh position={[0, WINDOW_TOP + 0.06, 0.28]} material={frameMat} castShadow>
            <boxGeometry args={[inner + 0.1, 0.14, 0.14]} />
          </mesh>
        </>
      )}

      {shop.front === 'half' && (
        <>
          {/* 半墙 + 矮窗：窗台 1.05m，墙裙是石材 */}
          <mesh position={[0, b.plinth / 2, 0.26]} material={stoneMat} castShadow receiveShadow>
            <boxGeometry args={[inner + 0.1, b.plinth, 0.22]} />
          </mesh>
          {inner > 4 && (
            <mesh position={[0, winY, 0.3]} material={frameMat}>
              <boxGeometry args={[0.06, winH, 0.1]} />
            </mesh>
          )}
          <mesh position={[0, winY, 0.33]} material={sheenMats[night ? 0 : 1]}>
            <planeGeometry args={[inner, winH]} />
          </mesh>
          {/* 门口是窄门，开在窗台那一侧 */}
          <group position={[b.door * (b.w / 2 - 0.62), 0, 0.3]}>
            <mesh position={[0, 1.06, 0]} material={darkMat}>
              <boxGeometry args={[0.86, 2.12, 0.08]} />
            </mesh>
            <mesh position={[0.28, 1.04, 0.06]} material={frameMat}>
              <boxGeometry args={[0.03, 0.26, 0.03]} />
            </mesh>
          </group>
        </>
      )}

      {shop.front === 'shutter' && (
        <>
          {/* 半拉的卷帘：上沿暗、下沿有一道透光的缝 */}
          <mesh position={[0, (1.3 + WINDOW_TOP) / 2, 0.26]} material={frameMat}>
            <boxGeometry args={[inner, WINDOW_TOP - 1.3, 0.05]} />
          </mesh>
          {/* 卷帘的横向叶片 */}
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[0, 1.38 + i * 0.2, 0.29]} material={darkMat}>
              <boxGeometry args={[inner, 0.02, 0.02]} />
            </mesh>
          ))}
          <mesh position={[0, 1.3, 0.3]} material={glowMaterial(signGlow, night, false)}>
            <boxGeometry args={[inner, 0.04, 0.06]} />
          </mesh>
        </>
      )}

      {/* ── 雨棚 ───────────────────────────────────────── */}
      {shop.awning && (
        <>
          <mesh
            position={[0, WINDOW_TOP + 0.16, 0.5]}
            rotation={[0.26, 0, 0]}
            material={awningMaterial(shop.awning, night)}
            castShadow
          >
            <boxGeometry args={[inner, 0.05, 1.0]} />
          </mesh>
          {/* 前檐垂下的布边：一块斜板看着像塑料，加这道垂边才像布篷 */}
          <mesh position={[0, WINDOW_TOP - 0.02, 0.99]} material={awningMaterial(shop.awning, night)}>
            <boxGeometry args={[inner, 0.24, 0.04]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              position={[s * (inner / 2 - 0.05), WINDOW_TOP - 0.16, 0.86]}
              rotation={[0.92, 0, 0]}
              material={darkMat}
            >
              <cylinderGeometry args={[0.013, 0.013, 0.62, 4]} />
            </mesh>
          ))}
        </>
      )}

      {/* ── 招牌 ───────────────────────────────────────── */}
      {shop.sign === 'painted' ? (
        /* 手绘墙招：直接画在墙上，没有板子，只有一圈细木框 */
        <>
          <mesh position={[0, 3.3, 0.02]} material={signMaterial(shop, night)}>
            <planeGeometry args={[Math.min(inner, 4.6), 1.05]} />
          </mesh>
          <mesh position={[0, 3.86, 0.03]} material={woodMat}>
            <boxGeometry args={[Math.min(inner, 4.6) + 0.1, 0.05, 0.05]} />
          </mesh>
          <mesh position={[0, 2.76, 0.03]} material={woodMat}>
            <boxGeometry args={[Math.min(inner, 4.6) + 0.1, 0.05, 0.05]} />
          </mesh>
        </>
      ) : shop.sign === 'canopy' ? (
        /* 布篷招牌：雨棚本身就是招牌，字印在前檐上 */
        <>
          <mesh position={[0, 3.42, 0.42]} rotation={[0.36, 0, 0]} material={awningMaterial(shop.panel, night)} castShadow>
            <boxGeometry args={[inner + 0.1, 0.05, 1.16]} />
          </mesh>
          <mesh position={[0, 3.02, 0.94]} material={signMaterial(shop, night)}>
            <planeGeometry args={[inner, 0.44]} />
          </mesh>
          <mesh position={[0, 3.02, 0.9]} material={darkMat}>
            <boxGeometry args={[inner + 0.08, 0.52, 0.04]} />
          </mesh>
        </>
      ) : (
        <>
          {/* 灯箱 / 霓虹 / 木匾 / 布幔 / 点阵：一块有厚度的板 + 一块发光面 */}
          <mesh position={[0, signY, 0.2]} material={darkMat} castShadow>
            <boxGeometry args={[b.w - 0.1, signH + 0.12, 0.16]} />
          </mesh>
          <mesh position={[0, signY, 0.29]} material={signMaterial(shop, night)}>
            <planeGeometry args={[Math.max(0.4, b.w - 0.32), signH]} />
          </mesh>
          {/* 招牌上下的包边：一条细金属压条，板子才不是一块悬空的画 */}
          {[1, -1].map((s) => (
            <mesh key={s} position={[0, signY + (s * (signH + 0.12)) / 2, 0.22]} material={frameMat}>
              <boxGeometry args={[b.w - 0.08, 0.035, 0.19]} />
            </mesh>
          ))}
        </>
      )}

      {/* 招牌下沿的灯管：夜里把橱窗顶照出一道亮边 */}
      <mesh position={[0, WINDOW_TOP + 0.3, 0.36]} material={glowMaterial(signGlow, night, false)}>
        <boxGeometry args={[b.w - 0.26, 0.07, 0.045]} />
      </mesh>

      {/* 往墙上打的一小片光：没有它，招牌像是贴上去的 */}
      {b.wash && (
        <mesh position={[0, signY + signH / 2 + 0.36, 0.02]} material={glowMaterial(signGlow, night, true)}>
          <planeGeometry args={[b.w * 0.9, 0.8]} />
        </mesh>
      )}

      {/* ── 竖招 ───────────────────────────────────────── */}
      {shop.blade && (
        <group position={[b.w / 2 - 0.24, signY - 0.18, 0.54]}>
          {/* 挂挑臂 */}
          <mesh position={[0, 0.62, -0.16]} material={frameMat}>
            <boxGeometry args={[0.04, 0.04, 0.36]} />
          </mesh>
          <mesh material={darkMat} castShadow>
            <boxGeometry args={[0.05, 1.12, 0.5]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              position={[s * 0.031, 0, 0]}
              rotation={[0, (s * Math.PI) / 2, 0]}
              material={bladeMaterial(shop, night)}
            >
              <planeGeometry args={[0.42, 0.98]} />
            </mesh>
          ))}
        </group>
      )}

      {/* ── 门口道具 ───────────────────────────────────── */}
      {shop.props.map((p, i) => (
        <Prop
          key={`${p}${i}`}
          kind={p}
          shop={shop}
          index={i}
          w={inner}
          night={night}
          darkMat={darkMat}
          woodMat={woodMat}
          greenMat={greenMat}
        />
      ))}
    </group>
  )
}

/** 门口摆的东西。都只有几块几何，合批之后基本不花钱，但一条街立刻就"活"了。 */
function Prop({
  kind,
  shop,
  index,
  w,
  night,
  darkMat,
  woodMat,
  greenMat,
}: {
  kind: PropKind
  shop: ShopCatalogEntry
  index: number
  w: number
  night: boolean
  darkMat: THREE.Material
  woodMat: THREE.Material
  greenMat: THREE.Material
}) {
  // 道具沿店面宽度错开摆，避免两家店的东西叠在一起
  const side = index % 2 === 0 ? -1 : 1
  const x = side * Math.min(w / 2 - 0.5, 1.3 + index * 0.18)

  if (kind === 'aboard') {
    return (
      <group position={[x, 0, 1.02]} rotation={[0, side * 0.22, 0]}>
        <mesh position={[0, 0.44, 0]} rotation={[0.16, 0, 0]} material={aboardMaterial(shop)}>
          <planeGeometry args={[0.54, 0.84]} />
        </mesh>
        <mesh position={[0, 0.44, -0.16]} rotation={[-0.16, 0, 0]} material={woodMat}>
          <boxGeometry args={[0.54, 0.84, 0.04]} />
        </mesh>
      </group>
    )
  }
  if (kind === 'menu') {
    return (
      <mesh position={[x, 1.62, 0.6]} material={menuMaterial(shop)}>
        <planeGeometry args={[0.3, 0.88]} />
      </mesh>
    )
  }
  if (kind === 'crates') {
    return (
      <group position={[x, 0, 0.92]}>
        {[0, 1].map((k) => (
          <mesh key={k} position={[k * 0.06, 0.16 + k * 0.32, -k * 0.05]} material={woodMat} castShadow>
            <boxGeometry args={[0.6, 0.3, 0.44]} />
          </mesh>
        ))}
        <mesh position={[0.06, 0.5, -0.05]} material={greenMat}>
          <boxGeometry args={[0.54, 0.1, 0.38]} />
        </mesh>
      </group>
    )
  }
  if (kind === 'planter') {
    return (
      <group position={[x, 0, 0.88]}>
        <mesh position={[0, 0.2, 0]} material={darkMat} castShadow>
          <cylinderGeometry args={[0.22, 0.17, 0.4, 8]} />
        </mesh>
        <mesh position={[0, 0.62, 0]} material={greenMat} castShadow>
          <icosahedronGeometry args={[0.32, 0]} />
        </mesh>
      </group>
    )
  }
  if (kind === 'bench') {
    return (
      <group position={[x, 0, 1.24]}>
        <mesh position={[0, 0.42, 0]} material={woodMat} castShadow>
          <boxGeometry args={[1.0, 0.08, 0.36]} />
        </mesh>
        {[-0.36, 0.36].map((dx) => (
          <mesh key={dx} position={[dx, 0.2, 0]} material={darkMat}>
            <boxGeometry args={[0.06, 0.42, 0.32]} />
          </mesh>
        ))}
      </group>
    )
  }
  if (kind === 'umbrella') {
    return (
      <group position={[x, 0, 1.3]}>
        <mesh position={[0, 0.85, 0]} material={darkMat}>
          <cylinderGeometry args={[0.025, 0.025, 1.7, 5]} />
        </mesh>
        <mesh position={[0, 1.82, 0]} material={canopyMaterial(shop.awning ?? shop.panel, shop.glow, night)}>
          <coneGeometry args={[1.0, 0.42, 8]} />
        </mesh>
      </group>
    )
  }
  if (kind === 'lantern') {
    return (
      <group position={[x, 2.44, 0.76]}>
        <mesh material={lanternMaterial(night)}>
          <sphereGeometry args={[0.155, 8, 6]} />
        </mesh>
        <mesh position={[0, 0.2, 0]} material={darkMat}>
          <cylinderGeometry args={[0.018, 0.018, 0.26, 4]} />
        </mesh>
      </group>
    )
  }
  if (kind === 'barrel') {
    return (
      <mesh position={[x, 0.3, 0.9]} material={woodMat} castShadow>
        <cylinderGeometry args={[0.26, 0.3, 0.6, 10]} />
      </mesh>
    )
  }
  if (kind === 'bike') {
    return (
      <group position={[x, 0, 1.05]} rotation={[0, side * 0.3, 0]}>
        {[-0.34, 0.34].map((dx) => (
          <mesh key={dx} position={[dx, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]} material={darkMat}>
            <torusGeometry args={[0.32, 0.028, 6, 14]} />
          </mesh>
        ))}
        <mesh position={[0, 0.46, 0]} material={darkMat}>
          <boxGeometry args={[0.7, 0.035, 0.035]} />
        </mesh>
        <mesh position={[0, 0.66, 0]} material={darkMat}>
          <boxGeometry args={[0.045, 0.36, 0.045]} />
        </mesh>
      </group>
    )
  }
  // qrcode：一块贴在门边的小牌子
  return (
    <mesh position={[x, 1.32, 0.38]}>
      <planeGeometry args={[0.24, 0.24]} />
      <meshBasicMaterial color="#f2f6f8" toneMapped={false} />
    </mesh>
  )
}
