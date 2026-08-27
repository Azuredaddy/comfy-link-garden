// Thin wrapper around the Lovable email service (@lovable.dev/email-js) plus a
// small branded HTML template. Used by the admin quote/invoice send + reply
// routes. NOTE: the email service has no attachment support, so quote/invoice
// PDFs are hosted (Supabase Storage) and linked via a button in the email.
const SENDER_DOMAIN = "notify.lankyservices.com.au";
export const FROM = `Lanky Services <quotes@${SENDER_DOMAIN}>`;

export type EmailResult = { ok: boolean; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
  idempotency_key?: string;
}): Promise<EmailResult> {
  try {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("LOVABLE_API_KEY is unavailable");
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    await sendLovableEmail(
      {
        to: opts.to,
        from: FROM,
        sender_domain: SENDER_DOMAIN,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        reply_to: opts.reply_to,
        purpose: "transactional",
        idempotency_key: opts.idempotency_key,
      },
      { apiKey },
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 500) : "Unknown email error" };
  }
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Branded transactional email. Returns both html + a plain-text fallback. */
export function brandedEmail(opts: {
  businessName: string;
  heading: string;
  intro: string;
  bodyParagraphs?: string[];
  button?: { label: string; url: string };
  button2?: { label: string; url: string };
  rows?: Array<[string, string]>;
  contact?: { phone?: string | null; email?: string | null };
}): { html: string; text: string } {
  const rowsHtml = (opts.rows ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#5c6357;width:130px;vertical-align:top;font-size:14px">${esc(k)}</td><td style="padding:6px 0;font-size:14px">${esc(v)}</td></tr>`,
    )
    .join("");
  const bodyHtml = (opts.bodyParagraphs ?? [])
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${esc(p)}</p>`)
    .join("");
  const btn = (b: { label: string; url: string }, primary: boolean) =>
    `<a href="${esc(b.url)}" style="display:inline-block;${primary ? "background:#5aad17;color:#ffffff;" : "background:#ffffff;color:#12170f;border:1px solid #cfd8c4;"}text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px;margin:0 8px 10px 0">${esc(b.label)}</a>`;
  const linkFor = opts.button ?? opts.button2;
  const buttonHtml = (opts.button || opts.button2)
    ? `<p style="margin:24px 0 6px">${opts.button ? btn(opts.button, true) : ""}${opts.button2 ? btn(opts.button2, false) : ""}</p>
       ${linkFor ? `<p style="margin:0 0 8px;font-size:12px;color:#8a9182">Or paste this link into your browser:<br><a href="${esc(linkFor.url)}" style="color:#5aad17;word-break:break-all">${esc(linkFor.url)}</a></p>` : ""}`
    : "";
  const contactLine = [opts.contact?.phone, opts.contact?.email].filter(Boolean).join("  ·  ");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f2;font-family:Arial,Helvetica,sans-serif;color:#12170f">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0a0d0b;border-radius:14px 14px 0 0;padding:20px 24px">
      <span style="color:#a3e635;font-weight:800;font-size:18px;letter-spacing:.02em">${esc(opts.businessName)}</span>
    </div>
    <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:24px">
      <h1 style="font-size:20px;margin:0 0 12px">${esc(opts.heading)}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5">${esc(opts.intro)}</p>
      ${bodyHtml}
      ${rowsHtml ? `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px">${rowsHtml}</table>` : ""}
      ${buttonHtml}
      ${contactLine ? `<p style="margin:20px 0 0;font-size:13px;color:#8a9182">${esc(contactLine)}</p>` : ""}
    </div>
  </div></body></html>`;

  const textParts = [
    opts.heading,
    "",
    opts.intro,
    ...(opts.bodyParagraphs ?? []),
    "",
    ...(opts.rows ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(opts.button ? ["", `${opts.button.label}: ${opts.button.url}`] : []),
    ...(opts.button2 ? ["", `${opts.button2.label}: ${opts.button2.url}`] : []),
    ...(contactLine ? ["", contactLine] : []),
  ];
  return { html, text: textParts.join("\n") };
}
