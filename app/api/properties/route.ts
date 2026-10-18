import { NextRequest, NextResponse } from "next/server";
import { getProperties } from "@/lib/server";
import { findProperty, searchProperties, withUnit } from "@/lib/properties";
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const id = request.nextUrl.searchParams.get("id");
  if (id ? !/^\d{7}$/.test(id) : q.length < 2 || q.length > 120)
    return NextResponse.json(
      { error: "Sláðu inn heimilisfang eða sjö stafa fastanúmer." },
      { status: 400 },
    );
  try {
    const rows = await getProperties();
    if (id) {
      const property = findProperty(rows, id);
      return property
        ? NextResponse.json({ property: withUnit(rows, property) })
        : NextResponse.json(
            { error: "Eign fannst ekki í kaupskrá." },
            { status: 404 },
          );
    }
    return NextResponse.json(searchProperties(rows, q), {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Eignaleit er ekki tiltæk. Þú getur skráð upplýsingar handvirkt.",
      },
      { status: 503 },
    );
  }
}
