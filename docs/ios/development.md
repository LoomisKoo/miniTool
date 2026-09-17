# iOS 开发约定

## 新建工程

1. Xcode → `File > New > Project` → `iOS` → `App`
2. 填写：

| 字段 | 值 |
| --- | --- |
| Product Name | 见 [README 命名对照](README.md#命名对照)，如 `RabbitBead` |
| Team | 自己的开发者账号 |
| Organization Identifier | `com.loomiskoo` |
| Interface | `SwiftUI` |
| Language | `Swift` |
| Storage | `SwiftData`（记录类工具）或 `None` |
| Testing | 按需（算法类工具建议勾 Unit Tests） |

3. 保存位置：

```text
miniTool/<工具>/ios/
```

最终路径示例：

```text
miniTool/rabbit-bead/ios/RabbitBead/RabbitBead.xcodeproj
```

不要放在 `<工具>/` 根目录，避免和 H5 源码、`dist/`、`build.mjs` 混在一起。

## 代码组织

小工具项目体量小，按**功能分层**而不是按类型分层：

```text
RabbitBead/
├── App/
│   └── RabbitBeadApp.swift
├── Features/
│   ├── Import/            # 选图
│   ├── Editor/            # 主编辑界面
│   └── Export/            # 导出图纸
├── Core/
│   ├── Palette.swift      # 色卡数据（可从 palettes.js 移植）
│   └── Quantizer.swift    # 颜色量化算法
└── Resources/
    ├── Assets.xcassets
    └── PrivacyInfo.xcprivacy
```

约定：

- 一个文件一个主要类型，文件名与类型名一致。
- 纯算法（颜色量化、拼豆映射、图片压缩）放 `Core/`，不依赖 UI，方便写单元测试。
- 视图不直接做重计算；耗时任务放 `Task` 并给进度反馈。
- 大图处理注意内存：先降采样再编码，避免一次全尺寸解码（与 H5 端 `tuqing/` 的处理思路一致）。

## 与 H5 版本的关系

| 可复用 | 需重写 |
| --- | --- |
| 色卡 / 数据表（`palettes.js`、`data.js` → Swift 常量或 JSON） | 渲染、手势、布局 |
| 算法思路（压缩目标体积二分、拼豆最近色匹配） | Canvas / WebGL 绘制 |
| 文案、图标、配色 | 打包与存储 |

移植算法时不要照搬 JS 写法，先写单元测试固定输入输出，再对照 H5 结果校验。

## 调试

- 相册、相机、分享扩展**必须真机测**。
- 图片类工具准备一组边界用例：超大图、HEIC、带透明 PNG、竖拍带 EXIF 方向。
- 内存与耗时用 Xcode Instruments 看，不要凭感觉。
- 无网络工具可在开发期断网跑一遍，确认没有隐式网络请求。

## 本地构建

```bash
cd <工具>/ios
xcodebuild -scheme <Name> -destination 'generic/platform=iOS' build
```

日常开发直接用 Xcode 运行即可，命令行构建主要用于 CI 与存档。

## .gitignore

仓库根 `.gitignore` 已包含 Xcode 相关忽略规则（`xcuserdata/`、`DerivedData/`、`*.xcuserstate` 等）。新增工程不需要再建 `.gitignore`；若某工具需要额外规则，放在 `<工具>/ios/.gitignore`。

提交原则：

- **要提交**：`.xcodeproj/project.pbxproj`、源码、`Assets.xcassets`、`PrivacyInfo.xcprivacy`、`Package.resolved`
- **不要提交**：`xcuserdata/`、`DerivedData/`、构建产物、签名文件、`.ipa`、`*.mobileprovision`

## 文档同步

新建 iOS 工程后同步更新：

1. `<工具>/README.md`：加「iOS」小节，写工程路径、最低版本、当前状态、运行方式
2. 根 `README.md` 发布总表：iOS 一列
3. 若命名或 Bundle ID 与 [命名对照](README.md#命名对照) 不同，先改对照表
