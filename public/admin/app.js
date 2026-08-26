// Admin portal shell: auth gate, tab navigation, and per-tab lazy loading.
import { $, el, esc, supabase, toast, openOverlay, myRole } from './lib.js';
import * as dashboard from './dashboard.js';
import * as leads from './leads.js';
import * as jobs from './calendar.js';
import * as quotes from './quotes.js';
import * as invoices from './invoices.js';
import * as products from './products.js';
import * as photos from './photos.js';
import * as expenses from './expenses.js';
import * as income from './income.js';
import * as reports from './reports.js';
import * as marketing from './marketing.js';
import * as users from './users.js';
import * as settings from './settings.js';

const TABS = { dashboard, leads, jobs, quotes, invoices, products, photos, expenses, income, reports, marketing, users, settings };
const TITLES = {
  dashboard: 'Dashboard', leads: 'Leads', jobs: 'Jobs calendar', quotes: 'Quotes', invoices: 'Invoices',
  products: 'Price list', photos: 'Photos', expenses: 'Expenses', income: 'Other income', reports: 'Reports & tax', marketing: 'Marketing', users: 'Users & access', settings: 'Settings',
};
const _tabParam = new URLSearchParams(location.search).get('tab');
let current = (_tabParam && TABS[_tabParam]) ? _tabParam : 'dashboard';

function show(tab) {
  current = tab;
  for (const name of Object.keys(TABS)) {
    $('tab-' + name).classList.toggle('hidden', name !== tab);
  }
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  $('pageTitle').textContent = TITLES[tab];
  const side = $('side'); if (side) side.classList.remove('open');
  try { TABS[tab].load(); } catch (e) { console.error(e); toast('Failed to load ' + tab, 'bad'); }
}

// ---- session / gate -------------------------------------------------------
async function render() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    $('gate').classList.remove('hidden');
    $('app').classList.add('hidden');
    return;
  }
  $('gate').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('who').textContent = user.email;
  paintAvatar(user);
  const role = await myRole(true);
  document.body.classList.toggle('role-viewer', role === 'viewer');
  const rl = $('roleLabel'); if (rl) rl.textContent = role === 'admin' ? 'Admin' : role === 'editor' ? 'Editor' : 'View only';
  const navUsers = $('navUsers');
  if (navUsers) navUsers.classList.toggle('hidden', role !== 'admin');
  if (role !== 'admin' && current === 'users') current = 'dashboard';
  const av = $('avatar');
  if (av && !av.dataset.wired) {
    av.dataset.wired = '1';
    av.style.cursor = 'pointer';
    av.title = 'Edit your profile';
    av.addEventListener('click', () => openProfile());
  }
  show(current);
  // update the Leads badge in the background
  leads.unhandledCount().then((n) => {
    const b = $('leadsBadge');
    if (n > 0) { b.textContent = n; b.classList.remove('hidden'); } else { b.classList.add('hidden'); }
  }).catch(() => {});
}

// ---- nav ------------------------------------------------------------------
$('nav').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-tab]');
  if (!a) return;
  e.preventDefault();
  show(a.dataset.tab);
});
$('refresh').addEventListener('click', () => render());
const menuBtn = $('menuBtn');
if (menuBtn) menuBtn.addEventListener('click', () => $('side').classList.toggle('open'));

// ---- auth actions (ported from the original admin page) -------------------
const authMsg = $('authMsg');
$('signin').addEventListener('click', async () => {
  authMsg.textContent = '';
  const { error } = await supabase.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
  if (error) authMsg.textContent = error.message; else render();
});
$('signup').addEventListener('click', async () => {
  authMsg.textContent = '';
  const email = $('email').value.trim(), password = $('password').value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) { authMsg.textContent = error.message; return; }
  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
  if (e2) authMsg.textContent = e2.message; else render();
});
$('forgot').addEventListener('click', async () => {
  authMsg.style.color = ''; authMsg.textContent = '';
  const email = $('email').value.trim();
  if (!email) { authMsg.textContent = 'Enter your email address first.'; return; }
  $('forgot').disabled = true;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password.html' });
  $('forgot').disabled = false;
  if (error) { authMsg.textContent = error.message; return; }
  authMsg.style.color = '#a3e635';
  authMsg.textContent = 'Reset link sent — check your inbox (and spam).';
});
$('signout').addEventListener('click', async () => { await supabase.auth.signOut(); render(); });

