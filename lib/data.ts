import { parse } from "csv-parse/sync";
import type { Sale } from "./types";
export const MUNICIPALITIES: Record<string, string> = {
  "0000": "Reykjavík",
  "1000": "Kópavogur",
  "1100": "Seltjarnarnes",
  "1300": "Garðabær",
  "1400": "Hafnarfjörður",
  "1604": "Mosfellsbær",
  "1606": "Kjósarhreppur",
};
export function decodeCSV(buffer: Uint8Array) {
  let encoding = "utf-8";
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    encoding = "windows-1252";
    text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
  }
  const head = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0];
  const delimiter = [";", ",", "|", "\t"].sort(
    (a, b) => head.split(b).length - head.split(a).length,
  )[0];
  const records = parse(text, {
    bom: true,
    delimiter,
    columns: (keys: string[]) => keys.map((k) => k.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  return {
    records,
    encoding,
    delimiter,
    headers: Object.keys(records[0] ?? {}),
  };
}
export function numberValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
export function isoDate(v: string | undefined): string | null {
  const s = v?.trim().slice(0, 10);
  if (!s) return null;
  const parts = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  const date = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(date + "T00:00:00Z");
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === date
    ? date
    : null;
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const a = [...values].sort((a, b) => a - b),
    m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const a = [...values].sort((a, b) => a - b),
    i = (a.length - 1) * q,
    l = Math.floor(i);
  return a[l] + (a[Math.ceil(i)] - a[l]) * (i - l);
}
export const normalizeText = (s: string) =>
  s.normalize("NFC").trim().replace(/\s+/g, " ");
export function normalizeSale(r: Record<string, string>, today: string): Sale {
  const date = isoDate(r.utgdag),
    price = (numberValue(r.kaupverd) ?? 0) * 1000,
    area = numberValue(r.einflm) ?? 0;
  const type =
    r.tegund === "Fjölbýli"
      ? "apartment"
      : ["Sérbýli", "Einbýli"].includes(r.tegund)
        ? "house"
        : "other";
  const municipality = (r.svfn ?? "").padStart(4, "0"),
    built = numberValue(r.byggar),
    rooms = numberValue(r.fjherb),
    valuation = numberValue(r.fasteignamat);
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (r.onothaefur_samningur !== "0")
    reasons.push(
      r.onothaefur_samningur === "1" ? "hms_unsuitable" : "unknown_suitability",
    );
  if (r.fullbuid !== "1") reasons.push("incomplete_or_unknown");
  if (type === "other") reasons.push("non_residential");
  if (!date || date > today) reasons.push("invalid_date");
  if (price <= 0) reasons.push("invalid_price");
  if (area <= 0) reasons.push("invalid_area");
  const validBuilt =
    built && date && built >= 1000 && built <= Number(date.slice(0, 4))
      ? built
      : null;
  if (!validBuilt) warnings.push("missing_or_invalid_build_year");
  if (!rooms || rooms > 20) warnings.push("missing_or_unusual_rooms");
  return {
    id: r.faerslunumer,
    address: normalizeText(r.heimilisfang ?? ""),
    postcode: (r.postnr ?? "").trim(),
    municipality,
    municipalityName:
      MUNICIPALITIES[municipality] ?? normalizeText(r.sveitarfelag ?? ""),
    heinum: r.heinum,
    propertyId: r.fastnum,
    date: date ?? "",
    registered: isoDate(r.thinglystdags),
    year: date ? Number(date.slice(0, 4)) : 0,
    month: date?.slice(0, 7) ?? "",
    price,
    valuation: valuation && valuation > 0 ? valuation * 1000 : null,
    area,
    rooms: rooms && rooms > 0 && rooms <= 20 ? rooms : null,
    built: validBuilt,
    age: validBuilt && date ? Number(date.slice(0, 4)) - validBuilt : null,
    type,
    residential: type !== "other",
    capital: municipality in MUNICIPALITIES,
    usable: !reasons.length,
    reasons,
    warnings,
    ppm: area > 0 ? price / area : 0,
    coordinates: null,
    coordinateQuality: "unmatched",
    district: null,
  };
}
