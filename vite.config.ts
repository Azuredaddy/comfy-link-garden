import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readdirSync, readFileSync } from "node:fs";
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

function listHtmlPages(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return listHtmlPages(resolve(dir, entry.name), path);
    return entry.name.endsWith(".html") ? [path.toLowerCase()] : [];
  });
}

// Catalogue of the static pages plus the branded 404 body, so the catch-all
// route can recover mistyped/extensionless URLs at request time.
const staticPagesPlugin = () => ({
  name: "static-pages",
  resolveId(id: string) {
    return id === "virtual:static-pages" ? "\0virtual:static-pages" : null;
  },
  load(id: string) {
    if (id !== "\0virtual:static-pages") return null;
    const publicDir = resolve(projectRoot, "public");
    const pages = listHtmlPages(publicDir).filter(
      (page) => !["/admin.html", "/admin-errors.html", "/reset-password.html", "/404.html"].includes(page),
    );
    const notFound = readFileSync(resolve(publicDir, "404.html"), "utf8");
    return [
      `export const staticPages = ${JSON.stringify(pages)};`,
      `export const notFoundHtml = ${JSON.stringify(notFound)};`,
    ].join("\n");
  },
});

export default defineConfig({
  plugins: [homeHtmlPlugin(), staticPagesPlugin()],
  // Wrap the server entry so SSR/API failures are logged with stack traces.
  tanstackStart: { server: { entry: "server" } },
  vite: {
    server: { host: "::", port: 8080 },
  },
});
