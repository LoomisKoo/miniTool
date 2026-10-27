import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { artPalettes, furnitureTypes, mediaRefs, templates } from './seed.mjs'

const MAX_BODY = 300
const HEX = /^#[0-9a-fA-F]{6}$/
const ID = /^[a-zA-Z0-9_-]{1,48}$/

const json = (status, body, extraHeaders = {}) => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders },
  body: JSON.stringify(body),
})

const text = (status, body, contentType = 'text/plain; charset=utf-8') => ({
  status,
  headers: { 'content-type': contentType, 'cache-control': 'no-store' },
  body,
})

const clean = (value, max) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim()
    .slice(0, max)

function validPostMedia(kind, ref) {
  if (kind === 'none' || !kind) return { kind: 'none', ref: null }
  if (kind === 'image' && mediaRefs.image.includes(ref)) return { kind, ref }
  if (kind === 'audio' && mediaRefs.audio.includes(ref)) return { kind, ref }
  return null
}

function validateArt(input) {
  if (!input || typeof input !== 'object') return null
  const title = clean(input.title, 40)
  const palette = String(input.palette || '')
  if (!title || !artPalettes.includes(palette)) return null
  return { title, palette }
}

function validateLayout(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.items)) return null
  if (input.items.length > 16) return null
  const items = []
  const seen = new Set()
  for (const raw of input.items) {
    if (!raw || typeof raw !== 'object') return null
    const type = String(raw.type || '')
    if (!furnitureTypes.includes(type)) return null
    const x = Number(raw.x)
    const z = Number(raw.z)
    const rot = Number(raw.rot)
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(rot)) return null
    if (x < -5.9 || x > 5.9 || z < -3.9 || z > 3.9) return null
    const color = String(raw.color || '')
    if (!HEX.test(color)) return null
    let id = clean(raw.id, 48)
    if (!id || !ID.test(id) || seen.has(id)) id = randomUUID()
    seen.add(id)
    const normalized = ((rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    items.push({
      id,
      type,
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      rot: Math.round(normalized * 1000) / 1000,
      color,
    })
  }
  return { items }
}

/** 领养时客户端提交的宠物档案只做形状校验：野生池本来就是公开推导的。 */
function validatePetRecord(input) {
  if (!input || typeof input !== 'object') return null
  const id = String(input.id || '')
  const speciesId = String(input.speciesId || '')
  const breedId = String(input.breedId || '')
  if (!ID.test(id) || !/^[a-z]{1,24}$/.test(speciesId) || !/^[a-z0-9-]{1,32}$/i.test(breedId)) return null
  const scale = Number(input.scale)
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 1.5) return null
  const x = Number(input.spot?.x)
  const z = Number(input.spot?.z)
  const radius = Number(input.spot?.radius)
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 600 || Math.abs(z) > 600) return null
  if (!Number.isFinite(radius) || radius < 0.4 || radius > 12) return null
  return {
    id,
    speciesId,
    breedId,
    scale: Math.round(scale * 1000) / 1000,
    spot: {
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      radius: Math.round(radius * 100) / 100,
    },
  }
}

function validateSpacePatch(body) {
  const patch = {}
  if (body.name !== undefined) {
    const name = clean(body.name, 40)
    if (!name) return { error: '空间名称不能为空' }
    patch.name = name
  }
  if (body.description !== undefined) {
    const description = clean(body.description, 200)
    if (!description) return { error: '简介不能为空' }
    patch.description = description
  }
  if (body.template !== undefined) {
    if (!templates.includes(body.template)) return { error: '未知的用途模板' }
    patch.template = body.template
  }
  if (body.wallColor !== undefined) {
    if (!HEX.test(String(body.wallColor))) return { error: '墙面颜色格式不正确' }
    patch.wallColor = body.wallColor
  }
  if (body.floorColor !== undefined) {
    if (!HEX.test(String(body.floorColor))) return { error: '地面颜色格式不正确' }
    patch.floorColor = body.floorColor
  }
  if (body.art !== undefined) {
    const art = validateArt(body.art)
    if (!art) return { error: '画作信息不完整' }
    patch.art = art
  }
  if (body.layout !== undefined) {
    const layout = validateLayout(body.layout)
    if (!layout) return { error: '房间布置数据不正确（最多 16 件家具）' }
    patch.layout = layout
  }
  if (body.isOpen !== undefined) patch.isOpen = Boolean(body.isOpen)
  if (!Object.keys(patch).length) return { error: '没有可保存的修改' }
  return { patch }
}

