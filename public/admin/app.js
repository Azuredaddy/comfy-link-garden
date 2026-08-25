// Admin portal shell: auth gate, tab navigation, and per-tab lazy loading.
import { $, supabase, toast } from './lib.js';
import * as dashboard from './dashboard.js';
import * as leads from './leads.js';
import * as quotes from './quotes.js';
import * as invoices from './invoices.js';
import * as products from './products.js';
import * as expenses from './expenses.js';
import * as income from './income.js';
import * as reports from './reports.js';
import * as settings from './settings.js';

const TABS = { dashboard, leads, quotes, invoices, products, expenses, income, reports, settings };
const TITLES = {
  dashboard: 'Dashboard', leads: 'Leads', quotes: 'Quotes', invoices: 'Invoices',
  products: 'Price list', expenses: 'Expenses', income: 'Other income', reports: 'Reports & tax', settings: 'Settings',
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
  const av = $('avatar'); if (av) av.textContent = (user.email || 'M').trim()[0].toUpperCase();
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

// expose a couple of cross-tab helpers used by dashboard shortcuts
window.LANKY = { go: show };

render();
