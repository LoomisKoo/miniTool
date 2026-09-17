# 纸灯夜航

夜空飞灯休闲小游戏：轻点升起，穿过花灯门洞，收集星火；局末可导出灯火贺卡。

简介：**休闲小游戏，杀时间必备**

仓库根目录有跨项目 [发布总表](../README.md#发布总表)；此处只记本工具。

## 状态

| 平台 | 状态 | 版本 | 产物 |
| --- | --- | --- | --- |
| 小红书 | ✅ 已上线 | 1.0.2 | `dist/xiaohongshu-paper-lantern.zip` |
| 快手 | ✅ 已上线 | 1.0.2 | `dist/kuaishou-paper-lantern.zip` |

## 打包

```bash
cd paper-lantern && node build.mjs
# 小红书审计
node ../xiaohongshu/minitool-zip-builder/scripts/audit_artifact.mjs dist/xiaohongshu
```
