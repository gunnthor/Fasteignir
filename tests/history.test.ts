import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSale } from "../lib/data";
import {
  buildHistoryIndex,
  describeHistory,
  differences,
  packHistory,
  unpackHistory,
} from "../lib/history";

const raw = (
  id: string,
  fastnum: string,
  date: string,
  price: string,
  extra: Record<string, string> = {},
) => ({
  faerslunumer: id,
  emnr: "411",
  skjalanumer: `X-${id}`,
  fastnum,
  heimilisfang: "Prófgata 1",
  postnr: "105",
  heinum: "1",
  svfn: "0000",
  utgdag: `${date} 00:00:00.0`,
  thinglystdags: `${date} 12:00:00.0`,
  kaupverd: price,
  fasteignamat: "50000",
  byggar: "1970",
  fepilog: "010101",
  einflm: "80",
  fjherb: "3",
  tegund: "Fjölbýli",
  fullbuid: "1",
  onothaefur_samningur: "0",
  ...extra,
});
function index(records: Record<string, string>[]) {
  const rows = records.map((r) => normalizeSale(r, "2026-10-17"));
  // Mirror ingestion: rows sharing a contract are excluded from statistics.
  const ids = new Map<string, number>();
  for (const s of rows) ids.set(s.id, (ids.get(s.id) ?? 0) + 1);
  for (const s of rows)
    if (ids.get(s.id)! > 1) {
      s.reasons.push("duplicate_id");
      s.usable = false;
    }
  return buildHistoryIndex(rows, records);
}

test("consistent repeat sales are confirmed with nominal changes", () => {
  const [h] = index([
    raw("1", "2000001", "2015-03-01", "30000"),
    raw("2", "2000001", "2020-06-01", "45000"),
    raw("3", "2000001", "2025-06-01", "60000"),
  ]);
  const d = describeHistory(h);
  assert.equal(d.status, "confirmed");
  assert.equal(d.steps.length, 3);
  const [latest, middle, first] = d.steps;
  assert.equal(latest.previous!.change, 15_000_000);
  assert.ok(Math.abs(latest.previous!.percent - 100 / 3) < 1e-9);
  assert.equal(latest.previous!.uncertain, false);
  assert.equal(middle.previous!.percent, 50);
  assert.equal(first.previous, null);
  assert.equal(first.noComparison, null);
  assert.equal(latest.ppm, 60_000_000 / 80);
});

test("a changed unit code or floor area makes the history uncertain", () => {
  const [h] = index([
    raw("1", "2000001", "2015-03-01", "30000"),
    raw("2", "2000001", "2020-06-01", "45000", {
      fepilog: "020101",
      einflm: "120",
    }),
  ]);
  const d = describeHistory(h);
  assert.equal(d.status, "uncertain");
  assert.deepEqual(d.steps[0].previous!.differences, ["unit", "area"]);
  assert.equal(d.steps[0].previous!.uncertain, true);
  // Small re-measurement is tolerated.
  assert.deepEqual(
    differences({ ...h.sales[0], area: 80 }, { ...h.sales[0], area: 81.5 }),
    [],
  );
});

test("bundled and HMS-unsuitable contracts are not used for price changes", () => {
  const [h] = index([
    raw("1", "2000001", "2012-01-01", "20000"),
    raw("2", "2000001", "2016-01-01", "40000"),
    raw("2", "2000999", "2016-01-01", "40000", { tegund: "Bílskúr/skúr" }),
    raw("3", "2000001", "2019-01-01", "10000", { onothaefur_samningur: "1" }),
    raw("4", "2000001", "2024-01-01", "50000"),
  ]).filter((x) => x.propertyId === "2000001");
  const d = describeHistory(h);
  const [last, unsuitable, bundle, first] = d.steps;
  assert.equal(bundle.sale.bundle, 1);
  assert.deepEqual(bundle.sale.bundleTypes, ["bílskúr"]);
  assert.equal(bundle.ppm, null);
  assert.equal(bundle.noComparison, "not_comparable");
  assert.ok(unsuitable.caveats.includes("unsuitable"));
  assert.equal(unsuitable.noComparison, "not_comparable");
  // The latest sale is compared with the 2012 sale, skipping two contracts.
  assert.equal(last.previous!.date, "2012-01-01");
  assert.equal(last.previous!.skipped, 2);
  assert.equal(last.previous!.percent, 150);
  assert.equal(first.previous, null);
});

test("duplicate registrations of one sale are collapsed and noted", () => {
  const [h] = index([
    raw("10", "2000001", "2021-05-05", "55000"),
    raw("11", "2000001", "2021-05-05", "55000"),
  ]);
  assert.equal(h.sales.length, 1);
  assert.deepEqual(h.sales[0].duplicates, ["11"]);
  assert.equal(describeHistory(h).status, "single");
});

test("non-residential, other regions and invalid identifiers are left out", () => {
  const list = index([
    raw("1", "2000001", "2020-01-01", "30000", { tegund: "Atvinnuhúsnæði" }),
    raw("2", "2000002", "2020-01-01", "30000", { svfn: "6000" }),
    raw("3", "20003", "2020-01-01", "30000"),
    raw("4", "2000004", "2020-01-01", "30000"),
  ]);
  assert.deepEqual(
    list.map((h) => h.propertyId),
    ["2000004"],
  );
});

test("packed encoding round-trips exactly", () => {
  const list = index([
    raw("1", "2000001", "2015-03-01", "30000", { fullbuid: "0" }),
    raw("2", "2000001", "2020-06-01", "45000", { onothaefur_samningur: "1" }),
    raw("2", "2000002", "2020-06-01", "45000"),
  ]);
  for (const h of list)
    assert.deepEqual(
      unpackHistory(JSON.parse(JSON.stringify(packHistory(h)))),
      h,
    );
});

test("a bundle's combined floor area alone does not make history uncertain", () => {
  const [h] = index([
    raw("1", "2000001", "2014-05-30", "51500", { einflm: "203" }),
    raw("1", "2000002", "2014-05-30", "51500", { einflm: "203" }),
    raw("2", "2000001", "2016-11-08", "44900", { einflm: "90" }),
    raw("3", "2000001", "2022-02-25", "58000", { einflm: "90" }),
  ]);
  assert.equal(describeHistory(h).status, "confirmed");
});
