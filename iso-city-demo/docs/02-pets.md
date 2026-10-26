# 02 · 宠物系统

依赖 [01-pixel-catalog.md](./01-pixel-catalog.md)。

---

## 1. 状态模型

```ts
// src/types.ts 追加
export type Pet = {
  id: string
  recipe: PetRecipe
  palette: Palette            // 8 个 hex，野生也有（决定它的本色）
  ownerId: string | null      // ★ 唯一真值：null = 野生
  ownerName: string | null    // 服务端 join 出来的，只读
  nickname: string | null     // 野生恒为 null
  deco: DecoId | null
  home: { x: number; z: number } | null
  hunger: number              // 0~100，野生恒为 100
  adoptedAt: number | null
  lastFedAt: number | null
}
```

**不要加 `isWild`**。判断一律写 `pet.ownerId === null`。

---

## 2. 野生池：确定性轮换

### 2.1 问题

「随机在街道出现」如果实现成「生成后留着不管」，跑两小时街上会挤满没人要的宠物。

### 2.2 方案

按**小时**切片，全局固定 12 个槽位。任何客户端、任何时刻，算出的野生池完全一致：

```ts
// src/pets/wild.ts
const SLOTS = 12
const HOUR = 3_600_000

export function wildPool(now = Date.now()) {
  const bucket = Math.floor(now / HOUR)
  const rnd = seeded(`wild-${bucket}`)
  return Array.from({ length: SLOTS }, (_, i) => {
    const recipe = randomRecipe(rnd)      // 图鉴之外的组合，画进运行时小图集
    const spot = WILD_SPOTS[Math.floor(rnd() * WILD_SPOTS.length)]
    return {
      id: `w-${bucket}-${i}`,
      recipe,
      palette: dullPalette(PALETTE_PRESETS[Math.floor(rnd() * 12)]),
      spawn: spot,               // 只决定「哪一带」，具体位置由漫游算出
      until: (bucket + 1) * HOUR,
    }
  })
}
```

野生宠物的配方**不在主图集里**，需要画进 `512²` 的运行时图集（64 格，12 只 × 8 帧 = 96 格 →
两张，或降到 6 只/批）。每轮换整批重画，约 1ms。

**领养后不进服务端列表**，而是本地记一条 `takenIds`（服务端返回），`wildPool()` 过滤掉即可。这样服务端不需要给野生宠物建表。

### 2.3 生成点 `WILD_SPOTS`

**直接沿用 `walkerRoutes`**（行人的路线就是人行道），沿线每 21m 取一点、向两侧偏 ±1.6m，
再用 `insideRoad()` 剔掉落在车行道上的一半，用建筑 AABB 算出每个点的「安全半径」。

实测得到 **84 个点**，全部在模块加载时算一次。

> 与最初设计的差异：没有落成 `wild-spots.json`。路线本来就是静态数据，
> 运行时算一次只要 1~2ms，反而是多一份需要同步的产物。

---

## 3. 漫游：零网络

宠物位置完全由 `(id, 时间)` 算出，任何客户端算出的位置都一致：

```ts
// src/pets/roam.ts
export function petPose(petId: string, spawn: Vec2, home: Vec2 | null, t: number) {
  const r = seeded(petId)
  const phase = r() * Math.PI * 2
  const radius = 3.5 + r() * 9
  const speed = 0.026 + r() * 0.018
  const cx = home?.x ?? spawn.x
  const cz = home?.z ?? spawn.z
  // 两个不同频率的正弦 → 轨迹不闭合，看着像在闲逛
  return {
    x: cx + Math.cos(t * speed + phase) * radius,
    z: cz + Math.sin(t * speed * 0.63 + phase * 1.7) * radius * 0.72,
  }
}
```

- `t` 用 `clock.elapsedTime + 页面加载时的 Unix 偏移`，**不要用本地时间戳**，否则刷新会瞬移
- 朝向由相邻两帧位移求差分
- 站位判断：如果算出的点在建筑内部，沿半径方向收缩到最近的合法距离（用 `buildings` 的 AABB 做一次粗判即可）

