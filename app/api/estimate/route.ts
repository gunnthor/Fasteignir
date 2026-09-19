import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server";
import { estimate } from "@/lib/analytics";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams,
    propertyId = p.get("propertyId") || undefined,
    postcode = p.get("postcode") ?? "",
    type = p.get("type"),
    area = Number(p.get("area")),
    rooms = Number(p.get("rooms")),
    built = Number(p.get("built"));
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
    built > new Date().getUTCFullYear()
  )
    return NextResponse.json(
      { error: "Athugaðu póstnúmer, tegund, stærð, herbergi og byggingarár." },
      { status: 400 },
    );
  try {
    const { rows } = await getSnapshot();
    return NextResponse.json(
      estimate(
        rows,
        {
          propertyId,
          postcode,
          type: type as "apartment" | "house",
          area,
          rooms,
          built,
        },
        new Date().toISOString().slice(0, 10),
      ),
      { headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Gögn eru ekki tiltæk." },
      { status: 503 },
    );
  }
}
