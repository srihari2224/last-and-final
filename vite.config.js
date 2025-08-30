import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './', 
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  publicDir: 'public',
})
