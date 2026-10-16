import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (r) =>
    r.fulfill({
      contentType: "image/png",
      body: readFileSync("tests/fixtures/neutral-tile.png"),
    }),
  );
});
test("actual data, time/type filters, metrics, district details and map geometry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText(/gildar sölur á tímabilinu/)).toBeVisible();
  const first = await page.getByText(/gildar sölur á tímabilinu/).innerText();
  await page.getByRole("button", { name: "3 mán.", exact: true }).click();
  await expect(page.getByText(/gildar sölur á tímabilinu/)).not.toHaveText(
    first,
  );
  await page.getByRole("button", { name: "Fjölbýli", exact: true }).click();
  await page.locator("#metric").selectOption("count");
  await expect(page.locator(".map-legend strong")).toHaveText(
    "Fjöldi kaupsamninga",
  );
  await page.getByLabel("Svæðaskipting").selectOption("district");
  await page.getByRole("button", { name: /Laugardalur/ }).click();
  await expect(page.locator(".details h2")).toHaveText("Laugardalur");
  await expect(page.locator(".sale-card")).not.toHaveCount(0);
  await page.locator(".sale-card summary").first().click();
  await expect(page.locator(".sale-expanded").first()).toContainText(
    "Heimild: HMS Kaupskrá",
  );
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-rendered-districts",
    /^[1-9][0-9]*$/,
  );
  await expect(page.locator(".map-error")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("postcode search, invalid/empty results and explicit custom dates", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("textbox", { name: /Leita að/ });
  await search.fill("999");
  await expect(page.getByText("0 gildar sölur á tímabilinu")).toBeVisible();
  await expect(page.locator(".hero-stat>strong")).toHaveText("—");
  await search.fill("");
  await page.getByRole("button", { name: "Velja daga", exact: true }).click();
  await page.getByLabel("Frá dagsetningu").fill("2026-01-01");
  await page.getByLabel("Til dagsetningar").fill("2026-03-31");
  await expect(page.locator(".details>.caption")).toHaveText(
    "1. jan. 2026 – 31. mar. 2026",
  );
});
test("estimator exposes real comparables and weak-data state", async ({
  page,
}) => {
  await page.goto("/verdmat");
  await page.getByLabel("Póstnúmer", { exact: true }).fill("108");
  await page.getByLabel("Stærð í m²").fill("90");
  await page.getByLabel("Herbergi", { exact: true }).fill("3");
  await page.getByLabel("Byggingarár", { exact: true }).fill("1980");
  await page.getByRole("button", { name: "Skoða verðbil" }).click();
  await expect(page.locator(".estimate-range")).toBeVisible();
  await expect(page.getByText("Sölurnar á bak við matið")).toBeVisible();
  await page.getByLabel("Póstnúmer", { exact: true }).fill("999");
  await page.getByRole("button", { name: "Skoða verðbil" }).click();
  await expect(
    page.getByRole("heading", { name: "Gögnin eru of veik" }),
  ).toBeVisible();
});
test("mobile navigation, filters, dark mode and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText(/gildar sölur á tímabilinu/)).toBeVisible();
  await page.getByRole("button", { name: "Síur", exact: true }).click();
  await expect(page.locator("#municipality")).toBeVisible();
  await page.locator("#municipality").selectOption("1000");
  await expect(page.locator(".details h2")).toHaveText("Kópavogur");
  // Layouts size themselves from --header; the nav must not wrap past it.
  expect(
    await page.evaluate(
      () =>
        document.querySelector(".header")!.getBoundingClientRect().height <=
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--header",
          ),
        ) +
          1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Nota dökkt útlit" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Markaðurinn", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Markaðurinn, í samhengi." }),
  ).toBeVisible();
  await expect(page.locator("table")).not.toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("API bounded payload, no raw browser download, validation and sparse suppression", async ({
  request,
}) => {
  const response = await request.get("/api/explore");
  expect(response.status()).toBe(200);
  const raw = await response.text();
  const d = JSON.parse(raw);
  expect(d.summary.count).toBeGreaterThan(0);
  expect(d.points.features).toHaveLength(0);
  expect(d.recent.length).toBeLessThanOrEqual(40);
  expect(raw.length).toBeLessThan(100000);
  const points = await (await request.get("/api/explore?points=1")).json();
  expect(points.points.features.length).toBeLessThanOrEqual(1500);
  expect(
    (await request.get("/api/explore?minArea=100&maxArea=10")).status(),
  ).toBe(400);
  expect(
    (await request.get("/api/estimate?postcode=108&area=-20")).status(),
  ).toBe(400);
  expect((await request.get("/data/raw/kaupskra.csv")).status()).toBe(404);
});

