import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API runs on 8787; same-origin /api keeps the session cookie simple.
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: false } },
  },
});
