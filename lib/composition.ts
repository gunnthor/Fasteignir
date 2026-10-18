// Market composition: what sold in two periods, not what it cost.
//
// A descriptive comparison of the mix of eligible sales between two periods,
// with medians inside groups that are large enough. Group-level medians do not
// add up to the overall median, and nothing here estimates how much of the
// overall change is due to composition; this is not a mix-adjusted index.
// Isomorphic and pure (no snapshot access).
import { median } from "./data";
import { matches, shiftMonths, stats } from "./analytics";
import { SAMPLE } from "./sample";
import { numberIS } from "./format";
import type { Filters, Sale } from "./types";

// Group medians and changes need this many sales in a period (stricter than the
// overall median, which follows the usual 5/10 rule).
export const GROUP_MIN = SAMPLE.distribution;
// Below this many sales in a period, shares of a few percentage points are noise.
export const SMALL = 100;

export type Period = { from: string; to: string };
const DAY = 86400000;
const addDays = (d: string, n: number) =>
  new Date(+new Date(d) + n * DAY).toISOString().slice(0, 10);
export const days = (p: Period) =>
  Math.round((+new Date(p.to) - +new Date(p.from)) / DAY) + 1;

// The 12 months ending on `asOf` and the 12 months before them.
export function trailingPeriods(asOf: string): { a: Period; b: Period } {
  const bFrom = addDays(shiftMonths(asOf, -12), 1),
    aTo = addDays(bFrom, -1),
    aFrom = addDays(shiftMonths(aTo, -12), 1);
  return { a: { from: aFrom, to: aTo }, b: { from: bFrom, to: asOf } };
}
// Two calendar years; a year that has not ended stops at `asOf`.
export function yearPeriods(a: number, b: number, asOf: string) {
  const year = (y: number): Period => ({
    from: `${y}-01-01`,
    to: `${y}-12-31` < asOf ? `${y}-12-31` : asOf,
  });
  return { a: year(a), b: year(b) };
}

export type DimensionKey = "type" | "size" | "rooms" | "built" | "area";
type Group = { id: string; label: string };
type Dimension = {
  key: DimensionKey;
  label: string;
  groups: Group[];
  of: (s: Sale) => string;
};

const SIZE: [number, number, string][] = [
  [0, 50, "Undir 50 m²"],
  [50, 80, "50–80 m²"],
  [80, 110, "80–110 m²"],
  [110, 150, "110–150 m²"],
  [150, 200, "150–200 m²"],
  [200, Infinity, "200 m² og stærri"],
];
const BUILT: [number, number, string][] = [
  [0, 1950, "Fyrir 1950"],
  [1950, 1970, "1950–1969"],
  [1970, 1990, "1970–1989"],
  [1990, 2010, "1990–2009"],
  [2010, Infinity, "2010 og síðar"],
];
const band = (bands: [number, number, string][], v: number | null) =>
  v === null
    ? "unknown"
    : String(bands.findIndex(([lo, hi]) => v >= lo && v < hi));

export const DIMENSIONS: Record<Exclude<DimensionKey, "area">, Dimension> = {
  type: {
    key: "type",
    label: "Tegund eignar",
    groups: [
      { id: "apartment", label: "Fjölbýli" },
      { id: "house", label: "Sérbýli" },
    ],
    of: (s) => s.type,
  },
  size: {
    key: "size",
    label: "Stærð",
    groups: SIZE.map(([, , label], i) => ({ id: String(i), label })),
    of: (s) => band(SIZE, s.area),
  },
  rooms: {
    key: "rooms",
    label: "Herbergjafjöldi",
    groups: [
      ...[1, 2, 3, 4].map((n) => ({ id: String(n), label: `${n} herb.` })),
      { id: "5", label: "5 herb. eða fleiri" },
      { id: "unknown", label: "Óskráð" },
    ],
    of: (s) => (s.rooms === null ? "unknown" : String(Math.min(s.rooms, 5))),
  },
  built: {
    key: "built",
    label: "Byggingarár",
    groups: [
      ...BUILT.map(([, , label], i) => ({ id: String(i), label })),
      { id: "unknown", label: "Óskráð" },
    ],
    of: (s) => band(BUILT, s.built),
  },
};

// Geography one level below the selection: municipalities for the region,
// postcodes within a municipality; none inside a postcode or district.
function geography(f: Filters, rows: Sale[]): Dimension | null {
  if (f.postcode || f.district) return null;
  const by = f.municipality ? "postcode" : "municipality",
    labels = new Map<string, string>();
  for (const s of rows)
    labels.set(
      s[by],
      by === "postcode"
        ? `${s.postcode} ${s.municipalityName}`
        : s.municipalityName,
    );
  return {
    key: "area",
    label: by === "postcode" ? "Póstnúmer" : "Sveitarfélag",
    groups: [...labels]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, label]) => ({ id, label })),
    of: (s) => s[by],
  };
}

