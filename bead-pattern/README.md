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

- 相册选图 → 格内均值采样 → Oklab 最近色匹配 → 相似色连通域合并（Oklab 距离）→ 限色（色相分桶保覆盖）
- **取色与 H5 同口径**：新图按 5bit 颜色数自动选采样模式（卡通/插画用主色保描边、照片用均值降色差）；主色采样在边缘格（众数占比 < 0.55）自动回退均值；相似色合并与限色都用 Oklab 感知距离
- **图片裁切**：源图 + 累积裁切区域，同一次会话里可反复进入继续收紧或重新框大；比例（原始/1:1/3:4/4:3/9:16/16:9/自由）、缩放滑杆与双指捏合、90° 旋转、镜像；旋转与镜像会真正落到工作图，自由比例可拖四角手柄
- **布局与交互对齐 H5**：标题栏 → 预览框 + 预览工具条（`‹ 板号 › / 全图` + `复位 / 编辑 / 3D`）→ 参数面板（色卡 / 豆色 / 网格 / 合并 / 抖动 / 均值 chips + 豆宽滑杆 + 拼板与分板线 + 限色滑杆）→ 底部 `重选 / 裁切 / 导出图纸`
- 2D 预览：单指平移、双指锚点缩放、双击放大/复位（放大态回落铺满）；豆色密铺不留缝，格线叠画在格面之上；屏幕每格 ≥30pt 时自动显示色号；点格高亮色号；分板线按 H5 口径画（默认关，可开）
- 3D 预览：拖动旋转（方向对齐 H5）、俯仰角度、双指缩放；圆柱豆带中心孔、近黑底板。**渲染走 Metal 实例化**（每颗豆一个实例，深度缓冲保证遮挡，不排序、不降档），没有 Metal 时回退到 CPU 逐豆填充
- 2D ↔ 3D 切换有过渡：2D 先淡出、3D 从正俯视「立起来」并淡入（H5 `morphAnim` 的简化版，未搬 `hFactor`/`roundness` 形变）。**每次进 3D 都从默认视角开始**（yaw 0 / pitch 0.5 / zoom 1），不复用上次的旋转与缩放 —— 与 H5 一致（它的 `to3d` 动画终点就是写死的 `orbitYaw/orbitPitch`，起点也覆盖成正俯视）。复位时机有意分开：进 3D 时**立刻**复位（过渡正好从正俯视升到默认视角），退 2D 时推迟到过渡结束再复位（在这里复位会让退场动画的第一帧从默认视角起步，画面跳一下）
- 色号自动取对比色：按 H5 的 `luma > 160` 口径选深字 / 浅字（预览格内编号、3D 色号、导出图纸都同一套判据）
- 手绘编辑：画笔 / 橡皮 / 取色三重工具，单指点涂且快速滑动按半格插值不断线；双指缩放会作废当前落笔；撤销 / 重做（60 步）/ 清空手绘；调参数时保留仍有效的手绘
- 面板底部信息行：`宽×高 · N色 · M颗 · cm 尺寸 · 拼板规格 · 板数`
- 导出 300DPI 图纸存相册：全图 / 分板逐个，可选行列坐标 / 格内色号 / 用量图例 / 标题信息（另加板间分割线）；图纸版式与 H5 `measureExport` / `exportDataUrl` 对齐（2×2 色块图例、块内色号取 `contrastInk` 三档反差色、坐标轴带刻度短线、空格留白不铺灰）；图例顺序按**整幅颗数降序**再筛本板（与 H5 `exportLegendList` 一致，分板导出顺序稳定）、颗数显示本板用量；产物是 **JPEG + JFIF 密度 300DPI**（按面积选 0.72/0.82/0.92 质量档），打印选「实际大小」即每格 5mm；图纸底部常驻署名（iOS 端不再放引流式推广文案）；导出时全屏遮罩防误触；尺寸超限自动缩小单豆像素
- **作品库**：源图 + 参数 + 手绘一起保存，随时切回来接着改。手绘只存「与自动结果不同的格位」（`BeadHandEdit`），载入时用原图重跑量化再贴回，因此不存整张格子；格位序号 / 尺寸 / 色卡对不上就丢弃并提示。免费版上限 3 个，超出后提示升级
- 作品落盘在 `Application Support/BeadPattern/`：`projects.json` 索引 + `images/<uuid>.jpg` 源图 + `thumbs/<uuid>.jpg` 列表缩略图。不放 Caches，避免系统清空间时连同作品一起清掉

性能上的几处处理：

