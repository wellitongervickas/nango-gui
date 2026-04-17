import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// Electron loads the renderer via file://.  Chromium enforces CORS for any
// resource that carries the `crossorigin` attribute, but file:// responses
// carry no HTTP headers and therefore fail the CORS check silently — the JS
// bundle never executes and React never mounts.  Strip the attribute so every
// asset is fetched in "no-cors" mode, which file:// supports fine.
function removeAttrCrossoriginPlugin(): Plugin {
  return {
    name: "remove-crossorigin",
    transformIndexHtml: {
      order: "post",
      handler(html: string): string {
        return html.replace(/ crossorigin/g, "");
      },
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), removeAttrCrossoriginPlugin()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
