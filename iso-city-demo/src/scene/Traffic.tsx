import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { lanes } from '../data/city'
import { addBody, placeBody, pruneBodies, type DynamicBody } from '../game/bodies'
import { useApp } from '../store'
import { palettes, type Palette } from './theme'

// 车流原来是「每辆车十几个 mesh」，十几辆车就吃掉近两百次 draw call。
// 现在整支车队只用 4 个 InstancedMesh：车身（逐实例上色）、车壳细节、灯具、地面光晕。
// 每帧只更新实例矩阵，CPU 与 GPU 的提交都少一个数量级。

type CarState = {
  lane: (typeof lanes)[number]
  t: number
  speed: number
  color: string
}

const CAR_COLORS = ['#9fb2c4', '#c9d5df', '#6d8194', '#a9b6c2', '#5f7486', '#b7c2cb', '#8a9dad']

function tinted(geo: THREE.BufferGeometry, color: string) {
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

function box(
  size: [number, number, number],
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const geo = new THREE.BoxGeometry(...size)
  geo.rotateX(rotation[0])
  geo.rotateY(rotation[1])
  geo.rotateZ(rotation[2])
  geo.translate(...position)
  return geo
}

/** 侧面轮廓挤出：这是让车"像车"的关键。
    侧面用二次贝塞尔画出引擎盖 → 前风挡 → 车顶 → 后风挡 → 后备厢的真实曲线，
    再沿车宽挤出并加圆角倒角，剪影立刻从方块变成轿车。 */
function extrudeProfile(
  points: Array<[number, number] | ['q', number, number, number, number]>,
  width: number,
  bevel = 0.1,
) {
  const shape = new THREE.Shape()
  let started = false
  for (const p of points) {
    if (p[0] === 'q') {
      shape.quadraticCurveTo(p[1], p[2], p[3], p[4])
    } else {
      const [x, y] = p as [number, number]
      if (!started) {
        shape.moveTo(x, y)
        started = true
      } else shape.lineTo(x, y)
    }
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 3,
    curveSegments: 10,
    steps: 1,
  })
  geo.translate(0, 0, -width / 2)
  // 轮廓的 x 轴（车头方向）转到 +Z，挤出方向转到 X
  geo.rotateY(-Math.PI / 2)
  geo.computeVertexNormals()
  return geo
}

/** 统一转成非索引再合并：ExtrudeGeometry 是非索引的，
    和 BoxGeometry / CylinderGeometry 混在一起 mergeGeometries 会直接返回 null。 */
function flatten(parts: THREE.BufferGeometry[]) {
  const flat = parts.map((geo) => (geo.index ? geo.toNonIndexed() : geo))
  const merged = mergeGeometries(flat, false)
  flat.forEach((geo, i) => {
    if (geo !== parts[i]) geo.dispose()
  })
  parts.forEach((geo) => geo.dispose())
  if (!merged) throw new Error('car geometry merge failed')
  return merged
}

function wheel(position: [number, number, number], tire: string, rim: string) {
  const parts = [
    (() => {
      const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.23, 16)
      geo.rotateZ(Math.PI / 2)
      geo.translate(...position)
      return tinted(geo, tire)
    })(),
    (() => {
      const geo = new THREE.CylinderGeometry(0.19, 0.19, 0.245, 14)
      geo.rotateZ(Math.PI / 2)
      geo.translate(...position)
      return tinted(geo, rim)
    })(),
  ]
  return flatten(parts)
}

type CarGeometries = {
  paint: THREE.BufferGeometry
  trim: THREE.BufferGeometry
  lights: THREE.BufferGeometry
}

const geometryCache = new Map<string, CarGeometries>()

