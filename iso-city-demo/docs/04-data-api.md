# 04 · 数据与接口

---

## 1. 数据库改动

### 1.1 users 增加口粮

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS rations INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ration_day TEXT NOT NULL DEFAULT '';
```

### 1.2 pets

```sql
CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY,
  recipe JSONB NOT NULL,              -- PetRecipe，8 个数字
  palette JSONB NOT NULL,             -- 8 个 hex
  deco TEXT,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  nickname TEXT,
  home_x DOUBLE PRECISION,
  home_z DOUBLE PRECISION,
  hunger_at TIMESTAMPTZ,              -- 只存「最后一次吃饱的时间」
  adopted_at TIMESTAMPTZ,
  adopted_by_name TEXT,               -- 冗余一份，宠物被领走后还要显示「被 @某某 带走」
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pets_owner_idx ON pets(owner_id);
```

> `hunger` **不存数值**，只存 `hunger_at`。当前饱腹度由客户端按时间差算，避免定时任务。
>
> 一个用户只能有一只宠物：`CREATE UNIQUE INDEX pets_one_per_owner ON pets(owner_id) WHERE owner_id IS NOT NULL;`（与 `spaces` 同款约束）

### 1.3 fish_catch

```sql
CREATE TABLE IF NOT EXISTS fish_catch (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  personal_best_g INT NOT NULL DEFAULT 0,
  first_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, species_id)
);

-- 全城纪录：单独一张，读多写少，避免每次图鉴都扫全表
CREATE TABLE IF NOT EXISTS fish_world (
  species_id TEXT PRIMARY KEY,
  best_g INT NOT NULL DEFAULT 0,
  best_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  best_user_name TEXT
);
```

### 1.4 posts 扩展 target_type

现有约束是 `CHECK (target_type IN ('place','space'))`，**必须改**：

```sql
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_target_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_target_type_check
  CHECK (target_type IN ('place', 'space', 'pet'));
```

### 1.5 json-store 结构

`server/data/db.json` 追加：

```json
{
  "pets": {},
  "fish": {},
  "fishWorld": {}
}
```

`#ensureUnitSpaces()` 旁边加一个 `#ensureSeededPets()`：只在 `pets` 为空时写入野生池的**占位记录**（见下），版本号 `PET_SEED_VERSION`，与 `UNIT_SEED_VERSION` 同款机制。

---

## 2. 野生宠物不落库

野生宠物是**纯客户端推导**的（按小时切片 + `seeded`），服务端不存它们的行。

只有两种情况会写入 `pets` 表：

1. 被领养（`ownerId` 从 null 变为某人）
2. 用于展示的种子数据（可选，为了首页/图鉴有内容）

所以 `pets` 表的行数 = 玩家总数级别，不是「12 只野生 × 每小时的量」。

**领养时服务端必须先确认这条记录存在**：

```js
async adoptPet(petId, userId, nickname) {
  let pet = this.db.pets[petId]
  if (!pet) {
    // 首次被领养：用客户端提交的配方建档（配方是公开数据，无篡改风险）
    pet = { id: petId, recipe: null, palette: null, ownerId: null, ... }
  }
  if (pet.ownerId) return { ok: false, reason: 'taken', ownerName: pet.adoptedByName }
  ...
}
```

配方由客户端提交（`POST /api/pets/adopt`），服务端只做**字段合法性校验**，不校验「配方是否属于今天的野生池」——因为野生池本来就是公开推导的，校验它没有安全价值，只会引入时钟偏差 bug。

---

## 3. 接口

全部挂在 `server/api.mjs`，沿用现有 `json()` / `clean()` / `HEX` / `ID` 约定。

### 3.1 宠物

```http
GET  /api/pets            → { mine: Pet | null, wildTaken: string[] }
POST /api/pets/adopt      → { pet: Pet }
POST /api/pets/feed       → { pet: Pet, rations: number }
POST /api/pets/rename     → { pet: Pet }
GET  /api/pets/:id        → { pet: Pet, notes: Post[] }
```

**`GET /api/pets`** 返回 `wildTaken`（今天已被领走的野生 id 列表），客户端用它过滤野生池。

**`POST /api/pets/adopt`**

```js
// 请求
{ recipe, palette, deco, nickname, home: { x, z } }

// 校验
recipe   → 8 个字段都是 0..7 的整数，否则拒绝
palette  → 8 项，每项过 HEX 正则
nickname → clean(nickname, 10)，长度 ≥ 2
home     → x/z 必须是有限数，且在世界 bounds 内

// 响应
{ pet }                          // 成功
{ error: 'taken', ownerName }    // 409
{ error: 'no_rations' }          // 402
{ error: 'already_have' }        // 409
```

**`POST /api/pets/feed`**

