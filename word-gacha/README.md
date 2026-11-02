# 抽词成册 · 单词抽卡（demo）

抽一个英文词，**每个字母都是一次独立随机排版**：字体、墨色、边框、纹饰、倾斜各自随机，
但由「单词 + 位置 + 稀有度」派生的种子决定，同一张卡永远长得一样（不需要存图片）。

字形轮廓从 OFL 字体预先抽成 SVG path，运行时用 SVG / Canvas `Path2D` 直接绘制，
**整个包体 150KB**，远低于小红书 10MB 上限。

## 本地预览

```bash
npm run build   # 打包到 dist/xiaohongshu
npx serve dist/xiaohongshu
```

## 打包上架

```bash
node build.mjs              # 小红书 / 抖音 / 快手 全打
node build.mjs xiaohongshu  # 只打小红书
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```

产物：`dist/{平台}-word-gacha.zip`（当前 ≈150KB）

## 玩法

| 环节 | 说明 |
| --- | --- |
| 抽卡 | 每日 5 次免费 + 3 次看广告；稀有度权重 C 520 / SR 260 / SSR 140 / UR 62 / LR 18 |
| 卡面 | 字母瓦片逐字入场；稀有度越高，瓦片纹饰越密、字体越「古」 |
| 图鉴 | 96 词按稀有度排列，未抽到显示 `· · ·` |
| 存图 | Canvas `Path2D` 重绘同一套轮廓 → 900×1250 PNG，走 `writeTempFile` + `saveImageToPhotosAlbum` |

## 稀有度

孤本 LR > 秘典 UR > 稀见 SSR > 藏本 SR > 常本 C（见 `src/words.js` 的 `TIERS`）

## 文件

- `src/glyphs.js` — **自动生成**，6 款 OFL 字体的 A-Z/a-z/数字轮廓（283KB 源码，含在 app.js 里）
- `src/words.js` — 96 词词库 + 稀有度配置
- `src/card.js` — 卡面渲染（DOM/SVG）+ Canvas 导出，单一布局函数保证两边一致
- `src/app.js` — 抽卡、图鉴、存图、Storage 适配（`xhs.miniTool.*` 优先，localStorage 兜底）
- `src/style.css`、`src/body.html` — 页面骨架与样式
- `build.mjs` — 合并 JS 为单文件 `app.js`，审计禁止项后压 zip
- `tools/extract-glyphs.mjs` — 重新抽字形（改动字体时跑 `npm run glyphs`）

## 字体

Cinzel / Playfair Display / EB Garamond / Cormorant Garamond / Abril Fatface / UnifrakturMaguntia，
均为 SIL Open Font License 1.1，可随包分发。字体文件不进包，只留抽好的 path。

## 已知取舍

- 词库是手工精选的 demo 数据（96 词），正式版应换 COCA/考试大纲词频表
- 广告位是模拟按钮，接真实激励视频要换成平台 API
- 字母瓦片用「各自缩放填满方框」，牺牲了字重比例，换取统一的书页感
