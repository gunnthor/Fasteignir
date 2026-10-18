// Reykjavík housing context: population and dwellings per district.
//
// Source: Reykjavíkurborg open data, dataset "Hverfi" (gagnagatt.reykjavik.is,
// resource "Íbúafjöldi, íbúðafjöldi, heildarflatarmál … eftir hverfum"), by
// district "samkvæmt stjórnsýsluskiptingu". Used only when its district
// boundaries are verified to be the LUKR Borgarhlutar polygons Fasteign uses
// (same names, same polygon areas). Otherwise nothing is published: no
// denominator from a different geography is ever divided into sales.
// Pure; scripts/fetch-kaupskra.ts handles files.

import { DISTRICT_NAMES } from "./housing-names";
export { DISTRICT_NAMES };

export type HousingDistrict = { population: number; dwellings: number };
export type Housing =
  | {
      status: "ok";
      year: number;
      source: {
        dataset: string;
        url: string;
        downloadedAt: string | null;
        sha256: string;
      };
      districts: Record<string, HousingDistrict>;
    }
  | { status: "unavailable"; reason: string };

const unavailable = (reason: string): Housing => ({
  status: "unavailable",
  reason,
});

// `records`: the CSV rows (lowercase headers). `layer`: ArcGIS attributes of the
// Stjórnsýsluskipting layer. `districts`: the Borgarhlutar features in use.
export function buildHousing(
  records: Record<string, string>[],
  layer: { HVERFI?: unknown; Shape__Area?: unknown }[] | null,
  districts: { HVERFI?: unknown; "SHAPE.AREA"?: unknown }[],
  source: { url: string; downloadedAt: string | null; sha256: string },
): Housing {
  for (const k of ["ar", "hverfi", "ibuafjoldi", "ibudafjoldi"])
    if (!records.length || !(k in records[0]))
      return unavailable(`Dálk vantar: ${k}`);
  const years = new Set(records.map((r) => r.ar.trim()));
  if (years.size !== 1)
    return unavailable("Gögnin ná yfir fleiri en eitt viðmiðunarár");
  const year = Number([...years][0]);
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    return unavailable("Ógilt viðmiðunarár");
  // Boundary check: the source layer must be the polygons Fasteign assigns sales to.
  if (!layer?.length) return unavailable("Ekki tókst að staðfesta mörk hverfa");
  const ours = new Map(
    districts.map((d) => [String(d.HVERFI), Number(d["SHAPE.AREA"])]),
  );
  if (layer.length !== ours.size)
    return unavailable("Fjöldi hverfa í mörkum stemmir ekki");
  for (const l of layer) {
    const name = String(l.HVERFI),
      area = Number(l.Shape__Area),
      mine = ours.get(name);
    if (
      mine === undefined ||
      !(Math.abs(area - mine) <= Math.max(1, mine * 1e-6))
    )
      return unavailable(`Mörk hverfis stemma ekki: ${name}`);
  }
  const out: Record<string, HousingDistrict> = {};
  for (const r of records) {
    const id = DISTRICT_NAMES[r.hverfi.trim()];
    if (!id || !ours.has(id)) return unavailable(`Óþekkt hverfi: ${r.hverfi}`);
    if (out[id]) return unavailable(`Hverfi tvítalið: ${r.hverfi}`);
    const population = Number(r.ibuafjoldi),
      dwellings = Number(r.ibudafjoldi);
    if (![population, dwellings].every((n) => Number.isInteger(n) && n > 0))
      return unavailable(`Ógildar tölur fyrir ${r.hverfi}`);
    out[id] = { population, dwellings };
  }
  if (Object.keys(out).length !== ours.size)
    return unavailable("Tölur vantar fyrir sum hverfi");
  return {
    status: "ok",
    year,
    source: {
      dataset: "Reykjavíkurborg · Hverfi (gagnagatt.reykjavik.is)",
      ...source,
    },
    districts: out,
  };
}

// Registered eligible sales per 1,000 dwellings over a window. Not the share of
// homes sold: one dwelling can be sold more than once, and the dwelling count
// is a single reference year.
export function perThousand(sales: number, dwellings: number) {
  return dwellings > 0 ? (sales / dwellings) * 1000 : null;
}
