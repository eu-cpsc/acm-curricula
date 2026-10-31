import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the built site works from any path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  // The bundled CS2023 body of knowledge is ~1 MB of JSON.
  build: { chunkSizeWarningLimit: 1500 },
})
