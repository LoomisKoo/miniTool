# 小工具 JSBridge API 规范

容器会注入 **`window.xhs.miniTool.*`**，业务代码通过它调用 Native 能力。字段以本文档为准，表中未声明的字段不要传。

## 调用约定

| 项 | 规则 |
| --- | --- |
| 入口 | `window.xhs.miniTool.<apiName>(options)` |
| 两种用法 | 不传回调 → 返回 `Promise`；传 `success` / `fail` / `complete` 任一 → 返回 `undefined`，经回调拿结果 |
| 成功 | Promise resolve / `success(result)`；关注业务字段（见各 API「结果」），无业务字段则结果为空 |
| 失败 | Promise reject / `fail(error)`；失败原因看 `error.errMsg`（形如 `<apiName>:fail …`），可能带 `errCode` |
| `complete` | 成功或失败都会回调，参数为对应的 result / error |
| 禁止 | 不要调用本文未列出的 API，不要传字段表未声明的字段 |

## API 索引

| API | 说明 |
| --- | --- |
| [`postNote`](#postnote) | 发布笔记 |
| [`saveImageToPhotosAlbum`](#saveimagetophotosalbum) | 保存图片到系统相册 |
| [`openRedPage`](#openredpage) | 通用原生页面跳转 |
| [`writeTempFile`](#writetempfile) | base64 转临时文件 |
| [`getLaunchOptions`](#getlaunchoptions) | 获取客户端启动参数（版本判断） |
| [Storage（本地缓存）](#storage--小工具本地缓存) | `setStorage` / `getStorage` / `getStorageInfo` / `removeStorage` / `clearStorage` |

## postNote

发布笔记。

- **调用**：`window.xhs.miniTool.postNote(options)`

### 使用规则

- `mediaInfo` 必填；`image_resources`（图文）、`video_resources`（视频）、`live_photo_resources`（实况）至少传一种，可同时传。
- 所有地址（`url` / `video_url` / `cover_url`）承载 base64 data:uri 或网络地址，格式由 Native 侧校验。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `title` | string | 否 | 标题，最长 20 |
| `content` | string | 否 | 正文，最长 1000 |
| `pageType` | `"video_publish" \| "photo_publish" \| "slides_edit"` | 否 | 页面类型 |
| `mediaInfo` | object | 是 | 见「mediaInfo」 |
| `tags` | string | 否 | 标签 |

**`mediaInfo`**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `image_resources` | `{ url }[]` | 否 | 图文，1–18 张；`url` 图片地址 |
| `video_resources` | `{ video_url, cover_url? }` | 否 | 视频；`video_url` 视频地址，`cover_url` 可选封面 |
| `live_photo_resources` | `{ url, video_url }[]` | 否 | 实况，1–18 张；`url` 动图封面，`video_url` 动图视频 |

### 结果

成功结果仅含通用 `errMsg`，无额外业务字段。

### 示例

图文笔记：

```js
await window.xhs.miniTool.postNote({
  title: "标题",
  content: "正文",
  pageType: "photo_publish",
  mediaInfo: {
    image_resources: [{ url: "data:image/png;base64,..." }],
  },
});
```

视频笔记：

```js
await window.xhs.miniTool.postNote({
  pageType: "video_publish",
  mediaInfo: {
    video_resources: { video_url: "...", cover_url: "..." },
  },
});
```

## saveImageToPhotosAlbum

保存图片到系统相册。

- **调用**：`window.xhs.miniTool.saveImageToPhotosAlbum(options)`

### 使用规则

- `filePath` 只接受 base64 data:uri 或本地路径，传网络地址（`http(s)://`）会失败。
- 已有 base64 时可先调 `writeTempFile` 换取本地 `filePath`，再传入本 API。
- 需由用户主动操作触发；首次调用可能弹系统相册权限。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `filePath` | string | 是 | 本地图片路径（base64 data:uri 或本地引用），不支持网络地址 |

### 结果

成功结果仅含通用 `errMsg`，无额外业务字段。

### 示例

```js
await window.xhs.miniTool.saveImageToPhotosAlbum({
  filePath: "data:image/png;base64,...",
});
```

## openRedPage

通用原生页面跳转。

- **调用**：`window.xhs.miniTool.openRedPage(options)`

### 使用规则

- `type` 命中 Native 规则表白名单才放行，未命中直接失败；规则表由客户端维护。
- `params` 为语义参数，由规则表映射到目标页面；信任字段由客户端强制注入。
- 跳转会离开当前小工具页面，调用前应完成本地状态持久化。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `type` | string | 是 | 规则表 key（如 search / note / user…） |
| `params` | object | 否 | 语义参数（如 `{ keyword }`） |

### 结果

成功结果仅含通用 `errMsg`，无额外业务字段。

### 示例

```js
await window.xhs.miniTool.openRedPage({
  type: "search",
  params: { keyword: "连衣裙" },
});
```

## writeTempFile

base64 转临时文件，返回可传给其他 API 的 `filePath`。

- **调用**：`window.xhs.miniTool.writeTempFile(options)`

### 使用规则

- 用于把内存中的 base64（Canvas 导出、选图预览等）落成本地文件，换取 `filePath`。
- **`data` 必须是完整 data:uri**，即 `data:<mime>;base64,<payload>` 开头（如 `data:image/png;base64,iVBORw0KGgo...`）；只传裸 base64 字符串会失败。
- `canvas.toDataURL()` / `FileReader.readAsDataURL()` 的返回值已是 data:uri，**不要**再截取 `,` 之后的部分。
- 返回的 `filePath` 为临时文件，即用即弃。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `data` | string | 是 | 完整 data:uri（`data:<mime>;base64,<payload>`），不接受裸 base64 |

### 结果

成功结果在通用 `errMsg` 之外附带：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `filePath` | string | 转换得到的临时文件路径 |

### 示例

```js
// canvas.toDataURL() 直接就是 data:uri，原样传入
const { filePath } = await window.xhs.miniTool.writeTempFile({
  data: canvas.toDataURL("image/png"), // "data:image/png;base64,iVBORw0KGgo..."
});
await window.xhs.miniTool.saveImageToPhotosAlbum({ filePath });
```

错误用法：

```js
// ✗ 裸 base64，会失败
await window.xhs.miniTool.writeTempFile({ data: "iVBORw0KGgo..." });
// ✗ 手动去掉了 data:uri 前缀
await window.xhs.miniTool.writeTempFile({
  data: canvas.toDataURL("image/png").split(",")[1],
});
```

## getLaunchOptions

异步获取客户端启动参数。主要用途是**判断客户端版本**，决定 Storage JS API（见下节）是否可用。

- **调用**：`window.xhs.miniTool.getLaunchOptions(options)`

### 使用规则

- 优先**同步**读 `window.xhs.launchOptions.miniToolEnv.buildVersion`；同步值不存在时，确认 `getLaunchOptions` 是函数后再异步获取。
- 两种方式都取不到版本号时，按**不支持 Storage JS API** 处理（走降级）。
- `buildVersion` 末 3 位是编译 / 打包序号，比较版本时**必须忽略**：`9462004` → 客户端 `9.46.2`（编译号 `004`）。
- `window.xhs`、`launchOptions`、`miniToolEnv`、`buildVersion` 都可能缺失，必须逐级判空。

### 结果

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `miniToolEnv.buildVersion` | number | 形如 `9462004`，客户端版本 `9.46.2` |

### 示例

```js
function readBuildVersion(launchOptions) {
  const miniToolEnv = launchOptions && launchOptions.miniToolEnv;
  return Number(miniToolEnv && miniToolEnv.buildVersion) || 0;
}

async function getBuildVersion() {
  const xhs = window.xhs;
  const syncBuildVersion = readBuildVersion(xhs && xhs.launchOptions);
  if (syncBuildVersion) return syncBuildVersion;

  const miniTool = xhs && xhs.miniTool;
  if (!miniTool || typeof miniTool.getLaunchOptions !== "function") return 0;

  try {
    return readBuildVersion(await miniTool.getLaunchOptions());
  } catch (error) {
    return 0;
  }
}

// 9462004 → 9462，即客户端 9.46.2
function getClientVersion(buildVersion) {
  return Math.floor(buildVersion / 1000);
}

function isClientVersionAtLeast(buildVersion, minClientVersion) {
  return getClientVersion(buildVersion) >= minClientVersion;
}
```

## Storage — 小工具本地缓存

**持久化的首选方案**，替代 `localStorage` / `sessionStorage` / `IndexedDB` / Cookie / Cache API。

- **调用**：`window.xhs.miniTool.setStorage / getStorage / getStorageInfo / removeStorage / clearStorage`
- **版本要求**：客户端 **9.46.0** 及以上（即 `buildVersion ≥ 9460000`），低于该版本降级到浏览器存储。

### 使用规则

- 浏览器自带存储（`localStorage` 等）**只是低版本降级方案**：容器不保证其始终可用，也不保证数据持续有效；读写都要 `try/catch`，并能容忍数据缺失、失效或被清理。
- 数据仅属于当前小工具，其他小工具与外部无法访问；**不要假设数据永久持久化**。
- 单 key 最大 **1MB**，当前小工具全部缓存最大 **10MB**。
- `data` 必须可 JSON 序列化；`encrypt` 默认 `false`，**读取时必须与写入时保持一致**。
- 客户端从低版本升级到支持 Storage 的版本时，**迁移与一致性由开发者自己负责**（可读一次旧 `localStorage` 再写入 Storage）。
- 调用方必须处理「写入失败」的情况，不能假设数据已经落盘。
- 同时支持 Promise 与 `success` / `fail` / `complete` 回调。

### 参数与结果

| API | 参数 | 结果 / 说明 |
| --- | --- | --- |
| `setStorage` | `key: string`、`data: any`、`encrypt?: boolean` | 写入或覆盖缓存；`data` 须可 JSON 序列化 |
| `getStorage` | `key: string`、`encrypt?: boolean` | 返回 `{ data }`；`encrypt` 须与写入时一致 |
| `getStorageInfo` | 无业务参数 | 返回 `{ keys, currentSize, limitSize }`，容量单位为 KB |
| `removeStorage` | `key: string` | 删除指定缓存 |
| `clearStorage` | 无业务参数 | 清空当前小工具的全部缓存 |

### 示例（版本判断 + 降级）

```js
const STORAGE_MIN_CLIENT_VERSION = 9460; // 客户端 9.46.0

// 统一写入：优先 Storage JS API，低版本降级 localStorage；永不抛错，失败返回 false
async function saveData(key, data) {
  const buildVersion = await getBuildVersion(); // 见 getLaunchOptions
  const miniTool = window.xhs && window.xhs.miniTool;

  if (
    isClientVersionAtLeast(buildVersion, STORAGE_MIN_CLIENT_VERSION) &&
    miniTool &&
    typeof miniTool.setStorage === "function"
  ) {
    try {
      await miniTool.setStorage({ key, data });
      return true;
    } catch (error) {
      return false;
    }
  }

  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

// 统一读取：拿不到就返回 null，让业务按「无数据」处理
async function loadData(key) {
  const buildVersion = await getBuildVersion();
  const miniTool = window.xhs && window.xhs.miniTool;

  if (
    isClientVersionAtLeast(buildVersion, STORAGE_MIN_CLIENT_VERSION) &&
    miniTool &&
    typeof miniTool.getStorage === "function"
  ) {
    try {
      const { data } = await miniTool.getStorage({ key });
      return data === undefined ? null : data;
    } catch (error) {
      return null;
    }
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

await saveData("favorites", { items: [1, 2, 3] });
const favorites = await loadData("favorites");

// 容量自查（KB）
const { keys, currentSize, limitSize } = await window.xhs.miniTool.getStorageInfo();
```

**key 命名**：与 `localStorage` 一致，带业务前缀（如 `wc_sound_muted` / `bead_favs`），避免与其他数据混淆。
