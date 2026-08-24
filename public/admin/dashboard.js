// Dashboard — headline numbers for the business at a glance.
import {
  $, esc, money0, money, supabase, fmtDate,
  currentFyStart, fyRange, fyLabel, monthRange,
} from './lib.js';

const sum = (rows, k) => (rows || []).reduce((s, r) => s + Number(r[k] || 0), 0);

export async function load() {
  const root = $('tab-dashboard');
  root.innerHTML = `<div class="tiles" id="dashTiles"></div>
    <div class="card">
      <div class="row" style="margin-bottom:6px">
        <strong>Quick actions</strong>
      </div>
      <div class="row">
        <button onclick="LANKY.go('quotes')">＋ New quote</button>
        <button class="subtle" onclick="LANKY.go('invoices')">＋ New invoice</button>
        <button class="subtle" onclick="LANKY.go('expenses')">＋ Add expense</button>
        <button class="ghost" onclick="LANKY.go('leads')">View leads</button>
      </div>
    </div>
    <div class="card">
      <strong>Recent paid invoices</strong>
      <div id="dashRecent" style="margin-top:8px"></div>
    </div>`;

  const fy = currentFyStart();
  const fyR = fyRange(fy);
  const m = monthRange();

  const [paidFy, paidMonth, expFy, outstanding, leads, recent] = await Promise.all([
    supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', fyR.from + 'T00:00:00').lte('paid_at', fyR.to + 'T23:59:59'),
    supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', m.from + 'T00:00:00').lte('paid_at', m.to + 'T23:59:59'),
    supabase.from('expenses').select('amount').gte('expense_date', fyR.from).lte('expense_date', fyR.to),
    supabase.from('invoices').select('total').in('status', ['sent', 'overdue']),
    supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('handled', false),
    supabase.from('invoices').select('number,customer_name,total,paid_at').eq('status', 'paid').order('paid_at', { ascending: false }).limit(5),
  ]);

  const revFy = sum(paidFy.data, 'total');
  const revMonth = sum(paidMonth.data, 'total');
  const expenses = sum(expFy.data, 'amount');
  const net = revFy - expenses;
  const owed = sum(outstanding.data, 'total');
  const newLeads = leads.count ?? 0;

  const tile = (k, v, s, accent) => `<div class="tile ${accent ? 'accent' : ''}">
    <div class="k">${esc(k)}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`;

  $('dashTiles').innerHTML =
    tile('Made this month', money0(revMonth), 'Paid invoices, ' + new Date().toLocaleDateString('en-AU', { month: 'long' }), true) +
    tile('Revenue ' + fyLabel(fy), money0(revFy), 'Paid invoices this FY') +
    tile('Expenses ' + fyLabel(fy), money0(expenses), 'Deductible spend') +
    tile('Net (for tax)', money0(net), 'Revenue − expenses', true) +
    tile('Outstanding', money0(owed), (outstanding.data?.length || 0) + ' unpaid invoice(s)') +
    tile('New leads', String(newLeads), 'Waiting to be handled');

  $('dashRecent').innerHTML = (recent.data && recent.data.length)
    ? `<table class="tbl"><tbody>${recent.data.map((r) => `<tr>
        <td><strong>${esc(r.number || '—')}</strong></td><td>${esc(r.customer_name)}</td>
        <td class="muted">${esc(fmtDate(r.paid_at))}</td><td class="num">${money(r.total)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted" style="font-size:14px">No paid invoices yet.</p>';
}
