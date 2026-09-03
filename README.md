# Aiplay

自媒体 AI 互动内容（Vibe Coding 小工具）相关笔记与规范。

参考：[继B站/小红书/抖音后，快手也启动「互动内容平台」内测](https://mp.weixin.qq.com/s/9AnbudCgh9kAY12FbP1bbg)

## 发布总表

跨项目上架状态；发版时同步改这里。版本以各工具自身为准，本表为镜像。

| 工具 | 目录 | 小红书 | 抖音 | 快手 | B站 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 焚香计时 | `incense-timer/` | ✅ 已上线 | — | — | — | 当前仅小红书 |
| 轻映 | `xiaohongshu/crop-grid/` | 审核中 | — | — | — | 名称「轻映」· 简介「图片裁切与多宫格分图」 |
| 豆图 | `xiaohongshu/bead-pattern/` | — | — | — | — | 未上架 · 照片转拼豆图纸 |

## 待开发点子

笔记镜像：`KooNotes/projects/minitool.md`。

1. 链接 / 文字转二维码，或二维码美化
2. 图片压缩工具
3. 儿童启蒙、学习工具
4. 陀螺仪模拟射击：不同距离灵敏度不同，手机立起来瞄准
5. 各种图鉴
6. 签名、印章、水印
7. iOS 贴纸 App
8. iOS 拼图 / 裁剪 App
9. iOS 拼豆 App

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
