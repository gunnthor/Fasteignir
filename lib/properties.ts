import type { Sale } from "./types";
export type PropertyRecord = Pick<
  Sale,
  | "propertyId"
  | "address"
  | "postcode"
  | "municipalityName"
  | "area"
  | "rooms"
  | "built"
  | "type"
> & { unitCode: string; recordedAt: string };
export function buildPropertyIndex(
  rows: Sale[],
  raw: Record<string, string>[],
): PropertyRecord[] {
  const index = new Map<string, PropertyRecord>();
  rows.forEach((s, i) => {
    if (
      !s.capital ||
      !s.residential ||
      !/^\d{7}$/.test(s.propertyId) ||
      !s.address ||
      !s.date ||
      s.reasons.includes("invalid_date") ||
      s.reasons.includes("future_date") ||
      s.area <= 0
    )
      return;
    const old = index.get(s.propertyId);
    if (old && old.recordedAt >= s.date) return;
    index.set(s.propertyId, {
      propertyId: s.propertyId,
      address: s.address,
      postcode: s.postcode,
      municipalityName: s.municipalityName,
      area: s.area,
      rooms: s.rooms,
      built: s.built,
      type: s.type,
      unitCode: raw[i]?.fepilog ?? "",
      recordedAt: s.date,
    });
  });
  return [...index.values()].sort(
    (a, b) =>
      a.address.localeCompare(b.address, "is") ||
      a.propertyId.localeCompare(b.propertyId),
  );
}
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ð", "d")
    .replaceAll("þ", "th");
export function searchProperties(
  rows: PropertyRecord[],
  query: string,
  limit = 25,
) {
  const words = fold(query.trim())
    .replace(/(\d+)\s+([a-z])\b/g, "$1$2")
    .split(/\s+/);
  const matches = rows.filter((p) => {
    const address = fold(p.address).replace(/(\d+)\s+([a-z])\b/g, "$1$2");
    const houseNumbers = address.match(/\d+[a-z]?/g) ?? [];
    const location = `${address} ${fold(p.municipalityName)}`;
    return words.every((word) => {
      if (/^\d+[a-z]?$/.test(word)) {
        // Numbers must match a complete address number or an exact identifier,
        // never a digit buried inside another apartment's fastanúmer/unit code.
        return (
          houseNumbers.some((number) =>
            /^\d+$/.test(word)
              ? number.replace(/[a-z]$/, "") === word
              : number === word,
          ) ||
          word === p.postcode ||
          word === p.propertyId ||
          word === p.unitCode
        );
      }
      return location.includes(word);
    });
  });
  return {
    properties: matches.slice(0, limit),
    total: matches.length,
    hasMore: matches.length > limit,
  };
}
