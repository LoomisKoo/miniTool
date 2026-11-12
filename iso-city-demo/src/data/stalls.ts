// 街边小摊。
//
// 规则来自 docs/05-housing.md 第 6.2 / 6.3 节：
// - 只在四个指定区域摆：中央广场市集、雪松巷夜市、中巷创意街、河岸步道；
// - 每个区固定保留几个 NPC 摊（体验点），空位由玩家的摊位补上；
// - 主干道和住宅楼下不摆。
//
// 摊位坐标不是手写的一长串常量，而是按区域规则生成再过滤：
// 落在楼里、河里、喷泉里、摩天轮基座里的位置直接丢掉。这样以后挪一栋楼，
// 摊位不会留在原地悬着。

import { alley, benches, cedarLane, ferrisWheel, insideRoad, lamps, planters, plazaFountain, river, riverwalk, trees } from './city'
import { shopDoor, shops } from './shops'
import { insideBuilding } from './infill'
import { seeded } from '../scene/theme'

export type StallZone =
  /**
   * 中央广场不设摊位。广场是城市原点、视野最开阔的一块，摆一圈棚子就变成
   * "摊位环岛"，人来人往也要绕路。想买东西往巷子、码头、东西两岸走。
   */
  /** 雪松巷夜市：巷子西段，烤串和算命。 */
  | 'cedar'
  /** 中巷创意街：靠西墙一排，手作和纸品。 */
  | 'alley'
  /** 河岸东步道：桥东滨水，热饮和钓具。 */
  | 'riverwalk'
  /** 码头早市：桥西码头边，鱼获和花。 */
  | 'dock'
  /** 西岸市场：西岸大道人行道，蔬果和干货。 */
  | 'west'
  /** 东岸街市：东岸大道西侧的小广场，旧书和黑胶。 */
  | 'east'

export type StallVendor =
  | { kind: 'npc'; name: string; role: string; lines: string[] }
  | { kind: 'player'; name: string; since: string }

export type StallItem = { name: string; price: string; note: string }

export type Stall = {
  id: string
  zone: StallZone
  /** 世界坐标（摊位中心）。 */
  x: number
  z: number
  /** 摊位正面朝向：摊位本体在 -(facing) 方向，客人站在 facing 一侧。 */
  yaw: number
  vendor: StallVendor
  /** 摊名：写在招牌上，也是面板的标题。 */
  title: string
  category: string
  /** 棚布 / 伞面颜色。 */
  color: string
  /** 木料色，让每家的摊子不完全一样。 */
  wood: string
  items: StallItem[]
  note: string
}
export const ZONE_LABEL: Record<StallZone, string> = {
  cedar: '雪松巷夜市',
  alley: '中巷创意街',
  riverwalk: '河岸东步道',
  dock: '码头早市',
  west: '西岸市场',
  east: '东岸街市',
}

export const ZONE_BLURB: Record<StallZone, string> = {
  cedar: '天黑以后挂灯笼，烤串和算命都在这一条',
  alley: '靠西墙一排，手作、画作、独立出版',
  riverwalk: '桥东滨水，热饮和钓具，收摊晚',
  dock: '码头边，天没亮就开，卖鱼和花',
  west: '西岸大道人行道，蔬果、干货和糖水',
  east: '东岸小广场，旧书、黑胶和纸品',
}

