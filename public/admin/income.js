// Income tab — "other" income (Airtasker, cash jobs, etc.) added manually or
// imported from an Excel/CSV file. Feeds the Dashboard and Reports totals.
import {
  $, el, esc, money, fmtDate, supabase, toast, todayISO,
  currentFyStart, fyRange, monthRange,
} from './lib.js';

let period = 'fy';

export async function load() {
  const fy = currentFyStart();
  $('tab-income').innerHTML = `
    <div class="card">
      <div class="spread"><strong>Add income</strong></div>
      <div class="row" style="align-items:flex-end;margin-top:6px">
        <div style="width:150px"><label>Date</label><input id="inDate" type="date" value="${todayISO()}"></div>
        <div style="width:170px"><label>Source</label><input id="inSource" placeholder="e.g. Airtasker"></div>
        <div class="grow" style="min-width:160px"><label>Description</label><input id="inDesc" placeholder="optional"></div>
        <div style="width:130px"><label>Amount $</label><input id="inAmount" inputmode="decimal" placeholder="0.00"></div>
        <button id="inAdd">Add</button>
      </div>
    </div>

    <div class="card">
      <div class="spread"><strong>Import from Excel / CSV</strong></div>
      <p class="cap" style="margin:4px 0 10px">Upload a spreadsheet of earnings. I'll look for <em>Date</em>, <em>Amount</em>, and (optionally) <em>Source</em> / <em>Description</em> columns.</p>
      <div class="row" style="align-items:center">
        <input id="inFile" type="file" accept=".xlsx,.xls,.csv" style="max-width:320px">
        <span class="cap" id="inFileMsg"></span>
      </div>
      <div id="inPreview" style="margin-top:12px"></div>
    </div>

    <div class="card spread">
      <div class="row">
        <label style="margin:0">Period</label>
        <select id="inPeriod" style="width:auto">
          <option value="fy">This financial year (FY ${fy}–${String(fy + 1).slice(2)})</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </select>
      </div>
      <span class="muted" id="inTotal"></span>
    </div>

    <div class="card" style="padding:0;overflow:auto">
      <table class="tbl"><thead><tr>
        <th>Date</th><th>Source</th><th>Description</th><th class="num">Amount</th><th></th>
      </tr></thead><tbody id="inRows"></tbody></table>
    </div>`;

  $('inPeriod').value = period;
  $('inPeriod').addEventListener('change', (e) => { period = e.target.value; refresh(); });
  $('inAdd').addEventListener('click', addOne);
  $('inFile').addEventListener('change', handleFile);
  await refresh();
}

async function addOne() {
  const amount = parseFloat($('inAmount').value);
  if (!amount || amount <= 0) { toast('Enter an amount.', 'bad'); return; }
  const btn = $('inAdd'); btn.disabled = true;
  const { error } = await supabase.from('other_income').insert({
    income_date: $('inDate').value || todayISO(),
    source: $('inSource').value.trim() || null,
    description: $('inDesc').value.trim() || null,
    amount,
  });
  btn.disabled = false;
  if (error) { toast(error.message, 'bad'); return; }
  $('inSource').value = ''; $('inDesc').value = ''; $('inAmount').value = '';
  toast('Income added'); refresh();
}

// ---- spreadsheet import ---------------------------------------------------
const norm = (s) => String(s || '').trim().toLowerCase();
const DATE_KEYS = ['date', 'income date', 'paid', 'payment date', 'when', 'day', 'transaction date'];
const AMOUNT_KEYS = ['amount', 'income', 'total', 'earnings', 'earning', 'value', 'paid', 'net', 'payout', 'amount ($)', '$',
  'task amount', 'task amount ex gst', 'transaction amount', 'transaction amount (task unrelated)', 'gross', 'gross amount', 'amount paid'];
const SOURCE_KEYS = ['source', 'from', 'platform', 'client', 'type', 'category', 'account', 'statement descriptor', 'transaction type'];
const DESC_KEYS = ['description', 'details', 'note', 'notes', 'job', 'task', 'title', 'memo', 'task name', 'invoice number'];

