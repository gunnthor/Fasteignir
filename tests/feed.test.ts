import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeXml } from "../lib/atom";
import { FEED_LIMIT, entryId, feedSales, feedXml } from "../lib/feed";
import { parseFilters } from "../lib/analytics";
import { parseFilterState } from "../lib/share";
import { observed, sale, seen } from "./fixtures/sales";

const filters = (q: string) => {
  const p = new URLSearchParams(q),
    f = parseFilters(p);
  return { f, state: { ...parseFilterState(p), q: f.q } };
};

// Minimal well-formedness check: balanced tags and no bare ampersands.
function wellFormed(xml: string) {
  assert.doesNotMatch(xml, /&(?!(amp|lt|gt|quot|apos);)/);
  const stack: string[] = [];
  for (const m of xml
    .replace(/<\?xml[^>]*\?>/, "")
    .matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2]);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
}

test("feed lists newly observed eligible sales, newest first, never baseline or revised rows", () => {
  const old = sale("2026-01-10"),
    fresh = sale("2026-10-01", { registered: "2026-10-09" }),
    late = sale("2025-03-01", { registered: "2026-10-10" }), // old contract, newly registered
    corrected = sale("2026-09-01"),
    baseline = sale("2026-09-10"),
    tooOld = sale("2026-06-01");
  const o = observed([
    seen(old, null), // present when tracking began
    seen(fresh, "2026-10-12"),
    seen(late, "2026-10-14"),
    // An identifier correction keeps its original first-seen date (before the window).
    seen(corrected, "2026-08-01", "2026-10-15"),
    seen(baseline, null, "2026-10-15"),
    seen(tooOld, "2026-08-10"),
    // Not in the snapshot: not eligible for statistics.
    { id: "999999", propertyId: "2999999", firstSeen: "2026-10-16" },
  ]);
  const rows = [old, fresh, late, corrected, baseline, tooOld];
  const r = feedSales(rows, o, filters("").f);
  assert.deepEqual(
    r.sales.map((s) => s.id),
    [late.id, fresh.id],
  );
  assert.equal(r.sales[0].firstSeen, "2026-10-14");
  assert.equal(r.sales[0].date, "2025-03-01");
});

test("feed applies area, type, size and price filters but no period", () => {
  const flat = sale("2020-05-01", {
      district: "4. Laugardalur",
      price: 70_000_000,
    }),
    house = sale("2026-10-01", {
      type: "house",
      district: "4. Laugardalur",
      price: 70_000_000,
    }),
    dear = sale("2026-10-01", {
      district: "4. Laugardalur",
      price: 150_000_000,
    }),
    elsewhere = sale("2026-10-01", {
      district: "1. Vesturbær",
      price: 70_000_000,
    });
  const rows = [flat, house, dear, elsewhere],
    o = observed(rows.map((s) => seen(s, "2026-10-12")));
  const { f } = filters(
    "district=4. Laugardalur&type=apartment&maxPrice=100&months=3",
  );
  assert.deepEqual(
    feedSales(rows, o, f).sales.map((s) => s.id),
    [flat.id],
  );
});

test("feed output is bounded", () => {
  const rows = Array.from({ length: FEED_LIMIT + 20 }, () =>
      sale("2026-10-01"),
    ),
    o = observed(rows.map((s) => seen(s, "2026-10-12")));
  const r = feedSales(rows, o, filters("").f);
  assert.equal(r.total, FEED_LIMIT + 20);
  assert.equal(r.sales.length, FEED_LIMIT);
});

test("Atom XML is well formed, escaped and uses stable identifiers", () => {
  const s = sale("2026-10-01", {
    id: "612345",
    propertyId: "2345678",
    address: 'Gata & <"Hús"> 5',
    registered: "2026-10-08",
    district: "4. Laugardalur",
  });
  const o = observed([seen(s, "2026-10-12")]),
    { f, state } = filters("district=4. Laugardalur&q=Gata");
  const { xml, count } = feedXml({
    rows: [s],
    observed: o,
    f,
    state,
    origin: "https://fasteign.gunnthor.is",
  });
  assert.equal(count, 1);
  wellFormed(xml);
  assert.match(
    xml,
    /^<\?xml version="1.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www.w3.org\/2005\/Atom"/,
  );
  assert.ok(xml.includes("Gata &amp; &lt;&quot;Hús&quot;&gt; 5"));
  assert.ok(!xml.includes('<"Hús">'));
  assert.ok(xml.includes(`<id>${entryId(s)}</id>`));
  assert.equal(
    entryId(s),
    "tag:fasteign.gunnthor.is,2026-10:kaupsamningur/612345/2345678",
  );
  assert.ok(xml.includes("<updated>2026-10-12T00:00:00Z</updated>"));
  assert.ok(xml.includes('href="https://fasteign.gunnthor.is/eign/2345678"'));
  // Contract date and first-observed date are separate, labelled fields.
  assert.ok(xml.includes("Dagsetning kaupsamnings: 1. okt. 2026"));
  assert.ok(xml.includes("Fyrst séður í kaupskrá HMS: 12. okt. 2026"));
  assert.ok(xml.includes("Nýjar færslur · Laugardalur · „Gata“"));
  // The self link carries the filters; the id is the same for the same query.
  assert.ok(xml.includes("/api/feed?district=4.+Laugardalur&amp;q=Gata"));
  const again = feedXml({
    rows: [s],
    observed: o,
    f,
    state,
    origin: "https://fasteign.gunnthor.is",
  }).xml;
  assert.equal(again, xml);
});

test("empty feeds are valid and explain a fresh baseline", () => {
  const o = observed([], { runs: [{ date: "2026-10-17", bootstrap: true }] }),
    { f, state } = filters("postcode=999");
  const { xml, count } = feedXml({
    rows: [],
    observed: o,
    f,
    state,
    origin: "http://x.is",
  });
  assert.equal(count, 0);
  wellFormed(xml);
  assert.ok(xml.includes("Vöktun er nýhafin"));
  assert.doesNotMatch(xml, /<entry>/);
});

test("XML escaping removes characters XML 1.0 forbids", () => {
  assert.equal(escapeXml("a\u0001b&c'"), "ab&amp;c&apos;");
});
