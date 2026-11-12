import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { river } from '../data/city'

const boatPath = [
  new THREE.Vector3(-118, -0.05, river.z),
  new THREE.Vector3(-48, -0.05, river.z + 2),
  new THREE.Vector3(28, -0.05, river.z - 2),
  new THREE.Vector3(118, -0.05, river.z),
]

const tramPath = [
  new THREE.Vector3(-116, 0.12, -24),
  new THREE.Vector3(-72, 0.12, -24),
  new THREE.Vector3(-72, 0.12, 28),
  new THREE.Vector3(72, 0.12, 28),
  new THREE.Vector3(72, 0.12, -24),
  new THREE.Vector3(116, 0.12, -24),
]

function loopPoint(path: THREE.Vector3[], t: number) {
  const scaled = ((t % 1) + 1) % 1 * path.length
  const i = Math.floor(scaled)
  const next = path[(i + 1) % path.length]
  const p = path[i]
  return {
    position: p.clone().lerp(next, scaled - i),
    yaw: Math.atan2(next.x - p.x, next.z - p.z),
  }
}

function Boat() {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    const { position, yaw } = loopPoint(boatPath, state.clock.elapsedTime / 48)
    ref.current.position.copy(position)
    ref.current.rotation.y = yaw
    ref.current.position.y += Math.sin(state.clock.elapsedTime * 2.2) * 0.025
  })
  return (
    <group ref={ref} userData={{ dynamic: true }}>
      <mesh position={[0, 0.15, 0]} scale={[1.8, 0.3, 0.72]}>
        <sphereGeometry args={[1, 12, 6]} />
        <meshStandardMaterial color="#314b58" roughness={0.42} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.48, 0]} scale={[0.8, 0.42, 0.48]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d9e4e2" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[0.95, 0.06, 0.58]} />
        <meshBasicMaterial color="#8fe6ff" toneMapped={false} />
      </mesh>
    </group>
  )
}

function Tram() {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    const { position, yaw } = loopPoint(tramPath, state.clock.elapsedTime / 42 + 0.35)
    ref.current.position.copy(position)
    ref.current.rotation.y = yaw
  })
  return (
    <group ref={ref} userData={{ dynamic: true }}>
      <mesh position={[0, 0.72, 0]} scale={[2.5, 0.8, 1.2]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d7b36a" roughness={0.3} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.93, 0.02]} scale={[2.1, 0.28, 1.24]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#284653" roughness={0.15} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.54, 0]}>
        <boxGeometry args={[1.8, 0.08, 1.24]} />
        <meshBasicMaterial color="#ffcf7d" toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Transit() {
  return (
    <group userData={{ dynamic: true }}>
      <Boat />
      <Tram />
    </group>
  )
}
