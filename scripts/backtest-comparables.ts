/**
 * Rolling-origin backtest of the production comparable-sales estimator.
 * Evaluates the unchanged method at each supported lookback; it does not fit,
 * tune or deploy a new pricing model.
 *
 * For each of the last eight complete quarters, comparables are limited to
 * contracts registered before the quarter began (what Fasteign could have
 * known then); every eligible sale signed in the quarter is a test case, with
 * its own property excluded and the estimate made as of its signature date.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { estimate, shiftMonths, LOOKBACKS } from "../lib/analytics";
import { median } from "../lib/data";
import type { Sale } from "../lib/types";

type Result = {
  lookback: number;
  quarter: string;
  type: string;
  actual: number;
  central: number | null;
  low: number | null;
  high: number | null;
};

function metrics(results: Result[]) {
  const ok = results.filter((r) => r.central !== null),
    ape = ok.map((r) => (Math.abs(r.central! - r.actual) / r.actual) * 100),
    signed = ok.map((r) => ((r.central! - r.actual) / r.actual) * 100);
  return {
    tested: results.length,
    estimated: ok.length,
    availability: results.length ? ok.length / results.length : null,
    medianAbsolutePercentageError: median(ape),
    within10Percent: ok.length
      ? ape.filter((e) => e <= 10).length / ok.length
      : null,
    within20Percent: ok.length
      ? ape.filter((e) => e <= 20).length / ok.length
      : null,
    // Positive: estimates above the eventual price.
    medianSignedPercentageError: median(signed),
    // Share of actual prices inside the displayed 10th–90th comparable band.
    // A calibrated 80 % interval would give about 0.8.
    bandCoverage: ok.length
      ? ok.filter((r) => r.actual >= r.low! && r.actual <= r.high!).length /
        ok.length
      : null,
  };
}

async function main() {
  const audit = JSON.parse(
    gunzipSync(await readFile("data/processed/audit.json.gz")).toString(),
  ) as Sale[];
  // Same eligibility as production, except outcome-dependent tail screening is
  // not applied to test targets (it uses full-year information).
  const rows = audit
    .filter(
      (s) =>
        s.capital &&
        s.residential &&
        s.reasons.every((r) => r === "extreme_local_ppm") &&
        s.built &&
        s.rooms,
    )
    .map((s) => ({ ...s, usable: true }));
  const latest = rows.reduce((a, s) => (s.date > a ? s.date : a), "");
  // Last complete quarter before the latest contract month.
  const month = Number(latest.slice(5, 7)),
    end = `${latest.slice(0, 4)}-${String(month - ((month - 1) % 3)).padStart(2, "0")}-01`;
  const quarters: string[] = [];
  for (let i = 8; i >= 1; i--) quarters.push(shiftMonths(end, -3 * i));
  const results: Result[] = [];
  for (const start of quarters) {
    const stop = shiftMonths(start, 3),
      known = rows.filter(
        (s) => s.registered && s.registered < start && !s.reasons.length,
      ),
      test = rows.filter((s) => s.date >= start && s.date < stop);
    for (const lookback of LOOKBACKS)
      for (const s of test) {
        const r = estimate(
          known,
          {
            propertyId: s.propertyId,
            postcode: s.postcode,
            type: s.type as "apartment" | "house",
            area: s.area,
            rooms: s.rooms!,
            built: s.built!,
          },
          s.date,
          { lookback },
        );
        results.push({
          lookback,
          quarter: start.slice(0, 7),
          type: s.type,
          actual: s.price,
          central: r.available ? r.central : null,
          low: r.available ? r.low : null,
          high: r.available ? r.high : null,
        });
      }
    console.error(`${start}: ${test.length} test sales`);
  }
  const byLookback = Object.fromEntries(
    LOOKBACKS.map((l) => [l, metrics(results.filter((r) => r.lookback === l))]),
  );
  const at = (l: number, key: "quarter" | "type") =>
    Object.fromEntries(
      [...new Set(results.map((r) => r[key]))].map((k) => [
        k,
        metrics(results.filter((r) => r.lookback === l && r[key] === k)),
      ]),
    );
  const output = {
    generatedAt: new Date().toISOString(),
    method:
      "Production comparable-sales estimator (lib/analytics estimate), unchanged weights; rolling quarterly origins",
    quarters: quarters.map((q) => q.slice(0, 7)),
    knowledgeCutoff:
      "Comparables registered before the first day of each test quarter",
    testSet:
      "Capital Region apartments and houses signed in the quarter, HMS-suitable, complete, single-property, with rooms and build year; no outcome-based tail screening",
    byLookback,
    defaultLookback: {
      byQuarter: at(24, "quarter"),
      byType: at(24, "type"),
    },
    limitations: [
      "The HMS file is today's revised snapshot, not an archive of what was published at each origin; registration-date cutoffs reduce but do not remove hindsight.",
      "Test sales use their recorded attributes; real users may enter different or wrong attributes.",
      "Errors are relative to registered contract prices, which may themselves include unusual terms.",
      "Eight quarters of one market cycle; performance can differ in other conditions.",
    ],
  };
  await mkdir("data/evaluation", { recursive: true });
  await writeFile(
    "data/evaluation/comparables.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(JSON.stringify(byLookback, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
