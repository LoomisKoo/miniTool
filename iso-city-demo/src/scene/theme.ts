import * as THREE from 'three'
import { ROW_BODIES } from '../data/city'
import { STYLIZED } from './style'

/** 这些墙色按原色使用，不再映射到统一色调表：联排小楼靠一户一色才有街坊感。 */
const LITERAL_BODIES = new Set(ROW_BODIES)

// 微光城区：默认夜间（AR 蓝）与黄昏两套配色。
// 所有场景组件从这里取色，避免颜色散落各处。

export type Palette = {
  key: 'night' | 'dusk'
  label: string
  sky: string
  fog: string
  fogNear: number
  fogFar: number
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  ambient: number
  sun: string
  sunIntensity: number
  sunPos: [number, number, number]
  exposure: number
  ground: string
  road: string
  paving: string
  pavingLine: string
  roadLine: string
  curb: string
  glowWarm: string
  glowCyan: string
  ar: string
  windowLit: string[]
  windowDark: string
  trim: string
  glass: string
  tree: string
  treeDark: string
  car: string[]
  accent: string
}

export const NIGHT: Palette = {
  key: 'night',
  label: '夜间',
  // 城市夜空不是黑蓝色：低云被街灯和橱窗映成暗橙，天比楼亮，楼是剪影。
  // 但只保留一点：之前这组颜色（#2a1f1c 纯暖棕 + 雾 #33261f）叠在天空着色器
  // 的橙色地平线上，整圈天边都是昏黄，看起来像傍晚。现在底色压冷压暗，
  // 只给地平线留一丝暖，夜晚才读成夜晚。
  // 夜景配色规则：底色（天、雾、楼、地）统一压在暗的、低饱和的蓝紫上，
  // 饱和的暖橙只留给光源（窗、路灯、光斑）。冷暖对比强、亮度对比克制，
  // 这是地图类夜景"好看"的主要来源。以前底色是灰蓝，冷暖都不够，读起来就是灰。
  // 底色只是"偏冷"，不是"紫"：天光、雾、路面、人行道全往蓝紫推时，
  // 叠在一起就是一整片紫色。冷只留在天和屋顶，地面回到中性。
  sky: '#252c40',
  // 雾是"远景楼群被染成的颜色"：远楼沉进冷灰蓝里，纵深靠它拉开。
  // 但雾不能当"背景遮罩"用。之前 85/600 意味着 150m 外的楼已经糊成灰蓝块，
  // 而整座城才 300m 见方——等于一半城市被雾吃掉了，画面自然又灰又乱。
  // 现在是"微缩模型"，模型不需要大气透视：拉到 200/1000，只留极远处一丝空气感。
  fog: '#2c3242',
  fogNear: 85,
  fogFar: 600,
  // 参考 slop-newyork 的"城市峡谷"配光：冷天光从上、暖石材/沥青反弹从下。
  // 蓝调时刻的天光是整场最强补光：天空是亮的，所以从上方来的光偏饱和蓝。
  hemiSky: '#4f5a72',
  // 地面反弹光：街灯和橱窗把地面映暖，从下往上打在立面底部。
  // 这是"冷天 + 暖地"的对比，也是滨江夜景最讨喜的地方。
  hemiGround: '#5a4c40',
  // 半球光给"天光 + 地面反弹"的骨架，但不能当主光：
  // 平铺的环境光叠太多，整张画面就会糊成一片灰色，楼体也没有受光面/背光面。
  //
  // 夜景的明度阶梯只有两级：楼体≈剪影、窗≈满亮。中间的灰不要。
  // 之前这里是 1.0（再乘 0.8）＋ ambient 0.15 ＋ IBL 0.32 ＋ 补光 0.3
  // ＋ 月光 1.15，五路光源把立面抬到中灰，于是窗只比墙亮一点，
  // 整城读成"蓝板子 + 橙点"，而不是"黑暗里的一片灯"。
  // 现在天光只负责让人看清轮廓，亮度全部让给窗户。
  hemiIntensity: 0.3,
  ambient: 0.08,
  sun: '#a4a8dc',
  // 蓝调时刻的太阳已经落到地平线以下，它留下的是一道很低的余晖：
  // 作用不是照亮，是给楼体打一条边缘光、并在立面上分出受光面和背光面。
  sunIntensity: 0.55,
  // 高度角压到 ~20°：平视时立面一半亮一半暗，这是高楼最好看的角度。
  // 原来是 118（接近顶光），窄街上所有立面都落进阴影，怎么加光都是暗墙。
  sunPos: [-150, 52, -112],
  // 只作为后处理未挂载时的兜底：EffectComposer 会把 renderer.toneMapping
  // 设成 NoToneMapping，这个值在正常运行时读不到。真正的曝光在 GradeEffect.uExposure。
  exposure: 1.85,
  // 地块底色：深墨绿。楼间空地在俯视下占画面最大面积，
  // 和楼、天同一个蓝紫色相时整城像一块塑料板；换成绿地色相，
  // 画面多出第三种颜色（蓝紫 / 暖橙 / 墨绿），读起来是"有绿化的城市"。
  ground: '#222c28',
  // 沥青的反照率约 0.10（线性），#1e1e1f 只有 0.013，夜里没有灯的地方就是纯黑。
  // 路面被天光照着，偏蓝紫，但绝对不该是黑。
  // 天光砍到 0.3 之后，路面必须靠自己的反照率撑住：路灯照到的地方
  // 要能读出车道线，没照到的地方才沉进黑——这才是参考图里街道的读法。
  road: '#4a4d57',
  paving: '#6b6660',
  pavingLine: '#7a746c',
  roadLine: '#cfc7b6',
  curb: '#4e4d50',
  glowWarm: '#ffbe7a',
  glowCyan: '#9ad8dc',
  ar: '#ffc98f',
  // 窗灯统一在暖橙一个色系里：混进冷白会冲淡冷暖对比
  windowLit: ['#ffc47e', '#ffb468', '#ffd49a', '#ffcf8c', '#ffbb72', '#ffe0b0'],
  // 没亮灯的窗是深蓝玻璃，不是黑洞：浅墙上一排黑洞就是"预制板楼"的样子
  windowDark: '#1b2130',
  // 夜间家具/杆件的公共色。以前是 #2d2d2e（线性约 0.026），在城市夜景里
  // 就是一片纯黑：长椅、花池、灯杆、雨棚骨架全变成剪影，读不出形体。
  // 抬到中性深灰后仍然比楼体暗，但能看清边缘和转折。
  trim: '#3f3f46',
  // 玻璃基色。蓝调时刻的幕墙不是深色实心板，它是一面镜子：
  // 底色抬到蓝紫，反射才有东西可乘，整栋楼的"高级感"全在这一条上。
  glass: '#2b3345',
  // 树在夜里是偏青的深绿，被暖光照到的一侧才显绿。
  // 之前 #2c4040 在天光 1.0 下算出来是中等亮度的绿，比楼体还跳——
  // 夜里最亮的东西必须永远是窗，所以树直接压到剪影档。
  tree: '#1d2a26',
  treeDark: '#151f1e',
  car: ['#dfe2e0', '#c9cbcd', '#8a8f96', '#4f565e', '#2a2d31', '#7a2f2a', '#31495c', '#a8894f'],
  accent: '#ffc98f',
}

