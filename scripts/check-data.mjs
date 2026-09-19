import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
const required = [
  "data/processed/sales.json.gz",
  "data/processed/report.json",
  "public/data/areas.geojson",
  "data/processed/properties.json.gz",
];
try {
  await Promise.all(required.map((file) => access(file, constants.R_OK)));
  const report = JSON.parse(await readFile(required[1], "utf8"));
  const geometry = JSON.parse(await readFile(required[2], "utf8"));
  if (
    !report.analyticalSales ||
    !report.propertyCount ||
    !report.sources?.postnumer?.sha256 ||
    !report.sources?.kaupskra?.sha256 ||
    !report.sources?.kaupskra?.downloadedAt ||
    !geometry.features?.length
  )
    throw Error("Incomplete snapshot");
} catch (error) {
  console.error(
    "Cannot build Fasteign without a verified data snapshot. Run npm run ingest first.",
  );
  console.error(error.message);
  process.exitCode = 1;
}
