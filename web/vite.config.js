import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 构建配置
 * ------------------------------------------------------------
 * 功能：开发期把 /api 代理到 3001，生产构建做三方库拆包。
 * 业务：Element Plus 体积大，单独拆 chunk 后业务代码更新不会让用户重新下载整个 UI 库，
 *      首屏缓存命中率更高；chunk 警告阈值同步调高，避免无意义的告警干扰排查。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 5173,
    // 端口被占用时直接失败，而不是静默换端口让用户找不到地址
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true }
    }
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true }
    }
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          element: ['element-plus', '@element-plus/icons-vue']
        }
      }
    }
  }
})
