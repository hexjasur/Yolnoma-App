import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Path aliases for clean imports
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Optimize bundle: split vendor chunks for better caching
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        test: path.resolve(__dirname, "test.html"),
      },
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          router: ["react-router-dom"],
          icons: ["lucide-react"],
        },
      },
    },
    // Minify for production
    minify: "esbuild",
    target: "es2020",
  },

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
