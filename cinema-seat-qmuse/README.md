# 影厅模拟器（QMuse 适配版）

原项目在同级目录 `../cinema-seat/`（小红书等平台离线包用 `node build.mjs`）。

本目录为 React + Vite 壳，注入 `public/legacy/app.js` 与 Three.js。

## QMuse 上传与排障

流程、账号门禁、UPDATE 绑定见仓库根目录 **[docs/qmuse.md](../docs/qmuse.md)**。

与本项目强相关、上线前务必核对：

1. **`legacy` 脚本基址**：`src/App.tsx` 必须用 `window.publicPath` / `__basement_public_path__` 解析 `legacy/*.js`。正式环境页面在 `render.*`，静态在 `renderstatic.*`；只用 `document.baseURI` 会导致 `app.js` 404，首页座位与近视/散光控件不渲染。
2. **宿主按钮样式**：`src/hostStyles.ts` + `src/index.css` 末尾 `html.cinema-seat-qmuse` 段，覆盖妙思注入的白底；`vision-option.on` 等选中态不能一律 `transparent`。
3. **重传**：在**本目录**（含 `.qmuse/project.json`）执行 `qmuse import .`，不要从 `.qmuse-staging` 导入。

```bash
cd cinema-seat-qmuse && npm run build
../.qmuse-tools/node_modules/.bin/qmuse import . --title "影厅模拟器" --space-id "<spaceId>" --no-open --json
```

绑定 appId 见 `.qmuse/project.json` 的 `targets.prod.appId`。
