import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pedestrianRoutes } from '../data/infill'
import { addBody, placeBody, pruneBodies, type DynamicBody } from '../game/bodies'
import { seeded } from './theme'
import { buildPerson, randomLook, type Look } from './people'
import { PersonMesh, animateIdle, animateWalk, emptyLimbs, type Limbs } from './PersonMesh'

type Person = {
  route: (typeof pedestrianRoutes)[number]
  t: number
  /** 走完这一段就往回走：可走的段落被楼切开了，不能直接瞬移过去。 */
  dir: 1 | -1
  speed: number
  /** 人行道上的横向站位：每个人都走在自己的这条线上，不会排成一列。 */
  lane: number
  laneBase: number
  /** 这一帧想挪到的横向位置（避让同路线的人时会往旁边让）。 */
  laneTarget: number
  /** 到端点原地停一下再转身：瞬间折返看起来像"弹回去"。 */
  wait: number
  look: Look
  scale: number
  phase: number
}

/** 横向可挪动的范围：人行道内侧到路缘石之间。 */
const LANE_LIMIT = 0.98
/** 同一个路线上，前后这么近就要错开。 */
const PERSONAL_SPACE = 1.7

export function Citizens() {
  const roots = useRef<Array<THREE.Group | null>>([])
  const limbs = useRef<Array<{ current: Limbs }>>([])

  const people = useMemo<Person[]>(() => {
    const rnd = seeded('citizens-v4')
    const list: Person[] = []
    const total = 30
    for (let i = 0; i < total; i++) {
      const route = pedestrianRoutes[i % pedestrianRoutes.length]
      const span =
        route.kind === 'line'
          ? Math.abs(route.to - route.from)
          : Math.PI * 2
      // 横向站位取随机：同一路线上的人不能都踩在中线，否则永远走成一条直线
      const lane = (rnd() * 2 - 1) * LANE_LIMIT * 0.62
      list.push({
        route,
        // 初始位置必须落在 [0, span] 里：之前是 (i/total)*span + rnd()*8，
        // 越过 span 的人一登场就处在折返的临界点上。
        t: (((i / total) * span + rnd() * 8) % span) || 0.01,
        dir: route.dir,
        speed: (route.kind === 'line' ? route.speed : route.speed) * (0.8 + rnd() * 0.5),
        lane,
        laneBase: lane,
        laneTarget: lane,
        wait: rnd() * 0.8,
        look: randomLook(rnd),
        scale: 0.94 + rnd() * 0.1,
        phase: rnd() * Math.PI * 2,
      })
    }
    return list
  }, [])

  const bodies = useMemo(() => people.map((person) => buildPerson(person.look)), [people])
  useEffect(
    () => () =>
      bodies.forEach((geo) => {
        geo.body.dispose()
        geo.arm.dispose()
        geo.leg.dispose()
      }),
    [bodies],
  )
  if (limbs.current.length !== people.length) limbs.current = people.map(() => ({ current: emptyLimbs() }))

  // 行人也是刚体：站在他前面会被挡住，但不会把玩家推走。
  // 同样在 effect 里登记，避免 StrictMode 的二次挂载把刚体清空。
  const solids = useRef<Array<DynamicBody>>([])
  useEffect(() => {
    solids.current = people.map(() => addBody(1.75))
    return () => {
      solids.current.forEach((body) => {
        body.active = false
      })
      solids.current = []
      pruneBodies()
    }
  }, [people])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const t = state.clock.elapsedTime

    people.forEach((person) => {
      const route = person.route
      if (route.kind !== 'line') return
      // ---- 同路线避让 ----
      // 前后 1.7m 内有人就往旁边让，同时把步速压下来：
      // 以前 20 个人各自沿固定直线匀速走，相遇时直接互相穿过去。
      person.laneTarget = person.laneBase
      let slow = 1
      for (const other of people) {
        if (other === person || other.route !== route) continue
        const along = Math.abs(other.t - person.t)
        if (along > PERSONAL_SPACE) continue
        // 往与对方相反的一侧让，两个人同时让就自动分到两边
        const away = person.lane >= other.lane ? 1 : -1
        person.laneTarget = THREE.MathUtils.clamp(
          person.laneBase + away * 0.62,
          -LANE_LIMIT,
          LANE_LIMIT,
        )
        // 同向而且对方在前：跟着走，别贴着推
        const ahead = (other.t - person.t) * person.dir
        if (other.dir === person.dir && ahead > 0) {
          slow = Math.min(slow, THREE.MathUtils.clamp((ahead - 0.7) / 1.2, 0.15, 1))
        }
      }
      person.lane = THREE.MathUtils.damp(person.lane, person.laneTarget, 3.2, dt)

      // ---- 到端点：停一步、转身，再走回去 ----
      if (person.wait > 0) {
        person.wait = Math.max(0, person.wait - dt)
      } else {
        const span = Math.abs(route.to - route.from)
        person.t += person.speed * slow * dt * person.dir
        if (person.t >= span) {
          person.t = span
          person.dir = -1
          person.wait = 0.7 + (person.phase % 1.1)
        } else if (person.t <= 0) {
          person.t = 0
          person.dir = 1
          person.wait = 0.7 + (person.phase % 1.1)
        }
      }

      const span = Math.abs(route.to - route.from)
      const pos = route.from + (route.from <= route.to ? person.t : span - person.t)
      const node = roots.current[people.indexOf(person)]
      if (!node) return
      if (route.axis === 'z') {
        node.position.set(route.offset + person.lane, 0, pos)
      } else {
        node.position.set(pos, 0, route.offset + person.lane)
      }

      // 朝向也要插值：折返时瞬间转 180° 看起来像闪了一下
      const yaw =
        route.axis === 'z'
          ? person.dir === 1
            ? 0
            : Math.PI
          : person.dir === 1
            ? Math.PI / 2
            : -Math.PI / 2
      let diff = yaw - node.rotation.y
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      node.rotation.y += diff * Math.min(1, dt * 8)

      const walking = person.wait <= 0
      const bird = limbs.current[people.indexOf(person)].current
      if (walking) {
        // 步频跟着实际速度走，脚才不打滑
        const phase = t * (3.2 + person.speed * 2.4) + person.phase
        animateWalk(bird, phase, 0.6 + slow * 0.25)
        node.position.y = Math.abs(Math.sin(phase)) * 0.025
      } else {
        animateIdle(bird, t, person.phase)
        node.position.y = 0
      }

      const body = solids.current[people.indexOf(person)]
      if (body) {
        placeBody(body, node.position.x, node.position.z, 0.42 * person.scale, 0.42 * person.scale)
        body.maxY = 1.8 * person.scale
      }
    })

    // 环形步道那几条（广场外圈）不走折返逻辑，只按角速度转
    people.forEach((person) => {
      const route = person.route
      if (route.kind !== 'circle') return
      const index = people.indexOf(person)
      const node = roots.current[index]
      if (!node) return
      if (person.wait > 0) {
        person.wait = Math.max(0, person.wait - dt)
      } else {
        person.t += person.speed * dt * person.dir
      }
      const angle = person.t
      node.position.set(route.cx + Math.cos(angle) * route.r, 0, route.cz + Math.sin(angle) * route.r)
      node.rotation.y = -angle + (person.dir === 1 ? 0 : Math.PI)
      const phase = t * (3.2 + person.speed * 2.4) + person.phase
      if (person.wait > 0) {
        animateIdle(limbs.current[index].current, t, person.phase)
        node.position.y = 0
      } else {
        animateWalk(limbs.current[index].current, phase, 0.85)
        node.position.y = Math.abs(Math.sin(phase)) * 0.025
      }
      const body = solids.current[index]
      if (body) {
        placeBody(body, node.position.x, node.position.z, 0.42 * person.scale, 0.42 * person.scale)
        body.maxY = 1.8 * person.scale
      }
    })
  })

  return (
    <group userData={{ dynamic: true }}>
      {people.map((person, i) => (
        <group key={i} ref={(el) => (roots.current[i] = el)} scale={person.scale}>
          <PersonMesh geo={bodies[i]} limbs={limbs.current[i]} />
        </group>
      ))}
    </group>
  )
}
