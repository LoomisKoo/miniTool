# 帧藏 · 电子票根生成器

纯 HTML + CSS + JavaScript 的多风格票根小工具：本地上传图片、自定义文案、CSS 3D 悬停预览，并用 `html-to-image` 导出高清 PNG。

已适配**小红书小工具**（离线 zip，不联网），打包见下文。

## 本地预览

```bash
npx serve ticket-stub
```

第三方库与字体已固化在 `vendor/`（不再依赖 CDN），`index.html` 直接引用本地文件即可。

## 打包上架包

```bash
node scripts/vendor-assets.mjs   # 只在需要更新字体/第三方库时跑
node build.mjs                   # → dist/xiaohongshu-ticket-stub.zip
```

`build.mjs` 会合并 `src/*.js` 为单个经典脚本、拼接平台 `extra.css`、跑
`../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs` 审计，再压 zip。

## 分类与风格

| 分类 | 风格 |
| --- | --- |
| 电影票 | 双联撕裂、拍立得卡 |
| 旅行通票 | 登机牌、风景明信片 |
| 演唱会票 | 霓虹暗色、音乐节票 |
| 漫游 | 报刊风、胶囊卡片 |
| 邮票 | 经典邮票等 |

## 文件

- `index.html` — 本地预览页（`<body>` 是打包时的页面结构来源）
- `src/templates.js` — 分类 / 字段 / 票面 HTML（`window.TicketKit`）
- `src/effects.js` — 特效素材与实例（`window.TicketEffects`）
- `src/paper-renderer.js` — 纸感 3D 光栅化 + WebGL 着色（`window.TicketPaper`）
- `src/app.js` — 表单、上传、倾斜、导出
- `src/style.css` — 视觉与 3D / mask 咬口
- `platforms/<平台>/config.json` + `extra.css` — 平台标题/简介与样式差异
- `scripts/vendor-assets.mjs` — 拉取 lucide / html-to-image / 字体到 `vendor/`
- `build.mjs` — 打包脚本
- `assets/icon.jpg` — 1024×1024 上架图标（不随包分发）；包内 favicon 用轻量的 `assets/icon.svg`

## 离线容器适配要点

- **第三方库与字体全部固化在 `vendor/`**：`lucide.min.js`、`html-to-image.js`、
  `fonts.css` + `fonts/*.woff2`。字体另有一份 `fonts-embed.js`（data: 版），
  导出光栅化时通过 `fontEmbedCSS` 直接内联，避免运行时去取字体文件。
- **导出走 JSBridge 存相册**：`canvas.toDataURL()` → `writeTempFile` → `saveImageToPhotosAlbum`；
  没有 `window.xhs`（普通浏览器）时退回 `a[download]`。
- **内置样图启动后转 data URL**：光栅化库靠 `fetch` 内联资源，离线容器不保证取得到包内文件，
  所以启动时统一把 `DEFAULT_PHOTOS` 读成内存地址。
- **顶部安全区**：`--safe-t`（刘海）+ `--nav-h`（容器顶栏，小红书 44px，见 `platforms/xiaohongshu/extra.css`）。
- **兼容性基线**：JS 已限制在 ES2017（无 `?.` / `??`）；CSS 对 `dvh`、容器查询、
  `color-mix()`、`:has()` 提供了声明级或 JS 兜底，但整体仍要求较新的内核
  （`aspect-ratio` / Flex `gap` / `max()` 等未做 Chrome 61 降级）。
