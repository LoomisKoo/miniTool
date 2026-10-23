# 微光城区 / LUMEN DISTRICT

isocity 的第三个入口：一座可探索、可进入建筑、可留言、可认领与布置个人空间的 3D 城市 Demo。

- 前端：React + TypeScript + Vite + Three.js / React Three Fiber / Drei + Zustand
- 后端：Node.js + Express，同一套 API 也可运行在阿里云函数计算（`server/fc.mjs`）
- 存储：本地 JSON（默认，适合试玩）或 PostgreSQL（并发认领与持久化）
- 3D 内容全部由 Three.js 几何体和程序化 Canvas 纹理生成，不依赖外部模型/贴图

---

## 快速启动

要求 Node.js 18+。

```bash
cd iso-city-demo
npm install
npm run dev
```

打开：

- 城市：<http://localhost:5173/city.html>
- 图鉴主页（含第三个入口卡片）：<http://localhost:5173/>

`npm run dev` 会同时启动 Vite（5173）和 API（8787）。首次进入会自动创建访客身份。

也可以分开启动：

```bash
npm run dev:api   # Node API :8787
npm run dev:web   # Vite :5173（/api 已代理到 8787）
```

### 生产构建

```bash
npm run build     # 输出 dist/（包含 city.html 与原 index.html 图鉴）
npm start         # Express 同时提供 API 与 dist 静态站点，默认 :8787
```

访问 `http://localhost:8787/city.html`。

---

## 环境变量

本地默认值即可试玩；部署前必须设置 `AUTH_SECRET`。可在项目根目录 `.env` 或 `server/.env` 中配置，参考 `server/.env.example`。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `PORT` | 否 | API / Express 端口，默认 `8787` |
| `AUTH_SECRET` | 生产必填 | 访客 token 的 HMAC 密钥，建议 32+ 位随机串 |
| `DATABASE_URL` | 否 | PostgreSQL 连接串；留空时使用 `server/data/db.json` |
| `PG_SSL` | 否 | 设为 `false` 关闭 SSL（默认开启，`rejectUnauthorized: false`） |
| `PG_POOL_SIZE` | 否 | 连接池大小，默认 `5` |
| `PUBLIC_APP_URL` | 否 | 分享链接的站点地址，如 `https://example.com/city.html` |
| `ALLOW_ORIGIN` | 否 | CORS 允许来源，默认 `*` |
| `VITE_API_BASE` | 否 | 前端 API 前缀（前后端分域部署时用），默认同源 `/api` |

示例：

```bash
AUTH_SECRET=$(openssl rand -hex 32)
DATABASE_URL=postgres://user:password@host:5432/lumen?sslmode=require
PUBLIC_APP_URL=https://example.com/city.html
```

### PostgreSQL

设置 `DATABASE_URL` 后，`PgStore.init()` 会自动执行 `server/db/schema.sql`；也可手动执行：

```bash
psql "$DATABASE_URL" -f server/db/schema.sql
```

关键约束：

- `spaces_one_per_owner` 唯一索引 + 认领事务行锁，保证每人同时只拥有一间空间；
- 认领同一空间时通过 `SELECT ... FOR UPDATE` 串行化，避免双人同时认领；
- `visits_one_per_user` 保证同一访客在同一空间只留下一次访问印记。

### 阿里云函数计算

- 入口：`server/fc.mjs`，处理程序 `fc.handler`
- 运行时：Node.js 18/20
- 需要配置：`DATABASE_URL`、`AUTH_SECRET`、`PUBLIC_APP_URL`、`ALLOW_ORIGIN`
- 生产必须使用 PostgreSQL；未配置时 FC 会退回 `/tmp` JSON，不跨实例持久化
- 前端 `dist/` 部署到静态站点 / OSS / CDN；API 域名与静态域名不同时，通过 `VITE_API_BASE` 指向函数计算 HTTP 触发器地址

---

## 已实现玩法

### 城市

- 主街、镜池广场、回声巷、雪松步道与微光塔地标
- 不同高度/材质/屋顶细节的建筑群，远处剪影楼群
- 5 个可进入入口：光盒美术馆、街角咖啡、河岸公寓 07F、声场唱片 B1、美术馆 2F
- 第三人称 WASD + 鼠标视角、Shift 奔跑、空格跳跃与体力限制滑翔
- 建筑/广场/家具碰撞、相机遮挡收缩、稳定边界，不会掉出场景

### 地点内容

- 预置 NPC 留言、程序化图像与声音占位
- 地点气泡近看展开、远看轻量标签
- 阅读、发布、回复、收藏、删除自己的留言、举报（3 次自动隐藏）
- 内容始终带服务端作者身份、地点关联与时间

### 访客身份与空间

- 首次进入时服务端创建访客身份并签发 HMAC token，不要求注册
- 每人同时只能认领一间空间；认领、放弃、保存均由服务端校验
- 可设置名称、简介、用途模板、墙/地颜色、画作、开放状态
- 最多 16 件程序化家具，支持放置、拖动（点地面）、旋转、换色、删除
- 公共空间与未认领空间有样板陈设，不会出现大片空白
- 访客浏览、收藏、留言、留下访问印记；房主可查看访问记录

### 分享

- 复制当前城市、公共地点或房间链接
- 房间链接形如 `?space=river-loft&enter=1`，打开直接进入房间
- 公共室内形如 `?enter=gallery` / `?enter=cafe`
- 地点形如 `?place=plaza-fountain`
- 页面标题与 `description` 会随当前地点/房间更新（便于分享预览）

---

## 操作

| 输入 | 作用 |
| --- | --- |
| 点击画面 | 锁定鼠标，进入自由视角 |
| WASD | 行走 |
| Shift | 奔跑 |
| 空格 | 跳跃；下落时按住滑翔（消耗体力） |
| E | 与最近的地点、入口、留言台、控制台互动 |
| Esc | 释放鼠标 / 关闭面板 |
| 鼠标左键点击气泡 | 也可直接打开地点 |

---

## 数据与重置

- 本地 JSON：`server/data/db.json`（已加入 `.gitignore`）
- 重置本地数据：

```bash
npm run reset
```

- PostgreSQL：手动清空表或重建 schema。

示例内容来自 `server/seed.mjs`，前后端共用 id：`river-loft`、`light-gallery`、`sound-room`、`gallery-lobby`、`corner-cafe` 等。

---

## 目录

```text
src/
  scene/      城市地面、建筑、道具、玩家、标记、程序化纹理
  indoor/     室内场景与家具组件
  ui/         封面、HUD、面板、编辑器、Toast
  game/       可移动角色状态与键鼠输入
  data/       城市/室内配置
  store.ts    Zustand 状态与 API 动作
server/
  api.mjs     统一 REST API（Express / FC 复用）
  store/      JSON 与 PostgreSQL 存储实现
  seed.mjs    示例城市内容
scripts/      双进程开发与构建打包
```

---

## 当前范围与后续

- 第一版不做 WebSocket 实时玩家同步，不做账号登录/正式绑定（身份模型已预留 `accountId`）
- 家具/画作均使用程序化几何与 Canvas 纹理，不依赖对象存储；后续可把 `mediaRef` 接到 OSS
- 城市为小规模 Demo，重点在“探索 → 进入 → 留言 → 认领/布置 → 分享”的完整闭环
