# 01 · 像素配方引擎

一套生成器同时产出**宠物**和**鱼**。这是整条线的共同基座，先做它。

---

## 1. 数据格式

### 1.1 宠物配方

```ts
// src/catalog/recipes.ts
export type PetRecipe = {
  body: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7   // 团子 / 圆 / 扁 / 高 / 长条 / 方 / 水滴 / 星
  ears: 0 | 1 | 2 | 3 | 4 | 5           // 尖 / 垂 / 圆 / 角 / 触角 / 无
  tail: 0 | 1 | 2 | 3 | 4 | 5           // 卷 / 蓬 / 细长 / 鳍 / 光点 / 无
  eyes: 0 | 1 | 2 | 3 | 4               // 圆 / 豆 / 星 / 竖瞳 / 闭
  pattern: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 // 无 / 斑点 / 条纹 / 渐变 / 背脊 / 肚皮 / 雪花 / 光纹
  size: 0 | 1 | 2                        // 0.85 / 1.0 / 1.15 倍
  seed: number                           // 0~1，细节抖动
}
```

**一只宠物 = 8 个数字**，序列化后约 30 字节。120 只图鉴蓝图 = 3.6KB。

### 1.2 鱼配方

```ts
export type FishRecipe = {
  body: 0 | 1 | 2 | 3 | 4   // 纺锤 / 扁 / 长鳗 / 圆胖 / 扁头
  fin: 0 | 1 | 2 | 3        // 扇形 / 旗形 / 飘带 / 棘
  tail: 0 | 1 | 2 | 3       // 叉 / 圆 / 月 / 细
  eyes: 0 | 1 | 2
  pattern: 0 | 1 | 2 | 3 | 4 | 5
  size: 0 | 1 | 2
  seed: number
}
```

### 1.3 配色

**部位用槽位索引，颜色用调色板**。这是「每只都能改色」唯一的低成本实现。

```ts
/** 槽位固定 8 个，全部存在，没用到的槽位填 0 */
export const SLOT = {
  body: 0,
  belly: 1,
  accent: 2,   // 花纹 / 鳍
  eye: 3,
  ear: 4,      // 宠物：耳/角/触角；鱼：鳍
  tail: 5,
  collar: 6,   // 宠物专用：项圈。野生留空
  deco: 7,     // 装饰品
} as const

export type Palette = [string, string, string, string, string, string, string, string]
```

预置 12 套配色（`src/catalog/palettes.ts`），玩家可自定义任意 8 个 hex。服务端每个 hex 用现有 `HEX` 正则校验。

---

## 2. 光栅化：配方 → 像素

### 2.1 绘制顺序

像素画不能靠「画形状再填色」，要靠**分层覆盖**。每层只写自己负责的槽位：

```
1. 剪影层     body 原型 → 决定轮廓掩码
2. 耳朵 / 角  ears 叠在轮廓上，写 SLOT.ear
3. 尾巴       tail 挂在轮廓右下，写 SLOT.tail
4. 花纹       pattern 在轮廓内做图案，写 SLOT.accent
5. 肚皮       body 下 40% 反相，写 SLOT.belly
6. 描边       轮廓外扩 1px，写 SLOT.body 压暗 0.55
7. 眼睛       eyes 叠在头部区域，写 SLOT.eye
8. 高光       轮廓左上 2~3 个像素提亮 1.25
9. 项圈       collar 槽位（若有）
```

### 2.2 输出格式：索引图不是 RGBA

**图集存「槽位 + 明暗」而不是颜色**，这样才能做到换色零成本：

```ts
// 每个像素 1 字节：
//   0                    透明
//   1 + slot + 16 * shade   slot 0~7，shade 0~14（7 = 正常亮度）
// 0 = 透明，所以最小的非透明值是 1；最大 1+7+16*14 = 232。
const cell = new Uint8Array(64 * 64)
const pack = (slot: number, shade: number) => 1 + slot + 16 * clamp(shade, 0, 14)
```

图集用 `R8`（红通道）格式的 `DataTexture`，内存是 RGBA 的 1/4：

```
960 单元 × 64 × 64 = 3.93 MB (R8)
对比 RGBA 方案：15.7 MB
```

### 2.3 着色器取色

```glsl
uniform sampler2D uIndex;   // 索引图集，R8
uniform sampler2D uPalette; // 8 × N 的调色板 LUT
varying vec2 vUv;

void main() {
  float b = texture2D(uIndex, vUv).r * 255.0;
  if (b < 0.5) discard;                 // 0 = 透明
  float v = b - 1.0;
  float slot = mod(v, 16.0);            // 0..7
  float shade = floor(v / 16.0);        // 0..14
  float k = 0.55 + shade * 0.064;       // 亮度倍数
  vec3 c = texture2D(uPalette, vec2((slot * 8.0 + 0.5) / 64.0, uPalRow)).rgb * k;
  ...
}
```

实例化时每个宠物传自己的调色板行号；需要完全自定义配色时，直接传 8 个 `vec3` 的 `InstancedBufferAttribute`（1000 只 × 24 float ≈ 96KB，完全可接受）。

### 2.4 帧

| 蓝图类型 | 帧 | 用途 |
|---|---|---|
| 宠物 | 8 | idle ×4（呼吸/眨眼）、walk ×2、sit ×1、sleep ×1 |
| 鱼 | 2 | idle 摆尾 ×2 |

宠物 8 帧是刻意的：**呼吸和眨眼是「活着」的全部**，比增加动作数量更重要。

### 2.5 图集容量

