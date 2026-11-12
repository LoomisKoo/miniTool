import * as THREE from 'three'
import { STYLIZED } from './style'

// 程序化立面：窗户、窗台、楼层线、夜间灯光全部在着色器里按几何坐标算，
// 不再为每栋楼生成几千个窗框实例。
//
// 真实感主要靠这几件事，而不是"贴图更细"：
// 1. 窗洞有真正的深度——上沿与左侧压暗、右下沿提亮，形成视差错觉；
// 2. 墙面有脏污、雨水痕、墙脚发黑、墙角压暗，不再是均匀一块颜色；
// 3. 亮窗内部有天花/地面的明暗层次，有的窗拉了一半窗帘；
// 4. 砖石楼有砖缝、石材板缝、楼层线；幕墙有竖向竖挺；
// 5. 远处按距离逐级丢掉高频细节，只留窗格大色块，避免摩尔纹闪烁。

export type FacadeStyle = 'stone' | 'glass' | 'metal' | 'brick'

export type FacadeOptions = {
  wall: THREE.Color | string
  trim: THREE.Color | string
  glass: THREE.Color | string
  litWarm: string
  litCool: string
  style: FacadeStyle
  night: boolean
  width: number
  depth: number
  height: number
  /** 窗格起始高度：首层留给店面 */
  base?: number
  /** 覆盖风格自带的层高：楼内户按 3.3m 对齐时用 */
  floorH?: number
  /** 切角占掉的墙角宽度，窗格要向内让开，否则会被削角切掉半扇窗 */
  inset?: number
  seed?: number
  fadeStart?: number
  fadeEnd?: number
  /** 哪个方向是山墙（无窗的侧墙）：真实街区里楼与楼贴着，背面常常没有窗 */
  blank?: 'x' | 'z' | 'none'
  /**
   * 按"户"排窗：立面上每格 = 一户，洞口宽 = 阳台门洞。
   * 给了这一组数，窗格就不再按 PARAMS 的固定模数排，
   * 街上看到的每一格和房间里的阳台一一对应。
   */
  bays?: { pitch: number; opening: number; origin: number; count: number; openH: number; sill: number }
}

type StyleParams = {
  floorH: number
  winW: number
  winH: number
  gap: number
  sill: number
  wallRough: number
  wallMetal: number
  glassRough: number
  glassMetal: number
  litRatio: number
  /** 0 砖 / 1 石材 / 2 金属 / 3 幕墙 */
  kind: number
  /** 砖缝与板缝的间距（米） */
  joint: number
  transom: number
  /** 窗洞进深（米）。幕墙几乎没有洞，砖石楼能到 20cm。 */
  relief: number
}

const PARAMS: Record<FacadeStyle, StyleParams> = {
  brick: {
    floorH: 3.3,
    winW: 1.42,
    winH: 1.86,
    gap: 1.2,
    sill: 0.3,
    wallRough: 0.93,
    wallMetal: 0.02,
    glassRough: 0.26,
    glassMetal: 0.68,
    litRatio: 0.6,
    kind: 0,
    joint: 0.32,
    transom: 0.58,
    relief: 0.13,
  },
  stone: {
    floorH: 3.45,
    winW: 1.62,
    winH: 1.92,
    gap: 1.1,
    sill: 0.32,
    wallRough: 0.85,
    wallMetal: 0.04,
    glassRough: 0.27,
    glassMetal: 0.66,
    litRatio: 0.6,
    kind: 1,
    joint: 1.65,
    transom: 0.62,
    relief: 0.19,
  },
  metal: {
    floorH: 3.4,
    winW: 1.55,
    winH: 2.05,
    gap: 0.7,
    sill: 0.22,
    wallRough: 0.55,
    wallMetal: 0.32,
    glassRough: 0.22,
    glassMetal: 0.76,
    litRatio: 0.5,
    kind: 2,
    joint: 1.2,
    transom: 0.7,
    relief: 0.1,
  },
  glass: {
    floorH: 3.7,
    // 幕墙的窗占比从 90% 降到 68%：2.35/0.26 时整栋楼几乎全是玻璃，
    // 而玻璃基色是深蓝，于是这栋楼在画面上就是一块深蓝板子。
    // 参考图的楼之所以读成"建筑"，是因为墙和窗有明确的比例关系。
    winW: 1.95,
    winH: 3.0,
    gap: 0.9,
    sill: 0.14,
    wallRough: 0.3,
    wallMetal: 0.52,
    glassRough: 0.1,
    glassMetal: 0.93,
    litRatio: 0.45,
    kind: 3,
    joint: 1.5,
    transom: 0,
    relief: 0.05,
  },
}

// 风格化：一格 = 一个真实房间的开间（住宅 3.6m、办公 3.2m），每间居中一扇窗。
// 原来 2.6m 一格是"窗挨着窗"，按户型算一间屋要开两扇半窗。
if (STYLIZED) {
  Object.assign(PARAMS.brick, { floorH: 3.0, winW: 1.6, winH: 1.6, gap: 2.0, sill: 0.3 })
  Object.assign(PARAMS.stone, { floorH: 3.0, winW: 1.7, winH: 1.65, gap: 1.9, sill: 0.3 })
  Object.assign(PARAMS.metal, { floorH: 3.3, winW: 1.9, winH: 1.9, gap: 1.3, sill: 0.25 })
}

const vertexPars = /* glsl */ `
varying vec3 vFacadePos;
varying vec3 vFacadeNrm;
varying vec3 vFacadeWorld;
`

