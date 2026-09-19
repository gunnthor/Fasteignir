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
- `/um-gognin`: Icelandic sources, filtering, privacy and limitations.
- Responsive layout, dark mode, error/loading/empty states and keyboard-accessible geography lists.

The current dataset has 232,084 national source rows, 106,963 eligible Capital Region rows and 104,944 exact official address matches. The latest sale and registration dates in this snapshot are 2026-09-18. These counts are snapshot facts; `data/processed/report.json` is authoritative after a refresh.

## Data and methodology

Read [DATA_SOURCES.md](DATA_SOURCES.md), [METHODOLOGY.md](METHODOLOGY.md) and [ARCHITECTURE.md](ARCHITECTURE.md). Ingestion stores source timestamps/hashes, all original CSV fields, normalized audit reasons, null rates, quantiles, source examples and coordinate coverage. Monetary values are multiplied by 1,000 based on observed source scale; official field descriptions omit the unit. This assumption is explicit and needs source-owner confirmation before public launch.

Raw/audit files stay local and out of frontend bundles. Server routes load a ~7 MB gzip snapshot once per process. Default API payloads contain aggregates and at most 40 recent sales; points are only requested when enabled/searching and capped at 1,500. The cap never affects analytical medians.

## Deploy and automatic refresh

The project builds on Vercel. Build only after ingestion; a prebuild guard rejects missing/incomplete snapshots; `next.config.ts` traces `sales.json.gz`, `properties.json.gz` and the report into API functions. MapLibre v6 workers are copied from the installed package by `predev`/`prebuild`, including their shared module. Dependencies are pinned by package manifest and lockfile.

`.github/workflows/refresh.yml` runs daily at 06:20 UTC and manually. It tests, fetches current official data, builds, runs browser tests, and verifies source data without publishing bulk datasets or generated reports. It deploys only when repository variable `ENABLE_PRODUCTION_DEPLOYMENT=true` and Vercel credentials are configured. Required secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. The `production` GitHub environment can carry deployment protection rules. Existing production remains intact if ingestion, build or tests fail.

The public repository is [gunnthor/Fasteignir](https://github.com/gunnthor/Fasteignir). No website deployment or DNS change has been performed. To launch:

1. Confirm the HMS monetary unit and address-dataset reuse terms documented in DATA_SOURCES.
2. Send the prepared [LUKR extraction notice](docs/LUKR_NOTIFICATION.md). It has not been sent.
3. Connect this repository to the desired Vercel project, configure the workflow credentials and choose a basemap appropriate for expected traffic.
4. Add `fasteign.gunnthor.is` to that Vercel project and follow the DNS records it provides. Enable automated production deployment after reviewing the deployed preview.

`NEXT_PUBLIC_MAP_STYLE_URL` optionally supplies another MapLibre style URL. The default uses on-screen OpenStreetMap raster tiles with visible attribution. Its community tile servers have no traffic/SLA guarantee; review their usage policy. The application does not scrape, prefetch towns, or download offline maps. Fonts are self-hosted.

## Model experiment

```sh
npm run evaluate
```

This runs a time-separated ridge hedonic regression against the comparable-sales baseline and saves `data/evaluation/hedonic.json`. The first holdout uses 32,024 training records and 5,340 test records. On 5,281 paired predictions, the baseline beat the ridge model (MAE ~7.96m vs ~11.97m ISK; median APE ~6.28% vs ~12.38%). The hedonic model is **not deployed**. One retrospective split is not a production accuracy guarantee; see the saved limitations.

## Remaining product work

Fine-neighborhood geography, a complete current property register, calibrated uncertainty and repeated forward validation remain future iterations. Postcode polygons cover the Capital Region, including Kópavogur, Garðabær, Hafnarfjörður, Seltjarnarnes, Mosfellsbær and Kjósarhreppur. Property lookup covers properties recorded in historical HMS sales; it does not establish current ownership or current condition. English localization has not been implemented; core strings and all formatting helpers are centralized, but further extraction of page copy is needed.

Use `npm run format` / `npm run format:check` for consistent formatting. Do not introduce commercial asking prices into actual-sale metrics or invent missing coordinates.
