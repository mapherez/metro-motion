import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configure a proxy for backend during dev.
const backend = process.env.BACKEND_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all local interfaces (IPv4/IPv6) and fail if 5174 is taken.
    host: '127.0.0.1',
    strictPort: true,
    port: 5174,
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
