import type { ReactNode } from 'react'
import {
  Balloon, Birds, Bubbles, CampfireCat, CloudBank, Cobbles, CoralReef, Crescent, Deer, Fireflies,
  FishSchool, FloatIsland, FlowerStrip, FruitCart, GirlDiver, GirlLantern, GirlSit, Hills, Jelly,
  Kelp, LetterGarland, LightRays, MailboxCat, Moon, MushroomHouse, OrchardTree, OwlConductor, Picnic,
  Pines, PostOffice, PuffCloud, Rainbow, Seashells, Skyline, Stars, Stream, StreetLamp, Sun, Twinkle,
  Wall, WhaleLibrary, Windmill, HouseRow,
} from './art'

/**
 * 内置素材：直接用 art.tsx 的剪纸组件，不额外存图片。
 * 一套背景是一对左右墙，同一个 id 用在左页或右页时各画各的一半，
 * 这样用户在内置素材里选一次，书脊处就是天然对齐的。
 */
export type WallPreset = { id: string; label: string; art: (side: 'left' | 'right') => ReactNode }
export type FloorPreset = { id: string; label: string; art: () => ReactNode }
/** 主体剪纸带自己的宽高比（取自 art.tsx 里 Cut 的 w / h），用来算它在槽位里该多大 */
export type SubjectPreset = FloorPreset & { aspect: number }

export const wallPresets: WallPreset[] = [
  {
    id: 'night',
    label: '月夜小镇',
    art: (side) => side === 'left'
      ? (
        <Wall edge="arc" side="left" from="#151b45" to="#3b3f7e" seed={3}>
          <Stars seed={4} count={38} />
          <Moon x={160} y={116} r={48} />
          <Skyline seed={8} y={258} />
        </Wall>
      )
      : (
        <Wall edge="arc" side="right" from="#151b45" to="#3b3f7e" seed={9}>
          <Stars seed={13} count={38} />
          <Twinkle x={130} y={88} r={11} />
          <Twinkle x={372} y={132} r={14} />
          <Skyline seed={19} y={262} color="#2a3066" />
        </Wall>
      ),
  },
  {
    id: 'dawn',
    label: '黄昏屋顶',
    art: (side) => side === 'left'
      ? (
        <Wall edge="arc" side="left" from="#f6b98a" to="#6d5a9e" seed={14}>
          <Sun x={210} y={186} r={44} />
          <Birds x={330} y={92} />
          <Skyline seed={15} y={250} color="#4a3a63" lit="#ffd489" />
        </Wall>
      )
      : (
        <Wall edge="arc" side="right" from="#f6b98a" to="#6d5a9e" seed={16}>
          <Birds x={120} y={120} />
          <Twinkle x={330} y={70} r={9} color="#ffe3ad" />
          <Skyline seed={17} y={256} color="#3f3157" lit="#ffc978" />
        </Wall>
      ),
  },
  {
    id: 'sea',
    label: '海底',
    art: (side) => (
      <Wall
        edge="waves"
        side={side}
        from={side === 'left' ? '#3ab3c4' : '#2fa8bd'}
        to="#124a78"
        seed={side === 'left' ? 5 : 11}
        live={<Bubbles seed={side === 'left' ? 2 : 7} />}
      >
        <LightRays />
        <Hills y={side === 'left' ? 280 : 270} color="#155081" seed={side === 'left' ? 6 : 12} amp={side === 'left' ? 40 : 50} />
      </Wall>
    ),
  },
  {
    id: 'sky',
    label: '云上',
    art: (side) => (
      <Wall
        edge="clouds"
        side={side}
        from={side === 'left' ? '#8fd0ee' : '#9ad6f0'}
        to="#fcd9cc"
        seed={side === 'left' ? 2 : 4}
      >
        {side === 'left' ? (
          <>
            <Sun x={110} y={120} r={38} />
            <Rainbow cx={480} cy={300} r={170} />
            <PuffCloud x={330} y={220} s={0.9} />
          </>
        ) : (
          <>
            <Rainbow cx={0} cy={300} r={170} />
            <PuffCloud x={330} y={120} s={1.1} />
            <Birds x={150} y={92} />
          </>
        )}
      </Wall>
    ),
  },
  {
    id: 'forest',
    label: '夜森林',
    art: (side) => (
      <Wall
        edge="pines"
        side={side}
        from="#0f2236"
        to="#2a4b50"
        seed={side === 'left' ? 6 : 8}
        live={<Fireflies seed={side === 'left' ? 3 : 9} />}
      >
        <Stars seed={side === 'left' ? 21 : 23} count={24} maxY={140} />
        <Crescent x={side === 'left' ? 140 : 360} y={120} r={34} />
        <Hills y={side === 'left' ? 290 : 280} color="#18343a" seed={side === 'left' ? 7 : 10} amp={44} />
      </Wall>
    ),
  },
]

