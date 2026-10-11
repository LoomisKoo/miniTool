import { useEffect, useRef, useState } from 'react'

/** 轻量 FPS 计数（约每 400ms 刷新一次），仅用于 HUD 展示 */
export function useFps() {
  const [fps, setFps] = useState(60)
  const frames = useRef(0)
  const last = useRef(performance.now())

  useEffect(() => {
    let raf = 0
    const tick = () => {
      frames.current += 1
      const now = performance.now()
      const elapsed = now - last.current
      if (elapsed >= 400) {
        setFps(Math.round((frames.current * 1000) / elapsed))
        frames.current = 0
        last.current = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return fps
}

/** 页面存活计时，用于 HUD 的计时器 */
export function useElapsed() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