const NPC_TITLES: Record<string, { title: string; category: string; color: string; items: StallItem[]; note: string }> = {
  烤串: {
    title: '老炭烤串',
    category: '小吃',
    color: '#8f3f2c',
    items: [
      { name: '羊肉串（5 串）', price: '20', note: '现烤，辣度可选' },
      { name: '烤玉米', price: '8', note: '刷蜂蜜' },
      { name: '冰镇酸梅汤', price: '6', note: '大杯' },
    ],
    note: '炭火从傍晚烧到收摊，烟会顺着巷子往上飘。',
  },
  算命: {
    title: '一签',
    category: '小游戏',
    color: '#5b4a72',
    items: [
      { name: '抽一签', price: '0', note: '签文随机，不收钱' },
      { name: '看手相', price: '20', note: '看得准不准另说' },
    ],
    note: '一张折叠桌、一盏灯、一筒竹签。老先生说他不算财运。',
  },
  套圈: {
    title: '套圈',
    category: '小游戏',
    color: '#3f6f5a',
    items: [
      { name: '五个圈', price: '10', note: '套中什么拿什么' },
      { name: '十个圈', price: '18', note: '送一次重来' },
    ],
    note: '后排的奖品摆得很远，老板笑得很开心。',
  },
  打气球: {
    title: '打气球',
    category: '小游戏',
    color: '#c05a3c',
    items: [
      { name: '十发飞镖', price: '15', note: '全中送一只玩偶' },
      { name: '五发', price: '8', note: '试试手感' },
    ],
    note: '气球板后面是软木板，扎破的声音很轻。',
  },
  拍立得: {
    title: '拍照亭',
    category: '工具',
    color: '#3f7f9a',
    items: [
      { name: '一张照片', price: '15', note: '现场打印，两分钟' },
      { name: '带框两张', price: '38', note: '木框是现成的' },
    ],
    note: '背景布是一块画着摩天轮的布，风大的时候会飘。',
  },
  宠物美容: {
    title: '毛球美容',
    category: '功能',
    color: '#a4627f',
    items: [
      { name: '洗护', price: '40', note: '小型宠物' },
      { name: '换饰品', price: '20', note: '围巾 / 铃铛' },
    ],
    note: '台面上铺着毛巾，旁边一桶泡泡水。',
  },
  钓具: {
    title: '河边钓具',
    category: '功能',
    color: '#41695f',
    items: [
      { name: '浮漂', price: '5 起', note: '按吃铅分几种' },
      { name: '鱼线（50m）', price: '18', note: '0.8 / 1.2 号' },
      { name: '打窝料', price: '10', note: '一袋够一下午' },
    ],
    note: '老板自己每天在码头钓，卖的都是他用得顺手的。',
  },
  热饮: {
    title: '一杯热的',
    category: '小吃',
    color: '#8a5c3a',
    items: [
      { name: '热可可', price: '12', note: '加棉花糖 +3' },
      { name: '姜茶', price: '10', note: '自己煮的' },
      { name: '烤红薯', price: '9', note: '铁桶里焖的' },
    ],
    note: '河风大，杯子外面套了一层瓦楞纸。',
  },
  糖水: {
    title: '阿婆糖水',
    category: '小吃',
    color: '#b06a42',
    items: [
      { name: '红豆沙', price: '8', note: '热的' },
      { name: '姜撞奶', price: '10', note: '现撞' },
      { name: '芝麻糊', price: '8', note: '自己磨的' },
    ],
    note: '两个保温桶，一个盖着棉布。',
  },
  手作: {
    title: '慢慢手作',
    category: '手作',
    color: '#6f7f4a',
    items: [
      { name: '手工皂', price: '25', note: '三种味道' },
      { name: '钩针小物', price: '30 起', note: '现场可以挑线' },
    ],
    note: '摊主一边看摊一边钩东西，很少抬头。',
  },
  画摊: {
    title: '画摊',
    category: '画作',
    color: '#4a5f8a',
    items: [
      { name: '小幅水彩', price: '80 起', note: '画的是这条街' },
      { name: '现场速写', price: '50', note: '十五分钟' },
    ],
    note: '画架立在摊边，颜料盒盖开着。',
  },
  独立出版: {
    title: '独立出版',
    category: '手作',
    color: '#5a5a5a',
    items: [
      { name: '小册子', price: '20 起', note: '作者自己印的' },
      { name: '明信片', price: '6', note: '一套六张' },
    ],
    note: '一箱书摊在折叠桌上，压着两块石头防风。',
  },
  鱼摊: {
    title: '晨间鱼摊',
    category: '鱼获',
    color: '#3f6f7f',
    items: [
      { name: '当日鲜鱼', price: '18/斤', note: '今早从河里收的' },
      { name: '小河虾', price: '25/份', note: '还活着的' },
      { name: '田螺', price: '12/份', note: '吐过沙' },
    ],
    note: '两个蓝色塑料盆，水一直开着细流。',
  },
  蔬果: {
    title: '当季菜摊',
    category: '蔬果',
    color: '#6f8f4f',
    items: [
      { name: '番茄', price: '6/斤', note: '带泥，没打蜡' },
      { name: '青菜', price: '4/把', note: '城西菜园送来的' },
      { name: '玉米', price: '3/根', note: '可以帮你剥' },
    ],
    note: '木箱叠三层，最上面一层摆得最好看。',
  },
  干货: {
    title: '南北干货',
    category: '干货',
    color: '#8a6a3a',
    items: [
      { name: '干香菇', price: '32/斤', note: '小朵的更香' },
      { name: '红枣', price: '18/斤', note: '可以尝一颗' },
      { name: '木耳', price: '26/斤', note: '泡开能发两倍' },
    ],
    note: '麻袋敞着口，木勺插在里面。',
  },
  旧书: {
    title: '旧书摊',
    category: '旧书',
    color: '#6a5a3f',
    items: [
      { name: '旧平装', price: '10 起', note: '三本八折' },
      { name: '旧杂志', price: '8', note: '八十年代的' },
      { name: '旧地图', price: '25', note: '1998 年的城图' },
    ],
    note: '书按颜色排，不按作者。摊主坐在马扎上听收音机。',
  },
  唱片: {
    title: '旧黑胶',
    category: '唱片',
    color: '#4a4048',
    items: [
      { name: '二手黑胶', price: '40 起', note: '都试过，不跳针' },
      { name: '试听', price: '0', note: '一副耳机，慢慢听' },
    ],
    note: '唱机摆在摊角，耳机线绕了两圈。',
  },
  花摊: {
    title: '一把花',
    category: '花',
    color: '#7f9a6a',
    items: [
      { name: '洋甘菊（一把）', price: '15', note: '开得正好' },
      { name: '散装花材', price: '5 起', note: '按枝挑' },
    ],
    note: '水桶直接放在地上，桶壁上还挂着水珠。',
  },
}

