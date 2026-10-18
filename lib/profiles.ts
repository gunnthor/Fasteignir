// Server-only: area profile pages (/svaedi/[slug]) for municipalities,
// Reykjavík districts and postcodes, built from eligible sales plus verified
// housing context where it exists (Reykjavík districts only).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseFilters, shiftMonths, stats } from "./analytics";
import { select, monthlyTrend } from "./explore";
import { areaOptions, type AreaOption } from "./compare";
import { perThousand, type Housing } from "./housing";
import { slugOf } from "./slugs";
import { SAMPLE } from "./sample";
import {
  DEFAULT_FILTERS,
  apiParams,
  areaKey,
  scopeTo,
  type AreaRef,
  type FilterState,
} from "./share";
import type { Sale } from "./types";

// Listed and indexed only with this many eligible sales in the last 24 months.
export const PROFILE_MIN = 20;
export { slugOf };

export type ProfileEntry = AreaOption & {
  slug: string;
  recent: number;
  listed: boolean;
  municipalities: string[];
};
let cache: { rows: Sale[]; asOf: string; list: ProfileEntry[] } | undefined;
export function profileList(rows: Sale[], asOf: string): ProfileEntry[] {
  if (cache?.rows === rows && cache.asOf === asOf) return cache.list;
  const since = shiftMonths(asOf, -24),
    recent = new Map<string, number>(),
    owners = new Map<string, Set<string>>();
  for (const s of rows) {
    if (!s.usable || !s.capital) continue;
    const set = owners.get(s.postcode) ?? new Set<string>();
    set.add(s.municipalityName);
    owners.set(s.postcode, set);
    if (s.date < since || s.date > asOf) continue;
    for (const key of [
      `postcode:${s.postcode}`,
      `municipality:${s.municipality}`,
      s.district ? `district:${s.district}` : "",
    ])
      if (key) recent.set(key, (recent.get(key) ?? 0) + 1);
  }
  const list = areaOptions(rows).map((o) => {
    const n = recent.get(areaKey(o)) ?? 0;
    return {
      ...o,
      slug: slugOf(o),
      recent: n,
      listed: n >= PROFILE_MIN,
      municipalities:
        o.kind === "postcode" ? [...(owners.get(o.id) ?? [])].sort() : [],
    };
  });
  cache = { rows, asOf, list };
  return list;
}
export const findProfile = (rows: Sale[], asOf: string, slug: string) =>
  profileList(rows, asOf).find((p) => p.slug === slug) ?? null;

let housing: Promise<Housing> | undefined;
export function getHousing(): Promise<Housing> {
  return (housing ??= readFile(
    path.join(process.cwd(), "data/processed/housing.json"),
    "utf8",
  )
    .then((t) => JSON.parse(t) as Housing)
    .catch(() => ({
      status: "unavailable" as const,
      reason: "Íbúðatölur hafa ekki verið sóttar",
    })));
}

// Simplified outline of the area's official polygon as an SVG path in a
// width × height box (equirectangular, scaled by latitude). Visual only.
// Outlines are computed once per process and area (the GeoJSON is 1.7 MB).
let areas: Promise<GeoJSON.FeatureCollection> | undefined;
const outlines = new Map<string, Promise<Outline | null>>();
type Outline = { d: string; width: number; height: number };
export function outline(a: AreaRef, width = 320, height = 240) {
  const key = `${a.kind}:${a.id}:${width}x${height}`;
  let o = outlines.get(key);
  if (!o) {
    // A failed read is not cached: the next request tries again.
    o = draw(a, width, height).catch(() => {
      areas = undefined;
      outlines.delete(key);
      return null;
    });
    outlines.set(key, o);
  }
  return o;
}
async function draw(a: AreaRef, width: number, height: number) {
  if (a.kind === "municipality") return null;
  const geo = await (areas ??= readFile(
    path.join(process.cwd(), "public/data/areas.geojson"),
    "utf8",
  ).then((t) => JSON.parse(t) as GeoJSON.FeatureCollection));
  const f = geo.features.find(
    (x) => x.properties?.kind === a.kind && String(x.properties?.id) === a.id,
  );
  if (!f) return null;
  const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
    polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates,
    all = polys.flat(2);
  const lat = all.reduce((n, p) => n + p[1], 0) / all.length,
    k = Math.cos((lat * Math.PI) / 180),
    xs = all.map((p) => p[0] * k),
    ys = all.map((p) => p[1]),
    [x0, x1, y0, y1] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ],
    s = Math.min((width - 16) / (x1 - x0 || 1), (height - 16) / (y1 - y0 || 1)),
    ox = (width - (x1 - x0) * s) / 2,
    oy = (height - (y1 - y0) * s) / 2;
  let d = "";
  for (const poly of polys)
    for (const ring of poly) {
      let last = "",
        part = "";
      for (const [lon, la] of ring) {
        const pt = `${(ox + (lon * k - x0) * s).toFixed(1)} ${(oy + (y1 - la) * s).toFixed(1)}`;
        if (pt === last) continue;
        part += `${part ? "L" : "M"}${pt}`;
        last = pt;
      }
      d += part + "Z";
    }
  return { d, width, height };
}

