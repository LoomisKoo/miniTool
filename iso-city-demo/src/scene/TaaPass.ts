import * as THREE from 'three'
import { Pass } from 'postprocessing'

/**
 * 时间抗锯齿（TAA）。
 *
 * 场景里的锯齿大头不是多边形边缘，而是**着色器画出来的细线**：立面的窗格模数、
 * 楼层线、砖缝、远处楼的窗点。这些东西只有 1~2 个像素宽，而且是在片元里算出来的
 * 内部图案——MSAA（multisampling）只抗几何图元边缘，对它们一点用没有；
 * SMAA 又只处理对比度超过阈值的边缘，8% 的楼层线它根本看不见。
 *
 * TAA 换一个思路：不试图把某一帧画干净，而是每帧把相机投影挪动不到一个像素
 * （Halton 抖动），再用深度缓冲把上一帧重投影到当前视角上混合。静止的几何在
 * 屏幕上扫过的采样点因此比单帧多得多，次像素的细线会被"时间上的超采样"抹平。
 * 代价只是一趟全屏混合 + 一趟全屏拷贝。
 *
 * 关键实现点：
 *  - 抖动写进 camera.setViewOffset：投影矩阵和它的逆矩阵一起变，
 *    重建世界坐标、重投影都用同一套抖动过的矩阵，静止几何的重投影是精确的；
 *  - 混合前做 3x3 邻域裁剪（variance clipping）：行人和车挡住的历史值会被夹回
 *    当前颜色附近，不会拖出长长的残影；
 *  - 天空（depth == 1）单独用「方向」重投影（w = 0，不参与平移），因此也能
 *    累积历史。以前整片天空直接丢弃历史，而星空又是 shader 逐像素算出来的
 *    高频图案：相机每帧抖动半个像素，星星的 fwidth 就跟着变，于是静止时
 *    星星也一直在闪。天空按无穷远处理之后，时间和空间采样一起收敛；
 *  - 重投影出屏的像素抛弃历史；
 *  - 传送、切场景、重新进入城市时调用 reset()，历史帧作废一次。
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`

const FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tHistory;
uniform mat4 uInvViewProj;
uniform mat4 uPrevViewProj;
uniform vec3 uCameraPos;
uniform vec2 uTexel;
/** 当前帧的权重：0 = 完全用历史（最干净、最容易拖影） */
uniform float uBlend;
/** 1 = 丢弃历史（切场景 / 帧尺寸变化后的第一帧） */
uniform float uReset;

varying vec2 vUv;

void main() {
  vec3 cur = texture2D(tColor, vUv).rgb;

  // 由深度重建世界坐标，再投影回上一帧的屏幕位置
  float d = texture2D(tDepth, vUv).x;
  vec4 clip = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 wp = uInvViewProj * clip;
  vec3 world = wp.xyz / wp.w;

  // 天空在 depth == 1，用深度重建出来的是远裁剪面上的点，平移项会带进视差误差。
  // 天空本来就是无穷远，用方向（w = 0）投影回上一帧才是精确的；
  // 这样星星、月亮也能吃历史帧，不再每帧换一个亚像素采样就闪一次。
  float sky = step(0.999999, d);
  vec4 pc = sky > 0.5
    ? uPrevViewProj * vec4(world - uCameraPos, 0.0)
    : uPrevViewProj * vec4(world, 1.0);
  vec2 prevUv = pc.xy / pc.w * 0.5 + 0.5;

  // 3x3 邻域：历史值必须落在当前帧这一小块的颜色范围里，否则夹回去。
  // 这一步是残影和抗锯齿之间的平衡点，没有运动矢量时靠它兜底。
  vec3 mn = cur;
  vec3 mx = cur;
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec3 c = texture2D(tColor, vUv + vec2(float(i), float(j)) * uTexel).rgb;
      mn = min(mn, c);
      mx = max(mx, c);
    }
  }

  vec3 hist = texture2D(tHistory, prevUv).rgb;
  hist = clamp(hist, mn, mx);

  // 出屏 / 被要求重置时不接受历史
  vec2 over = step(vec2(0.5), abs(prevUv - 0.5));
  float outside = max(over.x, over.y);
  float use = (1.0 - uReset) * (1.0 - outside);

  gl_FragColor = vec4(mix(cur, mix(hist, cur, uBlend), use), 1.0);
}
`

const COPY_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tDiffuse, vUv);
}
`

