import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server";
import { parseFilters } from "@/lib/analytics";
import { priceDistribution } from "@/lib/price-distribution";
import { parseDistributionValue } from "@/lib/share";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams,
    metric = p.get("metric") ?? "price";
  let f, value;
  try {
    if (metric !== "price" && metric !== "ppm") throw Error("Ógild mælistærð");
    f = parseFilters(p);
    value = p.get("value")
      ? parseDistributionValue(p.get("value")!, metric)
      : null;
    if (value === undefined) throw Error("Ógilt verð til samanburðar");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const { rows, report } = await getSnapshot();
    return NextResponse.json(
      {
        ...priceDistribution(
          rows,
          f,
          new Date().toISOString().slice(0, 10),
          metric,
          value,
        ),
        downloadedAt: report.sources.kaupskra.downloadedAt,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
        },
      },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gögn eru ekki tiltæk." },
      { status: 503 },
    );
  }
}
