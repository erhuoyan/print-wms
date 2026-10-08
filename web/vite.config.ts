import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 开发时把 API / 上传图片转发给本地 FastAPI（默认 8000），
  // 这样前端和会话 cookie 同源，登录态在 dev 下也正常。
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/uploads': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
  build: {
    // 产物直接落到后端托管目录，省掉手工拷贝
    outDir: '../app/static/web',
    emptyOutDir: true,
  },
})