/** 全屏三角形（不用 postprocessing 里那个 @internal 的静态几何，避免依赖内部 API） */
const FULLSCREEN = (() => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  )
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2))
  return geometry
})()

/** Halton(2,3) 的 16 帧抖动序列，单位是像素、范围 (-0.5, 0.5) */
export const JITTER: Array<[number, number]> = (() => {
  const halton = (i: number, b: number) => {
    let f = 1 / b
    let r = 0
    let n = i
    while (n > 0) {
      r += f * (n % b)
      f /= b
      n = Math.floor(n / b)
    }
    return r
  }
  return Array.from(
    { length: 16 },
    (_, k) => [halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5] as [number, number],
  )
})()

export class TaaPass extends Pass {
  /** 场景相机。每帧由外部刷新，换相机时不用重建 pass。 */
  sceneCamera: THREE.PerspectiveCamera

  private material: THREE.ShaderMaterial
  private copyMaterial: THREE.ShaderMaterial
  private copyScene = new THREE.Scene()
  private history: THREE.WebGLRenderTarget | null = null
  private depthTexture: THREE.Texture | null = null
  private viewProj = new THREE.Matrix4()
  private prevViewProj = new THREE.Matrix4()
  private invViewProj = new THREE.Matrix4()
  private ready = false
  private needsReset = true
  private disposed = false

  constructor(camera: THREE.PerspectiveCamera) {
    super('TaaPass')
    this.sceneCamera = camera
    this.needsSwap = true
    // 让 EffectComposer 把 RenderPass 之后的稳定深度纹理交过来
    this.needsDepthTexture = true

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        tHistory: { value: null },
        uInvViewProj: { value: new THREE.Matrix4() },
        uPrevViewProj: { value: new THREE.Matrix4() },
        uCameraPos: { value: new THREE.Vector3() },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uBlend: { value: 0.12 },
        uReset: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    })
    this.fullscreenMaterial = this.material

    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: VERT,
      fragmentShader: COPY_FRAG,
      depthTest: false,
      depthWrite: false,
    })
    const quad = new THREE.Mesh(FULLSCREEN, this.copyMaterial)
    quad.frustumCulled = false
    this.copyScene.add(quad)
  }

  /** 历史帧作废一次：切场景、传送、渲染停帧后恢复都该调。 */
  reset() {
    this.needsReset = true
  }

  override setDepthTexture(depthTexture: THREE.Texture) {
    this.depthTexture = depthTexture
    this.needsReset = true
  }

  override setSize(width: number, height: number) {
    this.history?.dispose()
    // 必须和 composer 的输入缓冲同类型（R3F 默认 HalfFloat），
    // 否则混合时会被量化到 8bit，暗部出现色带
    this.history = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    })
    this.history.texture.name = 'TaaPass.History'
    this.material.uniforms.uTexel.value.set(1 / width, 1 / height)
    this.needsReset = true
    this.ready = false
  }

  override render(
    renderer: THREE.WebGLRenderer,
    inputBuffer: THREE.WebGLRenderTarget,
    outputBuffer: THREE.WebGLRenderTarget,
  ) {
    const history = this.history
    if (!history) return

    const camera = this.sceneCamera
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.invViewProj.copy(this.viewProj).invert()

    const u = this.material.uniforms
    u.tColor.value = inputBuffer.texture
    u.tDepth.value = this.depthTexture
    u.tHistory.value = history.texture
    u.uInvViewProj.value.copy(this.invViewProj)
    u.uPrevViewProj.value.copy(this.ready ? this.prevViewProj : this.viewProj)
    u.uCameraPos.value.copy(camera.position)
    u.uReset.value = this.needsReset || !this.ready ? 1 : 0

    renderer.setRenderTarget(outputBuffer)
    renderer.render(this.scene, this.camera)

    // 把这一帧（混合后的结果）存成下一帧的历史
    this.copyMaterial.uniforms.tDiffuse.value = outputBuffer.texture
    renderer.setRenderTarget(history)
    renderer.render(this.copyScene, this.camera)
    renderer.setRenderTarget(null)

    this.prevViewProj.copy(this.viewProj)
    this.ready = true
    this.needsReset = false
  }

  override dispose() {
    // 组件卸载时 R3F 也会调一次 dispose，两遍会把 render target 重复还给
    // 渲染器，这里自己兜住幂等
    if (this.disposed) return
    this.disposed = true
    // depthTexture 属于 composer，不能跟着我们一起 dispose
    this.depthTexture = null
    super.dispose()
  }
}
