/**
 * 小红书小工具构建：单入口、经典脚本（iife）、面向 Chrome 61 / ES2017。
 * 容器禁止 type="module" 与 import，所以这里输出 IIFE + 单独的 css，
 * 再由 build-xhs.mjs 用 index.html 模板拼出合规入口。
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: false,
  // lib/iife 不会像普通页面构建那样自动注入 NODE_ENV；
  // React 产物里残留 process.env.NODE_ENV → 容器里直接 ReferenceError → 黑屏
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-xhs',
    emptyOutDir: true,
    target: ['es2017', 'chrome61'],
    cssTarget: 'chrome61',
    assetsInlineLimit: 0,
    lib: {
      entry: resolve(process.cwd(), 'src/main.tsx'),
      formats: ['iife'],
      name: 'LitiShuhua',
      fileName: () => 'app.js',
    },
    rollupOptions: {
      output: {
        // 所有资源都放到包根：容器路径解析最简单
        assetFileNames: (info) => (/\.css$/.test(info.name ?? '') ? 'app.css' : '[name].[ext]'),
      },
    },
  },
})
