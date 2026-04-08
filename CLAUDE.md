# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A static, single-page PWA dashboard for tracking the NASA Artemis II crewed lunar flyby mission in real time. No build step, no framework, no package manager — open `index.html` directly in a browser or serve it locally.

## Running Locally

```bash
# Any static file server works; python is usually available:
python3 -m http.server 8080
# then open http://localhost:8080
```

There are no tests, no linter config, and no CI pipeline.

## Ignored Directories
The following directories contain generated reference files only — do not read, edit, or include in context:
- `docs/`

## Architecture
### Core App
index.html, observer.html
css/styles.css
js/shared.js, js/mission-ephemeris.js, js/mission-events.js, js/stats.js
js/trajectory.js, js/timeline.js, js/clock.js, js/news.js, js/crew.js
js/weather.js, js/dsn.js, js/ui.js, js/reference.js
js/orion-model.js, js/iss-model.js
js/observer-astro.js, js/observer-ui.js

### Data Pipeline
data/mission-ephemeris.json (644 points, OEM-derived)
data/astronomy.js, data/update_ephemeris.js
data/generate_ephemeris.py, data/parse_oem.py
data/skyfield-data/de440s.bsp
data/*.asc (OEM source files — do not edit)

### Content & Config
content/*.html (reference guide pages)
manifest.json, service-worker.js, vercel.json
robots.txt, sitemap.xml, llms.txt, llms-full.txt

### Build
scripts/minify-assets.mjs → outputs to min/
min/css/, min/js/, min/data/ (generated — do not edit directly)

### Automation (dev only)
automation/ (Playwright recording scripts)
