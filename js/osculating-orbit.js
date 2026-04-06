// osculating-orbit.js — Keplerian osculating orbit visualisation
// Draws Orion's instantaneous osculating orbit as a live ellipse/hyperbola.
// Three.js r128 only. No build step.
var OsculatingOrbit = (function () {

  // Matches trajectory.js constants
  var SCENE_EARTH_R = 0.9;
  var EARTH_R_KM    = 6371;
  var SCENE_SCALE   = SCENE_EARTH_R / EARTH_R_KM;
  var R_CAP_KM      = 80 / SCENE_SCALE; // 80 scene units → km

  var _ready = false;
  var _data  = [];

  // Injected via init()
  var _scene, _toScene, _popupEl, _lctx, _camera;

  // Three.js objects
  var _orbitLine = null, _orbitMat = null;
  var _periDot   = null, _periMat  = null;

  // Per-frame state
  var _frameCount = 0;
  var _periPos2D  = { x: -9999, y: -9999, vis: false };
  var _currentEl  = null;

  // ── Data fetch ─────────────────────────────────────────────────────
  function _loadData() {
    fetch('data/osculating-elements.json')
      .then(function (r) { return r.json(); })
      .then(function (json) { _data = json.data; _ready = true; })
      .catch(function (e) {
        console.warn('[OsculatingOrbit] JSON load failed — no-op mode:', e);
      });
  }

  // ── Binary search + linear interpolation on metSec ─────────────────
  function _getElements(metSec) {
    if (!_data.length) return null;
    var lo = 0, hi = _data.length - 1;
    if (metSec <= _data[lo][0]) {
      var d = _data[lo];
      return { metSec: d[0], ec: d[1], qr_km: d[2], inc_deg: d[3], om_deg: d[4], w_deg: d[5], a_km: d[7] };
    }
    if (metSec >= _data[hi][0]) {
      var d = _data[hi];
      return { metSec: d[0], ec: d[1], qr_km: d[2], inc_deg: d[3], om_deg: d[4], w_deg: d[5], a_km: d[7] };
    }
    while (lo < hi - 1) {
      var mid = (lo + hi) >> 1;
      if (_data[mid][0] <= metSec) lo = mid; else hi = mid;
    }
    var span = _data[hi][0] - _data[lo][0];
    var t = span > 0 ? (metSec - _data[lo][0]) / span : 0;
    function lerp(a, b) { return a + (b - a) * t; }
    return {
      metSec:  metSec,
      ec:      lerp(_data[lo][1], _data[hi][1]),
      qr_km:   lerp(_data[lo][2], _data[hi][2]),
      inc_deg: lerp(_data[lo][3], _data[hi][3]),
      om_deg:  lerp(_data[lo][4], _data[hi][4]),
      w_deg:   lerp(_data[lo][5], _data[hi][5]),
      a_km:    lerp(_data[lo][7], _data[hi][7])
    };
  }

  // ── Orbital plane → ECI km ─────────────────────────────────────────
  // Applies: Rz(w) → Rx(inc) → Rz(OM)
  function _toECI(xOrb, yOrb, w, inc, om) {
    // Rz(w): argument of periapsis
    var cosW = Math.cos(w), sinW = Math.sin(w);
    var x1 = cosW * xOrb - sinW * yOrb;
    var y1 = sinW * xOrb + cosW * yOrb;
    // z1 = 0 (in-plane, z_orb = 0)

    // Rx(inc): inclination (z_orb = 0 simplifies the row)
    var cosI = Math.cos(inc), sinI = Math.sin(inc);
    var x2 = x1;
    var y2 = cosI * y1;
    var z2 = sinI * y1;

    // Rz(OM): RAAN
    var cosOM = Math.cos(om), sinOM = Math.sin(om);
    return {
      x: cosOM * x2 - sinOM * y2,
      y: sinOM * x2 + cosOM * y2,
      z: z2
    };
  }

  // ── Build / replace 3-D orbit geometry ────────────────────────────
  function _buildOrbit(el) {
    var ec  = el.ec;
    var qr  = el.qr_km;
    var p   = qr * (1 + ec);                     // semi-latus rectum
    var inc = el.inc_deg * Math.PI / 180;
    var om  = el.om_deg  * Math.PI / 180;
    var w   = el.w_deg   * Math.PI / 180;

    var N, nuMin, nuMax;
    if (ec < 1) {
      N = 180; nuMin = -Math.PI; nuMax = Math.PI;
    } else {
      N = 120;
      var nuLim = Math.acos(-1 / ec) - 0.01;     // asymptote minus safety margin
      nuMin = -nuLim; nuMax = nuLim;
    }

    var pts = [];
    for (var i = 0; i <= N; i++) {
      var nu    = nuMin + (nuMax - nuMin) * i / N;
      var denom = 1 + ec * Math.cos(nu);
      if (Math.abs(denom) < 1e-9) continue;
      var r = p / denom;
      if (r < 0 || r > R_CAP_KM) continue;
      var eci = _toECI(r * Math.cos(nu), r * Math.sin(nu), w, inc, om);
      pts.push(_toScene(eci.x, eci.y, eci.z));
    }

    var color = ec < 1 ? 0x00ffcc : 0xff8844;

    // Replace orbit line
    if (_orbitLine) {
      _scene.remove(_orbitLine);
      _orbitLine.geometry.dispose();
      _orbitMat.dispose();
      _orbitLine = null; _orbitMat = null;
    }
    if (pts.length >= 2) {
      var geo = new THREE.BufferGeometry().setFromPoints(pts);
      _orbitMat = new THREE.LineDashedMaterial({
        color: color, transparent: true, opacity: 0.35,
        dashSize: 0.4, gapSize: 0.3
      });
      _orbitLine = new THREE.Line(geo, _orbitMat);
      _orbitLine.computeLineDistances();
      _scene.add(_orbitLine);
    }

    // Replace periapsis dot (ν = 0)
    var periECI = _toECI(qr, 0, w, inc, om);
    var periSc  = _toScene(periECI.x, periECI.y, periECI.z);
    if (_periDot) {
      _scene.remove(_periDot);
      _periDot.geometry.dispose();
      _periMat.dispose();
    }
    _periMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
    _periDot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), _periMat);
    _periDot.position.copy(periSc);
    _scene.add(_periDot);
  }

  // ── Phase detection ───────────────────────────────────────────────
  function _getPhase(ec, qr_km, w_deg, metSec) {
    if (ec >= 1.0)  return 'hyperbolic';
    if (ec < 0.9)   return 'parking';
    var moonProximity = metSec > 380000 && metSec < 490000;
    if (moonProximity && qr_km < 10000) return 'moon-flyby';
    if (metSec > 433520) return 'return';
    return 'tli-coast';
  }

  // ── Popup HTML ────────────────────────────────────────────────────
  function _makePopupHTML(el) {
    var ec    = el.ec;
    var phase = _getPhase(ec, el.qr_km, el.w_deg, el.metSec);
    var ecS   = ec.toFixed(3);
    var qrS   = Math.round(el.qr_km).toLocaleString();
    var incS  = el.inc_deg.toFixed(1);
    var accent = ec < 1 ? '#00ffcc' : '#ff8844';
    var closeBtn = '<span style="cursor:pointer;color:rgba(100,130,170,0.6);font-size:0.8rem;flex-shrink:0;margin-left:8px;" ' +
      'onclick="this.parentElement.parentElement.style.display=\'none\'">\u2715</span>';

    var title, sub, meta, body;
    if (phase === 'parking') {
      title = 'OSCULATING ORBIT';
      sub   = 'Highly Elliptical Earth Orbit';
      meta  = 'EC: ' + ecS + '  |  Periapsis: ' + qrS + ' km  |  Inclination: ' + incS + '\u00b0';
      body  = 'Orion is in a high elliptical parking orbit. Apogee ~76,000 km.<br>' +
              'The TLI burn will stretch this orbit all the way to the Moon.';
    } else if (phase === 'tli-coast') {
      title = 'OSCULATING ORBIT';
      sub   = 'Trans-Lunar Trajectory';
      meta  = 'EC: ' + ecS + '  |  Periapsis: ' + qrS + ' km  |  Inclination: ' + incS + '\u00b0';
      body  = 'Orion is on a free-return trajectory. If all engines failed right now, ' +
              'this orbit would loop around the Moon and bring the crew home automatically.<br>' +
              'Apollo 13 used exactly this technique in 1970.';
    } else if (phase === 'moon-flyby') {
      title = 'OSCULATING ORBIT';
      sub   = 'Moon Gravity Assist \u2014 Elements Changing Rapidly';
      meta  = 'EC: ' + ecS + '  |  Periapsis: ' + qrS + ' km  |  Inclination: ' + incS + '\u00b0';
      body  = 'The Moon\u2019s gravity is actively reshaping this orbit in real time.<br>' +
              'Watch the ellipse rotate as Orion swings around the Moon.';
    } else if (phase === 'hyperbolic') {
      title = 'OSCULATING ORBIT  \u26a0 HYPERBOLIC';
      sub   = 'Escape Trajectory (Transient)';
      meta  = 'EC: ' + ecS + '  |  Semi-major axis: ' + Math.round(el.a_km).toLocaleString() + ' km';
      body  = 'At this instant, Orion\u2019s osculating orbit is hyperbolic \u2014 ' +
              'moving faster than Earth escape velocity relative to its current position.<br>' +
              'This is caused by the Moon\u2019s gravitational perturbation and lasts only minutes.';
    } else {
      title = 'OSCULATING ORBIT';
      sub   = 'Return Trajectory';
      meta  = 'EC: ' + ecS + '  |  Periapsis: ' + qrS + ' km  |  Inclination: ' + incS + '\u00b0';
      body  = 'The Moon\u2019s flyby has permanently rotated the orbit plane ' +
              '(arg. of periapsis changed from 79\u00b0 to 43\u00b0). ' +
              'Orion is now aimed at the Pacific Ocean entry point.';
    }

    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
      '<span style="font-size:0.6rem;font-weight:bold;color:' + accent + ';letter-spacing:0.12em;' +
      'text-shadow:0 0 8px ' + accent + '88;">' + title + '</span>' + closeBtn +
      '</div>' +
      '<div style="font-size:0.58rem;color:#ccdde8;margin-bottom:4px;">' + sub + '</div>' +
      '<div style="font-size:0.48rem;color:#7986a8;margin-bottom:8px;">' + meta + '</div>' +
      '<div style="font-size:0.5rem;color:rgba(180,210,240,0.85);line-height:1.5;">' + body + '</div>';
  }

  // ── 3D → 2D projection using camera ──────────────────────────────
  function _proj(v3) {
    var pv = v3.clone().project(_camera);
    var W  = _lctx.canvas.width;
    var H  = _lctx.canvas.height;
    return { x: (pv.x * 0.5 + 0.5) * W, y: (pv.y * -0.5 + 0.5) * H, vis: pv.z < 1.0 };
  }

  // ── Public API ────────────────────────────────────────────────────

  function init(opts) {
    _scene   = opts.scene;
    _toScene = opts.toScene;
    _popupEl = opts.popupEl;
    _lctx    = opts.lctx;
    _camera  = opts.camera;
    // rotMat is baked into toScene — we use toScene() for all conversions
    _loadData();
  }

  function update(metSec) {
    if (!_ready) return;

    var el = _getElements(metSec);
    if (!el) return;
    _currentEl = el;

    // Moon-proximity opacity fade (Moon gravity ≈ distorts rapidly → dim orbit)
    var moonDistKm = (typeof MissionEphemeris !== 'undefined')
      ? MissionEphemeris.getState(metSec).distMoonKm
      : 1e9;
    var lineOpacity = (moonDistKm * SCENE_SCALE < 5) ? 0.15 : 0.35;

    // Rebuild geometry every 10 frames for performance
    _frameCount++;
    if (_frameCount % 10 === 1 || _orbitLine === null) {
      _buildOrbit(el);
    }
    if (_orbitMat) _orbitMat.opacity = lineOpacity;

    // Project periapsis dot to canvas space
    if (!_periDot) return;
    var s = _proj(_periDot.position);
    _periPos2D = s;
    if (!s.vis) return;

    // Draw canvas label
    var color = el.ec < 1 ? '#00ffcc' : '#ff8844';
    var label = 'OSCULATING ORBIT  EC ' + el.ec.toFixed(3);
    var W = _lctx.canvas.width;
    _lctx.save();
    _lctx.font = '9px "Share Tech Mono",monospace';
    _lctx.fillStyle = color;
    _lctx.globalAlpha = 0.75;
    _lctx.textAlign = 'left';
    _lctx.textBaseline = 'middle';
    var lx = s.x + 10;
    var tw = _lctx.measureText(label).width;
    if (lx + tw > W - 4) lx = s.x - tw - 10;
    _lctx.fillText(label, lx, s.y - 12);
    _lctx.restore();
  }

  function handleClick(mx, my) {
    if (!_ready || !_periPos2D || !_periPos2D.vis) return false;
    var dx = mx - _periPos2D.x;
    var dy = my - _periPos2D.y;
    if (dx * dx + dy * dy > 900) return false; // 30 px radius

    if (!_currentEl || !_popupEl) return false;

    _popupEl.innerHTML = _makePopupHTML(_currentEl);
    var W = _lctx.canvas.width;
    var H = _lctx.canvas.height;
    var left = _periPos2D.x + 14;
    if (left + 295 > W) left = _periPos2D.x - 305;
    var top = _periPos2D.y - 20;
    if (top + 250 > H) top = H - 256;
    if (top < 4) top = 4;
    _popupEl.style.left = Math.max(4, left) + 'px';
    _popupEl.style.top  = Math.max(4, top)  + 'px';
    _popupEl.style.display = 'block';
    return true;
  }

  return { init: init, update: update, handleClick: handleClick };

}());
