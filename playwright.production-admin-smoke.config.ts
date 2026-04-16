import { defineConfig, devices } from "@playwright/test";

const baseUrl = process.env.PRODUCTION_SMOKE_BASE_URL;

if (!baseUrl) {
  throw new Error("Missing PRODUCTION_SMOKE_BASE_URL for production admin smoke config.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/admin-production-smoke.spec.ts",
  outputDir: "tmp/playwright/test-results-production-admin-smoke",
  reporter: "list",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: baseUrl,
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium-admin-production-smoke",
      use: {
        browserName: "chromium",
        ...devices["iPhone 13"],
      },
    },
  ],
});
