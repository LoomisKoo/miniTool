// 城市初始内容。前后端共用的地点 / 空间 id 必须与 src/data/city.ts 保持一致。

const now = Date.now()
const ago = (hours) => new Date(now - hours * 3600_000).toISOString()

// 默认不写入任何示例留言、NPC 账号或访问记录。
// 城市里只有真实玩家的内容；需要演示数据时显式设置 SEED_DEMO=1。
export const DEMO_SEED = process.env.SEED_DEMO === '1'

export const npcUsers = DEMO_SEED
  ? [
      { id: 'npc-mira', name: 'Mira', color: '#c4774c', isNpc: true },
      { id: 'npc-aran', name: '阿岚', color: '#4f7f74', isNpc: true },
      { id: 'npc-archive', name: '城市档案员', color: '#7a6b98', isNpc: true },
      { id: 'npc-kai', name: 'Kai', color: '#a9853f', isNpc: true },
    ]
  : []

export const places = [
  {
    id: 'plaza-fountain',
    name: '镜池广场',
    subtitle: 'CITY SQUARE · 城市起点',
    description:
      '城市中心的浅水池把天空和楼影收在一起。长椅朝西，树影很慢。从这里可以看见美术馆、河岸公寓和远处的微光塔。',
    kind: 'plaza',
    x: -27,
    z: 6,
  },
  {
    id: 'gallery-lobby',
    name: '光盒美术馆 · 中庭',
    subtitle: 'LUMA GALLERY · 公共室内',
    description:
      '天光从高窗落下来，白色墙面和浅木地板让每次转身都有新的阴影。二层是正在被认领的展厅。',
    kind: 'indoor',
    x: -58,
    z: 8,
  },
  {
    id: 'echo-alley',
    name: '回声巷',
    subtitle: 'ECHO ALLEY · 步行小巷',
    description:
      '两栋楼之间的一条窄巷，串灯、涂鸦墙、旧长椅。晚上有人在这里弹琴，白天是抄近路的好地方。',
    kind: 'alley',
    x: 23,
    z: 6,
  },
  {
    id: 'corner-cafe',
    name: '街角咖啡',
    subtitle: 'CORNER CAFE · 公共室内',
    description:
      '面向主街的玻璃窗，午后的光落在吧台上。店主把熟客的画挂在墙上，也从不催人走。',
    kind: 'cafe',
    x: 26,
    z: 28,
  },
  {
    id: 'tower-view',
    name: '微光塔下',
    subtitle: 'LUMEN TOWER · 地标',
    description:
      '城市最高的塔楼从这里升起。仰头能看见玻璃幕墙把云和光切成一条一条，是辨认方向最好的地方。',
    kind: 'landmark',
    x: 42,
    z: 58,
  },
  {
    id: 'echo-arena',
    name: '回声剧场',
    subtitle: 'ECHO HALL · 东岸',
    description:
      '东岸大道尽头的黑色剧场，外墙只有一条荧光边线。演出散场后，台阶上会留下很多纸条。',
    kind: 'landmark',
    x: 108,
    z: -54,
  },
  {
    id: 'old-station',
    name: '旧车站',
    subtitle: 'CENTRAL STATION · 南横街',
    description:
      '停用多年的车站，站台雨棚还在。现在被改成了夜市和露天放映场，夜里灯会一直亮到很晚。',
    kind: 'walk',
    x: -56,
    z: 108,
  },
  {
    id: 'west-market',
    name: '西岸市场',
    subtitle: 'WEST MARKET · 西岸大道',
    description:
      '西岸的低层市场，摊位上挂着一排暖色灯。走到底是通往河堤的台阶，风很大。',
    kind: 'plaza',
    x: -118,
    z: 6,
  },
  {
    id: 'sky-bridge',
    name: '空中连廊',
    subtitle: 'SKY BRIDGE · 24F',
    description:
      '连接两栋塔楼的玻璃连廊，脚下是整条主街。夜间地面会亮起 AR 网格，像站在城市电路板上。',
    kind: 'landmark',
    x: 47,
    z: -16,
  },
  {
    id: 'cedar-walk',
    name: '雪松步道',
    subtitle: 'CEDAR WALK · 林荫步道',
    description:
      '河岸公寓前的林荫步道，连接广场与主街。石凳上常有人留下便签，住客会把快枯的花搬到这里晒太阳。',
    kind: 'walk',
    x: -26,
    z: -20,
  },
]

const item = (id, type, x, z, rot = 0, color = '#8a7a63') => ({ id, type, x, z, rot, color })

