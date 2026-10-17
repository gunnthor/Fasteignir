// Shared sample-size rules and distribution statistics. Isomorphic and pure.
//
// Quantiles use lib/data `quantile`: linear interpolation between order
// statistics (Hyndman & Fan type 7, the R/NumPy default). Percentile rank uses
// the mid-rank definition: share strictly below plus half the share equal.
import { quantile } from "./data";
import { SAMPLE } from "./sample";
export { SAMPLE };

export type Bin = {
  // null marks an open tail ("under" / "and above").
  from: number | null;
  to: number | null;
  count: number;
  share: number;
};

export type Position = {
  value: number;
  // Mid-rank percentile, 0–100.
  percentile: number;
  band: "low" | "typical" | "high";
};

const NICE = [1, 2, 2.5, 5];
function niceSteps(min: number, max: number) {
  const steps: number[] = [];
  for (let p = Math.floor(Math.log10(min)) - 1; steps.length < 40; p++)
    for (const m of NICE) {
      const s = m * 10 ** p;
      if (s >= min && s <= max) steps.push(s);
      if (s > max) return steps;
    }
  return steps;
}

// Equal-width bins between two open tails. Tails start at grid edges chosen so
// each holds at least SAMPLE.cell values; the bin width grows until no interior
// bin holds 1..cell-1 values, so a histogram never singles out a handful of sales.
export function histogram(
  values: number[],
  { minStep, targetBins = 12 }: { minStep: number; targetBins?: number },
): Bin[] | null {
  const n = values.length,
    k = SAMPLE.cell;
  if (n < SAMPLE.distribution) return null;
  const v = [...values].sort((a, b) => a - b),
    // Number of sorted values below x.
    below = (x: number) => {
      let lo = 0,
        hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (v[mid] < x) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    spread = Math.max(quantile(v, 0.95)! - quantile(v, 0.05)!, minStep);
  // Every safe layout (open-tail cut × nice width) is scored by the share of
  // sales in the equal-width interior times its resolution (up to 12 bins).
  let best: { score: number; bins: Bin[] } | null = null;
  for (const tail of [0.02, 0.05, 0.1, 0.15, 0.25])
    for (const step of niceSteps(minStep, spread * 4)) {
      if (spread / step > targetBins * 1.5) continue;
      const lo = Math.max(v[k - 1], quantile(v, tail)!),
        hi = Math.min(v[n - k], quantile(v, 1 - tail)!);
      // Strictly above lo / below hi keeps ≥ k values in each tail.
      const lower = (Math.floor(lo / step) + 1) * step,
        upper = (Math.ceil(hi / step) - 1) * step;
      if (upper - lower < step * 2) continue;
      const edges: number[] = [];
      for (let e = lower; e <= upper + step / 2; e += step)
        edges.push(Math.round(e / step) * step);
      const cum = edges.map(below),
        counts = [
          cum[0],
          ...cum.slice(1).map((c, i) => c - cum[i]),
          n - cum.at(-1)!,
        ],
        interior = counts.slice(1, -1);
      if (interior.some((c) => c > 0 && c < k)) continue;
      const score =
        ((n - counts[0] - counts.at(-1)!) / n) *
        Math.min(interior.length, targetBins);
      if (!best || score > best.score)
        best = {
          score,
          bins: counts.map((count, i) => ({
            from: i === 0 ? null : edges[i - 1],
            to: i === edges.length ? null : edges[i],
            count,
            share: (count / n) * 100,
          })),
        };
    }
  return best?.bins ?? null;
}

export function percentileRank(values: number[], value: number) {
  if (!values.length) return null;
  let below = 0,
    equal = 0;
  for (const x of values)
    if (x < value) below++;
    else if (x === value) equal++;
  return ((below + equal / 2) / values.length) * 100;
}

export function quartiles(values: number[]) {
  if (values.length < SAMPLE.distribution) return null;
  return {
    p25: quantile(values, 0.25)!,
    p50: quantile(values, 0.5)!,
    p75: quantile(values, 0.75)!,
  };
}

export function position(values: number[], value: number): Position | null {
  const q = quartiles(values);
  if (!q || !Number.isFinite(value) || value <= 0) return null;
  return {
    value,
    percentile: percentileRank(values, value)!,
    band: value < q.p25 ? "low" : value > q.p75 ? "high" : "typical",
  };
}

export type Warning =
  "mixed_types" | "size_spread" | "long_period" | "broad_area";

// Reasons a distribution can mislead: mixed property types, very different
// sizes (for total price), multi-year nominal periods, region-wide groups.
export function heterogeneity(
  sales: { type: string; area: number }[],
  {
    metric,
    days,
    local,
  }: { metric: "price" | "ppm"; days: number; local: boolean },
): Warning[] {
  const out: Warning[] = [];
  if (sales.length < SAMPLE.median) return out;
  const houses = sales.filter((s) => s.type === "house").length / sales.length;
  if (houses >= 0.1 && houses <= 0.9) out.push("mixed_types");
  const areas = sales.map((s) => s.area),
    ratio = quantile(areas, 0.9)! / quantile(areas, 0.1)!;
  if (ratio > (metric === "price" ? 2 : 3)) out.push("size_spread");
  if (days > 3 * 366) out.push("long_period");
  if (!local) out.push("broad_area");
  return out;
}

export function distribution(
  values: number[],
  { minStep, value }: { minStep: number; value?: number | null },
) {
  const n = values.length;
  return {
    count: n,
    suppressed: n < SAMPLE.median,
    sparse: n < SAMPLE.warn,
    detailed: n >= SAMPLE.distribution,
    median: n >= SAMPLE.median ? quantile(values, 0.5) : null,
    quartiles: quartiles(values),
    bins: histogram(values, { minStep }),
    position: value ? position(values, value) : null,
  };
}