export const DUSK: Palette = {
  key: 'dusk',
  label: '白天',
  // 白天的天空是一块纯色底，不是一个主角。
  // 之前是天顶近白 + 地平线橙的渐变，占掉画面上四分之一，
  // 城市被压在下面就成了配角；参考图里天空只是"没画东西的地方"。
  sky: '#9dc9e8',
  // 雾不要早：70m 就开始起雾会把整条街的楼洗成白纸
  // 雾色也不能接近白：白雾 + 浅基色的楼 = 整座城糊成一张白纸。
  // 现在压成偏青的灰，远处只降对比，不抬亮度。
  // 改成冷白之后要再往后退：240m 之内必须是清清楚楚的街景。
  fog: '#b7cbd9',
  fogNear: 240,
  fogFar: 900,
  // 白天的大头是太阳，天光只负责让阴影里有色。
  hemiSky: '#dbe8ee',
  hemiGround: '#8a8577',
  hemiIntensity: 0.45,
  ambient: 0.1,
  sun: '#fff3dc',
  // 白天做成"高调"：整张画面大部分落在中间偏亮，暗部只留在窗内和楼底。
  // 之前 sunIntensity 1.35 ＋ 环境光 0.36，两者相加≈平光，
  // 于是楼体没有受光面/背光面，只剩一片均匀的灰。
  sunIntensity: 2.1,
  // 太阳高度角是"立面有没有光"的唯一开关。
  // 46° 已经能打亮立面，但太阳压得低，天空整片变成橙色；
  // 抬到 43° 以上、靠近正午，天空才读成蓝色，楼才有顶面受光。
  sunPos: [120, 150, 84],
  exposure: 1.45,
  ground: '#8e9a84',
  // 白天的沥青是浅灰，不是夜里那种近黑。#3c4348 在街道阴影里
  // 算出来只有 14/255，整条路读成一条黑洞，这是白天没吸引力的第二个原因。
  road: '#6f757a',
  paving: '#b2b3ab',
  pavingLine: '#bcbcb2',
  roadLine: '#f5f1e2',
  curb: '#a8aba0',
  glowWarm: '#ffdcb0',
  glowCyan: '#8fe6f2',
  ar: '#3f9aa8',
  // 白天开灯的窗少但要亮：2% 的房间开着灯，是"有人在"的证据
  windowLit: ['#ffd9a8', '#ffe7c4', '#ffe0b4'],
  windowDark: '#5f7a88',
  trim: '#96a1a4',
  glass: '#7f9aa8',
  // 白天的树要饱和：这是画面里唯一的大面积彩色，
  // 灰楼 + 蓝天的构图靠它撑起来。
  tree: '#5f9455',
  treeDark: '#4d7a48',
  car: ['#e6e2d8', '#b9a88f', '#7b8a8a', '#6b7d84', '#a59b86', '#8d7f6c', '#5d3b36', '#3e5a63'],
  accent: '#c98a52',
}

