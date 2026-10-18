"use client";
import { useEffect, useState } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { money, num, numberIS, ppm, date } from "@/lib/format";
import {
  apiParams,
  areaLabel,
  filterSummary,
  type FilterState,
} from "@/lib/share";
import {
  binLabel as sharedBinLabel,
  distributionCsv,
  distributionSvg,
  fileName,
  type ExportContext,
} from "@/lib/exports";
import { ExportMenu } from "./export-menu";
import { SAMPLE } from "@/lib/sample";
import type { Bin, Warning } from "@/lib/distribution";
import type { PriceDistribution as Result } from "@/lib/price-distribution";
import { DataTable } from "./data-table";

type Metric = "price" | "ppm";
const unit = { price: "m.kr.", ppm: "þ.kr./m²" } as const;
const scale = { price: 1e6, ppm: 1e3 } as const;
const fmt = (m: Metric, v: number | null | undefined) =>
  m === "price" ? money(v) : ppm(v);
// Axis labels: millions or thousands without the unit (shared with exports).
export const binLabel = (m: Metric, b: Bin) => sharedBinLabel(m, b);

const WARNINGS: Record<Warning, (m: Metric) => string> = {
  mixed_types: () =>
    "Hópurinn blandar saman fjölbýli og sérbýli. Veldu tegund eignar til að bera saman líkari eignir.",
  size_spread: (m) =>
    m === "price"
      ? "Stærð seldra eigna er mjög breytileg. Heildarverð endurspeglar þá stærð fremur en verðlag — skoðaðu verð á m² eða þrengdu stærðarbilið."
      : "Stærð seldra eigna er mjög breytileg og fermetraverð minni eigna er að jafnaði hærra. Þrengdu stærðarbilið fyrir nákvæmari samanburð.",
  long_period: () =>
    "Tímabilið spannar meira en þrjú ár. Verð eru nafnverð, ekki leiðrétt fyrir verðbólgu, svo eldri sölur toga dreifinguna niður.",
  broad_area: () =>
    "Hópurinn nær yfir mörg hverfi með ólíkt verðlag. Veldu póstnúmer eða borgarhluta fyrir þrengri samanburð.",
};
const BAND = {
  low: "í lægsta fjórðungi",
  typical: "innan miðhelmingsins (á milli 25. og 75. hundraðshluta)",
  high: "í hæsta fjórðungi",
} as const;

// Horizontal position (0–100 %) of a value: equal visual width per bin,
// linear within interior bins, centred in the open tails.
function offset(bins: Bin[], v: number) {
  const i = bins.findIndex(
    (b) => (b.from === null || v >= b.from) && (b.to === null || v < b.to),
  );
  if (i < 0) return null;
  const b = bins[i],
    within =
      b.from === null || b.to === null ? 0.5 : (v - b.from) / (b.to - b.from);
  return ((i + within) / bins.length) * 100;
}

