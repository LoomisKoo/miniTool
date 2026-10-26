import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { useApp } from '../store'
import { keys, resetWalker, walker } from '../game/walker'
import { cabinFloor, ferris, ferrisExit } from '../game/ferris'
import { hitsDynamic, pushOut } from '../game/bodies'
import { OcclusionFade } from './OcclusionFade'
import { attachSilhouette } from './silhouette'

export type Collider = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY?: number
  maxY?: number
  walk?: boolean
  camera?: boolean
  /** 能站上去的平台（阳台、裙房顶、退台）：不受"至少 4m 宽才算支撑面"的限制 */
  stand?: boolean
}

export type Interactable = {
  id: string
  label: string
  hint: string
  x: number
  z: number
  radius: number
  /** 不在地面的交互点（楼顶）：只在这个高度附近才触发。 */
  y?: number
  action: () => void
}

type Props = {
  start?: [number, number]
  startYaw?: number
  colliders?: Collider[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  interactables: Interactable[]
  /**
   * 会动的交互点（宠物、车辆）：每次检测时现取。
   * 不走 interactables 是因为那张表是 useMemo 出来的静态数组，
   * 为了 40 只每分钟都在走的宠物去重建整张表不划算。
   */
  liveInteractables?: () => Interactable[]
  cameraDistance?: number
  interior?: boolean
}

const PLAYER_RADIUS = 0.42
const CAM_MIN = 2.6
const CAM_MAX = 210
const INTERIOR_CAM_MAX = 9
const PIVOT_HEIGHT = 1.46
/** lean 组的枢轴在髋部，body 要抵消这段高度；每帧写 position 时必须带上它。 */
const BODY_BASE = -0.94
/** 脚底离模型原点的距离：行人道顶面约 0.05，站上去才不会陷进砖里。 */
const FOOT_GROUND = 0.05

const SKIN = '#d8b193'
const SKIN_SHADE = '#c19a7c'
const COAT = '#eef1f5'
const COAT_SHADE = '#c9d2db'
const TRIM = '#232c36'
const PANTS = '#222a34'
const BOOT = '#e8edf2'
const BOOT_SOLE = '#171d24'
const HAIR = '#241f1c'

function overlaps(x: number, z: number, c: Collider) {
  return (
    x + PLAYER_RADIUS > c.minX &&
    x - PLAYER_RADIUS < c.maxX &&
    z + PLAYER_RADIUS > c.minZ &&
    z - PLAYER_RADIUS < c.maxZ
  )
}

function blocked(x: number, z: number, colliders: Collider[], y = 0, fromX = x, fromZ = z) {
  for (const c of colliders) {
    if (c.walk === false) continue
    // 飞得比建筑高时不受水平碰撞限制，可以真正飞越街区。
    if (y > (c.maxY ?? 100) - 0.3) continue
    // 从悬空的平台（阳台）下面走过时不挡
    if (y + 1.75 < (c.minY ?? 0)) continue
    // 已经卡在碰撞盒里（出生点压到家具等）时不再拦截，否则任何方向都走不出来。
    if (overlaps(fromX, fromZ, c)) continue
    if (overlaps(x, z, c)) return true
  }
  // 车和行人也是刚体：同样按"飞得比它高就能越过"处理
  if (hitsDynamic(x, z, PLAYER_RADIUS, y) && !hitsDynamic(fromX, fromZ, PLAYER_RADIUS, y)) return true
  return false
}

/**
 * 脚下的支撑面高度。
 *
 * 城市里能站的有三种面：地面(0)、屋顶、室内楼板。
 * 只取"不高于当前脚底 + 少量容差"的最高面，这样从屋顶边缘走出去会掉下去，
 * 而不是被吸在屋顶上；也不会在楼体外侧被凭空托住。
 */
function supportAt(x: number, z: number, colliders: Collider[], fromY: number) {
  const ceiling = fromY + 0.55
  let top = 0
  for (const c of colliders) {
    if (c.walk === false) continue
    const maxY = c.maxY ?? 0
    if (maxY <= 0.01 || maxY > ceiling) continue
    // 只有"楼"级别的体量才当支撑面：家具、这类的体量站不上去；平台例外
    if (!c.stand && (c.maxX - c.minX < 4 || c.maxZ - c.minZ < 4)) continue
    if (!overlaps(x, z, c)) continue
    if (maxY > top) top = maxY
  }
  return top
}

function segmentBox(origin: THREE.Vector3, dir: THREE.Vector3, c: Collider) {
  const minY = c.minY ?? 0
  const maxY = c.maxY ?? 100
  const boxMin = [c.minX - 0.2, minY, c.minZ - 0.2]
  const boxMax = [c.maxX + 0.2, maxY, c.maxZ + 0.2]
  const o = [origin.x, origin.y, origin.z]
  const d = [dir.x, dir.y, dir.z]
  let tmin = 0
  let tmax = 1
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-6) {
      if (o[i] < boxMin[i] || o[i] > boxMax[i]) return null
    } else {
      let t1 = (boxMin[i] - o[i]) / d[i]
      let t2 = (boxMax[i] - o[i]) / d[i]
      if (t1 > t2) [t1, t2] = [t2, t1]
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) return null
    }
  }
  return tmin
}

/** 旋转体：给躯干、大腿这类"上粗下细"的部位一个有曲线感的形状。
    比圆柱体多花不了几个三角面，但剪影完全不一样。 */
function lathe(profile: Array<[number, number]>, segments = 20, flattenZ = 1) {
  const points = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y))
  const geo = new THREE.LatheGeometry(points, segments)
  if (flattenZ !== 1) geo.scale(1, 1, flattenZ)
  geo.computeVertexNormals()
  return geo
}

/**
 * 筋斗云：一颗 metaball 融成的软云团（Marching Cubes 生成一次，之后是静态几何），
 * 表面是连续曲面、平滑法线，所以轮廓圆润、明暗过渡柔和；
 * 云头两侧各一只如意卷，身后一小截渐隐的飘带。角色的 +Z 是前方。
 */
const CLOUD_Y = -0.14
/** 角色前倾时脚会往后上方走，云要跟着脚走，否则一定会穿帮。 */
const FOOT_PIVOT = 0.94
/** 云尾的水汽团：池子大小、每走多远吐一团。 */
// 小而多、沿路径连续插值：大团稀疏的水汽一团团往后喷，像放屁；
// 池子太小又会在高速时被吃空，拖尾一截一截断掉。
const PUFF_COUNT = 260
const PUFF_STEP = 0.11
const PUFF_HIDDEN = new THREE.Vector3(0, -80, 0)

/**
 * 云胚：一串互相重叠的球（坐标在 [-1,1]，会被归一化到目标尺寸）。
 * 上面鼓、下面平、四周对称地散开，融合后就是一朵蓬松的团云。
 * [x, y, z, 半径]
 */
const CLOUD_BLOBS: Array<[number, number, number, number]> = [
  // 主体：左右两翼 + 中间撑起来
  [-0.34, 0.0, 0.0, 0.3],
  [0.34, 0.0, 0.0, 0.3],
  [0.0, 0.04, 0.0, 0.34],
  // 顶上的圆包
  [-0.16, 0.2, 0.06, 0.22],
  [0.18, 0.19, -0.04, 0.21],
  [0.02, 0.14, 0.22, 0.2],
  // 前后铺开
  [0.04, 0.0, 0.34, 0.24],
  [-0.26, -0.01, 0.26, 0.2],
  [-0.06, 0.03, -0.32, 0.22],
  [0.26, -0.01, -0.24, 0.19],
  // 两端的碎絮
  [-0.56, -0.03, 0.06, 0.16],
  [0.56, -0.04, -0.02, 0.16],
  // 底：压平，坐在脚下
  [0.0, -0.1, 0.0, 0.32],
  [-0.28, -0.09, 0.04, 0.22],
  [0.28, -0.09, 0.02, 0.22],
]

