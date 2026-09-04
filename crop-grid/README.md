# 轻映

图片裁切与多宫格分图。纯离线 Web 小工具，各平台分发。

## 上架素材

- 名称：轻映
- 简介：图片裁切与多宫格分图
- 图标：`icon.png`

| 平台 | 产物 |
| --- | --- |
| 小红书 | `dist/xiaohongshu-qingying.zip` |
| 抖音 | `dist/douyin-qingying.zip` |
| 快手 | `dist/kuaishou-qingying.zip` |

状态：小红书审核中。

## 打包

```bash
node build.mjs                  # 全部平台
node build.mjs kuaishou         # 仅快手

# 小红书审计
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```
