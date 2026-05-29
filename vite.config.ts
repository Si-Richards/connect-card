import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// Pure SPA build. The Express API in `selfhost/` is the only server;
// nginx serves dist/ as static files. See INSTALL.md.
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: { outDir: "dist" },
  server: { host: "::", port: 8080, strictPort: true },
});
