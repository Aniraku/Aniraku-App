import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router-dom')) return 'router'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('swiper')) return 'swiper'
          if (id.includes('styled-components')) return 'styling'
          if (/\/(react|react-dom)\//.test(id)) return 'react'
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
