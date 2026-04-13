# CSS Split Plan

Audit of `css/styles.css` for refactoring into common, A2 (Artemis II), and Hub (Artemis III) stylesheets.

## Summary

- **Total rules audited:** ~4214 lines
- **Common:** ~1580 lines (typography, variables, base layout, reusable components)
- **A2:** ~1940 lines (trajectory, timeline, telemetry, DSN, scrub bar, archive mode)
- **Hub:** ~650 lines (hub grid, launch hero, milestones, partners, crew TBA, starship ticker)
- **Ambiguous / needs review:** ~44 rules (responsive overrides mixing A2 + common)

---

## Common rules

| Selector / group | Lines | Notes |
|---|---|---|
| `*, *::before, *::after` (reset) | 1 | Universal box-sizing |
| `:root` (CSS variables) | 3-21 | Color palette, fonts, shadows |
| `.visually-hidden` | 23-33 | Accessibility utility |
| `.skip-link` | 35-55 | Accessibility skip navigation |
| `@media (prefers-reduced-motion)` | 57-63 | Motion accessibility |
| `html, body` | 65-74 | Base typography, background |
| `body::after` (scanline) | 77-83 | Decorative overlay |
| `#main-content` | 86-96 | Base grid (overridden per page) |
| `#site-footer`, `.footer-*` | 98-165 | Site footer, links, disclaimer |
| `.panel`, `.panel-header`, `.panel-body` | 166-235 | Base panel component |
| `.placeholder`, `.placeholder-*` | 237-284 | Placeholder panel styles |
| `.mobile-toggle` | 217-228 | Mobile collapse toggle button |
| `#unit-toggle` | 364-371 | Unit toggle button (km/mi) |
| `#mission-updates`, `.news-*` | 556-630 | News/updates feed panel |
| `.yt-tabs`, `.yt-tab`, `.yt-frame` | 1202-1238 | YouTube tab switcher |
| `.yt-expand-btn`, `#yt-overlay*` | 1240-1297 | YouTube fullscreen overlay |
| `#panel-overlay*` | 1298-1340 | Generic panel expand overlay |
| `.corner-tl`, `.corner-br` | 1540-1549 | Corner accent decorations |
| `#crew-modal*`, `.crew-modal-*` | 1550-1731 | Crew bio modal |
| `#watermark` | 1733-1744 | Watermark element |
| `.drag-handle`, `.panel.drag-*` | 2305-2323 | Drag-to-reorder UI |
| `#reset-layout-btn` | 2328-2347 | Reset layout button |
| `#ref-nav`, `.ref-nav-btn` | 2489-2655 | Reference guide navbar |
| `#ref-modal*`, `.ref-*` | 2657-3015 | Reference guide modal + content |
| `#ref-share-row`, `.ref-share-btn` | 3017-3055 | Share buttons row |
| Hamburger nav + crew strip integration | 3057-3219 | Mobile nav menu |
| Orange polish transitions | 3220-3298 | Interactive element transitions |
| `:focus-visible` | 3410-3422 | Keyboard focus indicators |
| Mobile touch targets | 3424-3437 | 44px min touch targets |
| Space Mono fix | 3445-3450 | Font spacing adjustment |
| `.panel:focus-within` aura | 3452-3457 | Active panel glow |

---

## A2 rules

| Selector / group | Lines | Notes |
|---|---|---|
| `#top-bar` | 288-299 | Top bar container (flex layout) |
| `#tb-met`, `.tb-sect-label`, `#met-display`, `#utc-display` | 302-336 | MET clock section |
| `#signal-pill`, `@keyframes pulse-green` | 337-362 | Signal status indicator |
| `#tb-phase`, `.phase-bar`, `.phase-node`, `.phase-pip` | 373-416 | Mission phase progress bar |
| `.tb-telem`, `.telem-label`, `.telem-value`, `.telem-unit` | 418-473 | Telemetry data sections |
| `#tb-controls` | 446-454 | Top bar controls container |
| `#telem-badge`, `.telem-badge-*` | 457-464 | LIVE/EST badges |
| `@keyframes digit-flip`, `.telem-val-row` | 466-473 | Telemetry value animation |
| `.earth-extras`, `.earth-extra-*` | 475-498 | Earth block sub-stats |
| `.stat-block`, `.stat-label`, `.stat-value`, `.stat-sub` | 500-536 | Countdown stat blocks |
| `.crew-strip-photo`, `.crew-backup`, `.backup-badge` | 538-554 | Crew strip avatars |
| `#crew-strip`, `.crew-strip-*` | 632-691 | Crew strip component |
| `.sw-*`, `#sw-tooltip`, `#sw-full-popup`, `#sw-explain-link` | 693-918 | Space weather widget |
| `.tl-filters`, `.tl-filter` | 922-951 | Timeline phase filter tabs |
| `.tl-activity`, `.tl-cat`, `.tl-dur`, `.tl-crit-*` | 942-976 | Timeline activity styles |
| `#flight-day-badge`, `#feed-blog::before` | 977-994 | Timeline panel decorations |
| `.timeline-scroll`, `.tl-day-header`, `.tl-event`, `.tl-*` | 996-1083 | Timeline event list |
| `#panel-overlay-content` overrides | 1085-1187 | Expanded overlay sizing (A2 panels) |
| `#tl-next-event`, `.tl-next-*` | 1189-1200 | Next event countdown banner |
| `#local-time-display` | 1199 | Local time in top bar |
| `#telem-overlay`, `#telem-overlay-inner`, `.to-*` | 1341-1528 | Telemetry cinematic overlay |
| A2 grid positions (`#feed-youtube`, `#feed-arow`, etc.) | 1530-1537 | Panel grid placement |
| `#dsn-content`, `.dsn-links`, `.dsn-link-card` | 2054-2153 | DSN panel base styles |
| `.dsn-signal-track`, `@keyframes dsnFlow*` | 2156-2186 | DSN signal animations |
| `.dsn-rtlt-*`, `.dsn-size-badge`, `.dsn-band-badge` | 2187-2264 | DSN enhanced metrics |
| `#dsn-tooltip`, `.dsn-network-map`, `.dsn-funstat` | 2239-2304 | DSN tooltip + network map |
| `.traj-hud`, `.hud-*` | 2349-2441 | Trajectory HUD panel |
| `#traj-mobile-strip`, `.tms-*` | 2443-2487 | Mobile trajectory stats |
| `#crew-activity-strip`, `.cas-*` | 3299-3408 | Crew activity ticker |
| `#archive-banner`, `.archive-banner-*` | 3459-3491 | Archive mode banner |
| `#scrub-bar`, `.scrub-*` | 3493-3561 | Timeline scrub bar |