export const spaces = [
  {
    id: 'river-loft',
    name: '河岸小屋',
    description:
      '一扇朝北的窗，能看见微光塔的塔尖。适合一个人住，也适合把朋友叫来。现在还是城市的样板陈设。',
    building: '河岸公寓 · 07F',
    template: 'home',
    wallColor: '#e9e0d2',
    floorColor: '#c3ae95',
    art: { title: '北窗的光', palette: 'dawn' },
    layout: {
      items: [
        item('rl-rug', 'rug', 0, 0.4, 0, '#b7a58e'),
        item('rl-sofa', 'sofa', 0, -1.7, 0, '#6f7f74'),
        item('rl-table', 'table', 0, 0.7, 0, '#8a6a4b'),
        item('rl-shelf', 'shelf', -3.7, -2.7, 0, '#9a7d5d'),
        item('rl-plant', 'plant', 4.0, -2.9, 0, '#587a58'),
        item('rl-lamp', 'lamp', -4.3, 2.4, 0, '#c9a15c'),
        item('rl-bed', 'bed', 3.1, 2.5, -Math.PI / 2, '#8c9a92'),
      ],
    },
    ownerId: null,
    isOpen: true,
  },
  {
    id: 'light-gallery',
    name: '光箱展厅',
    description:
      '美术馆二层的白盒子空间，天光均匀。适合挂一组画，或把正在做的东西摊开给人看。',
    building: '光盒美术馆 · 2F',
    template: 'gallery',
    wallColor: '#f1ede5',
    floorColor: '#d7d0c4',
    art: { title: '低处的云', palette: 'coast' },
    layout: {
      items: [
        item('lg-rug', 'rug', 0, 0.2, 0, '#cfc7bb'),
        item('lg-ped1', 'pedestal', -2.6, -1.4, 0, '#ded8cc'),
        item('lg-ped2', 'pedestal', 2.4, -1.8, 0, '#ded8cc'),
        item('lg-bench', 'bench', 0, 2.4, 0, '#7c6a55'),
        item('lg-plant', 'plant', 4.3, -3.1, 0, '#597a57'),
      ],
    },
    ownerId: null,
    isOpen: true,
  },
  {
    id: 'sound-room',
    name: '静音工作室',
    description:
      '唱片店后面的小房间，墙上贴满吸音毡。低音不会漏到街上，适合听一张完整的专辑。',
    building: '声场唱片 · B1',
    template: 'music',
    wallColor: '#d9d5cc',
    floorColor: '#8f8a80',
    art: { title: '低频信号', palette: 'signal' },
    layout: {
      items: [
        item('sr-rug', 'rug', 0, 0.5, 0, '#6f746c'),
        item('sr-spk1', 'speaker', -3.5, -2.5, 0.22, '#3f4543'),
        item('sr-spk2', 'speaker', 3.5, -2.5, -0.22, '#3f4543'),
        item('sr-shelf', 'shelf', -4.5, 0.8, Math.PI / 2, '#6d5b47'),
        item('sr-desk', 'desk', 3.7, 0.9, -Math.PI / 2, '#7d6a52'),
        item('sr-chair', 'chair', 2.4, 1.2, 1.2, '#8e7d65'),
        item('sr-lamp', 'lamp', 4.4, 3.0, 0, '#c9a15c'),
        item('sr-plant', 'plant', -4.2, 3.1, 0, '#557456'),
      ],
    },
    ownerId: DEMO_SEED ? 'npc-mira' : null,
    isOpen: true,
  },
]

