import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { buildUnitSpaces, isUnitSpaceId, UNIT_SEED_VERSION } from '../../shared/units.mjs'
import { npcUsers, places as seedPlaces, posts as seedPosts, seededVisits, spaces as seedSpaces } from '../seed.mjs'

const { Pool } = pg

// 同 json-store：旧库或新增楼栋的户型没 seed 时，按需补一条。
let unitTemplates = null
function unitTemplate(id) {
  if (!unitTemplates) unitTemplates = new Map(buildUnitSpaces().map((space) => [space.id, space]))
  return unitTemplates.get(id) || null
}

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
    rations: Number(row.rations || 0),
    rationDay: row.ration_day || '',
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

function mapPet(row) {
  if (!row) return null
  return {
    id: row.id,
    speciesId: row.species_id,
    breedId: row.breed_id,
    scale: Number(row.scale),
    spot: row.spot,
    nickname: row.nickname,
    owner: row.owner_name ? { id: row.owner_id, name: row.owner_name, color: row.owner_color } : null,
    adoptedAt: row.adopted_at,
    hungerAt: row.hunger_at || null,
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
    await this.#ensureUnitSpaces()
    return this
  }

  /** 给已有库补楼内户；重复启动是幂等的。 */
  async #ensureUnitSpaces() {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    )
    const versionRow = await this.pool.query(
      `SELECT value FROM app_meta WHERE key='unit_seed_version'`,
    )
    if (Number(versionRow.rows[0]?.value || 0) >= UNIT_SEED_VERSION) return
    const spaces = buildUnitSpaces()
    const freshIds = spaces.map((space) => space.id)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      // 先清掉旧编号：楼型重排后这些 id 在新平面里没有对应房间，且都还没人认领
      const stale = await client.query(`SELECT id FROM spaces WHERE owner_id IS NULL`)
      const doomed = stale.rows.map((row) => row.id).filter((id) => isUnitSpaceId(id) && !freshIds.includes(id))
      for (let offset = 0; offset < doomed.length; offset += 200) {
        await client.query(`DELETE FROM spaces WHERE id = ANY($1) AND owner_id IS NULL`, [
          doomed.slice(offset, offset + 200),
        ])
      }
      for (let offset = 0; offset < spaces.length; offset += 60) {
        const chunk = spaces.slice(offset, offset + 60)
        const values = []
        const params = []
        chunk.forEach((s, i) => {
          const n = i * 11
          values.push(
            `($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 5},$${n + 6},$${n + 7},$${n + 8},$${n + 9},$${n + 10},$${n + 11})`,
          )
          params.push(
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
          )
        })
        await client.query(
          `INSERT INTO spaces
            (id, name, description, building, template, wall_color, floor_color, art, layout, owner_id, is_open)
           VALUES ${values.join(',')} ON CONFLICT (id) DO NOTHING`,
          params,
        )
      }
      await client.query(
        `INSERT INTO app_meta (key, value) VALUES ('unit_seed_version', $1)
         ON CONFLICT (key) DO UPDATE SET value=$1`,
        [String(UNIT_SEED_VERSION)],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
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
    if (rows[0]) return mapSpace(rows[0])

    const seed = unitTemplate(id)
    if (!seed) return null
    await this.pool.query(
      `INSERT INTO spaces
        (id, name, description, building, template, wall_color, floor_color, art, layout, owner_id, is_open)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [
        seed.id,
        seed.name,
        seed.description,
        seed.building,
        seed.template,
        seed.wallColor,
        seed.floorColor,
        JSON.stringify(seed.art),
        JSON.stringify(seed.layout),
        seed.ownerId,
        seed.isOpen,
      ],
    )
    const again = await this.pool.query(`${this.#spaceSelect('WHERE s.id=$1')}`, [id])
    return mapSpace(again.rows[0])
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
    if (!allowed && post.targetType === 'pet') {
      const { rows } = await this.pool.query('SELECT owner_id FROM pets WHERE id=$1', [post.targetId])
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

  // ---------- pets ----------

  async listPets() {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.name AS owner_name, u.color AS owner_color
       FROM pets p JOIN users u ON u.id = p.owner_id
       ORDER BY p.adopted_at`,
    )
    return rows.map(mapPet)
  }

  async adoptPet(pet, userId) {
    const owned = await this.pool.query('SELECT id FROM pets WHERE owner_id=$1 LIMIT 1', [userId])
    if (owned.rows[0]) return { error: 'limit' }
    // 先插入（已存在则忽略），再带条件更新。两个人同时点同一只时，
    // UPDATE 的行锁会让后者读到 owner_id 已非空，从而拿到 taken。
    try {
      await this.pool.query(
        `INSERT INTO pets (id, species_id, breed_id, scale, spot, owner_id)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [pet.id, pet.speciesId, pet.breedId, pet.scale, JSON.stringify(pet.spot), userId],
      )
    } catch (error) {
      if (error?.code === '23505') return { error: 'limit' }
      throw error
    }
    const { rows } = await this.pool.query(
      `UPDATE pets SET owner_id=$2, adopted_at=now()
       WHERE id=$1 AND (owner_id IS NULL OR owner_id=$2) RETURNING id`,
      [pet.id, userId],
    )
    if (!rows[0]) {
      const taken = await this.pool.query(
        `SELECT u.name AS owner_name FROM pets p LEFT JOIN users u ON u.id=p.owner_id WHERE p.id=$1`,
        [pet.id],
      )
      if (!taken.rows[0]) return { error: 'not_found' }
      return { error: 'taken', ownerName: taken.rows[0].owner_name || '其他访客' }
    }
    const full = await this.pool.query(
      `SELECT p.*, u.name AS owner_name, u.color AS owner_color
       FROM pets p JOIN users u ON u.id=p.owner_id WHERE p.id=$1`,
      [pet.id],
    )
    return { pet: mapPet(full.rows[0]) }
  }

  async getPet(id) {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.name AS owner_name, u.color AS owner_color
       FROM pets p JOIN users u ON u.id=p.owner_id WHERE p.id=$1`,
      [id],
    )
    return mapPet(rows[0])
  }

  async listPetsByOwner(userId) {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.name AS owner_name, u.color AS owner_color
       FROM pets p JOIN users u ON u.id=p.owner_id
       WHERE p.owner_id=$1 ORDER BY p.adopted_at`,
      [userId],
    )
    return rows.map(mapPet)
  }

  /** 喂食：扣 1 份口粮，刷新「最后一次吃饱」时间。谁的宠物都可以喂。 */
  async feedPet(petId, userId) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const userRow = await client.query('SELECT rations FROM users WHERE id=$1 FOR UPDATE', [userId])
      if (!userRow.rows[0]) {
        await client.query('ROLLBACK')
        return { error: 'no_user' }
      }
      const rations = Number(userRow.rows[0].rations || 0)
      if (rations < 1) {
        await client.query('ROLLBACK')
        return { error: 'no_rations' }
      }
      const petRow = await client.query(
        `UPDATE pets SET hunger_at=now(),
           fed_by = CASE
             WHEN fed_by @> to_jsonb($2::text) THEN fed_by
             ELSE COALESCE(fed_by,'[]'::jsonb) || to_jsonb($2::text)
           END
         WHERE id=$1 AND owner_id IS NOT NULL RETURNING id`,
        [petId, userId],
      )
      if (!petRow.rows[0]) {
        await client.query('ROLLBACK')
        return { error: 'not_found' }
      }
      await client.query('UPDATE users SET rations=$2 WHERE id=$1', [userId, rations - 1])
      const full = await client.query(
        `SELECT p.*, u.name AS owner_name, u.color AS owner_color
         FROM pets p JOIN users u ON u.id=p.owner_id WHERE p.id=$1`,
        [petId],
      )
      await client.query('COMMIT')
      return { pet: mapPet(full.rows[0]), rations: rations - 1 }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async renamePet(petId, userId, nickname) {
    const { rows } = await this.pool.query(
      `UPDATE pets SET nickname=$3 WHERE id=$1 AND owner_id=$2 RETURNING id`,
      [petId, userId, nickname],
    )
    if (!rows[0]) {
      const pet = await this.getPet(petId)
      return { error: pet ? 'forbidden' : 'not_found' }
    }
    return { pet: await this.getPet(petId) }
  }

  async hasFedPet(petId, userId) {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM pets WHERE id=$1 AND fed_by @> to_jsonb($2::text) LIMIT 1`,
      [petId, userId],
    )
    return !!rows[0]
  }

  /** 每天补 3 份口粮，上限 6 份。 */
  async claimRations(userId) {
    const today = new Date().toISOString().slice(0, 10)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        'SELECT rations, ration_day FROM users WHERE id=$1 FOR UPDATE',
        [userId],
      )
      if (!rows[0]) {
        await client.query('ROLLBACK')
        return { error: 'no_user' }
      }
      if (rows[0].ration_day === today) {
        await client.query('COMMIT')
        return { rations: Number(rows[0].rations || 0), granted: 0 }
      }
      const current = Number(rows[0].rations || 0)
      const granted = Math.min(3, Math.max(0, 6 - current))
      await client.query('UPDATE users SET rations=$2, ration_day=$3 WHERE id=$1', [
        userId,
        current + granted,
        today,
      ])
      await client.query('COMMIT')
      return { rations: current + granted, granted }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
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
      `SELECT f.*,
              COALESCE(s.name, p.name, pt.nickname) AS name,
              pt.species_id, pt.breed_id
       FROM favorites f
       LEFT JOIN spaces s ON f.target_type='space' AND s.id=f.target_id
       LEFT JOIN places p ON f.target_type='place' AND p.id=f.target_id
       LEFT JOIN pets pt ON f.target_type='pet' AND pt.id=f.target_id
       WHERE f.user_id=$1 ORDER BY f.created_at DESC`,
      [userId],
    )
    return rows.map((r) => ({
      targetType: r.target_type,
      targetId: r.target_id,
      name: r.name || null,
      speciesId: r.species_id || null,
      breedId: r.breed_id || null,
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
