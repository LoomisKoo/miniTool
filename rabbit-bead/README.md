# 兔格拼豆

照片转拼豆色号图纸。H5 小工具（各内容平台分发）+ 原生 iOS App。

## 目录

```text
rabbit-bead/
├── index.html / app.js / palettes.js / style.css   # H5 共用源码
├── platforms/                                      # 各内容平台差异配置
├── build.mjs                                       # H5 打包
├── icon.png                                        # 图标源文件（512×512）
└── ios/                                            # 原生 iOS 工程
    ├── scripts/gen-palettes.mjs                    # 由 palettes.js 生成 Palettes.json
    └── RabbitBead/
        ├── RabbitBead.xcodeproj
        └── RabbitBead/{App,Core,Features,Resources}
```

## iOS

| 项 | 值 |
| --- | --- |
| 工程 | `ios/RabbitBead/RabbitBead.xcodeproj` |
| 名称 | 中文「兔格拼豆」/ 英文「RabbitBead」（ASC 名称：`RabbitBead: Fuse Bead Patterns`） |
| Bundle ID | `com.loomiskoo.rabbitbead` |
| 最低版本 | iOS 17.0 |
| 设备 | 仅 iPhone（`TARGETED_DEVICE_FAMILY = 1`）；Apple Silicon Mac 可装 |
| 版本 | 1.0.0（开发中） |
| 变现 | 买断制（非消耗型内购 `com.loomiskoo.rabbitbead.pro`） |
| 语言 | zh-Hans（源语言）+ en |

已实现：

