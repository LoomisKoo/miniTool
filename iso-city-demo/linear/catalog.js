/**
 * 可追加的类型目录。生成器只读这份数据：新类型加一条即可，不必改路网。
 * 层级：street 沿街日常店；district 片区设施；city 市级设施；cluster 专业集聚和氛围区。
 */
import { SHOP_TYPES } from './signs.js'

export { SHOP_TYPES }

export const FACILITIES = [
  { id: 'market', zh: '超市', tier: 'district' },
  { id: 'farmers', zh: '农贸市场', tier: 'district' },
  { id: 'school', zh: '中小学', tier: 'district' },
  { id: 'kindergarten', zh: '幼儿园', tier: 'district', later: true },
  { id: 'gym', zh: '社区健身', tier: 'district' },
  { id: 'post', zh: '邮局', tier: 'district' },
  { id: 'police', zh: '派出所', tier: 'district' },
  { id: 'fire', zh: '消防', tier: 'district' },
  { id: 'hotel', zh: '酒店', tier: 'district' },
  { id: 'cinema', zh: '电影院', tier: 'district' },
  { id: 'park', zh: '社区公园', tier: 'district' },
  { id: 'hospital', zh: '综合医院', tier: 'city' },
  { id: 'university', zh: '大学', tier: 'city', later: true },
  { id: 'stadium', zh: '体育场', tier: 'city' },
  { id: 'arena', zh: '演艺中心', tier: 'city' },
  { id: 'library', zh: '图书馆', tier: 'city' },
  { id: 'museum', zh: '博物馆', tier: 'city' },
  { id: 'gov', zh: '政府', tier: 'city' },
  { id: 'busterm', zh: '公交总站', tier: 'city' },
  { id: 'science', zh: '科学馆', tier: 'city', later: true },
]

/**
 * t33 有辨识度的公共建筑：不改路网，不触发设施重分配，只落在已有地块的剩余地（设施/商场四周的街坊带）里。
 * host = 宿主地块（kind + 大致中心，取最近的一块）；size = [临街面宽, 进深]（含门前广场）；v = 造型变体。
 * 生成器在 buildings.js 的 fillRing 里按这份表取位，造型在 civic.js。
 */
