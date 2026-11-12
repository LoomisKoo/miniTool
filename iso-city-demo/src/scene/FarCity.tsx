import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PERF_ON, perfMark } from './PerfLog'
import type { BuildingDef } from '../data/city'
import { bodyColor, palettes, seeded } from './theme'
import { STYLIZED } from './style'
import { facadeStyleParams } from './facade'
import {
  ROOF_COLORS_DAY,
  ROOF_COLORS_NIGHT,
  facadeInset,
  hipRoofGeometry,
  isPitched,
  prismGeometry,
  roofOverhang,
} from './mass'

/**
 * 远景合批（HLOD）：把背景楼按 96m 分块，每块合成一个"体量 + 程序化窗格"的网格。
 *
 * 每栋背景楼的立面材质都是独立的（墙色、跨度、种子各不相同），不能静态合并，
 * 一栋楼至少一次 draw call；城市扩大到几百栋后，转视角时 CPU 光提交就超一帧。
 * 远处的楼只需要剪影、墙色和亮窗，这里一块一次 draw call，近处再换回真楼。
 *
 * 关键：远景壳子必须和真楼长得一样，否则换过去那一帧整栋楼会"变一个人"。
 * 所以切角量、开窗网格（inset / 模数 / 楼层高 / 起始高度 / 山墙）全部从
 * InfillBuilding 用的那套函数里取，壳子只是少了砖缝、窗洞深度这些像素级细节：
 *  - 轮廓：同一个 massOutline 的切角八边形，不再是一个方盒子；
 *  - 窗格：和 facade shader 完全相同的 pad / 模数 / 楼层线，换过去窗是原地不动的；
 *  - 剪影：檐口、压顶、女儿墙、坡屋顶都补上；水塔、屋顶机组由 RoofProps 全城常亮绘制，这里不用管。
 *
 * 真楼的根节点带 userData.hlod = 楼 id，由本组件按分块切换可见性。
 */

const CHUNK = 96
/** 进入这个距离换回真楼；离开 FAR_OUT 再换成远景块，中间留滞回避免来回闪。
 *  放在 190m：真楼立面着色器在 80~260m 之间把窗框、砖缝、窗洞深度逐级收掉，
 *  到 190m 时它已经接近色块，和远景壳子的差别最小。 */
const FAR_IN = 190
const FAR_OUT = 215

export function farEligible(def: BuildingDef) {
  return Boolean(def.background) && def.form !== 'billboard'
}

