# 文档索引

本目录放**跨工具的统一规范**。单个工具自己的说明放在该工具目录的 `README.md`。

| 文档 | 内容 |
| --- | --- |
| [platforms/](platforms/README.md) | H5 内容平台（小红书 / 抖音 / 快手 / B站）规范入口 |
| [ios/](ios/README.md) | iOS 原生 App 总规范（技术选型、命名、目录、权限、付费） |
| [ios/development.md](ios/development.md) | iOS 开发约定（新建工程、代码组织、资源、联调） |
| [ios/release.md](ios/release.md) | iOS 发布流程（签名、TestFlight、App Store、买断与订阅） |

## 三种「平台」的区别（容易混淆，先看这里）

| 目录 | 位置 | 含义 |
| --- | --- | --- |
| `docs/platforms/` + 根目录 `xiaohongshu/` `douyin/` `kuaishou/` `bilibili/` | 仓库根 | **内容平台规范**：容器限制、上传规则、打包要求 |
| `<工具>/platforms/` | 每个工具内 | **该工具的 H5 发布配置**：各平台差异与打包参数 |
| `<工具>/ios/` | 每个工具内 | **该工具的原生 iOS 实现**：独立 Xcode 工程 |

一句话规则：

> 根目录平台目录 = 规范；工具内 `platforms/` = H5 适配；工具内 `ios/` = 原生实现。

iOS 不放 `platforms/` 下，因为它是独立的技术实现，不是某个内容平台的配置差异。
