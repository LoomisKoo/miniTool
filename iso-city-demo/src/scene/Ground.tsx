import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  alley,
  alleyMouth,
  crossStreet,
  mainStreet,
  plaza,
  plazaFountain,
  southCross,
  westAvenue,
  eastAvenue,
  insideRoad,
} from '../data/city'
import { useApp } from '../store'
import { makeAsphaltTexture, makePavingTexture } from './textures'
import { makeAsphaltMaps, makeConcreteMaps, makePavingMaps, type SurfaceMaps } from './pbr'
import { palettes, type Palette } from './theme'

/** 地面贴花（车道线、斑马线、井盖）都用这一组深度偏移，
    否则与路面只差几毫米，远景必然 z-fighting 闪烁。

    注意贴花高度只能比沥青高 5mm 左右。抬到 6cm 以上是为了压过那些居中的
    铺装板，代价是车道线在斜视下变成一根根浮在路面上的凸条。 */
const DECAL = {
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -8,
} as const

/**
 * 铺装材质：贴图按世界坐标铺，而不是按每块板的 UV。
 *
 * 原来每块 PavedSurface 自己设 repeat（w/9、d/9），相邻两块板只要尺寸不同，
 * 砖缝就错位、接缝处还会因为贴图不闭环多出一道边。看起来就是"人行道上多出
 * 一堆对不齐的凸起网格线"。改成在着色器里用世界坐标采样，整片地面共用一套
 * 连续的砖缝，接缝自然消失。
 *
 * 顺便在 26m→95m 把细节混回平均色：远处每个像素要采样几十条砖缝，
 * 多级纹理也压不住摩尔纹，直接淡掉最干净。
 */
function pavingMaterial(
  texture: THREE.Texture,
  flat: string,
  tile = 9,
  near = 26,
  far = 95,
  maps?: SurfaceMaps | null,
  look?: {
    roughness?: number
    metalness?: number
    envMapIntensity?: number
    /** 法线强度倍率。默认 0.6：贴图本身已经算好了方向，材质不该再放大一遍。 */
    normalScale?: number
    /** 1 = 湿路面。湿痕由世界坐标噪声实时算，不再烘进平铺贴图。 */
    wet?: number
    /** 再叠一层次级尺度的贴图采样，压掉贴图平铺的重复感（沥青用）。 */
    twoScale?: boolean
    /** 夜间底光：给地面一点自发光，没有灯照到的街面也不会塌成纯黑。0 = 关。 */
    glow?: number
  },
) {
  const color = new THREE.Color(flat)
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: look?.roughness ?? 0.86,
    metalness: look?.metalness ?? 0.12,
    envMapIntensity: look?.envMapIntensity ?? 0.85,
    normalMap: maps?.normalMap ?? null,
    roughnessMap: maps?.roughnessMap ?? null,
  })
  if (maps) {
    const s = look?.normalScale ?? 0.6
    material.normalScale.set(s, s)
  }
  // 城市夜光：用地面自身的颜色当发光色，只是整体抬一点亮度。
  // 它替代不了路灯，但能让没有直射光的人行道/广场保留材质和层次，
  // 而不是一整片死黑（夜里的地面本来就被低云和满城的灯反着照亮）。
  if (look?.glow) {
    // 往中性夜蓝拉一点：铺装本身颜色够亮时几乎不变，巷子里那些
    // 刻意压暗的深色地面也不会真的黑成一块洞。
    material.emissive = new THREE.Color(flat).lerp(new THREE.Color('#39424a'), 0.4)
    material.emissiveIntensity = look.glow
  }
  // 有了法线/粗糙度贴图之后，材质的 roughness 要退成 1，
  // 让贴图完全控制干湿分布，否则两者相乘会把水洼的镜面反射又拉回哑光。
  if (maps?.roughnessMap) material.roughness = 1
  const wetAmount = look?.wet ?? 0
  const twoScale = Boolean(look?.twoScale)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFlat = { value: color }
    shader.uniforms.uFadeNear = { value: near }
    shader.uniforms.uFadeFar = { value: far }
    shader.uniforms.uTile = { value: tile }
    shader.uniforms.uWet = { value: wetAmount }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTile;
