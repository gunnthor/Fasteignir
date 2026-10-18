import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "../lib/csv";
import { chartSvg, niceTicks } from "../lib/export-svg";
import {
  areasCsv,
  distributionCsv,
  distributionSvg,
  fileName,
  trendCsv,
  trendSvg,
  type ExportContext,
  type TrendRow,
} from "../lib/exports";
import { stats } from "../lib/analytics";
import type { AreaStats } from "../lib/types";
import { sale } from "./fixtures/sales";

const ctx: ExportContext = {
  area: "Grafarholt-Úlfarsárd. & Þingholt",
  from: "2025-10-18",
  to: "2026-10-18",
  filters: ["Fjölbýli", "3 herbergi"],
  downloadedAt: "2026-10-17T00:39:46.926Z",
  count: 7,
  incomplete: ["2026-09", "2026-10"],
};
// Split a CSV body (after metadata) into rows of cells, honouring quotes.
function parse(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    q = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (q) {
      if (ch === '"' && csv[i + 1] === '"') ((cell += '"'), i++);
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ";") (row.push(cell), (cell = ""));
    else if (ch === "\r" && csv[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      ((row = []), (cell = ""), i++);
    } else cell += ch;
  }
  return rows;
}
const body = (csv: string) =>
  parse(csv.replace(/^﻿/, "")).filter((r) => !r[0].startsWith("#"));

test("CSV cells: quoting, decimal comma, empty for missing, formula guard", () => {
  assert.equal(csvCell('Gata "5"; íbúð'), '"Gata ""5""; íbúð"');
  assert.equal(csvCell("lína\r\nönnur"), '"lína\nönnur"');
  assert.equal(csvCell(1234.56, 1), "1234,6");
  assert.equal(csvCell(850000), "850000");
  assert.equal(csvCell(-2.5, 1), "-2,5");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(Number.NaN), "");
  for (const evil of ["=HYPERLINK(1)", "+1", "-1+2", "@SUM(A1)", "\tx"])
    assert.ok(csvCell(evil).replace(/^"/, "").startsWith("'"), evil);
  assert.equal(csvCell("Þórsgata ÆÖ"), "Þórsgata ÆÖ");
  assert.equal(csvCell(" bil"), '" bil"');
});

test("CSV files carry BOM, metadata comments, CRLF and Icelandic text", () => {
  const csv = toCsv({
    meta: [["Svæði", 'Miðborg; "gamli"\nbær']],
    columns: [
      { key: "a", label: "Fjöldi; sölur", value: (r: { a: number }) => r.a },
    ],
    rows: [{ a: 3 }],
  });
  assert.ok(csv.startsWith("﻿# Svæði: Miðborg, 'gamli' bær\r\n"));
  assert.ok(csv.endsWith("\r\n"));
  assert.deepEqual(body(csv), [["Fjöldi; sölur"], ["3"]]);
});

const trendRow = (month: string, n: number, ppm: number | null): TrendRow => ({
  month,
  volume: n,
  ...stats(
    Array.from({ length: n }, () =>
      sale(`${month}-15`, { price: 50_000_000, area: 80 }),
    ),
  ),
  ...(ppm === null ? {} : { ppm }),
});

test("trend CSV never shows a median for windows under 5 sales, even if given one", () => {
  const rows = [trendRow("2026-08", 3, 999_999), trendRow("2026-09", 12, null)];
  assert.equal(rows[0].ppm, 999_999);
  const csv = trendCsv(rows, ctx),
    [head, a, b] = body(csv);
  assert.equal(head[0], "Mánuður");
  assert.deepEqual(
    [a[0], a[1], a[2], a[4], a[5], a[7]],
    ["2026-08", "", "", "3", "já", ""],
  );
  assert.deepEqual(
    [b[1], b[2], b[4], b[5], b[7]],
    ["625000", "50000000", "12", "", "já"],
  );
  assert.ok(csv.includes("# Ófullgerðir mánuðir: 2026-09, 2026-10"));
  assert.ok(csv.includes("# Heimild: HMS — Kaupskrá fasteigna"));
  assert.ok(csv.includes("# Gögn sótt: 2026-10-17"));
  assert.ok(csv.includes("Ekki opinber verðvísitala"));
});

test("area CSV shows changes only with 10 sales in both periods", () => {
  const area = (count: number, previousCount: number): AreaStats => ({
    ...stats([]),
    id: "107",
    name: "107 Reykjavík",
    kind: "postcode",
    count,
    ppm: count >= 5 ? 900_000 : 123,
    price: count >= 5 ? 70_000_000 : 1,
    previousCount,
    change: 4.25,
  });
  const [, small, prior, ok] = body(
    areasCsv([area(4, 30), area(30, 8), area(30, 30)], ctx, "Póstnúmer"),
  );
  assert.deepEqual([small[2], small[3], small[4], small[6]], ["4", "", "", ""]);
  assert.equal(prior[6], "");
  assert.equal(ok[6], "4,3");
});

test("distribution exports respect the 5/20 thresholds and the small-cell rule", () => {
  const bins = [
    { from: null, to: 50e6, count: 6, share: 24 },
    { from: 50e6, to: 60e6, count: 0, share: 0 },
    { from: 60e6, to: null, count: 19, share: 76 },
  ];
  const full = {
    metric: "price" as const,
    count: 25,
    median: 55e6,
    quartiles: { p25: 45e6, p50: 55e6, p75: 65e6 },
    bins,
  };
  const rows = body(distributionCsv(full, ctx));
  assert.deepEqual(
    rows.slice(1).map((r) => r[0]),
    [
      "Miðgildi",
      "25. hundraðshluti",
      "75. hundraðshluti",
      "Bil undir 50 m.kr.",
      "Bil 50–60 m.kr.",
      "Bil 60 og yfir m.kr.",
    ],
  );
  // A bin holding 1–4 sales must never be exported.
  const unsafe = { ...full, bins: [{ ...bins[0], count: 3 }, bins[2]] };
  assert.equal(
    body(distributionCsv(unsafe, ctx)).some((r) => r[0].startsWith("Bil")),
    false,
  );
  const medianOnly = { ...full, count: 12, quartiles: null, bins: null };
  assert.deepEqual(
    body(distributionCsv(medianOnly, ctx))
      .slice(1)
      .map((r) => r[0]),
    ["Miðgildi"],
  );
  assert.equal(body(distributionCsv({ ...full, count: 4 }, ctx)).length, 1);
  assert.equal(distributionSvg({ ...full, count: 12 }, ctx), null);
  assert.match(
    distributionSvg(full, ctx)!,
    /miðgildi 55 · 75. hundraðshluti 65 m.kr./,
  );
});

function wellFormed(xml: string) {
  assert.doesNotMatch(xml, /&(?!(amp|lt|gt|quot|apos);)/);
  const stack: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2]);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
}

