// Server-rendered property sales timeline. No client JavaScript.
import Link from "next/link";
import { ArrowUpRight, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  date,
  money,
  num,
  numberIS,
  percent,
  ppm,
  sqm,
  year,
} from "@/lib/format";
import { distributionLink } from "@/lib/share";
import type { Caveat, Change, DescribedHistory, Step } from "@/lib/history";

const CAVEAT: Record<Caveat, string> = {
  no_price: "Kaupverð vantar í skrána.",
  bundle: "Samningurinn náði yfir fleiri eignir; verðið á við þær allar.",
  unsuitable:
    "HMS merkir samninginn ónothæfan til verðviðmiðunar (t.d. óvenjuleg kjör eða tengdir aðilar).",
  incomplete: "Eignin var ekki skráð fullbúin við sölu.",
  extreme: "Fermetraverð var langt utan þess sem algengt var á svæðinu það ár.",
};
const CHANGE: Record<Change, (a: Step["sale"], b: Step["sale"]) => string> = {
  unit: (a, b) =>
    `Einingarnúmer (FEPILOG) breyttist úr ${a.unitCode} í ${b.unitCode}.`,
  area: (a, b) => `Skráð stærð breyttist úr ${sqm(a.area)} í ${sqm(b.area)}.`,
  type: () => "Skráð tegund eignar breyttist.",
  rooms: (a, b) =>
    `Herbergjafjöldi breyttist úr ${num(a.rooms)} í ${num(b.rooms)}.`,
  built: (a, b) =>
    `Byggingarár breyttist úr ${year(a.built)} í ${year(b.built)}.`,
};
const TYPE = { apartment: "Fjölbýli", house: "Sérbýli", other: "Annað" };

const STATUS = {
  confirmed: {
    icon: ShieldCheck,
    title: "Samfelld sölusaga",
    text: (n: number) =>
      `${n} skráðir samningar með sama fastanúmeri. Einingarnúmer, stærð og tegund eru óbreytt milli samninga, svo líklega er um sömu eign að ræða.`,
  },
  uncertain: {
    icon: TriangleAlert,
    title: "Óviss samsvörun",
    text: (n: number) =>
      `${n} skráðir samningar með sama fastanúmeri, en einingarnúmer, stærð eða tegund breyttist á milli þeirra. Eignin kann að hafa verið stækkuð, sameinuð eða endurskráð; berðu verð saman með varúð.`,
  },
  single: {
    icon: Info,
    title: "Engin fyrri sala skráð",
    text: () =>
      "Aðeins einn kaupsamningur um þetta fastanúmer er í kaupskrá HMS (frá 2006). Ekki er hægt að sýna verðbreytingu.",
  },
} as const;

function StepCard({
  step,
  prior,
  postcode,
}: {
  step: Step;
  prior?: Step["sale"];
  postcode: string;
}) {
  const s = step.sale,
    p = step.previous;
  return (
    <li className="history-step panel">
      <div className="history-step-head">
        <div>
          <span className="eyebrow">Undirritaður</span>
          <h3>{date(s.date)}</h3>
          <small>Þinglýstur {s.registered ? date(s.registered) : "—"}</small>
        </div>
        <div className="history-price">
          <strong>{s.price > 0 ? money(s.price) : "—"}</strong>
          <span>{step.ppm ? ppm(step.ppm) : "Fermetraverð á ekki við"}</span>
        </div>
      </div>
      <p className="history-attrs">
        {TYPE[s.type]} · {sqm(s.area)} · {num(s.rooms)} herb. · byggt{" "}
        {year(s.built)} · eining {s.unitCode || "óþekkt"}
        {s.valuation ? ` · fasteignamat við sölu ${money(s.valuation)}` : ""}
      </p>
      {p ? (
        <div className={`history-change ${p.uncertain ? "uncertain" : ""}`}>
          <strong>
            {p.change >= 0 ? "+" : "−"}
            {money(Math.abs(p.change))} ({percent(p.percent)})
          </strong>{" "}
          í nafnverði frá sölu {date(p.date)} ({numberIS(p.years, 1)} ár á
          milli)
          {p.ppmPercent !== null && (
            <> · fermetraverð {percent(p.ppmPercent)}</>
          )}
          {p.skipped > 0 && (
            <small>
              Borið saman við síðustu sölu með sambærilegt verð;{" "}
              {p.skipped === 1 ? "einum samningi" : `${p.skipped} samningum`} á
              milli var sleppt.
            </small>
          )}
          {prior &&
            p.differences.map((d) => (
              <small key={d}>
                <TriangleAlert size={13} /> {CHANGE[d](prior, s)}
              </small>
            ))}
          {p.uncertain && !p.differences.length && (
            <small>
              <TriangleAlert size={13} /> Annar samninganna er óvenjulegur
              (ófullbúin eign eða öfgagildi); samanburðurinn er óviss.
            </small>
          )}
        </div>
      ) : step.noComparison === "not_comparable" ? (
        <p className="micro">
          Engin verðbreyting reiknuð: verð þessa samnings er ekki sambærilegt.
        </p>
      ) : step.noComparison === "no_comparable_earlier" ? (
        <p className="micro">
          Engin verðbreyting reiknuð: enginn fyrri samningur hefur sambærilegt
          verð.
        </p>
      ) : null}
      {step.caveats.map((c) => (
        <p key={c} className="history-caveat">
          <Info size={14} /> {CAVEAT[c]}
          {c === "bundle" && s.bundleTypes.length > 0 && (
            <> Aðrar eignir: {s.bundleTypes.join(", ")}.</>
          )}
        </p>
      ))}
      {s.duplicates.length > 0 && (
        <p className="history-caveat">
          <Info size={14} /> Sami samningur virðist skráður{" "}
          {s.duplicates.length + 1} sinnum (sama dagsetning og verð); hann er
          aðeins talinn einu sinni.
        </p>
      )}
      <p className="history-links">
        <small>Færsla {s.id}</small>
        {s.price > 0 && !s.bundle && !s.unsuitable && (
          <Link href={distributionLink({ ...s, postcode })}>
            Hvar lá verðið? →
          </Link>
        )}
      </p>
    </li>
  );
}

