import type { RoomId, SkillKey, Temper } from '../types'

export const COMPANY = '微光娱乐'
export const RIVAL = '耀世传媒'

export const SKILL_NAMES: Record<SkillKey, string> = {
  vocal: '唱功',
  dance: '舞蹈',
  acting: '演技',
  variety: '综艺感',
  image: '形象',
}

export const TEMPERS: Record<Temper, { name: string; desc: string; color: string; color2: string }> = {
  sunny: { name: '小太阳', desc: '乐观好带，情绪恢复快', color: '#ffb347', color2: '#ff7e5f' },
  cool: { name: '高冷系', desc: '天赋高，难亲近，自尊心强', color: '#6a8dff', color2: '#4a5bd6' },
  drama: { name: '戏精', desc: '镜头感强，爱抢风头', color: '#ff6fa5', color2: '#d9478a' },
  chill: { name: '佛系', desc: '心态稳，就是不太上进', color: '#5cc9a7', color2: '#3a9c86' },
  fragile: { name: '玻璃心', desc: '细腻敏感，一句重话能难过三天', color: '#b18cff', color2: '#8a63e6' },
  ambitious: { name: '野心家', desc: '想红想疯了，什么都敢拼', color: '#ff6b6b', color2: '#d63c4f' },
}

export const RANKS = ['练习生', '新人', '三线', '二线', '一线', '顶流']
export const RANK_WAGE = [2, 4, 8, 15, 30, 60]

export const ROOMS: Record<RoomId, { name: string; desc: string; skills: SkillKey[]; emoji: string }> = {
  vocal: { name: '声乐室', desc: '练唱功', skills: ['vocal'], emoji: '🎤' },
  dance: { name: '舞蹈室', desc: '练舞蹈与体态', skills: ['dance', 'image'], emoji: '💃' },
  acting: { name: '表演课', desc: '磨演技', skills: ['acting'], emoji: '🎬' },
  variety: { name: '综艺特训', desc: '练反应和梗', skills: ['variety', 'image'], emoji: '🎙️' },
  live: { name: '直播间', desc: '开播攒粉，挣点小钱', skills: [], emoji: '📱' },
  rest: { name: '宿舍', desc: '休息回血', skills: [], emoji: '🛏️' },
}

export interface TraitDef {
  name: string
  desc: string
  mod?: Partial<Record<SkillKey, number>>
}

export const TRAITS: Record<string, TraitDef> = {
  grind: { name: '卷王', desc: '凌晨三点的练习室常客' },
  slacker: { name: '摸鱼达人', desc: '能躺着绝不坐着' },
  money: { name: '搞钱脑', desc: '红包比夸奖管用一百倍' },
  vain: { name: '爱美', desc: '路过镜子必须停三秒', mod: { image: 1.2 } },
  loyal: { name: '重义气', desc: '对他好，他记一辈子' },
  grudge: { name: '小本本', desc: '每句重话都记在小本本上' },
  competitive: { name: '胜负欲', desc: '排名掉一位能失眠' },
  sweet: { name: '嘴甜', desc: '三句话把人哄得找不着北', mod: { variety: 1.2 } },
  pitch: { name: '绝对音感', desc: '听一遍就能唱准', mod: { vocal: 1.35 } },
  dancer: { name: '舞担体质', desc: '天生的节奏感', mod: { dance: 1.35 } },
  stiff: { name: '同手同脚', desc: '跳舞时四肢各有想法', mod: { dance: 0.75 } },
  camera: { name: '镜头脸', desc: '镜头一怼就来状态', mod: { acting: 1.25, image: 1.1 } },
  shy: { name: '社恐', desc: '人一多就想原地消失', mod: { variety: 0.75 } },
  toxic: { name: '毒舌', desc: '实话说得太实了' },
  romantic: { name: '恋爱脑', desc: '随时可能为爱冲昏头' },
  nightowl: { name: '熬夜党', desc: '体力掉得飞快' },
  gossip: { name: '八卦雷达', desc: '公司里没有他不知道的事' },
  stubborn: { name: '犟种', desc: '认准的事十头牛拉不回' },
  nerd: { name: '学霸', desc: '背台词像背公式', mod: { acting: 1.15 } },
  meme: { name: '梗王', desc: '自带笑点', mod: { variety: 1.3 } },
}