test("chart SVG is standalone, escaped and labelled with source, period, n and warnings", () => {
  const rows = [
    trendRow("2026-07", 12, null),
    trendRow("2026-08", 2, null),
    trendRow("2026-09", 12, null),
    trendRow("2026-10", 12, null),
  ];
  const svg = trendSvg(rows, "ppm", ctx);
  wellFormed(svg);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(
    svg.includes("Söluverð á fermetra · Grafarholt-Úlfarsárd. &amp; Þingholt"),
  );
  assert.ok(svg.includes("18. okt. 2025 – 18. okt. 2026"));
  assert.ok(svg.includes("Fjölbýli · 3 herbergi"));
  assert.ok(svg.includes("7 gildar sölur á tímabilinu"));
  assert.ok(svg.includes("Kaupskrá fasteigna"));
  assert.ok(svg.includes("Gögn sótt 17. okt. 2026"));
  assert.ok(svg.includes("Líklega ófullgerðir mánuðir: 2026-09, 2026-10"));
  assert.ok(svg.includes("Fáar sölur"));
  // The suppressed August window breaks the line rather than being interpolated.
  const path = /<path d="([^"]+)"/.exec(svg)![1];
  assert.equal(path.match(/M/g)!.length, 2);
  assert.ok(svg.includes('fill="#ffffff"'));
  assert.ok(trendSvg(rows, "ppm", ctx, "dark").includes('fill="#1c2b25"'));
  const bars = trendSvg(rows, "volume", ctx);
  assert.equal(bars.match(/<rect x="[\d.]+" y=/g)!.length, 4);
});

test("tick values are round and cover the data", () => {
  const t = niceTicks(612_000, 988_000);
  assert.ok(t[0] <= 612_000 && t.at(-1)! >= 988_000);
  assert.deepEqual(niceTicks(0, 10), [0, 2, 4, 6, 8, 10]);
  assert.ok(niceTicks(5, 5).length >= 2);
  const svg = chartSvg({
    kind: "line",
    title: "T",
    subtitle: [],
    unit: "u",
    labels: [],
    series: [{ name: "a", values: [] }],
    footer: [],
    format: String,
  });
  wellFormed(svg);
});

test("file names are ASCII and include area, dataset and dates", () => {
  assert.equal(
    fileName(ctx, "verd-m2", "png"),
    "fasteign-grafarholt-ulfarsard-thingholt-verd-m2-2025-10-18_2026-10-18.png",
  );
});
