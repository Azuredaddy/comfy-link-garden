// Shared logic for "send this quote/invoice to the customer":
// generate a branded PDF, host it in Supabase Storage (public `documents`
// bucket, random key), record the send on the row + in the messages log, and
// email the customer a link. Used by the admin quote/send + invoice/send routes.
import { supabaseAdmin } from "../integrations/supabase/client.server";
import { renderDocumentPdf, type PdfSettings } from "./pdf.server";
import { brandedEmail, sendEmail } from "./email.server";
import { logServerError, requestMeta } from "./error-log.server";

const DEFAULT_SETTINGS: PdfSettings = {
  business_name: "Lanky Services",
  gst_registered: false,
  gst_rate: 10,
  phone: "0439 973 051",
  email: "matt@lankyservices.com.au",
};

export async function loadSettings(): Promise<PdfSettings & { email?: string | null; phone?: string | null }> {
  const { data } = await supabaseAdmin.from("business_settings").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as PdfSettings;
}

export async function sendDocument(kind: "quote" | "invoice", id: string, request: Request): Promise<Response> {
  const meta = requestMeta(request);
  const table = kind === "quote" ? "quotes" : "invoices";
  const itemsTable = kind === "quote" ? "quote_items" : "invoice_items";
  const fk = kind === "quote" ? "quote_id" : "invoice_id";

  const settings = await loadSettings();

  const { data: doc, error: docErr } = await supabaseAdmin.from(table).select("*").eq("id", id).maybeSingle();
  if (docErr || !doc) return Response.json({ ok: false, message: "Document not found." }, { status: 404 });
  if (!doc.customer_email) {
    return Response.json({ ok: false, message: "Add a customer email address before sending." }, { status: 400 });
  }

  const { data: items } = await supabaseAdmin
    .from(itemsTable)
    .select("*")
    .eq(fk as never, id)
    .order("position", { ascending: true });

  // --- render + host the PDF ------------------------------------------------
  let url: string;
  try {
    const bytes = await renderDocumentPdf(kind, doc as never, (items ?? []) as never, settings);
    const key = `${kind}/${doc.number || id}-${crypto.randomUUID().slice(0, 8)}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("documents")
      .upload(key, new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;
    // `documents` is a private bucket — hand out a long-lived signed link.
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(key, 60 * 60 * 24 * 365);
    if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not create a document link.");
    url = signed.signedUrl;
  } catch (error) {
    await logServerError({ source: `api:${kind}:pdf`, error, status: 500, context: { id }, ...meta });
    return Response.json({ ok: false, message: "Could not generate the PDF. Please try again." }, { status: 500 });
  }

  // --- record the send on the row ------------------------------------------
  const nextStatus = doc.status === "draft" ? "sent" : doc.status;
  await supabaseAdmin
    .from(table)
    .update({ pdf_url: url, sent_at: new Date().toISOString(), status: nextStatus })
    .eq("id", id);

  // --- email the customer ---------------------------------------------------
  const label = kind === "quote" ? "quote" : "invoice";
  const noun = kind === "quote" ? `Quote ${doc.number ?? ""}`.trim() : `Invoice ${doc.number ?? ""}`.trim();
  const rows: Array<[string, string]> = [
    [kind === "quote" ? "Quote number" : "Invoice number", doc.number ?? "—"],
    ["Total", "$" + Number(doc.total || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
  ];
  const dueDate = (doc as { due_date?: string | null }).due_date;
  if (kind === "invoice" && dueDate) rows.push(["Due date", new Date(dueDate + "T00:00:00").toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })]);

  // Offer online card payment on invoices when Stripe is configured.
  const { isConfigured: stripeOn, siteUrl } = await import("./stripe.server");
  const base = siteUrl(new URL(request.url).origin);
  const canPay = kind === "invoice" && stripeOn();
  const payUrl = `${base}/pay?invoice=${id}`;
  const acceptUrl = `${base}/quote-accept?id=${id}`;

  // Quotes lead with "Accept this quote" (customer self-accepts); invoices with pay/view.
  let button: { label: string; url: string };
  let button2: { label: string; url: string } | undefined;
  if (kind === "quote") {
    button = { label: "Accept this quote", url: acceptUrl };
    button2 = { label: "View quote (PDF)", url };
  } else if (canPay) {
    button = { label: "Pay this invoice", url: payUrl };
    button2 = { label: "View invoice (PDF)", url };
  } else {
    button = { label: "View your invoice (PDF)", url };
  }

  const { html, text } = brandedEmail({
    businessName: settings.business_name,
    heading: kind === "quote" ? "Your quote from Lanky Services" : "Your invoice from Lanky Services",
    intro: `Hi ${doc.customer_name}, ${kind === "quote" ? "thanks for the opportunity — here's your quote. Happy with it? Tap Accept and we'll be in touch to book you in." : "please find your invoice below."}`,
    bodyParagraphs: ["You can reply to this email with any questions — it comes straight to us."],
    rows,
    button,
    button2,
    contact: { phone: settings.phone, email: settings.email },
  });

  const emailRes = await sendEmail({
    to: doc.customer_email,
    subject: `${noun || (kind === "quote" ? "Your quote" : "Your invoice")} — Lanky Services`,
    html,
    text,
    reply_to: settings.email ?? undefined,
    // Per-minute key: de-dupes accidental double-clicks, still allows a later resend.
    idempotency_key: `${kind}-${id}-${new Date().toISOString().slice(0, 16)}`,
  });

  await supabaseAdmin.from("messages").insert({
    [fk]: id,
    direction: "outbound",
    to_email: doc.customer_email,
    subject: `${noun} sent`,
    body: `${label} PDF: ${url}`,
    email_status: emailRes.ok ? "sent" : "failed",
    error: emailRes.ok ? null : emailRes.error ?? null,
  } as never);

  // When an invoice is sent, also text the customer a review request (once).
  if (kind === "invoice" && doc.customer_phone) {
    try {
      const { isConfigured, sendSms } = await import("./sms.server");
      if (isConfigured()) {
        const { data: already } = await supabaseAdmin
          .from("messages")
          .select("id")
          .eq("invoice_id", id)
          .eq("channel", "sms")
          .eq("subject", "Review request")
          .limit(1)
          .maybeSingle();
        if (!already) {
          const REVIEW_URL = "https://g.page/r/Cee2YwnmgX5wEAI/review";
          const smsBody = `Thanks for choosing Lanky Services! If you were happy with the job, a quick Google review would mean a lot: ${REVIEW_URL} Cheers, the Lanky team.`;
          const sms = await sendSms(doc.customer_phone, smsBody);
          await supabaseAdmin.from("messages").insert({
            invoice_id: id,
            channel: "sms",
            direction: "outbound",
            to_phone: doc.customer_phone,
            subject: "Review request",
            body: smsBody,
            email_status: sms.ok ? "sent" : "failed",
            error: sms.ok ? null : sms.error ?? null,
          } as never);
        }
      }
    } catch (error) {
      await logServerError({ source: "api:invoice:review-sms", error, status: 202, context: { id }, ...meta });
    }
  }

  if (!emailRes.ok) {
    await logServerError({ source: `api:${kind}:email`, error: emailRes.error, status: 202, context: { id }, ...meta });
    return Response.json({ ok: true, url, emailed: false, message: "PDF saved, but the email could not be sent." }, { status: 202 });
  }
  return Response.json({ ok: true, url, emailed: true });
}
