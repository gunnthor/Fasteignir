// Shareable view state. Isomorphic: imported by client components and server routes,
// so it must not depend on Node APIs or the data snapshot.
import { MUNICIPALITIES } from "./municipalities";
import { date, districtName, numberIS } from "./format";

export const PERIODS: [string, string][] = [
  ["3", "3 mán."],
  ["6", "6 mán."],
  ["12", "12 mán."],
  ["24", "2 ár"],
  ["60", "5 ár"],
  ["0", "Allt"],
  ["custom", "Velja daga"],
];
export const DEFAULT_FILTERS = {
  months: "12",
  type: "all",
  municipality: "",
  postcode: "",
  district: "",
  minArea: "",
  maxArea: "",
  rooms: "",
  minBuilt: "",
  maxBuilt: "",
  // Total price in whole m.kr.
  minPrice: "",
  maxPrice: "",
  from: "",
  to: "",
};
export type FilterState = typeof DEFAULT_FILTERS;
export const METRICS = ["ppm", "price", "count", "change", "ratio"] as const;
export type View = {
  filters: FilterState;
  q: string;
  metric: (typeof METRICS)[number];
  level: "postcode" | "district";
  points: boolean;
  // Price distribution panel: total price or price per m², and an optional
  // ISK value to place within the distribution.
  dist: "price" | "ppm";
  value: string;
};
export const DEFAULT_VIEW: View = {
  filters: DEFAULT_FILTERS,
  q: "",
  metric: "ppm",
  level: "postcode",
  points: false,
  dist: "price",
  value: "",
};
// Whole ISK: total price 1 m.kr.–5.000 m.kr., price/m² 10 þ.kr.–10 m.kr.
// Returns undefined for anything else.
export function parseDistributionValue(s: string, metric: "price" | "ppm") {
  if (!/^\d{1,10}$/.test(s)) return undefined;
  const n = +s,
    [lo, hi] = metric === "price" ? [1e6, 5e9] : [1e4, 1e7];
  return n >= lo && n <= hi ? n : undefined;
}
export type ParamSource =
  URLSearchParams | Record<string, string | string[] | undefined>;

export function param(source: ParamSource, key: string) {
  const v = source instanceof URLSearchParams ? source.get(key) : source[key];
  return ((Array.isArray(v) ? v[0] : v) ?? "").trim();
}
const today = () => new Date().toISOString().slice(0, 10);
function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < "1900-01-01" || s > today())
    return false;
  const d = new Date(s + "T00:00:00Z");
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === s;
}

// Invalid or inconsistent values fall back to defaults rather than failing:
// a mangled shared link should still open a sensible view.
export function parseFilterState(source: ParamSource): FilterState {
  const get = (k: string) => param(source, k);
  const int = (k: string, min: number, max: number) => {
    const s = get(k);
    return /^\d{1,5}$/.test(s) && +s >= min && +s <= max ? String(+s) : "";
  };
  const pair = (a: string, b: string, min: number, max: number) => {
    const lo = int(a, min, max),
      hi = int(b, min, max);
    return lo && hi && +lo > +hi ? ["", ""] : [lo, hi];
  };
  const [minArea, maxArea] = pair("minArea", "maxArea", 0, 10000),
    [minBuilt, maxBuilt] = pair("minBuilt", "maxBuilt", 1000, 2100),
    [minPrice, maxPrice] = pair("minPrice", "maxPrice", 1, 5000);
  let from = get("from"),
    to = get("to"),
    months = get("months");
  if (validDate(from) && validDate(to) && from <= to) months = "custom";
  else {
    from = to = "";
    if (!PERIODS.some(([p]) => p === months) || months === "custom")
      months = DEFAULT_FILTERS.months;
  }
  const municipality = get("municipality");
  return {
    months,
    from,
    to,
    type: ["apartment", "house"].includes(get("type")) ? get("type") : "all",
    municipality: municipality in MUNICIPALITIES ? municipality : "",
    postcode: /^\d{3}$/.test(get("postcode")) ? get("postcode") : "",
    district: get("district").slice(0, 80),
    minArea,
    maxArea,
    rooms: int("rooms", 1, 5),
    minBuilt,
    maxBuilt,
    minPrice,
    maxPrice,
  };
}
export function parseView(source: ParamSource): View {
  const metric = param(source, "metric") as View["metric"],
    dist = param(source, "dist") === "ppm" ? "ppm" : "price";
  return {
    filters: parseFilterState(source),
    q: param(source, "q").slice(0, 100),
    metric: METRICS.includes(metric) ? metric : "ppm",
    level: param(source, "level") === "district" ? "district" : "postcode",
    points: param(source, "points") === "1",
    dist,
    value:
      parseDistributionValue(param(source, "value"), dist) === undefined
        ? ""
        : param(source, "value"),
  };
}

