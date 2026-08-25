import { createFileRoute } from "@tanstack/react-router";

// GET /pay?invoice=<uuid> — public. Starts a Stripe Checkout for the invoice
// and redirects the customer to Stripe's hosted payment page. The invoice id
// is an unguessable uuid; only the amount + number are exposed (on Stripe).
function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Lanky Services</title>
<style>body{margin:0;background:#0a0e0a;color:#f1f5ec;font:16px/1.6 system-ui,Segoe UI,Arial,sans-serif;
display:grid;place-items:center;min-height:100vh}.c{max-width:440px;padding:32px;text-align:center}
h1{font-size:22px;margin:0 0 8px}.m{color:#93a288}a{color:#a3e635}</style></head>
<body><div class="c"><h1>${title}</h1><p class="m">${body}</p></div></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export const Route = createFileRoute("/pay")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const invoiceId = url.searchParams.get("invoice");
        if (url.searchParams.get("cancelled")) return page("Payment cancelled", "No worries — you can use the link again any time to pay.");
        if (!invoiceId) return page("Invoice not found", "This payment link is missing its invoice reference.", 400);

        const { isConfigured, siteUrl, createCheckoutSession } = await import("../lib/stripe.server");
        if (!isConfigured()) return page("Payments not set up", "Online payment isn't switched on yet. Please pay by bank transfer, or contact us.", 503);

        const { supabaseAdmin } = await import("../integrations/supabase/client.server");
        const { data: inv } = await supabaseAdmin
          .from("invoices")
          .select("id, number, total, amount_paid, status, customer_email")
          .eq("id", invoiceId)
          .maybeSingle();
        if (!inv) return page("Invoice not found", "We couldn't find that invoice. Please check the link or contact us.", 404);
        if (inv.status === "paid") return page("Already paid", `Invoice ${inv.number ?? ""} has been paid in full. Thank you!`);
        if (inv.status === "void") return page("Invoice cancelled", "This invoice has been cancelled.", 410);

        const owing = Number(inv.total || 0) - Number(inv.amount_paid || 0);
        const cents = Math.round(owing * 100);
        if (cents <= 0) return page("Nothing owing", `Invoice ${inv.number ?? ""} has nothing left to pay. Thank you!`);

        const base = siteUrl(url.origin);
        try {
          const sessionUrl = await createCheckoutSession({
            invoiceId: inv.id,
            number: inv.number ?? "",
            amountCents: cents,
            customerEmail: inv.customer_email,
            successUrl: `${base}/payment-thanks.html`,
            cancelUrl: `${base}/pay?invoice=${inv.id}&cancelled=1`,
          });
          return new Response(null, { status: 303, headers: { location: sessionUrl } });
        } catch (error) {
          const { logServerError, requestMeta } = await import("../lib/error-log.server");
          await logServerError({ source: "pay:checkout", error, status: 502, context: { invoiceId }, ...requestMeta(request) });
          return page("Payment couldn't start", "Something went wrong starting the payment. Please try again shortly or contact us.", 502);
        }
      },
    },
  },
});
