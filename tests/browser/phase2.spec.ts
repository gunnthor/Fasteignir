import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (r) =>
    r.fulfill({
      contentType: "image/png",
      body: readFileSync("tests/fixtures/neutral-tile.png"),
    }),
  );
});
const noOverflow = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("saved searches: save, survive reload, rename, restore and delete", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/markadur?postcode=107&type=apartment&months=24");
  await expect(page.getByText(/gildar sölur á tímabilinu/)).toBeVisible();
  await page.getByRole("button", { name: /Vista leit/ }).click();
  const panel = page.getByRole("dialog", { name: "Vistaðar leitir" });
  await expect(panel.getByLabel("Heiti leitar")).toHaveValue(
    "Póstnúmer 107 · Fjölbýli · Síðustu 2 ár",
  );
  await panel.getByLabel("Heiti leitar").fill("Vesturbær, fjölbýli");
  await panel.getByRole("button", { name: "Vista", exact: true }).click();
  await expect(panel.locator(".saved-open")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  // Change the view, then reload: the search is still stored.
  await page.goto("/markadur");
  await page.getByRole("button", { name: /Vista leit/ }).click();
  await expect(page.locator(".count-badge")).toHaveText("1");
  const item = page.locator(".saved-open").first();
  await expect(item).toContainText("Vesturbær, fjölbýli");
  await expect(item).toContainText("Síðustu 2 ár");
  await page
    .getByRole("button", { name: "Endurnefna Vesturbær, fjölbýli" })
    .click();
  await page.getByLabel("Nýtt heiti leitar").fill("107 fjölbýli");
  await page.getByLabel("Nýtt heiti leitar").press("Enter");
  await expect(page.locator(".saved-open").first()).toContainText(
    "107 fjölbýli",
  );

  // Opening restores the filters in place (and in the address bar).
  await page.locator(".saved-open").first().click();
  await expect(page).toHaveURL(/postcode=107/);
  await expect(page).toHaveURL(/months=24/);
  await expect(page.locator(".market-summary h2")).toHaveText("Póstnúmer 107");

  // RSS link for the current filters points at the feed without a period.
  await page.getByRole("button", { name: /Vista leit/ }).click();
  await expect(
    page.getByRole("link", { name: "Gerast áskrifandi að RSS" }),
  ).toHaveAttribute("href", "/api/feed?type=apartment&postcode=107");
  await page.getByRole("button", { name: "Eyða 107 fjölbýli" }).click();
  await page.getByRole("button", { name: "Staðfesta eyðingu" }).click();
  await expect(page.locator(".saved-open")).toHaveCount(0);
  const stored = await page.evaluate(() =>
    localStorage.getItem("fasteign.savedSearches"),
  );
  expect(JSON.parse(stored!)).toEqual({ v: 1, searches: [] });
  expect(errors).toEqual([]);
});

