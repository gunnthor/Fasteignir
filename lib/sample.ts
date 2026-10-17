// Sample-size rules shared by server statistics and client components.
// Dependency-free so client bundles can import it.
export const SAMPLE = {
  // Medians and other central values are hidden below this.
  median: 5,
  // Results are shown with a warning below this.
  warn: 10,
  // Quartiles, histograms and percentile positions need at least this many.
  distribution: 20,
  // No displayed histogram bin may hold between 1 and cell − 1 observations.
  cell: 5,
} as const;
