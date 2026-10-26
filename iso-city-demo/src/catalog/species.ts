// 物种与品种（图鉴、刷新、城里渲染共用）。
//
// 形象来自体素图纸 src/pets/voxel/designs.ts：每个物种一个模板，品种 = 换色 +
// 特征组合（折耳、短腿、卷尾、花纹……）。这里只补图鉴需要的元数据：名字、
// 出现权重、在城里的身高。新增品种只改 designs.ts。
//
// 稀有度不手写：图鉴上的星数直接由「每小时能在街上遇到几只」推出来
// （物种出现权重 × 品种权重 ÷ 总权重 × 每小时刷新池容量）。这样调权重、
// 加品种之后星数会自动跟着变，不会出现「一半动物都是一星」这种事。

import { VOXEL_DESIGNS } from '../pets/voxel/designs'

/** 每小时整批刷新的野生宠物数量（和 pets/wild.ts 的刷新池一致） */
export const WILD_SLOTS = 40

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type Breed = {
  id: string
  name: string
  /** 现实原型 + 城市观察的品种专属简介 */
  description: string
  /** 图鉴归属：颜色/花纹变体会归并到同一个品种条目 */
  catalogId: string
  /** 出现权重，默认 1 */
  weight?: number
  /** 主毛色：缩略图还没渲染出来时的色块 */
  swatch: string
  /** 稀有度，由 perHour 推出来 */
  rarity: Rarity
  /** 一小时里平均能遇到几只 */
  perHour: number
}

export type Species = {
  id: string
  name: string
  kind: 'pet' | 'wild'
  /** 图鉴详情中的简短介绍 */
  description: string
  /** 出现时间；目前没有时段配置，所以默认全天 */
  timeRange: 'any' | 'day' | 'night'
  /** 站立高度（世界单位，含耳朵） */
  height: number
  /** 在城里出现的权重 */
  spawn: number
  /** 物种整体的稀有度：取这个物种里最容易遇到的那个品种 */
  rarity: Rarity
  /** 一小时里平均能遇到几只（含所有品种） */
  perHour: number
  breeds: Breed[]
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: '常见',
  uncommon: '较常见',
  rare: '少见',
  epic: '稀有',
  legendary: '极稀有',
}

export const RARITY_STARS: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
}

/** 一小时里平均遇到几只 → 稀有度。分档按当前刷新池的实际分布定，保证五档都有人。 */
function rarityOf(perHour: number): Rarity {
  if (perHour >= 1.2) return 'common'
  if (perHour >= 0.8) return 'uncommon'
  if (perHour >= 0.5) return 'rare'
  if (perHour >= 0.28) return 'epic'
  return 'legendary'
}

type Meta = Omit<Species, 'breeds' | 'rarity' | 'perHour'>

