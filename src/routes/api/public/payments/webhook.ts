import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "../../../../lib/stripe.server";

// Stripe calls this after a payment. Verified by signature (no admin auth).
// On a completed checkout we mark the matching invoice paid.
async function markInvoicePaid(session: any) {
  const invoiceId = session?.metadata?.invoice_id || session?.client_reference_id;
  if (!invoiceId) return;
  const { supabaseAdmin } = await import("../../../../integrations/supabase/client.server");
  const paidAmount = Number(session.amount_total || 0) / 100;
  await supabaseAdmin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      amount_paid: paidAmount || undefined,
      payment_method: "Card (online)",
    })
    .eq("id", invoiceId)
    .neq("status", "paid");
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              if (session?.payment_status !== "unpaid") await markInvoicePaid(session);
              break;
            }
            case "checkout.session.async_payment_succeeded":
              await markInvoicePaid(event.data.object);
              break;
            default:
              break;
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payments webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
