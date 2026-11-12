// 店铺目录。
//
// 之前程序化店面的问题不是"随机数不够"，而是随机只作用在文字和颜色上：
// 26 个店名 × 7 个光色 × 4 张内景，几何却始终是同一套。所以把"一家店长什么
// 样"整体抽成数据：业态决定橱窗里画什么、灯是什么色温，招牌样式决定门头做法，
// 门面做法决定是整面玻璃、敞开档口还是拉下的卷帘，props 决定门口摆什么。
//
// 这一版的重点：
// - 店名不再用"姓 + 业态"拼接（那读起来像编号），改成实际会出现的招牌名；
// - 业态铺到衣食住行的各个角落，40 种，同一条街上不会三步一家同款；
// - 招牌加了布幔、手绘、灯箱挂架几种，板子的厚度和挂法都不同。
//
// 这里只放数据。画图在 scene/shopArt.ts，搭几何在 scene/ShopFrontage.tsx。

/** 业态。决定橱窗内景的画法（见 shopArt.ts 的 ARCHETYPE_OF）和默认配色。 */
export type ShopKind =
  | 'konbini'
  | 'grocer'
  | 'noodle'
  | 'roast'
  | 'deli'
  | 'pharmacy'
  | 'barber'
  | 'salon'
  | 'fruit'
  | 'books'
  | 'stationery'
  | 'cafe'
  | 'milktea'
  | 'dessert'
  | 'florist'
  | 'hardware'
  | 'tea'
  | 'clothes'
  | 'tailor'
  | 'shoes'
  | 'sportswear'
  | 'phone'
  | 'jewelry'
  | 'watch'
  | 'bakery'
  | 'seafood'
  | 'laundry'
  | 'bar'
  | 'bbq'
  | 'hotpot'
  | 'sushi'
  | 'express'
  | 'eyewear'
  | 'toy'
  | 'pet'
  | 'photo'
  | 'print'
  | 'gym'
  | 'karaoke'
  | 'netcafe'

/** 门头做法。 */
export type SignStyle =
  /** 内透灯箱：整块发光的板，最常见 */
  | 'lightbox'
  /** 霓虹：暗底 + 发光字 + 灯管描边，夜里最跳 */
  | 'neon'
  /** 木匾：暖木底 + 阴刻字，白天比夜里好看 */
  | 'wood'
  /** 布幔：整幅垂下来的布，下摆有须边 */
  | 'cloth'
  /** LED 点阵：字是一颗颗灯珠拼的 */
  | 'led'
  /** 布篷招牌：雨棚本身就是招牌，字印在篷沿上 */
  | 'canopy'
  /** 手绘墙招：直接画在墙上，白底红字，最市井 */
  | 'painted'

/** 门面做法。 */
export type FrontStyle =
  /** 整面落地玻璃 */
  | 'glass'
  /** 敞开档口：只有台面，没有玻璃 */
  | 'counter'
  /** 卷帘半拉开 */
  | 'shutter'
  /** 半墙 + 矮窗：窗台高、货架露出上半截 */
  | 'half'

/** 门口道具。 */
export type PropKind =
  | 'aboard'
  | 'menu'
  | 'crates'
  | 'planter'
  | 'bench'
  | 'umbrella'
  | 'lantern'
  | 'barrel'
  | 'bike'
  | 'qrcode'

export type ShopCatalogEntry = {
  id: string
  /** 招牌上的字 */
  name: string
  /** 招牌右下角的小字 */
  tag: string
  kind: ShopKind
  sign: SignStyle
  /** 招牌底色 */
  panel: string
  /** 字色 */
  ink: string
  /** 灯带 / 洗墙 / 竖招的光色 */
  glow: string
  /** 雨棚色；null = 不装雨棚 */
  awning: string | null
  front: FrontStyle
  /** 是否有伸出去的竖招 */
  blade: boolean
  props: PropKind[]
  /** 店内灯色：橱窗里那片光是暖是冷 */
  light: string
}