const META: Meta[] = [
  {
    id: 'cat',
    name: '猫',
    kind: 'pet',
    description: '喜欢在街角、屋檐和暖光附近闲逛的城市居民。',
    timeRange: 'any',
    height: 0.9,
    spawn: 22,
  },
  {
    id: 'dog',
    name: '狗',
    kind: 'pet',
    description: '对路人的脚步声很敏感，偶尔会主动凑过来打招呼。',
    timeRange: 'any',
    height: 0.95,
    spawn: 18,
  },
  {
    id: 'bunny',
    name: '兔子',
    kind: 'pet',
    description: '安静又谨慎，常常躲在行人经过的草边观察城市。',
    timeRange: 'any',
    height: 0.95,
    spawn: 10,
  },
  {
    id: 'panda',
    name: '熊猫',
    kind: 'wild',
    description: '很少在城区出现的访客，走路慢吞吞，却总能吸引目光。',
    timeRange: 'any',
    height: 1.1,
    spawn: 2,
  },
  {
    id: 'fox',
    name: '狐狸',
    kind: 'wild',
    description: '很少在城区停留的野生访客，喜欢在边缘地带观察灯火。',
    timeRange: 'any',
    height: 1.0,
    spawn: 3,
  },
  {
    id: 'squirrel',
    name: '松鼠',
    kind: 'wild',
    description: '在公园长椅和行道树之间来回搬运，尾巴比身子更显眼。',
    timeRange: 'any',
    height: 0.7,
    spawn: 9,
  },
  {
    id: 'pig',
    name: '猪',
    kind: 'pet',
    description: '菜市场和城中村的老住户，鼻子前端总沾着一点土。',
    timeRange: 'any',
    height: 0.8,
    spawn: 6,
  },
  {
    id: 'sheep',
    name: '羊',
    kind: 'pet',
    description: '偶尔被牵到街边吃草，身上的毛像一团会移动的云。',
    timeRange: 'any',
    height: 0.9,
    spawn: 5,
  },
  {
    id: 'hedgehog',
    name: '刺猬',
    kind: 'wild',
    description: '夜里在灌木和花坛边上翻找吃的，一有动静就缩成一个刺球。',
    timeRange: 'any',
    height: 0.45,
    spawn: 1.5,
  },
  {
    id: 'raccoon',
    name: '浣熊',
    kind: 'wild',
    description: '城里的翻找能手，眼睛上像戴着一副黑色面罩，尾巴一圈一圈的。',
    timeRange: 'any',
    height: 0.7,
    spawn: 1.4,
  },
]

