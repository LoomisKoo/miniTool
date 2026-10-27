-- 微光城区 / LUMEN DISTRICT
-- PostgreSQL 14+。首次启动时由 PgStore 自动执行；也可以手动 psql -f 执行。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4f7f74',
  token_hash TEXT UNIQUE,
  account_id TEXT,
  is_npc BOOLEAN NOT NULL DEFAULT false,
  rations INT NOT NULL DEFAULT 3,
  ration_day TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 老库补列：新访客有 3 份口粮，每天再补 3 份（上限 6）
ALTER TABLE users ADD COLUMN IF NOT EXISTS rations INT NOT NULL DEFAULT 3;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ration_day TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS users_account_idx ON users(account_id) WHERE account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'place',
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  z DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  building TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL DEFAULT 'home',
  wall_color TEXT NOT NULL DEFAULT '#e9e0d2',
  floor_color TEXT NOT NULL DEFAULT '#c3ae95',
  art JSONB NOT NULL DEFAULT '{"title":"未命名","palette":"dawn"}',
  layout JSONB NOT NULL DEFAULT '{"items":[]}',
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_open BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 一个用户同时只能认领一个空间：唯一索引 + 行锁共同保证并发安全
CREATE UNIQUE INDEX IF NOT EXISTS spaces_one_per_owner ON spaces(owner_id) WHERE owner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('place', 'space')),
  target_id TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'message',
  body TEXT NOT NULL,
  media_kind TEXT NOT NULL DEFAULT 'none',
  media_ref TEXT,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS posts_target_idx ON posts(target_type, target_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_parent_idx ON posts(parent_id);
CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('place', 'space')),
  target_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS visits (
  id BIGSERIAL PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visits_space_idx ON visits(space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS visits_user_idx ON visits(user_id, created_at DESC);
-- 同一访客在同一空间只留下一次访问印记
CREATE UNIQUE INDEX IF NOT EXISTS visits_one_per_user ON visits(space_id, user_id);

CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS reports_post_idx ON reports(post_id);

-- 宠物：野生宠物由客户端按小时推导，不落库；这里只存「已经被领养」的那些，
-- 让它们过了整点也还留在城里，并且所有人都能看到主人是谁。
CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY,
  species_id TEXT NOT NULL,
  breed_id TEXT NOT NULL,
  scale DOUBLE PRECISION NOT NULL DEFAULT 1,
  spot JSONB NOT NULL DEFAULT '{"x":0,"z":0,"radius":2}',
  nickname TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  adopted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 只存「最后一次吃饱的时间」，饱腹度由客户端按时间差算，不需要定时任务
  hunger_at TIMESTAMPTZ,
  -- 喂过它、因此拿到留言权限的人
  fed_by JSONB NOT NULL DEFAULT '[]'
);

-- 老库补列
ALTER TABLE pets ADD COLUMN IF NOT EXISTS hunger_at TIMESTAMPTZ;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS fed_by JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS pets_owner_idx ON pets(owner_id);
-- 一个用户同时只能领养一只宠物
CREATE UNIQUE INDEX IF NOT EXISTS pets_one_per_owner ON pets(owner_id);

-- 宠物也要能收到留言：放宽 posts.target_type
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_target_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_target_type_check
  CHECK (target_type IN ('place', 'space', 'pet'));

-- 宠物也能收藏：放宽 favorites.target_type
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_target_type_check;
ALTER TABLE favorites ADD CONSTRAINT favorites_target_type_check
  CHECK (target_type IN ('place', 'space', 'pet'));
