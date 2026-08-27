// Leads tab — inbound quote_requests. Clickable rows open a detail drawer with
// click-to-call, internal notes, handled toggle, a portal reply, and a
// "create quote from this lead" shortcut.
import { $, el, esc, fmt, fmtDate, supabase, toast, openOverlay, apiFetch } from './lib.js';
import { openQuoteEditor } from './quotes.js';

let filter = 'open';

export async function unhandledCount() {
  const { count } = await supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('handled', false);
  return count ?? 0;
}

export async function load() {
  const root = $('tab-leads');
  root.innerHTML = `
    <div class="banner">📞 You always ring customers to book them in — tap a phone number in a lead to call straight away.</div>
    <div class="card spread">
      <div class="row">
        <label style="margin:0">Show</label>
        <select id="ldFilter" style="width:auto">
          <option value="open">New / unhandled</option>
          <option value="all">All leads</option>
          <option value="handled">Handled</option>
        </select>
      </div>
      <span class="muted" id="ldCount"></span>
    </div>
    <div class="card" style="padding:0;overflow:auto">
      <table class="tbl"><thead><tr>
        <th>Name</th><th>Suburb</th><th>Service</th><th>Phone</th><th>When</th><th>Status</th>
      </tr></thead><tbody id="ldRows"></tbody></table>
    </div>`;
  $('ldFilter').value = filter;
  $('ldFilter').addEventListener('change', (e) => { filter = e.target.value; refresh(); });
  await refresh();
}

async function refresh() {
  let q = supabase.from('quote_requests').select('*').order('created_at', { ascending: false }).limit(300);
  if (filter === 'open') q = q.eq('handled', false);
  if (filter === 'handled') q = q.eq('handled', true);
  const { data, error } = await q;
  const rows = $('ldRows');
  if (error) { rows.innerHTML = `<tr><td colspan="6" class="err">${esc(error.message)}</td></tr>`; return; }
  $('ldCount').textContent = `${data.length} lead${data.length === 1 ? '' : 's'}`;
  if (!data.length) { rows.innerHTML = `<tr><td colspan="6" class="muted">No leads here yet.</td></tr>`; return; }
  rows.innerHTML = '';
  for (const q of data) {
    const failed = q.notification_error && !q.notified_at;
    const tr = el(`<tr class="clickable">
      <td><strong>${esc(q.name)}</strong>${failed ? ' <span class="pill failed">email alert failed</span>' : ''}</td>
      <td>${esc(q.suburb || '—')}</td>
      <td>${esc(q.service || '—')}</td>
      <td>${q.phone ? esc(q.phone) : '—'}</td>
      <td class="muted">${esc(fmtDate(q.created_at))}</td>
      <td><span class="pill ${q.handled ? 'handled' : 'new'}">${q.handled ? 'Handled' : 'New'}</span></td>
    </tr>`);
    tr.addEventListener('click', () => openLead(q));
    rows.appendChild(tr);
  }
}

