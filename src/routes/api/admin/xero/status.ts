import { createFileRoute } from "@tanstack/react-router";

// GET /api/admin/xero/status — { configured, connected, tenant_name }.
// Never returns tokens.
export const Route = createFileRoute("/api/admin/xero/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireAdmin } = await import("../../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const { isConfigured, getConnection } = await import("../../../../lib/xero.server");
        const conn = await getConnection().catch(() => null);
        return Response.json({
          ok: true,
          configured: isConfigured(),
          connected: !!(conn && conn.refresh_token),
          tenant_name: conn?.tenant_name ?? null,
          connected_at: conn?.connected_at ?? null,
        });
      },
    },
  },
});
