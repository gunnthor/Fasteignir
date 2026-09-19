import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
// No automated tile harvesting: block the community tile server in automated checks.
await page.route("https://tile.openstreetmap.org/**", (route) =>
  route.fulfill({
    contentType: "image/png",
    body: readFileSync("tests/fixtures/neutral-tile.png"),
  }),
);
const errors = [];
page.on("requestfailed", (r) =>
  console.log("request failed", r.url(), r.failure()),
);
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    console.log(m.type(), m.text());
});
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.TEST_BASE_URL ?? "http://127.0.0.1:3001");
await page
  .getByText("gildar sölur á tímabilinu", { exact: false })
  .waitFor({ timeout: 30000 });
await page.waitForFunction(
  () =>
    Number(document.querySelector(".map-canvas")?.dataset.renderedDistricts) >
    0,
);
await page.screenshot({ path: "/tmp/fasteign-desktop.png", fullPage: true });
console.log(
  JSON.stringify(
    {
      title: await page.title(),
      heading: await page.locator("h1").innerText(),
      errors,
    },
    null,
    2,
  ),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "/tmp/fasteign-mobile.png", fullPage: true });
await browser.close();
