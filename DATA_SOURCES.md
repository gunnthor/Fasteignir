# Data sources and investigation

Investigation: 19 September 2026. Only registered HMS transactions drive prices. No commercial listing sites are scraped. Machine-readable, reproducible profiling is in `data/processed/report.json` after ingestion; original downloads and SHA-256 hashes are retained locally.

## HMS Kaupskrá fasteigna — used

- Owner: Húsnæðis-, mannvirkja- og skipulagsstofnun (HMS).
- Official description, schema and reuse terms: https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/kaupskra-fasteigna
- Download: https://frs3o1zldvgn.objectstorage.eu-frankfurt-1.oci.customer-oci.com/n/frs3o1zldvgn/b/public_data_for_download/o/kaupskra.csv
- Frequency: daily, after registration and review. Existing records can be revised; use a full snapshot, not append-only ingestion.
- Actual inspected file: 48,382,957 bytes; 232,084 data rows; 25 uppercase column headers; Windows-1252 (strict UTF-8 decoding fails); semicolon delimiter; CRLF lines. Decimal point numbers and timestamps such as `2026-09-18 00:00:00.0`.
- Published schema differs: actual file also has `FASTEIGNAMAT_GILDANDI` and `FYRIRHUGAD_FASTEIGNAMAT`. `Einbýli` occurs alongside `Sérbýli`; both normalize to house. Preserve the original CSV.
- Fields used: FAERSLUNUMER, EMNR + SKJALANUMER (document multiplicity check), FASTNUM, HEIMILISFANG, POSTNR, HEINUM, SVFN, SVEITARFELAG, UTGDAG, THINGLYSTDAGS, KAUPVERD, FASTEIGNAMAT, BYGGAR, EINFLM, FJHERB, TEGUND, FULLBUID, ONOTHAEFUR_SAMNINGUR. Remaining columns remain available in raw storage and profiling.
- Monetary units: **observed values are interpreted as thousands of ISK**, so the application multiplies monetary fields by 1,000. This is an explicit inference: the linked field description does not state the unit. Example: Furuvellir 23, 211.3 m², 2026-09-04, raw KAUPVERD 144900 and FASTEIGNAMAT 141450. Residential raw median is 39900; a króna interpretation would imply implausibly tiny prices. HMS's July 2026 report discusses comparable orders of magnitude (700–899 thousand kr/m²): https://hms.is/skyrslur/manadarskyrsla-juli-2026 . That is corroboration of scale, not independent verification of that individual sale. Obtain explicit source-unit confirmation before public launch; ingestion has a regression test for the chosen multiplier.
- Reuse: HMS grants permanent, free reuse, adaptation and commercial use subject to attribution. Link to original reuse guidance; do not imply endorsement or affiliation. No guarantee of completeness or availability.
- Attribution: “Byggir á upplýsingum frá HMS — Kaupskrá fasteigna.”
- Ingestion: HTTPS server/build download, retain bytes plus download timestamp, HTTP last-modified, ETag and SHA-256; strict parser, normalized audit archive, compact server-only analytical snapshot. Browser never downloads CSV.

## HMS Staðfangaskrá — used

- Owner: HMS. https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/stadfangaskra
- Download: https://hmsstgsftpprodweu001.blob.core.windows.net/fasteignaskra/Stadfangaskra.csv
- Frequency: Sundays at 21:00 according to HMS.
- Actual inspected file: 38,076,974 bytes; 139,491 rows; UTF-8; comma delimiter. 1,267 HEINUM values have multiple rows. Quality status: 99,912 unreviewed, 31,535 reviewed, 1,143 needing revision, 5 missing identifier, 6,896 blank.
- Fields used: HEINUM, SVFNR, N_HNIT_WGS84, E_HNIT_WGS84, YFIRFARID, TEGHNIT, NAKV_XY. Staff identifiers (NOTNR) and free-text notes (ATH) are not published.
- Field definitions, verified 2026-10-18 from the official attribute specification (skra.is, "Staðfangaskrá eigindalýsing.pdf"): TEGHNIT (tegund hnits) 0 type not yet reviewed, 1 estimated centre of the structure, 2 main entrance, 3 driveway of the plot, 4 certainly within the plot boundary, 5 within the estimated building footprint. YFIRFARID (staða hnits) 0 not reviewed, 1 reviewed, 2 needs revision, 9 HEINUM missing. NAKV_XY: estimated error margin in metres (blank for 47,333 of 49,775 Capital Region rows; 0 is treated as not stated).
- Since October 2026 located sales carry `pointType` (TEGHNIT) and `accuracy` (NAKV_XY); the interface states the point type, review status and error margin where given, and always that the point is the address, shared by every unit there.
- Join: Kaupskrá HEINUM = address HEINUM, requiring matching municipality. Accept only a single distinct coordinate. Reject revision-needed/missing-identifier status; leave ambiguous/unmatched sales unlocated. Official unreviewed coordinates are explicitly labelled; they are not claimed to be survey-verified. Never choose the first of several distinct points or invent a centroid for an address. This is address location, not unit/floor location. Current coordinates do not prove historical address positions.
- FASTNUM is a property identifier, not a coordinate. MATSNR is a unit identifier and is not assumed equivalent. HEINUM is the documented bridge in both schemas.
- License: public download; linked metadata gateway did not expose a dataset-specific licence during investigation. The HMS Kaupskrá reuse text is not silently assumed to be an address licence. Attribute HMS; confirm dataset-specific terms before public launch. Local investigation/implementation is available now.
- Ingestion: weekly-source CSV cached during daily snapshot, exact identifier join, no external geocoding calls in the browser.

