#!/usr/bin/env python3
"""
Parametric reentry generator for Artemis II.

Generates synthetic reentry points from the last OEM point (index 645,
metSec=782301.112) through splashdown (metSec=783960), replacing all
previous synthetic points (indices 646+).

Profile:
  - EI at t=783180 (122 km)
  - Peak heating at t=783480 (62 km)
  - Skip apex at t=783700 (85 km)
  - Chutes at t=783840 (10 km)
  - Splashdown at t=783960 (0.2 km)
"""

import json
import math

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
R_EARTH = 6371.0       # km
GM      = 398600.4418  # km^3/s^2

# ---------------------------------------------------------------------------
# Last OEM point (index 645) — hard-coded from JSON for reproducibility
# ---------------------------------------------------------------------------
T0   = 782301.112   # metSec
X0   =  3908.08     # km ECI
Y0   =  4798.30
Z0   =  2018.95
VX0  =  -8.942042   # km/s ECI
VY0  =   3.322767
VZ0  =   5.45694

# Moon at last two OEM points for linear extrapolation
# index 644: metSec=781870.05
T_MOON_A  = 781870.05
MX_A, MY_A, MZ_A = 195515.51, -307588.02, -157464.95
# index 645: metSec=782301.112
T_MOON_B  = 782301.112
MX_B, MY_B, MZ_B = 195873.73, -307393.02, -157346.42

# ---------------------------------------------------------------------------
# Altitude keyframes  (metSec, altitude_km)
# ---------------------------------------------------------------------------
ALT_KEYFRAMES = [
    (782301.112, 138.45),   # last OEM point
    (782600.0,   125.0),    # descending approach
    (783000.0,   122.5),    # converging on EI
    (783180.0,   122.0),    # EI (entry interface)
    (783480.0,    62.0),    # peak heating / deepest dip
    (783570.0,    72.0),    # start of skip
    (783660.0,    85.0),    # skip apex
    (783750.0,    40.0),    # second descent
    (783840.0,    10.0),    # drogue chutes deploy
    (783870.0,     7.0),    # under chutes, descending
    (783900.0,     4.5),    # continuing descent
    (783930.0,     2.0),    # low altitude
    (783960.0,     0.2),    # splashdown
]

# Speed keyframes  (metSec, speed_km/s)
SPEED_KEYFRAMES = [
    (782301.112, 10.99),
    (783180.0,   10.5),    # EI
    (783480.0,    7.0),    # peak heating
    (783660.0,    3.5),    # skip apex
    (783750.0,    2.5),    # second descent
    (783840.0,    0.5),    # chutes
    (783870.0,    0.35),   # descending under chutes
    (783900.0,    0.22),   # slower
    (783930.0,    0.12),   # near splashdown
    (783960.0,    0.08),   # splashdown
]

# ---------------------------------------------------------------------------
# PCHIP monotone cubic interpolation (pure Python, no scipy)
# ---------------------------------------------------------------------------
def _pchip_slopes(xs, ys):
    """Compute Fritsch-Carlson monotone slopes."""
    n = len(xs)
    h = [xs[i+1] - xs[i] for i in range(n-1)]
    d = [(ys[i+1] - ys[i]) / h[i] for i in range(n-1)]

    m = [0.0] * n
    m[0]   = d[0]
    m[n-1] = d[n-2]
    for i in range(1, n-1):
        if d[i-1] * d[i] <= 0:
            m[i] = 0.0
        else:
            m[i] = 2.0 / (1.0/d[i-1] + 1.0/d[i])
    # monotonicity constraints
    for i in range(n-1):
        if abs(d[i]) < 1e-12:
            m[i]   = 0.0
            m[i+1] = 0.0
        else:
            alpha = m[i]   / d[i]
            beta  = m[i+1] / d[i]
            if alpha < 0 or beta < 0:
                m[i]   = 0.0
                m[i+1] = 0.0
            elif alpha**2 + beta**2 > 9:
                tau    = 3.0 / math.sqrt(alpha**2 + beta**2)
                m[i]   = tau * alpha * d[i]
                m[i+1] = tau * beta  * d[i]
    return m


def pchip_eval(xs, ys, t):
    """Evaluate PCHIP interpolant at scalar t (clamped to range)."""
    ms = _pchip_slopes(xs, ys)
    n  = len(xs)
    if t <= xs[0]:
        return ys[0]
    if t >= xs[-1]:
        return ys[-1]
    lo, hi = 0, n - 2
    while lo < hi - 1:
        mid = (lo + hi) // 2
        if xs[mid] <= t:
            lo = mid
        else:
            hi = mid
    i = lo
    h = xs[i+1] - xs[i]
    u = (t - xs[i]) / h
    h00 =  2*u**3 - 3*u**2 + 1
    h10 =    u**3 - 2*u**2 + u
    h01 = -2*u**3 + 3*u**2
    h11 =    u**3 -   u**2
    return h00*ys[i] + h10*h*ms[i] + h01*ys[i+1] + h11*h*ms[i+1]


