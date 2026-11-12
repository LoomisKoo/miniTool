// 头顶的灯串：缆绳 + 灯泡 + 灯泡外一层加色光晕。
//
// 全部用 InstancedMesh：一条街几十根缆绳、上百个灯泡，只多三次 draw call。
// 缆绳是一根沿 Y 的单位圆柱，按 a→b 的方向旋转并按长度拉伸；灯泡按弧长
// 均分，所以下垂幅度变了，灯距也不会跟着变。

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export type Span = {
  a: [number, number, number]
  b: [number, number, number]
  /** 中点下垂多少米 */
  sag: number
}

/** 悬链近似：y 按 sin 下垂。 */
function curveAt(a: [number, number, number], b: [number, number, number], sag: number, t: number) {
  return new THREE.Vector3(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t - sag * Math.sin(Math.PI * t),
    a[2] + (b[2] - a[2]) * t,
  )
}

export function StringLights({
  spans,
  night,
  /** 灯泡间距（米） */
  pitch = 1.1,
  /** 每跨细分段数：太少会读成折线 */
  pieces = 7,
}: {
  spans: Span[]
  night: boolean
  pitch?: number
  pieces?: number
}) {
  const mats = useMemo(
    () => ({
      cable: new THREE.MeshStandardMaterial({
        color: night ? '#2b3035' : '#4a4d4f',
        roughness: 0.75,
        metalness: 0.3,
        emissive: new THREE.Color('#1a1e22'),
        emissiveIntensity: night ? 0.6 : 0,
      }),
      // 灯泡本体：整体比光晕暗一点，免得整颗糊成一团白
      bulb: new THREE.MeshBasicMaterial({ color: night ? '#fff0cf' : '#e8ddc6', toneMapped: false }),
      // 光晕壳：加色、不写深度，能被静态合批一起吃进去
      halo: new THREE.MeshBasicMaterial({
        color: '#ffcb8a',
        transparent: true,
        opacity: night ? 0.24 : 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    }),
    [night],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  const meshes = useMemo(() => {
    const cables: Array<{ a: THREE.Vector3; b: THREE.Vector3 }> = []
    const bulbs: THREE.Vector3[] = []
    for (const s of spans) {
      for (let i = 0; i < pieces; i++) {
        cables.push({ a: curveAt(s.a, s.b, s.sag, i / pieces), b: curveAt(s.a, s.b, s.sag, (i + 1) / pieces) })
      }
      const len = Math.hypot(s.b[0] - s.a[0], s.b[2] - s.a[2])
      const n = Math.max(2, Math.round(len / pitch))
      for (let i = 1; i < n; i++) bulbs.push(curveAt(s.a, s.b, s.sag, i / n))
    }

    const up = new THREE.Vector3(0, 1, 0)
    const mtx = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const dir = new THREE.Vector3()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()

    const cable = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.017, 0.017, 1, 4, 1),
      mats.cable,
      Math.max(1, cables.length),
    )
    cables.forEach((c, i) => {
      pos.copy(c.a).add(c.b).multiplyScalar(0.5)
      dir.copy(c.b).sub(c.a)
      const len = dir.length()
      q.setFromUnitVectors(up, dir.normalize())
      mtx.compose(pos, q, scl.set(1, len, 1))
      cable.setMatrixAt(i, mtx)
    })
    cable.count = cables.length

    const bulb = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.072, 6, 4),
      mats.bulb,
      Math.max(1, bulbs.length),
    )
    const halo = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.2, 6, 4),
      mats.halo,
      Math.max(1, bulbs.length),
    )
    const one = new THREE.Vector3(1, 1, 1)
    q.identity()
    bulbs.forEach((b, i) => {
      mtx.compose(b, q, one)
      bulb.setMatrixAt(i, mtx)
      halo.setMatrixAt(i, mtx)
    })
    bulb.count = bulbs.length
    halo.count = bulbs.length
    halo.renderOrder = 2

    const all = [cable, bulb, halo]
    all.forEach((m) => {
      m.frustumCulled = false
      m.userData.noMerge = true
    })
    return all
  }, [spans, mats, pitch, pieces])

  useEffect(
    () => () => {
      for (const m of meshes) m.geometry.dispose()
    },
    [meshes],
  )

  return (
    <group userData={{ dynamic: true }}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}
