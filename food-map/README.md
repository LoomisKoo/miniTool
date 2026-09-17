# 美食地图

点阵世界地图上看懂各地饮食。离线单页 H5，各平台分发。

## 特性

- **点阵地球**：由 Natural Earth 陆地数据栅格化为 0.5° 点阵（无任何图片），可双指缩放 / 拖动
- **亮点即美食**：每个地点一个高亮点，点开看该地代表菜（含分类 / 口味 / 菜系 / 食材 / 做法 / 标签）
- **名录视图**：按大区分组浏览全部地点，支持搜索、筛选（分类·口味·食材·做法）与收藏（localStorage）
- iOS 风格：毛玻璃导航、分组卡片、底部 Tab、弹出详情

## 数据

| 文件 | 说明 |
| --- | --- |
| `data.js` | 地点与美食（源自 [china-food-map](https://againster1992-debug.github.io/china-food-map/)，可用 `scripts/import-china-food-map.mjs` 更新） |
| `land.js` | 世界陆地点阵（base64 位压缩，0.25° 一格），已入库可直接打包 |
| `prov-land.js` | 中国省级省界栅格（0.125° 一格，稀疏 base64 码流）+ 九段线中线 |
| `scripts/gen-land.mjs` | 重新生成 `land.js`：先下载 `land-110m.json` 再执行 |
| `scripts/gen-prov-land.mjs` | 重新生成 `prov-land.js` |

坐标仅需「大概」：点阵图上同一格内误差不可见，地点增补直接给经纬度即可（省会/大都市经纬度可参考通用城市表）。

### 点阵是怎么来的

- **世界陆地**（`land.js`，0.25° 位压缩）：Natural Earth 110m 陆地栅格化，全世界一张；境外岛屿按此图绘成灰色。
- **中国省界**（`prov-land.js`，0.125° 稀疏码流）：DataV 省级边界栅格化，只覆盖 71~136°E / 3~56°N。省 ID 逐格保存，运行时再向陆地格扩边两轮、消除毛刺。稀疏编码（`varint(索引增量) + id`）让 1.5% 的非零格不再占满整块内存：0.25° 的 1350KB 降到 0.125° 的 165KB。
- **配色**：七色盘 + 约束着色。邻接取 8 邻域（含斜角），相邻必异色；隔一个省的「2 跳」关系作软约束，按两省重心距离加权（越近越避免同色），再局部微调到没有改色收益为止。四色就够把相邻省分开，但南方几省挤在一起时同一色相会隔省反复出现，看着仍像一片，所以用满七色。
- **小岛**：0.125° 对小于一格的岛礁仍是「全有或全无」，生成器对扫描线未命中任何格心的多边形按质心补一格（西沙、东沙、钓鱼岛、金门、舟山等），运行时作为专门的点补充绘制。
- **九段线**：DataV 的 `JD` 要素是细长多边形（宽约 0.02°），栅格化必然糊成一团。生成器按主轴两侧路径等长重采样取中点得到中线折线，前端每 0.06° 采样成点，与陆地点阵同一套绘制路径 —— 远看是虚线，放大是点串。

## 数据来源与声明

| 来源 | 用途 | 授权 |
| --- | --- | --- |
| [china-food-map](https://github.com/againster1992-debug/china-food-map) | 美食文案（`data.js`，经改写与截断） | 上游仓库**未附开源协议**，默认保留所有权利；本项目为非盈利个人作品，已在名录页底部注明来源，如权利人提出异议即撤下 |
| [Natural Earth](https://www.naturalearthdata.com/) `land-110m` | 世界陆地点阵（`land.js`） | **Public Domain**，可自由使用，无需署名 |
| [阿里云 DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector)（源：高德开放平台） | 中国省界与九段线（`prov-land.js`） | 官方说明该数据**仅供学习交流**，商用需另行取得授权；正式上架商用建议改用[标准地图服务](http://bzdt.ch.mnr.gov.cn/)带审图号的底图 |

免责：本工具仅供学习交流，相关权利归各来源作者所有。上架版本已在界面内展示来源与联系方式说明。

## 打包

```bash
node build.mjs                     # 全部平台
node build.mjs xiaohongshu         # 仅小红书
```

产物：`dist/{douyin|kuaishou|xiaohongshu}-meishitujian.zip`

## 上架素材

| 项 | 内容 |
| --- | --- |
| 名称 | 美食地图 |
| 简介 | 地图上看懂各地饮食 |
| 图标 | `assets/icon.jpg`（1024×1024，定位钉 + 碗饭） |
| 封面海报 | `covers/美食地图_封面.jpg`（1024×1365，3:4） |

### 发布状态

| 平台 | 状态 | 版本 | 产物 |
| --- | --- | --- | --- |
| 小红书 | ✅ 已上线 | 1.0.0 | `dist/xiaohongshu-meishitujian.zip` |
| 抖音 | 未上架 | — | `dist/douyin-meishitujian.zip` |
| 快手 | ✅ 已上线 | 1.0.0 | `dist/kuaishou-meishitujian.zip` |
