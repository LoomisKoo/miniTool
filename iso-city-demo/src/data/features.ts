// 户型自带的特色设施。
//
// 规则全部来自 docs/05-housing.md 第 7.2 节：设施跟着「楼型和楼层」走，
// 不做成可购买商品。所以这里是纯函数，不存任何数据——同一户刷新多少次，
// 它家的东西都不会变。
//
// 一期只做能在户内自洽的四件（画廊墙 / 唱片机 / 望远镜 / 私人影院）和阳台灯串。
// 小院、私人钓位、天台烟花、公共客厅要户外场景或钓鱼系统，等那些落地再挂进来。

import { floorsOf, unitBuilding, type UnitInfo } from './units'

export type HomeFeature = 'gallery-wall' | 'record-player' | 'telescope' | 'cinema' | 'garden'

export type FeatureInfo = {
  id: HomeFeature
  name: string
  /** 面板/提示里的一句话，说清它为什么在这户 */
  blurb: string
}

export type HomeDevices = {
  list: HomeFeature[]
  /** 墙面能挂几幅画：画廊墙 4 幅，普通户 1 幅 */
  artSlots: number
  /** 顶层或 2 楼带露台的户：阳台挂灯串 */
  terrace: boolean
  /** 面积够大的户（大平层/大三室）才能放得下幕布 */
  wide: boolean
  /** 有露台花园：花箱、藤架、户外桌椅，宠物可以在里面活动 */
  garden: boolean
}

const FEATURES: Record<HomeFeature, FeatureInfo> = {
  'gallery-wall': { id: 'gallery-wall', name: '画廊墙', blurb: '整面墙挂四幅画，访客可以逐幅看' },
  'record-player': { id: 'record-player', name: '唱片机', blurb: '放一张唱片，房间里有声音' },
  telescope: { id: 'telescope', name: '望远镜', blurb: '架在窗边，能把远处的城市拉近' },
  cinema: { id: 'cinema', name: '私人影院', blurb: '幕布 + 本地视频，文件不离开你的电脑' },
  garden: { id: 'garden', name: '露台花园', blurb: '花箱、藤架和户外桌椅，宠物可以在里面晒太阳' },
}

/** 面积到多少算「放得下幕布」：文档里的大三室 / 大平层。 */
const CINEMA_AREA = 110

/** 望远镜只在高层区：北塔 20 楼以上。 */
const TELESCOPE_MIN_FLOOR = 20

const RULES: Array<(unit: UnitInfo, top: number) => HomeFeature | null> = [
  // 复古板楼（雪松公寓）与青年公寓：墙面宽、层高够，做画廊墙
  (unit) => (unit.buildingId === 'west-residence' || unit.buildingId === 'south-east' ? 'gallery-wall' : null),
  // 复古板楼：老唱片机是老街区的气质
  (unit) => (unit.buildingId === 'west-residence' ? 'record-player' : null),
  // 复古板楼 2 楼的露台户：底商屋顶就是自家的院子
  (unit) => (unit.buildingId === 'west-residence' && unit.floor === 2 && unit.balcony ? 'garden' : null),
  // 高层塔楼 20 楼以上：视野够远，望远镜才有意义
  (unit) => (unit.buildingId === 'north-tower' && unit.floor >= TELESCOPE_MIN_FLOOR ? 'telescope' : null),
  // 面积够大：幕布挂得下，投影距离也够
  (unit) => (unit.area >= CINEMA_AREA ? 'cinema' : null),
]

const EMPTY: HomeDevices = { list: [], artSlots: 1, terrace: false, wide: false, garden: false }

export function homeDevices(unit: UnitInfo | null): HomeDevices {
  if (!unit) return EMPTY
  const building = unitBuilding(unit.buildingId)
  const top = building ? floorsOf(building) : 1
  const list: HomeFeature[] = []
  for (const rule of RULES) {
    const hit = rule(unit, top)
    if (hit && !list.includes(hit)) list.push(hit)
  }
  return {
    list,
    artSlots: list.includes('gallery-wall') ? 4 : 1,
    // 顶层复式，或者 2 楼的露台户：阳台灯串从街上能看到
    terrace: unit.floor === top || (unit.floor === 2 && unit.balcony),
    wide: unit.area >= CINEMA_AREA,
    garden: list.includes('garden'),
  }
}

/** 片区：决定楼顶能不能放烟花、黄昏的光线、离钓鱼点多远。见文档 7.3。 */
export type Zone = 'waterfront' | 'plaza' | 'old-town' | 'high-rise' | 'mid-town'

const ZONES: Record<string, Zone> = {
  riverside: 'waterfront',
  'harbor-hotel': 'plaza',
  'south-east': 'plaza',
  'west-residence': 'old-town',
  'north-tower': 'high-rise',
  soundfield: 'mid-town',
  midtown: 'mid-town',
}

export function buildingZone(buildingId: string): Zone {
  return ZONES[buildingId] ?? 'mid-town'
}

export const ZONE_LABEL: Record<Zone, string> = {
  waterfront: '滨水区',
  plaza: '广场区',
  'old-town': '老街区',
  'high-rise': '高层区',
  'mid-town': '中巷创意街',
}

export function featureInfo(id: HomeFeature): FeatureInfo {
  return FEATURES[id]
}

/** 面板标题用：「特色设施」那一行。 */
export function featureSummary(devices: HomeDevices): string {
  return devices.list.map((id) => FEATURES[id].name).join(' · ')
}
