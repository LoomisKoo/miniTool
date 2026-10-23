import { useEffect } from 'react'
import { useApp } from '../store'
import { isTyping, keys, toggleFlight, toggleOverview, walker } from '../game/walker'

// 下降键给了多个：Mac 的 control 键常被系统快捷键（Ctrl+空格切输入法、
// Ctrl+方向键触发调度中心）截走，只留一个键在 Mac 上经常按不动。
const GAME_KEYS = new Set(['w', 'a', 's', 'd', 'shift', ' ', 'c', 'x', 'z', 'control'])

const MOVEMENT_KEYS: Record<string, string> = {
  arrowup: 'w',
  arrowleft: 'a',
  arrowdown: 's',
  arrowright: 'd',
}

export function useGameInput() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping()) return
      const key = event.key.toLowerCase()
      const movementKey = MOVEMENT_KEYS[key] || key
      if (GAME_KEYS.has(movementKey)) {
        keys.add(movementKey)
        if (movementKey === ' ' || MOVEMENT_KEYS[key]) event.preventDefault()
      }
      const state = useApp.getState()
      if (key === 'e' && !event.repeat) {
        if (state.panel || state.screen === 'intro') return
        const nearby = state.nearby
        if (nearby) {
          event.preventDefault()
          nearby.action()
        }
      }
      if (key === 'f' && !event.repeat) {
        if (state.panel || state.screen === 'intro') return
        toggleFlight()
      }
      if (key === 'v' && !event.repeat) {
        if (state.panel || state.screen === 'intro') return
        toggleOverview()
        state.showToast(
          walker.overview
            ? '城市总览 · 滚轮继续缩放，V 返回街道视角。'
            : '已回到街道视角。',
        )
      }
      if ((key === 'l' || key === 'n') && !event.repeat) {
        if (state.panel || state.screen === 'intro') return
        state.toggleNight()
      }
      if (key === 'escape' && state.panel) {
        if (state.editor) state.cancelEditing()
        else state.closePanel()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      keys.delete(MOVEMENT_KEYS[key] || key)
      if (key === 'shift') keys.delete('shift')
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target || target.tagName !== 'CANVAS') return
      const state = useApp.getState()
      if (state.panel || state.screen === 'intro') return
      if (document.pointerLockElement) return
      const canvas = target as HTMLCanvasElement
      const request = canvas.requestPointerLock?.bind(canvas)
      if (request) {
        try {
          const result = request() as unknown
          if (result && typeof (result as Promise<void>).catch === 'function') {
            ;(result as Promise<void>).catch(() => undefined)
          }
        } catch {
          /* 浏览器可能拒绝指针锁定，仍可点击互动 */
        }
      }
    }
    const onPointerLockChange = () => {
      useApp.getState().setPointerLocked(Boolean(document.pointerLockElement))
      if (!document.pointerLockElement) keys.clear()
    }
    const onBlur = () => keys.clear()
    const onVisibility = () => {
      if (document.hidden) keys.clear()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
