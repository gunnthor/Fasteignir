import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeCSV, normalizeSale } from "../lib/data";
import {
  estimate,
  sensitivity,
  weightParts,
  comparableWeight,
  shiftMonths,
} from "../lib/analytics";
import {
  parseView,
  serializeView,
  DEFAULT_VIEW,
  parseDistributionValue,
  distributionLink,
} from "../lib/share";

const base = normalizeSale(
  decodeCSV(readFileSync("tests/fixtures/kaupskra.csv")).records[0],
  "2026-09-19",
);
const asOf = "2026-09-19";
const subject = {
  postcode: base.postcode,
  type: "apartment" as const,
  area: 83.2,
  rooms: 3,
  built: 1980,
};
// Comparables of varying age, size and price; one sale per property.
const rows = Array.from({ length: 40 }, (_, i) => {
  const area = 70 + (i % 9) * 4;
  const price = 60_000_000 + i * 500_000;
  return {
    ...base,
    id: String(i),
    propertyId: String(3000000 + i),
    date: shiftMonths(asOf, -(i % 30) - 1),
    area,
    price,
    ppm: price / area,
    rooms: 2 + (i % 3),
    built: 1960 + (i % 5) * 10,
  };
});

test("weight parts multiply to the comparable weight and lookback limits age", () => {
  const s = rows[3],
    p = weightParts(s, subject, asOf)!;
  assert.ok(
    Math.abs(
      p.size * p.room * p.age * p.recency - comparableWeight(s, subject, asOf),
    ) < 1e-12,
  );
  const old = { ...s, date: shiftMonths(asOf, -20) };
  assert.ok(weightParts(old, subject, asOf, 24));
  assert.equal(weightParts(old, subject, asOf, 12), null);
  assert.equal(comparableWeight(old, subject, asOf, 12), 0);
});

test("default estimate is unchanged by the lookback option at 24 months", () => {
  const a = estimate(rows, subject, asOf),
    b = estimate(rows, subject, asOf, { lookback: 24 });
  assert.deepEqual(a, b);
  assert.equal(a.lookback, 24);
});

test("diagnostics report age, similarity and concentration of weight", () => {
  const r = estimate(rows, subject, asOf);
  assert.equal(r.available, true);
  if (!r.available) return;
  const d = r.diagnostics;
  for (const share of [
    d.olderShare,
    d.lessSimilarShare,
    d.topShare,
    d.top5Share,
  ])
    assert.ok(share >= 0 && share <= 1);
  assert.ok(d.top5Share >= d.topShare);
  const older = r.comparables
    .filter((c) => c.ageMonths >= 12)
    .reduce((n, c) => n + c.weight, 0);
  assert.ok(Math.abs(older - d.olderShare) < 1e-9);
  assert.ok(d.leaveOneOut);
  assert.ok(d.leaveOneOut!.min <= d.leaveOneOut!.max);
  for (const c of r.comparables)
    for (const v of Object.values(c.parts)) assert.ok(v > 0 && v <= 1);
  // Subject inside the comparables' ranges: no extrapolation warning.
  assert.deepEqual(d.outside, []);
  const odd = estimate(rows, { ...subject, built: 2020 }, asOf);
  assert.ok(odd.available && odd.diagnostics.outside.includes("built"));
});

test("a shorter lookback can make the estimate unavailable rather than extrapolate", () => {
  const recent = rows.map((s, i) => ({
    ...s,
    date: shiftMonths(asOf, i < 3 ? -2 : -18),
  }));
  assert.equal(estimate(recent, subject, asOf).available, true);
  const short = estimate(recent, subject, asOf, { lookback: 12 });
  assert.equal(short.available, false);
  assert.equal(short.count, 3);
});

test("sensitivity reruns the same method with one change each and stays bounded", () => {
  const s = sensitivity(rows, subject, asOf);
  assert.deepEqual(
    s.map((x) => x.key),
    [
      "area-10",
      "area+10",
      "rooms-1",
      "rooms+1",
      "built-10",
      "built+10",
      "lookback12",
      "lookback36",
    ],
  );
  const bigger = s.find((x) => x.key === "area+10")!;
  const direct = estimate(
    rows,
    { ...subject, area: bigger.change.area! },
    asOf,
  );
  assert.equal(bigger.central, direct.available ? direct.central : null);
  const l12 = s.find((x) => x.key === "lookback12")!,
    e12 = estimate(rows, subject, asOf, { lookback: 12 });
  assert.equal(l12.central, e12.available ? e12.central : null);
  // A one-room subject has no "one room fewer" scenario; next year's build year is skipped.
  const keys = sensitivity(
    rows,
    { ...subject, rooms: 1, built: 2020 },
    asOf,
  ).map((x) => x.key);
  assert.ok(!keys.includes("rooms-1"));
  assert.ok(!keys.includes("built+10"));
});

test("the subject property never appears among its own comparables", () => {
  const r = estimate(
    rows,
    { ...subject, propertyId: rows[0].propertyId },
    asOf,
  );
  assert.ok(r.available);
  if (r.available)
    assert.ok(
      r.comparables.every((c) => c.sale.propertyId !== rows[0].propertyId),
    );
});

test("distribution view state round-trips and rejects nonsense values", () => {
  const view = { ...DEFAULT_VIEW, dist: "ppm" as const, value: "850000" };
  const p = serializeView(view);
  assert.equal(p.get("dist"), "ppm");
  assert.deepEqual(parseView(p), view);
  assert.equal(serializeView(DEFAULT_VIEW).toString(), "");
  assert.equal(parseView(new URLSearchParams("value=12&dist=x")).value, "");
  assert.equal(parseView(new URLSearchParams("value=12&dist=x")).dist, "price");
  assert.equal(parseDistributionValue("75000000", "price"), 75_000_000);
  assert.equal(parseDistributionValue("75000000", "ppm"), undefined);
  assert.equal(parseDistributionValue("-1", "price"), undefined);
  assert.equal(parseDistributionValue("1e9", "price"), undefined);
});

test("a sale's comparison group link is bounded and valid", () => {
  const href = distributionLink({
    date: "2026-01-15",
    postcode: "108",
    type: "apartment",
    area: 90,
    price: 75_000_000,
  });
  const p = new URLSearchParams(href.split("?")[1].split("#")[0]);
  assert.equal(p.get("from"), "2025-07-15");
  assert.equal(p.get("to"), "2026-07-15");
  assert.equal(p.get("minArea"), "67");
  assert.equal(p.get("maxArea"), "113");
  assert.equal(p.get("value"), "75000000");
  const v = parseView(p);
  assert.equal(v.filters.months, "custom");
  assert.equal(v.value, "75000000");
  // The window never extends past today.
  const recent = new URLSearchParams(
    distributionLink({
      date: new Date().toISOString().slice(0, 10),
      postcode: "108",
      type: "house",
      area: 200,
      price: 1e8,
    })
      .split("?")[1]
      .split("#")[0],
  );
  assert.ok(recent.get("to")! <= new Date().toISOString().slice(0, 10));
});
