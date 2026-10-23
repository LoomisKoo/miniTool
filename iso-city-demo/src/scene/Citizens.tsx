import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { walkerRoutes } from '../data/city'
import { addBody, placeBody, pruneBodies, type DynamicBody } from '../game/bodies'
import { useApp } from '../store'
import { palettes, seeded, type Palette } from './theme'

type Person = {
  route: (typeof walkerRoutes)[number]
  t: number
  speed: number
  coat: string
  pants: string
  skin: string
  scale: number
  phase: number
}

const COATS = ['#c9d6e2', '#8fa3b6', '#697c8f', '#dfe6ec', '#aab8c5', '#7e93a6', '#c2b8a8']
const PANTS = ['#2f3b47', '#3b4754', '#26303a', '#4a5460', '#39424c']
const SKIN = ['#d9b294', '#c39572', '#a97650', '#e3c1a4']

/** 把一簇几何烘焙上顶点色后合并，行人的躯干/手臂/头/头发就能从 5 个 mesh 变成 1 个。 */
function tintedGeometry(geo: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color)
  const count = geo.attributes.position.count
  const array = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    array[i * 3] = c.r
    array[i * 3 + 1] = c.g
    array[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(array, 3))
  return geo
}

function buildBody(coats: string, pants: string, skin: string) {
  const torso = new THREE.CylinderGeometry(0.2, 0.17, 0.62, 10)
  torso.scale(1, 1, 0.72)
  torso.translate(0, 1.06, 0)
  const armL = new THREE.CapsuleGeometry(0.055, 0.44, 3, 6)
  armL.translate(-0.19, 1.18, 0)
  const armR = new THREE.CapsuleGeometry(0.055, 0.44, 3, 6)
  armR.translate(0.19, 1.18, 0)
  const head = new THREE.SphereGeometry(0.115, 12, 10)
  head.translate(0, 1.5, 0)
  const hair = new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)
  hair.translate(0, 1.55, -0.01)
  void pants

  const parts = [
    tintedGeometry(torso, coats),
    tintedGeometry(armL, coats),
    tintedGeometry(armR, coats),
    tintedGeometry(head, skin),
    tintedGeometry(hair, '#2a2622'),
  ]
  const merged = mergeGeometries(parts, false)!
  parts.forEach((geo) => geo.dispose())
  return merged
}

const BODY_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 })
const LEG_GEOMETRY = new THREE.CapsuleGeometry(0.075, 0.5, 3, 6)

export function Citizens() {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const roots = useRef<Array<THREE.Group | null>>([])
  const legs = useRef<Array<[THREE.Group | null, THREE.Group | null]>>([])

  const people = useMemo<Person[]>(() => {
    const rnd = seeded('citizens-v2')
    const list: Person[] = []
    const total = 20
    for (let i = 0; i < total; i++) {
      const route = walkerRoutes[i % walkerRoutes.length]
      const span =
        route.kind === 'line'
          ? Math.abs(route.to - route.from)
          : Math.PI * 2
      list.push({
        route,
        t: (i / total) * span + rnd() * 8,
        speed: (route.kind === 'line' ? route.speed : route.speed) * (0.8 + rnd() * 0.5),
        coat: COATS[Math.floor(rnd() * COATS.length)],
        pants: PANTS[Math.floor(rnd() * PANTS.length)],
        skin: SKIN[Math.floor(rnd() * SKIN.length)],
        scale: 0.94 + rnd() * 0.12,
        phase: rnd() * Math.PI * 2,
      })
    }
    return list
  }, [])

  const bodies = useMemo(
    () => people.map((person) => buildBody(person.coat, person.pants, person.skin)),
    [people],
  )
  useEffect(() => () => bodies.forEach((geo) => geo.dispose()), [bodies])

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

  const legMaterials = useMemo(
    () => people.map((person) => new THREE.MeshStandardMaterial({ color: person.pants, roughness: 0.9 })),
    [people],
  )
  useEffect(() => () => legMaterials.forEach((mat) => mat.dispose()), [legMaterials])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    people.forEach((person, i) => {
      const node = roots.current[i]
      if (!node) return
      const route = person.route
      if (route.kind === 'line') {
        const span = Math.abs(route.to - route.from)
        person.t = (person.t + person.speed * dt) % span
        const travelled = route.dir === 1 ? person.t : span - person.t
        const pos = route.from + travelled
        if (route.axis === 'z') {
          node.position.set(route.offset, 0, pos)
          node.rotation.y = route.dir === 1 ? 0 : Math.PI
        } else {
          node.position.set(pos, 0, route.offset)
          node.rotation.y = route.dir === 1 ? Math.PI / 2 : -Math.PI / 2
        }
      } else {
        person.t += person.speed * dt * route.dir
        const angle = person.t
        node.position.set(route.cx + Math.cos(angle) * route.r, 0, route.cz + Math.sin(angle) * route.r)
        node.rotation.y = -angle + (route.dir === 1 ? 0 : Math.PI)
      }
      const swing = Math.sin(state.clock.elapsedTime * 7 + person.phase) * 0.45
      const pair = legs.current[i]
      if (pair) {
        if (pair[0]) pair[0].rotation.x = swing
        if (pair[1]) pair[1].rotation.x = -swing
      }
      node.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 7 + person.phase)) * 0.03

      const body = solids.current[i]
      if (body) {
        placeBody(body, node.position.x, node.position.z, 0.42 * person.scale, 0.42 * person.scale)
        body.maxY = 1.8 * person.scale
      }
    })
  })

  return (
    <group userData={{ dynamic: true }}>
      {people.map((person, i) => (
        <group
          key={i}
          ref={(el) => (roots.current[i] = el)}
          scale={person.scale}
        >
          <group ref={(el) => (legs.current[i] = [el, legs.current[i]?.[1] ?? null])}>
            <mesh position={[-0.11, 0.4, 0]} geometry={LEG_GEOMETRY} material={legMaterials[i]} castShadow />
          </group>
          <group ref={(el) => (legs.current[i] = [legs.current[i]?.[0] ?? null, el])}>
            <mesh position={[0.11, 0.4, 0]} geometry={LEG_GEOMETRY} material={legMaterials[i]} castShadow />
          </group>
          <mesh geometry={bodies[i]} material={BODY_MATERIAL} castShadow />

        </group>
      ))}
    </group>
  )
}
