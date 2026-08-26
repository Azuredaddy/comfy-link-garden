// Settings — business details used on quotes/invoices, the GST toggle, bank
// details for invoice payment, document number prefixes, and a placeholder for
// the Xero connection (added later via Lovable).
import { $, el, esc, supabase, toast, apiFetch, xeroStatus, myRole } from './lib.js';

export async function load() {
  const { data, error } = await supabase.from('business_settings').select('*').eq('id', 1).maybeSingle();
  if (error) { $('tab-settings').innerHTML = `<div class="card err">${esc(error.message)}</div>`; return; }
  const s = data || {};

  $('tab-settings').innerHTML = `
    <div id="usersCard"></div>
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

    <div class="card" id="xeroCard">
      <strong>Xero</strong>
      <p class="muted" style="font-size:13px;margin-top:6px">Checking connection…</p>
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

  handleXeroReturn();
  await renderXero();
  await renderUsers();
}

const ROLE_LABEL = { admin: 'Admin (full + users)', editor: 'Editor (full)', viewer: 'View only' };

async function renderUsers() {
  const card = $('usersCard');
  if (!card) return;
  const role = await myRole();
  if (role !== 'admin') { card.innerHTML = ''; return; } // only admins manage users

  const { data: me } = await supabase.auth.getUser();
  const myEmail = (me.user?.email || '').toLowerCase();
  let data;
  try { const res = await apiFetch('/api/admin/users', { method: 'GET' }); data = res.users; }
  catch (err) { card.innerHTML = `<div class="card err">${esc(err.message)}</div>`; return; }

  card.innerHTML = `<div class="card">
    <div class="card-head"><h2>Users &amp; access</h2></div>
    <p class="cap" style="margin-top:-6px">Add someone by email and pick their access. They sign in at this page with that email (first time: “Create account”).</p>
    <div class="row" style="align-items:flex-end;margin-top:8px">
      <div class="grow"><label>Email</label><input id="usEmail" type="email" placeholder="person@email.com"></div>
      <div style="width:190px"><label>Access</label><select id="usRole">
        <option value="viewer">View only</option><option value="editor">Editor (full)</option><option value="admin">Admin (full + users)</option>
      </select></div>
      <button id="usAdd">Add user</button>
    </div>
    <table class="tbl" style="margin-top:14px"><tbody id="usRows"></tbody></table>
  </div>`;

  const rows = $('usRows');
  rows.innerHTML = '';
  for (const u of (data || [])) {
    const isMe = u.email.toLowerCase() === myEmail;
    const tr = el(`<tr>
      <td>${esc(u.email)}${isMe ? ' <span class="muted">(you)</span>' : ''}</td>
      <td style="width:200px"></td>
      <td class="num" style="width:90px"></td></tr>`);
    const sel = el(`<select class="sm" style="width:auto;padding:6px 8px" ${isMe ? 'disabled title="You can\'t change your own role"' : ''}>
      ${['viewer', 'editor', 'admin'].map((r) => `<option value="${r}" ${r === (u.role || 'admin') ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>`);
    sel.addEventListener('change', async () => {
      try { await apiFetch('/api/admin/users', { body: { action: 'update', email: u.email, role: sel.value } }); toast(`${u.email} is now ${sel.value}`); }
      catch (err) { toast(err.message, 'bad'); }
    });
    tr.children[1].appendChild(sel);
    if (!isMe) {
      const del = el('<button class="danger sm">Remove</button>');
      del.addEventListener('click', async () => {
        if (!window.confirm(`Remove ${u.email}'s access?`)) return;
        try { await apiFetch('/api/admin/users', { body: { action: 'remove', email: u.email } }); toast('Access removed'); renderUsers(); }
        catch (err) { toast(err.message, 'bad'); }
      });
      tr.children[2].appendChild(del);
    }
    rows.appendChild(tr);
  }

  $('usAdd').addEventListener('click', async (e) => {
    const email = $('usEmail').value.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email.', 'bad'); return; }
    e.target.disabled = true;
    try {
      await apiFetch('/api/admin/users', { body: { action: 'add', email, role: $('usRole').value } });
      toast('User added'); $('usEmail').value = ''; renderUsers();
    } catch (err) { toast(err.message, 'bad'); }
    e.target.disabled = false;
  });
}

// Show a toast for the ?xero=... result after returning from Xero consent.
function handleXeroReturn() {
  const p = new URLSearchParams(location.search);
  const x = p.get('xero');
  if (!x) return;
  const msg = {
    connected: ['Xero connected ✓', 'ok'],
    denied: ['Xero connection was cancelled.', 'bad'],
    state: ['Xero connection expired — please try again.', 'bad'],
    error: ['Xero connection failed — check your app settings.', 'bad'],
  }[x];
  if (msg) toast(msg[0], msg[1]);
  history.replaceState(null, '', location.pathname);
}

async function renderXero() {
  const card = $('xeroCard');
  const s = await xeroStatus(true);

  if (!s.configured) {
    card.innerHTML = `<strong>Xero</strong>
      <p class="muted" style="font-size:13px;margin-top:6px">To connect Xero, add these secrets in Lovable, then reload:</p>
      <ul class="muted" style="font-size:13px;margin:6px 0 0 18px">
        <li><code>XERO_CLIENT_ID</code></li><li><code>XERO_CLIENT_SECRET</code></li>
        <li><code>XERO_REDIRECT_URI</code> — set to <code>${esc(location.origin)}/api/admin/xero/callback</code></li>
      </ul>
      <span class="pill" style="margin-top:10px;display:inline-block">Not configured</span>`;
    return;
  }

  if (!s.connected) {
    card.innerHTML = `<strong>Xero</strong>
      <p class="muted" style="font-size:13px;margin-top:6px">Connect your Xero organisation to import your business details and push quotes &amp; invoices.</p>
      <button id="xConnect" style="margin-top:8px">Connect Xero</button>`;
    $('xConnect').addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Redirecting…';
      try { const { url } = await apiFetch('/api/admin/xero/authorize-url'); location.href = url; }
      catch (err) { toast(err.message, 'bad'); e.target.disabled = false; e.target.textContent = 'Connect Xero'; }
    });
    return;
  }

  card.innerHTML = `<div class="spread"><strong>Xero</strong><span class="pill paid">Connected</span></div>
    <p class="muted" style="font-size:13px;margin-top:6px">Organisation: <strong style="color:var(--ink)">${esc(s.tenant_name || '—')}</strong></p>
    <div class="row" style="margin-top:8px">
      <button id="xImport" class="subtle">Import business details from Xero</button>
      <button id="xDisconnect" class="danger">Disconnect</button>
    </div>
    <p class="muted" style="font-size:12px;margin-top:8px">Once connected, open a quote/invoice and use “Push to Xero”.</p>`;

  $('xImport').addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Importing…';
    try {
      await apiFetch('/api/admin/xero/sync-settings');
      toast('Imported from Xero');
      load();
    } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; e.target.textContent = 'Import business details from Xero'; }
  });
  $('xDisconnect').addEventListener('click', async (e) => {
    if (!window.confirm('Disconnect Xero?')) return;
    e.target.disabled = true;
    try { await apiFetch('/api/admin/xero/disconnect'); toast('Xero disconnected'); renderXero(); }
    catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
  });
}