const BREED_DESCRIPTIONS: Record<string, string> = {
  'cat-tabby': '现实档案：常见的条纹家猫，适应力很强。城市观察：最熟悉小巷和屋檐的脚步声。',
  'cat-orange': '现实档案：橘色家猫通常亲人、食欲旺盛。城市观察：它总能找到午后最暖的一块地面。',
  'cat-bsh': '现实档案：英短蓝猫来自英国，脸圆、性格沉稳。城市观察：喜欢在橱窗灯下安静地观察行人。',
  'cat-calico': '现实档案：三花猫多为雌性，花色几乎不会完全重复。城市观察：每一只都像一张独一无二的城市地图。',
  'cat-tuxedo': '现实档案：黑白花色让它看起来像穿着礼服。城市观察：它出现在夜色里时，总像要参加一场舞会。',
  'cat-siamese': '现实档案：暹罗猫原产于泰国，重点色会随体温变化。城市观察：越靠近暖灯，脸上的颜色越柔和。',
  'cat-ragdoll': '现实档案：布偶猫以温顺和亲人闻名。城市观察：它愿意慢慢跟着熟悉的人走过整条街。',
  'cat-fold': '现实档案：折耳猫最明显的特征是向前折叠的耳朵。城市观察：它听见远处的电车声时，耳朵会轻轻抖一下。',
  'cat-black': '现实档案：黑猫的毛色来自黑色素基因，阳光下常带着棕色光泽。城市观察：夜里只看得见它眼睛里的两点灯光。',
  'cat-white': '现实档案：白猫的毛色明亮，部分个体对强光更敏感。城市观察：它喜欢躲在白色建筑的阴影边缘。',
  'cat-mainecoon': '现实档案：缅因猫原产美国，体型大、毛发长，性格通常温和。城市观察：它像一位披着长外套的安静住客。',
  'cat-persian': '现实档案：波斯猫以长毛和圆脸著称，喜欢稳定安静的环境。城市观察：它会挑选最少人经过的橱窗角落休息。',
  'cat-bengal': '现实档案：孟加拉猫的斑纹接近野生猫科动物，精力旺盛。城市观察：它对高处的招牌和天台路线特别感兴趣。',
  'dog-mutt': '现实档案：中华田园犬适应力强、警觉而忠诚。城市观察：它认识城里最多条回家的路。',
  'dog-shiba': '现实档案：柴犬原产日本，独立、机敏，尾巴卷在背上。城市观察：它对每一个新路口都保持谨慎的好奇。',
  'dog-corgi': '现实档案：柯基来自英国威尔士，短腿和长身是标志。城市观察：它的视线总在寻找下一块可以跳上的台阶。',
  'dog-golden': '现实档案：金毛温和聪明，常被训练为陪伴和工作犬。城市观察：它对陌生人也很少吝啬一个热情的回应。',
  'dog-poodle': '现实档案：泰迪是贵宾犬的常见造型，聪明且精力充沛。城市观察：它会把路边的小动静都当成游戏线索。',
  'dog-husky': '现实档案：哈士奇来自寒冷地区，耐力强、表情丰富。城市观察：它偶尔突然改变方向，像在追逐看不见的风。',
  'dog-frenchie': '现实档案：法斗体型紧凑，短鼻和蝙蝠耳很有辨识度。城市观察：它更喜欢短途散步和街角的阴凉处。',
  'dog-bichon': '现实档案：比熊拥有蓬松卷毛，性格通常友好活泼。城市观察：它经过时，像一团会移动的云。',
  'dog-labrador': '现实档案：拉布拉多友善、聪明，常被训练为工作犬。城市观察：它对每一位经过的人都保留着欢迎的余地。',
  'dog-collie': '现实档案：边境牧羊犬学习能力很强，精力充沛。城市观察：它会记住街上每一个人的行走路线。',
  'dog-samoyed': '现实档案：萨摩耶原产寒冷地区，白色毛发和“微笑”表情很有辨识度。城市观察：它像一团从冬天来到街区的云。',
  'dog-dachshund': '现实档案：腊肠犬身材修长、腿短，原本用于钻入洞穴。城市观察：它最擅长发现长椅底下和墙角的小秘密。',
  'bunny-brown': '现实档案：棕兔的保护色适合草地和土路。城市观察：它总能在砖缝旁找到一小片安静的绿意。',
  'bunny-white': '现实档案：白兔毛色干净，眼睛对光线较敏感。城市观察：它喜欢黄昏时分出现在浅色墙边。',
  'bunny-grey': '现实档案：灰兔的毛色接近岩石和树影，警觉性很高。城市观察：它停下来时几乎会和背景融在一起。',
  'bunny-black': '现实档案：黑兔的深色毛发在夜间更不显眼。城市观察：路灯亮起后，它反而比白天更容易被发现。',
  'bunny-lop': '现实档案：垂耳兔的耳朵自然向下，性格通常温和。城市观察：它会用耳朵的轻微摆动回应远处的声音。',
  'bunny-dutch': '现实档案：荷兰兔常有清晰的双色分区，花纹十分醒目。城市观察：它像一枚在街区里移动的黑白标记。',
  'panda-classic': '现实档案：大熊猫原产中国，主要以竹子为食，行动从容。城市观察：它出现时，连最吵的街角都会安静几秒。',
  'panda-brown': '现实档案：棕色熊猫是十分少见的毛色变异。城市观察：它像一块从山林误入城市的旧木雕。',
  'squirrel-red': '现实档案：红松鼠耳朵尖上有一撮长毛，尾巴几乎和身体一样大、能绕过背卷起来。城市观察：它把公园长椅当成了自己的仓库。',
  'squirrel-grey': '现实档案：灰松鼠没有耳簇，身子更长，尾巴像一把大刷子垂在身后。城市观察：它总在花坛里翻出别人早就忘掉的东西。',
  'squirrel-chipmunk': '现实档案：花栗鼠背上五道纵纹、脸上有两条过眼纹，尾巴短而竖起。城市观察：它比松鼠小一圈，胆子却大得多。',
  'pig-house': '现实档案：家猪的嗅觉比狗还灵敏，鼻子前端是一块专门的拱土盘，头几乎和身体齐平。城市观察：它把每一块松动的砖都拱开看看。',
  'pig-boar': '现实档案：野猪吻更长、鬃毛竖立，嘴边有一对向上翘的獠牙。城市观察：它走路不紧不慢，路过的人都自动绕开。',
  'sheep-wool': '现实档案：绵羊的毛会一直长，需要定期剪，脸小、身子是一整团羊毛。城市观察：它慢悠悠地啃过一整条人行道边的草。',
  'sheep-goat': '现实档案：山羊短毛、瘦身、向后弯的长角，下巴有一撮胡须。城市观察：它会站起来够树篱上最嫩的那几片叶子。',
  'hedgehog-brown': '现实档案：刺猬背上是一整层朝外支棱的棘刺，吻尖、腿短，受惊时会卷成一个球。城市观察：它只在路灯照不到的角落活动。',
  'raccoon-grey': '现实档案：浣熊的前爪非常灵活，几乎什么都能打开；眼睛上一道黑色面罩，尾巴一圈一圈。城市观察：它认识城里每一个没盖严的垃圾桶。',
}

