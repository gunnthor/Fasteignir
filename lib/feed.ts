// Server-only: Atom feed of newly observed eligible sales matching a saved search.
//
// "New" comes from the observation tracker (lib/observations): a row is new on the
// day Fasteign first saw it in the daily HMS file. Baseline rows (firstSeen null),
// rows that were only modified, and identifier corrections of known contracts keep
// their original first-seen date and are never reported again.
import type { Observed } from "./server";
import type { Filters, Sale } from "./types";
import { matches } from "./analytics";
import { atom, escapeXml, type AtomEntry } from "./atom";
import { date, money, num, ppm, strings, year } from "./format";
import {
  areaLabel,
  filterSummary,
  serializeFilters,
  type FilterState,
} from "./share";

export const FEED_LIMIT = 50;
// Fixed tag-URI date: identifiers must never change once published.
const TAG = "tag:fasteign.gunnthor.is,2026-10";

const index = new WeakMap<Sale[], Map<string, Sale>>();
function byKey(rows: Sale[]) {
  let m = index.get(rows);
  if (!m) {
    m = new Map();
    for (const s of rows) m.set(`${s.id}|${s.propertyId}`, s);
    index.set(rows, m);
  }
  return m;
}

export type FeedSale = Sale & { firstSeen: string };

// Newest first by first-observed date, then registration date and id. The period
// filter is ignored: a feed follows new registrations whatever the contract date.
export function feedSales(
  rows: Sale[],
  observed: Observed,
  f: Filters,
  limit = FEED_LIMIT,
) {
  const sales = byKey(rows),
    out: FeedSale[] = [];
  for (const o of observed.recent) {
    if (!o.firstSeen || o.firstSeen < observed.since) continue;
    const s = sales.get(`${o.id}|${o.propertyId}`);
    if (s && matches(s, f)) out.push({ ...s, firstSeen: o.firstSeen });
  }
  out.sort(
    (a, b) =>
      b.firstSeen.localeCompare(a.firstSeen) ||
      (b.registered ?? "").localeCompare(a.registered ?? "") ||
      b.id.localeCompare(a.id) ||
      b.propertyId.localeCompare(a.propertyId),
  );
  return { total: out.length, sales: out.slice(0, limit) };
}

export const entryId = (s: Pick<Sale, "id" | "propertyId">) =>
  `${TAG}:kaupsamningur/${s.id}/${s.propertyId}`;

const TYPE = { apartment: "Fjölbýli", house: "Sérbýli", other: "Annað" };
const stamp = (d: string) => `${d}T00:00:00Z`;

export function feedXml({
  rows,
  observed,
  f,
  state,
  origin,
}: {
  rows: Sale[];
  observed: Observed;
  f: Filters;
  state: FilterState & { q?: string };
  origin: string;
}) {
  const { total, sales } = feedSales(rows, observed, f),
    q = state.q ?? "",
    query = serializeFilters({ ...state, months: "12", from: "", to: "" });
  if (q) query.set("q", q);
  const suffix = query.size ? `?${query}` : "",
    conditions = filterSummary(state, q).join(", "),
    bootstrapOnly = !observed.runs.some((r) => !r.bootstrap);
  const entries: AtomEntry[] = sales.map((s) => {
    const h = escapeXml,
      link = /^\d{7}$/.test(s.propertyId)
        ? `${origin}/eign/${s.propertyId}`
        : `${origin}/?q=${encodeURIComponent(s.address)}`,
      details = [
        TYPE[s.type],
        `${num(s.area)} m²`,
        s.rooms ? `${num(s.rooms)} herb.` : null,
        s.built ? `byggt ${year(s.built)}` : null,
      ].filter(Boolean);
    return {
      id: entryId(s),
      title: `${s.address} · ${money(s.price)}`,
      updated: stamp(s.firstSeen),
      published: stamp(s.firstSeen),
      link,
      categories: [TYPE[s.type], s.municipalityName, s.postcode],
      summary:
        `Kaupsamningur ${date(s.date)}, þinglýstur ${s.registered ? date(s.registered) : "—"}, ` +
        `fyrst séður í kaupskrá ${date(s.firstSeen)}. ${details.join(", ")}, ${s.postcode} ${s.municipalityName}. ` +
        `${money(s.price)} (${ppm(s.ppm)}).`,
      html: [
        `<p><strong>${h(money(s.price))}</strong> · ${h(ppm(s.ppm))}</p>`,
        "<ul>",
        `<li>Dagsetning kaupsamnings: ${h(date(s.date))}</li>`,
        `<li>Þinglýsing: ${h(s.registered ? date(s.registered) : "—")}</li>`,
        `<li>Fyrst séður í kaupskrá HMS: ${h(date(s.firstSeen))}</li>`,
        `<li>${h(details.join(" · "))}</li>`,
        `<li>${h(`${s.postcode} ${s.municipalityName}`)}</li>`,
        "</ul>",
        `<p>${h(strings.source)}. Nafnverð. „Fyrst séður“ er dagurinn sem Fasteign sá færsluna fyrst í daglegri skrá HMS, ekki dagsetning samnings.</p>`,
      ].join(""),
    };
  });
  const lastRun = observed.lastRun.date;
  return {
    total,
    count: entries.length,
    xml: atom({
      id: `${TAG}:leit/${query.toString() || "allt"}`,
      title: `Nýjar færslur · ${areaLabel(state)}${q ? ` · „${q}“` : ""}`,
      subtitle:
        `Nýskráðir kaupsamningar úr Kaupskrá HMS sem nýtast í verðtölfræði: ${conditions}. ` +
        `Allt að ${FEED_LIMIT} nýjustu færslur sem Fasteign sá fyrst frá ${date(observed.since)}. ` +
        "Leiðréttingar á eldri færslum eru ekki birtar sem nýjar." +
        (bootstrapOnly
          ? " Vöktun er nýhafin; nýjar færslur birtast eftir næstu uppfærslu."
          : ""),
      updated: stamp(sales[0]?.firstSeen ?? lastRun),
      self: `${origin}/api/feed${suffix}`,
      alternate: `${origin}/${suffix}`,
      author: "Fasteign",
      rights: "Byggir á upplýsingum frá HMS — Kaupskrá fasteigna",
      entries,
    }),
  };
}
