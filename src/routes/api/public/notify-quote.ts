import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BUSINESS_EMAIL = "matt@lankyservices.com.au";
const SENDER_DOMAIN = "notify.lankyservices.com.au";
const FROM = `Lanky Services Website <quotes@${SENDER_DOMAIN}>`;

const bodySchema = z.object({ id: z.string().uuid() });

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const Route = createFileRoute("/api/public/notify-quote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const parsed = bodySchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return new Response("Invalid payload", { status: 400 });

          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(
            process.env["SUPABASE_URL"]!,
            process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
            { auth: { persistSession: false } },
          );

          const { data: quote, error } = await supabase
            .from("quote_requests")
            .select("*")
            .eq("id", parsed.data.id)
            .maybeSingle();

          if (error) throw error;
          if (!quote) return new Response("Not found", { status: 404 });
          if (quote.notified_at) return Response.json({ sent: false, reason: "already_notified" });

          const rows: Array<[string, string]> = [
            ["Name", quote.name ?? ""],
            ["Phone", quote.phone ?? "—"],
            ["Email", quote.email ?? "—"],
            ["Suburb", quote.suburb ?? "—"],
            ["Service", quote.service ?? "—"],
            ["Details", quote.message ?? "—"],
            ["Page", quote.source_url ?? "—"],
          ];

          const text = [
            "New quote request from the website",
            "",
            ...rows.map(([k, v]) => `${k}: ${v}`),
            "",
            "Manage it at https://lankyservices.com.au/admin.html",
          ].join("\n");

          const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#12170f;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;margin:0 0 4px;">New quote request</h1>
    <p style="margin:0 0 20px;color:#5c6357;font-size:14px;">Submitted from lankyservices.com.au</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px;">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;color:#5c6357;width:110px;vertical-align:top;">${k}</td><td style="padding:8px 0;">${esc(v)}</td></tr>`,
        )
        .join("")}
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#5c6357;">
      <a href="https://lankyservices.com.au/admin.html" style="color:#5c6357;">Open the quotes dashboard</a>
    </p>
  </div>
</body></html>`;

          const { sendLovableEmail } = await import("@lovable.dev/email-js");
          await sendLovableEmail(
            {
              to: BUSINESS_EMAIL,
              from: FROM,
              sender_domain: SENDER_DOMAIN,
              subject: `New quote request — ${quote.name ?? "Website"}${quote.suburb ? ` (${quote.suburb})` : ""}`,
              html,
              text,
              reply_to: quote.email ?? undefined,
              idempotency_key: `quote-${quote.id}`,
            },
            { apiKey: process.env["LOVABLE_API_KEY"]! },
          );

          await supabase
            .from("quote_requests")
            .update({ notified_at: new Date().toISOString() })
            .eq("id", quote.id);

          return Response.json({ sent: true });
        } catch (e) {
          console.error("notify-quote failed", e);
          return new Response("Failed to send", { status: 500 });
        }
      },
    },
  },
});
