import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import type { Sale } from "./types";
type Snapshot = {
  rows: Sale[];
  // Changes whenever ingestion regenerates the data; used in share-card URLs and ETags.
  version: string;
  report: {
    generatedAt: string;
    latestSale: string;
    latestRegistration: string;
    sources: { kaupskra: { downloadedAt: string } };
  };
};
let snapshot: Promise<Snapshot> | undefined;
export function getSnapshot(): Promise<Snapshot> {
  return (snapshot ??= (async () => {
    const [bytes, report] = await Promise.all([
      readFile(path.join(process.cwd(), "data/processed/sales.json.gz")),
      readFile(path.join(process.cwd(), "data/processed/report.json"), "utf8"),
    ]);
    const parsed = JSON.parse(report);
    return {
      rows: JSON.parse(gunzipSync(bytes).toString()) as Sale[],
      version: Date.parse(parsed.generatedAt).toString(36),
      report: parsed,
    };
  })().catch((e) => {
    snapshot = undefined;
    throw e;
  }));
}

let properties: Promise<import("./properties").PropertyRecord[]> | undefined;
export function getProperties() {
  return (properties ??= readFile(
    path.join(process.cwd(), "data/processed/properties.json.gz"),
  )
    .then(
      (bytes) =>
        JSON.parse(
          gunzipSync(bytes).toString(),
        ) as import("./properties").PropertyRecord[],
    )
    .catch((error) => {
      properties = undefined;
      throw error;
    }));
}

// Per-property sales histories kept as unparsed JSON lines (about a third of
// the heap of parsed tuples); lib/history-lookup parses one per request.
let history: Promise<Map<string, string>> | undefined;
export function getHistory() {
  return (history ??= readFile(
    path.join(process.cwd(), "data/processed/history.jsonl.gz"),
  )
    .then((bytes) => {
      const index = new Map<string, string>();
      for (const line of gunzipSync(bytes).toString().split("\n")) {
        const tab = line.indexOf("\t");
        if (tab > 0) index.set(line.slice(0, tab), line.slice(tab + 1));
      }
      return index;
    })
    .catch((error) => {
      history = undefined;
      throw error;
    }));
}

export type Observed = {
  trackingSince: string;
  generatedAt: string;
  lastRun: import("./observations").RunSummary;
  runs: import("./observations").RunSummary[];
  since: string;
  removed: number;
  recent: {
    id: string;
    propertyId: string;
    firstSeen: string | null;
    changedAt: string | null;
    date: string;
    registered: string | null;
    capital: boolean;
    residential: boolean;
    usable: boolean;
    type: import("./types").Sale["type"];
    municipality: string;
  }[];
};
let observed: Promise<Observed> | undefined;
export function getObserved() {
  return (observed ??= readFile(
    path.join(process.cwd(), "data/processed/observed.json.gz"),
  )
    .then((bytes) => JSON.parse(gunzipSync(bytes).toString()) as Observed)
    .catch((error) => {
      observed = undefined;
      throw error;
    }));
}
