# Methodology

The Icelandic public explanation is `/um-gognin`. This technical specification documents the first implementation, not a claim of a validated valuation product.

## Source observations and units

The 2026-09-19 download has 232,084 rows, 25 columns, Windows-1252 encoding and semicolon separators. Raw `KAUPVERD` values have a nationwide residential median of about 39,900. Monetary fields are explicitly interpreted as **thousands of ISK** and multiplied by 1,000. The official field description omits the unit; this remains an inference corroborated by the magnitude of HMS published market figures, not source-owner confirmation. It is surfaced in DATA_SOURCES and the public methodology. All downstream values are nominal ISK.

Use UTGDAG (signature date) for time filtering; THINGLYSTDAGS is separate registration freshness. Calendar parsing rejects impossible and future signature dates. Identifiers retain leading zeros. Addresses are NFC-normalized and whitespace-normalized, without removing Icelandic diacritics. Search is case-insensitive substring search over addresses and geographic labels; it is not an external geocoder or authoritative property lookup.

## Eligibility and auditability

Keep all original CSV bytes. `audit.json.gz` retains normalized rows from all regions with every reason/warning. `sales.json.gz` is the server-only eligible Capital Region subset. Exclusion categories overlap and must not be added as if disjoint.

- HMS suitability must be explicitly 0; 1 is excluded, missing/unknown is excluded conservatively.
- FULLBUID must be 1. Incomplete/unknown excluded.
- Fjölbýli is apartment; Sérbýli and observed Einbýli are house. Other types excluded from residential analytics.
- Signature date must be valid and not future, price > 0, area > 0. No invented area/price values fill missing data.
- Repeated FAERSLUNUMER or repeated EMNR+SKJALANUMER: exclude all associated rows. This conservative treatment avoids attributing full contract prices to multiple units. Even exact duplicate rows are retained in audit, not silently collapsed. In this snapshot 19,544 rows have these markers.
- Rooms zero/missing/>20 normalize to null with a warning; values over 20 were inspected as implausible for normal dwelling comparisons. Build years before 1000 or after the sale year normalize to null with a warning. Missing attributes do not remove otherwise usable price observations, unless a corresponding filter is selected.
- Capital Region is the explicit municipality-code set 0000, 1000, 1100, 1300, 1400, 1604, 1606. No postcode-prefix guess. Historic municipality mergers are not comprehensively crosswalked.

## Distribution-based tail screening

Initial eligible national residential distribution (before duplicate/tail filtering): area p0.1=26.7 m², median=103.8, p99.9=442.9, max=3455.8; raw price p0.1=3000, median=39900, p99.9=260000. These observations rule out a universal narrow area cutoff and show why a fixed global kr/m² threshold is inappropriate across 20 years.

For each municipality × sale year × normalized property type cohort with >=30 otherwise eligible rows, compute Q1/Q3 of log(price/m²) with linearly interpolated quantiles. Exclude values outside Q1−3×IQR to Q3+3×IQR (outer Tukey fences). Save actual cohort bounds and counts in `report.json`. This flags 280 rows in the inspected snapshot. Fences are not learned from the entire national price distribution; inflation and local price levels matter. Cohorts under 30 or with zero IQR get no tail exclusion. They can retain questionable observations; this is a documented limitation, especially in small rural groups. HMS flags and robust medians are still applied.

Future re-ingestion may revise current-year fences. Experimental model evaluation therefore does not use these full-snapshot outcome-dependent exclusions in its holdout.

## Geographic matching

Join HEINUM and require the same SVFN/SVFNR. Reject address status 2 (needs review) and 9 (missing identifier). Only one distinct valid WGS84 point is accepted; duplicated identical coordinates do not create ambiguity. Latitude/longitude bounds are an Iceland-wide validity check, not generated locations. Ambiguous/no matches stay null. Address status 1 is labelled reviewed; status 0/blank is labelled official_unreviewed. Neither is a promise of unit-level accuracy.

Intersect accepted points with full-precision official district polygons using point-in-polygon, including holes/multipolygons. Exactly one matching polygon and Reykjavík municipality required. Border/multiple matches stay unassigned. Current geography is used for historical sales. Missing map locations remain in municipality/postcode totals. District totals use only matched points: do not treat them as complete counts of all sales in that district.

Snapshot: 106,963 eligible Capital Region rows; 104,944 mapped (98.1%); 60,266 assigned to Reykjavík districts across full history. Only 13,475 mapped eligible sales use points marked reviewed; most official points are unreviewed, which is explicitly disclosed in individual details.

## Aggregation and time

