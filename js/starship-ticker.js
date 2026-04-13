(function () {
  'use strict';

  var PANEL = document.getElementById('starship-ticker-panel');
  if (!PANEL) return;

  var COLORS = {
    success: '#ccff00',
    partial:  '#ffa726',
    failure:  '#ff3b3b'
  };
  var GLOW = {
    success: 'rgba(204,255,0,0.65)',
    partial:  'rgba(255,167,38,0.65)',
    failure:  'rgba(255,59,59,0.65)'
  };

  /* ── SVG chart ─────────────────────────────────────────────────── */
  function buildChart(flights) {
    var n   = flights.length;
    var W   = 320;
    var H   = 58;
    var pad = 18;
    var cy  = 26;
    var r   = 7;
    var step = (W - pad * 2) / (n - 1);

    var parts = [
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet"',
      ' xmlns="http://www.w3.org/2000/svg">',
      '<line x1="' + pad + '" y1="' + cy + '"',
      '      x2="' + (W - pad) + '" y2="' + cy + '"',
      '      stroke="rgba(255,255,255,0.10)" stroke-width="1"/>',
    ];

    flights.forEach(function (f, i) {
      var x     = (pad + i * step).toFixed(1);
      var col   = COLORS[f.outcome]  || '#888';
      var glow  = GLOW[f.outcome]    || 'rgba(136,136,136,0.5)';
      var label = 'IFT-' + f.flight_number;
      parts.push(
        '<circle cx="' + x + '" cy="' + cy + '" r="' + r + '"' +
        ' fill="' + col + '"' +
        ' filter="drop-shadow(0 0 4px ' + glow + ')"/>',
        '<text x="' + x + '" y="' + (H - 4) + '"' +
        ' text-anchor="middle" font-size="6.5"' +
        ' fill="rgba(255,255,255,0.28)" font-family="monospace">' +
        label + '</text>'
      );
    });

    parts.push('</svg>');
    return parts.join('');
  }

  /* ── Main render ───────────────────────────────────────────────── */
  function render(flights) {
    var total     = flights.length;
    var successes = 0, partials = 0, failures = 0;
    flights.forEach(function (f) {
      if (f.outcome === 'success') successes++;
      else if (f.outcome === 'partial') partials++;
      else if (f.outcome === 'failure') failures++;
    });

    var tally = [
      dot('#ccff00') + successes + ' success',
      dot('#ffa726') + partials  + ' partial',
      dot('#ff3b3b') + failures  + ' failure'
    ].map(function (s) { return '<span class="ticker-tally-item">' + s + '</span>'; }).join('');

    PANEL.innerHTML =
      '<div class="ticker-inner">' +
        '<div class="ticker-big-number">' + total + '</div>' +
        '<div class="ticker-label">INTEGRATED FLIGHT TESTS</div>' +
        '<div class="ticker-tally">' + tally + '</div>' +
        '<div class="ticker-chart">' + buildChart(flights) + '</div>' +
        '<div class="ticker-caption">Next flight: NET May 2026 (V3 debut)</div>' +
        '<div class="ticker-attribution">via SpaceX integrated test campaign</div>' +
      '</div>';
  }

  function dot(color) {
    return '<span class="ticker-tally-dot" style="background:' + color + '"></span>';
  }

  function showError() {
    PANEL.innerHTML =
      '<div class="ticker-inner">' +
        '<p class="ticker-caption">Starship flight data unavailable</p>' +
      '</div>';
  }

  /* ── Bootstrap ─────────────────────────────────────────────────── */
  fetch('data/starship-flights.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(render)
    .catch(showError);

})();
