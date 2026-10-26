import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: false,
  // .bin / .gltf 默认不算静态资源：`import ... ?url` 拿到的不是可直接 fetch 的
  // 文件地址，GLTFLoader 去取 buffer 和贴图时会失败（控制台那一串
  // "Fetch API cannot load ... due to access control checks"）。
  assetsInclude: ['**/*.bin', '**/*.gltf'],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        city: resolve(process.cwd(), 'city.html'),
      },
    },
  },
})
