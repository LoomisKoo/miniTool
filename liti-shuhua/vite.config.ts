import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** 本地预览用：npm run dev */
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true },
})
