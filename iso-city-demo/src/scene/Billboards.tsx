import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildings, type BuildingDef } from '../data/city'
import { isUnitBuilding } from '../data/units'
import { useApp } from '../store'
import { seeded } from './theme'

/**
 * 楼面上的 LED 广告屏。
 *
 * 真实的城市夜景里，大部分"颜色"来自广告屏和招牌，而不是楼体本身。
 * 所有屏幕是一个 InstancedMesh，画面在着色器里按实例种子程序化生成
 * （色块、滚动字条、渐变、闪烁），一次 draw call。
 */

type Side = 'north' | 'south' | 'east' | 'west'
type Screen = { x: number; y: number; z: number; w: number; h: number; yaw: number; seed: number }

const NORMAL: Record<Side, [number, number]> = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }
const YAW: Record<Side, number> = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }

function bodyOf(def: BuildingDef) {
  // 与 Building.tsx 的体量一致：手写退台楼的塔身是 0.86，背景高楼下段是满宽
  if (def.background) return { w: def.w, d: def.d, top: def.setback && def.h > 44 ? def.h * 0.76 : def.h }
  return { w: def.setback ? def.w * 0.86 : def.w, d: def.setback ? def.d * 0.86 : def.d, top: def.h }
}

function screensOf(def: BuildingDef): Screen[] {
  if (isUnitBuilding(def.id) || def.h < 16 || def.balconies) return []
  const rnd = seeded(def.id + '-led')
  if (rnd() > (def.h > 40 ? 0.5 : 0.22)) return []
  const body = bodyOf(def)
  const main = (def.entranceSide || def.facing || 'south') as Side
  const sides: Side[] = [main]
  // 高楼转角再挂一块
  if (def.h > 40 && rnd() > 0.5) sides.push(main === 'south' || main === 'north' ? (rnd() > 0.5 ? 'east' : 'west') : rnd() > 0.5 ? 'north' : 'south')
  const out: Screen[] = []
  for (const side of sides) {
    const [nx, nz] = NORMAL[side]
    const face = side === 'east' || side === 'west' ? body.d : body.w
    const vertical = rnd() > 0.55
    const w = vertical ? Math.min(face * 0.32, 6 + rnd() * 3) : Math.min(face * 0.66, 9 + rnd() * 8)
    const h = vertical ? Math.min(w * (2 + rnd()), body.top - 10) : w * (0.42 + rnd() * 0.2)
    if (h < 3) continue
    const yMin = 7 + h / 2
    const yMax = body.top - 3 - h / 2
    if (yMax < yMin) continue
    const y = yMin + (yMax - yMin) * (vertical ? 0.5 : rnd() * 0.6)
    const along = (rnd() - 0.5) * Math.max(0, face - w - 2) * 0.8
    const out0 = (side === 'east' || side === 'west' ? body.w : body.d) / 2 + 0.25
    out.push({
      x: def.x + nx * out0 + (nz !== 0 ? along : 0),
      z: def.z + nz * out0 + (nx !== 0 ? along : 0),
      y,
      w,
      h,
      yaw: YAW[side],
      seed: rnd() * 100,
    })
  }
  return out
}

