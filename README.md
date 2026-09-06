# Aiplay

自媒体 AI 互动内容（Vibe Coding 小工具）相关笔记与规范。

参考：[继B站/小红书/抖音后，快手也启动「互动内容平台」内测](https://mp.weixin.qq.com/s/9AnbudCgh9kAY12FbP1bbg)

## 目录约定

- **平台目录**（`douyin/` / `kuaishou/` / `xiaohongshu/` / `bilibili/`）：只放规范与 Skill
- **工具目录**（根下独立文件夹）：产品源码 + `platforms/` + `build.mjs` + `dist/`
- **安装包命名**：`dist/{平台}-{工具}.zip`

## 发布总表

跨项目上架状态；发版时同步改这里。版本以各工具自身为准，本表为镜像。

| 工具 | 目录 | 小红书 | 抖音 | 快手 | B站 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 焚香计时 | `incense-timer/` | ✅ 已上线 | — | — | — | 当前仅小红书 |
| 轻映 | `crop-grid/` | 审核中 | — | — | — | 名称「轻映」· `*-qingying.zip` |
| 兔格拼豆 | `bead-pattern/` | — | — | — | — | 未上架 · `*-bead-pattern.zip` |
| 彩码 | `colorqr/` | — | — | — | — | 开发中 · 含花束模式 · `*-colorqr.zip` |
| 星空跳一跳 | `xingkong-jump/` | — | — | — | — | 开发中 · 简介「跳一跳星空改良版」· `*-xingkong-jump.zip` |
| 纸灯夜航 | `paper-lantern/` | ✅ 已上线 | — | — | — | 简介「休闲小游戏，杀时间必备」· `*-paper-lantern.zip` |

## 待开发点子

笔记镜像：`KooNotes/projects/minitool.md`。

1. ~~链接 / 文字转二维码，或二维码美化~~ → 开发中：[`colorqr/`](colorqr/)「彩码」
2. 图片压缩工具
3. 儿童启蒙、学习工具
4. 陀螺仪模拟射击：不同距离灵敏度不同，手机立起来瞄准
5. 各种图鉴
6. 签名、印章、水印
7. iOS 贴纸 App
8. iOS 拼图 / 裁剪 App
9. iOS 拼豆 App
10. 各平台卖数字皮肤 / 图资：聚焦低门槛「设图即用」品类（文件夹图标、壁纸、输入法皮肤、聊天背景、打印稿等），多风格整套售卖
   - 品类与口径见 `KooNotes/projects/minitool.md` 第 10 条
11. 解压工具 / App
12. 抛圈小游戏（套圈）
13. ~~跳一跳小游戏~~ → 开发中：[`xingkong-jump/`](xingkong-jump/)「星空跳一跳」
14. ~~纸灯夜航（休闲飞灯）~~ → 小红书已上线：[`paper-lantern/`](paper-lantern/)「纸灯夜航」

## 平台与规范

| 平台目录 | 产品名 | 状态 |
| --- | --- | --- |
| `douyin/` | 互动空间 | 已整理规范摘要 |
| `kuaishou/` | 互动内容世界 | 已整理规范摘要 |
| `xiaohongshu/` | 小工具 | 官方 Skill 在 `xiaohongshu/minitool-zip-builder/` |
| `bilibili/` | Toy | 搁置（需内测名额） |

各平台见对应 `guidelines.md`。推荐结构：共用源码 + `platforms/` + `build.mjs`（示例 `incense-timer/`、`colorqr/`；轻映/拼豆现阶段扁平源码同样走 `build.mjs`）。

## 跨平台共性（抖音 / 快手）

写上传小工具时可先共用一套校验：

- zip 或单 html；入口 `index.html`；≤ 8MB
- 纯离线：无网络请求、无外链、无外部 CDN、无 iframe
- 推荐 `localStorage`；移动端 WebKit；竖屏优先

差异注意：抖音支持横竖屏；快手创作指引写明当前仅竖屏。
