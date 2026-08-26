import { createFileRoute } from "@tanstack/react-router";

// GET /api/admin/team — list of team members (email + role) for assignment
// dropdowns. Available to admins and editors (not view-only). Uses the
// service-role client so it works regardless of admin_emails RLS.
export const Route = createFileRoute("/api/admin/team")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireAdmin } = await import("../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("admin_emails").select("email, role").order("email");
        if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
        return Response.json({ ok: true, team: data ?? [] });
      },
    },
  },
});
