// osculating-orbit.js — Instantaneous Keplerian orbit overlay
// Loads data/osculating-elements.json (Earth-centred ICRF, JPL Horizons).
// Exposes window.OsculatingOrbit: init(cfg), update(metSec), handleClick(mx,my).
window.OsculatingOrbit = (function () {
  'use strict';

  // ── Private state ─────────────────────────────────────────────────────
  var _scene, _camera, _lctx, _toScene, _popupEl;
  var _data = null;       // raw rows from JSON
  var _meta = null;       // { tli_metSec, perilune_metSec, columns, … }
  var _orbitLine = null;
  var _periDot  = null;
  var _frameCount   = 0;
  var _periPos2D    = null; // { x, y } canvas px, or null when off-screen
  var _popupOpen    = false;
  var _lastMetSec   = 0;
  var _currentEl    = null; // last interpolated element row

  // Column indices (matches JSON meta.columns order)
  var C_MET = 0, C_EC = 1, C_QR = 2, C_INC = 3, C_OM = 4, C_W = 5, /*C_TP=6,*/ C_A = 7;

  var EARTH_R_KM = 6371;
  var DEG        = Math.PI / 180;
  var N_PTS      = 128;   // orbit sample count
  var MU_KM3S2   = 398600.4418; // GM Earth, km³/s²

  // ── Binary search + linear interpolation ─────────────────────────────
  function interpolate(metSec) {
    var rows = _data;
    if (!rows || rows.length === 0) return null;
    if (metSec <= rows[0][C_MET])              return rows[0].slice();
    if (metSec >= rows[rows.length - 1][C_MET]) return rows[rows.length - 1].slice();

    var lo = 0, hi = rows.length - 1;
    while (lo < hi - 1) {
      var mid = (lo + hi) >> 1;
      if (rows[mid][C_MET] <= metSec) lo = mid; else hi = mid;
    }

    var t = (metSec - rows[lo][C_MET]) / (rows[hi][C_MET] - rows[lo][C_MET]);
    var r = new Array(rows[lo].length);
    for (var i = 0; i < r.length; i++) {
      r[i] = rows[lo][i] + (rows[hi][i] - rows[lo][i]) * t;
    }
    r[C_MET] = metSec;
    return r;
  }

  // ── Perifocal basis vectors (ICRF) ────────────────────────────────────
  // Classical rotation: R_z(Ω) · R_x(i) · R_z(ω)
  // Returns P̂ (periapsis) and Q̂ (90° ahead in orbital plane).
  function perifocalBasis(om, inc, w) {
    var cosO = Math.cos(om), sinO = Math.sin(om);
    var cosI = Math.cos(inc), sinI = Math.sin(inc);
    var cosW = Math.cos(w),  sinW = Math.sin(w);
    return {
      px:  cosO * cosW - sinO * sinW * cosI,
      py:  sinO * cosW + cosO * sinW * cosI,
      pz:  sinW * sinI,
      qx: -cosO * sinW - sinO * cosW * cosI,
      qy: -sinO * sinW + cosO * cosW * cosI,
      qz:  cosW * sinI
    };
  }

  // ── Sample orbit in scene coordinates ────────────────────────────────
  function buildOrbitPoints(el) {
    var ec  = el[C_EC];
    var qr  = el[C_QR];
    var p   = qr * (1 + ec);           // semi-latus rectum (valid for all conics)
    var b   = perifocalBasis(el[C_OM] * DEG, el[C_INC] * DEG, el[C_W] * DEG);
    var pts = [];
    var i, theta, cosT, sinT, r, xi, yi, zi;

    if (ec < 1) {
      // Ellipse — full revolution
      for (i = 0; i <= N_PTS; i++) {
        theta = (i / N_PTS) * 2 * Math.PI;
        cosT  = Math.cos(theta); sinT = Math.sin(theta);
        r     = p / (1 + ec * cosT);
        xi    = r * (cosT * b.px + sinT * b.qx);
        yi    = r * (cosT * b.py + sinT * b.qy);
        zi    = r * (cosT * b.pz + sinT * b.qz);
        pts.push(_toScene(xi, yi, zi));
      }
    } else {
      // Hyperbola — symmetric arc ±96 % of the asymptote angle
      var thetaMax = Math.acos(-1 / ec) * 0.96;
      for (i = 0; i <= N_PTS; i++) {
        theta = -thetaMax + (i / N_PTS) * 2 * thetaMax;
        var denom = 1 + ec * Math.cos(theta);
        if (denom < 1e-6) continue;
        r = p / denom;
        if (r > 1500000) continue;      // skip far asymptotic arms
        cosT = Math.cos(theta); sinT = Math.sin(theta);
        xi   = r * (cosT * b.px + sinT * b.qx);
        yi   = r * (cosT * b.py + sinT * b.qy);
        zi   = r * (cosT * b.pz + sinT * b.qz);
        pts.push(_toScene(xi, yi, zi));
      }
    }
    return pts;
  }

  // ── Rebuild Three.js objects ──────────────────────────────────────────
  function buildGeometry(el) {
    if (_orbitLine) {
      _scene.remove(_orbitLine);
      _orbitLine.geometry.dispose();
      _orbitLine.material.dispose();
      _orbitLine = null;
    }
    if (_periDot) {
      _scene.remove(_periDot);
      _periDot.geometry.dispose();
      _periDot.material.dispose();
      _periDot = null;
    }

    var ec    = el[C_EC];
    var color = ec < 1 ? 0x00ffcc : 0xffaa33;   // cyan ellipse, amber hyperbola

    var pts = buildOrbitPoints(el);
    if (pts.length < 2) return;

    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var mat = new THREE.LineDashedMaterial({
      color:       color,
      transparent: true,
      opacity:     0.35,
      dashSize:    0.40,
      gapSize:     0.25,
      depthWrite:  false
    });
    _orbitLine = new THREE.Line(geo, mat);
    _orbitLine.computeLineDistances();
    _scene.add(_orbitLine);

    // Periapsis dot — at θ=0 the position is qr · P̂
    var qr   = el[C_QR];
    var b    = perifocalBasis(el[C_OM] * DEG, el[C_INC] * DEG, el[C_W] * DEG);
    var periS = _toScene(qr * b.px, qr * b.py, qr * b.pz);
    var dotMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.75, depthWrite: false });
    _periDot   = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), dotMat);
    _periDot.position.copy(periS);
    _scene.add(_periDot);
  }

  // ── 2D projection: Three.js world → canvas px ─────────────────────────
  var _pv = null; // THREE.Vector3 scratch — allocated lazily in init()
  function proj(v3) {
    _pv.copy(v3).project(_camera);
    var cv = _lctx.canvas;
    return {
      x:   (_pv.x *  0.5 + 0.5) * cv.width,
      y:   (_pv.y * -0.5 + 0.5) * cv.height,
      vis: _pv.z < 1.0
    };
  }

  // ── Draw 2D canvas label ──────────────────────────────────────────────
  function drawLabel(el) {
    _periPos2D = null;
    if (!_periDot) return;
    var s = proj(_periDot.position);
    if (!s.vis) return;
    _periPos2D = { x: s.x, y: s.y };

    var ec    = el[C_EC];
    var color = ec < 1 ? '#00ffcc' : '#ffaa33';
    var label = ec < 1 ? 'PERIAPSIS' : 'PERIAPSIS \u22c6';   // ⋆ for hyperbolic
    var W     = _lctx.canvas.width;

    _lctx.save();
    _lctx.font = '10px "Share Tech Mono",monospace';
    _lctx.textAlign    = 'left';
    _lctx.textBaseline = 'middle';
    var m  = _lctx.measureText(label);
    var bw = m.width + 10, bh = 14;
    var lx = s.x + 14, ly = s.y - 14;
    if (lx + bw > W - 4) lx = s.x - bw - 8;

    // Backdrop
    _lctx.fillStyle = 'rgba(0,8,18,0.75)';
    _lctx.fillRect(lx - 4, ly - bh / 2, bw, bh);
    _lctx.strokeStyle  = color;
    _lctx.lineWidth    = 0.7;
    _lctx.globalAlpha  = 0.7;
    _lctx.strokeRect(lx - 4, ly - bh / 2, bw, bh);

    // Text
    _lctx.globalAlpha = 1.0;
    _lctx.fillStyle   = color;
    _lctx.fillText(label, lx, ly);

    // Leader line
    _lctx.beginPath();
    _lctx.moveTo(s.x, s.y);
    _lctx.lineTo(lx - 4, ly);
    _lctx.strokeStyle = color;
    _lctx.lineWidth   = 0.5;
    _lctx.globalAlpha = 0.4;
    _lctx.setLineDash([2, 3]);
    _lctx.stroke();
    _lctx.setLineDash([]);
    _lctx.restore();
  }

  // ── Phase-aware popup text ────────────────────────────────────────────
  function getPhaseInfo(metSec, ec) {
    var tli      = _meta ? _meta.tli_metSec      : 91520;
    var perilune = _meta ? _meta.perilune_metSec : 433520;
    if (metSec < tli) {
      return {
        name: 'PARKING ORBIT',
        desc: 'Orion is in a low-Earth elliptical parking orbit, awaiting the Trans-Lunar Injection burn.'
      };
    }
    if (metSec < perilune) {
      return ec >= 1
        ? { name: 'TRANSLUNAR HYPERBOLIC',
            desc: 'Orion is on an Earth-centred hyperbolic escape trajectory. The instantaneous conic is unbound — the spacecraft will not return to this periapsis.' }
        : { name: 'TRANSLUNAR COAST',
            desc: 'Orion is coasting toward the Moon on an elongated elliptical orbit. Eccentricity is near 1 and climbing.' };
    }
    return ec >= 1
      ? { name: 'POST-PERILUNE HYPERBOLIC',
          desc: 'Lunar gravity has redirected Orion. The Earth-centred conic remains hyperbolic — Orion is swinging back toward Earth.' }
      : { name: 'RETURN TRAJECTORY',
          desc: 'Orion is on the return leg of a free-return ellipse. Earth-Entry Interface marks the end of this arc.' };
  }

  // ── Show popup (reuses popupEl from trajectory.js) ────────────────────
  function openPopup(sx, sy) {
    if (!_popupEl || !_currentEl) return;
    var el    = _currentEl;
    var ec    = el[C_EC];
    var qr    = el[C_QR];
    var inc   = el[C_INC];
    var om    = el[C_OM];
    var w     = el[C_W];
    var a     = el[C_A];
    var cv    = _lctx.canvas;
    var W     = cv.width, H = cv.height;

    var color = ec < 1 ? '#00ffcc' : '#ffaa33';
    var phase = getPhaseInfo(_lastMetSec, ec);

    var periAltKm = qr - EARTH_R_KM;
    var periStr   = periAltKm > 50
      ? Math.round(periAltKm).toLocaleString() + ' km alt'
      : Math.round(qr).toLocaleString() + ' km from Earth centre';

    var periodRow = '';
    if (ec < 1 && a > 0) {
      var T  = 2 * Math.PI * Math.sqrt(a * a * a / MU_KM3S2);
      var th = Math.floor(T / 3600);
      var tm = Math.floor((T % 3600) / 60);
      periodRow = '<div style="color:#7986a8;margin-top:3px;">PERIOD: ' + th + 'h&nbsp;' + tm + 'm</div>';
    }

    _popupEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
        '<span style="font-size:0.6rem;font-weight:bold;color:' + color + ';letter-spacing:0.12em;' +
              'text-shadow:0 0 8px ' + color + '55">OSCULATING ORBIT</span>' +
        '<span style="cursor:pointer;color:rgba(100,130,170,0.6);font-size:0.8rem;" ' +
              'onclick="this.parentElement.parentElement.style.display=\'none\'">&#x2715;</span>' +
      '</div>' +
      '<div style="font-size:0.44rem;color:' + color + ';letter-spacing:0.1em;margin-bottom:4px;">' + phase.name + '</div>' +
      '<div style="font-size:0.42rem;color:rgba(74,144,217,0.75);margin-bottom:8px;line-height:1.4;">' + phase.desc + '</div>' +
      '<div style="font-size:0.44rem;color:#c8d0e0;line-height:1.9;">' +
        'ECCENTRICITY: <span style="color:' + color + '">' + ec.toFixed(4) + '</span><br>' +
        'PERIAPSIS: <span style="color:' + color + '">' + periStr + '</span><br>' +
        'INCLINATION: <span style="color:' + color + '">' + inc.toFixed(2) + '\u00b0</span><br>' +
        'RAAN (\u03a9): <span style="color:' + color + '">' + om.toFixed(2) + '\u00b0</span><br>' +
        'ARG PERI (\u03c9): <span style="color:' + color + '">' + w.toFixed(2) + '\u00b0</span>' +
      '</div>' +
      periodRow;

    var left = sx + 14; if (left + 280 > W) left = sx - 290;
    var top  = sy - 20; if (top + 210 > H) top = H - 215; if (top < 4) top = 4;
    _popupEl.style.left    = Math.max(4, left) + 'px';
    _popupEl.style.top     = Math.max(4, top)  + 'px';
    _popupEl.style.display = 'block';
    _popupOpen = true;
  }

  // ── Public API ────────────────────────────────────────────────────────
  return {

    /**
     * init(cfg)
     * cfg = { scene, camera, lctx, toScene, rotMat, popupEl }
     * toScene(x,y,z) → THREE.Vector3 in scene coordinates.
     */
    init: function (cfg) {
      _scene   = cfg.scene;
      _camera  = cfg.camera;
      _lctx    = cfg.lctx;
      _toScene = cfg.toScene;
      _popupEl = cfg.popupEl;
      _pv      = new THREE.Vector3();

      fetch('data/osculating-elements.json')
        .then(function (r) { return r.json(); })
        .then(function (json) {
          _meta = json.meta;
          _data = json.data;
          console.log('[OsculatingOrbit] Loaded ' + _data.length + ' rows.');
        })
        .catch(function (err) {
          // Graceful no-op: module simply stays inactive
          console.warn('[OsculatingOrbit] JSON load failed — overlay disabled.', err);
        });
    },

    /**
     * update(metSec)
     * Call once per animation frame, AFTER lctx.clearRect().
     * Rebuilds 3-D geometry every 10 frames; redraws 2-D label every frame.
     */
    update: function (metSec) {
      if (!_data) return;

      _frameCount++;
      _lastMetSec = metSec;

      var el = interpolate(metSec);
      if (!el) return;
      _currentEl = el;

      if (_frameCount % 10 === 0 || !_orbitLine) {
        buildGeometry(el);
      }

      drawLabel(el);
    },

    /**
     * handleClick(mx, my)
     * mx, my: canvas pixel coordinates (already scaled by scaleX/scaleY).
     * Returns true if the click was consumed (hit inside 30 px of periapsis dot).
     */
    handleClick: function (mx, my) {
      // Sync _popupOpen with actual DOM state
      if (_popupEl && _popupEl.style.display === 'none') _popupOpen = false;

      if (!_periPos2D) return false;
      var dx = mx - _periPos2D.x, dy = my - _periPos2D.y;
      if (Math.sqrt(dx * dx + dy * dy) > 30) return false;

      if (_popupOpen) {
        if (_popupEl) _popupEl.style.display = 'none';
        _popupOpen = false;
      } else {
        openPopup(_periPos2D.x, _periPos2D.y);
      }
      return true;
    }
  };

}());
