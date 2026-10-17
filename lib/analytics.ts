import { median, quantile, isoDate } from "./data";
import type { Sale, Filters, Stats, AreaStats } from "./types";
export function shiftMonths(date: string, months: number) {
  const d = new Date(date + "T00:00:00Z"),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return d.toISOString().slice(0, 10);
}
export function parseFilters(p: URLSearchParams): Filters {
  const numeric = (key: string, fallback: number, min: number, max: number) => {
    const raw = p.get(key);
    if (raw === null || raw === "") return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max)
      throw Error(`Ógilt gildi: ${key}`);
    return n;
  };
  const date = (key: string) => {
    const raw = p.get(key);
    if (!raw) return undefined;
    const d = isoDate(raw);
    if (
      !d ||
      d !== raw ||
      d < "1900-01-01" ||
      d > new Date().toISOString().slice(0, 10)
    )
      throw Error("Ógild dagsetning");
    return d;
  };
  const f = {
    months: numeric("months", 12, 0, 2400),
    from: date("from"),
    to: date("to"),
    type: p.get("type") ?? "all",
    municipality: p.get("municipality") ?? "",
    postcode: p.get("postcode") ?? "",
    district: p.get("district") ?? "",
    minArea: numeric("minArea", 0, 0, 10000),
    maxArea: numeric("maxArea", 10000, 0, 10000),
    rooms: numeric("rooms", 0, 0, 5),
    minBuilt: numeric("minBuilt", 1000, 1000, 2100),
    maxBuilt: numeric("maxBuilt", 2100, 1000, 2100),
    q: (p.get("q") ?? "").trim().slice(0, 100),
  };
  if (
    f.minArea > f.maxArea ||
    f.minBuilt > f.maxBuilt ||
    (f.from && f.to && f.from > f.to)
  )
    throw Error("Upphaf bils þarf að vera á undan enda þess");
  if (!["all", "apartment", "house"].includes(f.type))
    throw Error("Ógild tegund");
  return f;
}
export function range(f: Filters, today: string) {
  const to = f.to ?? today;
  return {
    from: f.from ?? (f.months ? shiftMonths(to, -f.months) : "1900-01-01"),
    to,
  };
}
export function matches(s: Sale, f: Filters, ignoreDistrict = false) {
  return (
    s.usable &&
    s.capital &&
    (f.type === "all" || s.type === f.type) &&
    (!f.municipality || s.municipality === f.municipality) &&
    (!f.postcode || s.postcode === f.postcode) &&
    (ignoreDistrict || !f.district || s.district === f.district) &&
    s.area >= f.minArea &&
    s.area <= f.maxArea &&
    (!f.rooms || (f.rooms === 5 ? (s.rooms ?? 0) >= 5 : s.rooms === f.rooms)) &&
    ((f.minBuilt === 1000 && f.maxBuilt === 2100) ||
      (s.built !== null && s.built >= f.minBuilt && s.built <= f.maxBuilt)) &&
    (!f.q ||
      `${s.address} ${s.postcode} ${s.municipalityName} ${s.district ?? ""}`
        .toLocaleLowerCase("is")
        .includes(f.q.toLocaleLowerCase("is")))
  );
}
export function stats(sales: Sale[], previous: Sale[] = []): Stats {
  const n = sales.length,
    show = n >= 5;
  const values = (
    key: "ppm" | "price" | "area" | "rooms" | "built" | "valuation",
  ) => sales.map((s) => s[key]).filter((v): v is number => v !== null);
  const ppm = show ? median(values("ppm")) : null,
    ratios = sales
      .filter((s) => s.valuation && s.valuation > 0)
      .map((s) => s.price / s.valuation!);
  const prev = previous.length >= 5 ? median(previous.map((s) => s.ppm)) : null;
  return {
    count: n,
    ppm,
    price: show ? median(values("price")) : null,
    area: show ? median(values("area")) : null,
    rooms: show && values("rooms").length >= 5 ? median(values("rooms")) : null,
    built: show && values("built").length >= 5 ? median(values("built")) : null,
    valuation:
      show && values("valuation").length >= 5
        ? median(values("valuation"))
        : null,
    ratio: ratios.length >= 5 ? median(ratios) : null,
    ratioCount: ratios.length,
    sparse: n < 10,
    change:
      ppm && prev && n >= 10 && previous.length >= 10
        ? (ppm / prev - 1) * 100
        : null,
    previousCount: previous.length,
  };
}
export function groupStats(
  rows: Sale[],
  previous: Sale[],
  kind: AreaStats["kind"],
): AreaStats[] {
  const field =
    kind === "municipality"
      ? "municipality"
      : kind === "postcode"
        ? "postcode"
        : "district";
  const groups = new Map<string, Sale[]>(),
    prev = new Map<string, Sale[]>();
  for (const s of rows) {
    const key = s[field];
    if (key) {
      const a = groups.get(key) ?? [];
      a.push(s);
      groups.set(key, a);
    }
  }
  for (const s of previous) {
    const key = s[field];
    if (key) {
      const a = prev.get(key) ?? [];
      a.push(s);
      prev.set(key, a);
    }
  }
  return [...groups]
    .map(([id, sales]) => ({
      id,
      name: kind === "municipality" ? sales[0].municipalityName : id,
      kind,
      ...stats(sales, prev.get(id)),
    }))
    .sort((a, b) => b.count - a.count);
}
export type Subject = {
  propertyId?: string;
  postcode: string;
  type: "apartment" | "house";
  area: number;
  rooms: number;
  built: number;
};
// Supported comparable lookback windows in months; 24 is the published default.
export const LOOKBACKS = [12, 24, 36] as const;
export type Lookback = (typeof LOOKBACKS)[number];
export const DEFAULT_LOOKBACK: Lookback = 24;
const monthsBetween = (from: string, to: string) =>
  (+new Date(to) - +new Date(from)) / 86400000 / 30.4375;
