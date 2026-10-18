# Fasteign — fasteign.gunnthor.is

A map-first Icelandic property-sales explorer powered by actual HMS registered purchase agreements. Built from an empty repository with live official data, not sample dashboard values.

## Run locally

Node.js 22+ and npm required.

```sh
npm ci
npm run ingest
npm run dev
```

Open the URL printed by Next.js (usually http://localhost:3000). The included local snapshot can be reused with `npm run ingest -- --offline`; this requires original files plus provenance manifests under `data/raw`. A clean clone must run online ingestion. `.gitignore` excludes bulk raw/server archives; never copy these into `public`.

```sh
npm test
npm run typecheck
npm run build
npm start
```

Browser tests require a running server and Playwright Chromium:

```sh
npx playwright install chromium
TEST_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

Optionally set `CHROMIUM_PATH` to an existing Chrome executable. Tests serve a neutral background tile fixture locally and retain real official polygons and real application transactions, avoiding automated loading of public OSM tiles. Unit fixtures are explicitly synthetic test inputs and never feed the app.

## Available now

- `/`: MapLibre choropleth for official Capital Region postcodes, with Reykjavík's ten districts as an alternative, selectable price/m², median price, sales count, period change and assessment ratio.
- Seven-municipality Capital Region analytics, postcode/municipality comparisons, time/type/size/rooms/build-year filters, custom dates, area details, actual sale cards and conditional clustered points.
- Address/postcode/municipality search across eligible transaction data. It can find only addresses present in that data; it is not a complete property register.
- `/verdmat`: address/fastanúmer lookup with distinct apartment unit references and editable historical details; transparent comparable-sales estimate with range, low/moderate data support, all included comparables and their weights.
- `/markadur`: monthly rolling price/size charts, monthly volume and comparison tables with sample counts.
- Shareable views: map and market filters live in the URL (`/markadur?postcode=107&type=apartment&months=24`). The **Deila** panel copies a link, an `<iframe>` code for `/embed` and a PNG card from `/api/card`, optionally pinning a relative period to exact dates. Shared links get per-view Open Graph images. Cards apply the same suppression as the app (no prices under 5 sales, warning under 10) and always state the date range, nominal-price caveat, data download date and latest contract date.
- `/samanburdur`: two postcodes, districts or municipalities side by side under shared filters, with median price/m², counts, median size and interquartile range, type mix, build year, a shared-bin price/m² distribution and rolling trends. The difference and distribution are withheld unless both sides have at least 5 eligible sales.
- `/kaupgeta`: budget-first view of where comparable homes have actually sold at or below a total price, by municipality with postcode drill-down: counts, shares, within-budget size distribution and a share-by-budget curve. Shares need at least 5 comparable sales and within-budget statistics at least 5 sales within budget. It is labelled as historical evidence, never current listings.
- Price distributions on `/markadur`: histogram of total price or price/m² under the same filters, 25th/50th/75th percentiles and where a chosen price falls, with small-group protection (median from 5 sales, detail from 20, no bar holding 1–4 sales) and warnings for mixed groups. Sale cards link to the distribution of their comparison group.
- `/eign` and `/eign/<fastnúmer>`: a property's sales history — every recorded contract with signature and registration dates, price, price/m², characteristics, nominal changes between comparable contracts, and a confirmed, uncertain or single-sale status. No owner data.
- `/verdmat` evidence: comparable weights broken into size, rooms, build year and recency; weight from older or less similar sales; a leave-one-out range; extrapolation warnings; rolling-origin backtest results; and a what-if panel (size, rooms, build year, 12/24/36-month lookback) with before/after and reset.
- `/nyskrad`: sales first observed in the daily HMS file, with signature, registration and first-observed dates kept apart, plus the registration-delay distribution, trend, group comparisons and incomplete-month flags (also noted on the market charts).
- Saved searches (**Vista leit** on `/` and `/markadur`): named views kept in the browser's localStorage with rename, delete, restore and copy-link, plus an Atom feed per search (`/api/feed?…`, "Gerast áskrifandi að RSS") of newly observed eligible sales. The feed keeps contract, registration and first-observed dates apart. No accounts and no email alerts.
- Exports: a compact **Sækja** menu on charts and tables gives PNG/SVG images (current theme) and CSV with metadata (area, period, filters, n, source, data date, warnings). Sample rules are re-applied, and there is no raw-row export.
- `/samsetning`: what sold in two periods (type, size, rooms, build year, area), with medians inside groups of at least 20 sales and a plain-language summary that separates the overall median, the mix and within-group changes. Descriptive only; not a price index.
- `/svaedi` and `/svaedi/<slug>`: profiles for municipalities, Reykjavík districts and postcodes, with outline, 12-month statistics, five-year trends, distribution and links. Reykjavík districts add 2026 population, dwellings and eligible sales per 1,000 dwellings from verified city open data. Linked from the map, comparison and sitemap.
- Unit identity and map transparency: FEPILOG shown as "01-0302 · hæðarnúmer 03, rými 02", with other units at the same address listed on `/eign/<fastnúmer>`. Ambiguous codes are flagged. Map points are labelled as address points, with Staðfangaskrá point type, review status and error margin. Stacked points list every sale at the address.
- `/um-gognin`: Icelandic sources, filtering, privacy and limitations.
- Responsive layout, dark mode, error/loading/empty states and keyboard-accessible geography lists.

The current dataset has 232,084 national source rows, 106,963 eligible Capital Region rows and 104,944 exact official address matches. The latest sale and registration dates in this snapshot are 2026-09-18. These counts are snapshot facts; `data/processed/report.json` is authoritative after a refresh.

## Data and methodology

Read [DATA_SOURCES.md](DATA_SOURCES.md), [METHODOLOGY.md](METHODOLOGY.md) and [ARCHITECTURE.md](ARCHITECTURE.md). Ingestion stores source timestamps/hashes, all original CSV fields, normalized audit reasons, null rates, quantiles, source examples and coordinate coverage. Monetary values are multiplied by 1,000 based on observed source scale; official field descriptions omit the unit. This assumption is explicit and needs source-owner confirmation before public launch.

Share cards and embeds are cached by snapshot version: card URLs carry `v=<version>` (derived from `report.generatedAt`), responses carry an ETag over the version, resolved dates and view, and pinned-date cards with the current version are served as immutable.

Raw/audit files stay local and out of frontend bundles. Server routes load a ~7 MB gzip snapshot once per process. Default API payloads contain aggregates and at most 40 recent sales; points are only requested when enabled/searching and capped at 1,500. The cap never affects analytical medians.

## Deploy and automatic refresh

The project builds on Vercel. Build only after ingestion; a prebuild guard rejects missing/incomplete snapshots; `next.config.ts` traces `sales.json.gz`, `properties.json.gz`, `history.jsonl.gz`, `observed.json.gz` and the report into API functions (and the needed files into `/eign/*` and `/nyskrad`), and the sales snapshot and report into `/`, `/markadur`, `/samanburdur` and `/embed` (share metadata, area lists and cards). MapLibre v6 workers are copied from the installed package by `predev`/`prebuild`, including their shared module. Dependencies are pinned by package manifest and lockfile.

`.github/workflows/refresh.yml` runs daily at 06:20 UTC and manually. It tests, fetches current official data, builds, runs browser tests, and verifies source data without publishing bulk datasets or generated reports. It deploys only when repository variable `ENABLE_PRODUCTION_DEPLOYMENT=true` and Vercel credentials are configured. Required secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. The `production` GitHub environment can carry deployment protection rules. Existing production remains intact if ingestion, build or tests fail.

The public repository is [gunnthor/Fasteignir](https://github.com/gunnthor/Fasteignir). No website deployment or DNS change has been performed. To launch:

1. Confirm the HMS monetary unit and address-dataset reuse terms documented in DATA_SOURCES.
2. Send the prepared [LUKR extraction notice](docs/LUKR_NOTIFICATION.md). It has not been sent.
3. Connect this repository to the desired Vercel project, configure the workflow credentials and choose a basemap appropriate for expected traffic.
4. Add `fasteign.gunnthor.is` to that Vercel project and follow the DNS records it provides. Enable automated production deployment after reviewing the deployed preview.

`NEXT_PUBLIC_MAP_STYLE_URL` optionally supplies another MapLibre style URL. The default uses on-screen OpenStreetMap raster tiles with visible attribution. Its community tile servers have no traffic/SLA guarantee; review their usage policy. The application does not scrape, prefetch towns, or download offline maps. Fonts are self-hosted.

## Observation state

`npm run ingest` reads and advances `data/state/observations.tsv` (set another folder with `FASTEIGN_STATE_DIR`). Without a state it starts a baseline in which no existing row counts as new. To start from an older raw download instead, run `npm run ingest -- --bootstrap-from path/to/kaupskra.csv --bootstrap-date YYYY-MM-DD` with an empty state folder. `--allow-mass-removal` accepts a source in which many known rows disappeared. In CI the state is kept on the `ingest-state` branch (see ARCHITECTURE.md); `bash tests/observation-state.sh` tests that persistence against a throwaway remote.

## Model experiment

```sh
npm run evaluate
```

`npm run backtest` evaluates the production comparable-sales estimator over eight rolling quarters at 12, 24 and 36-month lookbacks and saves `data/evaluation/comparables.json`, which `/verdmat` shows.

`npm run evaluate` runs a time-separated ridge hedonic regression against the comparable-sales baseline and saves `data/evaluation/hedonic.json`. The first holdout uses 32,024 training records and 5,340 test records. On 5,281 paired predictions, the baseline beat the ridge model (MAE ~7.96m vs ~11.97m ISK; median APE ~6.28% vs ~12.38%). The hedonic model is **not deployed**. One retrospective split is not a production accuracy guarantee; see the saved limitations.

## Remaining product work

See [docs/ROADMAP.md](docs/ROADMAP.md) for the reconstructed roadmap and cross-PC handoff.

Fine-neighborhood geography, a complete current property register, calibrated uncertainty and repeated forward validation remain future iterations. Postcode polygons cover the Capital Region, including Kópavogur, Garðabær, Hafnarfjörður, Seltjarnarnes, Mosfellsbær and Kjósarhreppur. Property lookup covers properties recorded in historical HMS sales; it does not establish current ownership or current condition. English localization has not been implemented; core strings and all formatting helpers are centralized, but further extraction of page copy is needed.

Use `npm run format` / `npm run format:check` for consistent formatting. Do not introduce commercial asking prices into actual-sale metrics or invent missing coordinates.