// Writes only non-default values so shared URLs stay short. `pin` replaces a
// relative period (e.g. last 12 months) with the exact dates currently shown.
export function serializeFilters(
  f: FilterState,
  pin?: { from: string; to: string },
  p = new URLSearchParams(),
) {
  const range = pin ?? (f.months === "custom" ? f : null);
  if (range?.from && range.to) {
    p.set("from", range.from);
    p.set("to", range.to);
  } else if (f.months !== DEFAULT_FILTERS.months && f.months !== "custom")
    p.set("months", f.months);
  for (const key of [
    "type",
    "municipality",
    "postcode",
    "district",
    "rooms",
    "minArea",
    "maxArea",
    "minBuilt",
    "maxBuilt",
    "minPrice",
    "maxPrice",
  ] as const)
    if (f[key] && f[key] !== DEFAULT_FILTERS[key]) p.set(key, f[key]);
  return p;
}
export function serializeView(v: View, pin?: { from: string; to: string }) {
  const p = serializeFilters(v.filters, pin);
  if (v.q.trim()) p.set("q", v.q.trim());
  if (v.metric !== "ppm") p.set("metric", v.metric);
  if (v.level !== "postcode") p.set("level", v.level);
  if (v.points) p.set("points", "1");
  if (v.dist !== "price") p.set("dist", v.dist);
  if (v.value) p.set("value", v.value);
  return p;
}
// Parameters understood by lib/analytics parseFilters.
export function apiParams(f: FilterState, q = "") {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f))
    if (v && !(k === "months" && v === "custom")) p.set(k, v);
  if (q) p.set("q", q);
  return p;
}

export function areaLabel(f: FilterState) {
  return f.district
    ? districtName(f.district)
    : f.postcode
      ? `Póstnúmer ${f.postcode}`
      : MUNICIPALITIES[f.municipality] || "Höfuðborgarsvæðið";
}
export const typeLabel = (t: string) =>
  t === "apartment" ? "Fjölbýli" : t === "house" ? "Sérbýli" : "Allar íbúðir";
export function periodLabel(f: FilterState) {
  if (f.months === "custom") return `${date(f.from)} – ${date(f.to)}`;
  if (f.months === "0") return "Öll tímabil";
  return `Síðustu ${f.months === "24" ? "2 ár" : f.months === "60" ? "5 ár" : `${f.months} mánuðir`}`;
}
// Every active non-geographic filter, so a shared card never hides a restriction.
export function filterSummary(f: FilterState, q = "") {
  const range = (lo: string, hi: string, fmt = (s: string) => s) =>
    lo && hi ? `${fmt(lo)}–${fmt(hi)}` : lo ? `≥ ${fmt(lo)}` : `≤ ${fmt(hi)}`;
  return [
    typeLabel(f.type),
    f.rooms && (f.rooms === "5" ? "5+ herbergi" : `${f.rooms} herbergi`),
    (f.minArea || f.maxArea) &&
      `${range(f.minArea, f.maxArea, (s) => numberIS(+s))} m²`,
    (f.minBuilt || f.maxBuilt) && `byggt ${range(f.minBuilt, f.maxBuilt)}`,
    (f.minPrice || f.maxPrice) &&
      `kaupverð ${range(f.minPrice, f.maxPrice, (s) => numberIS(+s))} m.kr.`,
    q && `leit: „${q}“`,
  ].filter(Boolean) as string[];
}
export const NOMINAL_CAVEAT =
  "Nafnverð, ekki leiðrétt fyrir verðbólgu eða breyttri samsetningu seldra eigna. Ekki opinber verðvísitala.";

