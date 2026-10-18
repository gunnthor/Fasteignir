// CSV for aggregated exports. Isomorphic and pure.
//
// Format, chosen for Icelandic spreadsheets (as on gagnagatt.reykjavik.is and
// Hagstofa): UTF-8 with BOM, semicolon separators, decimal comma, CRLF line
// endings, RFC 4180 quoting. Metadata lines start with "#" before the header row
// (read with comment="#" in pandas/R). Text cells that a spreadsheet could
// execute as a formula are prefixed with an apostrophe.
export type Cell = string | number | null | undefined;
export type Column<T> = {
  key: string;
  label: string;
  value: (row: T) => Cell;
  digits?: number;
};

const FORMULA = /^[=+\-@\t\r]/;
export function csvCell(v: Cell, digits = 0): string {
  if (
    v === null ||
    v === undefined ||
    (typeof v === "number" && !Number.isFinite(v))
  )
    return "";
  let s =
    typeof v === "number"
      ? (digits ? v.toFixed(digits) : String(Math.round(v))).replace(".", ",")
      : v.replace(/\r\n?/g, "\n");
  if (typeof v === "string" && FORMULA.test(s)) s = "'" + s;
  return /[;"\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>({
  meta,
  columns,
  rows,
}: {
  meta: [string, string][];
  columns: Column<T>[];
  rows: T[];
}) {
  const lines = [
    // Kept unquoted so readers can skip them as comments: no separators or quotes.
    ...meta.map(([k, v]) =>
      `# ${k}: ${v}`
        .replace(/\s*[\r\n]+\s*/g, " ")
        .replace(/;/g, ",")
        .replace(/"/g, "'"),
    ),
    columns.map((c) => csvCell(c.label)).join(";"),
    ...rows.map((r) =>
      columns.map((c) => csvCell(c.value(r), c.digits)).join(";"),
    ),
  ];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