const PLAYER_STALLS: Array<{
  title: string
  category: string
  color: string
  vendor: { name: string; since: string }
  items: StallItem[]
  note: string
}> = [
  {
    title: '小满的杂货',
    category: '手作',
    color: '#7a6a52',
    vendor: { name: '小满', since: '3 个月前' },
    items: [
      { name: '手缝布包', price: '45', note: '两种花色' },
      { name: '旧明信片', price: '5', note: '都是真的旧' },
    ],
    note: '摊主白天在街角咖啡上班，傍晚才来。',
  },
  {
    title: '一颗柠檬',
    category: '小吃',
    color: '#b58a3a',
    vendor: { name: '阿汐', since: '上个月' },
    items: [
      { name: '手打柠檬茶', price: '14', note: '不加糖浆' },
      { name: '柠檬磅蛋糕', price: '12', note: '每天限做一盘' },
    ],
    note: '招牌是自己手写的，字有点像小学生。',
  },
  {
    title: '旧书三折',
    category: '书',
    color: '#5b6a5f',
    vendor: { name: '老周', since: '1 年前' },
    items: [
      { name: '旧平装书', price: '10 起', note: '三本八折' },
      { name: '旧地图', price: '25', note: '这张是 1998 年的' },
    ],
    note: '书是按颜色排的，不是按作者。',
  },
  {
    title: '铁皮玩具',
    category: '收藏',
    color: '#8a6a3a',
    vendor: { name: '图南', since: '半年前' },
    items: [
      { name: '发条青蛙', price: '60', note: '还能跳' },
      { name: '铁皮小车', price: '45 起', note: '有些掉漆' },
    ],
    note: '摊主说这些是他小时候的，卖一只少一只。',
  },
  {
    title: '一只猫的摊',
    category: '手作',
    color: '#7f6a8a',
    vendor: { name: '弥生', since: '两周前' },
    items: [
      { name: '手绘冰箱贴', price: '18', note: '画的是社区里的猫' },
      { name: '猫毛毡', price: '35', note: '不是真猫毛' },
    ],
    note: '摊主本人不在，牌子上写着"自助，钱放罐子里"。',
  },
  {
    title: '雨天的伞',
    category: '日用',
    color: '#41695f',
    vendor: { name: '阿礁', since: '4 个月前' },
    items: [
      { name: '二手长柄伞', price: '20', note: '修过，能撑' },
      { name: '伞骨修理', price: '10', note: '现场修' },
    ],
    note: '下雨天他就把摊推到河边，生意好很多。',
  },
]

