import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rubbish Removal Central Coast NSW | Lanky Services" },
      {
        name: "description",
        content:
          "Fast, friendly and fully insured rubbish removal across the Central Coast, NSW. Free upfront quotes and same-day pickups.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Rubbish Removal Central Coast NSW | Lanky Services" },
      {
        property: "og:description",
        content: "Free upfront quotes and same-day rubbish removal across the Central Coast, NSW.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeRedirect,
});

// The marketing site is served as static HTML from /index.html.
function HomeRedirect() {
  useEffect(() => {
    window.location.replace("/index.html");
  }, []);
  return null;
}
