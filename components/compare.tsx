"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Info } from "lucide-react";
import {
  date,
  money,
  num,
  numberIS,
  percent,
  ppm,
  sqm,
  strings,
  year,
} from "@/lib/format";
import {
  apiParams,
  areaKey,
  parseArea,
  serializeFilters,
  NOMINAL_CAVEAT,
  type AreaRef,
  type FilterState,
} from "@/lib/share";
import type { AreaOption } from "@/lib/compare";
import type { Stats } from "@/lib/types";
import { FilterBar, syncUrl } from "./filter-bar";
import { DataTable } from "./data-table";
const CompareTrendChart = dynamic(
  () => import("./insight-charts").then((m) => m.CompareTrendChart),
  { ssr: false, loading: () => <div className="chart skeleton" /> },
);
const DistributionChart = dynamic(
  () => import("./insight-charts").then((m) => m.DistributionChart),
  { ssr: false, loading: () => <div className="chart skeleton" /> },
);

type Side = {
  area: AreaRef;
  name: string;
  summary: Stats;
  areaLow: number | null;
  areaHigh: number | null;
  mix: { apartment: number; house: number } | null;
};
type Comparison = {
  a: Side;
  b: Side;
  comparable: boolean;
  difference: number | null;
  areaDifference: number | null;
  distribution:
    | { label: string; a: number; b: number; aCount: number; bCount: number }[]
    | null;
  trend: {
    month: string;
    a: number | null;
    b: number | null;
    aCount: number;
    bCount: number;
  }[];
  from: string;
  to: string;
  downloadedAt: string;
};
const groups = [
  ["postcode", "Póstnúmer"],
  ["district", "Borgarhlutar Reykjavíkur"],
  ["municipality", "Sveitarfélög"],
] as const;

