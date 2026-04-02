(function () {
  'use strict';

  var ITEMS = [
    { id: 'mission',    label: 'MISSION',    title: 'ARTEMIS II — MISSION PROFILE' },
    { id: 'science',    label: 'SCIENCE',    title: 'ARTEMIS II — SCIENCE &amp; EXPERIMENTS' },
    { id: 'sls',        label: 'SLS ROCKET', title: 'SPACE LAUNCH SYSTEM' },
    { id: 'orion',      label: 'ORION',      title: 'ORION SPACECRAFT' },
    { id: 'ground-ops', label: 'GROUND OPS', title: 'EXPLORATION GROUND SYSTEMS' },
    { id: 'comms',      label: 'COMMS',      title: 'SPACE COMMUNICATIONS &amp; NAVIGATION' }
  ];

  var cache = {};
  var modal, modalTitle, modalBody, modalClose;

  function buildNav() {
    var nav = document.getElementById('ref-nav');
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
        cache[id] = html;
        if (modal.classList.contains('ref-modal-open')) {
          modalBody.innerHTML = html;
        }
      })
      .catch(function (err) {
        modalBody.innerHTML = '<div class="ref-loading ref-error">FAILED TO LOAD — ' + err.message + '</div>';
      });
  }

  function show(title, html) {
    modalTitle.innerHTML = title;
    modalBody.innerHTML = html;
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
