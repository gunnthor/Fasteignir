// Registration delay: days from contract signature (UTGDAG) to official
// registration (THINGLYSTDAGS). Not time on market, which HMS data cannot show.
import { quantile } from "./data";
import { SAMPLE } from "./distribution";
import { shiftMonths } from "./analytics";
import type { Sale } from "./types";

export const lagDays = (s: Pick<Sale, "date" | "registered">) =>
  s.registered
    ? Math.round((+new Date(s.registered) - +new Date(s.date)) / 86400000)
    : null;

const addDays = (d: string, n: number) =>
  new Date(+new Date(d) + n * 86400000).toISOString().slice(0, 10);

// Fixed delay buckets in days; adjacent buckets merge until none holds 1–4 sales.
const BUCKETS: [number, number][] = [
  [0, 3],
  [4, 7],
  [8, 14],
  [15, 30],
  [31, 60],
  [61, 90],
  [91, 180],
  [181, Infinity],
];
export function lagHistogram(lags: number[]) {
  if (lags.length < SAMPLE.distribution) return null;
  const bins = BUCKETS.map(([from, to]) => ({
    from,
    to,
    count: lags.filter((d) => d >= from && d <= to).length,
  }));
  for (let i = 0; i < bins.length;) {
    const b = bins[i];
    if (b.count > 0 && b.count < SAMPLE.cell && bins.length > 1) {
      // Merge toward the longer-delay neighbour, or backwards at the end.
      const j = i < bins.length - 1 ? i + 1 : i - 1,
        [lo, hi] = j > i ? [b, bins[j]] : [bins[j], b];
      bins.splice(Math.min(i, j), 2, {
        from: lo.from,
        to: hi.to,
        count: lo.count + hi.count,
      });
      i = Math.max(0, Math.min(i, j) - 1);
    } else i++;
  }
  return bins.map((b) => ({
    ...b,
    to: Number.isFinite(b.to) ? b.to : null,
    share: (b.count / lags.length) * 100,
  }));
}

export function lagSummary(lags: number[]) {
  const n = lags.length;
  return {
    count: n,
    sparse: n < SAMPLE.warn,
    median: n >= SAMPLE.median ? quantile(lags, 0.5) : null,
    p25: n >= SAMPLE.distribution ? quantile(lags, 0.25) : null,
    p75: n >= SAMPLE.distribution ? quantile(lags, 0.75) : null,
    p90: n >= SAMPLE.distribution ? quantile(lags, 0.9) : null,
    within30:
      n >= SAMPLE.distribution
        ? (lags.filter((d) => d <= 30).length / n) * 100
        : null,
  };
}

// Share of contracts registered within d days, from contracts signed one to two
// years before the data date: old enough that nearly all have been registered.
export function completenessCurve(rows: Sale[], asOf: string) {
  const to = addDays(asOf, -365),
    from = addDays(asOf, -730),
    lags = rows
      .filter((s) => s.date > from && s.date <= to)
      .map(lagDays)
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b);
  const share = (days: number) => {
    let lo = 0,
      hi = lags.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lags[mid] <= days) lo = mid + 1;
      else hi = mid;
    }
    return lags.length ? (lo / lags.length) * 100 : null;
  };
  return { from, to, count: lags.length, share };
}

// Contract months that were probably not fully registered at the data date.
// For each day of the month, the historical share of contracts registered
// within as many days as have since passed; averaged over the month's days
// (assuming contracts spread evenly through the month). Months below 95 % are
// flagged. This describes typical delay; it is not an estimate of how many
// unregistered sales exist, and none is shown.
export function incompleteMonths(rows: Sale[], asOf: string, months = 4) {
  const curve = completenessCurve(rows, asOf);
  if (curve.count < SAMPLE.distribution) return [];
  const out: { month: string; ended: boolean; share: number }[] = [];
  let month = asOf.slice(0, 7) + "-01";
  for (let i = 0; i < months; i++) {
    const end = addDays(shiftMonths(month, 1), -1),
      last = end < asOf ? end : asOf;
    let sum = 0,
      n = 0;
    for (let d = month; d <= last; d = addDays(d, 1)) {
      sum += curve.share(
        Math.round((+new Date(asOf) - +new Date(d)) / 86400000),
      )!;
      n++;
    }
    const share = n ? sum / n : 0;
    if (share < 95)
      out.push({ month: month.slice(0, 7), ended: end < asOf, share });
    month = shiftMonths(month, -1);
  }
  return out.reverse();
}

