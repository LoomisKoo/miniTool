import { buildings, insideRoad } from './city'
import { insideBuilding } from './infill'
import { seeded } from '../scene/theme'
import { randomLook, type Look } from '../scene/people'
import { stalls } from './stalls'

export type NpcDef = {
  id: string
  name: string
  role: string
  lines: string[]
  x: number
  z: number
  /** 平时面朝的方向（弧度，绕 y），玩家走近会转过去看他。 */
  yaw: number
  look: Look
  /**
   * 头顶名牌对应哪个交互点。默认 `npc-${id}`；摊位摊主复用的是摊位本人的
   * 那个交互点（点了既是对话也是摊面），所以要显式指过去。
   */
  actionId?: string
}

type Spec = {
  id: string
  name: string
  role: string
  lines: string[]
  /** 站在某栋楼门口旁边：along 是沿立面的偏移，out 是离墙的距离。 */
  at: { building: string; along: number; out?: number } | { x: number; z: number; yaw: number }
}

const SPECS: Spec[] = [
  {
    id: 'cafe-greeter',
    name: '小满',
    role: '街角咖啡 · 店员',
    at: { building: 'cafe', along: 3.2 },
    lines: [
      '下午好！今天的手冲是埃塞俄比亚耶加雪菲，柑橘味很明显。',
      '店里有座位，靠窗那排晚上能看到摩天轮的灯。',
      '进去找吧台的阿哲点单就行，他拉花很厉害。',
    ],
  },
  {
    id: 'soundfield-clerk',
    name: '老周',
    role: '声场唱片 · 店主',
    at: { building: 'soundfield', along: -3.4 },
    lines: [
      '黑胶要竖着放，平放压久了会变形。',
      '地下一层是静音工作室，认领之后可以自己布置。',
    ],
  },
  {
    id: 'midtown-designer',
    name: '林舟',
    role: '中巷工作室 · 设计师',
    at: { building: 'midtown', along: 3.6 },
    lines: [
      '我们在做一套城市导视牌，你觉得字体要不要再大一点？',
      '楼上还有几间空工作室，采光不错。',
    ],
  },
  {
    id: 'hotel-concierge',
    name: '安娜',
    role: '港湾酒店 · 礼宾',
    at: { building: 'harbor-hotel', along: 4.2 },
    lines: [
      '欢迎来到港湾酒店。新来的朋友可以先在这里落脚。',
      '楼顶有烟花发射台，认领了空间的住户可以去放。',
      '晚上八点以后从楼顶看河景最漂亮。',
    ],
  },
  {
    id: 'gallery-guide',
    name: '许言',
    role: '光盒美术馆 · 讲解员',
    at: { building: 'gallery', along: -4 },
    lines: [
      '本期展览叫《城市的折光》，主要是玻璃和灯光装置。',
      '展厅里可以给作品留言，别人进来会看到。',
    ],
  },
  {
    id: 'flower-vendor',
    name: '春姨',
    role: '广场 · 卖花',
    at: { x: -36, z: 22, yaw: Math.PI },
    lines: ['今天的向日葵刚到，放在窗台上能开一个礼拜。', '送人的话我帮你包一下，不要钱。'],
  },
  {
    id: 'alley-musician',
    name: '阿果',
    role: '街头吉他手',
    at: { x: 21, z: -14, yaw: -Math.PI / 2 },
    lines: ['想听什么？我会弹的不多，但都弹得很认真。', '下雨天我就去地铁口那边。'],
  },
]

const SIDE_NORMAL: Record<string, [number, number]> = {
  east: [1, 0],
  west: [-1, 0],
  north: [0, -1],
  south: [0, 1],
}

function resolve(spec: Spec): { x: number; z: number; yaw: number } | null {
  const at = spec.at
  if (!('building' in at)) return at
  const b = buildings.find((item) => item.id === at.building)
  if (!b) return null
  const side = b.entranceSide || b.facing || 'south'
  const [nx, nz] = SIDE_NORMAL[side] ?? SIDE_NORMAL.south
  const [ex, ez] = b.entranceAt ?? [b.x + (nx * b.w) / 2, b.z + (nz * b.d) / 2]
  const along = at.along
  // 沿立面的方向是法线转 90°
  const tx = -nz
  const tz = nx
  // 先离墙 out 米；落进楼或车道就再往外挪
  for (let out = at.out ?? 1.6; out < 6; out += 0.5) {
    const x = ex + nx * out + tx * along
    const z = ez + nz * out + tz * along
    if (insideBuilding(x, z, 0.4) || insideRoad(x, z, 0.6)) continue
    return { x, z, yaw: Math.atan2(nx, nz) }
  }
  return null
}

export const npcs: NpcDef[] = (() => {
  const rnd = seeded('npcs-v1')
  const list: NpcDef[] = []
  for (const spec of SPECS) {
    const look = randomLook(rnd)
    const pos = resolve(spec)
    if (!pos) continue
        list.push({ id: spec.id, name: spec.name, role: spec.role, lines: spec.lines, ...pos, look })  }
  return list
})()

/** 咖啡店吧台后的店员（室内坐标系）。 */export const barista: NpcDef = {
  id: 'barista',
  name: '阿哲',
  role: '街角咖啡 · 咖啡师',
  lines: [
    '欢迎光临！想喝点什么？',
    '推荐今天的燕麦拿铁，豆子是上周新烘的。',
    '稍等，马上好。座位随便坐，窗边那排最舒服。',
  ],
  // 吧台沿 x 放在 (5.6, 0)，酒架在 -z 一侧：店员站在台后，面朝顾客（+z）
  x: 6.1,
  z: -1.0,
  yaw: 0,
  look: randomLook(seeded('barista')),
}

/**
 * 摊位摊主：站在柜台后面，面朝街。
 *
 * 只生成"NPC 摊"的摊主——玩家摊默认摊主不在，牌子上写着自助。
 * 这些摊主不进 npcs 数组：摊位本身已经是一个交互点（对话和摊面信息都在
 * 一起），再挂一个"对话"交互点会让玩家在柜台前选不中想要的。
 */
export const stallVendors: NpcDef[] = (() => {
  const rnd = seeded('stall-vendors')
  return stalls
    .filter((stall) => stall.vendor.kind === 'npc')
    .map((stall) => {
      const back = 0.52
      return {
        id: `vendor-${stall.id}`,
        name: stall.vendor.kind === 'npc' ? stall.vendor.name : '摊主',
        role: stall.vendor.kind === 'npc' ? stall.vendor.role : `${stall.title} · 摊主`,
        lines: stall.vendor.kind === 'npc' ? stall.vendor.lines : [],
        x: stall.x - Math.sin(stall.yaw) * back,
        z: stall.z - Math.cos(stall.yaw) * back,
        yaw: stall.yaw,
        look: randomLook(rnd),
        // 摊主的交互点就是摊位本身那个：走近时名牌和 E 一起亮，
        // 按下去直接开对话（NPC 摊）或摊面面板（玩家摊）。
        actionId: `stall-${stall.id}`,
      }
    })
})()
