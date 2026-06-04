// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /firestore\.googleapis\.com/],
      },
      manifest: {
        name: 'Experience Poker Room',
        short_name: 'ExpPoker',
        description: 'Dashboard para la gestión de mesas y torneos de poker',
        theme_color: '#050508',
        background_color: '#050508',
        display: 'standalone',
        icons: [
          {
            src: '/branding/favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/branding/favicon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-dom/client'],
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/functions',
          ],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react', 'lucide'],
        },
      },
    },
  },
  server: { fs: { strict: true } },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "/src/styles/_legacy" as *;\n`,
      },
    },
  },
})