/**
 * 风格化夜景：夜不靠"暗"，靠冷色调 + 暖窗灯。
 * 楼体、屋顶、街道、绿地在夜里都要读得清楚，明暗主要来自受光面（顶 > 侧 > 背），
 * 而不是把整座城压成剪影。
 */
if (STYLIZED) {
  Object.assign(NIGHT, {
    sky: '#151b2c',
    fog: '#1d2434',
    fogNear: 200,
    fogFar: 1000,
    // 参考图的骨架是"深蓝黑底 + 稀疏暖窗"：底色压冷压暗，
    // 亮的地方只留给窗、招牌、路灯。但楼体不能压到读不出形体：
    // 立面明暗、檐口、屋顶机组是"城市"的部分，全黑就只剩一片窗点。
    // 所以天光/月光留在能看清轮廓的档位，靠窗灯的高亮拉开对比，
    // 而不是靠把楼压死。
    hemiSky: '#646878',
    hemiGround: '#3d3730',
    hemiIntensity: 0.85,
    ambient: 0.2,
    sun: '#b0b3c4',
    sunIntensity: 0.95,
    sunPos: [-90, 170, -60],
    // 底盘是街区里的水泥地，不是草地：大面积绿色在俯视下会连成一片"黄绿"，
    // 绿色只留给真正的草坪和树。
    ground: '#2b2d36',
    road: '#3b3e46',
    // 铺装不能偏暖：暖灰在月光下会和黄窗连成一片暖色，整城就没有冷部
    paving: '#565a60',
    pavingLine: '#63676d',
    curb: '#4a4a51',
    trim: '#45464e',
    // 窗色的黄度降一档：纯 #ffc964 连成片时整条街是一条荧光黄带
    windowLit: ['#ffd8a4', '#ffd094', '#ffe0b8', '#ffd79f', '#ffcb8c', '#ffe8c6'],
    // 没开灯的窗是中性深灰玻璃，不是饱和深蓝
    windowDark: '#22262e',
    glass: '#333a47',
    tree: '#1d3527',
    treeDark: '#16291e',
  } satisfies Partial<Palette>)
}

export const palettes = { night: NIGHT, dusk: DUSK }

/**
 * 夜间街具的"反弹光"补偿。
 *
 * 地面有 emissive 兜底（见 Ground 的 pavingGlow），所以路面在夜里是亮的；
 * 街具（长椅、花池、防撞柱、灯杆、站牌）没有这一层，只吃 ambient + 半球光，
 * 而夜间的 ambient 本来就只有 0.25：竖着的面板几乎收不到半球光，最后算出来
 * 只有 0.02 左右的线性亮度——在屏幕上看就是纯黑的剪影，形体完全读不出来。
 *
 * 这里给它们补一点点自己的颜色当自发光，相当于整座城市的灯打在物件上的
 * 反弹光。改动只影响夜里，白天返回空对象。
 */
