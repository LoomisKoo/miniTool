import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { walker } from '../game/walker'

/**
 * 路灯照明。
 *
 * 1. 近处：固定 POOL 盏真实聚光灯，挪到离玩家最近的灯头下，真的照亮地面、墙、车和人。
 * 2. 远处：真实光源够不着的灯，用地面光斑（按物理照度曲线、乘在地面原色上）代替；光斑在真实灯光接手的
 *    距离内淡出，两者交接处看不出切换。
 * 3. 每盏灯下一道很淡的光锥，模拟夜里空气中的散射。
 *
 * 白天也挂着，只把亮度降到 0：灯的数量一变，全场材质都要重新编译，
 * 昼夜切换就会卡一下。
 */

const POOL = 12
/** 灯头相对灯杆的位置（Props.Lamp：横臂朝 +x）。 */
const HEAD_X = 0.98
const HEAD_Y = 4.75
/** 真实光源：这个距离以内全亮，往外渐隐到 FAR 熄灭。 */
const NEAR = 34
const FAR = 58
/** decay 2 下灯下照度 = I / h²（≈ I / 22.6）。 */
// 以前给到 80：灯下照度约 3.5，叠上光斑和曝光 1.85，整块人行道直接
// 烧成白纸，旁边的树冠因为一点都没被照到反而纯黑。现在灯下只比环境亮
// 一倍多，靠光斑的柔和衰减拉开层次。
const INTENSITY = 38

/** 地面光斑的半径（米）：铺满整条街，两盏灯之间不留黑带。 */
const POOL_R = 46

/**
 * 超过这个距离的灯头不再铺光斑 / 光锥。
 *
 * 一块光斑是 92m 见方的平面，几十盏灯的平面在屏幕上大面积重叠，片元着色器
 * 还要逐像素算 pow/smoothstep —— 夜里真正贵的是这份填充，不是三角面。
 * 但 150m 以外的光斑贡献已经只剩 bounce 项的百分之一（照度按 1/d² 掉），
 * 零缩放之后既没有像素也没有可见变化。
 */
const POOL_CUT = 150
const CONE_CUT = 120

/* 距离相关的淡出必须逐像素算。
   光斑是一块 92m 见方的平面，只有四个顶点：以前在顶点着色器里算
   "到玩家的距离"，插值出来就是一条斜着横穿路面的线性渐变，那条明暗
   分界线还会跟着人物走——看起来就是"路面的光影被切开、切割位置会变"。
   现在只把世界坐标传给片元，距离、雾、交接全在片元里算，边界是圆的、
   稳定的。 */
const poolVertex = /* glsl */ `
  attribute float aSeed;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
/*
 * 输出的是"额外照度 / 环境照度"的比值 L，配合 dst * (1 + L) 的乘法混合：
 * 最终 = 地面原色 × (环境光 + 路灯)。深色沥青只被照亮一点，浅色铺装亮得多，
 * 和真实光照一致；加法混合则是不管底色一律叠一层光，看起来像贴纸。
 */
const poolFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vSeed;
  uniform vec3 uPlayer;
  uniform float uNear;
  uniform float uFar;
  uniform float uOn;
  uniform vec3 uColor;
  uniform float uRadius;
  uniform float uHeight;
  uniform float uGain;
  uniform float uBounce;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float rm = r * uRadius;
    // 点光源照在水平面上的照度：E = I·cosθ / d² = I·h / (h² + r²)^1.5，归一化到灯下 = 1。
    // 这条曲线天然没有边界，从灯下一直平滑衰减到远处。
    float h2 = uHeight * uHeight;
    float E = pow(h2 / (h2 + rm * rm), 1.5);
    // 空气散射 + 地面/墙面互相反弹：衰减很慢，把两盏灯之间的路面和巷口连起来
    float bounce = uBounce / (1.0 + rm * rm / 1500.0);
    float L = uGain * E + bounce;
    // 贴片边缘软收，衰减到这里本来就只剩很少，看不出边界
    L *= 1.0 - smoothstep(0.72, 1.0, r);
    // 真实光源接手的那段距离里光斑淡出（逐像素，边界是圆的）
    L *= smoothstep(uNear * 0.7, uFar, distance(vWorld.xz, uPlayer.xz)) * (0.85 + vSeed * 0.3);
    // 远处地面已经被雾吃掉，乘上去会把雾也照亮
    L *= 1.0 - smoothstep(180.0, 420.0, distance(vWorld, cameraPosition));
    gl_FragColor = vec4(uColor * L * uOn, 1.0);
  }
`

