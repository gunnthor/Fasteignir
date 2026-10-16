import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeCSV, normalizeSale } from "../lib/data";
import { parseFilters } from "../lib/analytics";
import { notModified, sparkPath } from "../lib/card";
import { sqm, year } from "../lib/format";
import {
  apiParams,
  filterSummary,
  parseView,
  serializeView,
  DEFAULT_FILTERS,
} from "../lib/share";
const sale = normalizeSale(
  decodeCSV(readFileSync("tests/fixtures/kaupskra.csv")).records[0],
  "2026-09-19",
);

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
