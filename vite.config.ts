import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: '/tab-proy-mexinol/',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },  // mantiene la misma carpeta que CRA
});
