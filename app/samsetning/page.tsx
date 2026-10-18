import Link from "next/link";
import { Info, TriangleAlert } from "lucide-react";
import { getSnapshot } from "@/lib/server";
import { parseFilters } from "@/lib/analytics";
import { areaName, areaOptions } from "@/lib/compare";
import {
  GROUP_MIN,
  SMALL,
  composition,
  explain,
  trailingPeriods,
  yearPeriods,
  type Period,
} from "@/lib/composition";
import { snapshotIncompleteMonths } from "@/lib/registration";
import { SAMPLE } from "@/lib/sample";
import { date, money, num, numberIS, ppm, sqm } from "@/lib/format";
import {
  DEFAULT_FILTERS,
  apiParams,
  areaKey,
  filterSummary,
  param,
  parseArea,
  scopeTo,
  type ParamSource,
} from "@/lib/share";
import { CompositionExport } from "@/components/composition-export";

export const metadata = {
  title: "Samsetning seldra eigna",
  description:
    "Hvers vegna getur miðgildi söluverðs breyst þótt verð sambærilegra eigna breytist lítið? Berðu saman hvað seldist á tveimur tímabilum.",
};
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (s: string, max: string) =>
  DAY.test(s) &&
  s >= "2006-01-01" &&
  s <= max &&
  new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

function parse(p: ParamSource, asOf: string) {
  const area = parseArea(param(p, "area")),
    type = ["apartment", "house"].includes(param(p, "type"))
      ? param(p, "type")
      : "all",
    thisYear = +asOf.slice(0, 4),
    year = (k: string, d: number) => {
      const n = +param(p, k);
      return Number.isInteger(n) && n >= 2006 && n <= thisYear ? n : d;
    };
  let mode = ["years", "custom"].includes(param(p, "mode"))
      ? param(p, "mode")
      : "12m",
    periods: { a: Period; b: Period },
    invalid = false;
  const ya = year("ya", thisYear - 2),
    yb = year("yb", thisYear - 1);
  if (mode === "years")
    periods = yearPeriods(Math.min(ya, yb), Math.max(ya, yb), asOf);
  else if (mode === "custom") {
    const [af, at, bf, bt] = ["af", "at", "bf", "bt"].map((k) => param(p, k));
    if (
      [af, at, bf, bt].every((d) => validDay(d, asOf)) &&
      af <= at &&
      bf <= bt
    )
      periods = { a: { from: af, to: at }, b: { from: bf, to: bt } };
    else {
      invalid = true;
      mode = "12m";
      periods = trailingPeriods(asOf);
    }
  } else periods = trailingPeriods(asOf);
  return { area, type, mode, ya, yb, periods, invalid };
}

const WARN = {
  unequal_length:
    "Tímabilin eru misjafnlega löng; berðu saman hlutföll frekar en fjölda.",
  overlap: "Tímabilin skarast; sömu sölur geta þá talist á báðum.",
  sparse: `Færri en ${SAMPLE.warn} sölur á öðru tímabilinu; niðurstöður eru mjög óvissar.`,
  small_sample: `Færri en ${SMALL} sölur á öðru tímabilinu: hlutföll geta sveiflast um nokkur prósentustig af tilviljun einni saman.`,
  far_apart:
    "Meira en tvö ár eru á milli tímabilanna. Allar tölur eru nafnverð, svo breytingin endurspeglar líka almennar verðlagsbreytingar.",
} as const;
const share = (v: number | null) => (v === null ? "—" : `${numberIS(v, 1)}%`);
const signed = (v: number | null, unit = "%") =>
  v === null
    ? "—"
    : `${Math.round(v * 10) > 0 ? "+" : Math.round(v * 10) < 0 ? "−" : ""}${numberIS(Math.abs(v), 1)}${unit}`;

