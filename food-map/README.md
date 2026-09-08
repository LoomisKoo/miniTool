# 寻味

点阵世界地图上的美食图鉴。离线单页 H5，各平台分发。

## 特性

- **点阵地球**：由 Natural Earth 陆地数据栅格化为 0.5° 点阵（无任何图片），可双指缩放 / 拖动
- **亮点即美食**：每个地点一个高亮点，点开看该地代表菜
- **名录视图**：按大区分组浏览全部地点，支持搜索与收藏（localStorage）
- iOS 风格：毛玻璃导航、分组卡片、底部 Tab、弹出详情

## 数据

| 文件 | 说明 |
| --- | --- |
| `data.js` | 地点与美食（源自 [china-food-map](https://againster1992-debug.github.io/china-food-map/)，可用 `scripts/import-china-food-map.mjs` 更新） |
| `land.js` | 世界陆地点阵（base64，0.5° 一格），已入库可直接打包 |
| `scripts/gen-land.mjs` | 重新生成 `land.js`：先下载 `land-110m.json` 再执行 |

坐标仅需「大概」：点阵图上同一格内误差不可见，地点增补直接给经纬度即可（省会/大都市经纬度可参考通用城市表）。

## 打包

```bash
node build.mjs                     # 全部平台
node build.mjs xiaohongshu         # 仅小红书
```

产物：`dist/{douyin|kuaishou|xiaohongshu}-xunwei.zip`

## 上架素材

- 名称：寻味
- 简介：点阵地图上的美食图鉴
- 图标：待补充 `icon.png`
