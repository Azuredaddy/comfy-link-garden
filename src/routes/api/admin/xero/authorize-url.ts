import { createFileRoute } from "@tanstack/react-router";

// POST /api/admin/xero/authorize-url — returns the Xero consent URL to navigate to.
export const Route = createFileRoute("/api/admin/xero/authorize-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;
        try {
          const { buildAuthUrl } = await import("../../../../lib/xero.server");
          return Response.json({ ok: true, url: await buildAuthUrl() });
        } catch (error) {
          return Response.json({ ok: false, message: error instanceof Error ? error.message : "Xero error" }, { status: 400 });
        }
      },
    },
  },
});
