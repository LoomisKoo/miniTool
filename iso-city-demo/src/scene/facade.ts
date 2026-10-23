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
  /** 切角占掉的墙角宽度，窗格要向内让开，否则会被削角切掉半扇窗 */
  inset?: number
  seed?: number
  fadeStart?: number
  fadeEnd?: number
  /** 哪个方向是山墙（无窗的侧墙）：真实街区里楼与楼贴着，背面常常没有窗 */
  blank?: 'x' | 'z' | 'none'
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
    litRatio: 0.36,
    kind: 0,
    joint: 0.32,
    transom: 0.58,
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
    litRatio: 0.34,
    kind: 1,
    joint: 1.65,
    transom: 0.62,
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
    litRatio: 0.4,
    kind: 2,
    joint: 1.2,
    transom: 0.7,
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
    litRatio: 0.42,
    kind: 3,
    joint: 1.5,
    transom: 0,
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

struct FacadeOut {
  vec3 color;
  vec3 emissive;
  float roughness;
  float metalness;
};

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
  float alive = 1.0 - smoothstep( 320.0, 620.0, dist );

  // ---------- 墙面脏污 ----------
  // 竖向拉伸的噪声 = 雨水顺着墙面流下来留下的痕迹
  float streak = fNoise( vec2( vFacadePos.x * 2.6 + vFacadePos.z * 2.6, vFacadePos.y * 0.16 ) + uSeed );
  float blotch = fNoise( vec2( vFacadePos.x * 0.55 + vFacadePos.z * 0.55, vFacadePos.y * 0.4 ) + uSeed * 2.0 );
  float grime = mix( 0.5, 1.0, streak ) * mix( 0.75, 1.0, blotch );

  bool xFace = abs( n.x ) > abs( n.z );
  float span = xFace ? uSpanX : uSpanZ;
  float along = ( xFace ? vFacadePos.z : vFacadePos.x ) + span * 0.5;
  float y = vFacadePos.y;

  // ---------- 窗格网格 ----------
  float usable = max( uWinW * 1.2, span - uInset * 2.0 );
  float cw = uWinW + uGap;
  float cols = max( 1.0, floor( usable / cw ) );
  float pad = uInset + ( usable - cols * cw ) * 0.5;
  float uu = ( along - pad ) / cw;
  float cell = floor( uu );
  float fx = fract( uu );

  float fv = ( y - uBase ) / uFloorH;
  float row = floor( fv );
  float fy = fract( fv );
  // 顶部留一圈实墙（女儿墙），不再让窗户一直排到楼顶
  float ok = step( 0.0, row ) * step( uBase, y ) * step( y, uTop - 1.05 );
  float blank = xFace ? uBlankX : uBlankZ;

  float wx = uWinW / cw;
  float l = ( 1.0 - wx ) * 0.5;
  float r = 1.0 - l;
  float bot = uSill;
  float top = min( 0.95, uSill + uWinH / uFloorH );

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
  // 墙脚发黑
  wallCol *= mix( 0.84, 1.0, smoothstep( uBase, uBase + 2.4, y ) );

  // 砖缝 / 石材板缝
  if ( uKind < 2.5 ) {
    float jointD = abs( fract( y / uJoint ) - 0.5 ) * uJoint;
    float jointLine = lineMask( jointD, uJoint * ( uKind < 0.5 ? 0.1 : 0.055 ) );
    wallCol *= 1.0 - jointLine * 0.16 * detail;
    if ( uKind > 0.5 ) {
      // 石材层的竖向板缝
      float vs = abs( fract( along / uJoint + row * 0.5 ) - 0.5 ) * uJoint;
      wallCol *= 1.0 - lineMask( vs, 0.05 ) * 0.14 * detail;
    }
  }

  // 窗洞外圈：墙面被窗洞"咬"进去一圈，边缘有细微的暗角
  float edgeGap = max( max( l - fx, fx - r ), max( bot - fy, fy - top ) );
  float recess = exp( -max( edgeGap, 0.0 ) * 30.0 ) * ( 1.0 - win ) * ok;
  wallCol *= 1.0 - 0.3 * recess * detail;

  // 楼层线（每个窗台高度一条极淡的横线）
  wallCol *= 1.0 - lineMask( abs( fy - 0.006 ), 0.014 ) * 0.22 * detail;

  // ---------- 窗内部 ----------
  float depthV = clamp( ( fy - bot ) / max( top - bot, 0.001 ), 0.0, 1.0 );
  // 玻璃：越往上越接近天空的亮部
  vec3 glassCol = uGlass * ( 0.52 + 0.85 * depthV );
  glassCol *= 0.92 + 0.16 * fHash( vec2( cell, row ) + uSeed );
  // 偶尔有一扇拉着浅色窗帘
  float curtain = step( 0.84, fHash( vec2( cell * 2.3 + 5.0, row * 1.9 ) + uSeed * 3.0 ) );
  glassCol = mix( glassCol, uTrim * 1.25, curtain * 0.55 );

  float litPick = fHash( vec2( cell * 1.7 + 3.0, row * 2.3 + 1.0 ) + uSeed * 2.0 );
  float isLit = step( litPick, uLitRatio );
  vec3 litCol = mix( uLitWarm, uLitCool, step( 0.68, fHash( vec2( row * 3.1, cell * 0.7 ) + uSeed * 5.0 ) ) );
  litCol *= 0.55 + 0.75 * fHash( vec2( cell + 1.0, row + 7.0 ) );

  // 亮窗内部：天花板附近更亮、地面附近更暗，中间有家具/人的暗块
  vec3 litGlass = litCol * ( 0.9 + 0.5 * smoothstep( 0.45, 1.0, depthV ) );
  litGlass *= 0.72 + 0.5 * smoothstep( 0.0, 0.22, depthV );
  litGlass *= mix( 1.0, 0.55, curtain );
  float furniture = step( 0.72, fHash( vec2( cell * 0.7, row * 1.3 ) + uSeed * 7.0 ) );
  litGlass *= 1.0 - furniture * ( 1.0 - smoothstep( 0.0, 0.42, depthV ) ) * 0.3;

  vec3 winCol = mix( glassCol, litGlass, isLit );

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

  float wet = win * mix( 0.55, 1.0, detail ) * vertical;
  o.roughness = mix( uWallRough, uGlassRough, wet );
  o.metalness = mix( uWallMetal, uGlassMetal, wet );
  return o;
}
`

export function createFacadeMaterial(opts: FacadeOptions) {
  const p = PARAMS[opts.style]
  const base = opts.base ?? (opts.style === 'glass' ? 4.2 : 3.4)
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: p.wallRough,
    metalness: p.wallMetal,
    envMapIntensity: opts.style === 'glass' ? 1.1 : 0.75,
  })

  const uniforms = {
    uWall: { value: new THREE.Color(opts.wall) },
    uTrim: { value: new THREE.Color(opts.trim) },
    uGlass: { value: new THREE.Color(opts.glass) },
    uLitWarm: { value: new THREE.Color(opts.litWarm) },
    uLitCool: { value: new THREE.Color(opts.litCool) },
    uFloorH: { value: p.floorH },
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
    uLitGain: { value: opts.night ? 1.25 : 0.1 },
    uKind: { value: p.kind },
    uJoint: { value: p.joint },
    uTransom: { value: p.transom },
    uTop: { value: opts.height },
    uBlankX: { value: opts.blank === 'x' ? 0 : 1 },
    uBlankZ: { value: opts.blank === 'z' ? 0 : 1 },
    // 每栋楼一个稳定偏移，同一条街上不会出现完全一样的亮窗图案
    uSeed: { value: (opts.seed ?? 0) * 37.19 },
    uFadeStart: { value: opts.fadeStart ?? 90 },
    uFadeEnd: { value: opts.fadeEnd ?? 230 },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexPars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexMain}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentPars}`)
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
  material.customProgramCacheKey = () => `facade-v3-${opts.night ? 'n' : 'd'}`

  return material
}