const GOODS_COLORS = ['#c4713f', '#7f9a6a', '#b06a42', '#5b6a7f', '#a4627f', '#b58a3a']

/** 摊位正面宽度：雨棚宽 2.6m，柜台 2.2m。 */
export const STALL_W = 2.6
export const STALL_D = 1.5

type Slot = { zone: StallZone; x: number; z: number; yaw: number }

/**
 * 区牌位置：每个市集的入口立一块"这条街卖什么"的牌子。
 * 摆摊系统自己也读这张表——牌子在哪，哪一块就不许摆摊。
 */
export type ZoneAnchor = { zone: StallZone; x: number; z: number; yaw: number }

export const zoneAnchors: ZoneAnchor[] = [
  { zone: 'cedar', x: -32.6, z: -22, yaw: Math.PI / 2 },
  { zone: 'alley', x: 21, z: 9.5, yaw: 0 },
  { zone: 'riverwalk', x: 15.4, z: 64.4, yaw: -Math.PI / 2 },
  { zone: 'dock', x: -31.5, z: 65.0, yaw: Math.PI / 2 },
  { zone: 'west', x: -103.2, z: -22.5, yaw: Math.PI / 2 },
  { zone: 'east', x: 79.4, z: -4.6, yaw: Math.PI / 2 },
]

/**
 * 公告牌落点：`雪松步道` 这类"步行区"地点会在中心立一块留言牌。
 * 这些牌子不归摆摊系统管，所以摊位要主动让开——牌子正好立在雪松巷
 * 正中间，之前两排摊把它夹在中间，看着像摊子摆在了牌子底下。
 */
const BOARD_CLEAR: Array<[number, number, number]> = [[-26, -20, 7.5]]

/** 主干道是很宽的走廊（x ±11 一直延伸到河边），只判"离楼远"不够。 */
function onRoad(x: number, z: number, pad: number) {
  return insideRoad(x, z, pad)
}

/**
 * 点位能不能摆摊。
 *
 * 比起"别摆到楼里"，更重要的是**别摆到别人的门口和街上**：
 * - 车道（含退让）、楼体、水面、喷泉外圈、摩天轮基座；
 * - 行道树 / 路灯 / 长椅 / 花池；
 * - 沿街店铺门前 8m（不然摊子会堵在人家橱窗和门口）；
 * - 步行区公告牌和区牌周围。
 */
function walkable(x: number, z: number) {
  if (onRoad(x, z, 2.6)) return false
  if (insideBuilding(x, z, 2.0)) return false
  if (Math.abs(z - river.z) < river.d / 2 + 2.5) return false
  if (Math.hypot(x - plazaFountain.x, z - plazaFountain.z) < plazaFountain.r + 3.4) return false
  if (Math.hypot(x - ferrisWheel.x, z - ferrisWheel.z) < ferrisWheel.radius + 3.4) return false
  for (const [tx, tz] of trees) if (Math.hypot(tx - x, tz - z) < 3.2) return false
  for (const [lx, lz] of lamps) if (Math.hypot(lx - x, lz - z) < 2.4) return false
  for (const [bx, bz] of benches) if (Math.hypot(bx - x, bz - z) < 2.6) return false
  for (const [px, pz] of planters) if (Math.hypot(px - x, pz - z) < 2.4) return false
  for (const shop of shops) {
    const door = shopDoor(shop)
    if (Math.hypot(door.x - x, door.z - z) < 8) return false
  }
  for (const [bx, bz, r] of BOARD_CLEAR) if (Math.hypot(bx - x, bz - z) < r) return false
  for (const a of zoneAnchors) if (Math.hypot(a.x - x, a.z - z) < 4.2) return false
  return Math.abs(x) < 190 && Math.abs(z) < 190
}

