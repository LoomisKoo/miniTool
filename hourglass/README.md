# 烧香计时

离线 Canvas 烧香计时小工具。源码共用，各平台独立打包上传。

## 目录

```
hourglass/
├── src/                 # 共用源码
│   ├── app.js           # 逻辑
│   ├── style.css        # 样式
│   ├── body.html        # DOM 结构
│   └── config.base.json # 默认配置
├── platforms/           # 平台差异
│   ├── douyin/config.json
│   ├── kuaishou/config.json + extra.css
│   └── xiaohongshu/config.json
├── build.mjs            # 打包脚本
└── dist/                # 产物（git 可忽略）
    ├── douyin/index.html + douyin-hourglass.zip
    ├── kuaishou/...
    └── xiaohongshu/...
```

## 开发

改 `src/` 下文件，然后打包：

```bash
node build.mjs              # 全部平台
node build.mjs douyin       # 仅抖音
```

本地预览（以抖音包为例）：

```bash
node build.mjs douyin
python3 -m http.server 9876 --directory dist/douyin
```

## 上传

各平台上传对应的 `dist/{平台}-hourglass.zip`，包内根目录为 `index.html`。

| 平台 | 产物 | 差异 |
| --- | --- | --- |
| 抖音 | `dist/douyin-hourglass.zip` | 支持横竖屏 |
| 快手 | `dist/kuaishou-hourglass.zip` | 竖屏优先 + 横屏紧凑样式 |
| 小红书 | `dist/xiaohongshu-hourglass.zip` | 竖屏（平台暂搁置） |

平台规范见仓库根目录 `douyin/guidelines.md`、`kuaishou/guidelines.md` 等。

## 平台配置

`platforms/*/config.json` 字段：

- `storagePrefix` — localStorage 前缀，避免多平台调试互相覆盖
- `portraitOnly` — 是否竖屏优先（影响 `html` class 与额外 CSS）
- `title` — 页面标题

共用逻辑读取 `window.PLATFORM`（构建时注入）。
