import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    include: /src\/.*\.[jt]sx?$/,
    loader: 'jsx',
  },
  server: {
    allowedHosts: ["skuria-sksuite.local", "cginvestors-sksuite.local"], // autorise ton API
    host: true, // si tu veux que Vite écoute sur toutes les interfaces
    port: 5173, // ton port dev
    proxy: {
      // Redirection des appels API vers le backend Laravel
      "/api": {
        target: "http://skuria-sksuite.local",
        changeOrigin: true,
        secure: false,
      },
      // Redirection de l'endpoint CSRF de Sanctum
      "/sanctum": {
        target: "http://skuria-sksuite.local",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
