import { num, money, date, percent } from "../lib/format";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  decodeCSV,
  numberValue,
  isoDate,
  normalizeSale,
  median,
  quantile,
} from "../lib/data";
import {
  parseFilters,
  matches,
  stats,
  shiftMonths,
  range,
  comparableWeight,
  estimate,
  weightedQuantile,
  groupStats,
} from "../lib/analytics";
const csv = decodeCSV(readFileSync("tests/fixtures/kaupskra.csv"));
const raw = csv.records[0],
  sale = normalizeSale(raw, "2026-09-19");
test("detects real source encoding and delimiter, handles quoted delimiter and Icelandic characters", () => {
  assert.equal(csv.encoding, "windows-1252");
  assert.equal(csv.delimiter, ";");
  assert.equal(raw.heimilisfang, "Þórsgata; prófun");
  assert.equal(raw.tegund, "Fjölbýli");
});
test("UTF-8 BOM and address CSV", () => {
  const d = decodeCSV(
    Buffer.from("\ufeffHEINUM,HEITI_NF\r\n123,Álfhólsvegur\r\n"),
  );
  assert.equal(d.encoding, "utf-8");
  assert.equal(d.records[0].heiti_nf, "Álfhólsvegur");
});
test("rejects malformed rows rather than silently shifting fields", () => {
  assert.throws(() => decodeCSV(Buffer.from("a;b\n1;2;3\n")));
});
test("numbers are explicit and blank or malformed is not zero", () => {
  assert.equal(numberValue("1.234,5"), 1234.5);
  assert.equal(numberValue("83.2"), 83.2);
  for (const value of [" ", "1x", "Infinity", "NaN", "1,2,3"])
    assert.equal(numberValue(value), null);
});
test("calendar date validation handles leap years and HMS timestamps", () => {
  assert.equal(isoDate("2024-02-29 00:00:00.0"), "2024-02-29");
  assert.equal(isoDate("29.02.2023"), null);
  assert.equal(isoDate("2026-02-30"), null);
  assert.equal(isoDate("14.08.2026"), "2026-08-14");
});
test("money multiplier and actual price per m²", () => {
  assert.equal(sale.price, 71500000);
  assert.equal(sale.valuation, 65000000);
  assert.equal(sale.ppm, 71500000 / 83.2);
  assert.equal(sale.age, 46);
  assert.equal(sale.month, "2026-08");
});
test("zero/negative area and price cannot contaminate statistics", () => {
  for (const einflm of ["0", "-2", ""]) {
    const s = normalizeSale({ ...raw, einflm }, "2026-09-19");
    assert.equal(s.usable, false);
    assert.ok(s.reasons.includes("invalid_area"));
    assert.equal(s.ppm, 0);
  }
  assert.ok(
    normalizeSale({ ...raw, kaupverd: "0" }, "2026-09-19").reasons.includes(
      "invalid_price",
    ),
  );
});
test("HMS unsuitable, unknown and incomplete contracts excluded with audit reasons", () => {
  for (const extra of [
    { onothaefur_samningur: "1" },
    { onothaefur_samningur: "" },
    { fullbuid: "0" },
    { fullbuid: "" },
  ] as Record<string, string>[])
    assert.equal(
      normalizeSale({ ...raw, ...extra }, "2026-09-19").usable,
      false,
    );
});
test("Capital Region includes Kjós and excludes Akureyri; Einbýli is residential", () => {
  assert.equal(
    normalizeSale({ ...raw, svfn: "1606", tegund: "Einbýli" }, "2026-09-19")
      .type,
    "house",
  );
  assert.equal(
    normalizeSale({ ...raw, svfn: "1606" }, "2026-09-19").capital,
    true,
  );
  assert.equal(
    normalizeSale({ ...raw, svfn: "6000" }, "2026-09-19").capital,
    false,
  );
  assert.equal(
    normalizeSale({ ...raw, tegund: "Atvinnuhúsnæði" }, "2026-09-19").usable,
    false,
  );
  assert.equal(sale.municipality, "0000");
});
test("future dates invalid and unknown build year remains null", () => {
  assert.equal(
    normalizeSale({ ...raw, utgdag: "2027-01-01" }, "2026-09-19").usable,
    false,
  );
  assert.equal(
    normalizeSale({ ...raw, byggar: "0" }, "2026-09-19").built,
    null,
  );
});
test("median is exact for odd/even/empty and does not mutate input", () => {
  const a = [5, 1, 3, 9];
  assert.equal(median(a), 4);
  assert.deepEqual(a, [5, 1, 3, 9]);
  assert.equal(median([5, 1, 9]), 5);
  assert.equal(median([]), null);
  assert.equal(quantile([0, 10], 0.25), 2.5);
});
test("sparse statistics and change need sufficient observations in both periods", () => {
  assert.equal(stats(Array(4).fill(sale)).ppm, null);
  assert.equal(stats(Array(5).fill(sale)).sparse, true);
  assert.equal(stats(Array(10).fill(sale), Array(9).fill(sale)).change, null);
  const s = stats(
    Array(10).fill(sale),
    Array(10).fill({ ...sale, ppm: sale.ppm / 2 }),
  );
  assert.equal(s.change, 100);
  assert.equal(s.ratioCount, 10);
});
test("regional medians are computed from sales, not area medians", () => {
  const rows = [
    ...Array(5).fill({ ...sale, ppm: 10, postcode: "101" }),
    ...Array(15).fill({ ...sale, ppm: 100, postcode: "108" }),
  ];
  assert.equal(stats(rows).ppm, 100);
  assert.equal(groupStats(rows, [], "postcode").length, 2);
});
test("calendar months clamp at month end; empty range and bad numbers rejected", () => {
  assert.equal(shiftMonths("2024-03-31", -1), "2024-02-29");
  assert.equal(
    range(parseFilters(new URLSearchParams()), "2026-09-19").from,
    "2025-09-19",
  );
  assert.throws(() =>
    parseFilters(new URLSearchParams("minArea=100&maxArea=50")),
  );
  assert.throws(() => parseFilters(new URLSearchParams("months=NaN")));
  assert.throws(() =>
    parseFilters(new URLSearchParams("from=2026-09-19&to=2026-01-01")),
  );
});
test("filters preserve missing-year sales unless year filter is active and honor 5+ rooms", () => {
  const f = parseFilters(new URLSearchParams());
  assert.equal(matches({ ...sale, built: null }, f), true);
  assert.equal(
    matches({ ...sale, built: null }, { ...f, minBuilt: 1980 }),
    false,
  );
  assert.equal(matches({ ...sale, rooms: 6 }, { ...f, rooms: 5 }), true);
  assert.equal(matches(sale, { ...f, q: "þórsgata" }), true);
});
const subject = {
  postcode: "101",
  type: "apartment" as const,
  area: 83.2,
  rooms: 3,
  built: 1980,
};
test("comparable weights favor newer/more similar homes and reject geography/type/future leakage", () => {
  const w = comparableWeight(sale, subject, "2026-09-19");
  assert.ok(
    w >
      comparableWeight({ ...sale, date: "2025-01-01" }, subject, "2026-09-19"),
  );
  assert.ok(
    w >
      comparableWeight({ ...sale, area: 120, rooms: 5 }, subject, "2026-09-19"),
  );
  for (const extra of [
    { postcode: "108" },
    { type: "house" as const },
    { date: "2027-01-01" },
    { area: 200 },
    { usable: false },
  ])
    assert.equal(
      comparableWeight({ ...sale, ...extra }, subject, "2026-09-19"),
      0,
    );
});
test("estimator suppresses sparse and repeat-property samples, returns weighted empirical range", () => {
  assert.equal(
    estimate(Array(20).fill(sale), subject, "2026-09-19").available,
    false,
  );
  const rows = Array.from({ length: 30 }, (_, i) => ({
    ...sale,
    id: String(i),
    propertyId: String(i),
    ppm: 700000 + i * 1000,
  }));
  const r = estimate(rows, subject, "2026-09-19");
  assert.equal(r.available, true);
  if (r.available) {
    assert.ok(r.low <= r.central && r.central <= r.high);
    assert.equal(r.count, 30);
    assert.ok(
      Math.abs(r.comparables.reduce((n, c) => n + c.weight, 0) - 1) < 1e-10,
    );
  }
  assert.equal(
    weightedQuantile(
      [
        { value: 1, weight: 9 },
        { value: 10, weight: 1 },
      ],
      0.5,
    ),
    1,
  );
});

test("Icelandic formatting remains correct even when browser locale support is incomplete", () => {
  assert.equal(num(1234567), "1.234.567");
  assert.equal(money(81500000), "81,5 m.kr.");
  assert.equal(percent(6.25), "+6,3%");
  assert.equal(date("2026-08-14"), "14. ágú. 2026");
});
