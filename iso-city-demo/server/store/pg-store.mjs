import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { npcUsers, places as seedPlaces, posts as seedPosts, seededVisits, spaces as seedSpaces } from '../seed.mjs'

const { Pool } = pg

const SPACE_FIELDS = {
  name: 'name',
  description: 'description',
  template: 'template',
  wallColor: 'wall_color',
  floorColor: 'floor_color',
  art: 'art',
  layout: 'layout',
  isOpen: 'is_open',
}

function mapUser(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    tokenHash: row.token_hash,
    accountId: row.account_id,
    isNpc: row.is_npc,
    createdAt: row.created_at,
  }
}

function mapSpace(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    building: row.building,
    template: row.template,
    wallColor: row.wall_color,
    floorColor: row.floor_color,
    art: row.art,
    layout: row.layout,
    ownerId: row.owner_id,
    owner: row.owner_name ? { id: row.owner_id, name: row.owner_name, color: row.owner_color } : null,
    isOpen: row.is_open,
    visitCount: Number(row.visit_count || 0),
    postCount: Number(row.post_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPost(row) {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    authorId: row.author_id,
    author: { id: row.author_id, name: row.author_name, color: row.author_color },
    parentId: row.parent_id,
    kind: row.kind,
    body: row.body,
    mediaKind: row.media_kind,
    mediaRef: row.media_ref,
    createdAt: row.created_at,
    status: row.status,
  }
}

export class PgStore {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_SIZE || 5),
      ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  }

  async init() {
    const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
    await this.pool.query(schema)
    await this.#seed()
    return this
  }

  async close() {
    await this.pool.end()
  }

  async #seed() {
    const { rows } = await this.pool.query('SELECT count(*)::int AS n FROM users')
    if (rows[0].n > 0) return
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      for (const u of npcUsers) {
        await client.query(
          `INSERT INTO users (id, name, color, is_npc) VALUES ($1,$2,$3,true) ON CONFLICT (id) DO NOTHING`,
          [u.id, u.name, u.color],
        )
      }
      for (const p of seedPlaces) {
        await client.query(
          `INSERT INTO places (id, name, subtitle, description, kind, x, z)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          [p.id, p.name, p.subtitle, p.description, p.kind, p.x, p.z],
        )
      }
      for (const s of seedSpaces) {
        await client.query(
          `INSERT INTO spaces
            (id, name, description, building, template, wall_color, floor_color, art, layout, owner_id, is_open)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
          [
            s.id,
            s.name,
            s.description,
            s.building,
            s.template,
            s.wallColor,
            s.floorColor,
            JSON.stringify(s.art),
            JSON.stringify(s.layout),
            s.ownerId,
            s.isOpen,
          ],
        )
      }
      for (const p of seedPosts) {
        await client.query(
          `INSERT INTO posts
            (id, target_type, target_id, author_id, parent_id, kind, body, media_kind, media_ref, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'visible',$10) ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
            p.targetType,
            p.targetId,
            p.authorId,
            p.parentId || null,
            p.parentId ? 'reply' : 'message',
            p.body,
            p.mediaKind || 'none',
            p.mediaRef || null,
            p.createdAt,
          ],
        )
      }
      for (const v of seededVisits) {
        await client.query(
          `INSERT INTO visits (space_id, user_id, created_at) VALUES ($1,$2,$3)`,
          [v.spaceId, v.userId, v.createdAt],
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // ---------- identity ----------

  async createGuest(name) {
    const id = randomUUID()
    const fallback = `访客-${Math.random().toString(16).slice(2, 6).toUpperCase()}`
    const colors = ['#4f7f74', '#c4774c', '#7a6b98', '#a9853f', '#58758c', '#9b6b73']
    const color = colors[Math.floor(Math.random() * colors.length)]
    const { rows } = await this.pool.query(
      `INSERT INTO users (id, name, color) VALUES ($1,$2,$3) RETURNING *`,
      [id, (name && String(name).trim().slice(0, 16)) || fallback, color],
    )
    return mapUser(rows[0])
  }

  async setTokenHash(userId, tokenHash) {
    await this.pool.query('UPDATE users SET token_hash=$1 WHERE id=$2', [tokenHash, userId])
  }

  async getUserByTokenHash(tokenHash) {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE token_hash=$1 AND is_npc=false LIMIT 1',
      [tokenHash],
    )
    return mapUser(rows[0])
  }

  async getUserById(id) {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id=$1', [id])
    return mapUser(rows[0])
  }

  async renameUser(id, name) {
    const { rows } = await this.pool.query('UPDATE users SET name=$1 WHERE id=$2 RETURNING *', [name, id])
    return mapUser(rows[0])
  }

  // ---------- places & spaces ----------

  async listPlaces() {
    const { rows } = await this.pool.query(
      `SELECT p.*, (
         SELECT count(*) FROM posts x
         WHERE x.target_type='place' AND x.target_id=p.id AND x.status='visible' AND x.parent_id IS NULL
       )::int AS post_count
       FROM places p ORDER BY p.created_at`,
    )
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      subtitle: r.subtitle,
      description: r.description,
      kind: r.kind,
      x: Number(r.x),
      z: Number(r.z),
      postCount: r.post_count,
    }))
  }

  async getPlace(id) {
    const places = await this.listPlaces()
    return places.find((p) => p.id === id) || null
  }

  #spaceSelect(where = '') {
    return `SELECT s.*, u.name AS owner_name, u.color AS owner_color,
      (SELECT count(*) FROM posts p
        WHERE p.target_type='space' AND p.target_id=s.id AND p.status='visible' AND p.parent_id IS NULL
      )::int AS post_count,
      (SELECT count(*) FROM visits v WHERE v.space_id=s.id)::int AS visit_count
      FROM spaces s LEFT JOIN users u ON u.id=s.owner_id ${where}`
  }

  async listSpaces() {
    const { rows } = await this.pool.query(`${this.#spaceSelect()} ORDER BY s.created_at`)
    return rows.map(mapSpace)
  }

  async getSpace(id) {
    const { rows } = await this.pool.query(`${this.#spaceSelect('WHERE s.id=$1')}`, [id])
    return mapSpace(rows[0])
  }

  async claimSpace(spaceId, userId) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query('SELECT owner_id FROM spaces WHERE id=$1 FOR UPDATE', [spaceId])
      if (!rows[0]) {
        await client.query('ROLLBACK')
        return { error: 'not_found' }
      }
      if (rows[0].owner_id) {
        const isMine = rows[0].owner_id === userId
        await client.query('ROLLBACK')
        return isMine
          ? { space: await this.getSpace(spaceId), already: true }
          : { error: 'taken' }
      }
      const mine = await client.query('SELECT id FROM spaces WHERE owner_id=$1 AND id<>$2 LIMIT 1', [
        userId,
        spaceId,
      ])
      if (mine.rows[0]) {
        await client.query('ROLLBACK')
        return { error: 'already_claimed', spaceId: mine.rows[0].id }
      }
      await client.query('UPDATE spaces SET owner_id=$1, is_open=true, updated_at=now() WHERE id=$2', [
        userId,
        spaceId,
      ])
      await client.query('COMMIT')
      return { space: await this.getSpace(spaceId) }
    } catch (error) {
      await client.query('ROLLBACK')
      if (error.code === '23505') return { error: 'taken' }
      throw error
    } finally {
      client.release()
    }
  }

  async releaseSpace(spaceId, userId) {
    const { rows } = await this.pool.query(
      'UPDATE spaces SET owner_id=NULL, updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING id',
      [spaceId, userId],
    )
    if (!rows[0]) {
      const space = await this.getSpace(spaceId)
      return { error: space ? 'forbidden' : 'not_found' }
    }
    return { space: await this.getSpace(spaceId) }
  }

  async updateSpace(spaceId, userId, patch) {
    const set = []
    const values = []
    let i = 1
    for (const [key, column] of Object.entries(SPACE_FIELDS)) {
      if (patch[key] === undefined) continue
      set.push(`${column}=$${i++}`)
      values.push(key === 'art' || key === 'layout' ? JSON.stringify(patch[key]) : patch[key])
    }
    if (!set.length) return { space: await this.getSpace(spaceId) }
    values.push(spaceId, userId)
    const { rowCount } = await this.pool.query(
      `UPDATE spaces SET ${set.join(', ')}, updated_at=now() WHERE id=$${i++} AND owner_id=$${i++}`,
      values,
    )
    if (!rowCount) {
      const space = await this.getSpace(spaceId)
      return { error: space ? 'forbidden' : 'not_found' }
    }
    return { space: await this.getSpace(spaceId) }
  }

  // ---------- posts ----------

  async listPosts(targetType, targetId, limit = 80) {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.name AS author_name, u.color AS author_color
       FROM posts p JOIN users u ON u.id=p.author_id
       WHERE p.target_type=$1 AND p.target_id=$2 AND p.status='visible'
       ORDER BY p.created_at DESC LIMIT $3`,
      [targetType, targetId, limit],
    )
    return rows.map(mapPost)
  }

  async getPost(id) {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.name AS author_name, u.color AS author_color
       FROM posts p JOIN users u ON u.id=p.author_id WHERE p.id=$1`,
      [id],
    )
    return rows[0] ? mapPost(rows[0]) : null
  }

  async createPost(post) {
    const id = randomUUID()
    const { rows } = await this.pool.query(
      `INSERT INTO posts (id, target_type, target_id, author_id, parent_id, kind, body, media_kind, media_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *, (SELECT name FROM users WHERE id=$4) AS author_name,
                 (SELECT color FROM users WHERE id=$4) AS author_color`,
      [
        id,
        post.targetType,
        post.targetId,
        post.authorId,
        post.parentId || null,
        post.parentId ? 'reply' : 'message',
        post.body,
        post.mediaKind || 'none',
        post.mediaRef || null,
      ],
    )
    return mapPost(rows[0])
  }

  async deletePost(postId, user) {
    const post = await this.getPost(postId)
    if (!post || post.status !== 'visible') return { error: 'not_found' }
    let allowed = post.authorId === user.id
    if (!allowed && post.targetType === 'space') {
      const { rows } = await this.pool.query('SELECT owner_id FROM spaces WHERE id=$1', [post.targetId])
      allowed = rows[0]?.owner_id === user.id
    }
    if (!allowed) return { error: 'forbidden' }
    await this.pool.query(`UPDATE posts SET status='deleted', deleted_at=now() WHERE id=$1`, [postId])
    return { ok: true }
  }

  async reportPost(postId, reporterId, reason) {
    const post = await this.getPost(postId)
    if (!post || post.status !== 'visible') return { error: 'not_found' }
    const { rowCount } = await this.pool.query(
      `INSERT INTO reports (post_id, reporter_id, reason) VALUES ($1,$2,$3)
       ON CONFLICT (post_id, reporter_id) DO NOTHING`,
      [postId, reporterId, reason],
    )
    if (!rowCount) return { ok: true, already: true }
    const { rows } = await this.pool.query('SELECT count(*)::int AS n FROM reports WHERE post_id=$1', [postId])
    const hidden = rows[0].n >= 3
    if (hidden) await this.pool.query(`UPDATE posts SET status='hidden' WHERE id=$1`, [postId])
    return { ok: true, hidden }
  }

  // ---------- favorites ----------

  async toggleFavorite(userId, targetType, targetId) {
    const existing = await this.pool.query(
      'SELECT 1 FROM favorites WHERE user_id=$1 AND target_type=$2 AND target_id=$3',
      [userId, targetType, targetId],
    )
    let favorited
    if (existing.rowCount) {
      await this.pool.query('DELETE FROM favorites WHERE user_id=$1 AND target_type=$2 AND target_id=$3', [
        userId,
        targetType,
        targetId,
      ])
      favorited = false
    } else {
      await this.pool.query(
        'INSERT INTO favorites (user_id,target_type,target_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [userId, targetType, targetId],
      )
      favorited = true
    }
    const count = await this.favoriteCount(targetType, targetId)
    return { favorited, count }
  }

  async isFavorite(userId, targetType, targetId) {
    const { rowCount } = await this.pool.query(
      'SELECT 1 FROM favorites WHERE user_id=$1 AND target_type=$2 AND target_id=$3',
      [userId, targetType, targetId],
    )
    return rowCount > 0
  }

  async favoriteCount(targetType, targetId) {
    const { rows } = await this.pool.query(
      'SELECT count(*)::int AS n FROM favorites WHERE target_type=$1 AND target_id=$2',
      [targetType, targetId],
    )
    return rows[0].n
  }

  async listFavorites(userId) {
    const { rows } = await this.pool.query(
      `SELECT f.*, COALESCE(s.name, p.name, '已失效的地点') AS name
       FROM favorites f
       LEFT JOIN spaces s ON f.target_type='space' AND s.id=f.target_id
       LEFT JOIN places p ON f.target_type='place' AND p.id=f.target_id
       WHERE f.user_id=$1 ORDER BY f.created_at DESC`,
      [userId],
    )
    return rows.map((r) => ({
      targetType: r.target_type,
      targetId: r.target_id,
      name: r.name,
      createdAt: r.created_at,
    }))
  }

  // ---------- visits ----------

  async recordVisit(spaceId, userId) {
    const space = await this.getSpace(spaceId)
    if (!space) return { error: 'not_found' }
    const prior = await this.pool.query(
      `SELECT 1 FROM visits WHERE space_id=$1 AND user_id=$2 LIMIT 1`,
      [spaceId, userId],
    )
    if (!prior.rowCount) {
      await this.pool.query(
        'INSERT INTO visits (space_id,user_id) VALUES ($1,$2) ON CONFLICT (space_id,user_id) DO NOTHING',
        [spaceId, userId],
      )
    }
    const { rows } = await this.pool.query('SELECT count(*)::int AS n FROM visits WHERE space_id=$1', [spaceId])
    return { count: rows[0].n, already: prior.rowCount > 0 }
  }

  async listVisits(spaceId, limit = 30) {
    const { rows } = await this.pool.query(
      `SELECT v.id, v.created_at, u.id AS user_id, u.name, u.color
       FROM visits v JOIN users u ON u.id=v.user_id
       WHERE v.space_id=$1 ORDER BY v.created_at DESC LIMIT $2`,
      [spaceId, limit],
    )
    return rows.map((r) => ({
      id: String(r.id),
      createdAt: r.created_at,
      user: { id: r.user_id, name: r.name, color: r.color },
    }))
  }

  async stats() {
    const { rows } = await this.pool.query(
      `SELECT (SELECT count(*) FROM users WHERE is_npc=false)::int AS citizens,
              (SELECT count(*) FROM spaces)::int AS spaces,
              (SELECT count(*) FROM spaces WHERE owner_id IS NOT NULL)::int AS claimed,
              (SELECT count(*) FROM posts WHERE status='visible')::int AS messages`,
    )
    return rows[0]
  }
}
