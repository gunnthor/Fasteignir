import { test, expect, type Page } from "@playwright/test";

const noOverflow = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("price distribution: quartiles, protected histogram, chosen price and metric switch", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/markadur?postcode=108&type=apartment&value=75000000");
  const panel = page.locator(".distribution");
  await expect(
    panel.getByRole("heading", { name: "Dreifing verðs" }),
  ).toBeVisible();
  await expect(panel.locator(".quartiles > div")).toHaveCount(3);
  await expect(panel.locator(".distribution-position")).toContainText(
    "sambærilegra sala",
  );
  await expect(panel.getByRole("img")).toHaveAttribute(
    "aria-label",
    /Dreifing kaupverðs í [\d.]+ sölum/,
  );
  // Every displayed bin holds zero or at least five sales.
  await panel.getByText("Sýna sem töflu").click();
  const counts = await panel
    .locator(".table-toggle tbody tr td:nth-child(2)")
    .allInnerTexts();
  expect(counts.length).toBeGreaterThan(3);
  for (const c of counts) {
    const n = Number(c.replace(/\./g, ""));
    expect(n === 0 || n >= 5).toBe(true);
  }
  await panel.getByRole("button", { name: "Verð á m²" }).click();
  await expect(panel.locator("#distribution-unit")).toHaveText("þ.kr./m²");
  await expect(page).toHaveURL(/dist=ppm/);
  await expect(page).not.toHaveURL(/value=/);
  expect(errors).toEqual([]);
});

test("price distribution suppresses small groups", async ({ page }) => {
  await page.goto("/markadur?postcode=999&type=house&months=3");
  await expect(page.locator(".distribution")).toContainText(
    "Hvorki miðgildi né dreifing er birt",
  );
  await expect(page.locator(".distribution .histogram")).toHaveCount(0);
});

test("sales history: lookup, timeline, honesty notice and unknown property", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/eign");
  await page.getByLabel("Heimilisfang eða fastanúmer").fill("Vesturgata 52");
  const choice = page.locator(".property-choice").first();
  await expect(choice).toBeVisible();
  await choice.click();
  await expect(page).toHaveURL(/\/eign\/\d{7}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Vesturgata 52",
  );
  await expect(page.locator(".history-status h2")).toHaveText(
    /Samfelld sölusaga|Óviss samsvörun|Engin fyrri sala skráð/,
  );
  await expect(page.getByText("ekki endilega fyrra verðmæti")).toBeVisible();
  await expect(page.locator(".history-step")).not.toHaveCount(0);
  await expect(page.locator(".history-step").first()).toContainText(
    "Þinglýstur",
  );
  await expect(
    page.getByRole("link", { name: /Verðmeta eignina/ }),
  ).toHaveAttribute("href", /\/verdmat\?property=\d{7}/);
  await expect(page.locator("body")).not.toContainText(/kaupandi|seljandi:/i);
  await page.goto("/eign/0000001");
  await expect(
    page.getByRole("heading", { name: "Engin skráð sölusaga fannst" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("valuation evidence, scenario before/after and reset", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/verdmat");
  await page.getByLabel("Póstnúmer", { exact: true }).fill("108");
  await page.getByLabel("Stærð í m²").first().fill("90");
  await page.getByLabel("Herbergi", { exact: true }).first().fill("3");
  await page.getByLabel("Byggingarár", { exact: true }).first().fill("1980");
  await page.getByRole("button", { name: "Skoða verðbil" }).click();
  await expect(page.getByText("Á hverju byggir matið?")).toBeVisible();
  await expect(page.getByText("ekki kvarðað öryggisbil")).toBeVisible();
  await expect(page.locator(".scenario-table tbody tr")).toHaveCount(9);
  const sensitivity = page.locator(".sensitivity");
  await sensitivity.getByLabel("Stærð í m²").fill("110");
  await sensitivity.getByRole("button", { name: "Reikna sviðsmynd" }).click();
  await expect(page.locator(".before-after")).toContainText("Fyrir");
  await expect(page.locator(".before-after")).toContainText("Eftir");
  await sensitivity.getByRole("button", { name: "Endurstilla" }).click();
  await expect(page.locator(".before-after")).toHaveCount(0);
  await expect(sensitivity.getByLabel("Stærð í m²")).toHaveValue("90");
  // Weight explanation for the most influential comparable.
  await page.locator(".comparable-list summary").first().click();
  await expect(page.locator(".comparable-detail").first()).toContainText(
    "Byggingarár",
  );
  await expect(page.getByText("Sölurnar á bak við matið")).toBeVisible();
  expect(errors).toEqual([]);
});

test("newly registered sales keep the three dates apart; delay analysis renders", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/nyskrad");
  await expect(page.getByText("Þrjár ólíkar dagsetningar")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hversu lengi tekur þinglýsing?" }),
  ).toBeVisible();
  await expect(page.locator(".lag-summary")).toContainText("Miðgildi biðtíma");
  const cards = page.locator(".new-sales > li");
  if (await cards.count()) {
    const dates = cards.first().locator(".three-dates dt");
    await expect(dates).toHaveText([
      "Undirritaður",
      "Þinglýstur",
      "Fyrst séð",
      "Bið eftir þinglýsingu",
    ]);
  } else
    await expect(page.locator(".insight-body .notice").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/seld í dag/i);
  await page.locator("select[name=type]").selectOption("house");
  await page.getByRole("button", { name: "Sía" }).click();
  await expect(page).toHaveURL(/type=house/);
  await expect(page.locator(".lag-summary")).toBeVisible();
  expect(errors).toEqual([]);
});

test("new pages fit a phone in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  for (const url of [
    "/markadur?postcode=108&type=apartment&value=75000000",
    "/eign",
    "/nyskrad",
  ]) {
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.waitForLoadState("networkidle");
    expect(await noOverflow(page), url).toBe(true);
  }
  await page.goto("/eign");
  await page.getByLabel("Heimilisfang eða fastanúmer").fill("Vesturgata 52");
  await page.locator(".property-choice").first().click();
  await expect(page.locator(".history-step").first()).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});
