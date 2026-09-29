# 仙鹿起名（QMuse / React 适配版）

由 `../src/` 的纯 HTML H5 适配而来的 React + Vite 工程，用于导入 QMuse。原版目录 `../` 保持不变，可作为对比基准。

## 结构

```
index.html              # Vite 入口（#root）
src/main.tsx            # createRoot（不使用 StrictMode）
src/App.tsx             # 注入 body 结构并按序加载 legacy 脚本
src/body.ts             # 从 body.html 提取的 DOM（npm run sync 生成）
src/legacy-scripts.ts   # 脚本路径列表（sync 生成）
src/index.css           # 原 style.css + qmuse-overrides.css
public/legacy/          # 原 src 下业务 JS（sync 从 ../src 复制）
```

## 命令

```bash
npm install
npm run sync    # 从 ../src 同步 DOM / 脚本 / 样式
npm run dev
npm run build
```

修改 `../src/` 后请先 `npm run sync` 再构建或上传。

## 上传 QMuse

见仓库根目录 [docs/qmuse.md](../../../docs/qmuse.md)。导入目录为本文件夹 `deerName-qmuse/`，应用名称使用「仙鹿起名」。
