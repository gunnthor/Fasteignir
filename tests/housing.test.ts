import { test } from "node:test";
import assert from "node:assert/strict";
import { DISTRICT_NAMES, buildHousing, perThousand } from "../lib/housing";
import {
  activityWindow,
  profile,
  slugOf,
  type ProfileEntry,
} from "../lib/profiles";
import { sale } from "./fixtures/sales";

const ids = Object.values(DISTRICT_NAMES);
const ours = ids.map((id, i) => ({
  HVERFI: id,
  "SHAPE.AREA": 1_000_000 + i * 1000.5,
}));
const layer = ours.map((d) => ({
  HVERFI: d.HVERFI,
  Shape__Area: d["SHAPE.AREA"] + 0.0001,
}));
const csv = Object.keys(DISTRICT_NAMES).map((name, i) => ({
  ar: "2026",
  hverfi: name,
  ibuafjoldi: String(10000 + i),
  ibudafjoldi: String(4000 + i),
}));
const src = {
  url: "https://example.is/hverfi.csv",
  downloadedAt: "2026-10-18T00:00:00Z",
  sha256: "x",
};

test("housing context is accepted only with matching boundaries and complete counts", () => {
  const h = buildHousing(csv, layer, ours, src);
  assert.equal(h.status, "ok");
  if (h.status !== "ok") return;
  assert.equal(h.year, 2026);
  assert.deepEqual(h.districts["4. Laugardalur"], {
    population: 10003,
    dwellings: 4003,
  });
  assert.equal(Object.keys(h.districts).length, 10);
});

test("incompatible or incomplete inputs make the context unavailable instead of guessing", () => {
  const bad = (records = csv, l: typeof layer | null = layer, d = ours) =>
    buildHousing(records, l, d, src);
  // A boundary that differs from the polygons sales are assigned to.
  assert.equal(
    bad(
      csv,
      layer.map((x, i) =>
        i === 3 ? { ...x, Shape__Area: x.Shape__Area * 1.01 } : x,
      ),
    ).status,
    "unavailable",
  );
  assert.equal(bad(csv, null).status, "unavailable");
  assert.equal(bad(csv, layer.slice(1)).status, "unavailable");
  // Different reference years are never combined.
  assert.equal(
    bad(csv.map((r, i) => (i ? r : { ...r, ar: "2025" }))).status,
    "unavailable",
  );
  assert.equal(bad(csv.slice(1)).status, "unavailable");
  assert.equal(bad([...csv, csv[0]]).status, "unavailable");
  assert.equal(
    bad(csv.map((r, i) => (i ? r : { ...r, hverfi: "Austurbær" }))).status,
    "unavailable",
  );
  assert.equal(
    bad(csv.map((r, i) => (i ? r : { ...r, ibudafjoldi: "" }))).status,
    "unavailable",
  );
  assert.equal(
    bad(csv.map((r, i) => (i ? r : { ...r, ibudafjoldi: "12,5" }))).status,
    "unavailable",
  );
  assert.equal(
    bad(csv.map(({ ibudafjoldi: _, ...r }) => r) as typeof csv).status,
    "unavailable",
  );
});

test("activity rate is per 1,000 dwellings and undefined without a denominator", () => {
  assert.equal(perThousand(464, 9086)?.toFixed(1), "51.1");
  assert.equal(perThousand(10, 0), null);
});

test("activity window is 12 full months and skips probably incomplete months", () => {
  assert.deepEqual(activityWindow("2026-10-15", ["2026-10"]), {
    from: "2025-10-01",
    to: "2026-09-30",
  });
  assert.deepEqual(activityWindow("2026-10-15", ["2026-09", "2026-10"]), {
    from: "2025-09-01",
    to: "2026-08-31",
  });
  // The current month is never treated as complete.
  assert.deepEqual(activityWindow("2026-10-15", []), {
    from: "2025-10-01",
    to: "2026-09-30",
  });
  assert.deepEqual(activityWindow("2026-09-30", []), {
    from: "2025-10-01",
    to: "2026-09-30",
  });
});

test("slugs are unique, readable and stable for every district", () => {
  const slugs = ids.map((id) => slugOf({ kind: "district", id }));
  assert.equal(new Set(slugs).size, 10);
  assert.deepEqual(slugs.slice(0, 4), [
    "vesturbaer",
    "midborg",
    "hlidar",
    "laugardalur",
  ]);
  assert.equal(
    slugOf({ kind: "district", id: "10. Grafarholt-Úlfarsárd." }),
    "grafarholt-ulfarsardalur",
  );
  assert.equal(slugOf({ kind: "municipality", id: "1300" }), "gardabaer");
  assert.equal(slugOf({ kind: "postcode", id: "107" }), "107");
});

const entry = (kind: ProfileEntry["kind"], id: string): ProfileEntry => ({
  kind,
  id,
  label: id,
  count: 100,
  slug: id,
  recent: 100,
  listed: true,
  municipalities: [],
});

test("profiles compute activity only for districts with a verified denominator", () => {
  const h = buildHousing(csv, layer, ours, src);
  const rows = [
    ...Array.from({ length: 12 }, (_, i) =>
      sale(`2026-0${(i % 8) + 1}-10`, {
        district: "4. Laugardalur",
        postcode: "104",
      }),
    ),
    ...Array.from({ length: 3 }, () =>
      sale("2026-05-10", { district: null, postcode: "104" }),
    ),
    sale("2026-10-02", { district: "4. Laugardalur", postcode: "104" }), // incomplete month: excluded
  ];
  const p = profile(
    rows,
    entry("district", "4. Laugardalur"),
    "2026-10-15",
    h,
    ["2026-10"],
  );
  assert.ok(p.activity);
  assert.equal(p.activity!.sales, 12);
  assert.equal(p.activity!.dwellings, 4003);
  assert.equal(p.activity!.rate!.toFixed(2), ((12 / 4003) * 1000).toFixed(2));
  // 12 of 15 Reykjavík sales in the window could be placed in a district.
  assert.equal(p.activity!.coverage, 80);
  assert.equal(p.summary.count, 13);
  assert.equal(
    profile(rows, entry("postcode", "104"), "2026-10-15", h, []).activity,
    null,
  );
  const none = profile(
    rows,
    entry("district", "4. Laugardalur"),
    "2026-10-15",
    { status: "unavailable", reason: "x" },
    [],
  );
  assert.equal(none.activity, null);
  assert.equal(none.housingStatus, "x");
});

test("activity rate is withheld under five sales", () => {
  const h = buildHousing(csv, layer, ours, src);
  const rows = Array.from({ length: 4 }, () =>
    sale("2026-03-10", { district: "2. Miðborg" }),
  );
  const p = profile(rows, entry("district", "2. Miðborg"), "2026-10-15", h, []);
  assert.equal(p.activity!.sales, 4);
  assert.equal(p.activity!.rate, null);
  assert.equal(p.summary.ppm, null);
});