/**
 * 采样 metaball 场，得到一张连续、柔软的曲面。
 *
 * 注意 MarchingCubes 的两套坐标：addBall 吃的是 [0,1] 的网格坐标（内部再乘 size），
 * 而求出来的顶点又映射回 [-1,1]。以前把 [-1,1] 的云胚直接喂给 addBall，
 * 球心全部落到格子外被裁掉，只剩下角落里的碎面——屏幕上就是"几条被裁切的边"。
 */
let cloudGeoCache: THREE.BufferGeometry | null = null

function buildCloudGeometry() {
  // 只在第一次进场算一遍 MarchingCubes。以前每次挂载都重算 48³ 的场，
  // 反复进出场景时又要把这几十毫秒重新付一次。
  if (cloudGeoCache) return cloudGeoCache
  const RES = 48
  const mc = new MarchingCubes(RES, new THREE.MeshBasicMaterial(), false, false, 24000)
  // addBall 的场：r²/d² - 1；isolation 略大于 0，表面大致落在球的半径上
  mc.isolation = 0.06
  mc.reset()
  for (const [x, y, z, r] of CLOUD_BLOBS) mc.addBall((x + 1) / 2, (y + 1) / 2, (z + 1) / 2, (r / 2) ** 2, 1)
  mc.update()

  const verts = mc.count
  const src = mc.geometry.getAttribute('position').array as Float32Array
  const raw = new THREE.BufferGeometry()
  raw.setAttribute('position', new THREE.BufferAttribute(src.slice(0, verts * 3), 3))
  // 合并重复顶点：平滑法线要靠共享顶点，否则一颗颗三角面会闪
  const geo = mergeVertices(raw, 1e-4)
  raw.dispose()
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bb.getCenter(center)
  bb.getSize(size)
  geo.translate(-center.x, -center.y, -center.z)
  const k = 2.5 / Math.max(size.x, 1e-3)
  geo.scale(k, k * 0.62, k)
  geo.computeBoundingSphere()
  // MarchingCubes 只是临时计算用的容器，几何体已经拷出来了
  mc.geometry.dispose()
  ;(mc.material as THREE.Material).dispose()
  cloudGeoCache = geo
  return geo
}

/** 一团软边水汽：几颗高斯斑叠在一起，边缘不规则，看着才像云絮而不是圆片。 */
let puffTexCache: THREE.CanvasTexture | null = null
function puffTexture() {
  if (puffTexCache) return puffTexCache
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const blobs: Array<[number, number, number, number]> = [
    [0.5, 0.52, 0.34, 0.9],
    [0.36, 0.56, 0.22, 0.7],
    [0.64, 0.58, 0.22, 0.7],
    [0.47, 0.4, 0.2, 0.62],
    [0.58, 0.42, 0.17, 0.55],
    [0.3, 0.46, 0.14, 0.45],
    [0.7, 0.48, 0.14, 0.45],
  ]
  for (const [x, y, r, a] of blobs) {
    const g = ctx.createRadialGradient(x * size, y * size, 0, x * size, y * size, r * size)
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(0.55, `rgba(255,255,255,${a * 0.42})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  puffTexCache = new THREE.CanvasTexture(canvas)
  return puffTexCache
}

// 水汽团是面向镜头的公告板：在顶点着色器里按实例中心展开，
// 每团有自己的透明度和自转角，InstancedMesh 一次画完。
const PUFF_VERT = /* glsl */ `
attribute float aAlpha;
attribute float aSpin;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = aAlpha;
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  float c = cos(aSpin);
  float n = sin(aSpin);
  vec2 p = vec2(position.x * c - position.y * n, position.x * n + position.y * c);
  center.xy += p * s;
  gl_Position = projectionMatrix * center;
}`

const PUFF_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 uTop;
uniform vec3 uBottom;
varying vec2 vUv;
varying float vAlpha;
void main() {
  float a = texture2D(map, vUv).a * vAlpha;
  if (a < 0.004) discard;
  // 上亮下暗：受光面偏暖白，底面带一点天空的蓝灰，体积感就出来了
  vec3 col = mix(uBottom, uTop, smoothstep(0.15, 0.85, vUv.y));
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`

type Puff = {
  pos: THREE.Vector3
  vel: THREE.Vector3
  age: number
  life: number
  s0: number
  s1: number
  a0: number
  spin: number
  spinRate: number
  alive: boolean
}

function HoverRig({ visible }: { visible: boolean }) {
  const { scene } = useThree()
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const shell = useRef<THREE.Mesh>(null)
  const anchor = useMemo(() => new THREE.Vector3(), [])
  const lastAnchor = useMemo(() => new THREE.Vector3(), [])
  const moveDir = useMemo(() => new THREE.Vector3(), [])
  const tmpM = useMemo(() => new THREE.Matrix4(), [])
  const tmpS = useMemo(() => new THREE.Vector3(), [])
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const travelled = useRef(0)
  const idleTimer = useRef(0)
  const hasLast = useRef(false)
  // 预热帧：云和水汽的材质要到第一次真正绘制时才编译着色器。
  // 起飞那一瞬间再编译就是一次卡顿，所以进场后先在看不见的地方画几十帧。
  const warm = useRef(0)

  const cloudGeo = useMemo(buildCloudGeometry, [])

  // 纯白、高粗糙度、带一点点自发光：受光面到背光面是连续渐变，
  // 没有卡通分层的硬台阶，看起来才是"软"的
  const cloudMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.98,
        metalness: 0,
        emissive: '#cfe4f4',
        emissiveIntensity: 0.22,
        transparent: true,
      }),
    [],
  )

  const puffs = useMemo<Puff[]>(
    () =>
      Array.from({ length: PUFF_COUNT }, () => ({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        life: 1,
        s0: 1,
        s1: 1,
        a0: 0,
        spin: 0,
        spinRate: 0,
        alive: false,
      })),
    [],
  )

  const puffMesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(PUFF_COUNT), 1))
    geo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(new Float32Array(PUFF_COUNT), 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: PUFF_VERT,
      fragmentShader: PUFF_FRAG,
      uniforms: {
        map: { value: puffTexture() },
        uTop: { value: new THREE.Color('#fffaf2') },
        uBottom: { value: new THREE.Color('#c9d8e6') },
      },
      transparent: true,
      depthWrite: false,
    })
    const mesh = new THREE.InstancedMesh(geo, mat, PUFF_COUNT)
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.renderOrder = 4
    mesh.userData.noOcclude = true
    mesh.userData.dynamic = true
    mesh.raycast = () => {}
    return mesh
  }, [])

  // 水汽留在世界空间（不跟着人走），所以直接挂在场景根上
  useEffect(() => {
    scene.add(puffMesh)
    return () => {
      scene.remove(puffMesh)
    }
  }, [scene, puffMesh])

  useEffect(
    () => () => {
      // cloudGeo 是模块级缓存，跨挂载复用，不在这里释放
      cloudMat.dispose()
      puffMesh.geometry.dispose()
      ;(puffMesh.material as THREE.Material).dispose()
    },
    [cloudMat, puffMesh],
  )

  const spawnPos = useMemo(() => new THREE.Vector3(), [])
  const spawn = (speed: number, idle: boolean, at: THREE.Vector3) => {
    // 池子满了就回收最老的一团，而不是直接不吐（那样拖尾会断）
    let p = puffs.find((q) => !q.alive)
    if (!p) {
      p = puffs[0]
      for (const q of puffs) if (q.age / q.life > p.age / p.life) p = q
    }
    const jitter = idle ? 0.45 : 0.22 + speed * 0.12
    p.pos.copy(at)
    if (!idle) p.pos.addScaledVector(moveDir, -0.6)
    p.pos.x += (Math.random() - 0.5) * jitter * 2
    p.pos.y += (Math.random() - 0.5) * 0.12 - (idle ? 0.14 : 0.06)
    p.pos.z += (Math.random() - 0.5) * jitter * 2
    if (idle) p.vel.set((Math.random() - 0.5) * 0.1, -0.16 - Math.random() * 0.08, (Math.random() - 0.5) * 0.1)
    // 水汽留在原地慢慢散开，只带一点点惯性，不往后喷
    else p.vel.set((Math.random() - 0.5) * 0.25, 0.04 + Math.random() * 0.06, (Math.random() - 0.5) * 0.25).addScaledVector(moveDir, -0.15)
    p.age = 0
    p.life = idle ? 1.0 + Math.random() * 0.4 : 0.75 + Math.random() * 0.35 + speed * 0.35
    p.s0 = idle ? 0.35 + Math.random() * 0.15 : 0.42 + Math.random() * 0.14
    p.s1 = idle ? 0.75 + Math.random() * 0.25 : 0.95 + Math.random() * 0.35 + speed * 0.35
    p.a0 = idle ? 0.14 : 0.11 + speed * 0.06
    p.spin = Math.random() * Math.PI * 2
    p.spinRate = (Math.random() - 0.5) * 0.8
    p.alive = true
  }

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const t = state.clock.elapsedTime
    const active = visible || walker.flying
    const node = group.current
    if (!node) return
    const warming = !active && warm.current < 40
    if (warming) warm.current += 1
    node.visible = active || warming
    const lean = pose.lean
    if (shell.current) shell.current.castShadow = !warming
    if (warming) node.position.set(0, -80, 0)
    else
      node.position.set(
        0,
        FOOT_PIVOT * (1 - Math.cos(lean)) * 0.7 + Math.sin(t * 1.9) * 0.04 + CLOUD_Y,
        -FOOT_PIVOT * Math.sin(lean) * 0.92,
      )

    const reveal = THREE.MathUtils.clamp(walker.position.y / 0.4, 0, 1)
    cloudMat.opacity = warming ? 0 : reveal
    cloudMat.depthWrite = reveal > 0.9
    if (body.current) {
      // 云体缓慢呼吸 + 微微侧倾，静止时也是活的
      const breathe = 1 + Math.sin(t * 2.1) * 0.025
      body.current.scale.set(breathe, 1 / breathe, breathe)
      body.current.rotation.z = Math.sin(t * 1.3) * 0.04
    }

    // ---------- 水汽 ----------
    node.getWorldPosition(anchor)
    moveDir.set(walker.velocity.x, walker.vy, walker.velocity.z)
    const motion = moveDir.length()
    if (motion > 1e-3) moveDir.divideScalar(motion)
    const speed = THREE.MathUtils.clamp(motion / 8, 0, 1)
    const emitting = active && !warming && reveal > 0.9

    if (emitting) {
      // 位置突变（进出楼、传送、起降瞬间被拉回地面）不算"移动"，
      // 否则会在两点之间吐出一长串水汽——这就是切换飞行时那条异常长的拖尾。
      const step = hasLast.current ? anchor.distanceTo(lastAnchor) : 0
      if (!hasLast.current || step > 3) travelled.current = 0
      else if (motion > 0.6) travelled.current += step
      // 这一帧走过的线段上按固定间距补点：帧率低或飞得快都不会出现空档
      let n = 0
      const total = travelled.current
      while (travelled.current > PUFF_STEP && n < 14) {
        travelled.current -= PUFF_STEP
        const f = step > 1e-4 ? THREE.MathUtils.clamp(1 - travelled.current / Math.max(step, total), 0, 1) : 1
        spawn(speed, false, spawnPos.lerpVectors(lastAnchor, anchor, f))
        n++
      }
      if (travelled.current > PUFF_STEP) travelled.current = 0
      // 悬停时云底缓缓往下漏几缕
      idleTimer.current += dt
      if (motion < 0.6 && idleTimer.current > 0.4) {
        idleTimer.current = 0
        spawn(0, true, anchor)
      }
      lastAnchor.copy(anchor)
      hasLast.current = true
    } else {
      hasLast.current = false
      travelled.current = 0
    }

    const alpha = puffMesh.geometry.getAttribute('aAlpha') as THREE.InstancedBufferAttribute
    const spin = puffMesh.geometry.getAttribute('aSpin') as THREE.InstancedBufferAttribute
    let count = 0
    for (const p of puffs) {
      if (!p.alive) continue
      p.age += dt
      const k = p.age / p.life
      if (k >= 1) {
        p.alive = false
        continue
      }
      p.vel.multiplyScalar(Math.exp(-2.2 * dt))
      p.vel.y += 0.05 * dt
      p.pos.addScaledVector(p.vel, dt)
      p.spin += p.spinRate * dt
      const grow = 1 - Math.pow(1 - k, 2.2)
      const size = p.s0 + (p.s1 - p.s0) * grow
      const fade = THREE.MathUtils.smoothstep(k, 0, 0.08) * Math.pow(1 - k, 1.8)
      tmpS.setScalar(size)
      tmpM.compose(p.pos, tmpQ, tmpS)
      puffMesh.setMatrixAt(count, tmpM)
      alpha.setX(count, fade * p.a0)
      spin.setX(count, p.spin)
      count++
    }
    if (warming && count === 0) {
      // 预热：一团几乎透明的水汽画在地下，把着色器编译掉
      tmpS.setScalar(0.01)
      tmpM.compose(PUFF_HIDDEN, tmpQ, tmpS)
      puffMesh.setMatrixAt(0, tmpM)
      alpha.setX(0, 0.005)
      count = 1
    }
    puffMesh.count = count
    puffMesh.instanceMatrix.needsUpdate = true
    alpha.needsUpdate = true
    spin.needsUpdate = true
  })

  return (
    <group ref={group} visible={visible} userData={{ noGhost: true }}>
      <group ref={body}>
        {/* 云体本身：一朵蓬松的团云 */}
        <mesh ref={shell} geometry={cloudGeo} material={cloudMat} castShadow frustumCulled={false} />
      </group>
      {/* 云体自带的那盏暖光挪到了 CityScene 的 PlayerLamp：
          它跟着 visible 一起隐藏时会让点光数量变化，进场那一刻整城重编译。 */}
    </group>  )
}

