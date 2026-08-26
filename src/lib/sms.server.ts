// Twilio SMS helper (REST + Basic auth, no SDK).
// Config via environment secrets (set in Lovable):
//   TWILIO_ACCOUNT_SID   (AC…)
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM          your Twilio number in E.164, e.g. +61480123456
export function isConfigured(): boolean {
  return !!(process.env["TWILIO_ACCOUNT_SID"] && process.env["TWILIO_AUTH_TOKEN"] && process.env["TWILIO_FROM"]);
}

/** Normalise an Australian mobile to E.164 (+61…). Returns null if unusable. */
export function normalizeAuPhone(phone: string | null | undefined): string | null {
  let p = String(phone ?? "").replace(/[^\d+]/g, "");
  if (!p) return null;
  if (p.startsWith("+")) return p;
  if (p.startsWith("0")) return "+61" + p.slice(1);
  if (p.startsWith("61")) return "+" + p;
  if (p.length === 9) return "+61" + p; // 4xxxxxxxx
  return "+61" + p;
}

export type SmsResult = { ok: boolean; configured: boolean; sid?: string; error?: string };

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_FROM"];
  if (!sid || !token || !from) return { ok: false, configured: false, error: "Twilio isn't set up yet." };

  const num = normalizeAuPhone(to);
  if (!num) return { ok: false, configured: true, error: "That phone number doesn't look valid." };

  const params = new URLSearchParams({ To: num, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) return { ok: false, configured: true, error: json?.message || `Twilio error ${res.status}` };
  return { ok: true, configured: true, sid: json?.sid };
}
