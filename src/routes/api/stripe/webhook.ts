import { createFileRoute } from "@tanstack/react-router";

// POST /api/stripe/webhook — Stripe calls this after a payment. Verified by
// signature (no admin auth). On checkout.session.completed we mark the invoice
// paid. Point your Stripe webhook endpoint here and listen for that event.
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return Response.json({ ok: false, message: "Webhook not configured" }, { status: 500 });

        const payload = await request.text();
        const { verifySignature } = await import("../../../lib/stripe.server");
        if (!verifySignature(payload, request.headers.get("stripe-signature"), secret)) {
          return Response.json({ ok: false, message: "Invalid signature" }, { status: 400 });
        }

        let event: any;
        try { event = JSON.parse(payload); } catch { return Response.json({ ok: false }, { status: 400 }); }

        if (event.type === "checkout.session.completed") {
          const s = event.data?.object ?? {};
          const invoiceId = s.metadata?.invoice_id || s.client_reference_id;
          if (invoiceId && s.payment_status === "paid") {
            const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
            const paidAmount = Number(s.amount_total || 0) / 100;
            await supabaseAdmin
              .from("invoices")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                amount_paid: paidAmount || undefined,
                payment_method: "Card (Stripe)",
              })
              .eq("id", invoiceId)
              .neq("status", "paid");
          }
        }
        return Response.json({ received: true });
      },
    },
  },
});
