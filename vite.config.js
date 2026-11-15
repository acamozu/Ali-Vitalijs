import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { host: true },
  build: {
    // exceljs (~940 kB) is the one big file. It is loaded only when someone exports or imports an Excel file
    // (dynamic import in CarpoolApp), so it does not slow the page down; the limit is set just above it.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), carpool: resolve(__dirname, "carpool.html") },
    },
  },
});