function buildGeometries(palette: Palette): CarGeometries {
  const cached = geometryCache.get(palette.key)
  if (cached) return cached

  const night = palette.key === 'night'
  const glassColor = night ? '#101c26' : '#39494f'
  const wheelColor = night ? '#0b1118' : '#1f2324'
  const rimColor = night ? '#7c8b98' : '#b9c3c6'
  const trimColor = night ? '#161f28' : '#2c3437'

  // 车身：下沿到腰线
  const body = extrudeProfile(
    [
      [-2.16, 0.34],
      [-2.2, 0.62],
      ['q', -2.18, 0.9, -1.9, 0.95],
      [-1.12, 0.99],
      ['q', -0.42, 1.0, 0.24, 1.0],
      [1.32, 0.98],
      ['q', 1.94, 0.96, 2.2, 0.86],
      ['q', 2.34, 0.81, 2.3, 0.56],
      [2.26, 0.36],
      ['q', 2.0, 0.28, 1.6, 0.28],
      [-1.62, 0.28],
      ['q', -2.06, 0.28, -2.16, 0.34],
    ],
    1.82,
    0.11,
  )

  // 座舱：前风挡 → 车顶 → 后风挡，玻璃色
  const glass = extrudeProfile(
    [
      [-1.14, 0.96],
      ['q', -0.86, 1.28, -0.52, 1.42],
      ['q', -0.12, 1.55, 0.3, 1.53],
      ['q', 0.78, 1.5, 1.0, 1.2],
      ['q', 1.16, 1.02, 1.34, 0.97],
      [-1.14, 0.96],
    ],
    1.62,
    0.06,
  )

  // 车顶盖板用车身色（跟随实例色），所以并进 body 而不是 trim
  const roof = box([1.46, 0.07, 1.16], [0, 1.525, -0.1]).toNonIndexed()
  const paintMerged = flatten([body, roof])

  const trimParts = [
    tinted(glass, glassColor),
    // 侧裙
    tinted(box([1.9, 0.18, 3.5], [0, 0.3, 0]), trimColor),
    // 前保险杠下唇 + 后扩散器
    tinted(box([1.7, 0.16, 0.3], [0, 0.34, 2.18]), trimColor),
    tinted(box([1.7, 0.16, 0.3], [0, 0.34, -2.16]), trimColor),
    // 格栅
    tinted(box([1.2, 0.2, 0.1], [0, 0.62, 2.3]), trimColor),
    // 后视镜（带一小段支臂，脱离车身才不会闪）
    tinted(box([0.14, 0.09, 0.1], [-0.98, 1.13, 0.62]), trimColor),
    tinted(box([0.14, 0.09, 0.1], [0.98, 1.13, 0.62]), trimColor),
    // 门把手
    tinted(box([0.03, 0.05, 0.22], [-1.0, 0.94, 0.18]), trimColor),
    tinted(box([0.03, 0.05, 0.22], [1.0, 0.94, 0.18]), trimColor),
  ]
  for (const [x, z] of [
    [-0.95, 1.42],
    [0.95, 1.42],
    [-0.95, -1.4],
    [0.95, -1.4],
  ] as const) {
    // 轮拱阴影：贴在车身外侧的一圈暗色薄片，轮子因此像嵌进翼子板里
    const arch = new THREE.CylinderGeometry(0.45, 0.45, 0.012, 18)
    arch.rotateZ(Math.PI / 2)
    arch.translate(Math.sign(x) * 1.03, 0.36, z)
    trimParts.push(tinted(arch, wheelColor))
    trimParts.push(wheel([x, 0.34, z], wheelColor, rimColor))
  }
  const trim = flatten(trimParts)

  const lightParts = [
    // 前后灯组用细长光带，现代车的辨识度主要来自这一条
    tinted(box([0.6, 0.11, 0.12], [-0.54, 0.8, 2.32]), '#fff4d8'),
    tinted(box([0.6, 0.11, 0.12], [0.54, 0.8, 2.32]), '#fff4d8'),
    tinted(box([1.4, 0.1, 0.1], [0, 0.86, -2.26]), '#ff6a5a'),
  ]
  const lights = flatten(lightParts)

  const result = { paint: paintMerged, trim, lights }
  geometryCache.set(palette.key, result)
  return result
}

