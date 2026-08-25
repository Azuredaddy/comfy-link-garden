// Shared create/edit editor for quotes and invoices, including the line-item
// grid, live GST-aware totals, save (draft), save + send (emails the PDF link),
// and PDF preview. Quotes and invoices differ only in a few labels/fields.
import {
  $, el, esc, money, supabase, toast, openOverlay, apiFetch, apiOpenPdf, nextNumber,
  todayISO, addDaysISO,
} from './lib.js';

async function loadSettings() {
  const { data } = await supabase.from('business_settings').select('*').eq('id', 1).maybeSingle();
  return { gst_registered: false, gst_rate: 10, quote_terms_days: 14, invoice_due_days: 7, ...(data || {}) };
}

function itemRow(it = {}) {
  const row = el(`<tr>
    <td><input class="i-desc" placeholder="e.g. Single-item pickup & disposal" value="${esc(it.description || '')}" /></td>
    <td class="num" style="width:70px"><input class="i-qty" inputmode="decimal" value="${it.quantity ?? 1}" /></td>
    <td class="num" style="width:110px"><input class="i-price" inputmode="decimal" value="${it.unit_price ?? ''}" placeholder="0.00" /></td>
    <td class="num i-total" style="width:100px;padding-top:16px">$0.00</td>
    <td style="width:34px"><button class="ghost sm i-del" title="Remove" style="padding:6px 9px">✕</button></td>
  </tr>`);
  return row;
}

