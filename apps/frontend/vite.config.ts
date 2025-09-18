import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { qrcode } from 'vite-plugin-qrcode'

const backend = process.env.VITE_API_BASE || "http://localhost:8080";

export default defineConfig({
  plugins: [react(), tailwindcss(), qrcode()],
  server: {
    host: true,
    strictPort: true,
    port: 5174,
    proxy: {
      "/api": {
        target: backend,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\//, "/"),
        headers: { "X-Dev-Proxy": "vite" },
      },
    },
  },
});