export function createApi({ store, authSecret, appUrl = '', storage = 'json', logger = console }) {
  const buckets = new Map()

  function limit(key, max, windowMs) {
    const now = Date.now()
    const bucket = buckets.get(key)
    if (!bucket || now - bucket.start > windowMs) {
      buckets.set(key, { start: now, count: 1 })
      return true
    }
    bucket.count += 1
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k)
    }
    return bucket.count <= max
  }

  const hashToken = (token) => createHmac('sha256', authSecret).update(token).digest('hex')

  function publicUser(user) {
    if (!user) return null
    return {
      id: user.id,
      name: user.name,
      color: user.color,
      isNpc: !!user.isNpc,
      createdAt: user.createdAt,
    }
  }

  async function auth(req) {
    const raw = req.headers?.authorization || req.headers?.Authorization || ''
    const token = String(raw).replace(/^Bearer\s+/i, '').trim()
    if (!token || token.length > 200) return { user: null, token: null }
    const user = await store.getUserByTokenHash(hashToken(token))
    return { user, token }
  }

  async function requireTarget(type, id) {
    if (type === 'place') return store.getPlace(id)
    if (type === 'space') return store.getSpace(id)
    if (type === 'pet') return store.getPet(id)
    return null
  }

  async function handle(req) {
    const method = String(req.method || 'GET').toUpperCase()
    const path = String(req.path || '/').replace(/\/+$/, '') || '/'
    const query = req.query || {}
    const ip = req.ip || 'unknown'

    if (method === 'OPTIONS') return { status: 204, headers: {}, body: '' }

    if (path === '/api/health' && method === 'GET') {
      return json(200, { ok: true, service: 'lumen-district', storage, time: new Date().toISOString() })
    }

    // ---------- identity ----------

    if (path === '/api/session' && method === 'POST') {
      if (!limit(`session:${ip}`, 20, 60_000)) return json(429, { error: '请稍后再试' })
      const body = req.body || {}
      const user = await store.createGuest(clean(body.name, 16) || undefined)
      const token = randomBytes(32).toString('base64url')
      await store.setTokenHash(user.id, hashToken(token))
      return json(201, { token, user: publicUser(user) })
    }

    const { user } = await auth(req)
    const claimedSpace = user ? (await store.listSpaces()).find((s) => s.ownerId === user.id) || null : null

    if (path === '/api/me' && method === 'GET') {
      if (!user) return json(401, { error: '访客身份已失效，请刷新页面重新进入' })
      return json(200, {
        user: publicUser(user),
        claimedSpace: claimedSpace ? { id: claimedSpace.id, name: claimedSpace.name } : null,
      })
    }

    if (path === '/api/me' && method === 'PATCH') {
      if (!user) return json(401, { error: '访客身份已失效' })
      const name = clean(req.body?.name, 16)
      if (name.length < 1) return json(400, { error: '昵称不能为空' })
      if (!limit(`rename:${user.id}`, 6, 60_000)) return json(429, { error: '修改太频繁，请稍后再试' })
      const updated = await store.renameUser(user.id, name)
      return json(200, { user: publicUser(updated) })
    }

    // ---------- world ----------

    if (path === '/api/world' && method === 'GET') {
      const [places, spaces, pets, stats] = await Promise.all([
        store.listPlaces(),
        store.listSpaces(),
        store.listPets(),
        store.stats(),
      ])
      // 楼内户现在有近千间，完整 layout 会让首屏响应变成几 MB。
      // 世界列表只带“门口需要知道的信息”，房间详情仍走 /api/spaces/:id。
      const spaceSummaries = spaces.map((space) => ({
        id: space.id,
        name: space.name,
        building: space.building,
        template: space.template,
        ownerId: space.ownerId,
        owner: space.owner,
        isOpen: space.isOpen,
        visitCount: space.visitCount,
        postCount: space.postCount,
      }))
      return json(200, {
        places,
        spaces: spaceSummaries,
        pets,
        stats,
        user: publicUser(user),
        userClaimedSpaceId: claimedSpace?.id || null,
      })
    }

    const placeMatch = path.match(/^\/api\/places\/([a-zA-Z0-9_-]+)$/)
    if (placeMatch && method === 'GET') {
      const place = await store.getPlace(placeMatch[1])
      if (!place) return json(404, { error: '地点不存在' })
      const [posts, favoriteCount] = await Promise.all([
        store.listPosts('place', place.id),
        store.favoriteCount('place', place.id),
      ])
      const favorited = user ? await store.isFavorite(user.id, 'place', place.id) : false
      return json(200, { place, posts, favorite: { favorited, count: favoriteCount } })
    }

    if (path === '/api/spaces' && method === 'GET') {
      return json(200, { spaces: await store.listSpaces() })
    }

    const spaceMatch = path.match(/^\/api\/spaces\/([a-zA-Z0-9_-]+)$/)
    if (spaceMatch && method === 'GET') {
      const space = await store.getSpace(spaceMatch[1])
      if (!space) return json(404, { error: '空间不存在' })
      if (!space.isOpen && space.ownerId !== user?.id) {
        return json(403, { error: '这间空间暂未开放，等主人打开门再来吧' })
      }
      const [posts, favoriteCount] = await Promise.all([
        store.listPosts('space', space.id),
        store.favoriteCount('space', space.id),
      ])
      const favorited = user ? await store.isFavorite(user.id, 'space', space.id) : false
      const isOwner = user?.id === space.ownerId
      const visits = isOwner ? await store.listVisits(space.id) : []
      return json(200, {
        space,
        posts,
        visits,
        favorite: { favorited, count: favoriteCount },
        isOwner,
        userClaimedSpaceId: claimedSpace?.id || null,
      })
    }

    const claimMatch = path.match(/^\/api\/spaces\/([a-zA-Z0-9_-]+)\/claim$/)
    if (claimMatch && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      if (!limit(`claim:${user.id}`, 8, 60_000)) return json(429, { error: '操作太频繁，请稍后再试' })
      const result = await store.claimSpace(claimMatch[1], user.id)
      if (result.error === 'not_found') return json(404, { error: '空间不存在' })
      if (result.error === 'taken') return json(409, { error: '晚了一步，这间空间刚刚被其他访客认领了' })
      if (result.error === 'already_claimed') {
        return json(409, {
          error: '每人同时只能认领一间空间，请先放弃当前空间',
          spaceId: result.spaceId,
        })
      }
      if (result.error === 'already_yours') return json(200, { space: result.space, already: true })
      return json(200, { space: result.space })
    }

    const releaseMatch = path.match(/^\/api\/spaces\/([a-zA-Z0-9_-]+)\/release$/)
    if (releaseMatch && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      const result = await store.releaseSpace(releaseMatch[1], user.id)
      if (result.error === 'not_found') return json(404, { error: '空间不存在' })
      if (result.error === 'forbidden') return json(403, { error: '这不是你的空间' })
      return json(200, { space: result.space })
    }

    if (spaceMatch && method === 'PUT') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      const body = req.body || {}
      const { patch, error } = validateSpacePatch(body)
      if (error) return json(400, { error })
      if (!limit(`save:${user.id}`, 30, 60_000)) return json(429, { error: '保存太频繁，请稍后再试' })
      const result = await store.updateSpace(spaceMatch[1], user.id, patch)
      if (result.error === 'not_found') return json(404, { error: '空间不存在' })
      if (result.error === 'forbidden') return json(403, { error: '只有空间主人可以布置这里' })
      return json(200, { space: result.space })
    }

    const visitMatch = path.match(/^\/api\/spaces\/([a-zA-Z0-9_-]+)\/visit$/)
    if (visitMatch && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      const result = await store.recordVisit(visitMatch[1], user.id)
      if (result.error === 'not_found') return json(404, { error: '空间不存在' })
      return json(200, result)
    }

    const visitsMatch = path.match(/^\/api\/spaces\/([a-zA-Z0-9_-]+)\/visits$/)
    if (visitsMatch && method === 'GET') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      const space = await store.getSpace(visitsMatch[1])
      if (!space) return json(404, { error: '空间不存在' })
      if (space.ownerId !== user.id) return json(403, { error: '只有空间主人可以查看完整访问记录' })
      return json(200, { visits: await store.listVisits(space.id) })
    }

    // ---------- pets ----------

    if (path === '/api/pets' && method === 'GET') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      const [mine, all] = await Promise.all([store.listPetsByOwner(user.id), store.listPets()])
      // wildTaken 供客户端过滤野生池：今天已经被领走的 id
      const today = new Date().toISOString().slice(0, 10)
      const wildTaken = all
        .filter((pet) => String(pet.adoptedAt || '').slice(0, 10) === today)
        .map((pet) => pet.id)
      return json(200, { mine: mine[0] || null, wildTaken, rations: user.rations ?? 0 })
    }

    if (path === '/api/pets/adopt' && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      if (!limit(`adopt:${user.id}`, 10, 60_000)) return json(429, { error: '操作太频繁，请稍后再试' })
      const record = validatePetRecord(req.body)
      if (!record) return json(400, { error: '宠物信息不完整' })
      const result = await store.adoptPet(record, user.id)
      if (result.error === 'not_found') return json(404, { error: '这只宠物已经不在城里了' })
      if (result.error === 'limit') return json(409, { error: '每位访客只能领养一只宠物', code: 'pet_limit' })
      if (result.error === 'taken') {
        return json(409, {
          error: `它刚被 @${result.ownerName} 带走了`,
          ownerName: result.ownerName,
        })
      }
      return json(201, { pet: result.pet })
    }

    if (path === '/api/pets/feed' && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      if (!limit(`feed:${user.id}`, 20, 60_000)) return json(429, { error: '喂得太频繁了，稍等一下' })
      const petId = String(req.body?.id || '')
      if (!ID.test(petId)) return json(400, { error: '宠物 id 不正确' })
      const result = await store.feedPet(petId, user.id)
      if (result.error === 'not_found') return json(404, { error: '宠物不存在' })
      if (result.error === 'no_rations') return json(402, { error: '口粮不够了，明天再来吧' })
      return json(200, { pet: result.pet, rations: result.rations })
    }

    if (path === '/api/pets/rename' && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      const petId = String(req.body?.id || '')
      const nickname = clean(req.body?.name, 12)
      if (!ID.test(petId)) return json(400, { error: '宠物 id 不正确' })
      if (nickname.length < 1) return json(400, { error: '名字不能为空' })
      if (!limit(`petname:${user.id}`, 6, 60_000)) return json(429, { error: '改名太频繁，请稍后再试' })
      const result = await store.renamePet(petId, user.id, nickname)
      if (result.error === 'not_found') return json(404, { error: '宠物不存在' })
      if (result.error === 'forbidden') return json(403, { error: '只能给自己的宠物改名' })
      return json(200, { pet: result.pet })
    }

    const petMatch = path.match(/^\/api\/pets\/([a-zA-Z0-9_-]+)$/)
    if (petMatch && method === 'GET') {
      const pet = await store.getPet(petMatch[1])
      if (!pet) return json(404, { error: '宠物不存在' })
      const [notes, favorited, favoriteCount] = await Promise.all([
        store.listPosts('pet', pet.id, 20),
        user ? store.isFavorite(user.id, 'pet', pet.id) : false,
        store.favoriteCount('pet', pet.id),
      ])
      return json(200, { pet, notes, favorite: { favorited, count: favoriteCount } })
    }

    // ---------- rations ----------

    if (path === '/api/rations/claim' && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      if (!limit(`rations:${user.id}`, 6, 60_000)) return json(429, { error: '稍后再试' })
      const result = await store.claimRations(user.id)
      if (result.error === 'no_user') return json(401, { error: '访客身份已失效' })
      return json(200, { rations: result.rations, granted: result.granted })
    }

    // ---------- posts ----------

    if (path === '/api/posts' && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      if (!limit(`post:${user.id}`, 10, 60_000)) return json(429, { error: '留言太频繁，请稍后再试' })
      const body = req.body || {}
      const targetType = String(body.targetType || '')
      const targetId = String(body.targetId || '')
      if (!['place', 'space', 'pet'].includes(targetType) || !ID.test(targetId)) {
        return json(400, { error: '留言目标不正确' })
      }
      const message = clean(body.body, MAX_BODY)
      if (message.length < 1) return json(400, { error: '写点什么再发布吧' })
      const media = validPostMedia(body.mediaKind, body.mediaRef)
      if (!media) return json(400, { error: '媒体附件不正确' })
      const target = await requireTarget(targetType, targetId)
      if (!target) return json(404, { error: '目标不存在' })
      if (targetType === 'space' && !target.isOpen && target.ownerId !== user.id) {
        return json(403, { error: '这间空间暂未开放' })
      }
      // 宠物留言要先喂过它：留言是「照顾过它」的凭证；主人自己例外。
      if (targetType === 'pet') {
        const pet = await store.getPet(targetId)
        const isOwner = pet?.owner?.id === user.id
        if (!isOwner && !(await store.hasFedPet(targetId, user.id))) {
          return json(403, { error: '先喂它一顿再留言吧' })
        }
      }
      let parentId = null
      if (body.parentId) {
        const parent = await store.getPost(String(body.parentId))
        if (!parent || parent.targetType !== targetType || parent.targetId !== targetId) {
          return json(400, { error: '回复的留言不存在' })
        }
        if (parent.parentId) return json(400, { error: '只能回复主留言' })
        parentId = parent.id
      }
      const post = await store.createPost({
        targetType,
        targetId,
        authorId: user.id,
        parentId,
        body: message,
        mediaKind: media.kind,
        mediaRef: media.ref,
      })
      return json(201, { post })
    }

    const postMatch = path.match(/^\/api\/posts\/([a-zA-Z0-9_-]+)$/)
    if (postMatch && method === 'DELETE') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      const result = await store.deletePost(postMatch[1], user)
      if (result.error === 'not_found') return json(404, { error: '留言不存在或已删除' })
      if (result.error === 'forbidden') return json(403, { error: '只能删除自己发布的内容' })
      return json(200, { ok: true })
    }

    const reportMatch = path.match(/^\/api\/posts\/([a-zA-Z0-9_-]+)\/report$/)
    if (reportMatch && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      if (!limit(`report:${user.id}`, 12, 60_000)) return json(429, { error: '操作太频繁' })
      const reason = clean(req.body?.reason, 80) || '不适当内容'
      const result = await store.reportPost(reportMatch[1], user.id, reason)
      if (result.error === 'not_found') return json(404, { error: '留言不存在' })
      return json(200, result)
    }

    // ---------- favorites ----------

    if (path === '/api/favorites' && method === 'GET') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      return json(200, { favorites: await store.listFavorites(user.id) })
    }

    if (path === '/api/favorites' && method === 'POST') {
      if (!user) return json(401, { error: '请先获得访客身份' })
      const targetType = String(req.body?.targetType || '')
      const targetId = String(req.body?.targetId || '')
      if (!['place', 'space', 'pet'].includes(targetType) || !ID.test(targetId)) {
        return json(400, { error: '收藏目标不正确' })
      }
      const target = await requireTarget(targetType, targetId)
      if (!target) return json(404, { error: '目标不存在' })
      if (targetType === 'space' && !target.isOpen && target.ownerId !== user.id) {
        return json(403, { error: '这间空间暂未开放' })
      }
      const result = await store.toggleFavorite(user.id, targetType, targetId)
      return json(200, result)
    }

    // ---------- share ----------

    const shareMatch = path.match(/^\/api\/share\/(place|space)\/([a-zA-Z0-9_-]+)$/)
    if (shareMatch && method === 'GET') {
      const [, type, id] = shareMatch
      const target = await requireTarget(type, id)
      if (!target) return json(404, { error: '目标不存在' })
      if (type === 'space' && !target.isOpen && target.ownerId !== user?.id) {
        return json(403, { error: '这间空间暂未开放' })
      }
      const base = appUrl || ''
      const suffix = type === 'space' ? `space=${encodeURIComponent(id)}&enter=1` : `place=${encodeURIComponent(id)}`
      const url = `${base}${base.includes('?') ? '&' : '?'}${suffix}`
      return json(200, {
        type,
        id,
        title: type === 'space' ? `${target.name} · 个人空间` : target.name,
        description: target.description,
        subtitle: type === 'space' ? target.building : target.subtitle,
        owner: type === 'space' ? target.owner?.name || '未认领' : null,
        url,
      })
    }

    if (path.startsWith('/api/')) return json(404, { error: '接口不存在' })
    return text(404, 'Not found')
  }

  return async function handler(req) {
    try {
      return await handle(req)
    } catch (error) {
      logger.error?.('[lumen-api]', error)
      return json(500, { error: '城市服务暂时不可用，请稍后再试' })
    }
  }
}

export { validateLayout, validateSpacePatch }
