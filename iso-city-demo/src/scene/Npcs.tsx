import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { NpcDef } from '../data/npcs'
import { addBody, placeBody, pruneBodies } from '../game/bodies'
import { walker } from '../game/walker'
import { useApp } from '../store'
import { buildPerson } from './people'
import { PersonMesh, animateIdle, emptyLimbs, type Limbs } from './PersonMesh'
import { PromptTag } from './Markers'

/** 站岗的 NPC：原地呼吸，玩家走近就转头看过去，对话时会比划。 */
export function NpcFigure({ def, shadows = true, actionId }: { def: NpcDef; shadows?: boolean; actionId?: string }) {
  const geo = useMemo(() => buildPerson(def.look), [def.look])
  useEffect(
    () => () => {
      geo.body.dispose()
      geo.arm.dispose()
      geo.leg.dispose()
    },
    [geo],
  )
  const root = useRef<THREE.Group>(null)
  const limbs = useRef<Limbs>(emptyLimbs())
  const seed = useMemo(() => (def.x * 13.7 + def.z * 7.1) % 6.28, [def.x, def.z])

  useEffect(() => {
    const body = addBody(1.75)
    placeBody(body, def.x, def.z, 0.32, 0.32)
    return () => {
      body.active = false
      pruneBodies()
    }
  }, [def.x, def.z])

  useFrame((state, rawDelta) => {
    const node = root.current
    if (!node) return
    const dt = Math.min(rawDelta, 0.05)
    const dx = walker.position.x - def.x
    const dz = walker.position.z - def.z
    const near = dx * dx + dz * dz < 36
    let target = near ? Math.atan2(dx, dz) : def.yaw
    let diff = target - node.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    target = node.rotation.y + diff
    node.rotation.y = THREE.MathUtils.damp(node.rotation.y, target, 4, dt)
    const talking = useApp.getState().dialog?.name === def.name ? 1 : 0
    animateIdle(limbs.current, state.clock.elapsedTime, seed, talking)
  })

  return (
    <>
      <group ref={root} position={[def.x, 0, def.z]} rotation={[0, def.yaw, 0]} userData={{ dynamic: true }}>
        <PersonMesh geo={geo} limbs={limbs} shadows={shadows} />
      </group>
      <PromptTag x={def.x} y={2.25} z={def.z} text={`${def.name} · 对话`} actionId={actionId ?? `npc-${def.id}`} />
    </>
  )
}

export function Npcs({ list }: { list: NpcDef[] }) {
  return (
    <group>
      {list.map((def) => (
        <NpcFigure key={def.id} def={def} />
      ))}
    </group>
  )
}
