import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GROUP_MIN,
  composition,
  days,
  explain,
  trailingPeriods,
  yearPeriods,
} from "../lib/composition";
import { parseFilters } from "../lib/analytics";
import { sale } from "./fixtures/sales";

const all = parseFilters(new URLSearchParams("months=0"));
const flat = (date: string, extra = {}) =>
  sale(date, {
    type: "apartment",
    area: 85,
    price: 51_000_000,
    rooms: 3,
    built: 1975,
    ...extra,
  });
const house = (date: string, extra = {}) =>
  sale(date, {
    type: "house",
    area: 180,
    price: 72_000_000,
    rooms: 5,
    built: 1995,
    municipality: "1000",
    municipalityName: "Kópavogur",
    postcode: "200",
    ...extra,
  });

test("default periods are two contiguous, equally long 12-month windows", () => {
  const { a, b } = trailingPeriods("2026-10-17");
  assert.deepEqual(b, { from: "2025-10-18", to: "2026-10-17" });
  assert.deepEqual(a, { from: "2024-10-18", to: "2025-10-17" });
  assert.equal(days(a), days(b));
  const y = yearPeriods(2025, 2026, "2026-10-17");
  assert.deepEqual(y.b, { from: "2026-01-01", to: "2026-10-17" });
  assert.equal(y.a.to, "2025-12-31");
});

// Prices within each group are identical in both periods; only the mix changes.
const A = [
  ...Array.from({ length: 80 }, () => flat("2025-03-01")),
  ...Array.from({ length: 20 }, () => house("2025-03-01")),
];
const B = [
  ...Array.from({ length: 50 }, () => flat("2026-03-01")),
  ...Array.from({ length: 50 }, () => house("2026-03-01")),
];
const periods = {
  a: { from: "2025-01-01", to: "2025-12-31" },
  b: { from: "2026-01-01", to: "2026-12-31" },
};

test("group counts reconcile to period totals in every dimension", () => {
  const extra = [
    flat("2025-05-05", { rooms: null, built: null }),
    house("2026-06-06", { area: 30 }),
  ];
  const c = composition([...A, ...B, ...extra], all, periods);
  assert.equal(c.overall.a.count, 101);
  assert.equal(c.overall.b.count, 101);
  for (const d of c.dimensions) {
    for (const side of ["a", "b"] as const) {
      const sum = d.rows.reduce((n, r) => n + r[side].count, 0);
      assert.equal(sum, c.overall[side].count, `${d.key}/${side}`);
      const share = d.rows.reduce((n, r) => n + (r[side].share ?? 0), 0);
      assert.ok(
        Math.abs(share - 100) < 1e-9,
        `${d.key}/${side} share ${share}`,
      );
    }
  }
  assert.ok(
    c.dimensions
      .find((d) => d.key === "rooms")!
      .rows.some((r) => r.id === "unknown" && r.a.count === 1),
  );
  assert.deepEqual(
    c.dimensions.find((d) => d.key === "area")!.rows.map((r) => r.id),
    ["0000", "1000"],
  );
});

test("a pure mix shift moves the overall median while comparable groups do not change", () => {
  const c = composition([...A, ...B], all, periods);
  assert.ok(c.overallChange! < -5);
  assert.equal(c.cells.length, 2);
  for (const cell of c.cells) assert.equal(cell.ppmChange, 0);
  const type = c.dimensions.find((d) => d.key === "type")!;
  assert.deepEqual(
    type.rows.map((r) => [r.a.share, r.b.share]),
    [
      [80, 50],
      [20, 50],
    ],
  );
  const text = explain(c);
  const mix = text.find((t) => t.kind === "mix")!.text,
    within = text.find((t) => t.kind === "within")!.text;
  assert.match(mix, /Hlutfall sérbýla fór úr 20% í 50% \(\+30 prósentustig\)/);
  assert.match(within, /breyttist miðgildi á m² um 0% í þeim öllum/);
  // Outside the within-group range, without a causal claim.
  assert.match(
    within,
    /utan þess bils\. Það getur endurspeglað breytta samsetningu, en líka/,
  );
  const caveat = text.find((t) => t.kind === "caveat")!.text;
  assert.match(caveat, /ekki verðvísitala/);
  assert.match(caveat, /leggjast ekki saman í heildarbreytinguna/);
});

test("group medians are hidden below the stricter group threshold", () => {
  const small = [
    ...Array.from({ length: GROUP_MIN - 1 }, () => house("2025-04-01")),
    ...Array.from({ length: GROUP_MIN }, () => house("2026-04-01")),
  ];
  const c = composition(small, all, periods);
  const row = c.dimensions
    .find((d) => d.key === "type")!
    .rows.find((r) => r.id === "house")!;
  assert.equal(row.a.count, GROUP_MIN - 1);
  assert.equal(row.a.ppm, null);
  assert.notEqual(row.b.ppm, null);
  assert.equal(row.ppmChange, null);
  assert.equal(c.cells.length, 0);
  // The overall median uses the normal 5-sale rule.
  assert.notEqual(c.overall.a.ppm, null);
  assert.match(
    explain(c).find((t) => t.kind === "within")!.text,
    /Enginn sambærilegur hópur/,
  );
});

test("empty and tiny periods are suppressed and flagged; unequal and overlapping periods warn", () => {
  const c = composition([flat("2025-02-01"), flat("2026-02-01")], all, periods);
  assert.equal(c.overall.a.ppm, null);
  assert.equal(c.overallChange, null);
  assert.ok(c.warnings.includes("sparse"));
  assert.match(explain(c)[0].text, /Of fáar sölur/);
  const odd = composition([], all, {
    a: { from: "2025-01-01", to: "2025-12-31" },
    b: { from: "2025-06-01", to: "2025-08-31" },
  });
  assert.ok(odd.warnings.includes("unequal_length"));
  assert.ok(odd.warnings.includes("overlap"));
  for (const d of odd.dimensions)
    for (const r of d.rows) assert.equal(r.a.share, null);
});

test("filters restrict both periods; geography is dropped inside a postcode", () => {
  const f = parseFilters(new URLSearchParams("months=0&postcode=200"));
  const c = composition([...A, ...B], f, periods);
  assert.equal(c.overall.a.count, 20);
  assert.equal(
    c.dimensions.some((d) => d.key === "area"),
    false,
  );
});

test("small samples and distant periods carry their own warnings", () => {
  const few = [
    ...Array.from({ length: 40 }, () => flat("2025-03-01")),
    ...Array.from({ length: 40 }, () => flat("2026-03-01")),
  ];
  assert.ok(composition(few, all, periods).warnings.includes("small_sample"));
  assert.equal(
    composition([...A, ...B], all, periods).warnings.includes("small_sample"),
    false,
  );
  const far = composition([], all, {
    a: { from: "2019-01-01", to: "2019-12-31" },
    b: { from: "2024-01-01", to: "2024-12-31" },
  });
  assert.ok(far.warnings.includes("far_apart"));
  assert.equal(
    composition([], all, periods).warnings.includes("far_apart"),
    false,
  );
});