export default async function CompositionPage({ searchParams }: Props) {
  const params = await searchParams;
  let snapshot;
  try {
    snapshot = await getSnapshot();
  } catch {
    return (
      <main id="main" className="insight-page">
        <h1>Samsetning seldra eigna</h1>
        <p className="notice">Gögn eru ekki tiltæk.</p>
      </main>
    );
  }
  const { rows, report } = snapshot,
    asOf = report.latestRegistration,
    q = parse(params, asOf);
  const state = {
      ...(q.area ? scopeTo(DEFAULT_FILTERS, q.area) : DEFAULT_FILTERS),
      months: "0",
      type: q.type,
    },
    f = parseFilters(apiParams(state)),
    c = composition(rows, f, q.periods),
    text = explain(c),
    incomplete = snapshotIncompleteMonths(rows, asOf)
      .map((m) => m.month)
      .filter(
        (m) =>
          m >= q.periods.b.from.slice(0, 7) && m <= q.periods.b.to.slice(0, 7),
      ),
    areaLabel = q.area ? areaName(rows, q.area) : "Höfuðborgarsvæðið",
    options = areaOptions(rows),
    thisYear = +asOf.slice(0, 4),
    years = Array.from({ length: thisYear - 2006 + 1 }, (_, i) => thisYear - i);
  const ctx = {
    area: areaLabel,
    from: q.periods.a.from,
    to: q.periods.b.to,
    filters: filterSummary(state),
    downloadedAt: report.sources.kaupskra.downloadedAt,
    count: c.overall.a.count + c.overall.b.count,
    incomplete,
  };
  const card = (
    label: string,
    p: Period,
    s: typeof c.overall.a,
    houses: number | null,
  ) => (
    <div className="panel period-card">
      <span className="eyebrow">{label}</span>
      <strong>
        {date(p.from)} – {date(p.to)}
      </strong>
      <dl>
        <div>
          <dt>Gildar sölur</dt>
          <dd>{num(s.count)}</dd>
        </div>
        <div>
          <dt>Miðgildi á m²</dt>
          <dd>{ppm(s.ppm)}</dd>
        </div>
        <div>
          <dt>Miðgildi kaupverðs</dt>
          <dd>{money(s.price)}</dd>
        </div>
        <div>
          <dt>Miðgildi stærðar</dt>
          <dd>{sqm(s.area)}</dd>
        </div>
        <div>
          <dt>Hlutfall sérbýla</dt>
          <dd>{share(houses)}</dd>
        </div>
      </dl>
      {s.count > 0 && s.count < SAMPLE.median && (
        <p className="micro">Færri en {SAMPLE.median} sölur: verð ekki birt.</p>
      )}
    </div>
  );
  const typeRows = c.dimensions.find((d) => d.key === "type")!.rows,
    houseShare = (k: "a" | "b") =>
      typeRows.find((r) => r.id === "house")?.[k].share ?? null;
  return (
    <main id="main" className="insight-page composition-page">
      <span className="eyebrow">SAMSETNING · ÞINGLÝSTIR KAUPSAMNINGAR</span>
      <h1>Hvað seldist — ekki aðeins á hvaða verði</h1>
      <p className="intro">
        Miðgildi söluverðs getur breyst þótt verð sambærilegra eigna breytist
        lítið, ef hlutfall stórra, nýrra eða dýrra eigna meðal seldra eigna
        breytist. Hér sérðu samsetningu sölu á tveimur tímabilum.
      </p>
      <form className="filter-bar panel composition-form" method="get">
        <label>
          Svæði
          <select name="area" defaultValue={q.area ? areaKey(q.area) : ""}>
            <option value="">Höfuðborgarsvæðið</option>
            {(
              [
                ["municipality", "Sveitarfélög"],
                ["district", "Borgarhlutar Reykjavíkur"],
                ["postcode", "Póstnúmer"],
              ] as const
            ).map(([kind, label]) => (
              <optgroup key={kind} label={label}>
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
        <label>
          Tegund eignar
          <select name="type" defaultValue={q.type}>
            <option value="all">Allar íbúðir</option>
            <option value="apartment">Fjölbýli</option>
            <option value="house">Sérbýli</option>
          </select>
        </label>
        <label>
          Tímabil
          <select name="mode" defaultValue={q.mode}>
            <option value="12m">
              Síðustu 12 mánuðir og 12 mánuðir þar á undan
            </option>
            <option value="years">Tvö almanaksár</option>
            <option value="custom">Sérvalin tímabil</option>
          </select>
        </label>
        <fieldset className="composition-years">
          <legend>Ár (ef tvö almanaksár)</legend>
          <select
            name="ya"
            aria-label="Fyrra ár"
            defaultValue={String(Math.min(q.ya, q.yb))}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select
            name="yb"
            aria-label="Síðara ár"
            defaultValue={String(Math.max(q.ya, q.yb))}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </fieldset>
        <fieldset className="composition-custom">
          <legend>Sérvalin tímabil</legend>
          {(
            [
              ["af", "Fyrra frá", q.periods.a.from],
              ["at", "Fyrra til", q.periods.a.to],
              ["bf", "Síðara frá", q.periods.b.from],
              ["bt", "Síðara til", q.periods.b.to],
            ] as const
          ).map(([k, l, v]) => (
            <label key={k}>
              {l}
              <input
                type="date"
                name={k}
                defaultValue={v}
                min="2006-01-01"
                max={asOf}
              />
            </label>
          ))}
        </fieldset>
        <button className="primary-button filter-submit">Bera saman</button>
      </form>
      {q.invalid && (
        <p className="notice" role="alert">
          Dagsetningar tímabila voru ógildar; sýni síðustu 12 mánuði og 12
          mánuði þar á undan.
        </p>
      )}

      <div className="period-cards">
        {card("Fyrra tímabil", q.periods.a, c.overall.a, houseShare("a"))}
        {card("Síðara tímabil", q.periods.b, c.overall.b, houseShare("b"))}
      </div>

      {(c.warnings.length > 0 || incomplete.length > 0) && (
        <div className="composition-warnings">
          {incomplete.length > 0 && (
            <p className="notice">
              <TriangleAlert size={16} /> Síðara tímabilið nær yfir líklega
              ófullgerða mánuði ({incomplete.join(", ")}): samningar bætast enn
              við vegna þinglýsingartíma.{" "}
              <Link href="/nyskrad">Um þinglýsingartíma →</Link>
            </p>
          )}
          {c.warnings.map((w) => (
            <p key={w} className="notice">
              <TriangleAlert size={16} /> {WARN[w]}
            </p>
          ))}
        </div>
      )}

      <section
        className="panel composition-explain"
        aria-labelledby="explain-title"
      >
        <div className="chart-head">
          <h2 id="explain-title">Hvað sýna tölurnar?</h2>
          <CompositionExport c={c} ctx={ctx} />
        </div>
        <ol>
          {text.map((t) => (
            <li key={t.kind} className={`explain-${t.kind}`}>
              <strong>
                {t.kind === "overall"
                  ? "1. Heildarmiðgildi"
                  : t.kind === "mix"
                    ? "2. Samsetning seldra eigna"
                    : t.kind === "within"
                      ? "3. Innan sambærilegra hópa"
                      : "Fyrirvari"}
              </strong>
              <span>{t.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {c.dimensions.map((d) => (
        <section
          key={d.key}
          className="panel composition-dimension"
          aria-labelledby={`dim-${d.key}`}
        >
          <div className="chart-head">
            <h2 id={`dim-${d.key}`}>{d.label}</h2>
            <CompositionExport c={c} ctx={ctx} dimension={d.key} />
          </div>
          <div className="legend-row" aria-hidden>
            <span>
              <span className="swatch swatch-a" /> Fyrra tímabil
            </span>
            <span>
              <span className="swatch swatch-b" /> Síðara tímabil
            </span>
          </div>
          <div className="table-wrap">
            <table className="composition-table">
              <caption className="visually-hidden">
                {d.label}: fjöldi og hlutfall sala á hvoru tímabili og miðgildi
                á m² í hópum með a.m.k. {GROUP_MIN} sölur
              </caption>
              <thead>
                <tr>
                  <th scope="col">Hópur</th>
                  <th scope="col">Hlutfall sala</th>
                  <th scope="col">Sölur</th>
                  <th scope="col">Breyting hlutfalls</th>
                  <th scope="col">Miðgildi á m²</th>
                  <th scope="col">Breyting innan hóps</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.label}</th>
                    <td className="share-cell">
                      <span className="share-bars" aria-hidden>
                        <span
                          className="bar-a"
                          style={{ width: `${r.a.share ?? 0}%` }}
                        />
                        <span
                          className="bar-b"
                          style={{ width: `${r.b.share ?? 0}%` }}
                        />
                      </span>
                      <span>
                        {share(r.a.share)} → {share(r.b.share)}
                      </span>
                    </td>
                    <td>
                      {num(r.a.count)} → {num(r.b.count)}
                    </td>
                    <td>{signed(r.shareChange, " p.")}</td>
                    <td>
                      {r.a.ppm === null && r.b.ppm === null ? (
                        <span className="muted">færri en {GROUP_MIN}</span>
                      ) : (
                        <>
                          {ppm(r.a.ppm)} → {ppm(r.b.ppm)}
                        </>
                      )}
                    </td>
                    <td>{signed(r.ppmChange)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="panel" aria-labelledby="cells-title">
        <h2 id="cells-title">Sambærilegir hópar: tegund × stærð</h2>
        <p className="caption">
          Hópar með a.m.k. {GROUP_MIN} sölur á báðum tímabilum. Breytingar innan
          hópa sýna verðþróun líkari eigna en leggjast ekki saman í
          heildarbreytinguna.
        </p>
        {c.cells.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Hópur</th>
                  <th scope="col">Sölur (fyrra → síðara)</th>
                  <th scope="col">Breyting miðgildis á m²</th>
                </tr>
              </thead>
              <tbody>
                {c.cells.map((x) => (
                  <tr key={x.label}>
                    <th scope="row">{x.label}</th>
                    <td>
                      {num(x.a)} → {num(x.b)}
                    </td>
                    <td>{signed(x.ppmChange)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="notice">
            Enginn hópur nær lágmarksfjölda á báðum tímabilum.
          </p>
        )}
      </section>

      <details className="panel explainer">
        <summary>
          <Info size={14} /> Aðferð og fyrirvarar
        </summary>
        <p>
          Byggt á gildum þinglýstum kaupsamningum HMS (sömu skilyrði og annars
          staðar á Fasteign), flokkuðum eftir dagsetningu undirritunar. Hlutföll
          eru af öllum gildum sölum hvors tímabils og leggjast saman í 100%
          innan hverrar flokkunar; „Óskráð“ eru sölur án skráðs herbergjafjölda
          eða byggingarárs. Stærðarbil ná upp að en ekki að meðtöldu efra marki.
        </p>
        <p>
          Heildarmiðgildi birtist frá {SAMPLE.median} sölum og breyting þess frá{" "}
          {SAMPLE.warn} sölum á báðum tímabilum. Miðgildi innan hópa krefjast{" "}
          {GROUP_MIN} sala. Allar tölur eru nafnverð. Samanburðurinn er lýsandi:
          hann er ekki verðvísitala, ekki leiðréttur fyrir samsetningu og metur
          ekki orsakir.
        </p>
        <p>
          Sjá einnig <Link href="/markadur">markaðsyfirlit</Link>,{" "}
          <Link href="/samanburdur">samanburð svæða</Link> og{" "}
          <Link href="/svaedi">svæðasíður</Link>.
        </p>
      </details>
    </main>
  );
}