---

## Hub rules

| Selector / group | Lines | Notes |
|---|---|---|
| `body.hub-layout #main-content` | 3563-3576 | Hub 6-row grid override |
| `body.hub-layout` grid area assignments | 3578-3589 | Panel-to-area mapping |
| `#launch-hero`, `.hero-*` | 3591-3671 | Launch countdown hero |
| `body.hub-layout #top-bar` | 3673-3678 | Hub top bar flex override |
| `.hub-tb-cell`, `.hub-tb-label`, `.hub-tb-value`, `.hub-tb-static` | 3681-3713 | Hub status strip cells |
| `.status-pill`, `.status-pill.*` | 3715-3737 | Status pill badges |
| `#crew-panel`, `#crew-tba-grid`, `.crew-tba-*` | 3738-3803 | Crew TBA panel |
| `#milestones-panel`, `#partners-panel`, `#starship-ticker-panel` shell | 3805-3811 | Empty panel declarations |
| `.partners-container`, `.partner-card`, `.partner-*` | 3812-3961 | Partners panel cards |
| `#milestones-panel` scrollbar, `.ms-timeline`, `.milestone-*` | 3963-4099 | Milestones timeline |
| `@media (max-width: 768px)` hub mobile | 4101-4134 | Hub mobile grid + sizing |
| `#starship-ticker-panel`, `.ticker-*` | 4136-4213 | Starship ticker panel |

---

## Ambiguous — needs manual review

| Selector / group | Lines | Reason |
|---|---|---|
| `@media (min-width: 768px) and (max-width: 1199px)` | 1747-1793 | Tablet responsive: mixes A2 grid positions, common panel sizing, A2 top-bar grid areas |
| `@media (max-width: 767px)` | 1798-2052 | Mobile responsive: mixes A2 top-bar grid, common panel styles, A2 DSN sizing, common crew modal fullscreen, A2 trajectory, A2 crew strip |
| `.news-tab.active`, `.tl-filter.active` | 3272-3280 | Orange polish: `.tl-filter` is A2-only but `.news-tab` is common |
| `#panel-overlay-content` overrides | 1085-1187 | Expanded panel: contains overrides for both A2 panels (DSN, timeline, space weather) |
| `#tb-controls .ref-observer-btn` | 3249 | Observer button visibility: references A2-specific `#tb-controls` |
| `#top-bar .stat-block { min-width: 0 }` | 1842 | Mobile fix: in mobile media query, targets A2 stat blocks |
| `body.archive-mode #main-content` | 3554-3560 | Archive padding: A2-only but uses general `#main-content` |
| `.panel-header .panel-heading--compact` | 212-214 | Compact heading variant: unclear if used in both |

---

## Notes for implementation

1. **CSS Variables**: Keep all `:root` variables in `common.css` — both pages share the color palette.

2. **Panel base**: The `.panel`, `.panel-header`, `.panel-body` classes are shared — keep in common.

3. **Responsive breakpoints**: The tablet (768-1199px) and mobile (<768px) media queries will need to be split. Consider:
   - Common responsive rules → `common.css`
   - A2-specific responsive rules → `a2.css`
   - Hub-specific responsive rules → `hub.css`

4. **#mission-updates**: Used on both pages for news feed — keep in common.

5. **Reference guide**: Entirely common — the orange-themed nav/modal serves both pages.

6. **!important guards**: Hub uses `!important` on grid assignments (lines 3581-3589) to override legacy A2 rules. After split, these can be removed.

7. **Load order**: `common.css` → page-specific CSS (`a2.css` or `hub.css`).
