import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useApp } from '../store'

// 帧率自适应：连续两个 1.2 秒窗口都掉到 38fps 以下才降档，
// 富余时最多升回一档，避免在临界点来回抖动。
// 自动降档的下限是 1：最低档会关掉泛光与阴影，画面跨度太大，只留给手动切换。

const WINDOW = 1.2
const FLOOR = 1

export function QualityTuner() {
  const elapsed = useRef(0)
  const frames = useRef(0)
  const cooldown = useRef(3)
  const slowWindows = useRef(0)
  const upgrades = useRef(0)

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.25)
    elapsed.current += dt
    frames.current += 1
    cooldown.current = Math.max(0, cooldown.current - dt)
    if (elapsed.current < WINDOW) return

    const fps = frames.current / elapsed.current
    elapsed.current = 0
    frames.current = 0
    if (cooldown.current > 0) return

    const { quality, setQuality } = useApp.getState()
    slowWindows.current = fps < 38 ? slowWindows.current + 1 : 0

    // 极端情况（持续 26fps 以下）才允许降到最低档。
    const floor = fps < 26 ? 0 : FLOOR
    if (slowWindows.current >= 2 && quality > floor) {
      setQuality(quality - 1)
      slowWindows.current = 0
      cooldown.current = 3
      upgrades.current = 0
    } else if (fps > 57 && quality < 2 && upgrades.current < 1) {
      setQuality(quality + 1)
      upgrades.current += 1
      cooldown.current = 8
    }
  })

  return null
}
