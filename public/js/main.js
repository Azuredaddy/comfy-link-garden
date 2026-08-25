/* Lanky Services — shared interactions */
(function () {
  // Skip-to-content link (accessibility)
  var main = document.querySelector('main');
  if (main) {
    if (!main.id) main.id = 'main';
    if (!document.querySelector('.skip-link')) {
      var skip = document.createElement('a');
      skip.className = 'skip-link';
      skip.href = '#' + main.id;
      skip.textContent = 'Skip to content';
      document.body.insertBefore(skip, document.body.firstChild);
    }
  }
  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      document.body.classList.toggle('nav-open');
      var expanded = document.body.classList.contains('nav-open');
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
    // close menu when a link is clicked
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { document.body.classList.remove('nav-open'); });
    });
  }

  // Scroll reveal
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  // Current year in footer
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Sticky mobile call/quote bar (mobile only, styled in CSS)
  if (!document.querySelector('.mobile-cta')) {
    var bar = document.createElement('div');
    bar.className = 'mobile-cta';
    var quoteHref = document.querySelector('a[href$="contact.html"], a[href="#quote"]') ? 'contact.html' : 'contact.html';
    // use relative path that works from /locations/ too
    var inLoc = /\/locations\//.test(location.pathname);
    var contactHref = inLoc ? '../contact.html' : 'contact.html';
    bar.innerHTML =
      '<a class="call" href="tel:0439973051">Call now</a>' +
      '<a class="quote" href="' + contactHref + '">Free quote</a>';
    document.body.appendChild(bar);
  }

  // Quote forms — submit the enquiry straight to the business (no email app).
  var BUSINESS_EMAIL = 'matt@lankyservices.com.au';
  var API_URL = '/api/public/quote';

  function val(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return '';
    var v = String(el.value || '').trim().slice(0, 1000);
    if (/^select a service$/i.test(v)) return '';
    return v;
  }

  function makeSubmissionKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function statusNote(form) {
    var note = form.querySelector('.send-status');
    if (!note) {
      note = document.createElement('p');
      note.className = 'form-note send-status';
      note.style.textAlign = 'center';
      note.style.marginTop = '12px';
      form.appendChild(note);
    }
    return note;
  }

  document.querySelectorAll('form.quote, form.qcard').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var note = statusNote(form);

      var payload = {
        submission_key: form.dataset.submissionKey || makeSubmissionKey(),
        name: val(form, 'name').slice(0, 100),
        phone: val(form, 'phone').slice(0, 40) || null,
        email: val(form, 'email').slice(0, 255) || null,
        suburb: val(form, 'suburb').slice(0, 100) || null,
        service: val(form, 'service').slice(0, 100) || null,
        message: val(form, 'message').slice(0, 2000) || null,
        source_url: location.href.slice(0, 500),
        website: '',
        marketing_opt_in: !!(form.querySelector('[name="marketing_opt_in"]') && form.querySelector('[name="marketing_opt_in"]').checked)
      };
      form.dataset.submissionKey = payload.submission_key;

      if (!payload.name || (!payload.phone && !payload.email)) {
        note.textContent = 'Please add your name and a phone number or email so we can get back to you.';
        return;
      }
      if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        note.textContent = 'That email address doesn\u2019t look right. Please check it and try again.';
        return;
      }

      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      note.textContent = '';

      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: 'same-origin'
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok || !body.saved) throw new Error(body.message || 'Request failed: ' + res.status);
          return body;
        });
      }).then(function () {
        clearTimeout(timeout);
        form.reset();
        delete form.dataset.submissionKey;
        if (btn) { btn.disabled = false; btn.textContent = label; }

        function esc(v) {
          return String(v || '').replace(/[<>&"]/g, function (c) {
            return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
          });
        }
        var rows = '';
        if (payload.phone) rows += '<li><strong>Phone:</strong> ' + esc(payload.phone) + '</li>';
        if (payload.email) rows += '<li><strong>Email:</strong> ' + esc(payload.email) + '</li>';
        if (payload.suburb) rows += '<li><strong>Suburb:</strong> ' + esc(payload.suburb) + '</li>';
        if (payload.service) rows += '<li><strong>Job:</strong> ' + esc(payload.service) + '</li>';

        var done = document.createElement('div');
        done.className = 'quote-confirm';
        done.setAttribute('role', 'status');
        done.setAttribute('tabindex', '-1');
        done.innerHTML =
          '<div class="qc-tick" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">' +
            '<path d="M20 6 9 17l-5-5"/></svg>' +
          '</div>' +
          '<h2>Thanks ' + esc(payload.name.split(' ')[0]) + ', your request is in.</h2>' +
          '<p>We\u2019ve received your quote request and it\u2019s already with our team.</p>' +
          '<h3>What happens next</h3>' +
          '<ol class="qc-steps">' +
            '<li>We review the details you sent (usually within a couple of hours, Mon\u2013Sat 7am\u20136pm).</li>' +
            '<li>Matt calls or texts you with an upfront, no-obligation price.</li>' +
            '<li>Happy with it? We lock in a time \u2014 often same or next day.</li>' +
          '</ol>' +
          (rows ? '<h3>What you sent us</h3><ul class="qc-summary">' + rows + '</ul>' : '') +
          '<p class="qc-contact">Need it sorted urgently? Call <a href="tel:0439973051">0439 973 051</a> ' +
          'or email <a href="mailto:' + BUSINESS_EMAIL + '">' + BUSINESS_EMAIL + '</a>.</p>' +
          '<p class="form-note">Tip: photos help us quote faster \u2014 text or email them through anytime.</p>';

        form.parentNode.replaceChild(done, form);
        try { done.focus(); } catch (err) {}
        try { done.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) {}

      }).catch(function () {
        clearTimeout(timeout);
        if (btn) { btn.disabled = false; btn.textContent = label; }
        note.innerHTML = 'Sorry, that didn\u2019t send. Please call ' +
          '<a href="tel:0439973051">0439 973 051</a> or email ' +
          '<a href="mailto:' + BUSINESS_EMAIL + '">' + BUSINESS_EMAIL + '</a>.';
      });
    });
  });


})();
