import { createFileRoute } from "@tanstack/react-router";
// The marketing homepage stays as hand-authored static HTML (SEO critical),
// served verbatim at "/" so nothing about the page or its markup changes.
import homeHtml from "virtual:home-html";

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async () =>
        new Response(homeHtml, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    },
  },
});