// The four heuristic similarity factors behind a comparable's weight, or null
// when the sale is not an eligible comparable at all.
export function weightParts(
  s: Sale,
  subject: Subject,
  asOf: string,
  lookback: number = DEFAULT_LOOKBACK,
) {
  const months = monthsBetween(s.date, asOf);
  if (
    (Boolean(subject.propertyId) && s.propertyId === subject.propertyId) ||
    !s.usable ||
    !s.capital ||
    s.postcode !== subject.postcode ||
    s.type !== subject.type ||
    months < 0 ||
    months > lookback ||
    s.area < subject.area * 0.65 ||
    s.area > subject.area * 1.5
  )
    return null;
  return {
    size: Math.exp(-Math.abs(Math.log(s.area / subject.area)) * 4),
    room: s.rooms ? Math.exp(-Math.abs(s.rooms - subject.rooms) * 0.35) : 0.5,
    age: s.built ? Math.exp(-Math.abs(s.built - subject.built) / 50) : 0.5,
    recency: Math.exp(-months / 12),
    months,
  };
}
export function comparableWeight(
  s: Sale,
  subject: Subject,
  asOf: string,
  lookback: number = DEFAULT_LOOKBACK,
) {
  const p = weightParts(s, subject, asOf, lookback);
  return p ? p.size * p.room * p.age * p.recency : 0;
}
export function weightedQuantile(
  values: { value: number; weight: number }[],
  q: number,
) {
  const a = [...values].sort((a, b) => a.value - b.value),
    total = a.reduce((n, x) => n + x.weight, 0);
  let cumulative = 0;
  for (const x of a) {
    cumulative += x.weight;
    if (cumulative >= total * q) return x.value;
  }
  return a.at(-1)?.value ?? null;
}
// Eligible sales per postcode and type, so repeated estimates (sensitivity
// scenarios, backtests) do not rescan the whole snapshot.
const pools = new WeakMap<Sale[], Map<string, Sale[]>>();
function pool(rows: Sale[], subject: Subject) {
  let index = pools.get(rows);
  if (!index) {
    index = new Map();
    for (const s of rows) {
      if (!s.usable || !s.capital) continue;
      const key = `${s.postcode}|${s.type}`,
        list = index.get(key) ?? [];
      list.push(s);
      index.set(key, list);
    }
    pools.set(rows, index);
  }
  return index.get(`${subject.postcode}|${subject.type}`) ?? [];
}

type Candidate = {
  sale: Sale;
  weight: number;
  parts: NonNullable<ReturnType<typeof weightParts>>;
};
// Weighted median price/m² and 10th/90th percentile band for a candidate set.
function summarize(candidates: Candidate[], area: number) {
  const values = candidates.map((c) => ({
    value: c.sale.ppm,
    weight: c.weight,
  }));
  const ppm = weightedQuantile(values, 0.5)!;
  return {
    ppm,
    central: ppm * area,
    low: weightedQuantile(values, 0.1)! * area,
    high: weightedQuantile(values, 0.9)! * area,
  };
}
const effectiveSize = (c: { weight: number }[]) => {
  const total = c.reduce((n, x) => n + x.weight, 0);
  return total
    ? (total * total) / c.reduce((n, x) => n + x.weight * x.weight, 0)
    : 0;
};
const enough = (c: Candidate[]) => c.length >= 5 && effectiveSize(c) >= 5;
const outsideRange = (
  r: { min: number; max: number } | null,
  v: number,
  name: "area" | "rooms" | "built",
) => (r && (v < r.min || v > r.max) ? [name] : []);

