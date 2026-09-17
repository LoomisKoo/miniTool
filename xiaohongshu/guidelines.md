# 小红书 · 小工具

## 官方文档

- [小工具容器能力清单](https://miniapp-sandbox.xiaohongshu.com/minitool/doc)（容器可用 / 不可用能力、端能力 JS API、FAQ）
- [小工具服务协议](https://agree.xiaohongshu.com/h5/terms/ZXXY20260630004/-1)
- [创作服务平台 · 小工具](https://creator.xiaohongshu.com/new/red-app)（上传入口）

## 本目录内容

本目录**只放平台规范与 Skill**，产品源码在仓库根目录各工具文件夹。

```
xiaohongshu/
├── guidelines.md              # 本文件（入口摘要）
└── minitool-zip-builder/      # 官方打包 Skill v1.6.0
    ├── SKILL.md               # 工作流程
    ├── references/            # 详细约束
    └── scripts/audit_artifact.mjs
```

打包前读 `minitool-zip-builder/SKILL.md`，按 reference 逐项核对。

### 上架素材与产物

| 工具 | 名称 | 简介 | 状态 | 图标 | 小红书 zip |
| --- | --- | --- | --- | --- | --- |
| 风铃物语 | 风铃物语 | 治愈系梦幻风铃 | 待提审 | `wind-chime/assets/icon.jpg` | `wind-chime/dist/xiaohongshu-wind-chime.zip` |
| 兔格拼豆 | 兔格拼豆 | 照片转拼豆色号图纸 | 审核中（1.0.1） | `rabbit-bead/icon.png` | `rabbit-bead/dist/xiaohongshu-rabbit-bead.zip` |
| 焚香计时 | 焚香计时 | 焚香倒计时，自选时长，看香逐渐燃尽。 | ✅ 已上线 | `incense-timer/icon.png` | `incense-timer/dist/xiaohongshu-incense-timer.zip` |
| 轻映 | 轻映 | 图片裁切与多宫格分图 | ✅ 已上线 | `crop-grid/icon.png` | `crop-grid/dist/xiaohongshu-qingying.zip` |
| 星空跳一跳 | 星空跳一跳 | 跳一跳星空改良版 | ✅ 已上线 | `xingkong-jump/assets/icon.jpg` | `xingkong-jump/dist/xiaohongshu-xingkong-jump.zip` |
| 纸灯夜航 | 纸灯夜航 | 休闲小游戏，杀时间必备 | ✅ 已上线 | `paper-lantern/assets/icon.jpg` | `paper-lantern/dist/xiaohongshu-paper-lantern.zip` |
| 爆红书 | 爆红书 | 模拟爆红，看笔记从零涨到爆 | 未上架 | `baohongshu/assets/icon.jpg` | `baohongshu/dist/xiaohongshu-baohongshu.zip` |
| 美食地图 | 美食地图 | 地图上看懂各地饮食 | 未上架 | 待生成 | `food-map/dist/xiaohongshu-meishitujian.zip` |

跨项目总表见根目录 [README 发布总表](../README.md#发布总表)（小红书 / 快手状态一致）。

## 与抖音/快手的核心差异

| 项 | 小红书 | 抖音/快手 |
| --- | --- | --- |
| 脚本 | **必须**外置 `.js`，禁止内联 `<script>` | 可单文件内联 |
| 模块 | 禁止 `type="module"` / `import` | 相对宽松 |
| HTML 事件 | 禁止 `onclick=` 等行内属性 | 相对宽松 |
| 样式 | 可内联 `<style>` 或外置 `.css` | 可内联 |
| 包体上限 | **10MB**（建议 ≤2MB） | 8MB |
| WebView 基线 | Chrome 61 / ES2017 | 较新 |

完整禁止项、JSBridge、性能预算见 `minitool-zip-builder/references/`。

## 端能力（Native）速查

容器注入 `window.xhs.miniTool.*`，共 **5 组** API（不传回调返回 Promise，传 `success`/`fail`/`complete` 返回 `undefined`）。完整字段表见 [`minitool-zip-builder/references/jsbridge-api.md`](minitool-zip-builder/references/jsbridge-api.md)。

| API | 用途 | 关键约束 |
| --- | --- | --- |
| `postNote` | 唤起发布页（图文 / 视频 / 实况） | `mediaInfo` 必填；标题 ≤20、正文 ≤1000；实况需客户端 9.43+ |
| `saveImageToPhotosAlbum` | 存图到系统相册 | `filePath` 只吃 `data:` base64 或本地路径，**网络地址会失败**；需用户手势触发 |
| `writeTempFile` | base64 → 临时文件 | `data` 必须是完整 data:uri（`canvas.toDataURL()` 原样传）；路径即用即弃 |
| `getLaunchOptions` | 读客户端版本 | 同步优先 `window.xhs.launchOptions.miniToolEnv.buildVersion` |
| `setStorage` / `getStorage` / `getStorageInfo` / `removeStorage` / `clearStorage` | 本地持久化 | 需客户端 **≥ 9.46.0**；单 key ≤1MB、总量 ≤10MB |

**持久化规则（重要）**：小工具本地缓存**首选 Storage JS API**，`localStorage` / `IndexedDB` / Cookie 只作低版本降级——容器不保证其可用性、持久性。降级路径读写都要异常兜底，并容忍数据缺失或被清理；版本升级后的数据迁移自行维护。可复用适配代码见 `references/jsbridge-api.md` 的 `saveData` / `loadData`。

**容易踩的坑**：

- `a[download]`、blob 下载被禁用 → 导出图片一律走 `writeTempFile` + `saveImageToPhotosAlbum` / `postNote`。
- 全屏 `requestFullscreen`、`window.open`、剪贴板、`navigator.geolocation`、Worker、WASM、`eval` 均不可用。
- 不联网：媒体字段与所有资源只接受包内文件或 `data:` / `blob:`。
- 调用前判空 `window.xhs && window.xhs.miniTool`，未注入（如普通浏览器预览）时走降级路径。

## 顶部安全区（必遵）

容器顶部有系统导航/关闭等按钮，**可交互控件与重要文案不得顶到屏幕最上沿**。

顶部是 **两段**，不要写成「只有 44px」：

| 部分 | 变量 | 说明 |
| --- | --- | --- |
| 手机安全区 | `--safe-t` | `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`，刘海/状态栏 |
| 容器导航栏 | `--nav-h` | 固定约 **44px**，小红书容器自带顶栏 |
| 合计 | `--xhs-nav` | `calc(var(--safe-t) + var(--nav-h))`，整页顶 inset |

```css
--safe-t: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
--nav-h: 44px;
--xhs-top: var(--safe-t); /* 仅安全区 */
--xhs-nav: calc(var(--safe-t) + var(--nav-h)); /* 安全区 + 容器导航 */
.top-ui { top: calc(12px + var(--xhs-nav)); }
/* 或整页：padding-top: var(--xhs-nav); */
```

- 安全区须用 `var(--safe-area-inset-*, env(...))` 组合（模拟器注入变量，真机用 `env()`），并配合 `viewport-fit=cover`。
- **不要**写成 `max(44px, safe-t)`，会把两段混在一起。
- 以后开发页面均遵循：内容避开顶部安全区，避免与系统按钮重叠。

### 小红书 vs 快手（顶部）

| | 小红书 | 快手 |
| --- | --- | --- |
| 手机安全区 `--safe-t` | 要 | 通常置 `0`（单独打包时覆盖） |
| 容器导航 `--nav-h` | `44px` | 置 `0`（无小红书式容器顶栏） |
| 一级页标题 | 由容器导航显示；页内可用等高占位 | **不需要**页内一级标题（首页/发现/消息等） |
| 适配方式 | 源码默认按小红书 | `build.mjs` 按平台追加 CSS，把 `--safe-t` / `--nav-h` / `--xhs-*` 置 0 |

二级页（详情、私信、他人主页等）若自带返回栏，两边都保留页内顶栏。

## 打包流程（通用）

```bash
# 1. 在工具目录打包小红书
cd incense-timer && node build.mjs xiaohongshu
# 或: cd crop-grid && node build.mjs xiaohongshu
# 或: cd rabbit-bead && node build.mjs xiaohongshu

# 2. 官方审计
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```

产物命名：`dist/xiaohongshu-{工具}.zip`

## 发布

- 需创作者认证 / 小工具内测权限
- 上传 zip → 平台预览 → 选版本与权限 → 提审
