import { createFileRoute } from "@tanstack/react-router";
// Built from the static pages in public/ so unmatched URLs can be recovered
// (e.g. /contact -> /contact.html) instead of dead-ending.
import { notFoundHtml, staticPages } from "virtual:static-pages";

const pageSet = new Set(staticPages);

function resolveHtmlPath(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, "").toLowerCase();
  if (!clean) return null;
  if (pageSet.has(clean + ".html")) return clean + ".html";
  if (pageSet.has(clean + "/index.html")) return clean + "/index.html";

  // Bare suburb or page slug typed without its folder, e.g. /toukley
  const slug = clean.slice(clean.lastIndexOf("/") + 1);
  if (!slug) return null;
  const match = staticPages.find(
    (page) => page.endsWith(`/${slug}.html`) && !page.startsWith("/blog/"),
  );
  return match ?? null;
}

export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { pathname } = new URL(request.url);
        const target = resolveHtmlPath(pathname);
        if (target && target !== pathname) {
          return new Response(null, { status: 301, headers: { location: target } });
        }
        return new Response(notFoundHtml, {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
