// Jobs tab — a month calendar of booked work (word-of-mouth, returning
// clients, etc.) plus an upcoming list. Click a day to add, a job to edit.
import { $, el, esc, money, fmtDate, supabase, toast, openOverlay, todayISO, apiFetch } from './lib.js';

const SOURCES = ['Word of mouth', 'Returning client', 'Website lead', 'Airtasker', 'Phone', 'Other'];
const STATUSES = ['booked', 'completed', 'cancelled'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const now = new Date();
let vy = now.getFullYear();
let vm = now.getMonth();

export async function load() {
  $('tab-jobs').innerHTML = `
    <div class="card">
      <div class="cal-head">
        <button class="ghost sm" id="calPrev">‹</button>
        <button class="ghost sm" id="calNext">›</button>
        <h2 id="calLabel"></h2>
        <button class="subtle sm" id="calToday">Today</button>
        <button id="calRemind" class="ghost sm">✉ Email tomorrow's jobs</button>
        <button id="calSync" class="ghost sm">📅 Sync to phone</button>
        <button id="calAdd" class="right">＋ Add job</button>
      </div>
      <div class="cal" id="calDows">${DOW.map((d) => `<div class="dow">${d}</div>`).join('')}</div>
      <div class="cal" id="calGrid" style="margin-top:6px"></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Upcoming jobs</h2></div>
      <div id="calUpcoming"></div>
    </div>`;

  $('calPrev').addEventListener('click', () => { vm--; if (vm < 0) { vm = 11; vy--; } render(); });
  $('calNext').addEventListener('click', () => { vm++; if (vm > 11) { vm = 0; vy++; } render(); });
  $('calToday').addEventListener('click', () => { vy = now.getFullYear(); vm = now.getMonth(); render(); });
  $('calAdd').addEventListener('click', () => openJob(null, todayISO()));
  $('calSync').addEventListener('click', openSync);
  $('calRemind').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const r = await apiFetch('/api/cron/job-reminders', { method: 'GET' });
      toast(r.jobs ? `${r.jobs} job(s) tomorrow — ${r.emailed ? 'reminder emailed' : 'email failed'}` : 'No booked jobs tomorrow.');
    } catch (err) { toast(err.message, 'bad'); }
    e.target.disabled = false;
  });
  await render();
}

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

