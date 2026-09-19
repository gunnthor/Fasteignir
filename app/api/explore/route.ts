import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server";
import {
  parseFilters,
  range,
  matches,
  stats,
  groupStats,
  shiftMonths,
} from "@/lib/analytics";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let f;
  try {
    f = parseFilters(request.nextUrl.searchParams);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const { rows, report } = await getSnapshot(),
      today = new Date().toISOString().slice(0, 10),
      { from, to } = range(f, today);
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
    const selected = current.filter(
        (s) => !f.district || s.district === f.district,
      ),
      prior = previous.filter((s) => !f.district || s.district === f.district);
    const trend = [];
    let month =
      (from === "1900-01-01"
        ? rows.reduce((a, s) => (s.date < a ? s.date : a), to)
        : from
      ).slice(0, 7) + "-01";
    while (month <= to && trend.length < 1000) {
      const next = shiftMonths(month, 1),
        rollingFrom = shiftMonths(month, -2);
      trend.push({
        month: month.slice(0, 7),
        ...stats(
          base.filter(
            (s) =>
              (!f.district || s.district === f.district) &&
              s.date >= rollingFrom &&
              s.date < next &&
              s.date <= to,
          ),
        ),
        volume: base.filter(
          (s) =>
            (!f.district || s.district === f.district) &&
            s.date >= month &&
            s.date < next &&
            s.date <= to,
        ).length,
      });
      month = next;
    }
    const sorted = [...selected].sort(
        (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
      ),
      located = sorted.filter((s) => s.coordinates),
      limit = 1500;
    const body = {
      summary: stats(selected, prior),
      areas: groupStats(current, previous, "district"),
      postcodes: groupStats(current, previous, "postcode"),
      municipalities: groupStats(current, previous, "municipality"),
      trend,
      recent: sorted.slice(0, 40),
      points: {
        type: "FeatureCollection",
        features: (request.nextUrl.searchParams.get("points") === "1"
          ? located.slice(0, limit)
          : []
        ).map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: s.coordinates },
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
          },
        })),
      },
      pointCount: located.length,
      pointLimit: limit,
      from,
      to,
      downloadedAt: report.sources.kaupskra.downloadedAt,
      latestSale: report.latestSale,
      latestRegistration: report.latestRegistration,
      matchedCount: located.length,
      total: selected.length,
    };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          "Gögn eru ekki tiltæk. Keyra þarf gagnainnflutning áður en vefurinn er birtur.",
      },
      { status: 503 },
    );
  }
}
