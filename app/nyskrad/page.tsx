import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  Eye,
  Info,
  Rss,
  TriangleAlert,
} from "lucide-react";
import { SavedSearchOverview } from "@/components/saved-searches";
import { getObserved, getSnapshot } from "@/lib/server";
import { newlyObserved, WINDOWS } from "@/lib/newly-observed";
import { registrationView } from "@/lib/registration";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { param, type ParamSource } from "@/lib/share";
import { SAMPLE } from "@/lib/distribution";
import { date, money, num, numberIS, ppm, sqm } from "@/lib/format";
import { DataTable } from "@/components/data-table";
import {
  LagHistogram,
  LagTrend,
  ObservedPerDay,
} from "@/components/registration-charts";

export const metadata = {
  title: "Nýskráðar sölur og þinglýsingartími",
  description:
    "Kaupsamningar sem nýlega bættust við kaupskrá HMS, og hversu langur tími líður frá undirritun til þinglýsingar.",
  alternates: {
    types: {
      "application/atom+xml": [
        { url: "/api/feed", title: "Nýjar færslur · Höfuðborgarsvæðið" },
      ],
    },
  },
};
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const TYPE: Record<string, string> = {
  apartment: "Fjölbýli",
  house: "Sérbýli",
};
const months = (m: string) => {
  const [y, mo] = m.split("-");
  return `${["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."][+mo - 1]} ${y}`;
};
const days = (n: number | null) =>
  n === null ? "—" : `${numberIS(n, 0)} ${n === 1 ? "dagur" : "dagar"}`;

function parse(p: ParamSource) {
  const type = ["apartment", "house"].includes(param(p, "type"))
      ? param(p, "type")
      : "all",
    municipality =
      param(p, "municipality") in MUNICIPALITIES
        ? param(p, "municipality")
        : "",
    windowDays = WINDOWS.find((w) => String(w) === param(p, "days")) ?? 30;
  return { type, municipality, windowDays };
}

