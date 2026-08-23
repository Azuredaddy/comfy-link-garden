// Settings — business details used on quotes/invoices, the GST toggle, bank
// details for invoice payment, document number prefixes, and a placeholder for
// the Xero connection (added later via Lovable).
import { $, esc, supabase, toast } from './lib.js';

export async function load() {
  const { data, error } = await supabase.from('business_settings').select('*').eq('id', 1).maybeSingle();
  if (error) { $('tab-settings').innerHTML = `<div class="card err">${esc(error.message)}</div>`; return; }
  const s = data || {};

  $('tab-settings').innerHTML = `
    <div class="card">
      <strong>Business details</strong>
      <p class="muted" style="font-size:13px;margin:4px 0 6px">These appear on your quotes and invoices.</p>
      <div class="row">
        <div class="grow"><label>Business name</label><input id="sName" value="${esc(s.business_name || '')}"></div>
        <div style="width:180px"><label>ABN</label><input id="sAbn" value="${esc(s.abn || '')}"></div>
      </div>
      <div class="row">
        <div class="grow"><label>Phone</label><input id="sPhone" value="${esc(s.phone || '')}"></div>
        <div class="grow"><label>Email</label><input id="sEmail" value="${esc(s.email || '')}"></div>
      </div>
      <label>Address</label><input id="sAddr" value="${esc(s.address || '')}">
    </div>

    <div class="card">
      <strong>GST</strong>
      <div class="row" style="margin-top:8px;align-items:center">
        <label style="margin:0"><input type="checkbox" id="sGst" ${s.gst_registered ? 'checked' : ''} style="width:auto;margin-right:8px">Registered for GST</label>
        <div style="width:120px"><label>Rate %</label><input id="sGstRate" inputmode="decimal" value="${s.gst_rate ?? 10}"></div>
      </div>
      <p class="muted" style="font-size:12px;margin-top:6px">When on, quotes/invoices add a GST line and say “Tax Invoice”. Required once turnover exceeds $75k/year.</p>
    </div>

    <div class="card">
      <strong>Bank details (for invoices)</strong>
      <div class="row" style="margin-top:6px">
        <div class="grow"><label>Bank / account name</label><input id="sBankName" value="${esc(s.bank_name || '')}"></div>
        <div style="width:130px"><label>BSB</label><input id="sBsb" value="${esc(s.bank_bsb || '')}"></div>
        <div style="width:170px"><label>Account number</label><input id="sAcct" value="${esc(s.bank_account || '')}"></div>
      </div>
    </div>

    <div class="card">
      <strong>Document numbering</strong>
      <div class="row" style="margin-top:6px">
        <div style="width:130px"><label>Quote prefix</label><input id="sQPrefix" value="${esc(s.quote_prefix || 'Q')}"></div>
        <div style="width:130px"><label>Invoice prefix</label><input id="sIPrefix" value="${esc(s.invoice_prefix || 'INV')}"></div>
        <div style="width:150px"><label>Quote valid (days)</label><input id="sQDays" inputmode="numeric" value="${s.quote_terms_days ?? 14}"></div>
        <div style="width:150px"><label>Invoice due (days)</label><input id="sIDays" inputmode="numeric" value="${s.invoice_due_days ?? 7}"></div>
      </div>
      <p class="muted" style="font-size:12px;margin-top:6px">Numbers reset each financial year, e.g. Q-2026-001.</p>
    </div>

    <div class="card">
      <strong>Xero</strong>
      <p class="muted" style="font-size:13px;margin-top:6px">Xero isn't connected yet. Add the Xero integration in Lovable, and quotes/invoices can then be pushed to Xero for your accounting. (The data model is already Xero-ready.)</p>
      <span class="pill">Not connected</span>
    </div>

    <div class="card spread">
      <button id="sSave">Save settings</button>
      <a href="/admin-errors.html" class="muted" style="font-size:13px">View server errors →</a>
    </div>`;

  $('sSave').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const patch = {
      business_name: $('sName').value.trim() || 'Lanky Services',
      abn: $('sAbn').value.trim() || null,
      phone: $('sPhone').value.trim() || null,
      email: $('sEmail').value.trim() || null,
      address: $('sAddr').value.trim() || null,
      gst_registered: $('sGst').checked,
      gst_rate: parseFloat($('sGstRate').value) || 10,
      bank_name: $('sBankName').value.trim() || null,
      bank_bsb: $('sBsb').value.trim() || null,
      bank_account: $('sAcct').value.trim() || null,
      quote_prefix: $('sQPrefix').value.trim() || 'Q',
      invoice_prefix: $('sIPrefix').value.trim() || 'INV',
      quote_terms_days: parseInt($('sQDays').value, 10) || 14,
      invoice_due_days: parseInt($('sIDays').value, 10) || 7,
    };
    const { error } = await supabase.from('business_settings').update(patch).eq('id', 1);
    e.target.disabled = false;
    if (error) { toast(error.message, 'bad'); return; }
    toast('Settings saved');
  });
}
