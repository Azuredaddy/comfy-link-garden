// Public server functions backing the customer "pay my invoice" page.
// The invoice id is an unguessable uuid; only the number and amount owing are
// exposed, never customer details.
import { createServerFn } from "@tanstack/react-start";

type StripeEnv = "sandbox" | "live";

const UUID = /^[0-9a-fA-F-]{36}$/;

export type InvoiceSummary =
  | { ok: true; number: string; amountOwing: number; status: string }
  | { ok: false; message: string; status?: string };

/** Read-only summary of an invoice for the payment page. */
export const getInvoiceForPayment = createServerFn({ method: "GET" })
  .inputValidator((data: { invoiceId: string }) => {
    if (!UUID.test(data.invoiceId)) throw new Error("Invalid invoice reference");
    return data;
  })
  .handler(async ({ data }): Promise<InvoiceSummary> => {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("number, total, amount_paid, status")
      .eq("id", data.invoiceId)
      .maybeSingle();

    if (!inv) return { ok: false, message: "We couldn't find that invoice. Please check the link or contact us." };
    if (inv.status === "paid") return { ok: false, message: "This invoice has been paid in full. Thank you!", status: "paid" };
    if (inv.status === "void") return { ok: false, message: "This invoice has been cancelled.", status: "void" };

    const owing = Number(inv.total || 0) - Number(inv.amount_paid || 0);
    if (owing <= 0) return { ok: false, message: "There's nothing left to pay on this invoice. Thank you!", status: "paid" };

    return { ok: true, number: inv.number ?? "", amountOwing: owing, status: inv.status };
  });

export type CheckoutResult = { clientSecret: string } | { error: string };

/** Create an embedded Stripe Checkout session for the amount owing. */
export const createInvoiceCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { invoiceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!UUID.test(data.invoiceId)) throw new Error("Invalid invoice reference");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const { createStripeClient, getStripeErrorMessage } = await import("./stripe.server");
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");

    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("id, number, total, amount_paid, status, customer_email")
      .eq("id", data.invoiceId)
      .maybeSingle();

    if (!inv) return { error: "We couldn't find that invoice." };
    if (inv.status === "paid" || inv.status === "void") return { error: "This invoice can no longer be paid online." };

    const cents = Math.round((Number(inv.total || 0) - Number(inv.amount_paid || 0)) * 100);
    if (cents <= 0) return { error: "There's nothing left to pay on this invoice." };

    try {
      const stripe = createStripeClient(data.environment);
      const description = `Invoice ${inv.number ?? ""}`.trim() || "Invoice payment";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: { name: description },
              unit_amount: cents,
            },
            quantity: 1,
          },
        ],
        // GST is already included in the invoice total, so no tax is added here.
        payment_intent_data: { description },
        client_reference_id: inv.id,
        metadata: { invoice_id: inv.id },
        ...(inv.customer_email && { customer_email: inv.customer_email }),
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