export default async function NewlyRegistered({ searchParams }: Props) {
  const { type, municipality, windowDays } = parse(await searchParams);
  const [{ rows, report }, observed] = await Promise.all([
    getSnapshot(),
    getObserved(),
  ]);
  const asOf = report.latestRegistration,
    today = observed.lastRun.date;
  const fresh = newlyObserved(rows, observed, {
    type,
    municipality,
    days: windowDays,
    today,
  });
  const lag = registrationView(rows, { type, municipality }, asOf);
  const s = lag.summary;
  const histogram = lag.histogram?.map((b) => ({
    ...b,
    label:
      b.to === null
        ? `${b.from}+`
        : b.from === b.to
          ? `${b.from}`
          : `${b.from}–${b.to}`,
  }));
  const bootstrapOnly = !observed.runs.some((r) => !r.bootstrap);
  const feedParams = new URLSearchParams();
  if (type !== "all") feedParams.set("type", type);
  if (municipality) feedParams.set("municipality", municipality);
  const feedLink = `/api/feed${feedParams.size ? `?${feedParams}` : ""}`;
  return (
    <main id="main" className="insight-page registration-page">
      <span className="eyebrow">NÝSKRÁÐ · KAUPSKRÁ HMS</span>
      <h1>Hvaða sölur bættust nýlega við skrána?</h1>
      <p className="intro">
        Fasteign sækir kaupskrá HMS daglega. Hér sérðu kaupsamninga sem birtust
        þar nýlega — og hversu langan tíma þinglýsing tekur, sem skýrir hvers
        vegna nýjustu mánuðirnir eru ekki fullkomnir.
      </p>
      <form className="filter-bar panel" method="get">
        <label>
          Fyrst séð síðustu
          <select name="days" defaultValue={String(windowDays)}>
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w} daga
              </option>
            ))}
          </select>
        </label>
        <label>
          Tegund eignar
          <select name="type" defaultValue={type}>
            <option value="all">Allar íbúðir</option>
            <option value="apartment">Fjölbýli</option>
            <option value="house">Sérbýli</option>
          </select>
        </label>
        <label>
          Sveitarfélag
          <select name="municipality" defaultValue={municipality}>
            <option value="">Öll sveitarfélög</option>
            {Object.entries(MUNICIPALITIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button filter-submit">Sía</button>
      </form>
      <section className="panel feed-panel" aria-labelledby="feed-title">
        <h2 id="feed-title">
          <Rss size={18} /> Fylgjast með nýjum færslum
        </h2>
        <p>
          <a
            className="primary-link"
            href={feedLink}
            type="application/atom+xml"
          >
            Gerast áskrifandi að RSS
          </a>{" "}
          — Atom-straumur með nýjum færslum{" "}
          {type === "all" ? "" : `(${TYPE[type].toLocaleLowerCase("is")}) `}
          {municipality
            ? `í ${MUNICIPALITIES[municipality]}`
            : "á höfuðborgarsvæðinu"}
          . Hver færsla sýnir dagsetningu kaupsamnings, þinglýsingar og hvenær
          hún sást fyrst; leiðréttingar á eldri færslum birtast ekki sem nýjar.
        </p>
        <p className="micro">
          Þrengri straum (póstnúmer, stærð, verð…) færðu með því að vista leit á
          kortinu eða markaðssíðunni og afrita RSS-slóð hennar.
        </p>
        <SavedSearchOverview />
      </section>

      <section className="panel dates-explainer" aria-labelledby="three-dates">
        <h2 id="three-dates">Þrjár ólíkar dagsetningar</h2>
        <ul>
          <li>
            <CalendarCheck size={18} />
            <span>
              <strong>Undirritaður</strong> — dagur kaupsamnings. Þetta er
              dagsetning sölunnar og sú sem öll tölfræði Fasteignar notar.
            </span>
          </li>
          <li>
            <CalendarClock size={18} />
            <span>
              <strong>Þinglýstur</strong> — dagurinn sem samningnum var þinglýst
              hjá sýslumanni. Oftast nokkrum dögum til vikum eftir undirritun.
            </span>
          </li>
          <li>
            <Eye size={18} />
            <span>
              <strong>Fyrst séð</strong> — dagurinn sem samningurinn birtist
              fyrst í kaupskrá HMS þegar Fasteign sótti hana. Það segir ekkert
              um hvenær eignin seldist.
            </span>
          </li>
        </ul>
      </section>

      <section className="insight-body" aria-labelledby="new-title">
        <div className="section-title">
          <h2 id="new-title">Nýjar sölur í gögnunum</h2>
          <span>
            {date(fresh.since)} – {date(today)}
          </span>
        </div>
        {bootstrapOnly || fresh.total === 0 ? (
          <p className="notice">
            {bootstrapOnly
              ? `Fasteign hóf að skrá hvenær færslur birtast ${date(fresh.trackingSince)}. Allar færslur sem þá voru til teljast grunnur, ekki nýjar; nýjar sölur birtast hér eftir næstu daglegu uppfærslu.`
              : "Engar nýjar sölur með þessum síum á tímabilinu."}
          </p>
        ) : (
          <>
            <p className="caption">
              {num(fresh.total)} nýjar sölur sem nýtast í verðtölfræði
              {fresh.otherCount > 0 &&
                ` · auk ${num(fresh.otherCount)} annarra færslna (t.d. samningar sem HMS telur ónothæfa, ófullbúnar eignir eða fleiri eignir á sama samningi)`}
              . Fylgst með síðan {date(fresh.trackingSince)}.
            </p>
            {fresh.perDay.length > 1 && (
              <div className="panel insight-chart">
                <h3>Nýjar færslur eftir degi sem þær sáust fyrst</h3>
                <ObservedPerDay data={fresh.perDay} />
                <p className="micro">
                  Fjöldi á dag ræðst af því hvenær HMS uppfærir skrána, ekki af
                  því hvenær eignir seldust.
                </p>
              </div>
            )}
            <ol className="new-sales">
              {fresh.added.slice(0, 12).map((x) => (
                <li key={x.id} className="panel">
                  <div className="new-sale-head">
                    <span>
                      <strong>{x.address}</strong>
                      <small>
                        {x.postcode} {x.municipalityName} · {TYPE[x.type]} ·{" "}
                        {sqm(x.area)} · {num(x.rooms)} herb.
                      </small>
                    </span>
                    <span className="new-sale-price">
                      <strong>{money(x.price)}</strong>
                      <small>{ppm(x.ppm)}</small>
                    </span>
                  </div>
                  <dl className="three-dates">
                    <div>
                      <dt>Undirritaður</dt>
                      <dd>{date(x.date)}</dd>
                    </div>
                    <div>
                      <dt>Þinglýstur</dt>
                      <dd>{x.registered ? date(x.registered) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Fyrst séð</dt>
                      <dd>{date(x.firstSeen)}</dd>
                    </div>
                    <div>
                      <dt>Bið eftir þinglýsingu</dt>
                      <dd>{days(x.lag)}</dd>
                    </div>
                  </dl>
                  {/^\d{7}$/.test(x.propertyId) && (
                    <p className="history-links">
                      <small>Færsla {x.id}</small>
                      <Link href={`/eign/${x.propertyId}`}>
                        Sölusaga eignar →
                      </Link>
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {fresh.added.length > 12 && (
              <details className="table-toggle">
                <summary>
                  Sýna{" "}
                  {fresh.added.length === fresh.total
                    ? "allar"
                    : `${num(fresh.added.length)} nýjustu af`}{" "}
                  {num(fresh.total)} sem töflu
                </summary>
                <div className="table-wrap">
                  <table className="new-sales-table">
                    <thead>
                      <tr>
                        <th>Heimilisfang</th>
                        <th>Undirritaður</th>
                        <th>Þinglýstur</th>
                        <th>Fyrst séð</th>
                        <th>Kaupverð</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fresh.added.slice(12).map((x) => (
                        <tr key={x.id}>
                          <td>
                            {/^\d{7}$/.test(x.propertyId) ? (
                              <Link href={`/eign/${x.propertyId}`}>
                                {x.address}
                              </Link>
                            ) : (
                              x.address
                            )}{" "}
                            <small>{x.postcode}</small>
                          </td>
                          <td>{date(x.date)}</td>
                          <td>{x.registered ? date(x.registered) : "—"}</td>
                          <td>{date(x.firstSeen)}</td>
                          <td>{money(x.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
        {observed.removed > 0 && (
          <p className="micro">
            {num(observed.removed)} færslur hurfu úr kaupskránni síðustu 60 daga
            (öll svæði). Þær eru ekki lengur í tölum Fasteignar.
          </p>
        )}
        {fresh.changedTotal > 0 && (
          <details className="table-toggle changed-records">
            <summary>
              {num(fresh.changedTotal)} eldri færslur voru leiðréttar af HMS á
              tímabilinu
            </summary>
            <p className="micro">
              Færslur sem Fasteign þekkti fyrir en HMS breytti síðar (t.d. verð,
              stærð, herbergi eða mat á nothæfi). Þær eru ekki nýjar sölur.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Heimilisfang</th>
                    <th>Undirritaður</th>
                    <th>Breytt</th>
                    <th>Kaupverð</th>
                  </tr>
                </thead>
                <tbody>
                  {fresh.changed.map((c) => (
                    <tr key={c.id}>
                      <td>{c.address}</td>
                      <td>{date(c.date)}</td>
                      <td>{date(c.changedAt)}</td>
                      <td>{money(c.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <section className="insight-body" aria-labelledby="lag-title">
        <div className="section-title">
          <h2 id="lag-title">Hversu lengi tekur þinglýsing?</h2>
          <span>
            Þinglýst {date(lag.windowFrom)} – {date(asOf)}
          </span>
        </div>
        <div className="panel lag-summary">
          {s.count < SAMPLE.median ? (
            <p className="notice">Of fáir samningar til að birta biðtíma.</p>
          ) : (
            <div className="quartiles">
              <div>
                <span>Miðgildi biðtíma</span>
                <strong>{days(s.median)}</strong>
              </div>
              <div>
                <span>Helmingur samninga</span>
                <strong>
                  {s.p25 === null ? "—" : `${num(s.p25)}–${num(s.p75)} dagar`}
                </strong>
              </div>
              <div>
                <span>Þinglýst innan 30 daga</span>
                <strong>
                  {s.within30 === null ? "—" : `${numberIS(s.within30, 0)}%`}
                </strong>
              </div>
            </div>
          )}
          <p className="micro">
            {num(s.count)} samningar sem þinglýst var síðustu 12 mánuði
            {s.p90 !== null && `; 90% þeirra innan ${num(s.p90)} daga`}. Biðtími
            er frá undirritun til þinglýsingar — ekki sölutími eignar á markaði.
            {s.sparse && " Fáir samningar — túlkaðu varlega."}
          </p>
        </div>
        {lag.incomplete.length > 0 && (
          <p className="notice availability" role="note">
            <TriangleAlert size={16} />
            <span>
              <strong>
                {lag.incomplete.map((m) => months(m.month)).join(", ")}{" "}
                {lag.incomplete.length === 1
                  ? "er líklega ófullgerður"
                  : "eru líklega ófullgerðir"}
                .
              </strong>{" "}
              Samningar eru að jafnaði þinglýstir eftir {days(s.median)}, en
              sumir mun síðar. Miðað við biðtíma eldri samninga hefði aðeins um{" "}
              {lag.incomplete
                .map(
                  (m) =>
                    `${numberIS(m.share, 0)}% (${months(m.month)}${m.ended ? "" : ", mánuðurinn ekki liðinn"})`,
                )
                .join(", ")}{" "}
              samninga{" "}
              {lag.incomplete.length === 1 ? "þessa mánaðar" : "þessara mánaða"}{" "}
              verið þinglýst á þessum tíma. Fleiri samningar bætast því enn við
              og fjöldi sala er of lágur í bili. Við áætlum ekki hversu marga
              vantar.
            </span>
          </p>
        )}
        <div className="insight-grid">
          <article className="panel insight-chart">
            <h3>Dreifing biðtíma</h3>
            <p className="caption">
              Hlutfall samninga eftir dögum frá undirritun
            </p>
            {histogram ? (
              <>
                <LagHistogram data={histogram} />
                <DataTable
                  head={["Dagar", "Samningar", "Hlutfall"]}
                  rows={histogram.map((b) => [
                    b.label,
                    num(b.count),
                    `${numberIS(b.share, 1)}%`,
                  ])}
                />
              </>
            ) : (
              <p className="notice">
                Dreifing birtist þegar a.m.k. {SAMPLE.distribution} samningar
                eru í hópnum.
              </p>
            )}
          </article>
          <article className="panel insight-chart">
            <h3>Biðtími eftir þinglýsingarmánuði</h3>
            <p className="caption">
              <span className="swatch swatch-a" /> Miðgildi{" "}
              <span className="swatch swatch-b" /> 90. hundraðshluti (dagar)
            </p>
            <LagTrend data={lag.trend} />
            <DataTable
              head={["Mánuður", "Miðgildi", "90. hundraðshl.", "Samningar"]}
              rows={lag.trend
                .slice()
                .reverse()
                .map((t) => [
                  t.month,
                  days(t.median),
                  days(t.p90),
                  num(t.count),
                ])}
            />
            <p className="micro">
              Flokkað eftir þinglýsingarmánuði svo að samningar sem bíða lengi
              teljist með; eftir undirritunarmánuði myndu nýjustu mánuðir sýna
              of stuttan biðtíma.
            </p>
          </article>
        </div>
        {(lag.byType.length > 0 || lag.byMunicipality.length > 0) && (
          <div className="insight-grid">
            {[
              [
                "Eftir tegund",
                lag.byType.map((g) => ({ ...g, name: TYPE[g.name] ?? g.name })),
              ],
              ["Eftir sveitarfélagi", lag.byMunicipality],
            ]
              .filter(([, list]) => (list as unknown[]).length)
              .map(([title, list]) => (
                <article className="panel insight-chart" key={String(title)}>
                  <h3>{String(title)}</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Hópur</th>
                          <th>Miðgildi</th>
                          <th>90. hundraðshl.</th>
                          <th>Samningar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(list as typeof lag.byMunicipality).map((g) => (
                          <tr key={g.id}>
                            <td>{g.name}</td>
                            <td>{days(g.median)}</td>
                            <td>{days(g.p90)}</td>
                            <td>
                              {num(g.count)}
                              {g.sparse ? " *" : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="micro">
                    Miðgildi frá {SAMPLE.median} samningum, 90. hundraðshluti
                    frá {SAMPLE.distribution}. * færri en {SAMPLE.warn}.
                  </p>
                </article>
              ))}
          </div>
        )}
        <article className="panel insight-chart">
          <h3>Hversu fljótt koma samningar fram?</h3>
          <p className="caption">
            Samningar undirritaðir {date(lag.completeness.from)} –{" "}
            {date(lag.completeness.to)} ({num(lag.completeness.count)}), nógu
            gamlir til að nær allir hafi verið þinglýstir
          </p>
          <div className="completeness">
            {lag.completeness.within.map((w) => (
              <div key={w.days}>
                <span>Innan {w.days} daga</span>
                <span className="share-bar" aria-hidden>
                  <span style={{ width: `${w.share ?? 0}%` }} />
                </span>
                <strong>
                  {w.share === null ? "—" : `${numberIS(w.share, 0)}%`}
                </strong>
              </div>
            ))}
          </div>
        </article>
      </section>
      <details className="explainer">
        <summary>
          <Info size={14} /> Hvernig er fylgst með nýjum færslum?
        </summary>
        <p>
          Við hverja daglega uppfærslu ber Fasteign kaupskrána saman við fyrri
          niðurhöl. Hver lína er auðkennd með færslunúmeri og fastanúmeri. Ný
          lína telst ný sala; breytt efni (verð, stærð, herbergi, mat HMS á
          nothæfi o.fl.) telst leiðrétting á eldri færslu, ekki ný sala.
          Leiðrétt fastanúmer á þekktum samningi telst líka leiðrétting. Dálkar
          með núgildandi fasteigna- og brunabótamati breytast árlega fyrir allar
          færslur og eru ekki bornir saman.
        </p>
        <p>
          Færslur sem voru í skránni þegar eftirlit hófst teljast grunnur og
          birtast aldrei sem nýjar. Fasteign birtir aðeins sölur á
          höfuðborgarsvæðinu og engar upplýsingar um kaupendur eða seljendur.
        </p>
      </details>
    </main>
  );
}