- 相册选图 → 格内均值采样 → Oklab 最近色匹配 → 相似色连通域合并（Oklab 距离）→ 限色（色相分桶保覆盖）
- **取色与 H5 同口径**：新图按 5bit 颜色数自动选采样模式（卡通/插画用主色保描边、照片用均值降色差）；主色采样在边缘格（众数占比 < 0.55）自动回退均值；相似色合并与限色都用 Oklab 感知距离
- **图片裁切**：源图 + 累积裁切区域，同一次会话里可反复进入继续收紧或重新框大；比例（原始/1:1/3:4/4:3/9:16/16:9/自由）、缩放滑杆与双指捏合、90° 旋转、镜像；旋转与镜像会真正落到工作图，自由比例可拖四角手柄
- **布局与交互**：标题栏 → 预览框 + 预览工具条（`‹ 板号 ›` + `复位 / 3D`）→ 参数面板（默认展开；色卡 / 豆色 / 网格·合并·抖动·均值 + 豆宽 / 拼板 / 限色）→ 底部 `更多 / 裁切 / 编辑 / 重选 | 导出`（编辑进独立整页；H5 暂无作品库「保存」）
- 2D 预览：单指平移、双指锚点缩放、双击放大/复位（放大态回落铺满）；豆色密铺不留缝，格线叠画在格面之上；屏幕每格 ≥30pt 时自动显示色号；点格高亮色号；分板线按 H5 口径画（默认关，可开）
- 3D 预览：拖动旋转（方向对齐 H5）、俯仰角度、双指缩放；圆柱豆带中心孔、近黑底板。**渲染走 Metal 实例化**（每颗豆一个实例，深度缓冲保证遮挡，不排序、不降档），没有 Metal 时回退到 CPU 逐豆填充
- 2D ↔ 3D 切换有过渡：2D 先淡出、3D 从正俯视「立起来」并淡入（H5 `morphAnim` 的简化版，未搬 `hFactor`/`roundness` 形变）。**每次进 3D 都从默认视角开始**（yaw 0 / pitch 0.5 / zoom 1），不复用上次的旋转与缩放 —— 与 H5 一致（它的 `to3d` 动画终点就是写死的 `orbitYaw/orbitPitch`，起点也覆盖成正俯视）。复位时机有意分开：进 3D 时**立刻**复位（过渡正好从正俯视升到默认视角），退 2D 时推迟到过渡结束再复位（在这里复位会让退场动画的第一帧从默认视角起步，画面跳一下）
- 色号自动取对比色：按 H5 的 `luma > 160` 口径选深字 / 浅字（预览格内编号、3D 色号、导出图纸都同一套判据）
- 手绘编辑：**独立整页**（预览条上的「编辑」用 `NavigationLink` 推到 `BeadEditView`，`完成` 退栈，落笔直接改的是生成页那张图纸）。**不弹 cover，整页盖住主页**（自己声明 `.toolbar(.hidden, for: .tabBar)`，底部 tab 一起被盖住）：系统导航栏收起，页面自绘 44pt 顶栏（左上角返回 · 居中标题 · 右上角「更多」菜单 + 完成；复位这种低频动作以文字条目收在菜单里）。画笔 / 橡皮 / 取色三重工具，单指点涂且快速滑动按半格插值不断线；双指缩放会作废当前落笔；撤销 / 重做（60 步）/ 清空手绘；调参数时保留仍有效的手绘
- 手指放大镜（落笔 + 取色共用）：手指按在图上时，预览框里浮出一个 5×5 格的圆窗（浮在指尖上方，顶到边缘翻到下方），显示手指那一格及周围格子、格内色号，并用主题色圈出那一格；圆窗下方标出**图纸行列号**（1 起算 + 区域原点，与导出图纸的坐标轴同口径，分板导出也对得上），取色时再多一行**当前吸到的色号**（空格显示占位）。行列号的口径见 `BeadLoupe`
- **取色支持拖动**：单指按住拖动连续吸色，松手定下最后一格的颜色；吸到颜色后**不自动切回画笔**（一次进「取色」可以连着吸几个色，切工具自己点）。取色与画笔 / 橡皮共用同一条单指拖动，所以编辑态下平移仍走双指
- 面板底部信息行：`宽×高 · N色 · M颗 · cm 尺寸 · 拼板规格 · 板数`
- 导出 300DPI 图纸存相册：全图 / 分板逐个，可选行列坐标 / 格内色号 / 用量图例 / 标题信息（另加板间分割线）；图纸版式与 H5 `measureExport` / `exportDataUrl` 对齐（2×2 色块图例、块内色号取 `contrastInk` 三档反差色、坐标轴带刻度短线、标号字号不超过一格（缩不下就跳格标号，见 `BeadArtworkRenderer.axisLabeling`）、空格留白不铺灰）；图例顺序按**整幅颗数降序**再筛本板（与 H5 `exportLegendList` 一致，分板导出顺序稳定）、颗数显示本板用量；产物是 **JPEG + JFIF 密度 300DPI**（按面积选 0.72/0.82/0.92 质量档），打印选「实际大小」即每格 5mm；图纸底部常驻署名（iOS 端不再放引流式推广文案）；导出时全屏遮罩防误触；尺寸超限自动缩小单豆像素
- **作品库**：源图 + 参数 + 手绘一起保存，随时切回来接着改。手绘只存「与自动结果不同的格位」（`BeadHandEdit`），载入时用原图重跑量化再贴回，因此不存整张格子；格位序号 / 尺寸 / 色卡对不上就丢弃并提示。免费版上限 3 个，超出后提示升级
- 作品落盘在 `Application Support/RabbitBead/`：`projects.json` 索引 + `images/<uuid>.jpg` 源图 + `thumbs/<uuid>.jpg` 列表缩略图。不放 Caches，避免系统清空间时连同作品一起清掉
- **主页分两个 tab**：「拼豆」＝生成图纸（原编辑页），「我的」＝豆子库存 + 保存的作品。编辑模型提到 `BeadRootView`，从「我的」点开作品直接切回「拼豆」接着改，切 tab 也不会丢正在编辑的图纸
- **子页全由 `NavigationLink(value:)` 推出**（没有一处 `path.append`）：库存 / 作品 / 关于 / 手绘编辑 / 内嵌网页共用一个 `BeadRoute`，两条栈各自用 `beadDestinations(model:)` 注册同一份目的地。关于入口在「我的」系统栏右上角，是个 `info.circle` 的**系统栏按钮**（不铺底，按下高亮交给系统）
- **两个 tab 各有一条自己的导航栈**：`TabView` 里每个 tab 内部各包一条 `NavigationStack`（不再在 `TabView` 外面共用一条）。原因是系统栏挂在栈上 —— 共用一条栈就只能共用一条栏，切 tab 时栏的出现/消失会改 `TabView` 的高度，另一个 tab 已经建好的视图跟着重排（「拼豆」图案区缩一下）。分开后：「我的」栈根不收起栏，拿到**真系统栏**（标题、返回键、右上角关于入口都由系统渲染，iOS 26 上是液态玻璃）；「拼豆」栈根显式 `toolbar(.hidden)`，预览吃满整屏。子页在各自 tab 内 push，因此会**保留底部 tab**；要盖住 tab 的页面自己声明 —— 手绘编辑页带 `.toolbar(.hidden, for: .tabBar)`。两条栈都用 `beadDestinations(model:)` 注册同一份 `BeadRoute` 目的地
- **豆子库存**（「我的」tab）：登记手头有哪些色号、各多少颗，开工前先看看差哪些。键是 `色卡id/色号`（MARD 的 `A1` 与 COCO 的 `A01` 不混），落在同一目录的 `inventory.json`；库存页默认只看已登记的，切「全部」新增，点色块改数（填 0 即移除）

