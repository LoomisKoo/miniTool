import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { launchQueue, launcher } from '../game/fireworks'

const MAX = 3000
const SPARKS = 140
const PALETTE = ['#ff5a6e', '#ffd36b', '#7fe3ff', '#b88bff', '#8dff9e', '#ffffff', '#ff9a4d']

type Spark = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; r: number; g: number; b: number }
type Shell = { x: number; y: number; z: number; vy: number; fuse: number; color: THREE.Color }

function makeGlowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

/** 楼顶发射台模型。 */
function Launcher() {
  if (!launcher) return null
  return (
    <group position={[launcher.x, launcher.y, launcher.z]}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.4, 1.6]} />
        <meshStandardMaterial color="#3a3f48" roughness={0.7} metalness={0.4} />
      </mesh>
      {[-0.4, 0, 0.4].flatMap((x) =>
        [-0.4, 0, 0.4].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.75, z]} rotation={[x * 0.3, 0, -z * 0.3]} castShadow>
            <cylinderGeometry args={[0.13, 0.15, 0.7, 10, 1, true]} />
            <meshStandardMaterial color="#b43a3a" roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        )),
      )}
      {/* 点火按钮立柱 */}
      <mesh position={[1.4, 0.55, 0]} castShadow>
        <boxGeometry args={[0.3, 1.1, 0.3]} />
        <meshStandardMaterial color="#2c3036" roughness={0.6} />
      </mesh>
      <mesh position={[1.4, 1.13, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
        <meshStandardMaterial color="#ff4d4d" emissive="#ff2a2a" emissiveIntensity={1.4} />
      </mesh>
    </group>
  )
}

export function Fireworks({ showLauncher = true }: { showLauncher?: boolean }) {
  const sparks = useRef<Spark[]>([])
  const shells = useRef<Shell[]>([])
  const flash = useRef<THREE.PointLight>(null)
  const flashLevel = useRef(0)

  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3))
    geometry.setDrawRange(0, 0)
    const material = new THREE.PointsMaterial({
      size: 0.9,
      map: makeGlowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    })
    return { geometry, material }
  }, [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.map?.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const now = performance.now() / 1000
    for (let i = launchQueue.length - 1; i >= 0; i--) {
      const l = launchQueue[i]
      if (l.at > now) continue
      launchQueue.splice(i, 1)
      shells.current.push({
        x: l.x,
        y: l.y,
        z: l.z,
        vy: 26 + Math.random() * 8,
        fuse: 1.3 + Math.random() * 0.5,
        color: new THREE.Color(PALETTE[Math.floor(Math.random() * PALETTE.length)]),
      })
    }

    const list = sparks.current
    for (let i = shells.current.length - 1; i >= 0; i--) {
      const s = shells.current[i]
      s.fuse -= dt
      s.vy -= 9.8 * dt
      s.y += s.vy * dt
      // 上升时拖一串小火星
      if (list.length < MAX) {
        list.push({ x: s.x, y: s.y, z: s.z, vx: (Math.random() - 0.5) * 0.6, vy: -1, vz: (Math.random() - 0.5) * 0.6, life: 0.5, max: 0.5, r: 1, g: 0.75, b: 0.45 })
      }
      if (s.fuse > 0) continue
      shells.current.splice(i, 1)
      const second = new THREE.Color(PALETTE[Math.floor(Math.random() * PALETTE.length)])
      for (let k = 0; k < SPARKS && list.length < MAX; k++) {
        // 均匀球面方向
        const u = Math.random() * 2 - 1
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(1 - u * u)
        const speed = 11 + Math.random() * 3
        const c = k % 3 === 0 ? second : s.color
        const max = 1.6 + Math.random() * 0.8
        list.push({ x: s.x, y: s.y, z: s.z, vx: r * Math.cos(a) * speed, vy: u * speed, vz: r * Math.sin(a) * speed, life: max, max, r: c.r, g: c.g, b: c.b })
      }
      if (flash.current) {
        flash.current.position.set(s.x, s.y, s.z)
        flash.current.color.copy(s.color)
      }
      flashLevel.current = 1
    }

    const pos = geometry.attributes.position as THREE.BufferAttribute
    const col = geometry.attributes.color as THREE.BufferAttribute
    let n = 0
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]
      p.life -= dt
      if (p.life <= 0) {
        list[i] = list[list.length - 1]
        list.pop()
        continue
      }
      const drag = Math.exp(-1.6 * dt)
      p.vx *= drag
      p.vy = p.vy * drag - 5 * dt
      p.vz *= drag
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      const k = p.life / p.max
      // 末尾闪烁
      const fade = k * k * (k < 0.3 ? 0.6 + Math.random() * 0.4 : 1)
      pos.setXYZ(n, p.x, p.y, p.z)
      col.setXYZ(n, p.r * fade * 1.6, p.g * fade * 1.6, p.b * fade * 1.6)
      n++
    }
    geometry.setDrawRange(0, n)
    pos.needsUpdate = true
    col.needsUpdate = true

    flashLevel.current = Math.max(0, flashLevel.current - dt * 2.2)
    if (flash.current) {
      // 只调亮度不切 visible：灯的数量一变，全场材质都要重新编译
      flash.current.intensity = flashLevel.current * 900
    }
  })

  return (
    <group>
      {showLauncher && <Launcher />}
      <points geometry={geometry} material={material} frustumCulled={false} renderOrder={30} />
      <pointLight ref={flash} distance={90} decay={1.6} intensity={0} />
    </group>
  )
}