const vertexMain = /* glsl */ `
  vFacadePos = position;
  vFacadeNrm = normal;
  vFacadeWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
`

const fragmentPars = /* glsl */ `
uniform vec3 uWall;
uniform vec3 uTrim;
uniform vec3 uGlass;
uniform vec3 uLitWarm;
uniform vec3 uLitCool;

uniform float uFloorH;
uniform float uWinW;
uniform float uWinH;
uniform float uGap;
uniform float uBase;
uniform float uSill;
uniform float uInset;
uniform float uSpanX;
uniform float uSpanZ;

uniform float uWallRough;
uniform float uWallMetal;
uniform float uGlassRough;
uniform float uGlassMetal;

uniform float uLitRatio;
uniform float uLitGain;
uniform float uSeed;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uKind;
uniform float uJoint;
uniform float uTransom;
uniform float uTop;
uniform float uBlankX;
uniform float uBlankZ;
uniform float uRelief;

// 按户排窗（住宅）：0 表示用固定模数
uniform float uPitch;
uniform float uBayOrigin;
uniform float uBayCount;
uniform float uBayWx;
uniform float uBaySill;
uniform float uBayTop;

varying vec3 vFacadePos;
varying vec3 vFacadeNrm;
varying vec3 vFacadeWorld;

float fHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

float fNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( fHash( i ), fHash( i + vec2( 1.0, 0.0 ) ), u.x ),
    mix( fHash( i + vec2( 0.0, 1.0 ) ), fHash( i + vec2( 1.0, 1.0 ) ), u.x ),
    u.y
  );
}

/** 一条抗锯齿细线：d 是与线心的距离，w 是线宽（米）。 */
float lineMask( float d, float w ) {
  float fw = max( fwidth( d ), 0.0008 );
  float m = 1.0 - smoothstep( w * 0.5, w * 0.5 + fw * 1.6, d );
  // 线比一个像素还细时按覆盖率减弱，而不是硬画成 1px 满强度的线（远处闪烁的来源）
  return m * clamp( w / ( fw * 1.6 ), 0.0, 1.0 );
}

/**
 * 室内映射（interior mapping）：把每扇窗后面当成一个盒子房间，
 * 视线从玻璃进去，打到后墙 / 侧墙 / 地板 / 天花板上，按面着色。
 * 走动时房间会随视角产生真实的视差——这是"窗户后面真的有屋子"的关键。
 * p: 窗内归一化坐标 [0,1]²；d: 视线在 (横, 竖, 法线) 方向上、按房间尺寸归一化的分量。
 * 返回 xyz = 亮度系数，w = 打到的进深 [0,1]。
 */
vec4 roomShade( vec2 p, vec3 d, float seed ) {
  // d.z < 0 表示视线朝楼里走
  float dz = min( d.z, -0.0001 );
  float tz = -1.0 / dz;
  float tx = d.x > 0.0 ? ( 1.0 - p.x ) / max( d.x, 1e-4 ) : -p.x / min( d.x, -1e-4 );
  float ty = d.y > 0.0 ? ( 1.0 - p.y ) / max( d.y, 1e-4 ) : -p.y / min( d.y, -1e-4 );
  float t = min( tz, min( tx, ty ) );
  vec3 h = vec3( p, 0.0 ) + d * t;
  float depth = clamp( -h.z, 0.0, 1.0 );
  float k;
  if ( t == tz ) {
    // 后墙：中间亮、四周暗；下半截随机有沙发/柜子的暗块
    k = 0.95 - 0.25 * length( h.xy - vec2( 0.5, 0.6 ) );
    float sofa = step( 0.45, fHash( vec2( seed, 3.1 ) ) ) * step( h.y, 0.32 ) * step( 0.15, h.x ) * step( h.x, 0.75 );
    k *= 1.0 - sofa * 0.45;
    // 墙上一幅画或一台电视
    float pic = step( 0.6, fHash( vec2( seed, 8.7 ) ) ) * step( 0.5, h.y ) * step( h.y, 0.75 ) * step( 0.35, h.x ) * step( h.x, 0.62 );
    k *= 1.0 - pic * 0.35;
  } else if ( t == ty ) {
    // 天花板最亮（灯就在上面），地板最暗
    k = d.y > 0.0 ? 1.25 - 0.35 * depth : 0.42 + 0.12 * depth;
    // 吸顶灯光斑
    if ( d.y > 0.0 ) k += 0.6 * exp( -dot( h.xz - vec2( 0.5, -0.5 ), h.xz - vec2( 0.5, -0.5 ) ) * 18.0 );
  } else {
    k = 0.7 - 0.15 * depth;
  }
  // 越深越暗一点：靠窗的地方受室内灯和窗外光都多
  k *= 1.0 - depth * 0.25;
  return vec4( vec3( k ), depth );
}

struct FacadeOut {
  vec3 color;
  vec3 emissive;
  float roughness;
  float metalness;
};

/**
 * 窗洞的"高度场"（米，正值表示比墙面更靠外）。
 *
 * 这是建筑看起来假的核心原因：之前只在颜色上画了窗洞的明暗，但法线始终
 * 是平的，所以太阳永远不会在窗洞侧壁上扫出一道高光，窗框也没有实体感。
 * 这里把窗洞、窗套线脚、窗台统一写成一个高度场，再由它求梯度扰动法线，
 * 光照就会自己算出窗洞该有的阴影与反光。
 */
float facadeRelief( float xm, float ym, float ww, float wh, float depth ) {
  // 到窗洞四条边的最近距离（窗内为正、窗外为负）
  float dx = min( xm, ww - xm );
  float dy = min( ym, wh - ym );
  float d = min( dx, dy );

  float h = 0.0;
  // 洞身退进墙里；过渡带偏内，肉眼读成"斜切的窗侧壁"
  h -= depth * smoothstep( -0.03, 0.075, d );
  // 窗套 / 窗台：洞口外一圈凸出的线脚
  h += depth * 0.28 * ( smoothstep( -0.125, -0.085, d ) - smoothstep( -0.085, -0.03, d ) );
  return h;
}

/** 把立面高度场换算成世界空间法线，再交给 three 做视图空间变换。 */
vec3 facadeNormalWorld( vec3 n ) {
  float vertical = step( abs( n.y ), 0.5 ) * step( min( abs( n.x ), abs( n.z ) ), 0.16 );
  bool xFace = abs( n.x ) > abs( n.z );
  float span = xFace ? uSpanX : uSpanZ;
  float along = ( xFace ? vFacadePos.z : vFacadePos.x ) + span * 0.5;
  float y = vFacadePos.y;

  float bay = step( 0.001, uPitch );
  float usable = max( uWinW * 1.2, span - uInset * 2.0 );
  float cw = mix( uWinW + uGap, uPitch, bay );
  float cols = mix( max( 1.0, floor( usable / cw ) ), uBayCount, bay );
  float pad = mix( uInset + ( usable - cols * cw ) * 0.5, uBayOrigin, bay );
  float fx = fract( ( along - pad ) / cw );
  float fv = ( y - uBase ) / uFloorH;
  float row = floor( fv );
  float fy = fract( fv );

  float ok = step( 0.0, row ) * step( uBase, y ) * step( y, uTop - 1.05 );
  float blank = xFace ? uBlankX : uBlankZ;
  // 远处必须收掉：窗洞法线只有 10cm 宽，几十米外会闪成噪点。
  // 每次求法线要做四次 facadeRelief（每次两个 smoothstep），
  // 是逐像素最贵的一段之一，所以门槛压到 40~110m。
  float dist = length( vFacadeWorld - cameraPosition );
  float gate = ok * blank * vertical * ( 1.0 - smoothstep( 40.0, 110.0, dist ) );
  if ( gate < 0.01 ) return n;

  float wx = mix( uWinW / cw, uBayWx, bay );
  float l = ( 1.0 - wx ) * 0.5;
  float r = 1.0 - l;
  float bot = mix( uSill, uBaySill, bay );
  float top = mix( min( 0.95, uSill + uWinH / uFloorH ), uBayTop, bay );

  float ww = ( r - l ) * cw;
  float wh = ( top - bot ) * uFloorH;
  if ( ww <= 0.01 || wh <= 0.01 ) return n;
  float xm = ( fx - l ) * cw;
  float ym = ( fy - bot ) * uFloorH;

  // 数值微分：bevel 只有 10cm 宽，解析求导在这里既复杂又容易推错符号。
  // 四次采样换一个绝对不会错的法线，比手推四段分段函数省心。
  float e = 0.014;
  float gx = ( facadeRelief( xm + e, ym, ww, wh, uRelief ) - facadeRelief( xm - e, ym, ww, wh, uRelief ) ) / ( 2.0 * e );
  float gy = ( facadeRelief( xm, ym + e, ww, wh, uRelief ) - facadeRelief( xm, ym - e, ww, wh, uRelief ) ) / ( 2.0 * e );

  vec3 T = xFace ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
  vec3 B = vec3( 0.0, 1.0, 0.0 );
  return normalize( n - ( T * gx + B * gy ) * gate );
}

FacadeOut facadeShade() {
  FacadeOut o;
  o.color = uWall;
  o.emissive = vec3( 0.0 );
  o.roughness = uWallRough;
  o.metalness = uWallMetal;

  vec3 n = normalize( vFacadeNrm );
  float vertical = step( abs( n.y ), 0.5 ) * step( min( abs( n.x ), abs( n.z ) ), 0.16 );

  float dist = length( vFacadeWorld - cameraPosition );
  float detail = 1.0 - smoothstep( uFadeStart, uFadeEnd, dist );
  // 一点点远处雾化，让遥远的楼不至于像贴在背景上的贴纸
  float alive = 1.0 - smoothstep( 460.0, 900.0, dist );

  // ---------- 墙面脏污 ----------
  // 竖向拉伸的噪声 = 雨水顺着墙面流下来留下的痕迹
  float streak = fNoise( vec2( vFacadePos.x * 2.6 + vFacadePos.z * 2.6, vFacadePos.y * 0.16 ) + uSeed );
  float blotch = fNoise( vec2( vFacadePos.x * 0.55 + vFacadePos.z * 0.55, vFacadePos.y * 0.4 ) + uSeed * 2.0 );
  // 幅度要克制：压暗到 50% 时，噪声和板缝叠在一起就成了格子布
  float grime = mix( 0.84, 1.0, streak ) * mix( 0.88, 1.0, blotch );
#ifdef FACADE_CLEAN
  grime = mix( grime, 1.0, 0.75 );
#endif

  bool xFace = abs( n.x ) > abs( n.z );
  float span = xFace ? uSpanX : uSpanZ;
  float along = ( xFace ? vFacadePos.z : vFacadePos.x ) + span * 0.5;
  float y = vFacadePos.y;

  // ---------- 窗格网格 ----------
  float bay = step( 0.001, uPitch );
  float usable = max( uWinW * 1.2, span - uInset * 2.0 );
  float cw = mix( uWinW + uGap, uPitch, bay );
  float cols = mix( max( 1.0, floor( usable / cw ) ), uBayCount, bay );
  float pad = mix( uInset + ( usable - cols * cw ) * 0.5, uBayOrigin, bay );
  float uu = ( along - pad ) / cw;
  float cell = floor( uu );
  float fx = fract( uu );

  float fv = ( y - uBase ) / uFloorH;
  float row = floor( fv );
  float fy = fract( fv );
  // 顶部留一圈实墙（女儿墙），不再让窗户一直排到楼顶
  float ok = step( 0.0, row ) * step( uBase, y ) * step( y, uTop - 1.05 );
  float blank = xFace ? uBlankX : uBlankZ;

  float wx = mix( uWinW / cw, uBayWx, bay );
  float l = ( 1.0 - wx ) * 0.5;
  float r = 1.0 - l;
  float bot = mix( uSill, uBaySill, bay );
  float top = mix( min( 0.95, uSill + uWinH / uFloorH ), uBayTop, bay );
  // 只排整扇窗：顶层放不下、退台处窗台落在本段楼板以下的整格不开窗（与 FacadeWindows 一致）
  ok *= step( row, floor( ( uTop - 1.05 - uBase ) / uFloorH - top ) ) * step( 0.05, uBase + ( row + bot ) * uFloorH );

  // fwidth 让边缘在远处自然变软，不会糊成硬台阶
  float eh = max( fwidth( uu ), 0.0015 ) * 1.3;
  float ev = max( fwidth( fv ), 0.0015 ) * 1.3;
  float mx = smoothstep( l - eh, l + eh, fx ) * ( 1.0 - smoothstep( r - eh, r + eh, fx ) );
  float my = smoothstep( bot - ev, bot + ev, fy ) * ( 1.0 - smoothstep( top - ev, top + ev, fy ) );
  float win = mx * my * ok * blank;

  // ---------- 墙面色 ----------
  vec3 wallCol = uWall * grime;
  // 墙角压暗：真实建筑转角总是被环境光吃掉一点
  float edgeDist = min( along, span - along );
#ifndef FACADE_CLEAN
  // 风格化不压墙角：切角面和正立面颜色必须一致，否则转角亮出一道异色竖条
  wallCol *= mix( 0.8, 1.0, smoothstep( 0.0, 1.4, edgeDist ) );
#endif
  // 城市峡谷反弹光（借 slop-newyork 的 canyonBounce）：
  // 街灯、店面、车灯、被晒暖的沥青把光往上打到楼体下半截，
  // 所以 0~18m 的墙面一定比 60m 以上更亮更暖。这是"楼立在街上"的重量感来源。
  float canyonBand = 1.0 - smoothstep( 18.0, 62.0, y - uBase );
#ifdef FACADE_CLEAN
  canyonBand *= 0.25;
#endif
  wallCol = wallCol * ( 1.0 + canyonBand * 0.34 ) + vec3( 0.115, 0.079, 0.046 ) * canyonBand;
  // 整栋楼从下到上的明暗渐变：楼根被街道和邻楼遮挡偏暗，越往上越接近天光。
  // 一整面亮度均匀的墙是"平板感/白模感"的主要来源，加了这层才有体积。
  float rise = smoothstep( uBase, uTop, y );
  wallCol *= mix( 0.84, 1.1, rise );
  // 楼脚 2.5m 内的接触暗：楼"落在地上"而不是浮在地面上
  wallCol *= mix( 0.72, 1.0, smoothstep( 0.0, 2.5, y ) );

  // 砖缝 / 石材板缝（风格化不画：和窗格叠在一起就是一张格子布）
#ifndef FACADE_CLEAN
  if ( uKind < 2.5 ) {
    float jointD = abs( fract( y / uJoint ) - 0.5 ) * uJoint;
    float jointLine = lineMask( jointD, uJoint * ( uKind < 0.5 ? 0.1 : 0.055 ) );
    wallCol *= 1.0 - jointLine * 0.08 * detail;
    if ( uKind > 0.5 ) {
      // 石材层的竖向板缝
      float vs = abs( fract( along / uJoint + row * 0.5 ) - 0.5 ) * uJoint;
      wallCol *= 1.0 - lineMask( vs, 0.035 ) * 0.06 * detail;
    }
  }
#endif

  // 窗洞外圈：墙面被窗洞"咬"进去一圈，边缘有细微的暗角
  float edgeGap = max( max( l - fx, fx - r ), max( bot - fy, fy - top ) );
  float recess = exp( -max( edgeGap, 0.0 ) * 55.0 ) * ( 1.0 - win ) * ok;
#ifndef FACADE_CLEAN
  wallCol *= 1.0 - 0.16 * recess * detail;
#endif
  // 雨痕只从窗台两角往下流，而不是满墙随机竖纹
  float sillDrip = smoothstep( 0.0, 0.03, min( abs( fx - l - 0.04 ), abs( fx - r + 0.04 ) ) );
  float under = step( fy, bot ) * ( 1.0 - smoothstep( 0.0, 0.55, bot - fy ) );
#ifndef FACADE_CLEAN
  wallCol *= 1.0 - ( 1.0 - sillDrip ) * under * ok * blank * 0.14 * detail * streak;
#endif

  // 竖向柱垛：窗与窗之间那条墙是凸出来的，受光面稍亮、背光面稍暗。
  // 这条让立面出现竖向节奏，否则一排窗看着就是一张网格贴图。
  float pier = ( 1.0 - mx ) * ok * vertical;
#ifndef FACADE_CLEAN
  wallCol *= 1.0 + pier * 0.12;

  // 楼层线（每个窗台高度一条极淡的横线）
  wallCol *= 1.0 - lineMask( abs( fy - 0.006 ), 0.014 ) * 0.12 * detail;
#endif

  // ---------- 窗内部 ----------
  float depthV = clamp( ( fy - bot ) / max( top - bot, 0.001 ), 0.0, 1.0 );
  // 玻璃：越往上越接近天空的亮部
  vec3 glassCol = uGlass * ( 0.52 + 0.85 * depthV );
  // 幕墙是整块镀膜玻璃，逐格明暗跳变会读成棋盘格
  float isCurtainWall = step( 2.5, uKind );
  glassCol *= 0.92 + mix( 0.16, 0.05, isCurtainWall ) * fHash( vec2( cell, row ) + uSeed );
  // 偶尔有一扇拉着浅色窗帘（幕墙写字楼没有窗帘）
  float curtain = step( 0.84, fHash( vec2( cell * 2.3 + 5.0, row * 1.9 ) + uSeed * 3.0 ) ) * ( 1.0 - isCurtainWall );
#ifdef FACADE_CLEAN
  // 风格化：玻璃是一块干净的纯色。画在平墙上的渐变、凹凸、窗框阴影
  // 近看全是"假立体"，读出来就是一张贴图；平涂反而像像素城市那种干净的块面。
  glassCol = uGlass;
  curtain = 0.0;
#endif
  glassCol = mix( glassCol, uTrim * 1.25, curtain * 0.55 );

  float litPick = fHash( vec2( cell * 1.7 + 3.0, row * 2.3 + 1.0 ) + uSeed * 2.0 );
#ifdef FACADE_CLEAN
  // 亮灯不是均匀撒点：同一户（相邻两三格）一起亮，有的楼层整层没人
  float household = floor( cell / 2.0 );
  float floorBusy = mix( 0.25, 1.75, fHash( vec2( row * 0.73, uSeed * 0.11 ) ) );
  float homePick = fHash( vec2( household * 4.1 + 2.0, row * 1.7 ) + uSeed );
  litPick = mix( homePick, litPick, 0.3 );
  float isLit = step( litPick, uLitRatio * floorBusy );
#else
  float isLit = step( litPick, uLitRatio );
#endif
  // 大部分是暖白；约 10% 冷白（日光灯），约 5% 是电视/彩灯的蓝、粉、青。
  // 彩色只能零星点缀：以前 32% 混色远看就是一墙彩色方块。
  float tintPick = fHash( vec2( row * 3.1, cell * 0.7 ) + uSeed * 5.0 );
  vec3 litCol = mix( uLitWarm, uLitCool, step( 0.92, tintPick ) );
  litCol = mix( litCol, vec3( 0.86, 0.9, 1.0 ), step( 0.85, tintPick ) * step( tintPick, 0.95 ) );
  float tvHue = fHash( vec2( cell * 2.3, row * 0.9 ) + uSeed * 7.0 );
  vec3 tvCol = tvHue < 0.34 ? vec3( 0.55, 0.68, 1.0 ) : tvHue < 0.67 ? vec3( 1.0, 0.56, 0.78 ) : vec3( 0.55, 1.0, 0.86 );
  litCol = mix( litCol, tvCol, step( 0.95, tintPick ) );
#ifndef FACADE_CLEAN
  litCol *= 0.78 + 0.34 * fHash( vec2( cell + 1.0, row + 7.0 ) );
#endif

  // 玻璃的反光：没开灯的房间靠它才不会是一块死黑
  float sheen = pow( 1.0 - clamp( abs( dot( normalize( vFacadeWorld - cameraPosition ), n ) ), 0.0, 1.0 ), 3.0 );
#ifndef FACADE_CLEAN
  glassCol += vec3( 0.05, 0.06, 0.075 ) * sheen * 4.0;
#endif

  // ---------- 窗后面的房间 ----------
  vec3 V = normalize( vFacadeWorld - cameraPosition );
  vec3 Tn = xFace ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
  float wwM = max( wx * cw, 0.2 );
  float whM = max( ( top - bot ) * uFloorH, 0.2 );
  vec2 rp = vec2( clamp( ( fx - l ) / max( wx, 0.001 ), 0.0, 1.0 ), depthV );
  // 进深约 4.5m；房间比窗户宽，所以横向按 1.6 倍窗宽算
  vec3 rd = vec3( dot( V, Tn ) / ( wwM * 1.6 ), V.y / whM, dot( V, n ) / 4.5 );
  rp.x = rp.x / 1.6 + 0.2;
  float roomSeed = cell * 3.7 + row * 11.3 + uSeed;
  // 室内映射（interior mapping）要算三次射线-平面求交、一次 hash、两次 exp。
  // 这是整条立面着色器里最贵的一段，而它只在近景有意义：
  // detail 落到 0 之后（约 80m 外）房间只剩平均亮度。
  // 用 if 包住而不是 mix，是因为远处整片楼在同一个 warp 里，
  // GPU 能真的把这段跳过；mix 会照常执行再乘 0。
  vec3 roomK = vec3( 0.8 );
#ifndef FACADE_CLEAN
  if ( detail > 0.01 ) {
    vec4 room = roomShade( rp, rd, roomSeed );
    roomK = mix( vec3( 0.8 ), room.xyz, detail );
  }
#endif

  vec3 litGlass = litCol * roomK;
  litGlass *= mix( 1.0, 0.55, curtain );

  // 没开灯的房间：白天能隐约看到屋里（玻璃反射为主），夜里几乎全黑
  vec3 darkRoom = uGlass * 0.55 + uLitWarm * roomK * ( uLitGain < 0.5 ? 0.05 : 0.012 );
  vec3 unlit = mix( darkRoom, glassCol, 0.62 );
  // 夜里没开灯的窗不是黑洞：玻璃映着对街的灯和发亮的夜空，
  // 上半截偏冷（天）、下半截偏暖（街灯），每扇的角度略有不同
  float nightK = step( 0.5, uLitGain );
  float tilt = fHash( vec2( cell * 0.9, row * 1.3 ) + uSeed * 4.1 );
  vec3 cityRefl = mix( vec3( 0.07, 0.05, 0.035 ), vec3( 0.03, 0.036, 0.05 ), smoothstep( 0.2, 0.9, depthV + ( tilt - 0.5 ) * 0.4 ) );
  // 走自发光：夜里漫反射几乎没有光可吃，加在底色上看不见
  vec3 unlitGlow = cityRefl * ( 0.6 + 0.8 * tilt ) * ( 0.6 + sheen * 1.5 ) * nightK;
#ifdef FACADE_CLEAN
  unlit = glassCol;
  unlitGlow = vec3( 0.03, 0.03, 0.034 ) * nightK;
#endif
  vec3 winCol = mix( unlit, litGlass, isLit );

  // ---------- 窗洞深度：上沿与左侧压暗，右下沿提亮 ----------
  float dl = clamp( ( fx - l ) / max( wx, 0.001 ), 0.0, 1.0 );
  float dt = clamp( ( top - fy ) / max( top - bot, 0.001 ), 0.0, 1.0 );
  float db = clamp( ( fy - bot ) / max( top - bot, 0.001 ), 0.0, 1.0 );
  float revealShade =
    mix( 0.5, 1.0, smoothstep( 0.0, 0.2, dt ) ) *
    mix( 0.66, 1.0, smoothstep( 0.0, 0.26, dl ) );
  // 底部反射光：窗台把光反打进窗内
  revealShade *= mix( 1.0, 1.14, 1.0 - smoothstep( 0.0, 0.18, db ) );
#ifndef FACADE_CLEAN
  winCol *= revealShade;
#endif

  // 窗框：洞口内侧一圈深色铝框。没有框，窗就是一块贴在墙上的发光矩形。
  float fwX = max( fwidth( fx ), 0.0015 ) * 1.5;
  float fwY = max( fwidth( fy ), 0.0015 ) * 1.5;
  float frameBand =
    ( 1.0 - smoothstep( 0.05 - fwX, 0.05 + fwX, fx - l ) ) +
    ( 1.0 - smoothstep( 0.05 - fwX, 0.05 + fwX, r - fx ) ) +
    ( 1.0 - smoothstep( 0.035 - fwY, 0.035 + fwY, fy - bot ) ) +
    ( 1.0 - smoothstep( 0.035 - fwY, 0.035 + fwY, top - fy ) );
  // 窗框只占窗宽的 5%：一格窗不到 ~20px 时它已不足一像素，逐步淡出
  float frameFade = 1.0 - smoothstep( 0.03, 0.09, max( fwidth( uu ), fwidth( fv ) ) );
  frameBand = clamp( frameBand, 0.0, 1.0 ) * win * frameFade;
  float muntin = 0.0;
#ifdef FACADE_CLEAN
  // 风格化：和住宅楼实体窗（UnitShell）同一种样式——近黑的 8cm 窗框 + 一根中梃。
  // 按米算而不是按格宽比例，开间变宽时框不会跟着变粗
  vec3 frameDark = vec3( 0.03, 0.03, 0.036 );
  float aaM = max( fwidth( fx ) * cw, 0.002 );
  float edgeM = min( min( ( fx - l ) * cw, ( r - fx ) * cw ), min( ( fy - bot ) * uFloorH, ( top - fy ) * uFloorH ) );
  float frameC = 1.0 - smoothstep( 0.08 - aaM, 0.08 + aaM, edgeM );
  float midBar = ( 1.0 - smoothstep( 0.035 - aaM, 0.035 + aaM, abs( fx - 0.5 ) * cw ) ) * step( 1.2, wx * cw );
  frameBand = clamp( max( frameC, midBar ), 0.0, 1.0 ) * win * frameFade;
  winCol = mix( winCol, frameDark, frameBand );
#else
  // 夜里的铝框几乎不吃光，只是把玻璃"框住"
  winCol = mix( winCol, uTrim * 0.34, frameBand * 0.92 );
#endif

  // 中挺：双悬窗/横向分格，是"真窗"最强的形状线索
#ifndef FACADE_CLEAN
  if ( uTransom > 0.01 ) {
    float mid = mix( bot, top, uTransom );
    float bar = lineMask( abs( fy - mid ), 0.016 );
    winCol = mix( winCol, uTrim * 0.8, bar * mx * ok * blank * detail * 0.9 );
  }
#endif

  vec3 facadeCol = mix( wallCol, winCol, win );

  // 窗台：窗下沿一条亮边（石材的反光），并在下方拖出一小段污痕
  float sillLine = lineMask( abs( fy - bot + 0.012 ), 0.02 ) * mx * ok * blank;
#ifdef FACADE_CLEAN
  // 窗台：窗下一条比窗宽一点的深色挑板；层间：每层楼板一条深色线脚
  float sillY = ( bot - fy ) * uFloorH;
  float sillX = max( l - fx, fx - r ) * cw;
  float sillM = step( 0.0, sillY ) * step( sillY, 0.09 ) * step( sillX, 0.08 ) * ok * blank;
  float slabM = lineMask( abs( fy * uFloorH - 0.06 ), 0.12 ) * step( 0.0, row ) * step( y, uTop - 1.05 );
  facadeCol = mix( facadeCol, frameDark, max( sillM, slabM ) * frameFade * 0.92 );
#else
  facadeCol = mix( facadeCol, uTrim * 1.35, sillLine * 0.7 );
#endif
  float drip = mx * ok * blank * ( 1.0 - smoothstep( 0.0, 0.1, bot - fy ) ) * step( fy, bot );
#ifndef FACADE_CLEAN
  facadeCol *= 1.0 - drip * 0.22 * detail;
#endif

  // 远处只留窗格大色块，去掉窗台/砖缝/深度这些像素级细节
  vec3 coarse = mix( wallCol * ( 1.0 - 0.05 * grime ), mix( glassCol, litCol, isLit ), win );
  vec3 shaded = mix( coarse, facadeCol, detail );

  // 窗格小到几个像素以内时，逐像素采样网格就是摩尔纹：每个像素随机落在窗或墙上，
  // 视角一动整面楼就在闪。这时改用"墙 + 窗"按面积的平均色（相当于对图案做盒式滤波）。
  float cellFoot = max( fwidth( uu ), fwidth( fv ) );
  float tiny = smoothstep( 0.1, 0.3, cellFoot );
  float coverage = wx * max( top - bot, 0.0 ) * ok * blank;
  vec3 avgWin = mix( uGlass * 0.75, uLitWarm * 0.85, uLitRatio * step( 0.5, uLitGain ) );
  shaded = mix( shaded, mix( wallCol, avgWin, coverage ), tiny );

  // 切角 / 屋顶 / 底面不排窗：只保留墙色与脏污。
  // 不用 early return，是因为 fwidth 必须在一致的控制流里求值。
  // 圆角、倒角这些非正立面也要跟正立面同一条上下渐变，否则转角处会亮出一道竖条
  // 和 wallCol 走完全相同的一串调整（街谷反弹光、上下渐变、楼脚暗），转角才不会异色
  vec3 plain = uWall * grime;
  plain = plain * ( 1.0 + canyonBand * 0.34 ) + vec3( 0.115, 0.079, 0.046 ) * canyonBand;
  plain *= mix( 0.84, 1.1, smoothstep( uBase, uTop, vFacadePos.y ) )
    * mix( 0.72, 1.0, smoothstep( 0.0, 2.5, vFacadePos.y ) );
  o.color = mix( uWall, mix( plain, shaded, vertical ), alive );

  // 窗框不跟着发光，否则亮窗外面会套一圈白框
  float solid = max( frameBand, muntin );
  vec3 litEm = litGlass * isLit * win * ( 1.0 - solid ) * mix( 0.4, 1.0, detail );
  vec3 glowEm = unlitGlow * ( 1.0 - isLit ) * win * ( 1.0 - solid );
  // 远处同样按面积平均：亮窗的总光量不变，但不再是一闪一闪的噪点
  litEm = mix( litEm, uLitWarm * 0.8 * 0.4 * uLitRatio * coverage, tiny );
  glowEm = mix( glowEm, vec3( 0.05, 0.045, 0.045 ) * nightK * ( 1.0 - uLitRatio ) * coverage, tiny );
  o.emissive = ( litEm * uLitGain + glowEm ) * vertical * alive;

  float wet = win * mix( 0.55, 1.0, detail ) * vertical;
  o.roughness = mix( uWallRough, uGlassRough, wet );
  o.metalness = mix( uWallMetal, uGlassMetal, wet );
  return o;
}
`