性能上的几处处理：

- 手势状态（缩放/平移/落笔）只留在 `BeadPreviewPane` 这一层，拖动时不再触发整屏 body 重算
- 用量与颗数改成缓存，只在量化完成 / 落笔结束 / 撤销 / 清空后重算，不再放进视图求值路径
- 2D 画布把同一行里颜色相同的连续格合并成一个矩形再填充（H5 是逐格 `fillRect`）
- 参数写入 `UserDefaults` 加了 500ms 防抖，拖滑杆时不再每帧写一次
- 3D 走 **Metal 实例化渲染**（`Bead3DMetalSupport` / `Bead3DMetalCanvas`）：圆柱网格（顶面环带 + 外壁 + 孔内壁，16 分段）全幅复用，每颗豆只提交「位置 + 颜色」两个实例属性，13k 颗 ≈ 1.25M 三角形一次 `drawIndexedPrimitives` 画完；开 4x MSAA 与 `.depth32Float` 深度测试，**不需要按深度排序**，也没有 LOD/降档档位
- 为什么非换不可：CPU 路径的瓶颈是 `GraphicsContext.fill` 的**每次绘制固定开销**，不是像素量。实测 8324 颗、每颗 2 笔（外壁 + 顶面）＝ 20.6ms，约 1.2µs/笔，而这一帧总覆盖面积只有约 3.3M 设备像素；同几何在 LOD0（每颗 1 笔、5440 颗）是 4.8ms，也是正比于笔数。H5 同样的算法不吃这份开销，是因为 canvas2d 在 WebKit 里走 GPU 光栅化，而 SwiftUI `Canvas` 是 CPU 光栅化
- 相机口径只有一份：`Bead3DRenderer.scene(camera:rect:viewport:)` 把 `project()` 那套针孔投影（`u = d·R/vz`、`v = d·U/vz`、像素焦距 `focal`）写成 view + projection 两个矩阵给 Metal 用，所以两条路径画面完全一致，2D↔3D 过渡结束切到稳定态不会跳。注意两处容易写反的符号：`Basis.U` 指向**屏幕向下**（`screenY = centerY + uy·focal`），而 Metal 的 NDC y 向上，所以投影矩阵 y 那行要**取负**；`view + projection` 里用的是**点**不是像素，与 drawable 倍率正好约掉（拉伸屏/原生倍率都不用额外处理）
- 过渡起点（交叉淡入的第一帧）的 zoom 由 `Bead3DRenderer.flatMatchedZoom` 给出，不是 1：2D 的 fit 是 `min(...) × 0.94`，3D 的 fit 是 `fitFactor(pitch: 0.5, pad: 28)`，两套公式不相等，各用各的就会出现「2D 与 3D 一大一小、叠不上」。该函数解 `cell × scale = focal / (eyeR - lookY)`，让正俯视的 3D 与 2D 逐格对齐；终点仍是用户相机的 zoom，中间线性过渡，2D→3D 与 3D→2D 两个方向都成立
- 着色器**运行时编译**（`MTLDevice.makeLibrary(source:)`）而不是 `.metal` 文件：不依赖工程把 .metal 加进 target 编译阶段，编不出来只是回退 CPU 渲染（`Bead3DCanvas`），不会变成构建错误。代价是首次求值几十~几百毫秒，`RabbitBeadApp.init` 里已在后台线程预热
- 没有 Metal 时的 CPU 兜底仍保留（`Bead3DCanvas` + `BeadMorphCanvas`）：逐豆只做「投影中心 + 按深度缩放一张预计算好的单位圆环」，可见弧段与明暗色按视角/色号各算一次全幅复用。需要对照时用启动参数 `-rabbitbead.useMetal NO`（或 `defaults write` 把 `rabbitbead.useMetal` 置 0）强制走这条路径
- CPU 兜底路径里，交互期**不改几何**（H5 也没有交互降级档）：只是不画格内色号 + 顶点数封顶。曾经交互期直接压到 LOD0，结果是拖动时每颗豆只剩一个纯色圆盘，看起来和 2D 扁平视图没区别
- 3D 的交互态判定只用会**自动复位**的 `@GestureState`（`threeDGestureActive`）与 `morph`/`cameraMorph`，不掺手工复位的 `@State` —— 手势被第二个手指或系统手势打断时 `onEnded` 不保证触发，用 `@State` 会永久卡在降档态
- 3D 拖动/缩放都是**绝对映射**，不逐帧累加 delta：记下「基准角度 / 基准 zoom」与**当时的累计输入量**，目标值 = 基准 + (当前输入 − 基准输入)。逐帧累加一旦被打断（第二个手指上台、系统手势抢走时 `onEnded` 不触发）就会残留偏差，下一次手势的第一帧带着旧值继续走
- 手势基准必须能判出「这是新一段手势」：`DragGesture.translation` 与 `MagnifyGesture.magnification` 在每段手势里都**从 0 / 1 重新计**，旧基准不失效的话，第二段手势的第一帧就会用「旧基准 + 新小值」算出错的绝对位置 —— 缩放上表现就是**把用户刚调好的大小复原**。判据是**处理相邻事件的时间间隔**（同一段手势事件连续投递，两段之间有抬手停顿）；`onEnded` 也清基准，但被系统手势抢走时不保证触发，所以时间间隔是兜底。基准里同时记输入量（`translation` / `magnification`），所以任何时刻重建基准都不会跳
- 3D 旋转的基准**只记 yaw/pitch，不记 zoom**：万一新一段手势没被认出来，最多让角度跳一下，绝不会把缩放复原。缩放那边除了时间间隔，还有一道「一帧内张合超过 35% 就地重建基准」的兜底（60Hz 下一帧不可能有这个幅度）
- 基准的清理不能挂在 `threeDGestureActive` 归零上 —— 双指捏合会把 `DragGesture` 顶掉，那时清基准会把仍在用的缩放基准一起清掉
- **没有旋转惯性**（与 H5 一致，H5 就是按位移直接写 yaw/pitch）：曾加过一段「甩动后继续转」的惯性，带来三个手感问题 —— 动画那 0.7s 内拖动被 `guard cameraMorph == nil` 全部吞掉（**拖不动**）、动画目标里已含惯性位移而结束回调又叠了一次（**松手跳一格**）、`predictedEndTranslation` 在手指末段回抽时指向反方向（**朝反方向转**）。复位动画现在也允许被拖动随时打断（`commitCameraMorphIfNeeded`）
- 3D 每帧埋点见 `BeadPerfProbe`：同时记「渲染耗时」与「出帧间隔」，用来区分瓶颈在渲染还是在 SwiftUI 视图/手势路径。**只在控制台输出慢帧**（`subsystem: rabbitbead, category: perf`，超 20ms 记一笔、最多 1 秒一条），界面上不显示任何浮层
- 导出图纸的色号样式与填充色按色号缓存，不再逐格构造 `UIColor`/`NSAttributedString`

