import { createFileRoute } from "@tanstack/react-router";

// POST /api/admin/xero/disconnect — forget the stored Xero tokens.
export const Route = createFileRoute("/api/admin/xero/disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;
        const { disconnect } = await import("../../../../lib/xero.server");
        await disconnect();
        return Response.json({ ok: true });
      },
    },
  },
});
