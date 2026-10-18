// Export builders: CSV tables and SVG charts from the aggregates a page already
// shows. Isomorphic and pure. Inputs come from server statistics that apply the
// sample rules; the builders re-apply them defensively so an export can never
// carry a price the interface would hide.
import { toCsv, type Column } from "./csv";
import { chartSvg, type Theme } from "./export-svg";
import { date, num, numberIS, strings } from "./format";
import { SAMPLE } from "./sample";
import { NOMINAL_CAVEAT } from "./share";
import type { AreaStats, Stats } from "./types";
import type { Bin } from "./distribution";
import type { Composition } from "./composition";

export type ExportContext = {
  // Area label, e.g. "Póstnúmer 107".
  area: string;
  from: string;
  to: string;
  // Active non-geographic filters (lib/share filterSummary).
  filters: string[];
  downloadedAt: string;
  // Eligible sales behind the whole view.
  count: number;
  // Contract months probably not fully registered yet.
  incomplete?: string[];
};

export const SOURCE = `Heimild: HMS — Kaupskrá fasteigna (þinglýstir kaupsamningar), unnið af Fasteign`;
const range = (c: ExportContext) => `${date(c.from)} – ${date(c.to)}`;
const shown = (n: number, v: number | null) => (n >= SAMPLE.median ? v : null);

export function meta(
  c: ExportContext,
  title: string,
  method: string,
): [string, string][] {
  return [
    ["Fasteign", title],
    ["Svæði", c.area],
    ["Tímabil", range(c)],
    ["Síur", c.filters.join(", ") || "engar"],
    [
      "Heimild",
      "HMS — Kaupskrá fasteigna (þinglýstir kaupsamningar), unnið af Fasteign",
    ],
    ["Gögn sótt", c.downloadedAt.slice(0, 10)],
    ["Aðferð", method],
    ["Fyrirvari", NOMINAL_CAVEAT],
    [
      "Úrtak",
      `Miðgildi eru ekki birt (tómur reitur) þegar færri en ${SAMPLE.median} sölur liggja að baki; færri en ${SAMPLE.warn} sölur eru merktar.`,
    ],
    ...(c.incomplete?.length
      ? ([
          [
            "Ófullgerðir mánuðir",
            `${c.incomplete.join(", ")}: samningum er enn að bætast við vegna þinglýsingartíma`,
          ],
        ] as [string, string][])
      : []),
    [
      "Snið",
      "UTF-8, semíkomma skilur dálka, komma er tugabrot, verð í krónum (ISK)",
    ],
  ];
}

export function footer(
  c: ExportContext,
  method: string,
  warnings: string[] = [],
) {
  return [
    `${num(c.count)} gildar sölur á tímabilinu · ${method}`,
    `${SOURCE} · Gögn sótt ${date(c.downloadedAt)}`,
    NOMINAL_CAVEAT,
    ...(c.incomplete?.length
      ? [
          `Líklega ófullgerðir mánuðir: ${c.incomplete.join(", ")} (samningar enn að bætast við).`,
        ]
      : []),
    ...(c.count < SAMPLE.warn ? [strings.sparse] : []),
    ...warnings,
  ];
}

export const fileName = (c: ExportContext, what: string, ext: string) =>
  `fasteign-${c.area
    .toLocaleLowerCase("is")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/æ/g, "ae")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${what}-${c.from}_${c.to}.${ext}`;

// Monthly series from lib/explore monthlyTrend.
export type TrendRow = { month: string; volume: number } & Stats;
export type TrendKind = "ppm" | "volume" | "area";
const ROLLING =
  "3 mánaða hlaupandi miðgildi; gluggi með færri en 5 sölum er ekki sýndur";

