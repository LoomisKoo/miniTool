# Aiplay

自媒体 AI 互动内容（Vibe Coding 小工具）相关笔记与规范。

参考：[继B站/小红书/抖音后，快手也启动「互动内容平台」内测](https://mp.weixin.qq.com/s/9AnbudCgh9kAY12FbP1bbg)

## 发布总表

跨项目上架状态；发版时同步改这里。版本以各工具自身为准，本表为镜像。

| 工具 | 目录 | 小红书 | 抖音 | 快手 | B站 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 焚香计时 | `incense-timer/` | ✅ 已上线 | — | — | — | 当前仅小红书 |
| 九宫格 | `xiaohongshu/jiugongge/` | — | — | — | — | 未上架 |

## 平台与规范

| 平台目录 | 产品名 | 状态 |
| --- | --- | --- |
| `douyin/` | 互动空间 | 已整理规范摘要 |
| `kuaishou/` | 互动内容世界 | 已整理规范摘要 |
| `xiaohongshu/` | 小工具 | 官方 Skill 在 `xiaohongshu/minitool-zip-builder/` |
| `bilibili/` | Toy | 搁置（需内测名额） |

各平台见对应 `guidelines.md`。小工具项目采用 **共用 `src/` + 各平台 `platforms/` 打包** 结构，示例见 `incense-timer/`。

## 跨平台共性（抖音 / 快手）

写上传小工具时可先共用一套校验：

- zip 或单 html；入口 `index.html`；≤ 8MB
- 纯离线：无网络请求、无外链、无外部 CDN、无 iframe
- 推荐 `localStorage`；移动端 WebKit；竖屏优先

差异注意：抖音支持横竖屏；快手创作指引写明当前仅竖屏。
