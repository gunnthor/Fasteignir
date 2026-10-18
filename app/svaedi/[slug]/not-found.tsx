import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="insight-page">
      <span className="eyebrow">SVÆÐI</span>
      <h1>Svæðið fannst ekki</h1>
      <p className="intro">
        Engin svæðasíða er til með þessu heiti. Svæðasíður ná yfir sveitarfélög,
        borgarhluta Reykjavíkur og póstnúmer á höfuðborgarsvæðinu með gildum
        kaupsamningum.
      </p>
      <p className="history-actions">
        <Link className="primary-button" href="/svaedi">
          Öll svæði
        </Link>
      </p>
    </main>
  );
}
