import type { ReactNode } from 'react'
import {
  Balloon, Bat, Birds, BookStack, Bubbles, Butterfly, Cake, CampfireCat, CandyBasket, Candle, CatNap,
  Cactus, CherryTree, CloudBank, Cobbles, CoffeeCup, CoralReef, Crescent, CrystalCluster, Deer, DeskLamp,
  Dandelion, Fireflies, FireflyJar, FishSchool, FloatIsland, FlowerStrip, FruitCart, Ghost, GirlDiver,
  GirlLantern, GirlSit, Hills, HouseRow, Jelly, Kelp, Kite, LetterGarland, LightRays, Lighthouse,
  MailboxCat, Moon, MushroomHouse, OrchardTree, OwlConductor, PaperPlane, PetalFloor, Picnic, Pines,
  Planet, PlantPot, PostOffice, PuffCloud, Pumpkin, Rabbit, Rainbow, Rocket, Rug, SailBoat, SandFloor,
  Seashells, Skyline, Snowman, Spider, Squirrel, Stars, Stream, StreetLamp, Sun, Tent, TileFloor,
  Tombstone, Torii, Twinkle, Ufo, Wall, WhaleLibrary, Windmill, Witch, WoodFloor,
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
  {
    id: 'haunt',
    label: '万圣夜',
    art: (side) => (
      <Wall edge="arc" side={side} from="#241436" to="#4b2a5e" seed={side === 'left' ? 31 : 37}>
        <Stars seed={side === 'left' ? 33 : 39} count={30} color="#f7d9ff" maxY={150} />
        <Moon x={side === 'left' ? 148 : 344} y={104} r={40} />
        {(side === 'left' ? [[150, 150, 1], [300, 128, .8], [230, 176, .6]] : [[150, 150, 1], [250, 150, .8], [330, 180, .6]]).map(([x, y, s], i) => (
          <path
            key={i}
            d={`M${x} ${y}l${-14 * s} ${-10 * s}q${-4 * s} ${8 * s} ${-12 * s} ${6 * s}l${10 * s} ${8 * s}q${5 * s} ${4 * s} ${7 * s} ${8 * s}q${2 * s} ${-4 * s} ${7 * s} ${-8 * s}l${10 * s} ${-8 * s}q${-8 * s} ${2 * s} ${-12 * s} ${-6 * s}Z`}
            fill="#2a1a3d"
          />
        ))}
        <Hills y={side === 'left' ? 288 : 292} color="#2a1a3d" seed={side === 'left' ? 34 : 40} amp={48} />
      </Wall>
    ),
  },
  {
    id: 'cosmos',
    label: '星际',
    art: (side) => (
      <Wall edge="arc" side={side} from="#150f38" to="#3d2c6b" seed={side === 'left' ? 61 : 67}>
        <Stars seed={side === 'left' ? 63 : 69} count={46} color="#fff0c8" maxY={200} />
        {side === 'left' ? (
          <>
            <ellipse cx="330" cy="120" rx="96" ry="44" fill="#7a5cc0" opacity=".28" />
            <ellipse cx="150" cy="210" rx="120" ry="40" fill="#3f7fc0" opacity=".22" />
            <Twinkle x={352} y={92} r={12} color="#ffe6a8" />
          </>
        ) : (
          <>
            <ellipse cx="120" cy="130" rx="104" ry="46" fill="#6a4fae" opacity=".26" />
            <ellipse cx="330" cy="216" rx="110" ry="36" fill="#2f6ba8" opacity=".24" />
            <Twinkle x={92} y={104} r={9} color="#ffe6a8" />
          </>
        )}
        <Hills y={side === 'left' ? 296 : 288} color="#241a4a" seed={side === 'left' ? 65 : 71} amp={40} />
      </Wall>
    ),
  },
  {
    id: 'winter',
    label: '雪夜',
    art: (side) => (
      <Wall edge="pines" side={side} from="#2a3f63" to="#8fb8d6" seed={side === 'left' ? 81 : 87}>
        <Stars seed={side === 'left' ? 83 : 89} count={26} color="#fff6de" maxY={120} />
        <Crescent x={side === 'left' ? 350 : 128} y={96} r={30} color="#fdf3d8" />
        <Hills y={side === 'left' ? 268 : 276} color="#e8f1fa" seed={side === 'left' ? 85 : 91} amp={34} />
        <Hills y={side === 'left' ? 300 : 296} color="#c3d8ea" seed={side === 'left' ? 86 : 92} amp={26} />
        {Array.from({ length: 26 }, (_, i) => (
          <circle key={i} cx={(i * 74 + (side === 'left' ? 20 : 58)) % 470} cy={(i * 53) % 250} r={1 + (i % 3) * .8} fill="#fff" opacity=".8" />
        ))}
      </Wall>
    ),
  },
  {
    id: 'room',
    label: '午后房间',
    art: (side) => (
      <Wall edge="arc" side={side} from="#f4e0d1" to="#dcc1ae" seed={side === 'left' ? 41 : 47}>
        {side === 'left' ? (
          <>
            <rect x="46" y="46" width="168" height="130" rx="8" fill="#cfe4ef" />
            <rect x="46" y="46" width="168" height="130" rx="8" fill="none" stroke="#f8f2e6" strokeWidth="8" />
            <path d="M130 46v130M46 110h168" stroke="#f8f2e6" strokeWidth="6" />
            <circle cx="230" cy="70" r="20" fill="#f8e7ae" opacity=".7" />
            <rect x="266" y="60" width="120" height="10" rx="4" fill="#b8854a" />
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={i} x={272 + i * 23} y={36 + (i % 2) * 4} width="14" height={24 - (i % 2) * 4} rx="2" fill={['#c96a5a', '#e3b453', '#7fa87a', '#5f8fb8', '#b07aa0'][i]} />
            ))}
            <rect x="266" y="150" width="120" height="76" rx="6" fill="#c9a06a" opacity=".5" />
          </>
        ) : (
          <>
            <rect x="250" y="52" width="170" height="120" rx="8" fill="#cfe4ef" />
            <rect x="250" y="52" width="170" height="120" rx="8" fill="none" stroke="#f8f2e6" strokeWidth="8" />
            <path d="M335 52v120M250 112h170" stroke="#f8f2e6" strokeWidth="6" />
            <rect x="40" y="70" width="150" height="8" rx="3" fill="#b8854a" />
            {[0, 1, 2].map((i) => (
              <rect key={i} x={50 + i * 30} y={44} width="18" height="28" rx="2" fill={['#e3b453', '#7fa87a', '#5f8fb8'][i]} />
            ))}
            <circle cx="210" cy="120" r="34" fill="#f6d9a8" opacity=".55" />
            <rect x="120" y="200" width="120" height="60" rx="8" fill="#c9a06a" opacity=".45" />
          </>
        )}
      </Wall>
    ),
  },
  {
    id: 'desert',
    label: '沙漠日落',
    art: (side) => (
      <Wall edge="arc" side={side} from="#fbd7a4" to="#d98a5c" seed={side === 'left' ? 101 : 107}>
        <Sun x={side === 'left' ? 332 : 152} y={132} r={46} />
        <Hills y={side === 'left' ? 262 : 272} color="#e8b483" seed={side === 'left' ? 103 : 109} amp={46} />
        <Hills y={side === 'left' ? 298 : 290} color="#c8875a" seed={side === 'left' ? 104 : 110} amp={26} />
        {Array.from({ length: 4 }, (_, i) => (
          <path
            key={i}
            d={`M${26 + i * 96} ${238 + (i % 2) * 18}q44 12 88 0`}
            stroke="#b8764c"
            strokeWidth="3"
            fill="none"
            opacity=".45"
          />
        ))}
      </Wall>
    ),
  },
  {
    id: 'blossom',
    label: '春日花见',
    art: (side) => (
      <Wall
        edge="clouds"
        side={side}
        from="#fff1f6"
        to="#f7c5d7"
        seed={side === 'left' ? 111 : 117}
        live={
          <g fill="#fff6fa">
            {Array.from({ length: 9 }, (_, i) => (
              <ellipse
                key={i}
                className="petal"
                cx={(i * 61 + (side === 'left' ? 24 : 58)) % 460}
                cy={24 + (i * 41) % 190}
                rx="3.4"
                ry="2.2"
                style={{ animationDuration: `${5 + (i % 4)}s`, animationDelay: `${-i * 1.3}s` }}
              />
            ))}
          </g>
        }
      >
        <PuffCloud x={side === 'left' ? 330 : 150} y={72} s={1.1} color="#fffafc" />
        <Hills y={side === 'left' ? 272 : 280} color="#f3b9cd" seed={side === 'left' ? 113 : 119} amp={42} />
        <Hills y={side === 'left' ? 302 : 296} color="#e79ab4" seed={side === 'left' ? 114 : 120} amp={26} />
      </Wall>
    ),
  },
  {
    id: 'neon',
    label: '霓虹夜市',
    art: (side) => (
      <Wall edge="arc" side={side} from="#0a0c22" to="#35194a" seed={side === 'left' ? 121 : 127}>
        <g fill="#171235">
          <rect x="8" y="150" width="122" height="180" />
          <rect x="150" y="110" width="92" height="220" />
          <rect x="262" y="172" width="108" height="158" />
          <rect x="390" y="132" width="84" height="198" />
        </g>
        <g fill="#ffd489" opacity=".5">
          {Array.from({ length: 20 }, (_, i) => (
            <rect key={i} x={22 + (i * 47) % 442} y={166 + (i * 31) % 142} width="7" height="9" rx="1" />
          ))}
        </g>
        <rect x="20" y="156" width="100" height="8" rx="4" fill="#7c5cff" opacity=".9" />
        <rect x="394" y="140" width="74" height="8" rx="4" fill="#5ff2ff" opacity=".85" />
        <g className="blink">
          <rect x="152" y="118" width="70" height="10" rx="5" fill="#ff5fa2" />
          <rect x="268" y="184" width="8" height="64" rx="4" fill="#5ff2ff" />
          <rect x="288" y="184" width="8" height="64" rx="4" fill="#ffd166" />
        </g>
        <Hills y={side === 'left' ? 306 : 300} color="#0b0a1c" seed={side === 'left' ? 123 : 129} amp={18} />
      </Wall>
    ),
  },
  {
    id: 'cave',
    label: '水晶洞窟',
    art: (side) => (
      <Wall edge="pines" side={side} from="#0c1528" to="#2b3a5c" seed={side === 'left' ? 131 : 137}>
        <LightRays />
        <Hills y={side === 'left' ? 292 : 286} color="#0a1122" seed={side === 'left' ? 133 : 139} amp={24} />
        <g fill="#7fe0ee">
          <path d="M56 322l16-76l13 76Z" opacity=".5" />
          <path d="M196 322l11-58l10 58Z" opacity=".4" />
          <path d="M300 322l14-64l11 64Z" opacity=".45" />
          <path d="M392 322l18-88l14 88Z" opacity=".38" />
        </g>
        <g className="glowpulse" fill="#c8f6ff">
          <path d="M62 286l6-42l6 42Z" />
          <path d="M303 292l5-34l5 34Z" />
          <path d="M398 278l6-40l6 40Z" />
        </g>
        <path d="M0 322h480" stroke="#0a1122" strokeWidth="8" />
      </Wall>
    ),
  },
  {
    id: 'aurora',
    label: '极光雪原',
    art: (side) => (
      <Wall edge="pines" side={side} from="#0b1a33" to="#1f4a5e" seed={side === 'left' ? 141 : 147}>
        <Stars seed={side === 'left' ? 143 : 149} count={30} maxY={140} />
        <g className="glowpulse" opacity=".7">
          <path d={side === 'left' ? 'M0 120Q120 40 240 100T480 70V110Q360 150 240 130T0 160Z' : 'M0 70Q120 110 240 80T480 120V160Q360 130 240 120T0 110Z'} fill="#5ff2b8" opacity=".35" />
          <path d={side === 'left' ? 'M0 90Q140 20 260 80T480 50V74Q360 110 250 100T0 120Z' : 'M0 50Q120 90 260 60T480 90V120Q360 100 250 92T0 74Z'} fill="#9a7cff" opacity=".28" />
        </g>
        <Hills y={side === 'left' ? 280 : 286} color="#e6f1fa" seed={side === 'left' ? 145 : 151} amp={30} />
      </Wall>
    ),
  },
  {
    id: 'rainbow',
    label: '彩虹晴天',
    art: (side) => (
      <Wall edge="clouds" side={side} from="#a8dcf5" to="#e6f6ff" seed={side === 'left' ? 151 : 157}>
        <Rainbow cx={side === 'left' ? 480 : 0} cy={290} r={210} />
        <Sun x={side === 'left' ? 90 : 390} y={86} r={34} />
        <PuffCloud x={side === 'left' ? 200 : 260} y={110} s={1} />
        <Hills y={side === 'left' ? 280 : 284} color="#8ccf8a" seed={side === 'left' ? 153 : 159} amp={40} />
        <Hills y={side === 'left' ? 306 : 302} color="#6db46f" seed={side === 'left' ? 154 : 160} amp={22} />
      </Wall>
    ),
  },
  {
    id: 'volcano',
    label: '远古火山',
    art: (side) => (
      <Wall edge="arc" side={side} from="#3a1a28" to="#c8573a" seed={side === 'left' ? 161 : 167}>
        {side === 'left' ? (
          <>
            <path d="M120 330L260 120h40l140 210Z" fill="#4a2028" />
            <path d="M262 120h36l-8 20h-20Z" fill="#ff8a3d" />
            <g className="glowpulse"><ellipse cx="280" cy="108" rx="30" ry="14" fill="#ffb15e" opacity=".6" /></g>
            <PuffCloud x={300} y={60} s={0.9} color="#7a5a5e" />
          </>
        ) : (
          <>
            <path d="M0 330L80 190h30l90 140Z" fill="#4a2028" />
            <PuffCloud x={120} y={70} s={0.8} color="#7a5a5e" />
            <Birds x={320} y={110} />
          </>
        )}
        <Hills y={side === 'left' ? 300 : 296} color="#2a1218" seed={side === 'left' ? 163 : 169} amp={20} />
      </Wall>
    ),
  },
  {
    id: 'candy',
    label: '糖果王国',
    art: (side) => (
      <Wall edge="clouds" side={side} from="#ffd6ea" to="#c8b6ff" seed={side === 'left' ? 171 : 177}>
        <PuffCloud x={side === 'left' ? 120 : 360} y={80} s={1} color="#fff6fb" />
        {[0, 1, 2].map((i) => {
          const x = (side === 'left' ? 90 : 120) + i * 130
          return (
            <g key={i}>
              <path d={`M${x} 330V${210 - i * 16}`} stroke="#fff" strokeWidth="6" />
              <circle cx={x} cy={196 - i * 16} r={26} fill={['#ff7fb0', '#7fd8ff', '#ffd166'][i]} />
              <path d={`M${x - 18} ${196 - i * 16}a18 18 0 0 1 36 0`} stroke="#fff" strokeWidth="4" fill="none" opacity=".7" />
            </g>
          )
        })}
        <Hills y={side === 'left' ? 292 : 296} color="#f7a8c8" seed={side === 'left' ? 173 : 179} amp={30} />
      </Wall>
    ),
  },
  {
    id: 'library',
    label: '魔法书房',
    art: (side) => (
      <Wall edge="arc" side={side} from="#3b2a3a" to="#6a4a3c" seed={side === 'left' ? 181 : 187}>
        {[0, 1, 2, 3].map((row) => (
          <g key={row}>
            <rect x="20" y={60 + row * 64} width="440" height="8" rx="3" fill="#2a1a20" />
            {Array.from({ length: 16 }, (_, i) => (
              <rect
                key={i}
                x={26 + i * 27}
                y={60 + row * 64 - 40 + ((i + row) % 3) * 4}
                width="20"
                height={40 - ((i + row) % 3) * 4}
                rx="2"
                fill={['#c96a5a', '#e3b453', '#7fa87a', '#5f8fb8', '#b07aa0', '#d98a5c'][(i + row * 2) % 6]}
              />
            ))}
          </g>
        ))}
        <g className="blink" fill="#ffe9a0">
          <circle cx={side === 'left' ? 360 : 110} cy="40" r="4" />
          <circle cx={side === 'left' ? 200 : 300} cy="110" r="3" />
          <circle cx={side === 'left' ? 90 : 400} cy="170" r="3.5" />
        </g>
      </Wall>
    ),
  },
  {
    id: 'jungle',
    label: '热带雨林',
    art: (side) => (
      <Wall edge="pines" side={side} from="#1f4a3a" to="#5a9a5c" seed={side === 'left' ? 191 : 197}>
        <LightRays />
        {Array.from({ length: 6 }, (_, i) => {
          const x = 30 + i * 84 + (side === 'left' ? 0 : 20)
          return (
            <g key={i} fill={i % 2 ? '#2f6b45' : '#3d8050'}>
              <path d={`M${x} 330V${200 - (i % 3) * 20}`} stroke="#5a4030" strokeWidth="6" />
              <path d={`M${x} ${200 - (i % 3) * 20}q-40 -10 -56 20q30 -6 56 -20q40 -10 56 20q-30 -6 -56 -20q-10 -40 20 -50q-10 20 -20 50q-30 -40 -54 -30q24 6 54 30Z`} />
            </g>
          )
        })}
        <Hills y={side === 'left' ? 296 : 300} color="#1d4030" seed={side === 'left' ? 193 : 199} amp={24} />
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
  { id: 'rug', label: '客厅地毯', art: () => <Rug /> },
  { id: 'wood', label: '木地板', art: () => <WoodFloor /> },
  { id: 'sand', label: '沙丘', art: () => <SandFloor /> },
  { id: 'petals', label: '花瓣地', art: () => <PetalFloor /> },
  { id: 'tiles', label: '夜市地砖', art: () => <TileFloor /> },
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
  // 万圣夜
  { id: 'pumpkin', label: '万圣 · 南瓜灯', aspect: 150 / 142, art: () => <Pumpkin /> },
  { id: 'ghost', label: '万圣 · 小幽灵', aspect: 120 / 150, art: () => <Ghost /> },
  { id: 'bat', label: '万圣 · 蝙蝠', aspect: 160 / 90, art: () => <Bat /> },
  { id: 'tombstone', label: '万圣 · 墓碑', aspect: 132 / 142, art: () => <Tombstone /> },
  { id: 'witch', label: '万圣 · 小女巫', aspect: 140 / 220, art: () => <Witch /> },
  { id: 'candy', label: '万圣 · 糖果篮', aspect: 140 / 122, art: () => <CandyBasket /> },
  // 午后生活
  { id: 'coffee', label: '生活 · 咖啡杯', aspect: 124 / 130, art: () => <CoffeeCup /> },
  { id: 'books', label: '生活 · 书堆', aspect: 150 / 124, art: () => <BookStack /> },
  { id: 'plant', label: '生活 · 盆栽', aspect: 120 / 160, art: () => <PlantPot /> },
  { id: 'catnap', label: '生活 · 打盹的猫', aspect: 160 / 110, art: () => <CatNap /> },
  { id: 'tent', label: '户外 · 帐篷', aspect: 180 / 132, art: () => <Tent /> },
  // 会动的贴纸
  { id: 'candle', label: '万圣 · 蜡烛', aspect: 90 / 150, art: () => <Candle /> },
  { id: 'spider', label: '万圣 · 吊蛛', aspect: 110 / 160, art: () => <Spider /> },
  { id: 'desklamp', label: '生活 · 台灯', aspect: 130 / 170, art: () => <DeskLamp /> },
  { id: 'cake', label: '生活 · 生日蛋糕', aspect: 150 / 150, art: () => <Cake /> },
  { id: 'rabbit', label: '生活 · 兔子', aspect: 140 / 160, art: () => <Rabbit /> },
  { id: 'butterfly', label: '森林 · 蝴蝶', aspect: 150 / 120, art: () => <Butterfly /> },
  { id: 'squirrel', label: '森林 · 松鼠', aspect: 150 / 160, art: () => <Squirrel /> },
  { id: 'dandelion', label: '森林 · 蒲公英', aspect: 120 / 180, art: () => <Dandelion /> },
  { id: 'jar', label: '森林 · 萤火罐', aspect: 120 / 160, art: () => <FireflyJar /> },
  { id: 'boat', label: '海边 · 帆船', aspect: 190 / 140, art: () => <SailBoat /> },
  { id: 'kite', label: '天空 · 风筝', aspect: 140 / 180, art: () => <Kite /> },
  { id: 'plane', label: '天空 · 纸飞机', aspect: 160 / 110, art: () => <PaperPlane /> },
  { id: 'rocket', label: '太空 · 火箭', aspect: 130 / 230, art: () => <Rocket /> },
  { id: 'planet', label: '太空 · 行星', aspect: 170 / 150, art: () => <Planet /> },
  { id: 'ufo', label: '太空 · 飞碟', aspect: 180 / 110, art: () => <Ufo /> },
  { id: 'snowman', label: '冬日 · 雪人', aspect: 150 / 190, art: () => <Snowman /> },
  // 新场景
  { id: 'cactus', label: '沙漠 · 仙人掌', aspect: 130 / 200, art: () => <Cactus /> },
  { id: 'cherry', label: '春日 · 樱花树', aspect: 220 / 270, art: () => <CherryTree /> },
  { id: 'torii', label: '春日 · 鸟居', aspect: 230 / 200, art: () => <Torii /> },
  { id: 'crystal', label: '洞窟 · 水晶簇', aspect: 190 / 180, art: () => <CrystalCluster /> },
  { id: 'lighthouse', label: '海边 · 灯塔', aspect: 160 / 280, art: () => <Lighthouse /> },
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
