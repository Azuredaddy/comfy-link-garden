import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/notify-quote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        void request;
        return Response.json(
          { ok: false, message: "This endpoint has been replaced." },
          { status: 410 },
        );
      },
    },
  },
});
