import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lagDays,
  lagHistogram,
  lagSummary,
  completenessCurve,
  incompleteMonths,
  registrationView,
} from "../lib/registration";
import { newlyObserved } from "../lib/newly-observed";
import { priceDistribution } from "../lib/price-distribution";
import { parseFilters } from "../lib/analytics";
import type { Sale } from "../lib/types";
import type { Observed } from "../lib/server";

let next = 0;
function sale(
  date: string,
  registered: string | null,
  extra: Partial<Sale> = {},
): Sale {
  next++;
  return {
    id: String(100000 + next),
    address: `Prófgata ${next}`,
    postcode: "105",
    municipality: "0000",
    municipalityName: "Reykjavík",
    heinum: "1",
    propertyId: String(2000000 + next),
    date,
    registered,
    year: +date.slice(0, 4),
    month: date.slice(0, 7),
    price: 60_000_000 + (next % 40) * 1_000_000,
    valuation: null,
    area: 80,
    rooms: 3,
    built: 1980,
    age: 40,
    type: "apartment",
    residential: true,
    capital: true,
    usable: true,
    reasons: [],
    warnings: [],
    ppm: 0,
    coordinates: null,
    coordinateQuality: "unmatched",
    district: null,
    ...extra,
  };
}
const addDays = (d: string, n: number) =>
  new Date(+new Date(d) + n * 864e5).toISOString().slice(0, 10);

test("lag is whole days from signature to registration", () => {
  assert.equal(lagDays({ date: "2026-09-01", registered: "2026-09-08" }), 7);
  assert.equal(lagDays({ date: "2026-09-01", registered: null }), null);
});

