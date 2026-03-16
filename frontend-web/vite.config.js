import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar variables de entorno
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://127.0.0.1:4500',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    envPrefix: 'VITE_',
    envDir: '.',
    // Variables de entorno por defecto
    define: {
      global: 'globalThis',
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:4500/api'),
      'import.meta.env.VITE_WS_URL': JSON.stringify(env.VITE_WS_URL || 'http://localhost:4500'),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(env.VITE_APP_NAME || 'Gestor de Inventario J4 Pro'),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION || '1.0.0'),
      'import.meta.env.VITE_DEBUG': JSON.stringify(env.VITE_DEBUG || 'true'),
    },
  }
})



