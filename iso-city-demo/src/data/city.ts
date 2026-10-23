export type BuildingStyle = 'stone' | 'glass' | 'metal' | 'brick'

export type BuildingDef = {
  id: string
  name: string
  x: number
  z: number
  w: number
  d: number
  h: number
  style: BuildingStyle
  body: string
  trim: string
  roof: 'mechanical' | 'garden' | 'antenna' | 'plain' | 'crown'
  setback?: boolean
  balconies?: boolean
  sign?: string
  signColor?: string
  entranceSide?: 'north' | 'south' | 'east' | 'west'
  /** 面向街道的一侧（程序化街区用来挂店面和雨棚） */
  facing?: 'north' | 'south' | 'east' | 'west'
  entranceAt?: [number, number]
  target?: { kind: 'public'; id: 'gallery' | 'cafe' } | { kind: 'space'; id: string }
  entranceLabel?: string
  entranceUse?: string
  landmark?: boolean
  background?: boolean
  accent?: string
  taper?: number
}

// 微光城区总平面：主街南北贯通，西侧是镜池广场，东侧是回声巷。
// 外围增加第二圈街区（西岸大道 / 南横街 / 东岸大道），让城市有真正的纵深可走。
export const CITY_BOUNDS = 148

export const buildings: BuildingDef[] = [
  {
    id: 'gallery',
    name: '光盒美术馆',
    x: -59,
    z: 8,
    w: 22,
    d: 30,
    h: 19,
    style: 'stone',
    body: '#cfd7de',
    trim: '#93a2b0',
    roof: 'garden',
    setback: true,
    sign: 'LUMA',
    signColor: '#1d3d4c',
    entranceSide: 'east',
    entranceAt: [-47.1, 8],
    target: { kind: 'public', id: 'gallery' },
    entranceLabel: '光盒美术馆',
    entranceUse: '公共展厅 · 可进入',
    accent: '#8fd8e8',
  },
  {
    id: 'riverside',
    name: '河岸公寓',
    x: -34,
    z: -47,
    w: 30,
    d: 26,
    h: 52,
    style: 'metal',
    body: '#c4ccd6',
    trim: '#7f8f9f',
    roof: 'mechanical',
    setback: true,
    balconies: true,
    sign: 'RIVERSIDE',
    signColor: '#1c3444',
    entranceSide: 'south',
    entranceAt: [-34, -32.7],
    target: { kind: 'space', id: 'river-loft' },
    entranceLabel: '河岸公寓',
    entranceUse: '07F · 河岸小屋',
  },
  {
    id: 'soundfield',
    name: '声场唱片',
    x: 30,
    z: -37,
    w: 24,
    d: 20,
    h: 15,
    style: 'brick',
    body: '#96a5b3',
    trim: '#6d7d8d',
    roof: 'antenna',
    sign: 'SOUND FIELD',
    signColor: '#122e3a',
    entranceSide: 'west',
    entranceAt: [16.9, -37],
    target: { kind: 'space', id: 'sound-room' },
    entranceLabel: '声场唱片',
    entranceUse: 'B1 · 静音工作室',
    accent: '#8fe0d6',
  },
  {
    id: 'cafe',
    name: '街角咖啡',
    x: 26,
    z: 29,
    w: 18,
    d: 14,
    h: 11,
    style: 'stone',
    body: '#cfd4d2',
    trim: '#95a09f',
    roof: 'garden',
    sign: 'CORNER',
    signColor: '#3a2a1e',
    entranceSide: 'west',
    entranceAt: [15.7, 29],
    target: { kind: 'public', id: 'cafe' },
    entranceLabel: '街角咖啡',
    entranceUse: '公共室内 · 可进入',
    accent: '#ffc98f',
  },
  {
    id: 'midtown',
    name: '中巷工作室',
    x: 36,
    z: -2,
    w: 16,
    d: 20,
    h: 12,
    style: 'brick',
    body: '#a8b3bd',
    trim: '#7b8894',
    roof: 'mechanical',
    sign: 'MIDTOWN',
    signColor: '#20323f',
    entranceSide: 'west',
    entranceAt: [27.2, -2],
  },
  {
    id: 'lumen-tower',
    name: '微光塔',
    x: 52,
    z: 74,
    w: 26,
    d: 26,
    h: 92,
    style: 'glass',
    body: '#7fa3b6',
    trim: '#4f7186',
    roof: 'crown',
    setback: true,
    taper: 0.22,
    landmark: true,
    sign: 'LUMEN',
    signColor: '#0d2733',
    accent: '#8fe8ff',
  },
  {
    id: 'office-east',
    name: '东岸办公楼',
    x: 58,
    z: 4,
    w: 22,
    d: 34,
    h: 48,
    style: 'glass',
    body: '#8fabba',
    trim: '#5c7b8d',
    roof: 'mechanical',
    setback: true,
  },
  {
    id: 'west-residence',
    name: '雪松公寓',
    x: -70,
    z: 80,
    w: 24,
    d: 26,
    h: 36,
    style: 'stone',
    body: '#cbd3da',
    trim: '#8f9eac',
    roof: 'garden',
    balconies: true,
  },
  {
    id: 'north-office',
    name: '北岸中心',
    x: -58,
    z: -76,
    w: 30,
    d: 22,
    h: 34,
    style: 'metal',
    body: '#bcc7d2',
    trim: '#8493a2',
    roof: 'mechanical',
    setback: true,
  },
  {
    id: 'east-north',
    name: '东仓',
    x: 58,
    z: -66,
    w: 24,
    d: 20,
    h: 30,
    style: 'brick',
    body: '#9aa8b5',
    trim: '#72808e',
    roof: 'antenna',
  },
  {
    id: 'south-west',
    name: '南园住宅',
    x: -48,
    z: 66,
    w: 24,
    d: 18,
    h: 23,
    style: 'stone',
    body: '#cdd5dc',
    trim: '#94a2b0',
    roof: 'garden',
    balconies: true,
  },
  {
    id: 'south-east',
    name: '塔下小楼',
    x: 20,
    z: 67,
    w: 18,
    d: 16,
    h: 19,
    style: 'metal',
    body: '#c3ccd6',
    trim: '#8998a6',
    roof: 'mechanical',
  },
  {
    id: 'west-market',
    name: '西岸市场',
    x: -120,
    z: 20,
    w: 26,
    d: 32,
    h: 21,
    style: 'stone',
    body: '#c8d0d8',
    trim: '#8d9bab',
    roof: 'garden',
    sign: 'WEST MARKET',
    signColor: '#243240',
    accent: '#ffd49b',
  },
  {
    id: 'harbor-hotel',
    name: '港湾酒店',
    x: -120,
    z: -54,
    w: 28,
    d: 30,
    h: 64,
    style: 'glass',
    body: '#88a7ba',
    trim: '#587a90',
    roof: 'antenna',
    setback: true,
  },
  {
    id: 'north-tower',
    name: '北塔',
    x: -50,
    z: -126,
    w: 34,
    d: 26,
    h: 86,
    style: 'glass',
    body: '#7e9db0',
    trim: '#4e6f84',
    roof: 'mechanical',
    setback: true,
  },
  {
    id: 'lab-east',
    name: '东岸研究所',
    x: 64,
    z: -126,
    w: 28,
    d: 24,
    h: 44,
    style: 'metal',
    body: '#aebbc8',
    trim: '#7b8b9b',
    roof: 'mechanical',
    setback: true,
  },
  {
    id: 'arena',
    name: '回声剧场',
    x: 120,
    z: -58,
    w: 30,
    d: 36,
    h: 26,
    style: 'stone',
    body: '#c1cbd6',
    trim: '#8695a6',
    roof: 'plain',
    sign: 'ECHO HALL',
    signColor: '#1a2b3a',
    accent: '#ffb984',
  },
  {
    id: 'east-mall',
    name: '东岸商场',
    x: 122,
    z: 14,
    w: 28,
    d: 34,
    h: 40,
    style: 'glass',
    body: '#88a8bb',
    trim: '#5a7d92',
    roof: 'mechanical',
    setback: true,
    sign: 'EAST ARCADE',
    signColor: '#122c3b',
  },
  {
    id: 'south-tower',
    name: '回声塔',
    x: 58,
    z: 118,
    w: 30,
    d: 30,
    h: 104,
    style: 'glass',
    body: '#7b9cb2',
    trim: '#4c6f86',
    roof: 'crown',
    setback: true,
    taper: 0.16,
    landmark: true,
    sign: 'ECHO',
    signColor: '#0b2431',
    accent: '#a8f0ff',
  },
  {
    id: 'old-station',
    name: '旧车站',
    x: -56,
    z: 122,
    w: 38,
    d: 24,
    h: 18,
    style: 'stone',
    body: '#cfd6dc',
    trim: '#97a4b1',
    roof: 'plain',
    sign: 'CENTRAL',
    signColor: '#1c2c3a',
    accent: '#ffd9a6',
    balconies: false,
  },
  {
    id: 'garden-flats',
    name: '花园公寓',
    x: -120,
    z: 104,
    w: 26,
    d: 32,
    h: 44,
    style: 'stone',
    body: '#cad3db',
    trim: '#8f9fae',
    roof: 'garden',
    balconies: true,
  },
  {
    id: 'south-block',
    name: '南岸塔楼',
    x: 122,
    z: 112,
    w: 26,
    d: 28,
    h: 58,
    style: 'metal',
    body: '#b3bfcb',
    trim: '#8090a0',
    roof: 'mechanical',
  },
  {
    id: 'north-block',
    name: '北街公寓',
    x: 122,
    z: -130,
    w: 24,
    d: 26,
    h: 38,
    style: 'stone',
    body: '#c9d2da',
    trim: '#8e9dac',
    roof: 'garden',
    balconies: true,
  },
]

