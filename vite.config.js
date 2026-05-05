import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/pd-merenje-Shopify/',
  plugins: [react()],
  build: {
    outDir: 'dist'
  }
})
