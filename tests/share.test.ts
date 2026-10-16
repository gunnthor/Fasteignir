import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeCSV, normalizeSale } from "../lib/data";
import { parseFilters } from "../lib/analytics";
import { budgetView } from "../lib/budget";
import { compare } from "../lib/compare";
import { notModified, sparkPath } from "../lib/card";
import { sqm, year } from "../lib/format";
import {
  apiParams,
  filterSummary,
  parseArea,
  parseBudget,
  parseView,
  question,
  serializeView,
  DEFAULT_FILTERS,
} from "../lib/share";
import type { Sale } from "../lib/types";
const sale = normalizeSale(
  decodeCSV(readFileSync("tests/fixtures/kaupskra.csv")).records[0],
  "2026-09-19",
);
const today = "2026-09-19";
const many = (n: number, patch: Partial<Sale>) =>
  Array.from({ length: n }, (_, i) => ({
    ...sale,
    id: `${patch.postcode ?? sale.postcode}-${i}-${patch.price ?? sale.price}`,
    propertyId: `${i}`,
    ...patch,
  }));

test("shared view round-trips through the URL and omits defaults", () => {
  const p = new URLSearchParams(
    "postcode=107&type=apartment&months=24&rooms=3&minArea=50&maxArea=90&q=Hringbraut&metric=count&level=district&points=1",
  );
  const view = parseView(p);
  assert.equal(view.filters.postcode, "107");
  assert.equal(view.metric, "count");
  assert.deepEqual(parseView(serializeView(view)), view);
  assert.equal(serializeView(parseView(new URLSearchParams())).toString(), "");
});
test("invalid shared parameters fall back to safe defaults", () => {
  const view = parseView({
    postcode: "10",
    type: "castle",
    months: "7",
    municipality: "9999",
    minArea: "200",
    maxArea: "50",
    rooms: "9",
    metric: "evil",
    from: "2026-02-30",
    to: "2026-03-01",
  });
  assert.deepEqual(view.filters, DEFAULT_FILTERS);
  assert.equal(view.metric, "ppm");
  // Every serialized view is accepted by the strict API parser.
  assert.doesNotThrow(() => parseFilters(apiParams(view.filters)));
});
test("explicit dates become a custom period and pinning fixes relative periods", () => {
  const view = parseView(new URLSearchParams("from=2025-01-01&to=2025-06-30"));
  assert.equal(view.filters.months, "custom");
  assert.equal(serializeView(view).toString(), "from=2025-01-01&to=2025-06-30");
  const relative = parseView(new URLSearchParams("months=12&postcode=101"));
  assert.equal(
    serializeView(relative, { from: "2025-09-19", to: "2026-09-19" }).get(
      "months",
    ),
    null,
  );
});
test("card summaries name every active restriction", () => {
  assert.deepEqual(
    filterSummary(
      { ...DEFAULT_FILTERS, type: "house", rooms: "5", minArea: "1000" },
      "Laugavegur",
    ),
    ["Sérbýli", "5+ herbergi", "≥ 1.000 m²", "leit: „Laugavegur“"],
  );
});
test("area and budget parameters are validated", () => {
  assert.deepEqual(parseArea("postcode:107"), { kind: "postcode", id: "107" });
  assert.deepEqual(parseArea("district:4. Laugardalur"), {
    kind: "district",
    id: "4. Laugardalur",
  });
  assert.equal(parseArea("postcode:1a7"), null);
  assert.equal(parseArea("municipality:9999"), null);
  assert.equal(parseBudget("75000000"), 75000000);
  assert.equal(parseBudget("-5"), null);
  assert.equal(parseBudget("1000"), null);
});
test("comparison is suppressed when either side has fewer than five sales", () => {
  const rows = [
    ...many(20, { postcode: "101", ppm: 900000 }),
    ...many(4, { postcode: "108", ppm: 800000 }),
  ];
  const a = { kind: "postcode", id: "101" } as const,
    b = { kind: "postcode", id: "108" } as const;
  const thin = compare(rows, DEFAULT_FILTERS, a, b, today);
  assert.equal(thin.comparable, false);
  assert.equal(thin.difference, null);
  assert.equal(thin.distribution, null);
  assert.equal(thin.b.summary.ppm, null);
  const full = compare(
    [...rows, ...many(6, { postcode: "108", ppm: 800000 })],
    DEFAULT_FILTERS,
    a,
    b,
    today,
  );
  assert.equal(full.comparable, true);
  assert.equal(full.difference, 12.5);
  const bins = full.distribution!;
  assert.equal(Math.round(bins.reduce((n, x) => n + x.a, 0)), 100);
  assert.equal(Math.round(bins.reduce((n, x) => n + x.b, 0)), 100);
});
test("budget shares and within-budget statistics respect sample protections", () => {
  const rows = [
    ...many(6, { price: 60_000_000 }),
    ...many(4, { price: 90_000_000 }),
    ...many(3, { postcode: "108", price: 50_000_000 }),
  ];
  const v = budgetView(rows, DEFAULT_FILTERS, 75_000_000, today);
  assert.equal(v.overall.count, 13);
  assert.equal(v.overall.within, 9);
  assert.equal(Math.round(v.overall.share!), 69);
  assert.equal(v.level, "municipality");
  const scoped = budgetView(
    rows,
    { ...DEFAULT_FILTERS, municipality: "0000" },
    75_000_000,
    today,
  );
  const small = scoped.areas.find((a) => a.id === "108")!;
  assert.equal(small.share, null);
  assert.equal(small.area, null);
  const big = scoped.areas.find((a) => a.id === "101")!;
  assert.equal(big.share, 60);
  assert.equal(big.area, sale.area);
  const curve = v.curve!;
  assert.equal(curve.at(-1)!.share, 100);
  assert.ok(curve.every((c, i) => !i || c.share >= curve[i - 1].share));
});
test("sparklines skip suppressed months instead of drawing through them", () => {
  assert.equal(sparkPath([null, 1], 100, 10), "");
  assert.equal(sparkPath([1, 2, null, 3], 30, 10).match(/M/g)!.length, 2);
});

test("conditional requests honour weak and listed ETags", () => {
  const headers = { ETag: '"abc"', "Cache-Control": "public" };
  const req = (v: string) =>
    new Request("http://x/", { headers: { "If-None-Match": v } });
  assert.equal(notModified(req('"abc"'), headers)?.status, 304);
  assert.equal(notModified(req('W/"abc"'), headers)?.status, 304);
  assert.equal(notModified(req('"x", W/"abc"'), headers)?.status, 304);
  assert.equal(notModified(req('"other"'), headers), null);
});
test("years are not digit-grouped and missing sizes have no unit", () => {
  assert.equal(year(1967.4), "1967");
  assert.equal(year(null), "—");
  assert.equal(sqm(null), "—");
  assert.equal(sqm(1200), "1.200 m²");
});
test("the budget question reads as a complete Icelandic sentence", () => {
  assert.equal(
    question({ ...DEFAULT_FILTERS, rooms: "3", type: "apartment" }, 75e6),
    "Hvar hafa selst 3 herbergja íbúðir í fjölbýli á 75 m.kr. eða minna síðustu 12 mánuði?",
  );
});