const demoPosts = [
  {
    id: 'seed-post-01',
    targetType: 'place',
    targetId: 'plaza-fountain',
    authorId: 'npc-mira',
    body: '今天的云很低，水池里像装了一整片天空。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(3),
  },
  {
    id: 'seed-post-02',
    targetType: 'place',
    targetId: 'plaza-fountain',
    authorId: 'npc-archive',
    body: '镜池广场建成于城市更新后的第三年。长椅朝西，傍晚坐在这里刚好。',
    mediaKind: 'image',
    mediaRef: 'dawn',
    createdAt: ago(7),
  },
  {
    id: 'seed-post-03',
    targetType: 'place',
    targetId: 'plaza-fountain',
    authorId: 'npc-aran',
    body: '认路方法：从广场出发，朝着最高的那栋楼走，就不会丢。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(13),
  },
  {
    id: 'seed-post-04',
    targetType: 'place',
    targetId: 'plaza-fountain',
    authorId: 'npc-kai',
    body: '有人把一本诗集落在东侧长椅上，我放在喷泉边的失物箱里了。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(20),
  },
  {
    id: 'seed-post-05',
    targetType: 'place',
    targetId: 'gallery-lobby',
    authorId: 'npc-archive',
    body: '当前常设展《低处的云》在二层。别错过楼梯转角那扇窄窗，下午三点的光会落在台阶上。',
    mediaKind: 'image',
    mediaRef: 'coast',
    createdAt: ago(4),
  },
  {
    id: 'seed-post-06',
    targetType: 'place',
    targetId: 'gallery-lobby',
    authorId: 'npc-mira',
    body: '来这里画画第三次了，天光真的很稳。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(9),
  },
  {
    id: 'seed-post-07',
    targetType: 'place',
    targetId: 'gallery-lobby',
    authorId: 'npc-aran',
    body: '前台可以借铅笔。记得还。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(12),
  },
  {
    id: 'seed-post-08',
    targetType: 'place',
    targetId: 'gallery-lobby',
    authorId: 'npc-archive',
    parentId: 'seed-post-07',
    body: '也可以借一张折叠凳，展厅角落有插座。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(11),
  },
  {
    id: 'seed-post-09',
    targetType: 'place',
    targetId: 'echo-alley',
    authorId: 'npc-kai',
    body: '巷子里的串灯是隔壁店主自己拉的。晚上七点开，雨天更像一条发光的河。',
    mediaKind: 'audio',
    mediaRef: 'rain',
    createdAt: ago(2),
  },
  {
    id: 'seed-post-10',
    targetType: 'place',
    targetId: 'echo-alley',
    authorId: 'npc-aran',
    body: '涂鸦墙右下角有一行小字：“慢一点也没关系”。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(8),
  },
  {
    id: 'seed-post-11',
    targetType: 'place',
    targetId: 'echo-alley',
    authorId: 'npc-mira',
    body: '推荐从咖啡店后门穿过来，会经过一整面爬山虎。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(15),
  },
  {
    id: 'seed-post-12',
    targetType: 'place',
    targetId: 'corner-cafe',
    authorId: 'npc-aran',
    body: '桂花拿铁只做到十月底。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(5),
  },
  {
    id: 'seed-post-13',
    targetType: 'place',
    targetId: 'corner-cafe',
    authorId: 'npc-kai',
    body: '靠窗第二个位置能看到美术馆的侧立面，下午四点最好看。',
    mediaKind: 'image',
    mediaRef: 'meadow',
    createdAt: ago(10),
  },
  {
    id: 'seed-post-14',
    targetType: 'place',
    targetId: 'tower-view',
    authorId: 'npc-archive',
    body: '微光塔共 42 层，顶层不开放。但它在地面上的影子每天都会移动，像一枚日晷。',
    mediaKind: 'image',
    mediaRef: 'signal',
    createdAt: ago(6),
  },
  {
    id: 'seed-post-15',
    targetType: 'place',
    targetId: 'cedar-walk',
    authorId: 'npc-mira',
    body: '雪松步道的长椅下面有人藏了一本留言簿。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(16),
  },
  {
    id: 'seed-post-16',
    targetType: 'place',
    targetId: 'cedar-walk',
    authorId: 'npc-aran',
    body: '河岸公寓的电梯需要住户带路，别问我怎么知道的。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(21),
  },
  {
    id: 'seed-post-17',
    targetType: 'space',
    targetId: 'sound-room',
    authorId: 'npc-mira',
    body: '这张唱片适合傍晚听。音量别超过 3 格。',
    mediaKind: 'audio',
    mediaRef: 'night',
    createdAt: ago(1),
  },
  {
    id: 'seed-post-18',
    targetType: 'space',
    targetId: 'sound-room',
    authorId: 'npc-kai',
    body: '空间很棒，低音真的不漏。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(14),
  },
  {
    id: 'seed-post-19',
    targetType: 'space',
    targetId: 'sound-room',
    authorId: 'npc-aran',
    body: '墙上的画换了三次，这次最好。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(19),
  },
  {
    id: 'seed-post-20',
    targetType: 'space',
    targetId: 'river-loft',
    authorId: 'npc-archive',
    body: '样板间由城市提供基础陈设。认领后可以重新布置，也可以随时放弃。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(22),
  },
  {
    id: 'seed-post-21',
    targetType: 'space',
    targetId: 'light-gallery',
    authorId: 'npc-archive',
    body: '展厅还空着，等你把第一件作品挂上来。',
    mediaKind: 'none',
    mediaRef: null,
    createdAt: ago(23),
  },
]

export const posts = DEMO_SEED ? demoPosts : []

const demoVisits = [
  { spaceId: 'sound-room', userId: 'npc-kai', createdAt: ago(4) },
  { spaceId: 'sound-room', userId: 'npc-aran', createdAt: ago(11) },
  { spaceId: 'sound-room', userId: 'npc-archive', createdAt: ago(26) },
  { spaceId: 'river-loft', userId: 'npc-mira', createdAt: ago(30) },
  { spaceId: 'light-gallery', userId: 'npc-archive', createdAt: ago(31) },
]

export const seededVisits = DEMO_SEED ? demoVisits : []

export const templates = ['home', 'gallery', 'music', 'collection', 'studio', 'shop']
export const artPalettes = ['dawn', 'coast', 'meadow', 'signal', 'night', 'clay']
export const mediaRefs = {
  image: ['dawn', 'coast', 'meadow', 'signal', 'night', 'clay'],
  audio: ['rain', 'night', 'street', 'hum'],
}
export const furnitureTypes = [
  'sofa',
  'table',
  'chair',
  'shelf',
  'plant',
  'lamp',
  'rug',
  'desk',
  'bench',
  'pedestal',
  'speaker',
  'bed',
  'stool',
  'counter',
]
