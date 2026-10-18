// Saved searches: named views kept in the visitor's browser (localStorage).
// Isomorphic and dependency-free apart from lib/share, so the normalization the
// client stores is exactly what the server-side feed parses.
//
// Storage format (envelope version 1):
//   { "v": 1, "searches": [{ v, id, name, page, query, created, updated }] }
// `query` is a canonical serializeView() string. Every load re-normalizes it, so a
// filter that later becomes invalid or obsolete is dropped instead of breaking the
// view; such entries are reported as adjusted.
import {
  areaLabel,
  parseView,
  periodLabel,
  serializeFilters,
  serializeView,
  typeLabel,
  type View,
} from "./share";

export const SAVED_SEARCH_VERSION = 1;
export const STORAGE_KEY = "fasteign.savedSearches";
export const MAX_SAVED = 30;
export const NAME_MAX = 80;
// Pages whose state is a View and can be restored from a saved search.
export const SEARCH_PAGES = {
  "/": "Kort",
  "/markadur": "Markaðurinn",
} as const;
export type SearchPage = keyof typeof SEARCH_PAGES;

export type SavedSearch = {
  v: typeof SAVED_SEARCH_VERSION;
  id: string;
  name: string;
  page: SearchPage;
  query: string;
  created: string;
  updated: string;
};

export type LoadedStore = {
  searches: SavedSearch[];
  // Entries changed by normalization (an invalid or obsolete filter was dropped).
  adjusted: string[];
  // Entries that could not be read at all.
  dropped: number;
  // corrupt: storage held something unreadable; newer: written by a later schema
  // version, which this version must not overwrite.
  problem: "corrupt" | "newer" | null;
};

export const normalizeQuery = (query: string) =>
  serializeView(parseView(new URLSearchParams(query))).toString();

export function cleanName(name: string) {
  return name
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
}

const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
function readEntry(
  raw: unknown,
): { entry: SavedSearch; adjusted: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (
    e.v !== SAVED_SEARCH_VERSION ||
    typeof e.id !== "string" ||
    !/^[\w-]{1,64}$/.test(e.id) ||
    typeof e.name !== "string" ||
    typeof e.query !== "string" ||
    e.query.length > 2000 ||
    typeof e.page !== "string" ||
    !(e.page in SEARCH_PAGES)
  )
    return null;
  const name = cleanName(e.name),
    query = normalizeQuery(e.query),
    created =
      typeof e.created === "string" && ISO.test(e.created) ? e.created : "",
    updated =
      typeof e.updated === "string" && ISO.test(e.updated)
        ? e.updated
        : created;
  if (!name) return null;
  return {
    entry: {
      v: SAVED_SEARCH_VERSION,
      id: e.id,
      name,
      page: e.page as SearchPage,
      query,
      created,
      updated,
    },
    adjusted: query !== e.query,
  };
}

export function parseStore(raw: string | null): LoadedStore {
  const empty: LoadedStore = {
    searches: [],
    adjusted: [],
    dropped: 0,
    problem: null,
  };
  if (raw === null || raw === "") return empty;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...empty, problem: "corrupt" };
  }
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as { searches?: unknown }).searches)
  )
    return { ...empty, problem: "corrupt" };
  const { v, searches } = data as { v: unknown; searches: unknown[] };
  if (typeof v === "number" && v > SAVED_SEARCH_VERSION)
    return { ...empty, problem: "newer" };
  if (v !== SAVED_SEARCH_VERSION) return { ...empty, problem: "corrupt" };
  const out: LoadedStore = { ...empty };
  const seen = new Set<string>();
  for (const item of searches.slice(0, MAX_SAVED * 2)) {
    const r = readEntry(item);
    if (!r || seen.has(r.entry.id) || out.searches.length >= MAX_SAVED) {
      out.dropped++;
      continue;
    }
    seen.add(r.entry.id);
    out.searches.push(r.entry);
    if (r.adjusted) out.adjusted.push(r.entry.id);
  }
  return out;
}

export const serializeStore = (searches: SavedSearch[]) =>
  JSON.stringify({
    v: SAVED_SEARCH_VERSION,
    searches: searches.slice(0, MAX_SAVED),
  });

// "Póstnúmer 107 · Fjölbýli · Síðustu 12 mánuðir"
export function defaultName(view: View) {
  return cleanName(
    [
      areaLabel(view.filters),
      typeLabel(view.filters.type),
      periodLabel(view.filters),
      view.q && `„${view.q}“`,
    ]
      .filter(Boolean)
      .join(" · "),
  );
}

export function createSearch(
  view: View,
  page: SearchPage,
  name: string,
  now: string,
  id: string,
): SavedSearch {
  return {
    v: SAVED_SEARCH_VERSION,
    id,
    name: cleanName(name) || defaultName(view),
    page,
    query: serializeView(view).toString(),
    created: now,
    updated: now,
  };
}

export const viewOf = (s: SavedSearch) =>
  parseView(new URLSearchParams(s.query));
export const searchHref = (s: SavedSearch) =>
  `${s.page}${s.query ? `?${s.query}` : ""}`;

// Parameters of the Atom feed for a view: every filter except the period (a feed
// follows new registrations, whatever the contract date) plus the address text.
export function feedQuery(view: View) {
  const p = serializeFilters({
    ...view.filters,
    months: "12",
    from: "",
    to: "",
  });
  if (view.q.trim()) p.set("q", view.q.trim());
  return p;
}
export const feedHref = (view: View) => {
  const p = feedQuery(view);
  return `/api/feed${p.size ? `?${p}` : ""}`;
};
