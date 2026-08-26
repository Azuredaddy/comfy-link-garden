import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Manage portal users (admin role only). Uses the service-role client so it
// isn't affected by admin_emails RLS. GET lists; POST adds/updates/removes.
const ROLES = ["admin", "editor", "viewer"] as const;
const bodySchema = z.object({
  action: z.enum(["add", "update", "remove"]),
  email: z.string().trim().email().max(255),
  role: z.enum(ROLES).optional(),
});

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireAdmin } = await import("../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;
        if (admin.user.role !== "admin") return Response.json({ ok: false, message: "Only admins can manage users." }, { status: 403 });

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("admin_emails").select("email, role").order("email");
        if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
        return Response.json({ ok: true, users: data ?? [] });
      },

      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;
        if (admin.user.role !== "admin") return Response.json({ ok: false, message: "Only admins can manage users." }, { status: 403 });

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, message: "Check the email and role." }, { status: 400 });
        const email = parsed.data.email.toLowerCase();
        const role = parsed.data.role ?? "viewer";

        if (email === admin.user.email.toLowerCase() && parsed.data.action !== "update") {
          return Response.json({ ok: false, message: "You can't change your own access here." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        if (parsed.data.action === "remove") {
          const { error } = await supabaseAdmin.from("admin_emails").delete().eq("email", email);
          if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
          return Response.json({ ok: true });
        }
        // add or update
        const { error } = await supabaseAdmin
          .from("admin_emails")
          .upsert({ email, role } as never, { onConflict: "email" });
        if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
