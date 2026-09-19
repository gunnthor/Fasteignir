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