// A single geography for comparison: "postcode:107", "district:4. Laugardalur",
// "municipality:1000".
export type AreaRef = {
  kind: "postcode" | "district" | "municipality";
  id: string;
};
export function parseArea(s: string): AreaRef | null {
  const [kind, ...rest] = s.split(":"),
    id = rest.join(":").trim();
  if (kind === "postcode" && /^\d{3}$/.test(id)) return { kind, id };
  if (kind === "municipality" && id in MUNICIPALITIES) return { kind, id };
  if (kind === "district" && id && id.length <= 80) return { kind, id };
  return null;
}
export const areaKey = (a: AreaRef) => `${a.kind}:${a.id}`;
// Shared filters with the geography replaced by one area.
export function scopeTo(f: FilterState, a: AreaRef): FilterState {
  return {
    ...f,
    municipality: a.kind === "municipality" ? a.id : "",
    postcode: a.kind === "postcode" ? a.id : "",
    district: a.kind === "district" ? a.id : "",
  };
}

// Total budget in ISK, whole millions between 5 and 1.000 m.kr.
export function parseBudget(s: string) {
  if (!/^\d{1,10}$/.test(s)) return null;
  const n = +s;
  return n >= 5_000_000 && n <= 1_000_000_000 ? n : null;
}

// "Hvar hafa selst 3 herbergja íbúðir á 75 m.kr. eða minna síðustu 12 mánuði?"
export function question(f: FilterState, budget: number) {
  const rooms = f.rooms ? `${f.rooms === "5" ? "5+" : f.rooms} herbergja ` : "",
    kind =
      f.type === "apartment"
        ? "íbúðir í fjölbýli"
        : f.type === "house"
          ? "sérbýli"
          : "íbúðir",
    when =
      f.months === "custom"
        ? `${date(f.from)} – ${date(f.to)}`
        : f.months === "0"
          ? "frá upphafi skráningar"
          : f.months === "24"
            ? "síðustu 2 ár"
            : f.months === "60"
              ? "síðustu 5 ár"
              : `síðustu ${f.months} mánuði`;
  return `Hvar hafa selst ${rooms}${kind} á ${numberIS(budget / 1e6)} m.kr. eða minna ${when}?`;
}

const shiftMonth = (d: string, months: number) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCMonth(t.getUTCMonth() + months, Math.min(t.getUTCDate(), 28));
  return t.toISOString().slice(0, 10);
};
// The comparison group for placing one sale in the price distribution: same
// postcode and type, floor area within ±25 % and contracts within six months
// either side of the sale (the sale itself included). Opens /markadur.
export function distributionLink(s: {
  date: string;
  postcode: string;
  type: string;
  area: number;
  price: number;
}) {
  const now = today(),
    to = shiftMonth(s.date, 6);
  const filters: FilterState = {
    ...DEFAULT_FILTERS,
    months: "custom",
    from: shiftMonth(s.date, -6),
    to: to > now ? now : to,
    type: ["apartment", "house"].includes(s.type) ? s.type : "all",
    postcode: /^\d{3}$/.test(s.postcode) ? s.postcode : "",
    minArea: String(Math.floor(s.area * 0.75)),
    maxArea: String(Math.ceil(s.area * 1.25)),
  };
  const p = serializeFilters(filters);
  p.set("value", String(Math.round(s.price)));
  return `/markadur?${p}#dreifing`;
}
