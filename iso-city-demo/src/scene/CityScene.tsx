import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, Vignette, wrapEffect } from '@react-three/postprocessing'
import { SMAAPreset, type BloomEffect, type SMAAEffect } from 'postprocessing'
import { STYLIZED } from './style'
import * as THREE from 'three'
import { useApp } from '../store'
import { WALK_BOUNDS, ferrisWheel, plazaFountain, river, riverSegments, type BuildingDef } from '../data/city'
import { allBuildings as buildings } from '../data/infill'
import { HUB_Y, boardFerris, boardSpot } from '../game/ferris'
import { launcher, launchFireworks } from '../game/fireworks'
import { npcs } from '../data/npcs'
import { stallVendors } from '../data/npcs'
import { Stalls, stallColliders, stallFront } from './Stalls'
import { ShopFronts } from './ShopFronts'
import { openNow, shops, shopDoor } from '../data/shops'
import { stalls } from '../data/stalls'
import { Npcs } from './Npcs'
import { Fireworks } from './Fireworks'
import { Billboards } from './Billboards'
import { Neon } from './Neon'
import { FacadeDetail } from './FacadeDetail'
import { GradeEffect } from './GradeEffect'
import { JITTER, TaaPass } from './TaaPass'
import { StreetDetail } from './StreetDetail'
import { StreetGate, gateColliders } from './StreetGate'
import { PedestrianStreet, pedestrianColliders } from './PedestrianStreet'
import { NoticeBoard, boardSpot as noticeSpot } from './NoticeBoard'
import { CatalogBooth } from './CatalogBooth'
import { entrancesOfBuilding, floorsOf, isUnitBuilding, unitBuilding, unitsOf } from '../data/units'

import { Building, InfillBuilding } from './Building'
import { FarCity } from './FarCity'
import { RoofProps } from './RoofProps'
import { PerfLog, perfMark } from './PerfLog'
import { Ground } from './Ground'
import { Water } from './Water'
import { Parks, pondColliders } from './Park'
import { FerrisWheel } from './FerrisWheel'
import { PLAZA_STEPS, PlazaSteps } from './BuildingForms'
import { CityProps } from './Props'
import { Greenery } from './Greenery'
import { Traffic } from './Traffic'
import { Transit } from './Transit'
import { Citizens } from './Citizens'
import { WildPets } from '../pets/WildPets'
import { petInteractables } from '../pets/interact'
import { PlayerRig, type Collider, type Interactable } from './PlayerRig'
import { collidersOfBuilding } from './buildingColliders'
import { EntrancePortal, Marker } from './Markers'
import { walker } from '../game/walker'
import { StaticMerge, ScenePrewarm } from './StaticMerge'
import { Stagger, buildQueueIdle } from './buildQueue'
import { QualityTuner } from './QualityTuner'
import { PerfMonitor } from './PerfMonitor'
import { ImageBasedLighting } from './lighting'
import { palettes } from './theme'

type BuildingEntrance = { x: number; z: number; side: 'north' | 'south' | 'east' | 'west' }

/**
 * 命名建筑未必手写了 entranceAt。这里按入口朝向和裙房尺寸推一个门的位置，
 * 让“每栋楼都能进”不需要在 city.ts 里补二十组坐标。
 */
function entranceOf(def: BuildingDef): BuildingEntrance {
  const side = def.entranceSide || def.facing || 'south'
  if (def.entranceAt) return { x: def.entranceAt[0], z: def.entranceAt[1], side }
  const baseW = def.w
  const baseD = def.d
  const out = 0.9
  if (side === 'east') return { x: def.x + baseW / 2 + out, z: def.z, side }
  if (side === 'west') return { x: def.x - baseW / 2 - out, z: def.z, side }
  if (side === 'north') return { x: def.x, z: def.z - baseD / 2 - out, side }
  return { x: def.x, z: def.z + baseD / 2 + out, side }
}

/** 门前的落点：从墙面再往外挪一点，玩家才站在光里而不是墙里。 */
function entranceApproach(def: BuildingDef, entrance: BuildingEntrance): [number, number] {
  const out = 1.4
  if (entrance.side === 'east') return [entrance.x + out, entrance.z]
  if (entrance.side === 'west') return [entrance.x - out, entrance.z]
  if (entrance.side === 'north') return [entrance.x, entrance.z - out]
  return [entrance.x, entrance.z + out]
}

function unitEntranceHint(buildingId: string, cores = 1): string {
  const info = unitBuilding(buildingId)
  if (!info) return '进入楼内'
  const per = Math.round(unitsOf(info) / Math.max(1, cores))
  return info.type === 'corridor'
    ? `进入大堂 · ${floorsOf(info)} 层 · 每层 ${per} 间`
    : `进入大堂 · ${floorsOf(info)} 层 · 一梯 ${per} 户`
}

/** 住宅每个单元一个门：位置来自首层平面里门厅的出口。 */
function unitEntrances(def: BuildingDef) {
  const info = unitBuilding(def.id)
  if (!info) return []
  const list = entrancesOfBuilding(info)
  return list.map((e) => ({
    core: e.hall,
    x: def.x + e.x,
    z: def.z + e.z,
    label: list.length > 1 ? `${def.name} · ${e.hall + 1} 单元` : def.name,
    hint: unitEntranceHint(def.id, list.length),
  }))
}

