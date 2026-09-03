# 小红书 · 小工具

## 官方文档

- [小工具服务协议](https://agree.xiaohongshu.com/h5/terms/ZXXY20260630004/-1)
- [创作服务平台 · 小工具](https://creator.xiaohongshu.com/new/red-app)（上传入口）

## 本仓库规范（权威）

小红书与抖音/快手要求不同，**以本目录官方 Skill 为准**：

```
xiaohongshu/
├── guidelines.md              # 本文件（入口摘要）
├── minitool-zip-builder/      # 官方打包 Skill v1.6.0
│   ├── SKILL.md               # 工作流程
│   ├── references/            # 详细约束
│   └── scripts/audit_artifact.mjs
├── crop-grid/                 # 轻映（照片加工：裁切/圆角/宫格）
│   ├── index.html
│   └── icon.png
└── bead-pattern/              # 豆图（照片转拼豆图纸）
    ├── index.html
    ├── style.css
    ├── palettes.js
    └── app.js
```

打包前读 `minitool-zip-builder/SKILL.md`，按 reference 逐项核对。

上架素材（轻映）：名称「轻映」、简介「图片裁切与多宫格分图」、图标 `xiaohongshu/crop-grid/icon.png`  
产物：`xiaohongshu/crop-grid/dist/qingying.zip`

豆图：名称「豆图」、目录 `xiaohongshu/bead-pattern/`（未上架）

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

## 焚香计时 · 打包流程

```bash
# 1. 打包（小红书走多文件：index.html + style.css + app.js）
cd incense-timer && node build.mjs xiaohongshu

# 2. 官方审计
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```

产物：`incense-timer/dist/xiaohongshu-incense-timer.zip`  
上架素材：名称「焚香计时」、简介「焚香倒计时，自选时长，看香逐渐燃尽。」、图标 `incense-timer/icon.png`

## 发布

- 需创作者认证 / 小工具内测权限
- 上传 zip → 平台预览 → 选版本与权限 → 提审
