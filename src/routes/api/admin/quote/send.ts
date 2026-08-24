import { createFileRoute } from "@tanstack/react-router";

// POST /api/admin/quote/send  { id }
// Admin-only: renders the quote PDF, hosts it, emails the customer a link,
// and records the send.
export const Route = createFileRoute("/api/admin/quote/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const body = (await request.json().catch(() => null)) as { id?: string } | null;
        if (!body || typeof body.id !== "string") {
          return Response.json({ ok: false, message: "Missing quote id." }, { status: 400 });
        }
        const { sendDocument } = await import("../../../../lib/document-send.server");
        return sendDocument("quote", body.id, request);
      },
    },
  },
});
