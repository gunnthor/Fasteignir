import type { NextRequest } from "next/server";
import { buildCard, cacheHeaders, notModified, sparkPath } from "@/lib/card";
import { num } from "@/lib/format";
import { param, parseView } from "@/lib/share";
export const runtime = "nodejs";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const light = `--bg:#fff;--text:#223a33;--muted:#53665d;--line:#e5eae5;--accent:#2e715c;--soft:#edf3ee;color-scheme:light`,
  dark = `--bg:#1c2b25;--text:#e7eee9;--muted:#a0b1a7;--line:#35483f;--accent:#8bccae;--soft:#293e33;color-scheme:dark`;

// A lightweight, script-free statistic card for <iframe> embedding.
export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams,
    view = parseView(source),
    theme = param(source, "theme");
  let headers, card;
  try {
    headers = await cacheHeaders(view, source, theme);
    const cached = notModified(request, headers);
    if (cached) return cached;
    card = await buildCard(view);
  } catch (e) {
    console.error(e);
    return new Response("Ógild sýn", { status: 400 });
  }
  const spark = sparkPath(card.trend, 300, 70),
    origin = request.nextUrl.origin,
    stat = (label: string, value: string) =>
      `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  const html = `<!doctype html>
<html lang="is"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(`${card.area} · ${card.range} · Fasteign`)}</title>
<style>
:root{${theme === "dark" ? dark : light}}
${theme ? "" : `@media (prefers-color-scheme:dark){:root{${dark}}}`}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{padding:18px 20px;display:flex;flex-direction:column;gap:12px;min-height:100vh}
header{display:flex;justify-content:space-between;gap:12px;font-size:12px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
h1{margin:0;font-size:22px;line-height:1.2}
.meta{margin:2px 0 0;color:var(--muted);font-size:13px}
.hero{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.hero span,.stats span{display:block;font-size:13px;color:var(--muted)}
.hero strong{display:block;font-size:30px;line-height:1.15;color:var(--accent);font-variant-numeric:tabular-nums}
figure{margin:0;flex:1 1 160px;max-width:300px}
figure svg{display:block;width:100%;height:64px}
figcaption{font-size:12px;color:var(--muted);text-align:right}
.stats{display:flex;gap:24px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:10px}
.stats strong{font-size:17px;font-variant-numeric:tabular-nums}
.notice{background:var(--soft);border-radius:8px;padding:8px 10px;font-size:13px;margin:0}
footer{margin-top:auto;font-size:12px;color:var(--muted)}
footer p{margin:0}
a{color:var(--accent);font-weight:600}
</style></head><body><main>
<header><span>Fasteign · Þinglýst kaupverð</span><span>${esc(card.period)}</span></header>
<div><h1>${esc(card.area)}</h1>
<p class="meta">${esc(card.filters.join(" · "))} · ${esc(card.range)}</p></div>
<div class="hero"><div><span>Miðgildi söluverðs á m²</span>
<strong>${card.ppm ? esc(card.ppm) : "—"}</strong></div>
${spark ? `<figure><svg viewBox="-3 -3 306 76" preserveAspectRatio="none" role="img" aria-label="3 mánaða hlaupandi miðgildi á m², ${esc(card.trendRange ?? "")}"><path d="${spark}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg><figcaption>3 mán. miðgildi · ${esc(card.trendRange ?? "")}</figcaption></figure>` : ""}
</div>
${card.status === "suppressed" ? `<p class="notice">${esc(card.notes.suppressed)}</p>` : card.status === "sparse" ? `<p class="notice">${esc(card.notes.sparse)}</p>` : ""}
<div class="stats">${stat("Gildar sölur", num(card.count))}${card.price ? stat("Miðgildi kaupverðs", card.price) : ""}${card.change ? stat("Breyting frá fyrra tímabili", card.change) : ""}</div>
<footer><p>${esc(card.notes.caveat)}</p>
<p>${esc(card.notes.source)} · Gögn sótt ${esc(card.updated)}, nýjasti samningur ${esc(card.latestSale)} · <a href="${esc(origin + card.href)}" target="_blank" rel="noopener">Skoða á Fasteign →</a></p></footer>
</main></body></html>`;
  return new Response(html, {
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}