## Reykjavíkurborg / LUKR district polygons — used locally

- Owner: Reykjavíkurborg / LUKR.
- Service: https://lukrgatt.reykjavik.is/server/rest/services/Borgarhlutar/MapServer/33
- Query: `/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`
- 10 official administrative districts (Borgarhlutar), not fine-grained neighborhoods. E.g. Háaleiti-Bústaðir is not interchangeable with Fossvogur. Approx. 2.57 MiB source GeoJSON.
- Native CRS EPSG:3057; request server transformation to WGS84 (EPSG:4326). Preserve rings/multipolygons; published geometry uses five decimal places, approx. metre precision. Fields used: HVERFI and geometry. Exact point-in-polygon uses original precision during ingestion.
- Update frequency: no guaranteed schedule found. Refresh daily and retain service/source metadata; administrative geography is contemporary, not a historical boundary series.
- Reuse guidance: https://reykjavik.is/landupplysingar . City permits copying/use of free GIS data and requires notification of when/what was extracted to lukr@reykjavik.is. No email has been sent. A ready-to-review notification is in `docs/LUKR_NOTIFICATION.md`; send it before public launch. Dataset service itself has a blank copyright field; this is not treated as a waiver of the city's terms.
- Attribution: “Kort og borgarhlutamörk: Reykjavíkurborg / LUKR.” No endorsement implied.
- Ingestion: GeoJSON server download, point-in-polygon only for Reykjavík transactions matched to official address points. Missing locations stay included in municipality/postcode statistics but cannot contribute to district statistics. UI reports mapping coverage.

## Reykjavíkurborg open data: population and dwellings by district (used)

- Dataset: "Hverfi" (id `hverfi-gagnagatt`), Umhverfis- og skipulagssvið, on https://gagnagatt.reykjavik.is (CKAN). Modified 2026-09-01.
- Resource: "Íbúafjöldi, íbúðafjöldi, heildarflatarmál, húsa-, lóða-, bruna- og fasteignamat eftir hverfum", CSV
  https://gagnagatt.reykjavik.is/dataset/5c20a363-9db2-4288-a41f-52438654a3d6/resource/5d1230b8-b802-49f3-b861-1ceaea377b86/download/aldursdreifing_ibua.csv
  (HTTP Last-Modified Tue, 01 Sep 2026 08:13:31 GMT). Columns: ar, hverfi, ibuafjoldi, ibudafjoldi, heildarflatarmal, husmat, lodmat, brunmat, fasteignamat; 10 rows for 2026.
- Geography: the dataset notes say "eftir hverfum Reykjavíkur samkvæmt stjórnsýsluskiptingu". The LUKR layer `OpinGognMorkSkiptingar/Stjornsysluskipting/FeatureServer/0` (linked from the same dataset) has the same ten HVERFI values as Borgarhlutar layer 33 with identical SHAPE.AREA and SHAPE.LEN. Ingestion re-checks this on every run (names and polygon areas within 1 m²) and publishes nothing if it fails.
- Used: `ibuafjoldi` (population) and `ibudafjoldi` (dwellings), as integers, with an explicit name mapping (lib/housing-names.ts). Not used: `heildarflatarmal` (floor-area definition not stated) and valuation columns.
- Reference date: year 2026 only; the exact date within the year is not stated, and the interface says so.
- Licence: the dataset licence field is blank; other datasets on the portal are "other-open" (Annað, opið). Treated like the LUKR polygons: attribute Reykjavíkurborg, confirm terms before public launch (see docs/LUKR_NOTIFICATION.md).
- Denominator semantics: dwellings (íbúðir). "Registered eligible sales per 1,000 dwellings" over 12 complete months is shown; it is not the share of homes sold.
- Investigated, not integrated: "Íbúðir í Reykjavík eftir hverfum og húsagerð" (2001–2023, old borgarhlutar: Vesturbær, Austurbær, Norðurbær, Suðurbær …) and "Íbúar í Reykjavík í lok árs eftir hverfum" (2011–2017): boundaries differ from or cannot be verified against the current districts, so no time series is combined with current counts.
- Blocked: no dataset with population or dwelling counts on verified boundaries was found for postcodes or for the other six Capital Region municipalities; profiles there show transaction statistics only.

## Geographic fallbacks and investigated sources