// Computed once per snapshot for the market views.
const incompleteCache = new WeakMap<
  Sale[],
  ReturnType<typeof incompleteMonths>
>();
export function snapshotIncompleteMonths(rows: Sale[], asOf: string) {
  let v = incompleteCache.get(rows);
  if (!v) incompleteCache.set(rows, (v = incompleteMonths(rows, asOf)));
  return v;
}

export function registrationView(
  rows: Sale[],
  { type, municipality }: { type: string; municipality: string },
  asOf: string,
) {
  const scoped = rows.filter(
      (s) =>
        s.registered &&
        (type === "all" || s.type === type) &&
        (!municipality || s.municipality === municipality),
    ),
    windowFrom = addDays(asOf, -365);
  // By registration date: every contract registered in the window counts,
  // however long it waited, so recent periods are not biased toward short delays.
  const recent = scoped.filter((s) => s.registered! > windowFrom);
  const lags = recent.map((s) => lagDays(s)!);
  const trend: {
    month: string;
    count: number;
    median: number | null;
    p90: number | null;
  }[] = [];
  const byMonth = new Map<string, number[]>();
  const trendFrom = shiftMonths(asOf.slice(0, 7) + "-01", -35);
  for (const s of scoped) {
    if (s.registered! < trendFrom) continue;
    const m = s.registered!.slice(0, 7),
      a = byMonth.get(m) ?? [];
    a.push(lagDays(s)!);
    byMonth.set(m, a);
  }
  for (
    let m = trendFrom;
    m.slice(0, 7) <= asOf.slice(0, 7);
    m = shiftMonths(m, 1)
  ) {
    const a = byMonth.get(m.slice(0, 7)) ?? [];
    trend.push({
      month: m.slice(0, 7),
      count: a.length,
      median: a.length >= SAMPLE.median ? quantile(a, 0.5) : null,
      p90: a.length >= SAMPLE.distribution ? quantile(a, 0.9) : null,
    });
  }
  const group = (key: (s: Sale) => string, label: (s: Sale) => string) => {
    const groups = new Map<string, { label: string; lags: number[] }>();
    for (const s of recent) {
      const k = key(s),
        g = groups.get(k) ?? { label: label(s), lags: [] };
      g.lags.push(lagDays(s)!);
      groups.set(k, g);
    }
    return [...groups]
      .map(([id, g]) => ({ id, name: g.label, ...lagSummary(g.lags) }))
      .sort((a, b) => b.count - a.count);
  };
  const curve = completenessCurve(scoped, asOf);
  return {
    asOf,
    windowFrom,
    summary: lagSummary(lags),
    histogram: lagHistogram(lags),
    trend,
    byType:
      type === "all"
        ? group(
            (s) => s.type,
            (s) => s.type,
          )
        : [],
    byMunicipality: municipality
      ? []
      : group(
          (s) => s.municipality,
          (s) => s.municipalityName,
        ),
    completeness: {
      from: curve.from,
      to: curve.to,
      count: curve.count,
      within: [7, 14, 30, 60, 90, 180].map((d) => ({
        days: d,
        share: curve.count >= SAMPLE.distribution ? curve.share(d) : null,
      })),
    },
    incomplete: incompleteMonths(scoped, asOf),
  };
}
export type RegistrationView = ReturnType<typeof registrationView>;
