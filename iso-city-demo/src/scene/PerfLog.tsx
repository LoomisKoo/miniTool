import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 性能日志：开发环境默认开启（生产环境地址栏带 perf 才开），输出到控制台，前缀 [perf]。
 * - 每 2 秒一行汇总：帧率、平均/最差帧时间、draw call、三角形、着色器程序数
 * - 单帧超过 SPIKE_MS 时打一行卡顿明细：那一帧有没有刷阴影、远景切换了几块、相机挪了多远
 */
export const PERF_ON =
  import.meta.env.DEV || (typeof location !== 'undefined' && /perf/.test(location.search + location.hash))

console.log('[perf] PerfLog 模块已加载，开关 =', PERF_ON)

const SPIKE_MS = 40

type Marks = { shadow: number; swaps: number; swapIds: number; swapMs: number; lod: number }
const blank = (): Marks => ({ shadow: 0, swaps: 0, swapIds: 0, swapMs: 0, lod: 0 })

/** 其它组件在 useFrame 里往这里记事；PerfLog 在下一帧开头读出并清零 */
export const perfMarks: Marks = blank()

export function perfMark(key: keyof Marks, n = 1) {
  if (PERF_ON) perfMarks[key] += n
}

export function PerfLog({ counts }: { counts?: Record<string, number> }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const last = useRef(0)
  const lastCam = useRef(new THREE.Vector3())
  const win = useRef({ t0: 0, frames: 0, sum: 0, max: 0, calls: 0, tris: 0, shadow: 0, swaps: 0, spikes: 0 })

  useEffect(() => {
    if (!PERF_ON) return
    const before = gl.info.autoReset
    gl.info.autoReset = false
    console.log('[perf] 开启', counts ?? {})
    return () => {
      gl.info.autoReset = before
    }
  }, [gl, counts])

  // 负优先级：排在所有 useFrame 之前，读到的是"上一帧"完整的渲染统计和标记
  useFrame(() => {
    if (!PERF_ON) return
    const now = performance.now()
    const dt = last.current ? now - last.current : 0
    last.current = now

    const calls = gl.info.render.calls
    const tris = gl.info.render.triangles
    const m = { ...perfMarks }
    Object.assign(perfMarks, blank())
    gl.info.reset()

    const move = camera.position.distanceTo(lastCam.current)
    lastCam.current.copy(camera.position)
    if (!dt) return

    const w = win.current
    if (!w.t0) w.t0 = now
    w.frames++
    w.sum += dt
    w.max = Math.max(w.max, dt)
    w.calls = Math.max(w.calls, calls)
    w.tris = Math.max(w.tris, tris)
    w.shadow += m.shadow
    w.swaps += m.swaps

    if (dt > SPIKE_MS) {
      w.spikes++
      console.log(
        `[perf] 卡顿 ${dt.toFixed(0)}ms | calls ${calls} tris ${(tris / 1e6).toFixed(2)}M` +
          ` | 阴影刷新 ${m.shadow} | 远景切换 ${m.swaps} 块/${m.swapIds} 栋 (${m.swapMs.toFixed(1)}ms)` +
          ` | LOD扫描 ${m.lod} | 相机位移 ${move.toFixed(1)}m | programs ${gl.info.programs?.length ?? 0}`,
      )
    }

    if (now - w.t0 >= 2000) {
      const fps = (w.frames * 1000) / (now - w.t0)
      console.log(
        `[perf] fps ${fps.toFixed(0)} | 平均 ${(w.sum / w.frames).toFixed(1)}ms 最差 ${w.max.toFixed(0)}ms` +
          ` | 卡顿 ${w.spikes} 次 | 峰值 calls ${w.calls} tris ${(w.tris / 1e6).toFixed(2)}M` +
          ` | 阴影刷新 ${w.shadow} | 远景切换 ${w.swaps} | programs ${gl.info.programs?.length ?? 0}` +
          ` | 纹理 ${gl.info.memory.textures} 几何 ${gl.info.memory.geometries}`,
      )
      win.current = { t0: now, frames: 0, sum: 0, max: 0, calls: 0, tris: 0, shadow: 0, swaps: 0, spikes: 0 }
    }
  }, -1000)

  return null
}
