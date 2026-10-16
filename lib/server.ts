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