export const CIVIC = [
  { id: 'opera', zh: '歌剧院（帆壳屋顶）', tier: 'city', size: [170, 130], host: { kind: 'cinema', x: 607, z: -835 } },
  { id: 'expo', zh: '会展中心', tier: 'city', size: [230, 150], host: { kind: 'mall', x: 613, z: -1878 } },
  // t37：原来商场环带里的小游乐场并入东南角的整块主题乐园（themepark），这里不再单独放
  { id: 'art', zh: '当代美术馆（悬挑白盒）', tier: 'city', size: [110, 90], host: { kind: 'museum', x: 1751, z: -835 } },
  { id: 'tvtower', zh: '电视塔', tier: 'city', size: [80, 80], host: { kind: 'gym', x: -1228, z: 463 } },
  { id: 'tvtower', zh: '电视塔（飞碟顶）', tier: 'city', size: [80, 80], v: 1, host: { kind: 'police', x: 1138, z: 1433 } },
  { id: 'postflag', zh: '邮政大楼（钟楼 + 拱廊）', tier: 'city', size: [110, 70], host: { kind: 'mall', x: -1228, z: 966 } },
  { id: 'rail', zh: '火车站', tier: 'city', size: [220, 110], host: { kind: 'mall', x: -1783, z: 963 } },
  { id: 'skyrail', zh: '高架轻轨站', tier: 'city', size: [130, 60], host: { kind: 'fire', x: -649, z: -426 } },
  { id: 'swim', zh: '游泳馆', tier: 'city', size: [120, 90], host: { kind: 'sports', x: 1138, z: -835 } },
  { id: 'ice', zh: '溜冰馆', tier: 'city', size: [110, 85], host: { kind: 'sports', x: -1228, z: -426 } },
  { id: 'mosque', zh: '清真寺', tier: 'city', size: [90, 90], host: { kind: 'cinema', x: -1783, z: -835 } },
  { id: 'orthodox', zh: '东正教堂', tier: 'city', size: [70, 70], host: { kind: 'cinema', x: -1783, z: -835 } },
  { id: 'synagogue', zh: '犹太会堂', tier: 'city', size: [60, 50], host: { kind: 'mall', x: -1222, z: -1299 } },
  { id: 'hindu', zh: '印度教神庙', tier: 'city', size: [70, 70], host: { kind: 'mall', x: -1222, z: -1299 } },
  { id: 'pagoda', zh: '七级佛塔', tier: 'city', size: [70, 70], host: { kind: 'arena', x: -1228, z: 2254 } },
  { id: 'confucius', zh: '孔庙', tier: 'city', size: [130, 100], host: { kind: 'library', x: -649, z: 2254 } },
  { id: 'civicplaza', zh: '城市广场（方尖碑 + 倒影池）', tier: 'city', size: [160, 130], host: { kind: 'mall', x: -655, z: -1299 } },
  { id: 'parkresort', zh: '云岬乐园度假区（主题酒店 + 入口小镇 + 停车场 + 跨干道步行桥）', tier: 'city', block: { x: 1133, z: -1878 }, kinds: ['mall'] },
  { id: 'airport', zh: '机场航站楼（城边，紧凑机坪 + 短跑道）', tier: 'city', block: { x: 2284, z: -1878 } },
  // t37 大型原创主题乐园：城东南角整块（约 617m × 651m，四面都是原有干道 / 街道，不压路），机场隔一条干道
  // t40 扩大：南北各并一块（吞掉中间两段支路，登记为 closed），约 617m × 1392m；干道对面原商场改成乐园度假区（酒店 + 入口小镇 + 停车 + 跨干道步行桥 / 单轨）
  { id: 'themepark', zh: '云岬乐园（主题乐园：灯塔泻湖 + 八大园区 + 巡游大道）', tier: 'city', block: { x: 1751, z: -1881 }, grow: { z0: -2470, z1: -1060 },
    lands: ['糖果镇', '星港', '雨林秘境', '赤岩峡谷', '极地冰原', '蒸汽工坊', '童话花园', '浪花湾'], landmark: '云岬灯塔', rides: ['赤岩过山车', '大摩天轮', '跳楼塔', '飞碟转盘', '原木漂流', '旋转木马', '咖啡杯', '飞椅', '单轨'], shows: ['湖畔露天剧场', '云岬大剧院', '糖果工厂', '星际机库', '雨林神殿', '矿车隧道'] },
]

/** t33 别墅区：城边 / 大公园旁的 4 片（不进 CBD |x|<1100,|z|<700、不进超高簇、不上河岸） */
export const VILLA_AREAS = [
  { zh: '东北', x: 1138, z: 1830 }, { zh: '东北', x: 1751, z: 1830 },
  { zh: '西南·公园旁', x: -1783, z: -2344 },
  { zh: '西北', x: -1783, z: 1830 },
  // t40：原「东南」别墅片并入主题乐园
]

export const CLUSTERS = [
  { id: 'walk', zh: '步行街', kind: 'mood' },
  { id: 'bar', zh: '酒吧街', kind: 'mood' },
  { id: 'anime', zh: '动漫潮玩', kind: 'mood' },
  { id: 'old', zh: '老城', kind: 'mood' },
  { id: 'media', zh: '媒体十字', kind: 'mood' },
  { id: 'mural', zh: '涂鸦巷', kind: 'mood' },
  { id: 'cbd', zh: '中央商务区', kind: 'mood' },
  { id: 'electronics', zh: '电子数码城', kind: 'trade' },
  { id: 'food', zh: '美食街或滨水夜市', kind: 'trade' },
  { id: 'flowers', zh: '花卉园艺市场', kind: 'trade' },
  { id: 'home', zh: '家居建材城', kind: 'trade' },
  { id: 'auto', zh: '汽车销售大道', kind: 'trade' },
  { id: 'wholesale', zh: '农副产品批发', kind: 'trade' },
  { id: 'fashion', zh: '服饰时装街', kind: 'trade' },
  { id: 'wedding', zh: '婚纱摄影街', kind: 'trade' },
  { id: 'culture', zh: '文化街', kind: 'trade' },
  { id: 'sportshop', zh: '体育户外用品', kind: 'trade' },
]

export const CATALOG = { shops: SHOP_TYPES, facilities: FACILITIES, clusters: CLUSTERS, civic: CIVIC, villas: VILLA_AREAS }