export function PriceDistribution({
  filters,
  q,
  metric,
  value,
  onChange,
}: {
  filters: FilterState;
  q: string;
  metric: Metric;
  value: string;
  onChange: (metric: Metric, value: string) => void;
}) {
  const [data, setData] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [text, setText] = useState(
      value ? numberIS(+value / scale[metric], 3).replace(/\./g, "") : "",
    );
  // Typed value (m.kr. or þ.kr./m²) → whole ISK in the view, after a pause.
  useEffect(() => {
    const t = setTimeout(() => {
      const n = Number(text.replace(/\./g, "").replace(",", "."));
      const isk =
        text.trim() && n > 0 ? String(Math.round(n * scale[metric])) : "";
      if (isk !== value) onChange(metric, isk);
    }, 400);
    return () => clearTimeout(t);
  }, [text, metric, value, onChange]);
  useEffect(() => {
    if (filters.months === "custom" && (!filters.from || !filters.to)) return;
    const abort = new AbortController(),
      p = apiParams(filters, q);
    p.set("metric", metric);
    if (value) p.set("value", value);
    setLoading(true);
    setError("");
    fetch(`/api/distribution?${p}`, { signal: abort.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setData(null);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [filters, q, metric, value]);
  const context = (d: Result & { downloadedAt?: string }): ExportContext => ({
    area: areaLabel(filters),
    from: d.from,
    to: d.to,
    filters: filterSummary(filters, q),
    downloadedAt: d.downloadedAt ?? "",
    count: d.count,
  });
  const switchMetric = (m: Metric) => {
    setText("");
    onChange(m, "");
  };
  const bins = data?.bins,
    max = bins ? Math.max(...bins.map((b) => b.count)) : 0,
    quart = data?.quartiles,
    pos = data?.position;
  const label =
    data && bins && quart
      ? `Dreifing ${metric === "price" ? "kaupverðs" : "verðs á m²"} í ${num(data.count)} sölum. 25. hundraðshluti ${fmt(metric, quart.p25)}, miðgildi ${fmt(metric, quart.p50)}, 75. hundraðshluti ${fmt(metric, quart.p75)}.${pos ? ` Valið verð er við ${numberIS(pos.percentile, 0)}. hundraðshluta.` : ""}`
      : "";
  return (
    <article
      className={`panel distribution ${loading ? "updating" : ""}`}
      aria-busy={loading}
    >
      <div className="distribution-head">
        <div>
          <h3>Dreifing verðs</h3>
          <p className="caption">
            Hvernig raunverð skiptist innan valinna sía — ekki aðeins miðgildið.
          </p>
        </div>
        {data && !data.suppressed && (
          <ExportMenu
            name={(ext) =>
              fileName(
                context(data),
                metric === "price" ? "dreifing-verd" : "dreifing-m2",
                ext,
              )
            }
            svg={(theme) => distributionSvg(data, context(data), theme)}
            csv={() => distributionCsv(data, context(data))}
          />
        )}
        <div
          className="segmented"
          role="group"
          aria-label="Mælistærð dreifingar"
        >
          {(
            [
              ["price", "Kaupverð"],
              ["ppm", "Verð á m²"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              aria-pressed={metric === m}
              className={metric === m ? "active" : ""}
              onClick={() => switchMetric(m)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <label className="distribution-value">
        Hvar liggur verð í dreifingunni?
        <span>
          <input
            inputMode="decimal"
            value={text}
            placeholder={metric === "price" ? "t.d. 75" : "t.d. 850"}
            onChange={(e) => setText(e.target.value)}
            aria-describedby="distribution-unit"
          />
          <span id="distribution-unit">{unit[metric]}</span>
        </span>
      </label>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="caption">
            {num(data.count)} sölur · {date(data.from)} – {date(data.to)}
            {data.count >= SAMPLE.median &&
              ` · ${num(data.mix.apartment)} í fjölbýli, ${num(data.mix.house)} sérbýli`}
          </p>
          {data.suppressed ? (
            <p className="notice">
              Færri en {SAMPLE.median} sölur. Hvorki miðgildi né dreifing er
              birt.
            </p>
          ) : !data.detailed ? (
            <p className="notice">
              Miðgildi: <strong>{fmt(metric, data.median)}</strong>. Dreifing og
              hundraðshlutar birtast þegar a.m.k. {SAMPLE.distribution} sölur
              eru í hópnum ({num(data.count)} nú).
              {data.sparse && ` Fáar sölur — túlkaðu miðgildið varlega.`}
            </p>
          ) : (
            <>
              {quart && (
                <div className="quartiles">
                  {(
                    [
                      ["25. hundraðshluti", quart.p25],
                      ["Miðgildi", quart.p50],
                      ["75. hundraðshluti", quart.p75],
                    ] as const
                  ).map(([l, v]) => (
                    <div key={l}>
                      <span>{l}</span>
                      <strong>{fmt(metric, v)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {pos && (
                <p className="distribution-position" role="status">
                  <strong>{fmt(metric, pos.value)}</strong> er hærra en um{" "}
                  {numberIS(pos.percentile, 0)}% sambærilegra sala í hópnum —{" "}
                  {BAND[pos.band]}.
                </p>
              )}
              {value && !pos && (
                <p className="micro">Ekki hægt að staðsetja þetta verð.</p>
              )}
              {bins ? (
                <>
                  <div className="histogram" role="img" aria-label={label}>
                    <div className="histogram-bars">
                      {bins.map((b) => (
                        <span
                          key={`${b.from}-${b.to}`}
                          className="histogram-bar"
                          title={`${binLabel(metric, b)} ${unit[metric]}: ${num(b.count)} sölur`}
                        >
                          <span
                            style={{ height: `${(b.count / max) * 100}%` }}
                          />
                        </span>
                      ))}
                      {quart &&
                        (
                          [
                            ["p25", quart.p25],
                            ["p50", quart.p50],
                            ["p75", quart.p75],
                          ] as const
                        ).map(([k, v]) => {
                          const left = offset(bins, v);
                          return left === null ? null : (
                            <span
                              key={k}
                              className={`histogram-mark mark-${k}`}
                              style={{ left: `${left}%` }}
                            />
                          );
                        })}
                      {pos && offset(bins, pos.value) !== null && (
                        <span
                          className="histogram-mark mark-value"
                          style={{ left: `${offset(bins, pos.value)}%` }}
                        />
                      )}
                    </div>
                    <div className="histogram-axis" aria-hidden>
                      <span>{binLabel(metric, bins[0])}</span>
                      <span>{unit[metric]}</span>
                      <span>{binLabel(metric, bins.at(-1)!)}</span>
                    </div>
                  </div>
                  <div className="legend-row histogram-legend" aria-hidden>
                    <span>
                      <span className="swatch mark-quartile" /> 25. og 75.
                      hundraðshluti
                    </span>
                    <span>
                      <span className="swatch mark-median" /> Miðgildi
                    </span>
                    {pos && (
                      <span>
                        <span className="swatch mark-mine" /> Þitt verð
                      </span>
                    )}
                  </div>
                  <DataTable
                    head={[`Bil (${unit[metric]})`, "Sölur", "Hlutfall"]}
                    rows={bins.map((b) => [
                      binLabel(metric, b),
                      num(b.count),
                      `${numberIS(b.share, 1)}%`,
                    ])}
                  />
                </>
              ) : (
                <p className="micro">
                  Verðin liggja of þétt til að birta súlurit án þess að einstök
                  bil sýni færri en {SAMPLE.cell} sölur.
                </p>
              )}
            </>
          )}
          {!data.suppressed &&
            data.warnings.map((w) => (
              <p key={w} className="notice distribution-warning">
                <TriangleAlert size={16} /> {WARNINGS[w](metric)}
              </p>
            ))}
          <details className="explainer">
            <summary>
              <Info size={14} /> Hvernig er dreifingin reiknuð?
            </summary>
            <p>
              Byggt á þinglýstum kaupsamningum HMS sem uppfylla sömu skilyrði og
              aðrar tölur Fasteignar — aldrei á ásettu verði. 25. hundraðshluti
              merkir að fjórðungur sala var á lægra verði; 75. hundraðshluti að
              fjórðungur var á hærra verði. Hundraðshlutar eru reiknaðir með
              línulegri brúun milli raðaðra gilda (sama aðferð og í R og NumPy).
              Staða verðs er hlutfall sala á lægra verði, að viðbættum helmingi
              sala á nákvæmlega sama verði.
            </p>
            <p>
              Miðgildi birtist frá {SAMPLE.median} sölum, viðvörun undir{" "}
              {SAMPLE.warn}, og dreifing og hundraðshlutar frá{" "}
              {SAMPLE.distribution} sölum. Súlur eru jafnbreiðar og ystu
              súlurnar opnar; bilin eru víkkuð þar til engin súla geymir færri
              en {SAMPLE.cell} sölur, svo einstakar sölur verði ekki raktar.
              Nafnverð í krónum, ekki leiðrétt fyrir verðbólgu. Hátt eða lágt
              verð segir ekkert um ástand, staðsetningu innan hverfis eða aðra
              eiginleika sem gögnin ná ekki til.
            </p>
          </details>
        </>
      )}
    </article>
  );
}
