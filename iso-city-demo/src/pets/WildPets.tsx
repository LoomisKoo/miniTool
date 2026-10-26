// 城市里的野生宠物：一次 draw call 画完所有宠物。
//
// 做法是「一个网格装 N 个四边形」。每帧在 CPU 上算 12 只宠物的位置与朝向，
// 再把四个角的顶点坐标写进去（48 个顶点，成本可以忽略）。之所以不用
// InstancedMesh：每只宠物需要自己的调色板行和帧号，手写 quad 的属性数组
// 比给 instanceMatrix 打补丁更直白，而且同样只有一次 draw call。

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PET_FRAMES } from '../catalog/rasterize'
import { SIZE_SCALE } from '../catalog/recipes'
import { useApp } from '../store'
import { walker } from '../game/walker'
import { flinch, petHeading, petPose } from './roam'
import { currentBucket, wildPool, type WildPet } from './wild'
import { buildRuntimeAtlas } from './atlas-runtime'
const EPOCH = Date.UTC(2026, 0, 1)
const SPRITE_H = 0.62
/** 脚底在格子里的行位置（与 rasterize.ts 的 GROUND 一致） */
const GROUND = 0.38
/** 让「格子里的脚底线」正好落在世界 y=0 上 */
const GROUND_OFFSET = -(1 - GROUND)

const VERT = /* glsl */ `
attribute float aCell;
attribute float aRow;
attribute float aAlpha;
varying vec2 vUv;
varying float vCell;
varying float vRow;
varying float vAlpha;

void main() {
  vUv = uv;
  vCell = aCell;
  vRow = aRow;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
uniform sampler2D uIndex;
uniform sampler2D uPalette;
uniform float uCellUv;
uniform float uCols;
uniform float uRows;
uniform float uBright;
varying vec2 vUv;
varying float vCell;
varying float vRow;
varying float vAlpha;

void main() {
  // 图集的 v=0 是格子顶行，所以要把四边形的纵向 uv 翻过来
  vec2 cuv = vec2(vUv.x, 1.0 - vUv.y);
  float cx = mod(vCell, uCols);
  float cy = floor(vCell / uCols);
  vec2 auv = (vec2(cx, cy) + cuv) * uCellUv;

  float b = texture2D(uIndex, auv).r * 255.0;
  if (b < 0.5) discard;

  float v = b - 1.0;
  float slot = mod(v, 16.0);
  float shade = floor(v / 16.0);
  float k = 0.55 + shade * 0.064;
  vec3 c = texture2D(uPalette, vec2((slot + 0.5) / 8.0, (vRow + 0.5) / uRows)).rgb;

  gl_FragColor = vec4(c * k * uBright, vAlpha);
}
`

function cornerBuffer(count: number) {
  const position = new Float32Array(count * 4 * 3)
  const uv = new Float32Array(count * 4 * 2)
  const aCell = new Float32Array(count * 4)
  const aRow = new Float32Array(count * 4)
  const aAlpha = new Float32Array(count * 4)
  const index = new Uint16Array(count * 6)

  for (let i = 0; i < count; i++) {
    const v = i * 4
    uv.set([0, 0, 1, 0, 1, 1, 0, 1], v * 2)
    index.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6)
    aAlpha.fill(1, v, v + 4)
  }

  const dynamic = {
    position: new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage),
    aCell: new THREE.BufferAttribute(aCell, 1).setUsage(THREE.DynamicDrawUsage),
    aAlpha: new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage),
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', dynamic.position)
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setAttribute('aCell', dynamic.aCell)
  geo.setAttribute('aRow', new THREE.BufferAttribute(aRow, 1))
  geo.setAttribute('aAlpha', dynamic.aAlpha)
  geo.setIndex(new THREE.BufferAttribute(index, 1))
  return geo
}

function shadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.26)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function WildPets() {
  const night = useApp((state) => state.night)
  const [bucket, setBucket] = useState(() => currentBucket())

  // 每半小时检查一次是否跨过整点：跨了就整批换新
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = currentBucket()
      setBucket((prev) => (next === prev ? prev : next))
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const pets = useMemo<WildPet[]>(() => wildPool(bucket), [bucket])

  const atlas = useMemo(() => {
    const built = buildRuntimeAtlas(
      pets.map((p) => p.recipe),
      pets.map((p) => p.palette as string[]),
    )
    return built
  }, [pets])
  useEffect(() => () => atlas.dispose(), [atlas])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uIndex: { value: atlas.index },
          uPalette: { value: atlas.palette },
          uCellUv: { value: atlas.cellUv },
          uCols: { value: atlas.cols },
          uRows: { value: atlas.rows },
          uBright: { value: 1 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: true,
      }),
    [atlas],
  )
  useEffect(() => () => material.dispose(), [material])

  const geometry = useMemo(() => {
    const geo = cornerBuffer(pets.length)
    // 每只宠物在图集里占连续 8 格，调色板行号 = 它在池里的序号
    const row = geo.getAttribute('aRow') as THREE.BufferAttribute
    for (let i = 0; i < pets.length; i++) row.array.fill(i, i * 4, i * 4 + 4)
    row.needsUpdate = true
    return geo
  }, [pets.length])
  useEffect(() => () => geometry.dispose(), [geometry])

  const shadowGeo = useMemo(() => cornerBuffer(pets.length), [pets.length])
  useEffect(() => () => shadowGeo.dispose(), [shadowGeo])

  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: shadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      }),
    [],
  )
  useEffect(
    () => () => {
      shadowMaterial.map?.dispose()
      shadowMaterial.dispose()
    },
    [shadowMaterial],
  )

  const meshRef = useRef<THREE.Mesh>(null)
  const shadowRef = useRef<THREE.Mesh>(null)

  const right = useRef(new THREE.Vector3())
  const corners = useRef(new Float32Array(pets.length * 4 * 3))
  useFrame((state) => {
    const geom = meshRef.current?.geometry
    const shGeo = shadowRef.current?.geometry
    if (!geom || !shGeo) return

    const cam = state.camera
    const e = cam.matrixWorld.elements
    // 只取水平分量：宠物始终直立，不会随镜头俯仰而倾斜
    right.current.set(e[0], 0, e[2])
    if (right.current.lengthSq() < 1e-6) right.current.set(1, 0, 0)
    right.current.normalize()
    const rx = right.current.x
    const rz = right.current.z

    // 固定纪元：不能对 86400 取模，否则每天零点整批宠物会瞬移一次
    const t = (Date.now() - EPOCH) / 1000
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute
    const cellAttr = geom.getAttribute('aCell') as THREE.BufferAttribute
    const alphaAttr = geom.getAttribute('aAlpha') as THREE.BufferAttribute
    const pos = posAttr.array as Float32Array
    const cell = cellAttr.array as Float32Array
    const alpha = alphaAttr.array as Float32Array

    const shPos = shGeo.getAttribute('position') as THREE.BufferAttribute
    const shAlpha = shGeo.getAttribute('aAlpha') as THREE.BufferAttribute
    const sp = shPos.array as Float32Array
    const sa = shAlpha.array as Float32Array

    for (let i = 0; i < pets.length; i++) {
      const pet = pets[i]
      const scale = SIZE_SCALE[pet.recipe.size]
      const pose = petPose(pet.id, pet.spot, t, 0.9)
      const away = flinch(pose, walker.position)
      const heading = petHeading(pet.id, pet.spot, t, 0.9)

      const x = away.x
      const z = away.z
      const h = SPRITE_H * scale
      const w = h

      // 朝左朝右：用「运动方向在相机右向量上的投影」判断，比记录世界 x 更准
      const facing = heading.x * rx + heading.z * rz >= 0 ? 1 : -1

      // 帧：走 / 坐 / 睡。被人靠近时定格，看起来像在观察你
      const gate = Math.sin(t * 0.18 + i * 2.1)
      let frame: number
      if (away.shy > 0.05) frame = 6
      else if (gate > 0.62) frame = 7
      else if (gate > 0.1) frame = 4 + (Math.floor(t * 7) % 2)
      else frame = Math.floor(t * 3.2) % 4

      const camDist = Math.hypot(x - cam.position.x, z - cam.position.z)
      const fade = camDist > 44 ? Math.max(0, 1 - (camDist - 44) / 26) : 1

      const yOff = GROUND_OFFSET * h
      const bx = x - rx * (w * 0.5) * facing
      const bz = z - rz * (w * 0.5) * facing
      const tx = x + rx * (w * 0.5) * facing
      const tz = z + rz * (w * 0.5) * facing

      const v = i * 12
      // 左下 / 右下 / 右上 / 左上
      pos[v] = bx
      pos[v + 1] = yOff
      pos[v + 2] = bz
      pos[v + 3] = tx
      pos[v + 4] = yOff
      pos[v + 5] = tz
      pos[v + 6] = tx
      pos[v + 7] = yOff + h
      pos[v + 8] = tz
      pos[v + 9] = bx
      pos[v + 10] = yOff + h
      pos[v + 11] = bz

      const c = i * PET_FRAMES + (frame % PET_FRAMES)
      cell[i * 4] = c
      cell[i * 4 + 1] = c
      cell[i * 4 + 2] = c
      cell[i * 4 + 3] = c

      alpha.fill(fade, i * 4, i * 4 + 4)

      // 贴地暗斑
      const sw = 0.52 * scale
      const sv = i * 12
      sp[sv] = x - sw
      sp[sv + 1] = 0.032
      sp[sv + 2] = z - sw
      sp[sv + 3] = x + sw
      sp[sv + 4] = 0.032
      sp[sv + 5] = z - sw
      sp[sv + 6] = x + sw
      sp[sv + 7] = 0.032
      sp[sv + 8] = z + sw
      sp[sv + 9] = x - sw
      sp[sv + 10] = 0.032
      sp[sv + 11] = z + sw
      sa.fill(fade, i * 4, i * 4 + 4)
    }

    posAttr.needsUpdate = true
    cellAttr.needsUpdate = true
    alphaAttr.needsUpdate = true
    shPos.needsUpdate = true
    shAlpha.needsUpdate = true

    material.uniforms.uBright.value = night ? 0.82 : 1
    // 位置每帧在变，包围球是旧的，不能让 three 拿它做剔除
    if (meshRef.current) meshRef.current.frustumCulled = false
    if (shadowRef.current) shadowRef.current.frustumCulled = false
  })

  return (
    <group userData={{ dynamic: true }}>
      <mesh ref={shadowRef} geometry={shadowGeo} material={shadowMaterial} renderOrder={1} />
      <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={2} />
    </group>
  )
}
