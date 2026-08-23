import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const quoteSchema = z
  .object({
    submission_key: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    suburb: z.string().trim().max(100).nullable().optional(),
    service: z.string().trim().max(100).nullable().optional(),
    message: z.string().trim().max(2000).nullable().optional(),
    source_url: z.string().trim().url().max(500).nullable().optional(),
    website: z.string().max(0).optional(),
  })
  .refine((value) => Boolean(value.phone || value.email), {
    message: "A phone number or email address is required",
  });

const BUSINESS_EMAIL = "matt@lankyservices.com.au";
const SENDER_DOMAIN = "notify.lankyservices.com.au";
const FROM = `Lanky Services Website <quotes@${SENDER_DOMAIN}>`;

function allowedBrowserRequest(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site")) return false;

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "lankyservices.com.au" ||
      hostname === "www.lankyservices.com.au" ||
      hostname === "comfy-link-garden.lovable.app" ||
      hostname.endsWith(".lovable.app")
    );
  } catch {
    return false;
  }
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function optional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const Route = createFileRoute("/api/public/quote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { logServerError, requestMeta } = await import("../../../lib/error-log.server");
        const meta = requestMeta(request);
        if (!allowedBrowserRequest(request)) {
          return Response.json({ ok: false, message: "Request not allowed" }, { status: 403 });
        }

        const parsed = quoteSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your details" },
            { status: 400 },
          );
        }

        const input = parsed.data;
        if (input.website) return Response.json({ ok: true, saved: true, notified: true });

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const payload = {
          submission_key: input.submission_key,
          name: input.name,
          phone: optional(input.phone),
          email: optional(input.email),
          suburb: optional(input.suburb),
          service: optional(input.service),
          message: optional(input.message),
          source_url: optional(input.source_url),
        };

        const { data: existing, error: existingError } = await supabaseAdmin
          .from("quote_requests")
          .select("*")
          .eq("submission_key", input.submission_key)
          .maybeSingle();
        if (existingError) {
          await logServerError({ source: "api:quote:lookup", error: existingError, status: 503, ...meta });
          return Response.json({ ok: false, message: "We couldn't save your request. Please try again." }, { status: 503 });
        }

        let quote = existing;
        if (!quote) {
          const { data, error } = await supabaseAdmin
            .from("quote_requests")
            .insert(payload)
            .select("*")
            .single();
          if (error || !data) {
            await logServerError({ source: "api:quote:insert", error, status: 503, ...meta });
            return Response.json({ ok: false, message: "We couldn't save your request. Please try again." }, { status: 503 });
          }
          quote = data;
        }

        if (quote.notified_at) {
          return Response.json({ ok: true, saved: true, notified: true });
        }

        const attemptedAt = new Date().toISOString();
        const attempts = quote.notification_attempts + 1;
        await supabaseAdmin
          .from("quote_requests")
          .update({ notification_attempted_at: attemptedAt, notification_attempts: attempts })
          .eq("id", quote.id);

        const rows: Array<[string, string]> = [
          ["Name", quote.name],
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
          ...rows.map(([label, value]) => `${label}: ${value}`),
          "",
          "Manage it at https://lankyservices.com.au/admin.html",
        ].join("\n");
        const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#12170f"><div style="max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:20px;margin:0 0 4px">New quote request</h1><p style="margin:0 0 20px;color:#5c6357;font-size:14px">Submitted from lankyservices.com.au</p><table style="width:100%;border-collapse:collapse;font-size:15px">${rows.map(([label, value]) => `<tr><td style="padding:8px 0;color:#5c6357;width:110px;vertical-align:top">${esc(label)}</td><td style="padding:8px 0">${esc(value)}</td></tr>`).join("")}</table><p style="margin:24px 0 0;font-size:13px"><a href="https://lankyservices.com.au/admin.html" style="color:#5c6357">Open the quotes dashboard</a></p></div></body></html>`;

        try {
          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) throw new Error("LOVABLE_API_KEY is unavailable");
          const { sendLovableEmail } = await import("@lovable.dev/email-js");
          await sendLovableEmail(
            {
              to: BUSINESS_EMAIL,
              from: FROM,
              sender_domain: SENDER_DOMAIN,
              subject: `New quote request — ${quote.name}${quote.suburb ? ` (${quote.suburb})` : ""}`,
              html,
              text,
              reply_to: quote.email ?? undefined,
              purpose: "transactional",
              idempotency_key: `quote-${quote.id}`,
            },
            { apiKey },
          );
          const { error: notifiedUpdateError } = await supabaseAdmin
            .from("quote_requests")
            .update({ notified_at: new Date().toISOString(), notification_error: null })
            .eq("id", quote.id);
          if (notifiedUpdateError) {
            await logServerError({ source: "api:quote:notified-update", error: notifiedUpdateError, status: 202, context: { quote_id: quote.id }, ...meta });
            return Response.json({ ok: true, saved: true, notified: true }, { status: 202 });
          }
          return Response.json({ ok: true, saved: true, notified: true });
        } catch (error) {
          const detail = error instanceof Error ? error.message.slice(0, 500) : "Unknown email error";
          await logServerError({ source: "api:quote:email", error, status: 202, context: { quote_id: quote.id }, ...meta });
          await supabaseAdmin
            .from("quote_requests")
            .update({ notification_error: detail })
            .eq("id", quote.id);
          return Response.json({ ok: true, saved: true, notified: false }, { status: 202 });
        }
      },
    },
  },
});