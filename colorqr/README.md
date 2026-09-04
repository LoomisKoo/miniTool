# 彩码

链接 / 文字 / WiFi / 名片，一键生成可美化的二维码。免费工具，各平台分发引流。

纯离线 Web 小工具（源码在 `src/`，QR 编码内核为内置的 [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) MIT 单文件，无外部依赖）。支持配色、圆点/圆角风格、中间插 Logo，实时预览，导出 PNG。

## 上架信息

| 项 | 内容 |
| --- | --- |
| 名称 | 彩码 |
| 简介 | 链接/文字/WiFi/名片一键生成二维码，支持美化样式 |
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
│   ├── style.css        # 样式
│   ├── body.html        # DOM 结构
│   ├── config.base.json # 默认配置
│   └── vendor/qrcode.js # QR 编码内核（MIT，qrcode-generator）
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

## 上传

各平台上传对应 `dist/{平台}-colorqr.zip`，包内入口为 `index.html`。

| 平台 | 产物 | 差异 |
| --- | --- | --- |
| 抖音 | `dist/douyin-colorqr.zip` | 单 html 内联，支持横竖屏 |
| 快手 | `dist/kuaishou-colorqr.zip` | 单 html 内联，竖屏优先 |
| 小红书 | `dist/xiaohongshu-colorqr.zip` | 竖屏；多文件（html+css+js），见 `xiaohongshu/guidelines.md` |

平台规范见仓库根目录 `douyin/guidelines.md`、`kuaishou/guidelines.md` 等。
