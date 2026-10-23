import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useApp } from '../store'
import { makeCloudTexture } from './textures'
import { keys, resetWalker, walker } from '../game/walker'
import { hitsDynamic, pushOut } from '../game/bodies'

export type Collider = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY?: number
  maxY?: number
  walk?: boolean
  camera?: boolean
}

export type Interactable = {
  id: string
  label: string
  hint: string
  x: number
  z: number
  radius: number
  action: () => void
}

type Props = {
  start?: [number, number]
  startYaw?: number
  colliders?: Collider[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  interactables: Interactable[]
  cameraDistance?: number
  interior?: boolean
}

const PLAYER_RADIUS = 0.42
const CAM_MIN = 2.6
const CAM_MAX = 210
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
    // 只有"楼"级别的体量才当支撑面：家具、这类的体量站不上去
    if (c.maxX - c.minX < 4 || c.maxZ - c.minZ < 4) continue
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

/** 云絮贴图：一张柔边圆点，聚成一团就是积云。
    球体拼出来的"云"总有一圈硬接缝和玻璃感，Sprite 反而更像水汽。 */
let cloudTextureCache: THREE.Texture | null = null
function cloudTexture() {
  if (!cloudTextureCache) cloudTextureCache = makeCloudTexture()
  return cloudTextureCache
}

/** 筋斗云：脚下托着一朵云，飞行时身后拖出一串逐渐变淡的云絮。 */
const CLOUD_SCALE = 0.74
/** 云心高度：云的顶面要盖过脚踝，脚才是"陷进云里"而不是"站在云上"。
    贴得太高会像踩在一块悬空的板子上，所以整体压低一点。 */
const CLOUD_Y = -0.02
/** 角色前倾时脚会往后上方走，云要跟着脚走，否则一定会穿帮。 */
const FOOT_PIVOT = 0.94
const TRAIL_LENGTH = 8
const TRAIL_INTERVAL = 0.035
/** [x, y, z, 尺寸]：中间大、四周小，压扁之后是云的轮廓。 */
const CLOUD_PUFFS: Array<[number, number, number, number]> = [
  [0, 0.1, 0, 1.95],
  [0.82, -0.02, 0.14, 1.42],
  [-0.8, 0.0, -0.1, 1.36],
  [0.34, 0.26, -0.44, 1.18],
  [-0.32, 0.28, 0.44, 1.14],
  [0.04, -0.14, 0.04, 1.78],
  [1.26, -0.04, -0.06, 0.96],
  [-1.24, -0.02, 0.08, 0.94],
  [0.02, 0.42, 0.02, 1.0],
  [-0.6, 0.18, 0.58, 0.9],
  [0.58, 0.16, 0.54, 0.92],
  // 往脚踝上包的低云絮：从侧面看脚是"埋"进云里的
  [0.24, 0.34, 0.2, 0.86],
  [-0.26, 0.32, -0.16, 0.82],
  // 云底再垫两片大一点的：镜头从下往上看时，脚底被这层挡住
  [0.0, -0.24, -0.02, 1.5],
  [0.5, -0.16, 0.18, 1.05],
  [-0.52, -0.14, -0.14, 1.0],
]

function HoverRig({ visible }: { visible: boolean }) {
  const group = useRef<THREE.Group>(null)
  const trail = useRef<THREE.Group>(null)
  const puffs = useRef<Array<THREE.Sprite | null>>([])
  const wisps = useRef<Array<THREE.Sprite | null>>([])
  const anchor = useRef(new THREE.Vector3())
  const history = useRef(
    Array.from({ length: TRAIL_LENGTH }, () => new THREE.Vector3(0, -999, 0)),
  )
  const timer = useRef(0)
  const local = useMemo(() => new THREE.Vector3(), [])
  const tex = useMemo(cloudTexture, [])

  // 每块云絮单独一份材质：底部偏冷、顶部纯白。
  // 全用纯白的话不管怎么摆都会像一团棉花糖，有明暗层次才看得出体积。
  const cloudMats = useMemo(
    () =>
      CLOUD_PUFFS.map(([, py]) => {
        const shade = THREE.MathUtils.clamp((py + 0.18) / 0.56, 0, 1)
        const color = new THREE.Color('#bcdff4').lerp(new THREE.Color('#ffffff'), shade)
        return new THREE.SpriteMaterial({
          map: tex,
          color,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          toneMapped: false,
        })
      }),
    [tex],
  )

  // 拖尾每片要有自己的透明度，所以各自一份材质。
  const wispMats = useMemo(
    () =>
      Array.from(
        { length: TRAIL_LENGTH },
        () =>
          new THREE.SpriteMaterial({
            map: tex,
            color: '#eaf7ff',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    [tex],
  )

  useEffect(
    () => () => {
      cloudMats.forEach((mat) => mat.dispose())
      wispMats.forEach((mat) => mat.dispose())
    },
    [cloudMats, wispMats],
  )

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const t = state.clock.elapsedTime
    // store 里的 hud 每 0.12 秒才同步一次，用它会出现"已经起飞了云还没出来"。
    const active = visible || walker.flying
    const node = group.current
    if (!node) return

    node.visible = active
    // 云跟着脚走：身体前倾时脚向后上方移动，云也要同步平移，
    // 否则速度一快（倾角最大 0.76rad）脚就会从云里露出来。
    const lean = pose.lean
    node.position.set(
      0,
      FOOT_PIVOT * (1 - Math.cos(lean)) * 0.7 + Math.sin(t * 1.9) * 0.04 - 0.02,
      -FOOT_PIVOT * Math.sin(lean) * 0.92,
    )

    // 云的尺寸是恒定的：离地高低不影响体积，否则"贴地时变小"看起来像在缩水。
    // 起飞阶段只做透明度淡入，空间尺寸全程不变。
    const reveal = THREE.MathUtils.clamp(walker.position.y / 0.4, 0, 1)

    // 云朵缓慢起伏：每块云絮按各自相位漂一点，静止时也不会像一块死贴图。
    for (let i = 0; i < CLOUD_PUFFS.length; i++) {
      const sprite = puffs.current[i]
      if (!sprite) continue
      const [px, py, pz, size] = CLOUD_PUFFS[i]
      const phase = i * 1.7
      sprite.position.set(
        (px + Math.sin(t * 0.9 + phase) * 0.05) * CLOUD_SCALE,
        CLOUD_Y + (py + Math.sin(t * 1.4 + phase) * 0.04) * CLOUD_SCALE,
        (pz + Math.cos(t * 0.8 + phase) * 0.045) * CLOUD_SCALE,
      )
      // 横向更宽、纵向压扁：这是"云"而不是"球"的关键
      sprite.scale.set(size * 1.26 * CLOUD_SCALE, size * 0.7 * CLOUD_SCALE, 1)
    }

    // 淡入只改材质透明度，不改尺寸
    for (const mat of cloudMats) mat.opacity = 0.95 * reveal

    // ---------- 拖尾 ----------
    const trailGroup = trail.current
    if (!trailGroup) return
    node.getWorldPosition(anchor.current)
    timer.current += dt
    if (timer.current >= TRAIL_INTERVAL) {
      timer.current = 0
      for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
        history.current[i].copy(history.current[i - 1])
      }
      history.current[0].copy(anchor.current)
    }

    const speed = THREE.MathUtils.clamp(walker.speed / 4, 0, 1)
    const show = active && speed > 0.06 && reveal > 0.9
    trailGroup.visible = show
    if (!show) return

    // 拖尾留在世界空间里：转身的时候云絮不会跟着甩成一条直线。
    trailGroup.updateWorldMatrix(true, false)
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const sprite = wisps.current[i]
      const past = history.current[i]
      if (!sprite) continue
      if (past.y < -100) {
        sprite.visible = false
        continue
      }
      local.copy(past)
      trailGroup.worldToLocal(local)
      const age = i / (TRAIL_LENGTH - 1)
      const fade = 1 - age
      sprite.visible = true
      sprite.position.set(
        local.x + Math.sin(age * 9 + t * 2.2) * 0.08 * age,
        local.y - 0.02 - age * 0.12,
        local.z + Math.cos(age * 8 + t * 1.9) * 0.08 * age,
      )
      // 拖尾只是"云的余韵"：比云小一圈，越远越小
      const size = (0.62 - fade * 0.28) * (0.75 + speed * 0.4)
      sprite.scale.set(size * 1.3, size * 0.7, 1)
      const mat = sprite.material as THREE.SpriteMaterial
      mat.opacity = Math.pow(fade, 1.8) * (0.16 + speed * 0.26)
    }
  })

  return (
    <group ref={group} visible={visible}>
      {CLOUD_PUFFS.map(([, , , size], i) => (
        <sprite
          key={i}
          ref={(el) => {
            puffs.current[i] = el
          }}
          material={cloudMats[i]}
          scale={[size * 1.26 * CLOUD_SCALE, size * 0.7 * CLOUD_SCALE, 1]}
        />
      ))}

      {/* 云底的一点冷光：只照亮云本身，不要把人打成蓝色发光体 */}
      <pointLight position={[0, 0.02, 0]} color="#9fdcff" intensity={0.9} distance={2.6} decay={2} />

      <group ref={trail}>
        {Array.from({ length: TRAIL_LENGTH }).map((_, i) => (
          <sprite
            key={i}
            ref={(el) => {
              wisps.current[i] = el
            }}
            material={wispMats[i]}
            visible={false}
          />
        ))}
      </group>
    </group>
  )
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

export function PlayerRig({
  start,
  startYaw = 0,
  colliders = [],
  bounds,
  interactables,
  cameraDistance = 5.6,
  interior = false,
}: Props) {
  const { camera } = useThree()
  const flying = useApp((state) => state.hud.flying)
  const model = useRef<THREE.Group>(null)
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
  const baseFov = useRef(62)
  const desired = useRef(new THREE.Vector3())
  const overviewBlend = useRef(0)
  const overviewCenter = useRef(new THREE.Vector3())
  // 片头运镜：把城市当主角，缓慢环绕。离开片头后 3 秒内平滑交还给玩家镜头。
  const introBlend = useRef(1)
  const introCam = useRef(new THREE.Vector3())
  const introTarget = useRef(new THREE.Vector3())
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
    if (start) resetWalker(start[0], start[1], startYaw, 0.24)
    else walker.pitch = 0.24
    keys.clear()
    walker.camDist = cameraDistance
    walker.camTarget = cameraDistance
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
      event.preventDefault()
      // 按 deltaY 连续缩放：传统滚轮一格约 1.09 倍，触控板则是细密的小步，
      // 单次事件最大不超过 1.12 倍，避免一搓就到总览。
      const raw = THREE.MathUtils.clamp(event.deltaY * 0.0009, -0.12, 0.12)
      const factor = Math.exp(raw)
      walker.camTarget = THREE.MathUtils.clamp(walker.camTarget * factor, CAM_MIN, CAM_MAX)
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

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const app = useApp.getState()
    const paused = app.panel !== null || app.screen === 'intro'
    if (interior) {
      walker.flying = false
      walker.overview = false
      walker.camTarget = THREE.MathUtils.clamp(walker.camTarget, CAM_MIN, 26)
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

    if (!paused) {
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
      // 飞行：速度越快身体越前倾、手臂越向后掠；悬停时几乎是直立漂浮
      const t = state.clock.elapsedTime
      const rush = THREE.MathUtils.clamp(walker.speed / 26, 0, 1)
      const flutter = Math.sin(t * 2.6) * 0.045
      hipLTarget = -0.12 - rush * 0.2 + flutter
      hipRTarget = -0.16 - rush * 0.2 - flutter
      kneeLTarget = 0.24 + rush * 0.14
      kneeRTarget = 0.3 + rush * 0.16
      ankleLTarget = 0.16
      ankleRTarget = 0.2
      armLTarget = -0.16 - rush * 0.44 - flutter * 0.5
      armRTarget = -0.16 - rush * 0.44 + flutter * 0.5
      spreadL = -0.22 - rush * 0.16
      spreadR = 0.22 + rush * 0.16
      elbowLTarget = 0.24 + rush * 0.1
      elbowRTarget = 0.24 + rush * 0.1
      leanTarget = 0.14 + rush * 0.62
      bobTarget = Math.sin(t * 2.2) * 0.02
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
    const stanceTarget = walker.flying
      ? 0
      : Math.max(legDrop(pose.hipL, pose.kneeL), legDrop(pose.hipR, pose.kneeR)) +
        ANKLE_TO_SOLE -
        HIP_Y +
        FOOT_GROUND
    // 下限保护：两条腿同时弯曲时身体会很低，别让鞋底穿进路面。
    stance.current = damp(stance.current, Math.max(stanceTarget, -0.035), 22)

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
    const far = dist > 22
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

    // 片头运镜：缓慢环绕，进入城市后几秒内平滑交还玩家镜头。
    // 必须叠加在常规机位之上，否则紧随其后的 desired.set 会把它覆盖掉。
    introBlend.current = damp(introBlend.current, app.screen === 'intro' ? 1 : 0, 3.4)
    const intro = introBlend.current
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

    const ray = desired.current.clone().sub(pivot.current)
    let nearest = 1
    // 片头机位在城市外围，做墙体避让只会把镜头拽回地面。
    if (!far && intro < 0.02) {
      for (const collider of colliders) {
        if (collider.camera === false) continue
        const hit = segmentBox(pivot.current, ray, collider)
        if (hit !== null && hit > 0 && hit < nearest) nearest = hit
      }
    }
    const blockedByWall = nearest < 1
    if (blockedByWall) {
      desired.current.copy(pivot.current).add(ray.multiplyScalar(Math.max(0.18, nearest - 0.04)))
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
    camera.lookAt(target.current)

    const perspective = camera as THREE.PerspectiveCamera
    const fovTarget =
      baseFov.current +
      (sprint && walker.speed > 6.4 && !far && intro < 0.02 ? 6 : 0) +
      (walker.overview ? 10 : 0) -
      (far && !walker.overview ? 6 : 0)
    if (Math.abs(perspective.fov - fovTarget) > 0.02) {
      perspective.fov = THREE.MathUtils.damp(perspective.fov, fovTarget, 5, dt)
      perspective.updateProjectionMatrix()
    }

    nearAccumulator.current += dt
    if (nearAccumulator.current > 0.14) {
      nearAccumulator.current = 0
      let best: Interactable | null = null
      let bestDistance = Infinity
      for (const item of interactables) {
        const planar = Math.hypot(item.x - walker.position.x, item.z - walker.position.z)
        const vertical = Math.abs(walker.position.y)
        if (planar < item.radius && vertical < 12 && planar < bestDistance) {
          best = item
          bestDistance = planar
        }
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
  })

  return (
    <group ref={model} userData={{ dynamic: true }} position={[walker.position.x, 0, walker.position.z]}>
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
