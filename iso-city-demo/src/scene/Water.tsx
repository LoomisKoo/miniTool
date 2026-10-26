import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { dock, ferrisWheel, river, riverCrossings, riverSegments, riverwalk } from '../data/city'
import { makePavingTexture, makeWaterNormalTexture } from './textures'
import { palettes } from './theme'
import { useApp } from '../store'

/**
 * 社区的小河。
 *
 * 城市底盘是一整块 560m 的平面，河道不能真的挖下去，所以做法是：
 * 水面比地面高 5cm 铺上去，两岸各立一道 0.35m 的石驳岸把它"框"进河槽里，
 * 视觉上就读成一条下沉的河，而不是地上的一滩水。
 *
 * 主街跨河这一段没做抬高的桥面，而是路面高度的堤道：水面被切成东西两半，
 * 车流、行人照常沿 y≈0.02 通过——抬桥面的话车会从桥底钻过去。
 *
 * 夜里的水面以前只有环境反射：直勾勾往下看是一块纯黑，只有低头掠射时才
 * 蹭到一点天光，"水池"就成了地上的一个洞。现在材质上补了三层东西：
 *   1. 菲涅尔项 —— 越平视越亮，任何角度都有一点天光；
 *   2. 三层不同速度的波纹高光 —— 让光在水面上流动而不是一块死板的镜面；
 *   3. 岸边暖色的倒影带 —— 路灯和摩天轮的光落进水里的那一层。
 */

const vertexCommon = /* glsl */ `
  varying vec3 vWaterPos;
`

const fragmentCommon = /* glsl */ `
  varying vec3 vWaterPos;
  uniform float uTime;
uniform float uNight;
uniform vec3 uSky;
uniform vec3 uWarm;
uniform vec2 uWheel;
`

/** 插在 <emissivemap_fragment> 之后：直接往自发光上叠水面高光。 */
const fragmentGlow = /* glsl */ `
  vec2 wp = vWaterPos.xz;
  float t = uTime;

  // 三层横条纹波：水面的反射光天然是沿 x 拉长的细条，不是均匀的噪点
  float w1 = sin(wp.x * 0.62 + sin(wp.y * 0.26 + t * 0.32) * 2.4 + t * 0.55);
  float w2 = sin(wp.x * 1.45 + wp.y * 0.85 - t * 0.95);
  float w3 = sin(wp.x * 0.17 - wp.y * 0.55 + t * 0.2);
  float ripple = w1 * 0.52 + w2 * 0.26 + w3 * 0.22;
  // 阈值抬高、过渡收窄：只有波峰顶端一点点反光，其余是深水。
  // 之前 smoothstep(0.42, 1.0) 会把半条河都铺上亮条，看起来像一层贴纸。
  float crest = smoothstep(0.62, 0.96, ripple * 0.5 + 0.5);
  crest *= crest;

  // 掠射角越亮（菲涅尔）
  vec3 V = normalize(cameraPosition - vWaterPos);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);

  // 离岸越近越浅：给水面一点深度层次，不然就是一整块颜色
  float bankDist = min(wp.y - 74.0, 100.0 - wp.y);
  float bank = 1.0 - smoothstep(0.0, 9.0, bankDist);

  // 天光只在掠射角上出现，而且要淡：水本身是暗的，
  // 把它整体刷亮就变成一块蓝色塑料板。
  vec3 base = uSky * fres * (0.20 + bank * 0.22);

  // 岸上的灯（含摩天轮）落进水里的那一条暖光：只贴着岸边存在
  vec3 warm = uWarm * fres * crest * (0.10 + bank * 0.34);

  // 岸灯的倒影：一条条被水面拉长的竖向光柱。真实水面上，灯是高光里最亮的一层，
  // 没有它的时候整条河只有一层灰蓝，看就是一块板。
  float lampBand = smoothstep(0.8, 1.0, sin(wp.x * 0.42 + sin(wp.y * 0.31 + t * 0.6) * 1.7) * 0.5 + 0.5);
  lampBand *= lampBand;
  vec3 lampCol = mix(vec3(1.0, 0.62, 0.28), vec3(0.42, 0.82, 1.0), 0.5 + 0.5 * sin(wp.x * 0.05));
  warm += lampCol * lampBand * crest * (0.06 + bank * 0.5);

  // 摩天轮的倒影：轮子在北岸，水面下应该有一团彩色的碎光。
  // 离轮子越近越亮，并且跟着波纹闪，才不会读成"地上贴了一片彩色贴纸"。
  vec2 wd = vec2(wp.x - uWheel.x, (wp.y - uWheel.y) * 1.9);
  float wheelMask = exp(-pow(length(wd) / 30.0, 2.0));
  float wheelSparkle = crest * (0.55 + 0.45 * sin(wp.x * 1.9 + wp.y * 1.1 + t * 1.7));
  vec3 wheelCol = mix(vec3(0.30, 0.85, 1.0), vec3(1.0, 0.42, 0.72), 0.5 + 0.5 * sin(wp.x * 0.11 + t * 0.12));
  warm += wheelCol * wheelSparkle * wheelMask * 0.9;

  float amount = mix(0.5, 1.0, uNight);
  totalEmissiveRadiance += (base + warm) * (0.32 + crest * 0.8) * amount;
`