test("official postcode map covers every Capital Region municipality", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Fleiri síur/ }).click();
  for (const [municipality, postcode] of [
    ["0000", "108"],
    ["1000", "200"],
    ["1100", "170"],
    ["1300", "210"],
    ["1400", "220"],
    ["1604", "270"],
    ["1606", "276"],
  ]) {
    await page.locator("#municipality").selectOption(municipality);
    await page.getByLabel("Póstnúmer", { exact: true }).fill(postcode);
    await expect(page.locator(".details h2")).toHaveText(
      `Póstnúmer ${postcode}`,
    );
    await expect(page.locator(".map-canvas")).toHaveAttribute(
      "data-rendered-postcodes",
      new RegExp(`(^|,)${postcode}(,|$)`),
    );
  }
  await expect(page.locator(".map-error")).toHaveCount(0);
});
test("lookup distinguishes apartments, prefills details and excludes own sales", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/properties?q=Bæjarlind%205");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.properties.length).toBeGreaterThan(1);
  const [first, second] = data.properties;
  expect(first.propertyId).not.toBe(second.propertyId);
  expect(first.unitCode).not.toBe(second.unitCode);
  await page.goto("/verdmat");
  const search = page.getByRole("searchbox", {
    name: "Heimilisfang eða fastanúmer",
  });
  await search.fill(first.propertyId);
  await page
    .getByRole("button", { name: new RegExp(`Fastanúmer ${first.propertyId}`) })
    .click();
  await expect(page.getByLabel("Stærð í m²")).toHaveValue(String(first.area));
  await search.fill(second.propertyId);
  await page
    .getByRole("button", {
      name: new RegExp(`Fastanúmer ${second.propertyId}`),
    })
    .click();
  await expect(page.getByLabel("Stærð í m²")).toHaveValue(String(second.area));
  await expect(page.locator('input[name="propertyId"]')).toHaveValue(
    second.propertyId,
  );
  await page.getByRole("button", { name: "Skoða verðbil" }).click();
  await expect(page.locator(".estimate-range")).toBeVisible();
  const params = new URLSearchParams({
    ...second,
    area: String(second.area),
    rooms: String(second.rooms),
    built: String(second.built),
  });
  const estimate = await (await request.get(`/api/estimate?${params}`)).json();
  expect(estimate.available).toBe(true);
  expect(
    estimate.comparables.every(
      (c: { sale: { propertyId: string } }) =>
        c.sale.propertyId !== second.propertyId,
    ),
  ).toBe(true);
  await page.goto(`/verdmat?property=${first.propertyId}`);
  await expect(page.getByLabel("Stærð í m²")).toHaveValue(String(first.area));
  expect((await request.get("/api/properties?q=a")).status()).toBe(400);
});
test("shared views restore filters, publish cards and embeds with caveats", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fjölbýli", exact: true }).click();
  await page.getByRole("button", { name: "2 ár", exact: true }).click();
  await expect(page).toHaveURL(/type=apartment/);
  await expect(page).toHaveURL(/months=24/);
  await page.goto("/markadur?postcode=107&type=apartment&rooms=3");
  await expect(page.locator(".market-summary h2")).toHaveText("Póstnúmer 107");
  await expect(
    page.getByRole("button", { name: "Fjölbýli", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Deila" }).click();
  await expect(page.locator("#share-link")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Deila" })).toBeFocused();
  await page.getByRole("button", { name: "Deila" }).click();
  await page.getByText("Festa dagsetningar").click();
  await expect(page.locator("#share-link")).toHaveValue(/[?&]from=/);
  await expect(page.locator("#share-embed")).toHaveValue(/&v=/);
  await expect(page.locator("#share-link")).toHaveValue(
    /from=\d{4}-\d{2}-\d{2}&to=/,
  );
  const og = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(og).toMatch(/\/api\/card\?.*postcode=107.*&v=/);
  const card = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(card.headers()["content-type"]).toBe("image/png");
  const embed = await request.get("/embed?postcode=107&type=apartment");
  const html = await embed.text();
  expect(html).toContain("Nafnverð, ekki leiðrétt fyrir verðbólgu");
  expect(html).toContain("Gögn sótt");
  expect(html).toMatch(/\d+\. \w+\.? \d{4} – \d+\. \w+\.? \d{4}/);
  const tag = embed.headers()["etag"];
  expect(
    (
      await request.get("/embed?postcode=107&type=apartment", {
        headers: { "If-None-Match": tag },
      })
    ).status(),
  ).toBe(304);
  const thin = await (
    await request.get("/embed?postcode=116&months=3&rooms=5")
  ).text();
  expect(thin).toContain("Færri en 5 sölur");
  expect(thin).not.toMatch(/þ\.kr\.\/m²<\/strong>/);
});
test("comparison shows composition and suppresses thin sides", async ({
  page,
  request,
}) => {
  await page.goto("/samanburdur?a=postcode:107&b=postcode:200");
  await expect(page.locator(".compare-side h2")).toHaveText([
    "107 Reykjavík",
    "200 Kópavogur",
  ]);
  await expect(page.locator(".verdict")).toContainText(
    "á svæði A (107 Reykjavík) en á svæði B (200 Kópavogur)",
  );
  await expect(page.getByText("Verðdreifing á m²")).toBeVisible();
  await expect(page.locator(".compare-side").first()).toContainText("fjölbýli");
  await page.getByRole("button", { name: "Víxla svæðum" }).click();
  await expect(page).toHaveURL(/a=postcode:200&b=postcode:107/);
  const thin = await (
    await request.get("/api/compare?a=postcode:116&b=postcode:107&months=3")
  ).json();
  expect(thin.comparable).toBe(false);
  expect(thin.difference).toBeNull();
  expect(thin.distribution).toBeNull();
  expect((await request.get("/api/compare?a=postcode:107")).status()).toBe(400);
});
