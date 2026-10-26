import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { lanes } from '../data/city'
import { allBuildings } from '../data/infill'
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
  /** 这台车飞不飞（不是每台都带喷口包） */
  flyable: boolean
  /** 飞行周期进度 0..1 */
  phase: number
  /** 一个完整起降周期多少秒 */
  cycle: number
  /** 巡航高度 */
  alt: number
  /** 当前离地系数 0..1（起飞/降落都在这个值上过渡） */
  lift: number
}

/** 车轮贴着沥青顶面，而不是陷进路面 2cm。 */
const CAR_Y = 0.02

/** 地面光斑的共享平面几何（尺寸固定，靠实例缩放）。 */
// 光锥和尾灯光斑都按米缩放，所以是单位平面
const BEAM_PLANE = new THREE.PlaneGeometry(1, 1)

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
  bevelSegments = 3,
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
    bevelSegments,
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
      const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 18)
      geo.rotateZ(Math.PI / 2)
      geo.translate(...position)
      return tinted(geo, tire)
    })(),
    (() => {
      const geo = new THREE.CylinderGeometry(0.21, 0.21, 0.255, 16)
      geo.rotateZ(Math.PI / 2)
      geo.translate(...position)
      return tinted(geo, rim)
    })(),
  ]
  return flatten(parts)
}

/**
 * 四个喷口的位置（车身坐标：x 横向，z 纵向，+z 车头）。
 *
 * 参考图里那台车每个轮拱内侧各一个等离子喷口，共四个。喷口贴在底板上，
 * 飞行时朝下喷射。
 */
const NOZZLES: Array<[number, number]> = [
  [-0.66, 1.24],
  [0.66, 1.24],
  [-0.66, -1.26],
  [0.66, -1.26],
]

type CarGeometries = {
  paint: THREE.BufferGeometry
  glass: THREE.BufferGeometry
  trim: THREE.BufferGeometry
  lights: THREE.BufferGeometry
  plume: THREE.BufferGeometry
}

const geometryCache = new Map<string, CarGeometries>()