test("saved searches tolerate corrupt, newer and obsolete stored data", async ({
  page,
}) => {
  await page.goto("/markadur");
  await page.evaluate(() =>
    localStorage.setItem(
      "fasteign.savedSearches",
      JSON.stringify({
        v: 1,
        searches: [
          {
            v: 1,
            id: "old",
            name: "Gömul",
            page: "/",
            query: "postcode=XYZ&months=7&type=house",
            created: "",
            updated: "",
          },
          { v: 1, id: "bad", name: "", page: "/", query: "" },
        ],
      }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: /Vista leit/ }).click();
  await expect(page.locator(".saved-open")).toHaveCount(1);
  await expect(page.locator(".saved-adjusted")).toBeVisible();
  await expect(page.getByText("Ein vistuð leit var ógild")).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem(
      "fasteign.savedSearches",
      JSON.stringify({ v: 9, searches: [] }),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: /Vista leit/ }).click();
  await expect(page.getByText(/vistaðar með nýrri útgáfu/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vista", exact: true }),
  ).toBeDisabled();
});

test("Atom feed is valid XML with stable, bounded, labelled entries", async ({
  page,
  request,
}) => {
  const r = await request.get("/api/feed?type=apartment");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("application/atom+xml");
  const xml = await r.text();
  await page.goto("/nyskrad");
  await expect(
    page.locator('link[rel="alternate"][type="application/atom+xml"]'),
  ).toHaveAttribute("href", /\/api\/feed$/);
  const parsed = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, "application/xml"),
      ns = "http://www.w3.org/2005/Atom",
      entries = [...doc.getElementsByTagNameNS(ns, "entry")];
    return {
      error: doc.getElementsByTagName("parsererror").length,
      root: doc.documentElement.namespaceURI,
      title: doc.getElementsByTagNameNS(ns, "title")[0]?.textContent,
      count: entries.length,
      ids: entries.map(
        (e) => e.getElementsByTagNameNS(ns, "id")[0]?.textContent,
      ),
      updated: entries.map(
        (e) => e.getElementsByTagNameNS(ns, "updated")[0]?.textContent,
      ),
      content:
        entries[0]?.getElementsByTagNameNS(ns, "content")[0]?.textContent ?? "",
    };
  }, xml);
  expect(parsed.error).toBe(0);
  expect(parsed.root).toBe("http://www.w3.org/2005/Atom");
  expect(parsed.title).toContain("Nýjar færslur");
  expect(parsed.count).toBeLessThanOrEqual(50);
  expect(new Set(parsed.ids).size).toBe(parsed.count);
  for (const id of parsed.ids)
    expect(id).toMatch(
      /^tag:fasteign\.gunnthor\.is,2026-10:kaupsamningur\/\d+\/\d+$/,
    );
  for (const u of parsed.updated)
    expect(u).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/);
  if (parsed.count) {
    expect(parsed.content).toContain("Dagsetning kaupsamnings");
    expect(parsed.content).toContain("Fyrst séður í kaupskrá HMS");
  }
  // Same request, same document: entries do not duplicate between polls.
  expect(await (await request.get("/api/feed?type=apartment")).text()).toBe(
    xml,
  );
  for (const bad of [
    "months=12",
    "postcode=abc",
    "q=" + "x".repeat(150),
    "foo=1",
  ])
    expect((await request.get(`/api/feed?${bad}`)).status()).toBe(400);
});

