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
  const words = fold(query.trim()).split(/\s+/);
  const matches = rows.filter((p) =>
    words.every((w) =>
      fold(
        `${p.address} ${p.postcode} ${p.municipalityName} ${p.propertyId} ${p.unitCode}`,
      ).includes(w),
    ),
  );
  return {
    properties: matches.slice(0, limit),
    total: matches.length,
    hasMore: matches.length > limit,
  };
}