test("lag summary hides medians under 5 and spreads under 20", () => {
  assert.equal(lagSummary([1, 2, 3, 4]).median, null);
  const nine = lagSummary([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(nine.median, 5);
  assert.equal(nine.sparse, true);
  assert.equal(nine.p90, null);
  const many = lagSummary(Array.from({ length: 40 }, (_, i) => i));
  assert.equal(many.p90, 35.1);
  assert.equal(many.within30, (31 / 40) * 100);
});

test("lag histogram merges buckets holding 1–4 contracts", () => {
  const lags = [
    ...Array(30).fill(5),
    ...Array(10).fill(10),
    ...Array(2).fill(45),
    ...Array(1).fill(400),
  ];
  const bins = lagHistogram(lags)!;
  assert.equal(
    bins.reduce((n, b) => n + b.count, 0),
    lags.length,
  );
  for (const b of bins)
    assert.ok(b.count === 0 || b.count >= 5, JSON.stringify(b));
  assert.equal(bins.at(-1)!.to, null);
  assert.equal(lagHistogram(lags.slice(0, 19)), null);
});

test("completeness uses contracts one to two years old and flags recent months", () => {
  const asOf = "2026-10-15",
    rows: Sale[] = [];
  // Mature cohort: half registered within 7 days, rest within 30.
  for (let i = 0; i < 200; i++) {
    const d = addDays("2025-01-01", i);
    rows.push(sale(d, addDays(d, i % 2 ? 7 : 30)));
  }
  const curve = completenessCurve(rows, asOf);
  assert.ok(curve.count > 100);
  assert.equal(curve.share(7), 50);
  assert.equal(curve.share(30), 100);
  const flagged = incompleteMonths(rows, asOf);
  assert.deepEqual(
    flagged.map((m) => m.month),
    ["2026-09", "2026-10"],
  );
  assert.equal(flagged.at(-1)!.ended, false);
  // Too little history: nothing is claimed.
  assert.deepEqual(incompleteMonths(rows.slice(0, 5), asOf), []);
});

test("registration view groups by registration month and respects filters", () => {
  const asOf = "2026-10-15",
    rows = [
      ...Array.from({ length: 25 }, (_, i) =>
        sale(addDays("2026-08-01", i), addDays("2026-08-01", i + 6)),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        sale(addDays("2026-08-01", i), addDays("2026-08-01", i + 40), {
          type: "house",
          municipality: "1000",
          municipalityName: "Kópavogur",
        }),
      ),
    ];
  const all = registrationView(rows, { type: "all", municipality: "" }, asOf);
  assert.equal(all.summary.count, 31);
  assert.equal(all.byType.length, 2);
  const houses = registrationView(
    rows,
    { type: "house", municipality: "" },
    asOf,
  );
  assert.equal(houses.summary.count, 6);
  assert.equal(houses.summary.median, 40);
  assert.equal(houses.byType.length, 0);
  const sept = all.trend.find((t) => t.month === "2026-09")!;
  assert.ok(sept.count > 0);
  assert.equal(all.trend.at(-1)!.month, "2026-10");
});

function observed(
  recent: Observed["recent"],
  runs: Partial<Observed["runs"][number]>[],
): Observed {
  return {
    trackingSince: "2026-09-20",
    generatedAt: "",
    lastRun: { date: "2026-10-17" } as Observed["lastRun"],
    runs: runs as Observed["runs"],
    since: "2026-08-18",
    removed: 0,
    recent,
  };
}

test("newly observed lists only first observations in the window, never baseline rows", () => {
  const a = sale("2026-10-01", "2026-10-09"),
    b = sale("2026-06-01", "2026-06-05"),
    c = sale("2026-10-02", "2026-10-10", { type: "house" });
  const o = observed(
    [
      {
        id: a.id,
        propertyId: a.propertyId,
        firstSeen: "2026-10-02",
        changedAt: null,
        date: a.date,
        registered: a.registered,
        capital: true,
        residential: true,
        usable: true,
        type: "apartment",
        municipality: "0000",
      },
      {
        id: b.id,
        propertyId: b.propertyId,
        firstSeen: null,
        changedAt: "2026-10-16",
        date: b.date,
        registered: b.registered,
        capital: true,
        residential: true,
        usable: true,
        type: "apartment",
        municipality: "0000",
      },
      {
        id: c.id,
        propertyId: c.propertyId,
        firstSeen: "2026-10-16",
        changedAt: null,
        date: c.date,
        registered: c.registered,
        capital: true,
        residential: true,
        usable: true,
        type: "house",
        municipality: "0000",
      },
      {
        id: "999",
        propertyId: "2999999",
        firstSeen: "2026-10-16",
        changedAt: null,
        date: "2026-10-03",
        registered: "2026-10-10",
        capital: true,
        residential: true,
        usable: false,
        type: "apartment",
        municipality: "0000",
      },
      {
        id: "998",
        propertyId: "2999998",
        firstSeen: "2026-10-16",
        changedAt: null,
        date: "2026-10-03",
        registered: "2026-10-10",
        capital: false,
        residential: true,
        usable: false,
        type: "apartment",
        municipality: "8000",
      },
    ],
    [
      { date: "2026-09-20", bootstrap: true },
      { date: "2026-10-12", bootstrap: false },
      { date: "2026-10-16", bootstrap: false },
    ],
  );
  const r = newlyObserved([a, b, c], o, {
    type: "all",
    municipality: "",
    days: 30,
    today: "2026-10-17",
  });
  assert.deepEqual(
    r.added.map((x) => x.id),
    [c.id, a.id],
  );
  assert.equal(r.added[1].lag, 8);
  assert.equal(r.otherCount, 1);
  assert.deepEqual(
    r.changed.map((x) => x.id),
    [b.id],
  );
  // Observation days without new sales appear as zero.
  assert.deepEqual(r.perDay, [
    { date: "2026-10-02", count: 1 },
    { date: "2026-10-12", count: 0 },
    { date: "2026-10-16", count: 1 },
  ]);
  const flats = newlyObserved([a, b, c], o, {
    type: "apartment",
    municipality: "",
    days: 30,
    today: "2026-10-17",
  });
  assert.deepEqual(
    flats.added.map((x) => x.id),
    [a.id],
  );
  const week = newlyObserved([a, b, c], o, {
    type: "all",
    municipality: "",
    days: 7,
    today: "2026-10-17",
  });
  assert.deepEqual(
    week.added.map((x) => x.id),
    [c.id],
  );
});

test("price distribution respects filters, never uses unusable rows and warns on mixed groups", () => {
  const today = "2026-10-17";
  const rows = [
    ...Array.from({ length: 30 }, () => sale("2026-06-01", "2026-06-08")),
    ...Array.from({ length: 6 }, () =>
      sale("2026-06-01", "2026-06-08", {
        type: "house",
        area: 220,
        price: 150_000_000,
      }),
    ),
    sale("2026-06-01", "2026-06-08", { usable: false, price: 1 }),
  ].map((s) => ({ ...s, ppm: s.price / s.area }));
  const all = priceDistribution(
    rows,
    parseFilters(new URLSearchParams()),
    today,
    "price",
    70_000_000,
  );
  assert.equal(all.count, 36);
  assert.ok(all.warnings.includes("mixed_types"));
  assert.ok(all.warnings.includes("broad_area"));
  assert.ok(all.position);
  const flats = priceDistribution(
    rows,
    parseFilters(new URLSearchParams({ type: "apartment", postcode: "105" })),
    today,
    "ppm",
    null,
  );
  assert.equal(flats.count, 30);
  assert.deepEqual(flats.warnings, []);
  assert.equal(flats.position, null);
  const few = priceDistribution(
    rows,
    parseFilters(new URLSearchParams({ type: "house" })),
    today,
    "price",
    150_000_000,
  );
  assert.equal(few.count, 6);
  assert.equal(few.sparse, true);
  assert.equal(few.quartiles, null);
  assert.equal(few.position, null);
});
