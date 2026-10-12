import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = process.env.WL_API ?? 'http://127.0.0.1:8040';

export default defineConfig({
  base: '/waifu_loader/',
  plugins: [react()],
  server: {
    port: 5180,
    host: '127.0.0.1',
    proxy: {
      '/waifu_loader/api': API,
      '/waifu_loader/portraits': API,
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
  },
});