/** 远景壳子（FarCity）要和立面用同一套窗格模数，模数从这里取，不要另抄一份。 */
export function facadeStyleParams(style: FacadeStyle) {
  const p = PARAMS[style]
  return {
    floorH: p.floorH,
    winW: p.winW,
    winH: p.winH,
    gap: p.gap,
    sill: p.sill,
    litRatio: p.litRatio,
    kind: p.kind,
  }
}

/** 与 shader 里完全相同的窗格排布，给贴在立面上的构件（消防梯的门）对齐用。
    返回以立面中心为 0 的窗列中心、楼层高、窗台高（米，相对楼层底）、窗宽高。 */
export function facadeGrid(style: FacadeStyle, span: number, inset: number) {
  const p = PARAMS[style]
  const usable = Math.max(p.winW * 1.2, span - inset * 2)
  const cw = p.winW + p.gap
  const cols = Math.max(1, Math.floor(usable / cw))
  const pad = inset + (usable - cols * cw) * 0.5
  const centers = Array.from({ length: cols }, (_, i) => pad + (i + 0.5) * cw - span / 2)
  return { centers, pitch: cw, floorH: p.floorH, sill: p.sill * p.floorH, winW: p.winW, winH: p.winH }
}

export function createFacadeMaterial(opts: FacadeOptions) {
  const p = PARAMS[opts.style]
  const base = opts.base ?? (opts.style === 'glass' ? 4.2 : 3.4)
  // IBL 进来之后，幕墙终于有东西可反射了；原来的 1.1 在新光照下偏保守，
  // 玻璃需要更高的 envMapIntensity 才能把天空和对面楼体的轮廓读出来。
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: p.wallRough,
    metalness: p.wallMetal,
    envMapIntensity: opts.style === 'glass' ? 1.75 : 1.05,
  })

  const uniforms = {
    uWall: { value: new THREE.Color(opts.wall) },
    uTrim: { value: new THREE.Color(opts.trim) },
    uGlass: { value: new THREE.Color(opts.glass) },
    uLitWarm: { value: new THREE.Color(opts.litWarm) },
    uLitCool: { value: new THREE.Color(opts.litCool) },
    uFloorH: { value: opts.floorH ?? p.floorH },
    uWinW: { value: p.winW },
    uWinH: { value: p.winH },
    uGap: { value: p.gap },
    uBase: { value: base },
    uSill: { value: p.sill },
    uInset: { value: opts.inset ?? 1.4 },
    uSpanX: { value: opts.depth },
    uSpanZ: { value: opts.width },
    // 风格化：玻璃不走金属反射。夜里环境贴图又暗又偏蓝，金属度 0.7~0.9 的玻璃
    // 只能反射出一片饱和深蓝（#030D35 那种），整面幕墙的楼就整栋发黑。
    uWallRough: { value: STYLIZED ? Math.max(p.wallRough, 0.7) : p.wallRough },
    uWallMetal: { value: STYLIZED ? Math.min(p.wallMetal, 0.15) : p.wallMetal },
    uGlassRough: { value: STYLIZED ? 0.45 : p.glassRough },
    uGlassMetal: { value: STYLIZED ? 0.2 : p.glassMetal },
    // 夜里窗只有 16% 左右亮着：参考图那种"黑暗楼群 + 点状暖窗"的关系。
    // 但也不能太少——楼体本身已经够暗，窗再稀就只剩一片黑。
    uLitRatio: { value: opts.night ? (STYLIZED ? p.litRatio * 0.55 : p.litRatio) : 0.02 },
    // 夜里窗户要亮，但不能亮到丢掉室内的明暗关系。
    // 0.62 时窗只比立面亮一档，整城读成"蓝板子 + 橙点"；
    // 楼体压成剪影之后，窗必须承担全部亮度。
    uLitGain: { value: opts.night ? 0.88 : 0.06 },
    uKind: { value: p.kind },
    uJoint: { value: p.joint },
    uTransom: { value: p.transom },
    uTop: { value: opts.height },
    uBlankX: { value: opts.blank === 'x' ? 0 : 1 },
    uBlankZ: { value: opts.blank === 'z' ? 0 : 1 },
    // 风格化：平涂窗不做法线凹凸，否则近看窗边会有一圈歪斜的假阴影
    uRelief: { value: STYLIZED ? 0 : p.relief },
    uPitch: { value: opts.bays?.pitch ?? 0 },
    uBayOrigin: { value: opts.bays?.origin ?? 0 },
    uBayCount: { value: opts.bays?.count ?? 1 },
    uBayWx: { value: opts.bays ? opts.bays.opening / opts.bays.pitch : 0 },
    uBaySill: { value: opts.bays ? opts.bays.sill / (opts.floorH ?? p.floorH) : 0 },
    uBayTop: {
      value: opts.bays ? (opts.bays.sill + opts.bays.openH) / (opts.floorH ?? p.floorH) : 0,
    },
    // 每栋楼一个稳定偏移，同一条街上不会出现完全一样的亮窗图案
    uSeed: { value: (opts.seed ?? 0) * 37.19 },
    // 细节不能收太早：90~230m 之外砖缝、窗台、窗洞深度全部退化成纯色块，
    // 站在楼顶往下看时整片城市就像贴图。这个距离要盖住玩家能凑近看的所有楼。
    // 但 detail 也是"室内映射 / 法线扰动"的开关，它的代价是逐像素的：
    // 150/420 意味着总览时有四分之三的画面都在跑最贵的那条分支。
    // 收到 80/260 之后，近景观感不变，远景直接走廉价路径。
    uFadeStart: { value: opts.fadeStart ?? 100 },
    uFadeEnd: { value: opts.fadeEnd ?? 300 },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexPars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexMain}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentPars}`)
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        {
          vec3 wN = facadeNormalWorld( vFacadeNrm );
          normal = normalize( ( viewMatrix * vec4( wN, 0.0 ) ).xyz );
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          FacadeOut fo = facadeShade();
          diffuseColor.rgb = fo.color;
          roughnessFactor = fo.roughness;
          metalnessFactor = fo.metalness;
          totalEmissiveRadiance += fo.emissive;
        }`,
      )
  }

  // 所有楼共用同一个 program，只有 uniform 不同
  if (STYLIZED) material.defines = { ...material.defines, FACADE_CLEAN: '' }
  material.customProgramCacheKey = () => `facade-v11-${opts.night ? 'n' : 'd'}${STYLIZED ? '-c' : ''}`

  return material
}
