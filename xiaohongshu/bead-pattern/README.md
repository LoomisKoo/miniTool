# 豆图

照片转拼豆图纸。纯离线，面向小红书小工具。

## 默认参数

- 豆宽 **29**（标准单板）
- 限色 **12**
- 拼板 **29×29**
- 色卡：**MARD 221** / **COCO 291**（可切换）

## 功能

- 平均 / 邻近采样，可选 Floyd–Steinberg 抖动
- Lab 最近色匹配 + 限色合并
- 格线浅/深/关；分板红线；上一板/下一板
- 视口内自适应铺满预览（不可拖拽缩放）
- 点色号高亮；用量清单；按钮存相册

## 色卡来源

[HansBug/pindou-color-data](https://github.com/HansBug/pindou-color-data)（CC BY 4.0）

- MARD：`mard-221-alfonse-doudou`
- COCO：`coco-291`

屏幕 RGB 仅供参考，买豆请对照实物色卡。

## 本地预览

用静态服务器打开本目录（需 `index.html` + `style.css` + `palettes.js` + `app.js`）。浏览器里无 JSBridge 时，「存相册」会改为下载 PNG。
