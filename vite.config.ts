import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./" keeps the built site working from any path, such as a GitHub Pages project page.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
