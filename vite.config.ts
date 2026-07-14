import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev port and no auto-open browser.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
  // produce a relative-path build so the Tauri webview can load it from disk
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});
