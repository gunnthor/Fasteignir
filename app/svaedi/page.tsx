import Link from "next/link";
import { getSnapshot } from "@/lib/server";
import { PROFILE_MIN, profileList } from "@/lib/profiles";
import { date, num } from "@/lib/format";

export const metadata = {
  title: "Svæði",
  description:
    "Yfirlit yfir sveitarfélög, borgarhluta Reykjavíkur og póstnúmer á höfuðborgarsvæðinu: söluverð, umsvif og samsetning úr Kaupskrá HMS.",
};

const GROUPS = [
  ["municipality", "Sveitarfélög"],
  ["district", "Borgarhlutar Reykjavíkur"],
  ["postcode", "Póstnúmer"],
] as const;

export default async function Areas() {
  let list, asOf;
  try {
    const { rows, report } = await getSnapshot();
    asOf = report.latestRegistration;
    list = profileList(rows, asOf);
  } catch {
    return (
      <main id="main" className="insight-page">
        <h1>Svæði</h1>
        <p className="notice">Gögn eru ekki tiltæk.</p>
      </main>
    );
  }
  const few = list.filter((o) => !o.listed);
  return (
    <main id="main" className="insight-page areas-page">
      <span className="eyebrow">SVÆÐI · HÖFUÐBORGARSVÆÐIÐ</span>
      <h1>Svæðasíður</h1>
      <p className="intro">
        Söluverð, fjöldi kaupsamninga og samsetning seldra eigna eftir svæðum. Í
        borgarhlutum Reykjavíkur bætast við íbúa- og íbúðatölur úr opnum gögnum
        borgarinnar.
      </p>
      {GROUPS.map(([kind, label]) => (
        <section
          key={kind}
          className="area-group"
          aria-labelledby={`g-${kind}`}
        >
          <h2 id={`g-${kind}`}>{label}</h2>
          <ul className="area-cards">
            {list
              .filter((o) => o.kind === kind && o.listed)
              // "2. Miðborg" before "10. Grafarholt…"; codes and postcodes numerically.
              .sort(
                (a, b) =>
                  parseInt(a.id) - parseInt(b.id) ||
                  a.id.localeCompare(b.id, "is"),
              )
              .map((o) => (
                <li key={o.slug}>
                  <Link className="panel" href={`/svaedi/${o.slug}`}>
                    <strong>{o.label}</strong>
                    <small>
                      {num(o.recent)} sölur síðustu 2 ár
                      {o.municipalities.length > 1
                        ? ` · ${o.municipalities.join(", ")}`
                        : ""}
                    </small>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {few.length > 0 && (
        <details className="panel explainer">
          <summary>
            Svæði með færri en {PROFILE_MIN} sölur síðustu tvö ár
          </summary>
          <p>
            Þessar síður eru aðgengilegar en ekki skráðar fyrir leitarvélar, því
            þar eru of fáar sölur til að birta flestar tölur:{" "}
            {few.map((o, i) => (
              <span key={o.slug}>
                <Link href={`/svaedi/${o.slug}`}>{o.label}</Link> (
                {num(o.recent)}){i < few.length - 1 ? ", " : ""}
              </span>
            ))}
            .
          </p>
        </details>
      )}
      <p className="micro">Gögn til {date(asOf)}.</p>
    </main>
  );
}
