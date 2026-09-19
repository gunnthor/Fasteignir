// Explicit Icelandic punctuation: some browser ICU builds fall back to English for is-IS.
export function numberIS(n: number, digits = 0) {
  if (!Number.isFinite(n)) return "—";
  const [whole, fraction] = n.toFixed(digits).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = fraction?.replace(/0+$/, "");
  return grouped + (decimal ? "," + decimal : "");
}
export const num = (n: number | null | undefined) =>
  n == null ? "—" : numberIS(n);
export const money = (n: number | null | undefined) =>
  n == null ? "—" : `${numberIS(n / 1e6, 1)} m.kr.`;
export const ppm = (n: number | null | undefined) =>
  n == null ? "—" : `${num(n / 1000)} þ.kr./m²`;
export const percent = (n: number | null | undefined) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${numberIS(n, 1)}%`;
const months = [
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "maí",
  "jún.",
  "júl.",
  "ágú.",
  "sep.",
  "okt.",
  "nóv.",
  "des.",
];
export const date = (s: string) => {
  const d = new Date(s);
  return Number.isFinite(+d)
    ? `${d.getUTCDate()}. ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    : "—";
};
export const districtName = (s: string) => s.replace(/^\d+\.\s*/, "");
export const strings = {
  brand: "Fasteign",
  map: "Kort",
  market: "Markaðurinn",
  estimate: "Verðmat",
  about: "Um gögnin",
  search: "Leita að heimilisfangi, póstnúmeri eða svæði",
  source: "Byggir á upplýsingum frá HMS — Kaupskrá fasteigna",
  sparse: "Fáar sölur — túlkaðu niðurstöður varlega.",
  suppressed: "Færri en 5 sölur. Verðtölur eru ekki birtar.",
};