export async function openDocEditor(kind, opts = {}) {
  const isInvoice = kind === 'invoice';
  const table = isInvoice ? 'invoices' : 'quotes';
  const itemsTable = isInvoice ? 'invoice_items' : 'quote_items';
  const fk = isInvoice ? 'invoice_id' : 'quote_id';
  const settings = await loadSettings();

  let doc = {
    id: null, number: null, status: 'draft',
    customer_name: '', customer_email: '', customer_phone: '', customer_address: '', suburb: '',
    issue_date: todayISO(),
    expiry_date: addDaysISO(settings.quote_terms_days || 14),
    due_date: addDaysISO(settings.invoice_due_days || 7),
    customer_notes: '', internal_notes: '',
    quote_request_id: null, quote_id: null,
  };
  let items = [{ description: '', quantity: 1, unit_price: 0 }];

  if (opts.id) {
    const { data } = await supabase.from(table).select('*').eq('id', opts.id).maybeSingle();
    if (!data) { toast('Not found', 'bad'); return; }
    doc = { ...doc, ...data };
    const { data: its } = await supabase.from(itemsTable).select('*').eq(fk, opts.id).order('position');
    items = (its && its.length) ? its : items;
  } else if (opts.lead) {
    const L = opts.lead;
    doc.customer_name = L.name || ''; doc.customer_email = L.email || '';
    doc.customer_phone = L.phone || ''; doc.suburb = L.suburb || '';
    doc.quote_request_id = L.id;
    if (L.service) items = [{ description: L.service, quantity: 1, unit_price: 0 }];
  } else if (opts.fromQuote) {
    const Q = opts.fromQuote;
    doc.customer_name = Q.customer_name; doc.customer_email = Q.customer_email;
    doc.customer_phone = Q.customer_phone; doc.customer_address = Q.customer_address;
    doc.suburb = Q.suburb; doc.customer_notes = Q.customer_notes;
    doc.quote_id = Q.id; doc.quote_request_id = Q.quote_request_id || null;
    items = (Q._items && Q._items.length) ? Q._items.map((i) => ({ ...i })) : items;
  }

  const gst = !!settings.gst_registered;
  const dateField = isInvoice
    ? `<div class="grow"><label>Due date</label><input id="dDue" type="date" value="${esc(doc.due_date || '')}"></div>`
    : `<div class="grow"><label>Valid until</label><input id="dExpiry" type="date" value="${esc(doc.expiry_date || '')}"></div>`;

  const view = el(`<div>
    <div class="spread">
      <h2>${doc.id ? esc(doc.number || (isInvoice ? 'Invoice' : 'Quote')) : (isInvoice ? 'New invoice' : 'New quote')}</h2>
      ${doc.id ? `<span class="pill ${esc(doc.status)}">${esc(doc.status)}</span>` : ''}
    </div>

    <div class="row"><div class="grow"><label>Customer name</label><input id="dName" value="${esc(doc.customer_name)}"></div></div>
    <div class="row">
      <div class="grow"><label>Email</label><input id="dEmail" type="email" value="${esc(doc.customer_email || '')}"></div>
      <div class="grow"><label>Phone</label><input id="dPhone" value="${esc(doc.customer_phone || '')}"></div>
    </div>
    <div class="row">
      <div class="grow"><label>Address</label><input id="dAddr" value="${esc(doc.customer_address || '')}"></div>
      <div style="width:150px"><label>Suburb</label><input id="dSuburb" value="${esc(doc.suburb || '')}"></div>
    </div>
    <div class="row">
      <div class="grow"><label>Issue date</label><input id="dIssue" type="date" value="${esc(doc.issue_date)}"></div>
      ${dateField}
    </div>

    <label style="margin-top:16px">Line items</label>
    <table class="items"><thead><tr>
      <th>Description</th><th class="num">Qty</th><th class="num">Unit $</th><th class="num">Amount</th><th></th>
    </tr></thead><tbody id="dItems"></tbody></table>
    <button id="dAddItem" class="subtle sm">＋ Add line</button>

    <div style="margin-top:14px;margin-left:auto;max-width:280px">
      <div class="spread"><span class="muted">Subtotal</span><span id="tSub" class="num">$0.00</span></div>
      ${gst ? `<div class="spread"><span class="muted">GST (${Number(settings.gst_rate)}%)</span><span id="tGst" class="num">$0.00</span></div>` : ''}
      <div class="spread" style="font-size:19px;font-weight:800;margin-top:4px"><span>Total</span><span id="tTot" class="num">$0.00</span></div>
      ${gst ? '' : '<div class="muted" style="font-size:12px;margin-top:4px">GST not applied (turn on in Settings if registered).</div>'}
    </div>

    <label style="margin-top:16px">Notes to customer (shown on the PDF)</label>
    <textarea id="dNotes" rows="2">${esc(doc.customer_notes || '')}</textarea>
    <label>Internal notes (private)</label>
    <textarea id="dInternal" rows="2">${esc(doc.internal_notes || '')}</textarea>

    <div class="row" style="margin-top:18px">
      <button id="dSave">${doc.id ? 'Save changes' : 'Save draft'}</button>
      <button id="dSend" class="subtle">Save &amp; send</button>
      ${doc.id ? '<button id="dPdf" class="ghost">Preview PDF</button>' : ''}
      ${(!isInvoice && doc.id) ? '<button id="dConvert" class="ghost">Convert to invoice</button>' : ''}
      ${doc.id ? '<button id="dDelete" class="danger" style="margin-left:auto">Delete</button>' : ''}
    </div>
    <p class="muted" style="font-size:12px;margin-top:8px">“Save &amp; send” emails the customer a link to the ${isInvoice ? 'invoice' : 'quote'} PDF.</p>
  </div>`);

  const close = openOverlay(view, 'modal');
  const tbody = view.querySelector('#dItems');
  items.forEach((it) => tbody.appendChild(itemRow(it)));

  function recalc() {
    let sub = 0;
    tbody.querySelectorAll('tr').forEach((tr) => {
      const qty = parseFloat(tr.querySelector('.i-qty').value) || 0;
      const price = parseFloat(tr.querySelector('.i-price').value) || 0;
      const lt = qty * price;
      tr.querySelector('.i-total').textContent = money(lt);
      sub += lt;
    });
    const g = gst ? sub * (Number(settings.gst_rate) / 100) : 0;
    view.querySelector('#tSub').textContent = money(sub);
    if (view.querySelector('#tGst')) view.querySelector('#tGst').textContent = money(g);
    view.querySelector('#tTot').textContent = money(sub + g);
    return { subtotal: round2(sub), gst_amount: round2(g), total: round2(sub + g) };
  }
  const round2 = (n) => Math.round(n * 100) / 100;

  tbody.addEventListener('input', recalc);
  tbody.addEventListener('click', (e) => {
    if (e.target.closest('.i-del')) {
      if (tbody.children.length > 1) e.target.closest('tr').remove();
      else toast('Keep at least one line.', 'bad');
      recalc();
    }
  });
  view.querySelector('#dAddItem').addEventListener('click', () => { tbody.appendChild(itemRow()); });
  recalc();

  function collect() {
    const totals = recalc();
    const rows = [...tbody.querySelectorAll('tr')].map((tr, i) => ({
      description: tr.querySelector('.i-desc').value.trim(),
      quantity: parseFloat(tr.querySelector('.i-qty').value) || 0,
      unit_price: parseFloat(tr.querySelector('.i-price').value) || 0,
      line_total: round2((parseFloat(tr.querySelector('.i-qty').value) || 0) * (parseFloat(tr.querySelector('.i-price').value) || 0)),
      position: i,
    })).filter((r) => r.description || r.line_total);
    const header = {
      customer_name: view.querySelector('#dName').value.trim(),
      customer_email: view.querySelector('#dEmail').value.trim() || null,
      customer_phone: view.querySelector('#dPhone').value.trim() || null,
      customer_address: view.querySelector('#dAddr').value.trim() || null,
      suburb: view.querySelector('#dSuburb').value.trim() || null,
      issue_date: view.querySelector('#dIssue').value || todayISO(),
      customer_notes: view.querySelector('#dNotes').value.trim() || null,
      internal_notes: view.querySelector('#dInternal').value.trim() || null,
      subtotal: totals.subtotal, gst_amount: totals.gst_amount, total: totals.total,
    };
    if (isInvoice) header.due_date = view.querySelector('#dDue').value || null;
    else header.expiry_date = view.querySelector('#dExpiry').value || null;
    return { header, rows };
  }

  // Persist; returns the saved doc id (allocates a number on first save).
  async function persist() {
    const { header, rows } = collect();
    if (!header.customer_name) { toast('Add a customer name.', 'bad'); return null; }
    if (!rows.length) { toast('Add at least one line item.', 'bad'); return null; }

    let id = doc.id;
    if (!id) {
      const number = await nextNumber(kind);
      const insert = { ...header, number, status: 'draft' };
      if (doc.quote_request_id) insert.quote_request_id = doc.quote_request_id;
      if (isInvoice && doc.quote_id) insert.quote_id = doc.quote_id;
      const { data, error } = await supabase.from(table).insert(insert).select('id, number').single();
      if (error) throw new Error(error.message);
      id = data.id; doc.id = id; doc.number = data.number;
      // if converting a quote → invoice, mark the quote invoiced
      if (isInvoice && doc.quote_id) await supabase.from('quotes').update({ status: 'invoiced' }).eq('id', doc.quote_id);
    } else {
      const { error } = await supabase.from(table).update(header).eq('id', id);
      if (error) throw new Error(error.message);
    }
    // replace items
    await supabase.from(itemsTable).delete().eq(fk, id);
    if (rows.length) {
      const payload = rows.map((r) => ({ ...r, [fk]: id }));
      const { error } = await supabase.from(itemsTable).insert(payload);
      if (error) throw new Error(error.message);
    }
    return id;
  }

  view.querySelector('#dSave').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const id = await persist(); if (id) { toast('Saved'); close(); opts.onSaved && opts.onSaved(); } }
    catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
  });

  view.querySelector('#dSend').addEventListener('click', async (e) => {
    const email = view.querySelector('#dEmail').value.trim();
    if (!email) { toast('Add a customer email to send.', 'bad'); return; }
    e.target.disabled = true; e.target.textContent = 'Sending…';
    try {
      const id = await persist();
      if (!id) throw new Error('Could not save');
      const res = await apiFetch(`/api/admin/${kind}/send`, { body: { id } });
      toast(res.emailed ? `Sent to ${email}` : (res.message || 'Saved, email failed'), res.emailed ? 'ok' : 'bad');
      close(); opts.onSaved && opts.onSaved();
    } catch (err) {
      toast(err.message, 'bad'); e.target.disabled = false; e.target.textContent = 'Save & send';
    }
  });

  const pdfBtn = view.querySelector('#dPdf');
  if (pdfBtn) pdfBtn.addEventListener('click', async () => {
    try { await apiOpenPdf(`/api/admin/document-pdf?type=${kind}&id=${doc.id}`, `${kind}-${doc.number || doc.id}.pdf`); }
    catch (err) { toast(err.message, 'bad'); }
  });

  const convBtn = view.querySelector('#dConvert');
  if (convBtn) convBtn.addEventListener('click', async () => {
    const { rows } = collect();
    close();
    openDocEditor('invoice', { fromQuote: { ...doc, _items: rows }, onSaved: opts.onSaved });
  });

  const delBtn = view.querySelector('#dDelete');
  if (delBtn) delBtn.addEventListener('click', async (e) => {
    const label = doc.number || (isInvoice ? 'this invoice' : 'this quote');
    const warn = isInvoice && doc.status === 'paid'
      ? `${label} is marked PAID and counts toward your revenue. Delete it anyway? This can't be undone.`
      : `Delete ${label}? This can't be undone.`;
    if (!window.confirm(warn)) return;
    e.target.disabled = true;
    // line items are removed automatically (ON DELETE CASCADE)
    const { error } = await supabase.from(table).delete().eq('id', doc.id);
    if (error) { toast(error.message, 'bad'); e.target.disabled = false; return; }
    toast((isInvoice ? 'Invoice' : 'Quote') + ' deleted');
    close(); opts.onSaved && opts.onSaved();
  });
}
