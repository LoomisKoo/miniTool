import type { Favorite, PlaceDetail, Space, SpaceDetail, World } from './types'

const BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const TOKEN_KEY = 'lumen.guest.token'

export class ApiError extends Error {
  status: number
  data: Record<string, unknown>
  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.data = data
  }
}

let token = ''
try {
  token = localStorage.getItem(TOKEN_KEY) || ''
} catch {
  token = ''
}

export function setToken(next: string) {
  token = next
  try {
    localStorage.setItem(TOKEN_KEY, next)
  } catch {
    /* private mode */
  }
}

export function clearToken() {
  token = ''
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function getToken() {
  return token
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('无法连接城市服务。请确认 npm run dev 中的 API 已启动。', 0)
  }

  const raw = await response.text()
  let data: Record<string, unknown> = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { error: raw.slice(0, 200) }
  }
  if (!response.ok) {
    throw new ApiError(String(data.error || `请求失败 (${response.status})`), response.status, data)
  }
  return data as T
}

export const api = {
  health: () => request<{ ok: boolean; storage: string }>('/api/health', { auth: false }),
  createSession: (name?: string) =>
    request<{ token: string; user: { id: string; name: string; color: string } }>('/api/session', {
      method: 'POST',
      auth: false,
      body: name ? { name } : {},
    }),
  me: () =>
    request<{ user: { id: string; name: string; color: string }; claimedSpace: { id: string; name: string } | null }>(
      '/api/me',
    ),
  rename: (name: string) =>
    request<{ user: { id: string; name: string; color: string } }>('/api/me', {
      method: 'PATCH',
      body: { name },
    }),
  world: () => request<World>('/api/world'),
  place: (id: string) => request<PlaceDetail>(`/api/places/${encodeURIComponent(id)}`),
  space: (id: string) => request<SpaceDetail>(`/api/spaces/${encodeURIComponent(id)}`),
  claim: (id: string) =>
    request<{ space: Space }>(`/api/spaces/${encodeURIComponent(id)}/claim`, { method: 'POST' }),
  release: (id: string) =>
    request<{ space: Space }>(`/api/spaces/${encodeURIComponent(id)}/release`, { method: 'POST' }),
  updateSpace: (id: string, patch: Record<string, unknown>) =>
    request<{ space: Space }>(`/api/spaces/${encodeURIComponent(id)}`, { method: 'PUT', body: patch }),
  visit: (id: string) =>
    request<{ count: number; already: boolean }>(`/api/spaces/${encodeURIComponent(id)}/visit`, {
      method: 'POST',
    }),
  visits: (id: string) =>
    request<{ visits: SpaceDetail['visits'] }>(`/api/spaces/${encodeURIComponent(id)}/visits`),
  createPost: (input: {
    targetType: 'place' | 'space'
    targetId: string
    body: string
    parentId?: string | null
    mediaKind?: string
    mediaRef?: string | null
  }) => request<{ post: SpaceDetail['posts'][number] }>('/api/posts', { method: 'POST', body: input }),
  deletePost: (id: string) =>
    request<{ ok: boolean }>(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  reportPost: (id: string, reason: string) =>
    request<{ ok: boolean; hidden?: boolean }>(`/api/posts/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      body: { reason },
    }),
  toggleFavorite: (targetType: 'place' | 'space', targetId: string) =>
    request<{ favorited: boolean; count: number }>('/api/favorites', {
      method: 'POST',
      body: { targetType, targetId },
    }),
  favorites: () => request<{ favorites: Favorite[] }>('/api/favorites'),
}
