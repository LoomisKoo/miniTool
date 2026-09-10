# 兔格拼豆

照片转拼豆色号图纸。H5 小工具（各内容平台分发）+ 原生 iOS App。

## 目录

```text
bead-pattern/
├── index.html / app.js / palettes.js / style.css   # H5 共用源码
├── platforms/                                      # 各内容平台差异配置
├── build.mjs                                       # H5 打包
├── icon.png                                        # 图标源文件（512×512）
└── ios/                                            # 原生 iOS 工程
    ├── scripts/gen-palettes.mjs                    # 由 palettes.js 生成 Palettes.json
    └── BeadPattern/
        ├── BeadPattern.xcodeproj
        └── BeadPattern/{App,Core,Features,Resources}
```

## iOS

| 项 | 值 |
| --- | --- |
| 工程 | `ios/BeadPattern/BeadPattern.xcodeproj` |
| 名称 | 兔格拼豆 |
| Bundle ID | `com.loomiskoo.beadpattern` |
| 最低版本 | iOS 17.0 |
| 版本 | 1.0.0（开发中） |
| 变现 | 待定，按规范为买断制 |

已实现：

- 相册选图 → 格内主色采样 → Oklab 最近色匹配 → 相似色连通域合并 → 限色
- **布局与交互对齐 H5**：标题栏 → 预览框 + 预览工具条（`‹ 板号 › / 全图` + `复位 / 编辑 / 3D`）→ 参数面板（色卡 / 豆色 / 网格 / 合并 / 抖动 / 均值 chips + 豆宽滑杆 + 拼板与分板线 + 限色滑杆）→ 底部 `重选 / 导出图纸`
- 2D 预览：单指平移、双指锚点缩放、双击复位；豆色密铺不留缝，格线叠画在格面之上；屏幕每格 ≥30pt 时自动显示色号；点格高亮色号；分板线按 H5 口径画（默认关，可开）
- 3D 预览：拖动旋转（方向对齐 H5）、俯仰角度、双指缩放；圆柱豆带中心孔、近黑底板，按深度排序绘制；按远近自动降级（LOD）
- 2D ↔ 3D 切换有过渡：2D 先淡出、3D 从正俯视「立起来」并淡入（H5 `morphAnim` 的简化版，未搬 `hFactor`/`roundness` 形变）
- 色号自动取对比色：深色豆配白字、浅色豆配黑字（预览格内编号 + 导出图纸都按这颗豆的亮度选色，导出再加一圈反色描边）
- 手绘编辑：画笔 / 橡皮 / 取色三重工具，单指点涂且快速滑动按半格插值不断线；双指缩放会作废当前落笔；撤销 / 重做（60 步）/ 清空手绘；调参数时保留仍有效的手绘
- 面板底部信息行：`宽×高 · N色 · M颗 · cm 尺寸 · 拼板规格 · 板数`
- 导出 300DPI 图纸存相册：全图 / 分板逐个，可选行列坐标 / 格内色号 / 用量图例 / 标题信息（另加板间分割线）；用量图例对齐 H5（2×2 色块 + 块内色号 + 下方颗数）；图纸底部常驻 App Store 推广文案；导出时全屏遮罩防误触；尺寸超限自动缩小单豆像素

性能上的几处处理：

- 手势状态（缩放/平移/落笔）只留在 `BeadPreviewPane` 这一层，拖动时不再触发整屏 body 重算
- 用量与颗数改成缓存，只在量化完成 / 落笔结束 / 撤销 / 清空后重算，不再放进视图求值路径
- 2D 画布把同一行里颜色相同的连续格合并成一个矩形再填充（H5 是逐格 `fillRect`）
- 参数写入 `UserDefaults` 加了 500ms 防抖，拖滑杆时不再每帧写一次
- 3D 在接近正俯视时跳过侧壁与中心孔，减少每颗豆的投影计算
- 3D 逐豆只做「投影中心 + 按深度缩放一张预计算好的单位圆环」：可见弧段与明暗色按视角/色号各算一次全幅复用，不再每颗豆分配一批数组与 `Path`（这是旋转卡顿的主因）
- 导出图纸的色号样式与填充色按色号缓存，不再逐格构造 `UIColor`/`NSAttributedString`

