import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingIncludes: {
    "/api/*": [
      "./data/processed/sales.json.gz",
      "./data/processed/properties.json.gz",
      "./data/processed/history.jsonl.gz",
      "./data/processed/observed.json.gz",
      "./data/processed/report.json",
    ],
    "/eign/*": [
      "./data/processed/history.jsonl.gz",
      "./data/processed/properties.json.gz",
      "./data/processed/sales.json.gz",
      "./data/processed/report.json",
    ],
    "/nyskrad": [
      "./data/processed/sales.json.gz",
      "./data/processed/observed.json.gz",
      "./data/processed/report.json",
    ],
    "/svaedi/*": [
      "./data/processed/sales.json.gz",
      "./data/processed/report.json",
      "./data/processed/housing.json",
      "./public/data/areas.geojson",
    ],
    // Pages read the snapshot for share metadata and area lists; /embed renders cards.
    ...Object.fromEntries(
      [
        "/",
        "/markadur",
        "/samanburdur",
        "/embed",
        "/samsetning",
        "/svaedi",
        "/sitemap.xml",
      ].map((r) => [
        r,
        ["./data/processed/sales.json.gz", "./data/processed/report.json"],
      ]),
    ),
  },
  poweredByHeader: false,
};
export default config;
