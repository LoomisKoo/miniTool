# 兔格拼豆

照片转拼豆色号图纸。纯离线 Web 小工具，各平台分发。

## 上架素材

- 名称：兔格拼豆
- 简介：照片转拼豆色号图纸
- 图标：`icon.png`

| 平台 | 产物 |
| --- | --- |
| 小红书 | `dist/xiaohongshu-bead-pattern.zip` |
| 抖音 | `dist/douyin-bead-pattern.zip` |
| 快手 | `dist/kuaishou-bead-pattern.zip` |

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
- 视口内自适应铺满预览（不可拖拽缩放）
- 点色号高亮；用量清单；按钮存相册

## 色卡来源

[HansBug/pindou-color-data](https://github.com/HansBug/pindou-color-data)（CC BY 4.0）

- MARD：`mard-291-github`（291 色，与主流工具站一致）
- COCO：`coco-291`

屏幕 RGB 仅供参考，买豆请对照实物色卡。

## 本地预览

用静态服务器打开本目录（需 `index.html` + `style.css` + `palettes.js` + `app.js` + `icon.png`）。浏览器里无 JSBridge 时，「存相册」会改为下载 PNG。

## 打包

```bash
node build.mjs                  # 全部平台
node build.mjs kuaishou         # 仅快手

# 小红书审计
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```