### 3.1 饱腹度影响行为

```ts
// 越饿走得越近、越慢，最后缩在家门口
const hungry = pet.ownerId && pet.hunger < 30
const radius = hungry ? 1.2 : baseRadius
const speed  = hungry ? 0.008 : baseSpeed
```

**这是全篇最重要的一个设计**：主人不上线，宠物会缩在家门口、毛色变暗。路过的所有人都看得见。社交压力比任何推送都有效。

---

## 4. 领养

### 4.1 交互

| 步骤 | 表现 |
|---|---|
| 靠近 2.5m | 地面出现淡淡的光圈；宠物停下，面朝玩家，后退 1.2m |
| 按 E | 弹出「投喂 / 领养」二选一（各消耗 1 份口粮） |
| 选领养 | 玩家蹲下，递出口粮；宠物犹豫 1.2s（抖两下），然后靠近 |
| 成功 | 项圈出现（`SLOT.collar` 亮起），头顶蹦出 ❤，提示「给它起个名字」 |
| 失败 | 服务端返回「它刚刚被 @某某 带走了」，宠物朝那个方向跑掉 |

### 4.2 并发（必须做，不做必炸）

野生宠物是**所有客户端都能看见**的，两个人同时点必然发生。服务端单次 CAS：

```js
// server/store/json-store.mjs
async adoptPet(petId, userId, nickname) {
  const pet = this.db.pets?.[petId]
  if (!pet) return { ok: false, reason: 'missing' }
  if (pet.ownerId) return { ok: false, reason: 'taken', ownerName: pet.ownerName }
  pet.ownerId = userId            // 单线程内检查+写入，天然原子
  pet.ownerName = this.db.users[userId].name
  pet.nickname = nickname
  pet.adoptedAt = Date.now()
  pet.hunger = 60
  await this.#flush()
  return { ok: true, pet }
}
```

pg 版本用一条带条件的 `UPDATE ... WHERE owner_id IS NULL RETURNING *`，`rowCount === 0` 即失败。

### 4.3 起名

- 2~10 字，复用现有 `clean(value, 10)` 和 `ID` 正则
- 不做重名检查（重名是常态，用 id 区分）
- 敏感词直接走现有举报流程，不预审

---

## 5. 口粮

### 5.1 规则

| 项 | 值 |
|---|---|
| 每日发放 | 3 份 |
| 领养消耗 | 1 份 |
| 投喂消耗 | 1 份 |
| 上限 | 囤积上限 6 份（防离线攒一堆） |
| 重置 | 本地日期跨天时服务端补发 |

```js
async claimRations(userId) {
  const u = this.db.users[userId]
  const today = new Date().toISOString().slice(0, 10)
  if (u.rationDay === today) return { ok: true, rations: u.rations, granted: 0 }
  u.rationDay = today
  u.rations = Math.min(6, (u.rations ?? 0) + 3)
  await this.#flush()
  return { ok: true, rations: u.rations, granted: 3 }
}
```

### 5.2 为什么是「稀缺」而不是「奖励」

3 份/天、囤积上限 6。这意味着**每天只能关心 3 次**。领养花掉 1 份，今天就没法把它喂饱。

这个取舍是刻意的：口粮不是打卡奖励，是**你做选择的资源**。绝不做「连续登录 7 天送 10 份」——那会把亲密关系变成 KPI。

---

## 6. 饱腹度

```ts
// 每小时 -3，满 100 约 33 小时见底
const hunger = clamp(100 - (Date.now() - lastFedAt) / 1_200_000, 0, 100)
```

**客户端算，服务端只存 `lastFedAt`。** 不需要定时任务。

| 饥饿段 | 表现 |
|---|---|
| 70–100 | 正常漫游，颜色正常 |
| 30–70 | 范围缩小一半 |
| 1–30 | 缩在家门口 1.2m 内，整体亮度 ×0.7，动作只有 sit |
| 0 | 蜷着，只显示 sleep 帧 |

