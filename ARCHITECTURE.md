# Architecture

## Decision

Next.js App Router, React, TypeScript, MapLibre and Recharts. A 46 MiB national transaction file (232k rows) and 36 MiB address file fit comfortably in a scheduled ingestion process. No Postgres service is needed for the first version. Vanilla CSS provides a small, bespoke responsive design; no component framework is required.

## Data path

1. `scripts/fetch-kaupskra.ts` downloads official snapshots into ignored `data/raw/`, records provenance, validates headers and profiles every row.
2. Normalization retains identifiers as strings, converts currency to ISK, validates dates and flags every exclusion. An audit gzip retains normalized rows for all regions/types and source CSV retains every original field.
3. Exact HEINUM joins and municipality agreement locate addresses. Unique official points only; ambiguous matches have null coordinates. District assignments use official full-precision WGS84 polygons.
4. `data/processed/sales.json.gz` contains only eligible Capital Region sales, server-only. `report.json` records freshness, distributions, nulls, exclusions, matching and source hashes. Only reduced polygon geometry is in `public/data/`.
5. Server route handlers lazily decompress the analytical file once per process, filter exact rows, and calculate medians. API responses contain aggregates, a limited recent-sale list and at most 1,500 newest located records for clustered exploration. Full history stays server-side.
6. Client filters request bounded JSON. No client has to parse/download the source CSV. Abort superseded requests, retain loading/error feedback, dynamically load the map. All geographies have a list alternative to the map.

## Geographic scope

Capital Region analytics include seven municipalities. The default choropleth uses official Byggðastofnun postcode polygons across the Capital Region; Reykjavík districts remain an alternate layer. Postal memberships are derived from source transactions; a postcode can cross municipal boundaries. Historical transaction postcodes are not spatially reassigned to current boundaries. Fine neighborhoods are a distinct future geographic level.

## Deployment and refresh

Vercel builds with Node >=22. The scheduled GitHub workflow installs dependencies, tests, ingests and builds before deploying through Vercel CLI when credentials exist. Raw and server-generated files must exist before `next build` and are explicitly included in API output tracing. No Vercel runtime fetch of huge CSVs or writes to ephemeral storage. A failed ingestion/build leaves the existing deployment untouched. Without deployment secrets the workflow validates without publishing generated data artifacts.

The repository is initially local: no remote, domain ownership or Vercel project is assumed. DNS/domain binding and production launch remain environment setup. See README and data-source launch requirements.

## Growth path

If row volume/traffic makes per-process decompression or in-memory filtering expensive, retain this API contract and move storage to indexed Postgres/PostGIS. Add spatial queries, persisted preaggregates and cache keys tied to source SHA-256. Never average postcode medians to derive region medians. Current server computes exact filtered medians.

## Estimator

Transparent comparable-sales baseline, same postcode and type, recent 24-month window, size/rooms/build-year/recency weighting, weighted price/m² quantiles and effective sample size. The interval is empirical comparable spread, not a calibrated prediction interval. No production hedonic model until time-based evaluation beats the baseline.

Property lookup uses a server-only compressed index of the latest recorded residential attributes per seven-digit FASTNUM. `/api/properties?q=` returns at most 25 records; `?id=` returns one. FEPILOG is preserved verbatim to distinguish units. Historical details remain editable; the selected FASTNUM is excluded from comparable selection. No owner or occupant data is exposed.