async function render() {
  $('calLabel').textContent = `${MON[vm]} ${vy}`;
  const first = iso(vy, vm, 1);
  const last = iso(vy, vm, new Date(vy, vm + 1, 0).getDate());

  const [monthJobs, upcoming] = await Promise.all([
    supabase.from('jobs').select('*').gte('job_date', first).lte('job_date', last),
    supabase.from('jobs').select('*').gte('job_date', todayISO()).neq('status', 'cancelled').order('job_date', { ascending: true }).order('job_time', { ascending: true }).limit(12),
  ]);

  const byDay = {};
  for (const j of (monthJobs.data || [])) (byDay[j.job_date] = byDay[j.job_date] || []).push(j);

  // build grid (Mon-first)
  const firstDow = (new Date(vy, vm, 1).getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const today = todayISO();
  const grid = $('calGrid');
  grid.innerHTML = '';
  for (const d of cells) {
    if (d === null) { grid.appendChild(el('<div class="cal-day other"></div>')); continue; }
    const ds = iso(vy, vm, d);
    const jobs = (byDay[ds] || []).sort((a, b) => (a.job_time || '').localeCompare(b.job_time || ''));
    const cell = el(`<div class="cal-day ${ds === today ? 'today' : ''}"><div class="dn">${d}</div></div>`);
    for (const j of jobs.slice(0, 4)) {
      const chip = el(`<div class="job-chip ${esc(j.status)}" title="${esc(j.title)}${j.job_time ? ' · ' + j.job_time.slice(0, 5) : ''}">${j.job_time ? esc(j.job_time.slice(0, 5)) + ' ' : ''}${esc(j.title)}</div>`);
      chip.addEventListener('click', (e) => { e.stopPropagation(); openJob(j); });
      cell.appendChild(chip);
    }
    if (jobs.length > 4) cell.appendChild(el(`<div class="dn">+${jobs.length - 4} more</div>`));
    cell.addEventListener('click', () => openJob(null, ds));
    grid.appendChild(cell);
  }

  // upcoming list
  const up = $('calUpcoming');
  up.innerHTML = (upcoming.data && upcoming.data.length)
    ? `<table class="tbl"><tbody>${upcoming.data.map((j) => `<tr class="clickable" data-job="${j.id}">
        <td style="width:130px" class="muted">${esc(fmtDate(j.job_date))}${j.job_time ? ' · ' + esc(j.job_time.slice(0, 5)) : ''}</td>
        <td><strong>${esc(j.title)}</strong>${j.suburb ? ` <span class="muted">· ${esc(j.suburb)}</span>` : ''}</td>
        <td>${j.source ? `<span class="pill">${esc(j.source)}</span>` : ''}</td>
        <td class="num">${j.amount != null ? money(j.amount) : ''}</td>
        <td><span class="pill ${j.status === 'completed' ? 'paid' : j.status === 'cancelled' ? 'void' : 'sent'}">${esc(j.status)}</span></td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="cap">No upcoming jobs. Click a day on the calendar to add one.</p>';
  up.querySelectorAll('[data-job]').forEach((tr) => {
    const j = (upcoming.data || []).find((x) => x.id === tr.dataset.job);
    tr.addEventListener('click', () => openJob(j));
  });
}

async function openSync() {
  const { data } = await supabase.from('business_settings').select('ical_token').eq('id', 1).maybeSingle();
  const token = data?.ical_token;
  if (!token) { toast('Calendar sync not ready yet — try again after the next update.', 'bad'); return; }
  const url = `${location.origin}/api/calendar/feed?token=${token}`;
  const view = el(`<div>
    <h2>Sync jobs to your phone</h2>
    <p class="cap" style="margin:6px 0 12px">Add this private link to Google Calendar and your booked jobs show up on your phone — updating automatically.</p>
    <label>Your private calendar link</label>
    <input id="syncUrl" value="${esc(url)}" readonly>
    <div class="row" style="margin-top:10px"><button id="syncCopy">Copy link</button><button id="syncClose" class="ghost">Close</button></div>
    <div style="height:1px;background:var(--line);margin:16px 0"></div>
    <strong style="font-size:14px">How to add it (once, on a computer)</strong>
    <ol class="cap" style="margin:8px 0 0 18px;line-height:1.8">
      <li>Open <a href="https://calendar.google.com" target="_blank" rel="noopener">Google Calendar</a>.</li>
      <li>Left side → <strong>Other calendars</strong> → <strong>+</strong> → <strong>From URL</strong>.</li>
      <li>Paste the link above → <strong>Add calendar</strong>.</li>
      <li>It appears on your phone's Google Calendar within a few minutes. Keep the link private.</li>
    </ol></div>`);
  const close = openOverlay(view, 'modal');
  view.querySelector('#syncClose').addEventListener('click', () => close());
  view.querySelector('#syncUrl').addEventListener('focus', (e) => e.target.select());
  view.querySelector('#syncCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch { const i = view.querySelector('#syncUrl'); i.focus(); i.select(); }
  });
}

