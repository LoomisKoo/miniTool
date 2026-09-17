# 彩码

链接 / 文字 / WiFi / 名片，一键生成可美化的二维码；支持「花束」3D 模式（花瓶花束点击绽放为可扫码）。免费工具，各平台分发引流。

纯离线 Web 小工具（源码在 `src/`，QR 编码内核为内置的 [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) MIT 单文件；花束模式依赖包内 Three.js，无外部 CDN）。支持配色、圆点/圆角风格、中间插 Logo，以及花种/花束配色；实时预览，导出 PNG。

## 上架信息

| 项 | 内容 |
| --- | --- |
| 名称 | 彩码 |
| 简介 | 链接/文字/WiFi/名片一键生成二维码，支持美化与花束绽放 |
| 图标 | `colorqr/icon.png`（待创建，各平台上架封面/图标用，不打进 zip 包） |

### 发布状态

仓库根目录有跨项目 [发布总表](../README.md#发布总表)；此处只记本工具。

| 平台 | 状态 | 版本 | 产物 |
| --- | --- | --- | --- |
| 小红书 | 未上架 | — | `dist/xiaohongshu-colorqr.zip` |
| 抖音 | 未上架 | — | `dist/douyin-colorqr.zip` |
| 快手 | 未上架 | — | `dist/kuaishou-colorqr.zip` |

## 目录

```
colorqr/
├── src/                 # 共用源码
│   ├── app.js           # 逻辑（含表单→payload、Canvas 美化绘制、导出）
│   ├── bloom.js         # 花束模式（Three.js 程序化花束↔QR）
│   ├── style.css        # 样式
│   ├── body.html        # DOM 结构
│   ├── config.base.json # 默认配置
│   └── vendor/
│       ├── qrcode.js
│       └── three.min.js
├── platforms/           # 平台差异
│   ├── douyin/config.json
│   ├── kuaishou/config.json
│   └── xiaohongshu/config.json
├── build.mjs            # 打包脚本
└── dist/                # 产物（git 已忽略）
```

## 开发

改 `src/` 下文件，然后打包：

```bash
node build.mjs              # 全部平台
node build.mjs douyin       # 仅抖音
```

本地预览（以小红书包为例）：

```bash
node build.mjs xiaohongshu
python3 -m http.server 9876 --directory dist/xiaohongshu
```

## 花束模式说明

- 样式模式选「花束」后，预览为程序化 **3D 花瓣几何** 花束（牛皮纸包装）；左右拖动旋转，轻点在花束 / 二维码间切换
- 小红书包不允许 `.glb`，故用 Three.js 程序化花瓣/花心/叶，**不是**整朵平面贴图，也不是参考站同款模型文件
- 绽放后为**正方形色块码点**（可扫）；花在过渡中缩小淡出
- 可选牡丹 / 百合 / 玫瑰 / 郁金香与多套配色
- WebGL 不可用时自动退回经典平面模式

## 上传

各平台上传对应 `dist/{平台}-colorqr.zip`。小红书 zip 须根目录含 `index.html`。