export function trendCsv(trend: TrendRow[], c: ExportContext) {
  const columns: Column<TrendRow>[] = [
    { key: "month", label: "Mánuður", value: (r) => r.month },
    {
      key: "ppm",
      label: "Miðgildi verðs á m² (kr., 3 mán. gluggi)",
      value: (r) => shown(r.count, r.ppm),
    },
    {
      key: "price",
      label: "Miðgildi kaupverðs (kr., 3 mán. gluggi)",
      value: (r) => shown(r.count, r.price),
    },
    {
      key: "area",
      label: "Miðgildi stærðar (m², 3 mán. gluggi)",
      value: (r) => shown(r.count, r.area),
      digits: 1,
    },
    { key: "count", label: "Sölur í 3 mán. glugga", value: (r) => r.count },
    {
      key: "sparse",
      label: "Færri en 10 sölur í glugga",
      value: (r) => (r.count < SAMPLE.warn ? "já" : ""),
    },
    { key: "volume", label: "Sölur í mánuði", value: (r) => r.volume },
    {
      key: "incomplete",
      label: "Líklega ófullgerður mánuður",
      value: (r) => (c.incomplete?.includes(r.month) ? "já" : ""),
    },
  ];
  return toCsv({
    meta: meta(c, "Mánaðarleg þróun", ROLLING),
    columns,
    rows: trend,
  });
}

const TREND = {
  ppm: {
    title: "Söluverð á fermetra",
    unit: "þ.kr./m²",
    value: (r: TrendRow) => shown(r.count, r.ppm),
    scale: 1e3,
    method: ROLLING,
  },
  area: {
    title: "Stærð seldra íbúða",
    unit: "m²",
    value: (r: TrendRow) => shown(r.count, r.area),
    scale: 1,
    method: ROLLING,
  },
  volume: {
    title: "Fjöldi kaupsamninga",
    unit: "sölur á mánuði",
    value: (r: TrendRow) => r.volume,
    scale: 1,
    method: "Fjöldi gildra kaupsamninga eftir mánuði undirritunar",
  },
} as const;

export function trendSvg(
  trend: TrendRow[],
  kind: TrendKind,
  c: ExportContext,
  theme: Theme = "light",
) {
  const t = TREND[kind];
  return chartSvg({
    kind: kind === "volume" ? "bar" : "line",
    title: `${t.title} · ${c.area}`,
    subtitle: [range(c), c.filters.join(" · ")].filter(Boolean),
    unit: t.unit,
    labels: trend.map((r) => r.month.slice(2).replace("-", "/")),
    series: [
      {
        name: t.title,
        values: trend.map((r) => {
          const v = t.value(r);
          return v === null ? null : v / t.scale;
        }),
      },
    ],
    footer: footer(c, t.method),
    format: (v) => numberIS(v),
    zero: kind === "volume",
    theme,
  });
}

export function areasCsv(areas: AreaStats[], c: ExportContext, title: string) {
  const columns: Column<AreaStats>[] = [
    { key: "name", label: "Svæði", value: (a) => a.name },
    { key: "id", label: "Auðkenni", value: (a) => a.id },
    { key: "count", label: "Sölur", value: (a) => a.count },
    {
      key: "ppm",
      label: "Miðgildi verðs á m² (kr.)",
      value: (a) => shown(a.count, a.ppm),
    },
    {
      key: "price",
      label: "Miðgildi kaupverðs (kr.)",
      value: (a) => shown(a.count, a.price),
    },
    {
      key: "area",
      label: "Miðgildi stærðar (m²)",
      value: (a) => shown(a.count, a.area),
      digits: 1,
    },
    // Same rule as the page: a change needs 10 sales in both periods.
    {
      key: "change",
      label: "Breyting miðgildis á m² frá fyrra tímabili (%)",
      value: (a) =>
        a.count >= SAMPLE.warn && a.previousCount >= SAMPLE.warn
          ? a.change
          : null,
      digits: 1,
    },
    {
      key: "previousCount",
      label: "Sölur á fyrra tímabili",
      value: (a) => a.previousCount,
    },
    {
      key: "sparse",
      label: "Færri en 10 sölur",
      value: (a) => (a.count < SAMPLE.warn ? "já" : ""),
    },
  ];
  return toCsv({
    meta: meta(
      c,
      title,
      "Miðgildi gildra kaupsamninga á tímabilinu; breyting miðað við jafn langt tímabil á undan. Breyting endurspeglar líka breytta samsetningu seldra eigna.",
    ),
    columns,
    rows: areas,
  });
}

