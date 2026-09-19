import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import {
  decodeCSV,
  normalizeSale,
  numberValue,
  median,
  quantile,
} from "../lib/data";
import { buildPropertyIndex } from "../lib/properties";
import type { Sale } from "../lib/types";
const sources = {
  postnumer:
    "https://gis.lmi.is/geoserver/byggdastofnun/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=byggdastofnun:postnumer&outputFormat=application%2Fjson&srsName=EPSG:4326",
  kaupskra:
    "https://frs3o1zldvgn.objectstorage.eu-frankfurt-1.oci.customer-oci.com/n/frs3o1zldvgn/b/public_data_for_download/o/kaupskra.csv",
  stadfangaskra:
    "https://hmsstgsftpprodweu001.blob.core.windows.net/fasteignaskra/Stadfangaskra.csv",
  borgarhlutar:
    "https://lukrgatt.reykjavik.is/server/rest/services/Borgarhlutar/MapServer/33/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
};
async function main() {
  await mkdir("data/raw", { recursive: true });
  await mkdir("data/processed", { recursive: true });
  await mkdir("public/data", { recursive: true });
  const offline = process.argv.includes("--offline");
  const manifest: Record<string, unknown> = {};
  for (const [name, url] of Object.entries(sources)) {
    const path = `data/raw/${name}.${["borgarhlutar", "postnumer"].includes(name) ? "geojson" : "csv"}`;
    let meta: Record<string, unknown> = { url };
    if (!offline) {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw Error(`${name}: HTTP ${response.status}`);
      const b = Buffer.from(await response.arrayBuffer());
      await writeFile(path + ".tmp", b);
      await rename(path + ".tmp", path);
      meta = {
        url,
        downloadedAt: new Date().toISOString(),
        lastModified: response.headers.get("last-modified"),
        etag: response.headers.get("etag"),
      };
      await writeFile(path + ".meta.json", JSON.stringify(meta, null, 2));
    } else {
      try {
        meta = JSON.parse(await readFile(path + ".meta.json", "utf8"));
      } catch {
        throw Error(
          `Missing ${path}.meta.json: offline runs require recorded provenance`,
        );
      }
    }
    const bytes = await readFile(path);
    manifest[name] = {
      ...meta,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  const csv = decodeCSV(await readFile("data/raw/kaupskra.csv"));
  const required = [
    "faerslunumer",
    "emnr",
    "skjalanumer",
    "heinum",
    "svfn",
    "postnr",
    "utgdag",
    "kaupverd",
    "einflm",
    "tegund",
    "fullbuid",
    "onothaefur_samningur",
    "fasteignamat",
  ];
  for (const field of required)
    if (!csv.headers.includes(field))
      throw Error(`Source schema changed: missing ${field}`);
  if (csv.records.length < 100000)
    throw Error("Unexpectedly small source; refusing to publish");
  const addresses = decodeCSV(await readFile("data/raw/stadfangaskra.csv"));
  const geo = JSON.parse(
    await readFile("data/raw/borgarhlutar.geojson", "utf8"),
  ) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  if (!geo.features?.length) throw Error("No official district polygons");
  const addr = new Map<string, Record<string, string>[]>();
  for (const a of addresses.records) {
    if (!a.heinum) continue;
    const list = addr.get(a.heinum) ?? [];
    list.push(a);
    addr.set(a.heinum, list);
  }
  const today = new Date().toISOString().slice(0, 10);
  const rows = csv.records.map((r) => normalizeSale(r, today));
  const ids = new Map<string, number>(),
    documents = new Map<string, number>();
  for (const r of csv.records) {
    ids.set(r.faerslunumer, (ids.get(r.faerslunumer) ?? 0) + 1);
    const key = r.emnr + "|" + r.skjalanumer;
    documents.set(key, (documents.get(key) ?? 0) + 1);
  }
  const locationCache = new Map<
    string,
    Pick<Sale, "coordinates" | "coordinateQuality" | "district">
  >();
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i],
      raw = csv.records[i];
    if ((ids.get(s.id) ?? 0) > 1) s.reasons.push("duplicate_id");
    if ((documents.get(raw.emnr + "|" + raw.skjalanumer) ?? 0) > 1)
      s.reasons.push("multiple_rows_per_document");
    s.usable = !s.reasons.length;
    if (!s.capital) continue;
    const key = s.heinum + "|" + s.municipality;
    if (!locationCache.has(key)) {
      const candidates = addr.get(s.heinum) ?? [];
      const eligible = candidates.filter(
        (a) => a.svfnr === s.municipality && !["2", "9"].includes(a.yfirfarid),
      );
      const points = new Map<string, Record<string, string>>();
      for (const a of eligible) {
        const lat = numberValue(a.n_hnit_wgs84),
          lon = numberValue(a.e_hnit_wgs84);
        if (lat && lon && lat >= 63 && lat <= 67.5 && lon >= -25 && lon <= -12)
          points.set(`${lon},${lat}`, a);
      }
      let coordinates: [number, number] | null = null,
        district: string | null = null,
        coordinateQuality = candidates.length
          ? "ambiguous_or_rejected"
          : "unmatched";
      if (points.size === 1) {
        const a = [...points.values()][0];
        coordinates = [
          numberValue(a.e_hnit_wgs84)!,
          numberValue(a.n_hnit_wgs84)!,
        ];
        coordinateQuality =
          a.yfirfarid === "1" ? "reviewed" : "official_unreviewed";
        const found = geo.features.filter((f) =>
          booleanPointInPolygon(coordinates!, f),
        );
        if (s.municipality === "0000" && found.length === 1)
          district = String(found[0].properties?.HVERFI);
      }
      locationCache.set(key, { coordinates, coordinateQuality, district });
    }
    Object.assign(s, locationCache.get(key));
  }
  // Flag distribution tails within municipality/year/type. No arbitrary global price cutoff.
  const cohorts = new Map<string, Sale[]>();
  for (const s of rows.filter((s) => s.usable)) {
    const key = `${s.municipality}|${s.year}|${s.type}`;
    const list = cohorts.get(key) ?? [];
    list.push(s);
    cohorts.set(key, list);
  }
  const fences: Record<string, { n: number; lower: number; upper: number }> =
    {};
  for (const [key, sales] of cohorts) {
    if (sales.length < 30) continue;
    const logs = sales.map((s) => Math.log(s.ppm)),
      q1 = quantile(logs, 0.25)!,
      q3 = quantile(logs, 0.75)!,
      iqr = q3 - q1;
    if (iqr === 0) continue;
    const lower = Math.exp(q1 - 3 * iqr),
      upper = Math.exp(q3 + 3 * iqr);
    fences[key] = { n: sales.length, lower, upper };
    for (const s of sales)
      if (s.ppm < lower || s.ppm > upper) {
        s.reasons.push("extreme_local_ppm");
        s.usable = false;
      }
  }
  const count = (key: (s: Sale) => string) =>
    Object.fromEntries(
      [...new Set(rows.map(key))].map((k) => [
        k,
        rows.filter((s) => key(s) === k).length,
      ]),
    );
  const distributions: Record<string, unknown> = {};
  for (const key of ["price", "area", "ppm", "rooms", "built"] as const) {
    const a = rows
      .filter((s) => s.usable)
      .map((s) => s[key])
      .filter((x): x is number => x !== null);
    distributions[key] = {
      n: a.length,
      min: a.reduce((n, x) => Math.min(n, x), Infinity),
      p01: quantile(a, 0.01),
      median: median(a),
      p99: quantile(a, 0.99),
      max: a.reduce((n, x) => Math.max(n, x), -Infinity),
    };
  }
  const valid = rows.filter((s) => s.capital && s.usable);
  const properties = buildPropertyIndex(rows, csv.records);
  const report = {
    propertyCount: properties.length,
    generatedAt: new Date().toISOString(),
    sources: manifest,
    encoding: csv.encoding,
    delimiter: csv.delimiter,
    headers: csv.headers,
    sourceRows: rows.length,
    validRows: rows.filter(
      (s) =>
        !s.reasons.some((r) =>
          ["invalid_date", "invalid_price", "invalid_area"].includes(r),
        ),
    ).length,
    invalidRows: rows.filter((s) =>
      s.reasons.some((r) =>
        ["invalid_date", "invalid_price", "invalid_area"].includes(r),
      ),
    ).length,
    usableContracts: rows.filter(
      (s) =>
        !s.reasons.includes("hms_unsuitable") &&
        !s.reasons.includes("unknown_suitability"),
    ).length,
    residentialSales: rows.filter((s) => s.residential).length,
    capitalSales: rows.filter((s) => s.capital).length,
    analyticalSales: valid.length,
    matchedSales: valid.filter((s) => s.coordinates).length,
    districtSales: valid.filter((s) => s.district).length,
    addressRows: addresses.records.length,
    coordinateQuality: count((s) => s.coordinateQuality),
    exclusions: Object.fromEntries(
      [...new Set(rows.flatMap((s) => s.reasons))].map((reason) => [
        reason,
        rows.filter((s) => s.reasons.includes(reason)).length,
      ]),
    ),
    nulls: Object.fromEntries(
      csv.headers.map((k) => {
        const n = csv.records.filter((r) => !r[k]?.trim()).length;
        return [k, { count: n, rate: n / rows.length }];
      }),
    ),
    distributions,
    latestSale: rows.reduce((a, s) => (s.date > a ? s.date : a), ""),
    latestRegistration: rows.reduce(
      (a, s) => ((s.registered ?? "") > a ? s.registered! : a),
      "",
    ),
    earliestSale: rows
      .filter((s) => s.date)
      .reduce((a, s) => (s.date < a ? s.date : a), today),
    monetaryMultiplier: 1000,
    monetaryUnitStatus:
      "inferred from observed scale; source field description omits unit",
    exampleRecords: csv.records.slice(-3),
    fences,
  };
  for (const [path, bytes] of [
    ["data/processed/properties.json.gz", gzipSync(JSON.stringify(properties))],
    ["data/processed/sales.json.gz", gzipSync(JSON.stringify(valid))],
    ["data/processed/audit.json.gz", gzipSync(JSON.stringify(rows))],
    ["data/processed/report.json", JSON.stringify(report, null, 2)],
  ] as const) {
    await writeFile(path + ".tmp", bytes);
    await rename(path + ".tmp", path);
  }
  // Reduce precision to ~1 m; preserve official geometry topology and every vertex.
  const publicGeo = {
    ...geo,
    features: geo.features.map((f) => ({
      ...f,
      properties: {
        kind: "district",
        id: String(f.properties?.HVERFI),
        name: String(f.properties?.HVERFI),
      },
      geometry: JSON.parse(
        JSON.stringify(f.geometry, (_, v) =>
          typeof v === "number" ? Math.round(v * 1e5) / 1e5 : v,
        ),
      ),
    })),
  };
  await writeFile("public/data/districts.geojson", JSON.stringify(publicGeo));
  const postal = JSON.parse(
    await readFile("data/raw/postnumer.geojson", "utf8"),
  ) as GeoJSON.FeatureCollection;
  const memberships = new Map<string, Set<string>>();
  for (const sale of rows.filter((s) => s.capital)) {
    const codes = memberships.get(sale.postcode) ?? new Set<string>();
    codes.add(sale.municipality);
    memberships.set(sale.postcode, codes);
  }
  const postalFeatures = postal.features
    .filter((f) => memberships.has(String(f.properties?.postnumer)))
    .map((f) => ({
      ...f,
      properties: {
        kind: "postcode",
        id: String(f.properties?.postnumer),
        name: `${f.properties?.postnumer} ${f.properties?.stadur}`,
        municipalityCodes: [
          ...memberships.get(String(f.properties?.postnumer))!,
        ],
      },
    }));
  if (!postalFeatures.some((f) => f.properties.id === "200"))
    throw Error("Missing Kópavogur postcode geometry");
  await writeFile(
    "public/data/areas.geojson",
    JSON.stringify({
      type: "FeatureCollection",
      features: [...publicGeo.features, ...postalFeatures],
    }),
  );
  console.log(
    JSON.stringify(
      {
        sourceRows: report.sourceRows,
        analyticalSales: valid.length,
        matchedSales: report.matchedSales,
        districtSales: report.districtSales,
        latestSale: report.latestSale,
        distributions,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