function openJob(job, dateStr) {
  const j = job || { title: '', customer_phone: '', suburb: '', description: '', job_date: dateStr || todayISO(), job_time: '', status: 'booked', source: 'Word of mouth', amount: '' };
  const view = el(`<div>
    <div class="spread"><h2>${job ? 'Edit job' : 'New job'}</h2>${job ? `<span class="pill ${j.status === 'completed' ? 'paid' : j.status === 'cancelled' ? 'void' : 'sent'}">${esc(j.status)}</span>` : ''}</div>
    <label>Customer / job title</label><input id="jTitle" value="${esc(j.title || '')}" placeholder="e.g. Dave — garage clean-out">
    <div class="row">
      <div class="grow"><label>Date</label><input id="jDate" type="date" value="${esc(j.job_date)}"></div>
      <div style="width:130px"><label>Time</label><input id="jTime" type="time" value="${esc((j.job_time || '').slice(0, 5))}"></div>
    </div>
    <div class="row">
      <div class="grow"><label>Phone</label><input id="jPhone" value="${esc(j.customer_phone || '')}"></div>
      <div style="width:150px"><label>Suburb</label><input id="jSuburb" value="${esc(j.suburb || '')}"></div>
    </div>
    <div class="row">
      <div class="grow"><label>Customer email (for the booking confirmation)</label><input id="jEmail" type="email" value="${esc(j.customer_email || '')}" placeholder="name@example.com"></div>
    </div>
    <div class="row">
      <div class="grow"><label>Source</label><select id="jSource">${SOURCES.map((s) => `<option ${s === j.source ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div style="width:150px"><label>Status</label><select id="jStatus">${STATUSES.map((s) => `<option ${s === j.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div style="width:130px"><label>Amount $</label><input id="jAmount" inputmode="decimal" value="${j.amount != null ? j.amount : ''}" placeholder="optional"></div>
    </div>
    <label>Notes</label><textarea id="jDesc" rows="3">${esc(j.description || '')}</textarea>
    <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-weight:600">
      <input id="jConfirm" type="checkbox" style="width:auto;margin:0" ${job ? '' : 'checked'}>
      Email the customer a booking confirmation when I save
    </label>
    ${j.confirmation_sent_at ? `<div class="muted" style="font-size:12px;margin-top:4px">Confirmation sent ${new Date(j.confirmation_sent_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</div>` : ''}
    <div class="row" style="margin-top:16px">
      <button id="jSave">${job ? 'Save changes' : 'Add job'}</button>
      <button id="jSms" class="subtle">✉ Text confirmation</button>
      <button id="jCancel" class="ghost">Close</button>
      ${job ? '<button id="jDelete" class="danger" style="margin-left:auto">Delete</button>' : ''}
    </div>
  </div>`);
  const close = openOverlay(view, 'modal', { dismissible: false });
  view.querySelector('#jCancel').addEventListener('click', () => close());

  view.querySelector('#jSms').addEventListener('click', async (ev) => {
    const phone = view.querySelector('#jPhone').value.trim().replace(/\s+/g, '');
    if (!phone) { toast("Add the customer's phone number first.", 'bad'); return; }
    const name = (view.querySelector('#jTitle').value.trim().split(/[—-]/)[0] || '').trim();
    const date = view.querySelector('#jDate').value;
    const time = view.querySelector('#jTime').value;
    const suburb = view.querySelector('#jSuburb').value.trim();
    const dstr = date ? new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    const msg = `Hi ${name || 'there'}, confirming your booking with Lanky Services${dstr ? ' on ' + dstr : ''}${time ? ' at ' + time : ''}${suburb ? ' (' + suburb + ')' : ''}. Any questions call 0439 973 051. Thanks!`;
    const openDevice = () => { window.location.href = `sms:${phone}?body=${encodeURIComponent(msg)}`; };

    // Saved job → try sending automatically via Twilio; otherwise open Messages.
    if (job && job.id) {
      ev.target.disabled = true; ev.target.textContent = 'Sending…';
      try {
        const res = await apiFetch('/api/admin/job-confirm', { body: { job_id: job.id } });
        if (res.configured === false) openDevice();
        else toast('Confirmation text sent to the customer ✓');
      } catch (err) {
        toast(err.message + ' — opening your Messages instead', 'bad');
        openDevice();
      }
      ev.target.disabled = false; ev.target.textContent = '✉ Text confirmation';
    } else {
      openDevice();
    }
  });

  view.querySelector('#jSave').addEventListener('click', async (e) => {
    const title = view.querySelector('#jTitle').value.trim();
    if (!title) { toast('Add a customer / job title.', 'bad'); return; }
    const amt = parseFloat(view.querySelector('#jAmount').value);
    const email = view.querySelector('#jEmail').value.trim() || null;
    const wantsConfirm = view.querySelector('#jConfirm').checked;
    const payload = {
      title,
      customer_phone: view.querySelector('#jPhone').value.trim() || null,
      customer_email: email,
      suburb: view.querySelector('#jSuburb').value.trim() || null,
      description: view.querySelector('#jDesc').value.trim() || null,
      job_date: view.querySelector('#jDate').value || todayISO(),
      job_time: view.querySelector('#jTime').value || null,
      source: view.querySelector('#jSource').value,
      status: view.querySelector('#jStatus').value,
      amount: isNaN(amt) ? null : amt,
    };
    if (wantsConfirm && !email) { toast('Add a customer email, or untick the confirmation box.', 'bad'); return; }
    e.target.disabled = true;
    const res = job
      ? await supabase.from('jobs').update(payload).eq('id', j.id).select('id').single()
      : await supabase.from('jobs').insert(payload).select('id').single();
    if (res.error) { toast(res.error.message, 'bad'); e.target.disabled = false; return; }
    toast(job ? 'Job updated' : 'Job added');

    if (wantsConfirm && email) {
      try {
        await apiFetch('/api/admin/job-email-confirm', { body: { id: res.data.id } });
        toast('Confirmation emailed to ' + email);
      } catch (err) { toast('Job saved, but the email failed: ' + err.message, 'bad'); }
    }
    close(); render();
  });


  const del = view.querySelector('#jDelete');
  if (del) del.addEventListener('click', async () => {
    if (!window.confirm('Delete this job?')) return;
    const { error } = await supabase.from('jobs').delete().eq('id', j.id);
    if (error) { toast(error.message, 'bad'); return; }
    toast('Job deleted'); close(); render();
  });
}