type Side = {
  count: number;
  share: number | null;
  ppm: number | null;
  price: number | null;
  area: number | null;
};
function side(sales: Sale[], total: number): Side {
  const n = sales.length,
    ok = n >= GROUP_MIN;
  return {
    count: n,
    share: total ? (n / total) * 100 : null,
    ppm: ok ? median(sales.map((s) => s.ppm)) : null,
    price: ok ? median(sales.map((s) => s.price)) : null,
    area: ok ? median(sales.map((s) => s.area)) : null,
  };
}
const change = (a: number | null, b: number | null) =>
  a && b ? (b / a - 1) * 100 : null;

export type GroupRow = {
  id: string;
  label: string;
  a: Side;
  b: Side;
  shareChange: number | null;
  ppmChange: number | null;
};
export type DimensionResult = {
  key: DimensionKey;
  label: string;
  rows: GroupRow[];
};

function tabulate(d: Dimension, A: Sale[], B: Sale[]): DimensionResult {
  const split = (sales: Sale[]) => {
    const m = new Map<string, Sale[]>();
    for (const s of sales) {
      const k = d.of(s),
        list = m.get(k) ?? [];
      list.push(s);
      m.set(k, list);
    }
    return m;
  };
  const ga = split(A),
    gb = split(B),
    known = new Set(d.groups.map((g) => g.id));
  // Every sale lands in exactly one listed group, so counts reconcile to totals.
  for (const k of [...ga.keys(), ...gb.keys()])
    if (!known.has(k)) throw Error(`Unlisted group ${d.key}:${k}`);
  const rows = d.groups
    .map((g) => {
      const a = side(ga.get(g.id) ?? [], A.length),
        b = side(gb.get(g.id) ?? [], B.length);
      return {
        id: g.id,
        label: g.label,
        a,
        b,
        shareChange:
          a.share !== null && b.share !== null ? b.share - a.share : null,
        ppmChange: change(a.ppm, b.ppm),
      };
    })
    // Empty "unknown" rows are noise; listed groups stay visible even when empty.
    .filter((r) => r.a.count + r.b.count > 0 || r.id !== "unknown");
  return { key: d.key, label: d.label, rows };
}

export type Composition = ReturnType<typeof composition>;

export function composition(
  rows: Sale[],
  f: Filters,
  periods: { a: Period; b: Period },
) {
  const scoped = rows.filter((s) => matches(s, f)),
    inP = (p: Period) =>
      scoped.filter((s) => s.date >= p.from && s.date <= p.to),
    A = inP(periods.a),
    B = inP(periods.b);
  const overall = { a: stats(A), b: stats(B) },
    // Same rule as elsewhere: a change needs 10 sales on both sides.
    overallChange =
      A.length >= SAMPLE.warn && B.length >= SAMPLE.warn
        ? change(overall.a.ppm, overall.b.ppm)
        : null;
  const dims = [
    DIMENSIONS.type,
    DIMENSIONS.size,
    DIMENSIONS.rooms,
    DIMENSIONS.built,
  ];
  const geo = geography(f, [...A, ...B]);
  if (geo) dims.push(geo);
  const dimensions = dims.map((d) => tabulate(d, A, B));
  // Comparable groups: type × size band, the closest thing to like-for-like the data allows.
  const cells: { label: string; a: number; b: number; ppmChange: number }[] =
    [];
  for (const t of DIMENSIONS.type.groups)
    for (const z of DIMENSIONS.size.groups) {
      const ca = A.filter(
          (s) => s.type === t.id && DIMENSIONS.size.of(s) === z.id,
        ),
        cb = B.filter((s) => s.type === t.id && DIMENSIONS.size.of(s) === z.id);
      if (ca.length >= GROUP_MIN && cb.length >= GROUP_MIN)
        cells.push({
          label: `${t.label}, ${z.label}`,
          a: ca.length,
          b: cb.length,
          ppmChange: change(
            median(ca.map((s) => s.ppm)),
            median(cb.map((s) => s.ppm)),
          )!,
        });
    }
  const lengthA = days(periods.a),
    lengthB = days(periods.b);
  return {
    periods,
    days: { a: lengthA, b: lengthB },
    overall,
    overallChange,
    dimensions,
    cells,
    warnings: [
      ...(Math.abs(lengthA - lengthB) > 3 ? ["unequal_length" as const] : []),
      ...(periods.a.to >= periods.b.from && periods.b.to >= periods.a.from
        ? ["overlap" as const]
        : []),
      ...(A.length < SAMPLE.warn || B.length < SAMPLE.warn
        ? ["sparse" as const]
        : A.length < SMALL || B.length < SMALL
          ? ["small_sample" as const]
          : []),
      // More than two years between the periods: nominal changes include general inflation.
      ...(+new Date(periods.b.from) - +new Date(periods.a.to) > 2 * 365.25 * DAY
        ? ["far_apart" as const]
        : []),
    ],
  };
}

const pct = (v: number, digits = 0) => `${numberIS(Math.abs(v), digits)}%`;
const signed = (v: number) =>
  `${Math.round(v * 10) > 0 ? "+" : Math.round(v * 10) < 0 ? "−" : ""}${numberIS(Math.abs(v), 1)}%`;
