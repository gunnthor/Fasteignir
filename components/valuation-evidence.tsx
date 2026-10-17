"use client";
import { useState } from "react";
import Link from "next/link";
import { Info, RotateCcw, TriangleAlert } from "lucide-react";
import type { Estimate, LOOKBACKS } from "@/lib/analytics";
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

type Available = Extract<Estimate, { available: true }>;
export type Subject = {
  postcode: string;
  type: string;
  area: number;
  rooms: number;
  built: number;
  propertyId?: string;
};
export type Backtest = {
  quarters: string[];
  tested: number;
  medianAbsolutePercentageError: number;
  within10Percent: number;
  bandCoverage: number;
  availability: number;
};
export type Scenario = {
  key: string;
  change: { area?: number; rooms?: number; built?: number; lookback?: number };
  available: boolean;
  count: number;
  central: number | null;
  low: number | null;
  high: number | null;
};

const pct = (share: number) => `${numberIS(share * 100, 0)}%`;
const shareBar = (share: number) => (
  <span className="share-bar" aria-hidden>
    <span style={{ width: `${Math.min(100, share * 100)}%` }} />
  </span>
);
const millions = (n: number) => `${numberIS(n / 1e6, 1)}`;

// How much the estimate rests on old, dissimilar or few sales, and how it has
// performed historically. None of this narrows the range or adds confidence.
export function Evidence({
  result,
  subject,
  backtest,
}: {
  result: Available;
  subject: Subject;
  backtest: Backtest;
}) {
  const d = result.diagnostics;
  const outside = {
    area: `Stærðin ${sqm(subject.area)} er utan stærða sambærilegra sala (${sqm(d.areaRange?.min)}–${sqm(d.areaRange?.max)}).`,
    rooms: `${num(subject.rooms)} herbergi er utan þess sem sambærilegar sölur höfðu (${num(d.roomsRange?.min)}–${num(d.roomsRange?.max)}).`,
    built: `Byggingarárið ${year(subject.built)} er utan byggingarára sambærilegra sala (${year(d.builtRange?.min)}–${year(d.builtRange?.max)}).`,
  };
  return (
    <section className="evidence panel" aria-labelledby="evidence-title">
      <h3 id="evidence-title">Á hverju byggir matið?</h3>
      <div className="evidence-grid">
        <div>
          <span>Sambærilegar sölur</span>
          <strong>{num(result.count)}</strong>
          <small>
            virk úrtaksstærð {numberIS(result.effective, 1)} · síðustu{" "}
            {result.lookback} mánuðir
          </small>
        </div>
        <div>
          <span>Miðgildi aldurs sala</span>
          <strong>{numberIS(result.medianAgeMonths ?? 0, 0)} mán.</strong>
        </div>
      </div>
      <ul className="evidence-bars">
        <li>
          <span>Vægi sala sem eru 12 mánaða eða eldri</span>
          {shareBar(d.olderShare)}
          <strong>{pct(d.olderShare)}</strong>
        </li>
        <li>
          <span>Vægi ólíkari eigna (stærð, herbergi, byggingarár)</span>
          {shareBar(d.lessSimilarShare)}
          <strong>{pct(d.lessSimilarShare)}</strong>
        </li>
        <li>
          <span>Vægi fimm vægismestu sala</span>
          {shareBar(d.top5Share)}
          <strong>{pct(d.top5Share)}</strong>
        </li>
      </ul>
      {d.leaveOneOut && (
        <p className="micro">
          Ef einni af tíu vægismestu sölunum er sleppt færist miðpunkturinn á
          bilinu {millions(d.leaveOneOut.min)}–{millions(d.leaveOneOut.max)}{" "}
          m.kr. (nú {millions(result.central)} m.kr.).
        </p>
      )}
      {d.outside.map((k) => (
        <p key={k} className="notice evidence-warning">
          <TriangleAlert size={16} />
          <span>
            {outside[k as keyof typeof outside]} Matið byggir þá á eignum sem
            eru ólíkari en þín og getur verið skakkt.
          </span>
        </p>
      ))}
      <div className="backtest">
        <h4>Hvernig hefur aðferðin reynst?</h4>
        <p>
          Í sögulegri prófun á {num(backtest.tested)} sölum (
          {backtest.quarters[0]} til {backtest.quarters.at(-1)}, aðeins sölur
          sem þá voru þinglýstar notaðar) var miðgildi frávika miðpunkts frá
          raunverði{" "}
          <strong>
            {numberIS(backtest.medianAbsolutePercentageError, 1)}%
          </strong>
          . Um {pct(backtest.within10Percent)} matanna voru innan 10% frá
          raunverði og raunverð lenti innan birta bilsins í um{" "}
          {pct(backtest.bandCoverage)} tilvika.
        </p>
        <p className="micro">
          Þetta er meðaltal yfir margar eignir. Verðbilið lýsir dreifingu
          sambærilegra sala; það er ekki kvarðað öryggisbil fyrir þína eign og
          þrengist ekki við að prófa sviðsmyndir.
        </p>
      </div>
    </section>
  );
}