与 H5 端仍有的差异（有意保留）：

- 2D ↔ 3D 过渡只做了淡入淡出 + 俯仰角变化，没有 H5 的 `hFactor`/`roundness` 形变（豆高与圆角不参与插值）
- 3D 只有旋转与缩放，没有双指平移
- 3D 的 fit 锁定在初始角度（与 H5 相同），旋转放大后不会自动重新铺满
- 「分板线」默认关闭（H5 默认开）：预览与整幅导出都不画板间分割线，需要拼板对位时点开

参数默认值与 H5 对齐：豆宽 29（16–116）、限色 48（8–80）、主色采样、抖动关、合并关、拼板 29×29。

色卡数据由 `ios/scripts/gen-palettes.mjs` 从 `palettes.js` 生成 `Resources/Palettes.json`，**改色卡要两边同步**。

运行：

```bash
open ios/BeadPattern/BeadPattern.xcodeproj
```

首次需要在 Xcode 里选一次 Team（`Signing & Capabilities`）才能上真机；模拟器可不填。
AppIcon 目前是把 `icon.png` 放大到 1024 的占位图，上架前需替换为原生 1024 源图。

## 上架素材

- 名称：兔格拼豆
- 简介：照片转拼豆色号图纸
- 图标：`icon.png`

| 平台 | 状态 | 版本 | 产物 |
| --- | --- | --- | --- |
| 小红书 | 审核中 | 1.0.1 | `dist/xiaohongshu-bead-pattern.zip` |
| 抖音 | 未上架 | — | `dist/douyin-bead-pattern.zip` |
| 快手 | 审核中 | 1.0.1 | `dist/kuaishou-bead-pattern.zip` |
| iOS | 开发中 | 1.0.0 | `ios/BeadPattern/` |

发版后在此更新版本号，并同步根目录总表。

## 默认参数

- 豆宽 **29**（标准单板）
- 限色 **48**（可调 8–80）
- 拼板 **29×29**
- 色卡：**MARD 291** / **COCO 291**（可切换）
- 采样：**主色**（可切均值）；默认开启相似色区域合并

## 功能

- 格内主导色采样（避免均值池化灰边），可选均值 / Floyd–Steinberg 抖动
- RGB 欧氏距离最近色匹配 + 可选限色
- 邻近相似色 BFS 合并，减少杂色
- 格线浅/深/关；分板红线；上一板/下一板
- 预览支持手势：单指平移、双指/滚轮缩放、双击放大/一键恢复大小；放大到一定程度格内自动显示色号
- 3D 视图：拖动旋转、俯仰观看角度、双指缩放、一键回到 2D
- 点色号高亮；用量清单；导出图纸可选项（行列坐标、格内色号、用量图例、标题信息），按钮导出并保存相册
- 手动编辑：画笔点涂/涂抹、橡皮擦回自动色、取色笔；撤销/重做、清空手绘；画笔双指缩放平移、落笔自动退出高亮；调节 豆宽/限色/色卡 等参数时保留仍有效的手绘（色号不存在于当前色卡则丢弃）

## 色卡来源

[HansBug/pindou-color-data](https://github.com/HansBug/pindou-color-data)（CC BY 4.0）

- MARD：`mard-291-github`（291 色，与主流工具站一致）
- COCO：`coco-291`

屏幕 RGB 仅供参考，买豆请对照实物色卡。

## 本地预览

用静态服务器打开本目录（需 `index.html` + `style.css` + `palettes.js` + `app.js` + `icon.png`）。浏览器里无 JSBridge 时，「导出图纸」会改为下载 PNG。

## 打包

```bash
node build.mjs                  # 全部平台
node build.mjs kuaishou         # 仅快手

# 小红书审计
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```