Exact medians of individual observations, never arithmetic averages of area medians. Price/m² is normalized ISK price divided by valid m². Sale/valuation is the median of individual price/assessment-at-sale ratios, not ratio of independent medians. Current/next-year assessment columns never replace assessment at sale. Valuation-derived numbers require five available valuations and show their own denominator.

Time controls use inclusive start/end dates. Default is current UTC date minus 12 calendar months through current UTC date, clamping month ends. A previous comparison period has exactly the same number of days and ends the day before the current start. “All” has no comparison unless explicit dates are supplied. Values are nominal, without CPI adjustment or mix adjustment. This is not an official house-price index.

- n<5: suppress price, area and typical-home medians; keep transaction counts.
- 5<=n<10: display warning.
- Price change: both periods need >=10 eligible observations.
- Monthly price/size charts: rolling 3-calendar-month window ending in the displayed month; upper bound is selected end date. Rolling windows can extend before selected start. No bridging of null months. Display sample count in tooltip and dashboard table.
- Monthly volume: that calendar month only, not the rolling count. Edge-month charts represent partial data through the chosen end date.
- Quantile map colors: 20/40/60/80th percentile ranks across the active geography (postcodes or districts) with publishable metrics. Gray means absent/suppressed. Colors are relative to current filters, not a fixed cross-period scale. Count mode includes small counts; price modes suppress sparse statistics.

Example independent cross-check on the 2026-09-19 snapshot: last 12 months, all residential Capital Region, 5,348 eligible rows, median 75,000,000 ISK, median about 811 thousand ISK/m². Date range is 2025-09-19 through 2026-09-19 inclusive.

## Comparable-sales estimator

Eligible comparables: same postcode, same type, signature not after subject as-of date, <=24 months old, area between 0.65× and 1.5× subject. One latest eligible sale per property; then retain up to 50 greatest weights.

Weight = exp(−4×abs(log(comparable area / subject area))) × exp(−0.35×abs(room difference)) × exp(−abs(build-year difference)/50) × exp(−age in months/12).

Unknown rooms/build year contributes 0.5 for that component. These are declared heuristic weights, not fitted or calibrated coefficients. Same postcode is a coarse location criterion; no hidden invented distance adjustment. Subject inputs require postcode, type, valid area, rooms and year. Future exact-address matching can add verified distance without changing the output contract.

Central estimate = weighted median comparable price/m² × subject area. Interval = weighted 10th–90th percentile × subject area; round lower endpoint down and upper endpoint up to whole million ISK for display. The interval describes observed comparable spread, not a guaranteed or calibrated prediction interval.

Effective sample size = (sum w)² / sum(w²). Suppress unless n>=5 and effective n>=5. “Moderate” data support requires effective n>=20, >=15 comparables in past 12 months, and interval width <40% of central estimate; otherwise “low.” Never label high confidence. Missing condition, floor, garage, view and improvements are important limitations. No financial/lending recommendation is produced.

## Experimental hedonic model

`npm run evaluate` fits ridge regression on log(price) with log(area), rooms, build year, sale time, property type, municipality and postcode. Fixed alpha=1; no tuning to holdout results. Five-year training period ends before the last complete 12-month holdout; training registration must also predate cutoff. Same-property transactions are excluded from comparable baseline candidates.

Report includes MAE, median absolute percentage error, coverage, and paired error by municipality, type and price band. Test rows are not removed using full-dataset statistical tail rules. Present-day source revisions still introduce hindsight that a true historical archive would avoid. This single fixed-origin split is an experiment, not full validation. Saved results: `data/evaluation/hedonic.json`. The app never imports model weights. The more complex model must not be promoted unless it outperforms the baseline in repeated forward evaluations and at the intended product input set.

Apartment lookup groups historical residential records by FASTNUM, retaining the latest recorded attributes and the verbatim FEPILOG unit reference. It includes metadata from price-ineligible agreements, which are still excluded from all comparable prices. Address/identifier lookup is accent-insensitive and bounded to 25 results per request; it is not a complete current register. The chosen property is excluded from its own comparable set, and users can correct stale attributes before submitting.

## Shared sample-size rules and quantiles (lib/distribution.ts)

`SAMPLE` centralizes thresholds: medians need n ≥ 5, results under n = 10 carry a warning, and detailed distributions (quartiles, histograms, percentile positions, 90th-percentile delays) need n ≥ 20. Quantiles use `lib/data` `quantile`: linear interpolation between order statistics (Hyndman & Fan type 7, the R/NumPy default). Percentile rank is the mid-rank: share strictly below plus half the share equal.

## Price distributions

