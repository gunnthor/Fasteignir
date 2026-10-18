export type Sale = {
  id: string;
  address: string;
  postcode: string;
  municipality: string;
  municipalityName: string;
  heinum: string;
  propertyId: string;
  date: string;
  registered: string | null;
  year: number;
  month: string;
  price: number;
  valuation: number | null;
  area: number;
  rooms: number | null;
  built: number | null;
  age: number | null;
  type: "apartment" | "house" | "other";
  residential: boolean;
  capital: boolean;
  usable: boolean;
  reasons: string[];
  warnings: string[];
  ppm: number;
  coordinates: [number, number] | null;
  coordinateQuality: string;
  district: string | null;
  // Optional: absent in snapshots made before October 2026.
  // FEPILOG verbatim (lib/units decodes it).
  unitCode?: string;
  // Staðfangaskrá TEGHNIT (0–5) and NAKV_XY (estimated error in metres) of the
  // address point; null when not stated.
  pointType?: number | null;
  accuracy?: number | null;
};
export type Filters = {
  months: number;
  from?: string;
  to?: string;
  type: string;
  municipality: string;
  postcode: string;
  district: string;
  minArea: number;
  maxArea: number;
  rooms: number;
  minBuilt: number;
  maxBuilt: number;
  // Total contract price in ISK; 0 and Infinity when not restricted.
  minPrice: number;
  maxPrice: number;
  q: string;
};
export type Stats = {
  count: number;
  ppm: number | null;
  price: number | null;
  area: number | null;
  rooms: number | null;
  built: number | null;
  valuation: number | null;
  ratio: number | null;
  ratioCount: number;
  sparse: boolean;
  change: number | null;
  previousCount: number;
};
export type AreaStats = Stats & {
  id: string;
  name: string;
  kind: "district" | "postcode" | "municipality";
};
export type Exploration = {
  summary: Stats;
  areas: AreaStats[];
  postcodes: AreaStats[];
  municipalities: AreaStats[];
  trend: ({ month: string; volume: number } & Stats)[];
  recent: Sale[];
  points: GeoJSON.FeatureCollection;
  pointCount: number;
  pointLimit: number;
  from: string;
  to: string;
  downloadedAt: string;
  latestSale: string;
  latestRegistration: string;
  // Recent contract months probably not yet fully registered (lib/registration).
  incomplete: { month: string; ended: boolean; share: number }[];
  version: string;
  matchedCount: number;
  total: number;
};
