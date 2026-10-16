// Server-only: side-by-side statistics for two areas under the same filters.
import { quantile } from "./data";
import { parseFilters, stats } from "./analytics";
import { select, monthlyTrend } from "./explore";
import { districtName } from "./format";
import { MUNICIPALITIES } from "./municipalities";
import { apiParams, scopeTo, type AreaRef, type FilterState } from "./share";
import type { Sale } from "./types";

export type AreaOption = AreaRef & { label: string; count: number };
let options: { rows: Sale[]; list: AreaOption[] } | undefined;
// Every postcode, Reykjavík district and municipality with eligible sales.
export function areaOptions(rows: Sale[]) {
  if (options?.rows === rows) return options.list;
  const counts = new Map<string, AreaOption>();
  const add = (kind: AreaRef["kind"], id: string | null, label: string) => {
    if (!id) return;
    const key = `${kind}:${id}`,
      o = counts.get(key) ?? { kind, id, label, count: 0 };
    o.count++;
    counts.set(key, o);
  };
  for (const s of rows) {
    if (!s.usable || !s.capital) continue;
    add("postcode", s.postcode, `${s.postcode} ${s.municipalityName}`);
    add("district", s.district, districtName(s.district ?? ""));
    add("municipality", s.municipality, s.municipalityName);
  }
  const list = [...counts.values()]
    .filter((o) => o.count >= 5)
    .sort((a, b) => a.id.localeCompare(b.id, "is"));
  options = { rows, list };
  return list;
}
export function areaName(rows: Sale[], a: AreaRef) {
  return (
    areaOptions(rows).find((o) => o.kind === a.kind && o.id === a.id)?.label ??
    (a.kind === "district"
      ? districtName(a.id)
      : a.kind === "municipality"
        ? MUNICIPALITIES[a.id]
        : `Póstnúmer ${a.id}`)
  );
}

function side(rows: Sale[], filters: FilterState, a: AreaRef, today: string) {
  const f = parseFilters(apiParams(scopeTo(filters, a))),
    { from, to, base, selected, prior } = select(rows, f, today),
    summary = stats(selected, prior),
    show = selected.length >= 5,
    areas = selected.map((s) => s.area);
  return {
    area: a,
    name: areaName(rows, a),
    summary,
    // Composition context: a price gap often reflects what sold, not what it costs.
    areaLow: show ? quantile(areas, 0.25) : null,
    areaHigh: show ? quantile(areas, 0.75) : null,
    mix: show
      ? {
          apartment: selected.filter((s) => s.type === "apartment").length,
          house: selected.filter((s) => s.type === "house").length,
        }
      : null,
    sales: selected,
    trend: monthlyTrend(rows, base, f, from, to),
    from,
    to,
  };
}

// Shared price-per-m² bins across both sides, rounded to readable 50/100 þ.kr. steps.
function distribution(a: Sale[], b: Sale[]) {
  const pooled = [...a, ...b].map((s) => s.ppm),
    lo = quantile(pooled, 0.03)!,
    hi = quantile(pooled, 0.97)!,
    raw = (hi - lo) / 8,
    step = raw > 75000 ? 100000 : raw > 30000 ? 50000 : 25000,
    start = Math.floor(lo / step) * step,
    edges: number[] = [];
  for (let e = start; e <= hi + step && edges.length < 16; e += step)
    edges.push(e);
  const k = (n: number) => `${Math.round(n / 1000)}`;
  return edges.slice(0, -1).map((low, i) => {
    const first = i === 0,
      last = i === edges.length - 2,
      high = edges[i + 1],
      inBin = (s: Sale) => (first || s.ppm >= low) && (last || s.ppm < high);
    const ca = a.filter(inBin).length,
      cb = b.filter(inBin).length;
    return {
      label: first
        ? `< ${k(high)}`
        : last
          ? `${k(low)}+`
          : `${k(low)}–${k(high)}`,
      a: (ca / a.length) * 100,
      b: (cb / b.length) * 100,
      aCount: ca,
      bCount: cb,
    };
  });
}

export function compare(
  rows: Sale[],
  filters: FilterState,
  a: AreaRef,
  b: AreaRef,
  today: string,
) {
  const A = side(rows, filters, a, today),
    B = side(rows, filters, b, today),
    comparable = A.sales.length >= 5 && B.sales.length >= 5;
  const summary = (x: typeof A) => ({
    area: x.area,
    name: x.name,
    summary: x.summary,
    areaLow: x.areaLow,
    areaHigh: x.areaHigh,
    mix: x.mix,
  });
  return {
    a: summary(A),
    b: summary(B),
    comparable,
    difference:
      comparable && A.summary.ppm && B.summary.ppm
        ? (A.summary.ppm / B.summary.ppm - 1) * 100
        : null,
    areaDifference:
      comparable && A.summary.area && B.summary.area
        ? (A.summary.area / B.summary.area - 1) * 100
        : null,
    distribution: comparable ? distribution(A.sales, B.sales) : null,
    trend: A.trend.map((t, i) => ({
      month: t.month,
      a: t.ppm,
      b: B.trend[i]?.ppm ?? null,
      aCount: t.count,
      bCount: B.trend[i]?.count ?? 0,
    })),
    from: A.from,
    to: A.to,
  };
}
