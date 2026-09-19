import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://127.0.0.1:3001",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH,
      args: ["--enable-unsafe-swiftshader"],
    },
  },
  reporter: "list",
  timeout: 30000,
});
