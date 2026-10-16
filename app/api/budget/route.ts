import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server";
import { parseFilters } from "@/lib/analytics";
import { budgetView } from "@/lib/budget";
import { parseBudget, parseFilterState } from "@/lib/share";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams,
    budget = parseBudget(p.get("budget") ?? "");
  let filters;
  try {
    if (budget === null) throw Error("Ógild fjárhæð");
    parseFilters(p);
    filters = { ...parseFilterState(p), district: "" };
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const { rows, report } = await getSnapshot();
    return NextResponse.json(
      {
        ...budgetView(
          rows,
          filters,
          budget,
          new Date().toISOString().slice(0, 10),
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
