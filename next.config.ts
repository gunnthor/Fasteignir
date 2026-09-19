import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingIncludes: {
    "/api/*": [
      "./data/processed/sales.json.gz",
      "./data/processed/properties.json.gz",
      "./data/processed/report.json",
    ],
  },
  poweredByHeader: false,
};
export default config;