// Distribution panel (lib/price-distribution) for total price or price/m².
export type DistributionExport = {
  metric: "price" | "ppm";
  count: number;
  median: number | null;
  quartiles: { p25: number; p50: number; p75: number } | null;
  bins: Bin[] | null;
};
const DIST = {
  price: { unit: "m.kr.", scale: 1e6, digits: 1, name: "kaupverðs" },
  ppm: { unit: "þ.kr./m²", scale: 1e3, digits: 0, name: "verðs á m²" },
} as const;
export function binLabel(metric: "price" | "ppm", b: Bin) {
  const s = (v: number) =>
    numberIS(v / DIST[metric].scale, DIST[metric].digits);
  if (b.from === null) return `undir ${s(b.to!)}`;
  if (b.to === null) return `${s(b.from)} og yfir`;
  return `${s(b.from)}–${s(b.to)}`;
}
const DIST_METHOD = `Súlur víkkaðar þar til engin geymir 1–${SAMPLE.cell - 1} sölur; hundraðshlutar frá ${SAMPLE.distribution} sölum (línuleg brúun, R/NumPy type 7)`;

export function distributionCsv(d: DistributionExport, c: ExportContext) {
  type Row = {
    label: string;
    from: number | null;
    to: number | null;
    count: number | null;
    share: number | null;
  };
  const detailed = d.count >= SAMPLE.distribution,
    rows: Row[] = [
      ...(d.count >= SAMPLE.median
        ? [
            {
              label: "Miðgildi",
              from: d.median,
              to: null,
              count: d.count,
              share: null,
            },
          ]
        : []),
      ...(detailed && d.quartiles
        ? [
            {
              label: "25. hundraðshluti",
              from: d.quartiles.p25,
              to: null,
              count: null,
              share: null,
            },
            {
              label: "75. hundraðshluti",
              from: d.quartiles.p75,
              to: null,
              count: null,
              share: null,
            },
          ]
        : []),
      // Bins are only produced when every bin is safe; re-check anyway.
      ...(detailed &&
      d.bins &&
      d.bins.every((b) => b.count === 0 || b.count >= SAMPLE.cell)
        ? d.bins.map((b) => ({
            label: `Bil ${binLabel(d.metric, b)} ${DIST[d.metric].unit}`,
            from: b.from,
            to: b.to,
            count: b.count,
            share: b.share,
          }))
        : []),
    ];
  return toCsv({
    meta: meta(c, `Dreifing ${DIST[d.metric].name}`, DIST_METHOD),
    columns: [
      { key: "label", label: "Lína", value: (r) => r.label },
      { key: "from", label: "Gildi / neðri mörk (kr.)", value: (r) => r.from },
      { key: "to", label: "Efri mörk (kr., ekki með)", value: (r) => r.to },
      { key: "count", label: "Sölur", value: (r) => r.count },
      { key: "share", label: "Hlutfall (%)", value: (r) => r.share, digits: 1 },
    ],
    rows,
  });
}

export function distributionSvg(
  d: DistributionExport,
  c: ExportContext,
  theme: Theme = "light",
) {
  const bins = d.count >= SAMPLE.distribution ? d.bins : null;
  if (!bins) return null;
  const q = d.quartiles,
    u = DIST[d.metric],
    f = (v: number) => numberIS(v / u.scale, u.digits);
  return chartSvg({
    kind: "bar",
    title: `Dreifing ${DIST[d.metric].name} · ${c.area}`,
    subtitle: [range(c), c.filters.join(" · ")].filter(Boolean),
    unit: `sölur á bili (${DIST[d.metric].unit})`,
    labels: bins.map((b) => binLabel(d.metric, b)),
    series: [{ name: "Sölur", values: bins.map((b) => b.count) }],
    footer: footer(
      c,
      DIST_METHOD,
      q
        ? [
            `25. hundraðshluti ${f(q.p25)} · miðgildi ${f(q.p50)} · 75. hundraðshluti ${f(q.p75)} ${u.unit}`,
          ]
        : [],
    ),
    format: (v) => numberIS(v),
    zero: true,
    theme,
  });
}