const CATALOG_META: Record<string, { id: string; name: string; description?: string }> = {
  'cat-tabby': { id: 'cat-house', name: '家猫', description: '适应力很强的城市猫，毛色和花纹各不相同。它们熟悉屋檐、巷口和每一盏暖灯。' },
  'cat-orange': { id: 'cat-house', name: '家猫' },
  'cat-calico': { id: 'cat-house', name: '家猫' },
  'cat-tuxedo': { id: 'cat-house', name: '家猫' },
  'cat-black': { id: 'cat-house', name: '家猫' },
  'cat-white': { id: 'cat-house', name: '家猫' },
  'cat-bsh': { id: 'cat-bsh', name: '英国短毛猫' },
  'cat-siamese': { id: 'cat-siamese', name: '暹罗猫' },
  'cat-ragdoll': { id: 'cat-ragdoll', name: '布偶猫' },
  'cat-fold': { id: 'cat-fold', name: '苏格兰折耳猫' },
  'dog-mutt': { id: 'dog-mutt', name: '中华田园犬' },
  'dog-shiba': { id: 'dog-shiba', name: '柴犬' },
  'dog-corgi': { id: 'dog-corgi', name: '柯基' },
  'dog-golden': { id: 'dog-golden', name: '金毛' },
  'dog-poodle': { id: 'dog-poodle', name: '泰迪' },
  'dog-husky': { id: 'dog-husky', name: '哈士奇' },
  'dog-frenchie': { id: 'dog-frenchie', name: '法斗' },
  'dog-bichon': { id: 'dog-bichon', name: '比熊' },
  'bunny-brown': { id: 'bunny-house', name: '家兔', description: '温和谨慎的家兔，毛色从棕、白、灰到黑都有。它们喜欢安静的草边和不会突然响起的街角。' },
  'bunny-white': { id: 'bunny-house', name: '家兔' },
  'bunny-grey': { id: 'bunny-house', name: '家兔' },
  'bunny-black': { id: 'bunny-house', name: '家兔' },
  'bunny-lop': { id: 'bunny-lop', name: '垂耳兔' },
  'bunny-dutch': { id: 'bunny-dutch', name: '荷兰兔' },
  'panda-classic': { id: 'panda', name: '大熊猫' },
  'panda-brown': { id: 'panda', name: '大熊猫' },
  'fox-red': { id: 'fox-red', name: '赤狐', description: '现实档案：赤狐分布广泛，聪明、警觉，尾巴蓬松。城市观察：它会在街区边缘等待人群散开。' },
  'fox-arctic': { id: 'fox-arctic', name: '北极狐', description: '现实档案：北极狐生活在寒冷地区，冬季毛色会变浅。城市观察：它像一片从远方雪原飘来的安静影子。' },
  'fox-fennec': { id: 'fox-fennec', name: '耳廓狐', description: '现实档案：耳廓狐原产北非，巨大的耳朵帮助它散热和捕捉声音。城市观察：它能先听见拐角后的霓虹灯嗡鸣。' },
  'squirrel-red': { id: 'squirrel-red', name: '红松鼠', description: '耳尖一撮长毛，尾巴几乎和身体一样大、能绕过背卷起来。松鼠里最有辨识度的一种。' },
  'squirrel-grey': { id: 'squirrel-grey', name: '灰松鼠', description: '没有耳簇，身子更长，尾巴像一把大刷子垂在身后。城市公园里最常见的那种。' },
  'squirrel-chipmunk': { id: 'squirrel-chipmunk', name: '花栗鼠', description: '背上五道纵纹、脸上两条过眼纹，尾巴短而竖起。比松鼠小一圈，胆子却大得多。' },
  'pig-house': { id: 'pig', name: '家猪', description: '桶形身子、扁平鼻子盘、往前耷拉的大耳朵，头和背几乎齐平。嗅觉比狗还灵敏。' },
  'pig-boar': { id: 'pig', name: '野猪' },
  'sheep-wool': { id: 'sheep', name: '绵羊', description: '一整团羊毛配一张小小的深色脸，脸从毛里往前探出来，四条细腿藏在毛底下。' },
  'sheep-goat': { id: 'sheep', name: '山羊' },
  'hedgehog-brown': { id: 'hedgehog', name: '刺猬', description: '低矮的圆拱壳上长满朝外支棱的尖刺，浅色的吻尖、短短的腿。' },
  'raccoon-grey': { id: 'raccoon', name: '浣熊', description: '横过眼睛的黑色面罩和一圈一圈的尾巴。前爪灵活到几乎什么都能打开。' },
}

