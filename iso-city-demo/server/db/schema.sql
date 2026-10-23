-- 微光城区 / LUMEN DISTRICT
-- PostgreSQL 14+。首次启动时由 PgStore 自动执行；也可以手动 psql -f 执行。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4f7f74',
  token_hash TEXT UNIQUE,
  account_id TEXT,
  is_npc BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
