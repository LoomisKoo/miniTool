import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * 临时性能读数（`?perf=1` 打开，只在 dev 生效）。
 *
 * 优化的第一步是分清瓶颈在哪一类开销：
 *   - fps / 每帧墙钟：含 JS、提交和 GPU 等待
 *   - 峰值：偶发长帧（材质重编译、贴图上传）会在这里露出来
 *   - calls / tris：这一帧实际提交的 draw call 与三角形数
 *   - prog：编译出的着色器变体数，异常增长说明材质在反复重建
 *
 * 直接写 DOM 而不是走 React state：这里每半秒才更新一次，但走 state
 * 等于给被观察者加负担，读数就不准了。
 */
export function PerfMonitor() {
  const gl = useThree((state) => state.gl)
  const box = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = document.createElement('div')
    el.style.cssText = [
      'position:fixed',
      'left:10px',
      'bottom:10px',
      'z-index:9999',
      'padding:6px 8px',
      'border-radius:6px',
      'background:rgba(8,12,18,.72)',
      'color:#9fe8c8',
      'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
      'white-space:pre',
      'pointer-events:none',
      'letter-spacing:.02em',
    ].join(';')
    el.textContent = 'perf…'
    document.body.appendChild(el)
    box.current = el
    return () => el.remove()
  }, [])

  const stat = useRef({ frames: 0, time: 0, worst: 0 })

  useFrame((_, rawDelta) => {
    const s = stat.current
    const dt = Math.min(rawDelta, 1)
    s.frames += 1
    s.time += dt
    s.worst = Math.max(s.worst, dt)
    if (s.time < 0.5) return

    const el = box.current
    const fps = s.frames / s.time
    const info = gl.info
    if (el) {
      el.textContent = [
        `${fps.toFixed(0)} fps   ${((s.time / s.frames) * 1000).toFixed(1)}ms   峰值 ${(s.worst * 1000).toFixed(0)}ms`,
        `calls ${info.render.calls}   tris ${(info.render.triangles / 1000).toFixed(0)}k`,
        `geo ${info.memory.geometries}   tex ${info.memory.textures}   prog ${info.programs?.length ?? 0}`,
      ].join('\n')
    }
    s.frames = 0
    s.time = 0
    s.worst = 0
  })

  return null
}
