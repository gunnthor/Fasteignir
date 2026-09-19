# Validation — 19 September 2026

- Live ingestion completed from the four official downloads. All raw files and provenance manifests remain under `data/raw`; report under `data/processed/report.json`.
- 20 fixture-based data tests passed. Includes CSV quoting/encoding, Icelandic text, currency multiplier, calendars, invalid values, eligibility, geography codes, exact medians, sparse suppression, filters, comparable weights, repeat properties, empirical ranges and formatting.
- Next.js 16.3.5 production build passed TypeScript and generated all four product pages plus three dynamic APIs.
- Seven Playwright tests passed against `next start`, covering real-data filters, district details, rendered official polygons (not just canvas presence), sales details, custom dates, empty results, estimator outputs and suppression, mobile/dark mode, tables, payload bounds and invalid request rejection. Additional coverage verifies rendered postcode polygons in all seven municipalities, distinct apartments at Bæjarlind 5, editable prefills, deep links, and exclusion of the selected property from its comparables.
- Automated browser checks substitute a local neutral raster fixture for public OSM tile requests. Official district geometry and actual application sales remain real. Public basemap availability and real-world Core Web Vitals were not benchmarked.
- Independent Python recalculation from the raw CSV (using saved distribution fences) matched the default 2025-09-19 through 2026-09-19 view: n=5,348, median price=75,000,000 ISK, median price/m²=811,204.594 ISK.
- API file traces include only processed analytical/property-index gzip files and report from `data/`; raw CSV and audit archive are not included in the API bundles. Browser payload contains no all-history sale dump; individual points are opt-in and capped at 1,500.
- Prebuild snapshot guard accepted the generated dataset and rejected a missing dataset with an actionable error.
- Formatter check passed. Installed dependency audit reported no vulnerabilities at installation time.
- Time-based model evaluation saved under `data/evaluation/hedonic.json`; simpler comparable-sales baseline outperformed the experimental ridge model. No hedonic model was deployed.

## Not performed / launch dependencies

The code is published to the public gunnthor/Fasteignir repository. No website deployment, DNS change or email notification was performed. Source monetary-unit confirmation, address-data licence confirmation and LUKR extraction notification remain documented in DATA_SOURCES.md. The scheduled workflow verifies fresh ingestion and the production build; deployment requires explicit repository configuration. Production traffic capacity and error rates have not been measured.

The expanded snapshot includes 27 official postcode polygons and 71,407 distinct historical residential properties. All seven Capital Region municipality codes have postcode polygon coverage.

Public repository hygiene: generated reports and bulk property datasets stay out of Git history and workflow artifacts. Clean clones recreate them using official ingestion. Public geometry remains attributed to its official sources.