```
单元 64×64，图集 2048×2048 → 32×32 = 1024 单元

宠物图集：120 蓝图 × 8 帧 = 960 + 装饰 6 + 项圈 8 + 预留 50
鱼图集：  240 种 × 2 帧 = 480 + 预留 544
```

两张图集，两张 R8 纹理，够用很久。

> **野生变种用第二张小图集。** 图鉴 120 个蓝图占满主图集；街头每小时刷出的
> 12 只野生宠物是图鉴之外的随机组合，光栅化进一张 512²（64 格）的运行时图集，
> 每小时整批重画一次，成本约 1ms。这样「图鉴之外的组合」不会挤占图鉴容量。
>
> **项圈不烘进宠物格子。** 「有没有项圈」和「什么颜色」是运行时的归属状态，
> 烘进去就得为每只宠物存两套图。改成 8 个（每种体型一个）通用图层，
> 用 `SLOT.collar` 取色，代价只有 8 个格子——这也是「已领养」在像素层零成本的原因。

---

## 3. 装饰品

装饰**不合并进宠物图集**（会组合爆炸），而是独立的第二层 sprite：

```ts
export type DecoId = 'hat' | 'scarf' | 'bow' | 'glasses' | 'wings' | 'bell'
```

- 装饰是单帧 64×64，共 6 个单元
- 渲染时是同一 billboard 位置的第二个 quad，共用一个 `InstancedMesh`
- 每个装饰实例读 `SLOT.deco` 取色
- 项圈同理，是第三个 quad（8 种体型各一格），读 `SLOT.collar`

**总 draw call：宠物 1 + 装饰 1 + 项圈 1 + 鱼 1 = 4。**

装饰与项圈都**不做整格覆盖**：透明像素不写入，所以叠加后原来的轮廓和描边都保留。

---

## 4. 3D 中显示（billboard）

### 4.1 硬性规格

| 项 | 值 | 理由 |
|---|---|---|
| 世界高度 | `0.6m` × size 倍数 | 相对 3m 层高的街道，这个比例才「可爱」 |
| 放大采样 | `NearestFilter` | 保持像素硬边，这是「像素感」的唯一来源 |
| 缩小采样 | `LinearMipmapLinearFilter` + `anisotropy 2` | 否则远处会闪成噪点 |
| 朝向 | 绕 Y 轴始终面向相机（`billboard`） | 不要只在水平面转，iso 视角需要完全朝向 |
| 阴影 | **不投影**，用贴地的球形暗斑 | 像素精灵投出真实阴影会立刻穿帮 |
| 光照 | 不受场景光照，只按「夜/昼」整体乘一个亮度 | 否则 IBL 会把像素画洗白 |

### 4.2 合并渲染

一个 `InstancedMesh` 承载屏幕内所有宠物，几何是单个 1×1 quad：

```ts
// 每个实例需要：
// aPos      vec3    世界位置（由 seeded 算出，每帧更新）
// aCell     float   图集单元索引（含帧）
// aFacing   float   +1 / -1（水平翻转，代替「左右两套图」）
// aBright   float   昼 1.0 / 夜 0.72
// aPalette  vec3[8] 调色板
```

> 水平翻转是最省的做法：**只需画朝右的 8 帧**，朝左靠 `aFacing` 翻转。

### 4.3 与城市的视觉缝合

像素精灵放进写实城市，唯一的补救是**接触感**：

1. 脚下贴一个 0.35m 的软暗斑（`GlowDisc` 已有实现，反色使用）
2. 精灵底部做一个 2px 的深色「落地线」
3. 精灵**不吃雾**，但在 `dist > 60m` 时整体 alpha 淡出到 0，避免和雾色打架

---

## 5. 预览页（M0 验收物）

新增 `catalog.html` + `src/catalog/preview.tsx`，独立入口，不进主包：

- 左：参数面板（8 个下拉 + 3 个滑杆 + 调色板取色器）
- 中：64×64 像素预览，放大 8 倍显示，带棋盘格底
- 右：动画预览（8 帧循环）+ 在 3 种距离下的实际尺寸模拟
- 底部：`导出图集` 按钮 → 下载 `pets-atlas.png` + `pets-index.json`

**这个页面是给美术调参用的，必须能脱机跑**，不依赖服务端。

---

## 6. 需要新建的文件

```
src/catalog/
  recipes.ts        配方类型 + 120 宠物蓝图 + 240 鱼蓝图 + 12 套配色 + 校验
  rasterize.ts      配方 → Uint8Array（纯函数，无 DOM 依赖，可进 Worker）
  layout.ts         单元排布 + paintCell + atlasJobs（纯计算，不含 three）
  atlas.ts          DataTexture 创建（索引图 + 调色板 LUT）
  preview.tsx       预览页（参数台 / 逐帧 / 距离模拟 / 导出）
  main.tsx          预览页入口
catalog.html        预览页（独立入口，不进主包）
```

运行时的图集分两张，别混用：

| 图集 | 尺寸 | 内容 | 何时重建 |
|---|---|---|---|
| 主图集 | 2048² | 图鉴 120 蓝图 × 8 帧 + 装饰 + 项圈 | 构建期导出 |
| 运行时图集 | 1024² | 野生/已领养宠物的当前组合 | 换批时（每小时）一次 |

主图集不进首屏 bundle：图鉴只有在打开图鉴面板时才需要它。

`rasterize.ts` 必须是**纯函数**（输入配方 + 帧号，输出 `Uint8Array(4096)`），这样才能放进 Worker、也能单测。

入口地址：开发时 `/catalog.html`。
