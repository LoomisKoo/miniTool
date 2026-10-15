import type { Artist, Gender, Temper } from './types'
import { hashStr } from './util'

/** 立绘资源 id（对应 public/portraits/idol-{id}.jpg / idol-{id}-av.jpg） */
export type FaceId =
  | 'f00' | 'f01' | 'f02' | 'f03' | 'f04' | 'f05' | 'f06' | 'f07'
  | 'm00' | 'm01' | 'm02' | 'm03' | 'm04' | 'm05'

const FEMALE: FaceId[] = ['f00', 'f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f07']
const MALE: FaceId[] = ['m00', 'm01', 'm02', 'm03', 'm04', 'm05']

const PREF_F: Record<Temper, FaceId[]> = {
  sunny: ['f02', 'f00', 'f07'],
  cool: ['f01', 'f06', 'f03'],
  drama: ['f04', 'f07', 'f02'],
  chill: ['f05', 'f00', 'f02'],
  fragile: ['f03', 'f00', 'f05'],
  ambitious: ['f06', 'f04', 'f01'],
}

const PREF_M: Record<Temper, FaceId[]> = {
  sunny: ['m02', 'm00', 'm03'],
  cool: ['m01', 'm05', 'm04'],
  drama: ['m03', 'm02', 'm00'],
  chill: ['m00', 'm04', 'm02'],
  fragile: ['m04', 'm00', 'm01'],
  ambitious: ['m05', 'm01', 'm03'],
}

function isFaceId(v: string | undefined): v is FaceId {
  return !!v && (FEMALE.includes(v as FaceId) || MALE.includes(v as FaceId))
}

function poolFor(gender: Gender, temper?: Temper): FaceId[] {
  const all = gender === 'f' ? FEMALE : MALE
  if (!temper) return all
  const pref = gender === 'f' ? PREF_F[temper] : PREF_M[temper]
  return [...pref, ...all.filter((x) => !pref.includes(x))]
}

/** 在公司/候选人中尽量分配不重复的立绘 */
export function allocFaceId(
  used: Set<string>,
  gender: Gender,
  temper: Temper | undefined,
  seed: string,
): FaceId {
  const ordered = poolFor(gender, temper)
  for (const id of ordered) {
    if (!used.has(id)) {
      used.add(id)
      return id
    }
  }
  // 池子用尽时允许重复
  const id = ordered[hashStr(seed) % ordered.length]
  used.add(id)
  return id
}

export function usedFaceIds(artists: Artist[]): Set<string> {
  const s = new Set<string>()
  for (const a of artists) if (a.faceId) s.add(a.faceId)
  return s
}

/** 给缺 faceId / 撞脸的旧存档补立绘，并尽量去重 */
export function ensureArtistFaces(list: Artist[]) {
  const used = new Set<string>()
  for (const a of list) {
    if (isFaceId(a.faceId) && !used.has(a.faceId)) {
      used.add(a.faceId)
      continue
    }
    a.faceId = allocFaceId(used, a.gender, a.temper, a.id + a.name)
  }
}

export function pickFaceId(seed: string, gender: Gender = 'f', temper?: Temper): FaceId {
  const ordered = poolFor(gender, temper)
  return ordered[hashStr(seed) % ordered.length]
}

export function resolveFaceId(seed: {
  seed: string
  gender?: Gender
  temper?: Temper
  faceId?: string
}): FaceId {
  if (isFaceId(seed.faceId)) return seed.faceId
  return pickFaceId(seed.seed, seed.gender ?? 'f', seed.temper)
}

export function avatarUrl(id: FaceId) {
  return `/portraits/idol-${id}-av.jpg`
}

export function bustUrl(id: FaceId) {
  return `/portraits/idol-${id}.jpg`
}

export const VN_BG = {
  day: '/portraits/vn-bg-day.jpg',
  night: '/portraits/vn-bg-night.jpg',
}

export const APP_BG = '/portraits/app-bg.jpg'
