// Price list — a reusable catalogue of services/fees you can drop into quotes
// and invoices (via "Add from price list" in the editor).
import { $, el, esc, money, supabase, toast, openOverlay } from './lib.js';

export async function load() {
  $('tab-products').innerHTML = `
    <div class="card">
      <div class="spread"><strong>Add an item</strong></div>
      <div class="row" style="align-items:flex-end;margin-top:6px">
        <div class="grow" style="min-width:180px"><label>Name</label><input id="pName" placeholder="e.g. Standard Removal Labour"></div>
        <div style="width:130px"><label>Price $</label><input id="pPrice" inputmode="decimal" placeholder="0.00"></div>
        <button id="pAdd">Add</button>
      </div>
      <label>Description (optional — shown under the name on quotes)</label>
      <input id="pDesc" placeholder="Professional loading, unloading and heavy lifting…">
    </div>
    <div class="card" style="padding:0;overflow:auto">
      <table class="tbl"><thead><tr><th>Item</th><th class="num">Price</th><th></th></tr></thead>
      <tbody id="pRows"></tbody></table>
    </div>`;
  $('pAdd').addEventListener('click', add);
  await refresh();
}

async function add() {
  const name = $('pName').value.trim();
  if (!name) { toast('Add a name.', 'bad'); return; }
  const btn = $('pAdd'); btn.disabled = true;
  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true });
  const { error } = await supabase.from('products').insert({
    name, unit_price: parseFloat($('pPrice').value) || 0,
    description: $('pDesc').value.trim() || null, position: count || 0,
  });
  btn.disabled = false;
  if (error) { toast(error.message, 'bad'); return; }
  $('pName').value = ''; $('pPrice').value = ''; $('pDesc').value = '';
  toast('Item added'); refresh();
}

async function refresh() {
  const { data, error } = await supabase.from('products').select('*').order('position');
  const rows = $('pRows');
  if (error) { rows.innerHTML = `<tr><td colspan="3" class="err">${esc(error.message)}</td></tr>`; return; }
  if (!data.length) { rows.innerHTML = `<tr><td colspan="3" class="muted">No items yet — add your common services and fees above.</td></tr>`; return; }
  rows.innerHTML = '';
  for (const p of data) {
    const tr = el(`<tr>
      <td><strong>${esc(p.name)}</strong>${p.description ? `<br><span class="muted" style="font-size:12px">${esc(p.description)}</span>` : ''}</td>
      <td class="num">${money(p.unit_price)}</td>
      <td class="num" style="white-space:nowrap"></td></tr>`);
    const edit = el('<button class="ghost sm">Edit</button>');
    edit.addEventListener('click', () => openEdit(p));
    const del = el('<button class="danger sm" style="margin-left:6px">Delete</button>');
    del.addEventListener('click', async () => {
      if (!window.confirm(`Delete "${p.name}" from the price list?`)) return;
      const { error } = await supabase.from('products').delete().eq('id', p.id);
      if (error) { toast(error.message, 'bad'); return; }
      toast('Deleted'); refresh();
    });
    tr.children[2].append(edit, del);
    rows.appendChild(tr);
  }
}

function openEdit(p) {
  const view = el(`<div>
    <div class="spread"><h2>Edit item</h2><button class="ghost sm" id="eClose">Close ✕</button></div>
    <label>Name</label><input id="eName" value="${esc(p.name)}">
    <label>Description</label><input id="eDesc" value="${esc(p.description || '')}">
    <label>Price $</label><input id="ePrice" inputmode="decimal" value="${Number(p.unit_price)}">
    <div class="row" style="margin-top:16px"><button id="eSave">Save changes</button></div>
  </div>`);
  const close = openOverlay(view, 'modal');
  view.querySelector('#eClose').addEventListener('click', close);
  view.querySelector('#eSave').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const { error } = await supabase.from('products').update({
      name: view.querySelector('#eName').value.trim(),
      description: view.querySelector('#eDesc').value.trim() || null,
      unit_price: parseFloat(view.querySelector('#ePrice').value) || 0,
    }).eq('id', p.id);
    if (error) { toast(error.message, 'bad'); e.target.disabled = false; return; }
    toast('Saved'); close(); refresh();
  });
}
