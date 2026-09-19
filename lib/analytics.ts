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
export function comparableWeight(s: Sale, subject: Subject, asOf: string) {
  const months = (+new Date(asOf) - +new Date(s.date)) / 86400000 / 30.4375;
  if (
    (Boolean(subject.propertyId) && s.propertyId === subject.propertyId) ||
    !s.usable ||
    !s.capital ||
    s.postcode !== subject.postcode ||
    s.type !== subject.type ||
    months < 0 ||
    months > 24 ||
    s.area < subject.area * 0.65 ||
    s.area > subject.area * 1.5
  )
    return 0;
  const size = Math.exp(-Math.abs(Math.log(s.area / subject.area)) * 4),
    room = s.rooms ? Math.exp(-Math.abs(s.rooms - subject.rooms) * 0.35) : 0.5,
    age = s.built ? Math.exp(-Math.abs(s.built - subject.built) / 50) : 0.5,
    recency = Math.exp(-months / 12);
  return size * room * age * recency;
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
export function estimate(rows: Sale[], subject: Subject, asOf: string) {
  // One latest eligible sale per property, preventing frequent resales from dominating.
  const byProperty = new Map<string, { sale: Sale; weight: number }>();
  for (const sale of rows) {
    const weight = comparableWeight(sale, subject, asOf);
    if (weight <= 0) continue;
    const key = sale.propertyId || sale.id,
      old = byProperty.get(key);
    if (!old || sale.date > old.sale.date)
      byProperty.set(key, { sale, weight });
  }
  const candidates = [...byProperty.values()]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 50),
    total = candidates.reduce((n, c) => n + c.weight, 0),
    effective = total
      ? (total * total) /
        candidates.reduce((n, c) => n + c.weight * c.weight, 0)
      : 0;
  if (candidates.length < 5 || effective < 5)
    return {
      available: false as const,
      count: candidates.length,
      effective,
      reason:
        "Of fáar sambærilegar sölur. Prófaðu stærra póstsvæði eða bíddu eftir fleiri skráðum sölum.",
    };
  const values = candidates.map((c) => ({
      value: c.sale.ppm,
      weight: c.weight,
    })),
    ppm = weightedQuantile(values, 0.5)!,
    low = weightedQuantile(values, 0.1)! * subject.area,
    high = weightedQuantile(values, 0.9)! * subject.area;
  const recent = candidates.filter(
    (c) => c.sale.date >= shiftMonths(asOf, -12),
  ).length;
  return {
    available: true as const,
    count: candidates.length,
    effective,
    ppm,
    central: ppm * subject.area,
    low,
    high,
    confidence:
      effective >= 20 &&
      recent >= 15 &&
      (high - low) / (ppm * subject.area) < 0.4
        ? "moderate"
        : "low",
    comparables: candidates.map((c) => ({ ...c, weight: c.weight / total })),
    medianAgeMonths: median(
      candidates.map(
        (c) => (+new Date(asOf) - +new Date(c.sale.date)) / 86400000 / 30.4375,
      ),
    ),
    spread:
      quantile(
        candidates.map((c) => c.sale.ppm),
        0.9,
      )! -
      quantile(
        candidates.map((c) => c.sale.ppm),
        0.1,
      )!,
  };
}
