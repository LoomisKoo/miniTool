import type { ReactNode } from 'react'
import { PIVOT_Y } from '../config/scene'
import { useJellyWobble } from '../hooks/useJellyWobble'

/**
 * 果冻舞台：外层做体积守恒的挤压/拉伸（绕块体中心），
 * 内层绕块体下方的支点旋转 —— 支点越低，顶部摆幅越大。
 */
export default function JellyGroup({ children }: { children: ReactNode }) {
  const { pivotRef, squashRef } = useJellyWobble()

  return (
    <group ref={squashRef}>
      <group ref={pivotRef} position={[0, PIVOT_Y, 0]}>
        <group position={[0, -PIVOT_Y, 0]}>{children}</group>
      </group>
    </group>
  )
}