varying vec2 vGroundXZ;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;
// 颜色、法线、粗糙度共用同一套世界坐标采样：砖缝在三种贴图里严丝合缝，
// 不会出现"颜色有缝、光照没缝"的割裂感。
#ifdef USE_MAP
  vMapUv = vGroundXZ / uTile;
#endif
#ifdef USE_NORMALMAP
  vNormalMapUv = vGroundXZ / uTile;
#endif
#ifdef USE_ROUGHNESSMAP
  vRoughnessMapUv = vGroundXZ / uTile;
#endif`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uFlat;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uTile;
uniform float uWet;
varying vec2 vGroundXZ;

float groundHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float groundNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = groundHash(i);
  float b = groundHash(i + vec2(1.0, 0.0));
  float c = groundHash(i + vec2(0.0, 1.0));
  float d = groundHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
/* 世界坐标的干湿分布：斑块尺度 6~22m，与贴图 8m/9m 的平铺无关，
   所以不会再出现"一格一格的湿斑/亮斑"。 */
float groundWet(vec2 p) {
  vec2 r = mat2(0.8, -0.6, 0.6, 0.8) * p;
  float big = groundNoise(r / 21.0);
  float mid = groundNoise(r / 7.3 + 13.7);
  return smoothstep(0.5, 0.78, big * 0.66 + mid * 0.34);
}`,
      )
      .replace(
        '#include <map_fragment>',
        twoScale
          ? `vec2 groundUvA = vGroundXZ / uTile;
  vec2 groundUvB = mat2(0.86, -0.51, 0.51, 0.86) * vGroundXZ / (uTile * 2.63);
  float viewDist = length(vViewPosition);
  // 远处地面本来就被 uFlat 盖掉了（uFadeFar 之外完全不看贴图），
  // 再采第二张、再算一遍噪声纯属白白吃带宽。detail 在 0.7·uFadeFar
  // 开始收，到 uFadeFar 归零，交接处正好落在完全看不见细节的距离上。
  float groundDetail = 1.0 - smoothstep(uFadeFar * 0.7, uFadeFar, viewDist);
  vec4 sampledDiffuseColor = texture2D(map, groundUvA);
  if (groundDetail > 0.002) {
    sampledDiffuseColor = mix(sampledDiffuseColor, texture2D(map, groundUvB), 0.45 * groundDetail);
  }
  diffuseColor *= sampledDiffuseColor;
  diffuseColor.rgb = mix(diffuseColor.rgb, uFlat, smoothstep(uFadeNear, uFadeFar, viewDist));`
          : `vec4 sampledDiffuseColor = texture2D(map, vGroundXZ / uTile);
  diffuseColor *= sampledDiffuseColor;
  float viewDist = length(vViewPosition);
  diffuseColor.rgb = mix(diffuseColor.rgb, uFlat, smoothstep(uFadeNear, uFadeFar, viewDist));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  if (uWet > 0.001) {
    // 湿处只比干处稍微细腻一点：以前这里把粗糙度直接压到 0.07，
    // 地面变成一面镜子，整条街都在反光。街面是沥青/石材，不是水塘。
    // 噪声（两次 value noise，八次 sin）按距离收掉：远景的湿斑本来就
    // 被 uFlat 抹平，继续算只是给每个远处的像素加一笔开销。
    float wetDetail = 1.0 - smoothstep(uFadeFar * 0.7, uFadeFar, length(vViewPosition));
    float wetSpot = wetDetail > 0.002 ? groundWet(vGroundXZ) * wetDetail : 0.0;
    roughnessFactor = mix(roughnessFactor, 0.5, wetSpot * uWet * 0.6);
    roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.8, uWet * 0.5 * wetDetail);
  }`,
      )
  }
  material.customProgramCacheKey = () =>
    `paving-${tile}-${near}-${far}-${maps ? 'pbr' : 'flat'}-${wetAmount}-${twoScale ? 'ts' : 'ss'}`
  return material
}

// 同一套铺装会被切成几十段（路口要断开），贴图必须复用，否则每段都跑一次
// 法线卷积，进城市要多花几百毫秒。
const surfaceCache = new Map<string, SurfaceMaps>()
function sharedMaps(key: string, make: () => SurfaceMaps) {
  const hit = surfaceCache.get(key)
  if (hit) return hit
  const maps = make()
  surfaceCache.set(key, maps)
  return maps
}

type SurfaceProps = {
  x: number
  z: number
  w: number
  d: number
  tint: string
  line: string
  y?: number
  wet?: boolean
  glow?: number
}

function PavedSurface({ x, z, w, d, tint, line, y = 0.02, wet = false, glow = 0 }: SurfaceProps) {
  const texture = useMemo(() => makePavingTexture(tint, line), [tint, line])
  const maps = useMemo(
    () => sharedMaps(`paving-${tint}-${line}-${wet}`, () => makePavingMaps(wet)),
    [tint, line, wet],
  )
  // 砖缝走世界坐标，一块板多大都不影响格子对齐
  const material = useMemo(
    () =>
      pavingMaterial(texture, tint, 9, 26, 95, maps, {
        // 铺装是石材/砖，哑光：环境反射调低一档，不能像抛了光的地砖
        roughness: wet ? 0.86 : 0.97,
        metalness: 0,
        envMapIntensity: wet ? 0.5 : 0.32,
        normalScale: 0.45,
        wet: wet ? 1 : 0,
        glow,
      }),
    [texture, tint, maps, wet, glow],
  )
  useEffect(() => () => material.dispose(), [material])
  // 铺装比沥青只高 1cm：远景里这个高差小于深度缓冲的分辨力，
  // 斜看会闪成一条条虚线。跟 AsphaltSurface 一样在深度空间再压一次。
  useEffect(() => {
    material.polygonOffset = true
    material.polygonOffsetFactor = -4
    material.polygonOffsetUnits = -8
    material.needsUpdate = true
  }, [material])
  return (
    // noMerge：这套材质带自定义 shader（远景淡出），合批时会换成普通材质而失效。
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[x, y, z]}
      receiveShadow
      material={material}
      userData={{ noMerge: true }}
    >
      <planeGeometry args={[w, d]} />
    </mesh>
  )
}

function AsphaltSurface({
  x,
  z,
  w,
  d,
  color,
  y = 0.012,
  wet = false,
  glow = 0,
}: {
  x: number
  z: number
  w: number
  d: number
  color: string
  y?: number
  wet?: boolean
  glow?: number
}) {
  const texture = useMemo(() => makeAsphaltTexture(color, 0.85), [color])
  const maps = useMemo(
    () => sharedMaps(`asphalt-${color}-${wet}`, () => makeAsphaltMaps(0.46, wet)),
    [color, wet],
  )
  const material = useMemo(() => {
    const mat = pavingMaterial(texture, color, 8, 26, 100, maps, {
      // 沥青是哑光材质：不靠反射出效果。
      // 以前湿路面 roughness 压到 0.62、envMapIntensity 1.15，白天看整条街
      // 像刚下过雨的镜面；沥青真实的观感是粗糙、几乎不反射天空。
      roughness: wet ? 0.74 : 0.99,
      metalness: wet ? 0.06 : 0,
      envMapIntensity: wet ? 0.8 : 0.28,
      normalScale: wet ? 0.42 : 0.55,
      wet: wet ? 1 : 0,
      // 沥青是均匀颗粒：单尺度采样时 8m 平铺会读成一格一格的方块，
      // 再叠一层 2.6 倍尺度、转 30° 的采样，重复感就被打散了。
      twoScale: true,
      glow,
    })
    // 车道之间在路口会互相重叠，靠深度偏移压住同层共面
    mat.polygonOffset = true
    mat.polygonOffsetFactor = -2
    mat.polygonOffsetUnits = -4
    return mat
  }, [texture, color, maps, wet, glow])
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[x, y, z]}
      receiveShadow
      material={material}
      userData={{ noMerge: true }}
    >
      <planeGeometry args={[w, d]} />
    </mesh>
  )
}

/** 地面上的光池：灯下的柔光，夜间提升纵深。 */
function GlowPool({
  x,
  z,
  r,
  color,
  opacity = 0.5,
}: {
  x: number
  z: number
  r: number
  color: string
  opacity?: number
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
    g.addColorStop(0, color)
    g.addColorStop(0.4, `${color}99`)
    g.addColorStop(1, '#00000000')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [color])

  return (
    // 光池必须压在整条路面的最前面。广场、喷泉环、路面都带负的 polygonOffset
    // （factor -2 ~ -6），那是斜率相关的深度偏移，斜着看地面时偏移量远比 2~3cm
    // 的高差大，于是 0.055 高的光池会被广场/喷泉环的方片"抢走"深度，
    // 屏幕上就是一块被直线切掉边角的蓝色光斑。
    // 这里抬高到 0.1，再给自己一个更强的负偏移，任何地面层都盖不住它；
    // depthWrite 关掉，所以它只影响自己的深度测试，不会连累别的物体。
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.1, z]} renderOrder={3}>
      <planeGeometry args={[r * 2, r * 2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-16}
        polygonOffsetUnits={-32}
      />
    </mesh>
  )
}

/** 人行道在路口断开的位置：沿 z 铺的人行道要给横向车行道让路，反之亦然。 */
const SIDEWALK_Z = splitByGaps([
  [southCross.z - southCross.d / 2, southCross.z + southCross.d / 2],
  [crossStreet.z - crossStreet.d / 2, crossStreet.z + crossStreet.d / 2],
])
const SIDEWALK_X = splitByGaps([
  [westAvenue.x - westAvenue.w / 2, westAvenue.x + westAvenue.w / 2],
  [mainStreet.x - mainStreet.w / 2, mainStreet.x + mainStreet.w / 2],
  [eastAvenue.x - eastAvenue.w / 2, eastAvenue.x + eastAvenue.w / 2],
])

function splitByGaps(gaps: Array<[number, number]>, span = 198): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let cursor = -span
  for (const [lo, hi] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (lo > cursor) out.push([cursor, lo])
    cursor = Math.max(cursor, hi)
  }
  if (cursor < span) out.push([cursor, span])
  return out
}

/** 路缘石块：只沿车行道边缘铺，遇到横向车道就断开。 */
function Curbs({ palette }: { palette: Palette }) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.curb, roughness: 0.8, metalness: 0.15 }),
    [palette.curb],
  )
  useEffect(() => () => material.dispose(), [material])

  // 路缘只做 6cm 高：再高就在人行道边上立起一道墙，斜看又是一条凸起的线。
  const H = 0.06
  const T = 0.24
  const EDGE = T / 2

  return (
    <group>
      {/* 主街两侧（沿 z 走） */}
      {[mainStreet.x - mainStreet.w / 2 - EDGE, mainStreet.x + mainStreet.w / 2 + EDGE].map((x) =>
        SIDEWALK_Z.map(([a, b]) => (
          <mesh key={`cz-${x}-${a}`} position={[x, H / 2, (a + b) / 2]} receiveShadow material={material}>
            <boxGeometry args={[T, H, b - a]} />
          </mesh>
        )),
      )}
      {/* 三条横街两侧（沿 x 走） */}
      {[crossStreet.z - crossStreet.d / 2 - EDGE, crossStreet.z + crossStreet.d / 2 + EDGE].map((z) =>
        SIDEWALK_X.map(([a, b]) => (
          <mesh key={`cx-${z}-${a}`} position={[(a + b) / 2, H / 2, z]} receiveShadow material={material}>
            <boxGeometry args={[b - a, H, T]} />
          </mesh>
        )),
      )}
      {[southCross.z - southCross.d / 2 - EDGE, southCross.z + southCross.d / 2 + EDGE].map((z) =>
        SIDEWALK_X.map(([a, b]) => (
          <mesh key={`cs-${z}-${a}`} position={[(a + b) / 2, H / 2, z]} receiveShadow material={material}>
            <boxGeometry args={[b - a, H, T]} />
          </mesh>
        )),
      )}
      {/* 东西大道 */}
      {[westAvenue.x - westAvenue.w / 2 - EDGE, westAvenue.x + westAvenue.w / 2 + EDGE].map((x) =>
        SIDEWALK_Z.map(([a, b]) => (
          <mesh key={`cw-${x}-${a}`} position={[x, H / 2, (a + b) / 2]} receiveShadow material={material}>
            <boxGeometry args={[T, H, b - a]} />
          </mesh>
        )),
      )}
      {[eastAvenue.x - eastAvenue.w / 2 - EDGE, eastAvenue.x + eastAvenue.w / 2 + EDGE].map((x) =>
        SIDEWALK_Z.map(([a, b]) => (
          <mesh key={`ce-${x}-${a}`} position={[x, H / 2, (a + b) / 2]} receiveShadow material={material}>
            <boxGeometry args={[T, H, b - a]} />
          </mesh>
        )),
      )}
    </group>
  )
}

export function Ground() {
  const night = useApp((state) => state.night)
  const p = night ? palettes.night : palettes.dusk
  // 夜里的地面不是靠一盏灯照亮的：满城的灯、橱窗和低云把整层空气映亮，
  // 没有直射光的人行道/广场也应该看得清材质。用贴图原色做一点自发光，
  // 相当于补一层最底的环境照度，不至于把地面抬成灰板。
  const pavingGlow = night ? 0.2 : 0
  const roadGlow = night ? 0.16 : 0

  const concrete = useMemo(() => {
    const maps = sharedMaps('concrete-ground', () => makeConcreteMaps(0.9))
    // 底盘是 560m 见方，贴图要铺很多遍才有颗粒感。
    maps.normalMap.repeat.set(72, 72)
    maps.roughnessMap.repeat.set(72, 72)
    return maps
  }, [])

  // 底盘原来只有一个纯色：560m 见方的大片区没有任何颜色变化，白天看是
  // 一整张发灰的塑料纸，夜里又直接塌成黑块。补一层很细的水泥颗粒，
  // 颜色仍然由调色板决定。
  const groundTexture = useMemo(() => {
    const texture = makeAsphaltTexture(p.ground, 0.42)
    texture.repeat.set(64, 64)
    return texture
  }, [p.ground])
  useEffect(() => () => groundTexture.dispose(), [groundTexture])

  const dashes = useMemo(() => {
    const items: Array<[number, number, number, number]> = []
    for (let z = -196; z <= 196; z += 11) {
      if (z > 30 && z < 60) continue
      if (z > -108 && z < -82) continue
      items.push([0, z, 0.18, 3.4])
    }
    for (let x = -196; x <= 196; x += 10) {
      if (x > -16 && x < 16) continue
      if (x > -104 && x < -80) continue
      if (x > 80 && x < 104) continue
      items.push([x, 45, 3.4, 0.18])
    }
    for (let x = -196; x <= 196; x += 11) {
      if (x > -16 && x < 16) continue
      items.push([x, -95, 3.4, 0.16])
    }
    return items
  }, [])


  return (
    <group>
      {/* 城市底盘 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[560, 560]} />
        <meshStandardMaterial
          color="#ffffff"
          map={groundTexture}
          roughness={0.94}
          metalness={0.14}
          normalMap={concrete.normalMap}
          roughnessMap={concrete.roughnessMap}
          envMapIntensity={0.7}
          emissive={night ? p.ground : '#000000'}
          emissiveIntensity={night ? 0.3 : 0}
        />
      </mesh>

      {/* 人行道：贴在车行道两侧，不是压在路中间。
          原来这几块是整条街居中铺过去的（主街 17m 宽铺在 22m 车道上），
          于是路面上盖上一条比沥青高 5cm 的铺装带，砖缝在斜视下就是一片
          "凸起的网格线"，车轮还会陷进去 5cm。
          另外每条人行道遇到横穿的车行道都要断开，否则会在路口铺出一道坎。 */}
      {[-12.37, 12.37].map((x) =>
        SIDEWALK_Z.map(([a, b]) => (
          <PavedSurface
            key={`sw-${x}-${a}`}
            x={x}
            z={(a + b) / 2}
            w={2.26}
            d={b - a}
            tint={p.paving}
            line={p.pavingLine} glow={pavingGlow}
            y={0.032}
          />
        )),
      )}
      {[33.4, 56.6].map((z) =>
        SIDEWALK_X.map(([a, b]) => (
          <PavedSurface
            key={`swx-${z}-${a}`}
            x={(a + b) / 2}
            z={z}
            w={b - a}
            d={3}
            tint={p.paving}
            line={p.pavingLine} glow={pavingGlow}
            y={0.034}
          />
        )),
      )}
      {[-104.7, -85.3].map((z) =>
        SIDEWALK_X.map(([a, b]) => (
          <PavedSurface
            key={`sws-${z}-${a}`}
            x={(a + b) / 2}
            z={z}
            w={b - a}
            d={3.2}
            tint={p.paving}
            line={p.pavingLine} glow={pavingGlow}
            y={0.034}
          />
        )),
      )}
      {[-101.7, -82.3, 82.3, 101.7].map((x) =>
        SIDEWALK_Z.map(([a, b]) => (
          <PavedSurface
            key={`swa-${x}-${a}`}
            x={x}
            z={(a + b) / 2}
            w={3.2}
            d={b - a}
            tint={p.paving}
            line={p.pavingLine} glow={pavingGlow}
            y={0.032}
          />
        )),
      )}

      {/* 车道。夜里下过一场雨：水膜让车灯在路上拉出长条反射。 */}
      <AsphaltSurface x={mainStreet.x} z={mainStreet.z} w={mainStreet.w} d={mainStreet.d} color={night ? '#141b22' : '#3a4045'} y={0.012} wet={night} glow={roadGlow} />
      <AsphaltSurface x={crossStreet.x} z={crossStreet.z} w={crossStreet.w} d={crossStreet.d} color={night ? '#141b22' : '#3a4045'} y={0.014} wet={night} glow={roadGlow} />
      <AsphaltSurface x={southCross.x} z={southCross.z} w={southCross.w} d={southCross.d} color={night ? '#141b22' : '#3a4045'} y={0.016} wet={night} glow={roadGlow} />
      <AsphaltSurface x={westAvenue.x} z={westAvenue.z} w={westAvenue.w} d={westAvenue.d} color={night ? '#141b22' : '#3a4045'} y={0.018} wet={night} glow={roadGlow} />
      <AsphaltSurface x={eastAvenue.x} z={eastAvenue.z} w={eastAvenue.w} d={eastAvenue.d} color={night ? '#141b22' : '#3a4045'} y={0.02} wet={night} glow={roadGlow} />

      {/* 广场与巷子铺装 */}
      <PavedSurface x={plaza.x} z={plaza.z} w={plaza.w} d={plaza.d} tint={p.paving} line={p.pavingLine} glow={pavingGlow} y={0.03} />
      {/* 这几块原来横跨主街：铺装比沥青高 4~6cm，车流经过时车身会插进去，
          斜看就是一块凸起的板。一律截到车行道外沿为止。 */}
      <PavedSurface x={-19} z={-22} w={16} d={10} tint={p.paving} line={p.pavingLine} glow={pavingGlow} y={0.03} />
      <PavedSurface x={alley.x} z={alley.z} w={alley.w} d={alley.d} tint={night ? '#151e2b' : '#b6bab0'} line={p.pavingLine} glow={pavingGlow} y={0.03} />
      <PavedSurface x={13} z={alleyMouth.z} w={4} d={alleyMouth.d} tint={night ? '#151e2b' : '#b6bab0'} line={p.pavingLine} glow={pavingGlow} y={0.034} />

      {/* 喷泉外环：两圈只差 2mm，必须各自往深度空间压一次 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[plazaFountain.x, 0.034, plazaFountain.z]} receiveShadow>
        <ringGeometry args={[8.2, 9.8, 72]} />
        <meshStandardMaterial
          color={night ? '#22303f' : '#c4c8bf'}
          roughness={0.72}
          metalness={0.22}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-8}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[plazaFountain.x, 0.036, plazaFountain.z]} receiveShadow>
        <ringGeometry args={[9.8, 10.1, 72]} />
        <meshStandardMaterial
          color={night ? '#4d7f96' : '#a9aca2'}
          roughness={0.6}
          emissive={night ? '#2c6f88' : '#000000'}
          emissiveIntensity={0.9}
          polygonOffset
          polygonOffsetFactor={-6}
          polygonOffsetUnits={-12}
        />
      </mesh>

      {/* 路缘
          原来这四条是 300m 一根的长条：z=-3.9 那根正好横在主街正中间，
          就是路面上那条"突起的线"。路缘只能贴着车行道边缘、并且在路口断开。 */}
      <Curbs palette={p} />

      {/* 车道线 */}
      {dashes.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          {/* 标线用不透明画：半透明贴花要和地面做混合，一旦被别的透明层
             抢先画过就会整块变暗、看起来像线被切断了 */}
          <meshBasicMaterial color={p.roadLine} {...DECAL} />
        </mesh>
      ))}

      {/* 斑马线一律由 StreetDetail 按真实路口生成，这里不能再画一套。
          以前这里还有 11 条画在 z=31.6 / 59.4，和 StreetDetail 在 z=32.8 / 57.2
          的那一套只差 1.2m 远、2mm 高：两片贴花几乎共面，深度值谁赢取决于
          相机位置和观察角度，于是同一段斑马线一会儿整条、一会儿只剩半截，
          也就是"人物一动斑马线就被裁掉一块"。 */}

      {/* 井盖 / 地面细节 */}
      {[
        [-4.4, -10],
        [4.2, 18],
        [-3.4, 62],
        [5.1, 82],
        [22, 45],
        [-64, 20],
        [66, -40],
        [-30, -80],
        [40, 110],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.62, 20]} />
          <meshStandardMaterial
            color={night ? '#1b2532' : '#54585a'}
            roughness={0.75}
            metalness={0.4}
            polygonOffset
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-8}
          />
        </mesh>
      ))}

      {/* AR 灯带已经删掉：它是贴在路面上的一条加色亮线，在任何角度看都像
          一根浮在沥青上的发光轨，而不是路面的一部分。要发光就交给路灯和
          车流，路面本身保持干净。 */}

      {/* 灯下的光由 StreetLights 里的真实聚光灯负责，这里不再贴假光斑 */}
      {night && <GlowPool x={plazaFountain.x} z={plazaFountain.z} r={13} color="#67d8ff" opacity={0.16} />}
    </group>
  )
}

