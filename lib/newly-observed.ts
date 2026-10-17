// Server-only: transactions that recently appeared in, or changed in, the HMS
// file as observed by Fasteign's daily ingestion.
import type { Observed } from "./server";
import type { Sale } from "./types";
import { lagDays } from "./registration";

export const WINDOWS = [7, 30, 60] as const;

export function newlyObserved(
  rows: Sale[],
  observed: Observed,
  {
    type,
    municipality,
    days,
    today,
  }: { type: string; municipality: string; days: number; today: string },
  limit = 100,
) {
  const since = new Date(+new Date(today) - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const byId = new Map<string, Sale>();
  for (const s of rows) byId.set(s.id, s);
  const inScope = (s: { type: string; municipality: string }) =>
    (type === "all" || s.type === type) &&
    (!municipality || s.municipality === municipality);
  const added: (Sale & { firstSeen: string; lag: number | null })[] = [],
    changed: (Sale & { changedAt: string })[] = [];
  let addedOther = 0;
  const perDay = new Map<string, number>();
  for (const o of observed.recent) {
    if (!o.capital || !o.residential) continue;
    const s = byId.get(o.id);
    if (o.firstSeen && o.firstSeen >= since) {
      if (s) {
        if (inScope(s)) {
          added.push({ ...s, firstSeen: o.firstSeen, lag: lagDays(s) });
          perDay.set(o.firstSeen, (perDay.get(o.firstSeen) ?? 0) + 1);
        }
      } else if (inScope(o)) addedOther++;
    } else if (o.changedAt && o.changedAt >= since && s && inScope(s))
      changed.push({ ...s, changedAt: o.changedAt });
  }
  added.sort(
    (a, b) =>
      b.firstSeen.localeCompare(a.firstSeen) ||
      (b.registered ?? "").localeCompare(a.registered ?? "") ||
      b.id.localeCompare(a.id),
  );
  changed.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  // Observation days within the window, oldest first, zero-filled between runs.
  const runDays = observed.runs
    .filter((r) => !r.bootstrap && r.date >= since)
    .map((r) => r.date);
  const days_ = [...new Set([...runDays, ...perDay.keys()])].sort();
  return {
    since,
    trackingSince: observed.trackingSince,
    lastObserved: observed.lastRun.date,
    total: added.length,
    // Capital Region residential rows not eligible for price statistics
    // (HMS-unsuitable, incomplete, multi-property contracts …).
    otherCount: addedOther,
    added: added.slice(0, limit),
    changedTotal: changed.length,
    changed: changed.slice(0, 20),
    perDay: days_.map((d) => ({ date: d, count: perDay.get(d) ?? 0 })),
  };
}
export type NewlyObserved = ReturnType<typeof newlyObserved>;