- 手势状态（缩放/平移/落笔）只留在 `BeadPreviewPane` 这一层，拖动时不再触发整屏 body 重算
- 用量与颗数改成缓存，只在量化完成 / 落笔结束 / 撤销 / 清空后重算，不再放进视图求值路径
- 2D 画布把同一行里颜色相同的连续格合并成一个矩形再填充（H5 是逐格 `fillRect`）
- 参数写入 `UserDefaults` 加了 500ms 防抖，拖滑杆时不再每帧写一次
- 3D 走 **Metal 实例化渲染**（`Bead3DMetalSupport` / `Bead3DMetalCanvas`）：圆柱网格（顶面环带 + 外壁 + 孔内壁，16 分段）全幅复用，每颗豆只提交「位置 + 颜色」两个实例属性，13k 颗 ≈ 1.25M 三角形一次 `drawIndexedPrimitives` 画完；开 4x MSAA 与 `.depth32Float` 深度测试，**不需要按深度排序**，也没有 LOD/降档档位
- 为什么非换不可：CPU 路径的瓶颈是 `GraphicsContext.fill` 的**每次绘制固定开销**，不是像素量。实测 8324 颗、每颗 2 笔（外壁 + 顶面）＝ 20.6ms，约 1.2µs/笔，而这一帧总覆盖面积只有约 3.3M 设备像素；同几何在 LOD0（每颗 1 笔、5440 颗）是 4.8ms，也是正比于笔数。H5 同样的算法不吃这份开销，是因为 canvas2d 在 WebKit 里走 GPU 光栅化，而 SwiftUI `Canvas` 是 CPU 光栅化
- 相机口径只有一份：`Bead3DRenderer.scene(camera:rect:viewport:)` 把 `project()` 那套针孔投影（`u = d·R/vz`、`v = d·U/vz`、像素焦距 `focal`）写成 view + projection 两个矩阵给 Metal 用，所以两条路径画面完全一致，2D↔3D 过渡结束切到稳定态不会跳。注意两处容易写反的符号：`Basis.U` 指向**屏幕向下**（`screenY = centerY + uy·focal`），而 Metal 的 NDC y 向上，所以投影矩阵 y 那行要**取负**；`view + projection` 里用的是**点**不是像素，与 drawable 倍率正好约掉（拉伸屏/原生倍率都不用额外处理）
- 过渡起点（交叉淡入的第一帧）的 zoom 由 `Bead3DRenderer.flatMatchedZoom` 给出，不是 1：2D 的 fit 是 `min(...) × 0.94`，3D 的 fit 是 `fitFactor(pitch: 0.5, pad: 28)`，两套公式不相等，各用各的就会出现「2D 与 3D 一大一小、叠不上」。该函数解 `cell × scale = focal / (eyeR - lookY)`，让正俯视的 3D 与 2D 逐格对齐；终点仍是用户相机的 zoom，中间线性过渡，2D→3D 与 3D→2D 两个方向都成立
- 着色器**运行时编译**（`MTLDevice.makeLibrary(source:)`）而不是 `.metal` 文件：不依赖工程把 .metal 加进 target 编译阶段，编不出来只是回退 CPU 渲染（`Bead3DCanvas`），不会变成构建错误。代价是首次求值几十~几百毫秒，`BeadPatternApp.init` 里已在后台线程预热
- 没有 Metal 时的 CPU 兜底仍保留（`Bead3DCanvas` + `BeadMorphCanvas`）：逐豆只做「投影中心 + 按深度缩放一张预计算好的单位圆环」，可见弧段与明暗色按视角/色号各算一次全幅复用。需要对照时用启动参数 `-beadpattern.useMetal NO`（或 `defaults write` 把 `beadpattern.useMetal` 置 0）强制走这条路径
- CPU 兜底路径里，交互期**不改几何**（H5 也没有交互降级档）：只是不画格内色号 + 顶点数封顶。曾经交互期直接压到 LOD0，结果是拖动时每颗豆只剩一个纯色圆盘，看起来和 2D 扁平视图没区别
- 3D 的交互态判定只用会**自动复位**的 `@GestureState`（`threeDGestureActive`）与 `morph`/`cameraMorph`，不掺手工复位的 `@State` —— 手势被第二个手指或系统手势打断时 `onEnded` 不保证触发，用 `@State` 会永久卡在降档态
- 3D 拖动/缩放都是**绝对映射**，不逐帧累加 delta：记下「基准角度 / 基准 zoom」与**当时的累计输入量**，目标值 = 基准 + (当前输入 − 基准输入)。逐帧累加一旦被打断（第二个手指上台、系统手势抢走时 `onEnded` 不触发）就会残留偏差，下一次手势的第一帧带着旧值继续走
- 手势基准必须能判出「这是新一段手势」：`DragGesture.translation` 与 `MagnifyGesture.magnification` 在每段手势里都**从 0 / 1 重新计**，旧基准不失效的话，第二段手势的第一帧就会用「旧基准 + 新小值」算出错的绝对位置 —— 缩放上表现就是**把用户刚调好的大小复原**。判据是**处理相邻事件的时间间隔**（同一段手势事件连续投递，两段之间有抬手停顿）；`onEnded` 也清基准，但被系统手势抢走时不保证触发，所以时间间隔是兜底。基准里同时记输入量（`translation` / `magnification`），所以任何时刻重建基准都不会跳
- 3D 旋转的基准**只记 yaw/pitch，不记 zoom**：万一新一段手势没被认出来，最多让角度跳一下，绝不会把缩放复原。缩放那边除了时间间隔，还有一道「一帧内张合超过 35% 就地重建基准」的兜底（60Hz 下一帧不可能有这个幅度）
- 基准的清理不能挂在 `threeDGestureActive` 归零上 —— 双指捏合会把 `DragGesture` 顶掉，那时清基准会把仍在用的缩放基准一起清掉
- **没有旋转惯性**（与 H5 一致，H5 就是按位移直接写 yaw/pitch）：曾加过一段「甩动后继续转」的惯性，带来三个手感问题 —— 动画那 0.7s 内拖动被 `guard cameraMorph == nil` 全部吞掉（**拖不动**）、动画目标里已含惯性位移而结束回调又叠了一次（**松手跳一格**）、`predictedEndTranslation` 在手指末段回抽时指向反方向（**朝反方向转**）。复位动画现在也允许被拖动随时打断（`commitCameraMorphIfNeeded`）
- 3D 每帧埋点见 `BeadPerfProbe`：同时记「渲染耗时」与「出帧间隔」，用来区分瓶颈在渲染还是在 SwiftUI 视图/手势路径。**只在控制台输出慢帧**（`subsystem: beadpattern, category: perf`，超 20ms 记一笔、最多 1 秒一条），界面上不显示任何浮层
- 导出图纸的色号样式与填充色按色号缓存，不再逐格构造 `UIColor`/`NSAttributedString`

