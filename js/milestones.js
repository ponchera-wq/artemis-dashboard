/* js/milestones.js — Road to Artemis III milestones panel
 * Fetches data/artemis3-milestones.json and renders a vertical timeline
 * into #milestones-panel. IIFE, no globals, under 200 lines.
 */
(function () {
  'use strict';

  var LAUNCH_ID = 'a3-launch';
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function fmtDate(iso, net) {
    if (!iso) return 'TBA';
    var d = new Date(iso);
    var dd = String(d.getUTCDate()).padStart(2, '0');
    var mon = MONTHS[d.getUTCMonth()];
    var yyyy = d.getUTCFullYear();
    return (net ? 'NET ' : '') + dd + ' ' + mon + ' ' + yyyy;
  }

  function statusOrder(s) {
    return s === 'complete' ? 0 : s === 'in-progress' ? 1 : 2;
  }

  function sortDate(m) {
    var iso = m.status === 'complete' ? m.completed_date : m.target_date;
    return iso ? new Date(iso).getTime() : Infinity;
  }

  function pipClass(m) {
    if (m.id === LAUNCH_ID)        return 'pip-launch';
    if (m.status === 'complete')   return 'pip-complete';
    if (m.status === 'in-progress') return 'pip-inprogress';
    return 'pip-pending';
  }

  function pipIcon(m) {
    if (m.id === LAUNCH_ID)         return '🎯';
    if (m.status === 'complete')    return '●';
    if (m.status === 'in-progress') return '●';
    return '○';
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildPanel(milestones) {
    var panel = document.getElementById('milestones-panel');
    if (!panel) return;

    /* Panel header */
    var header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = '<span class="dot"></span>' +
      '<h2 class="panel-heading">ROAD TO ARTEMIS III</h2>';
    panel.appendChild(header);

    /* Sort: complete (asc completed_date) → in-progress (asc target_date) → pending (asc target_date), nulls last */
    var sorted = milestones.slice().sort(function (a, b) {
      var oa = statusOrder(a.status), ob = statusOrder(b.status);
      if (oa !== ob) return oa - ob;
      return sortDate(a) - sortDate(b);
    });

    /* Timeline container */
    var timeline = document.createElement('div');
    timeline.className = 'ms-timeline';
    timeline.id = 'ms-timeline';

    sorted.forEach(function (m) {
      var isLaunch = m.id === LAUNCH_ID;

      /* Date string */
      var dateStr = m.status === 'complete'
        ? fmtDate(m.completed_date)
        : fmtDate(m.target_date, isLaunch);

      /* Source link */
      var sourceHtml = m.source_url
        ? '<a class="milestone-source" href="' + esc(m.source_url) + '"' +
          ' target="_blank" rel="noopener" aria-label="Source">↗</a>'
        : '';

      var row = document.createElement('div');
      row.className = 'milestone-row ' + m.status;

      row.innerHTML =
        '<div class="milestone-pip ' + pipClass(m) + '" aria-hidden="true">' +
          pipIcon(m) +
        '</div>' +
        '<div class="milestone-content">' +
          '<div class="milestone-meta">' +
            '<span class="milestone-category">' + esc(m.category.toUpperCase()) + '</span>' +
            '<span class="milestone-date">' + esc(dateStr) + '</span>' +
            sourceHtml +
          '</div>' +
          '<div class="milestone-title">' + esc(m.title) + '</div>' +
          '<div class="milestone-description">' + esc(m.description) + '</div>' +
        '</div>';

      timeline.appendChild(row);
    });

    panel.appendChild(timeline);
  }

  function init() {
    fetch('/data/artemis3-milestones.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(buildPanel)
      .catch(function (err) {
        var panel = document.getElementById('milestones-panel');
        if (panel) {
          panel.innerHTML = '<p class="ms-error">Milestones data unavailable</p>';
        }
        console.error('[milestones]', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
