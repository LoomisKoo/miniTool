import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** 本地预览用：npm run dev */
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true },
  // 和 vite.xhs.config.ts 保持一致：FX=off npm run dev 可预览无特效版
  define: {
    FX_OFF: JSON.stringify(/^(off|0|false)$/i.test(process.env.FX ?? '')),
  },
})