/** 两个摊位之间至少留 5m：这一版刻意做疏，摊与摊之间有地方站人、有风穿过去。 */
const MIN_GAP = 5
function spaced(list: Slot[], x: number, z: number) {
  return list.every((s) => Math.hypot(s.x - x, s.z - z) > MIN_GAP)
}

/**
 * 摊位位置。
 *
 * 摊子不再全挤在中心：**七个市集分区**沿城市骨架铺开，每个分区只占一小段，
 * 摊子朝同一面、背靠人行道内侧，两头留出通道。
 *
 * | 分区 | 规划位置 |
 * |---|---|
 * | 雪松巷 | 巷子西段，公告牌以东让空 |
 * | 中巷 | 靠西墙一排（东墙是店铺橱窗） |
 * | 河岸东 | 桥东滨水步道 |
 * | 码头 | 桥西南岸码头边 |
 * | 西岸 | 西岸大道西侧人行道 |
 * | 东岸 | 东岸大道西侧小广场 |
 *
 * 中央广场一个摊都不摆：那是城市原点、视野最开阔的地方，摆一圈棚子就变成
 * "摊位环岛"。分区之间隔一两百米，玩家离开广场往外走，才会依次遇到
 * "巷子夜市 → 滨水早市 → 西岸菜市 → 东岸街市"。
 */
function slots(): Slot[] {
  const out: Slot[] = []
  const push = (zone: StallZone, x: number, z: number, yaw: number) => {
    if (!walkable(x, z) || !spaced(out, x, z)) return
    out.push({ zone, x, z, yaw })
  }

  // 雪松巷夜市：巷子西段两排、各两个位。公告牌在 x = -26，中间那段空着。
  for (const x of [-46.5, -41.3]) push('cedar', x, cedarLane.z - cedarLane.d / 2 + 2.1, 0)
  for (const x of [-48, -37.5]) push('cedar', x, cedarLane.z + cedarLane.d / 2 - 2.1, Math.PI)

  // 中巷创意街：只靠西墙（东墙是纸品的橱窗和门），三个位，北段留通道。
  for (const z of [-16, -7, 2]) push('alley', alley.x - alley.w / 2 + 1.8, z, Math.PI / 2)

  // 河岸东步道：桥东三个位，背靠街区面朝河。
  for (const x of [22, 34, 46, 58]) push('riverwalk', x, riverwalk.z - riverwalk.d / 2 + 1.9, 0)

  // 码头早市：桥西、摩天轮以东的码头边，两个位面朝河。
  // 这一小段被摩天轮和主街夹着，只放得下两个摊——早市本来就该是"几个篮子"。
  for (const x of [-27, -20.5]) push('dock', x, riverwalk.z - riverwalk.d / 2 + 1.9, 0)

  // 西岸市场：西岸大道西侧人行道，六个位一条街排开，面朝大道。
  for (let i = 0; i < 6; i++) push('west', -108.5, -18 + i * 7, Math.PI / 2)

  // 东岸街市：东岸大道西侧的小广场，四个位面朝大道。
  // 广场不再摆摊以后，两个小游戏（打气球、套圈）挪到这里——空地大、又不挡路。
  for (const x of [52, 60, 68, 76]) push('east', x, 0, Math.PI / 2)

  return out
}