与 H5 端仍有的差异（有意保留）：

- 2D ↔ 3D 过渡只做了淡入淡出 + 俯仰角变化，没有 H5 的 `hFactor`/`roundness` 形变（豆高与圆角不参与插值）
- 3D **稳定态不再画格内色号**：Metal 路径不叠字（逐颗 `Text` 正是 CPU 路径最贵的一笔），和 H5 一致 —— H5 的 `codeFade` 含 `(1 - t3d) * 1.35` 因子，稳定 3D 时本来就是 0。要看编号请回 2D（那里 ≥30pt/格 会显示）
- 3D 不画分板红线（CPU 兜底路径仍画）：默认关，需要时在 2D 或导出里看
- 3D 只有旋转与缩放，没有双指平移
- 3D 的 fit 锁定在初始角度（与 H5 相同），旋转放大后不会自动重新铺满
- 「分板线」默认关闭（H5 默认开）：预览与整幅导出都不画板间分割线，需要拼板对位时点开
- 图纸底部多一条署名条（H5 是引流文案，App 内不需要）

参数与手势口径基本按 H5 对齐：豆宽 29（16–116）、限色 60（8–80）、主色采样、抖动关、合并关、合并阈值 0.10（Oklab，无 UI）、拼板 29×29、最大放大 6.5 倍（`MAX_ZOOM`）、双击放大 2.3 倍 / 放大态复位阈值 1.35 倍。本地存档 key 升到 `rabbitbead.settings.v3`，旧存档直接丢弃，保证首启参数与 H5 一致。

