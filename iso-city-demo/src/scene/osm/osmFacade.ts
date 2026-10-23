import * as THREE from 'three'

// OSM 白模的立面材质。
//
// 和手写城市的 `facade.ts` 不同：那边每栋楼是一个已知宽高的盒子，可以传
// uSpanX / uSpanZ；这里的楼是任意多边形轮廓，而且一个 chunk 里几十栋合并成
// 一个网格，没法逐栋传参。所以改成：
//
// * 窗格的横向坐标由「世界坐标沿面法线的切线投影」算出，任意多边形都连续；
// * 每栋楼的结构类型 / 高度 / 随机种子 / 墙体颜色烘焙成顶点属性，合并后各自独立；
// * 结构分五种（开窗 / 阳台 / 带窗 / 幕墙 / 实墙）。这是关键：真实街区里
//   大部分楼不是玻璃盒子，如果每栋都画满窗格，整座城市就会读成一张格子布。
// * 屋顶靠法线区分，不需要额外材质。

const vertexPars = /* glsl */ `
attribute float aSeed;
attribute float aTop;
attribute float aStyle;
attribute vec3 aTint;

varying vec3 vOsmWorld;
varying vec3 vOsmNrm;
varying float vOsmSeed;
varying float vOsmTop;
varying float vOsmStyle;
varying vec3 vOsmTint;
varying float vOsmDepth;
`

const vertexMain = /* glsl */ `
vOsmWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
vOsmNrm = normalize( mat3( modelMatrix ) * normal );
vOsmSeed = aSeed;
vOsmTop = aTop;
vOsmStyle = aStyle;
vOsmTint = aTint;
vec4 osmMv = modelViewMatrix * vec4( position, 1.0 );
vOsmDepth = -osmMv.z;
`

const fragmentPars = /* glsl */ `
uniform float uOsmNight;
uniform vec3 uOsmLitWarm;
uniform vec3 uOsmLitCool;
uniform vec3 uOsmSky;
uniform float uOsmBase;
uniform float uOsmFadeStart;
uniform float uOsmFadeEnd;

varying vec3 vOsmWorld;
varying vec3 vOsmNrm;
varying float vOsmSeed;
varying float vOsmTop;
varying float vOsmStyle;
varying vec3 vOsmTint;
varying float vOsmDepth;

float osmHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

float osmNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( osmHash( i ), osmHash( i + vec2( 1.0, 0.0 ) ), u.x ),
    mix( osmHash( i + vec2( 0.0, 1.0 ) ), osmHash( i + vec2( 1.0, 1.0 ) ), u.x ),
    u.y
  );
}

/** aa 传 fwidth，窗口边缘在远处才不会闪烁。 */
float osmBand( float u, float a, float b, float aa ) {
  return smoothstep( a - aa, a + aa, u ) * ( 1.0 - smoothstep( b - aa, b + aa, u ) );
}
`