function tiersOf(def: BuildingDef) {
  if (def.form === 'deco') {
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
  if (!def.form && def.setback && def.h > 44) {
    const cut = def.h * 0.76
    return [
      { y0: 0, y1: cut, w: def.w, d: def.d },
      { y0: cut, y1: def.h, w: def.w * 0.8, d: def.d * 0.8 },
    ]
  }
  return [{ y0: 0, y1: def.h, w: def.w, d: def.d }]
}

/** 和 InfillBuilding 完全一致的切角量 */
function baseChamfer(def: BuildingDef) {
  return def.form === 'walkup' || def.form === 'estate' || def.form === 'rowhouse' || def.form === 'warehouse'
    ? 0.4
    : Math.min(Math.min(def.w, def.d) * 0.07, 2.6)
}

type Attrs = {
  /** (seed, 窗列模数 cw, 楼层高, 首层窗起点绝对高度) */
  a: [number, number, number, number]
  /** (inset, 沿 x 面的跨度, 沿 z 面的跨度, 窗宽占比) */
  b: [number, number, number, number]
  /** (窗台, 窗顶, 该段顶面绝对高度, 山墙掩码 0/1 x 面/2 z 面) */
  c: [number, number, number, number]
  /** (风格 kind, 亮灯率, 构件标记, 临街朝向编码) */
  d: [number, number, number, number]
}

const TRIM_ATTRS: Attrs = {
  a: [0, 1, 1, 0],
  b: [0, 1, 1, 0],
  c: [0, 1, 0, 0],
  d: [0, 0, 1, 0],
}

function stamp(geo: THREE.BufferGeometry, color: THREE.Color, at: Attrs) {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  const n = g.attributes.position.count
  const cols = new Float32Array(n * 3)
  const a0 = new Float32Array(n * 4)
  const a1 = new Float32Array(n * 4)
  const a2 = new Float32Array(n * 4)
  const a3 = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    cols[i * 3] = color.r
    cols[i * 3 + 1] = color.g
    cols[i * 3 + 2] = color.b
    a0.set(at.a, i * 4)
    a1.set(at.b, i * 4)
    a2.set(at.c, i * 4)
    a3.set(at.d, i * 4)
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  g.setAttribute('aFar0', new THREE.BufferAttribute(a0, 4))
  g.setAttribute('aFar1', new THREE.BufferAttribute(a1, 4))
  g.setAttribute('aFar2', new THREE.BufferAttribute(a2, 4))
  g.setAttribute('aFar3', new THREE.BufferAttribute(a3, 4))
  return g
}

const FACING_CODE: Record<string, number> = { south: 1, north: 2, east: 3, west: 4 }

function buildChunk(defs: BuildingDef[], night: boolean) {
  const palette = night ? palettes.night : palettes.dusk
  const lightsOn = palette.key === 'night'
  const wallColor = new THREE.Color()
  const trimColor = new THREE.Color(palette.trim)
  // 和 Building.tsx 的 RoofDeck / Parapet 同色，远近切换时屋顶不跳色。
  // 真楼屋面乘了一张均值约 0.84 的颗粒贴图，这里把同样的系数乘进顶点色。
  const deckColor = new THREE.Color(night ? (STYLIZED ? '#5f5e68' : '#46484f') : '#9a9a91').multiplyScalar(0.84)
  const parapetColor = new THREE.Color(night ? (STYLIZED ? '#6c6b74' : '#55565e') : palette.trim)
  const roofColors = (night ? ROOF_COLORS_NIGHT : ROOF_COLORS_DAY).map(
    (c) => new THREE.Color(night ? (STYLIZED ? c : '#3b4256') : STYLIZED ? c : '#67708a'),
  )
  const parts: THREE.BufferGeometry[] = []

  for (const def of defs) {
    wallColor.copy(bodyColor(def.body, palette))
    const seed = seeded(def.id + '-facade')()
    const st = facadeStyleParams(def.style)
    const cw = st.winW + st.gap
    const base = def.form === 'rowhouse' ? 0 : def.style === 'glass' ? 4.2 : 3.4
    const blankMask =
      seeded(def.id + '-gable')() >
      (def.form === 'walkup' || def.form === 'estate' || def.form === 'rowhouse' || def.form === 'warehouse' ? 0.15 : 0.45)
        ? (def.facing === 'east' || def.facing === 'west' ? 2 : 1) : 0
    const shop = seeded(def.id + '-shop')() > 0.05 ? FACING_CODE[def.facing ?? 'south'] : 0
    const chamfer = baseChamfer(def)
    const tiers = tiersOf(def)
    const top = tiers[tiers.length - 1]

    for (const t of tiers) {
      const h = t.y1 - t.y0
      if (h <= 0.2) continue
      const c = Math.min(chamfer, Math.min(t.w, t.d) * 0.4)
      const inset = facadeInset(t.w, t.d, c)
      const wallAttrs: Attrs = {
        a: [seed * 37.19, cw, st.floorH, base],
        b: [inset, t.d, t.w, st.winW / cw],
        c: [st.sill, Math.min(0.95, st.sill + st.winH / st.floorH), t.y1, blankMask],
        d: [st.kind, lightsOn ? st.litRatio * (STYLIZED ? 0.55 : 0.7) : 0.02, 0, shop],
      }

      // 体量：和真楼同一个轮廓（切角 + 圆角），只是不做倒角。
      // 四边各收 2cm：真楼挂载后要等下一次节点扫描才会被隐藏，
      // 这半秒里两套体量同时在场，完全共面就会闪成斑马纹。
      const body = prismGeometry(t.w - 0.04, t.d - 0.04, h - 0.04, c)
      body.translate(def.x, t.y0, def.z)
      parts.push(stamp(body, wallColor, wallAttrs))

      // 檐口：真楼在段顶下面 0.85m 挑出一圈，远景少了它剪影是一条直边
      const cornice = new THREE.BoxGeometry(t.w + 0.5, 0.42, t.d + 0.5)
      cornice.translate(def.x, t.y0 + h - 0.72, def.z)
      parts.push(stamp(cornice, trimColor, TRIM_ATTRS))

      // 压顶：真楼顶上有这道边沿，缺了会矮一截。
      // 坡屋顶的小楼只有压顶、没有女儿墙——女儿墙会从坡屋面里戳出来。
      const pitched = isPitched(def) && t === top
      const cap = prismGeometry(t.w + 0.2, t.d + 0.2, 0.18, c)
      cap.translate(def.x, t.y0 + h - 0.09, def.z)
      parts.push(stamp(cap, trimColor, TRIM_ATTRS))
      if (!pitched) {
        // 女儿墙必须是四道墙围一圈，和真楼的 Parapet 一样。以前是一整块实心板，
        // 等于把屋面盖住、顶面抬高 0.9m：换过去时屋顶颜色、受光、设备露出的高度全变。
        const T = 0.26
        const PH = 0.9
        for (const [px, pz, pw, pd] of [
          [0, (t.d + T) / 2, t.w + T * 2, T],
          [0, -(t.d + T) / 2, t.w + T * 2, T],
          [(t.w + T) / 2, 0, T, t.d],
          [-(t.w + T) / 2, 0, T, t.d],
        ]) {
          const wall = new THREE.BoxGeometry(pw, PH, pd)
          wall.translate(def.x + px, t.y0 + h + PH / 2, def.z + pz)
          parts.push(stamp(wall, parapetColor, TRIM_ATTRS))
        }
      }
    }

    // 屋面：坡屋顶的小楼如果换成平的，俯视时整片街区都变样
    if (isPitched(def)) {
      const roof = hipRoofGeometry(top.w, top.d, ...roofOverhang(def))
      roof.translate(def.x, top.y1 + 0.05, def.z)
      const k = def.form === 'rowhouse' ? Math.floor(seeded(def.id + '-roof')() * 16) % 4 : 0
      parts.push(stamp(roof, roofColors[k], TRIM_ATTRS))
    } else {
      // 顶面落在 +0.22，和真楼 RoofDeck 同高同尺寸
      const deck = new THREE.BoxGeometry(Math.max(0.5, top.w - 0.25), 0.1, Math.max(0.5, top.d - 0.25))
      deck.translate(def.x, top.y1 + 0.17, def.z)
      parts.push(stamp(deck, deckColor, TRIM_ATTRS))
    }
  }

  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  merged.computeBoundingSphere()
  return merged
}

function farMaterial(night: boolean) {
  const palette = night ? palettes.night : palettes.dusk
  // 用 Standard 而不是 Lambert：真楼的立面是 MeshStandardMaterial，
  // 两种光照模型在高光/环境反射上的差别，在 150m 处换过去也很明显。
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.04,
    envMapIntensity: 1.05,
  })
  const uniforms = {
    uLitWarm: { value: new THREE.Color(palette.windowLit[0]) },
    uLitCool: { value: new THREE.Color(palette.windowLit[2]) },
    uGlass: { value: new THREE.Color(palette.windowDark) },
    uCurtain: { value: new THREE.Color(palette.glass) },
    uNight: { value: palette.key === 'night' ? 1 : 0 },
  }
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aFar0;
attribute vec4 aFar1;
attribute vec4 aFar2;
attribute vec4 aFar3;
varying vec3 vFarPos;
varying vec3 vFarNrm;
varying vec4 vFar0;
varying vec4 vFar1;
varying vec4 vFar2;
varying vec4 vFar3;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vFarPos = position;
vFarNrm = normal;
vFar0 = aFar0;
vFar1 = aFar1;
vFar2 = aFar2;
vFar3 = aFar3;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFarPos;
varying vec3 vFarNrm;
varying vec4 vFar0;
varying vec4 vFar1;
varying vec4 vFar2;
varying vec4 vFar3;
uniform vec3 uLitWarm;
uniform vec3 uLitCool;
uniform vec3 uGlass;
uniform vec3 uCurtain;
uniform float uNight;
float farHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 farEm = vec3( 0.0 );
{
  // 和 facade.ts 的窗格排布一模一样，只是没有窗洞凹凸和砖缝
  bool xFace = abs( vFarNrm.x ) > abs( vFarNrm.z );
  float vertical = step( abs( vFarNrm.y ), 0.5 ) * step( min( abs( vFarNrm.x ), abs( vFarNrm.z ) ), 0.16 );
  float span = xFace ? vFar1.y : vFar1.z;
  float along = ( xFace ? vFarPos.z : vFarPos.x ) + span * 0.5;
  float cw = max( vFar0.y, 0.35 );
  float usable = max( 0.35, span - vFar1.x * 2.0 );
  float cols = max( 1.0, floor( usable / cw ) );
  float pad = vFar1.x + ( usable - cols * cw ) * 0.5;
  float uu = ( along - pad ) / cw;
  float cell = floor( uu );
  float fx = fract( uu );
  float fv = ( vFarPos.y - vFar0.w ) / max( vFar0.z, 0.5 );
  float row = floor( fv );
  float fy = fract( fv );
  // 窗格逐像素采样：远处一格不到两像素时就会走样，按 fwidth 软化边缘
  float eh = max( fwidth( uu ), 0.0015 ) * 1.3;
  float ev = max( fwidth( fv ), 0.0015 ) * 1.3;

  float wx = vFar1.w;
  float l = ( 1.0 - wx ) * 0.5;
  float r = 1.0 - l;
  float bot = vFar2.x;
  float top = vFar2.y;
  float ok = step( 0.0, row ) * step( vFar0.w, vFarPos.y ) * step( vFarPos.y, vFar2.z - 1.05 );
  // 山墙：1 = x 面没窗，2 = z 面没窗
  float blank = xFace
    ? step( 0.5, vFar2.w ) * ( 1.0 - step( 1.5, vFar2.w ) )
    : step( 1.5, vFar2.w );
  // vFar3.z = 1 的是檐口/女儿墙/屋面这些构件，不排窗
  float open = ok * ( 1.0 - blank ) * vertical * ( 1.0 - vFar3.z );

  float mx = smoothstep( l - eh, l + eh, fx ) * ( 1.0 - smoothstep( r - eh, r + eh, fx ) );
  float my = smoothstep( bot - ev, bot + ev, fy ) * ( 1.0 - smoothstep( top - ev, top + ev, fy ) );
  float win = mx * my * open;

  float depthV = clamp( ( fy - bot ) / max( top - bot, 0.001 ), 0.0, 1.0 );
  vec3 glassCol = ( vFar3.x > 2.5 ? uCurtain : uGlass ) * ( 0.78 + 0.42 * depthV );

  float seed = vFar0.x;
  float litPick = farHash( vec2( cell * 1.7 + 3.0, row * 2.3 + 1.0 ) + seed * 2.0 );
  float homePick = farHash( vec2( floor( cell / 3.0 ) * 4.1 + 2.0, row * 1.7 ) + seed );
  litPick = mix( homePick, litPick, 0.3 );
  float floorBusy = mix( 0.25, 1.75, farHash( vec2( row * 0.73, seed * 0.11 ) ) );
  float isLit = step( litPick, vFar3.y * floorBusy ) * uNight;
  vec3 litCol = mix( uLitWarm, uLitCool, step( 0.92, farHash( vec2( row * 3.1, cell * 0.7 ) + seed * 5.0 ) ) );
  vec3 winCol = mix( glassCol, litCol, isLit );

  // 窗洞侧壁的明暗：上沿与左侧压暗、下沿反射提亮
  float dl = clamp( ( fx - l ) / max( wx, 0.001 ), 0.0, 1.0 );
  float dt = clamp( ( top - fy ) / max( top - bot, 0.001 ), 0.0, 1.0 );
  float db = 1.0 - dt;
  winCol *= mix( 0.5, 1.0, smoothstep( 0.0, 0.2, dt ) ) * mix( 0.66, 1.0, smoothstep( 0.0, 0.26, dl ) );
  winCol *= mix( 1.0, 1.14, 1.0 - smoothstep( 0.0, 0.18, db ) );

  // 墙面上下渐变 + 楼脚接触暗 + 街谷反弹光：近景的 wallCol 也是这三样，
  // 少了它们远景会是一块没有体积感的平板
  vec3 wallCol = diffuseColor.rgb;
  float rise = smoothstep( vFar0.w, max( vFar2.z, vFar0.w + 1.0 ), vFarPos.y );
  wallCol *= mix( 0.86, 1.08, rise ) * mix( 0.78, 1.0, smoothstep( 0.0, 2.5, vFarPos.y ) );
  float canyon = ( 1.0 - smoothstep( 18.0, 62.0, vFarPos.y - vFar0.w ) ) * 0.25;
  wallCol = wallCol * ( 1.0 + canyon * 0.34 ) + vec3( 0.115, 0.079, 0.046 ) * canyon;
  diffuseColor.rgb = mix( mix( diffuseColor.rgb, wallCol, 1.0 - vFar3.z ), winCol, win );
  // 亮窗走自发光，和真楼的 uLitGain 对齐（远处 detail→0，增益衰减到 0.4 档）
  farEm += litCol * isLit * win * 0.38;
  farEm += vec3( 0.03, 0.03, 0.034 ) * uNight * win * ( 1.0 - isLit );

  // 首层店面：只有临街那一面亮，和近景的 ShopFrontage 一致
  float shopCode = vFar3.w;
  if ( shopCode > 0.5 ) {
    float code = shopCode - 1.0;
    vec3 fd = code < 0.5 ? vec3( 0.0, 0.0, 1.0 )
      : code < 1.5 ? vec3( 0.0, 0.0, -1.0 )
      : code < 2.5 ? vec3( 1.0, 0.0, 0.0 )
      : vec3( -1.0, 0.0, 0.0 );
    float front = step( 0.6, dot( normalize( vFarNrm ), fd ) );
    float band = step( 0.5, vFarPos.y ) * step( vFarPos.y, 3.2 );
    float inSpan = step( vFar1.x, along ) * step( along, span - vFar1.x );
    farEm += vec3( 1.0, 0.72, 0.45 ) * front * band * inSpan * uNight * 0.5;
  }

  // 水平面（屋顶）压暗一档：真楼的屋面本来就不是墙色
  if ( abs( vFarNrm.y ) > 0.5 ) diffuseColor.rgb *= mix( 1.0, 0.86, 1.0 - vFar3.z );
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += farEm;`,
      )
  }
  m.customProgramCacheKey = () => `far-city-v2-${night ? 1 : 0}`
  return m
}

type Chunk = { key: string; ids: string[]; box: THREE.Box3; mesh: THREE.Mesh; far: boolean }

export function FarCity({ defs, night }: { defs: BuildingDef[]; night: boolean }) {
  const scene = useThree((state) => state.scene)
  const material = useMemo(() => farMaterial(night), [night])
  const chunks = useMemo(() => {
    const groups = new Map<string, BuildingDef[]>()
    for (const def of defs) {
      if (!farEligible(def)) continue
      const key = `${Math.floor(def.x / CHUNK)}_${Math.floor(def.z / CHUNK)}`
      const list = groups.get(key) ?? []
      list.push(def)
      groups.set(key, list)
    }
    const out: Chunk[] = []
    for (const [key, list] of groups) {
      const geo = buildChunk(list, night)
      geo.computeBoundingBox()
      const mesh = new THREE.Mesh(geo, material)
      // 不投影：一块 96m 的合成体量进阴影 pass，等于把整片远景再画一遍，
      // 而远景楼在阴影图里的贡献只是地面上一片本来就看不见的灰。
      // 近处的真楼仍然投影，所以城区里的影子不会少。
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.userData.noMerge = true
      mesh.visible = false
      out.push({ key, ids: list.map((d) => d.id), box: geo.boundingBox!.clone(), mesh, far: false })
    }
    return out
  }, [defs, night, material])

  useEffect(
    () => () => {
      chunks.forEach((c) => c.mesh.geometry.dispose())
      material.dispose()
    },
    [chunks, material],
  )

  const nodes = useRef(new Map<string, THREE.Object3D>())
  const frame = useRef(0)
  const point = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    frame.current += 1
    if (frame.current % 30 === 1) {
      const next = new Map<string, THREE.Object3D>()
      scene.traverse((o) => {
        if (o.userData.hlod) next.set(o.userData.hlod as string, o)
      })
      nodes.current = next
      // 新挂载的真楼要立刻套用所在块的状态
      for (const c of chunks) for (const id of c.ids) {
        const n = next.get(id)
        if (n) n.visible = !c.far
      }
    }
    if (frame.current % 5 !== 0) return
    const t0 = PERF_ON ? performance.now() : 0
    for (const c of chunks) {
      c.box.clampPoint(camera.position, point)
      const d = point.distanceTo(camera.position)
      const far = c.far ? d > FAR_IN : d > FAR_OUT
      if (far === c.far) continue
      c.far = far
      c.mesh.visible = far
      perfMark('swaps')
      perfMark('swapIds', c.ids.length)
      for (const id of c.ids) {
        const n = nodes.current.get(id)
        if (n) n.visible = !far
      }
    }
    if (PERF_ON) perfMark('swapMs', performance.now() - t0)
  })

  return (
    <group userData={{ dynamic: true }}>
      {chunks.map((c) => (
        <primitive key={c.key} object={c.mesh} />
      ))}
    </group>
  )
}
