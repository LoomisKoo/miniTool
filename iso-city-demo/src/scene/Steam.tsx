import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 井盖冒白汽。
 *
 * 这是"纽约街道"最便宜也最有效的一层气氛：几缕白汽从井盖缓缓升起，
 * 被路灯照成暖白，整条街立刻就跟"几块平板"不一样了。
 * 用一张软边贴图的公告板实例，几十个粒子循环，一次 draw call。
 */

const SPOTS: Array<[number, number]> = [
  [-4.4, -10],
  [4.2, 18],
  [-3.4, 62],
  [5.1, 82],
  [22, 45],
  [-64, 20],
  [66, -40],
  [-30, -80],
  [40, 110],
]

const PER_SPOT = 6
const LIFE = 4.4

function puffTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.22)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 p = position.xy * length(instanceMatrix[0].xyz);
  center.xy += p;
  gl_Position = projectionMatrix * center;
}`

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 uColor;
uniform float uGain;
varying vec2 vUv;
void main() {
  float a = texture2D(map, vUv).a * uGain;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`

export function Steam({ night }: { night: boolean }) {
  const count = SPOTS.length * PER_SPOT
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        map: { value: puffTexture() },
        // 不是纯白：夜里的汽是被路灯和天光照亮的，本身没有颜色。
        // 近白 + 高增益会像贴上去的贴纸，太亮太实。
        uColor: { value: new THREE.Color('#cfc9bd') },
        uGain: { value: night ? 0.22 : 0.05 },
      },
      transparent: true,
      depthWrite: false,
    })
    const m = new THREE.InstancedMesh(geo, mat, count)
    m.frustumCulled = false
    m.renderOrder = 4
    m.userData.noGhost = true
    return m
  }, [count, night])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    },
    [mesh],
  )

  const seed = useMemo(() => Array.from({ length: count }, (_, i) => (i * 0.618) % 1), [count])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const spot = SPOTS[Math.floor(i / PER_SPOT)]
      const phase = (t / LIFE + seed[i]) % 1
      // 真实的井盖汽：升一两米就被街风带走，越往上越淡，不会窜到楼那么高。
      // 之前升到 5.7m、扩散到 2.7m，等于每个井盖冒一根烟柱。
      const rise = 0.3 + phase * 1.9
      const spread = 0.5 + phase * 1.15
      const drift = Math.sin(phase * 3.1 + i) * 0.7 * phase
      p.set(spot[0] + drift, rise, spot[1] + Math.cos(phase * 2.4 + i) * 0.65 * phase)
      s.setScalar(spread)
      m4.compose(p, q, s)
      mesh.setMatrixAt(i, m4)
    }
    mesh.instanceMatrix.needsUpdate = true
    ;(mesh.material as THREE.ShaderMaterial).uniforms.uGain.value = night ? 0.22 : 0.05
  })

  return <primitive object={mesh} />
}
