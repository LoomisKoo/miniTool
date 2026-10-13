# 影厅模拟器（QMuse / React 适配版）

原项目在上级目录 `../`（小红书等平台离线包用 `node build.mjs`）。

## 上传

流程、账号门禁、UPDATE 绑定见仓库根目录 **[docs/qmuse.md](../../docs/qmuse.md)**。

要点：

1. **legacy 资源 URL**：须用 `publicPath` / `__basement_public_path__`，见 `src/App.tsx` 的 `assetBase()`。
2. **宿主按钮样式**：`src/hostStyles.ts` + `src/index.css` 末尾 `html.cinema-seat-qmuse` 段。

```bash
cd cinema-seat/qmuse && npm run build
../../.qmuse-tools/node_modules/.bin/qmuse import . --title "影厅模拟器" --space-id "<spaceId>" --no-open --json
```
