// Tracks when Fasteign first observed each HMS transaction row across daily
// downloads. Pure functions; scripts/fetch-kaupskra.ts handles files.
//
// A row is keyed by FAERSLUNUMER|FASTNUM (unique in every snapshot inspected).
// Its fingerprint covers only fields describing the transaction itself; the
// *_GILDANDI and FYRIRHUGAD_* columns hold current register values that HMS
// revises for every row each year and must not make old sales look edited.
import { createHash } from "node:crypto";

export const FINGERPRINT_FIELDS = [
  "faerslunumer",
  "emnr",
  "skjalanumer",
  "fastnum",
  "heimilisfang",
  "postnr",
  "heinum",
  "svfn",
  "utgdag",
  "thinglystdags",
  "kaupverd",
  "fasteignamat",
  "byggar",
  "fepilog",
  "einflm",
  "lod_flm",
  "lod_flmein",
  "fjherb",
  "tegund",
  "fullbuid",
  "onothaefur_samningur",
] as const;

export const rowKey = (r: Record<string, string>) =>
  `${r.faerslunumer}|${r.fastnum}`;
export function fingerprint(r: Record<string, string>) {
  return createHash("sha1")
    .update(FINGERPRINT_FIELDS.map((f) => (r[f] ?? "").trim()).join("\u001f"))
    .digest("hex")
    .slice(0, 12);
}

export type Entry = {
  hash: string;
  // null: present when tracking began (baseline), never reported as new.
  firstSeen: string | null;
  changedAt: string | null;
  removedAt: string | null;
};
export type State = { trackingSince: string; rows: Map<string, Entry> };
export type RunSummary = {
  date: string;
  bootstrap: boolean;
  rows: number;
  new: number;
  modified: number;
  revised: number; // identifier corrected or property added to a known contract
  restored: number;
  removed: number;
  unchanged: number;
};

const HEADER = "#fasteign-observations\tv1";
// Removed rows are remembered this long so a reappearing row is recognized.
export const TOMBSTONE_DAYS = 180;

export function serializeState(s: State) {
  const lines = [`${HEADER}\ttrackingSince=${s.trackingSince}`];
  for (const key of [...s.rows.keys()].sort()) {
    const e = s.rows.get(key)!;
    lines.push(
      [key, e.hash, e.firstSeen, e.changedAt, e.removedAt]
        .map((v) => v ?? "-")
        .join("\t"),
    );
  }
  return lines.join("\n") + "\n";
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Any malformed line rejects the whole file: a corrupt state must stop the
// run rather than silently re-bootstrap or mark everything as new.
export function parseState(text: string): State {
  const lines = text.split("\n").filter((l) => l !== "");
  const [head, ...body] = lines;
  const m =
    /^#fasteign-observations\tv1\ttrackingSince=(\d{4}-\d{2}-\d{2})$/.exec(
      head ?? "",
    );
  if (!m) throw Error("Observation state: unknown header or version");
  const rows = new Map<string, Entry>();
  const day = (v: string, line: number) => {
    if (v === "-") return null;
    if (!DAY.test(v))
      throw Error(`Observation state: bad date on line ${line}`);
    return v;
  };
  body.forEach((line, i) => {
    const parts = line.split("\t");
    if (
      parts.length !== 5 ||
      !/^\d+\|\d+$/.test(parts[0]) ||
      !/^[0-9a-f]{12}$/.test(parts[1])
    )
      throw Error(`Observation state: malformed line ${i + 2}`);
    if (rows.has(parts[0]))
      throw Error(`Observation state: duplicate key on line ${i + 2}`);
    rows.set(parts[0], {
      hash: parts[1],
      firstSeen: day(parts[2], i + 2),
      changedAt: day(parts[3], i + 2),
      removedAt: day(parts[4], i + 2),
    });
  });
  return { trackingSince: m[1], rows };
}

export class MassRemovalError extends Error {}

const daysBetween = (a: string, b: string) =>
  (+new Date(b) - +new Date(a)) / 86400000;

