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

  // Quote forms (front-end only demo handler)
  document.querySelectorAll('form.quote, form.qcard').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.textContent = 'Thanks — we\'ll be in touch!'; btn.disabled = true; }
    });
  });
})();
