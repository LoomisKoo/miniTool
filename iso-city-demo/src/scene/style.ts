/**
 * 画面风格开关。
 *
 * 默认走「风格化」：灯光靠贴片/自发光画出来，不用真实聚光灯和 AO，
 * 夜景底色压暗、只让发光体亮。URL 带 `?pbr` 时回到原来的写实管线，便于对比。
 */
export const STYLIZED =
  typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('pbr')

/**
 * 地面各层的固定深度先后（越负越靠前，与视角无关）。
 *
 * 路面、铺装、喷泉环、标线在世界坐标里只差 1~2cm——远小于斜视时
 * polygonOffset 造出的深度位移量。相邻两层如果用同一个偏移值，谁胜出
 * 就取决于相机位置和观察角度，屏幕上表现为路口 / 广场那块地面一直在闪。
 * 这里给每一层一套固定、互不重叠的偏移，顺序从此不随视角变化。
 *
 * factor 乘的是斜率项（平躺的远景地面斜率很大），units 乘的是深度缓冲的
 * 最小可分辨单位。相邻两层差 3 个单位：60m 处约 1mm、200m 处约 1cm，
 * 足够保证不打架；整条阶梯压在 30 个单位以内，不至于把地面推到盖住
 * 比它高 5cm 以上的东西（路缘石、花箱、商场室内地面）。
 *
 * 只给**不透明**的地面层用。加色光晕（GlowDisc、路灯光池、门店溢光）统一
 * 用最靠前的 pool：它们 depthWrite 关着，画在前面不会挡住任何东西，
 * 反而怕被地面层的斜率偏移切掉边角。
 */
export const GROUND_DEPTH = {
  /** 五条车行道，按渲染顺序 0~4 */
  roads: [
    { polygonOffsetFactor: -2, polygonOffsetUnits: -4 },
    { polygonOffsetFactor: -2, polygonOffsetUnits: -7 },
    { polygonOffsetFactor: -2, polygonOffsetUnits: -10 },
    { polygonOffsetFactor: -2, polygonOffsetUnits: -13 },
    { polygonOffsetFactor: -2, polygonOffsetUnits: -16 },
  ],
  /** 人行道、广场铺装（比沥青高 1~2cm） */
  paving: { polygonOffsetFactor: -4, polygonOffsetUnits: -19 },
  /** 叠在广场上的补片、巷子铺装：和 plaza 同高，得比 paving 再靠前一层 */
  pavingPatch: { polygonOffsetFactor: -5, polygonOffsetUnits: -21 },
  /** 喷泉内外两圈石环 */
  fountainInner: { polygonOffsetFactor: -6, polygonOffsetUnits: -23 },
  fountainOuter: { polygonOffsetFactor: -8, polygonOffsetUnits: -25 },
  /** 井盖、篦子贴片 */
  manhole: { polygonOffsetFactor: -8, polygonOffsetUnits: -27 },
  /** 车道线、斑马线、地面标线 */
  marking: { polygonOffsetFactor: -10, polygonOffsetUnits: -29 },
  /** 加色光晕、路灯光池、门店溢光：永远压在最前面（不写深度，不会挡东西） */
  pool: { polygonOffsetFactor: -16, polygonOffsetUnits: -48 },
} as const
