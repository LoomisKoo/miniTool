import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { buildUnitSpaces, isUnitSpaceId, UNIT_SEED_VERSION } from '../../shared/units.mjs'
import { npcUsers, places as seedPlaces, posts as seedPosts, seededVisits, spaces as seedSpaces } from '../seed.mjs'

const COLORS = ['#4f7f74', '#c4774c', '#7a6b98', '#a9853f', '#58758c', '#9b6b73']

// 楼内户的样板数据按需取：即使数据库是旧版本、或启动后新加了一栋楼，
// 打开某个具体户型时也能即时补出来，而不是回一个 404 让玩家站在空房间里。
let unitTemplates = null
function unitTemplate(id) {
  if (!unitTemplates) unitTemplates = new Map(buildUnitSpaces().map((space) => [space.id, space]))
  return unitTemplates.get(id) || null
}

function seedData() {
  const users = npcUsers.map((u) => ({
    id: u.id,
    name: u.name,
    color: u.color,
    tokenHash: null,
    accountId: null,
    isNpc: true,
    createdAt: new Date().toISOString(),
  }))
  const visitCounts = new Map()
  for (const v of seededVisits) visitCounts.set(v.spaceId, (visitCounts.get(v.spaceId) || 0) + 1)

  return {
    meta: { seedVersion: 1, createdAt: new Date().toISOString() },
    users,
    places: seedPlaces.map((p) => ({ ...p })),
    spaces: seedSpaces.map((s) => ({
      ...s,
      art: { ...s.art },
      layout: { items: s.layout.items.map((i) => ({ ...i })) },
      visitCount: visitCounts.get(s.id) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    posts: seedPosts.map((p) => ({
      ...p,
      kind: 'message',
      parentId: p.parentId || null,
      status: 'visible',
      deletedAt: null,
    })),
    favorites: [],
    visits: seededVisits.map((v) => ({ id: randomUUID(), ...v, note: null })),
    reports: [],
    pets: [],
  }
}

export class JsonStore {
  constructor(file) {
    this.file = file
    this.data = null
    this.queue = Promise.resolve()
  }

  async init() {
    await mkdir(dirname(this.file), { recursive: true })
    try {
      this.data = JSON.parse(await readFile(this.file, 'utf8'))
    } catch {
      this.data = seedData()
      await this.#flush()
    }
    // 旧数据库没有 pets 字段：补一个空数组，不用走迁移脚本。
    if (!Array.isArray(this.data.pets)) this.data.pets = []
    // 老用户没有口粮字段：补上初始的 3 份
    for (const u of this.data.users) {
      if (typeof u.rations !== 'number') u.rations = 3
      if (typeof u.rationDay !== 'string') u.rationDay = ''
    }
    await this.#ensureUnitSpaces()
    return this
  }

  /**
   * 已经存在的本地数据也要补上「每栋楼每一户」。
   * 只追加缺失 id，不会覆盖任何人已经认领/布置过的房间。
   */
  async #ensureUnitSpaces() {
    const version = this.data.meta?.unitSeedVersion || 1
    if (version >= UNIT_SEED_VERSION) return
    const fresh = buildUnitSpaces()
    const freshIds = new Set(fresh.map((space) => space.id))
    // 楼型重排后每层户数会变：旧编号（06 室之类）在新平面里没有对应房间，
    // 留着只会让前端退回假尺寸、家具乱摆。只删我们自己生成、还没人认领的。
    const before = this.data.spaces.length
    this.data.spaces = this.data.spaces.filter(
      (space) => !isUnitSpaceId(space.id) || space.ownerId || freshIds.has(space.id),
    )
    const pruned = before - this.data.spaces.length
    const known = new Set(this.data.spaces.map((space) => space.id))
    const now = new Date().toISOString()
    let added = 0
    for (const space of fresh) {
      if (known.has(space.id)) continue
      this.data.spaces.push({
        ...space,
        visitCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      added += 1
    }
    this.data.meta = { ...this.data.meta, unitSeedVersion: UNIT_SEED_VERSION }
    if (pruned) console.log(`[store] removed ${pruned} stale unit spaces`)
    // 即使没有新增（例如另一个进程已经写入），也要把版本号落盘，避免每次启动都重建列表。
    await this.#flush()
  }

  async #flush() {
    const tmp = `${this.file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(this.data, null, 2))
    await rename(tmp, this.file)
  }

  #write(mutator) {
    const run = async () => {
      const result = await mutator(this.data)
      await this.#flush()
      return result
    }
    this.queue = this.queue.then(run, run)
    return this.queue
  }

  #read(fn) {
    return Promise.resolve(fn(this.data))
  }

  // ---------- identity ----------

  async createGuest(name) {
    const user = {
      id: randomUUID(),
      name: (name && String(name).trim().slice(0, 16)) || `访客-${randomBytes(2).toString('hex').toUpperCase()}`,
      color: COLORS[randomInt(COLORS.length)],
      tokenHash: null,
      accountId: null,
      isNpc: false,
      rations: 3,
      rationDay: '',
      createdAt: new Date().toISOString(),
    }
    await this.#write((d) => {
      d.users.push(user)
    })
    return user
  }

  async setTokenHash(userId, tokenHash) {
    await this.#write((d) => {
      const u = d.users.find((x) => x.id === userId)
      if (u) u.tokenHash = tokenHash
    })
  }

  async getUserByTokenHash(tokenHash) {
    return this.#read((d) => d.users.find((u) => u.tokenHash === tokenHash && !u.isNpc) || null)
  }

  async getUserById(id) {
    return this.#read((d) => d.users.find((u) => u.id === id) || null)
  }

  async renameUser(id, name) {
    return this.#write((d) => {
      const u = d.users.find((x) => x.id === id)
      if (!u) return null
      u.name = String(name).trim().slice(0, 16)
      return u
    })
  }

  // ---------- places & spaces ----------

  #postCount(d, type, id) {
    return d.posts.filter(
      (p) => p.targetType === type && p.targetId === id && p.status === 'visible' && !p.parentId,
    ).length
  }

  async listPlaces() {
    return this.#read((d) =>
      d.places.map((p) => ({ ...p, postCount: this.#postCount(d, 'place', p.id) })),
    )
  }

  async getPlace(id) {
    return this.#read((d) => {
      const p = d.places.find((x) => x.id === id)
      return p ? { ...p, postCount: this.#postCount(d, 'place', p.id) } : null
    })
  }

  #spaceView(d, s) {
    const owner = s.ownerId ? d.users.find((u) => u.id === s.ownerId) : null
    return {
      ...s,
      owner: owner ? { id: owner.id, name: owner.name, color: owner.color } : null,
      postCount: this.#postCount(d, 'space', s.id),
      visitCount: d.visits.filter((v) => v.spaceId === s.id).length,
    }
  }

  async listSpaces() {
    return this.#read((d) => d.spaces.map((s) => this.#spaceView(d, s)))
  }

  async getSpace(id) {
    const existing = await this.#read((d) => {
      const s = d.spaces.find((x) => x.id === id)
      return s ? this.#spaceView(d, s) : null
    })
    if (existing) return existing

    const seed = unitTemplate(id)
    if (!seed) return null
    return this.#write((d) => {
      const known = d.spaces.find((x) => x.id === id)
      if (known) return this.#spaceView(d, known)
      const now = new Date().toISOString()
      const space = { ...seed, visitCount: 0, createdAt: now, updatedAt: now }
      d.spaces.push(space)
      return this.#spaceView(d, space)
    })
  }

  async claimSpace(spaceId, userId) {
    return this.#write((d) => {
      const space = d.spaces.find((s) => s.id === spaceId)
      if (!space) return { error: 'not_found' }
      if (space.ownerId) {
        return space.ownerId === userId
          ? { space: this.#spaceView(d, space), already: true }
          : { error: 'taken' }
      }
      const other = d.spaces.find((s) => s.ownerId === userId && s.id !== spaceId)
      if (other) return { error: 'already_claimed', spaceId: other.id }
      space.ownerId = userId
      space.isOpen = true
      space.updatedAt = new Date().toISOString()
      return { space: this.#spaceView(d, space) }
    })
  }

  async releaseSpace(spaceId, userId) {
    return this.#write((d) => {
      const space = d.spaces.find((s) => s.id === spaceId)
      if (!space) return { error: 'not_found' }
      if (space.ownerId !== userId) return { error: 'forbidden' }
      space.ownerId = null
      space.updatedAt = new Date().toISOString()
      return { space: this.#spaceView(d, space) }
    })
  }

  async updateSpace(spaceId, userId, patch) {
    return this.#write((d) => {
      const space = d.spaces.find((s) => s.id === spaceId)
      if (!space) return { error: 'not_found' }
      if (space.ownerId !== userId) return { error: 'forbidden' }
      Object.assign(space, patch)
      space.updatedAt = new Date().toISOString()
      return { space: this.#spaceView(d, space) }
    })
  }

  // ---------- posts ----------

  #postView(d, p) {
    const author = d.users.find((u) => u.id === p.authorId)
    return {
      ...p,
      author: author
        ? { id: author.id, name: author.name, color: author.color }
        : { id: 'ghost', name: '已离开的访客', color: '#999' },
    }
  }

  async listPosts(targetType, targetId, limit = 80) {
    return this.#read((d) =>
      d.posts
        .filter((p) => p.targetType === targetType && p.targetId === targetId && p.status === 'visible')
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit)
        .map((p) => this.#postView(d, p)),
    )
  }

  async getPost(id) {
    return this.#read((d) => {
      const p = d.posts.find((x) => x.id === id)
      return p ? this.#postView(d, p) : null
    })
  }

  async createPost(post) {
    return this.#write((d) => {
      const row = {
        ...post,
        id: randomUUID(),
        kind: post.parentId ? 'reply' : 'message',
        status: 'visible',
        deletedAt: null,
        createdAt: new Date().toISOString(),
      }
      d.posts.push(row)
      return this.#postView(d, row)
    })
  }

  async deletePost(postId, user) {
    return this.#write((d) => {
      const p = d.posts.find((x) => x.id === postId)
      if (!p || p.status !== 'visible') return { error: 'not_found' }
      let allowed = p.authorId === user.id
      if (!allowed && p.targetType === 'space') {
        const s = d.spaces.find((x) => x.id === p.targetId)
        allowed = !!s && s.ownerId === user.id
      }
      if (!allowed && p.targetType === 'pet') {
        const pet = d.pets.find((x) => x.id === p.targetId)
        allowed = !!pet && pet.ownerId === user.id
      }
      if (!allowed) return { error: 'forbidden' }
      p.status = 'deleted'
      p.deletedAt = new Date().toISOString()
      return { ok: true }
    })
  }

  async reportPost(postId, reporterId, reason) {
    return this.#write((d) => {
      const p = d.posts.find((x) => x.id === postId)
      if (!p || p.status !== 'visible') return { error: 'not_found' }
      if (d.reports.some((r) => r.postId === postId && r.reporterId === reporterId)) {
        return { ok: true, already: true }
      }
      d.reports.push({ id: randomUUID(), postId, reporterId, reason, createdAt: new Date().toISOString() })
      const count = d.reports.filter((r) => r.postId === postId).length
      if (count >= 3) p.status = 'hidden'
      return { ok: true, hidden: count >= 3 }
    })
  }

  // ---------- pets ----------

  #petView(d, pet) {
    const owner = d.users.find((u) => u.id === pet.ownerId)
    return {
      id: pet.id,
      speciesId: pet.speciesId,
      breedId: pet.breedId,
      scale: pet.scale,
      spot: pet.spot,
      nickname: pet.nickname ?? null,
      owner: owner ? { id: owner.id, name: owner.name, color: owner.color } : null,
      adoptedAt: pet.adoptedAt,
      hungerAt: pet.hungerAt ?? null,
    }
  }

  async listPets() {
    return this.#read((d) =>
      d.pets
        .filter((pet) => pet.ownerId)
        .sort((a, b) => String(a.adoptedAt).localeCompare(String(b.adoptedAt)))
        .map((pet) => this.#petView(d, pet)),
    )
  }

  async adoptPet(pet, userId) {
    return this.#write((d) => {
      const existing = d.pets.find((item) => item.id === pet.id)
      if (existing) {
        if (existing.ownerId && existing.ownerId !== userId) {
          const owner = d.users.find((u) => u.id === existing.ownerId)
          return { error: 'taken', ownerName: owner?.name || '其他访客' }
        }
        if (!existing.ownerId) {
          existing.ownerId = userId
          existing.adoptedAt = new Date().toISOString()
        }
        return { pet: this.#petView(d, existing) }
      }
      const owned = d.pets.find((item) => item.ownerId === userId)
      if (owned) return { error: 'limit' }
      const row = { ...pet, ownerId: userId, adoptedAt: new Date().toISOString() }
      d.pets.push(row)
      return { pet: this.#petView(d, row) }
    })
  }

  async getPet(id) {
    return this.#read((d) => {
      const pet = d.pets.find((item) => item.id === id)
      return pet ? this.#petView(d, pet) : null
    })
  }

  async listPetsByOwner(userId) {
    return this.#read((d) =>
      d.pets
        .filter((pet) => pet.ownerId === userId)
        .sort((a, b) => String(a.adoptedAt).localeCompare(String(b.adoptedAt)))
        .map((pet) => this.#petView(d, pet)),
    )
  }

  /** 喂食：扣 1 份口粮，刷新「最后一次吃饱」时间。谁的宠物都可以喂。 */
  async feedPet(petId, userId) {
    return this.#write((d) => {
      const pet = d.pets.find((item) => item.id === petId && item.ownerId)
      if (!pet) return { error: 'not_found' }
      const user = d.users.find((u) => u.id === userId)
      if (!user) return { error: 'no_user' }
      const rations = this.#rationsOf(user)
      if (rations < 1) return { error: 'no_rations' }
      user.rations = rations - 1
      pet.hungerAt = new Date().toISOString()
      pet.fedBy = Array.isArray(pet.fedBy) ? pet.fedBy : []
      if (!pet.fedBy.includes(userId)) pet.fedBy.push(userId)
      return { pet: this.#petView(d, pet), rations: user.rations }
    })
  }

  async renamePet(petId, userId, nickname) {
    return this.#write((d) => {
      const pet = d.pets.find((item) => item.id === petId)
      if (!pet) return { error: 'not_found' }
      if (pet.ownerId !== userId) return { error: 'forbidden' }
      pet.nickname = nickname
      return { pet: this.#petView(d, pet) }
    })
  }

  /** 喂过这只宠物的人才能留言 */
  async hasFedPet(petId, userId) {
    return this.#read((d) => {
      const pet = d.pets.find((item) => item.id === petId)
      return !!pet && Array.isArray(pet.fedBy) && pet.fedBy.includes(userId)
    })
  }

  #rationsOf(user) {
    // 老数据没有这个字段：视为已领过初始口粮
    if (typeof user.rations !== 'number') user.rations = 3
    return user.rations
  }

  /** 每天补 3 份口粮，上限 6 份。跨天判断用 UTC 日期。 */
  async claimRations(userId) {
    return this.#write((d) => {
      const user = d.users.find((u) => u.id === userId)
      if (!user) return { error: 'no_user' }
      const today = new Date().toISOString().slice(0, 10)
      const current = this.#rationsOf(user)
      if (user.rationDay === today) return { rations: current, granted: 0 }
      const granted = Math.min(3, Math.max(0, 6 - current))
      user.rations = current + granted
      user.rationDay = today
      return { rations: user.rations, granted }
    })
  }

  // ---------- favorites ----------

  async toggleFavorite(userId, targetType, targetId) {
    return this.#write((d) => {
      const i = d.favorites.findIndex(
        (f) => f.userId === userId && f.targetType === targetType && f.targetId === targetId,
      )
      let favorited
      if (i >= 0) {
        d.favorites.splice(i, 1)
        favorited = false
      } else {
        d.favorites.push({ userId, targetType, targetId, createdAt: new Date().toISOString() })
        favorited = true
      }
      const count = d.favorites.filter((f) => f.targetType === targetType && f.targetId === targetId).length
      return { favorited, count }
    })
  }

  async isFavorite(userId, targetType, targetId) {
    return this.#read((d) =>
      !!d.favorites.find((f) => f.userId === userId && f.targetType === targetType && f.targetId === targetId),
    )
  }

  async favoriteCount(targetType, targetId) {
    return this.#read(
      (d) => d.favorites.filter((f) => f.targetType === targetType && f.targetId === targetId).length,
    )
  }

  async listFavorites(userId) {
    return this.#read((d) =>
      d.favorites
        .filter((f) => f.userId === userId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((f) => {
          const source = f.targetType === 'space' ? d.spaces : d.places
          const target = source.find((x) => x.id === f.targetId)
          return { ...f, name: target?.name || '已失效的地点' }
        }),
    )
  }

  // ---------- visits ----------

  async recordVisit(spaceId, userId) {
    return this.#write((d) => {
      const space = d.spaces.find((s) => s.id === spaceId)
      if (!space) return { error: 'not_found' }
      const existing = d.visits.find((v) => v.spaceId === spaceId && v.userId === userId)
      if (!existing) {
        d.visits.push({ id: randomUUID(), spaceId, userId, note: null, createdAt: new Date().toISOString() })
      }
      const count = d.visits.filter((v) => v.spaceId === spaceId).length
      return { count, already: !!existing }
    })
  }

  async listVisits(spaceId, limit = 30) {
    return this.#read((d) =>
      d.visits
        .filter((v) => v.spaceId === spaceId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit)
        .map((v) => {
          const u = d.users.find((x) => x.id === v.userId)
          return {
            id: v.id,
            createdAt: v.createdAt,
            user: u ? { id: u.id, name: u.name, color: u.color } : null,
          }
        }),
    )
  }

  async stats() {
    return this.#read((d) => ({
      citizens: d.users.filter((u) => !u.isNpc).length,
      spaces: d.spaces.length,
      claimed: d.spaces.filter((s) => s.ownerId).length,
      messages: d.posts.filter((p) => p.status === 'visible').length,
    }))
  }
}
