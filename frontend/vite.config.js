import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('qrcode')) return 'qrcode'
          if (id.includes('lenis') || id.includes('react-fast-marquee')) return 'ui-vendor'
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
          return undefined
        },
      },
    },
  },
})
