import { range, matches, stats, groupStats, shiftMonths } from "./analytics";
import type { Filters, Sale } from "./types";

// The selected period and an equally long period ending the day before it.
export function select(rows: Sale[], f: Filters, today: string) {
  const { from, to } = range(f, today);
  const days = Math.round((+new Date(to) - +new Date(from)) / 86400000) + 1,
    previousTo = new Date(+new Date(from) - 86400000)
      .toISOString()
      .slice(0, 10),
    previousFrom = new Date(+new Date(from) - days * 86400000)
      .toISOString()
      .slice(0, 10);
  const base = rows.filter((s) => matches(s, f, true)),
    current = base.filter((s) => s.date >= from && s.date <= to),
    previous =
      f.months === 0 && !f.from
        ? []
        : base.filter((s) => s.date >= previousFrom && s.date <= previousTo);
  const inDistrict = (s: Sale) => !f.district || s.district === f.district;
  return {
    from,
    to,
    base,
    current,
    previous,
    selected: current.filter(inDistrict),
    prior: previous.filter(inDistrict),
  };
}

// Three-month rolling statistics ending in each month, plus monthly volume.
export function monthlyTrend(
  rows: Sale[],
  base: Sale[],
  f: Filters,
  from: string,
  to: string,
) {
  const trend = [];
  let month =
    (from === "1900-01-01"
      ? rows.reduce((a, s) => (s.date < a ? s.date : a), to)
      : from
    ).slice(0, 7) + "-01";
  const scoped = base.filter((s) => !f.district || s.district === f.district);
  while (month <= to && trend.length < 1000) {
    const next = shiftMonths(month, 1),
      rollingFrom = shiftMonths(month, -2);
    trend.push({
      month: month.slice(0, 7),
      ...stats(
        scoped.filter(
          (s) => s.date >= rollingFrom && s.date < next && s.date <= to,
        ),
      ),
      volume: scoped.filter(
        (s) => s.date >= month && s.date < next && s.date <= to,
      ).length,
    });
    month = next;
  }
  return trend;
}

export function explore(
  rows: Sale[],
  f: Filters,
  today: string,
  includePoints: boolean,
) {
  const { from, to, base, current, previous, selected, prior } = select(
    rows,
    f,
    today,
  );
  const sorted = [...selected].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    ),
    located = sorted.filter((s) => s.coordinates),
    limit = 1500;
  return {
    summary: stats(selected, prior),
    areas: groupStats(current, previous, "district"),
    postcodes: groupStats(current, previous, "postcode"),
    municipalities: groupStats(current, previous, "municipality"),
    trend: monthlyTrend(rows, base, f, from, to),
    recent: sorted.slice(0, 40),
    points: {
      type: "FeatureCollection" as const,
      features: (includePoints ? located.slice(0, limit) : []).map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: s.coordinates! },
        properties: {
          id: s.id,
          address: s.address,
          date: s.date,
          price: s.price,
          ppm: s.ppm,
          area: s.area,
          rooms: s.rooms,
          built: s.built,
          type: s.type,
          valuation: s.valuation,
          quality: s.coordinateQuality,
          propertyId: s.propertyId,
          unitCode: s.unitCode ?? null,
          pointType: s.pointType ?? null,
          accuracy: s.accuracy ?? null,
        },
      })),
    },
    pointCount: located.length,
    pointLimit: limit,
    from,
    to,
    matchedCount: located.length,
    total: selected.length,
  };
}