async function openLead(q) {
  const { data: msgs } = await supabase.from('messages').select('*')
    .eq('quote_request_id', q.id).order('created_at', { ascending: false }).limit(20);

  const view = el(`<div>
    <div class="spread"><h2>${esc(q.name)}</h2>
      <span class="pill ${q.handled ? 'handled' : 'new'}">${q.handled ? 'Handled' : 'New'}</span></div>
    <div class="muted">${esc(fmt(q.created_at))}</div>
    <dl class="kv">
      <dt>Phone</dt><dd>${q.phone ? `<a href="tel:${esc((q.phone || '').replace(/\s/g, ''))}">${esc(q.phone)}</a> <span class="muted">(tap to call)</span>` : '—'}</dd>
      <dt>Email</dt><dd>${q.email ? `<a href="mailto:${esc(q.email)}">${esc(q.email)}</a>` : '—'}</dd>
      <dt>Suburb</dt><dd>${esc(q.suburb || '—')}</dd>
      <dt>Service</dt><dd>${esc(q.service || '—')}</dd>
      <dt>Details</dt><dd>${esc(q.message || '—')}</dd>
      <dt>From page</dt><dd>${q.source_url ? `<a href="${esc(q.source_url)}" target="_blank" rel="noopener">${esc(q.source_url)}</a>` : '—'}</dd>
    </dl>

    <div class="row">
      <button id="ldQuote">＋ Create quote</button>
      <button id="ldHandled" class="ghost">${q.handled ? 'Mark as new' : 'Mark handled'}</button>
    </div>

    <label for="ldNotes">Internal notes</label>
    <textarea id="ldNotes" rows="2">${esc(q.admin_notes || '')}</textarea>
    <button id="ldSaveNotes" class="subtle sm" style="margin-top:8px">Save notes</button>

    <h3 style="margin:22px 0 6px;font-size:15px">Reply to customer</h3>
    <label for="rSubject">Subject</label>
    <input id="rSubject" value="Re: your enquiry with Lanky Services" />
    <label for="rBody">Message</label>
    <textarea id="rBody" rows="5" placeholder="Hi ${esc(q.name)}, thanks for getting in touch…"></textarea>
    <button id="ldReply" style="margin-top:10px" ${q.email ? '' : 'disabled title="No email address on this lead"'}>Send reply</button>
    ${q.email ? '' : '<p class="muted" style="font-size:13px">No email on file — give them a call instead.</p>'}

    <h3 style="margin:22px 0 6px;font-size:15px">History</h3>
    <div id="ldHistory"></div>

    <div class="divider" style="height:1px;background:var(--line);margin:22px 0 14px"></div>
    <button id="ldDelete" class="danger sm">Delete lead</button>
  </div>`);

  const close = openOverlay(view, 'drawer');

  const history = view.querySelector('#ldHistory');
  history.innerHTML = (msgs && msgs.length)
    ? msgs.map((m) => `<div class="card" style="margin:0 0 8px;padding:12px">
        <div class="spread"><strong style="font-size:14px">${esc(m.subject || '(no subject)')}</strong>
          <span class="pill ${m.email_status === 'failed' ? 'failed' : 'sent'}">${esc(m.email_status)}</span></div>
        <div class="muted" style="font-size:12px">${esc(fmt(m.created_at))} → ${esc(m.to_email || '')}</div>
        <div style="font-size:13px;margin-top:6px;white-space:pre-wrap">${esc(m.body || '')}</div></div>`).join('')
    : '<p class="muted" style="font-size:13px">No messages sent yet.</p>';

  view.querySelector('#ldQuote').addEventListener('click', () => { close(); openQuoteEditor({ lead: q }); });

  view.querySelector('#ldHandled').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const { error } = await supabase.from('quote_requests').update({ handled: !q.handled }).eq('id', q.id);
    if (error) { toast(error.message, 'bad'); e.target.disabled = false; return; }
    toast(q.handled ? 'Marked as new' : 'Marked handled');
    close(); await refresh();
  });

  view.querySelector('#ldSaveNotes').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const { error } = await supabase.from('quote_requests').update({ admin_notes: view.querySelector('#ldNotes').value }).eq('id', q.id);
    e.target.textContent = error ? 'Save failed' : 'Saved';
    if (error) toast(error.message, 'bad');
    setTimeout(() => { e.target.textContent = 'Save notes'; e.target.disabled = false; }, 1500);
  });

  view.querySelector('#ldDelete').addEventListener('click', async (e) => {
    if (!window.confirm(`Delete the lead from ${q.name}? This can't be undone.`)) return;
    e.target.disabled = true;
    const { error } = await supabase.from('quote_requests').delete().eq('id', q.id);
    if (error) { toast(error.message, 'bad'); e.target.disabled = false; return; }
    toast('Lead deleted');
    close(); await refresh();
  });

  view.querySelector('#ldReply').addEventListener('click', async (e) => {
    const subject = view.querySelector('#rSubject').value.trim();
    const message = view.querySelector('#rBody').value.trim();
    if (!subject || !message) { toast('Add a subject and message.', 'bad'); return; }
    e.target.disabled = true; e.target.textContent = 'Sending…';
    try {
      await apiFetch('/api/admin/reply', { body: { quote_request_id: q.id, subject, message } });
      toast('Reply sent to ' + q.email);
      close();
    } catch (err) {
      toast(err.message, 'bad');
      e.target.disabled = false; e.target.textContent = 'Send reply';
    }
  });
}
