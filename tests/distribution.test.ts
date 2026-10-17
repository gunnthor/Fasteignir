import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLE,
  histogram,
  percentileRank,
  quartiles,
  position,
  heterogeneity,
  distribution,
} from "../lib/distribution";
import { quantile } from "../lib/data";

// Deterministic pseudo-random values (LCG) so the tests are reproducible.
function values(n: number, centre = 70_000_000, spread = 20_000_000) {
  let seed = 42;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    const u = seed / 2 ** 31;
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    const w = seed / 2 ** 31;
    out.push(Math.round(centre + (u + w - 1) * spread * 2));
  }
  return out;
}

test("quantiles follow the documented type-7 definition", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([10, 20, 30, 40, 50], 0.75), 40);
  const v = values(25);
  const q = quartiles(v)!;
  assert.ok(q.p25 <= q.p50 && q.p50 <= q.p75);
  assert.equal(q.p50, quantile(v, 0.5));
});

test("percentile rank uses mid-ranks and handles ties", () => {
  assert.equal(percentileRank([1, 2, 3, 4], 2.5), 50);
  assert.equal(percentileRank([1, 2, 2, 3], 2), 50);
  assert.equal(percentileRank([5, 5, 5, 5], 5), 50);
  assert.equal(percentileRank([1, 2, 3, 4], 0), 0);
  assert.equal(percentileRank([1, 2, 3, 4], 9), 100);
  assert.equal(percentileRank([], 1), null);
});

test("sample-size thresholds: median ≥5, warning <10, detail ≥20", () => {
  const four = distribution(values(4), { minStep: 1e6 });
  assert.equal(four.suppressed, true);
  assert.equal(four.median, null);
  assert.equal(four.quartiles, null);
  assert.equal(four.bins, null);
  const nine = distribution(values(9), { minStep: 1e6, value: 7e7 });
  assert.equal(nine.suppressed, false);
  assert.equal(nine.sparse, true);
  assert.notEqual(nine.median, null);
  assert.equal(nine.quartiles, null);
  assert.equal(nine.position, null);
  assert.equal(nine.bins, null);
  const nineteen = distribution(values(19), { minStep: 1e6, value: 7e7 });
  assert.equal(nineteen.sparse, false);
  assert.equal(nineteen.detailed, false);
  assert.equal(nineteen.bins, null);
  const twenty = distribution(values(SAMPLE.distribution), {
    minStep: 1e6,
    value: 7e7,
  });
  assert.equal(twenty.detailed, true);
  assert.ok(twenty.quartiles);
  assert.ok(twenty.position);
});

test("histogram never exposes a bin with 1–4 sales and counts every sale", () => {
  for (const n of [20, 21, 33, 57, 140, 1000, 9000]) {
    const v = values(n),
      bins = histogram(v, { minStep: 1_000_000 })!;
    // Very small groups may have no safe layout; larger ones always do.
    if (!bins && n < 50) continue;
    assert.ok(bins, `bins for n=${n}`);
    assert.equal(
      bins.reduce((a, b) => a + b.count, 0),
      n,
    );
    for (const b of bins)
      assert.ok(b.count === 0 || b.count >= SAMPLE.cell, `n=${n}: ${b.count}`);
    assert.equal(bins[0].from, null);
    assert.equal(bins.at(-1)!.to, null);
    // Interior bins share one width, a multiple of the minimum step.
    const widths = new Set(bins.slice(1, -1).map((b) => b.to! - b.from!));
    assert.ok(widths.size <= 1);
    for (const w of widths) assert.ok(w >= 1_000_000);
    assert.ok(bins.length <= 21);
  }
});

test("histogram respects bin minimum and survives outliers and ties", () => {
  const v = [...values(40, 60e6, 1e5), 900e6, 1e6];
  const bins = histogram(v, { minStep: 1_000_000 });
  if (bins)
    for (const b of bins) assert.ok(b.count === 0 || b.count >= SAMPLE.cell);
  const same = new Array(30).fill(50e6);
  const flat = histogram(same, { minStep: 1_000_000 });
  if (flat) for (const b of flat) assert.ok(b.count === 0 || b.count >= 5);
  assert.equal(histogram(values(10), { minStep: 1e6 }), null);
});

test("position bands use quartiles", () => {
  const v = Array.from({ length: 40 }, (_, i) => (i + 1) * 1e6);
  assert.equal(position(v, 2e6)!.band, "low");
  assert.equal(position(v, 20e6)!.band, "typical");
  assert.equal(position(v, 39e6)!.band, "high");
  assert.equal(position(v, 0), null);
  assert.equal(position(v.slice(0, 10), 5e6), null);
});

test("heterogeneity warns about mixed types, size spread, long periods and broad areas", () => {
  const flats = Array.from({ length: 30 }, (_, i) => ({
    type: "apartment",
    area: 80 + (i % 5),
  }));
  assert.deepEqual(
    heterogeneity(flats, { metric: "price", days: 365, local: true }),
    [],
  );
  const mixed = [
    ...flats,
    ...Array.from({ length: 10 }, () => ({ type: "house", area: 250 })),
  ];
  const w = heterogeneity(mixed, { metric: "price", days: 2000, local: false });
  assert.deepEqual(w, [
    "mixed_types",
    "size_spread",
    "long_period",
    "broad_area",
  ]);
  assert.deepEqual(
    heterogeneity(flats.slice(0, 4), {
      metric: "ppm",
      days: 5000,
      local: false,
    }),
    [],
  );
});
