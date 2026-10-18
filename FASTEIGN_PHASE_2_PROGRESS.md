# Fasteign Phase 2: progress and checkpoint

Authoritative checkpoint for Phase 2 (features 9–13). The earlier phase has its own
file, `FASTEIGN_IMPLEMENTATION_PROGRESS.md`, which this phase does not edit.

## Objective

Implement, integrate and test five features in the existing Next.js 16 app, and reach
an evidence-based weighted self-score of at least 8.0/10:

- F9 Saved searches (localStorage, versioned) and Atom feeds of newly observed sales
- F10 Chart exports (SVG/PNG) and aggregated CSV exports with metadata
- F11 Market-composition comparison between two periods (descriptive only)
- F12 Area profile pages with verified Reykjavík housing context
- F13 Better unit identification (FEPILOG) and map-location transparency

No deployment, push or force-push is authorized. Phase 2 is committed on `main` as one
milestone commit (see git log).

## Current phase

COMPLETE: all gates passed; weighted self-score 8.6/10 (8.625; see below). Ready for owner review.

## Session log

- 2026-10-18, session 1: Gate A through Gate F in a single session. No resume was needed.

## Gate A findings (verified)

- Starting point: `main` at `f1598d8`, with F4–F7 committed. The only uncommitted file was
  `next-env.d.ts`, rewritten by `next dev`; it is left uncommitted.
- Filters had no price range; F9 added `minPrice`/`maxPrice` in whole m.kr.
- Coordinates come from one Staðfangaskrá point per HEINUM, so units at an address share it.

### Verified source definitions

- **Staðfangaskrá attribute specification** (skra.is, "Staðfangaskrá eigindalýsing.pdf"):
  - TEGHNIT 0 type not reviewed, 1 estimated centre of the structure, 2 main entrance,
    3 driveway of the plot, 4 within the plot boundary, 5 within the estimated building
    footprint.
  - YFIRFARID 0 not reviewed, 1 reviewed, 2 needs revision, 9 HEINUM missing.
  - NAKV_XY: estimated error in metres. It is blank for 47,333 of 49,775 Capital Region rows.
- **FEPILOG** (FMR "Landskrá fasteigna, handbók fyrir Bygging", 2003, pp. 69 and 85): the
  matshluti number plus the eignarhaldsnúmer of the main unit; an eignarhaldsnúmer is a
  2-digit floor number plus a 2-digit position on that floor. Codes are corrected when
  matshlutar are merged or split. Kaupskrá has 230,975 six-digit codes, 2,008 two-digit
  codes, 40 `99B99` and none empty; 193 HEINUM+FEPILOG pairs map to more than one FASTNUM.
