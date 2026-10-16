# Fasteign roadmap

Reconstructed on 20 September 2026 from README.md, DATA_SOURCES.md,
METHODOLOGY.md, docs/VALIDATION.md and Git history. This is a repository-backed
handoff, not a recovered copy of the conversation on the previous PC. The order
below is a proposed continuation; the original conversation's priorities are unknown.

## Completed

- Capital Region postcode map, district view, filters and actual-sale analytics.
- Historical apartment lookup, editable property details and comparable-sale estimates.
- Market charts, methodology page, responsive layout and dark mode.
- Data ingestion, provenance, snapshot guards and optional daily deployment workflow.
- Experimental hedonic model evaluation; comparable-sales baseline performed better.
- Readability improvements (`8359c0e`).
- Exact house-number matching in apartment search (`1e372b0`).
- Shareable URL state, Open Graph cards (`/api/card`) and script-free embeds (`/embed`) with sample suppression, period, nominal caveat and data date (16 October 2026).

## 1. Restore and verify on this PC

- Install locked dependencies with `npm ci`.
- Recreate ignored data with `npm run ingest`; raw data does not travel through Git.
- Run unit tests, type checking, production build and browser tests.
- Start the site locally for review.

Completed on 20 September 2026: dependencies installed, official data regenerated
(106,963 eligible Capital Region sales), 22 unit tests passed, type checking and
production build passed, and all seven browser tests passed using installed Chrome.
The local production server was started at http://localhost:3001. Browser tests
use neutral background tiles; public basemap availability is not covered.

Next proposed task: resolve the documented source confirmations in section 2,
starting with HMS monetary units and address-data reuse evidence.

## 2. Prepare a public launch

- Confirm the HMS monetary units and Staðfangaskrá reuse terms; retain evidence in DATA_SOURCES.md.
- Review the prepared LUKR extraction notice in LUKR_NOTIFICATION.md. Sending it requires an explicit instruction.
- Select a basemap suitable for expected traffic.
- Connect the intended Vercel project and verify a preview with the generated data.
- Configure the domain and workflow deployment credentials when ready to launch.
- Enable automatic production deployment after preview review.

The repository's existing notes report no deployment, DNS change or sent notification.
Do not infer that these have happened from the presence of deployment configuration.

## 3. Validate valuation quality

- Repeat forward evaluation across multiple historical cutoffs.
- Report coverage and errors by municipality, property type and price band.
- Evaluate uncertainty calibration separately from the current comparable-price spread.
- Keep the existing comparable-sales baseline unless a replacement demonstrably improves results.

## 4. Expand product coverage

- Validate official fine-neighborhood boundaries and their semantics before adding them.
- Investigate an authoritative current property register, including access and reuse terms.
- Add English localization after extracting the remaining Icelandic page copy.

These are separate future iterations, not features already promised by the current data.

## Handoff practice

Update this file with the next concrete task and validation results before switching PCs.
Commit and push code and documentation to transfer them; regenerate ignored datasets locally.
