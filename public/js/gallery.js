/* Lanky Services — load admin-uploaded job photos into the site galleries.
   #lanky-gallery       → all active photos (Our Work)
   #lanky-gallery-home  → photos flagged "show on homepage" */
(function () {
  var SB = 'https://rstabgnhargvqwasplst.supabase.co';
  var KEY = 'sb_publishable_SsCPt15jfIBlV75qC3Wt7A_4mhanmSk';

  function esc(s) {
    return String(s || '').replace(/[<>&"]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
    });
  }
  function figure(p) {
    return '<figure class="shot reveal in">' +
      (p.caption ? '<span class="tag">' + esc(p.caption) + '</span>' : '') +
      '<img src="' + esc(p.url) + '" alt="' + esc(p.caption || 'Lanky Services job photo, Central Coast') +
      '" loading="lazy" width="800" height="600" /></figure>';
  }
  function load(el, homeOnly) {
    var url = SB + '/rest/v1/gallery_photos?active=eq.true&select=url,caption,show_home,position&order=position.asc';
    if (homeOnly) url += '&show_home=eq.true';
    fetch(url, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (!rows || !rows.length) return;
        if (el.className.indexOf('gallery') === -1) el.className += ' gallery';
        el.insertAdjacentHTML('afterbegin', rows.map(figure).join('')); // newest work first
      })
      .catch(function () {});
  }
  var g = document.getElementById('lanky-gallery'); if (g) load(g, false);
  var h = document.getElementById('lanky-gallery-home'); if (h) load(h, true);
})();
