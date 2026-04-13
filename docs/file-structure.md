# File Structure

File tree of the artemis-live-dashboard repo as of v1.0.0 release.

```
artemis-live-dashboard/
├── api/
│   └── ship.js
├── artemis-ii.html
├── artemis-ephemeris-check.json
├── automation/
│   ├── package.json
│   ├── package-lock.json
│   ├── record_observer.js
│   ├── screenshots/
│   └── videos/
├── CLAUDE.md
├── content/
│   ├── a3-axemu.html
│   ├── a3-bluemoon.html
│   ├── a3-crew.html
│   ├── a3-hls.html
│   ├── a3-mission.html
│   ├── a3-orion.html
│   ├── a3-sls.html
│   ├── a3-starship.html
│   ├── canada.html
│   ├── comms.html
│   ├── esm.html
│   ├── ground-ops.html
│   ├── mission.html
│   ├── orion.html
│   ├── science.html
│   └── sls.html
├── css/
│   └── styles.css
├── data/
│   ├── Artemis_II_OEM_*.asc (OEM source files)
│   ├── artemis3-milestones.json
│   ├── astronomy.js
│   ├── flyby-animation-data.json
│   ├── flyby-lighting.json
│   ├── generate_ephemeris.py
│   ├── generate_reentry.py
│   ├── mission-ephemeris.json
│   ├── observer-horizons.json
│   ├── osculating-elements.json
│   ├── parse_oem.py
│   ├── partners-status.json
│   ├── starship-flights.json
│   ├── trajectory.json
│   └── update_ephemeris.js
├── docs/
│   ├── batch-1b-pre-findings.md
│   ├── batch-2-report.md
│   ├── file-structure.md (this file)
│   └── spec-artemis3-hub.md
├── flyby.html
├── img/
├── index.html
├── js/
│   ├── artemis3.js
│   ├── clock.js
│   ├── crew-activity.js
│   ├── crew-activity-ui.js
│   ├── crew.js
│   ├── dsn.js
│   ├── flyby-lighting.js
│   ├── gantt.js
│   ├── iss-model.js
│   ├── milestones.js
│   ├── mission-ephemeris.js
│   ├── mission-events.js
│   ├── murtha-model.js
│   ├── news.js
│   ├── observer-astro.js
│   ├── observer-horizons.js
│   ├── observer-ui.js
│   ├── orion-model.js
│   ├── osculating-orbit.js
│   ├── partners.js
│   ├── reference.js
│   ├── scrub-bar.js
│   ├── shared.js
│   ├── starship-ticker.js
│   ├── stats.js
│   ├── timeline.js
│   ├── trajectory.js
│   ├── ui.js
│   └── weather.js
├── llms-full.txt
├── llms.txt
├── manifest.json
├── min/ (generated minified assets)
│   ├── css/
│   ├── data/
│   └── js/
├── models/
│   └── murtha/
│       └── model.dae
├── node_modules/
├── observer.html
├── package.json
├── package-lock.json
├── robots.txt
├── scripts/
│   ├── minify-assets.mjs
│   ├── verify-assertions.json
│   └── verify-phase.mjs
├── service-worker.js
├── sitemap.xml
├── spec-flyby-moonview.md
├── spec-flyby-page.md
├── spec-osculating-orbit.md
├── splashdown.html
└── vercel.json
```

## Key Directories

- **index.html** — Artemis III Hub (main v1.0.0 page)
- **artemis-ii.html** — Artemis II Archive (historical mission dashboard)
- **content/** — Reference guide pages for both missions
- **js/** — Core application logic (shared, timeline, crew, news, observers, milestones, partners, starship-ticker, etc.)
- **data/** — Mission ephemeris, milestones, partner status, starship flights, astronomy calculations
- **css/** — Single unified stylesheet
- **scripts/** — Build utilities (minify, verify)
- **min/** — Generated minified assets (do not edit directly)
- **automation/** — Playwright testing and screenshot generation
- **models/** — 3D model assets (Murtha lunar surface)
- **api/** — Backend utilities (ship position tracking)
