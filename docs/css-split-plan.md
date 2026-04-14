# CSS Split Plan

Audit of `css/styles.css` for refactoring into common, A2 (Artemis II), and Hub (Artemis III) stylesheets.

**Last updated:** 2026-04-14 (Phase 1 full audit)

## Summary

- **Total rules audited:** 4214 lines, ~180 rule groups
- **Common:** ~115 rule groups (~2450 lines) — typography, variables, base layout, reusable components
- **A2:** ~25 rule groups (~650 lines) — trajectory, timeline, telemetry overlay, crew activity, scrub bar, archive mode
- **Hub:** ~30 rule groups (~650 lines) — hub grid, launch hero, milestones, partners, crew TBA, starship ticker
- **Ambiguous / needs review:** ~10 rule groups — responsive overrides mixing A2 + common, `!important` guards

---

## Common rules

Shared typography, colors, CSS variables, layout primitives, buttons, pills, utility classes, overlays, and components used on both pages.

| Selector / group | Lines | Notes |
|---|---|---|
| `*, *::before, *::after` (reset) | 1 | Universal box-sizing |
| `:root` (CSS variables) | 3-21 | Color palette, fonts, glows |
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
| `#mission-updates`, `.news-live-badge` | 556-570 | News panel header |
| `@keyframes blink-green` | 568-570 | Blink animation |
| `.news-tabs`, `.news-tab` | 572-586 | News tab switcher |
| `.news-feed`, `.news-item`, `.news-*` | 588-630 | News feed items |
| `#crew-strip`, `.crew-strip-*` | 632-691 | Crew strip base component |
| `.sw-label`, `.sw-info-btn` | 695-732 | Space weather labels/buttons |
| `#sw-tooltip`, `.sw-tt-*` | 735-806 | Space weather tooltip |
| `#sw-full-popup`, `#sw-full-inner` | 809-875 | Space weather popup modal |
| `#sw-explain-link` | 878-897 | "What does this mean?" link |
| `@media (max-width: 767px)` SW tooltip | 900-917 | Mobile bottom sheet |
| `.yt-tabs`, `.yt-tab`, `.yt-frame` | 1202-1238 | YouTube tab switcher |
| `.yt-expand-btn`, `#yt-overlay*` | 1240-1297 | YouTube fullscreen overlay |
| `#panel-overlay*` | 1298-1340 | Generic panel expand overlay |
| `.corner-tl`, `.corner-br` | 1540-1549 | Corner accent decorations |
| `#crew-modal-overlay`, `#crew-modal*` | 1564-1731 | Crew bio modal |
| `#watermark` | 1734-1743 | Watermark element |
| `#dsn-content`, `.dsn-links`, `.dsn-link-card` | 2057-2064 | DSN panel base |
| `.dsn-link-header`, `.dsn-station-name`, `.dsn-dir` | 2065-2077 | DSN link header |
| `.dsn-status-bar`, `.dsn-dot-pulse` | 2079-2095 | DSN status bar |
| `.dsn-metrics`, `.dsn-metric*` | 2097-2112 | DSN metrics display |
| `.dsn-nolink`, `.dsn-nolink-subs` | 2114-2122 | DSN no-link state |
| `.dsn-network`, `.dsn-complex*` | 2124-2153 | DSN network map |
| `@keyframes dsnFlow*`, `.dsn-signal-track` | 2158-2186 | DSN signal animation |
| `@keyframes dsnBounce`, `.dsn-rtlt-*` | 2188-2210 | DSN RTLT animation |
| `.dsn-size-badge`, `.dsn-band-badge`, `.dsn-info-btn` | 2213-2230 | DSN badges |
| `.dsn-pointing`, `#dsn-tooltip` | 2233-2263 | DSN pointing/tooltip |
| `.dsn-network-map`, `.dsn-world-svg` | 2266-2271 | DSN world map |
| `.dsn-activity`, `.dsn-funstat` | 2274-2293 | DSN activity labels |
| `.drag-handle`, `.panel.drag-*` | 2306-2323 | Drag-to-reorder UI |
| `#reset-layout-btn` | 2328-2347 | Reset layout button |
| `#ref-nav`, `.ref-brand`, `#ref-brand-*` | 2493-2609 | Reference guide navbar |
| `#ref-menu-items`, `.ref-nav-btn` | 2611-2655 | Reference nav items |
| `#ref-modal`, `#ref-modal-*` | 2660-2740 | Reference modal container |
| `.ref-loading`, `.ref-error` | 2746-2754 | Reference loading states |
| `.ref-section`, `.ref-intro`, `.ref-h2` | 2756-2782 | Reference content base |
| `.ref-label`, `.ref-body`, `.ref-hl` | 2784-2803 | Reference text styles |
| `.ref-spec-table`, `.ref-spec-*` | 2806-2834 | Reference spec tables |
| `.ref-callout`, `.ref-callout-*` | 2837-2859 | Reference callouts |
| `.ref-subsection*`, `.ref-objectives*` | 2862-2894 | Reference subsections |
| `.ref-timeline`, `.ref-tl-*` | 2897-2930 | Reference timeline |
| `.ref-crew-grid`, `.ref-crew-*` | 2933-2964 | Reference crew grid |
| `.ref-cubesat*` | 2967-2997 | Reference cubesat grid |
| `.ref-two-col` | 3000-3005 | Reference two-column |
| `@media (max-width: 600px)` ref | 3008-3015 | Reference mobile |
| `#ref-share-row`, `.ref-share-btn` | 3018-3055 | Share buttons row |
| `@media (max-width: 767px)` ref-nav | 3057-3103 | Reference nav mobile |
| `#ref-nav-toggle` | 3107-3155 | Reference hamburger toggle |
| `#ref-nav #crew-strip` | 3164-3190 | Crew strip in nav |
| `#ref-nav .ref-nav-btn` | 3192-3203 | Nav buttons in hamburger |
| Mission orange polish selectors | 3221-3298 | Orange accent transitions |
| `:focus-visible` | 3411-3422 | Keyboard focus indicators |
| `@media (max-width: 767px)` touch targets | 3425-3443 | 44px min touch targets |
| `.traj-hud` font fix | 3446-3450 | Space Mono spacing |
| `.panel:focus-within` aura | 3453-3457 | Active panel glow |