# ---------------------------------------------------------------------------
# RK4 Keplerian integrator (gravity only — gives direction of travel)
# ---------------------------------------------------------------------------
def gravity_deriv(state):
    x, y, z, vx, vy, vz = state
    r3 = (x*x + y*y + z*z) ** 1.5
    a  = -GM / r3
    return [vx, vy, vz, a*x, a*y, a*z]


def rk4_step(state, dt):
    k1 = gravity_deriv(state)
    s2 = [state[i] + 0.5*dt*k1[i] for i in range(6)]
    k2 = gravity_deriv(s2)
    s3 = [state[i] + 0.5*dt*k2[i] for i in range(6)]
    k3 = gravity_deriv(s3)
    s4 = [state[i] + dt*k3[i] for i in range(6)]
    k4 = gravity_deriv(s4)
    return [state[i] + dt*(k1[i] + 2*k2[i] + 2*k3[i] + k4[i])/6.0
            for i in range(6)]


# Cache Keplerian states to avoid re-integrating from scratch each time
_kep_cache_t   = T0
_kep_cache_st  = [X0, Y0, Z0, VX0, VY0, VZ0]

def keplerian_state_at(t_metsec, dt_step=10.0):
    """Return Keplerian state at t_metsec by integrating from T0."""
    global _kep_cache_t, _kep_cache_st
    if t_metsec <= T0:
        return [X0, Y0, Z0, VX0, VY0, VZ0]
    # If cache is ahead of requested time, reset
    if _kep_cache_t > t_metsec + 1e-6:
        _kep_cache_t  = T0
        _kep_cache_st = [X0, Y0, Z0, VX0, VY0, VZ0]
    remaining = t_metsec - _kep_cache_t
    state = list(_kep_cache_st)
    while remaining > 1e-9:
        step  = min(dt_step, remaining)
        state = rk4_step(state, step)
        remaining -= step
    _kep_cache_t  = t_metsec
    _kep_cache_st = state
    return state


# ---------------------------------------------------------------------------
# Moon linear extrapolation
# ---------------------------------------------------------------------------
_dt_moon = T_MOON_B - T_MOON_A
_vmx = (MX_B - MX_A) / _dt_moon
_vmy = (MY_B - MY_A) / _dt_moon
_vmz = (MZ_B - MZ_A) / _dt_moon

def moon_at(t_metsec):
    dt = t_metsec - T_MOON_B
    return (
        round(MX_B + _vmx * dt, 2),
        round(MY_B + _vmy * dt, 2),
        round(MZ_B + _vmz * dt, 2),
    )


# ---------------------------------------------------------------------------
# Shorthand interpolators
# ---------------------------------------------------------------------------
alt_xs = [k[0] for k in ALT_KEYFRAMES]
alt_ys = [k[1] for k in ALT_KEYFRAMES]
spd_xs = [k[0] for k in SPEED_KEYFRAMES]
spd_ys = [k[1] for k in SPEED_KEYFRAMES]

def alt_at(t):
    return max(0.0, pchip_eval(alt_xs, alt_ys, t))

def speed_at(t):
    return max(0.01, pchip_eval(spd_xs, spd_ys, t))


# ---------------------------------------------------------------------------
# Build time sample list (30-s grid + keyframe snap-ins)
# ---------------------------------------------------------------------------
T_END = 783960.0
STEP  = 30.0

kf_times = [k[0] for k in ALT_KEYFRAMES if k[0] > T0]
kf_times.append(T_END)

sample_times = []
t = T0 + STEP
while t <= T_END + 1e-6:
    sample_times.append(min(t, T_END))
    t += STEP

# Insert keyframe times if not within 5 s of an existing sample
for kft in kf_times:
    if not any(abs(s - kft) < 5.0 for s in sample_times):
        sample_times.append(kft)

sample_times = sorted(set(round(t, 3) for t in sample_times))
# Remove anything past T_END
sample_times = [t for t in sample_times if t <= T_END + 1e-6]
if sample_times[-1] > T_END + 1e-3:
    sample_times[-1] = T_END