**唯一有意偏离 H5：平移夹紧。** H5 `clampView2d` 为了让「双击角落放大」不跳，留了半屏余量（`edge = max(44, 半屏)`），放大后能把图片拖到边界外、露出大片空白；App 改按图片查看器口径严格夹紧（内容的边不能缩进容器内，内容小于容器时居中），见 `BeadPreviewPane.clampedOffset`。预览区高度变化（「更多」面板、切 3D）按布局动画跟随：未放大时重新适配（保持完整可见与居中），放大时保持缩放、按「内容中心在容器里的比例」延续视口。

色卡数据由 `ios/scripts/gen-palettes.mjs` 从 `palettes.js` 生成 `Resources/Palettes.json`，**改色卡要两边同步**（当前两边均为 MARD 291 / COCO 291，已逐条核对一致）。

运行：

```bash
open ios/RabbitBead/RabbitBead.xcodeproj
```

首次需要在 Xcode 里选一次 Team（`Signing & Capabilities`）才能上真机；模拟器可不填。
AppIcon 目前是把 `icon.png` 放大到 1024 的占位图，上架前需替换为原生 1024 源图。

### 设计系统

iOS 端 UI 按 Apple 设计语言（`getdesign apple`）重构，令牌与组件都收在
`Features/Editor/BeadUI.swift`（`BeadTheme` / `BeadAppearance` / `BeadRadius` / `BeadSpace`
+ `.beadXxx()` 字体修饰符）。改 UI 时只用这些令牌，不要写裸的十六进制色和字号：

