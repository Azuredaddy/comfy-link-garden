// Shared list view for quotes and invoices: filter, table with clickable rows,
// inline status control, and quick Send / PDF actions.
import { $, el, esc, money, fmtDate, supabase, toast, apiFetch, apiOpenPdf, xeroStatus } from './lib.js';
import { openDocEditor } from './doc-form.js';

let xeroOn = false;

const STATUSES = {
  quote: ['draft', 'sent', 'accepted', 'declined', 'expired', 'invoiced'],
  invoice: ['draft', 'sent', 'paid', 'overdue', 'void'],
};

export async function loadDocList(kind) {
  const isInvoice = kind === 'invoice';
  const table = isInvoice ? 'invoices' : 'quotes';
  const mount = $(isInvoice ? 'tab-invoices' : 'tab-quotes');
  const dateCol = isInvoice ? 'Due' : 'Valid until';

  mount.innerHTML = `
    <div class="card spread">
      <div class="row">
        <label style="margin:0">Show</label>
        <select id="dlFilter" style="width:auto">
          <option value="all">All</option>
          ${STATUSES[kind].map((s) => `<option value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
        </select>
      </div>
      <button id="dlNew">＋ New ${kind}</button>
    </div>
    <div class="card" style="padding:0;overflow:auto">
      <table class="tbl"><thead><tr>
        <th>#</th><th>Customer</th><th>Issued</th><th>${dateCol}</th>
        <th class="num">Total</th><th>Status</th><th></th>
      </tr></thead><tbody id="dlRows"></tbody></table>
    </div>`;

  const refresh = () => renderRows(kind, table, isInvoice);
  $('dlFilter').addEventListener('change', refresh);
  $('dlNew').addEventListener('click', () => openDocEditor(kind, { onSaved: refresh }));
  xeroOn = (await xeroStatus()).connected === true;
  await refresh();
}

async function renderRows(kind, table, isInvoice) {
  const filter = $('dlFilter').value;
  let q = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(300);
  if (filter !== 'all') q = q.eq('status', filter);
  const { data, error } = await q;
  const rows = $('dlRows');
  const refresh = () => renderRows(kind, table, isInvoice);
  if (error) { rows.innerHTML = `<tr><td colspan="7" class="err">${esc(error.message)}</td></tr>`; return; }
  if (!data.length) { rows.innerHTML = `<tr><td colspan="7" class="muted">No ${kind}s yet.</td></tr>`; return; }

  rows.innerHTML = '';
  for (const d of data) {
    const secondDate = isInvoice ? d.due_date : d.expiry_date;
    const tr = el(`<tr class="clickable">
      <td><strong>${esc(d.number || '—')}</strong></td>
      <td>${esc(d.customer_name)}</td>
      <td class="muted">${esc(fmtDate(d.issue_date))}</td>
      <td class="muted">${esc(fmtDate(secondDate) || '—')}</td>
      <td class="num">${money(d.total)}</td>
      <td></td>
      <td class="num" style="white-space:nowrap"></td>
    </tr>`);

    // status select
    const sel = el(`<select class="sm" style="width:auto;padding:6px 8px">${
      STATUSES[kind].map((s) => `<option value="${s}" ${s === d.status ? 'selected' : ''}>${s}</option>`).join('')
    }</select>`);
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      const status = sel.value;
      const patch = { status };
      if (isInvoice && status === 'paid') { patch.paid_at = new Date().toISOString(); patch.amount_paid = d.total; }
      if (isInvoice && status !== 'paid') { patch.paid_at = null; }
      const { error } = await supabase.from(table).update(patch).eq('id', d.id);
      if (error) { toast(error.message, 'bad'); return; }
      toast(`Marked ${status}`);
      refresh();
    });
    tr.children[5].appendChild(sel);

    // actions
    const actions = tr.children[6];
    const pdfBtn = el('<button class="ghost sm">PDF</button>');
    pdfBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try { await apiOpenPdf(`/api/admin/document-pdf?type=${kind}&id=${d.id}`, `${kind}-${d.number || d.id}.pdf`); }
      catch (err) { toast(err.message, 'bad'); }
    });
    const sendBtn = el(`<button class="subtle sm" style="margin-left:6px">Send</button>`);
    sendBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!d.customer_email) { toast('No email on this ' + kind + '. Open it to add one.', 'bad'); return; }
      sendBtn.disabled = true; sendBtn.textContent = '…';
      try {
        const res = await apiFetch(`/api/admin/${kind}/send`, { body: { id: d.id } });
        toast(res.emailed ? `Sent to ${d.customer_email}` : (res.message || 'Email failed'), res.emailed ? 'ok' : 'bad');
        refresh();
      } catch (err) { toast(err.message, 'bad'); sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
    });
    actions.append(pdfBtn, sendBtn);

    if (xeroOn) {
      const linked = kind === 'invoice' ? d.xero_invoice_id : d.xero_quote_id;
      const xBtn = el(`<button class="ghost sm" style="margin-left:6px">${linked ? '✓ Xero' : 'Push to Xero'}</button>`);
      xBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (linked && !window.confirm(`Already in Xero. Push ${kind} again?`)) return;
        xBtn.disabled = true; xBtn.textContent = '…';
        try {
          const res = await apiFetch(`/api/admin/xero/push-${kind}`, { body: { id: d.id } });
          toast(`In Xero as ${res.xero_number}` + (res.emailed ? ' · emailed' : ''));
          refresh();
        } catch (err) { toast(err.message, 'bad'); xBtn.disabled = false; xBtn.textContent = linked ? '✓ Xero' : 'Push to Xero'; }
      });
      actions.append(xBtn);
    }

    tr.addEventListener('click', () => openDocEditor(kind, { id: d.id, onSaved: refresh }));
    rows.appendChild(tr);
  }
}
