// Xero OAuth2 + Accounting API helper.
// Config comes from environment secrets (set these in Lovable):
//   XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI
//   XERO_SALES_ACCOUNT_CODE (optional, defaults to "200")
// Tokens are stored server-side only (public.xero_connection, service-role).
import { supabaseAdmin } from "../integrations/supabase/client.server";

const AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";
const API_BASE = "https://api.xero.com/api.xro/2.0";
const SCOPES =
  "openid profile email accounting.settings accounting.transactions accounting.contacts offline_access";

function creds() {
  const id = process.env["XERO_CLIENT_ID"];
  const secret = process.env["XERO_CLIENT_SECRET"];
  const redirect = process.env["XERO_REDIRECT_URI"];
  if (!id || !secret || !redirect) {
    throw new Error("Xero isn't configured. Set XERO_CLIENT_ID, XERO_CLIENT_SECRET and XERO_REDIRECT_URI in Lovable.");
  }
  return { id, secret, redirect };
}

export function isConfigured(): boolean {
  return !!(process.env["XERO_CLIENT_ID"] && process.env["XERO_CLIENT_SECRET"] && process.env["XERO_REDIRECT_URI"]);
}

const basicAuth = () => {
  const { id, secret } = creds();
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
};

// ---- OAuth flow -----------------------------------------------------------
export async function buildAuthUrl(): Promise<string> {
  const { id, redirect } = creds();
  const state = crypto.randomUUID();
  await supabaseAdmin.from("xero_oauth_state").insert({ state } as never);
  const p = new URLSearchParams({
    response_type: "code",
    client_id: id,
    redirect_uri: redirect,
    scope: SCOPES,
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

export async function consumeState(state: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("xero_oauth_state").select("state, created_at").eq("state", state).maybeSingle();
  await supabaseAdmin.from("xero_oauth_state").delete().eq("state", state);
  if (!data) return false;
  return Date.now() - new Date(data.created_at).getTime() < 15 * 60 * 1000;
}

async function saveTokens(tok: any, tenant: { tenantId?: string | null; tenantName?: string | null }) {
  const expires_at = new Date(Date.now() + (Number(tok.expires_in || 1800) - 60) * 1000).toISOString();
  await supabaseAdmin.from("xero_connection").upsert({
    id: 1,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at,
    tenant_id: tenant.tenantId ?? undefined,
    tenant_name: tenant.tenantName ?? undefined,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never);
}

export async function exchangeCode(code: string): Promise<{ tenant_name: string }> {
  const { redirect } = creds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: basicAuth() },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect }),
  });
  if (!res.ok) throw new Error("Xero token exchange failed: " + (await res.text()).slice(0, 300));
  const tok = await res.json();

  const connRes = await fetch(CONNECTIONS_URL, { headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/json" } });
  const conns = await connRes.json();
  const tenant = Array.isArray(conns) ? (conns.find((c: any) => c.tenantType === "ORGANISATION") ?? conns[0]) : null;
  if (!tenant) throw new Error("No Xero organisation is connected to this login.");
  await saveTokens(tok, tenant);
  return { tenant_name: tenant.tenantName };
}

export async function getConnection() {
  const { data } = await supabaseAdmin.from("xero_connection").select("*").eq("id", 1).maybeSingle();
  return data as
    | { access_token: string; refresh_token: string; expires_at: string; tenant_id: string; tenant_name: string; connected_at: string }
    | null;
}

async function validConnection() {
  const conn = await getConnection();
  if (!conn || !conn.refresh_token) throw new Error("Xero isn't connected.");
  if (new Date(conn.expires_at).getTime() > Date.now() + 30000) return conn;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: basicAuth() },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
  });
  if (!res.ok) throw new Error("Xero session expired — please reconnect Xero in Settings.");
  const tok = await res.json();
  await saveTokens(tok, { tenantId: conn.tenant_id, tenantName: conn.tenant_name });
  return (await getConnection())!;
}

