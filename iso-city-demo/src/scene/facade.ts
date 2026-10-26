import * as THREE from 'three'

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
    litRatio: 0.26,
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
    litRatio: 0.25,
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
    litRatio: 0.3,
    kind: 2,
    joint: 1.2,
    transom: 0.7,
    relief: 0.1,
  },
  glass: {
    floorH: 3.7,
    winW: 2.35,
    winH: 3.05,
    gap: 0.26,
    sill: 0.14,
    wallRough: 0.3,
    wallMetal: 0.52,
    glassRough: 0.1,
    glassMetal: 0.93,
    litRatio: 0.32,
    kind: 3,
    joint: 1.5,
    transom: 0,
    relief: 0.05,
  },
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
  return 1.0 - smoothstep( w * 0.5, w * 0.5 + fw * 1.6, d );
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
  // 远处必须收掉：窗洞法线只有 10cm 宽，几十米外会闪成噪点
  float dist = length( vFacadeWorld - cameraPosition );
  float gate = ok * blank * vertical * ( 1.0 - smoothstep( 70.0, 170.0, dist ) );
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
  wallCol *= mix( 0.8, 1.0, smoothstep( 0.0, 1.4, edgeDist ) );
  // 城市峡谷反弹光（借 slop-newyork 的 canyonBounce）：
  // 街灯、店面、车灯、被晒暖的沥青把光往上打到楼体下半截，
  // 所以 0~18m 的墙面一定比 60m 以上更亮更暖。这是"楼立在街上"的重量感来源。
  float canyonBand = 1.0 - smoothstep( 18.0, 62.0, y - uBase );
  wallCol = wallCol * ( 1.0 + canyonBand * 0.34 ) + vec3( 0.115, 0.079, 0.046 ) * canyonBand;

  // 砖缝 / 石材板缝
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

  // 窗洞外圈：墙面被窗洞"咬"进去一圈，边缘有细微的暗角
  float edgeGap = max( max( l - fx, fx - r ), max( bot - fy, fy - top ) );
  float recess = exp( -max( edgeGap, 0.0 ) * 55.0 ) * ( 1.0 - win ) * ok;
  wallCol *= 1.0 - 0.16 * recess * detail;
  // 雨痕只从窗台两角往下流，而不是满墙随机竖纹
  float sillDrip = smoothstep( 0.0, 0.03, min( abs( fx - l - 0.04 ), abs( fx - r + 0.04 ) ) );
  float under = step( fy, bot ) * ( 1.0 - smoothstep( 0.0, 0.55, bot - fy ) );
  wallCol *= 1.0 - ( 1.0 - sillDrip ) * under * ok * blank * 0.14 * detail * streak;

  // 竖向柱垛：窗与窗之间那条墙是凸出来的，受光面稍亮、背光面稍暗。
  // 这条让立面出现竖向节奏，否则一排窗看着就是一张网格贴图。
  float pier = ( 1.0 - mx ) * ok * vertical;
  wallCol *= 1.0 + pier * 0.12;

  // 楼层线（每个窗台高度一条极淡的横线）
  wallCol *= 1.0 - lineMask( abs( fy - 0.006 ), 0.014 ) * 0.12 * detail;

  // ---------- 窗内部 ----------
  float depthV = clamp( ( fy - bot ) / max( top - bot, 0.001 ), 0.0, 1.0 );
  // 玻璃：越往上越接近天空的亮部
  vec3 glassCol = uGlass * ( 0.52 + 0.85 * depthV );
  // 幕墙是整块镀膜玻璃，逐格明暗跳变会读成棋盘格
  float isCurtainWall = step( 2.5, uKind );
  glassCol *= 0.92 + mix( 0.16, 0.05, isCurtainWall ) * fHash( vec2( cell, row ) + uSeed );
  // 偶尔有一扇拉着浅色窗帘（幕墙写字楼没有窗帘）
  float curtain = step( 0.84, fHash( vec2( cell * 2.3 + 5.0, row * 1.9 ) + uSeed * 3.0 ) ) * ( 1.0 - isCurtainWall );
  glassCol = mix( glassCol, uTrim * 1.25, curtain * 0.55 );

  float litPick = fHash( vec2( cell * 1.7 + 3.0, row * 2.3 + 1.0 ) + uSeed * 2.0 );
  float isLit = step( litPick, uLitRatio );
  // 住宅/写字楼的灯几乎都是同一色温的暖白，只有约 8% 是办公室的冷白。
  // 以前 32% 混冷色 + 0.55~1.3 的随机亮度，远看就是一墙彩色方块。
  vec3 litCol = mix( uLitWarm, uLitCool, step( 0.92, fHash( vec2( row * 3.1, cell * 0.7 ) + uSeed * 5.0 ) ) );
  litCol *= 0.78 + 0.34 * fHash( vec2( cell + 1.0, row + 7.0 ) );

  // 玻璃的反光：没开灯的房间靠它才不会是一块死黑
  float sheen = pow( 1.0 - clamp( abs( dot( normalize( vFacadeWorld - cameraPosition ), n ) ), 0.0, 1.0 ), 3.0 );
  glassCol += vec3( 0.05, 0.06, 0.075 ) * sheen * 4.0;

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
  vec4 room = roomShade( rp, rd, roomSeed );
  // 远处房间视差没有意义，退回平均亮度，免得闪
  vec3 roomK = mix( vec3( 0.8 ), room.xyz, detail );

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
  winCol *= revealShade;

  // 窗框：洞口内侧一圈深色铝框。没有框，窗就是一块贴在墙上的发光矩形。
  float fwX = max( fwidth( fx ), 0.0015 ) * 1.5;
  float fwY = max( fwidth( fy ), 0.0015 ) * 1.5;
  float frameBand =
    ( 1.0 - smoothstep( 0.05 - fwX, 0.05 + fwX, fx - l ) ) +
    ( 1.0 - smoothstep( 0.05 - fwX, 0.05 + fwX, r - fx ) ) +
    ( 1.0 - smoothstep( 0.035 - fwY, 0.035 + fwY, fy - bot ) ) +
    ( 1.0 - smoothstep( 0.035 - fwY, 0.035 + fwY, top - fy ) );
  frameBand = clamp( frameBand, 0.0, 1.0 ) * win;
  // 夜里的铝框几乎不吃光，只是把玻璃"框住"
  winCol = mix( winCol, uTrim * 0.34, frameBand * 0.92 );

  // 中挺：双悬窗/横向分格，是"真窗"最强的形状线索
  if ( uTransom > 0.01 ) {
    float mid = mix( bot, top, uTransom );
    float bar = lineMask( abs( fy - mid ), 0.016 );
    winCol = mix( winCol, uTrim * 0.8, bar * mx * ok * blank * detail * 0.9 );
  }

  vec3 facadeCol = mix( wallCol, winCol, win );

  // 窗台：窗下沿一条亮边（石材的反光），并在下方拖出一小段污痕
  float sillLine = lineMask( abs( fy - bot + 0.012 ), 0.02 ) * mx * ok * blank;
  facadeCol = mix( facadeCol, uTrim * 1.35, sillLine * 0.7 );
  float drip = mx * ok * blank * ( 1.0 - smoothstep( 0.0, 0.1, bot - fy ) ) * step( fy, bot );
  facadeCol *= 1.0 - drip * 0.22 * detail;

  // 远处只留窗格大色块，去掉窗台/砖缝/深度这些像素级细节
  vec3 coarse = mix( wallCol * ( 1.0 - 0.05 * grime ), mix( glassCol, litCol, isLit ), win );
  vec3 shaded = mix( coarse, facadeCol, detail );

  // 切角 / 屋顶 / 底面不排窗：只保留墙色与脏污。
  // 不用 early return，是因为 fwidth 必须在一致的控制流里求值。
  vec3 plain = uWall * grime;
  o.color = mix( uWall, mix( plain, shaded, vertical ), alive );

  o.emissive = litGlass * isLit * win * vertical * uLitGain * mix( 0.4, 1.0, detail ) * alive;
  o.emissive += unlitGlow * ( 1.0 - isLit ) * win * ( 1.0 - frameBand ) * vertical * alive;

  float wet = win * mix( 0.55, 1.0, detail ) * vertical;
  o.roughness = mix( uWallRough, uGlassRough, wet );
  o.metalness = mix( uWallMetal, uGlassMetal, wet );
  return o;
}
`

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
    uWallRough: { value: p.wallRough },
    uWallMetal: { value: p.wallMetal },
    uGlassRough: { value: p.glassRough },
    uGlassMetal: { value: p.glassMetal },
    uLitRatio: { value: opts.night ? p.litRatio : 0.02 },
    // 夜里窗户要亮，但不能亮到丢掉室内的明暗关系
    uLitGain: { value: opts.night ? 0.62 : 0.1 },
    uKind: { value: p.kind },
    uJoint: { value: p.joint },
    uTransom: { value: p.transom },
    uTop: { value: opts.height },
    uBlankX: { value: opts.blank === 'x' ? 0 : 1 },
    uBlankZ: { value: opts.blank === 'z' ? 0 : 1 },
    uRelief: { value: p.relief },
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
    uFadeStart: { value: opts.fadeStart ?? 150 },
    uFadeEnd: { value: opts.fadeEnd ?? 420 },
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
  material.customProgramCacheKey = () => `facade-v6-${opts.night ? 'n' : 'd'}`

  return material
}