const C = (e: ShopCatalogEntry) => e

/** 40 家店，衣食住行铺满。相邻开间靠发牌错开，不会撞名。 */
export const SHOP_CATALOG: ShopCatalogEntry[] = [
  C({
    id: 'konbini-24',
    name: '廿四刻',
    tag: '24H MART',
    kind: 'konbini',
    sign: 'lightbox',
    panel: '#2b241d',
    ink: '#f4fbff',
    glow: '#ffe8c8',
    awning: '#2f6d86',
    front: 'glass',
    blade: true,
    props: ['lantern', 'qrcode'],
    light: '#eaf6ff',
  }),
  C({
    id: 'noodle-yiwan',
    name: '一碗',
    tag: 'NOODLE',
    kind: 'noodle',
    sign: 'cloth',
    panel: '#7a2f24',
    ink: '#ffe6c0',
    glow: '#ff8a4a',
    awning: '#8f3f2c',
    front: 'glass',
    blade: false,
    props: ['menu', 'aboard', 'bench'],
    light: '#ffd2a0',
  }),
  C({
    id: 'pharmacy-anxin',
    name: '安心药房',
    tag: 'PHARMACY',
    kind: 'pharmacy',
    sign: 'lightbox',
    panel: '#16513f',
    ink: '#eafff6',
    glow: '#7dffc4',
    awning: '#2c6b56',
    front: 'glass',
    blade: true,
    props: ['aboard'],
    light: '#d9ffe9',
  }),
  C({
    id: 'barber-titou',
    name: '剃头铺',
    tag: 'BARBER',
    kind: 'barber',
    sign: 'neon',
    panel: '#141a22',
    ink: '#ff6f8f',
    glow: '#ff8fa8',
    awning: null,
    front: 'glass',
    blade: true,
    props: ['bench'],
    light: '#ffd9e0',
  }),
  C({
    id: 'fruit-guoran',
    name: '果然',
    tag: 'FRUIT',
    kind: 'fruit',
    sign: 'wood',
    panel: '#5a3a24',
    ink: '#ffe8bd',
    glow: '#ffbd6a',
    awning: null,
    front: 'counter',
    blade: false,
    props: ['crates', 'barrel'],
    light: '#ffe0b0',
  }),
  C({
    id: 'books-zhijian',
    name: '纸间',
    tag: 'BOOKS',
    kind: 'books',
    sign: 'wood',
    panel: '#3c2a20',
    ink: '#f6e6c8',
    glow: '#ffcf8a',
    awning: '#57496b',
    front: 'glass',
    blade: false,
    props: ['aboard'],
    light: '#ffe7c2',
  }),
  C({
    id: 'cafe-kongbei',
    name: '空杯',
    tag: 'COFFEE',
    kind: 'cafe',
    sign: 'neon',
    panel: '#191b1e',
    ink: '#ffd9a0',
    glow: '#ffb066',
    awning: '#3d5a50',
    front: 'glass',
    blade: true,
    props: ['bench', 'planter'],
    light: '#ffcf94',
  }),
  C({
    id: 'roast-shaowei',
    name: '烧味记',
    tag: 'ROAST',
    kind: 'roast',
    sign: 'lightbox',
    panel: '#7c2418',
    ink: '#fff1cd',
    glow: '#ff9b58',
    awning: '#8a3a28',
    front: 'counter',
    blade: true,
    props: ['menu'],
    light: '#ffc98a',
  }),
  C({
    id: 'florist-yizhi',
    name: '一枝',
    tag: 'FLOWERS',
    kind: 'florist',
    sign: 'cloth',
    panel: '#e9e3d2',
    ink: '#3f5a3c',
    glow: '#b6e08a',
    awning: null,
    front: 'glass',
    blade: false,
    props: ['planter', 'crates'],
    light: '#e6ffd6',
  }),
  C({
    id: 'hardware-wanshi',
    name: '万事五金',
    tag: 'HARDWARE',
    kind: 'hardware',
    sign: 'painted',
    panel: '#e8dfc8',
    ink: '#7a2f24',
    glow: '#e8d27a',
    awning: '#6b5334',
    front: 'counter',
    blade: false,
    props: ['crates', 'barrel'],
    light: '#f2efd0',
  }),
  C({
    id: 'tea-banzhan',
    name: '半盏',
    tag: 'TEA',
    kind: 'tea',
    sign: 'wood',
    panel: '#2f3a30',
    ink: '#efe7d0',
    glow: '#cfe0b0',
    awning: null,
    front: 'glass',
    blade: false,
    props: ['bench', 'planter'],
    light: '#f4ecd8',
  }),
  C({
    id: 'clothes-sucai',
    name: '素裁',
    tag: 'CLOTHES',
    kind: 'clothes',
    sign: 'lightbox',
    panel: '#2b2f38',
    ink: '#f4f6ff',
    glow: '#ffe6c4',
    awning: '#57496b',
    front: 'glass',
    blade: true,
    props: ['aboard'],
    light: '#f6f8ff',
  }),
  C({
    id: 'phone-geek',
    name: '极客站',
    tag: 'DIGITAL',
    kind: 'phone',
    sign: 'led',
    panel: '#101820',
    ink: '#ffe6c8',
    glow: '#ffb86b',
    awning: '#2f4356',
    front: 'glass',
    blade: true,
    props: ['qrcode'],
    light: '#d8f4ff',
  }),
  C({
    id: 'bakery-maixiang',
    name: '麦香',
    tag: 'BAKERY',
    kind: 'bakery',
    sign: 'canopy',
    panel: '#8f6a3f',
    ink: '#fff4dc',
    glow: '#ffc274',
    awning: '#c4713f',
    front: 'glass',
    blade: false,
    props: ['aboard'],
    light: '#ffe3bb',
  }),
  C({
    id: 'seafood-chaoxi',
    name: '潮汐海产',
    tag: 'SEAFOOD',
    kind: 'seafood',
    sign: 'lightbox',
    panel: '#26201a',
    ink: '#e8fbff',
    glow: '#ffc07a',
    awning: '#2f4356',
    front: 'counter',
    blade: false,
    props: ['crates'],
    light: '#d7f6ff',
  }),
  C({
    id: 'laundry-jiewu',
    name: '洁屋',
    tag: 'LAUNDRY',
    kind: 'laundry',
    sign: 'lightbox',
    panel: '#2b241d',
    ink: '#eaf3ff',
    glow: '#ffd9a6',
    awning: null,
    front: 'glass',
    blade: false,
    props: ['aboard'],
    light: '#e6f0ff',
  }),
  C({
    id: 'bar-wanfeng',
    name: '晚风',
    tag: 'BAR',
    kind: 'bar',
    sign: 'neon',
    panel: '#120e14',
    ink: '#ff7ab0',
    glow: '#ff4f8a',
    awning: null,
    front: 'glass',
    blade: true,
    props: ['bench', 'lantern'],
    light: '#ff9ec4',
  }),
  C({
    id: 'dessert-tangshuang',
    name: '糖霜',
    tag: 'DESSERT',
    kind: 'dessert',
    sign: 'cloth',
    panel: '#f0e6dc',
    ink: '#6b3350',
    glow: '#ffb3cf',
    awning: null,
    front: 'counter',
    blade: false,
    props: ['menu'],
    light: '#ffe3ee',
  }),
  C({
    id: 'express-yizhan',
    name: '驿站',
    tag: 'EXPRESS',
    kind: 'express',
    sign: 'lightbox',
    panel: '#2a3b2a',
    ink: '#f2ffdc',
    glow: '#b6e86a',
    awning: null,
    front: 'shutter',
    blade: false,
    props: ['crates'],
    light: '#e9ffd0',
  }),
  C({
    id: 'eyewear-mingjing',
    name: '明镜',
    tag: 'OPTICAL',
    kind: 'eyewear',
    sign: 'led',
    panel: '#101820',
    ink: '#cfe6ff',
    glow: '#ffd2a0',
    awning: '#2f4356',
    front: 'glass',
    blade: true,
    props: ['aboard'],
    light: '#e6f4ff',
  }),
  C({
    id: 'milktea-chashan',
    name: '茶山',
    tag: 'MILK TEA',
    kind: 'milktea',
    sign: 'canopy',
    panel: '#4a6b4a',
    ink: '#f4ffe8',
    glow: '#a8e86a',
    awning: '#3f7a52',
    front: 'counter',
    blade: true,
    props: ['menu', 'qrcode'],
    light: '#eaffd8',
  }),
  C({
    id: 'milktea-xiaoman',
    name: '小满茶饮',
    tag: 'TEA BAR',
    kind: 'milktea',
    sign: 'lightbox',
    panel: '#f0e6d8',
    ink: '#5a4030',
    glow: '#ffd9a0',
    awning: null,
    front: 'counter',
    blade: false,
    props: ['menu'],
    light: '#fff0d8',
  }),
  C({
    id: 'bbq-tanhuo',
    name: '炭火',
    tag: 'BBQ',
    kind: 'bbq',
    sign: 'neon',
    panel: '#171317',
    ink: '#ffcf7a',
    glow: '#ff9d3d',
    awning: null,
    front: 'counter',
    blade: true,
    props: ['menu', 'lantern'],
    light: '#ffc178',
  }),
  C({
    id: 'hotpot-jiugong',
    name: '九宫格',
    tag: 'HOTPOT',
    kind: 'hotpot',
    sign: 'lightbox',
    panel: '#8a1f1a',
    ink: '#fff3d8',
    glow: '#ff6b4a',
    awning: '#7a2a22',
    front: 'glass',
    blade: true,
    props: ['menu', 'bench'],
    light: '#ffb88a',
  }),
  C({
    id: 'sushi-baguan',
    name: '八贯',
    tag: 'SUSHI',
    kind: 'sushi',
    sign: 'cloth',
    panel: '#2a2320',
    ink: '#eef6ff',
    glow: '#ffe0b8',
    awning: null,
    front: 'counter',
    blade: false,
    props: ['menu'],
    light: '#e8f4ff',
  }),
  C({
    id: 'grocer-baiwu',
    name: '百物',
    tag: 'GROCERY',
    kind: 'grocer',
    sign: 'painted',
    panel: '#efe7d2',
    ink: '#2f5a2a',
    glow: '#c6f06a',
    awning: '#3d6b34',
    front: 'counter',
    blade: false,
    props: ['crates', 'umbrella'],
    light: '#f0ffd8',
  }),
  C({
    id: 'deli-lushui',
    name: '卤水铺',
    tag: 'DELI',
    kind: 'deli',
    sign: 'lightbox',
    panel: '#5a2a1e',
    ink: '#ffe8c4',
    glow: '#ff9a5a',
    awning: '#6b3a28',
    front: 'counter',
    blade: false,
    props: ['menu', 'crates'],
    light: '#ffce94',
  }),
  C({
    id: 'stationery-zhibi',
    name: '纸笔',
    tag: 'STATIONERY',
    kind: 'stationery',
    sign: 'lightbox',
    panel: '#332820',
    ink: '#f2f6ff',
    glow: '#ffd6a4',
    awning: null,
    front: 'glass',
    blade: false,
    props: ['aboard'],
    light: '#eef2ff',
  }),
  C({
    id: 'toy-xiaohuomiao',
    name: '小火苗',
    tag: 'TOYS',
    kind: 'toy',
    sign: 'canopy',
    panel: '#c04a3a',
    ink: '#fff2d0',
    glow: '#ffb34a',
    awning: '#c04a3a',
    front: 'glass',
    blade: true,
    props: ['crates'],
    light: '#fff0d0',
  }),
  C({
    id: 'pet-maoqiu',
    name: '毛球',
    tag: 'PET',
    kind: 'pet',
    sign: 'lightbox',
    panel: '#3a5a4a',
    ink: '#f0fff6',
    glow: '#a8f0c8',
    awning: null,
    front: 'glass',
    blade: false,
    props: ['planter'],
    light: '#e8fff2',
  }),
  C({
    id: 'tailor-zhenjiao',
    name: '针脚',
    tag: 'TAILOR',
    kind: 'tailor',
    sign: 'cloth',
    panel: '#4a3f36',
    ink: '#f2e6d0',
    glow: '#e8c890',
    awning: null,
    front: 'half',
    blade: false,
    props: ['aboard'],
    light: '#fff0d8',
  }),
  C({
    id: 'shoes-zuxia',
    name: '足下',
    tag: 'SHOES',
    kind: 'shoes',
    sign: 'lightbox',
    panel: '#2b2f38',
    ink: '#f4f6ff',
    glow: '#ffe6c4',
    awning: null,
    front: 'glass',
    blade: true,
    props: ['aboard'],
    light: '#f4f6ff',
  }),
  C({
    id: 'sportswear-paodao',
    name: '跑道',
    tag: 'SPORTS',
    kind: 'sportswear',
    sign: 'led',
    panel: '#101820',
    ink: '#9dffb0',
    glow: '#5ce07a',
    awning: null,
    front: 'glass',
    blade: true,
    props: ['bike'],
    light: '#e4ffea',
  }),
  C({
    id: 'jewelry-jinyu',
    name: '金玉',
    tag: 'JEWELRY',
    kind: 'jewelry',
    sign: 'lightbox',
    panel: '#3a1e28',
    ink: '#ffe9c4',
    glow: '#ffd27a',
    awning: null,
    front: 'glass',
    blade: false,
    props: ['aboard'],
    light: '#fff0cc',
  }),
  C({
    id: 'watch-zoushi',
    name: '走时',
    tag: 'WATCH',
    kind: 'watch',
    sign: 'wood',
    panel: '#3a3028',
    ink: '#efe2c4',
    glow: '#e8d0a0',
    awning: null,
    front: 'half',
    blade: false,
    props: ['aboard'],
    light: '#f6ecd4',
  }),
  C({
    id: 'photo-liuying',
    name: '留影',
    tag: 'PHOTO',
    kind: 'photo',
    sign: 'painted',
    panel: '#e8e0d0',
    ink: '#2f4a6a',
    glow: '#ffe2bc',
    awning: null,
    front: 'glass',
    blade: false,
    props: ['aboard'],
    light: '#f0f4ff',
  }),
  C({
    id: 'print-tuoyin',
    name: '拓印',
    tag: 'PRINT',
    kind: 'print',
    sign: 'lightbox',
    panel: '#2f2a24',
    ink: '#eef4f0',
    glow: '#cfe0b0',
    awning: null,
    front: 'glass',
    blade: false,
    props: ['crates'],
    light: '#eaf6f2',
  }),
  C({
    id: 'gym-tieguan',
    name: '铁馆',
    tag: 'GYM',
    kind: 'gym',
    sign: 'led',
    panel: '#0e1216',
    ink: '#ff8a5a',
    glow: '#ff6a3a',
    awning: null,
    front: 'glass',
    blade: true,
    props: ['bike'],
    light: '#ffd0b8',
  }),
  C({
    id: 'karaoke-shenglang',
    name: '声浪',
    tag: 'KTV',
    kind: 'karaoke',
    sign: 'neon',
    panel: '#1a1412',
    ink: '#ffb08a',
    glow: '#ff7a6a',
    awning: null,
    front: 'glass',
    blade: true,
    props: ['lantern'],
    light: '#e0c8ff',
  }),
  C({
    id: 'netcafe-yejian',
    name: '夜间',
    tag: 'NET CAFE',
    kind: 'netcafe',
    sign: 'neon',
    panel: '#0e1418',
    ink: '#ffcf9c',
    glow: '#ff9e5a',
    awning: null,
    front: 'glass',
    blade: false,
    props: ['qrcode'],
    light: '#cfeaff',
  }),
  C({
    id: 'salon-songgu',
    name: '松骨',
    tag: 'MASSAGE',
    kind: 'salon',
    sign: 'cloth',
    panel: '#4a3a30',
    ink: '#ffe8c8',
    glow: '#ffb88a',
    awning: null,
    front: 'half',
    blade: false,
    props: ['lantern'],
    light: '#ffe0c4',
  }),
  C({
    id: 'books-jiushu',
    name: '旧书摊',
    tag: 'USED BOOKS',
    kind: 'books',
    sign: 'cloth',
    panel: '#4a3a2a',
    ink: '#ffeecd',
    glow: '#e8c07a',
    awning: null,
    front: 'counter',
    blade: false,
    props: ['crates', 'aboard'],
    light: '#ffe9c0',
  }),
  C({
    id: 'noodle-yeshi',
    name: '夜市面',
    tag: 'MIDNIGHT',
    kind: 'noodle',
    sign: 'neon',
    panel: '#171317',
    ink: '#ffcf7a',
    glow: '#ff9d3d',
    awning: null,
    front: 'counter',
    blade: true,
    props: ['menu', 'lantern'],
    light: '#ffc178',
  }),
  C({
    id: 'cafe-beichao',
    name: '焙炒所',
    tag: 'ROASTERY',
    kind: 'cafe',
    sign: 'wood',
    panel: '#3a2a1e',
    ink: '#f6e2c2',
    glow: '#ffb974',
    awning: '#6b4530',
    front: 'glass',
    blade: false,
    props: ['bench', 'planter'],
    light: '#ffcf9e',
  }),
]

