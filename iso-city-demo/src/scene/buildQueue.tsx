import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 把「整座城的挂载」摊到多帧里。
 *
 * 以前所有组件的首次渲染落在同一个 commit 里：几十栋楼、外立面细节、街具、
 * 行人、车流、远景塔楼一起生成几何和材质，一帧就是 1.9 秒。片头（欢迎页）
 * 上看到的那次"卡一下"就是它——和点击入城无关，因为进片头时整座城已经
 * 在挂了。
 *
 * 这里给每个分组一个"入场券"：每帧只放行一组。单帧的工作量降到几十毫秒，
 * 中间还能正常出帧，观感从"停两秒"变成"城市在一秒里逐渐长出来"。
 * 顺序按组件树的挂载顺序，所以楼体先立起来、细节和行人在后。
 *
 * 放行之后先不显示：新的材质一旦被绘制，就要在**那一帧里同步编译着色器**、
 * 还要同步上传贴图，一组就是上千毫秒的硬停。所以分组先以 visible=false
 * 挂进场景，用 compileAsync 交驱动后台编译、再用 initTexture 逐帧上传贴图，
 * 两样都备好才显示，显示那一帧没有额外工作。
 *
 * 注意 compileAsync 只管 program，不管贴图：漏掉 initTexture 的话，
 * 显示那一刻仍然要把几十张图同步传上去（日志里 +textures=64 对应 800ms）。
 *
 * 合批（StaticMerge）要等队列清空才能开始收集，否则会漏掉还在排队的组。
 */

const waiting: Array<() => void> = []
let pumping = false
/** 已经登记但还没放行的分组数 */
let pending = 0
/** 已放行但还在编程序/传贴图、尚未显示的分组数 */
let warming = 0

/**
 * 只编译这一组的材质。
 *
 * compile(object, camera, targetScene)：材质只从 object 里收集，
 * 灯光和 environment 从 targetScene 取——编出来的变体和正式渲染时一致。
 * 传整个 scene 会把全城 2000 多个网格每组都遍历一遍，分组越多越慢。
 */
function compileGroup(
  gl: THREE.WebGLRenderer,
  group: THREE.Object3D,
  scene: THREE.Scene,
  camera: THREE.Camera,
): Promise<void> {
  return gl
    .compileAsync(group, camera, scene)
    .catch(() => undefined)
    .then(() => undefined)
}

/**
 * 每帧放行几组。
 *
 * 构建总时长 = 帧数 × 每帧耗时，而每帧不管放行几组都要把整座城渲染一遍
 * （合批前两千多个网格 + 阴影 + 后处理，本身就要几十毫秒）。
 * 一帧一组时 61 组 = 61 帧 × 72ms = 4.3s，大部分花在重复渲染上。
 * 一帧放 4 组，帧数降到 1/4，单帧多出的只是挂载和提交编译。
 */
const GROUPS_PER_FRAME = 4

function pump() {
  if (pumping || waiting.length === 0) return
  pumping = true
  requestAnimationFrame(() => {
    pumping = false
    for (let i = 0; i < GROUPS_PER_FRAME && waiting.length > 0; i++) waiting.shift()?.()
    if (waiting.length === 0 && pending === 0) {
      // 队列清空：剩下的只是各组自己在等编译 / 传贴图
    } else {
      pump()
    }
  })
}

/** 场景是否已经全部挂完并显示（合批、预热的前置条件）。 */
export function buildQueueIdle() {
  return pending === 0 && waiting.length === 0 && warming === 0
}

export function Stagger({ name, children }: { name: string; children: ReactNode }) {
  // hidden → warming（编程序 + 传贴图）→ shown
  const [phase, setPhase] = useState<'hidden' | 'warming' | 'shown'>('hidden')
  const node = useRef<THREE.Group>(null)
  const queue = useRef<THREE.Texture[]>([])
  const cursor = useRef(0)
  const released = useRef(false)
  const settled = useRef(false)
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    let done = false
    pending += 1
    const release = () => {
      if (done) return
      done = true
      pending -= 1
      warming += 1
      released.current = true
      setPhase('warming')
    }
    waiting.push(release)
    pump()
    return () => {
      // StrictMode 会挂载→卸载→再挂载；第二次如果没有清理，
      // 队列里会留下死条目，组的放行顺序就会整体往后错。
      if (!done) {
        done = true
        pending -= 1
        const i = waiting.indexOf(release)
        if (i >= 0) waiting.splice(i, 1)
      }
      // 已经放行但还没显示就被卸载了：把计数还回去，
      // 否则 buildQueueIdle 永远为假，合批会一直等下去。
      if (released.current && !settled.current) {
        settled.current = true
        warming -= 1
      }
    }
  }, [])

  // 第一段：编着色器。compile() 用 traverse 收集材质、不看 visible，
  // 所以隐藏的组也会被编到。
  useEffect(() => {
    if (phase !== 'warming') return
    let alive = true
    const group = node.current
    void (group ? compileGroup(gl, group, scene, camera) : Promise.resolve())
      .then(() => {
        if (!alive) return
        // 编完把这一组的贴图排进上传队列，交给下面的逐帧上传
        queue.current = node.current ? texturesOf(node.current) : []
        cursor.current = 0
        if (queue.current.length === 0) finish()
        else setPhase('warming')
      })
    return () => {
      alive = false
    }
  }, [phase, gl, scene, camera])

  // 第二段：逐帧上传贴图。每张图都要走一次 GPU 上传，几十张堆在一帧
  // 就是几百毫秒；摊成每帧 4 张，单帧只剩几毫秒。
  useFrame(() => {
    if (phase !== 'warming' || queue.current.length === 0) return
    const end = Math.min(queue.current.length, cursor.current + TEXTURES_PER_STEP)
    for (let i = cursor.current; i < end; i++) {
      gl.initTexture(queue.current[i])
      warmed.add(queue.current[i])
    }
    cursor.current = end
    if (cursor.current >= queue.current.length) finish()
  })

  function finish() {
    if (settled.current) return
    settled.current = true
    warming -= 1
    queue.current = []
    setPhase('shown')
  }

  if (phase === 'hidden') return null
  return (
    <group ref={node} visible={phase === 'shown'}>
      {children}
    </group>
  )
}

/** 每帧上传几张。实测 1k 贴图一张约 12ms，4 张会超过一帧预算，压到 2 张。 */
const TEXTURES_PER_STEP = 2

/** 已经上传过的贴图。预热阶段据此跳过，避免把同一批图再传一遍。 */
const warmed = new WeakSet<THREE.Texture>()

export function alreadyUploaded(texture: THREE.Texture) {
  return warmed.has(texture)
}

const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'lightMap',
  'specularMap',
  'envMap',
  'transmissionMap',
] as const

function texturesOf(root: THREE.Object3D): THREE.Texture[] {
  const seen = new Set<THREE.Texture>()
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.material) return
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of list) {
      for (const slot of TEXTURE_SLOTS) {
        const tex = (material as unknown as Record<string, THREE.Texture | null>)[slot]
        if (tex && tex.isTexture) seen.add(tex)
      }
    }
  })
  return [...seen]
}