// 12 full months ending with the last month that is not probably incomplete.
export function activityWindow(asOf: string, incomplete: string[]) {
  let month = asOf.slice(0, 7);
  const today = asOf.slice(0, 10);
  // The current month is never complete at the data date.
  const endOfMonth = (m: string) =>
    new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0))
      .toISOString()
      .slice(0, 10);
  while (endOfMonth(month) > today || incomplete.includes(month))
    month = shiftMonths(`${month}-01`, -1).slice(0, 7);
  const to = endOfMonth(month),
    from = shiftMonths(`${month}-01`, -11);
  return { from, to };
}

export function profile(
  rows: Sale[],
  entry: ProfileEntry,
  asOf: string,
  house: Housing,
  incomplete: string[],
) {
  const ref: AreaRef = { kind: entry.kind, id: entry.id };
  // The 12 months ending on the data date, against the 12 months before.
  const base: FilterState = scopeTo({ ...DEFAULT_FILTERS, months: "12" }, ref),
    { from, to, selected, prior } = select(
      rows,
      parseFilters(apiParams(base)),
      asOf,
    ),
    summary = stats(selected, prior);
  const five = parseFilters(apiParams({ ...base, months: "60" })),
    sel5 = select(rows, five, asOf),
    trend = monthlyTrend(rows, sel5.base, five, sel5.from, sel5.to);
  const mix = {
    apartment: selected.filter((s) => s.type === "apartment").length,
    house: selected.filter((s) => s.type === "house").length,
  };
  // Activity per 1,000 dwellings: Reykjavík districts with a verified denominator only.
  let activity: {
    from: string;
    to: string;
    sales: number;
    dwellings: number;
    population: number;
    year: number;
    rate: number | null;
    coverage: number | null;
  } | null = null;
  if (
    entry.kind === "district" &&
    house.status === "ok" &&
    house.districts[entry.id]
  ) {
    const w = activityWindow(asOf, incomplete),
      inWindow = (s: Sale) =>
        s.usable && s.capital && s.date >= w.from && s.date <= w.to,
      rvk = rows.filter((s) => inWindow(s) && s.municipality === "0000"),
      sales = rows.filter((s) => inWindow(s) && s.district === entry.id).length,
      d = house.districts[entry.id];
    activity = {
      ...w,
      sales,
      dwellings: d.dwellings,
      population: d.population,
      year: house.year,
      rate: sales >= SAMPLE.median ? perThousand(sales, d.dwellings) : null,
      // Share of Reykjavík sales in the window that could be placed in a district.
      coverage: rvk.length
        ? (rvk.filter((s) => s.district).length / rvk.length) * 100
        : null,
    };
  }
  return {
    ref,
    filters: base,
    from,
    to,
    summary,
    mix,
    trend,
    trendFrom: sel5.from,
    activity,
    housingStatus: house.status === "ok" ? null : house.reason,
    housingSource: house.status === "ok" ? house.source : null,
  };
}
export type Profile = ReturnType<typeof profile>;

// Profiles are pure per snapshot; metadata and page share one computation.
const memo = new WeakMap<Sale[], Map<string, Profile>>();
export function cachedProfile(
  rows: Sale[],
  entry: ProfileEntry,
  asOf: string,
  house: Housing,
  incomplete: string[],
) {
  let m = memo.get(rows);
  if (!m) memo.set(rows, (m = new Map()));
  const key = [entry.slug, asOf, house.status, incomplete.join(",")].join("|");
  let p = m.get(key);
  if (!p) m.set(key, (p = profile(rows, entry, asOf, house, incomplete)));
  return p;
}
