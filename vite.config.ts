import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Inline the hand-authored static homepage so it is bundled into the server
// build (Vite does not copy public/index.html, and ?raw of an .html file is
// transformed rather than kept verbatim).
const homeHtmlPlugin = () => ({
  name: "home-html",
  resolveId(id: string) {
    return id === "virtual:home-html" ? "\0virtual:home-html" : null;
  },
  load(id: string) {
    if (id !== "\0virtual:home-html") return null;
    const html = readFileSync(resolve(process.cwd(), "public/index.html"), "utf8");
    return `export default ${JSON.stringify(html)};`;
  },
});

export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [homeHtmlPlugin(), tanstackStart(), viteReact()],
});
