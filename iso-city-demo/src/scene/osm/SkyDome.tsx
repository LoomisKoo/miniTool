import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// 自己的天空穹顶。
//
// 为什么不用 drei 的 Sky：它是按大气散射物理算的，地平线颜色由 turbidity /
// rayleigh 决定，我们没法精确控制。而地面要靠 fog 融进地平线，fog 颜色一旦和
// 天空地平线对不上，远处就会出现一条「白带 + 天花板」的接缝。
//
// 所以这里反过来：先定地平线颜色，让它同时作为 fog 色，再由它往上推到天顶。
// 接缝就没了。顺带把太阳/月亮和夜里的星一起画进去，不需要额外 sprite。
//
// 关键：穹顶是**固定的世界空间球**，不跟随相机。
// 早期版本在 useFrame 里把穹顶搬到相机位置，而相机位置是在 PlayerRig 的
// useFrame 里更新的——两个 useFrame 的注册顺序决定了穹顶总是慢一帧，
// 于是移动时星星、月亮、太阳整片跟着抖。现在改成：
//   * 球体足够大（半径 9000），玩家永远在内部，不需要搬；
//   * 顶点着色器把深度钉到远平面，超出 far 的部分也不会被裁掉；
//   * 方向 = 世界坐标 - 相机位置，所以视差只有玩家移动那几米，肉眼不看不出。

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4( position, 1.0 );
  // 用世界坐标减相机位置求方向：球不必跟着相机，也不会产生"跟着走"的错觉
  vDir = world.xyz - cameraPosition;

  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;

  // 钉到远平面上。depthTest 已关闭，所以这里只影响裁剪：
  // 半径 9000 的球远侧远超 far=2600，不钉的话会被 far 面切出一个洞。
  gl_Position.z = gl_Position.w * 0.9999995;
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunGain;
uniform float uMoon;
uniform float uStars;

varying vec3 vDir;

float hash( vec3 p ) {
  return fract( sin( dot( p, vec3( 12.9898, 78.233, 45.164 ) ) ) * 43758.5453 );
}

void main() {
  vec3 dir = normalize( vDir );
  float h = clamp( dir.y, -1.0, 1.0 );

  // 地平线 → 天顶：用 pow 让渐变集中在地平线附近
  vec3 col = mix( uHorizon, uZenith, pow( clamp( h, 0.0, 1.0 ), 0.5 ) );
  // 地平线以下给一层略暗的雾，和地面衔接
  col = mix( col, uHorizon * 0.9, clamp( -h * 4.0, 0.0, 1.0 ) );

  float cosA = dot( dir, normalize( uSunDir ) );
  float disc = pow( max( cosA, 0.0 ), uMoon > 0.5 ? 2600.0 : 1400.0 );
  float halo = pow( max( cosA, 0.0 ), uMoon > 0.5 ? 90.0 : 26.0 );
  col += uSunColor * ( disc * 1.6 + halo * 0.18 ) * uSunGain;

  if ( uStars > 0.5 && h > 0.02 ) {
    // 星点：把方向量化成网格，再按格随机会不会亮
    vec3 grid = floor( dir * 320.0 );
    float r = hash( grid );
    if ( r > 0.9985 ) {
      float twinkle = 0.55 + 0.45 * hash( grid + 1.7 );
      col += vec3( 0.72, 0.82, 1.0 ) * twinkle * ( 0.5 + 0.5 * h );
    }
  }

  gl_FragColor = vec4( col, 1.0 );
  // 自定义 shader 不会自动做色调映射和输出色彩空间转换，
  // 少这两行的话天空会比场景其他部分亮一档 / 偏色。
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export type SkyDomeOptions = {
  night: boolean
  /** 必须和 fog 颜色一致，否则地平线会有一条接缝 */
  horizon: string
  zenith: string
  sunDir: [number, number, number]
  sunColor: string
  sunGain: number
  /** 天穹中心，一般是地图中心；球半径远大于地图，摆哪儿都不影响视角 */
  center?: [number, number]
}

export function SkyDome({
  night,
  horizon,
  zenith,
  sunDir,
  sunColor,
  sunGain,
  center = [0, 0],
}: SkyDomeOptions) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color(zenith) },
          uHorizon: { value: new THREE.Color(horizon) },
          uSunDir: { value: new THREE.Vector3(...sunDir) },
          uSunColor: { value: new THREE.Color(sunColor) },
          uSunGain: { value: sunGain },
          uMoon: { value: night ? 1 : 0 },
          uStars: { value: night ? 1 : 0 },
        },
      }),
    [night, horizon, zenith, sunDir, sunColor, sunGain],
  )

  // 换主题时材质会重建，旧的必须释放
  const previous = useRef<THREE.ShaderMaterial | null>(null)
  if (previous.current && previous.current !== material) previous.current.dispose()
  previous.current = material
  useEffect(() => () => material.dispose(), [material])

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 48, 32), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[center[0], 0, center[1]]}
      // 半径 9000：玩家在任何位置都在球内，且方向近似无穷远
      scale={9000}
      renderOrder={-100}
      frustumCulled={false}
    />
  )
}
