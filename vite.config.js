import { defineConfig } from "vite";
import { globSync } from "glob";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));
const input = Object.fromEntries(
  globSync("**/*.html", { cwd: root, ignore: ["dist/**", "node_modules/**"] }).map((f) => [
    f.replace(/\.html$/, "").replace(/\//g, "_"),
    resolve(root, f),
  ])
);

export default defineConfig({
  server: { host: "::", port: 8080 },
  build: { outDir: "dist", rollupOptions: { input } },
});
