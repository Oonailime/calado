import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: [
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--disable-dev-shm-usage",
      ],
    },
  },
});