- **Reykjavík "Hverfi" dataset** (gagnagatt.reykjavik.is, modified 2026-09-01) gives 2026
  population and dwellings for 10 districts "samkvæmt stjórnsýsluskiptingu".
  - The LUKR Stjórnsýsluskipting layer has the same names and identical polygon
    areas/lengths as Borgarhlutar layer 33. This is re-verified on every ingestion.
  - The licence field is blank (the portal's other datasets are "other-open"), so this is
    unconfirmed. The reference date within 2026 and the floor-area definition are not
    stated; only population and dwellings are used.
  - Older series use different or unverifiable boundaries and are not integrated.

## Completed features

- **F9**: `lib/saved-search.ts` (schema v1, normalization, adjusted/dropped/corrupt/newer
  handling, 30-entry cap); a "Vista leit" popover on `/` and `/markadur`
  (save/rename/delete/open/copy link/copy RSS) and an overview on `/nyskrad`; the price
  range filter.
  - `/api/feed` gives Atom 1.0 with at most 50 entries, stable tag URIs, three separate
    dates, revisions never reported as new, 400 on unknown or invalid parameters, and
    `s-maxage=3600`. `/nyskrad` adds an autodiscovery link and a feed panel. Email alerts
    are deferred (they would need storage and a mail provider).
- **F10**: `lib/csv.ts` (BOM, `;`, decimal comma, CRLF, `#` metadata, formula guard);
  `lib/export-svg.ts` (standalone, themed, labelled SVG); `lib/exports.ts` (builders that
  re-apply suppression); `components/export-menu.tsx` (one compact "Sækja" menu: PNG, SVG,
  CSV).
  - Wired into the explorer trend chart, the 3 `/markadur` charts, the monthly table, the
    area tables, the price distribution, composition and profile charts.
- **F11**: `lib/composition.ts` (trailing/years/custom periods; type, size, rooms,
  build-year and geography breakdowns; group threshold 20; type×size comparable cells;
  warnings for unequal/overlap/sparse/small-sample/far-apart; a three-part explanation
  plus caveat) and the server-rendered `/samsetning`, linked from the explorer summary
  and profiles.
- **F12**: ingestion of the optional Reykjavík sources (`lib/housing.ts`, explicit name
  map, boundary check, `data/processed/housing.json`); `lib/profiles.ts`, `lib/slugs.ts`.
  - `/svaedi` index and 44 `/svaedi/<slug>` pages: outline SVG, 12-month statistics,
    5-year trends with export, distribution, and housing context with sales per 1,000
    dwellings (12 complete months, coverage disclosed, withheld under 5).
  - Pages have canonical URLs, OG cards, noindex below 20 sales in 24 months, and appear
    in the sitemap. They are linked from the header, map and comparison.
- **F13**: `lib/units.ts` (decode/format/label, status unique/shared_code/missing/
  uninterpretable, siblings by HEINUM, register ordering, Staðfangaskrá point types,
  `locationNote`).
  - Sales gain `unitCode`, `pointType` and `accuracy`; properties gain `heinum`.
  - Lookup results are sorted by unit with an ambiguity flag. `/eign/<id>` gets a unit
    panel with linked siblings.
  - Sale cards and map popups say the point is the address, not the unit. Stacked map
    points get a larger, orange-ringed marker, and their popup lists every sale there.
    Coordinates are never displaced.
- **Docs**: `/um-gognin` (5 new sections), DATA_SOURCES.md, METHODOLOGY.md,
  ARCHITECTURE.md, README.md, docs/ROADMAP.md.

## Files changed

Modified: .gitignore, ARCHITECTURE.md, DATA_SOURCES.md, METHODOLOGY.md, README.md,
docs/ROADMAP.md, app/api/properties/route.ts, app/eign/[fastnum]/page.tsx, app/globals.css,
app/nyskrad/page.tsx, app/um-gognin/page.tsx, components/{compare,explorer,header,map,
price-distribution,property-lookup,sales-history}.tsx, lib/{analytics,data,explore,format,
properties,share,types}.ts, next.config.ts, scripts/fetch-kaupskra.ts.

Created: app/api/feed/route.ts, app/samsetning/page.tsx, app/svaedi/page.tsx,
app/svaedi/[slug]/{page,not-found}.tsx, app/sitemap.ts,
components/{saved-searches,export-menu,composition-export,profile-client}.tsx,
lib/{saved-search,atom,feed,csv,export-svg,exports,composition,housing,housing-names,
profiles,slugs,units}.ts, tests/{saved-search,feed,exports,composition,units,housing}.test.ts,
tests/fixtures/sales.ts, tests/browser/phase2.spec.ts, FASTEIGN_PHASE_2_PROGRESS.md.

Generated (git-ignored): data/processed/housing.json, data/raw/hverfi.csv,
data/raw/stjornsysluskipting.json (+ .meta.json).

## Architectural decisions

- No database, accounts or new dependencies. Saved searches live only in the browser.
  Feeds are pure functions of the URL plus the daily snapshot.
- Exports are built from page aggregates through pure builders (testable in Node, the
  same in every browser), not by scraping the Recharts DOM.
- Composition is descriptive only. There is no decomposition and no mix adjustment; a
  mix-adjusted index would be a separate, approved experiment.
- Housing denominators are published only if boundary identity verifies on each run.
  Failure degrades to "unavailable" without stopping ingestion; this was tested by
  removing the source's provenance file.
- New snapshot fields are optional, so older snapshots still load.

## Known limitations / bugs

No known critical bugs. Limitations:

- The Reykjavík "Hverfi" licence is unconfirmed (blank field). The exact reference date
  within 2026 is not stated.
- No housing denominators exist for postcodes or the other six municipalities, and there
  is no housing-stock time series (the older series use different boundaries).
- Feeds only cover the last 60 days of observations and eligible sales. Production
  observation history starts at the first workflow run (see Phase 1 notes).
- Floor numbers are register numbering; they are not translated to named floors.
- Saved searches exist on `/` and `/markadur` only, with an overview on `/nyskrad`.
  Exports are not on the `/samanburdur`, `/kaupgeta` or `/nyskrad` charts.
- The `/samsetning` form shows the year and custom-date fields regardless of mode (it is
  a no-JavaScript GET form). Date inputs follow the browser's locale.
- Local ingestion was rerun offline on 2026-10-18 against a scratch copy of the
  observation state, so canonical local `data/state` is untouched. The regenerated
  `observed.json.gz` includes a 0-new run for that day.
- `npm run format:check` reports CRLF noise in untouched files; all Phase 2 files pass
  `prettier --check`.

## Latest test results (2026-10-18, final)

- `npm test`: 117/117 pass (45 new: saved-search 8, feed 6, exports 8, composition 7,
  units 9, housing 7).
- `npm run typecheck`: pass. `npm run build`: pass (23 routes).
- `npx playwright test` on the production build: 25/25 pass (9 new).
  - XML validated with DOMParser; CSV, SVG and PNG downloads checked (BOM, metadata,
    suppression, PNG signature, dark palette).
  - Saved-search lifecycle and the corrupt/newer stores; composition shares sum to 100%.
  - Profiles, 404, unit panel and lookup; a stacked-map click lists every sale.
- `bash tests/observation-state.sh`: all scenarios pass.
- Responsive/theme sweep: 11 pages × 7 widths (390–1600) × light/dark, with 0 overflow,
  0 header clipping and 0 page errors.
- Ingestion: online fetch of the optional sources gave housing status ok (10 districts,
  boundary check passed); without the source it warns and reports unavailable.
- Performance, warm production server:
  - feed 5–50 ms; `/samsetning` 20–150 ms (17.6 KB gzip); `/svaedi/<slug>` 15–30 ms after
    memoization (was about 190 ms); `/eign/<id>` 9 ms.
  - Snapshot gzip +6.0% (7.26 → 7.70 MB), heap +5 MB (82 → 88 MB), properties gzip +10%.
  - Explore payload with points: 80 → 94 KB gzip (+18%; points are opt-in).

## Self-evaluation (evidence-based)

| Category                              | Weight |           Score | Evidence                                                                                                                                                                                                          |
| ------------------------------------- | -----: | --------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional completeness               |   20 % |             8.5 | All 5 features work end to end. Housing context is limited to Reykjavík districts by data availability; email alerts are deferred; some secondary pages have no export or save.                                   |
| Data accuracy and statistical honesty |   20 % |             9.0 | Suppression re-applied and tested in exports; group threshold 20; reconciliation tests; non-causal wording; boundary-verified denominator; incomplete months excluded; coverage disclosed; FEPILOG never guessed. |
| UX and visual design                  |   15 % |             8.0 | Matches the existing design; compact menus; screenshots reviewed; 154 responsive/theme combinations clean. The composition form is dense, and the date inputs follow the browser locale.                          |
| Code quality and maintainability      |   15 % |             8.5 | Pure isomorphic modules reusing `stats`/`select`; strict TypeScript; formatted. Minor duplication (two small `signed` helpers, the test XML checker).                                                             |
| Testing and reliability               |   15 % |             9.0 | 45 new unit and 9 new browser tests on deterministic fixtures and real data; graceful-degradation run; bugs found by visual review were fixed and given regression tests.                                         |
| Performance and scalability           |   10 % |             8.5 | Measured: bounded feeds, memoized profiles, modest snapshot growth, no new client dependencies. Profile cold start about 0.5 s on a fresh process.                                                                |
| Documentation                         |    5 % |             9.0 | User-facing methodology in Icelandic, plus data sources with verification, methodology, architecture, README, roadmap and this checkpoint.                                                                        |
| **Weighted**                          |        | **8.6 (8.625)** |                                                                                                                                                                                                                   |

### Improvements made during iteration

- Map popup: clicked features come back with tile-quantized coordinates, so the stack
  lookup failed. It now uses an explicit group key, with a regression test that clicks
  the point.
- Profile latency cut from about 190 ms to 15–30 ms (outline cache plus profile
  memoization; failures are not cached).
- Composition: "−0" signs fixed; small-sample (<100) and far-apart-period warnings added
  after real-data review; awkward "0% til 0%" wording fixed.
- Layout: the "Vista leit" button wrapped onto two lines, and the summary actions then
  overflowed by 2 px at 390 px. The actions row now wraps.
- Unit codes use a non-breaking hyphen in narrow layouts; profile charts sit side by side.
- Restored seven existing test files that Prettier had reformatted, and the GeoJSON files
  whose only change was LUKR OBJECTIDs.

## Exact next actions

1. Owner review of the Phase 2 commit; push when ready (not done without authorization).
2. Confirm reuse terms for the Reykjavík "Hverfi" dataset together with the LUKR notice
   in docs/LUKR_NOTIFICATION.md.
3. Optional: export menus on `/samanburdur` and `/nyskrad`; saved searches for
   comparison views; email alerts as a separately scoped project.

## Blockers

- Licence confirmation for the Reykjavík "Hverfi" dataset (external).
- No verified population or dwelling denominators exist for areas outside Reykjavík's
  districts (external data availability).
