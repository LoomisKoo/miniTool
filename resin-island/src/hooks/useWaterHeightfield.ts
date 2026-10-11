import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneParams } from '../context/ParamsContext'
import { createBlankHeightTexture, type WaterUniforms } from '../materials/waterMaterial'
import { ISLAND_UV, ISLAND_UV_RADIUS } from '../config/scene'

const SIM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const SIM_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uState;
  uniform vec2 uTexel;
  uniform float uDamping;
  uniform float uSpeed;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  uniform float uRippleRadius;
  varying vec2 vUv;

  void main() {
    vec2 t = uTexel;
    vec4 s = texture2D(uState, vUv);
    float h = s.r;
    float hPrev = s.g;

    float l = texture2D(uState, vUv - vec2(t.x, 0.0)).r;
    float r = texture2D(uState, vUv + vec2(t.x, 0.0)).r;
    float d = texture2D(uState, vUv - vec2(0.0, t.y)).r;
    float u = texture2D(uState, vUv + vec2(0.0, t.y)).r;

    float laplacian = (l + r + d + u) - 4.0 * h;
    float velocity = (h - hPrev) * uDamping;
    float next = h + velocity + uSpeed * laplacian;

    // 空闲时的微弱自然波动（两个缓慢游走的正弦叠加，避免死水）
    next += sin(vUv.x * 27.0 + uTime * 1.15) * sin(vUv.y * 23.0 - uTime * 0.95) * 0.00045;
    next += sin((vUv.x + vUv.y) * 16.0 + uTime * 0.7) * 0.00025;

    // 鼠标涟漪：高斯脉冲注入
    float dist = distance(vUv, uMouse);
    next += exp(-pow(dist / uRippleRadius, 2.0)) * uMouseStrength * 0.065;

    gl_FragColor = vec4(next, h, 0.0, 1.0);
  }
`

interface Options {
  /** 高度场分辨率（方格边长） */
  resolution: number
  /** 与水面材质共享的 uniform（hook 每帧写入最新高度场） */
  uniforms: WaterUniforms
  paramsRef: RefObject<SceneParams>
}

/**
 * GPU 高度场：ping-pong FBO 上跑二维波动方程。
 * 状态纹理 R = 当前高度，G = 上一帧高度（leapfrog 积分）。
 * 返回 setPointer(u,v) 供水面在指针划过的 uv 处注入涟漪。
 */
export function useWaterHeightfield({ resolution, uniforms, paramsRef }: Options) {
  const gl = useThree((s) => s.gl)

  const targets = useMemo(() => {
    const opts: THREE.RenderTargetOptions = {
      depthBuffer: false,
      stencilBuffer: false,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
    }
    return {
      a: new THREE.WebGLRenderTarget(resolution, resolution, opts),
      b: new THREE.WebGLRenderTarget(resolution, resolution, opts),
    }
  }, [resolution])

  const sim = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: targets.a.texture },
        uTexel: { value: new THREE.Vector2(1 / resolution, 1 / resolution) },
        uDamping: { value: 0.986 },
        uSpeed: { value: 0.24 },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uMouseStrength: { value: 0 },
        uRippleRadius: { value: 0.055 },
      },
      vertexShader: SIM_VERT,
      fragmentShader: SIM_FRAG,
      depthTest: false,
      depthWrite: false,
    })
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    scene.add(quad)
    return { material, scene, camera, quad }
  }, [resolution, targets])

  const state = useRef({ read: targets.a, write: targets.b })
  const pointer = useRef({ u: 0.5, v: 0.5, strength: 0 })

  useEffect(() => {
    state.current.read = targets.a
    state.current.write = targets.b

    const prev = gl.getRenderTarget()
    gl.setRenderTarget(targets.a)
    gl.clear()
    gl.setRenderTarget(targets.b)
    gl.clear()
    gl.setRenderTarget(prev)

    return () => {
      targets.a.dispose()
      targets.b.dispose()
    }
  }, [gl, targets])

  useEffect(() => {
    const blank = createBlankHeightTexture()
    uniforms.uHeight.value = blank
    uniforms.uIslandCenter.value.set(ISLAND_UV[0], ISLAND_UV[1])
    uniforms.uIslandRadius.value = ISLAND_UV_RADIUS
    return () => blank.dispose()
  }, [uniforms])

  useEffect(
    () => () => {
      sim.material.dispose()
      sim.quad.geometry.dispose()
      sim.scene.remove(sim.quad)
    },
    [sim],
  )

  const setPointer = useCallback((u: number, v: number) => {
    pointer.current.u = u
    pointer.current.v = v
    pointer.current.strength = 1
  }, [])

  useFrame((_, rawDelta) => {
    const p = paramsRef.current
    const s = state.current
    const dt = Math.min(rawDelta, 1 / 30)
    const mat = sim.material

    mat.uniforms.uState.value = s.read.texture
    mat.uniforms.uTime.value += dt
    ;(mat.uniforms.uTexel.value as THREE.Vector2).set(1 / resolution, 1 / resolution)

    pointer.current.strength *= Math.exp(-dt * 5.5)
    ;(mat.uniforms.uMouse.value as THREE.Vector2).set(pointer.current.u, pointer.current.v)
    mat.uniforms.uMouseStrength.value = pointer.current.strength * p.surface.rippleStrength

    gl.setRenderTarget(s.write)
    gl.render(sim.scene, sim.camera)
    gl.setRenderTarget(null)

    const tmp = s.read
    s.read = s.write
    s.write = tmp

    // 发布最新高度场给水面材质
    uniforms.uHeight.value = s.read.texture
    uniforms.uTime.value += dt
    uniforms.uTexel.value.set(1 / resolution, 1 / resolution)
    uniforms.uWaveHeight.value = p.surface.waveHeight
    uniforms.uFoam.value = p.surface.foam
    uniforms.uDeepColor.value.set(p.water.deepColor)
    uniforms.uShallowColor.value.set(p.water.shallowColor)
  })

  return { setPointer }
}
