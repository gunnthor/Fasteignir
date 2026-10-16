"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { date, money, num, numberIS, sqm, strings } from "@/lib/format";
import {
  apiParams,
  question,
  serializeFilters,
  NOMINAL_CAVEAT,
  type FilterState,
} from "@/lib/share";
import { FilterBar, syncUrl } from "./filter-bar";
import { DataTable } from "./data-table";
const BudgetCurveChart = dynamic(
  () => import("./insight-charts").then((m) => m.BudgetCurveChart),
  { ssr: false, loading: () => <div className="chart skeleton" /> },
);
const SizeChart = dynamic(
  () => import("./insight-charts").then((m) => m.SizeChart),
  { ssr: false, loading: () => <div className="chart skeleton" /> },
);

type Summary = {
  count: number;
  within: number;
  share: number | null;
  sparse: boolean;
  area: number | null;
  areaLow: number | null;
  areaHigh: number | null;
  price: number | null;
  rooms: number | null;
};
type Result = {
  budget: number;
  from: string;
  to: string;
  overall: Summary;
  sizes: { label: string; count: number }[] | null;
  curve: { budget: number; share: number }[] | null;
  level: "municipality" | "postcode" | null;
  areas: (Summary & { id: string; name: string })[];
  downloadedAt: string;
};

const pct = (n: number | null) => (n === null ? "—" : `${numberIS(n, 0)}%`);

