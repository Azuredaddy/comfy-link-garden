import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [tanstackStart(), viteReact()],
});
