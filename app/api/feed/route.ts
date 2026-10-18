import { NextRequest, NextResponse } from "next/server";
import { getObserved, getSnapshot } from "@/lib/server";
import { parseFilters } from "@/lib/analytics";
import { feedXml } from "@/lib/feed";
import { parseFilterState } from "@/lib/share";
export const runtime = "nodejs";

// Filters that make sense for a feed; anything else (including the period) is
// rejected rather than silently ignored, so a subscription URL means what it says.
const ALLOWED = new Set([
  "type",
  "municipality",
  "postcode",
  "district",
  "rooms",
  "minArea",
  "maxArea",
  "minBuilt",
  "maxBuilt",
  "minPrice",
  "maxPrice",
  "q",
]);

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  let f, state;
  try {
    for (const key of p.keys())
      if (!ALLOWED.has(key))
        throw Error(`Óþekkt færibreyta: ${key.slice(0, 40)}`);
    if ([...p.values()].some((v) => v.length > 100))
      throw Error("Of löng gildi");
    f = parseFilters(p);
    state = { ...parseFilterState(p), q: f.q };
    // The lenient share-state parser drops what it cannot use; here that is an error.
    for (const key of ALLOWED)
      if (
        key !== "q" &&
        p.get(key) &&
        state[key as keyof typeof state] !== p.get(key)
      )
        throw Error(`Ógilt gildi: ${key}`);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const [{ rows }, observed] = await Promise.all([
      getSnapshot(),
      getObserved(),
    ]);
    const { xml } = feedXml({
      rows,
      observed,
      f,
      state,
      origin: request.nextUrl.origin,
    });
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/atom+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gögn eru ekki tiltæk." },
      { status: 503 },
    );
  }
}
