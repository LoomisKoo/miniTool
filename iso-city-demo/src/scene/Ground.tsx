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
} from '../data/city'
import { useApp } from '../store'
import { makeAsphaltTexture, makePavingTexture } from './textures'
import { palettes } from './theme'

/** 地面贴花（车道线、斑马线、井盖、AR 灯带、扫描网格）都用这一组深度偏移，
    否则与路面只差几毫米，远景必然 z-fighting 闪烁。 */
const DECAL = {
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -8,
} as const

/**
 * 让贴图在远处回落到平均色。
 * 摩尔纹来自"远处每个像素要采样几十次高密度砖缝"，多级纹理只能缓解；
 * 在 24m→90m 之间把贴图细节混向纯色，远景就彻底干净了，近景细节不受影响。
 */
function fadeWithDistance(material: THREE.MeshStandardMaterial, flat: string, near = 24, far = 90) {
  const color = new THREE.Color(flat)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFlat = { value: color }
    shader.uniforms.uFadeNear = { value: near }
    shader.uniforms.uFadeFar = { value: far }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uFlat;
uniform float uFadeNear;
uniform float uFadeFar;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  float viewDist = length(vViewPosition);
  diffuseColor.rgb = mix(diffuseColor.rgb, uFlat, smoothstep(uFadeNear, uFadeFar, viewDist));`,
      )
  }
  material.customProgramCacheKey = () => `fade-${near}-${far}`
  return material
}

type SurfaceProps = {
  x: number
  z: number
  w: number
  d: number
  tint: string
  line: string
  repeat: [number, number]
  y?: number
}

function PavedSurface({ x, z, w, d, tint, line, repeat, y = 0.02 }: SurfaceProps) {
  const texture = useMemo(() => {
    const tex = makePavingTexture(tint, line)
    // 一格贴图铺 9m：砖缝间距约 4.5m，远处不会糊成一片跳动的小格。
    tex.repeat.set(Math.max(1, w / 9), Math.max(1, d / 9))
    return tex
  }, [tint, line, w, d])
  const material = useMemo(
    () =>
      fadeWithDistance(
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.86, metalness: 0.12 }),
        tint,
        26,
        95,
      ),
    [texture, tint],
  )
  useEffect(() => () => material.dispose(), [material])
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
}: {
  x: number
  z: number
  w: number
  d: number
  color: string
  y?: number
}) {
  const texture = useMemo(() => {
    const tex = makeAsphaltTexture(color, 0.85)
    tex.repeat.set(Math.max(2, w / 12), Math.max(2, d / 12))
    return tex
  }, [w, d, color])
  const material = useMemo(
    () =>
      fadeWithDistance(
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.55,
          metalness: 0.35,
          color: '#ffffff',
          // 车道之间在路口会互相重叠，靠深度偏移压住同层共面
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -4,
        }),
        color,
        30,
        110,
      ),
    [texture, color],
  )
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.055, z]}>
      <planeGeometry args={[r * 2, r * 2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export function Ground() {
  const night = useApp((state) => state.night)
  const p = night ? palettes.night : palettes.dusk

  const dashes = useMemo(() => {
    const items: Array<[number, number, number, number]> = []
    for (let z = -146; z <= 146; z += 11) {
      if (z > 30 && z < 60) continue
      if (z > -108 && z < -82) continue
      items.push([0, z, 0.18, 3.4])
    }
    for (let x = -146; x <= 146; x += 10) {
      if (x > -16 && x < 16) continue
      if (x > -104 && x < -80) continue
      if (x > 80 && x < 104) continue
      items.push([x, 45, 3.4, 0.18])
    }
    for (let x = -146; x <= 146; x += 11) {
      if (x > -16 && x < 16) continue
      items.push([x, -95, 3.4, 0.16])
    }
    return items
  }, [])

  const lampsGlow = useMemo(
    () => [
      [-12.8, -54],
      [-12.8, -8],
      [-12.8, 62],
      [12.8, -30],
      [12.8, 24],
      [12.8, 92],
      [-30, 25],
      [-44, -25],
      [30, 40],
      [-56, 40],
      [56, 40],
      [-100, 8],
      [100, 8],
    ],
    [],
  )

  return (
    <group>
      {/* 城市底盘 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[560, 560]} />
        <meshStandardMaterial color={p.ground} roughness={0.9} metalness={0.18} />
      </mesh>

      {/* 人行道 */}
      <PavedSurface x={0} z={0} w={17} d={300} tint={p.paving} line={p.pavingLine} repeat={[7, 110]} y={0.05} />
      <PavedSurface x={0} z={45} w={300} d={15} tint={p.paving} line={p.pavingLine} repeat={[110, 7]} y={0.052} />
      <PavedSurface x={0} z={-95} w={300} d={12} tint={p.paving} line={p.pavingLine} repeat={[110, 6]} y={0.052} />
      <PavedSurface x={-92} z={0} w={12} d={300} tint={p.paving} line={p.pavingLine} repeat={[6, 110]} y={0.051} />
      <PavedSurface x={92} z={0} w={12} d={300} tint={p.paving} line={p.pavingLine} repeat={[6, 110]} y={0.051} />

      {/* 车道 */}
      <AsphaltSurface x={mainStreet.x} z={mainStreet.z} w={mainStreet.w} d={mainStreet.d} color={night ? '#0b1119' : '#3a4045'} y={0.012} />
      <AsphaltSurface x={crossStreet.x} z={crossStreet.z} w={crossStreet.w} d={crossStreet.d} color={night ? '#0b1119' : '#3a4045'} y={0.014} />
      <AsphaltSurface x={southCross.x} z={southCross.z} w={southCross.w} d={southCross.d} color={night ? '#0b1119' : '#3a4045'} y={0.016} />
      <AsphaltSurface x={westAvenue.x} z={westAvenue.z} w={westAvenue.w} d={westAvenue.d} color={night ? '#0b1119' : '#3a4045'} y={0.018} />
      <AsphaltSurface x={eastAvenue.x} z={eastAvenue.z} w={eastAvenue.w} d={eastAvenue.d} color={night ? '#0b1119' : '#3a4045'} y={0.02} />

      {/* 广场与巷子铺装 */}
      <PavedSurface x={plaza.x} z={plaza.z} w={plaza.w} d={plaza.d} tint={p.paving} line={p.pavingLine} repeat={[10, 14]} y={0.06} />
      <PavedSurface x={2} z={-22} w={20} d={10} tint={p.paving} line={p.pavingLine} repeat={[5, 3]} y={0.062} />
      <PavedSurface x={alley.x} z={alley.z} w={alley.w} d={alley.d} tint={night ? '#151e2b' : '#b6bab0'} line={p.pavingLine} repeat={[4, 12]} y={0.064} />
      <PavedSurface x={alleyMouth.x} z={alleyMouth.z} w={alleyMouth.w} d={alleyMouth.d} tint={night ? '#151e2b' : '#b6bab0'} line={p.pavingLine} repeat={[3, 3]} y={0.066} />

      {/* 喷泉外环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[plazaFountain.x, 0.08, plazaFountain.z]} receiveShadow>
        <ringGeometry args={[8.2, 9.8, 72]} />
        <meshStandardMaterial color={night ? '#22303f' : '#c4c8bf'} roughness={0.72} metalness={0.22} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[plazaFountain.x, 0.082, plazaFountain.z]} receiveShadow>
        <ringGeometry args={[9.8, 10.1, 72]} />
        <meshStandardMaterial color={night ? '#4d7f96' : '#a9aca2'} roughness={0.6} emissive={night ? '#2c6f88' : '#000000'} emissiveIntensity={0.9} />
      </mesh>

      {/* 路缘 */}
      {[-13.4, 13.4].map((x) => (
        <mesh key={`mz-${x}`} position={[x, 0.1, 0]} receiveShadow>
          <boxGeometry args={[0.8, 0.2, 300]} />
          <meshStandardMaterial color={p.curb} roughness={0.8} metalness={0.15} />
        </mesh>
      ))}
      {[-3.9, 55.4].map((z) => (
        <mesh key={`mx-${z}`} position={[0, 0.1, z]} receiveShadow>
          <boxGeometry args={[300, 0.2, 0.8]} />
          <meshStandardMaterial color={p.curb} roughness={0.8} metalness={0.15} />
        </mesh>
      ))}

      {/* 车道线 */}
      {dashes.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.085, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color={p.roadLine} transparent opacity={0.5} depthWrite={false} {...DECAL} />
        </mesh>
      ))}

      {/* 斑马线 */}
      {[31.6, 59.4].map((z) =>
        Array.from({ length: 11 }).map((_, i) => (
          <mesh key={`${z}-${i}`} position={[-10 + i * 2, 0.088, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.1, 3.6]} />
            <meshBasicMaterial color={night ? '#93a6bb' : '#eee7d6'} transparent opacity={0.55} depthWrite={false} {...DECAL} />
          </mesh>
        )),
      )}

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
        <mesh key={i} position={[x, 0.092, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.62, 20]} />
          <meshStandardMaterial color={night ? '#1b2532' : '#54585a'} roughness={0.75} metalness={0.4} />
        </mesh>
      ))}

      {/* 主街 AR 灯带：夜里给街道一条清晰的发光边缘 */}
      {night && (
        <>
          {[-10.4, 10.4].map((x) => (
            <mesh key={`ar-${x}`} position={[x, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.16, 292]} />
              <meshBasicMaterial color="#4fd6ff" transparent opacity={0.72} toneMapped={false} depthWrite={false} {...DECAL} />
            </mesh>
          ))}
          {[32.6, 57.4].map((z) => (
            <mesh key={`arx-${z}`} position={[0, 0.1, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[292, 0.16]} />
              <meshBasicMaterial color="#4fd6ff" transparent opacity={0.5} toneMapped={false} depthWrite={false} {...DECAL} />
            </mesh>
          ))}
        </>
      )}

      {/* 灯下光池 */}
      {night &&
        lampsGlow.map(([x, z], i) => (
          <GlowPool key={i} x={x + 0.9} z={z} r={4.6} color="#ffca8f" opacity={0.3} />
        ))}
      {night && <GlowPool x={plazaFountain.x} z={plazaFountain.z} r={13} color="#67d8ff" opacity={0.16} />}

      {/* AR 扫描网格：只在夜间，铺在整片街区上 */}
      {night && <ArGrid />}
    </group>
  )
}

function ArGrid() {
  const texture = useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(110, 226, 255, 0.5)'
    ctx.lineWidth = 1.2
    for (let i = 0; i <= size; i += 64) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, size)
      ctx.moveTo(0, i)
      ctx.lineTo(size, i)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(110, 226, 255, 0.14)'
    for (let i = 0; i <= size; i += 32) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, size)
      ctx.moveTo(0, i)
      ctx.lineTo(size, i)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(5, 5)
    tex.colorSpace = THREE.SRGBColorSpace
    // 远距离 1px 细线必然摩尔纹，靠 mipmap + 各向异性压住。
    tex.anisotropy = 4
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    return tex
  }, [])

  return (
    // 网格原来和广场铺装同高（0.06），共面必然整片闪；抬到人行道之上并加深
    // 度偏移，同时压暗透明度，夜间只当作很淡的街道质感。
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.108, 0]} userData={{ noMerge: true }}>
      <planeGeometry args={[300, 300]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#4fc2e4"
        {...DECAL}
      />
    </mesh>
  )
}