export function Budget({
  initial,
}: {
  initial: { budget: number; filters: FilterState };
}) {
  const [budget, setBudget] = useState(initial.budget),
    [text, setText] = useState(String(initial.budget / 1e6)),
    [applied, setApplied] = useState(initial.budget),
    [filters, setFilters] = useState(initial.filters),
    [data, setData] = useState<Result | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  // The slider moves freely; requests follow once it settles.
  useEffect(() => {
    const t = setTimeout(() => setApplied(budget), 250);
    return () => clearTimeout(t);
  }, [budget]);
  const search = serializeFilters(
    filters,
    undefined,
    new URLSearchParams({ budget: String(applied) }),
  ).toString();
  useEffect(() => syncUrl(search), [search]);
  useEffect(() => {
    if (filters.months === "custom" && (!filters.from || !filters.to)) {
      setError("Veldu upphafs- og lokadagsetningu.");
      setLoading(false);
      return;
    }
    const abort = new AbortController(),
      p = apiParams(filters);
    p.set("budget", String(applied));
    setLoading(true);
    setError("");
    fetch(`/api/budget?${p}`, { signal: abort.signal })
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
  }, [applied, filters]);
  const drill = (id: string) =>
    setFilters((f) =>
      data?.level === "municipality"
        ? { ...f, municipality: id, postcode: "" }
        : { ...f, postcode: id },
    );
  const o = data?.overall;
  return (
    <main id="main" className="insight-page">
      <span className="eyebrow">KAUPGETA · SELDAR EIGNIR</span>
      <h1>{question(filters, applied)}</h1>
      <p className="intro">
        Sláðu inn heildarverð og sjáðu hvar sambærilegar eignir hafa í raun
        selst á því verði eða lægra.
      </p>
      <div className="budget-control panel">
        <label htmlFor="budget-range">Hámarksverð</label>
        <div className="budget-inputs">
          <input
            id="budget-range"
            type="range"
            min={10}
            max={250}
            step={1}
            value={Math.min(250, Math.max(10, budget / 1e6))}
            onChange={(e) => {
              setBudget(+e.target.value * 1e6);
              setText(e.target.value);
            }}
            aria-valuetext={`${num(budget / 1e6)} milljónir króna`}
          />
          <label className="budget-number">
            <input
              type="number"
              min={5}
              max={1000}
              step={1}
              inputMode="numeric"
              aria-label="Hámarksverð í milljónum króna"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                const v = Math.round(+e.target.value);
                if (v >= 5 && v <= 1000) setBudget(v * 1e6);
              }}
            />
            m.kr.
          </label>
        </div>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      <nav className="crumbs" aria-label="Svæði">
        <button
          className={!filters.municipality ? "active" : ""}
          onClick={() =>
            setFilters((f) => ({ ...f, municipality: "", postcode: "" }))
          }
        >
          Höfuðborgarsvæðið
        </button>
        {filters.municipality && (
          <>
            <ChevronRight size={14} />
            <button
              className={!filters.postcode ? "active" : ""}
              onClick={() => setFilters((f) => ({ ...f, postcode: "" }))}
            >
              {MUNICIPALITIES[filters.municipality]}
            </button>
          </>
        )}
        {filters.postcode && (
          <>
            <ChevronRight size={14} />
            <span className="active">Póstnúmer {filters.postcode}</span>
          </>
        )}
      </nav>
      <p className="notice availability" role="note">
        <Info size={16} /> Þetta eru kaupsamningar sem þegar hafa verið gerðir —
        ekki eignir sem eru til sölu í dag.
      </p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {data && o && (
        <div
          className={`insight-body ${loading ? "updating" : ""}`}
          aria-busy={loading}
        >
          <p className="caption">
            {date(data.from)} – {date(data.to)} · Gögn sótt{" "}
            {date(data.downloadedAt)}
          </p>
          <div className="budget-summary panel">
            <div className="hero-stat">
              <span>Seldust á {money(data.budget)} eða minna</span>
              <strong>{pct(o.share)}</strong>
              <small>
                {o.share === null
                  ? `${num(o.count)} sambærilegar sölur — of fáar til að reikna hlutfall`
                  : `${num(o.within)} af ${num(o.count)} sambærilegum kaupsamningum`}
              </small>
            </div>
            <div className="stat-grid">
              <div>
                <span>Stærð innan verðs · miðgildi</span>
                <strong>{sqm(o.area)}</strong>
                {o.areaLow !== null && (
                  <small>
                    Helmingur {num(o.areaLow)}–{num(o.areaHigh)} m²
                  </small>
                )}
              </div>
              <div>
                <span>Kaupverð innan verðs · miðgildi</span>
                <strong>{money(o.price)}</strong>
              </div>
              <div>
                <span>Herbergi · miðgildi</span>
                <strong>{num(o.rooms)}</strong>
              </div>
              <div>
                <span>Sambærilegar sölur alls</span>
                <strong>{num(o.count)}</strong>
              </div>
            </div>
            {o.sparse && (
              <p className="notice">
                {o.count < 5 ? strings.suppressed : strings.sparse}
              </p>
            )}
            {o.within > 0 && o.within < 5 && (
              <p className="notice">
                Færri en 5 sölur innan verðs. Stærðir og verð innan verðs eru
                ekki birt.
              </p>
            )}
          </div>
          {data.level && (
            <article className="panel budget-areas">
              <h3>
                {data.level === "municipality"
                  ? "Eftir sveitarfélögum"
                  : "Eftir póstnúmerum"}
              </h3>
              <p className="caption">
                Fjöldi kaupsamninga innan verðs og hlutfall af sambærilegum
                sölum á svæðinu. Veldu svæði til að skoða nánar.
              </p>
              {data.areas.length ? (
                <ul>
                  {data.areas.map((a) => (
                    <li key={a.id}>
                      <button onClick={() => drill(a.id)}>
                        <span className="budget-area-name">
                          <strong>{a.name}</strong>
                          <small>
                            {num(a.within)} af {num(a.count)} sölum
                            {a.area !== null
                              ? ` · miðgildi ${num(a.area)} m²`
                              : ""}
                            {a.sparse ? " · fáar sölur" : ""}
                          </small>
                        </span>
                        <span className="share-bar" aria-hidden="true">
                          <span style={{ width: `${a.share ?? 0}%` }} />
                        </span>
                        <span className="budget-area-share">
                          {pct(a.share)} <ChevronRight size={14} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="notice">Engar sölur með þessum síum.</p>
              )}
            </article>
          )}
          <div className="insight-grid">
            <article className="panel insight-chart">
              <h3>Hvernig breytist myndin með verðinu?</h3>
              <p className="caption">
                Hlutfall sambærilegra kaupsamninga á eða undir hverri fjárhæð
                (m.kr.)
              </p>
              {data.curve ? (
                <>
                  <BudgetCurveChart data={data.curve} budget={data.budget} />
                  <DataTable
                    head={["Allt að", "Hlutfall seldra eigna"]}
                    rows={data.curve
                      .filter((c) => c.budget % 10_000_000 === 0)
                      .map((c) => [
                        money(c.budget),
                        `${numberIS(c.share, 1)}%`,
                      ])}
                  />
                </>
              ) : (
                <p className="notice">{strings.suppressed}</p>
              )}
            </article>
            <article className="panel insight-chart">
              <h3>Stærð seldra eigna innan verðs</h3>
              <p className="caption">Fjöldi kaupsamninga eftir stærð, m²</p>
              {data.sizes ? (
                <>
                  <SizeChart data={data.sizes} />
                  <DataTable
                    head={["Stærð", "Kaupsamningar"]}
                    rows={data.sizes.map((s) => [
                      `${s.label} m²`,
                      num(s.count),
                    ])}
                  />
                </>
              ) : (
                <p className="notice">
                  Færri en 5 sölur innan verðs. Dreifing er ekki birt.
                </p>
              )}
            </article>
          </div>
          <p className="micro">
            {NOMINAL_CAVEAT} Eldri kaupsamningar endurspegla verðlag þess tíma.
            Heimild: HMS Kaupskrá fasteigna.{" "}
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
