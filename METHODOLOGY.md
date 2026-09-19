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
