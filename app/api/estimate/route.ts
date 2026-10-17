import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server";
import {
  estimate,
  sensitivity,
  LOOKBACKS,
  DEFAULT_LOOKBACK,
} from "@/lib/analytics";
import backtest from "@/data/evaluation/comparables.json";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams,
    propertyId = p.get("propertyId") || undefined,
    postcode = p.get("postcode") ?? "",
    type = p.get("type"),
    area = Number(p.get("area")),
    rooms = Number(p.get("rooms")),
    built = Number(p.get("built")),
    lookback = p.get("lookback") ? Number(p.get("lookback")) : DEFAULT_LOOKBACK;
  if (
    (propertyId !== undefined && !/^\d{7}$/.test(propertyId)) ||
    !/^\d{3}$/.test(postcode) ||
    !["apartment", "house"].includes(type ?? "") ||
    !Number.isFinite(area) ||
    area < 10 ||
    area > 1000 ||
    !Number.isInteger(rooms) ||
    rooms < 1 ||
    rooms > 20 ||
    !Number.isInteger(built) ||
    built < 1000 ||
    built > new Date().getUTCFullYear() ||
    !(LOOKBACKS as readonly number[]).includes(lookback)
  )
    return NextResponse.json(
      { error: "Athugaðu póstnúmer, tegund, stærð, herbergi og byggingarár." },
      { status: 400 },
    );
  try {
    const { rows } = await getSnapshot(),
      asOf = new Date().toISOString().slice(0, 10),
      subject = {
        propertyId,
        postcode,
        type: type as "apartment" | "house",
        area,
        rooms,
        built,
      };
    const evidence =
      backtest.byLookback[String(lookback) as keyof typeof backtest.byLookback];
    return NextResponse.json(
      {
        ...estimate(rows, subject, asOf, { lookback }),
        ...(p.get("sensitivity") === "1"
          ? { scenarios: sensitivity(rows, subject, asOf) }
          : {}),
        backtest: {
          quarters: backtest.quarters,
          tested: evidence.tested,
          medianAbsolutePercentageError: evidence.medianAbsolutePercentageError,
          within10Percent: evidence.within10Percent,
          bandCoverage: evidence.bandCoverage,
          availability: evidence.availability,
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Gögn eru ekki tiltæk." },
      { status: 503 },
    );
  }
}
