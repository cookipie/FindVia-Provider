import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths work on GitHub Pages and inside the Android WebView.
  base: "./",
  plugins: [react()],
  server: { host: "0.0.0.0" },
  build: { sourcemap: false }
});