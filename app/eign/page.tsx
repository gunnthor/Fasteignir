import { HistoryLookup } from "@/components/history-lookup";
export const metadata = {
  title: "Sölusaga eignar",
  description:
    "Flettu upp íbúð og sjáðu skráða kaupsamninga hennar úr kaupskrá HMS: dagsetningar, kaupverð, verð á m² og breytingar milli sala.",
};
export default function HistorySearchPage() {
  return (
    <main id="main" className="insight-page history-page">
      <span className="eyebrow">SÖLUSAGA EIGNAR · KAUPSKRÁ HMS</span>
      <h1>Hvenær seldist eignin áður, og á hvað?</h1>
      <p className="intro">
        Finndu íbúð eftir heimilisfangi eða fastanúmeri og sjáðu alla skráða
        kaupsamninga hennar frá 2006.
      </p>
      <div className="panel history-search">
        <HistoryLookup />
      </div>
      <p className="micro">
        Aðeins þinglýstir kaupsamningar. Engar upplýsingar um kaupendur eða
        seljendur eru birtar.
      </p>
    </main>
  );
}
