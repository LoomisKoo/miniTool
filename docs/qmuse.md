# QMuse 上传规范

把本仓库的小工具导入 QMuse（妙思）平台的统一流程。适用于**任何新工具**，不限于美食地图。

> 配套 skill：`.agents/skills/abao-zip-import-dockor`（含安全门禁、审计脚本、排障手册）。
> 本文件只讲**本仓库怎么用**，skill 里的通用规则以 skill 为准。

---

## 一、硬约束（不符合就不用往下走）

| 约束 | 说明 |
| --- | --- |
| **只接受 React 工程** | `qmuse import` 明确要求 React 仓库。纯 HTML / Vue / 原生 JS 必须先适配 |
| **必须用大赛账号** | 所属产品须为「智能体涌现奖大赛账号」，否则 skill 门禁 STOP |
| **登录走 `qmuse.cn` 浏览器会话** | CLI 不让你输账号，它沿用浏览器里 `qmuse.cn` 已登录的会话 |
| **上传根必须在项目外** | staging 不能放在被收集的目录里，否则递归收集 |
| **图片会导致检查点阻断** | 见下方「⚠️ 图片文件」 |

### ⚠️ 图片文件（最容易踩的坑）

审计脚本 `audit-source.mjs` 对 **PNG / JPG / GIF / WEBP** 一律标记 `binary-media-review`（按文件头魔数识别），只要命中：

- 审计状态 → `REVIEW_REQUIRED`（不是 PASS）
- `pre-submit.mjs` 硬性要求 `status === 'PASS'` → **直接 BLOCKED，exit 1**

**因此项目里只要有一张位图，第 6 阶段机械检查点就无法通过。**

三种处理方式：

| 方案 | 做法 | 代价 |
| --- | --- | --- |
| **推荐：改用 SVG 图标** | SVG 是文本，不触发该规则；审计可拿干净 PASS | 需自备 SVG |
| 不传图标 | 从上传集合移除图片，并删掉 HTML 里的 `favicon` / `apple-touch-icon` 引用 | 无自定义图标，功能不受影响 |
| 记录豁免后继续 | 落盘 `exemptions.json`，把豁免绑定到精确 hash + 规则名，然后在报告中标注「阶段 6 偏离」 | 流程不完整，需人工担责 |

---

## 二、一次性环境

工具与 CLI 固定放在仓库根 `.qmuse-tools/`（**不是**全局安装，各工具共用一份）：

```bash
# 已安装，无需重复执行
cat .qmuse-tools/package.json      # 锁定 @qmuse/qmuse-cli 版本

# 升级时（改精确版本号，不加 latest）
npm install --prefix .qmuse-tools --ignore-scripts --save-exact "@qmuse/qmuse-cli@<版本>"

# 验证
./.qmuse-tools/node_modules/.bin/qmuse --version
```

- 要求 **Node ≥ 20**（`node -v` 检查）
- `.qmuse-tools/node_modules/` 已被 `.gitignore` 忽略；`package.json` / `package-lock.json` **入库**以锁定版本

---

## 三、登录与账号门禁

```bash
QMUSE=./.qmuse-tools/node_modules/.bin/qmuse
$QMUSE login
$QMUSE whoami --json
$QMUSE space list --json
```

### 判定规则

`whoami --json` 返回的 `tenantName` 必须显示 **「智能体涌现奖大赛账号」**。

- ❌ 显示 `QMuse` → 绑定了个人账号，禁止导入
- ⚠️ 内部 `tenantCode` 是敏感值，**不要输出给用户**，对外只用 `tenantName`

### 绑到错误账号时

CLI 打开的是 `https://qmuse.cn/cli-auth`，会**沿用浏览器里 `qmuse.cn` 的会话**。所以关键是让浏览器在 `qmuse.cn` 上登着大赛账号。

```bash
# 1. 退出 CLI 登录态
$QMUSE logout

# 2. 在浏览器打开 https://qmuse.cn ，退出登录 → 用大赛账号重新登录
#    并确认左上角显示的账号是参赛账号

# 3. 用 Chrome 打开授权页重新绑定（避免系统默认浏览器登着别的账号）
node --import ./.qmuse-tools/chrome-open/register.mjs \
  ./.qmuse-tools/node_modules/@qmuse/qmuse-cli/dist/cli.js login
```