export function nightFill(night: boolean, color = '#1d2026', intensity = 0.55) {
  return night ? { emissive: color, emissiveIntensity: intensity } : {}
}

/**
 * 墙面色板：奶油、杏、浅玫瑰、沙色、浅丁香。
 *
 * 数据里二十几栋楼的 body 色全是同一个蓝灰色相，墙一律是"混凝土灰"，
 * 这就是"钢筋水泥感"的来源之一。地图类风格的墙是低饱和的暖粉彩，
 * 配上深蓝坡顶和暖窗，冷暖分明。饱和度压在 0.2~0.35，不做成糖果色。
 */
const WALL_TONES: Array<[number, number, number]> = [
  [0.1, 0.32, 0.82], // 奶油
  [0.07, 0.3, 0.78], // 杏
  [0.98, 0.22, 0.8], // 浅玫瑰
  [0.09, 0.2, 0.74], // 沙
  [0.72, 0.16, 0.78], // 浅丁香
  [0.11, 0.12, 0.86], // 米白
]

function hash01(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

/** 风格化墙色：砖红、土黄、深棕、赭石、暖灰——有分量的实色，夜里也不压成剪影。 */
// 饱和度压在 0.06~0.3：高饱和的红橙一大片就是"廉价感"，
// 砖色要偏棕、石材要偏灰，鲜艳只留给窗灯和招牌。
const STYLIZED_WALL_TONES: Array<[number, number, number]> = [
  [0.03, 0.3, 0.38], // 旧砖
  [0.1, 0.2, 0.62], // 米黄石
  [0.07, 0.18, 0.3], // 深咖
  [0.08, 0.07, 0.52], // 暖灰
  [0.06, 0.13, 0.43], // 灰褐
  [0.6, 0.06, 0.46], // 冷灰
  [0.02, 0.24, 0.3], // 深砖
  [0.09, 0.32, 0.46], // 赭石
  [0.04, 0.22, 0.5], // 浅陶土
  [0.11, 0.12, 0.56], // 沙岩
]

export function bodyColor(hex: string, palette: Palette) {
  if (STYLIZED) {
    const base = LITERAL_BODIES.has(hex)
      ? new THREE.Color(hex)
      : (() => {
          const [h, s, l] = STYLIZED_WALL_TONES[Math.floor(hash01(hex) * STYLIZED_WALL_TONES.length) % STYLIZED_WALL_TONES.length]
          return new THREE.Color().setHSL(h, s, l)
        })()
    // 夜里墙压成深砖色、加饱和：屋顶是浅蓝紫的亮面，墙要比它暗一大截，
    // 亮窗才跳得出来。但不能压到 0.62，那样砖缝、窗套、檐口全糊进黑里。
    if (palette.key !== 'night') return base
    const hsl = { h: 0, s: 0, l: 0 }
    base.getHSL(hsl)
    // 米黄、沙岩这类浅墙再乘 0.72 仍是奶油色，成片时整城发黄，所以再封一个上限
    // 上限 0.32 / 乘 0.72 时深砖楼直接压成黑块，这里留到"暗但看得出砖色"
    return base.setHSL(hsl.h, Math.min(1, hsl.s * 1.15), Math.min(0.42, hsl.l * 0.86))
  }
  const [h, s, l] = WALL_TONES[Math.floor(hash01(hex) * WALL_TONES.length) % WALL_TONES.length]
  // 原色的明度差保留一点：深色楼仍然比浅色楼深一档
  const src = new THREE.Color(hex)
  const lum = src.r * 0.2126 + src.g * 0.7152 + src.b * 0.0722
  const base = new THREE.Color().setHSL(h, s, l * (0.88 + lum * 0.16))
  // 夜里墙压成剪影：天光只剩 0.3，如果墙还是 0.8 倍，
  // 它靠反照率就能撑住中灰，窗又没地方亮了。
  return palette.key === 'night' ? base.multiplyScalar(0.55) : base.multiplyScalar(1.0)
}

/** 稳定伪随机，避免每次渲染窗户点亮状态变化。 */
export function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
