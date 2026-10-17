import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="insight-page history-page">
      <span className="eyebrow">SÖLUSAGA EIGNAR</span>
      <h1>Engin skráð sölusaga fannst</h1>
      <p className="intro">
        Fastanúmerið fannst ekki meðal íbúðarhúsnæðis á höfuðborgarsvæðinu í
        kaupskrá HMS. Eignin hefur ef til vill ekki verið seld síðan 2006, er
        ekki íbúðarhúsnæði, er utan höfuðborgarsvæðisins eða númerið er rangt.
      </p>
      <p className="history-actions">
        <Link className="primary-button" href="/eign">
          Leita að eign
        </Link>
      </p>
    </main>
  );
}
