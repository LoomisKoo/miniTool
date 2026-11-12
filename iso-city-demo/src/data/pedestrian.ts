// 南岸广场：商场所在的街区。
//
// 原来这里是 18 栋独立街屋排成的四条步行街。现在整块地让给一座胶囊形
// 商场（见 data/mall.ts，占地 3583㎡），楼外只剩一圈广场：
//
//            z=194 ┌──────────────────────────┐
//                  │      ╭────────────╮      │
//                  │  西  │            │  东  │   ← 商场 x 22~78, z 114~190
//                  │  侧  │  南岸广场  │  侧  │
//                  │  广  │  (胶囊)    │  广  │
//                  │  场  ╰────────────╯  场  │
//            z=110 └───────┬────牌坊────┬──────┘
//                       x=13           x=84
//
// 广场不是配角：商场的西门正对西侧广场上的牌坊，从主街走过来是
// "街 → 牌坊 → 广场 → 门厅 → 中庭"一路进深。四个角上的三角空地放了
// 长凳、花箱和小吃车，绕着商场走一圈也不会太空。

export const PED = {
  /** 广场铺装范围（含商场占地，商场自己再铺一层室内地面） */
  x0: 13,
  x1: 84,
  z0: 110,
  z1: 194,
  name: '南岸广场',
  sub: 'SOUTH BANK PLAZA',
} as const

/** 广场铺装：一整块，商场的地面盖在上面。 */
export const pedFloors = [{ id: 'plaza', x0: PED.x0, x1: PED.x1, z0: PED.z0, z1: PED.z1 }]

/**
 * 牌坊：西口进广场的那一座，东口从东面大道进来的那一座。
 * 都在 z=152（商场中心线）上，和商场的西门 / 东门对成一条门轴线。
 */
export const PED_GATES = [
  { id: 'west', x: 14.8, z: 152, yaw: Math.PI / 2, span: 10, label: '南岸广场', sub: 'SOUTH BANK PLAZA' },
  { id: 'east', x: 82.4, z: 152, yaw: Math.PI / 2, span: 8, label: '南岸广场', sub: 'SOUTH BANK PLAZA' },
] as const

/** 程序化街区的禁区。 */
export const pedReserved = { x0: 10, x1: 87, z0: 106, z1: 198 }

/**
 * 灯柱：沿西侧广场排一列，柱间拉灯串，把这 9m 宽的进场道做成一条灯廊。
 * 152 那一档空出来——牌坊和商场的门轴线不能被柱子截断。
 */
export const PED_POLES = [122, 134, 146, 158, 170, 182].map((z) => ({ x: 18.9, z, h: 6.4 }))

/** 灯串：相邻灯柱之间一跨。 */
export const pedStringSpans = PED_POLES.slice(0, -1).map((p, i) => {
  const q = PED_POLES[i + 1]
  return {
    id: `west-${i}`,
    a: [p.x, p.h, p.z] as [number, number, number],
    b: [q.x, q.h, q.z] as [number, number, number],
    sag: 0.85,
  }
})

/** 长凳：广场四角的空地上，坐着的人面朝商场。 */
export const pedBenches = [
  { x: 27, z: 121.5, yaw: 0.72 },
  { x: 73, z: 121.5, yaw: -0.72 },
  { x: 27, z: 182.5, yaw: Math.PI - 0.72 },
  { x: 73, z: 182.5, yaw: Math.PI + 0.72 },
  { x: 17.9, z: 127, yaw: Math.PI / 2 },
  { x: 17.9, z: 177, yaw: Math.PI / 2 },
]

/** 花箱、垃圾桶、护柱。 */
export const pedProps = [
  { kind: 'planter', x: 30, z: 118.5 },
  { kind: 'planter', x: 70, z: 118.5 },
  { kind: 'planter', x: 30, z: 185.5 },
  { kind: 'planter', x: 70, z: 185.5 },
  { kind: 'planter', x: 16.2, z: 118 },
  { kind: 'planter', x: 16.2, z: 186 },
  { kind: 'bin', x: 20.4, z: 136 },
  { kind: 'bin', x: 20.4, z: 168 },
  { kind: 'bin', x: 24.5, z: 124 },
  { kind: 'bin', x: 75.5, z: 180 },
  { kind: 'bollard', x: 14.6, z: 147.4 },
  { kind: 'bollard', x: 14.6, z: 156.6 },
  { kind: 'bollard', x: 82.6, z: 147.6 },
  { kind: 'bollard', x: 82.6, z: 156.4 },
] as const

/** 广场上的小吃车，放在四个角。 */
export const pedKiosks = [
  { id: 'k1', x: 19.7, z: 139, yaw: -Math.PI / 2, name: '糖水', sub: 'SWEET SOUP', color: '#8a4a2a', glow: '#ffb06a' },
  { id: 'k2', x: 19.7, z: 165, yaw: -Math.PI / 2, name: '烤串', sub: 'SKEWERS', color: '#6a2f24', glow: '#ff8a4a' },
  { id: 'k3', x: 80.7, z: 139, yaw: Math.PI / 2, name: '生果', sub: 'FRUIT', color: '#3d5a30', glow: '#b6e86a' },
] as const

/** 灯串下面挂的布幡。 */
export const PED_BANNERS = ['南', '岸', '广', '场', '集']