`chrome-open/` 是一个 Node loader 钩子，把 CLI 内部调用的 `open` 包替换成「强制用 Google Chrome 打开」。这一步可显著减少重复 `logout`/`login` 的次数。

---

## 四、标准流程

约定：**原工具目录保持不变**，适配产物放同级 `<工具名>-qmuse/`，方便对比与回滚。

```
food-map/            ← 原版（基准，不改）
food-map-qmuse/      ← React 适配版（导入这个）
.qmuse-staging/      ← 上传用的冻结副本（.gitignore）
alignment/           ← 对齐证据（不入上传集合）
```

```bash
cd <工具名>-qmuse && npm install && npm run build
```

### 1. 命名

优先级：用户指定 → `apps.json`/`app.json` → `package.json#name` → `标题与介绍.txt`/`title.txt` → README 明确名称。禁止用目录名兜底。

### 2. 建 staging（项目外）

按运行依赖白名单复制普通文件到 `.qmuse-staging/<工具名>-qmuse/`，必须拒绝 symlink / hardlink / 特殊文件，并输出路径清单。

典型白名单：`package.json`、`package-lock.json`、`tsconfig.json`、`vite.config.ts`、`index.html`、`README.md`、`.gitignore`、`src/`、`public/`。

### 3. 审计

```bash
node .agents/skills/abao-zip-import-dockor/scripts/audit-source.mjs tree \
  "$(pwd)/.qmuse-staging/<工具名>-qmuse" \
  | tee /tmp/qmuse-stage/audit.json
```

- `PASS`（exit 0）→ 可继续
- `REVIEW_REQUIRED`（exit 2）→ 通常是图片，按第一节处理
- `BLOCKED`（exit 1）→ **停止上传**

记录 `fileCount` / `totalBytes` / `manifestSha256`。

### 4. 检查点

```bash
node .agents/skills/abao-zip-import-dockor/scripts/pre-submit.mjs \
  --project-root   "$(pwd)/<工具名>-qmuse" \
  --staging-root   "$(pwd)/.qmuse-staging/<工具名>-qmuse" \
  --title          "<应用名>" \
  --title-source   "README" \
  --space-id       "<spaceId>" \
  --operation      "CREATE" \
  --output         "/tmp/qmuse-stage/pre-submit.json"
```

首次导入用 `CREATE`；重传用 `UPDATE` 并加 `--target-app-id "<既有appId>"`。

### 5. 上传

```bash
cd <工具名>-qmuse
$QMUSE import "$(pwd)/../.qmuse-staging/<工具名>-qmuse" \
  --title "<应用名>" --space-id "<spaceId>" --no-open --json \
  | tee /tmp/qmuse-stage/1-import-create.json

# 必须等 READY，success:true 不算完成
$QMUSE import status "<jobId>" --wait --no-open --json \
  | tee /tmp/qmuse-stage/2-import-status.json
```

`READY` 判据：输出含 `templateCommit` / `assetCount` / `contentSafetyStatus` / `operation` 字段（这些只在 READY 分支产生）。默认等待预算 15 分钟；预算耗尽保存为 `PENDING`，用同一 `jobId` 续查，**不要重新 import**。

### 6. 建绑定（供以后重传复用 appId）

CLI 可能不会自动为外部仓库生成绑定。首次 CREATE 到 READY 后手动创建：

```bash
node .agents/skills/abao-zip-import-dockor/scripts/create-binding.mjs \
  "$(pwd)/<工具名>-qmuse" \
  --evidence        /tmp/qmuse-stage/1-import-create.json \
  --status-evidence /tmp/qmuse-stage/2-import-status.json \
  --space-id        "<spaceId>" \
  --expected-app-id "<appId>" \
  --env prod
```

证据文件必须在项目根**之外**，且必须是本次可信 CLI 输出，字段不全就停。

### 7. 以后重传

绑定存在 → 默认 `UPDATE`，复用原 `appId` 出新版本：

```bash
# 重传必须从带 .qmuse/project.json 的项目根导入，不要用 staging 目录（staging 无绑定会误 CREATE 出新应用）
cd <工具名>-qmuse
$QMUSE import . --title "<应用名>" --space-id "<spaceId>" --no-open --json
```

READY 后必须核对：`operation=UPDATE`、`appId` 不变、`versionId` 已更新。若出现 `CREATE` 或 appId 变化 → 立即停止。

