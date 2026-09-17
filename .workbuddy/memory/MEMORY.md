# 彩码（colorqr）项目长期记忆

## 核心约束
- **纯本地 HTML，不联网、无后端**。因此服务器依赖型功能一律不做：动态二维码（可改指向/短链）、扫描统计/analytics、云端批量、账号体系。
- 导出 PNG 已自带底部标题栏（左侧紫色类型标签 + 右侧内容摘要，纯前端 canvas 生成，离线可用）；标题目前自动取内容、不可手改。

## 产品定位
- 精致化、好分享的移动端二维码 mini-tool，调性偏「生活体验 / 代偿」，命名走 3-4 字生活化小词。
- 导出格式仅 PNG（无 SVG/向量）；内容类型：链接/文字/WiFi/名片(vCard·MeCard)。

## 与主流生成器的差距（2026 调研）
- 缺失且高优（贴合定位、纯前端可做）：渐变前景色、码眼独立配色、容错率手动 L/M/Q/H、外框+引导文案。
- 次优：透明背景导出、SVG 矢量导出、扩充内容类型(Email/SMS/电话/WhatsApp/定位/事件)。
- 不做：动态码、统计、批量（超定位）。

## 构建与预览
- 构建：`node build.mjs`（可带平台名只出某一个）→ `dist/{douyin,kuaishou,xiaohongshu}`。**抖音/快手 = 单 html 全内联**（style/three/bloom/qrcode/app 全塞进 index.html）；**小红书 = 扁平多文件**，且有 `assertXhs` 硬断言：不得含内联 `<script>`、不得含 `on\w+=` HTML 内联事件。产物命名 `dist/<平台>-colorqr.zip`，单平台 ≤8MB。
- 预览：本地回环 `python3 -m http.server <port> --bind 127.0.0.1 --directory dist/<平台>`。

# 星空跳一跳（xingkong-jump）项目长期记忆

## 定位
- 参考微信「跳一跳」的离线治愈收集向 H5 小游戏。差异：目标从「跳更远/刷分」→「收集星星/回忆碎片」；判定含星心完美落地；产出「一面可分享的回忆墙 PNG」。
- 产品名：**星空跳一跳**（便于搜「跳一跳」，又以星空做差异）。目录：`xingkong-jump/`。

## 核心约束（用户明确决策）
- **不联网、纯本地**。早期因容器无可靠持久化而「不存档」；2026-09 起用 Storage JS API（客户端 ≥9.46.0）做跨局存档，低版本降级 `localStorage`；小红书环境且无 Storage 时开场页提示「当前小红书版本较低，进度可能无法保存」。
- **存档字段**：`bestScore` / `bestComboAll` / `totalStars` / `litConstellations[]` / `muted`（不做局内断点续玩）。
- 分享方式：局内「导出图片」把回忆墙渲染成 PNG；小红书端走 `writeTempFile` → `saveImageToPhotosAlbum`（`a[download]` 已禁用），并支持 `postNote` 一键发图文笔记（结算页 / 摘要卡预览页）；非容器环境保留下载兜底。
- **UI 尽量高级、禁止 H5 原生控件**：全自定义 div/overlay，无原生 button/input/alert，玻璃拟态 + 渐变文字 + canvas 渲染。

## 技术形态
- 单文件 `xingkong-jump/index.html`，内联 CSS/JS，Three.js 3D + HTML/CSS UI 叠层。
- 蓄力跳手感对齐跳一跳；踩中星心连击加倍。
- 导出复用 colorqr 已验证的 canvas→PNG 链路（`toDataURL`/`toBlob` + 可选 `navigator.share` 文件分享）。
- 移动端：viewport-fit=cover + 安全区 inset；touch-action:none 禁滚动/缩放。

# 仙鹿起名（naming）项目长期记忆

## 导出图片（跨 miniTool 通用结论，2026-09 定）
- **不要**把 `data:` URL 直接挂在 `<a download>` 上。Safari / 部分容器 webview 不认这个 download 属性，点击会当场导航到该 data URL —— macOS 找不到能打开的 App，弹「没有可打开的程序 / There is no application set to open the URL data:image/...」。
- 正确链路：`canvas.toDataURL()` → 本地转 Blob（`atob` + `Uint8Array` 手撸，**别用 `fetch(dataURL)`**）→ `URL.createObjectURL(blob)` → 建临时 `<a download>` click → `revokeObjectURL`。
- 容器（小红书等）里 `<a download>` 被禁用，须先探原生桥：`window.xhs && window.xhs.miniTool && typeof saveImageToPhotosAlbum === 'function'` → `writeTempFile({data:dataURL})` → `saveImageToPhotosAlbum({filePath})`；非容器环境再走上面的 blob 兜底（与 xingkong-jump 同一套，见其 src/app.js saveBtn）。
- naming `build.mjs` 有离线断言，对 `fetch(`/`XMLHttpRequest` 等关键字告警 → 转 Blob 必须用 atob 手撸。
- naming 打包 `dist/{douyin,kuaishou,xiaohongshu}`（单文件内联 index.html + zip）。改 `src/*` 后跑 `node build.mjs` 重出三平台产物。

## 自测套件
- `check.mjs`（引擎）/ `flow.mjs`（146 项 UI）/ `wire.mjs`（接线完整性）/ `cardcheck.mjs`（卡片版式：出界 + 文字重合 + 底部贴边断言，741 英文全检）。cardcheck 在 vm 沙箱里跑 card.js + stub canvas 抓 fillText 坐标。
- 预览：`serve.mjs` 常驻 http://127.0.0.1:9880/body.html（读盘 no-store，刷新即生效）。
