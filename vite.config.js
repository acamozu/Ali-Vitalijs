import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { host: true },
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), inkwell: resolve(__dirname, "inkwell.html") },
    },
  },
});
