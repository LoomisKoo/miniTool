# iOS 发布流程

## 前置准备

一次性配置：

1. **开发者账号**：Apple Developer Program（个人或公司，¥688/年）
2. **App Store Connect**：在 [App Store Connect](https://appstoreconnect.apple.com) 新建 App，Bundle ID 需先在 Certificates, Identifiers & Profiles 注册
3. **签名**：Xcode → Settings → Accounts 登录账号；工程 `Signing & Capabilities` 勾选 `Automatically manage signing`
4. **隐私清单**：工程内必须有 `PrivacyInfo.xcprivacy`，声明数据收集与 Required Reason API

## 信息准备

| 项 | 说明 |
| --- | --- |
| App 名称 | 30 字符内，与 H5 端口径一致 |
| 副标题 | 30 字符内 |
| 关键词 | 100 字符内，逗号分隔 |
| 分类 | 工具类选「工具」；游戏选「休闲」 |
| 图标 | 1024×1024，无圆角、无透明 |
| 截图 | 6.9 寸与 6.5 寸 iPhone 各一套（至少 3 张） |
| 隐私政策 URL | 必须可公开访问 |
| 年龄分级 | 工具类通常 4+ |

截图建议直接展示工具的核心结果（如拼豆图纸成品），不要放纯文字说明图。

## 版本号

- `CFBundleShortVersionString`：对外版本，如 `1.0.0`，发布后递增
- `CFBundleVersion`：构建号，每次上传必须递增
- H5 与 iOS 版本号**各自独立**，不要强行同步

## 流程

```text
开发 → 真机测试 → Archive → 上传 TestFlight → 内测 → 提交审核 → 发布
```

1. **Archive**：Xcode 选 `Any iOS Device` → `Product > Archive`
2. **上传**：Organizer → `Distribute App` → `App Store Connect` → `Upload`
3. **TestFlight**：构建处理完成后添加内测员；重点验证相册保存、导出、内购
4. **提交审核**：填写审核信息，附上复现步骤说明（工具类 App 建议写清如何产生结果）
5. **发布**：可选手动发布，便于避开审核通过后的意外时机

审核常见退回原因：

- 权限文案与实际用途不符
- 功能过于简单（建议把核心能力做完整，或合并进工具箱类 App）
- 内购不可恢复 / 未提供隐私政策
- 截图与真实界面不一致

## 买断（非消耗型内购）

1. App Store Connect → 功能 → App 内购买项目 → 新建「非消耗型」
2. 商品 ID：`<bundleid>.pro`，例如 `com.loomiskoo.rabbitbead.pro`
3. 代码用 **StoreKit 2**：

```swift
let products = try await Product.products(for: ["com.loomiskoo.rabbitbead.pro"])
let result = try await product.purchase()
await AppStore.sync()   // 恢复购买
```

4. 解锁状态由 `Transaction.currentEntitlements` 判断，**不要只存本地布尔值**
5. 必须提供「恢复购买」入口
6. 审核时在 App 审核信息里填写内购测试说明

## 订阅

1. 新建订阅组，商品 ID：`<bundleid>.sub.yearly` / `.sub.monthly`
2. 提供免费试用时写明试用时长与续费价格
3. 必须提供：隐私政策、服务条款、自动续费说明、取消方式
4. 用 `Transaction.updates` 监听状态变化，处理退款与过期
5. 服务端需要校验时用 App Store Server API + 通知（`App Store Server Notifications V2`）

## 发版后

同步更新文档：

1. `<工具>/README.md`：iOS 状态与版本号
2. 根 `README.md` 发布总表：iOS 一列
3. 若价格与 [iOS 规范](../ios/README.md#付费) 的档位表不符，先改规范表再发版
