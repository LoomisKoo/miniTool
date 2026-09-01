# 抖音 · 互动空间

## 官方文档

书：`mntz08vs`（互动空间创作文档）  
直链形态：`https://vcreate.douyin.com/pet/wiki/mntz08vs/{docId}`  
（外层 `tutorial?book=...&doc=...` 为壳，正文在 iframe）

| 文档 | docId |
| --- | --- |
| 欢迎! 互动空间的创作者们！ | [awm729ne](https://vcreate.douyin.com/pet/wiki/mntz08vs/awm729ne) |
| 创作指引 | [pllf8b93](https://vcreate.douyin.com/pet/wiki/mntz08vs/pllf8b93) |
| AI调用创作指引 | [eeuugitq](https://vcreate.douyin.com/pet/wiki/mntz08vs/eeuugitq) |
| 准入标准 | [cwxluo23](https://vcreate.douyin.com/pet/wiki/mntz08vs/cwxluo23) |
| 审核规范 | [7h5j4ync](https://vcreate.douyin.com/pet/wiki/mntz08vs/7h5j4ync) |
| 常见问题 | [lsr8gnpt](https://vcreate.douyin.com/pet/wiki/mntz08vs/lsr8gnpt) |
| 其他附录信息（含 AI API） | [o1yopbss](https://vcreate.douyin.com/pet/wiki/mntz08vs/o1yopbss) |

平台： [抖音虚拟创作平台](https://vcreate.douyin.com/)

## 开发约束（摘要）

### 包体

- 格式：`.zip`（推荐）或单个 `.html`
- 入口：必须 `index.html`（可在子目录，但包内须有该入口）
- 体积：≤ **8MB**
- 资源：全部本地相对路径；禁止外部 CDN

### 禁止项

- 网络请求：`fetch` / `XHR` / `axios` / `WebSocket` 等
- 外部跳转：`<a>`、`window.location` 等
- `<iframe>`
- 慎用 `onXXX`，推荐 `addEventListener`

### 运行与适配

- 数据：推荐 `localStorage`
- 屏幕：**竖屏 / 横屏均可**（需显式说明，默认竖屏）
- 自适应、FPS ≥ 30、WebKit、错误兜底（同快手）

### 发布流程（摘要）

1. 创作中心创建作品并上传 zip
2. 「扫码测试」：抖音 App **3.8.20+**；未发布仅自测不可分享；重传包需杀进程再扫
3. 「发布」提审：约 **1 个工作日**；审核中可撤回
4. 通过后站内信通知

另有官方「互动空间上传」skill / MCP（`interative_content_mcp`）可打包上传。

### AI 调用（可选）

作品内 AI 目前走火山 API Key；细则见「AI调用创作指引」「其他附录信息」（`tt.callAIChatCompletion` 等）。启用需作品开 AI 开关，客户端版本等见官方附录。

## 备注

顶栏还有合养精灵 / 虚拟世界等其他书，当前只整理「互动空间」。