test("chart and table exports carry metadata, escape CSV and render images", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/markadur?postcode=107&type=apartment");
  const chart = page.locator(".market-charts article").first();
  await expect(chart.locator("h3")).toHaveText("Söluverð á fermetra");
  await chart.locator(".export-menu summary").click();
  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    chart.getByRole("button", { name: "Gögn (CSV)" }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(
    /^fasteign-postnumer-107-verd-m2-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const text = readFileSync(await csv.path(), "utf8");
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain("# Svæði: Póstnúmer 107");
  expect(text).toContain("# Síur: Fjölbýli");
  expect(text).toContain("# Heimild: HMS — Kaupskrá fasteigna");
  expect(text).toContain("Mánuður;Miðgildi verðs á m² (kr., 3 mán. gluggi)");
  // Every row with fewer than 5 sales in its window has an empty median.
  const rows = text.split("\r\n").filter((l) => /^\d{4}-\d{2};/.test(l));
  expect(rows.length).toBeGreaterThan(6);
  for (const r of rows) {
    const c = r.split(";");
    if (Number(c[4]) < 5) expect(c[1]).toBe("");
  }
  await chart.locator(".export-menu summary").click();
  const [svg] = await Promise.all([
    page.waitForEvent("download"),
    chart.getByRole("button", { name: "Mynd (SVG)" }).click(),
  ]);
  const svgText = readFileSync(await svg.path(), "utf8");
  const ok = await page.evaluate(
    (s) =>
      new DOMParser()
        .parseFromString(s, "image/svg+xml")
        .getElementsByTagName("parsererror").length === 0,
    svgText,
  );
  expect(ok).toBe(true);
  expect(svgText).toContain("Söluverð á fermetra · Póstnúmer 107");
  expect(svgText).toContain("Kaupskrá fasteigna");
  await chart.locator(".export-menu summary").click();
  const [png] = await Promise.all([
    page.waitForEvent("download"),
    chart.getByRole("button", { name: "Mynd (PNG)" }).click(),
  ]);
  const bytes = readFileSync(await png.path());
  expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  // Dark mode exports use the dark palette.
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await chart.locator(".export-menu summary").click();
  const [dark] = await Promise.all([
    page.waitForEvent("download"),
    chart.getByRole("button", { name: "Mynd (SVG)" }).click(),
  ]);
  expect(readFileSync(await dark.path(), "utf8")).toContain('fill="#1c2b25"');
  // Area tables export CSV only.
  const table = page.locator(".market-tables article").first();
  await table.locator(".export-menu summary").click();
  await expect(table.getByRole("button", { name: "Mynd (PNG)" })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});

test("composition comparison explains overall, mix and within-group changes", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/samsetning");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Hvað seldist — ekki aðeins á hvaða verði",
  );
  const explain = page.locator(".composition-explain");
  await expect(explain).toContainText("1. Heildarmiðgildi");
  await expect(explain).toContainText("2. Samsetning seldra eigna");
  await expect(explain).toContainText("3. Innan sambærilegra hópa");
  await expect(explain).toContainText("ekki verðvísitala");
  await expect(page.locator(".composition-dimension")).toHaveCount(5);
  // Shares of each dimension add up to 100 % in both periods.
  const sums = await page.locator(".composition-table").evaluateAll((tables) =>
    tables.map((t) =>
      [...t.querySelectorAll("tbody tr")].reduce(
        (n, tr) => {
          const [a, b] = tr
            .querySelector(".share-cell > span:last-child")!
            .textContent!.split("→")
            .map((s) => parseFloat(s.replace(",", ".")) || 0);
          return [n[0] + a, n[1] + b];
        },
        [0, 0],
      ),
    ),
  );
  for (const [a, b] of sums) {
    expect(Math.abs(a - 100)).toBeLessThan(0.6);
    expect(Math.abs(b - 100)).toBeLessThan(0.6);
  }
  await page.getByLabel("Tímabil").selectOption("years");
  await page.getByLabel("Fyrra ár").selectOption("2019");
  await page.getByLabel("Síðara ár").selectOption("2024");
  await page.getByRole("button", { name: "Bera saman" }).click();
  await expect(page).toHaveURL(/mode=years/);
  await expect(page.locator(".composition-warnings")).toContainText(
    "Meira en tvö ár",
  );
  await page.goto(
    "/samsetning?area=postcode:101&mode=custom&af=2025-01-01&at=2025-01-31&bf=2026-01-01&bt=2026-01-31",
  );
  await expect(page.locator(".composition-warnings")).toContainText(
    "Færri en 100 sölur",
  );
  expect(errors).toEqual([]);
});

