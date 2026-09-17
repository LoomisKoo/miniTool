# 内容平台规范

各内容平台的规范文档**仍放在仓库根目录**（未迁移，避免打断已有 Skill 与打包脚本的相对路径引用）。本页只做索引。

| 平台 | 目录 | 产品名 | 状态 |
| --- | --- | --- | --- |
| 小红书 | [`xiaohongshu/`](../../xiaohongshu/guidelines.md) | 小工具 | 已上线多个工具 |
| 抖音 | [`douyin/`](../../douyin/guidelines.md) | 互动空间 | 已整理规范摘要 |
| 快手 | [`kuaishou/`](../../kuaishou/guidelines.md) | 互动内容世界 | 已上线多个工具 |
| B站 | [`bilibili/`](../../bilibili/guidelines.md) | Toy | 搁置（需内测名额） |

## 打包

zip 打包规范与小工具容器约束见 Skill：[`.claude/minitool-zip-builder/SKILL.md`](../../.claude/minitool-zip-builder/SKILL.md)。

各工具统一：

```bash
cd <工具>
node build.mjs              # 全部平台
node build.mjs <平台>        # 仅单个平台
```

产物：`dist/{平台}-{工具}.zip`（`dist/` 已在 `.gitignore` 中忽略）。

## 小红书容器能力

- 官方：[小工具容器能力清单](https://miniapp-sandbox.xiaohongshu.com/minitool/doc)（可用 / 不可用能力、端能力 JS API、FAQ）
- 本地速查：[`xiaohongshu/guidelines.md` §端能力速查](../../xiaohongshu/guidelines.md)；字段级契约见 [`jsbridge-api.md`](../../xiaohongshu/minitool-zip-builder/references/jsbridge-api.md)
- 要点：持久化首选 **Storage JS API**（客户端 ≥ 9.46.0，单 key 1MB / 总量 10MB），`localStorage` 仅作低版本降级；导出图片走 `writeTempFile` + `saveImageToPhotosAlbum`（`a[download]` 已禁用）。

## 与 iOS 的边界

内容平台规范只约束 **H5 小工具**。iOS 原生 App 走 App Store 流程，见 [../ios/README.md](../ios/README.md)。
