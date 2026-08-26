import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Manage portal users (admin role only). Uses the service-role client so it
// isn't affected by admin_emails RLS. GET lists; POST adds/updates/removes,
// sends an invite email, or sets a password directly.
const ROLES = ["admin", "editor", "viewer"] as const;
const bodySchema = z.object({
  action: z.enum(["add", "update", "remove", "invite", "set-password"]),
  email: z.string().trim().email().max(255),
  role: z.enum(ROLES).optional(),
  password: z.string().min(8).max(72).optional(),
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
        const { data, error } = await supabaseAdmin.from("admin_emails").select("email, role, created_at").order("email");
        if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });

        // Which of these emails already have a sign-in account?
        const accounts = new Map<string, { last_sign_in_at: string | null }>();
        try {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          for (const u of list?.users ?? []) {
            if (u.email) accounts.set(u.email.toLowerCase(), { last_sign_in_at: u.last_sign_in_at ?? null });
          }
        } catch { /* listing accounts is best-effort */ }

        const users = (data ?? []).map((r) => {
          const acct = accounts.get(r.email.toLowerCase());
          return { email: r.email, role: r.role, created_at: r.created_at, has_account: !!acct, last_sign_in_at: acct?.last_sign_in_at ?? null };
        });
        return Response.json({ ok: true, users });
      },

      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;
        if (admin.user.role !== "admin") return Response.json({ ok: false, message: "Only admins can manage users." }, { status: 403 });

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, message: "Check the email, role and password (8+ characters)." }, { status: 400 });
        const email = parsed.data.email.toLowerCase();
        const role = parsed.data.role ?? "viewer";
        const action = parsed.data.action;
        const isSelf = email === admin.user.email.toLowerCase();

        if (isSelf && (action === "remove" || action === "add")) {
          return Response.json({ ok: false, message: "You can't change your own access here." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const origin = new URL(request.url).origin;

        if (action === "remove") {
          const { error } = await supabaseAdmin.from("admin_emails").delete().eq("email", email);
          if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
          return Response.json({ ok: true, message: "Access removed." });
        }

        if (action === "invite" || action === "set-password") {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const existing = (list?.users ?? []).find((u) => u.email?.toLowerCase() === email);

          if (action === "set-password") {
            const password = parsed.data.password;
            if (!password) return Response.json({ ok: false, message: "Enter a password of at least 8 characters." }, { status: 400 });
            if (existing) {
              const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
              if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
              return Response.json({ ok: true, message: "Password updated." });
            }
            const { error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
            if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
            return Response.json({ ok: true, message: "Account created with that password." });
          }

          // invite / reset email
          if (existing) {
            const { error } = await supabaseAdmin.auth.admin.generateLink({
              type: "recovery",
              email,
              options: { redirectTo: `${origin}/reset-password.html` },
            });
            if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
            return Response.json({ ok: true, message: "Password reset email sent." });
          }
          const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/reset-password.html` });
          if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
          return Response.json({ ok: true, message: "Invite email sent." });
        }

        // add or update
        const { error } = await supabaseAdmin
          .from("admin_emails")
          .upsert({ email, role } as never, { onConflict: "email" });
        if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
        return Response.json({ ok: true, message: action === "add" ? "User added." : "Access updated." });
      },
    },
  },
});
