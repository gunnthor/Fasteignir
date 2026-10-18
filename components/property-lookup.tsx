"use client";
import { useEffect, useState } from "react";
import type { PropertyRecord, PropertyResult } from "@/lib/properties";
import { unitLabel } from "@/lib/units";
import { num } from "@/lib/format";
export function PropertyLookup({
  onSelect,
}: {
  onSelect: (property: PropertyRecord) => void;
}) {
  const [query, setQuery] = useState(""),
    [items, setItems] = useState<PropertyResult[]>([]),
    [status, setStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    if (query.trim().length < 2) {
      setStatus("");
      return;
    }
    setStatus("Leita að eignum…");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/properties?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        setItems(data.properties);
        setStatus(
          data.total
            ? `${data.total} eignir fundust.${data.hasMore ? " Fyrstu 25 sýndar. Þrengdu leitina með húsnúmeri eða póstnúmeri." : " Veldu rétta íbúð."}`
            : "Engin eign fannst. Þú getur fyllt út upplýsingar handvirkt.",
        );
      } catch (error) {
        if (!controller.signal.aborted) setStatus((error as Error).message);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return (
    <section className="property-lookup">
      <h3>Finndu eignina þína</h3>
      <label>
        Heimilisfang eða fastanúmer
        <input
          type="search"
          value={query}
          maxLength={120}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="t.d. Bæjarlind eða fastanúmer"
          autoComplete="off"
        />
      </label>
      <p className="micro" role="status">
        {status}
      </p>
      <div className="property-results">
        {items.map((p) => (
          <button
            type="button"
            className="property-choice"
            key={p.propertyId}
            onClick={() => {
              onSelect(p);
              setQuery("");
            }}
          >
            <strong>
              {p.address} · {p.postcode}
            </strong>
            <span>
              {num(p.area)} m² · {num(p.rooms)} herb. · Fastanúmer{" "}
              {p.propertyId}
            </span>
            <small>
              {unitLabel(p.unitCode)}
              {p.addressUnits && p.addressUnits > 1
                ? ` · ${p.addressUnits} eignir á staðfanginu`
                : ""}
            </small>
            {p.unitStatus === "shared_code" && (
              <small className="unit-warning">
                Önnur eign á sama staðfangi hefur sömu merkingu; athugaðu stærð
                og fastanúmer.
              </small>
            )}
          </button>
        ))}
      </div>
      <p className="micro">
        Leit í sögulegum kaupsamningum HMS, ekki tæmandi eignaskrá. Athugaðu
        fastanúmer og einingu áður en þú velur.
      </p>
    </section>
  );
}
