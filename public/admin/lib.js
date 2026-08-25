// Shared helpers for the Lanky Services admin portal.
// Uses the Supabase publishable key + RLS (is_admin) for reads/writes, and the
// signed-in user's access token as a bearer for the /api/admin/* server routes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = 'https://rstabgnhargvqwasplst.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SsCPt15jfIBlV75qC3Wt7A_4mhanmSk';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const EXPENSE_CATEGORIES = [
  'Fuel', 'Tools & Equipment', 'Vehicle', 'Tip/Disposal fees', 'Materials',
  'Insurance', 'Phone/Internet', 'Advertising', 'Wages', 'Other',
];

// ---- dom helpers ----------------------------------------------------------
export const $ = (id) => document.getElementById(id);
export const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// ---- formatting -----------------------------------------------------------
export const money = (n) => '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money0 = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('en-AU');
export const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '';
export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDaysISO = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

// ---- Australian financial year (Jul–Jun) ----------------------------------
export function currentFyStart() {
  const now = new Date();
  return now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}
export const fyRange = (fyStart) => ({ from: `${fyStart}-07-01`, to: `${fyStart + 1}-06-30` });
export const fyLabel = (fyStart) => `FY ${fyStart}–${String(fyStart + 1).slice(2)}`;
export function monthRange(date = new Date()) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

// ---- auth / api -----------------------------------------------------------
export async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// Call an /api/admin/* route with the bearer token. Returns parsed JSON; throws Error(message) on failure.
export async function apiFetch(path, { method = 'POST', body } = {}) {
  const token = await getToken();
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  if (!res.ok || (json && json.ok === false)) {
    throw new Error((json && json.message) || `Request failed (${res.status})`);
  }
  return json ?? {};
}

// Open/download a PDF from an admin GET route (adds the bearer via fetch->blob).
export async function apiOpenPdf(path, filename) {
  const token = await getToken();
  const res = await fetch(path, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let msg = `Could not open PDF (${res.status})`;
    try { const j = await res.json(); if (j.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; if (filename) a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Current user's portal role: 'admin' | 'editor' | 'viewer' (cached).
let _role = null;
export async function myRole(force = false) {
  if (_role && !force) return _role;
  try { const { data } = await supabase.rpc('my_role'); _role = data || 'admin'; }
  catch { _role = 'admin'; }
  return _role;
}
export const canEdit = async () => (await myRole()) !== 'viewer';

// Xero connection status (cached for the session; pass true to refresh).
let _xero = null;
export async function xeroStatus(force = false) {
  if (_xero && !force) return _xero;
  try { _xero = await apiFetch('/api/admin/xero/status', { method: 'GET' }); }
  catch { _xero = { configured: false, connected: false }; }
  return _xero;
}

// Allocate the next FY document number via the SECURITY DEFINER RPC.
export async function nextNumber(docType) {
  const { data, error } = await supabase.rpc('next_document_number', { p_doc_type: docType });
  if (error) throw new Error(error.message);
  return data;
}

// ---- toast + modal --------------------------------------------------------
export function toast(msg, kind = 'ok') {
  const t = el(`<div class="toast ${kind === 'bad' ? 'bad' : ''}">${esc(msg)}</div>`);
  $('toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 3600);
  setTimeout(() => t.remove(), 4200);
}

// Opens a scrim with your content. `variant` = 'drawer' | 'modal'. Returns a close() fn.
export function openOverlay(contentEl, variant = 'drawer', opts = {}) {
  const dismissible = opts.dismissible !== false; // pass {dismissible:false} to require an explicit close
  const scrim = el(`<div class="scrim ${variant === 'modal' ? 'center' : ''}"></div>`);
  const holder = el(`<div class="${variant}"></div>`);
  holder.appendChild(contentEl);
  scrim.appendChild(holder);
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (dismissible && e.key === 'Escape') close(); };
  // Only close on a genuine backdrop click — the press must START on the backdrop.
  // (Highlighting text inside and releasing outside used to close it and lose work.)
  let downOnScrim = false;
  scrim.addEventListener('mousedown', (e) => { downOnScrim = e.target === scrim; });
  scrim.addEventListener('mouseup', (e) => {
    if (dismissible && downOnScrim && e.target === scrim) close();
    downOnScrim = false;
  });
  document.addEventListener('keydown', onKey);
  $('modalRoot').appendChild(scrim);
  return close;
}

export const confirmYes = (msg) => window.confirm(msg);
