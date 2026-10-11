import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useParams } from '../context/ParamsContext'

/**
 * 果冻晃动：阻尼弹簧跟随鼠标，绕块体下方支点旋转（因此顶部摆幅大于底部），
 * 并用角速度驱动体积守恒的挤压/拉伸。
 *
 * 用法：
 *   <group ref={squashRef}>
 *     <group ref={pivotRef} position={[0, PIVOT_Y, 0]}>
 *       <group position={[0, -PIVOT_Y, 0]}>{children}</group>
 *     </group>
 *   </group>
 */
export function useJellyWobble() {
  const { paramsRef } = useParams()
  const pivotRef = useRef<THREE.Group>(null)
  const squashRef = useRef<THREE.Group>(null)
  const spring = useRef({ rx: 0, rz: 0, vx: 0, vz: 0, sy: 1 })

  useFrame(({ pointer }, rawDelta) => {
    const p = paramsRef.current
    const dt = Math.min(rawDelta, 1 / 30)
    const s = spring.current

    // 软 → 硬：刚度越大回弹越快
    const k = 60 + p.jelly.softness * 260
    const c = 2 * Math.sqrt(k) * 0.55
    const tilt = p.jelly.tilt

    const targetX = pointer.y * tilt
    const targetZ = -pointer.x * tilt

    s.vx += (-k * (s.rx - targetX) - c * s.vx) * dt
    s.vz += (-k * (s.rz - targetZ) - c * s.vz) * dt
    s.rx += s.vx * dt
    s.rz += s.vz * dt

    const speed = Math.min(1, Math.hypot(s.vx, s.vz) * 0.14)
    const targetSy = 1 - speed * 0.07
    s.sy += (targetSy - s.sy) * Math.min(1, dt * 11)
    const sxz = 1 / Math.sqrt(s.sy)

    const pivot = pivotRef.current
    if (pivot) {
      pivot.rotation.x = s.rx
      pivot.rotation.z = s.rz
    }
    const squash = squashRef.current
    if (squash) squash.scale.set(sxz, s.sy, sxz)
  })

  return { pivotRef, squashRef }
}