export function SalesHistory({ history }: { history: DescribedHistory }) {
  const status = STATUS[history.status],
    Icon = status.icon,
    latest = history.latest;
  return (
    <main id="main" className="insight-page history-page">
      <span className="eyebrow">SÖLUSAGA EIGNAR · KAUPSKRÁ HMS</span>
      <h1>{history.address}</h1>
      <p className="intro">
        {history.postcode} {history.municipalityName} · Fastanúmer{" "}
        {history.propertyId} · Nýjasta skráða eining{" "}
        {latest.unitCode || "óþekkt"}
      </p>
      <div className={`history-status panel status-${history.status}`}>
        <Icon size={22} />
        <div>
          <h2>{status.title}</h2>
          <p>{status.text(history.sales.length)}</p>
        </div>
      </div>
      <div className="history-actions">
        <Link
          className="primary-button"
          href={`/verdmat?property=${history.propertyId}`}
        >
          Verðmeta eignina <ArrowUpRight size={16} />
        </Link>
        <Link className="text-button" href="/eign">
          Leita að annarri eign
        </Link>
      </div>
      <p className="notice availability" role="note">
        <Info size={16} />
        <span>
          Fyrra söluverð er ekki endilega fyrra verðmæti sömu eignar.
          Endurbætur, viðbyggingar, breytt skipting eininga, ástand og óvenjuleg
          kjör geta skýrt muninn. Breytingar eru í nafnverði, ekki leiðréttar
          fyrir verðbólgu, og eru hvorki ávöxtun, verðþróun markaðarins né
          opinber verðvísitala.
        </span>
      </p>
      <h2 className="history-heading">
        Skráðir kaupsamningar <small>nýjast fyrst</small>
      </h2>
      <ol className="history-list">
        {history.steps.map((step) => (
          <StepCard
            key={step.sale.id}
            step={step}
            postcode={history.postcode}
            prior={history.sales.find((s) => s.id === step.previous?.id)}
          />
        ))}
      </ol>
      <details className="explainer">
        <summary>
          <Info size={14} /> Hvernig er sölusagan fundin?
        </summary>
        <p>
          Samningar eru tengdir saman með fastanúmeri (FASTNUM) í kaupskrá HMS.
          Fastanúmer getur haldist þótt eign breytist, svo einnig er borið saman
          einingarnúmer (FEPILOG), skráð stærð (frávik umfram 2 m² eða 5%, hvort
          sem er meira) og tegund. Samningur sem nær yfir fleiri eignir, eða sem
          HMS telur ekki nothæfan, er sýndur en ekki notaður til að reikna
          verðbreytingu. Sama sala sem skráð er tvisvar (sama dagsetning og
          verð) er talin einu sinni.
        </p>
        <p>
          Dagsetning undirritunar er dagur kaupsamnings; þinglýsing kemur
          venjulega nokkrum dögum síðar. Upplýsingar um kaupendur og seljendur
          eru ekki í gögnunum og eru ekki birtar.
        </p>
      </details>
    </main>
  );
}
