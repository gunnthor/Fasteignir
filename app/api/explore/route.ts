import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server";
import { parseFilters } from "@/lib/analytics";
import { explore } from "@/lib/explore";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let f;
  try {
    f = parseFilters(request.nextUrl.searchParams);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const { rows, report, version } = await getSnapshot(),
      today = new Date().toISOString().slice(0, 10);
    const body = {
      ...explore(
        rows,
        f,
        today,
        request.nextUrl.searchParams.get("points") === "1",
      ),
      downloadedAt: report.sources.kaupskra.downloadedAt,
      latestSale: report.latestSale,
      latestRegistration: report.latestRegistration,
      version,
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