/** 稳定哈希：同一家店每次刷新都是同一张脸。 */
export function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ---------------------------------------------------------------- 发牌
//
// 一条街有上百个开间，光靠哈希取模必然撞车（之前街上出现两家「半坡」就是
// 这么来的）。所以改成发牌：先打乱写好的目录，用完再按名字池现造，
// 整副牌里不允许同名的第二家。

const NAME_POOL = [
  '小满', '一叶', '见山', '拾光', '白露', '半糖', '云间', '木鱼', '米仓', '星野',
  '长乐', '阿婆', '老码头', '转角', '巷口', '月台', '青柚', '栗子', '槐序', '麦浪',
  '汀州', '炉边', '红砖', '木栈', '旧巷', '天井', '小院', '石阶', '南枝', '北岸',
  '春分', '谷雨', '秋分', '小雪', '暖冬', '晚照', '晨光', '远山', '静水', '闲庭',
]

const TRADE_WORD: Record<ShopKind, string> = {
  konbini: '便利',
  grocer: '杂货',
  noodle: '面馆',
  roast: '烧味',
  deli: '卤味',
  pharmacy: '药房',
  barber: '理发',
  salon: '养生',
  fruit: '水果',
  books: '书店',
  stationery: '文具',
  cafe: '咖啡',
  milktea: '茶饮',
  dessert: '甜品',
  florist: '花店',
  hardware: '五金',
  tea: '茶馆',
  clothes: '成衣',
  tailor: '裁缝',
  shoes: '鞋店',
  sportswear: '运动',
  phone: '数码',
  jewelry: '金铺',
  watch: '钟表',
  bakery: '面包',
  seafood: '海产',
  laundry: '洗衣',
  bar: '酒馆',
  bbq: '烧烤',
  hotpot: '火锅',
  sushi: '寿司',
  express: '快递',
  eyewear: '眼镜',
  toy: '玩具',
  pet: '宠物',
  photo: '照相',
  print: '印刷',
  gym: '健身',
  karaoke: '歌房',
  netcafe: '网吧',
}

