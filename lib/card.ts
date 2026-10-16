// Server-only: share-card data, metadata and caching for OG images and embeds.
import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { getSnapshot } from "./server";
import { parseFilters, range, stats } from "./analytics";
import { select, monthlyTrend } from "./explore";
import { date, num, money, ppm, percent, strings } from "./format";
import {
  apiParams,
  areaLabel,
  filterSummary,
  param,
  parseView,
  periodLabel,
  serializeFilters,
  serializeView,
  NOMINAL_CAVEAT,
  type ParamSource,
  type View,
} from "./share";

export type Card = Awaited<ReturnType<typeof buildCard>>;
const today = () => new Date().toISOString().slice(0, 10);

// `withTrend: false` skips the monthly series when only text is needed.
export async function buildCard(view: View, withTrend = true) {
  const f = parseFilters(apiParams(view.filters, view.q)),
    { rows, report, version } = await getSnapshot(),
    { from, to, base, selected, prior } = select(rows, f, today()),
    summary = stats(selected, prior),
    trend = withTrend
      ? monthlyTrend(rows, base, f, from, to).map((t) => t.ppm)
      : [],
    known = trend.filter((v): v is number => v !== null);
  const query = serializeFilters(view.filters);
  if (view.q) query.set("q", view.q);
  return {
    area: areaLabel(view.filters),
    filters: filterSummary(view.filters, view.q),
    period: periodLabel(view.filters),
    range: `${date(from)} – ${date(to)}`,
    from,
    to,
    count: summary.count,
    // Same suppression as the application: no prices below 5 sales.
    status: summary.count < 5 ? "suppressed" : summary.sparse ? "sparse" : "ok",
    ppm: summary.ppm === null ? null : ppm(summary.ppm),
    price: summary.price === null ? null : money(summary.price),
    change: summary.change === null ? null : percent(summary.change),
    previousCount: summary.previousCount,
    trend,
    // A sparkline has no axis, so the card states the range it spans.
    trendRange:
      known.length >= 2
        ? `${num(Math.min(...known) / 1000)}–${num(Math.max(...known) / 1000)} þ.kr./m²`
        : null,
    updated: date(report.sources.kaupskra.downloadedAt),
    latestSale: date(report.latestSale),
    href: `/markadur${query.size ? `?${query}` : ""}`,
    version,
    notes: {
      sales: `${num(summary.count)} gildar sölur á tímabilinu`,
      suppressed: strings.suppressed,
      sparse: strings.sparse,
      caveat: NOMINAL_CAVEAT,
      source: strings.source,
    },
  } as const;
}

// Polyline through the non-null points of a monthly series, scaled to a box.
export function sparkPath(values: (number | null)[], w: number, h: number) {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return "";
  const lo = Math.min(...known),
    hi = Math.max(...known),
    step = w / Math.max(values.length - 1, 1);
  let d = "",
    pen = false;
  values.forEach((v, i) => {
    if (v === null) return void (pen = false);
    const y = hi === lo ? h / 2 : h - ((v - lo) / (hi - lo)) * h;
    d += `${pen ? "L" : "M"}${(i * step).toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  });
  return d;
}

// A card is a pure function of (snapshot, filters, resolved dates). URLs carrying the
// current snapshot version and fixed dates are cached as immutable; relative periods
// move daily, so they revalidate hourly.
export async function cacheHeaders(
  view: View,
  source: ParamSource,
  variant = "",
) {
  const { version } = await getSnapshot(),
    f = parseFilters(apiParams(view.filters, view.q)),
    { from, to } = range(f, today()),
    tag = createHash("sha1")
      .update(
        [version, from, to, serializeView(view).toString(), variant].join("|"),
      )
      .digest("base64url")
      .slice(0, 20),
    immutable =
      param(source, "v") === version && view.filters.months === "custom";
  return {
    ETag: `"${tag}"`,
    "Cache-Control": immutable
      ? "public, max-age=86400, s-maxage=31536000, immutable"
      : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  };
}
// If-None-Match may list several tags and CDNs may weaken them (W/"…").
export function notModified(request: Request, headers: { ETag: string }) {
  const sent = (request.headers.get("if-none-match") ?? "")
    .split(",")
    .map((t) => t.trim().replace(/^W\//, ""));
  return sent.includes(headers.ETag) || sent.includes("*")
    ? new Response(null, { status: 304, headers })
    : null;
}

export function cardQuery(view: View, version: string) {
  const p = serializeFilters(view.filters);
  if (view.q) p.set("q", view.q);
  p.set("v", version);
  return p;
}

// Per-view title, description and OG/Twitter card for shared links.
export async function shareMetadata(
  source: ParamSource,
  fallbackTitle?: string,
): Promise<Metadata> {
  const view = parseView(source),
    custom = serializeFilters(view.filters).size > 0 || !!view.q;
  try {
    const card = await buildCard(view, false),
      title = custom ? `${card.area} · ${card.filters[0]}` : fallbackTitle,
      description =
        card.status === "suppressed"
          ? `${card.area}: ${card.notes.sales}, ${card.range}. ${card.notes.suppressed}`
          : `${card.area}: miðgildi söluverðs á m² ${card.ppm} · ${card.notes.sales}, ${card.range}. Þinglýst kaupverð úr Kaupskrá HMS.`;
    const image = {
      url: `/api/card?${cardQuery(view, card.version)}`,
      width: 1200,
      height: 630,
      alt: `${card.area}, ${card.range}: ${card.ppm ?? "of fáar sölur"}`,
    };
    return {
      ...(title ? { title } : {}),
      description,
      openGraph: { title, description, images: [image], type: "website" },
      twitter: { card: "summary_large_image", title, description },
    };
  } catch {
    return fallbackTitle ? { title: fallbackTitle } : {};
  }
}
