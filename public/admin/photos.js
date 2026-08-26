// Photos tab — upload job photos that appear on the website (Our Work +
// homepage). Also a shortcut for posting to Google Business Profile.
import { $, el, esc, supabase, toast } from './lib.js';

export async function load() {
  $('tab-photos').innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Add photos</h2></div>
      <p class="cap" style="margin-top:-6px">These show on your website (Our Work + homepage). Landscape shots look best.</p>
      <div class="row" style="align-items:flex-end;margin-top:8px">
        <div style="width:280px"><label>Choose photos</label><input id="phFiles" type="file" accept="image/*" multiple></div>
        <div class="grow" style="min-width:180px"><label>Caption (optional, same for all)</label><input id="phCap" placeholder="e.g. Garage clean-out, Toukley"></div>
        <label style="display:flex;align-items:center;gap:8px;margin:0 0 4px;text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink)">
          <input type="checkbox" id="phHome" checked style="width:auto"> Show on homepage</label>
        <button id="phUpload">Upload</button>
      </div>
      <p class="cap" id="phMsg" style="margin-top:8px"></p>
    </div>

    <div class="card">
      <div class="card-head"><h2>Post to Google</h2></div>
      <p class="cap" style="margin-top:-6px">Google doesn't allow auto-posting, but it's quick on your phone: open your Google Business Profile → <strong>Photos</strong> → <strong>Add</strong>. (Or use the Google Maps app → your business → Add photos.)</p>
      <a class="right" href="https://business.google.com/" target="_blank" rel="noopener"><button class="subtle" style="margin-top:6px">Open Google Business Profile ↗</button></a>
    </div>

    <div class="card">
      <div class="card-head"><h2>Your photos</h2><span class="cap" id="phCount"></span></div>
      <div id="phGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px"></div>
    </div>`;

  $('phUpload').addEventListener('click', upload);
  await refresh();
}

async function upload() {
  const files = [...$('phFiles').files];
  if (!files.length) { toast('Choose at least one photo.', 'bad'); return; }
  const btn = $('phUpload'); btn.disabled = true;
  const caption = $('phCap').value.trim() || null;
  const show_home = $('phHome').checked;
  let ok = 0, fail = 0;
  for (const f of files) {
    try {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const key = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from('gallery').upload(key, f, { upsert: false, contentType: f.type || 'image/jpeg' });
      if (up.error) throw up.error;
      const url = supabase.storage.from('gallery').getPublicUrl(key).data.publicUrl;
      const { error } = await supabase.from('gallery_photos').insert({ url, caption, show_home, position: Date.now() % 100000 });
      if (error) throw error;
      ok++;
    } catch (err) { fail++; $('phMsg').textContent = err.message || 'Upload failed'; }
  }
  btn.disabled = false;
  $('phFiles').value = ''; $('phCap').value = '';
  toast(`Uploaded ${ok} photo${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}`, fail ? 'bad' : 'ok');
  refresh();
}

async function refresh() {
  const { data, error } = await supabase.from('gallery_photos').select('*').order('position', { ascending: true }).order('created_at', { ascending: false });
  const grid = $('phGrid');
  if (error) { grid.innerHTML = `<p class="err">${esc(error.message)}</p>`; return; }
  $('phCount').textContent = `${data.length} photo${data.length === 1 ? '' : 's'}`;
  if (!data.length) { grid.innerHTML = '<p class="cap">No photos yet. Upload some above.</p>'; return; }

  grid.innerHTML = '';
  for (const p of data) {
    const card = el(`<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface-2);${p.active ? '' : 'opacity:.5'}">
      <div style="aspect-ratio:4/3;background:#000"><img src="${esc(p.url)}" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>
      <div style="padding:8px">
        <input class="ph-cap" value="${esc(p.caption || '')}" placeholder="Caption" style="font-size:12px;padding:6px 8px">
        <label style="display:flex;align-items:center;gap:6px;margin:6px 0 0;text-transform:none;letter-spacing:0;font-size:12px;color:var(--ink)">
          <input type="checkbox" class="ph-home" ${p.show_home ? 'checked' : ''} style="width:auto"> Homepage</label>
        <div class="row" style="margin-top:6px;gap:6px">
          <button class="ghost sm ph-toggle">${p.active ? 'Hide' : 'Show'}</button>
          <button class="danger sm ph-del">Delete</button>
        </div>
      </div>
    </div>`);
    card.querySelector('.ph-cap').addEventListener('change', async (e) => {
      await supabase.from('gallery_photos').update({ caption: e.target.value.trim() || null }).eq('id', p.id);
      toast('Caption saved');
    });
    card.querySelector('.ph-home').addEventListener('change', async (e) => {
      await supabase.from('gallery_photos').update({ show_home: e.target.checked }).eq('id', p.id);
    });
    card.querySelector('.ph-toggle').addEventListener('click', async () => {
      await supabase.from('gallery_photos').update({ active: !p.active }).eq('id', p.id);
      refresh();
    });
    card.querySelector('.ph-del').addEventListener('click', async () => {
      if (!window.confirm('Delete this photo?')) return;
      await supabase.from('gallery_photos').delete().eq('id', p.id);
      toast('Deleted'); refresh();
    });
    grid.appendChild(card);
  }
}