// 远景楼群，只负责轮廓和空气透视
export const skyline: Array<{
  x: number
  z: number
  w: number
  d: number
  h: number
  color: string
}> = [
  { x: -196, z: -60, w: 30, d: 42, h: 78, color: '#243445' },
  { x: -186, z: 44, w: 24, d: 30, h: 46, color: '#1d2c3b' },
  { x: -178, z: 148, w: 32, d: 34, h: 62, color: '#213140' },
  { x: -40, z: -196, w: 40, d: 28, h: 92, color: '#243546' },
  { x: 46, z: -204, w: 30, d: 32, h: 74, color: '#1f3040' },
  { x: 172, z: -148, w: 34, d: 30, h: 58, color: '#223343' },
  { x: 196, z: -20, w: 30, d: 38, h: 96, color: '#1e2f3f' },
  { x: 186, z: 96, w: 28, d: 30, h: 52, color: '#253646' },
  { x: 128, z: 202, w: 36, d: 28, h: 68, color: '#203041' },
  { x: 12, z: 214, w: 30, d: 26, h: 48, color: '#243444' },
  { x: -130, z: 206, w: 34, d: 28, h: 56, color: '#223242' },
  { x: -212, z: 128, w: 26, d: 30, h: 40, color: '#1f2e3d' },
  { x: -120, z: -150, w: 30, d: 26, h: 50, color: '#243546' },
  { x: 120, z: -200, w: 26, d: 28, h: 64, color: '#213141' },
]

