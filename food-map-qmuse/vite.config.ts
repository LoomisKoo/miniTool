import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相对路径，便于部署在任意子路径（含 QMuse 沙箱）
export default defineConfig({
  base: './',
  plugins: [react()],
});