function buildGeometries(palette: Palette): CarGeometries {
  const cached = geometryCache.get(palette.key)
  if (cached) return cached

  const night = palette.key === 'night'
  const wheelColor = night ? '#090e13' : '#1b1f21'
  const rimColor = night ? '#93a3b0' : '#c6cfd2'
  const trimColor = night ? '#111922' : '#252c2f'

  const W = 1.86

  /* ---------------- 车身 ----------------
     参考图那台车的设计语言全是直线和折面：车头一片极低的楔形、腰线一路
     上扬、车尾收成鸭尾。所以轮廓一个贝塞尔都不用，硬折角 + 小倒角就是
     它想要的切面感。 */
  const body = extrudeProfile(
    [
      [2.36, 0.24], // 车头尖端，离地很低
      [2.30, 0.42], // 前唇上翻
      [2.02, 0.50], // 机盖前缘
      [1.26, 0.56], // 机盖
      [0.76, 0.62], // 风挡根部（腰线在这里断开，往上是座舱）
      [-1.40, 0.70], // 后甲板
      [-1.94, 0.76], // 鸭尾上翘
      [-2.18, 0.60], // 尾板
      [-2.24, 0.38],
      [-2.14, 0.22],
      [-1.78, 0.18], // 平底板
      [1.88, 0.18],
    ],
    W,
    0.055,
    1,
  )

  // 后轮拱外扩，正侧面看才有"臀"
  const haunches = [-1, 1].map((s) =>
    box([0.1, 0.3, 1.34], [s * 0.93, 0.44, -1.28]),
  )
  const paintMerged = flatten([body, ...haunches])

  /* 座舱：一整片深色玻璃穹顶，宽度比车身窄一圈，
     留下明显的肩线台阶——参考图里那道折线就是它。 */
  const canopy = extrudeProfile(
    [
      [0.80, 0.58],
      [-0.04, 1.04],
      [-0.66, 1.05],
      [-1.46, 0.70],
      [-1.46, 0.58],
    ],
    1.44,
    0.05,
    2,
  )

  const trimParts = [
    // 侧裙：把车身下缘压成一条暗色带
    tinted(box([1.9, 0.1, 3.1], [0, 0.21, 0]), trimColor),
    // 前铲
    tinted(box([1.8, 0.09, 0.36], [0, 0.2, 2.12]), trimColor),
    // 后扩散器 + 竖鳍
    tinted(box([1.74, 0.26, 0.36], [0, 0.3, -2.04]), trimColor),
    tinted(box([0.06, 0.2, 0.38], [-0.5, 0.28, -2.02]), trimColor),
    tinted(box([0.06, 0.2, 0.38], [0, 0.28, -2.02]), trimColor),
    tinted(box([0.06, 0.2, 0.38], [0.5, 0.28, -2.02]), trimColor),
    // 车头黑色进气缝
    tinted(box([1.24, 0.11, 0.07], [0, 0.33, 2.31]), trimColor),
    // 后视镜：细支臂 + 小镜片
    tinted(box([0.16, 0.035, 0.05], [-0.94, 0.74, 0.56]), trimColor),
    tinted(box([0.16, 0.035, 0.05], [0.94, 0.74, 0.56]), trimColor),
    tinted(box([0.12, 0.07, 0.14], [-1.02, 0.76, 0.56]), trimColor),
    tinted(box([0.12, 0.07, 0.14], [1.02, 0.76, 0.56]), trimColor),
    // 喷口外壳：四个朝下的短筒
    ...NOZZLES.map(([x, z]) => {
      const geo = new THREE.CylinderGeometry(0.17, 0.2, 0.1, 14, 1, true)
      geo.translate(x, 0.1, z)
      return tinted(geo, trimColor)
    }),
  ]
  for (const [x, z] of [
    [-0.86, 1.42],
    [0.86, 1.42],
    [-0.86, -1.36],
    [0.86, -1.36],
  ] as const) {
    // 轮拱阴影：贴在车身外侧的一圈暗色薄片，轮子因此像嵌进翼子板里
    const arch = new THREE.CylinderGeometry(0.46, 0.46, 0.012, 20)
    arch.rotateZ(Math.PI / 2)
    arch.translate(Math.sign(x) * 1.02, 0.38, z)
    trimParts.push(tinted(arch, wheelColor))
    trimParts.push(wheel([x, 0.36, z], wheelColor, rimColor))
  }
  const trim = flatten(trimParts)

  const lightParts = [
    // 车头一整条极细的灯带（参考图正面就是一道横缝）
    tinted(box([1.58, 0.05, 0.1], [0, 0.455, 2.26]), '#dff4ff'),
    // 车尾贯穿灯带
    tinted(box([1.62, 0.06, 0.07], [0, 0.56, -2.17]), '#ff5a4e'),
    // 喷口内胆：不飞的时候也是一圈冷光
    ...NOZZLES.map(([x, z]) => tinted(box([0.26, 0.02, 0.26], [x, 0.05, z]), '#8fe6ff')),
  ]
  const lights = flatten(lightParts)

  const result = {
    paint: paintMerged,
    glass: canopy.index ? canopy.toNonIndexed() : canopy,
    trim,
    lights,
    plume: buildPlume(),
  }
  geometryCache.set(palette.key, result)
  return result
}

/**
 * 喷焰：四个朝下的锥体，顶亮尾黑。
 *
 * 用加色混合，黑色不贡献任何亮度，所以顶点色从 1 渐变到 0 正好等于一段
 * 会淡出的等离子尾焰，不需要写 shader，也不用透明贴图。
 */
function buildPlume() {
  const parts: THREE.BufferGeometry[] = []
  const H = 1.55
  for (const [x, z] of NOZZLES) {
    const cone = new THREE.ConeGeometry(0.29, H, 12, 1, true)
    cone.translate(0, -H / 2, 0) // 锥尖（喷口）落在 y=0
    cone.translate(x, 0, z)
    const pos = cone.attributes.position
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(-pos.getY(i) / H, 0, 1) // 0 喷口 / 1 尾端
      const k = Math.pow(1 - t, 1.7)
      colors[i * 3] = k
      colors[i * 3 + 1] = k
      colors[i * 3 + 2] = k
    }
    cone.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    parts.push(cone)
  }
  const merged = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  return merged!
}

