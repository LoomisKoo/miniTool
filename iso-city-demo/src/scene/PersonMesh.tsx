import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import { HIP_X, HIP_Y, PERSON_MATERIAL, SHOULDER_X, SHOULDER_Y, type PersonGeometry } from './people'

export type Limbs = {
  armL: THREE.Group | null
  armR: THREE.Group | null
  legL: THREE.Group | null
  legR: THREE.Group | null
}

export const emptyLimbs = (): Limbs => ({ armL: null, armR: null, legL: null, legR: null })

/** 一个人：身体 + 以肩、胯为支点的四肢。动画由调用方改 limbs 的 rotation。 */
export function PersonMesh({
  geo,
  limbs,
  shadows = true,
}: {
  geo: PersonGeometry
  limbs: MutableRefObject<Limbs>
  shadows?: boolean
}) {
  return (
    <group>
      <mesh geometry={geo.body} material={PERSON_MATERIAL} castShadow={shadows} />
      <group ref={(el) => (limbs.current.armL = el)} position={[-SHOULDER_X, SHOULDER_Y, 0]} rotation={[0, 0, -0.06]}>
        <mesh geometry={geo.arm} material={PERSON_MATERIAL} castShadow={shadows} />
      </group>
      <group ref={(el) => (limbs.current.armR = el)} position={[SHOULDER_X, SHOULDER_Y, 0]} rotation={[0, 0, 0.06]}>
        <mesh geometry={geo.arm} material={PERSON_MATERIAL} castShadow={shadows} />
      </group>
      <group ref={(el) => (limbs.current.legL = el)} position={[-HIP_X, HIP_Y, 0]}>
        <mesh geometry={geo.leg} material={PERSON_MATERIAL} castShadow={shadows} />
      </group>
      <group ref={(el) => (limbs.current.legR = el)} position={[HIP_X, HIP_Y, 0]}>
        <mesh geometry={geo.leg} material={PERSON_MATERIAL} castShadow={shadows} />
      </group>
    </group>
  )
}

/** 走路：腿前后摆、手臂反向摆。 */
export function animateWalk(limbs: Limbs, phase: number, amount = 1) {
  const swing = Math.sin(phase) * 0.5 * amount
  if (limbs.legL) limbs.legL.rotation.x = swing
  if (limbs.legR) limbs.legR.rotation.x = -swing
  if (limbs.armL) limbs.armL.rotation.x = -swing * 0.8
  if (limbs.armR) limbs.armR.rotation.x = swing * 0.8
}

/** 站着：呼吸 + 偶尔比划一下（说话时 talk=1，手会抬起来）。 */
export function animateIdle(limbs: Limbs, t: number, seed: number, talk = 0) {
  const breathe = Math.sin(t * 1.6 + seed) * 0.03
  if (limbs.legL) limbs.legL.rotation.x = 0
  if (limbs.legR) limbs.legR.rotation.x = 0
  const gesture = talk * (0.55 + Math.sin(t * 3.1 + seed) * 0.25)
  if (limbs.armL) limbs.armL.rotation.x = breathe
  if (limbs.armR) {
    limbs.armR.rotation.x = -gesture + breathe
    limbs.armR.rotation.z = 0.06 + talk * 0.12
  }
}
