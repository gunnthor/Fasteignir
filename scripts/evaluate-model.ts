/** Experimental ridge hedonic model. Never imported by application code. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { estimate, shiftMonths } from "../lib/analytics";
import { median } from "../lib/data";
import type { Sale } from "../lib/types";
async function main() {
  const audit = JSON.parse(
    gunzipSync(await readFile("data/processed/audit.json.gz")).toString(),
  ) as Sale[];
  const end = new Date().toISOString().slice(0, 7) + "-01",
    cutoff = shiftMonths(end, -12),
    start = shiftMonths(cutoff, -60);
  // Don't screen test targets with fences calculated from full-year outcomes.
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
  const train = rows.filter(
      (s) =>
        s.date >= start &&
        s.date < cutoff &&
        s.registered &&
        s.registered < cutoff,
    ),
    test = rows.filter((s) => s.date >= cutoff && s.date < end);
  if (train.length < 100 || test.length < 50)
    throw Error("Insufficient time-separated evaluation data");
  const postCounts = new Map<string, number>();
  for (const s of train)
    postCounts.set(s.postcode, (postCounts.get(s.postcode) ?? 0) + 1);
  const postcodes = [...postCounts]
    .filter(([, n]) => n >= 30)
    .map(([p]) => p)
    .sort()
    .slice(1);
  const municipalities = [...new Set(train.map((s) => s.municipality))]
    .sort()
    .slice(1);
  function features(s: Sale) {
    return [
      1,
      Math.log(s.area),
      s.rooms! / 5,
      (s.built! - 1980) / 50,
      (+new Date(s.date) - +new Date(start)) / 86400000 / 365.25,
      s.type === "house" ? 1 : 0,
      ...municipalities.map((m) => (s.municipality === m ? 1 : 0)),
      ...postcodes.map((p) => (s.postcode === p ? 1 : 0)),
    ];
  }
  const n = features(train[0]).length,
    A = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (const s of train) {
    const x = features(s),
      y = Math.log(s.price);
    for (let i = 0; i < n; i++) {
      A[i][n] += x[i] * y;
      for (let j = 0; j < n; j++) A[i][j] += x[i] * x[j];
    }
  }
  // Fixed ridge penalty (alpha=1), no test-set tuning. Intercept unpenalized.
  for (let i = 1; i < n; i++) A[i][i] += 1;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let j = col + 1; j < n; j++)
      if (Math.abs(A[j][col]) > Math.abs(A[pivot][col])) pivot = j;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    if (Math.abs(A[col][col]) < 1e-10) throw Error("Singular design");
    const divisor = A[col][col];
    for (let j = col; j <= n; j++) A[col][j] /= divisor;
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const factor = A[i][col];
      for (let j = col; j <= n; j++) A[i][j] -= factor * A[col][j];
    }
  }
  const beta = A.map((r) => r[n]),
    index = new Map<string, Sale[]>();
  for (const s of train) {
    const key = s.postcode + "|" + s.type;
    const a = index.get(key) ?? [];
    a.push(s);
    index.set(key, a);
  }
  const predictions = test.map((s) => {
    const baseline = estimate(
      (index.get(s.postcode + "|" + s.type) ?? []).filter(
        (t) => t.propertyId !== s.propertyId,
      ),
      {
        postcode: s.postcode,
        type: s.type as "house" | "apartment",
        area: s.area,
        rooms: s.rooms!,
        built: s.built!,
      },
      s.date,
    );
    return {
      id: s.id,
      date: s.date,
      area: s.municipalityName,
      type: s.type,
      band:
        s.price < 60000000
          ? "<60m"
          : s.price < 100000000
            ? "60–100m"
            : ">=100m",
      actual: s.price,
      hedonic: Math.exp(
        features(s).reduce((sum, x, i) => sum + x * beta[i], 0),
      ),
      baseline: baseline.available ? baseline.central : null,
      low: baseline.available ? baseline.low : null,
      high: baseline.available ? baseline.high : null,
    };
  });
  type Prediction = (typeof predictions)[number];
  function metrics(p: Prediction[], model: "hedonic" | "baseline") {
    const eligible = p.filter((x) => x[model] !== null);
    return {
      n: eligible.length,
      mae: eligible.length
        ? eligible.reduce((n, x) => n + Math.abs(x[model]! - x.actual), 0) /
          eligible.length
        : null,
      medianAbsolutePercentageError: median(
        eligible.map((x) => (Math.abs(x[model]! - x.actual) / x.actual) * 100),
      ),
    };
  }
  const paired = predictions.filter((p) => p.baseline !== null);
  const groups = (field: "area" | "type" | "band") =>
    Object.fromEntries(
      [...new Set(predictions.map((p) => p[field]))].map((key) => {
        const p = paired.filter((p) => p[field] === key);
        return [
          key,
          { hedonic: metrics(p, "hedonic"), baseline: metrics(p, "baseline") },
        ];
      }),
    );
  const result = {
    generatedAt: new Date().toISOString(),
    training: {
      from: start,
      toExclusive: cutoff,
      n: train.length,
      registrationCutoff: cutoff,
    },
    test: { from: cutoff, toExclusive: end, n: test.length },
    model:
      "Ridge regression of log(price), alpha=1; log(area), rooms, build year, sale date, property type, municipality and postcode",
    baseline:
      "Same-postcode comparable sales; fixed training snapshot, no future training transactions, subject property excluded",
    hedonicAll: metrics(predictions, "hedonic"),
    paired: {
      n: paired.length,
      hedonic: metrics(paired, "hedonic"),
      baseline: metrics(paired, "baseline"),
    },
    baselineCoverage: paired.length / test.length,
    empiricalIntervalCoverage: paired.length
      ? paired.filter((p) => p.actual >= p.low! && p.actual <= p.high!).length /
        paired.length
      : null,
    byArea: groups("area"),
    byType: groups("type"),
    byPriceBand: groups("band"),
    deployed: false,
    limitations: [
      "One holdout period, no hyperparameter tuning or rolling-origin validation.",
      "Source is a present-day revised snapshot, not a historical as-known archive. Registration cutoff reduces but cannot eliminate revision hindsight.",
      "Fixed training snapshot makes comparables older toward holdout end.",
      "Missing rooms/build-year targets excluded. No outcome-dependent full-dataset tail filtering.",
      "Paired comparison reports only properties where baseline can return a result.",
      "No public production hedonic model promotion; independent validation still needed.",
    ],
  };
  await mkdir("data/evaluation", { recursive: true });
  await writeFile(
    "data/evaluation/hedonic.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        training: result.training,
        test: result.test,
        paired: result.paired,
        baselineCoverage: result.baselineCoverage,
        empiricalIntervalCoverage: result.empiricalIntervalCoverage,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
