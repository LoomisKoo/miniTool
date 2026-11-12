import {
  BALCONY_OUT,
  DOOR,
  FLOOR_HEIGHT,
  OPENING,
  OPPOSITE,
  ROOF_FLOOR,
  UNIT_BUILDINGS,
  UNIT_BUILDING_IDS,
  WALL,
  buildUnitSpaces,
  entrancesOf,
  exteriorSidesOf,
  floorLabel,
  floorLayout,
  floorList,
  floorsOf,
  isUnitSpaceId,
  shellHeightOf,
  spanOn,
  unitAt,
  unitBuilding as rawUnitBuilding,
  unitCountOf,
  unitMetaOfSpace,
  unitSpaceId,
  unitsOf,
  unitsOnFloor,
} from '../../shared/units.mjs'

/** 外墙四面：n(-z) / s(+z) / w(-x) / e(+x)。 */
export type Side = 'n' | 's' | 'e' | 'w'

export type Rect = { x0: number; x1: number; z0: number; z1: number }

export type OpeningKind = 'window' | 'balcony' | 'store' | 'entry' | 'stair'

/** 外墙上的一个洞口。a 是沿墙坐标（n/s 墙取 x，e/w 墙取 z），y 相对本层楼板。 */
export type Opening = {
  side: Side
  a0: number
  a1: number
  y0: number
  y1: number
  kind: OpeningKind
  /** u:户号 / h:公共厅 / shop / core */
  owner: string
}

export type BalconySpan = { side: Side; a0: number; a1: number; owner: string }

/** 户内的一间房：living / bedroom / bath。 */
export type RoomKind = 'living' | 'bedroom' | 'bath'

export type RoomZone = {
  kind: RoomKind
  rect: Rect
  doors: Array<{ side: Side; at: number; width: number }>
}

/** 户型内部的隔墙与分区（由 shared/units.mjs 的平面数据生成）。 */
export type UnitInterior = {
  rooms: RoomZone[]
  walls: Rect[]
  headers: Rect[]
  bedroom: Rect | null
  bath: { rect: Rect } | null
}

export type UnitRect = {
  index: number
  rect: Rect
  door: { side: Side; at: number }
  openings: Opening[]
  balcony: BalconySpan | null
  hall: number
  interior: UnitInterior
}

export type Hall = {
  index: number
  rect: Rect
  elevator: { side: Side; at: number }
  exit: { side: Side; at: number; a0: number; a1: number } | null
  doors: Array<{ unit: number; side: Side; at: number }>
  openings: Opening[]
}

export type FloorLayout = {
  type: 'slab' | 'tower' | 'corridor'
  halls: Hall[]
  units: UnitRect[]
  facade: Opening[]
}

export type UnitRoom = {
  width: number
  depth: number
  height: number
}

export type UnitBuilding = {
  id: string
  name: string
  type: 'slab' | 'tower' | 'corridor'
  w: number
  d: number
  h: number
  basements?: number
  face?: 'north' | 'south' | 'east' | 'west'
  roomW?: number
}

export type UnitInfo = {
  spaceId: string
  buildingId: string
  floor: number
  index: number
  label: string
  name: string
  special: string | null
  unit: UnitRect
  hall: number
  balcony: boolean
  exterior: boolean
  room: UnitRoom
  area: number
}

export type UnitMeta = {
  buildingId: string
  floor: number
  index: number
  label: string
}

const BUILDINGS = UNIT_BUILDINGS as UnitBuilding[]
const BUILDING_IDS = UNIT_BUILDING_IDS as string[]

export {
  BALCONY_OUT,
  DOOR,
  FLOOR_HEIGHT,
  OPENING,
  ROOF_FLOOR,
  WALL,
  buildUnitSpaces,
  floorLabel,
  floorList,
  floorsOf,
  isUnitSpaceId,
  shellHeightOf,
  unitCountOf,
  unitMetaOfSpace,
  unitSpaceId,
  unitsOf,
}

export const opposite = OPPOSITE as Record<Side, Side>

export function unitBuilding(id: string): UnitBuilding | null {
  return (rawUnitBuilding(id) as UnitBuilding | null) || null
}

export function layoutOf(building: UnitBuilding, floor: number): FloorLayout {
  return floorLayout(building, floor) as FloorLayout
}

export function unitAtFloor(building: UnitBuilding, floor: number, index: number): UnitInfo | null {
  return unitAt(building, floor, index) as UnitInfo | null
}

export function unitsOnFloorOf(building: UnitBuilding, floor: number): UnitInfo[] {
  return (unitsOnFloor(building, floor) as Array<UnitInfo | null>).filter(Boolean) as UnitInfo[]
}

export function entrancesOfBuilding(building: UnitBuilding) {
  return entrancesOf(building) as Array<{ hall: number; side: Side; x: number; z: number }>
}

export function exteriorSides(building: UnitBuilding, r: Rect): Side[] {
  return exteriorSidesOf(building, r) as Side[]
}

export function spanOnSide(r: Rect, side: Side): [number, number] {
  return spanOn(r, side) as [number, number]
}

export const unitBuildings = BUILDINGS
export const unitBuildingIds = BUILDING_IDS

export function unitBuildingOfSpace(spaceId: string): UnitBuilding | null {
  const meta = unitMetaOfSpace(spaceId) as UnitMeta | null
  if (!meta) return null
  return (unitBuilding(meta.buildingId) as UnitBuilding | null) || null
}

export function floorOfSpace(spaceId: string): number {
  return (unitMetaOfSpace(spaceId) as UnitMeta | null)?.floor ?? 1
}

export function isUnitBuilding(buildingId: string): boolean {
  return BUILDING_IDS.includes(buildingId)
}

/** 某个空间在楼层平面里的户型（真实矩形、开洞、阳台）。 */
export function unitPlanOfSpace(spaceId: string): UnitInfo | null {
  const meta = unitMetaOfSpace(spaceId) as UnitMeta | null
  if (!meta) return null
  return unitPlanAt(meta.buildingId, meta.floor, meta.index)
}

/**
 * 按楼栋 / 楼层 / 户号取户型。
 *
 * 户号会被夹到这一层实际的范围内：旧数据里可能还有 06 室，而调整过楼型之后
 * 这一层只剩 4 户。夹一下至少还能落到一间真实的房间里（墙、门、阳台都对），
 * 而不是退回 12.6 × 9.8 的假盒子——那种盒子里入户门位置是猜的，家具必然乱摆。
 */
export function unitPlanAt(buildingId: string, floor: number, index: number): UnitInfo | null {
  const building = unitBuilding(buildingId)
  if (!building) return null
  const count = unitCountOnFloor(building, floor)
  if (!count) return null
  return unitAtFloor(building, floor, Math.max(0, Math.min(count - 1, index)))
}

/** 这一层有多少户（首层是 0：整层都是门厅）。 */
function unitCountOnFloor(building: UnitBuilding, floor: number): number {
  return layoutOf(building, floor).units.length
}

/** 前端本地的户型样板：后端详情还没回来时，也能先把房间完整画出来。 */
let unitTemplates: Map<string, ReturnType<typeof buildUnitSpaces>[number]> | null = null

export function unitSpaceTemplate(spaceId: string) {
  if (!unitTemplates) {
    unitTemplates = new Map(buildUnitSpaces().map((space) => [space.id, space]))
  }
  return unitTemplates.get(spaceId) || null
}