export function Traffic() {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const geos = useMemo(() => buildGeometries(palette), [palette])

  const cars = useMemo<CarState[]>(() => {
    const list: CarState[] = []
    let i = 0
    for (const lane of lanes) {
      const count = lane.axis === 'z' ? (Math.abs(lane.offset) < 20 ? 3 : 2) : 2
      for (let c = 0; c < count; c++) {
        const span = lane.to - lane.from
        list.push({
          lane,
          t: ((c + 0.35) / count) * span + (i * 13) % 40,
          speed: lane.speed * (0.85 + ((i * 7) % 10) / 24),
          color: CAR_COLORS[i % CAR_COLORS.length],
        })
        i++
      }
    }
    return list
  }, [])

  const count = cars.length

  // 每辆车登记一个刚体：玩家撞上去会被挡住，飞得比车顶高就能越过。
  // 登记必须在 effect 里做：dev 的 StrictMode 会 mount→cleanup→mount，
  // 写在 useMemo 里的话第二轮不会再执行，cleanup 之后车就全变成"幽灵"了。
  const bodies = useRef<Array<DynamicBody>>([])
  useEffect(() => {
    bodies.current = cars.map(() => addBody(1.55))
    return () => {
      bodies.current.forEach((body) => {
        body.active = false
      })
      bodies.current = []
      pruneBodies()
    }
  }, [cars])

  const paintRef = useRef<THREE.InstancedMesh>(null)
  const trimRef = useRef<THREE.InstancedMesh>(null)
  const lightRef = useRef<THREE.InstancedMesh>(null)

  const materials = useMemo(
    () => ({
      paint: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.22, metalness: 0.62, envMapIntensity: 1.1 }),
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.45 }),
      lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    }),
    [],
  )

  useEffect(() => () => Object.values(materials).forEach((mat) => mat.dispose()), [materials])
  useEffect(() => () => Object.values(geos).forEach((geo) => geo?.dispose()), [geos])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tint = useMemo(() => new THREE.Color(), [])

  // 逐实例颜色只在挂载时为车身写一次。
  useEffect(() => {
    const paint = paintRef.current
    if (!paint) return
    paint.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    cars.forEach((car, i) => paint.setColorAt(i, tint.set(car.color)))
    if (paint.instanceColor) paint.instanceColor.needsUpdate = true
  }, [cars, tint])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i]
      const span = car.lane.to - car.lane.from
      car.t = (car.t + car.speed * dt * car.lane.dir + span) % span
      const p = car.lane.from + car.t
      if (car.lane.axis === 'z') {
        dummy.position.set(car.lane.offset, 0, p)
        dummy.rotation.y = car.lane.dir === 1 ? 0 : Math.PI
      } else {
        dummy.position.set(p, 0, car.lane.offset)
        dummy.rotation.y = car.lane.dir === 1 ? Math.PI / 2 : -Math.PI / 2
      }
      dummy.updateMatrix()
      paintRef.current?.setMatrixAt(i, dummy.matrix)
      trimRef.current?.setMatrixAt(i, dummy.matrix)
      lightRef.current?.setMatrixAt(i, dummy.matrix)

      const body = bodies.current[i]
      if (body) {
        // 车身沿行进方向长 4.6m、横向宽 2.2m，按车头朝向决定哪一边是长度
        const along = car.lane.axis === 'z' ? 2.3 : 1.1
        const across = car.lane.axis === 'z' ? 1.1 : 2.3
        placeBody(body, dummy.position.x, dummy.position.z, across, along)
        body.maxY = 1.55
      }
    }
    for (const mesh of [paintRef.current, trimRef.current, lightRef.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group key={palette.key} userData={{ dynamic: true }}>
      <instancedMesh ref={paintRef} args={[geos.paint, materials.paint, count]} castShadow frustumCulled={false} />
      <instancedMesh ref={trimRef} args={[geos.trim, materials.trim, count]} castShadow frustumCulled={false} />
      <instancedMesh ref={lightRef} args={[geos.lights, materials.lights, count]} frustumCulled={false} />
    </group>
  )
}
