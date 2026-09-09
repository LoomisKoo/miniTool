# 快手 · 互动内容世界

## 官方文档

- [开发者接入指南](https://docs.qingque.cn/d/home/eZQBwhW-1V2gw17g5ASOnOsua?identityId=2UbPg3ikvzP)
- [作品包要求](https://docs.qingque.cn/d/home/eZQBwhW-1V2gw17g5ASOnOsua?identityId=2UbPg3ikvzP#section=h.6klcq9r4wxy3)（接入指南第三节）
- [创作指引](https://docs.qingque.cn/d/home/eZQDsDHOOo8Ndf2KR41mk_lnW?identityId=2UbPg3ikvzP)
- [创作者激励活动](https://docs.qingque.cn/d/home/eZQBndlLF7IDDG-81Fhgp6Ydt?identityId=2UbPg3ikvzP)

入口：快手开放平台 → 互动内容平台 → 互动内容世界控制台。当前为定向邀请/白名单。

上架状态镜像见根目录 [README 发布总表](../README.md#发布总表)（与小红书一致：风铃物语待提审，其余已上线工具见总表）。

## 开发约束（摘要）

与抖音互动空间高度相似，写上传/打包工具时可共用大部分校验。

### 包体

- 格式：`.zip`（推荐）或单个 `.html`
- 入口：zip 根目录必须有 `index.html`
- 体积：≤ **8MB**（含全部资源）
- 资源：全部本地相对路径；禁止外部 CDN / 远程脚本

### 禁止项

- 网络请求：`fetch` / `XHR` / `axios` / `WebSocket` / 动态插 script 拉远程
- 外部跳转：`<a>` 外链、`window.location` 等
- `<iframe>`（不论内外）
- 慎用 `onXXX` 内联事件，推荐 `addEventListener` + 内联 `<script>`

### 运行与适配

- 数据：推荐 `localStorage`；无跨设备同步
- 屏幕：创作指引写明**当前仅竖屏**（横屏即将支持）；接入指南「平台介绍」又写横竖均支持——以创作指引为准，作品先按竖屏做
- 自适应：禁止横向滚动条；FPS 建议 ≥ 30；WebKit 移动端
- 错误：友好兜底文案，勿空白页

### 发布流程（摘要）

1. 创建作品：标题建议 ≤10 字、封面必填、简介一句话
2. 上传 ZIP：系统自动检包结构 / 文件类型 / 外部请求
3. 真机自测：后台二维码，快手 App 扫码
4. 提交审核：通常 **2 个工作日**
5. 通过后自动上线 → 互动内容广场；可短视频挂载作品挂件

更新：详情页传新包再审；审期间线上版不受影响。改存档结构需兼容旧用户。

### 视频挂载

小程序「互动内容世界」→ 作品详情 → 分享「发快手」→ 拍摄/相册 → 确认关联小程序卡片后发布。

## 备注

- 接入指南「七、常见问题」目录有，正文抓取时未完整展开，需要时再补
- 报名时带可运行 demo 可优先入驻