function AreaSelect({
  label,
  value,
  options,
  onChange,
  side,
}: {
  label: string;
  value: AreaRef;
  options: AreaOption[];
  onChange: (a: AreaRef) => void;
  side: "a" | "b";
}) {
  return (
    <label className="area-select">
      <span>
        <span className={`swatch swatch-${side}`} /> {label}
      </span>
      <select
        value={areaKey(value)}
        onChange={(e) => {
          const a = parseArea(e.target.value);
          if (a) onChange(a);
        }}
      >
        {groups.map(([kind, title]) => (
          <optgroup key={kind} label={title}>
            {options
              .filter((o) => o.kind === kind)
              .map((o) => (
                <option key={areaKey(o)} value={areaKey(o)}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function SideCard({ s, side }: { s: Side; side: "a" | "b" }) {
  const total = s.mix ? s.mix.apartment + s.mix.house : 0;
  return (
    <article className={`panel compare-side side-${side}`}>
      <span className="eyebrow">
        <span className={`swatch swatch-${side}`} /> SVÆÐI {side.toUpperCase()}
      </span>
      <h2>{s.name}</h2>
      <div className="hero-stat">
        <span>Miðgildi söluverðs á m²</span>
        <strong>{ppm(s.summary.ppm)}</strong>
        <small>{num(s.summary.count)} gildar sölur</small>
      </div>
      {s.summary.sparse && (
        <p className="notice">
          {s.summary.count < 5 ? strings.suppressed : strings.sparse}
        </p>
      )}
      <div className="stat-grid">
        <div>
          <span>Miðgildi kaupverðs</span>
          <strong>{money(s.summary.price)}</strong>
        </div>
        <div>
          <span>Stærð · miðgildi</span>
          <strong>{sqm(s.summary.area)}</strong>
          {s.areaLow !== null && (
            <small>
              Helmingur {num(s.areaLow)}–{num(s.areaHigh)} m²
            </small>
          )}
        </div>
        <div>
          <span>Samsetning</span>
          <strong>
            {s.mix && total
              ? `${num((s.mix.apartment / total) * 100)}% fjölbýli`
              : "—"}
          </strong>
          {s.mix && total > 0 && (
            <small>
              {num(s.mix.apartment)} fjölbýli · {num(s.mix.house)} sérbýli
            </small>
          )}
        </div>
        <div>
          <span>Byggingarár · miðgildi</span>
          <strong>{year(s.summary.built)}</strong>
        </div>
        <div>
          <span>Breyting frá fyrra tímabili</span>
          <strong>{percent(s.summary.change)}</strong>
        </div>
        <div>
          <span>Herbergi · miðgildi</span>
          <strong>{num(s.summary.rooms)}</strong>
        </div>
      </div>
    </article>
  );
}

export function Compare({
  options,
  initial,
}: {
  options: AreaOption[];
  initial: { a: AreaRef; b: AreaRef; filters: FilterState };
}) {
  const [a, setA] = useState(initial.a),
    [b, setB] = useState(initial.b),
    [filters, setFilters] = useState(initial.filters),
    [data, setData] = useState<Comparison | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const search = (() => {
    const p = new URLSearchParams({ a: areaKey(a), b: areaKey(b) });
    // Colons are legal in a query string; keep shared links readable.
    return serializeFilters(filters, undefined, p)
      .toString()
      .replace(/%3A/gi, ":");
  })();
  useEffect(() => syncUrl(search), [search]);
  useEffect(() => {
    if (filters.months === "custom" && (!filters.from || !filters.to)) {
      setError("Veldu upphafs- og lokadagsetningu.");
      setLoading(false);
      return;
    }
    const abort = new AbortController(),
      p = apiParams(filters);
    p.set("a", areaKey(a));
    p.set("b", areaKey(b));
    setLoading(true);
    setError("");
    fetch(`/api/compare?${p}`, { signal: abort.signal })
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
  }, [a, b, filters]);
  const names: [string, string] = data
    ? [data.a.name, data.b.name]
    : ["A", "B"];
  return (
    <main id="main" className="insight-page">
      <span className="eyebrow">SAMANBURÐUR · ÞINGLÝST KAUPVERÐ</span>
      <h1>Tvö svæði, hlið við hlið.</h1>
      <p className="intro">
        Berðu saman raunverulegt söluverð, fjölda kaupsamninga og hvers konar
        eignir seldust á tveimur svæðum með sömu síum.
      </p>
      <div className="compare-pickers panel">
        <AreaSelect
          label="Svæði A"
          side="a"
          value={a}
          options={options}
          onChange={setA}
        />
        <button
          className="icon-button swap-button"
          aria-label="Víxla svæðum"
          onClick={() => {
            setA(b);
            setB(a);
          }}
        >
          <ArrowLeftRight size={18} />
        </button>
        <AreaSelect
          label="Svæði B"
          side="b"
          value={b}
          options={options}
          onChange={setB}
        />
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {data && (
        <div
          className={`insight-body ${loading ? "updating" : ""}`}
          aria-busy={loading}
        >
          <p className="caption">
            {date(data.from)} – {date(data.to)} · Gögn sótt{" "}
            {date(data.downloadedAt)}
          </p>
          <div className="compare-verdict panel">
            {data.comparable && data.difference !== null ? (
              <>
                <p className="verdict">
                  Miðgildi á m² er{" "}
                  <strong>
                    {numberIS(Math.abs(data.difference), 1)}%{" "}
                    {data.difference >= 0 ? "hærra" : "lægra"}
                  </strong>{" "}
                  á svæði A ({data.a.name}) en á svæði B ({data.b.name}).
                </p>
                <p className="micro">
                  Munur á miðgildum segir ekki að sambærileg eign kosti svo
                  miklu meira. Seldar eignir eru misstórar, misgamlar og af
                  ólíkri gerð
                  {data.areaDifference !== null &&
                    Math.abs(data.areaDifference) >= 5 &&
                    ` — miðgildi stærðar er ${numberIS(Math.abs(data.areaDifference), 0)}% ${data.areaDifference > 0 ? "meira" : "minna"} á svæði A`}
                  . {NOMINAL_CAVEAT}
                </p>
              </>
            ) : (
              <p className="verdict-muted">
                <Info size={16} /> Samanburður er ekki birtur: færri en 5 gildar
                sölur á öðru svæðinu eða báðum. Prófaðu lengra tímabil eða færri
                síur.
              </p>
            )}
          </div>
          <div className="compare-sides">
            <SideCard s={data.a} side="a" />
            <SideCard s={data.b} side="b" />
          </div>
          <div className="legend-row" aria-hidden="true">
            {(["a", "b"] as const).map((k, i) => (
              <span key={k}>
                <span className={`swatch swatch-${k}`} /> {names[i]}
              </span>
            ))}
          </div>
          {data.distribution && (
            <article className="panel insight-chart">
              <h3>Verðdreifing á m²</h3>
              <p className="caption">
                Hlutfall kaupsamninga hvors svæðis í hverju verðbili, þ.kr./m²
              </p>
              <DistributionChart data={data.distribution} names={names} />
              <DataTable
                head={["þ.kr./m²", names[0], names[1]]}
                rows={data.distribution.map((d) => [
                  d.label,
                  `${numberIS(d.a, 1)}% (${num(d.aCount)})`,
                  `${numberIS(d.b, 1)}% (${num(d.bCount)})`,
                ])}
              />
            </article>
          )}
          <article className="panel insight-chart">
            <h3>Verðþróun</h3>
            <p className="caption">
              3 mánaða hlaupandi miðgildi á m². Gluggar með færri en 5 sölur eru
              ekki sýndir.
            </p>
            <CompareTrendChart data={data.trend} names={names} />
            <DataTable
              head={["Mánuður", names[0], names[1]]}
              rows={data.trend
                .slice()
                .reverse()
                .map((t) => [
                  t.month,
                  `${ppm(t.a)} (${num(t.aCount)})`,
                  `${ppm(t.b)} (${num(t.bCount)})`,
                ])}
            />
          </article>
          <p className="micro">
            Heimild: HMS Kaupskrá fasteigna. Sömu reglur og á kortinu: einungis
            gildir kaupsamningar íbúðarhúsnæðis, miðgildi reiknuð beint úr
            sölum.{" "}
            <Link href="/um-gognin" className="green">
              Um gögnin
            </Link>
          </p>
        </div>
      )}
      {!data && loading && <div className="skeleton skeleton-panel" />}
    </main>
  );
}
