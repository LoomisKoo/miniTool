import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useApp } from '../store'
import { walker } from '../game/walker'
// 帧率自适应：连续两个 1.2 秒窗口都掉到 38fps 以下才降档，
// 富余时最多升回一档，避免在临界点来回抖动。
//
// 档位只影响后处理的采样数（AO 采样、denoise、halfRes）和 Bloom 强度，
// 不再改 dpr / resolutionScale / 阴影贴图：那三项一变就要重建 canvas、
// 整个 EffectComposer 或阴影深度图，档位跳动本身就会卡一下。
//
// 自动降档的下限是 1：最低档会关掉大部分后处理，画面跨度太大，只留给手动切换。

const WINDOW = 1.2
const FLOOR = 1
/** 入城运镜结束后再等这么久才开始判档，避免"刚落地的判定"正好撞上运镜收尾。 */
const SETTLE = 3

export function QualityTuner() {
  const elapsed = useRef(0)
  const frames = useRef(0)
  const cooldown = useRef(SETTLE)
  const slowWindows = useRef(0)
  const upgrades = useRef(0)

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.25)

    // 只在真正在城里走路时判档。
    // 片头（screen === 'intro'）的相机在 200m 高空环绕整座城，帧率必然低，
    // 用它判档就是"欢迎页卡 → 永久降一档"：降档时 N8AO 的 halfRes 和采样数
    // 会变，后处理目标要重建，于是欢迎页上又卡一下。这正是"开始后几秒卡一下"。
    // 入城运镜期间同样跳过，理由一样。
    const app = useApp.getState()
    const judging = app.screen === 'city' && walker.flyInStart <= 0
    if (!judging) {
      elapsed.current = 0
      frames.current = 0
      slowWindows.current = 0
      cooldown.current = SETTLE
      return
    }

    elapsed.current += dt
    frames.current += 1
    cooldown.current = Math.max(0, cooldown.current - dt)
    if (elapsed.current < WINDOW) return

    const fps = frames.current / elapsed.current
    elapsed.current = 0
    frames.current = 0
    if (cooldown.current > 0) return

    const { quality, setQuality } = app
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
