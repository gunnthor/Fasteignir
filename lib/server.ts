import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import type { Sale } from "./types";
type Snapshot = {
  rows: Sale[];
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
    return {
      rows: JSON.parse(gunzipSync(bytes).toString()) as Sale[],
      report: JSON.parse(report),
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
