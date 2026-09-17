# Aiplay

自媒体 AI 互动内容（Vibe Coding 小工具）相关笔记与规范。

参考：[继B站/小红书/抖音后，快手也启动「互动内容平台」内测](https://mp.weixin.qq.com/s/9AnbudCgh9kAY12FbP1bbg)

## 仓库结构

```text
miniTool/
├── README.md                  # 本文件：总表与入口
├── docs/                      # 跨工具统一规范
│   ├── platforms/             # H5 内容平台规范索引
│   └── ios/                   # iOS 总规范 / 开发 / 发布
├── xiaohongshu/               # 小红书规范与 Skill（只放规范）
├── douyin/                    # 抖音规范（只放规范）
├── kuaishou/                  # 快手规范（只放规范）
├── bilibili/                  # B站规范（搁置）
└── <工具>/                    # 一个工具一个目录
    ├── README.md
    ├── platforms/             # 该工具的 H5 发布配置
    ├── ios/                   # 该工具的原生 iOS 工程
    ├── build.mjs              # H5 打包脚本
    └── dist/                  # 打包产物（git 忽略）
```

## 目录约定

- **平台目录**（`douyin/` / `kuaishou/` / `xiaohongshu/` / `bilibili/`）：只放规范与 Skill
- **工具目录**（根下独立文件夹）：产品源码 + `platforms/` + `ios/` + `build.mjs` + `dist/`
- **`platforms/`**：只表示 H5 内容平台适配，**不放 iOS**
- **`ios/`**：原生 iOS 工程，一个工具一个，独立上架
- **安装包命名**：`dist/{平台}-{工具}.zip`

> 三种「平台」的辨析（根目录规范 / 工具内 `platforms/` / 工具内 `ios/`）见 [`docs/README.md`](docs/README.md)。

## 开发方式

| 目标 | 入口 |
| --- | --- |
| 写 / 改 H5 小工具并打包 zip | [`docs/platforms/`](docs/platforms/README.md) · [`.claude/minitool-zip-builder/SKILL.md`](.claude/minitool-zip-builder/SKILL.md) |
| 新建 / 开发 iOS App | [`docs/ios/README.md`](docs/ios/README.md) · [`docs/ios/development.md`](docs/ios/development.md) |
| 上架 iOS / 配买断与订阅 | [`docs/ios/release.md`](docs/ios/release.md) |

## 发布总表

跨项目上架状态；发版时同步改这里。版本以各工具自身为准，本表为镜像。

| 工具 | 目录 | 小红书 | 抖音 | 快手 | B站 | iOS | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 焚香计时 | `incense-timer/` | ✅ 已上线 1.0.1 | — | ✅ 已上线 1.0.1 | — | — | `*-incense-timer.zip` |
| 轻映 | `crop-grid/` | ✅ 已上线 1.0.1 | — | ✅ 已上线 1.0.1 | — | 未开始 | 名称「轻映」· `*-qingying.zip` |
| 兔格拼豆 | `rabbit-bead/` | 审核中 1.0.4 | — | 审核中 1.0.4 | — | 开发中 1.0.0 | `*-rabbit-bead.zip` · iOS 已对齐 H5 主要功能（含 3D / 手绘 / 分板） |
| 彩码 | `colorqr/` | — | — | — | — | 未开始 | 开发中 · 含花束模式 · `*-colorqr.zip` |
| 星空跳一跳 | `xingkong-jump/` | ✅ 已上线 1.0.1 | — | ✅ 已上线 1.0.1 | — | — | 简介「跳一跳星空改良版」· `*-xingkong-jump.zip` |
| 纸灯夜航 | `paper-lantern/` | ✅ 已上线 1.0.2 | — | ✅ 已上线 1.0.2 | — | — | 简介「休闲小游戏，杀时间必备」· `*-paper-lantern.zip` |
| 图轻 | `tuqing/` | — | — | — | — | 未开始 | 开发中 · 图片瘦身防二次压缩 · `*-tuqing.zip` |
| 美食地图 | `food-map/` | ✅ 已上线 1.0.0 | — | ✅ 已上线 1.0.0 | — | — | 简介「地图上看懂各地饮食」· `*-meishitujian.zip` |
| 风铃物语 | `wind-chime/` | ✅ 已上线 1.0.0 | — | ✅ 已上线 1.0.0 | — | — | 治愈系梦幻风铃 · `*-wind-chime.zip` |
| 爆红书 | `baohongshu/` | ✅ 已上线 1.0.0 | — | ✅ 已上线 1.0.0 | — | — | 简介「模拟爆红，看笔记从零涨到爆」· `*-baohongshu.zip` |
| 观影座舱 | `cinema-seat/` | — | — | — | — | — | 开发中 · 第一视角影厅观感模拟 · `*-cinema-seat.zip` |
| 取名馆 | `naming/` | — | — | — | — | — | 开发中 · 性格测试取名 / 外文名转中文名 · `*-naming.zip` |

iOS 一列 `未开始` 表示已规划原生版本、`ios/` 工程尚未建立；工程建好后改为此处版本号。命名与技术选型见 [`docs/ios/README.md`](docs/ios/README.md)。

## 待开发点子

笔记镜像：`KooNotes/projects/minitool.md`。

1. ~~链接 / 文字转二维码，或二维码美化~~ → 开发中：[`colorqr/`](colorqr/)「彩码」
2. ~~图片压缩工具~~ → 开发中：[`tuqing/`](tuqing/)「图轻」（图片瘦身 / 防平台二次压缩）
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
13. ~~跳一跳小游戏~~ → 小红书/快手已上线：[`xingkong-jump/`](xingkong-jump/)「星空跳一跳」
14. ~~纸灯夜航（休闲飞灯）~~ → 小红书/快手已上线：[`paper-lantern/`](paper-lantern/)「纸灯夜航」

## 平台与规范

| 平台目录 | 产品名 | 状态 |
| --- | --- | --- |
| `douyin/` | 互动空间 | 已整理规范摘要 |
| `kuaishou/` | 互动内容世界 | 已整理规范摘要 |
| `xiaohongshu/` | 小工具 | 官方 Skill 在 `xiaohongshu/minitool-zip-builder/` |
| `bilibili/` | Toy | 搁置（需内测名额） |

各平台见对应 `guidelines.md`，索引在 [`docs/platforms/`](docs/platforms/README.md)。推荐结构：共用源码 + `platforms/` + `build.mjs`（示例 `incense-timer/`、`colorqr/`；轻映/拼豆现阶段扁平源码同样走 `build.mjs`）。

原生 iOS 不用 `platforms/`，统一放各工具的 `ios/`，规范见 [`docs/ios/`](docs/ios/README.md)。

## 跨平台共性（抖音 / 快手）

写上传小工具时可先共用一套校验：

- zip 或单 html；入口 `index.html`；≤ 8MB
- 纯离线：无网络请求、无外链、无外部 CDN、无 iframe
- 推荐 `localStorage`；移动端 WebKit；竖屏优先

差异注意：抖音支持横竖屏；快手创作指引写明当前仅竖屏。
