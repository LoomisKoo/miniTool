// 望远镜的观景状态。
//
// 望远镜不是一种「镜头模式」，只是把相机 fov 收窄、视线钉在窗外远处的一个点上：
// 玩家还站在原地，松开就回到原来的镜头。所以这里只需要三个字段，
// 不值得进 store 触发 React 重渲染。

import * as THREE from 'three'

export type Scope = {
  active: boolean
  /** 视线落点（房间局部坐标） */
  target: THREE.Vector3
  /** 这台望远镜看的墙，退出时用来还原朝向 */
  yaw: number
}

export const scope: Scope = {
  active: false,
  target: new THREE.Vector3(),
  yaw: 0,
}

export function enterScope(x: number, y: number, z: number) {
  scope.active = true
  scope.target.set(x, y, z)
}

export function leaveScope() {
  scope.active = false
}
