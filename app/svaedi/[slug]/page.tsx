import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Info, TriangleAlert } from "lucide-react";
import { getSnapshot } from "@/lib/server";
import { shareMetadata } from "@/lib/card";
import {
  cachedProfile,
  findProfile,
  getHousing,
  outline,
  profileList,
  type ProfileEntry,
} from "@/lib/profiles";
import { snapshotIncompleteMonths } from "@/lib/registration";
import { SAMPLE } from "@/lib/sample";
import { MUNICIPALITIES } from "@/lib/municipalities";
import {
  date,
  money,
  num,
  numberIS,
  percent,
  ppm,
  strings,
} from "@/lib/format";
import {
  DEFAULT_VIEW,
  NOMINAL_CAVEAT,
  areaKey,
  serializeFilters,
  serializeView,
  type AreaRef,
} from "@/lib/share";
import {
  ProfileCharts,
  ProfileDistribution,
} from "@/components/profile-client";

type Props = { params: Promise<{ slug: string }> };
const KIND = {
  municipality: "Sveitarfélag",
  district: "Borgarhluti Reykjavíkur",
  postcode: "Póstnúmer",
} as const;

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  const { rows, report } = await getSnapshot(),
    asOf = report.latestRegistration,
    entry = findProfile(rows, asOf, slug);
  return entry ? { rows, report, asOf, entry } : null;
}
function title(e: ProfileEntry) {
  return e.kind === "postcode" ? `${e.label}` : e.label;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const l = await load(slug);
    if (!l) return { title: "Svæði fannst ekki" };
    const p = cachedProfile(
        l.rows,
        l.entry,
        l.asOf,
        await getHousing(),
        snapshotIncompleteMonths(l.rows, l.asOf).map((m) => m.month),
      ),
      s = p.summary,
      name = title(l.entry),
      description =
        s.count < SAMPLE.median
          ? `${name}: ${num(s.count)} gildar sölur síðustu 12 mánuði — of fáar til að birta verð. Þinglýst kaupverð úr Kaupskrá HMS.`
          : `${name}: miðgildi söluverðs ${ppm(s.ppm)} og ${money(s.price)} í ${num(s.count)} gildum sölum síðustu 12 mánuði. Þinglýst kaupverð úr Kaupskrá HMS.`;
    const shared = await shareMetadata(
      Object.fromEntries(serializeFilters(p.filters)),
    );
    return {
      title: `${name} · Fasteignaverð og sölur`,
      description,
      alternates: { canonical: `/svaedi/${l.entry.slug}` },
      robots: l.entry.listed ? undefined : { index: false, follow: true },
      openGraph: {
        ...shared.openGraph,
        title: `${name} · Fasteign`,
        description,
      },
      twitter: { ...shared.twitter, title: `${name} · Fasteign`, description },
    };
  } catch {
    return { title: "Svæði" };
  }
}