const PARTS = [
  ["size", "Stærð"],
  ["room", "Herbergi"],
  ["age", "Byggingarár"],
  ["recency", "Tími"],
] as const;
function why(c: Available["comparables"][number], subject: Subject) {
  const s = c.sale;
  return {
    size: `${sqm(s.area)} á móti ${sqm(subject.area)} (${percent((s.area / subject.area - 1) * 100)})`,
    room: s.rooms
      ? `${num(s.rooms)} á móti ${num(subject.rooms)} herb.`
      : "Herbergjafjöldi óþekktur",
    age: s.built
      ? `Byggt ${year(s.built)} á móti ${year(subject.built)}`
      : "Byggingarár óþekkt",
    recency: `Seld fyrir ${numberIS(c.ageMonths, 0)} mánuðum`,
  };
}

// Every comparable with its normalized influence and the factors behind it.
export function Comparables({
  result,
  subject,
}: {
  result: Available;
  subject: Subject;
}) {
  const [all, setAll] = useState(false),
    list = all ? result.comparables : result.comparables.slice(0, 10),
    top = result.comparables[0]?.weight ?? 1;
  return (
    <section className="comparables">
      <div className="section-title">
        <h3>Sölurnar á bak við matið</h3>
        <span>{result.count} eignir, raðað eftir vægi</span>
      </div>
      <p className="micro">
        Vægi sýnir hlut hverrar sölu í vegna miðgildinu. Það er margfeldi
        fjögurra þátta: líkrar stærðar, herbergjafjölda, byggingarárs og hversu
        nýleg salan er (100% = fullkomin samsvörun). Ein sala er notuð á hverja
        eign.
      </p>
      <ol className="comparable-list">
        {list.map((c) => {
          const reasons = why(c, subject);
          return (
            <li key={c.sale.id}>
              <details>
                <summary>
                  <span className="comparable-name">
                    <strong>{c.sale.address}</strong>
                    <small>
                      {date(c.sale.date)} · {sqm(c.sale.area)} ·{" "}
                      {num(c.sale.rooms)} herb. · {money(c.sale.price)}
                    </small>
                  </span>
                  <span className="comparable-weight">
                    <span className="share-bar" aria-hidden>
                      <span style={{ width: `${(c.weight / top) * 100}%` }} />
                    </span>
                    <strong>{numberIS(c.weight * 100, 1)}%</strong>
                  </span>
                  <span className="comparable-ppm">{ppm(c.sale.ppm)}</span>
                </summary>
                <div className="comparable-detail">
                  <ul>
                    {PARTS.map(([k, label]) => (
                      <li key={k}>
                        <span>{label}</span>
                        <span>{reasons[k]}</span>
                        <strong>{numberIS(c.parts[k] * 100, 0)}%</strong>
                      </li>
                    ))}
                  </ul>
                  <p className="micro">
                    Byggt {year(c.sale.built)} · {c.sale.postcode}{" "}
                    {c.sale.municipalityName} · Færsla {c.sale.id}
                    {/^\d{7}$/.test(c.sale.propertyId) && (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/eign/${c.sale.propertyId}`}>
                          Sölusaga
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
      {result.comparables.length > 10 && (
        <button className="text-button" onClick={() => setAll(!all)}>
          {all
            ? "Sýna aðeins 10 vægismestu"
            : `Sýna allar ${result.comparables.length}`}
        </button>
      )}
    </section>
  );
}

const SCENARIO: Record<string, (s: Subject, c: Scenario["change"]) => string> =
  {
    "area-10": (_, c) => `Stærð −10% (${sqm(c.area)})`,
    "area+10": (_, c) => `Stærð +10% (${sqm(c.area)})`,
    "rooms-1": (_, c) => `Einu herbergi færra (${num(c.rooms)})`,
    "rooms+1": (_, c) => `Einu herbergi fleira (${num(c.rooms)})`,
    "built-10": (_, c) => `Byggt 10 árum fyrr (${year(c.built)})`,
    "built+10": (_, c) => `Byggt 10 árum síðar (${year(c.built)})`,
    lookback12: () => "Aðeins sölur síðustu 12 mánaða",
    lookback36: () => "Sölur síðustu 36 mánaða",
  };

type Lookback = (typeof LOOKBACKS)[number];
type ScenarioResult = {
  available: boolean;
  central?: number;
  low?: number;
  high?: number;
  count: number;
  reason?: string;
};

// What-if analysis: the same method rerun with changed inputs. Before/after
// with an explicit reset; never presented as improved accuracy.
export function Sensitivity({
  result,
  subject,
  scenarios,
}: {
  result: Available;
  subject: Subject;
  scenarios: Scenario[];
}) {
  const initial = {
    area: String(subject.area),
    rooms: String(subject.rooms),
    built: String(subject.built),
    lookback: String(result.lookback),
  };
  const [form, setForm] = useState(initial),
    [after, setAfter] = useState<ScenarioResult | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const changed = Object.entries(form).some(
    ([k, v]) => v !== initial[k as keyof typeof initial],
  );
  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const p = new URLSearchParams({
      postcode: subject.postcode,
      type: subject.type,
      ...form,
    });
    if (subject.propertyId) p.set("propertyId", subject.propertyId);
    try {
      const r = await fetch(`/api/estimate?${p}`),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setAfter(d);
    } catch (e) {
      setError((e as Error).message);
      setAfter(null);
    } finally {
      setLoading(false);
    }
  }
  const delta = (v: number | null) => {
    if (v === null) return "—";
    const d = v - result.central;
    // Below 50 þús. kr. the change rounds to nothing at one decimal.
    if (Math.abs(d) < 50_000) return "Engin breyting";
    return `${d > 0 ? "+" : "−"}${millions(Math.abs(d))} m.kr. (${percent((v / result.central - 1) * 100)})`;
  };
  return (
    <section className="sensitivity panel" aria-labelledby="sensitivity-title">
      <h3 id="sensitivity-title">Hvað ef forsendurnar væru aðrar?</h3>
      <p className="micro">
        Sama aðferð, endurreiknuð með einni breytingu í einu. Þannig sést hversu
        mikið niðurstaðan veltur á hverri forsendu — ekki hversu nákvæm hún er.
      </p>
      <div className="table-wrap">
        <table className="scenario-table">
          <thead>
            <tr>
              <th>Sviðsmynd</th>
              <th>Miðpunktur</th>
              <th>Breyting</th>
              <th>Sölur</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Upprunalegar forsendur</td>
              <td>{millions(result.central)} m.kr.</td>
              <td>—</td>
              <td>{num(result.count)}</td>
            </tr>
            {scenarios.map((s) => (
              <tr key={s.key}>
                <td>{SCENARIO[s.key]?.(subject, s.change) ?? s.key}</td>
                <td>
                  {s.central === null
                    ? "Of fáar sölur"
                    : `${millions(s.central)} m.kr.`}
                </td>
                <td>{delta(s.central)}</td>
                <td>{num(s.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="scenario-form" onSubmit={run}>
        <h4>Prófaðu eigin sviðsmynd</h4>
        <div className="scenario-fields">
          <label>
            Stærð í m²
            <input
              type="number"
              min="10"
              max="1000"
              step="0.1"
              required
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </label>
          <label>
            Herbergi
            <input
              type="number"
              min="1"
              max="20"
              required
              value={form.rooms}
              onChange={(e) => setForm({ ...form, rooms: e.target.value })}
            />
          </label>
          <label>
            Byggingarár
            <input
              type="number"
              min="1000"
              max={new Date().getFullYear()}
              required
              value={form.built}
              onChange={(e) => setForm({ ...form, built: e.target.value })}
            />
          </label>
          <label>
            Tímabil sala (sjálfgefið 24)
            <select
              value={form.lookback}
              onChange={(e) =>
                setForm({ ...form, lookback: e.target.value as `${Lookback}` })
              }
            >
              <option value="12">12 mán.</option>
              <option value="24">24 mán.</option>
              <option value="36">36 mán.</option>
            </select>
          </label>
        </div>
        <div className="scenario-actions">
          <button className="primary-button" disabled={loading || !changed}>
            {loading ? "Reikna…" : "Reikna sviðsmynd"}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={!changed && !after}
            onClick={() => {
              setForm(initial);
              setAfter(null);
              setError("");
            }}
          >
            <RotateCcw size={14} /> Endurstilla
          </button>
        </div>
      </form>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div aria-live="polite">
        {after && (
          <div className="before-after">
            <div>
              <span>Fyrir</span>
              <strong>{millions(result.central)} m.kr.</strong>
              <small>
                {millions(result.low)}–{millions(result.high)} m.kr. ·{" "}
                {num(result.count)} sölur
              </small>
            </div>
            <div>
              <span>Eftir</span>
              {after.available ? (
                <>
                  <strong>{millions(after.central!)} m.kr.</strong>
                  <small>
                    {millions(after.low!)}–{millions(after.high!)} m.kr. ·{" "}
                    {num(after.count)} sölur · {delta(after.central!)}
                  </small>
                </>
              ) : (
                <>
                  <strong>Ekkert mat</strong>
                  <small>
                    Of fáar sambærilegar sölur ({num(after.count)}). Við reiknum
                    ekki út fyrir gögnin.
                  </small>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="micro">
        <Info size={12} /> Ástand, endurbætur, hæð, svalir, útsýni og bílastæði
        eru ekki í gögnunum og eru því ekki hluti af sviðsmyndunum.
      </p>
    </section>
  );
}