export const SPECIES: Species[] = (() => {
  const totalSpawn = META.reduce((sum, item) => sum + item.spawn, 0)
  return META.map((meta) => {
    const design = VOXEL_DESIGNS[meta.id]
    // 每小时这个物种会刷出几只，再按品种权重分下去
    const perHourSpecies = (meta.spawn / totalSpawn) * WILD_SLOTS
    const totalWeight = design.breeds.reduce((sum, b) => sum + (b.weight ?? 1), 0)
    const breeds: Breed[] = design.breeds.map((b) => {
      const perHour = perHourSpecies * ((b.weight ?? 1) / totalWeight)
      return {
        id: b.id,
        name: CATALOG_META[b.id]?.name ?? b.name,
        description:
          CATALOG_META[b.id]?.description ??
          BREED_DESCRIPTIONS[b.id] ??
          `${b.name}有着自己的外观特征和生活节奏。`,
        catalogId: CATALOG_META[b.id]?.id ?? b.id,
        weight: b.weight,
        swatch: b.palette?.fur ?? design.palette.fur,
        rarity: rarityOf(perHour),
        perHour,
      }
    })
    // 物种稀有度取最好遇到的那个品种：图鉴里「这个物种算什么稀有」看的是最容易见到的一面
    const easiest = Math.max(...breeds.map((b) => b.perHour))
    return { ...meta, breeds, perHour: perHourSpecies, rarity: rarityOf(easiest) }
  })
})()

const byId = new Map(SPECIES.map((s) => [s.id, s]))

export const speciesOf = (id: string) => byId.get(id) ?? SPECIES[0]

export const BREED_COUNT = SPECIES.reduce((sum, s) => sum + s.breeds.length, 0)

export function catalogBreedsOf(species: Species) {
  const unique = new Map<string, Breed>()
  for (const breed of species.breeds) {
    if (!unique.has(breed.catalogId)) unique.set(breed.catalogId, breed)
  }
  return [...unique.values()]
}

export function catalogKeyOf(speciesId: string, breedId: string) {
  const species = speciesOf(speciesId)
  const breed = species.breeds.find((item) => item.id === breedId)
  return `${speciesId}/${breed?.catalogId ?? breedId}`
}
