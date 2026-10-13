import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { qrcode } from "vite-plugin-qrcode";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "BACKEND_");
  const backend = env.BACKEND_PROXY_TARGET || "http://localhost:8080";

  return {
    plugins: [react(), tailwindcss(), qrcode()] as PluginOption[],
    server: {
      host: true,
      strictPort: true,
      port: 5174,
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          headers: { "X-Dev-Proxy": "vite" },
        },
      },
    },
  };
});