---

## A2 rules

Artemis II specific: trajectory 3D view, gantt/timeline, crew activity strip, stats grid, scrub bar, archive mode.

| Selector / group | Lines | Notes |
|---|---|---|
| `#top-bar` (base container) | 288-300 | Flex layout container |
| `#tb-met`, `.tb-sect-label`, `#met-display` | 302-336 | MET clock section |
| `#signal-pill`, `@keyframes pulse-green` | 337-362 | Signal status indicator |
| `#tb-phase`, `#current-phase-name` | 374-391 | Mission phase section |
| `.phase-bar`, `.phase-node`, `.phase-pip` | 393-416 | Phase progress bar |
| `.tb-telem`, `.telem-label`, `.telem-value`, `.telem-unit` | 418-464 | Telemetry data sections |
| `#tb-controls` | 446-454 | Top bar controls container |
| `#telem-badge`, `.telem-badge-*` | 458-464 | LIVE/EST badges |
| `@keyframes digit-flip`, `.telem-val-row` | 466-474 | Telemetry value animation |
| `.earth-extras`, `.earth-extra-*` | 476-498 | Earth block sub-stats |
| `.stat-block`, `.stat-label`, `.stat-value`, `.stat-sub` | 500-523 | Stats grid blocks |
| `.stat-value.warn/complete/good/imminent` | 525-536 | Stat state modifiers + perilune pulse |
| `.crew-strip-photo`, `.crew-backup`, `.backup-badge` | 538-554 | Crew strip avatars |
| `.tl-filters`, `.tl-filter` | 923-939 | Timeline phase filter tabs |
| `.tl-filter-crew` | 938-939 | Crew activity filter variant |
| `.tl-activity`, `.tl-cat`, `.tl-dur` | 942-963 | Crew activity rows |
| `.tl-crit`, `.tl-crit-CRITICAL/HIGH/MEDIUM/ROUTINE` | 966-975 | Criticality badges |
| `#flight-day-badge` | 977-980 | Flight day badge |
| `#feed-blog::before` | 982-994 | Artemis logo watermark |
| `.timeline-scroll` | 996-1001 | Timeline scroll container |
| `.tl-day-header` | 1002-1008 | Day header rows |
| `.tl-event`, `.tl-event:hover` | 1009-1015 | Event rows |
| `.tl-detail`, `.tl-desc-text`, `.tl-crew` | 1016-1043 | Event detail expansion |
| `.tl-event.tl-complete/active/upcoming` | 1044-1056 | Event state styles |
| `.tl-dot`, `@keyframes tl-pulse` | 1047-1056 | Status dots |
| `.tl-met`, `.tl-name`, `.tl-check` | 1057-1071 | MET and name styling |
| `.tl-localtime`, `.tl-eta` | 1073-1083 | Local time/ETA display |
| `#panel-overlay-content` top-bar overrides | 1085-1139 | Expanded top-bar in overlay |
| `#panel-overlay-content .tl-*` | 1128-1139 | Expanded timeline styles |
| `#tl-next-event`, `.tl-next-*` | 1190-1197 | Next event countdown |
| `#local-time-display` | 1199 | Local clock in top bar |
| `#telem-overlay`, `#telem-overlay-inner` | 1342-1374 | Telemetry cinematic overlay |
| `.to-row`, `.to-block`, `.to-sect-label` | 1376-1387 | Overlay layout |
| `@keyframes toGlow*`, `.to-met-clock`, `.to-met-sub` | 1389-1419 | Overlay MET clock |
| `.to-phase-name`, `.to-current-event`, `.to-next-event` | 1422-1438 | Overlay phase info |
| `.to-phase-pip-row`, `.to-phase-pip` | 1441-1461 | Overlay phase pips |
| `.to-gauge`, `.to-gauge-*` | 1464-1494 | Overlay gauges |
| `.to-extra-item`, `.to-extra-val`, `#to-unit-toggle` | 1497-1517 | Overlay extras |
| `@media (max-width: 767px)` telemetry overlay | 1520-1528 | Mobile overlay |
| A2 grid positions (`#feed-youtube`, `#feed-arow`, etc.) | 1531-1537 | Panel grid placement |
| `#panel-overlay-content .dsn-*` overrides | 2296-2303 | DSN expanded overlay |
| `.traj-hud`, `.hud-toggle` | 2350-2401 | Trajectory HUD panel |
| `.hud-section`, `.hud-section-label` | 2402-2413 | HUD sections |
| `.hud-row`, `.hud-key`, `.hud-val` | 2414-2437 | HUD data rows |
| `@media (max-width: 767px)` traj-hud hide | 2438-2441 | Hide HUD on mobile |
| `#traj-mobile-strip`, `.tms-*` | 2444-2487 | Mobile trajectory strip |
| `#crew-activity-strip`, `.cas-current`, `.cas-emoji` | 3300-3333 | Crew activity strip |
| `.cas-label`, `.cas-detail`, `.cas-sep` | 3335-3362 | Activity strip content |
| `.cas-upcoming`, `.cas-next-item` | 3366-3380 | Upcoming activities |
| `@keyframes cas-pulse` | 3383-3391 | Activity change pulse |
| `@media (max-width: 767px)` crew-activity-strip | 3393-3408 | Mobile activity strip |
| `#archive-banner`, `.archive-banner-*` | 3459-3491 | Archive mode banner |
| `#scrub-bar`, `#scrub-bar button/input` | 3494-3552 | Time scrub bar |
| `body.archive-mode #main-content` | 3554-3560 | Archive mode padding |

