import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    // Importante para Electron en dev: si Vite cambia de puerto por estar ocupado,
    // Electron seguirá intentando cargar el puerto configurado y verás ventana en blanco.
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        // Backend local por defecto (cuando se prueba en navegador).
        // En Electron se usa el backend embebido y NO depende de este proxy.
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['framer-motion', 'lucide-react'],
        },
      },
    },
  },
  define: {
    global: 'globalThis',
  },
})