---

## 五、非 React 工具适配（HTML → React + Vite）

常用做法是**保留原始 HTML/JS，外面套 React 壳**，而不是重写业务逻辑。

目录：

```
<工具名>-qmuse/
├── index.html          # Vite 入口：#root + 全局元素
├── src/
│   ├── main.tsx        # createRoot(...).render(<App />)，不要 StrictMode
│   ├── App.tsx         # 注入原始结构 → 按序注入 legacy 脚本
│   ├── body.ts         # 原 index.html 中 #app 的内部 HTML（程序化提取）
│   └── index.css       # 原 style.css
├── public/legacy/      # 原 js/css 资源（原样复制）
├── public/assets/      # 原图片资源
├── vite.config.ts      # base: './'
└── tsconfig.json       # strict，build 先跑 tsc --noEmit
```

关键点：

| 要点 | 原因 |
| --- | --- |
| `base: './'` | 适配任意子路径部署 |
| legacy 脚本基址用 `window.__basement_public_path__` / `publicPath`，勿只用 `document.baseURI` | 正式发布页在 `render.*`，静态在 `renderstatic.*`；只用 baseURI 会导致 `legacy/*.js` 404 黑屏 |
| 其余资源 URL 用 `new URL(rel, assetBase())`，`assetBase` 优先 publicPath | 本地 dev 无注入时回退 `document.baseURI` |
| 脚本**外部引入**而非内联到 `innerHTML` | 内联会引发全局词法声明冲突 |
| 按原顺序串行注入（`script.async = false` + onload 链） | 脚本间靠全局变量通信，顺序不能乱 |
| `window.__xxx_loaded` 守卫 | 防重复初始化 / 重复绑事件 |
| **不用 `React.StrictMode`** | 双执行会导致重复初始化 |
| 先设 `innerHTML` 再注入脚本 | 规避脚本执行时 DOM 未就绪 |
| 原 `#app` 布局加 `#root` 高度 | React 多一层挂载节点，否则高度塌陷 |

### QMuse 正式环境：`render.*` 与 `renderstatic.*` 分离（必读）

妙思**预览**和**正式发布**的 HTML 域名与静态资源域名不一致：

| 环境 | 页面 URL 示例 | 静态资源 |
| --- | --- | --- |
| 预览 / 本地 | 常与资源同域或 Vite dev | `document.baseURI` 往往够用 |
| 正式发布 | `https://render.<域>/p/muse/<appId>-<versionId>/index.html` | `https://renderstatic.<域>/p/muse/<appId>-<versionId>/` |

页面 `<head>` 会注入（二者等价，优先使用）：

```html
<script>
  window.publicPath = window.__basement_public_path__ = "https://renderstatic.../";
</script>
```

**所有** `public/` 下在运行时动态拼出来的 URL（尤其是 `legacy/*.js`）必须用注入路径作基址，**不能**只用 `document.baseURI`（那是 `render.*`，对 `legacy/app.js` 会 **404**）。

参考实现（`food-map-qmuse/src/App.tsx`、`cinema-seat-qmuse/src/App.tsx`）：

```ts
function assetBase(): string {
  const w = window as Window & {
    __basement_public_path__?: string;
    publicPath?: string;
  };
  return w.__basement_public_path__ || w.publicPath || document.baseURI;
}

function resolveLegacyUrl(rel: string): string {
  return new URL(rel, assetBase()).href;
}
```

**典型故障（影厅模拟器 2026-03 曾踩坑）**：

- 预览正常，上线后首页「像坏了」：影厅名等静态 HTML 还在，但**座位行、近视/散光度数按钮**整块空白。
- 原因：`legacy/app.js` 404，业务脚本未执行，只有 `body.ts` 里的静态文案。
- 自检：浏览器 Network 看 `legacy/app.js` 是否 200；或 `curl -sI` 对比  
  `renderstatic.../legacy/app.js`（应 200）与 `render.../legacy/app.js`（常 404）。

容器/安全区变量要按 QMuse 环境调：原项目常为某平台（如小红书容器顶栏）预留 `--nav-h`，QMuse 无容器顶栏时应置 `0px`。

**CSS 保真**：原样逐行迁移选择器与值，只允许两项记录在案的变换——静态颜色变量硬编码、容器选择器扩展（加 `#root`）。不要擅自加 reset 或改定位。

