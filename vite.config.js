import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves this project from /FindVia-Provider/
  base: "/FindVia-Provider/",
  plugins: [react()],
  server: { host: "0.0.0.0" },
  build: { sourcemap: false }
});
