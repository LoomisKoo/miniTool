# 焚香计时

焚香倒计时，自选时长，看香逐渐燃尽。

离线 Canvas 燃香计时小工具。源码共用，各平台独立打包上传。

## 上架信息

| 项 | 内容 |
| --- | --- |
| 名称 | 焚香计时 |
| 简介 | 焚香倒计时，自选时长，看香逐渐燃尽。 |
| 图标 | `incense-timer/icon.png`（各平台上架封面/图标用，不打进 zip 包） |

### 发布状态

仓库根目录有跨项目 [发布总表](../README.md#发布总表)；此处只记本工具。

| 平台 | 状态 | 版本 | 产物 |
| --- | --- | --- | --- |
| 小红书 | ✅ 已上线 | — | `dist/xiaohongshu-incense-timer.zip` |
| 抖音 | 未上架 | — | `dist/douyin-incense-timer.zip` |
| 快手 | 未上架 | — | `dist/kuaishou-incense-timer.zip` |

发版后在此更新版本号，并同步根目录总表。

![图标](icon.png)

### 图标 Prompt（AI 生成）

核心意象：**香越烧越短 = 时间在流逝**。避免完整长香；也避免表盘、指针等现代时钟元素（与香炉气质冲突）。

推荐用以下三种「倒计时暗示」，均保持简约：

| 手法 | 倒计时怎么读 |
| --- | --- |
| 残香 + 虚影全长 | 半透明完整香形作底，实线残香叠在上面，像进度条 |
| 香身刻度 | 古法「计时香」，香体上三四道细横线，已燃段无刻度 |
| 炉周细环 | 香炉外围一圈细弧线，缺一段表剩余，抽象计时环、非表盘 |

**方案 A — 残香 + 虚影全长（推荐）**

```
手机应用图标，正方形 1:1。简约扁平风格。画面中央传统中式铜香炉，炉中一炷线香：实线绘制已燃至一半的短残香，香尖橙红火星，香灰尖微垂；残香后方有一道更淡更细的虚影轮廓，示原本全长，形成「燃尽进度」对比。深炭黑背景，几何造型简洁。让人看出香在计时、时间在走，但不要表盘、不要数字、不要指针。无文字、无边框，小尺寸清晰。
```

**方案 B — 香身刻度（古法计时香）**

```
手机应用图标，正方形 1:1。极简扁平风格。画面中央传统香炉，炉中一炷竖香，下半段已燃尽，上半段未燃部分有三至四道均匀细横刻度线，像古法计时香的时间标记；香尖一点暖色火星，一缕轻烟。深墨色背景，线条干净，无表盘无指针。表达「香即计时器」的文化感。无文字、无边框，古朴简约。
```

**方案 C — 炉周细环**

```
手机应用图标，正方形 1:1。简约扁平风格。画面中央传统香炉与一炷燃至半途的线香，香尖微光；香炉外围一圈极细暖金色圆弧线，弧线约缺四分之一（像抽象进度环，不是钟表）。深炭黑背景，主体简练，无数字无指针无表盘刻度。安静、禅意，暗示倒计时进行中。无文字、无边框。
```

生成后裁成正方形，主体居中，四周留约 10% 安全边距；避免细线和文字。

## 目录

```
incense-timer/
├── src/                 # 共用源码
│   ├── app.js           # 逻辑
│   ├── style.css        # 样式
│   ├── body.html        # DOM 结构
│   ├── assets/          # 背景图资（构建时自动内联 base64）
│   └── config.base.json # 默认配置
├── platforms/           # 平台差异
│   ├── douyin/config.json
│   ├── kuaishou/config.json + extra.css
│   └── xiaohongshu/config.json
├── build.mjs            # 打包脚本
└── dist/                # 产物（git 可忽略）
    ├── douyin/index.html + douyin-incense-timer.zip
    ├── kuaishou/...
    └── xiaohongshu/...
```

> `src/assets/` 下的图片会自动转 base64 内联进产物，文件名即 key（如 `bamboo.webp` → 竹林背景，`censer-back.png` / `censer-front.png` → 香炉，`match.png` / `lighter.png` → 点火道具）。注意总产物不能超过 8MB。

## 开发

改 `src/` 下文件，然后打包：

```bash
node build.mjs              # 全部平台
node build.mjs douyin       # 仅抖音
```

本地预览（以抖音包为例）：

```bash
node build.mjs douyin
python3 -m http.server 9876 --directory dist/douyin
```

## 上传

各平台上传对应的 `dist/{平台}-incense-timer.zip`，包内根目录为 `index.html`。

| 平台 | 产物 | 差异 |
| --- | --- | --- |
| 抖音 | `dist/douyin-incense-timer.zip` | 支持横竖屏 |
| 快手 | `dist/kuaishou-incense-timer.zip` | 竖屏优先 + 横屏紧凑样式 |
| 小红书 | `dist/xiaohongshu-incense-timer.zip` | 竖屏；多文件（html+css+js），见 `xiaohongshu/guidelines.md` |

平台规范见仓库根目录 `douyin/guidelines.md`、`kuaishou/guidelines.md` 等。

## 平台配置

`platforms/*/config.json` 字段：

- `storagePrefix` — localStorage 前缀，避免多平台调试互相覆盖（历史原因仍为 `hourglass_*`，已上线端勿改，以免用户本地数据失效）
- `portraitOnly` — 是否竖屏优先（影响 `html` class 与额外 CSS）
- `title` — 页面标题

共用逻辑读取 `window.PLATFORM`（构建时注入）。
