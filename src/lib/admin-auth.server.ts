// Verifies that an admin server route is being called by a signed-in admin.
// The browser sends the Supabase access token as `Authorization: Bearer <jwt>`.
// We validate it with the service-role client and confirm the email is on the
// approved admin list (public.admin_emails) — the same source of truth as the
// public.is_admin() RLS helper.
import { supabaseAdmin } from "../integrations/supabase/client.server";

export type AdminUser = { id: string; email: string; role: string };

type AdminResult =
  | { ok: true; user: AdminUser }
  | { ok: false; response: Response };

function deny(status: number, message: string): AdminResult {
  return { ok: false, response: Response.json({ ok: false, message }, { status }) };
}

export async function requireAdmin(request: Request): Promise<AdminResult> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = header && /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : null;
  if (!token) return deny(401, "Sign in to continue.");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return deny(401, "Your session has expired — please sign in again.");

  const { data: admins, error: adminError } = await supabaseAdmin
    .from("admin_emails")
    .select("email, role");
  if (adminError) return deny(503, "Could not verify admin access. Please try again.");

  const row = (admins ?? []).find((r) => r.email.toLowerCase() === email);
  if (!row) return deny(403, "This account is not on the approved admin list.");
  const role = row.role;
  // Every /api/admin/* route performs an action; view-only users are blocked.
  if (role === "viewer") return deny(403, "Your account is view-only.");

  const userId = data.user?.id;
  if (!userId) return deny(401, "Your session has expired — please sign in again.");

  return { ok: true, user: { id: userId, email, role } };
}
