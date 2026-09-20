"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  ChevronRight,
  MapPin,
  X,
  ArrowLeft,
  Info,
  Check,
  Layers,
} from "lucide-react";
import { MUNICIPALITIES } from "@/lib/municipalities";
import type { Exploration, Sale, AreaStats } from "@/lib/types";
import {
  num,
  money,
  ppm,
  percent,
  date,
  districtName,
  strings,
  numberIS,
} from "@/lib/format";
import {
  metricLabels,
  metricFormat,
  breaks,
  palette,
  type Metric,
} from "./map-config";
const SalesMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <div className="map-loading">Hleð korti…</div>,
});
const TrendChart = dynamic(() => import("./chart").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div className="chart skeleton" />,
});
const periods = [
  ["3", "3 mán."],
  ["6", "6 mán."],
  ["12", "12 mán."],
  ["24", "2 ár"],
  ["60", "5 ár"],
  ["0", "Allt"],
  ["custom", "Velja daga"],
];
const initial = {
  months: "12",
  type: "all",
  municipality: "",
  postcode: "",
  district: "",
  minArea: "",
  maxArea: "",
  rooms: "",
  minBuilt: "",
  maxBuilt: "",
  from: "",
  to: "",
};
export function SaleCard({ sale }: { sale: Sale }) {
  return (
    <details className="sale-card">
      <summary>
        <span className="sale-icon">
          <MapPin size={17} />
        </span>
        <span className="sale-description">
          <strong>{sale.address}</strong>
          <span>
            {num(sale.area)} m² · {num(sale.rooms)} herb. · {date(sale.date)}
          </span>
        </span>
        <span className="sale-price">
          <strong>{money(sale.price)}</strong>
          <span>{ppm(sale.ppm)}</span>
        </span>
      </summary>
      <div className="sale-expanded">
        <p>
          {sale.type === "house" ? "Sérbýli" : "Fjölbýli"} · Byggt{" "}
          {num(sale.built)} · {sale.postcode} {sale.municipalityName}
        </p>
        <p>
          Fasteignamat við sölu: {money(sale.valuation)}
          <br />
          Kaupverð umfram mat:{" "}
          {sale.valuation
            ? percent((sale.price / sale.valuation - 1) * 100)
            : "—"}
        </p>
        <p>
          {sale.coordinates
            ? sale.coordinateQuality === "reviewed"
              ? "Hnit yfirfarin í Staðfangaskrá HMS."
              : "Opinber staðfangshnit, ekki merkt yfirfarin."
            : "Áreiðanleg staðsetning á korti ekki tiltæk."}
        </p>
        <small>Heimild: HMS Kaupskrá fasteigna · Færsla {sale.id}</small>
        {/^[0-9]{7}$/.test(sale.propertyId) && (
          <p>
            <Link href={`/verdmat?property=${sale.propertyId}`}>
              Verðmeta þessa eign →
            </Link>
          </p>
        )}
      </div>
    </details>
  );
}
export function Explorer({ dashboard = false }: { dashboard?: boolean }) {
  const [filters, setFilters] = useState(initial),
    [q, setQ] = useState(""),
    [query, setQuery] = useState(""),
    [metric, setMetric] = useState<Metric>("ppm"),
    [data, setData] = useState<Exploration | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [advanced, setAdvanced] = useState(false),
    [points, setPoints] = useState(false),
    [mobileFilters, setMobileFilters] = useState(false),
    [mapLevel, setMapLevel] = useState<"postcode" | "district">("postcode"),
    [tab, setTab] = useState<"district" | "postcode" | "municipality">(
      "postcode",
    );
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q), 350);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    if (filters.months === "custom" && (!filters.from || !filters.to)) {
      setLoading(false);
      setData(null);
      setError("Veldu upphafs- og lokadagsetningu.");
      return () => abort.abort();
    }
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters))
      if (v && !(k === "months" && v === "custom")) p.set(k, v);
    p.set("q", query);
    if (points || query) p.set("points", "1");
    fetch(`/api/explore?${p}`, { signal: abort.signal })
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
  }, [filters, query, points]);
  function update(key: keyof typeof initial, value: string) {
    if (key === "postcode" || key === "municipality") setMapLevel("postcode");
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(key === "months" ? { from: "", to: "" } : {}),
      ...(key === "municipality" ? { postcode: "", district: "" } : {}),
      ...(key === "postcode" ? { district: "" } : {}),
    }));
  }
  const selected = filters.district
    ? districtName(filters.district)
    : filters.postcode
      ? `Póstnúmer ${filters.postcode}`
      : MUNICIPALITIES[filters.municipality] || "Höfuðborgarsvæðið";
  const areaList = data
    ? tab === "district"
      ? data.areas
      : tab === "postcode"
        ? data.postcodes
        : data.municipalities
    : [];
  const cutoffs = data
    ? breaks(mapLevel === "postcode" ? data.postcodes : data.areas, metric)
    : [];
  function choose(a: AreaStats) {
    setMapLevel(a.kind === "district" ? "district" : "postcode");
    setFilters((f) => ({
      ...f,
      district: a.kind === "district" ? a.id : "",
      postcode: a.kind === "postcode" ? a.id : "",
      municipality:
        a.kind === "municipality"
          ? a.id
          : a.kind === "district"
            ? "0000"
            : f.municipality,
    }));
  }
  const controls = (
    <>
      <label>
        Svæðaskipting
        <select
          value={mapLevel}
          onChange={(e) => {
            const level = e.target.value as typeof mapLevel;
            setMapLevel(level);
            setTab(level);
            setFilters((f) => ({
              ...f,
              district: "",
              postcode: "",
              municipality: level === "district" ? "0000" : "",
            }));
          }}
        >
          <option value="postcode">Póstsvæði</option>
          <option value="district">Borgarhlutar Reykjavíkur</option>
        </select>
      </label>
      <div className="control-title">
        <span className="eyebrow">KAUPSAMNINGAR · HMS</span>
        <SlidersHorizontal size={17} />
      </div>
      <h1>
        Hvað seljast
        <br />
        heimilin á?
      </h1>
      <p className="intro">
        Raunverulegt kaupverð.
        <br />
        Skýrari mynd af markaðnum.
      </p>
      <div className="divider" />
      {!dashboard && (
        <>
          <label className="field-label" htmlFor="metric">
            Sýna á korti
          </label>
          <select
            id="metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {Object.entries(metricLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </>
      )}
      <span className="field-label">Tímabil</span>
      <div className="period-grid">
        {periods.map(([value, label]) => (
          <button
            aria-pressed={filters.months === value}
            key={value}
            className={filters.months === value ? "active" : ""}
            onClick={() => update("months", value)}
          >
            {label}
          </button>
        ))}
      </div>
      {filters.months === "custom" && (
        <div className="range">
          <label>
            Frá
            <input
              aria-label="Frá dagsetningu"
              type="date"
              value={filters.from}
              onChange={(e) => update("from", e.target.value)}
            />
          </label>
          <label>
            Til
            <input
              aria-label="Til dagsetningar"
              type="date"
              value={filters.to}
              onChange={(e) => update("to", e.target.value)}
            />
          </label>
        </div>
      )}
      <label className="field-label" htmlFor="type">
        Tegund eignar
      </label>
      <div className="segmented">
        {[
          ["all", "Allar íbúðir"],
          ["apartment", "Fjölbýli"],
          ["house", "Sérbýli"],
        ].map(([v, l]) => (
          <button
            key={v}
            id={v === "all" ? "type" : undefined}
            aria-pressed={filters.type === v}
            className={filters.type === v ? "active" : ""}
            onClick={() => update("type", v)}
          >
            {l}
          </button>
        ))}
      </div>
      <label className="field-label" htmlFor="municipality">
        Sveitarfélag
      </label>
      <select
        id="municipality"
        value={filters.municipality}
        onChange={(e) => update("municipality", e.target.value)}
      >
        <option value="">Öll sveitarfélög</option>
        {Object.entries(MUNICIPALITIES).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button
        className="advanced-button"
        onClick={() => setAdvanced(!advanced)}
        aria-expanded={advanced}
      >
        <SlidersHorizontal size={15} /> Fleiri síur{" "}
        <span>{advanced ? "−" : "+"}</span>
      </button>
      {advanced && (
        <div className="advanced">
          <div className="range">
            {[
              ["minArea", "Frá m²"],
              ["maxArea", "Til m²"],
              ["minBuilt", "Byggt frá"],
              ["maxBuilt", "Byggt til"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  value={filters[key as keyof typeof initial]}
                  onChange={(e) =>
                    update(key as keyof typeof initial, e.target.value)
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Herbergi
            <select
              value={filters.rooms}
              onChange={(e) => update("rooms", e.target.value)}
            >
              <option value="">Öll</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 5 ? "5+" : n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Póstnúmer
            <input
              value={filters.postcode}
              maxLength={3}
              inputMode="numeric"
              onChange={(e) => update("postcode", e.target.value)}
            />
          </label>
        </div>
      )}
      <div className="divider" />
      {!dashboard && (
        <>
          <label className="switch-row">
            <span>
              <Layers size={17} /> Sýna einstakar sölur
            </span>
            <input
              type="checkbox"
              checked={points}
              onChange={(e) => setPoints(e.target.checked)}
            />
          </label>
          {points && (
            <p className="micro">
              Allt að 1.500 nýjustu staðsettu sölurnar. Þysjaðu inn til að sjá
              einstakar eignir.
            </p>
          )}
        </>
      )}
      <div className="source-badge">
        <span className="live-dot" />
        Þinglýstir kaupsamningar
        <small>
          {data
            ? `Gögn uppfærð ${date(data.downloadedAt)}`
            : "Sæki gögn frá HMS…"}
        </small>
        {data && (
          <small>
            Nýjasti samningur: {date(data.latestSale)}
            <br />
            Nýjasta þinglýsing: {date(data.latestRegistration)}
          </small>
        )}
      </div>
      <Link href="/um-gognin" className="method-link">
        <Info size={13} /> Um gögnin og aðferðafræði
      </Link>
    </>
  );
  const summary = data && (
    <>
      <div className="summary-heading">
        <span className="eyebrow">
          {filters.district ? "BORGARHLUTI" : "MARKAÐSYFIRLIT"}
        </span>
        {(filters.district || filters.postcode) && (
          <button
            className="icon-button"
            onClick={() =>
              setFilters((f) => ({ ...f, district: "", postcode: "" }))
            }
            aria-label="Hreinsa svæðisval"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <h2>{selected}</h2>
      <p className="caption">
        {date(data.from)} – {date(data.to)}
      </p>
      <div className="hero-stat">
        <span>Miðgildi söluverðs á m²</span>
        <strong>{ppm(data.summary.ppm)}</strong>
        <small>
          <span className="live-dot" />
          {num(data.summary.count)} gildar sölur á tímabilinu
        </small>
      </div>
      {data.summary.sparse && (
        <p className="notice">
          {data.summary.count < 5 ? strings.suppressed : strings.sparse}
        </p>
      )}
      <div className="stat-grid">
        <div>
          <span>Miðgildi kaupverðs</span>
          <strong>{money(data.summary.price)}</strong>
        </div>
        <div>
          <span>Breyting frá fyrra tímabili</span>
          <strong className="green">{percent(data.summary.change)}</strong>
        </div>
      </div>
      <p className="micro">
        Samanburður: {num(data.summary.previousCount)} sölur á jafn löngu fyrra
        tímabili. Breytt samsetning seldra eigna getur haft áhrif.
      </p>
    </>
  );
  return (
    <main id="main" className={dashboard ? "dashboard" : "explorer"}>
      <div className="search-bar">
        <Search size={19} />
        <input
          aria-label={strings.search}
          placeholder={strings.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q ? (
          <button
            className="icon-button"
            aria-label="Hreinsa leit"
            onClick={() => setQ("")}
          >
            <X size={16} />
          </button>
        ) : (
          <span className="search-hint">Heimilisfang / svæði</span>
        )}
      </div>
      <button
        className="mobile-filter-button"
        onClick={() => setMobileFilters(!mobileFilters)}
      >
        <SlidersHorizontal size={17} /> Síur
      </button>
      {!dashboard && (
        <div className="map-wrapper">
          <SalesMap
            data={data}
            metric={metric}
            level={mapLevel}
            municipality={filters.municipality}
            selected={
              mapLevel === "postcode" ? filters.postcode : filters.district
            }
            onSelect={(id) => choose({ id, kind: mapLevel } as AreaStats)}
            showPoints={points || !!query}
            focusKey={query}
          />
          <div className="map-scope">
            <span className="live-dot" /> Höfuðborgarsvæðið <span> / </span>{" "}
            {mapLevel === "postcode" ? "Póstsvæði" : "Borgarhlutar Reykjavíkur"}
          </div>
          <div className="map-legend">
            <strong>{metricLabels[metric]}</strong>
            <div className="legend-colors">
              {palette.map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </div>
            <div className="legend-labels">
              <span>{metricFormat(cutoffs[0] ?? null, metric)}</span>
              <span>{metricFormat(cutoffs[3] ?? null, metric)}</span>
            </div>
            <small>Litir eftir fimmtungum · Grátt: ófullnægjandi gögn</small>
          </div>
        </div>
      )}
      <aside className={`controls panel ${mobileFilters ? "mobile-open" : ""}`}>
        {controls}
      </aside>
      {loading && (
        <div className="loading-pill" role="status">
          <span className="spinner" /> Uppfæri niðurstöður…
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setFilters({ ...filters })}>
            Reyna aftur
          </button>
        </div>
      )}
      {!dashboard ? (
        <aside
          className={`details panel ${loading ? "updating" : ""}`}
          aria-busy={loading}
        >
          {data ? (
            <>
              {summary}
              <div className="section-title">
                <h3>Verðþróun</h3>
                <span>þ.kr./m²</span>
              </div>
              <TrendChart data={data.trend} />
              <p className="micro">
                3 mánaða hlaupandi miðgildi. Færri en 5 sölur eru ekki sýndar.
              </p>
              <div className="section-title">
                <h3>
                  {filters.district || filters.postcode || query
                    ? "Nýlegir kaupsamningar"
                    : "Skoðaðu svæðin"}
                </h3>
                <span>
                  {filters.district || filters.postcode || query
                    ? `${Math.min(data.recent.length, 40)} nýjustu`
                    : "Veldu svæði"}
                </span>
              </div>
              {filters.district || filters.postcode || query ? (
                <>
                  {data.recent.slice(0, 8).map((s) => (
                    <SaleCard key={s.id} sale={s} />
                  ))}
                  <div className="stat-grid typical">
                    <div>
                      <span>Dæmigerð stærð</span>
                      <strong>{num(data.summary.area)} m²</strong>
                    </div>
                    <div>
                      <span>Byggingarár · miðgildi</span>
                      <strong>{num(data.summary.built)}</strong>
                    </div>
                    <div>
                      <span>Herbergi · miðgildi</span>
                      <strong>{num(data.summary.rooms)}</strong>
                    </div>
                    <div>
                      <span>Kaupverð / fasteignamat</span>
                      <strong>
                        {data.summary.ratio === null
                          ? "—"
                          : numberIS(data.summary.ratio, 2) + "×"}
                      </strong>
                      <small>
                        {num(data.summary.ratioCount)} sölur með mati
                      </small>
                    </div>
                  </div>
                  <button
                    className="text-button"
                    onClick={() =>
                      setFilters((f) => ({ ...f, district: "", postcode: "" }))
                    }
                  >
                    <ArrowLeft size={14} /> Til baka í svæðayfirlit
                  </button>
                </>
              ) : (
                <>
                  <div className="area-tabs">
                    {[
                      ["district", "Borgarhlutar"],
                      ["postcode", "Póstnúmer"],
                      ["municipality", "Sveitarfélög"],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        className={tab === v ? "active" : ""}
                        onClick={() => setTab(v as typeof tab)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {areaList.length ? (
                    areaList.map((a) => (
                      <button
                        className="area-row"
                        key={a.id}
                        onClick={() => choose(a)}
                      >
                        <span>
                          <strong>{districtName(a.name)}</strong>
                          <small>
                            {num(a.count)} sölur
                            {a.sparse ? " · fáar sölur" : ""}
                          </small>
                        </span>
                        <span>
                          {metricFormat(a[metric], metric)}{" "}
                          <ChevronRight size={14} />
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="notice">
                      Engin svæði með þessum síum. Prófaðu víðara tímabil.
                    </p>
                  )}
                </>
              )}
              <p className="coverage">
                <Check size={13} />
                {num(data.matchedCount)} af {num(data.total)} sölum tengdar
                opinberum hnitum.
              </p>
              <Link href="/verdmat" className="estimate-link">
                <span>
                  Hvað gæti eignin þín
                  <br />
                  <strong>verið verðmæt?</strong>
                </span>
                <ArrowUpRight size={22} />
              </Link>
            </>
          ) : !loading ? (
            <div className="empty">
              <Info />
              <h2>Gögn ekki tiltæk</h2>
              <p>Reyndu aftur síðar.</p>
            </div>
          ) : (
            <div className="skeleton skeleton-panel" />
          )}
        </aside>
      ) : (
        <section
          className={`market-content ${loading ? "updating" : ""}`}
          aria-busy={loading}
        >
          <span className="eyebrow">ÞINGLÝST KAUPVERÐ · HÖFUÐBORGARSVÆÐIÐ</span>
          <h1>Markaðurinn, í samhengi.</h1>
          <p className="intro">
            Sjáðu hvað hefur selst og hvernig markaðurinn þróast.
          </p>
          {data && (
            <>
              <div className="market-summary panel">{summary}</div>
              <div className="market-charts">
                {[
                  ["ppm", "Söluverð á fermetra"],
                  ["volume", "Fjöldi kaupsamninga"],
                  ["area", "Stærð seldra íbúða"],
                ].map(([kind, title]) => (
                  <article className="panel" key={kind}>
                    <h3>{title}</h3>
                    <p className="caption">
                      {kind === "volume"
                        ? "Sölur í hverjum mánuði"
                        : "3 mánaða hlaupandi miðgildi"}
                    </p>
                    <TrendChart
                      data={data.trend}
                      kind={kind as "ppm" | "volume" | "area"}
                    />
                  </article>
                ))}
              </div>
              <div className="market-tables">
                {[
                  ["Sveitarfélög", data.municipalities],
                  ["Póstnúmer", data.postcodes],
                ].map(([title, areas]) => (
                  <article className="panel" key={String(title)}>
                    <h3>{String(title)}</h3>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Svæði</th>
                            <th>kr./m²</th>
                            <th>Sölur</th>
                            <th>Breyting</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(areas as AreaStats[]).map((a) => (
                            <tr key={a.id}>
                              <td>{a.name}</td>
                              <td>{ppm(a.ppm)}</td>
                              <td>
                                {num(a.count)}
                                {a.sparse ? " *" : ""}
                              </td>
                              <td>{percent(a.change)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </div>
              <article className="panel">
                <h3>Mánaðarleg gögn og úrtaksstærð</h3>
                <p className="caption">
                  Verð og stærð byggja á þriggja mánaða glugga sem lýkur í
                  viðkomandi mánuði.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mánuður</th>
                        <th>Miðgildi / m²</th>
                        <th>Stærð</th>
                        <th>Sölur í glugga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trend
                        .slice()
                        .reverse()
                        .map((t) => (
                          <tr key={t.month}>
                            <td>{t.month}</td>
                            <td>{ppm(t.ppm)}</td>
                            <td>{num(t.area)} m²</td>
                            <td>{num(t.count)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </>
          )}
        </section>
      )}
    </main>
  );
}
