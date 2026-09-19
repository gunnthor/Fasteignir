import type { AreaStats } from "@/lib/types";
import { money, ppm, num, percent, numberIS } from "@/lib/format";
export type Metric = "ppm" | "price" | "count" | "change" | "ratio";
export const metricLabels: Record<Metric, string> = {
  ppm: "Söluverð á m²",
  price: "Miðgildi söluverðs",
  count: "Fjöldi kaupsamninga",
  change: "Verðbreyting",
  ratio: "Kaupverð / fasteignamat",
};
export const palette = ["#c7ded5", "#9dc7b4", "#6baa92", "#3d8875", "#1b6355"];
export function metricValue(a: AreaStats, m: Metric) {
  return a[m];
}
export function metricFormat(n: number | null, m: Metric) {
  return m === "ppm"
    ? ppm(n)
    : m === "price"
      ? money(n)
      : m === "change"
        ? percent(n)
        : m === "ratio"
          ? n === null
            ? "—"
            : `${numberIS(n, 2)}×`
          : num(n);
}
export function breaks(areas: AreaStats[], metric: Metric) {
  const a = areas
    .map((s) => metricValue(s, metric))
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map(
    (q) => a[Math.floor((a.length - 1) * q)] ?? 0,
  );
}
