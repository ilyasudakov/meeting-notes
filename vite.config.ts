import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'popup.html'
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    },
    open: '/popup.html'
  }
}); 