function pick(row, keys) {
  for (const k of Object.keys(row)) if (keys.includes(norm(k))) return row[k];
  return null;
}
function toISO(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
function toAmount(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v || '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

let parsedRows = [];
async function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  $('inFileMsg').textContent = 'Reading…';
  try {
    const XLSX = await import('https://esm.sh/xlsx@0.18.5');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!raw.length) { $('inFileMsg').textContent = 'That sheet looks empty.'; return; }

    const looksAirtasker = Object.keys(raw[0] || {}).some((k) => norm(k).startsWith('task'));
    parsedRows = raw.map((r) => ({
      income_date: toISO(pick(r, DATE_KEYS)) || todayISO(),
      source: (pick(r, SOURCE_KEYS) || '').toString().trim() || (looksAirtasker ? 'Airtasker' : null),
      description: (pick(r, DESC_KEYS) || '').toString().trim() || null,
      amount: toAmount(pick(r, AMOUNT_KEYS)),
    })).filter((r) => r.amount > 0);

    if (!parsedRows.length) {
      $('inFileMsg').textContent = '';
      $('inPreview').innerHTML = `<p class="err" style="font-size:13px">Couldn't find an amount column. Columns found: ${esc(Object.keys(raw[0]).join(', '))}. Rename one to “Amount” and try again.</p>`;
      return;
    }
    const total = parsedRows.reduce((s, r) => s + r.amount, 0);
    $('inFileMsg').textContent = `${parsedRows.length} rows · ${money(total)}`;
    $('inPreview').innerHTML = `
      <div class="cap" style="margin-bottom:6px">Preview (first 5 rows):</div>
      <table class="tbl" style="border:1px solid var(--line);border-radius:10px">
        <thead><tr><th>Date</th><th>Source</th><th>Description</th><th class="num">Amount</th></tr></thead>
        <tbody>${parsedRows.slice(0, 5).map((r) => `<tr><td>${esc(fmtDate(r.income_date))}</td><td>${esc(r.source || '—')}</td><td>${esc(r.description || '—')}</td><td class="num">${money(r.amount)}</td></tr>`).join('')}</tbody>
      </table>
      <button id="inImport" style="margin-top:12px">Import ${parsedRows.length} rows (${money(total)})</button>`;
    $('inImport').addEventListener('click', doImport);
  } catch (err) {
    console.error(err);
    $('inFileMsg').textContent = '';
    $('inPreview').innerHTML = `<p class="err" style="font-size:13px">Could not read that file: ${esc(err.message || err)}</p>`;
  }
}

async function doImport() {
  if (!parsedRows.length) return;
  const btn = $('inImport'); btn.disabled = true; btn.textContent = 'Importing…';
  const { error } = await supabase.from('other_income').insert(parsedRows);
  if (error) { toast(error.message, 'bad'); btn.disabled = false; btn.textContent = 'Import'; return; }
  toast(`Imported ${parsedRows.length} income rows`);
  parsedRows = []; $('inFile').value = ''; $('inFileMsg').textContent = ''; $('inPreview').innerHTML = '';
  refresh();
}

// ---- list -----------------------------------------------------------------
async function refresh() {
  let q = supabase.from('other_income').select('*').order('income_date', { ascending: false }).limit(1000);
  if (period === 'fy') { const { from, to } = fyRange(currentFyStart()); q = q.gte('income_date', from).lte('income_date', to); }
  if (period === 'month') { const { from, to } = monthRange(); q = q.gte('income_date', from).lte('income_date', to); }
  const { data, error } = await q;
  const rows = $('inRows');
  if (error) { rows.innerHTML = `<tr><td colspan="5" class="err">${esc(error.message)}</td></tr>`; return; }

  const total = data.reduce((s, r) => s + Number(r.amount || 0), 0);
  $('inTotal').textContent = `${data.length} item${data.length === 1 ? '' : 's'} · ${money(total)}`;
  if (!data.length) { rows.innerHTML = `<tr><td colspan="5" class="muted">No other income in this period. Add one or import a spreadsheet above.</td></tr>`; return; }

  rows.innerHTML = '';
  for (const r of data) {
    const tr = el(`<tr>
      <td class="muted">${esc(fmtDate(r.income_date))}</td>
      <td>${r.source ? `<span class="pill">${esc(r.source)}</span>` : '—'}</td>
      <td>${esc(r.description || '—')}</td>
      <td class="num">${money(r.amount)}</td>
      <td class="num"></td></tr>`);
    const del = el('<button class="danger sm">Delete</button>');
    del.addEventListener('click', async () => {
      if (!window.confirm('Delete this income entry?')) return;
      const { error } = await supabase.from('other_income').delete().eq('id', r.id);
      if (error) { toast(error.message, 'bad'); return; }
      toast('Deleted'); refresh();
    });
    tr.children[4].appendChild(del);
    rows.appendChild(tr);
  }
}
