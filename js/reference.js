(function () {
  'use strict';

  var ITEMS = [
    { id: 'mission',    label: 'MISSION',    title: 'ARTEMIS II — MISSION PROFILE' },
    { id: 'science',    label: 'SCIENCE',    title: 'ARTEMIS II — SCIENCE &amp; EXPERIMENTS' },
    { id: 'sls',        label: 'SLS ROCKET', title: 'SPACE LAUNCH SYSTEM' },
    { id: 'orion',      label: 'ORION',      title: 'ORION SPACECRAFT' },
    { id: 'ground-ops', label: 'GROUND OPS', title: 'EXPLORATION GROUND SYSTEMS' },
    { id: 'comms',      label: 'COMMS',      title: 'SPACE COMMUNICATIONS &amp; NAVIGATION' },
    { id: 'esm',        label: 'ESA / ESM',  title: 'EUROPEAN SERVICE MODULE' },
    { id: 'canada',     label: 'CANADA / CSA', title: 'CANADA &amp; THE CANADIAN SPACE AGENCY' }
  ];

  var cache = {};
  var modal, modalTitle, modalBody, modalClose;

  /** Strip scripts/event handlers from fetched HTML before assigning to innerHTML. */
  function sanitizeFetchedHtml(html) {
    var doc = new DOMParser().parseFromString(html || '', 'text/html');
    var body = doc.body;
    if (!body) return '';
    var kill = body.querySelectorAll('script, iframe, object, embed, link[rel="import"]');
    var i;
    for (i = 0; i < kill.length; i++) kill[i].remove();
    body.querySelectorAll('*').forEach(function (el) {
      var attrs = el.attributes;
      var j;
      for (j = attrs.length - 1; j >= 0; j--) {
        var name = attrs[j].name;
        if (/^on/i.test(name) || name === 'srcdoc') el.removeAttribute(name);
      }
      if (el.tagName === 'A') {
        var h = el.getAttribute('href');
        if (h && /^\s*javascript:/i.test(h)) el.setAttribute('href', '#');
      }
    });
    return body.innerHTML;
  }

  function buildNav() {
    var nav = document.getElementById('ref-menu-items') || document.getElementById('ref-nav');
    if (!nav) return;
    ITEMS.forEach(function (item) {
      var btn = document.createElement('button');
      btn.className = 'ref-nav-btn';
      btn.setAttribute('data-ref', item.id);
      btn.setAttribute('data-title', item.title);
      btn.innerHTML = item.label;
      btn.addEventListener('click', function () { openModal(item.id, item.title); });
      nav.appendChild(btn);
    });
  }

  function openModal(id, title) {
    var navEl2 = document.getElementById('ref-nav');
    if (navEl2) { navEl2.classList.remove('ref-nav-open'); }
    var navTog2 = document.getElementById('ref-nav-toggle');
    if (navTog2) navTog2.textContent = '☰';
    if (cache[id]) {
      show(title, cache[id]);
      return;
    }
    modalBody.innerHTML = '<div class="ref-loading">LOADING&#x2026;</div>';
    modalTitle.innerHTML = title;
    modal.classList.add('ref-modal-open');
    document.body.classList.add('ref-modal-active');

    fetch('content/' + id + '.html')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        var safe = sanitizeFetchedHtml(html);
        cache[id] = safe;
        if (modal.classList.contains('ref-modal-open')) {
          modalBody.innerHTML = safe;
        }
      })
      .catch(function (err) {
        modalBody.innerHTML = '<div class="ref-loading ref-error">FAILED TO LOAD — ' + err.message + '</div>';
      });
  }

  function show(title, html) {
    modalTitle.innerHTML = title;
    modalBody.innerHTML = sanitizeFetchedHtml(html);
    modal.classList.add('ref-modal-open');
    document.body.classList.add('ref-modal-active');
    modalBody.scrollTop = 0;
  }

  function closeModal() {
    modal.classList.remove('ref-modal-open');
    document.body.classList.remove('ref-modal-active');
  }

  function init() {
    modal      = document.getElementById('ref-modal');
    modalTitle = document.getElementById('ref-modal-title');
    modalBody  = document.getElementById('ref-modal-body');
    modalClose = document.getElementById('ref-modal-close');

    if (!modal) return;

    buildNav();

    var navToggle = document.getElementById('ref-nav-toggle');
    var navEl = document.getElementById('ref-nav');
    if (navToggle && navEl) {
      navToggle.addEventListener('click', function() {
        navEl.classList.toggle('ref-nav-open');
        navToggle.textContent = navEl.classList.contains('ref-nav-open') ? '✕' : '☰';
      });
    }

    modalClose.addEventListener('click', closeModal);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('ref-modal-open')) closeModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
