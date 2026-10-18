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

## Market intelligence and property history (October 2026)

Additional ingestion outputs, all server-only:

- `data/processed/history.jsonl.gz`: one `FASTNUM<TAB>packed JSON` line per Capital Region residential property (about 3.3 MB gzip). The server keeps the lines as strings (about 7 MB heap measured, against 66 MB for parsed tuples) and parses one property per request (about 0.4 ms).
- `data/processed/observed.json.gz`: rows first observed or changed in the last 60 days, plus the run log (about 16 KB).
- `data/state/` (`observations.tsv`, `runs.json`): durable observation state, about 8 MB of sorted text lines.

Durable state lives on the orphan branch `ingest-state` of this repository and is managed by `scripts/observation-state.sh`. The verify job fetches it before ingestion: a missing branch bootstraps a baseline, any other fetch error fails the job, and a corrupt file fails parsing. Only after unit tests, ingestion, build and browser tests pass does the job upload the state as an artifact. The separate `persist-state` job, the only one with `contents: write`, commits it as a fast-forward of the exact commit that was fetched. If the branch moved, nothing is overwritten and the job fails; a retry with unchanged state pushes nothing. The deploy job reads the persisted state and never writes it. Sorted line-oriented text keeps daily commits small through git delta compression and leaves an auditable history. Accepted edge case: a row that first appears between the verify and deploy jobs is dated by the next verify run. Rejected alternatives: the Actions cache (evictable), artifacts alone (expire and need API lookups), a database or blob store (a new service and credentials).

Runtime costs: the estimator indexes eligible sales by postcode and type once per snapshot (1.3 ms per estimate; the eight-scenario sensitivity grid about 11 ms). Distribution responses are about 1.5 KB, history responses about 3 KB, and `/nyskrad` about 20 KB of gzip HTML. Incomplete-month flags are cached per snapshot. Distributions, history pages and registration analytics are computed on the server; client JavaScript is limited to the distribution panel, the valuation evidence, the history lookup box and the registration charts.

## Phase 2: saved searches, exports, composition, profiles, unit identity (October 2026)

- `lib/saved-search.ts` (isomorphic): versioned localStorage schema; the same normalizer feeds `/api/feed`. No accounts, no server-side storage of saved searches. Email alerts would need subscriber storage and a mail provider; they are deferred.
- `/api/feed` (lib/feed.ts, lib/atom.ts): reads the in-memory snapshot and `observed.json.gz`; one pass over the recent observations (a few thousand) plus an id index cached per snapshot. About 50 ms locally, `s-maxage=3600`.
- Exports (lib/exports.ts, lib/export-svg.ts, lib/csv.ts, components/export-menu.tsx): pure builders shared with tests; PNG is a canvas rasterization of the standalone SVG. No new dependencies.
- `/samsetning` (lib/composition.ts): server-rendered, about 0.2 s; client JavaScript only for the export menus.
- `/svaedi`, `/svaedi/[slug]` (lib/profiles.ts, lib/slugs.ts): readable slugs, canonical URLs, Open Graph cards reused from `/api/card`, `app/sitemap.ts`. Outlines are simplified server-side SVG from `public/data/areas.geojson`.
- Ingestion adds two optional sources (Reykjavík "Hverfi" CSV and the Stjórnsýsluskipting attribute layer). Failure leaves `data/processed/housing.json` in status "unavailable" without stopping ingestion. Located sales gain `unitCode`, `pointType` and `accuracy`; property records gain `heinum`. Old snapshots without these fields still work.
- Measured snapshot impact (2026-10-17 data): sales.json.gz 7.26 → 7.70 MB (+6.0%), raw 57.6 → 62.9 MB, parsed heap about 82 → 88 MB; properties.json.gz 1.23 → 1.36 MB (+10%); housing.json 1.2 KB.
