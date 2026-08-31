/* Lanky Services — shared interactions */
(function () {
  // Google Analytics (gtag.js)
  var GA_ID = 'G-RW5ZEP2YVH';
  if (!window.__gaLoaded) {
    window.__gaLoaded = true;
    var ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(ga);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

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
    // absolute paths so they work from every folder (incl. /service-areas/ and /blog/)
    bar.innerHTML =
      '<a class="call" href="tel:0439973051">Call now</a>' +
      '<a class="quote" href="/quote.html">Get a free quote</a>';
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
        if (payload.phone) rows += '<li><strong>Phone</strong><span>' + esc(payload.phone) + '</span></li>';
        if (payload.email) rows += '<li><strong>Email</strong><span>' + esc(payload.email) + '</span></li>';
        if (payload.suburb) rows += '<li><strong>Suburb</strong><span>' + esc(payload.suburb) + '</span></li>';
        if (payload.service) rows += '<li><strong>Job</strong><span>' + esc(payload.service) + '</span></li>';

        var done = document.createElement('div');
        done.className = 'quote-confirm';
        done.setAttribute('role', 'status');
        done.setAttribute('tabindex', '-1');
        done.innerHTML =
          '<div class="qc-head">' +
            '<div class="qc-tick" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>' +
            '</div>' +
            '<h2>Thanks ' + esc(payload.name.split(' ')[0]) + ', your request is in.</h2>' +
            '<p>We\u2019ve received your quote request \u2014 it\u2019s already with our team.</p>' +
          '</div>' +
          '<h3>What happens next</h3>' +
          '<ol class="qc-steps">' +
            '<li><span class="qc-num">1</span><div class="qc-step-b"><strong>We review your details</strong><span>Usually within a couple of hours \u00b7 Mon\u2013Sat, 7am\u20136pm</span></div></li>' +
            '<li><span class="qc-num">2</span><div class="qc-step-b"><strong>Matt calls or texts you</strong><span>With an upfront, no-obligation price</span></div></li>' +
            '<li><span class="qc-num">3</span><div class="qc-step-b"><strong>We lock in a time</strong><span>Happy with it? Often same or next day</span></div></li>' +
          '</ol>' +
          (rows ? '<div class="qc-card"><h3>What you sent us</h3><ul class="qc-summary">' + rows + '</ul></div>' : '') +
          '<div class="qc-cta">' +
            '<a class="qc-btn" href="tel:0439973051">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
              'Call 0439 973 051</a>' +
            '<span class="qc-or">or email <a href="mailto:' + BUSINESS_EMAIL + '">' + BUSINESS_EMAIL + '</a></span>' +
          '</div>' +
          '<p class="qc-tip">\ud83d\udcf8 Photos help us quote faster \u2014 text or email them through anytime.</p>';

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