const TRADE_TAG: Record<ShopKind, string> = {
  konbini: 'MART',
  grocer: 'GROCERY',
  noodle: 'NOODLE',
  roast: 'ROAST',
  deli: 'DELI',
  pharmacy: 'PHARMACY',
  barber: 'BARBER',
  salon: 'SPA',
  fruit: 'FRUIT',
  books: 'BOOKS',
  stationery: 'STATIONERY',
  cafe: 'COFFEE',
  milktea: 'MILK TEA',
  dessert: 'DESSERT',
  florist: 'FLOWERS',
  hardware: 'HARDWARE',
  tea: 'TEA',
  clothes: 'CLOTHES',
  tailor: 'TAILOR',
  shoes: 'SHOES',
  sportswear: 'SPORTS',
  phone: 'DIGITAL',
  jewelry: 'JEWELRY',
  watch: 'WATCH',
  bakery: 'BAKERY',
  seafood: 'SEAFOOD',
  laundry: 'LAUNDRY',
  bar: 'BAR',
  bbq: 'BBQ',
  hotpot: 'HOTPOT',
  sushi: 'SUSHI',
  express: 'EXPRESS',
  eyewear: 'OPTICAL',
  toy: 'TOYS',
  pet: 'PET',
  photo: 'PHOTO',
  print: 'PRINT',
  gym: 'GYM',
  karaoke: 'KTV',
  netcafe: 'NET CAFE',
}