| Level                                              | Authority and source                                                                                                              | Decision                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capital Region / municipality                      | HMS SVFN: 0000, 1000, 1100, 1300, 1400, 1604, 1606                                                                                | Reliable coded transaction grouping. Includes Kjós. Current code normalization; historical merger crosswalk is not implemented.                                                                                                                                                                                                               |
| Postcode                                           | HMS POSTNR; Byggðastofnun https://www.byggdastofnun.is/is/postthjonusta/postnumer                                                 | Group directly using reported transaction postcode. Official polygon download is linked through metadata gateway and https://postnumer.gis.is/mapview/?application=postnumer ; official WFS polygons are ingested and used as the default map layer. Postal boundaries need not follow municipalities. Never draw invented postcode polygons. |
| Municipality boundaries                            | Former LMI https://www-gamli.lmi.is/landupplysingar/mork-sveitarfelaga/                                                           | National official alternative; present-day boundaries change with mergers. Not ingested; verify successor service and licence before adoption. Municipality list/comparison works from transaction codes.                                                                                                                                     |
| Fine neighborhoods                                 | Reykjavík hosted Skilmálaeiningar https://lukrgatt.reykjavik.is/server/rest/services/Hosted/Skilm%C3%A1laeiningar/FeatureServer/0 | Investigated as candidate, not equated to administrative districts. Coverage/semantics need validation before inclusion.                                                                                                                                                                                                                      |
| Buildings, parcels, land/building area, valuations | Reykjavík LUKR / Borgarvefsjá https://borgarvefsja.reykjavik.is/arcgis/rest/services/Borgarvefsja/Borgarvefsja/MapServer          | Official services available, native EPSG:3057; not needed for initial actual-sales statistics. Verify layer definitions/time basis before joins.                                                                                                                                                                                              |
| Population / age / dwellings                       | City open-data catalogue https://gagnagatt.reykjavik.is and https://gagnahladbord.reykjavik.is                                    | 2026 population and dwellings by district are used (see the Reykjavíkurborg open data section). Other series are not ingested; no demographic numbers are fabricated.                                                                                                                                                                         |

## Basemap — used

OpenStreetMap contributors, https://www.openstreetmap.org/copyright ; raster tiles https://tile.openstreetmap.org/{z}/{x}/{y}.png . ODbL attribution retained visibly by MapLibre. Tile service terms: https://operations.osmfoundation.org/policies/tiles/ . Browser requests only on-screen tiles; no bulk prefetch/offline harvesting. Third-party tile requests expose usual connection metadata. For production traffic, configure an appropriate tile provider with `NEXT_PUBLIC_MAP_STYLE_URL`; public OSM tile capacity is not a service-level guarantee. Basemap imagery is contextual, never a source of transaction coordinates or prices.

## Byggðastofnun postcode polygons — implemented

- Owner: Byggðastofnun; served by Náttúrufræðistofnun / former Landmælingar Íslands.
- [Official metadata and reuse terms](https://gatt.natt.is/geonetwork/srv/api/records/22e98d21-a86b-4b62-ad58-a6d17703b612).
- WFS: `https://gis.lmi.is/geoserver/byggdastofnun/ows`, type `byggdastofnun:postnumer`, GeoJSON requested in EPSG:4326.
- Reuse/copy/publication permitted with attribution: **Byggt á gögnum frá Byggðastofnun.** Source provides no accuracy guarantee.
- The ingestion snapshot preserves official polygons for postcodes observed in Capital Region records. Boundaries are current, while metrics group by transaction-reported historical postcode. Postal areas can cross municipal boundaries. No invented boundaries or centroids are used.

## Apartment lookup

Latest recorded residential metadata per HMS FASTNUM, including source FEPILOG unit reference, HEINUM (staðfang, used to list other units at the same address), address, postcode, area, rooms, building year and record date. This is a historical-sales index, not a comprehensive or current property registry. Users must verify the unit and update stale details. Own-property sales are excluded from its estimate. Source flags for suitability of a _price_ do not establish whether historical property metadata is current.

## FEPILOG unit codes

- Definition (FMR, "Landskrá fasteigna – handbók fyrir Bygging", 2003, pp. 69 and 85): "Epilog er sama og mhlnúmer + eignarhaldsnúmer. Fepilog er sama og mhlnúmer + eignarhaldsnúmer þeirrar eignar sem matseiningin tengist." An eignarhaldsnúmer is the rýmisnúmer of the main space: two digits for the floor number and two for the position on that floor, counted from the left when facing the main entrance. EPILOG/FEPILOG are corrected when matshlutar are merged or split.
- Observed in Kaupskrá (233,039 rows, 2026-10-17): 230,975 six-digit codes, 2,008 two-digit codes, 40 of the form 99B99, a few others; none empty. 193 HEINUM + FEPILOG pairs map to more than one FASTNUM.
- Use: six-digit codes are shown as "01-0302 · hæðarnúmer 03, rými 02" (lib/units.ts). Other forms are shown verbatim and never interpreted. Two properties at one address with the same code are reported as ambiguous rather than told apart. The floor number is the register's numbering; the interface does not translate it into a named floor.
