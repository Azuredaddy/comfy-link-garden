// Users & access — add, change role, invite/reset, set password, remove.
// Only portal admins can see or use this tab.
import { $, el, esc, supabase, toast, apiFetch, myRole } from './lib.js';

const ROLE_LABEL = { admin: 'Admin (full + users)', editor: 'Editor (full)', viewer: 'View only' };
const fmt = (s) => (s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export async function load() {
  const wrap = $('tab-users');
  const role = await myRole();
  if (role !== 'admin') {
    wrap.innerHTML = `<div class="card"><strong>Users &amp; access</strong>
      <p class="muted" style="font-size:13px;margin-top:6px">Only portal admins can manage users.</p></div>`;
    return;
  }

  wrap.innerHTML = `<div class="card">
      <div class="card-head"><h2>Add a user</h2></div>
      <p class="cap" style="margin-top:-6px">Add someone by email and choose their access. Then send them an invite, or set a password for them.</p>
      <div class="row" style="align-items:flex-end;margin-top:8px">
        <div class="grow"><label>Email</label><input id="usEmail" type="email" placeholder="person@email.com"></div>
        <div style="width:190px"><label>Access</label><select id="usRole">
          <option value="viewer">View only</option><option value="editor">Editor (full)</option><option value="admin">Admin (full + users)</option>
        </select></div>
        <button id="usAdd">Add user</button>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Portal users</h2></div>
      <div id="usList" class="muted" style="font-size:13px">Loading…</div>
    </div>`;

  $('usAdd').addEventListener('click', async (e) => {
    const email = $('usEmail').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email.', 'bad'); return; }
    e.target.disabled = true;
    try {
      await apiFetch('/api/admin/users', { body: { action: 'add', email, role: $('usRole').value } });
      toast('User added'); $('usEmail').value = ''; renderList();
    } catch (err) { toast(err.message, 'bad'); }
    e.target.disabled = false;
  });

  renderList();
}

async function renderList() {
  const box = $('usList');
  const { data: me } = await supabase.auth.getUser();
  const myEmail = (me.user?.email || '').toLowerCase();

  let users = [];
  try { users = (await apiFetch('/api/admin/users', { method: 'GET' })).users || []; }
  catch (err) { box.innerHTML = `<div class="err">${esc(err.message)}</div>`; return; }

  box.innerHTML = '';
  const table = el(`<table class="tbl"><thead><tr>
      <th>Email</th><th style="width:200px">Access</th><th style="width:150px">Account</th><th class="num" style="width:230px">Actions</th>
    </tr></thead><tbody></tbody></table>`);
  const body = table.querySelector('tbody');

  for (const u of users) {
    const isMe = u.email.toLowerCase() === myEmail;
    const tr = el(`<tr>
      <td>${esc(u.email)}${isMe ? ' <span class="muted">(you)</span>' : ''}</td>
      <td></td>
      <td>${u.has_account
        ? `<span class="pill paid">Active</span><div class="muted" style="font-size:11px;margin-top:3px">Last sign-in ${esc(fmt(u.last_sign_in_at))}</div>`
        : '<span class="pill">No account yet</span>'}</td>
      <td class="num"></td></tr>`);

    const sel = el(`<select class="sm" style="width:auto;padding:6px 8px" ${isMe ? 'disabled title="You can\'t change your own role"' : ''}>
      ${['viewer', 'editor', 'admin'].map((r) => `<option value="${r}" ${r === (u.role || 'admin') ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>`);
    sel.addEventListener('change', async () => {
      try { await apiFetch('/api/admin/users', { body: { action: 'update', email: u.email, role: sel.value } }); toast(`${u.email} is now ${sel.value}`); }
      catch (err) { toast(err.message, 'bad'); renderList(); }
    });
    tr.children[1].appendChild(sel);

    const actions = tr.children[3];
    const invite = el(`<button class="subtle sm">${u.has_account ? 'Send reset' : 'Send invite'}</button>`);
    invite.addEventListener('click', async () => {
      invite.disabled = true;
      try { const r = await apiFetch('/api/admin/users', { body: { action: 'invite', email: u.email } }); toast(r.message || 'Email sent'); }
      catch (err) { toast(err.message, 'bad'); }
      invite.disabled = false;
    });
    actions.appendChild(invite);

    const setPw = el('<button class="ghost sm" style="margin-left:6px">Set password</button>');
    setPw.addEventListener('click', async () => {
      const pw = window.prompt(`Set a password for ${u.email} (at least 8 characters). Share it with them privately.`);
      if (!pw) return;
      if (pw.length < 8) { toast('Password must be at least 8 characters.', 'bad'); return; }
      try { const r = await apiFetch('/api/admin/users', { body: { action: 'set-password', email: u.email, password: pw } }); toast(r.message || 'Password set'); renderList(); }
      catch (err) { toast(err.message, 'bad'); }
    });
    actions.appendChild(setPw);

    if (!isMe) {
      const del = el('<button class="danger sm" style="margin-left:6px">Remove</button>');
      del.addEventListener('click', async () => {
        if (!window.confirm(`Remove ${u.email}'s access to the portal?`)) return;
        try { await apiFetch('/api/admin/users', { body: { action: 'remove', email: u.email } }); toast('Access removed'); renderList(); }
        catch (err) { toast(err.message, 'bad'); }
      });
      actions.appendChild(del);
    }

    body.appendChild(tr);
  }

  if (!users.length) box.innerHTML = '<div class="muted">No users yet.</div>';
  else box.appendChild(table);
}