export const mainStreet = { x: 0, z: 0, w: 22, d: 300 }
export const crossStreet = { x: 0, z: 45, w: 300, d: 20 }
export const southCross = { x: 0, z: -95, w: 300, d: 16 }
export const westAvenue = { x: -92, z: 0, w: 16, d: 300 }
export const eastAvenue = { x: 92, z: 0, w: 16, d: 300 }
export const plaza = { x: -27.5, z: 6, w: 39, d: 54 }
export const cedarLane = { x: -20, z: -22, w: 56, d: 10 }
export const alley = { x: 21, z: -2, w: 12, d: 44 }
export const alleyMouth = { x: 11, z: 0, w: 8, d: 8 }

export const trees: Array<[number, number, number?]> = [
  [-42, -20, 1.1],
  [-41, 16, 1.25],
  [-35, 22, 0.95],
  [-14, -22, 0.9],
  [-14, 22, 1.05],
  [-46, -8, 0.85],
  [-46, 9, 0.9],
  [10, -12, 0.8],
  [10, 18, 0.82],
  [43, 40, 1.0],
  [33, 42, 0.9],
  [-10, 42, 0.95],
  [-10, 51, 0.9],
  [-58, -30, 0.85],
  [12, -51, 0.9],
  [-20, 62, 1.0],
  [4, 62, 0.9],
  [82, 60, 1.05],
  [82, 34, 0.95],
  [-82, 60, 1.0],
  [-82, -72, 0.9],
  [82, -80, 0.95],
  [104, 42, 0.9],
  [-104, 62, 0.85],
  [-104, -20, 1.0],
  [-14, -70, 0.9],
  [14, -70, 0.9],
  [-14, 88, 0.9],
  [14, 88, 0.9],
  [42, 96, 0.95],
  [-74, 130, 0.9],
]