const NPC_ORDER: Record<StallZone, string[]> = {
  // 夜市：烤串和算命一定有
  cedar: ['烤串', '算命', '热饮', '糖水'],
  // 中巷：手作和画摊
  alley: ['手作', '画摊', '独立出版'],
  // 河岸东：拍立得（背景是河）+ 钓具 + 热饮
  riverwalk: ['拍立得', '钓具', '热饮'],
  // 码头早市：鱼、花、热饮
  dock: ['鱼摊', '花摊'],
  // 西岸市场：菜市气质，蔬果干货为主
  west: ['蔬果', '干货', '鱼摊', '糖水', '花摊', '热饮'],
  // 东岸街市：两个小游戏 + 旧书 + 黑胶
  east: ['打气球', '套圈', '旧书', '唱片'],
}

/**
 * 每种 NPC 摊固定一个人：同一条街上不会出现两个"老炭"。
 * 同一个品类在不同区摆两摊时，用 byZone 换一个摊主——西岸卖菜的阿婆
 * 不是夜市卖糖水的那位。
 */
type Vendor = { name: string; byZone?: Partial<Record<StallZone, string>>; lines: (zone: StallZone) => string[] }

const NPC_OF: Record<string, Vendor> = {
  烤串: {
    name: '老炭',
    lines: (zone) =>
      zone === 'cedar'
        ? [
            '夜市这排灯一亮，生意就来了。',
            '羊肉是下午现串的，卖完就收，不隔夜。',
            '你要是怕辣就提前说，我这辣椒面下手重。',
          ]
        : ['白天在广场也摆，晚上回巷子里。', '火候全看炭，急不得。'],
  },
  算命: {
    name: '一签先生',
    lines: () => [
      '抽一签？不要钱。信不信是你的事。',
      '我不算财运，问了也不答。',
      '上一个人抽到"守"，第二天就把工作辞了。这不是我让他辞的。',
    ],
  },
  套圈: {
    name: '阿茂',
    lines: () => [
      '五个圈十块钱，套中什么拿什么。',
      '后排那个最大的？摆了三年没人套中过。',
      '你手劲小一点，圈是轻的。',
    ],
  },
  打气球: {
    name: '小许',
    lines: () => [
      '十发飞镖，全中送玩偶。',
      '气球是我早上吹的，别扎到手。',
      '昨天有个小孩中了九发，差一个。',
    ],
  },
  拍立得: {
    name: '阿光',
    lines: () => [
      '两分钟出片，背后就是河。',
      '光不够的时候我会开补光，别眨眼。',
      '照片你拿走，底片我也给你。',
    ],
  },
  糖水: {
    name: '阿婆',
    byZone: { west: '柳婆' },
    lines: () => ['热的，慢慢喝。', '姜撞奶要现撞才凝，等一分钟。', '这条巷子我摆了十几年了。'],
  },
  钓具: {
    name: '老韩',
    lines: () => [
      '浮漂按吃铅分，你先说要钓多深。',
      '这几天水凉，鱼口轻，线可以细一点。',
      '码头那边水草多，容易挂底。',
    ],
  },
  热饮: {
    name: '阿禾',
    byZone: { cedar: '阿陶', west: '阿栗' },
    lines: () => [
      '热水袋放在柜台下面，你自己拿。',
      '红薯是铁桶里焖的，挑裂口的更甜。',
      '收摊看天气，风大就早走。',
    ],
  },
  手作: {
    name: '慢慢',
    lines: () => ['手工皂有三种味道，都是冷制皂。', '钩针小物可以挑线，我现场给你钩。', '不着急，你慢慢看。'],
  },
  画摊: {
    name: '小柯',
    lines: () => [
      '画的都是这条街，从广场画到巷子口。',
      '速写十五分钟，你可以坐着。',
      '下雨天颜料干得慢，我就不出摊。',
    ],
  },
  独立出版: {
    name: '一页',
    byZone: { east: '纸鸢' },
    lines: () => ['这些小册子都是作者自己印的，卖完不补。', '明信片一套六张，背面有编号。', '你可以翻，别弄湿就行。'],
  },
  鱼摊: {
    name: '阿海',
    byZone: { west: '阿泉' },
    lines: () => [
      '鱼是四点半收的，你看这眼睛还亮着。',
      '河虾要趁活吃，回去别泡水。',
      '码头那边我下了网，六点前去收。',
    ],
  },
  蔬果: {
    name: '老井',
    lines: () => [
      '番茄带泥才耐放，别洗了再存。',
      '菜是城西菜园送来的，一天就这么多。',
      '挑菜别看个头，看蒂。',
    ],
  },
  干货: {
    name: '三婶',
    lines: () => [
      '香菇小朵的更香，炖汤别放多。',
      '红枣你尝一颗，不甜不要钱。',
      '这些东西放得住，慢慢吃。',
    ],
  },
  旧书: {
    name: '书伯',
    lines: () => [
      '书按颜色排的，你要按作者找我可找不到。',
      '这本是别人寄卖的，里面还有他的批注。',
      '下雨我就收摊，纸怕潮。',
    ],
  },
  唱片: {
    name: '阿旋',
    lines: () => [
      '这张我试过三遍，不跳针。',
      '耳机在那边，你自己放。',
      '黑胶要竖着放，平着压会翘。',
    ],
  },
  花摊: {
    name: '阿荞',
    byZone: { west: '阿栀' },
    lines: () => ['花是按枝挑的，一把十五。', '洋甘菊今天开得最好。', '拿回去斜剪一下，能多放两天。'],
  },
}