function paintAvatar(user) {
  const av = $('avatar'); if (!av) return;
  const url = user?.user_metadata?.avatar_url;
  const name = user?.user_metadata?.display_name || user?.email || 'M';
  if (url) av.innerHTML = `<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  else av.textContent = name.trim()[0].toUpperCase();
}

async function openProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const meta = user.user_metadata || {};
  const view = el(`<div>
    <h2>Your profile</h2>
    <div style="display:flex;align-items:center;gap:14px;margin:14px 0">
      <div id="pfAv" style="width:64px;height:64px;border-radius:50%;background:var(--raised);display:grid;place-items:center;overflow:hidden;color:var(--lime);font-family:var(--f-display);font-weight:700;font-size:24px"></div>
      <div class="grow"><label style="margin-top:0">Profile picture</label><input id="pfFile" type="file" accept="image/*"></div>
    </div>
    <label>Display name</label><input id="pfName" value="${esc(meta.display_name || '')}" placeholder="e.g. Matt">
    <label>Email</label><input value="${esc(user.email || '')}" disabled>
    <button id="pfSave" style="margin-top:14px">Save profile</button>
    <div style="height:1px;background:var(--line);margin:22px 0 14px"></div>
    <h3 style="font-size:15px">Change password</h3>
    <label>New password</label><input id="pfPw" type="password" autocomplete="new-password" placeholder="At least 6 characters">
    <label>Confirm password</label><input id="pfPw2" type="password" autocomplete="new-password">
    <div class="row" style="margin-top:12px"><button id="pfPwSave" class="subtle">Update password</button><button id="pfClose" class="ghost right">Close</button></div>
  </div>`);
  const close = openOverlay(view, 'modal', { dismissible: false });
  const pav = view.querySelector('#pfAv');
  const setPrev = (url, initial) => { pav.innerHTML = url ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover">` : esc(initial); };
  setPrev(meta.avatar_url, (meta.display_name || user.email || 'M').trim()[0].toUpperCase());
  view.querySelector('#pfClose').addEventListener('click', () => close());
  view.querySelector('#pfFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) setPrev(URL.createObjectURL(f)); });

  view.querySelector('#pfSave').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      let avatar_url = meta.avatar_url;
      const f = view.querySelector('#pfFile').files[0];
      if (f) {
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user.id}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from('avatars').upload(path, f, { upsert: true });
        if (up.error) throw up.error;
        avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.auth.updateUser({ data: { display_name: view.querySelector('#pfName').value.trim(), avatar_url } });
      if (error) throw error;
      toast('Profile saved'); close();
      const { data: { user: u2 } } = await supabase.auth.getUser(); paintAvatar(u2);
    } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
  });

  view.querySelector('#pfPwSave').addEventListener('click', async (e) => {
    const pw = view.querySelector('#pfPw').value, pw2 = view.querySelector('#pfPw2').value;
    if (pw.length < 6) { toast('Password must be at least 6 characters.', 'bad'); return; }
    if (pw !== pw2) { toast('Passwords do not match.', 'bad'); return; }
    e.target.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast(error.message, 'bad'); e.target.disabled = false; return; }
    toast('Password updated'); view.querySelector('#pfPw').value = ''; view.querySelector('#pfPw2').value = ''; e.target.disabled = false;
  });
}

// expose a couple of cross-tab helpers used by dashboard shortcuts
window.LANKY = { go: show };

render();