export function estimate(
  rows: Sale[],
  subject: Subject,
  asOf: string,
  { lookback = DEFAULT_LOOKBACK }: { lookback?: number } = {},
) {
  // One latest eligible sale per property, preventing frequent resales from dominating.
  const byProperty = new Map<string, Candidate>();
  for (const sale of pool(rows, subject)) {
    const parts = weightParts(sale, subject, asOf, lookback);
    if (!parts) continue;
    const weight = parts.size * parts.room * parts.age * parts.recency;
    if (weight <= 0) continue;
    const key = sale.propertyId || sale.id,
      old = byProperty.get(key);
    if (!old || sale.date > old.sale.date)
      byProperty.set(key, { sale, weight, parts });
  }
  const candidates = [...byProperty.values()]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 50),
    total = candidates.reduce((n, c) => n + c.weight, 0),
    effective = effectiveSize(candidates);
  if (!enough(candidates))
    return {
      available: false as const,
      count: candidates.length,
      effective,
      lookback,
      reason:
        "Of fáar sambærilegar sölur. Prófaðu stærra póstsvæði eða bíddu eftir fleiri skráðum sölum.",
    };
  const { ppm, central, low, high } = summarize(candidates, subject.area);
  const recent = candidates.filter(
    (c) => c.sale.date >= shiftMonths(asOf, -12),
  ).length;
  const share = (keep: (c: Candidate, i: number) => boolean) =>
    candidates.filter(keep).reduce((n, c) => n + c.weight, 0) / total;
  // Removing any one of the ten most influential sales: how far can the centre move?
  const leaveOneOut = candidates.slice(0, 10).flatMap((_, i) => {
    const rest = candidates.filter((_, j) => j !== i);
    return enough(rest) ? [summarize(rest, subject.area).central] : [];
  });
  const range = (pick: (s: Sale) => number | null) => {
    const v = candidates
      .map((c) => pick(c.sale))
      .filter((x): x is number => x !== null);
    return v.length ? { min: Math.min(...v), max: Math.max(...v) } : null;
  };
  const areaRange = range((s) => s.area)!,
    roomsRange = range((s) => s.rooms),
    builtRange = range((s) => s.built);
  return {
    available: true as const,
    count: candidates.length,
    effective,
    lookback,
    ppm,
    central,
    low,
    high,
    confidence:
      effective >= 20 && recent >= 15 && (high - low) / central < 0.4
        ? "moderate"
        : "low",
    comparables: candidates.map((c) => ({
      sale: c.sale,
      weight: c.weight / total,
      parts: {
        size: c.parts.size,
        room: c.parts.room,
        age: c.parts.age,
        recency: c.parts.recency,
      },
      ageMonths: c.parts.months,
    })),
    medianAgeMonths: median(candidates.map((c) => c.parts.months)),
    spread:
      quantile(
        candidates.map((c) => c.sale.ppm),
        0.9,
      )! -
      quantile(
        candidates.map((c) => c.sale.ppm),
        0.1,
      )!,
    diagnostics: {
      // Weight carried by sales signed 12+ months before the as-of date.
      olderShare: share((c) => c.parts.months >= 12),
      // Weight carried by sales whose size/rooms/build-year similarity is
      // below half of a perfect match (before the recency factor).
      lessSimilarShare: share(
        (c) => c.parts.size * c.parts.room * c.parts.age < 0.5,
      ),
      topShare: candidates[0].weight / total,
      top5Share: share((_, i) => i < 5),
      leaveOneOut: leaveOneOut.length
        ? { min: Math.min(...leaveOneOut), max: Math.max(...leaveOneOut) }
        : null,
      areaRange,
      roomsRange,
      builtRange,
      // Subject characteristics outside every comparable: the estimate extrapolates.
      outside: [
        ...outsideRange(areaRange, subject.area, "area"),
        ...outsideRange(roomsRange, subject.rooms, "rooms"),
        ...outsideRange(builtRange, subject.built, "built"),
      ],
    },
  };
}
export type Estimate = ReturnType<typeof estimate>;

export type ScenarioChange = Partial<
  Pick<Subject, "area" | "rooms" | "built">
> & { lookback?: number };
// Bounded what-if grid around one subject: each scenario reruns the unchanged
// comparable method with one input changed. It shows how much the result
// depends on inputs and window; it does not add accuracy.
export function sensitivity(rows: Sale[], subject: Subject, asOf: string) {
  const year = Number(asOf.slice(0, 4)),
    round = (n: number) => Math.round(n * 10) / 10;
  const scenarios: { key: string; change: ScenarioChange }[] = [
    { key: "area-10", change: { area: round(subject.area * 0.9) } },
    { key: "area+10", change: { area: round(subject.area * 1.1) } },
    ...(subject.rooms > 1
      ? [{ key: "rooms-1", change: { rooms: subject.rooms - 1 } }]
      : []),
    ...(subject.rooms < 20
      ? [{ key: "rooms+1", change: { rooms: subject.rooms + 1 } }]
      : []),
    { key: "built-10", change: { built: subject.built - 10 } },
    ...(subject.built + 10 <= year
      ? [{ key: "built+10", change: { built: subject.built + 10 } }]
      : []),
    ...LOOKBACKS.filter((m) => m !== DEFAULT_LOOKBACK).map((m) => ({
      key: `lookback${m}`,
      change: { lookback: m },
    })),
  ];
  return scenarios.map(({ key, change }) => {
    const { lookback, ...rest } = change,
      r = estimate(rows, { ...subject, ...rest }, asOf, { lookback });
    return {
      key,
      change,
      available: r.available,
      count: r.count,
      effective: r.effective,
      central: r.available ? r.central : null,
      low: r.available ? r.low : null,
      high: r.available ? r.high : null,
    };
  });
}