# ---------------------------------------------------------------------------
# Generate points
# ---------------------------------------------------------------------------
NOTES = {
    783180.0: "EI",
    783480.0: "peak heating",
    783570.0: "start skip",
    783660.0: "skip apex",
    783750.0: "second descent",
    783840.0: "chutes",
    783960.0: "SPLASHDOWN",
}

print(f"{'metSec':>12}  {'alt_km':>8}  {'speed':>8}  note")
print("-" * 55)

new_points = []
EPS = 1.0  # seconds for finite-difference

for t in sample_times:
    kep = keplerian_state_at(t)
    kx, ky, kz, kvx, kvy, kvz = kep

    r_kep      = math.sqrt(kx*kx + ky*ky + kz*kz)
    alt_target = alt_at(t)
    r_target   = R_EARTH + alt_target
    scale      = r_target / r_kep

    # Position: Keplerian direction scaled to target altitude
    px = round(kx * scale, 2)
    py = round(ky * scale, 2)
    pz = round(kz * scale, 2)

    # Velocity decomposition
    pos_hat = [px/r_target, py/r_target, pz/r_target]
    kv      = [kvx, kvy, kvz]
    kv_r    = sum(kv[i]*pos_hat[i] for i in range(3))
    kv_t    = [kv[i] - kv_r*pos_hat[i] for i in range(3)]
    kv_t_mag = math.sqrt(sum(v**2 for v in kv_t))

    # Desired radial velocity from altitude derivative
    dalt_dt  = (alt_at(t + EPS) - alt_at(t - EPS)) / (2*EPS)

    # Tangential speed from speed keyframe
    spd_target = speed_at(t)
    vt_sq = spd_target**2 - dalt_dt**2
    vt_target = math.sqrt(max(0.0, vt_sq))

    if kv_t_mag > 1e-9:
        t_hat = [v / kv_t_mag for v in kv_t]
    else:
        # Fallback: cross of pos_hat with Z-axis
        t_hat = [-pos_hat[1], pos_hat[0], 0.0]
        tl = math.sqrt(t_hat[0]**2 + t_hat[1]**2)
        t_hat = [v/tl for v in t_hat] if tl > 1e-9 else [1, 0, 0]

    vx_f = round(dalt_dt * pos_hat[0] + vt_target * t_hat[0], 6)
    vy_f = round(dalt_dt * pos_hat[1] + vt_target * t_hat[1], 6)
    vz_f = round(dalt_dt * pos_hat[2] + vt_target * t_hat[2], 6)

    mx, my, mz = moon_at(t)
    dist_moon  = round(math.sqrt((px-mx)**2 + (py-my)**2 + (pz-mz)**2), 2)

    note = NOTES.get(round(t, 1), "")
    print(f"{t:12.3f}  {alt_target:8.2f}  {spd_target:8.4f}  {note}")

    new_points.append({
        "metSec":      round(t, 3),
        "orion":       {"x": px, "y": py, "z": pz,
                        "vx": vx_f, "vy": vy_f, "vz": vz_f},
        "moon":        {"x": mx, "y": my, "z": mz},
        "distEarthKm": round(alt_target, 2),
        "distMoonKm":  dist_moon,
        "speedKms":    round(spd_target, 6),
    })

print(f"\nGenerated {len(new_points)} synthetic points")

# ---------------------------------------------------------------------------
# Key-event validation
# ---------------------------------------------------------------------------
print("\n--- Key event validation ---")
key_events = [
    (783180, "EI (122 km expected)"),
    (783480, "Peak heating (62 km expected)"),
    (783660, "Skip apex (85 km expected)"),
    (783840, "Chutes (10 km expected)"),
    (783960, "Splashdown (0.2 km expected)"),
]
for kt, label in key_events:
    closest = min(new_points, key=lambda p: abs(p['metSec'] - kt))
    print(f"  t={kt}  {label}")
    print(f"    -> t={closest['metSec']:.1f}, alt={closest['distEarthKm']:.1f} km, speed={closest['speedKms']:.3f} km/s")

# ---------------------------------------------------------------------------
# Update JSON
# ---------------------------------------------------------------------------
print("\nLoading mission-ephemeris.json ...")
with open("data/mission-ephemeris.json") as f:
    data = json.load(f)

original_points = data["points"][:646]
print(f"  OEM points kept:  {len(original_points)}")

data["points"] = original_points + new_points
data["meta"]["pointCount"] = len(data["points"])
data["meta"]["generated"]  = "2026-04-08T00:00:00Z"

print(f"  New total:        {len(data['points'])}")

with open("data/mission-ephemeris.json", "w") as f:
    json.dump(data, f, separators=(",", ":"))

print("\nDone — mission-ephemeris.json updated successfully.")