export const stalls: Stall[] = (() => {
  const list = slots()
  const used: Record<string, number> = {}
  return list.map((slot, index) => {
    const keys = NPC_ORDER[slot.zone]
    const k = used[slot.zone] ?? 0
    used[slot.zone] = k + 1
    const npcKey = k < keys.length ? keys[k] : null
    const rnd = seeded(`stall-${slot.zone}-${index}`)()
    const id = `stall-${slot.zone}-${index}`
    if (npcKey) {
      const recipe = NPC_TITLES[npcKey]
      const npc = NPC_OF[npcKey]
      return {
        id,
        zone: slot.zone,
        x: slot.x,
        z: slot.z,
        yaw: slot.yaw,
        title: recipe.title,
        category: recipe.category,
        color: recipe.color,
        wood: rnd > 0.5 ? '#8a6a4a' : '#7a5c40',
        items: recipe.items,
        note: recipe.note,
        vendor: {
          kind: 'npc' as const,
          name: npc?.byZone?.[slot.zone] ?? npc?.name ?? '摊主',
          role: `${recipe.title} · 摊主`,
          lines: npc?.lines(slot.zone) ?? ['随便看看。'],
        },
      }
    }
    const p = PLAYER_STALLS[index % PLAYER_STALLS.length]
    return {
      id,
      zone: slot.zone,
      x: slot.x,
      z: slot.z,
      yaw: slot.yaw,
      title: p.title,
      category: p.category,
      color: p.color,
      wood: rnd > 0.5 ? '#8a6a4a' : '#7a5c40',
      items: p.items,
      note: p.note,
      vendor: { kind: 'player' as const, name: p.vendor.name, since: p.vendor.since },
    }
  })
})()

export const stallById: Record<string, Stall> = Object.fromEntries(stalls.map((s) => [s.id, s]))

export function stallsIn(zone: StallZone) {
  return stalls.filter((s) => s.zone === zone)
}

/** 每区几个摊：面板和文档都要用。 */
export function stallCounts() {
  const out: Record<StallZone, number> = { cedar: 0, alley: 0, riverwalk: 0, dock: 0, west: 0, east: 0 }
  for (const s of stalls) out[s.zone] += 1
  return out
}

/** 摊位招牌的底色：同一个区偏同一色系，夜里一看看出是哪条街。 */
/** 每个区的招牌色：西岸偏土黄、码头偏海蓝，隔着一条街也能认出来。 */
const ZONE_SIGN: Record<StallZone, string> = {
  cedar: '#5b2f28',
  alley: '#2f3f46',
  riverwalk: '#2f4a46',
  dock: '#2f4358',
  west: '#5a4a30',
  east: '#43384a',
}

export function signColor(zone: StallZone) {
  return ZONE_SIGN[zone]
}

export { GOODS_COLORS }