| 类别 | 规则 |
| --- | --- |
| 暗色 | 每个色都是浅 / 深两态（`Color.adaptive`），跟随系统。页面退纯黑、卡面抬 `#1C1C1E`、交互蓝换 `#0071E3`；**导出/缩略图仍走白底**（`BeadArtworkRenderer` 不读主题） |
| 强调色 | 只有 `BeadTheme.primary`（Action Blue `#0066cc` / 深色 `#0071e3`）一个。破坏性动作用 `danger`，其余不再引入第二种彩色 |
| 文字 | 正文固定 17pt（`beadBody`），标题 17pt 以上带负字距（`beadDisplayLg` 28/600/-0.28） |
| 圆角 | `sm` 8 给紧凑工具、`md` 11 给小卡、`lg` 18 给卡片、`pill` 给一切「动作」 |
| 层级 | 靠「面」切换（`parchment` / `canvas` / `tile1`），卡片不加投影 |
| 投影 | 全项目只有 `beadProductShadow()` 一处，只给预览画布里的作品用 |
| 按压 | 一律 `BeadPressStyle`（`scale 0.95`） |
| 按钮 | 只有四种：`BeadButton` 的 `primary` / `ghost` / `utility` / `pearl`，并排时不超过一个实底蓝 |

两个容易踩的坑：

- **淡化（高亮色号）的目标色要走 `BeadAppearance`**。`Canvas` 里的 `Color` 会自己跟随外观，
  但淡化是把 `RGB8` 往目标色插值，算不出当前是深色还是浅色，得显式传。
  画布结构体（`BeadPreviewCanvas` / `Bead3DCanvas`）都带 `.equatable()`，
  所以 `appearance` 必须参与 `==`，否则切外观时画布不会重画。
- **浅色模式下的「深色块」不能用 `BeadTheme.ink` 当背景**。`ink` 在深色模式会翻成近白，
  拿它当底色就会白底白字；要深底白字的浮层用 `BeadTheme.overlaySurface`。同理色块描边
  用 `swatchStroke` / `swatchStrokeSoft`（浅色压暗、深色提亮）。

## 本地化

源语言是**中文**，`.swift` 里的中文字面量就是 key；英文翻译在
`ios/RabbitBead/RabbitBead/Resources/en.lproj/Localizable.strings`。
和 `zh-Hans.lproj`（key = value 的恒等表）一起被工程的文件系统同步组自动收进 bundle。

- **View 里的字面量不用管**：`Text("取消")` / `Button("保存")` / `.navigationTitle("色卡")`
  由 SwiftUI 自动查表。
- **传给 `String` 参数、或存进 model 的要显式加 `.loc`**：`BeadButton(title:)`、`BeadChip(title:)`、
  `BeadSliderRow(label:)`、`BeadSectionLabel(text:)`、`showHint(_:)`、`message = …` 这些 Swift 不会自动查。
- **带参数的用 `"…%ld…".loc(x)`**：占位符写在 key 里（`%ld` / `%@`），翻译可以整体调整语序，
  key 和值都别用 Swift 自己生成的 `\(…)` 形式 —— 那样 key 长什么样不可控。
  英文侧用 `%1$@` 这种定位占位符换序，参数个数校验见下。

`Core/L10n.swift` 就是 `String.loc` / `String.loc(_:)` 两个入口。查不到翻译会原样返回中文，
所以漏翻只会显示中文，不会露出 key。

App 显示名走 `InfoPlist.strings`（`CFBundleDisplayName`），目前
`INFOPLIST_KEY_CFBundleDisplayName` 兜底为英文 `RabbitBead`，`en.lproj` / `zh-Hans.lproj`
分别覆盖；相机 / 相册三条权限描述同样分流，不再给英文用户弹中文。

## 色卡数据的许可义务