export function Water() {
  const night = useApp((state) => state.night)
  const palette = night ? palettes.night : palettes.dusk

  const normal = useMemo(() => makeWaterNormalTexture(256, 1), [])
  useEffect(() => () => normal.dispose(), [normal])

  const paving = useMemo(
    () => makePavingTexture(palette.paving, palette.pavingLine),
    [palette.paving, palette.pavingLine],
  )
  useEffect(() => () => paving.dispose(), [paving])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNight: { value: night ? 1 : 0 },
      uSky: { value: new THREE.Color(night ? '#6f93a8' : '#cfe3ea') },
      uWarm: { value: new THREE.Color(night ? '#ffcf96' : '#fff1d8') },
      uWheel: { value: new THREE.Vector2(ferrisWheel.x, ferrisWheel.z) },
    }),
    // 只建一次，颜色和昼夜强度在下面的 effect 里改
    [],
  )

  /** 水面高光贴图：一张细密的横条，让法线扰动时的高光碎成粼粼的一片。 */
  const material = useMemo(() => {
    const map = normal.clone()
    map.needsUpdate = true
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    // 波纹密度：比岸边尺度的碎石细一些，俯视时才有"水在动"的细节
    map.repeat.set(34, 9)
    // 轻微旋转：正横平竖直的波纹在高处看是规则的网格
    map.rotation = 0.09
    const mat = new THREE.MeshStandardMaterial({
      // 夜里是很深的墨绿蓝，几乎黑；之前 #123039 配上高 envMapIntensity
      // 是一片饱和的蓝绿，像蓝色塑料板。
      color: night ? '#0b171c' : '#2b4a52',
      roughness: night ? 0.22 : 0.3,
      metalness: 0,
      normalMap: map,
      normalScale: new THREE.Vector2(0.42, 0.42),
      // 环境反射只是给水面一点层次，不能当主色
      envMapIntensity: night ? 0.55 : 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -16,
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime
      shader.uniforms.uNight = uniforms.uNight
      shader.uniforms.uSky = uniforms.uSky
      shader.uniforms.uWarm = uniforms.uWarm
      shader.uniforms.uWheel = uniforms.uWheel
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${vertexCommon}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${fragmentCommon}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${fragmentGlow}`)
    }
    return mat
    // night 只影响颜色，重建会丢掉编译好的着色器，所以下面用 effect 改
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normal, uniforms])

  /* 昼夜切换只改 uniform 和颜色，不重建材质（重建会重新编译着色器，切换时卡一下） */
  useEffect(() => {
    material.color.set(night ? '#0b171c' : '#2b4a52')
    material.roughness = night ? 0.22 : 0.3
    material.envMapIntensity = night ? 0.55 : 0.5
    uniforms.uNight.value = night ? 1 : 0
    uniforms.uSky.value.set(night ? '#6f93a8' : '#cfe3ea')
    uniforms.uWarm.value.set(night ? '#ffcf96' : '#fff1d8')
  }, [night, material, uniforms])

  useEffect(
    () => () => {
      material.normalMap?.dispose()
      material.dispose()
    },
    [material],
  )

  // 水面缓慢流动：只挪贴图，不动几何
  const flow = useRef(0)
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    flow.current += dt
    uniforms.uTime.value = flow.current
    const map = material.normalMap
    if (!map) return
    const t = flow.current
    map.offset.set(t * 0.012, Math.sin(t * 0.11) * 0.03)
  })

  const stone = night ? '#39434a' : '#a8a49a'
  const parapet = night ? '#4a555d' : '#bdb7aa'

  return (
    <group>
      {/* 水面：在每条跨河车道处断开 */}
      {riverSegments.map(([x0, x1]) => (
        <mesh
          key={`water${x0}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[(x0 + x1) / 2, 0.05, river.z]}
          material={material}
          receiveShadow
        >
          <planeGeometry args={[x1 - x0, river.d]} />
        </mesh>
      ))}

      {/* 水线：贴着驳岸的一道细亮边，把"水面"和"岸"咬在一起，
          不然水平面像一张悬在地面上方 5cm 的纸 */}
      {[-1, 1].map((side) =>
        riverSegments.map(([x0, x1]) => (
          <mesh
            key={`foam-${side}-${x0}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[(x0 + x1) / 2, 0.055, river.z + side * (river.d / 2 - 0.55)]}
          >
            <planeGeometry args={[x1 - x0, 1.1]} />
            {/* 水线以前是一道发光的白边，把整条河框成一条"灯带"。
                现在只在水与岸的交界留一点点亮，边界靠驳岸本身的明暗交代。 */}
            <meshBasicMaterial
              color={night ? '#7f97a2' : '#e8f2f0'}
              transparent
              opacity={night ? 0.1 : 0.28}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        )),
      )}

      {/* 南北驳岸：堤道位置断开 */}
      {[-1, 1].map((side) =>
        riverSegments.map(([x0, x1]) => (
          <mesh
            key={`bank-${side}-${x0}`}
            position={[(x0 + x1) / 2, 0.17, river.z + side * (river.d / 2)]}
            receiveShadow
          >
            <boxGeometry args={[x1 - x0, 0.34, 0.7]} />
            <meshStandardMaterial color={stone} roughness={0.86} metalness={0.06} />
          </mesh>
        )),
      )}

      {/* 每条堤道两侧的矮护栏 */}
      {riverCrossings.flatMap((c) =>
        [-1, 1].map((sx) => {
          const x = c.x + sx * (c.w / 2)
          return (
            <group key={`rail${c.x}-${sx}`}>
              <mesh position={[x, 0.3, river.z]}>
                <boxGeometry args={[0.6, 0.6, river.d]} />
                <meshStandardMaterial color={stone} roughness={0.86} metalness={0.06} />
              </mesh>
              {Array.from({ length: 7 }).map((_, i) => (
                <mesh key={i} position={[x, 0.66, river.z - river.d / 2 + 2 + i * ((river.d - 4) / 6)]}>
                  <boxGeometry args={[0.16, 0.62, 0.16]} />
                  <meshStandardMaterial color={parapet} roughness={0.5} metalness={0.35} />
                </mesh>
              ))}
            </group>
          )
        }),
      )}

      {/* 河岸步道（北岸）：铺装带，靠河一侧就是驳岸 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.038, riverwalk.z]} receiveShadow>
        <planeGeometry args={[river.w, riverwalk.d]} />
        <meshStandardMaterial
          map={paving}
          color="#ffffff"
          roughness={0.86}
          metalness={0.03}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-8}
        />
      </mesh>

      {/* 码头：北岸伸出水面的木平台 + 系船柱 */}
      <group position={[dock.x, 0, dock.z]}>
        <mesh position={[0, 0.08, 2.4]} receiveShadow>
          <boxGeometry args={[7, 0.16, 5]} />
          <meshStandardMaterial color={night ? '#3b3a34' : '#9c8d75'} roughness={0.85} />
        </mesh>
        {[-3.2, 0, 3.2].map((x) => (
          <mesh key={x} position={[x, -0.15, 4.6]}>
            <cylinderGeometry args={[0.12, 0.12, 0.9, 8]} />
            <meshStandardMaterial color={stone} roughness={0.8} />
          </mesh>
        ))}
        {[
          [-3.3, 4.7],
          [3.3, 4.7],
        ].map(([x, z]) => (
          <mesh key={`post${x}`} position={[x, 0.5, z]}>
            <cylinderGeometry args={[0.09, 0.11, 0.7, 8]} />
            <meshStandardMaterial color={night ? '#2d3a44' : '#6f6a60'} roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
