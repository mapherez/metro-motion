import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configure a proxy for backend during dev.
const backend = process.env.BACKEND_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Example usage: fetch('/api/now') -> proxied to backend
      '/api': {
        target: backend,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\//, '/'),
        headers: { 'X-Dev-Proxy': 'vite' }
      }
    }
  }
});