色卡数据来自 [HansBug/pindou-color-data](https://github.com/HansBug/pindou-color-data)，
许可是 **MIT License（Copyright (c) 2026 HansBug）**。

> ⚠️ 注意：该仓库的 README 和子目录 README **都没提许可**，早期我们按 CC BY 4.0 写了，
> 是错的。以仓库根目录的 `LICENSE` 文件为准 —— 那是 MIT（作者把模板里的 "Software"
> 换成了 "Data"，所以 GitHub 的自动识别显示为 NOASSERTION）。

MIT 的关键条款是：

> The above copyright notice and **this permission notice** shall be included in all
> copies or substantial portions of the Data.

和 CC BY 不同，**MIT 不要求「用户可见的署名」**，而是要求**版权声明 + 许可全文随副本一起分发**。
所以两端的做法是：

| 端 | 副本是什么 | 许可全文放哪 |
| --- | --- | --- |
| H5 | `dist/*.zip`（含 `palettes.js`） | `palettes.js` 头部注释（随 zip 分发，别删） |
| iOS | App bundle | 「我的」→「关于」页的「许可全文」一节（`BeadAboutView`） |

只写「来自某某」不够 —— MIT 要的是**全文**。改数据源或许可时，
`palettes.js` 头、`BeadAboutView` 和隐私政策的第 10 节要一起更新。

改文案后的自查：`python3 ios/scripts/check-l10n.py`
—— 扫「含中文字面量但既没标 `.loc` 也不在 View 调用里」的残留、断言 `.loc(…)` 的实参个数
等于 key 里的占位符个数、并检查两张表 key 一一对应（顺带抓出删文案留下的死条目）。

## 上架素材

- 名称：中文「兔格拼豆」/ 英文「RabbitBead」
- 简介：照片转拼豆色号图纸 / Photo to fuse bead pattern
- 图标：`icon.png`
- 上架文案（中英双语 + 内购）：[`ios/APPSTORE.md`](ios/APPSTORE.md)
- 隐私政策 / 支持页：<https://loomiskoo.github.io/BeadPattern-pages/privacy.html>
  · <https://loomiskoo.github.io/BeadPattern-pages/support.html>
  （源在 public 仓库 [`LoomisKoo/BeadPattern-pages`](https://github.com/LoomisKoo/BeadPattern-pages)）
  这两页在 App 内用 `WKWebView` 内嵌打开（`BeadWebPageView`），不跳出到 Safari

| 平台 | 状态 | 版本 | 产物 |
| --- | --- | --- | --- |
| 小红书 | ✅ 已上线 | 1.0.1 | `dist/xiaohongshu-rabbit-bead.zip` |
| 抖音 | 未上架 | — | `dist/douyin-rabbit-bead.zip` |
| 快手 | ✅ 已上线 | 1.0.1 | `dist/kuaishou-rabbit-bead.zip` |
| iOS | 开发中 | 1.0.0 | `ios/RabbitBead/` |

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

[HansBug/pindou-color-data](https://github.com/HansBug/pindou-color-data)（MIT License，Copyright (c) 2026 HansBug）

- MARD：`mard-291-github`（291 色，与主流工具站一致）
- COCO：`coco-291`

屏幕 RGB 仅供参考，买豆请对照实物色卡。

## 保存到相册（平台差异）

| 环境 | 路径 |
| --- | --- |
| 小红书 | 有 `window.xhs.miniTool` 桥：`writeTempFile` → `saveImageToPhotosAlbum`，点「保存图纸」直接存相册 |
| 快手 / 抖音 | 容器内**没有存相册桥**，`a[download]` 也不落地（data: 与 blob: 都实测无反应）。点「保存图纸」改为弹出图纸原图的浮层，提示 **长按 → 选「保存图片」**（快手 iOS 真机已验证可行）；没有菜单时可截图 |
| 快手小游戏（若注入了 `window.ks`） | 优先 `getFileSystemManager().writeFile({ encoding:'base64' })` → `ks.saveImageToPhotosAlbum({ filePath })`（该 API 不吃 data: / 网络地址）；失败再回落长按浮层 |
| 浮层里的「系统分享」按钮 | 仅当 `navigator.canShare({ files })` 为真才显示（Web Share Level 2，宿主实现了才有）——安卓容器若实现了就能走系统面板存相册，没实现则按钮不出现，不留假按钮 |

长按浮层里的图片**不要写 `user-select: none`**——它可能连 `-webkit-touch-callout` 一起禁掉，长按就什么都不弹。

## 本地预览

用静态服务器打开本目录（需 `index.html` + `style.css` + `palettes.js` + `app.js` + `icon.png`）。浏览器里无 JSBridge 时，「导出图纸」会改为下载 PNG。

## 打包

```bash
node build.mjs                  # 全部平台
node build.mjs kuaishou         # 仅快手

# 小红书审计
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```
