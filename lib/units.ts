// Unit identification within a building, from HMS identifiers. Isomorphic, pure.
//
// FEPILOG (Kaupskrá) is the matshluti number plus the eignarhaldsnúmer of the
// main unit a valuation unit belongs to (FMR, "Landskrá fasteigna – handbók
// fyrir Bygging", 2003, p. 69). The eignarhaldsnúmer is a rýmisnúmer: two
// digits for the floor number and two for the position on that floor (p. 85).
// Only six-digit codes are decoded; anything else is shown verbatim and never
// interpreted. A floor number is the register's numbering, not necessarily the
// floor as named in the building, and nothing is inferred when a code is missing.

export type UnitCode = {
  code: string;
  building: string;
  floor: string;
  position: string;
};

export function decodeUnitCode(
  raw: string | null | undefined,
): UnitCode | null {
  const code = (raw ?? "").trim();
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(code);
  return m ? { code, building: m[1], floor: m[2], position: m[3] } : null;
}

// "01-0201" as written in the property register (matshluti-eignarhaldsnúmer).
export const formatUnitCode = (u: UnitCode) =>
  `${u.building}-${u.floor}${u.position}`;

export function unitLabel(raw: string | null | undefined) {
  const code = (raw ?? "").trim(),
    u = decodeUnitCode(code);
  if (u)
    return `Merking ${formatUnitCode(u)} · hæðarnúmer ${u.floor}, rými ${u.position}`;
  return code
    ? `Merking „${code}“ (ekki á stöðluðu formi; ekki túlkuð)`
    : "Einingarmerking vantar";
}

export type UnitStatus =
  "unique" | "shared_code" | "missing" | "uninterpretable";
type UnitRecord = { propertyId: string; unitCode: string; heinum?: string };

// How confidently a unit can be told apart from others at the same address.
export function unitStatus(p: UnitRecord, siblings: UnitRecord[]): UnitStatus {
  const code = p.unitCode.trim();
  if (!code) return "missing";
  if (!decodeUnitCode(code)) return "uninterpretable";
  return siblings.some(
    (s) => s.propertyId !== p.propertyId && s.unitCode.trim() === code,
  )
    ? "shared_code"
    : "unique";
}

// Records grouped by staðfang (HEINUM), built once per list.
const groups = new WeakMap<UnitRecord[], Map<string, UnitRecord[]>>();
export function siblingsOf<T extends UnitRecord>(rows: T[], p: T): T[] {
  if (!p.heinum) return [p];
  let g = groups.get(rows);
  if (!g) {
    g = new Map();
    for (const r of rows) {
      if (!r.heinum) continue;
      const list = g.get(r.heinum) ?? [];
      list.push(r);
      g.set(r.heinum, list);
    }
    groups.set(rows, g);
  }
  return ((g.get(p.heinum) ?? [p]) as T[]).slice().sort(compareUnits);
}

// Register order: building, floor, position; unparseable codes last, then FASTNUM.
export function compareUnits(a: UnitRecord, b: UnitRecord) {
  const ua = decodeUnitCode(a.unitCode),
    ub = decodeUnitCode(b.unitCode);
  if (ua && ub && ua.code !== ub.code) return ua.code.localeCompare(ub.code);
  if (!ua !== !ub) return ua ? -1 : 1;
  return (
    a.unitCode.localeCompare(b.unitCode) ||
    a.propertyId.localeCompare(b.propertyId)
  );
}

// Staðfangaskrá TEGHNIT (coordinate type) and YFIRFARID (status), from the
// published attribute specification ("Staðfangaskrá eigindalýsing").
export const POINT_TYPES: Record<number, string> = {
  0: "tegund hnits óyfirfarin",
  1: "áætlaður miðpunktur mannvirkis",
  2: "megininngangur mannvirkis",
  3: "innkeyrsla lóðar",
  4: "innan lóðarmarka",
  5: "innan áætlaðs byggingarreits",
};

export function locationNote(s: {
  coordinates: [number, number] | null;
  coordinateQuality: string;
  pointType?: number | null;
  accuracy?: number | null;
}) {
  if (!s.coordinates)
    return s.coordinateQuality === "ambiguous_or_rejected"
      ? "Ekki staðsett á korti: staðfangið hefur fleiri en eitt hnit eða hnitin þarfnast endurskoðunar hjá HMS."
      : "Ekki staðsett á korti: staðfang fannst ekki í Staðfangaskrá.";
  const parts = [
    "Hnit staðfangs úr Staðfangaskrá HMS, ekki staðsetning einstakrar íbúðar; allar eignir á sama staðfangi deila einum punkti",
    s.pointType != null && POINT_TYPES[s.pointType]
      ? `punktur: ${POINT_TYPES[s.pointType]}`
      : null,
    s.coordinateQuality === "reviewed"
      ? "yfirfarin hnit"
      : "hnit ekki merkt yfirfarin",
    s.accuracy ? `áætluð skekkjumörk ${s.accuracy} m` : null,
  ];
  return parts.filter(Boolean).join(" · ") + ".";
}