export const SURNAMES = '林沈许江陈周苏叶顾宋程姜夏温白秦陆唐何乔'.split('')
export const F_NAMES = ['栀夏', '念安', '可颂', '一诺', '星禾', '初雪', '芮芮', '知意', '棠棠', '予希', '月半', '晚晴', '小满', '鹿溪', '南乔', '岁岁', '安琪', '梨落', '向晚', '糯米']
export const M_NAMES = ['逸舟', '子言', '一鸣', '屿森', '嘉树', '星野', '浩然', '景行', '亦辰', '北辰', '小北', '牧之', '泽宇', '修远', '橙橙', '昭阳', '凯文', '知南', '默言', '阿乐']

export const ORIGINS = [
  { text: '音乐学院辍学，说学校教不了他想要的', mod: { vocal: 1.25 } as Partial<Record<SkillKey, number>> },
  { text: '街舞比赛冠军，被星探在广场上拦下', mod: { dance: 1.3 } },
  { text: '前童星，长大后长残又长回来了', mod: { acting: 1.25, image: 1.1 } },
  { text: '短视频平台小网红，粉丝三万', mod: { variety: 1.2 } },
  { text: '大厂练习生，没出道被裁了', mod: { dance: 1.15, vocal: 1.1 } },
  { text: '县城奶茶店店员，唱歌被顾客拍火了', mod: { vocal: 1.15 } },
  { text: '名校学霸，瞒着家里来追梦', mod: { acting: 1.1 } },
  { text: '模特出身，想转型当艺人', mod: { image: 1.35 } },
  { text: '选秀节目第42名，差一点就出道', mod: {} },
  { text: '武校毕业，被剧组挖来当替身', mod: { dance: 1.1, acting: 1.1 } },
  { text: '偷偷报名海选，家里还不知道', mod: {} },
  { text: '前地下乐队主唱，乐队散了', mod: { vocal: 1.2, variety: 1.1 } },
]

export const SECRETS = [
  '有个谈了三年的对象，一直没敢让公司知道',
  '家里欠了一笔债，片酬大半都打回了家',
  '其实是富二代，跟家里闹翻才出来的',
  '小时候被网暴过，至今不敢看评论区',
  '和对家公司的某个练习生是亲兄妹',
  '偷偷在写歌，攒了一整个文件夹的demo',
  '有轻度舞台恐惧症，每次上台前都在厕所吐',
  '曾经在别的公司签过阴阳合同，被坑过一次',
]

export const FACILITIES: Record<string, { name: string; desc: string; cost: number[] }> = {
  vocal: { name: '声乐室', desc: '唱功训练效率提升', cost: [80, 200] },
  dance: { name: '舞蹈室', desc: '舞蹈训练效率提升', cost: [80, 200] },
  acting: { name: '表演课', desc: '演技训练效率提升', cost: [80, 200] },
  variety: { name: '综艺特训', desc: '综艺感训练效率提升', cost: [80, 200] },
  dorm: { name: '宿舍', desc: '可签约更多艺人（每级 +3）', cost: [120, 300] },
  pr: { name: '宣传部', desc: '通告更多，口碑涨得更快', cost: [150, 400] },
}

export const PHASE_NAMES = ['上午', '下午', '晚上', '深夜']

export function fmtMoney(n: number) {
  const neg = n < 0
  const v = Math.abs(Math.round(n))
  const s = v >= 10 ? `${(v / 10).toFixed(v % 10 ? 1 : 0)}万` : `${v}千`
  return (neg ? '-' : '') + s
}

export function fmtFans(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}亿`
  if (n >= 1) return `${n.toFixed(n >= 100 ? 0 : 1)}万`
  return `${Math.round(n * 10000)}`
}
