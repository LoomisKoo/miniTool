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
    ├── platforms/             # 该工具的 H5 发布配置（小红书 / 快手等）
    ├── ios/                   # 该工具的原生 iOS 工程
    ├── qmuse/                 # 妙思（QMuse）React 适配版（如有）
    ├── build.mjs              # H5 打包脚本
    └── dist/                  # 打包产物（git 忽略）
```

## 目录约定

- **平台目录**（`douyin/` / `kuaishou/` / `xiaohongshu/` / `bilibili/`）：只放规范与 Skill
- **工具目录**（根下独立文件夹）：产品源码 + `platforms/` + `ios/` + `qmuse/` + `build.mjs` + `dist/`
- **`platforms/`**：只表示 H5 内容平台适配，**不放 iOS / 不放 QMuse**
- **`ios/`**：原生 iOS 工程，一个工具一个，独立上架
- **`qmuse/`**：妙思导入用的 React 适配工程，规范见 [`docs/qmuse.md`](docs/qmuse.md)；**不要**再在仓库根放 `*-qmuse/`
- **安装包命名**：`dist/{平台}-{工具}.zip`

> 三种「平台」的辨析（根目录规范 / 工具内 `platforms/` / 工具内 `ios/`）见 [`docs/README.md`](docs/README.md)。

## 开发方式

| 目标 | 入口 |
| --- | --- |
| 写 / 改 H5 小工具并打包 zip | [`docs/platforms/`](docs/platforms/README.md) · [`.claude/minitool-zip-builder/SKILL.md`](.claude/minitool-zip-builder/SKILL.md) |
| 新建 / 开发 iOS App | [`docs/ios/README.md`](docs/ios/README.md) · [`docs/ios/development.md`](docs/ios/development.md) |
| 上架 iOS / 配买断与订阅 | [`docs/ios/release.md`](docs/ios/release.md) |
| 导入 / 重传妙思 QMuse | [`docs/qmuse.md`](docs/qmuse.md) · 各工具下 `<工具>/qmuse/` |

## 发布总表

跨项目上架状态；发版时同步改这里。版本以各工具自身为准，本表为镜像。

| 工具 | 目录 | 小红书 | 抖音 | 快手 | B站 | iOS | 所需权限（勾选） | 高级能力 | xhs 包 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 焚香计时 | `incense-timer/` | ✅ 已上线 1.0.1 | — | ✅ 已上线 1.0.1 | — | — | **不需要权限** | — | [zip](incense-timer/dist/xiaohongshu-incense-timer.zip) | 纯本地渲染 |
| 轻映 | `crop-grid/` | ✅ 已上线 1.0.1 | — | ✅ 已上线 1.0.1 | — | 未开始 | **相册照片与视频** | — | [zip](crop-grid/dist/xiaohongshu-qingying.zip) | 名称「轻映」· 选图 + 存相册 |
| 兔格拼豆 | `rabbit-bead/` | ✅ 已上线 1.0.4 | — | 审核中 1.0.4 | — | 开发中 1.0.0 | **相册照片与视频** | — | [zip](rabbit-bead/dist/xiaohongshu-rabbit-bead.zip) | 选图转拼豆 + 存相册 · iOS 已对齐 H5 主要功能（含 3D / 手绘 / 分板） |
| 彩码 | `colorqr/` | — | — | — | — | 未开始 | **相册照片与视频** | — | [zip](colorqr/dist/xiaohongshu-colorqr.zip) | 选嵌入图 · 含花束模式 · 开发中 |
| 星空跳一跳 | `xingkong-jump/` | ✅ 已上线 1.0.1 | — | ✅ 已上线 1.0.1 | — | — | **相册照片与视频** | — | [zip](xingkong-jump/dist/xiaohongshu-xingkong-jump.zip) | 简介「跳一跳星空改良版」· 存成绩图 |
| 纸灯夜航 | `paper-lantern/` | ✅ 已上线 1.0.2 | — | ✅ 已上线 1.0.2 | — | — | **相册照片与视频 + 用户头像和昵称** | 排行榜 | [zip](paper-lantern/dist/xiaohongshu-paper-lantern.zip) | 简介「休闲小游戏，杀时间必备」· 存分享图 + 灯火榜 |
| 词卡物语 | `word-card-tale/` | 开发中 1.0.0 | — | — | — | — | **相册照片与视频 + 用户头像和昵称** | 排行榜 | [zip](word-card-tale/dist/xiaohongshu-word-card-tale.zip) | 存卡图 + 无尽榜 |
| 图轻 | `tuqing/` | — | — | — | — | 未开始 | **相册照片与视频** | — | [zip](tuqing/dist/xiaohongshu-tuqing.zip) | 图片瘦身防二次压缩 · 选图压缩 + 存相册 · 开发中 |
| 美食地图 | `food-map/` | ✅ 已上线 1.0.2 | — | ✅ 已上线 1.0.0 | — | — | **不需要权限** | — | [zip](food-map/dist/xiaohongshu-meishitujian.zip) | 简介「地图上看懂各地美食」· 纯本地渲染 |
| 风铃物语 | `wind-chime/` | ✅ 已上线 1.0.0 | — | ✅ 已上线 1.0.0 | — | — | **不需要权限** | — | [zip](wind-chime/dist/xiaohongshu-wind-chime.zip) | 治愈系梦幻风铃 · 纯本地 3D 渲染 |
| 气息乐园 | `breath-garden/` | 开发中 | — | — | — | — | **设备麦克风** | — | [zip](breath-garden/dist/xiaohongshu-breath-garden.zip) | `getUserMedia({audio:true})` 呼吸声检测 |
| 积木搭建 | `jimu-build/` | 开发中 | — | — | — | — | **相册照片与视频** | — | [zip](jimu-build/dist/xiaohongshu-jimu-build.zip) | 存作品图 |
| 爆红书 | `baohongshu/` | ✅ 已上线 1.0.0 | — | ✅ 已上线 1.0.0 | — | — | **相册照片与视频** | — | [zip](baohongshu/dist/xiaohongshu-baohongshu.zip) | 简介「模拟爆红，看笔记从零涨到爆」· 选封面图 |
| 影厅模拟器 | `cinema-seat/` | ✅ 已上线 1.0.2 | — | — | — | — | **相册照片与视频** | — | [zip](cinema-seat/dist/xiaohongshu-cinema-seat.zip) | 第一视角影厅观感模拟 · 选放映视频 |
| 熊猫拼图 | `panda-puzzle/` | ✅ 已上线 1.0.0 | — | — | — | 开发中 | **相册照片与视频** | — | [zip](panda-puzzle/dist/xiaohongshu-panda-puzzle.zip) | 照片真 3D 拼图 · 选照片拼图 + 存相册 |
| 仙鹿起名 | `deerName/` | — | — | — | — | ✅ 已上架 1.0.0 | **相册照片与视频** | — | [zip](deerName/dist/xiaohongshu-naming.zip) | App **DeerNames** · H5 未上架 · 存名字卡片 · `addCloudStorage` 云存储不占权限项 |
| 帧藏 | `ticket-stub/` | 待提交 1.0.0 | — | — | — | — | **相册照片与视频** | — | [zip](ticket-stub/dist/xiaohongshu-ticket-stub.zip) | 电子票根生成器 · 简介「看过的电影走过的路，做成票根」· 选照片做票根 + 存相册 |
| 卡造 | `card-studio/` | 开发中 | — | — | — | — | **相册照片与视频** | — | [zip](card-studio/dist/xiaohongshu-card-studio.zip) | 名片 / 社交主页卡 / 工牌 / 宠物牌 / 吊牌生成器 · 53 套双面模板 · 选头像照 |
| 手机背面 DIY | `phone-back-diy/` | 待提交 1.0.0 | — | — | — | — | **相册照片与视频** | — | [zip](phone-back-diy/dist/xiaohongshu-phone-back-diy.zip) | 贴纸 / 文字 / 手绘 / 特效 DIY 手机背膜 · 12 套主题随机 · 存图 + 发笔记 |

iOS 一列 `未开始` 表示已规划原生版本、`ios/` 工程尚未建立；工程建好后改为此处版本号。命名与技术选型见 [`docs/ios/README.md`](docs/ios/README.md)。

## 送审勾选规则（小红书创服平台）

提交审核时，后台「所需权限 / 高级能力」必须按实际用到的 API 勾选。**多勾会被驳回，少勾会运行时被拒**。逐工具的勾选项见上表备注列。

- **相册照片与视频**：用了 `<input type=file>` 选图/选视频，或调了 `saveImageToPhotosAlbum` 就要勾。当前 14 个工具需要；焚香计时 / 美食地图 / 风铃物语 / 气息乐园勾「不需要权限」。
- **设备摄像头**：**目前没有任何工具需要**。选图一律走相册，没有直接调相机的。
- **设备位置**：**目前没有任何工具需要**。`capability.js` 里虽保留 `getLocation` 映射，但没有工具调用。
- **设备麦克风**：仅**气息乐园**需要（`getUserMedia({ audio: true })`，呼吸节律检测）。
- **用户头像和昵称**：用了排行榜才勾。目前仅**纸灯夜航、词卡物语**需要；未勾时排行榜接口返回 `errCode 1005`，代码已按「隐藏榜单入口」降级。
- **排行榜**（高级能力）：`submitScore` / `getRankList` / `getMyRank` 三件套，同样仅**纸灯夜航、词卡物语**。
- **赞赏**：**不是这里的勾选项**。这个面板只有「相册照片与视频 / 设备摄像头 / 设备麦克风 / 设备位置 / 用户头像和昵称」五项权限，加一个高级能力「排行榜」。赞赏需另行开通（入口在创服平台其他设置里），未开通时按钮仍显示，点击才被平台拒绝。全部 18 个工具都已在代码里接入。

## 赞赏入口（全站统一）

按《小工具容器 · 能力清单》§3.19 / §3.20 接入。**先在各工具的创服平台后台开通「赞赏」能力**，否则点击会被平台拒绝。

- 统一实现：[`shared/xhs-reward.js`](shared/xhs-reward.js)，自带轻量入口按钮和样式，无需改各工具 HTML/CSS
- 分发：`node shared/sync-reward.mjs` 把同一份代码写进各工具入口脚本（带 `xhs-reward:begin/end` 标记，幂等）
- 检查：`node shared/sync-reward.mjs --check`（CI 可用）
- 门槛：客户端 9.53.3+，低于此版本自动隐藏入口
- 已接入：爆红书 / 影厅模拟器 / 轻映 / 美食地图 / 焚香计时 / 熊猫拼图 / 兔格拼豆 / 帧藏 / 风铃物语 / 星空跳一跳 / 气息乐园 / 卡造 / 彩码 / 积木搭建 / 图轻 / 纸灯夜航 / 词卡物语 / 仙鹿起名

**限制**：`rewardAuthor` 只返回 `errMsg`，不给金额也不给支付结果，所以不能做「赞赏解锁内容」；金额档位、协议、支付、频控全部由客户端处理。

## 待开发点子

笔记镜像：`KooNotes/projects/minitool.md`。

1. ~~链接 / 文字转二维码，或二维码美化~~ → 开发中：[`colorqr/`](colorqr/)「彩码」
2. ~~图片压缩工具~~ → 开发中：[`tuqing/`](tuqing/)「图轻」（图片瘦身 / 防平台二次压缩）
3. 儿童启蒙、学习工具
4. 陀螺仪模拟射击：不同距离灵敏度不同，手机立起来瞄准
5. 各种图鉴 → 开发中：[`bencao/`](bencao/)「本草」（药材图鉴 + 药圃经营 + 坐堂看病）
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