async function xeroFetch(path: string, opts: { method?: string; body?: unknown } = {}): Promise<any> {
  const conn = await validConnection();
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      authorization: `Bearer ${conn.access_token}`,
      "xero-tenant-id": conn.tenant_id,
      accept: "application/json",
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-json (e.g. 204) */ }
  if (!res.ok) {
    const msg =
      json?.Message ||
      json?.Detail ||
      json?.Elements?.[0]?.ValidationErrors?.[0]?.Message ||
      text.slice(0, 300) ||
      `Xero error ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function disconnect() {
  await supabaseAdmin.from("xero_connection").delete().eq("id", 1);
}

// ---- data operations ------------------------------------------------------
export async function fetchOrgDetails() {
  const org = (await xeroFetch("/Organisation"))?.Organisations?.[0] ?? {};
  let bank: any = null;
  try {
    const acc = await xeroFetch(`/Accounts?where=${encodeURIComponent('Type=="BANK"')}`);
    bank = acc?.Accounts?.[0] ?? null;
  } catch { /* accounts scope/permission — ignore */ }
  return {
    business_name: org.Name || undefined,
    abn: org.TaxNumber || undefined,
    phone: (org.Phones || []).map((p: any) => p.PhoneNumber).filter(Boolean)[0] || undefined,
    address: org.Addresses?.[0]?.AddressLine1 || undefined,
    bank_name: bank?.Name || undefined,
    bank_account: bank?.BankAccountNumber || undefined,
  };
}

type DocLike = {
  customer_name: string; customer_email?: string | null; customer_phone?: string | null;
  number?: string | null; issue_date: string; due_date?: string | null; expiry_date?: string | null;
};
type ItemLike = { description?: string | null; quantity: number; unit_price: number };

async function ensureContact(doc: DocLike): Promise<string> {
  const q = async (where: string) => {
    try { return (await xeroFetch(`/Contacts?where=${encodeURIComponent(where)}`))?.Contacts ?? []; }
    catch { return []; }
  };
  if (doc.customer_email) {
    const hit = await q(`EmailAddress=="${doc.customer_email.replace(/"/g, "")}"`);
    if (hit[0]?.ContactID) return hit[0].ContactID;
  }
  const byName = await q(`Name=="${(doc.customer_name || "").replace(/"/g, "")}"`);
  if (byName[0]?.ContactID) return byName[0].ContactID;

  const created = await xeroFetch("/Contacts", {
    method: "POST",
    body: {
      Contacts: [{
        Name: doc.customer_name || doc.customer_email || "Customer",
        EmailAddress: doc.customer_email || undefined,
        Phones: doc.customer_phone ? [{ PhoneType: "DEFAULT", PhoneNumber: doc.customer_phone }] : undefined,
      }],
    },
  });
  const id = created?.Contacts?.[0]?.ContactID;
  if (!id) throw new Error("Could not create the Xero contact.");
  return id;
}

function lineItems(items: ItemLike[], gst: boolean) {
  const code = process.env["XERO_SALES_ACCOUNT_CODE"] || "200";
  return items.map((it) => ({
    Description: (it.description || ".").slice(0, 3900),
    Quantity: Number(it.quantity) || 1,
    UnitAmount: Number(it.unit_price) || 0,
    AccountCode: code,
    TaxType: gst ? "OUTPUT" : "NONE",
  }));
}

/** Create an ACCREC invoice in Xero. Returns { InvoiceID, InvoiceNumber }. */
export async function pushInvoice(doc: DocLike, items: ItemLike[], gstRegistered: boolean) {
  const ContactID = await ensureContact(doc);
  const res = await xeroFetch("/Invoices", {
    method: "POST",
    body: {
      Invoices: [{
        Type: "ACCREC",
        Contact: { ContactID },
        Date: doc.issue_date,
        DueDate: doc.due_date || undefined,
        Reference: doc.number || undefined,
        Status: "AUTHORISED",
        LineAmountTypes: gstRegistered ? "Exclusive" : "NoTax",
        LineItems: lineItems(items, gstRegistered),
      }],
    },
  });
  const inv = res?.Invoices?.[0];
  if (!inv?.InvoiceID) throw new Error("Xero did not return an invoice id.");
  return { id: inv.InvoiceID as string, number: inv.InvoiceNumber as string, contactId: ContactID };
}

/** Ask Xero to email the invoice PDF to the contact using the org's template. */
export async function emailInvoice(invoiceId: string) {
  await xeroFetch(`/Invoices/${invoiceId}/Email`, { method: "POST", body: {} });
}

/** Create a Quote in Xero. Returns { QuoteID, QuoteNumber }. */
export async function pushQuote(doc: DocLike, items: ItemLike[], gstRegistered: boolean) {
  const ContactID = await ensureContact(doc);
  const res = await xeroFetch("/Quotes", {
    method: "POST",
    body: {
      Quotes: [{
        Contact: { ContactID },
        Date: doc.issue_date,
        ExpiryDate: doc.expiry_date || undefined,
        Reference: doc.number || undefined,
        Status: "SENT",
        LineAmountTypes: gstRegistered ? "Exclusive" : "NoTax",
        LineItems: lineItems(items, gstRegistered),
      }],
    },
  });
  const qt = res?.Quotes?.[0];
  if (!qt?.QuoteID) throw new Error("Xero did not return a quote id.");
  return { id: qt.QuoteID as string, number: qt.QuoteNumber as string, contactId: ContactID };
}