与 H5 端仍有的差异（有意保留）：

- 2D ↔ 3D 过渡只做了淡入淡出 + 俯仰角变化，没有 H5 的 `hFactor`/`roundness` 形变（豆高与圆角不参与插值）
- 3D **稳定态不再画格内色号**：Metal 路径不叠字（逐颗 `Text` 正是 CPU 路径最贵的一笔），和 H5 一致 —— H5 的 `codeFade` 含 `(1 - t3d) * 1.35` 因子，稳定 3D 时本来就是 0。要看编号请回 2D（那里 ≥30pt/格 会显示）
- 3D 不画分板红线（CPU 兜底路径仍画）：默认关，需要时在 2D 或导出里看
- 3D 只有旋转与缩放，没有双指平移
- 3D 的 fit 锁定在初始角度（与 H5 相同），旋转放大后不会自动重新铺满
- 「分板线」默认关闭（H5 默认开）：预览与整幅导出都不画板间分割线，需要拼板对位时点开
- 图纸底部多一条署名条（H5 是引流文案，App 内不需要）

参数与手势口径已按 H5 对齐：豆宽 29（16–116）、限色 60（8–80）、主色采样、抖动关、合并关、合并阈值 0.10（Oklab，无 UI）、拼板 29×29、最大放大 6.5 倍（`MAX_ZOOM`）、平移夹紧留半屏余量（`clampView2d`）、双击放大 2.3 倍 / 放大态复位阈值 1.35 倍。本地存档 key 升到 `beadpattern.settings.v3`，旧存档直接丢弃，保证首启参数与 H5 一致。

色卡数据由 `ios/scripts/gen-palettes.mjs` 从 `palettes.js` 生成 `Resources/Palettes.json`，**改色卡要两边同步**（当前两边均为 MARD 291 / COCO 291，已逐条核对一致）。

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
| 小红书 | ✅ 已上线 | 1.0.1 | `dist/xiaohongshu-bead-pattern.zip` |
| 抖音 | 未上架 | — | `dist/douyin-bead-pattern.zip` |
| 快手 | ✅ 已上线 | 1.0.1 | `dist/kuaishou-bead-pattern.zip` |
| iOS | 开发中 | 1.0.0 | `ios/BeadPattern/` |

发版后在此更新版本号，并同步根目录总表。

## 默认参数

- 豆宽 **29**（标准单板）
- 限色 **60**（可调 8–80）
- 拼板 **29×29**
- 色卡：**MARD 291** / **COCO 291**（可切换）
- 采样：**主色**（可切均值）；载入新图后按 5bit 颜色数自动选（卡通/插画 → 主色，照片 → 均值），默认不开相似色区域合并

## 功能

- 格内均值采样（线性光均值，照片渐变区色差更小），可选主色 / Floyd–Steinberg 抖动
- Oklab 最近色匹配 + 可选限色（限色时按色相分桶保覆盖，避免小面积关键色被跨色相重映射）
- 邻近相似色 BFS 合并（Oklab 感知距离），减少杂色
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
