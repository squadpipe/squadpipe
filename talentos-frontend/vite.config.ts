import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 80,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:5000',
        changeOrigin: true,
      },
    },
  },
});

