import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(8000),
  test_to: z.string().trim().email().optional(),
});

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// POST /api/admin/broadcast — send a marketing email to opted-in subscribers.
// { subject, message, test_to? }  — test_to sends only to that address.
export const Route = createFileRoute("/api/admin/broadcast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Check the subject and message." }, { status: 400 });
        }
        const { subject, message, test_to } = parsed.data;

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const { sendEmail } = await import("../../../lib/email.server");
        const base = (process.env["PUBLIC_SITE_URL"] || new URL(request.url).origin).replace(/\/+$/, "");

        let recipients: Array<{ email: string; name: string | null; unsubscribe_token: string }> = [];
        if (test_to) {
          recipients = [{ email: test_to, name: "Test", unsubscribe_token: "test" }];
        } else {
          const { data } = await supabaseAdmin
            .from("marketing_subscribers")
            .select("email,name,unsubscribe_token")
            .is("unsubscribed_at", null)
            .limit(2000);
          recipients = (data ?? []) as never;
        }
        if (!recipients.length) return Response.json({ ok: true, sent: 0, failed: 0, message: "No subscribers to send to yet." });

        const bodyHtml = esc(message).replace(/\n/g, "<br>");
        let sent = 0, failed = 0;
        for (const r of recipients) {
          const unsub = `${base}/unsubscribe?token=${encodeURIComponent(r.unsubscribe_token)}`;
          const html = `<!doctype html><html><body style="margin:0;background:#f4f6f2;font-family:Arial,Helvetica,sans-serif;color:#12170f">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#0a0d0b;border-radius:14px 14px 0 0;padding:18px 24px"><span style="color:#a3e635;font-weight:800;font-size:18px">Lanky Services</span></div>
<div style="background:#fff;border-radius:0 0 14px 14px;padding:24px;font-size:15px;line-height:1.55">${bodyHtml}
<p style="margin:28px 0 0;font-size:12px;color:#8a9182;border-top:1px solid #eee;padding-top:14px">You're receiving this because you opted in for offers from Lanky Services. <a href="${unsub}" style="color:#5aad17">Unsubscribe</a>.</p>
</div></div></body></html>`;
          const text = `${message}\n\nUnsubscribe: ${unsub}`;
          const res = await sendEmail({ to: r.email, subject, html, text, reply_to: "matt@lankyservices.com.au" });
          if (res.ok) sent++; else failed++;
        }
        return Response.json({ ok: true, sent, failed });
      },
    },
  },
});
