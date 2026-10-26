import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ferrisWheel } from '../data/city'
import { CABINS, CABIN_DROP, HUB_Y, cabinAngle, wheelAngle } from '../game/ferris'
import { palettes } from './theme'
import { useApp } from '../store'

/**
 * 社区摩天轮（直径 60m）。
 *
 * 轮子（轮圈 + 轮辐 + 轮毂）一组转动，支架不动，车厢挂在两道轮圈之间的横轴上、自身保持水平。
 * 转角来自 game/ferris 的共享时钟：主城和窗外那一份完全同步，乘坐时玩家钉在车厢地板上。
 * 根节点标 dynamic，静态合批不会把它冻住。
 */

/** 两道轮圈的间距：车厢挂在两圈之间，转到顶上也不会穿过轮辐。 */
const RIM_Z = 2.0

/** 车厢：底部略收、腰部一圈横梁、浅穹顶，整体压扁成椭圆舱。 */
const CAB_W = 1.38 // 顶部半径
const CAB_R0 = 1.12 // 底部半径
const CAB_H = 2.2
const CAB_SQUASH = 0.84 // 沿 z 压扁，椭圆的舱体比正圆更像车厢

function cylindersBetween(parts: THREE.BufferGeometry[], from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) {
  const dir = to.clone().sub(from)
  const len = dir.length()
  const g = new THREE.CylinderGeometry(r1, r0, len, 8)
  g.translate(0, len / 2, 0)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()))
  g.translate(from.x, from.y, from.z)
  parts.push(g)
}

function merge(parts: THREE.BufferGeometry[]) {
  const m = mergeGeometries(parts, false)!
  for (const g of parts) g.dispose()
  return m
}

/** 灯带的四组相位：前后两道外圈反向流动，内圈慢半拍，轮辐自己脉动。 */
const GROUP_PHASE = [0, 0.5, 0.2, 0.7, 0.35, 0.85]

/** 彩灯色相：整座轮子是一条彩虹环，而不是三色循环。
    以前的暖白/青只有两个色相，夜里远看就是一圈"越亮越白"的点，
    既没有亮度层次也没有颜色。 */
const HUE_SPAN = 1.0
/** 基础亮度：Basic 材质 toneMapped=false，值大于 1 才会被 Bloom 抓到。 */
const BULB_GAIN = 3.4