`/api/distribution` applies exactly the `/api/explore` filters (eligible HMS contracts only, never asking prices) to total price or price/m². Histograms are equal-width with open lower and upper tails. Candidate layouts combine tail cuts (2, 5, 10, 15 or 25 % quantiles, always with at least 5 values in each tail) with "nice" widths no narrower than 1 m.kr. or 10 þ.kr./m². Any layout with an interior bin holding 1–4 sales is rejected; the layout maximizing interior share × min(bins, 12) is chosen. Small groups (about 20–40 sales) often have no safe layout, and the interface then shows quartiles without bars. Warnings: mixed types (houses 10–90 % of the group), size spread (area p90/p10 above 2 for total price, above 3 for price/m²), periods over three years (nominal ISK), and region-wide groups. A sale's comparison group (`distributionLink`) is the same postcode and type, area ±25 % and contracts within six months either side of the sale (capped at today), the sale itself included.

## Property sales history

`buildHistoryIndex` keeps every Capital Region residential contract per FASTNUM with a valid date, including contracts excluded from statistics, with flags: other FASTNUMs in the same FAERSLUNUMER (bundle, the price covers all), HMS-unsuitable, incomplete, extreme price/m². The same FASTNUM, contract date and price under different FAERSLUNUMER is treated as one sale registered twice (318 rows in the 2026-10-17 snapshot). Ingestion now excludes the later registration from statistics (`probable_duplicate_registration`).

Status: _confirmed_ with at least two contracts and no change of FEPILOG, type or area (more than max(2 m², 5 %), ignored when either contract is a bundle); _uncertain_ otherwise; _single_ with one contract. Price changes are computed only between contracts that have a price, cover one property and are HMS-suitable, against the latest earlier such contract (skipped contracts are counted and shown). Differences in unit, area, type, rooms or build year, or an incomplete or extreme contract, mark the comparison uncertain. Changes are nominal; no annualized rate is shown. 2026-10-17 snapshot: 71,569 properties and 133,161 distinct contracts; 34,491 confirmed, 1,773 uncertain and 35,305 single-sale histories.

## Valuation evidence and sensitivity

The comparable method is unchanged: output was verified identical to the previous implementation on 103 real subjects. `weightParts` exposes the four factors; `lookback` accepts 12, 24 or 36 months (default 24). Diagnostics report the weight from sales at least 12 months old, from less similar sales (size × rooms × build-year factor below 0.5), the top-1 and top-5 weight shares, the range of the centre when each of the ten heaviest sales is left out, and subject characteristics outside the comparables' range. `sensitivity()` reruns the method with one change each (area ±10 %, rooms ±1, build year ±10, lookback 12 or 36). Each scenario keeps the n ≥ 5 and effective n ≥ 5 safeguards and returns no estimate rather than extrapolating.

`npm run backtest` (`scripts/backtest-comparables.ts`) evaluates the production estimator over the last eight complete quarters. For each quarter only contracts registered before the quarter began are comparables; every eligible test sale in the quarter is estimated as of its signature date with its own property excluded; test sales get no outcome-based tail screening. Result on the 2026-10-17 snapshot (`data/evaluation/comparables.json`), 11,411 test sales:

| Lookback  | Availability |  MdAPE | Within 10 % | 10–90 band coverage | Median signed error |
| --------- | -----------: | -----: | ----------: | ------------------: | ------------------: |
| 12 months |       98.2 % | 6.09 % |      70.9 % |              80.3 % |              −1.7 % |
| 24 months |       99.1 % | 6.03 % |      71.2 % |              80.6 % |              −2.0 % |
| 36 months |       99.2 % | 6.03 % |      71.1 % |              80.6 % |              −2.1 % |

Band coverage near 80 % is an average over many properties. The interface still describes the range as the spread of comparable sales, not a calibrated prediction interval, and never claims high confidence. The negative median signed error is consistent with rising nominal prices; no adjustment was made. No new model was trained or deployed.

## Newly observed transactions and registration delay

Rows are keyed by FAERSLUNUMER|FASTNUM (unique in every inspected snapshot). The fingerprint (`lib/observations.ts`) covers transaction fields only. `FASTEIGNAMAT_GILDANDI`, `FYRIRHUGAD_FASTEIGNAMAT` and `BRUNABOTAMAT_GILDANDI` are current-register values: between the 2026-09-20 and 2026-10-17 downloads `BRUNABOTAMAT_GILDANDI` changed in 188,054 rows. Each run classifies rows as new, modified, unchanged, removed (remembered for 180 days), restored, or revised. A revised row is a new key whose FAERSLUNUMER matches a key that vanished in the same run, or a property added to a known contract; it inherits the contract's first observation. The first run is a baseline, so no row is reported new on day one. A run in which more than max(500, 2 %) of known rows disappear stops unless `--allow-mass-removal` is given. The 2026-10-17 run against the 2026-09-20 baseline found 955 new rows, 170 modified (84 HMS suitability flags, 71 rooms, 9 addresses, 6 prices, 6 areas, 2 assessments) and none removed.