/** 角色的关节角度，统一用阻尼过渡。 */
type Pose = {
  hipL: number
  hipR: number
  kneeL: number
  kneeR: number
  ankleL: number
  ankleR: number
  armL: number
  armR: number
  spreadL: number
  spreadR: number
  elbowL: number
  elbowR: number
  lean: number
  bob: number
}

const pose: Pose = {
  hipL: 0,
  hipR: 0,
  kneeL: 0.05,
  kneeR: 0.05,
  ankleL: 0,
  ankleR: 0,
  armL: 0,
  armR: 0,
  spreadL: 0.09,
  spreadR: -0.09,
  elbowL: 0.18,
  elbowR: 0.18,
  lean: 0,
  bob: 0,
}

// 入城运镜时长：正好覆盖片头淡出，落到主角身后时 HUD 也刚好就位。
const FLY_IN_MS = 1800

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function PlayerRig({
  start,
  startYaw = 0,
  colliders = [],
  bounds,
  interactables,
  liveInteractables,
  cameraDistance = 5.6,
  interior = false,
}: Props) {
  const { camera } = useThree()
  const interiorRef = useRef(interior)
  interiorRef.current = interior
  const flying = useApp((state) => state.hud.flying)
  const model = useRef<THREE.Group>(null)
  // 被楼、树、车挡住的部分画一层半透明剪影，任何时候都知道人在哪
  useEffect(() => {
    if (!model.current) return
    return attachSilhouette(model.current)
  }, [])
  const body = useRef<THREE.Group>(null)
  const lean = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const hipL = useRef<THREE.Group>(null)
  const hipR = useRef<THREE.Group>(null)
  const kneeL = useRef<THREE.Group>(null)
  const kneeR = useRef<THREE.Group>(null)
  const ankleL = useRef<THREE.Group>(null)
  const ankleR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const elbowL = useRef<THREE.Group>(null)
  const elbowR = useRef<THREE.Group>(null)
  const jumpLatch = useRef(false)
  const animPhase = useRef(0)
  // 骨盆高度补偿：腿一旦弯了，身体必须跟着下沉，脚才不会悬在空中
  const stance = useRef(-0.012)
  const accumulator = useRef(0)
  const nearAccumulator = useRef(0)
  const camReady = useRef(false)
  const fovReady = useRef(false)
  const baseFov = useRef(62)
  const desired = useRef(new THREE.Vector3())
  // 总览状态直接跟随 walker：切场景后第一帧就落在目标机位，不做推拉动画。
  // 室内一律从 0 开始：城市总览的机位不能带进走廊里再慢慢收回来。
  const overviewBlend = useRef(interior ? 0 : walker.overview ? 1 : 0)
  const overviewCenter = useRef(new THREE.Vector3())
  // 片头运镜：把城市当主角，缓慢环绕。离开片头后 3 秒内平滑交还给玩家镜头。
  // 只有真正的片头才从 1 开始；进出楼内/房间时镜头必须立刻到位，不能先飞一圈。
  const introBlend = useRef(useApp.getState().screen === 'intro' ? 1 : 0)
  const introLock = useRef(false)
  const introCam = useRef(new THREE.Vector3())
  const introTarget = useRef(new THREE.Vector3())
  // 片头 → 城市：镜头绕主角俯冲落位。用球面插值而不是两点直线，
  // 否则镜头会从楼体中间穿过。
  const fly = useRef({
    active: false,
    start: 0,
    from: new THREE.Spherical(),
    to: new THREE.Spherical(),
    fromLook: new THREE.Vector3(),
  })
  const flyVec = useRef(new THREE.Vector3())
  const target = useRef(new THREE.Vector3())
  const pivot = useRef(new THREE.Vector3())
  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())

  // 衣服材质：外套略带缎面，裤子哑光，鞋面有轻微反光。
  const coatMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: COAT, roughness: 0.66, metalness: 0.04 }),
    [],
  )
  const coatShadeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: COAT_SHADE, roughness: 0.74, metalness: 0.03 }),
    [],
  )
  const trimMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: TRIM, roughness: 0.58, metalness: 0.18 }),
    [],
  )
  const pantsMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PANTS, roughness: 0.82, metalness: 0.02 }),
    [],
  )
  const bootMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: BOOT, roughness: 0.4, metalness: 0.1 }),
    [],
  )
  const soleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: BOOT_SOLE, roughness: 0.72, metalness: 0.05 }),
    [],
  )
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.72, metalness: 0 }),
    [],
  )
  const skinShadeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: SKIN_SHADE, roughness: 0.76, metalness: 0 }),
    [],
  )
  const hairMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.86, metalness: 0.02 }),
    [],
  )
  useEffect(
    () => () => {
      for (const mat of [
        coatMat,
        coatShadeMat,
        trimMat,
        pantsMat,
        bootMat,
        soleMat,
        skinMat,
        skinShadeMat,
        hairMat,
      ]) {
        mat.dispose()
      }
    },
    [
      coatMat,
      coatShadeMat,
      trimMat,
      pantsMat,
      bootMat,
      soleMat,
      skinMat,
      skinShadeMat,
      hairMat,
    ],
  )

  // 躯干：肩宽腰细，前后压扁一点，剪影是"人"而不是"桶"
  const torsoGeo = useMemo(
    () =>
      lathe(
        [
          [0.148, 0.0],
          [0.163, 0.06],
          [0.168, 0.17],
          [0.196, 0.34],
          [0.212, 0.46],
          [0.204, 0.53],
          [0.176, 0.57],
        ],
        22,
        0.76,
      ),
    [],
  )
  useEffect(() => () => torsoGeo.dispose(), [torsoGeo])

  // 大腿：从膝盖往上收放，髋部最粗
  const thighGeo = useMemo(
    () =>
      lathe(
        [
          [0.061, -0.44],
          [0.07, -0.3],
          [0.084, -0.12],
          [0.092, 0.02],
        ],
        16,
        0.94,
      ),
    [],
  )
  useEffect(() => () => thighGeo.dispose(), [thighGeo])

  // 小腿：脚踝细、膝下略粗，带一点小腿肚的弧
  const shinGeo = useMemo(
    () =>
      lathe(
        [
          [0.044, -0.4],
          [0.05, -0.3],
          [0.061, -0.12],
          [0.062, 0.02],
        ],
        14,
        0.94,
      ),
    [],
  )
  useEffect(() => () => shinGeo.dispose(), [shinGeo])

  const bootGeo = useMemo(() => {
    // 鞋：后跟方、鞋头带一点弧度的胶囊，比一个方块像鞋
    const geo = new THREE.CapsuleGeometry(0.062, 0.14, 4, 12)
    geo.rotateX(Math.PI / 2)
    geo.scale(1.06, 0.86, 1)
    geo.translate(0, -0.02, 0.075)
    return geo
  }, [])
  useEffect(() => () => bootGeo.dispose(), [bootGeo])

  const bootSoleGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.115, 0.028, 0.26)
    geo.translate(0, -0.075, 0.06)
    return geo
  }, [])
  useEffect(() => () => bootSoleGeo.dispose(), [bootSoleGeo])

  useEffect(() => {
    baseFov.current = (camera as THREE.PerspectiveCamera).fov || 62
  }, [camera])

  useEffect(() => {
    if (start) {
      resetWalker(start[0], start[1], startYaw, 0.24)
      walker.camDist = cameraDistance
      walker.camTarget = cameraDistance
    } else {
      // 回到城市时沿用进入前的俯仰与缩放（restoreReturnSpot 已经恢复过），
      // 这样切场景时镜头只是"切回去"，不会顺便换一个机位。
      walker.camDist = walker.camTarget
    }
    keys.clear()
    camReady.current = false
    if (model.current) model.current.rotation.y = startYaw + Math.PI
  }, [start?.[0], start?.[1], startYaw, interior, cameraDistance])

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!document.pointerLockElement) return
      walker.yaw -= event.movementX * 0.0024
      // 抬头范围放宽到 -0.7：飞行时要能看着天往上飞。
      walker.pitch = THREE.MathUtils.clamp(walker.pitch + event.movementY * 0.0022, -0.7, 1.36)
    }
    const onWheel = (event: WheelEvent) => {
      if (!document.pointerLockElement) return
      // 城市和室内的 PlayerRig 同时挂着：不在当前场景的那个别动相机距离，
      // 否则室内的上限会把城里的镜头也夹死在近处。
      if (interiorRef.current !== (useApp.getState().screen === 'interior')) return
      event.preventDefault()
      // 按 deltaY 连续缩放：传统滚轮一格约 1.09 倍，触控板则是细密的小步，
      // 单次事件最大不超过 1.12 倍，避免一搓就到总览。
      const raw = THREE.MathUtils.clamp(event.deltaY * 0.0009, -0.12, 0.12)
      const factor = Math.exp(raw)
      walker.camTarget = THREE.MathUtils.clamp(
        walker.camTarget * factor,
        CAM_MIN,
        interiorRef.current ? INTERIOR_CAM_MAX : CAM_MAX,
      )
      walker.overview = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  useEffect(() => {
    const onBlur = () => keys.clear()
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])

  // 优先级 -1：把相机放到本帧最前面更新。
  // drei 的 Html 气泡在它自己的 useFrame 里用当前相机矩阵投影，而 useFrame 是
  // 按注册顺序（= JSX 顺序）执行的；PlayerRig 挂在最后，气泡就总是按上一帧的
  // 相机摆位投影，人一走整排气泡相对标记抖一下——这就是"锚点气泡抖动"。
  // 负数优先级只调整顺序，不会像正数那样接管渲染。
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const app = useApp.getState()
    const paused = app.panel !== null || app.screen === 'intro'
    if (interior) {
      walker.flying = false
      walker.overview = false
      // 室内最远只能拉到 INTERIOR_CAM_MAX：超过 22 会进入"远景"模式、关掉墙体避让，
      // 镜头直接穿出房间，看到的就是楼壳里那堵灰墙。
      walker.camTarget = THREE.MathUtils.clamp(walker.camTarget, CAM_MIN, INTERIOR_CAM_MAX)
    }
    const sprint = keys.has('shift')
    const fwdInput = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0)
    const sideInput = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)

    forward.current.set(-Math.sin(walker.yaw), 0, -Math.cos(walker.yaw))
    right.current.set(Math.cos(walker.yaw), 0, -Math.sin(walker.yaw))

    let dirX = 0
    let dirZ = 0
    if (!paused && (fwdInput || sideInput)) {
      const length = Math.hypot(fwdInput, sideInput) || 1
      dirX = (forward.current.x * fwdInput + right.current.x * sideInput) / length
      dirZ = (forward.current.z * fwdInput + right.current.z * sideInput) / length
    }

    const space = keys.has(' ')
    // Mac 上 control 很容易被系统截走，所以 C / X / Z 都能下降。
    const descend =
      keys.has('control') || keys.has('c') || keys.has('x') || keys.has('z')

    if (walker.flying) {
      // 自由飞行：方向跟随视角。镜头俯视时 W 就该往下飞，而不是永远水平向前。
      // 前向量取相机朝向（含俯仰），侧移仍保持水平，避免 A/D 带着上下漂。
      const cosPitch = Math.cos(walker.pitch)
      const fx = -Math.sin(walker.yaw) * cosPitch
      const fy = -Math.sin(walker.pitch)
      const fz = -Math.cos(walker.yaw) * cosPitch

      let mx = 0
      let my = 0
      let mz = 0
      if (!paused && (fwdInput || sideInput)) {
        const length = Math.hypot(fwdInput, sideInput) || 1
        mx = (fx * fwdInput + right.current.x * sideInput) / length
        my = (fy * fwdInput) / length
        mz = (fz * fwdInput + right.current.z * sideInput) / length
      }

      const flySpeed = (sprint ? 34 : 17) * (walker.overview ? 1.4 : 1)
      const blend = 1 - Math.exp(-6 * dt)
      walker.velocity.x += (mx * flySpeed - walker.velocity.x) * blend
      walker.velocity.z += (mz * flySpeed - walker.velocity.z) * blend
      if (!mx && !mz) {
        const friction = 1 - Math.exp(-3.4 * dt)
        walker.velocity.x *= 1 - friction
        walker.velocity.z *= 1 - friction
      }

      // 空格 / 下降键永远优先；没有垂直输入时，才让视线俯仰带动升降。
      const vertical = (space ? 1 : 0) - (descend ? 1 : 0)
      const vTarget =
        vertical !== 0 ? vertical * (sprint ? 22 : 12) : my * flySpeed
      walker.vy += (vTarget - walker.vy) * (1 - Math.exp(-7 * dt))
      walker.grounded = false
      walker.gliding = false
    } else {
      if (space && walker.grounded && !jumpLatch.current && !paused) {
        walker.vy = 7.4
        walker.grounded = false
        jumpLatch.current = true
      }
      if (!space) jumpLatch.current = false

      const canGlide = space && !walker.grounded && walker.vy < 0.5
      walker.gliding = canGlide
      if (canGlide) walker.vy = Math.max(walker.vy, -1.9)

      const baseSpeed = sprint ? 9.4 : 5.9
      const targetSpeed = dirX || dirZ ? baseSpeed * (canGlide ? 1.12 : 1) : 0
      const accel = walker.grounded ? 15 : 5.2
      const blend = 1 - Math.exp(-accel * dt)
      walker.velocity.x += (dirX * targetSpeed - walker.velocity.x) * blend
      walker.velocity.z += (dirZ * targetSpeed - walker.velocity.z) * blend
      if (!dirX && !dirZ && walker.grounded) {
        const friction = 1 - Math.exp(-12 * dt)
        walker.velocity.x *= 1 - friction
        walker.velocity.z *= 1 - friction
      }
    }

    if (!interior && ferris.riding >= 0) {
      // 坐在摩天轮车厢里：位置每帧跟着车厢，视角照常可转
      const seat = cabinFloor(ferris.riding)
      walker.position.set(seat.x, seat.y, seat.z)
      walker.velocity.set(0, 0, 0)
      walker.vy = 0
      walker.flying = false
      walker.gliding = false
      walker.grounded = true
    } else if (!paused) {
      const nextX = walker.position.x + walker.velocity.x * dt
      const { x: px, z: pz, y: py } = walker.position
      if (!blocked(nextX, pz, colliders, py, px, pz)) walker.position.x = nextX
      else walker.velocity.x = 0

      const nextZ = walker.position.z + walker.velocity.z * dt
      if (!blocked(walker.position.x, nextZ, colliders, py, walker.position.x, pz)) walker.position.z = nextZ
      else walker.velocity.z = 0

      // 车不会为玩家让路，所以被车压住时要被挤出去，而不是站在车里。
      const freed = pushOut(walker.position.x, walker.position.z, PLAYER_RADIUS, walker.position.y)
      if (freed.x !== walker.position.x || freed.z !== walker.position.z) {
        walker.position.x = freed.x
        walker.position.z = freed.z
        walker.velocity.multiplyScalar(0.2)
      }

      walker.position.x = THREE.MathUtils.clamp(walker.position.x, bounds.minX, bounds.maxX)
      walker.position.z = THREE.MathUtils.clamp(walker.position.z, bounds.minZ, bounds.maxZ)

      // 建筑整体是刚体：脚下永远有一个实体支撑面（地面 / 屋顶 / 室内楼板），
      // 所以从屋顶往下飞不会再"陷"进楼里。
      const support = supportAt(walker.position.x, walker.position.z, colliders, walker.position.y)

      if (walker.flying) {
        walker.position.y += walker.vy * dt
        if (walker.position.y < support) {
          walker.position.y = support
          walker.vy = Math.max(0, walker.vy)
        }
        walker.position.y = THREE.MathUtils.clamp(walker.position.y, 0.35, 165)
        walker.grounded = Math.abs(walker.position.y - support) < 0.08
      } else {
        walker.vy -= 18 * dt
        walker.position.y += walker.vy * dt
        if (walker.position.y <= support) {
          walker.position.y = support
          walker.vy = 0
          walker.grounded = true
        } else {
          walker.grounded = false
        }
      }
    }

    walker.speed = Math.hypot(walker.velocity.x, walker.velocity.z)

    if (model.current) {
      model.current.position.set(walker.position.x, walker.position.y, walker.position.z)
      if (walker.speed > 0.3) {
        const targetYaw = Math.atan2(walker.velocity.x, walker.velocity.z)
        let delta = targetYaw - model.current.rotation.y
        while (delta > Math.PI) delta -= Math.PI * 2
        while (delta < -Math.PI) delta += Math.PI * 2
        model.current.rotation.y += delta * Math.min(1, dt * 13)
      }
    }

    // ---------- 姿态 ----------
    const run = THREE.MathUtils.clamp((walker.speed - 6) / 3.4, 0, 1)
    const walkAmount = THREE.MathUtils.clamp(walker.speed / 2.4, 0, 1)
    // 相位按"走过的距离"推进：脚步频率跟着速度变，脚才不会打滑
    animPhase.current += dt * (1.6 + walker.speed * 2.1)
    const p = animPhase.current
    const air = walker.grounded ? 0 : 1
    const glide = walker.gliding ? 1 : 0
    const swing = Math.sin(p)
    const swingOpp = Math.sin(p + Math.PI)
    const damp = (current: number, next: number, lambda = 16) =>
      THREE.MathUtils.damp(current, next, lambda, dt)

    // 步幅随速度增大；膝盖在腿往前摆的半个周期里弯曲，落地时伸直
    const amp = (0.44 + run * 0.4) * walkAmount
    const kneeAmount = (0.72 + run * 0.8) * walkAmount
    // 抬脚发生在腿刚离地往后摆的那一段，比"腿在正下方"更接近真实步态
    const liftL = Math.max(0, Math.cos(p + 1))
    const liftR = Math.max(0, Math.cos(p + Math.PI + 1))

    let hipLTarget = swing * amp
    let hipRTarget = swingOpp * amp
    let kneeLTarget = 0.05 + Math.pow(liftL, 1.3) * kneeAmount
    let kneeRTarget = 0.05 + Math.pow(liftR, 1.3) * kneeAmount
    let ankleLTarget = -hipLTarget * 0.34 - kneeLTarget * 0.34
    let ankleRTarget = -hipRTarget * 0.34 - kneeRTarget * 0.34
    let armLTarget = swingOpp * amp * 0.86
    let armRTarget = swing * amp * 0.86
    // 左臂挂在 -x：绕 z 正向旋转会把它甩向身体内侧，所以向外是负值
    let spreadL = -0.09
    let spreadR = 0.09
    let elbowLTarget = 0.2 + Math.max(0, swingOpp) * (0.34 + run * 0.5) * walkAmount
    let elbowRTarget = 0.2 + Math.max(0, swing) * (0.34 + run * 0.5) * walkAmount
    let leanTarget = run * 0.12
    // 每次落脚身体下沉一次（一个步态周期两次）
    let bobTarget = walker.grounded
      ? -Math.abs(Math.sin(p)) * 0.026 * walkAmount +
        Math.sin(state.clock.elapsedTime * 1.7) * 0.005 * (1 - walkAmount)
      : 0

    if (walker.flying) {
      // 御云：人是坐在云上的，不是趴着飞。
      // 大腿向前放平、小腿垂下，上身几乎直立；前进后退都不改变俯仰角——
      // 以前按速度把身体压前倾，看着像在冲浪而不是坐着。
      const t = state.clock.elapsedTime
      const flutter = Math.sin(t * 2.6) * 0.022
      hipLTarget = -1.34 + flutter
      hipRTarget = -1.34 - flutter
      kneeLTarget = 1.38
      kneeRTarget = 1.38
      ankleLTarget = -0.12
      ankleRTarget = -0.12
      // 手搭在膝上：上臂略前垂，肘部弯一点
      armLTarget = -0.42 - flutter * 0.5
      armRTarget = -0.42 + flutter * 0.5
      spreadL = -0.1
      spreadR = 0.1
      elbowLTarget = 0.62
      elbowRTarget = 0.62
      // 只留极轻的呼吸式摆动，速度再快也不俯仰
      leanTarget = 0.02
      bobTarget = Math.sin(t * 2.2) * 0.018
    } else if (glide) {
      // 滑翔：手臂张开成翼型，腿略收
      hipLTarget = -0.14
      hipRTarget = -0.14
      kneeLTarget = 0.34
      kneeRTarget = 0.34
      ankleLTarget = 0.1
      ankleRTarget = 0.1
      armLTarget = -0.16
      armRTarget = -0.16
      spreadL = -1.18
      spreadR = 1.18
      elbowLTarget = 0.12
      elbowRTarget = 0.12
      leanTarget = 0.3
      bobTarget = 0.02
    } else if (air) {
      hipLTarget = -0.3
      hipRTarget = 0.2
      kneeLTarget = 0.62
      kneeRTarget = 0.34
      ankleLTarget = 0.18
      ankleRTarget = 0.1
      armLTarget = -0.95
      armRTarget = -0.95
      spreadL = -0.3
      spreadR = 0.3
      elbowLTarget = 0.6
      elbowRTarget = 0.6
      leanTarget = 0.06
      bobTarget = 0
    }

    pose.hipL = damp(pose.hipL, hipLTarget)
    pose.hipR = damp(pose.hipR, hipRTarget)
    pose.kneeL = damp(pose.kneeL, kneeLTarget)
    pose.kneeR = damp(pose.kneeR, kneeRTarget)
    pose.ankleL = damp(pose.ankleL, ankleLTarget)
    pose.ankleR = damp(pose.ankleR, ankleRTarget)
    pose.armL = damp(pose.armL, armLTarget, 14)
    pose.armR = damp(pose.armR, armRTarget, 14)
    pose.spreadL = damp(pose.spreadL, spreadL, 12)
    pose.spreadR = damp(pose.spreadR, spreadR, 12)
    pose.elbowL = damp(pose.elbowL, elbowLTarget, 14)
    pose.elbowR = damp(pose.elbowR, elbowRTarget, 14)
    pose.lean = damp(pose.lean, leanTarget, 10)
    pose.bob = damp(pose.bob, bobTarget, 18)

    // 没有骨骼 IK 时，脚很容易悬空：把"两条腿的垂直长度"算出来，
    // 让最直的那条腿正好踩到地面，身体高度就不再是凭感觉给的常数。
    const THIGH = 0.42
    const SHIN = 0.4
    const ANKLE_TO_SOLE = 0.089
    const HIP_Y = 0.92
    const legDrop = (hip: number, knee: number) =>
      THIGH * Math.cos(hip) + SHIN * Math.cos(hip + knee)
    // 御云时是把身体整个放低：坐着的话胯要落在云面上，
    // 而不是保持站立高度、两腿悬在云里。
    const stanceTarget = walker.flying
      ? -0.7
      : Math.max(legDrop(pose.hipL, pose.kneeL), legDrop(pose.hipR, pose.kneeR)) +
        ANKLE_TO_SOLE -
        HIP_Y +
        FOOT_GROUND
    // 下限保护：两条腿同时弯曲时身体会很低，别让鞋底穿进路面。
    // 御云时不受这条限制——那是故意坐到云面以下的高度。
    stance.current = damp(stance.current, walker.flying ? stanceTarget : Math.max(stanceTarget, -0.035), 22)

    if (hipL.current) {
      hipL.current.rotation.x = pose.hipL
      hipL.current.rotation.z = 0.03
    }
    if (hipR.current) {
      hipR.current.rotation.x = pose.hipR
      hipR.current.rotation.z = -0.03
    }
    if (kneeL.current) kneeL.current.rotation.x = pose.kneeL
    if (kneeR.current) kneeR.current.rotation.x = pose.kneeR
    if (ankleL.current) ankleL.current.rotation.x = pose.ankleL
    if (ankleR.current) ankleR.current.rotation.x = pose.ankleR
    if (armL.current) {
      armL.current.rotation.x = pose.armL
      armL.current.rotation.z = pose.spreadL
    }
    if (armR.current) {
      armR.current.rotation.x = pose.armR
      armR.current.rotation.z = pose.spreadR
    }
    if (elbowL.current) elbowL.current.rotation.x = pose.elbowL
    if (elbowR.current) elbowR.current.rotation.x = pose.elbowR
    if (body.current) body.current.position.y = BODY_BASE + pose.bob + stance.current
    if (lean.current) {
      // 前倾/摆动都以髋部为轴：以脚为轴的话人物会整块甩出去
      lean.current.rotation.x = pose.lean
      lean.current.rotation.z = THREE.MathUtils.damp(
        lean.current.rotation.z,
        Math.sin(p) * 0.026 * walkAmount,
        10,
        dt,
      )
      // 走路时上半身轻微反向扭动，动作不再是整体一块
      lean.current.rotation.y = THREE.MathUtils.damp(
        lean.current.rotation.y,
        -Math.sin(p) * 0.06 * walkAmount,
        10,
        dt,
      )
    }
    if (head.current) {
      // 头保持朝前，抵消躯干扭动与摆动，视线稳定
      head.current.rotation.y = THREE.MathUtils.damp(
        head.current.rotation.y,
        Math.sin(p) * 0.04 * walkAmount,
        10,
        dt,
      )
      head.current.rotation.x = THREE.MathUtils.damp(
        head.current.rotation.x,
        -pose.lean * 0.55 + Math.sin(p * 2) * 0.01 * walkAmount,
        10,
        dt,
      )
      head.current.rotation.z = THREE.MathUtils.damp(
        head.current.rotation.z,
        -Math.sin(p) * 0.02 * walkAmount,
        10,
        dt,
      )
    }

    // ---------- 摄像机 ----------
    walker.camDist = damp(walker.camDist, walker.camTarget, 7)
    const dist = walker.camDist
    const far = !interior && dist > 22
    const shoulder = far ? 0 : 0.34
    overviewBlend.current = damp(overviewBlend.current, walker.overview ? 1 : 0, 4.5)
    pivot.current.set(
      walker.position.x + right.current.x * shoulder,
      walker.position.y + PIVOT_HEIGHT + (far ? Math.min(dist * 0.08, 8) : 0),
      walker.position.z + right.current.z * shoulder,
    )
    // 总览时把镜头支点平滑拉回城市中心，保证整座城落在画面里。
    if (overviewBlend.current > 0.001) {
      overviewCenter.current.set(0, 8, 0)
      pivot.current.lerp(overviewCenter.current, overviewBlend.current * 0.92)
    }
    const cosPitch = Math.cos(walker.pitch)
    desired.current.set(
      pivot.current.x + Math.sin(walker.yaw) * cosPitch * dist,
      pivot.current.y + Math.sin(walker.pitch) * dist + 0.2,
      pivot.current.z + Math.cos(walker.yaw) * cosPitch * dist,
    )
    desired.current.y = Math.max(0.7, desired.current.y)

    // 片头运镜：缓慢环绕，进入城市后立即交还玩家镜头。
    // 这里不做过渡：切场景时镜头必须是"切过去"，不能扫一段。
    // 必须叠加在常规机位之上，否则紧随其后的 desired.set 会把它覆盖掉。
    introBlend.current = app.screen === 'intro' ? 1 : 0
    const intro = introBlend.current
    if (intro > 0.5) {
      introLock.current = true
    } else if (introLock.current) {
      // 片头结束的那一帧直接把镜头钉到玩家机位，避免一段扫镜。
      introLock.current = false
      camReady.current = false
    }
    if (intro > 0.001) {
      const a = state.clock.elapsedTime * 0.03 + 0.9
      const radius = 206
      introCam.current.set(
        Math.sin(a) * radius,
        92 + Math.sin(a * 0.7) * 7,
        Math.cos(a) * radius,
      )
      desired.current.lerp(introCam.current, intro)
    }

    // ---------- 片头 → 城市的入城运镜 ----------
    // 点"进入城市"时只记了时间戳，这里在第一帧抓住当时的机位，
    // 之后一路绕主角俯冲落到身后。开始时必须抓"当前屏幕上的机位"，
    // 从逻辑机位起算会先跳一下再飞。
    const flyState = fly.current
    if (flyState.active && interior) {
      // 万一在飞行途中进了室内，立刻收手，别把高空机位带进房间
      flyState.active = false
      walker.flyInStart = 0
    }
    if (walker.flyInStart > 0 && !flyState.active && !interior) {
      const elapsed = performance.now() - walker.flyInStart
      if (elapsed > 4000 || prefersReducedMotion()) {
        walker.flyInStart = 0
      } else {
        flyState.active = true
        flyState.start = walker.flyInStart
        flyState.from.setFromVector3(flyVec.current.copy(camera.position).sub(pivot.current))
        flyState.fromLook.copy(target.current)
      }
    }

    const ray = desired.current.clone().sub(pivot.current)
    let nearest = 1
    // 片头机位在城市外围，做墙体避让只会把镜头拽回地面。
    if (!far && intro < 0.02 && !flyState.active) {
      for (const collider of colliders) {
        if (collider.camera === false) continue
        const hit = segmentBox(pivot.current, ray, collider)
        if (hit !== null && hit > 0 && hit < nearest) nearest = hit
      }
    }
    const blockedByWall = nearest < 1
    if (blockedByWall) {
      // 停在墙前 0.6m：近裁剪面有 0.45m，只差 4% 的距离时镜头的视锥已经
      // 插进墙里，屏幕上就是"看到楼里面"
      const len = Math.max(ray.length(), 1e-3)
      const keep = Math.max(0.06, nearest - 0.6 / len)
      desired.current.copy(pivot.current).add(ray.multiplyScalar(keep))
    }

    if (!camReady.current) {
      camReady.current = true
      camera.position.copy(desired.current)
    } else if (blockedByWall) {
      camera.position.copy(desired.current)
    } else {
      camera.position.lerp(desired.current, 1 - Math.exp(-18 * dt))
    }
    target.current.copy(pivot.current)
    if (intro > 0.001) {
      introTarget.current.set(0, 6, 0)
      target.current.lerp(introTarget.current, intro)
    }

    // 入城运镜：原点不动、半径与俯仰角一起收，镜头是"绕下来"而不是直线坠落。
    if (flyState.active) {
      const p = THREE.MathUtils.clamp((performance.now() - flyState.start) / FLY_IN_MS, 0, 1)
      // 首尾都静止，用 ease-in-out；没有手势动量就不该回弹。
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      flyState.to.setFromVector3(flyVec.current.copy(desired.current).sub(pivot.current))
      let dTheta = flyState.to.theta - flyState.from.theta
      dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta))
      camera.position
        .setFromSphericalCoords(
          flyState.from.radius + (flyState.to.radius - flyState.from.radius) * e,
          flyState.from.phi + (flyState.to.phi - flyState.from.phi) * e,
          flyState.from.theta + dTheta * e,
        )
        .add(pivot.current)
      // 视线同步从城市中心收到主角身上，交接时和常规机位完全重合。
      target.current.lerpVectors(flyState.fromLook, pivot.current, e)
      if (p >= 1) {
        flyState.active = false
        walker.flyInStart = 0
        camera.position.copy(desired.current)
        target.current.copy(pivot.current)
      }
    }

    camera.lookAt(target.current)
    // 气泡（drei Html）用 matrixWorldInverse 投影，它要等渲染时才刷新；
    // 不在这里立即更新，气泡就总是按上一帧的相机摆位，人一动就抖。
    camera.updateMatrixWorld()

    const perspective = camera as THREE.PerspectiveCamera
    const fovTarget =
      baseFov.current +
      (sprint && walker.speed > 6.4 && !far && intro < 0.02 ? 6 : 0) +
      (walker.overview ? 10 : 0) -
      (far && !walker.overview ? 6 : 0)
    if (!fovReady.current) {
      // 每个场景的 Canvas 初始 fov 不一样，切场景时直接对齐，避免一次轻微推镜。
      fovReady.current = true
      perspective.fov = fovTarget
      perspective.updateProjectionMatrix()
    } else if (Math.abs(perspective.fov - fovTarget) > 0.02) {
      perspective.fov = THREE.MathUtils.damp(perspective.fov, fovTarget, 5, dt)
      perspective.updateProjectionMatrix()
    }

    nearAccumulator.current += dt
    if (nearAccumulator.current > 0.14) {
      nearAccumulator.current = 0
      let best: Interactable | null = null
      let bestDistance = Infinity
      if (!interior && ferris.riding >= 0) best = ferrisExit
      else {
        const dynamic = liveInteractables ? liveInteractables() : null
        const scan = (item: Interactable) => {
          const planar = Math.hypot(item.x - walker.position.x, item.z - walker.position.z)
          const vertical = Math.abs(walker.position.y - (item.y ?? 0))
          // NPC 优先：站在楼门口聊天时，门口的入口点往往比人更近，
          // 按 E 会直接进楼，看起来就是"对话没反应"。给人 3m 的优先度。
          const score = planar - (item.id.startsWith('npc-') ? 3 : 0)
          if (planar < item.radius && vertical < (item.y === undefined ? 12 : 3) && score < bestDistance) {
            best = item
            bestDistance = score
          }
        }
        for (const item of interactables) scan(item)
        if (dynamic) for (const item of dynamic) scan(item)
      }
      app.setNearby(paused ? null : best)
    }

    accumulator.current += dt
    if (accumulator.current > 0.12) {
      accumulator.current = 0
      app.setHud({
        x: walker.position.x,
        y: walker.position.y,
        z: walker.position.z,
        yaw: walker.yaw,
        stamina: 1,
        gliding: walker.gliding,
        flying: walker.flying,
        overview: walker.overview,
        speed: walker.speed,
      })
    }
    // 优先级 -1：先把相机摆好，再让标记气泡（drei Html）按这一帧的相机算位置。
    // 同一优先级时气泡用的是上一帧的相机，人一走动气泡就会跟着抖。
  }, -1)

  return (
    <group
      ref={model}
      userData={{ dynamic: true, noOcclude: true }}
      position={[walker.position.x, 0, walker.position.z]}
    >
      {/* 挡在人前面的东西淡出去，人物永远看得见 */}
      <OcclusionFade />
      <HoverRig visible={flying} />
      <group ref={lean} position={[0, 0.94, 0]}>
        <group ref={body} position={[0, -0.94, 0]}>
          {/* ---------- 腿 ---------- */}
          {[
            { ref: hipL, knee: kneeL, ankle: ankleL, x: -0.098 },
            { ref: hipR, knee: kneeR, ankle: ankleR, x: 0.098 },
          ].map(({ ref, knee, ankle, x }, i) => (
            <group key={i} ref={ref} position={[x, 0.92, 0]}>
              <mesh geometry={thighGeo} material={pantsMat} castShadow />
              <group ref={knee} position={[0, -0.42, 0]}>
                {/* 膝盖：补上大腿与小腿之间的接缝，弯腿时不会看到管口 */}
                <mesh scale={[1, 0.9, 0.95]} material={pantsMat} castShadow>
                  <sphereGeometry args={[0.064, 12, 10]} />
                </mesh>
                <mesh geometry={shinGeo} material={pantsMat} castShadow />
                <group ref={ankle} position={[0, -0.4, 0]}>
                  <mesh geometry={bootGeo} material={bootMat} castShadow />
                  <mesh geometry={bootSoleGeo} material={soleMat} castShadow />
                </group>
              </group>
            </group>
          ))}

          {/* ---------- 髋部 ---------- */}
          <mesh position={[0, 0.95, 0]} scale={[1, 0.78, 0.74]} castShadow material={pantsMat}>
            <sphereGeometry args={[0.176, 20, 16]} />
          </mesh>

          {/* ---------- 躯干 ---------- */}
          <group position={[0, 0.94, 0]}>
            <mesh geometry={torsoGeo} material={coatMat} castShadow receiveShadow />
            {/* 肩部封口：从上方看不到衣服内部的空洞 */}
            <mesh position={[0, 0.568, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.76, 1]}>
              <circleGeometry args={[0.177, 22]} />
              <meshStandardMaterial color={COAT} roughness={0.66} side={THREE.DoubleSide} />
            </mesh>

            {/* 腰带 + AR 扣 */}
            <mesh position={[0, 0.05, 0]} scale={[1, 1, 0.78]} castShadow material={trimMat}>
              <cylinderGeometry args={[0.166, 0.17, 0.06, 20]} />
            </mesh>
            <mesh position={[0, 0.05, 0.132]} material={trimMat}>
              <boxGeometry args={[0.048, 0.028, 0.012]} />
            </mesh>

            {/* 高领 */}
            <mesh position={[0, 0.53, 0]} scale={[1, 1, 0.82]}>
              <cylinderGeometry args={[0.098, 0.112, 0.1, 18, 1, true]} />
              <meshStandardMaterial color={TRIM} roughness={0.66} metalness={0.1} side={THREE.DoubleSide} />
            </mesh>

            {/* 背部深色育克（第三人称镜头正对着背面） */}
            <mesh position={[0, 0.36, 0]} scale={[1, 1, 0.78]}>
              <cylinderGeometry args={[0.214, 0.202, 0.19, 22, 1, true, Math.PI * 0.62, Math.PI * 0.76]} />
              <meshStandardMaterial color={TRIM} roughness={0.7} metalness={0.14} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.41, 0]} scale={[1, 1, 0.78]}>
              <cylinderGeometry args={[0.218, 0.218, 0.012, 22, 1, true, Math.PI * 0.78, Math.PI * 0.44]} />
              <meshStandardMaterial color="#8a97a4" roughness={0.42} metalness={0.3} side={THREE.DoubleSide} />
            </mesh>

            {/* 前襟拉链 */}
            <mesh position={[0, 0.3, 0.152]} material={trimMat}>
              <boxGeometry args={[0.01, 0.42, 0.006]} />
            </mesh>

            {/* 兜帽：收在颈后的一圈软边，剪影上立刻有"衣领" */}
            <mesh position={[0, 0.5, -0.055]} rotation={[0.5, 0, 0]} scale={[1, 0.62, 0.8]} castShadow>
              <torusGeometry args={[0.098, 0.038, 8, 20, Math.PI * 1.35]} />
              <meshStandardMaterial color={COAT_SHADE} roughness={0.8} metalness={0.02} />
            </mesh>

            {/* ---------- 手臂 ---------- */}
            {[
              { ref: armL, elbow: elbowL, x: -0.196 },
              { ref: armR, elbow: elbowR, x: 0.196 },
            ].map(({ ref, elbow, x }, i) => (
              <group key={i} ref={ref} position={[x, 0.45, 0]}>
                {/* 肩 */}
                <mesh scale={[1, 0.9, 0.9]} castShadow material={coatMat}>
                  <sphereGeometry args={[0.068, 14, 12]} />
                </mesh>
                {/* 上臂 */}
                <mesh position={[0, -0.12, 0]} castShadow material={coatMat}>
                  <capsuleGeometry args={[0.055, 0.15, 4, 12]} />
                </mesh>
                <group ref={elbow} position={[0, -0.245, 0]}>
                  {/* 前臂：略收窄，袖口处带一圈 AR 光 */}
                  <mesh position={[0, -0.1, 0]} castShadow material={coatShadeMat}>
                    <capsuleGeometry args={[0.045, 0.13, 4, 12]} />
                  </mesh>
                  <mesh position={[0, -0.055, 0]} material={trimMat}>
                    <cylinderGeometry args={[0.048, 0.048, 0.012, 14, 1, true]} />
                  </mesh>
                  {/* 手套 */}
                  <mesh position={[0, -0.2, 0]} scale={[1, 1.1, 0.85]} castShadow material={trimMat}>
                    <sphereGeometry args={[0.05, 12, 10]} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>

          {/* ---------- 颈 + 头 ---------- */}
          <mesh position={[0, 1.47, 0]} material={skinShadeMat} castShadow>
            <cylinderGeometry args={[0.045, 0.05, 0.09, 12]} />
          </mesh>
          <group ref={head} position={[0, 1.52, 0]}>
            {/* 颅骨 */}
            <mesh position={[0, 0.105, 0]} scale={[0.93, 1.05, 0.97]} castShadow material={skinMat}>
              <sphereGeometry args={[0.099, 22, 18]} />
            </mesh>
            {/* 下颌：比单纯一个球更有脸型 */}
            <mesh position={[0, 0.045, 0.022]} scale={[0.8, 0.66, 0.82]} castShadow material={skinMat}>
              <sphereGeometry args={[0.086, 18, 14]} />
            </mesh>
            {/* 头发：贴着头顶的一层，前额留刘海 */}
            <mesh position={[0, 0.112, -0.006]} rotation={[0.05, 0, 0]} castShadow material={hairMat}>
              <sphereGeometry args={[0.105, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            </mesh>
            <mesh position={[0, 0.15, 0.048]} rotation={[0.3, 0, 0]} castShadow material={hairMat}>
              <boxGeometry args={[0.138, 0.05, 0.08]} />
            </mesh>
            {/* 耳朵 */}
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.094, 0.088, 0.004]} scale={[0.42, 0.9, 0.7]} material={skinMat}>
                <sphereGeometry args={[0.03, 8, 8]} />
              </mesh>
            ))}
            {/* 眼睛 + 眉 */}
            {[-1, 1].map((side) => (
              <group key={side}>
                <mesh position={[side * 0.038, 0.108, 0.092]} scale={[1, 0.72, 0.6]}>
                  <sphereGeometry args={[0.0125, 10, 8]} />
                  <meshStandardMaterial color="#201c19" roughness={0.32} />
                </mesh>
                <mesh position={[side * 0.038, 0.132, 0.09]} rotation={[0, 0, side * 0.12]} material={hairMat}>
                  <boxGeometry args={[0.032, 0.007, 0.01]} />
                </mesh>
              </group>
            ))}
            {/* 鼻 */}
            <mesh position={[0, 0.082, 0.098]} scale={[0.7, 0.9, 0.9]} material={skinMat}>
              <sphereGeometry args={[0.016, 10, 8]} />
            </mesh>
          </group>

        </group>
      </group>
    </group>
  )
}
