// Standalone SVG charts for image export. Isomorphic and pure: built from the
// same data the page shows, never from the rendered DOM, so an exported image
// carries its own title, area, period, units, sample size, source, data date
// and warnings and looks the same in every browser.
import { escapeXml as x } from "./atom";

export type Theme = "light" | "dark";
const THEMES = {
  light: {
    bg: "#ffffff",
    text: "#223a33",
    muted: "#53665d",
    grid: "#e5eae5",
    series: ["#2e715c", "#c9560c"],
  },
  dark: {
    bg: "#1c2b25",
    text: "#e7eee9",
    muted: "#a0b1a7",
    grid: "#35483f",
    series: ["#8bccae", "#e08a4f"],
  },
} as const;
const FONT = "DM Sans, Arial, Helvetica, sans-serif";

export type ChartSpec = {
  kind: "line" | "bar";
  title: string;
  // Area, period and filters, one short line each.
  subtitle: string[];
  // Y-axis unit, e.g. "þ.kr./m²".
  unit: string;
  labels: string[];
  series: { name: string; values: (number | null)[] }[];
  // Shown under the chart: sample size, source, data date, warnings.
  footer: string[];
  format: (v: number) => string;
  theme?: Theme;
  width?: number;
  height?: number;
  // Axis starts at zero (counts, shares).
  zero?: boolean;
};

// About five round tick values covering [lo, hi].
export function niceTicks(lo: number, hi: number, count = 5) {
  if (!(hi > lo)) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / count,
    p = 10 ** Math.floor(Math.log10(raw)),
    step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)!,
    start = Math.floor(lo / step) * step,
    ticks: number[] = [];
  for (let t = start; t <= hi + step * 0.5 && ticks.length < 12; t += step)
    ticks.push(Math.round(t / step) * step);
  if (ticks.at(-1)! < hi) ticks.push(ticks.at(-1)! + step);
  return ticks;
}

// Long text is cut at word boundaries into lines of about `max` characters.
function wrap(text: string, max: number) {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if (line && (line + " " + w).length > max) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

export function chartSvg(spec: ChartSpec) {
  const W = spec.width ?? 1200,
    c = THEMES[spec.theme ?? "light"],
    footer = spec.footer.flatMap((f) => wrap(f, 150)).slice(0, 6),
    top =
      40 +
      40 +
      spec.subtitle.length * 26 +
      (spec.series.length > 1 ? 34 : 0) +
      30,
    plotH = 360,
    H = spec.height ?? top + plotH + 60 + footer.length * 22 + 30,
    left = 96,
    right = 40,
    plotW = W - left - right,
    bottom = top + plotH;
  const values = spec.series
    .flatMap((s) => s.values)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const lo = spec.zero || spec.kind === "bar" ? 0 : Math.min(...values),
    hi = values.length ? Math.max(...values) : 1,
    ticks = niceTicks(values.length ? lo : 0, hi),
    y0 = ticks[0],
    y1 = ticks.at(-1)!,
    y = (v: number) => bottom - ((v - y0) / (y1 - y0 || 1)) * plotH,
    n = spec.labels.length,
    band = plotW / Math.max(n, 1),
    cx = (i: number) => left + band * (i + 0.5);
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" font-family="${FONT}">`,
    `<title>${x(spec.title)}</title>`,
    `<desc>${x([...spec.subtitle, ...spec.footer].join(". "))}</desc>`,
    `<rect width="${W}" height="${H}" fill="${c.bg}"/>`,
    `<text x="40" y="64" font-size="30" font-weight="700" fill="${c.text}">${x(spec.title)}</text>`,
    ...spec.subtitle.map(
      (s, i) =>
        `<text x="40" y="${100 + i * 26}" font-size="19" fill="${c.muted}">${x(s)}</text>`,
    ),
  ];
  if (spec.series.length > 1) {
    let lx = 40;
    const ly = 100 + spec.subtitle.length * 26 + 8;
    spec.series.forEach((s, i) => {
      out.push(
        `<rect x="${lx}" y="${ly - 13}" width="16" height="16" rx="3" fill="${c.series[i % 2]}"/>`,
        `<text x="${lx + 24}" y="${ly}" font-size="18" fill="${c.text}">${x(s.name)}</text>`,
      );
      lx += 24 + s.name.length * 10 + 40;
    });
  }
  out.push(
    `<text x="${left}" y="${top - 14}" font-size="16" fill="${c.muted}">${x(spec.unit)}</text>`,
  );
  for (const t of ticks)
    out.push(
      `<line x1="${left}" x2="${W - right}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="${c.grid}" stroke-dasharray="4 5"/>`,
      `<text x="${left - 12}" y="${(y(t) + 6).toFixed(1)}" font-size="16" text-anchor="end" fill="${c.muted}">${x(spec.format(t))}</text>`,
    );
  // Up to ~12 x labels, evenly spaced.
  const every = Math.max(1, Math.ceil(n / 12));
  spec.labels.forEach((l, i) => {
    if (i % every === 0 || i === n - 1)
      out.push(
        `<text x="${cx(i).toFixed(1)}" y="${bottom + 28}" font-size="15" text-anchor="middle" fill="${c.muted}">${x(l)}</text>`,
      );
  });
  spec.series.forEach((s, si) => {
    const color = c.series[si % 2];
    if (spec.kind === "bar") {
      const k = spec.series.length,
        w = Math.max(1, (band * 0.72) / k);
      s.values.forEach((v, i) => {
        if (v === null || !Number.isFinite(v)) return;
        const top_ = y(Math.max(v, y0)),
          bx = cx(i) - (w * k) / 2 + w * si;
        out.push(
          `<rect x="${bx.toFixed(1)}" y="${top_.toFixed(1)}" width="${(w - 1).toFixed(1)}" height="${(bottom - top_).toFixed(1)}" fill="${color}"/>`,
        );
      });
    } else {
      // Gaps (suppressed values) break the line instead of being interpolated.
      let d = "",
        pen = false;
      s.values.forEach((v, i) => {
        if (v === null || !Number.isFinite(v)) return void (pen = false);
        d += `${pen ? "L" : "M"}${cx(i).toFixed(1)} ${y(v).toFixed(1)}`;
        pen = true;
      });
      if (d)
        out.push(
          `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`,
        );
      // Isolated points between gaps stay visible.
      s.values.forEach((v, i) => {
        const isolated =
          v !== null &&
          (s.values[i - 1] ?? null) === null &&
          (s.values[i + 1] ?? null) === null;
        if (isolated)
          out.push(
            `<circle cx="${cx(i).toFixed(1)}" cy="${y(v!).toFixed(1)}" r="3.5" fill="${color}"/>`,
          );
      });
    }
  });
  out.push(
    `<line x1="${left}" x2="${W - right}" y1="${bottom}" y2="${bottom}" stroke="${c.muted}"/>`,
  );
  footer.forEach((f, i) =>
    out.push(
      `<text x="40" y="${bottom + 70 + i * 22}" font-size="15" fill="${c.muted}">${x(f)}</text>`,
    ),
  );
  out.push(
    `<text x="${W - 40}" y="${H - 20}" font-size="15" text-anchor="end" font-weight="700" fill="${c.text}">fasteign.gunnthor.is</text>`,
    "</svg>",
  );
  return out.join("\n");
}