export const floorPresets: FloorPreset[] = [
  { id: 'grass', label: '草地', art: () => <FlowerStrip seed={3} /> },
  { id: 'snowgrass', label: '雪地', art: () => <FlowerStrip seed={9} grass="#cfe0e8" /> },
  { id: 'cobble', label: '石板路', art: () => <Cobbles /> },
  { id: 'water', label: '水面', art: () => <Stream /> },
  { id: 'cloud', label: '云海', art: () => <CloudBank seed={4} /> },
  { id: 'shells', label: '贝壳滩', art: () => <Seashells /> },
  { id: 'seabed', label: '珊瑚海底', art: () => <FishSchool /> },
]

/** 主体位的内置剪纸，宽高比取自各组件 Cut 的 w / h；label 前面是分类，方便在素材面板里扫 */
export const subjectPresets: SubjectPreset[] = [
  // 人物
  { id: 'girl', label: '人物 · 提灯女孩', aspect: 120 / 200, art: () => <GirlLantern /> },
  { id: 'girl-sit', label: '人物 · 坐着的女孩', aspect: 130 / 160, art: () => <GirlSit /> },
  { id: 'girl-diver', label: '人物 · 潜水女孩', aspect: 180 / 160, art: () => <GirlDiver /> },
  { id: 'cat', label: '人物 · 邮筒黑猫', aspect: 100 / 170, art: () => <MailboxCat /> },
  { id: 'campfire', label: '人物 · 篝火夜话', aspect: 150 / 120, art: () => <CampfireCat /> },
  // 建筑
  { id: 'house', label: '建筑 · 蘑菇屋', aspect: 170 / 180, art: () => <MushroomHouse /> },
  { id: 'postoffice', label: '建筑 · 月光邮局', aspect: 260 / 270, art: () => <PostOffice /> },
  { id: 'row', label: '建筑 · 小屋连排', aspect: 440 / 200, art: () => <HouseRow /> },
  { id: 'windmill', label: '建筑 · 风车', aspect: 150 / 240, art: () => <Windmill /> },
  { id: 'island', label: '建筑 · 浮空岛', aspect: 260 / 280, art: () => <FloatIsland /> },
  // 动物
  { id: 'deer', label: '动物 · 小鹿', aspect: 170 / 200, art: () => <Deer /> },
  { id: 'owl', label: '动物 · 猫头鹰', aspect: 140 / 180, art: () => <OwlConductor /> },
  { id: 'whale', label: '动物 · 鲸鱼图书船', aspect: 340 / 220, art: () => <WhaleLibrary /> },
  { id: 'jelly', label: '动物 · 水母', aspect: 90 / 190, art: () => <Jelly /> },
  // 植物
  { id: 'tree', label: '植物 · 果园树', aspect: 170 / 240, art: () => <OrchardTree /> },
  { id: 'pines', label: '植物 · 松林', aspect: 190 / 260, art: () => <Pines /> },
  { id: 'kelp', label: '植物 · 海藻', aspect: 130 / 240, art: () => <Kelp /> },
  { id: 'coral', label: '植物 · 珊瑚礁', aspect: 280 / 150, art: () => <CoralReef /> },
  // 道具
  { id: 'lamp', label: '道具 · 街灯', aspect: 70 / 230, art: () => <StreetLamp /> },
  { id: 'balloon', label: '道具 · 热气球', aspect: 140 / 240, art: () => <Balloon /> },
  { id: 'cart', label: '道具 · 水果车', aspect: 150 / 120, art: () => <FruitCart /> },
  { id: 'picnic', label: '道具 · 野餐', aspect: 170 / 100, art: () => <Picnic /> },
  { id: 'garland', label: '道具 · 信封彩旗', aspect: 420 / 150, art: () => <LetterGarland /> },
]

/** 按槽位类型取内置列表（统一成 art(side) 的签名，方便缩略图直接画） */
export function presetsFor(kind: 'wall' | 'floor' | 'subject'): WallPreset[] {
  if (kind === 'wall') return wallPresets
  if (kind === 'floor') return floorPresets.map((p) => ({ id: p.id, label: p.label, art: () => p.art() }))
  return subjectPresets.map((p) => ({ id: p.id, label: p.label, art: () => p.art() }))
}

const wallMap = new Map(wallPresets.map((p) => [p.id, p]))
const flatMap = new Map([...floorPresets, ...subjectPresets].map((p) => [p.id, p]))
const subjectMap = new Map(subjectPresets.map((p) => [p.id, p]))

export const wallPreset = (id: string) => wallMap.get(id)
export const floorPreset = (id: string) => flatMap.get(id)
export const subjectPreset = (id: string) => subjectMap.get(id)
