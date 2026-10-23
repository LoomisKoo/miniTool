import * as THREE from 'three'

// 高频移动状态放在可变单例里，避免每帧触发 React 重渲染。
export const walker = {
  position: new THREE.Vector3(0, 0, 26),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0.2,
  vy: 0,
  grounded: true,
  gliding: false,
  flying: false,
  stamina: 1,
  speed: 0,
  camDist: 5.6,
  camTarget: 5.6,
  overview: false,
  savedDist: 5.6,
  savedPitch: 0.24,
  returnPosition: new THREE.Vector3(0, 0, 26),
  returnYaw: 0,
  returnPitch: 0.24,
  returnCamDist: 5.6,
  returnOverview: false,
}

export const keys = new Set<string>()

export function resetWalker(x: number, z: number, yaw = 0, pitch = 0.2) {
  walker.position.set(x, 0, z)
  walker.velocity.set(0, 0, 0)
  walker.yaw = yaw
  walker.pitch = pitch
  walker.vy = 0
  walker.grounded = true
  walker.gliding = false
  walker.flying = false
  walker.stamina = 1
  walker.overview = false
  walker.camDist = 5.6
  walker.camTarget = 5.6
}

export function toggleFlight() {
  walker.flying = !walker.flying
  walker.vy = 0
  if (walker.flying) {
    walker.grounded = false
    walker.overview = false
    // 起飞给一个向上的初速，让角色从原地平滑升起。
    // 以前这里直接把 y 改成 2.6，镜头会跟着瞬间跳一下，画面像闪了一下。
    walker.vy = Math.max(walker.vy, 6.2)
    walker.camTarget = Math.max(walker.camTarget, 9.5)
    walker.savedDist = walker.camTarget
  } else {
    // 降落：解除浮空后交给重力自然落地。
    walker.vy = -1.5
  }
}

export function toggleOverview() {
  if (walker.overview) {
    walker.overview = false
    walker.camTarget = walker.savedDist
    walker.pitch = walker.savedPitch
  } else {
    walker.savedDist = walker.camTarget
    walker.savedPitch = walker.pitch
    walker.overview = true
    walker.camTarget = 236
    walker.pitch = 1.24
  }
}

export function saveReturnSpot() {
  walker.returnPosition.copy(walker.position)
  walker.returnYaw = walker.yaw
  walker.returnPitch = walker.pitch
  walker.returnCamDist = walker.camTarget
  walker.returnOverview = walker.overview
}

export function restoreReturnSpot() {
  walker.position.copy(walker.returnPosition)
  walker.velocity.set(0, 0, 0)
  walker.yaw = walker.returnYaw
  walker.pitch = walker.returnPitch
  walker.camDist = walker.returnCamDist
  walker.camTarget = walker.returnCamDist
  walker.overview = walker.returnOverview
  walker.vy = 0
  walker.grounded = true
  walker.gliding = false
  walker.flying = false
}

export const isTyping = () => {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable
}
