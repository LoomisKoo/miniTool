# 小红书 · 小工具

## 官方文档

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

| 工具 | 名称 | 简介 | 图标 | 小红书 zip |
| --- | --- | --- | --- | --- |
| 轻映 | 轻映 | 图片裁切与多宫格分图 | `crop-grid/icon.png` | `crop-grid/dist/xiaohongshu-qingying.zip` |
| 兔格拼豆 | 兔格拼豆 | 照片转拼豆色号图纸 | `bead-pattern/icon.png` | `bead-pattern/dist/xiaohongshu-bead-pattern.zip` |
| 焚香计时 | 焚香计时 | 焚香倒计时，自选时长，看香逐渐燃尽。 | `incense-timer/icon.png` | `incense-timer/dist/xiaohongshu-incense-timer.zip` |

轻映状态：**小红书已提审（审核中）**

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

## 顶部安全区（必遵）

容器顶部有系统导航/关闭等按钮，**可交互控件与重要文案不得顶到屏幕最上沿**。

- 顶部预留高度约 **导航栏高度 `44px`**，再叠加安全区：
  ```css
  --safe-t: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
  --nav-h: 44px; /* 约等于一般导航栏高度 */
  .top-ui { top: calc(12px + var(--safe-t) + var(--nav-h)); }
  /* 或整页：padding-top: calc(var(--safe-t) + var(--nav-h)); */
  ```
- 安全区须用 `var(--safe-area-inset-*, env(...))` 组合（模拟器注入变量，真机用 `env()`），并配合 `viewport-fit=cover`。
- 以后开发页面均遵循：内容避开顶部安全区，避免与系统按钮重叠。

## 打包流程（通用）

```bash
# 1. 在工具目录打包小红书
cd incense-timer && node build.mjs xiaohongshu
# 或: cd crop-grid && node build.mjs xiaohongshu
# 或: cd bead-pattern && node build.mjs xiaohongshu

# 2. 官方审计
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```

产物命名：`dist/xiaohongshu-{工具}.zip`

## 发布

- 需创作者认证 / 小工具内测权限
- 上传 zip → 平台预览 → 选版本与权限 → 提审
