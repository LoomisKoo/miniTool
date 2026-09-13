# 美食图鉴

点阵世界地图上的美食图鉴。离线单页 H5，各平台分发。

## 特性

- **点阵地球**：由 Natural Earth 陆地数据栅格化为 0.5° 点阵（无任何图片），可双指缩放 / 拖动
- **亮点即美食**：每个地点一个高亮点，点开看该地代表菜（含分类 / 口味 / 菜系 / 食材 / 做法 / 标签）
- **名录视图**：按大区分组浏览全部地点，支持搜索、筛选（分类·口味·食材·做法）与收藏（localStorage）
- iOS 风格：毛玻璃导航、分组卡片、底部 Tab、弹出详情

## 数据

| 文件 | 说明 |
| --- | --- |
| `data.js` | 地点与美食（源自 [china-food-map](https://againster1992-debug.github.io/china-food-map/)，可用 `scripts/import-china-food-map.mjs` 更新） |
| `land.js` | 世界陆地点阵（base64，0.5° 一格），已入库可直接打包 |
| `prov-land.js` | 中国省级陆地点阵（base64），用于平面国视 |
| `scripts/gen-land.mjs` | 重新生成 `land.js`：先下载 `land-110m.json` 再执行 |
| `scripts/gen-prov-land.mjs` | 重新生成 `prov-land.js` |

坐标仅需「大概」：点阵图上同一格内误差不可见，地点增补直接给经纬度即可（省会/大都市经纬度可参考通用城市表）。

## 数据来源与声明

| 来源 | 用途 | 授权 |
| --- | --- | --- |
| [china-food-map](https://github.com/againster1992-debug/china-food-map) | 美食文案（`data.js`，经改写与截断） | 上游仓库**未附开源协议**，默认保留所有权利；本项目为非盈利个人作品，已在名录页底部注明来源，如权利人提出异议即撤下 |
| [Natural Earth](https://www.naturalearthdata.com/) `land-110m` | 世界陆地点阵（`land.js`） | **Public Domain**，可自由使用，无需署名 |
| [阿里云 DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector)（源：高德开放平台） | 中国省界与九段线（`prov-land.js`） | 官方说明该数据**仅供学习交流**，商用需另行取得授权 |

免责：本工具仅供学习交流，相关权利归各来源作者所有。上架版本已在界面内展示来源与联系方式说明。

## 打包

```bash
node build.mjs                     # 全部平台
node build.mjs xiaohongshu         # 仅小红书
```

产物：`dist/{douyin|kuaishou|xiaohongshu}-meishitujian.zip`

## 上架素材

- 名称：美食图鉴
- 简介：点阵地图上的中国美食图鉴
- 图标：待补充 `icon.png`
