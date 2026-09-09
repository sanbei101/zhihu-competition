import tailwindcss from "@tailwindcss/vite";
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
      react: {
        compiler: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": ".",
    },
  },
});
