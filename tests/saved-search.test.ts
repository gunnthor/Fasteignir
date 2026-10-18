import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SAVED,
  NAME_MAX,
  SAVED_SEARCH_VERSION,
  cleanName,
  createSearch,
  defaultName,
  feedQuery,
  normalizeQuery,
  parseStore,
  searchHref,
  serializeStore,
  viewOf,
} from "../lib/saved-search";
import {
  DEFAULT_VIEW,
  parseFilterState,
  parseView,
  type View,
} from "../lib/share";
import { parseFilters } from "../lib/analytics";

const NOW = "2026-10-18T10:00:00.000Z";
const view = (query: string): View => parseView(new URLSearchParams(query));

test("a saved search round-trips through storage and restores its filters", () => {
  const v = view(
    "postcode=107&type=apartment&rooms=3&minArea=60&maxArea=90&minPrice=40&maxPrice=80&months=24&q=Hagamelur",
  );
  const s = createSearch(
    v,
    "/markadur",
    "  Vesturbær\n3 herb.  ",
    NOW,
    "abc-1",
  );
  assert.equal(s.v, SAVED_SEARCH_VERSION);
  assert.equal(s.name, "Vesturbær 3 herb.");
  const loaded = parseStore(serializeStore([s]));
  assert.equal(loaded.problem, null);
  assert.deepEqual(loaded.adjusted, []);
  assert.deepEqual(loaded.searches, [s]);
  const restored = viewOf(loaded.searches[0]);
  assert.deepEqual(restored, v);
  assert.equal(restored.filters.minPrice, "40");
  assert.equal(searchHref(s).startsWith("/markadur?"), true);
});

test("default names describe area, type and period", () => {
  assert.equal(
    defaultName(view("postcode=107&type=apartment")),
    "Póstnúmer 107 · Fjölbýli · Síðustu 12 mánuðir",
  );
  assert.equal(
    defaultName(DEFAULT_VIEW),
    "Höfuðborgarsvæðið · Allar íbúðir · Síðustu 12 mánuðir",
  );
});

test("names are cleaned of control characters and capped", () => {
  assert.equal(cleanName("a\u0000b\tc"), "a b c");
  assert.equal(cleanName("x".repeat(200)).length, NAME_MAX);
  // An empty name falls back to the default.
  assert.equal(
    createSearch(DEFAULT_VIEW, "/", "   ", NOW, "id").name,
    defaultName(DEFAULT_VIEW),
  );
});

test("obsolete or invalid filters are dropped on load and flagged as adjusted", () => {
  const raw = JSON.stringify({
    v: 1,
    searches: [
      {
        v: 1,
        id: "old",
        name: "Gömul leit",
        page: "/",
        // Unknown parameter, bad postcode, inverted size range, unsupported period.
        query:
          "postcode=1O7&minArea=120&maxArea=60&months=7&legacy=1&type=apartment",
        created: NOW,
        updated: NOW,
      },
    ],
  });
  const loaded = parseStore(raw);
  assert.deepEqual(loaded.adjusted, ["old"]);
  assert.equal(loaded.searches[0].query, "type=apartment");
  assert.equal(normalizeQuery("type=apartment"), "type=apartment");
});

test("unreadable, foreign and newer stores are handled without throwing", () => {
  assert.equal(parseStore(null).problem, null);
  assert.equal(parseStore("{not json").problem, "corrupt");
  assert.equal(parseStore('{"v":1}').problem, "corrupt");
  assert.equal(parseStore('[{"id":1}]').problem, "corrupt");
  const newer = parseStore(
    JSON.stringify({ v: SAVED_SEARCH_VERSION + 1, searches: [] }),
  );
  assert.equal(newer.problem, "newer");
  assert.deepEqual(newer.searches, []);
});

test("malformed entries and duplicates are dropped; the list is capped", () => {
  const good = createSearch(DEFAULT_VIEW, "/", "A", NOW, "a");
  const entries = [
    good,
    { ...good }, // duplicate id
    { ...good, id: "b", page: "/admin" }, // unknown page
    { ...good, id: "c", v: 0 }, // old entry schema
    { ...good, id: "d", name: "" },
    { ...good, id: "e d" }, // invalid id characters
    "text",
    null,
    ...Array.from({ length: MAX_SAVED + 5 }, (_, i) => ({
      ...good,
      id: `n${i}`,
    })),
  ];
  const loaded = parseStore(JSON.stringify({ v: 1, searches: entries }));
  assert.equal(loaded.searches.length, MAX_SAVED);
  assert.equal(loaded.searches[0].id, "a");
  assert.ok(loaded.dropped >= 7);
});

test("feed parameters keep every filter except the period", () => {
  const v = view(
    "from=2020-01-01&to=2021-01-01&postcode=200&minPrice=50&rooms=5&q=Hamraborg",
  );
  assert.equal(
    feedQuery(v).toString(),
    "postcode=200&rooms=5&minPrice=50&q=Hamraborg",
  );
  assert.equal(feedQuery(DEFAULT_VIEW).toString(), "");
});

test("price range: whole m.kr. in URLs, ISK in analytics, inverted ranges rejected", () => {
  assert.deepEqual(
    [
      parseFilterState(new URLSearchParams("minPrice=90&maxPrice=40")).minPrice,
      parseFilterState(new URLSearchParams("maxPrice=0")).maxPrice,
    ],
    ["", ""],
  );
  const f = parseFilters(new URLSearchParams("minPrice=40&maxPrice=80"));
  assert.equal(f.minPrice, 40_000_000);
  assert.equal(f.maxPrice, 80_000_000);
  assert.equal(parseFilters(new URLSearchParams("")).maxPrice, Infinity);
  assert.throws(() =>
    parseFilters(new URLSearchParams("minPrice=90&maxPrice=40")),
  );
  assert.throws(() => parseFilters(new URLSearchParams("maxPrice=99999")));
});