test("area profiles: index, Reykjavík housing context, other areas and unknown slugs", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/svaedi");
  await expect(page.locator(".area-group")).toHaveCount(3);
  await page.getByRole("link", { name: /^Laugardalur/ }).click();
  await expect(page).toHaveURL(/\/svaedi\/laugardalur$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Laugardalur",
  );
  await expect(page.locator(".profile-shape svg path")).toHaveAttribute(
    "d",
    /^M/,
  );
  const housing = page.locator(".profile-housing");
  await expect(housing).toContainText("Íbúar (2026)");
  await expect(housing).toContainText("Skráðar sölur á 1.000 íbúðir");
  await expect(housing).toContainText("ekki hlutfall íbúða sem seldust");
  await expect(page.locator(".profile-charts article")).toHaveCount(2);
  await expect(page.locator(".distribution")).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/api\/card\?/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/svaedi\/laugardalur$/,
  );
  await page.goto("/svaedi/107");
  await expect(page.locator(".profile-housing")).toContainText(
    "aðeins til fyrir borgarhluta Reykjavíkur",
  );
  await page.goto("/svaedi/kopavogur");
  await expect(page.locator(".profile-shape")).toContainText(
    "Mörk sveitarfélaga eru ekki í gögnum Fasteignar",
  );
  await expect(page.locator(".profile-links")).toContainText("Póstnúmer:");
  const missing = await page.goto("/svaedi/ekki-til");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Svæðið fannst ekki",
  );
  // Discoverable from the map's area details.
  await page.goto("/?postcode=107");
  await expect(page.getByRole("link", { name: /Svæðasíða/ })).toHaveAttribute(
    "href",
    "/svaedi/107",
  );
  expect(errors).toEqual([]);
});

test("unit identification on sales history and lookup", async ({ page }) => {
  await page.goto("/eign/2013483");
  const unit = page.locator(".unit-panel");
  await expect(unit).toContainText("Merking 01-0302 · hæðarnúmer 03, rými 02");
  await expect(unit.locator("summary")).toContainText(
    "aðrar eignir á sama staðfangi",
  );
  await expect(unit.locator("li[aria-current]")).toContainText("þessi eign");
  await unit.getByRole("link", { name: /01.0301/ }).click();
  await expect(page).toHaveURL(/\/eign\/2013482$/);
  await page.goto("/eign");
  await page.getByLabel("Heimilisfang eða fastanúmer").fill("Langahlíð 19");
  const choices = page.locator(".property-choice");
  await expect(choices).toHaveCount(7);
  await expect(choices.first()).toContainText("Merking 01-0101");
  await expect(choices.first()).toContainText("7 eignir á staðfanginu");
});

test("map points at a shared address list every sale there without moving the point", async ({
  page,
}) => {
  await page.goto("/?points=1&q=Langahl%C3%AD%C3%B0%2019&months=0");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  const explore = await page.request.get(
    "/api/explore?q=Langahl%C3%AD%C3%B0%2019&months=0&points=1",
  );
  const body = await explore.json();
  const coords = new Set(
    body.points.features.map((f: { geometry: { coordinates: number[] } }) =>
      f.geometry.coordinates.join(","),
    ),
  );
  // All sales at one address share one official point; nothing is displaced.
  expect(body.points.features.length).toBeGreaterThan(1);
  expect(coords.size).toBe(1);
  const p = body.points.features[0].properties;
  expect(p).toHaveProperty("unitCode");
  expect(p).toHaveProperty("pointType");
  // The map fits the single point into its padded centre (components/map.tsx).
  await page.waitForTimeout(2500);
  const box = (await page.locator(".map-canvas").boundingBox())!;
  await page.mouse.click(
    box.x + 330 + (box.width - 750) / 2,
    box.y + 100 + (box.height - 250) / 2,
  );
  const popup = page.locator(".sale-popup");
  await expect(popup).toContainText(
    `${body.points.features.length} kaupsamningar á sama staðfangi`,
  );
  await expect(popup.locator(".sale-popup-list li")).toHaveCount(
    Math.min(body.points.features.length, 40),
  );
  await expect(popup).toContainText("ekki staðsetning einstakrar íbúðar");
  await page.locator(".sale-card summary").first().click();
  await expect(page.locator(".sale-expanded").first()).toContainText(
    "ekki staðsetning einstakrar íbúðar",
  );
  await expect(page.locator(".sale-expanded").first()).toContainText(
    "Merking 01-",
  );
});

test("new Phase 2 pages fit a phone in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/samsetning");
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  for (const url of [
    "/samsetning",
    "/svaedi",
    "/svaedi/laugardalur",
    "/eign/2013483",
    "/nyskrad",
  ]) {
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await noOverflow(page), url).toBe(true);
  }
});