---

## 7. 门口便利贴

这是留存核心，也是唯一真正的 UGC。

### 7.1 形态

**不是私信，是贴在门口。** 差别在可见性：

| | 私信 | 门口便利贴 |
|---|---|---|
| 可见范围 | 只有主人 | **所有人**经过都看得到 |
| 触发 | 推送 | 主人回楼下才看到 |
| 心理 | 被打扰 | 被惦记 |

### 7.2 数据

复用现有 `posts` 表，把 `targetType` 增加一个值 `'pet'`，`targetId` 就是 petId。

注意现有 pg 约束是 `CHECK (target_type IN ('place','space'))`，必须放宽（迁移语句见 [04-data-api.md](./04-data-api.md) 1.4）。json-store 侧无需迁移。

### 7.3 限制

- 300 字（沿用现有 `MAX_BODY`）
- 同一用户对同一宠物 **每日 1 条**（服务端按 `userId + petId + 日期` 查重）
- 只有**投喂过**的人能留言（这条同时解决刷屏和「你有资格说话吗」的问题）
- 举报入口复用现有 `/api/posts/:id/report`

### 7.4 展示

- 宠物家门口的地面上贴 3~5 张便利贴（最小字号，**只显示前 12 字 + 头像色点**）
- 按下 E 在主人楼下 → 打开完整列表
- 便利贴的颜色 = 留言者的 `user.color`，不需要新配色系统

---

## 8. UI

### 8.1 我的宠物（面板）

```
┌─────────────────────────────┐
│  [64×64 放大 4 倍的头像]      │
│  豆豆                        │
│  圆耳团子 · 领养于 10月24日    │
│  ─────────────────────────  │
│  饱腹  ████████░░ 78        │
│  [ 投喂 ]     [ 改名 ]       │
│  ─────────────────────────  │
│  门口留言 3                  │
│  "今天也看到它在花坛那边"  @A │
└─────────────────────────────┘
```

### 8.2 图鉴卡片

统一 `aspect-ratio: 1/1`：

- 已获得：正常精灵 + 昵称 + 获得日期
- 见过未获得：剪影（索引图全槽位强制为 1 号深灰）
- 从未见过：`?` + 只显示体型轮廓

**稀有度用边框色**（普通/少见/稀有/传说 = 灰/绿/紫/金），不用角标——角标在图鉴网格里会变成噪音。

---

## 9. 需要改动的文件

```
新增
  src/pets/wild.ts          wildPool() + 生成点（已完成）
  src/pets/roam.ts          petPose() + 朝向 + 躲人（已完成）
  src/pets/atlas-runtime.ts 运行时小图集（12 只 × 8 帧 = 96 格）
  src/pets/WildPets.tsx     宠物渲染 + 贴地暗斑（已完成，2 draw call）
  src/pets/AdoptDialog.tsx  领养/投喂
  src/pets/PetPanel.tsx     我的宠物

修改
  src/store.ts              pets / rations / myPet / adoptPet / feedPet
  src/api.ts                pets / adopt / feed / notes
  src/scene/CityScene.tsx   interactables 增加宠物
  src/ui/Panels.tsx         挂 PetPanel
  server/api.mjs            4 个新路由
  server/store/*.mjs        adoptPet / feedPet / rations / petNotes
```

---

## 10. M2 / M3 验收

**M2**
1. 街上有 12 只野生宠物，刷新页面位置不跳
2. 靠近按 E 能领养，项圈立刻出现
3. 开两个浏览器同抢一只：一个成功，一个收到「已被带走」
4. 领养后宠物自动走回楼下，不再出现在野生池

**M3**
1. 每天第一次打开补 3 份口粮，第二次不补
2. 领养花 1 份，剩余数量正确
3. 把 `lastFedAt` 改成 36 小时前，宠物缩在门口且变暗
4. 别人投喂后，他能在门口留言，主人回楼下能看到
5. 同一用户对同一宠物当天发第二条留言被拒