// Market composition (lib/composition): one row per dimension and group.
export function compositionCsv(c: Composition, ctx: ExportContext) {
  type Row = {
    dimension: string;
    group: string;
    r: Composition["dimensions"][number]["rows"][number];
  };
  const rows: Row[] = c.dimensions.flatMap((d) =>
    d.rows.map((r) => ({ dimension: d.label, group: r.label, r })),
  );
  const p = c.periods;
  return toCsv({
    meta: [
      ...meta(
        { ...ctx, from: p.a.from, to: p.b.to },
        "Samsetning seldra eigna á tveimur tímabilum",
        `Fyrra tímabil ${p.a.from} – ${p.a.to}, síðara ${p.b.from} – ${p.b.to}. Hlutföll af gildum sölum hvers tímabils; miðgildi innan hópa aðeins með a.m.k. ${SAMPLE.distribution} sölum. Lýsandi samanburður, ekki leiðrétt fyrir samsetningu; breytingar innan hópa leggjast ekki saman í heildarbreytingu.`,
      ),
    ],
    columns: [
      { key: "dimension", label: "Flokkun", value: (x) => x.dimension },
      { key: "group", label: "Hópur", value: (x) => x.group },
      {
        key: "aCount",
        label: "Sölur, fyrra tímabil",
        value: (x) => x.r.a.count,
      },
      {
        key: "bCount",
        label: "Sölur, síðara tímabil",
        value: (x) => x.r.b.count,
      },
      {
        key: "aShare",
        label: "Hlutfall, fyrra (%)",
        value: (x) => x.r.a.share,
        digits: 1,
      },
      {
        key: "bShare",
        label: "Hlutfall, síðara (%)",
        value: (x) => x.r.b.share,
        digits: 1,
      },
      {
        key: "shareChange",
        label: "Breyting hlutfalls (prósentustig)",
        value: (x) => x.r.shareChange,
        digits: 1,
      },
      {
        key: "aPpm",
        label: "Miðgildi á m², fyrra (kr.)",
        value: (x) => (x.r.a.count >= SAMPLE.distribution ? x.r.a.ppm : null),
      },
      {
        key: "bPpm",
        label: "Miðgildi á m², síðara (kr.)",
        value: (x) => (x.r.b.count >= SAMPLE.distribution ? x.r.b.ppm : null),
      },
      {
        key: "ppmChange",
        label: "Breyting miðgildis á m² innan hóps (%)",
        value: (x) =>
          x.r.a.count >= SAMPLE.distribution &&
          x.r.b.count >= SAMPLE.distribution
            ? x.r.ppmChange
            : null,
        digits: 1,
      },
    ],
    rows,
  });
}

export function compositionSvg(
  c: Composition,
  key: Composition["dimensions"][number]["key"],
  ctx: ExportContext,
  theme: Theme = "light",
) {
  const d = c.dimensions.find((x) => x.key === key);
  if (
    !d ||
    c.overall.a.count < SAMPLE.median ||
    c.overall.b.count < SAMPLE.median
  )
    return null;
  const p = c.periods,
    label = (x: Period) => `${date(x.from)} – ${date(x.to)}`;
  return chartSvg({
    kind: "bar",
    title: `Samsetning seldra eigna: ${d.label.toLocaleLowerCase("is")} · ${ctx.area}`,
    subtitle: [
      `Fyrra: ${label(p.a)} (${num(c.overall.a.count)} sölur) · Síðara: ${label(p.b)} (${num(c.overall.b.count)} sölur)`,
      ctx.filters.join(" · "),
    ].filter(Boolean),
    unit: "% af gildum sölum tímabils",
    labels: d.rows.map((r) => r.label),
    series: [
      { name: "Fyrra tímabil", values: d.rows.map((r) => r.a.share) },
      { name: "Síðara tímabil", values: d.rows.map((r) => r.b.share) },
    ],
    footer: [
      `Hlutföll af gildum kaupsamningum hvors tímabils. Lýsandi samanburður, ekki verðvísitala; sýnir ekki hve mikið samsetning skýrir af breytingu miðgildis.`,
      `${SOURCE} · Gögn sótt ${date(ctx.downloadedAt)}`,
      ...(ctx.incomplete?.length
        ? [`Líklega ófullgerðir mánuðir: ${ctx.incomplete.join(", ")}.`]
        : []),
    ],
    format: (v) => `${numberIS(v)}%`,
    zero: true,
    theme,
  });
}
type Period = Composition["periods"]["a"];