- 只能喂自己的宠物，或自己附近的野生宠物（服务端不做距离校验，信任客户端——这不是经济系统，不值得做）
- 扣 1 份口粮，写 `hunger_at = now()`
- 喂别人的宠物 → 返回 `{ pet, rations }`，同时**解锁该宠物的留言权限**

**`GET /api/pets/:id`**

```js
{ pet, notes: [{ id, authorName, authorColor, body, createdAt }] }
```

只返回 `status = 'visible'` 的，最多 20 条。

### 3.2 口粮

```http
POST /api/rations/claim   → { rations: number, granted: number }
```

登录后由客户端调一次，跨天补发 3 份（上限 6）。

### 3.3 钓鱼

```http
POST /api/fish            → { entry, world }
GET  /api/fish            → { dex: Entry[], world: World[] }
```

**`POST /api/fish`**

```js
// 请求
{ speciesId, grams }

// 校验
speciesId 必须存在于共享的 SPECIES 常量（服务端也 import 同一份数据）
grams     必须落在该物种的 kg 区间的 0.5~1.6 倍之间   // 防篡改，宽容

// 响应
{ entry: { speciesId, count, personalBest }, world: { bestG, bestUserName } | null }
```

> 重量只在**刷新纪录时**才写 `fish_world`，避免每次钓鱼都写全城表。

### 3.4 留言

复用 `POST /api/posts`，`targetType: 'pet'`。新增一条校验：

```js
if (targetType === 'pet') {
  // 必须喂过这只宠物，且今天还没留过
  const fed = await store.hasFedPet(userId, targetId)
  if (!fed) return json(403, { error: 'feed_first' })
  if (await store.petNoteToday(userId, targetId)) return json(429, { error: 'daily_limit' })
}
```

---

## 4. 共享常量

鱼的物种数据必须前后端共用。现有 `shared/units.mjs` 已经是这个模式的先例，照做一个 `shared/species.mjs`：

```
shared/
  units.mjs      已有
  species.mjs    FISH_SPECIES（服务端校验 + 客户端图鉴）
```

`pets` 的配方不需要共享——服务端只做范围校验。

---

## 5. store.ts 增量

```ts
// 状态
rations: number
myPet: Pet | null
wildTaken: string[]
wildPets: WildPet[]          // 客户端推导，每 60s 重算一次
fishing: FishingState | null
dex: { pets: unknown[]; fish: FishEntry[] }

// action
loadPets: () => Promise<void>
adoptPet: (input: AdoptInput) => Promise<void>
feedPet: (petId: string) => Promise<void>
renamePet: (name: string) => Promise<void>
claimRations: () => Promise<void>
commitCatch: (speciesId: string, grams: number) => Promise<void>
```

`wildPets` 不进 zustand 的持久化，每次挂载时用 `wildPool(Date.now())` 重算。

---

## 6. api.ts 增量

```ts
pets: () => request<{ mine: Pet | null; wildTaken: string[] }>('/api/pets'),
adoptPet: (input: AdoptInput) =>
  request<{ pet: Pet }>('/api/pets/adopt', { method: 'POST', body: input }),
feedPet: (id: string) =>
  request<{ pet: Pet; rations: number }>('/api/pets/feed', { method: 'POST', body: { id } }),
renamePet: (id: string, name: string) =>
  request<{ pet: Pet }>('/api/pets/rename', { method: 'POST', body: { id, name } }),
petDetail: (id: string) => request<{ pet: Pet; notes: Post[] }>(`/api/pets/${encodeURIComponent(id)}`),
claimRations: () => request<{ rations: number; granted: number }>('/api/rations/claim', { method: 'POST' }),
commitCatch: (speciesId: string, grams: number) =>
  request<{ entry: FishEntry; world: WorldRecord | null }>('/api/fish', {
    method: 'POST',
    body: { speciesId, grams },
  }),
fishDex: () => request<{ dex: FishEntry[]; world: WorldRecord[] }>('/api/fish'),
```

---

## 7. 迁移顺序（上线不能被卡住）

1. 先加列（`users.rations`、`users.ration_day`）——向后兼容，老代码忽略即可
2. 再 `ALTER ... DROP CONSTRAINT` 放宽 `posts.target_type`
3. 再建 `pets` / `fish_catch` / `fish_world`
4. 最后发服务端代码

**每一步都是幂等的**（`IF NOT EXISTS`），重启即自动跑完。json-store 侧只需在 `init()` 里补空对象，无需迁移脚本。

---

## 8. 验收

1. `npm run reset` 后全新启动，`/api/pets` 返回 `mine: null`
2. 领养两次（同一用户）第二次返回 `already_have`
3. 两个 token 抢同一只宠物，只有一个 200，另一个 409 且带 `ownerName`
4. 没喂过就留言返回 403；喂过之后能留一条，第二条返回 429
5. 提交 999999g 的鱼被拒绝；正常重量成功且能刷新全城纪录
6. 把 `ration_day` 改成昨天，再调 claim 能补 3 份