export const lamps: Array<[number, number]> = [
  [-12.8, -80],
  [-12.8, -54],
  [-12.8, -28],
  [-12.8, -8],
  [-12.8, 20],
  [-12.8, 62],
  [-12.8, 88],
  [12.8, -86],
  [12.8, -58],
  [12.8, -30],
  [12.8, -6],
  [12.8, 24],
  [12.8, 64],
  [12.8, 92],
  [-44, 25],
  [-30, 25],
  [-18, 25],
  [-44, -25],
  [-30, -25],
  [-8, 32],
  [-8, -8],
  [-8, 70],
  [16, 40],
  [30, 40],
  [56, 40],
  [-56, 40],
  [-82, 36],
  [-82, 54],
  [82, 34],
  [82, 58],
  [-100, 8],
  [-100, -18],
  [100, 8],
  [100, -18],
  [-20, -92],
  [20, -92],
  [-20, 96],
  [20, 96],
]

export const benches: Array<[number, number, number]> = [
  [-34, 11, 0],
  [-22, 11, 0],
  [-27, 2.2, Math.PI],
  [-16, -17, Math.PI / 2],
  [-45, -18, Math.PI / 2],
  [22, 12, 0.2],
  [18, 20, 0],
  [40, 54, -1.1],
  [-17, 40, Math.PI / 2],
  [17, 40, -Math.PI / 2],
  [-60, 30, 0],
  [-60, -14, 0],
  [66, 40, Math.PI],
  [-8, 100, Math.PI / 2],
]

export const cars: Array<{ x: number; z: number; rot: number; color: string }> = [
  { x: -8.2, z: -128, rot: 0, color: '#9db0c2' },
  { x: -8.2, z: 76, rot: 0, color: '#c6d2dc' },
  { x: 8.2, z: -64, rot: Math.PI, color: '#6f879b' },
  { x: 8.2, z: 108, rot: Math.PI, color: '#a9b8c6' },
  { x: -60, z: 50.6, rot: -Math.PI / 2, color: '#8ea1b3' },
  { x: 62, z: 39.4, rot: Math.PI / 2, color: '#c1ced9' },
  { x: -118, z: 36, rot: 0, color: '#95a8ba' },
]

export const planters: Array<[number, number, number]> = [
  [-40, 10, 2.2],
  [-40, 2, 2.2],
  [-14, 10, 1.8],
  [-14, 2, 1.8],
  [13.5, -44, 1.7],
  [13.5, 34, 1.6],
  [44, 58, 2.0],
  [-8, 60, 1.6],
  [8, 80, 1.8],
  [70, 50, 1.9],
  [-104, 44, 1.9],
]

