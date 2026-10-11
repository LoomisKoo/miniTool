# 熊猫拼图 iOS（原生）

SwiftUI + **SceneKit** 实现，不再嵌入 WebView。小红书仍用 Web 版 `npm run build:xhs`。

## 打开

`PandaPuzzle/PandaPuzzle.xcodeproj` → Run。

## 当前能力

- 经典凹凸扣切图（移植 `puzzle.js` 扣型与贴图烘焙）
- SceneKit 挤出拼块、旋转、托盘/棋盘点选
- 打乱、提示（Pro）、揭晓
- 相册选图、StoreKit Pro、存档骨架

## 待做

- 取景裁切 Sheet、飞行动画
- 多存档读写、导出分享、免费块数/水印门控

## 目录

- `Core/Engine/` — 切图与数据模型
- `Features/Game/` — SceneKit 场景与主界面
- `Core/Store/` — Pro 买断