const SIGNS: SignStyle[] = ['lightbox', 'neon', 'wood', 'cloth', 'led', 'canopy', 'painted']
const FRONTS: FrontStyle[] = ['glass', 'glass', 'counter', 'half', 'shutter']
const PROP_POOL: PropKind[] = ['aboard', 'menu', 'crates', 'planter', 'bench', 'umbrella', 'lantern', 'barrel', 'bike', 'qrcode']

function shuffle<T>(list: T[], rnd: () => number) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 同业态的现成店：配色、灯色、雨棚照抄，只换名字和门头细节。 */
const BY_KIND = (() => {
  const map = new Map<ShopKind, ShopCatalogEntry[]>()
  for (const s of SHOP_CATALOG) {
    const list = map.get(s.kind) ?? []
    list.push(s)
    map.set(s.kind, list)
  }
  return map
})()

/**
 * 发一副牌：返回 count 家互不重名的店。
 *
 * 前 min(count, 目录长度) 家用写好的，后面的用名字池 + 业态现造。
 * 同一个种子永远得到同一副牌，所以街道每次加载都长一样。
 */
export function makeShopDeck(count: number, seed: string): ShopCatalogEntry[] {
  const rnd = (() => {
    let s = hashString(seed) || 1
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }
  })()

  const authored = shuffle(SHOP_CATALOG, rnd)
  const out: ShopCatalogEntry[] = []
  const used = new Set<string>()
  for (const s of authored) {
    if (out.length >= count) break
    out.push(s)
    used.add(s.name)
  }

  const kinds = Object.keys(TRADE_WORD) as ShopKind[]
  let guard = 0
  while (out.length < count && guard++ < 900) {
    const kind = kinds[(out.length * 7 + guard) % kinds.length]
    const pool = BY_KIND.get(kind)
    if (!pool) continue
    const tpl = pool[Math.floor(rnd() * pool.length)]
    const base = NAME_POOL[Math.floor(rnd() * NAME_POOL.length)]
    const name = `${base}${TRADE_WORD[kind]}`
    if (used.has(name)) continue
    used.add(name)
    out.push({
      ...tpl,
      id: `gen-${kind}-${out.length}`,
      name,
      tag: TRADE_TAG[kind],
      sign: SIGNS[Math.floor(rnd() * SIGNS.length)],
      front: FRONTS[Math.floor(rnd() * FRONTS.length)],
      blade: rnd() > 0.45,
      props: [PROP_POOL[Math.floor(rnd() * PROP_POOL.length)], PROP_POOL[Math.floor(rnd() * PROP_POOL.length)]].filter(
        (p, i, arr) => arr.indexOf(p) === i,
      ),
    })
  }

  while (out.length < count) out.push(SHOP_CATALOG[out.length % SHOP_CATALOG.length])
  return out
}
