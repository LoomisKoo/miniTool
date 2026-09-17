# 轻映

图片裁切与多宫格分图。纯离线 Web 小工具（各平台分发）+ 原生 iOS App。

## 上架素材

- 名称：轻映
- 简介：图片裁切与多宫格分图
- 图标：`icon.png`

| 平台 | 产物 |
| --- | --- |
| 小红书 | `dist/xiaohongshu-qingying.zip` |
| 抖音 | `dist/douyin-qingying.zip` |
| 快手 | `dist/kuaishou-qingying.zip` |

状态：小红书 / 快手 ✅ 已上线。

## 打包

```bash
node build.mjs                  # 全部平台
node build.mjs kuaishou         # 仅快手

# 小红书审计
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```

## iOS App

`ios/Qingying/`，SwiftUI（iOS 17）。工程结构与 `rabbit-bead/ios` 保持一致：
`App` / `Core` / `Features`，资源放 `Resources`，用 Xcode 的目录同步组，新增文件不用改 `project.pbxproj`。

```bash
# 构建（模拟器，免签名）
xcodebuild -project ios/Qingying/Qingying.xcodeproj -scheme Qingying \
  -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
```

- Bundle ID：`com.loomiskoo.qingying`，显示名「轻映」
- 已实现：比例裁切（含自由）、直角/圆角/圆形、宫格分图（横三/竖三/2×3/3×2/九宫）、
  网格线颜色、拖拽平移、捏合/滑杆缩放、90° 旋转与镜像、批量存相册
- 与 H5 的差异：导出上限 4096px（H5 为 1440），支持带旋转/镜像导出
- 待办：自由比例的角把手拖拽、拼图（长图）模式、StoreKit 内购