export default async function AreaProfile({ params }: Props) {
  const { slug } = await params;
  const l = await load(slug).catch(() => null);
  if (!l) notFound();
  const { rows, report, asOf, entry } = l,
    incomplete = snapshotIncompleteMonths(rows, asOf).map((m) => m.month),
    p = cachedProfile(rows, entry, asOf, await getHousing(), incomplete),
    s = p.summary,
    shape = await outline(p.ref).catch(() => null),
    name = title(entry),
    key = areaKey(p.ref);
  const parent: AreaRef =
    entry.kind === "district"
      ? { kind: "municipality", id: "0000" }
      : entry.kind === "postcode"
        ? {
            kind: "municipality",
            id:
              Object.entries(MUNICIPALITIES).find(
                ([, n]) => n === entry.municipalities[0],
              )?.[0] ?? "0000",
          }
        : { kind: "municipality", id: entry.id === "0000" ? "1000" : "0000" };
  const mapHref = `/?${serializeView({ ...DEFAULT_VIEW, filters: p.filters, level: entry.kind === "district" ? "district" : "postcode" })}`,
    marketHref = `/markadur?${serializeFilters(p.filters)}`,
    compareHref = `/samanburdur?${new URLSearchParams({ a: key, b: areaKey(parent) })}`,
    compositionHref = `/samsetning?${new URLSearchParams({ area: key })}`;
  const ctx = {
    area: name,
    from: p.trendFrom,
    to: p.to,
    filters: [],
    downloadedAt: report.sources.kaupskra.downloadedAt,
    count: p.trend.reduce((n, t) => n + t.volume, 0),
    incomplete,
  };
  const others = profileList(rows, asOf).filter(
    (o) => o.kind === entry.kind && o.listed && o.slug !== entry.slug,
  );
  const houseShare =
    s.count >= SAMPLE.median ? (p.mix.house / s.count) * 100 : null;
  return (
    <main id="main" className="insight-page profile-page">
      <nav className="breadcrumb" aria-label="Brauðmolar">
        <Link href="/svaedi">Svæði</Link> <span aria-hidden>›</span>{" "}
        <span>{KIND[entry.kind]}</span>
      </nav>
      <span className="eyebrow">
        {KIND[entry.kind].toLocaleUpperCase("is")} · ÞINGLÝSTIR KAUPSAMNINGAR
      </span>
      <h1>{name}</h1>
      <p className="intro">
        {entry.kind === "district"
          ? "Borgarhluti í Reykjavík samkvæmt opinberum mörkum Reykjavíkurborgar (LUKR)."
          : entry.kind === "postcode"
            ? `Póstsvæði${entry.municipalities.length ? ` í ${entry.municipalities.join(" og ")}` : ""} samkvæmt mörkum Byggðastofnunar.`
            : "Sveitarfélag á höfuðborgarsvæðinu."}{" "}
        Tölur byggja á gildum þinglýstum kaupsamningum úr Kaupskrá HMS, síðustu
        12 mánuði til {date(asOf)}.
      </p>

      <section className="profile-top">
        {shape ? (
          <figure className="panel profile-shape">
            <svg
              viewBox={`0 0 ${shape.width} ${shape.height}`}
              role="img"
              aria-label={`Útlína svæðisins ${name}`}
            >
              <path d={shape.d} />
            </svg>
            <figcaption className="micro">
              Einfölduð útlína opinberra marka (
              {entry.kind === "district"
                ? "Reykjavíkurborg / LUKR"
                : "Byggðastofnun"}
              ).
            </figcaption>
          </figure>
        ) : (
          <div className="panel profile-shape">
            <p className="micro">
              Mörk sveitarfélaga eru ekki í gögnum Fasteignar.{" "}
              {entry.kind === "municipality" &&
                "Póstnúmer sveitarfélagsins eru talin upp hér að neðan."}
            </p>
          </div>
        )}
        <div className="panel profile-stats">
          <div className="hero-stat">
            <span>Miðgildi söluverðs á m²</span>
            <strong>{ppm(s.ppm)}</strong>
            <small>
              {num(s.count)} gildar sölur · {date(p.from)} – {date(p.to)}
            </small>
          </div>
          {s.sparse && (
            <p className="notice">
              {s.count < SAMPLE.median ? strings.suppressed : strings.sparse}
            </p>
          )}
          <dl className="profile-grid">
            <div>
              <dt>Miðgildi kaupverðs</dt>
              <dd>{money(s.price)}</dd>
            </div>
            <div>
              <dt>Breyting á m² frá fyrra ári</dt>
              <dd>{percent(s.change)}</dd>
              <small>{num(s.previousCount)} sölur árið á undan</small>
            </div>
            <div>
              <dt>Hlutfall sérbýla</dt>
              <dd>
                {houseShare === null ? "—" : `${numberIS(houseShare, 0)}%`}
              </dd>
              <small>
                {num(p.mix.apartment)} fjölbýli · {num(p.mix.house)} sérbýli
              </small>
            </div>
            <div>
              <dt>Miðgildi stærðar</dt>
              <dd>{s.area === null ? "—" : `${numberIS(s.area)} m²`}</dd>
            </div>
          </dl>
          <p className="micro">
            {NOMINAL_CAVEAT} Breyting milli ára endurspeglar líka breytta
            samsetningu —{" "}
            <Link className="inline-link" href={compositionHref}>
              skoða samsetningu
            </Link>
            .
          </p>
        </div>
      </section>

      <section
        className="panel profile-housing"
        aria-labelledby="housing-title"
      >
        <h2 id="housing-title">Íbúar, íbúðir og umsvif</h2>
        {p.activity ? (
          <>
            <dl className="profile-grid">
              <div>
                <dt>Íbúar ({p.activity.year})</dt>
                <dd>{num(p.activity.population)}</dd>
              </div>
              <div>
                <dt>Íbúðir ({p.activity.year})</dt>
                <dd>{num(p.activity.dwellings)}</dd>
              </div>
              <div>
                <dt>Íbúar á íbúð</dt>
                <dd>
                  {numberIS(p.activity.population / p.activity.dwellings, 1)}
                </dd>
              </div>
              <div>
                <dt>Skráðar sölur á 1.000 íbúðir</dt>
                <dd>
                  {p.activity.rate === null
                    ? "—"
                    : numberIS(p.activity.rate, 1)}
                </dd>
                <small>
                  {num(p.activity.sales)} gildar sölur, {date(p.activity.from)}{" "}
                  – {date(p.activity.to)}
                </small>
              </div>
            </dl>
            <p className="micro">
              Íbúa- og íbúðafjöldi {p.activity.year} úr opnum gögnum
              Reykjavíkurborgar (gagnasafnið „Hverfi“, eftir
              stjórnsýsluskiptingu sem er sú sama og borgarhlutamörkin sem sölur
              eru staðsettar eftir); nákvæmur viðmiðunardagur er ekki
              tilgreindur. „Sölur á 1.000 íbúðir“ er fjöldi gildra kaupsamninga
              á 12 heilum mánuðum (án líklega ófullgerðra mánaða) deilt með
              íbúðafjölda. Það er <strong>ekki</strong> hlutfall íbúða sem
              seldust: sama íbúð getur selst oftar en einu sinni, samningar sem
              HMS telur ónothæfa eru ekki taldir og íbúðafjöldinn er frá einu
              ári.
              {p.activity.coverage !== null &&
                p.activity.coverage < 99.5 &&
                ` Aðeins sölur sem tókst að staðsetja í borgarhluta eru taldar (${numberIS(p.activity.coverage, 1)}% gildra sala í Reykjavík á tímabilinu), svo talan getur verið lítillega vanmetin.`}
            </p>
          </>
        ) : (
          <p className="notice">
            <Info size={16} />{" "}
            {entry.kind === "district"
              ? `Íbúa- og íbúðatölur eru ekki tiltækar: ${p.housingStatus ?? "óþekkt ástæða"}.`
              : "Staðfestar íbúa- og íbúðatölur eru aðeins til fyrir borgarhluta Reykjavíkur. Fyrir póstnúmer og önnur sveitarfélög fannst ekkert gagnasafn með samræmdum mörkum, svo umsvif á hverja íbúð eru ekki reiknuð."}
          </p>
        )}
      </section>

      <section aria-labelledby="trend-title">
        <div className="section-title profile-section-title">
          <h2 id="trend-title">Þróun síðustu fimm ár</h2>
          <span>
            {date(p.trendFrom)} – {date(p.to)}
          </span>
        </div>
        <ProfileCharts trend={p.trend} ctx={ctx} />
        {incomplete.length > 0 && (
          <p className="micro incomplete-note">
            <TriangleAlert size={14} /> Síðustu mánuðir ({incomplete.join(", ")}
            ) eru líklega ófullgerðir vegna þinglýsingartíma.{" "}
            <Link href="/nyskrad">Um þinglýsingartíma →</Link>
          </p>
        )}
      </section>

      <span id="dreifing" />
      <ProfileDistribution filters={p.filters} />

      <section className="panel profile-links" aria-labelledby="links-title">
        <h2 id="links-title">Skoða nánar</h2>
        <ul>
          <li>
            <Link href={mapHref}>
              <ArrowUpRight size={15} /> Á korti og einstakar sölur
            </Link>
          </li>
          <li>
            <Link href={marketHref}>
              <ArrowUpRight size={15} /> Markaðsyfirlit með síum
            </Link>
          </li>
          <li>
            <Link href={compareHref}>
              <ArrowUpRight size={15} /> Bera saman við{" "}
              {parent.kind === "municipality"
                ? MUNICIPALITIES[parent.id]
                : "annað svæði"}
            </Link>
          </li>
          <li>
            <Link href={compositionHref}>
              <ArrowUpRight size={15} /> Samsetning seldra eigna milli ára
            </Link>
          </li>
        </ul>
        {entry.kind === "municipality" && (
          <p className="micro">
            Póstnúmer:{" "}
            {profileList(rows, asOf)
              .filter(
                (o) =>
                  o.kind === "postcode" &&
                  o.municipalities.includes(entry.label),
              )
              .map((o, i, all) => (
                <span key={o.slug}>
                  <Link href={`/svaedi/${o.slug}`}>{o.id}</Link>
                  {i < all.length - 1 ? ", " : ""}
                </span>
              ))}
          </p>
        )}
        {others.length > 0 && (
          <p className="micro">
            Önnur svæði:{" "}
            {others.map((o, i) => (
              <span key={o.slug}>
                <Link href={`/svaedi/${o.slug}`}>
                  {o.kind === "postcode" ? o.id : o.label}
                </Link>
                {i < others.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        )}
      </section>

      <details className="panel explainer">
        <summary>
          <Info size={14} /> Heimildir og aðferð
        </summary>
        <p>
          {strings.source}. Gögn sótt{" "}
          {date(report.sources.kaupskra.downloadedAt)}. Aðeins gildir
          kaupsamningar um íbúðarhúsnæði (sömu skilyrði og annars staðar á
          Fasteign). Miðgildi birtist frá {SAMPLE.median} sölum, viðvörun undir{" "}
          {SAMPLE.warn}. Sölur eru staðsettar eftir staðfangi; póstnúmer er eins
          og það er skráð á kaupsamningi.
        </p>
        {p.housingSource && (
          <p>
            Íbúa- og íbúðatölur: {p.housingSource.dataset}, sótt{" "}
            {date(p.housingSource.downloadedAt ?? asOf)}. Leyfi gagnasafnsins er
            ekki tilgreint á gagnagáttinni; sjá{" "}
            <Link href="/um-gognin">Um gögnin</Link>.
          </p>
        )}
      </details>
    </main>
  );
}
