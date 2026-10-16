import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server";
import { parseFilters } from "@/lib/analytics";
import { compare } from "@/lib/compare";
import { parseArea, parseFilterState } from "@/lib/share";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams,
    a = parseArea(p.get("a") ?? ""),
    b = parseArea(p.get("b") ?? "");
  let filters;
  try {
    if (!a || !b) throw Error("Veldu tvö gild svæði");
    parseFilters(p);
    filters = parseFilterState(p);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const { rows, report } = await getSnapshot();
    return NextResponse.json(
      {
        ...compare(rows, filters, a, b, new Date().toISOString().slice(0, 10)),
        downloadedAt: report.sources.kaupskra.downloadedAt,
        latestSale: report.latestSale,
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
