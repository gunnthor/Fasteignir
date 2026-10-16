import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingIncludes: {
    "/api/*": [
      "./data/processed/sales.json.gz",
      "./data/processed/properties.json.gz",
      "./data/processed/report.json",
    ],
    // Pages read the snapshot for share metadata and area lists; /embed renders cards.
    ...Object.fromEntries(
      ["/", "/markadur", "/samanburdur", "/embed"].map((r) => [
        r,
        ["./data/processed/sales.json.gz", "./data/processed/report.json"],
      ]),
    ),
  },
  poweredByHeader: false,
};
export default config;