---

## Hub rules

Artemis III specific: hub grid, launch hero, milestones panel, partner cards, starship ticker.

| Selector / group | Lines | Notes |
|---|---|---|
| `body.hub-layout #main-content` | 3566-3576 | Hub 6-row grid override |
| `body.hub-layout` grid area assignments | 3581-3589 | Panel-to-area mapping (!important) |
| `#launch-hero`, `#launch-hero::before` | 3592-3609 | Launch hero container |
| `.hero-mission-id` | 3610-3617 | Mission ID text |
| `.hero-net` | 3619-3624 | NET date display |
| `.hero-countdown`, `.hero-cd-sign`, `.hero-cd-block` | 3626-3643 | Countdown blocks |
| `.hero-cd-value`, `.hero-cd-label`, `.hero-cd-sep` | 3644-3664 | Countdown digits |
| `.hero-footnote` | 3666-3671 | Countdown footnote |
| `body.hub-layout #top-bar` | 3674-3680 | Hub top-bar override |
| `.hub-tb-cell`, `.hub-tb-label`, `.hub-tb-value` | 3682-3707 | Hub status cells |
| `.hub-tb-static` | 3709-3713 | Static status text |
| `.status-pill`, `.status-pill.green/amber/red/dim` | 3716-3736 | Status pill badges |
| `#crew-panel`, `#crew-tba-grid` | 3739-3750 | Crew TBA panel container |
| `.crew-tba-card`, `.crew-tba-avatar` | 3751-3774 | TBA crew cards |
| `.crew-tba-slot`, `.crew-tba-role`, `.crew-tba-status` | 3776-3794 | TBA slot labels |
| `.crew-tba-footnote` | 3795-3803 | Crew footnote |
| `#milestones-panel`, `#partners-panel`, `#starship-ticker-panel` shell | 3806-3810 | Empty panel placeholders |
| `.partners-container` | 3813-3819 | Partners flex container |
| `.partner-card`, `.partner-card:hover` | 3821-3835 | Partner card styling |
| `.partner-card-header`, `.partner-provider`, `.partner-name` | 3837-3857 | Partner card header |
| `.partner-card-vehicle`, `.partner-card-status` | 3859-3877 | Partner vehicle/status |
| `.partner-card-progress`, `.partner-progress-*` | 3879-3896 | Progress bars |
| `.partner-readiness` | 3898-3904 | Readiness label |
| `.partner-card-recent`, `.partner-card-next` | 3906-3918 | Recent/next updates |
| `.partner-card-unblocks` | 3920-3926 | Unblocks note |
| `.partner-card-source` | 3928-3946 | Source links |
| `@media (max-width: 768px)` partners | 3949-3961 | Mobile partners stack |
| `#milestones-panel` scrollbar | 3964-3971 | Milestones scroll styling |
| `.ms-timeline`, `.ms-timeline::before` | 3973-3990 | Milestone timeline |
| `.milestone-row` | 3992-3998 | Milestone row |
| `.milestone-pip`, `.milestone-pip.*` | 4000-4023 | Milestone pip icons |
| `@keyframes ms-pulse` | 4019-4022 | In-progress pulse |
| `.milestone-content`, `.milestone-meta` | 4025-4036 | Milestone content |
| `.milestone-category`, `.milestone-date`, `.milestone-source` | 4038-4064 | Milestone meta info |
| `.milestone-title`, `.milestone-row.*` title colors | 4066-4077 | Milestone title states |
| `.milestone-description`, `.ms-error` | 4078-4091 | Milestone description |
| `@media (max-width: 768px)` milestones | 4093-4099 | Mobile milestones |
| `@media (max-width: 768px)` hub layout | 4102-4133 | Mobile hub grid |
| `#starship-ticker-panel`, `.ticker-inner` | 4137-4147 | Starship ticker panel |
| `.ticker-big-number` | 4148-4156 | Large flight count |
| `.ticker-label` | 4157-4163 | Ticker label |
| `.ticker-tally`, `.ticker-tally-item`, `.ticker-tally-dot` | 4164-4185 | Tally breakdown |
| `.ticker-chart`, `.ticker-chart svg` | 4186-4194 | Chart display |
| `.ticker-caption`, `.ticker-attribution` | 4195-4208 | Chart caption |
| `@media (max-width: 768px)` ticker | 4209-4213 | Mobile ticker |

