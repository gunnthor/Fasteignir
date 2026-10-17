// Property sales history (Sölusaga). Built at ingestion, looked up per FASTNUM.
//
// FASTNUM identifies a registered property, but not necessarily an unchanged
// unit: HMS records show unit codes (FEPILOG), floor areas and property types
// changing within one FASTNUM. Each recorded contract keeps the flags that
// explain whether its price can be compared with the previous one.
import type { Sale } from "./types";

export type HistoryEntry = {
  id: string; // FAERSLUNUMER
  date: string; // contract signature (UTGDAG)
  registered: string | null; // official registration (THINGLYSTDAGS)
  price: number; // whole-contract price, nominal ISK
  area: number;
  rooms: number | null;
  built: number | null;
  type: Sale["type"];
  unitCode: string; // FEPILOG verbatim
  valuation: number | null;
  // Other FASTNUMs in the same contract: the price covers them too.
  bundle: number;
  bundleTypes: string[];
  unsuitable: boolean; // HMS: contract not suitable for price statistics
  incomplete: boolean; // property not complete (FULLBUID ≠ 1)
  extreme: boolean; // outside local price/m² fences
  duplicates: string[]; // other FAERSLUNUMER with same date and price
  usable: boolean; // eligible for Fasteign market statistics
};

export type PropertyHistory = {
  propertyId: string;
  address: string;
  postcode: string;
  municipalityName: string;
  sales: HistoryEntry[]; // oldest first
};

const TYPE_LABEL: Record<string, string> = {
  Fjölbýli: "íbúð",
  Sérbýli: "sérbýli",
  Einbýli: "einbýli",
  "Bílskúr/skúr": "bílskúr",
  Atvinnuhúsnæði: "atvinnuhúsnæði",
  Sumarhús: "sumarhús",
  Annað: "annað",
};

export function buildHistoryIndex(
  rows: Sale[],
  raw: Record<string, string>[],
): PropertyHistory[] {
  // Rows sharing FAERSLUNUMER are one contract.
  const contracts = new Map<string, number[]>();
  rows.forEach((s, i) => {
    const list = contracts.get(s.id) ?? [];
    list.push(i);
    contracts.set(s.id, list);
  });
  const index = new Map<string, PropertyHistory>();
  rows.forEach((s, i) => {
    if (
      !s.capital ||
      !s.residential ||
      !/^\d{7}$/.test(s.propertyId) ||
      !s.date ||
      s.reasons.includes("invalid_date")
    )
      return;
    const others = (contracts.get(s.id) ?? []).filter((j) => j !== i);
    const h = index.get(s.propertyId) ?? {
      propertyId: s.propertyId,
      address: s.address,
      postcode: s.postcode,
      municipalityName: s.municipalityName,
      sales: [],
    };
    h.sales.push({
      id: s.id,
      date: s.date,
      registered: s.registered,
      price: s.price,
      area: s.area,
      rooms: s.rooms,
      built: s.built,
      type: s.type,
      unitCode: raw[i]?.fepilog ?? "",
      valuation: s.valuation,
      bundle: others.length,
      bundleTypes: [
        ...new Set(others.map((j) => TYPE_LABEL[raw[j]?.tegund] ?? "annað")),
      ],
      unsuitable: s.reasons.includes("hms_unsuitable"),
      incomplete: s.reasons.includes("incomplete_or_unknown"),
      extreme: s.reasons.includes("extreme_local_ppm"),
      duplicates: [],
      usable: s.usable,
    });
    index.set(s.propertyId, h);
  });
  for (const h of index.values()) {
    h.sales.sort((a, b) => a.date.localeCompare(b.date) || +a.id - +b.id);
    // Same property, contract date and price under different document numbers:
    // most likely the same sale registered twice. Keep the first, note the rest.
    const kept: HistoryEntry[] = [];
    for (const s of h.sales) {
      const twin = kept.find(
        (k) => k.date === s.date && k.price === s.price && k.price > 0,
      );
      if (twin) twin.duplicates.push(s.id);
      else kept.push(s);
    }
    h.sales = kept;
  }
  return [...index.values()].sort((a, b) =>
    a.propertyId.localeCompare(b.propertyId),
  );
}

// Compact tuple encoding for data/processed/history.jsonl.gz: roughly a quarter of
// the size of plain objects. Only the requested property is decoded at runtime.
type PackedEntry = [
  string, // id
  string, // date
  string | null, // registered
  number, // price
  number, // area
  number | null, // rooms
  number | null, // built
  0 | 1 | 2, // apartment | house | other
  string, // unitCode
  number | null, // valuation
  number, // bundle
  string[], // bundleTypes
  number, // flags: 1 unsuitable, 2 incomplete, 4 extreme, 8 usable
  string[], // duplicates
];
export type PackedHistory = [string, string, string, string, PackedEntry[]];
const TYPES = ["apartment", "house", "other"] as const;
export function packHistory(h: PropertyHistory): PackedHistory {
  return [
    h.propertyId,
    h.address,
    h.postcode,
    h.municipalityName,
    h.sales.map((s) => [
      s.id,
      s.date,
      s.registered,
      s.price,
      s.area,
      s.rooms,
      s.built,
      TYPES.indexOf(s.type) as 0 | 1 | 2,
      s.unitCode,
      s.valuation,
      s.bundle,
      s.bundleTypes,
      (s.unsuitable ? 1 : 0) |
        (s.incomplete ? 2 : 0) |
        (s.extreme ? 4 : 0) |
        (s.usable ? 8 : 0),
      s.duplicates,
    ]),
  ];
}
export function unpackHistory(p: PackedHistory): PropertyHistory {
  const [propertyId, address, postcode, municipalityName, sales] = p;
  return {
    propertyId,
    address,
    postcode,
    municipalityName,
    sales: sales.map((e) => ({
      id: e[0],
      date: e[1],
      registered: e[2],
      price: e[3],
      area: e[4],
      rooms: e[5],
      built: e[6],
      type: TYPES[e[7]],
      unitCode: e[8],
      valuation: e[9],
      bundle: e[10],
      bundleTypes: e[11],
      unsuitable: Boolean(e[12] & 1),
      incomplete: Boolean(e[12] & 2),
      extreme: Boolean(e[12] & 4),
      usable: Boolean(e[12] & 8),
      duplicates: e[13],
    })),
  };
}

