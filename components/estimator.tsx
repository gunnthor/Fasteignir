"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowRight, Info } from "lucide-react";
import type { estimate } from "@/lib/analytics";
import { money, num, ppm, numberIS } from "@/lib/format";
import { PropertyLookup } from "./property-lookup";
import type { PropertyRecord } from "@/lib/properties";
import { SaleCard } from "./explorer";
type Result = ReturnType<typeof estimate>;
export function Estimator() {
  const form = useRef<HTMLFormElement>(null);
  const request = useRef(0);
  const [property, setProperty] = useState<PropertyRecord | null>(null);
  const selectProperty = useCallback((p: PropertyRecord) => {
    request.current++;
    setLoading(false);
    setResult(null);
    setError("");
    setProperty(p);
    for (const key of ["postcode", "type", "area", "rooms", "built"] as const) {
      const input = form.current?.elements.namedItem(key) as
        HTMLInputElement | HTMLSelectElement | null;
      if (input) input.value = String(p[key] ?? "");
    }
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("property");
    if (!id) return;
    const abort = new AbortController();
    fetch(`/api/properties?id=${encodeURIComponent(id)}`, {
      signal: abort.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        selectProperty(d.property);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [selectProperty]);
  const [result, setResult] = useState<Result | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const generation = ++request.current;
    setLoading(true);
    setError("");
    setResult(null);
    const p = new URLSearchParams(
      new FormData(e.currentTarget) as unknown as Record<string, string>,
    );
    try {
      const r = await fetch(`/api/estimate?${p}`);
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (generation === request.current) setResult(d);
    } catch (e) {
      if (generation === request.current) setError((e as Error).message);
    } finally {
      if (generation === request.current) setLoading(false);
    }
  }
  return (
    <main id="main" className="estimate-page">
      <span className="eyebrow">GAGNSÆTT VERÐMAT · TILRAUNAÚTGÁFA</span>
      <h1>
        Hvað gæti eignin mín
        <br />
        verið verðmæt?
      </h1>
      <p className="intro">
        Byrjaðu á því sem við vitum: hvað sambærileg heimili hafa raunverulega
        selst á.
      </p>
      <div className="estimate-layout">
        <form
          ref={form}
          className="estimate-form panel"
          onSubmit={submit}
          onChange={() => {
            request.current++;
            setLoading(false);
            setResult(null);
            setError("");
          }}
        >
          <PropertyLookup onSelect={selectProperty} />
          <input
            type="hidden"
            name="propertyId"
            value={property?.propertyId ?? ""}
          />
          {property && (
            <div className="notice">
              <strong>
                {property.address} · {property.postcode}
              </strong>
              <p>
                Fastanúmer {property.propertyId} · Eining{" "}
                {property.unitCode || "óþekkt"}
              </p>
              <p>
                Upplýsingar úr samningi {property.recordedAt}. Yfirfarðu stærð,
                herbergi og byggingarár. Fyrri sölur þessarar eignar eru
                undanskildar matinu.
              </p>
              <button
                type="button"
                onClick={() => {
                  setProperty(null);
                  setResult(null);
                  request.current++;
                  setLoading(false);
                }}
              >
                Hreinsa val á eign
              </button>
            </div>
          )}
          <h3>Segðu okkur frá eigninni</h3>
          <label>
            Póstnúmer
            <input
              name="postcode"
              placeholder="t.d. 108"
              required
              pattern="[0-9]{3}"
              maxLength={3}
              inputMode="numeric"
            />
          </label>
          <label>
            Tegund
            <select name="type">
              <option value="apartment">Fjölbýli</option>
              <option value="house">Sérbýli</option>
            </select>
          </label>
          <label>
            Stærð í m²
            <input
              name="area"
              type="number"
              min="10"
              max="1000"
              step="0.1"
              required
              placeholder="t.d. 90"
            />
          </label>
          <div className="range">
            <label>
              Herbergi
              <input
                name="rooms"
                type="number"
                min="1"
                max="20"
                required
                placeholder="3"
              />
            </label>
            <label>
              Byggingarár
              <input
                name="built"
                type="number"
                min="1000"
                max={new Date().getFullYear()}
                required
                placeholder="1980"
              />
            </label>
          </div>
          <button className="primary-button" disabled={loading}>
            {loading ? "Finn sambærilegar sölur…" : "Skoða verðbil"}
            <ArrowRight size={17} />
          </button>
          <p className="micro">
            Notar sama póstnúmer og eignartegund. Nákvæmt heimilisfang og ástand
            eignar eru ekki metin.
          </p>
        </form>
        <div aria-live="polite">
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {result ? (
            result.available ? (
              <section className="estimate-result panel">
                <span className="eyebrow">VERÐBIL ÚR SAMBÆRILEGUM SÖLUM</span>
                <div className="estimate-range">
                  {num(Math.floor(result.low / 1e6))}–
                  {num(Math.ceil(result.high / 1e6))} m.kr.
                </div>
                <p className="caption">
                  Miðpunktur: <strong>{money(result.central)}</strong>
                </p>
                <span className="confidence">
                  {result.confidence === "moderate"
                    ? "Miðlungs gagnastuðningur"
                    : "Veikur gagnastuðningur"}
                </span>
                <div className="stat-grid">
                  <div>
                    <span>Sambærilegar sölur</span>
                    <strong>{num(result.count)}</strong>
                  </div>
                  <div>
                    <span>Vegið miðgildi á m²</span>
                    <strong>{ppm(result.ppm)}</strong>
                  </div>
                </div>
                <p className="notice">
                  Bilið nær frá 10. til 90. vegins hundraðshluta sambærilegs
                  fermetraverðs. Það er ekki staðfest öryggisbil eða formlegt
                  fasteignamat.
                </p>
                <p className="micro">
                  Virk úrtaksstærð: {num(result.effective)}. Miðgildi aldurs
                  samninga: {num(result.medianAgeMonths)} mánuðir. Vægi ræðst af
                  stærð, herbergjum, byggingarári og tíma frá sölu. Engin
                  leiðrétting fyrir verðbólgu, ástandi eða nýlegum framkvæmdum.
                </p>
                <div className="section-title">
                  <h3>Sölurnar á bak við matið</h3>
                  <span>{result.count} eignir</span>
                </div>
                {result.comparables.map((c) => (
                  <div key={c.sale.id}>
                    <SaleCard sale={c.sale} />
                    <p className="micro">
                      Vægi: {numberIS(c.weight * 100, 1)}%
                    </p>
                  </div>
                ))}
              </section>
            ) : (
              <section className="explanation panel">
                <Info />
                <h2>Gögnin eru of veik</h2>
                <p>{result.reason}</p>
                <p>
                  {result.count} sambærilegar sölur fundust. Við birtum ekki
                  tölu þegar úrtakið er of lítið.
                </p>
              </section>
            )
          ) : (
            <section className="explanation panel">
              <span className="eyebrow">ENGIN DULIN FORSENDA</span>
              <h2 style={{ marginTop: 15 }}>
                Raunverulegar sölur.
                <br />
                Skiljanleg niðurstaða.
              </h2>
              <ol>
                <li>
                  Við finnum íbúðir af sömu tegund í sama póstnúmeri sem seldust
                  síðustu 24 mánuði.
                </li>
                <li>
                  Nýlegri sölur og líkari eignir fá meira vægi. Stærð, herbergi
                  og byggingarár ráða samanburðinum.
                </li>
                <li>
                  Þú færð verðbil og sérð hverja sölu sem liggur að baki. Þegar
                  gögnin eru veik segjum við það.
                </li>
              </ol>
              <p className="notice">
                Þetta er fyrsta samanburðarlíkan, enn án staðfestrar
                skekkjumælingar. Það þekkir ekki ástand, útsýni, hæð eða
                bílastæði eignarinnar.
              </p>
              <Link href="/um-gognin" className="text-button">
                Skoða aðferðafræðina <ArrowUpRight size={15} />
              </Link>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
