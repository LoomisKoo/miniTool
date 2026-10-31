import type { ReactNode } from 'react'
import {
  Balloon, Birds, Bubbles, CampfireCat, CloudBank, Cobbles, CoralReef, Crescent, Deer, FishSchool,
  FloatIsland, FlowerStrip, Fireflies, FruitCart, GirlDiver, GirlLantern, GirlSit, Hills, HouseRow, Jelly,
  Kelp, LetterGarland, LightRays, MailboxCat, Moon, MushroomHouse, MusicNotes, OrchardTree, OwlConductor,
  Picnic, Pines, PostOffice, PuffCloud, Rainbow, Seashells, Skyline, Stars, Stream, StreetLamp, Sun, Twinkle,
  Wall, WhaleLibrary, Windmill,
} from './art'

/** x 是纸片中心、y 是纸片底边（折痕）在书页上的位置，书页尺寸 500×560。 */
export type Layer = {
  art: ReactNode
  x: number
  y: number
  w: number
  /** 平铺（地面）纸片的显示高度：按槽位自身比例算，素材再高也只在框内等比缩进去 */
  h?: number
  flat?: boolean
  rot?: number
  /** 对应的模板槽位 id：点书页上的纸片时用来找到右边的菜单项 */
  id?: string
  /** 清空后只剩白色虚线占位：这时不打投影、也不画折痕，免得看起来还站着东西 */
  empty?: boolean
}

export type Spread = {
  title: string
  sub: string
  text: string
  page: string
  dots?: string
  wallLeft: ReactNode
  wallRight: ReactNode
  /** 左右背景墙各自对应的槽位 id（整张背景时两页指向同一个槽位） */
  wallLeftId?: string
  wallRightId?: string
  /** 不能移除的槽位（背景、地面），选中时只给“换素材”，不给“关闭” */
  locked?: string[]
  /** 空白草稿页：书页上不画背景，给一句提示 */
  draft?: boolean
  left: Layer[]
  right: Layer[]
}