// Why a sale's price cannot stand in for the property's market price.
export type Caveat =
  "bundle" | "unsuitable" | "incomplete" | "extreme" | "no_price";
export function caveats(s: HistoryEntry): Caveat[] {
  const out: Caveat[] = [];
  if (s.price <= 0) out.push("no_price");
  if (s.bundle) out.push("bundle");
  if (s.unsuitable) out.push("unsuitable");
  if (s.incomplete) out.push("incomplete");
  if (s.extreme) out.push("extreme");
  return out;
}
// Price comparisons only between single-property contracts that HMS considers
// suitable and that have a price. Incomplete or extreme contracts are compared
// but marked uncertain.
export const comparablePrice = (s: HistoryEntry) =>
  s.price > 0 && !s.bundle && !s.unsuitable;

// Differences in recorded characteristics between two contracts of one FASTNUM.
export type Change = "unit" | "area" | "type" | "rooms" | "built";
export function differences(a: HistoryEntry, b: HistoryEntry): Change[] {
  const out: Change[] = [];
  if (a.unitCode !== b.unitCode) out.push("unit");
  // Tolerate rounding and small re-measurements: 2 m² or 5 %, whichever is larger.
  if (Math.abs(a.area - b.area) > Math.max(2, 0.05 * Math.min(a.area, b.area)))
    out.push("area");
  if (a.type !== b.type) out.push("type");
  if (a.rooms !== null && b.rooms !== null && a.rooms !== b.rooms)
    out.push("rooms");
  if (a.built !== null && b.built !== null && a.built !== b.built)
    out.push("built");
  return out;
}

export type Step = {
  sale: HistoryEntry;
  ppm: number | null;
  caveats: Caveat[];
  // Compared with the most recent earlier contract whose price is comparable.
  previous: {
    id: string;
    date: string;
    change: number; // nominal ISK
    percent: number;
    ppmPercent: number | null;
    years: number;
    differences: Change[];
    // Sales in between were not comparable and were skipped.
    skipped: number;
    uncertain: boolean;
  } | null;
  // Why no comparison is shown although an earlier contract exists.
  noComparison: "not_comparable" | "no_comparable_earlier" | null;
};

export type HistoryStatus = "confirmed" | "uncertain" | "single";

export function describeHistory(h: PropertyHistory) {
  const steps: Step[] = [];
  let last: { sale: HistoryEntry; index: number } | null = null;
  h.sales.forEach((sale, index) => {
    const c = caveats(sale),
      ppm =
        sale.price > 0 && sale.area > 0 && !sale.bundle
          ? sale.price / sale.area
          : null;
    let previous: Step["previous"] = null,
      noComparison: Step["noComparison"] = null;
    if (index > 0) {
      if (!comparablePrice(sale)) noComparison = "not_comparable";
      else if (!last) noComparison = "no_comparable_earlier";
      else {
        const p = last.sale,
          diffs = differences(p, sale),
          before = p.area > 0 ? p.price / p.area : null;
        previous = {
          id: p.id,
          date: p.date,
          change: sale.price - p.price,
          percent: (sale.price / p.price - 1) * 100,
          ppmPercent: before && ppm ? (ppm / before - 1) * 100 : null,
          years: (+new Date(sale.date) - +new Date(p.date)) / 86400000 / 365.25,
          differences: diffs,
          skipped: index - last.index - 1,
          uncertain:
            diffs.length > 0 ||
            sale.incomplete ||
            p.incomplete ||
            sale.extreme ||
            p.extreme,
        };
      }
    }
    if (comparablePrice(sale)) last = { sale, index };
    steps.push({ sale, ppm, caveats: c, previous, noComparison });
  });
  // Consistency of the recorded unit across all contracts, not only priced ones.
  let consistent = true;
  // A bundled contract's floor area can cover the whole bundle, so area is
  // only compared between single-property contracts.
  for (let i = 1; i < h.sales.length; i++) {
    const a = h.sales[i - 1],
      b = h.sales[i],
      bundled = a.bundle > 0 || b.bundle > 0;
    if (
      differences(a, b).some(
        (d) => d === "unit" || d === "type" || (d === "area" && !bundled),
      )
    )
      consistent = false;
  }
  const status: HistoryStatus =
    h.sales.length < 2 ? "single" : consistent ? "confirmed" : "uncertain";
  return {
    ...h,
    status,
    steps: steps.reverse(), // newest first for display
    latest: h.sales.at(-1)!,
  };
}
export type DescribedHistory = ReturnType<typeof describeHistory>;
