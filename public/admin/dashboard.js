// Dashboard — headline numbers, a 12-month revenue chart, and what needs action.
import {
  $, esc, money0, money, supabase, fmtDate,
  currentFyStart, fyRange, monthRange, todayISO,
} from './lib.js';

const sum = (rows, k) => (rows || []).reduce((s, r) => s + Number(r[k] || 0), 0);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function load() {
  const root = $('tab-dashboard');
  root.innerHTML = `
    <div class="tiles" id="dashTiles"></div>
    <div class="grid2">
      <div class="card">
        <div class="card-head"><div><h2>Revenue by month</h2><div class="cap">Paid invoices · last 12 months</div></div></div>
        <div class="chart" id="dashChart"></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Needs attention</h2></div>
        <div id="dashAttn"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Upcoming jobs</h2><a onclick="LANKY.go('jobs')">Calendar →</a></div>
      <div id="dashJobs"></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Recent paid invoices</h2></div>
      <div id="dashRecent"></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Quick actions</h2></div>
      <div class="row">
        <button onclick="LANKY.go('quotes')">＋ New quote</button>
        <button class="subtle" onclick="LANKY.go('invoices')">＋ New invoice</button>
        <button class="subtle" onclick="LANKY.go('expenses')">＋ Add expense</button>
        <button class="ghost" onclick="LANKY.go('leads')">View leads</button>
      </div>
    </div>`;

  const fy = currentFyStart();
  const fyR = fyRange(fy);
  const m = monthRange();
  const twelveAgo = new Date(); twelveAgo.setMonth(twelveAgo.getMonth() - 11); twelveAgo.setDate(1);
  const today = todayISO();

  const [paidFy, paidMonth, expFy, outstanding, leads, recent, paid12, overdue, failed, otherFy, otherMonth, jobsUp] = await Promise.all([
    supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', fyR.from + 'T00:00:00').lte('paid_at', fyR.to + 'T23:59:59'),
    supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', m.from + 'T00:00:00').lte('paid_at', m.to + 'T23:59:59'),
    supabase.from('expenses').select('amount').gte('expense_date', fyR.from).lte('expense_date', fyR.to),
    supabase.from('invoices').select('total').in('status', ['sent', 'overdue']),
    supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('handled', false),
    supabase.from('invoices').select('number,customer_name,total,paid_at').eq('status', 'paid').order('paid_at', { ascending: false }).limit(5),
    supabase.from('invoices').select('total,paid_at').eq('status', 'paid').gte('paid_at', twelveAgo.toISOString()),
    supabase.from('invoices').select('number,customer_name,total,due_date,status').in('status', ['sent', 'overdue']).order('due_date', { ascending: true }).limit(20),
    supabase.from('quote_requests').select('name,suburb').not('notification_error', 'is', null).is('notified_at', null).limit(5),
    supabase.from('other_income').select('amount').gte('income_date', fyR.from).lte('income_date', fyR.to),
    supabase.from('other_income').select('amount').gte('income_date', m.from).lte('income_date', m.to),
    supabase.from('jobs').select('title,job_date,job_time,suburb,status').gte('job_date', today).neq('status', 'cancelled').order('job_date', { ascending: true }).order('job_time', { ascending: true }).limit(6),
  ]);

  const revFy = sum(paidFy.data, 'total');
  const revMonth = sum(paidMonth.data, 'total');
  const otherFyTotal = sum(otherFy.data, 'amount');
  const otherMonthTotal = sum(otherMonth.data, 'amount');
  const totalIncomeFy = revFy + otherFyTotal;
  const expenses = sum(expFy.data, 'amount');
  const owed = sum(outstanding.data, 'total');
  const newLeads = leads.count ?? 0;
  const fyLbl = fy + '–' + String(fy + 1).slice(2);

  const tile = (k, v, s, accent) => `<div class="tile ${accent ? 'accent' : ''}">
    <div class="k">${esc(k)}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`;
  $('dashTiles').innerHTML =
    tile('Income this month', money0(revMonth + otherMonthTotal), new Date().toLocaleDateString('en-AU', { month: 'long' }) + ' · invoices + other', true) +
    tile('Total income FY ' + fyLbl, money0(totalIncomeFy), `Invoices ${money0(revFy)} · Other ${money0(otherFyTotal)}`, true) +
    tile('Expenses FY ' + fyLbl, money0(expenses), 'Deductible spend') +
    tile('Net for tax', money0(totalIncomeFy - expenses), 'Income − expenses', true) +
    tile('Outstanding', money0(owed), (outstanding.data?.length || 0) + ' unpaid invoice(s)') +
    tile('New leads', String(newLeads), 'Waiting to be called');

  // ---- 12-month revenue chart ----
  const buckets = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); buckets.push({ y: d.getFullYear(), m: d.getMonth(), total: 0 }); }
  for (const inv of (paid12.data || [])) {
    if (!inv.paid_at) continue;
    const d = new Date(inv.paid_at);
    const b = buckets.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
    if (b) b.total += Number(inv.total || 0);
  }
  const max = Math.max(1, ...buckets.map((b) => b.total));
  $('dashChart').innerHTML = buckets.map((b, i) => `<div class="bar ${i === 11 ? 'on' : ''}" title="${MONTHS[b.m]} — ${money(b.total)}">
    <div class="col" style="height:${Math.max(2, Math.round(b.total / max * 100))}%"></div><small>${MONTHS[b.m]}</small></div>`).join('');

  // ---- needs attention ----
  const items = [];
  for (const inv of (overdue.data || [])) {
    if (inv.due_date && inv.due_date < today) items.push(['var(--warn)', `<b>${esc(inv.number || 'Invoice')}</b> is overdue`, `${esc(inv.customer_name)} · ${money(inv.total)} · due ${fmtDate(inv.due_date)}`]);
  }
  for (const f of (failed.data || [])) items.push(['var(--bad)', 'Email alert failed on a lead', `${esc(f.name)}${f.suburb ? ' · ' + esc(f.suburb) : ''} · resend from Leads`]);
  if (newLeads > 0) items.push(['var(--lime)', `${newLeads} new lead${newLeads === 1 ? '' : 's'} to call back`, 'Open the Leads tab']);

  $('dashAttn').innerHTML = items.length
    ? items.slice(0, 6).map(([c, t, s]) => `<div class="attn-item"><span class="dot" style="background:${c}"></span><div><p>${t}</p><small>${s}</small></div></div>`).join('')
    : '<p class="cap">All caught up — nothing needs attention. 🎉</p>';

  // ---- recent paid ----
  $('dashRecent').innerHTML = (recent.data && recent.data.length)
    ? `<table class="tbl"><tbody>${recent.data.map((r) => `<tr>
        <td><strong class="num">${esc(r.number || '—')}</strong></td><td>${esc(r.customer_name)}</td>
        <td class="muted">${esc(fmtDate(r.paid_at))}</td><td class="num">${money(r.total)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="cap">No paid invoices yet.</p>';

  $('dashJobs').innerHTML = (jobsUp.data && jobsUp.data.length)
    ? `<table class="tbl"><tbody>${jobsUp.data.map((j) => `<tr>
        <td style="width:140px" class="muted">${esc(fmtDate(j.job_date))}${j.job_time ? ' · ' + esc(j.job_time.slice(0, 5)) : ''}</td>
        <td><strong>${esc(j.title)}</strong>${j.suburb ? ` <span class="muted">· ${esc(j.suburb)}</span>` : ''}</td>
        <td><span class="pill ${j.status === 'completed' ? 'paid' : 'sent'}">${esc(j.status)}</span></td></tr>`).join('')}</tbody></table>`
    : '<p class="cap">No upcoming jobs. Add them on the Jobs calendar.</p>';
}
