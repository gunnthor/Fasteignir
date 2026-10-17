// Server-only: how prices are distributed within the filtered set of sales.
import { select } from "./explore";
import { distribution, heterogeneity } from "./distribution";
import type { Filters, Sale } from "./types";

export type DistributionMetric = "price" | "ppm";
// Narrowest bins allowed: 1 m.kr. for total price, 10 þ.kr. per m².
const MIN_STEP: Record<DistributionMetric, number> = {
  price: 1_000_000,
  ppm: 10_000,
};

export function priceDistribution(
  rows: Sale[],
  f: Filters,
  today: string,
  metric: DistributionMetric,
  value: number | null,
) {
  const { from, to, selected } = select(rows, f, today),
    values = selected.map((s) => (metric === "price" ? s.price : s.ppm)),
    days = Math.round((+new Date(to) - +new Date(from)) / 86400000) + 1;
  return {
    metric,
    from,
    to,
    ...distribution(values, { minStep: MIN_STEP[metric], value }),
    mix: {
      apartment: selected.filter((s) => s.type === "apartment").length,
      house: selected.filter((s) => s.type === "house").length,
    },
    warnings: heterogeneity(selected, {
      metric,
      days,
      local: Boolean(f.postcode || f.district),
    }),
  };
}
export type PriceDistribution = ReturnType<typeof priceDistribution>;
