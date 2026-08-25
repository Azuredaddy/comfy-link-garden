// Reports & tax — per financial-year summary: gross sales, expenses by
// category, net profit, and (if GST-registered) a GST summary.
import {
  $, esc, money, supabase, toast, apiOpenPdf,
  currentFyStart, fyRange, fyLabel,
} from './lib.js';

const sum = (rows, k) => (rows || []).reduce((s, r) => s + Number(r[k] || 0), 0);
let fy = currentFyStart();
let gstRegistered = false;

export async function load() {
  const s = await supabase.from('business_settings').select('gst_registered').eq('id', 1).maybeSingle();
  gstRegistered = !!s.data?.gst_registered;
  const now = currentFyStart();
  const years = [0, 1, 2, 3, 4].map((i) => now - i);

  $('tab-reports').innerHTML = `
    <div class="card spread">
      <div class="row">
        <label style="margin:0">Financial year</label>
        <select id="rpFy" style="width:auto">
          ${years.map((y) => `<option value="${y}">${fyLabel(y)}  (Jul ${y} – Jun ${y + 1})</option>`).join('')}
        </select>
      </div>
      <button id="rpPdf" class="ghost sm">⬇ Expenses PDF</button>
    </div>
    <div id="rpBody"></div>`;

  $('rpFy').value = fy;
  $('rpFy').addEventListener('change', (e) => { fy = parseInt(e.target.value, 10); render(); });
  $('rpPdf').addEventListener('click', async () => {
    try { await apiOpenPdf(`/api/admin/expenses-report?fy=${fy}`, `lanky-expenses-FY${fy}-${fy + 1}.pdf`); }
    catch (err) { toast(err.message, 'bad'); }
  });
  await render();
}

async function render() {
  const { from, to } = fyRange(fy);
  const [paid, exp, other] = await Promise.all([
    supabase.from('invoices').select('total,gst_amount').eq('status', 'paid').gte('paid_at', from + 'T00:00:00').lte('paid_at', to + 'T23:59:59'),
    supabase.from('expenses').select('amount,gst_amount,category').gte('expense_date', from).lte('expense_date', to),
    supabase.from('other_income').select('amount,source').gte('income_date', from).lte('income_date', to),
  ]);

  const gross = sum(paid.data, 'total');
  const otherTotal = sum(other.data, 'amount');
  const totalIncome = gross + otherTotal;
  const expTotal = sum(exp.data, 'amount');
  const net = totalIncome - expTotal;

  // expenses by category
  const byCat = {};
  for (const e of (exp.data || [])) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0);
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  // other income by source
  const bySource = {};
  for (const r of (other.data || [])) { const k = r.source || 'Other'; bySource[k] = (bySource[k] || 0) + Number(r.amount || 0); }
  const srcRows = Object.entries(bySource).sort((a, b) => b[1] - a[1]);

  const gstOut = sum(paid.data, 'gst_amount');
  const gstIn = sum(exp.data, 'gst_amount');

  $('rpBody').innerHTML = `
    <div class="tiles">
      <div class="tile"><div class="k">Invoice sales</div><div class="v">${money(gross)}</div><div class="s">Paid invoices</div></div>
      <div class="tile"><div class="k">Other income</div><div class="v">${money(otherTotal)}</div><div class="s">Airtasker, cash, imported</div></div>
      <div class="tile accent"><div class="k">Total income</div><div class="v">${money(totalIncome)}</div><div class="s">Invoices + other</div></div>
      <div class="tile"><div class="k">Expenses</div><div class="v">${money(expTotal)}</div><div class="s">Deductible</div></div>
      <div class="tile accent"><div class="k">Net profit</div><div class="v">${money(net)}</div><div class="s">Before tax</div></div>
    </div>

    ${srcRows.length ? `<div class="card">
      <strong>Other income by source</strong>
      <table class="tbl" style="margin-top:8px"><tbody>${
        srcRows.map(([s, v]) => `<tr><td>${esc(s)}</td><td class="num">${money(v)}</td></tr>`).join('')
      }<tr><td><strong>Total</strong></td><td class="num"><strong>${money(otherTotal)}</strong></td></tr></tbody></table>
    </div>` : ''}

    <div class="card">
      <strong>Expenses by category</strong>
      ${catRows.length ? `<table class="tbl" style="margin-top:8px"><tbody>${
        catRows.map(([c, v]) => `<tr><td>${esc(c)}</td><td class="num">${money(v)}</td></tr>`).join('')
      }<tr><td><strong>Total</strong></td><td class="num"><strong>${money(expTotal)}</strong></td></tr></tbody></table>`
        : '<p class="muted" style="font-size:14px;margin-top:8px">No expenses recorded for this year.</p>'}
    </div>

    ${gstRegistered ? `<div class="card">
      <strong>GST summary</strong>
      <table class="tbl" style="margin-top:8px"><tbody>
        <tr><td>GST collected (on sales)</td><td class="num">${money(gstOut)}</td></tr>
        <tr><td>GST paid (on expenses)</td><td class="num">${money(gstIn)}</td></tr>
        <tr><td><strong>Net GST ${gstOut - gstIn >= 0 ? 'payable' : 'refundable'}</strong></td><td class="num"><strong>${money(Math.abs(gstOut - gstIn))}</strong></td></tr>
      </tbody></table>
      <p class="muted" style="font-size:12px;margin-top:8px">Indicative only — confirm figures with your accountant / BAS.</p>
    </div>` : `<div class="card"><span class="muted" style="font-size:14px">GST is turned off in Settings, so no GST summary is shown. Turn it on if you're registered.</span></div>`}

    <p class="muted" style="font-size:12px">Revenue counts invoices marked <em>paid</em>, by payment date. These figures are a guide, not tax advice.</p>`;
}