const fragmentMain = /* glsl */ `
{
  vec3 nrm = normalize( vOsmNrm );
  vec3 tint = vOsmTint;
  float seed = vOsmSeed;
  float y = vOsmWorld.y;
  float night = uOsmNight;

  vec3 outColor;
  vec3 outEmissive = vec3( 0.0 );
  float outRough = 0.9;
  float outMetal = 0.03;

  // 远处逐级丢掉高频细节，避免密集窗格缩小时读成噪点
  float far = smoothstep( uOsmFadeStart, uOsmFadeEnd, vOsmDepth );

  float style = vOsmStyle;
  float sPunch   = step( style, 0.5 );
  float sBalcony = step( 0.5, style ) * step( style, 1.5 );
  float sRibbon  = step( 1.5, style ) * step( style, 2.5 );
  float sCurtain = step( 2.5, style ) * step( style, 3.5 );
  float sBlank   = step( 3.5, style );

  if ( abs( nrm.y ) > 0.5 ) {
    // ---------- 屋顶 ----------
    float grain = osmNoise( vOsmWorld.xz * 0.8 );
    outColor = mix( tint * 0.26, tint * 0.38, grain );
    // 屋顶顺带压暗，否则夜里的楼顶是一块亮白的板
    outColor *= mix( 1.0, 0.42, night );
    outRough = 0.95;
    outMetal = 0.02;
    outColor *= mix( 0.8, 1.0, smoothstep( 0.5, 0.95, abs( nrm.y ) ) );
    outColor = mix( outColor, tint * 0.3, far );
  } else {
    // ---------- 立面 ----------
    // 沿墙面的切向坐标：任意多边形都连续，相邻墙段的窗格不会错位
    vec2 tangent = normalize( vec2( -nrm.z, nrm.x ) );
    float along = dot( vOsmWorld.xz, tangent );

    float pitch = 3.0 * sPunch + 3.6 * sBalcony + 1.7 * sRibbon + 1.45 * sCurtain + 5.2 * sBlank;
    float floorH = 3.3 * ( sPunch + sBalcony + sBlank ) + 3.6 * sRibbon + 4.0 * sCurtain;
    float base = uOsmBase * ( 1.0 + sCurtain * 0.6 );

    float colF = ( along + seed * 91.0 ) / pitch;
    float colU = fract( colF );
    float rowF = ( y - base ) / floorH;
    float rowU = fract( rowF );

    float aaX = clamp( fwidth( colF ), 0.0015, 0.35 );
    float aaY = clamp( fwidth( rowF ), 0.0015, 0.35 );

    float colId = floor( colF );
    float rowId = floor( rowF );
    float pick = osmHash( vec2( colId, rowId ) + seed * 7.31 );
    float pick2 = osmHash( vec2( rowId, colId ) + seed * 3.17 );

    float isBase = 1.0 - smoothstep( base - 0.4, base + 0.4, y );

    // ---- 各结构的窗洞 ----
    // 开窗：窗只占立面的 40% 左右，墙是主角
    float winPunch = osmBand( colU, 0.3, 0.7, aaX ) * osmBand( rowU, 0.33, 0.78, aaY );
    // 阳台：同一套窗，但要更宽，底下有板
    float winBalcony = osmBand( colU, 0.22, 0.78, aaX ) * osmBand( rowU, 0.36, 0.86, aaY );
    // 带窗：横向连续，只在竖挺处断开
    float winRibbon = ( 1.0 - osmBand( colU, 0.0, 0.07, aaX ) ) * osmBand( rowU, 0.3, 0.8, aaY );
    // 幕墙：整片玻璃，只留竖挺和层间实体带
    float winCurtain = ( 1.0 - osmBand( colU, 0.0, 0.05, aaX ) ) * osmBand( rowU, 0.0, 0.86, aaY );
    // 实墙：只有零散的小窗和通风口
    float sparse = step( 0.55, osmHash( vec2( colId, 0.0 ) + seed * 5.1 ) );
    float winBlank = osmBand( colU, 0.42, 0.58, aaX ) * osmBand( rowU, 0.42, 0.66, aaY ) * sparse;

    float win = winPunch * sPunch + winBalcony * sBalcony + winRibbon * sRibbon
              + winCurtain * sCurtain + winBlank * sBlank;

    // 有些窗是拉上窗帘 / 装了百叶，让节奏不至于机械重复
    float curtain = step( pick2, 0.16 + sBalcony * 0.1 );
    win *= 1.0 - curtain * 0.45;

    // ---- 玻璃 ----
    // 白天的玻璃是「暗一点的墙 + 天空反射」，不是黑窟窿
    vec3 skyRef = uOsmSky * ( 0.55 + 0.45 * smoothstep( 0.0, 1.0, rowU ) );
    vec3 glassCol = mix( tint * 0.26, skyRef * 1.15, 0.42 + 0.22 * sCurtain );
    glassCol *= 0.82 + 0.36 * pick;
    // 幕墙层间的实体带（spandrel）比玻璃暗
    glassCol *= mix( 1.0, 0.62, osmBand( rowU, 0.86, 1.0, aaY ) * sCurtain );

    // ---- 墙 ----
    float grain = osmNoise( vOsmWorld.xz * 1.4 + y * 0.5 );
    float streak = osmNoise( vec2( along * 1.9, y * 0.09 ) + seed * 19.0 );
    vec3 wall = tint * ( 0.9 + 0.12 * grain );
    wall *= mix( 1.0, 0.86, smoothstep( 0.35, 0.95, streak ) * 0.6 );
    // 墙脚发黑：贴地那一两米一定有积灰
    wall *= mix( 0.66, 1.0, smoothstep( 0.0, 2.4, y ) );

    // 窗洞周边的抹灰阴影（reveal），让窗看起来是凹进去的。
    // 每个结构的窗洞边界不同，边缘位置要一起算，否则会在没有窗的地方压出暗带。
    float edgeA = 0.3 * sPunch + 0.22 * sBalcony + 0.07 * sRibbon + 0.42 * sBlank;
    float edgeB = 0.7 * sPunch + 0.78 * sBalcony + 1.0 * ( sRibbon + sCurtain ) + 0.58 * sBlank;
    float revealX = min( abs( colU - edgeA ), abs( colU - edgeB ) ) * pitch;
    wall *= mix( 0.88, 1.0, clamp( revealX / 0.22, 0.0, 1.0 ) );

    // 楼层线：一层的分界处压一道细暗线
    float slab = 1.0 - osmBand( rowU, 0.0, 0.045, aaY );
    wall *= mix( 0.9, 1.0, slab );

    // 阳台板：底板亮、底板下压一道深阴影
    float balconySlab = osmBand( rowU, 0.12, 0.28, aaY );
    float balconyShadow = osmBand( rowU, 0.06, 0.13, aaY );
    wall = mix( wall, wall * 1.1, balconySlab * sBalcony );
    wall *= mix( 1.0, 0.62, balconyShadow * sBalcony );

    // 女儿墙：屋顶下沿压暗，最顶上一道浅色压顶
    float parapet = smoothstep( vOsmTop - 1.5, vOsmTop - 0.7, y );
    float cap = smoothstep( vOsmTop - 0.42, vOsmTop - 0.12, y );
    wall *= mix( 1.0, 0.72, parapet );
    wall = mix( wall, wall * 1.28 + 0.03, cap );

    // 夜里墙体整体压暗：不压的话，城市会是"白天的楼 + 亮窗"，读起来像贴纸。
    // 玻璃压得更狠，只有真亮着的窗才跳出来。
    wall *= mix( 1.0, 0.28, night );
    glassCol *= mix( 1.0, 0.34, night );

    outColor = mix( wall, glassCol, win );
    outRough = mix( 0.9, 0.12, win * ( 0.55 + sCurtain * 0.45 ) );
    outMetal = mix( 0.03, 0.62, win * ( 0.45 + sCurtain * 0.55 ) );

    // 夜间亮窗：写字楼亮得多，住宅只有零星几户
    float litRatio = 0.1 + sRibbon * 0.16 + sCurtain * 0.22 + sBalcony * 0.08;
    float lit = step( 1.0 - litRatio, pick );
    vec3 litCol = mix( uOsmLitWarm, uOsmLitCool, step( 0.5, pick2 ) );
    litCol *= 0.6 + 0.7 * pick;
    outEmissive = litCol * win * lit * night * 1.7;

    // 地面层：店面 / 门厅。开口更高，玻璃更暗，夜里一条暖光带
    if ( isBase > 0.5 ) {
      vec3 shopGlass = mix( vec3( 0.035, 0.042, 0.05 ), wall * 0.5, 0.25 );
      outColor = mix( wall * 0.95, shopGlass, win * 0.9 );
      outEmissive = uOsmLitWarm * win * night * 0.5;
      outRough = mix( 0.86, 0.3, win );
    }

    // 远处退化成平均色，去掉窗格对比
    vec3 average = tint * 0.58 + uOsmSky * 0.08;
    outColor = mix( outColor, average, far );
    outEmissive *= 1.0 - far;
  }

  diffuseColor.rgb = outColor;
  roughnessFactor = outRough;
  metalnessFactor = outMetal;
  totalEmissiveRadiance += outEmissive;
}
`

export type OsmFacadeOptions = {
  night: boolean
}

export function createOsmFacadeMaterial({ night }: OsmFacadeOptions) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.03,
    envMapIntensity: 0.85,
  })

  const uniforms = {
    uOsmNight: { value: night ? 1 : 0 },
    uOsmLitWarm: { value: new THREE.Color('#ffd9a0') },
    uOsmLitCool: { value: new THREE.Color('#cfe8ff') },
    uOsmSky: { value: new THREE.Color(night ? '#16283a' : '#8fa6bb') },
    uOsmBase: { value: 4.2 },
    uOsmFadeStart: { value: 170 },
    uOsmFadeEnd: { value: 620 },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexPars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexMain}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentPars}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${fragmentMain}`)
  }

  material.customProgramCacheKey = () => `osm-facade-v2-${night ? 'n' : 'd'}`
  return material
}
