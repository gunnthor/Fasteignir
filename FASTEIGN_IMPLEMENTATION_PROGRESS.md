# Fasteign implementation progress — Market Intelligence & Property History

Authoritative checkpoint for the four-feature phase. Update after every milestone.

## Objective

Implement, integrate and validate four features in the existing Next.js 16 app,
reaching every mandatory quality gate and an evidence-based weighted score ≥ 8.5/10:

- F4 Price distributions and percentiles
- F5 Property sales history (Sölusaga eignar)
- F6 Valuation evidence and sensitivity analysis (/verdmat)
- F7 Newly registered sales and registration lag (+ durable ingestion state)

No deployment, push or commit has been made (none was authorized). All work is
uncommitted in the working tree on `main`.

## Current phase

COMPLETE — all gates passed; weighted self-score 8.85/10. Ready for deployment review.

## Session log

- 2026-10-17, session 1: asked to resume from a checkpoint, but none existed (not on
  disk, any branch or stash), so work started at Gate A and ran through Gate E.
  The 2026-09-20 raw snapshot was copied to `data/history-baseline/` (git-ignored) and
  used to bootstrap the tracker, then diffed against a fresh 2026-10-17 HMS download.

## Gate A findings (verified against the real HMS file)

- 232,084 rows (2026-09-20) / 233,039 (2026-10-17). FAERSLUNUMER = contract document
  (1:1 with EMNR+SKJALANUMER); 4,944 contracts span several FASTNUMs (bundles).
  `FAERSLUNUMER|FASTNUM` is unique per row → stable row key.
- FASTNUM is always 7 digits; address constant within a FASTNUM. FEPILOG changes within
  714 FASTNUMs, type in 517 successive pairs, area >10 % in ~9.7 % of pairs →
  FASTNUM alone does not prove an unchanged unit.
- Same FASTNUM + date + price under two documents: 316 pairs → probable double registrations.
- `*_GILDANDI` / `FYRIRHUGAD_*` are current-register columns; BRUNABOTAMAT_GILDANDI changed
  in 188,054 rows between the two downloads → excluded from change fingerprints.
- Contract→registration lag (all rows): median 8 d, p90 28 d, max 5,229 d.

## Completed tasks

Gate B — foundations: `lib/sample.ts`, `lib/distribution.ts`, `lib/price-distribution.ts`,
`lib/history.ts`, `lib/history-lookup.ts`, `lib/observations.ts`, `lib/registration.ts`,
`lib/newly-observed.ts`; estimator extensions in `lib/analytics.ts` (weightParts, lookback,
diagnostics, sensitivity, postcode|type pool index — output identical to HEAD on 103 real
subjects); ingestion (probable_duplicate_registration exclusion, history.jsonl.gz,
observed.json.gz, observation state with bootstrap / mass-removal guard).

Gate C — features:

- F4 `/api/distribution`; panel on /markadur (#dreifing); URL state `dist`/`value`;
  "Hvar liggur verðið?" from sale cards and history; "Dreifing verðs á svæðinu" from map panel.
- F5 `/eign`, `/eign/[fastnum]` (+ not-found), `/api/history`. Statuses on real data:
  34,491 confirmed / 1,773 uncertain / 35,305 single (71,569 properties, 133,161 contracts).
- F6 Evidence / Comparables / Sensitivity components on /verdmat; `/api/estimate` accepts
  `lookback` (12/24/36) and `sensitivity=1`, returns backtest summary;
  `npm run backtest` → `data/evaluation/comparables.json` (11,411 tests, 8 quarters,
  MdAPE 6.03 %, band coverage 80.6 % at 24 months).
- F7 `/nyskrad` (three dates, new + corrected records, removed count, lag summary,
  histogram, trend by registration month, by type and municipality, completeness,
  incomplete months); incomplete-month notes on / and /markadur; nav entries.
- Durable state: `scripts/observation-state.sh` (fetch/push, fast-forward only) +
  `.github/workflows/refresh.yml` (fetch before ingest, artifact after verified run,
  `persist-state` job with `contents: write`, deploy reads state, manual
  `allow_mass_removal` input).

Gate D/E — integration and validation (see test results). Fixes made during review:
histogram layout scoring (tails too wide), bundle area falsely marking histories
uncertain, area tolerance 3 % → 5 %, history memory 66 MB → ~7 MB (JSON lines), clipped
scenario table and mobile table layout, crowded header with 8 nav items,
`csv-parse` leaking into a client chunk (85 KB → 32 KB), Icelandic singular/plural,
long `/nyskrad` list (12 cards + table).

Docs: METHODOLOGY.md, ARCHITECTURE.md, README.md, docs/ROADMAP.md, app/um-gognin.

## Files created or modified

Modified: .github/workflows/refresh.yml, .gitignore, ARCHITECTURE.md, METHODOLOGY.md,
README.md, docs/ROADMAP.md, app/api/estimate/route.ts, app/api/explore/route.ts,
app/globals.css, app/um-gognin/page.tsx, components/estimator.tsx,
components/explorer.tsx, components/header.tsx, lib/analytics.ts, lib/format.ts,
lib/server.ts, lib/share.ts, lib/types.ts, next.config.ts, package.json,
scripts/check-data.mjs, scripts/fetch-kaupskra.ts.

Created: app/api/distribution/route.ts, app/api/history/route.ts, app/eign/page.tsx,
app/eign/[fastnum]/page.tsx, app/eign/[fastnum]/not-found.tsx, app/nyskrad/page.tsx,
components/{history-lookup,price-distribution,registration-charts,sales-history,
valuation-evidence}.tsx, lib/{sample,distribution,price-distribution,history,
history-lookup,observations,registration,newly-observed}.ts,
scripts/backtest-comparables.ts, scripts/observation-state.sh,
data/evaluation/comparables.json (must be committed: imported at build time),
tests/{distribution,history,observations,registration,valuation}.test.ts,
tests/observation-state.sh, tests/browser/features.spec.ts.

## Outstanding bugs / known limitations

No known critical bugs. Limitations (documented):

- Production has no observation history until the workflow first runs on main; that run
  bootstraps (no "new" sales on day one). Local data was bootstrapped from 2026-09-20.
- The workflow and `ingest-state` push are tested locally against a bare remote only;
  never run on GitHub (needs a push to main; org policy must allow `contents: write`).
- Pre-existing `/samanburdur` distribution chart still uses its own bins without the
  small-cell rule (not changed in this phase).
- Histograms are often unavailable for groups of 20–40 sales (strict small-cell rule);
  quartiles are still shown.
- Expected registered share for incomplete months assumes contracts spread evenly
  through the month.
- No ESLint in the repo; "linting" = TypeScript strict + Prettier.

## Most recent test results (2026-10-17, final)

- `npm test`: 72/72 pass (39 new). `npm run typecheck`: pass.
- `bash tests/observation-state.sh`: 8 scenarios pass.
- `npm run build`: pass (prebuild data checks included).
- `npx playwright test` on production build: 16/16 pass (6 new).
- Responsive/theme sweep: 6 pages × 390/768/1024/1440 px × light/dark — 0 overflow,
  0 page errors. Header fits 960–1600 px.
- Real-data checks: estimator regression vs HEAD (103 subjects, 0 diffs); ingestion rerun
  idempotent (0 new, 233,039 unchanged); payloads: distribution ~1.5 KB, history ~3 KB,
  estimate+sensitivity ~38 KB, /nyskrad 20 KB gzip; heap: sales 79 MB, properties 23 MB,
  history ~7 MB.

## Current quality score (evidence-based)

| Category                            | Weight |    Score |
| ----------------------------------- | -----: | -------: |
| Functional completeness             |   20 % |      9.0 |
| Statistical correctness and honesty |   20 % |      9.0 |
| Code quality and maintainability    |   15 % |      8.5 |
| User experience and visual quality  |   15 % |      8.5 |
| Testing and reliability             |   15 % |      9.0 |
| Performance and architecture        |   10 % |      9.0 |
| Documentation and transparency      |    5 % |      9.0 |
| **Weighted**                        |        | **8.85** |

## Exact next actions

1. Owner review of the diff; commit (including `data/evaluation/comparables.json`) and push
   when ready — not done without authorization.
2. After the first main-branch workflow run, confirm the `ingest-state` branch was created
   and that the second day's run reports new sales on `/nyskrad`.
3. Optional follow-ups: apply `lib/distribution` small-cell rule to `/samanburdur`;
   ESLint; postcode-level lag table.
