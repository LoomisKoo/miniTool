import type { Artist, GameState, LogEntry } from './types'

export function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v))
export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1))
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
export const chance = (p: number) => Math.random() < p
export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function addLog(g: GameState, text: string, tone?: LogEntry['tone']) {
  g.log.unshift({ day: g.day, phase: g.phase, text, tone })
  if (g.log.length > 200) g.log.length = 200
}

export function byId(g: GameState, id: string | null | undefined) {
  return g.artists.find((x) => x.id === id)
}

export function has(a: Artist, trait: string) {
  return a.traits.includes(trait)
}

export function remember(a: Artist, tag: string, day: number) {
  a.memory.unshift({ tag, day })
  if (a.memory.length > 12) a.memory.length = 12
}

export function recent(a: Artist, tag: string, day: number, within: number) {
  return a.memory.some((m) => m.tag === tag && day - m.day <= within)
}

/** 关系好坏：决定台词走 good 还是 bad 池 */
export function isGood(a: Artist) {
  return a.favor - a.discontent * 0.8 >= 25
}

export interface Change {
  favor?: number
  stress?: number
  discontent?: number
  mood?: number
  stamina?: number
}

export function change(a: Artist, c: Change) {
  for (const k of Object.keys(c) as (keyof Change)[]) {
    let v = c[k] ?? 0
    if (k === 'discontent' && v > 0 && has(a, 'grudge')) v *= 1.6
    if (k === 'mood' && v < 0 && a.temper === 'fragile') v *= 1.5
    if (k === 'mood' && v < 0 && a.temper === 'sunny') v *= 0.7
    if (k === 'favor' && v > 0 && has(a, 'loyal')) v *= 1.3
    a[k] = clamp(a[k] + v)
  }
}

export function avgSkill(a: Artist) {
  const s = a.skills
  return (s.vocal + s.dance + s.acting + s.variety + s.image) / 5
}

export function capacity(g: GameState) {
  return 6 + (g.facilities.dorm ?? 0) * 3
}

export const ta = (a: Artist) => (a.gender === 'm' ? '他' : '她')
