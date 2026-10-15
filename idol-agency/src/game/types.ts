export type Temper = 'sunny' | 'cool' | 'drama' | 'chill' | 'fragile' | 'ambitious'
export type SkillKey = 'vocal' | 'dance' | 'acting' | 'variety' | 'image'
export type RoomId = 'vocal' | 'dance' | 'acting' | 'variety' | 'live' | 'rest'
export type Phase = 0 | 1 | 2 | 3
export type Gender = 'm' | 'f'

export interface Artist {
  id: string
  name: string
  gender: Gender
  /** 立绘资源 id，公司内尽量不重复 */
  faceId?: string
  age: number
  origin: string
  temper: Temper
  traits: string[]
  looks: number
  skills: Record<SkillKey, number>
  talent: Record<SkillKey, number>
  rank: number
  favor: number
  stress: number
  discontent: number
  mood: number
  stamina: number
  fans: number
  room: RoomId
  joinedDay: number
  interactedDay: number
  topStreak: number
  lastScore: number
  memory: { tag: string; day: number }[]
  bubble: Bubble | null
  rival: string | null
  secret: string | null
  secretKnown: boolean
  status: 'ok' | 'sick' | 'suspended'
  statusUntil: number
}

export type BubbleKind = 'lazy' | 'emo' | 'quarrel' | 'ask' | 'gossip' | 'practice'
export interface Bubble {
  kind: BubbleKind
  other?: string
}

export interface Contact {
  id: string
  favor: number
  met: boolean
  beat: number
  lastSeen: number
  presentTonight: boolean
}

export interface Gig {
  id: string
  title: string
  kind: string
  budget: number
  minRank: number
  likes: SkillKey
  quirk: string
  fansBase: number
  artistId: string | null
}

export interface LogEntry {
  day: number
  phase: Phase
  text: string
  tone?: 'good' | 'bad' | 'info'
}

export interface Owner {
  name: string
  age: number
  look: string
  style: string
  origin: string
}

export interface Stats {
  harsh: number
  kind: number
  firm: number
  scheme: number
}

export interface GameState {
  version: number
  owner: Owner
  day: number
  phase: Phase
  money: number
  debt: number
  fame: number
  morale: number
  risk: number
  strategy: 1 | 2 | 3
  artists: Artist[]
  contacts: Contact[]
  gigs: Gig[]
  candidates: Artist[]
  candidatesDay: number
  facilities: Record<string, number>
  log: LogEntry[]
  stats: Stats
  flags: Record<string, number>
  topStar: string | null
  nightDone: boolean
  idSeq: number
}
