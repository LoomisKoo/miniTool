# 美食地图（QMuse / React 适配版）

由 `../food-map/` 的纯 HTML 单页 H5 适配而来的 React + Vite 工程，用于导入 QMuse。

## 结构

```
index.html           # Vite 入口（#root 挂载点 + #toast）
src/main.tsx         # createRoot 渲染（不使用 StrictMode）
src/App.tsx          # 注入原始 #app 结构并按序加载 legacy 脚本
src/body.ts          # 原 index.html 中 #app 的内部 HTML（原样提取）
src/index.css        # 原 style.css（仅新增 #root 高度规则）
public/legacy/       # 原 land.js / prov-land.js / data.js / app.js（原样复制）
public/assets/       # 原 assets/icon.jpg
```

## 运行

```bash
npm install
npm run dev      # 本地预览
npm run build    # 产物在 dist/
```

## 适配说明

- 原项目的 4 个 `<script src>` 通过 `window.LAND_DATA` / `window.PROV_LAND_*` / `window.DATA` 全局通信，故保留为外部脚本并按原顺序串行注入（`async = false`），运行语义与原来一致。
- `app.js` 本身已是 IIFE，不产生额外全局词法声明。
- 使用 `window.__foodmap_loaded` 守卫，确保脚本只注入一次（规避重复绑定与重复绘制）。
- 脚本 URL 通过 `new URL(rel, document.baseURI)` 解析，配合 `base: './'` 可在任意子路径部署。
- `index.css` 相对原 `style.css` 仅新增一条 `#root { height: 100%; }`。

## 与原始版本的关系

原始纯 HTML 版本仍在 `../food-map/`，未做任何改动，可作为视觉/功能对比基准。
