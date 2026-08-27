import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment, isPaymentsTestMode } from "../lib/stripe";
import { createInvoiceCheckout, getInvoiceForPayment, type InvoiceSummary } from "../lib/payments.functions";

// /pay?invoice=<uuid> — public page where a customer pays an invoice by card.
export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "Pay your invoice | Lanky Services" },
      { name: "description", content: "Securely pay your Lanky Services invoice online by card." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Pay your invoice | Lanky Services" },
      { property: "og:description", content: "Securely pay your Lanky Services invoice online by card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    invoice: typeof search["invoice"] === "string" ? search["invoice"] : undefined,
    paid: search["paid"] === "1" || search["paid"] === 1 ? true : undefined,
  }),
  component: PayPage,
});

const shell: React.CSSProperties = {
  margin: 0,
  background: "#0a0e0a",
  color: "#f1f5ec",
  font: "16px/1.6 system-ui, -apple-system, Segoe UI, Arial, sans-serif",
  minHeight: "100vh",
  padding: "32px 16px",
};
const card: React.CSSProperties = { maxWidth: 620, margin: "0 auto" };
const muted: React.CSSProperties = { color: "#93a288" };

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{title}</h1>
      <p style={muted}>{body}</p>
      <p style={{ marginTop: 24, color: "#a3e635", fontWeight: 700 }}>Lanky Services — only an arm's length away</p>
    </div>
  );
}

function PayPage() {
  const { invoice, paid } = Route.useSearch();
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice || paid) return;
    getInvoiceForPayment({ data: { invoiceId: invoice } })
      .then(setSummary)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong."));
  }, [invoice, paid]);

  const fetchClientSecret = async (): Promise<string> => {
    const result = await createInvoiceCheckout({
      data: {
        invoiceId: invoice as string,
        returnUrl: `${window.location.origin}/pay?invoice=${invoice}&paid=1`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Payment could not be started.");
    return result.clientSecret;
  };

  let content: React.ReactNode;
  if (paid) {
    content = <Message title="Payment received" body="Thanks — your payment has gone through and a receipt has been emailed to you. We'll be in touch if we need anything else." />;
  } else if (!invoice) {
    content = <Message title="Invoice not found" body="This payment link is missing its invoice reference. Please use the link from your invoice email." />;
  } else if (error) {
    content = <Message title="Payment couldn't start" body={error} />;
  } else if (!summary) {
    content = <Message title="Loading your invoice…" body="One moment." />;
  } else if (!summary.ok) {
    content = <Message title={summary.status === "paid" ? "Already paid" : "Invoice unavailable"} body={summary.message} />;
  } else {
    content = (
      <>
        <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Pay invoice {summary.number}</h1>
        <p style={{ ...muted, marginTop: 0 }}>
          Amount due:{" "}
          <strong style={{ color: "#a3e635" }}>
            ${summary.amountOwing.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AUD
          </strong>{" "}
          (GST included)
        </p>
        <div style={{ background: "#fff", borderRadius: 12, padding: 8, marginTop: 20 }}>
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </>
    );
  }

  return (
    <div style={shell}>
      {isPaymentsTestMode() && (
        <div style={{ background: "#3a2a06", color: "#fde68a", padding: "8px 12px", borderRadius: 8, maxWidth: 620, margin: "0 auto 20px", textAlign: "center", fontSize: 14 }}>
          Test mode — no real money is taken on this page yet.
        </div>
      )}
      <div style={card}>{content}</div>
    </div>
  );
}
