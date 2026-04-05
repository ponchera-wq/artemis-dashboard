<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of the Artemis II dashboard project with PostHog analytics. Two Node.js pipeline scripts were instrumented with `posthog-node`: the OEM ephemeris data pipeline (`data/update_ephemeris.js`) and the asset minification build script (`scripts/minify-assets.mjs`). Both scripts are short-lived processes and are configured with `flushAt: 1`, `flushInterval: 0`, and `await posthog.shutdown()` to ensure events are flushed before exit. Exception autocapture is enabled on both clients. Environment variables (`POSTHOG_API_KEY`, `POSTHOG_HOST`) are stored in `.env` and referenced via `process.env`.

| Event name | Description | File |
|---|---|---|
| `ephemeris generation completed` | Fired when the OEM data pipeline successfully parses, processes, downsamples, and writes `mission-ephemeris.json`. Includes raw/sampled point counts, perilune MET, and minimum Moon distance. | `data/update_ephemeris.js` |
| `ephemeris generation failed` | Fired (along with `captureException`) when the pipeline encounters an unhandled error. Includes the error message. | `data/update_ephemeris.js` |
| `assets minified` | Fired when the minification build script finishes writing all output files under `min/`. Includes JS file count, CSS minification status, and ephemeris minification status. | `scripts/minify-assets.mjs` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on pipeline health, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/369794/dashboard/1432302
- **Insight — Ephemeris generation runs per week:** https://us.posthog.com/project/369794/insights/7uGaiGbB
- **Insight — Ephemeris pipeline success rate:** https://us.posthog.com/project/369794/insights/BFJas4ko
- **Insight — Asset minification runs per week:** https://us.posthog.com/project/369794/insights/gEClpNMV

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
