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

  // Quote forms — deliver the enquiry by email to the business.
  var BUSINESS_EMAIL = 'matt@lankyservices.com.au';

  function val(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return '';
    var v = String(el.value || '').trim().slice(0, 1000);
    if (/^select a service$/i.test(v)) return '';
    return v;
  }

  document.querySelectorAll('form.quote, form.qcard').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');

      var name = val(form, 'name');
      var phone = val(form, 'phone');
      var email = val(form, 'email');
      var suburb = val(form, 'suburb');
      var service = val(form, 'service');
      var message = val(form, 'message');

      // Basic validation — we need a way to reply.
      if (!name || (!phone && !email)) {
        alert('Please add your name and a phone number or email so we can get back to you.');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('That email address doesn\u2019t look right. Please check it and try again.');
        return;
      }

      var lines = [
        'Name: ' + name,
        'Phone: ' + (phone || '—'),
        'Email: ' + (email || '—'),
        'Suburb: ' + (suburb || '—'),
        'Service: ' + (service || '—'),
        '',
        'Details:',
        message || '—',
        '',
        'Sent from ' + location.href
      ];

      var subject = 'Quote request' + (suburb ? ' — ' + suburb : '') + ' — ' + name;
      var href = 'mailto:' + BUSINESS_EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(lines.join('\n'));

      // Only confirm once the email hand-off has actually been triggered.
      window.location.href = href;

      if (btn) {
        btn.textContent = 'Opening your email app…';
        btn.disabled = true;
        setTimeout(function () {
          btn.disabled = false;
          btn.textContent = 'Send again';
        }, 6000);
      }

      var note = form.querySelector('.send-status');
      if (!note) {
        note = document.createElement('p');
        note.className = 'form-note send-status';
        note.style.textAlign = 'center';
        note.style.marginTop = '12px';
        form.appendChild(note);
      }
      note.innerHTML = 'We\u2019ve opened your email app with the details ready to send \u2014 press send and we\u2019ll reply shortly. ' +
        'If nothing opened, email <a href="mailto:' + BUSINESS_EMAIL + '">' + BUSINESS_EMAIL + '</a> or call ' +
        '<a href="tel:0439973051">0439 973 051</a>.';
    });
  });

})();