const pp = (v: number) => `${numberIS(Math.abs(v), 1)} prósentustig`;

// Plain-language summary in three parts: the overall observed median, the mix of
// what sold, and price movement within comparable groups. Descriptive only.
export function explain(c: Composition) {
  const out: { kind: "overall" | "mix" | "within" | "caveat"; text: string }[] =
    [];
  const { a, b } = c.overall;
  if (a.ppm === null || b.ppm === null)
    out.push({
      kind: "overall",
      text: "Of fáar sölur á öðru tímabilinu til að birta miðgildi verðs á m².",
    });
  else
    out.push({
      kind: "overall",
      text:
        `Miðgildi verðs á m² var ${numberIS(a.ppm / 1000)} þ.kr. á fyrra tímabilinu (${numberIS(a.count)} sölur) og ` +
        `${numberIS(b.ppm / 1000)} þ.kr. á því síðara (${numberIS(b.count)} sölur)` +
        (c.overallChange === null
          ? "."
          : `, sem er ${c.overallChange >= 0 ? "hækkun" : "lækkun"} um ${pct(c.overallChange, 1)} í nafnverði.`),
    });
  // Largest shifts in the mix, at least 3 percentage points.
  const shifts = c.dimensions
    .filter((d) => d.key !== "area")
    .flatMap((d) => d.rows.map((r) => ({ d, r })))
    .filter(
      ({ r }) =>
        r.shareChange !== null &&
        Math.abs(r.shareChange) >= 3 &&
        r.id !== "unknown",
    )
    .sort((x, y) => Math.abs(y.r.shareChange!) - Math.abs(x.r.shareChange!))
    .slice(0, 3);
  const mix: string[] = shifts.map(
    ({ d, r }) =>
      `${d.key === "type" ? `Hlutfall ${r.label === "Sérbýli" ? "sérbýla" : "fjölbýlis"}` : `Hlutfall sala í flokknum „${r.label}“ (${d.label.toLocaleLowerCase("is")})`} ` +
      `fór úr ${pct(r.a.share!)} í ${pct(r.b.share!)} (${r.shareChange! > 0 ? "+" : "−"}${pp(r.shareChange!)}).`,
  );
  if (
    a.area !== null &&
    b.area !== null &&
    Math.abs(b.area / a.area - 1) >= 0.02
  )
    mix.push(
      `Miðgildi stærðar seldra eigna fór úr ${numberIS(a.area)} í ${numberIS(b.area)} m².`,
    );
  out.push({
    kind: "mix",
    text: mix.length
      ? mix.join(" ") +
        " Þegar hlutfall stærri, nýrri eða dýrari eigna breytist getur heildarmiðgildið hreyfst án þess að verð sambærilegra eigna hafi breyst jafn mikið."
      : "Samsetning seldra eigna eftir tegund, stærð, herbergjafjölda og byggingarári var svipuð á báðum tímabilum (engin breyting yfir 3 prósentustigum).",
  });
  if (!c.cells.length)
    out.push({
      kind: "within",
      text: `Enginn sambærilegur hópur (tegund × stærð) hafði a.m.k. ${GROUP_MIN} sölur á báðum tímabilum, svo verðbreytingar innan hópa eru ekki birtar.`,
    });
  else {
    const changes = c.cells.map((x) => x.ppmChange),
      lo = Math.min(...changes),
      hi = Math.max(...changes),
      up = changes.filter((v) => v > 0).length,
      down = changes.filter((v) => v < 0).length;
    let text =
      `Í ${c.cells.length} ${c.cells.length === 1 ? "sambærilegum hópi" : "sambærilegum hópum"} (tegund × stærð) með a.m.k. ${GROUP_MIN} sölur á báðum tímabilum ` +
      (c.cells.length === 1
        ? `breyttist miðgildi á m² um ${signed(lo)}.`
        : hi - lo < 0.05
          ? `breyttist miðgildi á m² um ${signed(lo)} í þeim öllum.`
          : `breyttist miðgildi á m² um ${signed(lo)} til ${signed(hi)}; það hækkaði í ${up}, lækkaði í ${down}` +
            (c.cells.length - up - down
              ? ` og stóð í stað í ${c.cells.length - up - down}.`
              : "."));
    if (
      c.overallChange !== null &&
      (c.overallChange < lo - 0.5 || c.overallChange > hi + 0.5)
    )
      text +=
        " Heildarbreytingin er utan þess bils. Það getur endurspeglað breytta samsetningu, en líka það að miðgildi heildar er ekki meðaltal miðgilda hópa.";
    out.push({ kind: "within", text });
  }
  out.push({
    kind: "caveat",
    text:
      "Þetta er lýsandi samanburður á þinglýstum kaupsamningum, ekki verðvísitala og ekki leiðrétt fyrir samsetningu. " +
      "Hann sýnir ekki hversu stór hluti heildarbreytingarinnar stafar af samsetningu, breytingar innan hópa leggjast ekki saman í heildarbreytinguna, " +
      "og aðrir eiginleikar (staðsetning innan hverfis, ástand, útsýni) eru ekki í gögnunum.",
  });
  return out;
}
