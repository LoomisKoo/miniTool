# iOS 规范（总览）

本仓库的 iOS 原生 App 统一遵守本规范。具体实施细节见 [development.md](development.md) 与 [release.md](release.md)。

## 定位

H5 小工具和 iOS App 是**同一个产品的两种实现**：

| | H5 小工具 | iOS App |
| --- | --- | --- |
| 分发 | 小红书 / 抖音 / 快手容器 | App Store |
| 目录 | `<工具>/` + `<工具>/platforms/` | `<工具>/ios/` |
| 能力 | 纯离线、无网络、沙箱受限 | 系统相册、相机、通知、HealthKit、分享扩展 |
| 变现 | 平台激励 / 引流 | 买断（内购非消耗型）或订阅 |

原生版不是把 H5 塞进 `WKWebView` 就完事：只有用到系统能力（相册写入、批量处理、快捷指令、分享扩展、后台任务）时才值得做，否则直接维护 H5 更省成本。

## 目录约定

```text
<工具>/
├── README.md
├── platforms/                  # H5 内容平台配置
└── ios/
    ├── README.md               # 该工具的 iOS 说明（可选）
    └── <Name>/                 # Xcode 工程根
        ├── <Name>.xcodeproj
        ├── <Name>/             # 源码
        └── <Name>Tests/        # 测试（可选）
```

`<Name>` 用 PascalCase 的英文短名，与 Bundle ID 一致。

## 命名对照

| 工具目录 | 产品名 | Xcode 工程 / Bundle ID 后缀 |
| --- | --- | --- |
| `rabbit-bead/` | 兔格拼豆 | `RabbitBead` |
| `tuqing/` | 图轻 | `Tuqing` |
| `crop-grid/` | 轻映 | `Qingying` |
| `live-photo/` | 灵光 | `LivePhoto` |
| `body-balance/` | 身体小账本 | `BodyBalance` |
| `colorqr/` | 彩码 | `ColorQR` |
| `food-map/` | 美食地图 | `Xunwei` |
| `wind-chime/` | 风铃物语 | `WindChime` |
| `kongming-deng/` | 祈愿灯 | `KongmingDeng` |
| `xingkong-jump/` | 星空跳一跳 | `XingkongJump` |
| `paper-lantern/` | 纸灯夜航 | `PaperLantern` |
| `incense-timer/` | 焚香计时 | `IncenseTimer` |
| `cinema-seat/` | 观影座舱 | `CinemaSeat` |
| `star-book/` | 星空翻页书 | `StarBook` |

Bundle ID 形式：`com.<team>.<name 小写>`，例如 `com.loomiskoo.rabbitbead`。**同一个 App 的 Bundle ID 一旦上架不可更改**，提交前先定好。

## 技术选型

| 类型 | 工具 | 方案 |
| --- | --- | --- |
| 图片处理 | 图轻、轻映 | SwiftUI + PhotosUI + Core Image / Core Graphics |
| 图形生成 | 兔格拼豆、彩码 | SwiftUI + Core Graphics（拼豆量化算法可移植自 `rabbit-bead/app.js`） |
| 动效创作 | 灵光 | SwiftUI + Core Animation / Metal |
| 3D 氛围 | 风铃物语、祈愿灯 | SceneKit 或 Metal（Web 端为 Three.js，逻辑需重写） |
| 小游戏 | 星空跳一跳、纸灯夜航 | SpriteKit |
| 记录类 | 身体小账本 | SwiftUI + SwiftData / Core Data + HealthKit |
| 图鉴类 | 美食地图 | SwiftUI + SwiftData |

统一要求：

- UI 框架：**SwiftUI 优先**，只在必须时用 UIKit 包装（如相机、复杂手势）。
- 最低部署目标：**iOS 17.0**（在 `docs/ios/` 统一约定，不各项目自行降低）。
- 生命周期：SwiftUI `App` + `Scene`，不用 `AppDelegate`（除非接入需要）。
- 并发：`async/await` + `@MainActor`，不用 GCD 手写队列。
- 依赖：优先系统框架；第三方库用 **SPM**，不引入 CocoaPods。
- 数据：iOS 17 起优先 **SwiftData**；仅键值配置用 `@AppStorage`。

## 资源与品牌

- 图标：每个工具保留一份 1024×1024 源文件，放在该工具目录（如 `<工具>/icon.png`），iOS 端用 Xcode 的单一尺寸 AppIcon 生成。
- 命名：H5 与 iOS 用同一产品名与简介口径，改动时两边同步。
- 色彩与字体：优先系统字体（PingFang SC / SF）；特殊字体需确认商用授权，并把授权说明写进 `<工具>/README.md`。

## 权限

只申请真正用到的权限，且必须在 `Info.plist` 写明用途（未写会被审核拒绝）：

| 权限 | 用途 | 涉及工具 |
| --- | --- | --- |
| `NSPhotoLibraryAddUsageDescription` | 保存图片 | 图轻、轻映、兔格拼豆、灵光、祈愿灯 |
| `NSPhotoLibraryUsageDescription` | 读取相册图片 | 同上 |
| `NSCameraUsageDescription` | 拍照 | 灵光 |
| `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` | 体重、运动数据 | 身体小账本 |

原则：能只用「仅添加」就不用「读写」；被拒绝时要给出降级路径（例如导出到文件）。

## 付费

| 模式 | 适用 | 工具 |
| --- | --- | --- |
| 买断（非消耗型内购） | 一次性工具，无持续服务成本 | 图轻、轻映、兔格拼豆、彩码、焚香计时 |
| 免费 + 素材包买断 | 基础可用，高级内容付费 | 灵光（特效包） |
| 订阅 | 有持续更新或服务成本 | 增强后的身体小账本 |

规则：

- 免费额度要**可长期使用**，不做强制订阅才能用基础功能。
- 价格档位集中维护在本表，避免同一仓库内同类产品定价互相矛盾。
- 用 StoreKit 2，恢复购买必须可用；订阅需提供隐私政策与服务条款链接。
- 内购商品 ID 命名：`<bundleid>.pro` / `<bundleid>.pack.<name>` / `<bundleid>.sub.yearly`。

## 上架前检查

- [ ] Bundle ID、产品名、图标已定稿
- [ ] 权限文案与实际用途一致
- [ ] 无网络请求的工具不需要 `NSAppTransportSecurity` 例外
- [ ] 隐私清单 `PrivacyInfo.xcprivacy` 已填写（App Store 强制）
- [ ] 买断/订阅可恢复
- [ ] 已在真机测试（模拟器不能覆盖相册、相机、手势性能）
- [ ] 隐私政策与服务条款 URL 可用
- [ ] `<工具>/README.md` 补上 iOS 状态与版本号
- [ ] 根 `README.md` 发布总表补上 iOS 一列的状态

## 相关文档

- [development.md](development.md) — 新建工程、代码组织、资源、调试
- [release.md](release.md) — 签名、TestFlight、审核、买断与订阅配置
