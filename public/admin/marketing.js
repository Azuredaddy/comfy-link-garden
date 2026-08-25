// Marketing tab — opted-in subscribers (consent-logged) + send a broadcast.
// Only people who ticked the consent box on the quote form appear here.
import { $, el, esc, fmt, fmtDate, supabase, toast, apiFetch } from './lib.js';

export async function load() {
  $('tab-marketing').innerHTML = `
    <div class="banner">✅ Everyone here <strong>ticked the opt-in box</strong> on the quote form (consent + date/time/IP logged). People who only asked for a quote are never added.</div>
    <div class="card">
      <div class="card-head"><h2>Send a broadcast</h2></div>
      <label>Subject</label>
      <input id="bcSubject" placeholder="e.g. 20% off rubbish removal this month">
      <label>Message</label>
      <textarea id="bcBody" rows="7" placeholder="Write your offer here. Line breaks are kept. An unsubscribe link is added automatically."></textarea>
      <div class="row" style="margin-top:12px">
        <button id="bcSend">Send to all subscribers</button>
        <button id="bcTest" class="ghost">Send test to me</button>
        <span class="muted" id="bcCount"></span>
      </div>
    </div>
    <div class="card" style="padding:0;overflow:auto">
      <table class="tbl"><thead><tr>
        <th>Email</th><th>Name</th><th>Opted in</th><th>Consent IP</th><th>Status</th><th></th>
      </tr></thead><tbody id="bcRows"></tbody></table>
    </div>`;

  $('bcSend').addEventListener('click', () => send(false));
  $('bcTest').addEventListener('click', () => send(true));
  await refresh();
}

async function send(test) {
  const subject = $('bcSubject').value.trim();
  const message = $('bcBody').value.trim();
  if (!subject || !message) { toast('Add a subject and message.', 'bad'); return; }

  let body = { subject, message };
  if (test) {
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email) { toast('Could not find your email.', 'bad'); return; }
    body.test_to = data.user.email;
  } else if (!window.confirm('Send this to all subscribers?')) {
    return;
  }

  const btn = test ? $('bcTest') : $('bcSend');
  btn.disabled = true; const label = btn.textContent; btn.textContent = 'Sending…';
  try {
    const res = await apiFetch('/api/admin/broadcast', { body });
    toast(res.message || `Sent to ${res.sent}${res.failed ? ` · ${res.failed} failed` : ''}`);
  } catch (err) {
    toast(err.message, 'bad');
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}

async function refresh() {
  const { data, error } = await supabase.from('marketing_subscribers').select('*').order('consented_at', { ascending: false }).limit(1000);
  const rows = $('bcRows');
  if (error) { rows.innerHTML = `<tr><td colspan="6" class="err">${esc(error.message)}</td></tr>`; return; }
  const active = data.filter((s) => !s.unsubscribed_at).length;
  $('bcCount').textContent = `${active} subscribed · ${data.length} total`;
  if (!data.length) { rows.innerHTML = `<tr><td colspan="6" class="muted">No subscribers yet. They appear here when someone ticks the opt-in box on a quote.</td></tr>`; return; }

  rows.innerHTML = '';
  for (const s of data) {
    const tr = el(`<tr>
      <td>${esc(s.email)}</td>
      <td>${esc(s.name || '—')}</td>
      <td class="muted">${esc(fmtDate(s.consented_at))}</td>
      <td class="muted" style="font-family:var(--f-mono);font-size:12px">${esc(s.consent_ip || '—')}</td>
      <td>${s.unsubscribed_at ? '<span class="pill void">unsubscribed</span>' : '<span class="pill paid">subscribed</span>'}</td>
      <td class="num"></td></tr>`);
    const del = el('<button class="danger sm">Delete</button>');
    del.addEventListener('click', async () => {
      if (!window.confirm('Delete this subscriber?')) return;
      const { error } = await supabase.from('marketing_subscribers').delete().eq('id', s.id);
      if (error) { toast(error.message, 'bad'); return; }
      toast('Deleted'); refresh();
    });
    tr.children[5].appendChild(del);
    rows.appendChild(tr);
  }
}