**不要改原工具目录**，它是视觉/功能对比的基准。适配后按 skill 要求产出 `alignment/{page-inventory,gaps,css-migration-map}.json`。

---

## 六、命令速查

```bash
QMUSE=./.qmuse-tools/node_modules/.bin/qmuse

$QMUSE whoami --json                 # 账号 + 空间
$QMUSE space list --json             # 空间列表
$QMUSE import <dir> --title <t> --space-id <sid> --no-open --json
$QMUSE import status <jobId> --wait --no-open --json

# 只读的登录状态（不弹浏览器）
$QMUSE login --status
```

**不要用**：`qmuse space use`（会改全局空间）、`--env pre`（正式门禁禁用）、裸 `qmuse space`（不存在）。

---

## 七、常见问题

| 现象 | 原因与处理 |
| --- | --- |
| `whoami` 一直显示个人账号，反复登录无效 | CLI 沿用浏览器 `qmuse.cn` 会话。换账号登录，或改用 `chrome-open` 钩子 |
| `pre-submit` 返回 `BLOCKED: audit did not PASS` | 集合里有位图（PNG/JPG/GIF/WEBP）。改用 SVG 或按第一节豁免 |
| `import` 成功但没进入后续分支 | `success:true` 不是终态，必须 `import status --wait` 等到 `READY` |
| `qmuse: command not found` | 未用全局安装。使用 `.qmuse-tools/node_modules/.bin/qmuse` |
| 导入超时 | 用**同一个** `jobId` 继续 `import status --wait`，禁止重新 `import` 造新任务 |
| 重复 CREATE 出第二个应用 | 绑定缺失时才会发生。检查 `<工具名>-qmuse/.qmuse/project.json` 是否存在 |
| 页面白屏 | 检查脚本注入顺序、`#root`/`#app` 高度、是否误用了 StrictMode |
| 预览正常，正式链接部分 UI 空白（动态区块无按钮） | 多为 `legacy/*.js` 用 `document.baseURI` 拼 URL → `render.*` 404。改为 `publicPath` / `__basement_public_path__`，见第五节「render 与 renderstatic 分离」 |
| 正式页按钮白底白字、选中无高亮 | 妙思宿主覆盖 `button` 样式；需 `index.css` 宿主段 + `hostStyles.ts` 按 `.on` 分支，且勿在 MutationObserver 里把选中态又刷成透明 |
| 影厅点横屏不旋转、画面整体下移 | 部分 WebView 用 `innerWidth/innerHeight` 误判为横屏，只走了 `orientation-landscape` 留白布局未加 `rotate-stage`；应用 `screen.orientation` 判断物理横屏，且 `.rotate-stage` 需 `position:fixed` 全屏以免被 `#app` 裁切 |

---

## 八、新工具上传 Checklist

- [ ] 原工具目录**未改动**，适配产物在 `<工具名>-qmuse/`
- [ ] `npm run build` 通过（`tsc --noEmit` + `vite build`）
- [ ] 图标避开位图（用 SVG 或明确豁免）
- [ ] `whoami` 的 `tenantName` = 智能体涌现奖大赛账号
- [ ] staging 建在项目外，白名单复制、无 symlink/hardlink
- [ ] 审计有 `PASS` 记录（或已落盘豁免）
- [ ] `pre-submit` 通过，或已明确记录偏离
- [ ] `import` 后等到 `READY`
- [ ] `operation` / `appId` / `versionId` 已回读核对
- [ ] 已建 `.qmuse/project.json` 绑定
- [ ] `App.tsx` 中 legacy / 动态资源 URL 使用 `assetBase()`（`publicPath`），上线前用正式 `render.lebuding.com` 链接核对 Network 里 `legacy/*.js` 为 200
- [ ] 对齐证据落在 `alignment/`（不入上传集合）

---

## 九、已导入记录

| 工具 | appId | spaceId | 首次版本 | 操作 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 美食地图 | `4801133495066723` | `S095583120738` | `83600816`（当前） | UPDATE | `food-map-qmuse/`；修复 publicPath 后 UPDATE；勿从 staging 目录 import |
| 影厅模拟器 | `6962773893296222` | `S095583120738` | `83600855`（当前） | UPDATE | legacy `publicPath`；横屏 `rotate-stage` + `screen.orientation` |
