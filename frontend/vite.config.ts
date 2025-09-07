import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@photos': path.resolve(__dirname, '../photos')
    }
  },
  build: {
    outDir: '../backend/src/BiteTrack.Api/wwwroot',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5087',
        changeOrigin: true,
      }
    }
  }
});