/** 地面光斑：径向渐变，飞行中的车会在正下方投一片冷光。 */
function makeGlowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2)
  // 中性白：这里的颜色由实例色决定（尾灯的红）。原来写死青蓝色，
  // 红 × 蓝相乘结果是一团发紫的脏光。
  g.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
  g.addColorStop(0.3, 'rgba(255, 255, 255, 0.32)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * 车头灯贴图：一张"从车头往前铺开"的方向性渐变。
 * 顶部（贴住保险杠那一端）= 最亮、最窄；往下 = 越远越宽、越淡。
 * 用径向圆点拉伸成长条是最常见的偷懒做法，但那样会露出一条椭圆硬边，
 * 看起来像贴在地上的一张白纸。
 */
function makeHeadlightTexture() {
  const w = 96
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    // canvas 顶部 = 车头一端（PlaneGeometry 的 v=1 + 默认 flipY）
    const t = y / (h - 1)
    // 沿距离衰减：近处亮得快、远处收得干净，避免一条长白带横穿马路
    // 车头一端也要渐入：最亮的一行贴在平面边缘会切出一条硬直线
    const along = Math.pow(1 - t, 2.2) * Math.min(1, t / 0.08)
    // 光锥是发散扇形：半宽从车头往外张
    const halfW = 0.34 + 0.75 * t
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w) * 2 - 1
      const lateral = Math.exp(-Math.pow(Math.abs(u) / halfW, 3.2) * 1.7)
      const a = Math.min(1, along * lateral)
      const i = (y * w + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 246
      img.data[i + 2] = 230
      img.data[i + 3] = Math.round(a * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 起降曲线：起飞 → 巡航 → 降落 → 落地等待，四段都是平滑过渡。 */
function liftAt(phase: number) {
  const up = 0.1
  const down = 0.62
  const end = 0.74
  if (phase < up) {
    const t = phase / up
    return t * t * (3 - 2 * t)
  }
  if (phase < down) return 1
  if (phase < end) {
    const t = 1 - (phase - down) / (end - down)
    return t * t * (3 - 2 * t)
  }
  return 0
}

export function Traffic() {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk
  const geos = useMemo(() => buildGeometries(palette), [palette])

  // 车道收缩：车只沿"没有楼的连续路段"跑。
  //
  // 手写城市里偶尔会有房子压到车道上（地图两端的街屋最容易），车流是沿固定
  // 直线匀速跑的，不做避让就会直接从楼里穿过去。这里按楼体在车道横向上的
  // 投影把每条车道切成若干段，只保留最长的一段给车跑。
  const clearLanes = useMemo(() => {
    const box = 1.2 // 车半宽 + 一点余量
    return lanes.map((lane) => {
      const blocks: Array<[number, number]> = []
      for (const b of allBuildings) {
        const acrossLo = lane.axis === 'z' ? b.x - b.w / 2 : b.z - b.d / 2
        const acrossHi = lane.axis === 'z' ? b.x + b.w / 2 : b.z + b.d / 2
        if (acrossHi <= lane.offset - box || acrossLo >= lane.offset + box) continue
        const lo = lane.axis === 'z' ? b.z - b.d / 2 : b.x - b.w / 2
        const hi = lane.axis === 'z' ? b.z + b.d / 2 : b.x + b.w / 2
        blocks.push([lo - 3.2, hi + 3.2]) // 车身长度 + 刹车余量
      }
      blocks.sort((a, b) => a[0] - b[0])
      // 从 from 出发，跳到每一段障碍之后，取最长的一段
      let bestFrom = lane.from
      let bestTo = lane.to
      let cursor = lane.from
      for (const [lo, hi] of blocks) {
        if (hi <= cursor) continue
        if (lo > cursor && lo - cursor > bestTo - bestFrom) {
          bestFrom = cursor
          bestTo = lo
        }
        cursor = Math.max(cursor, hi)
        if (cursor >= lane.to) break
      }
      if (lane.to - cursor > bestTo - bestFrom) {
        bestFrom = cursor
        bestTo = lane.to
      }
      // 太短就干脆不放车，免得车在几米内来回弹
      return bestTo - bestFrom > 24 ? { ...lane, from: bestFrom, to: bestTo } : null
    })
  }, [])

  const cars = useMemo<CarState[]>(() => {
    const list: CarState[] = []
    let i = 0
    for (const lane of clearLanes) {
      if (!lane) continue
      // 车多一点：空荡荡的大街不像城市
      const count = lane.axis === 'z' ? (Math.abs(lane.offset) < 20 ? 4 : 3) : 3
      for (let c = 0; c < count; c++) {
        const span = lane.to - lane.from
        list.push({
          lane,
          t: ((c + 0.35) / count) * span + (i * 13) % 40,
          speed: lane.speed * (0.85 + ((i * 7) % 10) / 24),
          color: CAR_COLORS[i % CAR_COLORS.length],
          // 隔一台带一套喷口：车道上看过去是"起落交织"，不会整条街一起升空
          flyable: i % 3 !== 1,
          // 相位错开，任何时刻都有两三台在天上
          phase: (i * 0.137 + (i % 4) * 0.06) % 1,
          cycle: 20 + ((i * 5) % 13),
          alt: 6.6 + ((i * 3) % 4) * 1.8,
          lift: 0,
        })
        i++
      }
    }
    return list
  }, [clearLanes])

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
  const glassRef = useRef<THREE.InstancedMesh>(null)
  const trimRef = useRef<THREE.InstancedMesh>(null)
  const lightRef = useRef<THREE.InstancedMesh>(null)
  const plumeRef = useRef<THREE.InstancedMesh>(null)
  // 车头灯打在路面上的光锥 + 尾灯在车后的红光
  const beamRef = useRef<THREE.InstancedMesh>(null)
  const tailRef = useRef<THREE.InstancedMesh>(null)

  const materials = useMemo(
    () => ({
      paint: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.18, metalness: 0.72, envMapIntensity: 1.35 }),
      // 座舱玻璃单独一份材质：车漆可以带金属颗粒，玻璃必须接近镜面
      glass: new THREE.MeshStandardMaterial({ color: '#0b141b', roughness: 0.06, metalness: 0.95, envMapIntensity: 1.6 }),
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.45 }),
      lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      // 喷焰：加色混合 + 顶点色淡出，普通混合会在空中糊成一团灰
      plume: new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
      // 车头灯的光锥：方向性贴图，加色混合
  beam: new THREE.MeshBasicMaterial({
    map: makeHeadlightTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -16,
    polygonOffsetUnits: -32,
  }),
  glow: new THREE.MeshBasicMaterial({
        map: makeGlowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -16,
        polygonOffsetUnits: -32,
      }),
    }),
    [],
  )

  useEffect(
    () => () =>
      Object.values(materials).forEach((mat) => {
        ;(mat as THREE.MeshBasicMaterial).map?.dispose()
        mat.dispose()
      }),
    [materials],
  )
  useEffect(() => () => Object.values(geos).forEach((geo) => geo?.dispose()), [geos])

  const dummy = useMemo(() => {
    const o = new THREE.Object3D()
    // 欧拉默认 'XYZ' 的 X 旋转作用在世界轴上：车头朝 ±X 的车一抬头就会侧翻。
    // 'YXZ' 让俯仰先绕车身自己的横轴，转弯的车才抬得对。
    o.rotation.order = 'YXZ'
    return o
  }, [])
  const tint = useMemo(() => new THREE.Color(), [])

  // 逐实例颜色只在挂载时为车身写一次。
  useEffect(() => {
    const paint = paintRef.current
    if (!paint) return
    paint.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    cars.forEach((car, i) => paint.setColorAt(i, tint.set(car.color)))
    if (paint.instanceColor) paint.instanceColor.needsUpdate = true
  }, [cars, tint])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i]

      // 飞行周期
      if (car.flyable) {
        car.phase = (car.phase + dt / car.cycle) % 1
        car.lift = liftAt(car.phase)
      } else car.lift = 0

      const span = car.lane.to - car.lane.from
      // 起飞后走得更快：视觉上"这台车切到空中快线了"
      const speedMul = 1 + car.lift * 0.5
      car.t = (car.t + car.speed * speedMul * dt * car.lane.dir + span) % span
      const p = car.lane.from + car.t

      // 悬停时轻微上下浮动，不飞的车严格贴地
      const bob = Math.sin(time * 2.1 + i * 1.7) * 0.1 * car.lift
      const y = CAR_Y + car.lift * car.alt + bob

      // 车轮底在 y=0，路面沥青顶在 0.012~0.02：抬 2cm 让轮胎压在路面上
      if (car.lane.axis === 'z') {
        dummy.position.set(car.lane.offset, y, p)
        dummy.rotation.y = car.lane.dir === 1 ? 0 : Math.PI
      } else {
        dummy.position.set(p, y, car.lane.offset)
        dummy.rotation.y = car.lane.dir === 1 ? Math.PI / 2 : -Math.PI / 2
      }
      // 车头微微上扬，落地时压平
      dummy.rotation.x = -0.055 * car.lift + Math.sin(time * 1.5 + i) * 0.008 * car.lift
      dummy.rotation.z = 0
      dummy.scale.setScalar(1)
      dummy.updateMatrix()

      paintRef.current?.setMatrixAt(i, dummy.matrix)
      glassRef.current?.setMatrixAt(i, dummy.matrix)
      trimRef.current?.setMatrixAt(i, dummy.matrix)
      lightRef.current?.setMatrixAt(i, dummy.matrix)

      /* 喷焰：四个喷口的锥体随车一起变换，纵向按喷射强度伸缩，
         再乘一点高频抖动，看着才像等离子而不是一根塑料棍。 */
      const flicker = 0.82 + Math.sin(time * 17 + i * 2.3) * 0.1 + Math.sin(time * 31 + i) * 0.08
      const jet = car.lift * flicker
      if (plumeRef.current) {
        dummy.scale.set(0.85 + jet * 0.25, Math.max(0.001, jet * 1.15), 0.85 + jet * 0.25)
        dummy.updateMatrix()
        plumeRef.current.setMatrixAt(i, dummy.matrix)
        plumeRef.current.setColorAt(i, tint.setRGB(0.45 * jet, 0.9 * jet, 1.0 * jet))
      }

      /* 车灯。
         车底那一圈白色光斑已经去掉了：真实车下只有暗部（AO 负责），
         贴一张圆形亮片只会让人看出 "车踩在一张纸片上"。
         车头灯用贴地光锥（一盏真实聚光灯 × 十几台车会把着色器压垮）：
         从保险杠前方开始向前铺 10m，贴图本身是发散的扇形渐变。 */
      const yaw = car.lane.axis === 'z'
        ? (car.lane.dir === 1 ? 0 : Math.PI)
        : (car.lane.dir === 1 ? Math.PI / 2 : -Math.PI / 2)
      const fx = Math.sin(yaw)
      const fz = Math.cos(yaw)
      const ground = Math.max(0, 1 - car.lift * 4)
      if (beamRef.current) {
        const len = 10
        // 平面 local +y 在 YXZ 下指向车尾，所以中心放在车头前方半个长度处
        dummy.position.set(
          dummy.position.x + fx * (2.2 + len / 2),
          0.05,
          dummy.position.z + fz * (2.2 + len / 2),
        )
        dummy.rotation.set(-Math.PI / 2, yaw, 0)
        dummy.scale.set(3.4, len, 1)
        dummy.updateMatrix()
        beamRef.current.setMatrixAt(i, dummy.matrix)
        const g = ground * (night ? 0.42 : 0.08)
        beamRef.current.setColorAt(i, tint.setRGB(g, g * 0.97, g * 0.9))
      }
      if (tailRef.current) {
        // 尾灯：只在车尾后一点点，小、低、红，不参与照亮路面
        dummy.position.set(dummy.position.x - fx * 1.55, 0.045, dummy.position.z - fz * 1.55)
        dummy.rotation.set(-Math.PI / 2, yaw, 0)
        dummy.scale.set(2.6, 2.0, 1)
        dummy.updateMatrix()
        tailRef.current.setMatrixAt(i, dummy.matrix)
        const g = ground * (night ? 0.5 : 0.12)
        tailRef.current.setColorAt(i, tint.setRGB(g, g * 0.14, g * 0.1))
      }

      const body = bodies.current[i]
      if (body) {
        // 车身沿行进方向长 4.7m、横向宽 2.1m，按车头朝向决定哪一边是长度
        const along = car.lane.axis === 'z' ? 2.35 : 1.05
        const across = car.lane.axis === 'z' ? 1.05 : 2.35
        placeBody(body, dummy.position.x, dummy.position.z, across, along)
        // 飞起来的车只占空中那一段：站在地上的人会从它下面走过去
        body.minY = car.lift > 0.05 ? y - 0.35 : 0
        body.maxY = y + 1.15
      }
    }
    for (const mesh of [
      paintRef.current,
      glassRef.current,
      trimRef.current,
      lightRef.current,
      plumeRef.current,
      beamRef.current,
      tailRef.current,
    ]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <group key={palette.key} userData={{ dynamic: true }}>
      <instancedMesh ref={paintRef} args={[geos.paint, materials.paint, count]} castShadow frustumCulled={false} />
      <instancedMesh ref={glassRef} args={[geos.glass, materials.glass, count]} castShadow frustumCulled={false} />
      <instancedMesh ref={trimRef} args={[geos.trim, materials.trim, count]} castShadow frustumCulled={false} />
      <instancedMesh ref={lightRef} args={[geos.lights, materials.lights, count]} frustumCulled={false} />
      <instancedMesh ref={plumeRef} args={[geos.plume, materials.plume, count]} frustumCulled={false} />
      <instancedMesh ref={beamRef} args={[BEAM_PLANE, materials.beam, count]} renderOrder={2} frustumCulled={false} />
      <instancedMesh ref={tailRef} args={[BEAM_PLANE, materials.glow, count]} renderOrder={2} frustumCulled={false} />
    </group>
  )
}