export function FerrisWheel() {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const R = ferrisWheel.radius
  const wheel = useRef<THREE.Group>(null)
  const cabins = useRef<Array<THREE.Group | null>>([])

  // 夜里钢结构的本色几乎看不见，全靠灯打亮；给一个偏青的基色，
  // 否则整座轮子在夜里就是一个黑剪影
  const metal = night ? '#4a6172' : '#9aa5a8'

  const wheelGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (const z of [-RIM_Z, RIM_Z]) {
      const rim = new THREE.TorusGeometry(R, 0.24, 8, 96)
      rim.translate(0, 0, z)
      parts.push(rim)
      // 内圈：外圈内侧的半腰轮圈，灯带挂在它上面
      const inner = new THREE.TorusGeometry(R * 0.9, 0.11, 6, 72)
      inner.translate(0, 0, z)
      parts.push(inner)
    }
    // 两道轮圈之间的横撑：正侧看时轮子不是两片薄饼
    for (let i = 0; i < CABINS * 2; i++) {
      const a = (i / (CABINS * 2)) * Math.PI * 2
      for (const rr of [R, R * 0.9]) {
        const tie = new THREE.CylinderGeometry(0.05, 0.05, RIM_Z * 2, 5)
        tie.rotateX(Math.PI / 2)
        tie.translate(Math.cos(a) * rr, Math.sin(a) * rr, 0)
        parts.push(tie)
      }
    }
    for (let i = 0; i < CABINS * 2; i++) {
      const a = (i / (CABINS * 2)) * Math.PI * 2
      for (const z of [-RIM_Z, RIM_Z]) {
        const g = new THREE.BoxGeometry(0.1, R, 0.1)
        g.translate(0, R / 2, 0)
        g.rotateZ(a + Math.PI / 2)
        g.translate(0, 0, z)
        parts.push(g)
      }
    }
    for (let i = 0; i < CABINS; i++) {
      const a = (i / CABINS) * Math.PI * 2
      const axle = new THREE.CylinderGeometry(0.08, 0.08, RIM_Z * 2, 6)
      axle.rotateX(Math.PI / 2)
      axle.translate(Math.cos(a) * R, Math.sin(a) * R, 0)
      parts.push(axle)
    }
    const hub = new THREE.CylinderGeometry(1.0, 1.0, RIM_Z * 2 + 0.6, 16)
    hub.rotateX(Math.PI / 2)
    parts.push(hub)
    return merge(parts)
  }, [R])

  const legsGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    // 底脚半径随轮子放大：R 从 19 涨到 30 之后，原来的 ±8m 底脚会让整座轮子
    // 变成一个细脚顶大饼的剪影，也挡不住侧向的风。
    const footX = R * 0.46
    const footZ = R * 0.2
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        cylindersBetween(parts, new THREE.Vector3(sx * footX, 0, sz * footZ), new THREE.Vector3(0, HUB_Y, sz * (RIM_Z + 0.4)), 0.62, 0.4)
      }
      // 腿间的斜撑
      cylindersBetween(parts, new THREE.Vector3(sx * footX, 0, -footZ), new THREE.Vector3(sx * footX * 0.5, HUB_Y * 0.5, RIM_Z + 0.4), 0.18, 0.18)
    }
    // 两个底脚之间的横撑，站在街上看才有"塔架"的结构感
    cylindersBetween(parts, new THREE.Vector3(-footX, HUB_Y * 0.45, -footZ), new THREE.Vector3(footX, HUB_Y * 0.45, -footZ), 0.14, 0.14)
    cylindersBetween(parts, new THREE.Vector3(-footX, HUB_Y * 0.45, footZ), new THREE.Vector3(footX, HUB_Y * 0.45, footZ), 0.14, 0.14)
    return merge(parts)
  }, [R])

  /* 车厢：收口的底壳 + 下半段挡板 + 通高玻璃 + 浅穹顶。
     全部做成回转体（14 边形），再沿 z 压扁成椭圆：
     以前是一个方盒子加四根角柱，远看就是"货柜"，完全没有车厢的轮廓。 */
  const cabinGeo = useMemo(() => {
    const frame: THREE.BufferGeometry[] = []
    const seg = 14
    const floorY = -CABIN_DROP
    const waistY = floorY + 0.88
    const topY = floorY + CAB_H
    const rWaist = CAB_R0 + (CAB_W - CAB_R0) * (0.88 / CAB_H)

    // 底壳：往下收口，挂点以下的"船底"
    const skirt = new THREE.CylinderGeometry(CAB_R0, CAB_R0 * 0.6, 0.54, seg)
    skirt.translate(0, floorY - 0.24, 0)
    frame.push(skirt)

    // 下半段挡板
    const shell = new THREE.CylinderGeometry(rWaist, CAB_R0, waistY - floorY, seg, 1, true)
    shell.translate(0, (waistY + floorY) / 2, 0)
    frame.push(shell)

    // 腰线横梁 + 檐口圈
    const belt = new THREE.TorusGeometry(rWaist, 0.07, 6, seg)
    belt.rotateX(Math.PI / 2)
    belt.translate(0, waistY, 0)
    frame.push(belt)

    const eave = new THREE.TorusGeometry(CAB_W, 0.085, 7, seg)
    eave.rotateX(Math.PI / 2)
    eave.translate(0, topY, 0)
    frame.push(eave)

    // 浅穹顶 + 顶盘
    const dome = new THREE.CylinderGeometry(0.5, CAB_W + 0.05, 0.34, seg)
    dome.translate(0, topY + 0.17, 0)
    frame.push(dome)
    const cap = new THREE.CylinderGeometry(0.22, 0.52, 0.16, seg)
    cap.translate(0, topY + 0.41, 0)
    frame.push(cap)

    // 竖梃：从腰线斜上去接檐口
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.31
      cylindersBetween(
        frame,
        new THREE.Vector3(Math.cos(a) * rWaist, waistY, Math.sin(a) * rWaist),
        new THREE.Vector3(Math.cos(a) * CAB_W, topY, Math.sin(a) * CAB_W),
        0.042,
        0.042,
      )
    }

    // 悬挂：从顶盘四周收成 A 形斜撑，再一根吊杆接上去，
    // 车厢才像"吊"在轴上，而不是悬空粘在轮圈上
    const crownY = topY + 0.45
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      cylindersBetween(
        frame,
        new THREE.Vector3(Math.cos(a) * 0.55, crownY, Math.sin(a) * 0.55),
        new THREE.Vector3(0, 0, 0),
        0.045,
        0.045,
      )
    }
    const rod = new THREE.CylinderGeometry(0.1, 0.1, Math.max(0.2, -crownY), 8)
    rod.translate(0, crownY / 2, 0)
    frame.push(rod)

    // 车内：地板 + 两侧座椅
    const floor = new THREE.CylinderGeometry(CAB_R0 * 0.92, CAB_R0 * 0.92, 0.08, seg)
    floor.translate(0, floorY + 0.04, 0)
    frame.push(floor)
    for (const sz of [-1, 1]) {
      const seat = new THREE.BoxGeometry(CAB_R0 * 1.15, 0.12, 0.42)
      seat.translate(0, floorY + 0.42, sz * CAB_R0 * 0.5)
      frame.push(seat)
      const back = new THREE.BoxGeometry(CAB_R0 * 1.15, 0.44, 0.1)
      back.translate(0, floorY + 0.66, sz * (CAB_R0 * 0.5 + 0.16))
      frame.push(back)
    }

    // 玻璃：从腰线一直到檐口，略带锥度
    const glass = new THREE.CylinderGeometry(CAB_W - 0.03, rWaist - 0.02, topY - waistY, seg, 1, true)
    glass.translate(0, (topY + waistY) / 2, 0)

    return { frame: merge(frame), glass }
  }, [])

  /** 车厢灯：檐口一圈小灯泡 + 一道灯带 + 车内顶灯。
      14 节车厢每节一圈，夜里远看是一串飘着的暖点。 */
  const cabinLightGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const topY = -CABIN_DROP + CAB_H
    const ring = new THREE.TorusGeometry(CAB_W + 0.06, 0.035, 5, 32)
    ring.rotateX(Math.PI / 2)
    ring.translate(0, topY + 0.02, 0)
    parts.push(ring)
    const N = 10
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const b = new THREE.SphereGeometry(0.075, 6, 5)
      b.translate(Math.cos(a) * (CAB_W + 0.06), topY + 0.02, Math.sin(a) * (CAB_W + 0.06))
      parts.push(b)
    }
    // 车内顶灯：透过玻璃能看到一团暖光
    const lamp = new THREE.CylinderGeometry(0.26, 0.34, 0.09, 10)
    lamp.translate(0, topY - 0.14, 0)
    parts.push(lamp)
    return merge(parts)
  }, [])

  const platformGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    // 站台挪到轮子最低点的正下方（原来偏到 z+5.4，上车点离车厢有 6m），
    // 尺寸也跟着 R 放大，给排队和栏杆留位置。
    const deck = new THREE.BoxGeometry(16, 0.34, 13)
    deck.translate(0, 0.17, 0)
    parts.push(deck)
    for (const sx of [-1, 1]) {
      const rail = new THREE.BoxGeometry(0.09, 1.05, 13)
      rail.translate(sx * 8, 0.86, 0)
      parts.push(rail)
    }
    for (const sz of [-1, 1]) {
      const rail = new THREE.BoxGeometry(16, 1.05, 0.09)
      rail.translate(0, 0.86, sz * 6.5)
      parts.push(rail)
    }
    return merge(parts)
  }, [])

  useEffect(
    () => () => {
      wheelGeo.dispose()
      legsGeo.dispose()
      cabinGeo.frame.dispose()
      cabinGeo.glass.dispose()
      cabinLightGeo.dispose()
      platformGeo.dispose()
    },
    [wheelGeo, legsGeo, cabinGeo, cabinLightGeo, platformGeo],
  )

  const colors = useMemo(
    // 车厢四色一组：暖白、青、琥珀、品红，转起来能看出每节车厢是独立的一盏灯
    () => [
      new THREE.Color('#fff0d2').multiplyScalar(1.9),
      new THREE.Color('#7fe6ff').multiplyScalar(2.1),
      new THREE.Color('#ffc46b').multiplyScalar(2.0),
      new THREE.Color('#ff8fd0').multiplyScalar(1.9),
    ],
    [],
  )

  /* 轮圈灯带：先前后两圈外圈，再前后两圈内圈，加轮辐灯和轮毂灯。
     全部塞进一个 InstancedMesh，跑马灯靠每帧改实例色。 */
  const RIM_N = 128
  const INNER_N = 96
  const SPOKE_STEPS = 2
  const HUB_N = 14
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.13, 7, 5), [])

  const bulbSpecs = useMemo(() => {
    const list: Array<{ r: number; a: number; z: number; group: number }> = []
    for (const z of [-RIM_Z, RIM_Z]) {
      for (let k = 0; k < RIM_N; k++) list.push({ r: R, a: (k / RIM_N) * Math.PI * 2, z: z * 1.05, group: z < 0 ? 0 : 1 })
      for (let k = 0; k < INNER_N; k++) list.push({ r: R * 0.9, a: (k / INNER_N) * Math.PI * 2, z: z * 1.05, group: z < 0 ? 2 : 3 })
    }
    for (let k = 0; k < CABINS * 2; k++) {
      const a = (k / (CABINS * 2)) * Math.PI * 2
      for (let s = 0; s < SPOKE_STEPS; s++) {
        list.push({ r: R * (0.3 + s * 0.36), a, z: 0, group: 4 })
      }
    }
    for (const z of [-1.1, 1.1]) {
      for (let k = 0; k < HUB_N; k++) list.push({ r: 2.3, a: (k / HUB_N) * Math.PI * 2, z, group: 5 })
    }
    return list
  }, [R])

  const bulbs = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false })
    const mesh = new THREE.InstancedMesh(bulbGeo, mat, bulbSpecs.length)
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3(1, 1, 1)
    bulbSpecs.forEach((b, i) => {
      p.set(Math.cos(b.a) * b.r, Math.sin(b.a) * b.r, b.z)
      mesh.setMatrixAt(i, m.compose(p, q, s))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    mesh.userData.dynamic = true
    return mesh
  }, [bulbGeo, bulbSpecs])

  useEffect(() => () => {
    bulbGeo.dispose()
    ;(bulbs.material as THREE.Material).dispose()
  }, [bulbGeo, bulbs])

  const tint = useMemo(() => new THREE.Color(), [])

  useFrame((state) => {
    const angle = wheelAngle()
    if (wheel.current) wheel.current.rotation.z = angle
    for (let i = 0; i < CABINS; i++) {
      const c = cabins.current[i]
      if (!c) continue
      const a = cabinAngle(i, angle)
      c.position.set(Math.cos(a) * R, HUB_Y + Math.sin(a) * R, 0)
    }
    // 跑马灯：整圈按角度铺一条彩带，前后两圈反向、内圈慢半拍。
    // 色相跟着角度和时间走，所以是一道道彩色的光在轮子上流，而不是"亮一点的白点"。
    if (!night) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < bulbSpecs.length; i++) {
      const spec = bulbSpecs[i]
      const around = spec.a / (Math.PI * 2)
      const dir = spec.group === 0 || spec.group === 2 ? 1 : -1
      // 色相环 + 缓慢漂移，相邻灯泡之间差 1/亮一圈就能看出彩虹
      const hue = (around * HUE_SPAN * dir + GROUP_PHASE[spec.group] + t * 0.045) % 1
      // 跑马灯：每 24 个灯泡一个波峰，波峰处过曝成光晕，波谷仍亮着
      const chase = 0.5 + 0.5 * Math.sin(around * Math.PI * 2 * 3 + t * 3.6 + GROUP_PHASE[spec.group] * 6)
      const gain = BULB_GAIN * (0.55 + chase * 0.85)
      tint.setHSL(hue, 0.92, 0.55).multiplyScalar(gain)
      bulbs.setColorAt(i, tint)
    }
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true
  })

  return (
    <group position={[ferrisWheel.x, 0, ferrisWheel.z]} userData={{ dynamic: true }}>
      <mesh geometry={legsGeo} castShadow userData={{ dynamic: true }}>
        <meshStandardMaterial
          color={metal}
          roughness={0.5}
          metalness={0.5}
          emissive={night ? '#1b3a4a' : '#000000'}
          emissiveIntensity={night ? 0.7 : 0}
        />
      </mesh>

      <group ref={wheel} position={[0, HUB_Y, 0]} userData={{ dynamic: true }}>
        {/* 轮毂的照明灯挂在 CityScene 的 StablePointLights 里：灯的数量一变，
            全场材质都要换 program 重编译，所以不能跟着这个分组晚挂载。 */}
        <mesh geometry={wheelGeo} castShadow userData={{ dynamic: true }}>
          <meshStandardMaterial
            color={metal}
            roughness={0.42}
            metalness={0.6}
            emissive={night ? '#2e6f8f' : '#000000'}
            emissiveIntensity={night ? 0.55 : 0}
          />
        </mesh>
        {/* 轮圈灯带跟着轮子一起转 */}
        {night && <primitive object={bulbs} />}
      </group>

      <mesh geometry={platformGeo} receiveShadow userData={{ dynamic: true }}>
        <meshStandardMaterial
          color={night ? '#5a6570' : palette.trim}
          roughness={0.7}
          metalness={0.2}
          emissive={night ? '#212a31' : '#000000'}
          emissiveIntensity={night ? 1 : 0}
        />
      </mesh>

      {Array.from({ length: CABINS }).map((_, i) => (
        <group
          key={i}
          userData={{ dynamic: true }}
          scale={[1, 1, CAB_SQUASH]}
          ref={(el) => {
            cabins.current[i] = el
          }}
        >
          <mesh geometry={cabinGeo.frame} castShadow userData={{ dynamic: true }}>
            <meshStandardMaterial
              color={night ? '#b9c1c6' : '#e6e9ea'}
              roughness={0.4}
              metalness={0.35}
              emissive={night ? '#3a444c' : '#000000'}
              emissiveIntensity={night ? 0.8 : 0}
            />
          </mesh>
          <mesh geometry={cabinGeo.glass} userData={{ dynamic: true }}>
            <meshStandardMaterial
              color={night ? '#3c4b52' : '#d6e8ec'}
              emissive={night ? '#4a3a26' : '#000000'}
              emissiveIntensity={night ? 0.9 : 0}
              transparent
              opacity={night ? 0.4 : 0.3}
              roughness={0.08}
              metalness={0.35}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {night && (
            <mesh geometry={cabinLightGeo} userData={{ dynamic: true }}>
              <meshBasicMaterial color={colors[i % colors.length]} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}
