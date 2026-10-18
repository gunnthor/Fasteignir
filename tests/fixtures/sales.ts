// Deterministic sale and observation fixtures shared by Phase 2 tests.
import type { Sale } from "../../lib/types";
import type { Observed } from "../../lib/server";

let next = 0;
export function sale(date: string, extra: Partial<Sale> = {}): Sale {
  next++;
  const s: Sale = {
    id: String(500000 + next),
    address: `Prófgata ${next}`,
    postcode: "105",
    municipality: "0000",
    municipalityName: "Reykjavík",
    heinum: String(1000000 + next),
    propertyId: String(2000000 + next),
    date,
    registered: date,
    year: +date.slice(0, 4),
    month: date.slice(0, 7),
    price: 60_000_000,
    valuation: null,
    area: 80,
    rooms: 3,
    built: 1980,
    age: 40,
    type: "apartment",
    residential: true,
    capital: true,
    usable: true,
    reasons: [],
    warnings: [],
    ppm: 0,
    coordinates: null,
    coordinateQuality: "unmatched",
    district: null,
    ...extra,
  };
  s.ppm = s.price / s.area;
  return s;
}

export function observed(
  recent: Partial<Observed["recent"][number]>[],
  {
    since = "2026-08-18",
    runs = [
      { date: "2026-09-20", bootstrap: true },
      { date: "2026-10-17", bootstrap: false },
    ],
  }: { since?: string; runs?: Partial<Observed["runs"][number]>[] } = {},
): Observed {
  return {
    trackingSince: "2026-09-20",
    generatedAt: "2026-10-17T07:00:00.000Z",
    lastRun: { date: runs.at(-1)!.date } as Observed["lastRun"],
    runs: runs as Observed["runs"],
    since,
    removed: 0,
    recent: recent.map((r) => ({
      id: "",
      propertyId: "",
      firstSeen: null,
      changedAt: null,
      date: "",
      registered: null,
      capital: true,
      residential: true,
      usable: true,
      type: "apartment",
      municipality: "0000",
      ...r,
    })),
  };
}
// The observation of an existing sale, first seen on `firstSeen`.
export const seen = (
  s: Sale,
  firstSeen: string | null,
  changedAt: string | null = null,
) => ({
  id: s.id,
  propertyId: s.propertyId,
  firstSeen,
  changedAt,
  date: s.date,
  registered: s.registered,
  type: s.type,
  municipality: s.municipality,
});