// Advances the state by one observation of the complete source file.
export function observe(
  previous: State | null,
  records: Record<string, string>[],
  today: string,
  { allowMassRemoval = false }: { allowMassRemoval?: boolean } = {},
): { state: State; summary: RunSummary } {
  const summary: RunSummary = {
    date: today,
    bootstrap: !previous,
    rows: records.length,
    new: 0,
    modified: 0,
    revised: 0,
    restored: 0,
    removed: 0,
    unchanged: 0,
  };
  const current = new Map<string, string>();
  for (const r of records) {
    const key = rowKey(r);
    if (current.has(key)) throw Error(`Duplicate source row key ${key}`);
    current.set(key, fingerprint(r));
  }
  if (!previous) {
    const rows = new Map<string, Entry>();
    for (const [key, hash] of current)
      rows.set(key, {
        hash,
        firstSeen: null,
        changedAt: null,
        removedAt: null,
      });
    summary.unchanged = rows.size;
    return { state: { trackingSince: today, rows }, summary };
  }
  const rows = new Map<string, Entry>();
  const added: string[] = [];
  for (const [key, hash] of current) {
    const e = previous.rows.get(key);
    if (!e) added.push(key);
    else if (e.removedAt) {
      summary.restored++;
      rows.set(key, { ...e, hash, removedAt: null, changedAt: today });
    } else if (e.hash !== hash) {
      summary.modified++;
      rows.set(key, { ...e, hash, changedAt: today });
    } else {
      summary.unchanged++;
      rows.set(key, e);
    }
  }
  // Rows that disappeared in this run, grouped by contract.
  const vanished = new Map<string, string[]>();
  for (const [key, e] of previous.rows) {
    if (current.has(key)) continue;
    if (e.removedAt) {
      if (daysBetween(e.removedAt, today) <= TOMBSTONE_DAYS) rows.set(key, e);
      continue;
    }
    const id = key.split("|")[0],
      list = vanished.get(id) ?? [];
    list.push(key);
    vanished.set(id, list);
  }
  // Known contracts: earliest observation of any of their rows.
  const contractSeen = new Map<string, string | null>();
  for (const [key, e] of previous.rows) {
    const id = key.split("|")[0];
    if (!contractSeen.has(id)) contractSeen.set(id, e.firstSeen);
    else {
      const seen = contractSeen.get(id)!;
      if (seen !== null && (e.firstSeen === null || e.firstSeen < seen))
        contractSeen.set(id, e.firstSeen);
    }
  }
  for (const key of added.sort()) {
    const id = key.split("|")[0],
      gone = vanished.get(id);
    if (gone?.length) {
      // Same contract, different FASTNUM: an identifier correction, not a new sale.
      const old = gone.shift()!;
      summary.revised++;
      rows.set(key, {
        hash: current.get(key)!,
        firstSeen: previous.rows.get(old)!.firstSeen,
        changedAt: today,
        removedAt: null,
      });
    } else if (contractSeen.has(id)) {
      // A property added to a contract Fasteign already knew.
      summary.revised++;
      rows.set(key, {
        hash: current.get(key)!,
        firstSeen: contractSeen.get(id)!,
        changedAt: today,
        removedAt: null,
      });
    } else {
      summary.new++;
      rows.set(key, {
        hash: current.get(key)!,
        firstSeen: today,
        changedAt: null,
        removedAt: null,
      });
    }
  }
  for (const keys of vanished.values())
    for (const key of keys) {
      summary.removed++;
      rows.set(key, { ...previous.rows.get(key)!, removedAt: today });
    }
  const active = [...previous.rows.values()].filter((e) => !e.removedAt).length;
  if (!allowMassRemoval && summary.removed > Math.max(500, active * 0.02))
    throw new MassRemovalError(
      `${summary.removed} of ${active} known rows disappeared; refusing to advance observation state`,
    );
  return { state: { trackingSince: previous.trackingSince, rows }, summary };
}

// Rows first observed, or changed, within the last `days` days: the runtime view.
export function recentObservations(state: State, today: string, days = 60) {
  const since = new Date(+new Date(today) - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const out: {
    id: string;
    propertyId: string;
    firstSeen: string | null;
    changedAt: string | null;
  }[] = [];
  for (const [key, e] of state.rows) {
    if (e.removedAt) continue;
    if ((e.firstSeen ?? "") >= since || (e.changedAt ?? "") >= since) {
      const [id, propertyId] = key.split("|");
      out.push({
        id,
        propertyId,
        firstSeen: e.firstSeen,
        changedAt: e.changedAt,
      });
    }
  }
  const removed = [...state.rows.values()].filter(
    (e) => e.removedAt && e.removedAt >= since,
  ).length;
  return { since, rows: out, removed };
}