const NIGHT_SKY_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  // 传世界坐标、在片元里再做 normalize。
  // 以前传的是 normalize(顶点方向)，它在三角面上线性插值：
  // 32×16 的天空球只有 512 个三角形，一颗星被摊在这些面上就会拉成虚线，
  // 面与面之间还有可见的折线——这就是"星星拼接痕迹"。
  // 世界坐标是透视正确插值的，归一化之后每个像素得到的是真实视线方向。
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // 永远画在最远处
}`

const NIGHT_SKY_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// 三维格子取星点。
//
// 之前用立方体投影取二维格子：六个面上的格子是各自独立的，交界处的星星会被
// 切成半颗、密度也会突变，抬头看就是一排拼接缝。直接在三维空间里划格子、
// 星星位置也用三维哈希决定，球面上就没有任何接缝。
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float starLayer(vec3 d, float scale, float density, float seed, float gain) {
  vec3 p = d * scale + seed;
  vec3 id = floor(p);
  vec3 f = fract(p) - 0.5;

  float pick = hash31(id);
  // 多数格子里没有星。不用 early return：fwidth 必须在一致的控制流里求值。
  float exists = step(1.0 - density, pick);

  vec3 off = (vec3(hash31(id + 3.7), hash31(id + 9.1), hash31(id + 17.3)) - 0.5) * 0.66;
  float dist = length(f - off);

  // 星点的"大小"固定在格子尺度上，再用像素足迹做抗锯齿：
  // 一个格子不足一个像素时 aa 变大，星星自然淡出，不会闪成噪点。
  float aa = max(fwidth(dist), 0.012);
  float core = 1.0 - smoothstep(0.05, 0.11 + aa, dist);

  // 亮度按四次方分布：绝大多数是暗星，少数几颗明显亮
  float mag = 0.10 + 1.15 * pow(hash31(id + 23.9), 4.0);
  return exists * core * mag * gain;
}

void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  float h = d.y;

  // 蓝调时刻（blue hour）：日落之后 20 分钟的天空。
  //
  // 和"深夜"是两套完全不同的东西：深夜的天比楼暗，楼是剪影；
  // 蓝调时刻的天比楼亮，是整张画面最亮的部分，楼反而沉下去，
  // 只有窗灯和幕墙反光在亮。真实摄影里最好看的那二十分钟就是这个状态。
  //
  // 所以这里的天顶不能近黑：它必须是饱和的深蓝，亮度明显高于楼群，
  // 否则楼和天糊成一片，天际线消失——那正是之前夜景"没有吸引力"的根源。
  // 天顶偏蓝紫而不是纯蓝：和楼体、雾的底色是一个色相，暖橙才显得突出
  vec3 zenith = vec3(0.018, 0.026, 0.075);
  vec3 mid = vec3(0.050, 0.060, 0.140);
  // 地平线残留的余晖：暖橙，越靠近地平线越亮。
  // 这一层是"有戏"的来源——冷调的天和暖调的地平线接在一起。
#ifdef STYLIZED
  // 风格化：地平线只是更亮一点的蓝，不要大片暖橙抢走窗灯的颜色
  vec3 afterglow = vec3(0.10, 0.11, 0.22);
#else
  vec3 afterglow = vec3(0.40, 0.21, 0.16);
#endif
  vec3 col = mix(afterglow, mid, smoothstep(0.0, 0.16, h));
  col = mix(col, zenith, smoothstep(0.16, 0.72, h));
  // 地平线以下（俯视时的地面方向）：压暗，接住雾色
  col = mix(vec3(0.026, 0.027, 0.060), col, smoothstep(-0.22, 0.0, h));

  // 银河带需要一份连续的天空坐标：三维方向直接投影到过天顶的平面，
  // 没有面与面的接缝，只是在天顶方向被压缩（那里本来就正对银道）。
  vec2 uv = d.xz / max(0.35, 1.0 - abs(d.y) * 0.55) * 0.5;

  // ---- 银河：一条倾斜的大圆带 ----
  vec3 axis = normalize(vec3(0.36, 0.52, -0.78));
  float band = exp(-pow(dot(d, axis) / 0.17, 2.0));
  float dust = fbm(uv * 5.4 + 11.0);
  float dustFine = fbm(uv * 15.0 + 3.0);
  // 蓝调时刻看不见银河：天太亮，只有最亮的一两颗星。这里压到几乎不可见，
  // 保留代码是为了以后再加深夜色时能直接调回来。
  float mw = band * smoothstep(0.34, 0.95, dust * 0.72 + dustFine * 0.42);
  col += vec3(0.004, 0.0045, 0.006) * mw;

  // ---- 星点：三层不同的尺度，银河里额外加密 ----
  float bandBoost = 1.0 + band * 1.5;
  float s = 0.0;
  s += starLayer(d, 300.0, 0.030, 1.0, 1.5);
  s += starLayer(d, 170.0, 0.038, 41.0, 1.0);
  s += starLayer(d, 95.0, 0.022, 97.0, 0.6);
  s *= bandBoost;
  // 蓝调时刻星点几乎看不到：天比星亮。压到 12%。
  s *= 0.12;
  // 贴近地平线的星被城市光污染和空气吃掉了
  s *= smoothstep(0.0, 0.10, h);

  // ---- 薄云：只是挡住星点，不自己发光 ----
  // 夜里真正看得见的云是"把星星遮住的那一块更暗"，
  // 而不是加法叠一层暖色（那就是一片灰黄）。
  float cl = fbm(uv * 3.1 + vec2(uTime * 0.006, uTime * 0.002));
  float cover = smoothstep(0.50, 0.90, cl) * smoothstep(0.01, 0.16, h);
  s *= 1.0 - cover * 0.9;
  col += vec3(0.0075, 0.008, 0.011) * cover;

  // ---- 月亮：小亮盘 + 极淡光晕 ----
  // 以前增益 2.4 是过曝的白块，边缘还硬，看着像贴了个圆标。
  // 现在亮度压在 0.55 左右（不发白），边缘按像素宽度软化，并加一点边缘变暗。
  vec3 moonDir = normalize(vec3(-0.46, 0.40, 0.79));
  float md = dot(d, moonDir);
  // 视角半径约 1°，直径 2°：真实月亮 0.5°，但游戏里太小就看不见了。
  float moonR = 0.99985;
  float aa = max(fwidth(md), 1e-6);
  float disc = smoothstep(moonR - aa, moonR + aa, md);
  // 球体边缘变暗：一个正对镜头的球，边缘的辐亮度会掉
  float limb = mix(0.5, 1.0, smoothstep(moonR, 1.0, md));
  // 月面斑驳：方向上的低频噪声，别用太高的频率（会变成沙粒）
  float mare = 0.86 + 0.14 * fbm(d.xz * 55.0 + d.y * 34.0);
  float halo = pow(max(md, 0.0), 1400.0) * 0.08 + pow(max(md, 0.0), 120.0) * 0.008;
  s *= 1.0 - disc;
  vec3 moonCol = vec3(0.90, 0.88, 0.82) * disc * limb * mare * 0.5;
  col += moonCol + vec3(0.26, 0.29, 0.35) * halo;

  col += s * vec3(0.97, 0.98, 1.01);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

/** 城市夜空：近黑的天底 + 星点 + 银河，地平线留一点光污染。 */
function NightSky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        defines: STYLIZED ? { STYLIZED: 1 } : {},
        vertexShader: NIGHT_SKY_VERT,
        fragmentShader: NIGHT_SKY_FRAG,
        uniforms: { uTime: { value: 0 } },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  const mesh = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    // 天空球跟着相机走，永远在最远处
    mesh.current?.position.copy(state.camera.position)
  })
  return (
    <mesh ref={mesh} material={material} renderOrder={-10} frustumCulled={false} userData={{ dynamic: true }}>
      {/* 分段数不用跟着变高：方向已经在片元里按世界坐标算了，
          这个球只负责占满屏幕，32×16 足够 */}
      <sphereGeometry args={[900, 48, 24]} />
    </mesh>
  )
}

function SkyBridges() {
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2c4658',
        roughness: 0.12,
        metalness: 0.85,
        emissive: '#3f8ea8',
        emissiveIntensity: 0.18,
      }),
    [],
  )
  const frame = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b3d4d', roughness: 0.45, metalness: 0.6 }),
    [],
  )
  return (
    <group>
      {[
        // 雪松公寓（复古板楼）东端 ↔ 北塔西侧，横跨主街上空。
        // 社区收紧之后只剩这一对楼能自然连起来，多出来的会变成悬空的玻璃板。
        { x: -6.5, y: 19.8, z: -56.5, len: 49, axis: 'x' as const },
      ].map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]} rotation={[0, b.axis === 'x' ? 0 : Math.PI / 2, 0]}>
          <mesh castShadow material={frame}>
            <boxGeometry args={[b.len, 0.5, 3.2]} />
          </mesh>
          <mesh position={[0, 1.05, 0]} material={glass}>
            <boxGeometry args={[b.len, 2.1, 2.8]} />
          </mesh>
          {/* 灯带必须完全脱离玻璃表面，压在面上会形成一条闪烁的亮线。
              高度给到 18cm：5cm 在远处不到一个像素，会被采样成断断续续的虚线 */}
          <mesh position={[0, 1.05, 1.47]}>
            <boxGeometry args={[b.len * 0.96, 0.18, 0.06]} />
            <meshBasicMaterial color="#eaf4ff" toneMapped={false} transparent opacity={0.4} />
          </mesh>
          <mesh position={[0, 1.05, -1.47]}>
            <boxGeometry args={[b.len * 0.96, 0.18, 0.06]} />
            <meshBasicMaterial color="#eaf4ff" toneMapped={false} transparent opacity={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 切换夜间/黄昏时同步曝光，避免沿用旧主题的亮度。 */
const GradeEffectNode = wrapEffect(GradeEffect)

/**
 * 环境光遮蔽。
 *
 * 这是整条后处理链里最贵的一环：全分辨率 × 24 次采样 + 8 次泊松去噪。
 * 压力测试数据：一帧 `gl=199ms`，而那一帧几乎什么都没画（`calls=1 tris=0k`，
 * 最后一个全屏 pass），说明成本全在逐像素过滤上，和建筑数量无关。
 *
 * 几点取舍：
 *   - halfRes 固定为 true。AO 是低频信号（几米尺度的墙角暗部），半分辨率
 *     再上采样看不出差别，但填充量直接降到 1/4。这里**必须固定**——
 *     之前按相机高度在运行时切换 halfRes，会让 render target 重建，
 *     重建期间拿旧尺寸缓冲合成，画面就是"两套图 + 模糊"。
 *   - 采样数从 24 降到 12，去噪从 8 降到 4。N8AO 有泊松去噪打底，
 *     12 次采样在半分辨率下已经看不出条带。
 *   - 画质档 0 关闭 AO，只保留抗锯齿、Bloom 和调色。
 */
function CheapAo({ night, quality }: { night: boolean; quality: number }) {
  // 风格化：AO 是整条链最贵的一环，而且墙角的噪点灰会把干净的色块弄脏
  if (quality === 0 || STYLIZED) return null
  return (
    <N8AO
      aoRadius={1.1}
      distanceFalloff={2.0}
      // AO 只负责把墙角、车底压住一点；给太强整城都是黑缝
      intensity={night ? 2.0 : 2.1}
      quality="medium"
      aoSamples={quality >= 2 ? 12 : quality >= 1 ? 8 : 6}
      denoiseSamples={quality >= 2 ? 4 : 3}
      denoiseRadius={12}
      halfRes
      color="#04070d"
    />
  )
}

/**
 * TAA 的注入点：拿相机、逐帧抖动投影，再把 pass 对象塞进 composer。
 *
 * 只能作为 EffectComposer 的直接子节点（`<primitive>` 会被 composer 的
 * useEffect 认成 Pass 并按顺序挂上），而且要排在最前面——它要读的是
 * RenderPass 刚画完的 HDR 颜色和深度，交给后面的 SMAA / Bloom / 调色。
 *
 * 抖动放在 useFrame 优先级 0.9：composer 是 1，所以一定在它之前执行；
 * 而相机的近裁剪面、雾距这些每帧 updateProjectionMatrix 的改动都会带上
 * camera.view，抖动不会被子系统覆盖掉。
 */
function TemporalAA({ resetKey }: { resetKey: string }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const gl = useThree((state) => state.gl)
  const pass = useMemo(() => new TaaPass(camera), [camera])
  const frame = useRef(0)
  const size = useMemo(() => new THREE.Vector2(), [])
  // 上一帧的机位/朝向：相机停住时不再推进抖动序列。
  // 抖动本来是为了让移动中的细线在时间上超采样；静止时继续换采样点，
  // 只会让 88% 历史 + 12% 当前帧的混合永远收敛不了，画面就一直"呼吸"。
  // 冻住序列之后，静止画面的 TAA 会在大约七八帧内收敛成一张图。
  const lastPos = useRef(new THREE.Vector3(1e9, 0, 0))
  const lastQuat = useRef(new THREE.Quaternion())

  useEffect(() => {
    pass.sceneCamera = camera
    pass.reset()
    return () => {
      camera.clearViewOffset()
    }
  }, [pass, camera])

  // 进楼 / 出楼、镜头运镜结束这些时刻，上一帧的画面和这一帧对不上
  useEffect(() => {
    pass.reset()
  }, [pass, resetKey])

  useEffect(() => () => pass.dispose(), [pass])

  useFrame(() => {
    // 0.1mm / 1e-6 弧度以内视为静止。PlayerRig 的机位是 lerp 逼近目标，
    // 真正停下后会收敛到亚微米级，不会一直更新。
    const moved =
      camera.position.distanceToSquared(lastPos.current) > 1e-8 ||
      1 - Math.abs(camera.quaternion.dot(lastQuat.current)) > 1e-12
    lastPos.current.copy(camera.position)
    lastQuat.current.copy(camera.quaternion)
    if (moved) frame.current++

    const j = JITTER[frame.current % JITTER.length]
    gl.getDrawingBufferSize(size)
    camera.setViewOffset(size.x, size.y, j[0], j[1], size.x, size.y)
  }, 0.9)

  return <primitive object={pass} />
}

/**
 * 把画质档位落到后处理的真实开销上。
 *
 * 必须是 composer 的子节点：composer 是按「子节点挂载后」的 R3F group 去
 * 收 Effect 的，写在 CityScene 里的 useEffect 会在 Defer 真正挂载之前就
 * 跑完，那时 ref 还是 null，档位就丢了。
 */
function PostQuality({
  quality,
  smaa,
  bloom,
}: {
  quality: number
  smaa: RefObject<SMAAEffect>
  bloom: RefObject<BloomEffect>
}) {
  useEffect(() => {
    const q = Math.max(0, Math.min(2, quality))
    // 写实模式下 HIGH 那 16 步太贵，收益也看不出来，封顶在 MEDIUM。
    smaa.current?.applyPreset(
      [SMAAPreset.LOW, SMAAPreset.MEDIUM, SMAAPreset.HIGH][STYLIZED ? q : Math.min(q, 1)],
    )
    const pass = bloom.current?.mipmapBlurPass
    // 级数变了会重建 mip 链的 render target，只在切档时发生一次。
    if (pass) pass.levels = [4, 6, 8][q]
  }, [quality, smaa, bloom])

  return null
}

/** 昼夜两套参数，但只有一条调色管线：曝光、曲线、对比全部在 GradeEffect 里。 */
function Grade({ night }: { night: boolean }) {
  // exposure 是亮度唯一的入口。gl.toneMappingExposure 在后处理开启时不生效
  // （EffectComposer 会把 toneMapping 设成 NoToneMapping），别再往那边加。
  // 调色在感知空间做（见 GradeEffect），lift 只补 2~3 级灰，
  // 所以夜空的近黑不会被抬成灰底，暗色物体也不会被压成纯黑。
  const params = night
    ? {
        // 夜里曝光只负责"让窗亮到能读"，不能再往上抬：
        // 抬曝光会把楼体一起抬起来，剪影就没了。
        // 1.0 的问题是整座城都沉进了黑：俯视时能看到楼，但看不到街道、屋顶、
        // 广场这些"城市的部分"，画面只剩一片窗点。抬到 1.3 让街面进一档，
        // 靠下面的 contrast + lift 控制才不会糊。
        exposure: 1.0,
        contrast: 1.16,
        saturation: 1.08,
        pivot: 0.38,
        // 天变亮之后，暗部本身就有形了，lift 可以收一点，
        // 否则刚做出来的明暗层次会被抬黑抹平。
        lift: 0.09,
        // 夜间整体压冷一档：月光是冷光源，而冷色不该出现在中高亮度上
        // （那是路灯的暖色地盘）。只动 4%，配合下面的冷暖分离，
        // 让「夜」是一个色温而不是一个亮度。
        balance: [0.99, 1.0, 1.02] as [number, number, number],
        // 招牌、车灯、橱窗是低色度但高亮的，Bloom 会把它们摊成灰白；
        // vibrance 正好补这一侧，比全局加饱和更不容易脏。
        vibrance: 0.26,
        // 分离色调：暗部推向蓝紫，高光推向暖橙——冷底暖光的最后一道保险
        // 暗部只偏一点：推到 1.16 时大面积地面被染成饱和的亮蓝，像塑料
        shadow: [0.97, 0.97, 1.04] as [number, number, number],
        highlight: [1.08, 1.0, 0.92] as [number, number, number],
      }
    : {
        // 白天的曝光必须明显高于夜晚。
        // 之前是 0.9（比夜里的 1.16 还低），所以切到白天只会换天空颜色，
        // 画面亮度根本没变——这就是"白天也像夜里"的直接原因。
        exposure: 1.35,
        contrast: 1.1,
        saturation: 1.08,
        pivot: 0.5,
        lift: 0.05,
        // 白天要克制：日光的暖已经由太阳颜色给过了，这里只补 2%，
        // 否则橙调的墙会在过曝区连成一片。
        balance: [1.02, 1.0, 0.985] as [number, number, number],
        vibrance: 0.1,
        shadow: [0.97, 1.0, 1.04] as [number, number, number],
        highlight: [1.04, 1.01, 0.97] as [number, number, number],
      }
  if (STYLIZED && night) {
    // 暗部不再往蓝推：路面、空地、没开灯的窗这些大面积暗色会被推成 #090D1E 那种
    // 蓝黑，整城发脏。冷暖只留一点高光偏暖，暗部保持中性。
    // ACES 的脚部会把暗部压掉一半，再叠 1.16 的对比，砖墙就沉成黑块：
    // 风格化夜景走低对比、略提曝光，靠光色和受光面分层，而不是靠明暗反差
    Object.assign(params, {
      // 曝光抬一档：上面把天光压回可读档位之后，画面还需要一点整体亮度，
      // 否则楼体虽然是暗的，屋顶/人行道/草地的材质也读不出来。
      exposure: 1.12,
      contrast: 1.08,
      // 饱和度与 vibrance 都收一档：底图压暗之后再把低饱和的墙/树往上推，
      // 整城会重新回到"黄绿功能色"。夜景的颜色应该来自光源本身，
      // 而不是把每个物体都染得更艳。
      saturation: 1.0,
      balance: [1.0, 1.0, 1.0],
      shadow: [1.0, 1.0, 1.0],
      // 高光不再整体推暖：所有中高亮的面（标线、人行道、墙）都会被染黄。
      // 暖色只来自光源本身（窗、路灯）。
      highlight: [1.0, 1.0, 1.0],
      vibrance: 0.14,
      // lift 抬一点点：暗部不要压成纯黑，否则背光的楼、树、地面是一团黑。
      lift: 0.07,
    })
  }
  return <GradeEffectNode key={night ? 'n' : 'd'} {...params} />
}

const PERF_COUNTS = {
  楼总数: buildings.length,
  程序化楼: buildings.filter((b) => b.background).length,
  小区楼: buildings.filter((b) => b.form === 'estate').length,
  沿街楼: buildings.filter((b) => b.background && b.form !== 'estate').length,
}

export function ExposureSync({ value }: { value: number }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.toneMappingExposure = value
  }, [gl, value])
  return null
}

/**
 * 距离雾按相机高度外推。
 *
 * 原来的雾近端 60m、远端 520m：站在街上刚好有层次，但滚轮拉到总览（相机
 * 210m 远）时，连脚下的地面都在 60m 开外，整座城被同一层雾糊成灰片。
 * 雾本质上是"空气厚度"，相机升高看到的空气柱更长，雾应该跟着往外推，
 * 而不是反过来把整城洗白。这里贴地时保持原参数，升高后线性放大 4.5 倍，
 * 只留远处天际线一点点 haze。
 */
export function AdaptiveFog({ color, near, far }: { color: string; near: number; far: number }) {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const zoom = useRef(1)
  useFrame((_, rawDelta) => {
    const fog = scene.fog as THREE.Fog | null
    if (!fog) return
    const height = Math.max(0, camera.position.y - 6)
    const want =
      1 + THREE.MathUtils.smoothstep(height, 16, 110) * 4.5 + THREE.MathUtils.smoothstep(height, 110, 480) * 8
    zoom.current = THREE.MathUtils.damp(zoom.current, want, 3, Math.min(rawDelta, 0.05))
    fog.near = near * zoom.current
    fog.far = far * zoom.current
  })
  // 换昼夜时 fog 会重建，参数以 props 为准；已经在高空时直接落到外推后的值，
  // 不能先回退成街道参数再慢慢推出去。
  useEffect(() => {
    const height = Math.max(0, camera.position.y - 6)
    zoom.current = 1 + THREE.MathUtils.smoothstep(height, 16, 110) * 4.5
    const fog = scene.fog as THREE.Fog | null
    if (!fog) return
    fog.near = near * zoom.current
    fog.far = far * zoom.current
  }, [color, near, far, scene, camera])
  return <fog attach="fog" args={[color, near, far]} />
}

/** 太阳阴影只覆盖玩家周围一圈，并随玩家平移（按纹素对齐避免抖动）。
    整城都塞进阴影相机时，阴影 pass 等于把城市再画一遍。 */
function SunRig({
  palette,
  extent: extentOverride,
  follow = true,
  center,
}: {
  palette: typeof palettes.night
  extent?: number
  /** true：阴影相机跟着玩家走（小场景用）。false：固定覆盖整片城区，阴影不会跳。 */
  follow?: boolean
  /** follow=false 时的阴影中心 */
  center?: [number, number]
}) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  // 手写街区只有 60m 见方，96m 足够；OSM 那张 3km 的地图要更大的视锥
  const extent = extentOverride ?? 96
  // 阴影贴图分辨率固定，不跟画质档走：改这个值会 dispose 并重新分配整张
  // 深度图，档位一变就是一次几十毫秒的停顿。2048 在 190m 视锥下约 9cm/texel，
  // 和 normalBias 的取值配套，够用。
  const resolution = 2048
  // 光源离场景多远：跟随模式下贴着玩家，静态模式下要往后退够远，
  // 否则 400m 的高楼会被阴影相机的 far 面切掉，影子随视角时有时无。
  const lightDistance = follow ? 0.55 : extent * 1.7
  // 法线偏移要跟纹素大小走：城区静态阴影一个纹素约 9cm，用 OSM 那张大地图
  // 的 0.45 会让影子从物体脚下脱开；反过来小贴图用 0.28 又会漏光。
  const texel = (extent * 2) / resolution
  const normalBias = Math.min(0.45, Math.max(0.2, texel * 3))

  useEffect(() => {
    const l = light.current
    if (!l) return
    l.target = target
    if (follow) return
    // 静态阴影：只设一次，之后不再随玩家移动，画面因此完全稳定
    const cx = center?.[0] ?? 0
    const cz = center?.[1] ?? 0
    const dir = new THREE.Vector3(...palette.sunPos).normalize()
    target.position.set(cx, 0, cz)
    target.updateMatrixWorld()
    l.position.set(cx + dir.x * lightDistance, Math.max(80, dir.y * lightDistance), cz + dir.z * lightDistance)
    l.updateMatrixWorld()
  }, [follow, center, palette.sunPos, lightDistance, target])

  const last = useRef(new THREE.Vector2(1e6, 1e6))

  useFrame(() => {
    const l = light.current
    if (!l || !follow) return
    // 阴影相机逐帧跟随会因亚 texel 偏移产生整片闪烁；只按 16m 步进又会
    // 出现阴影整体“跳格”。这里把目标点吸附到阴影贴图的 texel 栅格上：
    // 视角移动时阴影边界只会整格移动，不再抖动。
    const texel = (extent * 2) / resolution
    const snap = texel * 2
    const x = Math.round(walker.position.x / snap) * snap
    const z = Math.round(walker.position.z / snap) * snap
    if (Math.abs(x - last.current.x) < 1e-4 && Math.abs(z - last.current.y) < 1e-4) return
    last.current.set(x, z)
    target.position.set(x, 0, z)
    target.updateMatrixWorld()
    l.position.set(
      x + palette.sunPos[0] * lightDistance,
      Math.max(70, palette.sunPos[1] * lightDistance),
      z + palette.sunPos[2] * lightDistance,
    )
    l.updateMatrixWorld()
  })

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        // castShadow 一直开着：切换它会让全场材质重新编译（昼夜切换卡一下）。
        // 夜里也要月影：没有投影，一个方向光就只是"给每个面刷一遍亮度"，
        // 楼与楼之间、窗洞内外全都没有相互遮挡，画面一定发平。
        castShadow
        shadow-intensity={palette.key === 'night' ? 0.8 : 1}
        position={palette.sunPos}
        intensity={palette.sunIntensity}
        color={palette.sun}
        shadow-mapSize={[resolution, resolution]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={follow ? 420 : extent * 4.5}
        shadow-bias={-0.0006}
        shadow-normalBias={normalBias}
        shadow-radius={2.2}
      />
    </>
  )
}

export function Environment({
  night,
  shadowExtent,
  shadowFollow = true,
  shadowCenter,
  sky = true,
}: {
  night: boolean
  shadowExtent?: number
  shadowFollow?: boolean
  shadowCenter?: [number, number]
  /** false 时只提供灯光，天空交给调用方自己画（避免两套天空撞在一起） */
  sky?: boolean
}) {
  const p = night ? palettes.night : palettes.dusk
  // IBL 接管了大部分环境光，剩下的半球光只补一点点地面反弹，
  // 否则环境光叠两遍，暗部会灰成一片、对比全丢。
  //
  // 昼夜是两套完全不同的配光逻辑：
  //   白天 —— 太阳是主光（2.4），天光只让阴影里有色，
  //           整张画面走高调，暗部只留在窗内和楼底。
  //   夜里 —— 没有主光；窗光是唯一的高亮，楼体必须退成剪影。
  // 之前两套都用"环境光撑亮度"，结果是白天平光、夜里中灰，
  // 而且五路光源叠加正好也是 46ms/帧的主要来源。
  const hemi = p.hemiIntensity
  const ambient = p.ambient
  const ibl = (
    <ImageBasedLighting
      // 蓝调时刻要用"有天空内容"的 HDR，不能用郊外星空那张：
      // 幕墙是金属度 0.93、粗糙度 0.1 的镜面，它反射的就是这张环境图。
      // 以前夜里挂的是星空（几乎全黑），于是整座城的玻璃反射出来是一片黑，
      // 高层唯一的美感来源（反射天空）等于被关掉了。
      // 换成城市环境图之后，幕墙会映出天空和周围楼群的亮度。
      mood={night ? 'city' : 'dusk'}
      // 夜里借的是一张白昼城市 HDR（为了让幕墙有东西可反射），
      // 它的漫反射对朝上的面就是"白天的天空"：给到 1.0 时屋顶、广场
      // 在俯视下全部过曝。夜里的环境反射只留给幕墙，强度必须很低。
      intensity={night ? 0.14 : 0.3}
      rotation={night ? 2.1 : 2.35}
    />
  )
  if (night) {
    return (
      <>
        {ibl}
        {sky && <color attach="background" args={[p.sky]} />}
        {sky && <AdaptiveFog color={p.fog} near={p.fogNear} far={p.fogFar} />}
        {sky && <NightSky />}
        <hemisphereLight args={[p.hemiSky, p.hemiGround, hemi]} />
        <ambientLight intensity={ambient} />
        <SunRig palette={p} extent={shadowExtent} follow={shadowFollow} center={shadowCenter} />
        {/* 冷色补光，让背光面不糊成一片。白天同样挂着（亮度 0），保持灯的数量不变。
            夜里压到 0.08：它和月光、天光、环境光加起来才是"楼是剪影"的天敌。 */}
        <directionalLight position={[120, 80, 140]} intensity={night ? 0.08 : 0} color="#c9a888" />
      </>
    )
  }
  return (
    <>
      {ibl}
      {sky && <color attach="background" args={[p.sky]} />}
      {sky && (
        <Sky
          distance={1200}
          // 太阳高度角不能太低：贴地平线时 Preetham 的太阳项会趋近无穷，
          // 高光过曝成一片白，太阳本体反而被压成黑块。
          // 46° 那套参数算出来的地平线是橙的，橙色占满画面上部，
          // 城市就退成剪影——那是日落，不是白天。抬到 ~43° 的近正午，
          // 天空读成蓝色，楼顶也才吃得到直射光。
          sunPosition={[110, 150, -150]}
          turbidity={2.1}
          rayleigh={0.55}
          // 前向散射（mieDirectionalG）越接近 1，太阳附近越会出现巨大的光晕
          mieCoefficient={0.002}
          mieDirectionalG={0.8}
        />
      )}
      {sky && <AdaptiveFog color={p.fog} near={p.fogNear} far={p.fogFar} />}
      <hemisphereLight args={[p.hemiSky, p.hemiGround, hemi]} />
      <ambientLight intensity={ambient} />
      <SunRig palette={p} extent={shadowExtent} follow={shadowFollow} center={shadowCenter} />
      <directionalLight position={[120, 80, 140]} intensity={0} color="#c9a888" />
    </>
  )
}

/**
 * 阴影贴图按预算刷新，而不是每帧重画。
 *
 * 主光是一盏覆盖 380m 的平行光，2048² 深度的整张图每帧都要重渲染一遍：
 * 场景里会投影的东西（合批后的整片城区 + 车流 + 行人）全部落在阴影相机里。
 * 但其中真正在动的只有车、行人和宠物，而它们投出的影子边缘本来就是软的
 * （shadow-radius 2.2），落后一两帧完全看不出来。
 *
 * 所以这里把 autoUpdate 关掉，改成按时间预算手动置 needsUpdate：
 *   - 60fps 时阴影大约 11Hz 刷新，阴影 pass 的提交量直接降到 1/5；
 *   - 帧时间本来就长的时候（15fps）每帧都刷，不会比原来更差；
 *   - 进出片头各强制刷一次，避免带着上一套光照的旧阴影。
 *
 * 注意：autoUpdate 只在这一个地方改。以前片头那段和进城恢复各写一次，
 * 现在两个 owner 都交给这里，行为不再依赖挂载顺序。
 */
// 0.09s 相当于 11Hz：转视角时每 11 帧就撞上一帧"整城重画一遍深度图"，
// 体感是持续的顿挫。0.18s（约 5.5Hz）把这一帧的占比压到原来一半，
// 而软阴影边缘本来就看不出落后一帧：人走在街上，影子晚 0.18s 追上。
const SHADOW_INTERVAL = 0.18
/** 远景时阴影刷新再降频：高空俯视下人和车只有几个像素，阴影晚几帧看不出来。 */
const SHADOW_INTERVAL_FAR = 0.6

/**
 * 远景隐藏：相机离玩家超过 limit 时整组不渲染。
 * 行人、NPC、摊位在高空俯视下只有几个像素，却要占骨骼动画和几百次 draw call。
 */
function FarHide({ limit, children }: { limit: number; children: ReactNode }) {
  const camera = useThree((state) => state.camera)
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    const show = camera.position.distanceTo(walker.position) < limit
    if (group.current.visible !== show) group.current.visible = show
  })
  return <group ref={group}>{children}</group>
}

function ShadowBudget() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const screen = useApp((state) => state.screen)
  const acc = useRef(0)

  useEffect(() => {
    const map = gl.shadowMap
    const before = map.autoUpdate
    map.autoUpdate = false
    map.needsUpdate = true
    return () => {
      map.autoUpdate = before
      map.needsUpdate = true
    }
  }, [gl])

  useEffect(() => {
    acc.current = 0
    gl.shadowMap.needsUpdate = true
  }, [screen, gl])

  useFrame((_, rawDelta) => {
    // 片头：欢迎页 0.98 不透明度的遮罩盖着，脚下的阴影根本看不见，
    // 这段时间一次都不刷（那几十毫秒一帧的卡顿主要就是这块）。
    if (screen === 'intro') return
    acc.current += Math.min(rawDelta, 0.25)
    const far = camera.position.distanceTo(walker.position) > 120
    if (acc.current < (far ? SHADOW_INTERVAL_FAR : SHADOW_INTERVAL)) return
    acc.current = 0
    gl.shadowMap.needsUpdate = true
    perfMark('shadow')
  })

  return null
}

/**
 * 近裁剪面随相机高度外推。
 *
 * 深度精度大约按 距离² / near 变差：near 0.45 时，200m 外两个相距 2cm 的面
 * （招牌 / 装饰板贴在墙上）已经分不清前后，视角一动就来回闪（z-fighting）。
 * 跟随视角时保持 0.45，拉远到总览后最近的物体也在几十米外，near 推到
 * 几米完全看不出裁剪，精度却能提高一个数量级。
 */
function AdaptiveNear() {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  useFrame(() => {
    // 按相机到玩家的距离而不是高度：飞到高楼旁边时相机也很高，但离墙很近
    const dist = camera.position.distanceTo(walker.position)
    const want = THREE.MathUtils.clamp((dist - 8) * 0.05, 0.45, 30)
    // far 也跟着走：贴地时保持 1100，拉远才放大。far/near 比值一大，
    // 墙面和贴在墙上的檐口、壁柱就会深度打架，整面楼闪烁
    const wantFar = THREE.MathUtils.clamp(dist + 900, 1100, 2000)
    if (Math.abs(want - camera.near) / camera.near < 0.08 && Math.abs(wantFar - camera.far) < 40) return
    camera.near = want
    camera.far = wantFar
    camera.updateProjectionMatrix()
  })
  return null
}

/**
 * 冻结静态楼的矩阵：程序化楼有六百多栋、一万多个节点，从不移动，
 * 但 three.js 默认每帧都要把它们的矩阵重算一遍（被远景隐藏的也照算）。
 * 算一次之后关掉自动更新，渲染时整棵子树直接跳过。
 * 楼是分批挂载的，所以每次扫描都要检查有没有新挂上来、还没冻结的子节点；
 * 有的话整栋强制重算一次再冻结，否则新节点的世界矩阵会停在单位矩阵。
 */
function freezeStatic(root: THREE.Object3D) {
  let fresh = false
  root.traverse((o) => {
    if (o.matrixWorldAutoUpdate) fresh = true
  })
  if (!fresh) return
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    o.matrixAutoUpdate = false
    o.matrixWorldAutoUpdate = false
  })
}

/**
 * 普通建筑的远景降级。
 *
 * 楼体主体的立面 shader 本身已经包含窗格和灯光，远处继续保留；
 * 阳台、店面实体件、屋顶设备和轮廓光则在较远距离隐藏，避免每栋楼
 * 都按近景细节绘制。每隔几帧更新一次即可，避免把距离判断变成新的
 * 每帧 CPU 开销。
 */
function BuildingLodController() {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const frame = useRef(0)
  const lodNodes = useRef<THREE.Object3D[]>([])
  const cameraPosition = useMemo(() => new THREE.Vector3(), [])
  const buildingPosition = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    frame.current += 1
    if (frame.current % 4 !== 0) return

    // 建筑会通过 Stagger 分批挂载，低频重新收集即可；不要每次更新
    // 可见性时都 traverse 整个城市场景。
    if (frame.current % 32 === 0) {
      const next: THREE.Object3D[] = []
      const roots: THREE.Object3D[] = []
      scene.traverse((object) => {
        if (object.userData.buildingDetailLod) next.push(object)
        if (object.userData.hlod) roots.push(object)
      })
      lodNodes.current = next
      for (const root of roots) freezeStatic(root)
      perfMark('lod')
    }

    camera.getWorldPosition(cameraPosition)
    for (const object of lodNodes.current) {
      const mesh = object as THREE.Mesh
      if (object.userData.merged && mesh.geometry?.boundingSphere) {
        buildingPosition.copy(mesh.geometry.boundingSphere.center)
        object.localToWorld(buildingPosition)
      } else {
        object.getWorldPosition(buildingPosition)
      }
      const distance = cameraPosition.distanceTo(buildingPosition)
      // 地标保留更远的轮廓细节，普通建筑在 75m 外只保留主体。
      const limit = object.userData.landmark ? 130 : 75
      object.visible = distance < limit
    }
  })

  return null
}

/**
 * 延后几帧再从子节点里渲染。
 *
 * 用在 EffectComposer 上：它的十来个全屏 pass（SMAA、Bloom、N8AO、Grade…）
 * 要在首帧编译程序、分配一堆 render target。和场景放在同一个 commit 里，
 * 首帧就是 28 个程序 + 91 张贴图、440ms 一次硬停。晚两帧挂上去，
 * 首帧只剩场景自己的程序，后半段再补，两段都短一半，而且这期间
 * 屏幕被欢迎页遮着，看不出少了后处理。
 */
function Defer({ frames, children }: { frames: number; children: ReactNode }) {
  const [go, setGo] = useState(false)
  const count = useRef(0)
  useFrame(() => {
    if (go) return
    count.current += 1
    if (count.current >= frames) setGo(true)
  })
  return go ? <>{children}</> : null
}

/**
 * 场景里的点光源全部在这里一次性挂上。
 *
 * `numPointLights` / `numSpotLights` 是着色器缓存键的一部分——场景里多一盏点光，
 * 全场材质的 program 就全部失效，下一帧整座城重编译一次。日志里那次
 * `physical×39 · basic×20`（59 个程序、1.1 秒）就是这么来的。
 *
 * 以前这些灯散落在摩天轮、喷泉、烟花里，各自随所在分组在不同时间挂载，
 * 每挂一处就重编译一遍整城。现在数量从第一帧起固定，白天改成 intensity=0
 * 而不是不渲染。
 */
function StablePointLights({ night }: { night: boolean }) {
  return (
    <>
      {/* 摩天轮轮毂：彩灯只是自发光，不给场景照度，没有这盏灯钢结构夜里全黑 */}
      <pointLight
        position={[ferrisWheel.x, HUB_Y, ferrisWheel.z]}
        color="#ffd9a8"
        intensity={night ? 220 : 0}
        distance={95}
        decay={2}
      />
      {/* 广场喷泉的水下灯 */}
      <pointLight
        position={[plazaFountain.x, 2.2, plazaFountain.z]}
        color="#8fd0d8"
        intensity={night ? 16 : 0}
        distance={22}
        decay={2}
      />
      <PlayerLamp />
    </>
  )
}

/** 主角脚下那点暖光。以前挂在可见性随时会变的角色组里，
 *  隐藏/显示会改变场景的点光数量，于是"进入城市"那一刻全城材质重编译。 */
function PlayerLamp() {
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    light.current?.position.set(walker.position.x, walker.position.y + 0.1, walker.position.z)
  })
  return <pointLight ref={light} color="#ffe6b8" intensity={0.3} distance={2.2} decay={2} />
}

/**
 * 图鉴亭从广场东侧挪到了河岸东步道背后的草地。
 *
 * 广场是城市原点、最开阔的一块地，亭子立在旁边会把广场的视线切掉一半；
 * 而且广场现在一个摊位都不摆，留白就是它最好的状态。河岸这边是遛宠物的
 * 地方（桥东滨水、背后是河），图鉴亭放这儿才对得上用途。
 *
 * `noticeSpot` 本来就是"避开喷泉、车道和楼"的落点求解器，留言板在用它，
 * 这里直接复用——放一个会撞墙的亭子比放一块牌子难得多。
 */
const CATALOG_SPOT = noticeSpot(28, 61)
/** 朝河（+Z）：站在北岸草坡上翻图鉴，背后是城市。 */
const CATALOG_YAW = 0
/** 亭子正面（玩家站的位置）：光环和提示放这里，不要塞进台基底下。 */
const CATALOG_FRONT = {
  x: CATALOG_SPOT[0] + Math.sin(CATALOG_YAW) * 1.9,
  z: CATALOG_SPOT[1] + Math.cos(CATALOG_YAW) * 1.9,
}

export function CityScene({ active = true }: { active?: boolean }) {
  const world = useApp((state) => state.world)
  const night = useApp((state) => state.night)
  const quality = useApp((state) => state.quality)
  // 排查开关：`?nofx=1` 关掉整条后处理链。
  // 一帧 75ms、三角面只有 32k、降 dpr 也没变快，需要分清是场景 pass、
  // 后处理 pass，还是根本不在 GPU 上。这个开关的对比结果能直接定论。
  const noFx = import.meta.env.DEV && new URLSearchParams(window.location.search).has('nofx')
  // `?perf=1`：左下角挂一块临时读数（fps / draw call / 三角形 / 着色器变体数）
  const perf = import.meta.env.DEV && new URLSearchParams(window.location.search).has('perf')
  const enterTarget = useApp((state) => state.enterTarget)
  const openPlace = useApp((state) => state.openPlace)
  const screen = useApp((state) => state.screen)
  const p = night ? palettes.night : palettes.dusk

  // 后处理的 quality 旋钮。以前 QualityTuner 降档只改 N8AO 的采样数，
  // 而风格化模式下 CheapAo 直接返回 null、OSM 场景又没挂，所以降档等于没降：
  // 判定说"太慢"，负载却一动不动，档位就这么一直卡在 2，掉帧也没人救。
  //
  // 这里改的两项都只改 uniform / pass 数，不重建着色器程序，也不重建调色：
  //  - SMAA 搜索步长（HIGH 16 步 / MEDIUM 8 / LOW 4）：两次全屏，是这条链里
  //    最稳定的填充成本；
  //  - Bloom 的 MIP 级数（8 / 6 / 4）：每一级都是一次全屏降采样 + 升采样。
  // 两者只影响边缘锐度和光晕半径，色调一条都没动。
  const smaaRef = useRef<SMAAEffect>(null)
  const bloomRef = useRef<BloomEffect>(null)

  const colliders = useMemo<Collider[]>(() => {
    const list: Collider[] = buildings.flatMap(collidersOfBuilding)
    // 河面挡人：只有三条车道的堤道能过河
    for (const [x0, x1] of riverSegments) {
      list.push({
        minX: x0,
        maxX: x1,
        minZ: river.z - river.d / 2,
        maxZ: river.z + river.d / 2,
        minY: 0,
        maxY: 1.2,
      })
    }
    // 图鉴亭占一块地：四柱之间可以站人，但台基和展板不能穿
    list.push({
      minX: CATALOG_SPOT[0] - 1.35,
      maxX: CATALOG_SPOT[0] + 1.35,
      minZ: CATALOG_SPOT[1] - 1.05,
      maxZ: CATALOG_SPOT[1] + 1.05,
      minY: 0,
      maxY: 2.7,
    })
    // 摊位：柜台和货箱挡人，客人那一侧留空
    list.push(...stallColliders())
    // 街口牌坊的柱子：横跨主街的两根，玩家不该穿过去
    list.push(...gateColliders())
    // 步行街两侧的商铺排（走道之外全是实体）
    list.push(...pedestrianColliders())
    return list
  }, [])

  const interactables = useMemo<Interactable[]>(() => {
    const list: Interactable[] = []
    for (const b of buildings) {
      if (b.background) continue
      if (isUnitBuilding(b.id)) {
        for (const e of unitEntrances(b)) {
          list.push({
            id: `entrance-${b.id}-${e.core}`,
            label: e.label,
            hint: e.hint,
            x: e.x,
            z: e.z,
            radius: 3.6,
            action: () => enterTarget({ kind: 'building', id: b.id, core: e.core }, e.label),
          })
        }
        continue
      }
      if (!b.target || !b.entranceAt) continue

      const entrance = entranceOf(b)
      const [approachX, approachZ] = entranceApproach(b, entrance)

      const space =
        b.target?.kind === 'space' ? world?.spaces.find((item) => item.id === b.target!.id) : null
      const use =
        b.target?.kind === 'space'
          ? space?.owner
            ? `${space.owner.name} 的空间 · ${b.entranceUse || ''}`
            : '可认领 · 样板陈设'
          : b.entranceUse || '可进入'
      list.push({
        id: `entrance-${b.id}`,
        label: b.entranceLabel || b.name,
        hint: `进入 ${use}`,
        x: approachX,
        z: approachZ,
        radius: 4.6,
        action: () => enterTarget(b.target!, b.entranceLabel || b.name),
      })
    }
    list.push({
      id: 'ferris-board',
      label: '摩天轮',
      hint: '按 E 乘坐 · 一圈约 4 分钟，随时按 E 下车',
      x: boardSpot.x,
      z: boardSpot.z,
      radius: 4.5,
      action: boardFerris,
    })
    list.push({
      id: 'boat-stop-west',
      label: '河岸游船',
      hint: '按 E 登船 · 前往东岸码头',
      x: -31.5,
      z: 68,
      radius: 4.2,
      action: () => {
        walker.position.set(38, 0.1, 68)
        useApp.getState().showToast('游船抵达东岸码头')
      },
    })
    list.push({
      id: 'boat-stop-east',
      label: '河岸游船',
      hint: '按 E 登船 · 前往西岸码头',
      x: 38,
      z: 68,
      radius: 4.2,
      action: () => {
        walker.position.set(-31.5, 0.1, 68)
        useApp.getState().showToast('游船抵达西岸码头')
      },
    })
    list.push({
      id: 'tram-stop-west',
      label: '观光电车站',
      hint: '按 E 上车 · 前往东岸街市',
      x: -72,
      z: -24,
      radius: 4.2,
      action: () => {
        walker.position.set(72, 0.1, 28)
        useApp.getState().showToast('观光电车抵达东岸街市')
      },
    })
    list.push({
      id: 'tram-stop-east',
      label: '观光电车站',
      hint: '按 E 上车 · 前往西岸街区',
      x: 72,
      z: 28,
      radius: 4.2,
      action: () => {
        walker.position.set(-72, 0.1, -24)
        useApp.getState().showToast('观光电车抵达西岸街区')
      },
    })
    list.push({
      id: 'catalog-booth',
      label: '宠物图鉴',
      hint: '按 E 翻阅图鉴',
      x: CATALOG_FRONT.x,
      z: CATALOG_FRONT.z,
      radius: 3.0,
      action: () => useApp.getState().openPanel({ type: 'catalog' }),
    })
    for (const npc of npcs) {
      list.push({
        id: `npc-${npc.id}`,
        label: `${npc.name} · ${npc.role}`,
        hint: '按 E 对话',
        x: npc.x,
        z: npc.z,
        // 6m：站在人行道上不用贴脸也能对话
        radius: 6,
        action: () =>
          useApp.getState().openDialog({ name: npc.name, role: npc.role, lines: npc.lines, x: npc.x, z: npc.z }),
      })
    }
    // 1 楼沿街店铺：交互点放在门外 1.1m，和街上的入口标记同一个位置
    for (const shop of shops) {
      const door = shopDoor(shop)
      list.push({
        id: `shop-${shop.id}`,
        label: shop.name,
        hint: `${openNow(shop) ? '营业中' : '现在打烊'} · ${shop.hours}`,
        x: door.x,
        z: door.z,
        radius: 3.0,
        action: () => enterTarget({ kind: 'shop', id: shop.id }),
      })
    }
    // 街边小摊：NPC 摊按 E 聊两句，玩家摊打开摊面面板
    for (const stall of stalls) {
      const front = stallFront(stall)
      const npc = stall.vendor
      list.push({
        id: `stall-${stall.id}`,
        label: npc.kind === 'npc' ? `${npc.name} · ${stall.title}` : `${stall.title} · ${npc.name}`,
        hint:
          npc.kind === 'npc'
            ? `${stall.category} · 按 E 聊两句`
            : `${stall.category} · 摊主不在，按 E 看看摊子`,
        // 判定点放摊位中心、半径 3.4：客人从哪个方向靠近都算数。
        // 以前判定点在柜前，绕到摊子侧面或背后名牌就不亮了。
        x: stall.x,
        z: stall.z,
        radius: 3.4,
        action: () => {
          if (npc.kind === 'npc') {
            useApp.getState().openDialog({ name: npc.name, role: npc.role, lines: npc.lines, x: front.x, z: front.z })
          } else {
            useApp.getState().openPanel({ type: 'stall', id: stall.id })
          }
        },
      })
    }
    if (launcher) {
      list.push({
        id: 'fireworks',
        label: '烟花发射台',
        hint: '按 E 点火 · 需认领空间',
        x: launcher.x + 1.4,
        z: launcher.z,
        y: launcher.y,
        radius: 2.4,
        action: launchFireworks,
      })
    }
    for (const place of world?.places || []) {
      if (place.id === 'gallery-lobby' || place.id === 'corner-cafe') continue
      list.push({
        id: `place-${place.id}`,
        label: place.name,
        hint: '查看地点档案与留言',
        x: place.x,
        z: place.z,
        radius: place.kind === 'plaza' ? 10 : 5.5,
        action: () => openPlace(place.id),
      })
    }
    return list
  }, [world, enterTarget, openPlace])

  return (
    <div className="scene-root">
      <Canvas
        id="city-canvas"
        // 进楼时城市不卸载，只是停帧；出来时不用重建场景、重新编译材质
        frameloop={active ? 'always' : 'never'}
        // 阴影不跟画质档走：关掉阴影会让整座城突然变亮一档，
        // 档位跳动时画面就会「闪一下」。档位只降后处理采样数（见 AO 那段）。
        // soft = PCFSoftShadowMap，每个像素做 16 次双线性采样；
        // percentage = PCFShadowMap，只有 9 次。画面几乎看不出差别，
        // 但它是片元着色器里最贵的一段循环（阴影要在每个受光材质里采样）。
        shadows="percentage"
        // 像素比固定：dpr 一变，整块 canvas 的绘制缓冲和后处理链的 render
        // target 都要重建，重建的那几帧尺寸对不上，画面会既模糊又叠着上一帧。
        // 1.25 时 1920 宽的窗口要画 2400×1350 = 324 万像素，
        // 而整条管线是"逐像素光照"（PBR + IBL + 3 盏点光 + 阴影采样），
        // 帧时间和像素数几乎成正比：1.0 直接省掉 36% 的填充量。
        // 风格化：Retina 屏上 dpr 1 等于半分辨率渲染再放大，锯齿台阶翻倍、细线时有时无。
        // 省下的 AO / 聚光灯开销用来换 1.5 倍分辨率。
        dpr={STYLIZED ? Math.min(window.devicePixelRatio || 1, 1.25) : 1}
        camera={{ fov: 62, near: 0.45, far: 1100, position: [0, 4, 34] }}
        // stencil：角色被遮挡时的剪影靠模板缓冲区分"被别的东西挡住"和"自己挡自己"
        // antialias 关掉：真正的抗锯齿是后处理里的 SMAA，EffectComposer
        // 渲染到自己的 render target（multisampling={0}），默认帧缓冲的 MSAA
        // 一点也用不上，只白占显存和解析开销。
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: true }}
        onCreated={({ gl, scene }) => {
          if (import.meta.env.DEV) {
            ;(window as unknown as Record<string, unknown>).__scene = scene
            ;(window as unknown as Record<string, unknown>).__gl = gl
          }
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = p.exposure
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
      >
        <Suspense fallback={null}>
          <ExposureSync value={p.exposure} />
          <BuildingLodController />
          {/* 阴影相机固定在城区中心。
              原来它跟着玩家平移（每 16m 吸附一格），整片建筑的影子就会随
              人物走动一格一格地挪——看起来像"影子在跟着人动"，其实是阴影
              贴图重投影了。城区只有 300m 见方，一次覆盖住就不会再有这个现象。 */}
          <Environment night={night} shadowExtent={190} shadowFollow={false} shadowCenter={[0, 0]} />
          {/* 光源数量必须从第一帧起固定，见 StablePointLights 的说明 */}
          <StablePointLights night={night} />
          {/* 地面和河面也是几百个零散 mesh（车道线、路缘、贴花、栏柱），
              合批前是几百次 draw call。它们不在任何分组里时会全部落在首帧，
              所以一样要分批。 */}
          <Stagger name="base">
            <Ground />
            <Water />
            <Parks night={night} />
          </Stagger>
          <Stagger name="ferris">
            <FerrisWheel />
          </Stagger>
          <Stagger name="plaza-steps">
            <PlazaSteps night={night} />
          </Stagger>
          <PerfLog counts={PERF_COUNTS} />
          <FarCity defs={buildings} night={night} />
          <RoofProps defs={buildings} night={night} />
          {buildings.map((building) =>
            building.background ? (
              <Stagger key={building.id} name="infill">
                <InfillBuilding def={building} />
              </Stagger>
            ) : (
              <Stagger key={building.id} name="building">
                <Building def={building} />
              </Stagger>
            ),
          )}
          <Stagger name="billboards">
            <Billboards />
          </Stagger>
          <Stagger name="neon">
            <Neon night={night} />
          </Stagger>
          <Stagger name="facade">
            <FacadeDetail night={night} />
          </Stagger>
          <Stagger name="bridges">
            <SkyBridges />
          </Stagger>
          {/* CityProps 不套 Stagger：它内部的街具各自分批，但路灯（一批聚光灯）
              必须在首帧就挂上——聚光灯数量一变，整城材质又要重编译一次。 */}
          <CityProps />
          <Stagger name="greenery">
            <Greenery night={night} />
          </Stagger>
          <Stagger name="street">
            <StreetDetail night={night} />
            <StreetGate night={night} />
          </Stagger>
          <Stagger name="pedestrian">
            <PedestrianStreet night={night} />
          </Stagger>
          <Stagger name="traffic">
            <Traffic />
            <Transit />
          </Stagger>
          <FarHide limit={110}>
            <Stagger name="citizens">
              <Citizens />
            </Stagger>
            <Stagger name="stalls">
              <Stalls />
            </Stagger>
          </FarHide>
          <Stagger name="shopfronts">
            <ShopFronts />
          </Stagger>
          <FarHide limit={110}>
            <Stagger name="npcs">
              <Npcs list={[...npcs, ...stallVendors]} />
            </Stagger>
          </FarHide>
          <Stagger name="notices">
            {world?.places
              .filter((place) => place.id !== 'gallery-lobby' && place.id !== 'corner-cafe')
              .map((place) => {
                const [bx, bz] = noticeSpot(place.x, place.z)
                const yaw = bx === place.x && bz === place.z ? 0 : Math.atan2(place.x - bx, place.z - bz)
                return <NoticeBoard key={`board-${place.id}`} x={bx} z={bz} yaw={yaw} seed={place.id} />
              })}
          </Stagger>
          {/* 烟花不套 Stagger：它自带一盏闪光点光，灯的数量必须首帧就固定 */}
          <Fireworks />
          {launcher && (
            <Marker
              x={launcher.x + 1.4}
              z={launcher.z}
              y={launcher.y + 2.2}
              title="烟花发射台"
              subtitle="认领空间的用户可点火"
              tone="place"
              actionId="fireworks"
              onOpen={launchFireworks}
            />
          )}

          <Marker
            x={boardSpot.x}
            z={boardSpot.z}
            y={2.6}
            title="摩天轮"
            subtitle="按 E 乘坐"
            tone="place"
            actionId="ferris-board"
            onOpen={boardFerris}
          />

          {/* 图鉴亭：一个真的能走到的地点，而不是菜单里的一个按钮 */}
          <CatalogBooth x={CATALOG_SPOT[0]} z={CATALOG_SPOT[1]} yaw={CATALOG_YAW} />
          <EntrancePortal x={CATALOG_FRONT.x} z={CATALOG_FRONT.z} color="#ffce9a" strength={0.9} />
          <Marker
            x={CATALOG_SPOT[0]}
            y={3.0}
            z={CATALOG_SPOT[1]}
            title="宠物图鉴"
            subtitle="按 E 翻阅"
            tone="kiosk"
            actionId="catalog-booth"
            onOpen={() => useApp.getState().openPanel({ type: 'catalog' })}
          />
          {world?.places
            .filter((place) => place.id !== 'gallery-lobby' && place.id !== 'corner-cafe')
            .map((place) => (
              <Marker
                key={place.id}
                x={place.x}
                y={place.kind === 'plaza' ? 5.2 : 2.6}
                z={place.z}
                title={place.name}
                subtitle={`${place.postCount} 条留言`}
                tone="place"
                actionId={`place-${place.id}`}
                onOpen={() => openPlace(place.id)}
              />
            ))}

          {/* 1 楼店铺的门头：一块牌子 + 门口一束暖光，和楼栋入口分开 */}
          {shops.map((shop) => {
            const door = shopDoor(shop)
            return (
              <group key={`shop-${shop.id}`}>
                <EntrancePortal x={door.x} z={door.z} color="#ffce9a" strength={0.55} />
                <Marker
                  x={door.x}
                  z={door.z}
                  y={2.05}
                  title={shop.name}
                  subtitle={shop.blurb}
                  tone="space"
                  actionId={`shop-${shop.id}`}
                  onOpen={() => enterTarget({ kind: 'shop', id: shop.id })}
                />
              </group>
            )
          })}

          {buildings
            .filter((building) => !building.background)            .filter((building) => isUnitBuilding(building.id) || (building.target && building.entranceAt))
            .map((building) => {
              if (isUnitBuilding(building.id)) {
                return (
                  <group key={`entrance-${building.id}`}>
                    {unitEntrances(building).map((e) => (
                      <group key={e.core}>
                        <EntrancePortal x={e.x} z={e.z} color={building.accent ?? '#8fd0ff'} />
                        <Marker
                          x={e.x}
                          z={e.z}
                          y={2.1}
                          title={e.label}
                          subtitle={e.hint}
                          tone="entrance"
                          actionId={`entrance-${building.id}-${e.core}`}
                          onOpen={() => enterTarget({ kind: 'building', id: building.id, core: e.core }, e.label)}
                        />
                      </group>
                    ))}
                  </group>
                )
              }
              const entrance = entranceOf(building)
              const [outX, outZ] = entranceApproach(building, entrance)
              const space =
                building.target?.kind === 'space'
                  ? world?.spaces.find((item) => item.id === building.target!.id)
                  : null
              const subtitle =
                building.target?.kind === 'space'
                  ? space?.owner
                    ? `${space.owner.name} 的空间`
                    : '可认领 · 样板陈设'
                  : building.entranceUse || '公共室内'
              return (
                <group key={`entrance-${building.id}`}>
                  <EntrancePortal
                    x={outX}
                    z={outZ}
                    color={building.target?.kind === 'space' ? (building.accent ?? '#c3b6ff') : '#9fd8ff'}
                  />
                  <Marker
                    x={outX}
                    z={outZ}
                    y={2.1}
                    title={building.entranceLabel || building.name}
                    subtitle={subtitle}
                    tone={building.target?.kind === 'space' ? 'space' : 'entrance'}
                    actionId={`entrance-${building.id}`}
                    onOpen={() => enterTarget(building.target!, building.entranceLabel || building.name)}
                  />
                </group>
              )
            })}

          <StaticMerge version={night ? 2 : 1} />
          <ScenePrewarm />
          <ShadowBudget />
          <AdaptiveNear />
          <WildPets />
          <QualityTuner />
          {import.meta.env.DEV && perf && <PerfMonitor />}

          <PlayerRig
            colliders={[
              ...colliders,
              ...pondColliders,
              {
                minX: plazaFountain.x - plazaFountain.r - 0.3,
                maxX: plazaFountain.x + plazaFountain.r + 0.3,
                minZ: plazaFountain.z - plazaFountain.r - 0.3,
                maxZ: plazaFountain.z + plazaFountain.r + 0.3,
                minY: 0,
                maxY: 4,
              },
              {
                minX: PLAZA_STEPS.x - PLAZA_STEPS.w / 2 - 0.5,
                maxX: PLAZA_STEPS.x + PLAZA_STEPS.w / 2 + 0.5,
                minZ: PLAZA_STEPS.z - PLAZA_STEPS.d / 2,
                maxZ: PLAZA_STEPS.z + PLAZA_STEPS.d / 2,
                minY: 0,
                maxY: PLAZA_STEPS.rise * PLAZA_STEPS.count,
              },
            ]}
            bounds={{ minX: -WALK_BOUNDS, maxX: WALK_BOUNDS, minZ: -WALK_BOUNDS, maxZ: WALK_BOUNDS }}
            interactables={interactables}
            liveInteractables={petInteractables}
            cameraDistance={5.6}
          />
        </Suspense>
        {/* 后处理常开。以前它挂在 quality > 0 里：帧率掉到 26fps 以下时
            QualityTuner 会把档位降到 0，整条链（曲线、调色、AO、Bloom）一起消失，
            画面就从「暗」跳成「发灰过曝」，帧率上来又跳回去——这就是
            "有时候亮、有时候暗"的来源。现在档位只改这里的采样数，
            色调永远是同一条。 */}
        <Defer frames={2}>
        {!noFx && (
        <EffectComposer
          stencilBuffer
          multisampling={0}
        >
          {/* 时间抗锯齿，必须排第一位：它读 RenderPass 刚画完的 HDR 颜色和深度。
              细小线条的锯齿在这里解决，后面的 SMAA 只补几何边缘的漏网之鱼。 */}
          <TemporalAA resetKey={`${screen}:${active}`} />
          {/* 窗框、楼层线、灯带这类细长几何在移动时是典型的边缘走样；
              SMAA 只在边缘做形态学抗锯齿，比全程 4x MSAA 便宜得多。
              移动端修复过一次：multisampling={4} 在这条 half-float 链上
              在 Apple GPU 上直接把上下文顶掉了（整屏黑），别再加回去。
              preset 只当"上限"，实际档位由下面的 PostQuality 按 quality 调。 */}
          <SMAA ref={smaaRef as never} preset={STYLIZED ? SMAAPreset.HIGH : SMAAPreset.MEDIUM} />
          {/* 环境光遮蔽：墙角、树根、车底、雨棚下面本来就该更暗。
              没有它，所有物体都像"浮"在地面上，这是廉价感最大的来源之一。
              用 N8AO 而不是 SSAO：SSAO 的采样半径只有几厘米、点位几乎重合，
              在柜子/路灯/墙角外面会围一圈黑色噪点；N8AO 自带泊松去噪，
              半径按米级给，暗部是连续的。 */}
          <CheapAo night={night} quality={quality} />
          <Bloom
            ref={bloomRef}
            // 阈值别太松：只有真正亮的灯和橱窗才该晕开，
            // 否则整城像隔着一层毛玻璃，什么细节都糊掉。
            // 路灯照亮的路面只该亮，不该发光——阈值压在灯头亮度之上。
            // 抬到 0.92：招牌贴图的画法已经自带硬边光晕，再让 Bloom 摊一遍
            // 就等于把字糊两层。
            // 风格化：只让真正的发光体（窗、招牌）有一圈紧的晕，半径收小，不糊成雾
            luminanceThreshold={STYLIZED ? (night ? 0.8 : 0.95) : night ? 0.92 : 0.9}
            luminanceSmoothing={STYLIZED ? 0.08 : 0.18}
            intensity={STYLIZED ? (night ? 0.32 : 0.12) : night ? 0.3 : 0.2}
            mipmapBlur
            radius={STYLIZED ? 0.38 : 0.58}
          />
          {/* 唯一的调色：曝光 + 胶片曲线 + 冷暖分离 + 对比 + 抬黑。
              亮度/对比/饱和都收在这一个 pass 里，不再叠加 BrightnessContrast
              和 HueSaturation——叠两层的结果是调一个、另一个跟着变。 */}
          <Grade night={night} />
          {/* 挂在这里（而不是 CityScene 里）：它必须等 SMAA / Bloom 真正
              实例化之后才能改参数，见 PostQuality 的注释。 */}
          <PostQuality quality={quality} smaa={smaaRef} bloom={bloomRef} />
          {/* 画框：把边缘压暗一圈，视线才会落在画面中心。
             但 canvas 上面还有一层 CSS 的 .vignette-soft 遮罩，两层叠起来
              就是"圆形光圈"——俯视全城时四周全是黑的。着色器这层只留
              极轻的一档，边缘压暗交给 CSS 那一层统一做。 */}
          <Vignette offset={0.52} darkness={night ? 0.08 : 0.28} eskil={false} />
        </EffectComposer>
        )}
        </Defer>
      </Canvas>
    </div>
  )
}