const VERT = /* glsl */ `
attribute float aSeed;
attribute vec2 aSize;
varying vec2 vUv;
varying float vSeed;
varying vec2 vSize;
void main() {
  vUv = uv;
  vSeed = aSeed;
  vSize = aSize;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uGain;
varying vec2 vUv;
varying float vSeed;
varying vec2 vSize;
float h1(float n) { return fract(sin(n) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 pal(float t) {
  // 真实街面上大多是暖白背景的品牌灯箱，只有少数是彩色屏。
  // 一整面墙的品红/青/柠檬黄是赛博朋克，不是城市。
  vec3 warm = vec3(1.0, 0.9, 0.76);
  vec3 cool = vec3(0.72, 0.84, 0.95);
  vec3 accent = vec3(1.0, 0.62, 0.5);
  float pick = fract(t * 3.7);
  vec3 base = pick < 0.55 ? warm : (pick < 0.82 ? cool : accent);
  return mix(base, vec3(0.95), 0.25);
}
void main() {
  vec2 uv = vUv;
  float s = vSeed;
  // 每 8 秒换一张"广告"
  float slot = floor(uTime / 8.0 + h1(s) * 8.0);
  float k = h1(s * 7.0 + slot * 1.37);
  vec3 a = pal(k);
  vec3 b = pal(k + 0.35 + h1(s + slot) * 0.3);
  vec3 col = mix(a, b, smoothstep(0.0, 1.0, uv.y + 0.25 * sin(uv.x * 3.0 + uTime * 0.6 + s)));
  // 主视觉：一个大色块/产品剪影
  vec2 c = uv - vec2(0.3 + 0.4 * h1(slot + s), 0.55);
  c.x *= vSize.x / vSize.y;
  float blob = smoothstep(0.32, 0.28, length(c));
  col = mix(col, vec3(1.0) - a * 0.6, blob * 0.7);
  // 标题与滚动字条：一行行亮条，像远看的大字
  float rows = step(0.08, uv.y) * step(uv.y, 0.28);
  float glyph = step(0.45, h2(vec2(floor((uv.x + uTime * 0.05) * vSize.x * 1.4), floor(uv.y * 10.0) + slot)));
  col = mix(col, vec3(1.0), rows * glyph * 0.85);
  float title = step(0.78, uv.y) * step(uv.y, 0.9) * step(0.08, uv.x) * step(uv.x, 0.08 + 0.5 * h1(s + slot * 3.0));
  col = mix(col, vec3(1.0), title * 0.9);
  // 像素栅格 + 扫描线：近看才有 LED 屏的颗粒感
  vec2 px = fract(uv * vSize * 6.0);
  float grid = smoothstep(0.0, 0.18, px.x) * smoothstep(0.0, 0.18, px.y);
  col *= mix(0.75, 1.0, grid);
  // 换屏时闪一下
  float t8 = fract(uTime / 8.0 + h1(s) * 8.0);
  col *= 1.0 + 1.5 * smoothstep(0.03, 0.0, t8);
  // 黑色边框
  float edge = step(0.02, uv.x) * step(uv.x, 0.98) * step(0.03, uv.y) * step(uv.y, 0.97);
  col *= edge;
  gl_FragColor = vec4(col * uGain, 1.0);
}`

export function Billboards() {
  const night = useApp((state) => state.night)
  const screens = useMemo(() => buildings.flatMap(screensOf), [])

  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(screens.map((s) => s.seed)), 1))
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(screens.flatMap((s) => [s.w, s.h])), 2))
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 }, uGain: { value: 1 } },
      toneMapped: false,
    })
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, screens.length))
    const mtx = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    screens.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw)
      m.setMatrixAt(i, mtx.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.w, s.h, 1)))
    })
    m.count = screens.length
    m.userData.noGhost = true
    return m
  }, [screens])

  // 屏幕背后的金属框
  const frames = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshStandardMaterial({ color: '#1a1b1d', roughness: 0.6, metalness: 0.5 })
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, screens.length))
    const mtx = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const back = new THREE.Vector3()
    screens.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw)
      back.set(0, 0, -0.14).applyQuaternion(q)
      m.setMatrixAt(i, mtx.compose(new THREE.Vector3(s.x + back.x, s.y, s.z + back.z), q, new THREE.Vector3(s.w + 0.3, s.h + 0.3, 0.26)))
    })
    m.count = screens.length
    m.castShadow = true
    return m
  }, [screens])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      frames.geometry.dispose()
      ;(frames.material as THREE.Material).dispose()
    },
    [mesh, frames],
  )

  useFrame((state) => {
    const mat = mesh.material as THREE.ShaderMaterial
    mat.uniforms.uTime.value = state.clock.elapsedTime
    // 白天屏幕也亮，但亮度只有夜里的一半左右，泛光阈值以下
    // 广告屏是"亮"，不是"刺眼"：过曝会让立面糊成一片白
    mat.uniforms.uGain.value = night ? 0.85 : 0.5
  })

  return (
    <group userData={{ dynamic: true }}>
      <primitive object={frames} />
      <primitive object={mesh} />
    </group>
  )
}
