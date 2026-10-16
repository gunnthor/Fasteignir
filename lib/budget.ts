// Server-only: where have homes sold within a total budget? Historical evidence only;
// none of these sales represent properties available today.
import { median, quantile } from "./data";
import { parseFilters } from "./analytics";
import { select } from "./explore";
import { apiParams, type FilterState } from "./share";
import type { Sale } from "./types";

export const BUDGET_MIN = 10_000_000,
  BUDGET_MAX = 250_000_000,
  BUDGET_STEP = 5_000_000;
const SIZE_BINS: [number, number][] = [
  [0, 50],
  [50, 70],
  [70, 90],
  [90, 110],
  [110, 140],
  [140, 180],
  [180, Infinity],
];

// Same protections as medians: no share under 5 sales, no within-budget
// statistics under 5 sales within budget.
function summarize(sales: Sale[], budget: number) {
  const within = sales.filter((s) => s.price <= budget),
    n = sales.length,
    k = within.length,
    show = k >= 5,
    areas = within.map((s) => s.area),
    rooms = within.map((s) => s.rooms).filter((r): r is number => r !== null);
  return {
    within,
    stats: {
      count: n,
      within: k,
      share: n >= 5 ? (k / n) * 100 : null,
      sparse: n < 10,
      area: show ? median(areas) : null,
      areaLow: show ? quantile(areas, 0.25) : null,
      areaHigh: show ? quantile(areas, 0.75) : null,
      price: show ? median(within.map((s) => s.price)) : null,
      rooms: show && rooms.length >= 5 ? median(rooms) : null,
    },
  };
}

export function budgetView(
  rows: Sale[],
  filters: FilterState,
  budget: number,
  today: string,
) {
  const f = parseFilters(apiParams(filters)),
    { from, to, selected } = select(rows, f, today),
    { within, stats: overall } = summarize(selected, budget);
  const prices = selected.map((s) => s.price).sort((a, b) => a - b),
    atOrBelow = (b: number) => {
      let lo = 0,
        hi = prices.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (prices[mid] <= b) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
  const steps: number[] = [];
  for (let b = BUDGET_MIN; b <= BUDGET_MAX; b += BUDGET_STEP) steps.push(b);
  const level = filters.postcode
      ? null
      : filters.municipality
        ? ("postcode" as const)
        : ("municipality" as const),
    groups = new Map<string, Sale[]>();
  if (level)
    for (const s of selected) {
      const key = s[level],
        g = groups.get(key) ?? [];
      g.push(s);
      groups.set(key, g);
    }
  return {
    budget,
    from,
    to,
    overall,
    sizes:
      within.length >= 5
        ? SIZE_BINS.map(([lo, hi]) => ({
            label: hi === Infinity ? `${lo}+` : `${lo}–${hi}`,
            count: within.filter((s) => s.area >= lo && s.area < hi).length,
          }))
        : null,
    curve:
      prices.length >= 5
        ? steps.map((b) => ({
            budget: b,
            share: (atOrBelow(b) / prices.length) * 100,
          }))
        : null,
    level,
    areas: [...groups]
      .map(([id, sales]) => ({
        id,
        name:
          level === "municipality"
            ? sales[0].municipalityName
            : `${id} ${sales[0].municipalityName}`,
        ...summarize(sales, budget).stats,
      }))
      .sort((a, b) => b.within - a.within || b.count - a.count),
  };
}
