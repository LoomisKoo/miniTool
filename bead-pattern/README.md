# 兔格拼豆

照片转拼豆色号图纸。纯离线 Web 小工具，各平台分发。

## 上架素材

- 名称：兔格拼豆
- 简介：照片转拼豆色号图纸
- 图标：`icon.png`

| 平台 | 状态 | 产物 |
| --- | --- | --- |
| 小红书 | ✅ 已上线 | `dist/xiaohongshu-bead-pattern.zip` |
| 抖音 | 未上架 | `dist/douyin-bead-pattern.zip` |
| 快手 | ✅ 已上线 | `dist/kuaishou-bead-pattern.zip` |

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
