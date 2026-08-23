// Expenses tab — track deductible spend (fuel, tools, tip fees…), filter by
// period, see totals, upload receipts, and download the yearly expenses PDF.
import {
  $, el, esc, money, fmtDate, supabase, toast, apiOpenPdf,
  EXPENSE_CATEGORIES, todayISO, currentFyStart, fyRange, fyLabel, monthRange,
} from './lib.js';

let period = 'fy';
let gstRegistered = false;

export async function load() {
  const s = await supabase.from('business_settings').select('gst_registered').eq('id', 1).maybeSingle();
  gstRegistered = !!s.data?.gst_registered;
  const fy = currentFyStart();

  $('tab-expenses').innerHTML = `
    <div class="card">
      <div class="spread"><strong>Add an expense</strong></div>
      <div class="row" style="align-items:flex-end;margin-top:6px">
        <div style="width:150px"><label>Date</label><input id="exDate" type="date" value="${todayISO()}"></div>
        <div style="width:170px"><label>Category</label>
          <select id="exCat">${EXPENSE_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
        <div class="grow" style="min-width:160px"><label>Description</label><input id="exDesc" placeholder="e.g. Fuel — Ampol Wyong"></div>
        <div style="width:140px"><label>Supplier</label><input id="exSupplier" placeholder="optional"></div>
        <div style="width:120px"><label>Amount $</label><input id="exAmount" inputmode="decimal" placeholder="0.00"></div>
        ${gstRegistered ? '<div style="width:110px"><label>GST $</label><input id="exGst" inputmode="decimal" placeholder="auto"></div>' : ''}
        <div style="width:170px"><label>Receipt</label><input id="exReceipt" type="file" accept="image/*,application/pdf"></div>
        <button id="exAdd">Add</button>
      </div>
    </div>

    <div class="card spread">
      <div class="row">
        <label style="margin:0">Period</label>
        <select id="exPeriod" style="width:auto">
          <option value="fy">This financial year (${fyLabel(fy)})</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </select>
      </div>
      <div class="row">
        <span class="muted" id="exTotal"></span>
        <button id="exPdf" class="ghost sm">⬇ Yearly PDF</button>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:auto">
      <table class="tbl"><thead><tr>
        <th>Date</th><th>Category</th><th>Description</th><th>Supplier</th>
        <th class="num">Amount</th><th>Receipt</th><th></th>
      </tr></thead><tbody id="exRows"></tbody></table>
    </div>`;

  $('exPeriod').value = period;
  $('exPeriod').addEventListener('change', (e) => { period = e.target.value; refresh(); });
  $('exAdd').addEventListener('click', add);
  $('exPdf').addEventListener('click', async () => {
    try { await apiOpenPdf(`/api/admin/expenses-report?fy=${fy}`, `lanky-expenses-FY${fy}-${fy + 1}.pdf`); }
    catch (err) { toast(err.message, 'bad'); }
  });
  await refresh();
}

async function add() {
  const amount = parseFloat($('exAmount').value);
  if (!amount || amount <= 0) { toast('Enter an amount.', 'bad'); return; }
  const btn = $('exAdd'); btn.disabled = true; btn.textContent = '…';

  let receipt_url = null;
  const file = $('exReceipt').files[0];
  try {
    if (file) {
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.\-]/gi, '_')}`;
      const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: false });
      if (error) throw error;
      receipt_url = path;
    }
    const row = {
      expense_date: $('exDate').value || todayISO(),
      category: $('exCat').value,
      description: $('exDesc').value.trim() || null,
      supplier: $('exSupplier').value.trim() || null,
      amount,
      gst_amount: gstRegistered
        ? ($('exGst') && $('exGst').value ? parseFloat($('exGst').value) : Math.round((amount / 11) * 100) / 100)
        : null,
      receipt_url,
    };
    const { error } = await supabase.from('expenses').insert(row);
    if (error) throw error;
    toast('Expense added');
    $('exDesc').value = ''; $('exSupplier').value = ''; $('exAmount').value = '';
    if ($('exGst')) $('exGst').value = ''; $('exReceipt').value = '';
    await refresh();
  } catch (err) {
    toast(err.message || 'Could not add expense', 'bad');
  } finally {
    btn.disabled = false; btn.textContent = 'Add';
  }
}

async function refresh() {
  let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(500);
  if (period === 'fy') { const { from, to } = fyRange(currentFyStart()); q = q.gte('expense_date', from).lte('expense_date', to); }
  if (period === 'month') { const { from, to } = monthRange(); q = q.gte('expense_date', from).lte('expense_date', to); }
  const { data, error } = await q;
  const rows = $('exRows');
  if (error) { rows.innerHTML = `<tr><td colspan="7" class="err">${esc(error.message)}</td></tr>`; return; }

  const total = data.reduce((s, e) => s + Number(e.amount || 0), 0);
  $('exTotal').textContent = `${data.length} item${data.length === 1 ? '' : 's'} · ${money(total)}`;
  if (!data.length) { rows.innerHTML = `<tr><td colspan="7" class="muted">No expenses in this period.</td></tr>`; return; }

  rows.innerHTML = '';
  for (const e of data) {
    const tr = el(`<tr>
      <td class="muted">${esc(fmtDate(e.expense_date))}</td>
      <td><span class="pill">${esc(e.category)}</span></td>
      <td>${esc(e.description || '—')}</td>
      <td>${esc(e.supplier || '—')}</td>
      <td class="num">${money(e.amount)}</td>
      <td></td>
      <td class="num"></td>
    </tr>`);
    if (e.receipt_url) {
      const link = el('<button class="ghost sm">View</button>');
      link.addEventListener('click', async () => {
        const { data: signed, error } = await supabase.storage.from('receipts').createSignedUrl(e.receipt_url, 120);
        if (error) { toast(error.message, 'bad'); return; }
        window.open(signed.signedUrl, '_blank');
      });
      tr.children[5].appendChild(link);
    } else { tr.children[5].innerHTML = '<span class="muted">—</span>'; }

    const del = el('<button class="danger sm">Delete</button>');
    del.addEventListener('click', async () => {
      if (!window.confirm('Delete this expense?')) return;
      const { error } = await supabase.from('expenses').delete().eq('id', e.id);
      if (error) { toast(error.message, 'bad'); return; }
      toast('Deleted'); refresh();
    });
    tr.children[6].appendChild(del);
    rows.appendChild(tr);
  }
}
