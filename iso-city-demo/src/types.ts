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

export type Post = {
  id: string
  targetType: 'place' | 'space'
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
  spaces: Space[]
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

export type Favorite = {
  targetType: 'place' | 'space'
  targetId: string
  name: string
  createdAt: string
}

export type InteriorRef =
  | { kind: 'public'; id: 'gallery' | 'cafe' }
  | { kind: 'space'; id: string }

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
