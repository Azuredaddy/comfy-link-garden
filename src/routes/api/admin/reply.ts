import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const replySchema = z.object({
  quote_request_id: z.string().uuid(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

// POST /api/admin/reply — reply to a lead from the portal (a real email,
// logged against the lead). Admin-only.
export const Route = createFileRoute("/api/admin/reply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const parsed = replySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the reply." },
            { status: 400 },
          );
        }
        const { quote_request_id, subject, message } = parsed.data;

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const { logServerError, requestMeta } = await import("../../../lib/error-log.server");
        const { brandedEmail, sendEmail } = await import("../../../lib/email.server");
        const { loadSettings } = await import("../../../lib/document-send.server");
        const meta = requestMeta(request);

        const { data: lead } = await supabaseAdmin
          .from("quote_requests")
          .select("id, name, email")
          .eq("id", quote_request_id)
          .maybeSingle();
        if (!lead) return Response.json({ ok: false, message: "Lead not found." }, { status: 404 });
        if (!lead.email) return Response.json({ ok: false, message: "This lead has no email address to reply to." }, { status: 400 });

        const settings = await loadSettings();
        const { html, text } = brandedEmail({
          businessName: settings.business_name,
          heading: subject,
          intro: `Hi ${lead.name},`,
          bodyParagraphs: message.split(/\n{2,}/),
          contact: { phone: settings.phone, email: settings.email },
        });

        const emailRes = await sendEmail({
          to: lead.email,
          subject,
          html,
          text,
          reply_to: settings.email ?? undefined,
        });

        await supabaseAdmin.from("messages").insert({
          quote_request_id,
          direction: "outbound",
          to_email: lead.email,
          subject,
          body: message,
          email_status: emailRes.ok ? "sent" : "failed",
          error: emailRes.ok ? null : emailRes.error ?? null,
        });

        if (!emailRes.ok) {
          await logServerError({ source: "api:reply:email", error: emailRes.error, status: 502, context: { quote_request_id }, ...meta });
          return Response.json({ ok: false, message: `Couldn't send: ${emailRes.error || "email service error"}` }, { status: 502 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
