import { NextRequest, NextResponse } from "next/server";
import { lookupHistory } from "@/lib/history-lookup";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^\d{7}$/.test(id))
    return NextResponse.json(
      { error: "Sláðu inn sjö stafa fastanúmer." },
      { status: 400 },
    );
  try {
    const history = await lookupHistory(id);
    return history
      ? NextResponse.json(history, {
          headers: { "Cache-Control": "public, s-maxage=3600" },
        })
      : NextResponse.json(
          { error: "Engin sölusaga fannst fyrir þetta fastanúmer." },
          { status: 404 },
        );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Sölusaga er ekki tiltæk." },
      { status: 503 },
    );
  }
}
