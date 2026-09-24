import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // VITE_BASE: test verzija se gradi u /pd-merenje-Shopify/test/ (vidi deploy.yml)
  base: process.env.VITE_BASE || '/pd-merenje-Shopify/',
  plugins: [react()],
  build: {
    outDir: 'dist'
  }
})
