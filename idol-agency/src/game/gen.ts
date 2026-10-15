import { F_NAMES, M_NAMES, ORIGINS, SECRETS, SURNAMES, TEMPERS, TRAITS } from './data/base'
import type { Dialog } from './dialog'
import { allocFaceId, usedFaceIds } from './portraits'
import type { Artist, GameState, Gender, SkillKey, Temper } from './types'
import { chance, clamp, pick, rand, randInt, shuffle } from './util'

const SKILLS: SkillKey[] = ['vocal', 'dance', 'acting', 'variety', 'image']
const TEMPER_LIST = Object.keys(TEMPERS) as Temper[]

const TEMPER_TALENT: Record<Temper, Partial<Record<SkillKey, number>>> = {
  sunny: { variety: 1.15 },
  cool: { vocal: 1.25, dance: 1.2, image: 1.15, variety: 0.85 },
  drama: { variety: 1.3, acting: 1.2 },
  chill: {},
  fragile: { vocal: 1.2, acting: 1.15, variety: 0.85 },
  ambitious: { dance: 1.1, image: 1.1, variety: 1.1 },
}

const CONFLICT: [string, string][] = [
  ['grind', 'slacker'],
  ['shy', 'sweet'],
  ['shy', 'meme'],
  ['dancer', 'stiff'],
]

export function generateArtist(g: GameState, opts: { quality?: number; gender?: Gender } = {}): Artist {
  const q = opts.quality ?? 1
  const gender = opts.gender ?? (chance(0.5) ? 'f' : 'm')
  const usedNames = new Set(g.artists.concat(g.candidates).map((x) => x.name))
  let name = ''
  for (let i = 0; i < 20; i++) {
    name = pick(SURNAMES) + pick(gender === 'f' ? F_NAMES : M_NAMES)
    if (!usedNames.has(name)) break
  }
  const temper = pick(TEMPER_LIST)
  const traits: string[] = []
  const want = randInt(2, 3)
  for (const t of shuffle(Object.keys(TRAITS))) {
    if (traits.length >= want) break
    if (CONFLICT.some(([a, b]) => (t === a && traits.includes(b)) || (t === b && traits.includes(a)))) continue
    traits.push(t)
  }
  const origin = pick(ORIGINS)
  const talent = {} as Record<SkillKey, number>
  const skills = {} as Record<SkillKey, number>
  for (const k of SKILLS) {
    let t = rand(0.7, 1.3) * q
    t *= TEMPER_TALENT[temper][k] ?? 1
    t *= origin.mod[k] ?? 1
    for (const tr of traits) t *= TRAITS[tr].mod?.[k] ?? 1
    talent[k] = Math.round(t * 100) / 100
    skills[k] = Math.round(clamp(rand(2, 14) * t, 0, 40))
  }
  g.idSeq += 1
  const id = 'a' + g.idSeq
  const faces = usedFaceIds(g.artists.concat(g.candidates))
  const faceId = allocFaceId(faces, gender, temper, id + name)
  return {
    id,
    name,
    gender,
    faceId,
    age: randInt(16, 23),
    origin: origin.text,
    temper,
    traits,
    looks: Math.round(clamp(rand(40, 88) * (0.85 + q * 0.15))),
    skills,
    talent,
    rank: 0,
    favor: temper === 'cool' ? randInt(5, 20) : randInt(15, 35),
    stress: randInt(10, 30),
    discontent: temper === 'cool' || temper === 'ambitious' ? randInt(5, 18) : randInt(0, 10),
    mood: randInt(45, 75),
    stamina: randInt(65, 100),
    fans: Math.round(rand(0.02, 0.4) * 100) / 100,
    room: 'vocal',
    joinedDay: g.day,
    interactedDay: -1,
    topStreak: 0,
    lastScore: 0,
    memory: [],
    bubble: null,
    rival: null,
    secret: chance(0.6) ? pick(SECRETS) : null,
    secretKnown: false,
    status: 'ok',
    statusUntil: 0,
  }
}

export function signCost(a: Artist) {
  const t = Object.values(a.talent).reduce((x, y) => x + y, 0) / 5
  const sk = Object.values(a.skills).reduce((x, y) => x + y, 0) / 5
  return Math.max(10, Math.round((a.looks * 0.5 + t * 30 + sk) / 4))
}

export function portraitOf(a: Artist) {
  const t = TEMPERS[a.temper]
  return {
    char: a.name.slice(1, 2),
    color: t.color,
    color2: t.color2,
    seed: a.id + a.name,
    gender: a.gender,
    temper: a.temper,
    faceId: a.faceId,
  }
}

export function speak(a: Artist, text: string, options: Dialog['options']): Dialog {
  return { speaker: a.name, sub: `${TEMPERS[a.temper].name} · ${a.gender === 'f' ? '女' : '男'}`, portrait: portraitOf(a), text, options }
}