---

## Ambiguous — needs manual review

Selectors that appear on both pages, have `!important` guards, or whose scope is unclear from selector name alone.

| Selector / group | Lines | Notes | Reason |
|---|---|---|---|
| `#top-bar` base | 288-300 | Shared container | Hub overrides at 3674; need to keep base in common |
| `#tb-met`, `#tb-phase`, `#tb-controls` | 302-454 | A2 telemetry | A2 uses full layout; hub overrides with `.hub-tb-*` |
| `#telem-position`, `#telem-info`, `#telem-velocity`, `#telem-milestones` | 1784-1791 | Grid area assignments | In tablet query; hub uses named areas instead |
| `#mission-updates` | 558, 1537, 1766, 1987, 3587 | News panel | Grid positions differ per page |
| `body.hub-layout` `!important` guards | 3567-3589 | Grid assignments | Many `!important`; removable after split |
| `@media (min-width: 768px) and (max-width: 1199px)` | 1748-1793 | Tablet responsive | Mixes A2 grid positions with common panel sizing |
| `@media (max-width: 767px)` | 1798-2052 | Mobile responsive | Mixes A2 top-bar grid, common panels, crew strip |
| `.news-tab.active`, `.tl-filter.active` | 3272-3280 | Orange polish | `.tl-filter` is A2-only but `.news-tab` is common |
| `#panel-overlay-content` overrides | 1085-1187 | Expanded panel | Contains overrides for A2 panels (DSN, timeline) |
| `.ref-observer-btn` | 3081-3094, 3237-3253 | Observer link | A2-only button styled globally |

---

## Notes for implementation

1. **CSS Variables**: Keep all `:root` variables in `common.css` — both pages share the color palette.

2. **Panel base**: The `.panel`, `.panel-header`, `.panel-body` classes are shared — keep in common.

3. **Responsive breakpoints**: The tablet (768-1199px) and mobile (<768px) media queries will need to be split:
   - Common responsive rules (footer, panel sizing, crew modal) → `common.css`
   - A2-specific responsive rules (top-bar grid, trajectory, DSN) → `a2.css`
   - Hub-specific responsive rules (hub grid, hero, partners) → `hub.css`

4. **#mission-updates**: Used on both pages for news feed — keep in common.

5. **Reference guide**: Entirely common — the orange-themed nav/modal serves both pages.

6. **DSN panel**: Shared component — both pages may display DSN status. Keep in common.

7. **Space weather**: Shared component — keep in common.

8. **!important guards**: Hub uses `!important` on grid assignments (lines 3581-3589) to override legacy A2 rules. After split, these can be removed from hub.css.

9. **Overlay styles**: `#panel-overlay-content` has enlarged overrides for A2 panels. Keep overlay shell in common; panel-specific enlargements travel with their component CSS.

10. **Load order**: `common.css` → page-specific CSS (`a2.css` or `hub.css`). Common defines base; page-specific overrides without conflicts.