export const plazaFountain = { x: -27, z: 6, r: 5.2 }

/** 车道：用于动态车流。dir 表示沿轴正方向为 1。 */
export type Lane = {
  axis: 'x' | 'z'
  offset: number
  dir: 1 | -1
  from: number
  to: number
  speed: number
}

export const lanes: Lane[] = [
  { axis: 'z', offset: -8.4, dir: 1, from: -150, to: 150, speed: 11 },
  { axis: 'z', offset: -3.2, dir: 1, from: -150, to: 150, speed: 14 },
  { axis: 'z', offset: 3.2, dir: -1, from: -150, to: 150, speed: 13 },
  { axis: 'z', offset: 8.4, dir: -1, from: -150, to: 150, speed: 10 },
  { axis: 'x', offset: 40.4, dir: -1, from: -150, to: 150, speed: 12 },
  { axis: 'x', offset: 49.6, dir: 1, from: -150, to: 150, speed: 12 },
  { axis: 'x', offset: -99.6, dir: 1, from: -150, to: 150, speed: 10 },
  { axis: 'x', offset: -90.4, dir: -1, from: -150, to: 150, speed: 10 },
  { axis: 'z', offset: -88.5, dir: 1, from: -140, to: 140, speed: 9 },
  { axis: 'z', offset: 88.5, dir: -1, from: -140, to: 140, speed: 9 },
]

/** 行人：主街 / 横街人行道与广场环形步道。 */
export type WalkerRoute =
  | { kind: 'line'; axis: 'x' | 'z'; offset: number; from: number; to: number; speed: number; dir: 1 | -1 }
  | { kind: 'circle'; cx: number; cz: number; r: number; speed: number; dir: 1 | -1 }

export const walkerRoutes: WalkerRoute[] = [
  { kind: 'line', axis: 'z', offset: -11.6, from: -130, to: 130, speed: 1.5, dir: 1 },
  { kind: 'line', axis: 'z', offset: -11.6, from: -120, to: 120, speed: 1.25, dir: -1 },
  { kind: 'line', axis: 'z', offset: 11.6, from: -130, to: 130, speed: 1.65, dir: -1 },
  { kind: 'line', axis: 'z', offset: 11.6, from: -110, to: 120, speed: 1.35, dir: 1 },
  { kind: 'line', axis: 'x', offset: 57.5, from: -60, to: 130, speed: 1.4, dir: 1 },
  { kind: 'line', axis: 'x', offset: 32.5, from: 20, to: 120, speed: 1.5, dir: -1 },
  { kind: 'circle', cx: -27, cz: 6, r: 9.4, speed: 0.32, dir: 1 },
  { kind: 'circle', cx: -27, cz: 6, r: 11.2, speed: 0.26, dir: -1 },
  { kind: 'line', axis: 'z', offset: -82.2, from: -100, to: 130, speed: 1.3, dir: 1 },
  { kind: 'line', axis: 'x', offset: 62, from: -100, to: 100, speed: 1.2, dir: -1 },
]

export const galleryInterior = {
  width: 26,
  depth: 16,
  height: 6.4,
  start: [0, 2.8] as [number, number],
}

export const cafeInterior = {
  width: 16,
  depth: 11,
  height: 4.4,
  start: [0, 1.5] as [number, number],
}

export const roomInterior = {
  // 个人空间不再是统一的“小盒子”：城区里可进入的建筑普遍更宽，
  // 室内至少保持与常见建筑 footprint 接近的比例。
  width: 24,
  depth: 20,
  height: 4.5,
  // 出生在门口内侧的空地上，避开各空间的家具布局。
  start: [0, 6.8] as [number, number],
}

export const buildingById = Object.fromEntries(buildings.map((b) => [b.id, b]))
