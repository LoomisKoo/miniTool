import { useSyncExternalStore } from 'react'
import type { Dialog } from './dialog'
import type { ReviewRow } from './engine'
import { ensureArtistFaces } from './portraits'
import type { GameState, RoomId } from './types'

const KEY = 'weiguang-save-v2'

export type Tab = 'home' | 'artists' | 'feed' | 'me'
export type Sheet =
  | { type: 'artist'; id: string }
  | { type: 'scout' }
  | { type: 'facility' }
  | { type: 'pickRoom'; room: RoomId }
  | { type: 'pickGig'; gigId: string }
  | { type: 'contact'; id: string }
  | null

export interface Confirm {
  title: string
  text?: string
  ok: string
  danger?: boolean
  onOk: () => void
}

export interface UI {
  screen: 'title' | 'game'
  tab: Tab
  sheet: Sheet
  dialogs: Dialog[]
  review: ReviewRow[] | null
  confirm: Confirm | null
  toast: { text: string; id: number } | null
}

let game: GameState | null = load()
const ui: UI = { screen: 'title', tab: 'home', sheet: null, dialogs: [], review: null, confirm: null, toast: null }
let version = 0
const listeners = new Set<() => void>()

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const g = JSON.parse(raw) as GameState
    ensureArtistFaces([...(g.artists ?? []), ...(g.candidates ?? [])])
    localStorage.setItem(KEY, JSON.stringify(g))
    return g
  } catch {
    return null
  }
}

function save() {
  if (game) localStorage.setItem(KEY, JSON.stringify(game))
  else localStorage.removeItem(KEY)
}

function emit() {
  version++
  listeners.forEach((l) => l())
}

export function useStore() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )
  return { g: game, ui }
}

export function setGame(g: GameState | null) {
  game = g
  save()
  emit()
}

export function act(fn: (g: GameState) => void) {
  if (!game) return
  fn(game)
  save()
  emit()
}

/** 改状态但不立刻刷新，用于合并多次更新避免闪烁 */
export function actSilent(fn: (g: GameState) => void) {
  if (!game) return
  fn(game)
  save()
}

export function setUI(fn: (u: UI) => void) {
  fn(ui)
  emit()
}

export function setUISilent(fn: (u: UI) => void) {
  fn(ui)
}

export const openSheet = (s: Sheet) => setUI((u) => (u.sheet = s))
export const closeSheet = () => setUI((u) => (u.sheet = null))
export const ask = (c: Confirm) => setUI((u) => (u.confirm = c))

export function pushDialogs(...d: Dialog[]) {
  ui.dialogs.push(...d)
  emit()
}

export function flush() {
  emit()
}

let seq = 0
export function toast(text: string) {
  const id = ++seq
  ui.toast = { text, id }
  emit()
  setTimeout(() => {
    if (ui.toast?.id === id) {
      ui.toast = null
      emit()
    }
  }, 2000)
}
