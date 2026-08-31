import { createFileRoute } from "@tanstack/react-router";

// GET /quote-accept?id=<uuid>          → confirmation page with an Accept button
// GET /quote-accept?id=<uuid>&confirm=1 → records acceptance + notifies the team
// Two-step so email link-prefetchers can't accidentally accept a quote.
function page(title: string, bodyHtml: string, status = 200) {
  const html = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Lanky Services</title>
<style>body{margin:0;background:#0a0e0a;color:#f1f5ec;font:16px/1.6 system-ui,Segoe UI,Arial,sans-serif;
display:grid;place-items:center;min-height:100vh}.c{max-width:460px;padding:32px;text-align:center}
h1{font-size:22px;margin:0 0 8px}.m{color:#93a288;margin:0 0 18px}
.btn{display:inline-block;background:#a3e635;color:#0f1509;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:12px}
.tick{width:60px;height:60px;border-radius:50%;background:#a3e635;color:#0f1509;display:grid;place-items:center;margin:0 auto 18px;font-size:30px;font-weight:800}</style>
</head><body><div class="c">${bodyHtml}</div></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export const Route = createFileRoute("/quote-accept")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const confirm = url.searchParams.get("confirm") === "1";
        if (!id) return page("Quote not found", '<h1>Quote not found</h1><p class="m">This link is missing its quote reference.</p>', 400);

        const { supabaseAdmin } = await import("../integrations/supabase/client.server");
        const { data: q } = await supabaseAdmin
          .from("quotes")
          .select("id, number, customer_name, customer_email, customer_phone, suburb, total, status")
          .eq("id", id)
          .maybeSingle();
        if (!q) return page("Quote not found", '<h1>Quote not found</h1><p class="m">We couldn\'t find that quote. Please contact us.</p>', 404);

        const money = "$" + Number(q.total || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (q.status === "accepted") {
          return page("Already accepted", `<div class="tick">✓</div><h1>You've already accepted this quote</h1><p class="m">Quote ${q.number ?? ""} — ${money}. We'll be in touch to lock in a time. Thanks!</p>`);
        }
        if (q.status === "declined" || q.status === "expired") {
          return page("Quote unavailable", `<h1>This quote is no longer active</h1><p class="m">Please contact us for a fresh quote.</p><a class="btn" href="tel:0439973051">Call 0439 973 051</a>`, 410);
        }

        // Step 1: show the confirm page.
        if (!confirm) {
          return page("Accept your quote", `
            <h1>Accept your quote?</h1>
            <p class="m">Quote ${q.number ?? ""} — <strong style="color:#f1f5ec">${money}</strong>.<br>Tap below and we'll be in touch to book you in.</p>
            <a class="btn" href="${url.origin}/quote-accept?id=${q.id}&confirm=1">Yes, accept this quote</a>`);
        }

        // Step 2: record acceptance + notify the team.
        await supabaseAdmin.from("quotes").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", id);
        await supabaseAdmin.from("messages").insert({
          quote_id: id,
          direction: "inbound",
          subject: "Quote accepted by customer",
          body: `${q.customer_name} accepted quote ${q.number ?? ""} (${money})${q.suburb ? " — " + q.suburb : ""}. Book them in.`,
          email_status: "sent",
        } as never);

        try {
          const { loadSettings } = await import("../lib/document-send.server");
          const { brandedEmail, sendEmail } = await import("../lib/email.server");
          const settings = await loadSettings();
          const { html, text } = brandedEmail({
            businessName: settings.business_name,
            heading: "A quote was just accepted 🎉",
            intro: `${q.customer_name} accepted quote ${q.number ?? ""} (${money}). Book them in.`,
            rows: [
              ["Customer", q.customer_name],
              ["Phone", q.customer_phone ?? "—"],
              ["Email", q.customer_email ?? "—"],
              ["Suburb", q.suburb ?? "—"],
              ["Amount", money],
            ],
            contact: { phone: settings.phone, email: settings.email },
          });
          await sendEmail({ to: settings.email || "matt@lankyservices.com.au", subject: `Quote accepted — ${q.customer_name}`, html, text });
        } catch { /* notification is best-effort */ }

        return page("Thanks!", `<div class="tick">✓</div><h1>Thanks, ${q.customer_name.split(" ")[0]}!</h1><p class="m">Your quote is accepted. We'll be in touch shortly to lock in a time. Any questions, call <a style="color:#a3e635" href="tel:0439973051">0439 973 051</a>.</p>`);
      },
    },
  },
});
