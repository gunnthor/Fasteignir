// Readable, stable area-profile slugs ("107", "vesturbaer", "kopavogur").
// Isomorphic: used by server profiles and by client links.
import { DISTRICT_NAMES } from "./housing-names";
import { MUNICIPALITIES } from "./municipalities";
import { districtName } from "./format";
import type { AreaRef } from "./share";

export const fold = (s: string) =>
  s
    .toLocaleLowerCase("is")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/æ/g, "ae")
    .replace(/ö/g, "o")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const DISTRICT_SLUG = Object.fromEntries(
  Object.entries(DISTRICT_NAMES).map(([name, id]) => [id, fold(name)]),
);

export function slugOf(a: AreaRef) {
  if (a.kind === "postcode") return a.id;
  if (a.kind === "district")
    return DISTRICT_SLUG[a.id] ?? fold(districtName(a.id));
  return fold(MUNICIPALITIES[a.id] ?? a.id);
}
export const profileHref = (a: AreaRef) => `/svaedi/${slugOf(a)}`;
