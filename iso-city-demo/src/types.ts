export type User = {
  id: string
  name: string
  color: string
  isNpc?: boolean
  createdAt?: string
}

export type Place = {
  id: string
  name: string
  subtitle: string
  description: string
  kind: string
  x: number
  z: number
  postCount: number
}

export type Owner = { id: string; name: string; color: string }

export type FurnitureType =
  | 'sofa'
  | 'table'
  | 'chair'
  | 'shelf'
  | 'plant'
  | 'lamp'
  | 'rug'
  | 'desk'
  | 'bench'
  | 'pedestal'
  | 'speaker'
  | 'bed'
  | 'stool'
  | 'counter'

export type FurnitureItem = {
  id: string
  type: FurnitureType
  x: number
  z: number
  rot: number
  color: string
}

export type Art = { title: string; palette: string }

export type Space = {
  id: string
  name: string
  description: string
  building: string
  template: string
  wallColor: string
  floorColor: string
  art: Art
  layout: { items: FurnitureItem[] }
  ownerId: string | null
  owner: Owner | null
  isOpen: boolean
  visitCount: number
  postCount: number
  createdAt: string
  updatedAt: string
}

export type SpaceSummary = {
  id: string
  name: string
  building: string
  template: string
  ownerId: string | null
  owner: Owner | null
  isOpen: boolean
  visitCount: number
  postCount: number
}

export type Post = {
  id: string
  targetType: 'place' | 'space' | 'pet'
  targetId: string
  authorId: string
  author: Owner
  parentId: string | null
  kind: string
  body: string
  mediaKind: 'none' | 'image' | 'audio'
  mediaRef: string | null
  createdAt: string
  status?: string
}

export type Visit = {
  id: string
  createdAt: string
  user: Owner | null
}

export type WorldStats = {
  citizens: number
  spaces: number
  claimed: number
  messages: number
}

export type World = {
  places: Place[]
  spaces: SpaceSummary[]
  /** 已被领养、需要一直出现在城里的宠物 */
  pets: AdoptedPet[]
  stats: WorldStats
  user: User | null
  userClaimedSpaceId: string | null
}

export type PlaceDetail = {
  place: Place
  posts: Post[]
  favorite: { favorited: boolean; count: number }
}

export type SpaceDetail = {
  space: Space
  posts: Post[]
  visits: Visit[]
  favorite: { favorited: boolean; count: number }
  isOwner: boolean
  userClaimedSpaceId: string | null
}

/** 一只已经被领养的宠物：野生池按小时轮换，但领养记录会一直留在城里。 */
export type AdoptedPet = {
  id: string
  speciesId: string
  breedId: string
  /** 个体大小抖动，和野生时一致 */
  scale: number
  spot: { x: number; z: number; radius: number }
  nickname: string | null
  owner: Owner
  adoptedAt: string
  /** 最后一次吃饱的时间；饱腹度按时间差算，不存数值 */
  hungerAt?: string | null
}

export type PetDetail = { pet: AdoptedPet; notes: Post[] }

export type AdoptPetInput = {
  id: string
  speciesId: string
  breedId: string
  scale: number
  spot: { x: number; z: number; radius: number }
}

export type Favorite = {
  targetType: 'place' | 'space'
  targetId: string
  name: string
  createdAt: string
}

export type InteriorRef =
  | { kind: 'public'; id: 'gallery' | 'cafe' }
  | { kind: 'space'; id: string }
  | { kind: 'building'; id: string; floor?: number; core?: number; from?: string }

export type NearbyInfo = {
  id: string
  label: string
  hint: string
  action: () => void
}

export type EditorDraft = {
  name: string
  description: string
  template: string
  wallColor: string
  floorColor: string
  art: Art
  layout: { items: FurnitureItem[] }
  isOpen: boolean
}