const coneVertex = /* glsl */ `
  varying float vH;
  varying float vRim;
  void main() {
    vH = uv.y;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vec3 v = normalize(cameraPosition - world.xyz);
    // 侧面朝向视线时最亮，边缘（掠射）淡出，看起来是一团体积而不是一个锥壳
    vRim = abs(dot(n, v));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const coneFragment = /* glsl */ `
  varying float vH;
  varying float vRim;
  uniform float uOn;
  uniform vec3 uColor;
  void main() {
    float a = pow(vH, 1.6) * pow(vRim, 1.5) * 0.07 * uOn;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`

export function StreetLights({ lamps, night }: { lamps: Array<[number, number]>; night: boolean }) {
  const lights = useRef<Array<THREE.SpotLight | null>>([])
  const targets = useMemo(() => Array.from({ length: POOL }, () => new THREE.Object3D()), [])
  const assigned = useRef<number[]>(Array.from({ length: POOL }, () => -1))
  const timer = useRef(1)
  const on = useRef(night ? 1 : 0)
  /** 每盏灯的光斑/光锥当前是否还在实例矩阵里（远处是零缩放）。 */
  const shown = useRef<{ pool: boolean[]; cone: boolean[] }>({ pool: [], cone: [] })

  useEffect(() => {
    lights.current.forEach((light, i) => {
      if (light) light.target = targets[i]
    })
  }, [targets])

  const { pools, cones, poolMat, coneMat, base, hidden } = useMemo(() => {
    // LED 路灯：接近中性的白，只带一点点暖
    const color = new THREE.Color('#fff6ea')
    const poolMat = new THREE.ShaderMaterial({
      vertexShader: poolVertex,
      fragmentShader: poolFragment,
      uniforms: {
        uPlayer: { value: new THREE.Vector3() },
        uNear: { value: NEAR },
        uFar: { value: FAR },
        uOn: { value: 0 },
        uColor: { value: color },
        uRadius: { value: POOL_R },
        uHeight: { value: HEAD_Y },
        // 灯下最多把地面提亮一倍多：再高就是一块过曝的白斑，
        // 而且整片地面越过 Bloom 阈值，连光晕一起糊开。
        uGain: { value: 1.05 },
        // 空气散射要比物理点光源衰减得更慢，才接得住两盏灯之间的路面；
        // 夜里没有灯照的街面靠这一层底光 + 地面的自发光保持连续
        uBounce: { value: 0.26 },
      },
      transparent: true,
      depthWrite: false,
      // dst * (1 + src)：路灯照度乘在地面原色上，而不是叠一层光
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.OneFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
    const coneMat = new THREE.ShaderMaterial({
      vertexShader: coneVertex,
      fragmentShader: coneFragment,
      uniforms: { uOn: { value: 0 }, uColor: { value: color } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })

    const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const seeds = new Float32Array(lamps.length)
    const pools = new THREE.InstancedMesh(poolGeo, poolMat, lamps.length)
    const coneGeo = new THREE.CylinderGeometry(0.16, 2.4, HEAD_Y - 0.1, 24, 1, true)
    coneGeo.translate(0, (HEAD_Y - 0.1) / 2, 0)
    const cones = new THREE.InstancedMesh(coneGeo, coneMat, lamps.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const base = lamps.map(([x, z], i) => {
      seeds[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1
      // 抬到路缘石（6cm）之上，否则人行道会把光斑挡掉
      p.set(x + HEAD_X, 0.075, z)
      s.set(POOL_R * 2, 1, POOL_R * 2)
      const pool = m.compose(p, q, s).clone()
      p.set(x + HEAD_X, 0, z)
      s.set(1, 1, 1)
      const cone = m.compose(p, q, s).clone()
      return { pool, cone }
    })
    const hidden = m.compose(p.set(0, -100, 0), q, s.set(0, 0, 0))
    base.forEach(({ pool, cone }, i) => {
      pools.setMatrixAt(i, pool)
      cones.setMatrixAt(i, cone)
    })
    poolGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds.map(Math.abs), 1))
    // 每盏灯的光斑会随玩家移动在"有/无"之间切换，矩阵是逐帧可写的
    pools.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    cones.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    pools.frustumCulled = false
    cones.frustumCulled = false
    pools.renderOrder = 2
    cones.renderOrder = 3
    pools.userData.noGhost = true
    cones.userData.noGhost = true
    return { pools, cones, poolMat, coneMat, base, hidden }
  }, [lamps])

  useEffect(
    () => () => {
      pools.geometry.dispose()
      cones.geometry.dispose()
      poolMat.dispose()
      coneMat.dispose()
    },
    [pools, cones, poolMat, coneMat],
  )

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    on.current = THREE.MathUtils.damp(on.current, night ? 1 : 0, 3, dt)
    poolMat.uniforms.uOn.value = on.current
    coneMat.uniforms.uOn.value = on.current
    poolMat.uniforms.uPlayer.value.copy(walker.position)
    pools.visible = on.current > 0.01
    cones.visible = on.current > 0.01

    timer.current += dt
    if (timer.current > 0.25) {
      timer.current = 0
      const px = walker.position.x
      const pz = walker.position.z

      // 远处的光斑/光锥零缩放：它们本来就在 150m 外只剩不到 1% 的贡献，
      // 但每块 92m 见方的平面仍要过一遍片元着色器。只有开关状态变了才写矩阵。
      const state = shown.current
      if (state.pool.length !== base.length) {
        state.pool = base.map(() => true)
        state.cone = base.map(() => true)
      }
      let poolDirty = false
      let coneDirty = false
      for (let i = 0; i < base.length; i++) {
        const [lx, lz] = lamps[i]
        const d = Math.hypot(lx + HEAD_X - px, lz - pz)
        const poolWanted = d < POOL_CUT
        if (poolWanted !== state.pool[i]) {
          state.pool[i] = poolWanted
          pools.setMatrixAt(i, poolWanted ? base[i].pool : hidden)
          poolDirty = true
        }
        const coneWanted = d < CONE_CUT
        if (coneWanted !== state.cone[i]) {
          state.cone[i] = coneWanted
          cones.setMatrixAt(i, coneWanted ? base[i].cone : hidden)
          coneDirty = true
        }
      }
      if (poolDirty) pools.instanceMatrix.needsUpdate = true
      if (coneDirty) cones.instanceMatrix.needsUpdate = true

      const order = lamps
        .map(([x, z], i) => ({ i, d: Math.hypot(x + HEAD_X - px, z - pz) }))
        .filter((e) => e.d < FAR)
        .sort((a, b) => a.d - b.d)
        .slice(0, POOL)
        .map((e) => e.i)
      // 已经在亮的灯尽量留在原槽位，只把空出来的槽位分给新灯
      const keep = new Set(order)
      const next = assigned.current.map((i) => (keep.has(i) ? i : -1))
      for (const i of order) {
        if (next.includes(i)) continue
        const slot = next.indexOf(-1)
        if (slot >= 0) next[slot] = i
      }
      assigned.current = next
    }

    const px = walker.position.x
    const pz = walker.position.z
    lights.current.forEach((light, slot) => {
      if (!light) return
      const i = assigned.current[slot]
      if (i < 0 || on.current < 0.01) {
        light.intensity = THREE.MathUtils.damp(light.intensity, 0, 6, dt)
        return
      }
      const [x, z] = lamps[i]
      const hx = x + HEAD_X
      if (light.position.x !== hx || light.position.z !== z) {
        // 换灯：先熄到 0 再搬，避免一盏亮灯瞬移
        if (light.intensity > 1) {
          light.intensity = THREE.MathUtils.damp(light.intensity, 0, 14, dt)
          return
        }
        light.position.set(hx, HEAD_Y, z)
        targets[slot].position.set(hx, 0, z)
        targets[slot].updateMatrixWorld()
      }
      const d = Math.hypot(hx - px, z - pz)
      const k = 1 - THREE.MathUtils.smoothstep(d, NEAR, FAR)
      light.intensity = THREE.MathUtils.damp(light.intensity, INTENSITY * k * on.current, 5, dt)
    })
  })

  return (
    <group userData={{ dynamic: true }}>
      {targets.map((t, i) => (
        <primitive key={`t${i}`} object={t} />
      ))}
      {Array.from({ length: POOL }, (_, i) => (
        <spotLight
          key={i}
          ref={(el) => (lights.current[i] = el)}
          position={[0, -50, 0]}
          color="#fff6ea"
          intensity={0}
          // 物理衰减：decay 2 + 不截断（distance 0），和远处光斑用的是同一条
          // h/(h²+r²)^1.5 曲线，交接处看不出切换。
          // 角度开到接近 90°，锥角边缘落在很远处，不会切出硬边。
          distance={0}
          angle={1.5}
          penumbra={1}
          decay={2}
        />
      ))}
      <primitive object={pools} />
      <primitive object={cones} />
    </group>
  )
}
