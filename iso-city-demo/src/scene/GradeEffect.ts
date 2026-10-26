import { Effect } from 'postprocessing'
import { Uniform, Vector3 } from 'three'

/**
 * 全片唯一的调色 + 曝光。
 *
 * 为什么曝光也放在这里：@react-three/postprocessing 的 EffectComposer 一挂载
 * 就会把 renderer.toneMapping 设成 NoToneMapping（卸载时才还原），
 * 所以 gl.toneMappingExposure 在后处理开着的时候是个没人读的死参数。
 *
 * 调色放在「感知空间」而不是线性空间：
 * 线性亮度 0.02 和 0.04 在屏幕上只差 6 级灰，但比值差一倍；
 * 围着一个枢轴拉对比度时，这两个值一个被推成负数、一个几乎不动，
 * 于是暗部要么死黑要么整片发灰。回到 sRGB 感知空间做对比/色调，
 * 枢轴 0.42 才真的是"中灰"，深色物体保住形体、夜空也保住黑。
 */
const fragment = /* glsl */ `
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uPivot;
uniform float uLift;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;

const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);

// ACES filmic 近似（Narkowicz 2015）。
// 关键作用是「肩部」：1.0 以上的能量被平滑压回 1.0 附近，而不是硬切成 255；
// 同时脚部有一个斜率，暗部不会被压成一段常数。
vec3 tonemap( vec3 x ) {
  return clamp( ( x * ( 2.51 * x + 0.03 ) ) / ( x * ( 2.43 * x + 0.59 ) + 0.14 ), 0.0, 1.0 );
}

void mainImage( const in vec4 inputColor, const in vec2 uv, out vec4 outputColor ) {
  // 1. 曝光 + 曲线
  vec3 c = tonemap( max( inputColor.rgb, 0.0 ) * uExposure );

  // 2. 转到感知空间（gamma 2.2 近似 sRGB），后续调色都在这里做
  c = pow( c, vec3( 0.4545 ) );

  // 3. 分离色调：暗部偏青、高光偏暖
  float l = dot( c, LUM );
  vec3 tinted = mix( uShadowTint, uHighlightTint, smoothstep( 0.05, 0.85, l ) );
  c *= tinted;

  // 4. 对比。枢轴 0.42 在感知空间就是标准中灰，两侧拉伸不会把暗部推成负数。
  c = ( c - uPivot ) * uContrast + uPivot;

  // 柔和肩部，把 overshoot 收回来
  vec3 cc = clamp( c, 0.0, 1.0 );
  c = mix( c, cc * cc * ( 3.0 - 2.0 * cc ), 0.25 );

  // 5. 饱和
  l = dot( c, LUM );
  c = mix( vec3( l ), c, uSaturation );

  // 6. 抬黑：只在感知空间加一点点。这里加 0.05 约等于屏幕上 3 级灰，
  //    不会让夜空变成灰底；真正让暗色物体可读的是上面"在感知空间拉对比"。
  c = c + vec3( 0.05, 0.062, 0.078 ) * uLift * ( 1.0 - c );

  // 7. 回到线性，交给最终的色彩空间转换
  c = pow( max( c, 0.0 ), vec3( 2.2 ) );

  outputColor = vec4( clamp( c, 0.0, 1.0 ), inputColor.a );
}
`

export class GradeEffect extends Effect {
  constructor({
    exposure = 1.26,
    contrast = 1.12,
    saturation = 1.06,
    pivot = 0.42,
    // 感知空间的抬黑系数：0.12 大约把纯黑提到 2~3 级灰
    lift = 0.12,
    shadow = [0.86, 0.96, 1.12] as [number, number, number],
    highlight = [1.07, 1.02, 0.96] as [number, number, number],
  } = {}) {
    super('GradeEffect', fragment, {
      uniforms: new Map<string, Uniform>([
        ['uExposure', new Uniform(exposure)],
        ['uContrast', new Uniform(contrast)],
        ['uSaturation', new Uniform(saturation)],
        ['uPivot', new Uniform(pivot)],
        ['uLift', new Uniform(lift)],
        ['uShadowTint', new Uniform(new Vector3(...shadow))],
        ['uHighlightTint', new Uniform(new Vector3(...highlight))],
      ]),
    })
  }
}