export const spreads: Spread[] = [
  {
    title: '屋顶上的月光邮局',
    sub: 'CHAPTER 01',
    text: '每到月亮最圆的晚上，阿笺就提着小灯笼来到月光邮局。黑猫墨点守着邮筒——今晚，有三封寄往远方的信。',
    page: '#262a58',
    dots: 'rgba(255, 232, 170, .5)',
    wallLeft: (
      <Wall edge="arc" side="left" from="#151b45" to="#3b3f7e" seed={3}>
        <Stars seed={4} count={36} />
        <Moon x={150} y={110} r={48} />
        <Twinkle x={330} y={70} r={12} />
        <Skyline seed={8} y={258} />
      </Wall>
    ),
    wallRight: (
      <Wall edge="arc" side="right" from="#151b45" to="#3b3f7e" seed={9}>
        <Stars seed={13} count={36} />
        <Twinkle x={120} y={90} r={10} />
        <Twinkle x={380} y={130} r={14} />
        <Skyline seed={19} y={262} color="#2a3066" />
      </Wall>
    ),
    left: [
      { art: <HouseRow />, x: 230, y: 262, w: 400 },
      { art: <LetterGarland />, x: 250, y: 304, w: 400 },
      { art: <MailboxCat />, x: 110, y: 386, w: 92 },
      { art: <GirlLantern />, x: 330, y: 392, w: 100 },
    ],
    right: [
      { art: <PostOffice />, x: 210, y: 300, w: 250 },
      { art: <StreetLamp />, x: 420, y: 330, w: 56 },
      { art: <FlowerStrip />, x: 250, y: 420, w: 440 },
      { art: <Cobbles />, x: 250, y: 482, w: 320, flat: true },
    ],
  },
  {
    title: '海底图书馆',
    sub: 'CHAPTER 02',
    text: '第一封信寄给鲸鱼馆长。它背着整座图书馆慢慢游，说：“海里的每个故事，都要有人读才会发光。”',
    page: '#175a7c',
    dots: 'rgba(214, 245, 255, .35)',
    wallLeft: (
      <Wall edge="waves" side="left" from="#3ab3c4" to="#124a78" seed={5} live={<Bubbles seed={2} />}>
        <LightRays />
        <Hills y={280} color="#155081" seed={6} amp={40} />
      </Wall>
    ),
    wallRight: (
      <Wall edge="waves" side="right" from="#3ab3c4" to="#124a78" seed={11} live={<Bubbles seed={7} />}>
        <LightRays />
        <Hills y={270} color="#155081" seed={12} amp={50} />
      </Wall>
    ),
    left: [
      { art: <Kelp />, x: 86, y: 300, w: 120 },
      { art: <Jelly />, x: 210, y: 250, w: 70 },
      { art: <Jelly color="#b9a5e6" glow="#ece4ff" />, x: 410, y: 230, w: 56 },
      { art: <CoralReef />, x: 300, y: 340, w: 280 },
      { art: <GirlDiver />, x: 300, y: 410, w: 160 },
    ],
    right: [
      { art: <WhaleLibrary />, x: 240, y: 320, w: 340 },
      { art: <Kelp tones={['#3ea381', '#5bb98f', '#2f8f72', '#6cc49a']} />, x: 448, y: 270, w: 80 },
      { art: <FishSchool />, x: 370, y: 410, w: 190 },
      { art: <Seashells />, x: 150, y: 470, w: 170, flat: true, rot: -6 },
    ],
  },
  {
    title: '云上果园',
    sub: 'CHAPTER 03',
    text: '第二封信飞到了云朵上。风车转呀转，果园主人送给阿笺一篮会发光的橘子，说可以照亮回家的路。',
    page: '#9cc77e',
    dots: 'rgba(255, 255, 255, .35)',
    wallLeft: (
      <Wall edge="clouds" side="left" from="#8fd0ee" to="#fcd9cc" seed={2}>
        <Sun x={110} y={120} r={38} />
        <Rainbow cx={480} cy={300} r={170} />
        <Birds x={250} y={90} />
        <PuffCloud x={330} y={220} s={0.9} />
      </Wall>
    ),
    wallRight: (
      <Wall edge="clouds" side="right" from="#8fd0ee" to="#fcd9cc" seed={4}>
        <Rainbow cx={0} cy={300} r={170} />
        <PuffCloud x={330} y={120} s={1.1} />
        <PuffCloud x={160} y={250} s={0.8} color="#fff4f2" />
        <Birds x={380} y={200} />
      </Wall>
    ),
    left: [
      { art: <FloatIsland />, x: 180, y: 290, w: 250 },
      { art: <Balloon />, x: 380, y: 300, w: 110 },
      { art: <CloudBank />, x: 240, y: 400, w: 420 },
    ],
    right: [
      { art: <OrchardTree />, x: 140, y: 270, w: 150 },
      { art: <Windmill />, x: 370, y: 300, w: 140 },
      { art: <FruitCart />, x: 190, y: 400, w: 150 },
      { art: <Picnic />, x: 380, y: 470, w: 160, flat: true, rot: 4 },
    ],
  },
  {
    title: '萤火虫森林音乐会',
    sub: 'CHAPTER 04',
    text: '最后一封信送进了森林。猫头鹰举起指挥棒，萤火虫一齐亮起来——原来这一封，是大家写给阿笺的回信。',
    page: '#203c36',
    dots: 'rgba(255, 246, 170, .45)',
    wallLeft: (
      <Wall edge="pines" side="left" from="#0f2236" to="#2a4b50" seed={6} live={<Fireflies seed={3} />}>
        <Stars seed={21} count={24} maxY={140} />
        <Crescent x={140} y={120} r={34} />
        <Hills y={290} color="#18343a" seed={7} amp={40} />
      </Wall>
    ),
    wallRight: (
      <Wall edge="pines" side="right" from="#0f2236" to="#2a4b50" seed={8} live={<Fireflies seed={9} />}>
        <Stars seed={23} count={24} maxY={140} />
        <MusicNotes />
        <Hills y={280} color="#18343a" seed={10} amp={50} />
      </Wall>
    ),
    left: [
      { art: <Pines />, x: 110, y: 290, w: 180 },
      { art: <MushroomHouse />, x: 330, y: 330, w: 170 },
      { art: <CampfireCat />, x: 150, y: 400, w: 150 },
    ],
    right: [
      { art: <Pines fireflies={false} />, x: 110, y: 250, w: 120 },
      { art: <Deer />, x: 390, y: 300, w: 150 },
      { art: <OwlConductor />, x: 230, y: 340, w: 130 },
      { art: <GirlSit />, x: 360, y: 420, w: 100 },
      { art: <Stream />, x: 230, y: 492, w: 400, flat: true },
    ],
  },
]