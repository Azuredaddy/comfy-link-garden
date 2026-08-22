import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

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
    const html = readFileSync(resolve(projectRoot, "public/index.html"), "utf8");
    return `export default ${JSON.stringify(html)};`;
  },
});

export default defineConfig({
  plugins: [homeHtmlPlugin()],
  // Wrap the server entry so SSR/API failures are logged with stack traces.
  tanstackStart: { server: { entry: "server" } },
  vite: {
    server: { host: "::", port: 8080 },
  },
});