`/nyskrad` lists eligible sales by first-observed date with all three dates (signature, registration, first observed) and never calls them sold on the day observed. Registration delay is registration date minus signature date in days, for eligible sales registered in the 12 months before the latest registration date; grouping by registration month avoids right-censoring. Histogram buckets (0–3, 4–7, 8–14, 15–30, 31–60, 61–90, 91–180, 181+ days) merge until none holds 1–4 contracts. The completeness curve uses contracts signed one to two years before the data date. A contract month is flagged as probably incomplete when the historical share registered within the elapsed time, averaged over the month's days, is below 95 %. Only that share is reported; no count of unregistered sales is estimated. 2026-10-17 snapshot: median delay 7 days, p90 16 days, 97.7 % within 30 days; only October 2026 flagged.

## Saved searches and Atom feeds (October 2026)

Saved searches are stored only in the browser (localStorage key `fasteign.savedSearches`, envelope version 1). Each stores a canonical view query; every load re-normalizes it with the same parser the pages use, so obsolete or invalid filters are dropped and the entry is marked as adjusted. Stores written by a newer schema version are left untouched. Feeds (`/api/feed`, Atom 1.0) are computed on the server from the URL alone. They list at most 50 eligible sales matching the filters (the period filter is not accepted) that were first observed in the last 60 days by the observation tracker. Baseline rows, modified rows and identifier corrections of known contracts keep their original first-seen date, so they are never reported as new. Entry IDs are tag URIs `tag:fasteign.gunnthor.is,2026-10:kaupsamningur/<FAERSLUNUMER>/<FASTNUM>`. Each entry states the contract date, registration date and first-observed date separately. Unknown or invalid parameters return 400.

## Exports

Images (SVG and PNG, light or dark theme) and CSV tables are built in the browser from the aggregates the page received, never from raw rows or the rendered DOM (lib/exports.ts, lib/export-svg.ts, lib/csv.ts). Builders re-apply the sample rules: no median under 5 sales, no period change unless both periods have 10, no quartiles or bins under 20, and no exported bin with 1–4 sales. CSV is UTF-8 with BOM, semicolon separators, decimal comma and CRLF line endings, with metadata lines prefixed by "#". Text cells beginning with = + - @, tab or CR get a leading apostrophe to stop spreadsheet formula execution. No raw transaction export exists.

## Market composition (/samsetning)

Two periods are compared: by default the 12 months to the data date and the 12 months before, alternatively two calendar years or custom dates. The breakdowns are type, size band (lower bound included, upper excluded), rooms (with "unknown"), build-year group (with "unknown") and geography one level below the selection. Every eligible sale falls in exactly one group per breakdown, so group counts reconcile to period totals; this is tested. The overall median follows the 5/10 rule. Group medians and within-group changes need 20 sales per period. Comparable groups are type × size-band cells with at least 20 sales in both periods. The plain-language summary reports the overall change, mix shifts of at least 3 percentage points and the range of within-group changes. When the overall change falls outside that range, it says this may reflect composition but also that a median of a mixture is not an average of group medians. It never attributes a share of the change to composition, and it is not a price index. Warnings cover unequal or overlapping periods, fewer than 100 sales, periods more than two years apart (nominal prices), and probably incomplete months.

## Area profiles and activity per 1,000 dwellings (/svaedi)

Profiles cover municipalities, Reykjavík districts and postcodes. Pages with fewer than 20 eligible sales in 24 months are reachable but marked noindex and left out of the sitemap. Headline statistics cover the 12 months to the data date. For Reykjavík districts only, "registered eligible sales per 1,000 dwellings" uses eligible sales placed in the district during the 12 complete months before the first probably incomplete month, divided by the 2026 dwelling count. The share of Reykjavík sales that could be placed in a district is shown, and the rate is withheld under 5 sales. Contracts HMS marks unsuitable are not counted, a dwelling can be sold twice, and the denominator is a single year, so the figure is not a turnover rate.

## Unit codes and map positions

See DATA_SOURCES.md (FEPILOG, Staðfangaskrá). Map points are address points; sales at one address share a point, which is drawn larger with an orange ring, and its popup lists every sale there. No displacement, jitter or spiderfying is applied to coordinates. Unlocated sales stay in every statistic and list.
