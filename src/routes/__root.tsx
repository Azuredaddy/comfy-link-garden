import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Rubbish Removal Central Coast NSW | Lanky Services" },
      {
        name: "description",
        content:
          "Fast, friendly rubbish removal across the Central Coast & Newcastle NSW. Household junk, hard rubbish, green waste & furniture removed. Free quotes, 7 days.",
      },
      { property: "og:title", content: "Rubbish Removal Central Coast NSW | Lanky Services" },
      {
        property: "og:description",
        content:
          "Fast, friendly rubbish removal across the Central Coast & Newcastle NSW. Household junk, hard rubbish, green waste & furniture removed. Free quotes, 7 days.",
      },
    ],
    links: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
  }),
  component: () => (
    <html lang="en-AU">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
});
