// Stripe helper for online invoice payments (no SDK — REST + HMAC).
// Config comes from environment secrets (set in Lovable):
//   STRIPE_SECRET_KEY       — sk_live_… / sk_test_…
//   STRIPE_WEBHOOK_SECRET   — whsec_…  (from the webhook endpoint you create)
//   PUBLIC_SITE_URL         — optional, e.g. https://lankyservices.com.au
import crypto from "node:crypto";

export function isConfigured(): boolean {
  return !!process.env["STRIPE_SECRET_KEY"];
}

export function siteUrl(fallbackOrigin: string): string {
  return (process.env["PUBLIC_SITE_URL"] || fallbackOrigin || "https://lankyservices.com.au").replace(/\/+$/, "");
}

/** Create a hosted Stripe Checkout session for an invoice. Returns the payment URL. */
export async function createCheckoutSession(opts: {
  invoiceId: string;
  number: string;
  amountCents: number;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Stripe isn't set up yet.");

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", opts.successUrl);
  body.set("cancel_url", opts.cancelUrl);
  body.set("client_reference_id", opts.invoiceId);
  body.set("metadata[invoice_id]", opts.invoiceId);
  if (opts.customerEmail) body.set("customer_email", opts.customerEmail);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "aud");
  body.set("line_items[0][price_data][unit_amount]", String(opts.amountCents));
  body.set("line_items[0][price_data][product_data][name]", `Invoice ${opts.number || ""}`.trim());

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Could not start the payment.");
  return json.url as string;
}

/** Verify a Stripe webhook signature (v1 scheme) against the raw body. */
export function verifySignature(payload: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader) return false;
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}
