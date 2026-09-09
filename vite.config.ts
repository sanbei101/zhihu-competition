import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rolldownOptions: {
      external: ["@ast-grep/napi"],
    },
  },
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  plugins: [
    tailwindcss(),
    vinext({
      cache: { cdn: cdnAdapter() },
      react: {
        compiler: true,
      },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": ".",
    },
  },
});
