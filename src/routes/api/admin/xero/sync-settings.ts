import { createFileRoute } from "@tanstack/react-router";

// POST /api/admin/xero/sync-settings — pull org details (name, ABN, phone,
// address, bank account) from Xero into business_settings.
export const Route = createFileRoute("/api/admin/xero/sync-settings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        try {
          const { fetchOrgDetails } = await import("../../../../lib/xero.server");
          const { supabaseAdmin } = await import("../../../../integrations/supabase/client.server");
          const details = await fetchOrgDetails();
          // only write fields Xero actually returned
          const patch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(details)) if (v !== undefined && v !== null && v !== "") patch[k] = v;
          if (Object.keys(patch).length) await supabaseAdmin.from("business_settings").update(patch as never).eq("id", 1);
          return Response.json({ ok: true, details });
        } catch (error) {
          return Response.json({ ok: false, message: error instanceof Error ? error.message : "Xero error" }, { status: 400 });
        }
      },
    },
  },
});
